// Numeric framing check. For every output frame, projects each character's body boxes (torso, head + hair,
// arms, legs + shoes, cone) through that frame's shot camera and reports the minimum margin to the frame edge
// (fraction of width/height; < 0 = cut). Run: bash tools/framing_check.sh
import * as THREE from "three";
import { camOf, FPS, SHOTS, shotIndexAt } from "../src/blocky/plan";
import { CONE, HAND, L, poseA, poseB, ROCK, SHOULDER_Y, shoulderXOf, SPEC, U, upperMatrix, rootMatrix, coneMatrix, scoopFlight, SCOOP_R } from "../src/blocky/motion";
import type { Pose } from "../src/blocky/motion";

const M = () => new THREE.Matrix4();
const box = (m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
  const out: THREE.Vector3[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
};
const parts = (p: Pose, cone: "L" | "R") => {
  const up = upperMatrix(p);
  const torso = box(up, -U, U, 0, 2 * U, -U / 2, U / 2);
  const H = SPEC.head;
  const neck = up.clone().multiply(M().makeTranslation(0, (2 + H.gap) * U, 0)).multiply(M().makeRotationY(p.headYaw)).multiply(M().makeRotationX(p.headPitch));
  const head = box(neck, -0.6 * U, 0.6 * U, 0, (H.h + 0.3) * U, -0.6 * U, 0.6 * U); // incl. hair
  const arms: THREE.Vector3[] = [];
  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1, out = side === "L" ? p.outL : p.outR, raise = side === "L" ? p.armL : p.armR;
    const am = up.clone().multiply(M().makeTranslation(sx * shoulderXOf(out), SHOULDER_Y, 0)).multiply(M().makeRotationZ(sx * out)).multiply(M().makeRotationX(-raise));
    arms.push(...box(am, -0.5 * U, 0.5 * U, -HAND, SPEC.arm.up * U, -0.5 * U, 0.5 * U));
  }
  const legs: THREE.Vector3[] = [];
  for (const side of ["L", "R"] as const) {
    const sx = side === "L" ? 1 : -1;
    const lm = rootMatrix(p).multiply(M().makeTranslation(sx * SPEC.hipX * U, 0, 0)).multiply(M().makeRotationX(-(side === "L" ? p.legL : p.legR)));
    legs.push(...box(lm, -0.53 * U, 0.53 * U, -L, 0, -0.54 * U, 0.54 * U));
  }
  const c = coneMatrix(p, cone);
  const conePts = box(c, -CONE.r, CONE.r, -CONE.h / 2, CONE.h / 2 + 0.2, -CONE.r, CONE.r);
  return { torso, head, arms, legs, cone: conePts, all: [...torso, ...head, ...arms, ...legs, ...conePts] };
};
const camera = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.02, 600);
const project = (cam: ReturnType<typeof camOf>, pts: THREE.Vector3[]) => {
  camera.fov = cam.fov;
  camera.position.set(...cam.pos);
  const dir = new THREE.Vector3(...cam.look).sub(camera.position).normalize();
  camera.up.copy(new THREE.Vector3(0, 1, 0).applyAxisAngle(dir, ((cam.roll ?? 0) * Math.PI) / 180));
  camera.lookAt(...cam.look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return pts.map((q) => {
    const v = q.clone().project(camera);
    return { fx: (v.x + 1) / 2, fy: (1 - v.y) / 2, behind: v.z > 1 }; // fy: 0 = top
  });
};
const margin = (pr: { fx: number; fy: number; behind: boolean }[]) =>
  Math.min(...pr.map((q) => (q.behind ? -1 : Math.min(q.fx, 1 - q.fx, q.fy, 1 - q.fy))));

// who must be fully in each shot (S1 = deliberate leg close-up, S4 = sky, S6 = face close-up: reported, not judged)
const NEED: Record<string, ("A" | "B")[]> = { S1: ["A"], S2: ["A"], S3: ["A"], S5: ["B"], S6b: ["A"], S7: ["A", "B"], S7b: ["A", "B"] };
const MIN: Record<string, number> = { S7: 0.06 };
type Row = { min: number; at: number; height: number[]; ext: string };
const res: Record<string, Record<string, Row>> = {};
const PROPS: [string, number, number, number][] = [["lamp+", 13.5, -1.25, 4.2], ["lamp-", -8, -1.25, 4.2], ["mailbox+", 11.5, -0.55, 1.3], ["mailbox-", -6.4, -0.55, 1.3], ["hydrant", 1.6, -2.05, 0.7]];
const tang: Record<string, number> = {};
let backW = 0;
let occl = 0, occlAt = -1;
const occlWhat = new Set<string>();
let slab = 0, slabAt = 0, rockMin = 9, faceHit = 0, faceHitAt = -1, scoopSeen = 0;
for (let n = 0; n < 300; n++) {
  const t = n / FPS;
  const s = SHOTS[shotIndexAt(n)];
  const cam = camOf(s, t);
  const P = { A: parts(poseA(t), "L"), B: parts(poseB(t), "R") };
  for (const who of ["A", "B"] as const) {
    const pr = project(cam, P[who].all);
    const fys = pr.filter((q) => !q.behind).map((q) => q.fy);
    const m = margin(pr);
    const h = fys.length ? Math.max(...fys) - Math.min(...fys) : 0;
    const r = ((res[s.id] ??= {})[who] ??= { min: 9, at: 0, height: [], ext: "" });
    if (m < r.min) {
      r.min = m;
      r.at = t;
      const fxs = pr.filter((q) => !q.behind).map((q) => q.fx);
      r.ext = fxs.length ? `x ${(Math.min(...fxs) * 100).toFixed(0)}..${(Math.max(...fxs) * 100).toFixed(0)} y ${(Math.min(...fys) * 100).toFixed(0)}..${(Math.max(...fys) * 100).toFixed(0)}` : "";
    }
    r.height.push(h);
  }
  if (s.id === "S1") {
    // his face and the cone must stay clear of his own arms (screen bbox of each arm box, nearer than the face)
    camera.position.set(...cam.pos);
    const face = P.A.head.slice(0, 8);
    const fc = face.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / 8);
    const cc = P.A.cone.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / 8);
    for (const [ti, target] of [fc, cc].entries()) {
      const [tp] = project(cam, [target]);
      const dT = target.distanceTo(camera.position);
      for (let a = 0; a < 2; a++) {
        if (ti === 1 && a === 0) continue; // the cone sits at the end of its own (left) arm: its bbox always touches it
        const box8 = P.A.arms.slice(a * 8, a * 8 + 8);
        const pr = project(cam, box8);
        const near = Math.min(...box8.map((q) => q.distanceTo(camera.position)));
        const x0 = Math.min(...pr.map((q) => q.fx)), x1 = Math.max(...pr.map((q) => q.fx)), y0 = Math.min(...pr.map((q) => q.fy)), y1 = Math.max(...pr.map((q) => q.fy));
        // shrink the bbox 20 % (a rotated box covers less than its bbox)
        const sx = (x1 - x0) * 0.2, sy = (y1 - y0) * 0.2;
        if (near < dT - 0.05 && tp.fx > x0 + sx && tp.fx < x1 - sx && tp.fy > y0 + sy && tp.fy < y1 - sy) { occl++; if (occlAt < 0) occlAt = t; occlWhat.add(`${ti ? "cone" : "face"}/${a ? "R" : "L"}arm@${t.toFixed(2)}`); }
      }
    }
    // how far down from the top the torso/arm slab reaches (only where it is inside the frame horizontally)
    const pr = project(cam, [...P.A.torso, ...P.A.arms]).filter((q) => !q.behind && q.fx > 0 && q.fx < 1);
    const reach = pr.length ? Math.max(0, Math.min(1, Math.max(...pr.map((q) => q.fy)))) : 0;
    if (reach > slab) { slab = reach; slabAt = t; }
  }
  if (s.id === "S5") {
    // the falling scoop must never cross her face (screen-space overlap with her head box, scoop radius included)
    const f = scoopFlight(t);
    if (f) {
      const [c] = project(cam, [new THREE.Vector3(...f.p)]);
      const [e] = project(cam, [new THREE.Vector3(f.p[0] + SCOOP_R, f.p[1], f.p[2])]);
      const r = Math.abs(e.fx - c.fx) * 1.2;
      const hb = project(cam, P.B.head.slice(0, 8));
      const x0 = Math.min(...hb.map((q) => q.fx)), x1 = Math.max(...hb.map((q) => q.fx)), y0 = Math.min(...hb.map((q) => q.fy)), y1 = Math.max(...hb.map((q) => q.fy));
      if (c.fx > 0 && c.fx < 1 && c.fy > 0 && c.fy < 1) scoopSeen++;
      if (c.fx + r > x0 && c.fx - r < x1 && c.fy + r * 0.5625 > y0 && c.fy - r * 0.5625 < y1) { faceHit++; if (faceHitAt < 0) faceHitAt = t; }
    }
  }
  if (s.id === "S7b") {
    // tangents: lamp poles / mailboxes vs her head (screen distance in head widths), and his share of the frame width
    const hb = project(cam, P.B.head.slice(0, 8));
    const hx0 = Math.min(...hb.map((q) => q.fx)), hx1 = Math.max(...hb.map((q) => q.fx)), hy0 = Math.min(...hb.map((q) => q.fy)), hy1 = Math.max(...hb.map((q) => q.fy));
    const hw = hx1 - hx0;
    for (const [name, x, z, h] of PROPS) {
      const pr = project(cam, [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, h, z)]);
      if (pr.some((q) => q.behind)) continue;
      const [b0, b1] = pr;
      if (Math.max(b0.fx, b1.fx) < 0 || Math.min(b0.fx, b1.fx) > 1) continue;
      // vertical extent overlap with the head band, then horizontal gap in head widths
      const top = Math.min(b0.fy, b1.fy), bot = Math.max(b0.fy, b1.fy);
      const overlapY = top < hy1 + hw && bot > hy0 - hw;
      const px = (b0.fx + b1.fx) / 2;
      const gap = Math.max(0, Math.max(hx0 - px, px - hx1)) / hw;
      if (overlapY && gap < (tang[name] ?? 99)) tang[name] = gap;
    }
    const ab = project(cam, P.A.torso.concat(P.A.head, P.A.arms));
    const aw = Math.min(1, Math.max(...ab.map((q) => q.fx))) - Math.max(0, Math.min(...ab.map((q) => q.fx)));
    backW = Math.max(backW, aw);
  }
  if (s.id === "S3") {
    const rp = box(M().makeTranslation(ROCK.x, 0, ROCK.z), -ROCK.rx, ROCK.rx, 0, ROCK.h, -ROCK.rx, ROCK.rx);
    rockMin = Math.min(rockMin, margin(project(cam, rp)));
  }
}
let fail = 0;
const lines: string[] = [];
for (const s of SHOTS) {
  for (const who of ["A", "B"] as const) {
    const r = res[s.id]?.[who];
    if (!r) continue;
    const need = NEED[s.id]?.includes(who);
    const lim = MIN[s.id] ?? 0;
    const hs = r.height;
    const verdict = need ? (r.min >= lim ? "ok" : "FAIL") : "-";
    if (verdict === "FAIL") fail++;
    if (need || r.min > -0.5)
      lines.push(`${s.id.padEnd(4)} ${who}  min margin ${(r.min * 100).toFixed(1).padStart(6)} % at ${r.at.toFixed(2)} s  height ${(Math.min(...hs) * 100).toFixed(0)}-${(Math.max(...hs) * 100).toFixed(0)} % ${need ? `(need >= ${(lim * 100).toFixed(0)} %)` : "(not required)"}  ${verdict}  [worst frame: ${r.ext}]`);
  }
}
lines.push(`S1   torso/arm slab reaches ${(slab * 100).toFixed(1)} % down from the top (info)`);
lines.push(`S1   face/cone covered by his own arm on ${occl} frame-checks${occl ? ` (first ${occlAt.toFixed(2)} s)` : ""}  ${occl ? "FAIL" : "ok"}`);
lines.push(`     ${[...occlWhat].slice(0, 14).join(' ')}`);
lines.push(`S7b  props near her head (gap in head widths, need >= 1): ${Object.entries(tang).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ') || 'none in the head band'}  ${Object.values(tang).some((v) => v < 1) ? 'FAIL' : 'ok'}`);
lines.push(`S7b  his torso/head/arms span up to ${(backW * 100).toFixed(0)} % of the frame width (target <= 30 %)  ${backW <= 0.3 ? 'ok' : 'FAIL'}`);
lines.push(`S5   falling scoop on screen ${scoopSeen} frames, crosses her head box on ${faceHit} frames${faceHit ? ` (first ${faceHitAt.toFixed(2)} s)` : ""}  ${faceHit ? "FAIL" : "ok"}`);
lines.push(`S3   rock min margin ${(rockMin * 100).toFixed(1)} %  ${rockMin >= 0 ? "ok" : "FAIL"}`);
if (faceHit) fail++;
if (occl) fail++;
if (Object.values(tang).some((v) => v < 1)) fail++;
if (backW > 0.3) fail++;
if (rockMin < 0) fail++;
lines.push(fail ? `FRAMING: ${fail} FAIL` : "FRAMING: all ok");
console.log(lines.join("\n"));
