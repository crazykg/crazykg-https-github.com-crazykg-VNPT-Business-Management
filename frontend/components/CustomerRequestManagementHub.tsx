import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCustomerRequest,
  deleteCustomerRequest,
  exportCustomerRequestsCsv,
  exportCustomerRequestDashboardSummaryCsv,
  fetchAvailableSupportServiceGroups,
  fetchCustomerRequestDashboardSummary,
  fetchCustomerRequestReceivers,
  fetchCustomerRequestProjectItems,
  fetchCustomerRequestHistory,
  fetchCustomerRequestHistories,
  fetchCustomerRequestReferenceSearch,
  fetchCustomerRequestsPage,
  fetchWorkflowFormFieldConfigs,
  fetchWorkflowStatusCatalogs,
  importCustomerRequests,
  isRequestCanceledError,
  uploadDocumentAttachment,
  updateCustomerRequest,
} from '../services/v5Api';
import {
  Attachment,
  Customer,
  CustomerPersonnel,
  CustomerRequestChangeLogEntry,
  CustomerRequestDashboardSummaryPayload,
  CustomerRequestReferenceSearchItem,
  CustomerRequest,
  Employee,
  ProjectItemMaster,
  SupportRequestTaskStatus,
  SupportServiceGroup,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
} from '../types';
import { AttachmentManager } from './AttachmentManager';
import { SearchableSelect } from './SearchableSelect';
import { parseImportFile, pickImportSheetByModule } from '../utils/importParser';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type FormMode = 'create' | 'edit';
type ProcessingActorTab = 'CREATOR' | 'ASSIGNER' | 'WORKER';
type WorkflowSectionRenderOptions = {
  showLevel2Selector?: boolean;
  showLevel3Selector?: boolean;
};

type DashboardDrilldownState = {
  workflow_action_code?: string;
  workflow_action_label?: string;
  service_group_id?: string | number;
  service_group_label?: string;
  to_status_catalog_id?: string | number;
  to_status_catalog_label?: string;
};

type HistoryViewMode = 'request' | 'dashboard' | null;

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
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
  bodyTextDisplay: string;
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

const EMPTY_RECEIVER_OPTIONS = [{ value: '', label: 'Chọn người giao việc [A]' }];

const formatDashboardMetricValue = (value: number | null | undefined): string =>
  Number(value || 0).toLocaleString('vi-VN');

