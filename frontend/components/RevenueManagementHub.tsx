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
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300">lock</span>
          <p className="mt-2 text-sm">Bạn không có quyền xem Quản trị Doanh thu.</p>
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
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-navigation */}
      <div className="flex-none border-b border-gray-200 bg-white">
        <div className="flex items-center px-4 gap-1 overflow-x-auto">
          {subNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              onMouseEnter={() => handlePrefetchView(item.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeView === item.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          }
        >
          {activeViewNode}
        </Suspense>
      </div>
    </div>
  );
}
