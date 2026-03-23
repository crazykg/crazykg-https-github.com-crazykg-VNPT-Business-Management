import type { YeuCau } from '../../types';
import { formatDateTimeDdMmYyyy } from '../../utils/dateDisplay';

export type CustomerRequestRoleFilter = '' | 'creator' | 'dispatcher' | 'performer';
export type CustomerRequestTaskSource = 'IT360' | 'REFERENCE';

export type It360TaskFormRow = {
  local_id: string;
  id?: string | number | null;
  task_code: string;
  task_link: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'BLOCKED';
};

export type ReferenceTaskFormRow = {
  local_id: string;
  id?: string | number | null;
  task_code: string;
};

export type CustomerRequestQuickAction = {
  id:
    | 'assign_performer'
    | 'self_handle'
    | 'request_feedback'
    | 'analysis'
    | 'reject'
    | 'take_task'
    | 'complete_task'
    | 'analysis_task'
    | 'return_to_manager'
    | 'notify_customer';
  label: string;
  description: string;
  targetStatusCode: string;
  icon: string;
  accentCls: string;
  payloadOverrides?: Record<string, unknown>;
  notePreset?: string;
};

export type DispatcherQuickAction = CustomerRequestQuickAction;
export type PerformerQuickAction = CustomerRequestQuickAction;
export type CustomerRequestSummaryMeta = {
  value: string;
  hint: string;
  valueCls: string;
};

