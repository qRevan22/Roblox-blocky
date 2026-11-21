#!/usr/bin/env bash
# Numeric plausibility checks of the pure motion and the shot plan (no rendering, no GPU):
#   check_motion.ts  - soles vs ground, feet vs the rock, flowers spawned under soles, sampled at 120 Hz
#   framing_check.ts - every character / face / held prop projected through every camera on every output frame
# Both are bundled with esbuild (installed with Remotion) and run in Node. Exit code 1 if a check fails.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -d node_modules ] || { echo "node_modules not found: run npm ci first" >&2; exit 2; }
mkdir -p out
rc=0
for t in check_motion framing_check; do
  npx --no-install esbuild "tools/$t.ts" --bundle --platform=node --format=esm --outfile="out/$t.mjs" --log-level=error
  echo "== $t"
  node "out/$t.mjs" | tee "out/$t.txt" || rc=1
done
grep -q "FAIL" out/framing_check.txt && rc=1
exit $rc
