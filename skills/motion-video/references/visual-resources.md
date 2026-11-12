# Visual Resources & Shaders Catalog (Zero-Key, Deterministic, `seek(t)` Ready)

Never settle for empty `#000000` backgrounds or crude hand-coded stick figures. Every resource below is **verified free, requires ZERO API key**, and works deterministically inside `seek(t)`.

> **Offline / Deterministic Rule**: Prefer downloading external SVGs/JSON into `video/assets/` during Step 1 via `node <motion-video>/scripts/fetch_assets.mjs` so rendering never depends on network latency!

---

## 1. Vector Icons, Tech Logos, Illustrations & World Maps

### 1.1 Iconify API (200,000+ Open-Source Icons: Lucide, Phosphor Duotone, Solar, Tabler)
- **CLI Fetch (recommended)**:
  ```bash
  node <motion-video>/scripts/fetch_assets.mjs --searchIcon "submarine"
  node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
    --icon ph:globe-hemisphere-west-duotone,lucide:cpu,solar:bolt-bold-duotone --color "#38BDF8"
  ```
- **Direct HTTP Endpoints**:
  - Search (`limit >= 32` required by API): `https://api.iconify.design/search?query=rocket&limit=32&prefixes=ph,lucide,solar,tabler`
  - Colorized SVG: `https://api.iconify.design/ph/planet-duotone.svg?color=%23FF4D00&width=256`
  - Raw `<path>` JSON (for `Path2D` / `stroke-dashoffset` line-drawing animations!): `https://api.iconify.design/lucide.json?icons=rocket,cpu`

### 1.2 Official Brand & Tech Stack Logos (SVGL + Simple Icons)
- **CLI Fetch**: `node <motion-video>/scripts/fetch_assets.mjs --out video/assets --logo react,docker,rust,postgresql`
- **SVGL API**: `https://api.svgl.app?search=typescript` — *Note*: `hit.route` is either a `string` URL or `{ light, dark }` object (`fetch_assets.mjs` handles both automatically).
- **Simple Icons Tinted CDN**: `https://cdn.simpleicons.org/{slug}/{hexWithoutHash}` (e.g. `https://cdn.simpleicons.org/kubernetes/38BDF8`).

### 1.3 Figurative Vector Scenes & Characters (unDraw API + DiceBear CC0)
- **unDraw Vector Scenes (recolored to your palette)**:
  ```bash
  node <motion-video>/scripts/fetch_assets.mjs --out video/assets --undraw "data_center" --accent "#FF5A36"
  ```
  *(Queries `https://undraw.co/api/search?q=...` and replaces default `#6c63ff` with your `--accent` color!)*
