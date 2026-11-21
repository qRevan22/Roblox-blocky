// The sets (our own designs). Each set has its own origin; only one set is mounted per
// shot. Store: an aisle of planet shelves along z (two rows of spinning planets with holographic tags), hanging planet
// mobiles, neon signs, wall shelves, display podiums at the back, a big window onto space, a display island and the
// counter at the front right, the exit on the left. Home: a child's bedroom at night with a round window, a shelf by
// the window, a bed, a desk, toys and glowing stickers. Space: the shop seen from outside on its asteroid. Earth's surface
// reuses the template suburb (blocky/World). Ambient occlusion is faked with soft dark gradients along wall/floor
// corners and under objects; coloured point lights stand in for light bouncing off coloured surfaces.
import React from "react";
import * as THREE from "three";
import { canvasTexture, geoOf, plastic, rbox } from "../blocky/mat";
import type { V3 } from "../blocky/motion";
import { Blob } from "../blocky/Contact";
import { Counter, Cradle, Jar, Podium, Saucer, ShelfUnit, SHELF, Tag, HoloTag, NeonSign } from "./props";
import { bandsTex, Planet, ringTex, rockyTex } from "./planets";
import type { PlanetKind } from "./planets";
import { EARTH_IN_JAR_Y, ROOM, STORE } from "./layout";
export { EARTH_IN_JAR_Y, ROOM, STORE };

// ------------------------------------------------------------------ the products
export const KINDS: Record<string, PlanetKind> = {
  giant: { id: "giant", tex: bandsTex("giant", ["#e07a5a", "#f2b880", "#c4583e", "#f6d6a8", "#d86a4a"], 3), rough: 0.6, atmo: ["#ffb080", 0.8] },
  saturn: {
    id: "saturn", tex: bandsTex("saturn", ["#e8c86a", "#f6e0a0", "#d4a84a", "#fff0c0", "#c89a48"], 5), rough: 0.5, atmo: ["#ffe0a0", 0.6],
    ring: { inner: 1.3, outer: 2.35, tex: ringTex("saturn", ["#f6e2b0", "#c8a060", "#fff4d8", "#a87a48", "#e8c890", "#d0b0e0"], 2), tilt: 0.38 },
  },
  jupiter: { id: "jupiter", tex: bandsTex("jupiter", ["#c8925a", "#f0d8b0", "#a86a3a", "#e8c090", "#f8e8d0", "#b87848"], 7, "#d0402a", [[0.7, 0.36, 0.035, "#f8f0e0"]]), rough: 0.6, atmo: ["#ffd0a0", 0.32] },
  chrome: { id: "chrome", tex: rockyTex("chrome", "#e8eef8", "#9aa6bc", 9), rough: 0.14, metal: 0.9, atmo: ["#bfe8ff", 0.5] },
  ringed: {
    id: "ringed", tex: bandsTex("ringed", ["#5fd8ff", "#9ff0ff", "#3aa0e0", "#c8f8ff"], 11), rough: 0.4, atmo: ["#7fe8ff", 0.9],
    ring: { inner: 1.35, outer: 2.3, tex: ringTex("ringed", ["#ff8ac8", "#ffd0ea", "#b070e0", "#ffffff", "#ff5aa0"], 4), tilt: 0.5 },
  },
  ice: { id: "ice", tex: rockyTex("ice", "#f0faff", "#8fc8f0", 13), rough: 0.25, atmo: ["#bfefff", 0.9] },
  lava: { id: "lava", tex: rockyTex("lava", "#ff7a2a", "#4a1408", 15), rough: 0.6, glow: "#ff4a1a", atmo: ["#ff6a2a", 1.0] },
  mint: { id: "mint", tex: bandsTex("mint", ["#7fe3b8", "#c8ffe8", "#4fc898", "#e8fff4"], 17), rough: 0.5, atmo: ["#7fffc8", 0.7] },
  violet: { id: "violet", tex: rockyTex("violet", "#c8a0ff", "#5a3aa0", 19), rough: 0.5, atmo: ["#c8a0ff", 0.8] },
  pinkGiant: { id: "pinkGiant", tex: bandsTex("pinkGiant", ["#ff8ac8", "#ffd0ea", "#d0509a", "#ffe8f4"], 21), rough: 0.6, atmo: ["#ff9ad0", 0.8] },
  candy: {
    id: "candy", tex: bandsTex("candy", ["#b070e0", "#ffd23a", "#ff8ac8", "#7fe3b8"], 23), rough: 0.45, atmo: ["#ffd0ff", 0.7],
    ring: { inner: 1.4, outer: 2.0, tex: ringTex("candy", ["#ffd23a", "#ffffff", "#7fe3b8"], 6), tilt: 0.3 },
  },
  ocean: { id: "ocean", tex: bandsTex("ocean", ["#2a5fd6", "#5fb0ff", "#1a3a9a", "#8fd0ff"], 25), rough: 0.3, atmo: ["#5fb0ff", 1.0] },
  sun: { id: "sunny", tex: rockyTex("sunny", "#fff2a0", "#ff9a2a", 27), rough: 0.6, glow: "#ffb030", atmo: ["#ffd060", 1.2] },
};
const SHELF_KINDS = [KINDS.ice, KINDS.lava, KINDS.mint, KINDS.violet, KINDS.pinkGiant, KINDS.giant, KINDS.candy, KINDS.ocean, KINDS.sun, KINDS.ringed];

