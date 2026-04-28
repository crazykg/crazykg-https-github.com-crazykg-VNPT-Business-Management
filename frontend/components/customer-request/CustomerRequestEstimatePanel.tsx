import React, { useMemo } from 'react';
import type { YeuCau, YeuCauEstimate, YeuCauHoursReport } from '../../types/customerRequest';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import { formatHoursValue, formatPercentValue } from './presentation';
import {
  customerRequestDenseSecondaryButtonClass,
  customerRequestNestedSurfaceClass,
  customerRequestSurfaceClass,
} from './uiClasses';

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
  const estimateHistoryListClassName = estimateHistory.length > 0
    ? 'mt-2 max-h-[min(260px,38dvh)] space-y-1.5 overflow-y-auto pr-1 custom-scrollbar'
    : 'mt-2';

  return (
    <div className={`${customerRequestSurfaceClass} p-3 sm:p-3.5`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-slate-100 pb-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-blue-50 text-primary">
            <span className="material-symbols-outlined text-[15px]">rule</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Ước lượng</h4>
              <span className="inline-flex h-6 items-center rounded-full bg-[var(--ui-surface-subtle)] px-2 text-xs font-semibold text-[color:var(--ui-text-muted)]">
                {estimateHistory.length} lần
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--ui-text-muted)]">Hiện hành, thực tế và lịch sử điều chỉnh.</p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          {canAddEstimate ? (
            <button
              type="button"
              onClick={onAddEstimate}
              disabled={isActionDisabled}
              className={`${customerRequestDenseSecondaryButtonClass} border-primary/20 bg-primary/10 text-primary hover:bg-primary/15`}
            >
              <span className="material-symbols-outlined text-[15px]">rule</span>
              Cập nhật ước lượng
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <div className={`${customerRequestNestedSurfaceClass} px-3 py-2.5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Hiện hành</p>
          <p className="mt-1 text-base font-black leading-tight text-slate-900">{formatHoursValue(estimatedHours)}</p>
          {latestEstimate?.estimated_at ? (
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Cập nhật {formatDateTimeDdMmYyyy(latestEstimate.estimated_at)?.slice(0, 16)}
            </p>
          ) : null}
        </div>
        <div className={`${customerRequestNestedSurfaceClass} px-3 py-2.5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Thực tế</p>
          <p className="mt-1 text-base font-black leading-tight text-slate-900">{formatHoursValue(actualHours)}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Tỷ lệ sử dụng: {formatPercentValue(usagePercent)}</p>
        </div>
        <div className={`${customerRequestNestedSurfaceClass} px-3 py-2.5`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Gần nhất</p>
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

      <div className={estimateHistoryListClassName}>
        {estimateHistory.length === 0 ? (
          <div className="rounded-[var(--ui-control-radius)] border border-dashed border-slate-200 px-3 py-3.5 text-center text-xs text-slate-400">
            Chưa có lịch sử ước lượng.
          </div>
        ) : (
          estimateHistory.map((estimate) => (
            <div key={String(estimate.id)} className={`${customerRequestNestedSurfaceClass} px-3 py-2.5 text-sm`}>
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
