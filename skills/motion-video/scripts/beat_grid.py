#!/usr/bin/env python3
"""beat_grid.py — BPM + beat grid of an EXISTING audio track, as JSON.

Usage:  python beat_grid.py music.mp3 [beats.json]

Output: { "bpm": 120.0, "beats": [0.0, 0.5, ...], "downbeats": [...], "duration": 91.3 }

Rule of thumb: for music you GENERATE, don't analyze — generate it on a declared BPM grid
in timeline.json instead. Use this only to sync visuals to a provided track, and
sanity-check the detected BPM against the track's published tempo before trusting it.
"""
import json
import sys

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "beats.json"

    try:
        import librosa
    except ImportError:
        print("librosa missing. Install:  pip install librosa numpy")
        sys.exit(1)

    y, sr = librosa.load(src, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo.item() if hasattr(tempo, "item") else tempo)
    beats = [round(float(t), 4) for t in librosa.frames_to_time(beat_frames, sr=sr)]
    if not beats:
        print("no beats detected — is this a music track?")
        sys.exit(1)

    # Downbeat phase: try offsets 0..3, keep the one whose beats carry the most onset energy
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    hop = 512
    best_off, best_e = 0, -1.0
    for off in range(4):
        subset = beats[off::4]
        if not subset:
            continue
        e = sum(onset_env[min(int(t * sr / hop), len(onset_env) - 1)] for t in subset) / len(subset)
        if e > best_e:
            best_e, best_off = e, off

    data = {
        "bpm": round(bpm, 2),
        "beats": beats,
        "downbeats": beats[best_off::4],
        "duration": round(len(y) / sr, 3),
        "source": src,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"✓ {out}: bpm={data['bpm']} beats={len(beats)} downbeat_offset={best_off} "
          f"duration={data['duration']}s")

if __name__ == "__main__":
    main()
