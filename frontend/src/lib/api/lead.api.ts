import { ApiError, apiJson } from './client';
import { getCompanyApartments } from './apartment.api';

/**
 * Lead endpoints (verified against backend/app/routers/lead.py,
 * mounted in main.py). All require_sales = OWNER/SALES, all JSON.
 *
 * Only existing backend endpoints are implemented here:
 * - POST   /  (201, full hierarchy validated, status defaults to new)
 * - GET    /  (company join Apartment→Floor→Building→Project,
 *   created_at DESC, no pagination/filter)
 * - GET    /{lead_id} (company-scoped check)
 * - PATCH  /{lead_id} ({status?, message?}, no transition rules)
 * There is NO DELETE, NO search/filter, NO public route, and NO
 * notes/assignee/source fields anywhere.
 *
 * URL quirk: the router prefix still carries the full hierarchy
 * (company/project/building/floor/apartment), but the list/detail/PATCH
 * handlers only use company_id (+lead_id) — the extra segments are inert
 * for those operations (verified in backend/app/services/lead_service.py).
 * They are resolved truthfully from the cached company apartment index
 * whenever the caller may read apartments (OWNER/PROJECT_MANAGER).
 * SALES cannot read project/apartment endpoints backend-side, so when the
 * index is unreadable (403/404) list/detail/PATCH fall back to inert
 * placeholder segments — never fanned out per project, never per lead.
 * POST validates the full hierarchy truthfully, so createLead takes an
 * explicit real chain with no placeholder fallback.
 */

export type BackendLeadStatus = 'new' | 'contacted' | 'closed';
export type FrontendLeadStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

const TO_BACKEND: Record<FrontendLeadStatus, BackendLeadStatus> = {
  NEW: 'new',
  CONTACTED: 'contacted',
  CLOSED: 'closed',
};

const FROM_BACKEND: Record<BackendLeadStatus, FrontendLeadStatus> = {
  new: 'NEW',
  contacted: 'CONTACTED',
  closed: 'CLOSED',
};

export function toBackendLeadStatus(status: FrontendLeadStatus): BackendLeadStatus {
  return TO_BACKEND[status];
}

export function fromBackendLeadStatus(status: string): FrontendLeadStatus {
  return (FROM_BACKEND as Record<string, FrontendLeadStatus>)[status] ?? 'NEW';
}

export const LEAD_STATUS_LABEL: Record<FrontendLeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
};

