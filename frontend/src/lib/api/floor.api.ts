import { apiJson } from './client';

/**
 * Floor endpoints (verified against backend/app/routers/floor.py).
 * Base path: /companies/{company_id}/projects/{project_id}/buildings/{building_id}/floors
 * — companyId from the Zustand session, projectId/buildingId from the route,
 * floorId from routes/backend responses. Never hardcoded.
 *
 * Only existing backend endpoints are implemented here (all JSON):
 * - POST   /  (201, require_project_manager; 409 on duplicate floor_number)
 * - GET    /  (floor_number ASC, require_company_member = all roles)
 * - GET    /{floor_id} (require_company_member, full hierarchy check)
 * - PATCH  /{floor_id} (partial, require_project_manager; 409 excl. self)
 * There is NO DELETE floor endpoint.
 * UniqueConstraint(building_id, floor_number) is enforced backend-side.
 */

/** Raw wire shape. */
export interface BackendFloor {
  id: string;
  building_id: string;
  name: string | null;
  floor_number: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped floor built only from real backend fields. */
export interface ApiFloor {
  id: string;
  buildingId: string;
  name?: string;
  number: number;
  description?: string;
}

export function mapFloorResponseToFrontend(f: BackendFloor): ApiFloor {
  return {
    id: f.id,
    buildingId: f.building_id,
    name: f.name ?? undefined,
    number: f.floor_number,
    description: f.description ?? undefined,
  };
}

export async function getFloors(
  companyId: string,
  projectId: string,
  buildingId: string,
): Promise<ApiFloor[]> {
  const raw = await apiJson<BackendFloor[]>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}/floors/`,
  );
  return raw.map(mapFloorResponseToFrontend);
}

/**
 * Single-floor read via the real GET-by-id endpoint, which validates
 * the full company → project → building → floor chain server-side
 * (cross-building/project lookups 404 — no weaker client lookup).
 */
export async function getFloor(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
): Promise<ApiFloor> {
  const raw = await apiJson<BackendFloor>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}/floors/${floorId}`,
  );
  return mapFloorResponseToFrontend(raw);
}

export interface CreateFloorInput {
  name?: string;
  number: number;
  description?: string;
}

export async function createFloor(
  companyId: string,
  projectId: string,
  buildingId: string,
  input: CreateFloorInput,
): Promise<ApiFloor> {
  const raw = await apiJson<BackendFloor>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}/floors/`,
    {
      method: 'POST',
      body: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        floor_number: input.number,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      },
    },
  );
  return mapFloorResponseToFrontend(raw);
}

export interface UpdateFloorInput {
  name?: string;
  number?: number;
  description?: string;
}

export async function updateFloor(
  companyId: string,
  projectId: string,
  buildingId: string,
  floorId: string,
  input: UpdateFloorInput,
): Promise<ApiFloor> {
  const body: Record<string, unknown> = {};
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.number !== undefined) body.floor_number = input.number;
  if (input.description?.trim()) body.description = input.description.trim();
  const raw = await apiJson<BackendFloor>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}/floors/${floorId}`,
    { method: 'PATCH', body },
  );
  return mapFloorResponseToFrontend(raw);
}

export interface FloorFormInput {
  name?: string;
  number: number | string;
  description?: string;
  buildingId: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanInt(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

/** Form → create payload. `buildingId` travels in the URL, never the body. */
export function mapFloorFormToCreate(v: FloorFormInput): CreateFloorInput {
  const number = cleanInt(v.number);
  if (number === undefined) throw new Error('A valid whole floor number is required.');
  return {
    name: cleanText(v.name),
    number,
    description: cleanText(v.description),
  };
}

/**
 * Form → PATCH payload. Blank name/description are omitted (preserved
 * server-side); number is always sent (required, prefilled).
 */
export function mapFloorFormToUpdate(v: FloorFormInput): UpdateFloorInput {
  return {
    name: cleanText(v.name),
    number: cleanInt(v.number),
    description: cleanText(v.description),
  };
}

/** API floor → form values. */
export function mapApiFloorToFormValues(f: ApiFloor, buildingId: string): FloorFormInput {
  return {
    name: f.name ?? '',
    number: f.number,
    description: f.description ?? '',
    buildingId,
  };
}
