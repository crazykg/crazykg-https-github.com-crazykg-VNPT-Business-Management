import React, { useMemo } from 'react';
import type { CustomerRequestPlan, CustomerRequestPlanItem } from '../../types';
import { STATUS_COLOR_MAP } from './presentation';

const ACTUAL_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Đang xử lý', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  carried_over: { label: 'Chuyển kỳ', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Huỷ', cls: 'bg-rose-100 text-rose-500' },
};

const PLAN_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Đã nộp', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700' },
};

type CustomerRequestPlanMonthlyProps = {
  plan: CustomerRequestPlan;
  items: CustomerRequestPlanItem[];
  onItemClick?: (item: CustomerRequestPlanItem) => void;
};

export const CustomerRequestPlanMonthly: React.FC<CustomerRequestPlanMonthlyProps> = ({
  plan,
  items,
  onItemClick,
}) => {
  const statusMeta = PLAN_STATUS_META[plan.status] ?? { label: plan.status, cls: 'bg-slate-100 text-slate-600' };

  const monthLabel = useMemo(() => {
    if (!plan.period_start) return plan.plan_code;
    const d = new Date(plan.period_start);
    return `Tháng ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }, [plan]);

  const totalActualHours = useMemo(
    () => items.reduce((sum, i) => sum + (i.actual_hours ?? 0), 0),
    [items]
  );

  // Per-performer summary
  const performerSummary = useMemo(() => {
    const map = new Map<
      string,
      { name: string; planned: number; actual: number }
    >();
    for (const item of items) {
      const key = String(item.performer_user_id ?? 'unknown');
      const name = item.performer_name ?? `Người dùng ${key}`;
      if (!map.has(key)) {
        map.set(key, { name, planned: 0, actual: 0 });
      }
      const entry = map.get(key)!;
      entry.planned += item.planned_hours ?? 0;
      entry.actual += item.actual_hours ?? 0;
    }
    return Array.from(map.values()).sort((a, b) => b.planned - a.planned);
  }, [items]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.priority_order - b.priority_order),
    [items]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold text-slate-800">{monthLabel}</h3>
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
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            KH: <span className="font-semibold text-slate-800">{plan.total_planned_hours}h</span>
          </span>
          <span className="text-slate-500">
            TH: <span className="font-semibold text-slate-800">{totalActualHours.toFixed(1)}h</span>
          </span>
        </div>
      </div>

      {/* Performer summary */}
      {performerSummary.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Theo người thực hiện
          </p>
          <div className="space-y-3">
            {performerSummary.map((p) => {
              const pct = p.planned > 0 ? Math.min(100, Math.round((p.actual / p.planned) * 100)) : 0;
              const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-xs text-slate-500">
                      {p.actual.toFixed(1)}h / {p.planned.toFixed(1)}h
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items list */}
      {sortedItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          Chưa có yêu cầu nào trong kế hoạch này.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 pl-2 text-left text-xs font-semibold text-slate-500">Mã YC</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Tóm tắt</th>
                <th className="pb-2 text-left text-xs font-semibold text-slate-500">Người TH</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">KH (h)</th>
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">TH (h)</th>
                <th className="pb-2 text-center text-xs font-semibold text-slate-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const statusMeta2 =
                  item.current_status_code
                    ? STATUS_COLOR_MAP[item.current_status_code] ?? {
                        label: item.current_status_code,
                        cls: 'bg-slate-100 text-slate-600',
                      }
                    : null;
                const actualMeta = ACTUAL_STATUS_META[item.actual_status] ?? {
                  label: item.actual_status,
                  cls: 'bg-slate-100 text-slate-600',
                };
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    onClick={() => onItemClick?.(item)}
                  >
                    <td className="py-2 pl-2">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {item.request_code ?? `#${item.request_case_id}`}
                      </span>
                    </td>
                    <td className="max-w-[200px] py-2">
                      <p className="truncate text-slate-700">{item.summary ?? '—'}</p>
                      {statusMeta2 && (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusMeta2.cls}`}>
                          {statusMeta2.label}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-600">{item.performer_name ?? '—'}</td>
                    <td className="py-2 text-right font-medium text-slate-700">
                      {item.planned_hours.toFixed(1)}
                    </td>
                    <td className="py-2 text-right font-medium text-slate-700">
                      {(item.actual_hours ?? 0).toFixed(1)}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${actualMeta.cls}`}>
                        {actualMeta.label}
                      </span>
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
};
