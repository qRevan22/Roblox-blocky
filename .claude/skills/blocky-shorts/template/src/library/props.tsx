// Story props (our own designs): planets with painted textures, Earth with city lights
// and clouds, the glass jar, price tags and signs (canvas text, Poppins), shelves, the counter, the catalog, the HI! card,
// the rocket car, the sandwich, saucers and flashlights. Everything static or a pure function of its props.
import React from "react";
import * as THREE from "three";
import { canvasTexture, geoOf, plastic, rbox } from "../blocky/mat";
import type { V3 } from "../blocky/motion";

export { bandsTex, rockyTex, ringTex, earthTex, lightsTex } from "./planets";

/** a card of text: rounded panel, border, 1-3 lines, Poppins (fonts are loaded before the scene renders) */
export const textTex = (key: string, lines: string[], o: { w?: number; h?: number; bg?: string; fg?: string; border?: string; px?: number; strike?: number } = {}) =>
  canvasTexture(`text|${key}`, o.w ?? 512, o.h ?? 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    if (o.bg) {
      const r = H * 0.14;
      g.fillStyle = o.bg;
      g.beginPath();
      g.roundRect(4, 4, W - 8, H - 8, r);
      g.fill();
      if (o.border) {
        g.strokeStyle = o.border;
        g.lineWidth = H * 0.05;
        g.beginPath();
        g.roundRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12, r * 0.7);
        g.stroke();
      }
    }
    const px = o.px ?? H * (lines.length > 1 ? 0.34 : 0.5);
    g.fillStyle = o.fg ?? "#16121c";
    g.textAlign = "center";
    g.textBaseline = "middle";
    lines.forEach((l, i) => {
      let fpx = i === 0 ? px : px * 0.8;
      g.font = `800 ${fpx}px Poppins`;
      const fit = (W * 0.86) / Math.max(1, g.measureText(l).width);
      if (fit < 1) {
        fpx *= fit;
        g.font = `800 ${fpx}px Poppins`;
      }
      const y = H / 2 + (i - (lines.length - 1) / 2) * px * 1.1;
      g.fillText(l, W / 2, y);
      if (o.strike !== undefined && o.strike === i) {
        const w = g.measureText(l).width;
        g.strokeStyle = "#e3242b";
        g.lineWidth = px * 0.14;
        g.beginPath();
        g.moveTo(W / 2 - w / 2 - 8, y + px * 0.1);
        g.lineTo(W / 2 + w / 2 + 8, y - px * 0.18);
        g.stroke();
      }
    });
  });

export { Planet, Earth } from "./planets";
export type { PlanetKind } from "./planets";

// ------------------------------------------------------------------ the jar
/** a glass jar (Earth floats inside): thin translucent wall, a rim, a gold lid, a vertical highlight streak */
export const Jar: React.FC<{ p?: V3; children?: React.ReactNode; label?: boolean }> = ({ p = [0, 0, 0], children, label = true }) => {
  const R = 0.15, H = 0.34;
  const glass = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9fc8e0", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.FrontSide }),
    [],
  );
  return (
    <group position={p}>
      <mesh geometry={geoOf("jarWall", () => new THREE.CylinderGeometry(R, R, H, 48, 1, true))} material={glass} position={[0, H / 2, 0]} renderOrder={3} />
      <mesh geometry={geoOf("jarBase", () => new THREE.CylinderGeometry(R, R * 0.97, 0.02, 48))} material={glass} position={[0, 0.01, 0]} renderOrder={3} />
      <mesh geometry={geoOf("jarRim", () => new THREE.TorusGeometry(R, 0.008, 8, 48))} material={plastic("#e8f6ff", { rough: 0.1, transparent: true, opacity: 0.6 })} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geoOf("jarLid", () => new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.045, 48))} material={plastic("#e0a92a", { rough: 0.3 })} position={[0, H + 0.025, 0]} castShadow />
      <mesh geometry={geoOf("jarKnob", () => new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16))} material={plastic("#c98f1c", { rough: 0.3 })} position={[0, H + 0.06, 0]} castShadow />
      {/* two highlight streaks so the glass reads in every light */}
      {[-0.55, -0.35].map((a, i) => (
        <mesh key={i} geometry={geoOf(`jarStreak${i}`, () => new THREE.PlaneGeometry(i ? 0.012 : 0.025, H * 0.8))} material={plastic("#ffffff", { transparent: true, opacity: i ? 0.25 : 0.4, emissive: "#ffffff", ei: 0.2 })} position={[Math.sin(a) * (R + 0.002), H * 0.5, Math.cos(a) * (R + 0.002)]} rotation={[0, a, 0]} renderOrder={4} />
      ))}
      {label ? (
        <mesh geometry={geoOf("jarLabel", () => new THREE.CylinderGeometry(R + 0.003, R + 0.003, 0.07, 48, 1, true, -0.5, 1.0))} material={plastic("#fff6dc", { rough: 0.7, map: textTex("jarlabel", ["MY PLANET"], { w: 512, h: 96, bg: "#fff6dc", fg: "#e0412b", px: 52 }) })} position={[0, 0.045, 0]} />
      ) : null}
      {children}
    </group>
  );
};

