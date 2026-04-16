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

const STATUS_UI_ALIAS_MAP: Record<string, string> = {
  dispatched: 'new_intake',
  pm_missing_customer_info_review: 'waiting_customer_feedback',
};

const readUiMetaString = (
  uiMeta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string => {
  for (const key of keys) {
    const value = String(uiMeta?.[key] ?? '').trim();
    if (value !== '') {
      return value;
    }
  }

  return '';
};

const readUiMetaBoolean = (
  uiMeta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): boolean => {
  for (const key of keys) {
    const value = uiMeta?.[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
      }
    }
  }

  return false;
};

const resolveStatusUiAlias = (
  statusCode: unknown,
  uiMeta?: Record<string, unknown> | null
): string => {
  const rawCode = String(statusCode ?? '').trim();
  const runtimeAlias = readUiMetaString(uiMeta, 'alias_status_code', 'alias_process_code');
  return runtimeAlias || STATUS_UI_ALIAS_MAP[rawCode] || rawCode;
};

export const normalizeStatusCodeForXmlUi = (
  statusCode: unknown,
  uiMeta?: Record<string, unknown> | null
): string => resolveStatusUiAlias(statusCode, uiMeta);

export const isXmlVisibleProcessCode = (
  processCode: unknown,
  uiMeta?: Record<string, unknown> | null
): boolean => {
  const rawCode = String(processCode ?? '').trim();
  if (readUiMetaBoolean(uiMeta, 'hidden_in_ui', 'hidden', 'is_hidden')) {
    return false;
  }

  return rawCode !== 'dispatched';
};

export const filterXmlVisibleProcesses = <T extends { process_code: string; ui_meta?: Record<string, unknown> | null }>(processes: T[]): T[] =>
  processes.filter((process) => isXmlVisibleProcessCode(process.process_code, process.ui_meta));

const COLOR_TOKEN_CLASS_MAP: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  teal: 'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
  violet: 'bg-violet-100 text-violet-700',
  lime: 'bg-lime-100 text-lime-700',
  rose: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  slate: 'bg-slate-100 text-slate-500',
  gray: 'bg-gray-100 text-gray-600',
};

