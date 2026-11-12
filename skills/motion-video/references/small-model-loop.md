# Small-Model Parity Loop — Iterative Scaffolding & Visual Compiler Protocol

Academic and industrial benchmarks (`SGA arXiv:2607.18116`, `AutoPresent CVPR 2025`, `SpatialGrammar arXiv:2604.27555`, `RITL-DOC arXiv:2604.18364`, `RubSE arXiv:2608.24138`) demonstrate a decisive law:
> **A fast/small model (e.g. `gemini-3.8-flash`, `gemini-2.5-flash`, `DeepSeek-Flash`, `Qwen-Coder-7B..32B`) equipped with a collision-free layout SDK + a deterministic geometric compiler outperforms a raw Frontier model on visual layout, readability, and pacing.**

Follow this exact 4-rule protocol whenever running on a smaller/faster model (or whenever building multi-scene data/explainer videos rapidly).

> ### ⚡ Rule 0 — Black-Box SDK Law (Do NOT Read Engine Internals!)
> **NEVER call `read_file` on `motion-kit.js` (2,200 lines), `audit_telemetry.mjs`, or `render_frames.mjs`!** Reading engine internals wastes your context window and tool-turn budget. Treat `window.MVS` and `audit_telemetry.mjs` as black-box studio tools: **every exact function & parameter signature is right below in Rule 1**. Read ONLY this file + `assets/seek-template.html`, then immediately write `video/timeline.json` and `video/index.html`.

---

## Rule 1 — Never Compute Raw `(x, y)` Coordinates or Guess Font Sizes

Small models fail when doing mental 2D pixel arithmetic (`ctx.fillText(str, 420, 510)`). Instead, copy `assets/motion-kit.js` next to `index.html` (`<script src="./motion-kit.js"></script>`) and let `window.MVS` solve geometry deterministically:

### Complete `window.MVS` API Contract (Exact Parameter Names — No Need to Read Source)