// ------------------------------------------------------------------ text props
/** a price tag card on a little stand or hanging: front face textured */
export const Tag: React.FC<{ p: V3; text: string[]; w?: number; h?: number; yaw?: number; bg?: string; fg?: string; strike?: number; tilt?: number }> = ({ p, text, w = 0.16, h = 0.08, yaw = 0, bg = "#fff4c8", fg = "#16121c", strike, tilt = -0.15 }) => (
  <group position={p} rotation={[tilt, yaw, 0]}>
    <mesh geometry={rbox(w, h, 0.006, 0.002)} material={plastic(bg, { rough: 0.6 })} castShadow />
    <mesh geometry={geoOf(`tagFace${w}|${h}`, () => new THREE.PlaneGeometry(w * 0.98, h * 0.96))} material={plastic("#ffffff", { decal: true, rough: 0.6, map: textTex(`${text.join("/")}|${bg}|${fg}|${strike ?? -1}`, text, { w: 512, h: Math.round((512 * h) / w), bg, fg, border: "#e0412b", strike }) })} position={[0, 0, 0.0045]} />
  </group>
);
/** a glowing sign (emissive text) */
export const Sign: React.FC<{ p: V3; text: string; w: number; h: number; color: string; yaw?: number; bg?: string; glow?: number }> = ({ p, text, w, h, color, yaw = 0, bg = "#221640", glow = 1.4 }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <mesh geometry={rbox(w + 0.1, h + 0.1, 0.06, 0.03)} material={plastic(bg, { rough: 0.5 })} castShadow />
    <mesh geometry={geoOf(`signFace${w}|${h}`, () => new THREE.PlaneGeometry(w, h))} material={plastic("#ffffff", { decal: true, map: textTex(`sign|${text}|${color}`, [text], { w: 1024, h: Math.round((1024 * h) / w), fg: color, px: Math.round((1024 * h) / w) * 0.62 }), emissive: color, ei: glow })} position={[0, 0, 0.035]} />
  </group>
);

