import { apiForm, apiJson } from './client';

/**
 * Company settings endpoints (verified against
 * backend/app/routers/company.py, mounted in main.py).
 * Base path: /companies/{company_id} — companyId comes from the
 * Zustand auth session. Never hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here (all
 * require_company_owner = OWNER only):
 * - GET   /{company_id} (CompanyResponse, 404 unknown company)
 * - PATCH /{company_id} (multipart/form-data partial update:
 *   optional text fields name/email/phone/address plus optional
 *   `logo` file; 404/422; logo stored via ImageKit)
 *
 * Backend field notes (verified in schemas/company.py and
 * services/imagekit_service.py):
 * - Text limits: name 1-200, phone <=30, email <=200, address <=500.
 * - Logo accepts image/jpeg, image/png, image/webp; empty files are
 *   rejected (400); stored with a unique name. No size cap exists
 *   server-side, so none is invented here.
 * - `description` is accepted by the schema but has no model column,
 *   so it is never sent.
 * - KNOWN BACKEND BUG (reported, not fixed here): CompanyUpdate
 *   declares `logo: str` as REQUIRED, but the PATCH router never
 *   passes it — so every PATCH currently fails validation (422)
 *   until the backend makes it optional. Logo field errors are
 *   surfaced at the brand control when present.
 */

/** Raw wire shape. */
export interface BackendCompany {
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

/** Frontend-shaped company built only from real backend fields. */
export interface ApiCompany {
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

export function mapCompanyResponseToFrontend(c: BackendCompany): ApiCompany {
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

export async function getCompany(companyId: string): Promise<ApiCompany> {
  const raw = await apiJson<BackendCompany>(`/companies/${companyId}`);
  return mapCompanyResponseToFrontend(raw);
}

export interface UpdateCompanyInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: File;
}

/** Accepted logo MIME types, mirrored from ALLOWED_IMAGE_MIME_TYPES. */
export const ACCEPTED_COMPANY_LOGO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function isAcceptedCompanyLogo(file: File): boolean {
  return (ACCEPTED_COMPANY_LOGO_MIME_TYPES as readonly string[]).includes(
    (file.type || '').toLowerCase(),
  );
}

/** JSON PATCH payload. Blank optionals are omitted (preserved server-side). */
export function mapCompanyFormToUpdate(v: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}): UpdateCompanyInput {
  const clean = (value: string | undefined): string | undefined => {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
  };
  return {
    name: v.name.trim(),
    email: clean(v.email),
    phone: clean(v.phone),
    address: clean(v.address),
  };
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
): Promise<ApiCompany> {
  // Multipart PATCH: text fields are optional (omitted blanks stay
  // preserved server-side) and `logo` rides along only when a new
  // file was selected. No manual Content-Type (boundary by browser).
  const form = new FormData();
  if (input.name?.trim()) form.set('name', input.name.trim());
  if (input.email !== undefined) form.set('email', input.email);
  if (input.phone !== undefined) form.set('phone', input.phone);
  if (input.address !== undefined) form.set('address', input.address);
  if (input.logo) form.set('logo', input.logo);
  const raw = await apiForm<BackendCompany>(`/companies/${companyId}`, form, {
    method: 'PATCH',
  });
  return mapCompanyResponseToFrontend(raw);
}
