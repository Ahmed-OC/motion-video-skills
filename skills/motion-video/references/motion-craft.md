# Motion Craft v2.0 — Studio Physics, Perceptual Color (OKLCH) & Global Choreography

Distilled from empirical frame measurements across **Apple Keynotes** (33,187 frames), **Buck / Ordinary Folk / Vallée Duhamel**, **Linear / Stripe / Kurzgesagt**, **Japanese *Moji-PV* & FUI** (*Kire* キレ / *Tame-Tsume* タメ・ツメ / *Yoin* 余韻 / *Ma* 間), **Korean Toss & `cokacmotion`**, and **Chinese `#Vibe知识大赏` MG Studios**.

---

## 1. Exact 3-Regime Analytical Springs & Perceptual Timing

### Critical Bugs to Avoid (Why Naive Springs Fail)
1. **Never evaluate `sqrt(1 - ζ²)` when `ζ >= 1`**: `wd = 0` divides by zero (`NaN`), silently erasing elements from HTML5 Canvas without throwing an error.
2. **Never apply critical damping (`ζ = 1`) to `ζ > 1`**: overdamped motion requires two negative real exponentials (`r1, r2 < 0`, never `cosh`/`sinh` which overflow for large `t`).
3. **Never clamp `Math.abs(pos - 1) < 0.0005` alone**: an underdamped spring crosses `pos = 1.0` at peak velocity before overshooting — position-only clamping freezes it mid-flight! Always clamp on **total normalized mechanical energy**: `|1 - pos| + |vel| / w0 < 0.0004`.

All three laws are built into `MVS.spring(t, f0, zeta, v0)` and `MVS.springApple(t, duration, bounce, v0)`:

| Motion Intent | Parameters | Studio Feel |
|---|---|---|
| **Apple Text / Card Settle** | `MVS.springApple(dt, 0.52, 0.14)` (`ζ ≈ 0.86`) | Crisp ~1.5% micro-settle, zero rubberiness |
| **Linear / Toss Micro-UI** | `MVS.spring(dt, 3.8, 1.0)` (`ζ = 1.0`, critical) | Instant authority, zero bounce |
| **Playful Badge / Sticker Pop** | `MVS.springApple(dt, 0.45, 0.28)` (`ζ ≈ 0.72`) | ~2.5–4% energetic pop (use on at most 1 focal badge/scene) |
| **Heavy Camera Dolly** | `MVS.spring(dt, 1.4, 1.15)` (`ζ > 1`, overdamped) | Weighted cinematic tripod deceleration |
| **Additive Retargeting ($C^1$)** | `MVS.springTimeline([[0,0], [1.2,100], [1.5,40]])` | Smooth mid-flight target change without velocity discontinuity |

### The Lead-Opacity Law (`MVS.entrance`)
Never fade opacity over the full transform duration (`dur`) — slow opacity hides kinetic crispness in gray fog. Complete opacity in **`0.45 × dur`** using `uiSnapOut`, while `y` and `scale` settle via `springApple` over `1.0 × dur`.
- **Audio-Visual Lead**: Trigger hero text entrances **2 frames (`-67ms` at 30fps)** *before* the spoken keyword onset — empirical Apple/broadcast sync sweet spot.

---

## 2. Asymmetric Easings: *Kire* (キレ), *Tame/Tsume* (タメ・ツメ) & *Yoin* (余韻)

Symmetric `ease-in-out` (`0.42, 0, 0.58, 1`) screams "default CSS". Professional motion maximizes peak-to-mean velocity ratio ($v_{\max}/\bar{v} \ge 5$):

| Preset (`MVS.EASE.*`) | Control Points `(x1, y1, x2, y2)` | Signature Use |
|---|---|---|
| `kireOut` | `(0.06, 0.88, 0.12, 1.00)` | Japanese *Moji-PV* ultra-sharp snap + long razor glide |
| `expoOut` | `(0.16, 1.00, 0.30, 1.00)` | Hero headline / card arrival |
| `tameTsume` | `(0.86, 0.00, 0.08, 1.00)` | *Sakuga* whip: 40% tension hold → 2-frame whip → 50% settle |
| `studioInOut` | `(0.76, 0.00, 0.16, 1.00)` | Buck / Ordinary Folk camera & layout morph |
| `appleCam` | `(0.45, 0.00, 0.20, 1.00)` | Smooth product framing push |
| `uiSnapOut` | `(0.22, 1.00, 0.36, 1.00)` | Highlight pill, cursor click, tooltip |
| `quadInExact` | `(0.333, 0.00, 0.667, 0.333)` | Exact $y = t^2$ gravity acceleration into a cut |

- **Newton-Raphson Solver**: On Canvas/WebGL, never approximate cubic-beziers with `t*t*(3-2*t)`. Evaluate exact parametric curves with `MVS.cubicBezier(x1, y1, x2, y2)(t)`.

---

## 3. Killing "AI Tells": Organic *Yoin* & Match-Velocity Cuts

