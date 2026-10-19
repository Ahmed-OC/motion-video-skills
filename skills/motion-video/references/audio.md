# Audio — TTS, music, SFX, beat grids, mixing

Audio is half the perceived quality. Silence or bad sync is the #1 tell of AI video.
Target: voice/music/SFX as separate stems, mixed with ducking, normalized to −14 LUFS
integrated (−1.5 dBTP). Social platforms normalize to roughly −14 anyway.

## 1. The grid: declare BPM, don't detect

- You control the music → generate it ON the grid (synth recipes below): every event at
  `beat_k = k · 60/bpm`. Visuals read the same grid from timeline.json. Deterministic by
  construction.
- Syncing an EXISTING track → estimate BPM + beats once, then treat the result as the grid:

```bash
pip install librosa
python scripts/beat_grid.py music.mp3 beats.json   # { bpm, beats[], downbeats[], duration }
```

Sanity-check the detected BPM against the track's published tempo before trusting it.

## 2. Voiceover (TTS menu)

| Engine | Cost | Command / access | Word timing |
|---|---|---|---|
| edge-tts | free, no key | `edge-tts --voice fr-FR-HenriNeural --text "..." --write-media vo.mp3 --write-subtitles vo.vtt` | word-boundary events (also grab JSON: `edge-tts --list-voices` to pick; python API `Communicate.stream()` gives `WordBoundary` offsets) |
| Kokoro | free, local | `pip install kokoro` (82M params, 8 voices, good quality) | whisper it |
| Piper | free, local | `piper --model fr_FR-siwis-medium --output_file vo.wav` | whisper it |
| ElevenLabs | paid | API `with-timestamps` returns character-level times | built-in, feed `@remotion/captions` `elevenLabsTranscriptToCaptions` |
| VOICEVOX (JP) | free, local | HTTP `http://localhost:50021` | per-phoneme timings (great for JP lip flap) |

Voice directions that work: short sentences, explicit pace ("calm documentary pace",
"energetic 1.15×"), punctuation for pauses. Re-generate per sentence and assemble — easier
to redo one bad line.

Word timing of any audio (the universal fallback):
```bash
pip install faster-whisper
python -c "from faster_whisper import WhisperModel; import json; m=WhisperModel('small'); segs,info=m.transcribe('vo.mp3',word_timestamps=True); print(json.dumps([w._asdict() for s in segs for w in s.words]))" > words.json
```
Then write `tokens[]` into timeline.captions — caption pops snap to actual words, not guesses.

## 3. Music in code (Web Audio / OfflineAudioContext)

Synthesize the track while rendering (`window.renderAudio()` in the canvas engine, or a
Node/python pre-pass writing `music.wav`). Everything locks to the BPM grid:

```js
function synthTrack(bpm, bars) {                    // 120bpm, 8 bars ≈ 16s
  const sr = 44100, beat = 60 / bpm, len = bars * 4 * beat;
  const ctx = new OfflineAudioContext(2, sr * len, sr);
  const kick = (t) => {                             // pitch-drop sine + exp decay
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
  };
  const hat = (t) => {                              // highpassed noise burst
    const b = ctx.createBuffer(1, sr * 0.05, sr), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = 'highpass'; f.frequency.value = 8000; g.gain.value = 0.25;
    s.connect(f).connect(g).connect(ctx.destination); s.start(t);
  };
  for (let bar = 0; bar < bars; bar++) for (let b = 0; b < 4; b++) {
    const t = (bar * 4 + b) * beat;
    if (b === 0) kick(t);                           // four-on-the-floor
    hat(t + beat / 2);                              // offbeat hats
  }
  return ctx.startRendering();                      // → AudioBuffer → WAV encode
}
```

Structure rules that make synth tracks feel produced: intro (kick+bass only) → build
(add hats, filter opens over 2 bars) → 0.1s of FULL silence → drop (everything + pad:
7 detuned saws ±8 cents through a lowpass). Sidechain feel: duck pad/gain by 30% for 80ms
on every kick (schedule gain envelopes at kick times).

Alternatives: Suno API (v5, one-shot "Sounds" mode for SFX), ACE-Step (Apache-2.0 local),
or any provided track — then beat_grid.py (§1).

SFX: synthesize whooshes (filtered noise sweep 200→8000Hz over 0.3s), impacts (low sine
burst + noise click), ticks — or freesound.org (434k CC sounds, `freesound-python`).
The $0.15-explainer playbook: a cue sheet (248 cues: time + type) → 48 NumPy-synthesized
SFX — code is free, files are licensed.

## 4. Mixing (ffmpeg)

```bash
# Duck music under VO (sidechain: VO as trigger) — stems must be separate files
ffmpeg -i vo.mp3 -i music.mp3 -filter_complex \
 "[1:a]volume=0.6[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=300[duck];[0:a][duck]amix=inputs=2:duration=first:dropout_transition=2[out]" \
 -map "[out]" mixed.mp3

# Loudness normalize a stem or the final mix
ffmpeg -i mixed.mp3 -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 final_audio.wav
```

Mix levels: VO −14 LUFS anchor, music bed −18 to −22 LUFS before ducking, SFX peaks ≤ −12.
VO stem chain if needed: highpass 80Hz → gentle compressor → de-ess → loudnorm.

## 5. Sync verification (do this, it's cheap)

- In the page/build code: assert every visual cue time and its audio event time differ by
  < 30ms — both read timeline.json, so a violation is a bug, not a mix issue.
- A/B in the render: extract 3 frames at cue times ± 1 frame and confirm the visual state
  flips exactly at the cue (see verify.md determinism checks).
- Watch the contact sheet against the beat grid: cuts on downbeats should line up column-wise.

## 6. Legal hygiene

- Code-synthesized audio = yours. Suno/ACE-Step/ElevenLabs: check the plan's commercial
  terms before monetizing. freesound: respect the CC attribution variants (log credits).
- Never present AI voices as real people; keep a LICENSES note when shipping assets.
