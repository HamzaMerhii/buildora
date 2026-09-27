'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import {
  getAllPublicApartments,
  getPublicApartments,
  type PublicApartmentListItem,
  type PublicApartmentsPage,
} from '@/lib/api/public.api';
import { friendlyMessage } from '@/lib/api/client';
import { RouteNavbar } from '@/components/public/layout/Navbar';
import NeonPanel from '@/components/public/ui/NeonPanel';
import GlowButton from '@/components/public/ui/GlowButton';
import ProjectDialog from '@/components/public/ui/ProjectDialog';
import ApartmentListingCard from './ApartmentListingCard';

const FILTERS = ['All', 'Available', 'Reserved', 'Sold'] as const;
type Filter = (typeof FILTERS)[number];

/** Visible cards per page. Sent as backend `page_size` in unfiltered mode. */
const PAGE_SIZE = 6;

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

function matchesFilter(apartment: PublicApartmentListItem, filter: Filter): boolean {
  if (filter === 'All') return true;
  return apartment.status.trim().toLowerCase() === filter.toLowerCase();
}

export default function ApartmentsListView() {
  const [filter, setFilter] = useState<Filter>('All');
  const [contact, setContact] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // Backend-driven page for the unfiltered view (no client slicing).
  const [pageData, setPageData] = useState<PublicApartmentsPage | null>(null);
  // Complete backend-assembled set for status views. The backend exposes
  // no `status` query param, so filtering one backend page locally would
  // silently drop matches living on other pages — hence the full fetch.
  const [filteredAll, setFilteredAll] = useState<PublicApartmentListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const reducedMotion = useReducedMotionConfig();
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    if (filter === 'All') {
      getPublicApartments({ page: currentPage, page_size: PAGE_SIZE })
        .then((data) => {
          if (request !== requestRef.current) return;
          if (data.items.length === 0 && data.total > 0 && currentPage > 1) {
            // Data shrank under the current page; fall back to the last page.
            setCurrentPage(Math.max(1, data.total_pages));
            return;
          }
          setPageData(data);
          setLoading(false);
        })
        .catch((err) => {
          if (request !== requestRef.current) return;
          setError(friendlyMessage(err));
          setLoading(false);
        });
    } else {
      getAllPublicApartments()
        .then((items) => {
          if (request !== requestRef.current) return;
          setFilteredAll(items.filter((a) => matchesFilter(a, filter)));
          setLoading(false);
        })
        .catch((err) => {
          if (request !== requestRef.current) return;
          setError(friendlyMessage(err));
          setLoading(false);
        });
    }
    return () => { requestRef.current += 1; };
  }, [filter, currentPage, retryNonce]);

  function retry() {
    setError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }

  function selectFilter(option: Filter) {
    if (loading && option === filter) return;
    setFilter(option);
    setCurrentPage(1);
    setPageData(null);
    setFilteredAll(null);
    setError(null);
    setLoading(true);
  }

  function scrollToToolbar() {
    document.getElementById('al-catalog-toolbar')?.scrollIntoView({ behavior: reducedMotion ? 'instant' as ScrollBehavior : 'smooth', block: 'start' });
  }

  // Backend-driven values for the unfiltered view; local values over the
  // complete backend-assembled set for status views.
  const isUnfiltered = filter === 'All';
  const total = isUnfiltered ? (pageData?.total ?? 0) : (filteredAll?.length ?? 0);
  const totalPages = isUnfiltered
    ? Math.max(1, pageData?.total_pages ?? 1)
    : Math.max(1, Math.ceil((filteredAll?.length ?? 0) / PAGE_SIZE));
  const safePage = isUnfiltered ? currentPage : Math.min(currentPage, totalPages);
  const pageItems = isUnfiltered
    ? (pageData?.items ?? [])
    : (filteredAll ?? []).slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasData = isUnfiltered ? pageData !== null : filteredAll !== null;

  const countLabel = !hasData && !error
    ? 'Loading residences…'
    : filter === 'All'
      ? `${total} Residence${total === 1 ? '' : 's'}`
      : `${total} ${filter} Residence${total === 1 ? '' : 's'}`;
  const rangeFrom = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeLabel = total === 0 ? '' : `Showing ${rangeFrom}–${Math.min(safePage * PAGE_SIZE, total)} of ${total}`;
  const emptyHeading = total === 0 && filter === 'All'
    ? 'No residences published yet.'
    : 'No apartments match this selection.';
  const emptyCopy = total === 0 && filter === 'All'
    ? 'Check back soon to explore new residences.'
    : 'Try a different availability filter to keep exploring.';

  function goToPage(page: number) {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === currentPage || loading) return;
    setCurrentPage(next);
    setLoading(true);
    scrollToToolbar();
  }

  return <div className="company-page list-page">
    <RouteNavbar activePath="/apartments" />

    <section className="al-hero" aria-label="Apartments introduction">
      <div className="co-hero-bg" aria-hidden="true">
        <Image src="/images/apartments/2.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
      </div>
      <div className="co-hero-veil" aria-hidden="true" />
      <Reveal className="al-hero-inner">
        <p className="co-eyebrow">Buildora Residences</p>
        <h1>Explore Our Apartments</h1>
        <p>Discover residences delivered by Buildora&rsquo;s construction partners, designed around quality, comfort, and modern living.</p>
      </Reveal>
    </section>

    <main className="al-main">
      <Reveal>
        <div className="al-toolbar" id="al-catalog-toolbar" role="group" aria-label="Filter apartments by availability">
          <div>
            <p className="al-count" role="status">{error ?? countLabel}</p>
            {rangeLabel && <p className="al-range">{rangeLabel}</p>}
          </div>
          <div className="al-filters">
            {FILTERS.map(option => (
              <button
                key={option}
                type="button"
                className={filter === option ? 'al-filter is-active' : 'al-filter'}
                aria-pressed={filter === option}
                onClick={() => selectFilter(option)}
                disabled={loading}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {error && (
        <NeonPanel className="al-empty">
          <h2>Something went wrong.</h2>
          <p>{error}</p>
          <GlowButton onClick={retry}>Try Again</GlowButton>
        </NeonPanel>
      )}

      {!error && hasData && total === 0 && (
        <NeonPanel className="al-empty">
          <h2>{emptyHeading}</h2>
          <p>{emptyCopy}</p>
          {filter !== 'All' && <GlowButton onClick={() => selectFilter('All')}>View all apartments</GlowButton>}
        </NeonPanel>
      )}

      {!error && pageItems.length > 0 && (
        <>
        <div className="al-grid">
          {pageItems.map((apartment, i) => (
            <Reveal key={apartment.id} delay={Math.min(i, 5) * 0.06}>
              <ApartmentListingCard apartment={apartment} />
            </Reveal>
          ))}
        </div>
        {totalPages > 1 && (
          <nav className="al-pagination" aria-label="Apartment pagination">
            <button type="button" className="al-page-nav" disabled={safePage === 1 || loading} onClick={() => goToPage(safePage - 1)} aria-label="Previous page">‹ Prev</button>
            <span className="al-page-indicator" aria-current="page">Page {safePage} of {totalPages}</span>
            <button type="button" className="al-page-nav" disabled={safePage === totalPages || loading} onClick={() => goToPage(safePage + 1)} aria-label="Next page">Next ›</button>
          </nav>
        )}
        </>
      )}

      <Reveal>
        <section className="al-cta" aria-label="Register your construction company">
          <h2>Build with the right partner.</h2>
          <p>Explore Buildora apartments or register your construction company to manage projects, teams, and leads in one workspace.</p>
          <div className="co-cta-actions">
            <GlowButton onClick={() => setContact(true)}>Register Your Construction Company</GlowButton>
            <Link className="ghost-button co-back" href="/">Back to Buildora</Link>
          </div>
        </section>
      </Reveal>
    </main>

    <ProjectDialog open={contact} onClose={() => setContact(false)} />
  </div>;
}
