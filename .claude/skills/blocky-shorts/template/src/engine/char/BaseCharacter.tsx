// BaseCharacter: ONE neutral placeholder character. REPLACE WITH YOUR OWN DESIGN.
// It shows the techniques a series character needs, whatever it looks like:
//   - lit and shadow side: world toon materials + the per-character CastLight rig;
//   - character ink heavier than set ink: an inverted hull on head and body (the post pass inks the rest);
//   - a 3/4 head turn: turnTo (the camera) turns the head by turnAmount and keeps it 20-35 deg off the lens;
//   - acting: deterministic blinks, expressions, breathing, head tilt, lean, walk swing;
//   - props held IN the hand: the arm chain is shared with core/ik.ts (solveArm, handWorld, holdInFront).
// Build (proportions) and colors are parameters; nothing here is a finished design.
import React from "react";
import * as THREE from "three";
import { toonMaterial } from "../mat/materials";
import type { Eyes, Mouth, V3 } from "../types";
import { armChain, buildOf } from "./base";
import type { ArmPose, Build } from "./base";

export type BaseLook = {
  skin?: string;
  shirt?: string;
  pants?: string;
  shoes?: string;
  hair?: string | false; // a simple hair cap
  hat?: string | false; // a simple rounded cap with a brim
  ink?: string; // hull color (dark, a little warm)
};
export type BaseFace = { eyes?: Eyes; mouth?: Mouth; brows?: "none" | "raised" | "worried" | "angry"; blink?: boolean };
export type BasePose = ArmPose & { headTilt?: number; headYaw?: number; walk?: number };
export type BaseCharacterProps = {
  position: V3;
  yaw?: number;
  height?: number;
  build?: Partial<Build>;
  look?: BaseLook;
  face?: BaseFace;
  pose?: BasePose;
  /** seconds, drives blinks and breathing */
  t?: number;
  /** turn the HEAD toward this point (usually the camera) */
  turnTo?: V3;
  turnAmount?: number;
  seed?: number;
};

const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const sph = new THREE.SphereGeometry(1, 32, 22);
const brim = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI / 2, Math.PI);
const capCache = new Map<string, THREE.BufferGeometry>();
const cap = (r: number, len: number) => {
  const k = `${r.toFixed(4)}|${len.toFixed(4)}`;
  let g = capCache.get(k);
  if (!g) {
    g = new THREE.CapsuleGeometry(r, len, 8, 18);
    capCache.set(k, g);
  }
  return g;
};
const flat = (c: string) => toonMaterial({ color: c });
const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** an inverted-hull ink shell (BackSide, unlit; the post pass skips it so ink is not doubled) */
const hull = (c: string) => {
  let m = basicCache.get("h" + c);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide });
    basicCache.set("h" + c, m);
  }
  return m;
};
const unlit = (c: string) => {
  let m = basicCache.get("u" + c);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    basicCache.set("u" + c, m);
  }
  return m;
};

/** a limb segment between two local points (a capsule) */
const Limb: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; mat: THREE.Material }> = ({ a, b, r, mat }) => {
  const d = b.clone().sub(a);
  const len = Math.max(1e-4, d.length());
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return <mesh geometry={cap(r, len)} material={mat} position={mid} quaternion={q} castShadow receiveShadow />;
};

/** deterministic blinks: one every ~3.9 s, 0.1 s long, about 18% doubles */
const blinkAt = (t: number, seed: number) => {
  const P = 3.9;
  const x = t + seed * 1.37;
  const k = Math.floor(x / P);
  const ph = x - k * P;
  const dbl = (k * 7919 + seed * 31) % 100 < 18;
  const on = (u: number) => (u >= 0 && u < 0.1 ? Math.sin((u / 0.1) * Math.PI) : 0);
  return Math.max(on(ph - 1.2), dbl ? on(ph - 1.42) : 0);
};

