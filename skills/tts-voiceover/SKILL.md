---
name: tts-voiceover
description: >-
  Generate voiceovers with WORD-LEVEL timings: free multilingual TTS via edge-tts (default),
  local Kokoro/Piper, or ElevenLabs — and turn any audio into word timestamps with
  faster-whisper. Produces vo.mp3, a words/captions JSON (caption pages of 1–3 words with
  per-word time windows), and an embeddable vo.js for canvas/web video pipelines. Use
  whenever the user needs narration, voiceover, TTS, a dubbed track, text-to-speech in any
  language, or word-synced captions/subtitles (TikTok/Hormozi style) for a video or animation.
---

# TTS Voiceover — narration with word-level timings

Word timings are what make captions pop on the right word and scenes pace on the right
syllable. Always generate the VO FIRST and animate to its real timings — never the
reverse.

## Quickstart (free, no API key)

```bash
pip install edge-tts
python scripts/vo_gen.py --text "Pythagore. Dans un triangle rectangle…" --voice fr-FR-DeniseNeural --rate -4%
```

Outputs (prefix `vo` by default):
- `vo.mp3` — the audio
- `vo_words.json` — `{ words:[{text,fromMs,toMs}], captions:[{startMs,durationMs,text,tokens[]}] }`
  where captions are grouped pages of ≤3 words (gap >700ms breaks a page) with per-word windows
- `vo.js` — `window.VO_B64` (base64 mp3) + `window.VO_DATA` (the JSON), drop-in for a
  canvas/seek pipeline: `<script src="vo.js">` then `decodeAudioData` for playback and
  `VO_DATA.captions` for drawing

List voices: `python scripts/vo_gen.py --list-voices fr` (also: en, ja, es, de, pt, zh, ar…).

## Voice menu (short picks)

| Language | Calm narrator | Energetic |
|---|---|---|
| fr | fr-FR-DeniseNeural | fr-FR-HenriNeural |
| en | en-US-AriaNeural | en-US-GuyNeural |
| ja | ja-JP-NanamiNeural | ja-JP-KeitaNeural |
| es | es-ES-ElviraNeural | es-ES-AlvaroNeural |
| de | de-DE-KatjaNeural | de-DE-ConradNeural |
| pt | pt-BR-FranciscaNeural | pt-BR-AntonioNeural |
| zh | zh-CN-XiaoxiaoNeural | zh-CN-YunjianNeural |

Rate syntax: `--rate -4%` slower / `+10%` faster. Short sentences give cleaner word
boundaries; regenerate per sentence to redo one bad line without redoing the track.

## Gotchas (learned the hard way)

- **edge-tts ≥ 7**: word boundaries are OFF by default — `boundary="WordBoundary"` is
  required (vo_gen.py already passes it). Symptom of the bug: audio OK, `words` empty.
- **HTTP 403 from the service**: your edge-tts is too old for the current token scheme —
  `pip install -U edge-tts` (use a venv if the system install is locked).
- Word offsets are in 100-nanosecond units in the raw stream; divide by 10⁴ for ms.

## Alternatives & upgrades

- **Kokoro** (`pip install kokoro`) — local neural TTS, 82M params, several langs.
- **Piper** — fully offline, fast, per-language voice downloads.
- **ElevenLabs** — paid, multilingual v2; the `with-timestamps` API returns character-level
  times that feed captions directly.
- **VOICEVOX** (Japanese) — local HTTP API at `localhost:50021`, per-phoneme timings
  (great for JP lip-flap animation).
- **Any existing audio** → word timings via faster-whisper:
  ```bash
  pip install faster-whisper
  python - <<'EOF'
  from faster_whisper import WhisperModel; import json
  m = WhisperModel("small"); segs, _ = m.transcribe("track.mp3", word_timestamps=True)
  json.dump([w._asdict() for s in segs for w in s.words], open("words.json","w"))
  EOF
  ```

## Mixing into a video (quick reference)

Voice, music and SFX as SEPARATE stems, then: music bed −18…−22 LUFS under VO, duck with
ffmpeg `sidechaincompress` (VO as trigger), final `loudnorm=I=-14:TP=-1.5:LRA=11`.
Caption style that works: bold caps, 1–3 words per pop, active word in accent color with a
~20% scale pop, black pill or stroke behind for contrast, kept out of platform UI zones.
