'use client';
import Image from 'next/image';
import { AnimatePresence, motion, useTransform, type MotionValue } from 'framer-motion';

type Props = { image: string; alt: string; progress: MotionValue<number>; reduced: boolean };
/** Full-scene atmospheric backdrop driven by the selected apartment. Scroll moves
 * the outer drift layer; apartment changes crossfade on the inner layer. */
export default function ApartmentBackdrop({ image, alt, progress, reduced }: Props) {
  const scale = useTransform(progress, [0.69, 0.76, 0.85, 0.91], [1.12, 1.05, 1.03, 1.08]);
  const x = useTransform(progress, [0.69, 0.76, 0.85, 0.91], ['2.5%', '0.6%', '-0.6%', '-3%']);
  return (
    <div className="scene-background">
      <motion.div className="image-drift apartment-drift" style={{ scale: reduced ? 1 : scale, x: reduced ? 0 : x }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={image}
            className="apartment-bg-swap"
            initial={reduced ? false : { opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.6 }}
          >
            <Image src={image} alt={alt} fill priority={false} sizes="100vw" style={{ objectFit: 'cover' }} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <div className="scene-grade" />
      <div className="apartments-veil" />
    </div>
  );
}
