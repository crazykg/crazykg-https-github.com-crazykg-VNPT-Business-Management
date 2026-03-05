import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCustomerRequest,
  deleteCustomerRequest,
  exportCustomerRequestsCsv,
  fetchCustomerRequestHistory,
  fetchCustomerRequestHistories,
  fetchCustomerRequestsPage,
  fetchSupportRequestReceivers,
  fetchSupportRequestReferenceMatches,
  fetchWorkflowFormFieldConfigs,
  fetchWorkflowStatusCatalogs,
  importCustomerRequests,
  isRequestCanceledError,
  updateCustomerRequest,
} from '../services/v5Api';
import {
  Customer,
  CustomerPersonnel,
  CustomerRequestChangeLogEntry,
  CustomerRequest,
  Employee,
  ProjectItemMaster,
  SupportRequest,
  SupportRequestTaskStatus,
  SupportServiceGroup,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
} from '../types';
import { SearchableSelect } from './SearchableSelect';
import { parseImportFile, pickImportSheetByModule } from '../utils/importParser';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type FormMode = 'create' | 'edit';

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  currentUserId?: string | number | null;
  canReadRequests?: boolean;
  canWriteRequests?: boolean;
  canDeleteRequests?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

interface CustomerRequestTimelineItem {
  key: string;
  entry: CustomerRequestChangeLogEntry;
  sourceType: string;
  occurredAtTs: number;
  statusDisplay: {
    mode: 'transition' | 'single';
    fromLabel: string;
    toLabel: string;
    singleLabel: string;
    plainText: string;
  };
  taskCodeDisplay: string;
}

interface CustomerRequestTimelineNode {
  transition: CustomerRequestTimelineItem;
  children: CustomerRequestTimelineItem[];
}

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeFieldToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

type WorkflowSemanticFieldKey =
  | 'exchange_date'
  | 'exchange_content'
  | 'customer_feedback_date'
  | 'customer_feedback_content';

const WORKFLOW_SEMANTIC_FIELD_TOKENS: Record<WorkflowSemanticFieldKey, string[]> = {
  exchange_date: [
    'exchangedate',
    'fieldngaytraodoilaivoikhachhang',
    'fieldngaytraodilivikhachhang',
    'ngaytraodoilaivoikhachhang',
    'ngaytraodilivikhachhang',
  ],
  exchange_content: [
    'exchangecontent',
    'fieldnoidungtraodoi',
    'fieldnidungtraodi',
    'noidungtraodoi',
  ],
  customer_feedback_date: [
    'customerfeedbackdate',
    'fieldngaykhachhangphanhoi',
    'fieldngaykhacahangphnhi',
    'ngaykhachhangphanhoi',
    'ngaykhacahangphnhi',
  ],
  customer_feedback_content: [
    'customerfeedbackcontent',
    'fieldnoidungkhachhangphanhoi',
    'fieldnidungkhachhangphnhi',
    'noidungkhachhangphanhoi',
    'nidungkhachhangphnhi',
  ],
};

const WORKFLOW_WORKLOG_FIELD_TOKENS = ['worklogxly', 'worklogxuly', 'worklog', 'nhatkyxuly', 'nhatkyxly'];

const WORKFLOW_PROCESSING_DATE_FIELD_TOKENS = ['ngayxly', 'ngayxuly', 'processingdate', 'ngaythuchienxuly'];

const WORKFLOW_PLANNED_COMPLETION_FIELD_TOKENS = [
  'ngayhoanthanhdukien',
  'ngayhoanthanhdk',
  'ngaydukienhoanthanh',
  'plannedcompletiondate',
  'expectedcompletiondate',
];

const WORKFLOW_ACTUAL_COMPLETION_FIELD_TOKENS = [
  'ngayhoanthanhthucte',
  'ngayhoanthanthucte',
  'ngayhoanathanhthct',
  'actualcompletiondate',
  'actualcompleteddate',
];

const WORKFLOW_CUSTOMER_NOTIFY_DATE_FIELD_TOKENS = [
  'ngaybaokhachhang',
  'ngaybaoakhanghang',
  'ngaybaokh',
  'customernotifydate',
];

const WORKFLOW_CUSTOMER_NOTIFY_USER_FIELD_TOKENS = [
  'nguoibaokhachhang',
  'ngibaokhachhang',
  'ngibaokhaahhang',
  'customernotifyuser',
];

const WORKFLOW_RETURN_TO_MANAGER_DATE_FIELD_TOKENS = [
  'ngaychuyentra',
  'ngaychuyntr',
  'returntransferreddate',
  'returntomanagerdate',
];

const WORKFLOW_RETURN_TO_MANAGER_CONTENT_FIELD_TOKENS = [
  'noidungchuyentra',
  'nidungchuyntr',
  'transferreturncontent',
  'returntomanagercontent',
];

const WORKFLOW_NOT_EXECUTE_REASON_FIELD_TOKENS = [
  'nguyennhankhongthuchien',
  'nguyennhankhngthchin',
  'lydokhongthuchien',
  'reasonnotexecute',
  'reasonnotperform',
];

const WORKFLOW_PROGRAMMING_FROM_DATE_FIELD_TOKENS = ['tngay', 'tungay', 'fromdate'];

const WORKFLOW_PROGRAMMING_PROGRESS_FIELD_TOKENS = ['tind', 'tiendo', 'progress'];

const WORKFLOW_PROGRAMMING_TO_DATE_FIELD_TOKENS = ['dnngay', 'denngay', 'todate'];

const WORKFLOW_PROGRAMMING_EXTEND_DATE_FIELD_TOKENS = ['ngaygiahn', 'giahan', 'extendeddate'];

const WORKFLOW_PROGRAMMING_EXECUTOR_FIELD_TOKENS = ['ngithchin', 'nguoithuchien', 'executor'];
const WORKFLOW_PROGRAMMING_DMS_EXCHANGE_DATE_FIELD_TOKENS = [
  'ngaytraodoilaivoidms',
  'ngaytraodoidms',
  'dms_exchange_date',
  'dmsexchangedate',
];
const WORKFLOW_PROGRAMMING_DMS_EXCHANGE_CONTENT_FIELD_TOKENS = [
  'noidungtraodoidms',
  'dms_exchange_content',
  'dmsexchangecontent',
  'dmsnoidungtraodoi',
];
const WORKFLOW_PROGRAMMING_DMS_FEEDBACK_DATE_FIELD_TOKENS = [
  'ngaydmsphanhoi',
  'dms_feedback_date',
  'dmsfeedbackdate',
];
const WORKFLOW_PROGRAMMING_DMS_FEEDBACK_CONTENT_FIELD_TOKENS = [
  'noidungdmsphanhoi',
  'dms_feedback_content',
  'dmsfeedbackcontent',
  'dmsnoidungphanhoi',
];
const WORKFLOW_PROGRAMMING_DMS_CREATE_TASK_DATE_FIELD_TOKENS = [
  'create_task_date',
  'ngaytao',
  'ngaytaotask',
];
const WORKFLOW_PROGRAMMING_PAUSE_DATE_FIELD_TOKENS = ['ngaytamngung', 'pausedate', 'pause_date'];
const WORKFLOW_PROGRAMMING_PAUSE_USER_FIELD_TOKENS = ['nguoitamngung', 'pauseuser', 'pauseuserid', 'pause_user_id'];
const WORKFLOW_PROGRAMMING_PAUSE_REASON_FIELD_TOKENS = ['noidungtamngung', 'pausereason', 'pause_reason'];
const WORKFLOW_PROGRAMMING_UPCODE_DATE_FIELD_TOKENS = ['ngayupcode', 'upcodedate', 'upcode_date'];
const WORKFLOW_PROGRAMMING_UPCODER_FIELD_TOKENS = ['nguoiupcode', 'upcoder', 'upcoderid', 'upcoder_id'];
const WORKFLOW_PROGRAMMING_UPCODE_STATUS_FIELD_TOKENS = [
  'trangthaiupcode',
  'upcodestatus',
  'upcode_status',
];
const WORKFLOW_PROGRAMMING_UPCODE_WORKLOG_FIELD_TOKENS = [
  'worklogupcode',
  'nhatkyupcode',
  ...WORKFLOW_WORKLOG_FIELD_TOKENS,
];
const WORKFLOW_PROGRAMMING_COMPLETION_USER_FIELD_TOKENS = [
  'nguoihoanthanh',
  'completionuser',
  'completionuserid',
  'completion_user_id',
];
const WORKFLOW_PROGRAMMING_COMPLETION_DATE_FIELD_TOKENS = [
  'ngayhoanthanh',
  'completiondate',
  'actualcompletiondate',
];

const resolveWorkflowSemanticFieldKey = (
  field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>
): WorkflowSemanticFieldKey | null => {
  const keyToken = normalizeFieldToken(field.field_key || '');
  const labelToken = normalizeFieldToken(field.field_label || '');

  const tokens = [keyToken, labelToken].filter((token) => token !== '');
  if (tokens.length === 0) {
    return null;
  }

  const entries = Object.entries(WORKFLOW_SEMANTIC_FIELD_TOKENS) as Array<[WorkflowSemanticFieldKey, string[]]>;
  for (const [semanticKey, semanticTokens] of entries) {
    if (tokens.some((token) => semanticTokens.includes(token))) {
      return semanticKey;
    }
  }

  return null;
};

const normalizeDateForComparison = (value: string): string | null => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const formatIsoDateToVn = (value: string): string => {
  const text = String(value || '').trim();
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return text;
  }

  return `${matched[3]}/${matched[2]}/${matched[1]}`;
};

