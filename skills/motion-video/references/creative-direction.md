# Creative Direction & Studio Taste — How to Make Videos That Never Look AI-Generated

Technical perfection (zero overlaps, 60fps, valid WCAG contrast) only gets a video to "competent." What makes a viewer say *"Wait — an actual creative studio directed this"* is **taste, restraint, materiality, and one bold directorial choice**.

---

## 1. Phase 0: Mandatory Creative Interrogation (Ask When Possible, Self-Direct Otherwise)

Never jump straight from a prompt into a default dark tech template. Before writing any scene code, resolve the **5 Creative Director Questions**:

1. **Universe & Medium**: Is this a *2.39:1 Cinematic Film*, *2.5D Archival Documentary (Vox/Arte)*, *Photorealistic 3D Product Stage (Three.js PBR / Blender)*, *Luxury/Editorial Minimalist Piece*, *Warm Illustrated Story*, *Kinetic Manifesto*, or *Tech/SaaS/Data*?
2. **Emotional Arc & Color Script**: How should the viewer *feel* at `t = 0s` vs the midpoint turn vs the final frame, and how does the color temperature evolve across scenes?
3. **Typography & Tactile Materiality**: Which editorial typeface duo (`Cormorant Garamond`, `Newsreader`, `Instrument Serif`, `Fraunces`, `Syne`, `Shippori Mincho`...) and optical surface (35mm grain, warm halation, archival cotton paper, clean studio glass) belong to this world?
4. **Soundscape & Pacing**: Narrated voiceover, bowed cinema strings (`cinema-strings`), intimate felt piano (`documentary-felt`), minimal glass harmonics (`minimal-luxury`), or rhythmic synth pulse — and where do **J-cuts** or **dramatic silences** breathe?
5. **Real Visual Matter**: Did the user provide URLs, logos, photos, or footage — or which real HD archives (`--wikimedia`, `--nasa`, `--art`), 3D HDRIs (`--polyhaven-hdri`), or vectors should `fetch_assets.mjs` pull first?

### Execution Rule: Interactive vs Autonomous
- **When Interactive (`clarify` tool or direct user chat available) AND the prompt leaves creative direction open**: Ask **3 to 4 concise, high-impact questions** (putting your recommended artistic direction first) before building.
- **When Autonomous (sub-agent, background worker, CLI batch, or user says *"carte blanche"*)**: **Ask those exact 5 questions TO YOURSELF** and lock your answers inside `timeline.json -> creativeDirection` *before* writing `scenes[]`. Committing `creativeDirection` forces deliberate authorship instead of generic defaults — and `audit_telemetry.mjs` verifies it!

---

## 2. The 8 "AI-Generated Slop" Tells — and Their Studio Antidotes

| # | Instant "AI-Generated" Tell | What Real Studios Do Instead (Buck, A24, Vox, Apple, ManvsMachine) |
|---|---|---|
| **1** | **Card-itis** — wrapping every title, quote, or number inside a translucent rounded rectangle (`border-radius: 16px`, `1px` border). | **Frameless Spatial Typography** — let type live directly on photography (over a subtle directional chiaroscuro scrim), on warm archival paper, or masked behind foreground subjects. Reserve UI cards strictly for actual SaaS/Data dashboards! |
| **2** | **Uniform 60% Density (Fear of *Ma*)** — cramming 1 header + 2 cards + 1 widget into every single scene from start to finish. | **Density Contrast** — follow a dense analytical scene with a **90%-empty `monumental-payoff` frame**: three italic serif words in warm ivory over deep obsidian, holding for `1.8s` so the idea lands. |
| **3** | **Default Dark-Blue + Cyan + `Inter` Everywhere** — using `#0B0E14`, `#38BDF8`, and `Inter` on history, luxury, food, cinema, or human stories. | **World-Specific Palettes & Editorial Type** — load real Google Fonts pairings (`MVS.loadGoogleFonts('cinema-a24' \| 'documentary-vox' \| 'luxury-editorial' \| 'warm-story')`) and warm/tactile palettes. |
| **4** | **Sci-Fi HUD Corner Brackets on Everything** — slapping `PROJECT // 01` and `T+04.20s` onto non-sci-fi topics. | **Strict Genre Discipline** — `audit_telemetry.mjs` v3.0 raises `CLICHE_VIOLATION` if `drawMetricCard` or `drawHudOverlay` appears inside Cinema, Documentary, Luxury, Fine-Art, or Storytelling universes! |
| **5** | **Sterile Digital Flats** — razor-flat sRGB hex fills with zero optical texture or atmospheric light falloff. | **Controlled Analog Optics (`MVS.applyCinemaOptics`)** — `3–4%` seeded 35mm film grain, gentle radial vignette (`0.32`), subtle warm halation on highlights, or linen paper fibers. |
| **6** | **Synchronized "Slide" Entrances** — every element rising `+28px` over `0.45s` on every cut like PowerPoint. | **Asymmetric Choreography** — mix instant hard-cut full-bleed plates (`entrance: false`) with delayed editorial captions (`delay: 0.35s`) and continuous camera drift. |
| **7** | **Static Palette Across the Whole Video** — identical background and accent color in Scenes 1, 2, 3, and 4. | **Emotional Color Script (`scene.palette`)** — shift background warmth and accent saturation across Acts (e.g., sepia archive → cold slate crisis → warm tungsten resolution). |
| **8** | **Robotic Cut-on-Cut Audio** — audio and picture starting and stopping on the exact same millisecond. | **J-Cuts & Pre-Cut Swells (`jCutSec: 0.38`)** — let the next scene's harmonic swell, breath, or Foley begin `0.35–0.45s` *before* the visual cut (`MVS.synthCinemaScore`). |

