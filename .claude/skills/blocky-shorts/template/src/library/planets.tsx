// The products: planets that must look amazing (our own procedural designs). Each planet has its own painted texture,
// a slow spin, and a soft atmosphere glow (a fresnel shell, additive, so the bloom picks it up). Gas giants have
// domain-warped swirling bands and storms; ringed planets get banded, coloured, semi-transparent rings (radial UVs);
// Earth has shiny oceans (low roughness on water), raised continents (bump), moving clouds, city lights and a blue glow.
// Everything is deterministic: textures are seeded, motion comes in as spin angles (pure functions of t upstream).
import React from "react";
import * as THREE from "three";
import { mulberry } from "../engine/mat/paint";
import { canvasTexture, geoOf } from "../blocky/mat";
import type { V3 } from "../blocky/motion";

// ------------------------------------------------------------------ noise
const vnoise = (cells: number, seed: number) => {
  const r = mulberry(seed);
  const g = Array.from({ length: cells * cells }, () => r());
  const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  return (u: number, v: number) => {
    const x = u * cells, y = v * cells, i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
  };
};
const fbm = (seed: number) => {
  const o = [vnoise(4, seed), vnoise(8, seed + 1), vnoise(16, seed + 2), vnoise(32, seed + 3)];
  return (u: number, v: number) => 0.5 * o[0](u, v) + 0.25 * o[1](u, v) + 0.15 * o[2](u, v) + 0.1 * o[3](u, v);
};
const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lerp3 = (a: number[], b: number[], u: number) => a.map((x, i) => x + (b[i] - x) * u);
const put = (img: ImageData, o: number, c: number[], a = 255) => {
  img.data[o] = c[0];
  img.data[o + 1] = c[1];
  img.data[o + 2] = c[2];
  img.data[o + 3] = a;
};

// ------------------------------------------------------------------ textures
/** gas giant: swirling bands (domain-warped by fbm), fine streaks, optional storms [u, v, size, colour] */
export const bandsTex = (key: string, cols: string[], seed: number, storm?: string, extraStorms: [number, number, number, string][] = []) =>
  canvasTexture(`bands2|${key}`, 1024, 512, (g, W, H) => {
    const warp = fbm(seed), fine = vnoise(64, seed + 7);
    const C = cols.map(hex);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const w = warp(u, v);
        const vv = v + 0.07 * (w - 0.5) + 0.025 * Math.sin(u * Math.PI * 6 + v * 20 + w * 6);
        const band = vv * 11;
        const i = Math.floor(band), f = band - i;
        const a = C[((i % C.length) + C.length) % C.length], b = C[(((i + 1) % C.length) + C.length) % C.length];
        let c = lerp3(a, b, f * f * (3 - 2 * f) * 0.7);
        const streak = 0.9 + 0.2 * fine(u * 0.25, vv * 2);
        c = c.map((k) => Math.min(255, k * streak));
        // darker poles
        const pole = Math.pow(Math.abs(v - 0.5) * 2, 3);
        c = lerp3(c, [c[0] * 0.55, c[1] * 0.55, c[2] * 0.65], pole);
        put(img, (y * W + x) * 4, c);
      }
    g.putImageData(img, 0, 0);
    const storms: [number, number, number, string][] = storm ? [[0.32, 0.64, 0.075, storm], ...extraStorms] : extraStorms;
    for (const [su, sv, ss, sc] of storms) {
      // a spiral storm: nested ellipses, alternating light/dark, each a little rotated
      for (let k = 6; k >= 1; k--) {
        g.save();
        g.translate(su * W, sv * H);
        g.rotate(k * 0.18);
        g.fillStyle = k % 2 ? sc : "rgba(255,240,220,0.55)";
        g.globalAlpha = k % 2 ? 0.95 : 0.6;
        g.beginPath();
        g.ellipse(0, 0, (ss * W * k) / 6, (ss * H * 0.85 * k) / 6, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 2;
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.1) {
        const rr = (a / (Math.PI * 5)) * ss * W;
        g.lineTo(su * W + Math.cos(a) * rr, sv * H + Math.sin(a) * rr * 0.8);
      }
      g.stroke();
    }
  });
/** a rocky / icy little planet: two-tone fbm, craters with lit rims */
export const rockyTex = (key: string, a: string, b: string, seed: number) =>
  canvasTexture(`rocky2|${key}`, 1024, 512, (g, W, H) => {
    const n = fbm(seed);
    const A = hex(a), B = hex(b);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) put(img, (y * W + x) * 4, lerp3(A, B, Math.min(1, Math.max(0, (n(x / W, y / H) - 0.3) * 2))));
    g.putImageData(img, 0, 0);
    const r = mulberry(seed + 9);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = H * (0.15 + 0.7 * r()), s = 5 + r() * 22;
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.beginPath();
      g.ellipse(x, y, s, s * 0.85, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.22)";
      g.lineWidth = Math.max(1.5, s * 0.15);
      g.beginPath();
      g.ellipse(x, y, s, s * 0.85, 0, Math.PI * 0.9, Math.PI * 1.7);
      g.stroke();
    }
  });
