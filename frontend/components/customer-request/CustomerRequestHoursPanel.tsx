import React from 'react';
import type { YeuCau, YeuCauHoursReport } from '../../types/customerRequest';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  formatHoursValue,
  formatPercentValue,
  resolveSlaMeta,
  resolveWarningMeta,
} from './presentation';

type CustomerRequestHoursPanelProps = {
  request: YeuCau | null | undefined;
  hoursReport: YeuCauHoursReport | null | undefined;
  canAddWorklog?: boolean;
  onAddWorklog?: () => void;
  isActionDisabled?: boolean;
};

export const CustomerRequestHoursPanel: React.FC<CustomerRequestHoursPanelProps> = ({
  request,
  hoursReport,
  canAddWorklog = false,
  onAddWorklog,
  isActionDisabled = false,
}) => {
  const warningMeta = resolveWarningMeta(hoursReport?.warning_level ?? request?.warning_level);
  const slaMeta = resolveSlaMeta(request?.sla_status);
  const metricItems = [
    { label: 'Estimate hiện hành', value: formatHoursValue(hoursReport?.estimated_hours ?? request?.estimated_hours) },
    { label: 'Thực tế', value: formatHoursValue(hoursReport?.total_hours_spent ?? request?.total_hours_spent) },
    { label: 'Còn lại', value: formatHoursValue(hoursReport?.remaining_hours) },
    { label: 'Mức sử dụng', value: formatPercentValue(hoursReport?.hours_usage_pct ?? request?.hours_usage_pct) },
  ] as const;

  return (
    <div className="rounded-2xl border border-slate-200 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Estimate & giờ công</h4>
        {canAddWorklog ? (
          <button
            type="button"
            onClick={onAddWorklog}
            disabled={isActionDisabled}
            className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            Ghi giờ công
          </button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {metricItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] leading-4 text-slate-400"
                title={`${item.label}: ${item.value}`}
              >
                {item.label}:
              </p>
              <p className="shrink-0 text-sm font-black leading-4 text-slate-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {warningMeta ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${warningMeta.cls}`}>
            {warningMeta.label}
          </span>
        ) : null}
        {slaMeta ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${slaMeta.cls}`}>
            {slaMeta.label}
          </span>
        ) : null}
        {request?.sla_due_at ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
            SLA: {formatDateTimeDdMmYyyy(request.sla_due_at)?.slice(0, 16)}
          </span>
        ) : null}
      </div>

      {(hoursReport?.by_performer ?? []).length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Phân bổ theo người thực hiện</p>
          {(hoursReport?.by_performer ?? []).slice(0, 3).map((item) => (
            <div
              key={`${item.performed_by_user_id ?? 'unknown'}-${item.performed_by_name ?? ''}`}
              className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-800">{item.performed_by_name || 'Chưa xác định'}</span>
                <span className="text-slate-500">{formatHoursValue(item.hours_spent)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
