---
name: video-qa
description: >-
  QA and finishing gate for ANY rendered video (generated or not): probe specs against
  expectations (duration, fps, resolution, codec, pix_fmt, audio), detect discontinuities
  (pops, mono-frame flashes, off-by-one cuts, frozen segments) without watching, normalize
  loudness to −14 LUFS and tag the color matrix with an audio-only re-encode, generate tiled
  contact sheets and consecutive-frame strips for visual review, run a structured critic
  pass with a scoring rubric, and verify render determinism. Use whenever the user asks to
  check, verify, audit, review, diagnose, normalize, or prep a video for publishing —
  MP4/WebM/MOV — or when a video "looks off" and they want to know what's wrong before
  re-rendering.
---

# Video QA — the release gate

A video isn't done when it renders; it's done when it's been probed, gated, SEEN on a
contact sheet, and finished. This skill works on any file, independent of how it was made.

Order matters: **programmatic checks first** (objective, seconds), **eyes second**
(subjective, expensive). Eyes miss exactly what machines catch — a mono-frame flash, a cut
one frame late, an element that silently vanished — and machines miss taste.

## 1. Probe the facts (never trust assumptions)

```bash
scripts/probe.sh video.mp4
```

Compare every value against what was ordered (timeline, brief, platform spec):

| Check | Expected |
|---|---|
| duration | ordered duration ± 0.1s |
| fps / resolution | ordered fps / W×H |
| codec / pix_fmt | h264 / yuv420p (yuvj420p = full-range variant, usually fine) |
| audio stream | present iff the video should have sound |
| integrated loudness | −14 ± 2 LUFS (social platforms normalize near −14) |

Any mismatch is a bug in the render, not a taste question. Fix upstream, re-render.

## 2. Discontinuity gate — before anyone watches

```bash
node scripts/disco.mjs video.mp4 --cuts "3.0,5.4,7.2"   # cut list = scene starts, in seconds
node scripts/disco.mjs video.mp4 --cuts "..." --json     # machine-readable report
```

Reads the video small and gray, measures frame-to-frame change, and audits:

- **Cuts** — every declared cut must spike exactly at its frame. `OFF-BY-±1` is a real bug
  (float scene math: 9 − 7.2 = 1.7999… shifts a cut by a frame); `NO-SPIKE` means the cut
  never happened.
- **Off-list spikes** — pops, mono-frame flashes, encoder drops. Each one needs a look.
- **Frozen runs** — stretches with near-zero motion. Legit in slow films; fatal where
  motion is expected (a stuck spring or a NaN-valued element reads as a frozen frame).

Exit code 1 = gate failed. Without `--cuts`, every cut reads as a spike — always pass the
cut list when you have one (the timeline's scene starts).

## 3. Finishing: loudness + color (audio-only re-encode, seconds)

```bash
node scripts/post.mjs video.mp4 video_final.mp4                               # −14 LUFS, linear
node scripts/post.mjs raw.mp4 final.mp4 --gain 9.6dB --limit 0.70 --matrix 601  # quiet synth mix, canvas render
```

- **2-pass LINEAR loudnorm** from measured values. Single-pass `loudnorm` is dynamic and
  pumps on sustained material. A quiet mix (WebAudio synth renders sit near −23 LUFS)
  gets a pre-gain first, with a limiter that only touches transients.
- **`--matrix` tags the color matrix without re-encoding.** Canvas→x264 pipelines convert
  RGB→YUV in BT.601 and rarely label it; untagged, HD players assume BT.709 and every hue
  shifts. Tag what the encoder actually did; verify once by decoding a known frame both
  ways against the source RGB.
- Video is stream-copied; `+faststart` is always set.

Never normalize by ear with a volume filter — LUFS is the unit platforms actually use.

## 4. Look at it: contact sheet + strips

```bash
scripts/contact_sheet.sh video.mp4 contact.png 2 8x    # 1 tile / 0.5s, 8 columns
# 12 consecutive frames around a delicate moment (transition at T):
ffmpeg -y -ss <T-0.2> -i video.mp4 -frames:v 12 -vf "scale=320:-1,tile=6x2" strip_T.png
```

Read the sheet as a filmstrip: rhythm visible? cuts on the beat grid? any scene empty or
overcrowded? Contact sheets hide motion quality — always WATCH the full video at least
once before signing off. Use PNG, not JPEG, for anything you will measure.

## 5. Critic pass (builder ≠ judge)

Review the RENDER — not the source, not intentions — scoring each /10:

1. **Hook** — boldest frame in the first 2 seconds?
2. **Readability** — text ≥ minimum size, inside safe zones, no overlap/cutoff, holds long enough?
3. **Motion** — no linear easing, multi-property entrances, stagger, exits faster than entrances?
4. **Sync** — events land on the beat/word grid?
5. **Style consistency** — one palette family, one type system, unified transitions?
6. **Sound** — VO clear, music ducked, target loudness, no clipping?

Protocol: log the 3 worst defects WITH timestamps → fix exactly those → re-render →
re-score. 3–5 rounds to ≥8/10 everywhere is normal. Run the critic in a fresh context
(or subagent): the author of the code is the worst reviewer of the code.

**Anything longer than ~20s: one fresh-context critic per act.** Give each subagent only
its act — dense contact sheets (10–15 fps, 3×4 tiles), a few full-res frames, the formula
mapping tile index → timestamp, and what is intentional (cuts, style choices) so it
doesn't flag them. Have it grade P0 (breaks the illusion) → P1 (visible) → P2 (finish) →
P3 (nitpick). Then apply the rule of evidence to every claim before fixing. If the same
defect class comes back round after round, the generator is missing a structural rule —
fix the class, not the instance.

## 6. Determinism (for generated/repeatable videos)

```bash
# two fingerprints of the same input must match byte-for-byte
ffmpeg -i video.mp4 -map 0:v -f framemd5 - | sha1sum
```
Same pipeline, same input → different hash means hidden wall-clock time, unseeded
randomness, or accumulated state: fix the generator, don't "reroll". For seek()-contract
sources, motion-video's `stills.mjs --determinism` does the same per instant in seconds.

## 7. Delivery checklist

```
video.mp4        H.264, yuv420p, +faststart, −14 LUFS, color matrix tagged
poster.png/jpg   the hook frame
contact.png      the 2 fps filmstrip
sources          whatever generates the video (editable > final)
gates            disco PASS, probe matches, determinism identical
```
Tell the user exactly which file to edit to change one thing, and the re-render command.

## Rule of evidence

When a reviewer (human or vision model) claims a defect, confirm it with a measurement
(full-res frame crop, pixel sample, player inspection, or the generating code's own
metrics) before "fixing" a non-bug. Reviewers hallucinate margins far more often than
renders clip text. Recurring false-positive classes:

- **Sampling** — at 10–15 fps tiles, a real pop can hide between tiles and an animation
  can look like a pop. Decide at full frame rate.
- **Tile padding** — the empty cells of the last contact sheet read as "black frames".
- **JPEG sheets** — compression smudges small counters and thin strokes into "wrong"
  values. Measure on PNG frames extracted from the video.
