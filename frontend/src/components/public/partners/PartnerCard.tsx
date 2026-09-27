'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import type { PublicCompanySummary } from '@/lib/api/public.api';
import { partnerMonogram, GENERAL_COMPANY_DESCRIPTION } from '@/lib/public/company-copy';
import NeonPanel from '@/components/public/ui/NeonPanel';

type Props = { partner: PublicCompanySummary; index: number; progress: MotionValue<number>; reduced: boolean };
export default function PartnerCard({ partner, index, progress, reduced }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const start = 0.535 + index * 0.016;
  const opacity = useTransform(progress, [start, start + 0.05], [0, 1]);
  const x = useTransform(progress, [start, start + 0.08], [26, 0]);
  const y = useTransform(progress, [start, start + 0.08], [14, 0]);
  const label = `0${index + 1}`;
  return <motion.div className="partner-row" style={{ opacity, x: reduced ? 0 : x, y: reduced ? 0 : y }}>
    <Link className="partner-card-link" href={`/companies/${partner.id}`} aria-label={`View ${partner.name} company profile`}>
      <NeonPanel className="partner-card">
      <span className="partner-index" aria-hidden="true">{label}</span>
      <span className="partner-logo" aria-hidden={!logoFailed}>
        {partner.logo && !logoFailed ? (
          <Image src={partner.logo} alt={`${partner.name} logo`} fill sizes="160px" onError={() => setLogoFailed(true)} style={{ objectFit: 'contain' }} />
        ) : (
          <span className="partner-mono" aria-hidden="true">{partnerMonogram(partner.name)}</span>
        )}
      </span>
      <h3>{partner.name}</h3>
      <p className="partner-desc">{GENERAL_COMPANY_DESCRIPTION}</p>
        <span className="partner-view" aria-hidden="true">View Company <ArrowUpRight size={13} /></span>
      </NeonPanel>
    </Link>
  </motion.div>;
}
