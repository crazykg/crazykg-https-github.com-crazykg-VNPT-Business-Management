/**
 * Core API fetch utility with auth refresh, request deduplication,
 * cancellation, and tab eviction handling.
 *
 * This is extracted from services/v5Api.ts to be the shared foundation
 * for all feature-specific API modules.
 */

const API_REQUEST_TIMEOUT_MS = 45000;
const API_REQUEST_CANCELLED_MESSAGE = '__REQUEST_CANCELLED__';
const AUTH_REFRESH_ENDPOINT = '/api/v5/auth/refresh';
const AUTH_REFRESH_TIMEOUT_MS = 5000;
const JSON_ACCEPT_HEADER = { Accept: 'application/json' };
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const SAME_BROWSER_MULTI_TAB_POLICY_STORAGE_KEY = 'qlcv:same-browser-multi-tab-enabled';
const AUTH_REFRESH_LOCK_STORAGE_KEY = 'qlcv:auth-refresh-lock';
const AUTH_REFRESH_RESULT_STORAGE_KEY = 'qlcv:auth-refresh-result';
const AUTH_REFRESH_LOCK_TTL_MS = AUTH_REFRESH_TIMEOUT_MS + 3000;
const AUTH_REFRESH_WAIT_TIMEOUT_MS = AUTH_REFRESH_TIMEOUT_MS + 3500;

const AUTH_REFRESH_EXCLUDED_PATHS = new Set([
  '/api/v5/auth/login',
  '/api/v5/auth/refresh',
  '/api/v5/auth/logout',
  '/api/v5/auth/change-password',
]);

// ★ Global eviction callback — registered from App.tsx or auth store
type EvictionCallback = () => void;
let _onTabEvicted: EvictionCallback | null = null;
export const registerTabEvictedHandler = (cb: EvictionCallback): void => { _onTabEvicted = cb; };
export const unregisterTabEvictedHandler = (): void => { _onTabEvicted = null; };

// In-flight tracking for deduplication and cancellation
const inFlightRequestControllers = new Map<string, AbortController>();
const inFlightGetRequests = new Map<string, Promise<Response>>();
let inFlightRefreshPromise: Promise<boolean> | null = null;

type RefreshLockRecord = {
  owner: string;
  expires_at: number;
  nonce: string;
};

type RefreshResultRecord = {
  owner: string;
  success: boolean;
  emitted_at: number;
  nonce: string;
};

export type ApiFetchInit = RequestInit & {
  cancelKey?: string;
  skipAuthRefresh?: boolean;
};

export interface ApiError {
  code: string;
  message: string;
  request_id?: string;
  errors?: Record<string, string[] | string>;
  retry_after?: number | string | null;
}

const buildTabInstanceId = (): string => {
  const fallback = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    if (typeof globalThis.sessionStorage === 'undefined') {
      return fallback;
    }
    const storageKey = 'qlcv:api-fetch-tab-id';
    const existing = globalThis.sessionStorage.getItem(storageKey);
    if (existing && existing.trim() !== '') {
      return existing;
    }
    globalThis.sessionStorage.setItem(storageKey, fallback);
    return fallback;
  } catch {
    return fallback;
  }
};

const normalizeBooleanFlag = (rawValue: string | null | undefined, fallback = true): boolean => {
  if (typeof rawValue !== 'string') {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    return false;
  }

  return fallback;
};

const readStorageJson = <T>(key: string): T | null => {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return null;
    }

    const rawValue = globalThis.localStorage.getItem(key);
    if (typeof rawValue !== 'string' || rawValue.trim() === '') {
      return null;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
};

const writeStorageJson = (key: string, payload: unknown): void => {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return;
    }

    globalThis.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode / quota / SSR).
  }
};

const tabInstanceId = buildTabInstanceId();
let sameBrowserMultiTabEnabled = (() => {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return true;
    }
    return normalizeBooleanFlag(globalThis.localStorage.getItem(SAME_BROWSER_MULTI_TAB_POLICY_STORAGE_KEY), true);
  } catch {
    return true;
  }
})();

