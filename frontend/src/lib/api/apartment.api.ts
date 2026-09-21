import { ApiError, apiForm, apiJson } from './client';
import type { z } from 'zod';
import type { apartmentEditSchema } from '../validations/apartment.schema';
import { getProjects } from './project.api';
import { getBuildings } from './building.api';
import { getFloors } from './floor.api';

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

export async function getApartments(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
): Promise<ApiApartment[]> {
  const raw = await apiJson<BackendApartment[]>(
    apartmentPath(companyId, projectId, buildingId, floorId),
  );
  return raw.map(mapApartmentResponseToFrontend);
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

let apartmentIndex: { companyId: string; byId: Map<string, ApiApartmentWithParents> } | null =
  null;

export function clearApartmentIndex(companyId?: string): void {
  if (!companyId || apartmentIndex?.companyId === companyId) apartmentIndex = null;
}

function annotate(
  a: ApiApartment,
  parents: { projectId: string; buildingId: string; projectName?: string; buildingName?: string; floorName?: string },
): ApiApartmentWithParents {
  return { ...a, ...parents };
}

/** All apartments in a company, via parallel hierarchy traversal. */
export async function getCompanyApartments(companyId: string): Promise<ApiApartmentWithParents[]> {
  if (apartmentIndex?.companyId === companyId) return [...apartmentIndex.byId.values()];
  const projects = await getProjects(companyId, { limit: 100 });
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const buildings = await getBuildings(companyId, project.id);
      const perBuilding = await Promise.all(
        buildings.map(async (building) => {
          const floors = await getFloors(companyId, project.id, building.id);
          const perFloor = await Promise.all(
            floors.map(async (floor) => {
              const apartments = await getApartments(companyId, project.id, building.id, floor.id);
              return apartments.map((a) =>
                annotate(a, {
                  projectId: project.id,
                  buildingId: building.id,
                  projectName: project.name,
                  buildingName: building.name,
                  floorName: floor.name,
                }),
              );
            }),
          );
          return perFloor.flat();
        }),
      );
      return perBuilding.flat();
    }),
  );
  const all = perProject.flat();
  apartmentIndex = { companyId, byId: new Map(all.map((a) => [a.id, a])) };
  return all;
}

/** Apartments of one project, via parallel traversal of its hierarchy. */
export async function getProjectApartments(
  companyId: string,
  projectId: string,
  projectName?: string,
): Promise<ApiApartmentWithParents[]> {
  const buildings = await getBuildings(companyId, projectId);
  const perBuilding = await Promise.all(
    buildings.map(async (building) => {
      const floors = await getFloors(companyId, projectId, building.id);
      const perFloor = await Promise.all(
        floors.map(async (floor) => {
          const apartments = await getApartments(companyId, projectId, building.id, floor.id);
          return apartments.map((a) =>
            annotate(a, {
              projectId,
              buildingId: building.id,
              projectName,
              buildingName: building.name,
              floorName: floor.name,
            }),
          );
        }),
      );
      return perFloor.flat();
    }),
  );
  return perBuilding.flat();
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
  const cached =
    apartmentIndex?.companyId === companyId ? apartmentIndex.byId.get(apartmentId) : undefined;
  if (cached) return cached;
  const found = (await getCompanyApartments(companyId)).find((a) => a.id === apartmentId);
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
