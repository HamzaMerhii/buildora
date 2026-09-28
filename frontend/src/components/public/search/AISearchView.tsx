'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { searchBuildora, type SearchResponse } from '@/lib/public/ai-search';
import { RouteNavbar } from '@/components/public/layout/Navbar';
import GlowButton from '@/components/public/ui/GlowButton';
import ApartmentListingCard from '@/components/public/apartments/ApartmentListingCard';
import CompanyListingCard from '@/components/public/company/CompanyListingCard';

const SUGGESTIONS = [
  'Available 3-bedroom apartments',
  'Apartments with parking',
  'Residences by Cedar Contracting',
  'Construction companies for residential projects',
  'Large apartments with balconies',
];

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionConfig();
  if (reduced) return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay }}>{children}</motion.div>;
}

function InterpretationChips({ response }: { response: SearchResponse }) {
  const chips: string[] = [];
  const i = response.interpretation;
  chips.push(i.entityType === 'both' ? 'APARTMENTS + COMPANIES' : i.entityType.toUpperCase());
  if (i.status) chips.push(i.status.toUpperCase());
  if (i.bedrooms != null) chips.push(`${i.bedrooms} BEDROOM${i.bedrooms === 1 ? '' : 'S'}`);
  if (i.bathrooms != null) chips.push(`${i.bathrooms} BATHROOM${i.bathrooms === 1 ? '' : 'S'}`);
  if (i.location) chips.push(i.location.toUpperCase());
  if (i.company) chips.push(i.company.toUpperCase());
  if (i.project) chips.push(i.project.toUpperCase());
  if (i.minPrice != null) chips.push(`FROM $${i.minPrice.toLocaleString()}`);
  if (i.maxPrice != null) chips.push(`UNDER $${i.maxPrice.toLocaleString()}`);
  if (i.minArea != null) chips.push(`${i.minArea.toLocaleString()} M²+`);
  if (i.maxArea != null) chips.push(`UP TO ${i.maxArea.toLocaleString()} M²`);
  if (chips.length === 0) return null;
  return <div className="ai-chips" aria-label="What Buildora understood">
    <span className="ai-understood">Buildora understood</span>
    {chips.map(chip => <span key={chip} className="ai-chip">{chip}</span>)}
  </div>;
}

function AISearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialQ = useRef<string | null>(null);

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await searchBuildora(trimmed);
      setResponse(result);
    } catch {
      setResponse(null);
      setError('We couldn’t complete that search. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && initialQ.current === null) {
      initialQ.current = q;
      setQuery(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = (response?.apartments.length ?? 0) + (response?.companies.length ?? 0);
  const hasSearched = response !== null || error !== null;

  return <div className="company-page list-page">
    <RouteNavbar activePath="/search" />

    <section className="al-hero ai-hero" aria-label="AI search introduction">
      <div className="co-hero-bg" aria-hidden="true">
        <Image src="/images/construction-site.webp" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: '50% 40%' }} />
      </div>
      <div className="co-hero-veil" aria-hidden="true" />
      <Reveal className="al-hero-inner">
        <p className="co-eyebrow">Buildora AI</p>
        <h1>Find what you need. Naturally.</h1>
        <p>Describe the apartment, company, or project you&rsquo;re looking for in your own words.</p>
      </Reveal>
    </section>

    <main className="al-main ai-main">
      <Reveal>
        <form
          className="ai-searchbox"
          role="search"
          aria-label="Natural language search"
          onSubmit={e => { e.preventDefault(); run(query); }}
        >
          <Sparkles size={18} aria-hidden="true" className="ai-spark" />
          <label className="ai-label" htmlFor="ai-query">Describe what you&rsquo;re looking for</label>
          <input
            id="ai-query"
            name="query"
            autoComplete="off"
            maxLength={1000}
            placeholder="Describe the apartment or construction company you’re looking for..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <GlowButton type="submit" disabled={loading || query.trim().length === 0}>
            <Search size={15} /> {loading ? 'Searching…' : 'Search'}
          </GlowButton>
        </form>
      </Reveal>

      {!hasSearched && !loading && (
        <Reveal delay={0.08}>
          <div className="ai-suggest" aria-label="Suggested searches">
            <p>Try one of these:</p>
            <div className="ai-suggest-chips">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" className="ai-suggest-chip" onClick={() => { setQuery(s); run(s); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      <div aria-live="polite">
        {loading && (
          <div className="ai-loading">
            <p>Understanding your request…</p>
            <div className="ai-skeletons" aria-hidden="true">
              {[0, 1, 2].map(i => <div key={i} className="ai-skeleton" />)}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="ai-state">
            <h2>We couldn’t complete that search.</h2>
            <p>Please try again in a moment.</p>
            <GlowButton onClick={() => run(query)}>Try Again</GlowButton>
          </div>
        )}

        {response && !loading && !error && (
          <div className="ai-results">
            <p className="al-count" role="status">
              {total === 0 ? 'No matches' : `${total} result${total === 1 ? '' : 's'}`}
              {response.mode === 'hybrid' && <span className="ai-mode"> · AI + live listings</span>}
              {response.mode === 'local-fallback' && !response.aiUnavailable && <span className="ai-mode"> · Live public listings</span>}
            </p>
            {response.answer && (
              <p className="ai-answer" role="status">{response.answer}</p>
            )}
            {response.aiUnavailable && (
              <p className="ai-fallback-note" role="status">AI search is temporarily unavailable. Showing standard search results instead.</p>
            )}
            <InterpretationChips response={response} />
            {total === 0 ? (
              <div className="ai-state">
                <h2>No exact matches found.</h2>
                <p>Try broadening your request or explore all apartments.</p>
                <div className="co-cta-actions">
                  <Link className="ghost-button co-back" href="/apartments">View All Apartments</Link>
                  <GlowButton onClick={() => setQuery('')}>Try Another Search</GlowButton>
                </div>
              </div>
            ) : (
              <>
                {response.apartments.length > 0 && (
                  <section aria-label="Matching apartments">
                    <h2 className="ai-group-title">Apartments <span>{response.apartments.length}</span></h2>
                    <div className="al-grid">
                      {response.apartments.map(a => <ApartmentListingCard key={a.id} apartment={a} />)}
                    </div>
                  </section>
                )}
                {response.companies.length > 0 && (
                  <section aria-label="Matching construction partners">
                    <h2 className="ai-group-title">Construction Partners <span>{response.companies.length}</span></h2>
                    <div className="co-list-grid ai-companies">
                      {response.companies.map((c, i) => <CompanyListingCard key={c.id} company={c} index={i} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Reveal>
        <section className="al-cta" aria-label="Need more help">
          <h2>Didn&rsquo;t find what you need?</h2>
          <p>Start a project with Buildora or explore our construction partners.</p>
          <div className="co-cta-actions">
            <GlowButton onClick={() => router.push('/register')}>Register Your Construction Company</GlowButton>
            <Link className="ghost-button co-back" href="/companies">View Companies</Link>
          </div>
        </section>
      </Reveal>
    </main>
  </div>;
}

export default function AISearchView() {
  return <Suspense fallback={<div className="company-page list-page"><main className="al-main"><p>Loading search…</p></main></div>}>
    <AISearchPage />
  </Suspense>;
}
