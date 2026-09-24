'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  PLATFORM_ROLE_LABEL,
  getPlatformCompanies,
  getPlatformCompany,
  getPlatformUsers,
  updatePlatformCompanyStatus,
  updatePlatformUserStatus,
  type ApiPlatformCompany,
  type ApiPlatformUser,
} from '@/lib/api/platform.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from './WorkspaceProvider';
import { displayDate } from '@/lib/utils/format';
import {
  PageHeader,
  StatCard,
  Badge,
  Panel,
  TextLink,
  EmptyState,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog } from '../ui/Dialog';

function PlatformError({ message, onRetry }: { message: string; onRetry: () => void }) {
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

function statusBadge(isActive: boolean) {
  return <Badge value={isActive ? 'Active' : 'Inactive'} />;
}

function usePlatformDirectory(): {
  companies: ApiPlatformCompany[];
  users: ApiPlatformUser[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [companies, setCompanies] = useState<ApiPlatformCompany[]>([]);
  const [users, setUsers] = useState<ApiPlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [companyList, userList] = await Promise.all([
        getPlatformCompanies(),
        getPlatformUsers(),
      ]);
      setCompanies(companyList);
      setUsers(userList);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have platform administration access.');
      } else {
        setError(friendlyMessage(err));
      }
      setCompanies([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- directory load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { companies, users, loading, error, refetch: fetchAll };
}

function CompaniesTable({ rows }: { rows: ApiPlatformCompany[] }) {
  const [status, setStatus] = useState('');
  return (
    <DataTable
      rows={rows.filter((c) => !status || String(c.isActive) === status)}
      searchText={(c) => `${c.name} ${c.email ?? ''} ${c.phone ?? ''}`}
      placeholder="Search companies by name, email, or phone…"
      emptyTitle="No companies found"
      filters={
        <select aria-label="Company status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      }
      columns={[
        { label: 'Company Workspace', value: (c) => <strong>{c.name}</strong>, sort: (c) => c.name },
        { label: 'Contact Email', value: (c) => c.email ?? '—' },
        { label: 'Phone', value: (c) => c.phone ?? '—' },
        { label: 'Status', value: (c) => statusBadge(c.isActive) },
        { label: 'Created', value: (c) => displayDate(c.createdAt), sort: (c) => c.createdAt },
        {
          label: 'Actions',
          value: (c) => <TextLink href={'/platform/companies/' + c.id}>View</TextLink>,
        },
      ]}
    />
  );
}

export function PlatformDashboard() {
  const { companies, users, loading, error, refetch } = usePlatformDirectory();
  const recentCompanies = companies.slice(0, 5);
  const recentUsers = [...users]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        eyebrow="Platform Administration"
        description="Monitor companies, users, and the overall platform workspace registry."
      />
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading platform overview…
        </p>
      ) : error ? (
        <PlatformError message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="stats">
            <StatCard label="Total Companies" value={companies.length} />
            <StatCard label="Active Companies" value={companies.filter((c) => c.isActive).length} />
            <StatCard label="Platform Users" value={users.length} />
            <StatCard label="Active Users" value={users.filter((u) => u.isActive).length} />
            <StatCard
              label="Super Admins"
              value={users.filter((u) => u.platformRole === 'SUPER_ADMIN').length}
            />
          </div>
          <div className="stack">
            <Panel title="Recently Added Companies" action={<TextLink href="/platform/companies">View Companies</TextLink>}>
              <CompaniesTable rows={recentCompanies} />
            </Panel>
            <Panel title="Recent Platform Users" action={<TextLink href="/platform/users">View Users</TextLink>}>
              <UsersTable rows={recentUsers} compact />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export function PlatformCompanies() {
  const [rows, setRows] = useState<ApiPlatformCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPlatformCompanies());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have platform administration access.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- list load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <PageHeader title="Companies" description="Centralized supervision of company workspaces and platform access." />
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading companies…
        </p>
      ) : error ? (
        <PlatformError message={error} onRetry={fetchAll} />
      ) : (
        <CompaniesTable rows={rows} />
      )}
    </>
  );
}

export function PlatformCompanyDetail({ id }: { id: string }) {
  const { notify } = useWorkspace();
  const [company, setCompany] = useState<ApiPlatformCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCompany(await getPlatformCompany(id));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setError('Company not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have platform administration access.');
      } else {
        setError(friendlyMessage(err));
      }
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* eslint-disable react-hooks/set-state-in-effect -- detail load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleToggle = async () => {
    if (!company) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await updatePlatformCompanyStatus(company.id, !company.isActive);
      setCompany(updated);
      notify(updated.isActive ? 'Company activated.' : 'Company deactivated.');
      setConfirming(false);
    } catch (err) {
      setActionError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading company…
      </p>
    );
  }
  if (error || !company) {
    if (error === 'Company not found.') {
      return <EmptyState title="Company not found" href="/platform/companies" action="Back to Companies" />;
    }
    return <PlatformError message={error ?? 'Company not found.'} onRetry={fetchDetail} />;
  }

  return (
    <>
      <PageHeader title={company.name} description={company.email ?? 'Company workspace'} back="/platform/companies">
        {statusBadge(company.isActive)}
        <button
          className={'button ' + (company.isActive ? 'destructive' : '')}
          onClick={() => setConfirming(true)}
        >
          {company.isActive ? 'Deactivate' : 'Activate'} Company
        </button>
      </PageHeader>
      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}
      <div className="two-column">
        <div className="stack">
          <Panel title="Company Information">
            <DetailList
              items={[
                ['Company', company.name],
                ['Contact Email', company.email ?? 'Not supplied'],
                ['Phone', company.phone ?? 'Not supplied'],
                ['Address', company.address ?? 'Not supplied'],
                [
                  'Logo',
                  company.logo ? (
                    <img key="logo" src={company.logo} alt={`${company.name} logo`} style={{ maxWidth: 160 }} />
                  ) : (
                    'Not supplied'
                  ),
                ],
              ]}
            />
          </Panel>
        </div>
        <Panel title="Platform Status">
          <DetailList
            items={[
              ['Platform Status', statusBadge(company.isActive)],
              ['Tenant Identifier', id],
              ['Created', displayDate(company.createdAt)],
              ['Updated', displayDate(company.updatedAt)],
            ]}
          />
        </Panel>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={company.isActive ? 'Deactivate Company?' : 'Activate Company?'}
        description={'Update the platform status of ' + company.name + '?'}
        onConfirm={handleToggle}
      />
      {saving && (
        <p className="small" role="status" aria-live="polite">
          Updating company status…
        </p>
      )}
    </>
  );
}

