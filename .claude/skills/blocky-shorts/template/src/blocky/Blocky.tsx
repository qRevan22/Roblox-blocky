// Blocky: the parametric blocky character of this series (our own design; proportions in references/style.md).
// Rigid parts pivot at the shoulders, hips and neck (no elbows, no knees). The face is a flat decal drawn on a
// CanvasTexture, on a plane 4 mm proud of the head's flat front (never z-fights). Proportions live in SPEC (motion.ts);
// the group tree here mirrors coneMatrix() in motion.ts, so held props land exactly where the maths says.
import React from "react";
import * as THREE from "three";
import { CONE, GRIP, HAND, SCOOP_R, SCOOP_SEAT, SCOOP_STACK, SHOULDER_Y, shoulderXOf, SPEC, U } from "./motion";
import type { Emotion, Pose, V3 } from "./motion";
import { canvasTexture, geoOf, plastic, rbox } from "./mat";
import { mix } from "../engine/util";

export type HairStyle = "shaggy" | "puffs" | "antennae" | "antenna1";
export type Look = {
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  sole: string;
  hair: string;
  hairStyle: HairStyle;
  accent: string; // print / hair ties / antenna tips
  print: "bolt" | "heart" | "ring" | "star" | "bow";
  cheeks: "freckles" | "blush" | "none";
  /** eye size (1 = the family default) */
  eyeScale?: number;
  /** clothing details: a belt and sleeve cuffs (colours) */
  belt?: string;
  cuffs?: string;
  /** accessories (colours): a hat with a band, a shoulder bag, an apron, tiny round glasses, a rocket backpack */
  acc?: { hat?: [string, string]; bag?: string; apron?: string; glasses?: string; backpack?: [string, string] };
};
/** something held in one hand (kept upright in the world, like the cone) or hugged against the chest */
export type Held = { side: "L" | "R"; node: React.ReactNode; tilt?: [number, number] };
export type ConeProps = { side: "L" | "R"; scoops: number; colors: string[]; pop?: [number, number] };

const EDGE = 0.05 * U; // edge rounding of body parts
const DECAL_OFF = 0.0045; // m, decal planes stand this far off their surface

