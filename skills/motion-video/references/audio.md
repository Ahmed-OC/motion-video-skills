# Audio v2.0 — Multi-Engine TTS, Warm Studio WebAudio Bed, Foley & Spectral Carving

Audio accounts for 50% of perceived studio quality. Harsh white-noise hats, robotic untimed captions, or music masking the voiceover immediately expose an amateur AI video.

---

## 1. Voiceover First (`tts-voiceover` v2.0)

Generate narration **before** animating scenes so real speech cadences lock `timeline.json`:

```bash
# Multi-scene VO-first generation (frame-quantized durations + smart FR/EN/CJK captions + RMS/bass/high envelope!)
python <tts-voiceover>/scripts/vo_gen.py --scenes-json video/scenes.json --voice fr-FR-DeniseNeural --fps 30 --prefix video/vo
```

### 2026 TTS Engine Menu

| Engine | Access | Key Strength & Word-Timing Strategy |
|---|---|---|
| **`edge-tts` v7.3+** *(Default)* | Free, zero key | Built into `vo_gen.py` (`boundary="WordBoundary"` + source punctuation restoration + French elision `l'IA` & CJK Kinsoku smart segmenter). |
| **`Kokoro-82M` v1.1** | Apache-2.0 local CPU | Ultra-fast natural voices (`af_heart`, `ff_siwis`); `result.pred_dur` (`25ms`/unit) gives exact phoneme durations in EN/FR without Whisper! |
| **Gemini TTS (`3.1-flash-tts`)** | API | Supports `[whispers]`, `[excited]`, `[short pause]` tags — always strip tags (`strip_tts_tags`) before captioning & forced-align via `stable-ts`. |
| **CosyVoice 3 / Fish-Speech / Qwen3-TTS** | Open-weight local | SOTA Chinese/multilingual prosody & zero-shot timbre cloning; align word windows via `stable-ts` or `FireRedASR2-CTC`. |
| **ElevenLabs (`/with-timestamps`)** | Paid API | Character-level `alignment` JSON (validate monotonic timestamps on long paragraphs; fallback to `stable-ts` if degenerate). |

- **Forced Alignment Rule**: When aligning external audio, use **`stable-ts` (`model.align(audio, clean_script)`)** instead of blind `whisper.transcribe()` so domain terms, numbers, and brand names are 100% preserved.

---

## 2. Warm Studio Music & Foley in Pure Code (`MVS.synthStudioAudio`)

Never use raw `Math.random()` white noise or piercing unfiltered sawtooth oscillators. `assets/motion-kit.js` includes `MVS.synthStudioAudio({ bpm, duration, cues, seed })` out of the box:
1. **Paul Kellet 6-Pole Pink Noise (`-3 dB/oct`)** seeded with `mulberry32` for silky shakers and organic **bandpass Doppler whooshes** at scene `cues[]`.
2. **Neo-Soul / Editorial Voicings (`Fmaj9 → Em7 → Dm9 → Cmaj9`)**: stereo-detuned (`±6 cents`) oscillators routed through a breathing lowpass (`540–960 Hz`).
3. **Built-In `-4.5 dB @ 1250 Hz` Vocal-Formant Carve**: leaves a clean pocket in the human speech intelligibility band (`800 Hz – 2.5 kHz`) automatically!
4. **Soft Felt Kick (`112 → 45 Hz`, `6ms` attack)** + warm sine sub-bass.

---

## 3. Mixing Voiceover + Music Without Pumping (Spectral Carve + 2-Pass R128)

Broadband `sidechaincompress` with high ratios crushes sub-bass and highs every time the narrator speaks. Instead, duck gently in the vocal midrange (`300 Hz – 3 kHz`) and normalize linearly in 2 passes:

```bash
# 1. Mix VO + music bed with gentle midrange carve & sidechain ducking
ffmpeg -y -i video/vo.mp3 -i out/music.wav -filter_complex \
  "[1:a]volume=0.38,equalizer=f=1350:t=q:w=1.1:g=-5[bed]; \
   [bed][0:a]sidechaincompress=threshold=0.035:ratio=4:attack=8:release=280[duck]; \
   [0:a]highpass=f=80[vo]; \
   [vo][duck]amix=inputs=2:duration=first:normalize=0[out]" \
  -map "[out]" out/mixed.wav

# 2. Mux during render_frames.mjs (--audio out/mixed.wav), then master to exact -14 LUFS + BT.709
node <video-qa>/scripts/post.mjs out/raw.mp4 out/video.mp4 --matrix 709 --loud -14
```

Target levels: **Integrated `-14.0 ± 1.0 LUFS`**, **True Peak `≤ -1.5 dBTP`**, music bed `-18` to `-22 LUFS` under speech, SFX peaks `≤ -12 dBFS`.
