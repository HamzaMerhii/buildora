export const PLATFORM_HOME = '/platform';
export const COMPANY_SETUP_ROUTE = '/company-setup';
export const SIGN_IN_ROUTE = '/sign-in';
export const OWNER_DASHBOARD = '/app/dashboard';
export const ENGINEER_DASHBOARD = '/app/dashboard/engineer';
export const SALES_DASHBOARD = '/app/dashboard/sales';
export const FINANCE_DASHBOARD = '/app/dashboard/finance';

export type NormalizedPlatformRole = 'SUPER_ADMIN' | 'USER';
export type NormalizedCompanyRole =
  | 'OWNER'
  | 'PROJECT_MANAGER'
  | 'SITE_ENGINEER'
  | 'SALES'
  | 'FINANCE'
  | 'OTHER';

const COMPANY_ROUTES: Record<NormalizedCompanyRole, string> = {
  OWNER: OWNER_DASHBOARD,
  // No dedicated /app/dashboard/project-manager page exists;
  // the owner dashboard tab is labeled "Owner / PM".
  PROJECT_MANAGER: OWNER_DASHBOARD,
  SITE_ENGINEER: ENGINEER_DASHBOARD,
  SALES: SALES_DASHBOARD,
  FINANCE: FINANCE_DASHBOARD,
  OTHER: OWNER_DASHBOARD,
};

export function normalizePlatformRole(raw: unknown): NormalizedPlatformRole | null {
  if (typeof raw !== 'string') return null;
  const value = raw.toUpperCase();
  return value === 'SUPER_ADMIN' || value === 'USER' ? value : null;
}

export function normalizeCompanyRole(raw: unknown): NormalizedCompanyRole | null {
  if (typeof raw !== 'string') return null;
  const value = raw.toUpperCase();
  switch (value) {
    case 'OWNER':
    case 'PROJECT_MANAGER':
    case 'SITE_ENGINEER':
    case 'SALES':
    case 'FINANCE':
    case 'OTHER':
      return value;
    default:
      return null;
  }
}

/**
 * Centralized post-login destination.
 * SUPER_ADMIN never checks membership. USER without an active
 * membership goes to onboarding. Unknown roles fall back safely.
 */
export function getPostLoginRoute(
  platformRole: unknown,
  companyRole: unknown,
): string {
  if (normalizePlatformRole(platformRole) === 'SUPER_ADMIN') return PLATFORM_HOME;
  if (normalizePlatformRole(platformRole) !== 'USER') return OWNER_DASHBOARD;
  const company = normalizeCompanyRole(companyRole);
  if (!company) return COMPANY_SETUP_ROUTE;
  return COMPANY_ROUTES[company];
}
