'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { notFound } from 'next/navigation';
import {
  getPublicApartment,
  getPublicApartments,
  type PublicApartmentDetails,
  type PublicApartmentListItem,
} from '@/lib/api/public.api';
import {
  toApartmentDetailViewModel,
  toRelatedCardModel,
} from '@/lib/public/apartment-detail-model';
import { GENERAL_COMPANY_DESCRIPTION } from '@/lib/public/company-copy';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import NeonPanel from '@/components/public/ui/NeonPanel';
import GlowButton from '@/components/public/ui/GlowButton';
import ApartmentGallery from './ApartmentGallery';
import InterestDialog from './InterestDialog';
import ProjectDialog from '@/components/public/ui/ProjectDialog';
import { RouteNavbar } from '@/components/public/layout/Navbar';

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

function DetailSkeleton() {
  return <div className="company-page apartment-page" aria-hidden="true">
    <RouteNavbar activePath="/apartments" />
    <section className="co-hero apt-hero" aria-hidden="true">
      <div className="co-hero-veil" aria-hidden="true" />
      <div className="co-hero-inner apt-hero-inner">
        <p><span className="apt-skeleton apt-skeleton-line" /></p>
        <h1><span className="apt-skeleton apt-skeleton-line" /></h1>
        <p><span className="apt-skeleton apt-skeleton-line" /></p>
      </div>
    </section>
    <section className="co-section apt-gallery-section">
      <div className="apt-detail-grid">
        <div>
          <div className="apt-gallery" role="status" aria-label="Loading residence photos">
            <div className="apt-main"><span className="apt-skeleton apt-skeleton-media" /></div>
          </div>
          <p className="apt-price" aria-hidden="true"><span className="apt-skeleton apt-skeleton-line" /></p>
        </div>
        <NeonPanel className="apt-summary">
          <p className="stat-label">Residence</p>
          <h2><span className="apt-skeleton apt-skeleton-line" /></h2>
          <p className="apt-summary-specs"><span className="apt-skeleton apt-skeleton-line" /></p>
        </NeonPanel>
      </div>
    </section>
  </div>;
}

