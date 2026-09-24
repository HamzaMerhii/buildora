import { ApiError, apiForm, apiJson } from './client';
import { getProjects } from './project.api';
import { getStages } from './construction-stage.api';

/**
 * Task endpoints (verified against backend/app/routers/task.py and
 * task_updates.py). Tasks nest under
 * /companies/{company_id}/projects/{project_id}/stages/{stage_id}/tasks
 * — companyId from the Zustand session, the rest from routes, backend
 * responses, or the hierarchy index below. Never hardcoded or mock.
 *
 * Only existing backend endpoints are implemented here:
 * - POST   /  (JSON, require_site_management, 201)
 * - GET    /  (created_at desc, require_company_member = all roles)
 * - GET    /{task_id} (require_company_member)
 * - PATCH  /{task_id} (JSON partial, require_site_management)
 * - DELETE /{task_id} (204, require_site_management, cascades updates)
 * - POST   /{task_id}/updates/ (multipart, require_site_management;
 *           also rewrites the parent task progress/status)
 * - GET    /{task_id}/updates/ (created_at desc, require_site_management)
 * - GET    /{task_id}/updates/{update_id} (require_site_management)
 * There is NO task reorder, NO task filter, NO update PATCH/DELETE.
 *
 * Assignment semantics (verified in task_service.py): assigned_to must
 * be an ACTIVE company member UUID (400 otherwise); party_id must be a
 * UUID of a party in this company (400 otherwise, any backend type —
 * the contractor-only rule is a frontend business rule). Both nullable.
 */

export type BackendTaskStatus = 'not_started' | 'in_progress' | 'completed';
export type FrontendTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

const TO_BACKEND: Record<FrontendTaskStatus, BackendTaskStatus> = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

const FROM_BACKEND: Record<BackendTaskStatus, FrontendTaskStatus> = {
  not_started: 'NOT_STARTED',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
};

export function toBackendTaskStatus(status: FrontendTaskStatus): BackendTaskStatus {
  return TO_BACKEND[status];
}

export function fromBackendTaskStatus(status: string): FrontendTaskStatus {
  return (FROM_BACKEND as Record<string, FrontendTaskStatus>)[status] ?? 'NOT_STARTED';
}

