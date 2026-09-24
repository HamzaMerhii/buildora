'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Download, MapPin, Building2, LayoutGrid, List, Search, Pencil, Layers, Calendar, Wallet } from 'lucide-react';
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
import { ProjectPaymentsSummary } from './PaymentsApi';
import { getStages, type ApiStage } from '@/lib/api/construction-stage.api';
import {
  getStageTasks,
  getTaskUpdates,
  isTaskOverdue,
  type ApiTask,
  type ApiTaskUpdate,
} from '@/lib/api/task.api';
import {
  formatAmount,
  getProjectPayments,
  type ApiPayment,
} from '@/lib/api/payment.api';
import {
  getPaymentCategories,
  type ApiPaymentCategory,
} from '@/lib/api/payment-category.api';
import {
  activeMembers,
  buildMembersByUserId,
  getCompanyMembers,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
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
  Progress,
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

function monthYear(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Per-card enrichment. A key is present only when its source loaded
 * successfully — absent means unavailable (wrong role or failed
 * request), so the card omits that section instead of faking it.
 */
interface CardStats {
  stages?: ApiStage[];
  overdue?: number;
  buildings?: number;
}

function ApiProjectCard({ project: p, stats }: { project: ApiProject; stats?: CardStats }) {
  const startLabel = monthYear(p.startDate);
  const endLabel = monthYear(p.endDate);
  const dateBadge = startLabel || endLabel ? [startLabel ?? '—', endLabel ?? '—'].join(' – ') : null;
  const orderedStages = stats?.stages ? [...stats.stages].sort((a, b) => a.order - b.order) : null;
  const activeStage =
    orderedStages?.find((s) => s.status === 'IN_PROGRESS') ?? orderedStages?.[0] ?? null;
  const stagePosition = activeStage && orderedStages ? orderedStages.indexOf(activeStage) + 1 : null;
  const counts = [
    stats?.buildings !== undefined ? `${stats.buildings} Bldg${stats.buildings === 1 ? '' : 's'}` : null,
    stats?.overdue !== undefined && stats.overdue > 0 ? `${stats.overdue} Overdue` : null,
  ].filter((c): c is string => c !== null);
  return (
    <article className="project-card project-card-rich">
      <div className="project-card-top">
        <span className="location">
          <MapPin size={13} aria-hidden="true" />
          {p.location ?? 'Location not set'}
        </span>
        <Badge value={p.status} />
      </div>
      <h3>
        <Link href={'/app/projects/' + p.id}>{p.name}</Link>
      </h3>
      <Link href={'/app/projects/' + p.id} className="project-image" style={{ display: 'block' }} aria-label={'View ' + p.name}>
        <img src={p.image ?? FALLBACK_IMAGE} alt={p.name} />
        {dateBadge && <span className="date-badge">{dateBadge}</span>}
      </Link>
      <div className="project-card-body">
        <div className="project-card-progress">
          <div className="progress-head">
            <span className="progress-label">Project Progress</span>
            <strong>{p.progressPercent === null ? '—' : `${p.progressPercent}%`}</strong>
          </div>
          {p.progressPercent === null ? (
            <p className="progress-helper">Progress not set</p>
          ) : (
            <>
              <Progress value={p.progressPercent} />
              <p className="progress-helper">{p.progressPercent}% Complete</p>
            </>
          )}
        </div>
        {orderedStages && (
          <p className="project-card-stage">
            <Layers size={14} aria-hidden="true" />
            {activeStage && stagePosition !== null ? (
              <span>
                Stage {stagePosition} of {orderedStages.length}: {activeStage.name}
              </span>
            ) : (
              <small>No active stage</small>
            )}
          </p>
        )}
      </div>
      <div className="project-card-footer">
        <span className="counts">{counts.join(' · ')}</span>
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

  // Card enrichment, loaded once per page of projects. Stages,
  // buildings, and overdue tasks fan out in parallel; each source is
  // role-gated (buildings need `projects-mutate`, stages/tasks are
  // readable by all company roles) and every request degrades to
  // "unavailable" on failure — the card omits that section.
  // Payments are intentionally NOT fetched here: cards show the real
  // persisted projects.progress_percent, never payment-derived totals.
  const [statsByProject, setStatsByProject] = useState<Map<string, CardStats>>(new Map());

  useEffect(() => {
    if (!companyId || !rows.length) return;
    let cancelled = false;
    const canReadStructure = !companyRole || canAccess(companyRole, 'projects-mutate');
    (async () => {
      const entries = await Promise.all(
        rows.map(async (p) => {
          const stats: CardStats = {};
          const [stages, buildings] = await Promise.all([
            getStages(companyId, p.id).catch(() => null),
            canReadStructure ? getBuildings(companyId, p.id).catch(() => null) : null,
          ]);
          if (stages) {
            stats.stages = stages;
            const taskLists = await Promise.all(
              stages.map((s) => getStageTasks(companyId, p.id, s.id).catch(() => null)),
            );
            if (taskLists.every((t) => t !== null)) {
              stats.overdue = taskLists
                .flat()
                .filter((t) => isTaskOverdue(t!.endDate, t!.status)).length;
            }
          }
          if (buildings) stats.buildings = buildings.length;
          return [p.id, stats] as const;
        }),
      );
      if (!cancelled) setStatsByProject(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, companyRole, rows]);

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
            <ApiProjectCard project={p} key={p.id} stats={statsByProject.get(p.id)} />
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

  // Overview enrichment: one parallel fan-out per project/role change.
  // Stages/tasks/updates/floors are company-member readable; updates
  // need site management; payments/categories need the `payments`
  // module; buildings/apartments need `projects-mutate`; members are
  // best-effort (OWNER-only endpoint). Every source degrades to null.
  interface OverviewTask extends ApiTask {
    stageName?: string;
  }
  const [overview, setOverview] = useState<{
    stages: ApiStage[] | null;
    tasks: OverviewTask[] | null;
    updates: ApiTaskUpdate[] | null;
    payments: ApiPayment[] | null;
    categories: ApiPaymentCategory[] | null;
    asset: { buildings: number; floors: number; units: number } | null;
    membersByUserId: Map<string, ApiCompanyMember>;
  } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const canReadPayments = !companyRole || canAccess(companyRole, 'payments');
    const canReadStructure = !companyRole || canAccess(companyRole, 'projects-mutate');
    const canReadUpdates =
      !companyRole || canAccess(companyRole, 'tasks-mutate');
    (async () => {
      const [stagesRaw, paymentsRaw, categoriesRaw, buildingsRaw, membersRaw] =
        await Promise.all([
          getStages(companyId, id).catch(() => null),
          canReadPayments ? getProjectPayments(companyId, id).catch(() => null) : null,
          canReadPayments ? getPaymentCategories().catch(() => [] as ApiPaymentCategory[]) : [],
          canReadStructure ? getBuildings(companyId, id).catch(() => null) : null,
          getCompanyMembers(companyId).catch(() => [] as ApiCompanyMember[]),
        ]);
      const stages = stagesRaw ? [...stagesRaw].sort((a, b) => a.order - b.order) : null;
      let tasks: OverviewTask[] | null = null;
      if (stages) {
        const perStage = await Promise.all(
          stages.map(async (s) => {
            const list = await getStageTasks(companyId, id, s.id).catch(() => null);
            return (list ?? []).map((t): OverviewTask => ({ ...t, stageName: s.name }));
          }),
        );
        tasks = perStage.flat();
      }
      let updates: ApiTaskUpdate[] | null = null;
      if (tasks && canReadUpdates && tasks.length) {
        const ranked = [...tasks].sort((a, b) => {
          const aOver = isTaskOverdue(a.endDate, a.status) ? 0 : 1;
          const bOver = isTaskOverdue(b.endDate, b.status) ? 0 : 1;
          return aOver - bOver || (a.endDate ?? '').localeCompare(b.endDate ?? '');
        });
        const perTask = await Promise.all(
          ranked.slice(0, 6).map((t) => getTaskUpdates(companyId, id, t.stageId, t.id).catch(() => [] as ApiTaskUpdate[])),
        );
        updates = perTask
          .flat()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 8);
      } else if (tasks) {
        updates = [];
      }
      let asset: { buildings: number; floors: number; units: number } | null = null;
      if (buildingsRaw) {
        try {
          const perBuilding = await Promise.all(
            buildingsRaw.map(async (b) => {
              const floors = await getFloors(companyId, id, b.id).catch(() => null);
              if (!floors) return null;
              const perFloor = await Promise.all(
                floors.map((f) => getApartments(companyId, id, b.id, f.id).catch(() => null)),
              );
              if (perFloor.some((a) => a === null)) return null;
              return {
                floors: floors.length,
                units: (perFloor as ApiApartment[][]).reduce((s, a) => s + a.length, 0),
              };
            }),
          );
          if (perBuilding.every((b) => b !== null)) {
            asset = {
              buildings: buildingsRaw.length,
              floors: perBuilding.reduce((s, b) => s + b!.floors, 0),
              units: perBuilding.reduce((s, b) => s + b!.units, 0),
            };
          }
        } catch {
          asset = null;
        }
      }
      if (!cancelled) {
        setOverview({
          stages,
          tasks,
          updates,
          payments: paymentsRaw,
          categories: categoriesRaw,
          asset,
          membersByUserId: buildMembersByUserId(activeMembers(membersRaw)),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, id, companyRole]);

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
  const canMutateTasks = !companyRole || canAccess(companyRole, 'tasks-mutate');
  const ov = overview;
  const orderedStages = ov?.stages ?? null;
  const activeStage =
    orderedStages?.find((s) => s.status === 'IN_PROGRESS') ?? orderedStages?.[0] ?? null;
  const stagePosition =
    activeStage && orderedStages ? orderedStages.indexOf(activeStage) + 1 : null;
  const criticalTasks = ov?.tasks
    ? [...ov.tasks]
        .sort((a, b) => {
          const aOver = isTaskOverdue(a.endDate, a.status) ? 0 : 1;
          const bOver = isTaskOverdue(b.endDate, b.status) ? 0 : 1;
          return aOver - bOver || (a.endDate ?? '').localeCompare(b.endDate ?? '');
        })
        .slice(0, 6)
    : null;
  const tasksById = new Map((ov?.tasks ?? []).map((t) => [t.id, t]));
  const totalPaid = ov?.payments ? ov.payments.reduce((s, x) => s + x.amount, 0) : null;
  const remaining =
    totalPaid !== null && p.budget !== null ? p.budget - totalPaid : null;
  const authorName = (userId: string) =>
    ov?.membersByUserId.get(userId)?.name ?? `Team member ${userId.slice(0, 8)}`;
  return (
    <>
      <PageHeader title={p.name} description={p.location ?? 'Location not set'} back="/app/projects">
        <Badge value={p.status} />
        {activeStage && stagePosition !== null && orderedStages && (
          <span className="small">
            Stage {stagePosition} of {orderedStages.length}: {activeStage.name}
          </span>
        )}
        {canMutate && (
          <ButtonLink secondary href={'/app/projects/' + id + '/edit'}>
            <Pencil size={15} />
            Edit Project
          </ButtonLink>
        )}
        {canMutateTasks && (
          <ButtonLink href={'/app/tasks/new?projectId=' + id}>
            <Plus size={15} />
            New Task
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Start Date" value={p.startDate ? displayDate(p.startDate) : '—'} icon={<Calendar size={14} />} />
        <StatCard label="Expected End" value={p.endDate ? displayDate(p.endDate) : '—'} icon={<Calendar size={14} />} />
        <StatCard
          label="Total Budget"
          value={p.budget === null ? '—' : money(p.budget)}
          icon={<Wallet size={14} />}
        />
        <StatCard label="Location" value={p.location ?? '—'} icon={<MapPin size={14} />} />
        <StatCard
          label="Current Stage"
          value={activeStage ? activeStage.name : orderedStages ? 'No active stage' : '—'}
          icon={<Layers size={14} />}
        />
      </div>
      <div className="two-column">
        <div className="stack">
          <Panel title="Site Execution Brief">
            <div>
              <img
                className="hero-image"
                src={p.image ?? DETAIL_HERO_IMAGE}
                alt={p.name + ' project image'}
              />
            </div>
            <div className="eyebrow section-space">Site Execution Brief</div>
            <h3>
              {activeStage ? `Currently: ${activeStage.name}` : 'Project overview'}
              {p.progressPercent !== null && ` · ${p.progressPercent}%`}
            </h3>
            <p className="small section-space">{p.description || 'No description provided.'}</p>
            {p.progressPercent !== null ? (
              <div className="section-space">
                <Progress value={p.progressPercent} />
              </div>
            ) : (
              <p className="small">Project progress not set.</p>
            )}
          </Panel>
          <LandSummary projectId={id} />
          <Panel title="Construction Progress" subtitle="Real stages in execution order">
            {!orderedStages ? (
              <p className="small">Stage data is currently unavailable.</p>
            ) : !orderedStages.length ? (
              <p className="small">No construction stages yet.</p>
            ) : (
              <div className="stack">
                {orderedStages.map((s) => (
                  <div key={s.id}>
                    <div className="panel-heading" style={{ marginBottom: 8 }}>
                      <TextLink href={'/app/construction/stages/' + s.id + '?projectId=' + id}>
                        {s.name}
                      </TextLink>
                      <Badge value={s.status} />
                    </div>
                    <p className="small">
                      {s.startDate ? displayDate(s.startDate) : '—'} –{' '}
                      {s.endDate ? displayDate(s.endDate) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Critical Operational Tasks" subtitle="Overdue first, then upcoming">
            {!criticalTasks ? (
              <p className="small">Task data is currently unavailable.</p>
            ) : !criticalTasks.length ? (
              <p className="small">No open tasks for this project.</p>
            ) : (
              criticalTasks.map((t) => (
                <div className="activity" key={t.id}>
                  <span className="activity-dot" />
                  <div>
                    <TextLink href={'/app/tasks/' + t.id}>{t.title}</TextLink>
                    <p>
                      {t.stageName ?? ''} · Due {t.endDate ? displayDate(t.endDate) : '—'}
                    </p>
                    <p>
                      <Badge value={t.status} />{' '}
                      {isTaskOverdue(t.endDate, t.status) && <Badge value="Overdue" />}
                    </p>
                  </div>
                </div>
              ))
            )}
          </Panel>
          <Panel title="Recent Task Activity" subtitle="Latest site field entries">
            {!ov?.updates ? (
              <p className="small">Task activity is currently unavailable.</p>
            ) : !ov.updates.length ? (
              <p className="small">No task updates logged yet.</p>
            ) : (
              ov.updates.map((u) => (
                <div className="activity" key={u.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {authorName(u.userId)} · {tasksById.get(u.taskId)?.title ?? 'Task'} →{' '}
                      {u.progress}%
                    </strong>
                    <p>{displayDate(u.createdAt.slice(0, 10))}</p>
                    {u.notes && <p>{u.notes}</p>}
                    {u.photoUrl && <img src={u.photoUrl} alt="Site progress verification" style={{ maxWidth: 220, borderRadius: 8 }} />}
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Financial Snapshot" subtitle="Real recorded payments">
            {totalPaid === null ? (
              <p className="small">Payment data is currently unavailable for your role.</p>
            ) : (
              <>
                <DetailList
                  items={[
                    ['Total Budget', p.budget === null ? '—' : formatAmount(p.budget)],
                    ['Total Paid', formatAmount(totalPaid)],
                    ['Payments Count', ov?.payments?.length ?? 0],
                    ['Remaining', remaining === null ? '—' : formatAmount(remaining)],
                  ]}
                />
                {!!ov?.categories?.length && (
                  <div className="section-space">
                    {(ov.categories ?? []).map((c) => {
                      const t = (ov.payments ?? [])
                        .filter((x) => x.categoryId === c.id)
                        .reduce((s, x) => s + x.amount, 0);
                      if (!t) return null;
                      return (
                        <div key={c.id}>
                          <div className="panel-heading" style={{ marginBottom: 8 }}>
                            <span className="small">{c.name}</span>
                            <strong className="small">{formatAmount(t)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <p className="section-space">
              <TextLink href={'/app/projects/' + id + '/payments'}>View Payments</TextLink>
            </p>
          </Panel>
          <Panel title="Asset Structure">
            {!ov?.asset ? (
              <p className="small">Structure counts are currently unavailable for your role.</p>
            ) : (
              <DetailList
                items={[
                  ['Buildings', ov.asset.buildings],
                  ['Floors', ov.asset.floors],
                  ['Apartments', ov.asset.units],
                ]}
              />
            )}
            <p className="section-space">
              <TextLink href={'/app/projects/' + id + '/structure'}>Manage Structure</TextLink>
            </p>
          </Panel>
          <Panel title="Project Metadata">
            <DetailList
              items={[
                ['Status', <Badge key="status" value={p.status} />],
                ['Location', p.location ?? '—'],
                ['Start Date', p.startDate ? displayDate(p.startDate) : '—'],
                ['Expected End', p.endDate ? displayDate(p.endDate) : '—'],
                ['Created', displayDate(p.createdAt.slice(0, 10))],
                ['Reference', p.id.slice(0, 8)],
              ]}
            />
          </Panel>
          {companyId && (!companyRole || canAccess(companyRole, 'payments')) && (
            <ProjectPaymentsSummary companyId={companyId} projectId={id} />
          )}
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
 * and real Building Hierarchy (buildings → floors → apartment cards,
 * all loaded once at page level).
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
 * Page-level hierarchy load: buildings once, then floors per building
 * in parallel, then apartments per floor in parallel (OWNER/PM only,
 * mirrored via `apartments-mutate`). Lookup maps feed every card, so
 * no entity is fetched twice and no card fetches during render.
 * There is no DELETE building endpoint, so no delete control renders.
 */
export function BuildingsSection({ projectId }: { projectId: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [buildings, setBuildings] = useState<ApiBuilding[]>([]);
  const [floorsByBuilding, setFloorsByBuilding] = useState<Map<string, ApiFloor[]>>(new Map());
  const [apartmentsByFloor, setApartmentsByFloor] = useState<Map<string, ApiApartment[]>>(new Map());
  const [failedApartments, setFailedApartments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canMutate = !companyRole || canAccess(companyRole, 'projects-mutate');
  const canReadApartments = !companyRole || canAccess(companyRole, 'apartments-mutate');

  const fetchHierarchy = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getBuildings(companyId, projectId);
      const perBuilding = await Promise.all(
        list.map(async (b) => {
          const floors = await getFloors(companyId, projectId, b.id).catch(() => null);
          return { buildingId: b.id, floors };
        }),
      );
      const floorMap = new Map<string, ApiFloor[]>();
      for (const entry of perBuilding) {
        if (entry.floors !== null) floorMap.set(entry.buildingId, entry.floors);
      }
      const aptMap = new Map<string, ApiApartment[]>();
      const aptFailed = new Set<string>();
      if (canReadApartments) {
        const allFloors = [...floorMap].flatMap(([buildingId, floors]) =>
          floors.map((f) => ({ buildingId, floor: f })),
        );
        const perFloor = await Promise.all(
          allFloors.map(async ({ floor }) => {
            const apartments = await getApartments(companyId, projectId, floor.buildingId, floor.id).catch(
              () => null,
            );
            return { floorId: floor.id, apartments };
          }),
        );
        for (const entry of perFloor) {
          if (entry.apartments === null) aptFailed.add(entry.floorId);
          else aptMap.set(entry.floorId, entry.apartments);
        }
      }
      setBuildings(list);
      setFloorsByBuilding(floorMap);
      setApartmentsByFloor(aptMap);
      setFailedApartments(aptFailed);
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
      setFloorsByBuilding(new Map());
      setApartmentsByFloor(new Map());
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, canReadApartments]);

  /* eslint-disable react-hooks/set-state-in-effect -- hierarchy load on mount/project change */
  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalFloors = [...floorsByBuilding.values()].reduce((s, f) => s + f.length, 0);
  const allApartments = [...apartmentsByFloor.values()].flat();
  const apartmentsKnown = canReadApartments && !failedApartments.size;

  return (
    <div className="section-space">
      <h2 style={{ marginBottom: 18 }}>Building Hierarchy</h2>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading buildings…
        </p>
      ) : error ? (
        <SectionError message={error} onRetry={fetchHierarchy} />
      ) : (
        <>
          <div className="stats">
            <StatCard label="Total Buildings" value={buildings.length} detail="Structures" />
            <StatCard label="Total Floors" value={totalFloors} detail="Levels" />
            <StatCard
              label="Total Apartments"
              value={apartmentsKnown ? allApartments.length : '—'}
              detail={apartmentsKnown ? 'Units' : 'Not available for your role'}
            />
            <StatCard
              label="Public Units"
              value={apartmentsKnown ? allApartments.filter((a) => a.isPublic).length : '—'}
              detail={apartmentsKnown ? 'Listed publicly' : 'Not available for your role'}
            />
          </div>
          {!buildings.length ? (
            <EmptyState
              title="No buildings yet"
              description="Add the first structural enclosure for this project."
              href={canMutate ? '/app/projects/' + projectId + '/buildings/new' : undefined}
              action="Add Building"
            />
          ) : (
            buildings.map((b) => (
              <BuildingBlock
                key={b.id}
                projectId={projectId}
                building={b}
                floors={floorsByBuilding.get(b.id) ?? null}
                apartmentsByFloor={apartmentsByFloor}
                apartmentsFailed={failedApartments}
                canMutate={canMutate}
                canReadApartments={canReadApartments}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

/**
 * Real apartment cards for one floor, served from the page-level
 * hierarchy map (no per-card fetch).
 */
function FloorApartmentCards({ apartments }: { apartments: ApiApartment[] }) {
  if (!apartments.length) return <p className="small muted">No apartments on this floor yet.</p>;
  return (
    <div className="unit-grid">
      {apartments.map((a) => (
        <Link className="unit-card" key={a.id} href={'/app/apartments/' + a.id}>
          <div className="unit-card-head">
            <strong>Apartment {a.number}</strong>
            <Badge value={a.status} />
          </div>
          <small className="muted">
            {[a.area !== null ? `${a.area} sqm` : null, a.bedrooms !== null ? `${a.bedrooms} bd` : null, a.bathrooms !== null ? `${a.bathrooms} ba` : null]
              .filter((x): x is string => x !== null)
              .join(' · ') || 'Details on page'}
          </small>
        </Link>
      ))}
    </div>
  );
}

/**
 * One building card: floors and apartment cards from the page-level
 * hierarchy maps. Expand/collapse preserved via details/summary.
 */
function BuildingBlock({
  projectId,
  building,
  floors,
  apartmentsByFloor,
  apartmentsFailed,
  canMutate,
  canReadApartments,
}: {
  projectId: string;
  building: ApiBuilding;
  floors: ApiFloor[] | null;
  apartmentsByFloor: Map<string, ApiApartment[]>;
  apartmentsFailed: Set<string>;
  canMutate: boolean;
  canReadApartments: boolean;
}) {
  const b = building;
  const floorCount = floors?.length;
  const unitCount =
    floors && canReadApartments && !floors.some((f) => apartmentsFailed.has(f.id) || !apartmentsByFloor.has(f.id))
      ? floors.reduce((s, f) => s + (apartmentsByFloor.get(f.id)?.length ?? 0), 0)
      : null;
  return (
    <details className="structure-building" open>
      <summary>
        <Building2 size={16} aria-hidden="true" />
        <strong>{b.name}</strong>
        <span className="muted">
          {floorCount === undefined
            ? 'Floors unavailable'
            : `${floorCount} Floor${floorCount === 1 ? '' : 's'}`}
          {unitCount !== null ? ` · ${unitCount} Apartment${unitCount === 1 ? '' : 's'}` : ''}
        </span>
      </summary>
      <div className="toolbar">
        <span className="small muted" style={{ flex: 1 }}>
          {b.description || 'No description provided.'}
        </span>
        {canMutate && (
          <Link
            className="text-link"
            href={'/app/projects/' + projectId + '/buildings/' + b.id + '/edit'}
          >
            Edit Building
          </Link>
        )}
        {canMutate && (
          <ButtonLink secondary href={'/app/buildings/' + b.id + '/floors/new?projectId=' + projectId}>
            <Plus size={14} />
            Add Floor
          </ButtonLink>
        )}
      </div>
      {floors === null ? (
        <p className="small muted">Floors unavailable for this building.</p>
      ) : !floors.length ? (
        <p className="small muted">No floors yet.</p>
      ) : (
        floors.map((f) => (
          <div className="structure-floor" key={f.id}>
            <span>
              <strong>{f.name ?? `Floor ${f.number}`}</strong>
              <small className="muted" style={{ display: 'block' }}>
                Level {f.number}
                {f.description ? ` · ${f.description}` : ''}
              </small>
            </span>
            {canMutate && (
              <Link
                className="text-link"
                style={{ marginLeft: 'auto' }}
                href={'/app/buildings/' + b.id + '/floors/' + f.id + '/edit?projectId=' + projectId}
              >
                Edit Floor
              </Link>
            )}
            {canReadApartments && apartmentsByFloor.has(f.id) && (
              <div style={{ flexBasis: '100%', marginTop: 8 }}>
                <FloorApartmentCards apartments={apartmentsByFloor.get(f.id) ?? []} />
              </div>
            )}
          </div>
        ))
      )}
    </details>
  );
}
