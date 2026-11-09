# Verify — gates, contact sheets, the critic loop

The model cannot see or hear. Without a render→inspect loop you are shipping blind, and
blind-shipped code videos look exactly like that. **Never ship unverified.**

Correctness is shifted left: **programmatic gates first** (objective, seconds, catchable),
**eyes second** (subjective, expensive). Every defect class should be either
unrepresentable in the generator (see motion-video SKILL.md, "the generator contract") or
caught by a gate below before a human ever watches.

## 0. Source-level gates (generated videos — before any full render)

### 0.1 Fail loud: canvas accepts NaN and draws NOTHING

An element whose value is NaN/Infinity silently vanishes — no error, no warning; you only
notice it in review, if at all. Validate parameters at init, throw on non-finite:

```js
// Evaluate every parametric helper at sample points once, at init.
function auditFinite(name, fn, xs) {
  for (const x of xs) {
    const v = fn(x);
    if (!Number.isFinite(v)) throw new Error(`${name}(${x}) = ${v} — non-finite`);
  }
}
auditFinite('spring.soft',   SPRINGS.soft,   [0.001, 0.1, 0.5, 1, 2, 5]);
auditFinite('spring.ui',     SPRINGS.ui,     [0.001, 0.1, 0.5, 1, 2, 5]);
auditFinite('scaleAt(0.9)',  (t) => scaleAt(0.9, t), [0, 0.5, 1]);
```

