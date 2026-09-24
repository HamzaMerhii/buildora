import { apiForm, apiJson } from './client';
import { getProjects } from './project.api';

/**
 * Document endpoints (verified against backend/app/routers/document.py,
 * which is mounted in main.py).
 * Base path: /companies/{company_id}/projects/{project_id}/documents —
 * companyId from the Zustand session, projectId from routes/backend
 * responses, or the hierarchy index below. Never hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here (all
 * require_site_management = OWNER/PROJECT_MANAGER/SITE_ENGINEER):
 * - POST   /  (multipart, 201, returns the created DocumentResponse)
 * - GET    /  (created_at DESC)
 * - GET    /{document_id} (single DocumentResponse)
 * - DELETE /{document_id} (204, DB row only — remote ImageKit file kept)
 * There is NO PATCH (no metadata edit, no versioning) and NO
 * company-wide list — the global page fans out per project below.
 *
 * Backend file notes (verified in imagekit_service.py + document.py):
 * - Single file per upload, field name `file`; accepted MIME:
 *   PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG, WEBP. DWG rejected (400).
 * - No backend size limit and no stored file_size; filenames reuse
 *   the original client name (collisions possible).
 * - Response exposes a direct ImageKit `file_url` (open/download).
 */

/** Accepted MIME types, mirrored from ALLOWED_DOCUMENT_TYPES. */
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const DOCUMENT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';

/** Raw wire shape. */
export interface BackendDocument {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  name: string;
  category: string | null;
  file_url: string;
  file_type: string | null;
  original_filename: string | null;
  created_at: string;
}

/** Frontend-shaped document built only from real backend fields. */
export interface ApiDocument {
  id: string;
  projectId: string;
  uploadedBy?: string;
  name: string;
  category?: string;
  fileUrl: string;
  fileType?: string;
  originalFilename?: string;
  createdAt: string;
}

export function mapDocumentResponseToFrontend(d: BackendDocument): ApiDocument {
  return {
    id: d.id,
    projectId: d.project_id,
    uploadedBy: d.uploaded_by ?? undefined,
    name: d.name,
    category: d.category ?? undefined,
    fileUrl: d.file_url,
    fileType: d.file_type ?? undefined,
    originalFilename: d.original_filename ?? undefined,
    createdAt: d.created_at,
  };
}

/** Short display format derived from MIME type or filename extension. */
export function documentFormat(doc: Pick<ApiDocument, 'fileType' | 'originalFilename'>): string {
  const mime = (doc.fileType ?? '').toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('msword') || mime.includes('wordprocessingml')) return 'DOCX';
  if (mime.includes('ms-excel') || mime.includes('spreadsheetml')) return 'XLSX';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('webp')) return 'WEBP';
  const ext = doc.originalFilename?.split('.').pop()?.toUpperCase();
  if (ext) return ext.slice(0, 5);
  return 'FILE';
}

export function isPreviewableImage(doc: Pick<ApiDocument, 'fileType'>): boolean {
  const mime = (doc.fileType ?? '').toLowerCase();
  return mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png') || mime.includes('webp');
}

export function isPreviewablePdf(doc: Pick<ApiDocument, 'fileType'>): boolean {
  return (doc.fileType ?? '').toLowerCase().includes('pdf');
}

function documentPath(companyId: string, projectId: string, documentId?: string): string {
  const base = `/companies/${companyId}/projects/${projectId}/documents/`;
  return documentId ? `${base}${documentId}` : base;
}

export async function getProjectDocuments(
  companyId: string,
  projectId: string,
): Promise<ApiDocument[]> {
  const raw = await apiJson<BackendDocument[]>(documentPath(companyId, projectId));
  return raw.map(mapDocumentResponseToFrontend);
}

export async function getDocument(
  companyId: string,
  projectId: string,
  documentId: string,
): Promise<ApiDocument> {
  const raw = await apiJson<BackendDocument>(
    documentPath(companyId, projectId, documentId),
  );
  return mapDocumentResponseToFrontend(raw);
}

export interface UploadDocumentInput {
  name: string;
  category?: string;
  file: File;
}

/**
 * Multipart upload. No manual Content-Type (browser sets the boundary).
 * Empty category is omitted (backend normalizes blanks to null).
 */
export async function uploadDocument(
  companyId: string,
  projectId: string,
  input: UploadDocumentInput,
): Promise<ApiDocument> {
  const form = new FormData();
  form.set('name', input.name.trim());
  if (input.category?.trim()) form.set('category', input.category.trim());
  form.set('file', input.file);
  const raw = await apiForm<BackendDocument>(documentPath(companyId, projectId), form, {
    method: 'POST',
  });
  const created = mapDocumentResponseToFrontend(raw);
  clearDocumentIndex(companyId);
  return created;
}

/** DB row only — the remote ImageKit file is intentionally left alone. */
export async function deleteDocument(
  companyId: string,
  projectId: string,
  documentId: string,
): Promise<void> {
  await apiJson<void>(documentPath(companyId, projectId, documentId), {
    method: 'DELETE',
  });
  clearDocumentIndex(companyId);
}

// ---------------------------------------------------------------------------
// Hierarchy traversal: document routes are project-scoped, so the global
// page fans out across projects in parallel (projects loaded once),
// indexed per company like the payment ledger.
// ---------------------------------------------------------------------------

export interface ApiDocumentWithProject extends ApiDocument {
  projectName?: string;
}

interface DocumentChain {
  projectId: string;
  projectName?: string;
}

let documentIndex: {
  companyId: string;
  byId: Map<string, ApiDocumentWithProject>;
} | null = null;

export function clearDocumentIndex(companyId?: string): void {
  if (!companyId || documentIndex?.companyId === companyId) documentIndex = null;
}

/** All documents in a company, via parallel project fan-out. */
export async function getCompanyDocuments(
  companyId: string,
): Promise<ApiDocumentWithProject[]> {
  if (documentIndex?.companyId === companyId) return [...documentIndex.byId.values()];
  const projects = await getProjects(companyId, { limit: 100 });
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const docs = await getProjectDocuments(companyId, project.id).catch(
        () => [] as ApiDocument[],
      );
      return docs.map(
        (d): ApiDocumentWithProject => ({ ...d, projectName: project.name }),
      );
    }),
  );
  const all = perProject.flat();
  documentIndex = { companyId, byId: new Map(all.map((d) => [d.id, d])) };
  return all;
}

/** Resolve the project owning a document id. */
export async function resolveDocumentProject(
  companyId: string,
  documentId: string,
  hint?: Partial<DocumentChain>,
): Promise<{ chain: DocumentChain; document: ApiDocument }> {
  if (hint?.projectId) {
    try {
      const document = await getDocument(companyId, hint.projectId, documentId);
      return { chain: { projectId: hint.projectId }, document };
    } catch (err) {
      const { ApiError } = await import('./client');
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 422))) throw err;
    }
  }
  const found =
    documentIndex?.companyId === companyId
      ? documentIndex.byId.get(documentId)
      : (await getCompanyDocuments(companyId)).find((d) => d.id === documentId);
  if (!found) {
    const { ApiError } = await import('./client');
    throw new ApiError(404, 'Document not found.');
  }
  const document = await getDocument(companyId, found.projectId, documentId);
  return {
    chain: { projectId: found.projectId, projectName: found.projectName },
    document,
  };
}
