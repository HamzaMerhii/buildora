import { apiJson } from './client';
import { fromBackendStatus, type FrontendProjectStatus } from './project.api';
import { fromBackendTaskStatus, type FrontendTaskStatus } from './task.api';

/**
 * Company dashboard endpoints (verified against
 * backend/app/routers/dashboard.py, mounted in main.py).
 *
 * - GET /companies/{company_id}/dashboard/summary (require_company_owner
 *   = OWNER only; project counts, financial totals, open-lead count,
 *   per-project budget/paid/progress rows, 5 recent payments)
 * - GET /companies/{company_id}/dashboard/tasks (require_site_management
 *   = OWNER/PROJECT_MANAGER/SITE_ENGINEER; full company task list with
 *   stage/project context, no query params, no pagination)
 * - GET /companies/{company_id}/dashboard/sales (require_sales =
 *   OWNER/SALES; apartment status/public counts, top-5 enquired units)
 * - GET /companies/{company_id}/dashboard/finance (require_finance =
 *   OWNER/FINANCE; totals, by-project/by-category aggregates, 10 recent
 *   payments with resolved names)
 * Canonical URLs carry no trailing slash. There is no by-category
 * breakdown on the summary and no task query filters.
 */

/** Backend Decimal values serialize as strings — normalize centrally. */
export function toDashboardNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Raw wire shapes (snake_case). */
export interface BackendDashboardProject {
  project_id: string;
  name: string;
  budget: string | number;
  paid: string | number;
  remaining: string | number;
  progress_percent: number;
}

export interface BackendDashboardRecentPayment {
  id: string;
  project_id: string;
  amount: string | number;
  payment_date: string;
  description: string | null;
  created_at: string;
}

export interface BackendDashboardSummary {
  project_counts: {
    total: number;
    planning: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  total_budget: string | number;
  total_paid: string | number;
  remaining_budget: string | number;
  budget_utilization_percent: number;
  open_leads: number;
  projects: BackendDashboardProject[];
  recent_payments: BackendDashboardRecentPayment[];
}

export interface BackendDashboardTask {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  stage_id: string;
  stage_name: string;
  project_id: string;
  project_name: string;
}

export interface BackendSalesDashboard {
  apartments: {
    total: number;
    available: number;
    reserved: number;
    sold: number;
    public: number;
  };
  top_enquired_units: Array<{
    apartment_id: string;
    unit_number: string;
    project_id: string;
    project_name: string;
    lead_count: number;
  }>;
}

export interface BackendFinanceRecentPayment {
  id: string;
  project_id: string;
  project_name: string;
  party_id: string | null;
  party_name: string | null;
  category_id: string | null;
  category_name: string | null;
  amount: string | number;
  payment_date: string;
  reference: string | null;
  description: string | null;
}

export interface BackendFinanceDashboard {
  total_paid: string | number;
  payment_count: number;
  payments_this_month: string | number;
  projects_covered: number;
  by_project: Array<{ project_id: string; project_name: string; total_paid: string | number }>;
  by_category: Array<{ category_id: string; category_name: string; total_paid: string | number }>;
  recent_payments: BackendFinanceRecentPayment[];
}

/** Frontend shapes (camelCase, numbers normalized). */
export interface ApiDashboardProject {
  projectId: string;
  name: string;
  budget: number;
  paid: number;
  remaining: number;
  progressPercent: number;
}

export interface ApiDashboardRecentPayment {
  id: string;
  projectId: string;
  amount: number;
  paymentDate: string;
  description?: string;
  createdAt: string;
}

export interface ApiDashboardSummary {
  counts: {
    total: number;
    planning: number;
    inProgress: number;
    completed: number;
    onHold: number;
  };
  totalBudget: number;
  totalPaid: number;
  remainingBudget: number;
  utilization: number;
  openLeads: number;
  projects: ApiDashboardProject[];
  recentPayments: ApiDashboardRecentPayment[];
}

export interface ApiDashboardTask {
  id: string;
  title: string;
  status: FrontendTaskStatus;
  progress: number;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  stageId: string;
  stageName: string;
  projectId: string;
  projectName: string;
}

export interface ApiSalesDashboard {
  apartments: {
    total: number;
    available: number;
    reserved: number;
    sold: number;
    public: number;
  };
  topUnits: Array<{
    id: string;
    apartmentId: string;
    unitNumber: string;
    projectId: string;
    projectName: string;
    leadCount: number;
  }>;
}

export interface ApiFinanceByProject {
  projectId: string;
  projectName: string;
  totalPaid: number;
}

export interface ApiFinanceByCategory {
  categoryId: string;
  categoryName: string;
  totalPaid: number;
}

export interface ApiFinanceRecentPayment {
  id: string;
  projectId: string;
  projectName: string;
  partyId?: string;
  partyName?: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  paymentDate: string;
  reference?: string;
  description?: string;
}

export interface ApiFinanceDashboard {
  totalPaid: number;
  paymentCount: number;
  paymentsThisMonth: number;
  projectsCovered: number;
  byProject: ApiFinanceByProject[];
  byCategory: ApiFinanceByCategory[];
  recentPayments: ApiFinanceRecentPayment[];
}

export function mapDashboardSummaryToFrontend(s: BackendDashboardSummary): ApiDashboardSummary {
  return {
    counts: {
      total: s.project_counts.total,
      planning: s.project_counts.planning,
      inProgress: s.project_counts.in_progress,
      completed: s.project_counts.completed,
      onHold: s.project_counts.on_hold,
    },
    totalBudget: toDashboardNumber(s.total_budget),
    totalPaid: toDashboardNumber(s.total_paid),
    remainingBudget: toDashboardNumber(s.remaining_budget),
    utilization: s.budget_utilization_percent,
    openLeads: s.open_leads,
    projects: s.projects.map((p) => ({
      projectId: p.project_id,
      name: p.name,
      budget: toDashboardNumber(p.budget),
      paid: toDashboardNumber(p.paid),
      remaining: toDashboardNumber(p.remaining),
      progressPercent: p.progress_percent ?? 0,
    })),
    recentPayments: s.recent_payments.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      amount: toDashboardNumber(p.amount),
      paymentDate: p.payment_date,
      description: p.description ?? undefined,
      createdAt: p.created_at,
    })),
  };
}

