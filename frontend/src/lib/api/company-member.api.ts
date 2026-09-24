import { apiJson } from './client';
import { normalizeCompanyRole, type NormalizedCompanyRole } from '@/lib/auth/redirect';

export type { NormalizedCompanyRole as CompanyMemberRole };

/** Central user-friendly labels for company roles (single source). */
export const companyRoleLabel: Record<NormalizedCompanyRole, string> = {
  OWNER: 'Owner',
  PROJECT_MANAGER: 'Project Manager',
  SITE_ENGINEER: 'Site Engineer',
  SALES: 'Sales',
  FINANCE: 'Finance',
  OTHER: 'Other',
};

/**
 * Company member endpoints (verified against
 * backend/app/routers/company.py, which is mounted in main.py).
 * Base path: /companies/{company_id}/members — companyId comes from the
 * Zustand auth session. Never hardcoded or mock.
 *
 * Existing backend endpoints implemented here (all JSON, all
 * require_company_owner = OWNER only):
 * - GET   /  (active memberships only, created_at ASC)
 * - POST  /  (JSON {name, email, phone, password, role}, 201;
 *   creates the User and the membership atomically; duplicate
 *   email/phone 409; validation errors 422)
 * - PATCH /{membership_id} (JSON {role?, is_active?}, 400 on empty
 *   payload; blocks self-deactivation and self-demotion from OWNER)
 * There is NO DELETE membership endpoint — deactivation is PATCH
 * is_active=false only.
 *
 * IMPORTANT PERMISSION NOTE: task reads allow any company member and
 * task mutations allow OWNER/PROJECT_MANAGER/SITE_ENGINEER, but these
 * member endpoints require OWNER. Non-owner roles receive HTTP 403,
 * so surfaces must degrade gracefully instead of showing broken UI.
 *
 * Response shape is nested (verified in schemas/company.py): each
 * record carries its membership `id` (never sent to other APIs),
 * `user_id` (the real User UUID), `role`, `is_active`, plus an
 * embedded `user` object with display fields (name/email/phone).
 * The member mapper tolerates a missing `user` object for
 * backward compatibility.
 */

/** Backend company role: lowercase wire values (no OTHER on backend). */
export type BackendCompanyRole =
  | 'owner'
  | 'project_manager'
  | 'site_engineer'
  | 'sales'
  | 'finance';

export function fromBackendCompanyRole(role: string): NormalizedCompanyRole {
  return normalizeCompanyRole(role) ?? 'OTHER';
}

/** Embedded user object, present only on older backend responses. */
export interface BackendMemberUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

/** Raw wire shape. `id` is the membership UUID, NOT the user. */
export interface BackendCompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  role: BackendCompanyRole;
  is_active: boolean;
  user?: BackendMemberUser;
}

/** Frontend-shaped member built only from real backend fields. */
export interface ApiCompanyMember {
  /** Membership UUID (display/tracking only, never an assignee value). */
  membershipId: string;
  /** Real User UUID — the only value valid for task `assigned_to`. */
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: NormalizedCompanyRole;
  isActive: boolean;
}

export function mapCompanyMemberResponseToFrontend(m: BackendCompanyMember): ApiCompanyMember {
  return {
    membershipId: m.id,
    userId: m.user_id,
    // The current member response carries no nested user object, so
    // names resolve only for the session user (via the auth store);
    // anything else keeps an honest UUID-derived label.
    name: m.user?.name ?? `Team member ${m.user_id.slice(0, 8)}`,
    email: m.user?.email ?? undefined,
    phone: m.user?.phone ?? undefined,
    role: fromBackendCompanyRole(m.role),
    isActive: m.is_active,
  };
}

/** Active members ordered oldest-first (backend created_at ASC). */
export async function getCompanyMembers(companyId: string): Promise<ApiCompanyMember[]> {
  const raw = await apiJson<BackendCompanyMember[]>(`/companies/${companyId}/members/`);
  return raw.map(mapCompanyMemberResponseToFrontend);
}

/** Active members only (defensive: backend already filters is_active). */
export function activeMembers(members: ApiCompanyMember[]): ApiCompanyMember[] {
  return members.filter((m) => m.isActive);
}

/** Lookup by real User UUID for O(1) assignee resolution in lists. */
export function buildMembersByUserId(
  members: ApiCompanyMember[],
): Map<string, ApiCompanyMember> {
  return new Map(members.map((m) => [m.userId, m]));
}

export type BackendMemberRole = BackendCompanyRole;

/** Roles offerable when creating a member (backend CompanyRole, no OTHER). */
export const MEMBER_CREATE_ROLES = [
  'OWNER',
  'PROJECT_MANAGER',
  'SITE_ENGINEER',
  'SALES',
  'FINANCE',
] as const;
export type MemberCreateRole = (typeof MEMBER_CREATE_ROLES)[number];

export interface AddCompanyMemberInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: MemberCreateRole;
}

const MEMBER_ROLE_WIRE: Record<MemberCreateRole, string> = {
  OWNER: 'owner',
  PROJECT_MANAGER: 'project_manager',
  SITE_ENGINEER: 'site_engineer',
  SALES: 'sales',
  FINANCE: 'finance',
};

function toBackendMemberRole(role: MemberCreateRole | NormalizedCompanyRole): string {
  return (MEMBER_ROLE_WIRE as Record<string, string>)[role] ?? 'other';
}

/**
 * Form → create payload. confirmPassword is frontend-only and never
 * sent; platform role and active state are backend-owned defaults.
 */
export function mapCompanyMemberFormToCreatePayload(v: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: MemberCreateRole;
}): { name: string; email: string; phone: string; password: string; role: string } {
  return {
    name: v.name.trim(),
    email: v.email.trim(),
    phone: v.phone.trim(),
    password: v.password,
    role: toBackendMemberRole(v.role),
  };
}

/**
 * Create a new User + CompanyMembership in one backend call (201).
 * The backend hashes the password, forces platform USER and active
 * states. Duplicate email/phone 409; validation errors 422.
 */
export async function addCompanyMember(
  companyId: string,
  input: AddCompanyMemberInput,
): Promise<ApiCompanyMember> {
  const raw = await apiJson<BackendCompanyMember>(`/companies/${companyId}/members`, {
    method: 'POST',
    body: mapCompanyMemberFormToCreatePayload(input),
  });
  return mapCompanyMemberResponseToFrontend(raw);
}

export interface UpdateCompanyMembershipInput {
  role?: NormalizedCompanyRole;
  isActive?: boolean;
}

/**
 * PATCH role and/or active state. Deactivation is PATCH-only
 * (is_active=false); there is no DELETE endpoint. The backend blocks
 * self-deactivation and self-demotion from OWNER (400).
 */
export async function updateCompanyMembership(
  companyId: string,
  membershipId: string,
  input: UpdateCompanyMembershipInput,
): Promise<ApiCompanyMember> {
  const body: Record<string, unknown> = {};
  if (input.role !== undefined) body.role = toBackendMemberRole(input.role);
  if (input.isActive !== undefined) body.is_active = input.isActive;
  const raw = await apiJson<BackendCompanyMember>(
    `/companies/${companyId}/members/${membershipId}`,
    { method: 'PATCH', body },
  );
  return mapCompanyMemberResponseToFrontend(raw);
}
