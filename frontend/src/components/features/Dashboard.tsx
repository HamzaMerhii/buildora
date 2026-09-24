'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Building2, DoorOpen, Contact, Wallet, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess, type ModuleKey } from '@/lib/auth/permissions';
import { PageHeader, ButtonLink, StatCard, Badge, Progress, Panel, TextLink, EmptyState } from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { displayDate } from '@/lib/utils/format';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { formatAmount } from '@/lib/api/payment.api';
import {
  getCompanyDashboardSummary,
  getCompanyDashboardTasks,
  getCompanySalesDashboard,
  type ApiDashboardProject,
  type ApiDashboardRecentPayment,
  type ApiDashboardSummary,
  type ApiDashboardTask,
  type ApiSalesDashboard,
} from '@/lib/api/dashboard.api';
import { getProjects, type ApiProject } from '@/lib/api/project.api';
import { getCompanyLeads, type ApiLead } from '@/lib/api/lead.api';
import { isTaskOverdue } from '@/lib/api/task.api';

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

function criticalTasks(tasks: ApiDashboardTask[]): ApiDashboardTask[] {
  return [...tasks]
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => {
      const ao = isTaskOverdue(a.endDate, a.status) ? 0 : 1;
      const bo = isTaskOverdue(b.endDate, b.status) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.endDate ?? '').localeCompare(b.endDate ?? '');
    })
    .slice(0, 3);
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
              <TextLink href={'/app/tasks/' + t.id}>{t.title}</TextLink>
              <p>
                {t.projectName} · {t.stageName}
              </p>
              <p>
                Due {t.endDate ? displayDate(t.endDate) : '—'} · {t.progress}%{' '}
                <Badge value={isTaskOverdue(t.endDate, t.status) ? 'Overdue' : t.status} />
              </p>
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

function ProjectsOverviewPanel({ projects }: { projects: ApiDashboardProject[] }) {
  const rows = [...projects].sort((a, b) => a.progressPercent - b.progressPercent).slice(0, 3);
  return (
    <Panel title="Projects Overview" subtitle="Lowest completion first.">
      {!rows.length ? (
        <p className="small">No projects yet.</p>
      ) : (
        rows.map((p) => (
          <div className="attention-card" key={p.projectId}>
            <h3>
              <TextLink href={'/app/projects/' + p.projectId}>{p.name}</TextLink>
            </h3>
            <p>
              {formatAmount(p.paid)} / {formatAmount(p.budget)}
            </p>
            <div className="section-space">
              <Progress value={p.progressPercent} />
            </div>
          </div>
        ))
      )}
    </Panel>
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
  const canPay = !companyRole || canAccess(companyRole, 'payments');
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null);
  const [fallbackProjects, setFallbackProjects] = useState<ApiProject[] | null>(null);
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
      const [freshTasks] = await Promise.all([getCompanyDashboardTasks(companyId)]);
      setTasks(freshTasks);
      try {
        const fresh = await getCompanyDashboardSummary(companyId);
        setSummary(fresh);
        setFallbackProjects(null);
      } catch (summaryErr) {
        if (summaryErr instanceof ApiError && summaryErr.status === 403) {
          setSummary(null);
          setFallbackProjects(await getProjects(companyId, { limit: 100 }));
        } else {
          throw summaryErr;
        }
      }
      if (!companyRole || canAccess(companyRole, 'leads')) {
        try {
          setLeads(await getCompanyLeads(companyId));
        } catch {
          setLeads(null);
        }
      } else {
        setLeads(null);
      }
    } catch (err) {
      setError(errorFor(err, 'You do not have access to this dashboard.'));
      setSummary(null);
      setFallbackProjects(null);
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

  const projectNames = useMemo(
    () => new Map((summary?.projects ?? []).map((p) => [p.projectId, p.name])),
    [summary],
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        eyebrow="Operations Command Center"
        description="Overview of Buildora operations, projects, and financials."
      >
        <ButtonLink href="/app/projects/new">
          <Plus size={16} />
          New Project
        </ButtonLink>
      </PageHeader>
      <DashboardTabs role="owner" />
      {loading ? (
        <Loading label="Loading dashboard…" />
      ) : error ? (
        <DashboardError message={error} onRetry={fetchAll} />
      ) : summary ? (
        <OwnerDashboardBody
          summary={summary}
          tasks={tasks}
          leads={leads}
          projectNames={projectNames}
          canPay={canPay}
        />
      ) : fallbackProjects ? (
        <ProjectManagerDashboardBody projects={fallbackProjects} tasks={tasks} />
      ) : (
        <DashboardError message="You do not have access to this dashboard." onRetry={fetchAll} />
      )}
    </>
  );
}

