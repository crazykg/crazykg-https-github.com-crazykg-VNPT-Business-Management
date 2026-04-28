import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeeCollectionHub } from '../components/FeeCollectionHub';
import { RevenueManagementHub } from '../components/RevenueManagementHub';
import { queryClient } from '../shared/queryClient';
import { queryKeys } from '../shared/queryKeys';
import { useFeeCollectionStore } from '../shared/stores/feeCollectionStore';
import { useRevenueStore } from '../shared/stores/revenueStore';
import type { Department } from '../types';

vi.mock('../components/fee-collection/FeeCollectionDashboard', () => ({
  FeeCollectionDashboard: () => <div>Fee Dashboard</div>,
}));

vi.mock('../components/fee-collection/InvoiceList', () => ({
  InvoiceList: () => <div>Invoice List</div>,
}));

vi.mock('../components/fee-collection/ReceiptList', () => ({
  ReceiptList: () => <div>Receipt List</div>,
}));

vi.mock('../components/fee-collection/DebtAgingReport', () => ({
  DebtAgingReport: () => <div>Debt Report</div>,
}));

vi.mock('../components/revenue-mgmt/RevenueOverviewDashboard', () => ({
  RevenueOverviewDashboard: () => <div>Revenue Overview</div>,
}));

vi.mock('../components/revenue-mgmt/RevenueByContractView', () => ({
  RevenueByContractView: () => <div>Revenue By Contract</div>,
}));

vi.mock('../components/revenue-mgmt/RevenueByCollectionView', () => ({
  RevenueByCollectionView: () => <div>Revenue By Collection</div>,
}));

vi.mock('../components/revenue-mgmt/RevenueForecastView', () => ({
  RevenueForecastView: () => <div>Revenue Forecast</div>,
}));

vi.mock('../components/revenue-mgmt/RevenueReportView', () => ({
  RevenueReportView: () => <div>Revenue Report</div>,
}));

describe('navigation prefetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined as never);
    window.sessionStorage.clear();
    useFeeCollectionStore.setState({
      activeView: 'DASHBOARD',
      periodFrom: '2026-04-01',
      periodTo: '2026-04-30',
    });
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans legacy revenue query params on mount while preserving the screen state', () => {
    const departments = [{ id: 1, dept_name: 'Kinh doanh số' } as Department];

    window.history.replaceState(
      {},
      '',
      '/?tab=revenue_mgmt&rev_view=REPORT&rev_report_tab=time&rev_horizon=12&rev_period_type=YEARLY&rev_grouping=quarter'
    );

    render(
      <RevenueManagementHub
        canRead
        canManageTargets
        departments={departments}
      />,
    );

    expect(window.location.search).toBe('?tab=revenue_mgmt');
    expect(useRevenueStore.getState()).toMatchObject({
      activeView: 'REPORT',
      reportTab: 'time',
      forecastHorizon: 12,
      periodType: 'YEARLY',
      grouping: 'quarter',
    });
  });

  it('prefetches fee-collection list queries when hovering sub-view tabs', () => {
    window.history.replaceState(
      {},
      '',
      '/fee-collection?fc_view=INVOICES&fc_period_from=2026-01-01&fc_period_to=2026-12-31'
    );

    render(
      <FeeCollectionHub
        contracts={[]}
        customers={[]}
        currentUser={null}
      />,
    );

    expect(window.location.search).toBe('');

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Hóa đơn/i }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Phiếu thu/i }));

    expect(queryClient.prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: queryKeys.invoices.list({
        page: 1,
        per_page: 25,
        sort_key: 'invoice_date',
        sort_dir: 'desc',
        customer_id: undefined,
        status: undefined,
      }),
    }));
    expect(queryClient.prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: queryKeys.receipts.list({
        page: 1,
        per_page: 25,
        sort_key: 'receipt_date',
        sort_dir: 'desc',
      }),
    }));
  });

  it('hydrates fee-collection custom preset with the current month range instead of the active preset range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T08:00:00.000Z'));
    useFeeCollectionStore.setState({
      activeView: 'DASHBOARD',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
    });

    render(
      <FeeCollectionHub
        contracts={[]}
        customers={[]}
        currentUser={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));

    expect(screen.getByLabelText('Kỳ thu từ')).toHaveValue('2026-04-01');
    expect(screen.getByLabelText('Kỳ thu đến')).toHaveValue('2026-04-30');
    expect(useFeeCollectionStore.getState()).toMatchObject({
      periodFrom: '2026-04-01',
      periodTo: '2026-04-30',
    });
  });

  it('prefetches revenue overview and forecast queries on hover without preloading report', () => {
    const departments = [{ id: 1, dept_name: 'Kinh doanh số' } as Department];

    render(
      <RevenueManagementHub
        canRead
        canManageTargets
        departments={departments}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Tổng quan$/ }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Dự báo$/ }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Báo cáo$/ }));

    expect(queryClient.prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: queryKeys.revenue.overview({
        period_from: '2026-01-01',
        period_to: '2026-12-31',
        grouping: 'month',
        dept_id: undefined,
      }),
    }));
    expect(queryClient.prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: queryKeys.revenue.forecast({
        horizon_months: 6,
        dept_id: undefined,
      }),
    }));
    expect(queryClient.prefetchQuery).not.toHaveBeenCalledWith(expect.objectContaining({
      queryKey: queryKeys.revenue.report({
        period_from: '2026-01-01',
        period_to: '2026-12-31',
        dimension: 'department',
        dept_id: undefined,
      }),
    }));
  });
});
