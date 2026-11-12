---
name: motion-video
description: >-
  Universal Creative Studio for deterministic video-as-code across ALL video universes —
  2.39:1 cinematic films, historical & archival documentaries (Vox/Arte), photorealistic 3D PBR
  (Three.js AgX/HDRI & Blender Cycles), hybrid HD live-action + code post-production, luxury &
  editorial brand films, emotional storytelling, kinetic typography / Moji-PV, SaaS UI launches,
  2.5D tech architecture, data journalism, STEM/math, and 9:16 social shorts — across Frontier
  AND fast/small models (`gemini-3.8-flash`). Enforces Phase-0 Creative Director thinking (ask
  via `clarify` when interactive, or self-author `creativeDirection` when autonomous) so videos
  look crafted by a human studio, never generic AI output.
---

# Motion Video v3.0 — Universal Creative Studio (`Physics Strict, Aesthetics Plural`)

Everything on screen is driven by a deterministic program (`frame = f(t)` via `window.seek(t)`), rendered headlessly in parallel to **BT.709** H.264 MP4 with **−14 LUFS** broadcast-normalized audio.

**Core Studio Philosophy**:
- **Physics, Optics & Readability are 100% STRICT**: zero `NaN` springs, zero accidental overlaps, valid contrast, human reading holds, frame-exact audio/beat sync, BT.709 color, deterministic SHA-256 frames.
- **Art Direction, Medium & Staging are 100% PLURAL**: never force a dark SaaS Bento dashboard onto a historical documentary, luxury brand film, emotional story, or photorealistic 3D piece!

---

## 0. Phase-0 Creative Director Protocol (Ask When Possible, Self-Direct Otherwise)

Before writing a single line of scene code, read `references/creative-direction.md` and resolve the **5 Studio Direction Questions**:
1. **Universe & Visual Medium** (*Cinema `2.39:1`, Archival Documentary 2.5D, Photoreal 3D PBR, Hybrid HD Footage + Code, Luxury Editorial, Illustrated Story, Kinetic Manifesto, or Tech/SaaS/Data?*)
2. **Emotional Arc & Color Script** (*How do warmth, contrast, and mood evolve from Scene 1 to the payoff?*)
3. **Typography & Tactile Optics** (*Which editorial Google Fonts duo + analog optics: 35mm grain, halation, cotton paper, or studio glass?*)
4. **Soundscape & J-Cut Pacing** (*Narrated VO, bowed cinema strings, intimate felt piano, minimal glass, or rhythmic synth — and where does silence breathe?*)
5. **Real Visual Assets** (*User-provided URLs/logos/footage, or zero-key HD archives `--wikimedia`, `--nasa`, `--art`, `--polyhaven-hdri`, `--icon`?*)

### Mandatory Decision Rule
- **Interactive Mode (`clarify` available + open/underspecified prompt)**: Ask **3–4 sharp, high-impact questions** (putting your recommended studio direction first) before building.
- **Autonomous / Sub-Agent / Carte-Blanche Mode (`clarify` unavailable or user delegates choices)**: **Answer all 5 questions YOURSELF inside `timeline.json -> creativeDirection`** (`universe`, `emotionalArc`, `visualMetaphor`, `typographyPairing`, `signatureMoment`, `forbiddenCliches`) *before* designing `scenes[]`. This forces true directorial reasoning instead of generic AI defaults — and `audit_telemetry.mjs` checks it!

---

## 1. Model-Tier Adaptive Execution (Frontier vs Fast/Small Models)

