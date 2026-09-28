'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { getPublicCompanies, type PublicCompanySummary } from '@/lib/api/public.api';
import { friendlyMessage } from '@/lib/api/client';
import { RouteNavbar } from '@/components/public/layout/Navbar';
import GlowButton from '@/components/public/ui/GlowButton';
import CompanyListingCard from './CompanyListingCard';

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

export default function CompaniesListView() {
  const router = useRouter();
  const [companies, setCompanies] = useState<PublicCompanySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicCompanies()
      .then((items) => { if (!cancelled) setCompanies(items); })
      .catch((err) => { if (!cancelled) setError(friendlyMessage(err)); });
    return () => { cancelled = true; };
  }, []);

  function retry() {
    setError(null);
    setCompanies(null);
    getPublicCompanies()
      .then(setCompanies)
      .catch((err) => setError(friendlyMessage(err)));
  }

  return <div className="company-page list-page">
    <RouteNavbar activePath="/companies" />

    <section className="al-hero co-list-hero" aria-label="Construction partners introduction">
      <div className="co-hero-bg" aria-hidden="true">
        <Image src="/images/construction-site.webp" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: '30% center' }} />
      </div>
      <div className="co-hero-veil" aria-hidden="true" />
      <Reveal className="al-hero-inner">
        <p className="co-eyebrow">Buildora Network</p>
        <h1>Our Construction Partners</h1>
        <p>Meet the construction companies working with Buildora to deliver reliable, modern, and high-quality projects.</p>
      </Reveal>
    </section>

    <main className="al-main">
      <Reveal>
        <div className="al-toolbar">
          <div>
            <p className="al-count" role="status">
              {companies === null && !error && 'Loading construction partners…'}
              {error && 'Couldn’t load construction partners'}
              {companies !== null && `${companies.length} Construction Partner${companies.length === 1 ? '' : 's'}`}
            </p>
            <p className="al-range">Trusted companies working across residential, structural, engineering, and project delivery.</p>
          </div>
        </div>
      </Reveal>

      {error && (
        <Reveal>
          <div className="al-empty" role="alert">
            <h2>Something went wrong.</h2>
            <p>{error}</p>
            <GlowButton onClick={retry}>Try Again</GlowButton>
          </div>
        </Reveal>
      )}

      {companies !== null && companies.length === 0 && !error && (
        <Reveal>
          <div className="al-empty">
            <h2>No construction partners yet.</h2>
            <p>Check back soon to meet the companies building with Buildora.</p>
          </div>
        </Reveal>
      )}

      {companies !== null && companies.length > 0 && (
        <div className="co-list-grid">
          {companies.map((company, i) => (
            <Reveal key={company.id} delay={Math.min(i, 5) * 0.06}>
              <CompanyListingCard company={company} index={i} />
            </Reveal>
          ))}
        </div>
      )}

      <Reveal>
        <section className="al-cta" aria-label="Register your construction company">
          <h2>Build with the right partner.</h2>
          <p>Explore Buildora&rsquo;s construction network or register your company to manage projects, teams, and leads in one workspace.</p>
          <div className="co-cta-actions">
            <GlowButton onClick={() => router.push('/register')}>Register Your Construction Company</GlowButton>
            <Link className="ghost-button co-back" href="/apartments">Explore Apartments</Link>
          </div>
        </section>
      </Reveal>
    </main>
  </div>;
}
