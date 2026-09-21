'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import {
  COMPANY_SETUP_ROUTE,
  PLATFORM_HOME,
  getPostLoginRoute,
} from '@/lib/auth/redirect';
import { canAccess, resolveModule, type ModuleKey } from '@/lib/auth/permissions';

export function RequireAuth({ children, redirectTo = '/sign-in' }: { children: ReactNode; redirectTo?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) router.replace(redirectTo);
  }, [isAuthenticated, hasHydrated, redirectTo, router]);

  if (!hasHydrated) return <p className="small" role="status" aria-live="polite">Checking session…</p>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function useSessionLoader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const sessionStatus = useAuthStore((s) => s.sessionStatus);
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    if (sessionStatus === 'ready' || sessionStatus === 'loading') return;
    let cancelled = false;
    fetchSession().catch((err: unknown) => {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 401) {
        logout();
        router.replace('/sign-in');
      } else {
        setError(friendlyMessage(err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, isAuthenticated, sessionStatus, fetchSession, logout, router]);

  const retry = useCallback(() => {
    setError(null);
    fetchSession().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        router.replace('/sign-in');
      } else {
        setError(friendlyMessage(err));
      }
    });
  }, [fetchSession, logout, router]);

  return { isAuthenticated, hasHydrated, sessionStatus, error, retry };
}

function SessionLoading() {
  return <p className="small" role="status" aria-live="polite">Loading workspace…</p>;
}

function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="stack" role="alert">
      <p className="field-error">{message}</p>
      <button className="button secondary" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/**
 * Company workspace gate for /app/*.
 * SUPER_ADMIN belongs in /platform, USER without an active
 * membership belongs in onboarding. Per-role dashboard pages are
 * views linked by tabs; the backend remains the security boundary.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { hasHydrated, isAuthenticated, sessionStatus, error, retry } = useSessionLoader();
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const router = useRouter();

  useEffect(() => {
    if (sessionStatus !== 'ready') return;
    if (platformRole === 'SUPER_ADMIN') router.replace(PLATFORM_HOME);
    else if (platformRole === 'USER' && !companyRole) router.replace(COMPANY_SETUP_ROUTE);
  }, [sessionStatus, platformRole, companyRole, router]);

  if (!hasHydrated || !isAuthenticated) return null;
  if (sessionStatus !== 'ready') {
    if (sessionStatus === 'error' && error) {
      return <SessionError message={error} onRetry={retry} />;
    }
    return <SessionLoading />;
  }
  if (platformRole === 'SUPER_ADMIN') return null;
  if (platformRole === 'USER' && !companyRole) return null;
  return <>{children}</>;
}

/** Platform gate for /platform/*: SUPER_ADMIN only. */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {  const { hasHydrated, isAuthenticated, sessionStatus, error, retry } = useSessionLoader();
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const router = useRouter();

  useEffect(() => {
    if (sessionStatus !== 'ready') return;
    if (platformRole !== 'SUPER_ADMIN') {
      router.replace(getPostLoginRoute(platformRole, companyRole));
    }
  }, [sessionStatus, platformRole, companyRole, router]);

  if (!hasHydrated || !isAuthenticated) return null;
  if (sessionStatus !== 'ready') {
    if (sessionStatus === 'error' && error) {
      return <SessionError message={error} onRetry={retry} />;
    }
    return <SessionLoading />;
  }
  if (platformRole !== 'SUPER_ADMIN') return null;
  return <>{children}</>;
}

/**
 * Reusable permission-key guard. Reads the session from the auth
 * store and redirects to the canonical dashboard when the active
 * company role may not open `module`. Must be rendered inside
 * RequireSession (which guarantees an authenticated company user).
 */
export function RequireCompanyRole({
  module: moduleKey,
  children,
}: {
  module: ModuleKey;
  children: ReactNode;
}) {
  const sessionStatus = useAuthStore((s) => s.sessionStatus);
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const router = useRouter();

  const denied =
    sessionStatus === 'ready' &&
    platformRole === 'USER' &&
    companyRole !== null &&
    !canAccess(companyRole, moduleKey);

  useEffect(() => {
    if (denied) router.replace(getPostLoginRoute(platformRole, companyRole));
  }, [denied, platformRole, companyRole, router]);

  if (sessionStatus !== 'ready') return <SessionLoading />;
  if (denied) return null;
  return <>{children}</>;
}

/**
 * Pathname-driven workspace gate. Resolves the current /app/* route
 * to a module via permissions.ts and bounces unauthorized roles to
 * their canonical dashboard. Mounted once in the workspace layout,
 * so it covers current and future routes without per-page guards.
 */
export function RequireModuleAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sessionStatus = useAuthStore((s) => s.sessionStatus);
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const router = useRouter();

  const moduleKey = resolveModule(pathname);
  const denied =
    sessionStatus === 'ready' &&
    platformRole === 'USER' &&
    companyRole !== null &&
    !canAccess(companyRole, moduleKey);

  useEffect(() => {
    if (denied) router.replace(getPostLoginRoute(platformRole, companyRole));
  }, [denied, platformRole, companyRole, router]);

  // SUPER_ADMIN / membership-less users are handled by RequireSession.
  if (denied) return null;
  return <>{children}</>;
}
