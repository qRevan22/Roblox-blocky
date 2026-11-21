// Captions for the Short (the chosen style): Poppins ExtraBold, WHITE ONLY (no accent colours, no boxes, no
// backgrounds), a thin dark outline + a soft dark shadow for bright scenes, inside a safe zone (12 % side margins,
// centred at 68 % of the height), at most 2 lines, synced to the voice (shown 2 frames before each word). Every new
// chunk pops in: it scales up fast from 50 % with a small overshoot and settles (a pure function of t).
import React from "react";
import type { Chunk } from "../engine/core/captions";

const POP = 0.17; // s
const popScale = (u: number) => {
  if (u >= 1) return 1;
  if (u <= 0) return 0.5;
  // 0.5 -> 1.12 (at ~55 %) -> 1.0: an ease-out-back
  const x = u - 1;
  const k = 2.4;
  return 0.5 + 0.5 * (1 + (k + 1) * x * x * x + k * x * x);
};

export const PopCaptions: React.FC<{ chunks: Chunk[]; t: number; until: number; width?: number; height?: number }> = ({ chunks, t, until, width = 1080, height = 1920 }) => {
  const c = chunks.find((x) => t >= x.a && t < x.b);
  if (!c || t > until) return null;
  const k = width / 1080;
  const u = (t - c.a) / POP;
  const s = popScale(u);
  const op = Math.min(1, Math.max(0, u * 3));
  return (
    <div style={{ position: "absolute", left: width * 0.12, right: width * 0.12, top: height * 0.68 - 130 * k, height: 260 * k, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${s})`,
          opacity: op,
          textAlign: "center",
          fontFamily: "Poppins",
          fontWeight: 800,
          fontSize: 100 * k,
          lineHeight: 1.06,
          color: "#ffffff",
          WebkitTextStroke: `${7 * k}px #140c1c`,
          paintOrder: "stroke fill",
          textShadow: `0 ${6 * k}px ${18 * k}px rgba(8,4,16,0.6), 0 0 ${4 * k}px rgba(8,4,16,0.5)`,
          maxWidth: width * 0.76,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "visible",
        }}
      >
        {c.words.join(" ")}
      </div>
    </div>
  );
};
