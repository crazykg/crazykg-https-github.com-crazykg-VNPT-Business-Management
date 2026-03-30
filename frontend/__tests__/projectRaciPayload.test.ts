import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProject } from '../services/v5Api';

describe('Project RACI payload normalization', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normalizes assigned_date to ISO before sending the update request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 7, project_code: 'DA007' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await updateProject(7, {
      project_code: 'DA007',
      raci: [
        {
          id: 'RACI_1',
          userId: '22',
          roleType: 'R',
          assignedDate: '28/03/2026',
        },
      ],
      sync_raci: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload.raci).toEqual([
      {
        user_id: 22,
        raci_role: 'R',
        assigned_date: '2026-03-28',
      },
    ]);
  });

  it('normalizes investment_mode and payment_cycle before sending the update request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 7, project_code: 'DA007' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await updateProject(7, {
      project_code: 'DA007',
      investment_mode: 'Thuê dịch vụ CNTT đặc thù',
      payment_cycle: 'Hàng quý',
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload.investment_mode).toBe('THUE_DICH_VU_DACTHU');
    expect(payload.payment_cycle).toBe('QUARTERLY');
  });

  it('times out a hung update request instead of leaving the save pending forever', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    vi.stubGlobal('fetch', fetchMock);

    const pending = updateProject(7, {
      project_code: 'DA007',
    });
    const rejection = expect(pending).rejects.toThrow('Không thể cập nhật dự án lúc này (quá thời gian phản hồi). Vui lòng thử lại.');

    await vi.advanceTimersByTimeAsync(12001);

    await rejection;
  });

  it('does not hang forever when session refresh stalls after a 401 response', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;

      if (url.includes('/api/v5/auth/refresh')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }

      return Promise.resolve(
        new Response(JSON.stringify({ message: 'Unauthenticated.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { origin: 'http://localhost' } as Location);

    const pending = updateProject(7, {
      project_code: 'DA007',
    });
    const rejection = expect(pending).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

    await vi.advanceTimersByTimeAsync(5001);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