```ts
type Rect = { x: number; y: number; w: number; h: number };
// Scene handler signature called by MVS.renderTimeline(ctx, TL, SCENES, t, { theme }):
// ({ ctx, t, localT, duration, progress, acts, width, height, safe, theme, scene }) => void
//   where acts = { progress, act1Enter, act2Focus, act3Exit, focusPulse }

MVS.getTheme(name)
// Tech/Design themes: 'linear-dark'|'swiss-brutalist'|'paperclip-cn'|'cyber-fui-jp'|'kurzgesagt-pop'|'riso-editorial'|'deep-ocean-atlas'|'apple-keynote'
// Cinema/Story/Luxury themes: 'cinema-a24'|'documentary-vox'|'luxury-editorial'|'warm-story'|'noir-chiaroscuro'|'sakura-anime'

// Typography & Offline Asset Bundle Preloaders (call inside `window.onReady = async () => { ... }`)
await MVS.loadGoogleFonts(pairingKey) // 'cinema-a24'|'documentary-vox'|'luxury-editorial'|'warm-story'|'swiss-poster'|'brutalist-syne'|'classic-literary'|'tech-precision'|'jp-mincho'|'kr-editorial'|'cn-humanist'
await MVS.preloadBundle() // decodes all HD photos/art/SVGs packed in `./assets/assets-bundle.js` (`fetch_assets.mjs --bundle`)!

// Cinema, Documentary, Multiplane 2.5D & Analog Optics (FOR NON-TECH FILMS — NO UI CARDS!)
MVS.drawImagePlate(ctx, assetKey, rect, {
  id?: string, theme, localT, progress /* 0..1 */,
  style?: 'full-bleed' | 'archival-plate' | 'editorial-frame' | 'knockout-type',
  scrim?: 'left' | 'right' | 'bottom' | 'cinema', scrimStrength?: 0.78, // readable frameless text without boxes!
  zoomFrom?: 1.02, zoomTo?: 1.11, panFromX?: -0.02, panToX?: 0.02,
  tiltDeg?: -1.4, caption?: 'ARCHIVE · 1903', // for 'archival-plate'
  text?: '1903', fontPx?: 220 // for 'knockout-type' hero photo-masked display letters!
})
MVS.drawHighlighter(ctx, rect, progress /* 0..1 */, color /* e.g. '#EAB308' */, { alpha?: 0.34 }) // Vox live ink marker!
MVS.applyCinemaOptics(ctx, width, height, t, { letterbox?: '2.39:1'|'1.85:1'|'none', grain?: 0.042, vignette?: 0.35, halation?: 0.06, paperTexture?: boolean })
// (Note: setting `"optics": { "letterbox": "2.39:1", "grain": 0.042, "vignette": 0.36 }` in timeline.json applies optics + adjusts `safe` automatically!)

MVS.synthCinemaScore({ mood: 'cinema-strings'|'documentary-felt'|'minimal-luxury'|'tech-pulse', bpm?: 76, duration: number, cues?: number[], jCutSec?: 0.38 })

// Master Cinematographic Shot Topologies (USE THESE — NEVER repeat 'split-lr' 3 scenes in a row!)
MVS.shotLayout(safe, preset)
//   'establishing-wide' -> { kicker, header, heroVisual, lowerThird, primary, visual }
//   'split-lr'          -> { primary /* left 42% */, visual /* right 58% */ }
//   'split-rl'          -> { visual /* left 58% */, primary /* right 42% */ }  <-- alternates Eye-Trace!
//   'bento-command'     -> { header, kpiTop, kpiBottom, heroChart, primary, visual }
//   'macro-focus'       -> { header, stage, footerStrip, footerCols /* Rect[3] */, primary, visual }
//   'monumental-payoff' -> { kicker, heroCenter, subCenter, badgeRow, primary, visual }

// Low-level Layout Splitters (return Rect[])
MVS.vstack(rect, weights /* e.g. [{ px: 90 }, 1] or [0.35, 0.65] */, gapPx = 24)
MVS.hstack(rect, weights /* e.g. [0.46, 0.54] */, gapPx = 32)
MVS.bentoGrid(rect, cols, rows, gapPx = 24) // returns flat Rect[cols * rows]
MVS.insetRect(rect, padPx)

// 3-Act Intra-Scene Camera Rig, Parallax & Spotlight Callout
MVS.sceneActs(localT, duration) // -> { progress, act1Enter, act2Focus /* ramps 34%..64% */, act3Exit, focusPulse }
MVS.withCameraFocus(ctx, width, height, targetRect, acts.act2Focus, maxZoom /* e.g. 1.14 */, () => { /* draw hero */ })
MVS.withParallax(ctx, localT, depthZ /* -1 bg, 0 mid, +1 fg */, () => { /* draw layer */ })
MVS.drawCallout(ctx, [anchorX, anchorY], badgeRect, { id, theme, localT, delay: 1.1, text: 'KEY DETAIL' })

// Backdrop, HUD & Cards
MVS.drawBackdrop(ctx, width, height, localT, { theme, variant: 'mesh-grid' | 'blueprint' })
MVS.drawHudOverlay(ctx, width, height, localT, { theme, tag: 'MVS // 01', frameRadius?: 0 })
MVS.drawCard(ctx, rect, { id, theme, localT, delay?: 0, dur?: 0.55, bounce?: 0.14, radius?: 22, accentBar?: 'left'|'top', accentColor?: string })

// Auto-Fit Typography (binary-searched font size, balanced lines, CJK-safe, WCAG telemetry)
MVS.drawTextAutoFit(ctx, text, rect, {
  id: string, role?: 'hero'|'title'|'subtitle'|'metric'|'body'|'label',
  align?: 'left'|'center'|'right', valign?: 'top'|'middle'|'bottom',
  color?: string, fontFamily?: string, weight?: number, maxLines?: number,
  localT?: number, entrance?: { delay?: number, dur?: number, rise?: number, bounce?: number },
  allowOverlapIds?: string[]
})

// Rich Visual Components (all accept Rect directly!)
MVS.drawGlobeWire(ctx, rect, localT, { id, theme, delay?: 0 })
MVS.drawMetricCard(ctx, rect, { id, theme, localT, delay?: 0, label, value: number, from?: 0, prefix?: '', suffix?: '', decimals?: 0, sublabel?: '', accentColor?: string })
MVS.drawAreaChart(ctx, rect, { id, theme, localT, delay?: 0.1, revealDur?: 1.4, title?: '', data: number[], labels?: [startLabel, endLabel], prefix?: '', suffix?: '', decimals?: 0, accentColor?: string })
MVS.drawBarChart(ctx, rect, { id, theme, localT, delay?: 0.1, title?: '', items: [{ label, value, color? }], suffix?: '', decimals?: 0 })
MVS.drawIsometricStack(ctx, rect, { id, theme, localT, delay?: 0.1, layers: [{ label, color }] })
MVS.drawFlowBeam(ctx, [x1, y1], [x2, y2], localT, { color?: string, arcLift?: -80, speed?: 0.85, packets?: 3, width?: 2.5 })
MVS.drawCodeCard(ctx, rect, { id, theme, localT, delay?: 0.08, filename?: 'app.ts', lines: string[], highlightLines?: number[] /* 0-indexed */, typing?: boolean })
MVS.drawActor(ctx, { id, x, y, scale?: 1, pose?: 'present'|'walk'|'stand'|'meditate', facing?: 1|-1, accentColor?: string, t: localT })

// 8-Mode Montage Router ('cut' | 'whip' | 'whip-right' | 'push-up' | 'portal' | 'zoom-out' | 'iris' | 'dissolve')
MVS.renderTimeline(ctx, TL, SCENES, t, { theme?: string, transition?: string, transitionDur?: 0.38 })
MVS.synthStudioAudio({ bpm?: 120, duration: number, cues?: number[], seed?: 42 }) // returns Promise<{ mime: 'wav', base64 }>
```

