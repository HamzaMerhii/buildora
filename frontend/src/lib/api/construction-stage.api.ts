import { ApiError, apiJson } from './client';
import { getProjects } from './project.api';
import type { z } from 'zod';
import type { stageApiSchema } from '../validations/construction-stage.schema';

/**
 * Construction Stage endpoints (verified against
 * backend/app/routers/construction_stage.py).
 * Base path: /companies/{company_id}/projects/{project_id}/stages
 * — companyId from the Zustand session, projectId from routes, stageId
 * from routes/backend responses. Never hardcoded or mock.
 *
 * Only existing, reachable backend endpoints are implemented here:
 * - POST   /  (JSON create, require_project_manager, order auto-assigned)
 * - GET    /  (order_index ASC, require_company_member = all roles)
 * - PATCH  /{stage_id} (JSON partial, require_project_manager)
 * - DELETE /{stage_id} (204, require_project_manager, cascades tasks)
 * There is NO single-stage GET endpoint.
 *
 * NOTE: PATCH .../stages/reorder is NOT wired here. In the router it is
 * registered AFTER PATCH .../stages/{stage_id}, so FastAPI matches
 * "reorder" as a stage_id first and rejects it as a non-UUID (422).
 * The endpoint is unreachable as written.
 */

export type BackendStageStatus = 'not_started' | 'in_progress' | 'completed';
export type FrontendStageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

const TO_BACKEND: Record<FrontendStageStatus, BackendStageStatus> = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

const FROM_BACKEND: Record<BackendStageStatus, FrontendStageStatus> = {
  not_started: 'NOT_STARTED',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
};

export function toBackendStageStatus(status: FrontendStageStatus): BackendStageStatus {
  return TO_BACKEND[status];
}

export function fromBackendStageStatus(status: string): FrontendStageStatus {
  return (FROM_BACKEND as Record<string, FrontendStageStatus>)[status] ?? 'NOT_STARTED';
}

/** Raw wire shape. Note: backend has no progress/order-input fields. */
export interface BackendStage {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  order_index: number;
  start_date: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped stage built only from real backend fields. */
export interface ApiStage {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  order: number;
  startDate?: string;
  endDate?: string;
  status: FrontendStageStatus;
}

export function mapStageResponseToFrontend(s: BackendStage): ApiStage {
  return {
    id: s.id,
    projectId: s.project_id,
    name: s.name,
    description: s.description ?? undefined,
    order: s.order_index,
    startDate: s.start_date ?? undefined,
    endDate: s.due_date ?? undefined,
    status: fromBackendStageStatus(s.status),
  };
}

export async function getStages(companyId: string, projectId: string): Promise<ApiStage[]> {
  const raw = await apiJson<BackendStage[]>(
    `/companies/${companyId}/projects/${projectId}/stages/`,
  );
  return raw.map(mapStageResponseToFrontend);
}

/**
 * Single-stage read via the existing list endpoint (no GET-by-id
 * endpoint exists). 404 here means "not found in this project" rather
 * than a backend 404 — documented fallback, not a real endpoint.
 */
export async function getStage(
  companyId: string,
  projectId: string,
  stageId: string,
): Promise<ApiStage> {
  const found = (await getStages(companyId, projectId)).find((s) => s.id === stageId);
  if (!found) throw new ApiError(404, 'Stage not found.');
  return found;
}

export interface StageProject {
  id: string;
  name?: string;
}

/**
 * Resolve which project a bare stageId belongs to. Prefers an explicit
 * hint (e.g. ?projectId= links); otherwise traverses the company's
 * projects (bounded by the project list page size). Throws 404 when the
 * stage exists in none of them.
 */
export async function resolveStageProject(
  companyId: string,
  stageId: string,
  hint?: StageProject,
): Promise<{ projectId: string; projectName?: string; stage: ApiStage }> {
  if (hint) {
    try {
      const stage = await getStage(companyId, hint.id, stageId);
      return { projectId: hint.id, projectName: hint.name, stage };
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 422))) throw err;
    }
  }
  const projects = await getProjects(companyId, { limit: 100 });
  for (const p of projects) {
    if (hint && p.id === hint.id) continue;
    try {
      const stage = await getStage(companyId, p.id, stageId);
      return { projectId: p.id, projectName: p.name, stage };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) continue;
      throw err;
    }
  }
  throw new ApiError(404, 'Stage not found.');
}

