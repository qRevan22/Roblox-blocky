// Reusable characters of the blocky family: the alien looks (DAD with hat + bag, KID
// with big eyes + rocket backpack, KID_PJ, SELLER small with apron + tiny glasses, a CROWD of 7), the template's humans
// (KID_A, KID_B in blocky/Blocky.tsx), and the motion kit every Short needs:
//   base / walk / sit   pose builders (pure functions of t)
//   alive(actor, t)     the idle layer: breathing, sway, head + arm drift, antenna wobble (never stand still)
//   pop / popT          anticipation + overshoot for big moves (keep >= 0.7 s for a big arm move: <= ~4 rad/s)
//   heldWorld / facePoint  where a held prop / a face is in the world (aim lenses at them, check framing)
// Stage a story with these: pose builders + alive() on everyone + pop() on big moves.
import type React from "react";
import * as THREE from "three";
import type { Held, Look } from "../blocky/Blocky";
import { coneMatrix, hash, L, legDrop, SPEC, U } from "../blocky/motion";
import type { Emotion, Pose, V3 } from "../blocky/motion";

export type Actor = { key: string; look: Look; pose: Pose; emotion: Emotion; s: number; held?: Held; chest?: React.ReactNode; blinkSeed: number };

// ------------------------------------------------------------------ looks
export const DAD: Look = { skin: "#6fcf5a", shirt: "#2a7de1", pants: "#3b3f58", shoes: "#f4f4f2", sole: "#ff7a1a", hair: "#5fb84a", hairStyle: "antennae", accent: "#ffd23a", print: "ring", cheeks: "none", belt: "#2a2a3a", cuffs: "#ffd23a", acc: { hat: ["#3a3f58", "#ffd23a"], bag: "#c87a3a" } };
export const KID: Look = { skin: "#9be36e", shirt: "#ff8a1f", pants: "#2f63c9", shoes: "#ffffff", sole: "#2fd0bd", hair: "#86d05c", hairStyle: "antennae", accent: "#ff4fa3", print: "star", cheeks: "blush", eyeScale: 1.38, belt: "#2a3a8a", cuffs: "#ffd23a", acc: { backpack: ["#ff4fa3", "#ffd23a"] } };
export const KID_PJ: Look = { ...KID, shirt: "#5fb8ff", pants: "#3a5ad0", print: "star", accent: "#ffd23a", belt: undefined, cuffs: "#ffffff", acc: undefined };
export const SELLER: Look = { skin: "#b48cf0", shirt: "#d6283c", pants: "#2a2a3a", shoes: "#1a1a22", sole: "#ffd23a", hair: "#a07ae0", hairStyle: "antenna1", accent: "#7dffcf", print: "bow", cheeks: "none", cuffs: "#ffd23a", acc: { apron: "#2fd0bd", glasses: "#ffd23a" } };
export const CROWD: Look[] = ([
  { ...DAD, skin: "#f0a040", hair: "#e09030", shirt: "#7fe3b8", accent: "#ff4fa3", print: "heart" },
  { ...KID, skin: "#5fd8ff", hair: "#4fc0e8", shirt: "#ffd23a", accent: "#ff7a1a", print: "bolt" },
  { ...SELLER, skin: "#ff8ac8", hair: "#e870b0", shirt: "#2fd0bd", accent: "#ffd23a", print: "star", hairStyle: "antennae" },
  { ...DAD, skin: "#c8e04a", hair: "#a8c03a", shirt: "#b04ae0", accent: "#7dffcf", print: "ring" },
  { ...KID, skin: "#ff9a6a", hair: "#e8805a", shirt: "#2a7de1", accent: "#ffd23a", print: "heart", hairStyle: "antenna1" },
  { ...SELLER, skin: "#7fe3b8", hair: "#5fc898", shirt: "#ff5aa0", accent: "#5fd8ff", print: "bolt", hairStyle: "antennae" },
  { ...DAD, skin: "#a08aff", hair: "#8a70f0", shirt: "#ff8a1f", accent: "#7dffcf", print: "star" },
] as Look[]).map((l) => ({ ...l, acc: undefined, eyeScale: 1.1, belt: "#2a2a3a" }));

export const SCALE = { dad: 1.2, kid: 1, seller: 0.7, human: 1, crowd: 1.05 };
export const SINK = 0.003; // hard floors: soles barely pressed in
export const GRASS_SINK = 0.012;
/** face (head centre) height above the feet for a standing character of scale s */
export const faceH = (s: number) => (L + (SPEC.torso.h + SPEC.head.gap + SPEC.head.h / 2) * U) * s;