```js
// 1. Safe Stage & Curated Themes ('linear-dark', 'swiss-brutalist', 'paperclip-cn',
//    'cyber-fui-jp', 'kurzgesagt-pop', 'riso-editorial', 'deep-ocean-atlas', 'apple-keynote')
MVS.drawBackdrop(ctx, width, height, localT, { theme, variant: 'mesh-grid' }); // or 'blueprint'
MVS.drawHudOverlay(ctx, width, height, localT, { theme, tag: 'SCENE // 01' });

// 2. Collision-Free Layout Splitting (returns exact {x, y, w, h} sub-rectangles)
const [topBar, mainArea] = MVS.vstack(safe, [{ px: 84 }, 1], 24);
const [leftCol, rightCol] = MVS.hstack(mainArea, [0.46, 0.54], 32);
const cells = MVS.bentoGrid(mainArea, 2, 2, 24); // 4 non-overlapping cards

// 3. Binary-Searched Balanced Typography (NEVER overflows box, balances lines, CJK-safe)
MVS.drawTextAutoFit(ctx, '99% OF TRAFFIC RUNS UNDERSEA', topBar, {
  id: 's1_title', role: 'title', // 'hero' | 'title' | 'subtitle' | 'metric' | 'body' | 'label'
  color: theme.fg, fontFamily: theme.fontDisplay,
  localT, entrance: { delay: 0.06, dur: 0.48, bounce: 0.12 }
});

// 4. Rich Visual Anchors (Eliminates "black void" & "stick figure" programmer art)
MVS.drawGlobeWire(ctx, rightCol, localT, { id: 's1_globe', theme });
MVS.drawMetricCard(ctx, cells[0], {
  id: 'kpi_1', theme, localT, delay: 0.10,
  label: 'Active Cables', from: 0, value: 552, suffix: ' systems',
  sublabel: '1.4M km across ocean floors', accentColor: theme.accent
});
MVS.drawAreaChart(ctx, rightCol, {
  id: 'chart_bw', theme, localT, delay: 0.15,
  title: 'Transatlantic Capacity (Tbps)',
  data: [18, 45, 110, 260, 480, 890], labels: ['2014', '2026'], suffix: ' Tbps'
});
MVS.drawBarChart(ctx, rightCol, {
  id: 'chart_share', theme, localT, delay: 0.15, title: 'Global Intercontinental Share',
  items: [
    { label: 'Subsea Fiber', value: 99.1, color: theme.accent },
    { label: 'Satellite Links', value: 0.9, color: theme.muted }
  ], decimals: 1, suffix: '%'
});
MVS.drawIsometricStack(ctx, rightCol, {
  id: 'iso_cable', theme, localT, delay: 0.12,
  layers: [
    { label: 'Steel Armor Wire', color: '#475569' },
    { label: 'Copper Power Tube', color: '#F59E0B' },
    { label: 'Polyethylene Shield', color: '#0284C7' },
    { label: 'Glass Optical Core', color: '#38BDF8' }
  ]
});
MVS.drawFlowBeam(ctx, [x1, y1], [x2, y2], localT, { color: theme.accent, arcLift: -70 });
MVS.drawCodeCard(ctx, rightCol, {
  id: 'code_1', theme, localT, filename: 'router.ts',
  lines: ['const light = laser(1550e-9);', 'amplifyEDFA({ everyKm: 70 });'], highlightLines: [1]
});

// 5. Scene Router (Adds velocity-matched whip/portal cuts + Yoin camera drift + auto-dedup captions)
window.seek = (t) => MVS.renderTimeline(ctx, TL, SCENES, t, { theme: TL.meta.style });
window.renderAudio = () => MVS.synthStudioAudio({ bpm: TL.bpm, duration: TL.duration, cues: [4, 8, 12] });
```

