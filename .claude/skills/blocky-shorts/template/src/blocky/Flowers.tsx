// The world's rule made visible: flowers that pop where a happy kid steps (opaque, saturated, overshoot 1.28 in 0.2 s),
// wilt when he is sad; grey "wilted grass" patches (hard-edged, cracked, dead stalks); the flying scoop; sparkle
// bursts on the hook steps and on the catch. All pure functions of t.
import React from "react";
import * as THREE from "three";
import { coreMat } from "../engine/core/kit";
import { mulberry } from "../engine/mat/paint";
import { mix } from "../engine/util";
import { Cone } from "./Blocky";
import { clamp, easeOutBack, FLIGHT, FLOWERS, GREY_A_C, greyA, greyB, hash, POP, scoopFlight, ss, stepOf, T, XA, XB, ZB } from "./motion";
import type { FlowerSpec, V3 } from "./motion";
import { canvasTexture, geoOf, plastic } from "./mat";

const PETALS = ["#ff3d8b", "#ffffff", "#ffc812", "#9a5cff", "#ff6a1f", "#2fb8ff"];
const DEAD = "#6c675a"; // grey-brown: reads as dead at wide-shot size
const STEM = "#2f8a22";

const Flower: React.FC<{ f: FlowerSpec; t: number }> = ({ f, t }) => {
  const age = t - f.t0;
  if (age <= 0) return null;
  const grow = easeOutBack(age / POP, 3.2);
  const wilt = f.wiltAt !== undefined ? ss(f.wiltAt, f.wiltAt + 0.5, t) : 0;
  const q = Math.round(wilt * 6) / 6; // quantized colour steps (bounded material cache)
  const petal = plastic(mix(PETALS[f.col], DEAD, q * 0.8), { rough: 0.45 });
  const stem = plastic(mix(STEM, DEAD, q * 0.75), { rough: 0.6 });
  const centre = plastic(mix("#ffcf2a", DEAD, q * 0.7), { rough: 0.5 });
  const h = 0.12 + 0.05 * hash(f.seed * 9.1);
  const sway = 0.07 * Math.sin(2 * Math.PI * 0.6 * t + f.seed) * (1 - wilt); // 0.6 Hz
  const lean = (hash(f.seed * 2.3) - 0.5) * 0.3 + sway;
  const petalG = geoOf("petal", () => new THREE.SphereGeometry(0.024, 10, 6));
  return (
    <group position={f.p} rotation={[0, hash(f.seed * 5.7) * 6.28, 0]} scale={f.s * grow * (1 - 0.3 * wilt)}>
      <group rotation={[0, 0, lean + wilt * 0.45]}>
        <mesh geometry={geoOf("stem", () => new THREE.CylinderGeometry(0.0055, 0.007, 1, 6))} material={stem} position={[0, h / 2, 0]} scale={[1, h, 1]} castShadow />
        <mesh geometry={geoOf("leaf", () => new THREE.SphereGeometry(0.02, 8, 5))} material={stem} position={[0.016, h * 0.35, 0]} scale={[1.4, 0.35, 0.7]} rotation={[0, 0, 0.5]} castShadow />
        <group position={[0, h, 0]} rotation={[0.35 + wilt * 2.0, 0, 0]}>
          <mesh geometry={geoOf("fcentre", () => new THREE.SphereGeometry(0.016, 10, 6))} material={centre} position={[0, 0.005, 0]} scale={[1, 0.7, 1]} castShadow />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return <mesh key={i} geometry={petalG} material={petal} position={[Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026]} rotation={[0, -a, 0]} scale={[1.2, 0.34, 0.75]} castShadow />;
          })}
        </group>
      </group>
    </group>
  );
};

export const Flowers: React.FC<{ t: number }> = ({ t }) => (
  <>
    {FLOWERS.map((f) => (
      <Flower key={f.seed} f={f} t={t} />
    ))}
  </>
);

// ------------------------------------------------------------------ wilted-grass patches (6 mm up, hard 5 % edge)
const edgeAlpha = () =>
  canvasTexture(
    "edgeAlpha",
    512,
    512,
    (g, W) => {
      const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.95, "#ffffff");
      gr.addColorStop(1, "#000000");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
    },
    false,
  );
