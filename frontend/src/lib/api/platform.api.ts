import { apiJson } from './client';

/**
 * Platform endpoints (verified against backend/app/routers/platform.py,
 * mounted in main.py). All require SUPER_ADMIN (platform_role only —
 * no company membership involved).
 *
 * Only existing backend endpoints are implemented here:
 * - GET   /platform/companies (all companies, created_at DESC,
 *   no search/filter/pagination)
 * - GET   /platform/companies/{company_id} (same fields plus a
 *   `description` key that is always null — no such DB column —
 *   so it is typed and then ignored)
 * - PATCH /platform/companies/{company_id} ({is_active?} only)
 * - GET   /platform/users (non-deleted users, created_at DESC,
 *   no search/filter/pagination)
 * - PATCH /platform/users/{user_id} ({is_active?} only)
 * There is NO platform_role update, NO member roster, and NO delete.
 * Canonical URLs carry no trailing slash (backend 307-redirects them).
 */

export type BackendPlatformRole = 'user' | 'super_admin';
export type FrontendPlatformRole = 'USER' | 'SUPER_ADMIN';

export function fromBackendPlatformRole(role: string): FrontendPlatformRole {
  return role === 'super_admin' ? 'SUPER_ADMIN' : 'USER';
}

export const PLATFORM_ROLE_LABEL: Record<FrontendPlatformRole, string> = {
  USER: 'User',
  SUPER_ADMIN: 'Super Admin',
};

/** Raw wire shape for GET /platform/companies. */
export interface BackendPlatformCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Raw wire shape for GET /platform/companies/{company_id}. */
export interface BackendPlatformCompanyDetails extends BackendPlatformCompany {
  description: string | null;
}

/** Raw wire shape for GET /platform/users. */
export interface BackendPlatformUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  platform_role: BackendPlatformRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped company built only from real backend fields. */
export interface ApiPlatformCompany {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Frontend-shaped user built only from real backend fields. */
export interface ApiPlatformUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  platformRole: FrontendPlatformRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapPlatformCompanyToFrontend(c: BackendPlatformCompany): ApiPlatformCompany {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    logo: c.logo ?? undefined,
    isActive: c.is_active,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export function mapPlatformUserToFrontend(u: BackendPlatformUser): ApiPlatformUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? undefined,
    platformRole: fromBackendPlatformRole(u.platform_role),
    isActive: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

/** Status form value → company PATCH input (is_active only). */
export function mapPlatformCompanyStatusToUpdate(isActive: boolean): { is_active: boolean } {
  return { is_active: isActive };
}

/** Status form value → user PATCH input (is_active only, never platform_role). */
export function mapPlatformUserStatusToUpdate(isActive: boolean): { is_active: boolean } {
  return { is_active: isActive };
}

/** All companies, newest first (backend order preserved). */
export async function getPlatformCompanies(): Promise<ApiPlatformCompany[]> {
  const raw = await apiJson<BackendPlatformCompany[]>('/platform/companies');
  return raw.map(mapPlatformCompanyToFrontend);
}

export async function getPlatformCompany(companyId: string): Promise<ApiPlatformCompany> {
  const raw = await apiJson<BackendPlatformCompanyDetails>(`/platform/companies/${companyId}`);
  return mapPlatformCompanyToFrontend(raw);
}

export async function updatePlatformCompanyStatus(
  companyId: string,
  isActive: boolean,
): Promise<ApiPlatformCompany> {
  const raw = await apiJson<BackendPlatformCompanyDetails>(
    `/platform/companies/${companyId}`,
    { method: 'PATCH', body: mapPlatformCompanyStatusToUpdate(isActive) },
  );
  return mapPlatformCompanyToFrontend(raw);
}

/** All non-deleted users, newest first (backend order preserved). */
export async function getPlatformUsers(): Promise<ApiPlatformUser[]> {
  const raw = await apiJson<BackendPlatformUser[]>('/platform/users');
  return raw.map(mapPlatformUserToFrontend);
}

export async function updatePlatformUserStatus(
  userId: string,
  isActive: boolean,
): Promise<ApiPlatformUser> {
  const raw = await apiJson<BackendPlatformUser>(`/platform/users/${userId}`, {
    method: 'PATCH',
    body: mapPlatformUserStatusToUpdate(isActive),
  });
  return mapPlatformUserToFrontend(raw);
}
