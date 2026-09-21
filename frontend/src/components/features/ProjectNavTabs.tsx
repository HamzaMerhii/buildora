'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess, type ModuleKey } from '@/lib/auth/permissions';

const TABS: Array<{ name: string; path: string; module: ModuleKey }> = [
  { name: 'Overview', path: '', module: 'projects' },
  { name: 'Structure', path: '/structure', module: 'projects' },
  { name: 'Construction', path: '/construction', module: 'construction' },
  { name: 'Apartments', path: '/apartments', module: 'apartments' },
  { name: 'Payments', path: '/payments', module: 'payments' },
  { name: 'Documents', path: '/documents', module: 'documents' },
];

/** Form pages keep their own Back-button flow and stay outside the tab shell. */
function isFormRoute(relative: string): boolean {
  return (
    relative === '/edit' ||
    relative.startsWith('/edit/') ||
    relative.startsWith('/buildings/')
  );
}

function activeTab(relative: string): string {
  if (relative === '' || relative === '/') return 'Overview';
  for (const tab of [...TABS].reverse()) {
    if (tab.path && (relative === tab.path || relative.startsWith(tab.path + '/'))) {
      return tab.name;
    }
  }
  return 'Overview';
}

/**
 * Shared Project Details navigation for /app/projects/[id]/*.
 * Same markup/styling as the former page-level tabs; visibility follows
 * the centralized permission map. Rendered once by the [id] layout.
 */
export function ProjectNavTabs() {
  const params = useParams();
  const pathname = usePathname();
  const companyRole = useAuthStore((s) => s.companyRole);
  const id = typeof params.id === 'string' ? params.id : '';

  const base = `/app/projects/${id}`;
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;

  if (!id || isFormRoute(relative)) return null;

  const active = activeTab(relative);
  const visible = TABS.filter((t) => !companyRole || canAccess(companyRole, t.module));
  if (!visible.length) return null;

  return (
    <nav className="tabs" aria-label="Project sections">
      {visible.map(({ name, path }) => (
        <Link key={name} className={name === active ? 'active' : ''} href={base + path}>
          {name}
        </Link>
      ))}
    </nav>
  );
}