| Track | Target Models / Use Case | Mandatory Execution Rules |
|---|---|---|
| **Track S — Scaffolded Compiler Loop** *(Mandatory for Flash / Lite / ≤32B models; fast & overlap-free for any multi-scene film)* | Fast/small models (`gemini-3.8-flash`, Haiku, Qwen-Coder) across ANY universe (Cinema, Docu, Story, Tech, Data) | 1. **Rule 0 — Black-Box SDK Law**: **NEVER `read_file` `motion-kit.js`, `audit_telemetry.mjs`, or `render_frames.mjs`**! Read ONLY `references/creative-direction.md` + `references/small-model-loop.md`, fetch real assets (`fetch_assets.mjs --bundle`), then write `timeline.json` (with `creativeDirection`) and `index.html`.<br>2. Match theme/tools to `universe`: use `MVS.drawImagePlate` + `loadGoogleFonts` + `applyCinemaOptics` + frameless `drawTextAutoFit` for Cinema/Docu/Story/Luxury (**zero UI cards or HUD chrome!**); use `drawMetricCard`/`drawAreaChart`/`drawIsometricStack` only for Tech/SaaS/Data.<br>3. Isolate 1 function per scene (`SCENES[id]`) and run **2–5 passes** of `audit_telemetry.mjs`, never editing `LOCKED CLEAN SCENES`. |
| **Track F — Bespoke Frontier Studio** *(Opus / GPT-5 / Gemini Pro+ on custom 3D PBR, raymarching shaders, bespoke rigs)* | Photoreal Three.js PBR + HDRI, Headless Blender Cycles + AgX, custom WebGL2 raymarching, *PaperClip* giant worlds | Combine `references/3d-and-realism.md`, `references/storytelling-and-cinema.md`, and `references/motion-craft.md` with `MVS` physics/optics/preloaders, and verify via `audit_telemetry.mjs` + `stills.mjs --determinism`. |

---

## 2. Multi-Universe Studio Router (All Video Worlds)

| Universe (`creativeDirection.universe`) | Studio Grammar & Anti-Cliché Law ("Not AI-Generated") | Primary Tools & Assets |
|---|---|---|
| **1. `cinematic-film`** *(Trailers, A24/Title Sequences, Prestige)* | `2.39:1` anamorphic letterbox, frameless `Cormorant Garamond` serif, chiaroscuro HD plates, `3.8%` 35mm grain, warm halation, J-cut bowed strings. **NO UI cards, NO HUD!** | `cinema-a24` + `drawImagePlate` + `synthCinemaScore('cinema-strings')` (`storytelling-and-cinema.md`) |
| **2. `documentary-archive`** *(History, Vox, Arte, Investigations)* | Warm museum paper (`#F3EFE6`), angled archival prints (`archival-plate`), `Newsreader` serif, live ink `drawHighlighter`, Color Script shift. **NO SaaS dashboards!** | `documentary-vox` + `fetch_assets.mjs --wikimedia / --art --bundle` |
| **3. `3d-photoreal`** *(Product Hardware, Architecture, Realism)* | `50–85mm` lens (`fov: 28–35°`), PolyHaven `.hdr` IBL, `AgXToneMapping`, `MeshPhysicalMaterial` (glass/anodized metal/lacquer) or **Blender 4.x Cycles + AgX**. | Three.js PBR / Headless Blender + `--polyhaven-hdri / --polyhaven-tex` (`3d-and-realism.md`) |
| **4. `hybrid-cinema`** *(Real/Stock/AI HD Footage + Code Edit)* | Frame-exact video sequences (`--extract-video`), unified OKLCH color grade, 35mm grain cohesion, `knockout-type` title masks, beat-synced J-cuts. | `fetch_assets.mjs --extract-video` + `drawImagePlate` (`3d-and-realism.md` §3) |
| **5. `luxury-editorial`** *(Fashion, Design, Architecture, Perfume)* | Radical *Ma* negative space (85% alabaster/obsidian air), `Instrument Serif` italic, slow exponential drift, sparse glass harmonics. | `luxury-editorial` + `monumental-payoff` + `synthCinemaScore('minimal-luxury')` |
| **6. `storytelling-illustrated`** *(Narrative, Biography, Culture)* | Multiplane 2.5D depth (`withParallax`), emotional per-scene `palette` arc, `Fraunces` serif, character sheet (`--avatar` / `--undraw` / custom SVG). | `warm-story` / `kurzgesagt-pop` + `storytelling-and-cinema.md` |
| **7. `kinetic-manifesto` / Moji-PV** | 7:2:1 hierarchy, orthogonal `90°` *Kire* cuts on BPM downbeats, **1 signature invert-flash** on climax (`85/15` audacity law). | `swiss-brutalist` / `noir-chiaroscuro` / `sakura-anime` + `beat_grid.py` |
| **8. `saas-product` & `tech-architecture`** | Real product DOM capture or `1px` specular cards, cursor click choreography, 2.5D isometric stacks (`drawIsometricStack`), photon flow beams. | `linear-dark` / `apple-keynote` + `genre-blueprints.md` §1–2 |
| **9. `data-journalism` & `stem-explainer`** | Single-driver scrub charts (`drawAreaChart`), D3 Natural Earth globes, **KaTeX / Typst** publication equations, seeded **Rough.js**. | `paperclip-cn` / `swiss-brutalist` + `--world-map` (`genre-blueprints.md` §3–4) |
| **10. `social-short` (`9:16` TikTok/Reels/Shorts)** | **Heroic Frame-0** (hook `>=85%` visible at `t=0.0s`), L-shaped 2026 Safe-Zone, VO-first word-pop captions (`vo_gen.py`). | `?ar=9:16` + `vo_gen.py --scenes-json` (`genre-blueprints.md` §7) |

