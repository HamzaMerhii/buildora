'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Plus, Pencil, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { normalizePlatformRole } from '@/lib/auth/redirect';
import {
  getCompany,
  isAcceptedCompanyLogo,
  mapCompanyFormToUpdate,
  updateCompany,
} from '@/lib/api/company-settings.api';
import {
  changePassword,
  mapProfileFormToUpdate,
  updateMyProfile,
} from '@/lib/api/user-profile.api';
import {
  activeMembers,
  addCompanyMember,
  buildMembersByUserId,
  companyRoleLabel,
  getCompanyMembers,
  MEMBER_CREATE_ROLES,
  updateCompanyMembership,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { displayDate } from '@/lib/utils/format';
import { useWorkspace } from './WorkspaceProvider';
import {
  changePasswordSchema,
  companySettingsSchema,
  memberAddSchema,
  memberUpdateSchema,
  profileSettingsSchema,
} from '@/lib/validations/settings.schema';
import {
  PageHeader,
  ButtonLink,
  Badge,
  Panel,
  TextLink,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { ConfirmDialog, Dialog } from '../ui/Dialog';
import { Field, FormActions, NumberedSection } from '../forms/FormPrimitives';

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

const PLATFORM_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  USER: 'User',
};

function useCompanyId(): string | null {
  return useAuthStore((s) => s.companyId);
}

function useIsOwner(): boolean {
  const companyRole = useAuthStore((s) => s.companyRole);
  return !companyRole || companyRole === 'OWNER';
}

// ---------------------------------------------------------------------------
// Company settings: real GET/PATCH. OWNER-only backend-side, so this
// section renders only for owners (route + nav enforce the same).
// ---------------------------------------------------------------------------

export function CompanySettingsSection() {
  const companyId = useCompanyId();
  const { notify } = useWorkspace();
  const setCompanyName = useAuthStore((s) => s.setCompanyName);
  const [initialValues, setInitialValues] = useState<
    z.input<typeof companySettingsSchema> | undefined
  >(undefined);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [meta, setMeta] = useState<{
    id: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const logoInputId = useId();

  const fetchDetail = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setLoadError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const company = await getCompany(companyId);
      setInitialValues({
        name: company.name,
        email: company.email ?? '',
        phone: company.phone ?? '',
        address: company.address ?? '',
      });
      setLogo(company.logo);
      setMeta({
        id: company.id,
        isActive: company.isActive,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setLoadError('Company not found.');
      } else if (err instanceof ApiError && err.status === 403) {
        setLoadError('Only company owners can view company settings.');
      } else if (err instanceof ApiError && err.status === 401) {
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  /* eslint-disable react-hooks/set-state-in-effect -- company load on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Revoke the local logo preview when replaced or on unmount.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const discardLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLogoError(null);
    setLogoInputKey((k) => k + 1);
  }, []);

  const handleLogoSelect = useCallback((file: File | null) => {
    if (!file) return;
    if (!isAcceptedCompanyLogo(file)) {
      setLogoError('Unsupported image format. Use JPEG, PNG or WEBP.');
      return;
    }
    if (file.size === 0) {
      setLogoError('The selected logo file is empty.');
      return;
    }
    setLogoError(null);
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const form = useForm<
    z.input<typeof companySettingsSchema>,
    unknown,
    z.output<typeof companySettingsSchema>
  >({
    resolver: zodResolver(companySettingsSchema),
    values: initialValues,
    defaultValues: { name: '', email: '', phone: '', address: '' },
  });

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading company settings…
      </p>
    );
  }
  if (loadError || !initialValues) {
    return <ListError message={loadError ?? 'Company not found.'} onRetry={fetchDetail} />;
  }

  return (
    <div className="stack">
      <Panel
        title="Company Brand Mark"
        subtitle="Company identity used across Buildora documents and workspace surfaces."
      >
        <div className="brand-row">
          {logoPreview ? (
            <img src={logoPreview} alt={`${initialValues?.name ?? 'Company'} logo preview`} className="brand-mark" />
          ) : logo ? (
            <img src={logo} alt="Company logo" className="brand-mark" />
          ) : (
            <span className="brand-placeholder" aria-hidden="true">
              {(initialValues?.name ?? 'B').charAt(0).toUpperCase()}
            </span>
          )}
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 15 }}>{initialValues?.name}</strong>
            <small style={{ color: 'var(--muted)' }}>
              {logoPreview
                ? 'New logo selected — it uploads when you save.'
                : logo
                  ? 'Current company logo.'
                  : 'No company logo uploaded.'}
            </small>
            <span className="section-space" style={{ display: 'block' }}>
              <input
                key={logoInputKey}
                id={logoInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
                aria-label="Company logo file"
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              />
              <label
                className="button secondary"
                htmlFor={logoInputId}
                aria-disabled={form.formState.isSubmitting}
                style={
                  form.formState.isSubmitting
                    ? { pointerEvents: 'none', opacity: 0.45 }
                    : undefined
                }
              >
                Change Logo
              </label>
            </span>
            {logoError ? (
              <p className="field-error" role="alert">
                {logoError}
              </p>
            ) : (
              <small style={{ color: 'var(--muted)' }}>JPEG, PNG or WEBP.</small>
            )}
          </span>
        </div>
      </Panel>
      <FormProvider {...form}>
        <form
          noValidate
          className="company-form"
          onSubmit={form.handleSubmit(async (v) => {
            if (!companyId) {
              setBackendError('No company context. Please sign in again.');
              return;
            }
            setBackendError(null);
            try {
              const updated = await updateCompany(companyId, {
                ...mapCompanyFormToUpdate(v),
                ...(logoFile ? { logo: logoFile } : {}),
              });
              setCompanyName(updated.name);
              setLogo(updated.logo);
              setMeta({
                id: updated.id,
                isActive: updated.isActive,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
              });
              notify('Company settings saved.');
              form.clearErrors();
              discardLogo();
              fetchDetail();
            } catch (error) {
              if (error instanceof ApiError && error.fields) {
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field in v) form.setError(field as keyof typeof v, { message: messages[0] });
                }
                if ('logo' in error.fields) {
                  setLogoError(error.fields['logo'][0]);
                }
              }
              if (error instanceof ApiError && error.status === 409) {
                setBackendError(error.detail || 'This email or phone is already registered.');
              } else {
                setBackendError(friendlyMessage(error));
              }
            }
          })}
        >
          <Panel
            title="Company Information"
            subtitle="Official company profile and contact information."
          >
            <div className="form-grid">
              <Field name="name" label="Company Name *" placeholder="e.g. Buildora Contracting" />
              <Field name="email" label="Company Email" type="email" placeholder="info@company.com" />
              <Field name="phone" label="Company Phone" type="tel" placeholder="+961 1 555 220" />
              <Field name="address" label="Company Address" placeholder="Beirut, Lebanon" />
            </div>
            {backendError && (
              <p className="field-error" role="alert">
                {backendError}
              </p>
            )}
          </Panel>
          <Panel title="Company Status" subtitle="Read-only workspace record.">
            {meta ? (
              <div className="status-grid">
                <div>
                  <small>Status</small>
                  <p>
                    <Badge value={meta.isActive ? 'Active' : 'Inactive'} />
                  </p>
                </div>
                <div>
                  <small>Company ID</small>
                  <p className="mono muted">{meta.id.slice(0, 8)}</p>
                </div>
                <div>
                  <small>Created</small>
                  <p>{displayDate(meta.createdAt.slice(0, 10))}</p>
                </div>
                <div>
                  <small>Last Updated</small>
                  <p>{displayDate(meta.updatedAt.slice(0, 10))}</p>
                </div>
              </div>
            ) : (
              <p className="small">Status unavailable.</p>
            )}
          </Panel>
          <div className="company-actions">
            <small className="muted">
              {meta ? `Last updated ${displayDate(meta.updatedAt.slice(0, 10))}` : ''}
            </small>
            <span className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (initialValues) form.reset(initialValues);
                  form.clearErrors();
                  setBackendError(null);
                  discardLogo();
                }}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="button" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </span>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile + password: real PATCH /users/me and POST /auth/change-password.
// All authenticated company users.
// ---------------------------------------------------------------------------

export function ProfileSettingsSection() {
  const sessionUser = useAuthStore((s) => s.user);
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const companyName = useAuthStore((s) => s.companyName);
  const companyId = useCompanyId();
  const { notify } = useWorkspace();
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // The session context carries no phone number; resolve it from the
  // member list when the role permits (OWNER), otherwise leave blank.
  useEffect(() => {
    if (!companyId || !sessionUser) return;
    let cancelled = false;
    getCompanyMembers(companyId)
      .then((members) => {
        if (!cancelled) {
          setPhone(members.find((m) => m.userId === sessionUser.id)?.phone);
        }
      })
      .catch(() => {
        if (!cancelled) setPhone(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, sessionUser]);

  const profileForm = useForm<
    z.input<typeof profileSettingsSchema>,
    unknown,
    z.output<typeof profileSettingsSchema>
  >({
    resolver: zodResolver(profileSettingsSchema),
    values: sessionUser
      ? { name: sessionUser.name, email: sessionUser.email, phone: phone ?? '' }
      : undefined,
    defaultValues: { name: '', email: '', phone: '' },
  });

  const passwordForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (!sessionUser) {
    return <ListError message="No company context. Please sign in again." onRetry={() => fetchSession()} />;
  }

  return (
    <div className="stack">
      <Panel
        title="Profile Photo"
        subtitle="Your profile image used across Buildora workspace surfaces."
      >
        <div className="photo-row">
          <span className="avatar-placeholder" aria-hidden="true">
            {sessionUser.name.charAt(0).toUpperCase()}
          </span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 15 }}>{sessionUser.name}</strong>
          </span>
        </div>
      </Panel>
      <FormProvider {...profileForm}>
        <form
          noValidate
          onSubmit={profileForm.handleSubmit(async (v) => {
            setProfileError(null);
            try {
              const updated = await updateMyProfile(mapProfileFormToUpdate(v));
              setPhone(updated.phone);
              await fetchSession();
              notify('Personal information updated.');
            } catch (error) {
              if (error instanceof ApiError && error.fields) {
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field in v) {
                    profileForm.setError(field as keyof typeof v, { message: messages[0] });
                  }
                }
              }
              if (error instanceof ApiError && error.status === 409) {
                setProfileError(error.detail || 'This email or phone is already in use.');
              } else {
                setProfileError(friendlyMessage(error));
              }
            }
          })}
        >
          <Panel
            title="Personal Information"
            subtitle="Update your personal details and communication information."
          >
            <div className="form-grid">
              <Field name="name" label="Full Name *" />
              <Field name="email" label="Email Address *" type="email" />
            </div>
            <Field name="phone" label="Phone Number *" type="tel" />
            {profileError && (
              <p className="field-error" role="alert">
                {profileError}
              </p>
            )}
            <div className="section-space">
              <FormActions
                onCancel={() => profileForm.reset()}
                label="Save Changes"
                pending={profileForm.formState.isSubmitting}
              />
            </div>
          </Panel>
        </form>
      </FormProvider>
      <FormProvider {...passwordForm}>
        <form
          noValidate
          onSubmit={passwordForm.handleSubmit(async (v) => {
            setPasswordError(null);
            try {
              const result = await changePassword({
                currentPassword: v.currentPassword,
                newPassword: v.newPassword,
              });
              notify(result.message || 'Password changed successfully.');
              passwordForm.reset();
            } catch (error) {
              setPasswordError(friendlyMessage(error));
            }
          })}
        >
          <Panel title="Password & Security" subtitle="Keep your account password secure.">
            <div className="pwd-grid">
              <PasswordInput name="currentPassword" label="Current Password *" autoComplete="current-password" />
              <PasswordInput name="newPassword" label="New Password *" autoComplete="new-password" />
              <PasswordInput name="confirmPassword" label="Confirm Password *" autoComplete="new-password" />
            </div>
            {passwordError && (
              <p className="field-error" role="alert">
                {passwordError}
              </p>
            )}
            <div className="section-space">
              <FormActions
                onCancel={() => passwordForm.reset()}
                label="Update Password"
                pending={passwordForm.formState.isSubmitting}
              />
            </div>
          </Panel>
        </form>
      </FormProvider>
      <Panel
        title="Workspace & Account Information"
        subtitle="Your current Buildora account and workspace assignment."
      >
        <div className="status-grid">
          <div>
            <small>Platform Role</small>
            <p>
              {platformRole
                ? (PLATFORM_ROLE_LABEL[normalizePlatformRole(platformRole) ?? ''] ?? platformRole)
                : '—'}
            </p>
          </div>
          <div>
            <small>Current Company</small>
            <p>{companyName ?? '—'}</p>
          </div>
          <div>
            <small>Company Role</small>
            <p>{companyRole ? companyRoleLabel[companyRole] : '—'}</p>
          </div>
          <div>
            <small>Account ID</small>
            <p className="mono muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {sessionUser.id.slice(0, 8)}
              <CopyButton text={sessionUser.id} label="Copy account ID" />
            </p>
          </div>
        </div>
        <p className="notice-strip">
          Company role and workspace access are managed by company owners.
        </p>
      </Panel>
    </div>
  );
}

function PasswordInput({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete?: string;
}) {
  const { register, formState: { errors } } = useFormContext();
  const id = useId();
  const [show, setShow] = useState(false);
  const rawError = (errors as Record<string, { message?: unknown }>)[name]?.message;
  const error = typeof rawError === 'string' ? rawError : rawError === undefined ? undefined : String(rawError);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pwd-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          {...register(name)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button secondary"
      style={{ minHeight: 30, padding: '4px 10px', fontSize: 11 }}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Team: real member list + add + role/active PATCH. OWNER-only.
// GET returns active memberships only, so deactivated members leave
// the list (reactivation from this UI is impossible by design).
// ---------------------------------------------------------------------------

const memberEditSchema = memberUpdateSchema.extend({ isActive: z.boolean() });

export function TeamSettingsSection() {
  const companyId = useCompanyId();
  const sessionUser = useAuthStore((s) => s.user);
  const isOwner = useIsOwner();
  const { notify } = useWorkspace();
  const [rows, setRows] = useState<ApiCompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ApiCompanyMember | null>(null);
  const [deactivating, setDeactivating] = useState<ApiCompanyMember | null>(null);
  const [acting, setActing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await getCompanyMembers(companyId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only company owners can view team members.');
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

  /* eslint-disable react-hooks/set-state-in-effect -- member list load on mount */
  useEffect(() => {
    if (isOwner) fetchAll();
    else {
      setLoading(false);
      setError('Only company owners can view team members.');
    }
  }, [fetchAll, isOwner]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const membersByUserId = buildMembersByUserId(activeMembers(rows));

  const handleDeactivate = async () => {
    if (!companyId || !deactivating) return;
    setActing(true);
    try {
      await updateCompanyMembership(companyId, deactivating.membershipId, { isActive: false });
      notify('Team member deactivated. They no longer appear in the active list.');
      setDeactivating(null);
      fetchAll();
    } catch (err) {
      notify(friendlyMessage(err));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Team & Permissions"
        description="Manage internal personnel and company role access."
      >
        <button className="button" type="button" onClick={() => setAdding(true)}>
          <Plus size={15} />
          Add Member
        </button>
      </PageHeader>
      {loading ? (
        <p className="small" role="status" aria-live="polite">
          Loading team members…
        </p>
      ) : error ? (
        <ListError message={error} onRetry={fetchAll} />
      ) : (
        <DataTable
          rows={rows
            .filter((m) => !roleFilter || m.role === roleFilter)
            .map((m) => ({ ...m, id: m.membershipId }))}
          searchText={(m) => m.name + ' ' + (m.email ?? '')}
          placeholder="Search members by name or email…"
          filters={
            <select
              aria-label="Team role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {(['OWNER', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SALES', 'FINANCE'] as const).map(
                (r) => (
                  <option key={r} value={r}>
                    {companyRoleLabel[r]}
                  </option>
                ),
              )}
            </select>
          }
          columns={[
            {
              label: 'Member',
              value: (m) => (
                <strong>
                  {sessionUser && m.userId === sessionUser.id
                    ? `${membersByUserId.get(m.userId)?.name ?? m.name} (You)`
                    : (membersByUserId.get(m.userId)?.name ?? m.name)}
                </strong>
              ),
              sort: (m) => m.name,
            },
            { label: 'Email Address', value: (m) => m.email ?? '—' },
            { label: 'Role Access', value: (m) => <Badge value={m.role} /> },
            { label: 'Status', value: (m) => <Badge value={m.isActive ? 'Active' : 'Inactive'} /> },
            {
              label: 'Actions',
              value: (m) => (
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={'Edit ' + m.name}
                    onClick={() => setEditing(m)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeactivating(m)} disabled={acting}>
                    Deactivate
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
      <p className="form-note section-space">
        Deactivated members leave the active list immediately; the member list only shows active
        memberships, so reactivation is not available here.
      </p>
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add Member" drawer>
        {adding && (
          <AddMemberForm
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              fetchAll();
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Edit Team Member" drawer>
        {editing && (
          <EditMemberForm
            key={editing.membershipId}
            member={editing}
            isSelf={!!sessionUser && editing.userId === sessionUser.id}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              fetchAll();
            }}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={handleDeactivate}
        title="Deactivate team member?"
        description="This member will lose access to the company and disappear from the active list. This is not permanent deletion of their user account."
      />
    </>
  );
}

function AddMemberForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const companyId = useCompanyId();
  const { notify } = useWorkspace();
  const [backendError, setBackendError] = useState<string | null>(null);
  const form = useForm<z.input<typeof memberAddSchema>, unknown, z.output<typeof memberAddSchema>>({
    resolver: zodResolver(memberAddSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'SITE_ENGINEER',
    },
  });

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          if (!companyId) {
            setBackendError('No company context. Please sign in again.');
            return;
          }
          setBackendError(null);
          try {
            await addCompanyMember(companyId, {
              name: v.name,
              email: v.email,
              phone: v.phone,
              password: v.password,
              role: v.role,
            });
            notify('Member added successfully.');
            onSaved();
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              setBackendError(error.detail || 'This email or phone is already registered.');
            } else {
              setBackendError(friendlyMessage(error));
            }
          }
        })}
      >
        <NumberedSection number={1} title="Member Information" micro="GENERAL">
          <Field name="name" label="Full Name *" placeholder="e.g. Maya Haddad" />
          <div className="form-grid">
            <Field name="email" label="Email *" type="email" placeholder="maya@example.com" />
            <Field name="phone" label="Phone *" type="tel" placeholder="+961 70 123 456" />
          </div>
        </NumberedSection>
        <NumberedSection number={2} title="Account Security" micro="SECURITY">
          <div className="form-grid">
            <Field name="password" label="Password *" type="password" autoComplete="new-password" />
            <Field
              name="confirmPassword"
              label="Confirm Password *"
              type="password"
              autoComplete="new-password"
            />
          </div>
        </NumberedSection>
        <NumberedSection number={3} title="Company Role" micro="ROLE">
          <Field name="role" label="Company Role *">
            {MEMBER_CREATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {companyRoleLabel[r]}
              </option>
            ))}
          </Field>
        </NumberedSection>
        {backendError && (
          <p className="field-error" role="alert">
            {backendError}
          </p>
        )}
        <FormActions onCancel={onClose} label="Add Member" pending={form.formState.isSubmitting} />
      </form>
    </FormProvider>
  );
}

function EditMemberForm({
  member,
  isSelf,
  onClose,
  onSaved,
}: {
  member: ApiCompanyMember;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const companyId = useCompanyId();
  const { notify } = useWorkspace();
  const [backendError, setBackendError] = useState<string | null>(null);
  const form = useForm<z.input<typeof memberEditSchema>, unknown, z.output<typeof memberEditSchema>>({
    resolver: zodResolver(memberEditSchema),
    defaultValues: { role: member.role === 'OTHER' ? 'SITE_ENGINEER' : member.role, isActive: member.isActive },
  });

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          if (!companyId) {
            setBackendError('No company context. Please sign in again.');
            return;
          }
          setBackendError(null);
          try {
            await updateCompanyMembership(companyId, member.membershipId, {
              role: v.role,
              isActive: v.isActive,
            });
            notify('Team member updated.');
            onSaved();
          } catch (error) {
            setBackendError(friendlyMessage(error));
          }
        })}
      >
        <p className="form-note">
          {member.name} · Only the company role and active state can be changed here. The backend
          blocks removing your own owner role or deactivating yourself.
        </p>
        <Field name="role" label="Company Role *" disabled={isSelf}>
          {(['OWNER', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SALES', 'FINANCE'] as const).map((r) => (
            <option key={r} value={r}>
              {companyRoleLabel[r]}
            </option>
          ))}
        </Field>
        <div className="section-space">
          <label className="check-field">
            <input type="checkbox" {...form.register('isActive')} disabled={isSelf} /> Active team member
          </label>
        </div>
        {isSelf && (
          <p className="small">You cannot change your own role or deactivate yourself.</p>
        )}
        {backendError && (
          <p className="field-error" role="alert">
            {backendError}
          </p>
        )}
        <FormActions onCancel={onClose} label="Save Changes" pending={form.formState.isSubmitting} />
      </form>
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------
// Tab shell (same tabs as before, permission-filtered).
// ---------------------------------------------------------------------------

export function SettingsWorkspace({ tab = 'company' }: { tab?: 'company' | 'team' | 'profile' }) {
  const isOwner = useIsOwner();
  const tabs = [
    ['company', 'Company', '/app/settings', true],
    ['team', 'Team & Permissions', '/app/settings/team', isOwner],
    ['profile', 'Profile & Account', '/app/settings/profile', true],
  ] as Array<[string, string, string, boolean]>;
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage company information, team access, and your personal account."
      />
      <nav className="tabs" aria-label="Settings">
        {tabs
          .filter(([, , , visible]) => visible)
          .map(([key, title, href]) => (
            <Link key={key} className={tab === key ? 'active' : ''} href={href}>
              {title}
            </Link>
          ))}
      </nav>
      {tab === 'company' ? (
        isOwner ? (
          <CompanySettingsSection />
        ) : (
          <Panel title="Company Settings">
            <p className="small">Only company owners can view company settings.</p>
            <p className="section-space">
              <TextLink href="/app/settings/profile">Go to your profile</TextLink>
            </p>
          </Panel>
        )
      ) : tab === 'team' ? (
        <TeamSettingsSection />
      ) : (
        <ProfileSettingsSection />
      )}
      <p className="section-space">
        <ButtonLink secondary href="/app/dashboard">
          Back to Dashboard
        </ButtonLink>
      </p>
    </>
  );
}
