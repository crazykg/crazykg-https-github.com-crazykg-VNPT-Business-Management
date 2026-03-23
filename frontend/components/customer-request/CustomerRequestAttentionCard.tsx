import React from 'react';
import type { YeuCau } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  LIST_PRIORITY_META,
  buildRequestContextCaption,
  resolveAttentionReasonMeta,
  resolveDecisionNextAction,
  resolveDecisionOwner,
  resolveEstimateSummary,
  resolveRequestProcessCode,
  resolveSlaSummary,
  resolveStatusMeta,
  type CustomerRequestRoleFilter,
} from './presentation';

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
  <div className="rounded-2xl border border-slate-100 bg-white/90 px-3 py-2.5">
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
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
  hoverToneCls = 'hover:border-primary/25 hover:bg-primary/5',
}) => {
  const statusMeta = resolveStatusMeta(
    request.trang_thai || request.current_status_code,
    request.current_status_name_vi
  );
  const priorityMeta = LIST_PRIORITY_META[String(request.do_uu_tien ?? '')] ?? null;
  const ownerMeta = resolveDecisionOwner(request);
  const nextActionMeta = resolveDecisionNextAction(request, requestRoleFilter);
  const estimateMeta = resolveEstimateSummary(request, reasons);
  const slaMeta = resolveSlaSummary(request, reasons);
  const visibleReasonMetas = reasons
    .map((reason) => resolveAttentionReasonMeta(reason))
    .filter(
      (meta): meta is NonNullable<ReturnType<typeof resolveAttentionReasonMeta>> =>
        meta !== null &&
        !['missing_estimate', 'over_estimate', 'sla_risk'].includes(meta.code)
    )
    .slice(0, 2);
  const updatedLabel = request.updated_at
    ? formatDateTimeDdMmYyyy(request.updated_at).slice(0, 16)
    : '--';
  const contextCaption = buildAttentionContext(request);
  const shellLayoutCls =
    layout === 'stacked'
      ? 'grid gap-3'
      : 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start';

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

      <div className={`pointer-events-none relative z-0 ${shellLayoutCls}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-white px-2.5 py-1 text-sm font-bold text-slate-900 shadow-sm">
              {request.ma_yc || request.request_code || '--'}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.cls}`}
            >
              {statusMeta.label}
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
          </div>

          <p className="mt-2 line-clamp-1 text-lg font-bold leading-tight text-slate-900">
            {request.tieu_de || request.summary || '--'}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
            {contextCaption || 'Chưa có khách hàng / dự án / sản phẩm'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white/75 px-3 py-3">
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
              label="Ước lượng"
              value={estimateMeta.value}
              hint={estimateMeta.hint}
              valueCls={estimateMeta.valueCls}
            />
            <CompactInfoCell
              label="SLA"
              value={slaMeta.value}
              hint={slaMeta.hint}
              valueCls={slaMeta.valueCls}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Cập nhật
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-700">
                {updatedLabel}
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
