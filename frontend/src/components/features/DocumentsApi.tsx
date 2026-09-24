'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Download, Eye, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  deleteDocument,
  documentFormat,
  getCompanyDocuments,
  getProjectDocuments,
  isPreviewableImage,
  isPreviewablePdf,
  type ApiDocument,
  type ApiDocumentWithProject,
} from '@/lib/api/document.api';
import { getProjects } from '@/lib/api/project.api';
import {
  activeMembers,
  buildMembersByUserId,
  getCompanyMembers,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { displayDate, exportCsv } from '@/lib/utils/format';
import {
  PageHeader,
  StatCard,
  Badge,
  Panel,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog, Dialog } from '../ui/Dialog';
import { DocumentUploadForm } from '../forms/BusinessForms';

function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="stack" role="alert">
      <p className="field-error">{message}</p>
      <div>
        <button className="button secondary" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

function useCompanyId(): string | null {
  return useAuthStore((s) => s.companyId);
}

// Document reads/writes are OWNER/PROJECT_MANAGER/SITE_ENGINEER
// backend-side, mirrored by the frontend `documents` module key.
function useCanMutateDocuments(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || canAccess(companyRole, 'documents');
}

export function resolveUploaderLabel(
  uploadedBy: string | undefined,
  membersByUserId: Map<string, ApiCompanyMember>,
): string {
  if (!uploadedBy) return 'Unknown uploader';
  const member = membersByUserId.get(uploadedBy);
  if (member) return member.name;
  return `Team member ${uploadedBy.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Shared directory: projects + members loaded once per page, resolved
// through lookup maps (no N+1).
// ---------------------------------------------------------------------------

export interface DocumentDirectory {
  projectsById: Map<string, string>;
  projects: Array<{ id: string; name: string }>;
  membersByUserId: Map<string, ApiCompanyMember>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDocumentDirectory(companyId: string | null): DocumentDirectory {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [membersByUserId, setMembersByUserId] = useState<Map<string, ApiCompanyMember>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [plist, members] = await Promise.all([
        getProjects(companyId, { limit: 100 }),
        // Members list is OWNER-only backend-side; other site roles
        // fall back to UUID labels instead of failing the directory.
        getCompanyMembers(companyId).catch(() => [] as ApiCompanyMember[]),
      ]);
      setProjects(plist.map((p) => ({ id: p.id, name: p.name })));
      setMembersByUserId(buildMembersByUserId(activeMembers(members)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to documents for this company.');
      } else {
        setError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- directory load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    projectsById: new Map(projects.map((p) => [p.id, p.name])),
    projects,
    membersByUserId,
    loading,
    error,
    refetch: fetchAll,
  };
}

// ---------------------------------------------------------------------------
// Preview dialog: real file_url with a strategy chosen from file_type.
// Office files get Open/Download actions (no inline preview assumed).
// ---------------------------------------------------------------------------

function DocumentPreviewBody({ doc }: { doc: ApiDocumentWithProject }) {
  if (isPreviewableImage(doc)) {
    return <img src={doc.fileUrl} alt={doc.name} style={{ maxWidth: '100%', borderRadius: 8 }} />;
  }
  if (isPreviewablePdf(doc)) {
    return (
      <iframe title={doc.name} src={doc.fileUrl} style={{ width: '100%', height: 480, border: 0, borderRadius: 8 }} />
    );
  }
  return (
    <p className="small">
      No inline preview for this file type.{' '}
      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
        Open file
      </a>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Real document table. No file sizes (backend stores none).
// ---------------------------------------------------------------------------

export function DocumentTableReal({
  rows,
  projectsById,
  membersByUserId,
  showProject = true,
  onPreview,
  onDelete,
}: {
  rows: ApiDocumentWithProject[];
  projectsById: Map<string, string>;
  membersByUserId: Map<string, ApiCompanyMember>;
  showProject?: boolean;
  onPreview: (doc: ApiDocumentWithProject) => void;
  onDelete: (doc: ApiDocumentWithProject) => void;
}) {
  const [category, setCategory] = useState('');
  const [project, setProject] = useState('');
  const categories = [...new Set(rows.map((d) => d.category).filter((c): c is string => Boolean(c)))].sort();
  return (
    <DataTable
      rows={rows.filter(
        (d) =>
          (!category || d.category === category) && (!project || d.projectId === project),
      )}
      searchText={(d) => d.name + ' ' + (d.originalFilename ?? '') + ' ' + (d.category ?? '')}
      placeholder="Search documents…"
      filters={
        <>
          {showProject && (
            <select aria-label="Document project" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All Projects</option>
              {[...projectsById].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Document category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </>
      }
      columns={[
        {
          label: 'Document',
          value: (d) => (
            <div>
              <strong>{d.name}</strong>
              <small>{d.originalFilename ?? documentFormat(d)}</small>
            </div>
          ),
          sort: (d) => d.name,
        },
        ...(showProject
          ? [{ label: 'Project', value: (d: ApiDocumentWithProject) => d.projectName ?? projectsById.get(d.projectId) ?? '—' }]
          : []),
        {
          label: 'Category',
          value: (d) => <Badge value={d.category ?? 'Other'} />,
        },
        { label: 'Format', value: (d) => documentFormat(d) },
        { label: 'Uploaded By', value: (d) => resolveUploaderLabel(d.uploadedBy, membersByUserId) },
        { label: 'Uploaded At', value: (d) => displayDate(d.createdAt.slice(0, 10)), sort: (d) => d.createdAt },
        {
          label: 'Actions',
          value: (d) => (
            <div className="row-actions">
              <button aria-label={'Preview ' + d.name} onClick={() => onPreview(d)}>
                <Eye size={16} />
              </button>
              <a aria-label={'Open ' + d.name} href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download size={16} />
              </a>
              <button aria-label={'Delete ' + d.name} onClick={() => onDelete(d)}>
                <Trash2 size={16} />
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Shared list body: preview dialog + honest delete confirmation.
// DELETE removes the DB row only; the remote ImageKit file is kept.
// ---------------------------------------------------------------------------

function useDocumentActions(
  companyId: string | null,
  refetch: () => void,
): {
  preview: ApiDocumentWithProject | null;
  setPreview: (doc: ApiDocumentWithProject | null) => void;
  pendingDelete: ApiDocumentWithProject | null;
  setPendingDelete: (doc: ApiDocumentWithProject | null) => void;
  confirmDelete: () => Promise<void>;
  deleting: boolean;
} {
  const { notify } = useWorkspace();
  const [preview, setPreview] = useState<ApiDocumentWithProject | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiDocumentWithProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!companyId || !pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(companyId, pendingDelete.projectId, pendingDelete.id);
      notify('Document removed from this project.');
      setPendingDelete(null);
      refetch();
    } catch (err) {
      notify(friendlyMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return { preview, setPreview, pendingDelete, setPendingDelete, confirmDelete, deleting };
}

function DocumentDialogs({
  preview,
  onClosePreview,
  pendingDelete,
  onCloseDelete,
  onConfirmDelete,
  deleting,
}: {
  preview: ApiDocumentWithProject | null;
  onClosePreview: () => void;
  pendingDelete: ApiDocumentWithProject | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  deleting: boolean;
}) {
  return (
    <>
      <Dialog open={!!preview} onClose={onClosePreview} title={preview?.name ?? 'Document preview'}>
        {preview && (
          <>
            <DetailList
              items={[
                ['Category', preview.category ?? '—'],
                ['Format', documentFormat(preview)],
                ['Original File', preview.originalFilename ?? '—'],
                ['Uploaded', displayDate(preview.createdAt.slice(0, 10))],
              ]}
            />
            <div className="section-space">
              <DocumentPreviewBody doc={preview} />
            </div>
            <p className="section-space">
              <a href={preview.fileUrl} target="_blank" rel="noopener noreferrer">
                Open original
              </a>
            </p>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Remove this document from Buildora?"
        description="This removes the document record from this project. The uploaded file copy may remain in remote storage."
      />
      {deleting && (
        <p className="small" role="status" aria-live="polite">
          Removing document…
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Project documents tab: direct single-project fetch (cleanest surface).
// ---------------------------------------------------------------------------

export function ProjectDocumentsSection({
  projectId,
  projectName,
  uploadInitially = false,
}: {
  projectId: string;
  projectName?: string;
  uploadInitially?: boolean;
}) {
  const companyId = useCompanyId();
  const canMutate = useCanMutateDocuments();
  const directory = useDocumentDirectory(companyId);
  const [rows, setRows] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(uploadInitially);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getProjectDocuments(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to documents for this project.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- section load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const actions = useDocumentActions(companyId, fetchAll);
  const withProject: ApiDocumentWithProject[] = rows.map((d) => ({
    ...d,
    projectName: projectName ?? directory.projectsById.get(projectId),
  }));
  const categories = [...new Set(rows.map((d) => d.category).filter((c): c is string => Boolean(c)))];

  return (
    <>
      <PageHeader
        title="Documents"
        eyebrow={projectName ?? 'Project Files'}
        description="Manage private project files and structural records."
        back={'/app/projects/' + projectId}
      >
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            exportCsv(
              'document-registry',
              rows.map((d) => ({ name: d.name, category: d.category ?? '', format: documentFormat(d), uploaded: d.createdAt })),
            )
          }
        >
          <Download size={15} />
          Export Log
        </button>
        {canMutate && (
          <button className="button" type="button" onClick={() => setUploading(true)}>
            <Plus size={15} />
            Upload Document
          </button>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Files" value={rows.length} />
        {categories.slice(0, 3).map((c) => (
          <StatCard key={c} label={c} value={rows.filter((d) => d.category === c).length} />
        ))}
      </div>
      {loading || directory.loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading documents…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : directory.error ? (
        <ListError message={directory.error} onRetry={directory.refetch} />
      ) : !rows.length ? (
        <Panel title="No documents yet">
          <p className="small">Upload the first file for this project.</p>
          {canMutate && (
            <p className="section-space">
              <button className="button" type="button" onClick={() => setUploading(true)}>
                <Plus size={15} />
                Upload Document
              </button>
            </p>
          )}
        </Panel>
      ) : (
        <DocumentTableReal
          rows={withProject}
          projectsById={directory.projectsById}
          membersByUserId={directory.membersByUserId}
          showProject={false}
          onPreview={actions.setPreview}
          onDelete={actions.setPendingDelete}
        />
      )}
      <Dialog open={uploading} onClose={() => setUploading(false)} title="Upload Document" drawer>
        {uploading && companyId && (
          <DocumentUploadForm
            projectId={projectId}
            onClose={() => setUploading(false)}
            onSaved={fetchAll}
          />
        )}
      </Dialog>
      <DocumentDialogs
        preview={actions.preview}
        onClosePreview={() => actions.setPreview(null)}
        pendingDelete={actions.pendingDelete}
        onCloseDelete={() => actions.setPendingDelete(null)}
        onConfirmDelete={actions.confirmDelete}
        deleting={actions.deleting}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Global documents page: project fan-out (no company-wide endpoint).
// GLOBAL DOCUMENTS USE PROJECT FAN-OUT — a future company-wide endpoint
// would replace this (recommended as OPTIONAL/USEFUL, not required).
// ---------------------------------------------------------------------------

export function DocumentsWorkspaceList({ uploadInitially = false }: { uploadInitially?: boolean }) {
  const companyId = useCompanyId();
  const canMutate = useCanMutateDocuments();
  const directory = useDocumentDirectory(companyId);
  const [rows, setRows] = useState<ApiDocumentWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(uploadInitially);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getCompanyDocuments(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to documents for this company.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- ledger load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const actions = useDocumentActions(companyId, fetchAll);
  const categories = [...new Set(rows.map((d) => d.category).filter((c): c is string => Boolean(c)))];

  return (
    <>
      <PageHeader title="Documents" description="Manage private project files and structural records across engineering sites.">
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            exportCsv(
              'document-registry',
              rows.map((d) => ({
                name: d.name,
                project: d.projectName ?? '',
                category: d.category ?? '',
                format: documentFormat(d),
                uploaded: d.createdAt,
              })),
            )
          }
        >
          <Download size={15} />
          Export Log
        </button>
        {canMutate && (
          <button className="button" type="button" onClick={() => setUploading(true)}>
            <Plus size={15} />
            Upload Document
          </button>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Files" value={rows.length} />
        {categories.slice(0, 3).map((c) => (
          <StatCard key={c} label={c} value={rows.filter((d) => d.category === c).length} />
        ))}
      </div>
      {loading || directory.loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading documents…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : directory.error ? (
        <ListError message={directory.error} onRetry={directory.refetch} />
      ) : !rows.length ? (
        <Panel title="No documents yet">
          <p className="small">Upload the first project file to get started.</p>
          {canMutate && (
            <p className="section-space">
              <button className="button" type="button" onClick={() => setUploading(true)}>
                <Plus size={15} />
                Upload Document
              </button>
            </p>
          )}
        </Panel>
      ) : (
        <DocumentTableReal
          rows={rows}
          projectsById={directory.projectsById}
          membersByUserId={directory.membersByUserId}
          onPreview={actions.setPreview}
          onDelete={actions.setPendingDelete}
        />
      )}
      <Dialog open={uploading} onClose={() => setUploading(false)} title="Upload Document" drawer>
        {uploading && companyId && (
          <DocumentUploadForm onClose={() => setUploading(false)} onSaved={fetchAll} />
        )}
      </Dialog>
      <p className="form-note section-space">
        Private project document storage · Files open from secure remote storage.
      </p>
      <DocumentDialogs
        preview={actions.preview}
        onClosePreview={() => actions.setPreview(null)}
        pendingDelete={actions.pendingDelete}
        onCloseDelete={() => actions.setPendingDelete(null)}
        onConfirmDelete={actions.confirmDelete}
        deleting={actions.deleting}
      />
    </>
  );
}
