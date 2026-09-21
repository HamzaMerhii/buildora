import { apiForm, apiJson } from './client';
import type { z } from 'zod';
import type { projectSchema } from '../validations/project.schema';

/**
 * Project endpoints (verified against backend/app/routers/project.py).
 * Base path: /companies/{company_id}/projects — companyId always comes
 * from the Zustand auth session, never hardcoded or user-entered.
 *
 * Only existing backend endpoints are implemented here:
 * - POST   /  (multipart Form, OWNER/PROJECT_MANAGER)
 * - GET    /  (query: status/search/skip/limit, OWNER/PM/SITE_ENGINEER)
 * - GET    /{project_id} (OWNER/PROJECT_MANAGER)
 * - PATCH  /{project_id} (multipart Form partial, OWNER/PROJECT_MANAGER)
 * There is no DELETE project endpoint.
 */

export type BackendProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold';
export type FrontendProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

const TO_BACKEND: Record<FrontendProjectStatus, BackendProjectStatus> = {
  PLANNING: 'planning',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
};

const FROM_BACKEND: Record<BackendProjectStatus, FrontendProjectStatus> = {
  planning: 'PLANNING',
  in_progress: 'IN_PROGRESS',
  on_hold: 'ON_HOLD',
  completed: 'COMPLETED',
};

export function toBackendStatus(status: FrontendProjectStatus): BackendProjectStatus {
  return TO_BACKEND[status];
}

export function fromBackendStatus(status: string): FrontendProjectStatus {
  return (FROM_BACKEND as Record<string, FrontendProjectStatus>)[status] ?? 'PLANNING';
}

/** Raw wire shape: snake_case, Decimal budget serializes as a string. */
export interface BackendProject {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  status: BackendProjectStatus;
  budget: string | number | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped project built only from real backend fields. */
export interface ApiProject {
  id: string;
  companyId: string;
  createdBy: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  budget: number | null;
  status: FrontendProjectStatus;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapProjectResponseToFrontend(p: BackendProject): ApiProject {
  return {
    id: p.id,
    companyId: p.company_id,
    createdBy: p.created_by,
    name: p.name,
    description: p.description ?? undefined,
    location: p.location ?? undefined,
    startDate: p.start_date ?? undefined,
    endDate: p.expected_end_date ?? undefined,
    budget: toNumberOrNull(p.budget),
    status: fromBackendStatus(p.status),
    image: p.image ?? undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export interface ProjectListParams {
  status?: FrontendProjectStatus;
  search?: string;
  skip?: number;
  limit?: number;
}

export async function getProjects(
  companyId: string,
  params: ProjectListParams = {},
): Promise<ApiProject[]> {
  const raw = await apiJson<BackendProject[]>(`/companies/${companyId}/projects/`, {
    query: {
      status: params.status ? toBackendStatus(params.status) : undefined,
      search: params.search?.trim() || undefined,
      skip: params.skip,
      limit: params.limit,
    },
  });
  return raw.map(mapProjectResponseToFrontend);
}

export async function getProject(companyId: string, projectId: string): Promise<ApiProject> {
  const raw = await apiJson<BackendProject>(`/companies/${companyId}/projects/${projectId}`);
  return mapProjectResponseToFrontend(raw);
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  status?: FrontendProjectStatus;
  image?: File;
}

/** Backend create accepts multipart Form only (image upload capable). */
export async function createProject(
  companyId: string,
  input: CreateProjectInput,
): Promise<{ message: string }> {
  const form = new FormData();
  form.set('name', input.name.trim());
  if (input.description?.trim()) form.set('description', input.description.trim());
  if (input.location?.trim()) form.set('location', input.location.trim());
  if (input.startDate) form.set('start_date', input.startDate);
  if (input.endDate) form.set('expected_end_date', input.endDate);
  form.set('status', input.status ? toBackendStatus(input.status) : 'planning');
  if (input.budget !== undefined && input.budget !== '' && input.budget !== null) {
    form.set('budget', String(input.budget));
  }
  if (input.image) form.set('image', input.image);
  return apiForm<{ message: string }>(`/companies/${companyId}/projects/`, form, {
    method: 'POST',
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  status?: FrontendProjectStatus;
  image?: File;
}

/**
 * Backend update accepts multipart FormData (partial PATCH).
 * Only appended fields are applied; blank strings are never sent, so
 * omitted fields keep their existing values. `image` is appended only
 * when the user selected a new file.
 */
export async function updateProject(
  companyId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ApiProject> {
  const form = new FormData();
  if (input.name?.trim()) form.set('name', input.name.trim());
  if (input.description?.trim()) form.set('description', input.description.trim());
  if (input.location?.trim()) form.set('location', input.location.trim());
  if (input.startDate) form.set('start_date', input.startDate);
  if (input.endDate) form.set('expected_end_date', input.endDate);
  if (input.budget !== undefined && input.budget !== '' && input.budget !== null) {
    form.set('budget', String(input.budget));
  }
  if (input.status !== undefined) form.set('status', toBackendStatus(input.status));
  if (input.image) form.set('image', input.image);
  const raw = await apiForm<BackendProject>(`/companies/${companyId}/projects/${projectId}`, form, {
    method: 'PATCH',
  });
  return mapProjectResponseToFrontend(raw);
}

export interface ProjectFormInput {
  name: string;
  description?: string;
  location: string;
  startDate: string;
  endDate: string;
  budget: number | string;
  currency?: string;
  status: FrontendProjectStatus;
  image?: File | FileList;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/**
 * Form → create payload. `currency` is UI-only: the backend has no currency
 * column, so it is dropped here rather than sent. `image` is only appended
 * by createProject when a File is actually supplied.
 */
export function mapProjectFormToCreate(v: ProjectFormInput): CreateProjectInput {
  const rawImage = v.image;
  const image = rawImage instanceof File ? rawImage : rawImage?.[0];
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
    location: cleanText(v.location),
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    budget: v.budget === '' ? undefined : v.budget,
    status: v.status,
    image,
  };
}

/**
 * Form → multipart PATCH payload. Blank optionals are omitted so the
 * backend preserves them (explicit clearing via PATCH is not supported).
 * `image` passes through only when a new file was selected.
 */
export function mapProjectFormToUpdate(v: ProjectFormInput): UpdateProjectInput {
  const rawImage = v.image;
  const image = rawImage instanceof File ? rawImage : rawImage?.[0];
  return {
    name: v.name.trim(),
    description: cleanText(v.description),
    location: cleanText(v.location),
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    budget: v.budget === '' ? undefined : v.budget,
    status: v.status,
    image,
  };
}

/** API project → form values for the edit form (currency has no backend source). */
export function mapApiProjectToFormValues(p: ApiProject): z.input<typeof projectSchema> {
  return {
    name: p.name,
    description: p.description ?? '',
    location: p.location ?? '',
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
    budget: p.budget ?? '',
    currency: 'USD',
    status: p.status,
  };
}
