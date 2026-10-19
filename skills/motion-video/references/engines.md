# Engines — selection, pinned APIs, render commands

Pick ONE engine per project. The universal architecture underneath all of them:
**seekable frame-deterministic animation → headless Chrome (or Python) frame capture →
ffmpeg encode.**

## Decision matrix

| Engine | Language | License | Best for | Avoid when |
|---|---|---|---|---|
| Vanilla canvas + `seek(t)` | HTML/JS | none needed | Default. Mograph, short films, kinetic type, faceless shorts, zero-setup | You need an embeddable React player or 1000s of templated variants |
| Remotion | React/TS | Free ≤3-person companies, paid above | React shops, data-viz, `<Player>` embed, Lambda mass rendering | Quick one-off, or company >3 without a license |
| HyperFrames | HTML+CSS+GSAP | Apache-2.0 | Agent-first HTML pipeline, built-in lint, no React | You need Remotion's component ecosystem |
| Manim CE | Python | MIT | Math/algorithm explainers | Anything non-technical |
| Blender headless | Python (bpy) | GPL tool, your output is yours | Photoreal/product 3D, camera moves, grease pencil | 2D mograph (overkill), realistic humans (needs VRoid etc.) |

## §A Vanilla canvas (default engine)

Zero framework dependencies; LLMs write it most reliably; total determinism. Start from
`assets/seek-template.html` — it already implements the full contract:

```js
window.VIDEO = { width: 1920, height: 1080, fps: 30, duration: 15 };
window.seek = (t) => { /* paint the exact frame at time t (seconds). May return a Promise */ };
window.renderAudio = () => { /* optional: return { mime: 'wav', base64: '...' } */ };
```

Project layout:
```
video/
  index.html      // canvas + scene draw functions + seek() + renderAudio()
  timeline.json   // loaded by index.html (single source of truth)
out/              // rendered artifacts
```

Implementation rules:
- Seeded RNG only (mulberry32 in the template). Same seed → same film, every time.
- Before frame 0: `await document.fonts.load('700 100px "Archivo Black"')` (or embed fonts
  as base64 @font-face so renders never depend on network).
- Pre-decode all images (`await img.decode()`) during init, then draw from memory.
- Pixel-art styles: `ctx.imageSmoothingEnabled = false`.
- Multi-aspect: read `?ar=9:16` from the URL and recompose layouts (grid/margins from the
  timeline), never scale-crop. The renderer passes `--query` through.

Render (from the project parent dir):
```
node <skill>/scripts/render_frames.mjs --file video/index.html --out out/video.mp4
node <skill>/scripts/render_frames.mjs --file video/index.html --still 3.2 --out out/poster.png
node <skill>/scripts/render_frames.mjs --file video/index.html --scale 2 --out out/video.mp4   # 2× supersampling
```

## §B Remotion

```bash
npx create-video@latest my-video --blank    # React video project
npx skills add remotion-dev/skills          # official agent skills (best-practices, captions, docs…)
cd my-video && npm i && npx remotion studio # live preview while iterating
npx remotion render src/index.ts Main out/video.mp4 --codec=h264
```

License: free for individuals and companies ≤3 people; above that a paid seat/render plan
is required (remotion.dev/docs/license). For unrestricted use, prefer §A or §C.

Pinned core APIs (v4):
- `useCurrentFrame()`, `useVideoConfig()` (never `window.innerWidth`, never Date).
- `interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })`
  — the missing clamp is the classic LLM bug.
- `spring({ frame, fps, config: { damping, stiffness, mass } })`.
- `<Sequence from={30} durationInFrames={45}>` — every staged element needs an explicit
  `from`; "everything animates at once" means missing offsets.
- Footage: `<OffthreadVideo>` (not `<Video>`); audio: `<Audio src={staticFile('vo.mp3')} />`.
- Word captions: `@remotion/captions` → `createTikTokStyleCaptions()` gives pages with
  per-word `tokens[]` timing (TikTok/Hormozi effect).