export function mapDashboardTaskToFrontend(t: BackendDashboardTask): ApiDashboardTask {
  return {
    id: t.id,
    title: t.title,
    status: fromBackendTaskStatus(t.status),
    progress: t.progress_percent ?? 0,
    assignedTo: t.assigned_to ?? undefined,
    startDate: t.start_date ?? undefined,
    endDate: t.due_date ?? undefined,
    stageId: t.stage_id,
    stageName: t.stage_name,
    projectId: t.project_id,
    projectName: t.project_name,
  };
}

export function mapSalesDashboardToFrontend(s: BackendSalesDashboard): ApiSalesDashboard {
  return {
    apartments: { ...s.apartments },
    topUnits: s.top_enquired_units.map((u) => ({
      id: u.apartment_id,
      apartmentId: u.apartment_id,
      unitNumber: u.unit_number,
      projectId: u.project_id,
      projectName: u.project_name,
      leadCount: u.lead_count,
    })),
  };
}

export function mapFinanceDashboardToFrontend(f: BackendFinanceDashboard): ApiFinanceDashboard {
  return {
    totalPaid: toDashboardNumber(f.total_paid),
    paymentCount: f.payment_count,
    paymentsThisMonth: toDashboardNumber(f.payments_this_month),
    projectsCovered: f.projects_covered,
    byProject: f.by_project.map((p) => ({
      projectId: p.project_id,
      projectName: p.project_name,
      totalPaid: toDashboardNumber(p.total_paid),
    })),
    byCategory: f.by_category.map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name,
      totalPaid: toDashboardNumber(c.total_paid),
    })),
    recentPayments: f.recent_payments.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      projectName: p.project_name,
      partyId: p.party_id ?? undefined,
      partyName: p.party_name ?? undefined,
      categoryId: p.category_id ?? undefined,
      categoryName: p.category_name ?? undefined,
      amount: toDashboardNumber(p.amount),
      paymentDate: p.payment_date,
      reference: p.reference ?? undefined,
      description: p.description ?? undefined,
    })),
  };
}

/** Frontend project-status label for summary count keys (all real enum values). */
export function dashboardProjectStatusLabel(key: string): FrontendProjectStatus {
  return fromBackendStatus(key);
}

export async function getCompanyDashboardSummary(companyId: string): Promise<ApiDashboardSummary> {
  const raw = await apiJson<BackendDashboardSummary>(`/companies/${companyId}/dashboard/summary`);
  return mapDashboardSummaryToFrontend(raw);
}

/** Full company task list with stage/project context (no server filters). */
export async function getCompanyDashboardTasks(companyId: string): Promise<ApiDashboardTask[]> {
  const raw = await apiJson<BackendDashboardTask[]>(`/companies/${companyId}/dashboard/tasks`);
  return raw.map(mapDashboardTaskToFrontend);
}

export async function getCompanySalesDashboard(companyId: string): Promise<ApiSalesDashboard> {
  const raw = await apiJson<BackendSalesDashboard>(`/companies/${companyId}/dashboard/sales`);
  return mapSalesDashboardToFrontend(raw);
}

export async function getCompanyFinanceDashboard(companyId: string): Promise<ApiFinanceDashboard> {
  const raw = await apiJson<BackendFinanceDashboard>(`/companies/${companyId}/dashboard/finance`);
  return mapFinanceDashboardToFrontend(raw);
}
