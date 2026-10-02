'use client';
import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { assistantSchema } from '@/lib/validations/assistant.schema';
import { Field } from '../forms/FormPrimitives';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess, type ModuleKey } from '@/lib/auth/permissions';
import {
  PageHeader,
  Panel,
  StatCard,
  Badge,
  TextLink,
  EmptyState,
  DetailList,
} from '../ui/Primitives';
import { DataTable } from '../ui/DataTable';
import { displayDate, label } from '@/lib/utils/format';
import { formatAmount } from '@/lib/api/payment.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import {
  searchAI,
  aiId,
  aiNumber,
  aiText,
  type AiResultRecord,
  type ApiAiSearchResponse,
} from '@/lib/api/ai.api';

const OWNER_SUGGESTIONS = [
  'Show active projects',
  'Show overdue tasks',
  'Show available apartments',
  'Give me a project report',
  'Give me a payment summary',
];

const PROJECT_MANAGER_SUGGESTIONS = [
  'Show active projects',
  'Show overdue tasks',
  'Show available apartments',
  'Give me a project report',
  'Show project progress',
];

const SITE_ENGINEER_SUGGESTIONS = [
  'Show overdue tasks',
  'Give me a task summary',
  'Show project progress',
  'Show active projects',
];

const FINANCE_SUGGESTIONS = [
  'Show payments',
  'Give me a payment summary',
  'Give me a financial summary',
];

const GENERIC_SUGGESTIONS = ['Show active projects', 'Show overdue tasks'];

function suggestionsForRole(role: string | null): string[] | null {
  switch (role) {
    case 'OWNER':
      return OWNER_SUGGESTIONS;
    case 'PROJECT_MANAGER':
      return PROJECT_MANAGER_SUGGESTIONS;
    case 'SITE_ENGINEER':
      return SITE_ENGINEER_SUGGESTIONS;
    case 'FINANCE':
      return FINANCE_SUGGESTIONS;
    case 'SALES':
      return null;
    default:
      return GENERIC_SUGGESTIONS;
  }
}

function canViewModule(companyRole: Parameters<typeof canAccess>[0], module: ModuleKey): boolean {
  return !companyRole || canAccess(companyRole, module);
}

/** Format a summary value: money for financial keys, dates for date keys. */
function formatSummaryValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (/budget|amount|spent|total|price/i.test(key)) return formatAmount(value);
    return String(value);
  }
  if (typeof value === 'string' && /date/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return displayDate(value);
  }
  return String(value);
}

function SummaryGrid({ record, skip = [] }: { record: AiResultRecord; skip?: string[] }) {
  const entries = Object.entries(record).filter(
    ([key, value]) => !skip.includes(key) && value !== null && value !== undefined && value !== '',
  );
  if (!entries.length) return <p className="small">No additional details.</p>;
  return (
    <DetailList
      items={entries.map(
        ([key, value]): [string, string] => [label(key), formatSummaryValue(key, value)],
      )}
    />
  );
}

function TasksResults({ response, canView }: { response: ApiAiSearchResponse; canView: boolean }) {
  const rows = response.results
    .map((r) => ({
      id: aiId(r.id) ?? '',
      title: aiText(r.title) ?? 'Untitled task',
      status: aiText(r.status) ?? '—',
      due: aiText(r.due_date),
      progress: aiNumber(r.progress_percent),
    }))
    .filter((r) => r.id);
  if (!rows.length) return <EmptyState title="No matching records found" />;
  return (
    <DataTable
      rows={rows}
      searchText={(t) => t.title}
      placeholder="Search tasks…"
      columns={[
        { label: 'Task', value: (t) => <strong>{t.title}</strong>, sort: (t) => t.title },
        { label: 'Status', value: (t) => <Badge value={t.status} /> },
        {
          label: 'Due Date',
          value: (t) => (t.due ? displayDate(t.due) : '—'),
          sort: (t) => t.due ?? '',
        },
        {
          label: 'Progress',
          value: (t) => (t.progress !== undefined ? `${t.progress}%` : '—'),
          sort: (t) => t.progress ?? -1,
        },
        {
          label: 'Actions',
          value: (t) =>
            canView ? <TextLink prefetch={false} href={'/app/tasks/' + t.id}>View Task</TextLink> : <>—</>,
        },
      ]}
    />
  );
}

