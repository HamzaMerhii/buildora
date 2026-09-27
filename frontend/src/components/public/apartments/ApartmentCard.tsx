'use client';
import Image from 'next/image';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import {
  apartmentDisplayName,
  formatApartmentStatus,
  type PublicApartmentListItem,
} from '@/lib/api/public.api';

type Props = {
  apartment: PublicApartmentListItem;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  progress: MotionValue<number>;
  reduced: boolean;
};
export default function ApartmentCard({ apartment, index, selected, onSelect, progress, reduced }: Props) {
  const start = 0.725 + index * 0.018;
  const opacity = useTransform(progress, [start, start + 0.05], [0, 1]);
  const y = useTransform(progress, [start, start + 0.07], [16, 0]);
  const name = apartmentDisplayName(apartment.unit_number);
  return <motion.div className="apartment-thumb" style={{ opacity, y: reduced ? 0 : y }}>
    <button
      type="button"
      className={selected ? 'thumb-frame is-selected' : 'thumb-frame'}
      aria-pressed={selected}
      aria-label={`Show ${name}`}
      onClick={() => onSelect(apartment.id)}
    >
      {apartment.primary_image && (
        <Image src={apartment.primary_image} alt={name} fill sizes="160px" style={{ objectFit: 'cover' }} />
      )}
      <span className="thumb-label" aria-hidden="true">{name}</span>
      {apartment.status && <span className="thumb-status" aria-hidden="true">{formatApartmentStatus(apartment.status)}</span>}
    </button>
  </motion.div>;
}
