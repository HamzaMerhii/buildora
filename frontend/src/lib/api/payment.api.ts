import { ApiError, apiArrayBuffer, apiJson } from './client';
import { getProjects } from './project.api';

/**
 * Payment endpoints (verified against backend/app/routers/payment.py,
 * which is mounted in main.py).
 * Base path: /companies/{company_id}/projects/{project_id}/payments —
 * companyId from the Zustand session, projectId from routes/backend
 * responses, or the hierarchy index below. Never hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here (all JSON,
 * all require_finance = OWNER/FINANCE):
 * - POST   /  (201, returns the created PaymentResponse)
 * - GET    /  (project list, payment_date DESC + created_at DESC)
 * - GET    /{payment_id} (single PaymentResponse)
 * There is NO PATCH/PUT and NO DELETE payment endpoint — edit and
 * delete are intentionally unsupported product decisions, so no
 * updatePayment/deletePayment helpers exist here.
 *
 * Backend field notes (verified in schemas/payment.py + models/payment.py):
 * - party_id + category_id are REQUIRED on create (UUIDs); any party
 *   TYPE is allowed (contractor AND supplier — no Task-style filter).
 * - amount is Decimal gt=0 (Numeric(14,2)); JSON numbers accepted.
 * - reference is a free optional string (no format/uniqueness rules).
 * - There is NO currency column anywhere — amounts are plain numbers.
 * - Response carries UUIDs only (no embedded party/category/project).
 */

