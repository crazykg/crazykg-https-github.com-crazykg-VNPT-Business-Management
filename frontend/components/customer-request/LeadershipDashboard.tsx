import React from 'react';

type KpiData = {
  total_active_cases: number;
  total_hours_month: number;
  billable_percent: number;
  est_accuracy: number | null;
  completion_rate: number | null;
  open_escalations: number;
};

type TeamMember = {
  user_id: number;
  user_name: string | null;
  total_hours: number;
  billable_hours: number;
  case_count: number;
  workload_level: 'ok' | 'high' | 'overloaded';
};

type DashboardData = {
  period: string;
  kpis: KpiData;
  team_health: TeamMember[];
  comparison: (KpiData & { period: string }) | null;
};

type Props = {
  data: unknown | null;
  isLoading?: boolean;
  month: string;
  onMonthChange: (m: string) => void;
};

const WORKLOAD_BADGE: Record<string, string> = {
  ok:         'bg-emerald-100 text-emerald-700',
  high:       'bg-amber-100 text-amber-700',
  overloaded: 'bg-rose-100 text-rose-700',
};

const WORKLOAD_LABEL: Record<string, string> = {
  ok:         'Bình thường',
  high:       'Cao',
  overloaded: 'Quá tải',
};

function KpiCard({
  label, value, unit, icon, cls,
}: {
  label: string; value: string | number; unit?: string; icon: string; cls?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 ${cls ?? ''}`}>
      <span className="material-symbols-outlined text-slate-400 text-2xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-800 leading-tight">
          {value}{unit && <span className="text-sm font-medium text-slate-500 ml-1">{unit}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export function LeadershipDashboard({ data, isLoading = false, month, onMonthChange }: Props) {
  const d = data as DashboardData | null;

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-slate-700">Tháng:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {isLoading && <span className="text-xs text-slate-400">Đang tải...</span>}
      </div>

      {d && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Tổng YC đang xử lý"  value={d.kpis.total_active_cases}                         icon="task_alt" />
            <KpiCard label="Giờ tháng này"         value={d.kpis.total_hours_month.toFixed(1)} unit="h"      icon="schedule" />
            <KpiCard label="Billable%"              value={d.kpis.billable_percent.toFixed(1)}  unit="%"      icon="paid" />
            <KpiCard label="Est accuracy"           value={d.kpis.est_accuracy !== null ? d.kpis.est_accuracy.toFixed(1) : '—'} unit={d.kpis.est_accuracy !== null ? '%' : undefined} icon="calculate" />
            <KpiCard label="Tỷ lệ hoàn thành"      value={d.kpis.completion_rate !== null ? d.kpis.completion_rate.toFixed(1) : '—'} unit={d.kpis.completion_rate !== null ? '%' : undefined} icon="check_circle" />
            <KpiCard label="Escalation mở"         value={d.kpis.open_escalations}              cls={d.kpis.open_escalations > 0 ? 'border-amber-200' : ''} icon="warning" />
          </div>

          {/* Team health */}
          {d.team_health.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Sức khoẻ đội nhóm</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Tên</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Giờ tháng</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Billable</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Số YC</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.team_health.map((m) => (
                      <tr key={m.user_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800 font-medium">{m.user_name ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{m.total_hours.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{m.billable_hours.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{m.case_count}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WORKLOAD_BADGE[m.workload_level]}`}>
                            {WORKLOAD_LABEL[m.workload_level]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comparison */}
          {d.comparison && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">So sánh với tháng trước ({d.comparison.period})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  { key: 'total_hours_month', label: 'Tổng giờ', unit: 'h' },
                  { key: 'billable_percent',  label: 'Billable%', unit: '%' },
                  { key: 'completion_rate',   label: 'Hoàn thành%', unit: '%' },
                ].map(({ key, label, unit }) => {
                  const curr = d.kpis[key as keyof KpiData];
                  const prev = d.comparison![key as keyof KpiData];
                  const diff = curr !== null && prev !== null ? (curr as number) - (prev as number) : null;
                  return (
                    <div key={key} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">{label}</div>
                      <div className="font-semibold text-slate-800">
                        {curr !== null ? `${(curr as number).toFixed(1)}${unit}` : '—'}
                      </div>
                      {diff !== null && (
                        <div className={`text-xs mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}{unit}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!d && !isLoading && (
        <div className="text-sm text-slate-400 py-8 text-center">Không có dữ liệu.</div>
      )}
    </div>
  );
}
