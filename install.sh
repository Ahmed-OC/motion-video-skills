#!/usr/bin/env bash
# motion-video-skills — installer (curl | bash)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Ahmed-OC/motion-video-skills/main/install.sh | bash
#   curl -fsSL ... | bash -s -- ~/.agents/skills      # explicit destination
#   curl -fsSL ... | bash -s -- ./.agents/skills      # project-local install
#
# Default destination: ~/.agents/skills (the cross-agent standard directory,
# read natively by ZCode and symlinked/supported by Claude Code, Cursor, Codex,
# Cline, Amp, Augment and most agent CLIs).
set -euo pipefail

REPO="Ahmed-OC/motion-video-skills"
BRANCH="main"
DEST="${1:-$HOME/.agents/skills}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▸ Downloading github.com/$REPO ($BRANCH)…"
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TMP/repo.tgz"
tar -xzf "$TMP/repo.tgz" -C "$TMP"
SRC="$TMP/${REPO#*/}-$BRANCH/skills"
if [ ! -d "$SRC" ]; then
  echo "✗ archive does not contain a skills/ folder — repo layout changed?" >&2
  exit 1
fi

mkdir -p "$DEST"
installed=()
for dir in "$SRC"/*/; do
  name="$(basename "$dir")"
  rm -rf "$DEST/$name"          # idempotent: replaces previous version cleanly
  cp -r "$dir" "$DEST/$name"
  installed+=("$name")
  echo "  ✓ $DEST/$name"
done

echo "▸ Installed: ${installed[*]}"
echo "  Restart your agent, then try: « fais-moi une vidéo motion design de 15 s, avec musique »"
echo "  Render prerequisites if missing: node ≥18 · npm i -D playwright && npx playwright install chromium · ffmpeg"
