'use client';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import type { services } from '@/data/public/services';
import NeonPanel from '@/components/public/ui/NeonPanel';

type Props = { service: (typeof services)[number]; index: number; progress: MotionValue<number>; reduced: boolean };
export default function ServiceCard({ service, index, progress, reduced }: Props) {
  const start = 0.125 + index * 0.015;
  const opacity = useTransform(progress, [start, start + 0.05], [0, 1]);
  const x = useTransform(progress, [start, start + 0.08], [-26, 0]);
  const y = useTransform(progress, [start, start + 0.08], [22, 0]);
  const Icon = service.icon;
  return <motion.div className="service-row" style={{ opacity, x: reduced ? 0 : x, y: reduced ? 0 : y }}>
    <div className="icon-bay" aria-hidden="true"><div className="icon-ring"><Icon strokeWidth={1.25} /></div></div>
    <NeonPanel className="service-copy"><h3>{service.title}</h3><p>{service.description}</p></NeonPanel>
  </motion.div>;
}
