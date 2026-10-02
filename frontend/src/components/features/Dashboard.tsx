'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Download, TriangleAlert, Building2, DoorOpen, Contact, Wallet, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess, type ModuleKey } from '@/lib/auth/permissions';
import { PageHeader, ButtonLink, StatCard, Badge, Progress, Panel, TextLink, EmptyState, DetailList } from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { displayDate, exportCsv, money } from '@/lib/utils/format';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { formatAmount } from '@/lib/api/payment.api';
import {
  financialKpiFontSize,
  getCompanyDashboardSummary,
  getCompanyDashboardTasks,
  getCompanySalesDashboard,
  type ApiDashboardProject,
  type ApiDashboardRecentPayment,
  type ApiDashboardSummary,
  type ApiDashboardTask,
  type ApiSalesDashboard,
} from '@/lib/api/dashboard.api';
import { getProjects, type ApiProject, type FrontendProjectStatus } from '@/lib/api/project.api';
import { getStages } from '@/lib/api/construction-stage.api';
import { getCompanyLeads, type ApiLead } from '@/lib/api/lead.api';
import { isTaskOverdue, taskDetailHref } from '@/lib/api/task.api';

export function financialKpiValue(text: string) {
  const size = financialKpiFontSize(text);
  return (
    <span className="kpi-financial" style={size ? { fontSize: size } : undefined}>
      {text}
    </span>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
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

function Loading({ label }: { label: string }) {
  return (
    <p className="small" role="status" aria-live="polite">
      {label}
    </p>
  );
}

function errorFor(err: unknown, forbidden: string): string {
  if (err instanceof ApiError && err.status === 401) return 'Your session has expired. Please sign in again.';
  if (err instanceof ApiError && err.status === 403) return forbidden;
  return friendlyMessage(err);
}

const ROLE_TABS = [
  ['owner', 'Owner / PM', '/app/dashboard', 'dashboard-owner'],
  ['engineer', 'Site Engineer', '/app/dashboard/engineer', 'dashboard-engineer'],
  ['sales', 'Sales', '/app/dashboard/sales', 'dashboard-sales'],
  ['finance', 'Finance', '/app/dashboard/finance', 'dashboard-finance'],
] as Array<[string, string, string, ModuleKey]>;

function DashboardTabs({ role }: { role: string }) {
  const companyRole = useAuthStore((s) => s.companyRole);
  const visibleTabs = ROLE_TABS.filter(([, , , module]) => !companyRole || canAccess(companyRole, module));
  return (
    <nav className="tabs" aria-label="Dashboard role">
      {visibleTabs.map(([key, name, href]) => (
        <Link key={key} className={role === key ? 'active' : ''} href={href}>
          {name}
        </Link>
      ))}
    </nav>
  );
}

/** Human due label derived from the real due date (single shared rule). */
export function taskDueLabel(endDate: string | undefined, status: string): string {
  if (!endDate) return 'No due date';
  if (status === 'COMPLETED') return 'Completed';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (endDate < today) {
    const days = Math.round((Date.parse(today) - Date.parse(endDate)) / 86400000);
    return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
  }
  if (endDate === today) return 'Due Today';
  const ahead = Math.round((Date.parse(endDate) - Date.parse(today)) / 86400000);
  if (ahead === 1) return 'Due Tomorrow';
  return `In ${ahead} Days`;
}

function criticalTasks(tasks: ApiDashboardTask[]): ApiDashboardTask[] {
  return [...tasks]
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => {
      const ao = isTaskOverdue(a.endDate, a.status) ? 0 : 1;
      const bo = isTaskOverdue(b.endDate, b.status) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.endDate ?? '').localeCompare(b.endDate ?? '');
    })
    .slice(0, 4);
}