---

## 3. Production Loop — Strict Studio Order

1. **CREATIVE DIRECTION (`timeline.json -> creativeDirection`)** — Ask via `clarify` if interactive & open; otherwise self-direct all 5 questions (`universe`, `emotionalArc`, `visualMetaphor`, `signatureMoment` obeying the **85% restraint / 15% audacity law**, and `forbiddenCliches`).
2. **VO & REAL ASSETS FIRST (`video/assets/`)** — If narrated, generate VO & word tokens first (`vo_gen.py --scenes-json`). Pull real HD archives, NASA plates, museum art, 3D HDRIs, or icons via `fetch_assets.mjs --bundle` so assets work 100% offline/CORS-free.
3. **MODULAR `seek(t)` BUILD (`video/index.html`)** — Load chosen typography (`await MVS.loadGoogleFonts(...)`) and bundle (`await MVS.preloadBundle()`) in `window.onReady()`. Isolate one function per scene in `SCENES[id]`.
4. **CONTEXT-AWARE TELEMETRY COMPILER (`< 2.7s`)** —
   ```bash
   node <video-qa>/scripts/audit_telemetry.mjs --file video/index.html --timeline video/timeline.json
   node <motion-video>/scripts/stills.mjs --file video/index.html --times 1.0,5.0,9.0 --determinism --out out/stills
   ```
   Checks **17 gates** (NaN, overlaps, safe-zones, WCAG contrast, temporal freeze, 3-act evolution, shot-polarity monotony, Eye-Trace, BPM sync, AND **`CLICHE_VIOLATION`** blocking SaaS cards/HUD inside Cinema/Docu/Luxury while respecting intentional *Ma* minimalism!). Never touch `LOCKED CLEAN SCENES`.
5. **RENDER, MASTER & INSPECT (`out/video.mp4` + `out/contact.png`)** —
   ```bash
   node <motion-video>/scripts/render_frames.mjs --file video/index.html --out out/raw.mp4 [--audio video/vo.mp3] --workers 4
   node <video-qa>/scripts/post.mjs out/raw.mp4 out/video.mp4 --matrix 709 --loud -14
   node <video-qa>/scripts/disco.mjs out/video.mp4
   <motion-video>/scripts/contact_sheet.sh out/video.mp4 out/contact.png 1 4x
   ```
   Visually inspect `out/contact.png` + hero stills before delivering.

---

## 4. Studio Reference Map

- **Creative Director Thinking, Anti-AI-Slop Laws, 85/15 Audacity & 12 Font Pairings** → `references/creative-direction.md`
- **Photorealistic 3D (Three.js AgX/HDRI, Blender Cycles) & Hybrid HD Cinema** → `references/3d-and-realism.md`
- **Storytelling, 2.5D Archival Documentary (Vox/Arte), Color Scripts & J-Cut Score** → `references/storytelling-and-cinema.md`
- **Small/Fast Model Black-Box `MVS` v3.0 API Cheat-Card & Compiler Loop** → `references/small-model-loop.md`
- **Zero-Key HD Archives (Wikimedia, NASA, Met CC0), PolyHaven 3D, Icons & Shaders** → `references/visual-resources.md`
- **SaaS, Tech 2.5D, STEM, Data-Viz, Kinetic Type & 9:16 Blueprints** → `references/genre-blueprints.md`
- **Physics Springs, *Kire/Yoin/Ma*, OKLCH & Multilingual Typography** → `references/motion-craft.md`
- **Engines (`seek(t)`, Remotion, HyperFrames, ManimGX + Typst, Blender)** → `references/engines.md`
- **VO-First Pipelines, TTS & Multi-Universe Audio Mastering** → `references/story-pipelines.md`, `references/audio.md`
- **17-Gate Telemetry Compiler, Determinism & `disco.mjs` Release Gate** → `references/verify.md`
