# Engines v2.0 — Selection, Pinned APIs & Deterministic Render Commands

Pick ONE engine per project. Underneath all of them lies the same invariant:
**seekable frame-deterministic animation (`frame = f(t)`) → headless capture → BT.709 FFmpeg encode.**

## Decision Matrix

| Engine | Language | License | Best For | Avoid When |
|---|---|---|---|---|
| **Canvas / HTML / WebGL2 + `seek(t)` + `MVS`** *(Default)* | HTML/JS | MIT / Zero strings | 90% of videos: promos, SaaS UI, explainers, data-viz, 2.5D isometric, kinetic type, 9:16 shorts, WebGL2 shaders, Three.js `RoomEnvironment` | You need an interactive React `<Player>` embedded inside an existing Next.js app |
| **Remotion v4** | React/TS | Free ≤3-person orgs; paid above | React codebases, `<Player>` web embed, Lambda mass personalization | Org >3 people without a Remotion license |
| **HyperFrames** | HTML+CSS+GSAP | Apache-2.0 | DOM/GSAP multi-clip compositions (`paused: true` timelines) | Pure procedural Canvas/WebGL simulation |
| **Manim CE / ManimGX / JAnim + Typst** | Python / Rust | MIT | Deep 3Blue1Brown-style mathematical & algorithmic derivations | Product, brand, UI, or social videos |
| **Headless Blender (`bpy`)** | Python | GPL tool (output is yours) | Complex multi-object Cycles/Eevee 3D scenes & baked rigid-body physics | 2D/2.5D motion design (use Canvas + `MVS` or Three.js instead) |

---

## §A Canvas / HTML / WebGL2 + `motion-kit.js` (`window.MVS`) — Default Engine

 Benchmark data (`VibeVideoBench`, 2,151 agent runs) shows Browser 2D + deterministic `seek(t)` achieves the highest pass rate (**85–88%**) and visual score across all LLM tiers. Start from `assets/seek-template.html` + `assets/motion-kit.js`:

```js
window.VIDEO = { width: 1920, height: 1080, fps: 30, duration: 15 };
window.onReady = async () => { await document.fonts.ready; /* preload local SVGs */ };
window.seek = (t) => MVS.renderTimeline(ctx, TL, SCENES, t, { theme: 'linear-dark' });
window.renderAudio = () => MVS.synthStudioAudio({ bpm: 120, duration: 15, cues: [4, 9] });
```

### Critical Implementation Rules
1. **`file://` CORS Trap**: Never call bare `await fetch('timeline.json')` without guarding `location.protocol.startsWith('http')` or embedding `TL` directly (note: `render_frames.mjs` v2 also passes `--allow-file-access-from-files` to Chromium).
2. **Pre-decode all images/SVGs** inside `window.onReady()` via `await MVS.preloadImage(key, './assets/...')` before frame 0.
3. **Three.js / WebGL2**: Always pass `{ preserveDrawingBuffer: true }` when creating a WebGL context so `page.screenshot()` captures the drawn buffer instead of a cleared swapchain!
4. **Render Commands**:
   ```bash
   # Parallel multi-worker BT.709 H.264 render + external voiceover stem
   node <motion-video>/scripts/render_frames.mjs --file video/index.html --audio video/vo.mp3 --workers 4 --out out/raw.mp4
   # Add 4-subframe 180° shutter motion blur + 2x supersampling
   node <motion-video>/scripts/render_frames.mjs --file video/index.html --subframes 4 --scale 2 --out out/raw.mp4
   # Recompose 9:16 vertical layout from the same codebase
   node <motion-video>/scripts/render_frames.mjs --file video/index.html --query "ar=9:16" --out out/raw_9x16.mp4
   ```

---

## §B Remotion v4 (`remotion-dev/skills`)

```bash
npx create-video@latest my-video --blank
npx skills add remotion-dev/skills
cd my-video && npm i && npx remotion render src/index.ts Main out/video.mp4 --codec=h264
```
- Always clamp `interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })`.
- Use `<OffthreadVideo>` (never `<Video>`), `spring({ frame, fps, config: { damping: 200 } })` for clean UI settles, and `@remotion/captions` for word-highlighted subtitles.

---

## §C HyperFrames (`heygen-com/hyperframes`, Apache-2.0)

```bash
npx hyperframes init my-video && cd my-video
npx hyperframes lint && npx hyperframes render
```
- Build GSAP 3.13+ timelines (`SplitText`, `MorphSVG`, `Flip`, `CustomEase` are now **100% free**!) with `{ paused: true }` and seek via `tl.time(t)`.
- Size typography and margins in container query units (`cqw`) with `container-type: size` on the stage root so `720p → 4K` scales without layout drift.

---

## §D Mathematical Engines: Manim CE, ManimGX, JAnim & Typst

- **Manim Community Edition (`pip install manim`)**: Import `from manim import *` (**never** `from manimlib import *`). Call `self.add(m)` before transform animations.
- **Zero-LaTeX Fast Math via `Typst` (~30 MB, millisecond compile)**: Instead of installing 4 GB TeX Live for `MathTex`, compile equations with `typst compile --format svg eq.typ eq.svg` (or browser **KaTeX** in §A!).
- **Rust-Accelerated Next-Gen Engines (2026)**: **`ManimGX`** (`wgpu` + AgX tone mapping + `manimgx inspect` overlap detector, ~90× faster than ManimCE) and **`JAnim`** (Rust + native Typst CJK/math support).

---

## §E Headless Blender (`blender -b --factory-startup -P build.py`)

- Iterate with `'BLENDER_EEVEE_NEXT'` (`xvfb-run -a` on headless Linux), final pass with `'CYCLES'`.
- **Bake physics explicitly** (`bpy.ops.ptcache.bake_all(bake=True)`) before background rendering (`-b` never steps interactive physics!).
- Never write procedural character weight-painting from scratch; use PolyHaven CC0 `.blend` assets, parametric geometry nodes, or §A Three.js `RoomEnvironment`.

---

## §F FFmpeg Universal Backbone & Safety Laws

- **Never overwrite in-place** (`ffmpeg -i a.mp4 ... a.mp4` corrupts the file — benchmark post-mortems show in-place re-encodes + unconsumed `stderr` pipe deadlocks cause 75% of lost agent renders!).
- **Always convert & tag BT.709** when encoding RGB frames:
  `-vf "scale=in_color_matrix=bt709:out_color_matrix=bt709" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -pix_fmt yuv420p -movflags +faststart`.
