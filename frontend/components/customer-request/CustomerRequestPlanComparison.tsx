import React, { useMemo } from 'react';
import type { CustomerRequestPlanItem } from '../../types/customerRequest';

type CustomerRequestPlanComparisonProps = {
  items: CustomerRequestPlanItem[];
};

export const CustomerRequestPlanComparison: React.FC<CustomerRequestPlanComparisonProps> = ({
  items,
}) => {
  // Per-performer summary
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; planned: number; actual: number }>();
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

  const totalPlanned = useMemo(() => rows.reduce((s, r) => s + r.planned, 0), [rows]);
  const totalActual = useMemo(() => rows.reduce((s, r) => s + r.actual, 0), [rows]);
  const completionPct =
    totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const getRowCls = (planned: number, actual: number): string => {
    if (planned <= 0) return '';
    const ratio = actual / planned;
    if (ratio <= 1) return 'bg-emerald-50';
    if (ratio <= 1.2) return 'bg-amber-50';
    return 'bg-rose-50';
  };

  const getActualCls = (planned: number, actual: number): string => {
    if (planned <= 0) return 'text-slate-700';
    const ratio = actual / planned;
    if (ratio <= 1) return 'text-emerald-700 font-semibold';
    if (ratio <= 1.2) return 'text-amber-700 font-semibold';
    return 'text-rose-700 font-semibold';
  };

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        Chưa có dữ liệu để so sánh.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        KH vs Thực tế theo người thực hiện
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2 pl-2 text-left text-xs font-semibold text-slate-500">
                Người thực hiện
              </th>
              <th className="pb-2 text-right text-xs font-semibold text-slate-500">
                Kế hoạch (h)
              </th>
              <th className="pb-2 text-right text-xs font-semibold text-slate-500">
                Thực tế (h)
              </th>
              <th className="pb-2 pr-2 text-right text-xs font-semibold text-slate-500">
                Chênh lệch
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = row.actual - row.planned;
              const diffCls = diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-400';
              return (
                <tr key={row.name} className={`border-b border-slate-100 ${getRowCls(row.planned, row.actual)}`}>
                  <td className="py-2 pl-2 font-medium text-slate-700">{row.name}</td>
                  <td className="py-2 text-right text-slate-700">{row.planned.toFixed(1)}</td>
                  <td className={`py-2 text-right ${getActualCls(row.planned, row.actual)}`}>
                    {row.actual.toFixed(1)}
                  </td>
                  <td className={`py-2 pr-2 text-right text-xs ${diffCls}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                  </td>
                </tr>
              );
            })}
            {/* Summary row */}
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <td className="py-2 pl-2 text-slate-700">Tổng cộng</td>
              <td className="py-2 text-right text-slate-700">{totalPlanned.toFixed(1)}</td>
              <td className={`py-2 text-right ${getActualCls(totalPlanned, totalActual)}`}>
                {totalActual.toFixed(1)}
              </td>
              <td className="py-2 pr-2 text-right text-xs text-slate-500">
                {completionPct}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-100" />
          Thực tế &le; Kế hoạch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-100" />
          Thực tế &gt; 100% – 120% KH
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-rose-100" />
          Thực tế &gt; 120% KH
        </span>
      </div>
    </div>
  );
};
