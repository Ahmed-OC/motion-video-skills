# Storytelling, Documentary & Cinematic Worlds

A story or documentary is **not** an infographic with paragraphs. Stories run on **tension, human scale, archival evidence, changing light, breathing room, and emotional release**.

---

## 1. Narrative Dramaturgy (Beyond SaaS Promo Structure)

Choose the dramatic structure that fits the story:

1. **The Investigation / Documentary Spine (*Vox, Johnny Harris, NYT Visual Investigations*)**:
   - **Scene 1 — The Anomaly / Mystery**: A striking archival photograph or map detail (`MVS.drawImagePlate`, `full-bleed`) + one intriguing question in `Newsreader` italic.
   - **Scene 2 — The Historical / Physical Evidence**: Warm museum paper table (`documentary-vox` `#F3EFE6`) with an angled archival print (`style: 'archival-plate', tiltDeg: -1.4, caption: 'ARCHIVE · 1903'`), editorial explanation, and a live `MVS.drawHighlighter` sweep over the decisive phrase.
   - **Scene 3 — The Scale / Turning Point**: Camera polarity flips (`split-rl` or `full-bleed` contrast shift to dark obsidian `#090807`) revealing the macro consequence (map trajectory, dramatic quote, or scale contrast).
   - **Scene 4 — The Human Resonance (`monumental-payoff`)**: Return to stillness, wide cinema horizon, lingering final line + musical resolution.

2. **The Cinematic Trailer / Manifesto Spine (*A24, Apple, Prestige Brand*)**:
   - **Cold Open (`0–3.5s`)**: Atmospheric visual plate emerging from shadow (`cinema-a24`), sparse `Space Mono` date/location stamp (`0.18em` tracking), zero clutter.
   - **Rising Pulse (`3.5–11s`)**: Hard rhythmic `'cut'` or `'portal'` match-cut into **Signature Gesture** (e.g. `knockout-type` giant word filled with moving imagery, or chiaroscuro portrait with warm tungsten halation).
   - **The Breath & Climax (`11–15s`)**: `0.4s` sonic J-cut swell into a `2.39:1` widescreen payoff frame — single unforgettable line centered in `Cormorant Garamond` italic.

---

## 2. Multiplane 2.5D Staging (How Studios Create Depth from 2D Stills)

Never paste a flat JPEG onto a slide. Build **3 depth planes** inside `seek(t)`:
1. **Background Plane (`depthZ = -0.6`)**: Atmospheric dark/paper tone or softly blurred (`filter: 'blur(14px) brightness(0.45)'`) environment plate moving at `0.4×` camera speed (`MVS.withParallax`).
2. **Subject / Archival Midground (`depthZ = 0`)**: Sharp `MVS.drawImagePlate` with subtle exponential Ken Burns (`zoomFrom: 1.02, zoomTo: 1.10`) or museum mat border (`style: 'archival-plate'`).
3. **Editorial Foreground & Optics (`depthZ = +0.5`)**: Frameless display serif typography + live `MVS.drawHighlighter` or subtle dust motes (`MVS.idleNoise`), sealed under unified `optics: { letterbox: '2.39:1', grain: 0.042, vignette: 0.36 }`.

---

## 3. Emotional Color Script (`scene.palette` Progression)

In cinema (*Pixar, Fincher, Villeneuve*), color tracks emotion across scenes. Override `palette` per scene in `timeline.json` (`MVS.renderTimeline` applies it automatically):

```json
"scenes": [
  {
    "id": "act1_origin",
    "start": 0, "duration": 4,
    "palette": { "bg": "#14100C", "fg": "#F3EDE2", "accent": "#D4A359", "muted": "#A89B89" }
  },
  {
    "id": "act2_archive_evidence",
    "start": 4, "duration": 4,
    "palette": { "bg": "#F3EFE6", "fg": "#171614", "accent": "#C2410C", "muted": "#57534E" }
  },
  {
    "id": "act3_horizon",
    "start": 8, "duration": 4,
    "palette": { "bg": "#07090E", "fg": "#F8FAFC", "accent": "#EAB308", "muted": "#94A3B8" }
  }
]
```
Notice the deliberate **Dark Chiaroscuro → Warm Archival Paper → Deep Orbital Night** journey: each cut feels like turning a chapter in a real film, never repeating the same wallpaper!

---

## 4. Sound Dramaturgy for Stories (`MVS.synthCinemaScore` + Voiceover)

- Match score mood to the world:
  - `MVS.synthCinemaScore({ mood: 'cinema-strings', bpm: 76, duration, cues: [4, 8, 12], jCutSec: 0.38 })` — bowed cello/viola fifths, deep contrabass, felt piano motif, and `0.38s` J-cut breath swells leading each visual transition.
  - `MVS.synthCinemaScore({ mood: 'documentary-felt', bpm: 88, duration, cues })` — intimate warm felt-piano + room tone for investigative & historical stories.
  - `MVS.synthCinemaScore({ mood: 'minimal-luxury', bpm: 72, duration, cues })` — sparse glass harmonics + deep sub air for fashion/design/architecture.
- When narrated (`vo_gen.py`), let the voice breathe: leave `0.4–0.6s` of music-only air after a major revelation so the viewer absorbs what they just saw.
