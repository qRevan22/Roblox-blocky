// Pure motion maths for the BlockyTest story: walk, trip + fall, sitting, scoop flight, kid B, flowers, patches, AO
// spots. Every value is a pure function of t (seconds). No React here, so tools/check_motion.ts can import it in plain
// Node and verify ground / rock / flower clearance with the same FK as Blocky.tsx.
import * as THREE from "three";

export type V3 = [number, number, number];

// ------------------------------------------------------------------ body spec (in U = one block unit of the blocky family)
export const U = 0.27; // m
export const SPEC = {
  torso: { w: 2, h: 2, d: 1 },
  // arms 0.46 of the torso width (wider arms read as thick as the torso when foreshortened)
  arm: { w: 0.92, h: 2, d: 0.92, up: 0.5 }, // shoulder pivot 0.5U below the arm's top (classic blocky avatar)
  leg: { w: 1, h: 2, d: 1 },
  shoe: { w: 1.06, h: 0.42, d: 1.08 },
  // head 1.02 / 2 = 0.51 of the torso width (style.md: 0.50-0.58); 5.12 / 1.12 = 4.6 heads tall
  head: { w: 1.02, h: 1.12, d: 1.0, r: 0.17, gap: 0.06 },
  sleeve: 0.8,
  shoulderX: 1.46, // arm inner face touches the torso side
  hipX: 0.5,
};
export const L = SPEC.leg.h * U; // hip pivot to sole
export const D = SPEC.shoe.d * U; // sole length (front-back)
export const HAND = (SPEC.arm.h - SPEC.arm.up) * U; // shoulder pivot to arm end
export const SHOULDER_Y = (SPEC.torso.h - 0.5) * U; // above the hip pivot
/** a raised-out arm also moves out, so its top never swings into the torso */
export const shoulderXOf = (out: number) => (SPEC.shoulderX + 0.6 * Math.abs(Math.sin(out))) * U;
export const CONE = { r: 0.058, h: 0.17 };
export const SCOOP_R = 0.064;
/** scoop centre above the cone rim so the ball rests IN the rim (ball r > rim r) */
export const SCOOP_SEAT = Math.sqrt(SCOOP_R * SCOOP_R - CONE.r * CONE.r);
export const SCOOP_STACK = 0.092;
/** the cone is held just PAST the arm end (never inside the arm box) */
export const GRIP = 0.052;

/** lowest point of a rigid box leg below its hip pivot at world swing angle psi (rad, + = foot forward) */
export const legDrop = (psi: number) => L * Math.cos(psi) + (D / 2) * Math.abs(Math.sin(psi));

export type Pose = {
  x: number;
  y: number; // hip pivot height
  z: number;
  yaw: number;
  pitch: number; // torso: + = leans forward
  legL: number; // relative forward swing (rad)
  legR: number;
  armL: number; // relative forward raise (rad)
  armR: number;
  outL: number; // sideways raise (rad)
  outR: number;
  headPitch: number; // + = looks down
  headYaw: number;
  /** upper body only (torso, arms, head): side sway (rad, about the forward axis) and twist (rad, about up) */
  sway?: number;
  twist?: number;
  /** upper body sinks this much (m, <= 0) into the hips: the walk bob */
  bob?: number;
  /** held cone: extra tilt [about the body x (+ = top forward), about the body z (+ = top to the RIGHT)] after it is
   * made world-upright */
  coneTilt?: [number, number];
  /** antennae: 0 = relaxed splay, 1 = straight up (shock), -1 = drooped */
  ant?: number;
  /** antennae wobble (rad), animated by the caller */
  antWob?: number;
};

// ------------------------------------------------------------------ small helpers
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const ss = (a: number, b: number, t: number) => {
  const u = clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};
