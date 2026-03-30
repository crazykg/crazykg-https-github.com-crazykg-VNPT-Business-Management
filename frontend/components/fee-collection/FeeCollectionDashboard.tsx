import React, { useEffect } from 'react';
import { useFeeCollectionDashboard } from '../../shared/hooks/useFeeCollection';
import { FeeCollectionDashboard as DashboardData, FeeCollectionKpis } from '../../types';

function fmtVnd(v: number | undefined | null): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ đ';
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr đ';
  return v.toLocaleString('vi-VN') + ' đ';
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string | number;
  subText?: string;
  accent?: 'default' | 'green' | 'red' | 'orange' | 'blue';
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, subText, accent = 'default' }) => {
  const accentClasses: Record<string, string> = {
    default: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    orange: 'text-orange-600 bg-orange-50',
    blue: 'text-blue-700 bg-blue-100',
  };
  const valClasses: Record<string, string> = {
    default: 'text-gray-800',
    green: 'text-green-700',
    red: 'text-red-700',
    orange: 'text-orange-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-start gap-3">
      <div className={`rounded-lg p-2 flex-shrink-0 ${accentClasses[accent]}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className={`text-lg font-bold leading-tight mt-0.5 ${valClasses[accent]}`}>{value}</p>
        {subText && <p className="text-xs text-gray-400 mt-0.5">{subText}</p>}
      </div>
    </div>
  );
};

interface Props {
  periodFrom: string;
  periodTo: string;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
  onNavigateToInvoices?: (filter?: { customer_id?: number; status?: string }) => void;
}

export const FeeCollectionDashboard: React.FC<Props> = React.memo(function FeeCollectionDashboardComponent({ periodFrom, periodTo, onNotify, onNavigateToInvoices }) {
  const {
    data: dashboardResponse,
    isLoading: loading,
    error,
  } = useFeeCollectionDashboard({
    period_from: periodFrom,
    period_to: periodTo,
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    onNotify('error', 'Lỗi', error instanceof Error ? error.message : 'Không tải được dashboard');
  }, [error, onNotify]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>Đang tải dashboard...
      </div>
    );
  }

  const data: DashboardData | null = dashboardResponse?.data ?? null;
  if (!data) return null;

  const kpis: FeeCollectionKpis = data.kpis ?? { expected_revenue: 0, actual_collected: 0, outstanding: 0, overdue_amount: 0, overdue_count: 0, collection_rate: 0, avg_days_to_collect: 0 };
  const byMonth = data.by_month ?? [];

  // Bar chart
  const BarChart: React.FC = () => {
    if (byMonth.length === 0) return <div className="text-center text-gray-400 text-xs py-6">Không có dữ liệu</div>;
    const W = 580, H = 160, PAD_L = 56, PAD_R = 16, PAD_T = 12, PAD_B = 36;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const maxVal = Math.max(...byMonth.flatMap((m) => [m.invoiced, m.collected]), 1);
    const BAR_GROUP = innerW / byMonth.length;
    const BAR_W = Math.max(8, BAR_GROUP * 0.35);
    const yScale = (v: number) => innerH - (v / maxVal) * innerH;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280, height: H }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + yScale(maxVal * t);
          return (
            <g key={t}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
                {fmtVnd(maxVal * t)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {byMonth.map((m, i) => {
          const cx = PAD_L + i * BAR_GROUP + BAR_GROUP / 2;
          const hExp = ((m.invoiced / maxVal) * innerH) || 0;
          const hAct = ((m.collected / maxVal) * innerH) || 0;
          return (
            <g key={m.month_key}>
              <rect x={cx - BAR_W - 1} y={PAD_T + yScale(m.invoiced)} width={BAR_W} height={hExp} fill="#bfdbfe" rx={2} />
              <rect x={cx + 1} y={PAD_T + yScale(m.collected)} width={BAR_W} height={hAct} fill="#22c55e" rx={2} />
              <text x={cx} y={H - 4} textAnchor="middle" fontSize={9} fill="#6b7280">{m.month_label}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon="monetization_on" label="Doanh thu kỳ" value={fmtVnd(kpis.expected_revenue)} accent="blue" />
        <KpiCard icon="payments" label="Đã thu" value={fmtVnd(kpis.actual_collected)} accent="green" />
        <KpiCard icon="account_balance_wallet" label="Còn nợ" value={fmtVnd(kpis.outstanding)} accent={kpis.outstanding > 0 ? 'orange' : 'default'} />
        <KpiCard icon="warning" label="Quá hạn" value={fmtVnd(kpis.overdue_amount)} subText={`${kpis.overdue_count} hóa đơn`} accent={kpis.overdue_count > 0 ? 'red' : 'default'} />
        <KpiCard icon="percent" label="Tỷ lệ thu" value={`${kpis.collection_rate}%`} accent={kpis.collection_rate >= 90 ? 'green' : kpis.collection_rate >= 70 ? 'orange' : 'red'} />
        <KpiCard icon="schedule" label="TB ngày thu" value={`${kpis.avg_days_to_collect} ngày`} accent="default" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Doanh thu dự kiến vs Thực thu</h2>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200" />Dự kiến</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500" />Thực thu</span>
            </div>
          </div>
          <BarChart />
        </div>

        {/* Top debtors */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Top 5 khách hàng nợ nhiều nhất</h2>
            {onNavigateToInvoices && (
              <button onClick={() => onNavigateToInvoices()} className="text-xs text-blue-600 hover:underline">Xem tất cả</button>
            )}
          </div>
          {(data.top_debtors ?? []).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">Không có công nợ</div>
          ) : (
            <div className="space-y-2">
              {(data.top_debtors ?? []).slice(0, 5).map((d, i) => (
                <div key={d.customer_id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
                  onClick={() => onNavigateToInvoices?.({ customer_id: d.customer_id })}>
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{d.customer_name}</p>
                    <p className="text-xs text-gray-400">{d.invoice_count} hóa đơn</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-red-600">{fmtVnd(d.total_outstanding)}</p>
                    {d.overdue_amount > 0 && <p className="text-xs text-red-400">QH: {fmtVnd(d.overdue_amount)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Urgent overdue */}
      {(data.urgent_overdue ?? []).length > 0 && (
        <div className="bg-white rounded-lg border border-red-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-red-700 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">warning</span>
              Hóa đơn quá hạn cần xử lý
            </h2>
            {onNavigateToInvoices && (
              <button onClick={() => onNavigateToInvoices({ status: 'OVERDUE' })} className="text-xs text-red-600 hover:underline">
                Xem tất cả quá hạn
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="pb-1 text-left font-medium">Hóa đơn</th>
                  <th className="pb-1 text-left font-medium">Khách hàng</th>
                  <th className="pb-1 text-right font-medium">Số tiền</th>
                  <th className="pb-1 text-right font-medium">Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {(data.urgent_overdue ?? []).slice(0, 5).map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 font-mono text-blue-600">{inv.invoice_code}</td>
                    <td className="py-1.5 text-gray-700">{inv.customer_name}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{fmtVnd(inv.outstanding)}</td>
                    <td className="py-1.5 text-right font-bold text-red-600">{inv.days_overdue} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});