/** dry, cracked earth-and-dead-grass map (near white, tinted by the material colour) */
const cracked = () =>
  canvasTexture("cracked", 1024, 1024, (g, W) => {
    const r = mulberry(31);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, W);
    for (let i = 0; i < 5000; i++) {
      const v = 150 + Math.floor(r() * 90);
      g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.35)`;
      g.fillRect(r() * W, r() * W, 2 + r() * 3, 5 + r() * 7);
    }
    g.strokeStyle = "rgba(60,52,40,0.55)";
    g.lineCap = "round";
    for (let i = 0; i < 46; i++) {
      let x = r() * W, y = r() * W, a = r() * Math.PI * 2;
      g.lineWidth = 1.5 + r() * 2.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        a += (r() - 0.5) * 1.3;
        x += Math.cos(a) * (14 + r() * 26);
        y += Math.sin(a) * (14 + r() * 26);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
const PATCH_Y = 0.006;
// dull dark grey-green (his) and a lighter dry grey (hers); soft 20 % edge (a hard disc reads as a spotlight)
const greyMat = (c = "#8a8f7a") => plastic(c, { rough: 0.95, map: cracked(), alphaMap: edgeAlpha(), transparent: true });
/** dead stalks: thin brown sticks bent over */
const Stalk: React.FC<{ p: V3; seed: number; s: number }> = ({ p, seed, s }) => (
  <group position={p} rotation={[0, hash(seed) * 6.28, 0]} scale={s}>
    <mesh geometry={geoOf("stalk", () => new THREE.CylinderGeometry(0.004, 0.006, 1, 5))} material={plastic(DEAD, { rough: 0.8 })} position={[0.02, 0.05, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.11, 1]} castShadow />
    <mesh geometry={geoOf("stalk", () => new THREE.CylinderGeometry(0.004, 0.006, 1, 5))} material={plastic(DEAD, { rough: 0.8 })} position={[-0.015, 0.035, 0.01]} rotation={[0.3, 0, 0.7]} scale={[1, 0.08, 1]} castShadow />
  </group>
);
export const Patches: React.FC<{ t: number }> = ({ t }) => {
  const b = greyB(t);
  const a = greyA(t);
  const ringKey = Math.round(b.inner * 50) / 50;
  const stalksB: V3[] = [[XB - 0.75, 0, ZB + 0.45], [XB + 0.55, 0, ZB - 0.7], [XB - 0.35, 0, ZB - 0.85]];
  const stalksA: V3[] = [[GREY_A_C[0] - 0.6, 0, 0.95], [GREY_A_C[0] + 0.2, 0, -1.1], [GREY_A_C[0] - 1.25, 0, -0.3], [GREY_A_C[0] + 1.05, 0, 1.0], [GREY_A_C[0] + 0.3, 0, 1.3]];
  return (
    <>
      {ringKey < b.outer - 0.01 ? (
        <mesh geometry={geoOf(`ring${ringKey}`, () => new THREE.RingGeometry(ringKey, b.outer, 72, 1))} material={greyMat()} position={[XB, PATCH_Y, ZB]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      ) : null}
      {stalksB.map((p, i) => (Math.hypot(p[0] - XB, p[2] - ZB) > b.inner ? <Stalk key={`b${i}`} p={p} seed={i + 1} s={1.4} /> : null))}
      {a > 0.01 ? <mesh geometry={geoOf("disc", () => new THREE.CircleGeometry(1, 72))} material={greyMat("#4f5446")} position={[GREY_A_C[0], PATCH_Y + 0.001, GREY_A_C[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[a, a, 1]} receiveShadow /> : null}
      {stalksA.map((p, i) => (Math.hypot(p[0] - GREY_A_C[0], p[2] - GREY_A_C[2]) < a - 0.05 ? <Stalk key={`a${i}`} p={p} seed={i + 7} s={1.4} /> : null))}
    </>
  );
};

// ------------------------------------------------------------------ the flying scoop (tumbles 1.2 turns in flight)
export const FlyingScoop: React.FC<{ t: number; color: string }> = ({ t, color }) => {
  const s = scoopFlight(t);
  if (!s) return null;
  const g = geoOf("scoop2", () => new THREE.IcosahedronGeometry(0.064, 3));
  const trail = [1, 2, 3].map((k) => ({ k, f: scoopFlight(t - k * 0.035) })).filter((q) => q.f);
  return (
    <>
      <mesh geometry={g} material={plastic(color, { rough: 0.38 })} position={s.p} rotation={[s.spin, s.spin * 0.4, 0]} castShadow />
      {trail.map(({ k, f }) => (
        <mesh key={k} geometry={g} material={coreMat("#ffd0e0", 0.95, 0.55 - k * 0.14)} position={f!.p} scale={1 - k * 0.22} userData={{ outline: false }} />
      ))}
    </>
  );
};

// ------------------------------------------------------------------ sparkle bursts (unlit, a touch of bloom)
type Burst = { at: V3; t0: number; dur: number; n: number; r: number; size: number; elMin?: number };
const BURSTS: Burst[] = [
  // the hook: the first two footsteps
  ...[0, 1].map((k): Burst => {
    const st = stepOf(k);
    const zs = st.side === "R" ? 1 : -1;
    return { at: [st.heel + 0.15, 0.12, zs * 0.5], t0: st.t + 0.03, dur: 0.5, n: 6, r: 0.22, size: 0.6 };
  }),
  // the catch: from B's cone
  { at: [FLIGHT.P1[0], FLIGHT.P1[1] + 0.08, FLIGHT.P1[2]], t0: T.land, dur: 0.55, n: 9, r: 0.3, size: 0.75, elMin: 0.65 },
  // her joy, around her head
  { at: [FLIGHT.P1[0], FLIGHT.P1[1] + 0.12, FLIGHT.P1[2]], t0: T.land + 0.12, dur: 0.7, n: 12, r: 0.42, size: 0.9, elMin: 0.35 }, // around the cone
];
export const Sparkles: React.FC<{ t: number }> = ({ t }) => {
  const g = geoOf("spark", () => new THREE.OctahedronGeometry(0.05, 0));
  return (
    <>
      {BURSTS.flatMap((b, j) => {
        const u = (t - b.t0) / b.dur;
        if (u <= 0 || u >= 1) return [];
        return Array.from({ length: b.n }, (_, i) => {
          const a = (i / b.n) * Math.PI * 2 + hash(i * 3.3 + j);
          const el = (b.elMin ?? 0.2) + hash(i * 7.1 + j) * (1.35 - (b.elMin ?? 0.2)); // upward only: off her forearm
          const r = b.r * (0.3 + 0.7 * (1 - (1 - u) * (1 - u)));
          const sc = Math.sin(Math.PI * clamp(u * 1.2)) * (0.7 + 0.5 * hash(i + j)) * b.size;
          const p: V3 = [b.at[0] + Math.cos(a) * Math.cos(el) * r, b.at[1] + Math.sin(el) * r * 0.8, b.at[2] + Math.sin(a) * Math.cos(el) * r];
          return <mesh key={`${j}-${i}`} geometry={g} material={coreMat(i % 3 ? "#fff1a0" : "#ffffff", 1.1)} position={p} rotation={[0, u * 3, 0.6]} scale={[sc * 0.6, sc * 1.4, sc * 0.6]} userData={{ outline: false }} />;
        });
      })}
    </>
  );
};

/** a small dust puff where his body hits the grass */
export const Dust: React.FC<{ t: number }> = ({ t }) => {
  const u = (t - T.dust) / 0.5;
  if (u <= 0 || u >= 1) return null;
  const g = geoOf("dust", () => new THREE.IcosahedronGeometry(1, 1));
  const op = Math.round((1 - u) * (1 - u) * 8) / 8 * 0.7;
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const x = XA - 0.35 + i * 0.22 + (hash(i * 3.7) - 0.5) * 0.1;
        const z = (i % 2 ? 1 : -1) * (0.28 + 0.15 * hash(i * 1.9));
        const r = (0.06 + 0.07 * hash(i * 5.1)) * (0.6 + 1.4 * Math.sqrt(u));
        return <mesh key={i} geometry={g} material={coreMat("#d9cdb0", 0.95, op)} position={[x + (z > 0 ? 0.04 : -0.04) * u, r * 0.8 + 0.12 * u, z * (1 + 0.6 * u)]} scale={r} userData={{ outline: false }} />;
      })}
    </>
  );
};

/** a thin white ring that pops out from the cone rim on the landing */
export const PopRing: React.FC<{ t: number }> = ({ t }) => {
  const u = (t - T.land) / 0.28;
  if (u <= 0 || u >= 1) return null;
  const g = geoOf("popring", () => new THREE.TorusGeometry(1, 0.06, 8, 40));
  const r = 0.07 + 0.2 * (1 - (1 - u) * (1 - u));
  return <mesh geometry={g} material={coreMat("#ffffff", 1.05, Math.round((1 - u) * 8) / 8)} position={[FLIGHT.P1[0], FLIGHT.P1[1] - 0.01, FLIGHT.P1[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r, r * 0.6]} userData={{ outline: false }} />;
};

/** B's cone shows the landed scoop from T.land on */
export const scoopsB = (t: number) => (t >= T.land ? 1 : 0);
export { Cone };