export const STATUS_COLOR_MAP: Record<string, { label: string; cls: string }> = {
  new_intake: { label: 'Mới tiếp nhận', cls: 'bg-sky-100 text-sky-700' },
  waiting_customer_feedback: { label: 'Đợi phản hồi KH', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Đang xử lý', cls: 'bg-amber-100 text-amber-700' },
  not_executed: { label: 'Không thực hiện', cls: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  customer_notified: { label: 'Báo khách hàng', cls: 'bg-teal-100 text-teal-700' },
  returned_to_manager: { label: 'Chuyển trả QL', cls: 'bg-orange-100 text-orange-700' },
  analysis: { label: 'Phân tích', cls: 'bg-purple-100 text-purple-700' },
  pending_dispatch: { label: 'Chờ điều phối', cls: 'bg-indigo-100 text-indigo-700' },
  dispatched: { label: 'Đã điều phối', cls: 'bg-cyan-100 text-cyan-700' },
  coding: { label: 'Lập trình', cls: 'bg-violet-100 text-violet-700' },
  dms_transfer: { label: 'Chuyển DMS', cls: 'bg-lime-100 text-lime-700' },
};

export const WARNING_LEVEL_META: Record<string, { label: string; cls: string }> = {
  hard: { label: 'Vượt ước lượng', cls: 'bg-rose-100 text-rose-700' },
  soft: { label: 'Sắp chạm ước lượng', cls: 'bg-amber-100 text-amber-700' },
  missing: { label: 'Thiếu ước lượng', cls: 'bg-slate-100 text-slate-600' },
  normal: { label: 'Đúng kế hoạch', cls: 'bg-emerald-100 text-emerald-700' },
};

export const SLA_STATUS_META: Record<string, { label: string; cls: string }> = {
  overdue: { label: 'Quá hạn SLA', cls: 'bg-rose-100 text-rose-700' },
  at_risk: { label: 'Nguy cơ SLA', cls: 'bg-amber-100 text-amber-700' },
  on_track: { label: 'Đúng SLA', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Đã đóng', cls: 'bg-slate-100 text-slate-600' },
};

export const ROLE_DASHBOARD_META: Array<{
  role: CustomerRequestRoleFilter | 'overview';
  label: string;
  tone: string;
}> = [
  { role: 'overview', label: 'Toàn cảnh', tone: 'from-slate-900 to-slate-700' },
  { role: 'creator', label: 'Tôi tạo', tone: 'from-sky-600 to-cyan-500' },
  { role: 'dispatcher', label: 'Tôi điều phối', tone: 'from-amber-500 to-orange-500' },
  { role: 'performer', label: 'Tôi xử lý', tone: 'from-emerald-600 to-teal-500' },
];

export const LIST_PRIORITY_META: Record<string, { label: string; cls: string }> = {
  '4': { label: 'Khẩn', cls: 'bg-red-100 text-red-700' },
  '3': { label: 'Cao', cls: 'bg-orange-100 text-orange-700' },
  '2': { label: 'Trung bình', cls: 'bg-blue-100 text-blue-700' },
  '1': { label: 'Thấp', cls: 'bg-slate-100 text-slate-500' },
};

export const ATTENTION_REASON_META: Record<string, { label: string; cls: string }> = {
  missing_estimate: { label: 'Thiếu ước lượng', cls: 'bg-slate-100 text-slate-700' },
  over_estimate: { label: 'Vượt ước lượng', cls: 'bg-rose-100 text-rose-700' },
  sla_risk: { label: 'Nguy cơ SLA', cls: 'bg-amber-100 text-amber-700' },
  pending_dispatch: { label: 'Chờ điều phối', cls: 'bg-indigo-100 text-indigo-700' },
  waiting_customer_feedback: { label: 'Đợi phản hồi KH', cls: 'bg-yellow-100 text-yellow-700' },
  returned_to_manager: { label: 'Chuyển trả QL', cls: 'bg-orange-100 text-orange-700' },
};

export const SUPPORT_TASK_STATUS_OPTIONS: Array<{
  value: It360TaskFormRow['status'];
  label: string;
}> = [
  { value: 'TODO', label: 'Vừa tạo' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'DONE', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Huỷ' },
  { value: 'BLOCKED', label: 'Chuyển task khác' },
];

export const LIST_KPI_STATUSES: Array<{
  code: string;
  label: string;
  cls: string;
  activeCls: string;
}> = [
  { code: 'new_intake', label: 'Mới tiếp nhận', cls: 'bg-sky-50 border-sky-200 text-sky-700', activeCls: 'ring-2 ring-sky-400' },
  { code: 'waiting_customer_feedback', label: 'Đợi phản hồi KH', cls: 'bg-yellow-50 border-yellow-200 text-yellow-700', activeCls: 'ring-2 ring-yellow-400' },
  { code: 'in_progress', label: 'Đang xử lý', cls: 'bg-amber-50 border-amber-200 text-amber-700', activeCls: 'ring-2 ring-amber-400' },
  { code: 'analysis', label: 'Phân tích', cls: 'bg-purple-50 border-purple-200 text-purple-700', activeCls: 'ring-2 ring-purple-400' },
  { code: 'returned_to_manager', label: 'Chuyển trả QL', cls: 'bg-orange-50 border-orange-200 text-orange-700', activeCls: 'ring-2 ring-orange-400' },
  { code: 'completed', label: 'Hoàn thành', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeCls: 'ring-2 ring-emerald-400' },
  { code: 'customer_notified', label: 'Báo khách hàng', cls: 'bg-teal-50 border-teal-200 text-teal-700', activeCls: 'ring-2 ring-teal-400' },
  { code: 'not_executed', label: 'Không thực hiện', cls: 'bg-slate-50 border-slate-200 text-slate-500', activeCls: 'ring-2 ring-slate-400' },
  { code: 'pending_dispatch', label: 'Chờ điều phối', cls: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeCls: 'ring-2 ring-indigo-400' },
  { code: 'dispatched', label: 'Đã điều phối', cls: 'bg-cyan-50 border-cyan-200 text-cyan-700', activeCls: 'ring-2 ring-cyan-400' },
  { code: 'coding', label: 'Lập trình', cls: 'bg-violet-50 border-violet-200 text-violet-700', activeCls: 'ring-2 ring-violet-400' },
  { code: 'dms_transfer', label: 'Chuyển DMS', cls: 'bg-lime-50 border-lime-200 text-lime-700', activeCls: 'ring-2 ring-lime-400' },
];

export const formatHoursValue = (value: unknown): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }

  return `${numeric.toLocaleString('vi-VN', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })}h`;
};

export const formatPercentValue = (value: unknown): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return '--';
  }

  return `${numeric.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%`;
};

export const resolveWarningMeta = (warningLevel: unknown) =>
  WARNING_LEVEL_META[String(warningLevel ?? '')] ?? null;

export const resolveSlaMeta = (slaStatus: unknown) =>
  SLA_STATUS_META[String(slaStatus ?? '')] ?? null;