Known trap: the underdamped spring formula divides by `ω_d = √(1−ζ²)` — at **ζ = 1** it
produces NaN for every t > 0. Use the critically-damped branch (`1 − e^(−ωt)(1+ωt)`) for
ζ ≥ 1 (fixed in `motion-craft.md`'s spring and in `assets/seek-template.html`).

### 0.2 Scene invariants (TDD for video)

Next to each scene, declare predicates that must hold at every t of that scene, and assert
them across a headless sweep:

```js
const INVARIANTS = [
  { from: 13.2, to: 19.8, ok: (s) => s.phoneVisible,  what: 'phone visible during the list' },
  { from: 29.4, to: 33.0, ok: (s) => s.feetPlanted,   what: 'feet on the ground' },
  { from: 0,    to: 99,   ok: (s) => s.textInSafeZone, what: 'no text outside safe zones' },
];
// after seek(t) paints frame t: assert(INVARIANTS.filter(v => t >= v.from && t <= v.to).every(v => v.ok(state)))
```

### 0.3 The seek sweep + stills harness

```bash
node scripts/stills.mjs --file video/index.html --scan                     # every frame seeked; JS errors surface
node scripts/stills.mjs --file video/index.html --times 1.0,4.5 --out out/qa   # instants to PNG
node scripts/stills.mjs --file video/index.html --times 1.0,4.5 --determinism  # fresh-page double render, byte-compared
```

One browser, N instants — iterate on poses/layout at a fraction of render cost.
`--determinism` renders each instant twice on **fresh pages**: accumulated state (something
added every frame instead of recomputed from t) survives same-page re-seeks, a fresh page
doesn't.

## 1. Programmatic probe (every render)

```bash
scripts/probe.sh out/video.mp4
```

Check against timeline.json — any mismatch is a bug:

| Check | Expected |
|---|---|
| duration | timeline.duration ± 0.1s |
| fps | timeline.fps |
| resolution | timeline.width × height |
| codec / pix_fmt | h264 / yuv420p |
| audio stream | present iff audio ≠ none |
| integrated loudness | −14 ± 2 LUFS |

## 2. Contact sheets + a full watch (every render)

```bash
scripts/contact_sheet.sh out/video.mp4              # 2fps thumbnails tiled → out contact.png
scripts/contact_sheet.sh out/video.mp4 out/contact_9x16.png 2 3x   # denser for shorts
# 12 consecutive frames around a delicate moment (transition, drop at 8.0s):
ffmpeg -y -ss 7.8 -i out/video.mp4 -frames:v 12 -vf "select='not(mod(n\,1))',scale=320:-1,tile=6x2" out/strip_8s.png
```

Look at the sheet as a *filmstrip*: does rhythm show? Are cuts on the grid? Does any scene
look empty or overcrowded? Then WATCH the video end to end at least once — sheets hide
motion quality, videos hide composition drift. Use PNG for anything you will measure
(JPEG smudges small counters into "wrong" values).

## 3. The discontinuity gate — the cut list is the test

```bash
# video-qa's scripts/ — exit 1 on failure, so it can gate a pipeline
node skills/video-qa/scripts/disco.mjs out/video.mp4 --cuts "3.0,5.4,9.0"
node skills/video-qa/scripts/disco.mjs out/video.mp4 --cuts "..." --json
```

Reads the video at 96×170 gray, computes the mean absolute diff between consecutive
frames, and reports:

- **Cut audit** — every declared cut must produce one diff spike exactly at its expected
  frame. `OFF-BY-±1` is a real bug: float scene math (`9 − 7.2 = 1.7999…`) once shifted a
  cut a frame late. `NO-SPIKE` = the cut never happened.
- **Off-list spikes** — pops, mono-frame flashes, encoder drops. Each needs a look.
- **Frozen runs** (> min seconds of near-zero motion) — legit in slow films; fatal where
  motion is expected. A stuck spring or a NaN-dead element reads as a frozen frame.

Without `--cuts`, every cut is reported as a spike: the timeline's scene starts are the
cut list — pass them.

## 4. The element lifecycle audit (per element, across shots)

The per-scene watch finds broken things; the **lifecycle pass** finds incoherent things.
List every recurring element (finger, card, notification, mascot, counter, caption bar…)
and follow each one across EVERY shot it appears in, checking seven calibrations:

| Calibration | Anchored numbers |
|---|---|
| **Entrance** | caused (tap / spoken word / beat), animated ≥3 frames, staggered after its container — never before it |
| **Hold / reading time** | text ≥ 0.3s/word + 0.5s · number/figure ≥ 0.9s AFTER settling (a counter still moving at the cut was never read) · feedback mark (✓ ripple stamp) 0.3–0.45s |
| **Alive during hold** | micro-motion (breathing, pulse, progress) or intentional stillness; no idle jitter on props |
| **Transit velocity** | half the frame in <0.2s = reads as a pop · <15% of frame per second = sluggish · arcs, one easing family |
| **Exit** | purposeful, faster than entrance, exactly when its job is done or its successor arrives · never mid-read, never lingering dead |
| **Scale & identity** | sized to importance (one focal point at a time) · identical proportions in every appearance · physically plausible (hand < phone) |
| **Chaining** | cause precedes effect frame-exactly: tap → response · swipe → next card · arrival → reaction · nothing before its container |

Why a per-element pass: these defects are **invisible scene-by-scene**. A checkmark that
leaves after 0.2s is fine inside its scene and fatal when you realize the viewer never
read it; a counter still animating at the cut is invisible per-scene and obvious when you
follow only the counter. Real cases from production: confetti bursting 0.6s before the
event that triggers it (chaining), a stamp landing on the card that was never swiped
(chaining), a counter reaching its final value 2 frames before the cut (hold), a finger
resting 0.55s on the brand it was about to tap (entrance/hold of the *occluded* element),
a thumb bigger than the phone (scale).

Programmatic counterparts where possible:
- **Presence windows** are scene invariants (§0.2): "card visible t∈[a,b]", "check holds
  ≥0.3s after appearing".
- **Hold times** are assertable from the timeline: for every caption/text, hold ≥
  0.3s×words + 0.5s; for every counter, final value must be stable for ≥0.9s before the
  scene ends.
- **Transit velocity** comes free from `disco.mjs`: a spike pair at frames [a, b] with
  nothing between means the element crossed the frame in b−a frames — compute px/frame
  from the crops if it matters.
- **Position drift during holds**: sample the element's bounding box at two instants of
  its hold; if it moved without an intended transition, the anchor is unanchored.

## 5. The critic loop (builder ≠ judge)

After rendering, review the RENDER (not your code) against this rubric, scoring each /10:

1. **Hook** — boldest frame in the first 2s? First words on screen by 0.5s?
2. **Readability** — every text ≥ minimum size, inside safe zones, no overlap/cutoff,
   holds ≥ 1.4s?
3. **Motion** — no linear easing anywhere, entrances multi-property + staggered, exits
   faster, idle breathing present?
4. **Sync** — cuts/events land on the beat grid; caption pops match actual words?
5. **Style consistency** — one palette family, one type system, transitions unified?
6. **Sound** — VO clear, music ducked, −14 LUFS, no clipping, SFX on actions?

Protocol: log the 3 worst defects WITH timestamps → fix exactly those → re-render →
re-score. 3–5 rounds to reach ≥8/10 everywhere is normal and cheap (renders are minutes).
In agentic runs, do the critic pass in a fresh context (or a subagent) — the author of the
code is the worst reviewer of the code. Feed each found defect back as a written rule in
the project's notes so it never recurs.

**Films longer than ~20s: one fresh-context critic per act.** Give each subagent only its
act — dense contact sheets (10–15 fps, 3×4 tiles), a handful of full-res frames, the
formula mapping tile index → timestamp, and a list of what is INTENTIONAL (hard cuts,
style choices, deliberate holds) so it doesn't flag them. Defects graded P0 (breaks the
illusion) → P1 (visible) → P2 (finish) → P3 (nitpick). Then apply the rule of evidence to
every claim before fixing anything:

