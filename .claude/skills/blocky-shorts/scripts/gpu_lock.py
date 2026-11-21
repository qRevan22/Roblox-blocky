#!/usr/bin/env python3
"""Run a command while holding a machine-wide "one render on the GPU" lock (Windows, macOS, Linux; stdlib only).

usage: python gpu_lock.py [--lock PATH] [--wait SECONDS] -- COMMAND [ARGS...]
example: python gpu_lock.py -- npx --no-install remotion render build MyComp out.mp4 --gl=angle --timeout=240000

Two WebGL renders sharing one GPU lost GL state and produced dark frames, so every `remotion render` / `remotion still`
should go through this wrapper. The lock is an operating-system file lock (flock on macOS/Linux, msvcrt.locking on
Windows) on an empty lock file. The OS releases it when the process ends, even after a crash, so there are no stale
locks. The script never writes to, truncates or deletes the lock file, and it refuses an existing file that is not
an empty regular file. Default lock path: <system temp dir>/remotion-gpu.lock. Exits with the command's exit code.
"""
import argparse
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import time


def die(msg, code=2):
    print(f"[gpu_lock] {msg}", file=sys.stderr)
    sys.exit(code)


def open_lock(path):
    flags = os.O_CREAT | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0)
    if os.path.islink(path):
        die(f"{path} is a symbolic link; refusing to use it as a lock")
    try:  # check before opening, so a FIFO or a device is never opened
        st = os.lstat(path)
        if not stat.S_ISREG(st.st_mode) or st.st_size != 0:
            die(f"{path} exists and is not an empty lock file; refusing to touch it (pass another --lock path)")
    except FileNotFoundError:
        pass
    try:
        try:
            fd = os.open(path, flags | os.O_RDWR, 0o666)
        except PermissionError:
            fd = os.open(path, (flags & ~os.O_CREAT) | os.O_RDONLY)  # a lock file created by another user
    except OSError as e:
        die(f"cannot open {path}: {e}")
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode) or st.st_size != 0:
        os.close(fd)
        die(f"{path} exists and is not an empty lock file; refusing to touch it (pass another --lock path)")
    return fd


def try_lock(fd):
    try:
        if os.name == "nt":
            import msvcrt

            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


def resolve(name):
    exe = shutil.which(name)
    if exe is None:
        die(f"command not found: {name}", 127)
    if os.name == "nt" and not os.path.dirname(name):
        # Windows also searches the current folder first; only accept a bare name found on PATH
        if os.path.normcase(os.path.dirname(os.path.abspath(exe))) == os.path.normcase(os.getcwd()):
            die(f"{name} resolved to the current folder ({exe}); pass a full path if you really mean it")
    return exe


def main():
    if "--" not in sys.argv:
        print(__doc__)
        sys.exit(2)
    i = sys.argv.index("--")
    ap = argparse.ArgumentParser()
    ap.add_argument("--lock", default=os.path.join(tempfile.gettempdir(), "remotion-gpu.lock"))
    ap.add_argument("--wait", type=float, default=-1, help="max seconds to wait (default: forever)")
    ap.add_argument("--poll", type=float, default=2.0, help="seconds between tries")
    a = ap.parse_args(sys.argv[1:i])
    cmd = sys.argv[i + 1:]
    if not cmd:
        die("no command given")
    exe = resolve(cmd[0])
    if os.name == "nt" and exe.lower().endswith((".cmd", ".bat")):
        # Windows runs .cmd/.bat shims through cmd.exe, which would interpret these characters
        bad = [x for x in [exe] + cmd[1:] if any(c in x for c in '&|<>^%!"\r\n')]
        if bad:
            die(f"refusing to pass shell characters through {os.path.basename(exe)}: {bad}")

    fd = open_lock(a.lock)
    t0 = time.time()
    said = False
    while not try_lock(fd):
        if not said:
            print("[gpu_lock] waiting: another render holds the GPU", file=sys.stderr)
            said = True
        if a.wait >= 0 and time.time() - t0 > a.wait:
            os.close(fd)
            die("timed out waiting for the lock", 75)
        time.sleep(max(0.1, a.poll))
    try:
        # on macOS/Linux the render inherits the lock, so it stays held even if this wrapper is killed
        rc = subprocess.call([exe] + cmd[1:], pass_fds=(fd,) if os.name != "nt" else ())
    except KeyboardInterrupt:
        rc = 130
    finally:
        if os.name == "nt":
            import msvcrt

            try:
                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
        os.close(fd)  # closing the file releases the lock; the empty file stays for the next run
    sys.exit(rc)


if __name__ == "__main__":
    main()