function UsersTable({ rows, compact = false }: { rows: ApiPlatformUser[]; compact?: boolean }) {
  const sessionUser = useAuthStore((s) => s.user);
  const { notify } = useWorkspace();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toggled, setToggled] = useState<ApiPlatformUser[]>(rows);

  /* eslint-disable react-hooks/set-state-in-effect -- sync table state with loaded rows */
  useEffect(() => {
    setToggled(rows);
  }, [rows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleToggle = async (target: ApiPlatformUser) => {
    setPendingId(target.id);
    setActionError(null);
    try {
      const updated = await updatePlatformUserStatus(target.id, !target.isActive);
      setToggled((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      notify(updated.isActive ? 'User activated.' : 'User deactivated.');
    } catch (err) {
      setActionError(friendlyMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}
      <DataTable
        rows={toggled.filter(
          (u) =>
            (!role || u.platformRole === role) && (!status || String(u.isActive) === status),
        )}
        searchText={(u) => `${u.name} ${u.email} ${u.phone ?? ''}`}
        placeholder="Search users by name, email, or phone…"
        emptyTitle="No users found"
        filters={
          <>
            <select aria-label="Platform role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All Roles</option>
              <option value="USER">User</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <select aria-label="User status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        }
        columns={[
          { label: 'User', value: (u) => <strong>{u.name}</strong>, sort: (u) => u.name },
          { label: 'Email Address', value: (u) => u.email },
          ...(!compact
            ? [{ label: 'Phone', value: (u: ApiPlatformUser) => u.phone ?? '—' }]
            : []),
          { label: 'Platform Role', value: (u) => PLATFORM_ROLE_LABEL[u.platformRole] },
          { label: 'Status', value: (u) => statusBadge(u.isActive) },
          ...(!compact
            ? [
                {
                  label: 'Created',
                  value: (u: ApiPlatformUser) => displayDate(u.createdAt),
                  sort: (u: ApiPlatformUser) => u.createdAt,
                },
              ]
            : []),
          ...(!compact
            ? [
                {
                  label: 'Actions',
                  value: (u: ApiPlatformUser) => {
                    const isSelf = sessionUser !== null && u.id === sessionUser.id;
                    return (
                      <div className="row-actions">
                        <button
                          type="button"
                          disabled={isSelf || pendingId === u.id}
                          title={isSelf ? 'You cannot deactivate your own account' : undefined}
                          onClick={() => handleToggle(u)}
                        >
                          {pendingId === u.id ? 'Saving…' : u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    );
                  },
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

export function PlatformUsers({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<ApiPlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPlatformUsers());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('You do not have platform administration access.');
      } else {
        setError(friendlyMessage(err));
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- list load on mount */
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (compact) return <UsersTable rows={rows} compact />;

  return (
    <>
      <PageHeader title="Users" description="Manage platform active status across company workspaces." />
      <p className="small">
        Platform roles control administration access and are read-only. Company roles independently
        describe each user&rsquo;s responsibilities within their workspace.
      </p>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading users…
        </p>
      ) : error ? (
        <PlatformError message={error} onRetry={fetchAll} />
      ) : (
        <UsersTable rows={rows} />
      )}
    </>
  );
}
