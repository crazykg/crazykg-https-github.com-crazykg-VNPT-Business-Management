// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, parseApiError, setSameBrowserMultiTabEnabled } from '../shared/api/apiFetch';

describe('parseApiError', () => {
  it('reads the standardized nested error envelope', async () => {
    const response = new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The username field is required.',
        request_id: 'req-123',
        errors: {
          username: ['The username field is required.'],
        },
      },
    }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiError(response)).resolves.toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The username field is required.',
      request_id: 'req-123',
      errors: {
        username: ['The username field is required.'],
      },
    });
  });

  it('falls back to the legacy top-level error shape', async () => {
    const response = new Response(JSON.stringify({
      code: 'UNAUTHENTICATED',
      message: 'Unauthenticated.',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiError(response)).resolves.toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Unauthenticated.',
      request_id: undefined,
      errors: undefined,
      retry_after: undefined,
    });
  });
});

describe('apiFetch refresh coordination', () => {
  const originalFetch = global.fetch;
  const createStorageMock = () => {
    const values = new Map<string, string>();

    return {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, String(value));
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => {
        values.clear();
      }),
    };
  };

  const clearRefreshStorage = () => {
    globalThis.localStorage?.removeItem('qlcv:same-browser-multi-tab-enabled');
    globalThis.localStorage?.removeItem('qlcv:auth-refresh-lock');
    globalThis.localStorage?.removeItem('qlcv:auth-refresh-result');
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = createStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('localStorage', storage);
    clearRefreshStorage();
    setSameBrowserMultiTabEnabled(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearRefreshStorage();
    vi.unstubAllGlobals();
  });

  it('waits for a remote tab refresh result when another tab already holds the refresh lock', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const request401 = new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'Unauthenticated.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
    const request200 = new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    localStorage.setItem('qlcv:auth-refresh-lock', JSON.stringify({
      owner: 'remote-tab',
      expires_at: Date.now() + 5_000,
      nonce: 'remote-lock',
    }));

    fetchMock
      .mockResolvedValueOnce(request401)
      .mockResolvedValueOnce(request200);

    const pending = apiFetch('/api/v5/customers');

    setTimeout(() => {
      const result = JSON.stringify({
        owner: 'remote-tab',
        success: true,
        emitted_at: Date.now(),
        nonce: 'remote-lock',
      });
      localStorage.setItem('qlcv:auth-refresh-result', result);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'qlcv:auth-refresh-result',
        newValue: result,
      }));
    }, 0);

    const response = await pending;

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v5/auth/refresh', expect.anything());
  });

  it('falls back to local refresh when same-browser multi-tab policy is disabled', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    setSameBrowserMultiTabEnabled(false);

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const response = await apiFetch('/api/v5/customers');

    expect(response.ok).toBe(true);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v5/auth/refresh');
  });
});