export default function ApartmentDetailView({ apartmentId }: { apartmentId: string }) {
  const [interestOpen, setInterestOpen] = useState(false);
  const [contact, setContact] = useState(false);
  const [apartment, setApartment] = useState<PublicApartmentDetails | null>(null);
  const [related, setRelated] = useState<PublicApartmentListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicApartment(apartmentId)
      .then((detail) => {
        if (cancelled) return;
        setApartment(detail);
        // One extra slot covers excluding the current apartment itself.
        return getPublicApartments({ company_id: detail.company_id, page: 1, page_size: 4 })
          .then((page) => {
            if (!cancelled) setRelated(page.items.filter((r) => r.id !== detail.id).slice(0, 3));
          })
          .catch(() => { if (!cancelled) setRelated([]); });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setError(friendlyMessage(err));
      });
    return () => { cancelled = true; };
  }, [apartmentId]);

  if (missing) notFound();

  if (error) return <div className="company-page apartment-page">
    <RouteNavbar activePath="/apartments" />
    <main className="al-main">
      <div className="al-empty" role="alert">
        <h2>Something went wrong.</h2>
        <p>{error}</p>
        <GlowButton onClick={() => window.location.reload()}>Try Again</GlowButton>
      </div>
    </main>
  </div>;

  if (!apartment) return <DetailSkeleton />;

  const vm = toApartmentDetailViewModel(apartment);
  const relatedCards = related.map(toRelatedCardModel);

  return <div className="company-page apartment-page">
    <RouteNavbar activePath="/apartments" />

    <section className="co-hero apt-hero" aria-label={`${vm.name} introduction`}>
      <div className="co-hero-bg" aria-hidden="true">
        {vm.heroImage && <Image src={vm.heroImage} alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />}
      </div>
      <div className="co-hero-veil" aria-hidden="true" />
      <Reveal className="co-hero-inner apt-hero-inner">
        <p className={vm.statusClass}>{vm.statusLabel}</p>
        <h1>{vm.name}</h1>
        {vm.location && <p className="co-tagline">{vm.location}</p>}
        <p className="co-specialty">By {vm.companyName}</p>
        {vm.price && <p className="apt-hero-price">{vm.price}</p>}
        {vm.specsLine && <p className="apt-hero-facts">{vm.specsLine}</p>}
        <div className="apt-hero-actions">
          <GlowButton onClick={() => setInterestOpen(true)} disabled={vm.sold}>{vm.sold ? 'Sold' : 'I’m Interested'}</GlowButton>
          <Link className="ghost-button co-back" href={`/companies/${vm.company.id}`}>View Company</Link>
        </div>
      </Reveal>
    </section>

    <section className="co-section apt-gallery-section" aria-label={`${vm.name} photos and summary`}>
      <div className="apt-detail-grid">
        <div>
          {vm.gallery.length > 0 ? (
            <ApartmentGallery images={vm.gallery} name={vm.name} />
          ) : (
            <NeonPanel className="apt-summary">
              <p className="form-note">Photos for this residence are not available yet.</p>
            </NeonPanel>
          )}
          {vm.price && <p className="apt-price">{vm.price}</p>}
        </div>
        <Reveal delay={0.08}>
          <NeonPanel className="apt-summary">
            <p className="stat-label">Residence</p>
            <h2>{vm.name}</h2>
            <p className="apt-summary-specs">{vm.specsLine}</p>
            <GlowButton onClick={() => setInterestOpen(true)} disabled={vm.sold}>
              {vm.sold ? 'Sold' : 'I’m Interested'}
            </GlowButton>
            {vm.sold && <p className="form-note">This residence has been sold.</p>}
          </NeonPanel>
        </Reveal>
      </div>
    </section>

    <section className="co-section" aria-label="Specifications">
      <Reveal>
        <p className="co-eyebrow">01 — Specifications</p>
        <h2>Key details</h2>
      </Reveal>
      <div className="co-stats apt-specs">
        {vm.specs.map((spec, i) => (
          <Reveal key={spec.label} delay={i * 0.06}>
            <NeonPanel className="stat-card">
              <p className="stat-value">{spec.value}</p>
              <p className="stat-label">{spec.label}</p>
            </NeonPanel>
          </Reveal>
        ))}
        <Reveal delay={vm.specs.length * 0.06}>
          <NeonPanel className="stat-card">
            <p className="stat-value apt-status-value">{vm.statusLabel}</p>
            <p className="stat-label">Status</p>
          </NeonPanel>
        </Reveal>
      </div>
    </section>

    {vm.description && (
      <section className="co-section" aria-label={`About ${vm.name}`}>
        <Reveal>
          <p className="co-eyebrow">02 — Overview</p>
          <h2>About this residence</h2>
          <p className="co-longread">{vm.description}</p>
        </Reveal>
      </section>
    )}

    <section className="co-section" aria-label="Construction company">
      <Reveal>
        <p className="co-eyebrow">03 — Built by</p>
        <h2>Construction company</h2>
      </Reveal>
      <Reveal delay={0.08}>
        <NeonPanel className="apt-company">
          <span className="apt-company-logo">
            {vm.company.logo ? (
              <Image src={vm.company.logo} alt={`${vm.company.name} logo`} fill sizes="180px" style={{ objectFit: 'contain' }} />
            ) : null}
          </span>
          <div>
            <h3>{vm.company.name}</h3>
            <p className="co-owner-bio">{GENERAL_COMPANY_DESCRIPTION}</p>
            <Link className="apt-company-link" href={`/companies/${vm.company.id}`}>View Company</Link>
          </div>
        </NeonPanel>
      </Reveal>
    </section>

    {relatedCards.length > 0 && (
      <section className="co-section" aria-label="More residences">
        <Reveal>
          <p className="co-eyebrow">04 — Keep exploring</p>
          <h2>More from {vm.companyName}</h2>
        </Reveal>
        <div className="co-apartments apt-related">
          {relatedCards.map((item, i) => (
            <Reveal key={item.id} delay={i * 0.07}>
              <NeonPanel className="co-apartment">
                <Link className="apt-related-link" href={`/apartments/${item.id}`} aria-label={`View ${item.name}`}>
                  <span className="co-apartment-media">
                    {item.image ? (
                      <Image src={item.image} alt={item.alt} fill sizes="(max-width: 640px) 90vw, 30vw" style={{ objectFit: 'cover' }} />
                    ) : null}
                  </span>
                  <span className="co-apartment-body">
                    <span className="co-apartment-name">{item.name}</span>
                    <span className="co-apartment-meta">{item.meta}</span>
                    {item.status && <span className={item.statusClass ?? 'co-apartment-status'}>{item.status}</span>}
                  </span>
                </Link>
              </NeonPanel>
            </Reveal>
          ))}
        </div>
      </section>
    )}

    <section className="co-cta" aria-label="Express interest">
      <Reveal>
        <p className="co-eyebrow">Interested in {vm.name}?</p>
        <h2>Make it yours</h2>
        <p>Send an interest request and {vm.companyName} will follow up with availability and viewing times.</p>
        <div className="co-cta-actions">
          <GlowButton onClick={() => setInterestOpen(true)} disabled={vm.sold}>{vm.sold ? 'Sold' : 'I’m Interested'}</GlowButton>
          <Link className="ghost-button co-back" href="/">Back to Buildora</Link>
        </div>
      </Reveal>
    </section>

    <InterestDialog
      open={interestOpen}
      onClose={() => setInterestOpen(false)}
      apartmentId={vm.id}
      apartmentName={vm.name}
      companyName={vm.companyName}
    />
    <ProjectDialog open={contact} onClose={() => setContact(false)} />
  </div>;
}
