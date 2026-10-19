#!/usr/bin/env bash
# contact_sheet.sh — tiled thumbnails of a rendered video, for visual review.
# The filmstrip view exposes rhythm, cut placement and scene balance at a glance.
#
# Usage:  ./contact_sheet.sh out/video.mp4 [out/contact.png] [fps=2] [tile=6x]
#   fps=2   → one thumbnail every 0.5s (default; match to your beat grid)
#   tile=6x → 6 columns, rows auto (or "4x4" fixed grid)
# Vertical/9:16 videos: try  tile=5x  for a taller sheet.
set -euo pipefail

in=${1:?usage: contact_sheet.sh video.mp4 [out.png] [fps] [tile]}
out=${2:-out/contact.png}
fps=${3:-2}
tile=${4:-6x}

mkdir -p "$(dirname "$out")"
# ffmpeg 7+ removed auto-rows ("Nx") from the tile filter: compute rows from duration
cols=${tile%%x*}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
n=$(awk -v d="$dur" -v f="$fps" 'BEGIN{printf "%d", int(d*f)+2}')
rows=$(awk -v n="$n" -v c="$cols" 'BEGIN{r=int(n/c)+ (n%c>0?1:0); if(r<1)r=1; print r}')
ffmpeg -y -hide_banner -loglevel error -i "$in" \
  -vf "fps=${fps},scale=360:-1,tile=${cols}x${rows}" -frames:v 1 "$out"
echo "✓ ${out} (1 tile every $(awk "BEGIN{print 1/$fps}")s)"

# Tip — 12 consecutive frames around a delicate moment (transition/drop at T seconds):
#   ffmpeg -y -ss <T-0.2> -i out/video.mp4 -frames:v 12 -vf "scale=320:-1,tile=6x2" out/strip.png
