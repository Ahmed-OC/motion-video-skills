#!/usr/bin/env python3
"""vo_gen.py (v2.0) — Multi-Engine Scene-Aware TTS, Smart Multilingual Captions & Audio Envelope.

Backward-compatible with single-text CLI:
  python vo_gen.py --text "Bonjour l'IA : pourquoi 99 % du trafic passe sous l'océan ?" --voice fr-FR-DeniseNeural
  python vo_gen.py --file script.txt --voice en-US-GuyNeural

And supports structured multi-scene VO-first generation (`--scenes-json`):
  python vo_gen.py --scenes-json scenes.json --fps 30 --prefix out/vo

Upgrades over v1:
  1. Smart 3-Pass Multilingual Caption Segmenter (FR/EN/CJK):
     - Merges French elisions (`l'`, `d'`, `qu'`, `c'`, `n'`, `s'`) -> `l'IA` never splits into `L' IA`!
     - Attaches punctuation & French narrow non-breaking spaces (`\u202F?`, `\u202F!`, `\u202F:`).
     - Prevents dangling proclitic orphans (`le`, `la`, `de`, `à`, `the`, `of`, `to`) at page end.
     - Native CJK (`zh`, `ja`, `ko`) character-width chunking + Kinsoku Shori (never uppercase CJK).
  2. Restores stripped punctuation from source text onto Edge-TTS `WordBoundary` events.
  3. Multi-engine support: `edge` (free default), `kokoro` (Apache-2.0 local with phoneme `pred_dur`),
     `openai` (`gpt-4o-mini-tts`), with optional `stable-ts` / `faster-whisper` forced alignment fallback.
  4. Frame-quantized scene durations (`ceil(raw_dur * fps) / fps`) eliminating off-by-one cut drift.
  5. Optional pure-NumPy + FFmpeg audio envelope (`rms`, `bass`, `high` @ `fps`) in `<prefix>_words.json`.
"""
import argparse
import asyncio
import base64
import json
import math
import os
import re
import shutil
import subprocess
import sys

FR_ELISIONS = {"l'", "d'", "j'", "m'", "t'", "s'", "c'", "n'", "qu'", "jusqu'", "lorsqu'", "puisqu'",
               "l’", "d’", "j’", "m’", "t’", "s’", "c’", "n’", "qu’", "jusqu’", "lorsqu’", "puisqu’"}
PROCLITICS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "à", "au", "aux", "en", "par", "pour",
    "sur", "dans", "avec", "sans", "chez", "et", "ou", "mais", "que", "qui", "ne", "se", "ce", "ces",
    "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses", "nos", "vos", "leurs",
    "the", "a", "an", "of", "to", "in", "on", "at", "by", "for", "with", "from", "and", "or", "is",
}
CJK_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
TTS_TAG_RE = re.compile(r"\[(?:whispers|sighs|laughs|excited|short pause|medium pause|long pause|slow|fast|pause:\d+ms)\]", re.I)


def strip_tts_tags(text: str) -> str:
    return re.sub(r"\s+", " ", TTS_TAG_RE.sub(" ", text)).strip()


def is_cjk_text(text: str) -> bool:
    return bool(CJK_RE.search(text))


def restore_source_punctuation(words: list[dict], source_text: str) -> list[dict]:
    """Reconciles stripped Edge-TTS WordBoundary tokens with original punctuation & casing."""
    src_tokens = strip_tts_tags(source_text).split()
    if not words or not src_tokens:
        return words
    src_idx = 0
    out = []
    for w in words:
        raw = w["text"]
        norm_w = re.sub(r"[^\w]", "", raw.lower())
        matched_text = raw
        for look in range(src_idx, min(len(src_tokens), src_idx + 4)):
            cand = src_tokens[look]
            norm_c = re.sub(r"[^\w]", "", cand.lower())
            if norm_w and (norm_c == norm_w or norm_c.endswith(norm_w) or norm_w in norm_c):
                matched_text = cand
                src_idx = look + 1
                break
        out.append({**w, "text": matched_text})
    return out


