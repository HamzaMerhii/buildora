'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
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
import ApartmentListingCard from './ApartmentListingCard';

/** Visible cards per page. Sent as backend `page_size` in unfiltered mode. */
const PAGE_SIZE = 6;

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

/**
 * Searchable text built only from real public list fields. Bedroom count
 * is rendered as a "N bedroom" token so queries like "2 bedroom" match.
 */
function searchableText(apartment: PublicApartmentListItem): string {
  const parts: Array<string | number | null | undefined> = [
    apartment.unit_number,
    apartment.project_name,
    apartment.company_name,
    apartment.project_location,
    apartment.status,
    apartment.floor_number,
  ];
  if (apartment.bedrooms !== null && apartment.bedrooms !== undefined) {
    parts.push(`${apartment.bedrooms} bedroom`);
  }
  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' ');
}

export default function ApartmentsListView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Backend-driven page for the unfiltered view (no client slicing).
  const [pageData, setPageData] = useState<PublicApartmentsPage | null>(null);
  // Complete backend-assembled set for client-side search. The backend
  // exposes no `search` query param, so matching one backend page locally
  // would silently drop matches living on other pages — hence the full
  // fetch, performed once and reused for every keystroke.
  const [allItems, setAllItems] = useState<PublicApartmentListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const reducedMotion = useReducedMotionConfig();
  const requestRef = useRef(0);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  useEffect(() => {
    const request = ++requestRef.current;
    if (!isSearching) {
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
    } else if (allItems === null) {
      getAllPublicApartments()
        .then((items) => {
          if (request !== requestRef.current) return;
          setAllItems(items);
          setLoading(false);
        })
        .catch((err) => {
          if (request !== requestRef.current) return;
          setError(friendlyMessage(err));
          setLoading(false);
        });
    }
    return () => { requestRef.current += 1; };
  }, [isSearching, currentPage, retryNonce, allItems]);

  // Entirely local: no network request is sent while typing once the
  // dataset is cached. Entering search mode resets to the first page.
  const filtered = useMemo(() => {
    if (!isSearching) return [];
    return (allItems ?? []).filter((apartment) =>
      searchableText(apartment).toLowerCase().includes(normalizedQuery),
    );
  }, [allItems, normalizedQuery, isSearching]);

  function retry() {
    setError(null);
    if (isSearching) setAllItems(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
    if (value.trim().length > 0) setLoading(allItems === null);
  }

  function clearSearch() {
    setSearchQuery('');
    setCurrentPage(1);
    setLoading(true);
  }

  function scrollToToolbar() {
    document.getElementById('al-catalog-toolbar')?.scrollIntoView({ behavior: reducedMotion ? 'instant' as ScrollBehavior : 'smooth', block: 'start' });
  }

  // Backend-driven values for the unfiltered view; local values over the
  // complete backend-assembled set while searching.
  const total = !isSearching ? (pageData?.total ?? 0) : filtered.length;
  const totalPages = !isSearching
    ? Math.max(1, pageData?.total_pages ?? 1)
    : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = !isSearching ? currentPage : Math.min(currentPage, totalPages);
  const pageItems = !isSearching
    ? (pageData?.items ?? [])
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasData = !isSearching ? pageData !== null : allItems !== null;

  const countLabel = !hasData && !error
    ? 'Loading residences…'
    : isSearching
      ? `${total} Residence${total === 1 ? '' : 's'} found`
      : `${total} Residence${total === 1 ? '' : 's'}`;
  const rangeFrom = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeLabel = total === 0 ? '' : `Showing ${rangeFrom}–${Math.min(safePage * PAGE_SIZE, total)} of ${total}`;
  const isSearchMiss = isSearching && hasData && filtered.length === 0;
  const emptyHeading = isSearchMiss
    ? 'No apartments match your search.'
    : 'No residences published yet.';
  const emptyCopy = isSearchMiss
    ? 'Try another unit number, project, company, or location.'
    : 'Check back soon to explore new residences.';

  function goToPage(page: number) {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === currentPage || loading) return;
    setCurrentPage(next);
    if (!isSearching) setLoading(true);
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
        <div className="al-toolbar" id="al-catalog-toolbar">
          <div>
            <p className="al-count" role="status">{error ?? countLabel}</p>
            {rangeLabel && <p className="al-range">{rangeLabel}</p>}
          </div>
          <label className="al-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by unit, project, company, or location..."
              aria-label="Search apartments"
            />
            {searchQuery && (
              <button type="button" className="al-search-clear" aria-label="Clear search" onClick={clearSearch}>
                <X size={15} />
              </button>
            )}
          </label>
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
          {isSearchMiss && <GlowButton onClick={clearSearch}>Clear search</GlowButton>}
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
            <GlowButton onClick={() => router.push('/register')}>Register Your Construction Company</GlowButton>
            <Link className="ghost-button co-back" href="/">Back to Buildora</Link>
          </div>
        </section>
      </Reveal>
    </main>
  </div>;
}
