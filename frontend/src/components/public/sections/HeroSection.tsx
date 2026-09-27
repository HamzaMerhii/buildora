"use client";
import { motion, useReducedMotionConfig, type MotionValue } from "framer-motion";
import GlowButton from "@/components/public/ui/GlowButton";
export default function HeroSection({ onStart, copyOpacity, ctaOpacity }: { onStart: () => void; copyOpacity: MotionValue<number>; ctaOpacity: MotionValue<number> }) {
  const reduced = useReducedMotionConfig();
  return (
    <>
      <motion.div className="hero-copy" style={{ opacity: copyOpacity }}>
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 18, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.2 }}
        >
          BUILDING THE FUTURE
        </motion.h1>
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.4 }}
        >
          Engineering <span>·</span> Construction <span>·</span> Innovation
        </motion.p>
      </motion.div>
      <motion.div className="hero-cta" style={{ opacity: ctaOpacity }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.65 }}
        >
          <GlowButton onClick={onStart}>REGISTER YOUR CONSTRUCTION COMPANY</GlowButton>
          <p className="enter-hint" aria-hidden="true">Press Enter to explore</p>
        </motion.div>
      </motion.div>
    </>
  );
}
