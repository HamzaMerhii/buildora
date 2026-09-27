'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { notFound } from 'next/navigation';
import {
  apartmentDisplayName,
  formatApartmentArea,
  formatApartmentStatus,
  getPublicApartments,
  getPublicCompany,
  type PublicApartmentsPage,
  type PublicCompanyDetails,
} from '@/lib/api/public.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { GENERAL_COMPANY_DESCRIPTION } from '@/lib/public/company-copy';
import NeonPanel from '@/components/public/ui/NeonPanel';
import GlowButton from '@/components/public/ui/GlowButton';
import ProjectDialog from '@/components/public/ui/ProjectDialog';
import { RouteNavbar } from '@/components/public/layout/Navbar';

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

/** Visible residence cards per page. Matches the two-row company grid. */
const RESIDENCES_PAGE_SIZE = 6;

export default function CompanyProfileView({ companyId }: { companyId: string }) {
  const [contact, setContact] = useState(false);
  const [company, setCompany] = useState<PublicCompanyDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  // Residences pagination is independent from the company profile itself,
  // and resets because the route remounts this view per company UUID.
  const [residencesPage, setResidencesPage] = useState(1);
  const [residencesData, setResidencesData] = useState<PublicApartmentsPage | null>(null);
  const [residencesLoading, setResidencesLoading] = useState(true);
  const [residencesError, setResidencesError] = useState<string | null>(null);
  const reducedMotion = useReducedMotionConfig();

  useEffect(() => {
    let cancelled = false;
    getPublicCompany(companyId)
      .then((detail) => {
        if (cancelled) return;
        setCompany(detail);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else setError(friendlyMessage(err));
      });
    return () => { cancelled = true; };
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    getPublicApartments({ company_id: companyId, page: residencesPage, page_size: RESIDENCES_PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        if (data.items.length === 0 && data.total > 0 && residencesPage > 1) {
          // Data changed under the current page; fall back to the last page.
          setResidencesPage(Math.max(1, data.total_pages));
          return;
        }
        setResidencesData(data);
        setResidencesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // A missing company surfaces through the company request above;
        // here only genuine residences failures are shown, scoped to the section.
        setResidencesError(friendlyMessage(err));
        setResidencesLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyId, residencesPage]);

  if (missing) notFound();

  if (error) return <div className="company-page">
    <RouteNavbar activePath="/companies" />
    <main className="al-main">
      <div className="al-empty" role="alert">
        <h2>Something went wrong.</h2>
        <p>{error}</p>
        <GlowButton onClick={() => window.location.reload()}>Try Again</GlowButton>
      </div>
    </main>
  </div>;

  if (!company) return <div className="company-page">
    <RouteNavbar activePath="/companies" />
    <main className="al-main">
      <p className="al-count" role="status">Loading company profile…</p>
    </main>
  </div>;

  const heroImage = company.available_apartments[0]?.primary_image ?? '/images/construction-site.webp';

  function retryResidences() {
    setResidencesError(null);
    setResidencesLoading(true);
    const page = residencesPage;
    getPublicApartments({ company_id: companyId, page, page_size: RESIDENCES_PAGE_SIZE })
      .then((data) => {
        setResidencesData(data);
        setResidencesLoading(false);
      })
      .catch((err) => {
        setResidencesError(friendlyMessage(err));
        setResidencesLoading(false);
      });
  }

  function goToResidencesPage(page: number) {
    const totalPages = Math.max(1, residencesData?.total_pages ?? 1);
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === residencesPage || residencesLoading) return;
    setResidencesPage(next);
    setResidencesLoading(true);
    document.getElementById('co-residences-grid')?.scrollIntoView({ behavior: reducedMotion ? 'instant' as ScrollBehavior : 'smooth', block: 'start' });
  }

  const residenceItems = residencesData?.items ?? [];
  const residenceTotal = residencesData?.total ?? 0;
  const residenceTotalPages = Math.max(1, residencesData?.total_pages ?? 1);

  return <div className="company-page">
    <RouteNavbar activePath="/companies" />

    <section className="co-hero" aria-label={`${company.name} introduction`}>
      <div className="co-hero-bg" aria-hidden="true">
        <Image src={heroImage} alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
      </div>
      <div className="co-hero-veil" aria-hidden="true" />
      <Reveal className="co-hero-inner">
        <p className="co-badge">Buildora Partner</p>
        <span className="co-logo-frame">
          {company.logo ? (
            <Image src={company.logo} alt={`${company.name} logo`} fill sizes="220px" style={{ objectFit: 'contain' }} />
          ) : null}
        </span>
        <h1>{company.name}</h1>
        <p className="co-desc">{GENERAL_COMPANY_DESCRIPTION}</p>
      </Reveal>
    </section>

    <section className="co-section" aria-label={`About ${company.name}`}>
      <Reveal>
        <p className="co-eyebrow">01 — Overview</p>
        <h2>About {company.name}</h2>
      </Reveal>
      <div className="co-overview-grid">
        <Reveal delay={0.05}>
          <p>{GENERAL_COMPANY_DESCRIPTION}</p>
        </Reveal>
        <Reveal delay={0.12}>
          <NeonPanel className="co-facts">
            <dl>
              {company.address && <div><dt>Based in</dt><dd>{company.address}</dd></div>}
              <div><dt>Residences</dt><dd>{company.apartment_count} public residence{company.apartment_count === 1 ? '' : 's'}</dd></div>
            </dl>
          </NeonPanel>
        </Reveal>
      </div>
    </section>

    <section className="co-section" aria-label={`Residences by ${company.name}`}>
      <Reveal>
        <p className="co-eyebrow">02 — Residences</p>
        <h2>Residences by {company.name}</h2>
        <p className="co-section-lead">Explore public residences developed and delivered by this Buildora partner.</p>
      </Reveal>
      {residencesData === null && !residencesError && (
        <p className="al-count" role="status">Loading residences…</p>
      )}
      {residencesError && (
        <Reveal>
          <div role="alert">
          <NeonPanel className="al-empty">
            <h2>Couldn&apos;t load residences.</h2>
            <p>{residencesError}</p>
            <GlowButton onClick={retryResidences}>Try Again</GlowButton>
          </NeonPanel>
          </div>
        </Reveal>
      )}
      {!residencesError && residencesData !== null && residenceTotal === 0 && (
        <Reveal>
          <NeonPanel className="al-empty">
            <h2>No public residences yet.</h2>
            <p>{company.name} hasn&apos;t published any residences on Buildora so far.</p>
          </NeonPanel>
        </Reveal>
      )}
      {!residencesError && residenceItems.length > 0 && (
        <>
        <div className="co-apartments" id="co-residences-grid">
          {residenceItems.map((apartment, i) => {
            const name = apartmentDisplayName(apartment.unit_number);
            return (
              <Reveal key={apartment.id} delay={i * 0.07}>
                <Link className="co-apartment-card-link" href={`/apartments/${apartment.id}`} aria-label={`View details of ${name}`}>
                <NeonPanel className="co-apartment">
                  <span className="co-apartment-media">
                    {apartment.primary_image ? (
                      <Image src={apartment.primary_image} alt={name} fill sizes="(max-width: 640px) 90vw, 30vw" style={{ objectFit: 'cover' }} />
                    ) : null}
                  </span>
                  <span className="co-apartment-body">
                    <span className="co-apartment-name">{name}</span>
                    <span className="co-apartment-meta">
                      {[
                        apartment.bedrooms != null && `${apartment.bedrooms} Beds`,
                        apartment.bathrooms != null && `${apartment.bathrooms} Baths`,
                        formatApartmentArea(apartment.area_sqm),
                      ].filter(Boolean).join(' · ')}
                    </span>
                    {apartment.status && <span className="co-apartment-status">{formatApartmentStatus(apartment.status)}</span>}
                  </span>
                </NeonPanel>
                </Link>
              </Reveal>
            );
          })}
        </div>
        {residenceTotalPages > 1 && (
          <nav className="al-pagination" aria-label="Company residences pagination">
            <button type="button" className="al-page-nav" disabled={residencesPage === 1 || residencesLoading} onClick={() => goToResidencesPage(residencesPage - 1)} aria-label="Previous page">‹ Prev</button>
            <span className="al-page-indicator" aria-current="page">Page {residencesPage} of {residenceTotalPages}</span>
            <button type="button" className="al-page-nav" disabled={residencesPage === residenceTotalPages || residencesLoading} onClick={() => goToResidencesPage(residencesPage + 1)} aria-label="Next page">Next ›</button>
          </nav>
        )}
        </>
      )}
    </section>

    {(company.address || company.phone || company.email) && (
      <section className="co-section" aria-label={`${company.name} contact details`}>
        <Reveal>
          <p className="co-eyebrow">03 — Company details</p>
          <h2>Get in touch</h2>
        </Reveal>
        <div className="co-contact-grid">
          {company.address && <Reveal delay={0}><NeonPanel className="co-contact-card"><p className="stat-label">Location</p><p>{company.address}</p></NeonPanel></Reveal>}
          {company.phone && <Reveal delay={0.06}><NeonPanel className="co-contact-card"><p className="stat-label">Phone</p><p>{company.phone}</p></NeonPanel></Reveal>}
          {company.email && <Reveal delay={0.12}><NeonPanel className="co-contact-card"><p className="stat-label">Email</p><p>{company.email}</p></NeonPanel></Reveal>}
        </div>
      </section>
    )}

    <section className="co-cta" aria-label={`Build with ${company.name}`}>
      <Reveal>
        <p className="co-eyebrow">Register your company</p>
        <h2>Build with {company.name}</h2>
        <p>Register your construction company to manage projects, teams, and leads with Buildora.</p>
        <div className="co-cta-actions">
          <GlowButton onClick={() => setContact(true)}>Register Your Construction Company</GlowButton>
          <Link className="ghost-button co-back" href="/">Back to Buildora</Link>
        </div>
      </Reveal>
    </section>

    <ProjectDialog open={contact} onClose={() => setContact(false)} />
  </div>;
}
