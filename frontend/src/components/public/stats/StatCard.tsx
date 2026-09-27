'use client';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import type { BuildoraStat } from '@/data/public/stats';
import NeonPanel from '@/components/public/ui/NeonPanel';

type Props = { stat: BuildoraStat; index: number; progress: MotionValue<number>; reduced: boolean };
export default function StatCard({ stat, index, progress, reduced }: Props) {
  const start = 0.395 + index * 0.013;
  const opacity = useTransform(progress, [start, start + 0.04], [0, 1]);
  const y = useTransform(progress, [start, start + 0.05], [14, 0]);
  const scale = useTransform(progress, [start, start + 0.05], [0.96, 1]);
  return <motion.div className="stat-cell" style={{ opacity, y: reduced ? 0 : y, scale: reduced ? 1 : scale }}>
    <NeonPanel className="stat-card">
      <p className="stat-value">{stat.value}</p>
      <p className="stat-label">{stat.label}</p>
      {stat.description && <p className="stat-desc">{stat.description}</p>}
    </NeonPanel>
  </motion.div>;
}