- **DiceBear v9/v10 CC0 Characters** (Pablo Stanley's *Open Peeps* & *Notionists*):
  ```bash
  node <motion-video>/scripts/fetch_assets.mjs --out video/assets --avatar open-peeps:Elena
  node <motion-video>/scripts/fetch_assets.mjs --out video/assets --avatar notionists:Marcus
  ```

### 1.4 Real World Geography (Natural Earth TopoJSON)
- **CLI Fetch**: `node <motion-video>/scripts/fetch_assets.mjs --out video/assets --world-map`
  Downloads `countries-110m.json` (107 KB) from `world-atlas@2.0.2`. Pair with `d3@7.9.0` + `topojson-client@3.1.0` (`d3.geoOrthographic().rotate([t * 12, -18]).fitSize([w, h], sphere)`) on `CanvasRenderingContext2D` for broadcast-grade rotating globes and flight/cable arcs!

---

## 2. Embedded JS Libraries & Shaders for Single-Page `seek(t)`

### 2.1 Hand-Drawn Whiteboard / Sketch Style (`Rough.js`)
Load `https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js`.
- **Determinism Law**: ALWAYS pass `{ seed: 42 }` for rock-steady strokes, or `{ seed: 42 + Math.floor(t * 6) }` for intentional 6fps studio *line-boil*! Never omit `seed` (defaults to `Math.random()`).

### 2.2 Publication Math & STEM Equations (`KaTeX` or `Typst`)
- **KaTeX (Browser-native)**: Load `katex@0.19.1` CSS + JS, await `document.fonts.ready` inside `window.onReady()`, and wrap terms with `\htmlClass{term-a}{a^2} + \htmlClass{term-b}{b^2} = \htmlClass{term-c}{c^2}` (`{ trust: true }`) to highlight/scale individual algebraic terms in `seek(t)`!
- **Typst (CLI SVG)**: `typst compile --format svg eq.typ eq.svg` (~30ms, zero 4GB TeX Live install) → animate SVG `<g>` / `<path>` nodes cleanly.

### 2.3 Three.js 3D Studio PBR Without External `.hdr` Files
When building 3D product/brand scenes in a single HTML page:
1. Create `new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })` (`preserveDrawingBuffer: true` is mandatory for screenshot capture!).
2. Use `THREE.ACESFilmicToneMapping` + `RoomEnvironment` (`three/addons/environments/RoomEnvironment.js`) via `PMREMGenerator` — instant studio softbox reflections with **zero external `.hdr` file**!
3. Drive animations purely from `t` (`mixer.setTime(t)` or analytic orbit `camera.position.set(Math.sin(t*0.4)*r, h, Math.cos(t*0.4)*r)`), ending `seek(t)` with `renderer.render(scene, camera)`.

### 2.4 Built-In WebGL2 Shaders (`MVS.createShaderBackdrop`)
`assets/motion-kit.js` ships with 3 ready-to-use zero-dependency GLSL ES 3.0 backdrops (`preserveDrawingBuffer: true`, anti-banding dithering, `fwidth()` anti-moiré derivatives):
- `'stripe-mesh'` — Silk multi-stop domain-warped gradient with `±0.5/255` dither (zero H.264 banding).
- `'aurora-gyroid'` — Volumetric 4-layer gyroidal light curtains (replaces flat dark backgrounds in ambient/lyric videos).
- `'architectural-grid'` — Horizon perspective floor filtered via `fwidth()` analytic derivatives (zero shimmer/aliasing).

```js
const glBg = document.getElementById('bg-gl');
const renderShader = MVS.createShaderBackdrop(glBg, 'aurora-gyroid');
// Inside seek(t):
renderShader(t);
ctx.clearRect(0, 0, W, H);
ctx.drawImage(glBg, 0, 0, W, H); // Composite onto main 2D stage!
```

---

## 3. Zero-Key HD Photography, Museum Art, Space Plates, 3D PBR & Video Sequences (`fetch_assets.mjs` v3.0)

Never trap every video inside vector diagrams! `scripts/fetch_assets.mjs` v3.0 pulls real studio assets across **every visual universe** with **zero API keys**, and `--bundle` packs images into `video/assets/assets-bundle.js` (`window.__MVS_ASSETS__`) for instant zero-CORS `file://` rendering via `await MVS.preloadBundle()`:

```bash
# 1. Historical, Cultural & Documentary HD Photography (Wikimedia Commons API)
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --wikimedia "Wright Flyer 1903,Montgolfier balloon,Concorde supersonic" --bundle

# 2. Space, Earth, Astronomy & Science HD Plates (Official NASA Image Library)
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --nasa "Earth horizon sunrise,Carina Nebula,Apollo 11 moonwalk" --bundle

# 3. Fine Art, Classical Paintings & Prints (The Met Open Access CC0 + Wikimedia Museum Scans)
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --art "Great Wave Kanagawa,Starry Night,Wanderer sea of fog" --bundle

# 4. Photorealistic 3D Studio HDRI Lighting (.hdr) & 1K PBR Texture Maps (PolyHaven CC0)
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --polyhaven-hdri studio_small_09 \
  --polyhaven-tex aerial_rocks_02

# 5. Hybrid Cinema HD: Extract Real / Stock / AI Video Clip into Frame-Exact Sequence for seek(t)
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --extract-video raw_footage.mp4 --fps 30
```
