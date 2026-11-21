// The shot plan in one place. Hard cuts; inside every shot a constant push-in of PUSH × the lens
// distance per second (references/style.md: ~11 %/s) and a small roll. A shot = a subject point (may move), an offset from
// subject to lens at the shot start, fov, and where the subject sits (fraction from the top of the frame).
import type { Cam } from "../engine/core/View";
import { aim } from "../engine/core/rig";
import { CONE, FLIGHT, lerp, poseA, scoopFlight, ss, T, XA, XB, ZB } from "./motion";
import type { V3 } from "./motion";

export const FPS = 30;
export const PUSH = 0.11;
export type Shot = { id: string; a: number; b: number; subj: (t: number) => V3; off: V3; fov: number; face: number; roll: [number, number]; note: string; push?: number;
  /** fixed lens position (pushes toward the subject) instead of subject + off */
  pos?: V3;
  /** extra late tighten: k -= tighten * max(0, tau - tightenAt)^2 */
  tighten?: [number, number] };

const mid = (p: V3, q: V3, u = 0.5): V3 => [lerp(p[0], q[0], u), lerp(p[1], q[1], u), lerp(p[2], q[2], u)];
const APEX: V3 = [(FLIGHT.P0[0] + FLIGHT.P1[0]) / 2, Math.max(FLIGHT.P0[1], FLIGHT.P1[1]) + FLIGHT.H * 0.85, (FLIGHT.P0[2] + FLIGHT.P1[2]) / 2];

export const SHOTS: Shot[] = [
  {
    id: "S1", a: T.S1, b: T.S2, note: "hook: low lens by the grass, he walks toward/past it smiling with his cone, flowers pop big in the foreground at every heel contact",
    subj: (t) => [poseA(t).x + 0.12, 0.65, 0.0], off: [0, 0, 0], pos: [-1.55, 0.36, 2.1], fov: 52, face: 0.47, roll: [0, 1.5],
  },
  {
    id: "S2", a: T.S2, b: T.S3, note: "medium-wide 3/4 front, slightly low: A walks happy with a 2-scoop cone, flower trail behind, rock ahead",
    subj: (t) => [poseA(t).x + 0.08, 0.9, 0.0], off: [2.35, -0.1, 2.5], fov: 49, face: 0.42, roll: [0, -1.2],
  },
  {
    id: "S3", a: T.S3, b: T.S4, note: "medium side: toe hooks the rock (held), he tips over, arms fling (top scoop flies off), belly-flop + bounce",
    subj: (t) => [lerp(-0.5, 0.36, ss(3.2, 4.15, t)), 0.62, 0.05], off: [0.25, 0.2, 3.9], fov: 52, face: 0.5, roll: [0, 1.5],
  },
  {
    id: "S4", a: T.S4, b: T.S5, note: "low angle against the sky: the scoop arcs over",
    subj: (t) => {
      const s = scoopFlight(t);
      return s ? mid(APEX, s.p, 0.85) : APEX;
    },
    off: [0.13, -0.68, 0.83], fov: 62, face: 0.42, roll: [-1, 1.5],
  },
  {
    id: "S5", a: T.S5, b: T.S6, note: "medium on B: sad on a grey patch with an empty cone; the scoop drops into frame and lands; her face flips on the landing; ring of flowers, grass greens",
    subj: () => [XB - 0.12, 1.0, ZB + 0.0], off: [-0.8, 0.5, 3.05], fov: 58, face: 0.55, roll: [0, -1.3],
  },
  {
    id: "S6", a: T.S6, b: T.S6b, note: "close-up A sitting on the grass: shock",
    subj: () => [XA + 0.03, 0.86, 0.02], off: [0.5, 0.22, 0.85], fov: 50, face: 0.48, roll: [0, 2],
  },
  {
    id: "S6b", a: T.S6b, b: T.S7, note: "high 3/4 on A: he turns sad, the grey spreads out under him, his trail droops",
    subj: () => [XA - 0.2, 0.4, 0.05], off: [1.25, 1.95, 2.3], fov: 56, face: 0.45, roll: [0, -2],
  },
  {
    id: "S7", a: T.S7, b: T.S7b, note: "wide two-shot: B happy in her bloom ring, A slumps on his grey patch, his flowers wilt one by one",
    subj: () => [XA + 1.13, 0.3, 0.3], off: [-0.33, 3.66, 5.93], fov: 60, face: 0.7, roll: [0, -1.0], push: 0.08,
  },
  {
    id: "S7b", a: T.S7b, b: T.END, note: "closer two-shot payoff: he lifts his head toward her; his grey patch vs her bright ring, her last flowers pop",
    subj: () => [XA + 1.15, 0.45, 0.25], off: [-4.1, 2.4, 2.3], fov: 54, face: 0.55, roll: [0, -1.5], push: 0.08,
  },
];

/** shot of OUTPUT frame n (all motion-blur sub-frames of n stay in one shot: no cross-cut ghosts) */
export const shotIndexAt = (n: number) => {
  let i = 0;
  for (let k = 0; k < SHOTS.length; k++) if (n >= Math.round(SHOTS[k].a * FPS)) i = k;
  return i;
};
export const camOf = (s: Shot, t: number): Cam => {
  const tau = t - s.a;
  const subj = s.subj(t);
  const k = 1 - (s.push ?? PUSH) * tau - (s.tighten ? s.tighten[0] * Math.max(0, tau - s.tighten[1]) ** 2 : 0);
  const pos: V3 = s.pos
    ? [subj[0] + (s.pos[0] - subj[0]) * k, subj[1] + (s.pos[1] - subj[1]) * k, subj[2] + (s.pos[2] - subj[2]) * k]
    : [subj[0] + s.off[0] * k, subj[1] + s.off[1] * k, subj[2] + s.off[2] * k];
  const c = aim(pos, subj, s.fov, s.face);
  return { ...c, roll: lerp(s.roll[0], s.roll[1], (t - s.a) / (s.b - s.a)) };
};
export const CONE_H = CONE.h;