export const setSameBrowserMultiTabEnabled = (enabled: boolean): void => {
  sameBrowserMultiTabEnabled = enabled;
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(SAME_BROWSER_MULTI_TAB_POLICY_STORAGE_KEY, enabled ? '1' : '0');
    }
  } catch {
    // Ignore storage failures and keep in-memory policy.
  }
};

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key === SAME_BROWSER_MULTI_TAB_POLICY_STORAGE_KEY) {
      sameBrowserMultiTabEnabled = normalizeBooleanFlag(storageEvent.newValue, true);
    }
  });
}

type ApiErrorEnvelope = {
  error?: ApiError;
  code?: string;
  message?: string;
  request_id?: string;
  errors?: Record<string, string[] | string>;
  retry_after?: number | string | null;
};

export const isRequestCanceledError = (error: unknown): boolean =>
  error instanceof Error && error.message === API_REQUEST_CANCELLED_MESSAGE;

const FALLBACK_STATUS_CODE_MAP: Record<number, string> = {
  401: 'UNAUTHENTICATED',
  403: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

/**
 * Extract a structured API error from the new envelope while still supporting
 * the legacy top-level error shape.
 */
export const parseApiError = async (response: Response): Promise<ApiError> => {
  try {
    const body = (await response.json()) as ApiErrorEnvelope;

    if (body?.error && typeof body.error.code === 'string') {
      return body.error;
    }

    if (typeof body?.code === 'string') {
      return {
        code: body.code,
        message: typeof body.message === 'string' && body.message.trim() ? body.message : response.statusText,
        request_id: typeof body.request_id === 'string' ? body.request_id : undefined,
        errors: body.errors,
        retry_after: body.retry_after,
      };
    }

    return {
      code: FALLBACK_STATUS_CODE_MAP[response.status] ?? 'UNKNOWN',
      message: typeof body?.message === 'string' && body.message.trim() ? body.message : response.statusText,
      request_id: typeof body?.request_id === 'string' ? body.request_id : undefined,
      errors: body?.errors,
      retry_after: body?.retry_after,
    };
  } catch {
    return {
      code: FALLBACK_STATUS_CODE_MAP[response.status] ?? 'UNKNOWN',
      message: response.statusText,
    };
  }
};

// ---------- Internal helpers ----------

const resolveRequestMethod = (input: RequestInfo | URL, requestInit: RequestInit): string => {
  const initMethod = String(requestInit.method || '').trim().toUpperCase();
  if (initMethod) {
    return initMethod;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return String(input.method || 'GET').trim().toUpperCase();
  }
  return 'GET';
};

const resolveRequestUrl = (input: RequestInfo | URL): URL | null => {
  try {
    if (typeof input === 'string') {
      return new URL(input, globalThis.location.origin);
    }
    if (input instanceof URL) {
      return input;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, globalThis.location.origin);
    }
  } catch {
    return null;
  }
  return null;
};

const shouldDedupeGetRequest = (method: string, requestInit: RequestInit): boolean =>
  method === 'GET' && typeof requestInit.body === 'undefined';

const resolveRequestIdentityKey = (input: RequestInfo | URL, method: string): string | null => {
  const requestUrl = resolveRequestUrl(input);
  if (!requestUrl) {
    return null;
  }
  return `${method}:${requestUrl.pathname}${requestUrl.search}`;
};

const resolveRequestPath = (input: RequestInfo | URL): string => {
  try {
    if (typeof input === 'string') {
      return new URL(input, globalThis.location.origin).pathname;
    }
    if (input instanceof URL) {
      return input.pathname;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, globalThis.location.origin).pathname;
    }
  } catch {
    // Ignore parsing error
  }
  return '';
};

const shouldAttemptSessionRefresh = (input: RequestInfo | URL): boolean => {
  const pathname = resolveRequestPath(input);
  if (!pathname.startsWith('/api/v5/')) {
    return false;
  }
  return !AUTH_REFRESH_EXCLUDED_PATHS.has(pathname);
};

const isCrossTabRefreshEnabled = (): boolean =>
  sameBrowserMultiTabEnabled && typeof globalThis.localStorage !== 'undefined';

const isValidRefreshLock = (lock: RefreshLockRecord | null): lock is RefreshLockRecord =>
  Boolean(
    lock
    && typeof lock.owner === 'string'
    && lock.owner.trim() !== ''
    && typeof lock.nonce === 'string'
    && lock.nonce.trim() !== ''
    && Number.isFinite(lock.expires_at)
    && lock.expires_at > Date.now()
  );

