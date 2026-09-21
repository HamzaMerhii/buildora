'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, BedDouble, Bath, Square } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  clearApartmentIndex,
  getApartmentById,
  getCompanyApartments,
  getProjectApartments,
  updateApartment,
  type ApiApartmentWithParents,
} from '@/lib/api/apartment.api';
import { getProject } from '@/lib/api/project.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { money } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  Badge,
  Panel,
  TextLink,
  EmptyState,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';

const FALLBACK_IMAGE = '/images/33b403bb7596.webp';
const FLOOR_PLAN_IMAGE = '/images/c697c8220da9.webp';

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

function ApartmentTable({
  rows,
  showProject,
  projectOptions,
  project,
  onProjectChange,
}: {
  rows: ApiApartmentWithParents[];
  showProject: boolean;
  projectOptions: Array<{ id: string; name: string }>;
  project: string;
  onProjectChange?: (value: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const filtered = rows.filter(
    (a) =>
      (!project || a.projectId === project) &&
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
      columns={[
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
      ]}
    />
  );
}

/**
 * Company-wide apartment inventory. No global backend endpoint exists,
 * so this traverses project → building → floor → apartment through the
 * real scoped endpoints (parallelized, indexed per company).
 */
export function ApartmentsWorkspaceList() {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [rows, setRows] = useState<ApiApartmentWithParents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState('');

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getCompanyApartments(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to apartments for this company.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- inventory load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canMutate = !companyRole || canAccess(companyRole, 'apartments-mutate');
  const projectOptions = [...new Map(rows.map((a) => [a.projectId, a.projectName ?? a.projectId])).entries()].map(
    ([id, name]) => ({ id, name }),
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
        <ListError message={error} onRetry={fetchAll} />
      ) : (
        <ApartmentTable
          rows={rows}
          showProject
          projectOptions={projectOptions}
          project={project}
          onProjectChange={setProject}
        />
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
      const project = await getProject(companyId, projectId).catch(() => null);
      setRows(await getProjectApartments(companyId, projectId, project?.name));
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
  return (
    <>
      <PageHeader
        title={'Apartment ' + a.number}
        description={(a.projectName ?? '') + (a.projectLocation ? ' · ' + a.projectLocation : '')}
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
      <div className="two-column">
        <div className="stack">
          <img className="hero-image" style={{ height: 390 }} src={hero} alt={'Interior of Apartment ' + a.number} />
          {a.images.length > 1 && (
            <div className="three-grid">
              {a.images.slice(1).map((img) => (
                <img key={img.id} src={img.url} alt={'Apartment ' + a.number + ' photo'} style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}
          <Panel title="Physical Location Specifications">
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
            <DetailList
              items={[
                ['Project', a.projectName],
                ['Building', a.buildingName],
                ['Floor', a.floorName],
                ['Asking Price', a.price === null ? '—' : money(a.price)],
              ]}
            />
          </Panel>
          <Panel title="Architectural Overview">
            <p>{a.description || 'No description provided.'}</p>
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
          <Panel title="Unit Floor Plan">
            <img src={FLOOR_PLAN_IMAGE} alt="Apartment architectural floor plan" style={{ width: '100%', borderRadius: 8 }} />
            <p className="small" style={{ marginTop: 12 }}>
              Architectural layout · Unit {a.number}
            </p>
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
