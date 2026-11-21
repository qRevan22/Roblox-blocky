#!/usr/bin/env bash
# Before/after sheet for look-dev stills: top row = out/stills/<before>_f<frame>.jpg, bottom row = <after>_f<frame>.jpg,
# labelled. usage: bash tools/compare.sh <before-tag> <after-tag> <out.jpg> <frame> [frame...]
set -euo pipefail
B="$1"; A="$2"; O="$3"; shift 3
[ -e "$O" ] && { echo "$O already exists: every sheet is kept, pick a new name" >&2; exit 1; }
FONT="public/fonts/Poppins-ExtraBold.ttf"
ins=(); n=0
for f in "$@"; do ins+=(-i "out/stills/${B}_f$(printf %03d "$f").jpg"); n=$((n+1)); done
for f in "$@"; do ins+=(-i "out/stills/${A}_f$(printf %03d "$f").jpg"); done
top=""; bot=""
for ((i=0;i<n;i++)); do top+="[$i:v]"; bot+="[$((i+n)):v]"; done
lab="drawtext=fontfile=${FONT}:fontsize=34:fontcolor=white:borderw=4:bordercolor=black:x=16:y=14"
ffmpeg -v error -y "${ins[@]}" -filter_complex "${top}hstack=inputs=${n},${lab}:text='BEFORE'[t];${bot}hstack=inputs=${n},${lab}:text='AFTER'[b];[t][b]vstack=inputs=2" -q:v 3 "$O"
echo "$O"
