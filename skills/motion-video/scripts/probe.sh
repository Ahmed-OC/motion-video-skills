#!/usr/bin/env bash
# probe.sh — stream facts + integrated loudness of a rendered video.
# Compare each value against timeline.json; any mismatch is a bug (see verify.md).
#
# Usage: ./probe.sh out/video.mp4
set -euo pipefail

in=${1:?usage: probe.sh video.mp4}

echo "== video stream =="
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,duration \
  -of default=noprint_wrappers=1 "$in"

echo "== audio stream =="
if ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels \
     -of default=noprint_wrappers=1 "$in" | grep -q .; then
  ffprobe -v error -select_streams a:0 \
    -show_entries stream=codec_name,sample_rate,channels \
    -of default=noprint_wrappers=1 "$in"
  echo "== integrated loudness (target −14 LUFS, TP −1.5) =="
  ffmpeg -hide_banner -i "$in" -af ebur128 -f null - 2>&1 \
    | awk '/Integrated loudness/{getline; print}'
else
  echo "none (expected only if timeline.audio is silent)"
fi

echo "== container duration =="
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$in"
