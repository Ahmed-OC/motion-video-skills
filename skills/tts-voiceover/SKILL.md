---
name: tts-voiceover
description: >-
  Generate studio voiceovers with frame-quantized scene timings, smart multilingual captions
  (FR elisions + narrow non-breaking spaces, EN orphan-free pages, CJK Kinsoku chunking), and
  per-frame audio envelopes (`rms`, `bass`, `high`). Supports free `edge-tts` (default),
  multi-scene JSON scripts (`--scenes-json`), local `kokoro`, `faster-whisper` / `stable-ts`
  alignment, and drop-in `vo.js` / `vo_words.json` outputs.
---

# TTS Voiceover v2.0 — VO-First Timing, Smart Multilingual Captions & Envelopes

Narration paces everything: **always generate voiceover FIRST**, lock frame-exact scene durations from the real speech, and animate visuals to those cue times.

---

## 1. Quickstart (Single Script or Multi-Scene VO-First JSON)

```bash
pip install -U edge-tts

# A) Single narration -> vo.mp3 + vo_words.json + vo.js
python scripts/vo_gen.py --text "Pourquoi 99 % d'Internet passe sous l'océan ?" --voice fr-FR-DeniseNeural --rate -2%

# B) Multi-scene VO-first pipeline (frame-quantized scene durations, zero cut drift!)
# scenes.json: [{"id":"hook","narration":"..."},{"id":"proof","narration":"..."}]
python scripts/vo_gen.py --scenes-json video/scenes.json --voice en-US-AriaNeural --fps 30 --prefix video/vo
```

### Outputs (`--prefix video/vo`)
- `video/vo.mp3` — Clean concatenated audio padded to exact integer frame boundaries (`scene_frames / fps`) so `disco.mjs` cuts never drift by ±1 frame.
- `video/vo_words.json` — Contains:
  - `scenes[]` (when `--scenes-json` used): `{ id, start, duration, startFrame, durationFrames }` ready to paste into `timeline.json`.
  - `words[]`: `{ text, fromMs, toMs }` with stripped punctuation restored from source text!
  - `captions[]`: Smart 3-pass multilingual pages (`{ startMs, durationMs, text, tokens[] }`):
    - **French**: merges elisions (`l'` + `océan` → `l'océan`, never `L' OCÉAN`) and attaches `? ! : ;` with `\u202F`.
    - **FR & EN**: backtracks so proclitics (`le`, `de`, `à`, `the`, `of`, `to`) never dangle alone at page end.
    - **CJK (`zh`, `ja`, `ko`)**: joins without spaces, preserves native characters (no `.upper()`), and respects *Kinsoku* punctuation rules.
  - `envelope`: `{ fps, rms[], bass[], high[] }` normalized `[0..1]` per video frame — drive audio-reactive pulses/bars deterministically inside `seek(t)`!
- `video/vo.js` — `window.VO_B64` + `window.VO_DATA` for standalone HTML playback.

---

## 2. Recommended Voices & Expressive Tag Hygiene

| Language | Documentary / Editorial | Dynamic / Tech Launch |
|---|---|---|
| `fr` | `fr-FR-DeniseNeural` | `fr-FR-HenriNeural` / `fr-FR-RemyMultilingualNeural` |
| `en` | `en-US-AriaNeural` / `en-US-BrianMultilingualNeural` | `en-US-AndrewMultilingualNeural` |
| `zh` | `zh-CN-XiaoxiaoNeural` | `zh-CN-YunxiNeural` |
| `ja` | `ja-JP-NanamiNeural` | `ja-JP-KeitaNeural` |
| `ko` | `ko-KR-SunHiNeural` | `ko-KR-InJoonNeural` |

- **Expressive tags**: Inline stage tags like `[short pause]` or `[excited]` (used by Gemini TTS / Fish-Speech / Qwen3-TTS) are automatically stripped by `vo_gen.py` (`strip_tts_tags`) before speaking on Edge-TTS and before building captions.
- **Forced alignment for external audio** (ElevenLabs, Gemini TTS, Kokoro, recorded human voice): prefer **`stable-ts`** (`stable_whisper.load_faster_whisper('small').align(audio, clean_script)`) over raw `transcribe()` so technical acronyms and numbers are never misspelled in captions.
