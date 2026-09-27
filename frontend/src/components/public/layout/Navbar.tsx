'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { Menu, X } from 'lucide-react';

type PageItem = { label: string; href?: string; active: boolean; onSelect?: () => void };

function LogoMark() {
  return <svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M22 5 40 36H4L18 12M22 17l11 19H13l7-12" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="m20 7 2-3 2 3" stroke="currentColor" strokeWidth="2"/></svg>;
}

/** Shared public navbar shell. Home and route wrappers inject page-link items. */
function PublicNavbarShell({ logo, items }: {
  logo: React.ReactNode;
  items: PageItem[];
}) {
  const reduced = useReducedMotionConfig();
  const [open, setOpen] = useState(false);
  return <motion.header className="navbar" initial={reduced ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .7 }}>
    {logo}
    <button className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav id="main-navigation" className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Main navigation">
      {items.map(item => item.href !== undefined
        ? <Link key={item.label} href={item.href} aria-current={item.active ? 'page' : undefined} onClick={() => setOpen(false)}>{item.label}</Link>
        : <button key={item.label} type="button" aria-current={item.active ? 'page' : undefined} onClick={() => { setOpen(false); item.onSelect?.(); }}>{item.label}</button>)}
    </nav>
  </motion.header>;
}

/** Homepage navbar: page links only. Cinematic scenes stay reachable via scroll, Enter, and dots. */
export default function Navbar({ navigate }: { navigate: (scene: number) => void }) {
  return <PublicNavbarShell
    logo={<button className="logo" aria-label="Home" onClick={() => navigate(0)}><LogoMark /></button>}
    items={[
      { label: 'Home', active: true, onSelect: () => navigate(0) },
      { label: 'Apartments', href: '/apartments', active: false },
      { label: 'Companies', href: '/companies', active: false },
      { label: 'AI Search', href: '/search', active: false },
    ]}
  />;
}

/** Route navbar: same page links with path-based active state. */
export function RouteNavbar({ activePath }: { activePath: string }) {
  const start = (href: string) => activePath === href || activePath.startsWith(href + '/');
  return <PublicNavbarShell
    logo={<Link className="logo" href="/" aria-label="Back to Buildora home"><LogoMark /></Link>}
    items={[
      { label: 'Home', href: '/', active: activePath === '/' },
      { label: 'Apartments', href: '/apartments', active: start('/apartments') },
      { label: 'Companies', href: '/companies', active: start('/companies') },
      { label: 'AI Search', href: '/search', active: start('/search') },
    ]}
  />;
}
