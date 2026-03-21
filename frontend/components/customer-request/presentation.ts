import type { YeuCau } from '../../types';

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

export const STATUS_COLOR_MAP: Record<string, { label: string; cls: string }> = {
  new_intake: { label: 'Mới tiếp nhận', cls: 'bg-sky-100 text-sky-700' },
  waiting_customer_feedback: { label: 'Đợi phản hồi KH', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Đang xử lý', cls: 'bg-amber-100 text-amber-700' },
  not_executed: { label: 'Không thực hiện', cls: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  customer_notified: { label: 'Báo khách hàng', cls: 'bg-teal-100 text-teal-700' },
  returned_to_manager: { label: 'Chuyển trả QL', cls: 'bg-orange-100 text-orange-700' },
  analysis: { label: 'Phân tích', cls: 'bg-purple-100 text-purple-700' },
};

export const WARNING_LEVEL_META: Record<string, { label: string; cls: string }> = {
  hard: { label: 'Vượt estimate', cls: 'bg-rose-100 text-rose-700' },
  soft: { label: 'Sắp chạm estimate', cls: 'bg-amber-100 text-amber-700' },
  missing: { label: 'Thiếu estimate', cls: 'bg-slate-100 text-slate-600' },
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
