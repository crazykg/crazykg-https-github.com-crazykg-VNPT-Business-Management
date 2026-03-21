import React from 'react';
import type { YeuCau, YeuCauHoursReport } from '../../types';
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
};

export const CustomerRequestHoursPanel: React.FC<CustomerRequestHoursPanelProps> = ({
  request,
  hoursReport,
}) => {
  const warningMeta = resolveWarningMeta(hoursReport?.warning_level ?? request?.warning_level);
  const slaMeta = resolveSlaMeta(request?.sla_status);

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Estimate & giờ công</h4>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Estimate hiện hành</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatHoursValue(hoursReport?.estimated_hours ?? request?.estimated_hours)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Thực tế</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatHoursValue(hoursReport?.total_hours_spent ?? request?.total_hours_spent)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Còn lại</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatHoursValue(hoursReport?.remaining_hours)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mức sử dụng</p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatPercentValue(hoursReport?.hours_usage_pct ?? request?.hours_usage_pct)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {warningMeta ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${warningMeta.cls}`}>
            {warningMeta.label}
          </span>
        ) : null}
        {slaMeta ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${slaMeta.cls}`}>
            {slaMeta.label}
          </span>
        ) : null}
        {request?.sla_due_at ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            SLA: {formatDateTimeDdMmYyyy(request.sla_due_at)?.slice(0, 16)}
          </span>
        ) : null}
      </div>

      {(hoursReport?.by_performer ?? []).length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Phân bổ theo người thực hiện</p>
          {(hoursReport?.by_performer ?? []).slice(0, 3).map((item) => (
            <div
              key={`${item.performed_by_user_id ?? 'unknown'}-${item.performed_by_name ?? ''}`}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
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
