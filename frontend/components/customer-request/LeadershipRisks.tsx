import React, { useState } from 'react';

type RisksData = {
  personnel_overload:     unknown[];
  sla_at_risk:            unknown[];
  stalled_cases:          unknown[];
  unreviewed_escalations: number;
  low_billable_teams:     unknown[];
};

type Props = {
  risks: unknown | null;
  isLoading?: boolean;
};

type SectionKey = keyof Omit<RisksData, 'unreviewed_escalations'>;

const SECTIONS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'personnel_overload',     label: 'Nhân sự quá tải (>38h tuần này)',     icon: 'person_alert' },
  { key: 'sla_at_risk',            label: 'SLA nguy cơ (<3 ngày, chưa đóng)',    icon: 'timer_off' },
  { key: 'stalled_cases',          label: 'YC bị treo (>5 ngày không worklog)',  icon: 'pause_circle' },
  { key: 'unreviewed_escalations', label: 'Escalation chờ duyệt (>2 ngày)',      icon: 'warning' },
  { key: 'low_billable_teams',     label: 'Billable thấp (<60% tháng này)',       icon: 'trending_down' },
];

export function LeadershipRisks({ risks, isLoading = false }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const r = risks as RisksData | null;

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-6 text-center">Đang phân tích rủi ro...</div>;
  }

  return (
    <div className="space-y-3">
      {SECTIONS.map(({ key, label, icon }) => {
        const raw   = r ? (key === 'unreviewed_escalations' ? r.unreviewed_escalations : r[key as SectionKey]) : null;
        const count = typeof raw === 'number' ? raw : Array.isArray(raw) ? raw.length : 0;
        const items = Array.isArray(raw) ? raw : [];
        const isOpen = open[key] ?? false;

        const badgeCls = count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700';

        return (
          <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-lg text-slate-500">{icon}</span>
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>
                {count}
              </span>
              <span className="material-symbols-outlined text-slate-400 text-sm">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && items.length > 0 && (
              <div className="divide-y divide-slate-100 bg-white">
                {items.map((item, i) => {
                  const row = item as Record<string, unknown>;
                  return (
                    <div key={i} className="px-4 py-2 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(row).map(([k, v]) => (
                        <span key={k}>
                          <span className="text-slate-400">{k}:</span>{' '}
                          <span className="font-medium">{v !== null && v !== undefined ? String(v) : '—'}</span>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && items.length === 0 && typeof raw !== 'number' && (
              <div className="px-4 py-2 text-xs text-slate-400 bg-white">Không có rủi ro.</div>
            )}

            {isOpen && typeof raw === 'number' && (
              <div className={`px-4 py-2 text-xs bg-white ${raw > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                {raw > 0 ? `${raw} escalation đang chờ duyệt quá 2 ngày.` : 'Không có.'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
