import { useAuthStore } from '@/stores/auth.store';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  detail: string;
  fields?: Record<string, string[]>;

  constructor(status: number, detail: string, fields?: Record<string, string[]>) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.fields = fields;
  }
}

type QueryValue = string | number | boolean | undefined | null;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, `${API_BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseFields(detail: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(detail)) return undefined;
  const fields: Record<string, string[]> = {};
  for (const item of detail) {
    if (typeof item !== 'object' || item === null) continue;
    const loc = (item as { loc?: unknown }).loc;
    const msg = (item as { msg?: unknown }).msg;
    const key = Array.isArray(loc) ? String(loc[loc.length - 1]) : 'form';
    if (typeof msg !== 'string') continue;
    (fields[key] ??= []).push(msg);
  }
  return Object.keys(fields).length ? fields : undefined;
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown = `Request failed with status ${response.status}`;
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string' || Array.isArray(data?.detail)) {
      detail = data.detail;
    } else if (typeof data?.message === 'string') {
      detail = data.message;
    } else if (typeof data === 'string') {
      detail = data;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) detail = text;
    } catch {
      // keep default
    }
  }

  if (Array.isArray(detail)) {
    const fields = parseFields(detail);
    const first = detail.find(
      (item): item is { msg: string } =>
        typeof item === 'object' && item !== null && typeof (item as { msg?: unknown }).msg === 'string',
    );
    return new ApiError(response.status, first?.msg ?? 'Invalid request.', fields);
  }

  return new ApiError(response.status, String(detail));
}

export function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 403) return 'Your account does not have permission for this action.';
    if (error.status === 409) return error.detail || 'This email or phone is already registered.';
    if (error.status === 422) return error.detail || 'Some fields are invalid. Review and try again.';
    return error.detail || 'Something went wrong. Please try again.';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

interface RequestOptions {
  query?: Record<string, QueryValue>;
  auth?: boolean;
  signal?: AbortSignal;
}

function authHeaders(auth: boolean | undefined): Record<string, string> {
  if (auth === false) return {};
  const token = useAuthStore.getState().accessToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiJson<T>(
  path: string,
  options: RequestOptions & { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders(options.auth),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiForm<T>(
  path: string,
  form: FormData,
  options: RequestOptions & { method?: string } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'POST',
      headers: {
        Accept: 'application/json',
        ...authHeaders(options.auth),
      },
      body: form,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiUrlEncoded<T>(
  path: string,
  values: Record<string, string>,
  options: RequestOptions & { method?: string } = {},
): Promise<T> {
  const body = new URLSearchParams(values);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...authHeaders(false),
      },
      body,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  if (!response.ok) throw await parseError(response);
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
