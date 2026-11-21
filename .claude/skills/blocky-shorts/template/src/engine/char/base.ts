// The base character's build and its arm chain. Shared by BaseCharacter (drawing) and core/ik.ts (props in the hand),
// so a hand placed by IK is exactly where the drawn hand is. All lengths are fractions of the character's height.
//
// REPLACE WITH YOUR OWN DESIGN. This is a neutral placeholder build. Pick one character family for your series,
// fix its proportions, outfit and face rules, write them down, and keep every character inside them.
import * as THREE from "three";

export type Build = {
  legH: number; // hip height
  bodyW: number; // body width (the body is a rounded capsule)
  bodyH: number; // body height above the hips
  headD: number; // head diameter
  neck: number; // gap between body top and head bottom
  shoulderY: number; // shoulder joint height
  shoulderX: number; // shoulder joint distance from the center line
  arm1: number; // upper arm
  arm2: number; // forearm (to the hand center)
  limb: number; // limb radius
  hand: number; // hand radius
};

export const DEFAULT_BUILD: Build = {
  legH: 0.3,
  bodyW: 0.3,
  bodyH: 0.4,
  headD: 0.27,
  neck: 0.02,
  shoulderY: 0.64,
  shoulderX: 0.13,
  arm1: 0.17,
  arm2: 0.16,
  limb: 0.032,
  hand: 0.042,
};
export const buildOf = (b?: Partial<Build>): Build => ({ ...DEFAULT_BUILD, ...(b ?? {}) });

export type ArmPose = { armL?: [number, number]; armR?: [number, number]; armLFwd?: number; armRFwd?: number; lean?: number; bob?: number };
const D2R = Math.PI / 180;
/** the arm plane is turned a little toward the camera so arms read in 3/4 views */
export const ARM_FWD0 = 14 * D2R;

/** local shoulder, elbow and hand center of one arm (unit height, before bob / lean / yaw).
 * pose angles: [shoulder, elbow] in degrees, 0 = hanging straight down, + = raised outward / forward in the arm plane;
 * armXFwd turns the arm plane forward (+, in front of the body) in degrees. */
export const armChain = (pose: ArmPose, side: "L" | "R", b: Build) => {
  const s = side === "L" ? -1 : 1;
  const ang = (side === "L" ? pose.armL : pose.armR) ?? [8, 4];
  const fw = ARM_FWD0 + ((side === "L" ? pose.armLFwd : pose.armRFwd) ?? 0) * D2R;
  const out = new THREE.Vector3(s * Math.cos(fw), 0, Math.sin(fw));
  const up = new THREE.Vector3(0, 1, 0);
  const r1 = ang[0] * D2R;
  const r2 = (ang[0] + ang[1]) * D2R;
  const S = new THREE.Vector3(s * b.shoulderX, b.shoulderY, 0);
  const E = S.clone().addScaledVector(out, b.arm1 * Math.sin(r1)).addScaledVector(up, -b.arm1 * Math.cos(r1));
  const H = E.clone().addScaledVector(out, b.arm2 * Math.sin(r2)).addScaledVector(up, -b.arm2 * Math.cos(r2));
  return { S, E, H };
};