const DEFAULT_STATUS_META = {
  label: '--',
  cls: 'bg-slate-100 text-slate-500',
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
  '4': { label: 'Khẩn', cls: 'bg-gradient-to-r from-red-500 to-red-400 text-white shadow-sm' },
  '3': { label: 'Cao', cls: 'bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-sm' },
  '2': { label: 'Trung bình', cls: 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-sm' },
  '1': { label: 'Thấp', cls: 'bg-gradient-to-r from-slate-400 to-slate-300 text-white shadow-sm' },
};

export const ATTENTION_REASON_META: Record<string, { label: string; cls: string }> = {
  missing_estimate: { label: 'Thiếu ước lượng', cls: 'bg-slate-100 text-slate-700' },
  over_estimate: { label: 'Vượt ước lượng', cls: 'bg-rose-100 text-rose-700' },
  sla_risk: { label: 'Nguy cơ SLA', cls: 'bg-amber-100 text-amber-700' },
  pending_dispatch: { label: 'Cần phân công', cls: 'bg-indigo-100 text-indigo-700' },
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

const LEGACY_STATUS_META_BY_CODE: Record<string, { label: string; cls: string }> = {
  new_intake: { label: 'Mới tiếp nhận', cls: COLOR_TOKEN_CLASS_MAP.sky },
  assigned_to_receiver: { label: 'Giao R thực hiện', cls: COLOR_TOKEN_CLASS_MAP.sky },
  waiting_customer_feedback: { label: 'Đợi phản hồi KH', cls: COLOR_TOKEN_CLASS_MAP.yellow },
  in_progress: { label: 'Đang xử lý', cls: COLOR_TOKEN_CLASS_MAP.amber },
  receiver_in_progress: { label: 'R Đang thực hiện', cls: COLOR_TOKEN_CLASS_MAP.amber },
  not_executed: { label: 'Không thực hiện', cls: COLOR_TOKEN_CLASS_MAP.slate },
  completed: { label: 'Hoàn thành', cls: COLOR_TOKEN_CLASS_MAP.emerald },
  waiting_notification: { label: 'Chờ thông báo khách hàng', cls: COLOR_TOKEN_CLASS_MAP.yellow },
  customer_notified: { label: 'Báo khách hàng', cls: COLOR_TOKEN_CLASS_MAP.teal },
  closed: { label: 'Đóng yêu cầu', cls: COLOR_TOKEN_CLASS_MAP.gray },
  returned_to_manager: { label: 'Chuyển trả QL', cls: COLOR_TOKEN_CLASS_MAP.orange },
  analysis: { label: 'Phân tích', cls: COLOR_TOKEN_CLASS_MAP.purple },
  analysis_completed: { label: 'Chuyển BA Phân tích hoàn thành', cls: COLOR_TOKEN_CLASS_MAP.purple },
  analysis_suspended: { label: 'Chuyển BA Phân tích tạm ngưng', cls: COLOR_TOKEN_CLASS_MAP.purple },
  pending_dispatch: { label: 'Giao PM/Trả YC cho PM', cls: COLOR_TOKEN_CLASS_MAP.sky },
  dispatched: { label: 'Mới tiếp nhận', cls: COLOR_TOKEN_CLASS_MAP.sky },
  coding: { label: 'Lập trình', cls: COLOR_TOKEN_CLASS_MAP.violet },
  coding_in_progress: { label: 'Dev đang thực hiện', cls: COLOR_TOKEN_CLASS_MAP.violet },
  coding_suspended: { label: 'Dev tạm ngưng', cls: COLOR_TOKEN_CLASS_MAP.violet },
  dms_transfer: { label: 'Chuyển DMS', cls: COLOR_TOKEN_CLASS_MAP.lime },
  dms_task_created: { label: 'Tạo task DMS', cls: COLOR_TOKEN_CLASS_MAP.lime },
  dms_in_progress: { label: 'DMS Đang thực hiện', cls: COLOR_TOKEN_CLASS_MAP.lime },
  dms_suspended: { label: 'DMS tạm ngưng', cls: COLOR_TOKEN_CLASS_MAP.lime },
};

const resolveStatusToneClass = (
  statusCode: unknown,
  uiMeta?: Record<string, unknown> | null
): string => {
  const rawCode = String(statusCode ?? '').trim();
  if (rawCode === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE) {
    return COLOR_TOKEN_CLASS_MAP.rose;
  }

  const colorToken = readUiMetaString(uiMeta, 'color_token', 'tone', 'status_color');
  if (colorToken && COLOR_TOKEN_CLASS_MAP[colorToken]) {
    return COLOR_TOKEN_CLASS_MAP[colorToken];
  }

  return LEGACY_STATUS_META_BY_CODE[rawCode]?.cls ?? DEFAULT_STATUS_META.cls;
};

export type CustomerRequestIntakeLane = 'dispatcher' | 'performer';
export const PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE = 'pm_missing_customer_info_review';

const PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META: YeuCauProcessMeta = {
  process_code: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
  process_label: 'Chờ khách hàng cung cấp thông tin',
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
  ui_meta: {
    color_token: 'rose',
    hidden_in_ui: false,
  },
};

const getProcessUiMeta = (
  process: Pick<YeuCauProcessMeta, 'ui_meta'> | null | undefined
): Record<string, unknown> | null => {
  if (!process?.ui_meta || typeof process.ui_meta !== 'object' || Array.isArray(process.ui_meta)) {
    return null;
  }

  return process.ui_meta;
};

const readTransitionMetaString = (
  process: Pick<YeuCauProcessMeta, 'transition_meta'> | null | undefined,
  ...keys: string[]
): string => {
  if (!process?.transition_meta || typeof process.transition_meta !== 'object' || Array.isArray(process.transition_meta)) {
    return '';
  }

  for (const key of keys) {
    const value = String(process.transition_meta[key] ?? '').trim();
    if (value !== '') {
      return value;
    }
  }

  return '';
};

const resolveTransitionSyntheticGroupKey = (
  process: Pick<YeuCauProcessMeta, 'decision_context_code' | 'transition_meta'> | null | undefined
): string =>
  readTransitionMetaString(process, 'synthetic_group_key') || String(process?.decision_context_code ?? '').trim();

const isPmMissingCustomerInfoDecisionProcess = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'decision_context_code' | 'transition_meta'> | null | undefined
): boolean =>
  resolveTransitionSyntheticGroupKey(process) === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE
  || String(process?.process_code ?? '').trim() === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE;

const isClosedStatusCode = (statusCode: string): boolean =>
  ['customer_notified', 'not_executed', 'completed'].includes(statusCode);

const isActiveProcessingStatusCode = (statusCode: string): boolean =>
  ['in_progress', 'analysis', 'coding', 'dms_transfer', 'dms_task_created'].includes(statusCode);

const resolveProcessBucketCode = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'group_code' | 'ui_meta'> | null | undefined
): string =>
  readUiMetaString(getProcessUiMeta(process), 'bucket_code', 'workspace_bucket', 'dispatcher_bucket')
  || String(process?.group_code ?? '').trim()
  || String(process?.process_code ?? '').trim();

const resolveRequestCurrentProcessMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): YeuCauProcessMeta | null => {
  const process = (request as YeuCau).process ?? null;
  if (process && typeof process === 'object') {
    return process as YeuCauProcessMeta;
  }

  const processRow = (request as YeuCau).process_row;
  if (processRow?.process_code) {
    return {
      process_code: processRow.process_code,
      process_label: processRow.process_label,
      group_code: '',
      group_label: '',
      table_name: processRow.table_name,
      default_status: processRow.process_code,
      read_roles: [],
      write_roles: [],
      allowed_next_processes: [],
      form_fields: [],
      list_columns: [],
    };
  }

  return null;
};

const resolveRequestProcessUiMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): Record<string, unknown> | null => getProcessUiMeta(resolveRequestCurrentProcessMeta(request));

const resolveAllowedTransitionUiMeta = (
  processes: YeuCauProcessMeta[],
  processCode: string
): Record<string, unknown> | null => getProcessUiMeta(
  processes.find((process) => process.process_code === processCode) ?? null
);

const resolveFallbackBucketCode = (
  request: Partial<YeuCau> | Record<string, unknown>,
  statusCode: string
): string => {
  if (statusCode === 'returned_to_manager') {
    return 'returned';
  }

  if (statusCode === 'waiting_customer_feedback') {
    return 'feedback';
  }

  if (statusCode === 'completed') {
    return 'approval';
  }

  if (statusCode === 'new_intake') {
    return resolveRequestIntakeLane(request) === 'performer' ? 'active' : 'queue';
  }

  if (statusCode === 'dispatched') {
    return 'active';
  }

  if (statusCode === 'analysis' || statusCode === 'in_progress') {
    return String((request as Record<string, unknown>).performer_user_id ?? '').trim() === '' ? 'queue' : 'active';
  }

  if (isActiveProcessingStatusCode(statusCode)) {
    return 'active';
  }

  if (isClosedStatusCode(statusCode)) {
    return 'closed';
  }

  return '';
};

const resolvePrimaryActionFromWorkflowMeta = (
  request: YeuCau,
  roleFilter: CustomerRequestRoleFilter,
  currentProcessMeta: YeuCauProcessMeta | null
): CustomerRequestPrimaryActionMeta | null => {
  const uiMeta = getProcessUiMeta(currentProcessMeta);
  const actionKind = readUiMetaString(uiMeta, 'primary_action_kind');
  const actionLabel = readUiMetaString(uiMeta, 'primary_action_label');
  if (!actionKind || !actionLabel) {
    return null;
  }

  const normalizedKind = ['estimate', 'worklog', 'transition', 'detail'].includes(actionKind)
    ? (actionKind as CustomerRequestPrimaryActionKind)
    : 'detail';
  const actionHint = readUiMetaString(uiMeta, 'primary_action_hint') || actionLabel;
  const actionIcon = readUiMetaString(uiMeta, 'primary_action_icon') || 'open_in_new';
  const actionToneCode = readUiMetaString(uiMeta, 'primary_action_tone');
  const actionTargetStatusCode = readUiMetaString(uiMeta, 'primary_action_target_status_code');

  return {
    kind: normalizedKind,
    label: actionLabel,
    hint: actionHint,
    cls: COLOR_TOKEN_CLASS_MAP[actionToneCode] ?? resolveStatusToneClass(currentProcessMeta?.process_code, uiMeta),
    icon: actionIcon,
    targetStatusCode: actionTargetStatusCode || null,
  };
};

const resolveOwnerHintByHandlerField = (handlerField: string): string => {
  if (handlerField.includes('dispatcher')) {
    return 'Điều phối / PM phụ trách';
  }
  if (handlerField.includes('receiver')) {
    return 'Người xử lý đang phụ trách';
  }
  if (handlerField.includes('performer') || handlerField.includes('developer')) {
    return 'Người xử lý đang phụ trách';
  }
  if (handlerField.includes('completed')) {
    return 'Người xử lý hoàn thành';
  }

  return 'Người xử lý hiện tại';
};

