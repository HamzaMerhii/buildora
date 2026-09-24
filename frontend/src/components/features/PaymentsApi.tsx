'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Wallet, CalendarDays, Hash, Tag, Download } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  formatAmount,
  getCompanyPayments,
  getPayment,
  getProjectPayments,
  downloadPaymentInvoice,
  invoiceFilename,
  resolvePaymentProject,
  type ApiPayment,
  type ApiPaymentWithProject,
} from '@/lib/api/payment.api';
import {
  buildCategoriesById,
  getPaymentCategories,
  type ApiPaymentCategory,
} from '@/lib/api/payment-category.api';
import { getParties, type ApiParty } from '@/lib/api/party.api';
import { getProjects } from '@/lib/api/project.api';
import {
  getCompanyFinanceDashboard,
  type ApiFinanceDashboard,
} from '@/lib/api/dashboard.api';
import {
  activeMembers,
  buildMembersByUserId,
  getCompanyMembers,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { displayDate } from '@/lib/utils/format';
import { exportCsv } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  TextLink,
  DetailList,
  EmptyState,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';

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

function shortId(id: string): string {
  return id.slice(0, 8);
}

function useCompanyId(): string | null {
  return useAuthStore((s) => s.companyId);
}

// Payment reads/writes are OWNER/FINANCE backend-side, mirrored by the
// frontend `payments` module key.
function useCanMutatePayments(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || canAccess(companyRole, 'payments');
}

// ---------------------------------------------------------------------------
// Shared directory: projects, parties, categories, and members loaded once
// per page, then resolved through lookup maps (no N+1).
// ---------------------------------------------------------------------------

export interface PaymentDirectory {
  projectsById: Map<string, string>;
  partiesById: Map<string, ApiParty>;
  categoriesById: Map<string, ApiPaymentCategory>;
  categories: ApiPaymentCategory[];
  membersByUserId: Map<string, ApiCompanyMember>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePaymentDirectory(companyId: string | null): PaymentDirectory {
  const [projectsById, setProjectsById] = useState<Map<string, string>>(new Map());
  const [partiesById, setPartiesById] = useState<Map<string, ApiParty>>(new Map());
  const [categories, setCategories] = useState<ApiPaymentCategory[]>([]);
  const [membersByUserId, setMembersByUserId] = useState<Map<string, ApiCompanyMember>>(
    new Map(),
  );
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
      const [projects, parties, cats, members] = await Promise.all([
        getProjects(companyId, { limit: 100 }),
        getParties(companyId),
        getPaymentCategories(),
        // Members list is OWNER-only backend-side; FINANCE readers fall
        // back to UUID labels instead of failing the whole directory.
        getCompanyMembers(companyId).catch(() => [] as ApiCompanyMember[]),
      ]);
      setProjectsById(new Map(projects.map((p) => [p.id, p.name])));
      setPartiesById(new Map(parties.map((p) => [p.id, p])));
      setCategories(cats);
      setMembersByUserId(buildMembersByUserId(activeMembers(members)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to payments for this company.');
      } else {
        setError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- directory load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    projectsById,
    partiesById,
    categoriesById: buildCategoriesById(categories),
    categories,
    membersByUserId,
    loading,
    error,
    refetch: fetchAll,
  };
}

export function resolvePaymentAuthor(
  createdBy: string | undefined,
  membersByUserId: Map<string, ApiCompanyMember>,
): string {
  if (!createdBy) return '—';
  const member = membersByUserId.get(createdBy);
  if (member) return member.name;
  return `Team member ${shortId(createdBy)}`;
}

/**
 * Shared invoice download: authenticated blob fetch, temporary anchor,
 * object URL revoked. One request per click; errors surface as text
 * (never downloaded as .pdf).
 */
export function useInvoiceDownload(): {
  downloadingId: string | null;
  download: (companyId: string, payment: Pick<ApiPayment, 'id' | 'projectId' | 'reference'>) => Promise<void>;
} {
  const { notify } = useWorkspace();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(
    async (companyId: string, payment: Pick<ApiPayment, 'id' | 'projectId' | 'reference'>) => {
      setDownloadingId(payment.id);
      try {
        const { blob, filename } = await downloadPaymentInvoice(companyId, payment.projectId, payment.id);
        if (!blob.size || (blob.type && !blob.type.includes('pdf'))) {
          throw new ApiError(500, 'Could not download the payment invoice.');
        }
        const url = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename ?? invoiceFilename(payment.reference, payment.id);
          // Attached to the DOM so every browser honors the click, and
          // revoked asynchronously so the download can finish reading.
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch {
          URL.revokeObjectURL(url);
          throw new ApiError(500, 'Could not download the payment invoice.');
        }
      } catch (err) {
        notify(
          err instanceof ApiError && err.status === 403
            ? 'You do not have access to this payment invoice.'
            : err instanceof ApiError && err.status === 404
              ? 'Payment invoice not found.'
              : 'Could not download the payment invoice.',
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [notify],
  );

  return { downloadingId, download };
}

// ---------------------------------------------------------------------------
// Real payment table. Names resolve through lookup maps built once per
// page (no per-row requests). Amounts are plain numbers — no currency.
// ---------------------------------------------------------------------------

export function PaymentTableReal({
  rows,
  projectsById,
  partiesById,
  categoriesById,
  showProject = true,
}: {
  rows: ApiPaymentWithProject[];
  projectsById: Map<string, string>;
  partiesById: Map<string, ApiParty>;
  categoriesById: Map<string, ApiPaymentCategory>;
  showProject?: boolean;
}) {
  const [project, setProject] = useState('');
  const [party, setParty] = useState('');
  const [category, setCategory] = useState('');
  const companyId = useAuthStore((s) => s.companyId);
  const { downloadingId, download } = useInvoiceDownload();
  const partyName = (id: string | undefined) => (id ? (partiesById.get(id)?.name ?? '—') : '—');
  return (
    <DataTable
      rows={rows.filter(
        (p) =>
          (!project || p.projectId === project) &&
          (!party || p.partyId === party) &&
          (!category || p.categoryId === category),
      )}
      searchText={(p) => (p.reference ?? '') + ' ' + partyName(p.partyId) + ' ' + (p.description ?? '')}
      placeholder="Search reference, party, or description…"
      filters={
        <>
          {showProject && (
            <select aria-label="Payment project" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All Projects</option>
              {[...projectsById].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Payment party" value={party} onChange={(e) => setParty(e.target.value)}>
            <option value="">All Parties</option>
            {[...partiesById.values()].map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Payment category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {[...categoriesById.values()].map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      }
      columns={[
        { label: 'Date', value: (p) => displayDate(p.paymentDate), sort: (p) => p.paymentDate },
        { label: 'Reference', value: (p) => p.reference ?? '—', sort: (p) => p.reference ?? '' },
        ...(showProject
          ? [{ label: 'Project', value: (p: ApiPaymentWithProject) => p.projectName ?? projectsById.get(p.projectId) ?? '—' }]
          : []),
        { label: 'Party', value: (p) => partyName(p.partyId) },
        {
          label: 'Party Type',
          value: (p) => {
            const type = p.partyId ? partiesById.get(p.partyId)?.type : undefined;
            return type ? <Badge value={type} /> : '—';
          },
        },
        {
          label: 'Category',
          value: (p) => {
            const name = p.categoryId ? categoriesById.get(p.categoryId)?.name : undefined;
            return <Badge value={name ?? 'Other'} />;
          },
        },
        { label: 'Amount', value: (p) => <strong>{formatAmount(p.amount)}</strong>, sort: (p) => p.amount },
        {
          label: 'Actions',
          value: (p) => (
            <div className="row-actions">
              <TextLink href={'/app/payments/' + p.id + '?projectId=' + p.projectId}>View</TextLink>
              <button
                onClick={() => companyId && download(companyId, p)}
                disabled={!companyId || downloadingId === p.id}
                aria-label={'Download invoice for ' + (p.reference ?? 'payment ' + shortId(p.id))}
              >
                {downloadingId === p.id ? 'Preparing…' : 'Invoice'}
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Company-wide ledger. The backend is project-scoped, so this page fans
// out across the company's projects in parallel (projects loaded once).
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = ['#22c55e', '#f59e0b', '#64748b', '#3b82f6', '#a855f7', '#0ea5e9'];

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function thisYearKey(): string {
  return String(new Date().getFullYear());
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DateRange = '' | 'month' | 'days30' | 'year';

export function PaymentsWorkspaceList() {
  const companyId = useCompanyId();
  const canMutate = useCanMutatePayments();
  const directory = usePaymentDirectory(companyId);
  const [rows, setRows] = useState<ApiPaymentWithProject[]>([]);
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
      setRows(await getCompanyPayments(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to payments for this company.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- ledger load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [dateRange, setDateRange] = useState<DateRange>('');
  const total = useMemo(() => rows.reduce((s, p) => s + p.amount, 0), [rows]);
  const monthTotal = useMemo(
    () => rows.filter((p) => monthKey(p.paymentDate) === thisMonthKey()).reduce((s, p) => s + p.amount, 0),
    [rows],
  );
  const byCategory = useMemo(
    () =>
      directory.categories
        .map((c, i) => ({
          category: c,
          total: rows.filter((p) => p.categoryId === c.id).reduce((s, p) => s + p.amount, 0),
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }))
        .sort((a, b) => b.total - a.total),
    [directory.categories, rows],
  );
  const largest = byCategory[0];
  const dateFilteredRows = useMemo(() => {
    if (!dateRange) return rows;
    if (dateRange === 'month') return rows.filter((p) => monthKey(p.paymentDate) === thisMonthKey());
    if (dateRange === 'year') return rows.filter((p) => p.paymentDate.slice(0, 4) === thisYearKey());
    return rows.filter((p) => p.paymentDate >= thirtyDaysAgo());
  }, [rows, dateRange]);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <>
      <PageHeader title="Payments" eyebrow="Financial Ledgers" description="Track actual outgoing project payments.">
        <ButtonLink href="/app/payments/categories" secondary>
          Payment Categories
        </ButtonLink>
        <button className="button secondary" type="button" onClick={() => exportCsv('payment-ledger', rows)}>
          Export Ledger
        </button>
        {canMutate && (
          <ButtonLink href="/app/payments/new">
            <Plus size={16} />
            Record Payment
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Recorded Payments" value={formatAmount(total)} detail="Across active portfolio" icon={<Wallet size={14} />} />
        <StatCard
          label="Payments This Month"
          value={formatAmount(monthTotal)}
          detail={total > 0 ? `${pct(monthTotal)}% of total spend` : 'No spend recorded'}
          icon={<CalendarDays size={14} />}
        />
        <StatCard label="Number of Payments" value={rows.length} detail="Ledger entries" icon={<Hash size={14} />} />
        <StatCard
          label="Largest Category"
          value={largest && largest.total > 0 ? largest.category.name : '—'}
          detail={largest && largest.total > 0 ? `${formatAmount(largest.total)} · ${pct(largest.total)}% of total` : 'No payments yet'}
          icon={<Tag size={14} />}
        />
      </div>
      {loading || directory.loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading payments…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : directory.error ? (
        <ListError message={directory.error} onRetry={directory.refetch} />
      ) : !rows.length ? (
        <EmptyState
          title="No payments recorded yet"
          description="Record the first outgoing payment for a project."
          href={canMutate ? '/app/payments/new' : undefined}
          action="Record Payment"
        />
      ) : (
        <>
          <div className="toolbar section-space" style={{ borderRadius: 10 }}>
            <label className="search-control" style={{ flexBasis: 'auto', flexGrow: 1 }}>
              <span className="small muted">Date range</span>
            </label>
            <select
              aria-label="Payment date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
            >
              <option value="">All Dates</option>
              <option value="month">This Month</option>
              <option value="days30">Last 30 Days</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <PaymentTableReal
            rows={dateFilteredRows}
            projectsById={directory.projectsById}
            partiesById={directory.partiesById}
            categoriesById={directory.categoriesById}
          />
          <div className="section-space">
            <Panel
              title="Portfolio Allocation"
              subtitle="Payments by Category"
              action={<span className="small muted">Cumulative Disbursed: {formatAmount(total)}</span>}
            >
              {!byCategory.length || total <= 0 ? (
                <p className="small">No payment allocation data yet.</p>
              ) : (
                <>
                  <div className="dist-bar" role="img" aria-label={`Payment allocation totaling ${formatAmount(total)}`}>
                    {byCategory
                      .filter((b) => b.total > 0)
                      .map((b) => (
                        <span key={b.category.id} style={{ width: pct(b.total) + '%', background: b.color }} title={`${b.category.name}: ${formatAmount(b.total)}`} />
                      ))}
                  </div>
                  <div className="allocation-legend">
                    {byCategory.map((b) => (
                      <div key={b.category.id}>
                        <span>
                          <span className="donut-dot" style={{ background: b.color }} aria-hidden="true" />{' '}
                          {b.category.name}
                        </span>
                        <strong>
                          {formatAmount(b.total)} · {pct(b.total)}% of total
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Real payment detail. Project context comes from ?projectId= when
// present, otherwise company traversal. Read-only: no edit/delete exist.
// ---------------------------------------------------------------------------

export function PaymentWorkspaceDetail({ id }: { id: string }) {
  const companyId = useCompanyId();
  const searchParams = useSearchParams();
  const hintProjectId = searchParams.get('projectId');
  const directory = usePaymentDirectory(companyId);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [payment, setPayment] = useState<ApiPayment | null>(null);
  const [projectTotal, setProjectTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { downloadingId, download } = useInvoiceDownload();

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolvePaymentProject(
        companyId,
        id,
        hintProjectId ? { projectId: hintProjectId } : undefined,
      );
      const [fresh, siblings] = await Promise.all([
        getPayment(companyId, resolved.chain.projectId, id),
        getProjectPayments(companyId, resolved.chain.projectId).catch(() => [] as ApiPayment[]),
      ]);
      setProjectId(resolved.chain.projectId);
      setProjectName(
        resolved.chain.projectName ??
          directory.projectsById.get(resolved.chain.projectId) ??
          '',
      );
      setPayment(fresh);
      setProjectTotal(siblings.reduce((s, p) => s + p.amount, 0));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Payment not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this payment.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setPayment(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- project name map settles via directory
  }, [companyId, id, hintProjectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading || directory.loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading payment…
      </p>
    );
  }
  if (error || !payment || !projectId) {
    return (
      <>
        <ListError message={error ?? 'Payment not found.'} onRetry={fetchDetail} />
        <p className="section-space">
          <TextLink href="/app/payments">Back to Payments</TextLink>
        </p>
      </>
    );
  }

  const p = payment;
  const party = p.partyId ? directory.partiesById.get(p.partyId) : undefined;
  const categoryName = p.categoryId ? directory.categoriesById.get(p.categoryId)?.name : undefined;

  return (
    <>
      <PageHeader
        title={'Payment ' + (p.reference ?? shortId(p.id))}
        description={(projectName || 'Project') + ' · ' + (party?.name ?? '—')}
        back="/app/payments"
      >
        <Badge value="Recorded" />
        <button
          className="button secondary"
          type="button"
          onClick={() => companyId && download(companyId, p)}
          disabled={!companyId || downloadingId === p.id}
        >
          <Download size={15} />
          {downloadingId === p.id ? 'Preparing…' : 'Download Invoice'}
        </button>
      </PageHeader>
      <div className="stats">
        <StatCard label="Settled Amount" value={formatAmount(p.amount)} />
        <StatCard label="Payment Category" value={categoryName ?? '—'} />
        <StatCard label="Payment Date" value={displayDate(p.paymentDate)} />
        <StatCard label="Reference" value={p.reference ?? '—'} />
      </div>
      <div className="two-column">
        <div className="stack">
          <Panel title="Payment Description">
            <p>{p.description || 'No description provided.'}</p>
          </Panel>
          <Panel title="Record Metadata">
            <DetailList
              items={[
                ['Recorded By', resolvePaymentAuthor(p.createdBy, directory.membersByUserId)],
                ['Payment Date', displayDate(p.paymentDate)],
                ['Record Entry', 'Disbursement'],
              ]}
            />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Linked Construction Project">
            <h2>{projectName || '—'}</h2>
            <DetailList
              items={[
                [
                  'Recorded Project Payments',
                  projectTotal === null ? '—' : formatAmount(projectTotal),
                ],
              ]}
            />
            <TextLink href={'/app/projects/' + projectId}>View Project</TextLink>
          </Panel>
          <Panel title="Payee Information">
            <h2>{party?.name ?? '—'}</h2>
            {party && (
              <DetailList
                items={[
                  ['Party Type', <Badge key="type" value={party.type} />],
                  ['Phone', party.phone ?? '—'],
                  ['Email', party.email ?? '—'],
                ]}
              />
            )}
            {party && <TextLink href={'/app/parties/' + party.id}>View Party</TextLink>}
          </Panel>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Project-scoped payments: the cleanest fully-supported surface (backend
// is project-scoped). Totals derive client-side from the same list.
// ---------------------------------------------------------------------------

export function ProjectPaymentsSection({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const companyId = useCompanyId();
  const canMutate = useCanMutatePayments();
  const directory = usePaymentDirectory(companyId);
  const [rows, setRows] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('');

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getProjectPayments(companyId, projectId));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Project not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to payments for this project.');
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

  /* eslint-disable react-hooks/set-state-in-effect -- section load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const total = useMemo(() => rows.reduce((s, p) => s + p.amount, 0), [rows]);
  const monthTotal = useMemo(
    () => rows.filter((p) => monthKey(p.paymentDate) === thisMonthKey()).reduce((s, p) => s + p.amount, 0),
    [rows],
  );
  const sectionByCategory = useMemo(
    () =>
      directory.categories
        .map((c, i) => ({
          category: c,
          total: rows.filter((p) => p.categoryId === c.id).reduce((s, p) => s + p.amount, 0),
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }))
        .sort((a, b) => b.total - a.total),
    [directory.categories, rows],
  );
  const sectionLargest = sectionByCategory[0];
  const sectionFilteredRows = useMemo(() => {
    if (!dateRange) return rows;
    if (dateRange === 'month') return rows.filter((p) => monthKey(p.paymentDate) === thisMonthKey());
    if (dateRange === 'year') return rows.filter((p) => p.paymentDate.slice(0, 4) === thisYearKey());
    return rows.filter((p) => p.paymentDate >= thirtyDaysAgo());
  }, [rows, dateRange]);
  const sectionPct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const withProject: ApiPaymentWithProject[] = sectionFilteredRows.map((p) => ({
    ...p,
    projectName: projectName ?? directory.projectsById.get(projectId),
  }));

  return (
    <>
      <PageHeader
        title="Payments"
        eyebrow={(projectName ?? directory.projectsById.get(projectId) ?? 'Project') + ' · Financial Ledgers'}
        description="Track outgoing payments for this project."
        back={'/app/projects/' + projectId}
      >
        {canMutate && (
          <ButtonLink href={'/app/payments/new?projectId=' + projectId}>
            <Plus size={16} />
            Record Payment
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Project Payments" value={formatAmount(total)} detail="This project" icon={<Wallet size={14} />} />
        <StatCard
          label="Payments This Month"
          value={formatAmount(monthTotal)}
          detail={total > 0 ? `${sectionPct(monthTotal)}% of project spend` : 'No spend recorded'}
          icon={<CalendarDays size={14} />}
        />
        <StatCard label="Number of Payments" value={rows.length} detail="Ledger entries" icon={<Hash size={14} />} />
        <StatCard
          label="Largest Category"
          value={sectionLargest && sectionLargest.total > 0 ? sectionLargest.category.name : '—'}
          detail={sectionLargest && sectionLargest.total > 0 ? `${formatAmount(sectionLargest.total)} · ${sectionPct(sectionLargest.total)}% of total` : 'No payments yet'}
          icon={<Tag size={14} />}
        />
      </div>
      {loading || directory.loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading payments…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : directory.error ? (
        <ListError message={directory.error} onRetry={directory.refetch} />
      ) : !rows.length ? (
        <EmptyState
          title="No payments recorded yet"
          description="Record the first outgoing payment for this project."
          href={canMutate ? '/app/payments/new?projectId=' + projectId : undefined}
          action="Record Payment"
        />
      ) : (
        <>
          <div className="toolbar section-space" style={{ borderRadius: 10 }}>
            <label className="search-control" style={{ flexBasis: 'auto', flexGrow: 1 }}>
              <span className="small muted">Date range</span>
            </label>
            <select
              aria-label="Payment date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
            >
              <option value="">All Dates</option>
              <option value="month">This Month</option>
              <option value="days30">Last 30 Days</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <PaymentTableReal
            rows={withProject}
            projectsById={directory.projectsById}
            partiesById={directory.partiesById}
            categoriesById={directory.categoriesById}
            showProject={false}
          />
          <div className="section-space">
            <Panel
              title="Project Allocation"
              subtitle="Payments by Category"
              action={<span className="small muted">Cumulative Disbursed: {formatAmount(total)}</span>}
            >
              {!sectionByCategory.length || total <= 0 ? (
                <p className="small">No category allocation data yet.</p>
              ) : (
                <>
                  <div className="dist-bar" role="img" aria-label={`Project payment allocation totaling ${formatAmount(total)}`}>
                    {sectionByCategory
                      .filter((b) => b.total > 0)
                      .map((b) => (
                        <span key={b.category.id} style={{ width: sectionPct(b.total) + '%', background: b.color }} title={`${b.category.name}: ${formatAmount(b.total)}`} />
                      ))}
                  </div>
                  <div className="allocation-legend">
                    {sectionByCategory.map((b) => (
                      <div key={b.category.id}>
                        <span>
                          <span className="donut-dot" style={{ background: b.color }} aria-hidden="true" />{' '}
                          {b.category.name}
                        </span>
                        <strong>
                          {formatAmount(b.total)} · {sectionPct(b.total)}% of total
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Compact payment summary for the real project overview. Independent
 * from the project GET: 403 (non-finance roles) renders nothing and
 * issues no further requests; other failures show an honest note.
 */
export function ProjectPaymentsSummary({
  companyId,
  projectId,
}: {
  companyId: string;
  projectId: string;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProjectPayments(companyId, projectId)
      .then((rows) => {
        if (cancelled) return;
        setTotal(rows.reduce((s, p) => s + p.amount, 0));
        setCount(rows.length);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) setBlocked(true);
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, projectId]);

  if (blocked) return null;
  return (
    <Panel title="Project Payments">
      {failed || total === null || count === null ? (
        <p className="small">Payment totals are currently unavailable.</p>
      ) : (
        <DetailList
          items={[
            ['Recorded Payments', formatAmount(total)],
            ['Payments Count', count],
          ]}
        />
      )}
      <p className="section-space">
        <TextLink href={'/app/projects/' + projectId + '/payments'}>View Payments</TextLink>
      </p>
    </Panel>
  );
}

/**
 * Recent payment history for a party, served from the cached company
 * ledger (no per-visit fan-out once loaded). 403 renders nothing.
 */
export function PartyPaymentsSection({
  companyId,
  partyId,
}: {
  companyId: string;
  partyId: string;
}) {
  const directory = usePaymentDirectory(companyId);
  const [rows, setRows] = useState<ApiPaymentWithProject[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCompanyPayments(companyId)
      .then((all) => {
        if (!cancelled) setRows(all.filter((p) => p.partyId === partyId));
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 403) setBlocked(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, partyId]);

  if (blocked) return null;
  if (loading || directory.loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading payments…
      </p>
    );
  }
  if (!rows.length) {
    return <p className="small">No payments recorded for this party yet.</p>;
  }
  const total = rows.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="stack">
      <StatCard label="Total Paid Out" value={formatAmount(total)} />
      <DetailList items={[['Recorded Payments', rows.length]]} />
      <div className="section-space">
        <h2 style={{ marginBottom: 16 }}>Recent Payments</h2>
        <PaymentTableReal
          rows={rows.slice(0, 5)}
          projectsById={directory.projectsById}
          partiesById={directory.partiesById}
          categoriesById={directory.categoriesById}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only category workspace. Company roles may view but never mutate
// (creation is SUPER_ADMIN-only, updates/deletes don't exist).
// ---------------------------------------------------------------------------

export function PaymentCategoriesWorkspaceList() {
  const companyId = useCompanyId();
  const directory = usePaymentDirectory(companyId);
  const [rows, setRows] = useState<ApiPaymentWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect -- category ledger load on mount */
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getCompanyPayments(companyId)
      .then((all) => {
        if (!cancelled) setRows(all);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const countFor = (categoryId: string) => rows.filter((p) => p.categoryId === categoryId).length;
  const totalFor = (categoryId: string) =>
    rows.filter((p) => p.categoryId === categoryId).reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader
        title="Payment Categories"
        description="Standardized expense categories used across project payments. Categories are managed by platform administrators."
        back="/app/payments"
      />
      <div className="stats">
        <StatCard label="Active Categories" value={directory.categories.length} />
        <StatCard label="Total Processed Payments" value={rows.length} />
        <StatCard
          label="Cumulative Outflow"
          value={formatAmount(rows.reduce((s, p) => s + p.amount, 0))}
        />
      </div>
      {loading || directory.loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading categories…
        </p>
      ) : directory.error ? (
        <ListError message={directory.error} onRetry={directory.refetch} />
      ) : (
        <DataTable
          rows={directory.categories}
          searchText={(c) => c.name}
          columns={[
            { label: 'Category', value: (c) => <strong>{c.name}</strong>, sort: (c) => c.name },
            { label: 'Created', value: (c) => displayDate(c.createdAt.slice(0, 10)) },
            { label: 'Payments Count', value: (c) => countFor(c.id), sort: (c) => countFor(c.id) },
            {
              label: 'Total Recorded',
              value: (c) => formatAmount(totalFor(c.id)),
              sort: (c) => totalFor(c.id),
            },
          ]}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Finance overview for OWNER/FINANCE roles, served by the dedicated
// finance dashboard endpoint (single request, no project-list directory,
// no per-project payment fan-out).
// ---------------------------------------------------------------------------

export function FinanceWorkspaceOverview() {
  const companyId = useCompanyId();
  const canMutate = useCanMutatePayments();
  const [data, setData] = useState<ApiFinanceDashboard | null>(null);
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
      setData(await getCompanyFinanceDashboard(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to payments for this company.');
      } else {
        setError(friendlyMessage(err));
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- finance load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const maxCategory = data?.byCategory[0]?.totalPaid ?? 0;

  return (
    <>
      <PageHeader
        title="Financial Overview & Payments"
        eyebrow="Operations Command Center"
        description="Company-wide outgoing payments across all projects."
      >
        {canMutate && (
          <ButtonLink href="/app/payments/new">
            <Plus size={16} />
            Record Payment
          </ButtonLink>
        )}
        <ButtonLink href="/app/payments" secondary>
          View Payments
        </ButtonLink>
      </PageHeader>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading financials…
        </p>
      ) : error || !data ? (
        <ListError message={error ?? 'Financials unavailable.'} onRetry={fetchAll} />
      ) : (
        <>
          <div className="stats">
            <StatCard label="Total Recorded Payments" value={formatAmount(data.totalPaid)} />
            <StatCard label="Number of Payments" value={data.paymentCount} />
            <StatCard label="Payments This Month" value={formatAmount(data.paymentsThisMonth)} />
            <StatCard label="Projects Covered" value={data.projectsCovered} />
          </div>
          <div className="two-column section-space">
            <div className="stack">
              <Panel title="Totals by Project">
                {!data.byProject.length ? (
                  <p className="small">No payments recorded yet.</p>
                ) : (
                  data.byProject.map((entry) => (
                    <div key={entry.projectId} className="panel-heading" style={{ marginBottom: 8 }}>
                      <span>{entry.projectName}</span>
                      <strong>{formatAmount(entry.totalPaid)}</strong>
                    </div>
                  ))
                )}
              </Panel>
              <Panel title="Recent Payments">
                {!data.recentPayments.length ? (
                  <p className="small">No payments recorded yet.</p>
                ) : (
                  data.recentPayments.map((p) => (
                    <div key={p.id} className="activity">
                      <span className="activity-dot" />
                      <div>
                        <strong>{p.reference ?? 'Payment ' + shortId(p.id)}</strong>
                        <p>
                          {p.projectName} · {displayDate(p.paymentDate)}
                        </p>
                        <p>
                          {p.partyName ?? 'No payee'} · {p.categoryName ?? 'Uncategorized'} ·{' '}
                          {formatAmount(p.amount)}
                        </p>
                        <TextLink href={'/app/payments/' + p.id + '?projectId=' + p.projectId}>
                          View Payment
                        </TextLink>
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </div>
            <div className="stack">
              <Panel title="Totals by Category" subtitle="Cumulative recorded disbursements.">
                {!data.byCategory.length ? (
                  <p className="small">No categories found.</p>
                ) : (
                  <>
                    <div
                      className="allocation-bar"
                      role="img"
                      aria-label="Spending by category"
                    >
                      {data.byCategory.map((c) => (
                        <span
                          key={c.categoryId}
                          title={`${c.categoryName}: ${formatAmount(c.totalPaid)}`}
                          style={{ width: (maxCategory ? (c.totalPaid / maxCategory) * 100 : 0) + '%' }}
                        />
                      ))}
                    </div>
                    <div className="allocation-legend">
                      {data.byCategory.map((c) => (
                        <div key={c.categoryId}>
                          {c.categoryName}
                          <strong>{formatAmount(c.totalPaid)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
