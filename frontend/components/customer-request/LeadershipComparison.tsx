import React from 'react';

type ComparisonRow = {
  entity_id: number | null;
  entity_name: string | null;
  total_hours: number;
  billable_hours: number;
  case_count: number;
  completed_count: number;
  billable_percent: number;
  avg_est_accuracy: number;
};

type Props = {
  rows: unknown[];
  period: string;
  groupBy: string;
  onGroupByChange: (g: string) => void;
  onPeriodChange: (p: string) => void;
  isLoading?: boolean;
};

const GROUP_OPTIONS = [
  { value: 'user',     label: 'Theo thành viên' },
  { value: 'project',  label: 'Theo dự án' },
  { value: 'customer', label: 'Theo khách hàng' },
];

const ENTITY_LABELS: Record<string, string> = {
  user:     'Thành viên',
  project:  'Dự án',
  customer: 'Khách hàng',
};

export function LeadershipComparison({
  rows, period, groupBy, onGroupByChange, onPeriodChange, isLoading = false,
}: Props) {
  const typedRows = rows as ComparisonRow[];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGroupByChange(opt.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                groupBy === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          placeholder="VD: 2026-03 hoặc Q1-2026"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
        />
        {isLoading && <span className="text-xs text-slate-400">Đang tải...</span>}
      </div>

      {/* Table */}
      {typedRows.length === 0 && !isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Không có dữ liệu.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">{ENTITY_LABELS[groupBy] ?? 'Nhóm'}</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Tổng giờ</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Billable</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Bill%</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Số YC</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Hoàn thành</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Est accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {typedRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-slate-800 font-medium">{r.entity_name ?? `#${r.entity_id}`}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.total_hours.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{r.billable_hours.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.billable_percent >= 70 ? 'text-emerald-600' : r.billable_percent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {r.billable_percent.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.case_count}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.completed_count}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{r.avg_est_accuracy.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
