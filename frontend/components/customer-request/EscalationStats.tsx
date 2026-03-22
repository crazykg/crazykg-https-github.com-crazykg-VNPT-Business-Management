import React from 'react';

type EscalationStatsData = {
  total: number;
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  avg_resolution_days: number | null;
  recent_critical: unknown[];
};

type Props = {
  stats: unknown | null;
  isLoading?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  technical:    'Kỹ thuật',
  resource:     'Nguồn lực',
  customer:     'Khách hàng',
  scope_change: 'Thay đổi phạm vi',
  dependency:   'Phụ thuộc',
  sla_risk:     'Nguy cơ SLA',
};

export function EscalationStats({ stats, isLoading = false }: Props) {
  const s = stats as EscalationStatsData | null;

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-6 text-center">Đang tải thống kê...</div>;
  }
  if (!s) {
    return <div className="text-sm text-slate-400 py-6 text-center">Không có dữ liệu.</div>;
  }

  const byStatus   = s.by_status   ?? {};
  const bySeverity = s.by_severity ?? {};
  const byType     = s.by_type     ?? {};
  const maxType    = Math.max(1, ...Object.values(byType).map(Number));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{s.total}</div>
          <div className="text-xs text-slate-500 mt-1">Tổng escalation</div>
        </div>
        <div className="bg-white border border-indigo-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-700">{byStatus.pending ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Chờ duyệt</div>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{byStatus.reviewing ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Đang xem xét</div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{byStatus.resolved ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Đã giải quyết</div>
        </div>
      </div>

      {/* Avg resolution */}
      {s.avg_resolution_days !== null && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400 text-xl">timer</span>
          <span className="text-sm text-slate-600">
            Thời gian xử lý trung bình:{' '}
            <span className="font-semibold text-slate-800">{s.avg_resolution_days} ngày</span>
          </span>
        </div>
      )}

      {/* By type bar chart */}
      {Object.keys(byType).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Phân bổ theo loại</h3>
          <div className="space-y-2">
            {Object.entries(byType)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([type, count]) => {
                const pct = Math.round(((count as number) / maxType) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-36 truncate">{TYPE_LABEL[type] ?? type}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-6 text-right">{count as number}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* By severity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const clsMap: Record<string, string> = {
            critical: 'border-rose-200 text-rose-700',
            high:     'border-orange-200 text-orange-700',
            medium:   'border-amber-200 text-amber-700',
            low:      'border-slate-200 text-slate-500',
          };
          const labels: Record<string, string> = {
            critical: 'Nghiêm trọng', high: 'Cao', medium: 'Trung bình', low: 'Thấp',
          };
          return (
            <div key={sev} className={`bg-white border rounded-xl p-3 text-center ${clsMap[sev]}`}>
              <div className="text-xl font-bold">{bySeverity[sev] ?? 0}</div>
              <div className="text-xs mt-0.5">{labels[sev]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
