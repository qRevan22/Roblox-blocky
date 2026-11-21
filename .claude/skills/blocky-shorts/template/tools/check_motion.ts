// Plausibility check of the pure motion (run: node tools/check_motion.ts). Prints the lowest sole point, rock overlap
// and flowers inside a sole, sampled at 120 Hz. Uses the same FK as Blocky.tsx.
import * as THREE from "three";
import { FLOWERS, FLIGHT, poseA, poseB, ROCK, SPEC, U, XA, XB, scoopWorld, coneMatrix, T, rootMatrix, shoulderXOf, SHOULDER_Y, HAND } from "../src/blocky/motion.ts";
import type { Pose } from "../src/blocky/motion.ts";

const shoePts = (p: Pose, side: "L" | "R") => {
  const sx = side === "L" ? 1 : -1;
  const m = new THREE.Matrix4()
    .makeTranslation(p.x, p.y, p.z)
    .multiply(new THREE.Matrix4().makeRotationY(p.yaw))
    .multiply(new THREE.Matrix4().makeRotationX(p.pitch))
    .multiply(new THREE.Matrix4().makeTranslation(sx * SPEC.hipX * U, 0, 0))
    .multiply(new THREE.Matrix4().makeRotationX(-(side === "L" ? p.legL : p.legR)));
  const w = (SPEC.shoe.w * U) / 2, d = (SPEC.shoe.d * U) / 2, y0 = -SPEC.leg.h * U, y1 = y0 + SPEC.shoe.h * U;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) for (const y of [y0, y1]) pts.push(new THREE.Vector3(-w + (2 * w * i) / 4, y, -d + (2 * d * j) / 4).applyMatrix4(m));
  return pts;
};
const boxPts = (m: THREE.Matrix4, w: number, h0: number, h1: number, d: number) => {
  const out: THREE.Vector3[] = [];
  for (const x of [-w / 2, w / 2]) for (const y of [h0, h1]) for (const z of [-d / 2, d / 2]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
};
const bodyPts = (p: Pose) => {
  const r = rootMatrix(p);
  const pts = boxPts(r, 2 * U, 0, 2 * U, U);
  const neck = r.clone().multiply(new THREE.Matrix4().makeTranslation(0, (2 + SPEC.head.gap) * U, 0)).multiply(new THREE.Matrix4().makeRotationX(p.headPitch));
  pts.push(...boxPts(neck, SPEC.head.w * U * 0.8, 0, SPEC.head.h * U, SPEC.head.d * U * 0.8));
  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1, out = side === "L" ? p.outL : p.outR, raise = side === "L" ? p.armL : p.armR;
    const am = r.clone().multiply(new THREE.Matrix4().makeTranslation(sx * shoulderXOf(out), SHOULDER_Y, 0)).multiply(new THREE.Matrix4().makeRotationZ(sx * out)).multiply(new THREE.Matrix4().makeRotationX(-raise));
    pts.push(...boxPts(am, SPEC.arm.w * U, -HAND, SPEC.arm.up * U, SPEC.arm.d * U));
  }
  return pts;
};
let bodyMin = 9, bodyAt = 0;
let minY = 9, minAt = 0, rockHit = 0, rockAt: number[] = [];
const flowerHits = new Set<string>();
for (let f = 0; f <= 1200; f++) {
  const t = f / 120;
  for (const p of [poseA(t), poseB(t)]) {
    const bp = bodyPts(p);
    for (const q of bp) if (q.y < bodyMin) { bodyMin = q.y; bodyAt = t; }
    // body boxes (corners + edge midpoints) near a grown flower head
    for (const fl of FLOWERS) {
      if (t < fl.t0 + 0.2) continue;
      for (let i = 0; i < bp.length; i += 8) {
        const c = bp.slice(i, i + 8);
        const lo = c.reduce((m, q) => m.min(q), c[0].clone()), hi = c.reduce((m, q) => m.max(q), c[0].clone());
        const fy = 0.17 * fl.s;
        // only flag if the flower point lies inside this part's world AABB shrunk by 30 % (AABBs of rotated boxes are loose)
        const sh = hi.clone().sub(lo).multiplyScalar(0.15);
        if (fl.p[0] > lo.x + sh.x && fl.p[0] < hi.x - sh.x && fl.p[2] > lo.z + sh.z && fl.p[2] < hi.z - sh.z && fy > lo.y + sh.y) flowerHits.add(`body seed${fl.seed} t=${t.toFixed(2)}`);
      }
    }
  }
  for (const [who, p] of [["A", poseA(t)], ["B", poseB(t)]] as [string, Pose][])
    for (const side of ["L", "R"] as const) {
      const pts = shoePts(p, side);
      for (const q of pts) {
        if (q.y < minY) { minY = q.y; minAt = t; }
        const e = ((q.x - ROCK.x) / ROCK.rx) ** 2 + ((q.y - ROCK.h / 2) / (ROCK.h / 2)) ** 2 + ((q.z - ROCK.z) / ROCK.rx) ** 2;
        if (e < 1 && who === "A") { rockHit++; if (rockAt.length < 6) rockAt.push(+t.toFixed(3)); }
      }
      // flowers whose stem sits under this sole (sole footprint, bottom points within 0.25 m height)
      for (const fl of FLOWERS) {
        if (t < fl.t0 || (fl.gone !== undefined && t > fl.gone)) continue;
        const near = pts.some((q) => q.y < 0.24 * fl.s && Math.hypot(q.x - fl.p[0], q.z - fl.p[2]) < 0.075 * fl.s); // petal reach incl. overshoot + lean
        if (near) flowerHits.add(`${who}${side} seed${fl.seed} t=${t.toFixed(2)}`);
      }
    }
}
console.log(`XA=${XA.toFixed(3)} XB=${XB.toFixed(3)} rock x=${ROCK.x.toFixed(3)} z=${ROCK.z.toFixed(3)}`);
console.log(`lowest sole point ${(minY * 1000).toFixed(1)} mm at t=${minAt.toFixed(3)}`);
console.log(`lowest torso/head/arm corner ${(bodyMin * 1000).toFixed(1)} mm at t=${bodyAt.toFixed(3)} (rounded corners sit ~1-2 cm inside these)`);
console.log(`rock overlaps: ${rockHit} samples ${rockAt.join(",")}`);
console.log(`flower/sole overlaps: ${flowerHits.size}`, [...flowerHits].slice(0, 12));
console.log(`flight P0=${FLIGHT.P0.map((v) => v.toFixed(2))} P1=${FLIGHT.P1.map((v) => v.toFixed(2))}`);
const c = new THREE.Vector3().applyMatrix4(coneMatrix(poseA(2), "R"));
console.log(`A cone centre at t=2: ${c.toArray().map((v) => v.toFixed(2))}, A hip ${poseA(2).x.toFixed(2)},${poseA(2).y.toFixed(2)}`);
console.log(`B scoop seat at land: ${scoopWorld(poseB(T.land), "R", 0).map((v) => v.toFixed(2))}`);
