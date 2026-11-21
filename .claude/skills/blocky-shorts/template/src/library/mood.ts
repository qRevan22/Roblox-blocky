// Cinematic light per scene, built on the template's blocky mood (src/blocky/mood.ts). Every shot gets:
//   key  - the shaping light, from the lens's front-left (constant inside a shot, so shadows never swim)
//   fill - a soft opposite-side light in a complementary colour
//   rim  - a strong light from BEHIND the subject (opposite the lens, raised, a little to the side) that outlines the
//          characters against the background (a deliberate choice for this look; style.md has no rim, this overrides it)
// plus bloom tuned so emissive things glow (neon, screens, holograms, stars, planet atmospheres) and a vignette.
// Scene moods: store = bright and colourful; whisper = darker, closer, warm key + magenta rim; home = night,
// blue moonlight through the window + a warm lamp; earth = the template's sunny day (+ rim); the ending = warm and
// golden. Which shots get the whisper and ending moods is up to your story: call setMoodShots(whisperIds, endingIds).
import type { MoodPreset } from "../engine/core/moods";
import type { Cam } from "../engine/core/View";
import type { V3 } from "../blocky/motion";
import { blockyDay, moodForShot } from "../blocky/mood";

const SPACE_SKY = { ...blockyDay.sky, top: "#1c1458", mid: "#33248c", bottom: "#6a48b8", clouds: 0, stars: 1, rays: 0, sunOn: 0, moonOn: 0, horizon: 0.05 };
const GOLD_SKY = { ...SPACE_SKY, top: "#2a1650", mid: "#7a3a8a", bottom: "#ffb070" };

type Basis = { f: [number, number]; r: [number, number] };
const basis = (cam: Cam): Basis => {
  let fx = cam.look[0] - cam.pos[0], fz = cam.look[2] - cam.pos[2];
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  return { f: [fx, fz], r: [-fz, fx] };
};
const dirOf = (h: [number, number], elDeg: number): V3 => {
  const l = Math.hypot(h[0], h[1]) || 1;
  const el = (elDeg * Math.PI) / 180;
  return [(h[0] / l) * Math.cos(el), Math.sin(el), (h[1] / l) * Math.cos(el)];
};
/** directions (scene -> light) for key (front-left), fill (front-right, low) and rim (behind, a little right, raised) */
const rig = (cam: Cam, keyEl: number) => {
  const { f, r } = basis(cam);
  return {
    key: dirOf([-r[0] * 0.8 - f[0] * 0.45, -r[1] * 0.8 - f[1] * 0.45], keyEl),
    fill: dirOf([r[0] * 0.8 - f[0] * 0.5, r[1] * 0.8 - f[1] * 0.5], 15),
    rim: dirOf([f[0] * 1.0 + r[0] * 0.35, f[1] * 1.0 + r[1] * 0.35], 32),
  };
};

type Opts = {
  hemi: [string, string, number];
  key: [string, number, number]; // colour, intensity, elevation (deg)
  fill: [string, number];
  rim: [string, number];
  exposure: number;
  sat?: number;
  vignette?: [number, string];
  bloom?: [number, number, number]; // threshold, strength, radius px
  sky?: typeof SPACE_SKY;
  hi?: string; // highlight tint of the grade
  camFill?: number;
};
const build = (o: Opts, cam: Cam, keyDir?: V3): MoodPreset => {
  const d = rig(cam, o.key[2]);
  const b = o.bloom ?? [0.72, 0.5, 40];
  return {
    ...blockyDay,
    lights: {
      ...blockyDay.lights,
      hemi: { sky: o.hemi[0], ground: o.hemi[1], intensity: o.hemi[2] },
      key: { ...blockyDay.lights.key, color: o.key[0], intensity: o.key[1], dir: keyDir ?? d.key },
      fill: { ...blockyDay.lights.fill, color: o.fill[0], intensity: o.fill[1], dir: d.fill },
      rim: { ...blockyDay.lights.rim, color: o.rim[0], intensity: o.rim[1], dir: d.rim },
    },
    sky: o.sky ?? SPACE_SKY,
    fog: { color: "#160f48", density: 0 },
    post: {
      ...blockyDay.post,
      bloom: { ...blockyDay.post.bloom, threshold: b[0], strength: b[1], radiusPx: b[2] },
      vignette: { ...blockyDay.post.vignette, amount: o.vignette?.[0] ?? 0.2, color: o.vignette?.[1] ?? "#120a24" },
      grade: { ...blockyDay.post.grade, exposure: o.exposure, saturation: o.sat ?? 1.0, highlightTint: o.hi ?? blockyDay.post.grade.highlightTint },
    },
    camFill: { ...blockyDay.camFill, intensity: o.camFill ?? 0.15 },
  };
};