/** Raw wire shape. */
export interface BackendLead {
  id: string;
  apartment_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: BackendLeadStatus;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped lead built only from real backend fields. */
export interface ApiLead {
  id: string;
  apartmentId: string;
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  status: FrontendLeadStatus;
  createdAt: string;
  updatedAt: string;
}

export function mapLeadResponseToFrontend(l: BackendLead): ApiLead {
  return {
    id: l.id,
    apartmentId: l.apartment_id,
    name: l.name,
    phone: l.phone ?? undefined,
    email: l.email ?? undefined,
    message: l.message ?? undefined,
    status: fromBackendLeadStatus(l.status),
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

export interface LeadChain {
  projectId: string;
  buildingId: string;
  floorId: string;
  apartmentId: string;
}

function leadPath(chain: LeadChain, companyId: string, leadId?: string): string {
  const base =
    `/companies/${companyId}/projects/${chain.projectId}` +
    `/buildings/${chain.buildingId}/floors/${chain.floorId}` +
    `/apartments/${chain.apartmentId}/leads/`;
  return leadId ? `${base}${leadId}` : base;
}

/**
 * Inert hierarchy segments for list/detail/PATCH, used only when the
 * caller cannot read the apartment index (SALES). The backend ignores
 * these segments for those operations — company scoping comes from
 * company_id (+lead_id). Never used for POST.
 */
const PLACEHOLDER_SEGMENT = '00000000-0000-0000-0000-000000000000';

export function placeholderLeadChain(apartmentId?: string): LeadChain {
  return {
    projectId: PLACEHOLDER_SEGMENT,
    buildingId: PLACEHOLDER_SEGMENT,
    floorId: PLACEHOLDER_SEGMENT,
    apartmentId: apartmentId ?? PLACEHOLDER_SEGMENT,
  };
}

/**
 * A real hierarchy chain for URL building, taken from the cached
 * company apartment index. Falls back to inert placeholder segments
 * when the index is unreadable (SALES has no apartment read access).
 * Auth failures (401) and transport errors are rethrown so session
 * handling downstream keeps working.
 */
export async function resolveLeadChain(
  companyId: string,
  apartmentId?: string,
): Promise<LeadChain> {
  try {
    const apartments = await getCompanyApartments(companyId);
    const found = apartmentId
      ? apartments.find((a) => a.id === apartmentId)
      : apartments[0];
    if (!found) {
      throw new ApiError(404, 'No apartment context available.');
    }
    return {
      projectId: found.projectId,
      buildingId: found.buildingId,
      floorId: found.floorId,
      apartmentId: found.id,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      return placeholderLeadChain(apartmentId);
    }
    throw err;
  }
}

/** Company lead list: one request, no project fan-out. */
export async function getCompanyLeads(companyId: string): Promise<ApiLead[]> {
  const chain = await resolveLeadChain(companyId);
  const raw = await apiJson<BackendLead[]>(leadPath(chain, companyId));
  return raw.map(mapLeadResponseToFrontend);
}

export async function getLead(
  companyId: string,
  leadId: string,
  hint?: Partial<LeadChain>,
): Promise<{ lead: ApiLead; chain: LeadChain }> {
  let chain: LeadChain;
  if (hint?.projectId && hint?.buildingId && hint?.floorId && hint?.apartmentId) {
    chain = {
      projectId: hint.projectId,
      buildingId: hint.buildingId,
      floorId: hint.floorId,
      apartmentId: hint.apartmentId,
    };
  } else {
    const found = (await getCompanyLeads(companyId)).find((l) => l.id === leadId);
    if (!found) throw new ApiError(404, 'Lead not found.');
    chain = await resolveLeadChain(companyId, found.apartmentId);
  }
  const raw = await apiJson<BackendLead>(leadPath(chain, companyId, leadId));
  return { lead: mapLeadResponseToFrontend(raw), chain };
}

export interface UpdateLeadInput {
  status?: FrontendLeadStatus;
  message?: string;
}

/** Status form values → PATCH input (status always sent). */
export function mapLeadStatusFormToUpdate(v: { status: FrontendLeadStatus }): UpdateLeadInput {
  return { status: v.status };
}

/**
 * Message form values → PATCH input. Blank messages are omitted
 * (preserved server-side), matching the other modules' convention.
 */
export function mapLeadMessageFormToUpdate(v: { message?: string }): UpdateLeadInput {
  const message = v.message?.trim();
  return message ? { message } : {};
}

export async function updateLead(
  companyId: string,
  chain: LeadChain,
  leadId: string,
  input: UpdateLeadInput,
): Promise<ApiLead> {
  const body: Record<string, unknown> = {};
  if (input.status !== undefined) body.status = toBackendLeadStatus(input.status);
  if (input.message !== undefined) body.message = input.message;
  const raw = await apiJson<BackendLead>(leadPath(chain, companyId, leadId), {
    method: 'PATCH',
    body,
  });
  return mapLeadResponseToFrontend(raw);
}

export interface CreateLeadInput {
  name: string;
  phone?: string;
  email?: string;
  message?: string;
}

export async function createLead(
  companyId: string,
  chain: LeadChain,
  input: CreateLeadInput,
): Promise<ApiLead> {
  const raw = await apiJson<BackendLead>(leadPath(chain, companyId), {
    method: 'POST',
    body: {
      name: input.name.trim(),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      ...(input.message?.trim() ? { message: input.message.trim() } : {}),
    },
  });
  return mapLeadResponseToFrontend(raw);
}
