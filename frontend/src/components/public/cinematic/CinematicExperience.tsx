'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotionConfig, useScroll, useSpring, useTransform } from 'framer-motion';
import SceneBackground from './SceneBackground';
import SceneTransition from './SceneTransition';
import { TIMELINE } from './timeline';
import Navbar from '@/components/public/layout/Navbar';
import HeroSection from '@/components/public/sections/HeroSection';
import WhyBuildoraPanel from '@/components/public/stats/WhyBuildoraPanel';
import PartnersPanel from '@/components/public/partners/PartnersPanel';
import ApartmentsPanel from '@/components/public/apartments/ApartmentsPanel';
import ApartmentBackdrop from '@/components/public/apartments/ApartmentBackdrop';
import FinalCTASection from '@/components/public/sections/FinalCTASection';
import { apartmentDisplayName, getPublicApartments, type PublicApartmentListItem } from '@/lib/api/public.api';

/** Home showcase shows the first three public apartments. No backend ranking. */
const HOME_SHOWCASE_PAGE_SIZE = 3;
import ServicesPanel from '@/components/public/services/ServicesPanel';
import ProjectDialog from '@/components/public/ui/ProjectDialog';

export default function CinematicExperience() {
  const track = useRef<HTMLElement>(null);
  const reduced = Boolean(useReducedMotionConfig());
  const [active, setActive] = useState(0);
  const [contact, setContact] = useState(false);
  const [apartments, setApartments] = useState<PublicApartmentListItem[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(true);
  const [apartmentsFailed, setApartmentsFailed] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<string | null>(null);
  const selected = apartments.find(a => a.id === selectedApartment) ?? apartments[0] ?? null;
  const selectedName = selected ? apartmentDisplayName(selected.unit_number) : 'Featured residence';

  useEffect(() => {
    let cancelled = false;
    getPublicApartments({ page: 1, page_size: HOME_SHOWCASE_PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        const items = page.items;
        setApartments(items);
        setApartmentsLoading(false);
        setSelectedApartment((current) => current ?? items[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setApartmentsFailed(true);
        setApartmentsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  // Overdamped interpolation softens wheel input without overshoot or bounce.
  const camera = useSpring(scrollYProgress, { stiffness: 180, damping: 36, mass: 0.7, restDelta: 0.0001 });
  // A plain motion value avoids native scroll-timeline interpolation in the no-motion path.
  const directProgress = useMotionValue(0);
  useMotionValueEvent(scrollYProgress, 'change', value => directProgress.set(value));
  const progress = reduced ? directProgress : camera;
  const heroUIX = useTransform(progress, [0, 0.1, 0.18], ['0%', '0%', '-22%']);
  const heroUIY = useTransform(progress, [0, 0.1, 0.18], ['0%', '0%', '-10%']);
  const heroCopyOpacity = useTransform(progress, [0, 0.09, 0.14], [1, 1, 0]);
  const heroCTAOpacity = useTransform(progress, [0, 0.14, 0.18], [1, 1, 0]);
  useMotionValueEvent(progress, 'change', value => setActive(value < TIMELINE.activeBounds[0] ? 0 : value < TIMELINE.activeBounds[1] ? 1 : value < TIMELINE.activeBounds[2] ? 2 : value < TIMELINE.activeBounds[3] ? 3 : value < TIMELINE.activeBounds[4] ? 4 : 5));

  function navigate(scene: number) {
    const el = track.current;
    if (!el) return;
    window.scrollTo({ top: el.offsetTop + (el.offsetHeight - window.innerHeight) * TIMELINE.stops[scene], behavior: reduced ? 'instant' : 'smooth' });
  }
  // Refs keep the single global key handler fresh without re-subscribing.
  const activeRef = useRef(active);
  const contactRef = useRef(contact);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    activeRef.current = active;
    contactRef.current = contact;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      // Never steal Enter from the project brief dialog or its form.
      if (contactRef.current) return;
      if (document.querySelector('.project-dialog[open]')) return;
      // Never steal Enter from interactive or editable elements.
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el !== document.documentElement) {
        if (el.isContentEditable) return;
        if (typeof el.closest === 'function' && el.closest('input,textarea,select,button,a,dialog,form,[contenteditable]')) return;
      }
      const next = activeRef.current + 1;
      if (next > 5) return;
      e.preventDefault();
      navigateRef.current(next);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <main ref={track} className="cinematic-track">
    <div className="cinematic-viewport">
      <Navbar navigate={navigate} />
      <SceneTransition className="hero-scene" label="Building the future" progress={progress} times={TIMELINE.heroTravel} positions={['0%', '0%', '-46%']} fadeTimes={[0, 0.14, 0.185]} fades={[1, 1, 0]} active={active === 0} reduced={reduced}>
        <SceneBackground src="/images/hero-city.webp" alt="Aerial nighttime city with a centered skyscraper and illuminated crown" priority position="50% 30%" progress={progress} range={[0, 0.1, 0.185]} scales={[1.02, 1.05, 1.12]} pan={['0%', '-0.8%', '-3%']} reduced={reduced} />
        <motion.div className="foreground-layer" style={{ x: reduced ? 0 : heroUIX, y: reduced ? 0 : heroUIY }}><HeroSection onStart={() => setContact(true)} copyOpacity={heroCopyOpacity} ctaOpacity={heroCTAOpacity} /></motion.div>
      </SceneTransition>
      <SceneTransition className="services-scene" label="Our Services" progress={progress} times={TIMELINE.servicesTravel} positions={['46%', '0%', '0%', '-44%']} fadeTimes={[0.11, 0.17, 0.345, 0.4]} fades={[0, 1, 1, 0]} active={active === 1} reduced={reduced}>
        <SceneBackground src="/images/services-city.webp" alt="Cyan-lit skyscrapers rising above a nighttime city" progress={progress} range={[0.115, 0.185, 0.335, 0.415]} scales={[1.12, 1.05, 1.03, 1.11]} pan={['3%', '1%', '-0.8%', '-3%']} reduced={reduced} />
        <ServicesPanel progress={progress} reduced={reduced} />
      </SceneTransition>
      <SceneTransition className="about-scene" label="Why Buildora" progress={progress} times={TIMELINE.aboutTravel} positions={['46%', '0%', '0%', '-44%']} fadeTimes={[0.325, 0.385, 0.51, 0.565]} fades={[0, 1, 1, 0]} active={active === 2} reduced={reduced}>
        <SceneBackground src="/images/construction-site.webp" alt="Steel structural frame and tower cranes illuminated by blue and amber floodlights" position="58% center" progress={progress} range={[0.33, 0.4, 0.5, 0.58]} scales={[1.12, 1.045, 1.03, 1.1]} pan={['3%', '0.6%', '-0.6%', '-3%']} reduced={reduced} />
        <WhyBuildoraPanel progress={progress} reduced={reduced} />
      </SceneTransition>
      <SceneTransition className="partners-scene" label="Our Construction Partners" progress={progress} times={TIMELINE.partnersTravel} positions={['46%', '0%', '0%', '-44%']} fadeTimes={[0.505, 0.565, 0.69, 0.745]} fades={[0, 1, 1, 0]} active={active === 3} reduced={reduced}>
        <SceneBackground src="/images/construction-site.webp" alt="Construction site framework and floodlights from a second angle" position="30% center" progress={progress} range={[0.51, 0.58, 0.68, 0.76]} scales={[1.12, 1.045, 1.03, 1.1]} pan={['2.5%', '0.6%', '-0.6%', '-3%']} reduced={reduced} />
        <PartnersPanel progress={progress} reduced={reduced} />
      </SceneTransition>
      <SceneTransition className="apartments-scene" label="Featured Apartments" progress={progress} times={TIMELINE.apartmentsTravel} positions={['46%', '0%', '0%', '-44%']} fadeTimes={[0.685, 0.745, 0.855, 0.905]} fades={[0, 1, 1, 0]} active={active === 4} reduced={reduced}>
        <ApartmentBackdrop image={selected?.primary_image ?? '/images/apartments/2.png'} alt={selectedName} progress={progress} reduced={reduced} />
        <ApartmentsPanel progress={progress} reduced={reduced} apartments={apartments} loading={apartmentsLoading} failed={apartmentsFailed} selectedId={selected?.id ?? null} onSelect={setSelectedApartment} />
      </SceneTransition>
      <SceneTransition className="final-scene" label="Build with us" progress={progress} times={TIMELINE.finalTravel} positions={['46%', '0%', '0%']} fadeTimes={[0.835, 0.905, 1]} fades={[0, 1, 1]} active={active === 5} reduced={reduced}>
        <SceneBackground src="/images/construction-site.webp" alt="Construction framework glowing at night" position="80% center" progress={progress} range={[0.84, 0.92, 1]} scales={[1.08, 1.04, 1.02]} pan={['-2%', '-0.5%', '0%']} reduced={reduced} />
        <FinalCTASection onStart={() => setContact(true)} progress={progress} reduced={reduced} />
      </SceneTransition>
      <nav className="scene-navigation" aria-label="Scene navigation">{['City', 'Services', 'Why Buildora', 'Partners', 'Apartments', 'Final'].map((label, i) => <button key={label} onClick={() => navigate(i)} aria-label={`Go to ${label}`} aria-current={active === i ? 'step' : undefined}><span /></button>)}</nav>
    </div>
    <ProjectDialog open={contact} onClose={() => setContact(false)} />
  </main>;
}


