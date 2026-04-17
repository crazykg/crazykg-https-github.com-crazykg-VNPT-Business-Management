import React from 'react';
import type { YeuCau } from '../../types/customerRequest';
import {
  LIST_PRIORITY_META,
  buildRequestContextCaption,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  resolveOwnerSummaryMeta,
  resolvePrimaryActionMeta,
  resolveRequestProcessCode,
  resolveUpdatedSummaryMeta,
  type CustomerRequestRoleFilter,
} from './presentation';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

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
    className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] shadow-sm"
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
  const layoutMode = useCustomerRequestResponsiveLayout();
  const healthMeta = resolveHealthSummaryMeta(request);
  const priorityMeta = LIST_PRIORITY_META[String(request.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveOwnerSummaryMeta(request);
  const nextActionMeta = resolvePrimaryActionMeta(request, requestRoleFilter);
  const hoursMeta = resolveHoursSummaryMeta(request);
  const updatedMeta = resolveUpdatedSummaryMeta(request);
  const resolvedUpdatedLabel = updatedLabel ?? updatedMeta.updatedLabel;
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
      label: 'Giờ',
      value: hoursMeta.value,
      hint: hoursMeta.hint,
      valueCls: hoursMeta.valueCls,
    },
    {
      label: 'SLA',
      value: updatedMeta.slaLabel,
      hint: updatedMeta.dueLabel,
      valueCls:
        updatedMeta.slaCls.split(' ').find((token) => token.startsWith('text-')) || 'text-slate-700',
    },
  ];
  const renderMetaAsGrid = layoutMode !== 'desktopWide';

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-white/92 px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${hoverToneCls} ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpenRequest(request.id, resolveRequestProcessCode(request))}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`Mở chi tiết ${request.ma_yc || request.request_code || 'yêu cầu'}`}
      />

      <div className="pointer-events-none relative z-0 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
            {request.ma_yc || request.request_code || '--'}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${healthMeta.primary.cls}`}>
            {healthMeta.primary.label}
          </span>
          {priorityMeta ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityMeta.cls}`}>
              Ưu tiên {priorityMeta.label}
            </span>
          ) : null}
          {healthMeta.secondary.slice(0, 1).map((item) => (
            <span
              key={`${item.code}-${item.label}`}
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.cls}`}
            >
              {item.label}
            </span>
          ))}
        </div>

        <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-slate-900">
          {request.tieu_de || request.summary || '--'}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{contextCaption}</p>

        {renderMetaAsGrid ? (
          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            {resolvedMetaItems.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2"
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {item.label}
                </p>
                <p className={`mt-1 line-clamp-1 text-[12px] font-semibold leading-4 ${item.valueCls ?? 'text-slate-700'}`}>
                  {item.value}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-slate-400">{item.hint}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
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
        )}

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-1.5">
          <p className="min-w-0 line-clamp-1 text-[10px] leading-4 text-slate-400">
            Cập nhật {resolvedUpdatedLabel}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
            Xem chi tiết
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  );
};
