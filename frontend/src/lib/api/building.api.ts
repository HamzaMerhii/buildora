import { apiJson } from './client';

/**
 * Building endpoints (verified against backend/app/routers/building.py).
 * Base path: /companies/{company_id}/projects/{project_id}/buildings
 * — companyId comes from the Zustand auth session, projectId from the
 * route, buildingId from route/backend responses. Never hardcoded.
 *
 * Only existing backend endpoints are implemented here (all JSON,
 * all require_project_manager = OWNER/PROJECT_MANAGER):
 * - POST   /  (201, returns the created BuildingResponse incl. id)
 * - GET    /  (ordered newest-first, no pagination)
 * - GET    /{building_id} (single BuildingResponse)
 * - PATCH  /{building_id} (JSON partial, exclude_unset)
 * There is NO DELETE building endpoint.
 */

/** Raw wire shape. */
export interface BackendBuilding {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped building built only from real backend fields. */
export interface ApiBuilding {
  id: string;
  projectId: string;
  name: string;
  description?: string;
}

export function mapBuildingResponseToFrontend(b: BackendBuilding): ApiBuilding {
  return {
    id: b.id,
    projectId: b.project_id,
    name: b.name,
    description: b.description ?? undefined,
  };
}

export async function getBuildings(
  companyId: string,
  projectId: string,
): Promise<ApiBuilding[]> {
  const raw = await apiJson<BackendBuilding[]>(
    `/companies/${companyId}/projects/${projectId}/buildings/`,
  );
  return raw.map(mapBuildingResponseToFrontend);
}

/**
 * Single-building read via the real GET-by-id endpoint.
 * 404 means the project or the building (in this project) was not found.
 */
export async function getBuilding(
  companyId: string,
  projectId: string,
  buildingId: string,
): Promise<ApiBuilding> {
  const raw = await apiJson<BackendBuilding>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}`,
  );
  return mapBuildingResponseToFrontend(raw);
}

export interface CreateBuildingInput {
  name: string;
  description?: string;
}

export async function createBuilding(
  companyId: string,
  projectId: string,
  input: CreateBuildingInput,
): Promise<ApiBuilding> {
  const raw = await apiJson<BackendBuilding>(
    `/companies/${companyId}/projects/${projectId}/buildings/`,
    {
      method: 'POST',
      body: {
        name: input.name.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      },
    },
  );
  return mapBuildingResponseToFrontend(raw);
}

export interface UpdateBuildingInput {
  name?: string;
  description?: string;
}

export async function updateBuilding(
  companyId: string,
  projectId: string,
  buildingId: string,
  input: UpdateBuildingInput,
): Promise<ApiBuilding> {
  const body: Record<string, unknown> = {};
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.description?.trim()) body.description = input.description.trim();
  const raw = await apiJson<BackendBuilding>(
    `/companies/${companyId}/projects/${projectId}/buildings/${buildingId}`,
    { method: 'PATCH', body },
  );
  return mapBuildingResponseToFrontend(raw);
}

export interface BuildingFormInput {
  name: string;
  description?: string;
  projectId: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/** Form → create payload. `projectId` travels in the URL, never the body. */
export function mapBuildingFormToCreate(v: BuildingFormInput): CreateBuildingInput {
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
  };
}

/**
 * Form → PATCH payload. Blank description is omitted (preserved
 * server-side); explicit clearing via PATCH is not supported —
 * consistent with the project/land PATCH behavior.
 */
export function mapBuildingFormToUpdate(v: BuildingFormInput): UpdateBuildingInput {
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
  };
}

/** API building → form values. */
export function mapApiBuildingToFormValues(
  b: ApiBuilding,
  projectId: string,
): BuildingFormInput {
  return {
    name: b.name,
    description: b.description ?? '',
    projectId,
  };
}
