import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useRevenueStore } from '../shared/stores/revenueStore';
import {
  fetchRevenueForecast,
  fetchRevenueOverview,
  fetchRevenueReport,
  fetchRevenueTargets,
} from '../services/v5Api';
import { queryClient } from '../shared/queryClient';
import { queryKeys } from '../shared/queryKeys';
import { RevenueOverviewDashboard } from './revenue-mgmt/RevenueOverviewDashboard';
import { RevenueByContractView } from './revenue-mgmt/RevenueByContractView';
import { RevenueByCollectionView } from './revenue-mgmt/RevenueByCollectionView';
import { RevenueForecastView } from './revenue-mgmt/RevenueForecastView';
import { RevenueReportView } from './revenue-mgmt/RevenueReportView';
import type { Department, RevenueSubView } from '../types';

interface Props {
  canRead: boolean;
  canManageTargets: boolean;
  departments: Department[];
}

const REVENUE_SUB_NAV_ITEMS = [
  { id: 'OVERVIEW', icon: 'dashboard', label: 'Tổng quan' },
  { id: 'BY_CONTRACT', icon: 'contract', label: 'Theo hợp đồng' },
  { id: 'BY_COLLECTION', icon: 'receipt_long', label: 'Theo thu cước' },
  { id: 'FORECAST', icon: 'trending_up', label: 'Dự báo' },
  { id: 'REPORT', icon: 'bar_chart', label: 'Báo cáo' },
] as const satisfies ReadonlyArray<{ id: RevenueSubView; icon: string; label: string }>;

export function RevenueManagementHub({ canRead, canManageTargets, departments }: Props) {
  const {
    activeView,
    forecastHorizon,
    grouping,
    periodFrom,
    periodTo,
    periodType,
    reportTab,
    selectedDeptId,
    setActiveView,
    syncFromUrl,
    year,
  } = useRevenueStore();

  // Restore state from URL on mount
  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  if (!canRead) {
    return (
      <div className="p-3 pb-6">
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="text-center">
            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 34 }}>lock</span>
            <p className="mt-2 text-sm font-semibold text-slate-700">Bạn không có quyền xem Quản trị Doanh thu.</p>
          </div>
        </div>
      </div>
    );
  }

  const subNavItems = REVENUE_SUB_NAV_ITEMS;

  const handleViewChange = useCallback((view: typeof activeView) => {
    setActiveView(view);
  }, [setActiveView]);

  const handlePrefetchView = useCallback((view: RevenueSubView) => {
    if (view === 'OVERVIEW') {
      const overviewFilters = {
        period_from: periodFrom,
        period_to: periodTo,
        grouping,
        dept_id: selectedDeptId ?? undefined,
      };
      const targetsFilters = {
        period_type: periodType,
        year,
        dept_id: selectedDeptId ?? undefined,
      };

      void queryClient.prefetchQuery({
        queryKey: queryKeys.revenue.overview(overviewFilters),
        queryFn: () => fetchRevenueOverview(overviewFilters),
        staleTime: 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.revenue.targets(targetsFilters),
        queryFn: () => fetchRevenueTargets(targetsFilters),
        staleTime: 60_000,
      });
      return;
    }

    if (view === 'FORECAST') {
      const forecastFilters = {
        horizon_months: forecastHorizon,
        dept_id: selectedDeptId ?? undefined,
      };

      void queryClient.prefetchQuery({
        queryKey: queryKeys.revenue.forecast(forecastFilters),
        queryFn: () => fetchRevenueForecast(forecastFilters),
        staleTime: 60_000,
      });
      return;
    }

    if (view === 'REPORT') {
      const reportFilters = {
        period_from: periodFrom,
        period_to: periodTo,
        dimension: reportTab,
        dept_id: selectedDeptId ?? undefined,
      };

      void queryClient.prefetchQuery({
        queryKey: queryKeys.revenue.report(reportFilters),
        queryFn: () => fetchRevenueReport(reportFilters),
        staleTime: 60_000,
      });
    }
  }, [forecastHorizon, grouping, periodFrom, periodTo, periodType, reportTab, selectedDeptId, year]);

  const activeViewNode = useMemo(() => {
    if (activeView === 'OVERVIEW') {
      return (
        <RevenueOverviewDashboard
          canManageTargets={canManageTargets}
          departments={departments}
        />
      );
    }

    if (activeView === 'BY_CONTRACT') {
      return <RevenueByContractView departments={departments} />;
    }

    if (activeView === 'BY_COLLECTION') {
      return <RevenueByCollectionView />;
    }

    if (activeView === 'FORECAST') {
      return <RevenueForecastView departments={departments} />;
    }

    return <RevenueReportView departments={departments} />;
  }, [activeView, canManageTargets, departments]);

  return (
    <div className="flex h-full min-h-0 flex-col p-3 pb-6">
      <div className="flex-none overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                  monitoring
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Revenue Management</p>
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Quản trị doanh thu</h2>
                <p className="text-[11px] leading-tight text-slate-400">
                  Theo dõi kế hoạch, thực thu, dự báo và báo cáo doanh thu theo từng lát cắt vận hành.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {subNavItems.find((item) => item.id === activeView)?.label || 'Tổng quan'}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {year}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {periodFrom} &rarr; {periodTo}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-slate-50/60 px-3 py-3">
          <div className="flex min-w-max items-center gap-2">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                onMouseEnter={() => handlePrefetchView(item.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
                  activeView === item.id
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0 overflow-auto">
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 16 }}>
                  progress_activity
                </span>
                Đang tải dữ liệu doanh thu...
              </div>
            </div>
          }
        >
          {activeViewNode}
        </Suspense>
      </div>
    </div>
  );
}
