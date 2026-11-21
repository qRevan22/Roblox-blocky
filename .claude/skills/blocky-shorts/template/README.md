# blocky-shorts template

A Remotion + three.js project with the 10 s example Short: a boy whose happy steps grow flowers trips, his top scoop
flies into a sad girl's empty cone, her ground blooms and his wilts. Our own characters and world.

```bash
npm ci
bash render.sh 1 BlockyTestSub 0-89      # 3 s smoke test  -> out/renders/v1.mp4
bash tools/checks.sh                     # motion + framing checks (no GPU)
bash tools/stills.sh look 15 75 165 255  # look-dev stills at 0.4 scale -> out/stills_look.jpg
bash render.sh 2                         # the full 10 s with motion blur + QA
```

`render.sh` and `tools/stills.sh` need the skill's `scripts/` folder next to this project (`./scripts` or `../scripts`)
or `BLOCKY_SCRIPTS=/path/to/scripts`, plus ffmpeg, ffprobe and Python 3 with numpy on PATH (or `PYTHON=...`).

**First-run downloads** (the skill's own code makes no network calls; npm itself talks to registry.npmjs.org on
`npm ci`, its audit, and `npx --no-install` lookups): `npm ci` installs the
locked npm packages from registry.npmjs.org; the first `render.sh` or `stills.sh` makes Remotion download Chrome
Headless Shell (~300 MB unpacked, from remotion.media or Google's Chrome for Testing storage) into
`node_modules/.remotion/`; the first `vo/transcribe.py` downloads the Whisper `small` model (~0.5 GB) from Hugging Face
into `~/.cache/huggingface/` (set `HF_HOME` to move it; afterwards `HF_HUB_OFFLINE=1` works offline). The scripts call
`npx --no-install`, so a missing `npm ci` fails instead of fetching packages. Python packages, in a venv if you
like: `python -m pip install numpy pillow "faster-whisper==1.2.*" "av<16"`.

**Remotion's license:** Remotion is not open source and is not covered by this skill's MIT license: `npm ci` installs
it under the Remotion License (https://www.remotion.dev/docs/license). It is free for individuals, for-profit
companies with up to 3 employees, non-profits and evaluation; any larger company needs a Remotion Company License
before using it (https://www.remotion.dev/docs/license/pricing). The other npm dependencies keep their own licenses.

`npm run studio` (Remotion Studio) is reachable from your local network while it runs and checks npm for a newer
Remotion version; renders use 127.0.0.1 only.

| path | what |
|---|---|
| `src/blocky/Blocky.tsx` | the character builder (spec in `motion.ts` `SPEC`, looks `KID_A`, `KID_B`) |
| `src/blocky/World.tsx` | the suburban world and props |
| `src/blocky/Flowers.tsx` | flowers, grey patches, flying scoop, sparkles, pop ring, dust |
| `src/blocky/Contact.tsx` | contact shadows and footprints |
| `src/blocky/mood.ts` | the sunny lighting rig per shot |
| `src/blocky/motion.ts` | poses, walk, trip, timing `T`, all pure functions of `t` |
| `src/blocky/plan.ts` | the 9 shots, 8 hard cuts (lens, fov, face height, push, roll) |
| `src/blocky/BlockyTest.tsx` | the composition; `BlockyTestSub` = 4 sub-frames per frame for motion blur |
| `src/engine/` | view, lights, sky, shadows, post chain, materials, camera maths |
| `plan/plan_src.py` | a word-anchored shot planner for voiced Shorts |
| `public/fonts/` | Poppins (SIL OFL 1.1) for captions |

## Library and tools (1.1)
- `src/library/`: reusable characters (`characters.ts`), planets, props, sets (planet store, kid's room, shop in space),
  cinematic moods, pop-in captions. Typechecked with the template.
- `vo/transcribe.py`: word timings for a voice-over (faster-whisper, aligned to the words of your script text file).
- `tools/stills.sh` (refuses a used tag), `tools/compare.sh` (before/after sheet), `tools/shot_sheet.py` (the middle
  frame of every shot), `tools/critic.py` (sync / static / caption edges / sound).
- `render.sh`: `NAME=short_v bash render.sh <N> <COMP>` numbers a full film apart from tests; never overwrites; keeps
  `<name><N>_sub.mp4`. Send its output to a log file: `> out/renders/<name><N>_render.txt 2>&1`.
