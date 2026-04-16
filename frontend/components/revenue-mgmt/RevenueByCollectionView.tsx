import { useState, useEffect, useCallback } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import { fetchRevenueByCollection } from '../../services/v5Api';
import type { FeeCollectionDashboard, FeeCollectionKpis } from '../../types';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
} from '../../utils/revenueDisplay';
import { RevenueWorkspaceHeader } from './RevenueWorkspaceHeader';

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function RevenueByCollectionView() {
  const { periodFrom, periodTo } = useRevenueStore();
  const addToast = useToastStore((s) => s.addToast);

  const [data, setData] = useState<FeeCollectionDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchRevenueByCollection({
        period_from: periodFrom,
        period_to: periodTo,
      });
      // API returns { data: FeeCollectionDashboard } — unwrap
      setData(res.data);
    } catch {
      addToast('error', 'Lỗi', 'Không thể tải dữ liệu thu cước.');
    } finally {
      setIsLoading(false);
    }
  }, [periodFrom, periodTo, addToast]);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p className="text-sm">Không có dữ liệu.</p>
      </div>
    );
  }

  const kpis: FeeCollectionKpis = data.kpis;

  return (
    <div className="space-y-4 p-3 pb-6">
      <RevenueWorkspaceHeader
        icon="receipt_long"
        title="Theo thu cước"
        description="Theo dõi phát hành, thực thu, nợ quá hạn và nhóm khách hàng cần ưu tiên xử lý trong kỳ."
        badges={[
          {
            label: formatDateRangeDdMmYyyy(periodFrom, periodTo),
            icon: 'date_range',
            tone: 'primary',
          },
          {
            label: 'Theo dõi hóa đơn và công nợ',
            icon: 'payments',
            tone: 'neutral',
          },
        ]}
        metrics={[
          {
            label: 'Phát hành trong kỳ',
            value: formatCompactCurrencyVnd(kpis.expected_revenue),
            detail: 'Tổng giá trị hóa đơn phát hành trong khoảng đang xem.',
            tone: 'primary',
          },
          {
            label: 'Đã thu trong kỳ',
            value: formatCompactCurrencyVnd(kpis.actual_collected),
            detail: `Tỷ lệ thu ${kpis.collection_rate}%`,
            tone: 'success',
          },
          {
            label: 'Nợ quá hạn',
            value: formatCompactCurrencyVnd(kpis.overdue_amount),
            detail: `${kpis.overdue_count} hóa đơn cần ưu tiên xử lý.`,
            tone: kpis.overdue_amount > 0 ? 'warning' : 'success',
          },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Phát hành trong kỳ', value: formatCompactCurrencyVnd(kpis.expected_revenue), icon: 'receipt_long', color: '' },
          { label: 'Đã thu trong kỳ', value: formatCompactCurrencyVnd(kpis.actual_collected), icon: 'payments', color: 'text-green-600' },
          { label: 'Tỷ lệ thu', value: kpis.collection_rate + '%', icon: 'percent', color: pctColor(kpis.collection_rate) },
          { label: 'TB ngày thu', value: kpis.avg_days_to_collect.toFixed(1) + ' ngày', icon: 'schedule', color: '' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
              {k.label}
            </div>
            <div className={`text-lg font-semibold ${k.color || 'text-gray-900'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Balance row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Tổng dư nợ</div>
          <div className="text-lg font-semibold text-gray-900">{formatCurrencyVnd(kpis.outstanding)}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-3">
          <div className="text-xs text-red-500 mb-1">Nợ quá hạn</div>
          <div className="text-lg font-semibold text-red-600">{formatCurrencyVnd(kpis.overdue_amount)}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-3">
          <div className="text-xs text-red-500 mb-1">Số HĐ quá hạn</div>
          <div className="text-lg font-semibold text-red-600">{kpis.overdue_count}</div>
        </div>
      </div>

      {/* By Month Chart (simple table visualization) */}
      {data.by_month && data.by_month.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Thu cước theo tháng</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Tháng</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Phát hành</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Đã thu</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">Tồn cuối kỳ</th>
                </tr>
              </thead>
              <tbody>
                {data.by_month.map((m) => (
                  <tr key={m.month_key} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{m.month_label}</td>
                    <td className="px-3 py-2 text-right">{formatCurrencyVnd(m.invoiced)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{formatCurrencyVnd(m.collected)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCurrencyVnd(m.outstanding_eom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Debtors */}
      {data.top_debtors && data.top_debtors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top khách hàng nợ nhiều nhất</h3>
          <div className="space-y-2">
            {data.top_debtors.map((d, i) => (
              <div key={d.customer_id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.customer_name}</p>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>Nợ: <strong className="text-red-600">{formatCurrencyVnd(d.total_outstanding)}</strong></span>
                    {d.overdue_amount > 0 && (
                      <span>Quá hạn: <strong className="text-red-700">{formatCurrencyVnd(d.overdue_amount)}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent overdue */}
      {data.urgent_overdue && data.urgent_overdue.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-700 mb-3">
            <span className="material-symbols-outlined text-[16px] mr-1 align-text-bottom">warning</span>
            Hóa đơn quá hạn cần xử lý
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="text-left px-3 py-1 text-red-700 font-medium">Mã HĐ</th>
                  <th className="text-left px-3 py-1 text-red-700 font-medium">Khách hàng</th>
                  <th className="text-right px-3 py-1 text-red-700 font-medium">Số ngày</th>
                  <th className="text-right px-3 py-1 text-red-700 font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {data.urgent_overdue.map((u) => (
                  <tr key={u.invoice_id} className="border-t border-red-100">
                    <td className="px-3 py-1 text-red-800 font-medium">{u.invoice_code}</td>
                    <td className="px-3 py-1">{u.customer_name}</td>
                    <td className="px-3 py-1 text-right font-bold text-red-700">{u.days_overdue} ngày</td>
                    <td className="px-3 py-1 text-right">{formatCurrencyVnd(u.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
