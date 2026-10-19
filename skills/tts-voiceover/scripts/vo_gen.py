#!/usr/bin/env python3
"""vo_gen.py — TTS voiceover with word-level timings (edge-tts, free, no API key).

Usage:
  python vo_gen.py --text "Bonjour le monde" [--voice fr-FR-DeniseNeural] [--rate -4%] [--prefix vo]
  python vo_gen.py --file script.txt --voice en-US-GuyNeural
  python vo_gen.py --list-voices fr          # find voices for a language

Outputs:
  <prefix>.mp3           the audio track
  <prefix>_words.json    { words:[{text,fromMs,toMs}], captions:[{startMs,durationMs,text,tokens[]}] }
  <prefix>.js            window.VO_B64 (base64 mp3) + window.VO_DATA — embeddable in a canvas page

Captions are grouped into pages of <=3 words (a gap >700ms or a page break also splits),
each token carrying its own fromMs/toMs window relative to the page start — the
TikTok/Hormozi word-pop format.

Notes:
  edge-tts >= 7 needs boundary="WordBoundary" (sentences are the default) — handled here.
  HTTP 403 from the service means your edge-tts is outdated: pip install -U edge-tts
"""
import argparse
import asyncio
import base64
import json
import sys


def group_captions(words, max_words=3, max_gap_ms=700, min_page_ms=600, pad_ms=150):
    pages, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or w["fromMs"] - cur[-1]["toMs"] > max_gap_ms):
            pages.append(cur)
            cur = []
        cur.append(w)
    if cur:
        pages.append(cur)
    return [{
        "startMs": p[0]["fromMs"],
        "durationMs": max(min_page_ms, p[-1]["toMs"] - p[0]["fromMs"] + pad_ms),
        "text": " ".join(x["text"] for x in p).upper(),
        "tokens": [
            {"text": x["text"],
             "fromMs": x["fromMs"] - p[0]["fromMs"],
             "toMs": x["toMs"] - p[0]["fromMs"]}
            for x in p
        ],
    } for p in pages]


async def synth(text, voice, rate, prefix):
    import edge_tts
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(f"{prefix}.mp3", "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({
                    "text": ch["text"],
                    "fromMs": round(ch["offset"] / 1e4),
                    "toMs": round((ch["offset"] + ch["duration"]) / 1e4),
                })
    if not words:
        sys.exit("✗ audio written but no word boundaries — update edge-tts: pip install -U edge-tts")
    data = {
        "voice": voice, "rate": rate,
        "words": words,
        "captions": group_captions(words),
        "lastWordEndMs": words[-1]["toMs"],
        "duration": round(words[-1]["toMs"] / 1000 + 0.9, 2),  # + tail hold
    }
    with open(f"{prefix}_words.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(f"{prefix}.mp3", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    with open(f"{prefix}.js", "w", encoding="utf-8") as f:
        f.write("window.VO_B64=%r;\n" % b64)
        f.write("window.VO_DATA=%s;\n" % json.dumps(data, ensure_ascii=False))
    print(f"✓ {prefix}.mp3 · {len(words)} words · {len(data['captions'])} caption pages "
          f"· ≈{data['duration']}s · {prefix}_words.json · {prefix}.js")


async def list_voices(lang):
    import edge_tts
    for v in await edge_tts.list_voices():
        if lang.lower() in v["ShortName"].lower():
            print(f"{v['ShortName']:36s} {v.get('Gender',''):8s}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="TTS voiceover with word-level timings (edge-tts)")
    ap.add_argument("--text", help="the text to speak")
    ap.add_argument("--file", help="read the text from a file instead")
    ap.add_argument("--voice", default="fr-FR-DeniseNeural")
    ap.add_argument("--rate", default="+0%", help="e.g. -4%% slower, +10%% faster")
    ap.add_argument("--prefix", default="vo", help="output file prefix")
    ap.add_argument("--list-voices", metavar="LANG", help="list voices matching a language code")
    a = ap.parse_args()
    if a.list_voices:
        asyncio.run(list_voices(a.list_voices))
        sys.exit()
    text = a.text or (a.file and open(a.file, encoding="utf-8").read().strip())
    if not text:
        sys.exit(ap.format_help())
    asyncio.run(synth(" ".join(text.split()), a.voice, a.rate, a.prefix))
