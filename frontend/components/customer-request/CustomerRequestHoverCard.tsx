import React from 'react';
import type { YeuCau } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';
import {
  buildRequestContextCaption,
  formatPercentValue,
  resolveDecisionNextAction,
  resolveDecisionOwner,
  resolveRequestStatusMeta,
  type CustomerRequestRoleFilter,
} from './presentation';

type CustomerRequestHoverCardProps = {
  request: YeuCau | null;
  requestRoleFilter?: CustomerRequestRoleFilter;
  isLoading?: boolean;
  className?: string;
};

const SkeletonLine: React.FC<{ width?: string }> = ({ width = 'w-full' }) => (
  <div className={`h-3 animate-pulse rounded bg-slate-200 ${width}`} />
);

export const CustomerRequestHoverCard: React.FC<CustomerRequestHoverCardProps> = ({
  request,
  requestRoleFilter = '' as CustomerRequestRoleFilter,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div className={`w-72 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ${className}`}>
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-3/4" />
        <SkeletonLine />
        <SkeletonLine width="w-2/3" />
        <SkeletonLine width="w-1/2" />
      </div>
    );
  }

  if (!request) return null;

  const statusMeta = resolveRequestStatusMeta(request);
  const ownerMeta = resolveDecisionOwner(request);
  const nextActionMeta = resolveDecisionNextAction(request, requestRoleFilter);

  const hoursPercent =
    request.estimated_hours && request.estimated_hours > 0
      ? Math.min(
          100,
          Math.round(
            ((request.total_hours_spent ?? 0) / request.estimated_hours) * 100
          )
        )
      : null;

  const barColor =
    hoursPercent === null
      ? 'bg-slate-300'
      : hoursPercent >= 100
        ? 'bg-rose-500'
        : hoursPercent >= 80
          ? 'bg-amber-400'
          : 'bg-emerald-500';

  return (
    <div
      className={`w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
          {request.ma_yc || request.request_code || '--'}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
      </div>

      <p className="mb-3 line-clamp-2 text-sm font-semibold text-slate-800">
        {request.tieu_de || request.summary || '--'}
      </p>

      {/* Meta */}
      <div className="mb-3 space-y-1">
        <div className="flex items-start gap-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined mt-0.5 text-[14px]">business</span>
          <span className="line-clamp-2">
            {buildRequestContextCaption(request) || 'Chưa có khách hàng / dự án / sản phẩm'}
          </span>
        </div>
      </div>

      {/* People */}
      <div className="mb-3 space-y-1">
        {request.received_by_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-16 flex-shrink-0 font-medium text-slate-400">Tiếp nhận</span>
            <span className="truncate">{request.received_by_name}</span>
          </div>
        )}
        {request.dispatcher_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-16 flex-shrink-0 font-medium text-slate-400">Điều phối</span>
            <span className="truncate">{request.dispatcher_name}</span>
          </div>
        )}
        {(request.nguoi_xu_ly_name ?? request.performer_name) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-16 flex-shrink-0 font-medium text-slate-400">Thực hiện</span>
            <span className="truncate">{request.nguoi_xu_ly_name ?? request.performer_name}</span>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Người phụ trách hiện tại
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{ownerMeta.label}</p>
          </div>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${nextActionMeta.cls}`}
          >
            {nextActionMeta.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{nextActionMeta.hint}</p>
      </div>

      {/* Hours progress */}
      {request.estimated_hours !== null && request.estimated_hours !== undefined && request.estimated_hours > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Giờ công</span>
            <span>
              {request.total_hours_spent ?? 0}h / {request.estimated_hours}h
              {hoursPercent !== null && ` (${hoursPercent}%)`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${hoursPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {request.hours_usage_pct != null
              ? `Mức dùng ${formatPercentValue(request.hours_usage_pct)}`
              : 'Chưa có phần trăm sử dụng ước lượng'}
          </p>
        </div>
      )}

      {/* Updated at */}
      <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>
          {request.sla_due_at
            ? `SLA: ${formatDateTimeDdMmYyyy(request.sla_due_at)?.slice(0, 16)}`
            : 'SLA: --'}
        </span>
        <span>
          {request.updated_at
            ? `Cập nhật: ${formatDateTimeDdMmYyyy(request.updated_at)?.slice(0, 16)}`
            : 'Cập nhật: --'}
        </span>
      </div>
    </div>
  );
};
