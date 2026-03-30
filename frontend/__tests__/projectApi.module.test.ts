import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchProjectItemsOptionsPage,
  updateProject,
} from '../services/api/projectApi';

const fetchMock = vi.fn();

describe('projectApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('builds project-item option queries with non-simple pagination and ascending sort', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { page: 3, per_page: 20, total: 0, total_pages: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchProjectItemsOptionsPage('his', 3, 20);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/project-items?');
    expect(String(url)).toContain('page=3');
    expect(String(url)).toContain('per_page=20');
    expect(String(url)).toContain('simple=0');
    expect(String(url)).toContain('sort_by=id');
    expect(String(url)).toContain('sort_dir=asc');
    expect(String(url)).toContain('q=his');
  });

  it('normalizes project mutation payload fields before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 7, project_code: 'DA007' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updateProject(7, {
      project_code: 'DA007',
      investment_mode: 'Thuê dịch vụ CNTT đặc thù',
      payment_cycle: 'Hàng quý',
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

    const [, requestInit] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload.investment_mode).toBe('THUE_DICH_VU_DACTHU');
    expect(payload.payment_cycle).toBe('QUARTERLY');
    expect(payload.raci).toEqual([
      {
        user_id: 22,
        raci_role: 'R',
        assigned_date: '2026-03-28',
      },
    ]);
  });

  it('times out a hung update request instead of leaving the mutation pending', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    const pending = updateProject(7, { project_code: 'DA007' });
    const rejection = expect(pending).rejects.toThrow(
      'Không thể cập nhật dự án lúc này (quá thời gian phản hồi). Vui lòng thử lại.'
    );

    await vi.advanceTimersByTimeAsync(12001);

    await rejection;
  });
});