function ProjectsResults({ response, canView }: { response: ApiAiSearchResponse; canView: boolean }) {
  const rows = response.results
    .map((r) => ({
      id: aiId(r.id) ?? '',
      name: aiText(r.name) ?? 'Untitled project',
      status: aiText(r.status) ?? '—',
      location: aiText(r.location),
      budget: aiNumber(r.budget),
      progress: aiNumber(r.progress_percent),
    }))
    .filter((r) => r.id);
  if (!rows.length) return <EmptyState title="No matching records found" />;
  return (
    <DataTable
      rows={rows}
      searchText={(p) => p.name}
      placeholder="Search projects…"
      columns={[
        { label: 'Project', value: (p) => <strong>{p.name}</strong>, sort: (p) => p.name },
        { label: 'Status', value: (p) => <Badge value={p.status} /> },
        { label: 'Location', value: (p) => p.location ?? '—' },
        {
          label: 'Budget',
          value: (p) => (p.budget !== undefined ? formatAmount(p.budget) : '—'),
          sort: (p) => p.budget ?? -1,
        },
        {
          label: 'Progress',
          value: (p) => (p.progress !== undefined ? `${p.progress}%` : '—'),
          sort: (p) => p.progress ?? -1,
        },
        {
          label: 'Actions',
          value: (p) =>
            canView ? <TextLink prefetch={false} href={'/app/projects/' + p.id}>View Project</TextLink> : <>—</>,
        },
      ]}
    />
  );
}

function ApartmentsResults({ response, canView }: { response: ApiAiSearchResponse; canView: boolean }) {
  const rows = response.results
    .map((r) => ({
      id: aiId(r.id) ?? '',
      unit: aiText(r.unit_number) ?? '—',
      status: aiText(r.status) ?? '—',
      price: aiNumber(r.price),
      beds: aiNumber(r.bedrooms),
      baths: aiNumber(r.bathrooms),
      area: aiNumber(r.area_sqm),
    }))
    .filter((r) => r.id);
  if (!rows.length) return <EmptyState title="No matching records found" />;
  return (
    <DataTable
      rows={rows}
      searchText={(a) => a.unit}
      placeholder="Search apartments…"
      columns={[
        { label: 'Unit', value: (a) => <strong>{a.unit}</strong>, sort: (a) => a.unit },
        { label: 'Status', value: (a) => <Badge value={a.status} /> },
        {
          label: 'Price',
          value: (a) => (a.price !== undefined ? formatAmount(a.price) : '—'),
          sort: (a) => a.price ?? -1,
        },
        { label: 'Beds/Baths', value: (a) => `${a.beds ?? '—'} / ${a.baths ?? '—'}` },
        { label: 'Area (sqm)', value: (a) => (a.area !== undefined ? String(a.area) : '—') },
        {
          label: 'Actions',
          value: (a) =>
            canView ? <TextLink prefetch={false} href={'/app/apartments/' + a.id}>View Apartment</TextLink> : <>—</>,
        },
      ]}
    />
  );
}

