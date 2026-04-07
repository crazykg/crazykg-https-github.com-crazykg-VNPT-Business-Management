import type { YeuCau, YeuCauProcessMeta } from '../../types';
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
    | 'review_missing_customer_info'
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
export type CustomerRequestOwnerSummaryMeta = {
  label: string;
  hint: string;
};
export type CustomerRequestHealthChipMeta = {
  code: string;
  label: string;
  cls: string;
};
export type CustomerRequestHealthSummaryMeta = {
  primary: CustomerRequestHealthChipMeta;
  secondary: CustomerRequestHealthChipMeta[];
};
export type CustomerRequestUpdatedSummaryMeta = {
  updatedLabel: string;
  updatedHint: string;
  slaLabel: string;
  slaCls: string;
  dueLabel: string;
};
export type CustomerRequestPrimaryActionKind =
  | 'estimate'
  | 'worklog'
  | 'transition'
  | 'detail';
export type CustomerRequestPrimaryActionMeta = {
  kind: CustomerRequestPrimaryActionKind;
  label: string;
  hint: string;
  cls: string;
  icon: string;
  targetStatusCode?: string | null;
};

const RUNTIME_ONLY_XML_HIDDEN_STATUS_CODES = new Set(['pending_dispatch', 'dispatched']);

const STATUS_UI_ALIAS_MAP: Record<string, string> = {
  pending_dispatch: 'new_intake',
  dispatched: 'new_intake',
};

export const normalizeStatusCodeForXmlUi = (statusCode: unknown): string => {
  const rawCode = String(statusCode ?? '').trim();
  return STATUS_UI_ALIAS_MAP[rawCode] ?? rawCode;
};

export const isXmlVisibleProcessCode = (processCode: unknown): boolean =>
  !RUNTIME_ONLY_XML_HIDDEN_STATUS_CODES.has(String(processCode ?? '').trim());

export const filterXmlVisibleProcesses = <T extends { process_code: string }>(processes: T[]): T[] =>
  processes.filter((process) => isXmlVisibleProcessCode(process.process_code));

export type CustomerRequestIntakeLane = 'dispatcher' | 'performer';
export const PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE = 'pm_missing_customer_info_review';

const PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META: YeuCauProcessMeta = {
  process_code: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
  process_label: 'PM đánh giá thiếu TT KH',
  group_code: 'intake',
  group_label: 'Tiếp nhận',
  table_name: 'customer_request_pm_missing_customer_info_review',
  default_status: 'new_intake',
  read_roles: [],
  write_roles: [],
  allowed_next_processes: [],
  form_fields: [],
  list_columns: [],
  decision_context_code: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
};

const readRequestStringField = (
  request: Partial<YeuCau> | Record<string, unknown>,
  ...fieldNames: string[]
): string => {
  for (const fieldName of fieldNames) {
    const value = String((request as Record<string, unknown>)[fieldName] ?? '').trim();
    if (value !== '') {
      return value;
    }
  }

  return '';
};

const hasRequestValue = (
  request: Partial<YeuCau> | Record<string, unknown>,
  ...fieldNames: string[]
): boolean => readRequestStringField(request, ...fieldNames) !== '';

export const resolveRequestCurrentStatusCode = (
  request: Partial<YeuCau> | Record<string, unknown>
): string => normalizeStatusCodeForXmlUi(resolveRequestProcessCode(request));

export const resolveRequestIntakeLane = (
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): CustomerRequestIntakeLane | null => {
  if (!request || resolveRequestCurrentStatusCode(request) !== 'new_intake') {
    return null;
  }

  const dispatchRoute = readRequestStringField(request, 'dispatch_route');
  const hasPerformer = hasRequestValue(
    request,
    'performer_user_id',
    'performer_name',
    'r_id',
    'r_name'
  );
  const hasDispatcher = hasRequestValue(request, 'dispatcher_user_id', 'dispatcher_name');

  if (dispatchRoute === 'self_handle' || dispatchRoute === 'assign_direct') {
    return 'performer';
  }

  if (dispatchRoute === 'assign_pm') {
    return hasPerformer ? 'performer' : 'dispatcher';
  }

  if (hasPerformer) {
    return 'performer';
  }

  if (hasDispatcher || dispatchRoute === '') {
    return 'dispatcher';
  }

  return 'dispatcher';
};

const PERFORMER_INTAKE_STATUS_CODES = new Set(['assigned_to_receiver', 'returned_to_manager']);
const DISPATCHER_INTAKE_STATUS_CODES = new Set(['assigned_to_receiver', 'returned_to_manager']);
const DISPATCHER_INTAKE_PM_MISSING_INFO_TARGETS = new Set([
  'not_executed',
  'waiting_customer_feedback',
]);
const IN_PROGRESS_XML_TARGET_STATUS_CODES = new Set(['completed', 'returned_to_manager']);

