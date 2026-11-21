// Contact shadows ("AO" spots): soft dark discs 9 mm above the grass under soles, bodies on the ground, the rock and
// tree trunks, so nothing hovers (a shoe with a detached shadow reads as floating). Pure functions of the poses.
import React from "react";
import * as THREE from "three";
import { clamp, D, poseA, poseB, ROCK, rootMatrix, soleWorld, stepOf, T, XA } from "./motion";
import type { V3 } from "./motion";
import { canvasTexture, geoOf } from "./mat";

const blobAlpha = () =>
  canvasTexture(
    "blobAlpha",
    256,
    256,
    (g, W) => {
      const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.45, "#b0b0b0");
      gr.addColorStop(1, "#000000");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
    },
    false,
  );
const mats = new Map<number, THREE.MeshBasicMaterial>();
const blobMat = (op: number) => {
  const k = Math.round(clamp(op) * 20) / 20;
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: "#0e1a08", alphaMap: blobAlpha(), transparent: true, opacity: k, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mats.set(k, m);
  }
  return m;
};
export const Blob: React.FC<{ p: V3; sx: number; sz: number; yaw?: number; op: number }> = ({ p, sx, sz, yaw = 0, op }) =>
  op < 0.03 ? null : (
    <mesh geometry={geoOf("blob", () => new THREE.CircleGeometry(0.5, 32))} material={blobMat(op)} position={[p[0], 0.009, p[2]]} rotation={[-Math.PI / 2, 0, yaw]} scale={[sx, sz, 1]} renderOrder={2} userData={{ outline: false }} />
  );

const SoleBlobs: React.FC<{ t: number; who: "A" | "B" }> = ({ t, who }) => {
  const p = who === "A" ? poseA(t) : poseB(t);
  if (who === "A" && t > T.tip + 0.2) return null; // lying / sitting: the body blob takes over
  return (
    <>
      {(["L", "R"] as const).map((s) => {
        const c = soleWorld(p, s);
        const h = Math.max(0, c[1]);
        return <Blob key={s} p={c} sx={0.42 * (1 + h * 2)} sz={0.36 * (1 + h * 2)} yaw={-p.yaw} op={0.62 * (1 - clamp(h / 0.22))} />;
      })}
    </>
  );
};
/** A on the ground: under his torso/legs while he lies, under seat + legs when he sits */
const BodyBlob: React.FC<{ t: number }> = ({ t }) => {
  if (t < 3.85) return null;
  const p = poseA(t);
  if (t < T.sit) {
    const v = new THREE.Vector3(0, 0.45, 0).applyMatrix4(rootMatrix(p)); // middle of the torso
    const near = clamp(1 - (v.y - 0.15) / 0.5);
    return <Blob p={[(v.x + p.x - 0.15) / 2, 0, 0]} sx={1.9} sz={0.85} op={0.55 * near} />;
  }
  const f: V3 = [Math.sin(p.yaw), 0, Math.cos(p.yaw)];
  return <Blob p={[XA + f[0] * 0.2, 0, f[2] * 0.2]} sx={1.1} sz={0.85} yaw={p.yaw - Math.PI / 2} op={0.55} />;
};

/** pressed-grass footprints: a darker spot under every planted step (from contact on; hidden under the shoe while it
 * stands, left behind when it lifts) */
const Footprints: React.FC<{ t: number }> = ({ t }) => (
  <>
    {Array.from({ length: 17 }, (_, i) => i - 9).map((k) => {
      const st = stepOf(k);
      if (t < st.t || st.t > T.catch) return null;
      return <Blob key={k} p={[st.heel + D / 2, 0, (st.side === "R" ? 1 : -1) * 0.135]} sx={D + 0.06} sz={0.32} op={0.42} />;
    })}
  </>
);
export const Contact: React.FC<{ t: number }> = ({ t }) => (
  <>
    <Footprints t={t} />
    <SoleBlobs t={t} who="A" />
    <SoleBlobs t={t} who="B" />
    <BodyBlob t={t} />
    <Blob p={[ROCK.x, 0, ROCK.z]} sx={0.34} sz={0.3} op={0.6} />
  </>
);
