import React, { useMemo } from 'react';
import type { CustomerRequestPlan, CustomerRequestPlanItem } from '../../types';

const ACTUAL_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Đang xử lý', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  carried_over: { label: 'Chuyển kỳ', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Huỷ', cls: 'bg-rose-100 text-rose-500' },
};

const CHIP_STATUS_CLS: Record<string, string> = {
  pending: 'bg-slate-200 text-slate-700',
  in_progress: 'bg-blue-200 text-blue-800',
  completed: 'bg-emerald-200 text-emerald-800',
  carried_over: 'bg-amber-200 text-amber-800',
  cancelled: 'bg-rose-100 text-rose-600 line-through',
};

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const PLAN_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Đã nộp', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700' },
};

type CustomerRequestPlanWeeklyProps = {
  plan: CustomerRequestPlan;
  items: CustomerRequestPlanItem[];
  onItemClick?: (item: CustomerRequestPlanItem) => void;
};

export const CustomerRequestPlanWeekly: React.FC<CustomerRequestPlanWeeklyProps> = ({
  plan,
  items,
  onItemClick,
}) => {
  const statusMeta = PLAN_STATUS_META[plan.status] ?? { label: plan.status, cls: 'bg-slate-100 text-slate-600' };

  // Parse week label from period_start
  const weekLabel = useMemo(() => {
    if (!plan.period_start) return plan.plan_code;
    const start = new Date(plan.period_start);
    const end = plan.period_end ? new Date(plan.period_end) : null;
    const weekNum = plan.plan_code.match(/W(\d+)$/)?.[1] ?? '';
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (end) {
      return `Tuần ${weekNum}: ${fmt(start)} – ${fmt(end)}/${end.getFullYear()}`;
    }
    return `Tuần ${weekNum}: ${fmt(start)}`;
  }, [plan]);

  // Build performer → day map
  const performers = useMemo(() => {
    const map = new Map<string, { name: string; days: CustomerRequestPlanItem[][] }>();
    for (const item of items) {
      const key = String(item.performer_user_id ?? 'unknown');
      const name = item.performer_name ?? `Người dùng ${key}`;
      if (!map.has(key)) {
        map.set(key, { name, days: Array.from({ length: 7 }, () => []) });
      }
      // Place item in day column based on planned_start_date
      const dayIndex = item.planned_start_date
        ? (new Date(item.planned_start_date).getDay() + 6) % 7 // Mon=0
        : 0;
      map.get(key)!.days[dayIndex].push(item);
    }
    return Array.from(map.values());
  }, [items]);

  // Daily total planned hours
  const dailyTotals = useMemo(() => {
    const totals = Array<number>(7).fill(0);
    for (const item of items) {
      const dayIndex = item.planned_start_date
        ? (new Date(item.planned_start_date).getDay() + 6) % 7
        : 0;
      totals[dayIndex] += item.planned_hours;
    }
    return totals;
  }, [items]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold text-slate-800">{weekLabel}</h3>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
        {plan.dispatcher_name && (
          <span className="text-sm text-slate-500">
            <span className="material-symbols-outlined align-middle text-[15px] text-slate-400">
              manage_accounts
            </span>{' '}
            {plan.dispatcher_name}
          </span>
        )}
        <span className="ml-auto text-sm font-medium text-slate-700">
          {plan.total_planned_hours}h kế hoạch
        </span>
      </div>

      {/* Grid */}
      {performers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          Chưa có yêu cầu nào trong kế hoạch này.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pl-2 pr-4 text-left text-xs font-semibold text-slate-500">
                  Người thực hiện
                </th>
                {DAYS.map((d) => (
                  <th
                    key={d}
                    className="w-[12%] py-2 text-center text-xs font-semibold text-slate-500"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performers.map((performer) => (
                <tr key={performer.name} className="border-b border-slate-100">
                  <td className="py-2 pl-2 pr-4 font-medium text-slate-700">{performer.name}</td>
                  {performer.days.map((dayItems, dayIdx) => (
                    <td key={dayIdx} className="align-top py-1">
                      <div className="flex flex-col gap-0.5">
                        {dayItems.map((item) => {
                          const chipCls = CHIP_STATUS_CLS[item.actual_status] ?? 'bg-slate-200 text-slate-700';
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onItemClick?.(item)}
                              className={`rounded px-1.5 py-0.5 text-left font-mono text-xs leading-tight transition hover:opacity-80 ${chipCls}`}
                              title={item.summary ?? item.request_code ?? String(item.request_case_id)}
                            >
                              {item.request_code ?? `#${item.request_case_id}`}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="py-1.5 pl-2 pr-4 text-xs font-semibold text-slate-400">
                  Tổng giờ/ngày
                </td>
                {dailyTotals.map((total, idx) => (
                  <td
                    key={idx}
                    className="py-1.5 text-center text-xs font-semibold text-slate-600"
                  >
                    {total > 0 ? `${total}h` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(ACTUAL_STATUS_META).map(([key, meta]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${CHIP_STATUS_CLS[key]?.split(' ')[0]}`} />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
};