- Duration: root composition `durationInFrames` must equal `round(duration × fps)` from the
  timeline — a mismatch means the video loops or truncates.
- `npx remotion render` already runs headless Chrome → ffmpeg internally; use
  `--codec=prores --prores-profile=4444` for alpha, `--frames=0-89` for partial re-renders.

Known LLM failure modes: text glued together (add `letterSpacing`, flex gaps, explicit
paddings), durationInFrames disagreeing with inner math, linear easing (use spring).

## §C HyperFrames (HeyGen, Apache-2.0)

```bash
npx hyperframes init my-video && cd my-video   # needs Node 22+, ffmpeg
npx hyperframes preview                        # live preview
npx hyperframes render                         # deterministic MP4
npx hyperframes lint && npx hyperframes doctor # catches agent mistakes before render
```

Composition = plain HTML: a stage with `data-composition-id`/`data-width`/`data-height`,
clips with `class="clip"` + `data-start` / `data-duration` / `data-track-index`.
Animations must be seekable: GSAP timelines built `paused: true` and registered on
`window.__timelines` (adapters exist for CSS keyframes, Lottie, Three.js, WAAPI).
Installable as a Claude plugin with 21 workflow skills (`/faceless-explainer`,
`/music-to-video`, `/embedded-captions`…).

## §D Manim CE (math animation)

```bash
pip install manim          # v0.22+, bundles PyAV — no separate ffmpeg needed
manim render scene.py MyScene -pql   # 480p15 quick preview, auto-open
manim render scene.py MyScene -qh    # 1080p60 final → media/videos/
```