1. **Ban Shared `Math.sin(t)` Floating**: Floating every element on `sin(t)` makes the entire scene pump synchronously (the #1 AI motion tell). Instead:
   - Apply **container-level *Yoin* (余韻) drift**: a continuous `1.000 → 1.028` logarithmic camera push (`MVS.expZoom(1.0, 1.028, p)`) across every scene hold so zero frames are dead-static.
   - For floating nodes, use **`MVS.idleNoise(t, index, 0.42)`** — 3 incommensurable harmonics (`1, φ, √2`) decorrelated by the golden angle (`137.5°`).
2. **Logarithmic Zoom (`MVS.expZoom`)**: Linear `lerp(1, 8, p)` rushes at `1→2` and crawls at `7→8`. Optical screen-space speed stays constant only under exponential interpolation: $S(p) = S_0 (S_1/S_0)^{e(p)}$.
3. **Velocity-Matched Cuts ($C^1$ Continuity)**: Never cut between two static states with a lazy cross-dissolve. Either:
   - **Cut on the Beat at Peak Velocity** (*Cut-the-Curve*): Scene A accelerates out (`quadInExact`) and Scene B enters already moving (`expoOut`) along the same vector; OR
   - Use **`MVS.renderTimeline`** (`whip` Kire slash wipe or `portal` logarithmic zoom-through).
4. **Area-Preserving Squash & Stretch (`MVS.squashStretch`)**: When fast shapes deform along velocity, enforce $s_\parallel \cdot s_\perp = 1$ (e.g. `1.25 × 0.80 = 1.00`) so perceived mass never inflates.

---

## 4. Perceptual Color Science (OKLCH) & Studio Shading

Linear RGB/HSL interpolation between complementary hues (e.g. royal blue `#1D4ED8` → warm amber `#F59E0B`) collapses chroma through a **muddy gray midpoint**.

1. **OKLCH Gradients & Palettes (`MVS.oklch(L, C, H)`, `MVS.mixOklch`)**:
   - Interpolating lightness `L`, chroma `C`, and hue `H` in Björn Ottosson's OKLCH space preserves luminosity and saturation across every gradient stop.
   - **60 / 30 / 10 Rule**: 60% background/surface (`C ≤ 0.04`), 30% neutral structure/ink, 10% single high-chroma focal accent (`C ∈ [0.16, 0.24]`).
2. **Kurzgesagt / Editorial Hue-Shifted Shadows (`MVS.studioShadePair`)**:
   - Never shade colored surfaces by adding pure black `rgba(0,0,0,0.4)`. Shift shadows `+15°..24°` toward **cool indigo (`275°`)** and highlights toward **warm cream (`85°`)**.
3. **Linear / Apple Dark-Mode Elevation**:
   - In dark themes (`L = 0.14` background), depth comes from **stepped surface lightness** (`L = 0.19` card, `L = 0.24` active pill) + a **1px zenithal border** (`rgba(255,255,255,0.10)`) — never heavy dark drop-shadows on a black background.

---

## 5. Optical & Multilingual Typography (Latin, FR, ZH, JA, KR)

1. **Hierarchy Ratio ≥ 2.2×**: Hero/Metric (`72–120px`, weight `800`, tracking `-0.03em`) vs Subtitle/Body (`24–34px`, weight `500`) vs Kicker/Mono Label (`14–18px`, weight `700`, tracking `+0.08em` uppercase).
2. **`tabular-nums` Lock**: Any animated counter, timestamp, percentage, or axis label MUST set `font-variant-numeric: tabular-nums` (or monospace font) so digits never jitter horizontally.
3. **Critical CJK Rules (Chinese `中英混排`, Japanese `文字PV`, Korean `네모꼴`)**:
   - **NEVER use `ch` units for CJK line widths**: `1ch` equals the advance width of ASCII `"0"` (`~0.55em`), cutting CJK lines to half their intended width! Use `ic` / `em` (`max-width: 16em`) or `MVS.drawTextAutoFit`.
   - **Chinese (`zh-CN` / `zh-TW`)**: `Noto Sans SC` / `Source Han Sans SC`, optical scale compensation (`CJK 1.0×` paired with `Latin 0.88–0.92×` + `0.15em` Pangu spacing around inline numbers/English), never italicize CJK glyphs.
   - **Japanese (`ja`)**: `Noto Sans JP` + `line-break: strict; word-break: auto-phrase` (*Kinsoku Shori* — never start a line with `。、」！？」っゃゅょ`). In *Moji-PV* kinetic layouts, scale Kanji `1.8×` vs Hiragana particles `0.55×` (7:2:1 contrast).
   - **Korean (`ko`)**: `Pretendard Variable` or `Noto Sans KR`, **`word-break: keep-all`** (mandatory so Hangul eojeol words don't split mid-syllable), `line-height: 1.45–1.58`, and **NEVER `text-align: justify`** (creates wide white rivers between Hangul blocks).