// ------------------------------------------------------------------ store layout (m)

// ------------------------------------------------------------------ fake ambient occlusion
const aoAlpha = () =>
  canvasTexture("aoAlpha", 16, 128, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.35, "#6a6a6a");
    gr.addColorStop(1, "#000000");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }, false);
const aoMats = new Map<string, THREE.MeshBasicMaterial>();
const aoMat = (color: string, op: number) => {
  const k = `${color}|${op}`;
  let m = aoMats.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, alphaMap: aoAlpha(), transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    aoMats.set(k, m);
  }
  return m;
};
/** a soft dark gradient: dark on the corner line at p, fading over d m (floor: toward the group's +z; wall: upward) */
const AO: React.FC<{ p: V3; w: number; d?: number; yaw?: number; wall?: boolean; color?: string; op?: number }> = ({ p, w, d = 0.6, yaw = 0, wall = false, color = "#140a2a", op = 0.55 }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <mesh geometry={geoOf("aoPlane", () => new THREE.PlaneGeometry(1, 1))} material={aoMat(color, op)} position={wall ? [0, d / 2, 0.012] : [0, 0.006, d / 2]} rotation={wall ? [0, 0, Math.PI] : [-Math.PI / 2, 0, 0]} scale={[w, d, 1]} renderOrder={2} />
  </group>
);

