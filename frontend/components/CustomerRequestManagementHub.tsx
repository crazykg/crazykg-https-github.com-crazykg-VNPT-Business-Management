import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createYeuCau,
  createYeuCauEstimate,
  deleteYeuCau,
  saveYeuCauCaseAttachments,
  saveYeuCauCaseTags,
  saveYeuCauProcess,
  fetchCustomerRequestIntakeTemplate,
  fetchCustomerRequestProjectItems,
  fetchProjectRaciAssignments,
  fetchYeuCau,
  fetchYeuCauProcessCatalog,
  exportCustomerRequestIntake,
  importCustomerRequestIntake,
  isRequestCanceledError,
  storeYeuCauDetailStatusWorklog,
  storeYeuCauWorklog,
  updateYeuCauWorklog,
  uploadDocumentAttachment,
} from '../services/v5Api';
import { createCustomer, createCustomerPersonnel, fetchCustomerPersonnel, fetchCustomers } from '../services/api/customerApi';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  ProjectRaciRow,
  SupportContactPosition,
  SupportServiceGroup,
  Tag,
  YeuCau,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessCatalog,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauWorklog,
} from '../types';
import { useCustomerRequestList } from './customer-request/hooks/useCustomerRequestList';
import { useCustomerRequestDashboard } from './customer-request/hooks/useCustomerRequestDashboard';
import { useCustomerRequestDetail } from './customer-request/hooks/useCustomerRequestDetail';
import { useCustomerRequestCreatorWorkspace } from './customer-request/hooks/useCustomerRequestCreatorWorkspace';
import { useCustomerRequestDispatcherWorkspace } from './customer-request/hooks/useCustomerRequestDispatcherWorkspace';
import { useCustomerRequestOptimisticState } from './customer-request/hooks/useCustomerRequestOptimisticState';
import { useCustomerRequestPerformerWorkspace } from './customer-request/hooks/useCustomerRequestPerformerWorkspace';
import { useCustomerRequestTransition } from './customer-request/hooks/useCustomerRequestTransition';
import { useCustomerRequestSearch } from './customer-request/hooks/useCustomerRequestSearch';
import { useCustomerRequestResponsiveLayout } from './customer-request/hooks/useCustomerRequestResponsiveLayout';
import { useWorkflowDefinitions } from './customer-request/hooks/useWorkflowDefinitions';
import { CustomerRequestListPane } from './customer-request/CustomerRequestListPane';
import { CustomerRequestDetailPane } from './customer-request/CustomerRequestDetailPane';
import { CustomerRequestCreatorWorkspace } from './customer-request/CustomerRequestCreatorWorkspace';
import { CustomerRequestDispatcherWorkspace } from './customer-request/CustomerRequestDispatcherWorkspace';
import { CustomerRequestPerformerWorkspace } from './customer-request/CustomerRequestPerformerWorkspace';
import { CustomerRequestOverviewWorkspace } from './customer-request/CustomerRequestOverviewWorkspace';
import { CustomerRequestWorkspaceTabs } from './customer-request/CustomerRequestWorkspaceTabs';
import type { WorkspaceTabKey } from './customer-request/CustomerRequestWorkspaceTabs';
import { CustomerRequestSurfaceSwitch, type CustomerRequestSurfaceKey } from './customer-request/CustomerRequestSurfaceSwitch';
import { CustomerRequestDashboardCards } from './customer-request/CustomerRequestDashboardCards';
import { CustomerRequestDetailFrame } from './customer-request/CustomerRequestDetailFrame';
import { CustomerRequestTransitionModal } from './customer-request/CustomerRequestTransitionModal';
import { CustomerRequestCreateModal } from './customer-request/CustomerRequestCreateModal';
import {
  CustomerRequestEstimateModal,
  type CustomerRequestEstimateSubmission,
} from './customer-request/CustomerRequestEstimateModal';
import type { CustomerRequestCreateFlowDraft } from './customer-request/createFlow';
import {
  CustomerRequestWorklogModal,
  type CustomerRequestWorklogModalContext,
  type CustomerRequestWorklogSubmission,
} from './customer-request/CustomerRequestWorklogModal';
import {
  buildInitialCreateFlowDraft,
  resolveCreateRequestPlan,
} from './customer-request/createFlow';
import type {
  CustomerRequestPrimaryActionMeta,
  CustomerRequestRoleFilter,
  CustomerRequestTaskSource,
  DispatcherQuickAction,
  It360TaskFormRow,
  PerformerQuickAction,
  ReferenceTaskFormRow,
} from './customer-request/presentation';
import {
  filterXmlVisibleProcesses,
  isXmlVisibleProcessCode,
  resolveRequestProcessCode,
  resolveTransitionOptionsForRequest,
} from './customer-request/presentation';
import {
  applyHoursReportToRequest,
  buildOptimisticEstimateHoursReport,
  prependUniqueEstimate,
  prependUniqueWorklog,
} from './customer-request/hoursOptimistic';
import { buildPayloadFromDraft } from './customer-request/helpers';
import {
  buildDispatcherQuickActions,
  buildPerformerQuickActions,
} from './customer-request/quickActions';
import {
  DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS,
  type CustomerRequestQuickRequestItem,
  type CustomerRequestSavedView,
} from './customer-request/customerRequestQuickAccess';
import { useCustomerRequestQuickAccess } from './customer-request/hooks/useCustomerRequestQuickAccess';
import { CustomerFormModal, CusPersonnelFormModal, ImportModal } from './modals';
import type { ImportPayload } from './modals/projectImportTypes';
import ExcelJS from 'exceljs';
import {
  buildHeaderIndex,
  exportImportFailureFile,
  getImportCell,
} from '../utils/importValidation';
import { type SearchableSelectOption } from './SearchableSelect';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { apiFetch } from '../shared/api/apiFetch';
import type { CustomerRequestIntakeImportResult } from '../services/api/customerRequestApi';
import { normalizeImportToken } from '../utils/importUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions?: SupportContactPosition[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canReadRequests?: boolean;
  canWriteRequests?: boolean;
  canDeleteRequests?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
  onCustomersUpdated?: (customers: Customer[]) => void;
  onCustomerPersonnelUpdated?: (personnel: CustomerPersonnel[]) => void;
}

const formatCustomerRequestDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const buildDefaultCustomerRequestCreatedRange = (): { from: string; to: string } => {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: formatCustomerRequestDateInput(from),
    to: formatCustomerRequestDateInput(to),
  };
};

const buildCreatedFromFilterValue = (value: string): string | undefined =>
  value ? `${value} 00:00:00` : undefined;

const buildCreatedToFilterValue = (value: string): string | undefined =>
  value ? `${value} 23:59:59` : undefined;

const SHARED_PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: '1', label: 'Thấp' },
  { value: '2', label: 'Trung bình' },
  { value: '3', label: 'Cao' },
  { value: '4', label: 'Khẩn' },
];

type SharedSurfaceFilterState = {
  activeProcessCodes: string[];
  requestKeyword: string;
  requestEntityFilter: string[];
  requestTagFilter: string[];
  requestPriorityFilter: string[];
  requestCreatedFrom: string;
  requestCreatedTo: string;
  requestMissingEstimateFilter: boolean;
  requestOverEstimateFilter: boolean;
  requestSlaRiskFilter: boolean;
};

const normalizeCustomerRequestFilterToken = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const normalizeFilterValues = (values?: Array<string | number | null | undefined>): string[] =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? '').trim())
        .filter((value) => value.length > 0)
    )
  );

const buildNormalizedFilterCompareKey = (
  values?: Array<string | number | null | undefined> | ReadonlyArray<string | number | null | undefined>
): string => normalizeFilterValues(values ? Array.from(values) : undefined).slice().sort().join('|');

const parseCustomerRequestFilterTime = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const resolved = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(resolved.getTime()) ? null : resolved.getTime();
};

const isTruthyCustomerRequestFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value > 0;
  }

  return ['1', 'true', 'yes'].includes(normalizeCustomerRequestFilterToken(value));
};

const matchesSharedSurfaceFilters = (
  row: YeuCau,
  filters: SharedSurfaceFilterState
): boolean => {
  const raw = row as unknown as Record<string, unknown>;
  const processCode = normalizeCustomerRequestFilterToken(
    resolveRequestProcessCode(row) ||
      raw.current_status_code ||
      raw.process_code ||
      row.trang_thai
  );

  const normalizedProcessFilters = normalizeFilterValues(filters.activeProcessCodes).map(
    normalizeCustomerRequestFilterToken
  );
  if (
    normalizedProcessFilters.length > 0
    && !normalizedProcessFilters.includes(processCode)
  ) {
    return false;
  }

  if (filters.requestKeyword) {
    const haystack = normalizeCustomerRequestFilterToken(
      [
        row.ma_yc,
        row.request_code,
        row.tieu_de,
        row.summary,
        row.customer_name,
        row.khach_hang_name,
        raw.customer_name,
        raw.customer_code,
        row.project_name,
        row.product_name,
        row.support_service_group_name,
      ]
        .filter(Boolean)
        .join(' ')
    );

    if (!haystack.includes(normalizeCustomerRequestFilterToken(filters.requestKeyword))) {
      return false;
    }
  }

  const customerId = String(
    raw.customer_id ??
    raw.khach_hang_id ??
    raw.customerId ??
    raw.customerID ??
    ''
  );
  const projectItemId = String(raw.project_item_id ?? raw.projectItemId ?? '');
  const productId = String(raw.product_id ?? raw.productId ?? '');
  const supportGroupId = String(
    raw.support_service_group_id ??
    raw.supportGroupId ??
    raw.group_id ??
    raw.support_group_id ??
    ''
  );

  const normalizedEntityFilters = normalizeFilterValues(filters.requestEntityFilter);
  if (normalizedEntityFilters.length > 0) {
    const entityTokens = [
      customerId,
      projectItemId,
      productId,
      supportGroupId,
    ].filter((token) => token !== '');

    if (!normalizedEntityFilters.some((token) => entityTokens.includes(token))) {
      return false;
    }
  }

  const rowTags = (raw as { tags?: Array<{ id?: string | number | null }> }).tags;
  const rowTagIds = Array.isArray(rowTags)
    ? rowTags
      .map((tag: { id?: string | number | null }) => String(tag.id ?? ''))
      .filter((value: string) => value !== '')
    : [];
  const normalizedTagFilters = normalizeFilterValues(filters.requestTagFilter);
  if (
    normalizedTagFilters.length > 0
    && !normalizedTagFilters.some((tagId) => rowTagIds.includes(tagId))
  ) {
    return false;
  }

  const priorityValue = String(raw.do_uu_tien ?? raw.priority ?? row.do_uu_tien ?? '');
  const normalizedPriorityFilters = normalizeFilterValues(filters.requestPriorityFilter);
  if (
    normalizedPriorityFilters.length > 0
    && !normalizedPriorityFilters.includes(priorityValue)
  ) {
    return false;
  }

  const createdTime = parseCustomerRequestFilterTime(
    String(raw.created_at ?? raw.received_at ?? raw.updated_at ?? raw.createdAt ?? '')
  );
  const createdFromTime = parseCustomerRequestFilterTime(
    filters.requestCreatedFrom ? `${filters.requestCreatedFrom}T00:00:00` : null
  );
  const createdToTime = parseCustomerRequestFilterTime(
    filters.requestCreatedTo ? `${filters.requestCreatedTo}T23:59:59` : null
  );

  if (createdFromTime !== null && createdTime !== null && createdTime < createdFromTime) {
    return false;
  }

  if (createdToTime !== null && createdTime !== null && createdTime > createdToTime) {
    return false;
  }

  if (filters.requestMissingEstimateFilter && !isTruthyCustomerRequestFlag(raw.missing_estimate)) {
    return false;
  }

  if (filters.requestOverEstimateFilter && !isTruthyCustomerRequestFlag(raw.over_estimate)) {
    return false;
  }

  if (filters.requestSlaRiskFilter) {
    const slaStatus = normalizeCustomerRequestFilterToken(raw.sla_status);
    const hasSlaRisk =
      isTruthyCustomerRequestFlag(raw.sla_risk) ||
      (slaStatus !== '' &&
        !['on_time', 'within_sla', 'normal', 'safe'].includes(slaStatus));

    if (!hasSlaRisk) {
      return false;
    }
  }

  return true;
};

type InboxBucketKey =
  | 'hot'
  | 'missing_estimate'
  | 'waiting_pm'
  | 'sla_risk'
  | 'over_estimate'
  | 'mine'
  | 'following';

type InboxPriorityItem = {
  key: string;
  row: YeuCau;
  reasons: string[];
};

type InboxBucketMeta = {
  key: InboxBucketKey;
  label: string;
  count: number;
};

const uniqInboxItems = (items: InboxPriorityItem[]): InboxPriorityItem[] => {
  const seen = new Set<string>();
  const result: InboxPriorityItem[] = [];

  items.forEach((item) => {
    const id = String(item.row.id ?? item.key);
    if (!id || seen.has(id)) {
      return;
    }

    seen.add(id);
    result.push(item);
  });

  return result;
};

const resolveInboxRequestCode = (row: YeuCau): string =>
  row.ma_yc || row.request_code || String(row.id ?? '');

const resolveInboxTitle = (row: YeuCau): string =>
  row.tieu_de || row.summary || 'Yêu cầu không có tiêu đề';

const resolveInboxCustomer = (row: YeuCau): string =>
  row.khach_hang_name || row.customer_name || 'Chưa rõ khách hàng';

const resolveInboxOwner = (row: YeuCau): string =>
  row.nguoi_xu_ly_name
  || row.current_owner_name
  || row.performer_name
  || row.receiver_name
  || row.dispatcher_name
  || row.received_by_name
  || 'Chưa giao';

const resolveInboxStep = (row: YeuCau): string =>
  row.current_status_name_vi
  || row.current_process_label
  || row.tien_trinh_hien_tai
  || row.trang_thai
  || 'Chưa xác định';

const formatInboxTimestamp = (value?: string | null): string => {
  if (!value) {
    return 'Chưa cập nhật';
  }

  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const today = new Date();
  const isSameDay =
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();

  return isSameDay
    ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const resolveInboxSlaLabel = (row: YeuCau): string => {
  if (row.sla_status) {
    return row.sla_status;
  }

  if (row.warning_level) {
    return row.warning_level;
  }

  return row.sla_due_at ? 'Theo SLA' : 'Không SLA';
};

const matchesInboxBucket = (
  item: InboxPriorityItem,
  bucket: InboxBucketKey,
  currentUserId?: string | number | null
): boolean => {
  const row = item.row;
  const statusCode = resolveRequestProcessCode(row);
  const reasons = item.reasons.map((reason) => reason.toLowerCase());

  if (bucket === 'hot') {
    return item.reasons.length > 0 || row.warning_level === 'critical' || row.warning_level === 'high';
  }

  if (bucket === 'missing_estimate') {
    return Boolean(row.missing_estimate) || reasons.some((reason) => reason.includes('missing_estimate'));
  }

  if (bucket === 'waiting_pm') {
    return ['new_intake', 'pending_dispatch', 'returned_to_manager', 'returned_to_dispatcher'].includes(statusCode);
  }

  if (bucket === 'sla_risk') {
    return Boolean(row.sla_status) || reasons.some((reason) => reason.includes('sla'));
  }

  if (bucket === 'over_estimate') {
    return Boolean(row.over_estimate) || reasons.some((reason) => reason.includes('over_estimate'));
  }

  if (bucket === 'mine') {
    if (!currentUserId) {
      return false;
    }

    return [
      row.nguoi_xu_ly_id,
      row.current_owner_user_id,
      row.performer_user_id,
      row.receiver_user_id,
      row.dispatcher_user_id,
      row.nguoi_tao_id,
      row.created_by,
    ].some((id) => String(id ?? '') === String(currentUserId));
  }

  return ['waiting_customer_feedback', 'customer_notified', 'in_progress'].includes(statusCode);
};

const workspaceTabToRoleFilter = (
  tab: WorkspaceTabKey
): CustomerRequestRoleFilter => (tab === 'overview' ? '' : tab);

const CRC_INTAKE_HEADER_ALIASES: Record<string, string[]> = {
  import_row_code: ['import_row_code', 'importrowcode', 'ma_dong_import', 'madongimport'],
  customer_code: ['customer_code', 'customercode', 'ma_khach_hang', 'makhachhang'],
  project_item_code: [
    'project_item_code',
    'projectitemcode',
    'ma_hang_muc',
    'mahangmuc',
    'ma_hang_muc_du_an_san_pham',
    'mahangmucduansanpham',
  ],
  customer_personnel_code: [
    'customer_personnel_code',
    'customerpersonnelcode',
    'ma_nhan_su_lien_he',
    'manhansulienhe',
    'ma_nhan_su_lien_he_khach_hang',
    'manhansulienhekhachhang',
  ],
  support_service_group_code: ['support_service_group_code', 'supportservicegroupcode', 'ma_nhom_ho_tro', 'manhomhotro'],
  source_channel: ['source_channel', 'sourcechannel', 'kenh_tiep_nhan', 'kenhtiepnhan'],
  summary: ['summary', 'tieu_de', 'tieude', 'tieu_de_yeu_cau', 'tieudeyeucau'],
  description: ['description', 'mo_ta', 'mota', 'mo_ta_yeu_cau', 'motayeucau'],
  priority_label: ['priority_label', 'prioritylabel', 'do_uu_tien', 'douutien'],
  receiver_user_code: ['receiver_user_code', 'receiverusercode', 'nguoi_tiep_nhan', 'nguoitiepnhan', 'ma_nguoi_tiep_nhan', 'manguoitiepnhan'],
  creator_user_code: ['creator_user_code', 'creatorusercode', 'nguoi_tao', 'nguoitao', 'ma_nguoi_tao', 'manguoitao'],
};

const CRC_INTAKE_TASK_HEADER_ALIASES: Record<string, string[]> = {
  import_row_code: ['import_row_code', 'importrowcode', 'ma_dong_import', 'madongimport'],
  task_source: ['task_source', 'tasksource', 'nguon_task', 'nguontask'],
  task_code: ['task_code', 'taskcode', 'ma_task', 'matask'],
  task_link: ['task_link', 'tasklink', 'link_task', 'linktask'],
  task_status: ['task_status', 'taskstatus', 'trang_thai_task', 'trangthaitask'],
};

const CRC_INTAKE_HEADER_LABELS: Record<string, string> = {
  import_row_code: 'Mã dòng import',
  customer_code: 'Mã khách hàng',
  project_item_code: 'Mã hạng mục dự án/sản phẩm',
  customer_personnel_code: 'Mã nhân sự liên hệ khách hàng',
  support_service_group_code: 'Mã nhóm hỗ trợ',
  source_channel: 'Kênh tiếp nhận',
  summary: 'Tiêu đề yêu cầu',
  description: 'Mô tả yêu cầu',
  priority_label: 'Độ ưu tiên',
  receiver_user_code: 'Mã người tiếp nhận',
  creator_user_code: 'Mã người tạo',
};

const CRC_INTAKE_TASK_HEADER_LABELS: Record<string, string> = {
  import_row_code: 'Mã dòng import',
  task_source: 'Nguồn task',
  task_code: 'Mã task',
  task_link: 'Link task',
  task_status: 'Trạng thái task',
};

const mapHeaderToVietnamese = (header: string, dictionary: Record<string, string>): string =>
  dictionary[String(header || '').trim()] || header;

const buildAutoWidths = (headers: string[], min = 120, max = 420): number[] =>
  headers.map((header) => {
    const length = String(header || '').trim().length;
    return Math.min(max, Math.max(min, length * 9 + 36));
  });

const extractCodeFromDisplayValue = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  const parts = normalized.split(/\s[-–—]\s/, 2).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0]) {
    return parts[0];
  }

  return normalized;
};

const buildCrcIntakeImportItems = (payload: ImportPayload): Array<Record<string, unknown>> => {
  const mainHeaderIndex = buildHeaderIndex(payload.headers || []);
  const intakeRows = payload.rows || [];

  const allSheets = payload.sheets || [];
  const taskSheet = allSheets.find((sheet) => {
    const token = normalizeImportToken(sheet.name);
    return token.includes('yeucautasks') || token.includes('tasks');
  });

  const taskHeaderIndex = taskSheet ? buildHeaderIndex(taskSheet.headers || []) : new Map<string, number>();
  const taskRows = taskSheet?.rows || [];
  const tasksByRowCode = new Map<string, Array<Record<string, unknown>>>();

  taskRows.forEach((row) => {
    const rowCode = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.import_row_code);
    if (!rowCode) {
      return;
    }

    const taskCode = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_code);
    const taskLink = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_link);
    if (!taskCode && !taskLink) {
      return;
    }

    const task = {
      task_source: getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_source) || 'REFERENCE',
      task_code: taskCode || null,
      task_link: taskLink || null,
      task_status: getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_status) || 'TODO',
    };

    const current = tasksByRowCode.get(rowCode) || [];
    current.push(task);
    tasksByRowCode.set(rowCode, current);
  });

  const items: Array<Record<string, unknown>> = [];
  intakeRows.forEach((row, rowIndex) => {
    const mapped = {
      import_row_code: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.import_row_code) || `ROW_${rowIndex + 2}`,
      customer_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.customer_code)
      ) || null,
      project_item_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.project_item_code)
      ) || null,
      customer_personnel_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.customer_personnel_code)
      ) || null,
      support_service_group_code: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.support_service_group_code) || null,
      source_channel: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.source_channel) || null,
      summary: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.summary) || null,
      description: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.description) || null,
      priority_label: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.priority_label) || null,
      receiver_user_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.receiver_user_code)
      ) || null,
      creator_user_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.creator_user_code)
      ) || null,
    };

    const hasData = Object.entries(mapped).some(([key, value]) => key !== 'import_row_code' && !!String(value || '').trim());
    if (!hasData) {
      return;
    }

    const rowCode = String(mapped.import_row_code || '').trim();
    const refTasks = rowCode ? (tasksByRowCode.get(rowCode) || []) : [];

    items.push({
      ...mapped,
      ref_tasks: refTasks,
    });
  });

  return items;
};

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeWorksheetName = (value: string, fallback: string): string => {
  const sanitized = String(value || '')
    .replace(/[\\/?*:[\]]/g, ' ')
    .trim();
  if (!sanitized) {
    return fallback;
  }
  return sanitized.slice(0, 31);
};