const readRefreshLock = (): RefreshLockRecord | null =>
  readStorageJson<RefreshLockRecord>(AUTH_REFRESH_LOCK_STORAGE_KEY);

const readRecentRefreshResult = (): RefreshResultRecord | null => {
  const record = readStorageJson<RefreshResultRecord>(AUTH_REFRESH_RESULT_STORAGE_KEY);
  if (
    !record
    || typeof record.owner !== 'string'
    || typeof record.nonce !== 'string'
    || !Number.isFinite(record.emitted_at)
  ) {
    return null;
  }

  return Date.now() - record.emitted_at <= AUTH_REFRESH_WAIT_TIMEOUT_MS
    ? record
    : null;
};

const tryAcquireRefreshLock = (): RefreshLockRecord | null => {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return null;
    }

    const currentLock = readRefreshLock();
    if (isValidRefreshLock(currentLock) && currentLock.owner !== tabInstanceId) {
      return null;
    }

    const nextLock: RefreshLockRecord = {
      owner: tabInstanceId,
      expires_at: Date.now() + AUTH_REFRESH_LOCK_TTL_MS,
      nonce: `${tabInstanceId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    };

    writeStorageJson(AUTH_REFRESH_LOCK_STORAGE_KEY, nextLock);
    const confirmedLock = readRefreshLock();

    return confirmedLock?.nonce === nextLock.nonce ? nextLock : null;
  } catch {
    return null;
  }
};

const releaseRefreshLock = (lock: RefreshLockRecord | null): void => {
  if (!lock) {
    return;
  }

  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return;
    }

    const currentLock = readRefreshLock();
    if (currentLock?.nonce === lock.nonce && currentLock.owner === tabInstanceId) {
      globalThis.localStorage.removeItem(AUTH_REFRESH_LOCK_STORAGE_KEY);
    }
  } catch {
    // Ignore lock release failures and let TTL clean up stale state.
  }
};

const publishRefreshResult = (success: boolean, lock: RefreshLockRecord | null): void => {
  const record: RefreshResultRecord = {
    owner: tabInstanceId,
    success,
    emitted_at: Date.now(),
    nonce: lock?.nonce ?? `${tabInstanceId}:fallback`,
  };

  writeStorageJson(AUTH_REFRESH_RESULT_STORAGE_KEY, record);
};

const waitForCrossTabRefresh = async (): Promise<boolean> => {
  const recentResult = readRecentRefreshResult();
  if (recentResult && recentResult.owner !== tabInstanceId) {
    return recentResult.success;
  }

  if (typeof globalThis.addEventListener !== 'function') {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve(false);
    }, AUTH_REFRESH_WAIT_TIMEOUT_MS);

    const cleanup = (): void => {
      globalThis.clearTimeout(timeoutId);
      globalThis.removeEventListener('storage', handleStorageEvent as EventListener);
    };

    const handleStorageEvent = (event: StorageEvent): void => {
      if (event.key !== AUTH_REFRESH_RESULT_STORAGE_KEY || typeof event.newValue !== 'string') {
        return;
      }

      try {
        const result = JSON.parse(event.newValue) as RefreshResultRecord;
        if (result.owner === tabInstanceId || Date.now() - result.emitted_at > AUTH_REFRESH_WAIT_TIMEOUT_MS) {
          return;
        }

        cleanup();
        resolve(Boolean(result.success));
      } catch {
        // Ignore malformed payloads and keep waiting.
      }
    };

    globalThis.addEventListener('storage', handleStorageEvent as EventListener);
  });
};

const performRefreshRequest = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), AUTH_REFRESH_TIMEOUT_MS);
  try {
    const response = await globalThis.fetch(AUTH_REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: JSON_ACCEPT_HEADER,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const refreshSession = async (): Promise<boolean> => {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      if (!isCrossTabRefreshEnabled()) {
        return await performRefreshRequest();
      }

      const lock = tryAcquireRefreshLock();
      if (lock) {
        try {
          const success = await performRefreshRequest();
          publishRefreshResult(success, lock);
          return success;
        } finally {
          releaseRefreshLock(lock);
        }
      }

      const waitedResult = await waitForCrossTabRefresh();
      if (waitedResult) {
        return true;
      }

      const retryLock = tryAcquireRefreshLock();
      if (!retryLock) {
        return false;
      }

      try {
        const success = await performRefreshRequest();
        publishRefreshResult(success, retryLock);
        return success;
      } finally {
        releaseRefreshLock(retryLock);
      }
    } catch {
      return false;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

// ---------- Public API ----------

/**
 * Core fetch wrapper with auth refresh on 401, GET dedup, cancellation, and timeout.
 *
 * Features:
 * - Auto-refreshes auth token on 401 (except for auth endpoints)
 * - Deduplicates concurrent identical GET requests
 * - Supports request cancellation via `cancelKey` + AbortController
 * - 45s timeout on all requests
 * - Detects TAB_EVICTED and triggers eviction callback
 */
export const apiFetch = async (input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> => {
  const { cancelKey, signal: externalSignal, skipAuthRefresh = false, ...requestInit } = init;

  // When body is FormData, let browser set Content-Type with boundary
  const isFormData = requestInit.body instanceof FormData;
  const headers = new Headers(requestInit.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  // Remove Content-Type if FormData so browser can set it with boundary
  if (isFormData && headers.has('Content-Type')) {
    headers.delete('Content-Type');
  }

  const requestMethod = resolveRequestMethod(input, requestInit);
  const dedupeKey = shouldDedupeGetRequest(requestMethod, requestInit)
    ? resolveRequestIdentityKey(input, requestMethod)
    : null;
  if (dedupeKey) {
    const existingRequest = inFlightGetRequests.get(dedupeKey);
    if (existingRequest) {
      const response = await existingRequest;
      return response.clone();
    }
  }

  const abortController = new AbortController();
  if (cancelKey) {
    const previousController = inFlightRequestControllers.get(cancelKey);
    if (previousController) {
      previousController.abort();
    }
    inFlightRequestControllers.set(cancelKey, abortController);
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortController.abort();
    } else {
      externalSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
  }

  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, API_REQUEST_TIMEOUT_MS);

  const executeFetch = async (): Promise<Response> => {
    return await globalThis.fetch(input, {
      ...requestInit,
      method: requestMethod,
      credentials: 'include',
      headers,
      signal: abortController.signal,
    });
  };

  const executeRequest = async (): Promise<Response> => {
    let response = await executeFetch();

    if (
      response.status === 401
      && !skipAuthRefresh
      && shouldAttemptSessionRefresh(input)
    ) {
      const cloned = response.clone();
      try {
        const body = await cloned.json() as { code?: string; error?: { code?: string } };
        const errorCode = typeof body?.error?.code === 'string' ? body.error.code : body?.code;
        if (errorCode === 'TAB_EVICTED') {
          _onTabEvicted?.();
          return response;
        }
      } catch {
        // body not JSON — continue normal flow
      }

      const refreshed = await refreshSession();
      if (refreshed) {
        response = await executeFetch();
      }
    }

    return response;
  };

  try {
    if (dedupeKey) {
      const pendingRequest = executeRequest();
      let trackedRequest: Promise<Response>;
      trackedRequest = pendingRequest.finally(() => {
        if (inFlightGetRequests.get(dedupeKey) === trackedRequest) {
          inFlightGetRequests.delete(dedupeKey);
        }
      });
      inFlightGetRequests.set(dedupeKey, trackedRequest);
      const response = await trackedRequest;
      return response.clone();
    }

    return await executeRequest();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (timedOut) {
        throw new Error('Không thể kết nối máy chủ (quá thời gian phản hồi). Vui lòng thử lại.');
      }
      throw new Error(API_REQUEST_CANCELLED_MESSAGE);
    }
    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc trạng thái backend.');
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (cancelKey && inFlightRequestControllers.get(cancelKey) === abortController) {
      inFlightRequestControllers.delete(cancelKey);
    }
  }
};

// ---------- Response helpers ----------

export { JSON_HEADERS, JSON_ACCEPT_HEADER };

/**
 * Build a query string from a PaginatedQuery object for GET requests.
 */
export const buildQueryString = (params: Record<string, unknown>): string => {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return entries.length > 0 ? `?${entries.join('&')}` : '';
};
