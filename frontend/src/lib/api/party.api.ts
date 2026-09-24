import { apiJson } from './client';

/**
 * Party endpoints (verified against backend/app/routers/party.py, which
 * is mounted in main.py).
 * Base path: /companies/{company_id}/parties — companyId comes from the
 * Zustand auth session, partyId from routes/backend responses. Never
 * hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here (all JSON,
 * all require_project_manager = OWNER/PROJECT_MANAGER):
 * - POST   /  (201, returns the created PartyResponse incl. id)
 * - GET    /  (full list, created_at desc, no pagination/filter)
 * - GET    /{party_id} (single PartyResponse)
 * - PATCH  /{party_id} (JSON partial, exclude_unset)
 * There is NO DELETE party endpoint.
 *
 * WARNING: at the time of writing, PATCH is broken server-side — the
 * router calls update_party() without importing it (NameError → HTTP
 * 500). The service function itself exists and is correct. Edit flows
 * must surface that failure gracefully until the backend is fixed.
 */

/** Backend party type: WHAT the party is (single enum, no roles). */
export type BackendPartyType = 'contractor' | 'supplier';
export type FrontendPartyType = 'CONTRACTOR' | 'SUPPLIER';

const TO_BACKEND: Record<FrontendPartyType, BackendPartyType> = {
  CONTRACTOR: 'contractor',
  SUPPLIER: 'supplier',
};

const FROM_BACKEND: Record<BackendPartyType, FrontendPartyType> = {
  contractor: 'CONTRACTOR',
  supplier: 'SUPPLIER',
};

export function toBackendPartyType(type: FrontendPartyType): BackendPartyType {
  return TO_BACKEND[type];
}

export function fromBackendPartyType(type: string): FrontendPartyType {
  return (FROM_BACKEND as Record<string, FrontendPartyType>)[type] ?? 'CONTRACTOR';
}

/** Raw wire shape. */
export interface BackendParty {
  id: string;
  name: string;
  type: BackendPartyType;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped party built only from real backend fields. */
export interface ApiParty {
  id: string;
  name: string;
  type: FrontendPartyType;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export function mapPartyResponseToFrontend(p: BackendParty): ApiParty {
  return {
    id: p.id,
    name: p.name,
    type: fromBackendPartyType(p.type),
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    address: p.address ?? undefined,
    notes: p.notes ?? undefined,
  };
}

export async function getParties(companyId: string): Promise<ApiParty[]> {
  const raw = await apiJson<BackendParty[]>(`/companies/${companyId}/parties/`);
  return raw.map(mapPartyResponseToFrontend);
}

export async function getParty(companyId: string, partyId: string): Promise<ApiParty> {
  const raw = await apiJson<BackendParty>(`/companies/${companyId}/parties/${partyId}`);
  return mapPartyResponseToFrontend(raw);
}

export interface CreatePartyInput {
  name: string;
  type: FrontendPartyType;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function createParty(
  companyId: string,
  input: CreatePartyInput,
): Promise<ApiParty> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    type: toBackendPartyType(input.type),
  };
  const email = input.email?.trim();
  if (email) body.email = email;
  if (input.phone?.trim()) body.phone = input.phone.trim();
  if (input.address?.trim()) body.address = input.address.trim();
  if (input.notes?.trim()) body.notes = input.notes.trim();
  const raw = await apiJson<BackendParty>(`/companies/${companyId}/parties/`, {
    method: 'POST',
    body,
  });
  return mapPartyResponseToFrontend(raw);
}

export interface UpdatePartyInput {
  name?: string;
  type?: FrontendPartyType;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function updateParty(
  companyId: string,
  partyId: string,
  input: UpdatePartyInput,
): Promise<ApiParty> {
  const body: Record<string, unknown> = {};
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.type !== undefined) body.type = toBackendPartyType(input.type);
  if (input.email?.trim()) body.email = input.email.trim();
  if (input.phone?.trim()) body.phone = input.phone.trim();
  if (input.address?.trim()) body.address = input.address.trim();
  if (input.notes?.trim()) body.notes = input.notes.trim();
  const raw = await apiJson<BackendParty>(`/companies/${companyId}/parties/${partyId}`, {
    method: 'PATCH',
    body,
  });
  return mapPartyResponseToFrontend(raw);
}

export interface PartyFormInput {
  name: string;
  type: FrontendPartyType;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/** Form → create payload. Blank optionals are omitted. */
export function mapPartyFormToCreate(v: PartyFormInput): CreatePartyInput {
  return {
    name: v.name.trim(),
    type: v.type,
    email: cleanText(v.email),
    phone: cleanText(v.phone),
    address: cleanText(v.address),
    notes: cleanText(v.notes),
  };
}

/**
 * Form → PATCH payload. Blank optionals are omitted (preserved
 * server-side); explicit clearing via PATCH is not supported —
 * consistent with the project/building PATCH behavior.
 */
export function mapPartyFormToUpdate(v: PartyFormInput): UpdatePartyInput {
  return {
    name: v.name.trim(),
    type: v.type,
    email: cleanText(v.email),
    phone: cleanText(v.phone),
    address: cleanText(v.address),
    notes: cleanText(v.notes),
  };
}
