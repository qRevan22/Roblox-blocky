"""Word timings for the voice-over: Whisper (faster-whisper) times + the exact words of script.txt.

    python vo/transcribe.py voice.wav script.txt vo/timings.json [model]

Writes timings.json in the format plan/plan_src.py reads:
  {"turns": [{"turn": 1, "words": [{"w": "In", "t": 0.0, "end": 0.14}, ...]}, ...]}
One turn = one line of script.txt. Words keep the script's spelling and punctuation; their times come from Whisper.
Where Whisper's words differ from the script ("99" vs "Ninety-nine"), the times of that stretch are spread over the
script words in proportion to their length. Also writes <out>_whisper.json (Whisper's raw words) next to it.
"""
import difflib, json, re, sys, time
from pathlib import Path

from faster_whisper import WhisperModel


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def main(wav, script, out, model_name="small"):
    lines = [l.strip() for l in Path(script).read_text(encoding="utf8").splitlines() if l.strip()]
    sw = [(i + 1, w) for i, l in enumerate(lines) for w in l.split()]

    t0 = time.time()
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, info = model.transcribe(wav, word_timestamps=True, language="en")  # no initial_prompt: given the opening lines, Whisper skips them
    ww = [{"w": w.word.strip(), "t": float(w.start), "end": float(w.end), "p": float(w.probability)}
          for s in segs for w in s.words]
    took = time.time() - t0

    a = [norm(w) for _, w in sw]
    b = [norm(w["w"]) for w in ww]
    times = [None] * len(sw)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    unmatched = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (ww[j1 + k]["t"], ww[j1 + k]["end"])
        elif op == "replace":
            t_a, t_b = ww[j1]["t"], ww[j2 - 1]["end"]
            L = [max(1, len(a[i])) for i in range(i1, i2)]
            tot, acc = sum(L), 0
            for k, i in enumerate(range(i1, i2)):
                s = t_a + (t_b - t_a) * acc / tot
                acc += L[k]
                times[i] = (s, t_a + (t_b - t_a) * acc / tot)
            unmatched.append((" ".join(w for _, w in sw[i1:i2]), " ".join(w["w"] for w in ww[j1:j2])))
        elif op == "insert":
            unmatched.append(("", " ".join(w["w"] for w in ww[j1:j2])))
        elif op == "delete":
            unmatched.append((" ".join(w for _, w in sw[i1:i2]), ""))
    # script words Whisper missed: squeeze them between neighbours
    missed = [sw[i][1] for i, tt in enumerate(times) if tt is None]
    if missed:
        print(f"WARNING: {len(missed)} script words not heard by Whisper (times guessed): {' '.join(missed)}")
    for i, tt in enumerate(times):
        if tt is None:
            prev = next((times[k][1] for k in range(i - 1, -1, -1) if times[k]), 0.0)
            nxt = next((times[k][0] for k in range(i + 1, len(times)) if times[k]), prev + 0.3)
            times[i] = (prev, max(prev + 0.05, min(nxt, prev + 0.3)))

    turns = {}
    for (turn, w), (s, e) in zip(sw, times):
        turns.setdefault(turn, []).append({"w": w, "t": round(s, 3), "end": round(e, 3)})
    data = {"source": {"audio": wav, "script": script, "model": model_name, "duration": round(info.duration, 3)},
            "turns": [{"turn": k, "text": lines[k - 1], "words": v} for k, v in turns.items()]}
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf8")
    Path(out).with_name(Path(out).stem + "_whisper.json").write_text(json.dumps(ww, indent=1), encoding="utf8")

    print(f"audio {info.duration:.2f} s, whisper {len(ww)} words, script {len(sw)} words, {took:.1f} s")
    print(f"first word {times[0][0]:.2f} s, last word ends {times[-1][1]:.2f} s")
    print("differences script | whisper:")
    for x, y in unmatched:
        print(f"  {x!r} | {y!r}")
    for t in data["turns"]:
        print(f"  L{t['turn']:>2} {t['words'][0]['t']:6.2f}-{t['words'][-1]['end']:6.2f}  {t['text']}")


if __name__ == "__main__":
    main(*sys.argv[1:])
