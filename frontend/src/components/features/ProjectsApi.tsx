'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Download, MapPin, Building2, LayoutGrid, List, Search, Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  getProject,
  getProjects,
  type ApiProject,
  type FrontendProjectStatus,
} from '@/lib/api/project.api';
import {
  getBuildings,
  type ApiBuilding,
} from '@/lib/api/building.api';
import {
  getFloors,
  type ApiFloor,
} from '@/lib/api/floor.api';
import {
  getLandRecord,
  type ApiLandRecord,
} from '@/lib/api/land-record.api';
import {
  getApartments,
  type ApiApartment,
} from '@/lib/api/apartment.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { LandForm } from '../forms/StructureForms';
import { money, displayDate, exportCsv } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  TextLink,
  EmptyState,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { Dialog } from '../ui/Dialog';

const PAGE_SIZE = 20;
const FALLBACK_IMAGE = '/images/7e935d160931.webp';
const DETAIL_HERO_IMAGE = '/images/6d9ed7862326.webp';

const STATUS_OPTIONS: Array<{ value: '' | FrontendProjectStatus; label: string }> = [
  { value: '', label: 'Status: All' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
];

function ApiProjectCard({ project: p }: { project: ApiProject }) {
  return (
    <article className="project-card">
      <Link href={'/app/projects/' + p.id} className="project-image" style={{ display: 'block' }}>
        <img src={p.image ?? FALLBACK_IMAGE} alt={p.name} />
        <Badge value={p.status} />
      </Link>
      <div className="project-card-body">
        <h3>{p.name}</h3>
        <div className="location">
          <MapPin size={13} />
          {p.location ?? 'Location not set'}
        </div>
        <p className="small">
          {p.startDate ? displayDate(p.startDate) : '—'}
          {' – '}
          {p.endDate ? displayDate(p.endDate) : '—'}
        </p>
        <div className="budget">
          <span className="muted">Target Budget</span>
          <strong>{p.budget === null ? '—' : money(p.budget)}</strong>
        </div>
      </div>
      <div className="project-card-footer">
        <span>{p.description ? p.description.slice(0, 48) + (p.description.length > 48 ? '…' : '') : 'No description'}</span>
        <TextLink href={'/app/projects/' + p.id}>View</TextLink>
      </div>
    </article>
  );
}

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

export function ProjectsWorkspaceList() {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [rows, setRows] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'' | FrontendProjectStatus>('');
  const [table, setTable] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects(companyId, {
        status: status || undefined,
        search: debouncedQuery || undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (requestId.current !== current) return;
      setRows(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      if (requestId.current !== current) return;
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
      setHasMore(false);
    } finally {
      if (requestId.current === current) setLoading(false);
    }
  }, [companyId, debouncedQuery, status, page]);

  /* eslint-disable react-hooks/set-state-in-effect -- paginated project fetch on filter/page change */
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canMutate = !companyRole || canAccess(companyRole, 'projects-mutate');

  return (
    <>
      <PageHeader
        title="Projects"
        eyebrow="Asset Portfolio · FY 2026–2028"
        description="Manage construction projects, municipal stages, and site-level operational workflows."
      >
        <>
          <button className="button secondary" onClick={() => exportCsv('projects', rows)}>
            <Download size={15} />
            Export Log
          </button>
          {canMutate && (
            <ButtonLink href="/app/projects/new">
              <Plus size={16} />
              New Project
            </ButtonLink>
          )}
        </>
      </PageHeader>
      <div className="stats">
        <StatCard label="Loaded Projects" value={rows.length} detail="On this page" icon={<Building2 />} />
        <StatCard
          label="Planning"
          value={rows.filter((p) => p.status === 'PLANNING').length}
          detail="On this page"
        />
        <StatCard
          label="In Progress"
          value={rows.filter((p) => p.status === 'IN_PROGRESS').length}
          detail="On this page"
        />
        <StatCard
          label="Completed"
          value={rows.filter((p) => p.status === 'COMPLETED').length}
          detail="On this page"
        />
      </div>
      <div className="toolbar" style={{ borderRadius: 10, marginBottom: 22 }}>
        <label className="search-control">
          <Search size={16} />
          <input
            placeholder="Search projects, locations…"
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Project status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | FrontendProjectStatus);
            setPage(0);
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="actions">
          <button
            className="icon-button"
            aria-label="Grid view"
            aria-pressed={!table}
            onClick={() => setTable(false)}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Table view"
            aria-pressed={table}
            onClick={() => setTable(true)}
          >
            <List size={16} />
          </button>
        </div>
      </div>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading projects…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchPage} />
      ) : !rows.length ? (
        <EmptyState title="No developments found" />
      ) : table ? (
        <DataTable
          rows={rows}
          searchText={(p) => p.name}
          columns={[
            {
              label: 'Project',
              value: (p) => <TextLink href={'/app/projects/' + p.id}>{p.name}</TextLink>,
              sort: (p) => p.name,
            },
            { label: 'Location', value: (p) => p.location ?? '—' },
            { label: 'Status', value: (p) => <Badge value={p.status} /> },
            {
              label: 'Budget',
              value: (p) => (p.budget === null ? '—' : money(p.budget)),
              sort: (p) => p.budget ?? 0,
            },
          ]}
        />
      ) : (
        <div className="three-grid">
          {rows.map((p) => (
            <ApiProjectCard project={p} key={p.id} />
          ))}
        </div>
      )}
      {!loading && !error && (page > 0 || hasMore) && (
        <div className="pagination">
          <span>Page {page + 1}</span>
          <div>
            <button
              className="button secondary"
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>{' '}
            <button
              className="button secondary"
              type="button"
              disabled={!hasMore}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ProjectWorkspaceDetail({ id }: { id: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  // Submodule sections below stay mock-driven until their own integration.
  const { data } = useWorkspace();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProject(await getProject(companyId, id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else {
        setError(friendlyMessage(err));
      }
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- project detail load on mount/id change */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }
  if (error || !project) {
    return (
      <>
        <ListError message={error ?? 'Project not found.'} onRetry={fetchDetail} />
        <p className="section-space">
          <TextLink href="/app/projects">Back to Projects</TextLink>
        </p>
      </>
    );
  }

  const p = project;
  const canMutate = !companyRole || canAccess(companyRole, 'projects-mutate');
  return (
    <>
      <PageHeader title={p.name} description={p.location ?? 'Location not set'} back="/app/projects">
        <Badge value={p.status} />
        {canMutate && (
          <ButtonLink secondary href={'/app/projects/' + id + '/edit'}>
            <Pencil size={15} />
            Edit Project
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Approved Budget" value={p.budget === null ? '—' : money(p.budget)} />
        <StatCard label="Timeline" value={p.startDate ? displayDate(p.startDate) : '—'} />
        <StatCard label="Expected End" value={p.endDate ? displayDate(p.endDate) : '—'} />
        <StatCard label="Status" value={p.status} />
      </div>
      <div className="two-column">
        <div className="stack">
          <div>
            <img
              className="hero-image"
              src={p.image ?? DETAIL_HERO_IMAGE}
              alt={p.name + ' project image'}
            />
          </div>
          <LandSummary projectId={id} />
          <Panel title="Project Scope">
            <p className="small">{p.description || 'No description provided.'}</p>
          </Panel>
          <Panel title="Phased Construction Progress">
            <p className="small">Construction stages are still served from local mock data.</p>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Real Estate Composition">
            <DetailList
              items={[
                ['Buildings', data.buildings.filter((b) => b.projectId === id).length],
                ['Apartments', data.apartments.filter((a) => a.projectId === id).length],
              ]}
            />
            <p className="small">Structure data is still served from local mock data.</p>
            <ButtonLink href={'/app/projects/' + id + '/apartments'} secondary>
              View Apartments
            </ButtonLink>
          </Panel>
        </div>
      </div>
    </>
  );
}

function formatGrouped(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Compact Land Information & Zoning Matrix summary for the project
 * detail overview, rendered directly under the project image.
 * Independent from the project GET: loading/failure here never breaks
 * the detail page. Only fetched for roles the backend serves
 * (OWNER/PROJECT_MANAGER, mirrored via `projects-mutate`); other
 * roles see nothing and issue no request.
 */
export function LandSummary({ projectId }: { projectId: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [record, setRecord] = useState<ApiLandRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  const mayRead = !companyRole || canAccess(companyRole, 'projects-mutate');

  const fetchSummary = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      setRetryable(false);
      return;
    }
    setLoading(true);
    setError(null);
    setRetryable(false);
    try {
      setRecord(await getLandRecord(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Land information is not available.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Land information is not available for your role.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
        setRetryable(true);
      }
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- land summary load on mount/project change */
  useEffect(() => {
    if (!mayRead) {
      setLoading(false);
      return;
    }
    fetchSummary();
  }, [mayRead, fetchSummary]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mayRead) return null;

  const skeleton = (
    <Panel title="Land Information & Zoning Matrix">
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label="Land Area" value="…" />
        <StatCard label="Parcel Number" value="…" />
        <StatCard label="Maximum Height" value="…" />
        <StatCard label="Building Ratio" value="…" />
      </div>
    </Panel>
  );

  if (loading) return skeleton;
  if (error || !record) {
    return (
      <Panel title="Land Information & Zoning Matrix">
        {retryable ? (
          <SectionError message={error ?? 'Land information is not available.'} onRetry={fetchSummary} />
        ) : (
          <p className="small" role="status">
            {error ?? 'Land information is not available.'}
          </p>
        )}
      </Panel>
    );
  }

  const footprint =
    record.area != null && record.ratio != null ? (record.area * record.ratio) / 100 : null;

  return (
    <Panel
      title="Land Information & Zoning Matrix"
      action={<TextLink href={'/app/projects/' + projectId + '/structure'}>Edit Land Information</TextLink>}
    >
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard
          label="Land Area"
          value={record.area != null ? formatGrouped(record.area) + ' sqm' : '—'}
          detail="Full Parcel Footprint"
        />
        <StatCard label="Parcel Number" value={record.parcel ?? '—'} detail="Cadastral Registry" />
        <StatCard
          label="Maximum Height"
          value={record.maxHeight != null ? formatGrouped(record.maxHeight) + ' m' : '—'}
          detail="Maximum permitted height"
        />
        <StatCard
          label="Building Ratio"
          value={record.ratio != null ? formatGrouped(record.ratio) + '%' : '—'}
          detail={
            footprint != null ? `Max footprint: ${formatGrouped(footprint)} sqm` : undefined
          }
        />
      </div>
    </Panel>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
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

/**
 * Real Land Record section for the Project Structure page.
 * Display + edit dialog are driven by GET/PATCH land-record/.
 * Editable only for roles the backend accepts (OWNER/PROJECT_MANAGER,
 * mirrored here via the centralized `projects-mutate` permission).
 */
export function LandRecordSection({ projectId }: { projectId: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [record, setRecord] = useState<ApiLandRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchRecord = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      setErrorStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      setRecord(await getLandRecord(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Land record is not available for this project.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this land record.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setErrorStatus(err instanceof ApiError ? err.status : null);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- land record load on mount/project change */
  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const editable = !companyRole || canAccess(companyRole, 'projects-mutate');

  return (
    <>
      <Panel
        title="Land Information"
        action={
          editable && record ? (
            <button className="button secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit Land Record
            </button>
          ) : undefined
        }
      >
        {loading ? (
          <p className="small" role="status" aria-live="polite">
            Loading land record…
          </p>
        ) : error || !record ? (
          <SectionError message={error ?? 'Land record is not available.'} onRetry={fetchRecord} />
        ) : (
          <>
            <div className="stats" style={{ marginBottom: 0 }}>
              <StatCard label="Land Area" value={record.area != null ? record.area + ' sqm' : '—'} />
              <StatCard label="Parcel Number" value={record.parcel ?? '—'} />
              <StatCard label="Max Height" value={record.maxHeight != null ? record.maxHeight + ' m' : '—'} />
              <StatCard label="Building Ratio" value={record.ratio != null ? record.ratio + '%' : '—'} />
            </div>
            {(record.constraints || record.notes) && (
              <div className="section-space">
                <DetailList
                  items={[
                    ...(record.constraints ? [['Constraints', record.constraints] as [string, string]] : []),
                    ...(record.notes ? [['Notes', record.notes] as [string, string]] : []),
                  ]}
                />
              </div>
            )}
          </>
        )}
      </Panel>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit Land Information" drawer>
        {editing && (
          <LandForm projectId={projectId} onClose={() => setEditing(false)} onSaved={fetchRecord} />
        )}
      </Dialog>
      {errorStatus === 404 && !loading && (
        <p className="small section-space">
          Projects created before land tracking may not have a record; there is no endpoint to create one.
        </p>
      )}
    </>
  );
}

/**
 * Project Structure page: real project header, real Land Record section,
 * and real Building Hierarchy. Floor/apartment chips stay mock-driven
 * until the floors task.
 */
export function ProjectStructureApi({ id }: { id: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProject(await getProject(companyId, id));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- project header load on mount/id change */
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading project structure…
      </p>
    );
  }
  if (error || !project) {
    return (
      <>
        <SectionError message={error ?? 'Project not found.'} onRetry={fetchProject} />
        <p className="section-space">
          <TextLink href="/app/projects">Back to Projects</TextLink>
        </p>
      </>
    );
  }

  const canMutateBuildings = !companyRole || canAccess(companyRole, 'projects-mutate');

  return (
    <>
      <PageHeader
        title="Project Structure"
        description={project.name + ' · Physical building and floor hierarchy'}
        back={'/app/projects/' + id}
      >
        {canMutateBuildings && (
          <ButtonLink href={'/app/projects/' + id + '/buildings/new'}>
            <Plus size={16} />
            Add Building
          </ButtonLink>
        )}
      </PageHeader>
      <LandRecordSection projectId={id} />
      <BuildingsSection projectId={id} />
    </>
  );
}

/**
 * Real Building Hierarchy for the Project Structure page.
 * List/add/edit are driven by GET/POST/PATCH buildings/; per-building
 * floors come from the real floor list endpoint. Apartment chips stay
 * mock-driven until the apartments task. There is no DELETE building
 * endpoint, so no delete control is rendered.
 */
export function BuildingsSection({ projectId }: { projectId: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [buildings, setBuildings] = useState<ApiBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildings = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBuildings(await getBuildings(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to buildings for this project.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- building list load on mount/project change */
  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canMutate = !companyRole || canAccess(companyRole, 'projects-mutate');

  return (
    <div className="section-space">
      <h2 style={{ marginBottom: 18 }}>Building Hierarchy</h2>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading buildings…
        </p>
      ) : error ? (
        <SectionError message={error} onRetry={fetchBuildings} />
      ) : !buildings.length ? (
        <EmptyState
          title="No buildings yet"
          description="Add the first structural enclosure for this project."
          href={canMutate ? '/app/projects/' + projectId + '/buildings/new' : undefined}
          action="Add Building"
        />
      ) : (
        buildings.map((b) => (
          <BuildingBlock key={b.id} projectId={projectId} building={b} canMutate={canMutate} />
        ))
      )}
    </div>
  );
}

/**
 * Real apartment chips for one floor (GET apartment list, unit_number
 * ASC as returned by the backend). Rendered only for roles the backend
 * serves (OWNER/PROJECT_MANAGER); otherwise nothing is fetched.
 */
function FloorApartmentChips({
  companyId,
  projectId,
  buildingId,
  floorId,
}: {
  companyId: string;
  projectId: string;
  buildingId: string;
  floorId: string;
}) {
  const [apartments, setApartments] = useState<ApiApartment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChips = useCallback(async () => {
    setLoading(true);
    try {
      setApartments(await getApartments(companyId, projectId, buildingId, floorId));
    } catch {
      setApartments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, buildingId, floorId]);

  /* eslint-disable react-hooks/set-state-in-effect -- chips load on mount */
  useEffect(() => {
    fetchChips();
  }, [fetchChips]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading || !apartments.length) return null;
  return (
    <>
      {apartments.map((a) => (
        <Link className="unit-chip" key={a.id} href={'/app/apartments/' + a.id}>
          Apartment {a.number} <Badge value={a.status} />
        </Link>
      ))}
    </>
  );
}

/**
 * One building row: real floors (GET floor list, floor_number ASC as
 * returned by the backend) with the existing markup. Apartment chips
 * stay mock-driven until the apartments task.
 */
function BuildingBlock({
  projectId,
  building,
  canMutate,
}: {
  projectId: string;
  building: ApiBuilding;
  canMutate: boolean;
}) {
  const b = building;
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [floors, setFloors] = useState<ApiFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReadApartments = !companyRole || canAccess(companyRole, 'apartments-mutate');

  const fetchFloors = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFloors(await getFloors(companyId, projectId, b.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Building not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to floors for this building.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setFloors([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, b.id]);

  /* eslint-disable react-hooks/set-state-in-effect -- floor list load on mount */
  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <details className="structure-building" open>
      <summary>
        {b.name} · {loading ? '…' : `${floors.length} Floors`}
      </summary>
      <div className="toolbar">
        <span className="small muted" style={{ flex: 1 }}>
          {b.description}
        </span>
        {canMutate && (
          <Link
            className="text-link"
            href={'/app/projects/' + projectId + '/buildings/' + b.id + '/edit'}
          >
            Edit Building
          </Link>
        )}
        <ButtonLink secondary href={'/app/buildings/' + b.id + '/floors/new?projectId=' + projectId}>
          <Plus size={14} />
          Add Floor
        </ButtonLink>
      </div>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading floors…
        </p>
      ) : error ? (
        <SectionError message={error} onRetry={fetchFloors} />
      ) : !floors.length ? (
        <p className="small muted">No floors yet.</p>
      ) : (
        floors.map((f) => (
          <div className="structure-floor" key={f.id}>
            <span>
              <strong>{f.name ?? `Floor ${f.number}`}</strong>
              <small className="muted" style={{ display: 'block' }}>
                Level {f.number}
              </small>
            </span>
            {canReadApartments && companyId && (
              <FloorApartmentChips
                companyId={companyId}
                projectId={projectId}
                buildingId={b.id}
                floorId={f.id}
              />
            )}
            <Link
              className="text-link"
              style={{ marginLeft: 'auto' }}
              href={'/app/buildings/' + b.id + '/floors/' + f.id + '/edit?projectId=' + projectId}
            >
              Edit Floor
            </Link>
          </div>
        ))
      )}
    </details>
  );
}
