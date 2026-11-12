---
name: video-qa
description: >-
  Pre-render visual telemetry compiler (`audit_telemetry.mjs`, <2s) AND post-render QA/finishing
  gate for ANY video (`disco.mjs`, `post.mjs`, `probe.sh`, VLM-grounded `contact_sheet.sh`):
  catches Canvas NaNs, AABB overlaps (with Minimum Separation Vector fixes), real pixel WCAG
  contrast (with exact hex fixes), 2026 9:16 social safe-zone intrusions, static freezes,
  frame-accurate cut drift, BT.709 color shift, and normalizes loudness to −14 LUFS (2-pass linear).
---

# Video QA v2.0 — Pre-Render Visual Compiler & Post-Render Release Gate

Shift quality left: catch geometric, contrast, `NaN`, and freeze bugs **in < 2 seconds before encoding MP4** (`audit_telemetry.mjs`), then verify the encoded stream (`probe.sh`, `disco.mjs`, `post.mjs`, VLM-grounded `contact_sheet.sh`).

---

## 0. Pre-Render Gate (For `seek(t)` HTML/Canvas/DOM Videos — ~1.8s)

```bash
node scripts/audit_telemetry.mjs --file video/index.html --timeline video/timeline.json --iteration 1
```
- Sweeps ~75 stratified timestamps in headless Chromium V8 memory (zero MP4 encode, zero disk PNGs).
- Auto-injects `motion-kit.js` telemetry (`CanvasRenderingContext2D` transform-projected AABBs + `NaN` trap + DOM/SVG `getBoundingClientRect` + `160×90` pixel contrast/motion buffer).
- Emits an objective `SCORE / 100`, `LOCKED CLEAN SCENES` (anti-regression guard for iterative small/fast models), and **exact numeric `FIX:` instructions** (pixel shift `+Δy`, accessible `#HEX`, safe-zone clamp, or camera drift). Exit `0` on pass (`>= 85`, `0` blockers), Exit `2` when iterative repair is required.

---

## 1. Stream Probe (`probe.sh`)

```bash
../motion-video/scripts/probe.sh video.mp4
```
Verify against spec: `duration ± 0.1s`, `fps`, `W×H`, `h264 / yuv420p`, `bt709` color tags, audio presence, and `−14 ± 1.5 LUFS`.

---

## 2. Temporal Discontinuity & Freeze Detector (`disco.mjs`)

```bash
node scripts/disco.mjs video.mp4 --cuts "3.0,6.5,10.0"     # hard-cut videos: every cut must be EXACT
node scripts/disco.mjs video.mp4 --no-strict               # whip/portal transition videos: check spikes & freezes
```
Audits consecutive grayscale frame diffs for:
1. **Cut accuracy** (`EXACT` vs `OFF-BY-±1` float rounding bug vs `NO-SPIKE`),
2. **Off-list spikes** (pops, mono-frame flashes, WebGL buffer glitches),
3. **Frozen runs** (`>= 1.0s` of near-zero motion where animation was expected).

---

## 3. Broadcast Mastering: 2-Pass Linear `loudnorm` + BT.709 Tag (`post.mjs`)

```bash
node scripts/post.mjs raw.mp4 final.mp4 --matrix 709 --loud -14
# Quiet WebAudio synth mix (~ -23 LUFS): pre-gain + transient limiter -> exact linear -14 LUFS
node scripts/post.mjs raw.mp4 final.mp4 --gain 8dB --limit 0.75 --matrix 709
```
Copies video losslessly (`-c:v copy`), tags H.264 VUI color matrix (`709` for `render_frames.mjs` v2 BT.709 streams, `601` for legacy untagged canvas encodes), applies pump-free 2-pass linear loudness normalization (`-14 LUFS`, `-1.5 dBTP`), and writes `+faststart`.

---

## 4. VLM-Grounded Contact Sheet & Rule of Evidence (`contact_sheet.sh`)

```bash
scripts/contact_sheet.sh final.mp4 out/contact.png 2 4x
```
- Burns exact frame index + PTS (`f0120 · 00:04.00`) onto every thumbnail **before** `fps=` sampling so human and VLM critics never miscalculate timestamps.
- Uses slate gutter `0x1e293b` instead of `#000000` so empty trailing grid cells are never misread as black end-frames.
- **Rule of Evidence**: Always confirm any suspected text clip or artifact on a full-resolution PNG (`ffmpeg -ss T -i final.mp4 -frames:v 1 crop.png`) before modifying scene code.
