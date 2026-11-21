// blockyDay: a sunny game-engine day (references/style.md, light): sun key high (48°) from the lens's front-left, crisp soft-edged
// shadows, no rim light, no ink, no DOF, mild bloom on whites, saturated blue sky with clouds, near-black shadows
// allowed (no lifted plum blacks). The key direction is set per SHOT from that shot's lens (constant inside a shot, so
// shadows never swim; the cut hides the change).
import { mk } from "../engine/core/moods";
import type { MoodPreset } from "../engine/core/moods";
import type { Cam } from "../engine/core/View";
import type { V3 } from "./motion";

export const blockyDay: MoodPreset = (() => {
  const m = mk({
    note: "blocky sunny day",
    hemi: ["#c8dcff", "#5a6a3a", 0.66],
    key: ["#fff0d2", 4.1, [-0.6, 0.7, 0.4]],
    rim: ["#ffffff", 0, [0, 1, -1]],
    fill: ["#b8c8ff", 0.22, [0.7, 0.3, -0.4]],
    prac: ["#ffd8a0", 0, "#fff0d0"],
    fog: ["#b9d2f0", 0.003],
    sky: {
      top: "#2a5fd6", mid: "#3f7ae6", bottom: "#8fb6ea", cloudColor: "#a9b9d4", cloudLit: "#ffffff", clouds: 0.7, stars: 0, rays: 0, horizon: 0.1, brush: 0.03,
      sun: { dir: [-0.5, 0.55, -0.6], color: "#fff4d0", size: 5 }, sunOn: 0.6, moon: { dir: [0, 1, 0], color: "#ffffff", size: 1 }, moonOn: 0,
    },
    toon: { shadowTint: [1, 1, 1], hiTint: [1, 1, 1], rimColor: "#ffffff" },
    grade: { exposure: 0.22, contrast: 1.2, saturation: 0.9, shadowTint: "#3a4a9a", highlightTint: "#fff4dc", gain: "#ffffff" },
    bloomTint: "#fff6e8",
    ink: "#000000",
    camFill: ["#ffffff", 0.12],
    cast: { rim: ["#ffffff", 0], fill: ["#ffffff", 0] },
  });
  m.post.outline = { ...m.post.outline, enabled: false };
  m.post.bloom = { ...m.post.bloom, threshold: 0.95, strength: 0.28, radiusPx: 30 };
  m.post.grade = { ...m.post.grade, lift: "#000000", splitAmount: 0.05, sharpen: 0.35 };
  m.post.vignette = { ...m.post.vignette, amount: 0.1, color: "#202838" };
  m.lights.key.mapSize = 4096;
  m.lights.key.shadowNormalBias = 0.02;
  return m;
})();

/** the sun for a lens: from the camera's front-left, 48° high */
const cache = new Map<string, MoodPreset>();
export const moodForShot = (id: string, cam: Cam): MoodPreset => {
  const hit = cache.get(id);
  if (hit) return hit;
  let fx = cam.look[0] - cam.pos[0];
  let fz = cam.look[2] - cam.pos[2];
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  const rx = -fz, rz = fx; // camera right
  let hx = -rx * 0.8 - fx * 0.45; // toward the lens's left, and toward the lens
  let hz = -rz * 0.8 - fz * 0.45;
  const hl = Math.hypot(hx, hz);
  hx /= hl;
  hz /= hl;
  const el = (42 * Math.PI) / 180;
  const dir: V3 = [hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)];
  const m: MoodPreset = { ...blockyDay, lights: { ...blockyDay.lights, key: { ...blockyDay.lights.key, dir } } };
  cache.set(id, m);
  return m;
};
