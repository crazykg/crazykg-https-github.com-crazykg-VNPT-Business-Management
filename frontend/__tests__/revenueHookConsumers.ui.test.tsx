import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RevenueForecastView } from '../components/revenue-mgmt/RevenueForecastView';
import { RevenueOverviewDashboard } from '../components/revenue-mgmt/RevenueOverviewDashboard';
import { RevenueReportView } from '../components/revenue-mgmt/RevenueReportView';
import {
  useDeleteRevenueTarget,
  useRevenueForecast,
  useRevenueOverview,
  useRevenueReport,
  useRevenueTargets,
  useRevenueTargetsByYears,
} from '../shared/hooks/useRevenue';
import { useDashboardRealtime } from '../shared/hooks/useDashboardRealtime';
import { useRevenueStore } from '../shared/stores/revenueStore';
import { useToastStore } from '../shared/stores/toastStore';
import type { Department } from '../types';

vi.mock('../shared/hooks/useRevenue', () => ({
  useDeleteRevenueTarget: vi.fn(),
  useRevenueForecast: vi.fn(),
  useRevenueOverview: vi.fn(),
  useRevenueReport: vi.fn(),
  useRevenueTargets: vi.fn(),
  useRevenueTargetsByYears: vi.fn(),
}));

vi.mock('../shared/hooks/useDashboardRealtime', () => ({
  useDashboardRealtime: vi.fn(() => ({ pollingEnabled: false })),
}));

const departments = [
  { id: 1, dept_name: 'Kinh doanh số' } as Department,
];

describe('Revenue hook consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clearToasts();
    useRevenueStore.setState({
      activeView: 'OVERVIEW',
      reportTab: 'department',
      forecastHorizon: 6,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      periodType: 'MONTHLY',
      grouping: 'month',
      selectedDeptId: null,
      year: 2026,
      feeCollectionAvailable: false,
    });
  });

  it('RevenueOverviewDashboard renders data from revenue hooks and deletes targets through mutation', async () => {
    const mutateDelete = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useRevenueOverview).mockReturnValue({
      data: {
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
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useRevenueTargets).mockReturnValue({
      data: {
        data: [{
          id: 1,
          period_type: 'MONTHLY',
          period_key: '2026-03',
          period_start: '2026-03-01',
          period_end: '2026-03-31',
          dept_id: 0,
          target_type: 'TOTAL',
          target_amount: 1_000_000,
          actual_amount: 500_000,
          achievement_pct: 50,
          notes: null,
          approved_by: null,
          approved_at: null,
          created_by: null,
          updated_by: null,
          created_at: null,
          updated_at: null,
        }],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    vi.mocked(useDeleteRevenueTarget).mockReturnValue({
      mutateAsync: mutateDelete,
    } as never);

    render(
      <RevenueOverviewDashboard
        canManageTargets
        departments={departments}
      />,
    );

    expect(useDashboardRealtime).toHaveBeenCalledWith(
      ['revenue'],
      true,
      { allowPollingFallback: false },
    );
    expect(screen.getByText('Kế hoạch doanh thu')).toBeInTheDocument();
    expect(screen.getByText('Tháng 03/2026')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Xóa'));

    await waitFor(() => {
      expect(mutateDelete).toHaveBeenCalledWith(1);
    });
  });

  it('RevenueOverviewDashboard tolerates incomplete overview payloads without crashing', () => {
    vi.mocked(useRevenueOverview).mockReturnValue({
      data: {
        data: {
          total_contracted: 1_000_000,
          total_collected: 500_000,
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useRevenueTargets).mockReturnValue({
      data: {
        data: [],
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    vi.mocked(useDeleteRevenueTarget).mockReturnValue({
      mutateAsync: vi.fn(),
    } as never);

    render(
      <RevenueOverviewDashboard
        canManageTargets={false}
        departments={departments}
      />,
    );

    expect(screen.getByText('Tổng quan doanh thu')).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch doanh thu theo tháng năm 2026')).toBeInTheDocument();
  });

  it('RevenueForecastView renders forecast data from query hooks', () => {
    vi.mocked(useRevenueForecast).mockReturnValue({
      data: {
        data: {
          kpis: {
            total_expected: 2_000_000,
            total_confirmed: 1_000_000,
            total_pending: 1_000_000,
            confirmation_rate: 50,
            expiring_contracts: 0,
            expiring_value: 0,
            horizon_months: 6,
          },
          by_month: [{
            month_key: '2026-04',
            month_label: 'T04/2026',
            expected: 2_000_000,
            confirmed: 1_000_000,
            pending: 1_000_000,
            schedule_count: 3,
            contract_count: 2,
          }],
          by_contract_status: [],
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    vi.mocked(useRevenueTargetsByYears).mockReturnValue({
      data: [{
        id: 2,
        period_type: 'MONTHLY',
        period_key: '2026-04',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        dept_id: 0,
        target_type: 'TOTAL',
        target_amount: 1_500_000,
        actual_amount: 0,
        achievement_pct: 0,
        notes: null,
        approved_by: null,
        approved_at: null,
        created_by: null,
        updated_by: null,
        created_at: null,
        updated_at: null,
      }],
      isLoading: false,
      isFetching: false,
      error: null,
      queries: [],
    } as never);

    render(<RevenueForecastView departments={departments} />);

    expect(screen.getByText('Tổng kỳ vọng (6 tháng)')).toBeInTheDocument();
    expect(screen.getAllByText('2 tr').length).toBeGreaterThan(0);
    expect(screen.getByText(/KH: 1,5 tr/i)).toBeInTheDocument();
  });

  it('RevenueReportView renders rows from the report hook', () => {
    vi.mocked(useRevenueReport).mockReturnValue({
      data: {
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
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);

    render(<RevenueReportView departments={departments} />);

    expect(screen.getByText('Tổng kỳ vọng')).toBeInTheDocument();
    expect(screen.getByText('Kinh doanh số')).toBeInTheDocument();
  });
});
