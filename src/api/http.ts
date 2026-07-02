import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setTokens } from './tokens';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5010';

// Коды ошибок, при которых повторный запрос после refresh бессмысленен.
const AUTH_EXEMPT_PREFIXES = ['/auth/register', '/auth/login', '/auth/refresh'];

export class ApiError extends Error {
  readonly code: string;
  readonly field: string | null;
  readonly status: number;

  constructor(code: string, message: string, field: string | null = null, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

// Защита от параллельных refresh (только один выполняется, остальные ждут).
let _refreshing: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const rt = await getRefreshToken();
  if (!rt) throw new ApiError('INVALID_TOKEN', 'Сессия истекла', null, 422);

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await clearTokens();
      throw new ApiError('INVALID_TOKEN', 'Сессия истекла, войдите заново', null, 401);
    }
    throw new ApiError('SERVER_ERROR', `Сервер недоступен (${res.status})`, null, res.status);
  }

  const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
  await setTokens(data.tokens.accessToken, data.tokens.refreshToken);
}

export function refreshOnce(): Promise<void> {
  if (!_refreshing) {
    _refreshing = doRefresh().finally(() => { _refreshing = null; });
  }
  return _refreshing;
}

type ReqOpts = {
  method: string;
  path: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
};

async function doRequest<T>(opts: ReqOpts, retry = true): Promise<T> {
  const { method, path, body, extraHeaders } = opts;
  const isExempt = AUTH_EXEMPT_PREFIXES.some((p) => path.startsWith(p));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (!isExempt) {
    const at = getAccessToken();
    if (at) headers['Authorization'] = `Bearer ${at}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isExempt && retry) {
    await refreshOnce();
    const newAt = getAccessToken();
    if (newAt) setAccessToken(newAt);
    return doRequest<T>(opts, false);
  }

  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; field?: string | null } }).error;
    if (e?.code) throw new ApiError(e.code, e.message ?? 'Ошибка', e.field ?? null, res.status);
    if (res.status === 401) throw new ApiError('UNAUTHORIZED', 'Требуется авторизация', null, 401);
    throw new ApiError('HTTP_ERROR', `HTTP ${res.status}`, null, res.status);
  }

  return data as T;
}

export const http = {
  get: <T>(path: string, extraHeaders?: Record<string, string>) =>
    doRequest<T>({ method: 'GET', path, extraHeaders }),

  post: <T>(path: string, body?: unknown, extraHeaders?: Record<string, string>) =>
    doRequest<T>({ method: 'POST', path, body, extraHeaders }),

  patch: <T>(path: string, body?: unknown, extraHeaders?: Record<string, string>) =>
    doRequest<T>({ method: 'PATCH', path, body, extraHeaders }),

  delete: <T>(path: string, body?: unknown) =>
    doRequest<T>({ method: 'DELETE', path, body }),
};
