"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import GlowButton from "@/components/public/ui/GlowButton";

export default function FinalCTASection({
  onStart,
  progress,
  reduced,
}: {
  onStart: () => void;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const browOpacity = useTransform(progress, [0.855, 0.885], [0, 1]);
  const headClip = useTransform(
    progress,
    [0.86, 0.925],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const headOpacity = useTransform(progress, [0.855, 0.88], [0, 1]);
  const copyOpacity = useTransform(progress, [0.875, 0.905], [0, 1]);
  const copyY = useTransform(progress, [0.875, 0.92], [10, 0]);
  const ctaOpacity = useTransform(progress, [0.885, 0.915], [0, 1]);
  const ctaY = useTransform(progress, [0.885, 0.93], [12, 0]);
  const router = useRouter();
  const [teaser, setTeaser] = useState("");
  function submitTeaser(e: React.FormEvent) {
    e.preventDefault();
    const q = teaser.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }
  return (
    <div className="final-layout">
      <motion.p
        className="final-eyebrow"
        style={{ opacity: browOpacity }}
      >
        Build with Buildora
      </motion.p>
      <motion.h2
        className="final-title"
        style={{ clipPath: reduced ? undefined : headClip, opacity: headOpacity }}
      >
        Manage Your Construction Company with Buildora.
      </motion.h2>
      <motion.p
        className="final-copy"
        style={{ opacity: copyOpacity, y: reduced ? 0 : copyY }}
      >
        Bring your projects, teams, apartments, leads, and operations into one connected workspace.
      </motion.p>
      <motion.div
        className="final-actions"
        style={{ opacity: ctaOpacity, y: reduced ? 0 : ctaY }}
      >
        <GlowButton onClick={onStart}>Register Your Construction Company</GlowButton>
      </motion.div>
      <motion.p
        className="final-micro"
        aria-hidden="true"
        style={{ opacity: ctaOpacity }}
      >
        From concept to completion.
      </motion.p>
      <motion.div className="final-teaser" style={{ opacity: ctaOpacity, y: reduced ? 0 : ctaY }}>
        <p className="final-teaser-eyebrow">AI-Powered Discovery</p>
        <p className="final-teaser-title">Describe what you&rsquo;re looking for.</p>
        <form className="final-teaser-form" role="search" aria-label="Try AI search" onSubmit={submitTeaser}>
          <input
            aria-label="Describe what you are looking for"
            placeholder="Try: “Show me available 3-bedroom apartments”"
            value={teaser}
            onChange={e => setTeaser(e.target.value)}
          />
          <GlowButton type="submit"><Search size={15} /> Search with AI</GlowButton>
        </form>
      </motion.div>
    </div>
  );
}
