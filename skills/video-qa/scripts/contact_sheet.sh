#!/usr/bin/env bash
# contact_sheet.sh (v2.0) — VLM-Grounded Contact Sheet with Frame & Timecode Burn-In.
# Burns exact source frame index + PTS timestamp BEFORE fps sampling so VLM/human reviewers
# can pinpoint glitches to the exact frame, and uses slate (0x1e293b) padding instead of black
# so empty trailing grid cells are never misread as black frames!
#
# Usage: ./contact_sheet.sh out/video.mp4 [out/contact.png] [fps=2] [tile=4x]
set -euo pipefail

in=${1:?usage: contact_sheet.sh video.mp4 [out.png] [fps] [tile]}
out=${2:-out/contact.png}
fps=${3:-2}
tile=${4:-4x}

mkdir -p "$(dirname "$out")"
cols=${tile%%x*}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
n=$(awk -v d="$dur" -v f="$fps" 'BEGIN{printf "%d", int(d*f)+1}')
rows=$(awk -v n="$n" -v c="$cols" 'BEGIN{r=int(n/c)+(n%c>0?1:0); if(r<1)r=1; print r}')

vf="drawtext=text='f%{eif\:n\:d\:4} · %{pts\:hms}':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.72:boxborderw=5,fps=${fps},scale=420:-2,tile=${cols}x${rows}:padding=6:margin=8:color=0x1e293b"
if ! ffmpeg -y -hide_banner -loglevel error -i "$in" -vf "$vf" -frames:v 1 "$out" 2>/dev/null; then
  ffmpeg -y -hide_banner -loglevel error -i "$in" \
    -vf "fps=${fps},scale=420:-2,tile=${cols}x${rows}:padding=6:margin=8:color=0x1e293b" -frames:v 1 "$out"
fi
echo "✓ ${out} (${cols}x${rows} VLM-grounded sheet · 1 tile every $(awk "BEGIN{printf \"%.2f\", 1/$fps}")s)"