const buildCustomerRequestListFilters = (
  status: string,
  dashboardDrilldown: DashboardDrilldownState | null
): Record<string, string | number> | undefined => {
  const filters: Record<string, string | number> = {};

  if (status && status !== 'ALL') {
    filters.status = status;
  }

  if (dashboardDrilldown?.workflow_action_code) {
    filters.workflow_action_code = dashboardDrilldown.workflow_action_code;
  }

  if (dashboardDrilldown?.service_group_id !== undefined && dashboardDrilldown?.service_group_id !== null && `${dashboardDrilldown.service_group_id}`.trim() !== '') {
    filters.service_group_id = dashboardDrilldown.service_group_id;
  }

  if (
    dashboardDrilldown?.to_status_catalog_id !== undefined
    && dashboardDrilldown?.to_status_catalog_id !== null
    && `${dashboardDrilldown.to_status_catalog_id}`.trim() !== ''
  ) {
    filters.to_status_catalog_id = dashboardDrilldown.to_status_catalog_id;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
};

const hasDashboardDrilldownFilters = (dashboardDrilldown: DashboardDrilldownState | null | undefined): boolean => Boolean(
  dashboardDrilldown?.workflow_action_code
  || (dashboardDrilldown?.service_group_id !== undefined
    && dashboardDrilldown?.service_group_id !== null
    && `${dashboardDrilldown.service_group_id}`.trim() !== '')
  || (dashboardDrilldown?.to_status_catalog_id !== undefined
    && dashboardDrilldown?.to_status_catalog_id !== null
    && `${dashboardDrilldown.to_status_catalog_id}`.trim() !== '')
);

const mergeDashboardDrilldownState = (
  current: DashboardDrilldownState | null,
  next: Partial<DashboardDrilldownState> | null
): DashboardDrilldownState | null => {
  if (next === null) {
    return null;
  }

  const merged: DashboardDrilldownState = {
    ...(current || {}),
    ...next,
  };

  return hasDashboardDrilldownFilters(merged) ? merged : null;
};

const buildDashboardDrilldownChips = (
  dashboardDrilldown: DashboardDrilldownState | null,
  dateFrom?: string,
  dateTo?: string
): Array<{ key: 'workflow_action_code' | 'service_group_id' | 'to_status_catalog_id' | 'date_from' | 'date_to'; label: string }> => {
  const chips: Array<{ key: 'workflow_action_code' | 'service_group_id' | 'to_status_catalog_id' | 'date_from' | 'date_to'; label: string }> = [];
  if (dashboardDrilldown?.workflow_action_code) {
    chips.push({
      key: 'workflow_action_code',
      label: dashboardDrilldown.workflow_action_label || dashboardDrilldown.workflow_action_code,
    });
  }
  if (
    dashboardDrilldown?.service_group_id !== undefined
    && dashboardDrilldown?.service_group_id !== null
    && `${dashboardDrilldown.service_group_id}`.trim() !== ''
  ) {
    chips.push({
      key: 'service_group_id',
      label: dashboardDrilldown.service_group_label || `Nhóm hỗ trợ #${dashboardDrilldown.service_group_id}`,
    });
  }
  if (
    dashboardDrilldown?.to_status_catalog_id !== undefined
    && dashboardDrilldown?.to_status_catalog_id !== null
    && `${dashboardDrilldown.to_status_catalog_id}`.trim() !== ''
  ) {
    chips.push({
      key: 'to_status_catalog_id',
      label: dashboardDrilldown.to_status_catalog_label || `Trạng thái #${dashboardDrilldown.to_status_catalog_id}`,
    });
  }
  if (normalizeText(dateFrom) !== '') {
    chips.push({
      key: 'date_from',
      label: `Từ ngày: ${toDisplayDate(dateFrom)}`,
    });
  }
  if (normalizeText(dateTo) !== '') {
    chips.push({
      key: 'date_to',
      label: `Đến ngày: ${toDisplayDate(dateTo)}`,
    });
  }

  return chips;
};

const buildCustomerRequestDashboardFilters = (
  status: string,
  dashboardDateFrom: string,
  dashboardDateTo: string,
  dashboardDrilldown?: DashboardDrilldownState | null
): Record<string, string | number> | undefined => {
  const filters: Record<string, string | number> = {};

  if (status && status !== 'ALL') {
    filters.status = status;
  }

  if (normalizeText(dashboardDateFrom) !== '') {
    filters.date_from = normalizeText(dashboardDateFrom);
  }

  if (normalizeText(dashboardDateTo) !== '') {
    filters.date_to = normalizeText(dashboardDateTo);
  }

  if (dashboardDrilldown?.workflow_action_code) {
    filters.workflow_action_code = dashboardDrilldown.workflow_action_code;
  }

  if (
    dashboardDrilldown?.service_group_id !== undefined
    && dashboardDrilldown?.service_group_id !== null
    && `${dashboardDrilldown.service_group_id}`.trim() !== ''
  ) {
    filters.service_group_id = dashboardDrilldown.service_group_id;
  }

  if (
    dashboardDrilldown?.to_status_catalog_id !== undefined
    && dashboardDrilldown?.to_status_catalog_id !== null
    && `${dashboardDrilldown.to_status_catalog_id}`.trim() !== ''
  ) {
    filters.to_status_catalog_id = dashboardDrilldown.to_status_catalog_id;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
};

const buildDashboardStackSegments = (
  items: Array<{ key: string; label: string; value: number; className: string }>
): Array<{ key: string; label: string; value: number; className: string; widthPercent: number }> => {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0);
  if (total <= 0) {
    return items.map((item) => ({ ...item, widthPercent: 0 }));
  }

  return items.map((item) => ({
    ...item,
    widthPercent: (Math.max(0, Number(item.value || 0)) / total) * 100,
  }));
};

const toLocalDateInputValue = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const resolveWorkflowFieldType = (
  field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label' | 'field_type'>
): string => {
  const key = String(field.field_key || '');
  const fieldType = String(field.field_type || 'text');
  const semanticField = resolveWorkflowSemanticFieldKey(field);
  const label = field.field_label || key;
  const keyToken = normalizeFieldToken(key);
  const labelToken = normalizeFieldToken(label);

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
};

const shouldUseVnDateAutofill = (
  field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>
): boolean => {
  const keyToken = normalizeFieldToken(field.field_key || '');
  const labelToken = normalizeFieldToken(field.field_label || '');

  return WORKFLOW_RETURN_TO_MANAGER_DATE_FIELD_TOKENS.some(
    (token) => keyToken.includes(token) || labelToken.includes(token)
  );
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

  return toLocalDateInputValue(date);
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

const toDisplayDateTimeShort = (value: unknown): string => {
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
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

type ViewerExecutionRole = 'WORKER' | 'ASSIGNER' | 'INITIAL_RECEIVER' | 'OTHER';

const normalizeViewerExecutionRole = (value: unknown): ViewerExecutionRole | null => {
  const normalized = normalizeStatusCodeKey(value);
  if (
    normalized === 'WORKER'
    || normalized === 'ASSIGNER'
    || normalized === 'INITIAL_RECEIVER'
    || normalized === 'OTHER'
  ) {
    return normalized;
  }

  return null;
};

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
  analysis_progress: '',
  analysis_hours_estimated: '',
  analysis_completion_date: '',
  processing_hours_estimated: '',
  assigned_date: '',
  exchange_date: '',
  exchange_content: '',
  customer_feedback_date: '',
  customer_feedback_content: '',
  reference_ticket_code: '',
  reference_request_id: '',
  requested_date: '',
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

const WAITING_CUSTOMER_FEEDBACK_SEMANTIC_FIELD_KEYS = new Set<WorkflowSemanticFieldKey>([
  'exchange_date',
  'exchange_content',
  'customer_feedback_date',
  'customer_feedback_content',
]);

type CustomerRequestTaskSource = 'IT360' | 'REFERENCE';

type It360TaskFormRow = {
  local_id: string;
  task_code: string;
  task_link: string;
  status: SupportRequestTaskStatus;
};

type ReferenceTaskFormRow = {
  local_id: string;
  task_code: string;
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

const normalizeCustomerRequestTaskSource = (
  value: unknown,
  fallback: CustomerRequestTaskSource = 'IT360'
): CustomerRequestTaskSource => {
  const token = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

  if (token === 'REFERENCE' || token === 'REFERENCETASK' || token === 'THAMCHIEU') {
    return 'REFERENCE';
  }
  if (token === 'IT360') {
    return 'IT360';
  }
  return fallback;
};

const createEmptyIt360TaskRow = (partial?: Partial<It360TaskFormRow>): It360TaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

const createEmptyReferenceTaskRow = (partial?: Partial<ReferenceTaskFormRow>): ReferenceTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  task_code: partial?.task_code || '',
});

const buildIt360TaskSignature = (task: {
  task_code?: string | null;
  task_link?: string | null;
  status?: unknown;
}): string =>
  [
    normalizeToken(task.task_code || ''),
    normalizeText(task.task_link || ''),
    normalizeSupportTaskStatus(task.status),
  ].join('|');

const dedupeIt360TaskRows = (rows: It360TaskFormRow[]): It360TaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: It360TaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = buildIt360TaskSignature(task);
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

const buildReferenceTaskSignature = (task: { task_code?: string | null }): string =>
  normalizeToken(task.task_code || '');

const dedupeReferenceTaskRows = (rows: ReferenceTaskFormRow[]): ReferenceTaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: ReferenceTaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = buildReferenceTaskSignature(task);
    if (signature === '' || seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

const splitCustomerRequestTaskRows = (
  rows: Array<{
    task_source?: unknown;
    task_code?: unknown;
    task_link?: unknown;
    status?: unknown;
    task_status?: unknown;
  }>
): { it360Rows: It360TaskFormRow[]; referenceRows: ReferenceTaskFormRow[] } => {
  const it360Rows: It360TaskFormRow[] = [];
  const referenceRows: ReferenceTaskFormRow[] = [];

  rows.forEach((task) => {
    const source = normalizeCustomerRequestTaskSource(task.task_source, 'REFERENCE');
    const taskCode = String(task.task_code ?? '').trim();
    const taskLink = String(task.task_link ?? '').trim();
    const taskStatus = normalizeSupportTaskStatus(task.status ?? task.task_status ?? 'TODO');

    if (source === 'REFERENCE') {
      if (taskCode !== '') {
        referenceRows.push(createEmptyReferenceTaskRow({ task_code: taskCode }));
      }
      return;
    }

    if (taskCode === '' && taskLink === '') {
      return;
    }

    it360Rows.push(
      createEmptyIt360TaskRow({
        task_code: taskCode,
        task_link: taskLink,
        status: taskStatus,
      })
    );
  });

  return {
    it360Rows: dedupeIt360TaskRows(it360Rows),
    referenceRows: dedupeReferenceTaskRows(referenceRows),
  };
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

const buildHistoryBodyText = (item: Pick<CustomerRequestTimelineItem, 'entry' | 'taskCodeDisplay'>): string => {
  const code = normalizeText(item.taskCodeDisplay === '--' ? '' : item.taskCodeDisplay);
  const note = normalizeText(item.entry.note || '');

  if (code && note) {
    return `${code}: ${note}`;
  }

  return code || note;
};

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

const ANALYSIS_PROGRESS_METADATA_TOKENS = new Set([
  'analysisprogress',
]);

const ANALYSIS_PROGRESS_FIELD_TOKENS = ['analysisprogress'];
const ANALYSIS_HOURS_FIELD_TOKENS = [
  'analysishoursestimated',
  'analysishours',
  'sogiodukienthuchien',
  'sogiadukienthuchien',
];
const PROCESSING_HOURS_FIELD_TOKENS = [
  'processinghoursestimated',
  'processinghours',
  'sogiodukienxuly',
  'sogiodukienthuchienxuly',
  'sogiudukienxuly',
];
const ANALYSIS_COMPLETION_DATE_FIELD_TOKENS = [
  'analysiscompletiondate',
  'ngayhoanthanh',
  'ngayhoanathanh',
  'fieldngayhoanathanh',
];
const ANALYSIS_HIDDEN_LEGACY_FIELD_TOKENS = [
  'nidungphantichdinhkem',
  'nguoithuchien',
  'ngithchin',
];

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

const extractAnalysisProgressFromMetadata = (metadata: Record<string, unknown> | null | undefined): number | null => {
  if (!metadata) {
    return null;
  }

  for (const [key, rawValue] of Object.entries(metadata)) {
    const token = normalizeFieldToken(key);
    if (!token || !ANALYSIS_PROGRESS_METADATA_TOKENS.has(token)) {
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

const parseHoursEstimatedNumber = (value: unknown): number | null => {
  const text = normalizeText(value);
  if (text === '') {
    return null;
  }

  const normalized = text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidHoursEstimatedInput = (value: unknown): boolean => {
  const text = normalizeText(value);
  if (text === '') {
    return false;
  }

  return /^\d+(?:[.,]\d{1,2})?$/.test(text);
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

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  currentUserId = null,
  isAdminViewer = false,
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
  const [dashboardSummary, setDashboardSummary] = useState<CustomerRequestDashboardSummaryPayload | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [isDashboardExporting, setIsDashboardExporting] = useState(false);
  const [dashboardDrilldown, setDashboardDrilldown] = useState<DashboardDrilldownState | null>(null);
  const [dashboardDateFromInput, setDashboardDateFromInput] = useState('');
  const [dashboardDateToInput, setDashboardDateToInput] = useState('');
  const [dashboardDateFrom, setDashboardDateFrom] = useState('');
  const [dashboardDateTo, setDashboardDateTo] = useState('');

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
  const [exchangeContentInlineError, setExchangeContentInlineError] = useState('');
  const [customerFeedbackContentInlineError, setCustomerFeedbackContentInlineError] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>(emptyFormValues);
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [formIt360Tasks, setFormIt360Tasks] = useState<It360TaskFormRow[]>([createEmptyIt360TaskRow()]);
  const [formReferenceTasks, setFormReferenceTasks] = useState<ReferenceTaskFormRow[]>([createEmptyReferenceTaskRow()]);
  const [activeTaskTab, setActiveTaskTab] = useState<'IT360' | 'REFERENCE'>('IT360');
  const [taskReferenceSearchTerm, setTaskReferenceSearchTerm] = useState('');
  const [taskReferenceSearchResults, setTaskReferenceSearchResults] = useState<CustomerRequestReferenceSearchItem[]>([]);
  const [isTaskReferenceSearchLoading, setIsTaskReferenceSearchLoading] = useState(false);
  const [taskReferenceSearchError, setTaskReferenceSearchError] = useState('');
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [latestProgressBaseline, setLatestProgressBaseline] = useState<number | null>(null);
  const [didAttemptSaveWithoutProjectItem, setDidAttemptSaveWithoutProjectItem] = useState(false);
  const [attemptedReceiverBeforeProjectItem, setAttemptedReceiverBeforeProjectItem] = useState(false);
  const [attemptedAssigneeBeforeProjectItem, setAttemptedAssigneeBeforeProjectItem] = useState(false);
  const [processingActorTab, setProcessingActorTab] = useState<ProcessingActorTab>('CREATOR');
  const [selectedLevel1, setSelectedLevel1] = useState('');
  const [selectedLevel2, setSelectedLevel2] = useState('');
  const [selectedLevel3, setSelectedLevel3] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [isProjectItemsLoading, setIsProjectItemsLoading] = useState(false);
  const [availableSupportGroups, setAvailableSupportGroups] = useState<SupportServiceGroup[]>([]);
  const [isSupportGroupsLoading, setIsSupportGroupsLoading] = useState(false);
  const [receiverOptions, setReceiverOptions] = useState<Array<{ value: string; label: string }>>(EMPTY_RECEIVER_OPTIONS);
  const [isReceiverLoading, setIsReceiverLoading] = useState(false);
  const projectItemRequestVersionRef = useRef(0);
  const supportGroupRequestVersionRef = useRef(0);
  const receiverRequestVersionRef = useRef(0);
  const taskReferenceSearchRequestVersionRef = useRef(0);
  const receiverDefaultContextRef = useRef('');

  const editHistoryRequestVersionRef = useRef(0);
  const catalogRequestVersionRef = useRef(0);
  const listRequestVersionRef = useRef(0);
  const dashboardRequestVersionRef = useRef(0);
  const historyRequestVersionRef = useRef(0);
  const progressAutofillAppliedRef = useRef<Set<string>>(new Set());
  const preservedAnalysisPathStatusIdRef = useRef('');
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const [historyTarget, setHistoryTarget] = useState<CustomerRequest | null>(null);
  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>(null);
  const [historyDashboardDrilldown, setHistoryDashboardDrilldown] = useState<DashboardDrilldownState | null>(null);
  const [historyRows, setHistoryRows] = useState<CustomerRequestChangeLogEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableProjectItems = useMemo(
    () => (formMode ? scopedProjectItems : projectItems),
    [formMode, projectItems, scopedProjectItems]
  );

  const projectItemMap = useMemo(() => {
    const map = new Map<string, ProjectItemMaster>();
    availableProjectItems.forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [availableProjectItems]);

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
      ...availableProjectItems.map((item) => {
        const product = normalizeText(item.product_name || item.product_code || `#${item.product_id}`);
        const project = normalizeText(item.project_name || item.project_code || '');
        const customer = normalizeText(item.customer_name || item.customer_code || '');
        const label = [product, customer].filter((part) => part !== '').join(' | ');
        const searchText = [product, project, customer].filter((part) => part !== '').join(' | ');
        return {
          value: String(item.id),
          label: label || `#${item.id}`,
          searchText: searchText || label || `#${item.id}`,
        };
      }),
    ],
    [availableProjectItems]
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
      ...availableSupportGroups.map((item) => ({ value: String(item.id), label: item.group_name || `#${item.id}` })),
    ],
    [availableSupportGroups]
  );
  const supportGroupById = useMemo(() => {
    const map = new Map<string, SupportServiceGroup>();
    [...supportServiceGroups, ...availableSupportGroups].forEach((item) => {
      const id = normalizeText(item.id);
      if (id !== '') {
        map.set(id, item);
      }
    });
    return map;
  }, [availableSupportGroups, supportServiceGroups]);

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

  const employeeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((item) => {
      const id = normalizeText(item.id);
      if (!id) {
        return;
      }
      const code = normalizeText(item.user_code || item.username || '');
      const name = normalizeText(item.full_name || '');
      const label = code && name ? `${code} - ${name}` : (name || code || `#${id}`);
      map.set(id, label);
    });
    return map;
  }, [employees]);

  const receiverFallbackOptions = useMemo(
    () => [{ value: '', label: 'Chọn người giao việc [A]' }, ...employeeOptions.filter((item) => item.value !== '')],
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

  const taskReferenceOptions = useMemo(() => {
    const options = [{ value: '', label: 'Để trống', searchText: '' }];
    const seenValues = new Set<string>();

    const appendOption = (value: string, label: string, searchText?: string) => {
      const normalizedValue = normalizeToken(value);
      if (normalizedValue === '' || seenValues.has(normalizedValue)) {
        return;
      }
      seenValues.add(normalizedValue);
      options.push({
        value,
        label,
        searchText: searchText || label,
      });
    };

    taskReferenceSearchResults.forEach((item) => {
      const taskCode = normalizeText(item.task_code || item.ticket_code || '');
      const requestCode = normalizeText(item.request_code || '');
      const primaryCode = taskCode || requestCode;
      if (primaryCode === '') {
        return;
      }

      const summary = normalizeText(item.summary || '');
      const statusLabel = toFriendlyStatusLabel(item.status || '');
      const labelParts = [primaryCode];
      if (summary !== '') {
        labelParts.push(summary);
      }
      if (statusLabel !== '') {
        labelParts.push(statusLabel);
      }

      appendOption(
        primaryCode,
        labelParts.join(' | '),
        [primaryCode, requestCode, summary, statusLabel].filter(Boolean).join(' ')
      );
    });

    formReferenceTasks.forEach((task) => {
      const code = normalizeText(task.task_code);
      if (code === '') {
        return;
      }
      appendOption(code, code, code);
    });

    return options;
  }, [formReferenceTasks, taskReferenceSearchResults]);

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
    () => [
      { value: '', label: 'Chọn luồng xử lý' },
      ...(childrenByParent.get('root') || [])
        .filter((item) => {
          const tokens = [
            normalizeStatusCodeKey(item.status_code || ''),
            normalizeStatusCodeKey(item.canonical_status || ''),
          ];
          return !tokens.includes('MOI_TIEP_NHAN');
        })
        .map((item) => ({ value: String(item.id), label: item.status_name })),
    ],
    [childrenByParent]
  );

  const level2Children = useMemo(
    () => childrenByParent.get(String(selectedLevel1 || '')) || [],
    [childrenByParent, selectedLevel1]
  );

  const baseLevel2Options = useMemo(
    () => [{ value: '', label: 'Chọn trạng thái xử lý' }, ...level2Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level2Children]
  );

  const level3Children = useMemo(
    () => childrenByParent.get(String(selectedLevel2 || '')) || [],
    [childrenByParent, selectedLevel2]
  );

  const baseLevel3Options = useMemo(
    () => [{ value: '', label: 'Chọn xử lý' }, ...level3Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level3Children]
  );

  const showLevel2 = selectedLevel1 !== '' && level2Children.length > 0;
  const showLevel3 = showLevel2 && selectedLevel2 !== '' && level3Children.length > 0;
  const selectedLevel1Node = useMemo(
    () => (selectedLevel1 ? statusById.get(String(selectedLevel1)) || null : null),
    [selectedLevel1, statusById]
  );
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
  const isAnalysisLevel1Selected = useMemo(() => {
    if (!selectedLevel1Node) {
      return false;
    }

    return [
      normalizeStatusCodeKey(selectedLevel1Node.status_code || ''),
      normalizeStatusCodeKey(selectedLevel1Node.canonical_status || ''),
    ].includes('PHAN_TICH');
  }, [selectedLevel1Node]);
  const isProgrammingSelectionPlaceholderFlow = isProgrammingLevel2 && selectedLevel3 === '';
  const analysisProgressForUi = parseProgressNumber(formValues.analysis_progress);
  const isAnalysisSelectionFlow = isAnalysisLevel1Selected;
  const shouldRenderAnalysisPhaseFields = isAnalysisSelectionFlow && selectedLevel3 === '';
  const selectedLevel2CanonicalStatus = normalizeStatusCodeKey(
    selectedLevel2Node?.canonical_status || selectedLevel2Node?.status_code || ''
  );
  const isProgrammingOrDmsExecutionPath =
    selectedLevel2CanonicalStatus === 'LAP_TRINH'
    || selectedLevel2CanonicalStatus === 'CHUYEN_DMS';
  const normalizedCurrentUserId = normalizeText(currentUserId);
  const isExecutorUnassigned = normalizeText(formValues.assignee_id) === '';
  const isNewIntakeLevel1Selected = useMemo(() => {
    if (!selectedLevel1Node) {
      return false;
    }

    return [
      normalizeStatusCodeKey(selectedLevel1Node.status_code || ''),
      normalizeStatusCodeKey(selectedLevel1Node.canonical_status || ''),
    ].includes('MOI_TIEP_NHAN');
  }, [selectedLevel1Node]);
  const isPersistedIntakeRequest = useMemo(
    () => formMode === 'edit' && normalizeStatusCodeKey(editingRow?.status) === 'MOI_TIEP_NHAN',
    [editingRow?.status, formMode]
  );
  const isEffectiveIntakeWorkflowContext = isNewIntakeLevel1Selected
    || (isPersistedIntakeRequest && selectedLevel1 === '' && selectedLevel2 === '' && selectedLevel3 === '');
  const persistedViewerExecutionRole = useMemo(
    () => normalizeViewerExecutionRole(editingRow?.viewer_execution_role),
    [editingRow]
  );
  const persistedViewerWorkflowContext = editingRow?.viewer_role_context ?? null;
  const draftViewerExecutionRole = useMemo<ViewerExecutionRole | null>(() => {
    if (normalizedCurrentUserId === '') {
      return null;
    }

    const normalizedAssigneeId = normalizeText(formValues.assignee_id);
    const normalizedReceiverId = normalizeText(formValues.receiver_user_id);

    if (normalizedAssigneeId !== '' && normalizedAssigneeId === normalizedCurrentUserId) {
      return 'WORKER';
    }

    if (normalizedReceiverId !== '' && normalizedReceiverId === normalizedCurrentUserId) {
      return isEffectiveIntakeWorkflowContext ? 'INITIAL_RECEIVER' : 'ASSIGNER';
    }

    return 'OTHER';
  }, [
    formValues.assignee_id,
    formValues.receiver_user_id,
    isEffectiveIntakeWorkflowContext,
    normalizedCurrentUserId,
  ]);
  const draftViewerIsPm = useMemo(
    () => normalizedCurrentUserId !== '' && normalizeText(formValues.receiver_user_id) === normalizedCurrentUserId,
    [formValues.receiver_user_id, normalizedCurrentUserId]
  );
  const draftViewerIsExecutor = useMemo(
    () => normalizedCurrentUserId !== '' && normalizeText(formValues.assignee_id) === normalizedCurrentUserId,
    [formValues.assignee_id, normalizedCurrentUserId]
  );
  const hasAssignmentDraftContextChanges = useMemo(() => {
    if (formMode !== 'edit' || !editingRow) {
      return false;
    }

    return normalizeText(formValues.receiver_user_id) !== normalizeText(editingRow.receiver_user_id)
      || normalizeText(formValues.assignee_id) !== normalizeText(editingRow.assignee_id)
      || isEffectiveIntakeWorkflowContext !== Boolean(editingRow.viewer_is_initial_receiver_stage);
  }, [
    editingRow,
    formMode,
    formValues.assignee_id,
    formValues.receiver_user_id,
    isEffectiveIntakeWorkflowContext,
  ]);
  const effectiveViewerExecutionRole = hasAssignmentDraftContextChanges || persistedViewerExecutionRole === null
    ? (draftViewerExecutionRole ?? persistedViewerExecutionRole)
    : persistedViewerExecutionRole;
  const effectiveViewerIsPm = hasAssignmentDraftContextChanges || persistedViewerWorkflowContext === null
    ? draftViewerIsPm
    : Boolean(persistedViewerWorkflowContext.is_pm);
  const effectiveViewerIsExecutor = hasAssignmentDraftContextChanges || persistedViewerWorkflowContext === null
    ? draftViewerIsExecutor
    : Boolean(persistedViewerWorkflowContext.is_executor);
  const isAssignerExecutionView =
    (effectiveViewerIsPm && !effectiveViewerIsExecutor)
    || effectiveViewerExecutionRole === 'ASSIGNER'
    || effectiveViewerExecutionRole === 'INITIAL_RECEIVER';
  const analysisHoursNumberForPathSelection = parseHoursEstimatedNumber(
    findRawFormValueByTokens(
      formValues,
      ['analysis_hours_estimated'],
      ANALYSIS_HOURS_FIELD_TOKENS
    )
  );
  const canEnableAnalysisPathSelection =
    shouldRenderAnalysisPhaseFields
    && analysisProgressForUi === 100
    && analysisHoursNumberForPathSelection !== null
    && analysisHoursNumberForPathSelection > 0;
  const shouldLockAnalysisPathSelection =
    isAnalysisSelectionFlow
    && !canEnableAnalysisPathSelection;
  const shouldShowAnalysisPathSelectors =
    shouldRenderAnalysisPhaseFields
    && (showLevel2 || showLevel3);
  const shouldHideAnalysisExecutionStatusSelector =
    shouldRenderAnalysisPhaseFields
    && showLevel3
    && isProgrammingOrDmsExecutionPath
    && isExecutorUnassigned;
  const shouldDisableAnalysisExecutionStatusSelector =
    shouldRenderAnalysisPhaseFields
    && showLevel3
    && isProgrammingOrDmsExecutionPath
    && !isExecutorUnassigned
    && isAssignerExecutionView;
  const showWorkflowLevel1Selector = true;
  const showWorkflowLevel2Selector = showLevel2;
  const showWorkflowLevel3Selector = showLevel3;
  const currentEditingStatusCatalogId = formMode === 'edit' && editingRow?.status_catalog_id !== null && editingRow?.status_catalog_id !== undefined
    ? String(editingRow.status_catalog_id)
    : '';

  useEffect(() => {
    if (!shouldHideAnalysisExecutionStatusSelector) {
      return;
    }

    if (selectedLevel3 === '') {
      return;
    }

    setSelectedLevel3('');
  }, [selectedLevel3, shouldHideAnalysisExecutionStatusSelector]);

  const selectedLeafStatusId = useMemo(() => {
    if (selectedLevel3) {
      return selectedLevel3;
    }

    if (selectedLevel2) {
      const node = statusById.get(String(selectedLevel2));
      if (
        node?.is_leaf
        || node?.allow_pending_selection
        || (isProgrammingOrDmsExecutionPath && selectedLevel3 === '')
      ) {
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
  }, [isProgrammingOrDmsExecutionPath, selectedLevel1, selectedLevel2, selectedLevel3, statusById]);
  const hasPersistedAnalysisPathSelection =
    formMode === 'edit'
    && currentEditingStatusCatalogId !== ''
    && selectedLeafStatusId === currentEditingStatusCatalogId;
  const shouldPreserveHydratedAnalysisPathSelection =
    hasPersistedAnalysisPathSelection
    && preservedAnalysisPathStatusIdRef.current !== ''
    && preservedAnalysisPathStatusIdRef.current === currentEditingStatusCatalogId;

  useEffect(() => {
    if (!shouldRenderAnalysisPhaseFields) {
      preservedAnalysisPathStatusIdRef.current = '';
      return;
    }

    if (canEnableAnalysisPathSelection) {
      preservedAnalysisPathStatusIdRef.current = '';
      return;
    }

    if (selectedLevel2 === '' && selectedLevel3 === '') {
      preservedAnalysisPathStatusIdRef.current = '';
      return;
    }

    // Preserve the persisted execution path once when opening edit mode so the
    // form reflects the saved workflow state before applying live edit rules.
    if (shouldPreserveHydratedAnalysisPathSelection) {
      preservedAnalysisPathStatusIdRef.current = '';
      return;
    }

    setSelectedLevel2('');
    setSelectedLevel3('');
  }, [
    analysisHoursNumberForPathSelection,
    analysisProgressForUi,
    canEnableAnalysisPathSelection,
    selectedLevel2,
    selectedLevel3,
    shouldPreserveHydratedAnalysisPathSelection,
    shouldRenderAnalysisPhaseFields,
  ]);

  const editingRowHasConfiguredTransitions =
    formMode === 'edit'
    && Boolean(editingRow?.has_configured_transitions);
  const editingRowAvailableActions = useMemo(
    () => (Array.isArray(editingRow?.available_actions) ? editingRow.available_actions : []),
    [editingRow]
  );
  const editingRowAvailableActionTargetIds = useMemo(
    () => new Set(
      editingRowAvailableActions
        .map((action) => normalizeText(action?.to_status_catalog_id))
        .filter((value) => value !== '')
    ),
    [editingRowAvailableActions]
  );
  const editingRowAvailableActionNames = useMemo(
    () => Array.from(new Set(
      editingRowAvailableActions
        .map((action) => normalizeText(action?.action_name))
        .filter((value) => value !== '')
    )),
    [editingRowAvailableActions]
  );
  const isWorkflowTargetSelectable = (candidateValues: Array<string | number | null | undefined>): boolean => {
    if (!editingRowHasConfiguredTransitions) {
      return true;
    }

    return candidateValues.some((candidate) => {
      const normalizedCandidate = normalizeText(candidate);
      if (normalizedCandidate === '') {
        return false;
      }

      return normalizedCandidate === currentEditingStatusCatalogId
        || editingRowAvailableActionTargetIds.has(normalizedCandidate);
    });
  };
  const level2Options = useMemo(
    () => baseLevel2Options.map((option) => {
      const optionValue = normalizeText(option.value);
      if (optionValue === '' || !editingRowHasConfiguredTransitions) {
        return option;
      }

      const childIds = (childrenByParent.get(optionValue) || []).map((child) => String(child.id));
      return {
        ...option,
        disabled: !isWorkflowTargetSelectable([optionValue, ...childIds]),
      };
    }),
    [
      baseLevel2Options,
      childrenByParent,
      currentEditingStatusCatalogId,
      editingRowAvailableActionTargetIds,
      editingRowHasConfiguredTransitions,
      isWorkflowTargetSelectable,
    ]
  );
  const level3Options = useMemo(
    () => baseLevel3Options.map((option) => {
      const optionValue = normalizeText(option.value);
      if (optionValue === '' || !editingRowHasConfiguredTransitions) {
        return option;
      }

      return {
        ...option,
        disabled: !isWorkflowTargetSelectable([optionValue]),
      };
    }),
    [
      baseLevel3Options,
      currentEditingStatusCatalogId,
      editingRowAvailableActionTargetIds,
      editingRowHasConfiguredTransitions,
      isWorkflowTargetSelectable,
    ]
  );
  const isSelectedLeafTransitionAllowed =
    selectedLeafStatusId !== ''
    && isWorkflowTargetSelectable([selectedLeafStatusId]);

  const selectedLeafStatusNode = useMemo(
    () => (selectedLeafStatusId ? statusById.get(String(selectedLeafStatusId)) || null : null),
    [selectedLeafStatusId, statusById]
  );
  const selectedSupportGroupId = normalizeText(formValues.service_group_id);
  const selectedSupportGroup = useMemo(
    () => (selectedSupportGroupId !== '' ? supportGroupById.get(selectedSupportGroupId) || null : null),
    [selectedSupportGroupId, supportGroupById]
  );
  const serviceGroupWorkflowFormKey = useMemo(() => {
    const selectedGroupFormKey = normalizeText(
      selectedSupportGroup?.workflow_form_key || selectedSupportGroup?.workflow_status_form_key || ''
    );
    if (selectedGroupFormKey !== '') {
      return selectedGroupFormKey;
    }

    if (
      formMode === 'edit'
      && editingRow
      && normalizeText(editingRow.service_group_id) !== ''
      && normalizeText(editingRow.service_group_id) === selectedSupportGroupId
    ) {
      return normalizeText(editingRow.service_group_workflow_form_key || '');
    }

    return '';
  }, [editingRow, formMode, selectedSupportGroup, selectedSupportGroupId]);
  const effectiveWorkflowFormKey = useMemo(
    () => serviceGroupWorkflowFormKey || normalizeText(selectedLeafStatusNode?.form_key || editingRow?.form_key || ''),
    [editingRow?.form_key, selectedLeafStatusNode?.form_key, serviceGroupWorkflowFormKey]
  );
  const activeFieldConfigSourceStatusId = useMemo(() => {
    if (!selectedLeafStatusNode || selectedLeafStatusId === '') {
      return '';
    }

    if (effectiveWorkflowFormKey === '') {
      return selectedLeafStatusId;
    }

    const selectedCanonicalStatus = normalizeText(
      selectedLeafStatusNode.canonical_status || selectedLeafStatusNode.status_code || ''
    );
    const selectedCanonicalSubStatus = normalizeText(selectedLeafStatusNode.canonical_sub_status || '');
    const selectedStatusCode = normalizeText(selectedLeafStatusNode.status_code || '');
    const selectedLevel = Number(selectedLeafStatusNode.level || 0);

    const matchingCatalog = catalogs.find((item) => {
      if (normalizeText(item.form_key || '') !== effectiveWorkflowFormKey) {
        return false;
      }

      const itemCanonicalStatus = normalizeText(item.canonical_status || item.status_code || '');
      const itemCanonicalSubStatus = normalizeText(item.canonical_sub_status || '');
      const itemStatusCode = normalizeText(item.status_code || '');
      const itemLevel = Number(item.level || 0);

      return (
        itemLevel === selectedLevel
        && itemCanonicalStatus === selectedCanonicalStatus
        && itemCanonicalSubStatus === selectedCanonicalSubStatus
      ) || (
        itemLevel === selectedLevel
        && selectedCanonicalSubStatus === ''
        && itemCanonicalSubStatus === ''
        && itemStatusCode === selectedStatusCode
      );
    });

    return matchingCatalog ? String(matchingCatalog.id) : selectedLeafStatusId;
  }, [catalogs, effectiveWorkflowFormKey, selectedLeafStatusId, selectedLeafStatusNode]);
  const activeFieldConfigs = useMemo(() => {
    if (!activeFieldConfigSourceStatusId) {
      return [];
    }

    return fieldConfigs
      .filter((item) => String(item.status_catalog_id) === String(activeFieldConfigSourceStatusId) && item.is_active !== false)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  }, [activeFieldConfigSourceStatusId, fieldConfigs]);
  const configuredTransitionGuardMessage = useMemo(() => {
    if (!editingRowHasConfiguredTransitions || selectedLeafStatusId === '' || isSelectedLeafTransitionAllowed) {
      return '';
    }

    const targetStatusLabel = toFriendlyStatusLabel(
      selectedLeafStatusNode?.status_name
      || selectedLeafStatusNode?.canonical_sub_status
      || selectedLeafStatusNode?.canonical_status
      || selectedLeafStatusNode?.status_code
      || ''
    ) || 'trạng thái đã chọn';

    if (editingRowAvailableActionNames.length === 0) {
      return 'Bạn không có quyền chuyển trạng thái ở bước hiện tại.';
    }

    return `Không thể chuyển trạng thái sang "${targetStatusLabel}". Thao tác hợp lệ hiện tại: ${editingRowAvailableActionNames.join(', ')}.`;
  }, [
    editingRowAvailableActionNames,
    editingRowHasConfiguredTransitions,
    isSelectedLeafTransitionAllowed,
    selectedLeafStatusId,
    selectedLeafStatusNode,
  ]);

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

  const shouldRenderRemainingDynamicWorkflowFields =
    !isProgrammingPausedLeafStatus &&
    !isProgrammingDmsCreateTaskLeafStatus &&
    !isProgrammingDmsPausedLeafStatus &&
    !isProgrammingDmsCompletedLeafStatus;

  const dynamicWorkflowFields = useMemo(
    () =>
      activeFieldConfigs
        .filter((field) => !isStaticOrDuplicatedWorkflowField(field))
        .filter((field) => {
          if (!isAnalysisSelectionFlow) {
            return true;
          }

          const keyToken = normalizeFieldToken(field.field_key || '');
          const labelToken = normalizeFieldToken(field.field_label || '');
          return !ANALYSIS_HIDDEN_LEGACY_FIELD_TOKENS.some(
            (token) => keyToken.includes(token) || labelToken.includes(token)
          );
        })
        .filter((field) => {
          if (!isProcessingLeafStatus) {
            return true;
          }

          const semanticKey = resolveWorkflowSemanticFieldKey(field);
          return ![
            'exchange_date',
            'exchange_content',
            'customer_feedback_date',
            'customer_feedback_content',
          ].includes(semanticKey);
        })
        .map((field) => ({
          field,
          key: String(field.field_key || ''),
          keyToken: normalizeFieldToken(field.field_key || ''),
          labelToken: normalizeFieldToken(field.field_label || ''),
          semanticKey: resolveWorkflowSemanticFieldKey(field),
        })),
    [activeFieldConfigs, isAnalysisSelectionFlow, isProcessingLeafStatus]
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

  const processingHoursField = useMemo(
    () => findDynamicFieldByToken(PROCESSING_HOURS_FIELD_TOKENS),
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

  const analysisProgressField = useMemo(
    () => findDynamicFieldByToken(ANALYSIS_PROGRESS_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const analysisHoursField = useMemo(
    () => findDynamicFieldByToken(ANALYSIS_HOURS_FIELD_TOKENS),
    [dynamicWorkflowFields]
  );

  const analysisCompletionDateField = useMemo(
    () => findDynamicFieldByToken(ANALYSIS_COMPLETION_DATE_FIELD_TOKENS),
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

    if (isProcessingLeafStatus) {
      append(programmingProgressField);
      append(processingWorklogField);
      append(processingDateField);
      append(processingHoursField);
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

    if (isAnalysisSelectionFlow) {
      append(analysisProgressField);
      append(analysisHoursField);
      append(analysisCompletionDateField);
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
    isProcessingLeafStatus,
    isNotExecuteLeafStatus,
    isSupportCompletedLeafStatus,
    isNotifyCustomerLeafStatus,
    isReturnToManagerLeafStatus,
    isProgrammingInProgressLeafStatus,
    isAnalysisSelectionFlow,
    isProgrammingDmsExchangeLeafStatus,
    isProgrammingDmsCreateTaskLeafStatus,
    isProgrammingDmsPausedLeafStatus,
    isProgrammingDmsCompletedLeafStatus,
    isProgrammingPausedLeafStatus,
    isProgrammingUpcodeLeafStatus,
    isProgrammingCompletedLeafStatus,
    processingWorklogField,
    processingDateField,
    processingHoursField,
    plannedCompletionDateField,
    actualCompletionDateField,
    customerNotifyDateField,
    customerNotifyUserField,
    returnToManagerDateField,
    returnToManagerContentField,
    notExecuteReasonField,
    analysisProgressField,
    analysisHoursField,
    analysisCompletionDateField,
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
        .filter((field) => !WAITING_CUSTOMER_FEEDBACK_SEMANTIC_FIELD_KEYS.has(resolveWorkflowSemanticFieldKey(field)))
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
  const processingHoursFieldKey = String(processingHoursField?.field_key || '').trim() || 'processing_hours_estimated';
  const inProgressProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'progress';
  const dmsProgressFieldKey = String(programmingProgressField?.field_key || '').trim() || 'dms_progress';
  const exchangeDateFieldKey = String(exchangeDateField?.field_key || '').trim() || 'exchange_date';
  const exchangeContentFieldKey = String(exchangeContentField?.field_key || '').trim() || 'exchange_content';
  const customerFeedbackDateFieldKey = String(customerFeedbackDateField?.field_key || '').trim() || 'customer_feedback_date';
  const customerFeedbackContentFieldKey = String(customerFeedbackContentField?.field_key || '').trim() || 'customer_feedback_content';
  const analysisProgressFieldKey = String(analysisProgressField?.field_key || '').trim() || 'analysis_progress';
  const analysisHoursFieldKey = String(analysisHoursField?.field_key || '').trim() || 'analysis_hours_estimated';
  const analysisCompletionDateFieldKey = String(analysisCompletionDateField?.field_key || '').trim() || 'analysis_completion_date';
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

  const analysisProgressValue = resolveProgressInputValue(
    formValues,
    analysisProgressFieldKey,
    'analysis_progress'
  );
  const analysisHoursValue = findRawFormValueByTokens(
    formValues,
    [analysisHoursFieldKey, 'analysis_hours_estimated'],
    ANALYSIS_HOURS_FIELD_TOKENS
  );
  const analysisCompletionDateValue = normalizeDateValueForDateInput(
    findFormValueByTokens(
      formValues,
      [analysisCompletionDateFieldKey, 'analysis_completion_date'],
      ANALYSIS_COMPLETION_DATE_FIELD_TOKENS
    )
  );

  const processingProgressValue = useMemo(
    () => resolveProgressInputValue(formValues, processingProgressFieldKey, 'processing_progress'),
    [formValues, processingProgressFieldKey]
  );
  const processingHoursValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        [processingHoursFieldKey, 'processing_hours_estimated'],
        PROCESSING_HOURS_FIELD_TOKENS
      ),
    [formValues, processingHoursFieldKey]
  );
  const assignedDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          ['assigned_date'],
          ['assigneddate', 'ngaygiaoviec']
        )
      ),
    [formValues]
  );
  const waitingCustomerExchangeDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [exchangeDateFieldKey, 'exchange_date'],
          WORKFLOW_SEMANTIC_FIELD_TOKENS.exchange_date
        )
      ),
    [formValues, exchangeDateFieldKey]
  );
  const waitingCustomerExchangeContentValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        [exchangeContentFieldKey, 'exchange_content'],
        WORKFLOW_SEMANTIC_FIELD_TOKENS.exchange_content
      ),
    [formValues, exchangeContentFieldKey]
  );
  const waitingCustomerFeedbackDateValue = useMemo(
    () =>
      normalizeDateValueForDateInput(
        findFormValueByTokens(
          formValues,
          [customerFeedbackDateFieldKey, 'customer_feedback_date'],
          WORKFLOW_SEMANTIC_FIELD_TOKENS.customer_feedback_date
        )
      ),
    [formValues, customerFeedbackDateFieldKey]
  );
  const waitingCustomerFeedbackContentValue = useMemo(
    () =>
      findRawFormValueByTokens(
        formValues,
        [customerFeedbackContentFieldKey, 'customer_feedback_content'],
        WORKFLOW_SEMANTIC_FIELD_TOKENS.customer_feedback_content
      ),
    [formValues, customerFeedbackContentFieldKey]
  );
  const hasWaitingCustomerFeedbackReferenceData = useMemo(
    () => [
      assignedDateValue,
      waitingCustomerExchangeDateValue,
      waitingCustomerExchangeContentValue,
      waitingCustomerFeedbackDateValue,
      waitingCustomerFeedbackContentValue,
    ].some((value) => normalizeText(value) !== ''),
    [
      assignedDateValue,
      waitingCustomerExchangeDateValue,
      waitingCustomerExchangeContentValue,
      waitingCustomerFeedbackDateValue,
      waitingCustomerFeedbackContentValue,
    ]
  );
  const isSameWaitingCustomerFeedbackActor = useMemo(() => {
    const normalizedReceiverId = normalizeText(formValues.receiver_user_id);
    const normalizedAssigneeId = normalizeText(formValues.assignee_id);

    return normalizedReceiverId !== '' && normalizedReceiverId === normalizedAssigneeId;
  }, [formValues.assignee_id, formValues.receiver_user_id]);

  useEffect(() => {
    if (!isWaitingCustomerFeedbackStatus || !isSameWaitingCustomerFeedbackActor) {
      setExchangeContentInlineError('');
      return;
    }

    if (normalizeText(waitingCustomerExchangeContentValue) !== '') {
      setExchangeContentInlineError('');
    }
  }, [isSameWaitingCustomerFeedbackActor, isWaitingCustomerFeedbackStatus, waitingCustomerExchangeContentValue]);

  useEffect(() => {
    if (!isWaitingCustomerFeedbackStatus || !isSameWaitingCustomerFeedbackActor) {
      setCustomerFeedbackContentInlineError('');
      return;
    }

    if (
      normalizeText(waitingCustomerFeedbackDateValue) === ''
      || normalizeText(waitingCustomerFeedbackContentValue) !== ''
    ) {
      setCustomerFeedbackContentInlineError('');
    }
  }, [
    isSameWaitingCustomerFeedbackActor,
    isWaitingCustomerFeedbackStatus,
    waitingCustomerFeedbackDateValue,
    waitingCustomerFeedbackContentValue,
  ]);

  useEffect(() => {
    if (!isWaitingCustomerFeedbackStatus || assignedDateValue !== '') {
      return;
    }

    setFormValues((prev) => {
      if (normalizeText(prev.assigned_date) !== '') {
        return prev;
      }

      return {
        ...prev,
        assigned_date: toLocalDateInputValue(),
      };
    });
  }, [assignedDateValue, isWaitingCustomerFeedbackStatus]);

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
    if (isProcessingLeafStatus) {
      return '';
    }

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
      : 'Ngày trao đổi với khách hàng phải nhỏ hơn hoặc bằng Ngày khách hàng phản hồi.';
  }, [activeFieldConfigs, formValues, isProcessingLeafStatus]);

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

  const dashboardTopActions = useMemo(
    () => (dashboardSummary?.summary.by_action || []).slice(0, 4),
    [dashboardSummary]
  );

  const dashboardTopServiceGroups = useMemo(
    () => (dashboardSummary?.summary.by_service_group || []).slice(0, 4),
    [dashboardSummary]
  );

  const dashboardTopTargetStatuses = useMemo(
    () => (dashboardSummary?.summary.by_target_status || []).slice(0, 4),
    [dashboardSummary]
  );

  const dashboardAudience = useMemo(
    () => (isAdminViewer
      ? {
          badge: 'Admin',
          icon: 'admin_panel_settings',
          title: 'Toàn hệ thống',
          description: 'Ưu tiên theo dõi nhóm hỗ trợ, trạng thái đích và tín hiệu vận hành toàn cục.',
        }
      : {
          badge: 'PM',
          icon: 'assignment_ind',
          title: 'Điều phối',
          description: 'Tập trung vào action, SLA và notification để giao việc và gỡ tắc nhanh.',
        }),
    [isAdminViewer]
  );

  const dashboardSlaSegments = useMemo(
    () => buildDashboardStackSegments([
      {
        key: 'breached',
        label: 'Quá hạn',
        value: dashboardSummary?.summary.sla.breached_count || 0,
        className: 'bg-rose-500',
      },
      {
        key: 'on_time',
        label: 'Đúng hạn',
        value: dashboardSummary?.summary.sla.on_time_count || 0,
        className: 'bg-emerald-500',
      },
    ]),
    [dashboardSummary]
  );

  const dashboardNotificationSegments = useMemo(
    () => buildDashboardStackSegments([
      {
        key: 'resolved',
        label: 'Resolved',
        value: dashboardSummary?.summary.notifications.resolved_count || 0,
        className: 'bg-sky-500',
      },
      {
        key: 'skipped',
        label: 'Skipped',
        value: dashboardSummary?.summary.notifications.skipped_count || 0,
        className: 'bg-amber-500',
      },
    ]),
    [dashboardSummary]
  );

  const dashboardDrilldownChips = useMemo(() => {
    return buildDashboardDrilldownChips(dashboardDrilldown);
  }, [dashboardDrilldown]);

  const dashboardHistoryChips = useMemo(() => {
    return buildDashboardDrilldownChips(historyDashboardDrilldown, dashboardDateFrom, dashboardDateTo);
  }, [historyDashboardDrilldown, dashboardDateFrom, dashboardDateTo]);

  const handleDashboardExport = async () => {
    if (!canExportRequests) {
      return;
    }

    setIsDashboardExporting(true);
    try {
      const result = await exportCustomerRequestDashboardSummaryCsv({
        q: searchText || undefined,
        filters: buildCustomerRequestDashboardFilters(statusFilter, dashboardDateFrom, dashboardDateTo),
      });
      triggerDownload(result.blob, result.filename);
      notify('success', 'Xuất báo cáo workflow', 'Đã tạo file xuất tổng hợp workflow.');
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể xuất báo cáo workflow.';
      notify('error', 'Xuất báo cáo thất bại', message);
    } finally {
      setIsDashboardExporting(false);
    }
  };

  const applyDashboardDrilldown = (next: Partial<DashboardDrilldownState> | null) => {
    setDashboardDrilldown((current) => mergeDashboardDrilldownState(current, next));
    setCurrentPage(1);
  };

  const clearDashboardDrilldownKey = (key: 'workflow_action_code' | 'service_group_id' | 'to_status_catalog_id') => {
    setDashboardDrilldown((current) => {
      if (!current) {
        return null;
      }

      const next: DashboardDrilldownState = { ...current };
      if (key === 'workflow_action_code') {
        delete next.workflow_action_code;
        delete next.workflow_action_label;
      } else if (key === 'service_group_id') {
        delete next.service_group_id;
        delete next.service_group_label;
      } else {
        delete next.to_status_catalog_id;
        delete next.to_status_catalog_label;
      }

      return hasDashboardDrilldownFilters(next) ? next : null;
    });
    setCurrentPage(1);
  };

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
          bodyTextDisplay: buildHistoryBodyText({
            entry,
            taskCodeDisplay: taskCode || '--',
          }),
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

  const hasAvailableProjectItemOptions = projectItemOptions.some((item) => String(item.value) !== '');
  const isProjectItemMissing = Boolean(formMode) && normalizeText(formValues.project_item_id) === '';
  const shouldShowProjectItemFieldError =
    isProjectItemMissing && (didAttemptSaveWithoutProjectItem || attemptedReceiverBeforeProjectItem || attemptedAssigneeBeforeProjectItem);
  const projectItemFieldError = shouldShowProjectItemFieldError ? 'Vui lòng chọn phần mềm triển khai.' : undefined;
  const receiverFieldError = isProjectItemMissing && (didAttemptSaveWithoutProjectItem || attemptedReceiverBeforeProjectItem)
    ? 'Chọn phần mềm triển khai trước khi chọn người giao việc [A].'
    : undefined;
  const assigneeFieldError = isProjectItemMissing && (didAttemptSaveWithoutProjectItem || attemptedAssigneeBeforeProjectItem)
    ? 'Chọn phần mềm triển khai trước khi chọn người xử lý.'
    : undefined;
  const isReceiverSelectionDisabled = isProjectItemMissing || isReceiverLoading;
  const isAssigneeSelectionDisabled = isProjectItemMissing;
  const projectItemEmptyStateMessage = isProjectItemsLoading
    ? 'Đang tải danh sách phần mềm triển khai...'
    : 'Bạn chưa được phân công RACI ở dự án nào có hạng mục khả dụng.';

  const resolveActorDisplayLabel = (actorId: unknown): string => {
    const normalizedActorId = normalizeText(actorId);
    if (normalizedActorId === '') {
      return 'Hệ thống';
    }
    return employeeLabelById.get(normalizedActorId) || `#${normalizedActorId}`;
  };

  const metadataCreatedByLabel = formMode === 'create'
    ? '--'
    : resolveActorDisplayLabel(editingRow?.created_by);

  const metadataCreatedAtValue = formMode === 'create'
    ? ''
    : normalizeText(editingRow?.created_at);

  const metadataUpdatedByLabel = formMode === 'create'
    ? '--'
    : (() => {
        const normalizedActorId = normalizeText(editingRow?.updated_by);
        if (normalizedActorId === '') {
          return '--';
        }
        return resolveActorDisplayLabel(normalizedActorId);
      })();

  const metadataUpdatedAtValue = formMode === 'create'
    ? ''
    : normalizeText(editingRow?.updated_at);

  const resolveInitialProcessingActorTab = (row: CustomerRequest | null): ProcessingActorTab => {
    if (!row) {
      return 'CREATOR';
    }

    const normalizedStatus = normalizeStatusCodeKey(row.status || '');
    const normalizedSubStatus = normalizeStatusCodeKey(row.sub_status || '');

    if (normalizedStatus === 'DOI_PHAN_HOI_KH' && normalizedSubStatus === '') {
      return 'ASSIGNER';
    }

    if (normalizeText(row.assignee_id) !== '') {
      return 'WORKER';
    }

    if (
      normalizedSubStatus !== ''
      || (
        normalizedStatus !== ''
        && normalizedStatus !== 'MOI_TIEP_NHAN'
        && normalizedStatus !== 'PHAN_TICH'
      )
    ) {
      return 'WORKER';
    }

    if (normalizeText(row.receiver_user_id) !== '') {
      return 'ASSIGNER';
    }

    return 'CREATOR';
  };

  const resolveProcessingActorTabFromStatusNode = (
    node: WorkflowStatusCatalog | null | undefined,
    fallback: ProcessingActorTab = 'ASSIGNER',
  ): ProcessingActorTab => {
    if (!node) {
      return fallback;
    }

    const flowStepToken = normalizeToken(node.flow_step || '');
    if (flowStepToken === 'gd1') {
      return 'CREATOR';
    }
    if (flowStepToken === 'gd2') {
      return 'ASSIGNER';
    }
    if (flowStepToken === 'gd3' || flowStepToken === 'gd4') {
      return 'WORKER';
    }

    const nodeTokens = new Set<string>(
      [
        normalizeToken(node.status_code || ''),
        normalizeToken(node.canonical_status || ''),
        normalizeToken(node.canonical_sub_status || ''),
        normalizeFieldToken(node.status_name || ''),
        normalizeFieldToken(node.status_code || ''),
        normalizeFieldToken(node.canonical_status || ''),
        normalizeFieldToken(node.canonical_sub_status || ''),
      ].filter((token) => token !== '')
    );

    if (
      nodeTokens.has('moi_tiep_nhan')
      || nodeTokens.has('moitiepnhan')
    ) {
      return 'CREATOR';
    }

    if (
      nodeTokens.has('doi_phan_hoi_kh')
      || nodeTokens.has('doiphanhoikh')
      || nodeTokens.has('doiphanhoitukhachhang')
    ) {
      return 'ASSIGNER';
    }

    if (
      nodeTokens.has('dang_xu_ly')
      || nodeTokens.has('dangxuly')
      || nodeTokens.has('khong_thuc_hien')
      || nodeTokens.has('khongthuchien')
      || nodeTokens.has('hoan_thanh')
      || nodeTokens.has('hoanthanh')
      || nodeTokens.has('bao_khach_hang')
      || nodeTokens.has('baokhachhang')
      || nodeTokens.has('chuyen_tra_ql')
      || nodeTokens.has('chuyentraql')
      || nodeTokens.has('lap_trinh')
      || nodeTokens.has('laptrinh')
      || nodeTokens.has('chuyen_dms')
      || nodeTokens.has('chuyendms')
      || nodeTokens.has('upcode')
      || nodeTokens.has('tam_ngung')
      || nodeTokens.has('tamngung')
    ) {
      return 'WORKER';
    }

    return fallback;
  };

  const analysisHoursLabel = isProgrammingSelectionPlaceholderFlow
    ? 'Số giờ dự kiến lập trình'
    : 'Số giờ dự kiến thực hiện';
  const analysisHoursRequiredMessage = `${analysisHoursLabel} là bắt buộc.`;
  const analysisHoursInvalidMessage = `${analysisHoursLabel} phải là số không âm, tối đa 2 chữ số thập phân.`;
  const analysisPathSelectionGuardMessage =
    'Chỉ được chọn Hướng xử lý khi Tiến độ phân tích = 100 và Số giờ dự kiến thực hiện lớn hơn 0.';

  const setWorkflowFieldValue = (dynamicFieldKey: string, canonicalFieldKey: string, value: string) => {
    if (canonicalFieldKey === 'exchange_content' || dynamicFieldKey === exchangeContentFieldKey) {
      setExchangeContentInlineError('');
    }
    if (canonicalFieldKey === 'customer_feedback_content' || dynamicFieldKey === customerFeedbackContentFieldKey) {
      setCustomerFeedbackContentInlineError('');
    }
    const normalizedDynamicFieldKey = String(dynamicFieldKey || '').trim();
    const normalizedCanonicalFieldKey = String(canonicalFieldKey || '').trim();
    const isAnalysisProgressField =
      normalizedCanonicalFieldKey === 'analysis_progress'
      || normalizedDynamicFieldKey === analysisProgressFieldKey;
    const isAnalysisHoursField =
      normalizedCanonicalFieldKey === 'analysis_hours_estimated'
      || normalizedDynamicFieldKey === analysisHoursFieldKey;
    const isProcessingHoursField =
      normalizedCanonicalFieldKey === 'processing_hours_estimated'
      || normalizedDynamicFieldKey === processingHoursFieldKey;
    if (
      normalizeText(value) !== ''
      && (
        ((isAnalysisProgressField || isAnalysisHoursField) && formError === analysisPathSelectionGuardMessage)
        ||
        (isAnalysisHoursField && (
          formError === analysisHoursRequiredMessage
          || formError === analysisHoursInvalidMessage
        ))
        || (isProcessingHoursField && (
          formError === 'Số giờ dự kiến xử lý là bắt buộc.'
          || formError === 'Số giờ dự kiến xử lý phải là số không âm, tối đa 2 chữ số thập phân.'
        ))
      )
    ) {
      setFormError('');
    }
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

  const handleWaitingCustomerFeedbackDateChange = (value: string) => {
    const nextValue = normalizeDateValueForDateInput(value);
    if (nextValue === '' && normalizeText(waitingCustomerFeedbackContentValue) !== '') {
      const confirmed = window.confirm(
        'Xóa Ngày khách hàng phản hồi sẽ xóa luôn Nội dung khách hàng phản hồi. Bạn có muốn tiếp tục?'
      );
      if (!confirmed) {
        return;
      }

      setCustomerFeedbackContentInlineError('');
      setFormValues((prev) => {
        const next = { ...prev };
        Array.from(
          new Set(
            [
              customerFeedbackDateFieldKey,
              'customer_feedback_date',
              customerFeedbackContentFieldKey,
              'customer_feedback_content',
            ].filter((key) => key !== '')
          )
        ).forEach((key) => {
          next[key] = '';
        });
        return next;
      });
      return;
    }

    setWorkflowFieldValue(customerFeedbackDateFieldKey, 'customer_feedback_date', nextValue);
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
        filters: buildCustomerRequestListFilters(status, dashboardDrilldown),
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

  const loadDashboardSummary = async (q: string, status: string, dateFrom: string, dateTo: string) => {
    const requestVersion = dashboardRequestVersionRef.current + 1;
    dashboardRequestVersionRef.current = requestVersion;
    setIsDashboardLoading(true);
    setDashboardError('');
    try {
      const payload = await fetchCustomerRequestDashboardSummary({
        q: q || undefined,
        filters: buildCustomerRequestDashboardFilters(status, dateFrom, dateTo),
      });
      if (dashboardRequestVersionRef.current !== requestVersion) {
        return;
      }

      setDashboardSummary(payload);
    } catch (error) {
      if (dashboardRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải báo cáo workflow.';
      setDashboardError(message);
    } finally {
      if (dashboardRequestVersionRef.current === requestVersion) {
        setIsDashboardLoading(false);
      }
    }
  };

  const loadHistoryRows = async (params?: {
    requestId?: string | number | null;
    scrollIntoView?: boolean;
    dashboardDrilldown?: DashboardDrilldownState | null;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const requestVersion = historyRequestVersionRef.current + 1;
    historyRequestVersionRef.current = requestVersion;
    setIsHistoryLoading(true);
    setHistoryError('');

    try {
      const payload = await fetchCustomerRequestHistories({
        request_id: params?.requestId ?? null,
        limit: 200,
        filters: buildCustomerRequestDashboardFilters('ALL', params?.dateFrom || '', params?.dateTo || '', params?.dashboardDrilldown),
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
  }, [canReadRequests, currentPage, searchText, statusFilter, dashboardDrilldown]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }
    void loadDashboardSummary(searchText, statusFilter, dashboardDateFrom, dashboardDateTo);
  }, [canReadRequests, searchText, statusFilter, dashboardDateFrom, dashboardDateTo]);

  useEffect(() => {
    if (historyViewMode !== 'dashboard' || !canReadRequests) {
      return;
    }

    void loadHistoryRows({
      requestId: null,
      dashboardDrilldown: historyDashboardDrilldown,
      dateFrom: dashboardDateFrom,
      dateTo: dashboardDateTo,
    });
  }, [historyViewMode, dashboardDateFrom, dashboardDateTo, canReadRequests]);

  useEffect(() => {
    if (!formMode) {
      setReceiverOptions(EMPTY_RECEIVER_OPTIONS);
    }
  }, [formMode]);

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

  const handleProjectItemChange = (value: string) => {
    const selected = projectItemMap.get(String(value || ''));
    setDidAttemptSaveWithoutProjectItem(false);
    setAttemptedReceiverBeforeProjectItem(false);
    setAttemptedAssigneeBeforeProjectItem(false);
    if (!selected) {
      supportGroupRequestVersionRef.current += 1;
      setAvailableSupportGroups([]);
      setIsSupportGroupsLoading(false);
      receiverRequestVersionRef.current += 1;
      receiverDefaultContextRef.current = '';
      setIsReceiverLoading(false);
      setReceiverOptions(EMPTY_RECEIVER_OPTIONS);
    }
    setFormValues((prev) => {
      const nextCustomerId = selected?.customer_id ? String(selected.customer_id) : '';
      const keepReporter = nextCustomerId !== '' && nextCustomerId === String(prev.customer_id || '');
      const keepSupportGroup = nextCustomerId !== '' && nextCustomerId === String(prev.customer_id || '');
      return {
        ...prev,
        project_item_id: value,
        customer_id: nextCustomerId,
        project_id: selected?.project_id ? String(selected.project_id) : '',
        product_id: selected?.product_id ? String(selected.product_id) : '',
        reporter_contact_id: keepReporter ? prev.reporter_contact_id : '',
        requester_name: keepReporter ? prev.requester_name : '',
        service_group_id: keepSupportGroup ? prev.service_group_id : '',
        receiver_user_id: selected ? prev.receiver_user_id : '',
        assignee_id: selected ? prev.assignee_id : '',
      };
    });
  };

  const addIt360TaskRow = () => {
    setFormIt360Tasks((prev) => [...prev, createEmptyIt360TaskRow()]);
  };

  const updateIt360TaskRow = (localId: string, field: keyof Omit<It360TaskFormRow, 'local_id'>, value: string) => {
    setFormIt360Tasks((prev) =>
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

  const removeIt360TaskRow = (localId: string) => {
    setFormIt360Tasks((prev) => {
      const next = prev.filter((row) => row.local_id !== localId);
      return next.length > 0 ? next : [createEmptyIt360TaskRow()];
    });
  };

  const addReferenceTaskRow = () => {
    setFormReferenceTasks((prev) => [...prev, createEmptyReferenceTaskRow()]);
  };

  const updateReferenceTaskRow = (localId: string, value: string) => {
    setFormReferenceTasks((prev) =>
      prev.map((row) =>
        row.local_id === localId
          ? {
              ...row,
              task_code: value,
            }
          : row
      )
    );
  };

  const removeReferenceTaskRow = (localId: string) => {
    setFormReferenceTasks((prev) => {
      const next = prev.filter((row) => row.local_id !== localId);
      return next.length > 0 ? next : [createEmptyReferenceTaskRow()];
    });
  };

  const addTaskRowByActiveTab = () => {
    if (activeTaskTab === 'IT360') {
      addIt360TaskRow();
      return;
    }
    addReferenceTaskRow();
  };

  const isRequestedDateVisible = Boolean(formMode);
  const effectiveSupportGroupCustomerId = String(formValues.customer_id || '').trim();
  const supportGroupEmptyStateMessage = effectiveSupportGroupCustomerId
    ? 'Không có nhóm Zalo/Tele nào thuộc khách hàng hiện tại.'
    : 'Chọn phần mềm triển khai để tải nhóm Zalo/Tele.';

  useEffect(() => {
    if (!formMode) {
      supportGroupRequestVersionRef.current += 1;
      setAvailableSupportGroups([]);
      setIsSupportGroupsLoading(false);
      return;
    }

    if (!effectiveSupportGroupCustomerId) {
      supportGroupRequestVersionRef.current += 1;
      setAvailableSupportGroups([]);
      setIsSupportGroupsLoading(false);
      setFormValues((prev) => (prev.service_group_id ? { ...prev, service_group_id: '' } : prev));
      return;
    }

    const requestVersion = supportGroupRequestVersionRef.current + 1;
    supportGroupRequestVersionRef.current = requestVersion;
    setIsSupportGroupsLoading(true);

    void fetchAvailableSupportServiceGroups({
      customer_id: effectiveSupportGroupCustomerId,
      include_group_id:
        formMode === 'edit' && editingRow && String(editingRow.service_group_id || '') === String(formValues.service_group_id || '')
          ? formValues.service_group_id || null
          : null,
    })
      .then((rows) => {
        if (supportGroupRequestVersionRef.current !== requestVersion) {
          return;
        }

        const nextRows = Array.isArray(rows) ? rows : [];
        setAvailableSupportGroups(nextRows);
        const allowedIds = new Set(nextRows.map((item) => String(item.id)));
        setFormValues((prev) => {
          const currentGroupId = String(prev.service_group_id || '').trim();
          if (!currentGroupId || allowedIds.has(currentGroupId)) {
            return prev;
          }
          return { ...prev, service_group_id: '' };
        });
      })
      .catch(() => {
        if (supportGroupRequestVersionRef.current !== requestVersion) {
          return;
        }
        setAvailableSupportGroups([]);
      })
      .finally(() => {
        if (supportGroupRequestVersionRef.current === requestVersion) {
          setIsSupportGroupsLoading(false);
        }
      });
  }, [formMode, editingRow, effectiveSupportGroupCustomerId, formValues.service_group_id]);

  const visibleRenderedWorkflowDateFields = useMemo(() => {
    const map = new Map<
      string,
      {
        field: WorkflowFormFieldConfig;
        format: 'iso' | 'vn';
      }
    >();

    const append = (field: WorkflowFormFieldConfig | null) => {
      if (!field) {
        return;
      }

      const key = String(field.field_key || '').trim();
      if (key === '') {
        return;
      }

      const effectiveFieldType = resolveWorkflowFieldType(field);
      const format = shouldUseVnDateAutofill(field) ? 'vn' : 'iso';
      if (effectiveFieldType !== 'date' && format !== 'vn') {
        return;
      }

      map.set(key, { field, format });
    };

    if (isProcessingLeafStatus) {
      append(processingDateField);
      append(plannedCompletionDateField);
    }

    if (isNotExecuteLeafStatus) {
      append(processingDateField);
    }

    if (isSupportCompletedLeafStatus) {
      append(actualCompletionDateField);
    }

    if (isNotifyCustomerLeafStatus) {
      append(customerNotifyDateField);
    }

    if (isReturnToManagerLeafStatus) {
      append(returnToManagerDateField);
    }

    if (isProgrammingInProgressLeafStatus) {
      append(programmingFromDateField);
      append(programmingToDateField);
      append(programmingExtendedDateField);
    }

    if (isProgrammingCompletedLeafStatus) {
      append(programmingCompletionDateField);
    }

    if (shouldRenderRemainingDynamicWorkflowFields) {
      remainingDynamicWorkflowFields.forEach((field) => append(field));
    }

    return Array.from(map.values());
  }, [
    isProcessingLeafStatus,
    isSupportCompletedLeafStatus,
    isNotExecuteLeafStatus,
    isNotifyCustomerLeafStatus,
    isReturnToManagerLeafStatus,
    isProgrammingInProgressLeafStatus,
    isProgrammingCompletedLeafStatus,
    processingDateField,
    plannedCompletionDateField,
    actualCompletionDateField,
    customerNotifyDateField,
    returnToManagerDateField,
    programmingFromDateField,
    programmingToDateField,
    programmingExtendedDateField,
    programmingCompletionDateField,
    shouldRenderRemainingDynamicWorkflowFields,
    remainingDynamicWorkflowFields,
  ]);

  const visibleDateAutofillTargets = useMemo(() => {
    const map = new Map<
      string,
      {
        primaryKey: string;
        mirrorKeys: string[];
        format: 'iso' | 'vn';
      }
    >();

    const append = (primaryKey: string, options?: { mirrorKeys?: string[]; format?: 'iso' | 'vn' }) => {
      const trimmedPrimaryKey = String(primaryKey || '').trim();
      if (trimmedPrimaryKey === '') {
        return;
      }

      const normalizedMirrorKeys = Array.from(
        new Set(
          (options?.mirrorKeys || [])
            .map((key) => String(key || '').trim())
            .filter((key) => key !== '' && key !== trimmedPrimaryKey)
        )
      );

      const existing = map.get(trimmedPrimaryKey);
      if (existing) {
        existing.mirrorKeys = Array.from(new Set([...existing.mirrorKeys, ...normalizedMirrorKeys]));
        existing.format = options?.format || existing.format;
        return;
      }

      map.set(trimmedPrimaryKey, {
        primaryKey: trimmedPrimaryKey,
        mirrorKeys: normalizedMirrorKeys,
        format: options?.format || 'iso',
      });
    };

    if (isRequestedDateVisible) {
      append('requested_date');
    }

    visibleRenderedWorkflowDateFields.forEach(({ field, format }) => {
      append(String(field.field_key || '').trim(), { format });
    });

    if (isProcessingLeafStatus && !plannedCompletionDateField) {
      append('planned_completion_date');
    }

    if (isSupportCompletedLeafStatus && !actualCompletionDateField) {
      append('actual_completion_date');
    }

    if (isProgrammingDmsExchangeLeafStatus) {
      append(dmsExchangeDateFieldKey, { mirrorKeys: ['dms_exchange_date'] });
      append(dmsFeedbackDateFieldKey, { mirrorKeys: ['dms_feedback_date'] });
    }

    if (isProgrammingDmsCreateTaskLeafStatus) {
      append(createTaskDateFieldKey, { mirrorKeys: ['create_task_date'] });
    }

    if (isProgrammingPausedLeafStatus || isProgrammingDmsPausedLeafStatus) {
      append(pauseDateFieldKey, { mirrorKeys: ['pause_date'] });
    }

    if (isProgrammingUpcodeLeafStatus) {
      append(upcodeDateFieldKey, { mirrorKeys: ['upcode_date'] });
      append(completionDateFieldKey, { mirrorKeys: ['completion_date'] });
    }

    if (isProgrammingDmsCompletedLeafStatus) {
      append(completionDateFieldKey, { mirrorKeys: ['completion_date'] });
    }

    if (isProgrammingCompletedLeafStatus && !programmingCompletionDateField) {
      append('completion_date');
    }

    if (shouldRenderAnalysisPhaseFields) {
      append(analysisCompletionDateFieldKey, { mirrorKeys: ['analysis_completion_date'] });
    }

    return Array.from(map.values());
  }, [
    isRequestedDateVisible,
    visibleRenderedWorkflowDateFields,
    isProcessingLeafStatus,
    plannedCompletionDateField,
    isSupportCompletedLeafStatus,
    actualCompletionDateField,
    isProgrammingDmsExchangeLeafStatus,
    dmsExchangeDateFieldKey,
    dmsFeedbackDateFieldKey,
    isProgrammingDmsCreateTaskLeafStatus,
    createTaskDateFieldKey,
    isProgrammingPausedLeafStatus,
    isProgrammingDmsPausedLeafStatus,
    pauseDateFieldKey,
    isProgrammingUpcodeLeafStatus,
    upcodeDateFieldKey,
    completionDateFieldKey,
    isProgrammingDmsCompletedLeafStatus,
    isProgrammingCompletedLeafStatus,
    programmingCompletionDateField,
    shouldRenderAnalysisPhaseFields,
    analysisCompletionDateFieldKey,
  ]);

  const hasRemainingDynamicWorkflowFields =
    shouldRenderRemainingDynamicWorkflowFields && remainingDynamicWorkflowFields.length > 0;

  const hasDefaultWorkflowGridContent = useMemo(() => {
    if (showWorkflowLevel2Selector || showWorkflowLevel3Selector) {
      return true;
    }

    if (
      isProgrammingDmsExchangeLeafStatus ||
      isProgrammingDmsCreateTaskLeafStatus ||
      isProgrammingDmsPausedLeafStatus ||
      isProgrammingDmsCompletedLeafStatus ||
      isProgrammingUpcodeLeafStatus ||
      isProgrammingPausedLeafStatus ||
      isProgrammingCompletedLeafStatus ||
      isProcessingLeafStatus ||
      isSupportCompletedLeafStatus
    ) {
      return true;
    }

    if (isNotExecuteLeafStatus && Boolean(notExecuteReasonField || processingDateField)) {
      return true;
    }

    if (isNotifyCustomerLeafStatus && Boolean(customerNotifyDateField || customerNotifyUserField)) {
      return true;
    }

    if (isReturnToManagerLeafStatus && Boolean(returnToManagerDateField || returnToManagerContentField)) {
      return true;
    }

    return (
      isProgrammingInProgressLeafStatus &&
      Boolean(
        programmingFromDateField ||
          programmingProgressField ||
          programmingToDateField ||
          programmingExtendedDateField ||
          programmingExecutorField ||
          programmingWorklogField
      )
    );
  }, [
    showWorkflowLevel2Selector,
    showWorkflowLevel3Selector,
    isProgrammingDmsExchangeLeafStatus,
    isProgrammingDmsCreateTaskLeafStatus,
    isProgrammingDmsPausedLeafStatus,
    isProgrammingDmsCompletedLeafStatus,
    isProgrammingUpcodeLeafStatus,
    isProgrammingPausedLeafStatus,
    isProgrammingCompletedLeafStatus,
    isProcessingLeafStatus,
    isSupportCompletedLeafStatus,
    isNotExecuteLeafStatus,
    processingDateField,
    notExecuteReasonField,
    isNotifyCustomerLeafStatus,
    customerNotifyDateField,
    customerNotifyUserField,
    isReturnToManagerLeafStatus,
    returnToManagerDateField,
    returnToManagerContentField,
    isProgrammingInProgressLeafStatus,
    programmingFromDateField,
    programmingProgressField,
    programmingToDateField,
    programmingExtendedDateField,
    programmingExecutorField,
    programmingWorklogField,
  ]);

  const shouldShowWorkflowSection = useMemo(() => {
    if (shouldRenderAnalysisPhaseFields) {
      return true;
    }

    if (hasDefaultWorkflowGridContent) {
      return true;
    }

    if (hasRemainingDynamicWorkflowFields) {
      return true;
    }

    return false;
  }, [
    shouldRenderAnalysisPhaseFields,
    hasDefaultWorkflowGridContent,
    hasRemainingDynamicWorkflowFields,
  ]);

  useEffect(() => {
    if (!formMode || visibleDateAutofillTargets.length === 0) {
      return;
    }

    const todayIso = toLocalDateInputValue();
    const todayVn = formatIsoDateToVn(todayIso);

    setFormValues((prev) => {
      let changed = false;
      const next = { ...prev };

      visibleDateAutofillTargets.forEach(({ primaryKey, mirrorKeys, format }) => {
        const relatedKeys = [primaryKey, ...mirrorKeys];
        const currentValue = relatedKeys
          .map((key) => normalizeText(prev[key]))
          .find((value) => value !== '') || '';

        if (format === 'vn') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
            const normalizedValue = formatIsoDateToVn(currentValue);
            relatedKeys.forEach((key) => {
              if (normalizeText(next[key]) !== normalizedValue) {
                next[key] = normalizedValue;
                changed = true;
              }
            });
            return;
          }

          if (currentValue !== '') {
            return;
          }

          relatedKeys.forEach((key) => {
            if (normalizeText(next[key]) !== todayVn) {
              next[key] = todayVn;
              changed = true;
            }
          });
          return;
        }

        if (currentValue !== '') {
          return;
        }

        relatedKeys.forEach((key) => {
          if (normalizeText(next[key]) !== todayIso) {
            next[key] = todayIso;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [formMode, visibleDateAutofillTargets]);

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
    if (!formMode) {
      projectItemRequestVersionRef.current += 1;
      setScopedProjectItems([]);
      setIsProjectItemsLoading(false);
      return;
    }

    const requestVersion = projectItemRequestVersionRef.current + 1;
    projectItemRequestVersionRef.current = requestVersion;
    setIsProjectItemsLoading(true);

    const includeProjectItemId = formMode === 'edit'
      ? parseMaybeInt(String(editingRow?.project_item_id ?? ''))
      : null;

    void (async () => {
      try {
        const rows = await fetchCustomerRequestProjectItems({
          include_project_item_id: includeProjectItemId,
        });
        if (projectItemRequestVersionRef.current !== requestVersion) {
          return;
        }
        setScopedProjectItems(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (projectItemRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
          return;
        }
        setScopedProjectItems([]);
        notify(
          'error',
          'Tải phần mềm triển khai thất bại',
          error instanceof Error ? error.message : 'Không thể tải danh sách phần mềm triển khai theo RACI dự án.'
        );
      } finally {
        if (projectItemRequestVersionRef.current === requestVersion) {
          setIsProjectItemsLoading(false);
        }
      }
    })();
  }, [editingRow?.project_item_id, formMode]);

  useEffect(() => {
    if (!formMode || formValues.project_item_id || !formValues.project_id || !formValues.product_id) {
      return;
    }

    const matched = availableProjectItems.find(
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
  }, [availableProjectItems, formMode, formValues.project_item_id, formValues.project_id, formValues.product_id]);

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
    if (!formMode) {
      return;
    }

    const projectId = String(formValues.project_id || '').trim();
    const projectItemId = String(formValues.project_item_id || '').trim();
    const receiverContextKey = `${projectId}:${projectItemId}`;
    if (!projectId || !projectItemId) {
      receiverRequestVersionRef.current += 1;
      receiverDefaultContextRef.current = '';
      setReceiverOptions(EMPTY_RECEIVER_OPTIONS);
      setIsReceiverLoading(false);
      setFormValues((prev) => {
        if (!prev.receiver_user_id && !prev.assignee_id) {
          return prev;
        }
        return { ...prev, receiver_user_id: '', assignee_id: '' };
      });
      return;
    }

    const requestVersion = receiverRequestVersionRef.current + 1;
    receiverRequestVersionRef.current = requestVersion;
    setIsReceiverLoading(true);

    void (async () => {
      try {
        const response = await fetchCustomerRequestReceivers({
          project_id: projectId || null,
          project_item_id: projectItemId || null,
        });

        if (receiverRequestVersionRef.current !== requestVersion) {
          return;
        }

        const raciOptions = [
          { value: '', label: 'Chọn người giao việc [A]' },
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

        const defaultReceiverId = String(
          response?.default_receiver_user_id
          || response?.options?.find((option) => option.is_default)?.user_id
          || response?.options?.find((option) => String(option.raci_role || '').trim().toUpperCase() === 'A')?.user_id
          || ''
        ).trim();
        const shouldForceProjectDefault = formMode === 'create' && receiverDefaultContextRef.current !== receiverContextKey;
        receiverDefaultContextRef.current = receiverContextKey;
        setFormValues((prev) => {
          const available = new Set(nextOptions.map((item) => item.value));
          let nextReceiver = prev.receiver_user_id;
          if (nextReceiver && !available.has(nextReceiver)) {
            nextReceiver = '';
          }
          if (
            defaultReceiverId
            && available.has(defaultReceiverId)
            && (!nextReceiver || shouldForceProjectDefault)
          ) {
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

  useEffect(() => {
    if (!formMode) {
      taskReferenceSearchRequestVersionRef.current += 1;
      setTaskReferenceSearchResults([]);
      setIsTaskReferenceSearchLoading(false);
      setTaskReferenceSearchError('');
      return;
    }

    if (activeTaskTab !== 'REFERENCE') {
      setIsTaskReferenceSearchLoading(false);
      return;
    }

    const requestVersion = taskReferenceSearchRequestVersionRef.current + 1;
    taskReferenceSearchRequestVersionRef.current = requestVersion;
    const handle = window.setTimeout(() => {
      setTaskReferenceSearchError('');
      setIsTaskReferenceSearchLoading(true);
      void (async () => {
        try {
          const items = await fetchCustomerRequestReferenceSearch({
            q: taskReferenceSearchTerm,
            exclude_id: formMode === 'edit' ? editingRow?.id ?? null : null,
            limit: 20,
          });
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setTaskReferenceSearchResults(Array.isArray(items) ? items : []);
          setTaskReferenceSearchError('');
        } catch (error) {
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
            return;
          }
          setTaskReferenceSearchResults([]);
          setTaskReferenceSearchError(error instanceof Error ? error.message : 'Không tải được danh sách task tham chiếu.');
        } finally {
          if (taskReferenceSearchRequestVersionRef.current === requestVersion) {
            setIsTaskReferenceSearchLoading(false);
          }
        }
      })();
    }, taskReferenceSearchTerm.trim() === '' ? 0 : 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTaskTab, editingRow?.id, formMode, taskReferenceSearchTerm]);

  const closeFormModal = () => {
    editHistoryRequestVersionRef.current += 1;
    projectItemRequestVersionRef.current += 1;
    receiverRequestVersionRef.current += 1;
    taskReferenceSearchRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    preservedAnalysisPathStatusIdRef.current = '';
    receiverDefaultContextRef.current = '';
    setFormMode(null);
    setEditingRow(null);
    setFormError('');
    setExchangeContentInlineError('');
    setCustomerFeedbackContentInlineError('');
    setFormValues(emptyFormValues());
    setFormAttachments([]);
    setIsUploadingAttachment(false);
    setAttachmentError('');
    setAttachmentNotice('');
    setFormIt360Tasks([createEmptyIt360TaskRow()]);
    setFormReferenceTasks([createEmptyReferenceTaskRow()]);
    setActiveTaskTab('IT360');
    setTaskReferenceSearchTerm('');
    setTaskReferenceSearchResults([]);
    setIsTaskReferenceSearchLoading(false);
    setTaskReferenceSearchError('');
    setFormPriority('MEDIUM');
    setLatestProgressBaseline(null);
    setSelectedLevel1('');
    setSelectedLevel2('');
    setSelectedLevel3('');
    setProcessingActorTab('CREATOR');
    setScopedProjectItems([]);
    setIsProjectItemsLoading(false);
    setReceiverOptions(EMPTY_RECEIVER_OPTIONS);
    setIsReceiverLoading(false);
  };

  const handleUploadAttachment = async (file: File) => {
    setAttachmentError('');
    setAttachmentNotice('');
    setIsUploadingAttachment(true);

    try {
      const uploaded = await uploadDocumentAttachment(file);
      setFormAttachments((prev) => [...prev, uploaded]);
      if (String(uploaded.warningMessage || '').trim() !== '') {
        setAttachmentNotice(String(uploaded.warningMessage || '').trim());
        notify('warning', 'Backblaze B2 chưa sẵn sàng', String(uploaded.warningMessage || '').trim());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tải file thất bại.';
      setAttachmentError(message);
      setAttachmentNotice('');
      notify('error', 'Tải file thất bại', message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    const confirmed = window.confirm('Gỡ file này khỏi yêu cầu? File đã tải lên sẽ không bị xóa khỏi kho lưu trữ.');
    if (!confirmed) {
      return;
    }

    setAttachmentError('');
    setAttachmentNotice('');
    setFormAttachments((prev) => prev.filter((attachment) => String(attachment.id) !== String(id)));
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
    receiverRequestVersionRef.current += 1;
    taskReferenceSearchRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    preservedAnalysisPathStatusIdRef.current = '';
    receiverDefaultContextRef.current = '';
    setFormMode('create');
    setEditingRow(null);
    setFormError('');
    setExchangeContentInlineError('');
    setCustomerFeedbackContentInlineError('');
    setFormValues(emptyFormValues());
    setFormAttachments([]);
    setIsUploadingAttachment(false);
    setAttachmentError('');
    setFormIt360Tasks([createEmptyIt360TaskRow()]);
    setFormReferenceTasks([createEmptyReferenceTaskRow()]);
    setActiveTaskTab('IT360');
    setTaskReferenceSearchTerm('');
    setTaskReferenceSearchResults([]);
    setIsTaskReferenceSearchLoading(false);
    setTaskReferenceSearchError('');
    setFormPriority('MEDIUM');
    setLatestProgressBaseline(null);
    setDidAttemptSaveWithoutProjectItem(false);
    setAttemptedReceiverBeforeProjectItem(false);
    setAttemptedAssigneeBeforeProjectItem(false);
    setReceiverOptions(EMPTY_RECEIVER_OPTIONS);
    setIsReceiverLoading(false);
    setProcessingActorTab('CREATOR');
    setSelectedLevel1('');
    setSelectedLevel2('');
    setSelectedLevel3('');
  };

  const openEditModal = (row: CustomerRequest) => {
    if (!canWriteRequests) {
      return;
    }

    editHistoryRequestVersionRef.current += 1;
    receiverRequestVersionRef.current += 1;
    taskReferenceSearchRequestVersionRef.current += 1;
    progressAutofillAppliedRef.current.clear();
    preservedAnalysisPathStatusIdRef.current = normalizeText(row.status_catalog_id);
    receiverDefaultContextRef.current = '';
    setFormMode('edit');
    setEditingRow(row);
    setFormError('');
    setExchangeContentInlineError('');
    setCustomerFeedbackContentInlineError('');
    setFormAttachments(Array.isArray(row.attachments) ? row.attachments : []);
    setIsUploadingAttachment(false);
    setAttachmentError('');
    setTaskReferenceSearchTerm('');
    setTaskReferenceSearchResults([]);
    setIsTaskReferenceSearchLoading(false);
    setTaskReferenceSearchError('');
    setFormPriority((String(row.priority || 'MEDIUM').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'));
    setDidAttemptSaveWithoutProjectItem(false);
    setAttemptedReceiverBeforeProjectItem(false);
    setAttemptedAssigneeBeforeProjectItem(false);
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
    setProcessingActorTab(resolveInitialProcessingActorTab(row));

    const metadata = row.transition_metadata && typeof row.transition_metadata === 'object'
      ? (row.transition_metadata as Record<string, unknown>)
      : {};
    const metadataProgress = extractProgressFromMetadata(metadata);
    const analysisMetadataProgress = extractAnalysisProgressFromMetadata(metadata);
    const metadataFormValues = Object.keys(metadata).reduce<Record<string, string>>((acc, key) => {
      acc[key] = String(metadata[key] ?? '');
      return acc;
    }, {});
    if (analysisMetadataProgress !== null) {
      const progressText = formatProgressNumber(analysisMetadataProgress);
      metadataFormValues.analysis_progress = progressText;
      if (analysisProgressFieldKey !== '') {
        metadataFormValues[analysisProgressFieldKey] = progressText;
      }
    }
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
    if (isRequestStatusMatch(row, 'DANG_XU_LY', '') && row.hours_estimated !== null && row.hours_estimated !== undefined) {
      metadataFormValues.processing_hours_estimated = String(row.hours_estimated);
    }

    const splitMappedTaskRows = splitCustomerRequestTaskRows(
      Array.isArray(row.tasks)
        ? row.tasks.map((task) => ({
            task_source: task?.task_source,
            task_code: task?.task_code,
            task_link: task?.task_link,
            status: task?.status,
            task_status: task?.task_status,
          }))
        : []
    );

    if (splitMappedTaskRows.referenceRows.length === 0 && String(row.reference_ticket_code || '').trim() !== '') {
      splitMappedTaskRows.referenceRows.push(
        createEmptyReferenceTaskRow({
          task_code: String(row.reference_ticket_code || '').trim(),
        })
      );
    }

    setFormIt360Tasks(
      splitMappedTaskRows.it360Rows.length > 0 ? splitMappedTaskRows.it360Rows : [createEmptyIt360TaskRow()]
    );
    setFormReferenceTasks(
      splitMappedTaskRows.referenceRows.length > 0
        ? dedupeReferenceTaskRows(splitMappedTaskRows.referenceRows)
        : [createEmptyReferenceTaskRow()]
    );
    setActiveTaskTab('IT360');
    setTaskReferenceSearchTerm('');
    setTaskReferenceSearchResults([]);
    setIsTaskReferenceSearchLoading(false);
    setTaskReferenceSearchError('');

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
      assigned_date: row.assigned_date ? String(row.assigned_date).slice(0, 10) : '',
      reference_ticket_code: String(row.reference_ticket_code || ''),
      reference_request_id: row.reference_request_id ? String(row.reference_request_id) : '',
      requested_date: row.requested_date ? String(row.requested_date).slice(0, 10) : '',
      analysis_hours_estimated: row.hours_estimated !== null && row.hours_estimated !== undefined
        ? String(row.hours_estimated)
        : '',
      processing_hours_estimated: isRequestStatusMatch(row, 'DANG_XU_LY', '') && row.hours_estimated !== null && row.hours_estimated !== undefined
        ? String(row.hours_estimated)
        : '',
      notes: String(row.notes || ''),
      request_code: String(row.request_code || ''),
    });
    setLatestProgressBaseline(metadataProgress);
    if (normalizeStatusCodeKey(row.status) === 'MOI_TIEP_NHAN') {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
    } else {
      applyStatusPathByLeaf(row.status_catalog_id);
    }

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
        const latestAnalysisTransition = transitions
          .slice()
          .sort((left, right) => {
            const leftTs = toOccurredAtTimestamp(left.created_at ?? left.updated_at ?? left.report_date ?? null);
            const rightTs = toOccurredAtTimestamp(right.created_at ?? right.updated_at ?? right.report_date ?? null);
            if (leftTs === rightTs) {
              return Number(right.id || 0) - Number(left.id || 0);
            }
            return rightTs - leftTs;
          })
          .find((transition) =>
            normalizeStatusCodeKey(transition.to_status) === 'PHAN_TICH'
            && normalizeStatusCodeKey(transition.sub_status || '') === ''
          ) || null;
        const latestProcessingTransition = transitions
          .slice()
          .sort((left, right) => {
            const leftTs = toOccurredAtTimestamp(left.created_at ?? left.updated_at ?? left.report_date ?? null);
            const rightTs = toOccurredAtTimestamp(right.created_at ?? right.updated_at ?? right.report_date ?? null);
            if (leftTs === rightTs) {
              return Number(right.id || 0) - Number(left.id || 0);
            }
            return rightTs - leftTs;
          })
          .find((transition) =>
            normalizeStatusCodeKey(transition.to_status) === 'DANG_XU_LY'
            && normalizeStatusCodeKey(transition.sub_status || '') === ''
          ) || null;
        const latestWaitingCustomerFeedbackTransition = transitions
          .slice()
          .sort((left, right) => {
            const leftTs = toOccurredAtTimestamp(left.created_at ?? left.updated_at ?? left.report_date ?? null);
            const rightTs = toOccurredAtTimestamp(right.created_at ?? right.updated_at ?? right.report_date ?? null);
            if (leftTs === rightTs) {
              return Number(right.id || 0) - Number(left.id || 0);
            }
            return rightTs - leftTs;
          })
          .find((transition) =>
            normalizeStatusCodeKey(transition.to_status) === 'DOI_PHAN_HOI_KH'
            && normalizeStatusCodeKey(transition.sub_status || '') === ''
          ) || null;
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

        const historyTaskRows = Array.isArray(payload.ref_tasks)
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
              .map((task) => ({
                task_source: (task as Record<string, unknown>)?.task_source,
                task_code: (task as Record<string, unknown>)?.task_code,
                task_link: (task as Record<string, unknown>)?.task_link,
                task_status: (task as Record<string, unknown>)?.task_status,
              }))
          : [];
        const splitHistoryTaskRows = splitCustomerRequestTaskRows(historyTaskRows);

        if (splitHistoryTaskRows.it360Rows.length > 0 || splitHistoryTaskRows.referenceRows.length > 0) {
          setFormIt360Tasks(
            splitHistoryTaskRows.it360Rows.length > 0
              ? splitHistoryTaskRows.it360Rows
              : [createEmptyIt360TaskRow()]
          );
          setFormReferenceTasks(
            splitHistoryTaskRows.referenceRows.length > 0
              ? splitHistoryTaskRows.referenceRows
              : [createEmptyReferenceTaskRow()]
          );
        }

        if (payload.request && Array.isArray(payload.request.attachments)) {
          setFormAttachments(payload.request.attachments);
        }

        if (latestAnalysisTransition) {
          const latestAnalysisMetadata = toMetadataObject(latestAnalysisTransition.transition_metadata ?? null);
          const latestAnalysisProgress = extractAnalysisProgressFromMetadata(latestAnalysisMetadata);
          const latestAnalysisHours = normalizeText(latestAnalysisTransition.hours_estimated ?? '');
          const latestAnalysisCompletionDate = normalizeDateValueForDateInput(
            findFormValueByTokens(
              Object.keys(latestAnalysisMetadata || {}).reduce<Record<string, string>>((acc, key) => {
                acc[key] = String(latestAnalysisMetadata?.[key] ?? '');
                return acc;
              }, {}),
              ['analysis_completion_date'],
              ANALYSIS_COMPLETION_DATE_FIELD_TOKENS
            )
          );

          setFormValues((prev) => {
            const next = { ...prev };
            if (latestAnalysisProgress !== null) {
              const progressText = formatProgressNumber(latestAnalysisProgress);
              next.analysis_progress = progressText;
              next[analysisProgressFieldKey] = progressText;
            }
            if (latestAnalysisHours !== '') {
              next.analysis_hours_estimated = latestAnalysisHours;
              next[analysisHoursFieldKey] = latestAnalysisHours;
            }
            if (latestAnalysisCompletionDate !== '') {
              next.analysis_completion_date = latestAnalysisCompletionDate;
              next[analysisCompletionDateFieldKey] = latestAnalysisCompletionDate;
            }
            return next;
          });
        }

        if (latestProcessingTransition) {
          const latestProcessingHours = normalizeText(latestProcessingTransition.hours_estimated ?? '');
          if (latestProcessingHours !== '') {
            setFormValues((prev) => ({
              ...prev,
              processing_hours_estimated: latestProcessingHours,
            }));
          }
        }

        if (latestWaitingCustomerFeedbackTransition) {
          const latestWaitingMetadata = toMetadataObject(latestWaitingCustomerFeedbackTransition.transition_metadata ?? null);
          const latestWaitingFormValues = Object.keys(latestWaitingMetadata || {}).reduce<Record<string, string>>((acc, key) => {
            acc[key] = String(latestWaitingMetadata?.[key] ?? '');
            return acc;
          }, {});
          const latestWaitingAssignedDate = normalizeDateValueForDateInput(
            normalizeText(latestWaitingCustomerFeedbackTransition.assigned_date ?? row.assigned_date ?? '')
          );
          const latestWaitingExchangeDate = normalizeDateValueForDateInput(
            findFormValueByTokens(
              latestWaitingFormValues,
              [exchangeDateFieldKey, 'exchange_date'],
              WORKFLOW_SEMANTIC_FIELD_TOKENS.exchange_date
            )
          );
          const latestWaitingExchangeContent = findRawFormValueByTokens(
            latestWaitingFormValues,
            [exchangeContentFieldKey, 'exchange_content'],
            WORKFLOW_SEMANTIC_FIELD_TOKENS.exchange_content
          );
          const latestWaitingFeedbackDate = normalizeDateValueForDateInput(
            findFormValueByTokens(
              latestWaitingFormValues,
              [customerFeedbackDateFieldKey, 'customer_feedback_date'],
              WORKFLOW_SEMANTIC_FIELD_TOKENS.customer_feedback_date
            )
          );
          const latestWaitingFeedbackContent = findRawFormValueByTokens(
            latestWaitingFormValues,
            [customerFeedbackContentFieldKey, 'customer_feedback_content'],
            WORKFLOW_SEMANTIC_FIELD_TOKENS.customer_feedback_content
          );

          setFormValues((prev) => ({
            ...prev,
            assigned_date: normalizeText(prev.assigned_date) !== '' ? prev.assigned_date : latestWaitingAssignedDate,
            [exchangeDateFieldKey]: normalizeText(prev[exchangeDateFieldKey]) !== '' ? prev[exchangeDateFieldKey] : latestWaitingExchangeDate,
            exchange_date: normalizeText(prev.exchange_date) !== '' ? prev.exchange_date : latestWaitingExchangeDate,
            [exchangeContentFieldKey]: normalizeText(prev[exchangeContentFieldKey]) !== '' ? prev[exchangeContentFieldKey] : latestWaitingExchangeContent,
            exchange_content: normalizeText(prev.exchange_content) !== '' ? prev.exchange_content : latestWaitingExchangeContent,
            [customerFeedbackDateFieldKey]: normalizeText(prev[customerFeedbackDateFieldKey]) !== '' ? prev[customerFeedbackDateFieldKey] : latestWaitingFeedbackDate,
            customer_feedback_date: normalizeText(prev.customer_feedback_date) !== '' ? prev.customer_feedback_date : latestWaitingFeedbackDate,
            [customerFeedbackContentFieldKey]:
              normalizeText(prev[customerFeedbackContentFieldKey]) !== ''
                ? prev[customerFeedbackContentFieldKey]
                : latestWaitingFeedbackContent,
            customer_feedback_content:
              normalizeText(prev.customer_feedback_content) !== ''
                ? prev.customer_feedback_content
                : latestWaitingFeedbackContent,
          }));
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

  const focusProcessingStage = (tab: ProcessingActorTab) => {
    setProcessingActorTab(tab);
  };

  const setStageFormError = (tab: ProcessingActorTab, message: string) => {
    focusProcessingStage(tab);
    setFormError(message);
    notify('error', 'Không thể lưu yêu cầu', message);
  };

  const handleSave = async (saveMode: 'close' | 'continue_assignment' | 'accept_execution' = 'close') => {
    if (!formMode) {
      return;
    }

    setFormError('');
    setExchangeContentInlineError('');
    setCustomerFeedbackContentInlineError('');

    const hasAssignmentOrExecutionDraftInput =
      (processingActorTab !== 'CREATOR' && normalizeText(formValues.receiver_user_id) !== '')
      || normalizeText(formValues.assignee_id) !== ''
      || normalizeText(selectedLevel1) !== ''
      || normalizeText(selectedLevel2) !== ''
      || normalizeText(selectedLevel3) !== ''
      || formIt360Tasks.some((task) => normalizeText(task.task_code) !== '' || normalizeText(task.task_link) !== '')
      || formReferenceTasks.some((task) => normalizeText(task.task_code) !== '');
    const selectedTargetStageTab = selectedLeafStatusNode
      ? resolveProcessingActorTabFromStatusNode(selectedLeafStatusNode, processingActorTab)
      : currentWorkflowStageTab;

    if (!selectedLeafStatusId && formMode === 'edit') {
      setStageFormError(selectedTargetStageTab === 'CREATOR' ? 'ASSIGNER' : selectedTargetStageTab, 'Vui lòng chọn đủ trạng thái để xác định form workflow.');
      return;
    }
    if (configuredTransitionGuardMessage !== '') {
      setStageFormError(selectedTargetStageTab, configuredTransitionGuardMessage);
      return;
    }

    const summary = normalizeText(formValues.summary);
    if (summary === '') {
      setStageFormError('CREATOR', 'Nội dung yêu cầu là bắt buộc.');
      return;
    }
    if (!normalizeText(formValues.project_item_id)) {
      focusProcessingStage('CREATOR');
      setDidAttemptSaveWithoutProjectItem(true);
      setAttemptedReceiverBeforeProjectItem(true);
      setAttemptedAssigneeBeforeProjectItem(true);
      setFormError('Phần mềm triển khai là bắt buộc.');
      notify('error', 'Không thể lưu yêu cầu', 'Phần mềm triển khai là bắt buộc.');
      return;
    }
    let analysisProgressNumber: number | null = null;
    let analysisHoursNumber: number | null = null;
    let processingHoursNumber: number | null = null;
    if (isAnalysisSelectionFlow) {
      const analysisProgressRaw = normalizeText(analysisProgressValue);
      if (analysisProgressRaw === '') {
        setStageFormError('ASSIGNER', 'Tiến độ phân tích là bắt buộc.');
        return;
      }
      const parsedAnalysisProgress = parseProgressNumber(analysisProgressRaw);
      if (
        parsedAnalysisProgress === null
        || parsedAnalysisProgress < 0
        || parsedAnalysisProgress > 100
        || !Number.isInteger(parsedAnalysisProgress)
      ) {
        setStageFormError('ASSIGNER', 'Tiến độ phân tích phải là số nguyên từ 0 đến 100.');
        return;
      }

      const analysisHoursRaw = normalizeText(analysisHoursValue);
      if (analysisHoursRaw === '') {
        setStageFormError('ASSIGNER', analysisHoursRequiredMessage);
        return;
      }
      if (!isValidHoursEstimatedInput(analysisHoursRaw)) {
        setStageFormError('ASSIGNER', analysisHoursInvalidMessage);
        return;
      }

      const parsedAnalysisHours = parseHoursEstimatedNumber(analysisHoursRaw);
      if (parsedAnalysisHours === null || parsedAnalysisHours < 0) {
        setStageFormError('ASSIGNER', analysisHoursInvalidMessage);
        return;
      }

      analysisProgressNumber = parsedAnalysisProgress;
      analysisHoursNumber = parsedAnalysisHours;
    }
    if (isProcessingLeafStatus) {
      const processingHoursRaw = normalizeText(processingHoursValue);
      if (processingHoursRaw === '') {
        setStageFormError('WORKER', 'Số giờ dự kiến xử lý là bắt buộc.');
        return;
      }
      if (!isValidHoursEstimatedInput(processingHoursRaw)) {
        setStageFormError('WORKER', 'Số giờ dự kiến xử lý phải là số không âm, tối đa 2 chữ số thập phân.');
        return;
      }

      const parsedProcessingHours = parseHoursEstimatedNumber(processingHoursRaw);
      if (parsedProcessingHours === null || parsedProcessingHours < 0) {
        setStageFormError('WORKER', 'Số giờ dự kiến xử lý phải là số không âm, tối đa 2 chữ số thập phân.');
        return;
      }

      processingHoursNumber = parsedProcessingHours;
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
        setStageFormError('WORKER', 'Tiến độ là bắt buộc.');
        return;
      }
      const progressValue = parseProgressNumber(progressRaw);
      if (progressValue === null || progressValue < 0 || progressValue > 100) {
        setStageFormError('WORKER', 'Tiến độ phải trong khoảng từ 0 đến 100.');
        return;
      }
      currentProgressValue = progressValue;
    }
    if (
      isAnalysisSelectionFlow
      && (selectedLevel2 !== '' || selectedLevel3 !== '')
      && (
        analysisProgressNumber !== 100
        || analysisHoursNumber === null
        || analysisHoursNumber <= 0
      )
      && !hasPersistedAnalysisPathSelection
    ) {
      setStageFormError('ASSIGNER', analysisPathSelectionGuardMessage);
      return;
    }
    if (
      formMode === 'edit'
      && currentProgressValue !== null
      && latestProgressBaseline !== null
      && currentProgressValue <= latestProgressBaseline
    ) {
      setStageFormError('WORKER', `Tiến độ mới phải lớn hơn lần trước (${formatProgressNumber(latestProgressBaseline)}%).`);
      return;
    }
    if (isProgrammingUpcodeLeafStatus && normalizeUpcodeStatus(upcodeStatusValue) === '') {
      setStageFormError('WORKER', 'Vui lòng chọn trạng thái upcode.');
      return;
    }
    if (isWaitingCustomerFeedbackStatus && isSameWaitingCustomerFeedbackActor) {
      if (waitingCustomerExchangeDateValue === '') {
        setStageFormError('ASSIGNER', 'Ngày trao đổi với khách hàng là bắt buộc.');
        return;
      }
      if (normalizeText(waitingCustomerExchangeContentValue) === '') {
        focusProcessingStage('ASSIGNER');
        setExchangeContentInlineError('Nội dung trao đổi là bắt buộc.');
        notify('error', 'Không thể lưu yêu cầu', 'Nội dung trao đổi là bắt buộc.');
        return;
      }
      if (normalizeText(waitingCustomerFeedbackDateValue) === '') {
        setStageFormError('ASSIGNER', 'Ngày khách hàng phản hồi là bắt buộc.');
        return;
      }
      if (normalizeText(waitingCustomerFeedbackContentValue) === '') {
        focusProcessingStage('ASSIGNER');
        setCustomerFeedbackContentInlineError('Nội dung khách hàng phản hồi là bắt buộc.');
        notify('error', 'Không thể lưu yêu cầu', 'Nội dung khách hàng phản hồi là bắt buộc.');
        return;
      }
    }
    if (exchangeDateConstraintMessage !== '') {
      setStageFormError('ASSIGNER', exchangeDateConstraintMessage);
      return;
    }

    setIsSaving(true);
    setFormError('');
    let continueWithSavedRow: CustomerRequest | null = null;
    let continueWithExecutionRow: CustomerRequest | null = null;

    try {
      let savedRow: CustomerRequest | null = null;
      const transitionMetadata: Record<string, unknown> = {};
      let payloadAssignedDate: string | null = normalizeText(formValues.assigned_date) || null;
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
      const analysisHandledFieldKeys = new Set<string>(
        isAnalysisSelectionFlow
          ? [
              analysisProgressFieldKey,
              analysisHoursFieldKey,
              analysisCompletionDateFieldKey,
            ].filter((key) => key !== '')
          : []
      );
      const processingHandledFieldKeys = new Set<string>(
        isProcessingLeafStatus
          ? [processingHoursFieldKey].filter((key) => key !== '')
          : []
      );
      const waitingCustomerHandledFieldKeys = new Set<string>(
        [
          exchangeDateFieldKey,
          exchangeContentFieldKey,
          customerFeedbackDateFieldKey,
          customerFeedbackContentFieldKey,
          'exchange_date',
          'exchange_content',
          'customer_feedback_date',
          'customer_feedback_content',
          'assigned_date',
        ].filter((key) => key !== '')
      );
      const isProgressLikeWorkflowField = (field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>): boolean => {
        const keyToken = normalizeFieldToken(field.field_key || '');
        const labelToken = normalizeFieldToken(field.field_label || '');
        const candidates = ['tind', 'tiendo', 'progress', 'progresspercent', 'pauseprogress', 'upcodeprogress', 'dmsprogress'];
        return candidates.some((token) => keyToken.includes(token) || labelToken.includes(token));
      };
      const it360TaskRows = formIt360Tasks
        .map((task, index) => ({
          task_source: 'IT360',
          task_code: normalizeText(task.task_code) || null,
          task_link: normalizeText(task.task_link) || null,
          task_status: normalizeSupportTaskStatus(task.status || 'TODO'),
          sort_order: index,
        }))
        .filter((task) => task.task_code !== null || task.task_link !== null);
      const referenceTaskRows = formReferenceTasks
        .map((task, index) => ({
          task_source: 'REFERENCE',
          task_code: normalizeText(task.task_code) || null,
          task_link: null,
          task_status: null,
          sort_order: index,
        }))
        .filter((task) => task.task_code !== null);
      const firstReferenceTask = referenceTaskRows.find((task) => normalizeText(task.task_code) !== '') || null;

      if (!isProgrammingPausedLeafStatus) {
        if (it360TaskRows.length > 0) {
          refTasks.push(...it360TaskRows);
        }
        if (referenceTaskRows.length > 0) {
          refTasks.push(...referenceTaskRows);
        }
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
        if (analysisHandledFieldKeys.has(key)) {
          return;
        }
        if (processingHandledFieldKeys.has(key)) {
          return;
        }
        if (waitingCustomerHandledFieldKeys.has(key)) {
          return;
        }
        if (
          isAnalysisSelectionFlow
          && ANALYSIS_HIDDEN_LEGACY_FIELD_TOKENS.some((token) => {
            const keyToken = normalizeFieldToken(field.field_key || '');
            const labelToken = normalizeFieldToken(field.field_label || '');
            return keyToken.includes(token) || labelToken.includes(token);
          })
        ) {
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
          refTasks.push({ task_source: 'REFERENCE', task_code: rawValue, sort_order: refTasks.length });
          return;
        }

        if (fieldType === 'task_list') {
          parseTaskList(rawValue).forEach((taskCode) => {
            refTasks.push({ task_source: 'REFERENCE', task_code: taskCode, sort_order: refTasks.length });
          });
          return;
        }

        if (fieldType === 'worklog') {
          worklogs.push({
            phase: 'OTHER',
            logged_date: normalizeText(formValues.requested_date) || toLocalDateInputValue(),
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

      if (isAnalysisSelectionFlow) {
        if (analysisProgressNumber !== null) {
          transitionMetadata.analysis_progress = analysisProgressNumber;
        }

        const normalizedAnalysisCompletionDate = normalizeDateValueForDateInput(analysisCompletionDateValue);
        if (normalizedAnalysisCompletionDate !== '') {
          transitionMetadata.analysis_completion_date = normalizedAnalysisCompletionDate;
        }
      }

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

      if (isWaitingCustomerFeedbackStatus) {
        const normalizedAssignedDate = normalizeDateValueForDateInput(assignedDateValue);
        if (normalizedAssignedDate !== '') {
          payloadAssignedDate = normalizedAssignedDate;
        }

        const normalizedExchangeDate = normalizeDateValueForDateInput(waitingCustomerExchangeDateValue);
        if (normalizedExchangeDate !== '') {
          transitionMetadata.exchange_date = normalizedExchangeDate;
        }

        const normalizedExchangeContent = normalizeText(waitingCustomerExchangeContentValue);
        if (normalizedExchangeContent !== '') {
          transitionMetadata.exchange_content = normalizedExchangeContent;
        }

        const normalizedFeedbackDate = normalizeDateValueForDateInput(waitingCustomerFeedbackDateValue);
        if (normalizedFeedbackDate !== '') {
          transitionMetadata.customer_feedback_date = normalizedFeedbackDate;
        }

        const normalizedFeedbackContent = normalizeText(waitingCustomerFeedbackContentValue);
        if (normalizedFeedbackContent !== '') {
          transitionMetadata.customer_feedback_content = normalizedFeedbackContent;
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
            logged_date: upcodeDate || toLocalDateInputValue(),
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
        status_catalog_id: selectedLeafStatusId ? Number(selectedLeafStatusId) : null,
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
        assigned_date: payloadAssignedDate,
        reference_ticket_code: isProgrammingPausedLeafStatus
          ? null
          : (firstReferenceTask?.task_code || null),
        reference_request_id: isProgrammingPausedLeafStatus
          ? null
          : null,
        notes: isProgrammingPausedLeafStatus ? null : (normalizeText(formValues.notes) || null),
        transition_metadata: transitionMetadata,
        transition_note: isProgrammingPausedLeafStatus ? null : (normalizeText(formValues.notes) || null),
        attachments: formAttachments,
        tasks: [],
        ref_tasks: normalizedRefTasks,
        worklogs,
      };
      if (isAnalysisSelectionFlow) {
        payload.hours_estimated = analysisHoursNumber;
      } else if (isProcessingLeafStatus) {
        payload.hours_estimated = processingHoursNumber;
      }

      if (formMode === 'create') {
        savedRow = await createCustomerRequest(payload);
        notify('success', 'Tạo yêu cầu', 'Đã tạo yêu cầu khách hàng mới.');
      } else if (editingRow) {
        savedRow = await updateCustomerRequest(editingRow.id, payload);
        notify(
          'success',
          saveMode === 'accept_execution' ? 'Nhận việc' : 'Cập nhật yêu cầu',
          saveMode === 'accept_execution'
            ? 'Đã nhận việc. Tiếp tục cập nhật trạng thái xử lý.'
            : 'Đã cập nhật yêu cầu khách hàng.',
        );
        if (savedRow) {
          setEditingRow(savedRow);
          setRows((currentRows) =>
            currentRows.map((row) => (
              String(row.id) === String(savedRow?.id) ? savedRow : row
            ))
          );
          if (historyTarget && String(historyTarget.id) === String(savedRow.id)) {
            setHistoryTarget(savedRow);
          }
        }
      }

      const shouldContinueToAssignment = saveMode === 'continue_assignment' && formMode === 'create' && savedRow;
      const shouldContinueToExecution = saveMode === 'accept_execution' && formMode === 'edit' && savedRow;
      if (!shouldContinueToAssignment && !shouldContinueToExecution) {
        closeFormModal();
      } else {
        if (shouldContinueToAssignment) {
          continueWithSavedRow = savedRow;
        }
        if (shouldContinueToExecution) {
          continueWithExecutionRow = savedRow;
        }
      }
      await Promise.all([
        loadRows(currentPage, searchText, statusFilter),
        loadDashboardSummary(searchText, statusFilter, dashboardDateFrom, dashboardDateTo),
      ]);
      if (historyViewMode === 'request') {
        const nextHistoryRequestId = historyTarget
          ? (formMode === 'edit' && editingRow ? editingRow.id : historyTarget.id)
          : null;
        if (nextHistoryRequestId !== null && nextHistoryRequestId !== undefined) {
          void loadHistoryRows({ requestId: nextHistoryRequestId });
        }
      } else if (historyViewMode === 'dashboard') {
        void loadHistoryRows({
          requestId: null,
          dashboardDrilldown: historyDashboardDrilldown,
          dateFrom: dashboardDateFrom,
          dateTo: dashboardDateTo,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu yêu cầu khách hàng.';
      setFormError(message);
      notify('error', 'Lưu yêu cầu thất bại', message);
    } finally {
      setIsSaving(false);
    }

    if (continueWithSavedRow) {
      closeFormModal();
      openEditModal(continueWithSavedRow);
      setProcessingActorTab('ASSIGNER');
    }
    if (continueWithExecutionRow) {
      setProcessingActorTab('WORKER');
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
      await Promise.all([
        loadRows(currentPage, searchText, statusFilter),
        loadDashboardSummary(searchText, statusFilter, dashboardDateFrom, dashboardDateTo),
      ]);
      if (historyViewMode === 'request' && historyTarget && String(historyTarget.id) === String(row.id)) {
        setHistoryTarget(null);
        setHistoryViewMode(null);
        setHistoryRows([]);
        setHistoryError('');
      } else if (historyViewMode === 'request' && historyTarget?.id !== null && historyTarget?.id !== undefined) {
        void loadHistoryRows({ requestId: historyTarget?.id ?? null });
      } else if (historyViewMode === 'dashboard') {
        void loadHistoryRows({
          requestId: null,
          dashboardDrilldown: historyDashboardDrilldown,
          dateFrom: dashboardDateFrom,
          dateTo: dashboardDateTo,
        });
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
    setHistoryViewMode('request');
    setHistoryTarget(row);
    setHistoryDashboardDrilldown(null);
    setHistorySearchTerm('');
    await loadHistoryRows({ requestId: row.id, scrollIntoView: true });
  };

  const clearHistoryFocus = () => {
    setHistoryViewMode(null);
    setHistoryTarget(null);
    setHistoryDashboardDrilldown(null);
    setHistorySearchTerm('');
    setHistoryRows([]);
    setHistoryError('');
    setIsHistoryLoading(false);
    historyRequestVersionRef.current += 1;
  };

  const applyDashboardDateFilters = () => {
    setDashboardDateFrom(normalizeText(dashboardDateFromInput));
    setDashboardDateTo(normalizeText(dashboardDateToInput));
  };

  const clearDashboardDateFilters = () => {
    setDashboardDateFromInput('');
    setDashboardDateToInput('');
    setDashboardDateFrom('');
    setDashboardDateTo('');
  };

  const openDashboardHistory = async (next: Partial<DashboardDrilldownState>) => {
    const mergedDrilldown = mergeDashboardDrilldownState(dashboardDrilldown, next);
    setHistoryViewMode('dashboard');
    setHistoryTarget(null);
    setHistoryDashboardDrilldown(mergedDrilldown);
    setHistorySearchTerm('');
    await loadHistoryRows({
      requestId: null,
      dashboardDrilldown: mergedDrilldown,
      dateFrom: dashboardDateFrom,
      dateTo: dashboardDateTo,
      scrollIntoView: true,
    });
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
        filters: buildCustomerRequestListFilters(statusFilter, dashboardDrilldown),
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

      await Promise.all([
        loadRows(1, searchText, statusFilter),
        loadDashboardSummary(searchText, statusFilter, dashboardDateFrom, dashboardDateTo),
      ]);
      if (historyViewMode === 'request' && historyTarget && historyTarget.id !== null && historyTarget.id !== undefined) {
        void loadHistoryRows({ requestId: historyTarget.id });
      } else if (historyViewMode === 'dashboard') {
        void loadHistoryRows({
          requestId: null,
          dashboardDrilldown: historyDashboardDrilldown,
          dateFrom: dashboardDateFrom,
          dateTo: dashboardDateTo,
        });
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
    const label = field.field_label || key;
    const keyToken = normalizeFieldToken(key);
    const labelToken = normalizeFieldToken(label);
    const effectiveFieldType = resolveWorkflowFieldType(field);
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
            value={normalizeDateValueForDateInput(value)}
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

  const renderAuditField = (label: string, value: string, emphasis: 'normal' | 'muted' = 'normal') => (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-1 text-sm ${emphasis === 'muted' ? 'text-slate-400' : 'font-medium text-slate-800'}`}
        title={value}
      >
        {value || '--'}
      </p>
    </div>
  );

  const renderMainBusinessSection = ({
    showWorkflowSelector = true,
    showPrioritySelector = true,
    showRequestedDateField = false,
  }: {
    showWorkflowSelector?: boolean;
    showPrioritySelector?: boolean;
    showRequestedDateField?: boolean;
  } = {}) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <SearchableSelect
          className="md:col-span-2"
          value={formValues.project_item_id}
          options={projectItemOptions}
          onChange={handleProjectItemChange}
          autoFocusTrigger={Boolean(formMode)}
          label="Phần mềm triển khai"
          required
          placeholder={hasAvailableProjectItemOptions ? 'Chọn phần mềm triển khai' : 'Không có phần mềm triển khai khả dụng'}
          searchPlaceholder="Tìm phần mềm triển khai..."
          disabled={!isProjectItemsLoading && !hasAvailableProjectItemOptions}
          searching={isProjectItemsLoading}
          noOptionsText={projectItemEmptyStateMessage}
          error={projectItemFieldError}
        />
        {!isProjectItemsLoading && !hasAvailableProjectItemOptions ? (
          <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {projectItemEmptyStateMessage}
          </div>
        ) : null}
        {selectedProjectItem ? (
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sản phẩm:
            {' '}
            <span className="font-semibold text-slate-700">{selectedProjectItem.product_name || '--'}</span>
            {' | '}
            Đơn vị:
            {' '}
            <span className="font-semibold text-slate-700">{selectedCustomerName || selectedProjectItem.customer_name || '--'}</span>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Nội dung yêu cầu <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formValues.summary}
            onChange={(event) => setFormValues((prev) => ({ ...prev, summary: event.target.value }))}
            rows={4}
            placeholder="Mô tả chi tiết yêu cầu cần xử lý..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
              placeholder={effectiveSupportGroupCustomerId ? 'Chọn nhóm Zalo/Tele' : 'Chọn phần mềm triển khai để tải nhóm'}
              searchPlaceholder="Tìm nhóm Zalo/Tele..."
              disabled={!effectiveSupportGroupCustomerId || isSupportGroupsLoading}
              searching={isSupportGroupsLoading}
              noOptionsText={supportGroupEmptyStateMessage}
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
              placeholder={effectiveSupportGroupCustomerId ? 'Chọn nhóm Zalo/Tele' : 'Chọn phần mềm triển khai để tải nhóm'}
              searchPlaceholder="Tìm nhóm Zalo/Tele..."
              disabled={!effectiveSupportGroupCustomerId || isSupportGroupsLoading}
              searching={isSupportGroupsLoading}
              noOptionsText={supportGroupEmptyStateMessage}
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

        {showWorkflowSelector && showWorkflowLevel1Selector ? (
          <SearchableSelect
            value={selectedLevel1}
            options={level1Options}
            onChange={(value) => {
              setSelectedLevel1(value);
              setSelectedLevel2('');
              setSelectedLevel3('');
            }}
            label="Luồng xử lý"
            placeholder="Chọn luồng xử lý"
          />
        ) : null}

        {showPrioritySelector
        && !isProgrammingCompletedLeafStatus &&
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

        {showRequestedDateField ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tiếp nhận</label>
            <input
              type="date"
              value={formValues.requested_date}
              onChange={(event) => setFormValues((prev) => ({ ...prev, requested_date: event.target.value }))}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : null}
      </div>
    </section>
  );

  const renderTaskManagementSection = () => (
    !isProgrammingCompletedLeafStatus && !isProgrammingPausedLeafStatus ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-slate-700">Danh sách task</h5>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTaskTab('IT360')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTaskTab === 'IT360'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">deployed_code</span>
                  Task IT360
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTaskTab('REFERENCE')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTaskTab === 'REFERENCE'
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">dataset_linked</span>
                  Task tham chiếu
                </button>
              </div>
            </div>
            <div className="flex justify-start xl:justify-end">
              <button
                type="button"
                onClick={addTaskRowByActiveTab}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {activeTaskTab === 'IT360' ? 'Thêm Task IT360' : 'Thêm task tham chiếu'}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            {activeTaskTab === 'IT360' ? (
              <div className="space-y-2">
                {formIt360Tasks.map((task, index) => (
                  <div
                    key={task.local_id}
                    className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_220px_auto]"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task #{index + 1}</p>
                      <input
                        type="text"
                        value={task.task_code}
                        onChange={(event) => updateIt360TaskRow(task.local_id, 'task_code', event.target.value)}
                        placeholder={`Nhập mã task IT360 #${index + 1}`}
                        className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Link task</p>
                      <input
                        type="text"
                        value={task.task_link}
                        onChange={(event) => updateIt360TaskRow(task.local_id, 'task_link', event.target.value)}
                        placeholder="Link task (tuỳ chọn)"
                        className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p>
                      <SearchableSelect
                        value={task.status}
                        options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                        onChange={(value) => updateIt360TaskRow(task.local_id, 'status', value)}
                        compact
                      />
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeIt360TaskRow(task.local_id)}
                        className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        title="Xoá task IT360"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {formReferenceTasks.map((task, index) => (
                  <div
                    key={task.local_id}
                    className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Task tham chiếu #{index + 1}
                      </p>
                      <SearchableSelect
                        value={task.task_code}
                        options={taskReferenceOptions}
                        onChange={(value) => updateReferenceTaskRow(task.local_id, value)}
                        onSearchTermChange={setTaskReferenceSearchTerm}
                        placeholder={`Chọn task tham chiếu #${index + 1}`}
                        searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                        noOptionsText={taskReferenceSearchError || 'Không tìm thấy task tham chiếu'}
                        searching={isTaskReferenceSearchLoading}
                        compact
                        usePortal
                      />
                      {taskReferenceSearchError ? (
                        <p className="text-xs text-rose-600">{taskReferenceSearchError}</p>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeReferenceTaskRow(task.local_id)}
                        className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        title="Xoá task tham chiếu"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    ) : null
  );

  const renderSharedCollaborationSection = () => (
    !isProgrammingCompletedLeafStatus && !isProgrammingPausedLeafStatus ? (
      <section className="space-y-3">
        <AttachmentManager
          attachments={formAttachments}
          onUpload={handleUploadAttachment}
          onDelete={handleRemoveAttachment}
          isUploading={isUploadingAttachment}
          helperText="Sau khi tải lên, hệ thống hiển thị luôn liên kết mở file từ Backblaze B2 hoặc máy chủ nội bộ."
          emptyStateDescription="Tải file lên để nhận ngay liên kết mở file từ Backblaze B2 hoặc máy chủ nội bộ."
          enableClipboardPaste
          clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
        />

        {attachmentError ? (
          <p className="text-sm text-rose-600">{attachmentError}</p>
        ) : null}
        {!attachmentError && attachmentNotice ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {attachmentNotice}
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Ghi chú</label>
          <textarea
            value={formValues.notes}
            onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))}
            rows={2}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </section>
    ) : null
  );

  const renderAnalysisPathSelectors = (
    showLevel2Selector = showWorkflowLevel2Selector,
    showLevel3Selector = showWorkflowLevel3Selector,
  ) => (
    shouldShowAnalysisPathSelectors && (showLevel2Selector || showLevel3Selector) ? (
      <div className="space-y-3">
        {showLevel2Selector ? (
          <SearchableSelect
            value={selectedLevel2}
            options={level2Options}
            onChange={(value) => {
              setFormError('');
              setSelectedLevel2(value);
              setSelectedLevel3('');
              syncProcessingActorTabForSelection(
                value ? (statusById.get(String(value)) || null) : selectedLevel1Node,
                'ASSIGNER'
              );
            }}
            label="Hướng xử lý"
            placeholder="Chọn hướng xử lý"
            disabled={shouldLockAnalysisPathSelection}
          />
        ) : null}
        {showLevel3Selector && !shouldHideAnalysisExecutionStatusSelector ? (
          <SearchableSelect
            value={selectedLevel3}
            options={level3Options}
            onChange={(value) => {
              setFormError('');
              setSelectedLevel3(value);
              syncProcessingActorTabForSelection(
                value ? (statusById.get(String(value)) || null) : selectedLevel2Node,
                value ? 'WORKER' : 'ASSIGNER'
              );
            }}
            label="Trạng thái xử lý"
            placeholder="Chọn trạng thái xử lý"
            disabled={shouldLockAnalysisPathSelection || shouldDisableAnalysisExecutionStatusSelector}
          />
        ) : null}
      </div>
    ) : null
  );

  const renderAnalysisPhaseFields = (
    showLevel2Selector = showWorkflowLevel2Selector,
    showLevel3Selector = showWorkflowLevel3Selector,
  ) => {
    const analysisPathSelectors = renderAnalysisPathSelectors(showLevel2Selector, showLevel3Selector);

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="order-1">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Tiến độ phân tích <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={analysisProgressValue}
            onChange={(event) => setWorkflowFieldValue(analysisProgressFieldKey, 'analysis_progress', event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="order-2">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {analysisHoursLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={analysisHoursValue}
            onChange={(event) => setWorkflowFieldValue(analysisHoursFieldKey, 'analysis_hours_estimated', event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="order-3">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {analysisCompletionDateField?.field_label || 'Ngày hoàn thành'}
          </label>
          <input
            type="date"
            value={analysisCompletionDateValue}
            onChange={(event) => setWorkflowFieldValue(analysisCompletionDateFieldKey, 'analysis_completion_date', event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {analysisPathSelectors ? (
          <div className="order-4">
            {analysisPathSelectors}
          </div>
        ) : null}
      </div>
    );
  };

  const renderWorkflowSection = ({
    showLevel2Selector = showWorkflowLevel2Selector,
    showLevel3Selector = showWorkflowLevel3Selector,
  }: WorkflowSectionRenderOptions = {}) => {
    if (!shouldShowWorkflowSection) {
      return null;
    }

    const visibleSelectorCount = [showLevel2Selector, showLevel3Selector].filter(Boolean).length;
    const workflowGridColumnsClass = visibleSelectorCount >= 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

    return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      {shouldRenderAnalysisPhaseFields ? (
        renderAnalysisPhaseFields(showLevel2Selector, showLevel3Selector)
      ) : (
        <div
          className={[
            'grid gap-3',
            workflowGridColumnsClass,
          ].join(' ')}
        >
          {showLevel2Selector ? (
            <SearchableSelect
              value={selectedLevel2}
              options={level2Options}
              onChange={(value) => {
                setFormError('');
                setSelectedLevel2(value);
                setSelectedLevel3('');
                syncProcessingActorTabForSelection(
                  value ? (statusById.get(String(value)) || null) : selectedLevel1Node,
                  'ASSIGNER'
                );
              }}
              label="Hướng xử lý"
              placeholder="Chọn hướng xử lý"
            />
          ) : null}
          {showLevel3Selector ? (
            <SearchableSelect
              value={selectedLevel3}
              options={level3Options}
              onChange={(value) => {
                setFormError('');
                setSelectedLevel3(value);
                syncProcessingActorTabForSelection(
                  value ? (statusById.get(String(value)) || null) : selectedLevel2Node,
                  value ? 'WORKER' : 'ASSIGNER'
                );
              }}
              label="Trạng thái xử lý"
              placeholder="Chọn trạng thái xử lý"
            />
          ) : null}

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
            <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày tạo task</label>
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
              placeholder={effectiveSupportGroupCustomerId ? 'Chọn nhóm Zalo/Tele' : 'Chọn phần mềm triển khai để tải nhóm'}
              searchPlaceholder="Tìm nhóm Zalo/Tele..."
              disabled={!effectiveSupportGroupCustomerId || isSupportGroupsLoading}
              searching={isSupportGroupsLoading}
              noOptionsText={supportGroupEmptyStateMessage}
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
        ) : null}

        {isProcessingLeafStatus ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {processingDateField ? renderFieldInput(processingDateField) : null}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  {processingHoursField?.field_label || 'Số giờ dự kiến xử lý'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={processingHoursValue}
                  onChange={(event) => setWorkflowFieldValue(processingHoursFieldKey, 'processing_hours_estimated', event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
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

              {plannedCompletionDateField ? renderFieldInput(plannedCompletionDateField) : (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày hoàn thành dự kiến</label>
                  <input
                    type="date"
                    value={plannedCompletionFallbackValue}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, planned_completion_date: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>

            {processingWorklogField ? renderFieldInput(processingWorklogField) : null}
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
        </div>
      )}

      {hasRemainingDynamicWorkflowFields ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {remainingDynamicWorkflowFields.map((field) => renderFieldInput(field))}
        </div>
      ) : null}

      {exchangeDateConstraintMessage !== '' ? (
        <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{exchangeDateConstraintMessage}</div>
      ) : null}
    </section>
    );
  };

  const renderReadonlyMetadataValue = (label: string, value: string) => (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900">
        {normalizeText(value) || '--'}
      </div>
    </div>
  );

  const renderReadonlyLongTextValue = (label: string, value: string) => (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="min-h-[92px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900">
        {normalizeText(value) || '--'}
      </div>
    </div>
  );

  const renderWaitingCustomerFeedbackSection = (isEditable: boolean) => (
    renderStageShell(
      isEditable,
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày giao việc</label>
            <input
              type="date"
              value={assignedDateValue}
              onChange={(event) => setWorkflowFieldValue('assigned_date', 'assigned_date', event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Ngày trao đổi lại với khách hàng {isSameWaitingCustomerFeedbackActor ? <span className="text-red-500">*</span> : null}
            </label>
            <input
              type="date"
              value={waitingCustomerExchangeDateValue}
              onChange={(event) => setWorkflowFieldValue(exchangeDateFieldKey, 'exchange_date', event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Nội dung trao đổi {isSameWaitingCustomerFeedbackActor ? <span className="text-red-500">*</span> : null}
              </label>
              {exchangeContentInlineError ? (
                <span className="text-xs font-medium text-rose-600">{exchangeContentInlineError}</span>
              ) : null}
            </div>
            <textarea
              value={waitingCustomerExchangeContentValue}
              onChange={(event) => setWorkflowFieldValue(exchangeContentFieldKey, 'exchange_content', event.target.value)}
              rows={3}
              className={[
                'w-full rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2',
                exchangeContentInlineError
                  ? 'border border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                  : 'border border-slate-300 focus:border-primary focus:ring-primary/20',
              ].join(' ')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Ngày khách hàng phản hồi {isSameWaitingCustomerFeedbackActor ? <span className="text-red-500">*</span> : null}
            </label>
            <input
              type="date"
              value={waitingCustomerFeedbackDateValue}
              onChange={(event) => handleWaitingCustomerFeedbackDateChange(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Nội dung khách hàng phản hồi {isSameWaitingCustomerFeedbackActor ? <span className="text-red-500">*</span> : null}
              </label>
              {customerFeedbackContentInlineError ? (
                <span className="text-xs font-medium text-rose-600">{customerFeedbackContentInlineError}</span>
              ) : null}
            </div>
            <textarea
              value={waitingCustomerFeedbackContentValue}
              onChange={(event) => setWorkflowFieldValue(customerFeedbackContentFieldKey, 'customer_feedback_content', event.target.value)}
              rows={3}
              className={[
                'w-full rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2',
                customerFeedbackContentInlineError
                  ? 'border border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                  : 'border border-slate-300 focus:border-primary focus:ring-primary/20',
              ].join(' ')}
            />
          </div>
        </div>

        {exchangeDateConstraintMessage !== '' ? (
          <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{exchangeDateConstraintMessage}</div>
        ) : null}
      </section>,
    )
  );

  const renderWaitingCustomerFeedbackReferenceCard = () => (
    hasWaitingCustomerFeedbackReferenceData ? (
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:p-5">
        <div className="mb-3">
          <h5 className="text-sm font-semibold text-slate-800">Tham chiếu trao đổi với khách hàng</h5>
          <p className="mt-1 text-xs text-slate-500">Thông tin này được giữ lại từ luồng Đợi phản hồi từ khách hàng để tiện tra cứu.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {renderReadonlyMetadataValue('Ngày giao việc', toDisplayDate(assignedDateValue))}
          {renderReadonlyMetadataValue('Ngày trao đổi lại với khách hàng', toDisplayDate(waitingCustomerExchangeDateValue))}
          {renderReadonlyMetadataValue('Ngày khách hàng phản hồi', toDisplayDate(waitingCustomerFeedbackDateValue))}
          {renderReadonlyLongTextValue('Nội dung trao đổi', waitingCustomerExchangeContentValue)}
          {renderReadonlyLongTextValue('Nội dung khách hàng phản hồi', waitingCustomerFeedbackContentValue)}
        </div>
      </section>
    ) : null
  );

  const processingActorTabs = useMemo(() => ([
    {
      key: 'CREATOR' as ProcessingActorTab,
      label: 'Tiếp nhận',
    },
    {
      key: 'ASSIGNER' as ProcessingActorTab,
      label: 'Nhận việc',
    },
    {
      key: 'WORKER' as ProcessingActorTab,
      label: 'Xử lý',
    },
  ]), []);
  const visibleProcessingActorTabs = useMemo(
    () => processingActorTabs,
    [processingActorTabs]
  );
  const currentWorkflowStageTab = useMemo<ProcessingActorTab>(() => {
    if (formMode === 'create') {
      return 'CREATOR';
    }

    const selectedWorkflowNode = selectedLevel3Node || selectedLevel2Node || selectedLevel1Node;
    if (selectedWorkflowNode) {
      return resolveProcessingActorTabFromStatusNode(
        selectedWorkflowNode,
        selectedLevel3 !== '' ? 'WORKER' : 'ASSIGNER'
      );
    }

    if (
      normalizeText(formValues.assignee_id) !== ''
      || isProcessingLeafStatus
      || isProgrammingInProgressLeafStatus
      || isProgrammingUpcodeLeafStatus
      || isProgrammingPausedLeafStatus
      || isProgrammingDmsExchangeLeafStatus
      || isProgrammingDmsCreateTaskLeafStatus
      || isProgrammingDmsPausedLeafStatus
      || isProgrammingDmsCompletedLeafStatus
      || isSupportCompletedLeafStatus
      || isNotExecuteLeafStatus
      || isNotifyCustomerLeafStatus
      || isReturnToManagerLeafStatus
      || isProgrammingCompletedLeafStatus
    ) {
      return 'WORKER';
    }

    if (
      normalizeText(formValues.receiver_user_id) !== ''
      || normalizeText(selectedLevel1) !== ''
      || normalizeText(selectedLevel2) !== ''
    ) {
      return 'ASSIGNER';
    }

    return 'CREATOR';
  }, [
    formMode,
    formValues.assignee_id,
    formValues.receiver_user_id,
    isNotExecuteLeafStatus,
    isNotifyCustomerLeafStatus,
    isProcessingLeafStatus,
    isProgrammingCompletedLeafStatus,
    isProgrammingDmsCompletedLeafStatus,
    isProgrammingDmsCreateTaskLeafStatus,
    isProgrammingDmsExchangeLeafStatus,
    isProgrammingDmsPausedLeafStatus,
    isProgrammingInProgressLeafStatus,
    isProgrammingPausedLeafStatus,
    isProgrammingUpcodeLeafStatus,
    isReturnToManagerLeafStatus,
    isSupportCompletedLeafStatus,
    selectedLevel1,
    selectedLevel1Node,
    selectedLevel2,
    selectedLevel2Node,
    selectedLevel3,
    selectedLevel3Node,
    resolveProcessingActorTabFromStatusNode,
  ]);

  const canEditIntakeStage = formMode === 'create'
    || isAdminViewer
    || normalizeText(editingRow?.created_by) === normalizedCurrentUserId
    || effectiveViewerExecutionRole === 'INITIAL_RECEIVER';
  const canEditAssignmentStage = formMode === 'create'
    || isAdminViewer
    || isAssignerExecutionView;
  const canEditExecutionStage = formMode === 'create'
    || isAdminViewer
    || effectiveViewerExecutionRole === 'WORKER'
    || effectiveViewerIsExecutor;
  const isCurrentUserProcessingAssignee = formMode === 'edit'
    && normalizedCurrentUserId !== ''
    && normalizeText(formValues.assignee_id) === normalizedCurrentUserId;
  const shouldShowAcceptExecutionButton = isCurrentUserProcessingAssignee
    && processingActorTab === 'ASSIGNER'
    && canEditExecutionStage;

  const renderStageShell = (isEditable: boolean, content: React.ReactNode) => (
    <fieldset
      disabled={!isEditable}
      className={!isEditable ? 'space-y-4 pointer-events-none opacity-75' : 'space-y-4'}
    >
      {content}
    </fieldset>
  );

  const handleProcessingActorTabChange = (nextTab: ProcessingActorTab) => {
    if (nextTab === processingActorTab) {
      return;
    }

    if (formMode === 'create' && processingActorTab === 'CREATOR' && nextTab !== 'CREATOR') {
      const confirmed = window.confirm(
        'Yêu cầu chưa được lưu. Bạn có muốn tiếp tục sang bước tiếp theo để nhập trước thông tin nhận việc/xử lý không?'
      );
      if (!confirmed) {
        return;
      }
    }

    setProcessingActorTab(nextTab);
  };

  const syncProcessingActorTabForSelection = (
    node: WorkflowStatusCatalog | null | undefined,
    fallback: ProcessingActorTab,
  ) => {
    setProcessingActorTab(resolveProcessingActorTabFromStatusNode(node, fallback));
  };

  const renderProcessingActorTabs = () => {
    const canEditByStage: Record<ProcessingActorTab, boolean> = {
      CREATOR: canEditIntakeStage,
      ASSIGNER: canEditAssignmentStage,
      WORKER: canEditExecutionStage,
    };
    const currentStageIndex = Math.max(
      0,
      visibleProcessingActorTabs.findIndex((tab) => tab.key === currentWorkflowStageTab)
    );

    return (
      <div
        className="flex w-full items-start overflow-x-auto"
        role="tablist"
        aria-label="Các bước xử lý yêu cầu khách hàng"
      >
        {visibleProcessingActorTabs.map((tab, index) => {
          const isActive = processingActorTab === tab.key;
          const isCurrentStage = currentWorkflowStageTab === tab.key;
          const canEdit = canEditByStage[tab.key];
          const isCompleted = index < currentStageIndex && !isActive;
          const isReferenceStage = isCurrentStage && !isActive;
          const isReadOnly = !canEdit && formMode !== 'create';
          const displayStepNumber = index + 1;

          const connector = index > 0 ? (
            <div
              key={`connector-${tab.key}`}
              className={[
                'mt-3 h-0.5 min-w-[18px] flex-1',
                index <= currentStageIndex
                  ? (isCompleted ? 'bg-emerald-300' : 'bg-primary/40')
                  : 'bg-slate-200',
              ].join(' ')}
              aria-hidden="true"
            />
          ) : null;

          const circleClasses = [
            'relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 shrink-0',
            isActive
              ? 'bg-primary text-white shadow-md shadow-primary/30 ring-4 ring-primary/15'
              : isCompleted
                ? 'border-2 border-emerald-400 bg-emerald-50 text-emerald-600'
                : isReferenceStage
                  ? 'border-2 border-primary/45 bg-primary/5 text-primary'
                : 'border-2 border-slate-300 bg-white text-slate-500 hover:border-primary/50 hover:text-primary',
          ].join(' ');

          const circleContent = isCompleted
            ? <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>
            : <span>{displayStepNumber}</span>;

          const labelClasses = [
            'mt-1 text-[11px] font-semibold text-center transition-colors duration-200 whitespace-nowrap',
            isActive
              ? 'text-primary'
              : isCompleted
                ? 'text-emerald-600'
                : isReferenceStage
                  ? 'text-primary/80'
                : 'text-slate-500',
          ].join(' ');

          const ariaLabel = [
            `Bước ${displayStepNumber}: ${tab.label}`,
            isActive ? '— Đang chọn' : '',
            isCurrentStage ? '— Bước theo trạng thái hiện tại' : '',
            isCompleted ? '— Đã hoàn tất' : '',
            isReadOnly ? '— Chỉ xem' : '',
          ].filter(Boolean).join(' ');

          return (
            <React.Fragment key={tab.key}>
              {connector}
              <button
                type="button"
                id={`customer-request-processing-tab-${tab.key.toLowerCase()}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`customer-request-processing-panel-${tab.key.toLowerCase()}`}
                aria-label={ariaLabel}
                onClick={() => handleProcessingActorTabChange(tab.key)}
                className={[
                  'flex min-w-[78px] flex-col items-center rounded-lg px-1 py-0.5 transition-colors duration-150',
                  'cursor-pointer',
                  isActive ? 'bg-primary/5' : 'hover:bg-slate-50',
                  isReadOnly ? 'opacity-85' : '',
                ].join(' ')}
              >
                <div className={circleClasses}>
                  {circleContent}
                </div>
                <span className={labelClasses}>{tab.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderWorkflowRoutingSection = () => (
    showWorkflowLevel1Selector ? (
      renderStageShell(
        canEditAssignmentStage,
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SearchableSelect
              value={selectedLevel1}
              options={level1Options}
              onChange={(value) => {
                setFormError('');
                setSelectedLevel1(value);
                setSelectedLevel2('');
                setSelectedLevel3('');
                syncProcessingActorTabForSelection(
                  value ? (statusById.get(String(value)) || null) : null,
                  formMode === 'create' ? 'CREATOR' : 'ASSIGNER'
                );
              }}
              label="Luồng xử lý"
              placeholder="Chọn luồng xử lý"
            />
          </div>
        </section>
      )
    ) : null
  );

  const renderIntakeStageSection = () => renderStageShell(
    canEditIntakeStage,
    renderMainBusinessSection({
      showWorkflowSelector: false,
      showPrioritySelector: true,
      showRequestedDateField: true,
    })
  );

  const renderAssignmentOwnerSection = () => renderStageShell(
    canEditAssignmentStage,
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className={isWaitingCustomerFeedbackStatus ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
        {renderReadonlyMetadataValue('Ngày tiếp nhận', toDisplayDate(formValues.requested_date))}
        {!isWaitingCustomerFeedbackStatus ? (
          <SearchableSelect
            value={formValues.assignee_id}
            options={employeeOptions}
            onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
            onDisabledInteract={
              isProjectItemMissing
                ? () => {
                    setAttemptedAssigneeBeforeProjectItem(true);
                  }
                : undefined
            }
            label="Người xử lý"
            placeholder={isProjectItemMissing ? 'Chọn phần mềm triển khai trước' : 'Chọn người xử lý'}
            searchPlaceholder="Tìm người xử lý..."
            usePortal
            disabled={isAssigneeSelectionDisabled}
            error={assigneeFieldError}
          />
        ) : null}
      </div>
    </section>
  );

  const renderAssignmentPlanningSection = () => {
    if (shouldRenderAnalysisPhaseFields) {
      return renderStageShell(
        canEditAssignmentStage,
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          {renderAnalysisPhaseFields(showWorkflowLevel2Selector, false)}
        </section>,
      );
    }

    if (!showWorkflowLevel2Selector) {
      return null;
    }

    return renderStageShell(
      canEditAssignmentStage,
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <SearchableSelect
            value={selectedLevel2}
            options={level2Options}
            onChange={(value) => {
              setFormError('');
              setSelectedLevel2(value);
              setSelectedLevel3('');
            }}
            label="Hướng xử lý"
            placeholder="Chọn hướng xử lý"
          />
        </div>
      </section>
    );
  };

  const renderExecutionAssigneeContext = () => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="grid gap-3 md:grid-cols-2">
        {renderReadonlyMetadataValue('Ngày tiếp nhận', toDisplayDate(formValues.requested_date))}
        {renderReadonlyMetadataValue(
          'Người xử lý',
          normalizeText(formValues.assignee_id) === '' ? '--' : resolveActorDisplayLabel(formValues.assignee_id),
        )}
      </div>
    </section>
  );

  const renderExecutionStatusSection = () => {
    if (shouldRenderAnalysisPhaseFields) {
      const analysisExecutionSelectors = renderAnalysisPathSelectors(false, showWorkflowLevel3Selector);
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          {analysisExecutionSelectors ? (
            renderStageShell(canEditExecutionStage, analysisExecutionSelectors)
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {selectedLevel2 === ''
                ? 'Hoàn tất Hướng xử lý ở tab Nhận việc để tiếp tục bước Xử lý.'
                : 'Trạng thái xử lý sẽ khả dụng khi điều kiện thực thi phù hợp.'}
            </div>
          )}
        </section>
      );
    }

    return renderStageShell(
      canEditExecutionStage,
      renderWorkflowSection({ showLevel2Selector: false, showLevel3Selector: showWorkflowLevel3Selector }),
    );
  };

  const renderModalStageContent = () => {
    if (processingActorTab === 'CREATOR') {
      return (
        <>
          {renderIntakeStageSection()}
          {renderStageShell(canEditIntakeStage, renderTaskManagementSection())}
        </>
      );
    }

    if (processingActorTab === 'ASSIGNER') {
      return (
        <>
          {renderWorkflowRoutingSection()}
          {isWaitingCustomerFeedbackStatus ? renderWaitingCustomerFeedbackSection(canEditAssignmentStage) : renderWaitingCustomerFeedbackReferenceCard()}
          {renderAssignmentOwnerSection()}
          {renderAssignmentPlanningSection()}
          {renderStageShell(canEditAssignmentStage, renderTaskManagementSection())}
        </>
      );
    }

    return (
      <>
        {renderExecutionAssigneeContext()}
        {renderWaitingCustomerFeedbackReferenceCard()}
        {renderExecutionStatusSection()}
      </>
    );
  };

  const renderReceiverAsideSection = () => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-primary">person_check</span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Người giao việc [A]</h4>
        </div>
      </div>
      {renderStageShell(
        canEditAssignmentStage,
        <SearchableSelect
          value={formValues.receiver_user_id}
          options={receiverOptions}
          onChange={(value) => setFormValues((prev) => ({ ...prev, receiver_user_id: value }))}
          onDisabledInteract={
            isProjectItemMissing
              ? () => {
                  setAttemptedReceiverBeforeProjectItem(true);
                }
              : undefined
          }
          label="Người giao việc [A]"
          placeholder={
            isProjectItemMissing
              ? 'Chọn phần mềm triển khai trước'
              : isReceiverLoading
                ? 'Đang tải người giao việc...'
                : 'Chọn người giao việc [A]'
          }
          searchPlaceholder="Tìm người giao việc..."
          searching={isReceiverLoading}
          disabled={isReceiverSelectionDisabled}
          usePortal
          error={receiverFieldError}
        />,
      )}
      {isWaitingCustomerFeedbackStatus ? (
        <div className="mt-3">
          {renderStageShell(
            canEditAssignmentStage,
            <SearchableSelect
              value={formValues.assignee_id}
              options={employeeOptions}
              onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
              onDisabledInteract={
                isProjectItemMissing
                  ? () => {
                      setAttemptedAssigneeBeforeProjectItem(true);
                    }
                  : undefined
              }
              label="Người xử lý"
              placeholder={isProjectItemMissing ? 'Chọn phần mềm triển khai trước' : 'Chọn người xử lý'}
              searchPlaceholder="Tìm người xử lý..."
              usePortal
              disabled={isAssigneeSelectionDisabled}
              error={assigneeFieldError}
            />,
          )}
        </div>
      ) : null}
    </section>
  );

  const renderMetadataAside = () => (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      {renderReceiverAsideSection()}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-primary">history</span>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Lịch sử cập nhật</h4>
          </div>
        </div>

        <div className="grid gap-3">
          {renderAuditField('Người tạo', metadataCreatedByLabel)}
          {renderAuditField('Ngày tạo', toDisplayDateTimeShort(metadataCreatedAtValue), metadataCreatedAtValue ? 'normal' : 'muted')}
          {renderAuditField('Người cập nhật', metadataUpdatedByLabel, metadataUpdatedByLabel === '--' ? 'muted' : 'normal')}
          {renderAuditField('Ngày cập nhật', toDisplayDateTimeShort(metadataUpdatedAtValue), metadataUpdatedAtValue ? 'normal' : 'muted')}
        </div>
      </section>
    </aside>
  );

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

      <section className="mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 md:text-lg">Báo cáo workflow</h3>
              <p className="mt-1 text-sm text-slate-500">
                Tổng hợp transition, SLA và notification theo bộ lọc đang áp dụng trên màn hình. Nhấn vào từng dòng để drill-down danh sách bên dưới.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <span className="material-symbols-outlined text-base text-primary">{dashboardAudience.icon}</span>
                <span>{dashboardAudience.badge}</span>
                <span className="text-slate-400">•</span>
                <span>{dashboardAudience.title}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{dashboardAudience.description}</p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="text-xs text-slate-500">
                Cập nhật:
                {' '}
                <span className="font-semibold text-slate-700">
                  {dashboardSummary?.generated_at ? toDisplayDateTimeShort(dashboardSummary.generated_at) : '--'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDashboardExport}
                disabled={!canExportRequests || isDashboardExporting}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">{isDashboardExporting ? 'progress_activity' : 'download'}</span>
                <span>{isDashboardExporting ? 'Đang xuất...' : 'Xuất báo cáo'}</span>
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 lg:grid-cols-[180px_180px_auto_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Từ ngày</span>
                <input
                  type="date"
                  value={dashboardDateFromInput}
                  onChange={(event) => setDashboardDateFromInput(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={dashboardDateToInput}
                  onChange={(event) => setDashboardDateToInput(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <button
                type="button"
                onClick={applyDashboardDateFilters}
                className="h-10 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Áp dụng thời gian
              </button>
              <button
                type="button"
                onClick={clearDashboardDateFilters}
                className="h-10 self-end rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Xóa lọc thời gian
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {dashboardError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {dashboardError}
              </div>
            ) : isDashboardLoading && !dashboardSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div key={`dashboard-metric-skeleton-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {[0, 1, 2].map((index) => (
                    <div key={`dashboard-panel-skeleton-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                      <div className="mt-4 space-y-3">
                        {[0, 1, 2].map((rowIndex) => (
                          <div key={`dashboard-panel-skeleton-${index}-${rowIndex}`} className="flex items-center justify-between gap-3">
                            <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                            <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : dashboardSummary ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transition</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatDashboardMetricValue(dashboardSummary.summary.totals.transition_count)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">SLA Theo dõi</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatDashboardMetricValue(dashboardSummary.summary.sla.tracked_count)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">SLA Quá hạn</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatDashboardMetricValue(dashboardSummary.summary.sla.breached_count)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Notify Resolved</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatDashboardMetricValue(dashboardSummary.summary.notifications.resolved_count)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Notify Skipped</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatDashboardMetricValue(dashboardSummary.summary.notifications.skipped_count)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Stack SLA</h4>
                        <p className="mt-1 text-xs text-slate-500">Tỷ trọng đúng hạn và quá hạn trong tập transition đang xem.</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {formatDashboardMetricValue(dashboardSummary.summary.sla.tracked_count)} theo dõi
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="flex h-full w-full">
                        {dashboardSlaSegments.map((segment) => (
                          <div
                            key={segment.key}
                            className={segment.className}
                            style={{ width: `${segment.widthPercent}%` }}
                            title={`${segment.label}: ${formatDashboardMetricValue(segment.value)}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {dashboardSlaSegments.map((segment) => (
                        <div key={`sla-legend-${segment.key}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <span className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />
                            <span>{segment.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{formatDashboardMetricValue(segment.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Stack Notification</h4>
                        <p className="mt-1 text-xs text-slate-500">Tỷ trọng notification resolve được và bị bỏ qua theo transition.</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {formatDashboardMetricValue(dashboardSummary.summary.notifications.total_logs)} log
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="flex h-full w-full">
                        {dashboardNotificationSegments.map((segment) => (
                          <div
                            key={segment.key}
                            className={segment.className}
                            style={{ width: `${segment.widthPercent}%` }}
                            title={`${segment.label}: ${formatDashboardMetricValue(segment.value)}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {dashboardNotificationSegments.map((segment) => (
                        <div key={`notification-legend-${segment.key}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <span className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />
                            <span>{segment.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{formatDashboardMetricValue(segment.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">{isAdminViewer ? 'Theo hành động' : 'Action ưu tiên'}</h4>
                      <span className="text-xs text-slate-400">Top 4</span>
                    </div>
                    <div className="space-y-3">
                      {dashboardTopActions.length > 0 ? (
                        dashboardTopActions.map((item) => (
                          <div
                            key={`dashboard-action-${item.workflow_action_code}`}
                            className="flex items-start gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5"
                          >
                            <button
                              type="button"
                              onClick={() => applyDashboardDrilldown({
                                workflow_action_code: item.workflow_action_code,
                                workflow_action_label: `Hành động: ${item.action_name || item.workflow_action_code || '--'}`,
                              })}
                              className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {item.action_name || item.workflow_action_code || '--'}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  SLA breach {formatDashboardMetricValue(item.sla_breached_count)}
                                  {' • '}
                                  Notify resolved {formatDashboardMetricValue(item.notification_resolved)}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {formatDashboardMetricValue(item.transition_count)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void openDashboardHistory({
                                  workflow_action_code: item.workflow_action_code,
                                  workflow_action_label: `Hành động: ${item.action_name || item.workflow_action_code || '--'}`,
                                });
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/30 hover:text-primary"
                              title="Xem nhật ký"
                            >
                              <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Chưa có dữ liệu theo hành động.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">{isAdminViewer ? 'Theo nhóm hỗ trợ' : 'Điểm nóng theo nhóm hỗ trợ'}</h4>
                      <span className="text-xs text-slate-400">Top 4</span>
                    </div>
                    <div className="space-y-3">
                      {dashboardTopServiceGroups.length > 0 ? (
                        dashboardTopServiceGroups.map((item) => (
                          <div
                            key={`dashboard-service-group-${String(item.service_group_id || 'none')}`}
                            className="flex items-start gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (item.service_group_id === null || item.service_group_id === undefined || `${item.service_group_id}`.trim() === '') {
                                  return;
                                }
                                applyDashboardDrilldown({
                                  service_group_id: item.service_group_id,
                                  service_group_label: `Nhóm hỗ trợ: ${item.service_group_name || '--'}`,
                                });
                              }}
                              disabled={item.service_group_id === null || item.service_group_id === undefined || `${item.service_group_id}`.trim() === ''}
                              className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left disabled:cursor-default disabled:opacity-70"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {item.service_group_name || 'Chưa gắn nhóm hỗ trợ'}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  SLA tracked {formatDashboardMetricValue(item.sla_tracked_count)}
                                  {' • '}
                                  Notify total {formatDashboardMetricValue(item.notification_total)}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {formatDashboardMetricValue(item.transition_count)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.service_group_id === null || item.service_group_id === undefined || `${item.service_group_id}`.trim() === '') {
                                  return;
                                }
                                void openDashboardHistory({
                                  service_group_id: item.service_group_id,
                                  service_group_label: `Nhóm hỗ trợ: ${item.service_group_name || '--'}`,
                                });
                              }}
                              disabled={item.service_group_id === null || item.service_group_id === undefined || `${item.service_group_id}`.trim() === ''}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-default disabled:opacity-60"
                              title="Xem nhật ký"
                            >
                              <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Chưa có dữ liệu theo nhóm hỗ trợ.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">{isAdminViewer ? 'Theo trạng thái đích' : 'Trạng thái đích cần theo dõi'}</h4>
                      <span className="text-xs text-slate-400">Top 4</span>
                    </div>
                    <div className="space-y-3">
                      {dashboardTopTargetStatuses.length > 0 ? (
                        dashboardTopTargetStatuses.map((item) => (
                          <div
                            key={`dashboard-target-status-${String(item.to_status_catalog_id || 'none')}`}
                            className="flex items-start gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (item.to_status_catalog_id === null || item.to_status_catalog_id === undefined || `${item.to_status_catalog_id}`.trim() === '') {
                                  return;
                                }
                                applyDashboardDrilldown({
                                  to_status_catalog_id: item.to_status_catalog_id,
                                  to_status_catalog_label: `Trạng thái đích: ${item.to_status_name || '--'}`,
                                });
                              }}
                              disabled={item.to_status_catalog_id === null || item.to_status_catalog_id === undefined || `${item.to_status_catalog_id}`.trim() === ''}
                              className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left disabled:cursor-default disabled:opacity-70"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {item.to_status_name || 'Chưa xác định'}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  On-time {formatDashboardMetricValue(item.sla_on_time_count)}
                                  {' • '}
                                  Notify skipped {formatDashboardMetricValue(item.notification_skipped)}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {formatDashboardMetricValue(item.transition_count)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.to_status_catalog_id === null || item.to_status_catalog_id === undefined || `${item.to_status_catalog_id}`.trim() === '') {
                                  return;
                                }
                                void openDashboardHistory({
                                  to_status_catalog_id: item.to_status_catalog_id,
                                  to_status_catalog_label: `Trạng thái đích: ${item.to_status_name || '--'}`,
                                });
                              }}
                              disabled={item.to_status_catalog_id === null || item.to_status_catalog_id === undefined || `${item.to_status_catalog_id}`.trim() === ''}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-default disabled:opacity-60"
                              title="Xem nhật ký"
                            >
                              <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Chưa có dữ liệu theo trạng thái đích.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Chưa có dữ liệu báo cáo workflow.</p>
            )}
          </div>
        </div>
      </section>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {dashboardDrilldownChips.length > 0 ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-slate-500">Đang drill-down theo nhiều điều kiện. Bảng bên dưới lọc theo trạng thái mới nhất của yêu cầu.</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {dashboardDrilldownChips.map((chip) => (
                  <span
                    key={`dashboard-drilldown-chip-${chip.key}`}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={() => clearDashboardDrilldownKey(chip.key)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
                      aria-label={`Bỏ điều kiện ${chip.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => applyDashboardDrilldown(null)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Bỏ drill-down
            </button>
          </div>
        ) : null}

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

      {historyViewMode ? (
      <div
        ref={historySectionRef}
        className="mt-6 md:mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fade-in"
        style={{ animationDelay: '0.25s' }}
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 md:text-lg">Nhật ký thay đổi</h3>
            {historyViewMode === 'request' && historyTarget ? (
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
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-slate-500">
                  Đang hiển thị nhật ký theo drill-through từ block báo cáo workflow.
                </p>
                {dashboardHistoryChips.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {dashboardHistoryChips.map((chip) => (
                      <span
                        key={`history-dashboard-chip-${chip.key}`}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <button
              type="button"
              onClick={clearHistoryFocus}
              className="h-10 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {historyViewMode === 'request' ? 'Bỏ lọc yêu cầu' : 'Bỏ drill-through nhật ký'}
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
                    const transitionBodyText = normalizeText(transition.bodyTextDisplay);

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

                          <div className="mt-2 flex flex-wrap items-start justify-end gap-2 text-xs text-slate-500">
                            <span className="text-right">
                              Người cập nhật:
                              {' '}
                              <span className="font-medium text-slate-700">{transition.entry.actor_name || 'Hệ thống'}</span>
                            </span>
                          </div>
                          {isPausedTransition ? (
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              {transitionBodyText !== '' ? (
                                <p>{transitionBodyText}</p>
                              ) : null}
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
                              {transitionBodyText !== '' ? (
                                <p>{transitionBodyText}</p>
                              ) : null}
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
                          ) : transitionBodyText !== '' ? (
                            <p className="mt-2 text-sm text-slate-600">{transitionBodyText}</p>
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
                                    <span className="text-right">
                                      Người cập nhật:
                                      {' '}
                                      <span className="font-medium text-slate-700">{child.entry.actor_name || 'Hệ thống'}</span>
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-slate-700">{child.entry.request_summary || '--'}</p>
                                  {child.bodyTextDisplay ? (
                                    <p className="mt-1 text-xs text-slate-500">{child.bodyTextDisplay}</p>
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
                            <span className="text-right">
                              Người cập nhật:
                              {' '}
                              <span className="font-medium text-slate-700">{item.entry.actor_name || 'Hệ thống'}</span>
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-700">{item.entry.request_summary || '--'}</p>
                          {item.bodyTextDisplay ? <p className="mt-1 text-xs text-slate-500">{item.bodyTextDisplay}</p> : null}
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
            className="max-h-[90vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
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

              {/* ── Stepper header (nối liền với content bên dưới) ── */}
              <section className="rounded-t-2xl border-x border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 pt-2.5 pb-1.5 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-primary">route</span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Tiến trình xử lý</h4>
                  </div>
                </div>
                {renderProcessingActorTabs()}
              </section>

              <div className="-mt-4 grid gap-5 xl:grid-cols-[minmax(0,2fr)_380px]">
                <div className="space-y-4 min-w-0">
                  {/* ── Tab content panel (nối liền bottom với stepper) ── */}
                  <div
                    id={`customer-request-processing-panel-${processingActorTab.toLowerCase()}`}
                    role="tabpanel"
                    aria-labelledby={`customer-request-processing-tab-${processingActorTab.toLowerCase()}`}
                    key={processingActorTab}
                    className="space-y-4 animate-fade-in"
                    style={{ animationDuration: '0.2s' }}
                  >
                    {renderModalStageContent()}
                  </div>
                  {renderSharedCollaborationSection()}

                  {formError ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</div> : null}
                </div>

                <div className="min-w-0">
                  {renderMetadataAside()}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeFormModal} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600">
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSave('close')}
                disabled={isSaving}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
              {shouldShowAcceptExecutionButton ? (
                <button
                  type="button"
                  onClick={() => void handleSave('accept_execution')}
                  disabled={isSaving}
                  className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Nhận việc'}
                </button>
              ) : null}
              {formMode === 'create' ? (
                <button
                  type="button"
                  onClick={() => void handleSave('continue_assignment')}
                  disabled={isSaving}
                  className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu và tiếp tục'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
