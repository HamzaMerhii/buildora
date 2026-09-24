import type { CompanyRole } from '@/stores/auth.store';

/**
 * Centralized company-role authorization.
 *
 * Module keys are the single source of truth for what each
 * CompanyMembership.role may open. Pages, layouts and navigation
 * must resolve through `resolveModule` / `canAccess` instead of
 * scattering `role === ...` checks.
 *
 * Mirrors the backend intent in `dependencies/permissions.py`:
 * - projects/buildings/floors/apartments/stages/land mutate ≈ require_project_manager (OWNER, PROJECT_MANAGER)
 * - tasks mutate ≈ require_site_management (OWNER, PROJECT_MANAGER, SITE_ENGINEER)
 * - project/floor/stage reads ≈ require_site_management / require_company_member
 * - finance areas ≈ require_finance (OWNER, FINANCE)
 *
 * Known backend gaps (reported, not changed here): the project list
 * and detail endpoints deny SALES/FINANCE (list allows
 * OWNER/PROJECT_MANAGER/SITE_ENGINEER, detail allows OWNER/PROJECT_MANAGER),
 * so the frontend no longer grants those roles the `projects` module.
 * All apartment endpoints require OWNER/PROJECT_MANAGER, so only those
 * roles hold the `apartments`/`apartments-mutate` modules. All party
 * endpoints require OWNER/PROJECT_MANAGER, so only those roles hold
 * the `parties` module. Task reads require any company member and task
 * mutations require site management (OWNER, PROJECT_MANAGER,
 * SITE_ENGINEER). All document endpoints require site management
 * (OWNER, PROJECT_MANAGER, SITE_ENGINEER), so only those roles hold
 * the `documents` module. All company/member settings endpoints
 * require OWNER, so only owners hold `settings`/`team`; every
 * authenticated company user keeps `profile`. All lead endpoints
 * require OWNER/SALES (require_sales), so only those roles hold the
 * `leads` module.
 */
export type ModuleKey =
  | 'dashboard-owner'
  | 'dashboard-engineer'
  | 'dashboard-sales'
  | 'dashboard-finance'
  | 'projects'
  | 'projects-mutate'
  | 'construction'
  | 'tasks'
  | 'tasks-mutate'
  | 'apartments'
  | 'apartments-mutate'
  | 'leads'
  | 'parties'
  | 'payments'
  | 'documents'
  | 'team'
  | 'settings'
  | 'profile'
  | 'assistant'
  | 'app-root';

const ALL_MODULES: readonly ModuleKey[] = [
  'dashboard-owner',
  'dashboard-engineer',
  'dashboard-sales',
  'dashboard-finance',
  'projects',
  'projects-mutate',
  'construction',
  'tasks',
  'tasks-mutate',
  'apartments',
  'apartments-mutate',
  'leads',
  'parties',
  'payments',
  'documents',
  'team',
  'settings',
  'profile',
  'assistant',
  'app-root',
];

export const ROLE_MODULES: Record<CompanyRole, readonly ModuleKey[]> = {
  OWNER: ALL_MODULES,
  PROJECT_MANAGER: [
    'dashboard-owner',
    'dashboard-engineer',
    'projects',
    'projects-mutate',
    'construction',
    'tasks',
    'tasks-mutate',
    'apartments',
    'apartments-mutate',
    'parties',
    'documents',
    'profile',
    'assistant',
    'app-root',
  ],
  SITE_ENGINEER: [
    'dashboard-engineer',
    'projects',
    'construction',
    'tasks',
    'tasks-mutate',
    'documents',
    'profile',
    'assistant',
    'app-root',
  ],
  SALES: [
    'dashboard-sales',
    'leads',
    'profile',
    'assistant',
    'app-root',
  ],
  FINANCE: [
    'dashboard-finance',
    'payments',
    'profile',
    'assistant',
    'app-root',
  ],
  // Safest limited default: own landing view plus personal pages.
  OTHER: ['dashboard-owner', 'profile', 'assistant', 'app-root'],
};

interface PathRule {
  prefix: string;
  /** Optional extra segment that must appear after the prefix. */
  contains?: string;
  module: ModuleKey;
}

// Ordered: most specific prefixes first.
const PATH_RULES: readonly PathRule[] = [
  { prefix: '/app/dashboard/engineer', module: 'dashboard-engineer' },
  { prefix: '/app/dashboard/sales', module: 'dashboard-sales' },
  { prefix: '/app/dashboard/finance', module: 'dashboard-finance' },
  { prefix: '/app/dashboard', module: 'dashboard-owner' },
  { prefix: '/app/projects/new', module: 'projects-mutate' },
  { prefix: '/app/projects', contains: '/buildings/', module: 'projects-mutate' },
  { prefix: '/app/projects', contains: '/floors/', module: 'projects-mutate' },
  { prefix: '/app/projects', contains: '/edit', module: 'projects-mutate' },
  { prefix: '/app/projects', module: 'projects' },
  { prefix: '/app/buildings', module: 'projects-mutate' },
  { prefix: '/app/construction', module: 'construction' },
  { prefix: '/app/tasks/new', module: 'tasks-mutate' },
  { prefix: '/app/tasks', contains: '/edit', module: 'tasks-mutate' },
  { prefix: '/app/tasks', contains: '/updates/', module: 'tasks-mutate' },
  { prefix: '/app/tasks', module: 'tasks' },
  { prefix: '/app/apartments/new', module: 'apartments-mutate' },
  { prefix: '/app/apartments', contains: '/edit', module: 'apartments-mutate' },
  { prefix: '/app/apartments', module: 'apartments' },
  { prefix: '/app/parties', module: 'parties' },
  { prefix: '/app/payments', module: 'payments' },
  { prefix: '/app/leads', module: 'leads' },
  { prefix: '/app/documents', module: 'documents' },
  { prefix: '/app/settings/team', module: 'team' },
  { prefix: '/app/settings/profile', module: 'profile' },
  { prefix: '/app/settings', module: 'settings' },
  { prefix: '/app/ai-assistant', module: 'assistant' },
  { prefix: '/app', module: 'app-root' },
];

/** Resolve a workspace pathname to its module. Unknown paths fall back to owner dashboard rules. */
export function resolveModule(pathname: string): ModuleKey {
  const path = pathname.split('?')[0].split('#')[0];
  for (const rule of PATH_RULES) {
    if (path === rule.prefix || path.startsWith(rule.prefix + '/')) {
      if (rule.contains && !path.includes(rule.contains)) continue;
      return rule.module;
    }
  }
  return 'dashboard-owner';
}

export function canAccess(role: CompanyRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_MODULES[role].includes(module);
}

/** Sidebar static entries (dashboard entry is dynamic per role) mapped to their modules. */
export const NAV_MODULES: Record<string, ModuleKey> = {
  '/app/projects': 'projects',
  '/app/construction': 'construction',
  '/app/apartments': 'apartments',
  '/app/parties': 'parties',
  '/app/payments': 'payments',
  '/app/leads': 'leads',
  '/app/documents': 'documents',
  '/app/ai-assistant': 'assistant',
};
