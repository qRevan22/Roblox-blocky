"""Tone/colour numbers of images or a video (sampled), to compare with the targets in references/style.md.
usage: python measure.py IMG [IMG...]   |   python measure.py VIDEO.mp4 --every 15
prints per input and overall: L* mean, p5, p95, chroma mean, near-black share (L* < 15).
Needs ffmpeg on PATH and numpy."""
import subprocess
import sys

import numpy as np


def lab(rgb):
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return L, np.hypot(a, b)


def frames(path, every):
    w, h = 270, 480
    if path.lower().endswith((".mp4", ".mov", ".mkv")):
        cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=not(mod(n\\,{every})),scale={w}:{h}", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    else:
        cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, np.uint8)
    n = arr.size // (w * h * 3)
    return arr[: n * w * h * 3].reshape(n, h, w, 3)


def stats(imgs):
    L, C = lab(imgs)
    return dict(L=L.mean(), Lp5=np.percentile(L, 5), Lp95=np.percentile(L, 95), chroma=C.mean(), black=(L < 15).mean())


def fmt(d):
    return "L {L:5.1f}  p5 {Lp5:5.1f}  p95 {Lp95:5.1f}  chroma {chroma:5.1f}  black {black:6.1%}".format(**d)


def main():
    every = 15
    args = sys.argv[1:]
    if "--every" in args:
        i = args.index("--every")
        every = int(args[i + 1])
        del args[i : i + 2]
    allf = []
    for p in args:
        f = frames(p, every)
        allf.append(f)
        print(f"{p.split('/')[-1].split(chr(92))[-1]:28s} {fmt(stats(f))}")
    if len(allf) > 1:
        print(f"{'ALL':28s} {fmt(stats(np.concatenate(allf)))}")
    print("targets (round 2): L 47-52, p5 12-20, p95 82-86, chroma 26-32, black 4-10%")


if __name__ == "__main__":
    main()
