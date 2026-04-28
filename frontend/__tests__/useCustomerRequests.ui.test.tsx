import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useCRCDashboard,
  useCRCList,
  useCRCPerformerWeeklyTimesheet,
  useCreateCRC,
  useTransitionCase,
} from '../shared/hooks/useCustomerRequests';
import { queryKeys } from '../shared/queryKeys';
import {
  createYeuCau,
  fetchYeuCauDashboard,
  fetchYeuCauPage,
  fetchYeuCauPerformerWeeklyTimesheet,
  transitionCustomerRequestCase,
} from '../services/api/customerRequestApi';

vi.mock('../services/api/customerRequestApi', () => ({
  createYeuCau: vi.fn(),
  fetchYeuCau: vi.fn(),
  fetchYeuCauDashboard: vi.fn(),
  fetchYeuCauPage: vi.fn(),
  fetchYeuCauPerformerWeeklyTimesheet: vi.fn(),
  fetchYeuCauProcessDetail: vi.fn(),
  fetchYeuCauTimeline: vi.fn(),
  fetchYeuCauWorklogs: vi.fn(),
  transitionCustomerRequestCase: vi.fn(),
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

describe('useCustomerRequests', () => {
  it('loads CRC list with compacted params', async () => {
    vi.mocked(fetchYeuCauPage).mockResolvedValue({
      data: [{
        id: 1,
        ma_yc: 'YC-001',
        tieu_de: 'Case 1',
        do_uu_tien: 2,
        trang_thai: 'new_intake',
        ket_qua: 'dang_xu_ly',
      }],
      meta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      },
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCRCList({
      page: 1,
      per_page: 20,
      process_code: 'new_intake',
      q: 'case',
      filters: {
        my_role: 'creator',
      },
    }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchYeuCauPage).toHaveBeenCalledWith(
      {
        page: 1,
        per_page: 20,
        process_code: 'new_intake',
        q: 'case',
        filters: {
          my_role: 'creator',
        },
      },
      expect.objectContaining({
        cancelKey: expect.stringContaining('/api/v5/customer-request-cases'),
      })
    );
    expect(result.current.data?.data).toHaveLength(1);
  });

  it('loads CRC dashboard and performer timesheet queries', async () => {
    vi.mocked(fetchYeuCauDashboard).mockResolvedValue({
      role: 'overview',
      summary: {
        total_cases: 2,
        status_counts: [],
        alert_counts: {
          over_estimate: 0,
          missing_estimate: 1,
          sla_risk: 0,
        },
      },
      top_customers: [],
      top_performers: [],
      attention_cases: [],
    } as never);
    vi.mocked(fetchYeuCauPerformerWeeklyTimesheet).mockResolvedValue({
      start_date: '2026-03-24',
      end_date: '2026-03-30',
      performer_user_id: 3,
      total_hours: 8,
      billable_hours: 6,
      non_billable_hours: 2,
      worklog_count: 3,
      days: [],
      top_cases: [],
      recent_entries: [],
    } as never);

    const { wrapper } = createWrapper();
    const dashboard = renderHook(() => useCRCDashboard('overview'), { wrapper });
    const timesheet = renderHook(() => useCRCPerformerWeeklyTimesheet(), { wrapper });

    await waitFor(() => expect(dashboard.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(timesheet.result.current.isSuccess).toBe(true));

    expect(fetchYeuCauDashboard).toHaveBeenCalledWith('overview', {});
    expect(fetchYeuCauPerformerWeeklyTimesheet).toHaveBeenCalledWith({});
    expect(dashboard.result.current.data?.summary.total_cases).toBe(2);
    expect(timesheet.result.current.data?.total_hours).toBe(8);
  });

  it('invalidates customer request caches after create mutation', async () => {
    vi.mocked(createYeuCau).mockResolvedValue({
      id: 99,
      ma_yc: 'YC-099',
      tieu_de: 'New CRC',
      do_uu_tien: 2,
      trang_thai: 'new_intake',
      ket_qua: 'dang_xu_ly',
    } as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCRC(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        master_payload: {
          summary: 'New CRC',
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.customerRequests.all });
  });

  it('invalidates list and detail caches after transition mutation', async () => {
    vi.mocked(transitionCustomerRequestCase).mockResolvedValue({
      id: 12,
      ma_yc: 'YC-012',
      tieu_de: 'Transitioned CRC',
      do_uu_tien: 3,
      trang_thai: 'completed',
      ket_qua: 'hoan_thanh',
    } as never);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useTransitionCase(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 12,
        toStatusCode: 'completed',
        statusPayload: {
          notes: 'done',
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.customerRequests.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.customerRequests.detail(12) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.customerRequests.timeline(12) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.customerRequests.worklogs(12) });
  });
});
