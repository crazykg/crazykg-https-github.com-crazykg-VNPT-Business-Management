import { Suspense, useEffect } from 'react';
import { useRevenueStore } from '../shared/stores/revenueStore';
import { RevenueOverviewDashboard } from './revenue-mgmt/RevenueOverviewDashboard';
import { RevenueByContractView } from './revenue-mgmt/RevenueByContractView';
import { RevenueByCollectionView } from './revenue-mgmt/RevenueByCollectionView';
import { RevenueForecastView } from './revenue-mgmt/RevenueForecastView';
import { RevenueReportView } from './revenue-mgmt/RevenueReportView';
import type { Department } from '../types';

interface Props {
  canRead: boolean;
  canManageTargets: boolean;
  departments: Department[];
}

export function RevenueManagementHub({ canRead, canManageTargets, departments }: Props) {
  const { activeView, setActiveView, syncFromUrl } = useRevenueStore();

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

  const subNavItems: Array<{ id: typeof activeView; icon: string; label: string }> = [
    { id: 'OVERVIEW', icon: 'dashboard', label: 'Tổng quan' },
    { id: 'BY_CONTRACT', icon: 'contract', label: 'Theo hợp đồng' },
    { id: 'BY_COLLECTION', icon: 'receipt_long', label: 'Theo thu cước' },
    { id: 'FORECAST', icon: 'trending_up', label: 'Dự báo' },
    { id: 'REPORT', icon: 'bar_chart', label: 'Báo cáo' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-navigation */}
      <div className="flex-none border-b border-gray-200 bg-white">
        <div className="flex items-center px-4 gap-1 overflow-x-auto">
          {subNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
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
          {activeView === 'OVERVIEW' && (
            <RevenueOverviewDashboard
              canManageTargets={canManageTargets}
              departments={departments}
            />
          )}

          {activeView === 'BY_CONTRACT' && (
            <RevenueByContractView departments={departments} />
          )}

          {activeView === 'BY_COLLECTION' && (
            <RevenueByCollectionView />
          )}

          {activeView === 'FORECAST' && (
            <RevenueForecastView departments={departments} />
          )}

          {activeView === 'REPORT' && (
            <RevenueReportView departments={departments} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
