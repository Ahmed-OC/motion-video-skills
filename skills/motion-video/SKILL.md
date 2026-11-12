---
name: motion-video
description: >-
  Produce complete studio-grade videos entirely in code across ALL genres (SaaS product launch,
  STEM/math explainer, data-viz & maps, 9:16 social shorts, kinetic typography / lyric / Moji-PV,
  2.5D isometric architecture, code/terminal demos, 3D/WebGL shaders, documentary collage) and
  ALL model tiers — Frontier models AND smaller/faster models (via the MotionKit auto-layout SDK
  + sub-2s `audit_telemetry.mjs` visual compiler loop). Use whenever the user wants a video or
  animation made with code, motion design, an animated explainer, a beat-synced edit, synced
  captions, 3D/shader motion, or when an AI-generated video looks flat, empty, or amateur.
---

# Motion Video v2.0 — Universal Studio Video-as-Code

Everything on screen is drawn by a deterministic program you control: **every frame is a pure function of time `t` (`window.seek(t)`)**, rendered headlessly via parallel Chromium workers to **BT.709** H.264 MP4 with **−14 LUFS** broadcast-normalized stems and word-accurate captions.

The goal is not "zero iterations" — it is that **mechanical defects** (AABB overlaps, off-frame text, `NaN`-vanished elements, low WCAG contrast, frozen holds, duplicate captions, BT.601 color shift) are **eliminated automatically in < 2 seconds by the telemetry compiler** before a human or VLM ever watches, so iterations are spent purely on **taste and storytelling**.

---

## 0. Model-Tier Adaptive Protocol (Frontier vs Small/Fast Models)

Benchmarks (`SGA arXiv:2607.18116`, `AutoPresent`, `SpatialGrammar`, `RubSE`) prove that smaller/faster models (`gemini-3.8-flash`, `gemini-2.5-flash`, `Haiku`, `DeepSeek-Flash`, `Qwen-Coder`) fail when computing raw `(x, y)` coordinates in one pass — **but reach Frontier studio parity when pairing a collision-free layout SDK with 2–5 deterministic telemetry compiler passes**.

| Track | Target Models / Use Case | Mandatory Execution Rules |
|---|---|---|
| **Track S — Scaffolded Iterative Loop** *(Mandatory for Flash / Lite / ≤32B models, recommended for any multi-scene explainer/promo)* | Fast/small models, data-heavy layouts, zero-overlap guarantee | 1. **Black-Box SDK Law (Save Turns & Context)**: **NEVER `read_file` `motion-kit.js`, `audit_telemetry.mjs`, or `render_frames.mjs`**! Read ONLY `references/small-model-loop.md` + `assets/seek-template.html`, then immediately write `timeline.json` and `index.html`.<br>2. Copy `assets/motion-kit.js` (`window.MVS`) next to `video/index.html` (`<script src="./motion-kit.js"></script>`).<br>3. Isolate **1 function per scene** inside `const SCENES = { ... }` (`assets/seek-template.html`).<br>4. **Never hand-calculate `(x, y)` or guess font sizes**: split `safe` with `MVS.vstack` / `hstack` / `bentoGrid` and render text with `MVS.drawTextAutoFit`.<br>5. Run **2–5 passes** of `node ../video-qa/scripts/audit_telemetry.mjs --file video/index.html` (~1.8s/pass), patching ONLY failing scenes while keeping `LOCKED CLEAN SCENES` untouched (`references/small-model-loop.md`). |
| **Track F — Bespoke Frontier Studio** *(Opus / GPT-5 / Gemini Pro+ on custom art, shaders, 3D, continuous worlds)* | Custom WebGL2 shaders, Three.js PBR, bespoke SVG/Rough.js rigs, *PaperClip* continuous camera | Combine bespoke Canvas/SVG/WebGL2/Three.js/ManimGX craft (`references/motion-craft.md`, `references/genre-blueprints.md`) with `MVS` springs/OKLCH/preloaders, and pass `audit_telemetry.mjs` + `stills.mjs --determinism` before encoding MP4. |

---

## 1. Universal Genre & Engine Router (10 Video Families)

Never default to floating white words on a flat `#000000` canvas. Pick the visual architecture matching the topic (`references/genre-blueprints.md`):

