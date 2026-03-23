import React from 'react';
import type { YeuCau } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  LIST_PRIORITY_META,
  buildRequestContextCaption,
  resolveDecisionNextAction,
  resolveDecisionOwner,
  resolveEstimateSummary,
  resolveRequestProcessCode,
  resolveSlaSummary,
  resolveStatusMeta,
  type CustomerRequestRoleFilter,
} from './presentation';

type CustomerRequestWorkspaceCaseCardProps = {
  request: YeuCau;
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  requestRoleFilter?: CustomerRequestRoleFilter;
  hoverToneCls?: string;
  className?: string;
  metaItems?: Array<{
    label: string;
    value: string;
    hint: string;
    valueCls?: string;
  }>;
  updatedLabel?: string;
};

const InlineMetaPill: React.FC<{
  label: string;
  value: string;
  hint: string;
  valueCls?: string;
}> = ({ label, value, hint, valueCls = 'text-slate-700' }) => (
  <span
    title={hint}
    className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-100 bg-white px-2.5 py-1 text-[11px] shadow-sm"
  >
    <span className="shrink-0 font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
    <span className={`min-w-0 truncate font-semibold ${valueCls}`}>{value}</span>
  </span>
);

export const CustomerRequestWorkspaceCaseCard: React.FC<CustomerRequestWorkspaceCaseCardProps> = ({
  request,
  onOpenRequest,
  requestRoleFilter = '' as CustomerRequestRoleFilter,
  hoverToneCls = 'hover:border-primary/25 hover:bg-primary/5',
  className = '',
  metaItems,
  updatedLabel,
}) => {
  const statusMeta = resolveStatusMeta(
    request.trang_thai || request.current_status_code,
    request.current_status_name_vi
  );
  const priorityMeta = LIST_PRIORITY_META[String(request.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveDecisionOwner(request);
  const nextActionMeta = resolveDecisionNextAction(request, requestRoleFilter);
  const estimateMeta = resolveEstimateSummary(request);
  const slaMeta = resolveSlaSummary(request);
  const resolvedUpdatedLabel = updatedLabel ?? (request.updated_at
    ? formatDateTimeDdMmYyyy(request.updated_at).slice(0, 16)
    : 'Chưa có thời gian cập nhật');
  const contextCaption = buildRequestContextCaption(request) || 'Chưa có khách hàng / dự án / sản phẩm';
  const nextActionValueCls =
    nextActionMeta.cls.split(' ').find((token) => token.startsWith('text-')) || 'text-slate-700';
  const resolvedMetaItems = metaItems ?? [
    {
      label: 'Phụ trách',
      value: ownerMeta.label,
      hint: ownerMeta.hint,
    },
    {
      label: 'Tiếp theo',
      value: nextActionMeta.label,
      hint: nextActionMeta.hint,
      valueCls: nextActionValueCls,
    },
    {
      label: 'Ước lượng',
      value: estimateMeta.value,
      hint: estimateMeta.hint,
      valueCls: estimateMeta.valueCls,
    },
    {
      label: 'SLA',
      value: slaMeta.value,
      hint: slaMeta.hint,
      valueCls: slaMeta.valueCls,
    },
  ];

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-left shadow-sm transition ${hoverToneCls} ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpenRequest(request.id, resolveRequestProcessCode(request))}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`Mở chi tiết ${request.ma_yc || request.request_code || 'yêu cầu'}`}
      />

      <div className="pointer-events-none relative z-0 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-white px-2.5 py-1 text-sm font-bold text-slate-900 shadow-sm">
            {request.ma_yc || request.request_code || '--'}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          {priorityMeta ? (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityMeta.cls}`}>
              Ưu tiên {priorityMeta.label}
            </span>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-1 text-base font-bold leading-tight text-slate-900">
          {request.tieu_de || request.summary || '--'}
        </p>
        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{contextCaption}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {resolvedMetaItems.map((item) => (
            <InlineMetaPill
              key={`${item.label}-${item.value}`}
              label={item.label}
              value={item.value}
              hint={item.hint}
              valueCls={item.valueCls}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
          <p className="min-w-0 line-clamp-1 text-[11px] text-slate-400">Cập nhật {resolvedUpdatedLabel}</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Xem chi tiết
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  );
};