/** ring bands: radial colour bands with gaps (alpha), u = 0 inner .. 1 outer */
export const ringTex = (key: string, cols: string[], seed: number) =>
  canvasTexture(`ring|${key}`, 1024, 8, (g, W, H) => {
    const r = mulberry(seed);
    const C = cols.map(hex);
    const img = g.createImageData(W, H);
    const gaps = [0.18 + 0.05 * r(), 0.55 + 0.05 * r(), 0.8 + 0.04 * r()];
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const band = u * 14 + 0.6 * Math.sin(u * 60);
      const i = Math.floor(band);
      const c = lerp3(C[i % C.length], C[(i + 1) % C.length], band - i);
      let a = 0.55 + 0.4 * Math.abs(Math.sin(u * 47 + r() * 0.2));
      for (const gp of gaps) if (Math.abs(u - gp) < 0.018) a *= 0.12;
      a *= Math.min(1, u * 12) * Math.min(1, (1 - u) * 10);
      for (let y = 0; y < H; y++) put(img, (y * W + x) * 4, c, a * 255);
    }
    g.putImageData(img, 0, 0);
  });
/** Earth: a land mask from fbm (our own stylised continents), shared by colour, roughness, bump and lights */
const LAND = (() => {
  const n = fbm(41);
  return (u: number, v: number) => n(u, v);
})();
const SEA = 0.5;
export const earthTex = (dusty = false) =>
  canvasTexture(`earth2|${dusty ? 1 : 0}`, 1024, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const det = vnoise(48, 44);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const h = LAND(u, v);
        const lat = Math.abs(v - 0.5) * 2;
        let c: number[];
        if (lat > 0.84 + 0.05 * det(u, v)) c = [236, 244, 252];
        else if (h > SEA) {
          const k = Math.min(1, (h - SEA) * 6);
          const desert = lat < 0.45 && det(u * 0.5, v) > 0.62;
          c = desert ? lerp3([200, 170, 100], [226, 196, 130], k) : lerp3([70, 150, 60], [120, 110, 70], Math.min(1, k * 0.8 + lat * 0.3));
        } else {
          const shallow = Math.max(0, 1 - (SEA - h) * 9);
          c = lerp3([14, 58, 160], [40, 150, 210], shallow);
        }
        if (dusty) c = lerp3(c, [158, 150, 138], 0.38);
        put(img, (y * W + x) * 4, c);
      }
    g.putImageData(img, 0, 0);
    if (dusty) {
      const r = mulberry(5);
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(${200 + r() * 40},${190 + r() * 40},${170 + r() * 40},${0.15 + r() * 0.25})`;
        g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
      }
    }
  });
/** oceans shiny (dark = low roughness), land matte */
const earthRough = () =>
  canvasTexture("earthRough", 512, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = LAND(x / W, y / H) > SEA ? 225 : 40;
        put(img, (y * W + x) * 4, [v, v, v]);
      }
    g.putImageData(img, 0, 0);
  }, false);
const earthBump = () =>
  canvasTexture("earthBump", 1024, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const det = vnoise(64, 45);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const h = LAND(x / W, y / H);
        const v = h > SEA ? 120 + Math.min(135, (h - SEA) * 600 * (0.7 + 0.6 * det(x / W, y / H))) : 100;
        put(img, (y * W + x) * 4, [v, v, v]);
      }
    g.putImageData(img, 0, 0);
  }, false);
/** city lights (emissive): warm dots on land; "hi" adds the reply in big light blocks */
export const lightsTex = (pattern: "cities" | "hi") =>
  canvasTexture(`lights2|${pattern}`, 1024, 512, (g, W, H) => {
    g.fillStyle = "#000000";
    g.fillRect(0, 0, W, H);
    const r = mulberry(pattern === "hi" ? 77 : 55);
    for (let i = 0; i < 4200; i++) {
      const u = r(), v = 0.15 + 0.7 * r();
      if (LAND(u, v) < SEA + 0.03) continue;
      g.fillStyle = `rgba(255,${200 + Math.floor(r() * 50)},${120 + Math.floor(r() * 60)},${0.5 + r() * 0.5})`;
      g.fillRect(u * W, v * H, 1.5 + r() * 2, 1.5 + r() * 2);
    }
    if (pattern === "hi") {
      g.fillStyle = "#fff2b0";
      const cx = 0.75 * W, cy = 0.45 * H, s = 16;
      const cells = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]];
      for (const [cxk, cyk] of cells) g.fillRect(cx - 2.5 * s + cxk * s, cy - 2.5 * s + cyk * s * 1.3, s - 3, s * 1.3 - 3);
    }
  });
const cloudTex = () =>
  canvasTexture("earthClouds2", 1024, 512, (g, W, H) => {
    const n = fbm(61), m = vnoise(40, 62);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W, v = y / H;
        const s = n(u + 0.04 * Math.sin(v * 18), v) * 0.8 + 0.2 * m(u, v);
        const a = Math.max(0, Math.min(1, (s - 0.52) * 4.5));
        put(img, (y * W + x) * 4, [255, 255, 255], a * 235);
      }
    g.putImageData(img, 0, 0);
  });

// ------------------------------------------------------------------ atmosphere glow (fresnel shell)
const atmo = new Map<string, THREE.ShaderMaterial>();
export const atmoMat = (color: string, k: number) => {
  const key = `${color}|${k.toFixed(2)}`;
  let m = atmo.get(key);
  if (!m) {
    if (atmo.size > 64) atmo.clear();
    m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: k } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 uColor; uniform float uK; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0); float a = pow(f, 2.4) * uK; gl_FragColor = vec4(uColor * a * 1.8, a); }",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    atmo.set(key, m);
  }
  return m;
};
const sphere = () => geoOf("planetSphere2", () => new THREE.SphereGeometry(1, 64, 40));
/** a ring whose UV u runs from the inner to the outer edge */
const ringGeo = (inner: number, outer: number) =>
  geoOf(`ring2|${inner}|${outer}`, () => {
    const g = new THREE.RingGeometry(inner, outer, 128, 3);
    const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
    uv.needsUpdate = true;
    return g;
  });

// ------------------------------------------------------------------ planets
export type PlanetKind = {
  id: string;
  tex: THREE.Texture;
  rough?: number;
  metal?: number;
  /** atmosphere glow colour and strength */
  atmo?: [string, number];
  glow?: string;
  ring?: { inner: number; outer: number; tex: THREE.Texture; tilt?: number };
};
const mats = new Map<string, THREE.MeshStandardMaterial>();
const surfMat = (k: PlanetKind) => {
  let m = mats.get(k.id);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: k.tex, roughness: k.rough ?? 0.55, metalness: k.metal ?? 0 });
    if (k.glow) {
      m.emissive = new THREE.Color(k.glow);
      m.emissiveIntensity = 0.35;
    }
    mats.set(k.id, m);
  }
  return m;
};
const ringMats = new Map<string, THREE.MeshStandardMaterial>();
const ringMat = (k: PlanetKind) => {
  let m = ringMats.get(k.id);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: k.ring!.tex, roughness: 0.6, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02 });
    ringMats.set(k.id, m);
  }
  return m;
};
export const Planet: React.FC<{ p: V3; r: number; kind: PlanetKind; spin?: number; tilt?: number }> = ({ p, r, kind, spin = 0, tilt = 0.25 }) => (
  <group position={p} rotation={[0, 0, tilt]}>
    <mesh geometry={sphere()} material={surfMat(kind)} scale={r} rotation={[0, spin, 0]} castShadow receiveShadow />
    {kind.atmo ? <mesh geometry={sphere()} material={atmoMat(kind.atmo[0], kind.atmo[1])} scale={r * 1.07} renderOrder={5} /> : null}
    {kind.ring ? <mesh geometry={ringGeo(kind.ring.inner, kind.ring.outer)} material={ringMat(kind)} rotation={[-Math.PI / 2 + (kind.ring.tilt ?? 0.3), 0, 0]} scale={r} renderOrder={4} castShadow receiveShadow /> : null}
  </group>
);

const earthMats = new Map<string, THREE.MeshStandardMaterial>();
/** Earth with optional dust, city lights (0..1), the HI reply, moving clouds (cloudSpin) and a blue atmosphere */
export const Earth: React.FC<{ p?: V3; r: number; spin?: number; cloudSpin?: number; dusty?: boolean; lights?: number; hi?: boolean; clouds?: boolean; glow?: number }> = ({
  p = [0, 0, 0], r, spin = 0, cloudSpin, dusty = false, lights = 0, hi = false, clouds = true, glow = 1,
}) => {
  const key = `${dusty ? 1 : 0}|${hi ? 1 : 0}`;
  let m = earthMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: earthTex(dusty), roughnessMap: earthRough(), roughness: dusty ? 1 : 0.9, metalness: 0.05, bumpMap: earthBump(), bumpScale: 2.2 });
    m.emissiveMap = lightsTex(hi ? "hi" : "cities");
    m.emissive = new THREE.Color("#ffd890");
    earthMats.set(key, m);
  }
  m.emissiveIntensity = lights * 1.8;
  return (
    <group position={p} rotation={[0.35, 0, 0.2]}>
      <mesh geometry={sphere()} material={m} scale={r} rotation={[0, spin, 0]} castShadow receiveShadow />
      {clouds && !dusty ? (
        <mesh geometry={sphere()} material={cloudMat()} scale={r * 1.022} rotation={[0, cloudSpin ?? spin * 1.35 + 0.8, 0]} />
      ) : null}
      <mesh geometry={sphere()} material={atmoMat(dusty ? "#8fa8c0" : "#5fb0ff", (dusty ? 0.35 : 1.1) * glow)} scale={r * 1.08} renderOrder={5} />
    </group>
  );
};
let cloudM: THREE.MeshStandardMaterial | null = null;
const cloudMat = () => {
  if (!cloudM) cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", map: cloudTex(), transparent: true, roughness: 0.9, depthWrite: false });
  return cloudM;
};