Rules that kill the classic hallucinations:
- **Manim Community Edition only.** Never `from manimlib import *` (that's ManimGL —
  different API, the #1 source of dead code). Validate imports compile before promising output.
- `self.add(m)` every mobject **before** animating it; objects that were never added don't
  render (`self.play(Write(m))` adds implicitly, `m.animate.shift()` does not).
- Prefer explicit `self.play(...)` chains over updaters when determinism matters.
- One concept per Scene; keep scenes short (render/retry granularity).
- `MathTex` requires a LaTeX install; plain `Text` does not — prefer Text unless equations
  are the point.

## §E Blender (3D), headless-first

GUI/MCP control times out on long operations — the strongest pipelines write one Python
build script and run it headless:

```bash
blender -b --factory-startup -P build.py     # build + animate + render, no GUI
blender -b scene.blend -s 1 -e 250 -a        # render frame range of an existing file
xvfb-run -a blender -b scene.blend -a        # Eevee on headless Linux (needs a GL context)
```

`build.py` skeleton:
```python
import bpy, math
bpy.ops.object.delete()                          # empty scene (factory-startup keeps it clean)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam)
cam.location = (0, -8, 2); cam.rotation_euler = (1.3, 0, 0)
cube = bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1))
key = bpy.context.active_object
key.location = (0, 0, 1);    key.keyframe_insert("location", frame=1)
key.location = (2, 0, 3);    key.keyframe_insert("location", frame=60)
s = bpy.context.scene
s.render.engine = 'BLENDER_EEVEE_NEXT'           # iterate; 'CYCLES' for the final pass
s.frame_start, s.frame_end, s.render.fps = 1, 250, 30
s.render.resolution_x, s.render.resolution_y = 1920, 1080
s.render.filepath = '//frames/frame_####'; s.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(animation=True)
```

Field-tested rules:
- **Eevee to iterate, Cycles to finish.** Eevee is ~5–10× faster; Cycles for photoreal.
  Cut per-frame cost by disabling shadows on distant lights.
- **Physics in background mode needs explicit baking** before rendering:
  `bpy.ops.ptcache.bake_all(bake=True)` then save — `--background` never plays the timeline,
  and any parameter change invalidates the cache.
- **Never rig from scratch** (agent rigging/weight-painting consistently fails): primitives,
  geometry-generated assets, pre-rigged models, Mixamo animations.
- Assets: PolyHaven CC0 (import original `.blend`, not glTF — materials survive), Sketchfab
  free/CC. Humans are out of scope (would need VRoid/image-to-3D).
- Character motion built in code (procedural walk cycles with anti-foot-slide logic) is
  proven; mocap-free expressive acting is not.
- Expect and check for: clipping/overlap geometry, z-fighting, moiré on fine detail,
  floating characters. Verify with actual rendered stills, not viewport assumptions.
- If live GUI control is really needed: `ahujasid/mcp-for-blender` (socket addon, `look`
  tool for visual verification) or the official Blender 5.1+ MCP server — run LLM-generated
  code in a VM/dedicated machine; the official sandbox is honestly named `weak_sandbox.py`.
- Frames → MP4: the ffmpeg backbone below.

## §F ffmpeg — assembly & the universal backbone

Editing existing footage:
```bash
# Concat same-codec clips (list.txt: file 'a.mp4' / file 'b.mp4')
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4
# Trim without re-encode
ffmpeg -ss 00:00:05 -to 00:00:12 -i in.mp4 -c copy clip.mp4
# Crossfade (needs re-encode)
ffmpeg -i a.mp4 -i b.mp4 -filter_complex "xfade=transition=fade:duration=0.5:offset=4.5" out.mp4
# Burn subtitles
ffmpeg -i in.mp4 -vf "subtitles=subs.srt:force_style='FontName=Archivo Black,FontSize=22'" out.mp4
# Speed change
ffmpeg -i in.mp4 -filter:v "setpts=0.5*PTS" -filter:a "atempo=2.0" out.mp4
```

Frame pipeline backbone (used by every engine above):
```bash
# PNG sequence → MP4 (yuv420p is required for player compatibility)
ffmpeg -framerate 30 -i frames/frame_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 out.mp4
# Alpha/transparent overlay → ProRes 4444
ffmpeg -framerate 30 -i frames/frame_%04d.png -c:v prores_ks -profile:v 4444 out.mov
# WebM/VP9 · GIF (two-pass palette)
ffmpeg -framerate 30 -i frames/frame_%04d.png -c:v libvpx-vp9 -b:v 0 -crf 31 out.webm
ffmpeg -framerate 30 -i frames/frame_%04d.png -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" out.gif
# Frames + audio in one pass
ffmpeg -framerate 30 -i frames/frame_%04d.png -i audio.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest out.mp4
# Explode a video into frames (for VFX/overlay workflows) · motion blur from still frames
ffmpeg -i in.mp4 -vf fps=30 frames/frame_%04d.png
ffmpeg -framerate 30 -i frames/frame_%04d.png -vf tmix=frames=4 -c:v libx264 -pix_fmt yuv420p out.mp4
```

## Version traps (LLM training-data drift)

| Tool | Trap | Correct move |
|---|---|---|
| Manim | ManimGL API (manimlib, `.animate` chains, `Scene.construct` differences) | Manim **CE** only: `pip install manim`, `from manim import *` |
| MoviePy | v1 API (docs everywhere) vs v2 rewrite | Use v2 (`clip.with_start`, not `set_start`); or plain ffmpeg |
| Anime.js | v3 global `anime({...})` | v4 named imports: `import { animate, createTimeline } from 'animejs'` |
| Motion Canvas | Dormant since Dec 2024, GUI-only render | Use its fork **Revideo** (`renderVideo()`) if you want that API |
| Theatre.js | Dormant since 2023 | Don't adopt |
| ffmpeg-python | Abandoned since 2019 | `python-ffmpeg` or subprocess |
| GSAP | Was paid, now 100% free (3.13+, Webflow) | All plugins usable incl. SplitText, MorphSVG |