export const resolveAttentionReasonMeta = (
  reason: unknown
): { code: string; label: string; cls: string } | null => {
  const code = String(reason ?? '').trim();
  if (!code) {
    return null;
  }

  const meta = ATTENTION_REASON_META[code];
  if (meta) {
    return { code, ...meta };
  }

  return {
    code,
    label: code.replaceAll('_', ' '),
    cls: 'bg-slate-100 text-slate-600',
  };
};

export const resolveStatusMeta = (
  statusCode: unknown,
  fallbackLabel?: string | null
): { label: string; cls: string } => {
  const normalizedCode = String(statusCode ?? '');
  return (
    STATUS_COLOR_MAP[normalizedCode] ?? {
      label: fallbackLabel || normalizedCode || '--',
      cls: 'bg-slate-100 text-slate-500',
    }
  );
};

export const humanizeKetQua = (value: string): string => {
  switch (value) {
    case 'dang_xu_ly':
      return 'Đang xử lý';
    case 'hoan_thanh':
      return 'Hoàn thành';
    case 'khong_tiep_nhan':
      return 'Không tiếp nhận';
    case 'ket_thuc':
      return 'Kết thúc';
    default:
      return value;
  }
};

export const buildHoursCaption = (request: YeuCau): string => {
  if (request.estimated_hours != null) {
    return `${formatHoursValue(request.total_hours_spent)} / ${formatHoursValue(request.estimated_hours)}`;
  }

  return `${formatHoursValue(request.total_hours_spent)} / --`;
};

export const resolveEstimateSummary = (
  request: YeuCau,
  reasons: string[] = []
): CustomerRequestSummaryMeta => {
  const hasMissingEstimate =
    reasons.includes('missing_estimate') ||
    request.missing_estimate ||
    request.warning_level === 'missing';
  const hasOverEstimate =
    reasons.includes('over_estimate') ||
    request.over_estimate ||
    request.warning_level === 'hard';

  if (hasMissingEstimate) {
    return {
      value: 'Thiếu ước lượng',
      hint: 'Cần bổ sung est để theo dõi',
      valueCls: 'text-slate-700',
    };
  }

  if (hasOverEstimate) {
    return {
      value: buildHoursCaption(request),
      hint:
        request.hours_usage_pct != null
          ? `${formatPercentValue(request.hours_usage_pct)} kế hoạch`
          : 'Đang vượt ước lượng',
      valueCls: 'text-rose-700',
    };
  }

  if (request.estimated_hours != null || request.total_hours_spent != null) {
    return {
      value: buildHoursCaption(request),
      hint:
        request.hours_usage_pct != null
          ? `${formatPercentValue(request.hours_usage_pct)} kế hoạch`
          : 'Đã có ước lượng',
      valueCls: 'text-emerald-700',
    };
  }

  return {
    value: '--',
    hint: 'Chưa có dữ liệu giờ công',
    valueCls: 'text-slate-500',
  };
};

export const resolveSlaSummary = (
  request: YeuCau,
  reasons: string[] = []
): CustomerRequestSummaryMeta => {
  const fallbackSlaStatus = reasons.includes('sla_risk') ? 'at_risk' : '';
  const slaMeta = resolveSlaMeta(request.sla_status || fallbackSlaStatus);

  return {
    value: slaMeta?.label || 'Chưa có SLA',
    hint: request.sla_due_at
      ? `Hạn ${formatDateTimeDdMmYyyy(request.sla_due_at).slice(0, 16)}`
      : 'Chưa chốt hạn SLA',
    valueCls:
      slaMeta?.cls.split(' ').find((token) => token.startsWith('text-')) || 'text-slate-700',
  };
};

export const buildRequestContextCaption = (request: YeuCau): string =>
  [
    request.khach_hang_name || request.customer_name,
    request.project_name,
    request.product_name,
    request.support_service_group_name,
  ]
    .filter(Boolean)
    .join(' · ');