const PM_MISSING_INFO_DECISION_SOURCE_STATUSES = new Set([
  'returned_to_manager',
]);

export const filterTransitionOptionsForRequest = <T extends { process_code: string }>(
  processes: T[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): T[] => {
  const visibleProcesses = filterXmlVisibleProcesses(processes);
  if (!request) {
    return visibleProcesses;
  }

  const currentStatusCode = resolveRequestCurrentStatusCode(request);
  if (currentStatusCode === 'in_progress') {
    return visibleProcesses.filter((process) =>
      IN_PROGRESS_XML_TARGET_STATUS_CODES.has(process.process_code)
    );
  }

  if (currentStatusCode !== 'new_intake') {
    return visibleProcesses;
  }

  const intakeLane = resolveRequestIntakeLane(request);
  if (intakeLane === 'performer') {
    return visibleProcesses.filter((process) => PERFORMER_INTAKE_STATUS_CODES.has(process.process_code));
  }

  if (intakeLane === 'dispatcher') {
    return visibleProcesses.filter((process) => DISPATCHER_INTAKE_STATUS_CODES.has(process.process_code));
  }

  return visibleProcesses;
};

export const isPmMissingCustomerInfoDecisionProcessCode = (processCode: unknown): boolean =>
  String(processCode ?? '').trim() === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE;

const buildPmMissingCustomerInfoDecisionProcessMeta = (
  targets: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta => ({
  ...PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META,
  group_code: targets[0]?.group_code ?? PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META.group_code,
  group_label: targets[0]?.group_label ?? PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META.group_label,
  default_status:
    resolveRequestCurrentStatusCode(request ?? {}) || targets[0]?.default_status || 'new_intake',
  allowed_next_processes: targets.map((target) => target.process_code),
  decision_source_status_code: resolveRequestCurrentStatusCode(request ?? {}),
});

export const buildXmlAlignedTransitionOptionsForRequest = (
  processes: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => {
  const visibleProcesses = filterTransitionOptionsForRequest(processes, request);
  const decisionTargets = visibleProcesses.filter(
    (process) => process.decision_context_code === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE
  );

  if (decisionTargets.length > 0) {
    const waitingCustomerFeedbackProcess =
      decisionTargets.find((process) => process.process_code === 'waiting_customer_feedback')
      ?? visibleProcesses.find((process) => process.process_code === 'waiting_customer_feedback')
      ?? null;

    if (waitingCustomerFeedbackProcess) {
      const nextProcesses: YeuCauProcessMeta[] = [];
      let insertedWaitingCustomerFeedback = false;

      for (const process of visibleProcesses) {
        if (process.decision_context_code === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE) {
          if (!insertedWaitingCustomerFeedback) {
            nextProcesses.push(waitingCustomerFeedbackProcess);
            insertedWaitingCustomerFeedback = true;
          }
          continue;
        }

        nextProcesses.push(process);
      }

      return nextProcesses;
    }

    const nextProcesses: YeuCauProcessMeta[] = [];
    let insertedDecision = false;

    for (const process of visibleProcesses) {
      if (process.decision_context_code === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE) {
        if (!insertedDecision) {
          nextProcesses.push(buildPmMissingCustomerInfoDecisionProcessMeta(decisionTargets, request));
          insertedDecision = true;
        }
        continue;
      }

      nextProcesses.push(process);
    }

    return nextProcesses;
  }

  if (!request) {
    return visibleProcesses;
  }

  const currentStatusCode = resolveRequestCurrentStatusCode(request);
  const isDispatcherNewIntake =
    currentStatusCode === 'new_intake' && resolveRequestIntakeLane(request) === 'dispatcher';
  const isReturnedToManagerPmReview = PM_MISSING_INFO_DECISION_SOURCE_STATUSES.has(currentStatusCode);

  if (!isDispatcherNewIntake && !isReturnedToManagerPmReview) {
    return visibleProcesses;
  }

  let insertedDecision = false;
  const nextProcesses: YeuCauProcessMeta[] = [];

  for (const process of visibleProcesses) {
    if (DISPATCHER_INTAKE_PM_MISSING_INFO_TARGETS.has(process.process_code)) {
      if (!insertedDecision) {
        nextProcesses.push(buildPmMissingCustomerInfoDecisionProcessMeta(
          visibleProcesses.filter((item) => DISPATCHER_INTAKE_PM_MISSING_INFO_TARGETS.has(item.process_code)),
          request
        ));
        insertedDecision = true;
      }
      continue;
    }

    nextProcesses.push(process);
  }

  return nextProcesses;
};

export const STATUS_COLOR_MAP: Record<string, { label: string; cls: string }> = {
  new_intake: { label: 'Tiếp nhận', cls: 'bg-sky-100 text-sky-700' },
  [PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE]: {
    label: 'PM đánh giá thiếu TT KH',
    cls: 'bg-rose-100 text-rose-700',
  },
  assigned_to_receiver: { label: 'Giao R thực hiện', cls: 'bg-cyan-100 text-cyan-700' },
  waiting_customer_feedback: { label: 'Chờ khách hàng cung cấp thông tin', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'R Đang thực hiện', cls: 'bg-amber-100 text-amber-700' },
  not_executed: { label: 'Không tiếp nhận', cls: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  customer_notified: { label: 'Thông báo khách hàng', cls: 'bg-teal-100 text-teal-700' },
  returned_to_manager: { label: 'Giao PM/Trả YC cho PM', cls: 'bg-orange-100 text-orange-700' },
  analysis: { label: 'Chuyển BA Phân tích', cls: 'bg-purple-100 text-purple-700' },
  analysis_completed: { label: 'Chuyển BA Phân tích hoàn thành', cls: 'bg-indigo-100 text-indigo-700' },
  analysis_suspended: { label: 'Chuyển BA Phân tích tạm ngưng', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  pending_dispatch: { label: 'Tiếp nhận', cls: 'bg-sky-100 text-sky-700' },
  dispatched: { label: 'Tiếp nhận', cls: 'bg-sky-100 text-sky-700' },
  coding: { label: 'Lập trình', cls: 'bg-violet-100 text-violet-700' },
  coding_in_progress: { label: 'Dev đang thực hiện', cls: 'bg-violet-100 text-violet-700' },
  coding_suspended: { label: 'Dev tạm ngưng', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  dms_transfer: { label: 'Chuyển DMS', cls: 'bg-lime-100 text-lime-700' },
  dms_task_created: { label: 'Tạo task', cls: 'bg-lime-100 text-lime-700' },
  dms_in_progress: { label: 'DMS Đang thực hiện', cls: 'bg-lime-100 text-lime-700' },
  dms_suspended: { label: 'DMS tạm ngưng', cls: 'bg-emerald-100 text-emerald-700' },
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
  pending_dispatch: { label: 'Tiếp nhận', cls: 'bg-indigo-100 text-indigo-700' },
  waiting_customer_feedback: { label: 'Chờ khách hàng cung cấp thông tin', cls: 'bg-yellow-100 text-yellow-700' },
  returned_to_manager: { label: 'Giao PM/Trả YC cho PM', cls: 'bg-orange-100 text-orange-700' },
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
  { code: 'new_intake', label: 'Tiếp nhận', cls: 'bg-sky-50 border-sky-200 text-sky-700', activeCls: 'ring-2 ring-sky-400' },
  { code: 'assigned_to_receiver', label: 'Giao R thực hiện', cls: 'bg-cyan-50 border-cyan-200 text-cyan-700', activeCls: 'ring-2 ring-cyan-400' },
  { code: 'waiting_customer_feedback', label: 'Chờ khách hàng cung cấp thông tin', cls: 'bg-yellow-50 border-yellow-200 text-yellow-700', activeCls: 'ring-2 ring-yellow-400' },
  { code: 'in_progress', label: 'R Đang thực hiện', cls: 'bg-amber-50 border-amber-200 text-amber-700', activeCls: 'ring-2 ring-amber-400' },
  { code: 'analysis', label: 'Chuyển BA Phân tích', cls: 'bg-purple-50 border-purple-200 text-purple-700', activeCls: 'ring-2 ring-purple-400' },
  { code: 'analysis_completed', label: 'Chuyển BA Phân tích hoàn thành', cls: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeCls: 'ring-2 ring-indigo-400' },
  { code: 'analysis_suspended', label: 'Chuyển BA Phân tích tạm ngưng', cls: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700', activeCls: 'ring-2 ring-fuchsia-400' },
  { code: 'returned_to_manager', label: 'Giao PM/Trả YC cho PM', cls: 'bg-orange-50 border-orange-200 text-orange-700', activeCls: 'ring-2 ring-orange-400' },
  { code: 'coding', label: 'Lập trình', cls: 'bg-violet-50 border-violet-200 text-violet-700', activeCls: 'ring-2 ring-violet-400' },
  { code: 'coding_in_progress', label: 'Dev đang thực hiện', cls: 'bg-violet-50 border-violet-200 text-violet-700', activeCls: 'ring-2 ring-violet-400' },
  { code: 'coding_suspended', label: 'Dev tạm ngưng', cls: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700', activeCls: 'ring-2 ring-fuchsia-400' },
  { code: 'dms_transfer', label: 'Chuyển DMS', cls: 'bg-lime-50 border-lime-200 text-lime-700', activeCls: 'ring-2 ring-lime-400' },
  { code: 'dms_task_created', label: 'Tạo task', cls: 'bg-lime-50 border-lime-200 text-lime-700', activeCls: 'ring-2 ring-lime-400' },
  { code: 'dms_in_progress', label: 'DMS Đang thực hiện', cls: 'bg-lime-50 border-lime-200 text-lime-700', activeCls: 'ring-2 ring-lime-400' },
  { code: 'dms_suspended', label: 'DMS tạm ngưng', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeCls: 'ring-2 ring-emerald-400' },
  { code: 'completed', label: 'Hoàn thành', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeCls: 'ring-2 ring-emerald-400' },
  { code: 'customer_notified', label: 'Thông báo khách hàng', cls: 'bg-teal-50 border-teal-200 text-teal-700', activeCls: 'ring-2 ring-teal-400' },
  { code: 'not_executed', label: 'Không tiếp nhận', cls: 'bg-slate-50 border-slate-200 text-slate-500', activeCls: 'ring-2 ring-slate-400' },
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
  const normalizedCode = normalizeStatusCodeForXmlUi(statusCode);
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
): CustomerRequestOwnerSummaryMeta => {
  if (request.current_owner_name || request.nguoi_xu_ly_name) {
    return {
      label: request.current_owner_name || request.nguoi_xu_ly_name || '--',
      hint: 'Người nhận trạng thái hiện tại',
    };
  }

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

export const resolveOwnerSummaryMeta = (
  request: YeuCau
): CustomerRequestOwnerSummaryMeta => resolveDecisionOwner(request);

export const resolveHoursSummaryMeta = (
  request: YeuCau,
  reasons: string[] = []
): CustomerRequestSummaryMeta => resolveEstimateSummary(request, reasons);

export const resolveUpdatedSummaryMeta = (
  request: YeuCau,
  reasons: string[] = []
): CustomerRequestUpdatedSummaryMeta => {
  const slaMeta = resolveSlaSummary(request, reasons);
  return {
    updatedLabel: request.updated_at
      ? formatDateTimeDdMmYyyy(request.updated_at).slice(0, 16)
      : '--',
    updatedHint: request.updated_at ? 'Mới nhất' : 'Chưa có thời gian cập nhật',
    slaLabel: slaMeta.value,
    slaCls:
      resolveSlaMeta(request.sla_status || (reasons.includes('sla_risk') ? 'at_risk' : ''))?.cls ??
      'bg-slate-100 text-slate-500',
    dueLabel: request.sla_due_at
      ? `Hạn: ${formatDateTimeDdMmYyyy(request.sla_due_at).slice(0, 16)}`
      : 'Hạn: --',
  };
};

export const resolveHealthSummaryMeta = (
  request: YeuCau
): CustomerRequestHealthSummaryMeta => {
  const statusMeta = resolveStatusMeta(
    request.trang_thai || request.current_status_code,
    request.current_status_name_vi
  );
  const warningMeta = resolveWarningMeta(request.warning_level);
  const slaMeta = resolveSlaMeta(request.sla_status);

  return {
    primary: {
      code: resolveRequestCurrentStatusCode(request) || 'unknown',
      label: statusMeta.label,
      cls: statusMeta.cls,
    },
    secondary: [
      warningMeta
        ? { code: String(request.warning_level ?? 'warning'), label: warningMeta.label, cls: warningMeta.cls }
        : null,
      slaMeta
        ? { code: String(request.sla_status ?? 'sla'), label: slaMeta.label, cls: slaMeta.cls }
        : null,
    ].filter((item): item is CustomerRequestHealthChipMeta => item !== null),
  };
};

export const resolvePrimaryActionMeta = (
  request: YeuCau,
  roleFilter: CustomerRequestRoleFilter
): CustomerRequestPrimaryActionMeta => {
  const statusCode = resolveRequestCurrentStatusCode(request);
  const intakeLane = resolveRequestIntakeLane(request);

  if (request.sla_status === 'overdue') {
    return {
      kind: 'detail',
      label: 'Xu ly gap / leo thang',
      hint: 'Ca đã quá hạn SLA',
      cls: 'bg-rose-100 text-rose-700',
      icon: 'warning',
    };
  }

  if (request.warning_level === 'hard' || request.over_estimate) {
    return {
      kind: 'detail',
      label: 'Ra soat estimate',
      hint: 'PM cần xem lại kế hoạch và worklog',
      cls: 'bg-rose-100 text-rose-700',
      icon: 'query_stats',
    };
  }

  if (request.missing_estimate || request.warning_level === 'missing') {
    return {
      kind: 'estimate',
      label: 'Bo sung estimate',
      hint: 'Cần có est để điều phối và theo dõi',
      cls: 'bg-slate-100 text-slate-700',
      icon: 'calculate',
    };
  }

  if (
    statusCode === 'pending_dispatch' ||
    (!request.performer_name && !request.dispatcher_name)
  ) {
    return {
      kind: 'transition',
      label: 'Phan cong nguoi xu ly',
      hint: 'Cần chốt owner để đưa vào dòng xử lý',
      cls: 'bg-indigo-100 text-indigo-700',
      icon: 'conversion_path',
    };
  }

  if (statusCode === 'new_intake' && intakeLane === 'dispatcher') {
    return {
      kind: 'transition',
      label: 'PM rà soát tiếp nhận',
      hint: 'Cần chốt hướng xử lý đúng theo nhánh PM điều phối',
      cls: 'bg-indigo-100 text-indigo-700',
      icon: 'rule',
      targetStatusCode: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
    };
  }

  if (statusCode === 'new_intake' && intakeLane === 'performer') {
    const performerLabel = request.performer_name || 'người xử lý';
    return {
      kind: 'transition',
      label: 'Chờ Performer nhận việc',
      hint: `Đã giao cho ${performerLabel} — chờ xác nhận`,
      cls: 'bg-sky-100 text-sky-700',
      icon: 'play_circle',
      targetStatusCode: 'in_progress',
    };
  }

  if (statusCode === 'waiting_customer_feedback') {
    return roleFilter === 'creator'
      ? {
          kind: 'detail',
          label: 'Đánh giá phản hồi KH',
          hint: 'Creator cần review và mở lại flow',
          cls: 'bg-sky-100 text-sky-700',
          icon: 'fact_check',
        }
      : {
          kind: 'detail',
          label: 'Chờ phản hồi KH',
          hint: 'Theo dõi phản hồi để tiếp tục xử lý',
          cls: 'bg-amber-100 text-amber-700',
          icon: 'hourglass_top',
        };
  }

  if (statusCode === 'returned_to_manager') {
    return {
      kind: 'transition',
      label: 'PM rà soát lại',
      hint: 'Ca bị chuyển trả, cần quyết định tiếp',
      cls: 'bg-orange-100 text-orange-700',
      icon: 'assignment_return',
      targetStatusCode: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
    };
  }

  if (statusCode === 'completed') {
    return {
      kind: 'detail',
      label: 'Duyệt / báo KH',
      hint: 'Khép vòng sau khi kiểm tra kết quả',
      cls: 'bg-emerald-100 text-emerald-700',
      icon: 'campaign',
    };
  }

  if (statusCode === 'customer_notified') {
    return {
      kind: 'detail',
      label: 'Theo dõi sau thông báo',
      hint: 'Đảm bảo khách đã nhận kết quả',
      cls: 'bg-teal-100 text-teal-700',
      icon: 'visibility',
    };
  }

  if (['in_progress', 'analysis', 'coding', 'dms_transfer'].includes(statusCode)) {
    return {
      kind: 'worklog',
      label: 'Cập nhật tiến độ',
      hint: 'Ghi worklog và theo dõi giờ công',
      cls: 'bg-amber-100 text-amber-700',
      icon: 'timer',
    };
  }

  if (request.sla_status === 'at_risk' || request.warning_level === 'soft') {
    return {
      kind: 'detail',
      label: 'Ưu tiên đẩy nhanh',
      hint: 'Ca đang có rủi ro cần bám sát',
      cls: 'bg-amber-100 text-amber-700',
      icon: 'priority_high',
    };
  }

  return {
    kind: 'detail',
    label: 'Mở chi tiết để xử lý',
    hint: 'Theo dõi thông tin, task và file liên quan',
    cls: 'bg-slate-100 text-slate-700',
    icon: 'open_in_new',
  };
};

export const resolveDecisionNextAction = (
  request: YeuCau,
  roleFilter: CustomerRequestRoleFilter
): { label: string; hint: string; cls: string } => {
  const meta = resolvePrimaryActionMeta(request, roleFilter);
  return {
    label: meta.label,
    hint: meta.hint,
    cls: meta.cls,
  };
};