const pxToExcelWidth = (px: number): number => {
  const normalized = Number.isFinite(px) ? Math.max(60, px) : 120;
  return Math.round((normalized / 7) * 100) / 100;
};

const setWorksheetColumns = (
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  widths: number[] = []
): void => {
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `col_${index + 1}`,
    width: pxToExcelWidth(widths[index] ?? 140),
  }));
};

const addDropdownValidation = (
  worksheet: ExcelJS.Worksheet,
  columnNumber: number,
  rangeFormula: string,
  rowStart: number,
  rowEnd: number
): void => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const cell = worksheet.getCell(row, columnNumber);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangeFormula],
      showErrorMessage: true,
      errorTitle: 'Giá trị không hợp lệ',
      error: 'Vui lòng chọn giá trị từ danh sách.',
    };
  }
};

const addDropdownValidationByRowFormula = (
  worksheet: ExcelJS.Worksheet,
  columnNumber: number,
  rowStart: number,
  rowEnd: number,
  resolveFormula: (row: number) => string
): void => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const cell = worksheet.getCell(row, columnNumber);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [resolveFormula(row)],
      showErrorMessage: true,
      errorTitle: 'Giá trị không hợp lệ',
      error: 'Vui lòng chọn giá trị từ danh sách.',
    };
  }
};

const sanitizeExcelNameKey = (value: string): string => {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
  const withPrefix = /^[A-Za-z_]/.test(normalized) ? normalized : `K_${normalized}`;
  return (withPrefix || 'K_EMPTY').slice(0, 120);
};

const quoteSheetName = (sheetName: string): string => `'${String(sheetName).replace(/'/g, "''")}'`;

