'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, BedDouble, Bath, Square } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  clearApartmentIndex,
  getApartmentById,
  getCompanyApartmentsPage,
  getProjectApartments,
  updateApartment,
  type ApiApartmentWithParents,
  type CompanyApartmentsPage,
  type CompanyApartmentsQuery,
} from '@/lib/api/apartment.api';
import { getProject, getProjects } from '@/lib/api/project.api';
import { getBuildings } from '@/lib/api/building.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { money } from '@/lib/utils/format';
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
import { DataTable, type Column } from '../ui/DataTable';

const FALLBACK_IMAGE = '/images/33b403bb7596.webp';

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

function AvailabilityDonut({
  available,
  reserved,
  sold,
  total,
}: {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}) {
  const size = 200;
  const radius = 80;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: 'Available', detail: 'Ready for sale', value: available, color: 'var(--mist)' },
    { label: 'Reserved', detail: 'Awaiting completion', value: reserved, color: '#7FA3D6' },
    { label: 'Sold', detail: 'Handed over', value: sold, color: 'var(--primary)' },
  ];
  let offset = 0;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const pctExact = (v: number) =>
    total > 0 ? (v / total) * 100 : 0;
  return (
    <div className="avail-wrap">
      <div className="avail-chart">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Availability: ${available} available, ${reserved} reserved, ${sold} sold, ${total} total`}
        >
          <circle cx={center} cy={center} r={radius} fill="none" strokeWidth="26" stroke="var(--line)" />
          {total > 0 &&
            segments.map((s) => {
              if (!s.value) return null;
              const length = (s.value / total) * circumference;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={s.label}
                  className="avail-seg"
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  strokeWidth="26"
                  stroke={s.color}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  strokeLinecap="butt"
                >
                  <title>
                    {s.label} — {s.value} apartment{s.value === 1 ? '' : 's'} (
                    {pctExact(s.value).toFixed(1)}% of inventory)
                  </title>
                </circle>
              );
            })}
        </svg>
        <div className="donut-center" aria-hidden="true">
          <strong>{total}</strong>
          <small>TOTAL UNITS</small>
        </div>
      </div>
      <div className="avail-breakdown">
        <ul className="avail-rows">
          {segments.map((s) => (
            <li key={s.label}>
              <span className="donut-dot" style={{ background: s.color }} aria-hidden="true" />
              <span className="avail-row-main">
                <span>{s.label}</span>
                <span className="small muted">{s.detail}</span>
              </span>
              <strong className="avail-nums">{s.value}</strong>
              <span className="avail-pct">{pct(s.value)}%</span>
              <span className="avail-bar" aria-hidden="true">
                <span style={{ width: `${pct(s.value)}%`, background: s.color }} />
              </span>
            </li>
          ))}
        </ul>
        {total > 0 && (
          <p className="small muted">
            {pct(available)}% of inventory is currently available.
          </p>
        )}
      </div>
    </div>
  );
}

function apartmentColumns(showProject: boolean): Column<ApiApartmentWithParents>[] {
  return [
    {
      label: 'Apartment',
      value: (a) => (
        <Link href={'/app/apartments/' + a.id}>
          <strong>Apartment {a.number}</strong>
        </Link>
      ),
      sort: (a) => a.number,
    },
    ...(showProject
      ? [{ label: 'Project', value: (a: ApiApartmentWithParents) => a.projectName }]
      : []),
    {
      label: 'Building / Floor',
      value: (a) => (
        <>
          {a.buildingName}
          <small>{a.floorName}</small>
        </>
      ),
    },
    { label: 'Area', value: (a) => (a.area === null ? '—' : a.area + ' sqm'), sort: (a) => a.area ?? 0 },
    {
      label: 'Beds / Baths',
      value: (a) => `${a.bedrooms ?? '—'} / ${a.bathrooms ?? '—'}`,
    },
    {
      label: 'Price',
      value: (a) => (a.price === null ? '—' : money(a.price)),
      sort: (a) => a.price ?? 0,
    },
    { label: 'Status', value: (a) => <Badge value={a.status} /> },
    { label: 'Visibility', value: (a) => (a.isPublic ? 'Public' : 'Private') },
    {
      label: 'Actions',
      value: (a) => (
        <div className="row-actions">
          <Link href={'/app/apartments/' + a.id}>View</Link>
          <Link href={'/app/apartments/' + a.id + '/edit'}>Edit</Link>
        </div>
      ),
    },
  ];
}

function ApartmentTable({
  rows,
  showProject,
  projectOptions,
  buildingOptions,
  project,
  building,
  onProjectChange,
  onBuildingChange,
}: {
  rows: ApiApartmentWithParents[];
  showProject: boolean;
  projectOptions: Array<{ id: string; name: string }>;
  buildingOptions?: Array<{ id: string; name: string }>;
  project: string;
  building?: string;
  onProjectChange?: (value: string) => void;
  onBuildingChange?: (value: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const buildings = buildingOptions ?? [];
  const activeBuilding = building ?? '';
  const filtered = rows.filter(
    (a) =>
      (!project || a.projectId === project) &&
      (!activeBuilding || a.buildingId === activeBuilding) &&
      (!status || a.status === status) &&
      (!visibility || String(a.isPublic) === visibility),
  );
  const filters = (
    <>
      {onProjectChange && (
        <select aria-label="Filter by project" value={project} onChange={(e) => onProjectChange(e.target.value)}>
          <option value="">All Projects</option>
          {projectOptions.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {onBuildingChange && (
        <select aria-label="Filter by building" value={activeBuilding} onChange={(e) => onBuildingChange(e.target.value)}>
          <option value="">All Buildings</option>
          {buildings.map((b) => (
            <option value={b.id} key={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All Statuses</option>
        <option value="AVAILABLE">Available</option>
        <option value="RESERVED">Reserved</option>
        <option value="SOLD">Sold</option>
      </select>
      <select
        aria-label="Visibility"
        value={visibility}
        onChange={(e) => setVisibility(e.target.value)}
      >
        <option value="">All Visibility</option>
        <option value="true">Public</option>
        <option value="false">Private</option>
      </select>
    </>
  );
  return (
    <DataTable
      rows={filtered}
      filters={filters}
      placeholder="Search apartments by number, building…"
      searchText={(a) => a.number + ' ' + (a.buildingName ?? '')}
      columns={apartmentColumns(showProject)}
    />
  );
}

/**
 * Company-wide apartment inventory. Uses the single paginated management
 * endpoint (GET /companies/{company_id}/apartments/) — one request per
 * page. Project/building dropdown options come from the lightweight
 * project + building endpoints; filters are server-side query params so
 * they cover the full dataset, not just the visible page.
 */
const WORKSPACE_PAGE_SIZE = 6;

export function ApartmentsWorkspaceList() {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [data, setData] = useState<CompanyApartmentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [project, setProject] = useState('');
  const [building, setBuilding] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibility, setVisibility] = useState('');
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [buildingOptions, setBuildingOptions] = useState<Array<{ id: string; name: string; projectId: string }>>([]);

  const fetchPage = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(
        await getCompanyApartmentsPage(companyId, {
          page,
          pageSize: WORKSPACE_PAGE_SIZE,
          projectId: project || undefined,
          buildingId: building || undefined,
          status: (statusFilter || undefined) as CompanyApartmentsQuery['status'],
          isPublic: visibility === '' ? undefined : visibility === 'true',
        }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to apartments for this company.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, page, project, building, statusFilter, visibility]);

  /* eslint-disable react-hooks/set-state-in-effect -- inventory load on mount */
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    if (!companyId) {
      setProjectOptions([]);
      setBuildingOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const projects = await getProjects(companyId, { limit: 100 });
        if (cancelled) return;
        setProjectOptions(projects.map((p) => ({ id: p.id, name: p.name })));
        const perProject = await Promise.all(
          projects.map(async (p) => {
            const buildings = await getBuildings(companyId, p.id).catch(() => []);
            return buildings.map((b) => ({ id: b.id, name: b.name, projectId: p.id }));
          }),
        );
        if (!cancelled) setBuildingOptions(perProject.flat());
      } catch {
        if (!cancelled) {
          setProjectOptions([]);
          setBuildingOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Company switch resets to the first page with cleared scope filters.
  const activeCompany = companyId ?? '';
  const [seenCompany, setSeenCompany] = useState(activeCompany);
  if (seenCompany !== activeCompany) {
    setSeenCompany(activeCompany);
    setPage(1);
    setProject('');
    setBuilding('');
    setStatusFilter('');
    setVisibility('');
  }

  const canMutate = !companyRole || canAccess(companyRole, 'apartments-mutate');
  const visibleBuildings = buildingOptions.filter((b) => !project || b.projectId === project);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const available = data?.available ?? 0;
  const reserved = data?.reserved ?? 0;
  const sold = data?.sold ?? 0;

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(1, next), Math.max(1, totalPages));
    if (clamped !== page) setPage(clamped);
  }

  const filters = (
    <>
      <select
        aria-label="Filter by project"
        value={project}
        disabled={loading}
        onChange={(e) => {
          setProject(e.target.value);
          setBuilding('');
          setPage(1);
        }}
      >
        <option value="">All Projects</option>
        {projectOptions.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by building"
        value={building}
        disabled={loading}
        onChange={(e) => {
          setBuilding(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All Buildings</option>
        {visibleBuildings.map((b) => (
          <option value={b.id} key={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={statusFilter}
        disabled={loading}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All Statuses</option>
        <option value="AVAILABLE">Available</option>
        <option value="RESERVED">Reserved</option>
        <option value="SOLD">Sold</option>
      </select>
      <select
        aria-label="Visibility"
        value={visibility}
        disabled={loading}
        onChange={(e) => {
          setVisibility(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All Visibility</option>
        <option value="true">Public</option>
        <option value="false">Private</option>
      </select>
    </>
  );

  return (
    <>
      <PageHeader
        title="Apartments"
        description="Manage apartment inventory, pricing, structural placement, and public visibility."
      >
        {canMutate && (
          <ButtonLink href="/app/apartments/new">
            <Plus size={16} />
            Create Apartment
          </ButtonLink>
        )}
      </PageHeader>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading apartments…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchPage} />
      ) : data && total === 0 ? (
        <EmptyState title="No apartments yet" description="No apartments have been created yet." />
      ) : (
        <>
          <div className="stats">
            <StatCard label="Total Apartments" value={total} />
            <StatCard label="Available" value={available} detail="Ready for sale" />
            <StatCard label="Reserved" value={reserved} detail="Awaiting completion" />
            <StatCard label="Sold" value={sold} detail="Handed over" />
          </div>
          <DataTable
            rows={rows}
            filters={filters}
            placeholder="Search apartments by number, building…"
            searchText={(a) => a.number + ' ' + (a.buildingName ?? '')}
            columns={apartmentColumns(true)}
            serverPagination={{
              page,
              totalPages,
              total,
              pageSize: WORKSPACE_PAGE_SIZE,
              onPageChange: goToPage,
              loading,
            }}
          />
          <div className="section-space">
            <Panel title="Availability Split" subtitle="Company-wide inventory by status">
              <AvailabilityDonut available={available} reserved={reserved} sold={sold} total={available + reserved + sold} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Apartments of one project, derived through the real hierarchy
 * (buildings → floors → apartments). No project-level backend
 * endpoint exists.
 */
export function ApartmentsProjectList({ projectId }: { projectId: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const [rows, setRows] = useState<ApiApartmentWithParents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScoped = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getProjectApartments(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to apartments for this project.');
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

  /* eslint-disable react-hooks/set-state-in-effect -- scoped inventory load on mount */
  useEffect(() => {
    fetchScoped();
  }, [fetchScoped]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <PageHeader title="Project Apartments" description="Real apartment inventory for this project." back={'/app/projects/' + projectId} />
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading apartments…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchScoped} />
      ) : !rows.length ? (
        <EmptyState title="No apartments yet" description="No apartments have been created under this project." />
      ) : (
        <ApartmentTable rows={rows} showProject={false} projectOptions={[]} project={projectId} />
      )}
    </>
  );
}

/**
 * Workspace apartment detail: fresh single GET plus real parents.
 * Visibility toggling uses PATCH is_public. Existing images are shown;
 * PATCH cannot modify images, so no upload control is rendered here.
 * Recent enquiries stay out of scope (no leads backend) and are hidden.
 */
export function ApartmentWorkspaceDetail({ id }: { id: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [detail, setDetail] = useState<{
    number: string;
    description?: string;
    area: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    price: number | null;
    status: string;
    isPublic: boolean;
    images: Array<{ id: string; url: string }>;
    projectName?: string;
    projectLocation?: string;
    projectDescription?: string;
    projectId: string;
    buildingId: string;
    floorId: string;
    buildingName?: string;
    floorName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { apartment: a, chain } = await getApartmentById(companyId, id);
      const project = await getProject(companyId, chain.projectId).catch(() => null);
      setDetail({
        number: a.number,
        description: a.description,
        area: a.area,
        bedrooms: a.bedrooms,
        bathrooms: a.bathrooms,
        price: a.price,
        status: a.status,
        isPublic: a.isPublic,
        images: a.images,
        projectName: project?.name ?? chain.projectName,
        projectLocation: project?.location,
        projectDescription: project?.description,
        projectId: chain.projectId,
        buildingId: chain.buildingId,
        floorId: chain.floorId,
        buildingName: chain.buildingName,
        floorName: chain.floorName,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Apartment not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this apartment.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleVisibility = async () => {
    if (!companyId || !detail) return;
    setToggling(true);
    try {
      const updated = await updateApartment(
        companyId,
        detail.projectId,
        detail.buildingId,
        detail.floorId,
        id,
        { isPublic: !detail.isPublic },
      );
      clearApartmentIndex(companyId);
      setDetail({ ...detail, isPublic: updated.isPublic });
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading apartment…
      </p>
    );
  }
  if (error || !detail) {
    return (
      <>
        <ListError message={error ?? 'Apartment not found.'} onRetry={fetchDetail} />
        <p className="section-space">
          <TextLink href="/app/apartments">Back to Apartments</TextLink>
        </p>
      </>
    );
  }

  const a = detail;
  const canMutate = !companyRole || canAccess(companyRole, 'apartments-mutate');
  const hero = a.images[0]?.url ?? FALLBACK_IMAGE;
  const hierarchy = [a.projectName, a.buildingName, a.floorName].filter(Boolean).join(' • ');
  return (
    <>
      <PageHeader
        title={'Apartment ' + a.number}
        description={hierarchy || 'Apartment details'}
        back="/app/apartments"
      >
        <Badge value={a.status} />
        {canMutate && (
          <ButtonLink secondary href={'/app/apartments/' + id + '/edit'}>
            <Pencil size={15} />
            Edit Apartment
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Area" value={a.area === null ? '—' : a.area + ' sqm'} icon={<Square size={14} />} />
        <StatCard label="Bedrooms" value={a.bedrooms === null ? '—' : a.bedrooms} icon={<BedDouble size={14} />} />
        <StatCard label="Bathrooms" value={a.bathrooms === null ? '—' : a.bathrooms} icon={<Bath size={14} />} />
        <StatCard label="Price" value={a.price === null ? '—' : money(a.price)} />
        <StatCard label="Status" value={a.status} />
      </div>
      <div className="two-column">
        <div className="stack">
          <Panel title="Unit Profile">
            <div className="eyebrow">Unit Profile</div>
            <h3 className="section-space">Apartment {a.number}</h3>
            <div>
              <img className="hero-image" style={{ height: 390 }} src={hero} alt={'Interior of Apartment ' + a.number} />
              <p className="small" style={{ marginTop: 8 }}>
                {a.images.length ? 'Apartment Image' : 'No images uploaded yet'}
              </p>
            </div>
            {a.images.length > 1 && (
              <div className="three-grid section-space">
                {a.images.slice(1).map((img) => (
                  <img key={img.id} src={img.url} alt={'Apartment ' + a.number + ' photo'} style={{ borderRadius: 8 }} />
                ))}
              </div>
            )}
            <p className="section-space">{a.description || 'No description provided.'}</p>
            <div className="unit-facts">
              <span>
                <Square />
                {a.area === null ? '—' : a.area + ' sqm'}
              </span>
              <span>
                <BedDouble />
                {a.bedrooms === null ? '—' : a.bedrooms + ' Bedrooms'}
              </span>
              <span>
                <Bath />
                {a.bathrooms === null ? '—' : a.bathrooms + ' Bathrooms'}
              </span>
            </div>
          </Panel>
          <Panel title="Physical Location Specifications">
            <DetailList
              items={[
                ['Project', <Link key="project" href={'/app/projects/' + a.projectId}>{a.projectName ?? '—'}</Link>],
                ['Building', a.buildingName ?? '—'],
                ['Floor', a.floorName ?? '—'],
                ['Apartment Number', a.number],
                ['Status', <Badge key="status" value={a.status} />],
              ]}
            />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Public Visibility">
            <p className="small">
              {a.isPublic
                ? 'Apartment is visible on the public property catalog.'
                : 'This unit is visible only in the company workspace.'}
            </p>
            {canMutate && (
              <button
                className="button secondary section-space"
                onClick={toggleVisibility}
                disabled={toggling}
              >
                {toggling ? 'Saving…' : a.isPublic ? 'Make Private' : 'Publish Apartment'}
              </button>
            )}
          </Panel>
          <Panel title="Record Metadata">
            <DetailList
              items={[
                ['Reference', id.slice(0, 8)],
                ['Project', a.projectName ?? '—'],
                ['Status', <Badge key="meta-status" value={a.status} />],
              ]}
            />
          </Panel>
          <Panel title={'Part of ' + (a.projectName ?? 'project')}>
            <p className="small">{a.projectDescription}</p>
            <div className="section-space">
              <TextLink href={'/app/projects/' + a.projectId}>View Project</TextLink>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