**Rule of evidence.** At 10–15 fps tile sampling, a real pop can hide between tiles and an
animation can read as a pop; contact-sheet padding reads as "black frames"; JPEG sheets
smudge small counters into "wrong" numbers. Confirm every claimed defect on a PNG frame
extracted at full resolution from the video (`ffmpeg -ss T -i out/video.mp4 -frames:v 1`),
crop to the zone, and measure (`ctx.measureText`, `getImageData`) — reviewers hallucinate
margins far more often than renders clip text. Validate on the render; a defect that
reappears round after round means the generator is missing a structural rule — fix the
class (one helper, one invariant), never the instance.

## 6. Determinism tests (before trusting the pipeline)

- **Per-instant, cheap**: `stills.mjs --determinism` (see 0.3) — each requested instant
  rendered twice on fresh pages, byte-compared.
- **Whole file**: render twice; compare frame hashes
  (`ffmpeg -i out/video.mp4 -map 0:v -f framemd5 -` twice, diff). Identical input must give
  identical output — otherwise there's hidden wall-clock or unseeded randomness.
- **A-B-A**: change one timeline number, render, revert, render — only the intended segment
  may differ.
- **Freeze probe**: `?t=12.5` style URL param (canvas engine) → screenshot the same instant
  twice; must be pixel-identical, and seeking backwards must repaint correctly (the classic
  accumulation bug: state that adds every frame instead of being recomputed from t).

Trust measurements over impressions — including your own visual review.

## 7. Multi-aspect check

Each aspect ratio gets its own contact sheet + full watch. Common failure: recomposed
layouts push captions into the 9:16 UI-safe zones or shrink hero type below minimum.

## 8. Finishing pipeline (loudness + color) & delivery

Renders mux the raw mix — normalize as an audio-only re-encode (video stream copied, so it
takes seconds):

```bash
node skills/video-qa/scripts/post.mjs out/video.mp4 out/final.mp4 --loud -14
# quiet synth mix (WebAudio renders sit near −23 LUFS): pre-gain + transient limiter, then linear
node skills/video-qa/scripts/post.mjs raw.mp4 final.mp4 --gain 9.6dB --limit 0.70 --matrix 601
```

- **2-pass LINEAR loudnorm** from measured values. The single-pass dynamic filter pumps on
  sustained material; linear mode applies one constant gain. A quiet mix can't reach −14
  under a true-peak ceiling alone — pre-gain lifts it, the limiter catches only the
  transients.
- **Color matrix tagging** (`--matrix 601|709`) labels the stream without re-encoding.
  Canvas→x264 pipelines convert RGB→YUV in BT.601 and almost never label it; untagged,
  HD players assume BT.709 and every hue shifts (validated by decoding one frame with each
  assumption and comparing against the source RGB — expect ~2 vs ~3 mean channel error).
  Check what the encoder did, then tag it.

```
out/video.mp4      H.264, yuv420p, +faststart, −14 LUFS, color matrix tagged
out/poster.png     frame at the hook (or the single best frame)
out/contact.png    the 2fps contact sheet
video/brief.md  video/timeline.json  video/index.html (+ assets)
gates              scan PASS · disco PASS (cut list) · probe matches · determinism identical
```

Report to the user: what was verified (gate outputs, probe numbers), what the critic fixed,
and the exact one-line edit → re-render loop for changes ("edit timeline.json scene 3 text
→ re-run render command").