const createCrcIntakeTemplateWorkbook = async (params: {
  fileNameBase: string;
  intakeSheetName: string;
  taskSheetName: string;
  viHeaders: string[];
  viTaskHeaders: string[];
  customerRows: readonly (readonly [string, string])[];
  projectItemRows: readonly (readonly [string, string])[];
  customerPersonnelRows: readonly (readonly [string, string])[];
  supportGroupRows: readonly (readonly [string, string])[];
  personnelRows: readonly (readonly [string, string, string])[];
  projectItemByCustomerCode: ReadonlyMap<string, readonly (readonly [string, string])[]>;
  customerPersonnelByCustomerCode: ReadonlyMap<string, readonly (readonly [string, string])[]>;
  sourceChannelRows: readonly string[];
  priorityRows: readonly string[];
  taskSources: readonly string[];
  taskStatuses: readonly string[];
  hasLookupData: boolean;
  headerOrder: string[];
}): Promise<{ blob: Blob; fileName: string }> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VNPT Business Management';
  workbook.created = new Date();

  const intakeSheet = workbook.addWorksheet(normalizeWorksheetName(params.intakeSheetName, 'YeuCauNhap'));
  setWorksheetColumns(intakeSheet, params.viHeaders, buildAutoWidths(params.viHeaders));
  intakeSheet.getRow(1).font = { bold: true };
  intakeSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2FF' },
  };
  const customerDisplayRows = params.customerRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const projectItemDisplayRows = params.projectItemRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const customerPersonnelDisplayRows = params.customerPersonnelRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const internalPersonnelDisplayRows = params.personnelRows.map(([code, fullName, username]) => {
    const displayName = String(fullName || username || code || '').trim();
    return [code, fullName, username, `${code} - ${displayName}`] as const;
  });

  const customerDisplayByCode = new Map<string, string>();
  customerDisplayRows.forEach(([code, _name, display]) => {
    customerDisplayByCode.set(String(code).trim(), display);
  });

  const customerDisplayByProjectDisplay = new Map<string, string[]>();
  params.projectItemByCustomerCode.forEach((rows, customerCode) => {
    const safeCustomerCode = String(customerCode).trim();
    const customerDisplay = customerDisplayByCode.get(safeCustomerCode) || safeCustomerCode;
    const displayRows = rows
      .map(([code, name]) => {
        const displayName = String(name || code || '').trim();
        return `${code} - ${displayName}`;
      })
      .filter(Boolean);
    displayRows.forEach((projectDisplay) => {
      const currentCustomers = customerDisplayByProjectDisplay.get(projectDisplay) || [];
      if (!currentCustomers.includes(customerDisplay)) {
        currentCustomers.push(customerDisplay);
        customerDisplayByProjectDisplay.set(projectDisplay, currentCustomers);
      }
    });
  });

  if (customerDisplayByProjectDisplay.size === 0) {
    const allCustomers = Array.from(new Set(Array.from(customerDisplayByCode.values()).filter(Boolean)));
    projectItemDisplayRows.forEach((row) => {
      const projectDisplay = row[2];
      customerDisplayByProjectDisplay.set(projectDisplay, [...allCustomers]);
    });
  }

  customerDisplayByProjectDisplay.forEach((customers, projectDisplay) => {
    customerDisplayByProjectDisplay.set(projectDisplay, [...customers].sort((a, b) => a.localeCompare(b, 'vi')));
  });

  const customerPersonnelDisplayByCustomerCode = new Map<string, string[]>();
  params.customerPersonnelByCustomerCode.forEach((rows, customerCode) => {
    const displayRows = rows
      .map(([code, name]) => {
        const displayName = String(name || code || '').trim();
        return `${code} - ${displayName}`;
      })
      .filter(Boolean);
    customerPersonnelDisplayByCustomerCode.set(String(customerCode).trim(), Array.from(new Set(displayRows)));
  });

  const sampleCellByHeader: Record<string, string> = {
    import_row_code: 'ROW_001',
    project_item_code: projectItemDisplayRows[0]?.[2] || '',
    customer_code: customerDisplayRows[0]?.[2] || '',
    customer_personnel_code: customerPersonnelDisplayRows[0]?.[2] || '',
    support_group_code: params.supportGroupRows[0]?.[0] || '',
    source_channel: params.sourceChannelRows[0] || 'Email',
    summary: 'Mô tả yêu cầu mẫu',
    description: 'Chi tiết yêu cầu mẫu',
    priority: params.priorityRows[1] || params.priorityRows[0] || 'Trung bình',
    receiver_user_code: internalPersonnelDisplayRows[0]?.[3] || '',
    creator_user_code: internalPersonnelDisplayRows[0]?.[3] || '',
  };
  intakeSheet.addRow(params.headerOrder.map((header) => sampleCellByHeader[header] || ''));

  const intakeColumnIndexByHeader = new Map<string, number>();
  params.headerOrder.forEach((header, index) => {
    intakeColumnIndexByHeader.set(header, index + 1);
  });

  const customerColumnIndex = intakeColumnIndexByHeader.get('customer_code') ?? 2;
  const projectItemColumnIndex = intakeColumnIndexByHeader.get('project_item_code') ?? 3;
  const customerPersonnelColumnIndex = intakeColumnIndexByHeader.get('customer_personnel_code') ?? 4;
  const supportGroupColumnIndex = intakeColumnIndexByHeader.get('support_group_code') ?? 5;
  const sourceChannelColumnIndex = intakeColumnIndexByHeader.get('source_channel') ?? 6;
  const priorityColumnIndex = intakeColumnIndexByHeader.get('priority') ?? 9;
  const receiverColumnIndex = intakeColumnIndexByHeader.get('receiver_user_code') ?? 10;
  const creatorColumnIndex = intakeColumnIndexByHeader.get('creator_user_code') ?? 11;

  const customerColumnLetter = intakeSheet.getColumn(customerColumnIndex).letter;
  const projectItemColumnLetter = intakeSheet.getColumn(projectItemColumnIndex).letter;

  const taskSheet = workbook.addWorksheet(normalizeWorksheetName(params.taskSheetName, 'YeuCauTasks'));
  setWorksheetColumns(taskSheet, params.viTaskHeaders, buildAutoWidths(params.viTaskHeaders));
  taskSheet.getRow(1).font = { bold: true };
  taskSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2FF' },
  };
  taskSheet.addRow([
    'ROW_001',
    params.taskSources[0] || 'IT360',
    'TASK-001',
    '',
    params.taskStatuses[0] || 'TODO',
  ]);

  const customerSheet = workbook.addWorksheet('KhachHang');
  setWorksheetColumns(customerSheet, ['Mã khách hàng', 'Tên khách hàng', 'Hiển thị'], [180, 280, 320]);
  customerSheet.getRow(1).font = { bold: true };
  customerDisplayRows.forEach((row) => customerSheet.addRow([...row]));
  customerSheet.getColumn(3).hidden = true;

  const projectItemSheet = workbook.addWorksheet('HangMucDuAnSanPham');
  setWorksheetColumns(projectItemSheet, ['Mã hạng mục', 'Tên hạng mục', 'Hiển thị'], [220, 320, 360]);
  projectItemSheet.getRow(1).font = { bold: true };
  projectItemDisplayRows.forEach((row) => projectItemSheet.addRow([...row]));
  projectItemSheet.getColumn(3).hidden = true;

  const customerPersonnelSheet = workbook.addWorksheet('NhanSuLienHe');
  setWorksheetColumns(customerPersonnelSheet, ['Mã nhân sự liên hệ', 'Tên nhân sự liên hệ', 'Hiển thị'], [220, 280, 360]);
  customerPersonnelSheet.getRow(1).font = { bold: true };
  customerPersonnelDisplayRows.forEach((row) => customerPersonnelSheet.addRow([...row]));
  customerPersonnelSheet.getColumn(3).hidden = true;

  const supportGroupSheet = workbook.addWorksheet('NhomHoTro');
  setWorksheetColumns(supportGroupSheet, ['Mã nhóm hỗ trợ', 'Tên nhóm hỗ trợ'], [200, 280]);
  supportGroupSheet.getRow(1).font = { bold: true };
  params.supportGroupRows.forEach((row) => supportGroupSheet.addRow([...row]));

  const internalPersonnelSheet = workbook.addWorksheet('NhanSuNoiBo');
  setWorksheetColumns(internalPersonnelSheet, ['Mã nhân sự', 'Họ tên', 'Tài khoản', 'Hiển thị'], [160, 220, 180, 320]);
  internalPersonnelSheet.getRow(1).font = { bold: true };
  internalPersonnelDisplayRows.forEach((row) => internalPersonnelSheet.addRow([...row]));
  internalPersonnelSheet.getColumn(4).hidden = true;

  const sourceChannelSheet = workbook.addWorksheet('KenhTiepNhan');
  setWorksheetColumns(sourceChannelSheet, ['Kênh tiếp nhận'], [180]);
  sourceChannelSheet.getRow(1).font = { bold: true };
  params.sourceChannelRows.forEach((value) => sourceChannelSheet.addRow([value]));

  const prioritySheet = workbook.addWorksheet('DoUuTien');
  setWorksheetColumns(prioritySheet, ['Độ ưu tiên'], [160]);
  prioritySheet.getRow(1).font = { bold: true };
  params.priorityRows.forEach((value) => prioritySheet.addRow([value]));

  const dependentLookupSheet = workbook.addWorksheet('_LookupByCustomer');
  dependentLookupSheet.state = 'hidden';
  setWorksheetColumns(
    dependentLookupSheet,
    [
      'project_display_name',
      'customer_display_name',
      'personnel_display_name',
      'customer_key',
      'personnel_key',
    ],
    [360, 320, 360, 220, 220]
  );

  const customerNameKeyMap = new Map<string, string>();
  const personnelNameKeyMap = new Map<string, string>();

  dependentLookupSheet.getCell(1, 4).value = '';
  dependentLookupSheet.getCell(1, 5).value = '';
  workbook.definedNames.add(`${quoteSheetName('_LookupByCustomer')}!$D$1:$D$1`, 'EMPTY_CUSTOMER');
  workbook.definedNames.add(`${quoteSheetName('_LookupByCustomer')}!$E$1:$E$1`, 'EMPTY_PERSONNEL');

  const sortedProjectDisplays = Array.from(customerDisplayByProjectDisplay.keys()).sort((a, b) => a.localeCompare(b, 'vi'));
  const lookupSheetRef = quoteSheetName('_LookupByCustomer');

  sortedProjectDisplays.forEach((projectDisplay) => {
    const customerKey = sanitizeExcelNameKey(`CUSTOMER_${projectDisplay}`);
    customerNameKeyMap.set(projectDisplay, customerKey);
  });

  customerDisplayRows.forEach(([customerCode]) => {
    const safeCustomerCode = String(customerCode).trim();
    const personnelKey = sanitizeExcelNameKey(`PERSONNEL_${safeCustomerCode}`);
    personnelNameKeyMap.set(safeCustomerCode, personnelKey);
  });

  let lookupRowIndex = 2;
  sortedProjectDisplays.forEach((projectDisplay) => {
    const linkedCustomers = customerDisplayByProjectDisplay.get(projectDisplay) || [];
    const customerKey = customerNameKeyMap.get(projectDisplay) || 'EMPTY_CUSTOMER';

    const maxRows = Math.max(1, linkedCustomers.length);
    const startRow = lookupRowIndex;

    for (let index = 0; index < maxRows; index += 1) {
      dependentLookupSheet.getCell(lookupRowIndex, 1).value = projectDisplay;
      dependentLookupSheet.getCell(lookupRowIndex, 2).value = linkedCustomers[index] || '';
      dependentLookupSheet.getCell(lookupRowIndex, 3).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 4).value = customerKey;
      dependentLookupSheet.getCell(lookupRowIndex, 5).value = '';
      lookupRowIndex += 1;
    }

    const endRow = lookupRowIndex - 1;
    workbook.definedNames.add(`${lookupSheetRef}!$B$${startRow}:$B$${endRow}`, customerKey);
  });

  const sortedLookupCustomerKeys = Array.from(customerDisplayByCode.keys()).sort((a, b) => a.localeCompare(b, 'vi'));
  const personnelLookupStartRow = lookupRowIndex;

  sortedLookupCustomerKeys.forEach((safeCustomerCode) => {
    const customerDisplay = customerDisplayByCode.get(safeCustomerCode) || safeCustomerCode;
    const personnelKey = personnelNameKeyMap.get(safeCustomerCode) || 'EMPTY_PERSONNEL';
    const personnelDisplayList = customerPersonnelDisplayByCustomerCode.get(safeCustomerCode) || [];

    const maxRows = Math.max(1, personnelDisplayList.length);
    const startRow = lookupRowIndex;

    for (let index = 0; index < maxRows; index += 1) {
      dependentLookupSheet.getCell(lookupRowIndex, 1).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 2).value = customerDisplay;
      dependentLookupSheet.getCell(lookupRowIndex, 3).value = personnelDisplayList[index] || '';
      dependentLookupSheet.getCell(lookupRowIndex, 4).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 5).value = personnelKey;
      lookupRowIndex += 1;
    }

    const endRow = lookupRowIndex - 1;
    workbook.definedNames.add(`${lookupSheetRef}!$C$${startRow}:$C$${endRow}`, personnelKey);
  });

  for (let col = 1; col <= 5; col += 1) {
    dependentLookupSheet.getColumn(col).hidden = true;
  }

  const lookupLastRow = Math.max(2, lookupRowIndex - 1);

  const customerFormulaByRow = (row: number): string =>
    `INDIRECT(IFERROR(VLOOKUP($${projectItemColumnLetter}${row},${lookupSheetRef}!$A$2:$D$${lookupLastRow},4,FALSE),"EMPTY_CUSTOMER"))`;

  const personnelFormulaByRow = (row: number): string =>
    `INDIRECT(IFERROR(VLOOKUP($${customerColumnLetter}${row},${lookupSheetRef}!$B$${personnelLookupStartRow}:$E$${lookupLastRow},4,FALSE),"EMPTY_PERSONNEL"))`;

  const projectFormula = `'HangMucDuAnSanPham'!$C$2:$C$${Math.max(2, projectItemDisplayRows.length + 1)}`;

  const guideSheet = workbook.addWorksheet('HuongDan');
  setWorksheetColumns(guideSheet, ['Nội dung'], [560]);
  guideSheet.getRow(1).font = { bold: true };
  [
    '1. Điền dữ liệu tại sheet YeuCauNhap.',
    '2. import_row_code là mã khóa để nối với sheet YeuCauTasks.',
    '3. Chọn Mã hạng mục dự án/sản phẩm trước, sau đó cột Mã khách hàng sẽ lọc theo hạng mục đã chọn.',
    '4. Cột Mã nhân sự liên hệ khách hàng sẽ lọc theo Mã khách hàng đã chọn.',
    '5. Nếu cần tra cứu toàn bộ dữ liệu, xem sheet HangMucDuAnSanPham và NhanSuLienHe.',
    '6. Cột Mã nhóm hỗ trợ tra ở sheet NhomHoTro.',
    '7. Cột Mã người tiếp nhận và Mã người tạo tra ở sheet NhanSuNoiBo.',
    '8. Không import trạng thái, hệ thống luôn tạo ở new_intake.',
    `9. Priority hợp lệ: ${params.priorityRows.join(', ') || 'Thấp, Trung bình, Cao, Khẩn'}.`,
    `10. Task source hợp lệ: ${params.taskSources.join(', ') || 'IT360, REFERENCE'}.`,
    `11. Task status hợp lệ: ${params.taskStatuses.join(', ') || 'TODO, IN_PROGRESS, DONE, CANCELLED, BLOCKED'}.`,
    params.hasLookupData
      ? '12. File mẫu đã đổ sẵn dữ liệu mã từ danh mục hiện tại.'
      : '12. Chưa có dữ liệu lookup trong phiên hiện tại, vui lòng nhập mã theo dữ liệu hệ thống.',
  ].forEach((line) => guideSheet.addRow([line]));

  const maxTemplateRows = 1000;
  const supportGroupFormula = `'NhomHoTro'!$A$2:$A$${Math.max(2, params.supportGroupRows.length + 1)}`;
  const personnelDisplayFormula = `'NhanSuNoiBo'!$D$2:$D$${Math.max(2, internalPersonnelDisplayRows.length + 1)}`;
  const sourceChannelFormula = `'KenhTiepNhan'!$A$2:$A$${Math.max(2, params.sourceChannelRows.length + 1)}`;
  const priorityFormula = `'DoUuTien'!$A$2:$A$${Math.max(2, params.priorityRows.length + 1)}`;

  addDropdownValidationByRowFormula(intakeSheet, customerColumnIndex, 2, maxTemplateRows, customerFormulaByRow);
  addDropdownValidation(intakeSheet, projectItemColumnIndex, projectFormula, 2, maxTemplateRows);
  addDropdownValidationByRowFormula(intakeSheet, customerPersonnelColumnIndex, 2, maxTemplateRows, personnelFormulaByRow);
  addDropdownValidation(intakeSheet, supportGroupColumnIndex, supportGroupFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, sourceChannelColumnIndex, sourceChannelFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, priorityColumnIndex, priorityFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, receiverColumnIndex, personnelDisplayFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, creatorColumnIndex, personnelDisplayFormula, 2, maxTemplateRows);

  const hiddenTaskSourcesSheet = workbook.addWorksheet('_TaskLookup');
  hiddenTaskSourcesSheet.state = 'hidden';
  setWorksheetColumns(hiddenTaskSourcesSheet, ['Task source', 'Task status'], [180, 180]);
  params.taskSources.forEach((value, index) => {
    const rowIndex = index + 2;
    hiddenTaskSourcesSheet.getCell(rowIndex, 1).value = value;
  });
  params.taskStatuses.forEach((value, index) => {
    const rowIndex = index + 2;
    hiddenTaskSourcesSheet.getCell(rowIndex, 2).value = value;
  });
  const taskSourceLookupFormula = `'_TaskLookup'!$A$2:$A$${Math.max(2, params.taskSources.length + 1)}`;
  const taskStatusLookupFormula = `'_TaskLookup'!$B$2:$B$${Math.max(2, params.taskStatuses.length + 1)}`;
  addDropdownValidation(taskSheet, 2, taskSourceLookupFormula, 2, maxTemplateRows);
  addDropdownValidation(taskSheet, 5, taskStatusLookupFormula, 2, maxTemplateRows);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob,
    fileName: `${params.fileNameBase}.xlsx`,
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  supportContactPositions = [],
  currentUserId,
  isAdminViewer = false,
  canReadRequests = false,
  canWriteRequests = false,
  canDeleteRequests = false,
  canImportRequests = false,
  canExportRequests = false,
  onNotify,
  onCustomersUpdated,
  onCustomerPersonnelUpdated,
}) => {
  // -------------------------------------------------------------------------
  // 1. Notify helper
  // -------------------------------------------------------------------------
  const notify = useCallback(
    (type: ToastType, title: string, message: string) => {
      onNotify?.(type, title, message);
    },
    [onNotify]
  );

  // -------------------------------------------------------------------------
  // 2. Hub state
  // -------------------------------------------------------------------------
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [showAddCustomerPersonnelModal, setShowAddCustomerPersonnelModal] = useState(false);
  const [isSavingCustomerPersonnel, setIsSavingCustomerPersonnel] = useState(false);

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  const handleOpenAddCustomerModal = useCallback(() => {
    setShowAddCustomerModal(true);
  }, []);

  const handleCloseAddCustomerModal = useCallback(() => {
    if (isSavingCustomer) {
      return;
    }
    setShowAddCustomerModal(false);
  }, [isSavingCustomer]);

  const handleSaveNewCustomer = useCallback(async (payload: Partial<Customer>) => {
    setIsSavingCustomer(true);
    try {
      await createCustomer(payload);
      const refreshedCustomers = await fetchCustomers();
      setLocalCustomers(refreshedCustomers || []);
      onCustomersUpdated?.(refreshedCustomers || []);
      notify('success', 'Thành công', 'Thêm mới khách hàng thành công.');
      setShowAddCustomerModal(false);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tạo khách hàng.';
      notify('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSavingCustomer(false);
    }
  }, [notify, onCustomersUpdated]);

  const handleOpenAddCustomerPersonnelModal = useCallback(() => {
    setShowAddCustomerPersonnelModal(true);
  }, []);

  const handleCloseAddCustomerPersonnelModal = useCallback(() => {
    if (isSavingCustomerPersonnel) {
      return;
    }
    setShowAddCustomerPersonnelModal(false);
  }, [isSavingCustomerPersonnel]);

  const handleSaveNewCustomerPersonnel = useCallback(async (payload: Partial<CustomerPersonnel>) => {
    setIsSavingCustomerPersonnel(true);
    try {
      await createCustomerPersonnel(payload);
      const refreshedPersonnel = await fetchCustomerPersonnel();
      onCustomerPersonnelUpdated?.(refreshedPersonnel || []);
      notify('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công.');
      setShowAddCustomerPersonnelModal(false);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tạo nhân sự liên hệ.';
      notify('error', 'Lưu thất bại', message);
      throw error;
    } finally {
      setIsSavingCustomerPersonnel(false);
    }
  }, [notify, onCustomerPersonnelUpdated]);

  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [selectedRequestPreview, setSelectedRequestPreview] = useState<YeuCau | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createFormTags, setCreateFormTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImportingIntake, setIsImportingIntake] = useState(false);
  const [isExportingIntake, setIsExportingIntake] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isSubmittingWorklog, setIsSubmittingWorklog] = useState(false);
  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [projectRaciRows, setProjectRaciRows] = useState<ProjectRaciRow[]>([]);
  const [showWorklogModal, setShowWorklogModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [worklogModalContext, setWorklogModalContext] = useState<CustomerRequestWorklogModalContext | null>(null);
  const [pendingPrimaryAction, setPendingPrimaryAction] = useState<{
    requestId: string;
    action: CustomerRequestPrimaryActionMeta;
  } | null>(null);

  // List / filter state
  const [activeProcessCodes, setActiveProcessCodes] = useState<string[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(20);
  const [requestKeyword, setRequestKeyword] = useState('');
  const [requestHandlerKeyword, setRequestHandlerKeyword] = useState('');
  const [requestEntityFilter, setRequestEntityFilter] = useState<string[]>([]);
  const [requestTagFilter, setRequestTagFilter] = useState<string[]>([]);
  const [requestPriorityFilter, setRequestPriorityFilter] = useState<string[]>([]);
  const [requestRoleFilter, setRequestRoleFilter] = useState<CustomerRequestRoleFilter>('');
  const [defaultCreatedRange] = useState(() => buildDefaultCustomerRequestCreatedRange());
  const [requestCreatedFrom, setRequestCreatedFrom] = useState(() => defaultCreatedRange.from);
  const [requestCreatedTo, setRequestCreatedTo] = useState(() => defaultCreatedRange.to);
  const [requestMissingEstimateFilter, setRequestMissingEstimateFilter] = useState(false);
  const [requestOverEstimateFilter, setRequestOverEstimateFilter] = useState(false);
  const [requestSlaRiskFilter, setRequestSlaRiskFilter] = useState(false);

  const [draftActiveProcessCodes, setDraftActiveProcessCodes] = useState<string[]>([]);
  const [draftRequestKeywordInput, setDraftRequestKeywordInput] = useState('');
  const [draftRequestHandlerKeywordInput, setDraftRequestHandlerKeywordInput] = useState('');
  const [draftRequestEntityFilter, setDraftRequestEntityFilter] = useState<string[]>([]);
  const [draftRequestTagFilter, setDraftRequestTagFilter] = useState<string[]>([]);
  const [draftRequestPriorityFilter, setDraftRequestPriorityFilter] = useState<string[]>([]);
  const [draftRequestCreatedFrom, setDraftRequestCreatedFrom] = useState(() => defaultCreatedRange.from);
  const [draftRequestCreatedTo, setDraftRequestCreatedTo] = useState(() => defaultCreatedRange.to);
  const [draftRequestMissingEstimateFilter, setDraftRequestMissingEstimateFilter] = useState(false);
  const [draftRequestOverEstimateFilter, setDraftRequestOverEstimateFilter] = useState(false);
  const [draftRequestSlaRiskFilter, setDraftRequestSlaRiskFilter] = useState(false);

  /** Kiểm soát workspace nào hiển thị — độc lập với requestRoleFilter (lọc list) */
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTabKey>('overview');
  const [activeSurface, setActiveSurface] = useState<CustomerRequestSurfaceKey>('inbox');
  const [activeInboxBucket, setActiveInboxBucket] = useState<InboxBucketKey>('hot');
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [isIntakeMenuOpen, setIsIntakeMenuOpen] = useState(false);
  const [isSharedFilterExpanded, setIsSharedFilterExpanded] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const applyDraftFilters = useCallback(() => {
    setActiveProcessCodes(draftActiveProcessCodes);
    const normalizedKeyword = draftRequestKeywordInput.trim();
    setRequestKeyword(normalizedKeyword);
    const normalizedHandlerKeyword = draftRequestHandlerKeywordInput.trim();
    setRequestHandlerKeyword(normalizedHandlerKeyword);
    setRequestEntityFilter(draftRequestEntityFilter);
    setRequestTagFilter(draftRequestTagFilter);
    setRequestPriorityFilter(draftRequestPriorityFilter);
    setRequestCreatedFrom(draftRequestCreatedFrom);
    setRequestCreatedTo(draftRequestCreatedTo);
    setRequestMissingEstimateFilter(draftRequestMissingEstimateFilter);
    setRequestOverEstimateFilter(draftRequestOverEstimateFilter);
    setRequestSlaRiskFilter(draftRequestSlaRiskFilter);
    setListPage(1);
  }, [
    draftActiveProcessCodes,
    draftRequestCreatedFrom,
    draftRequestCreatedTo,
    draftRequestEntityFilter,
    draftRequestKeywordInput,
    draftRequestHandlerKeywordInput,
    draftRequestMissingEstimateFilter,
    draftRequestOverEstimateFilter,
    draftRequestPriorityFilter,
    draftRequestSlaRiskFilter,
    draftRequestTagFilter,
  ]);

  const handleSubmitKeywordSearch = useCallback(() => {
    applyDraftFilters();
  }, [applyDraftFilters]);

  // Transition state
  const [transitionStatusCode, setTransitionStatusCode] = useState('');

  // Task tab state (detail pane)
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');

  // Create flow draft
  const [createFlowDraft, setCreateFlowDraft] =
    useState<CustomerRequestCreateFlowDraft>(() => buildInitialCreateFlowDraft(currentUserId));
  
  // Workflow selection for new request
  const { defaultWorkflowId, isLoading: isLoadingWorkflows } = useWorkflowDefinitions({ enabled: isCreateMode });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // Set default workflow when creating new request
  useEffect(() => {
    if (isCreateMode && defaultWorkflowId !== null && selectedWorkflowId === null) {
      setSelectedWorkflowId(defaultWorkflowId);
    }
  }, [isCreateMode, defaultWorkflowId, selectedWorkflowId]);
  
  const layoutMode = useCustomerRequestResponsiveLayout();

  const {
    pinnedItems,
    recentItems,
    pushRecentRequest,
    togglePinnedRequest,
    removePinnedRequest,
    isPinnedRequest,
  } = useCustomerRequestQuickAccess(currentUserId);

  // -------------------------------------------------------------------------
  // 3. Process catalog
  // -------------------------------------------------------------------------
  const [processCatalog, setProcessCatalog] = useState<YeuCauProcessCatalog | null>(null);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchYeuCauProcessCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setProcessCatalog(catalog);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !isRequestCanceledError(error)) {
          notify(
            'error',
            'Tải danh mục quy trình thất bại',
            error instanceof Error ? error.message : 'Không thể tải danh mục.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadRequests]);

  // Derived from catalog
  const masterFields = useMemo<YeuCauProcessField[]>(
    () => processCatalog?.master_fields ?? [],
    [processCatalog]
  );

  const allProcesses = useMemo<YeuCauProcessMeta[]>(() => {
    if (!processCatalog) return [];
    return processCatalog.groups.flatMap((g) => g.processes);
  }, [processCatalog]);

  const xmlVisibleProcesses = useMemo<YeuCauProcessMeta[]>(
    () => filterXmlVisibleProcesses(allProcesses),
    [allProcesses]
  );

  const processMap = useMemo<Map<string, YeuCauProcessMeta>>(() => {
    const map = new Map<string, YeuCauProcessMeta>();
    allProcesses.forEach((p) => map.set(p.process_code, p));
    return map;
  }, [allProcesses]);

  const processOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [{ value: '', label: 'Tất cả' }];
    xmlVisibleProcesses.forEach((p) =>
      opts.push({ value: p.process_code, label: p.process_label })
    );
    return opts;
  }, [xmlVisibleProcesses]);

  const effectiveProjectItems = useMemo(() => {
    // CRC phải chỉ hiển thị project item đã được scope theo đội ngũ dự án
    // từ endpoint chuyên dụng; không union với bootstrap list chung của app
    // vì sẽ làm lộ các dự án/sản phẩm chưa được phân công RACI.
    return scopedProjectItems;
  }, [scopedProjectItems]);

  const newIntakeFields = useMemo<YeuCauProcessField[]>(
    () => processMap.get('new_intake')?.form_fields ?? [],
    [processMap]
  );

  const activeEditorMeta = useMemo<YeuCauProcessMeta | null>(
    () => (isXmlVisibleProcessCode(activeEditorProcessCode) ? (processMap.get(activeEditorProcessCode) ?? null) : null),
    [processMap, activeEditorProcessCode]
  );

  const transitionProcessMeta = useMemo<YeuCauProcessMeta | null>(
    () =>
      transitionStatusCode && isXmlVisibleProcessCode(transitionStatusCode)
        ? (processMap.get(transitionStatusCode) ?? null)
        : null,
    [processMap, transitionStatusCode]
  );

  const transitionRenderableFields = useMemo<YeuCauProcessField[]>(
    () => ([
      { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime' },
      { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime' },
      { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime' },
      { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number' },
      { name: 'from_user_id', label: 'Người chuyển', type: 'user_select' },
      { name: 'to_user_id', label: 'Người nhận', type: 'user_select' },
      { name: 'notes', label: 'Ghi chú', type: 'textarea' },
    ]),
    []
  );

  // -------------------------------------------------------------------------
  // 4. Search hook
  // -------------------------------------------------------------------------
  const {
    searchKeyword,
    setSearchKeyword,
    searchResults,
    searchError,
    isSearchLoading,
    isSearchOpen,
    setIsSearchOpen,
  } = useCustomerRequestSearch({ canReadRequests });


  // -------------------------------------------------------------------------
  // 5. Stable error/callback refs — prevent hook useEffect re-firing on every
  //    render due to inline arrow functions changing reference each render.
  // -------------------------------------------------------------------------
  const handleListError = useCallback(
    (msg: string) => notify('error', 'Tải danh sách thất bại', msg),
    [notify]
  );
  const handlePageOverflow = useCallback((page: number) => setListPage(page), []);
  const handleDashboardError = useCallback(
    (msg: string) => notify('error', 'Tải dashboard thất bại', msg),
    [notify]
  );
  const handleCreatorError = useCallback(
    (msg: string) => notify('error', 'Khu vực người tạo', msg),
    [notify]
  );
  const handleDispatcherError = useCallback(
    (msg: string) => notify('error', 'Khu vực điều phối', msg),
    [notify]
  );
  const handlePerformerError = useCallback(
    (msg: string) => notify('error', 'Khu vực người xử lý', msg),
    [notify]
  );
  const handleDetailError = useCallback(
    (msg: string) => notify('error', 'Tải chi tiết yêu cầu thất bại', msg),
    [notify]
  );

  // -------------------------------------------------------------------------
  // 6. List hook
  // -------------------------------------------------------------------------
  const listFilters = useMemo(() => {
    const normalizedEntityFilters = normalizeFilterValues(requestEntityFilter);

    return {
      customer_id: normalizedEntityFilters.length > 0 ? normalizedEntityFilters : undefined,
      priority: requestPriorityFilter.length > 0 ? requestPriorityFilter : undefined,
      status_code: activeProcessCodes.length > 0 ? activeProcessCodes : undefined,
      tag_id: requestTagFilter.length > 0 ? requestTagFilter : undefined,
      my_role: requestRoleFilter || undefined,
      received_by_name: requestHandlerKeyword || undefined,
      created_from: buildCreatedFromFilterValue(requestCreatedFrom),
      created_to: buildCreatedToFilterValue(requestCreatedTo),
      missing_estimate: requestMissingEstimateFilter ? (1 as const) : undefined,
      over_estimate: requestOverEstimateFilter ? (1 as const) : undefined,
      sla_risk: requestSlaRiskFilter ? (1 as const) : undefined,
    };
  }, [
    activeProcessCodes,
    requestEntityFilter,
    requestTagFilter,
    requestPriorityFilter,
    requestRoleFilter,
    requestHandlerKeyword,
    requestCreatedFrom,
    requestCreatedTo,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestSlaRiskFilter,
  ]);

  const dashboardFilters = useMemo(() => {
    const normalizedEntityFilters = normalizeFilterValues(requestEntityFilter);

    return {
      q: requestKeyword || undefined,
      process_code: activeProcessCodes[0] || undefined,
      filters: {
        customer_id: normalizedEntityFilters.length > 0 ? normalizedEntityFilters : undefined,
        priority: requestPriorityFilter.length > 0 ? requestPriorityFilter : undefined,
        status_code: activeProcessCodes.length > 0 ? activeProcessCodes : undefined,
        tag_id: requestTagFilter.length > 0 ? requestTagFilter : undefined,
        created_from: buildCreatedFromFilterValue(requestCreatedFrom),
        created_to: buildCreatedToFilterValue(requestCreatedTo),
        missing_estimate: requestMissingEstimateFilter ? (1 as const) : undefined,
        over_estimate: requestOverEstimateFilter ? (1 as const) : undefined,
        sla_risk: requestSlaRiskFilter ? (1 as const) : undefined,
      },
    };
  }, [
    activeProcessCodes,
    requestKeyword,
    requestEntityFilter,
    requestTagFilter,
    requestPriorityFilter,
    requestCreatedFrom,
    requestCreatedTo,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestSlaRiskFilter,
  ]);

  const { listRows, isListLoading, listMeta } = useCustomerRequestList({
    canReadRequests,
    isCreateMode,
    listPage,
    pageSize: listPageSize,
    dataVersion,
    requestKeyword,
    filters: listFilters,
    currentUserId,
    onError: handleListError,
    onPageOverflow: handlePageOverflow,
  });

  const taskReferenceCatalog = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string; label: string; searchText: string }>();

    const addTaskReference = (raw: {
      id?: string | number | null;
      taskCode: string;
      summary?: string | null;
      customerName?: string | null;
      projectName?: string | null;
    }) => {
      const taskCode = String(raw.taskCode || '').trim();
      if (!taskCode) {
        return;
      }

      const normalizedCode = taskCode.toLowerCase();
      if (map.has(normalizedCode)) {
        return;
      }

      const summary = String(raw.summary || '').trim();
      map.set(normalizedCode, {
        id: raw.id ?? null,
        task_code: taskCode,
        label: summary ? `${taskCode} — ${summary}` : taskCode,
        searchText: `${taskCode} ${summary} ${String(raw.customerName || '')} ${String(raw.projectName || '')}`,
      });
    };

    listRows.forEach((row) => {
      addTaskReference({
        id: row.id,
        taskCode: row.request_code ?? row.ma_yc ?? String(row.id ?? ''),
        summary: row.summary ?? row.tieu_de,
        customerName: row.customer_name ?? row.khach_hang_name,
        projectName: (row as unknown as Record<string, unknown>).project_name as string | undefined,
      });
    });

    searchResults.forEach((r) => {
      addTaskReference({
        id: r.id,
        taskCode: r.request_code ?? String(r.id),
        summary: r.summary ?? r.label,
        customerName: r.customer_name,
        projectName: r.project_name,
      });
    });

    return map;
  }, [listRows, searchResults]);

  // -------------------------------------------------------------------------
  // 7. Dashboard hook
  // -------------------------------------------------------------------------
  const { isDashboardLoading, overviewDashboard, roleDashboards } =
    useCustomerRequestDashboard({
      canReadRequests,
      dataVersion,
      params: dashboardFilters,
      onError: handleDashboardError,
    });

  // -------------------------------------------------------------------------
  // 8. Role workspace hooks
  // -------------------------------------------------------------------------
  const isWorkspaceActive = !isCreateMode && activeSurface === 'inbox';

  const creatorWS = useCustomerRequestCreatorWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleCreatorError,
  });

  const dispatcherWS = useCustomerRequestDispatcherWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleDispatcherError,
  });

  const performerWS = useCustomerRequestPerformerWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handlePerformerError,
  });

  // -------------------------------------------------------------------------
  // 8. Detail hook
  // -------------------------------------------------------------------------
  const {
    processDetail,
    setProcessDetail,
    people,
    masterDraft,
    setMasterDraft,
    processDraft,
    setProcessDraft,
    formAttachments,
    setFormAttachments,
    formIt360Tasks,
    setFormIt360Tasks,
    formReferenceTasks,
    setFormReferenceTasks,
    formTags,
    setFormTags,
    timeline,
    caseWorklogs,
    setCaseWorklogs,
    isDetailLoading,
    refreshDetail,
  } = useCustomerRequestDetail({
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    dataVersion,
    masterFields,
    createInitialFields: newIntakeFields,
    onError: handleDetailError,
  });

  // -------------------------------------------------------------------------
  // 8b. Merged task reference catalog (includes form reference tasks)
  // -------------------------------------------------------------------------
  const mergedTaskReferenceCatalog = useMemo(() => {
    const map = new Map(taskReferenceCatalog);
    formReferenceTasks.forEach((task) => {
      if (task.task_code && task.id) {
        const taskCode = String(task.task_code).trim();
        if (!taskCode) return;
        const normalizedCode = taskCode.toLowerCase();
        if (!map.has(normalizedCode)) {
          map.set(normalizedCode, {
            id: task.id,
            task_code: taskCode,
            label: taskCode,
            searchText: taskCode,
          });
        }
      }
    });
    return map;
  }, [taskReferenceCatalog, formReferenceTasks]);

  // Task reference options (default from current list + search results + form reference tasks)
  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      Array.from(mergedTaskReferenceCatalog.values()).map((item) => ({
        value: item.task_code,
        label: item.label,
        searchText: item.searchText,
      })),
    [mergedTaskReferenceCatalog]
  );

  // Task reference lookup for transition/detail hooks
  const taskReferenceLookup = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string }>();
    mergedTaskReferenceCatalog.forEach((item, key) => {
      map.set(key, { id: item.id, task_code: item.task_code });
      map.set(item.task_code, { id: item.id, task_code: item.task_code });
    });
    return map;
  }, [mergedTaskReferenceCatalog]);

  // -------------------------------------------------------------------------
  // 9. Derived detail props
  // -------------------------------------------------------------------------
  const currentUserName = useMemo(() => {
    const user = employees.find((e) => String(e.id) === String(currentUserId ?? ''));
    return user?.full_name ?? '';
  }, [employees, currentUserId]);

  // Auto-fetch reference task data when formReferenceTasks is populated from API
  const searchedTaskCodesRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canReadRequests || formReferenceTasks.length === 0) {
      return;
    }

    // Get task_codes that haven't been searched yet
    const missingTaskCodes = formReferenceTasks
      .map((t) => t.task_code)
      .filter((code): code is string => !!(code && !searchedTaskCodesRef.current.has(code)));

    if (missingTaskCodes.length > 0 && !isSearchLoading) {
      // Mark as searched to avoid re-triggering
      searchedTaskCodesRef.current.add(missingTaskCodes[0]);
      // Trigger search for the first missing task_code
      // User can then click dropdown to see the option, or type to search
      setSearchKeyword(missingTaskCodes[0]);
    }
  }, [canReadRequests, formReferenceTasks, isSearchLoading, setSearchKeyword]);

  const {
    registerOptimisticRequestUpdate,
    getPatchedRequest,
    patchedListRows,
    patchedCreatorRows,
    patchedCreatorBuckets,
    patchedDispatcherRows,
    patchedDispatcherBuckets,
    patchedDispatcherTeamLoadRows,
    patchedDispatcherPmWatchRows,
    patchedPerformerRows,
    patchedPerformerBuckets,
    patchedOverviewDashboard,
    patchedRoleDashboards,
  } = useCustomerRequestOptimisticState({
    currentUserId,
    dataVersion,
    listRows,
    creatorRows: creatorWS.creatorRows,
    dispatcherRows: dispatcherWS.dispatcherRows,
    performerRows: performerWS.performerRows,
    overviewDashboard,
    roleDashboards,
  });

  const selectedCustomerId = String(masterDraft.customer_id ?? '');

  const selectedProjectItem = useMemo(
    () =>
      effectiveProjectItems.find(
        (p) => String(p.id) === String(masterDraft.project_item_id ?? '')
      ) ?? null,
    [effectiveProjectItems, masterDraft.project_item_id]
  );

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchCustomerRequestProjectItems({
      include_project_item_id: (masterDraft.project_item_id as string | number | null | undefined) ?? null,
    })
      .then((items) => {
        if (!cancelled) {
          setScopedProjectItems(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScopedProjectItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, masterDraft.project_item_id]);

  // Fetch project RACI assignments for the selected request's project
  useEffect(() => {
    const projectItemId = processDetail?.yeu_cau?.project_item_id;
    if (!projectItemId || !canReadRequests) {
      setProjectRaciRows([]);
      return;
    }

    let cancelled = false;

    void fetchProjectRaciAssignments([projectItemId])
      .then((rows) => {
        if (!cancelled) {
          // Lấy tất cả roles, không chỉ 'R'
          const rRows = Array.isArray(rows) ? rows : [];
          setProjectRaciRows(rRows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectRaciRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, processDetail?.yeu_cau?.project_item_id]);

  const transitionOptions = useMemo<YeuCauProcessMeta[]>(
    () => {
      const options = resolveTransitionOptionsForRequest(
        processDetail?.allowed_next_processes ?? [],
        processDetail?.yeu_cau ?? null
      );

      return options;
    },
    [processDetail]
  );

  const detailTransitionOptions = useMemo<YeuCauProcessMeta[]>(
    () => filterXmlVisibleProcesses(processDetail?.allowed_next_processes ?? []),
    [processDetail]
  );

  useEffect(() => {
    if (isCreateMode || !selectedRequestId || detailTransitionOptions.length === 0) {
      if (transitionStatusCode !== '') {
        setTransitionStatusCode('');
      }
      return;
    }

    const hasCurrentSelection = detailTransitionOptions.some(
      (option) => option.process_code === transitionStatusCode
    );

    if (!hasCurrentSelection) {
      setTransitionStatusCode(detailTransitionOptions[0]?.process_code ?? '');
    }
  }, [detailTransitionOptions, isCreateMode, selectedRequestId, transitionStatusCode]);

  const canTransitionActiveRequest =
    !isCreateMode && !!selectedRequestId;

  const canEditActiveForm = useMemo(() => {
    if (!canWriteRequests) return false;
    if (isCreateMode) return true;
    if (!processDetail) return false;
    return processDetail.can_write;
  }, [canWriteRequests, isCreateMode, processDetail]);

  const defaultProcessor: ProjectRaciRow | null = null;

  const relatedSummaryItems = useMemo(() => {
    if (!processDetail?.yeu_cau) return [];
    const yc = processDetail.yeu_cau;
    const raw = yc as unknown as Record<string, unknown>;
    const people = processDetail.people ?? [];
    const statusRow = processDetail.status_row?.data as Record<string, unknown> | undefined;
    const processRow = processDetail.process_row?.data as Record<string, unknown> | undefined;
    const currentStatusCode = yc.current_status_code ?? yc.trang_thai;

    // Lấy assignee theo status hiện tại từ status_row/process_row trước
    const receiverUserIdFromStatusRow = statusRow?.receiver_user_id ?? processRow?.receiver_user_id;
    const dispatcherUserIdFromStatusRow = statusRow?.dispatcher_user_id ?? processRow?.dispatcher_user_id;

    // Tìm người thực hiện từ people array (vai_tro = "nguoi_thuc_hien")
    const nguoiThucHien = people.find((p) => p.vai_tro === 'nguoi_thuc_hien' && p.is_active);
    const performerUserIdFromPeople = nguoiThucHien?.user_id;

    // Với status "completed", lấy completed_by_user_id
    const completedByUserId = currentStatusCode === 'completed'
      ? statusRow?.completed_by_user_id ?? statusRow?.created_by
      : null;

    const handlerUserId = yc.nguoi_xu_ly_id
      ?? yc.current_owner_user_id
      ?? (currentStatusCode === 'pending_dispatch'
        ? dispatcherUserIdFromStatusRow ?? yc.dispatcher_user_id
        : receiverUserIdFromStatusRow ?? completedByUserId ?? performerUserIdFromPeople ?? yc.receiver_user_id ?? yc.performer_user_id ?? yc.performer_id);

    // Tìm trong RACI rows trước
    const performerFromRaci = handlerUserId
      ? projectRaciRows.find((row) => String(row.user_id) === String(handlerUserId))
      : null;

    // Nếu không tìm thấy trong RACI, tìm trong employees
    const performerFromEmployees = !performerFromRaci && handlerUserId
      ? employees.find((emp) => String(emp.id) === String(handlerUserId))
      : null;

    // Lấy tên từ status_row nếu có
    const receiverNameFromStatusRow = statusRow?.receiver_user_id_name as string | undefined;
    const dispatcherNameFromStatusRow = statusRow?.dispatcher_user_id_name as string | undefined;
    const completedByName = statusRow?.completed_by_user_id_name as string | undefined;

    // pending_dispatch phải ưu tiên PM/dispatcher hiện tại
    const performerName = yc.nguoi_xu_ly_name
      ?? yc.current_owner_name
      ?? (currentStatusCode === 'pending_dispatch'
        ? performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? dispatcherNameFromStatusRow
          ?? yc.dispatcher_name
        : performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? receiverNameFromStatusRow
          ?? completedByName
          ?? yc.performer_name
          ?? yc.receiver_name);

    return [
      { label: 'Mã yêu cầu', value: (yc.ma_yc ?? yc.request_code) as string | null | undefined },
      { label: 'Khách hàng', value: (yc.customer_name ?? yc.khach_hang_name) as string | null | undefined },
      { label: 'Dự án', value: raw.project_name as string | null | undefined },
      { label: 'Người tiếp nhận', value: yc.received_by_name },
      { label: 'Người điều phối', value: yc.dispatcher_name },
      { label: 'Người xử lý', value: performerName },
    ].filter((item): item is { label: string; value: string } => !!item.value);
  }, [processDetail, projectRaciRows, employees]);

  const currentHoursReport = useMemo<YeuCauHoursReport | null | undefined>(
    () => processDetail?.hours_report ?? null,
    [processDetail]
  );

  const estimateHistory = useMemo<YeuCauEstimate[]>(
    () => processDetail?.estimates ?? [],
    [processDetail]
  );

  const canOpenWorklogModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_worklog);

  const canOpenEstimateModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_estimate);

  const runPrimaryActionForLoadedRequest = useCallback(
    (action: CustomerRequestPrimaryActionMeta): boolean => {
      if (action.kind === 'estimate') {
        if (!processDetail?.available_actions?.can_add_estimate) {
          return false;
        }
        setShowEstimateModal(true);
        return true;
      }

      if (action.kind === 'worklog') {
        if (!processDetail?.available_actions?.can_add_worklog) {
          return false;
        }
        setShowWorklogModal(true);
        return true;
      }

      if (action.kind === 'transition' && action.targetStatusCode) {
        const nextTransitionCode = transitionOptions.some(
          (option) => option.process_code === action.targetStatusCode
        )
          ? action.targetStatusCode
          : transitionOptions[0]?.process_code ?? '';

        if (!nextTransitionCode) {
          return false;
        }

        setTransitionStatusCode(nextTransitionCode);
        return true;
      }

      return false;
    },
    [
      processDetail?.available_actions?.can_add_estimate,
      processDetail?.available_actions?.can_add_worklog,
      transitionOptions,
    ]
  );

  useEffect(() => {
    if (!pendingPrimaryAction || isCreateMode || !selectedRequestId) {
      return;
    }

    if (String(selectedRequestId) !== pendingPrimaryAction.requestId) {
      return;
    }

    const detailRequestId = String(processDetail?.yeu_cau?.id ?? '');
    if (!detailRequestId || detailRequestId !== pendingPrimaryAction.requestId) {
      return;
    }

    runPrimaryActionForLoadedRequest(pendingPrimaryAction.action);
    setPendingPrimaryAction(null);
  }, [
    isCreateMode,
    pendingPrimaryAction,
    processDetail?.yeu_cau?.id,
    runPrimaryActionForLoadedRequest,
    selectedRequestId,
  ]);

  useEffect(() => {
    if (isCreateMode || !processDetail?.yeu_cau?.id) {
      return;
    }
    pushRecentRequest(processDetail.yeu_cau);
  }, [isCreateMode, processDetail?.yeu_cau, pushRecentRequest]);

  const dispatcherQuickActions = useMemo<DispatcherQuickAction[]>(() => {
    return buildDispatcherQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  const performerQuickActions = useMemo<PerformerQuickAction[]>(() => {
    return buildPerformerQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  // -------------------------------------------------------------------------
  // 10. Transition hook
  // -------------------------------------------------------------------------
  const transitionHook = useCustomerRequestTransition({
    currentUserId,
    selectedRequestId,
    transitionStatusCode,
    transitionProcessMeta,
    processDetail,
    people: people as YeuCauRelatedUser[],
    defaultProcessor,
    taskReferenceLookup,
    onNotify: (type, title, msg) => notify(type, title, msg),
    onTransitionSuccess: (requestId, statusCode) => {
      setSelectedRequestId(requestId);
      setSelectedRequestPreview((prev) =>
        prev ? { ...prev, id: requestId, current_status_code: statusCode } : prev
      );
      setIsCreateMode(false);
      setActiveEditorProcessCode(statusCode || 'new_intake');
      setTransitionStatusCode('');
      setPendingPrimaryAction(null);
      bumpDataVersion();
    },
    bumpDataVersion,
    caseContextIt360Tasks: formIt360Tasks,
    caseContextReferenceTasks: formReferenceTasks,
  });

  // -------------------------------------------------------------------------
  // 11. Handlers
  // -------------------------------------------------------------------------
  const handleSelectRow = useCallback((row: YeuCau) => {
    pushRecentRequest(row);
    setSelectedRequestId(row.id);
    setSelectedRequestPreview(row);
    setIsCreateMode(false);
    setActiveSurface('list');
    setActiveEditorProcessCode(resolveRequestProcessCode(row));
    setTransitionStatusCode('');
    setPendingPrimaryAction(null);
    setActiveSavedViewId(null);
    setProcessDetail(null);
  }, [pushRecentRequest, setProcessDetail]);

  const requestLookup = useMemo(() => {
    const map = new Map<string, YeuCau>();

    const appendRows = (rows: Array<YeuCau | null | undefined>) => {
      rows.forEach((row) => {
        if (!row?.id) {
          return;
        }
        map.set(String(row.id), row);
      });
    };

    const appendAttentionCases = (
      dashboard: typeof overviewDashboard | null | undefined
    ) => {
      (dashboard?.attention_cases ?? []).forEach((item) => {
        const requestCase = item?.request_case as YeuCau | undefined;
        if (!requestCase?.id) {
          return;
        }
        map.set(String(requestCase.id), requestCase);
      });
    };

    appendRows(patchedListRows);
    appendRows(patchedCreatorRows);
    appendRows(patchedDispatcherRows);
    appendRows(patchedPerformerRows);
    appendAttentionCases(patchedOverviewDashboard);
    appendAttentionCases(patchedRoleDashboards.creator);
    appendAttentionCases(patchedRoleDashboards.dispatcher);
    appendAttentionCases(patchedRoleDashboards.performer);

    return map;
  }, [
    patchedCreatorRows,
    patchedDispatcherRows,
    patchedListRows,
    patchedOverviewDashboard,
    patchedPerformerRows,
    patchedRoleDashboards.creator,
    patchedRoleDashboards.dispatcher,
    patchedRoleDashboards.performer,
  ]);

  const handleOpenRequest = useCallback(
    async (requestId: string | number, statusCode?: string | null) => {
      const lookupKey = String(requestId);
      const knownRow = requestLookup.get(lookupKey) ?? null;
      const listRow = patchedListRows.find((r) => String(r.id) === lookupKey) ?? null;

      if (listRow) {
        handleSelectRow(listRow);
        return;
      }

      setSelectedRequestId(requestId);
      setSelectedRequestPreview(knownRow);
      setIsCreateMode(false);
      setActiveSurface('list');
      setPendingPrimaryAction(null);
      setTransitionStatusCode('');
      setActiveSavedViewId(null);
      setProcessDetail(null);

      let requestPreview = knownRow;
      let resolvedCode =
        String(statusCode ?? '').trim() ||
        (knownRow ? resolveRequestProcessCode(knownRow) : '');

      if (!requestPreview || !resolvedCode) {
        try {
          const fetched = await fetchYeuCau(requestId);
          requestPreview = fetched;
          resolvedCode = resolveRequestProcessCode(fetched) || resolvedCode;
          setSelectedRequestPreview(fetched);
          pushRecentRequest(fetched);
        } catch (error: unknown) {
          if (!isRequestCanceledError(error)) {
            notify(
              'error',
              'Mở chi tiết yêu cầu thất bại',
              error instanceof Error ? error.message : 'Không thể tải yêu cầu.'
            );
          }
          setSelectedRequestId(null);
          setSelectedRequestPreview(null);
          setActiveEditorProcessCode('');
          return;
        }
      } else {
        pushRecentRequest(requestPreview);
      }

      if (!resolvedCode) {
        notify(
          'error',
          'Mở chi tiết yêu cầu thất bại',
          'Không xác định được tiến trình hiện tại của yêu cầu.'
        );
        setSelectedRequestId(null);
        setSelectedRequestPreview(null);
        setActiveEditorProcessCode('');
        return;
      }

      setActiveEditorProcessCode(resolvedCode);
    },
    [
      handleSelectRow,
      isRequestCanceledError,
      patchedListRows,
      notify,
      pushRecentRequest,
      requestLookup,
      setProcessDetail,
    ]
  );

  const handleCreateRequest = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setCreateFormTags([]);
    setIsCreateMode(true);
    setActiveEditorProcessCode('new_intake');
    setTransitionStatusCode('');
    setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
    setSelectedWorkflowId(null); // Reset workflow selection
    setActiveSavedViewId(null);
  }, [currentUserId]);

  const handleWorkspaceTabChange = useCallback((tab: WorkspaceTabKey) => {
    setActiveWorkspaceTab(tab);
    setRequestRoleFilter(workspaceTabToRoleFilter(tab));
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleDashboardRoleFilterChange = useCallback((role: CustomerRequestRoleFilter) => {
    setActiveWorkspaceTab(role || 'overview');
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setTransitionStatusCode('');
    setShowWorklogModal(false);
    setWorklogModalContext(null);
    setShowEstimateModal(false);
  }, []);

  const handleSubmitWorklog = useCallback(
    async (payload: CustomerRequestWorklogSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      const mode = worklogModalContext?.mode ?? 'worklog';
      const editingWorklog = worklogModalContext?.editingWorklog ?? null;

      setIsSubmittingWorklog(true);
      try {
        const result = mode === 'edit_worklog' && editingWorklog
          ? await updateYeuCauWorklog(selectedRequestId, editingWorklog.id, payload)
          : mode === 'detail_status_worklog'
            ? await storeYeuCauDetailStatusWorklog(selectedRequestId, payload)
            : await storeYeuCauWorklog(selectedRequestId, payload);

        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextHoursReport = result.hours_report;
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
        });

        if (result.worklog) {
          setCaseWorklogs((prev) => prependUniqueWorklog(prev, result.worklog));
        }
        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport ?? prev.hours_report ?? null,
            worklogs: prependUniqueWorklog(prev.worklogs ?? [], result.worklog),
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview((prev) =>
            applyHoursReportToRequest({
              request: prev,
              hoursReport: nextHoursReport,
              requestPatch: nextRequest,
            })
          );
        }
        setShowWorklogModal(false);
        setWorklogModalContext(null);
        notify(
          'success',
          mode === 'edit_worklog' ? 'Cập nhật giờ công' : 'Giờ công',
          mode === 'edit_worklog' ? 'Đã cập nhật bản ghi giờ công.' : 'Đã lưu giờ công cho yêu cầu.'
        );
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            mode === 'edit_worklog' ? 'Cập nhật giờ công thất bại' : 'Lưu giờ công thất bại',
            error instanceof Error ? error.message : 'Không thể lưu giờ công.'
          );
        }
      } finally {
        setIsSubmittingWorklog(false);
      }
    },
    [
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setCaseWorklogs,
      setProcessDetail,
      storeYeuCauDetailStatusWorklog,
      storeYeuCauWorklog,
      updateYeuCauWorklog,
      worklogModalContext,
    ]
  );

  const handleSubmitEstimate = useCallback(
    async (payload: CustomerRequestEstimateSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      setIsSubmittingEstimate(true);
      try {
        const result = await createYeuCauEstimate(selectedRequestId, {
          ...payload,
          estimate_type: 'manual',
          estimated_by_user_id: currentUserId ?? undefined,
        });
        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextEstimateHistory = prependUniqueEstimate(estimateHistory, result.estimate);
        const nextHoursReport = buildOptimisticEstimateHoursReport({
          currentHoursReport,
          requestCase: result.request_case,
          estimate: result.estimate,
          fallbackRequestCaseId: selectedRequestId,
        });
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
          requestPatch: result.request_case ?? undefined,
        });

        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport,
            estimates: nextEstimateHistory,
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview(nextRequest);
        }
        setShowEstimateModal(false);
        notify('success', 'Ước lượng', 'Đã cập nhật ước lượng cho yêu cầu.');
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            'Cập nhật ước lượng thất bại',
            error instanceof Error ? error.message : 'Không thể lưu ước lượng.'
          );
        }
      } finally {
        setIsSubmittingEstimate(false);
      }
    },
    [
      currentHoursReport,
      currentUserId,
      estimateHistory,
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setProcessDetail,
    ]
  );

  const handleOpenQuickAccessItem = useCallback(
    (item: CustomerRequestQuickRequestItem) => {
      handleOpenRequest(item.requestId, item.statusCode);
    },
    [handleOpenRequest]
  );

  const handleApplyInlineQuickFilter = useCallback((filter: 'mine' | 'following' | 'sla') => {
    setActiveSurface('inbox');
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setTransitionStatusCode('');

    if (filter === 'mine') {
      setActiveInboxBucket('mine');
      setRequestRoleFilter(workspaceTabToRoleFilter(activeWorkspaceTab));
    } else if (filter === 'following') {
      setActiveInboxBucket('following');
    } else {
      setActiveInboxBucket('sla_risk');
      setRequestSlaRiskFilter(true);
      setRequestEntityFilter([]);
      setRequestTagFilter([]);
      setRequestPriorityFilter([]);
      setActiveProcessCodes([]);
      setRequestKeyword('');
      setRequestCreatedFrom(defaultCreatedRange.from);
      setRequestCreatedTo(defaultCreatedRange.to);
      setRequestMissingEstimateFilter(false);
      setRequestOverEstimateFilter(false);

      setDraftRequestSlaRiskFilter(true);
      setDraftRequestEntityFilter([]);
      setDraftRequestTagFilter([]);
      setDraftRequestPriorityFilter([]);
      setDraftActiveProcessCodes([]);
      setDraftRequestKeywordInput('');
      setDraftRequestCreatedFrom(defaultCreatedRange.from);
      setDraftRequestCreatedTo(defaultCreatedRange.to);
      setDraftRequestMissingEstimateFilter(false);
      setDraftRequestOverEstimateFilter(false);
    }

    setListPage(1);
    setActiveSavedViewId(null);
    setProcessDetail(null);
  }, [activeWorkspaceTab, defaultCreatedRange.from, defaultCreatedRange.to, setProcessDetail]);

  const handleApplySavedView = useCallback((view: CustomerRequestSavedView) => {
    const filters = view.filters ?? {};

    const nextProcessCodes = normalizeFilterValues(filters.processCodes ?? [filters.processCode]);
    const nextKeyword = filters.keyword ?? '';
    const nextEntityFilters = normalizeFilterValues([
      ...(filters.customerIds ?? []),
      ...(filters.supportGroupIds ?? []),
      ...(filters.customerId ? [filters.customerId] : []),
      ...(filters.supportGroupId ? [filters.supportGroupId] : []),
    ]);
    const nextTagFilters = normalizeFilterValues(filters.tagIds);
    const nextPriorityFilters = normalizeFilterValues(filters.priorities ?? [filters.priority]);
    const nextCreatedFrom = defaultCreatedRange.from;
    const nextCreatedTo = defaultCreatedRange.to;
    const nextMissingEstimate = Boolean(filters.missingEstimate);
    const nextOverEstimate = Boolean(filters.overEstimate);
    const nextSlaRisk = Boolean(filters.slaRisk);

    setActiveWorkspaceTab(view.workspaceTab);
    setActiveSurface(view.surface);
    setSelectedRequestId(null);
    setIsCreateMode(false);
    setTransitionStatusCode('');
    setActiveSavedViewId(view.id);

    setDraftActiveProcessCodes(nextProcessCodes);
    setDraftRequestKeywordInput(nextKeyword);
    setDraftRequestEntityFilter(nextEntityFilters);
    setDraftRequestTagFilter(nextTagFilters);
    setDraftRequestPriorityFilter(nextPriorityFilters);
    setDraftRequestCreatedFrom(nextCreatedFrom);
    setDraftRequestCreatedTo(nextCreatedTo);
    setDraftRequestMissingEstimateFilter(nextMissingEstimate);
    setDraftRequestOverEstimateFilter(nextOverEstimate);
    setDraftRequestSlaRiskFilter(nextSlaRisk);

    setActiveProcessCodes(nextProcessCodes);
    setRequestKeyword(nextKeyword);
    setRequestEntityFilter(nextEntityFilters);
    setRequestTagFilter(nextTagFilters);
    setRequestPriorityFilter(nextPriorityFilters);
    setRequestCreatedFrom(nextCreatedFrom);
    setRequestCreatedTo(nextCreatedTo);
    setRequestRoleFilter(
      filters.roleFilter ?? workspaceTabToRoleFilter(view.workspaceTab)
    );
    setRequestMissingEstimateFilter(nextMissingEstimate);
    setRequestOverEstimateFilter(nextOverEstimate);
    setRequestSlaRiskFilter(nextSlaRisk);
    setListPage(1);
  }, [defaultCreatedRange.from, defaultCreatedRange.to]);

  const handleClearSavedView = useCallback(() => {
    setActiveSavedViewId(null);
  }, []);

  const handleTogglePinnedRequest = useCallback((row: YeuCau) => {
    togglePinnedRequest(row);
  }, [togglePinnedRequest]);

  const handleOpenOverviewRoleWorkspace = useCallback(
    (tab: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => {
      setActiveWorkspaceTab(tab);
      setRequestRoleFilter(workspaceTabToRoleFilter(tab));
      setActiveSurface('inbox');
      setListPage(1);
      setActiveSavedViewId(null);
    },
    []
  );

  const handleOpenOverviewListSurface = useCallback(() => {
    setActiveWorkspaceTab('overview');
    setRequestRoleFilter('');
    setActiveSurface('list');
    setListPage(1);
    setActiveSavedViewId(null);
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setTransitionStatusCode('');
    setProcessDetail(null);
  }, [setProcessDetail]);

  const handleMasterFieldChange = useCallback(
    (field: string, value: unknown) => {
      setMasterDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setMasterDraft]
  );

  const handleProcessDraftChange = useCallback(
    (field: string, value: unknown) => {
      setProcessDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setProcessDraft]
  );

  const handleUpdateIt360Row = useCallback(
    (localId: string, field: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => {
      setFormIt360Tasks((prev) =>
        prev.map((r) => (r.local_id === localId ? { ...r, [field]: value } : r))
      );
    },
    [setFormIt360Tasks]
  );

  const handleRemoveIt360Row = useCallback(
    (localId: string) => {
      setFormIt360Tasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormIt360Tasks]
  );

  const handleUpdateRefRow = useCallback(
    (localId: string, value: string) => {
      const normalizedValue = String(value || '').trim();
      const found = taskReferenceLookup.get(normalizedValue.toLowerCase())
        ?? taskReferenceLookup.get(normalizedValue);

      setFormReferenceTasks((prev) =>
        prev.map((r) =>
          r.local_id === localId
            ? {
                ...r,
                id: found?.id ?? r.id ?? null,
                task_code: found?.task_code ?? normalizedValue,
              }
            : r
        )
      );

      // Trigger search to load full data for the selected task
      // This ensures the task appears in dropdown and is available for submission
      if (found?.task_code && found.task_code !== searchKeyword) {
        setSearchKeyword(found.task_code);
      }
    },
    [setFormReferenceTasks, taskReferenceLookup, setSearchKeyword, searchKeyword]
  );

  const handleRemoveRefRow = useCallback(
    (localId: string) => {
      setFormReferenceTasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormReferenceTasks]
  );

  const handleAddTaskRow = useCallback(() => {
    if (activeTaskTab === 'IT360') {
      setFormIt360Tasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' },
      ]);
    } else {
      setFormReferenceTasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '' },
      ]);
    }
  }, [activeTaskTab, setFormIt360Tasks, setFormReferenceTasks]);

  /** Dùng riêng cho modal tạo mới (tab nội bộ trong modal) */
  const handleAddIt360Task = useCallback(() => {
    setFormIt360Tasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' as const },
    ]);
  }, [setFormIt360Tasks]);

  const handleAddReferenceTask = useCallback(() => {
    setFormReferenceTasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '' },
    ]);
  }, [setFormReferenceTasks]);

  const handleUploadAttachment = useCallback(
    async (file: File) => {
      setAttachmentError('');
      setAttachmentNotice('');
      setIsUploadingAttachment(true);

      // Debug: log file info before upload
      console.log('[CustomerRequestManagementHub] Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        hasContent: file.size > 0,
      });

      try {
        const uploaded = await uploadDocumentAttachment(file);
        setFormAttachments((prev) => [...prev, uploaded]);
        setAttachmentNotice(`Đã tải lên ${file.name}`);
      } catch (e: unknown) {
        setAttachmentError(e instanceof Error ? e.message : 'Tải file thất bại.');
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [setFormAttachments]
  );

  const handleDeleteAttachment = useCallback(
    async (id: string | number) => {
      setFormAttachments((prev) => prev.filter((a) => String(a.id) !== String(id)));
    },
    [setFormAttachments]
  );

  const handleSaveCase = useCallback(async () => {
    if (!canWriteRequests) return;
    if (!isCreateMode) return;

    const plan = resolveCreateRequestPlan(createFlowDraft, { actorUserId: currentUserId });
    if (plan.validationErrors.length > 0) {
      notify('error', 'Tạo yêu cầu thất bại', plan.validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    try {
      const basePayload = buildPayloadFromDraft(masterFields, masterDraft);

      // --- Canonical persist: gửi attachments + ref_tasks cùng request tạo mới ---
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : {}),
            ...(r.task_code.trim() !== '' ? { task_code: r.task_code.trim() } : {}),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...basePayload,
        ...plan.masterOverrides,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        // Include workflow_definition_id if selected
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const created = await createYeuCau(payload);
      let effectiveRequest = created;
      const followUpWarnings: string[] = [];

      if (plan.estimatePayload && created.id != null) {
        try {
          const estimateResult = await createYeuCauEstimate(created.id, plan.estimatePayload);
          effectiveRequest = estimateResult.request_case ?? effectiveRequest;
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được ước lượng ban đầu: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      // Save tags if any
      if (createFormTags.length > 0 && created.id != null) {
        try {
          const normalizedTags = createFormTags
            .map((tag) => ({
              name: String(tag.name ?? '').trim().toLowerCase(),
              color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
            }))
            .filter((tag) => tag.name.length > 0);

          await saveYeuCauCaseTags(created.id, normalizedTags);
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được tags: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      setIsCreateMode(false);
      setCreateFormTags([]);
      setSelectedRequestId(effectiveRequest.id ?? created.id);
      setSelectedRequestPreview(effectiveRequest);
      setActiveEditorProcessCode(resolveRequestProcessCode(effectiveRequest) || 'new_intake');
      // bumpDataVersion triggers useCustomerRequestDetail to reload detail
      // (GET rehydrate) and populate formAttachments/formIt360Tasks/formReferenceTasks
      // with persisted data from server — see §4.5 frontend create-flow complete.
      bumpDataVersion();

      const requestCode =
        effectiveRequest.ma_yc ??
        effectiveRequest.request_code ??
        created.ma_yc ??
        created.request_code ??
        '';

      if (followUpWarnings.length > 0) {
        notify(
          'warning',
          'Tạo yêu cầu chưa hoàn tất toàn bộ',
          [`Đã tạo yêu cầu ${requestCode}.`, ...followUpWarnings].join(' ')
        );
      } else {
        notify('success', 'Tạo yêu cầu', `Đã tạo yêu cầu ${requestCode}`);
      }
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Tạo yêu cầu thất bại',
          e instanceof Error ? e.message : 'Không thể tạo yêu cầu.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    createFlowDraft,
    currentUserId,
    masterFields,
    masterDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    createFormTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
  ]);

  const handleSaveStatusDetail = useCallback(async () => {
    if (!canWriteRequests || isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    setIsSaving(true);
    try {
      const masterPayload = buildPayloadFromDraft(masterFields, masterDraft);
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : { task_code: r.task_code.trim() }),
          })),
      ];

      await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, {
        master_payload: masterPayload,
        status_payload: processDraft,
        ref_tasks: refTasksPayload,
      });
      bumpDataVersion();
      notify('success', 'Cập nhật trạng thái', 'Đã cập nhật thông tin trạng thái.');
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Cập nhật trạng thái thất bại',
          e instanceof Error ? e.message : 'Không thể cập nhật trạng thái.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formIt360Tasks,
    formReferenceTasks,
    bumpDataVersion,
    notify,
  ]);

  const handleSaveTaskReference = useCallback(async () => {
    if (!canWriteRequests || isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    setIsSaving(true);
    try {
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : {}),
            ...(r.task_code.trim() !== '' ? { task_code: r.task_code.trim() } : {}),
          })),
      ];

      await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, {
        ref_tasks: refTasksPayload,
      });
      bumpDataVersion();
      notify('success', 'Cập nhật Task/Ref', 'Đã cập nhật danh sách task liên quan.');
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Cập nhật Task/Ref thất bại',
          e instanceof Error ? e.message : 'Không thể cập nhật task liên quan.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    formIt360Tasks,
    formReferenceTasks,
    bumpDataVersion,
    notify,
  ]);

  const handleDeleteCase = useCallback(async () => {
    if (!canDeleteRequests || !selectedRequestId) return;
    const row = patchedListRows.find((r) => String(r.id) === String(selectedRequestId));
    const label = row?.ma_yc ?? row?.request_code ?? String(selectedRequestId);
    if (!window.confirm(`Xóa yêu cầu ${label}?`)) return;
    try {
      await deleteYeuCau(selectedRequestId);
      setSelectedRequestId(null);
      setSelectedRequestPreview(null);
      setIsCreateMode(false);
      bumpDataVersion();
      notify('success', 'Xóa yêu cầu', 'Đã xóa yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Xóa yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể xóa.'
      );
    }
  }, [canDeleteRequests, selectedRequestId, patchedListRows, bumpDataVersion, notify]);

  const handleUpdateCase = useCallback(async () => {
    if (!canWriteRequests || !selectedRequestId || !activeEditorProcessCode) return;
    try {
      setIsSaving(true);

      const normalizedTags = formTags
        .map((tag) => ({
          name: String(tag.name ?? '').trim().toLowerCase(),
          color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
        }))
        .filter((tag) => tag.name.length > 0);

      // Build attachments payload
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      // Build ref_tasks payload (IT360 + Reference tasks)
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            task_code: r.task_code.trim(),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...buildPayloadFromDraft(masterFields, masterDraft),
        ...processDraft,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const updated = await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, payload);
      setSelectedRequestPreview(updated);

      if (selectedRequestId != null) {
        try {
          const savedTags = await saveYeuCauCaseTags(selectedRequestId, normalizedTags);
          setFormTags(savedTags);
        } catch (error: unknown) {
          notify(
            'warning',
            'Cập nhật tags chưa hoàn tất',
            error instanceof Error ? error.message : 'Không thể đồng bộ tags.'
          );
        }
      }

      bumpDataVersion();
      notify('success', 'Cập nhật yêu cầu', 'Đã cập nhật yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Cập nhật yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể cập nhật.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    formTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
    setFormTags,
  ]);

  /**
   * Handler chỉ để lưu attachments riêng biệt (dùng cho tab Files)
   */
  const handleSaveAttachmentsOnly = useCallback(async () => {
    if (!selectedRequestId) return;
    try {
      setIsSaving(true);

      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      if (attachmentsPayload.length === 0) {
        notify('info', 'Cập nhật tệp đính kèm', 'Không có tệp mới để lưu.');
        return;
      }

      await saveYeuCauCaseAttachments(selectedRequestId, attachmentsPayload);
      bumpDataVersion();
      notify('success', 'Cập nhật tệp đính kèm', 'Đã lưu tệp đính kèm.');
    } catch (e: unknown) {
      notify(
        'error',
        'Cập nhật tệp đính kèm thất bại',
        e instanceof Error ? e.message : 'Không thể lưu tệp đính kèm.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [selectedRequestId, formAttachments, bumpDataVersion, notify]);

  const handleOpenTransitionModal = useCallback(() => {
    if (!transitionStatusCode) return;
    transitionHook.openTransitionModal({
      targetProcessMeta: processMap.get(transitionStatusCode) ?? null,
    });
  }, [transitionStatusCode, transitionHook, processMap]);

  const handleRunDispatcherAction = useCallback(
    (action: DispatcherQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunPerformerAction = useCallback(
    (action: PerformerQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunListPrimaryAction = useCallback(
    (row: YeuCau, action: CustomerRequestPrimaryActionMeta) => {
      const isCurrentSelection =
        !isCreateMode &&
        selectedRequestId !== null &&
        String(selectedRequestId) === String(row.id) &&
        String(processDetail?.yeu_cau?.id ?? '') === String(row.id);

      if (action.kind === 'detail' && !action.targetStatusCode) {
        if (!isCurrentSelection) {
          handleSelectRow(row);
        }
        return;
      }

      if (isCurrentSelection && runPrimaryActionForLoadedRequest(action)) {
        return;
      }

      handleSelectRow(row);
      setPendingPrimaryAction({ requestId: String(row.id), action });
    },
    [
      handleSelectRow,
      isCreateMode,
      processDetail?.yeu_cau?.id,
      runPrimaryActionForLoadedRequest,
      selectedRequestId,
    ]
  );

  const handleModalStatusPayloadChange = useCallback(
    (fieldName: string, value: unknown) => {
      transitionHook.setModalStatusPayload((prev) => ({ ...prev, [fieldName]: value }));
    },
    [transitionHook]
  );

  // Status count helper for dashboard cards
  const getStatusCount = useCallback(
    (statusCode: string): number => {
      if (!patchedOverviewDashboard) return 0;
      const found = patchedOverviewDashboard.summary.status_counts.find(
        (s) => s.status_code === statusCode
      );
      return found?.count ?? 0;
    },
    [patchedOverviewDashboard]
  );

  // Alert counts
  const alertCounts = useMemo(
    () => ({
      missing_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.missing_estimate ?? 0,
      over_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.over_estimate ?? 0,
      sla_risk: patchedOverviewDashboard?.summary?.alert_counts?.sla_risk ?? 0,
    }),
    [patchedOverviewDashboard]
  );

  // Customer options for list pane filter
  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((c) => {
        const raw = c as unknown as Record<string, unknown>;
        const displayLabel = String(
          c.customer_name ||
            raw.name ||
            raw.company_name ||
            `Khách hàng #${c.id}`
        );
        return {
          value: String(c.id),
          label: displayLabel,
          searchText: [
            c.customer_name,
            c.customer_code,
            c.tax_code,
            raw.name,
            raw.company_name,
            c.id,
          ]
            .filter(Boolean)
            .join(' '),
        };
      }),
    [customers]
  );

  const projectItemOptions = useMemo<SearchableSelectOption[]>(() => {
    const dedup = new Map<string, SearchableSelectOption>();

    effectiveProjectItems.forEach((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const value = String(item.id ?? raw.project_item_id ?? raw.projectItemId ?? '').trim();
      if (!value) {
        return;
      }

      const code = String(
        raw.project_item_code
          || raw.projectItemCode
          || raw.item_code
          || raw.itemCode
          || raw.external_code
          || raw.externalCode
          || raw.code
          || ''
      ).trim();
      const name = String(
        raw.item_name
          || raw.itemName
          || raw.project_item_name
          || raw.projectItemName
          || raw.display_name
          || raw.displayName
          || raw.name
          || `Dự án/Sản phẩm #${value}`
      ).trim();
      const label = code ? `${code} - ${name}` : name;

      dedup.set(value, {
        value,
        label,
        searchText: `${code} ${name}`.trim(),
      });
    });

    return Array.from(dedup.values());
  }, [effectiveProjectItems]);

  const [tagFilterOptions, setTagFilterOptions] = useState<SearchableSelectOption[]>([]);

  useEffect(() => {
    if (!canReadRequests) {
      setTagFilterOptions([]);
      return;
    }

    let cancelled = false;

    const fetchTagOptions = async () => {
      try {
        const response = await apiFetch('/api/v5/tags/suggestions?per_page=100', {
          headers: { Accept: 'application/json' },
          cancelKey: 'tags:suggestions:filter',
        });

        if (!response.ok) {
          throw new Error('Không thể tải danh sách tags.');
        }

        const payload = (await response.json()) as { tags?: Tag[]; data?: Tag[] };
        const source = Array.isArray(payload.tags)
          ? payload.tags
          : Array.isArray(payload.data)
            ? payload.data
            : [];

        const options = source.map((tag) => ({
          value: String(tag.id),
          label: tag.name,
          searchText: `${tag.name} ${tag.color ?? ''}`,
        }));

        if (!cancelled) {
          setTagFilterOptions(options);
        }
      } catch (error: unknown) {
        if (!cancelled && !isRequestCanceledError(error)) {
          notify(
            'error',
            'Tải tags thất bại',
            error instanceof Error ? error.message : 'Không thể tải danh sách tags.'
          );
        }
      }
    };

    void fetchTagOptions();

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, notify]);

  const entityFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      ...customerOptions,
      ...projectItemOptions,
    ],
    [customerOptions, projectItemOptions]
  );

  const pinnedRequestIds = useMemo(
    () => new Set(pinnedItems.map((item) => String(item.requestId))),
    [pinnedItems]
  );

  const selectedRequestSummary = useMemo<YeuCau | null>(() => {
    if (!selectedRequestId) {
      return null;
    }

    const detailRequest = processDetail?.yeu_cau ?? null;
    const previewRequest =
      selectedRequestPreview && String(selectedRequestPreview.id) === String(selectedRequestId)
        ? selectedRequestPreview
        : null;
    const matchedDetailRequest =
      detailRequest && String(detailRequest.id) === String(selectedRequestId)
        ? detailRequest
        : null;

    return (
      patchedListRows.find((row) => String(row.id) === String(selectedRequestId)) ??
      matchedDetailRequest ??
      getPatchedRequest(previewRequest) ??
      null
    );
  }, [
    getPatchedRequest,
    patchedListRows,
    processDetail?.yeu_cau,
    selectedRequestId,
    selectedRequestPreview,
  ]);

  useEffect(() => {
    setDraftActiveProcessCodes(activeProcessCodes);
    setDraftRequestKeywordInput(requestKeyword);
    setDraftRequestEntityFilter(requestEntityFilter);
    setDraftRequestTagFilter(requestTagFilter);
    setDraftRequestPriorityFilter(requestPriorityFilter);
    setDraftRequestCreatedFrom(requestCreatedFrom);
    setDraftRequestCreatedTo(requestCreatedTo);
    setDraftRequestMissingEstimateFilter(requestMissingEstimateFilter);
    setDraftRequestOverEstimateFilter(requestOverEstimateFilter);
    setDraftRequestSlaRiskFilter(requestSlaRiskFilter);
  }, [
    activeProcessCodes,
    requestKeyword,
    requestEntityFilter,
    requestTagFilter,
    requestPriorityFilter,
    requestCreatedFrom,
    requestCreatedTo,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestSlaRiskFilter,
  ]);

  const dashboardRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);

  const sharedSurfaceFilters = useMemo<SharedSurfaceFilterState>(
    () => ({
      activeProcessCodes,
      requestKeyword,
      requestEntityFilter,
      requestTagFilter,
      requestPriorityFilter,
      requestCreatedFrom,
      requestCreatedTo,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestSlaRiskFilter,
    }),
    [
      activeProcessCodes,
      requestKeyword,
      requestEntityFilter,
      requestTagFilter,
      requestPriorityFilter,
      requestCreatedFrom,
      requestCreatedTo,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestSlaRiskFilter,
    ]
  );

  const sharedAdvancedFilterCount = useMemo(
    () =>
      [
        draftRequestEntityFilter.length > 0,
        draftRequestTagFilter.length > 0,
        draftRequestPriorityFilter.length > 0,
        draftRequestMissingEstimateFilter,
        draftRequestOverEstimateFilter,
        draftRequestSlaRiskFilter,
      ].filter(Boolean).length,
    [
      draftRequestEntityFilter,
      draftRequestTagFilter,
      draftRequestPriorityFilter,
      draftRequestMissingEstimateFilter,
      draftRequestOverEstimateFilter,
      draftRequestSlaRiskFilter,
    ]
  );

  const hasListFilters =
    !!(
      activeProcessCodes.length > 0 ||
      requestKeyword ||
      requestEntityFilter.length > 0 ||
      requestTagFilter.length > 0 ||
      requestPriorityFilter.length > 0 ||
      requestCreatedFrom !== defaultCreatedRange.from ||
      requestCreatedTo !== defaultCreatedRange.to ||
      (requestRoleFilter &&
        requestRoleFilter !== workspaceTabToRoleFilter(activeWorkspaceTab)) ||
      requestMissingEstimateFilter ||
      requestOverEstimateFilter ||
      requestSlaRiskFilter
    );

  const hasDraftFilterChanges =
    requestKeyword !== draftRequestKeywordInput.trim() ||
    requestHandlerKeyword !== draftRequestHandlerKeywordInput.trim() ||
    requestCreatedFrom !== draftRequestCreatedFrom ||
    requestCreatedTo !== draftRequestCreatedTo ||
    requestMissingEstimateFilter !== draftRequestMissingEstimateFilter ||
    requestOverEstimateFilter !== draftRequestOverEstimateFilter ||
    requestSlaRiskFilter !== draftRequestSlaRiskFilter ||
    buildNormalizedFilterCompareKey(activeProcessCodes) !==
      buildNormalizedFilterCompareKey(draftActiveProcessCodes) ||
    buildNormalizedFilterCompareKey(requestEntityFilter) !==
      buildNormalizedFilterCompareKey(draftRequestEntityFilter) ||
    buildNormalizedFilterCompareKey(requestTagFilter) !==
      buildNormalizedFilterCompareKey(draftRequestTagFilter) ||
    buildNormalizedFilterCompareKey(requestPriorityFilter) !==
      buildNormalizedFilterCompareKey(draftRequestPriorityFilter);

  const canSubmitFilters = true;

  const handleClearFilters = useCallback(() => {
    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setDraftActiveProcessCodes([]);
    setDraftRequestKeywordInput('');
    setDraftRequestEntityFilter([]);
    setDraftRequestTagFilter([]);
    setDraftRequestPriorityFilter([]);
    setDraftRequestCreatedFrom(defaultCreatedRange.from);
    setDraftRequestCreatedTo(defaultCreatedRange.to);
    setDraftRequestMissingEstimateFilter(false);
    setDraftRequestOverEstimateFilter(false);
    setDraftRequestSlaRiskFilter(false);

    setActiveProcessCodes([]);
    setRequestKeyword('');
    setRequestEntityFilter([]);
    setRequestTagFilter([]);
    setRequestPriorityFilter([]);
    setRequestCreatedFrom(defaultCreatedRange.from);
    setRequestCreatedTo(defaultCreatedRange.to);
    setRequestRoleFilter(defaultRoleFilter);
    setRequestMissingEstimateFilter(false);
    setRequestOverEstimateFilter(false);
    setRequestSlaRiskFilter(false);
    setListPage(1);
  }, [activeWorkspaceTab, defaultCreatedRange.from, defaultCreatedRange.to]);

  useEffect(() => {
    if (activeSurface === 'analytics') {
      return;
    }

    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setRequestRoleFilter((prev) => (prev === defaultRoleFilter ? prev : defaultRoleFilter));
  }, [activeSurface, activeWorkspaceTab]);

  useEffect(() => {
    if (!activeSavedViewId) {
      return;
    }

    const activeView = DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS.find(
      (view) => view.id === activeSavedViewId
    );

    if (!activeView) {
      setActiveSavedViewId(null);
      return;
    }

    const filters = activeView.filters ?? {};
    const expectedProcessCodes = normalizeFilterValues(filters.processCodes ?? [filters.processCode]);
    const expectedEntityFilters = normalizeFilterValues([
      ...(filters.customerIds ?? []),
      ...(filters.supportGroupIds ?? []),
      ...(filters.customerId ? [filters.customerId] : []),
      ...(filters.supportGroupId ? [filters.supportGroupId] : []),
    ]);
    const expectedTagFilters = normalizeFilterValues(filters.tagIds);
    const expectedPriorityFilters = normalizeFilterValues(filters.priorities ?? [filters.priority]);

    const matches =
      activeWorkspaceTab === activeView.workspaceTab &&
      activeSurface === activeView.surface &&
      requestKeyword === (filters.keyword ?? '') &&
      requestRoleFilter ===
        (filters.roleFilter ?? workspaceTabToRoleFilter(activeView.workspaceTab)) &&
      requestMissingEstimateFilter === Boolean(filters.missingEstimate) &&
      requestOverEstimateFilter === Boolean(filters.overEstimate) &&
      requestSlaRiskFilter === Boolean(filters.slaRisk) &&
      expectedProcessCodes.length === normalizeFilterValues(activeProcessCodes).length &&
      expectedProcessCodes.every((code) => normalizeFilterValues(activeProcessCodes).includes(code)) &&
      expectedEntityFilters.length === normalizeFilterValues(requestEntityFilter).length &&
      expectedEntityFilters.every((value) => normalizeFilterValues(requestEntityFilter).includes(value)) &&
      expectedTagFilters.length === normalizeFilterValues(requestTagFilter).length &&
      expectedTagFilters.every((value) => normalizeFilterValues(requestTagFilter).includes(value)) &&
      expectedPriorityFilters.length === normalizeFilterValues(requestPriorityFilter).length &&
      expectedPriorityFilters.every((value) => normalizeFilterValues(requestPriorityFilter).includes(value));

    if (!matches) {
      setActiveSavedViewId(null);
    }
  }, [
    activeProcessCodes,
    activeSavedViewId,
    activeSurface,
    activeWorkspaceTab,
    requestEntityFilter,
    requestKeyword,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestPriorityFilter,
    requestRoleFilter,
    requestSlaRiskFilter,
    requestTagFilter,
  ]);

  // Creator workspace name
  const creatorName = useMemo(() => {
    if (!currentUserId) return null;
    const user = employees.find((e) => String(e.id) === String(currentUserId));
    return user?.full_name ?? null;
  }, [employees, currentUserId]);

  const handleTransitionStatusCodeChange = useCallback((value: string) => {
    setTransitionStatusCode(value);
  }, []);

  const handleCreateFlowDraftChange = useCallback(
    (patch: Partial<CustomerRequestCreateFlowDraft>) => {
      setCreateFlowDraft((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleOpenWorklogModal = useCallback(() => {
    setWorklogModalContext({
      mode: 'worklog',
      title: 'Ghi giờ công',
      eyebrow: 'Giờ công',
      submitLabel: 'Lưu giờ công',
      detailStatusAction: null,
      editingWorklog: null,
    });
    setShowWorklogModal(true);
  }, []);

  const handleOpenDetailStatusWorklogModal = useCallback((action: 'in_progress' | 'paused') => {
    setWorklogModalContext({
      mode: 'detail_status_worklog',
      title: action === 'paused' ? 'Tạm ngưng xử lý' : 'Đánh dấu đang thực hiện',
      eyebrow: 'Trạng thái xử lý',
      submitLabel: action === 'paused' ? 'Lưu tạm ngưng' : 'Lưu đang thực hiện',
      detailStatusAction: action,
      editingWorklog: null,
    });
    setShowWorklogModal(true);
  }, []);

  const handleEditWorklog = useCallback((worklog: YeuCauWorklog) => {
    setWorklogModalContext({
      mode: 'edit_worklog',
      title: 'Cập nhật giờ công',
      eyebrow: 'Chỉnh sửa worklog',
      submitLabel: 'Lưu cập nhật',
      detailStatusAction: null,
      editingWorklog: worklog,
    });
    setShowWorklogModal(true);
  }, []);

  const handleCloseWorklogModal = useCallback(() => {
    setShowWorklogModal(false);
    setWorklogModalContext(null);
  }, []);

  const handleOpenEstimateModal = useCallback(() => {
    setShowEstimateModal(true);
  }, []);

  const handleCloseEstimateModal = useCallback(() => {
    setShowEstimateModal(false);
  }, []);

  const handleSurfaceChange = useCallback((surface: CustomerRequestSurfaceKey) => {
    setActiveSurface(surface);
    setActiveSavedViewId(null);
  }, []);

  const handleDownloadIntakeTemplate = useCallback(async () => {
    if (!canImportRequests) {
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      const response = await fetchCustomerRequestIntakeTemplate(selectedWorkflowId);
      const template = response?.data ?? {};
      const headers = template.headers || [];
      const taskHeaders = template.task_headers || [];
      const priorityLabels = template.priority_labels || [];
      const taskSources = template.task_sources || [];
      const taskStatuses = template.task_statuses || [];

      const orderedHeaders = (() => {
        const result = [...headers];
        const projectIndex = result.indexOf('project_item_code');
        const customerIndex = result.indexOf('customer_code');
        if (projectIndex !== -1 && customerIndex !== -1 && projectIndex > customerIndex) {
          const [projectHeader] = result.splice(projectIndex, 1);
          result.splice(customerIndex, 0, projectHeader);
        }
        return result;
      })();

      const viHeaders = orderedHeaders.map((header) => mapHeaderToVietnamese(header, CRC_INTAKE_HEADER_LABELS));
      const viTaskHeaders = taskHeaders.map((header) => mapHeaderToVietnamese(header, CRC_INTAKE_TASK_HEADER_LABELS));

      const personnelRows = employees
        .map((employee) => {
          const code = String((employee as unknown as Record<string, unknown>).user_code || '').trim();
          const username = String(employee.username || '').trim();
          const fullName = String(employee.full_name || '').trim();
          if (!code && !username && !fullName) {
            return null;
          }
          const effectiveCode = code || username;
          return [effectiveCode, fullName || username, username] as const;
        })
        .filter((row): row is readonly [string, string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const customerIdToCode = new Map<string, string>();
      const customerRows = customers
        .map((customer) => {
          const raw = customer as unknown as Record<string, unknown>;
          const code = String(
            customer.customer_code
              || raw.customer_code
              || raw.customerCode
              || raw.code
              || ''
          ).trim();
          const name = String(
            customer.customer_name
              || raw.customer_name
              || raw.customerName
              || raw.company_name
              || raw.companyName
              || raw.name
              || ''
          ).trim();
          const customerId = String(customer.id || raw.customer_id || raw.customerId || raw.id || '').trim();
          if (!code && !name) {
            return null;
          }
          if (customerId && code) {
            customerIdToCode.set(customerId, code);
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const projectItemRows = effectiveProjectItems
        .map((item) => {
          const raw = item as unknown as Record<string, unknown>;
          const code = String(
            raw.project_item_code
              || raw.projectItemCode
              || raw.item_code
              || raw.itemCode
              || raw.external_code
              || raw.externalCode
              || raw.code
              || item.id
              || ''
          ).trim();
          const name = String(
            raw.item_name
              || raw.itemName
              || raw.project_item_name
              || raw.projectItemName
              || raw.display_name
              || raw.displayName
              || raw.name
              || ''
          ).trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const projectItemByCustomerCode = new Map<string, Array<readonly [string, string]>>();
      effectiveProjectItems.forEach((item) => {
        const raw = item as unknown as Record<string, unknown>;
        const code = String(
          raw.project_item_code
            || raw.projectItemCode
            || raw.item_code
            || raw.itemCode
            || raw.external_code
            || raw.externalCode
            || raw.code
            || item.id
            || ''
        ).trim();
        const name = String(
          raw.item_name
            || raw.itemName
            || raw.project_item_name
            || raw.projectItemName
            || raw.display_name
            || raw.displayName
            || raw.name
            || ''
        ).trim();
        if (!code && !name) {
          return;
        }

        const customerCode = String(raw.customer_code || raw.customerCode || '').trim();
        const customerId = String(raw.customer_id || raw.customerId || '').trim();
        const resolvedCustomerCode = customerCode || customerIdToCode.get(customerId) || '';
        if (!resolvedCustomerCode) {
          return;
        }
        const currentRows = projectItemByCustomerCode.get(resolvedCustomerCode) || [];
        const dedupKey = `${code}__${name}`;
        if (!currentRows.some(([existingCode, existingName]) => `${existingCode}__${existingName}` === dedupKey)) {
          currentRows.push([code, name]);
          projectItemByCustomerCode.set(resolvedCustomerCode, currentRows);
        }
      });

      if (projectItemRows.length === 0 && projectItemByCustomerCode.size > 0) {
        projectItemByCustomerCode.forEach((rows) => {
          rows.forEach(([code, name]) => {
            const normalizedCode = String(code || '').trim();
            const normalizedName = String(name || '').trim();
            if (normalizedCode || normalizedName) {
              projectItemRows.push([normalizedCode, normalizedName]);
            }
          });
        });
      }


      const dedupProjectItemMap = new Map<string, readonly [string, string]>();
      projectItemRows.forEach((row) => {
        dedupProjectItemMap.set(`${row[0]}__${row[1]}`, row);
      });
      const finalProjectItemRows = Array.from(dedupProjectItemMap.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));


      const projectItemRowsForTemplate =
        finalProjectItemRows.length > 0
          ? finalProjectItemRows
          : Array.from(new Map(
              Array.from(projectItemByCustomerCode.values())
                .flatMap((rows) => rows)
                .map((row) => [`${row[0]}__${row[1]}`, row] as const)
            ).values())
              .filter((row): row is readonly [string, string] => Array.isArray(row) && row.length >= 2)
              .map((row) => [String(row[0] || ''), String(row[1] || '')] as const)
              .filter(([code, name]) => Boolean(code || name))
              .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const finalProjectItemByCustomerCode = new Map<string, readonly (readonly [string, string])[]>();
      projectItemByCustomerCode.forEach((rows, customerCode) => {
        finalProjectItemByCustomerCode.set(
          customerCode,
          [...rows].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
        );
      });

      const customerPersonnelRows = customerPersonnel
        .map((person) => {
          const raw = person as unknown as Record<string, unknown>;
          const code = String(
            raw.personnel_code
              || raw.personnelCode
              || raw.customer_personnel_code
              || raw.customerPersonnelCode
              || raw.contact_code
              || raw.contactCode
              || raw.code
              || raw.personnel_id
              || raw.personnelId
              || raw.id
              || person.id
              || ''
          ).trim();
          const name = String(
            raw.full_name
              || raw.fullName
              || raw.personnel_name
              || raw.personnelName
              || raw.name
              || ''
          ).trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const dedupCustomerPersonnelMap = new Map<string, readonly [string, string]>();
      customerPersonnelRows.forEach((row) => {
        dedupCustomerPersonnelMap.set(`${row[0]}__${row[1]}`, row);
      });
      const finalCustomerPersonnelRows = Array.from(dedupCustomerPersonnelMap.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const customerPersonnelByCustomerCode = new Map<string, Array<readonly [string, string]>>();
      customerPersonnel.forEach((person) => {
        const raw = person as unknown as Record<string, unknown>;
        const code = String(
          raw.personnel_code
            || raw.personnelCode
            || raw.customer_personnel_code
            || raw.customerPersonnelCode
            || raw.contact_code
            || raw.contactCode
            || raw.code
            || raw.personnel_id
            || raw.personnelId
            || raw.id
            || person.id
            || ''
        ).trim();
        const name = String(
          raw.full_name
            || raw.fullName
            || raw.personnel_name
            || raw.personnelName
            || raw.name
            || ''
        ).trim();
        if (!code && !name) {
          return;
        }

        const customerCode = String(raw.customer_code || raw.customerCode || '').trim();
        const customerId = String(raw.customer_id || raw.customerId || person.customerId || '').trim();
        const resolvedCustomerCode = customerCode || customerIdToCode.get(customerId) || '';

        if (!resolvedCustomerCode) {
          return;
        }

        const currentRows = customerPersonnelByCustomerCode.get(resolvedCustomerCode) || [];
        const dedupKey = `${code}__${name}`;
        if (!currentRows.some(([existingCode, existingName]) => `${existingCode}__${existingName}` === dedupKey)) {
          currentRows.push([code, name]);
          customerPersonnelByCustomerCode.set(resolvedCustomerCode, currentRows);
        }
      });

      if (finalCustomerPersonnelRows.length === 0 && customerPersonnelByCustomerCode.size > 0) {
        customerPersonnelByCustomerCode.forEach((rows) => {
          rows.forEach(([code, name]) => {
            const normalizedCode = String(code || '').trim();
            const normalizedName = String(name || '').trim();
            if (normalizedCode || normalizedName) {
              finalCustomerPersonnelRows.push([normalizedCode, normalizedName]);
            }
          });
        });
      }

      const dedupFallbackCustomerPersonnel = new Map<string, readonly [string, string]>();
      finalCustomerPersonnelRows.forEach((row) => {
        dedupFallbackCustomerPersonnel.set(`${row[0]}__${row[1]}`, row);
      });
      const finalCustomerPersonnelRowsForTemplate = Array.from(dedupFallbackCustomerPersonnel.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const finalCustomerPersonnelByCustomerCode = new Map<string, readonly (readonly [string, string])[]>();
      customerPersonnelByCustomerCode.forEach((rows, customerCode) => {
        finalCustomerPersonnelByCustomerCode.set(
          customerCode,
          [...rows].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
        );
      });

      const sourceChannelRows = ['Email', 'Điện thoại', 'Zalo', 'Portal', 'Khác'];
      const priorityRows = (priorityLabels.length > 0 ? priorityLabels : ['Thấp', 'Trung bình', 'Cao', 'Khẩn']).map((value) => [value]);
      const supportGroupRows = supportServiceGroups
        .map((group) => {
          const raw = group as unknown as Record<string, unknown>;
          const isDeleted = raw.deleted_at !== null && raw.deleted_at !== undefined && String(raw.deleted_at).trim() !== '';
          const isInactive = raw.is_active === false || raw.is_active === 0 || raw.is_active === '0';
          if (isDeleted || isInactive) {
            return null;
          }
          const code = String(group.group_code || '').trim();
          const name = String(group.group_name || '').trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const hasLookupData =
        customerRows.length > 0 ||
        projectItemRowsForTemplate.length > 0 ||
        finalCustomerPersonnelRowsForTemplate.length > 0 ||
        supportGroupRows.length > 0 ||
        personnelRows.length > 0;

      const { blob, fileName } = await createCrcIntakeTemplateWorkbook({
        fileNameBase: 'import_mau_customer_request_tiep_nhan',
        intakeSheetName: template.sheet || 'YeuCauNhap',
        taskSheetName: template.task_sheet || 'YeuCauTasks',
        viHeaders,
        viTaskHeaders,
        customerRows,
        projectItemRows: projectItemRowsForTemplate,
        customerPersonnelRows: finalCustomerPersonnelRowsForTemplate,
        supportGroupRows,
        personnelRows,
        projectItemByCustomerCode: finalProjectItemByCustomerCode,
        customerPersonnelByCustomerCode: finalCustomerPersonnelByCustomerCode,
        sourceChannelRows,
        priorityRows: priorityRows.map((row) => row[0]),
        taskSources,
        taskStatuses,
        hasLookupData,
        headerOrder: orderedHeaders,
      });

      triggerBrowserDownload(blob, fileName);

      notify('success', 'Template import', 'Đã tải file mẫu intake (.xlsx) có dropdown ở sheet YeuCauNhap.');
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Tải template thất bại',
          error instanceof Error ? error.message : 'Không thể tải template import.'
        );
      }
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, [
    canImportRequests,
    effectiveProjectItems,
    customers,
    customerPersonnel,
    supportServiceGroups,
    employees,
    isRequestCanceledError,
    notify,
    selectedWorkflowId,
  ]);


  const handleExportIntake = useCallback(async () => {
    if (!canExportRequests) {
      return;
    }

    setIsExportingIntake(true);
    try {
      const exported = await exportCustomerRequestIntake({
        q: requestKeyword || undefined,
        status_code: activeProcessCodes[0] || undefined,
      });
      triggerBrowserDownload(exported.blob, exported.filename || 'customer_request_intake.csv');
      notify('success', 'Export intake', 'Đã xuất danh sách CRC intake.');
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Export thất bại',
          error instanceof Error ? error.message : 'Không thể export danh sách intake.'
        );
      }
    } finally {
      setIsExportingIntake(false);
    }
  }, [activeProcessCodes, canExportRequests, isRequestCanceledError, notify, requestKeyword]);

  const handleImportIntake = useCallback(async (payload: ImportPayload) => {
    setIsImportingIntake(true);
    try {
      const items = buildCrcIntakeImportItems(payload);
      if (items.length === 0) {
        notify('error', 'Import intake', 'File không có dòng dữ liệu hợp lệ để import.');
        return;
      }

      const result: CustomerRequestIntakeImportResult = await importCustomerRequestIntake(items, selectedWorkflowId);
      const failureMessages = (result.errors || []).map(
        (err) => `Dòng ${err.row_number}: ${err.error_message}`
      );

      if (result.success_rows > 0) {
        bumpDataVersion();
        notify(
          result.failed_rows > 0 ? 'warning' : 'success',
          'Import intake',
          `Thành công ${result.success_rows}/${result.total_rows} dòng.${result.failed_rows > 0 ? ` Lỗi ${result.failed_rows} dòng.` : ''}`
        );
      } else {
        notify('error', 'Import intake', 'Không có dòng nào được import thành công.');
      }

      if (failureMessages.length > 0) {
        exportImportFailureFile(payload, 'Customer Request Intake', failureMessages, (type, title, message) => {
          notify(type, title, message);
        });
      }

      if (result.failed_rows === 0) {
        setShowImportModal(false);
      }
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Import intake thất bại',
          error instanceof Error ? error.message : 'Không thể import dữ liệu intake.'
        );
      }
      throw error;
    } finally {
      setIsImportingIntake(false);
    }
  }, [bumpDataVersion, isRequestCanceledError, notify, selectedWorkflowId]);

  const handleToggleSelectedRequestPin = useCallback(() => {
    if (selectedRequestSummary) {
      handleTogglePinnedRequest(selectedRequestSummary);
    }
  }, [handleTogglePinnedRequest, selectedRequestSummary]);

  const noopOpenCreatorFeedbackModal = useCallback(() => undefined, []);
  const noopOpenNotifyCustomerModal = useCallback(() => undefined, []);

  const handleRemoveModalIt360Task = useCallback(
    (localId: string) => {
      transitionHook.setModalIt360Tasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleRemoveModalReferenceTask = useCallback(
    (localId: string) => {
      transitionHook.setModalRefTasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleDeleteModalAttachment = useCallback(
    (id: string) => {
      transitionHook.setModalAttachments((prev) =>
        prev.filter((attachment) => String(attachment.id) !== String(id))
      );
    },
    [transitionHook]
  );

  const handleCloseCreateMode = useCallback(() => {
    setIsCreateMode(false);
    setSelectedRequestId(null);
  }, []);

  // -------------------------------------------------------------------------
  // 12. Render
  // -------------------------------------------------------------------------

  /* Shared ListPane props */
  const listPaneProps = {
    activeProcessCodes: draftActiveProcessCodes,
    processOptions,
    onProcessCodesChange: (values: string[]) => {
      setDraftActiveProcessCodes(values);
    },
    requestKeyword: draftRequestKeywordInput,
    onRequestKeywordChange: (v: string) => {
      setDraftRequestKeywordInput(v);
    },
    showHandlerSearch: true,
    requestHandlerKeyword: draftRequestHandlerKeywordInput,
    onRequestHandlerKeywordChange: (v: string) => {
      setDraftRequestHandlerKeywordInput(v);
    },
    onSubmitKeywordSearch: handleSubmitKeywordSearch,
    requestEntityFilter: draftRequestEntityFilter,
    onRequestEntityFilterChange: (values: string[]) => {
      setDraftRequestEntityFilter(values);
    },
    requestPriorityFilter: draftRequestPriorityFilter,
    onRequestPriorityFilterChange: (values: string[]) => {
      setDraftRequestPriorityFilter(values);
    },
    requestCreatedFrom: draftRequestCreatedFrom,
    onRequestCreatedFromChange: (v: string) => {
      setDraftRequestCreatedFrom(v);
    },
    requestCreatedTo: draftRequestCreatedTo,
    onRequestCreatedToChange: (v: string) => {
      setDraftRequestCreatedTo(v);
    },
    customerOptions,
    projectItemOptions,
    tagFilterOptions,
    requestTagFilter: draftRequestTagFilter,
    onRequestTagFilterChange: (values: string[]) => {
      setDraftRequestTagFilter(values);
    },
    requestMissingEstimateFilter: draftRequestMissingEstimateFilter,
    onToggleMissingEstimate: () => {
      setDraftRequestMissingEstimateFilter((x) => !x);
    },
    requestOverEstimateFilter: draftRequestOverEstimateFilter,
    onToggleOverEstimate: () => {
      setDraftRequestOverEstimateFilter((x) => !x);
    },
    requestSlaRiskFilter: draftRequestSlaRiskFilter,
    onToggleSlaRisk: () => {
      setDraftRequestSlaRiskFilter((x) => !x);
    },
    alertCounts,
    isDashboardLoading,
    rows: patchedListRows,
    isListLoading,
    selectedRequestId,
    onSelectRow: handleSelectRow,
    listPage,
    rowsPerPage: listPageSize,
    listMeta,
    onListPageChange: (page: number) => setListPage(page),
    onRowsPerPageChange: (rows: number) => {
      setListPageSize(rows);
      setListPage(1);
    },
    hasListFilters,
    onClearFilters: handleClearFilters,
    requestRoleFilter,
    presentation: 'responsive' as const,
    showFilterToolbar: false,
    pinnedRequestIds,
    onTogglePinRequest: handleTogglePinnedRequest,
    onPrimaryAction: handleRunListPrimaryAction,
  } as const;

  const detailPaneNode = (
    <CustomerRequestDetailPane
      isDetailLoading={isDetailLoading}
      isListLoading={isListLoading}
      isCreateMode={false}
      presentation="full_modal"
      isRequestSelected={selectedRequestId !== null}
      processDetail={processDetail}
      canTransitionActiveRequest={canTransitionActiveRequest}
      transitionOptions={detailTransitionOptions}
      transitionStatusCode={transitionStatusCode}
      onTransitionStatusCodeChange={(v) => setTransitionStatusCode(v)}
      onOpenTransitionModal={handleOpenTransitionModal}
      isSaving={isSaving}
      canEditActiveForm={canEditActiveForm}
      onSaveRequest={handleUpdateCase}
      onSaveAttachmentsOnly={handleSaveAttachmentsOnly}
      masterFields={masterFields}
      masterDraft={masterDraft}
      onMasterFieldChange={handleMasterFieldChange}
      editorProcessMeta={activeEditorMeta}
      processDraft={processDraft}
      onProcessDraftChange={handleProcessDraftChange}
      onSaveStatusDetail={handleSaveStatusDetail}
      onSaveTaskReference={handleSaveTaskReference}
      customers={localCustomers}
      employees={employees}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      availableProjectItems={effectiveProjectItems}
      selectedProjectItem={selectedProjectItem}
      selectedCustomerId={selectedCustomerId}
      activeTaskTab={activeTaskTab}
      onActiveTaskTabChange={setActiveTaskTab}
      onAddTaskRow={handleAddTaskRow}
      formIt360Tasks={formIt360Tasks}
      onUpdateIt360TaskRow={handleUpdateIt360Row}
      onRemoveIt360TaskRow={handleRemoveIt360Row}
      formReferenceTasks={formReferenceTasks}
      formTags={formTags}
      onFormTagsChange={setFormTags}
      taskReferenceOptions={taskReferenceOptions}
      onUpdateReferenceTaskRow={handleUpdateRefRow}
      onTaskReferenceSearchTermChange={setSearchKeyword}
      taskReferenceSearchTerm={searchKeyword}
      taskReferenceSearchError={searchError}
      isTaskReferenceSearchLoading={isSearchLoading}
      onRemoveReferenceTaskRow={handleRemoveRefRow}
      formAttachments={formAttachments}
      onUploadAttachment={handleUploadAttachment}
      onDeleteAttachment={handleDeleteAttachment}
      isUploadingAttachment={isUploadingAttachment}
      attachmentError={attachmentError}
      attachmentNotice={attachmentNotice}
      relatedSummaryItems={relatedSummaryItems}
      currentHoursReport={currentHoursReport}
      estimateHistory={estimateHistory}
      timeline={timeline}
      caseWorklogs={caseWorklogs}
      canOpenCreatorFeedbackModal={false}
      onOpenCreatorFeedbackModal={() => undefined}
      canOpenNotifyCustomerModal={false}
      onOpenNotifyCustomerModal={() => undefined}
      canOpenWorklogModal={canOpenWorklogModal}
      onOpenWorklogModal={handleOpenWorklogModal}
      onOpenDetailStatusWorklogModal={handleOpenDetailStatusWorklogModal}
      onEditWorklog={handleEditWorklog}
      isSubmittingWorklog={isSubmittingWorklog}
      canOpenEstimateModal={canOpenEstimateModal}
      onOpenEstimateModal={handleOpenEstimateModal}
      isSubmittingEstimate={isSubmittingEstimate}
      dispatcherQuickActions={dispatcherQuickActions}
      onRunDispatcherAction={handleRunDispatcherAction}
      performerQuickActions={performerQuickActions}
      onRunPerformerAction={handleRunPerformerAction}
    />
  );

  const detailModalFooter = (
    <div className="flex shrink-0 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-4 xl:px-5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 sm:text-[11px]">
        {formTags.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">label</span>
            {formTags.length} tag
          </span>
        ) : null}
        {formAttachments.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">attach_file</span>
            {formAttachments.length} file
          </span>
        ) : null}
        {formIt360Tasks.length + formReferenceTasks.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">task</span>
            {formIt360Tasks.length + formReferenceTasks.length} task
          </span>
        ) : null}
      </p>

      <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
        <button
          type="button"
          onClick={handleCloseDetail}
          disabled={isSaving}
          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => void handleUpdateCase()}
          disabled={!canEditActiveForm || isSaving}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-primary/20 transition hover:brightness-105 disabled:opacity-50 sm:w-auto"
        >
          <span className="material-symbols-outlined text-[15px]">save</span>
          {isSaving ? 'Đang cập nhật…' : 'Cập nhật yêu cầu'}
        </button>
      </div>
    </div>
  );

  const showDetailModal = selectedRequestId !== null;
  const attentionCaseCount = patchedOverviewDashboard?.attention_cases.length ?? 0;
  const inboxPriorityItems = useMemo<InboxPriorityItem[]>(() => {
    const attentionItems = (patchedOverviewDashboard?.attention_cases ?? []).map((item) => ({
      key: `attention-${item.request_case.id}`,
      row: item.request_case,
      reasons: item.reasons ?? [],
    }));

    const rowItems = [
      ...patchedDispatcherBuckets.queueRows,
      ...patchedDispatcherBuckets.returnedRows,
      ...patchedPerformerBuckets.pendingRows,
      ...patchedCreatorBuckets.reviewRows,
      ...patchedCreatorBuckets.notifyRows,
      ...patchedListRows,
    ].map((row) => ({
      key: `row-${row.id}`,
      row,
      reasons: [],
    }));

    return uniqInboxItems([...attentionItems, ...rowItems]);
  }, [
    patchedCreatorBuckets.notifyRows,
    patchedCreatorBuckets.reviewRows,
    patchedDispatcherBuckets.queueRows,
    patchedDispatcherBuckets.returnedRows,
    patchedListRows,
    patchedOverviewDashboard?.attention_cases,
    patchedPerformerBuckets.pendingRows,
  ]);

  const inboxBuckets = useMemo<InboxBucketMeta[]>(() => {
    const alertCounts = patchedOverviewDashboard?.summary.alert_counts;
    const countBucket = (key: InboxBucketKey) =>
      inboxPriorityItems.filter((item) => matchesInboxBucket(item, key, currentUserId)).length;

    return [
      { key: 'hot', label: 'Đặc biệt', count: attentionCaseCount || countBucket('hot') },
      { key: 'missing_estimate', label: 'Thiếu estimate', count: alertCounts?.missing_estimate ?? countBucket('missing_estimate') },
      { key: 'waiting_pm', label: 'Chờ PM', count: countBucket('waiting_pm') },
      { key: 'sla_risk', label: 'Nguy cơ SLA', count: alertCounts?.sla_risk ?? countBucket('sla_risk') },
      { key: 'over_estimate', label: 'Vượt estimate', count: alertCounts?.over_estimate ?? countBucket('over_estimate') },
      { key: 'mine', label: 'Của tôi', count: countBucket('mine') },
      { key: 'following', label: 'Đang theo dõi', count: countBucket('following') },
    ];
  }, [
    attentionCaseCount,
    currentUserId,
    inboxPriorityItems,
    patchedOverviewDashboard?.summary.alert_counts,
  ]);

  const activeInboxRows = useMemo(() => {
    const filtered = inboxPriorityItems.filter((item) =>
      matchesInboxBucket(item, activeInboxBucket, currentUserId)
    );

    return filtered
      .filter((item) => matchesSharedSurfaceFilters(item.row, sharedSurfaceFilters))
      .slice(0, 14);
  }, [activeInboxBucket, currentUserId, inboxPriorityItems, sharedSurfaceFilters]);
  const hasIntakeMenuActions = canImportRequests || canExportRequests;
  const isAnalyticsSurface = activeSurface === 'analytics';
  const showsSharedSurfaceFilters = !isCreateMode;
  const isCompactTopShell = layoutMode === 'mobile' || layoutMode === 'tablet';
  const controlHeightClass = isCompactTopShell ? 'h-11' : 'h-10';
  const workspaceShellClass =
    'rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] shadow-[var(--ui-shadow-shell)]';
  const sharedFilterFieldClass =
    `${controlHeightClass} rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const sharedSearchFieldClass =
    `${controlHeightClass} w-full rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] pl-9 pr-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/12`;
  const sharedSelectTriggerClass =
    `${controlHeightClass} rounded-[var(--ui-control-radius)] border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-3.5 text-sm font-medium text-[color:var(--ui-text-default)] shadow-[var(--ui-shadow-shell)] focus:bg-white`;
  const sharedSecondaryButtonClass =
    `${controlHeightClass} inline-flex items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-3 text-xs font-semibold text-[color:var(--ui-text-default)] transition hover:bg-[var(--ui-surface-subtle)]`;
  const sharedPrimaryButtonClass =
    `${controlHeightClass} inline-flex items-center justify-center rounded-[var(--ui-control-radius)] bg-primary px-3 text-xs font-semibold text-white shadow-[var(--ui-shadow-shell)] transition hover:bg-deep-teal disabled:opacity-50`;
  const renderTopShellActions = (isCompactLayout = false) => (
    <>
      {hasIntakeMenuActions ? (
        <div className={`relative ${isCompactLayout ? '' : 'w-full sm:w-auto'}`}>
          <button
            type="button"
            onClick={() => setIsIntakeMenuOpen((value) => !value)}
            aria-label="Nhập"
            className={`${sharedSecondaryButtonClass} ${isCompactLayout ? 'w-10 px-0' : 'w-full gap-1.5 sm:w-auto'}`}
            aria-expanded={isIntakeMenuOpen}
            aria-haspopup="menu"
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>move_to_inbox</span>
            {!isCompactLayout ? 'Nhập' : null}
            {!isCompactLayout ? (
              <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 15 }}>expand_more</span>
            ) : null}
          </button>

          {isIntakeMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-[90] w-48 overflow-hidden rounded-[var(--ui-shell-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] py-1.5 shadow-xl shadow-slate-200/70"
            >
              {canImportRequests ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsIntakeMenuOpen(false);
                    handleDownloadIntakeTemplate();
                  }}
                  disabled={isDownloadingTemplate}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>download</span>
                  Tải mẫu nhập
                </button>
              ) : null}
              {canImportRequests ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsIntakeMenuOpen(false);
                    setShowImportModal(true);
                  }}
                  disabled={isImportingIntake}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>upload_file</span>
                  Nhập từ Excel
                </button>
              ) : null}
              {canExportRequests ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsIntakeMenuOpen(false);
                    handleExportIntake();
                  }}
                  disabled={isExportingIntake}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>ios_share</span>
                  Xuất dữ liệu
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {canWriteRequests && (
        <button
          type="button"
          onClick={handleCreateRequest}
          aria-label="Thêm yêu cầu"
          className={`${sharedPrimaryButtonClass} ${isCompactLayout ? 'w-10 px-0' : 'w-full gap-1.5 sm:w-auto'}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          {!isCompactLayout ? 'Thêm yêu cầu' : null}
        </button>
      )}
    </>
  );
  const sharedSurfaceFilterNode = showsSharedSurfaceFilters ? (
    <div className={`${workspaceShellClass} p-3`}>
      <div className="space-y-2.5">
        {isCompactTopShell ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen((value) => !value)}
                className={`${sharedSecondaryButtonClass} gap-1.5`}
                aria-expanded={isMobileSearchOpen}
                aria-label="Mở tìm kiếm"
              >
                <span className="material-symbols-outlined text-[17px]">search</span>
                <span>Tìm kiếm</span>
              </button>
              {!isAnalyticsSurface ? (
                <button
                  type="button"
                  onClick={() => setIsSharedFilterExpanded((value) => !value)}
                  className={`${sharedSecondaryButtonClass} gap-1.5`}
                >
                  <span className="material-symbols-outlined text-[17px]">tune</span>
                  <span>Bộ lọc</span>
                  {sharedAdvancedFilterCount > 0 ? (
                    <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {sharedAdvancedFilterCount}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div aria-hidden="true" />
              )}
            </div>

            {isMobileSearchOpen ? (
              <div className="grid grid-cols-1 gap-2">
                <label>
                  <span className="sr-only">Từ ngày tạo</span>
                  <input
                    type="date"
                    value={draftRequestCreatedFrom}
                    onChange={(event) => {
                      setDraftRequestCreatedFrom(event.target.value);
                    }}
                    className={`w-full ${sharedFilterFieldClass}`}
                  />
                </label>

                <label>
                  <span className="sr-only">Đến ngày tạo</span>
                  <input
                    type="date"
                    value={draftRequestCreatedTo}
                    onChange={(event) => {
                      setDraftRequestCreatedTo(event.target.value);
                    }}
                    className={`w-full ${sharedFilterFieldClass}`}
                  />
                </label>

                <label className="relative w-[180px] shrink-0">
                  <span className="sr-only">Tìm người xử lý</span>
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    style={{ fontSize: 16 }}
                  >
                    person
                  </span>
                  <input
                    value={draftRequestHandlerKeywordInput}
                    onChange={(event) => {
                      setDraftRequestHandlerKeywordInput(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        if (canSubmitFilters) {
                          handleSubmitKeywordSearch();
                        }
                      }
                    }}
                    placeholder="Người xử lý..."
                    className={sharedSearchFieldClass}
                  />
                </label>

                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Tìm kiếm yêu cầu</span>
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    style={{ fontSize: 16 }}
                  >
                    search
                  </span>
                  <input
                    value={draftRequestKeywordInput}
                    onChange={(event) => {
                      setDraftRequestKeywordInput(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        if (canSubmitFilters) {
                          handleSubmitKeywordSearch();
                        }
                      }
                    }}
                    placeholder="Tìm mã YC, tên yêu cầu..."
                    className={sharedSearchFieldClass}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSubmitKeywordSearch}
                  disabled={!canSubmitFilters}
                  className={`${sharedSecondaryButtonClass} gap-1.5 text-primary hover:bg-primary/5 disabled:opacity-50`}
                >
                  <span className="material-symbols-outlined text-[17px]">search</span>
                  <span>Tìm kiếm</span>
                </button>

              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="grid gap-2 xl:grid-cols-[156px_156px_180px_minmax(0,1fr)_150px_180px_auto]"
          >
            <label>
              <span className="sr-only">Từ ngày tạo</span>
              <input
                type="date"
                value={draftRequestCreatedFrom}
                onChange={(event) => {
                  setDraftRequestCreatedFrom(event.target.value);
                }}
                className={`w-full ${sharedFilterFieldClass}`}
              />
            </label>

            <label>
              <span className="sr-only">Đến ngày tạo</span>
              <input
                type="date"
                value={draftRequestCreatedTo}
                onChange={(event) => {
                  setDraftRequestCreatedTo(event.target.value);
                }}
                className={`w-full ${sharedFilterFieldClass}`}
              />
            </label>

            <label className="relative w-[180px] shrink-0">
              <span className="sr-only">Tìm người xử lý</span>
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                style={{ fontSize: 16 }}
              >
                person
              </span>
              <input
                value={draftRequestHandlerKeywordInput}
                onChange={(event) => {
                  setDraftRequestHandlerKeywordInput(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (canSubmitFilters) {
                      handleSubmitKeywordSearch();
                    }
                  }
                }}
                placeholder="Người xử lý..."
                className={sharedSearchFieldClass}
              />
            </label>

            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Tìm kiếm yêu cầu</span>
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                style={{ fontSize: 16 }}
              >
                search
              </span>
              <input
                value={draftRequestKeywordInput}
                onChange={(event) => {
                  setDraftRequestKeywordInput(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (canSubmitFilters) {
                      handleSubmitKeywordSearch();
                    }
                  }
                }}
                placeholder="Tìm mã YC, tên yêu cầu..."
                className={sharedSearchFieldClass}
              />
            </label>

            <button
              type="button"
              onClick={handleSubmitKeywordSearch}
              disabled={!canSubmitFilters}
              className={`${sharedSecondaryButtonClass} gap-1.5 text-primary hover:bg-primary/5 disabled:opacity-50`}
            >
              <span className="material-symbols-outlined text-[17px]">search</span>
              <span>Tìm kiếm</span>
            </button>

            <SearchableMultiSelect
              values={draftActiveProcessCodes}
              options={processOptions.filter((option) => String(option.value ?? '').trim() !== '')}
              onChange={(values) => {
                setDraftActiveProcessCodes(values);
              }}
              label=""
              placeholder="Tiến trình"
              searchPlaceholder="Tìm tiến trình..."
              usePortal
              portalZIndex={70}
              triggerClassName={sharedSelectTriggerClass}
              showSelectedChips={false}
            />

            {!isAnalyticsSurface ? (
              <button
                type="button"
                onClick={() => setIsSharedFilterExpanded((value) => !value)}
                className={`${sharedSecondaryButtonClass} gap-1.5`}
              >
                <span className="material-symbols-outlined text-[17px]">tune</span>
                <span>Bộ lọc</span>
                {sharedAdvancedFilterCount > 0 ? (
                  <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {sharedAdvancedFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        )}

        {(isAnalyticsSurface || isSharedFilterExpanded) ? (
          <div
            className={`grid gap-2 ${
              isCompactTopShell
                ? 'grid-cols-1'
                : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]'
            }`}
          >
            {isCompactTopShell ? (
              <SearchableMultiSelect
                values={draftActiveProcessCodes}
                options={processOptions.filter((option) => String(option.value ?? '').trim() !== '')}
                onChange={(values) => {
                  setDraftActiveProcessCodes(values);
                }}
                label=""
                placeholder="Tiến trình"
                searchPlaceholder="Tìm tiến trình..."
                usePortal
                portalZIndex={70}
                triggerClassName={sharedSelectTriggerClass}
                showSelectedChips={false}
              />
            ) : null}
            <SearchableMultiSelect
              values={draftRequestEntityFilter}
              options={entityFilterOptions}
              onChange={(values) => {
                setDraftRequestEntityFilter(values);
              }}
              label=""
              placeholder="Khách hàng | Dự án | Sản phẩm"
              searchPlaceholder="Tìm khách hàng, dự án, sản phẩm..."
              usePortal
              portalZIndex={70}
              triggerClassName={sharedSelectTriggerClass}
              showSelectedChips={false}
            />
            <SearchableMultiSelect
              values={draftRequestTagFilter}
              options={tagFilterOptions}
              onChange={(values) => {
                setDraftRequestTagFilter(values);
              }}
              label=""
              placeholder="Tags"
              searchPlaceholder="Tìm tags..."
              usePortal
              portalZIndex={70}
              triggerClassName={sharedSelectTriggerClass}
              showSelectedChips={false}
            />
            <SearchableMultiSelect
              values={draftRequestPriorityFilter}
              options={SHARED_PRIORITY_OPTIONS}
              onChange={(values) => {
                setDraftRequestPriorityFilter(values);
              }}
              label=""
              placeholder="Ưu tiên"
              searchPlaceholder="Tìm ưu tiên..."
              usePortal
              portalZIndex={70}
              triggerClassName={sharedSelectTriggerClass}
              showSelectedChips={false}
            />
            {hasListFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className={`${sharedSecondaryButtonClass} text-primary hover:bg-primary/5`}
              >
                Xóa lọc
              </button>
            ) : (
              <div aria-hidden="true" />
            )}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className="bg-[var(--ui-page-bg)] px-3 pb-6">
      <div className="sticky top-0 z-50 space-y-2 bg-[var(--ui-page-bg)] pb-2 pt-3 backdrop-blur-md">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          data-testid="customer-request-top-shell"
          className={`relative z-[80] px-3 py-3 ${workspaceShellClass}`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
            <div className="flex min-w-0 items-center justify-between gap-3 xl:flex-[0_0_auto] xl:justify-start">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-control-radius)] bg-[var(--ui-accent-soft)]">
                    <span className="material-symbols-outlined text-[color:var(--ui-primary)]" style={{ fontSize: 18 }}>
                      support_agent
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-sm font-bold leading-tight text-[color:var(--ui-text-title)]">Quản lý yêu cầu khách hàng</h2>
                    </div>
                    {!isCompactTopShell ? (
                      <p className="mt-1 text-[11px] leading-4 text-[color:var(--ui-text-muted)]">
                        Workspace tổng hợp cho bảng theo dõi, danh sách và phân tích yêu cầu CRC.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {isCompactTopShell && (hasIntakeMenuActions || canWriteRequests) ? (
                <div className="flex items-center justify-end gap-2">
                  {renderTopShellActions(true)}
                </div>
                ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <CustomerRequestWorkspaceTabs
                activeTab={activeWorkspaceTab}
                onTabChange={handleWorkspaceTabChange}
                overviewActionCount={patchedOverviewDashboard?.attention_cases.length ?? 0}
                creatorActionCount={patchedCreatorBuckets.reviewRows.length + patchedCreatorBuckets.notifyRows.length}
                dispatcherActionCount={patchedDispatcherBuckets.queueRows.length + patchedDispatcherBuckets.returnedRows.length}
                performerActionCount={patchedPerformerBuckets.pendingRows.length}
                showPanels={false}
                showTabs={false}
                chromeMode="inline"
                toolbar={
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1 pb-1 xl:pb-0">
                      <CustomerRequestSurfaceSwitch
                        activeSurface={activeSurface}
                        onSurfaceChange={(surface) => {
                          setActiveSurface(surface);
                          setActiveSavedViewId(null);
                          if (isCompactTopShell) {
                            setIsMobileSearchOpen(false);
                          }
                        }}
                        iconOnlyOnCompact
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => bumpDataVersion()}
                      disabled={isDashboardLoading}
                      className={`${sharedSecondaryButtonClass} shrink-0 gap-1.5 disabled:opacity-50 ${
                        isCompactTopShell ? 'w-10 px-0' : 'px-3'
                      }`}
                      title="Làm mới dữ liệu"
                    >
                      <span
                        aria-hidden="true"
                        className={`material-symbols-outlined ${isDashboardLoading ? 'animate-spin' : ''}`}
                        style={{ fontSize: 16 }}
                      >
                        refresh
                      </span>
                      {isCompactTopShell ? (
                        <span className="sr-only">Làm mới</span>
                      ) : (
                        <span className="whitespace-nowrap">Làm mới</span>
                      )}
                    </button>
                  </div>
                }
                overviewWorkspace={
                  <CustomerRequestOverviewWorkspace
                    loading={isDashboardLoading}
                    overviewDashboard={patchedOverviewDashboard}
                    roleDashboards={patchedRoleDashboards}
                    onOpenRequest={handleOpenRequest}
                    onOpenWorkspace={handleOpenOverviewRoleWorkspace}
                    onOpenListSurface={handleOpenOverviewListSurface}
                  />
                }
                creatorWorkspace={
                  <CustomerRequestCreatorWorkspace
                    loading={creatorWS.isLoading}
                    creatorName={creatorName}
                    totalRows={patchedCreatorRows.length}
                    reviewRows={patchedCreatorBuckets.reviewRows}
                    notifyRows={patchedCreatorBuckets.notifyRows}
                    followUpRows={patchedCreatorBuckets.followUpRows}
                    closedRows={patchedCreatorBuckets.closedRows}
                    dashboard={patchedRoleDashboards.creator}
                    onOpenRequest={handleOpenRequest}
                    onCreateRequest={handleCreateRequest}
                  />
                }
                dispatcherWorkspace={
                  <CustomerRequestDispatcherWorkspace
                    loading={dispatcherWS.isLoading}
                    dispatcherName={currentUserName}
                    totalRows={patchedDispatcherRows.length}
                    queueRows={patchedDispatcherBuckets.queueRows}
                    returnedRows={patchedDispatcherBuckets.returnedRows}
                    feedbackRows={patchedDispatcherBuckets.feedbackRows}
                    approvalRows={patchedDispatcherBuckets.approvalRows}
                    activeRows={patchedDispatcherBuckets.activeRows}
                    teamLoadRows={patchedDispatcherTeamLoadRows}
                    pmWatchRows={patchedDispatcherPmWatchRows}
                    dashboard={patchedRoleDashboards.dispatcher}
                    onOpenRequest={handleOpenRequest}
                  />
                }
                performerWorkspace={
                  <CustomerRequestPerformerWorkspace
                    loading={performerWS.isLoading}
                    performerName={currentUserName}
                    totalRows={patchedPerformerRows.length}
                    pendingRows={patchedPerformerBuckets.pendingRows}
                    activeRows={patchedPerformerBuckets.activeRows}
                    timesheet={performerWS.timesheet}
                    onOpenRequest={handleOpenRequest}
                  />
                }
              />
            </div>

            {!isCompactTopShell && (hasIntakeMenuActions || canWriteRequests) ? (
              <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                {renderTopShellActions()}
              </div>
            ) : null}
          </div>
        </div>

        {sharedSurfaceFilterNode}
      </div>

      {activeSurface === 'inbox' && !isCreateMode ? (
        <div className="my-2 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-2.5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => pinnedItems[0] && handleOpenQuickAccessItem(pinnedItems[0])}
                disabled={pinnedItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                Ghim {pinnedItems.length}
              </button>
              <button
                type="button"
                onClick={() => recentItems[0] && handleOpenQuickAccessItem(recentItems[0])}
                disabled={recentItems.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
              >
                Gần đây {recentItems.length}
              </button>
              <button
                type="button"
                onClick={() => handleApplyInlineQuickFilter('mine')}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Của tôi
              </button>
              <button
                type="button"
                onClick={() => handleApplyInlineQuickFilter('following')}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Đang theo dõi
              </button>
              <button
                type="button"
                onClick={() => handleApplyInlineQuickFilter('sla')}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
              >
                SLA risk
              </button>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              {activeInboxRows.length} việc đang hiển thị
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Main area ──────────────────────────────────────────────────── */}
      {activeSurface === 'inbox' && !isCreateMode ? (
        <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Ưu tiên
            </p>
            <div className="space-y-1">
              {inboxBuckets.slice(0, 5).map((bucket) => {
                const isActive = activeInboxBucket === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setActiveInboxBucket(bucket.key)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/15'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{bucket.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white text-primary' : 'bg-slate-100 text-slate-600'}`}>
                      {bucket.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Nhóm nhanh
            </p>
            <div className="space-y-1">
              {inboxBuckets.slice(5).map((bucket) => {
                const isActive = activeInboxBucket === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setActiveInboxBucket(bucket.key)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{bucket.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {bucket.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[12px] font-bold leading-4 text-slate-900">Bảng theo dõi</p>
                <p className="text-[11px] leading-4 text-slate-500">
                  {activeInboxRows.length} việc đang hiển thị
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSurface('list')}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 md:w-auto"
              >
                Mở danh sách đầy đủ
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
              </button>
            </div>

            <div className="hidden border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 md:grid md:grid-cols-[92px_minmax(0,1fr)_128px_92px_120px_84px] md:gap-3">
              <span>Mã</span>
              <span>Khách hàng / Tiêu đề</span>
              <span>Bước</span>
              <span>SLA</span>
              <span>Owner</span>
              <span>Cập nhật</span>
            </div>

            <div className="divide-y divide-slate-100">
              {activeInboxRows.map((item) => {
                const row = item.row;
                const requestCode = resolveInboxRequestCode(row);
                const reasons = item.reasons.length > 0
                  ? item.reasons
                  : [
                      row.missing_estimate ? 'Thiếu ƯL' : '',
                      row.over_estimate ? 'Vượt ƯL' : '',
                      row.sla_status ? 'SLA' : '',
                    ].filter(Boolean);

                return (
                  <div key={item.key} className="grid gap-2 px-3 py-2.5 transition hover:bg-slate-50/70 md:grid-cols-[92px_minmax(0,1fr)_128px_92px_120px_84px] md:items-start md:gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenRequest(row.id, resolveRequestProcessCode(row))}
                      className="text-left text-[12px] font-bold leading-5 text-primary hover:underline md:pt-0.5"
                      aria-label={`Mở chi tiết ${requestCode}`}
                    >
                      {requestCode}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold leading-5 text-slate-900">
                        {resolveInboxCustomer(row)} / {resolveInboxTitle(row)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {reasons.slice(0, 3).map((reason) => (
                          <span
                            key={`${item.key}-${reason}`}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                          >
                            {String(reason).replaceAll('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold leading-4 text-slate-600">{resolveInboxStep(row)}</p>
                    <p className="text-[11px] font-bold leading-4 text-amber-700">{resolveInboxSlaLabel(row)}</p>
                    <p className="text-[11px] font-semibold leading-4 text-slate-600">{resolveInboxOwner(row)}</p>
                    <div className="flex items-center justify-between gap-2 md:block">
                      <p className="text-[11px] font-semibold leading-4 text-slate-500">{formatInboxTimestamp(row.updated_at)}</p>
                      <button
                        type="button"
                        onClick={() => handleTogglePinnedRequest(row)}
                        className="mt-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 md:mt-1"
                        aria-label={`Ghim ${requestCode}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                          keep
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {activeInboxRows.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] font-semibold text-slate-400">
                  Chưa có việc ưu tiên phù hợp.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : activeSurface === 'analytics' ? (
        <div>
        <CustomerRequestDashboardCards
          activeRoleFilter={dashboardRoleFilter}
          onRoleFilterChange={handleDashboardRoleFilterChange}
          overviewDashboard={patchedOverviewDashboard}
          roleDashboards={patchedRoleDashboards}
          isDashboardLoading={isDashboardLoading}
          activeProcessCode={activeProcessCodes[0] || ''}
          onProcessCodeChange={(statusCode) => {
            const nextProcessCodes = normalizeFilterValues([statusCode]);
            setDraftActiveProcessCodes(nextProcessCodes);
            setActiveProcessCodes(nextProcessCodes);
            setListPage(1);
          }}
          getStatusCount={getStatusCount}
          onSelectAttentionCase={handleOpenRequest}
        />
        </div>
      ) : activeSurface === 'list' ? (
        <>
          <div className={`${layoutMode === 'mobile' ? 'h-[calc(100vh-240px)]' : 'h-[calc(100vh-240px)] md:h-[calc(100vh-200px)]'} min-h-0 flex flex-1 flex-col overflow-hidden`}>
            <CustomerRequestListPane {...listPaneProps} />
          </div>
        </>
      ) : null}

      {/* Detail modal — dùng một bề mặt duy nhất để hiển thị đủ thông tin
          cho mọi case đã chọn, thay cho inline pane / drawer cũ. */}
      {showDetailModal ? (
        <CustomerRequestDetailFrame
          mode="modal"
          request={selectedRequestSummary}
          isPinned={isPinnedRequest(selectedRequestSummary?.id)}
          title="Cập nhật yêu cầu"
          subtitle={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary ?? ''}
          icon="edit_note"
          footer={detailModalFooter}
          onTogglePinned={() => {
            if (selectedRequestSummary) {
              handleTogglePinnedRequest(selectedRequestSummary);
            }
          }}
          onClose={handleCloseDetail}
        >
          {detailPaneNode}
        </CustomerRequestDetailFrame>
      ) : null}

      <CustomerRequestWorklogModal
        open={showWorklogModal}
        isSubmitting={isSubmittingWorklog}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        context={worklogModalContext}
        onClose={handleCloseWorklogModal}
        onSubmit={handleSubmitWorklog}
      />

      <CustomerRequestEstimateModal
        open={showEstimateModal}
        isSubmitting={isSubmittingEstimate}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        latestEstimate={estimateHistory[0] ?? currentHoursReport?.latest_estimate ?? null}
        onClose={() => setShowEstimateModal(false)}
        onSubmit={handleSubmitEstimate}
      />

      {/* Transition modal */}
      <CustomerRequestTransitionModal
        show={transitionHook.showTransitionModal}
        processDetail={processDetail}
        transitionStatusCode={transitionStatusCode}
        transitionRenderableFields={transitionRenderableFields}
        modalStatusPayload={transitionHook.modalStatusPayload}
        onModalStatusPayloadChange={handleModalStatusPayloadChange}
        modalIt360Tasks={transitionHook.modalIt360Tasks}
        onAddModalIt360Task={transitionHook.addModalIt360Task}
        onUpdateModalIt360Task={transitionHook.updateModalIt360Task}
        onRemoveModalIt360Task={(localId) =>
          transitionHook.setModalIt360Tasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalRefTasks={transitionHook.modalRefTasks}
        onAddModalReferenceTask={transitionHook.addModalReferenceTask}
        onUpdateModalReferenceTask={transitionHook.updateModalReferenceTask}
        onRemoveModalReferenceTask={(localId) =>
          transitionHook.setModalRefTasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalAttachments={transitionHook.modalAttachments}
        onUploadModalAttachment={transitionHook.handleModalUpload}
        onDeleteModalAttachment={(id) =>
          transitionHook.setModalAttachments((prev) =>
            prev.filter((a) => String(a.id) !== String(id))
          )
        }
        isModalUploading={transitionHook.isModalUploading}
        modalNotes={transitionHook.modalNotes}
        onModalNotesChange={transitionHook.setModalNotes}
        modalActiveTaskTab={transitionHook.modalActiveTaskTab}
        onModalActiveTaskTabChange={transitionHook.setModalActiveTaskTab}
        isTransitioning={transitionHook.isTransitioning}
        onClose={transitionHook.closeTransitionModal}
        onConfirm={transitionHook.handleTransitionConfirm}
        modalTimeline={transitionHook.modalTimeline}
        modalHandlerUserId={transitionHook.modalHandlerUserId}
        onModalHandlerUserIdChange={transitionHook.setModalHandlerUserId}
        projectRaciRows={projectRaciRows}
        employees={employees}
        customers={localCustomers}
        customerPersonnel={customerPersonnel}
        supportServiceGroups={supportServiceGroups}
        projectItems={effectiveProjectItems}
        selectedCustomerId={selectedCustomerId}
        taskReferenceOptions={taskReferenceOptions}
        taskReferenceSearchError={searchError}
        taskReferenceSearchTerm={searchKeyword}
        onTaskReferenceSearchTermChange={setSearchKeyword}
        isTaskReferenceSearchLoading={isSearchLoading}
        caseContextAttachments={formAttachments}
        caseContextIt360Tasks={formIt360Tasks}
        caseContextReferenceTasks={formReferenceTasks}
      />

      {/* ── Modal tạo mới yêu cầu ──────────────────────────────────── */}
      {isCreateMode && (
        <CustomerRequestCreateModal
          masterFields={masterFields}
          masterDraft={masterDraft}
          onMasterFieldChange={handleMasterFieldChange}
          customers={localCustomers}
          employees={employees}
          customerPersonnel={customerPersonnel}
          supportServiceGroups={supportServiceGroups}
          projectItems={effectiveProjectItems}
          /* attachments */
          formAttachments={formAttachments}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
          isUploadingAttachment={isUploadingAttachment}
          attachmentError={attachmentError}
          attachmentNotice={attachmentNotice}
          /* it360 tasks */
          formIt360Tasks={formIt360Tasks}
          onAddIt360Task={handleAddIt360Task}
          onUpdateIt360TaskRow={handleUpdateIt360Row}
          onRemoveIt360TaskRow={handleRemoveIt360Row}
          /* reference tasks */
          formReferenceTasks={formReferenceTasks}
          onAddReferenceTask={handleAddReferenceTask}
          onUpdateReferenceTaskRow={handleUpdateRefRow}
          onRemoveReferenceTaskRow={handleRemoveRefRow}
          taskReferenceOptions={taskReferenceOptions}
          taskReferenceSearchTerm={searchKeyword}
          onTaskReferenceSearchTermChange={setSearchKeyword}
          taskReferenceSearchError={searchError}
          isTaskReferenceSearchLoading={isSearchLoading}
          /* tags */
          formTags={createFormTags}
          onTagsChange={setCreateFormTags}
          isSaving={isSaving}
          onSave={handleSaveCase}
          onClose={() => {
            setIsCreateMode(false);
            setSelectedRequestId(null);
          }}
          onOpenAddCustomerPersonnelModal={handleOpenAddCustomerPersonnelModal}
        />
      )}

      {showAddCustomerModal ? (
        <CustomerFormModal
          type="ADD"
          data={null}
          onClose={handleCloseAddCustomerModal}
          onSave={handleSaveNewCustomer}
          zIndexClassName="z-[210]"
        />
      ) : null}

      {showAddCustomerPersonnelModal ? (
        <CusPersonnelFormModal
          type="ADD"
          data={null}
          customers={localCustomers}
          supportContactPositions={supportContactPositions || []}
          onClose={handleCloseAddCustomerPersonnelModal}
          onSave={handleSaveNewCustomerPersonnel}
        />
      ) : null}

      {showImportModal ? (
        <ImportModal
          title="Import intake yêu cầu khách hàng"
          moduleKey="customer_request_intake"
          onClose={() => {
            if (!isImportingIntake) {
              setShowImportModal(false);
            }
          }}
          onSave={handleImportIntake}
          isLoading={isImportingIntake}
          loadingText="Đang import dữ liệu..."
        />
      ) : null}
    </div>
  );
};