const resolveRequestCurrentHandlerField = (request: YeuCau): string => {
  const currentProcessMeta = resolveRequestCurrentProcessMeta(request);
  const handlerField = String(currentProcessMeta?.handler_field ?? request.current_owner_field ?? '').trim();
  return handlerField;
};

const resolveRequestCurrentProcessLabel = (
  request: Partial<YeuCau> | Record<string, unknown>
): string => {
  const currentProcessMeta = resolveRequestCurrentProcessMeta(request);
  return String(
    currentProcessMeta?.process_label
    ?? (request as Record<string, unknown>).current_process_label
    ?? (request as Record<string, unknown>).current_status_name_vi
    ?? ''
  ).trim();
};

const buildListKpiStatusMeta = (
  processCode: string,
  label: string,
  cls: string
): {
  code: string;
  label: string;
  cls: string;
  activeCls: string;
} => ({
  code: processCode,
  label,
  cls: cls.replace('100', '50').replace('700', '700').replace('500', '500'),
  activeCls: `ring-2 ${cls.includes('sky-') ? 'ring-sky-400' : cls.includes('yellow-') ? 'ring-yellow-400' : cls.includes('amber-') ? 'ring-amber-400' : cls.includes('purple-') ? 'ring-purple-400' : cls.includes('orange-') ? 'ring-orange-400' : cls.includes('emerald-') ? 'ring-emerald-400' : cls.includes('teal-') ? 'ring-teal-400' : cls.includes('violet-') ? 'ring-violet-400' : cls.includes('lime-') ? 'ring-lime-400' : 'ring-slate-400'}`,
});

const defaultKpiStatusCodes = [
  'new_intake',
  'waiting_customer_feedback',
  'in_progress',
  'analysis',
  'returned_to_manager',
  'completed',
  'customer_notified',
  'not_executed',
  'coding',
  'dms_transfer',
];

export const LIST_KPI_STATUSES = defaultKpiStatusCodes.map((statusCode) => {
  const meta = LEGACY_STATUS_META_BY_CODE[statusCode] ?? DEFAULT_STATUS_META;
  return buildListKpiStatusMeta(statusCode, meta.label, meta.cls);
});

export const STATUS_COLOR_MAP = LEGACY_STATUS_META_BY_CODE;

export const resolveStaticStatusMeta = (statusCode: unknown): { label: string; cls: string } =>
  LEGACY_STATUS_META_BY_CODE[String(statusCode ?? '').trim()] ?? DEFAULT_STATUS_META;

export const resolveStatusMetaFromProcess = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null | undefined,
  fallbackLabel?: string | null
): { label: string; cls: string } => {
  const normalizedCode = normalizeStatusCodeForXmlUi(process?.process_code, getProcessUiMeta(process));
  const label = readUiMetaString(getProcessUiMeta(process), 'display_label', 'status_label')
    || process?.process_label
    || fallbackLabel
    || normalizedCode
    || DEFAULT_STATUS_META.label;

  return {
    label,
    cls: resolveStatusToneClass(normalizedCode, getProcessUiMeta(process)),
  };
};

const resolveStatusMetaWithUiMeta = (
  statusCode: unknown,
  fallbackLabel?: string | null,
  uiMeta?: Record<string, unknown> | null
): { label: string; cls: string } => {
  const normalizedCode = normalizeStatusCodeForXmlUi(statusCode, uiMeta);
  const label = readUiMetaString(uiMeta, 'display_label', 'status_label')
    || fallbackLabel
    || LEGACY_STATUS_META_BY_CODE[normalizedCode]?.label
    || normalizedCode
    || DEFAULT_STATUS_META.label;

  return {
    label,
    cls: resolveStatusToneClass(normalizedCode, uiMeta),
  };
};

export const resolveRequestStatusMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): { label: string; cls: string } =>
  resolveStatusMetaWithUiMeta(
    resolveRequestProcessCode(request),
    resolveRequestCurrentProcessLabel(request),
    resolveRequestProcessUiMeta(request)
  );

export const resolveTransitionStatusMeta = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null | undefined
): { label: string; cls: string } => resolveStatusMetaFromProcess(process);

export const resolveStatusChipMeta = (
  statusCode: unknown,
  fallbackLabel?: string | null,
  processes: YeuCauProcessMeta[] = []
): { label: string; cls: string } =>
  resolveStatusMetaWithUiMeta(
    statusCode,
    fallbackLabel,
    resolveAllowedTransitionUiMeta(processes, String(statusCode ?? '').trim())
  );

const resolveWorkspaceBucketFromMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): string => {
  const currentProcessMeta = resolveRequestCurrentProcessMeta(request);
  const bucketCode = resolveProcessBucketCode(currentProcessMeta);
  if (bucketCode) {
    return bucketCode;
  }

  return resolveFallbackBucketCode(request, resolveRequestCurrentStatusCode(request));
};

const resolvePrimaryActionLabelFromTransition = (
  process: YeuCauProcessMeta | null | undefined
): string => readTransitionMetaString(process, 'action_label', 'primary_action_label');

const resolvePrimaryActionHintFromTransition = (
  process: YeuCauProcessMeta | null | undefined
): string => readTransitionMetaString(process, 'action_hint', 'primary_action_hint');

const resolvePrimaryActionIconFromTransition = (
  process: YeuCauProcessMeta | null | undefined
): string => readTransitionMetaString(process, 'action_icon', 'primary_action_icon');

const resolvePrimaryTransitionProcess = (
  request: YeuCau
): YeuCauProcessMeta | null => {
  const currentProcessMeta = resolveRequestCurrentProcessMeta(request);
  const allowedNextProcesses = Array.isArray(request.allowed_next_processes)
    ? (request.allowed_next_processes as unknown as YeuCauProcessMeta[])
    : [];

  const preferredProcess = allowedNextProcesses.find(
    (process) => readTransitionMetaString(process, 'action_priority') === 'primary'
  );
  if (preferredProcess) {
    return preferredProcess;
  }

  if (currentProcessMeta && isPmMissingCustomerInfoDecisionProcess(currentProcessMeta)) {
    return currentProcessMeta;
  }

  return allowedNextProcesses[0] ?? null;
};

const resolvePrimaryActionFromTransitionMeta = (
  request: YeuCau
): CustomerRequestPrimaryActionMeta | null => {
  const process = resolvePrimaryTransitionProcess(request);
  if (!process) {
    return null;
  }

  const label = resolvePrimaryActionLabelFromTransition(process);
  if (!label) {
    return null;
  }

  return {
    kind: 'transition',
    label,
    hint: resolvePrimaryActionHintFromTransition(process) || label,
    cls: resolveStatusToneClass(process.process_code, getProcessUiMeta(process)),
    icon: resolvePrimaryActionIconFromTransition(process) || 'conversion_path',
    targetStatusCode: process.process_code,
  };
};

const resolveTransitionDecisionPayload = (
  process: YeuCauProcessMeta | null | undefined,
  request: YeuCau
): Record<string, unknown> | undefined => {
  if (!process || !isPmMissingCustomerInfoDecisionProcess(process)) {
    return undefined;
  }

  return {
    decision_context_code: PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
    decision_source_status_code: resolveRequestProcessCode(request) || 'new_intake',
  };
};

export const resolveQuickActionPayloadOverrides = (
  request: YeuCau,
  process: YeuCauProcessMeta | null | undefined
): Record<string, unknown> | undefined => resolveTransitionDecisionPayload(process, request);

export const resolveQuickActionNotePreset = (
  process: YeuCauProcessMeta | null | undefined
): string | undefined => readTransitionMetaString(process, 'note_preset', 'notes_template') || undefined;

export const resolveQuickActionTargetProcess = (
  request: YeuCau
): YeuCauProcessMeta | null => resolvePrimaryTransitionProcess(request);

export const isSyntheticDecisionProcess = (
  process: YeuCauProcessMeta | null | undefined
): boolean => isPmMissingCustomerInfoDecisionProcess(process);

export const resolveSyntheticDecisionLabel = (
  process: YeuCauProcessMeta | null | undefined
): string => process?.process_label || PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META.process_label;

export const resolveSyntheticDecisionMeta = (
  process: YeuCauProcessMeta | null | undefined
): { label: string; cls: string } => resolveStatusMetaFromProcess(process ?? PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META);

export const buildSyntheticDecisionProcessMeta = (
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
  ui_meta: targets[0]?.ui_meta ?? PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META.ui_meta,
});

const resolveDecisionTargets = (visibleProcesses: YeuCauProcessMeta[]): YeuCauProcessMeta[] => {
  const syntheticTargets = visibleProcesses.filter((process) => isPmMissingCustomerInfoDecisionProcess(process));
  if (syntheticTargets.length > 0) {
    return syntheticTargets;
  }

  return visibleProcesses.filter((process) =>
    ['waiting_customer_feedback', 'not_executed'].includes(process.process_code)
    && resolveTransitionSyntheticGroupKey(process) === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE
  );
};