function CriticalTasksPanel({ tasks }: { tasks: ApiDashboardTask[] }) {
  const rows = criticalTasks(tasks);
  return (
    <Panel title="Critical Tasks" subtitle="Overdue first, then earliest due.">
      {!rows.length ? (
        <p className="small">No open tasks.</p>
      ) : (
        rows.map((t) => (
          <div className="activity" key={t.id}>
            <span className="activity-dot" />
            <div>
              <TextLink prefetch={false} href={taskDetailHref(t.id, { projectId: t.projectId, stageId: t.stageId })}>{t.title}</TextLink>
              <p>
                {t.projectName} · {t.stageName}
              </p>
              <p>
                {taskDueLabel(t.endDate, t.status)} · {t.progress}%{' '}
                <Badge value={isTaskOverdue(t.endDate, t.status) ? 'Overdue' : t.status} />
              </p>
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

function TaskStatusBreakdownPanel({ tasks }: { tasks: ApiDashboardTask[] }) {
  const open = tasks.filter((t) => t.status !== 'COMPLETED');
  return (
    <Panel title="Task Status Breakdown" subtitle="Company-wide task distribution.">
      {!tasks.length ? (
        <p className="small">No tasks yet.</p>
      ) : (
        <DetailList
          items={[
            ['Not Started', <strong key="ns">{tasks.filter((t) => t.status === 'NOT_STARTED').length}</strong>],
            ['In Progress', <strong key="ip">{tasks.filter((t) => t.status === 'IN_PROGRESS').length}</strong>],
            ['Completed', <strong key="c">{tasks.filter((t) => t.status === 'COMPLETED').length}</strong>],
            ['Overdue', <strong key="o">{open.filter((t) => isTaskOverdue(t.endDate, t.status)).length}</strong>],
          ]}
        />
      )}
    </Panel>
  );
}

/** Project row enriched with list fields (status/location/image). Paid stays unknown for PM. */
export interface AttentionProject {
  projectId: string;
  name: string;
  status?: FrontendProjectStatus;
  location?: string;
  image?: string;
  budget: number;
  paid?: number;
  remaining?: number;
  progressPercent: number;
}

export function mergeAttentionProjects(
  summaryProjects: ApiDashboardProject[],
  listProjects: ApiProject[],
): AttentionProject[] {
  const byId = new Map(listProjects.map((p) => [p.id, p]));
  return summaryProjects.map((p) => {
    const match = byId.get(p.projectId);
    return {
      projectId: p.projectId,
      name: p.name,
      status: match?.status,
      location: match?.location ?? undefined,
      image: match?.image ?? undefined,
      budget: p.budget,
      paid: p.paid,
      remaining: p.remaining,
      progressPercent: p.progressPercent,
    };
  });
}

function ProjectAttentionCard({
  project,
  overdue,
}: {
  project: AttentionProject;
  overdue?: ApiDashboardTask;
}) {
  const utilization = project.budget > 0 && project.paid !== undefined
    ? Math.round((project.paid / project.budget) * 100)
    : null;
  return (
    <div className="attention-card">
      <div className="attention-top">
        {project.image ? (
          <img src={project.image} alt="" loading="lazy" />
        ) : (
          <span className="avatar-placeholder" style={{ width: 50, height: 50, fontSize: 20 }} aria-hidden="true">
            {project.name.charAt(0)}
          </span>
        )}
        <div>
          <h3>
            <TextLink prefetch={false} href={'/app/projects/' + project.projectId}>{project.name}</TextLink>{' '}
            {project.status && <Badge value={project.status} />}
          </h3>
          <p>{project.location ?? 'Location not supplied'}</p>
          <p>Completion · {project.progressPercent}%</p>
        </div>
        <div className="attention-budget">
          <small>Budget</small>
          {formatAmount(project.budget)}
          {project.paid !== undefined && (
            <small>
              Paid {formatAmount(project.paid)}
              {utilization !== null ? ` · ${utilization}%` : ''}
            </small>
          )}
        </div>
      </div>
      {overdue && (
        <p className="warning-banner" role="alert">
          <TriangleAlert size={13} />
          Overdue: {overdue.title} — {taskDueLabel(overdue.endDate, overdue.status)} ·{' '}
          <TextLink prefetch={false} href={'/app/tasks/' + overdue.id}>View Task</TextLink>
        </p>
      )}
      <Progress value={project.progressPercent} />
    </div>
  );
}

type StatusFilter = '' | FrontendProjectStatus;

function ProjectsAttentionPanel({
  projects,
  tasksByProject,
}: {
  projects: AttentionProject[];
  tasksByProject: Map<string, ApiDashboardTask[]>;
}) {
  const [filter, setFilter] = useState<StatusFilter>('');
  const rows = projects
    .filter((p) => (filter ? p.status === filter : p.status !== 'COMPLETED'))
    .sort((a, b) => a.progressPercent - b.progressPercent)
    .slice(0, 4);
  return (
    <Panel
      title="Projects Requiring Attention"
      subtitle="Active projects sorted by lowest completion."
      action={
        <label className="small">
          Project status{' '}
          <select aria-label="Project status" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
            <option value="">Needs attention</option>
            <option value="PLANNING">Planning</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
      }
    >
      {!rows.length ? (
        <p className="small">No projects match this filter.</p>
      ) : (
        rows.map((p) => {
          const overdue = (tasksByProject.get(p.projectId) ?? [])
            .filter((t) => isTaskOverdue(t.endDate, t.status))
            .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''))[0];
          return <ProjectAttentionCard key={p.projectId} project={p} overdue={overdue} />;
        })
      )}
    </Panel>
  );
}

function RecentPaymentsPanel({
  payments,
  projectNames,
  canPay,
}: {
  payments: ApiDashboardRecentPayment[];
  projectNames: Map<string, string>;
  canPay: boolean;
}) {
  return (
    <Panel title="Financial Overview" subtitle="Recent disbursements across projects." action={<TextLink href="/app/payments">View All Payments</TextLink>}>
      {!payments.length ? (
        <p className="small">No payments recorded yet.</p>
      ) : (
        <DataTable
          rows={payments}
          searchText={(p) => `${p.amount} ${projectNames.get(p.projectId) ?? ''} ${p.description ?? ''}`}
          placeholder="Search payments…"
          emptyTitle="No payments recorded yet"
          columns={[
            {
              label: 'Amount',
              value: (p) => <strong>{formatAmount(p.amount)}</strong>,
              sort: (p) => p.amount,
            },
            { label: 'Project', value: (p) => projectNames.get(p.projectId) ?? '—' },
            {
              label: 'Date',
              value: (p) => displayDate(p.paymentDate),
              sort: (p) => p.paymentDate,
            },
            { label: 'Details', value: (p) => p.description ?? '—' },
            ...(canPay
              ? [
                  {
                    label: 'Actions',
                    value: (p: ApiDashboardRecentPayment) => (
                      <TextLink prefetch={false} href={'/app/payments/' + p.id + '?projectId=' + p.projectId}>
                        View
                      </TextLink>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="stats six" aria-hidden="true">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <StatCard key={k} label="…" value="—" />
        ))}
      </div>
      <div className="two-column">
        <div className="stack">
          <Panel title="Projects Requiring Attention">
            <Loading label="Loading projects…" />
          </Panel>
          <Panel title="Financial Overview">
            <Loading label="Loading payments…" />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Critical Tasks">
            <Loading label="Loading tasks…" />
          </Panel>
          <Panel title="Recent Leads">
            <Loading label="Loading leads…" />
          </Panel>
        </div>
      </div>
      <p className="small" role="status" aria-live="polite">
        Loading dashboard…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main / Owner dashboard (OWNER gets the full summary; PROJECT_MANAGER gets
// a scoped fallback from the project list + tasks because the summary
// endpoint is OWNER-only and PM may not read payments/parties).
// ---------------------------------------------------------------------------

function MainDashboard() {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const companyName = useAuthStore((s) => s.companyName);
  const canPay = !companyRole || canAccess(companyRole, 'payments');
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null);
  const [projectList, setProjectList] = useState<ApiProject[]>([]);
  const [tasks, setTasks] = useState<ApiDashboardTask[]>([]);
  const [leads, setLeads] = useState<ApiLead[] | null>(null);
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
      // Independent dashboard resources load concurrently (single
      // round). Per-source fallbacks preserve the previous sequential
      // semantics: summary 403 → null, other summary errors fail the
      // page, leads failures degrade to null.
      const canReadLeads = !companyRole || canAccess(companyRole, 'leads');
      const [freshTasks, freshProjects, summaryRes, leadsRes] = await Promise.all([
        getCompanyDashboardTasks(companyId),
        getProjects(companyId, { limit: 100 }),
        getCompanyDashboardSummary(companyId).catch((summaryErr: unknown) => {
          if (summaryErr instanceof ApiError && summaryErr.status === 403) return null;
          throw summaryErr;
        }),
        canReadLeads ? getCompanyLeads(companyId).catch(() => null) : Promise.resolve(null),
      ]);
      setTasks(freshTasks);
      setProjectList(freshProjects);
      setSummary(summaryRes);
      setLeads(leadsRes);
    } catch (err) {
      setError(errorFor(err, 'You do not have access to this dashboard.'));
      setSummary(null);
      setProjectList([]);
      setTasks([]);
      setLeads(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, companyRole]);

  /* eslint-disable react-hooks/set-state-in-effect -- dashboard load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const description = companyName
    ? `Overview of ${companyName} operations, projects, and financials.`
    : 'Overview of company operations, projects, and financials.';

  const exportReport = () => {
    if (summary) {
      const byId = new Map(projectList.map((p) => [p.id, p]));
      exportCsv(
        'dashboard-projects',
        summary.projects.map((p) => {
          const match = byId.get(p.projectId);
          return {
            project: p.name,
            status: match?.status ?? '',
            location: match?.location ?? '',
            budget: p.budget,
            paid: p.paid,
            remaining: p.remaining,
            progress: p.progressPercent,
          };
        }),
      );
    } else {
      exportCsv(
        'dashboard-projects',
        projectList.map((p) => ({
          project: p.name,
          status: p.status,
          location: p.location ?? '',
          budget: p.budget ?? 0,
          progress: p.progressPercent ?? 0,
        })),
      );
    }
  };

  return (
    <>
      <PageHeader title="Dashboard" eyebrow="Operations Command Center" description={description}>
        <button className="button secondary" type="button" onClick={exportReport}>
          <Download size={15} />
          Export Report
        </button>
        <ButtonLink href="/app/projects/new">
          <Plus size={16} />
          New Project
        </ButtonLink>
      </PageHeader>
      <DashboardTabs role="owner" />
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={fetchAll} />
      ) : summary ? (
        <OwnerDashboardBody
          summary={summary}
          projectList={projectList}
          tasks={tasks}
          leads={leads}
          canPay={canPay}
        />
      ) : projectList.length || companyRole === 'PROJECT_MANAGER' ? (
        <ProjectManagerDashboardBody projects={projectList} tasks={tasks} />
      ) : (
        <DashboardError message="You do not have access to this dashboard." onRetry={fetchAll} />
      )}
    </>
  );
}

function OwnerDashboardBody({
  summary,
  projectList,
  tasks,
  leads,
  canPay,
}: {
  summary: ApiDashboardSummary;
  projectList: ApiProject[];
  tasks: ApiDashboardTask[];
  leads: ApiLead[] | null;
  canPay: boolean;
}) {
  const attention = useMemo(
    () => mergeAttentionProjects(summary.projects, projectList),
    [summary, projectList],
  );
  const tasksByProject = useMemo(() => {
    const groups = new Map<string, ApiDashboardTask[]>();
    for (const t of tasks) {
      const rows = groups.get(t.projectId) ?? [];
      rows.push(t);
      groups.set(t.projectId, rows);
    }
    return groups;
  }, [tasks]);
  const projectNames = useMemo(() => new Map(attention.map((p) => [p.projectId, p.name])), [attention]);
  const leadSplit = useMemo(
    () => ({
      new: (leads ?? []).filter((l) => l.status === 'NEW').length,
      contacted: (leads ?? []).filter((l) => l.status === 'CONTACTED').length,
    }),
    [leads],
  );
  const recentLeads = (leads ?? []).slice(0, 3);
  return (
    <>
      <div className="stats six">
        <StatCard
          label="Active Projects"
          value={summary.counts.inProgress}
          detail={`${summary.counts.total} projects tracked`}
          icon={<Building2 size={16} />}
        />
        <StatCard
          label="Open Leads"
          value={summary.openLeads}
          detail={leads ? `New ${leadSplit.new} · Contacted ${leadSplit.contacted}` : 'New / Contacted'}
          icon={<Contact size={16} />}
        />
        <StatCard
          label="Total Project Budget"
          value={financialKpiValue(formatAmount(summary.totalBudget))}
          detail="All projects"
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="Total Payments"
          value={financialKpiValue(formatAmount(summary.totalPaid))}
          detail={`${summary.utilization}% utilized`}
        />
        <StatCard
          label="Remaining Budget"
          value={financialKpiValue(formatAmount(summary.remainingBudget))}
          detail="Portfolio allocation"
        />
        <StatCard
          label="Budget Utilization"
          value={`${summary.utilization}%`}
          detail="Paid versus budget"
        />
      </div>
      <div className="two-column">
        <div className="stack">
          <ProjectsAttentionPanel projects={attention} tasksByProject={tasksByProject} />
          <RecentPaymentsPanel
            payments={summary.recentPayments}
            projectNames={projectNames}
            canPay={canPay}
          />
        </div>
        <div className="stack">
          <CriticalTasksPanel tasks={tasks} />
          <TaskStatusBreakdownPanel tasks={tasks} />
          {leads !== null && (
            <Panel title="Recent Leads" action={<TextLink href="/app/leads">View Pipeline</TextLink>}>
              {!recentLeads.length ? (
                <p className="small">No leads yet.</p>
              ) : (
                recentLeads.map((l) => (
                  <div className="activity" key={l.id}>
                    <span className="activity-dot" />
                    <div>
                      <TextLink prefetch={false} href={'/app/leads/' + l.id}>{l.name}</TextLink>
                      <p>
                        {displayDate(l.createdAt)} <Badge value={l.status} />
                      </p>
                    </div>
                  </div>
                ))
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function ProjectManagerDashboardBody({
  projects,
  tasks,
}: {
  projects: ApiProject[];
  tasks: ApiDashboardTask[];
}) {
  const open = tasks.filter((t) => t.status !== 'COMPLETED');
  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const attention: AttentionProject[] = [...projects]
    .sort((a, b) => (a.progressPercent ?? 0) - (b.progressPercent ?? 0))
    .map((p) => ({
      projectId: p.id,
      name: p.name,
      status: p.status,
      location: p.location ?? undefined,
      image: p.image ?? undefined,
      budget: p.budget ?? 0,
      progressPercent: p.progressPercent ?? 0,
    }));
  const tasksByProject = new Map<string, ApiDashboardTask[]>();
  for (const t of tasks) {
    const rows = tasksByProject.get(t.projectId) ?? [];
    rows.push(t);
    tasksByProject.set(t.projectId, rows);
  }
  return (
    <>
      <div className="stats six">
        <StatCard
          label="Active Projects"
          value={projects.filter((p) => p.status === 'IN_PROGRESS').length}
          detail={`${projects.length} projects tracked`}
          icon={<Building2 size={16} />}
        />
        <StatCard label="Total Projects" value={projects.length} detail="All statuses" icon={<DoorOpen size={16} />} />
        <StatCard
          label="Total Project Budget"
          value={financialKpiValue(formatAmount(totalBudget))}
          detail="All projects"
          icon={<Wallet size={16} />}
        />
        <StatCard label="Open Tasks" value={open.length} detail="Not completed" icon={<ClipboardList size={16} />} />
        <StatCard
          label="Overdue Tasks"
          value={open.filter((t) => isTaskOverdue(t.endDate, t.status)).length}
          detail="Need attention"
        />
        <StatCard
          label="Tasks In Progress"
          value={tasks.filter((t) => t.status === 'IN_PROGRESS').length}
          detail="Company-wide"
        />
      </div>
      <div className="two-column">
        <div className="stack">
          <ProjectsAttentionPanel projects={attention} tasksByProject={tasksByProject} />
        </div>
        <div className="stack">
          <CriticalTasksPanel tasks={tasks} />
          <TaskStatusBreakdownPanel tasks={tasks} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Site Engineer dashboard: real company tasks + real project/stage reads.
// Panels without backend support (activity feed, staffing) are omitted
// rather than mocked.

interface EngineerStageCard {
  stageId: string;
  stageName: string;
  order: number;
  status: string;
  projectId: string;
  projectName: string;
  projectProgress: number;
  taskTotal: number;
  taskDone: number;
}

function EngineerDashboard() {
  const companyId = useAuthStore((s) => s.companyId);
  const sessionUser = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<ApiDashboardTask[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [stages, setStages] = useState<EngineerStageCard[]>([]);
  const [stagesError, setStagesError] = useState<string | null>(null);
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
    setStagesError(null);
    try {
      const [freshTasks, projectList] = await Promise.all([
        getCompanyDashboardTasks(companyId),
        getProjects(companyId, { limit: 100 }),
      ]);
      setTasks(freshTasks);
      setProjects(projectList);
      // Bounded per-project stage read (any company member may read
      // stages; one request per project, no per-task fan-out).
      try {
        const perProject = await Promise.all(
          projectList.map(async (p) => {
            const list = await getStages(companyId, p.id);
            return list.map((s) => ({ stage: s, project: p }));
          }),
        );
        const tasksByStage = new Map<string, ApiDashboardTask[]>();
        for (const t of freshTasks) {
          const rows = tasksByStage.get(t.stageId) ?? [];
          rows.push(t);
          tasksByStage.set(t.stageId, rows);
        }
        setStages(
          perProject
            .flat()
            .filter(({ stage }) => stage.status === 'IN_PROGRESS')
            .sort((a, b) => a.stage.order - b.stage.order)
            .map(({ stage, project }) => {
              const rows = tasksByStage.get(stage.id) ?? [];
              const done = rows.filter((t) => t.status === 'COMPLETED').length;
              return {
                stageId: stage.id,
                stageName: stage.name,
                order: stage.order,
                status: stage.status,
                projectId: project.id,
                projectName: project.name,
                projectProgress: project.progressPercent ?? 0,
                taskTotal: rows.length,
                taskDone: done,
              };
            }),
        );
      } catch (stageErr) {
        setStages([]);
        setStagesError(errorFor(stageErr, 'You do not have access to stage data.'));
      }
    } catch (err) {
      setError(errorFor(err, 'You do not have access to this dashboard.'));
      setTasks([]);
      setProjects([]);
      setStages([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- dashboard load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mine = useMemo(
    () => tasks.filter((t) => sessionUser && t.assignedTo === sessionUser.id),
    [tasks, sessionUser],
  );
  const mineOpen = mine.filter((t) => t.status !== 'COMPLETED');
  const mineOverdue = mineOpen.filter((t) => isTaskOverdue(t.endDate, t.status));
  const upcoming = useMemo(
    () =>
      [...mineOpen]
        .filter((t) => t.endDate)
        .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''))
        .slice(0, 4),
    [mineOpen],
  );
  const activeProjects = projects.filter((p) => p.status === 'IN_PROGRESS');

  return (
    <>
      <PageHeader
        title="Site Operations Dashboard"
        eyebrow="Operations Command Center"
        description="Live project stages, assigned tasks, and construction progress."
      >
        <ButtonLink href="/app/tasks/new">
          <Plus size={16} />
          New Task
        </ButtonLink>
      </PageHeader>
      {sessionUser && (
        <p className="small" style={{ marginBottom: 16 }}>
          {sessionUser.name} · Site Engineer
        </p>
      )}
      <DashboardTabs role="engineer" />
      {loading ? (
        <div aria-busy="true">
          <div className="stats" aria-hidden="true">
            {['a', 'b', 'c', 'd'].map((k) => (
              <StatCard key={k} label="…" value="—" />
            ))}
          </div>
          <Panel title="Active Construction Stages Progress">
            <Loading label="Loading stages…" />
          </Panel>
          <p className="small" role="status" aria-live="polite">
            Loading site dashboard…
          </p>
        </div>
      ) : error ? (
        <DashboardError message={error} onRetry={fetchAll} />
      ) : (
        <>
          <div className="stats">
            <StatCard
              label="Active Projects"
              value={activeProjects.length}
              detail={`${projects.length} projects tracked`}
              icon={<Building2 size={16} />}
            />
            <StatCard
              label="Stages In Progress"
              value={stagesError ? '—' : stages.length}
              detail="Across active projects"
              icon={<ClipboardList size={16} />}
            />
            <StatCard
              label="Assigned Tasks"
              value={mineOpen.length}
              detail={`${mine.length} total assigned to me`}
            />
            <StatCard
              label="Overdue Tasks"
              value={mineOverdue.length}
              detail="Assigned to me"
            />
          </div>
          <Panel title="Active Construction Stages Progress" subtitle="Real in-progress stages with task completion.">
            {stagesError ? (
              <DashboardError message={stagesError} onRetry={fetchAll} />
            ) : !stages.length ? (
              <p className="small">No stages in progress.</p>
            ) : (
              <div className="stage-grid">
                {stages.map((s) => {
                  const pct = s.taskTotal ? Math.round((s.taskDone / s.taskTotal) * 100) : 0;
                  return (
                    <div className="stage-card" key={s.stageId}>
                      <div className="eyebrow">Phase {String(s.order).padStart(2, '0')}</div>
                      <Badge value={s.status} />
                      <h3>{s.stageName}</h3>
                      <small>
                        {s.projectName} · {s.taskDone}/{s.taskTotal} tasks done
                      </small>
                      <p className="small">Task completion</p>
                      <Progress value={pct} />
                      <p className="small section-space">Project progress</p>
                      <Progress value={s.projectProgress} />
                      <div className="section-space">
                        <TextLink prefetch={false} href={'/app/construction/stages/' + s.stageId}>
                          View Stage
                        </TextLink>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <div className="two-column">
            <div className="stack">
              <Panel title="My Site Tasks & Milestones" subtitle="Only tasks assigned to you.">
                {!mine.length ? (
                  <p className="small">No tasks assigned to you.</p>
                ) : (
                  <DataTable
                    rows={[...mine].sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''))}
                    searchText={(t) => `${t.title} ${t.projectName} ${t.stageName}`}
                    placeholder="Search my tasks…"
                    emptyTitle="No tasks assigned to you"
                    columns={[
                      { label: 'Task Name', value: (t) => <strong>{t.title}</strong>, sort: (t) => t.title },
                      { label: 'Project', value: (t) => t.projectName },
                      { label: 'Stage', value: (t) => t.stageName },
                      {
                        label: 'Due Date',
                        value: (t) => (t.endDate ? taskDueLabel(t.endDate, t.status) : 'No due date'),
                        sort: (t) => t.endDate ?? '',
                      },
                      { label: 'Status', value: (t) => <Badge value={t.status} /> },
                      {
                        label: 'Progress',
                        value: (t) => <Progress value={t.progress} />,
                        sort: (t) => t.progress,
                      },
                      {
                        label: 'Actions',
                        value: (t) => (
                          <div className="row-actions">
                            <TextLink prefetch={false} href={taskDetailHref(t.id, { projectId: t.projectId, stageId: t.stageId })}>View</TextLink>
                            <TextLink prefetch={false} href={taskDetailHref(t.id, { projectId: t.projectId, stageId: t.stageId }) + '/updates/new'}>Add Update</TextLink>
                          </div>
                        ),
                      },
                    ]}
                  />
                )}
              </Panel>
            </div>
            <div className="stack">
              <Panel title="Task Status Breakdown" subtitle="My assigned tasks by status.">
                {!mine.length ? (
                  <p className="small">No tasks assigned to you.</p>
                ) : (
                  <DetailList
                    items={[
                      ['Not Started', <strong key="ns">{mine.filter((t) => t.status === 'NOT_STARTED').length}</strong>],
                      ['In Progress', <strong key="ip">{mine.filter((t) => t.status === 'IN_PROGRESS').length}</strong>],
                      ['Completed', <strong key="c">{mine.filter((t) => t.status === 'COMPLETED').length}</strong>],
                      ['Overdue', <strong key="o">{mineOverdue.length}</strong>],
                    ]}
                  />
                )}
              </Panel>
              <Panel title="Upcoming Deadlines" subtitle="My next due tasks.">
                {!upcoming.length ? (
                  <p className="small">No upcoming deadlines.</p>
                ) : (
                  upcoming.map((t) => (
                    <div className="activity" key={t.id}>
                      <span className="activity-dot" />
                      <div>
                        <TextLink prefetch={false} href={taskDetailHref(t.id, { projectId: t.projectId, stageId: t.stageId })}>{t.title}</TextLink>
                        <p>
                          {t.projectName} · {taskDueLabel(t.endDate, t.status)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
// Sales dashboard (real sales summary + real Leads API; no project,
// payment, task, or apartment-hierarchy calls).
// ---------------------------------------------------------------------------

type LeadFilter = '' | 'NEW' | 'CONTACTED' | 'CLOSED';

function shortUnitId(apartmentId: string): string {
  return apartmentId.slice(0, 8);
}

function SalesDashboard() {
  const companyId = useAuthStore((s) => s.companyId);
  const [sales, setSales] = useState<ApiSalesDashboard | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [leads, setLeads] = useState<ApiLead[]>([]);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadFilter>('');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setSalesError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setSalesError(null);
    setLeadsError(null);
    try {
      // Independent sales resources load concurrently.
      const [salesRes, leadsRes] = await Promise.all([
        getCompanySalesDashboard(companyId).then(
          (v) => ({ ok: true as const, value: v }),
          (err: unknown) => ({ ok: false as const, err }),
        ),
        getCompanyLeads(companyId).then(
          (v) => ({ ok: true as const, value: v }),
          (err: unknown) => ({ ok: false as const, err }),
        ),
      ]);
      if (salesRes.ok) {
        setSales(salesRes.value);
      } else {
        setSales(null);
        setSalesError(errorFor(salesRes.err, 'You do not have access to this dashboard.'));
      }
      if (leadsRes.ok) {
        setLeads(leadsRes.value);
      } else {
        setLeads([]);
        setLeadsError(errorFor(leadsRes.err, 'You do not have access to leads.'));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- dashboard load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === 'NEW').length,
      contacted: leads.filter((l) => l.status === 'CONTACTED').length,
      closed: leads.filter((l) => l.status === 'CLOSED').length,
    }),
    [leads],
  );
  const visibleLeads = leads.filter((l) => !filter || l.status === filter);
  const topUnits = (sales?.topApartments ?? []).slice(0, 3);
  const filterTabs: Array<{ key: LeadFilter; label: string; count: number }> = [
    { key: '', label: 'All', count: leads.length },
    { key: 'NEW', label: 'New', count: counts.new },
    { key: 'CONTACTED', label: 'Contacted', count: counts.contacted },
    { key: 'CLOSED', label: 'Closed', count: counts.closed },
  ];

  return (
    <>
      <PageHeader
        title="Sales & Property Dashboard"
        eyebrow="Operations Command Center"
        description="Manage public apartments, client leads, and property inventory visibility."
      >
        <ButtonLink href="/apartments" secondary>
          View Public Catalog
        </ButtonLink>
      </PageHeader>
      <DashboardTabs role="sales" />
      {loading ? (
        <div aria-busy="true">
          <div className="stats" aria-hidden="true">
            {['a', 'b', 'c', 'd'].map((k) => (
              <StatCard key={k} label="…" value="—" />
            ))}
          </div>
          <Panel title="Apartments Receiving Most Leads">
            <Loading label="Loading top apartments…" />
          </Panel>
          <Panel title="Recent Leads & Pipeline">
            <Loading label="Loading leads…" />
          </Panel>
          <p className="small" role="status" aria-live="polite">
            Loading sales dashboard…
          </p>
        </div>
      ) : salesError && !sales ? (
        <DashboardError message={salesError} onRetry={fetchAll} />
      ) : (
        <>
          <div className="stats">
            <StatCard
              label="Public Apartments"
              value={sales?.apartments.public ?? 0}
              detail={`of ${sales?.apartments.total ?? 0} total units`}
              icon={<Building2 size={16} />}
            />
            <StatCard
              label="Total Leads"
              value={leads.length}
              detail={`New ${counts.new} · Contacted ${counts.contacted}`}
              icon={<Contact size={16} />}
            />
            <StatCard label="New Leads" value={counts.new} detail="Awaiting first contact" />
            <StatCard label="Closed Leads" value={counts.closed} detail="Concluded" />
          </div>
          <Panel
            title="Apartments Receiving Most Leads"
            subtitle="Properties generating the most lead interest."
            action={<TextLink href="/app/leads">View Pipeline</TextLink>}
          >
            {!topUnits.length ? (
              <p className="small">No lead interest yet.</p>
            ) : (
              <div className="three-grid">
                {topUnits.map((u) => {
                  const specs = [
                    u.bedrooms !== undefined ? `${u.bedrooms} Beds` : null,
                    u.bathrooms !== undefined ? `${u.bathrooms} Baths` : null,
                    u.areaSqm !== undefined ? `${u.areaSqm} m²` : null,
                    u.floorNumber !== undefined ? `Floor ${u.floorNumber}` : null,
                  ].filter((s): s is string => s !== null);
                  return (
                    <article className="project-card" key={u.apartmentId}>
                      <div className="project-image">
                        {u.primaryImage ? (
                          <img src={u.primaryImage} alt={'Apartment ' + u.unitNumber} loading="lazy" />
                        ) : (
                          <span
                            className="avatar-placeholder"
                            style={{ width: 64, height: 64, fontSize: 24 }}
                            aria-hidden="true"
                          >
                            {u.unitNumber.charAt(0)}
                          </span>
                        )}
                        <Badge value={`${u.leadCount} Leads`} />
                      </div>
                      <div className="project-card-body">
                        <div className="budget" style={{ marginTop: 0 }}>
                          <span>{u.projectName}</span>
                          {u.isPublic && <Badge value="Public" />}
                        </div>
                        <h3>Apartment {u.unitNumber}</h3>
                        <p className="small">
                          {u.leadCount} lead{u.leadCount === 1 ? '' : 's'} received
                          {u.price !== undefined ? ` · ${money(u.price)}` : ''}
                        </p>
                        {specs.length > 0 && <p className="small">{specs.join(' · ')}</p>}
                      </div>
                      <div className="project-card-footer">
                        <span>Unit {shortUnitId(u.apartmentId)}</span>
                        <TextLink href="/app/leads">View Leads</TextLink>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
          <div className="section-space">
            <Panel
              title="Recent Leads & Pipeline"
              subtitle="Recent client interest across public property inventory."
            >
              {leadsError ? (
                <DashboardError message={leadsError} onRetry={fetchAll} />
              ) : (
                <>
                  <div className="row-actions" role="group" aria-label="Filter leads by status">
                    {filterTabs.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        className={'button' + (filter === t.key ? '' : ' secondary')}
                        aria-pressed={filter === t.key}
                        onClick={() => setFilter(t.key)}
                      >
                        {t.label} ({t.count})
                      </button>
                    ))}
                  </div>
                  {!visibleLeads.length ? (
                    <p className="small section-space">
                      {filter ? `No ${filter.toLowerCase()} leads.` : 'No leads yet.'}
                    </p>
                  ) : (
                    <div className="section-space">
                      <DataTable
                        rows={visibleLeads}
                        searchText={(l) =>
                          `${l.name} ${l.phone ?? ''} ${l.email ?? ''} ${l.message ?? ''}`
                        }
                        placeholder="Search leads…"
                        emptyTitle={filter ? `No ${filter.toLowerCase()} leads` : 'No leads yet'}
                        columns={[
                          {
                            label: 'Lead',
                            value: (l) => (
                              <div>
                                <strong>{l.name}</strong>
                                {l.message && <small>Message: {l.message}</small>}
                              </div>
                            ),
                            sort: (l) => l.name,
                          },
                          { label: 'Unit', value: (l) => shortUnitId(l.apartmentId) },
                          {
                            label: 'Contact',
                            value: (l) => (
                              <div>
                                {l.phone ?? '—'}
                                {l.email && <small>{l.email}</small>}
                              </div>
                            ),
                          },
                          { label: 'Status', value: (l) => <Badge value={l.status} /> },
                          {
                            label: 'Received',
                            value: (l) => displayDate(l.createdAt),
                            sort: (l) => l.createdAt,
                          },
                          {
                            label: 'Actions',
                            value: (l) => (
                              <div className="row-actions">
                                <TextLink prefetch={false} href={'/app/leads/' + l.id}>View</TextLink>
                                <TextLink prefetch={false} href={'/app/leads/' + l.id + '/status'}>Update</TextLink>
                              </div>
                            ),
                          },
                        ]}
                      />
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export function Dashboard({
  role = 'owner',
}: {
  role?: 'owner' | 'engineer' | 'sales' | 'finance' | 'empty';
}) {
  if (role === 'engineer') return <EngineerDashboard />;
  if (role === 'sales') return <SalesDashboard />;
  if (role === 'empty') {
    return (
      <Panel>
        <EmptyState
          title="No projects created yet"
          description="Start by creating your first project. Define its structure, organize tasks, and track execution."
          href="/app/projects/new"
          action="Create Project"
        />
      </Panel>
    );
  }
  return <MainDashboard />;
}