// ------------------------------------------------------------------ store furniture
/** a shelf unit facing +z (rotate with yaw): sides, back, 3 boards; returns board heights for placing goods */
export const SHELF = { w: 2.6, d: 0.5, boards: [0.16, 0.74, 1.32], top: 1.9 };
export const ShelfUnit: React.FC<{ p: V3; yaw: number; w?: number; color?: string; children?: React.ReactNode }> = ({ p, yaw, w = SHELF.w, color = "#5b3fb5", children }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    {[-1, 1].map((s) => (
      <mesh key={s} geometry={rbox(0.06, SHELF.top, SHELF.d, 0.015)} material={plastic(color, { rough: 0.5 })} position={[(s * w) / 2, SHELF.top / 2, 0]} castShadow receiveShadow />
    ))}
    <mesh geometry={rbox(w, SHELF.top, 0.04, 0.01)} material={plastic("#7a62d0", { rough: 0.7 })} position={[0, SHELF.top / 2, -SHELF.d / 2 + 0.02]} castShadow receiveShadow />
    {[...SHELF.boards, SHELF.top].map((y, i) => (
      <group key={i}>
        <mesh geometry={rbox(w, 0.04, SHELF.d, 0.01)} material={plastic("#efe6ff", { rough: 0.45 })} position={[0, y - 0.02, 0]} castShadow receiveShadow />
        {/* a coloured price rail on the front edge */}
        <mesh geometry={box(w, 0.05, 0.012)} material={plastic(i % 2 ? "#2fd0bd" : "#ff5aa0", { rough: 0.5 })} position={[0, y - 0.035, SHELF.d / 2 + 0.006]} />
      </group>
    ))}
    {children}
  </group>
);
const box = (w: number, h: number, d: number) => geoOf(`pb${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
/** a little cup that holds a planet on a shelf */
export const Cradle: React.FC<{ p: V3; r: number; color?: string }> = ({ p, r, color = "#f0c040" }) => (
  <mesh geometry={geoOf("cradle", () => new THREE.CylinderGeometry(0.6, 0.45, 0.25, 20))} material={plastic(color, { rough: 0.35 })} position={[p[0], p[1] + r * 0.12, p[2]]} scale={r} castShadow receiveShadow />
);
/** a display podium for a big planet */
export const Podium: React.FC<{ p: V3; h: number; color?: string }> = ({ p, h, color = "#efe6ff" }) => (
  <group position={p}>
    <mesh geometry={geoOf(`podium${h}`, () => new THREE.CylinderGeometry(0.42, 0.5, h, 28))} material={plastic(color, { rough: 0.4 })} position={[0, h / 2, 0]} castShadow receiveShadow />
    <mesh geometry={geoOf("podiumRing", () => new THREE.TorusGeometry(0.43, 0.025, 8, 40))} material={plastic("#2fd0bd", { rough: 0.3, emissive: "#2fd0bd", ei: 0.6 })} position={[0, h - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} />
  </group>
);
export const Counter: React.FC<{ p: V3; yaw?: number }> = ({ p, yaw = 0 }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <mesh geometry={rbox(2.0, 0.92, 0.7, 0.04)} material={plastic("#ff7a2a", { rough: 0.45 })} position={[0, 0.46, 0]} castShadow receiveShadow />
    <mesh geometry={rbox(2.12, 0.06, 0.82, 0.02)} material={plastic("#f4f0ff", { rough: 0.3 })} position={[0, 0.95, 0]} castShadow receiveShadow />
    {/* stripes on the front */}
    {[0.25, 0.55].map((y) => (
      <mesh key={y} geometry={box(2.0, 0.06, 0.01)} material={plastic("#ffd23a", { rough: 0.5 })} position={[0, y, 0.356]} />
    ))}
    {/* register */}
    <group position={[0.62, 0.98, -0.08]}>
      <mesh geometry={rbox(0.36, 0.18, 0.3, 0.03)} material={plastic("#3a3f58", { rough: 0.4 })} position={[0, 0.09, 0]} castShadow />
      <mesh geometry={rbox(0.3, 0.16, 0.04, 0.01)} material={plastic("#2a2f48", { rough: 0.4 })} position={[0, 0.25, -0.08]} rotation={[-0.3, 0, 0]} castShadow />
      <mesh geometry={geoOf("regScreen", () => new THREE.PlaneGeometry(0.24, 0.1))} material={plastic("#7dffcf", { emissive: "#7dffcf", ei: 0.9 })} position={[0, 0.26, -0.057]} rotation={[-0.3, 0, 0]} />
    </group>
  </group>
);

// ------------------------------------------------------------------ small story props
/** the catalog: an open book; the right page shows Earth with its price */
export const Catalog: React.FC<{ p: V3; yaw?: number; price: string[]; strike?: number; open?: number }> = ({ p, yaw = 0, price, strike, open = 1 }) => {
  const W = 0.34, H = 0.44;
  const pageL = textTex("catL", ["SATURN", "$499"], { w: 512, h: 660, bg: "#fffaf0", fg: "#3a2a7a", px: 70 });
  const pageR = canvasTexture(`catR|${price.join("/")}|${strike ?? -1}`, 512, 660, (g, w, h) => {
    g.fillStyle = "#fffaf0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a5fd6";
    g.beginPath();
    g.arc(w / 2, h * 0.36, w * 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#58a846";
    for (const [x, y, rx, ry] of [[0.42, 0.3, 0.1, 0.07], [0.6, 0.42, 0.08, 0.1], [0.45, 0.47, 0.05, 0.04]]) {
      g.beginPath();
      g.ellipse(x * w, y * h, rx * w, ry * h, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#3a2a7a";
    g.textAlign = "center";
    g.font = "800 66px Poppins";
    g.fillText("EARTH", w / 2, h * 0.72);
    g.font = "800 80px Poppins";
    g.fillStyle = strike === undefined ? "#e0412b" : "#3a2a7a";
    g.fillText(price[0], w / 2, h * 0.88);
    if (strike !== undefined) {
      g.strokeStyle = "#e3242b";
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(w * 0.25, h * 0.88);
      g.lineTo(w * 0.75, h * 0.84);
      g.stroke();
    }
  });
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh geometry={rbox(W * 2 + 0.04, 0.03, H + 0.03, 0.01)} material={plastic("#d6283c", { rough: 0.5 })} position={[0, 0.015, 0]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geoOf("catPage", () => new THREE.PlaneGeometry(W, H))} material={plastic("#ffffff", { rough: 0.8, map: s < 0 ? pageL : pageR })} position={[(s * W) / 2, 0.035 + 0.01 * open, 0]} rotation={[-Math.PI / 2, s * 0.06 * open, 0]} receiveShadow />
      ))}
    </group>
  );
};
export const Card: React.FC<{ text: string }> = ({ text }) => (
  <group>
    <mesh geometry={rbox(0.3, 0.2, 0.008, 0.004)} material={plastic("#fffaf0", { rough: 0.8 })} castShadow />
    <mesh geometry={geoOf("cardFace", () => new THREE.PlaneGeometry(0.29, 0.19))} material={plastic("#ffffff", { decal: true, map: textTex(`card|${text}`, [text], { w: 512, h: 340, bg: "#fffaf0", fg: "#e0412b", px: 190 }) })} position={[0, 0, 0.005]} />
  </group>
);
export const Sandwich: React.FC<{ squash?: number }> = ({ squash = 0 }) => (
  <group scale={[1 + squash * 0.3, 1 - squash * 0.25, 1]}>
    <mesh geometry={rbox(0.3, 0.05, 0.22, 0.02)} material={plastic("#e3b46a", { rough: 0.7 })} position={[0, 0.0, 0]} castShadow />
    <mesh geometry={rbox(0.32, 0.025, 0.24, 0.01)} material={plastic("#5bc23a", { rough: 0.6 })} position={[0, 0.035, 0]} castShadow />
    <mesh geometry={rbox(0.28, 0.022, 0.2, 0.01)} material={plastic("#e3423a", { rough: 0.5 })} position={[0, 0.058, 0]} castShadow />
    <mesh geometry={rbox(0.29, 0.02, 0.21, 0.008)} material={plastic("#ffd23a", { rough: 0.5 })} position={[0, 0.078, 0]} castShadow />
    <mesh geometry={rbox(0.3, 0.05, 0.22, 0.02)} material={plastic("#e8bb72", { rough: 0.7 })} position={[0, 0.11, 0]} castShadow />
  </group>
);
/** the little red car with a rocket under its bumper; flame 0..1 */
export const RocketCar: React.FC<{ p: V3; rot?: V3; flame?: number; s?: number }> = ({ p, rot = [0, 0, 0], flame = 1, s = 1 }) => (
  <group position={p} rotation={rot} scale={s}>
    <mesh geometry={rbox(1.5, 0.42, 0.78, 0.1)} material={plastic("#e3242b", { rough: 0.35 })} position={[0, 0.42, 0]} castShadow receiveShadow />
    <mesh geometry={rbox(0.82, 0.36, 0.72, 0.1)} material={plastic("#e3242b", { rough: 0.35 })} position={[-0.1, 0.78, 0]} castShadow />
    {[-1, 1].map((sz) => (
      <mesh key={sz} geometry={geoOf("carWin", () => new THREE.PlaneGeometry(0.66, 0.24))} material={plastic("#8ec9f2", { rough: 0.15 })} position={[-0.1, 0.8, sz * 0.362]} rotation={[0, sz < 0 ? Math.PI : 0, 0]} />
    ))}
    {[[-0.48, -0.36], [-0.48, 0.36], [0.48, -0.36], [0.48, 0.36]].map(([x, z], i) => (
      <mesh key={i} geometry={geoOf("carWheel", () => new THREE.CylinderGeometry(0.2, 0.2, 0.14, 18))} material={plastic("#24242a", { rough: 0.8 })} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]} castShadow />
    ))}
    <mesh geometry={geoOf("carRocket", () => new THREE.CylinderGeometry(0.16, 0.2, 0.5, 16))} material={plastic("#d8dde8", { rough: 0.3 })} position={[-0.95, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
    {flame > 0 ? (
      <group position={[-1.2, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, flame, 1]}>
        <mesh geometry={geoOf("flameO", () => new THREE.ConeGeometry(0.17, 0.9, 16))} material={plastic("#ff8a1f", { emissive: "#ff6a00", ei: 2.2, transparent: true, opacity: 0.9 })} position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]} />
        <mesh geometry={geoOf("flameI", () => new THREE.ConeGeometry(0.09, 0.55, 12))} material={plastic("#fff2a0", { emissive: "#fff2a0", ei: 3 })} position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]} />
      </group>
    ) : null}
  </group>
);
export const Saucer: React.FC<{ p: V3; s?: number; color?: string; t?: number; seed?: number }> = ({ p, s = 1, color = "#9aa3c0", t = 0, seed = 0 }) => (
  <group position={[p[0], p[1] + 0.06 * Math.sin(t * 2 + seed), p[2]]} rotation={[0.08 * Math.sin(t * 1.3 + seed), seed, 0.06]} scale={s}>
    <mesh geometry={geoOf("saucerDisc", () => new THREE.SphereGeometry(1, 32, 12))} material={plastic(color, { rough: 0.25 })} scale={[1, 0.22, 1]} castShadow />
    <mesh geometry={geoOf("saucerDome", () => new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2))} material={plastic("#9ff0ff", { rough: 0.1, transparent: true, opacity: 0.75, emissive: "#5fd8ff", ei: 0.3 })} position={[0, 0.15, 0]} />
    {Array.from({ length: 8 }, (_, i) => (
      <mesh key={i} geometry={geoOf("saucerLight", () => new THREE.SphereGeometry(0.06, 8, 6))} material={plastic(i % 2 ? "#ffd23a" : "#ff5aa0", { emissive: i % 2 ? "#ffd23a" : "#ff5aa0", ei: 2 })} position={[Math.cos((i / 8) * Math.PI * 2) * 0.92, 0, Math.sin((i / 8) * Math.PI * 2) * 0.92]} />
    ))}
  </group>
);
/** a flashlight held by a human; the beam points up the hand's local -y... as built: beam along +y */
export const Flashlight: React.FC<{ beam?: number }> = ({ beam = 1 }) => (
  <group>
    <mesh geometry={geoOf("flBody", () => new THREE.CylinderGeometry(0.03, 0.035, 0.2, 12))} material={plastic("#2a2f48", { rough: 0.4 })} castShadow />
    <mesh geometry={geoOf("flHead", () => new THREE.CylinderGeometry(0.05, 0.035, 0.06, 12))} material={plastic("#ffd23a", { rough: 0.3, emissive: "#fff2b0", ei: 1.5 })} position={[0, 0.12, 0]} />
    {beam > 0 ? (
      <mesh geometry={geoOf("flBeam", () => new THREE.ConeGeometry(0.5, 4, 24, 1, true))} material={plastic("#fff6c8", { emissive: "#fff6c8", ei: 1.2, transparent: true, opacity: 0.16 * beam, side: THREE.DoubleSide })} position={[0, 2.15, 0]} rotation={[Math.PI, 0, 0]} renderOrder={5} />
    ) : null}
  </group>
);
/** glowing message letters (a plane with emissive text), opacity 0..1 */
export const Message: React.FC<{ p: V3; text: string[]; w: number; op: number; color?: string }> = ({ p, text, w, op, color = "#fff2a0" }) =>
  op <= 0.01 ? null : (
    <mesh geometry={geoOf(`msg${w}`, () => new THREE.PlaneGeometry(w, w * 0.5))} material={plastic("#ffffff", { transparent: true, opacity: op, map: textTex(`msg|${text.join("/")}`, text, { w: 1024, h: 512, fg: color, px: 150 }), emissive: color, ei: 1.4 })} position={p} renderOrder={6} />
  );

// ------------------------------------------------------------------ holograms and neon
/** a holographic price tag: a translucent cyan panel with scanlines and glowing text, floating and gently bobbing */
export const HoloTag: React.FC<{ p: V3; text: string; t: number; seed?: number; w?: number }> = ({ p, text, t, seed = 0, w = 0.2 }) => {
  const h = w * 0.36;
  const tex = canvasTexture(`holo|${text}`, 512, Math.round(512 * 0.36), (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(80,230,255,0.28)";
    g.beginPath();
    g.roundRect(3, 3, W - 6, H - 6, H * 0.18);
    g.fill();
    g.strokeStyle = "rgba(160,250,255,0.95)";
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.12)";
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    g.fillStyle = "#e8ffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${Math.round(H * (text.length > 9 ? 0.4 : 0.52))}px Poppins`;
    g.fillText(text, W / 2, H / 2 + 2);
  });
  const bob = 0.008 * Math.sin(t * 2.2 + seed);
  return (
    <group position={[p[0], p[1] + bob, p[2]]}>
      <mesh geometry={geoOf(`holo${w}`, () => new THREE.PlaneGeometry(w, h))} material={plastic("#ffffff", { map: tex, transparent: true, emissive: "#7fefff", ei: 1.1, side: THREE.DoubleSide })} renderOrder={6} />
      {/* the little emitter dot under it and its faint beam */}
      <mesh geometry={geoOf("holoDot", () => new THREE.SphereGeometry(0.008, 8, 6))} material={plastic("#9ff8ff", { emissive: "#9ff8ff", ei: 3 })} position={[0, -h / 2 - 0.03, 0]} />
    </group>
  );
};
/** a neon sign: a dark backing board, glowing text, and a glowing tube frame (strong emissive: the bloom makes it glow).
 * hang = two wires up to the ceiling line, double-sided */