function PaymentsResults({ response, canView }: { response: ApiAiSearchResponse; canView: boolean }) {
  const rows = response.results
    .map((r) => ({
      id: aiId(r.id) ?? '',
      amount: aiNumber(r.amount),
      date: aiText(r.payment_date),
      reference: aiText(r.reference),
      description: aiText(r.description),
    }))
    .filter((r) => r.id);
  if (!rows.length) return <EmptyState title="No matching records found" />;
  return (
    <DataTable
      rows={rows}
      searchText={(p) => `${p.reference ?? ''} ${p.description ?? ''}`}
      placeholder="Search payments…"
      columns={[
        {
          label: 'Amount',
          value: (p) => <strong>{p.amount !== undefined ? formatAmount(p.amount) : '—'}</strong>,
          sort: (p) => p.amount ?? -1,
        },
        {
          label: 'Date',
          value: (p) => (p.date ? displayDate(p.date) : '—'),
          sort: (p) => p.date ?? '',
        },
        { label: 'Reference', value: (p) => p.reference ?? '—' },
        { label: 'Description', value: (p) => p.description ?? '—' },
        {
          label: 'Actions',
          value: (p) =>
            canView ? <TextLink prefetch={false} href={'/app/payments/' + p.id}>View Payment</TextLink> : <>—</>,
        },
      ]}
    />
  );
}

function SummaryResults({ response }: { response: ApiAiSearchResponse }) {
  const record = response.results[0];
  if (!record) return <EmptyState title="No matching records found" />;
  return <SummaryGrid record={record} skip={['id', 'project_id']} />;
}

function TaskSummaryResults({ response }: { response: ApiAiSearchResponse }) {
  const record = response.results[0];
  if (!record) return <EmptyState title="No matching records found" />;
  const cards: Array<[string, unknown]> = [
    ['Total Tasks', record.total_tasks],
    ['Completed', record.completed],
    ['In Progress', record.in_progress],
    ['Not Started', record.not_started],
    ['Overdue', record.overdue],
  ];
  return (
    <>
      <div className="stats">
        {cards.map(([labelText, value]) => (
          <StatCard key={labelText} label={labelText} value={typeof value === 'number' ? value : '—'} />
        ))}
      </div>
      <div className="section-space">
        <SummaryGrid record={record} skip={['id', 'total_tasks', 'completed', 'in_progress', 'not_started', 'overdue']} />
      </div>
    </>
  );
}

function ProjectReportResults({ response }: { response: ApiAiSearchResponse }) {
  const record = response.results[0];
  if (!record) return <EmptyState title="No matching records found" />;
  const project = (record.project as AiResultRecord | undefined) ?? undefined;
  const isRecord = (v: unknown): v is AiResultRecord =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const sections: Array<[string, AiResultRecord]> = [
    ['Construction Progress', record.stages],
    ['Tasks', record.tasks],
    ['Apartment Inventory', record.apartments],
    ['Financial Summary', record.finance],
  ].filter((entry): entry is [string, AiResultRecord] => isRecord(entry[1]));
  return (
    <div className="stack">
      {project && (
        <Panel title="Project Overview">
          <SummaryGrid record={project} skip={['id']} />
        </Panel>
      )}
      {sections.map(([title, data]) => (
        <Panel key={title} title={title}>
          <SummaryGrid record={data} />
        </Panel>
      ))}
    </div>
  );
}

function IntentResults({
  response,
  companyRole,
}: {
  response: ApiAiSearchResponse;
  companyRole: Parameters<typeof canAccess>[0];
}) {
  switch (response.intent) {
    case 'SEARCH_TASKS':
      return <TasksResults response={response} canView={canViewModule(companyRole, 'tasks')} />;
    case 'SEARCH_PROJECTS':
      return <ProjectsResults response={response} canView={canViewModule(companyRole, 'projects')} />;
    case 'SEARCH_APARTMENTS':
      return (
        <ApartmentsResults response={response} canView={canViewModule(companyRole, 'apartments')} />
      );
    case 'SEARCH_PAYMENTS':
      return <PaymentsResults response={response} canView={canViewModule(companyRole, 'payments')} />;
    case 'PROJECT_REPORT':
      return <ProjectReportResults response={response} />;
    case 'TASK_SUMMARY':
      return <TaskSummaryResults response={response} />;
    case 'PROJECT_FINANCIAL_SUMMARY':
    case 'PROJECT_PROGRESS_SUMMARY':
    case 'PAYMENT_SUMMARY':
    case 'APARTMENT_SUMMARY':
      return <SummaryResults response={response} />;
    default:
      return <SummaryGrid record={response.results[0] ?? {}} />;
  }
}