---

## 3. *"Oser sans abuser"* — The 85% Restraint / 15% Signature Gesture Law

Amateurs either play it boringly safe (100% generic slides) or abuse effects (wipes, neon glows, particles, and camera shakes on every beat).
**Masters hold 85% of the film in disciplined, invisible craft — and spend 15% on ONE unforgettable `signatureMoment`:**

Pick **ONE** signature gesture per short video (declare it in `creativeDirection.signatureMoment`):
1. **The Knockout Title Window** (`MVS.drawImagePlate(..., { style: 'knockout-type', text: '1903' })`): giant monumental display letters filled internally with moving archival HD photography before cutting full-bleed into the photograph itself.
2. **The Scale Portal Match-Cut** (`transition: 'portal'`): zooming straight into the center of an eye, clock dial, planet, or painting detail to emerge inside the next world.
3. **The Pre-Climax Breath (*Ma* Drop)**: cutting music/motion to near-silence and holding a stark minimalist frame for `0.6s` right before the biggest visual and sonic reveal.
4. **The Live Documentary Ink Sweep** (`MVS.drawHighlighter`): freezing softly on an archival photograph or manuscript quote while a translucent yellow/terracotta marker stroke sweeps across the decisive phrase.
5. **The Polarity Inversion Cut**: shifting suddenly from dark obsidian chiaroscuro (`#090807`) to full-frame warm cream paper (`#F3EFE6`) on the narrative turn ("Until everything changed.").
6. **The Anamorphic `2.39:1` Widescreen Frame** (`optics: { letterbox: '2.39:1', grain: 0.042, halation: 0.08 }`): instant theatrical cinema presence with frameless serif subtitles.

---

## 4. Curated Editorial Typography Matrix (`MVS.loadGoogleFonts`)

Call `await MVS.loadGoogleFonts('<key>')` inside `window.onReady()`:

| Pairing Key | Display Face | Body / Technical Face | Best Universes |
|---|---|---|---|
| `'cinema-a24'` | `Cormorant Garamond` *(600/700 + Italic)* | `Plus Jakarta Sans` + `Space Mono` | Cinema trailers, historical drama, prestige essays |
| `'documentary-vox'` | `Newsreader` *(Optical size 72)* | `Work Sans` + `IBM Plex Mono` | Investigative journalism, history, maps, Vox/NYT explainers |
| `'luxury-editorial'` | `Instrument Serif` *(Roman + Italic)* | `Plus Jakarta Sans` | Fashion, architecture, design manifestos, luxury products |
| `'warm-story'` | `Fraunces` *(Soft optical serif)* | `Outfit` | Human stories, culture, biography, warm brand storytelling |
| `'brutalist-syne'` | `Syne` *(800 ExtraBold)* | `Space Mono` | Art direction, music/festival promos, avant-garde motion |
| `'swiss-poster'` | `Archivo Black` | `Inter` + `IBM Plex Mono` | Bauhaus/Swiss kinetic posters, bold manifestos |
| `'classic-literary'` | `Playfair Display` | `Source Sans 3` | Literature, philosophy, museum & fine-art films |
| `'tech-precision'` | `Space Grotesk` | `Inter` + `JetBrains Mono` | Engineering, AI/cloud architecture, developer tools |
| `'jp-mincho'` / `'kr-editorial'` / `'cn-humanist'` | `Shippori Mincho` / `Nanum Myeongjo` / `Noto Serif SC` | `Noto Sans JP` / `IBM Plex Sans KR` / `Noto Sans SC` | Authentic East Asian cinema, Moji-PV, editorial explainers |
