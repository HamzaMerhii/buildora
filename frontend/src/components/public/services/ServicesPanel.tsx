'use client';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { services } from '@/data/public/services';
import ServiceCard from './ServiceCard';
import NeonPanel from '@/components/public/ui/NeonPanel';

export default function ServicesPanel({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const y = useTransform(progress, [0.12, 0.19, 0.32, 0.39], ['34vh', '0vh', '-1vh', '-13vh']);
  const x = useTransform(progress, [0.12, 0.19, 0.32, 0.39], ['-5%', '0%', '0%', '-15%']);
  const scale = useTransform(progress, [0.12, 0.19, 0.32, 0.39], [0.92, 1, 1.01, 0.95]);
  const opacity = useTransform(progress, [0.115, 0.155, 0.325, 0.38], [0, 1, 1, 0]);
  return <motion.div className="hud-motion" style={{ y: reduced ? 0 : y, x: reduced ? 0 : x, scale: reduced ? 1 : scale, opacity }}>
    <div className="hud-stack">
      <NeonPanel className="hud-heading"><h2>Our Services</h2></NeonPanel>
      {services.map((service, index) => <ServiceCard key={service.title} {...{ service, index, progress, reduced }} />)}
    </div>
  </motion.div>;
}
