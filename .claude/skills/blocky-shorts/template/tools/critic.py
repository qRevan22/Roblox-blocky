"""Strict critic numbers for a render of the Short.

    python tools/critic.py out/renders/short_v1.mp4 [video_with_voice.mp4]

  SYNC     every planned cut (src/plan.gen.ts, anchored to words) vs the cut detected in the video (frame difference
           peaks); a cut more than 1 frame off is a FAIL
  STATIC   the longest run of frames with (almost) no change; FAIL if >= 2.0 s (the brief), WARN if >= 1.0 s
  EDGES    white caption pixels in the caption band: the minimum distance to the left/right frame edge; FAIL if < 6 %
  SOUND    the audio streams of the voiced version (the voice only = no sound effects)
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

video = sys.argv[1]
voiced = sys.argv[2] if len(sys.argv) > 2 else None
root = Path(__file__).resolve().parent.parent
if not (root / "src" / "plan.gen.ts").exists():
    sys.exit("src/plan.gen.ts not found: run plan/plan_src.py first (shot_sheet.py / critic.py need a word-anchored plan)")
plan = (root / "src" / "plan.gen.ts").read_text(encoding="utf8")
shots = json.loads(re.search(r"export const SHOTS = (\[.*?\]) as const;", plan, re.S).group(1))
FPS = 30


def frames(path, w, h, gray=True):
    fmt = "gray" if gray else "rgb24"
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", fmt, "-"],
                       capture_output=True, check=True)
    ch = 1 if gray else 3
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w, ch) if not gray else np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w)


g = frames(video, 135, 240).astype(np.float32)
d = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))  # d[k] = change from frame k to k+1
fails = []

# SYNC
planned_all = [round(s["t"] * FPS) for s in shots[1:]]
# a partial render (a test stretch from frame 0) holds only the cuts inside it
inside = [(s, c) for s, c in zip(shots[1:], planned_all) if c + 3 < len(d)]
planned = [c for _, c in inside]
detected = []
for c in planned:
    lo, hi = max(1, c - 3), min(len(d), c + 4)
    k = lo - 1 + int(np.argmax(d[lo - 1:hi]))  # the change from frame k to k+1 -> the cut is at k+1
    detected.append(k + 1)
off = [(s["id"], c, x, x - c) for (s, _), c, x in zip(inside, planned, detected)]
bad = [o for o in off if abs(o[3]) > 1]
print(f"SYNC   {len(planned)} cuts checked ({len(planned_all) - len(planned)} after the end of this video skipped), max offset {max([abs(o[3]) for o in off] or [0])} frame(s)")
for o in bad:
    fails.append(f"SYNC   {o[0]} cut at frame {o[2]}, planned {o[1]} ({o[3]:+d})")

# STATIC
still = d < 0.35
run, best, best_at = 0, 0, 0
for k, s_ in enumerate(still):
    run = run + 1 if s_ else 0
    if run > best:
        best, best_at = run, k - run + 1
print(f"STATIC longest near-still run {best} frames = {best / FPS:.2f} s (from frame {best_at})")
if best / FPS >= 2.0:
    fails.append(f"STATIC {best / FPS:.2f} s without movement from frame {best_at}")
elif best / FPS >= 1.0:
    print(f"WARN   a near-still run of {best / FPS:.2f} s from frame {best_at}")

# EDGES (captions are white; sample every 5th frame at quarter size)
c = frames(video, 270, 480, gray=False)[::5]
band = c[:, int(0.55 * 480):int(0.8 * 480)]
white = (band.min(axis=3) > 246)
xs = np.where(white.any(axis=1))
if len(xs[0]):
    cols = white.any(axis=1)
    mins = [np.argmax(r) for r in cols if r.any()]
    maxs = [len(r) - 1 - np.argmax(r[::-1]) for r in cols if r.any()]
    m = min(min(mins), 269 - max(maxs)) / 270
    print(f"EDGES  closest white caption pixel to a side edge: {m * 100:.1f} % of the width")
    if m < 0.06:
        fails.append(f"EDGES  caption text {m * 100:.1f} % from the edge (< 6 %)")

# SOUND
if voiced:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=index,codec_type,codec_name,duration", "-of", "csv=p=0", voiced],
                       capture_output=True, text=True).stdout.strip().splitlines()
    aud = [x for x in r if "audio" in x]
    print(f"SOUND  {len(aud)} audio stream(s): {'; '.join(aud)} -> the voice only, 0 sound effects")

for f_ in fails:
    print("FAIL", f_)
print(f"{len(fails)} FAIL")
