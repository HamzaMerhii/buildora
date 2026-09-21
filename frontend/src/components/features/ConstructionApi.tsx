'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  deleteStage,
  getStages,
  mapStageOrderToReorderPayload,
  reorderStages,
  resolveStageProject,
  type ApiStage,
} from '@/lib/api/construction-stage.api';
import { getProject, getProjects } from '@/lib/api/project.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { TasksTable } from './Construction';
import { displayDate } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  EmptyState,
} from '../ui/Primitives';
import { ConfirmDialog } from '../ui/Dialog';

/**
 * Minimal reorder interaction for the milestone list. Move up/down
 * buttons edit a local order; Save persists the FULL ordered set
 * (0-based, as the backend requires) and reconciles with the returned
 * list. On failure the local order rolls back to the prop order so the
 * UI never shows an order that was never persisted.
 */
export function ReorderStages({
  companyId,
  projectId,
  stages,
  onDone,
  onCancel,
}: {
  companyId: string;
  projectId: string;
  stages: ApiStage[];
  onDone: (stages: ApiStage[]) => void;
  onCancel: () => void;
}) {
  const [ordered, setOrdered] = useState<string[]>(() => stages.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (id: string, direction: -1 | 1) => {
    setOrdered((prev) => {
      const index = prev.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await reorderStages(
        companyId,
        projectId,
        mapStageOrderToReorderPayload(ordered.map((id) => ({ id }))),
      );
      onDone(updated);
    } catch (err) {
      setOrdered(stages.map((s) => s.id));
      if (err instanceof ApiError && err.status === 400) {
        setError(err.detail || 'Reorder rejected. The full stage list is required.');
      } else {
        setError(friendlyMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const byId = new Map(stages.map((s) => [s.id, s]));
  return (
    <div className="stack" aria-live="polite">
      {ordered.map((id, i) => {
        const stage = byId.get(id);
        if (!stage) return null;
        return (
          <div key={id} className="toolbar" style={{ borderRadius: 10 }}>
            <span className="small muted" style={{ minWidth: 56 }}>
              Position {i + 1}
            </span>
            <strong style={{ flex: 1 }}>{stage.name}</strong>
            <button
              className="icon-button"
              type="button"
              aria-label={`Move ${stage.name} up`}
              disabled={saving || i === 0}
              onClick={() => move(id, -1)}
            >
              <ChevronUp size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Move ${stage.name} down`}
              disabled={saving || i === ordered.length - 1}
              onClick={() => move(id, 1)}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        );
      })}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="button" onClick={save} disabled={saving}>
          {saving ? 'Saving order…' : 'Save order'}
        </button>
      </div>
    </div>
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

// Stage mutations require OWNER/PROJECT_MANAGER backend-side. The frontend
// permission map has no stage-mutate key, so the PM-level 'projects-mutate'
// key is used as the documented proxy for these gates.
function useCanMutateStages(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || canAccess(companyRole, 'projects-mutate');
}

function useCompanyId(): string | null {
  return useAuthStore((s) => s.companyId);
}

/**
 * Real Construction overview. When projectId is fixed (project subpage)
 * the selector is hidden; otherwise projects come from the real list.
 * Stage stats are real; task sections stay mock-driven until the tasks
 * task (mock task ids never match real stage ids, so they render empty).
 */
export function ConstructionWorkspaceOverview({ projectId }: { projectId?: string }) {
  const companyId = useCompanyId();
  const canMutate = useCanMutateStages();
  const { data } = useWorkspace();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [project, setProject] = useState(projectId ?? '');
  const [projectName, setProjectName] = useState('');
  const [stages, setStages] = useState<ApiStage[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(!projectId);
  const [loadingStages, setLoadingStages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (projectId || !companyId) return;
    setLoadingProjects(true);
    try {
      const list = await getProjects(companyId, { limit: 100 });
      setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      setProject((prev) => prev || list[0]?.id || '');
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- project options load on mount */
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fetchStages = useCallback(async () => {
    const pid = projectId ?? project;
    if (!companyId) {
      setLoadingStages(false);
      setError('No company context. Please sign in again.');
      return;
    }
    if (!pid) {
      setLoadingStages(false);
      setStages([]);
      return;
    }
    setLoadingStages(true);
    setError(null);
    try {
      const [list, proj] = await Promise.all([
        getStages(companyId, pid),
        projectId
          ? getProject(companyId, pid).catch(() => null)
          : Promise.resolve(projects.find((p) => p.id === pid) ?? null),
      ]);
      setStages(list);
      setProjectName(
        projectId ? (proj?.name ?? '') : (projects.find((p) => p.id === pid)?.name ?? ''),
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to construction stages.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setStages([]);
    } finally {
      setLoadingStages(false);
    }
  }, [companyId, projectId, project, projects]);

  /* eslint-disable react-hooks/set-state-in-effect -- stage list load on project change */
  useEffect(() => {
    fetchStages();
  }, [fetchStages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const tasks = data.tasks.filter((t) => stages.some((s) => s.id === t.stageId));
  const [reordering, setReordering] = useState(false);
  const activeProjectId = projectId ?? project;

  return (
    <>
      <PageHeader title="Construction" description="Track project stages, tasks, and current site activity.">
        {!projectId && (
          <select
            className="filter-select"
            aria-label="Construction project"
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setReordering(false);
            }}
            disabled={loadingProjects}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {canMutate && (
          <ButtonLink secondary href="/app/construction/stages/new">
            <Plus size={15} />
            New Stage
          </ButtonLink>
        )}
        <ButtonLink href="/app/tasks/new">
          <Plus size={15} />
          New Task
        </ButtonLink>
      </PageHeader>
      <div className="stats">
        <StatCard label="Active Stages" value={stages.filter((s) => s.status === 'IN_PROGRESS').length} />
        <StatCard label="Total Stages" value={stages.length} detail="In this project" />
      </div>
      <Panel
        title="Milestone Overview"
        subtitle={(projectName || 'Project') + ' — Construction Stages'}
        action={
          canMutate && stages.length > 1 && !reordering ? (
            <button className="button secondary" type="button" onClick={() => setReordering(true)}>
              Reorder stages
            </button>
          ) : undefined
        }
      >
        {loadingStages ? (
          <p className="small" role="status" aria-live="polite">
            Loading stages…
          </p>
        ) : error ? (
          <ListError message={error} onRetry={fetchStages} />
        ) : reordering && companyId && activeProjectId ? (
          <ReorderStages
            companyId={companyId}
            projectId={activeProjectId}
            stages={stages}
            onDone={(updated) => {
              setStages(updated);
              setReordering(false);
            }}
            onCancel={() => setReordering(false)}
          />
        ) : stages.length ? (
          <div className="stage-grid">
            {stages.map((s) => (
              <Link
                href={'/app/construction/stages/' + s.id + '?projectId=' + (projectId ?? project)}
                key={s.id}
                className={'stage-card ' + (s.status === 'IN_PROGRESS' ? 'active' : '')}
              >
                <div className="eyebrow">Phase {String(s.order + 1).padStart(2, '0')}</div>
                <Badge value={s.status} />
                <h3>{s.name}</h3>
                <small>
                  {s.startDate ? displayDate(s.startDate) : '—'}
                  <br />
                  {s.endDate ? displayDate(s.endDate) : '—'}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No construction stages yet"
            href={canMutate ? '/app/construction/stages/new' : undefined}
            action="Create Stage"
          />
        )}
      </Panel>
      <div className="section-space">
        <h2 style={{ marginBottom: 16 }}>Tasks Requiring Attention</h2>
        <TasksTable rows={tasks} />
      </div>
      <div className="two-column section-space">
        <Panel title="Recent Task Updates">
          {data.updates
            .filter((u) => tasks.some((t) => t.id === u.taskId))
            .map((u) => (
              <div key={u.id} className="activity">
                <span className="activity-dot" />
                <div>
                  <strong>Omar Saleh</strong>
                  <time>{displayDate(u.date)}</time>
                  <p>Updated progress to {u.progress}%</p>
                  <p>{u.notes}</p>
                </div>
              </div>
            ))}
        </Panel>
        <Panel title="Active Worksite Anchor">
          <img src="/images/6f8d06409fc0.webp" alt="Construction site" style={{ height: 170, width: '100%', borderRadius: 8 }} />
          <p className="small section-space">
            Concrete pouring and reinforcement focused on floor framing. Coordinate field inspections with the site supervisor.
          </p>
        </Panel>
      </div>
    </>
  );
}

/**
 * Real stage detail. The project is resolved from ?projectId= when
 * present, otherwise by traversing the company's projects. Task
 * sections stay mock-driven until the tasks task.
 */
export function StageWorkspaceDetail({ id }: { id: string }) {
  const companyId = useCompanyId();
  const canMutate = useCanMutateStages();
  const { notify } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hintProjectId = searchParams.get('projectId');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [stage, setStage] = useState<ApiStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { data } = useWorkspace();

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveStageProject(
        companyId,
        id,
        hintProjectId ? { id: hintProjectId } : undefined,
      );
      setProjectId(resolved.projectId);
      setStage(resolved.stage);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Stage not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this construction stage.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setStage(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id, hintProjectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- stage detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async () => {
    if (!companyId || !projectId) return;
    setDeleting(true);
    try {
      await deleteStage(companyId, projectId, id);
      notify('Construction stage deleted.');
      router.push('/app/construction');
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading stage…
      </p>
    );
  }
  if (error || !stage || !projectId) {
    return <ListError message={error ?? 'Stage not found.'} onRetry={fetchDetail} />;
  }

  const tasks = data.tasks.filter((t) => t.stageId === id);
  return (
    <>
      <PageHeader title={stage.name} description="Manage tasks and timeline for this construction stage." back="/app/construction">
        <Badge value={stage.status} />
        {canMutate && (
          <ButtonLink secondary href={'/app/construction/stages/' + id + '/edit?projectId=' + projectId}>
            <Pencil size={15} />
            Edit Stage
          </ButtonLink>
        )}
        {canMutate && (
          <button className="button secondary" onClick={() => setConfirming(true)} disabled={deleting}>
            Delete Stage
          </button>
        )}
        <ButtonLink href="/app/tasks/new">
          <Plus size={15} />
          New Task
        </ButtonLink>
      </PageHeader>
      <div className="stats">
        <StatCard label="Order Index" value={String(stage.order + 1).padStart(2, '0')} />
        <StatCard label="Start Date" value={stage.startDate ? displayDate(stage.startDate) : '—'} />
        <StatCard label="Due Date" value={stage.endDate ? displayDate(stage.endDate) : '—'} />
        <StatCard label="Total Tasks" value={tasks.length} />
      </div>
      <Panel title="Scope & Description">
        <p>{stage.description || 'No description provided.'}</p>
      </Panel>
      <div className="section-space">
        <TasksTable rows={tasks} />
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        title="Delete construction stage?"
        description="Deleting this stage also removes its tasks. This cannot be undone."
      />
    </>
  );
}
