import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SessionContext } from '@/lib/api/auth.api';
import { normalizeCompanyRole, normalizePlatformRole } from '@/lib/auth/redirect';

const STORAGE_KEY = 'buildora_access_token';

export type PlatformRole = 'SUPER_ADMIN' | 'USER';
export type CompanyRole =
  | 'OWNER'
  | 'PROJECT_MANAGER'
  | 'SITE_ENGINEER'
  | 'SALES'
  | 'FINANCE'
  | 'OTHER';
export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  user: SessionUser | null;
  platformRole: PlatformRole | null;
  companyRole: CompanyRole | null;
  companyId: string | null;
  companyName: string | null;
  sessionStatus: SessionStatus;
  login: (token: string) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
  fetchSession: () => Promise<SessionContext>;
}

const emptySession = {
  user: null as SessionUser | null,
  platformRole: null as PlatformRole | null,
  companyRole: null as CompanyRole | null,
  companyId: null as string | null,
  companyName: null as string | null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      ...emptySession,
      sessionStatus: 'idle' as SessionStatus,
      login: (token: string) =>
        set({
          accessToken: token,
          isAuthenticated: true,
          ...emptySession,
          sessionStatus: 'idle' as SessionStatus,
        }),
      logout: () =>
        set({
          accessToken: null,
          isAuthenticated: false,
          ...emptySession,
          sessionStatus: 'idle' as SessionStatus,
        }),
      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),
      fetchSession: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ sessionStatus: 'error' });
          throw new Error('No access token. Please sign in again.');
        }
        set({ sessionStatus: 'loading' });
        try {
          // Dynamic import: the API client statically imports this store,
          // so a static import back would create a module cycle.
          const { apiJson } = await import('@/lib/api/client');
          const ctx = await apiJson<SessionContext>('/auth/me', {
            method: 'GET',
          });
          // First active membership only: the backend returns active
          // memberships ordered by creation date. No company switcher yet.
          const membership = ctx.memberships[0] ?? null;
          set({
            user: { id: ctx.id, name: ctx.name, email: ctx.email },
            platformRole: normalizePlatformRole(ctx.platform_role),
            companyRole: membership ? normalizeCompanyRole(membership.role) : null,
            companyId: membership?.company_id ?? null,
            companyName: membership?.company_name ?? null,
            sessionStatus: 'ready',
          });
          return ctx;
        } catch (error) {
          const status =
            typeof error === 'object' && error !== null
              ? (error as { status?: unknown }).status
              : undefined;
          if (status === 401) {
            get().logout();
          } else {
            set({ sessionStatus: 'error' });
          }
          throw error;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the token survives reloads; user/session context is
      // re-fetched so guards never act on stale persisted roles.
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (rehydratedState) => {
        rehydratedState?.setHasHydrated(true);
      },
    },
  ),
);

/** Non-hook accessor for use outside React (e.g. the API client). */
export function getStoredAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