const insertSyntheticDecisionProcess = (
  visibleProcesses: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => {
  const decisionTargets = resolveDecisionTargets(visibleProcesses);
  if (decisionTargets.length === 0) {
    return visibleProcesses;
  }

  const syntheticProcess = buildSyntheticDecisionProcessMeta(decisionTargets, request);
  const nextProcesses: YeuCauProcessMeta[] = [];
  let insertedDecision = false;

  for (const process of visibleProcesses) {
    if (decisionTargets.some((target) => target.process_code === process.process_code)) {
      if (!insertedDecision) {
        nextProcesses.push(syntheticProcess);
        insertedDecision = true;
      }
      continue;
    }

    nextProcesses.push(process);
  }

  if (!insertedDecision) {
    nextProcesses.unshift(syntheticProcess);
  }

  return nextProcesses;
};

const resolveTransitionOptionsFromBackend = (
  processes: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => {
  const visibleProcesses = filterXmlVisibleProcesses(processes);
  return insertSyntheticDecisionProcess(visibleProcesses, request);
};

export const resolveDispatcherBucketCode = (
  request: Partial<YeuCau> | Record<string, unknown>
): string => resolveWorkspaceBucketFromMeta(request);

export const classifyDispatcherWorkspaceRow = (
  request: Partial<YeuCau> | Record<string, unknown>
): 'queue' | 'returned' | 'feedback' | 'approval' | 'active' => {
  const bucketCode = resolveDispatcherBucketCode(request);
  if (bucketCode === 'queue' || bucketCode === 'returned' || bucketCode === 'feedback' || bucketCode === 'approval') {
    return bucketCode;
  }

  return 'active';
};

export const isDispatcherActiveBucket = (bucketCode: string): boolean => bucketCode === 'active';

export const isDispatcherQueueBucket = (bucketCode: string): boolean => bucketCode === 'queue';

export const isDispatcherTeamLoadActiveStatus = (statusCode: string): boolean =>
  !isClosedStatusCode(statusCode);

export const isWorkspaceClosedStatus = (statusCode: string): boolean => isClosedStatusCode(statusCode);

export const isStatusCompletedLike = (statusCode: string): boolean => ['completed', 'customer_notified'].includes(statusCode);

export const resolveProcessDisplayLabel = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null | undefined,
  fallbackLabel?: string | null
): string => resolveStatusMetaFromProcess(process, fallbackLabel).label;

export const resolveStatusDisplayLabel = (
  statusCode: unknown,
  fallbackLabel?: string | null,
  uiMeta?: Record<string, unknown> | null
): string => resolveStatusMetaWithUiMeta(statusCode, fallbackLabel, uiMeta).label;

export const resolveStatusClassName = (
  statusCode: unknown,
  uiMeta?: Record<string, unknown> | null
): string => resolveStatusToneClass(statusCode, uiMeta);

export const resolveOwnerFieldLabel = (handlerField: string): string => resolveOwnerHintByHandlerField(handlerField);

export const resolveRequestOwnerHint = (request: YeuCau): string => {
  const handlerField = resolveRequestCurrentHandlerField(request);
  return handlerField ? resolveOwnerHintByHandlerField(handlerField) : 'Người xử lý hiện tại';
};

export const resolveCurrentProcessMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): YeuCauProcessMeta | null => resolveRequestCurrentProcessMeta(request);

