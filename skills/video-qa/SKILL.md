---
name: video-qa
description: >-
  QA and finishing gate for ANY rendered video (generated or not): probe specs against
  expectations (duration, fps, resolution, codec, pix_fmt, audio), measure integrated
  loudness and normalize to −14 LUFS with an audio-only re-encode, generate tiled contact
  sheets and consecutive-frame strips for visual review, run a structured critic pass with
  a scoring rubric, and verify render determinism. Use whenever the user asks to check,
  verify, audit, review, diagnose, normalize, or prep a video for publishing — MP4/WebM/MOV —
  or when a video "looks off" and they want to know what's wrong before re-rendering.
---

# Video QA — the release gate

A video isn't done when it renders; it's done when it's been probed, SEEN on a contact
sheet, and normalized. This skill works on any file, independent of how it was made.

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

## 2. Loudness: measure → normalize (audio-only, seconds)

```bash
# measure
ffmpeg -hide_banner -i video.mp4 -af ebur128 -f null - 2>&1 | awk '/Integrated loudness/{getline; print}'

# normalize to −14 LUFS (video stream copied, no re-encode)
ffmpeg -i video.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k video_norm.mp4 \
  && mv video_norm.mp4 video.mp4
```

Never normalize by ear with a volume filter — LUFS is the unit platforms actually use.

## 3. Look at it: contact sheet + strips

```bash
scripts/contact_sheet.sh video.mp4 contact.png 2 8x    # 1 tile / 0.5s, 8 columns
# 12 consecutive frames around a delicate moment (transition at T):
ffmpeg -y -ss <T-0.2> -i video.mp4 -frames:v 12 -vf "scale=320:-1,tile=6x2" strip_T.png
```

Read the sheet as a filmstrip: rhythm visible? cuts on the beat grid? any scene empty or
overcrowded? Contact sheets hide motion quality — always WATCH the full video at least
once before signing off.

## 4. Critic pass (builder ≠ judge)

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

## 5. Determinism (for generated/repeatable videos)

```bash
# two fingerprints of the same input must match byte-for-byte
ffmpeg -i video.mp4 -map 0:v -f framemd5 - | sha1sum
```
Same pipeline, same input → different hash means hidden wall-clock time, unseeded
randomness, or accumulated state: fix the generator, don't "reroll".

## 6. Delivery checklist

```
video.mp4        H.264, yuv420p, +faststart, −14 LUFS
poster.png/jpg   the hook frame
contact.png      the 2 fps filmstrip
sources          whatever generates the video (editable > final)
```
Tell the user exactly which file to edit to change one thing, and the re-render command.

## Rule of evidence

When a reviewer (human or vision model) claims a geometry defect ("text is clipped",
"elements overlap"), confirm with a measurement (player inspection, pixel sample, or the
generating code's own metrics) before "fixing" a non-bug. Reviewers hallucinate margins
far more often than renders clip text.
