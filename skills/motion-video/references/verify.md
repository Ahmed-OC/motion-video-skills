# Verify v2.0 — Shift-Left Visual Compiler, Determinism Proof & Release Gates

The model cannot see or hear raw code. **Never ship unverified.**
Order of operations: **<2s Telemetry Compiler first** (catches 90% of layout/contrast/freeze/NaN bugs before encoding a single MP4 frame) → **Fresh-Page Determinism Stills** → **MP4 Render + `post.mjs`** → **`disco.mjs` Cut/Freeze Gate + VLM-Grounded Contact Sheet**.

---

## 0. Pre-Render Visual & Geometric Compiler (`audit_telemetry.mjs` — ~1.8s)

Before spending 30–90 seconds rendering an MP4, run `video-qa`'s headless Playwright visual compiler:

```bash
node <video-qa>/scripts/audit_telemetry.mjs --file video/index.html --timeline video/timeline.json --iteration 1
```

In a single in-memory V8 pass, it injects `motion-kit.js` (`window.__MVS_TELEMETRY__`) — capturing `MVS` primitives, raw `CanvasRenderingContext2D` text/shapes projected through `ctx.getTransform()`, and DOM/SVG `getBoundingClientRect()` boxes — plus `160×90` pixel thumbnails across ~75 stratified timestamps:

| Gate | What It Catches | Prescriptive Output |
|---|---|---|
| `NAN_CANVAS_CALL` | `NaN`/`Infinity` passed to `fillText`/`arc`/`lineTo` (which Canvas silently drops!) | Exact failing Canvas op + timestamp + `MVS.spring`/`clamp` fix |
| `OVERLAP_COLLISION` | Pairwise text/card AABB overlap (`IoMin > 4%`) | Exact **Minimum Separation Vector (`+Δy px`)** or `MVS.vstack` split |
| `SAFE_ZONE_INTRUSION` | Broadcast 16:9 margin breach or 2026 9:16 L-shaped social UI intrusion | Exact clamped `(x, y, maxW)` inside `MVS.computeSafeZone` |
| `LOW_CONTRAST` | Real pixel-ring WCAG contrast `< 4.3:1` (body) / `< 3.2:1` (display) | Solves and outputs **exact accessible `#HEX` color (`>= 5.5:1`)** |
| `BLANK_FRAME` / `SCENE_TOO_SPARSE` | Crash frame (`stdLuma < 2.2`) or empty "black void" (`occupancy < 4%`) | Prescribes concrete `MVS` visual anchor (chart, globe, 2.5D stack, card) |
| `STATIC_HOLD_FREEZE` | Scene hold `>= 2.2s` with zero pixel evolution | Prescribes `MVS.renderTimeline` *Yoin* camera drift or `MVS.idleNoise` |
| `DUPLICATE_CAPTION_TEXT` | Burned caption repeating the on-screen Hero Title (`>= 65%` token overlap) | `suppressCaptions: true` (or `MVS.drawCaptions` auto-dedup) |

**Anti-Regression Law (`LOCKED CLEAN SCENES`)**: Never modify scene functions marked `✓ CLEAN` while repairing failing scenes. Keep a `video/index.best.html` checkpoint whenever `SCORE` improves.

---

## 1. Full-Frame Scan & Fresh-Page Determinism Proof (`stills.mjs`)

```bash
node <motion-video>/scripts/stills.mjs --file video/index.html --scan
node <motion-video>/scripts/stills.mjs --file video/index.html --times 0.8,4.5,9.2 --determinism --out out/qa-stills
```
- `--scan` seeks **every single frame** `0..N-1` and traps any runtime error or `NaN` canvas call.
- `--determinism` renders each timestamp twice on **two completely fresh browser pages** (with dual-seek font/layout warm-up) and compares SHA-256 hashes byte-for-byte — exposing hidden wall-clock state, unseeded `Math.random()`, or frame-to-frame state accumulation.

---

## 2. Post-Render Stream Probe, Color & Loudness (`probe.sh` + `post.mjs`)

```bash
# 2-pass LINEAR EBU R128 normalization (-14 LUFS, -1.5 dBTP) + BT.709 VUI stream tag + faststart
node <video-qa>/scripts/post.mjs out/raw.mp4 out/video.mp4 --matrix 709 --loud -14
<motion-video>/scripts/probe.sh out/video.mp4
```

Verify every line of `probe.sh` against `timeline.json`:
- `duration` = `timeline.duration ± 0.08s`
- `fps` & `W×H` = exact match
- `codec / pix_fmt / color_space` = `h264 / yuv420p / bt709` (`render_frames.mjs` v2 converts RGB→YUV using `out_color_matrix=bt709` so `#FF4D00` and `#38BDF8` stay vibrant across QuickTime, Chrome, iOS, and TikTok)
- `integrated loudness` = `-14.0 ± 1.2 LUFS`

---

## 3. Temporal Discontinuity & Cut Audit (`disco.mjs`)

```bash
node <video-qa>/scripts/disco.mjs out/video.mp4 --cuts "4.0,9.0"
```
- **Hard cuts**: Every declared cut must land `EXACT` on `round(sec * fps)`. (`OFF-BY-±1` means floating-point scene boundary drift — quantize durations to `frames / fps`!).
- **Whip / Portal overlapping transitions**: When using `MVS.renderTimeline` continuous transitions, run `disco.mjs` without `--cuts` (or `--no-strict`) to confirm **zero unintended off-list spikes/flashes** and **zero unintended frozen runs**.

---

## 4. VLM-Grounded Contact Sheet & Fresh-Context Critic Pass

```bash
<motion-video>/scripts/contact_sheet.sh out/video.mp4 out/contact.png 2 4x
```
`contact_sheet.sh` v2.0 burns exact frame number + PTS timestamp (`f0120 · 00:04.00`) onto each tile **before** `fps=` sampling and fills trailing grid gutters in slate `0x1e293b` (never black `#000000`, eliminating false "black frame at end" VLM hallucinations!).

Inspect `out/contact.png` + 2–3 full-resolution PNG stills (`out/qa-stills/*.png`) against the 7-axis studio rubric (Hook, Readability, Motion Craft, Sync, Visual Richness/Depth, Sound, Element Lifecycle). Confirm any suspected visual defect on a full-res PNG before patching!