export const resolveTransitionOptionsForRequest = (
  processes: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => resolveTransitionOptionsFromBackend(processes, request);

export const resolveVisibleTransitionOptions = (
  processes: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => resolveTransitionOptionsForRequest(processes, request);

export const buildXmlAlignedTransitionOptionsForRequest = (
  processes: YeuCauProcessMeta[],
  request: Partial<YeuCau> | Record<string, unknown> | null | undefined
): YeuCauProcessMeta[] => buildLegacyXmlAlignedTransitionOptions(processes, request);

export const resolveQuickActionFromWorkflowMeta = (
  request: YeuCau,
  roleFilter: CustomerRequestRoleFilter
): CustomerRequestPrimaryActionMeta | null =>
  resolvePrimaryActionFromWorkflowMeta(request, roleFilter, resolveRequestCurrentProcessMeta(request));

export const resolvePrimaryActionFromNextTransition = (
  request: YeuCau
): CustomerRequestPrimaryActionMeta | null => resolvePrimaryActionFromTransitionMeta(request);

export const resolveUiBucketCode = (request: Partial<YeuCau> | Record<string, unknown>): string =>
  resolveWorkspaceBucketFromMeta(request);

export const isWorkflowDecisionProcessCode = (processCode: unknown): boolean =>
  String(processCode ?? '').trim() === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE;

export const resolveDecisionProcessMeta = (): YeuCauProcessMeta => PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_META;

export const resolveLegacyStatusMeta = (statusCode: unknown): { label: string; cls: string } =>
  resolveStaticStatusMeta(statusCode);

export const resolveListKpiStatusMeta = (statusCode: string): { code: string; label: string; cls: string; activeCls: string } => {
  const meta = resolveStaticStatusMeta(statusCode);
  return buildListKpiStatusMeta(statusCode, meta.label, meta.cls);
};

export const resolveTransitionStatusCodeAlias = (
  statusCode: unknown,
  uiMeta?: Record<string, unknown> | null
): string => normalizeStatusCodeForXmlUi(statusCode, uiMeta);

export const resolveStatusMetaByRequestOrProcess = (
  request: Partial<YeuCau> | Record<string, unknown>,
  process?: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null
): { label: string; cls: string } =>
  process
    ? resolveStatusMetaFromProcess(process)
    : resolveRequestStatusMeta(request);

export const resolveProcessGroupCode = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'group_code' | 'ui_meta'> | null | undefined
): string => resolveProcessBucketCode(process);

export const resolveActionTargetPayload = (
  request: YeuCau,
  process: YeuCauProcessMeta | null | undefined
): Record<string, unknown> | undefined => resolveTransitionDecisionPayload(process, request);

export const resolveActionTargetStatusCode = (
  process: YeuCauProcessMeta | null | undefined
): string | null => process?.process_code ?? null;

export const resolveTransitionActionLabel = (
  process: YeuCauProcessMeta | null | undefined
): string => resolvePrimaryActionLabelFromTransition(process);

export const resolveTransitionActionHint = (
  process: YeuCauProcessMeta | null | undefined
): string => resolvePrimaryActionHintFromTransition(process);

export const resolveTransitionActionIcon = (
  process: YeuCauProcessMeta | null | undefined
): string => resolvePrimaryActionIconFromTransition(process);

export const resolveTransitionGroupKey = (
  process: YeuCauProcessMeta | null | undefined
): string => resolveTransitionSyntheticGroupKey(process);

export const resolveCurrentHandlerField = (request: YeuCau): string => resolveRequestCurrentHandlerField(request);

export const resolveCurrentProcessUiMeta = (
  request: Partial<YeuCau> | Record<string, unknown>
): Record<string, unknown> | null => resolveRequestProcessUiMeta(request);

export const resolveAllowedTransitionMeta = (
  processes: YeuCauProcessMeta[],
  processCode: string
): Record<string, unknown> | null => resolveAllowedTransitionUiMeta(processes, processCode);

export const resolveStatusLabelForTimeline = (
  statusCode: unknown,
  fallbackLabel?: string | null,
  uiMeta?: Record<string, unknown> | null
): string => resolveStatusMetaWithUiMeta(statusCode, fallbackLabel, uiMeta).label;

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

const CREATOR_REVIEW_STATUS_CODES = new Set([
  'waiting_customer_feedback',
]);

const CREATOR_NOTIFY_STATUS_CODES = new Set([
  'completed',
]);

const CREATOR_FOLLOW_UP_STATUS_CODES = new Set([
  'new_intake',
  'pending_dispatch',
  'dispatched',
  'analysis',
  'in_progress',
  'coding',
  'dms_transfer',
  'returned_to_manager',
]);

const PERFORMER_PENDING_STATUS_PRIORITY: Record<string, number> = {
  returned_to_manager: 0,
  new_intake: 1,
  pending_dispatch: 2,
  dispatched: 3,
};

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

const buildLegacyXmlAlignedTransitionOptions = (
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

export const classifyCreatorWorkspaceStatus = (statusCode: string): 'review' | 'notify' | 'follow_up' | 'closed' => {
  if (CREATOR_REVIEW_STATUS_CODES.has(statusCode)) {
    return 'review';
  }

  if (CREATOR_NOTIFY_STATUS_CODES.has(statusCode)) {
    return 'notify';
  }

  if (isClosedStatusCode(statusCode)) {
    return 'closed';
  }

  if (CREATOR_FOLLOW_UP_STATUS_CODES.has(statusCode)) {
    return 'follow_up';
  }

  return 'closed';
};

export const classifyPerformerWorkspaceStatus = (statusCode: string): 'pending' | 'active' | 'closed' => {
  if (isActiveProcessingStatusCode(statusCode)) {
    return 'active';
  }

  if (isClosedStatusCode(statusCode)) {
    return 'closed';
  }

  return 'pending';
};

export const getPerformerWorkspaceStatusPriority = (statusCode: string): number => {
  if (statusCode in PERFORMER_PENDING_STATUS_PRIORITY) {
    return PERFORMER_PENDING_STATUS_PRIORITY[statusCode];
  }

  const bucket = classifyPerformerWorkspaceStatus(statusCode);
  if (bucket === 'active') {
    return 10;
  }

  if (bucket === 'closed') {
    return 30;
  }

  return 20;
};

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
): { label: string; cls: string } => resolveStatusMetaWithUiMeta(statusCode, fallbackLabel);

export const resolveTransitionMeta = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null | undefined
): { label: string; cls: string } => resolveStatusMetaFromProcess(process);

