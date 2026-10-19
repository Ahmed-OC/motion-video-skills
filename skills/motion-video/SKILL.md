---
name: motion-video
description: >-
  Produce complete professional videos entirely in code — motion graphics, brand promos,
  story and explainer films, kinetic typography, lyric videos, showreels, intros/logo
  stings, 3D animations, and faceless Shorts/Reels/TikToks — rendered to MP4 with synced
  audio and word-level captions. Use whenever the user wants a video or animation made
  with code, motion design, an animated explainer, a beat-synced edit, caption/subtitle
  styling, a render to MP4/WebM, 3D animation via Blender, or when their AI-generated
  video looks flat, generic, or amateur.
---

# Motion Video — complete videos as code

Everything on screen is drawn by a program you control: deterministic frames, synthesized
or synced audio, word-level captions, MP4 output. Change one number in the timeline,
re-render, and only that changes. This skill encodes the production loop behind the best
code-video work in the wild (viral Opus showreels, $0.15 fully-generated stop-motion
explainers, one-prompt short films).

## The mindset

Never ask for "a video file". Build a system where **every frame is a pure function of
time** — `seek(t)` draws the exact frame at instant t — render frames headlessly, encode
with ffmpeg, then **look at your own render** on a contact sheet and fix what's wrong.
Determinism is what makes "change one thing" cheap, parallel rendering possible, and
re-renders trustworthy.

## Production loop — follow in order

Work in a project dir (default `video/`) so the sources (brief + timeline + code) are an
editable deliverable, as valuable as the MP4 itself.

