# Changelog

## 1.1.2 · original examples
- `references/scripts.md`: one sample hook and one sample title were too close to a title in the study; replaced
  with original ones. Nothing else changed.

## 1.1.1 · release fixes
- Python: `render.sh` and `tools/stills.sh` find a working Python 3 with numpy themselves (new `tools/pick_python.sh`:
  python3, python, `py -3`), so the Windows Store `python3` stub is skipped without setting `PYTHON`.
- Safety: the scripts call `npx --no-install` (a missing `npm ci` fails instead of fetching packages); `render.sh` and
  `stills.sh` check their arguments (version, name, frame range, tag) before using them.
- Docs: first-run downloads (Chrome Headless Shell, the Whisper model), the pip line, Remotion's own license (not MIT;
  a company license above 3 employees), `LICENSE` and `THIRD_PARTY_NOTICES.md` also inside `template/`.
- `tools/shot_sheet.py` and `tools/critic.py` say what is missing when there is no `src/plan.gen.ts`.
- Line endings: every text file uses LF.

## 1.1 · lessons and library from a voiced Short
- **Rules:** `references/pitfalls.md` round 2 (voice timing, lenses and framing, passing through, motion, look,
  process); `references/style.md` §8 the premium pass + the proven caption variant; `references/render.md` versions,
  tools, sound, Windows; `SKILL.md` workflow steps 2, 5, 7, 9, 10, 11 and the rules.
- **Library** (`template/src/library/`): characters (aliens with accessories + the pose / idle / overshoot kit), planets,
  props, sets (store, room, space), scene moods, pop-in captions.
- **Template upgrades:** `Blocky.tsx` (eye scale, catch-lights, antennae with wobble, hat, bag, apron, glasses, rocket
  backpack, belts, cuffs, held and chest props, new emotions sly / love / curious), `motion.ts` (ant, antWob),
  `captions.tsx` (y position), `render.sh` (NAME prefix, keeps the sub-frame render, refuses any existing version),
  `tools/stills.sh` (refuses a used tag), new `tools/compare.sh`, `tools/shot_sheet.py`, `tools/critic.py`,
  `vo/transcribe.py`. The 10 s example still passes its checks.

## 1.0 · the original skill
The 10 s template, its references and scripts (62 files).