export const resolveTransitionLabel = (
  process: Pick<YeuCauProcessMeta, 'process_code' | 'process_label' | 'ui_meta'> | null | undefined
): string => resolveTransitionMeta(process).label;

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

const readOwnerNameFromStatusRows = (request: YeuCau, ...fieldNames: string[]): string => {
  const statusData = request.status_row?.data;
  const processData = request.process_row?.data;

  for (const fieldName of fieldNames) {
    const statusValue = String((statusData as Record<string, unknown> | undefined)?.[fieldName] ?? '').trim();
    if (statusValue) {
      return statusValue;
    }

    const processValue = String((processData as Record<string, unknown> | undefined)?.[fieldName] ?? '').trim();
    if (processValue) {
      return processValue;
    }
  }

  return '';
};

const resolveCurrentReceiverName = (request: YeuCau): string => {
  const requestRecord = request as unknown as Record<string, unknown>;
  const receiverCandidates = [
    requestRecord.to_user_id_name,
    request.receiver_name,
    requestRecord.receiver_user_id_name,
    requestRecord.to_user_name,
    requestRecord.to_user_full_name,
  ];

  for (const candidate of receiverCandidates) {
    const value = String(candidate ?? '').trim();
    if (value) {
      return value;
    }
  }

  return readOwnerNameFromStatusRows(
    request,
    'to_user_id_name',
    'receiver_name',
    'receiver_user_id_name',
    'to_user_name',
    'to_user_full_name'
  );
};

const resolveOwnerNameByCurrentOwnerField = (request: YeuCau): string => {
  const ownerField = String(request.current_owner_field ?? '').trim();
  if (!ownerField) {
    return '';
  }

  const ownerNameField = ownerField.endsWith('_id')
    ? `${ownerField.slice(0, -3)}_name`
    : `${ownerField}_name`;

  const requestRecord = request as unknown as Record<string, unknown>;
  const fromRequest = String(requestRecord[ownerNameField] ?? '').trim();
  if (fromRequest) {
    return fromRequest;
  }

  return readOwnerNameFromStatusRows(request, ownerNameField);
};

export const resolveDecisionOwner = (
  request: YeuCau
): CustomerRequestOwnerSummaryMeta => {
  const currentReceiverName = resolveCurrentReceiverName(request);
  if (currentReceiverName) {
    return { label: currentReceiverName, hint: 'Người nhận trạng thái hiện tại' };
  }

  const ownerByCurrentField = resolveOwnerNameByCurrentOwnerField(request);
  if (ownerByCurrentField) {
    const ownerHint = request.current_owner_field
      ? resolveOwnerHintByHandlerField(request.current_owner_field)
      : 'Người xử lý hiện tại';
    return { label: ownerByCurrentField, hint: ownerHint };
  }

  if (request.current_owner_name || request.nguoi_xu_ly_name) {
    return {
      label: request.current_owner_name || request.nguoi_xu_ly_name || '--',
      hint: 'Người xử lý hiện tại',
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
  const statusMeta = resolveRequestStatusMeta(request);
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
  const workflowMetaAction = resolveQuickActionFromWorkflowMeta(request, roleFilter);
  if (workflowMetaAction) {
    return workflowMetaAction;
  }

  const transitionMetaAction = resolvePrimaryActionFromNextTransition(request);
  if (transitionMetaAction) {
    return transitionMetaAction;
  }

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
    label: 'Xem chi tiết',
    hint: 'Mở yêu cầu để xem thông tin',
    cls: 'bg-slate-100 text-slate-600',
    icon: 'visibility',
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
