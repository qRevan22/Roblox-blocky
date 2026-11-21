// Pure layout constants of the sets (no textures, no React), so the staging, the lenses and the numeric checks can
// run in plain Node (a numeric check like tools/framing_check.ts).
import type { V3 } from "../blocky/motion";

export const STORE = {
  aisleX: 1.25,
  shelfZ: -1.3,
  // shelf-local (lx, lz) -> world: left unit (yaw +90 deg) = (-aisleX + lz, -, shelfZ - lx); right unit (yaw -90 deg) =
  // (aisleX - lz, -, shelfZ + lx)
  earth: [-1.19, 0.16 + 0.115, -0.72] as V3, // the bargain item in its cradle on the left unit's bottom board (lx -0.58)
  chrome: [1.19, 0.74 + 0.17, -0.36] as V3,
  ringed: [1.19, 1.9 + 0.2, -2.25] as V3,
  giant: [-2.7, 0.62 + 0.8, -3.3] as V3,
  saturn: [2.7, 0.62 + 0.55, -3.3] as V3,
  jupiter: [0, 0.5 + 0.6, -3.6] as V3,
  counter: [2.75, 0, 1.0] as V3,
  island: [1.45, 0, 0.2] as V3,
  door: [-5.9, 0, 2.2] as V3,
  tag99: [-0.955, 0.2, -0.72] as V3, // centre of the big price tag (world)
};

export const ROOM = {
  win: [0, 1.32, -2.0] as V3,
  winR: 0.62,
  sillY: 0.86,
  jar: [-0.02, 0.88, -1.84] as V3, // centred in the round window
  kid: [-0.5, 0, -1.25] as V3,
};
export const EARTH_IN_JAR_Y = 0.17;
