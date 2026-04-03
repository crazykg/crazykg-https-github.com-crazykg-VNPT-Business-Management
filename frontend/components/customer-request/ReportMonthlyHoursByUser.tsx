import React from 'react';
import type { MonthlyHoursRow } from '../../types/customerRequest';

type Props = {
  rows: MonthlyHoursRow[];
  month: string;
  onMonthChange: (m: string) => void;
  isLoading?: boolean;
};

export function ReportMonthlyHoursByUser({ rows, month, onMonthChange, isLoading = false }: Props) {
  const maxHours = rows.reduce((m, r) => Math.max(m, r.total_hours), 0.01);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-slate-700">Tháng:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {isLoading && (
          <span className="text-xs text-slate-400">Đang tải...</span>
        )}
      </div>

      {rows.length === 0 && !isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Không có dữ liệu cho tháng này.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Thành viên</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Tổng giờ</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Billable</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Non-bill</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Estimate</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Số YC</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Hoàn thành</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Bill%</th>
                <th className="px-3 py-2 font-semibold text-slate-600 min-w-[140px]">Biểu đồ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const billPct = r.total_hours > 0 ? r.billable_hours / r.total_hours : 0;
                const nonBillPct = r.total_hours > 0 ? r.non_billable_hours / r.total_hours : 0;
                const barTotalW = Math.round((r.total_hours / maxHours) * 100);

                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-slate-800 font-medium">{r.user_name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.total_hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{r.billable_hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">{r.non_billable_hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.estimated_hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.request_count}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.completed_count}</td>
                    <td className={`px-3 py-2 text-right font-medium ${billPct >= 0.7 ? 'text-emerald-600' : billPct >= 0.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {(billPct * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-4 rounded overflow-hidden bg-slate-100" style={{ width: `${barTotalW}%`, minWidth: '8px' }}>
                        <div className="bg-emerald-500" style={{ width: `${billPct * 100}%` }} title={`Billable: ${r.billable_hours.toFixed(1)}h`} />
                        <div className="bg-amber-400" style={{ width: `${nonBillPct * 100}%` }} title={`Non-billable: ${r.non_billable_hours.toFixed(1)}h`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
