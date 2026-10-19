# Motion craft — grammar, timing, rhythm, typography, finishing, styles

Read this before writing the BRIEF and before writing any animation code. These rules come
from blind-tested prompt structures, pro motion-designer workflows, and the patterns shared
by every viral code-video in 2025–2026.

## 1. Timing — everything derives from fps

- All durations in frames: `frames = round(seconds × fps)`. Never milliseconds.
- Entrance animations: 8–15 frames (0.3–0.5s @30fps). Big hero type can take 20.
- Exits ~30% faster than entrances (viewers read exits as "done", don't linger).
- On-screen text: `hold ≥ 0.3s/word + 0.5s`, minimum 1.4s. Verify programmatically before
  render (see verify.md).
- Stagger siblings by 3–6 frames — the single cheapest "designed" feel.
- Something meaningful must visually evolve every 2–4 seconds or it reads as a slideshow.

## 2. Motion grammar (the 6 rules)

1. **Entrances move 2–3 properties together**: opacity 0→1 + translateY +40→0px + scale
   0.96→1. One-property animations read as broken.
2. **Springs for anything interactive/lively, eased curves for anything mechanical.** Never
   linear. Clamp at both ends.
3. **Stagger**: siblings enter offset by 3–6 frames, ordered by visual importance.
4. **Idle "breathing"**: held elements keep a ±0.5–1% sin(t × 0.5–1Hz) scale/position wobble
   so frames never look frozen.
5. **Handoffs**: element A exits as B enters (overlap 5–10 frames) — motion flows through
   the frame instead of resetting.
6. **Hard cuts are the default transition.** Reserve special transitions (wipe, glitch,
   zoom-blur) for 2–3 key moments maximum. Unify: one transition type per video.

### Spring presets (closed-form, seek-safe — evaluate from elapsed time, no simulation)

```js
// Underdamped spring step response: s(t) = 1 - e^(-ζω₀t)·(cos(ω_d t) + (ζω₀/ω_d)·sin(ω_d t))
function spring(t, f0, zeta) {
  const w0 = 2 * Math.PI * f0, wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
}
const SPRINGS = {
  ui:      (t) => spring(t, 3.2, 0.55),  // snappy UI elements, slight overshoot
  bigType: (t) => spring(t, 2.6, 0.9),   // hero typography, no visible bounce
  decor:   (t) => spring(t, 1.2, 0.7),   // slow background/decor drift
  soft:    (t) => spring(t, 2.5, 1.0),   // critically damped, zero overshoot (cursors, cameras)
};
```
Remotion equivalents: `spring({ frame, fps, config: { stiffness: 24, damping: 0.62 } })`-family;
GSAP: `"back.out(1.7)"`, `"expo.out"`. After evaluating, clamp to exactly 1 once the
oscillation is sub-pixel — and add a new spring on target *change* rather than restarting
one mid-flight (avoids velocity jerk).

### Easing cheat sheet (cubic-bezier)
| Feel | bezier | Use |
|---|---|---|
| expo.out | (0.16, 1, 0.3, 1) | entrances arriving "fast then settle" — default |
| back.out | (0.34, 1.56, 0.64, 1) | pops, badges, stickers |
| cubic.in-out | (0.65, 0, 0.35, 1) | camera moves, scene-wide moves |
| quad.in | (0.5, 0, 1, 0.6) | gravity/falls |
| bounce.out | — | physical drops only, sparingly |

Per-scene mixes work well: `quad.in` for falling objects, `back.out` for tags, `cubic.in-out`
for the camera.

## 3. Rhythm — the BPM grid (the Japanese-school secret weapon)

- **Declare a BPM** (120 default; 128 for club energy) in timeline.json. One beat =
  60/bpm seconds. One bar = 4 beats. 15s @120BPM = exactly 8 bars.
- Every visual event lands on the grid: "word appears on beat 3", "cut on the downbeat of
  bar 5". Music and visuals read the same grid → sync by construction.
- At the hook: a visible event every beat (or half-beat). During verses: every 2 beats.
- Cut lengths in **bars, not seconds** (1 bar @136BPM = 1.76s) — music never drifts from cuts.
- The drop: 0.1s of *complete silence* right before it — the gap makes the hit.
- Only analyze existing tracks for their BPM (scripts/beat_grid.py); for music you generate,
  generate it ON the grid instead (audio.md).

## 4. Typography & captions

- 1080p minimums: body ≥ 36px, captions 42–64px, hero display 120–220px. Phone-first
  (9:16): assume 60% of viewers at 1/3 scale.
- Max 2–5 words per text block; 6–8 blocks per 30s tells a complete story without sound.
- Kinetic patterns (pick ONE per video, execute precisely):
  word-by-word pop (each word springs on its beat) · per-char stagger 1–2 frames ·
  mask wipe reveal (clip rect sweeps) · stroke-trace (line-draw then fill) ·
  number roll-up (odometer for counters) · weight-morph (variable font 300→800).
- Captions (speech present): word-level timing (TTS timestamps or whisper), 1–3 words per
  pop, bold caps, keyword in accent color with a 5% scale pop, black stroke/shadow ≥ 4px.
- Safe zones: 9:16 keep text within the center ~78%; avoid the bottom 420px (UI) and top
  250px at 1080×1920. 16:9 broadcast: keep 5% edge margin.
- CJK (Chinese/Japanese/Korean): load Noto Sans SC/JP explicitly, `text-align: justify` for
  body paragraphs, animate per-character (each glyph is a word-sized unit); use `ch`-based
  widths for typewriter effects.

## 5. Finishing — the 5-layer stack (what makes renders look "designed")

```
1. Background: flat color or subtle animated mesh — never a random gradient
2. Assets: images/video/shapes with real motion (Ken Burns on stills: 1.03× zoom + drift)
3. Type: hierarchy of 2 sizes max per scene, tracked tight on display, loose on body
4. Grade: one global color pass (palette-tinted overlay at 5–10% or duotone)
5. Grain + vignette: film grain 2–4% opacity, vignette 10–15% — kills the "flat AI" look
```

Motion blur: multi-sample each frame — draw N=4–10 sub-frames at t±k·(1/fps)/N and average
(canvas), or `ffmpeg -vf tmix=frames=4` on the frame sequence. Two sub-frames causes
doubling; 4+ reads as real camera shutter (180°).

Style-specific extras:
- Glitch: RGB channel separation + horizontal slice offsets for 2–4 frames, on the beat.
- Cut-paper stop-motion: "shoot on twos" (12fps steps at 30fps render) + seeded edge wobble
  (`wobble()` with a fixed seed per shape, ±1–2px) — the $0.15-Docker-film look.
- Boiling lines: re-jitter line points every 2 frames (fixed seed sequence).
- Tech/terminal: monospace, corner timecodes (invert colors behind them for readability),
  scanline overlay at 6%.

## 6. Scene structure

- Scenes 3–6s each; a 30s video = 6–7 scenes. Story arc: hook (0–2s) → promise →
  3 escalating beats → payoff → CTA (holds 2s).
- Loop trick for social: make the last frame visually rhyme with the first (or the same
  frame) so auto-replay feels intentional. A seamless loop must match position, velocity,
  AND text state — `t % duration` alone is not enough.
- One video = one IDEA. If you can't state the device in a sentence, cut scope.

## 7. Style presets (palette + type + motion + sound, one-liners to expand)

| Style | Palette start | Type | Motion signature | Sound |
|---|---|---|---|---|
| Swiss brutalist type | #0E0E0E #F5F2EA #FF4D00 | Archivo Black / Helvetica | hard cuts, grid-snapping type, no effects | clicky SFX on cuts |
| Riso print pop | #FF5F38 #00A3A1 #F7EDE2 on cream | Grotesk + serif mix | offset-print misregistration 2–3px, grain heavy | tape-stop accents |
| Cut-paper stop-motion | torn paper whites + 2 inks | hand-cut letters | shoot-on-twos, seeded wobble, drop shadows | foley thuds, room tone |
| Neon terminal | #050505 #33FF66 #F5F5F5 | JetBrains Mono / IBM Plex Mono | typewriter + scanlines + timecode corners | keyclacks, modem SFX |
| Flat brand vector | brand 60/30/10 rule | brand grotesk | shape-morphs (equal-point paths), wipes | marimba/pluck SFX |
| B/W beat typography | #000 #FFF one accent | ultra-heavy display | word-per-beat, frame-shaking on drops | synthesized kick/hat |
| Isometric product | pastel ground + 2 accents | geometric sans | isometric grid builds piece-by-piece | soft ticks, whoosh |
| Ink / ukiyo-e | sumi #1A1A1A, washi #F2ECDF, indigo | brush + mincho | ink-bleed reveals (radial alpha noise, seeded) | koto/wind, water drops |

When the user gives reference images: extract palette (dominant 3–5 hex), estimate line
weight and texture, name the closest preset, then diff — "like riso but 2 colors and no grain".

## 8. Anti-slop blacklist → replacements

| Never (default AI look) | Instead |
|---|---|
| Centered text over a purple-blue gradient | Off-grid type over flat color or 5% animated mesh, one accent |
| Endless crossfades between scenes | Hard cuts on the beat grid |
| Random floating particles with no meaning | Particles = data or motion trail of a real element |
| Glow on everything | Glow on ONE focal element, max 1 scene |
| Glassmorphism cards | Flat cards with real shadows and 1px borders |
| Fake UI browser frames around everything | Redraw the actual UI at native size, cropped honestly |
| Linear-eased everything | Springs + expo/back easings, staggered |
| Everything moving at once | One lead element, supports follow with stagger |
