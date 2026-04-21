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
  compact?: boolean;
};

export const CustomerRequestHoursPanel: React.FC<CustomerRequestHoursPanelProps> = ({
  request,
  hoursReport,
  canAddWorklog = false,
  onAddWorklog,
  isActionDisabled = false,
  compact = false,
}) => {
  const warningMeta = resolveWarningMeta(hoursReport?.warning_level ?? request?.warning_level);
  const slaMeta = resolveSlaMeta(request?.sla_status);
  const metricItems = [
    { label: 'Estimate hiện hành', value: formatHoursValue(hoursReport?.estimated_hours ?? request?.estimated_hours) },
    { label: 'Thực tế', value: formatHoursValue(hoursReport?.total_hours_spent ?? request?.total_hours_spent) },
    { label: 'Còn lại', value: formatHoursValue(hoursReport?.remaining_hours) },
    { label: 'Mức sử dụng', value: formatPercentValue(hoursReport?.hours_usage_pct ?? request?.hours_usage_pct) },
  ] as const;
  const panelClassName = compact
    ? 'rounded-2xl border border-slate-200 p-3'
    : 'rounded-2xl border border-slate-200 p-3.5';
  const headerClassName = compact
    ? 'flex flex-wrap items-start justify-between gap-2'
    : 'flex flex-wrap items-start justify-between gap-2.5';
  const titleClassName = compact
    ? 'text-xs font-bold uppercase tracking-[0.14em] text-slate-500'
    : 'text-sm font-bold uppercase tracking-[0.16em] text-slate-500';
  const buttonClassName = compact
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1.5 text-[11px] font-semibold leading-4 text-primary transition hover:bg-primary/15 disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50';
  const metricGridClassName = compact
    ? 'mt-1.5 grid grid-cols-2 gap-1.5'
    : 'mt-2 grid grid-cols-2 gap-2 md:grid-cols-4';
  const metricCardClassName = compact
    ? 'rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5'
    : 'rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2';
  const metricLabelClassName = compact
    ? 'min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.1em] leading-3.5 text-slate-400'
    : 'min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] leading-4 text-slate-400';
  const metricValueClassName = compact
    ? 'shrink-0 text-sm font-black leading-3.5 text-slate-900'
    : 'shrink-0 text-sm font-black leading-4 text-slate-900';
  const chipRowClassName = compact
    ? 'mt-2 flex flex-wrap gap-1'
    : 'mt-3 flex flex-wrap gap-1.5';
  const chipClassName = compact
    ? 'rounded-full px-2 py-0.5 text-[10px] font-bold'
    : 'rounded-full px-2.5 py-0.5 text-[10px] font-bold';
  const performerSectionClassName = compact
    ? 'mt-2 space-y-1'
    : 'mt-3 space-y-1.5';
  const performerLabelClassName = compact
    ? 'text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400'
    : 'text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400';
  const performerItemClassName = compact
    ? 'rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[13px]'
    : 'rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-sm';

  return (
    <div className={panelClassName}>
      <div className={headerClassName}>
        <h4 className={titleClassName}>Estimate & giờ công</h4>
        {canAddWorklog ? (
          <button
            type="button"
            onClick={onAddWorklog}
            disabled={isActionDisabled}
            className={buttonClassName}
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            Ghi giờ công
          </button>
        ) : null}
      </div>
      <div className={metricGridClassName}>
        {metricItems.map((item) => (
          <div
            key={item.label}
            className={metricCardClassName}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={metricLabelClassName}
                title={`${item.label}: ${item.value}`}
              >
                {item.label}:
              </p>
              <p className={metricValueClassName}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={chipRowClassName}>
        {warningMeta ? (
          <span className={`${chipClassName} ${warningMeta.cls}`}>
            {warningMeta.label}
          </span>
        ) : null}
        {slaMeta ? (
          <span className={`${chipClassName} ${slaMeta.cls}`}>
            {slaMeta.label}
          </span>
        ) : null}
        {request?.sla_due_at ? (
          <span className={`${chipClassName} bg-slate-100 text-slate-600`}>
            SLA: {formatDateTimeDdMmYyyy(request.sla_due_at)?.slice(0, 16)}
          </span>
        ) : null}
      </div>

      {(hoursReport?.by_performer ?? []).length > 0 ? (
        <div className={performerSectionClassName}>
          <p className={performerLabelClassName}>Phân bổ theo người thực hiện</p>
          {(hoursReport?.by_performer ?? []).slice(0, 3).map((item) => (
            <div
              key={`${item.performed_by_user_id ?? 'unknown'}-${item.performed_by_name ?? ''}`}
              className={performerItemClassName}
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