export function Assistant() {
  const companyId = useAuthStore((s) => s.companyId);
  const companyRole = useAuthStore((s) => s.companyRole);
  const [result, setResult] = useState<ApiAiSearchResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof assistantSchema>>({
    resolver: zodResolver(assistantSchema),
    defaultValues: { query: '' },
  });
  const suggestions = suggestionsForRole(companyRole);

  const runQuery = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || loading) return;
    if (!companyId) {
      setApiError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      setResult(await searchAI(companyId, query));
    } catch (err) {
      setResult(null);
      if (err instanceof ApiError && err.status === 401) {
        setApiError('Your session has expired. Please sign in again.');
      } else if (err instanceof ApiError && err.status === 403) {
        setApiError(
          err.code === 'AI_INTENT_FORBIDDEN'
            ? "You don't have permission to access that information."
            : friendlyMessage(err),
        );
      } else if (err instanceof ApiError && err.status === 422 && err.code === 'AI_QUERY_UNSUPPORTED') {
        setApiError(
          "This type of request isn't supported yet. Try asking about projects, tasks, apartments, payments, or summaries available to your role.",
        );
      } else if (err instanceof ApiError && err.status === 422) {
        setApiError('Please rephrase your request and try again.');
      } else if (err instanceof ApiError && err.status === 502) {
        setApiError(
          err.code === 'AI_PROVIDER_ERROR'
            ? 'The AI service is temporarily unavailable. Please try again.'
            : friendlyMessage(err),
        );
      } else {
        setApiError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Ask questions about your company and authorized project data."
      />
      <Panel>
        <p className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ShieldCheck size={16} /> Read-only workspace assistant · Live company data
        </p>
        <FormProvider {...form}>
          <form
            className="stack section-space"
            noValidate
            onSubmit={form.handleSubmit((v) => runQuery(v.query))}
          >
            <Field
              name="query"
              label="Ask your workspace"
              placeholder="Which tasks are overdue?"
            />
            <button className="button" style={{ alignSelf: 'flex-end' }} type="submit" disabled={loading}>
              <Sparkles size={16} />
              {loading ? 'Analyzing…' : 'Run Query'}
            </button>
          </form>
        </FormProvider>
      </Panel>
      {loading && (
        <p className="small section-space" role="status" aria-live="polite">
          Analyzing your request…
        </p>
      )}
      {apiError && !loading && (
        <p className="field-error section-space" role="alert">
          {apiError}
        </p>
      )}
      <div className="section-space">
        <h2 style={{ marginBottom: 16 }}>Suggested Workspace Queries</h2>
        {suggestions === null ? (
          <p className="small">
            AI search is available, but your current role has no permitted AI queries. Your
            administrator can grant access to company workspaces.
          </p>
        ) : (
          <div className="three-grid">
            {suggestions.map((q) => (
              <button
                key={q}
                className="query-card"
                type="button"
                disabled={loading}
                onClick={() => {
                  form.setValue('query', q);
                  form.setFocus('query');
                }}
              >
                {q}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        )}
      </div>
      {result && !loading && (
        <div className="section-space" aria-live="polite">
          <Panel title={result.query} subtitle={`${result.intent} · ${result.count} result${result.count === 1 ? '' : 's'}`}>
            <p style={{ fontSize: 19, fontWeight: 600 }}>{result.answer}</p>
            <div className="stack section-space">
              {result.count === 0 || !result.results.length ? (
                <EmptyState title="No matching records found" />
              ) : (
                <IntentResults response={result} companyRole={companyRole} />
              )}
            </div>
          </Panel>
        </div>
      )}
      <div className="form-note">
        The assistant queries live company data through the AI search API and cannot change or
        delete records.
      </div>
    </>
  );
}