| Genre | Visual Anchor & Signature Grammar | Engine & Assets |
|---|---|---|
| **1. SaaS / UI Product Launch** | Elevated surface cards (`1px` zenith border), spring cursor + click ripple, live metric scrub | HTML/Canvas + `MVS` (`linear-dark` / `apple-keynote`) |
| **2. Tech / System Architecture** | **2.5D exploded isometric stack** (`MVS.drawIsometricStack`) + **luminous Bézier flow beams** (`MVS.drawFlowBeam`) | Canvas + `MVS` + `fetch_assets.mjs --icon / --logo` |
| **3. STEM / Math / Science** | Publication math (**KaTeX** `\htmlClass` or **Typst → SVG**), seeded **Rough.js** diagrams, OKLCH area fills | HTML+KaTeX+SVG or **ManimGX / JAnim** (`engines.md` §D) |
| **4. Data-Viz & Geopolitics** | Single-driver scrub area/bar charts (`MVS.drawAreaChart`, `drawBarChart`), orthographic globe (`MVS.drawGlobeWire` or **D3 + Natural Earth**) | Canvas + `MVS` + `fetch_assets.mjs --world-map` |
| **5. 9:16 Social Short (TikTok/Reels)** | **Heroic Frame-0** (hook visible at `t=0.0s`, zero black fade-in), L-shaped 2026 Safe-Zone, smart word-pop captions | Canvas (`?ar=9:16`) + `vo_gen.py --scenes-json` |
| **6. Kinetic Type / Lyric / Moji-PV** | 7:2:1 hierarchy, orthogonal `90°` *Kire* cuts (`MVS.EASE.kireOut`), beat-grid downbeat cuts | Canvas/DOM + `beat_grid.py` (`motion-craft.md` §2) |
| **7. Code & CLI Walkthrough** | Token-level FLIP diffs (**Shiki Magic Move**) or glass code card (`MVS.drawCodeCard`, ≤6 lines @ 22px) + live output | Canvas `MVS.drawCodeCard` or `@shikijs/magic-move` |
| **8. Figurative / Story / Mascot** | Zero stick figures! Fetch recolored **unDraw** vector scenes, **DiceBear** CC0 characters (`open-peeps`), or 2-bone IK rigs | `fetch_assets.mjs --undraw / --avatar` (`visual-resources.md` §1.3) |
| **9. 3D / Abstract Shader Film** | Built-in WebGL2 shaders (`MVS.createShaderBackdrop`: Stripe mesh, gyroid aurora, `fwidth` grid) or **Three.js `RoomEnvironment`** PBR | WebGL2 / Three.js / Headless Blender (`engines.md` §E) |
| **10. Documentary / Continuous World** | *PaperClip (`回形针`)* giant `5760×3240` continuous pan canvas + white-sticker cutouts + Wikimedia CC0 photos | Canvas (`paperclip-cn` / `riso-editorial`) + `visual-resources.md` §3 |

---

## 2. Production Loop — Follow in Strict Order

Work inside a project folder (default `video/`) so `brief.md`, `timeline.json`, `index.html`, and `assets/` remain editable deliverables alongside `out/video.mp4`.

1. **INTAKE & BRIEF (`video/brief.md`)** — Read `references/motion-craft.md` (and `references/small-model-loop.md` on Track S). Define **IDEA** (one visual device), **BEATS** (every 2–4s), **LOOK** (named theme or OKLCH hex palette + fonts), **MOTION** (spring/easing family + transitions), and **SOUND** (BPM + VO/synth plan).
2. **VOICEOVER & ASSETS FIRST (`video/timeline.json` + `video/assets/`)** — If narrated, run `tts-voiceover`'s `vo_gen.py --scenes-json` **before** animating so frame-quantized VO durations pace every scene! Fetch real icons, logos, illustrations, or world maps locally via `scripts/fetch_assets.mjs`. Validate `timeline.json` against `assets/timeline.schema.json`.
3. **BUILD MODULAR `seek(t)` (`video/index.html`)** — Copy `assets/motion-kit.js` into `video/`. Implement `SCENES[id]` functions consuming `timeline.json` (embedded or via `window.__TIMELINE__` — never rely on unguarded `fetch('timeline.json')` over `file://`).
4. **SHIFT-LEFT COMPILER & STYLE GATE (< 3 seconds)** — Run:
   ```bash
   node <video-qa>/scripts/audit_telemetry.mjs --file video/index.html --timeline video/timeline.json
   node <motion-video>/scripts/stills.mjs --file video/index.html --times 0.5,4.2,8.5 --determinism --out out/stills
   ```
   Iterate 2–5 times on any failing scene (**never editing `LOCKED CLEAN SCENES`**) until `SCORE >= 85`, `BLOCKERS == 0`, and fresh-page SHA-256 hashes are identical. Inspect key PNG stills visually!
5. **PARALLEL BT.709 RENDER (`out/raw.mp4`)** —
   ```bash
   node <motion-video>/scripts/render_frames.mjs --file video/index.html --out out/raw.mp4 [--audio video/vo.mp3] [--workers 4]
   ```
6. **MASTERING & RELEASE GATE (`out/video.mp4`)** —
   ```bash
   node <video-qa>/scripts/post.mjs out/raw.mp4 out/video.mp4 --matrix 709 --loud -14
   node <video-qa>/scripts/disco.mjs out/video.mp4 --cuts "4.0,9.0"
   <motion-video>/scripts/contact_sheet.sh out/video.mp4 out/contact.png 2 4x
   <motion-video>/scripts/probe.sh out/video.mp4
   ```
   Inspect the VLM-grounded contact sheet (with burned-in `f0000 · 00:00.00` timestamps and slate gutter) before delivering.

---

## 3. Master Cinematography, Montage & 12 Non-Negotiables

