'use client';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { buildoraStats } from '@/data/public/stats';
import StatCard from './StatCard';

export default function WhyBuildoraPanel({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const titleClip = useTransform(progress, [0.375, 0.44], ['inset(0 100% 0 0)', 'inset(0 0% 0 0)']);
  const titleOpacity = useTransform(progress, [0.37, 0.39], [0, 1]);
  return <div className="why-layout">
    <motion.div className="why-copy" style={{ clipPath: reduced ? undefined : titleClip, opacity: titleOpacity }}>
      <p className="why-eyebrow">Why Buildora</p>
      <h2>Built on trust. Driven by results.</h2>
      <p className="why-support">
        Buildora brings together experienced contractors, modern project coordination, and quality-focused delivery to create spaces built to last.
      </p>
    </motion.div>
    <div className="why-stats">
      {buildoraStats.map((stat, index) => <StatCard key={stat.id} {...{ stat, index, progress, reduced }} />)}
    </div>
  </div>;
}