// ------------------------------------------------------------------ face decal
const FW = SPEC.head.w - 2 * SPEC.head.r; // flat front of the head (U)
const FH = SPEC.head.h - 2 * SPEC.head.r;
const faceTex = (emotion: Emotion, blink: boolean, cheeks: Look["cheeks"], es = 1) =>
  canvasTexture(`face|${emotion}|${blink ? 1 : 0}|${cheeks}|${es}`, 512, Math.round((512 * FH) / FW), (g, W, H) => {
    // face coordinates in U, origin = head centre, y up
    const X = (x: number) => (x / FW + 0.5) * W;
    const Y = (y: number) => (0.5 - y / FH) * H;
    const S = W / FW; // px per U
    const ink = "#17161c";
    g.clearRect(0, 0, W, H);
    g.lineCap = "round";
    g.lineJoin = "round";
    // cheeks
    if (cheeks === "none") {
      // no cheek marks
    } else if (cheeks === "blush") {
      g.fillStyle = "rgba(255,110,140,0.55)";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(X(s * 0.27), Y(-0.12), 0.075 * S, 0.04 * S, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = "rgba(150,80,40,0.75)";
      for (const s of [-1, 1])
        for (const [dx, dy] of [[0, 0], [0.05, 0.03], [0.07, -0.025]]) {
          g.beginPath();
          g.arc(X(s * (0.24 + dx)), Y(-0.1 + dy), 0.014 * S, 0, Math.PI * 2);
          g.fill();
        }
    }
    // eyes (~1/5 of the head width)
    const ex = 0.21, ey = 0.05;
    g.fillStyle = ink;
    g.strokeStyle = ink;
    for (const s of [-1, 1]) {
      const cx = X(s * ex), cy = Y(ey);
      if (emotion === "love" && !blink) {
        // heart eyes
        g.fillStyle = "#e8234a";
        g.beginPath();
        const r = 0.13 * es * S;
        g.moveTo(cx, cy + r * 0.95);
        g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.75, cy - r * 1.25, cx, cy - r * 0.45);
        g.bezierCurveTo(cx + r * 0.75, cy - r * 1.25, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.95);
        g.fill();
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(cx - 0.04 * S, cy - 0.04 * S, 0.025 * S, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
        continue;
      }
      if (emotion === "sly" && !blink) {
        // half-lidded: the lower half of the oval, a flat lid line on top
        g.save();
        g.beginPath();
        g.rect(cx - 0.2 * S, cy - 0.01 * S, 0.4 * S, 0.3 * S);
        g.clip();
        g.beginPath();
        g.ellipse(cx + s * 0.02 * S, cy, 0.105 * es * S, 0.13 * es * S, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(cx + 0.04 * S, cy + 0.04 * S, 0.022 * es * S, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
        g.restore();
        g.lineWidth = 0.04 * S;
        g.beginPath();
        g.moveTo(cx - 0.12 * S, cy - 0.01 * S);
        g.lineTo(cx + 0.12 * S, cy - 0.01 * S);
        g.stroke();
        continue;
      }
      if (blink) {
        g.lineWidth = 0.045 * S;
        g.beginPath();
        g.moveTo(cx - 0.085 * S, cy);
        g.lineTo(cx + 0.085 * S, cy);
        g.stroke();
      } else if (emotion === "joy") {
        g.lineWidth = 0.055 * S;
        g.beginPath();
        g.arc(cx, cy + 0.05 * S, 0.09 * S, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      } else {
        const big = (emotion === "shock" ? 1.14 : emotion === "sad" ? 0.94 : 1) * es;
        g.beginPath();
        g.ellipse(cx, cy, 0.105 * big * S, 0.15 * big * S, 0, 0, Math.PI * 2);
        g.fill();
        // catch-lights on every open eye: one big, one small (eyes read alive)
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(cx + 0.035 * big * S, cy - 0.06 * big * S, 0.034 * big * S, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(cx - 0.035 * big * S, cy + 0.06 * big * S, 0.015 * big * S, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
      }
    }
    // one angled brow stroke each
    g.lineWidth = 0.05 * S;
    for (const s of [-1, 1]) {
      const by = (es - 1) * 0.14 + (emotion === "shock" ? 0.31 : emotion === "joy" || emotion === "love" ? 0.29 : emotion === "curious" ? (s < 0 ? 0.33 : 0.25) : emotion === "sly" ? 0.22 : 0.26);
      // angle: + = inner end up (sad/worried), - = inner end down
      const tilt = emotion === "sad" ? 0.42 : emotion === "shock" ? 0.12 : emotion === "joy" || emotion === "love" ? -0.05 : emotion === "sly" ? -0.4 : emotion === "curious" ? (s < 0 ? 0.2 : -0.15) : -0.08;
      const cx = s * 0.22, len = 0.085;
      g.beginPath();
      const dy = tilt * 0.12; // inner end up by dy, outer end down by dy
      g.moveTo(X(cx - s * len), Y(by + dy));
      g.lineTo(X(cx + s * len), Y(by - dy));
      g.stroke();
    }
    // mouth
    const my = -0.2;
    if (emotion === "happy") {
      g.lineWidth = 0.045 * S;
      g.beginPath();
      g.arc(X(0), Y(my + 0.1), 0.15 * S, Math.PI * 0.22, Math.PI * 0.78);
      g.stroke();
    } else if (emotion === "sad") {
      g.lineWidth = 0.045 * S;
      g.beginPath();
      g.arc(X(0), Y(my - 0.12), 0.12 * S, Math.PI * 1.25, Math.PI * 1.75);
      g.stroke();
      // a tear
      g.fillStyle = "#6cc8ff";
      g.beginPath();
      g.ellipse(X(0.27), Y(-0.1), 0.028 * S, 0.045 * S, 0, 0, Math.PI * 2);
      g.fill();
    } else if (emotion === "sly") {
      // a one-sided smirk
      g.lineWidth = 0.045 * S;
      g.beginPath();
      g.moveTo(X(-0.14), Y(my + 0.01));
      g.quadraticCurveTo(X(0.06), Y(my - 0.07), X(0.19), Y(my + 0.07));
      g.stroke();
    } else if (emotion === "curious") {
      g.fillStyle = "#c81a36";
      g.strokeStyle = ink;
      g.lineWidth = 0.03 * S;
      g.beginPath();
      g.ellipse(X(0.03), Y(my - 0.02), 0.06 * S, 0.07 * S, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (emotion === "shock") {
      g.fillStyle = "#d61f3c";
      g.strokeStyle = ink;
      g.lineWidth = 0.03 * S;
      g.beginPath();
      g.ellipse(X(0), Y(my - 0.03), 0.1 * S, 0.13 * S, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      // joy: a big open D mouth with a tongue
      g.save();
      g.beginPath();
      g.moveTo(X(-0.19), Y(my + 0.03));
      g.lineTo(X(0.19), Y(my + 0.03));
      g.ellipse(X(0), Y(my + 0.03), 0.19 * S, 0.17 * S, 0, 0, Math.PI);
      g.closePath();
      g.fillStyle = "#c81a36";
      g.fill();
      g.clip();
      g.fillStyle = "#ff8aa0";
      g.beginPath();
      g.ellipse(X(0), Y(my - 0.13), 0.11 * S, 0.07 * S, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = ink;
      g.lineWidth = 0.03 * S;
      g.beginPath();
      g.moveTo(X(-0.19), Y(my + 0.03));
      g.lineTo(X(0.19), Y(my + 0.03));
      g.ellipse(X(0), Y(my + 0.03), 0.19 * S, 0.17 * S, 0, 0, Math.PI);
      g.closePath();
      g.stroke();
    }
  });

const printTex = (kind: Look["print"], color: string) =>
  canvasTexture(`print|${kind}|${color}`, 512, 512, (g, W) => {
    g.clearRect(0, 0, W, W);
    g.fillStyle = color;
    g.beginPath();
    if (kind === "bolt") {
      const p = [[0.58, 0.04], [0.22, 0.56], [0.47, 0.56], [0.36, 0.96], [0.8, 0.4], [0.54, 0.4], [0.7, 0.04]];
      p.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * W) : g.moveTo(x * W, y * W)));
    } else if (kind === "star") {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.2 : 0.46;
        const x = 0.5 + r * Math.cos(a), y = 0.53 + r * Math.sin(a);
        i ? g.lineTo(x * W, y * W) : g.moveTo(x * W, y * W);
      }
    } else if (kind === "ring") {
      // a little ringed planet: a ball and a tilted ring band
      g.arc(0.5 * W, 0.5 * W, 0.24 * W, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.lineWidth = 0.07 * W;
      g.strokeStyle = color;
      g.ellipse(0.5 * W, 0.5 * W, 0.46 * W, 0.13 * W, -0.35, 0, Math.PI * 2);
      g.stroke();
      return;
    } else if (kind === "bow") {
      // a bow tie, high on the chest
      g.moveTo(0.5 * W, 0.2 * W);
      g.lineTo(0.12 * W, 0.04 * W);
      g.lineTo(0.12 * W, 0.4 * W);
      g.closePath();
      g.moveTo(0.5 * W, 0.2 * W);
      g.lineTo(0.88 * W, 0.04 * W);
      g.lineTo(0.88 * W, 0.4 * W);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(0.5 * W, 0.21 * W, 0.08 * W, 0, Math.PI * 2);
    } else {
      g.moveTo(0.5 * W, 0.88 * W);
      g.bezierCurveTo(0.08 * W, 0.6 * W, 0.12 * W, 0.12 * W, 0.5 * W, 0.32 * W);
      g.bezierCurveTo(0.88 * W, 0.12 * W, 0.92 * W, 0.6 * W, 0.5 * W, 0.88 * W);
    }
    g.closePath();
    g.fill();
  });

// ------------------------------------------------------------------ hair kit
/** alien antennae on top of the head: thin stalks with glowing ball tips. ant: 0 relaxed, 1 straight up, -1 drooped */
const Antennae: React.FC<{ look: Look; ant: number; wob?: number; lift?: number }> = ({ look, ant, wob = 0, lift = 0 }) => {
  const H = SPEC.head;
  const stalk = plastic(look.hair, { rough: 0.45 });
  const tip = plastic(look.accent, { rough: 0.3, emissive: look.accent, ei: 0.35 });
  const len = 0.6 * U;
  const xs = look.hairStyle === "antennae" ? [-0.26, 0.26] : [0.08];
  const splay = ant >= 0 ? lerpN(0.38, 0.06, ant) : lerpN(0.38, 1.25, -ant);
  return (
    <>
      {xs.map((x) => {
        const s = x < 0 ? -1 : 1;
        return (
          <group key={x} position={[x * U * (lift ? 0.7 : 1), (H.h / 2 - 0.05) * U + lift, -0.05 * U]} rotation={[-0.12 + wob * (x < 0 ? 1 : 0.8), 0, -s * (xs.length === 1 ? 0.15 + splay * 0.4 : splay) + wob * 0.5 * s]}>
            <mesh geometry={geoOf("antStalk", () => new THREE.CylinderGeometry(0.011, 0.014, len, 8))} material={stalk} position={[0, len / 2, 0]} castShadow />
            <mesh geometry={geoOf("antTip", () => new THREE.IcosahedronGeometry(0.036, 2))} material={tip} position={[0, len + 0.02, 0]} castShadow />
          </group>
        );
      })}
    </>
  );
};
const HAT_CROWN = 0.5 * U; // the dad's hat crown height (antennae come out on top)
const lerpN = (a: number, b: number, u: number) => a + (b - a) * Math.min(1, Math.max(0, u));

const Hair: React.FC<{ look: Look; ant?: number; wob?: number }> = ({ look, ant = 0, wob = 0 }) => {
  if (look.hairStyle === "antennae" || look.hairStyle === "antenna1") return <Antennae look={look} ant={ant} wob={wob} lift={look.acc?.hat ? HAT_CROWN : 0} />;
  const H = SPEC.head;
  const m = plastic(look.hair, { rough: 0.62 });
  const shaggy = look.hairStyle === "shaggy";
  const kx = (shaggy ? 0.85 : 0.92) * (H.w / 1.1);
  // the cap is built at the real head size (never narrower than the head); the other pieces are authored for a
  // 1.1 x 1.14 x 1.05 U head and scaled by kx (x), H.h/1.14 (y), H.d/1.05 (z)
  const cap = rbox((H.w + 0.08) * U, 0.5 * U, (H.d + 0.06) * U, 0.2 * U);
  const capY = 0.42 * U * (H.h / 1.14), capZ = -0.08 * U;
  const parts: { g: THREE.BufferGeometry; p: V3; r?: V3; mat?: THREE.Material }[] = [];
  if (shaggy) {
    // front fringe: chunky wedges over the forehead, bottom edge above the brows
    [-0.36, -0.12, 0.12, 0.36].forEach((x, i) =>
      parts.push({ g: rbox(0.3 * U, 0.34 * U, 0.15 * U, 0.04 * U), p: [x * U, 0.5 * U, 0.49 * U], r: [-0.28, 0, (i - 1.5) * 0.12] }),
    );
    // spikes on top
    [[-0.38, 0.1, 0.5], [0, 0.18, -0.2], [0.38, 0.06, -0.5], [-0.2, -0.3, 0.3], [0.24, -0.32, -0.3]].forEach(([x, z, rz]) =>
      parts.push({ g: rbox(0.36 * U, 0.36 * U, 0.36 * U, 0.06 * U), p: [x * U, 0.66 * U, z * U], r: [0.5 + z, 0.7, rz] }),
    );
    // side tufts and the back
    for (const s of [-1, 1]) parts.push({ g: rbox(0.18 * U, 0.55 * U, 0.62 * U, 0.05 * U), p: [s * (0.62 / kx) * (H.w / 1.1) * U, 0.22 * U, -0.08 * U], r: [0, 0, s * 0.08] });
    parts.push({ g: rbox(1.22 * U, 0.8 * U, 0.2 * U, 0.06 * U), p: [0, 0.12 * U, -0.54 * U] });
  } else {
    // bangs: one slanted slab; two round puffs with hair ties
    parts.push({ g: rbox(0.86 * U, 0.24 * U, 0.15 * U, 0.06 * U), p: [0.04 * U, 0.48 * U, 0.49 * U], r: [-0.25, 0, -0.1] });
    const puff = geoOf("puff", () => new THREE.IcosahedronGeometry(0.34 * U, 3)); // smooth: one material language
    const tie = plastic(look.accent, { rough: 0.35 });
    for (const s of [-1, 1]) {
      parts.push({ g: puff, p: [s * 0.66 * U, 0.6 * U, -0.12 * U] });
      parts.push({ g: geoOf("tie", () => new THREE.CylinderGeometry(0.12 * U, 0.12 * U, 0.1 * U, 12)), p: [s * 0.46 * U, 0.5 * U, -0.12 * U], r: [0, 0, s * 0.9], mat: tie });
    }
    parts.push({ g: rbox(1.16 * U, 0.55 * U, 0.2 * U, 0.06 * U), p: [0, 0.2 * U, -0.54 * U] });
  }
  // authored for a 1.1 x 1.14 x 1.05 U head; scaled to SPEC.head, and 8 % narrower so the hair never reads wider than the head
  return (
    <>
      <mesh geometry={cap} material={m} position={[0, capY, capZ]} castShadow receiveShadow />
      <group scale={[kx, H.h / 1.14, H.d / 1.05]}>
        {parts.map((q, i) => (
          <mesh key={i} geometry={q.g} material={q.mat ?? m} position={q.p} rotation={q.r} castShadow receiveShadow />
        ))}
      </group>
    </>
  );
};

// ------------------------------------------------------------------ held cone
/** pop = [width, height] scale of the top scoop (landing squash) */
export const Cone: React.FC<{ scoops: number; colors: string[]; pop?: [number, number] }> = ({ scoops, colors, pop = [1, 1] }) => {
  const cone = geoOf("cone", () => {
    const g = new THREE.ConeGeometry(CONE.r, CONE.h, 9, 1, false);
    g.rotateX(Math.PI); // tip down, rim at +h/2
    return g;
  });
  const ball = geoOf("scoop", () => new THREE.IcosahedronGeometry(SCOOP_R, 3));
  return (
    <>
      <mesh geometry={cone} material={plastic("#d99a4e", { rough: 0.7, flat: true })} castShadow receiveShadow />
      {Array.from({ length: scoops }, (_, i) => (
        <mesh key={i} geometry={ball} material={plastic(colors[i], { rough: 0.38 })} position={[0, CONE.h / 2 + SCOOP_SEAT + i * SCOOP_STACK, 0]} scale={i === scoops - 1 ? [pop[0], pop[1], pop[0]] : 1} castShadow receiveShadow />
      ))}
    </>
  );
};

// ------------------------------------------------------------------ the character
export const Blocky: React.FC<{ pose: Pose; look: Look; emotion: Emotion; blink?: boolean; cone?: ConeProps; held?: Held; chest?: React.ReactNode; scale?: number }> = ({
  pose: p,
  look,
  emotion,
  blink = false,
  cone,
  held,
  chest,
  scale = 1,
}) => {
  const S = SPEC;
  const skin = plastic(look.skin, { rough: 0.42 });
  const hand = plastic(mix(look.skin, "#fff4e8", 0.28), { rough: 0.4 });
  const shirt = plastic(look.shirt, { rough: 0.55 });
  const pants = plastic(look.pants, { rough: 0.6 });
  const shoes = plastic(look.shoes, { rough: 0.45 });
  const sole = plastic(look.sole, { rough: 0.5 });
  const face = plastic("#ffffff", { decal: true, rough: 0.45, map: faceTex(emotion, blink, look.cheeks, look.eyeScale ?? 1) });
  const print = plastic("#ffffff", { decal: true, rough: 0.55, map: printTex(look.print, look.accent) });
  const arm = (side: "L" | "R") => {
    const sx = side === "L" ? 1 : -1;
    const raise = side === "L" ? p.armL : p.armR;
    const out = side === "L" ? p.outL : p.outR;
    const top = S.arm.up * U; // arm top above the pivot
    const sl = S.sleeve * U;
    return (
      <group key={side} position={[sx * shoulderXOf(out), SHOULDER_Y, 0]} rotation={[0, 0, sx * out]}>
        <group rotation={[-raise, 0, 0]}>
          <mesh geometry={rbox((S.arm.w + 0.06) * U, sl, (S.arm.d + 0.06) * U, EDGE)} material={shirt} position={[0, top - sl / 2, 0]} castShadow receiveShadow />
          {look.cuffs ? <mesh geometry={rbox((S.arm.w + 0.1) * U, 0.14 * U, (S.arm.d + 0.1) * U, EDGE)} material={plastic(look.cuffs, { rough: 0.5 })} position={[0, top - sl + 0.05 * U, 0]} castShadow /> : null}
          <mesh geometry={rbox(S.arm.w * U, (S.arm.h - S.sleeve + 0.02) * U, S.arm.d * U, EDGE)} material={skin} position={[0, top - sl - ((S.arm.h - S.sleeve - 0.02) * U) / 2, 0]} castShadow receiveShadow />
          {/* hand: a lighter end cap, so a raised arm doesn't read as a plain box */}
          <mesh geometry={rbox((S.arm.w + 0.03) * U, 0.26 * U, (S.arm.d + 0.03) * U, EDGE)} material={hand} position={[0, -HAND + 0.12 * U, 0]} castShadow receiveShadow />
          {cone && cone.side === side ? (
            <group position={[0, -HAND - GRIP, 0]}>
              <group rotation={[raise, 0, -sx * out]}>
                <group rotation={[-p.pitch, -(p.twist ?? 0), -(p.sway ?? 0), "ZYX"]}>
                  <group rotation={[p.coneTilt?.[0] ?? 0, 0, p.coneTilt?.[1] ?? 0]}>
                    <group position={[0, -0.02, 0]}>
                      <Cone scoops={cone.scoops} colors={cone.colors} pop={cone.pop} />
                    </group>
                  </group>
                </group>
              </group>
            </group>
          ) : null}
          {held && held.side === side ? (
            <group position={[0, -HAND - GRIP, 0]}>
              <group rotation={[raise, 0, -sx * out]}>
                <group rotation={[-p.pitch, -(p.twist ?? 0), -(p.sway ?? 0), "ZYX"]}>
                  <group rotation={[held.tilt?.[0] ?? 0, 0, held.tilt?.[1] ?? 0]}>{held.node}</group>
                </group>
              </group>
            </group>
          ) : null}
        </group>
      </group>
    );
  };
  const leg = (side: "L" | "R") => {
    const sx = side === "L" ? 1 : -1;
    const sw = side === "L" ? p.legL : p.legR;
    const pantsH = (S.leg.h - S.shoe.h + 0.03) * U;
    const shoeH = S.shoe.h * U;
    return (
      <group key={side} position={[sx * S.hipX * U, 0, 0]} rotation={[-sw, 0, 0]}>
        <mesh geometry={rbox(S.leg.w * U, pantsH, S.leg.d * U, EDGE)} material={pants} position={[0, -pantsH / 2, 0]} castShadow receiveShadow />
        <mesh geometry={rbox(S.shoe.w * U, shoeH * 0.78, S.shoe.d * U, EDGE)} material={shoes} position={[0, -S.leg.h * U + shoeH * 0.22 + (shoeH * 0.78) / 2, 0]} castShadow receiveShadow />
        <mesh geometry={rbox((S.shoe.w + 0.02) * U, shoeH * 0.24, (S.shoe.d + 0.02) * U, 0.02 * U)} material={sole} position={[0, -S.leg.h * U + (shoeH * 0.24) / 2 + 0.002, 0]} castShadow receiveShadow />
      </group>
    );
  };
  const H = S.head;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]} scale={scale}>
      <group rotation={[p.pitch, 0, 0]}>
        {leg("L")}
        {leg("R")}
        <group position={[0, p.bob ?? 0, 0]} rotation={[0, p.twist ?? 0, p.sway ?? 0]}>
        <mesh geometry={rbox(S.torso.w * U, S.torso.h * U, S.torso.d * U, EDGE)} material={shirt} position={[0, (S.torso.h * U) / 2, 0]} castShadow receiveShadow />
        <mesh geometry={geoOf("printPlane", () => new THREE.PlaneGeometry(1.15 * U, 1.15 * U))} material={print} position={[0, 1.12 * U, (S.torso.d * U) / 2 + DECAL_OFF]} />
        {arm("L")}
        {arm("R")}
        {chest ? <group position={[0, 1.0 * U, (S.torso.d * U) / 2]}>{chest}</group> : null}
        <BodyAcc look={look} />
        <group position={[0, (S.torso.h + H.gap) * U, 0]} rotation={[0, p.headYaw, 0]}>
          <group rotation={[p.headPitch, 0, 0]}>
            <group position={[0, (H.h * U) / 2, 0]}>
              <mesh geometry={rbox(H.w * U, H.h * U, H.d * U, H.r * U)} material={skin} castShadow receiveShadow />
              <mesh geometry={geoOf("facePlane", () => new THREE.PlaneGeometry(FW * U, FH * U))} material={face} position={[0, 0, (H.d * U) / 2 + DECAL_OFF]} />
              <Hair look={look} ant={p.ant ?? 0} wob={p.antWob ?? 0} />
              <HeadAcc look={look} />
            </group>
          </group>
        </group>
        </group>
      </group>
    </group>
  );
};

export const KID_A: Look = { skin: "#f1c393", shirt: "#f5c400", pants: "#2f63c9", shoes: "#f4f4f2", sole: "#e8402a", hair: "#ff6a12", hairStyle: "shaggy", accent: "#ff5a1f", print: "bolt", cheeks: "freckles" };
export const KID_B: Look = { skin: "#a7663c", shirt: "#ff4d94", pants: "#5a3fc8", shoes: "#ffffff", sole: "#2fb7a8", hair: "#2b1912", hairStyle: "puffs", accent: "#2fd0bd", print: "heart", cheeks: "blush" };
export const SCOOPS_A = ["#7fe3b8", "#ff8db2"]; // mint, strawberry

// ------------------------------------------------------------------ accessories (silhouette makers)
/** on the head: the dad's hat (brim, crown, band), the seller's tiny round glasses */
const HeadAcc: React.FC<{ look: Look }> = ({ look }) => {
  const H = SPEC.head;
  const a = look.acc;
  if (!a) return null;
  return (
    <>
      {a.hat ? (
        <group position={[0, (H.h / 2) * U, 0]}>
          <mesh geometry={rbox((H.w + 0.42) * U, 0.07 * U, (H.d + 0.42) * U, 0.03 * U)} material={plastic(a.hat[0], { rough: 0.55 })} position={[0, 0.02 * U, 0]} castShadow receiveShadow />
          <mesh geometry={rbox((H.w - 0.02) * U, HAT_CROWN, (H.d - 0.02) * U, 0.1 * U)} material={plastic(a.hat[0], { rough: 0.55 })} position={[0, HAT_CROWN / 2 + 0.04 * U, 0]} castShadow receiveShadow />
          <mesh geometry={rbox((H.w + 0.02) * U, 0.13 * U, (H.d + 0.02) * U, 0.04 * U)} material={plastic(a.hat[1], { rough: 0.4 })} position={[0, 0.12 * U, 0]} castShadow />
        </group>
      ) : null}
      {a.glasses ? (
        <group position={[0, 0.05 * U, (H.d / 2) * U + 0.012]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.21 * U, 0, 0]}>
              <mesh geometry={geoOf("glassRim", () => new THREE.TorusGeometry(0.12 * U, 0.019 * U, 8, 28))} material={plastic(a.glasses!, { rough: 0.25 })} castShadow />
              <mesh geometry={geoOf("glassLens", () => new THREE.CircleGeometry(0.12 * U, 28))} material={plastic("#bfefff", { transparent: true, opacity: 0.22, rough: 0.05 })} />
            </group>
          ))}
          <mesh geometry={rbox(0.18 * U, 0.025 * U, 0.02 * U, 0.008 * U)} material={plastic(a.glasses, { rough: 0.25 })} />
        </group>
      ) : null}
    </>
  );
};
/** on the body: belt + buckle, the dad's bag on a strap, the seller's apron, the kid's rocket backpack */
const BodyAcc: React.FC<{ look: Look }> = ({ look }) => {
  const S = SPEC;
  const a = look.acc ?? {};
  const fz = (S.torso.d * U) / 2;
  return (
    <>
      {look.belt ? (
        <>
          <mesh geometry={rbox((S.torso.w + 0.04) * U, 0.2 * U, (S.torso.d + 0.04) * U, 0.03 * U)} material={plastic(look.belt, { rough: 0.5 })} position={[0, 0.12 * U, 0]} castShadow />
          <mesh geometry={rbox(0.32 * U, 0.16 * U, 0.04 * U, 0.02 * U)} material={plastic("#ffd23a", { rough: 0.25 })} position={[0, 0.12 * U, fz + 0.025 * U]} />
        </>
      ) : null}
      {a.bag ? (
        <>
          <mesh geometry={rbox(0.16 * U, 2.5 * U, 0.04 * U, 0.02 * U)} material={plastic("#5a3a22", { rough: 0.6 })} position={[0, 1.05 * U, fz + 0.03 * U]} rotation={[0, 0, -0.78]} castShadow />
          <mesh geometry={rbox(0.16 * U, 2.5 * U, 0.04 * U, 0.02 * U)} material={plastic("#5a3a22", { rough: 0.6 })} position={[0, 1.05 * U, -fz - 0.03 * U]} rotation={[0, 0, -0.78]} castShadow />
          <group position={[1.12 * U, 0.15 * U, 0.15 * U]}>
            <mesh geometry={rbox(0.36 * U, 0.8 * U, 0.95 * U, 0.08 * U)} material={plastic(a.bag, { rough: 0.55 })} castShadow receiveShadow />
            <mesh geometry={rbox(0.38 * U, 0.3 * U, 0.97 * U, 0.06 * U)} material={plastic("#5a3a22", { rough: 0.6 })} position={[0, 0.27 * U, 0]} />
            <mesh geometry={rbox(0.04 * U, 0.12 * U, 0.12 * U, 0.02 * U)} material={plastic("#ffd23a", { rough: 0.25 })} position={[0.2 * U, 0.15 * U, 0]} />
          </group>
        </>
      ) : null}
      {a.apron ? (
        <>
          <mesh geometry={rbox(1.7 * U, 1.35 * U, 0.06 * U, 0.03 * U)} material={plastic(a.apron, { rough: 0.6 })} position={[0, 0.72 * U, fz + 0.035 * U]} castShadow />
          <mesh geometry={rbox(1.84 * U, 0.95 * U, 0.06 * U, 0.03 * U)} material={plastic(a.apron, { rough: 0.6 })} position={[0, -0.42 * U, fz + 0.12 * U]} rotation={[0.08, 0, 0]} castShadow />
          <mesh geometry={rbox(0.9 * U, 0.34 * U, 0.03 * U, 0.02 * U)} material={plastic("#ffffff", { rough: 0.6 })} position={[0, 0.35 * U, fz + 0.075 * U]} />
          <mesh geometry={rbox(1.2 * U, 0.1 * U, (S.torso.d + 0.08) * U, 0.02 * U)} material={plastic(a.apron, { rough: 0.6 })} position={[0, 1.98 * U, 0]} />
        </>
      ) : null}
      {a.backpack ? (
        <group position={[0, 1.05 * U, -fz - 0.36 * U]}>
          <mesh geometry={rbox(1.4 * U, 1.55 * U, 0.7 * U, 0.25 * U)} material={plastic(a.backpack[0], { rough: 0.45 })} castShadow receiveShadow />
          <mesh geometry={geoOf("packNose", () => new THREE.ConeGeometry(0.62 * U, 0.55 * U, 20))} material={plastic(a.backpack[1], { rough: 0.4 })} position={[0, 1.02 * U, 0]} castShadow />
          <mesh geometry={geoOf("packPort", () => new THREE.CylinderGeometry(0.26 * U, 0.26 * U, 0.06 * U, 20))} material={plastic("#9ff8ff", { emissive: "#5fd8ff", ei: 0.9, rough: 0.15 })} position={[0, 0.2 * U, -0.36 * U]} rotation={[Math.PI / 2, 0, 0]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={rbox(0.12 * U, 0.55 * U, 0.5 * U, 0.04 * U)} material={plastic(a.backpack![1], { rough: 0.4 })} position={[s * 0.75 * U, -0.6 * U, 0]} rotation={[0, 0, s * 0.35]} castShadow />
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`st${s}`} geometry={rbox(0.24 * U, 0.08 * U, 1.6 * U, 0.03 * U)} material={plastic(a.backpack![0], { rough: 0.5 })} position={[s * 0.55 * U, 0.98 * U, 0.75 * U]} />
          ))}
        </group>
      ) : null}
    </>
  );
};