export const NeonSign: React.FC<{ p: V3; text: string; w: number; h: number; color: string; yaw?: number; hang?: boolean }> = ({ p, text, w, h, color, yaw = 0, hang = false }) => {
  const face = plastic("#ffffff", { decal: true, map: textTex(`neon|${text}|${color}`, [text], { w: 1024, h: Math.round((1024 * h) / w), fg: color, px: Math.round((1024 * h) / w) * 0.62 }), emissive: color, ei: 2.6 });
  const tube = plastic(color, { emissive: color, ei: 2.4 });
  const frame = (z: number) => (
    <>
      {[[0, h / 2 + 0.05, w + 0.1, 0.025], [0, -h / 2 - 0.05, w + 0.1, 0.025]].map(([x, y, ww, hh], i) => (
        <mesh key={`h${i}${z}`} geometry={rbox(ww, hh, 0.025, 0.012)} material={tube} position={[x, y, z]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`v${s}${z}`} geometry={rbox(0.025, h + 0.125, 0.025, 0.012)} material={tube} position={[(s * (w + 0.1)) / 2, 0, z]} />
      ))}
    </>
  );
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh geometry={rbox(w + 0.2, h + 0.2, 0.06, 0.03)} material={plastic("#1a1036", { rough: 0.5 })} castShadow />
      <mesh geometry={geoOf(`signFace${w}|${h}`, () => new THREE.PlaneGeometry(w, h))} material={face} position={[0, 0, 0.035]} />
      {frame(0.045)}
      {hang ? (
        <>
          <mesh geometry={geoOf(`signFace${w}|${h}`, () => new THREE.PlaneGeometry(w, h))} material={face} position={[0, 0, -0.035]} rotation={[0, Math.PI, 0]} />
          {frame(-0.045)}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geoOf("signWire", () => new THREE.CylinderGeometry(0.004, 0.004, 1, 4))} material={plastic("#d8d8e8")} position={[(s * w) / 2.4, h / 2 + 0.1 + 0.35, 0]} scale={[1, 0.7, 1]} />
          ))}
        </>
      ) : null}
    </group>
  );
};
