'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  deleteTask,
  getStageTasks,
  getTask,
  getTaskUpdates,
  isTaskOverdue,
  resolveTaskChain,
  type ApiTask,
  type ApiTaskUpdate,
} from '@/lib/api/task.api';
import { getParties } from '@/lib/api/party.api';
import {
  activeMembers,
  buildMembersByUserId,
  companyRoleLabel,
  getCompanyMembers,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
import { getProject } from '@/lib/api/project.api';
import { getStage } from '@/lib/api/construction-stage.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { TaskUpdateForm } from '../forms/ConstructionForms';
import { displayDate } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  TextLink,
  DetailList,
  Progress,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog, Dialog } from '../ui/Dialog';

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

export interface TaskSessionUser {
  id: string;
  name: string;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function resolveAssigneeLabel(
  task: Pick<ApiTask, 'assignedTo'>,
  membersByUserId: Map<string, ApiCompanyMember>,
  sessionUser: TaskSessionUser | null,
): string {
  if (!task.assignedTo) return 'Unassigned';
  const member = membersByUserId.get(task.assignedTo);
  if (member) return member.name;
  if (sessionUser && task.assignedTo === sessionUser.id) return sessionUser.name;
  return `Former member ${shortId(task.assignedTo)}`;
}

export function resolveAssigneeRole(
  task: Pick<ApiTask, 'assignedTo'>,
  membersByUserId: Map<string, ApiCompanyMember>,
  sessionUser: TaskSessionUser | null,
  sessionRole?: string | null,
): string | undefined {
  if (!task.assignedTo) return undefined;
  const member = membersByUserId.get(task.assignedTo);
  if (member) return companyRoleLabel[member.role];
  if (sessionUser && task.assignedTo === sessionUser.id && sessionRole) {
    return companyRoleLabel[sessionRole as keyof typeof companyRoleLabel] ?? sessionRole;
  }
  return undefined;
}

export function resolveUpdateAuthorName(
  userId: string,
  membersByUserId: Map<string, ApiCompanyMember>,
  sessionUser: TaskSessionUser | null,
): string {
  const member = membersByUserId.get(userId);
  if (member) return member.name;
  if (sessionUser && userId === sessionUser.id) return sessionUser.name;
  return `Former member ${shortId(userId)}`;
}

export function resolvePartyLabel(
  task: Pick<ApiTask, 'partyId'>,
  partyNames: Map<string, string>,
): string {
  if (!task.partyId) return '—';
  return partyNames.get(task.partyId) ?? `Party ${shortId(task.partyId)}`;
}

/**
 * Real task table. Assignee/contractor names resolve through lookup
 * maps built once per page (no per-row requests).
 */
export function TaskTableReal({
  rows,
  sessionUser,
  partyNames,
  membersByUserId,
}: {
  rows: ApiTask[];
  sessionUser: TaskSessionUser | null;
  partyNames: Map<string, string>;
  membersByUserId?: Map<string, ApiCompanyMember>;
}) {
  const memberMap = membersByUserId ?? new Map<string, ApiCompanyMember>();
  const [status, setStatus] = useState('');
  return (
    <DataTable
      rows={rows.filter((t) => !status || t.status === status)}
      searchText={(t) => t.title}
      placeholder="Search tasks…"
      filters={
        <select aria-label="Task status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      }
      columns={[
        {
          label: 'Task',
          value: (t) => (
            <Link href={'/app/tasks/' + t.id}>
              <strong>{t.title}</strong>
            </Link>
          ),
          sort: (t) => t.title,
        },
        { label: 'Assignee', value: (t) => resolveAssigneeLabel(t, memberMap, sessionUser) },
        { label: 'Executed By', value: (t) => resolvePartyLabel(t, partyNames) },
        {
          label: 'Due Date',
          value: (t) => (t.endDate ? displayDate(t.endDate) : '—'),
          sort: (t) => t.endDate ?? '',
        },
        { label: 'Status', value: (t) => <Badge value={t.status} /> },
        { label: 'Progress', value: (t) => <Progress value={t.progress} />, sort: (t) => t.progress },
        {
          label: 'Condition',
          value: (t) => <Badge value={isTaskOverdue(t.endDate, t.status) ? 'Overdue' : 'On Track'} />,
        },
        { label: 'Actions', value: (t) => <TextLink href={'/app/tasks/' + t.id}>View Task</TextLink> },
      ]}
    />
  );
}

/**
 * Real task list for one stage with entry point, for the stage detail
 * page. Reports the loaded count upward for the Total Tasks stat.
 */
export function StageTasksSection({
  companyId,
  projectId,
  stageId,
  canMutate,
  onCount,
}: {
  companyId: string;
  projectId: string;
  stageId: string;
  canMutate: boolean;
  onCount?: (count: number) => void;
}) {
  const sessionUser = useAuthStore((s) => s.user);
  const { tasks, loading, error, refetch } = useStageTasks(companyId, projectId, stageId);
  const partyNames = usePartyNames(companyId);
  const { membersByUserId } = useCompanyMembers(companyId);

  useEffect(() => {
    if (!loading && !error) onCount?.(tasks.length);
  }, [loading, error, tasks.length, onCount]);

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading tasks…
      </p>
    );
  }
  if (error) {
    return <ListError message={error} onRetry={refetch} />;
  }
  return (
    <>
      {canMutate && (
        <p className="section-space">
          <ButtonLink secondary href={`/app/tasks/new?projectId=${projectId}&stageId=${stageId}`}>
            <Plus size={15} />
            New Task
          </ButtonLink>
        </p>
      )}
      <TaskTableReal rows={tasks} sessionUser={sessionUser} partyNames={partyNames} membersByUserId={membersByUserId} />
    </>
  );
}

