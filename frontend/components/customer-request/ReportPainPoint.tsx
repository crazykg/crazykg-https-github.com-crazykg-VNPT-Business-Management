import React, { useState } from 'react';
import type { PainPointsData } from '../../types';

type Props = {
  data: PainPointsData | null;
  month: string;
  isLoading?: boolean;
};

type SectionKey = keyof PainPointsData;

const SECTIONS: Array<{ key: SectionKey; label: string; icon: string }> = [
  { key: 'overloaded_users',   label: 'Nhân sự quá tải (>38h/tuần ≥2 tuần liền)',      icon: 'warning' },
  { key: 'low_billable_users', label: 'Billable thấp (<70%, >10h)',                      icon: 'trending_down' },
  { key: 'estimate_variance',  label: 'Estimate sai lệch (>30%)',                        icon: 'calculate' },
  { key: 'long_running_cases', label: 'YC kéo dài (>14 ngày chưa đóng)',                icon: 'hourglass_empty' },
  { key: 'status_stuck',       label: 'YC bị treo (>5 ngày không worklog)',              icon: 'pause_circle' },
  { key: 'meeting_heavy',      label: 'Họp nhiều (MEETING >15% giờ)',                   icon: 'groups' },
  { key: 'top_customer_load',  label: 'Top 5 khách hàng theo giờ',                      icon: 'leaderboard' },
];

export function ReportPainPoint({ data, month, isLoading = false }: Props) {
  const [open, setOpen] = useState<Partial<Record<SectionKey, boolean>>>({});

  const toggle = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-500">Tháng: <span className="font-medium text-slate-700">{month}</span></div>
      {isLoading && <div className="text-sm text-slate-400">Đang phân tích dữ liệu...</div>}

      {SECTIONS.map(({ key, label, icon }) => {
        const items: unknown[] = data?.[key] ?? [];
        const count  = items.length;
        const isOpen = open[key] ?? false;

        return (
          <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-lg text-slate-500">{icon}</span>
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {count}
              </span>
              <span className="material-symbols-outlined text-slate-400 text-sm">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && count > 0 && (
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

            {isOpen && count === 0 && (
              <div className="px-4 py-2 text-xs text-slate-400 bg-white">Không có vấn đề.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
