// BlockyTest: 10 s, 9 shots with 8 hard cuts, no text, no captions. BlockyTestSub renders SUB sub-frames per output frame for
// motion blur (average with ffmpeg tmix, render.sh). The shot is chosen by the OUTPUT frame, time by the sub-frame.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { subFrame } from "../engine/core/frame";
import { View } from "../engine/core/View";
import { Blocky, KID_A, KID_B, SCOOPS_A } from "./Blocky";
import { Contact } from "./Contact";
import { Dust, FlyingScoop, Flowers, Patches, PopRing, scoopsB, Sparkles } from "./Flowers";
import { moodForShot } from "./mood";
import { blinkA, blinkB, emotionA, emotionB, poseA, poseB, scoopsA, T } from "./motion";
import { camOf, SHOTS, shotIndexAt } from "./plan";
import { World } from "./World";

export const BLOCKY_FRAMES = 300;
/** landing: 2 frames squashed (1.3 x 0.7), then a small stretch back to round */
const landSquash = (t: number): [number, number] => {
  const u = t - T.land;
  if (u < 0 || u > 0.22) return [1, 1];
  if (u < 0.067) return [1.3, 0.7];
  const k = Math.sin((Math.PI * (u - 0.067)) / 0.153);
  return [1 - 0.08 * k, 1 + 0.12 * k];
};

export const BlockyTest: React.FC<{ sub?: boolean; at?: number }> = ({ sub = false, at }) => {
  const g = useCurrentFrame();
  const f = at !== undefined ? at : g;
  // 126 deg shutter (180 deg smeared the pops); 72 deg on the fall shot S3 so the silhouette stays sharp
  const n0 = sub ? Math.floor(f / 4) : f;
  // 45 deg in the hook S1 (close flowers and legs near the lens showed stacked copies at wider shutters)
  const sid = SHOTS[shotIndexAt(n0)].id;
  const shutter = sid === "S1" ? 0.125 : sid === "S3" ? 0.2 : 0.35;
  const { n, fp } = sub ? subFrame(f, 4, shutter) : { n: f, fp: f };
  const t = fp / 30;
  const shot = SHOTS[shotIndexAt(n)];
  const cam = camOf(shot, t);
  const mood = moodForShot(shot.id, camOf(shot, shot.a));
  const pa = poseA(t);
  const pb = poseB(t);
  return (
    <AbsoluteFill style={{ background: "#6aa6f2" }}>
      <View mood={mood} cam={cam} t={t} blur={0}>
        <World />
        <Patches t={t} />
        <Contact t={t} />
        <Flowers t={t} />
        <Blocky pose={pa} look={KID_A} emotion={emotionA(t)} blink={blinkA(t)} cone={{ side: "L", scoops: scoopsA(t), colors: SCOOPS_A }} />
        <Blocky pose={pb} look={KID_B} emotion={emotionB(t)} blink={blinkB(t)} cone={{ side: "R", scoops: scoopsB(t), colors: [SCOOPS_A[1]], pop: landSquash(t) }} />
        <FlyingScoop t={t} color={SCOOPS_A[1]} />
        <Sparkles t={t} />
        <PopRing t={t} />
        <Dust t={t} />
      </View>
    </AbsoluteFill>
  );
};
