import { ApiError, apiForm, apiJson } from './client';
import type { z } from 'zod';
import type { apartmentEditSchema } from '../validations/apartment.schema';

/**
 * Apartment endpoints (verified against backend/app/routers/apartment.py).
 * Base path: /companies/{company_id}/projects/{project_id}
 *             /buildings/{building_id}/floors/{floor_id}/apartments
 * — companyId from the Zustand session, the rest from routes, backend
 * responses, or the hierarchy index below. Never hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here (all
 * require_project_manager = OWNER/PROJECT_MANAGER):
 * - POST   /  (multipart, images[] multi-upload, 409 on duplicate unit)
 * - GET    /  (unit_number ASC, images eager-loaded, no pagination)
 * - GET    /{apartment_id} (images eager-loaded)
 * - PATCH  /{apartment_id} (JSON partial, NO image support)
 * There is NO DELETE, NO public, and NO project/building-level endpoint.
 * UniqueConstraint(floor_id, unit_number) is enforced backend-side.
 */

export type BackendApartmentStatus = 'available' | 'reserved' | 'sold';
export type FrontendApartmentStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';

const TO_BACKEND: Record<FrontendApartmentStatus, BackendApartmentStatus> = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold',
};

const FROM_BACKEND: Record<BackendApartmentStatus, FrontendApartmentStatus> = {
  available: 'AVAILABLE',
  reserved: 'RESERVED',
  sold: 'SOLD',
};

export function toBackendApartmentStatus(status: FrontendApartmentStatus): BackendApartmentStatus {
  return TO_BACKEND[status];
}

export function fromBackendApartmentStatus(status: string): FrontendApartmentStatus {
  return (FROM_BACKEND as Record<string, FrontendApartmentStatus>)[status] ?? 'AVAILABLE';
}

export interface BackendApartmentImage {
  id: string;
  image_url: string;
}

/** Raw wire shape: snake_case, Decimals serialize as strings. */
export interface BackendApartment {
  id: string;
  floor_id: string;
  unit_number: string;
  area_sqm: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: string | number | null;
  status: BackendApartmentStatus;
  is_public: boolean;
  description: string | null;
  images: BackendApartmentImage[];
  created_at: string;
  updated_at: string;
}

export interface ApiApartmentImage {
  id: string;
  url: string;
}

/** Frontend-shaped apartment built only from real backend fields. */
export interface ApiApartment {
  id: string;
  floorId: string;
  number: string;
  description?: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  status: FrontendApartmentStatus;
  isPublic: boolean;
  images: ApiApartmentImage[];
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) ? value : null;
}

export function mapApartmentResponseToFrontend(a: BackendApartment): ApiApartment {
  return {
    id: a.id,
    floorId: a.floor_id,
    number: a.unit_number,
    description: a.description ?? undefined,
    area: toNumberOrNull(a.area_sqm),
    bedrooms: toIntOrNull(a.bedrooms),
    bathrooms: toIntOrNull(a.bathrooms),
    price: toNumberOrNull(a.price),
    status: fromBackendApartmentStatus(a.status),
    isPublic: a.is_public,
    images: (a.images ?? []).map((img) => ({ id: img.id, url: img.image_url })),
  };
}

function apartmentPath(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  apartmentId?: string,
): string {
  const base =
    `/companies/${companyId}/projects/${projectId}` +
    `/buildings/${buildingId}/floors/${floorId}/apartments/`;
  return apartmentId ? `${base}${apartmentId}` : base;
}