export const resolveRequestProcessCode = (
  request: Partial<YeuCau> | Record<string, unknown>
): string => {
  const currentStatusCode = String(
    (request as Record<string, unknown>).current_status_code ?? ''
  ).trim();
  if (currentStatusCode) {
    return currentStatusCode;
  }

  const currentProcessCode = String(
    (request as Record<string, unknown>).tien_trinh_hien_tai ?? ''
  ).trim();
  if (currentProcessCode) {
    return currentProcessCode;
  }

  const fallbackStatus = String(
    (request as Record<string, unknown>).trang_thai ?? ''
  ).trim();
  if (/^[a-z0-9_]+$/i.test(fallbackStatus)) {
    return fallbackStatus;
  }

  return '';
};

export const resolveDecisionOwner = (
  request: YeuCau
): { label: string; hint: string } => {
  if (request.performer_name) {
    return { label: request.performer_name, hint: 'Người xử lý đang phụ trách' };
  }

  if (request.dispatcher_name) {
    return { label: request.dispatcher_name, hint: 'Điều phối / PM phụ trách' };
  }

  if (request.received_by_name) {
    return { label: request.received_by_name, hint: 'Người tiếp nhận' };
  }

  if (request.requester_name || request.created_by_name || request.nguoi_tao_name) {
    return {
      label:
        request.requester_name ||
        request.created_by_name ||
        request.nguoi_tao_name ||
        '--',
      hint: 'Người tạo yêu cầu',
    };
  }

  return { label: 'Chưa gán', hint: 'Cần xác định owner' };
};

export const resolveDecisionNextAction = (
  request: YeuCau,
  roleFilter: CustomerRequestRoleFilter
): { label: string; hint: string; cls: string } => {
  if (request.sla_status === 'overdue') {
    return {
      label: 'Xu ly gap / leo thang',
      hint: 'Ca đã quá hạn SLA',
      cls: 'bg-rose-100 text-rose-700',
    };
  }

  if (request.warning_level === 'hard' || request.over_estimate) {
    return {
      label: 'Ra soat estimate',
      hint: 'PM cần xem lại kế hoạch và worklog',
      cls: 'bg-rose-100 text-rose-700',
    };
  }

  if (request.missing_estimate || request.warning_level === 'missing') {
    return {
      label: 'Bo sung estimate',
      hint: 'Cần có est để điều phối và theo dõi',
      cls: 'bg-slate-100 text-slate-700',
    };
  }

  if (
    request.trang_thai === 'pending_dispatch' ||
    (!request.performer_name && !request.dispatcher_name)
  ) {
    return {
      label: 'Phan cong nguoi xu ly',
      hint: 'Cần chốt owner để đưa vào dòng xử lý',
      cls: 'bg-indigo-100 text-indigo-700',
    };
  }

  if (request.trang_thai === 'waiting_customer_feedback') {
    return roleFilter === 'creator'
      ? {
          label: 'Đánh giá phản hồi KH',
          hint: 'Creator cần review và mở lại flow',
          cls: 'bg-sky-100 text-sky-700',
        }
      : {
          label: 'Chờ phản hồi KH',
          hint: 'Theo dõi phản hồi để tiếp tục xử lý',
          cls: 'bg-amber-100 text-amber-700',
        };
  }

  if (request.trang_thai === 'returned_to_manager') {
    return {
      label: 'PM rà soát lại',
      hint: 'Ca bị chuyển trả, cần quyết định tiếp',
      cls: 'bg-orange-100 text-orange-700',
    };
  }

  if (request.trang_thai === 'completed') {
    return {
      label: 'Duyệt / báo KH',
      hint: 'Khép vòng sau khi kiểm tra kết quả',
      cls: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (request.trang_thai === 'customer_notified') {
    return {
      label: 'Theo dõi sau thông báo',
      hint: 'Đảm bảo khách đã nhận kết quả',
      cls: 'bg-teal-100 text-teal-700',
    };
  }

  if (request.trang_thai === 'in_progress' || request.trang_thai === 'coding') {
    return {
      label: 'Cập nhật tiến độ',
      hint: 'Ghi worklog và theo dõi giờ công',
      cls: 'bg-amber-100 text-amber-700',
    };
  }

  if (request.sla_status === 'at_risk' || request.warning_level === 'soft') {
    return {
      label: 'Ưu tiên đẩy nhanh',
      hint: 'Ca đang có rủi ro cần bám sát',
      cls: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    label: 'Mở chi tiết để xử lý',
    hint: 'Theo dõi thông tin, task và file liên quan',
    cls: 'bg-slate-100 text-slate-700',
  };
};
