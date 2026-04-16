import React from 'react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useRevenueOverview,
  useRevenueReport,
  useRevenueTargetsByYears,
  useSetRevenueTarget,
} from '../shared/hooks/useRevenue';
import { queryKeys } from '../shared/queryKeys';
import {
  createRevenueTarget,
  fetchRevenueOverview,
  fetchRevenueReport,
  fetchRevenueTargets,
} from '../services/api/revenueApi';

vi.mock('../services/api/revenueApi', () => ({
  bulkCreateRevenueTargets: vi.fn(),
  createRevenueTarget: vi.fn(),
  deleteRevenueTarget: vi.fn(),
  fetchRevenueForecast: vi.fn(),
  fetchRevenueOverview: vi.fn(),
  fetchRevenueReport: vi.fn(),
  fetchRevenueTargets: vi.fn(),
  updateRevenueTarget: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useRevenue', () => {
  it('loads revenue overview with compacted params', async () => {
    vi.mocked(fetchRevenueOverview).mockResolvedValue({
      meta: {
        fee_collection_available: true,
        data_sources: ['contracts'],
      },
      data: {
        kpis: {
          target_amount: 1_000_000,
          actual_collected: 500_000,
          outstanding: 500_000,
          overdue_amount: 100_000,
          overdue_count: 1,
          collection_rate: 50,
          achievement_pct: 50,
          growth_pct: 10,
        },
        by_period: [],
        by_source: [],
        alerts: [],
      },
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRevenueOverview({
        period_from: '2026-03-01',
        period_to: '2026-03-31',
        grouping: 'month',
        dept_id: 5,
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchRevenueOverview).toHaveBeenCalledWith({
      period_from: '2026-03-01',
      period_to: '2026-03-31',
      grouping: 'month',
      dept_id: 5,
    });
    expect(result.current.data?.meta.fee_collection_available).toBe(true);
  });

  it('does not refetch revenue overview when window focus returns', async () => {
    vi.mocked(fetchRevenueOverview).mockResolvedValue({
      meta: {
        fee_collection_available: true,
        data_sources: ['contracts'],
      },
      data: {
        kpis: {
          target_amount: 1_000_000,
          actual_collected: 500_000,
          outstanding: 500_000,
          overdue_amount: 100_000,
          overdue_count: 1,
          collection_rate: 50,
          achievement_pct: 50,
          growth_pct: 10,
        },
        by_period: [],
        by_source: [],
        alerts: [],
      },
    } as never);

    const { wrapper } = createWrapper();
    renderHook(
      () => useRevenueOverview({
        period_from: '2026-03-01',
        period_to: '2026-03-31',
        grouping: 'month',
      }),
      { wrapper },
    );

    await waitFor(() => expect(fetchRevenueOverview).toHaveBeenCalledTimes(1));

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await Promise.resolve();
    });

    expect(fetchRevenueOverview).toHaveBeenCalledTimes(1);
  });

  it('aggregates revenue targets across multiple years', async () => {
    vi.mocked(fetchRevenueTargets)
      .mockResolvedValueOnce({
        data: [{
          id: 1,
          period_type: 'MONTHLY',
          period_key: '2025-12',
          period_start: '2025-12-01',
          period_end: '2025-12-31',
          dept_id: 1,
          target_type: 'TOTAL',
          target_amount: 1000,
          actual_amount: 500,
          achievement_pct: 50,
          notes: null,
          approved_by: null,
          approved_at: null,
          created_by: null,
          updated_by: null,
          created_at: null,
          updated_at: null,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          id: 2,
          period_type: 'MONTHLY',
          period_key: '2026-01',
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          dept_id: 1,
          target_type: 'TOTAL',
          target_amount: 2000,
          actual_amount: 1000,
          achievement_pct: 50,
          notes: null,
          approved_by: null,
          approved_at: null,
          created_by: null,
          updated_by: null,
          created_at: null,
          updated_at: null,
        }],
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRevenueTargetsByYears({ years: [2025, 2026], period_type: 'MONTHLY', dept_id: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(fetchRevenueTargets).toHaveBeenNthCalledWith(1, {
      period_type: 'MONTHLY',
      year: 2025,
      dept_id: 1,
    });
    expect(fetchRevenueTargets).toHaveBeenNthCalledWith(2, {
      period_type: 'MONTHLY',
      year: 2026,
      dept_id: 1,
    });
  });

  it('invalidates revenue caches after setting a revenue target', async () => {
    vi.mocked(createRevenueTarget).mockResolvedValue({
      data: {
        id: 3,
        period_type: 'MONTHLY',
        period_key: '2026-03',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        dept_id: 0,
        target_type: 'TOTAL',
        target_amount: 3_000_000,
        actual_amount: 0,
        achievement_pct: 0,
        notes: null,
        approved_by: null,
        approved_at: null,
        created_by: null,
        updated_by: null,
        created_at: null,
        updated_at: null,
      },
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSetRevenueTarget(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        data: {
          period_type: 'MONTHLY',
          period_key: '2026-03',
          target_amount: 3_000_000,
          dept_id: 0,
          target_type: 'TOTAL',
          notes: null,
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all });
  });

  it('loads revenue report by dimension', async () => {
    vi.mocked(fetchRevenueReport).mockResolvedValue({
      data: {
        dimension: 'department',
        rows: [{
          department_id: 1,
          department_name: 'Kinh doanh số',
          expected: 1_000_000,
          collected: 800_000,
          outstanding: 200_000,
          collection_rate: 80,
          share_pct: 100,
        }],
        totals: {
          total_expected: 1_000_000,
          total_collected: 800_000,
          total_outstanding: 200_000,
          collection_rate: 80,
        },
      },
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRevenueReport({
        period_from: '2026-03-01',
        period_to: '2026-03-31',
        dimension: 'department',
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchRevenueReport).toHaveBeenCalledWith({
      period_from: '2026-03-01',
      period_to: '2026-03-31',
      dimension: 'department',
      dept_id: undefined,
    });
    expect(result.current.data?.data.rows).toHaveLength(1);
  });
});