### 1. INTAKE
Ask — or infer defaults if the user says "just go":
- Goal, audience, where it will be published → aspect ratio (16:9 / 9:16 / 1:1)
- Length (default 15s) and mood/references (a named style beats adjectives: "Swiss brutalist
  type" works better than "modern and clean")
- Sound: voiceover? Music provided or composed in code? BPM?
- Hard requirements: brand hex codes/fonts, exact on-screen words, claims that must appear.

### 2. BRIEF → `video/brief.md`
Read `references/motion-craft.md` first. One page, five sections:
- **IDEA** — one sentence, one visual device (e.g. "one unbroken line becomes every word")
- **BEATS** — a table, one row per 2 seconds: time | what happens | exact on-screen words | sound event
- **LOOK** — palette hex codes, typeface(s), texture/finish (flat, riso, grain, glow-free)
- **MOTION** — what moves, how fast, what leads what, where the holds are
- **SOUND** — declared BPM grid (e.g. 120), VO yes/no, SFX per action, or "no narration"

If the user supplied a reference video/image: extract frames, describe what you actually
see as LOOK rules — take the grammar, not the content.

### 3. TIMELINE → `video/timeline.json`
The single source of truth for visuals, audio, and captions — validated against
`assets/timeline.schema.json`. Every cue time lives here and nowhere else.

```json
{
  "fps": 30, "width": 1920, "height": 1080, "duration": 15, "bpm": 120,
  "palette": ["#0E0E0E", "#F5F2EA", "#FF4D00"],
  "fonts": { "display": "Archivo Black", "body": "Inter" },
  "audio": { "music": "synth", "vo": null },
  "scenes": [
    { "id": "hook",  "start": 0,  "duration": 2, "text": "MOTION, IN CODE" },
    { "id": "build", "start": 2,  "duration": 8, "text": "15 SECONDS AT 120 BPM" },
    { "id": "outro", "start": 10, "duration": 5, "text": "RENDER IT." }
  ],
  "captions": [ { "startMs": 0, "durationMs": 1800, "text": "MOTION, IN CODE" } ]
}
```

Frame math is explicit and derived from fps only: 15s × 30fps = 450 frames. Never animate
in milliseconds.

### 4. STYLE GATE — approve cheap artifacts before expensive ones
Render 2–4 full-size stills at key moments and show the user; get a yes on the look
BEFORE animating everything:

```
node scripts/render_frames.mjs --file video/index.html --still 1.0 --out out/style-1.png
```

Skip only if the user explicitly opted out of check-ins.

### 5. BUILD — pick the engine

| Intent | Engine | Read |
|---|---|---|
| Default: mograph, short films, kinetic type, faceless shorts | Vanilla canvas + `seek(t)` + this skill's renderer | engines.md §A |
| React codebase, data-viz heavy, embeddable web player, mass templating | Remotion + official skills | engines.md §B |
| HTML/CSS/GSAP preferred, Apache-2.0, built-in lint | HyperFrames | engines.md §C |
| Math / technical explainer (3Blue1Brown style) | Manim CE | engines.md §D |
| Photoreal 3D, camera moves, product scenes | Blender headless | engines.md §E |
| Cutting / assembling existing footage | ffmpeg | engines.md §F |

Always read the engine's section before writing code — it pins current APIs. LLM training
data drift (ManimGL↔CE, MoviePy v1↔v2, Anime.js v3↔v4) is the #1 source of dead code.

### 6. AUDIO
Read `references/audio.md`. Declare the BPM in the timeline (never "detect" tempo for music
you control — declared grids are deterministic; analyze only existing tracks). VO: `edge-tts`
is free and emits word-level timing. Compose music on the same beat grid as the visuals, or
duck a provided track under VO. Normalize to −14 LUFS.

### 7. RENDER

```
node scripts/render_frames.mjs --file video/index.html --out out/video.mp4
```

The renderer drives headless Chromium, seeks every frame, pipes to ffmpeg, and muxes audio
from `window.renderAudio()`. Requires `playwright` in the project and `ffmpeg` on PATH —
the script prints exact install commands if either is missing.

### 8. VERIFY — never ship unverified
Read `references/verify.md`. Minimum bar, every video:
1. `scripts/probe.sh out/video.mp4` — duration/fps/resolution/pix_fmt/audio/LUFS match the timeline.
2. `scripts/contact_sheet.sh out/video.mp4` — LOOK at the sheet, then watch the full video.
   Judge the render, not the code: builder ≠ judge.
3. Fix the 3 worst defects (with timestamps), re-render. Repeat until the rubric is ≥ 8/10.

### 9. DELIVER
`out/video.mp4` (H.264, yuv420p, +faststart), `out/poster.png` (frame at the hook),
`out/contact.png`, plus the `video/` sources (brief.md, timeline.json, code). Other aspect
ratios = recomposed layouts from the same timeline — never crops. Tell the user exactly
which file to edit to change one thing.

## The 10 non-negotiables

1. **Every frame is a pure function of t.** In render context there is no
   `requestAnimationFrame`, `setTimeout`, CSS transition/animation, `Date.now()`,
   wall-clock audio playback, or `Math.random()` (use a seeded RNG). This is what makes
   re-renders and partial fixes safe.
2. **One timeline.json.** Visuals, audio events, and captions all read the same cue times.
   Sync happens by construction, not by nudging.
3. **Never linear easing.** Springs or eased curves everywhere, clamped at both ends —
   linear interpolation reads robotic instantly.
4. **Entrances animate 2–3 properties together** (opacity + rise + scale), staggered 3–6
   frames between siblings; **exits ~30% faster than entrances**.
5. **Frame math explicit.** `durationInFrames = round(duration × fps)`; every offset an
   explicit number; on-screen text holds ≥ 1.4s (0.3s/word + 0.5s).
6. **Something meaningful changes every 2–4 seconds**; a real hook lands in the first 2.
7. **Anti-slop blacklist:** no centered gradient text, endless fades, random particles,
   glow abuse, glassmorphism, gratuitous UI frames. Replace with purposeful motion — see
   motion-craft.md for what to do instead.
8. **Audio stems stay separate** (VO / music / SFX). Duck music under VO; target −14 LUFS
   integrated, true peak −1.5 dBTP.
9. **Word-level captions** whenever there is speech (TTS timestamps or whisper): 1–3 words
   per pop, keyword highlighted, inside safe zones.
10. **Render → look → fix → re-render.** If you haven't seen the frames, the video isn't done.

## Reading map

- Before writing the BRIEF or any motion code → `references/motion-craft.md`
- Engine setup, pinned APIs, render commands → `references/engines.md`
- Story videos, explainers, faceless shorts, lyric videos, data-viz → `references/story-pipelines.md`
- VO, music synth, SFX, beat grids, ducking, loudness → `references/audio.md`
- Checks, contact sheets, critic rubric, determinism tests → `references/verify.md`
- Canvas starter implementing the whole seek + audio contract → `assets/seek-template.html`
- Timeline format → `assets/timeline.schema.json`

Scripts (`scripts/`) are relative to this skill's directory and are meant to be run from
the video project's parent directory.

Standalone companions (optional, installable on their own): **`video-qa`** — audit,
contact-sheet and loudness-normalize ANY rendered video; **`tts-voiceover`** — generate a
voiceover with word-level timings and ready-to-use caption pages without a full video run.

## Hard-won facts from the field

- One-shot prompts produce flat videos. The structured brief + style gate + verification
  loop is what separates viral-quality output from default-looking renders — validated in
  blind tests (full brief beat the one-liner 5 of 6 times).
- Weaker models draw cruder: use the strongest model available for storyboarding, review,
  and the critic pass.
- 900 frames @1080p render in minutes, not hours. Long projects exhaust context — batch by
  scene, keep all data in one table, review via contact sheets (≈3–5k tokens) instead of
  raw frames.
- For companies >3 people, Remotion requires a paid license — HyperFrames (Apache-2.0) and
  the vanilla canvas route have no strings.
- The model can't see or hear. Every quality claim must come from a rendered artifact you
  actually inspected, or a programmatic check you actually ran.
