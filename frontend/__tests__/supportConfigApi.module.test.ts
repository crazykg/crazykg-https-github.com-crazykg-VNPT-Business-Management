import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDepartmentWeekOptions,
  createSupportRequestStatusesBulk,
  fetchMonthlyCalendars,
  fetchAvailableSupportServiceGroups,
} from '../services/api/supportConfigApi';

const fetchMock = vi.fn();

describe('supportConfigApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('builds available support-service-group query params', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchAvailableSupportServiceGroups({
      customer_id: 18,
      include_group_id: 4,
      include_inactive: true,
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/support-service-groups/available?');
    expect(String(url)).toContain('customer_id=18');
    expect(String(url)).toContain('include_group_id=4');
    expect(String(url)).toContain('include_inactive=1');
  });

  it('fills default fields when bulk-creating support request statuses', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { results: [], created: [], created_count: 0, failed_count: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createSupportRequestStatusesBulk([
      {
        status_code: 'NEW',
        status_name: 'Moi',
      },
    ]);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload.items[0]).toMatchObject({
      status_code: 'NEW',
      status_name: 'Moi',
      requires_completion_dates: true,
      is_terminal: false,
      is_transfer_dev: false,
      is_active: true,
      sort_order: 0,
    });
  });

  it('builds monthly-calendar query params from year/month filters', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchMonthlyCalendars({ year: 2026, month: 3, include_inactive: true });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/monthly-calendars?');
    expect(String(url)).toContain('year=2026');
    expect(String(url)).toContain('month=3');
    expect(String(url)).toContain('include_inactive=true');
  });

  it('sorts week options with current/future weeks before past weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T00:00:00.000Z'));

    const options = buildDepartmentWeekOptions([
      {
        date: '2026-03-16',
        year: 2026,
        month: 3,
        day: 16,
        week_number: 12,
        day_of_week: 2,
        is_weekend: false,
        is_working_day: true,
        is_holiday: false,
      },
      {
        date: '2026-03-30',
        year: 2026,
        month: 3,
        day: 30,
        week_number: 14,
        day_of_week: 2,
        is_weekend: false,
        is_working_day: true,
        is_holiday: false,
      },
    ]);

    expect(options.map((item) => item.week_start_date)).toEqual(['2026-03-30', '2026-03-16']);

    vi.useRealTimers();
  });
});
