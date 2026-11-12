# 3D Photorealism, Atmospheric Shaders & Hybrid HD Cinema

When a brief asks for **photorealistic 3D**, **cinematic realism**, or **high-definition live-action feel**, never fake it with flat 2D vector cartoons. Choose the right realism pipeline below — all 100% deterministic under `frame = f(t)`.

---

## 1. Photorealistic 3D in Browser (`Three.js r170+` PBR + HDRI + AgX + Lens DOF)

Why amateur LLM Three.js scenes look like 2012 plastic: `DirectionalLight` on `MeshPhongMaterial`, `75°` fisheye FOV, `Reinhard` or no tone mapping, and `#000000` empty space.

### Studio 3D Rules (Indistinguishable from Offline Product Renders)
1. **Telephoto Cinema Focal Length**: Always use **`fov: 28` to `36`** (`50mm–85mm` lens equivalent), never `fov: 75`! Wide FOV distorts product geometry and screams "WebGL demo."
2. **Real Image-Based Lighting (IBL)**: Load a real PolyHaven CC0 `.hdr` (`fetch_assets.mjs --polyhaven-hdri studio_small_09`) via `RGBELoader` + `PMREMGenerator` (or `RoomEnvironment` when zero-asset), and enable **`THREE.AgXToneMapping`** (or `ACESFilmicToneMapping`).
3. **Physical Materials (`MeshPhysicalMaterial`)**:
   - *Anodized Titanium / Brushed Metal*: `{ color: 0xd4d4d8, metalness: 0.94, roughness: 0.24, anisotropy: 0.65, envMapIntensity: 1.3 }`
   - *Optical Glass / Crystal*: `{ color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 0.98, ior: 1.52, thickness: 1.6 }`
   - *Ceramic / Automotive Lacquer*: `{ color: 0x141416, metalness: 0.1, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.05 }`
   - *Real Rock / Wood / Concrete*: apply `--polyhaven-tex` `Diffuse`, `Rough`, and `nor_gl` normal maps!
4. **Deterministic `seek(t)` Contract**: Pass `{ antialias: true, preserveDrawingBuffer: true }` to `WebGLRenderer`, compute camera orbit/dolly purely from `t`, and composite subtle 35mm grain + typography on a 2D overlay canvas if needed.

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1920, H = 1080;
window.VIDEO = { width: W, height: H, fps: 30, duration: 10 };

const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a09);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 85mm Studio Portrait/Product Lens (FOV 28°)
const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);

// Rim + Key Studio Area Lights
const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.8);
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.SpotLight(0x93c5fd, 18, 20, 0.5, 0.8);
rimLight.position.set(-5, 3, -4);
scene.add(rimLight);

window.seek = (t) => {
  const angle = -0.35 + t * 0.18;
  const radius = 5.4 - MVS.EASE.studioInOut(MVS.clamp(t / 10, 0, 1)) * 0.9;
  camera.position.set(Math.sin(angle) * radius, 1.35 + Math.sin(t * 0.4) * 0.08, Math.cos(angle) * radius);
  camera.lookAt(0, 0.2, 0);
  renderer.render(scene, camera);
};
</script>
```

---

## 2. Offline Ray-Traced Photorealism (`Headless Blender 4.x + Cycles + AgX`)

When you need true multi-bounce global illumination, caustics, cloth/fluid simulations, or heavy architectural 3D (`engines.md` §E):
1. **Color Management Law**: Set `scene.view_settings.view_transform = 'AgX'` and `scene.view_settings.look = 'AgX - Medium High Contrast'` — never leave old `Standard` sRGB (it clips highlights into ugly neon yellow/cyan!).
2. **Real Camera Optics**: `cam.lens = 65` (mm), `cam.dof.use_dof = True`, `cam.dof.aperture_fstop = 2.0`, focusing on an `Empty` target tracking your hero object.
3. **Physics Baking**: Always call `bpy.ops.ptcache.bake_all(bake=True)` inside your build script before `blender -b` renders frames!
4. **Post-Grade & Typography**: Render PNG frames from Blender, or extract with `fetch_assets.mjs --extract-video`, then composite razor-sharp typography, J-cut sound design, and `-14 LUFS` mastering through `render_frames.mjs` + `post.mjs`.

---

## 3. Hybrid HD Cinema (Real / Stock / AI Video Footage + Code Post-Production)

Pure procedural vectors should **never** pretend to be live-action human faces, wildlife, or street cinematography. Studio directors combine **real/AI HD photography & footage** with **deterministic code editing, optics, and typography**:

### Pipeline A — Real HD Archival & Space/Art Plates (`fetch_assets.mjs --bundle`)
```bash
node <motion-video>/scripts/fetch_assets.mjs --out video/assets \
  --wikimedia "Apollo 11 Saturn V launch,Concorde takeoff" \
  --nasa "Earth horizon night lights" \
  --art "Wanderer above the sea of fog" \
  --bundle
```
- Include `<script src="./assets/assets-bundle.js"></script>` in `video/index.html` and call `await MVS.preloadBundle()` inside `window.onReady()`.
- Render plates with `MVS.drawImagePlate(ctx, 'wiki_apollo-11-saturn-v-launch', fullCanvasRect, { style: 'full-bleed', scrim: 'left', zoomFrom: 1.02, zoomTo: 1.12, progress })` — instant 2.5D Ken Burns camera motion + directional chiaroscuro scrim + frameless serif typography + `2.39:1` letterbox + 35mm grain!

### Pipeline B — Frame-Exact Real or AI Video Clips (`--extract-video`)
Never put `<video src="clip.mp4">` directly inside `seek(t)` (`video.currentTime = t` resolves asynchronously and drops/repeats frames in headless Chromium!). Instead:
1. Pre-extract frames deterministically:
   ```bash
   node <motion-video>/scripts/fetch_assets.mjs --out video/assets --extract-video footage.mp4 --fps 30
   ```
2. Preload the needed frame range in `window.onReady()`, and inside `seek(t)` index the exact integer frame `idx = Math.min(maxFrame, Math.floor(localT * 30) + 1)` and pass it to `MVS.drawImagePlate(...)`!
3. Now **code** controls what raw AI video generators (Veo, Wan, Sora) cannot: **frame-accurate beat cuts, unified OKLCH color grading, `2.39:1` anamorphic mattes, 35mm film grain cohesion across cuts, tracked editorial typography, and `-14 LUFS` J-cut audio!**
