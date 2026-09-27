"use client";
import Image from "next/image";
import { motion, useTransform, type MotionValue } from "framer-motion";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  position?: string;
  progress: MotionValue<number>;
  range: number[];
  scales: number[];
  pan: string[];
  reduced: boolean;
};
export default function SceneBackground({
  src,
  alt,
  priority = false,
  position = "center",
  progress,
  range,
  scales,
  pan,
  reduced,
}: Props) {
  const scale = useTransform(progress, range, scales);
  const x = useTransform(progress, range, pan);
  return (
    <div className="scene-background">
      <motion.div
        className="image-drift"
        style={{ scale: reduced ? 1 : scale, x: reduced ? 0 : x }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: position }}
        />
      </motion.div>
      <div className="scene-grade" />
    </div>
  );
}