/** Raw wire shape. amount may arrive as a JSON number or string. */
export interface BackendPayment {
  id: string;
  project_id: string;
  party_id: string | null;
  category_id: string | null;
  amount: number | string;
  payment_date: string;
  description: string | null;
  reference: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped payment built only from real backend fields. */
export interface ApiPayment {
  id: string;
  projectId: string;
  partyId?: string;
  categoryId?: string;
  amount: number;
  paymentDate: string;
  description?: string;
  reference?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toPaymentAmount(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapPaymentResponseToFrontend(p: BackendPayment): ApiPayment {
  return {
    id: p.id,
    projectId: p.project_id,
    partyId: p.party_id ?? undefined,
    categoryId: p.category_id ?? undefined,
    amount: toPaymentAmount(p.amount),
    paymentDate: p.payment_date,
    description: p.description ?? undefined,
    reference: p.reference ?? undefined,
    createdBy: p.created_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/** Neutral amount display — no currency (backend has no currency). */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function paymentPath(companyId: string, projectId: string, paymentId?: string): string {
  const base = `/companies/${companyId}/projects/${projectId}/payments/`;
  return paymentId ? `${base}${paymentId}` : base;
}

export async function getProjectPayments(
  companyId: string,
  projectId: string,
): Promise<ApiPayment[]> {
  const raw = await apiJson<BackendPayment[]>(paymentPath(companyId, projectId));
  return raw.map(mapPaymentResponseToFrontend);
}

export async function getPayment(
  companyId: string,
  projectId: string,
  paymentId: string,
): Promise<ApiPayment> {
  const raw = await apiJson<BackendPayment>(paymentPath(companyId, projectId, paymentId));
  return mapPaymentResponseToFrontend(raw);
}

/** Safe invoice filename: reference-based, short-id fallback. */
export function invoiceFilename(reference: string | undefined, paymentId: string): string {
  const raw = reference?.trim() || `pay-${paymentId.slice(0, 8)}`;
  const safe = raw.replace(/[^A-Za-z0-9-_]/g, '') || `pay-${paymentId.slice(0, 8)}`;
  return `payment-invoice-${safe}.pdf`;
}

/** Download the PDF invoice (authenticated blob, identifiers only). */
export async function downloadPaymentInvoice(
  companyId: string,
  projectId: string,
  paymentId: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const { buffer, filename } = await downloadPaymentInvoiceBytes(
    companyId,
    projectId,
    paymentId,
  );
  return { blob: new Blob([buffer], { type: 'application/pdf' }), filename };
}

/**
 * Raw invoice bytes with transport metadata. The buffer is validated
 * here (%PDF- magic + %%EOF trailer) so a corrupt or non-PDF body
 * never reaches the download step.
 */
export async function downloadPaymentInvoiceBytes(
  companyId: string,
  projectId: string,
  paymentId: string,
): Promise<{ buffer: ArrayBuffer; filename: string | null }> {
  const { buffer, filename } = await apiArrayBuffer(
    `${paymentPath(companyId, projectId, paymentId)}/invoice`,
  );
  const bytes = new Uint8Array(buffer);
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 8));
  const tail = new TextDecoder('ascii').decode(bytes.slice(Math.max(0, bytes.length - 100)));
  if (!buffer.byteLength || !head.startsWith('%PDF-') || !tail.includes('%%EOF')) {
    throw new ApiError(500, 'Invoice response was not a valid PDF.');
  }
  return { buffer, filename };
}

export interface CreatePaymentInput {
  partyId: string;
  categoryId: string;
  amount: number;
  paymentDate: string;
  description?: string;
  reference?: string;
}

export async function createPayment(
  companyId: string,
  projectId: string,
  input: CreatePaymentInput,
): Promise<ApiPayment> {
  const raw = await apiJson<BackendPayment>(paymentPath(companyId, projectId), {
    method: 'POST',
    body: {
      party_id: input.partyId,
      category_id: input.categoryId,
      // Two-decimal rounding avoids float corruption on Numeric(14,2).
      amount: Math.round(input.amount * 100) / 100,
      payment_date: input.paymentDate,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
    },
  });
  const created = mapPaymentResponseToFrontend(raw);
  clearPaymentIndex(companyId);
  return created;
}

export interface PaymentFormInput {
  projectId: string;
  partyId: string;
  categoryId: string;
  amount: number | string;
  paymentDate: string;
  reference?: string;
  description?: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/** Form → create payload. Blanks omitted; amount coerced to a number. */
export function mapPaymentFormToCreate(v: PaymentFormInput): CreatePaymentInput {
  return {
    partyId: v.partyId,
    categoryId: v.categoryId,
    amount: typeof v.amount === 'number' ? v.amount : Number(v.amount),
    paymentDate: v.paymentDate,
    description: cleanText(v.description),
    reference: cleanText(v.reference),
  };
}

// ---------------------------------------------------------------------------
// Hierarchy traversal: payment routes are project-scoped and the detail
// URL is flat (/app/payments/[id]), so the project is resolved by
// traversing company → projects → payments. Parallel fan-out, indexed
// per company, invalidated by create above. Mirrors task.api.ts.
// ---------------------------------------------------------------------------

export interface ApiPaymentWithProject extends ApiPayment {
  projectName?: string;
}

interface PaymentChain {
  projectId: string;
  projectName?: string;
}

let paymentIndex: { companyId: string; byId: Map<string, ApiPaymentWithProject> } | null =
  null;

export function clearPaymentIndex(companyId?: string): void {
  if (!companyId || paymentIndex?.companyId === companyId) paymentIndex = null;
}

/** All payments in a company, via parallel project fan-out. */
export async function getCompanyPayments(companyId: string): Promise<ApiPaymentWithProject[]> {
  if (paymentIndex?.companyId === companyId) return [...paymentIndex.byId.values()];
  const projects = await getProjects(companyId, { limit: 100 });
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const payments = await getProjectPayments(companyId, project.id).catch(() => [] as ApiPayment[]);
      return payments.map(
        (p): ApiPaymentWithProject => ({ ...p, projectName: project.name }),
      );
    }),
  );
  const all = perProject.flat();
  paymentIndex = { companyId, byId: new Map(all.map((p) => [p.id, p])) };
  return all;
}

/** Resolve the project owning a flat payment id. */
export async function resolvePaymentProject(
  companyId: string,
  paymentId: string,
  hint?: Partial<PaymentChain>,
): Promise<{ chain: PaymentChain; payment: ApiPayment }> {
  if (hint?.projectId) {
    try {
      const payment = await getPayment(companyId, hint.projectId, paymentId);
      return { chain: { projectId: hint.projectId }, payment };
    } catch (err) {
      const { ApiError } = await import('./client');
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 422))) throw err;
    }
  }
  const found =
    paymentIndex?.companyId === companyId
      ? paymentIndex.byId.get(paymentId)
      : (await getCompanyPayments(companyId)).find((p) => p.id === paymentId);
  if (!found) {
    const { ApiError } = await import('./client');
    throw new ApiError(404, 'Payment not found.');
  }
  const payment = await getPayment(companyId, found.projectId, paymentId);
  return {
    chain: { projectId: found.projectId, projectName: found.projectName },
    payment,
  };
}