/** Floor endpoint page envelope: GET .../floors/{floor_id}/apartments/ */
export interface BackendFloorApartmentsPage {
  items: BackendApartment[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export async function getApartments(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
): Promise<ApiApartment[]> {
  // The floor endpoint is paginated (page_size max 100). Callers expect
  // the complete floor list, so request one full page and unwrap items.
  const raw = await apiJson<BackendFloorApartmentsPage>(
    apartmentPath(companyId, projectId, buildingId, floorId),
    { query: { page: 1, page_size: 100 } },
  );
  return raw.items.map(mapApartmentResponseToFrontend);
}

export async function getApartment(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  apartmentId: string,
): Promise<ApiApartment> {
  const raw = await apiJson<BackendApartment>(
    apartmentPath(companyId, projectId, buildingId, floorId, apartmentId),
  );
  return mapApartmentResponseToFrontend(raw);
}

// ---------------------------------------------------------------------------
// Company-wide paginated management list:
// GET /companies/{company_id}/apartments?page=..&page_size=..
// One request per page — replaces the hierarchy fan-out for the admin
// workspace list. The floor-scoped helpers below are preserved for the
// project page, detail chain resolution, forms, and leads.
// ---------------------------------------------------------------------------

/** Wire shape: ApartmentResponse plus hierarchy context (snake_case). */
export interface BackendCompanyApartment extends BackendApartment {
  project_id: string;
  project_name: string;
  building_id: string;
  building_name: string;
  floor_name: string;
}

export interface BackendCompanyApartmentsPage {
  items: BackendCompanyApartment[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  status_counts: { available: number; reserved: number; sold: number };
}

export interface CompanyApartmentsPage {
  items: ApiApartmentWithParents[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  available: number;
  reserved: number;
  sold: number;
}

export interface CompanyApartmentsQuery {
  page?: number;
  pageSize?: number;
  projectId?: string;
  buildingId?: string;
  status?: FrontendApartmentStatus;
  isPublic?: boolean;
}

/** Bounded full-collection read over the paginated company endpoint. */
export async function getAllCompanyApartments(
  companyId: string,
  query: Omit<CompanyApartmentsQuery, 'page' | 'pageSize'> = {},
): Promise<ApiApartmentWithParents[]> {
  const items: ApiApartmentWithParents[] = [];
  let page = 1;
  for (;;) {
    const response = await getCompanyApartmentsPage(companyId, {
      ...query,
      page,
      pageSize: 100,
    });
    items.push(...response.items);
    if (page >= response.totalPages || response.items.length === 0) break;
    page += 1;
  }
  return items;
}

function mapCompanyApartmentToFrontend(a: BackendCompanyApartment): ApiApartmentWithParents {
  return {
    ...mapApartmentResponseToFrontend(a),
    projectId: a.project_id,
    buildingId: a.building_id,
    projectName: a.project_name,
    buildingName: a.building_name,
    floorName: a.floor_name,
  };
}

export async function getCompanyApartmentsPage(
  companyId: string,
  query: CompanyApartmentsQuery = {},
): Promise<CompanyApartmentsPage> {
  const raw = await apiJson<BackendCompanyApartmentsPage>(
    `/companies/${companyId}/apartments`,
    {
      query: {
        page: query.page ?? 1,
        page_size: query.pageSize ?? 6,
        project_id: query.projectId || undefined,
        building_id: query.buildingId || undefined,
        status: query.status ? toBackendApartmentStatus(query.status) : undefined,
        is_public: query.isPublic,
      },
    },
  );
  return {
    items: raw.items.map(mapCompanyApartmentToFrontend),
    page: raw.page,
    pageSize: raw.page_size,
    total: raw.total,
    totalPages: raw.total_pages,
    available: raw.status_counts.available,
    reserved: raw.status_counts.reserved,
    sold: raw.status_counts.sold,
  };
}

export interface CreateApartmentInput {
  unitNumber: string;
  area?: number | string;
  bedrooms?: number;
  bathrooms?: number;
  price?: number | string;
  status?: FrontendApartmentStatus;
  isPublic?: boolean;
  description?: string;
  images?: File[];
}

/** Backend create accepts multipart Form only (`images` may repeat). */
export async function createApartment(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  input: CreateApartmentInput,
): Promise<ApiApartment> {
  const form = new FormData();
  form.set('unit_number', input.unitNumber.trim());
  if (input.area !== undefined && input.area !== '' && input.area !== null) {
    form.set('area_sqm', String(input.area));
  }
  if (input.bedrooms !== undefined && input.bedrooms !== null) {
    form.set('bedrooms', String(input.bedrooms));
  }
  if (input.bathrooms !== undefined && input.bathrooms !== null) {
    form.set('bathrooms', String(input.bathrooms));
  }
  if (input.price !== undefined && input.price !== '' && input.price !== null) {
    form.set('price', String(input.price));
  }
  form.set('status', input.status ? toBackendApartmentStatus(input.status) : 'available');
  form.set('is_public', String(input.isPublic ?? false));
  if (input.description?.trim()) form.set('description', input.description.trim());
  for (const image of input.images ?? []) form.append('images', image);
  const raw = await apiForm<BackendApartment>(
    apartmentPath(companyId, projectId, buildingId, floorId),
    form,
    { method: 'POST' },
  );
  const created = mapApartmentResponseToFrontend(raw);
  clearApartmentIndex(companyId);
  return created;
}

export interface UpdateApartmentInput {
  unitNumber?: string;
  area?: number | string;
  bedrooms?: number;
  bathrooms?: number;
  price?: number | string;
  status?: FrontendApartmentStatus;
  isPublic?: boolean;
  description?: string;
}

/**
 * Backend update accepts a JSON partial (ApartmentUpdate, exclude_unset).
 * Images are NOT supported on PATCH — there is intentionally no image
 * field here. Blank optionals are omitted (preserved server-side).
 */
export async function updateApartment(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  apartmentId: string,
  input: UpdateApartmentInput,
): Promise<ApiApartment> {
  const body: Record<string, unknown> = {};
  if (input.unitNumber?.trim()) body.unit_number = input.unitNumber.trim();
  if (input.area !== undefined && input.area !== '' && input.area !== null) {
    body.area_sqm = input.area;
  }
  if (input.bedrooms !== undefined && input.bedrooms !== null) body.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined && input.bathrooms !== null) body.bathrooms = input.bathrooms;
  if (input.price !== undefined && input.price !== '' && input.price !== null) {
    body.price = input.price;
  }
  if (input.status !== undefined) body.status = toBackendApartmentStatus(input.status);
  if (input.isPublic !== undefined) body.is_public = input.isPublic;
  if (input.description?.trim()) body.description = input.description.trim();
  const raw = await apiJson<BackendApartment>(
    apartmentPath(companyId, projectId, buildingId, floorId, apartmentId),
    { method: 'PATCH', body },
  );
  const updated = mapApartmentResponseToFrontend(raw);
  clearApartmentIndex(companyId);
  return updated;
}

/**
 * Append images to an existing apartment. Backend accepts multipart with
 * one or more `images` parts and returns the updated ApartmentResponse
 * (all-or-nothing in DB: uploads run before the single commit).
 */
export async function addApartmentImages(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  apartmentId: string,
  files: File[],
): Promise<ApiApartment> {
  const form = new FormData();
  for (const file of files) form.append('images', file);
  const raw = await apiForm<BackendApartment>(
    `${apartmentPath(companyId, projectId, buildingId, floorId, apartmentId)}/images`,
    form,
    { method: 'POST' },
  );
  const updated = mapApartmentResponseToFrontend(raw);
  clearApartmentIndex(companyId);
  return updated;
}

/**
 * Delete one persisted apartment image by its backend image ID.
 * Backend returns 204 with no body and deletes the DB row only
 * (remote ImageKit file is left orphaned — backend limitation).
 */
export async function deleteApartmentImage(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  apartmentId: string,
  imageId: string,
): Promise<void> {
  await apiJson<void>(
    `${apartmentPath(companyId, projectId, buildingId, floorId, apartmentId)}/images/${imageId}`,
    { method: 'DELETE' },
  );
  clearApartmentIndex(companyId);
}

export interface ApartmentFormInput {
  projectId: string;
  buildingId: string;
  floorId: string;
  number: string;
  description?: string;
  area: number | string;
  bedrooms: number;
  bathrooms: number;
  price: number | string;
  status: FrontendApartmentStatus;
  isPublic: boolean;
  images?: FileList;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanDecimal(value: number | string | undefined): number | string | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  return value;
}

/**
 * Form → create payload. `projectId/buildingId/floorId` travel in the URL.
 * Images pass through only when files were actually selected.
 */
export function mapApartmentFormToCreate(v: ApartmentFormInput): CreateApartmentInput {
  return {
    unitNumber: v.number.trim(),
    area: cleanDecimal(v.area),
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    price: cleanDecimal(v.price),
    status: v.status,
    isPublic: v.isPublic,
    description: cleanText(v.description),
    images: v.images?.length ? Array.from(v.images) : undefined,
  };
}

/** Form → JSON PATCH payload. Images can never be sent (unsupported). */
export function mapApartmentFormToUpdate(v: ApartmentFormInput): UpdateApartmentInput {
  return {
    unitNumber: v.number.trim(),
    area: cleanDecimal(v.area),
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    price: cleanDecimal(v.price),
    status: v.status,
    isPublic: v.isPublic,
    description: cleanText(v.description),
  };
}

/** API apartment → form values (images have no form source on edit). */
export function mapApiApartmentToFormValues(
  a: ApiApartment,
  parents: { projectId: string; buildingId: string; floorId: string },
): z.input<typeof apartmentEditSchema> {
  return {
    projectId: parents.projectId,
    buildingId: parents.buildingId,
    floorId: parents.floorId,
    number: a.number,
    description: a.description ?? '',
    area: a.area ?? '',
    bedrooms: a.bedrooms ?? 1,
    bathrooms: a.bathrooms ?? 1,
    price: a.price ?? '',
    status: a.status,
    isPublic: a.isPublic,
  };
}

// ---------------------------------------------------------------------------
// Hierarchy traversal: no global/project/building-level list endpoint
// exists, so company- and project-wide views fan out through the real
// scoped endpoints (projects → buildings → floors → apartments).
// This is N+1 by necessity — a dedicated backend aggregate would
// collapse it. Results are indexed per company and invalidated by the
// mutations above.
// ---------------------------------------------------------------------------

export interface ApiApartmentWithParents extends ApiApartment {
  projectId: string;
  buildingId: string;
  projectName?: string;
  buildingName?: string;
  floorName?: string;
}

/**
 * Shared full-company apartment read. One bounded page walk per
 * company, shared across same-page consumers (list labels, chain
 * resolution, selectors) — sequential walkers cannot share via
 * in-flight dedup alone. Cleared by clearApartmentIndex on mutation.
 */
let sharedApartmentWalk: {
  companyId: string;
  promise: Promise<ApiApartmentWithParents[]>;
} | null = null;

export function clearApartmentIndex(companyId?: string): void {
  if (!companyId || sharedApartmentWalk?.companyId === companyId) {
    sharedApartmentWalk = null;
  }
}

export function sharedCompanyApartments(companyId: string): Promise<ApiApartmentWithParents[]> {
  if (sharedApartmentWalk?.companyId !== companyId) {
    const promise = getAllCompanyApartments(companyId);
    sharedApartmentWalk = { companyId, promise };
    // Rejected walks must not stick: the next caller retries fresh.
    promise.catch(() => {
      if (sharedApartmentWalk?.promise === promise) sharedApartmentWalk = null;
    });
  }
  return sharedApartmentWalk.promise;
}

/** Apartments of one project, via the company endpoint project filter. */
export async function getProjectApartments(
  companyId: string,
  projectId: string,
): Promise<ApiApartmentWithParents[]> {
  return getAllCompanyApartments(companyId, { projectId });
}

export interface ApartmentChain {
  projectId: string;
  buildingId: string;
  floorId: string;
  projectName?: string;
  buildingName?: string;
  floorName?: string;
}

/** Resolve the full hierarchy chain for a flat apartment id. */
export async function resolveApartmentChain(
  companyId: string,
  apartmentId: string,
): Promise<ApiApartmentWithParents> {
  const found = (await sharedCompanyApartments(companyId)).find((a) => a.id === apartmentId);
  if (!found) throw new ApiError(404, 'Apartment not found.');
  return found;
}

/** Fresh single-apartment read: resolve chain, then direct GET. */
export async function getApartmentById(
  companyId: string,
  apartmentId: string,
): Promise<{ apartment: ApiApartment; chain: ApartmentChain }> {
  const chain = await resolveApartmentChain(companyId, apartmentId);
  const apartment = await getApartment(
    companyId,
    chain.projectId,
    chain.buildingId,
    chain.floorId,
    apartmentId,
  );
  return { apartment, chain };
}
