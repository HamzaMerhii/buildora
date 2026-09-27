"use client";
import {
  motion,
  useTransform,
  useMotionTemplate,
  cubicBezier,
  type MotionValue,
} from "framer-motion";
import type { ReactNode } from "react";
import { CAMERA_EASE } from "./timeline";

type Props = {
  children: ReactNode;
  className: string;
  label: string;
  progress: MotionValue<number>;
  times: readonly number[];
  positions: string[];
  fadeTimes: number[];
  fades: number[];
  active: boolean;
  reduced: boolean;
};
/** Stable compositing order prevents a z-index jump midway through a camera move. */
export default function SceneTransition({
  children,
  className,
  label,
  progress,
  times,
  positions,
  fadeTimes,
  fades,
  active,
  reduced,
}: Props) {
  const x = useTransform(progress, [...times], positions, {
    ease: cubicBezier(...CAMERA_EASE),
  });
  const opacity = useTransform(progress, fadeTimes, fades);
  const feather = useTransform(
    progress,
    [...times],
    positions.map((position) => (position === "0%" ? 0 : 24)),
  );
  const maskImage = useMotionTemplate`linear-gradient(to right, transparent 0%, black ${feather}%, black calc(100% - ${feather}%), transparent 100%)`;
  return (
    <motion.section
      className={`scene ${className}`}
      aria-label={label}
      aria-hidden={!active}
      inert={!active}
      style={{
        x: reduced ? 0 : x,
        opacity,
        maskImage: reduced ? undefined : maskImage,
      }}
    >
      {children}
    </motion.section>
  );
}
