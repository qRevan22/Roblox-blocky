#!/usr/bin/env bash
# Look-dev stills: bundle once, render the given frames of a sharp composition at --scale (default 0.4) through the GPU
# lock, then tile them side by side into out/stills_<tag>.jpg (one image to look at).
# usage: bash tools/stills.sh <tag> <frame> [frame...]     (env SCALE=0.4, COMP=BlockyTest, PYTHON=...)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/tools/pick_python.sh"
pick_python || exit 2
SCR="${BLOCKY_SCRIPTS:-}"
for c in "$ROOT/scripts" "$ROOT/../scripts"; do [ -z "$SCR" ] && [ -f "$c/gpu_lock.py" ] && SCR="$(cd "$c" && pwd)"; done
[ -n "$SCR" ] || { echo "gpu_lock.py not found: copy the skill's scripts/ folder next to the project or set BLOCKY_SCRIPTS" >&2; exit 2; }
SCALE="${SCALE:-0.4}"
COMP="${COMP:-BlockyTest}"
TAG="${1:?usage: stills.sh <tag> <frame> [frame...]}"; shift
[[ $TAG =~ ^[A-Za-z0-9_-]+$ ]] || { echo "tag may use only letters, digits, _ and -" >&2; exit 2; }
for f in "$@"; do [[ $f =~ ^[0-9]+$ ]] || { echo "frames must be numbers" >&2; exit 2; }; done
cd "$ROOT"
[ -d node_modules ] || { echo "node_modules not found: run npm ci first" >&2; exit 2; }
mkdir -p out/stills
if [ -e "out/stills_${TAG}.jpg" ] || compgen -G "out/stills/${TAG}_f*.jpg" >/dev/null; then echo "tag ${TAG} already used: every still is kept, pick a new tag" >&2; exit 1; fi
npx --no-install remotion bundle src/index.ts --out-dir=build >/dev/null
ins=()
for f in "$@"; do
  o="out/stills/${TAG}_f$(printf %03d "$f").jpg"
  "${PY[@]}" -I "$SCR/gpu_lock.py" -- npx --no-install remotion still build "$COMP" "$o" --frame="$f" --scale="$SCALE" --gl=angle --timeout=240000 --log=error
  ins+=(-i "$o")
done
if [ "$#" -gt 1 ]; then
  ffmpeg -v error -y "${ins[@]}" -filter_complex "hstack=inputs=$#" "out/stills_${TAG}.jpg"
else
  cp "${ins[1]}" "out/stills_${TAG}.jpg"
fi
echo "out/stills_${TAG}.jpg"