1. **Pure `f(t)` Determinism**: Zero `requestAnimationFrame`, `setTimeout`, CSS transitions, `Date.now()`, or unseeded `Math.random()` (use `MVS.mulberry32`).
2. **One `timeline.json` & Beat-Locked Cuts**: Scene boundaries (`frameIndex / fps`), cue times, `shot` topologies, `transition` modes, captions, and audio envelopes live in one schema. When `bpm` is set without VO override, snap scene cuts to the musical beat grid (`|t_cut - nearestBeat| <= 65ms`).
3. **Shot-Scale Variety & Eye-Trace Polarity (Walter Murch Law)**: Never repeat 3 identical Left-Right 50/50 split screens (`SHOT_POLARITY_MONOTONY`). Progress shot scales via `MVS.shotLayout(safe, preset)` across `'establishing-wide'` → `'split-lr'` → `'split-rl'` (reverse polarity!) → `'bento-command'` → `'macro-focus'` → `'monumental-payoff'`, and never repeat the same primary `scene.device` back-to-back.
4. **Motivated 8-Mode Montage Grammar**: Match every transition semantically to spatial intent (`TRANSITION_MONOTONY` blocks repetitive wipes):
   - `'cut'`: rhythmic beat-cut or same-axis match cut;
   - `'whip'` / `'whip-right'`: lateral topic shift (`whip-right` returns Eye-Trace R→L);
   - `'portal'` / `'zoom-out'`: diving *inside* a component (`portal`) vs pulling back to macro context (`zoom-out`);
   - `'push-up'`: sequential step/chapter elevation;
   - `'iris'` / `'dissolve'`: spotlight reveal (`iris`) or contemplative payoff (`dissolve`).
5. **3-Act Intra-Scene Evolution (`MVS.sceneActs`)**: Every scene ≥ 2.6s must evolve across 3 beats in time — **Act I (0–22%)** staggered entrance (`kicker → hero → visual`), **Act II (34–80%)** secondary revelation (`MVS.withCameraFocus` push onto detail, `MVS.drawCallout` leader-line badge, live chart scrub, or code typing), **Act III (84–100%)** pre-roll momentum into the cut.
6. **3-Regime Energy-Clamped Springs**: Never evaluate `sqrt(1 - ζ²)` at `ζ >= 1` (`NaN` silently deletes Canvas drawings) and never clamp `|pos - 1| < ε` mid-flight. Use `MVS.spring` / `MVS.springApple` + **Lead-Opacity Law** (`MVS.entrance`: opacity finishes in `45%` of transform duration).
7. **Kill Robotic `sin(t)` & Add Parallax**: Use container-level *Yoin* camera drift (`1.0 → 1.028` exponential zoom), multi-plane `MVS.withParallax(ctx, localT, depthZ, fn)`, and golden-ratio `MVS.idleNoise(t, index)`.
8. **5-Layer Depth, Quadrant Balance & OKLCH Color**: Backdrop + depth grid + balanced foreground anchor (never pack >85% of visual mass on one side) + optical typography (`tabular-nums` on digits) + HUD/vignette. Interpolate gradients in OKLCH (`MVS.oklch`, `MVS.mixOklch`).
9. **Element Lifecycle Calibration**: Every element earns its frames — caused entrance (`≥3f`), readable hold (`≥ 0.3s/word + 0.5s`; numbers settle `≥ 0.9s` before cut), readable transit velocity, purposeful faster exit (`~0.7×` entrance), and frame-exact cause → effect chaining.
10. **Smart Multilingual Typography & Captions**: Never use `ch` units on CJK (`ic`/`em` or `MVS.drawTextAutoFit`); `word-break: keep-all` on Korean; Kinsoku on Japanese; French elisions (`l'IA`) & `\u202F` spaces via `vo_gen.py`; auto-suppress captions duplicating hero titles.
11. **End-to-End BT.709 + −14 LUFS**: Encode and tag BT.709 (`render_frames.mjs` + `post.mjs --matrix 709 --loud -14`) so brand hues never shift to muddy BT.601.
12. **Measure Before Fixing (16-Gate Telemetry Compiler)**: Confirm every geometric, contrast, temporal, and montage issue via `audit_telemetry.mjs` (`< 2.5s`) before encoding MP4, and never edit `LOCKED CLEAN SCENES`.

---

## 4. Reading Map

- Small/fast model iterative compiler workflow & `MVS` cheat-card → `references/small-model-loop.md`
- Studio springs, *Kire/Yoin/Ma*, OKLCH color science & CJK rules → `references/motion-craft.md`
- Zero-key icons, logos, unDraw, DiceBear, world maps, KaTeX, Three.js & WebGL2 shaders → `references/visual-resources.md`
- Concrete architectures for all 10 video genres → `references/genre-blueprints.md`
- Engine guides (Canvas `seek(t)`, Remotion, HyperFrames, ManimGX + Typst, Blender) → `references/engines.md`
- Narrative spine, VO-first shot lists & recipes → `references/story-pipelines.md`
- Multi-engine TTS, Warm Studio WebAudio bed, Foley & spectral carving → `references/audio.md`
- Telemetry compiler, `stills.mjs`, `disco.mjs`, `post.mjs` & VLM critic protocol → `references/verify.md`