export interface CreateStageInput {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: FrontendStageStatus;
}

/** Backend create accepts JSON only; order_index is auto-assigned. */
export async function createStage(
  companyId: string,
  projectId: string,
  input: CreateStageInput,
): Promise<ApiStage> {
  const raw = await apiJson<BackendStage>(
    `/companies/${companyId}/projects/${projectId}/stages/`,
    {
      method: 'POST',
      body: {
        name: input.name.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.startDate ? { start_date: input.startDate } : {}),
        ...(input.endDate ? { due_date: input.endDate } : {}),
        status: input.status ? toBackendStageStatus(input.status) : 'not_started',
      },
    },
  );
  return mapStageResponseToFrontend(raw);
}

export interface UpdateStageInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: FrontendStageStatus;
}

/** Backend update accepts a JSON partial (exclude_unset). */
export async function updateStage(
  companyId: string,
  projectId: string,
  stageId: string,
  input: UpdateStageInput,
): Promise<ApiStage> {
  const body: Record<string, unknown> = {};
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.startDate) body.start_date = input.startDate;
  if (input.endDate) body.due_date = input.endDate;
  if (input.status !== undefined) body.status = toBackendStageStatus(input.status);
  const raw = await apiJson<BackendStage>(
    `/companies/${companyId}/projects/${projectId}/stages/${stageId}`,
    { method: 'PATCH', body },
  );
  return mapStageResponseToFrontend(raw);
}

export async function deleteStage(
  companyId: string,
  projectId: string,
  stageId: string,
): Promise<void> {
  await apiJson<void>(`/companies/${companyId}/projects/${projectId}/stages/${stageId}`, {
    method: 'DELETE',
  });
}

export interface StageOrderItem {
  stage_id: string;
  order_index: number;
}

/**
 * Full-list order (0-based, matching backend order_index semantics)
 * mapped to the reorder payload. Callers must pass every stage of the
 * project exactly once — the backend 400s otherwise.
 */
export function mapStageOrderToReorderPayload(
  stages: Array<{ id: string }>,
): { stages: StageOrderItem[] } {
  return {
    stages: stages.map((s, i) => ({ stage_id: s.id, order_index: i })),
  };
}

/**
 * Persist a new stage order. The backend requires the complete stage
 * set and returns the ordered list, which callers must treat as the
 * source of truth.
 */
export async function reorderStages(
  companyId: string,
  projectId: string,
  payload: { stages: StageOrderItem[] },
): Promise<ApiStage[]> {
  const raw = await apiJson<BackendStage[]>(
    `/companies/${companyId}/projects/${projectId}/stages/reorder`,
    { method: 'PATCH', body: payload },
  );
  return raw.map(mapStageResponseToFrontend);
}

export interface StageFormInput {
  projectId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: FrontendStageStatus;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/** Form → create payload. Order is never sent (backend auto-assigns). */
export function mapStageFormToCreate(v: StageFormInput): CreateStageInput {
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    status: v.status,
  };
}

/** Form → PATCH payload. Blanks are omitted (preserved server-side). */
export function mapStageFormToUpdate(v: StageFormInput): UpdateStageInput {
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    status: v.status,
  };
}

/** API stage → form values for the edit form. */
export function mapApiStageToFormValues(
  s: ApiStage,
  projectId: string,
): z.input<typeof stageApiSchema> {
  return {
    projectId,
    name: s.name,
    description: s.description ?? '',
    startDate: s.startDate ?? '',
    endDate: s.endDate ?? '',
    status: s.status,
  };
}
