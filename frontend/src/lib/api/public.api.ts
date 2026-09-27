import { apiJson } from './client';

/**
 * Public (anonymous) Buildora API.
 * Verified against backend/app/routers/public.py (mounted in main.py).
 * Every call below passes `auth: false`, so no Zustand token, session,
 * or membership is required. The shared client only attaches a Bearer
 * header when `auth` is not false, so these work with no token at all.
 */

export interface PublicCompanySummary {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  apartment_count: number;
}

export interface PublicCompanyApartment {
  id: string;
  unit_number: string;
  price: string | number | null;
  area_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  project_id: string;
  project_name: string;
  primary_image: string | null;
}

export interface PublicCompanyDetails extends PublicCompanySummary {
  project_count: number;
  building_count: number;
  available_apartments: PublicCompanyApartment[];
}

export interface PublicApartmentListItem {
  id: string;
  unit_number: string;
  price: string | number | null;
  area_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  floor_number: number;
  project_id: string;
  project_name: string;
  project_location?: string | null;
  company_id: string;
  company_name: string;
  company_logo?: string | null;
  primary_image: string | null;
}

export interface PublicApartmentImage {
  id: string;
  image_url: string;
}

export interface PublicApartmentDetails {
  id: string;
  unit_number: string;
  description: string | null;
  price: string | number | null;
  area_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  floor_id: string;
  floor_number: number;
  building_id: string;
  building_name: string | null;
  project_id: string;
  project_name: string;
  project_location: string | null;
  company_id: string;
  company_name: string;
  company_logo: string | null;
  images: PublicApartmentImage[];
}

export interface PublicInterestPayload {
  name: string;
  phone: string;
  email?: string;
  message?: string;
}

export interface PublicInterestResult {
  message: string;
}

export async function getPublicCompanies(): Promise<PublicCompanySummary[]> {
  return apiJson<PublicCompanySummary[]>('/public/companies', {
    method: 'GET',
    auth: false,
  });
}

export async function getPublicCompany(companyId: string): Promise<PublicCompanyDetails> {
  return apiJson<PublicCompanyDetails>(`/public/companies/${companyId}`, {
    method: 'GET',
    auth: false,
  });
}

/**
 * Paginated public apartment list.
 * Verified against backend/app/routers/public.py + schemas/public.py:
 * query params are `company_id?`, `page` (default 1, ge 1),
 * `page_size` (default 9, 1-100). No `status` param exists.
 */
export interface PublicApartmentsPage {
  items: PublicApartmentListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export async function getPublicApartments(params?: {
  company_id?: string;
  page?: number;
  page_size?: number;
}): Promise<PublicApartmentsPage> {
  return apiJson<PublicApartmentsPage>('/public/apartments', {
    method: 'GET',
    auth: false,
    query: {
      company_id: params?.company_id,
      page: params?.page,
      page_size: params?.page_size,
    },
  });
}

/**
 * Collects the complete public apartment set by walking backend pages.
 * The backend transport page size caps at 100. Use only where the full
 * set is genuinely required (status filtering, local search, full
 * company grids) — the backend has no `status` filter, so filtering a
 * single page locally would silently drop matches on other pages.
 */
const PUBLIC_APARTMENTS_TRANSPORT_PAGE_SIZE = 100;

export async function getAllPublicApartments(params?: {
  company_id?: string;
}): Promise<PublicApartmentListItem[]> {
  const items: PublicApartmentListItem[] = [];
  let page = 1;
  for (;;) {
    const response = await getPublicApartments({
      ...params,
      page,
      page_size: PUBLIC_APARTMENTS_TRANSPORT_PAGE_SIZE,
    });
    items.push(...response.items);
    if (page >= response.total_pages || response.items.length === 0) break;
    page += 1;
  }
  return items;
}

export async function getPublicApartment(apartmentId: string): Promise<PublicApartmentDetails> {
  return apiJson<PublicApartmentDetails>(`/public/apartments/${apartmentId}`, {
    method: 'GET',
    auth: false,
  });
}

export type PublicAIIntent = 'APARTMENT_SEARCH' | 'UNKNOWN';

export interface PublicAIFilters {
  location?: string | null;
  company_name?: string | null;
  project_name?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  min_area?: number | null;
  max_area?: number | null;
}

export interface PublicAIResult {
  id: string;
  unit_number: string;
  price: number | null;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  image: string | null;
  project_id: string;
  project_name: string;
  company_id: string;
  company_name: string;
  location: string | null;
}

export interface PublicAISearchResponse {
  query: string;
  intent: PublicAIIntent;
  filters: PublicAIFilters | null;
  answer: string;
  count: number;
  results: PublicAIResult[];
}

/**
 * Anonymous natural-language apartment search.
 * Sends ONLY { query }. No company/project/user IDs, no roles, no token.
 */
export async function searchPublicAI(query: string): Promise<PublicAISearchResponse> {
  return apiJson<PublicAISearchResponse>('/public/ai/search', {
    method: 'POST',
    auth: false,
    body: { query: query.trim() },
  });
}

export async function submitPublicApartmentInterest(
  apartmentId: string,
  payload: PublicInterestPayload,
): Promise<PublicInterestResult> {
  return apiJson<PublicInterestResult>(`/public/apartments/${apartmentId}/interest`, {
    method: 'POST',
    auth: false,
    body: {
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
      ...(payload.message?.trim() ? { message: payload.message.trim() } : {}),
    },
  });
}

/** Display title derived from the real unit number. No marketing names. */
export function apartmentDisplayName(unitNumber: string): string {
  const unit = unitNumber.trim();
  return unit.toLowerCase().startsWith('unit ') ? unit : `Unit ${unit}`;
}

/** Backend decimals may arrive as strings ("240856.00") or numbers. */
export function formatApartmentPrice(price: string | number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  const numeric = typeof price === 'number' ? price : Number(String(price).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatApartmentArea(area: string | number | null | undefined): string | null {
  if (area === null || area === undefined) return null;
  const text = String(area).trim();
  if (!text) return null;
  return /m²|sqm/i.test(text) ? text : `${text} m²`;
}

/** Backend statuses are lowercase ("available"); UI labels are capitalized. */
export function formatApartmentStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function isSoldStatus(status: string): boolean {
  return status.trim().toLowerCase() === 'sold';
}
