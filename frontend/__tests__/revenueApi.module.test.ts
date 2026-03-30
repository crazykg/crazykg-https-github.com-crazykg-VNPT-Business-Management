import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRevenueOverview,
  syncProjectRevenueSchedules,
} from '../services/api/revenueApi';

const fetchMock = vi.fn();

describe('revenueApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds overview query params with grouping and dept filters', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ meta: { fee_collection_available: true, data_sources: [] }, data: { kpis: {}, by_period: [], by_source: [], alerts: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchRevenueOverview({
      period_from: '2026-03-01',
      period_to: '2026-03-31',
      grouping: 'quarter',
      dept_id: 9,
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/revenue/overview?');
    expect(String(url)).toContain('period_from=2026-03-01');
    expect(String(url)).toContain('period_to=2026-03-31');
    expect(String(url)).toContain('grouping=quarter');
    expect(String(url)).toContain('dept_id=9');
  });

  it('sends revenue schedule sync payload without reshaping the schedule rows', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await syncProjectRevenueSchedules(12, [{
      expected_date: '2026-04-15',
      expected_amount: 1500000,
      notes: 'Dot 1',
    }]);

    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(String(url)).toContain('/api/v5/projects/12/revenue-schedules/sync');
    expect(payload).toEqual({
      schedules: [{
        expected_date: '2026-04-15',
        expected_amount: 1500000,
        notes: 'Dot 1',
      }],
    });
  });
});