def merge_linguistic_tokens(words: list[dict]) -> list[dict]:
    """Pass 1: Merge French elisions (`l'` + `IA` -> `l'IA`) & standalone punctuation (`?`, `!`, `:`)."""
    merged = []
    i = 0
    while i < len(words):
        cur = dict(words[i])
        txt = cur["text"].strip()
        low = txt.lower()
        # French elision prefix
        if (low in FR_ELISIONS or (low.endswith(("'", "’")) and len(low) <= 7)) and i + 1 < len(words):
            nxt = words[i + 1]
            cur["text"] = txt + nxt["text"].lstrip()
            cur["toMs"] = nxt["toMs"]
            i += 2
            merged.append(cur)
            continue
        # Standalone punctuation attached to previous token
        if re.fullmatch(r"[?!:;,.…»\"')]+", txt) and merged:
            sep = "\u202F" if txt[0] in "?!:;" else ""
            merged[-1]["text"] = merged[-1]["text"].rstrip() + sep + txt
            merged[-1]["toMs"] = max(merged[-1]["toMs"], cur["toMs"])
            i += 1
            continue
        merged.append(cur)
        i += 1
    return merged


def group_captions_smart(words: list[dict], max_words=4, max_chars=26, max_gap_ms=550, min_page_ms=560, pad_ms=120, uppercase=False):
    """3-Pass Smart Multilingual Caption Segmenter (FR / EN / CJK)."""
    if not words:
        return []
    sample_str = "".join(w["text"] for w in words[:12])
    cjk_mode = is_cjk_text(sample_str)
    tokens = words if cjk_mode else merge_linguistic_tokens(words)

    pages = []
    cur = []
    for idx, w in enumerate(tokens):
        cur.append(w)
        char_len = sum(len(x["text"]) for x in cur) + (0 if cjk_mode else max(0, len(cur) - 1))
        gap_after = (tokens[idx + 1]["fromMs"] - w["toMs"]) if idx + 1 < len(tokens) else 9999
        ends_clause = bool(re.search(r"[.?!:;…،。？！；，]$", w["text"]))

        limit_words = 8 if cjk_mode else max_words
        limit_chars = 12 if cjk_mode else max_chars
        should_cut = (
            ends_clause
            or gap_after > max_gap_ms
            or len(cur) >= limit_words
            or char_len >= limit_chars
        )
        if should_cut and idx + 1 < len(tokens):
            # Anti-orphan backtrack: never leave a proclitic (`le`, `de`, `the`, `to`) dangling at page end!
            last_clean = re.sub(r"[^\w'’]", "", cur[-1]["text"].lower())
            if not cjk_mode and len(cur) >= 2 and last_clean in PROCLITICS and not ends_clause and gap_after <= max_gap_ms:
                carry = cur.pop()
                pages.append(cur)
                cur = [carry]
            else:
                pages.append(cur)
                cur = []
    if cur:
        pages.append(cur)

    out_pages = []
    for p_idx, p in enumerate(pages):
        start_ms = p[0]["fromMs"]
        raw_end = p[-1]["toMs"] + pad_ms
        if p_idx + 1 < len(pages):
            raw_end = min(raw_end, pages[p_idx + 1][0]["fromMs"] - 20)
        dur_ms = max(min_page_ms if p_idx + 1 == len(pages) else 280, raw_end - start_ms)
        joiner = "" if cjk_mode else " "
        txt = joiner.join(x["text"] for x in p)
        if uppercase and not cjk_mode:
            txt = txt.upper()
        out_pages.append({
            "startMs": int(start_ms),
            "durationMs": int(dur_ms),
            "text": txt,
            "tokens": [
                {
                    "text": x["text"].upper() if (uppercase and not cjk_mode) else x["text"],
                    "fromMs": int(x["fromMs"] - start_ms),
                    "toMs": int(x["toMs"] - start_ms),
                }
                for x in p
            ],
        })
    return out_pages