const ddMmYyyyToIso = (value: string): string => {
  const text = String(value || '').trim();
  const matched = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!matched) {
    return '';
  }

  const day = Number(matched[1]);
  const month = Number(matched[2]);
  const year = Number(matched[3]);
  const iso = `${matched[3]}-${matched[2]}-${matched[1]}`;
  const date = new Date(`${iso}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return '';
  }

  return iso;
};

const normalizeDateValueForDateInput = (value: string): string => {
  const text = String(value || '').trim();
  if (text === '') {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return ddMmYyyyToIso(text);
};

const toDisplayDate = (value: unknown): string => {
  const text = normalizeText(value);
  if (text === '') {
    return '--';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleDateString('vi-VN');
};

const toDisplayDateTime = (value: unknown): string => {
  const text = normalizeText(value);
  if (text === '') {
    return '--';
  }

  const normalized = text.includes(' ') && !text.includes('T')
    ? text.replace(' ', 'T')
    : text;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const toOccurredAtTimestamp = (value: unknown): number => {
  const text = normalizeText(value);
  if (text === '') {
    return 0;
  }

  const normalized = text.includes(' ') && !text.includes('T')
    ? text.replace(' ', 'T')
    : text;
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? ts : 0;
};

const FLOW_BADGE_CLASS: Record<string, string> = {
  GD1: 'bg-blue-100 text-blue-700',
  GD2: 'bg-orange-100 text-orange-700',
  GD3: 'bg-amber-100 text-amber-700',
  GD4: 'bg-rose-100 text-rose-700',
  GD5: 'bg-emerald-100 text-emerald-700',
  GD6: 'bg-cyan-100 text-cyan-700',
  GD7: 'bg-slate-100 text-slate-700',
  GD8: 'bg-indigo-100 text-indigo-700',
  GD9: 'bg-violet-100 text-violet-700',
  GD10: 'bg-purple-100 text-purple-700',
  GD11: 'bg-teal-100 text-teal-700',
  GD12: 'bg-fuchsia-100 text-fuchsia-700',
  GD13: 'bg-rose-100 text-rose-700',
  GD14: 'bg-sky-100 text-sky-700',
  GD15: 'bg-sky-100 text-sky-700',
  GD16: 'bg-sky-100 text-sky-700',
  GD17: 'bg-sky-100 text-sky-700',
  GD18: 'bg-emerald-100 text-emerald-700',
};

const CHANGE_TYPE_LABEL_MAP: Record<string, string> = {
  TRANSITION: 'Transition',
  WORKLOG: 'Worklog',
  REF_TASK: 'Ref task',
};

const CHANGE_TYPE_BADGE_CLASS: Record<string, string> = {
  TRANSITION: 'bg-blue-100 text-blue-700',
  WORKLOG: 'bg-amber-100 text-amber-700',
  REF_TASK: 'bg-violet-100 text-violet-700',
};

const STATUS_CODE_LABEL_MAP: Record<string, string> = {
  MOI_TIEP_NHAN: 'Mới tiếp nhận',
  DOI_PHAN_HOI_KH: 'Đợi phản hồi từ khách hàng',
  DANG_XU_LY: 'Đang xử lý',
  KHONG_THUC_HIEN: 'Không thực hiện',
  HOAN_THANH: 'Hoàn thành',
  BAO_KHACH_HANG: 'Báo khách hàng',
  CHUYEN_TRA_QL: 'Chuyển trả người quản lý',
  PHAN_TICH: 'Phân tích',
  LAP_TRINH: 'Lập trình',
  CHUYEN_DMS: 'Chuyển DMS',
  DANG_THUC_HIEN: 'Đang thực hiện',
  UPCODE: 'Upcode',
  TAM_NGUNG: 'Tạm ngưng',
  TRAO_DOI: 'Trao đổi',
  TAO_TASK: 'Tạo task',
  COMPLETED: 'Hoàn thành',
  IN_PROGRESS: 'Đang xử lý',
  NEW: 'Mới tiếp nhận',
  CANCELLED: 'Đã hủy',
  UNABLE_TO_EXECUTE: 'Không thực hiện',
};

const normalizeStatusCodeKey = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .trim();

const toFriendlyStatusLabel = (value: unknown): string => {
  const raw = normalizeText(value);
  if (raw === '') {
    return '';
  }

  const key = normalizeStatusCodeKey(raw);
  if (key !== '' && STATUS_CODE_LABEL_MAP[key]) {
    return STATUS_CODE_LABEL_MAP[key];
  }

  if (/^[A-Z0-9_]+$/.test(raw)) {
    return raw
      .toLowerCase()
      .split('_')
      .filter((part) => part !== '')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return raw;
};

const buildFriendlyStatusLabels = (
  row: CustomerRequest,
  statusById: Map<string, WorkflowStatusCatalog>
): { badgeLabel: string; pathLabel: string } => {
  const statusCatalogId = row.status_catalog_id !== null && row.status_catalog_id !== undefined
    ? String(row.status_catalog_id)
    : '';
  const leafNode = statusCatalogId !== '' ? statusById.get(statusCatalogId) : null;

  let leafLabel = toFriendlyStatusLabel(row.status_name || row.sub_status || row.status);
  let parentLabel = toFriendlyStatusLabel(row.status);

  if (leafNode) {
    leafLabel = toFriendlyStatusLabel(
      leafNode.status_name || leafNode.canonical_sub_status || leafNode.canonical_status || leafNode.status_code || leafLabel
    );
    const parentNode = leafNode.parent_id !== null && leafNode.parent_id !== undefined
      ? statusById.get(String(leafNode.parent_id))
      : null;
    if (parentNode) {
      parentLabel = toFriendlyStatusLabel(
        parentNode.status_name || parentNode.canonical_status || parentNode.status_code || parentLabel
      );
    }
  }

  const hasDifferentParent =
    parentLabel !== '' &&
    leafLabel !== '' &&
    normalizeToken(parentLabel) !== normalizeToken(leafLabel);

  const badgeLabel = leafLabel || parentLabel || '--';
  const pathLabel = hasDifferentParent ? `${parentLabel} -> ${leafLabel}` : (leafLabel || parentLabel || '--');

  return { badgeLabel, pathLabel };
};

const buildHistoryStatusDisplay = (
  entry: CustomerRequestChangeLogEntry
): {
  mode: 'transition' | 'single';
  fromLabel: string;
  toLabel: string;
  singleLabel: string;
  plainText: string;
} => {
  const sourceType = String(entry.source_type || '').toUpperCase();
  const oldLabel = toFriendlyStatusLabel(entry.old_status);
  const newParentLabel = toFriendlyStatusLabel(entry.new_status);
  const newChildLabel = toFriendlyStatusLabel(entry.sub_status);
  const hasSubStatus =
    newParentLabel !== '' &&
    newChildLabel !== '' &&
    normalizeToken(newChildLabel) !== normalizeToken(newParentLabel);
  const destinationLabel = hasSubStatus
    ? `${newParentLabel} -> ${newChildLabel}`
    : (newChildLabel || newParentLabel || '--');

  if (sourceType === 'TRANSITION') {
    const fromLabel = oldLabel || 'Khởi tạo';
    const toLabel = destinationLabel || '--';
    return {
      mode: 'transition',
      fromLabel,
      toLabel,
      singleLabel: '',
      plainText: `${fromLabel} -> ${toLabel}`,
    };
  }

  const fallbackBySource =
    sourceType === 'WORKLOG'
      ? 'Cập nhật worklog'
      : sourceType === 'REF_TASK'
        ? 'Cập nhật task tham chiếu'
        : 'Cập nhật';
  const singleLabel = destinationLabel !== '--' ? destinationLabel : fallbackBySource;

  return {
    mode: 'single',
    fromLabel: '',
    toLabel: '',
    singleLabel,
    plainText: singleLabel,
  };
};

const isTransitionStatusMatch = (
  entry: Pick<CustomerRequestChangeLogEntry, 'source_type' | 'new_status' | 'sub_status'>,
  status: string,
  subStatus: string
): boolean => (
  normalizeStatusCodeKey(entry.source_type) === 'TRANSITION'
  && normalizeStatusCodeKey(entry.new_status) === normalizeStatusCodeKey(status)
  && normalizeStatusCodeKey(entry.sub_status) === normalizeStatusCodeKey(subStatus)
);

const isProgrammingPausedTransition = (
  entry: Pick<CustomerRequestChangeLogEntry, 'source_type' | 'new_status' | 'sub_status'>
): boolean => isTransitionStatusMatch(entry, 'LAP_TRINH', 'TAM_NGUNG');

const isProgrammingUpcodeTransition = (
  entry: Pick<CustomerRequestChangeLogEntry, 'source_type' | 'new_status' | 'sub_status'>
): boolean => isTransitionStatusMatch(entry, 'LAP_TRINH', 'UPCODE');

const isRequestStatusMatch = (
  row: Pick<CustomerRequest, 'status' | 'sub_status'>,
  status: string,
  subStatus: string
): boolean => (
  normalizeStatusCodeKey(row.status) === normalizeStatusCodeKey(status)
  && normalizeStatusCodeKey(row.sub_status) === normalizeStatusCodeKey(subStatus)
);

const BASE_FIELD_KEYS = new Set([
  'request_code',
  'project_item_id',
  'project_id',
  'product_id',
  'summary',
  'customer_id',
  'requester_name',
  'reporter_contact_id',
  'service_group_id',
  'receiver_user_id',
  'assignee_id',
  'reference_ticket_code',
  'reference_request_id',
  'requested_date',
  'notes',
]);

const BASE_FIELD_TOKEN_SET = new Set(
  Array.from(BASE_FIELD_KEYS).map((fieldKey) => normalizeFieldToken(fieldKey))
);

const WORKFLOW_STATIC_FIELD_ALIAS_TOKENS = new Set([
  ...Array.from(BASE_FIELD_TOKEN_SET),
  'idyeucau',
  'mayeucau',
  'mayc',
  'fieldidyeucu',
  'summary',
  'noidung',
  'noidungyeucau',
  'fieldnidung',
  'donvi',
  'fielddnv',
  'nguoiyeucau',
  'fieldngiyeucu',
  'nhomhotro',
  'fieldnhomhtr',
  'nguoitiepnhan',
  'fieldngitipnhn',
  'nguoixuly',
  'fieldngixly',
  'ngaytiepnhan',
  'fieldngaytipnhan',
  'mataskthamchieu',
  'fieldmataskthamchiu',
  'taskcode',
  'ghichu',
]);

const isStaticOrDuplicatedWorkflowField = (field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>): boolean => {
  const key = String(field.field_key || '').trim();
  if (key !== '' && BASE_FIELD_KEYS.has(key)) {
    return true;
  }

  const keyToken = normalizeFieldToken(key);
  if (keyToken !== '' && WORKFLOW_STATIC_FIELD_ALIAS_TOKENS.has(keyToken)) {
    return true;
  }

  const labelToken = normalizeFieldToken(field.field_label || '');
  if (labelToken !== '' && WORKFLOW_STATIC_FIELD_ALIAS_TOKENS.has(labelToken)) {
    return true;
  }

  return false;
};

const PAGE_SIZE = 20;
const IMPORT_ACCEPT = '.xlsx,.xls,.xml,.csv';

const emptyFormValues = (): Record<string, string> => ({
  request_code: '',
  project_item_id: '',
  project_id: '',
  product_id: '',
  summary: '',
  customer_id: '',
  requester_name: '',
  reporter_contact_id: '',
  service_group_id: '',
  receiver_user_id: '',
  assignee_id: '',
  reference_ticket_code: '',
  reference_request_id: '',
  requested_date: new Date().toISOString().slice(0, 10),
  processing_progress: '',
  dms_progress: '',
  dms_exchange_date: '',
  dms_exchange_content: '',
  dms_feedback_date: '',
  dms_feedback_content: '',
  create_task_date: '',
  pause_progress: '',
  pause_date: '',
  pause_user_id: '',
  pause_reason: '',
  upcode_progress: '',
  upcode_date: '',
  upcoder_id: '',
  upcode_status: '',
  upcode_worklog: '',
  completion_user_id: '',
  completion_date: '',
  notes: '',
});

type SupportTaskFormRow = {
  local_id: string;
  task_code: string;
  task_link: string;
  status: SupportRequestTaskStatus;
};

const SUPPORT_TASK_STATUS_OPTIONS: Array<{ value: SupportRequestTaskStatus; label: string }> = [
  { value: 'TODO', label: 'Vừa tạo' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'DONE', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Huỷ' },
  { value: 'BLOCKED', label: 'Chuyển task khác' },
];

const UPCODE_STATUS_OPTIONS = [
  { value: 'SUCCESS', label: 'Thành công' },
  { value: 'FAILED', label: 'Thất bại' },
  { value: 'POSTPONED', label: 'Hoãn upcode' },
] as const;

const UPCODE_STATUS_ALIAS_MAP: Record<string, 'SUCCESS' | 'FAILED' | 'POSTPONED'> = {
  SUCCESS: 'SUCCESS',
  THANHCONG: 'SUCCESS',
  THNHCNG: 'SUCCESS',
  FAILED: 'FAILED',
  THATBAI: 'FAILED',
  THTBI: 'FAILED',
  POSTPONED: 'POSTPONED',
  HOANUPCODE: 'POSTPONED',
  HONUPCODE: 'POSTPONED',
  PENDING: 'POSTPONED',
};

const SUPPORT_TASK_STATUS_ALIAS_MAP: Record<string, SupportRequestTaskStatus> = {
  TODO: 'TODO',
  VUATAO: 'TODO',
  INPROGRESS: 'IN_PROGRESS',
  DANGTHUCHIEN: 'IN_PROGRESS',
  DONE: 'DONE',
  DAHOANTHANH: 'DONE',
  HOANTHANH: 'DONE',
  CANCELLED: 'CANCELLED',
  HUY: 'CANCELLED',
  BLOCKED: 'BLOCKED',
  CHUYENSANGTASKKHAC: 'BLOCKED',
};

const normalizeSupportTaskStatusToken = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

const normalizeSupportTaskStatus = (value: unknown): SupportRequestTaskStatus => {
  const token = normalizeSupportTaskStatusToken(value);
  return SUPPORT_TASK_STATUS_ALIAS_MAP[token] || 'TODO';
};

const normalizeUpcodeStatusToken = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

const normalizeUpcodeStatus = (value: unknown): 'SUCCESS' | 'FAILED' | 'POSTPONED' | '' => {
  const token = normalizeUpcodeStatusToken(value);
  return UPCODE_STATUS_ALIAS_MAP[token] || '';
};

const toFriendlyUpcodeStatusLabel = (value: unknown): string => {
  const normalized = normalizeUpcodeStatus(value);
  if (normalized === '') {
    return '--';
  }

  const option = UPCODE_STATUS_OPTIONS.find((item) => item.value === normalized);
  return option?.label || '--';
};

const toProgressLabel = (value: unknown): string => {
  const raw = normalizeText(value);
  if (raw === '') {
    return '--';
  }

  const normalized = raw.replace('%', '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return '--';
  }

  const fixed = Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(2)));
  return `${fixed}%`;
};

const findFormValueByTokens = (
  values: Record<string, string>,
  preferredKeys: string[],
  tokenCandidates: string[]
): string => {
  for (const key of preferredKeys) {
    const text = normalizeText(values[key]);
    if (text !== '') {
      return text;
    }
  }

  for (const [key, value] of Object.entries(values)) {
    const keyToken = normalizeFieldToken(key);
    if (!keyToken || !tokenCandidates.some((token) => keyToken.includes(token))) {
      continue;
    }
    const text = normalizeText(value);
    if (text !== '') {
      return text;
    }
  }

  return '';
};

const findRawFormValueByTokens = (
  values: Record<string, string>,
  preferredKeys: string[],
  tokenCandidates: string[]
): string => {
  for (const key of preferredKeys) {
    const raw = String(values[key] ?? '');
    if (raw !== '') {
      return raw;
    }
  }

  for (const [key, value] of Object.entries(values)) {
    const keyToken = normalizeFieldToken(key);
    if (!keyToken || !tokenCandidates.some((token) => keyToken.includes(token))) {
      continue;
    }
    const raw = String(value ?? '');
    if (raw !== '') {
      return raw;
    }
  }

  return '';
};

const buildTaskRowId = (): string => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyTaskRow = (partial?: Partial<SupportTaskFormRow>): SupportTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

const buildSupportTaskSignature = (task: {
  task_code?: string | null;
  task_link?: string | null;
  status?: unknown;
}): string =>
  [
    normalizeToken(task.task_code || ''),
    normalizeText(task.task_link || ''),
    normalizeSupportTaskStatus(task.status),
  ].join('|');

const dedupeSupportTaskRows = (rows: SupportTaskFormRow[]): SupportTaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: SupportTaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = buildSupportTaskSignature(task);
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

const dedupeRefTaskPayloadRows = (
  rows: Array<{
    task_source?: string | null;
    task_code?: string | null;
    task_link?: string | null;
    task_status?: string | null;
    sort_order?: number;
  }>
) => {
  const seen = new Set<string>();
  return rows.filter((task) => {
    const signature = [
      normalizeToken(task.task_source || ''),
      normalizeToken(task.task_code || ''),
      normalizeText(task.task_link || ''),
      normalizeToken(task.task_status || ''),
      String(Number.isFinite(task.sort_order as number) ? task.sort_order : 0),
    ].join('|');
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
};

const buildTimelineChildSignature = (item: CustomerRequestTimelineItem): string =>
  [
    item.sourceType,
    normalizeToken(item.entry.task_code || ''),
    normalizeToken(item.entry.new_status || ''),
    normalizeText(item.entry.note || ''),
    normalizeText(item.entry.occurred_at || ''),
  ].join('|');

const parseMaybeInt = (value: string): number | null => {
  const text = normalizeText(value);
  if (!text || !/^\d+$/.test(text)) {
    return null;
  }
  return Number(text);
};

const parseProgressNumber = (value: unknown): number | null => {
  const text = normalizeText(value);
  if (text === '') {
    return null;
  }

  const normalized = text.replace('%', '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const formatProgressNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const PROGRESS_METADATA_TOKENS = new Set([
  'progress',
  'progresspercent',
  'processingprogress',
  'pauseprogress',
  'upcodeprogress',
  'dmsprogress',
  'tiendo',
]);

const toMetadataObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
};

const extractProgressFromMetadata = (metadata: Record<string, unknown> | null | undefined): number | null => {
  if (!metadata) {
    return null;
  }

  for (const [key, rawValue] of Object.entries(metadata)) {
    const token = normalizeFieldToken(key);
    if (!token || !PROGRESS_METADATA_TOKENS.has(token)) {
      continue;
    }
    const progress = parseProgressNumber(rawValue);
    if (progress === null || progress < 0 || progress > 100) {
      continue;
    }
    return progress;
  }

  return null;
};

const resolveProgressInputValue = (
  values: Record<string, string>,
  primaryKey: string,
  canonicalKey: string
): string => {
  const primaryValue = String(values[primaryKey] ?? '');
  if (primaryValue !== '') {
    return primaryValue;
  }
  if (canonicalKey !== primaryKey) {
    const canonicalValue = String(values[canonicalKey] ?? '');
    if (canonicalValue !== '') {
      return canonicalValue;
    }
  }
  return '';
};

const parseTaskList = (value: string): string[] =>
  String(value || '')
    .split(/\r\n|\r|\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const resolveSupportTaskCode = (item: Partial<SupportRequest> | null | undefined): string =>
  String(item?.ticket_code || item?.request_code || '').trim();

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  currentUserId = null,
  canReadRequests = true,
  canWriteRequests = true,
  canDeleteRequests = true,
  canImportRequests = true,
  canExportRequests = true,
  onNotify,
}) => {
  const notify = (type: ToastType, title: string, message: string) => {
    if (onNotify) {
      onNotify(type, title, message);
      return;
    }
    if (type === 'error') {
      window.alert(`${title}: ${message}`);
    }
  };

  const [rows, setRows] = useState<CustomerRequest[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [catalogs, setCatalogs] = useState<WorkflowStatusCatalog[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<WorkflowFormFieldConfig[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingRow, setEditingRow] = useState<CustomerRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>(emptyFormValues);
  const [formTasks, setFormTasks] = useState<SupportTaskFormRow[]>([createEmptyTaskRow()]);
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [latestProgressBaseline, setLatestProgressBaseline] = useState<number | null>(null);
  const [selectedLevel1, setSelectedLevel1] = useState('');
  const [selectedLevel2, setSelectedLevel2] = useState('');
  const [selectedLevel3, setSelectedLevel3] = useState('');
  const [receiverOptions, setReceiverOptions] = useState<Array<{ value: string; label: string }>>([
    { value: '', label: 'Chọn người phân công' },
  ]);
  const [isReceiverLoading, setIsReceiverLoading] = useState(false);
  const receiverRequestVersionRef = useRef(0);

  const [supportRequestReferenceSource, setSupportRequestReferenceSource] = useState<SupportRequest[]>([]);
  const [isReferenceSearchLoading, setIsReferenceSearchLoading] = useState(false);
  const referenceRequestVersionRef = useRef(0);
  const editHistoryRequestVersionRef = useRef(0);
  const catalogRequestVersionRef = useRef(0);
  const listRequestVersionRef = useRef(0);
  const historyRequestVersionRef = useRef(0);
  const progressAutofillAppliedRef = useRef<Set<string>>(new Set());
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const [historyTarget, setHistoryTarget] = useState<CustomerRequest | null>(null);
  const [historyRows, setHistoryRows] = useState<CustomerRequestChangeLogEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectItemMap = useMemo(() => {
    const map = new Map<string, ProjectItemMaster>();
    (projectItems || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [projectItems]);

  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [customers]);

  const customerPersonnelById = useMemo(() => {
    const map = new Map<string, CustomerPersonnel>();
    (customerPersonnel || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [customerPersonnel]);

  const projectItemOptions = useMemo(
    () => [
      { value: '', label: 'Chọn phần mềm triển khai' },
      ...(projectItems || []).map((item) => {
        const product = normalizeText(item.product_name || item.product_code || `#${item.product_id}`);
        const project = normalizeText(item.project_name || item.project_code || '');
        const customer = normalizeText(item.customer_name || item.customer_code || '');
        const label = [product, project, customer].filter((part) => part !== '').join(' | ');
        return { value: String(item.id), label: label || `#${item.id}` };
      }),
    ],
    [projectItems]
  );

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'Chọn đơn vị/khách hàng' },
      ...customers.map((item) => ({ value: String(item.id), label: item.customer_name || `#${item.id}` })),
    ],
    [customers]
  );

  const supportGroupOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhóm Zalo/Tele' },
      ...supportServiceGroups
        .filter((item) => item.is_active !== false)
        .map((item) => ({ value: String(item.id), label: item.group_name || `#${item.id}` })),
    ],
    [supportServiceGroups]
  );

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhân sự' },
      ...employees.map((item) => {
        const code = normalizeText(item.user_code || item.username || '');
        const name = normalizeText(item.full_name || '--');
        return { value: String(item.id), label: code ? `${code} - ${name}` : name };
      }),
    ],
    [employees]
  );

  const receiverFallbackOptions = useMemo(
    () => [{ value: '', label: 'Chọn người phân công' }, ...employeeOptions.filter((item) => item.value !== '')],
    [employeeOptions]
  );

  const reporterContactOptions = useMemo(() => {
    const customerId = String(formValues.customer_id || '');
    const rows = (customerPersonnel || [])
      .filter((item) => String(item.customerId || '') === customerId && item.status !== 'Inactive')
      .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'));

    return [
      { value: '', label: 'Chọn người yêu cầu' },
      ...rows.map((item) => ({
        value: String(item.id),
        label: item.phoneNumber ? `${item.fullName} | ${item.phoneNumber}` : item.fullName,
      })),
    ];
  }, [customerPersonnel, formValues.customer_id]);

  const supportRequestReferenceMap = useMemo(() => {
    const map = new Map<string, SupportRequest>();

    supportRequestReferenceSource.forEach((item) => {
      const code = resolveSupportTaskCode(item);
      if (!code) {
        return;
      }

      const key = normalizeToken(code);
      if (!key) {
        return;
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        return;
      }

      const currentId = Number(item.id);
      const existingId = Number(existing.id);
      if (Number.isFinite(currentId) && Number.isFinite(existingId) && currentId > existingId) {
        map.set(key, item);
      }
    });

    return map;
  }, [supportRequestReferenceSource]);

  const supportRequestReferenceOptions = useMemo(() => {
    const options = [{ value: '', label: 'Không tham chiếu' }];
    const editingId = formMode === 'edit' && editingRow ? String(editingRow.id) : '';
    const rows: SupportRequest[] = [];

    supportRequestReferenceMap.forEach((item) => {
      if (editingId !== '' && String(item.id) === editingId) {
        return;
      }
      rows.push(item);
    });

    rows
      .sort((left, right) => resolveSupportTaskCode(right).localeCompare(resolveSupportTaskCode(left), 'vi'))
      .forEach((item) => {
        const taskCode = resolveSupportTaskCode(item);
        options.push({
          value: taskCode,
          label: `${taskCode || '--'} - ${String(item.summary || '--')}`,
        });
      });

    const currentCode = String(formValues.reference_ticket_code || '').trim();
    if (currentCode !== '' && !options.some((item) => item.value === currentCode)) {
      options.push({
        value: currentCode,
        label: `${currentCode} - (tham chiếu ngoài danh sách hiện tại)`,
      });
    }

    return options;
  }, [supportRequestReferenceMap, formMode, editingRow, formValues.reference_ticket_code]);

  const selectedReferenceRequest = useMemo(() => {
    const token = normalizeToken(formValues.reference_ticket_code || '');
    if (!token) {
      return null;
    }

    const matched = supportRequestReferenceMap.get(token);
    if (!matched) {
      return null;
    }

    if (formMode === 'edit' && editingRow && String(matched.id) === String(editingRow.id)) {
      return null;
    }

    return matched;
  }, [supportRequestReferenceMap, formValues.reference_ticket_code, formMode, editingRow]);

  const statusById = useMemo(() => {
    const map = new Map<string, WorkflowStatusCatalog>();
    catalogs.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [catalogs]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, WorkflowStatusCatalog[]>();
    catalogs.forEach((item) => {
      const key = item.parent_id !== null && item.parent_id !== undefined ? String(item.parent_id) : 'root';
      const rowsByParent = map.get(key) || [];
      rowsByParent.push(item);
      map.set(key, rowsByParent);
    });
    map.forEach((list, key) => {
      list.sort((left, right) => {
        const leftSort = Number(left.sort_order || 0);
        const rightSort = Number(right.sort_order || 0);
        if (leftSort !== rightSort) {
          return leftSort - rightSort;
        }
        return String(left.status_name || '').localeCompare(String(right.status_name || ''), 'vi');
      });
      map.set(key, list);
    });
    return map;
  }, [catalogs]);

  const level1Options = useMemo(
    () => [{ value: '', label: 'Chọn hướng xử lý' }, ...(childrenByParent.get('root') || []).map((item) => ({ value: String(item.id), label: item.status_name }))],
    [childrenByParent]
  );

  const level2Children = useMemo(
    () => childrenByParent.get(String(selectedLevel1 || '')) || [],
    [childrenByParent, selectedLevel1]
  );

  const level2Options = useMemo(
    () => [{ value: '', label: 'Chọn trạng thái xử lý' }, ...level2Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level2Children]
  );

  const level3Children = useMemo(
    () => childrenByParent.get(String(selectedLevel2 || '')) || [],
    [childrenByParent, selectedLevel2]
  );

  const level3Options = useMemo(
    () => [{ value: '', label: 'Chọn xử lý' }, ...level3Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level3Children]
  );

  const showLevel2 = selectedLevel1 !== '' && level2Children.length > 0;
  const showLevel3 = showLevel2 && selectedLevel2 !== '' && level3Children.length > 0;
  const selectedLevel2Node = useMemo(
    () => (selectedLevel2 ? statusById.get(String(selectedLevel2)) || null : null),
    [selectedLevel2, statusById]
  );
  const selectedLevel3Node = useMemo(
    () => (selectedLevel3 ? statusById.get(String(selectedLevel3)) || null : null),
    [selectedLevel3, statusById]
  );

  const selectedLevel2Tokens = useMemo(() => {
    if (!selectedLevel2Node) {
      return new Set<string>();
    }

    return new Set<string>(
      [
        normalizeFieldToken(selectedLevel2Node.status_name || ''),
        normalizeFieldToken(selectedLevel2Node.status_code || ''),
        normalizeFieldToken(selectedLevel2Node.canonical_status || ''),
      ].filter((token) => token !== '')
    );
  }, [selectedLevel2Node]);

  const selectedLevel3Tokens = useMemo(() => {
    if (!selectedLevel3Node) {
      return new Set<string>();
    }

    return new Set<string>(
      [
        normalizeFieldToken(selectedLevel3Node.status_name || ''),
        normalizeFieldToken(selectedLevel3Node.status_code || ''),
        normalizeFieldToken(selectedLevel3Node.canonical_sub_status || ''),
      ].filter((token) => token !== '')
    );
  }, [selectedLevel3Node]);

  const isProgrammingLevel2 = selectedLevel2Tokens.has('laptrinh');
  const isWaitingProcessingLevel3 = selectedLevel3Tokens.has('choxuly');
  const isChooseProcessingPlaceholder = showLevel3 && selectedLevel3 === '';
  const shouldHideDirectionInEdit =
    formMode === 'edit' &&
    isProgrammingLevel2 &&
    (isWaitingProcessingLevel3 || isChooseProcessingPlaceholder);
  const statusGridColumnsClass = shouldHideDirectionInEdit
    ? (showLevel3 ? 'md:grid-cols-2' : 'md:grid-cols-1')
    : (showLevel3 ? 'md:grid-cols-3' : showLevel2 ? 'md:grid-cols-2' : 'md:grid-cols-1');

  const selectedLeafStatusId = useMemo(() => {
    if (selectedLevel3) {
      return selectedLevel3;
    }

    if (selectedLevel2) {
      const node = statusById.get(String(selectedLevel2));
      if (node?.is_leaf) {
        return String(selectedLevel2);
      }
    }

    if (selectedLevel1) {
      const node = statusById.get(String(selectedLevel1));
      if (node?.is_leaf) {
        return String(selectedLevel1);
      }
    }

    return '';
  }, [selectedLevel1, selectedLevel2, selectedLevel3, statusById]);

  const activeFieldConfigs = useMemo(() => {
    if (!selectedLeafStatusId) {
      return [];
    }

    return fieldConfigs
      .filter((item) => String(item.status_catalog_id) === String(selectedLeafStatusId) && item.is_active !== false)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  }, [fieldConfigs, selectedLeafStatusId]);

  const selectedLeafStatusNode = useMemo(
    () => (selectedLeafStatusId ? statusById.get(String(selectedLeafStatusId)) || null : null),
    [selectedLeafStatusId, statusById]
  );

  const selectedLeafStatusTokens = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return new Set<string>();
    }

    const tokens = [
      normalizeToken(selectedLeafStatusNode.status_code || ''),
      normalizeToken(selectedLeafStatusNode.canonical_status || ''),
      normalizeToken(selectedLeafStatusNode.canonical_sub_status || ''),
      normalizeToken(selectedLeafStatusNode.flow_step || ''),
      normalizeFieldToken(selectedLeafStatusNode.status_name || ''),
      normalizeFieldToken(selectedLeafStatusNode.status_code || ''),
      normalizeFieldToken(selectedLeafStatusNode.canonical_status || ''),
      normalizeFieldToken(selectedLeafStatusNode.canonical_sub_status || ''),
      normalizeFieldToken(selectedLeafStatusNode.flow_step || ''),
    ].filter((token) => token !== '');

    return new Set<string>(tokens);
  }, [selectedLeafStatusNode]);

  const isNewIntakeLeafStatus = useMemo(() => {
    if (!selectedLeafStatusId) {
      return false;
    }

    const node = selectedLeafStatusNode;
    if (!node) {
      return false;
    }

    const tokens = [
      normalizeToken(node.status_code || ''),
      normalizeToken(node.canonical_status || ''),
      normalizeToken(node.status_name || ''),
    ];

    return tokens.includes('moi_tiep_nhan') || tokens.includes('moitiepnhan');
  }, [selectedLeafStatusId, selectedLeafStatusNode]);

  const isWaitingCustomerFeedbackStatus = useMemo(() => {
    return (
      selectedLeafStatusTokens.has('doi_phan_hoi_kh') ||
      selectedLeafStatusTokens.has('doiphanhoikh') ||
      selectedLeafStatusTokens.has('doiphanhoitukhachhang')
    );
  }, [selectedLeafStatusTokens]);

  const isProcessingLeafStatus = useMemo(() => {
    return selectedLeafStatusTokens.has('dang_xu_ly') || selectedLeafStatusTokens.has('dangxuly');
  }, [selectedLeafStatusTokens]);

  const isNotExecuteLeafStatus = useMemo(() => {
    return selectedLeafStatusTokens.has('khong_thuc_hien') || selectedLeafStatusTokens.has('khongthuchien');
  }, [selectedLeafStatusTokens]);

  const isCompletedLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');

    return ['hoan_thanh', 'hoanthanh'].includes(statusCodeToken) || ['hoan_thanh', 'hoanthanh'].includes(canonicalStatusToken);
  }, [selectedLeafStatusNode]);

  const isProgrammingCompletedLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['lap_trinh_hoan_thanh', 'laptrinhhoanthanh'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['lap_trinh', 'laptrinh'].includes(canonicalStatusToken) &&
      ['hoan_thanh', 'hoanthanh'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingUpcodeLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['lap_trinh_upcode', 'laptrinhupcode'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['lap_trinh', 'laptrinh'].includes(canonicalStatusToken) &&
      ['upcode'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingPausedLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['lap_trinh_tam_ngung', 'laptrinhtamngung'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['lap_trinh', 'laptrinh'].includes(canonicalStatusToken) &&
      ['tam_ngung', 'tamngung'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingDmsExchangeLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['chuyen_dms_trao_doi', 'chuyendmstraodoi'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['chuyen_dms', 'chuyendms'].includes(canonicalStatusToken) &&
      ['trao_doi', 'traodoi'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingDmsCreateTaskLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['chuyen_dms_tao_task', 'chuyendmstaotask'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['chuyen_dms', 'chuyendms'].includes(canonicalStatusToken) &&
      ['tao_task', 'taotask'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingDmsPausedLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['chuyen_dms_tam_ngung', 'chuyendmstamngung'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['chuyen_dms', 'chuyendms'].includes(canonicalStatusToken) &&
      ['tam_ngung', 'tamngung'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgrammingDmsCompletedLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['chuyen_dms_hoan_thanh', 'chuyendmshoanthanh'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['chuyen_dms', 'chuyendms'].includes(canonicalStatusToken) &&
      ['hoan_thanh', 'hoanthanh'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isSupportCompletedLeafStatus =
    isCompletedLeafStatus &&
    !isProgrammingCompletedLeafStatus &&
    !isProgrammingUpcodeLeafStatus &&
    !isProgrammingPausedLeafStatus;

  const isNotifyCustomerLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');

    return ['bao_khach_hang', 'baokhachhang'].includes(statusCodeToken) || ['bao_khach_hang', 'baokhachhang'].includes(canonicalStatusToken);
  }, [selectedLeafStatusNode]);

  const isReturnToManagerLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');

    return ['chuyen_tra_ql', 'chuyentraql'].includes(statusCodeToken) || ['chuyen_tra_ql', 'chuyentraql'].includes(canonicalStatusToken);
  }, [selectedLeafStatusNode]);

  const isProgrammingInProgressLeafStatus = useMemo(() => {
    if (!selectedLeafStatusNode) {
      return false;
    }

    const statusCodeToken = normalizeToken(selectedLeafStatusNode.status_code || '');
    const canonicalStatusToken = normalizeToken(selectedLeafStatusNode.canonical_status || '');
    const canonicalSubStatusToken = normalizeToken(selectedLeafStatusNode.canonical_sub_status || '');

    if (['lap_trinh_dang_thuc_hien', 'laptrinhdangthuchien'].includes(statusCodeToken)) {
      return true;
    }

    return (
      ['lap_trinh', 'laptrinh'].includes(canonicalStatusToken) &&
      ['dang_thuc_hien', 'dangthuchien'].includes(canonicalSubStatusToken)
    );
  }, [selectedLeafStatusNode]);

  const isProgressRequiredLeafStatus =
    isProcessingLeafStatus ||
    isProgrammingInProgressLeafStatus ||
    isProgrammingUpcodeLeafStatus ||
    isProgrammingPausedLeafStatus ||
    isProgrammingDmsExchangeLeafStatus;

  const shouldRenderReceiverDateBeforeAssignee =
    isNewIntakeLeafStatus ||
    isWaitingCustomerFeedbackStatus ||
    isProcessingLeafStatus ||
    isNotExecuteLeafStatus ||
    isSupportCompletedLeafStatus ||
    isNotifyCustomerLeafStatus ||
    isReturnToManagerLeafStatus ||
    isProgrammingInProgressLeafStatus ||
    isProgrammingDmsExchangeLeafStatus;

  const shouldRenderStandaloneRequestedDate =
    !shouldRenderReceiverDateBeforeAssignee &&
    !isProgrammingUpcodeLeafStatus &&
    !isProgrammingPausedLeafStatus &&
    !isProgrammingDmsExchangeLeafStatus &&
    !isProgrammingDmsCreateTaskLeafStatus &&
    !isProgrammingDmsPausedLeafStatus &&
    !isProgrammingDmsCompletedLeafStatus;

  const dynamicWorkflowFields = useMemo(
    () =>
      activeFieldConfigs
        .filter((field) => !isStaticOrDuplicatedWorkflowField(field))
        .map((field) => ({
          field,
          key: String(field.field_key || ''),
          keyToken: normalizeFieldToken(field.field_key || ''),
          labelToken: normalizeFieldToken(field.field_label || ''),
          semanticKey: resolveWorkflowSemanticFieldKey(field),
        })),
    [activeFieldConfigs]
  );

  const findDynamicFieldBySemantic = (semanticKey: WorkflowSemanticFieldKey): WorkflowFormFieldConfig | null =>
    dynamicWorkflowFields.find((entry) => entry.semanticKey === semanticKey)?.field || null;

  const findDynamicFieldByToken = (tokenCandidates: string[]): WorkflowFormFieldConfig | null =>
    dynamicWorkflowFields.find((entry) =>
      tokenCandidates.some((token) => entry.keyToken.includes(token) || entry.labelToken.includes(token))
    )?.field || null;

  const exchangeDateField = useMemo(
    () => findDynamicFieldBySemantic('exchange_date'),
    [dynamicWorkflowFields]
  );

  const exchangeContentField = useMemo(
    () => findDynamicFieldBySemantic('exchange_content'),
    [dynamicWorkflowFields]
  );

  const customerFeedbackDateField = useMemo(
    () => findDynamicFieldBySemantic('customer_feedback_date'),
    [dynamicWorkflowFields]
  );

  const customerFeedbackContentField = useMemo(
    () => findDynamicFieldBySemantic('customer_feedback_content'),
    [dynamicWorkflowFields]
  );

  const processingWorklogField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_WORKLOG_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const processingDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROCESSING_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const plannedCompletionDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PLANNED_COMPLETION_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const actualCompletionDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_ACTUAL_COMPLETION_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const customerNotifyDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_CUSTOMER_NOTIFY_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const customerNotifyUserField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_CUSTOMER_NOTIFY_USER_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const returnToManagerDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_RETURN_TO_MANAGER_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const returnToManagerContentField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_RETURN_TO_MANAGER_CONTENT_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const notExecuteReasonField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_NOT_EXECUTE_REASON_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingFromDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_FROM_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingProgressField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_PROGRESS_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingToDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_TO_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingExtendedDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_EXTEND_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingExecutorField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_EXECUTOR_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingDmsExchangeDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_DMS_EXCHANGE_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingDmsExchangeContentField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_DMS_EXCHANGE_CONTENT_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingDmsFeedbackDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_DMS_FEEDBACK_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingDmsFeedbackContentField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_DMS_FEEDBACK_CONTENT_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingPauseDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_PAUSE_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingPauseUserField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_PAUSE_USER_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingPauseReasonField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_PAUSE_REASON_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingWorklogField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_WORKLOG_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingUpcodeDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_UPCODE_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingUpcoderField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_UPCODER_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingUpcodeStatusField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_UPCODE_STATUS_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingUpcodeWorklogField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_UPCODE_WORKLOG_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingCompletionUserField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_COMPLETION_USER_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingCompletionDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_COMPLETION_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const programmingDmsCreateTaskDateField = useMemo(
    () => findDynamicFieldByToken(WORKFLOW_PROGRAMMING_DMS_CREATE_TASK_DATE_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const workflowInlineOrderedFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    const append = (field: WorkflowFormFieldConfig | null) => {
      if (!field) {
        return;
      }
      const key = String(field.field_key || '');
      if (key) {
        keys.add(key);
      }
    };

    if (isWaitingCustomerFeedbackStatus || isProcessingLeafStatus || isSupportCompletedLeafStatus) {
      append(exchangeDateField);
      append(exchangeContentField);
      append(customerFeedbackDateField);
      append(customerFeedbackContentField);
    }

    if (isProcessingLeafStatus) {
      append(programmingProgressField);
      append(processingWorklogField);
      append(processingDateField);
      append(plannedCompletionDateField);
    }

    if (isNotExecuteLeafStatus) {
      append(notExecuteReasonField);
      append(processingDateField);
    }

    if (isSupportCompletedLeafStatus) {
      append(actualCompletionDateField);
    }

    if (isNotifyCustomerLeafStatus) {
      append(customerNotifyDateField);
      append(customerNotifyUserField);
    }

    if (isReturnToManagerLeafStatus) {
      append(returnToManagerDateField);
      append(returnToManagerContentField);
    }

    if (isProgrammingInProgressLeafStatus) {
      append(programmingFromDateField);
      append(programmingProgressField);
      append(programmingToDateField);
      append(programmingExtendedDateField);
      append(programmingExecutorField);
      append(programmingWorklogField);
    }

    if (isProgrammingDmsExchangeLeafStatus) {
      append(programmingProgressField);
      append(programmingDmsExchangeDateField);
      append(programmingDmsExchangeContentField);
      append(programmingDmsFeedbackDateField);
      append(programmingDmsFeedbackContentField);
    }

    if (isProgrammingDmsCreateTaskLeafStatus) {
      append(programmingDmsCreateTaskDateField);
    }

    if (isProgrammingDmsPausedLeafStatus) {
      append(programmingPauseDateField);
      append(programmingPauseUserField);
      append(programmingPauseReasonField);
      append(programmingCompletionDateField);
      append(programmingCompletionUserField);
    }

    if (isProgrammingDmsCompletedLeafStatus) {
      append(programmingCompletionDateField);
      append(programmingCompletionUserField);
      append(programmingPauseDateField);
      append(programmingPauseUserField);
      append(programmingPauseReasonField);
    }

    if (isProgrammingPausedLeafStatus) {
      append(programmingProgressField);
      append(programmingPauseDateField);
      append(programmingPauseUserField);
      append(programmingPauseReasonField);
    }

    if (isProgrammingUpcodeLeafStatus) {
      append(programmingProgressField);
      append(programmingUpcodeDateField);
      append(programmingUpcoderField);
      append(programmingUpcodeStatusField);
      append(programmingUpcodeWorklogField);
      append(programmingCompletionUserField);
      append(programmingCompletionDateField);
    }

    if (isProgrammingCompletedLeafStatus) {
      append(programmingCompletionUserField);
      append(programmingCompletionDateField);
    }

    return keys;
  }, [
    isWaitingCustomerFeedbackStatus,
    isProcessingLeafStatus,
    isNotExecuteLeafStatus,
    isSupportCompletedLeafStatus,
    isNotifyCustomerLeafStatus,
    isReturnToManagerLeafStatus,
    isProgrammingInProgressLeafStatus,
    isProgrammingDmsExchangeLeafStatus,
    isProgrammingDmsCreateTaskLeafStatus,
    isProgrammingDmsPausedLeafStatus,
    isProgrammingDmsCompletedLeafStatus,
    isProgrammingPausedLeafStatus,
    isProgrammingUpcodeLeafStatus,
    isProgrammingCompletedLeafStatus,
    exchangeDateField,
    exchangeContentField,
    customerFeedbackDateField,
    customerFeedbackContentField,
    processingWorklogField,
    processingDateField,
    plannedCompletionDateField,
    actualCompletionDateField,
    customerNotifyDateField,
    customerNotifyUserField,
    returnToManagerDateField,
    returnToManagerContentField,
    notExecuteReasonField,
    programmingFromDateField,
    programmingProgressField,
    programmingToDateField,
    programmingExtendedDateField,
    programmingExecutorField,
    programmingWorklogField,
    programmingDmsExchangeDateField,
    programmingDmsExchangeContentField,
    programmingDmsFeedbackDateField,
    programmingDmsFeedbackContentField,
    programmingDmsCreateTaskDateField,
    programmingPauseDateField,
    programmingPauseUserField,
    programmingPauseReasonField,
    programmingUpcodeDateField,
    programmingUpcoderField,
    programmingUpcodeStatusField,
    programmingUpcodeWorklogField,
    programmingCompletionUserField,
    programmingCompletionDateField,
  ]);

  const remainingDynamicWorkflowFields = useMemo(
    () =>
      dynamicWorkflowFields
        .map((entry) => entry.field)
        .filter((field) => !workflowInlineOrderedFieldKeys.has(String(field.field_key || ''))),
    [dynamicWorkflowFields, workflowInlineOrderedFieldKeys]
  );

  const plannedCompletionFallbackValue = useMemo(() => {
    const direct = normalizeText(formValues.planned_completion_date);
    if (direct !== '') {
      return direct;
    }

    const tokenCandidates = WORKFLOW_PLANNED_COMPLETION_FIELD_TOKENS;

    for (const [key, value] of Object.entries(formValues)) {
      const token = normalizeFieldToken(key);
      if (!token || !tokenCandidates.some((candidate) => token.includes(candidate))) {
        continue;
      }
      const text = normalizeText(value);
      if (text !== '') {
        return text;
      }
    }

    return '';
  }, [formValues]);

  const actualCompletionFallbackValue = useMemo(() => {
    const direct = normalizeText(formValues.actual_completion_date);
    if (direct !== '') {
      return direct;
    }

    const tokenCandidates = WORKFLOW_ACTUAL_COMPLETION_FIELD_TOKENS;

    for (const [key, value] of Object.entries(formValues)) {
      const token = normalizeFieldToken(key);
      if (!token || !tokenCandidates.some((candidate) => token.includes(candidate))) {
        continue;
      }
      const text = normalizeText(value);
      if (text !== '') {
        return text;
      }
    }

    return '';
  }, [formValues]);

  const upcodeProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'upcode_progress';
  const processingProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'processing_progress';
  const inProgressProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'progress';
  const dmsProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'dms_progress';
  const dmsExchangeDateFieldKey = String(programmingDmsExchangeDateField?.field_key || '').trim() || 'dms_exchange_date';
  const dmsExchangeContentFieldKey = String(programmingDmsExchangeContentField?.field_key || '').trim() || 'dms_exchange_content';
  const dmsFeedbackDateFieldKey = String(programmingDmsFeedbackDateField?.field_key || '').trim() || 'dms_feedback_date';
  const dmsFeedbackContentFieldKey = String(programmingDmsFeedbackContentField?.field_key || '').trim() || 'dms_feedback_content';
  const createTaskDateFieldKey = String(programmingDmsCreateTaskDateField?.field_key || '').trim() || 'create_task_date';
  const pauseProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'pause_progress';
  const pauseDateFieldKey = String(programmingPauseDateField?.field_key || '').trim() || 'pause_date';
  const pauseUserFieldKey = String(programmingPauseUserField?.field_key || '').trim() || 'pause_user_id';
  const pauseReasonFieldKey = String(programmingPauseReasonField?.field_key || '').trim() || 'pause_reason';
  const upcodeDateFieldKey = String(programmingUpcodeDateField?.field_key || '').trim() || 'upcode_date';
  const upcoderFieldKey = String(programmingUpcoderField?.field_key || '').trim() || 'upcoder_id';
  const upcodeStatusFieldKey = String(programmingUpcodeStatusField?.field_key || '').trim() || 'upcode_status';
  const upcodeWorklogFieldKey = String(programmingUpcodeWorklogField?.field_key || '').trim() || 'upcode_worklog';
  const completionUserFieldKey = String(programmingCompletionUserField?.field_key || '').trim() || 'completion_user_id';
  const completionDateFieldKey = String(programmingCompletionDateField?.field_key || '').trim() || 'completion_date';

  const processingProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, processingProgressFieldKey, 'processing_progress'),
    [formValues, processingProgressFieldKey]
  );

  const dmsProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, dmsProgressFieldKey, 'dms_progress'),
    [formValues, dmsProgressFieldKey]
  );

  const dmsExchangeDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [dmsExchangeDateFieldKey, 'dms_exchange_date'],
          WORKFLOW_PROGRAMMING_DMS_EXCHANGE_DATE_FIELD_TOKENS
        )
      ),
    [formValues, dmsExchangeDateFieldKey]
  );

  const dmsExchangeContentValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        ['dms_exchange_content', dmsExchangeContentFieldKey],
        WORKFLOW_PROGRAMMING_DMS_EXCHANGE_CONTENT_FIELD_TOKENS
      ),
    [formValues, dmsExchangeContentFieldKey]
  );

  const dmsFeedbackDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [dmsFeedbackDateFieldKey, 'dms_feedback_date'],
          WORKFLOW_PROGRAMMING_DMS_FEEDBACK_DATE_FIELD_TOKENS
        )
      ),
    [formValues, dmsFeedbackDateFieldKey]
  );

  const dmsFeedbackContentValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        ['dms_feedback_content', dmsFeedbackContentFieldKey],
        WORKFLOW_PROGRAMMING_DMS_FEEDBACK_CONTENT_FIELD_TOKENS
      ),
    [formValues, dmsFeedbackContentFieldKey]
  );

  const createTaskDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [createTaskDateFieldKey, 'create_task_date'],
          WORKFLOW_PROGRAMMING_DMS_CREATE_TASK_DATE_FIELD_TOKENS
        )
      ),
    [formValues, createTaskDateFieldKey]
  );

  const pauseProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, pauseProgressFieldKey, 'pause_progress'),
    [formValues, pauseProgressFieldKey]
  );

  const pauseDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [pauseDateFieldKey, 'pause_date'],
          WORKFLOW_PROGRAMMING_PAUSE_DATE_FIELD_TOKENS
        )
      ),
    [formValues, pauseDateFieldKey]
  );

  const pauseUserValue = useMemo(
    () =>
      findFormValueByTokens(
        formValues,
        [pauseUserFieldKey, 'pause_user_id'],
        WORKFLOW_PROGRAMMING_PAUSE_USER_FIELD_TOKENS
      ),
    [formValues, pauseUserFieldKey]
  );

  const pauseReasonValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        ['pause_reason', pauseReasonFieldKey],
        WORKFLOW_PROGRAMMING_PAUSE_REASON_FIELD_TOKENS
      ),
    [formValues, pauseReasonFieldKey]
  );

  const upcodeProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, upcodeProgressFieldKey, 'upcode_progress'),
    [formValues, upcodeProgressFieldKey]
  );

  const inProgressProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, inProgressProgressFieldKey, 'progress'),
    [formValues, inProgressProgressFieldKey]
  );

  const upcodeDateValue = useMemo(
    () =>
      findFormValueByTokens(
        formValues,
        [upcodeDateFieldKey, 'upcode_date'],
        WORKFLOW_PROGRAMMING_UPCODE_DATE_FIELD_TOKENS
      ),
    [formValues, upcodeDateFieldKey]
  );

  const upcoderValue = useMemo(
    () =>
      findFormValueByTokens(
        formValues,
        [upcoderFieldKey, 'upcoder_id'],
        WORKFLOW_PROGRAMMING_UPCODER_FIELD_TOKENS
      ),
    [formValues, upcoderFieldKey]
  );

  const upcodeStatusValue = useMemo(
    () =>
      normalizeUpcodeStatus(
        findFormValueByTokens(
          formValues,
          [upcodeStatusFieldKey, 'upcode_status'],
          WORKFLOW_PROGRAMMING_UPCODE_STATUS_FIELD_TOKENS
        )
      ),
    [formValues, upcodeStatusFieldKey]
  );

  const upcodeWorklogValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        ['upcode_worklog', upcodeWorklogFieldKey],
        WORKFLOW_PROGRAMMING_UPCODE_WORKLOG_FIELD_TOKENS
      ),
    [formValues, upcodeWorklogFieldKey]
  );

  const completionUserValue = useMemo(
    () =>
      findFormValueByTokens(
        formValues,
        [completionUserFieldKey, 'completion_user_id'],
        WORKFLOW_PROGRAMMING_COMPLETION_USER_FIELD_TOKENS
      ),
    [formValues, completionUserFieldKey]
  );

  const completionDateValue = useMemo(
    () =>
      findFormValueByTokens(
        formValues,
        [completionDateFieldKey, 'completion_date'],
        WORKFLOW_PROGRAMMING_COMPLETION_DATE_FIELD_TOKENS
      ),
    [formValues, completionDateFieldKey]
  );

  const exchangeDateConstraintMessage = useMemo(() => {
    let exchangeDateRaw = '';
    let customerFeedbackDateRaw = '';

    activeFieldConfigs.forEach((field) => {
      const semanticKey = resolveWorkflowSemanticFieldKey(field);
      if (!semanticKey) {
        return;
      }

      const value = String(formValues[String(field.field_key || '')] || '').trim();
      if (semanticKey === 'exchange_date') {
        exchangeDateRaw = value;
      } else if (semanticKey === 'customer_feedback_date') {
        customerFeedbackDateRaw = value;
      }
    });

    const exchangeDate = normalizeDateForComparison(exchangeDateRaw);
    const customerFeedbackDate = normalizeDateForComparison(customerFeedbackDateRaw);
    if (!exchangeDate || !customerFeedbackDate) {
      return '';
    }

    return exchangeDate <= customerFeedbackDate
      ? ''
      : 'Ngày trao đổi lại với khách hàng phải nhỏ hơn hoặc bằng Ngày khách hàng phản hồi.';
  }, [activeFieldConfigs, formValues]);

  const statusFilterOptions = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((item) => {
      const status = normalizeText(item.status);
      if (status) {
        unique.add(status);
      }
    });

    return ['ALL', ...Array.from(unique)];
  }, [rows]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const newCount = rows.filter((item) => ['MOI_TIEP_NHAN', 'NEW'].includes(String(item.status || '').toUpperCase())).length;
    const processingCount = rows.filter((item) => ['DANG_XU_LY', 'LAP_TRINH', 'CHUYEN_DMS', 'PHAN_TICH', 'IN_PROGRESS'].includes(String(item.status || '').toUpperCase())).length;
    const completedCount = rows.filter((item) => ['HOAN_THANH', 'COMPLETED', 'BAO_KHACH_HANG'].includes(String(item.status || '').toUpperCase())).length;

    return { total, newCount, processingCount, completedCount };
  }, [rows]);

  const filteredHistoryRows = useMemo(() => {
    const keyword = normalizeToken(historySearchTerm);
    if (keyword === '') {
      return historyRows;
    }

    return historyRows.filter((entry) => {
      const statusDisplay = buildHistoryStatusDisplay(entry).plainText;
      return [
        String(entry.task_code || ''),
        String(entry.request_code || ''),
        String(entry.request_summary || ''),
        String(entry.note || ''),
        String(entry.pause_reason || ''),
        String(entry.upcode_status || ''),
        String(entry.progress ?? ''),
        JSON.stringify(entry.transition_metadata || {}),
        String(entry.actor_name || ''),
        statusDisplay,
        String(entry.source_type || ''),
      ].some((value) => normalizeToken(value).includes(keyword));
    });
  }, [historyRows, historySearchTerm]);

  const historyTimeline = useMemo(() => {
    const timelineItems: CustomerRequestTimelineItem[] = filteredHistoryRows
      .map((entry, index) => {
        const sourceType = String(entry.source_type || '').toUpperCase();
        const taskCode = normalizeText(entry.task_code || entry.request_code || '');
        return {
          key: `${sourceType}-${String(entry.request_id || '')}-${String(entry.occurred_at || '')}-${taskCode || 'none'}-${index}`,
          entry,
          sourceType,
          occurredAtTs: toOccurredAtTimestamp(entry.occurred_at),
          statusDisplay: buildHistoryStatusDisplay(entry),
          taskCodeDisplay: taskCode || '--',
        };
      })
      .sort((left, right) => {
        if (left.occurredAtTs === right.occurredAtTs) {
          return left.key.localeCompare(right.key);
        }
        return left.occurredAtTs - right.occurredAtTs;
      });

    const transitionItems = timelineItems.filter((item) => item.sourceType === 'TRANSITION');
    const nonTransitionItems = timelineItems.filter((item) => item.sourceType !== 'TRANSITION');

    const nodes: CustomerRequestTimelineNode[] = transitionItems.map((transition) => ({
      transition,
      children: [],
    }));
    const orphanItems: CustomerRequestTimelineItem[] = [];

    nonTransitionItems.forEach((item) => {
      let parentIndex = -1;
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        if (nodes[index].transition.occurredAtTs <= item.occurredAtTs) {
          parentIndex = index;
          break;
        }
      }
      if (parentIndex >= 0) {
        nodes[parentIndex].children.push(item);
      } else {
        orphanItems.push(item);
      }
    });

    nodes.forEach((node) => {
      node.children.sort((left, right) => {
        if (left.occurredAtTs === right.occurredAtTs) {
          return right.key.localeCompare(left.key);
        }
        return right.occurredAtTs - left.occurredAtTs;
      });
      const seenChildSignatures = new Set<string>();
      node.children = node.children.filter((child) => {
        const signature = buildTimelineChildSignature(child);
        if (seenChildSignatures.has(signature)) {
          return false;
        }
        seenChildSignatures.add(signature);
        return true;
      });
    });

    orphanItems.sort((left, right) => {
      if (left.occurredAtTs === right.occurredAtTs) {
        return right.key.localeCompare(left.key);
      }
      return right.occurredAtTs - left.occurredAtTs;
    });

    nodes.sort((left, right) => {
      if (left.transition.occurredAtTs === right.transition.occurredAtTs) {
        return right.transition.key.localeCompare(left.transition.key);
      }
      return right.transition.occurredAtTs - left.transition.occurredAtTs;
    });

    return {
      nodes,
      orphans: orphanItems,
    };
  }, [filteredHistoryRows]);

  const selectedProjectItem = useMemo(
    () => projectItemMap.get(String(formValues.project_item_id || '')) || null,
    [projectItemMap, formValues.project_item_id]
  );

  const selectedCustomerName = useMemo(() => {
    const id = String(formValues.customer_id || '');
    if (!id) {
      return '';
    }
    return customerById.get(id)?.customer_name || '';
  }, [customerById, formValues.customer_id]);

  const setWorkflowFieldValue = (dynamicFieldKey: string, canonicalFieldKey: string, value: string) => {
    setFormValues((prev) => {
      const next = {
        ...prev,
        [canonicalFieldKey]: value,
      };
      if (dynamicFieldKey && dynamicFieldKey !== canonicalFieldKey) {
        next[dynamicFieldKey] = value;
      }
      return next;
    });
  };

  const loadCatalogAndFields = async () => {
    const requestVersion = catalogRequestVersionRef.current + 1;
    catalogRequestVersionRef.current = requestVersion;
    setIsCatalogLoading(true);
    try {
      const [statusRows, fieldRows] = await Promise.all([
        fetchWorkflowStatusCatalogs(false),
        fetchWorkflowFormFieldConfigs(null, false),
      ]);
      if (catalogRequestVersionRef.current !== requestVersion) {
        return;
      }
      setCatalogs(statusRows || []);
      setFieldConfigs(fieldRows || []);
    } catch (error) {
      if (catalogRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải cấu hình workflow.';
      notify('error', 'Lỗi cấu hình workflow', message);
    } finally {
      if (catalogRequestVersionRef.current === requestVersion) {
        setIsCatalogLoading(false);
      }
    }
  };

  const loadRows = async (page: number, q: string, status: string) => {
    const requestVersion = listRequestVersionRef.current + 1;
    listRequestVersionRef.current = requestVersion;
    setIsLoading(true);
    try {
      const payload = await fetchCustomerRequestsPage({
        page,
        per_page: PAGE_SIZE,
        q: q || undefined,
        filters: status && status !== 'ALL' ? { status } : undefined,
      });
      if (listRequestVersionRef.current !== requestVersion) {
        return;
      }

      setRows(payload.data || []);
      setCurrentPage(payload.meta?.page || page);
      setTotalPages(payload.meta?.total_pages || 1);
      setTotalRows(payload.meta?.total || 0);
    } catch (error) {
      if (listRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách yêu cầu.';
      notify('error', 'Lỗi tải dữ liệu', message);
    } finally {
      if (listRequestVersionRef.current === requestVersion) {
        setIsLoading(false);
      }
    }
  };

  const loadHistoryRows = async (params?: { requestId?: string | number | null; scrollIntoView?: boolean }) => {
    const requestVersion = historyRequestVersionRef.current + 1;
    historyRequestVersionRef.current = requestVersion;
    setIsHistoryLoading(true);
    setHistoryError('');

    try {
      const payload = await fetchCustomerRequestHistories({
        request_id: params?.requestId ?? null,
        limit: 200,
      });
      if (historyRequestVersionRef.current !== requestVersion) {
        return;
      }

      setHistoryRows(Array.isArray(payload) ? payload : []);
      if (params?.scrollIntoView) {
        window.setTimeout(() => {
          historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    } catch (error) {
      if (historyRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải nhật ký thay đổi.';
      setHistoryError(message);
    } finally {
      if (historyRequestVersionRef.current === requestVersion) {
        setIsHistoryLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadCatalogAndFields();
  }, []);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }
    void loadRows(currentPage, searchText, statusFilter);
  }, [canReadRequests, currentPage, searchText, statusFilter]);

  useEffect(() => {
    setReceiverOptions(receiverFallbackOptions);
  }, [receiverFallbackOptions]);

  useEffect(() => {
    if (!showLevel2) {
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (!showLevel3) {
      setSelectedLevel3('');
    }
  }, [showLevel2, showLevel3]);

  useEffect(() => {
    if (!formMode || !isProgressRequiredLeafStatus || latestProgressBaseline !== null) {
      return;
    }

    const activeBranchKey = isProgrammingUpcodeLeafStatus
      ? 'upcode'
      : isProgrammingPausedLeafStatus
        ? 'pause'
      : isProgrammingDmsExchangeLeafStatus
        ? 'dms'
      : isProcessingLeafStatus
        ? 'processing'
      : isProgrammingInProgressLeafStatus
        ? 'in_progress'
      : '';
    if (activeBranchKey === '') {
      return;
    }

    const activePrimaryKey = isProgrammingUpcodeLeafStatus
      ? upcodeProgressFieldKey
      : isProgrammingPausedLeafStatus
        ? pauseProgressFieldKey
      : isProgrammingDmsExchangeLeafStatus
        ? dmsProgressFieldKey
      : isProcessingLeafStatus
        ? processingProgressFieldKey
      : inProgressProgressFieldKey;
    const activeCanonicalKey = isProgrammingUpcodeLeafStatus
      ? 'upcode_progress'
      : isProgrammingPausedLeafStatus
        ? 'pause_progress'
      : isProgrammingDmsExchangeLeafStatus
        ? 'dms_progress'
      : isProcessingLeafStatus
        ? 'processing_progress'
      : 'progress';
    const activeCurrentValue = isProgrammingUpcodeLeafStatus
      ? upcodeProgressValue
      : isProgrammingPausedLeafStatus
        ? pauseProgressValue
      : isProgrammingDmsExchangeLeafStatus
        ? dmsProgressValue
      : isProcessingLeafStatus
        ? processingProgressValue
      : inProgressProgressValue;

    const marker = `${formMode}:${activeBranchKey}:${String(selectedLeafStatusId || '')}:${activePrimaryKey}:${activeCanonicalKey}`;
    if (progressAutofillAppliedRef.current.has(marker)) {
      return;
    }

    if (normalizeText(activeCurrentValue) !== '') {
      progressAutofillAppliedRef.current.add(marker);
      return;
    }

    setFormValues((prev) => {
      const existingPrimary = normalizeText(prev[activePrimaryKey] ?? '');
      const existingCanonical = normalizeText(prev[activeCanonicalKey] ?? '');
      if (existingPrimary !== '' || existingCanonical !== '') {
        return prev;
      }

      const next = {
        ...prev,
        [activePrimaryKey]: '0',
      };
      if (activeCanonicalKey !== activePrimaryKey) {
        next[activeCanonicalKey] = '0';
      }
      return next;
    });

    progressAutofillAppliedRef.current.add(marker);
  }, [
    formMode,
    isProgressRequiredLeafStatus,
    latestProgressBaseline,
    isProgrammingUpcodeLeafStatus,
    isProgrammingPausedLeafStatus,
    isProgrammingDmsExchangeLeafStatus,
    isProcessingLeafStatus,
    isProgrammingInProgressLeafStatus,
    upcodeProgressFieldKey,
    pauseProgressFieldKey,
    dmsProgressFieldKey,
    processingProgressFieldKey,
    inProgressProgressFieldKey,
    upcodeProgressValue,
    pauseProgressValue,
    dmsProgressValue,
    processingProgressValue,
    inProgressProgressValue,
    selectedLeafStatusId,
  ]);

  const triggerReferenceSearch = async (keyword: string) => {
    const requestVersion = referenceRequestVersionRef.current + 1;
    referenceRequestVersionRef.current = requestVersion;
    setIsReferenceSearchLoading(true);

    try {
      const rows = await fetchSupportRequestReferenceMatches({
        q: keyword || undefined,
        exclude_id: formMode === 'edit' && editingRow ? editingRow.id : undefined,
        limit: 50,
      });
      if (referenceRequestVersionRef.current !== requestVersion) {
        return;
      }
      setSupportRequestReferenceSource(rows || []);
    } catch (error) {
      if (referenceRequestVersionRef.current !== requestVersion) {
        return;
      }
      if (isRequestCanceledError(error)) {
        return;
      }
      setSupportRequestReferenceSource([]);
    } finally {
      if (referenceRequestVersionRef.current === requestVersion) {
        setIsReferenceSearchLoading(false);
      }
    }
  };

  const handleProjectItemChange = (value: string) => {
    const selected = projectItemMap.get(String(value || ''));
    setFormValues((prev) => {
      const nextCustomerId = selected?.customer_id ? String(selected.customer_id) : '';
      const keepReporter = nextCustomerId !== '' && nextCustomerId === String(prev.customer_id || '');
      return {
        ...prev,
        project_item_id: value,
        customer_id: nextCustomerId,
        project_id: selected?.project_id ? String(selected.project_id) : '',
        product_id: selected?.product_id ? String(selected.product_id) : '',
        reporter_contact_id: keepReporter ? prev.reporter_contact_id : '',
        requester_name: keepReporter ? prev.requester_name : '',
      };
    });
  };

  const addFormTaskRow = () => {
    setFormTasks((prev) => [...prev, createEmptyTaskRow()]);
  };

  const updateTaskRow = (localId: string, field: keyof Omit<SupportTaskFormRow, 'local_id'>, value: string) => {
    setFormTasks((prev) =>
      prev.map((row) =>
        row.local_id === localId
          ? {
              ...row,
              [field]: field === 'status' ? normalizeSupportTaskStatus(value) : value,
            }
          : row
      )
    );
  };

  const removeTaskRow = (localId: string) => {
    setFormTasks((prev) => {
      const next = prev.filter((row) => row.local_id !== localId);
      return next.length > 0 ? next : [createEmptyTaskRow()];
    });
  };

  useEffect(() => {
    if (!formMode || !formValues.reporter_contact_id) {
      return;
    }

    const stillExists = reporterContactOptions.some((option) => option.value === formValues.reporter_contact_id);
    if (!stillExists) {
      setFormValues((prev) => ({
        ...prev,
        reporter_contact_id: '',
        requester_name: '',
      }));
    }
  }, [formMode, formValues.reporter_contact_id, reporterContactOptions]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const selectedContact = customerPersonnelById.get(String(formValues.reporter_contact_id || ''));
    if (!selectedContact) {
      return;
    }

    const normalizedName = String(selectedContact.fullName || '').trim();
    if (!normalizedName || normalizedName === String(formValues.requester_name || '').trim()) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      requester_name: normalizedName,
    }));
  }, [formMode, formValues.reporter_contact_id, formValues.requester_name, customerPersonnelById]);

  useEffect(() => {
    if (!formMode || formValues.project_item_id || !formValues.project_id || !formValues.product_id) {
      return;
    }

    const matched = (projectItems || []).find(
      (item) =>
        String(item.project_id || '') === String(formValues.project_id || '') &&
        String(item.product_id || '') === String(formValues.product_id || '')
    );

    if (!matched) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      project_item_id: String(matched.id),
      customer_id: matched.customer_id ? String(matched.customer_id) : prev.customer_id,
    }));
  }, [formMode, formValues.project_item_id, formValues.project_id, formValues.product_id, projectItems]);

  useEffect(() => {
    if (!formMode || !isNewIntakeLeafStatus) {
      return;
    }

    setFormValues((prev) => {
      if (normalizeText(prev.requested_date) !== '') {
        return prev;
      }
      return {
        ...prev,
        requested_date: new Date().toISOString().slice(0, 10),
      };
    });
  }, [formMode, isNewIntakeLeafStatus]);

  useEffect(() => {
    if (!formMode || !isNotExecuteLeafStatus) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const processingDateFieldKey = String(processingDateField?.field_key || '').trim();
    if (!processingDateFieldKey) {
      return;
    }

    setFormValues((prev) => {
      if (normalizeText(prev[processingDateFieldKey]) !== '') {
        return prev;
      }
      return {
        ...prev,
        [processingDateFieldKey]: today,
      };
    });
  }, [formMode, isNotExecuteLeafStatus, processingDateField]);

  useEffect(() => {
    if (!formMode || !isReturnToManagerLeafStatus) {
      return;
    }

    const today = formatIsoDateToVn(new Date().toISOString().slice(0, 10));
    const returnDateFieldKey = String(returnToManagerDateField?.field_key || '').trim();
    if (!returnDateFieldKey) {
      return;
    }

    setFormValues((prev) => {
      const currentValue = normalizeText(prev[returnDateFieldKey]);
      if (currentValue !== '') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
          return {
            ...prev,
            [returnDateFieldKey]: formatIsoDateToVn(currentValue),
          };
        }
        return prev;
      }
      return {
        ...prev,
        [returnDateFieldKey]: today,
      };
    });
  }, [formMode, isReturnToManagerLeafStatus, returnToManagerDateField]);

  useEffect(() => {
    if (!formMode || !isSupportCompletedLeafStatus) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const exchangeDateFieldKey = String(exchangeDateField?.field_key || '').trim();
    const customerFeedbackDateFieldKey = String(customerFeedbackDateField?.field_key || '').trim();
    const actualCompletionDateFieldKey = String(actualCompletionDateField?.field_key || '').trim();

    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;

      if (normalizeText(next.requested_date) === '') {
        next.requested_date = today;
        changed = true;
      }

      if (exchangeDateFieldKey && normalizeText(next[exchangeDateFieldKey]) === '') {
        next[exchangeDateFieldKey] = today;
        changed = true;
      }

      if (customerFeedbackDateFieldKey && normalizeText(next[customerFeedbackDateFieldKey]) === '') {
        next[customerFeedbackDateFieldKey] = today;
        changed = true;
      }

      if (actualCompletionDateFieldKey && normalizeText(next[actualCompletionDateFieldKey]) === '') {
        next[actualCompletionDateFieldKey] = today;
        changed = true;
      }

      if (!actualCompletionDateFieldKey && normalizeText(next.actual_completion_date) === '') {
        next.actual_completion_date = today;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [formMode, isSupportCompletedLeafStatus, exchangeDateField, customerFeedbackDateField, actualCompletionDateField]);

  useEffect(() => {
    if (
      !formMode ||
      (
        !isProgrammingCompletedLeafStatus &&
        !isProgrammingUpcodeLeafStatus &&
        !isProgrammingDmsCompletedLeafStatus
      )
    ) {
      return;
    }
    if (normalizeText(completionDateValue) !== '') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    setFormValues((prev) => {
      if (normalizeText(prev[completionDateFieldKey]) !== '') {
        return prev;
      }
      return {
        ...prev,
        [completionDateFieldKey]: today,
      };
    });
  }, [
    formMode,
    isProgrammingCompletedLeafStatus,
    isProgrammingUpcodeLeafStatus,
    isProgrammingDmsCompletedLeafStatus,
    completionDateFieldKey,
    completionDateValue,
  ]);

  useEffect(() => {
    if (!formMode || !isProgrammingDmsExchangeLeafStatus) {
      return;
    }
    if (normalizeText(dmsExchangeDateValue) !== '') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setFormValues((prev) => {
      if (normalizeText(prev[dmsExchangeDateFieldKey]) !== '') {
        return prev;
      }
      return {
        ...prev,
        [dmsExchangeDateFieldKey]: today,
      };
    });
  }, [formMode, isProgrammingDmsExchangeLeafStatus, dmsExchangeDateFieldKey, dmsExchangeDateValue]);

  useEffect(() => {
    if (!formMode || !isProgrammingDmsCreateTaskLeafStatus) {
      return;
    }
    if (normalizeText(createTaskDateValue) !== '') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setFormValues((prev) => {
      if (normalizeText(prev[createTaskDateFieldKey]) !== '') {
        return prev;
      }
      return {
        ...prev,
        [createTaskDateFieldKey]: today,
      };
    });
  }, [formMode, isProgrammingDmsCreateTaskLeafStatus, createTaskDateFieldKey, createTaskDateValue]);

  useEffect(() => {
    if (!formMode || !isProgrammingPausedLeafStatus) {
      return;
    }
    if (normalizeText(pauseDateValue) !== '') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setFormValues((prev) => {
      if (normalizeText(prev[pauseDateFieldKey]) !== '') {
        return prev;
      }
      return {
        ...prev,
        [pauseDateFieldKey]: today,
      };
    });
  }, [formMode, isProgrammingPausedLeafStatus, pauseDateFieldKey, pauseDateValue]);

  useEffect(() => {
    if (!formMode || !isProgrammingDmsPausedLeafStatus) {
      return;
    }

    if (normalizeText(pauseUserValue) !== '') {
      return;
    }

    const preferredUserId =
      formMode === 'edit'
        ? normalizeText(editingRow?.created_by)
        : normalizeText(currentUserId);
    if (!preferredUserId) {
      return;
    }

    const userExistsInReceiverOptions = receiverOptions.some((option) => String(option.value || '') === preferredUserId);
    if (!userExistsInReceiverOptions) {
      return;
    }

    setFormValues((prev) => {
      if (normalizeText(prev[pauseUserFieldKey]) !== '') {
        return prev;
      }

      return {
        ...prev,
        [pauseUserFieldKey]: preferredUserId,
      };
    });
  }, [
    formMode,
    isProgrammingDmsPausedLeafStatus,
    pauseUserValue,
    pauseUserFieldKey,
    editingRow?.created_by,
    currentUserId,
    receiverOptions,
  ]);

  useEffect(() => {
    if (!formMode || !isProgrammingDmsCompletedLeafStatus) {
      return;
    }

    if (normalizeText(completionUserValue) !== '') {
      return;
    }

    const preferredUserId =
      formMode === 'edit'
        ? normalizeText(editingRow?.created_by)
        : normalizeText(currentUserId);
    if (!preferredUserId) {
      return;
    }

    const userExistsInReceiverOptions = receiverOptions.some((option) => String(option.value || '') === preferredUserId);
    if (!userExistsInReceiverOptions) {
      return;
    }

    setFormValues((prev) => {
      if (normalizeText(prev[completionUserFieldKey]) !== '') {
        return prev;
      }

      return {
        ...prev,
        [completionUserFieldKey]: preferredUserId,
      };
    });
  }, [
    formMode,
    isProgrammingDmsCompletedLeafStatus,
    completionUserValue,
    completionUserFieldKey,
    editingRow?.created_by,
    currentUserId,
    receiverOptions,
  ]);

  useEffect(() => {
    if (!formMode || !isProgrammingUpcodeLeafStatus) {
      return;
    }
    if (normalizeText(upcodeDateValue) !== '') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setFormValues((prev) => {
      if (normalizeText(prev[upcodeDateFieldKey]) !== '') {
        return prev;
      }

      return {
        ...prev,
        [upcodeDateFieldKey]: today,
      };
    });
  }, [formMode, isProgrammingUpcodeLeafStatus, upcodeDateFieldKey, upcodeDateValue]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    setFormValues((prev) => {
      const currentCode = normalizeText(prev.reference_ticket_code);
      if (!currentCode) {
        if (prev.reference_request_id === '') {
          return prev;
        }
        return { ...prev, reference_request_id: '' };
      }

      if (selectedReferenceRequest?.id !== undefined && selectedReferenceRequest?.id !== null) {
        const nextReferenceId = String(selectedReferenceRequest.id);
        if (prev.reference_request_id === nextReferenceId) {
          return prev;
        }
        return { ...prev, reference_request_id: nextReferenceId };
      }

      return prev;
    });
  }, [formMode, selectedReferenceRequest, formValues.reference_ticket_code]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const projectId = String(formValues.project_id || '').trim();
    const projectItemId = String(formValues.project_item_id || '').trim();
    if (!projectId && !projectItemId) {
      setReceiverOptions(receiverFallbackOptions);
      setFormValues((prev) => {
        if (!prev.receiver_user_id) {
          return prev;
        }
        const hasFallback = receiverFallbackOptions.some((option) => option.value === prev.receiver_user_id);
        return hasFallback ? prev : { ...prev, receiver_user_id: '' };
      });
      return;
    }

    const requestVersion = receiverRequestVersionRef.current + 1;
    receiverRequestVersionRef.current = requestVersion;
    setIsReceiverLoading(true);

    void (async () => {
      try {
        const response = await fetchSupportRequestReceivers({
          project_id: projectId || null,
          project_item_id: projectItemId || null,
        });

        if (receiverRequestVersionRef.current !== requestVersion) {
          return;
        }

        const raciOptions = [
          { value: '', label: 'Chọn người phân công' },
          ...((response?.options || []).map((option) => {
            const userId = String(option.user_id || '');
            const displayName = String(option.full_name || '').trim();
            const code = String(option.user_code || option.username || '').trim();
            const role = String(option.raci_role || '').trim();
            const roleTag = role ? ` [${role}]` : '';
            const label = code ? `${code} - ${displayName}${roleTag}` : `${displayName}${roleTag}`;
            return { value: userId, label: label.trim() };
          })),
        ].filter((item) => item.value === '' || item.label !== '');

        const nextOptions = raciOptions.length > 1 ? raciOptions : receiverFallbackOptions;
        setReceiverOptions(nextOptions);

        const defaultReceiverId = String(response?.default_receiver_user_id || '').trim();
        setFormValues((prev) => {
          const available = new Set(nextOptions.map((item) => item.value));
          let nextReceiver = prev.receiver_user_id;
          if (nextReceiver && !available.has(nextReceiver)) {
            nextReceiver = '';
          }
          if (!nextReceiver && defaultReceiverId && available.has(defaultReceiverId)) {
            nextReceiver = defaultReceiverId;
          }
          if (nextReceiver === prev.receiver_user_id) {
            return prev;
          }
          return { ...prev, receiver_user_id: nextReceiver };
        });
      } catch {
        if (receiverRequestVersionRef.current !== requestVersion) {
          return;
        }
        setReceiverOptions(receiverFallbackOptions);
      } finally {
        if (receiverRequestVersionRef.current === requestVersion) {
          setIsReceiverLoading(false);
        }
      }
    })();
  }, [formMode, formValues.project_id, formValues.project_item_id, receiverFallbackOptions]);

  const closeFormModal = () => {
    editHistoryRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    setFormMode(null);
    setEditingRow(null);
    setFormError('');
    setFormValues(emptyFormValues());
    setFormTasks([createEmptyTaskRow()]);
    setFormPriority('MEDIUM');
    setLatestProgressBaseline(null);
    setSelectedLevel1('');
    setSelectedLevel2('');
    setSelectedLevel3('');
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
    setSupportRequestReferenceSource([]);
    setIsReferenceSearchLoading(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (formMode && !isSaving) {
        closeFormModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [formMode, isSaving]);

  const applyStatusPathByLeaf = (leafId: string | number | null | undefined) => {
    if (!leafId) {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    const leafNode = statusById.get(String(leafId));
    if (!leafNode) {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (leafNode.level === 1) {
      setSelectedLevel1(String(leafNode.id));
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (leafNode.level === 2) {
      setSelectedLevel2(String(leafNode.id));
      setSelectedLevel3('');
      if (leafNode.parent_id) {
        setSelectedLevel1(String(leafNode.parent_id));
      }
      return;
    }

    const level2 = leafNode.parent_id ? statusById.get(String(leafNode.parent_id)) : null;
    const level1 = level2?.parent_id ? statusById.get(String(level2.parent_id)) : null;

    setSelectedLevel3(String(leafNode.id));
    setSelectedLevel2(level2 ? String(level2.id) : '');
    setSelectedLevel1(level1 ? String(level1.id) : '');
  };

  const openCreateModal = () => {
    if (!canWriteRequests) {
      return;
    }

    editHistoryRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    setFormMode('create');
    setEditingRow(null);
    setFormError('');
    setFormValues(emptyFormValues());
    setFormTasks([createEmptyTaskRow()]);
    setFormPriority('MEDIUM');
    setLatestProgressBaseline(null);
    setReceiverOptions(receiverFallbackOptions);
    void triggerReferenceSearch('');

    const firstLevel1 = (childrenByParent.get('root') || [])[0];
    if (firstLevel1) {
      applyStatusPathByLeaf(String(firstLevel1.id));
    } else {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
    }
  };

  const openEditModal = (row: CustomerRequest) => {
    if (!canWriteRequests) {
      return;
    }

    editHistoryRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    setFormMode('edit');
    setEditingRow(row);
    setFormError('');
    setFormPriority((String(row.priority || 'MEDIUM').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'));

    const metadata = row.transition_metadata && typeof row.transition_metadata === 'object'
      ? (row.transition_metadata as Record<string, unknown>)
      : {};
    const metadataProgress = extractProgressFromMetadata(metadata);
    const metadataFormValues = Object.keys(metadata).reduce<Record<string, string>>((acc, key) => {
      acc[key] = String(metadata[key] ?? '');
      return acc;
    }, {});
    if (metadataProgress !== null) {
      const progressText = formatProgressNumber(metadataProgress);
      if (isRequestStatusMatch(row, 'LAP_TRINH', 'UPCODE')) {
        metadataFormValues.upcode_progress = progressText;
      } else if (isRequestStatusMatch(row, 'LAP_TRINH', 'TAM_NGUNG')) {
        metadataFormValues.pause_progress = progressText;
      } else if (isRequestStatusMatch(row, 'CHUYEN_DMS', 'TRAO_DOI')) {
        metadataFormValues.dms_progress = progressText;
      } else if (normalizeStatusCodeKey(row.status) === 'DANG_XU_LY') {
        metadataFormValues.processing_progress = progressText;
        if (processingProgressFieldKey !== '') {
          metadataFormValues[processingProgressFieldKey] = progressText;
        }
      } else if (isRequestStatusMatch(row, 'LAP_TRINH', 'DANG_THUC_HIEN')) {
        metadataFormValues.progress = progressText;
        if (inProgressProgressFieldKey !== '') {
          metadataFormValues[inProgressProgressFieldKey] = progressText;
        }
      }
    }

    const mappedTaskRows = (Array.isArray(row.tasks) ? row.tasks : [])
      .map((task) =>
        createEmptyTaskRow({
          task_code: String(task?.task_code || ''),
          task_link: String(task?.task_link || ''),
          status: normalizeSupportTaskStatus(task?.status || 'TODO'),
        })
      )
      .filter((task) => task.task_code.trim() !== '' || task.task_link.trim() !== '');

    if (mappedTaskRows.length === 0 && String(row.reference_ticket_code || '').trim() !== '') {
      mappedTaskRows.push(
        createEmptyTaskRow({
          task_code: String(row.reference_ticket_code || '').trim(),
        })
      );
    }
    const dedupedMappedTaskRows = dedupeSupportTaskRows(mappedTaskRows);
    setFormTasks(dedupedMappedTaskRows.length > 0 ? dedupedMappedTaskRows : [createEmptyTaskRow()]);

    setFormValues({
      ...emptyFormValues(),
      ...metadataFormValues,
      summary: String(row.summary || ''),
      project_item_id: row.project_item_id ? String(row.project_item_id) : '',
      project_id: row.project_id ? String(row.project_id) : '',
      product_id: row.product_id ? String(row.product_id) : '',
      customer_id: row.customer_id ? String(row.customer_id) : '',
      requester_name: String(row.requester_name || ''),
      reporter_contact_id: row.reporter_contact_id ? String(row.reporter_contact_id) : '',
      service_group_id: row.service_group_id ? String(row.service_group_id) : '',
      receiver_user_id: row.receiver_user_id ? String(row.receiver_user_id) : '',
      assignee_id: row.assignee_id ? String(row.assignee_id) : '',
      reference_ticket_code: String(row.reference_ticket_code || ''),
      reference_request_id: row.reference_request_id ? String(row.reference_request_id) : '',
      requested_date: row.requested_date ? String(row.requested_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: String(row.notes || ''),
      request_code: String(row.request_code || ''),
    });
    setLatestProgressBaseline(metadataProgress);

    applyStatusPathByLeaf(row.status_catalog_id);
    void triggerReferenceSearch('');

    const requestVersion = editHistoryRequestVersionRef.current;
    void (async () => {
      try {
        const payload = await fetchCustomerRequestHistory(row.id);
        if (editHistoryRequestVersionRef.current !== requestVersion) {
          return;
        }

        const transitions = Array.isArray(payload.transitions)
          ? payload.transitions as Array<Record<string, unknown>>
          : [];
        const latestTransitionIdFromHistory = transitions
          .slice()
          .sort((left, right) => {
            const leftTs = toOccurredAtTimestamp(left.created_at ?? left.updated_at ?? null);
            const rightTs = toOccurredAtTimestamp(right.created_at ?? right.updated_at ?? null);
            if (leftTs === rightTs) {
              return Number(right.id || 0) - Number(left.id || 0);
            }
            return rightTs - leftTs;
          })
          .map((transition) => Number(transition.id || 0))
          .find((transitionId) => Number.isFinite(transitionId) && transitionId > 0) ?? null;

        const latestTransitionIdFromRow = Number(row.latest_transition_id || 0);
        const latestTransitionId = latestTransitionIdFromRow > 0
          ? latestTransitionIdFromRow
          : latestTransitionIdFromHistory;

        const historyTasks = Array.isArray(payload.ref_tasks)
          ? payload.ref_tasks
              .filter((task) => {
                const item = task as Record<string, unknown>;
                const sourceType = String(item.source_type || '').trim().toUpperCase();
                if (sourceType !== 'TRANSITION') {
                  return false;
                }
                if (latestTransitionId === null) {
                  return true;
                }
                const sourceId = Number(item.source_id || 0);
                return sourceId === latestTransitionId;
              })
              .map((task) =>
                createEmptyTaskRow({
                  task_code: String((task as Record<string, unknown>)?.task_code || ''),
                  task_link: String((task as Record<string, unknown>)?.task_link || ''),
                  status: normalizeSupportTaskStatus((task as Record<string, unknown>)?.task_status || 'TODO'),
                })
              )
              .filter((task) => task.task_code.trim() !== '' || task.task_link.trim() !== '')
          : [];
        const dedupedHistoryTasks = dedupeSupportTaskRows(historyTasks);

        if (dedupedHistoryTasks.length > 0) {
          setFormTasks(dedupedHistoryTasks);
        }

        let latestProgress = metadataProgress;
        transitions
          .slice()
          .sort((left, right) => {
            const leftTs = toOccurredAtTimestamp(left.created_at ?? left.updated_at ?? left.report_date ?? null);
            const rightTs = toOccurredAtTimestamp(right.created_at ?? right.updated_at ?? right.report_date ?? null);
            if (leftTs === rightTs) {
              return 0;
            }
            return rightTs - leftTs;
          })
          .some((transition) => {
            const transitionMetadata = toMetadataObject(transition.transition_metadata ?? null);
            const progress = extractProgressFromMetadata(transitionMetadata);
            if (progress === null) {
              return false;
            }
            latestProgress = progress;
            return true;
          });
        setLatestProgressBaseline(latestProgress);
      } catch {
        // keep current task rows if history lookup fails
      }
    })();
  };

  const handleSave = async () => {
    if (!formMode) {
      return;
    }

    if (!selectedLeafStatusId) {
      setFormError('Vui lòng chọn đủ trạng thái để xác định form workflow.');
      return;
    }

    const summary = normalizeText(formValues.summary);
    if (summary === '') {
      setFormError('Nội dung yêu cầu là bắt buộc.');
      return;
    }
    if (!normalizeText(formValues.project_item_id)) {
      setFormError('Phần mềm triển khai là bắt buộc.');
      return;
    }
    let currentProgressValue: number | null = null;
    if (
      isProcessingLeafStatus ||
      isProgrammingInProgressLeafStatus ||
      isProgrammingUpcodeLeafStatus ||
      isProgrammingPausedLeafStatus ||
      isProgrammingDmsExchangeLeafStatus
    ) {
      const progressRaw = isProgrammingUpcodeLeafStatus
        ? normalizeText(upcodeProgressValue)
        : isProgrammingPausedLeafStatus
          ? normalizeText(pauseProgressValue)
        : isProgrammingDmsExchangeLeafStatus
            ? normalizeText(dmsProgressValue)
        : isProcessingLeafStatus
          ? normalizeText(processingProgressValue)
          : normalizeText(inProgressProgressValue);
      if (progressRaw === '') {
        setFormError('Tiến độ là bắt buộc.');
        return;
      }
      const progressValue = parseProgressNumber(progressRaw);
      if (progressValue === null || progressValue < 0 || progressValue > 100) {
        setFormError('Tiến độ phải trong khoảng từ 0 đến 100.');
        return;
      }
      currentProgressValue = progressValue;
    }
    if (
      formMode === 'edit'
      && currentProgressValue !== null
      && latestProgressBaseline !== null
      && currentProgressValue <= latestProgressBaseline
    ) {
      setFormError(`Tiến độ mới phải lớn hơn lần trước (${formatProgressNumber(latestProgressBaseline)}%).`);
      return;
    }
    if (isProgrammingUpcodeLeafStatus && normalizeUpcodeStatus(upcodeStatusValue) === '') {
      setFormError('Vui lòng chọn trạng thái upcode.');
      return;
    }
    if (exchangeDateConstraintMessage !== '') {
      setFormError(exchangeDateConstraintMessage);
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const transitionMetadata: Record<string, unknown> = {};
      const refTasks: Array<Record<string, unknown>> = [];
      const worklogs: Array<Record<string, unknown>> = [];
      const upcodeHandledFieldKeys = new Set<string>(
        isProgrammingUpcodeLeafStatus
          ? [
              upcodeProgressFieldKey,
              upcodeDateFieldKey,
              upcoderFieldKey,
              upcodeStatusFieldKey,
              upcodeWorklogFieldKey,
              completionUserFieldKey,
              completionDateFieldKey,
            ].filter((key) => key !== '')
          : []
      );
      const pauseHandledFieldKeys = new Set<string>(
        isProgrammingPausedLeafStatus
          ? [
              pauseProgressFieldKey,
              pauseDateFieldKey,
              pauseUserFieldKey,
              pauseReasonFieldKey,
            ].filter((key) => key !== '')
          : []
      );
      const dmsHandledFieldKeys = new Set<string>(
        isProgrammingDmsExchangeLeafStatus
          ? [
              dmsProgressFieldKey,
              dmsExchangeDateFieldKey,
              dmsExchangeContentFieldKey,
              dmsFeedbackDateFieldKey,
              dmsFeedbackContentFieldKey,
            ].filter((key) => key !== '')
          : []
      );
      const dmsCreateTaskHandledFieldKeys = new Set<string>(
        isProgrammingDmsCreateTaskLeafStatus
          ? [createTaskDateFieldKey].filter((key) => key !== '')
          : []
      );
      const dmsPausedHandledFieldKeys = new Set<string>(
        isProgrammingDmsPausedLeafStatus
          ? [completionDateFieldKey, completionUserFieldKey, pauseDateFieldKey, pauseUserFieldKey, pauseReasonFieldKey].filter((key) => key !== '')
          : []
      );
      const dmsCompletedHandledFieldKeys = new Set<string>(
        isProgrammingDmsCompletedLeafStatus
          ? [completionDateFieldKey, completionUserFieldKey, pauseDateFieldKey, pauseUserFieldKey, pauseReasonFieldKey].filter((key) => key !== '')
          : []
      );
      const isProgressLikeWorkflowField = (field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>): boolean => {
        const keyToken = normalizeFieldToken(field.field_key || '');
        const labelToken = normalizeFieldToken(field.field_label || '');
        const candidates = ['tind', 'tiendo', 'progress', 'progresspercent', 'pauseprogress', 'upcodeprogress', 'dmsprogress'];
        return candidates.some((token) => keyToken.includes(token) || labelToken.includes(token));
      };
      const baseTaskRows = formTasks
        .map((task, index) => ({
          task_source: 'IT360',
          task_code: normalizeText(task.task_code) || null,
          task_link: normalizeText(task.task_link) || null,
          task_status: normalizeSupportTaskStatus(task.status || 'TODO'),
          sort_order: index,
        }))
        .filter((task) => task.task_code !== null || task.task_link !== null);

      if (!isProgrammingPausedLeafStatus && baseTaskRows.length > 0) {
        refTasks.push(...baseTaskRows);
      }

      activeFieldConfigs.forEach((field) => {
        const key = String(field.field_key || '');
        if (!key || isStaticOrDuplicatedWorkflowField(field)) {
          return;
        }
        if (
          (isProcessingLeafStatus || isProgrammingUpcodeLeafStatus || isProgrammingPausedLeafStatus || isProgrammingDmsExchangeLeafStatus)
          && isProgressLikeWorkflowField(field)
        ) {
          return;
        }
        if (upcodeHandledFieldKeys.has(key)) {
          return;
        }
        if (pauseHandledFieldKeys.has(key)) {
          return;
        }
        if (dmsHandledFieldKeys.has(key)) {
          return;
        }
        if (dmsCreateTaskHandledFieldKeys.has(key)) {
          return;
        }
        if (dmsPausedHandledFieldKeys.has(key)) {
          return;
        }
        if (dmsCompletedHandledFieldKeys.has(key)) {
          return;
        }
        if (isProgrammingPausedLeafStatus) {
          return;
        }
        if (isProgrammingDmsExchangeLeafStatus) {
          return;
        }
        if (isProgrammingDmsCreateTaskLeafStatus) {
          return;
        }
        if (isProgrammingDmsPausedLeafStatus) {
          return;
        }
        if (isProgrammingDmsCompletedLeafStatus) {
          return;
        }

        const fieldType = String(field.field_type || 'text');
        const rawValue = normalizeText(formValues[key]);

        if (rawValue === '') {
          return;
        }

        if (fieldType === 'task_ref') {
          refTasks.push({ task_source: 'IT360', task_code: rawValue, sort_order: refTasks.length });
          return;
        }

        if (fieldType === 'task_list') {
          parseTaskList(rawValue).forEach((taskCode) => {
            refTasks.push({ task_source: 'IT360', task_code: taskCode, sort_order: refTasks.length });
          });
          return;
        }

        if (fieldType === 'worklog') {
          worklogs.push({
            phase: 'OTHER',
            logged_date: normalizeText(formValues.requested_date) || new Date().toISOString().slice(0, 10),
            hours_spent: 1,
            content: rawValue,
          });
          return;
        }

        if (fieldType === 'number') {
          transitionMetadata[key] = Number(rawValue);
          return;
        }

        if (fieldType === 'boolean') {
          transitionMetadata[key] = ['1', 'true', 'yes'].includes(rawValue.toLowerCase());
          return;
        }

        transitionMetadata[key] = rawValue;
      });

      if (isProcessingLeafStatus && !plannedCompletionDateField) {
        const plannedCompletionDate = normalizeText(formValues.planned_completion_date || plannedCompletionFallbackValue);
        if (plannedCompletionDate !== '') {
          transitionMetadata.planned_completion_date = plannedCompletionDate;
        }
      }

      if (isProcessingLeafStatus) {
        const progressRaw = normalizeText(processingProgressValue);
        if (progressRaw !== '') {
          const progressValue = Number(progressRaw);
          if (Number.isFinite(progressValue)) {
            transitionMetadata.progress = progressValue;
          }
        }
      }

      if (isSupportCompletedLeafStatus && !actualCompletionDateField) {
        const actualCompletionDate = normalizeText(formValues.actual_completion_date || actualCompletionFallbackValue);
        if (actualCompletionDate !== '') {
          transitionMetadata.actual_completion_date = actualCompletionDate;
        }
      }

      if (isProgrammingUpcodeLeafStatus) {
        const progressRaw = normalizeText(upcodeProgressValue);
        if (progressRaw !== '') {
          const progressValue = Number(progressRaw);
          if (Number.isFinite(progressValue)) {
            transitionMetadata.progress = progressValue;
          }
        }

        const upcodeDate = normalizeText(upcodeDateValue);
        if (upcodeDate !== '') {
          transitionMetadata.upcode_date = upcodeDate;
        }

        const upcoderId = parseMaybeInt(upcoderValue);
        if (upcoderId !== null) {
          transitionMetadata.upcoder_id = upcoderId;
        }

        const upcodeStatus = normalizeUpcodeStatus(upcodeStatusValue);
        if (upcodeStatus !== '') {
          transitionMetadata.upcode_status = upcodeStatus;
        }

        const completionUserId = parseMaybeInt(completionUserValue);
        if (completionUserId !== null) {
          transitionMetadata.completion_user_id = completionUserId;
        }

        const completionDate = normalizeText(completionDateValue);
        if (completionDate !== '') {
          transitionMetadata.completion_date = completionDate;
        }

        const upcodeWorklog = normalizeText(upcodeWorklogValue);
        if (upcodeWorklog !== '') {
          worklogs.push({
            phase: 'UPCODE',
            logged_date: upcodeDate || new Date().toISOString().slice(0, 10),
            hours_spent: 1,
            content: upcodeWorklog,
          });
        }
      }

      if (isProgrammingInProgressLeafStatus) {
        const progressRaw = normalizeText(inProgressProgressValue);
        if (progressRaw !== '') {
          const progressValue = Number(progressRaw);
          if (Number.isFinite(progressValue)) {
            transitionMetadata.progress = progressValue;
          }
        }
      }

      if (isProgrammingPausedLeafStatus) {
        const progressRaw = normalizeText(pauseProgressValue);
        if (progressRaw !== '') {
          const progressValue = Number(progressRaw);
          if (Number.isFinite(progressValue)) {
            transitionMetadata.progress = progressValue;
          }
        }

        const pauseDate = normalizeDateValueForDateInput(normalizeText(pauseDateValue));
        if (pauseDate !== '') {
          transitionMetadata.pause_date = formatIsoDateToVn(pauseDate);
        }

        const pauseUserId = parseMaybeInt(pauseUserValue);
        if (pauseUserId !== null) {
          transitionMetadata.pause_user_id = pauseUserId;
        }

        const pauseReason = normalizeText(pauseReasonValue);
        if (pauseReason !== '') {
          transitionMetadata.pause_reason = pauseReason;
        }
      }

      if (isProgrammingDmsPausedLeafStatus) {
        const pauseDate = normalizeDateValueForDateInput(normalizeText(pauseDateValue));
        if (pauseDate !== '') {
          transitionMetadata.pause_date = formatIsoDateToVn(pauseDate);
        }

        const pauseUserId = parseMaybeInt(pauseUserValue);
        if (pauseUserId !== null) {
          transitionMetadata.pause_user_id = pauseUserId;
        }
      }

      if (isProgrammingDmsCompletedLeafStatus) {
        const completionDate = normalizeDateValueForDateInput(normalizeText(completionDateValue));
        if (completionDate !== '') {
          transitionMetadata.completion_date = formatIsoDateToVn(completionDate);
        }

        const completionUserId = parseMaybeInt(completionUserValue);
        if (completionUserId !== null) {
          transitionMetadata.completion_user_id = completionUserId;
        }
      }

      if (isProgrammingDmsExchangeLeafStatus) {
        const progressRaw = normalizeText(dmsProgressValue);
        if (progressRaw !== '') {
          const progressValue = Number(progressRaw);
          if (Number.isFinite(progressValue)) {
            transitionMetadata.progress = progressValue;
          }
        }

        const dmsExchangeDate = normalizeDateValueForDateInput(normalizeText(dmsExchangeDateValue));
        if (dmsExchangeDate !== '') {
          transitionMetadata.dms_exchange_date = formatIsoDateToVn(dmsExchangeDate);
        }

        const dmsExchangeContent = normalizeText(dmsExchangeContentValue);
        if (dmsExchangeContent !== '') {
          transitionMetadata.dms_exchange_content = dmsExchangeContent;
        }

        const dmsFeedbackDate = normalizeDateValueForDateInput(normalizeText(dmsFeedbackDateValue));
        if (dmsFeedbackDate !== '') {
          transitionMetadata.dms_feedback_date = formatIsoDateToVn(dmsFeedbackDate);
        }

        const dmsFeedbackContent = normalizeText(dmsFeedbackContentValue);
        if (dmsFeedbackContent !== '') {
          transitionMetadata.dms_feedback_content = dmsFeedbackContent;
        }
      }

      if (isProgrammingDmsCreateTaskLeafStatus) {
        const createTaskDate = normalizeDateValueForDateInput(normalizeText(createTaskDateValue));
        if (createTaskDate !== '') {
          transitionMetadata.create_task_date = formatIsoDateToVn(createTaskDate);
        }
      }

      if (isProgrammingCompletedLeafStatus) {
        if (!programmingCompletionDateField) {
          const completionDate = normalizeText(completionDateValue);
          if (completionDate !== '') {
            transitionMetadata.completion_date = completionDate;
          }
        }

        if (!programmingCompletionUserField) {
          const completionUserId = parseMaybeInt(completionUserValue);
          if (completionUserId !== null) {
            transitionMetadata.completion_user_id = completionUserId;
          }
        }
      }

      const normalizedRefTasks = dedupeRefTaskPayloadRows(refTasks);

      const payload: Record<string, unknown> = {
        status_catalog_id: Number(selectedLeafStatusId),
        summary,
        project_item_id: parseMaybeInt(formValues.project_item_id),
        customer_id: parseMaybeInt(formValues.customer_id),
        project_id: parseMaybeInt(formValues.project_id),
        product_id: parseMaybeInt(formValues.product_id),
        requester_name: normalizeText(formValues.requester_name) || null,
        reporter_contact_id: parseMaybeInt(formValues.reporter_contact_id),
        service_group_id: parseMaybeInt(formValues.service_group_id),
        receiver_user_id: parseMaybeInt(formValues.receiver_user_id),
        assignee_id: parseMaybeInt(formValues.assignee_id),
        status: undefined,
        sub_status: undefined,
        priority: formPriority,
        requested_date: normalizeText(formValues.requested_date) || null,
        reference_ticket_code: isProgrammingPausedLeafStatus ? null : (normalizeText(formValues.reference_ticket_code) || null),
        reference_request_id: isProgrammingPausedLeafStatus
          ? null
          : (selectedReferenceRequest?.id ?? parseMaybeInt(formValues.reference_request_id)),
        notes: isProgrammingPausedLeafStatus ? null : (normalizeText(formValues.notes) || null),
        transition_metadata: transitionMetadata,
        transition_note: isProgrammingPausedLeafStatus ? null : (normalizeText(formValues.notes) || null),
        tasks: [],
        ref_tasks: normalizedRefTasks,
        worklogs,
      };

      if (formMode === 'create') {
        await createCustomerRequest(payload);
        notify('success', 'Tạo yêu cầu', 'Đã tạo yêu cầu khách hàng mới.');
      } else if (editingRow) {
        await updateCustomerRequest(editingRow.id, payload);
        notify('success', 'Cập nhật yêu cầu', 'Đã cập nhật yêu cầu khách hàng.');
      }

      closeFormModal();
      await loadRows(currentPage, searchText, statusFilter);
      const nextHistoryRequestId = historyTarget
        ? (formMode === 'edit' && editingRow ? editingRow.id : historyTarget.id)
        : null;
      if (nextHistoryRequestId !== null && nextHistoryRequestId !== undefined) {
        void loadHistoryRows({ requestId: nextHistoryRequestId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu yêu cầu khách hàng.';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: CustomerRequest) => {
    if (!canDeleteRequests) {
      return;
    }

    const confirmed = window.confirm(`Xóa yêu cầu ${row.request_code}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteCustomerRequest(row.id);
      notify('success', 'Xóa yêu cầu', 'Đã xóa yêu cầu khách hàng.');
      await loadRows(currentPage, searchText, statusFilter);
      if (historyTarget && String(historyTarget.id) === String(row.id)) {
        setHistoryTarget(null);
        setHistoryRows([]);
        setHistoryError('');
      } else if (historyTarget?.id !== null && historyTarget?.id !== undefined) {
        void loadHistoryRows({ requestId: historyTarget?.id ?? null });
      }
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể xóa yêu cầu.';
      notify('error', 'Xóa yêu cầu thất bại', message);
    }
  };

  const openHistory = async (row: CustomerRequest) => {
    setHistoryTarget(row);
    setHistorySearchTerm('');
    await loadHistoryRows({ requestId: row.id, scrollIntoView: true });
  };

  const clearHistoryFocus = () => {
    setHistoryTarget(null);
    setHistorySearchTerm('');
    setHistoryRows([]);
    setHistoryError('');
    setIsHistoryLoading(false);
    historyRequestVersionRef.current += 1;
  };

  const handleExport = async () => {
    if (!canExportRequests) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportCustomerRequestsCsv({
        page: currentPage,
        per_page: PAGE_SIZE,
        q: searchText || undefined,
        filters: statusFilter !== 'ALL' ? { status: statusFilter } : undefined,
      });
      triggerDownload(result.blob, result.filename);
      notify('success', 'Xuất dữ liệu', 'Đã tạo file xuất yêu cầu khách hàng.');
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể xuất dữ liệu.';
      notify('error', 'Xuất dữ liệu thất bại', message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (!canImportRequests || isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      const parsed = await parseImportFile(file);
      const sheet = pickImportSheetByModule('customer_requests', parsed) || parsed.sheets[0];
      if (!sheet) {
        throw new Error('Không đọc được sheet dữ liệu import.');
      }

      const items: Array<Record<string, unknown>> = (sheet.rows || [])
        .map((row) => {
          const get = (index: number): string => String(row[index] || '').trim();
          return {
            B: get(1),
            C: get(2),
            D: get(3),
            E: get(4),
            F: get(5),
            G: get(6),
            H: get(7),
            I: get(8),
            J: get(9),
            K: get(10),
            L: get(11),
            M: get(12),
            N: get(13),
            O: get(14),
            P: get(15),
            Q: get(16),
            R: get(17),
            status_level_1: get(1),
            status_level_2: get(2),
            status_level_3: get(3),
          };
        })
        .filter((item) => {
          const hasStatus = [item.B, item.C, item.D].some((value) => normalizeText(value) !== '');
          const hasPayload = [item.E, item.F, item.G, item.H, item.I, item.J, item.K, item.L, item.M, item.N, item.O, item.P, item.Q, item.R]
            .some((value) => normalizeText(value) !== '');
          return hasStatus && hasPayload;
        });

      if (items.length === 0) {
        throw new Error('File import không có dòng dữ liệu hợp lệ.');
      }

      const result = await importCustomerRequests(items);
      notify(
        result.failed_count > 0 ? 'warning' : 'success',
        'Nhập dữ liệu',
        `Tạo mới: ${result.created_count}, cập nhật: ${result.updated_count}, lỗi: ${result.failed_count}`
      );

      await loadRows(1, searchText, statusFilter);
      if (historyTarget && historyTarget.id !== null && historyTarget.id !== undefined) {
        void loadHistoryRows({ requestId: historyTarget.id });
      }
      setCurrentPage(1);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể nhập dữ liệu.';
      notify('error', 'Nhập dữ liệu thất bại', message);
    } finally {
      setIsImporting(false);
    }
  };

  const renderFieldInput = (field: WorkflowFormFieldConfig) => {
    const key = String(field.field_key || '');
    const fieldType = String(field.field_type || 'text');
    const semanticField = resolveWorkflowSemanticFieldKey(field);
    const label = field.field_label || key;
    const keyToken = normalizeFieldToken(key);
    const labelToken = normalizeFieldToken(label);
    const effectiveFieldType = (() => {
      if (semanticField === 'exchange_content' || semanticField === 'customer_feedback_content') {
        return 'textarea';
      }
      if (semanticField === 'exchange_date' || semanticField === 'customer_feedback_date') {
        return 'date';
      }
      if (WORKFLOW_WORKLOG_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token))) {
        return 'textarea';
      }
      if (
        WORKFLOW_PROGRAMMING_FROM_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_PROGRAMMING_TO_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_PROGRAMMING_EXTEND_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_PROCESSING_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_PLANNED_COMPLETION_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_ACTUAL_COMPLETION_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_CUSTOMER_NOTIFY_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token)) ||
        WORKFLOW_PROGRAMMING_COMPLETION_DATE_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token))
      ) {
        return 'date';
      }
      if (WORKFLOW_PROGRAMMING_PROGRESS_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token))) {
        return 'number';
      }
      return fieldType;
    })();
    const value = String(formValues[key] || '');
    const required = field.required === true;
    const isProgressField = WORKFLOW_PROGRAMMING_PROGRESS_FIELD_TOKENS.some(
      (token) => keyToken.includes(token) || labelToken.includes(token)
    );
    const requiredWithProgressRule = required || (isProgressField && isProgressRequiredLeafStatus);

    if (key === 'request_code') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
          <input
            type="text"
            value={formMode === 'edit' ? value : '-- tự sinh sau khi lưu --'}
            readOnly
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
          />
        </div>
      );
    }

    if (fieldType === 'customer') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={customerOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn khách hàng"
          searchPlaceholder="Tìm khách hàng..."
        />
      );
    }

    if (fieldType === 'service_group') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={supportGroupOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn nhóm hỗ trợ"
          searchPlaceholder="Tìm nhóm hỗ trợ..."
        />
      );
    }

    if (fieldType === 'user') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={employeeOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn nhân sự"
          searchPlaceholder="Tìm nhân sự..."
        />
      );
    }

    if (
      WORKFLOW_CUSTOMER_NOTIFY_USER_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token))
    ) {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={receiverOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder={isReceiverLoading ? 'Đang tải người báo khách hàng...' : 'Chọn người báo khách hàng'}
          searchPlaceholder="Tìm người báo khách hàng..."
          searching={isReceiverLoading}
          disabled={isReceiverLoading}
        />
      );
    }

    if (
      WORKFLOW_PROGRAMMING_COMPLETION_USER_FIELD_TOKENS.some((token) => keyToken.includes(token) || labelToken.includes(token))
    ) {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={employeeOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn người hoàn thành"
          searchPlaceholder="Tìm người hoàn thành..."
        />
      );
    }

    if (effectiveFieldType === 'date') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {required ? <span className="text-red-500">*</span> : null}
          </label>
          <input
            type="date"
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (effectiveFieldType === 'textarea' || effectiveFieldType === 'worklog' || effectiveFieldType === 'task_list') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {required ? <span className="text-red-500">*</span> : null}
          </label>
          <textarea
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            rows={effectiveFieldType === 'task_list' ? 4 : 3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (effectiveFieldType === 'number') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {requiredWithProgressRule ? <span className="text-red-500">*</span> : null}
          </label>
          <input
            type="number"
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            min={isProgressField ? 0 : undefined}
            max={isProgressField ? 100 : undefined}
            step={isProgressField ? 1 : undefined}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (effectiveFieldType === 'boolean') {
      return (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={['1', 'true', 'yes'].includes(value.toLowerCase())}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.checked ? '1' : '0' }))}
          />
          <span>{label}</span>
        </label>
      );
    }

    if (effectiveFieldType === 'select') {
      const options = Array.isArray(field.options_json) ? field.options_json : [];
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={[{ value: '', label: 'Chọn...' }, ...options.map((item) => ({ value: item.value, label: item.label }))]}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn giá trị"
        />
      );
    }

    return (
      <div key={key}>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          type="text"
          value={value}
          onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    );
  };

  if (!canReadRequests) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Bạn không có quyền xem dữ liệu Quản lý yêu cầu KH.
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl"
      style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}
    >
      <header className="mb-6 md:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý yêu cầu KH</h2>
          <p className="mt-1 text-sm text-slate-600">Màn hình độc lập quản lý workflow yêu cầu khách hàng theo trạng thái.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={!canImportRequests || isImporting}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">upload</span>
            <span className="hidden sm:inline">{isImporting ? 'Đang nhập...' : 'Nhập'}</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExportRequests || isExporting}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">{isExporting ? 'progress_activity' : 'download'}</span>
            <span className="hidden sm:inline">{isExporting ? 'Đang xuất...' : 'Xuất'}</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canWriteRequests}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleImportFile} />

      <div className="mb-6 md:mb-8 grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Tổng yêu cầu</p>
            <span className="material-symbols-outlined rounded-lg bg-blue-50 p-2 text-blue-600">support_agent</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.total}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Mới tiếp nhận</p>
            <span className="material-symbols-outlined rounded-lg bg-indigo-50 p-2 text-indigo-600">new_releases</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.newCount}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Đang xử lý</p>
            <span className="material-symbols-outlined rounded-lg bg-amber-50 p-2 text-amber-600">pending_actions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.processingCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Hoàn thành</p>
            <span className="material-symbols-outlined rounded-lg bg-emerald-50 p-2 text-emerald-600">task_alt</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.completedCount}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white/95 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)] md:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px_auto]">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo mã yêu cầu, trạng thái, nội dung..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <SearchableSelect
              value={statusFilter}
              options={statusFilterOptions.map((item) => ({ value: item, label: item === 'ALL' ? 'Tất cả trạng thái' : item }))}
              onChange={(value) => {
                setStatusFilter(value || 'ALL');
                setCurrentPage(1);
              }}
              placeholder="Tất cả trạng thái"
              triggerClassName="h-10 md:h-11 border-slate-200 shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setSearchText(searchInput.trim());
              }}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 md:h-11"
            >
              Tìm kiếm
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1180px] w-full border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th className="min-w-[180px] px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Mã YC</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Nội dung</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Trạng thái</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Khách hàng</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Người xử lý</span></th>
                  <th className="min-w-[160px] px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Ngày nhận</span></th>
                  <th className="min-w-[150px] bg-slate-50 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Đang tải dữ liệu...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Không có dữ liệu</td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const flowStep = String(row.flow_step || '').toUpperCase();
                    const badgeClass = FLOW_BADGE_CLASS[flowStep] || 'bg-slate-100 text-slate-700';
                    const statusDisplay = buildFriendlyStatusLabels(row, statusById);
                    return (
                      <tr key={String(row.id)} className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-teal-50/40">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.request_code || '--'}</td>
                        <td className="max-w-[360px] px-6 py-4 text-sm text-slate-900">
                          <p className="line-clamp-2 font-semibold">{row.summary || '--'}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.notes || '--'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                            {statusDisplay.badgeLabel}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{statusDisplay.pathLabel}</p>
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-4 text-sm text-slate-600" title={row.customer_name || ''}>
                          {row.customer_name || '--'}
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-4 text-sm text-slate-600" title={row.assignee_name || ''}>
                          {row.assignee_name || '--'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{toDisplayDate(row.requested_date)}</td>
                        <td className="bg-white px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openHistory(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-primary"
                              title="Lịch sử"
                            >
                              <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                            <button
                              type="button"
                              disabled={!canWriteRequests}
                              onClick={() => openEditModal(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-primary disabled:opacity-40"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={!canDeleteRequests}
                              onClick={() => handleDelete(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-error disabled:opacity-40"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>Tổng {totalRows} bản ghi. Trang {currentPage}/{Math.max(1, totalPages)}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages || 1, prev + 1))}
                disabled={currentPage >= (totalPages || 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      </div>

      {historyTarget ? (
      <div
        ref={historySectionRef}
        className="mt-6 md:mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fade-in"
        style={{ animationDelay: '0.25s' }}
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 md:text-lg">Nhật ký thay đổi</h3>
            <p
              className="mt-0.5 truncate text-xs text-slate-500"
              title={`${historyTarget.request_code || '--'} - ${historyTarget.summary || '--'}`}
            >
              Đang hiển thị yêu cầu:
              {' '}
              <span className="font-semibold text-slate-700">{historyTarget.request_code || '--'}</span>
              {' - '}
              {historyTarget.summary || '--'}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <button
              type="button"
              onClick={clearHistoryFocus}
              className="h-10 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Bỏ lọc yêu cầu
            </button>
            <div className="relative w-full md:w-[340px]">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={historySearchTerm}
                onChange={(event) => setHistorySearchTerm(event.target.value)}
                placeholder="Tìm theo mã task, nội dung, người cập nhật..."
                className="h-10 w-full rounded-lg bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 md:px-6">
          {isHistoryLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((index) => (
                <div key={`history-skeleton-${index}`} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-64 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-48 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : historyError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {historyError}
            </div>
          ) : filteredHistoryRows.length > 0 ? (
            <div className="space-y-6">
              {historyTimeline.nodes.length > 0 ? (
                <ol className="relative ml-3 border-l border-slate-200 pl-6">
                  {historyTimeline.nodes.map((node) => {
                    const transition = node.transition;
                    const sourceLabel = CHANGE_TYPE_LABEL_MAP[transition.sourceType] || transition.sourceType || '--';
                    const sourceClass = CHANGE_TYPE_BADGE_CLASS[transition.sourceType] || 'bg-slate-100 text-slate-700';
                    const transitionEntry = transition.entry;
                    const isPausedTransition = isProgrammingPausedTransition(transitionEntry);
                    const isUpcodeTransition = isProgrammingUpcodeTransition(transitionEntry);
                    const matchedUpcodeWorklog = isUpcodeTransition
                      ? node.children.find((child) => (
                        child.sourceType === 'WORKLOG'
                        && normalizeStatusCodeKey(child.entry.new_status) === 'UPCODE'
                      ))
                      : null;
                    const transitionNote = normalizeText(transitionEntry.note || '');
                    const pauseReason = normalizeText(transitionEntry.pause_reason || '');
                    const pauseProgressLabel = toProgressLabel(transitionEntry.progress);
                    const upcodeContent = normalizeText(matchedUpcodeWorklog?.entry.note || '');
                    const upcodeStatusLabel = toFriendlyUpcodeStatusLabel(transitionEntry.upcode_status);

                    return (
                      <li key={transition.key} className="relative pb-5 last:pb-0">
                        <span className="absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full border border-primary/40 bg-primary ring-4 ring-white" />
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sourceClass}`}>
                              {sourceLabel}
                            </span>
                            <span className="text-xs text-slate-500">
                              {toDisplayDateTime(transition.entry.occurred_at)}
                            </span>
                          </div>

                          {transition.statusDisplay.mode === 'transition' ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {transition.statusDisplay.fromLabel}
                              </span>
                              <span className="material-symbols-outlined text-sm text-slate-300">arrow_forward</span>
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                {transition.statusDisplay.toLabel}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {transition.statusDisplay.singleLabel}
                              </span>
                            </div>
                          )}

                          <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
                            <span className="min-w-0">
                              Mã task:
                              {' '}
                              <span className="font-mono text-slate-700">{transition.taskCodeDisplay}</span>
                            </span>
                            <span className="text-right">
                              Người cập nhật:
                              {' '}
                              <span className="font-medium text-slate-700">{transition.entry.actor_name || 'Hệ thống'}</span>
                            </span>
                          </div>
                          {isPausedTransition ? (
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              <p>
                                <span className="font-medium text-slate-700">Nội dung tạm ngưng:</span>
                                {' '}
                                {pauseReason || '--'}
                              </p>
                              <p>
                                <span className="font-medium text-slate-700">Tiến độ:</span>
                                {' '}
                                {pauseProgressLabel}
                              </p>
                            </div>
                          ) : isUpcodeTransition ? (
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              <p>
                                <span className="font-medium text-slate-700">Nội dung Upcode:</span>
                                {' '}
                                {upcodeContent || '--'}
                              </p>
                              <p>
                                <span className="font-medium text-slate-700">Trạng thái upcode:</span>
                                {' '}
                                {upcodeStatusLabel}
                              </p>
                              <p>
                                <span className="font-medium text-slate-700">Ghi chú:</span>
                                {' '}
                                {transitionNote || '--'}
                              </p>
                            </div>
                          ) : transitionNote !== '' ? (
                            <p className="mt-2 text-sm text-slate-600">{transitionNote}</p>
                          ) : null}
                        </div>

                        {node.children.length > 0 ? (
                          <div className="ml-5 mt-3 space-y-2 border-l border-dashed border-slate-200 pl-4">
                            {node.children.map((child) => {
                              const childSourceLabel = CHANGE_TYPE_LABEL_MAP[child.sourceType] || child.sourceType || '--';
                              const childSourceClass = CHANGE_TYPE_BADGE_CLASS[child.sourceType] || 'bg-slate-100 text-slate-700';
                              return (
                                <div key={child.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${childSourceClass}`}>
                                      {childSourceLabel}
                                    </span>
                                    <span className="text-xs text-slate-500">{toDisplayDateTime(child.entry.occurred_at)}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                    <span>
                                      Mã task:
                                      {' '}
                                      <span className="font-mono text-slate-700">{child.taskCodeDisplay}</span>
                                    </span>
                                    <span className="text-right">
                                      Người cập nhật:
                                      {' '}
                                      <span className="font-medium text-slate-700">{child.entry.actor_name || 'Hệ thống'}</span>
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-slate-700">{child.entry.request_summary || '--'}</p>
                                  {child.entry.note ? (
                                    <p className="mt-1 text-xs text-slate-500">{child.entry.note}</p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {historyTimeline.orphans.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Cập nhật khác</p>
                  <div className="mt-3 space-y-2">
                    {historyTimeline.orphans.map((item) => {
                      const sourceLabel = CHANGE_TYPE_LABEL_MAP[item.sourceType] || item.sourceType || '--';
                      const sourceClass = CHANGE_TYPE_BADGE_CLASS[item.sourceType] || 'bg-slate-100 text-slate-700';
                      return (
                        <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sourceClass}`}>
                              {sourceLabel}
                            </span>
                            <span className="text-xs text-slate-500">{toDisplayDateTime(item.entry.occurred_at)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>
                              Mã task:
                              {' '}
                              <span className="font-mono text-slate-700">{item.taskCodeDisplay}</span>
                            </span>
                            <span className="text-right">
                              Người cập nhật:
                              {' '}
                              <span className="font-medium text-slate-700">{item.entry.actor_name || 'Hệ thống'}</span>
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-700">{item.entry.request_summary || '--'}</p>
                          {item.entry.note ? <p className="mt-1 text-xs text-slate-500">{item.entry.note}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Yêu cầu này chưa có nhật ký thay đổi.
            </div>
          )}
        </div>
      </div>
      ) : null}

      {formMode ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (!isSaving) {
              closeFormModal();
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {formMode === 'create' ? 'Thêm yêu cầu khách hàng' : 'Cập nhật yêu cầu khách hàng'}
              </h3>
              <button type="button" onClick={closeFormModal} className="material-symbols-outlined text-slate-500">close</button>
            </div>

            <div className="space-y-4 p-5">
              {isCatalogLoading ? <div className="text-sm text-slate-500">Đang tải cấu hình workflow...</div> : null}

              <div className="grid gap-3 md:grid-cols-2">
                <SearchableSelect
                  className="md:col-span-2"
                  value={formValues.project_item_id}
                  options={projectItemOptions}
                  onChange={handleProjectItemChange}
                  label="Phần mềm triển khai"
                  required
                  placeholder="Chọn phần mềm triển khai"
                  searchPlaceholder="Tìm phần mềm triển khai..."
                />
                {selectedProjectItem ? (
                  <p className="md:col-span-2 -mt-2 text-xs text-slate-500">
                    Sản phẩm:
                    {' '}
                    <span className="font-medium text-slate-700">{selectedProjectItem.product_name || '--'}</span>
                    {' | '}
                    Đơn vị:
                    {' '}
                    <span className="font-medium text-slate-700">{selectedCustomerName || selectedProjectItem.customer_name || '--'}</span>
                  </p>
                ) : null}

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Nội dung yêu cầu <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formValues.summary}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, summary: event.target.value }))}
                    rows={3}
                    placeholder="Mô tả chi tiết yêu cầu cần xử lý..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {isProgrammingDmsExchangeLeafStatus ? (
                  <>
                    <SearchableSelect
                      value={formValues.reporter_contact_id}
                      options={reporterContactOptions}
                      onChange={(value) => {
                        const selectedContact = customerPersonnelById.get(String(value || ''));
                        setFormValues((prev) => ({
                          ...prev,
                          reporter_contact_id: value,
                          requester_name: selectedContact?.fullName || '',
                        }));
                      }}
                      label="Người yêu cầu"
                      placeholder={
                        formValues.customer_id
                          ? 'Chọn người yêu cầu'
                          : 'Chọn phần mềm triển khai để tải người yêu cầu'
                      }
                      disabled={!formValues.customer_id}
                    />

                    <SearchableSelect
                      value={formValues.service_group_id}
                      options={supportGroupOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, service_group_id: value }))}
                      label="Nhóm Zalo/Tele"
                      placeholder="Chọn nhóm Zalo/Tele"
                      searchPlaceholder="Tìm nhóm Zalo/Tele..."
                    />
                  </>
                ) : !isProgrammingInProgressLeafStatus &&
                  !isProgrammingUpcodeLeafStatus &&
                  !isProgrammingPausedLeafStatus &&
                  !isProgrammingDmsCreateTaskLeafStatus &&
                  !isProgrammingDmsPausedLeafStatus &&
                  !isProgrammingDmsCompletedLeafStatus ? (
                  <>
                    <SearchableSelect
                      value={formValues.service_group_id}
                      options={supportGroupOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, service_group_id: value }))}
                      label="Nhóm Zalo/Tele"
                      placeholder="Chọn nhóm Zalo/Tele"
                      searchPlaceholder="Tìm nhóm Zalo/Tele..."
                    />

                    <SearchableSelect
                      value={formValues.reporter_contact_id}
                      options={reporterContactOptions}
                      onChange={(value) => {
                        const selectedContact = customerPersonnelById.get(String(value || ''));
                        setFormValues((prev) => ({
                          ...prev,
                          reporter_contact_id: value,
                          requester_name: selectedContact?.fullName || '',
                        }));
                      }}
                      label="Người yêu cầu"
                      placeholder={
                        formValues.customer_id
                          ? 'Chọn người yêu cầu'
                          : 'Chọn phần mềm triển khai để tải người yêu cầu'
                      }
                      disabled={!formValues.customer_id}
                    />
                  </>
                ) : null}

                {!isProgrammingCompletedLeafStatus &&
                !isProgrammingUpcodeLeafStatus &&
                !isProgrammingPausedLeafStatus &&
                !isProgrammingDmsExchangeLeafStatus &&
                !isProgrammingDmsCreateTaskLeafStatus &&
                !isProgrammingDmsPausedLeafStatus &&
                !isProgrammingDmsCompletedLeafStatus ? (
                  <SearchableSelect
                    value={formPriority}
                    options={[
                      { value: 'LOW', label: 'Thấp' },
                      { value: 'MEDIUM', label: 'Trung bình' },
                      { value: 'HIGH', label: 'Cao' },
                      { value: 'URGENT', label: 'Khẩn cấp' },
                    ]}
                    onChange={(value) =>
                      setFormPriority((['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(value) ? value : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
                    }
                    label="Mức ưu tiên"
                  />
                ) : null}

                {shouldRenderStandaloneRequestedDate ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày nhận yêu cầu</label>
                    <input
                      type="date"
                      value={formValues.requested_date}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, requested_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : null}

                <div
                  className={[
                    'md:col-span-2 grid gap-3',
                    statusGridColumnsClass,
                  ].join(' ')}
                >
                  {!shouldHideDirectionInEdit ? (
                    <SearchableSelect
                      value={selectedLevel1}
                      options={level1Options}
                      onChange={(value) => {
                        setSelectedLevel1(value);
                        setSelectedLevel2('');
                        setSelectedLevel3('');
                      }}
                      label="Luồng yêu cầu"
                      placeholder="Chọn luồng yêu cầu"
                    />
                  ) : null}
                  {showLevel2 ? (
                    <SearchableSelect
                      value={selectedLevel2}
                      options={level2Options}
                      onChange={(value) => {
                        setSelectedLevel2(value);
                        setSelectedLevel3('');
                      }}
                      label="Hướng xử lý"
                      placeholder="Chọn hướng xử lý"
                    />
                  ) : null}
                  {showLevel3 ? (
                    <SearchableSelect
                      value={selectedLevel3}
                      options={level3Options}
                      onChange={(value) => setSelectedLevel3(value)}
                      label="Trạng thái xử lý"
                      placeholder="Chọn trạng thái xử lý"
                    />
                  ) : null}
                </div>

                {isProgrammingDmsExchangeLeafStatus ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Tiến độ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={dmsProgressValue}
                        onChange={(event) => setWorkflowFieldValue(dmsProgressFieldKey, 'dms_progress', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={formValues.receiver_user_id}
                      options={receiverOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, receiver_user_id: value }))}
                      label="Người phân công"
                      placeholder={isReceiverLoading ? 'Đang tải người phân công...' : 'Chọn người phân công'}
                      searchPlaceholder="Tìm người phân công..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tiếp nhận</label>
                      <input
                        type="date"
                        value={formValues.requested_date}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, requested_date: event.target.value }))}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={formValues.assignee_id}
                      options={employeeOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
                      label="Người xử lý"
                      placeholder="Chọn người xử lý"
                      searchPlaceholder="Tìm người xử lý..."
                    />

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày trao đổi lại với DMS</label>
                      <input
                        type="date"
                        value={dmsExchangeDateValue}
                        onChange={(event) => setWorkflowFieldValue(dmsExchangeDateFieldKey, 'dms_exchange_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Nội dung trao đổi</label>
                      <textarea
                        value={dmsExchangeContentValue}
                        onChange={(event) => setWorkflowFieldValue(dmsExchangeContentFieldKey, 'dms_exchange_content', event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày DMS phản hồi</label>
                      <input
                        type="date"
                        value={dmsFeedbackDateValue}
                        onChange={(event) => setWorkflowFieldValue(dmsFeedbackDateFieldKey, 'dms_feedback_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Nội dung DMS phản hồi</label>
                      <textarea
                        value={dmsFeedbackContentValue}
                        onChange={(event) => setWorkflowFieldValue(dmsFeedbackContentFieldKey, 'dms_feedback_content', event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </>
                ) : isProgrammingDmsCreateTaskLeafStatus ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tạo</label>
                    <input
                      type="date"
                      value={createTaskDateValue}
                      onChange={(event) => setWorkflowFieldValue(createTaskDateFieldKey, 'create_task_date', event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : isProgrammingDmsPausedLeafStatus ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Thời gian tạm ngưng</label>
                      <input
                        type="date"
                        value={pauseDateValue}
                        onChange={(event) => setWorkflowFieldValue(pauseDateFieldKey, 'pause_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={pauseUserValue}
                      options={receiverOptions}
                      onChange={(value) => setWorkflowFieldValue(pauseUserFieldKey, 'pause_user_id', value)}
                      label="Người tạm ngưng"
                      placeholder={isReceiverLoading ? 'Đang tải người tạm ngưng...' : 'Chọn người tạm ngưng'}
                      searchPlaceholder="Tìm người tạm ngưng..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />
                  </>
                ) : isProgrammingDmsCompletedLeafStatus ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Thời gian hoàn thành</label>
                      <input
                        type="date"
                        value={completionDateValue}
                        onChange={(event) => setWorkflowFieldValue(completionDateFieldKey, 'completion_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={completionUserValue}
                      options={receiverOptions}
                      onChange={(value) => setWorkflowFieldValue(completionUserFieldKey, 'completion_user_id', value)}
                      label="Người hoàn thành"
                      placeholder={isReceiverLoading ? 'Đang tải người hoàn thành...' : 'Chọn người hoàn thành'}
                      searchPlaceholder="Tìm người hoàn thành..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />
                  </>
                ) : isProgrammingUpcodeLeafStatus ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Tiến độ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={upcodeProgressValue}
                        onChange={(event) => setWorkflowFieldValue(upcodeProgressFieldKey, 'upcode_progress', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày upcode</label>
                      <input
                        type="date"
                        value={upcodeDateValue}
                        onChange={(event) => setWorkflowFieldValue(upcodeDateFieldKey, 'upcode_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={upcoderValue}
                      options={receiverOptions}
                      onChange={(value) => setWorkflowFieldValue(upcoderFieldKey, 'upcoder_id', value)}
                      label="Người upcode"
                      placeholder={isReceiverLoading ? 'Đang tải người upcode...' : 'Chọn người upcode'}
                      searchPlaceholder="Tìm người upcode..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />

                    <SearchableSelect
                      value={upcodeStatusValue}
                      options={[{ value: '', label: 'Chọn trạng thái upcode' }, ...UPCODE_STATUS_OPTIONS]}
                      onChange={(value) => setWorkflowFieldValue(upcodeStatusFieldKey, 'upcode_status', normalizeUpcodeStatus(value))}
                      label="Trạng thái upcode"
                      placeholder="Chọn trạng thái upcode"
                    />

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Worklog</label>
                      <textarea
                        value={upcodeWorklogValue}
                        onChange={(event) => setWorkflowFieldValue(upcodeWorklogFieldKey, 'upcode_worklog', event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={formValues.service_group_id}
                      options={supportGroupOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, service_group_id: value }))}
                      label="Nhóm Zalo/Tele"
                      placeholder="Chọn nhóm Zalo/Tele"
                      searchPlaceholder="Tìm nhóm Zalo/Tele..."
                    />

                    <SearchableSelect
                      value={formValues.reporter_contact_id}
                      options={reporterContactOptions}
                      onChange={(value) => {
                        const selectedContact = customerPersonnelById.get(String(value || ''));
                        setFormValues((prev) => ({
                          ...prev,
                          reporter_contact_id: value,
                          requester_name: selectedContact?.fullName || '',
                        }));
                      }}
                      label="Người yêu cầu"
                      placeholder={
                        formValues.customer_id
                          ? 'Chọn người yêu cầu'
                          : 'Chọn phần mềm triển khai để tải người yêu cầu'
                      }
                      disabled={!formValues.customer_id}
                    />

                    <SearchableSelect
                      value={completionUserValue}
                      options={employeeOptions}
                      onChange={(value) => setWorkflowFieldValue(completionUserFieldKey, 'completion_user_id', value)}
                      label="Người hoàn thành"
                      placeholder="Chọn người hoàn thành"
                      searchPlaceholder="Tìm người hoàn thành..."
                    />

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày hoàn thành</label>
                      <input
                        type="date"
                        value={completionDateValue}
                        onChange={(event) => setWorkflowFieldValue(completionDateFieldKey, 'completion_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </>
                ) : isProgrammingPausedLeafStatus ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Tiến độ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={pauseProgressValue}
                        onChange={(event) => setWorkflowFieldValue(pauseProgressFieldKey, 'pause_progress', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tạm ngưng</label>
                      <input
                        type="date"
                        value={pauseDateValue}
                        onChange={(event) => setWorkflowFieldValue(pauseDateFieldKey, 'pause_date', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={pauseUserValue}
                      options={receiverOptions}
                      onChange={(value) => setWorkflowFieldValue(pauseUserFieldKey, 'pause_user_id', value)}
                      label="Người tạm ngưng"
                      placeholder={isReceiverLoading ? 'Đang tải người tạm ngưng...' : 'Chọn người tạm ngưng'}
                      searchPlaceholder="Tìm người tạm ngưng..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Nội dung tạm ngưng</label>
                      <textarea
                        value={pauseReasonValue}
                        onChange={(event) => setWorkflowFieldValue(pauseReasonFieldKey, 'pause_reason', event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </>
                ) : isProgrammingCompletedLeafStatus ? (
                  <>
                    {programmingCompletionUserField ? (
                      renderFieldInput(programmingCompletionUserField)
                    ) : (
                      <SearchableSelect
                        value={formValues.completion_user_id}
                        options={employeeOptions}
                        onChange={(value) => setFormValues((prev) => ({ ...prev, completion_user_id: value }))}
                        label="Người hoàn thành"
                        placeholder="Chọn người hoàn thành"
                        searchPlaceholder="Tìm người hoàn thành..."
                      />
                    )}

                    {programmingCompletionDateField ? (
                      renderFieldInput(programmingCompletionDateField)
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày hoàn thành</label>
                        <input
                          type="date"
                          value={formValues.completion_date}
                          onChange={(event) => setFormValues((prev) => ({ ...prev, completion_date: event.target.value }))}
                          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    )}
                  </>
                ) : shouldRenderReceiverDateBeforeAssignee ? (
                  <>
                    <SearchableSelect
                      value={formValues.receiver_user_id}
                      options={receiverOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, receiver_user_id: value }))}
                      label="Người phân công"
                      placeholder={isReceiverLoading ? 'Đang tải người phân công...' : 'Chọn người phân công'}
                      searchPlaceholder="Tìm người phân công..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tiếp nhận</label>
                      <input
                        type="date"
                        value={formValues.requested_date}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, requested_date: event.target.value }))}
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <SearchableSelect
                      value={formValues.assignee_id}
                      options={employeeOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
                      label="Người xử lý"
                      placeholder="Chọn người xử lý"
                      searchPlaceholder="Tìm người xử lý..."
                    />
                  </>
                ) : (
                  <>
                    <SearchableSelect
                      value={formValues.assignee_id}
                      options={employeeOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
                      label="Người xử lý"
                      placeholder="Chọn người xử lý"
                      searchPlaceholder="Tìm người xử lý..."
                    />

                    <SearchableSelect
                      value={formValues.receiver_user_id}
                      options={receiverOptions}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, receiver_user_id: value }))}
                      label="Người phân công"
                      placeholder={isReceiverLoading ? 'Đang tải người phân công...' : 'Chọn người phân công'}
                      searchPlaceholder="Tìm người phân công..."
                      searching={isReceiverLoading}
                      disabled={isReceiverLoading}
                    />
                  </>
                )}

                {(isWaitingCustomerFeedbackStatus || isProcessingLeafStatus || isSupportCompletedLeafStatus) && exchangeDateField
                  ? renderFieldInput(exchangeDateField)
                  : null}
                {(isWaitingCustomerFeedbackStatus || isProcessingLeafStatus || isSupportCompletedLeafStatus) && exchangeContentField
                  ? renderFieldInput(exchangeContentField)
                  : null}
                {(isWaitingCustomerFeedbackStatus || isProcessingLeafStatus || isSupportCompletedLeafStatus) && customerFeedbackDateField
                  ? renderFieldInput(customerFeedbackDateField)
                  : null}
                {(isWaitingCustomerFeedbackStatus || isProcessingLeafStatus || isSupportCompletedLeafStatus) && customerFeedbackContentField
                  ? renderFieldInput(customerFeedbackContentField)
                  : null}

                {isProcessingLeafStatus && processingDateField ? renderFieldInput(processingDateField) : null}
                {isProcessingLeafStatus ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Tiến độ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={processingProgressValue}
                      onChange={(event) => setWorkflowFieldValue(processingProgressFieldKey, 'processing_progress', event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : null}
                {isProcessingLeafStatus && processingWorklogField ? renderFieldInput(processingWorklogField) : null}
                {isProcessingLeafStatus && plannedCompletionDateField ? renderFieldInput(plannedCompletionDateField) : null}
                {isProcessingLeafStatus && !plannedCompletionDateField ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày hoàn thành dự kiến</label>
                    <input
                      type="date"
                      value={plannedCompletionFallbackValue}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, planned_completion_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : null}

                {isNotExecuteLeafStatus && notExecuteReasonField ? renderFieldInput(notExecuteReasonField) : null}
                {isNotExecuteLeafStatus && processingDateField ? renderFieldInput(processingDateField) : null}
                {isSupportCompletedLeafStatus && actualCompletionDateField ? renderFieldInput(actualCompletionDateField) : null}
                {isSupportCompletedLeafStatus && !actualCompletionDateField ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày hoàn thành thực tế</label>
                    <input
                      type="date"
                      value={actualCompletionFallbackValue}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, actual_completion_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : null}
                {isNotifyCustomerLeafStatus && customerNotifyDateField ? renderFieldInput(customerNotifyDateField) : null}
                {isNotifyCustomerLeafStatus && customerNotifyUserField ? renderFieldInput(customerNotifyUserField) : null}
                {isReturnToManagerLeafStatus && returnToManagerDateField ? renderFieldInput(returnToManagerDateField) : null}
                {isReturnToManagerLeafStatus && returnToManagerContentField ? renderFieldInput(returnToManagerContentField) : null}

                {isProgrammingInProgressLeafStatus && programmingFromDateField ? renderFieldInput(programmingFromDateField) : null}
                {isProgrammingInProgressLeafStatus && programmingProgressField ? renderFieldInput(programmingProgressField) : null}
                {isProgrammingInProgressLeafStatus && programmingToDateField ? renderFieldInput(programmingToDateField) : null}
                {isProgrammingInProgressLeafStatus && programmingExtendedDateField ? renderFieldInput(programmingExtendedDateField) : null}
                {isProgrammingInProgressLeafStatus && programmingExecutorField ? renderFieldInput(programmingExecutorField) : null}
                {isProgrammingInProgressLeafStatus && programmingWorklogField ? renderFieldInput(programmingWorklogField) : null}

                {!isProgrammingCompletedLeafStatus && !isProgrammingPausedLeafStatus ? (
                  <SearchableSelect
                    value={formValues.reference_ticket_code}
                    options={supportRequestReferenceOptions}
                    onChange={(value) => {
                      const matched = supportRequestReferenceMap.get(normalizeToken(value || ''));
                      setFormValues((prev) => ({
                        ...prev,
                        reference_ticket_code: value,
                        reference_request_id:
                          matched?.id !== undefined && matched?.id !== null ? String(matched.id) : '',
                      }));
                    }}
                    label="Mã task tham chiếu"
                    placeholder="Chọn/Nhập mã task tham chiếu"
                    searchPlaceholder="Nhập mã task tham chiếu để tìm..."
                    searching={isReferenceSearchLoading}
                    onSearchTermChange={(keyword) => {
                      void triggerReferenceSearch(keyword);
                    }}
                  />
                ) : null}
              </div>

              {!isProgrammingCompletedLeafStatus && !isProgrammingPausedLeafStatus ? (
                <>
                  {selectedReferenceRequest ? (
                    <p className="text-xs text-slate-500">
                      Tham chiếu tới:
                      {' '}
                      <span className="font-semibold text-slate-700">{resolveSupportTaskCode(selectedReferenceRequest) || '--'}</span>
                      {' - '}
                      <span className="text-slate-600">{selectedReferenceRequest.summary || '--'}</span>
                    </p>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700">Danh sách task tham chiếu</h4>
                      <button
                        type="button"
                        onClick={addFormTaskRow}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Thêm task
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formTasks.map((task, index) => (
                        <div key={task.local_id} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1.2fr_0.9fr_auto]">
                          <input
                            type="text"
                            value={task.task_code}
                            onChange={(event) => updateTaskRow(task.local_id, 'task_code', event.target.value)}
                            placeholder={`Mã task #${index + 1}`}
                            className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <input
                            type="text"
                            value={task.task_link}
                            onChange={(event) => updateTaskRow(task.local_id, 'task_link', event.target.value)}
                            placeholder="Link task (tuỳ chọn)"
                            className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <SearchableSelect
                            value={task.status}
                            options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                            onChange={(value) => updateTaskRow(task.local_id, 'status', value)}
                            compact
                          />
                          <button
                            type="button"
                            onClick={() => removeTaskRow(task.local_id)}
                            className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title="Xoá task"
                          >
                            delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Ghi chú</label>
                    <textarea
                      value={formValues.notes}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              ) : null}

              {!isProgrammingPausedLeafStatus &&
              !isProgrammingDmsCreateTaskLeafStatus &&
              !isProgrammingDmsPausedLeafStatus &&
              !isProgrammingDmsCompletedLeafStatus ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {remainingDynamicWorkflowFields.map((field) => renderFieldInput(field))}
                </div>
              ) : null}

              {exchangeDateConstraintMessage !== '' ? (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{exchangeDateConstraintMessage}</div>
              ) : null}

              {formError ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</div> : null}
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeFormModal} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600">
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
