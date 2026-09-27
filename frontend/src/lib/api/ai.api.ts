import { apiJson } from './client';

/**
 * Buildora AI search (verified against backend/app/routers/ai.py,
 * mounted in main.py). Single endpoint, single request per query:
 * - POST /companies/{company_id}/ai/search ({query}, 1..1000 chars)
 * Guard: any active company member; each intent enforces its own
 * module-level role gate server-side (403 AI_INTENT_FORBIDDEN),
 * unsupported intents 422 AI_QUERY_UNSUPPORTED, provider failures
 * 502 AI_PROVIDER_ERROR. No chat history, no streaming, no pagination.
 */

export type AiIntent =
  | 'SEARCH_TASKS'
  | 'SEARCH_PROJECTS'
  | 'SEARCH_APARTMENTS'
  | 'SEARCH_PAYMENTS'
  | 'PROJECT_FINANCIAL_SUMMARY'
  | 'PROJECT_PROGRESS_SUMMARY'
  | 'PAYMENT_SUMMARY'
  | 'TASK_SUMMARY'
  | 'APARTMENT_SUMMARY'
  | 'PROJECT_REPORT'
  | 'UNKNOWN';

export type AiResultRecord = Record<string, unknown>;

export interface ApiAiSearchResponse {
  query: string;
  intent: AiIntent;
  filters?: Record<string, unknown> | null;
  answer: string;
  count: number;
  results: AiResultRecord[];
}

/** Central read helpers: backend serializes Decimals/dates faithfully. */
export function aiText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function aiNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function aiId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** One request per AI query; companyId comes from the auth session. */
export async function searchAI(companyId: string, query: string): Promise<ApiAiSearchResponse> {
  const raw = await apiJson<ApiAiSearchResponse>(`/companies/${companyId}/ai/search`, {
    method: 'POST',
    body: { query: query.trim() },
  });
  return {
    query: raw.query,
    intent: raw.intent,
    filters: (raw.filters as Record<string, unknown> | null) ?? undefined,
    answer: raw.answer,
    count: raw.count ?? 0,
    results: Array.isArray(raw.results) ? raw.results : [],
  };
}