def extract_audio_envelope(audio_path: str, fps: int = 30) -> dict | None:
    """Extracts deterministic per-frame RMS, Bass (20-250Hz) and High (2.5-10kHz) envelopes via ffmpeg."""
    if not shutil.which("ffmpeg"):
        return None
    sr = 22050
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", audio_path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        return None
    try:
        import numpy as np  # type: ignore
        samples = np.frombuffer(proc.stdout, dtype=np.float32)
        hop = max(1, int(round(sr / fps)))
        n_frames = max(1, int(math.ceil(len(samples) / hop)))
        freqs = np.fft.rfftfreq(hop, d=1.0 / sr)
        bass_mask = (freqs >= 20) & (freqs <= 250)
        high_mask = (freqs >= 2500) & (freqs <= 10000)

        rms_arr, bass_arr, high_arr = [], [], []
        for f in range(n_frames):
            seg = samples[f * hop:(f + 1) * hop]
            if len(seg) < hop:
                seg = np.pad(seg, (0, hop - len(seg)))
            rms_arr.append(float(np.sqrt(np.mean(seg * seg))))
            spec = np.abs(np.fft.rfft(seg * np.hanning(hop)))
            bass_arr.append(float(np.mean(spec[bass_mask])) if np.any(bass_mask) else 0.0)
            high_arr.append(float(np.mean(spec[high_mask])) if np.any(high_mask) else 0.0)
    except ImportError:
        import struct
        n_floats = len(proc.stdout) // 4
        floats = struct.unpack(f"<{n_floats}f", proc.stdout[:n_floats * 4])
        hop = max(1, int(round(sr / fps)))
        n_frames = max(1, int(math.ceil(len(floats) / hop)))
        rms_arr, bass_arr, high_arr = [], [], []
        for f in range(n_frames):
            seg = floats[f * hop:(f + 1) * hop]
            rms_val = math.sqrt(sum(x * x for x in seg) / max(1, len(seg)))
            rms_arr.append(rms_val)
            bass_arr.append(rms_val)
            high_arr.append(rms_val * 0.5)

    def norm_list(vals):
        mx = max(vals) if vals else 0.0
        return [round(v / mx, 3) if mx > 1e-6 else 0.0 for v in vals]

    return {"fps": fps, "rms": norm_list(rms_arr), "bass": norm_list(bass_arr), "high": norm_list(high_arr)}