// ------------------------------------------------------------------ pose builders
export const base = (x: number, z: number, yaw: number, s: number, o: Partial<Pose> = {}, sink = SINK): Pose => ({
  x, y: (L - sink) * s, z, yaw, pitch: 0, legL: 0, legR: 0, armL: 0.06, armR: 0.06, outL: 0.05, outR: 0.05, headPitch: 0, headYaw: 0, ...o,
});
/** a walk toward yaw at v m/s from (x0, z0) at t0: rigid legs +-0.42, counter arms, a small bob */
export const walk = (x0: number, z0: number, yaw: number, t: number, t0: number, v: number, s: number, o: Partial<Pose> = {}, sink = SINK): Pose => {
  const d = v * (t - t0);
  const ph = 2 * Math.PI * 1.1 * (t - t0);
  const psi = 0.42 * Math.sin(ph);
  return {
    ...base(x0 + Math.sin(yaw) * d, z0 + Math.cos(yaw) * d, yaw, s, {}, sink),
    y: (legDrop(Math.abs(psi)) - sink) * s,
    legL: psi, legR: -psi, armL: -0.55 * psi, armR: 0.55 * psi,
    bob: -0.015 * (0.5 + 0.5 * Math.cos(2 * ph)), sway: 0.03 * Math.cos(ph), headPitch: 0.02 * Math.cos(2 * ph),
    ...o,
  };
};
/** sitting on the floor, legs forward */
export const sit = (x: number, z: number, yaw: number, o: Partial<Pose> = {}): Pose => {
  const pitch = o.pitch ?? 0;
  return { ...base(x, z, yaw, 1), y: (SPEC.shoe.d * U) / 2 + 0.004, legL: Math.PI / 2 + pitch, legR: Math.PI / 2 + pitch, armL: 0.5, armR: 0.5, outL: 0.12, outR: 0.12, ...o };
};
export const breathe = (t: number, seed: number) => 0.012 * Math.sin(t * 2.2 + seed);
/** anticipation + overshoot for big moves: a small dip back, then a fast move that overshoots and settles (0 -> 1) */
export const pop = (u: number) => {
  if (u <= 0) return 0;
  if (u < 0.18) return -0.14 * Math.sin((Math.PI * u) / 0.18);
  const x = Math.min(1, (u - 0.18) / 0.82) - 1;
  return 1 + 2.6 * x * x * x + 1.6 * x * x;
};
export const popT = (tau: number, t0: number, dur: number) => pop((tau - t0) / dur);
/** the idle layer on every actor: breathing, a slow sway, a drifting head, arms that never freeze, wobbling antennae */
export const alive = (a: Actor, t: number): Actor => {
  const s = a.blinkSeed * 1.7;
  const p = a.pose;
  const br = Math.sin(t * 2.1 + s);
  return {
    ...a,
    pose: {
      ...p,
      bob: (p.bob ?? 0) - 0.006 * (1 + br),
      sway: (p.sway ?? 0) + 0.014 * Math.sin(t * 0.9 + s),
      headPitch: p.headPitch + 0.018 * Math.sin(t * 1.3 + s * 2),
      headYaw: p.headYaw + 0.045 * Math.sin(t * 0.7 + s),
      armL: p.armL + 0.035 * Math.sin(t * 1.1 + s),
      armR: p.armR + 0.035 * Math.sin(t * 1.2 + s + 1),
      antWob: (p.antWob ?? 0) + 0.12 * Math.sin(t * 5.2 + s) + 0.05 * Math.sin(t * 8.3 + s * 3),
    },
  };
};
export const blinkAt = (t: number, seed: number) => {
  const u = (t * 0.37 + hash(seed)) % 1;
  return u < 0.028;
};
export const yawTo = (from: [number, number], to: [number, number]) => Math.atan2(to[0] - from[0], to[1] - from[1]);

/** world point of something held in a hand (local offset above the grip), with the character's scale */
export const heldWorld = (p: Pose, side: "L" | "R", s: number, local: V3 = [0, 0, 0]): V3 => {
  const p0: Pose = { ...p, x: 0, y: 0, z: 0, yaw: 0, coneTilt: undefined };
  const M = new THREE.Matrix4()
    .makeTranslation(p.x, p.y, p.z)
    .multiply(new THREE.Matrix4().makeRotationY(p.yaw))
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(coneMatrix(p0, side))
    .multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0));
  const v = new THREE.Vector3(...local).applyMatrix4(M);
  return [v.x, v.y, v.z];
};
export const facePoint = (p: Pose, s: number): V3 => {
  // head centre: hip pivot + torso + gap + half head, through yaw and pitch
  const h = (SPEC.torso.h + SPEC.head.gap + SPEC.head.h / 2) * U * s;
  return [p.x + Math.sin(p.yaw) * Math.sin(p.pitch) * h, p.y + Math.cos(p.pitch) * h, p.z + Math.cos(p.yaw) * Math.sin(p.pitch) * h];
};