function OwnerDashboardBody({
  summary,
  tasks,
  leads,
  projectNames,
  canPay,
}: {
  summary: ApiDashboardSummary;
  tasks: ApiDashboardTask[];
  leads: ApiLead[] | null;
  projectNames: Map<string, string>;
  canPay: boolean;
}) {
  const recentLeads = (leads ?? []).slice(0, 2);
  return (
    <>
      <div className="stats six">
        <StatCard
          label="Active Projects"
          value={summary.counts.inProgress}
          detail="Across the active portfolio"
          icon={<Building2 size={16} />}
        />
        <StatCard
          label="Open Leads"
          value={summary.openLeads}
          detail="New / Contacted"
          icon={<Contact size={16} />}
        />
        <StatCard
          label="Total Project Budget"
          value={formatAmount(summary.totalBudget)}
          detail="Across active sites"
          icon={<Wallet size={16} />}
        />
        <StatCard label="Total Paid" value={formatAmount(summary.totalPaid)} detail={`${summary.utilization}% recorded`} />
        <StatCard
          label="Remaining Budget"
          value={formatAmount(summary.remainingBudget)}
          detail="Portfolio allocation"
        />
        <StatCard
          label="Budget Utilization"
          value={`${summary.utilization}%`}
          detail={`${summary.counts.total} projects tracked`}
        />
      </div>
      <div className="two-column">
        <div className="stack">
          <ProjectsOverviewPanel projects={summary.projects} />
          <Panel title="Recent Payments" action={<TextLink href="/app/payments">View All Payments</TextLink>}>
            {!summary.recentPayments.length ? (
              <p className="small">No payments recorded yet.</p>
            ) : (
              summary.recentPayments.map((p: ApiDashboardRecentPayment) => (
                <div className="activity" key={p.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{formatAmount(p.amount)}</strong>
                    <p>
                      {projectNames.get(p.projectId) ?? 'Project'} · {displayDate(p.paymentDate)}
                    </p>
                    {canPay && (
                      <TextLink href={'/app/payments/' + p.id + '?projectId=' + p.projectId}>
                        View Payment
                      </TextLink>
                    )}
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
        <div className="stack">
          <CriticalTasksPanel tasks={tasks} />
          {leads !== null && (
            <Panel title="Recent Leads" action={<TextLink href="/app/leads">View Pipeline</TextLink>}>
              {!recentLeads.length ? (
                <p className="small">No leads yet.</p>
              ) : (
                recentLeads.map((l) => (
                  <div className="activity" key={l.id}>
                    <span className="activity-dot" />
                    <div>
                      <TextLink href={'/app/leads/' + l.id}>{l.name}</TextLink>
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
  const asAttention: ApiDashboardProject[] = [...projects]
    .sort((a, b) => (a.progressPercent ?? 0) - (b.progressPercent ?? 0))
    .slice(0, 3)
    .map((p) => ({
      projectId: p.id,
      name: p.name,
      budget: p.budget ?? 0,
      paid: 0,
      remaining: p.budget ?? 0,
      progressPercent: p.progressPercent ?? 0,
    }));
  return (
    <>
      <div className="stats six">
        <StatCard
          label="Active Projects"
          value={projects.filter((p) => p.status === 'IN_PROGRESS').length}
          detail="Across the active portfolio"
          icon={<Building2 size={16} />}
        />
        <StatCard label="Total Projects" value={projects.length} detail="All statuses" icon={<DoorOpen size={16} />} />
        <StatCard
          label="Total Project Budget"
          value={formatAmount(totalBudget)}
          detail="Across active sites"
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
          <Panel title="Projects Overview" subtitle="Lowest completion first. Budget utilization is owner-visible only.">
            {!asAttention.length ? (
              <p className="small">No projects yet.</p>
            ) : (
              asAttention.map((p) => (
                <div className="attention-card" key={p.projectId}>
                  <h3>
                    <TextLink href={'/app/projects/' + p.projectId}>{p.name}</TextLink>
                  </h3>
                  <p>{formatAmount(p.budget)} budget</p>
                  <div className="section-space">
                    <Progress value={p.progressPercent} />
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
        <div className="stack">
          <CriticalTasksPanel tasks={tasks} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Site Engineer dashboard (real company tasks; engineer-readable only).
// ---------------------------------------------------------------------------

function EngineerDashboard() {
  const companyId = useAuthStore((s) => s.companyId);
  const sessionUser = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<ApiDashboardTask[]>([]);
  const [activeProjects, setActiveProjects] = useState(0);
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
      const [freshTasks, projectList] = await Promise.all([
        getCompanyDashboardTasks(companyId),
        getProjects(companyId, { limit: 100 }),
      ]);
      setTasks(freshTasks);
      setActiveProjects(projectList.filter((p) => p.status === 'IN_PROGRESS').length);
    } catch (err) {
      setError(errorFor(err, 'You do not have access to this dashboard.'));
      setTasks([]);
      setActiveProjects(0);
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
  const byStage = useMemo(() => {
    const groups = new Map<string, { stageName: string; projectId: string; projectName: string; rows: ApiDashboardTask[] }>();
    for (const t of tasks) {
      const key = t.stageId;
      const group = groups.get(key) ?? {
        stageName: t.stageName,
        projectId: t.projectId,
        projectName: t.projectName,
        rows: [],
      };
      group.rows.push(t);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [tasks]);

  return (
    <>
      <PageHeader
        title="Site Operations Dashboard"
        eyebrow="Operations Command Center"
        description="Your assigned site tasks and current stage workload."
      >
        <ButtonLink href="/app/tasks/new">
          <Plus size={16} />
          New Task
        </ButtonLink>
      </PageHeader>
      <DashboardTabs role="engineer" />
      {loading ? (
        <Loading label="Loading site dashboard…" />
      ) : error ? (
        <DashboardError message={error} onRetry={fetchAll} />
      ) : (
        <>
          <div className="stats">
            <StatCard
              label="My Open Tasks"
              value={mineOpen.length}
              detail="Assigned to me"
              icon={<ClipboardList size={16} />}
            />
            <StatCard
              label="My Overdue Tasks"
              value={mineOpen.filter((t) => isTaskOverdue(t.endDate, t.status)).length}
              detail="Need attention"
            />
            <StatCard
              label="My Completed Tasks"
              value={mine.filter((t) => t.status === 'COMPLETED').length}
              detail="Assigned to me"
            />
            <StatCard
              label="Active Projects"
              value={activeProjects}
              detail="Across the active portfolio"
              icon={<Building2 size={16} />}
            />
          </div>
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
                      { label: 'Task', value: (t) => <strong>{t.title}</strong>, sort: (t) => t.title },
                      { label: 'Project', value: (t) => t.projectName },
                      { label: 'Stage', value: (t) => t.stageName },
                      {
                        label: 'Due Date',
                        value: (t) => (t.endDate ? displayDate(t.endDate) : '—'),
                        sort: (t) => t.endDate ?? '',
                      },
                      { label: 'Status', value: (t) => <Badge value={t.status} /> },
                      {
                        label: 'Condition',
                        value: (t) => (
                          <Badge value={isTaskOverdue(t.endDate, t.status) ? 'Overdue' : 'On Track'} />
                        ),
                      },
                      {
                        label: 'Actions',
                        value: (t) => <TextLink href={'/app/tasks/' + t.id}>View Task</TextLink>,
                      },
                    ]}
                  />
                )}
              </Panel>
            </div>
            <div className="stack">
              <Panel title="Site Workload by Stage" subtitle="All company tasks grouped by stage.">
                {!byStage.length ? (
                  <p className="small">No stages with tasks.</p>
                ) : (
                  byStage.map((g) => {
                    const done = g.rows.filter((t) => t.status === 'COMPLETED').length;
                    const pct = g.rows.length ? Math.round((done / g.rows.length) * 100) : 0;
                    return (
                      <div className="attention-card" key={g.rows[0].stageId}>
                        <h3>{g.stageName}</h3>
                        <p>
                          {g.projectName} · {done}/{g.rows.length} tasks done
                        </p>
                        <div className="section-space">
                          <Progress value={pct} />
                        </div>
                        <TextLink href={'/app/construction/stages/' + g.rows[0].stageId}>
                          View Stage
                        </TextLink>
                      </div>
                    );
                  })
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sales dashboard (real sales summary + real leads; no project/payment calls).
// ---------------------------------------------------------------------------

function SalesDashboard() {
  const companyId = useAuthStore((s) => s.companyId);
  const [sales, setSales] = useState<ApiSalesDashboard | null>(null);
  const [leads, setLeads] = useState<ApiLead[]>([]);
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
      const [freshSales, freshLeads] = await Promise.all([
        getCompanySalesDashboard(companyId),
        getCompanyLeads(companyId),
      ]);
      setSales(freshSales);
      setLeads(freshLeads);
    } catch (err) {
      setError(errorFor(err, 'You do not have access to this dashboard.'));
      setSales(null);
      setLeads([]);
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

  return (
    <>
      <PageHeader
        title="Sales & Property Dashboard"
        eyebrow="Operations Command Center"
        description="Unit availability, enquiries, and the lead pipeline."
      >
        <ButtonLink href="/apartments" secondary>
          View Public Catalog
        </ButtonLink>
      </PageHeader>
      <DashboardTabs role="sales" />
      {loading ? (
        <Loading label="Loading sales dashboard…" />
      ) : error ? (
        <DashboardError message={error} onRetry={fetchAll} />
      ) : (
        <>
          <div className="stats">
            <StatCard
              label="Total Units"
              value={sales?.apartments.total ?? 0}
              detail="Tracked inventory"
              icon={<DoorOpen size={16} />}
            />
            <StatCard label="Available" value={sales?.apartments.available ?? 0} detail="Ready for sale" />
            <StatCard label="Reserved" value={sales?.apartments.reserved ?? 0} detail="Held units" />
            <StatCard label="Sold" value={sales?.apartments.sold ?? 0} detail="Closed units" />
            <StatCard
              label="Public Apartments"
              value={sales?.apartments.public ?? 0}
              detail="On the showcase"
              icon={<Building2 size={16} />}
            />
          </div>
          <div className="two-column">
            <div className="stack">
              <Panel
                title="Most Enquired Units"
                subtitle="Units with the most leads."
                action={<TextLink href="/app/leads">View Pipeline</TextLink>}
              >
                {!sales?.topUnits.length ? (
                  <p className="small">No enquiries yet.</p>
                ) : (
                  <DataTable
                    rows={sales.topUnits}
                    searchText={(u) => `${u.unitNumber} ${u.projectName}`}
                    placeholder="Search units…"
                    emptyTitle="No enquiries yet"
                    columns={[
                      { label: 'Unit', value: (u) => <strong>{u.unitNumber}</strong>, sort: (u) => u.unitNumber },
                      { label: 'Project', value: (u) => u.projectName },
                      { label: 'Enquiries', value: (u) => u.leadCount, sort: (u) => u.leadCount },
                    ]}
                  />
                )}
              </Panel>
            </div>
            <div className="stack">
              <Panel
                title="Lead Pipeline"
                subtitle={`New ${counts.new} · Contacted ${counts.contacted} · Closed ${counts.closed}`}
              >
                {!leads.length ? (
                  <p className="small">No leads yet.</p>
                ) : (
                  <DataTable
                    rows={leads}
                    searchText={(l) => `${l.name} ${l.phone ?? ''} ${l.email ?? ''}`}
                    placeholder="Search leads…"
                    emptyTitle="No leads yet"
                    columns={[
                      { label: 'Lead', value: (l) => <strong>{l.name}</strong>, sort: (l) => l.name },
                      { label: 'Status', value: (l) => <Badge value={l.status} /> },
                      {
                        label: 'Enquired',
                        value: (l) => displayDate(l.createdAt),
                        sort: (l) => l.createdAt,
                      },
                      {
                        label: 'Actions',
                        value: (l) => <TextLink href={'/app/leads/' + l.id}>View</TextLink>,
                      },
                    ]}
                  />
                )}
              </Panel>
            </div>
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
