#!/usr/bin/env bash
# Render one version of a Short with motion blur, then QA it. Never overwrites an earlier version.
#
# usage: bash render.sh <N> [COMP] [FRAMES]
#   N       version number -> out/renders/v<N>.mp4, v<N>_contact_sheet.jpg, v<N>_qa.txt
#   COMP    the sub-frame composition (default BlockyTestSub; it must run at SUB x 30 fps, SUB = 4)
#   FRAMES  optional output-frame range "a-b" (e.g. 0-89 for the first 3 s); default = the whole composition
#
# Steps: typecheck -> bundle -> render the sub-frame composition through the GPU lock -> ffmpeg tmix (average every 4
# sub-frames, keep one) -> h264 crf 16 yuv420p 30 fps, no audio track -> 2 fps contact sheet -> flicker.py +
# analyze_pacing.py into v<N>_qa.txt.
#
# Needs on PATH: node/npx, ffmpeg, ffprobe, and Python 3 with numpy (found by tools/pick_python.sh; override with PYTHON=/path/to/python).
# The skill's scripts (gpu_lock.py, flicker.py, analyze_pacing.py) are found in ./scripts, ../scripts or $BLOCKY_SCRIPTS.
# env: CONC (render concurrency, default 8; use <= 3 for quick tests)
set -euo pipefail
N="${1:?usage: render.sh <version number> [COMP] [FRAMES a-b]}"
COMP="${2:-BlockyTestSub}"
FRAMES="${3:-}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/tools/pick_python.sh"
pick_python || exit 2
SCR="${BLOCKY_SCRIPTS:-}"
for c in "$ROOT/scripts" "$ROOT/../scripts"; do [ -z "$SCR" ] && [ -f "$c/gpu_lock.py" ] && SCR="$(cd "$c" && pwd)"; done
[ -n "$SCR" ] || { echo "gpu_lock.py not found: copy the skill's scripts/ folder next to this file or set BLOCKY_SCRIPTS" >&2; exit 2; }
SUB=4
NAME="${NAME:-v}"   # version name prefix: v1, v2 ... for tests; NAME=short_v for the full Short (short_v1 ...)
CONC="${CONC:-8}"
[[ $N =~ ^[0-9]+$ ]] || { echo "N must be a number" >&2; exit 2; }
[[ $NAME =~ ^[A-Za-z0-9_-]+$ ]] || { echo "NAME may use only letters, digits, _ and -" >&2; exit 2; }
[[ -z $FRAMES || $FRAMES =~ ^[0-9]+-[0-9]+$ ]] || { echo "FRAMES must look like 0-89" >&2; exit 2; }
[[ $CONC =~ ^[0-9]+$ ]] || { echo "CONC must be a number" >&2; exit 2; }
OUTD="$ROOT/out/renders"
OUT="$OUTD/${NAME}$N.mp4"
mkdir -p "$OUTD"
if [ -e "$OUT" ] || [ -e "$OUTD/${NAME}${N}_sub.mp4" ]; then echo "${NAME}$N already exists: every render is kept, pick a new version number" >&2; exit 1; fi
cd "$ROOT"
[ -d node_modules ] || { echo "node_modules not found: run npm ci first" >&2; exit 2; }
t0=$(date +%s)
npx --no-install tsc --noEmit
npx --no-install remotion bundle src/index.ts --out-dir=build >/dev/null
SUBV="out/${NAME}${N}_sub.mp4"
RANGE=()
NOUT=""
if [ -n "$FRAMES" ]; then
  a=$((10#${FRAMES%-*})); b=$((10#${FRAMES#*-}))   # base 10: 010 is ten, not octal
  RANGE=(--frames="$((a * SUB))-$((b * SUB + SUB - 1))")
  NOUT=$((b - a + 1))
fi
"${PY[@]}" -I "$SCR/gpu_lock.py" -- npx --no-install remotion render build "$COMP" "$SUBV" "${RANGE[@]}" --gl=angle --timeout=240000 \
  --concurrency="$CONC" --codec=h264 --crf=10 --pixel-format=yuv420p --muted --log=error
t1=$(date +%s)
FRAMEARG=()
[ -n "$NOUT" ] && FRAMEARG=(-frames:v "$NOUT")
ffmpeg -v error -y -i "$SUBV" -vf "tmix=frames=$SUB:weights='1 1 1 1',select='eq(mod(n\,$SUB)\,$((SUB - 1)))',setpts=N/30/TB" -r 30 \
  "${FRAMEARG[@]}" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -an -map_metadata -1 -movflags +faststart "$OUT"
FR=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT" | tr -d ',\r')   # strip the comma and Windows' carriage return (ffprobe prints 369,\r)
NT=$(( (FR + 14) / 15 ))                      # 2 fps tiles
COLS=$(( NT < 10 ? NT : 10 )); ROWS=$(( (NT + 9) / 10 ))
ffmpeg -v error -y -i "$OUT" -vf "fps=2,scale=216:-1,tile=${COLS}x${ROWS}:padding=4:color=white" -frames:v 1 "$OUTD/${NAME}${N}_contact_sheet.jpg"
cd "$OUTD"
{
  echo "${NAME}$N  comp=$COMP  frames=$FR  render=$((t1 - t0)) s  total=$(( $(date +%s) - t0 )) s  audio=none"
  echo "== flicker.py ${NAME}$N.mp4"
  "${PY[@]}" -I "$SCR/flicker.py" "${NAME}$N.mp4" || echo "(flicker.py exit $?)"
  echo "== analyze_pacing.py ${NAME}$N.mp4"
  "${PY[@]}" -I "$SCR/analyze_pacing.py" "${NAME}$N.mp4" || echo "(analyze_pacing.py exit $?)"
} > "${NAME}${N}_qa.txt" 2>&1
cat "${NAME}${N}_qa.txt"
# keep everything: the raw sub-frame render is stored next to its version, never deleted
mv -n "$ROOT/$SUBV" "$OUTD/${NAME}${N}_sub.mp4"
