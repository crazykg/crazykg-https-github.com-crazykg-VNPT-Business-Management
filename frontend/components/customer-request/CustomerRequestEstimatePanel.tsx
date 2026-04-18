import React, { useMemo } from 'react';
import type { YeuCau, YeuCauEstimate, YeuCauHoursReport } from '../../types/customerRequest';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { formatHoursValue, formatPercentValue } from './presentation';

type CustomerRequestEstimatePanelProps = {
  request: YeuCau | null | undefined;
  hoursReport: YeuCauHoursReport | null | undefined;
  estimateHistory: YeuCauEstimate[];
  canAddEstimate?: boolean;
  onAddEstimate?: () => void;
  isActionDisabled?: boolean;
};

export const CustomerRequestEstimatePanel: React.FC<CustomerRequestEstimatePanelProps> = ({
  request,
  hoursReport,
  estimateHistory,
  canAddEstimate = false,
  onAddEstimate,
  isActionDisabled = false,
}) => {
  const latestEstimate = estimateHistory[0] ?? hoursReport?.latest_estimate ?? null;
  const scopeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    estimateHistory.forEach((estimate) => {
      const scope = String(estimate.estimate_scope || 'total');
      counts.set(scope, (counts.get(scope) ?? 0) + 1);
    });
    return Array.from(counts.entries());
  }, [estimateHistory]);

  const usagePercent = hoursReport?.hours_usage_pct ?? request?.hours_usage_pct ?? null;
  const estimatedHours = hoursReport?.estimated_hours ?? request?.estimated_hours ?? null;
  const actualHours = hoursReport?.total_hours_spent ?? request?.total_hours_spent ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Ước lượng</h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Theo dõi ước lượng hiện hành, lịch sử điều chỉnh và mức tiêu hao giờ công.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Số lần ước lượng</p>
            <p className="mt-1 text-base font-black leading-tight text-slate-900">{estimateHistory.length}</p>
          </div>
          {canAddEstimate ? (
            <button
              type="button"
              onClick={onAddEstimate}
              disabled={isActionDisabled}
              className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">rule</span>
              Cập nhật ước lượng
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ước lượng hiện hành</p>
          <p className="mt-1 text-base font-black leading-tight text-slate-900">{formatHoursValue(estimatedHours)}</p>
          {latestEstimate?.estimated_at ? (
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Cập nhật {formatDateTimeDdMmYyyy(latestEstimate.estimated_at)?.slice(0, 16)}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Thực tế đã dùng</p>
          <p className="mt-1 text-base font-black leading-tight text-slate-900">{formatHoursValue(actualHours)}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Tỷ lệ sử dụng: {formatPercentValue(usagePercent)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ước lượng gần nhất</p>
          <p className="mt-1 text-base font-black leading-tight text-slate-900">{formatHoursValue(latestEstimate?.estimated_hours ?? estimatedHours)}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {[latestEstimate?.estimate_scope, latestEstimate?.phase_label, latestEstimate?.estimated_by_name]
              .filter(Boolean)
              .join(' · ') || 'Chưa có metadata bổ sung'}
          </p>
        </div>
      </div>

      {scopeSummary.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scopeSummary.map(([scope, count]) => (
            <span key={scope} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
              {scope}: {count}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-1.5">
        {estimateHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3.5 text-center text-xs text-slate-400">
            Chưa có lịch sử ước lượng.
          </div>
        ) : (
          estimateHistory.map((estimate) => (
            <div key={String(estimate.id)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">{formatHoursValue(estimate.estimated_hours)}</span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">{estimate.estimate_scope || 'total'}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {[
                  estimate.phase_label,
                  estimate.estimate_type,
                  estimate.estimated_by_name,
                  estimate.estimated_at ? formatDateTimeDdMmYyyy(estimate.estimated_at)?.slice(0, 16) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {estimate.note ? <p className="mt-0.5 text-xs leading-4 text-slate-600">{estimate.note}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