// ------------------------------------------------------------------ store pieces
const floorTex = () => {
  const t = canvasTexture("storeFloor2", 256, 256, (g, W) => {
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        g.fillStyle = (i + j) % 2 ? "#d4c6f4" : "#a490e0";
        g.fillRect((i * W) / 2, (j * W) / 2, W / 2, W / 2);
      }
    g.strokeStyle = "rgba(60,40,120,0.3)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, W, W);
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, W);
    g.moveTo(0, W / 2);
    g.lineTo(W, W / 2);
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  return t;
};
const holedWall = (key: string, w: number, h: number, hole: { kind: "rect"; x0: number; x1: number; y0: number; y1: number } | { kind: "round"; cx: number; cy: number; r: number }, depth = 0.2) =>
  geoOf(`wall|${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.closePath();
    const p = new THREE.Path();
    if (hole.kind === "rect") {
      p.moveTo(hole.x0, hole.y0);
      p.lineTo(hole.x0, hole.y1);
      p.lineTo(hole.x1, hole.y1);
      p.lineTo(hole.x1, hole.y0);
      p.closePath();
    } else p.absarc(hole.cx, hole.cy, hole.r, 0, Math.PI * 2, true);
    s.holes.push(p);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 48 });
    g.translate(0, 0, -depth);
    return g;
  });
const B: React.FC<{ s: V3; p: V3; c: string; r?: V3; rough?: number; e?: number }> = ({ s, p, c, r, rough = 0.6, e }) => (
  <mesh geometry={rbox(s[0], s[1], s[2], Math.min(0.02, s[0] / 3, s[1] / 3, s[2] / 3))} material={plastic(c, { rough, emissive: e ? c : undefined, ei: e })} position={p} rotation={r} castShadow receiveShadow />
);
const price = (k: number) => `$${((k * 37 + 120) % 900) + 100}K`;

/** shelf goods: a front row and a smaller back row of spinning planets in cradles, holographic tags over the front row;
 * the left unit's bottom board is the bargain board (junk + a bargain item + a big paper price tag) */
const ShelfGoods: React.FC<{ side: "L" | "R"; earth: React.ReactNode; tag99: string[]; t: number }> = ({ side, earth, tag99, t }) => {
  const out: React.ReactNode[] = [];
  let k = side === "L" ? 0 : 5;
  SHELF.boards.concat([SHELF.top]).forEach((y, b) => {
    if (side === "L" && b === 0) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = -1.05 + i * (2.1 / (n - 1));
      if (side === "R" && ((b === 1 && i === 4) || (b === 3 && i === 0))) continue; // chrome + ringed go here
      const r = 0.075 + 0.045 * (((k * 7) % 4) / 3);
      const kind = SHELF_KINDS[k % SHELF_KINDS.length];
      out.push(
        <group key={`${b}-${i}`}>
          <Cradle p={[x, y, 0.06]} r={r} color={["#f0c040", "#2fd0bd", "#ff5aa0", "#b070e0"][k % 4]} />
          <Planet p={[x, y + r * 1.15, 0.06]} r={r} kind={kind} spin={t * (0.3 + 0.1 * (k % 3)) + k} tilt={0.2 + 0.1 * (k % 3)} />
          {b < 3 ? <HoloTag p={[x, y + r * 2.3 + 0.07, 0.12]} text={price(k)} t={t} seed={k} /> : null}
        </group>,
      );
      if (i < n - 1) {
        const rb = 0.05 + 0.02 * ((k * 3) % 3);
        out.push(<Planet key={`bk${b}-${i}`} p={[x + 1.05 / (n - 1), y + rb * 1.1 + 0.03, -0.12]} r={rb} kind={SHELF_KINDS[(k + 3) % SHELF_KINDS.length]} spin={t * 0.4 + k * 2} />);
      }
      k++;
    }
  });
  if (side === "L") {
    const y = SHELF.boards[0];
    out.push(
      <group key="junk">
        <mesh geometry={geoOf("can", () => new THREE.CylinderGeometry(0.06, 0.06, 0.14, 14))} material={plastic("#9aa0a8", { rough: 0.5 })} position={[0.7, y + 0.07, 0.05]} rotation={[0, 0, 0.2]} castShadow />
        <mesh geometry={geoOf("flatBall", () => new THREE.SphereGeometry(0.1, 16, 8))} material={plastic("#a86a5a", { rough: 0.8 })} position={[0.98, y + 0.04, 0.0]} scale={[1, 0.4, 1]} castShadow />
        <B s={[0.16, 0.05, 0.08]} p={[0.25, y + 0.025, 0.08]} c="#6a7a5a" r={[0, 0.5, 0]} />
        <mesh geometry={geoOf("mug", () => new THREE.CylinderGeometry(0.05, 0.045, 0.1, 14))} material={plastic("#d8d0c0", { rough: 0.6 })} position={[-1.05, y + 0.05, 0.02]} castShadow />
        <mesh geometry={geoOf("web", () => new THREE.CircleGeometry(0.16, 6, 0, Math.PI / 2))} material={plastic("#ffffff", { transparent: true, opacity: 0.25, side: THREE.DoubleSide })} position={[-1.25, y + 0.5, -0.2]} rotation={[0, Math.PI / 2, Math.PI]} />
        <Cradle p={[-0.58, y, 0.06]} r={0.11} color="#9a8a78" />
        <group position={[-0.58, y + 0.115, 0.06]}>{earth}</group>
        <Tag p={[-0.58, y + 0.04, SHELF.d / 2 + 0.03]} text={tag99} w={0.3} h={0.17} tilt={-0.18} bg="#ffe14a" />
      </group>,
    );
  } else {
    out.push(
      <group key="special">
        <Cradle p={[0.94, SHELF.boards[1], 0.06]} r={0.15} color="#2fd0bd" />
        <HoloTag p={[0.94, SHELF.boards[1] + 0.42, 0.12]} text="SHINY!" t={t} seed={41} />
        <Cradle p={[-0.95, SHELF.top, 0.06]} r={0.16} color="#ff5aa0" />
      </group>,
    );
  }
  return <>{out}</>;
};
const MOB_Y = 3.15; // mobile crossbeams: below the PLANET SHOP sign line
const Mobile: React.FC<{ z: number; t: number; seed: number }> = ({ z, t, seed }) => (
  <group position={[0, 0, z]}>
    <B s={[3.4, 0.08, 0.08]} p={[0, MOB_Y, 0]} c="#3a2a7a" />
    {[-1.1, -0.35, 0.4, 1.1].map((x, i) => {
      const y = MOB_Y - 0.6 - 0.22 * ((i + seed) % 3);
      const r = 0.12 + 0.05 * ((i * 2 + seed) % 3);
      const sw = 0.04 * Math.sin(t * 0.9 + i + seed);
      return (
        <group key={i} position={[x, MOB_Y, 0]} rotation={[sw, 0, sw * 0.5]}>
          <mesh geometry={geoOf("wire", () => new THREE.CylinderGeometry(0.004, 0.004, 1, 4))} material={plastic("#d8d8e8", { rough: 0.3 })} position={[0, (y - MOB_Y) / 2, 0]} scale={[1, MOB_Y - y, 1]} />
          {/* the back mobile (seed 4) carries ringed planets (a good target to point at) */}
          <Planet p={[0, y - MOB_Y - r, 0]} r={r} kind={seed === 4 ? [KINDS.ringed, KINDS.candy, KINDS.saturn, KINDS.ringed][i] : SHELF_KINDS[(i * 3 + seed) % SHELF_KINDS.length]} spin={t * 0.5 + i} tilt={seed === 4 ? 0.45 : 0.25} />
        </group>
      );
    })}
  </group>
);
const WallShelf: React.FC<{ x: number; z: number; yaw: number; t: number; seed: number }> = ({ x, z, yaw, t, seed }) => (
  <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
    {[1.0, 1.7].map((y, b) => (
      <group key={b}>
        <B s={[2.6, 0.05, 0.35]} p={[0, y, 0.17]} c="#efe6ff" />
        <mesh geometry={geoOf("wsRail", () => new THREE.BoxGeometry(2.6, 0.04, 0.012))} material={plastic(b ? "#ff5aa0" : "#2fd0bd", { emissive: b ? "#ff5aa0" : "#2fd0bd", ei: 1.0 })} position={[0, y - 0.02, 0.35]} />
        {[-1.0, -0.5, 0, 0.5, 1.0].map((px, i) => {
          const r = 0.08 + 0.05 * ((i + b + seed) % 3) * 0.5;
          return <Planet key={i} p={[px, y + 0.03 + r, 0.17]} r={r} kind={SHELF_KINDS[(i + b * 5 + seed) % SHELF_KINDS.length]} spin={t * 0.35 + i} />;
        })}
      </group>
    ))}
  </group>
);
const Island: React.FC<{ t: number }> = ({ t }) => (
  <group position={STORE.island}>
    <mesh geometry={geoOf("islandBase", () => new THREE.CylinderGeometry(0.32, 0.38, 0.72, 28))} material={plastic("#ff7a2a", { rough: 0.45 })} position={[0, 0.36, 0]} castShadow receiveShadow />
    <mesh geometry={geoOf("islandTop", () => new THREE.CylinderGeometry(0.42, 0.42, 0.05, 32))} material={plastic("#f4f0ff", { rough: 0.3 })} position={[0, 0.745, 0]} castShadow receiveShadow />
    <mesh geometry={geoOf("islandRing", () => new THREE.TorusGeometry(0.42, 0.015, 8, 40))} material={plastic("#2fd0bd", { emissive: "#2fd0bd", ei: 1.4 })} position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} />
    {Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2;
      return <Planet key={i} p={[Math.cos(a) * 0.2, 0.83 + 0.03 * (i % 2), Math.sin(a) * 0.2]} r={0.055} kind={[KINDS.ice, KINDS.violet, KINDS.chrome, KINDS.mint][i % 4]} spin={t * 0.6 + i} />;
    })}
    <HoloTag p={[0, 1.2, 0]} text="MOONS 2 FOR 1" t={t} seed={7} w={0.42} />
    <Blob p={[0, 0, 0]} sx={1.0} sz={1.0} op={0.55} />
  </group>
);

export const Store: React.FC<{ t: number; earth: React.ReactNode; tag99?: string[]; poster?: boolean; storm?: number }> = ({ t, earth, tag99 = ["SALE"], poster = false, storm = 0 }) => {
  const W = 12, H = 4.2;
  const wall = plastic("#6b4fd0", { rough: 0.7 });
  const trim = plastic("#2fd0bd", { rough: 0.4, emissive: "#2fd0bd", ei: 1.2 });
  return (
    <>
      <mesh geometry={geoOf("storeFloorPlane", () => new THREE.PlaneGeometry(W + 2, 12))} material={plastic("#ffffff", { rough: 0.5, map: floorTex() })} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      <mesh geometry={holedWall("storeBack", W, H, { kind: "rect", x0: -3.2, x1: 3.2, y0: 0.9, y1: 3.5 })} material={wall} position={[0, 0, -4.5]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geoOf("storeSide", () => new THREE.BoxGeometry(0.2, H, 10))} material={wall} position={[s * (W / 2), H / 2, 0.5]} castShadow receiveShadow />
      ))}
      <AO p={[0, 0, -4.5]} w={W} d={0.9} />
      <AO p={[0, 0, -4.5]} w={W} d={0.7} wall />
      {[-1, 1].map((s) => (
        <group key={s}>
          <AO p={[s * (W / 2 - 0.1), 0, 0.5]} w={10} d={0.9} yaw={-s * Math.PI / 2} />
          <AO p={[s * (W / 2 - 0.1), 0, 0.5]} w={10} d={0.7} yaw={-s * Math.PI / 2} wall />
        </group>
      ))}
      {[-1.07, 1.07].map((x) => (
        <B key={x} s={[0.08, 2.6, 0.1]} p={[x, 2.2, -4.55]} c="#3a2a7a" />
      ))}
      <B s={[6.5, 0.12, 0.12]} p={[0, 0.9, -4.5]} c="#3a2a7a" />
      <B s={[6.5, 0.12, 0.12]} p={[0, 3.5, -4.5]} c="#3a2a7a" />
      <mesh geometry={geoOf("trimBack", () => new THREE.BoxGeometry(W, 0.08, 0.06))} material={trim} position={[0, H - 0.1, -4.38]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geoOf("trimSide", () => new THREE.BoxGeometry(0.06, 0.08, 10))} material={trim} position={[s * (W / 2 - 0.12), H - 0.1, 0.5]} />
      ))}
      <mesh geometry={geoOf("trimFloor", () => new THREE.BoxGeometry(W, 0.03, 0.04))} material={plastic("#ff5aa0", { emissive: "#ff5aa0", ei: 1.2 })} position={[0, 0.06, -4.38]} />
      <NeonSign p={[0, 3.85, -4.3]} text="PLANET SHOP" w={3.2} h={0.5} color="#ffd23a" />
      <NeonSign p={[0, 2.85, STORE.shelfZ + 0.6]} text="NEW MOONS!" w={1.5} h={0.32} color="#7dffcf" hang />
      <NeonSign p={[-5.85, 2.7, -1.6]} text="RINGS 50% OFF" w={2.2} h={0.36} color="#ff5aa0" yaw={Math.PI / 2} />
      <NeonSign p={[5.85, 2.75, -1.4]} text="GAS GIANTS" w={1.9} h={0.36} color="#5fd8ff" yaw={-Math.PI / 2} />
      <Planet p={[9, 4, -34]} r={9} kind={KINDS.pinkGiant} spin={0.3 + t * 0.01} tilt={0.3} />
      <Planet p={[-9, 9, -40]} r={3} kind={KINDS.candy} spin={t * 0.02} tilt={0.4} />
      <Planet p={[-5, 5.5, -26]} r={1.3} kind={KINDS.ice} spin={t * 0.05} />
      <ShelfUnit p={[-STORE.aisleX, 0, STORE.shelfZ]} yaw={Math.PI / 2}>
        <ShelfGoods side="L" earth={earth} tag99={tag99} t={t} />
      </ShelfUnit>
      <ShelfUnit p={[STORE.aisleX, 0, STORE.shelfZ]} yaw={-Math.PI / 2} color="#d0509a">
        <ShelfGoods side="R" earth={null} tag99={tag99} t={t} />
      </ShelfUnit>
      {[-1, 1].map((s) => (
        <group key={s}>
          <AO p={[s * (STORE.aisleX - 0.27), 0, STORE.shelfZ]} w={2.7} d={0.45} yaw={-s * Math.PI / 2} op={0.6} />
          <AO p={[s * (STORE.aisleX + 0.27), 0, STORE.shelfZ]} w={2.7} d={0.45} yaw={s * Math.PI / 2} op={0.5} />
        </group>
      ))}
      <Planet p={STORE.chrome} r={0.15} kind={KINDS.chrome} spin={t * 0.3} />
      <Planet p={STORE.ringed} r={0.16} kind={KINDS.ringed} spin={t * 1.5} tilt={0.35 + 0.05 * Math.sin(t * 2)} />
      <Mobile z={-0.6} t={t} seed={1} />
      <Mobile z={-2.1} t={t} seed={4} />
      <WallShelf x={-5.88} z={-1.6} yaw={Math.PI / 2} t={t} seed={2} />
      <WallShelf x={-5.88} z={1.2} yaw={Math.PI / 2} t={t} seed={6} />
      <WallShelf x={5.88} z={-1.4} yaw={-Math.PI / 2} t={t} seed={3} />
      <Podium p={[STORE.giant[0], 0, STORE.giant[2]]} h={0.62} />
      <Planet p={STORE.giant} r={0.8} kind={KINDS.giant} spin={t * 0.15} tilt={0.15} />
      <HoloTag p={[STORE.giant[0], 2.45, STORE.giant[2]]} text="$5,000,000" t={t} seed={3} w={0.5} />
      <Podium p={[STORE.saturn[0], 0, STORE.saturn[2]]} h={0.62} color="#ffe8a0" />
      <Planet p={STORE.saturn} r={0.55} kind={KINDS.saturn} spin={t * 0.2} />
      <Tag p={[STORE.saturn[0], 0.42, STORE.saturn[2] + 0.52]} text={["SATURN", "$499"]} w={0.62} h={0.3} tilt={0} />
      <Podium p={[STORE.jupiter[0], 0, STORE.jupiter[2]]} h={0.5} color="#ffd0b0" />
      {/* slow spin: the big storm faces front at t ~ 9 s (shift the 9 to time it for your lens) */}
      <Planet p={STORE.jupiter} r={0.6} kind={KINDS.jupiter} spin={0.08 * (t - 9) - 0.35} tilt={0.1} />
      <Tag p={[STORE.jupiter[0], 0.34, STORE.jupiter[2] + 0.52]} text={["NEW!"]} w={0.62} h={0.18} tilt={0} bg="#9ff0ff" />
      {storm > 0 ? <Lightning p={[STORE.jupiter[0] - 0.25, STORE.jupiter[1] + 0.05, STORE.jupiter[2] + 0.5]} t={t} k={storm} /> : null}
      <Island t={t} />
      <Counter p={STORE.counter} yaw={-Math.PI / 2} />
      <B s={[0.7, 0.42, 0.7]} p={[STORE.counter[0] + 0.6, 0.21, STORE.counter[2]]} c="#c8a070" />
      <group position={STORE.door}>
        <B s={[0.1, 2.3, 1.3]} p={[0.06, 1.15, 0]} c="#3a2a7a" />
        <B s={[0.06, 2.1, 1.1]} p={[0.12, 1.05, 0]} c="#9ff0ff" rough={0.15} e={0.5} />
        <NeonSign p={[0.2, 2.55, 0]} text="EXIT" w={0.6} h={0.22} color="#7dffcf" yaw={Math.PI / 2} />
      </group>
      {poster ? <NeonSign p={[STORE.counter[0] + 1.5, 2.3, STORE.counter[2]]} text="PLANETS" w={2.2} h={0.36} color="#ff5aa0" yaw={-Math.PI / 2} /> : null}
      {[STORE.giant, STORE.saturn, STORE.jupiter].map((q, i) => (
        <Blob key={`pb${i}`} p={q} sx={1.4} sz={1.4} op={0.5} />
      ))}
      <Blob p={STORE.counter} sx={1.0} sz={2.3} op={0.5} />
      <pointLight position={[0, 2.6, -1.0]} color="#ffd8a0" intensity={3} distance={7} decay={2} />
      <pointLight position={[0, 1.6, -3.0]} color="#ff9ad0" intensity={3} distance={4} decay={2} />
      <pointLight position={[0.75, 1.0, -1.3]} color="#ff7ac0" intensity={0.8} distance={1.6} decay={2} />
      <pointLight position={[-0.6, 0.6, -0.6]} color="#ffe0b0" intensity={1.4} distance={1.6} decay={2} />
      <pointLight position={[0, 0.3, 0.8]} color="#7dffcf" intensity={1.0} distance={3} decay={2} />
      <pointLight position={[2.2, 1.2, 1.0]} color="#ffb060" intensity={1.4} distance={2.5} decay={2} />
    </>
  );
};
const Lightning: React.FC<{ p: V3; t: number; k: number }> = ({ p, t, k }) => {
  const on = Math.sin(t * 23) > 0.1 || Math.sin(t * 9.7) > 0.6;
  if (!on) return null;
  const pts: V3[] = [[0, 0.22, 0], [0.06, 0.1, 0], [-0.02, 0.06, 0], [0.07, -0.08, 0], [0.0, -0.05, 0], [0.05, -0.2, 0]];
  return (
    <group position={p} scale={k}>
      {pts.slice(1).map((q, i) => {
        const a = pts[i];
        const dx = q[0] - a[0], dy = q[1] - a[1];
        return (
          <mesh key={i} geometry={geoOf("boltSeg", () => new THREE.BoxGeometry(0.018, 1, 0.018))} material={plastic("#e8f8ff", { emissive: "#bfefff", ei: 4 })} position={[(a[0] + q[0]) / 2, (a[1] + q[1]) / 2, 0]} rotation={[0, 0, Math.atan2(-dx, dy)]} scale={[1, Math.hypot(dx, dy), 1]} />
        );
      })}
      <pointLight color="#bfefff" intensity={1.0} distance={1.6} decay={2} />
    </group>
  );
};

// ------------------------------------------------------------------ the kid's room (night)
const planks = () => {
  const t = canvasTexture("planks", 256, 256, (g, W) => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ["#ffffff", "#f0e8e0", "#f8f0e8", "#e8e0d8"][i];
      g.fillRect(0, (i * W) / 4, W, W / 4);
      g.fillStyle = "rgba(60,30,10,0.35)";
      g.fillRect(0, (i * W) / 4, W, 2);
      g.fillRect(((i * 97) % W) | 0, (i * W) / 4, 2, W / 4);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  return t;
};
const Star: React.FC<{ p: V3; s: number; c?: string; r?: V3 }> = ({ p, s, c = "#fff2a0", r = [0, 0, 0] }) => (
  <mesh
    geometry={geoOf("sticker", () => {
      const sh = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.4 : 1;
        if (i) sh.lineTo(rr * Math.cos(a), -rr * Math.sin(a));
        else sh.moveTo(rr * Math.cos(a), -rr * Math.sin(a));
      }
      return new THREE.ShapeGeometry(sh);
    })}
    material={plastic(c, { emissive: c, ei: 1.6 })}
    position={p}
    rotation={r}
    scale={s}
  />
);
export const Room: React.FC<{ t: number; earth: React.ReactNode; jarGlow: number; lamp?: number }> = ({ t, earth, jarGlow, lamp = 1 }) => {
  const W = 5, H = 3;
  const wall = plastic("#4a52b0", { rough: 0.8 });
  return (
    <>
      <mesh geometry={geoOf("roomFloor", () => new THREE.PlaneGeometry(W, 5))} material={plastic("#6a4a3a", { rough: 0.7, map: planks() })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]} receiveShadow />
      <mesh geometry={holedWall("roomBack", W, H, { kind: "round", cx: 0, cy: ROOM.win[1], r: ROOM.winR })} material={wall} position={[0, 0, -2.0 + 0.2]} castShadow receiveShadow />
      <mesh geometry={holedWall("roomBackOut", W, H, { kind: "round", cx: 0, cy: ROOM.win[1], r: ROOM.winR }, 0.05)} material={plastic("#8a92b8", { rough: 0.5 })} position={[0, 0, -2.0]} castShadow receiveShadow />
      <mesh geometry={geoOf("winRing", () => new THREE.TorusGeometry(ROOM.winR, 0.06, 12, 48))} material={plastic("#ffd23a", { rough: 0.35 })} position={[0, ROOM.win[1], -1.82]} />
      <mesh geometry={geoOf("winRingOut", () => new THREE.TorusGeometry(ROOM.winR + 0.04, 0.08, 12, 48))} material={plastic("#c8cde0", { rough: 0.35 })} position={[0, ROOM.win[1], -2.03]} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} geometry={geoOf("hullLight", () => new THREE.SphereGeometry(0.025, 8, 6))} material={plastic(i % 2 ? "#ffd23a" : "#7dffcf", { emissive: i % 2 ? "#ffd23a" : "#7dffcf", ei: 2 })} position={[Math.cos(a) * 0.82, ROOM.win[1] + Math.sin(a) * 0.82, -2.06]} />;
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geoOf("roomSide", () => new THREE.BoxGeometry(0.2, H, 5))} material={wall} position={[s * (W / 2), H / 2, 0.5]} castShadow receiveShadow />
      ))}
      <AO p={[0, 0, -1.8]} w={W} d={0.7} color="#0a0820" op={0.6} />
      <AO p={[0, 0, -1.8]} w={W} d={0.5} wall color="#0a0820" op={0.55} />
      {[-1, 1].map((s) => (
        <AO key={s} p={[s * (W / 2 - 0.1), 0, 0.5]} w={5} d={0.7} yaw={-s * Math.PI / 2} color="#0a0820" op={0.6} />
      ))}
      <B s={[1.6, 0.06, 0.34]} p={[0, ROOM.sillY - 0.03, -1.67]} c="#f4e6c8" />
      <B s={[1.5, 0.2, 0.06]} p={[0, ROOM.sillY - 0.16, -1.53]} c="#e8d4b0" />
      <Jar p={ROOM.jar}>
        <group position={[0, EARTH_IN_JAR_Y, 0]}>{earth}</group>
      </Jar>
      <B s={[1.0, 0.4, 2.0]} p={[-1.85, 0.2, -0.6]} c="#5fd8ff" />
      <B s={[0.95, 0.12, 1.9]} p={[-1.85, 0.46, -0.6]} c="#ff8ac8" />
      {[-1.2, -0.6, 0, 0.6].map((z, i) => (
        <B key={i} s={[0.96, 0.02, 0.22]} p={[-1.85, 0.53, z + 0.3]} c={i % 2 ? "#ffd23a" : "#b070e0"} />
      ))}
      <B s={[0.7, 0.14, 0.4]} p={[-1.85, 0.6, -1.3]} c="#ffffff" />
      <B s={[1.0, 0.8, 0.1]} p={[-1.85, 0.6, -1.62]} c="#ffd23a" />
      <AO p={[-1.3, 0, -0.6]} w={2.0} d={0.4} yaw={Math.PI / 2} op={0.45} />
      <group position={[-1.85, 0, -0.6]}>
        {[[-0.3, 0.0], [0.25, 0.35], [0.0, -0.4]].map(([x, z], i) => (
          <group key={i} position={[x, 0, z]} rotation={[0.05 * Math.sin(t + i), 0, 0]}>
            <mesh geometry={geoOf("wire", () => new THREE.CylinderGeometry(0.004, 0.004, 1, 4))} material={plastic("#d8d8e8")} position={[0, 2.55, 0]} scale={[1, 0.9, 1]} />
            <Planet p={[0, 2.05, 0]} r={0.07 + 0.02 * i} kind={[KINDS.saturn, KINDS.ocean, KINDS.lava][i]} spin={t * 0.5 + i} />
          </group>
        ))}
      </group>
      <mesh geometry={geoOf("rug", () => new THREE.CircleGeometry(0.9, 40))} material={plastic("#ff7a2a", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.004, -0.5]} receiveShadow />
      <mesh geometry={geoOf("rugRing", () => new THREE.RingGeometry(0.62, 0.7, 40))} material={plastic("#ffd23a", { rough: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.006, -0.5]} />
      <group position={[0.85, 0, -0.2]} rotation={[0, 0.5, 0.0]}>
        <mesh geometry={geoOf("toyRocket", () => new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16))} material={plastic("#e3242b", { rough: 0.35 })} position={[0, 0.2, 0]} castShadow />
        <mesh geometry={geoOf("toyNose", () => new THREE.ConeGeometry(0.07, 0.14, 16))} material={plastic("#ffffff", { rough: 0.35 })} position={[0, 0.42, 0]} castShadow />
        {[0, 1, 2].map((i) => (
          <B key={i} s={[0.02, 0.12, 0.1]} p={[Math.cos((i * 2 * Math.PI) / 3) * 0.08, 0.1, Math.sin((i * 2 * Math.PI) / 3) * 0.08]} r={[0, -(i * 2 * Math.PI) / 3, 0]} c="#2a7de1" />
        ))}
        <Blob p={[0, 0, 0]} sx={0.3} sz={0.3} op={0.5} />
      </group>
      <group position={[1.3, 0, -1.0]}>
        {([["#ff5aa0", 0, 0, 0], ["#ffd23a", 0.15, 0, 0.3], ["#7fe3b8", 0.06, 0.13, 0.6]] as [string, number, number, number][]).map(([c, x, y, r], i) => (
          <B key={i} s={[0.13, 0.13, 0.13]} p={[x, y + 0.065, 0]} r={[0, r, 0]} c={c} />
        ))}
        <Blob p={[0.07, 0, 0]} sx={0.4} sz={0.3} op={0.5} />
      </group>
      <mesh geometry={geoOf("toyBall", () => new THREE.SphereGeometry(0.11, 20, 14))} material={plastic("#2fd0bd", { rough: 0.35 })} position={[-0.85, 0.11, 0.35]} castShadow />
      <Blob p={[-0.85, 0, 0.35]} sx={0.3} sz={0.3} op={0.5} />
      <group position={[1.95, 0, 0.6]}>
        <B s={[0.7, 0.75, 0.5]} p={[0, 0.375, 0]} c="#c8a070" />
        <mesh geometry={geoOf("lampStem", () => new THREE.CylinderGeometry(0.02, 0.03, 0.4, 8))} material={plastic("#3a3f58")} position={[0.15, 0.95, 0]} castShadow />
        <mesh geometry={geoOf("lampShade", () => new THREE.ConeGeometry(0.18, 0.2, 18, 1, true))} material={plastic("#ffd8a0", { emissive: "#ffb050", ei: 2.2, side: THREE.DoubleSide })} position={[0.15, 1.18, 0]} />
        <pointLight position={[0.15, 1.1, -0.1]} color="#ffb050" intensity={4.5 * lamp} distance={5} decay={2} />
        <B s={[0.12, 0.14, 0.09]} p={[-0.18, 0.82, 0.05]} c="#c8cde0" />
        <B s={[0.1, 0.08, 0.08]} p={[-0.18, 0.94, 0.05]} c="#c8cde0" />
        <mesh geometry={geoOf("robotEye", () => new THREE.SphereGeometry(0.012, 8, 6))} material={plastic("#7dffcf", { emissive: "#7dffcf", ei: 2 })} position={[-0.2, 0.95, 0.095]} />
      </group>
      {([[-0.95, "#ff5aa0", KINDS.saturn], [1.0, "#2fd0bd", KINDS.ringed]] as [number, string, PlanetKind][]).map(([x, c, kind], i) => (
        <group key={i} position={[x, 1.75, -1.79]}>
          <B s={[0.5, 0.6, 0.02]} p={[0, 0, 0]} c={c} />
          <Planet p={[0, 0, 0.06]} r={0.11} kind={kind} spin={t * 0.3} />
        </group>
      ))}
      {[[-0.6, 2.4], [0.7, 2.35], [-1.4, 1.2], [1.5, 1.3], [0.9, 2.65], [-0.9, 2.7]].map(([x, y], i) => (
        <Star key={i} p={[x, y, -1.785]} s={0.05 + 0.02 * (i % 2)} c={i % 3 ? "#fff2a0" : "#7dffcf"} />
      ))}
      {[[0.3, 2.1], [-0.4, 1.6], [0.9, 1.0], [-0.2, 2.5]].map(([z, y], i) => (
        <Star key={`s${i}`} p={[2.39, y, z]} s={0.05} r={[0, -Math.PI / 2, 0]} />
      ))}
      <pointLight position={[ROOM.jar[0] - 0.35, ROOM.jar[1] + 0.25, ROOM.jar[2] + 0.6]} color="#9fd8ff" intensity={jarGlow * 1.6} distance={2.0} decay={2} />
      <Planet p={[-5, 3, -22]} r={4} kind={KINDS.mint} tilt={0.4} spin={t * 0.02} />
      <Planet p={[6, 7, -30]} r={2} kind={KINDS.violet} spin={t * 0.03} />
    </>
  );
};

// ------------------------------------------------------------------ Earth's surface extras
export const PopHouse: React.FC<{ p: V3; u: number; wall: string; roof: string; s?: number; yaw?: number }> = ({ p, u, wall, roof, s = 1, yaw = 0 }) => {
  if (u <= 0) return null;
  const k = u >= 1 ? 1 : 1 + 0.18 * Math.sin(Math.PI * u) - (1 - u) * (1 - u) * 1.0;
  return (
    <group position={p} rotation={[0, yaw, 0]} scale={[s, s * Math.max(0.02, k), s]}>
      <B s={[1.2, 1.0, 1.0]} p={[0, 0.5, 0]} c={wall} rough={0.8} />
      <mesh geometry={geoOf("popRoof", () => new THREE.ConeGeometry(0.95, 0.6, 4))} material={plastic(roof, { rough: 0.7, flat: true })} position={[0, 1.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
      <B s={[0.3, 0.5, 0.04]} p={[0, 0.25, 0.51]} c="#7a4a2a" />
      {[-0.35, 0.35].map((x) => (
        <B key={x} s={[0.24, 0.24, 0.04]} p={[x, 0.68, 0.51]} c="#8ec9f2" rough={0.2} />
      ))}
      <Blob p={[0, 0, 0]} sx={1.6} sz={1.4} op={0.5} />
    </group>
  );
};

// ------------------------------------------------------------------ outside the store (space)
export const SPACE = { shop: [0, 0, -2] as V3 };
export const Outside: React.FC<{ t: number }> = ({ t }) => (
  <>
    <mesh geometry={geoOf("asteroid", () => new THREE.IcosahedronGeometry(30, 4))} material={plastic("#ffffff", { rough: 0.9, map: rockyTex("asteroid", "#9a8ab8", "#4a3a6a", 31), flat: true })} position={[0, -30, -6]} receiveShadow />
    <group position={SPACE.shop}>
      <B s={[4.2, 2.6, 3.2]} p={[0, 1.3, 0]} c="#6b4fd0" rough={0.6} />
      <mesh geometry={geoOf("shopDome", () => new THREE.SphereGeometry(2.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2))} material={plastic("#9ff0ff", { rough: 0.1, transparent: true, opacity: 0.55, emissive: "#5fd8ff", ei: 0.4 })} position={[0, 2.6, 0]} />
      <NeonSign p={[0, 2.25, 1.65]} text="PLANET SHOP" w={2.6} h={0.42} color="#ffd23a" />
      <B s={[1.0, 1.7, 0.08]} p={[0, 0.85, 1.62]} c="#ffe8a0" e={1.6} />
      <pointLight position={[0, 1.2, 2.4]} color="#ffe0a0" intensity={5} distance={7} decay={2} />
    </group>
    {([[0.9, 1.6, 2.6, "#ff8ac8"], [2.4, 2.4, 5.4, "#7fe3b8"], [4.3, 3.2, 8.6, "#ffd23a"], [6.6, 4.1, 12.2, "#5fd8ff"], [9.4, 5.2, 16.4, "#ff7a2a"], [12.8, 6.4, 21.0, "#b48cf0"]] as [number, number, number, string][]).map(([x, y, z, c], i) => (
      <Saucer key={i} p={[x, y, z]} s={0.9} color={c} t={t} seed={i * 1.7} />
    ))}
    <Planet p={[-14, 12, -40]} r={8} kind={KINDS.saturn} tilt={0.25} spin={t * 0.02} />
    <Planet p={[16, 18, -50]} r={4} kind={KINDS.lava} spin={t * 0.03} />
  </>
);