function useCompanyId(): string | null {
  return useAuthStore((s) => s.companyId);
}

function useCanMutateTasks(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || canAccess(companyRole, 'tasks-mutate');
}

/**
 * Real task list for one stage (list endpoint scoped to the stage).
 * Used by the stage detail page.
 */
export function useStageTasks(
  companyId: string | null,
  projectId: string | null,
  stageId: string | null,
): { tasks: ApiTask[]; loading: boolean; error: string | null; refetch: () => void } {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!companyId || !projectId || !stageId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTasks(await getStageTasks(companyId, projectId, stageId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Stage not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to these tasks.');
      } else {
        setError(friendlyMessage(err));
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, stageId]);

  /* eslint-disable react-hooks/set-state-in-effect -- stage task list load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { tasks, loading, error, refetch: fetchAll };
}

/** One party-name map per page (single getParties call, shared lookups). */
export function usePartyNames(companyId: string | null): Map<string, string> {
  const [partyNames, setPartyNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    getParties(companyId)
      .then((list) => {
        if (!cancelled) setPartyNames(new Map(list.map((p) => [p.id, p.name])));
      })
      .catch(() => {
        if (!cancelled) setPartyNames(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return partyNames;
}

/** One member map per page (single getCompanyMembers call, shared lookups). */
export function useCompanyMembers(companyId: string | null): {
  membersByUserId: Map<string, ApiCompanyMember>;
} {
  const [membersByUserId, setMembersByUserId] = useState<Map<string, ApiCompanyMember>>(
    new Map(),
  );

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    getCompanyMembers(companyId)
      .then((list) => {
        if (!cancelled) setMembersByUserId(buildMembersByUserId(activeMembers(list)));
      })
      .catch(() => {
        if (!cancelled) setMembersByUserId(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { membersByUserId };
}

/**
 * Real task detail. Chain resolved from ?projectId=&stageId= hints,
 * otherwise by company traversal. Updates listed newest-first with a
 * real photo-aware log; the update dialog posts multipart updates and
 * refreshes both task and history on save.
 */
export function TaskWorkspaceDetail({
  id,
  updateInitially = false,
}: {
  id: string;
  updateInitially?: boolean;
}) {
  const companyId = useCompanyId();
  const sessionUser = useAuthStore((s) => s.user);
  const companyRole = useAuthStore((s) => s.companyRole);
  const canMutate = useCanMutateTasks();
  const { notify } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hintProjectId = searchParams.get('projectId');
  const hintStageId = searchParams.get('stageId');
  const [chain, setChain] = useState<{ projectId: string; stageId: string } | null>(null);
  const [task, setTask] = useState<ApiTask | null>(null);
  const [updates, setUpdates] = useState<ApiTaskUpdate[]>([]);
  const [partyNames, setPartyNames] = useState<Map<string, string>>(new Map());
  const [membersByUserId, setMembersByUserId] = useState<Map<string, ApiCompanyMember>>(
    new Map(),
  );
  const [stageName, setStageName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(updateInitially);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveTaskChain(
        companyId,
        id,
        hintProjectId && hintStageId ? { projectId: hintProjectId, stageId: hintStageId } : undefined,
      );
      const { projectId, stageId } = resolved.chain;
      const [fresh, history, parties, members, stage, project] = await Promise.all([
        getTask(companyId, projectId, stageId, id),
        getTaskUpdates(companyId, projectId, stageId, id).catch(() => [] as ApiTaskUpdate[]),
        getParties(companyId).catch(() => []),
        getCompanyMembers(companyId).catch(() => [] as ApiCompanyMember[]),
        getStage(companyId, projectId, stageId).catch(() => null),
        getProject(companyId, projectId).catch(() => null),
      ]);
      setChain({ projectId, stageId });
      setTask(fresh);
      setUpdates(history);
      setPartyNames(new Map(parties.map((p) => [p.id, p.name])));
      setMembersByUserId(buildMembersByUserId(activeMembers(members)));
      setStageName(stage?.name ?? '');
      setProjectName(project?.name ?? '');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Task not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this task.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id, hintProjectId, hintStageId]);

  /* eslint-disable react-hooks/set-state-in-effect -- task detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async () => {
    if (!companyId || !chain) return;
    setDeleting(true);
    try {
      await deleteTask(companyId, chain.projectId, chain.stageId, id);
      notify('Task deleted.');
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
        Loading task…
      </p>
    );
  }
  if (error || !task || !chain) {
    return <ListError message={error ?? 'Task not found.'} onRetry={fetchDetail} />;
  }

  const t = task;
  const assigneeLabel = resolveAssigneeLabel(t, membersByUserId, sessionUser);
  const assigneeRole = resolveAssigneeRole(t, membersByUserId, sessionUser, companyRole);
  const partyLabel = resolvePartyLabel(t, partyNames);

  return (
    <>
      <PageHeader title={t.title} description={`${stageName || 'Stage'} · ${projectName || 'Project'}`} back="/app/construction">
        <Badge value={t.status} />
        {canMutate && (
          <ButtonLink secondary href={'/app/tasks/' + id + '/edit'}>
            <Pencil size={14} />
            Edit Task
          </ButtonLink>
        )}
        {canMutate && (
          <button className="button" onClick={() => setUpdating(true)}>
            <Plus size={15} />
            Add Task Update
          </button>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Assignee" value={assigneeLabel} detail={assigneeRole} />
        <StatCard label="Executed By" value={partyLabel} />
        <StatCard label="Start Date" value={t.startDate ? displayDate(t.startDate) : '—'} />
        <StatCard label="Due Date" value={t.endDate ? displayDate(t.endDate) : '—'} />
        <StatCard label="Progress" value={t.progress + '%'} />
      </div>
      <div className="two-column">
        <div className="stack">
          <Panel title="Task Information & Technical Specs">
            <p>{t.description || 'No description provided.'}</p>
            <h3>Current Completion Rate</h3>
            <div className="section-space">
              <Progress value={t.progress} />
            </div>
          </Panel>
          <Panel title="Task Updates" subtitle="Sequential log of site field entries">
            {!updates.length ? (
              <p className="small">No updates logged yet.</p>
            ) : (
              updates.map((u) => (
                <div className="activity" key={u.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {resolveUpdateAuthorName(u.userId, membersByUserId, sessionUser)}{' '}
                      · Progress → {u.progress}%
                    </strong>
                    <p>{displayDate(u.createdAt)}</p>
                    <p>{u.notes}</p>
                    {u.photoUrl && <img src={u.photoUrl} alt="Site progress verification" />}
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Task Metadata & Specs">
            <DetailList
              items={[
                ['Stage', stageName || '—'],
                ['Assigned To', assigneeRole ? `${assigneeLabel} · ${assigneeRole}` : assigneeLabel],
                ['Executed By', partyLabel],
                ['Status', <Badge key="status" value={t.status} />],
                ['Blueprint Ref', 'A-201 (Cadastral)'],
              ]}
            />
            {canMutate && (
              <button
                className="button secondary section-space"
                onClick={() => setConfirming(true)}
                disabled={deleting}
              >
                Delete Task
              </button>
            )}
          </Panel>
        </div>
      </div>
      <Dialog
        open={updating}
        onClose={() => setUpdating(false)}
        title="Add Task Update"
        drawer
      >
        <TaskUpdateForm
          chain={{ companyId: companyId ?? '', projectId: chain.projectId, stageId: chain.stageId }}
          taskId={id}
          currentStatus={t.status}
          currentProgress={t.progress}
          taskTitle={t.title}
          onClose={() => setUpdating(false)}
          onSaved={fetchDetail}
        />
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        title="Delete task?"
        description="Deleting this task also removes its update history. This cannot be undone."
      />
    </>
  );
}
