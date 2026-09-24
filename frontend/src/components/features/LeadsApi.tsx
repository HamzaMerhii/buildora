'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import { getCompanyApartments } from '@/lib/api/apartment.api';
import {
  LEAD_STATUS_LABEL,
  getCompanyLeads,
  getLead,
  type ApiLead,
  type LeadChain,
} from '@/lib/api/lead.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { LeadMessageForm, LeadStatusForm } from '../forms/BusinessForms';
import { displayDate, exportCsv } from '@/lib/utils/format';
import {
  PageHeader,
  ButtonLink,
  StatCard,
  Badge,
  Panel,
  TextLink,
  EmptyState,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { Dialog } from '../ui/Dialog';

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

export function unitLabel(apartmentId: string, numbersById: Map<string, string>): string {
  const number = numbersById.get(apartmentId);
  return number ? `Apartment ${number}` : `Unit ${shortId(apartmentId)}`;
}

/**
 * Best-effort apartment unit-number lookup for lead rows. Resolves via
 * the company apartment index when the role may read it (OWNER); roles
 * without apartment access (SALES) fall back to short-id labels.
 */
export function useApartmentNumbers(companyId: string | null): Map<string, string> {
  const [numbers, setNumbers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    getCompanyApartments(companyId)
      .then((list) => {
        if (!cancelled) setNumbers(new Map(list.map((a) => [a.id, a.number])));
      })
      .catch(() => {
        if (!cancelled) setNumbers(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return numbers;
}

function exportRows(rows: ApiLead[], numbersById: Map<string, string>) {
  exportCsv(
    'leads',
    rows.map((l) => ({
      name: l.name,
      phone: l.phone ?? '',
      email: l.email ?? '',
      status: l.status,
      message: l.message ?? '',
      apartment: numbersById.get(l.apartmentId) ?? l.apartmentId,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  );
}

/**
 * Real lead list. KPIs, search, status filter and CSV export all derive
 * from the loaded company collection (no backend search/filter/pagination
 * exists). No delete, no notes, no source column — none exist backend-side.
 */
export function LeadsWorkspaceList() {
  const companyId = useAuthStore((s) => s.companyId);
  const [rows, setRows] = useState<ApiLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const numbersById = useApartmentNumbers(companyId);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getCompanyLeads(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to leads for this company.');
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
      <PageHeader title="Leads" description="Manage inbound apartment enquiries and track client follow-up.">
        <button className="button secondary" onClick={() => exportRows(rows, numbersById)}>
          <Download size={15} />
          Export Leads
        </button>
        <ButtonLink href="/apartments" secondary>
          View Public Catalog
        </ButtonLink>
      </PageHeader>
      <div className="stats">
        <StatCard label="Total Enquiries" value={rows.length} />
        <StatCard label="New" value={rows.filter((l) => l.status === 'NEW').length} />
        <StatCard label="Contacted" value={rows.filter((l) => l.status === 'CONTACTED').length} />
        <StatCard label="Closed" value={rows.filter((l) => l.status === 'CLOSED').length} />
      </div>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading leads…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : (
        <DataTable
          rows={rows.filter((l) => !status || l.status === status)}
          searchText={(l) => `${l.name} ${l.phone ?? ''} ${l.email ?? ''} ${l.message ?? ''}`}
          placeholder="Search leads by name, phone or email…"
          emptyTitle="No leads found"
          filters={
            <select aria-label="Lead status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CLOSED">Closed</option>
            </select>
          }
          columns={[
            { label: 'Lead Name', value: (l) => <strong>{l.name}</strong>, sort: (l) => l.name },
            { label: 'Target Unit', value: (l) => unitLabel(l.apartmentId, numbersById) },
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
              label: 'Enquiry Date',
              value: (l) => displayDate(l.createdAt),
              sort: (l) => l.createdAt,
            },
            {
              label: 'Actions',
              value: (l) => (
                <div className="row-actions">
                  <Link href={'/app/leads/' + l.id}>View</Link>
                  <Link href={'/app/leads/' + l.id + '/status'}>Update</Link>
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
 * Real lead detail. Chain comes from the list lookup inside getLead
 * (single company list request, no project fan-out, no per-lead N+1).
 * Status and message edit through PATCH; no notes, no delete.
 */
export function LeadWorkspaceDetail({ id, statusInitially = false }: { id: string; statusInitially?: boolean }) {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [chain, setChain] = useState<LeadChain | null>(null);
  const [lead, setLead] = useState<ApiLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(statusInitially);
  const [messageOpen, setMessageOpen] = useState(false);
  const numbersById = useApartmentNumbers(companyId);
  const canOpenApartments = !companyRole || canAccess(companyRole, 'apartments');

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await getLead(companyId, id);
      setLead(resolved.lead);
      setChain(resolved.chain);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Lead not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have access to this lead.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else {
        setError(friendlyMessage(err));
      }
      setLead(null);
      setChain(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading lead…
      </p>
    );
  }
  if (error || !lead || !chain || !companyId) {
    return <ListError message={error ?? 'Lead not found.'} onRetry={fetchDetail} />;
  }

  const unit = unitLabel(lead.apartmentId, numbersById);

  return (
    <>
      <PageHeader title={lead.name} description={`Lead Message for ${unit}`} back="/app/leads">
        <Badge value={lead.status} />
        <button className="button" onClick={() => setStatusOpen(true)}>
          <Pencil size={15} />
          Update Status
        </button>
      </PageHeader>
      <div className="two-column">
        <div className="stack">
          <Panel title="Customer Contact Details">
            <DetailList
              items={[
                ['Full Name', lead.name],
                [
                  'Primary Phone',
                  lead.phone ? (
                    <a key="phone" href={'tel:' + lead.phone}>
                      {lead.phone}
                    </a>
                  ) : (
                    'Not supplied'
                  ),
                ],
                [
                  'Direct Email',
                  lead.email ? (
                    <a key="email" href={'mailto:' + lead.email}>
                      {lead.email}
                    </a>
                  ) : (
                    'Not supplied'
                  ),
                ],
                ['Created Date', displayDate(lead.createdAt)],
              ]}
            />
          </Panel>
          <Panel
            title="Lead Message"
            action={
              <button className="button secondary" onClick={() => setMessageOpen(true)}>
                <Pencil size={14} />
                Edit Message
              </button>
            }
          >
            <blockquote style={{ fontSize: 16, lineHeight: 1.9, margin: '5px 0' }}>
              &ldquo;{lead.message || 'No message provided.'}&rdquo;
            </blockquote>
            <p className="small section-space">Last updated {displayDate(lead.updatedAt)}</p>
          </Panel>
          <Panel title="Related Apartment">
            <DetailList
              items={[
                ['Unit', unit],
                ['Apartment ID', lead.apartmentId],
              ]}
            />
            {canOpenApartments && (
              <div className="section-space">
                <TextLink href={'/app/apartments/' + lead.apartmentId}>View Apartment Details</TextLink>
              </div>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Workflow & Status">
            <Badge value={lead.status} />
            <p className="section-space small">
              {LEAD_STATUS_LABEL[lead.status]} — contact the client to verify unit interest and review
              payment schedule milestones.
            </p>
            <button className="button secondary section-space" onClick={() => setStatusOpen(true)}>
              Update Status
            </button>
          </Panel>
          <Panel title="Direct Communication">
            {lead.phone && (
              <a className="button secondary" href={'tel:' + lead.phone}>
                Call Client
              </a>
            )}
            {lead.email && (
              <a className="button secondary section-space" href={'mailto:' + lead.email}>
                Email Client
              </a>
            )}
            {!lead.phone && !lead.email && <p className="small">No contact channel supplied.</p>}
          </Panel>
          <Panel title="Record Metadata">
            <DetailList
              items={[
                ['Lead Identifier', id],
                ['Created', displayDate(lead.createdAt)],
                ['Updated', displayDate(lead.updatedAt)],
              ]}
            />
          </Panel>
        </div>
      </div>
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} title="Update Lead Status" drawer>
        <LeadStatusForm
          companyId={companyId}
          chain={chain}
          lead={lead}
          onClose={() => setStatusOpen(false)}
          onSaved={fetchDetail}
        />
      </Dialog>
      <Dialog open={messageOpen} onClose={() => setMessageOpen(false)} title="Edit Lead Message">
        <LeadMessageForm
          companyId={companyId}
          chain={chain}
          lead={lead}
          onClose={() => setMessageOpen(false)}
          onSaved={fetchDetail}
        />
      </Dialog>
    </>
  );
}

export function LeadNotFound() {
  return <EmptyState title="Lead not found" href="/app/leads" action="Back to Leads" />;
}
