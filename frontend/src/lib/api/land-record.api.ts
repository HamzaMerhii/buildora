import { apiJson } from './client';
import type { z } from 'zod';
import type { landRecordSchema } from '../validations/project.schema';

/**
 * Land Record endpoints (verified against backend/app/routers/land_record.py).
 * Base path: /companies/{company_id}/projects/{project_id}/land-record/
 * (trailing slash) — companyId comes from the Zustand auth session, projectId
 * from the route UUID.
 *
 * Only existing backend endpoints are implemented here:
 * - GET   /  (require_project_manager: OWNER, PROJECT_MANAGER)
 * - PATCH /  (JSON LandRecordUpdate partial, OWNER/PROJECT_MANAGER)
 * Both return LandRecordResponse. 404 means "Project not found" or
 * "Land record not found". There is no POST or DELETE endpoint: records
 * are auto-created alongside their project.
 */

/** Raw wire shape: snake_case, Decimals serialize as strings. */
export interface BackendLandRecord {
  id: string;
  project_id: string;
  area_sqm: string | number | null;
  parcel_number: string | null;
  max_height_m: string | number | null;
  building_ratio: string | number | null;
  constraints: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped record built only from real backend fields. */
export interface ApiLandRecord {
  id: string;
  projectId: string;
  area?: number;
  parcel?: string;
  maxHeight?: number;
  ratio?: number;
  constraints?: string;
  notes?: string;
}

function toFiniteNumberOrUndefined(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapLandRecordResponseToFrontend(r: BackendLandRecord): ApiLandRecord {
  return {
    id: r.id,
    projectId: r.project_id,
    area: toFiniteNumberOrUndefined(r.area_sqm),
    parcel: r.parcel_number ?? undefined,
    maxHeight: toFiniteNumberOrUndefined(r.max_height_m),
    ratio: toFiniteNumberOrUndefined(r.building_ratio),
    constraints: r.constraints ?? undefined,
    notes: r.notes ?? undefined,
  };
}

/** Backend 422 field names → form field names for error mapping. */
export const LAND_RECORD_FIELD_MAP: Record<
  string,
  'area' | 'parcel' | 'maxHeight' | 'ratio' | 'constraints' | 'notes'
> = {
  area_sqm: 'area',
  parcel_number: 'parcel',
  max_height_m: 'maxHeight',
  building_ratio: 'ratio',
  constraints: 'constraints',
  notes: 'notes',
};

export interface UpdateLandRecordInput {
  area?: number;
  parcel?: string;
  maxHeight?: number;
  ratio?: number;
  constraints?: string;
  notes?: string;
}

export async function getLandRecord(
  companyId: string,
  projectId: string,
): Promise<ApiLandRecord> {
  const raw = await apiJson<BackendLandRecord>(
    `/companies/${companyId}/projects/${projectId}/land-record/`,
  );
  return mapLandRecordResponseToFrontend(raw);
}

/** Backend update accepts a JSON partial (LandRecordUpdate, exclude_unset). */
export async function updateLandRecord(
  companyId: string,
  projectId: string,
  input: UpdateLandRecordInput,
): Promise<ApiLandRecord> {
  const body: Record<string, unknown> = {};
  if (input.area !== undefined) body.area_sqm = input.area;
  if (input.parcel !== undefined) body.parcel_number = input.parcel;
  if (input.maxHeight !== undefined) body.max_height_m = input.maxHeight;
  if (input.ratio !== undefined) body.building_ratio = input.ratio;
  if (input.constraints !== undefined) body.constraints = input.constraints;
  if (input.notes !== undefined) body.notes = input.notes;
  const raw = await apiJson<BackendLandRecord>(
    `/companies/${companyId}/projects/${projectId}/land-record/`,
    { method: 'PATCH', body },
  );
  return mapLandRecordResponseToFrontend(raw);
}

export interface LandRecordFormInput {
  area?: number | string;
  parcel?: string;
  maxHeight?: number | string;
  ratio?: number | string;
  constraints?: string;
  notes?: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Form → PATCH payload. Blank inputs are omitted (never NaN, never ''),
 * so the backend preserves those fields. Explicit clearing via PATCH
 * is not supported — consistent with the project PATCH behavior.
 */
export function mapLandRecordFormToUpdate(v: LandRecordFormInput): UpdateLandRecordInput {
  return {
    area: cleanNumber(v.area),
    parcel: cleanText(v.parcel),
    maxHeight: cleanNumber(v.maxHeight),
    ratio: cleanNumber(v.ratio),
    constraints: cleanText(v.constraints),
    notes: cleanText(v.notes),
  };
}

/** API record → form values (nulls become '' so inputs stay controlled). */
export function mapApiLandRecordToFormValues(r: ApiLandRecord): z.input<typeof landRecordSchema> {
  return {
    area: r.area ?? '',
    parcel: r.parcel ?? '',
    maxHeight: r.maxHeight ?? '',
    ratio: r.ratio ?? '',
    constraints: r.constraints ?? '',
    notes: r.notes ?? '',
  };
}