/** a feature glued to the head sphere at (yaw, pitch), facing outward */
const OnHead: React.FC<{ R: number; yaw: number; pitch: number; children: React.ReactNode }> = ({ R, yaw, pitch, children }) => {
  const n = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return (
    <group position={n.clone().multiplyScalar(R)} quaternion={q}>
      {children}
    </group>
  );
};

export const BaseCharacter: React.FC<BaseCharacterProps> = (props) => {
  const h = props.height ?? 1.75;
  const b = buildOf(props.build);
  const look = props.look ?? {};
  const face = props.face ?? {};
  const pose = props.pose ?? {};
  const t = props.t ?? 0;
  const seed = props.seed ?? 1;
  const yaw = props.yaw ?? 0;
  const skin = flat(look.skin ?? "#e8b48c");
  const shirt = flat(look.shirt ?? "#4a7ab8");
  const pants = flat(look.pants ?? "#3a3a4a");
  const shoes = flat(look.shoes ?? "#2a2226");
  const ink = look.ink ?? "#1c1418";
  const dark = unlit("#1a1418");

  // head turn: toward turnTo by turnAmount, kept at least 20 deg off the lens (a 3/4 head, never dead frontal)
  let headYaw = (pose.headYaw ?? 0) * D2R;
  if (props.turnTo) {
    const target = Math.atan2(props.turnTo[0] - props.position[0], props.turnTo[2] - props.position[2]);
    const d = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
    let turned = d * (props.turnAmount ?? 0.75);
    const off = d - turned;
    if (Math.abs(off) < 20 * D2R) turned = d - (off >= 0 ? 1 : -1) * 20 * D2R;
    headYaw += Math.max(-70 * D2R, Math.min(70 * D2R, turned));
  }
  const breath = Math.sin(t * 1.6 + seed) * 0.004;
  const bob = (pose.bob ?? 0) / 430 + breath;
  const lean = (pose.lean ?? 0) * D2R;
  const swing = pose.walk !== undefined ? Math.sin(pose.walk) * 0.45 : 0;

  const hipY = b.legH;
  const bodyR = b.bodyW / 2;
  const bodyLen = Math.max(0.01, b.bodyH - b.bodyW);
  const bodyY = hipY + b.bodyH / 2;
  const R = b.headD / 2;
  const headY = hipY + b.bodyH + b.neck + R * 0.92;
  const hullT = 0.012; // hull thickness (x height): heavier than the 1-2 px set ink

  const L = armChain(pose, "L", b);
  const Rr = armChain(pose, "R", b);
  const blink = face.blink === false ? 0 : blinkAt(t, seed);
  const eyes = face.eyes ?? "dot";
  const eyeOpen = eyes === "closed" ? 0.12 : eyes === "half" || eyes === "squint" ? 0.5 : 1;
  const eyeScale = eyes === "wide" ? 1.3 : 1;
  const eyeH = Math.max(0.12, eyeOpen * (1 - blink));
  const mouth = face.mouth ?? "smile";
  const brows = face.brows ?? "none";
  const browTilt = brows === "worried" ? 0.35 : brows === "angry" ? -0.4 : 0;
  const browUp = brows === "raised" ? 0.06 : 0;

  return (
    <group position={props.position} rotation={[0, yaw, 0]} scale={h}>
      {([-1, 1] as const).map((s) => {
        const a = s === -1 ? swing : -swing;
        const hip = new THREE.Vector3(s * b.bodyW * 0.22, hipY + 0.02, 0);
        const foot = new THREE.Vector3(s * b.bodyW * 0.24, 0.035, Math.sin(a) * b.legH * 0.8);
        return (
          <group key={s}>
            <Limb a={hip} b={foot} r={b.limb * 1.15} mat={pants} />
            <mesh geometry={sph} material={shoes} position={[foot.x, 0.03, foot.z + 0.03]} scale={[0.05, 0.035, 0.08]} castShadow receiveShadow />
          </group>
        );
      })}
      <group rotation={[lean, 0, 0]}>
        <group position={[0, bob, 0]}>
          {/* body: a rounded capsule with a heavier ink hull */}
          <mesh geometry={cap(bodyR, bodyLen)} material={shirt} position={[0, bodyY, 0]} castShadow receiveShadow />
          <mesh geometry={cap(bodyR + hullT, bodyLen)} material={hull(ink)} position={[0, bodyY, 0]} />
          {/* arms: limbs get the post-pass ink */}
          {[L, Rr].map((c, i) => (
            <group key={i}>
              <Limb a={c.S} b={c.E} r={b.limb} mat={shirt} />
              <Limb a={c.E} b={c.H} r={b.limb * 0.95} mat={shirt} />
              <mesh geometry={sph} material={skin} position={c.H} scale={b.hand} castShadow receiveShadow />
            </group>
          ))}
          {/* head */}
          <group position={[0, headY, 0]} rotation={[0, headYaw, (pose.headTilt ?? 0) * D2R]}>
            <mesh geometry={sph} material={skin} scale={[R, R * 0.96, R * 0.94]} castShadow receiveShadow />
            <mesh geometry={sph} material={hull(ink)} scale={[R + hullT, R * 0.96 + hullT, R * 0.94 + hullT]} />
            {look.hair ? <mesh geometry={sph} material={flat(look.hair)} position={[0, R * 0.2, -R * 0.12]} scale={[R * 1.04, R * 0.8, R * 0.98]} castShadow /> : null}
            {look.hat ? (
              <group position={[0, R * 0.68, -R * 0.06]} rotation={[-0.22, 0, 0]}>
                <mesh geometry={sph} material={flat(look.hat)} scale={[R * 1.02, R * 0.48, R * 1.02]} castShadow />
                <mesh geometry={brim} material={flat(look.hat)} position={[0, -R * 0.02, R * 0.35]} scale={[R * 0.9, R * 0.05, R * 0.75]} castShadow />
              </group>
            ) : null}
            {/* a minimal face: two dark eyes with a glint, optional brows, a simple mouth */}
            {[-1, 1].map((s) => (
              <group key={s}>
                <OnHead R={R * 0.93} yaw={s * 0.3} pitch={0.02}>
                  <mesh geometry={sph} material={dark} scale={[R * 0.085 * eyeScale, R * 0.12 * eyeScale * eyeH, R * 0.05]} />
                  {eyeH > 0.5 ? <mesh geometry={sph} material={unlit("#ffffff")} position={[R * 0.03, R * 0.045 * eyeScale, R * 0.04]} scale={R * 0.025} /> : null}
                </OnHead>
                {brows !== "none" ? (
                  <OnHead R={R * 0.93} yaw={s * 0.3} pitch={0.26 + browUp}>
                    <mesh geometry={sph} material={dark} rotation={[0, 0, -s * browTilt]} scale={[R * 0.12, R * 0.025, R * 0.04]} />
                  </OnHead>
                ) : null}
              </group>
            ))}
            <OnHead R={R * 0.92} yaw={0} pitch={-0.34}>
              {mouth === "o" || mouth === "open" || mouth === "yell" ? (
                <mesh geometry={sph} material={dark} scale={[R * (mouth === "o" ? 0.08 : 0.14), R * (mouth === "o" ? 0.1 : 0.12), R * 0.05]} />
              ) : mouth === "flat" ? (
                <mesh geometry={sph} material={dark} scale={[R * 0.14, R * 0.022, R * 0.04]} />
              ) : (
                <mesh material={dark} rotation={[0, 0, mouth === "frown" ? 0 : Math.PI]} position={[0, mouth === "frown" ? -R * 0.06 : R * 0.04, 0]}>
                  <torusGeometry args={[R * 0.13, R * 0.025, 8, 20, Math.PI]} />
                </mesh>
              )}
            </OnHead>
          </group>
        </group>
      </group>
    </group>
  );
};

/** the head center in world space (for CastLight, focus and framing) */
export const headOf = (position: V3, height = 1.75, build?: Partial<Build>): V3 => {
  const b = buildOf(build);
  return [position[0], position[1] + height * (b.legH + b.bodyH + b.neck + b.headD * 0.46), position[2]];
};
