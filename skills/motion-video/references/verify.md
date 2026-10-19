# Verify — checks, contact sheets, the critic loop

The model cannot see or hear. Without a render→inspect loop you are shipping blind, and
blind-shipped code videos look exactly like that. **Never ship unverified.**

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
motion quality, videos hide composition drift.

## 3. The critic loop (builder ≠ judge)

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

## 4. Determinism tests (before trusting the pipeline)

Trust measurements over impressions — including your own visual review: when a critic
(vision model or human) claims a geometry defect like "text is clipped", confirm it with
`ctx.measureText()` / `getImageData()` in the page before "fixing" a non-bug. In testing,
a reviewer claimed a fitted title was clipped when measurement showed 76px of margin.

- **Re-render and compare**: render twice; compare frame hashes
  (`ffmpeg -i out/video.mp4 -map 0:v -f framemd5 -` twice, diff). Identical input must give
  identical output — otherwise there's hidden wall-clock or unseeded randomness.
- **A-B-A**: change one timeline number, render, revert, render — only the intended segment
  may differ.
- **Freeze probe**: `?t=12.5` style URL param (canvas engine) → screenshot the same instant
  twice; must be pixel-identical, and seeking backwards must repaint correctly (the classic
  accumulation bug: state that adds every frame instead of being recomputed from t).

## 5. Text & layout self-checks (in the page, before rendering everything)

```js
// In seek(): after drawing, verify text boxes are inside bounds and don't collide
const boxes = []; // collect {x,y,w,h,label} while drawing
for (const a of boxes) for (const b of boxes) {
  if (a !== b && !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y))
    console.error('OVERLAP at t=' + t, a.label, b.label);
}
```
Run it across all frames at 2fps in the renderer loop's console output; overlaps and
cut-offs are the most common defect in generated layouts.

## 6. Multi-aspect check

Each aspect ratio gets its own contact sheet + full watch. Common failure: recomposed
layouts push captions into the 9:16 UI-safe zones or shrink hero type below minimum.

## 7. Delivery checklist

After the probe, run the loudness pass (renders mux the raw mix; normalize as an
audio-only re-encode — video stream is copied, so it takes seconds):

```bash
ffmpeg -i out/video.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k out/video_norm.mp4 && mv out/video_norm.mp4 out/video.mp4
```

```
out/video.mp4      H.264, yuv420p, +faststart, −14 LUFS audio
out/poster.png     frame at the hook (or the single best frame)
out/contact.png    the 2fps contact sheet
video/brief.md  video/timeline.json  video/index.html (+ assets)
```

Report to the user: what was verified (probe numbers), what the critic fixed, and the exact
one-line edit → re-render loop for changes ("edit timeline.json scene 3 text →
re-run render command").