---

## Rule 2 — Isolate Scenes for Zero-Regression Repair (`SCENES[id]`)

Never write a 400-line `if (t < 4) ... else if (t < 8) ...` monolith inside `seek(t)`. Put every scene inside its own named function in `const SCENES = { hook, mechanism, data, cta }`.
Why (`RubSE` Anti-Regression Law): When Scene 2 has an overlap or low-contrast warning, you edit **ONLY `SCENES.mechanism`** using targeted `patch`, leaving `SCENES.hook`, `SCENES.data`, and `SCENES.cta` 100% untouched.

---

## Rule 3 — Run the `<2s` Visual Telemetry Compiler Loop (2 to 5 Iterations)

Before encoding any MP4, run the deterministic visual compiler:

```bash
cp video/index.html video/index.best.html
node <video-qa>/scripts/audit_telemetry.mjs --file video/index.html --timeline video/timeline.json --iteration 1
```

`audit_telemetry.mjs` sweeps ~75 timestamps in memory in ~1.5–2.2 seconds and checks **7 objective gates**:
1. `NAN_CANVAS_CALL` — catches `NaN`/`Infinity` coordinates that silently vanish on Canvas.
2. `OVERLAP_COLLISION` — computes exact AABB intersection and gives the **exact pixel shift (`+Δy`)** or `MVS.vstack` fix.
3. `SAFE_ZONE_INTRUSION` / `DOM_TEXT_CLIPPED` — enforces 16:9 margins and 2026 9:16 TikTok/Reels/Shorts L-shaped UI safe zones.
4. `LOW_CONTRAST` — samples actual rendered pixels behind text and computes the **exact accessible `#HEX` replacement** (`>= 5.5:1` WCAG).
5. `BLANK_FRAME` / `SCENE_TOO_SPARSE` — flags empty "black void" frames (`occupancy < 4%`) and prescribes concrete visual anchors.
6. `STATIC_HOLD_FREEZE` — detects frozen holds (`>= 2.2s` without motion) and prescribes `MVS.renderTimeline` camera drift or `MVS.idleNoise`.
7. `DUPLICATE_CAPTION_TEXT` & `READING_TIME_SHORT` — prevents title/subtitle echo and enforces `>= 0.3s/word + 0.5s`.

### The Iterative Loop Algorithm (Max 4 Repair Passes)

```
Pass 1: Generate `timeline.json` + modular `video/index.html` using `MVS` -> run `audit_telemetry.mjs --iteration 1`.
Pass 2..4 (while VERDICT == REPAIR REQUIRED):
  - Read `🔒 LOCKED CLEAN SCENES` in compiler output -> DO NOT TOUCH those functions!
  - Apply the exact numeric/layout `FIX:` prescribed for each failing scene (max 3 fixes/scene).
  - Re-run `audit_telemetry.mjs --iteration K`.
  - Best-of-Trajectory Guard: if `SCORE` improved, `cp video/index.html video/index.best.html`;
    if `SCORE` regressed, restore `video/index.best.html` and apply a cleaner `MVS.vstack`/`hstack` split.
Pass Final: Once `SCORE >= 85` and `BLOCKERS == 0`, run `stills.mjs --determinism`, render MP4, and run `post.mjs` + `disco.mjs`.
```

---

## Rule 4 — Enhance With Real Zero-Key Vector Assets When Figurative

Whenever a topic mentions real brands, technology, geography, or people, run `fetch_assets.mjs` during Step 1 instead of drawing crude geometric approximations:

```bash
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --icon ph:globe-hemisphere-west-duotone,lucide:cpu,lucide:zap \
  --undraw server_cluster --accent "#38BDF8" \
  --world-map
```
Preload them inside `window.onReady()` via `await MVS.preloadImage('cluster', './assets/undraw-server-cluster.svg')` and draw cleanly with `ctx.drawImage(MVS.getAsset('cluster'), rect.x, rect.y, rect.w, rect.h)`.