/** Raw wire shape. Note: no notes field, UUIDs only for assignees. */
export interface BackendTask {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  party_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: BackendTaskStatus;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

/** Frontend-shaped task built only from real backend fields. */
export interface ApiTask {
  id: string;
  stageId: string;
  projectId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  partyId?: string;
  startDate?: string;
  endDate?: string;
  status: FrontendTaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export function mapTaskResponseToFrontend(t: BackendTask, projectId?: string): ApiTask {
  return {
    id: t.id,
    stageId: t.stage_id,
    projectId,
    title: t.title,
    description: t.description ?? undefined,
    assignedTo: t.assigned_to ?? undefined,
    partyId: t.party_id ?? undefined,
    startDate: t.start_date ?? undefined,
    endDate: t.due_date ?? undefined,
    status: fromBackendTaskStatus(t.status),
    progress: t.progress_percent,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function taskPath(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId?: string,
): string {
  const base =
    `/companies/${companyId}/projects/${projectId}` + `/stages/${stageId}/tasks/`;
  return taskId ? `${base}${taskId}` : base;
}

export async function getStageTasks(
  companyId: string,
  projectId: string,
  stageId: string,
): Promise<ApiTask[]> {
  const raw = await apiJson<BackendTask[]>(taskPath(companyId, projectId, stageId));
  return raw.map((t) => mapTaskResponseToFrontend(t, projectId));
}

export async function getTask(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
): Promise<ApiTask> {
  const raw = await apiJson<BackendTask>(taskPath(companyId, projectId, stageId, taskId));
  return mapTaskResponseToFrontend(raw, projectId);
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo?: string;
  partyId?: string;
  startDate?: string;
  endDate?: string;
  status?: FrontendTaskStatus;
  progress?: number;
}

export async function createTask(
  companyId: string,
  projectId: string,
  stageId: string,
  input: CreateTaskInput,
): Promise<ApiTask> {
  const raw = await apiJson<BackendTask>(taskPath(companyId, projectId, stageId), {
    method: 'POST',
    body: {
      title: input.title.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.assignedTo ? { assigned_to: input.assignedTo } : {}),
      ...(input.partyId ? { party_id: input.partyId } : {}),
      ...(input.startDate ? { start_date: input.startDate } : {}),
      ...(input.endDate ? { due_date: input.endDate } : {}),
      status: input.status ? toBackendTaskStatus(input.status) : 'not_started',
      progress_percent: input.progress ?? 0,
    },
  });
  const created = mapTaskResponseToFrontend(raw, projectId);
  clearTaskIndex(companyId);
  return created;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string | null;
  partyId?: string | null;
  startDate?: string;
  endDate?: string;
  status?: FrontendTaskStatus;
  progress?: number;
}

export async function updateTask(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<ApiTask> {
  const body: Record<string, unknown> = {};
  if (input.title?.trim()) body.title = input.title.trim();
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.assignedTo !== undefined) body.assigned_to = input.assignedTo;
  if (input.partyId !== undefined) body.party_id = input.partyId;
  if (input.startDate) body.start_date = input.startDate;
  if (input.endDate) body.due_date = input.endDate;
  if (input.status !== undefined) body.status = toBackendTaskStatus(input.status);
  if (input.progress !== undefined) body.progress_percent = input.progress;
  const raw = await apiJson<BackendTask>(taskPath(companyId, projectId, stageId, taskId), {
    method: 'PATCH',
    body,
  });
  const updated = mapTaskResponseToFrontend(raw, projectId);
  clearTaskIndex(companyId);
  return updated;
}

export async function deleteTask(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
): Promise<void> {
  await apiJson<void>(taskPath(companyId, projectId, stageId, taskId), {
    method: 'DELETE',
  });
  clearTaskIndex(companyId);
}

export interface TaskFormInput {
  title: string;
  description?: string;
  stageId: string;
  assignedTo: string;
  partyId: string;
  startDate: string;
  endDate: string;
  progress: number | string;
  status: FrontendTaskStatus;
  notes?: string;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanInt(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * Form → create payload. `notes` is intentionally dropped: tasks have
 * no notes column — notes belong to task updates (see postTaskUpdate).
 */
export function mapTaskFormToCreate(v: TaskFormInput): CreateTaskInput {
  return {
    title: v.title.trim(),
    description: cleanText(v.description),
    assignedTo: v.assignedTo || undefined,
    partyId: v.partyId || undefined,
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    status: v.status,
    progress: cleanInt(v.progress),
  };
}

/** Form → PATCH payload. Blanks omitted (preserved server-side). */
export function mapTaskFormToUpdate(v: TaskFormInput): UpdateTaskInput {
  return {
    title: v.title.trim(),
    description: cleanText(v.description),
    assignedTo: v.assignedTo || undefined,
    partyId: v.partyId || undefined,
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    status: v.status,
    progress: cleanInt(v.progress),
  };
}

/** API task → form values (notes live in updates, never on the task). */
export function mapApiTaskToFormValues(
  t: ApiTask,
  stageId: string,
): TaskFormInput & { notes: string } {
  return {
    title: t.title,
    description: t.description ?? '',
    stageId,
    assignedTo: t.assignedTo ?? '',
    partyId: t.partyId ?? '',
    startDate: t.startDate ?? '',
    endDate: t.endDate ?? '',
    progress: t.progress,
    status: t.status,
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// Task updates: sequential log entries. POST also rewrites the parent
// task's progress/status server-side. No PATCH/DELETE exists.
// ---------------------------------------------------------------------------

export interface BackendTaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  progress_percent: number;
  status: BackendTaskStatus;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface ApiTaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  progress: number;
  status: FrontendTaskStatus;
  notes?: string;
  photoUrl?: string;
  createdAt: string;
}

export function mapTaskUpdateResponseToFrontend(u: BackendTaskUpdate): ApiTaskUpdate {
  return {
    id: u.id,
    taskId: u.task_id,
    userId: u.user_id,
    progress: u.progress_percent,
    status: fromBackendTaskStatus(u.status),
    notes: u.notes ?? undefined,
    photoUrl: u.photo_url ?? undefined,
    createdAt: u.created_at,
  };
}

function updatePath(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
  updateId?: string,
): string {
  const base = `${taskPath(companyId, projectId, stageId, taskId)}/updates/`;
  return updateId ? `${base}${updateId}` : base;
}

export async function getTaskUpdates(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
): Promise<ApiTaskUpdate[]> {
  const raw = await apiJson<BackendTaskUpdate[]>(
    updatePath(companyId, projectId, stageId, taskId),
  );
  return raw.map(mapTaskUpdateResponseToFrontend);
}

export async function getTaskUpdate(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
  updateId: string,
): Promise<ApiTaskUpdate> {
  const raw = await apiJson<BackendTaskUpdate>(
    updatePath(companyId, projectId, stageId, taskId, updateId),
  );
  return mapTaskUpdateResponseToFrontend(raw);
}

export interface CreateTaskUpdateInput {
  progress: number;
  status: FrontendTaskStatus;
  notes?: string;
  image?: File;
}

/** Backend create accepts multipart Form only (photo upload capable). */
export async function postTaskUpdate(
  companyId: string,
  projectId: string,
  stageId: string,
  taskId: string,
  input: CreateTaskUpdateInput,
): Promise<ApiTaskUpdate> {
  const form = new FormData();
  form.set('progress_percent', String(input.progress));
  form.set('task_status', toBackendTaskStatus(input.status));
  if (input.notes?.trim()) form.set('notes', input.notes.trim());
  if (input.image) form.set('image', input.image);
  const raw = await apiForm<BackendTaskUpdate>(
    updatePath(companyId, projectId, stageId, taskId),
    form,
    { method: 'POST' },
  );
  const created = mapTaskUpdateResponseToFrontend(raw);
  clearTaskIndex(companyId);
  return created;
}

// ---------------------------------------------------------------------------
// Hierarchy traversal: task routes carry no list/detail of their own
// outside a stage, and detail URLs are flat (/app/tasks/[id]), so the
// chain is resolved by traversing company → projects → stages → tasks.
// Parallel fan-out, indexed per company, invalidated by mutations above.
// ---------------------------------------------------------------------------

export interface ApiTaskWithParents extends ApiTask {
  projectName?: string;
  stageName?: string;
}

export interface TaskChain {
  projectId: string;
  stageId: string;
  projectName?: string;
  stageName?: string;
}

let taskIndex: { companyId: string; byId: Map<string, ApiTaskWithParents> } | null = null;

export function clearTaskIndex(companyId?: string): void {
  if (!companyId || taskIndex?.companyId === companyId) taskIndex = null;
}

/** All tasks in a company, via parallel hierarchy traversal. */
export async function getCompanyTasks(companyId: string): Promise<ApiTaskWithParents[]> {
  if (taskIndex?.companyId === companyId) return [...taskIndex.byId.values()];
  const projects = await getProjects(companyId, { limit: 100 });
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const stages = await getStages(companyId, project.id);
      const perStage = await Promise.all(
        stages.map(async (stage) => {
          const tasks = await getStageTasks(companyId, project.id, stage.id);
          return tasks.map(
            (t): ApiTaskWithParents => ({
              ...t,
              projectId: project.id,
              projectName: project.name,
              stageName: stage.name,
            }),
          );
        }),
      );
      return perStage.flat();
    }),
  );
  const all = perProject.flat();
  taskIndex = { companyId, byId: new Map(all.map((t) => [t.id, t])) };
  return all;
}

/** Resolve the full hierarchy chain for a flat task id. */
export async function resolveTaskChain(
  companyId: string,
  taskId: string,
  hint?: Partial<TaskChain>,
): Promise<{ chain: TaskChain; task: ApiTask }> {
  if (hint?.projectId && hint?.stageId) {
    try {
      const task = await getTask(companyId, hint.projectId, hint.stageId, taskId);
      return {
        chain: { projectId: hint.projectId, stageId: hint.stageId },
        task,
      };
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 404 || err.status === 422))) throw err;
    }
  }
  const found =
    taskIndex?.companyId === companyId
      ? taskIndex.byId.get(taskId)
      : (await getCompanyTasks(companyId)).find((t) => t.id === taskId);
  if (!found || !found.projectId || !found.stageId) {
    throw new ApiError(404, 'Task not found.');
  }
  const task = await getTask(companyId, found.projectId, found.stageId, taskId);
  return {
    chain: {
      projectId: found.projectId,
      stageId: found.stageId,
      projectName: found.projectName,
      stageName: found.stageName,
    },
    task,
  };
}

/** Fresh single-task read with resolved chain (for detail pages). */
export async function getTaskById(
  companyId: string,
  taskId: string,
  hint?: Partial<TaskChain>,
): Promise<{ task: ApiTask; chain: TaskChain }> {
  const { chain, task } = await resolveTaskChain(companyId, taskId, hint);
  return { task, chain };
}

/** True when a task is past due and not completed (date-only compare). */
export function isTaskOverdue(endDate: string | undefined, status: FrontendTaskStatus): boolean {
  if (!endDate || status === 'COMPLETED') return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return endDate < todayStr;
}
