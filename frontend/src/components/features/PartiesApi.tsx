'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Phone, Mail, MapPin, Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import { getParties, getParty, type ApiParty } from '@/lib/api/party.api';
import {
  formatAmount,
  getCompanyPayments,
  type ApiPaymentWithProject,
} from '@/lib/api/payment.api';
import {
  usePaymentDirectory,
} from './PaymentsApi';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { displayDate } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  TextLink,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';

// Party mutations are OWNER/PROJECT_MANAGER backend-side. The frontend
// permission map has no parties-mutate key, so the PM-level
// 'projects-mutate' key is used as the documented proxy for these gates.
function useCanMutateParties(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || canAccess(companyRole, 'projects-mutate');
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

/**
 * Real Party list. Stats derive from the loaded collection (no backend
 * stats endpoint). The mock cash-flow/regional panels have no real
 * source (payments unintegrated, regions hardcoded) and are omitted.
 */
export function PartiesWorkspaceList() {
  const companyId = useAuthStore((s) => s.companyId);
  const canMutate = useCanMutateParties();
  const [rows, setRows] = useState<ApiParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('');

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getParties(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to parties for this company.');
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

  /* eslint-disable react-hooks/set-state-in-effect -- list load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <PageHeader title="Parties" description="Manage contractors, suppliers, and other external project partners.">
        {canMutate && (
          <ButtonLink href="/app/parties/new">
            <Plus size={15} />
            Add Party
          </ButtonLink>
        )}
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Parties" value={rows.length} />
        <StatCard label="Contractors" value={rows.filter((p) => p.type === 'CONTRACTOR').length} />
        <StatCard label="Suppliers" value={rows.filter((p) => p.type === 'SUPPLIER').length} />
      </div>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading parties…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : (
        <DataTable
          rows={rows.filter((p) => !type || p.type === type)}
          searchText={(p) => p.name + ' ' + (p.email ?? '')}
          filters={
            <select aria-label="Party type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All Parties</option>
              <option value="CONTRACTOR">Contractors</option>
              <option value="SUPPLIER">Suppliers</option>
            </select>
          }
          columns={[
            { label: 'Party', value: (p) => <strong>{p.name}</strong>, sort: (p) => p.name },
            { label: 'Type', value: (p) => <Badge value={p.type} /> },
            { label: 'Phone', value: (p) => (p.phone ? <a href={'tel:' + p.phone}>{p.phone}</a> : '—') },
            { label: 'Email', value: (p) => (p.email ? <a href={'mailto:' + p.email}>{p.email}</a> : '—') },
            { label: 'Address', value: (p) => p.address ?? '—' },
            {
              label: 'Actions',
              value: (p) => (
                <div className="row-actions">
                  <Link href={'/app/parties/' + p.id}>View</Link>
                  {canMutate && <Link href={'/app/parties/' + p.id + '/edit'}>Edit</Link>}
                </div>
              ),
            },
          ]}
        />
      )}
    </>
  );
}

/**
 * Real Party detail. Payments derive from the cached company ledger
 * (no Party→Project relation exists); project involvement is derived
 * from payment records. Delete is hidden (no DELETE endpoint).
 */
const DONUT_COLORS = ['#22c55e', '#f59e0b', '#64748b', '#3b82f6', '#a855f7', '#64748b'];

export function PartyWorkspaceDetail({ id }: { id: string }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const canMutate = useCanMutateParties();
  const canPay = !companyRole || canAccess(companyRole, 'payments');
  const [party, setParty] = useState<ApiParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const directory = usePaymentDirectory(canPay ? companyId : null);
  const [payRows, setPayRows] = useState<ApiPaymentWithProject[]>([]);
  const [payLoading, setPayLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setParty(await getParty(companyId, id));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Party not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this party.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setParty(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- party ledger slice load */
  useEffect(() => {
    if (!companyId || !canPay) return;
    let cancelled = false;
    setPayLoading(true);
    getCompanyPayments(companyId)
      .then((all) => {
        if (!cancelled) {
          setPayRows(
            all
              .filter((p) => p.partyId === id)
              .sort((a, b) =>
                a.paymentDate === b.paymentDate
                  ? b.createdAt.localeCompare(a.createdAt)
                  : b.paymentDate.localeCompare(a.paymentDate),
              ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPayRows([]);
      })
      .finally(() => {
        if (!cancelled) setPayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, canPay, id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading party…
      </p>
    );
  }
  if (error || !party) {
    return (
      <>
        <ListError message={error ?? 'Party not found.'} onRetry={fetchDetail} />
        <p className="section-space">
          <TextLink href="/app/parties">Back to Parties</TextLink>
        </p>
      </>
    );
  }

  const p = party;
  const totalPaid = payRows.reduce((s, x) => s + x.amount, 0);
  const projectTotals = [...payRows.reduce((map, x) => {
    const entry = map.get(x.projectId) ?? { total: 0, count: 0 };
    entry.total += x.amount;
    entry.count += 1;
    map.set(x.projectId, entry);
    return map;
  }, new Map<string, { total: number; count: number }>())];
  const latestDate = payRows.length ? payRows[0].paymentDate : null;
  const categoryTotals = [...payRows.reduce((map, x) => {
    const key = x.categoryId ?? 'other';
    map.set(key, (map.get(key) ?? 0) + x.amount);
    return map;
  }, new Map<string, number>())]
    .map(([categoryId, total], i) => ({
      name:
        categoryId === 'other'
          ? 'Other'
          : (directory.categoriesById.get(categoryId)?.name ?? 'Other'),
      total,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);
  const donutCircumference = 2 * Math.PI * 54;
  const donutSegments = categoryTotals.reduce<Array<(typeof categoryTotals)[number] & { offset: number }>>(
    (acc, c) => {
      const prev = acc.length ? acc[acc.length - 1] : null;
      const offset = prev ? prev.offset + (prev.total / totalPaid) * donutCircumference : 0;
      return [...acc, { ...c, offset }];
    },
    [],
  );
  const pct = (v: number) => (totalPaid > 0 ? Math.round((v / totalPaid) * 100) : 0);
  const recentRows = payRows.slice(0, 5);
  const contactBlocks = [
    { label: 'Party Type', value: p.type === 'CONTRACTOR' ? 'Contractor' : 'Supplier', Icon: Building2 },
    { label: 'Phone Contact', value: p.phone ?? '—', href: p.phone ? 'tel:' + p.phone : undefined, Icon: Phone },
    { label: 'Direct Email', value: p.email ?? '—', href: p.email ? 'mailto:' + p.email : undefined, Icon: Mail },
    { label: 'Base Address', value: p.address ?? '—', Icon: MapPin },
  ];
  return (
    <div className="party-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/app/parties">Parties</Link>
        <span aria-hidden="true">›</span>
        <strong>{p.name}</strong>
      </nav>
      <PageHeader title={p.name} description={p.notes ?? 'External project partner.'}>
        <Badge value={p.type} />
        {canMutate && (
          <ButtonLink secondary href={'/app/parties/' + id + '/edit'}>
            <Pencil size={15} />
            Edit Party
          </ButtonLink>
        )}
        {canPay && (
          <ButtonLink href="/app/payments/new">
            <Plus size={15} />
            Record Payment
          </ButtonLink>
        )}
      </PageHeader>
      <section className="contact-strip" aria-label="Party contact summary">
        {contactBlocks.map(({ label, value, href, Icon }) => (
          <div className="contact-block" key={label}>
            <span className="contact-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="contact-text">
              <small>{label}</small>
              <strong>
                {href ? <a href={href}>{value}</a> : value}
              </strong>
            </span>
          </div>
        ))}
      </section>
      <div className="party-grid">
        <div className="stack">
          <Panel title="Party Information" subtitle="Corporate identification">
            <div className="info-grid">
              <div>
                <small>Name</small>
                <strong>{p.name}</strong>
              </div>
              <div>
                <small>Type</small>
                <strong>{p.type === 'CONTRACTOR' ? 'Contractor' : 'Supplier'}</strong>
              </div>
              <div>
                <small>Phone</small>
                <strong>{p.phone ?? '—'}</strong>
              </div>
              <div>
                <small>Email</small>
                <strong>{p.email ?? '—'}</strong>
              </div>
              <div>
                <small>Address</small>
                <strong>{p.address ?? '—'}</strong>
              </div>
            </div>
            {p.notes && (
              <div className="inset-panel section-space">
                <small>Scope & Operational Notes</small>
                <p>{p.notes}</p>
              </div>
            )}
          </Panel>
          {canPay && (
            <Panel title="Recent Payments">
              {payLoading || directory.loading ? (
                <p className="small" role="status" aria-live="polite">
                  Loading payments…
                </p>
              ) : !recentRows.length ? (
                <p className="small">No payments recorded for this party.</p>
              ) : (
                <div className="table-scroll">
                  <table className="party-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Project</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Reference</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRows.map((x) => (
                        <tr key={x.id}>
                          <td data-label="Date">{displayDate(x.paymentDate)}</td>
                          <td data-label="Project">{x.projectName ?? directory.projectsById.get(x.projectId) ?? '—'}</td>
                          <td data-label="Category">
                            <Badge
                              value={
                                x.categoryId
                                  ? (directory.categoriesById.get(x.categoryId)?.name ?? 'Other')
                                  : 'Other'
                              }
                            />
                          </td>
                          <td data-label="Amount">
                            <strong>{formatAmount(x.amount)}</strong>
                          </td>
                          <td data-label="Reference" className="muted mono">{x.reference ?? '—'}</td>
                          <td data-label="Actions">
                            <TextLink href={'/app/payments/' + x.id + '?projectId=' + x.projectId}>
                              View
                            </TextLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
        <div className="stack">
          {canPay && (
            <Panel title="Financial Summary">
              {payLoading || directory.loading ? (
                <p className="small" role="status" aria-live="polite">
                  Loading payments…
                </p>
              ) : !payRows.length ? (
                <p className="small">No payments recorded for this party.</p>
              ) : (
                <>
                  <div className="total-block">
                    <small>Total Paid Out</small>
                    <strong>{formatAmount(totalPaid)}</strong>
                  </div>
                  <div className="mini-cards">
                    <div>
                      <small>Projects</small>
                      <strong>{projectTotals.length}</strong>
                    </div>
                    <div>
                      <small>Recent Payment</small>
                      <strong>{latestDate ? displayDate(latestDate) : '—'}</strong>
                    </div>
                  </div>
                  {!!categoryTotals.length && (
                    <div className="section-space">
                      <small>Payment Distribution</small>
                      <div className="dist-bar" aria-hidden="true">
                        {categoryTotals.map((c) => (
                          <span
                            key={c.name}
                            style={{ width: pct(c.total) + '%', background: c.color }}
                          />
                        ))}
                      </div>
                      <ul className="donut-legend">
                        {categoryTotals.map((c) => (
                          <li key={c.name}>
                            <span className="donut-dot" style={{ background: c.color }} aria-hidden="true" />
                            <span>{c.name}</span>
                            <strong>
                              {formatAmount(c.total)} ({pct(c.total)}%)
                            </strong>
                          </li>
                        ))}
                      </ul>
                      <div className="donut-wrap donut-centered section-space">
                        <div className="donut-chart">
                          <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Payment distribution totaling ${formatAmount(totalPaid)}`}>
                            <circle cx="70" cy="70" r={54} fill="none" strokeWidth="18" stroke="var(--line)" />
                            {donutSegments.map((c) => {
                              const length = (c.total / totalPaid) * donutCircumference;
                              return (
                                <circle
                                  key={c.name}
                                  cx="70"
                                  cy="70"
                                  r={54}
                                  fill="none"
                                  strokeWidth="18"
                                  stroke={c.color}
                                  strokeDasharray={`${length} ${donutCircumference - length}`}
                                  strokeDashoffset={-c.offset}
                                  transform="rotate(-90 70 70)"
                                  strokeLinecap="butt"
                                />
                              );
                            })}
                          </svg>
                          <div className="donut-center" aria-hidden="true">
                            <strong className="donut-total">{formatAmount(totalPaid)}</strong>
                            <small>PAID</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Panel>
          )}
          {canPay && (
            <Panel title="Project Involvement" subtitle="Derived from payment records">
              {payLoading || directory.loading ? (
                <p className="small" role="status" aria-live="polite">
                  Loading projects…
                </p>
              ) : !projectTotals.length ? (
                <p className="small">No project involvement derived yet.</p>
              ) : (
                projectTotals.map(([projectId, entry]) => (
                  <div key={projectId} className="inset-panel section-space">
                    <Link href={'/app/projects/' + projectId}>
                      <strong>{directory.projectsById.get(projectId) ?? 'Project'}</strong>
                    </Link>
                    <p className="small">
                      {p.type === 'CONTRACTOR' ? 'Contractor' : 'Supplier'} · {formatAmount(entry.total)} ·{' '}
                      {entry.count} payment{entry.count === 1 ? '' : 's'}
                    </p>
                  </div>
                ))
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