const STORE: Opts = { hemi: ["#e8e0ff", "#6a4a8a", 0.85], key: ["#fff4e0", 3.4, 55], fill: ["#9fe0ff", 0.7], rim: ["#8ff0ff", 5.0], exposure: 0.28, vignette: [0.22, "#120a24"], bloom: [0.8, 0.5, 40] };
const WHISPER: Opts = { hemi: ["#8a78c0", "#24142e", 0.4], key: ["#ffc070", 3.2, 32], fill: ["#5a60c8", 0.3], rim: ["#ff6ad0", 5.5], exposure: 0.16, sat: 1.05, vignette: [0.5, "#0c0614"], bloom: [0.7, 0.55, 44], camFill: 0.08 };
const HOME: Opts = { hemi: ["#6a7ae8", "#241a3a", 0.68], key: ["#a8b8ff", 2.3, 40], fill: ["#ffb060", 0.75], rim: ["#7fd0ff", 4.5], exposure: 0.56, vignette: [0.3, "#06081a"], bloom: [0.68, 0.55, 42], camFill: 0.18 };
const EARTH_NIGHT: Opts = { hemi: ["#5a6ad8", "#1a2a1a", 0.6], key: ["#b8c8ff", 1.8, 40], fill: ["#ffd890", 0.3], rim: ["#a8d8ff", 4.0], exposure: 0.4, vignette: [0.3, "#06081a"], camFill: 0.25 };
const GOLD_STORE: Opts = { hemi: ["#ffd8b0", "#5a3a4a", 0.8], key: ["#ffc870", 3.8, 30], fill: ["#c890ff", 0.5], rim: ["#ffd890", 5.2], exposure: 0.32, sat: 1.05, hi: "#ffd8a0", vignette: [0.24, "#1a0a10"], sky: GOLD_SKY };
const GOLD_HOME: Opts = { hemi: ["#a080d0", "#2a1424", 0.55], key: ["#ffb860", 2.6, 35], fill: ["#7a80ff", 0.4], rim: ["#ffd890", 5.0], exposure: 0.48, sat: 1.05, hi: "#ffd8a0", vignette: [0.28, "#140810"], bloom: [0.66, 0.6, 46] };
const GOLD_SPACE: Opts = { hemi: ["#c8a0ff", "#3a2040", 0.55], key: ["#ffd890", 3.6, 25], fill: ["#ff9ad0", 0.4], rim: ["#ffb060", 5.0], exposure: 0.4, hi: "#ffd8a0", sky: GOLD_SKY };

const WHISPER_IDS = new Set<string>();
const ENDING_IDS = new Set<string>();
const cache = new Map<string, MoodPreset>();
/** choose the shots (by id) that get the whisper mood and the golden ending mood; call once before rendering */
export const setMoodShots = (whisper: string[], ending: string[]) => {
  WHISPER_IDS.clear();
  ENDING_IDS.clear();
  whisper.forEach((id) => WHISPER_IDS.add(id));
  ending.forEach((id) => ENDING_IDS.add(id));
  cache.clear();
};
export const isEnding = (id: string) => ENDING_IDS.has(id);
export const moodFor = (set: string, id: string, cam: Cam, night = false): MoodPreset => {
  const k = `${set}|${id}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let m: MoodPreset;
  // home: the moon comes in through the round window (from -z), whatever the lens
  const moon: V3 = [0.25, 0.5, -0.83];
  if (set === "earth" && !night) {
    const day = moodForShot(id, cam);
    const d = rig(cam, 45);
    m = { ...day, lights: { ...day.lights, rim: { ...day.lights.rim, color: "#fff0c8", intensity: 3.2, dir: d.rim }, fill: { ...day.lights.fill, intensity: 0.4, dir: d.fill } }, post: { ...day.post, bloom: { ...day.post.bloom, threshold: 0.8, strength: 0.35 } } };
  } else if (set === "earth") m = build(EARTH_NIGHT, cam);
  else if (ENDING_IDS.has(id)) m = set === "space" ? build(GOLD_SPACE, cam) : set === "store2" ? build(GOLD_STORE, cam) : build(GOLD_HOME, cam, moon);
  else if (WHISPER_IDS.has(id)) m = build(WHISPER, cam);
  else if (set === "home" || set === "jar") m = build(HOME, cam, moon);
  else if (set === "space") m = build(GOLD_SPACE, cam);
  else m = build(STORE, cam);
  cache.set(k, m);
  return m;
};
