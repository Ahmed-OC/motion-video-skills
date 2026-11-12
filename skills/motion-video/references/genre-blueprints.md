# Genre Blueprints — Concrete Studio Architectures for All 10 Video Types

Every video genre has a proven spatial and kinetic grammar. Pick ONE primary visual blueprint below and execute it with discipline across scenes.

---

## 1. SaaS / UI Product Launch (`linear-dark` / `apple-keynote`)
- **Visual Anchor**: Elevated product window (`MVS.drawCard` with `1px` specular top border), flanked by 1–2 KPI cards (`MVS.drawMetricCard`) or a live metric curve (`MVS.drawAreaChart`).
- **Cursor Choreography**: Never show static UI screenshots. Drive a vector cursor from `(x0, y0)` to target button `(x1, y1)` with `MVS.EASE.studioInOut`, compress button scale `1.0 → 0.96 → 1.0` at `t_click`, emit an expanding ring (`r: 8 → 54`, `alpha: 0.7 → 0`), and flip UI state on the exact click frame (`SFX: uiClick@t_click`).
- **Real Product Rule**: If given a live URL, capture real 2x DOM views with Playwright first — never invent fake SaaS UI chrome when the real product exists.

---

## 2. Tech Architecture & Chinese MG Signatures (`等轴测沙盘` · `回形针` · `流光`)
1. **2.5D Exploded Isometric Stack (`MVS.drawIsometricStack`)**:
   - Ideal for hardware layers, cloud/AI stacks, subsea cables, or security pipelines.
   - Layers separate vertically with staggered `springApple` (`delay: idx * 0.11s`), shaded with 3-face lightness contrast (`top: base`, `left: -22%`, `right: -38%`) and horizontal leader-lines to right-aligned callout labels.
2. **Luminous Flow Beams (`流光` — `MVS.drawFlowBeam`)**:
   - Connect architecture nodes (Client → Edge → Core DB) with quadratic Bézier arcs carrying high-contrast photon packets (`14`-segment tapered alpha trail + bright white head).
3. ***PaperClip* (`回形针`) Continuous Giant Canvas (`paperclip-cn` theme)**:
   - Instead of cutting between unrelated slides, place all 4–6 diagrams on a virtual `5760×3240` world (`#E9EEF2` slate-paper background, `#FF5A36` international orange accent) and pan/zoom a single camera (`MVS.EASE.studioInOut`) from station to station. Cutout photos get an `8px` white sticker border + subtle drop shadow.

---

## 3. STEM / Math / Scientific Explainer
- **Anti-Pythagoras-Void Law**: Never draw tiny thin lines on `#000000` with floating raw ASCII `a^2 + b^2 = c^2`.
- Use a warm drafting grid (`swiss-brutalist` `#F4F1EA` or `deep-ocean-atlas` blueprint), render real mathematical notation via **KaTeX** (`\htmlClass` per term) or **Typst → SVG**, fill geometric areas with translucent **OKLCH** tints (`alpha: 0.22`), and animate proof steps sequentially (highlight term A in `#38BDF8` → morph corresponding geometric area in the exact same `#38BDF8` hue!).

---

## 4. Data-Viz, Economics & Geopolitics
- **Single-Driver Scrub Law**: Drive line/area/bar reveals, date counters, and floating value badges from the **exact same normalized progress variable `p ∈ [0, 1]`** (`MVS.drawAreaChart` does this automatically) so the readout never lags or leads the curve tip.
- **Signal over Chrome**: Maximum 4 horizontal gridlines (`alpha: 0.08`), gray context series (`#64748B`), **one** saturated accent series (`#38BDF8` or `#FF4D00`), human-readable units (`$1.4T`, `99.1%`), and `tabular-nums` everywhere.
- **Cartography**: Use `MVS.drawGlobeWire` or `D3 + countries-110m.json` (`fetch_assets.mjs --world-map`) with glowing geodesic arcs (`d3.geoInterpolate`).

---

## 5. Kinetic Typography / Lyric / Japanese *Moji-PV* (`文字PV`)
- **7:2:1 Focal Contrast**: 70% structural space (*Ma* 間) or dark/paper field, 20% secondary framing/timecode/sub-lyrics, 10% razor-sharp accent burst.
- **Orthogonal *Kire* Cuts**: Alternate `90°` entry vectors on downbeats (`beat_k = k * 60 / bpm`), snap words in with `MVS.EASE.kireOut`, and reserve 1 dramatic invert-flash (background ↔ foreground swap on a single bar downbeat) for the chorus/payoff drop.

---

## 6. Code, CLI & Developer Tooling Demos
- **Glass Code Stage (`MVS.drawCodeCard`)**: Never dump 35 lines of `12px` code onto a slide. Show **2 to 6 lines max** at `20–28px` monospace, highlight the active changed line (`highlightLines: [1]`), and pair the code card side-by-side (`MVS.hstack`) with its live visual result!
- For multi-step refactoring diffs, precompute token positions with `@shikijs/magic-move` (`createMagicMoveMachine`) and interpolate token `(x, y, opacity)` inside `seek(t)`.

---

## 7. 9:16 Vertical Shorts (TikTok / Reels / YouTube Shorts)
- **Heroic Frame-0 Law**: Platform feeds use `t = 0.0s` as thumbnail and autoplay muted. **Never start with a fade-from-black!** At `t = 0.0s`, the headline badge and primary visual anchor must already be `>= 85%` visible and mid-motion.
- **L-Shaped Safe Envelope (`MVS.computeSafeZone(1080, 1920)`)**: Keep all text and key visuals inside `x ∈ [96, 984]`, `y ∈ [256, 1500]`, and avoid the right-side social icon rail (`x > 888` below `y = 840`).
- **Pacing**: Visual state change or sub-reveal every `1.5–2.2s`; word-pop captions via `vo_gen.py` + `MVS.drawCaptions` (auto-suppressed whenever a hero title already displays the same phrase).
