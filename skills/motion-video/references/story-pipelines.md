# Story & pipelines — narrative structure, shot data, production recipes

## 1. The universal story spine (works at 6s and at 3min)

```
HOOK (0–2s)      the boldest frame + the promise. First words on screen by 0.5s.
PROMISE (2–5s)   what the viewer gets, stated visually
ESCALATION       3 beats, each bigger: size/speed/count of elements grows
PAYOFF           the IDEA pays off — the line completes, the counter lands, the reveal
CTA / LOOP (2s)  one action, held; or rhyme with frame 0 for a seamless loop
```

One device per video. Every scene should visibly derive from the previous one
("every scene is made out of the previous one" — the anti-collage rule).

## 2. Story → shots → data

Generate a shot list as typed JSON (LLM JSON mode; exactly N shots; each shot one sentence
of narration ≈ 5s ≈ 12–15 words). The `n` field lets you name files without trusting array
order after parallel work:

```json
{
  "title": "Why Zebrafish Heal Spines",
  "hook": "Your spine can't regrow. A fish's can.",
  "shots": [
    { "n": 1, "narration": "Human spinal cords scar instead of regrowing.",
      "visual": "silhouette, spine glows then scars over", "camera": "slow push-in", "duration": 5 },
    { "n": 2, "narration": "Zebrafish regrow a full spine in 8 weeks.",
      "visual": "fish silhouette, spine rebuilds segment by segment", "camera": "lateral dolly", "duration": 5 }
  ]
}
```

Then VO first, storyboard stills second, animation last — never animate before hearing the
VO timing, because narration paces everything.

## 3. Worked timeline example (20s promo, 9:16)

```json
{
  "fps": 30, "width": 1080, "height": 1920, "duration": 20, "bpm": 120,
  "palette": ["#0B0B0F", "#F5F2EA", "#FF4D00"],
  "fonts": { "display": "Archivo Black", "body": "Inter" },
  "audio": { "music": "synth", "vo": "vo.mp3", "sfx": ["whoosh@2.0", "impact@8.0"] },
  "scenes": [
    { "id": "hook",  "start": 0,  "duration": 2.5, "text": "POST 30 VIDEOS / A WEEK?", "device": "word-per-beat pops" },
    { "id": "pain",  "start": 2.5, "duration": 5,   "text": "EDITING EATS YOUR WEEK",  "device": "calendar grid fills red" },
    { "id": "turn",  "start": 7.5, "duration": 5,   "text": "OR IT RUNS ITSELF",       "device": "calendar clears, one cell glows" },
    { "id": "proof", "start": 12.5, "duration": 5,  "text": "TEMPLATES + TIMELINE.JSON", "device": "code types itself, video renders" },
    { "id": "cta",   "start": 17.5, "duration": 2.5, "text": "RENDER IT.",             "device": "hard cut, hold 2s" }
  ],
  "captions": [ { "startMs": 0, "durationMs": 1200, "text": "30 VIDEOS", "tokens": [ { "text": "30", "fromMs": 0, "toMs": 500 }, { "text": "VIDEOS", "fromMs": 500, "toMs": 1200 } ] } ]
}
```

Every number in this file is law: scene boundaries on downbeats (bar = 2s @120bpm), captions
carry word windows, SFX cue times are absolute.

## 4. Recipes

### R1 — Brand / promo motion graphics (default)
Brief → timeline → style gate → canvas build (engines.md §A) → synth music on the BPM grid
(audio.md §3) → render → verify. 15–30s. The recipe that produced the viral showreels.

### R2 — Explainer with voiceover
1. Script as shot-list JSON (§2 above), ~1 idea per shot.
2. VO first: `edge-tts` (free) or the best TTS available → `vo.mp3` + word timestamps.
3. Whisper the VO if the TTS didn't give timings → write `tokens[]` into timeline.captions.
4. Storyboard: render stills at each scene midpoint → user approval.
5. Build scenes paced to the words (each scene's key reveal lands on its keyword).
6. Music bed −18 to −22 LUFS under VO, sidechain-ducked (audio.md §4).
7. Captions drawn into the frames (not burned later) so they respect layout.
Hand-drawn look: rough.js-style jittered strokes, drawn captions, palette of 3 + paper
texture — the "chalkboard/whiteboard" explainer lane that benchmarks best.

### R3 — Kinetic typography / lyric video
- Beat grid mandatory. Word-per-beat at the drop; line-per-2-bars in verses.
- Load real word timings from the track's lyrics (whisper forced alignment) or TTS tokens.
- Patterns: per-char stagger, mask wipes, stroke-trace, one weight-morph at the bridge.
- Black or paper background, ONE accent color, ultra-heavy display type (motion-craft §7).

### R4 — Faceless short (9:16, ≤60s, monetization-grade)
- Hook = first 3 words on screen within 0.5s (before the VO even starts).
- Script JSON → edge-tts VO → whisper word times → captions 1–3 words/pop, Hormozi-style
  (bold caps, keyword color, pop scale) → B-roll = canvas visuals, generated clips, or
  stock (Pexels/Pixabay) with Ken Burns.
- Beat cuts (beat_grid.py on the music bed or declared BPM), loudnorm −14 LUFS.
- Landscapes: batch the same timeline with different text/data → 100 variants from one code
  base (this is the actual faceless-channel moat: template + data, not one-off edits).
- Cost reality: a 15s short ≈ $0.30 with paid clip models, ≈ $0 with canvas-only visuals.

### R5 — Data-viz animation
- Numbers as stars: roll-up counters (odometer digits), bar races with fixed axis snap,
  area charts that draw left-to-right with a tracking label.
- Format numbers humanly (12.4k not 12387), one unit per scene, axis ticks at nice steps.
- Data lives in timeline.json → the video is re-renderable when data changes (the killer
  feature vs After Effects).

### R6 — 3D product / scene (Blender)
engines.md §E. Storyboard stills first (render 4 key frames), then build.py. Primitives +
geometry nodes + PolyHaven materials; procedural camera moves (orbit, dolly) on the BPM
grid; Eevee previews every 30 min, Cycles only for the final.

### R7 — Multi-aspect delivery
Same timeline.json, three layouts: 16:9 (full grid), 9:16 (stacked/recomposed), 1:1
(centered crop of hierarchy, not pixels). Never scale-crop: elements re-flow to the frame.
Render each aspect separately; verify each on its own contact sheet.

## 5. Consistency across scenes (color script + characters)

- **Color script**: assign each scene a palette emphasis from the same 5 colors (progression
  dark→bright for uplifting, inverse for tension) — as a `palette` field per scene.
- **Characters (if any)**: build ONE reference sheet first (front/side/expressions) as code
  (HTML canvas or SVG) so every scene draws from the same source of truth; never re-describe
  the character in prose per scene. Condition every scene on the sheet, not on memory.
- **Style tokens**: fonts, spacing, stroke weights, easing set live in timeline.json /
  theme constants — one place, imported everywhere. No inline magic colors in scenes.
- For AI-generated imagery inside a code video: generate from the character sheet reference
  only; keep motion (camera, reveals, captions) in code — the code layer is what stays
  editable and deterministic.
