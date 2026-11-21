"""Compare sheet: N frames of your render next to reference images, with the tone numbers of both in the header.

usage: python compare.py RENDER.mp4 OUT.jpg REFS.txt [N=20]
  REFS.txt: one image path per line (frames of videos you study). Reference frames are for private analysis only:
  never ship, publish or commit them, and never put them inside the skill.
Also writes OUT.json: mean L*, L* p5 / p95, chroma, near-black share (L* < 10) for yours vs the references.
Needs ffmpeg + ffprobe on PATH (or FFMPEG / FFPROBE env vars), numpy and Pillow.
"""
import json
import math
import os
import shutil
import subprocess
import sys
from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
FP = os.environ.get("FFPROBE") or shutil.which("ffprobe") or "ffprobe"
TW, TH = 216, 384


def font(size):
    for name in ("DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def lab_stats(img):
    a = np.asarray(img.convert("RGB").resize((90, 160)), np.float32) / 255
    c = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = (c @ m.T) / np.array([0.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    A, B = 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])
    return dict(L=float(L.mean()), Lp5=float(np.percentile(L, 5)), Lp95=float(np.percentile(L, 95)),
                chroma=float(np.hypot(A, B).mean()), black=float((L < 10).mean()))


def main(mp4, out, refs_txt, n=20):
    n = int(n)
    dur = float(subprocess.run([FP, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", mp4],
                               capture_output=True, text=True, check=True).stdout.strip())
    ours = []
    for i in range(n):
        t = (i + 0.5) * dur / n
        p = subprocess.run([FF, "-v", "error", "-ss", f"{t:.3f}", "-i", mp4, "-frames:v", "1", "-f", "image2pipe",
                            "-vcodec", "png", "-"], capture_output=True, check=True)
        ours.append((Image.open(BytesIO(p.stdout)).convert("RGB"), f"ours {t:.1f}s"))
    refs = []
    for line in open(refs_txt, encoding="utf-8"):
        line = line.strip()
        if line and os.path.exists(line):
            refs.append((Image.open(line).convert("RGB"), f"ref {len(refs) + 1}"))
    cols = 10
    rows_o, rows_r = math.ceil(len(ours) / cols), math.ceil(len(refs) / cols)
    sheet = Image.new("RGB", (cols * TW, 40 + (rows_o + rows_r) * (TH + 22) + 30), (16, 16, 16))
    d = ImageDraw.Draw(sheet)
    f16 = font(16)
    so = [lab_stats(im) for im, _ in ours]
    sr = [lab_stats(im) for im, _ in refs]
    agg = lambda s: {k: round(float(np.mean([x[k] for x in s])), 3) for k in s[0]} if s else {}
    A, R = agg(so), agg(sr)
    head = f"OURS  L*{A.get('L', 0):.1f} p95 {A.get('Lp95', 0):.1f} chroma {A.get('chroma', 0):.1f} black {A.get('black', 0) * 100:.1f}%"
    if R:
        head += f"   |   REFS  L*{R['L']:.1f} p95 {R['Lp95']:.1f} chroma {R['chroma']:.1f} black {R['black'] * 100:.1f}%"
    d.text((6, 8), head, fill=(240, 240, 240), font=f16)
    y = 40
    for group, color in ((ours, (120, 220, 120)), (refs, (230, 200, 90))):
        for i, (im, lab) in enumerate(group):
            x, yy = (i % cols) * TW, y + (i // cols) * (TH + 22)
            sheet.paste(im.resize((TW, TH), Image.LANCZOS), (x, yy))
            d.text((x + 4, yy + TH + 3), lab, fill=color, font=f16)
        y += math.ceil(len(group) / cols) * (TH + 22) + 15
    sheet.save(out, quality=88)
    json.dump({"ours": A, "refs": R, "ours_frames": so}, open(os.path.splitext(out)[0] + ".json", "w"), indent=1)
    print("ours", A, "\nrefs", R)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)
    main(*sys.argv[1:])