export const easeOutBack = (u: number, k = 2.2) => {
  const x = clamp(u) - 1;
  return 1 + (k + 1) * x * x * x + k * x * x;
};
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** piecewise-smooth keyframes [t, value] (smoothstep between keys) */
export const keys = (k: [number, number][], t: number) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], ss(k[i - 1][0], k[i][0], t));
  return k[k.length - 1][1];
};
/** keyframes with an ease-IN between keys (falls accelerate) */
const keysIn = (k: [number, number][], t: number) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++)
    if (t <= k[i][0]) {
      const u = clamp((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
      return lerp(k[i - 1][1], k[i][1], u * u);
    }
  return k[k.length - 1][1];
};
const bisect = (f: (x: number) => number, lo: number, hi: number) => {
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
};

// ------------------------------------------------------------------ story times (s)
// story times: S4 (sky) is 0.65 s and S5 starts at 4.95 so the catch plays on screen
export const T = {
  S1: 0, S2: 1.4, S3: 3.2, S4: 4.3, S5: 4.95, S6: 6.8, S6b: 7.45, S7: 8.3, END: 10,
  catch: 3.42, // A's right toe meets the rock (held 2.4 frames)
  tip: 3.52, // he starts to tip over the left toe (toe-on-rock held 3 frames)
  release: 3.68, // the top scoop leaves the cone at the top of the arm fling
  hit: 4.1, // belly hits the grass
  sit: 4.6, // off-screen (S4 looks at the sky): lying -> sitting
  land: 5.78, // scoop lands in B's cone; her face flips on this frame
  bloom: 5.84, // B's ring of flowers starts
  shockA: 6.8,
  sadA: 7.3,
  greyA: 6.95, // A's patch starts to grey
  dust: 4.1, // dust puff at the belly-flop
  slump: 8.45, // in S7 he slumps further while his last flowers droop
  lookUp: 9.3, // ... then looks up at her while her last flowers pop
  S7b: 9.2, // cut to a closer two-shot for the payoff
};

// ------------------------------------------------------------------ walk (inverted pendulum on rigid box legs)
// stance shoe rolls heel -> flat -> toe, hip height = the leg's lowest point, swing leg mirrors the stance leg
// (rigid legs: the swing sole grazes the grass at mid-stance, never goes under it). +-28 deg, 2.3 steps/s.
export const WALK = (() => {
  const TH = (30 * Math.PI) / 180;
  const S = D * (1 - Math.cos(TH)) + 2 * L * Math.sin(TH); // step length
  const TS = 0.44; // one step (gait 1.14 Hz)
  const V = S / TS;
  const XC = -0.5; // hip x at the catch
  const T0 = T.catch - TS / 2 - 7 * TS; // = 0.12: heel strike of step 0 (right foot, camera side)
  const X0 = XC - V * T.catch;
  return { TH, S, V, TS, XC, T0, X0, LEAN: 0.06 };
})();
const xFromPhi = (phi: number, heel: number) =>
  phi >= 0 ? heel + (D / 2) * Math.cos(phi) - L * Math.sin(phi) : heel + D - (D / 2) * Math.cos(phi) - L * Math.sin(phi);

/** step k (heel strike time, foot, heel x) */
export const stepOf = (k: number) => {
  const { T0, TS, X0, V, TH } = WALK;
  const ts = T0 + k * TS;
  const xs = X0 + V * ts;
  const heel = xs - (D / 2) * Math.cos(TH) + L * Math.sin(TH);
  return { k, t: ts, side: (((k % 2) + 2) % 2 === 0 ? "R" : "L") as "L" | "R", heel };
};

const SINK = 0.015; // soles press 15 mm into the grass (a shoe exactly on the surface reads as hovering)
export const walkAt = (t: number) => {
  const { T0, TS, X0, V } = WALK;
  const k = Math.floor((t - T0) / TS);
  const st = stepOf(k);
  const xh = X0 + V * t;
  const phi = bisect((p) => -(xFromPhi(p, st.heel) - xh), -0.7, 0.7);
  return { x: xh, y: legDrop(phi) - SINK, psiL: st.side === "L" ? phi : -phi, psiR: st.side === "R" ? phi : -phi, k, phase: (t - st.t) / TS };
};

// ------------------------------------------------------------------ the rock + the trip (3 readable steps + ground hit)
// 1 hook: toe stops at the rock, held 2.4 frames, torso folds forward at the hip, arms start up
// 2 tip: the body rotates over the left toe, the hooked right leg kicks up behind, arms fling up (scoop leaves)
// 3 fall: belly-flop onto the grass with a small bounce, arms stretched forward, cone kept upright; head lifts
// the rock is big enough for the toe hit to read
export const ROCK = { x: WALK.XC + D / 2 + 0.175, z: SPEC.hipX * U + 0.04, rx: 0.15, h: 0.18 }; // 4 cm outward: clear of the left shoe
const toeL = WALK.XC + D / 2;
export const XA = toeL + L; // hip x when lying; he sits up on the same spot
const fallAt = (t: number) => {
  // ONE ease-in from the tip to the hit (gravity-like: slow start, fastest at the impact). The old
  // 2-segment ease restarted at zero speed at 3.92 s and left him hanging at ~55 deg.
  const psiL = keysIn([[T.catch, 0], [T.tip, -0.03], [T.hit, -Math.PI / 2]], t);
  // the hooked right leg kicks up, then comes to rest propped on the rock (shin on top of it)
  const kick = keys([[T.catch, 0], [T.tip, 0], [3.85, 0.62], [T.hit, 0.64], [4.3, 0.6]], t); // rests on the bigger rock
  const psiR = psiL - kick;
  const bend = keys([[T.catch, 0.05], [T.tip, 0.3], [3.8, 0.42], [T.hit, 0], [4.18, 0.06], [4.35, 0]], t);
  const pitch = -psiL + bend;
  // hip from the left toe pivot; after the hit, lying flat
  const x = toeL - ((D / 2) * Math.cos(psiL) + L * Math.sin(psiL));
  const bounce = t > T.hit && t < T.hit + 0.14 ? 0.035 * Math.sin((Math.PI * (t - T.hit)) / 0.14) : 0;
  const yPivot = Math.min(L - SINK, L * Math.cos(psiL) - (D / 2) * Math.sin(psiL)); // descends continuously
  const y = Math.max(yPivot, legDrop(psiR)) + bounce;
  return { x, y, psiL, psiR, pitch };
};
export const SIT = { yaw: 1.0, y: (SPEC.shoe.d * U) / 2 };

// ------------------------------------------------------------------ kid A
export type Emotion = "happy" | "shock" | "sad" | "joy" | "sly" | "love" | "curious";
export const poseA = (t: number): Pose => {
  if (t < T.catch) {
    const w = walkAt(t);
    return {
      x: w.x, y: w.y, z: 0, yaw: Math.PI / 2, pitch: WALK.LEAN,
      legL: w.psiL + WALK.LEAN, legR: w.psiR + WALK.LEAN,
      // the cone is in his LEFT (far-side) hand; the near right arm swings free and low, never over his face
      armR: -0.95 * w.psiR, armL: 1.15 + 0.1 * Math.sin((Math.PI * (t - WALK.T0)) / WALK.TS),
      outL: 0.02, outR: 0.02, headPitch: -0.06 + 0.03 * Math.cos((2 * Math.PI * (t - WALK.T0)) / WALK.TS), headYaw: 0,
      // a happy walk: the upper body sways over the stance foot and twists against the legs (gait 1.1 Hz)
      sway: 0.045 * Math.cos((Math.PI * (t - WALK.T0)) / WALK.TS), twist: 0.09 * Math.sin((Math.PI * (t - WALK.T0)) / WALK.TS),
      bob: -0.02 * (0.5 + 0.5 * Math.cos((2 * Math.PI * (t - WALK.T0)) / WALK.TS)), // lowest at each heel contact
    };
  }
  if (t < T.sit) {
    const f = fallAt(t);
    const armR = keys([[T.catch, -0.95 * walkAt(T.catch).psiR], [T.tip, 0.9], [3.64, 1.75], [3.9, 2.4], [T.hit, 3.25], [4.3, 3.3]], t);
    const armL = keys([[T.catch, 1.15], [T.tip, 1.4], [T.release, 2.55], [T.hit, 3.25], [4.3, 3.3]], t);
    const out = keys([[T.catch, 0.02], [3.7, 0.32], [T.hit, 0.42], [4.35, 0.5]], t); // belly-flop: arms spread in a V
    const headPitch = keys([[T.catch, -0.06], [T.tip, -0.25], [3.92, -0.45], [T.hit, -0.2], [4.35, -0.7]], t);
    return { x: f.x, y: f.y, z: 0, yaw: Math.PI / 2, pitch: f.pitch, legL: f.psiL + f.pitch, legR: f.psiR + f.pitch, armL, armR, outL: out, outR: out, headPitch, headYaw: 0 };
  }
  // sitting on the grass, legs forward: shock, then sad looking down at what is left of his cone
  const sad = ss(T.sadA, T.sadA + 0.45, t);
  const breathe = 0.015 * Math.sin(t * 2.4);
  const slump = ss(T.slump, T.slump + 0.8, t); // in the final wide he sinks further
  const lookUp = ss(T.lookUp, T.lookUp + 0.4, t);
  const pitch = lerp(-0.12, 0.1, sad) + 0.14 * slump;
  return {
    x: XA, y: SIT.y + 0.004, z: 0, yaw: SIT.yaw, pitch,
    legL: Math.PI / 2 + pitch, legR: Math.PI / 2 + pitch,
    armR: lerp(0.55, 0.12, sad) - 0.06 * slump, armL: lerp(1.0, 0.72, sad) - 0.3 * slump,
    outR: lerp(0.4, 0.06, sad), outL: lerp(0.3, 0.04, sad),
    // last beat: he lifts his head and turns it toward her
    headPitch: lerp(lerp(-0.12, 0.36, sad) + 0.2 * slump, -0.06, lookUp) + breathe, headYaw: lerp(lerp(0, 0.12, sad) + 0.1 * slump, 0.34, lookUp),
  };
};
export const emotionA = (t: number): Emotion => (t < T.catch + 0.04 ? "happy" : t < T.sadA ? "shock" : "sad");
export const blinkA = (t: number) => (t > 2.3 && t < 2.4) || (t > 9.3 && t < 9.4);
export const scoopsA = (t: number) => (t < T.release ? 2 : 1);

// ------------------------------------------------------------------ kid B
export const XB = XA + 1.95;
export const ZB = 0.5;
// B faces A's side but turned 3/4 toward the +z lenses; after her hop she turns a little more to the front
// she faces the S5 lens more and holds the cone out to her RIGHT side (screen-left, toward A), so the
// falling scoop drops into it beside her face, never across it
const yawB = (t: number) => lerp(-0.5, -0.65, ss(6.3, 6.8, t));
export const poseB = (t: number): Pose => {
  const hop = t > 5.92 && t < 6.36 ? 0.18 * Math.pow(Math.sin((Math.PI * (t - 5.92)) / 0.44), 2) : 0;
  const bounce = t > 6.6 ? 0.05 * Math.abs(Math.sin(Math.PI * 1.4 * (t - 6.6))) : 0; // 1.4 bounces/s
  const pitch = keys([[0, 0.07], [5.5, 0.07], [T.land, -0.05]], t);
  // the cone arm: lifts to catch, a small dip on the landing, then raised proudly
  const dip = t > T.land && t < T.land + 0.16 ? -0.12 * Math.sin((Math.PI * (t - T.land)) / 0.16) : 0;
  const armR = keys([[0, 0.78], [5.3, 0.78], [5.6, 1.05], [T.land, 1.05], [6.1, 1.25]], t) + dip + 0.025 * Math.sin(t * 1.7); // cone arm
  const coneOut = keys([[0, 0.12], [5.3, 0.12], [5.6, 0.62], [T.land, 0.62], [6.2, 0.35]], t);
  const cheer = keys([[0, 0.04], [T.land + 0.05, 0.04], [6.05, 2.65]], t);
  const armL = cheer + (t > 6.3 ? 0.2 * Math.sin(2 * Math.PI * 1.0 * (t - 6.3)) : 0);
  const headPitch = keys([[0, 0.32], [5.3, 0.32], [5.55, -0.18], [T.land, 0.12], [5.98, -0.16]], t) + 0.015 * Math.sin(t * 2.1);
  return {
    x: XB, y: L + hop + bounce, z: ZB, yaw: yawB(t), pitch,
    legL: pitch, legR: pitch, armL, armR,
    outL: keys([[0, 0.05], [T.land, 0.05], [6.05, 0.25]], t), outR: coneOut,
    headPitch, headYaw: keys([[0, 0], [5.3, 0], [5.55, -0.35], [T.land, -0.3], [6.1, 0]], t),
    coneTilt: [keys([[0, 0], [5.35, 0], [5.6, 0.15], [T.land, 0.15], [6.0, 0]], t), keys([[0, 0], [5.35, 0], [5.6, 0.42], [T.land, 0.42], [6.0, 0.05]], t)],
  };
};
export const emotionB = (t: number): Emotion => (t < T.land ? "sad" : "joy");
export const blinkB = (t: number) => (t > 1.0 && t < 1.1) || (t > 8.9 && t < 9.0);

// ------------------------------------------------------------------ forward kinematics (mirrors Blocky.tsx's group tree)
const M4 = () => new THREE.Matrix4();
/** world matrix of the root (hips) */
export const rootMatrix = (p: Pose) =>
  M4().makeTranslation(p.x, p.y, p.z).multiply(M4().makeRotationY(p.yaw)).multiply(M4().makeRotationX(p.pitch));
/** world matrix of the upper body (torso, arms, head): root, then twist (Y) and sway (Z) */
export const upperMatrix = (p: Pose) =>
  rootMatrix(p).multiply(M4().makeTranslation(0, p.bob ?? 0, 0)).multiply(M4().makeRotationY(p.twist ?? 0)).multiply(M4().makeRotationZ(p.sway ?? 0));
/** world matrix of the cone held in hand `side`: just past the arm end, kept upright in the WORLD (y up; rim at +h/2) */
export const coneMatrix = (p: Pose, side: "L" | "R") => {
  const sx = side === "L" ? 1 : -1;
  const raise = side === "L" ? p.armL : p.armR;
  const out = side === "L" ? p.outL : p.outR;
  return upperMatrix(p)
    .multiply(M4().makeTranslation(sx * shoulderXOf(out), SHOULDER_Y, 0))
    .multiply(M4().makeRotationZ(sx * out))
    .multiply(M4().makeRotationX(-raise))
    .multiply(M4().makeTranslation(0, -HAND - GRIP, 0))
    // exact inverse of pitch, twist, sway, side raise and raise: the cone is upright in the world (if the side
    // raise is not undone, the cone tilts 35 deg toward her face), then the deliberate tilt
    .multiply(M4().makeRotationX(raise))
    .multiply(M4().makeRotationZ(-sx * out))
    .multiply(M4().makeRotationZ(-(p.sway ?? 0)))
    .multiply(M4().makeRotationY(-(p.twist ?? 0)))
    .multiply(M4().makeRotationX(-p.pitch))
    .multiply(M4().makeRotationX(p.coneTilt?.[0] ?? 0))
    .multiply(M4().makeRotationZ(p.coneTilt?.[1] ?? 0))
    .multiply(M4().makeTranslation(0, -0.02, 0));
};
export const scoopWorld = (p: Pose, side: "L" | "R", idx: number): V3 => {
  const v = new THREE.Vector3(0, CONE.h / 2 + SCOOP_SEAT + idx * SCOOP_STACK, 0).applyMatrix4(coneMatrix(p, side));
  return [v.x, v.y, v.z];
};
/** sole centre (world) of a leg, for contact shadows */
export const soleWorld = (p: Pose, side: "L" | "R"): V3 => {
  const sx = side === "L" ? 1 : -1;
  const v = new THREE.Vector3(0, -L, 0).applyMatrix4(
    rootMatrix(p).multiply(M4().makeTranslation(sx * SPEC.hipX * U, 0, 0)).multiply(M4().makeRotationX(-(side === "L" ? p.legL : p.legR))),
  );
  return [v.x, v.y, v.z];
};

// ------------------------------------------------------------------ the flying scoop
const P0 = scoopWorld(poseA(T.release), "L", 1);
const P1 = scoopWorld(poseB(T.land), "R", 0);
export const FLIGHT = { P0, P1, H: 1.6 };
export const scoopFlight = (t: number): { p: V3; spin: number } | null => {
  if (t < T.release || t >= T.land) return null;
  const u = (t - T.release) / (T.land - T.release);
  const h = 4 * FLIGHT.H * u * (1 - u);
  return { p: [lerp(P0[0], P1[0], u), lerp(P0[1], P1[1], u) + h, lerp(P0[2], P1[2], u)], spin: u * Math.PI * 2 * 1.2 };
};

// ------------------------------------------------------------------ flowers
export type FlowerSpec = { p: V3; t0: number; s: number; col: number; seed: number; trail: boolean; wiltAt?: number };
const FOOT_Z = SPEC.hipX * U;
const PALETTE = 6;
export const POP = 0.2; // s, pop duration (opaque and full size fast: the hook must read by 0.4 s)
export const FLOWERS: FlowerSpec[] = (() => {
  const out: FlowerSpec[] = [];
  let seed = 1;
  // A's trail: on the OUTER side of each footprint when the foot lands, and IN the footprint when the foot lifts
  // (rigid swing legs graze the grass in line with the feet, so nothing grows ahead of or behind a planted foot)
  for (let k = -9; k <= 7; k++) {
    const st = stepOf(k);
    const zs = st.side === "R" ? 1 : -1; // right = +z for A walking +x
    const zf = zs * FOOT_Z;
    const lifts = st.t + WALK.TS;
    const nOut = k >= 0 && k <= 2 ? 3 : 2; // the hook's first steps get one more
    const big = k >= -1 && k <= 3 ? 1.55 : 1; // hook steps: big foreground flowers (set further out so petals stay clear)
    for (let i = 0; i < nOut; i++) {
      const h = hash(seed * 3.1);
      out.push({ p: [st.heel - 0.02 + i * 0.15 + h * 0.05, 0, zf + zs * ((big > 1 ? 0.44 : 0.33) + 0.07 * hash(seed * 5.3))], t0: st.t + i * 0.05, s: (1.35 + 0.35 * h) * big, col: seed % PALETTE, seed: seed++, trail: true });
    }
    if (st.t < T.catch) {
      const h = hash(seed * 4.4);
      out.push({ p: [st.heel - (big > 1 ? 0.38 : 0.24), 0, zf + zs * (big > 1 ? 0.1 : 0.03) + (h - 0.5) * 0.04], t0: st.t + 0.04, s: (1.2 + 0.2 * h) * big, col: seed % PALETTE, seed: seed++, trail: true });
    }
    if (lifts < T.catch) {
      for (let i = 0; i < 2; i++) {
        const h = hash(seed * 7.7);
        out.push({ p: [st.heel + 0.04 + i * 0.12, 0, zf + (h - 0.5) * 0.08], t0: lifts + 0.15 + i * 0.06, s: 1.2 + 0.3 * h, col: seed % PALETTE, seed: seed++, trail: true });
      }
    }
  }
  // B's burst ring
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + hash(i * 1.3) * 0.25;
    const r = 0.45 + 0.6 * hash(i * 2.9);
    out.push({ p: [XB + Math.cos(a) * r, 0, ZB + Math.sin(a) * r], t0: T.bloom + (r - 0.45) * 0.5 + hash(i) * 0.04, s: 1.7 + 0.45 * hash(i * 4.1), col: i % PALETTE, seed: 100 + i, trail: false });
  }
  // her last flowers keep popping on the far side of her ring while he looks up (S7)
  for (let i = 0; i < 6; i++) {
    const a = -0.9 + i * 0.55;
    const r = 1.12 + 0.12 * hash(i * 6.1);
    out.push({ p: [XB + Math.cos(a) * r, 0, ZB + Math.sin(a) * r], t0: 9.1 + i * 0.12, s: 1.9, col: (i + 2) % PALETTE, seed: 150 + i, trail: false });
  }
  // the one flower that pops beside him when he hits the grass (and then wilts with the rest)
  // + 4 more around him (behind and beside, clear of his lying and sitting limbs). They droop one by one in S7.
  const ring: [number, number][] = [[0.15, 0.64], [-0.51, 0.61], [-0.85, 0.07], [-0.61, -0.51], [-0.07, -0.82]];
  ring.forEach(([dx, dz], i) => out.push({ p: [XA + dx, 0, dz], t0: T.hit + 0.04 + i * 0.05, s: 2.0, col: (i + 1) % PALETTE, seed: 200 + i, trail: false, wiltAt: 8.4 + i * 0.14 }));
  // A's trail wilts from where he sits backwards and stays drooped (grey-brown)
  for (const f of out) if (f.trail) f.wiltAt = 7.0 + Math.max(0, XA - f.p[0]) * 0.1;
  return out;
})();
/** grey patches: B's recedes from the inside out as her ring blooms; A's spreads under him (centre behind him) */
export const greyB = (t: number) => ({ inner: 1.12 * ss(T.bloom, T.bloom + 0.5, t), outer: 1.12 });
// his patch: ~2 m across behind and around him (away from her ring), spreading while he turns sad
export const GREY_A_C: V3 = [XA - 0.6, 0, 0.05];
export const greyA = (t: number) => 1.75 * ss(T.greyA, 7.9, t);