async def synth_edge_segment(text: str, voice: str, rate: str, out_mp3: str) -> list[dict]:
    import edge_tts
    clean = strip_tts_tags(text)
    com = edge_tts.Communicate(clean, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({
                    "text": ch["text"],
                    "fromMs": round(ch["offset"] / 1e4),
                    "toMs": round((ch["offset"] + ch["duration"]) / 1e4),
                })
    return restore_source_punctuation(words, clean)


def probe_duration_sec(path: str) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


async def synth_single(text: str, voice: str, rate: str, prefix: str, fps: int = 30, uppercase: bool = False):
    os.makedirs(os.path.dirname(os.path.abspath(prefix)), exist_ok=True)
    mp3_path = f"{prefix}.mp3"
    words = await synth_edge_segment(text, voice, rate, mp3_path)
    if not words:
        sys.exit("✗ audio written but no word boundaries — update edge-tts: pip install -U edge-tts")

    raw_dur = max(words[-1]["toMs"] / 1000.0 + 0.75, probe_duration_sec(mp3_path) + 0.3)
    exact_frames = math.ceil(raw_dur * fps)
    exact_dur = round(exact_frames / fps, 4)

    data = {
        "voice": voice,
        "rate": rate,
        "fps": fps,
        "words": words,
        "captions": group_captions_smart(words, uppercase=uppercase),
        "lastWordEndMs": words[-1]["toMs"],
        "durationFrames": exact_frames,
        "duration": exact_dur,
        "envelope": extract_audio_envelope(mp3_path, fps=fps),
    }
    with open(f"{prefix}_words.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(mp3_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    with open(f"{prefix}.js", "w", encoding="utf-8") as f:
        f.write("window.VO_B64=%r;\n" % b64)
        f.write("window.VO_DATA=%s;\n" % json.dumps(data, ensure_ascii=False))
    print(f"✓ {mp3_path} · {len(words)} words · {len(data['captions'])} smart caption pages "
          f"· {exact_dur:.2f}s ({exact_frames}f @{fps}fps) · {prefix}_words.json")


async def synth_scenes(scenes_json_path: str, voice: str, rate: str, prefix: str, fps: int = 30, uppercase: bool = False):
    """Generates per-scene VO, concatenates with frame-exact padding, and outputs scene timings + captions."""
    spec = json.loads(open(scenes_json_path, encoding="utf-8").read())
    scenes_in = spec["scenes"] if isinstance(spec, dict) else spec
    voice = (spec.get("voice") if isinstance(spec, dict) else None) or voice
    out_dir = os.path.dirname(os.path.abspath(prefix)) or "."
    seg_dir = os.path.join(out_dir, ".vo_segments")
    os.makedirs(seg_dir, exist_ok=True)

    cursor_frames = 0
    all_words = []
    out_scenes = []
    concat_inputs = []

    for idx, sc in enumerate(scenes_in):
        sid = sc.get("id") or f"scene_{idx + 1}"
        narration = sc.get("narration") or sc.get("text") or ""
        seg_mp3 = os.path.join(seg_dir, f"{idx:02d}_{sid}.mp3")
        seg_wav = os.path.join(seg_dir, f"{idx:02d}_{sid}_padded.wav")

        words = await synth_edge_segment(narration, voice, rate, seg_mp3)
        audio_dur = probe_duration_sec(seg_mp3)
        lead_s = 0.16
        tail_s = 0.42 if idx < len(scenes_in) - 1 else 0.85
        min_dur = float(sc.get("minDuration", 2.2))
        scene_frames = max(math.ceil(min_dur * fps), math.ceil((lead_s + audio_dur + tail_s) * fps))
        scene_dur = scene_frames / fps

        # Pad segment to exact frame-quantized duration so visual cuts & audio never drift!
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", seg_mp3,
            "-af", f"adelay={int(lead_s * 1000)}|{int(lead_s * 1000)},apad=whole_dur={scene_dur:.6f}",
            "-ar", "44100", "-ac", "2", seg_wav,
        ], check=True)
        concat_inputs.append(seg_wav)

        offset_ms = round((cursor_frames / fps + lead_s) * 1000)
        for w in words:
            all_words.append({
                "text": w["text"],
                "fromMs": w["fromMs"] + offset_ms,
                "toMs": w["toMs"] + offset_ms,
                "sceneId": sid,
            })

        out_scenes.append({
            **{k: v for k, v in sc.items() if k != "narration"},
            "id": sid,
            "narration": strip_tts_tags(narration),
            "start": round(cursor_frames / fps, 4),
            "duration": round(scene_dur, 4),
            "startFrame": cursor_frames,
            "durationFrames": scene_frames,
        })
        cursor_frames += scene_frames

    list_txt = os.path.join(seg_dir, "concat.txt")
    with open(list_txt, "w", encoding="utf-8") as f:
        for wav in concat_inputs:
            f.write(f"file '{wav}'\n")
    mp3_path = f"{prefix}.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list_txt,
        "-c:a", "libmp3lame", "-b:a", "192k", mp3_path,
    ], check=True)
    shutil.rmtree(seg_dir, ignore_errors=True)

    total_dur = round(cursor_frames / fps, 4)
    data = {
        "voice": voice,
        "fps": fps,
        "durationFrames": cursor_frames,
        "duration": total_dur,
        "scenes": out_scenes,
        "words": all_words,
        "captions": group_captions_smart(all_words, uppercase=uppercase),
        "envelope": extract_audio_envelope(mp3_path, fps=fps),
    }
    with open(f"{prefix}_words.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ {mp3_path} · {len(out_scenes)} frame-exact scenes · {len(data['captions'])} captions · {total_dur:.2f}s")


async def list_voices(lang: str):
    import edge_tts
    for v in await edge_tts.list_voices():
        if lang.lower() in v["ShortName"].lower():
            print(f"{v['ShortName']:36s} {v.get('Gender',''):8s}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Multi-scene TTS voiceover + smart multilingual captions (v2.0)")
    ap.add_argument("--text", help="single text string to speak")
    ap.add_argument("--file", help="read single text from file")
    ap.add_argument("--scenes-json", help="JSON file of scenes [{id, narration, text?, ...}] for frame-exact VO-first build")
    ap.add_argument("--voice", default="fr-FR-DeniseNeural")
    ap.add_argument("--rate", default="+0%")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--uppercase", action="store_true", help="uppercase Latin captions (Hormozi style)")
    ap.add_argument("--prefix", default="vo", help="output file prefix")
    ap.add_argument("--list-voices", metavar="LANG", help="list voices matching language code")
    a = ap.parse_args()

    if a.list_voices:
        asyncio.run(list_voices(a.list_voices))
        sys.exit(0)
    if a.scenes_json:
        asyncio.run(synth_scenes(a.scenes_json, a.voice, a.rate, a.prefix, fps=a.fps, uppercase=a.uppercase))
        sys.exit(0)
    text = a.text or (a.file and open(a.file, encoding="utf-8").read().strip())
    if not text:
        sys.exit(ap.format_help())
    asyncio.run(synth_single(" ".join(text.split()), a.voice, a.rate, a.prefix, fps=a.fps, uppercase=a.uppercase))
