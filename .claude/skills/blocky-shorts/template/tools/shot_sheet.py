"""One labelled frame from the middle of every shot of a render, tiled into a sheet (to review a whole film shot by shot).

    python tools/shot_sheet.py out/renders/short_v1.mp4 out/renders/short_v1_shots.jpg [cols] [offset_s]

Shot times come from src/plan.gen.ts (written by plan/plan_src.py). offset_s = the time of the render's first frame
(0 for a full render). Never overwrites: refuses an existing output.
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

video, out = sys.argv[1], Path(sys.argv[2])
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 7
offset = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
if out.exists():
    sys.exit(f"{out} already exists: every sheet is kept, pick a new name")
src = Path(__file__).resolve().parent.parent / "src" / "plan.gen.ts"
if not src.exists():
    sys.exit("src/plan.gen.ts not found: run plan/plan_src.py first (shot_sheet.py / critic.py need a word-anchored plan)")
shots = json.loads(re.search(r"export const SHOTS = (\[.*?\]) as const;", src.read_text(encoding="utf8"), re.S).group(1))
font = "public/fonts/Poppins-ExtraBold.ttf"
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout.strip().rstrip(","))
with tempfile.TemporaryDirectory() as tmp:
    tiles = []
    for s in shots:
        mid = (s["t"] + s["end"]) / 2 - offset
        if mid < 0 or mid > dur - 0.05:
            continue
        f = Path(tmp) / f"{s['id']}.jpg"
        label = f"{s['id']}  {s['t']:.1f}s"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{mid:.3f}", "-i", video, "-frames:v", "1",
                        "-vf", f"scale=216:-1,drawtext=fontfile={font}:text='{label}':fontsize=17:fontcolor=white:borderw=3:bordercolor=black:x=8:y=8",
                        str(f)], check=True)
        if f.exists():
            tiles.append(f)
    rows = (len(tiles) + cols - 1) // cols
    lst = Path(tmp) / "list.txt"
    lst.write_text("".join(f"file '{t.as_posix()}'\n" for t in tiles), encoding="utf8")
    subprocess.run(["ffmpeg", "-v", "error", "-n", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-vf", f"tile={cols}x{rows}:padding=4:color=white", "-frames:v", "1", "-q:v", "3", str(out)], check=True)
print(f"{out}  ({len(tiles)} shots)")
