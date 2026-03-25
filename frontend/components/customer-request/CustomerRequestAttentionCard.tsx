import React from 'react';
import type { YeuCau } from '../../types';
import {
  LIST_PRIORITY_META,
  buildRequestContextCaption,
  resolveAttentionReasonMeta,
  resolveHealthSummaryMeta,
  resolveHoursSummaryMeta,
  resolveOwnerSummaryMeta,
  resolvePrimaryActionMeta,
  resolveRequestProcessCode,
  resolveUpdatedSummaryMeta,
  type CustomerRequestRoleFilter,
} from './presentation';
import { useCustomerRequestResponsiveLayout } from './hooks/useCustomerRequestResponsiveLayout';

type CustomerRequestAttentionCardProps = {
  request: YeuCau;
  reasons: string[];
  onOpenRequest: (requestId: string | number, statusCode?: string | null) => void;
  requestRoleFilter?: CustomerRequestRoleFilter;
  layout?: 'wide' | 'stacked';
  className?: string;
  hoverToneCls?: string;
};

const buildAttentionContext = (request: YeuCau): string => {
  const baseContext = buildRequestContextCaption(request);
  const requesterLabel =
    request.requester_name || request.customer_personnel_name
      ? `YC: ${request.requester_name || request.customer_personnel_name}`
      : null;

  return [baseContext, requesterLabel].filter(Boolean).join(' · ');
};

const CompactInfoCell: React.FC<{
  label: string;
  value: string;
  hint: string;
  valueCls?: string;
}> = ({ label, value, hint, valueCls = 'text-slate-800' }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
      {label}
    </p>
    <p className={`mt-1 line-clamp-1 text-sm font-semibold ${valueCls}`}>{value}</p>
    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{hint}</p>
  </div>
);

export const CustomerRequestAttentionCard: React.FC<CustomerRequestAttentionCardProps> = ({
  request,
  reasons,
  onOpenRequest,
  requestRoleFilter = '' as CustomerRequestRoleFilter,
  layout = 'wide',
  className = '',
  hoverToneCls = 'hover:border-slate-300 hover:bg-white',
}) => {
  const layoutMode = useCustomerRequestResponsiveLayout();
  const healthMeta = resolveHealthSummaryMeta(request);
  const priorityMeta = LIST_PRIORITY_META[String(request.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveOwnerSummaryMeta(request);
  const nextActionMeta = resolvePrimaryActionMeta(request, requestRoleFilter);
  const hoursMeta = resolveHoursSummaryMeta(request, reasons);
  const updatedMeta = resolveUpdatedSummaryMeta(request, reasons);
  const visibleReasonMetas = reasons
    .map((reason) => resolveAttentionReasonMeta(reason))
    .filter(
      (meta): meta is NonNullable<ReturnType<typeof resolveAttentionReasonMeta>> =>
        meta !== null &&
        !['missing_estimate', 'over_estimate', 'sla_risk'].includes(meta.code)
    )
    .slice(0, 2);
  const contextCaption = buildAttentionContext(request);
  const isStackedLayout = layout === 'stacked' || layoutMode !== 'desktopWide';
  const shellLayoutCls = isStackedLayout
    ? 'grid gap-3'
    : 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start';

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition ${hoverToneCls} ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpenRequest(request.id, resolveRequestProcessCode(request))}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`Mở chi tiết ${request.ma_yc || request.request_code || 'yêu cầu'}`}
      />

      <div className={`pointer-events-none relative z-0 ${shellLayoutCls}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-900">
              {request.ma_yc || request.request_code || '--'}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthMeta.primary.cls}`}
            >
              {healthMeta.primary.label}
            </span>
            {priorityMeta ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityMeta.cls}`}
              >
                Ưu tiên {priorityMeta.label}
              </span>
            ) : null}
            {visibleReasonMetas.map((meta) => (
              <span
                key={meta.code}
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}
              >
                {meta.label}
              </span>
            ))}
            {healthMeta.secondary.slice(0, isStackedLayout ? 1 : 2).map((meta) => (
              <span
                key={`${meta.code}-${meta.label}`}
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}
              >
                {meta.label}
              </span>
            ))}
          </div>

          <p className="mt-2 line-clamp-1 text-[17px] font-semibold leading-tight text-slate-900">
            {request.tieu_de || request.summary || '--'}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
            {contextCaption || 'Chưa có khách hàng / dự án / sản phẩm'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactInfoCell
              label="Phụ trách"
              value={ownerMeta.label}
              hint={ownerMeta.hint}
            />
            <CompactInfoCell
              label="Tiếp theo"
              value={nextActionMeta.label}
              hint={nextActionMeta.hint}
              valueCls={
                nextActionMeta.cls.split(' ').find((token) => token.startsWith('text-')) ||
                'text-slate-800'
              }
            />
            <CompactInfoCell
              label="Giờ"
              value={hoursMeta.value}
              hint={hoursMeta.hint}
              valueCls={hoursMeta.valueCls}
            />
            <CompactInfoCell
              label="SLA"
              value={updatedMeta.slaLabel}
              hint={updatedMeta.dueLabel}
              valueCls={
                updatedMeta.slaCls.split(' ').find((token) => token.startsWith('text-')) ||
                'text-slate-800'
              }
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {updatedMeta.updatedHint}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-700">
                {updatedMeta.updatedLabel}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Xem chi tiết
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
