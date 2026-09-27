'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { getPublicCompanies, type PublicCompanySummary } from '@/lib/api/public.api';
import PartnerCard from './PartnerCard';

export default function PartnersPanel({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const y = useTransform(progress, [0.52, 0.59, 0.68, 0.75], ['12vh', '0vh', '0vh', '-8vh']);
  const opacity = useTransform(progress, [0.515, 0.56, 0.695, 0.74], [0, 1, 1, 0]);
  const headClip = useTransform(progress, [0.53, 0.59], ['inset(0 100% 0 0)', 'inset(0 0% 0 0)']);
  const headOpacity = useTransform(progress, [0.525, 0.545], [0, 1]);
  const [partners, setPartners] = useState<PublicCompanySummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicCompanies()
      .then((companies) => { if (!cancelled) setPartners(companies); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return <motion.div className="partners-motion" style={{ y: reduced ? 0 : y, opacity }}>
    <div className="partners-layout">
      <motion.div className="partners-copy" style={{ clipPath: reduced ? undefined : headClip, opacity: headOpacity }}>
        <p className="partners-eyebrow">Built together</p>
        <h2>Our Construction Partners</h2>
        <p>Buildora works with experienced construction companies and contractors to deliver reliable, high-quality projects.</p>
        <Link className="partners-all" href="/companies">View All Companies</Link>
      </motion.div>
      <div className="partners-grid">
        {partners === null && !failed && (
          <p className="partners-loading" role="status">Loading construction partners…</p>
        )}
        {failed && (
          <p className="partners-error" role="alert">Couldn&apos;t load construction partners right now.</p>
        )}
        {(partners ?? []).map((partner, index) => <PartnerCard key={partner.id} {...{ partner, index, progress, reduced }} />)}
      </div>
    </div>
  </motion.div>;
}
