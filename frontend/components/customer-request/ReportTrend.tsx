import React from 'react';

type TrendRow = {
  month: string;
  total_hours: number;
  billable_percent: number;
  est_accuracy: number;
  sla_breach_count: number;
  backlog_count: number;
};

type Props = {
  rows: unknown[];
  months: number;
  onMonthsChange: (n: number) => void;
  isLoading?: boolean;
};

const billableClass = (pct: number) =>
  pct >= 70 ? 'text-emerald-600 font-semibold' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';

const accuracyClass = (pct: number) =>
  pct >= 80 ? 'text-emerald-600 font-semibold' : pct >= 60 ? 'text-amber-600' : 'text-rose-600';

export function ReportTrend({ rows, months, onMonthsChange, isLoading = false }: Props) {
  const trendRows = rows as TrendRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-slate-700">Số tháng:</label>
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onMonthsChange(n)}
            className={`px-3 py-1 rounded-lg text-sm border transition-colors ${months === n ? 'bg-primary text-white border-primary' : 'border-slate-300 text-slate-600 hover:border-primary/50'}`}
          >
            {n} tháng
          </button>
        ))}
        {isLoading && <span className="text-xs text-slate-400">Đang tải...</span>}
      </div>

      {trendRows.length === 0 && !isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Không có dữ liệu.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Tháng</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Tổng giờ</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Billable%</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Est accuracy%</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">SLA vi phạm</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Tồn đọng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trendRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-800">{r.month}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.total_hours.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right ${billableClass(r.billable_percent)}`}>
                    {r.billable_percent.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 text-right ${accuracyClass(r.est_accuracy)}`}>
                    {r.est_accuracy.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 text-right ${r.sla_breach_count > 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                    {r.sla_breach_count}
                  </td>
                  <td className={`px-3 py-2 text-right ${r.backlog_count > 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {r.backlog_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
