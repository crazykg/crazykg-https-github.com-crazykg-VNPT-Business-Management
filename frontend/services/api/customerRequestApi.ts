import type { ProjectItemMaster } from '../../types/project';
import type {
  AsyncExportJob,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
} from '../../types/common';
import type { Tag, WorkflowDefinition } from '../../types';
import type { SupportRequestReceiverResult, SupportRequestTaskStatus } from '../../types/support';
import type {
  CRCFullDetail,
  CodingPhase,
  CustomerRequest,
  CustomerRequestChangeLogEntry,
  CustomerRequestDashboardSummaryPayload,
  CustomerRequestEscalation,
  CustomerRequestImportRowResult,
  CustomerRequestPlan,
  CustomerRequestPlanItem,
  CustomerRequestReferenceSearchItem,
  DispatchRoute,
  DmsPhase,
  LeadershipDirective,
  MonthlyHoursRow,
  PainPointsData,
  YeuCau,
  YeuCauDashboardPayload,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauPerformerWeeklyTimesheet,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauSearchItem,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from '../../types/customerRequest';
import {
  apiFetch,
  DEFAULT_PAGINATION_META,
  DownloadFileResult,
  fetchList,
  isRequestCanceledError,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  normalizeNumber,
  parseErrorMessage,
  parseItemJson,
  resolveDownloadFilename,
} from './_infra';
import { uploadDocumentAttachment } from './documentApi';

type ApiListResponse<T> = {
  data?: T[];
  meta?: Partial<PaginationMeta>;
};

type ApiItemResponse<T> = {
  data?: T;
  meta?: {
    hours_report?: YeuCauHoursReport | null;
  };
};

type ApiDetailStatusResponse = {
  data?: {
    request_case_id?: string | number | null;
    status_instance_id?: string | number | null;
    status_code?: string | null;
    detail_status?: 'open' | 'in_progress' | 'paused' | 'completed' | string | null;
    can_transition_main_status?: boolean;
    quick_actions?: Array<{
      action?: 'in_progress' | 'paused' | string | null;
      label?: string | null;
    }>;
    started_at?: string | null;
    paused_at?: string | null;
    completed_at?: string | null;
  } | null;
};

type PlanListMeta = { page: number; per_page: number; total: number; total_pages: number };

const buildPaginatedQueryString = (query?: PaginatedQuery): string => {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  const useSimplePagination = query.simple !== undefined ? Boolean(query.simple) : true;

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
  params.set('simple', useSimplePagination ? '1' : '0');
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.sort_by && query.sort_by.trim()) params.set('sort_by', query.sort_by.trim());
  if (query.sort_dir) params.set('sort_dir', query.sort_dir);

  if (query.filters) {
    Object.entries(query.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params.set(`filters[${key}]`, String(value));
    });
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

const parsePaginatedJson = async <T>(res: Response): Promise<PaginatedResult<T>> => {
  const payload = (await res.json()) as ApiListResponse<T>;
  const meta = payload.meta ?? {};

  return {
    data: payload.data ?? [],
    meta: {
      ...DEFAULT_PAGINATION_META,
      ...meta,
      page: Number(meta.page ?? DEFAULT_PAGINATION_META.page),
      per_page: Number(meta.per_page ?? DEFAULT_PAGINATION_META.per_page),
      total: Number(meta.total ?? DEFAULT_PAGINATION_META.total),
      total_pages: Number(meta.total_pages ?? DEFAULT_PAGINATION_META.total_pages),
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const syncCurrentRuntimeProcessMeta = (
  meta: YeuCauProcessMeta | null,
  currentStatusCode: string,
  allowedNextProcesses: YeuCauProcessMeta[],
  allowedPreviousProcesses: YeuCauProcessMeta[]
): YeuCauProcessMeta | null => {
  if (!meta) {
    return null;
  }

  const processCode = String(meta.process_code ?? meta.status_code ?? '').trim();
  if (!processCode || processCode !== currentStatusCode) {
    return meta;
  }

  return {
    ...meta,
    allowed_next_processes: allowedNextProcesses.map((process) => process.process_code),
    allowed_previous_processes: allowedPreviousProcesses.map((process) => process.process_code),
  };
};

export const normalizeYeuCauProcessDetail = (value: unknown): YeuCauProcessDetail => {
  const raw = isRecord(value) ? value : {};
  const nestedRequest =
    isRecord(raw.yeu_cau)
      ? raw.yeu_cau
      : isRecord(raw.request_case)
      ? raw.request_case
      : raw;
  const allowedNextProcesses = Array.isArray(raw.allowed_next_processes)
    ? (raw.allowed_next_processes as YeuCauProcessMeta[])
    : Array.isArray(raw.allowed_next_statuses)
    ? (raw.allowed_next_statuses as YeuCauProcessMeta[])
    : [];
  const allowedPreviousProcesses = Array.isArray(raw.allowed_previous_processes)
    ? (raw.allowed_previous_processes as YeuCauProcessMeta[])
    : Array.isArray(raw.allowed_previous_statuses)
    ? (raw.allowed_previous_statuses as YeuCauProcessMeta[])
    : [];
  const currentStatusCode = String(
    (nestedRequest as Record<string, unknown>).current_status_code
      ?? raw.current_status_code
      ?? raw.trang_thai
      ?? ''
  ).trim();
  const rawCurrentStatus = isRecord(raw.current_status)
    ? (raw.current_status as unknown as YeuCauProcessMeta)
    : null;
  const rawCurrentProcess =
    (isRecord(raw.current_process)
      ? (raw.current_process as unknown as YeuCauProcessMeta)
      : null) ??
    (isRecord(raw.process) ? (raw.process as unknown as YeuCauProcessMeta) : null);
  const rawProcess =
    (isRecord(raw.process) ? (raw.process as unknown as YeuCauProcessMeta) : null) ??
    rawCurrentProcess;

  const canTransitionMainStatus = raw.can_transition_main_status;

  return {
    ...(raw as unknown as YeuCauProcessDetail),
    yeu_cau: nestedRequest as unknown as YeuCau,
    can_transition_main_status:
      typeof canTransitionMainStatus === 'boolean'
        ? canTransitionMainStatus
        : Boolean(raw.can_transition_from_detail_status),
    current_status: syncCurrentRuntimeProcessMeta(
      rawCurrentStatus,
      currentStatusCode,
      allowedNextProcesses,
      allowedPreviousProcesses
    ),
    current_process:
      syncCurrentRuntimeProcessMeta(
        rawCurrentProcess,
        currentStatusCode,
        allowedNextProcesses,
        allowedPreviousProcesses
      ) ??
      syncCurrentRuntimeProcessMeta(
        rawProcess,
        currentStatusCode,
        allowedNextProcesses,
        allowedPreviousProcesses
      ),
    process:
      syncCurrentRuntimeProcessMeta(
        rawProcess,
        currentStatusCode,
        allowedNextProcesses,
        allowedPreviousProcesses
      ) ??
      syncCurrentRuntimeProcessMeta(
        rawCurrentProcess,
        currentStatusCode,
        allowedNextProcesses,
        allowedPreviousProcesses
      ) ?? {
        process_code: String(raw.current_status_code ?? raw.trang_thai ?? ''),
        process_label: String(
          raw.current_process_label ?? raw.current_status_name_vi ?? raw.tien_trinh_hien_tai ?? ''
        ),
        group_code: 'runtime',
        group_label: 'runtime',
        table_name: '',
        default_status: String(raw.current_status_code ?? raw.trang_thai ?? ''),
        read_roles: [],
        write_roles: [],
        allowed_next_processes: [],
        form_fields: [],
        list_columns: [],
      },
    allowed_next_processes: allowedNextProcesses,
    allowed_previous_processes: allowedPreviousProcesses,
    transition_allowed: Boolean(raw.transition_allowed),
    can_write: Boolean(raw.can_write),
  };
};

const SUPPORT_REQUEST_TASK_STATUS_ALIAS_MAP: Record<string, SupportRequestTaskStatus> = {
  TODO: 'TODO',
  VUATAO: 'TODO',
  CANLAM: 'TODO',
  INPROGRESS: 'IN_PROGRESS',
  DANGTHUCHIEN: 'IN_PROGRESS',
  DANGLAM: 'IN_PROGRESS',
  DONE: 'DONE',
  DAHOANTHANH: 'DONE',
  HOANTHANH: 'DONE',
  CANCELLED: 'CANCELLED',
  HUY: 'CANCELLED',
  BLOCKED: 'BLOCKED',
  CHUYENSANGTASKKHAC: 'BLOCKED',
  DANGCHAN: 'BLOCKED',
};

const normalizeSupportRequestTaskStatus = (value: unknown): SupportRequestTaskStatus => {
  const token = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

  return SUPPORT_REQUEST_TASK_STATUS_ALIAS_MAP[token] || 'TODO';
};

export { DEFAULT_PAGINATION_META, isRequestCanceledError, uploadDocumentAttachment };
export type { WorkflowDefinition } from '../../types';

export const fetchWorkflowDefinitions = async (
  processType = 'customer_request',
  includeInactive = false
): Promise<WorkflowDefinition[]> => {
  const params = new URLSearchParams({
    process_type: processType,
    ...(includeInactive ? { include_inactive: '1' } : {}),
  });

  const res = await apiFetch(`/api/v5/workflow-definitions?${params.toString()}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `workflow-definitions:${processType}:${includeInactive ? 'all' : 'active'}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_WORKFLOW_DEFINITIONS_FAILED'));
  }

  const payload = (await res.json()) as { data?: WorkflowDefinition[] };
  return Array.isArray(payload.data) ? payload.data : [];
};

export const fetchDefaultWorkflowDefinition = async (
  processType = 'customer_request'
): Promise<WorkflowDefinition | null> => {
  const res = await apiFetch(`/api/v5/workflow-definitions/default?process_type=${encodeURIComponent(processType)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `workflow-definitions:default:${processType}`,
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEFAULT_WORKFLOW_DEFINITION_FAILED'));
  }

  return parseItemJson<WorkflowDefinition>(res);
};

const buildCustomerRequestRequestPayload = (payload: Partial<CustomerRequest> & Record<string, unknown>) => {
  const typedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const rawTasks = Array.isArray(payload.ref_tasks) ? payload.ref_tasks : [];
  const taskRows = (rawTasks.length > 0
    ? rawTasks.map((task) => (typeof task === 'object' && task ? task : {}))
    : typedTasks);

  const dedupeSignatures = new Set<string>();
  const normalizedTasks = taskRows
    .map((task, index) => {
      const taskSource = (normalizeNullableText((task as Record<string, unknown>).task_source) || 'IT360').toUpperCase();
      const isReferenceTask = taskSource === 'REFERENCE';

      return {
        task_source: taskSource,
        task_code: normalizeNullableText((task as Record<string, unknown>).task_code),
        task_link: isReferenceTask ? null : normalizeNullableText((task as Record<string, unknown>).task_link),
        status: isReferenceTask
          ? null
          : normalizeSupportRequestTaskStatus(
              (task as Record<string, unknown>).status ?? (task as Record<string, unknown>).task_status
            ),
        sort_order: normalizeNumber((task as Record<string, unknown>).sort_order, index),
      };
    })
    .filter((task) => task.task_code || task.task_link)
    .filter((task) => {
      const signature = [
        String(task.task_source || '').trim().toLowerCase(),
        String(task.task_code || '').trim().toLowerCase(),
        normalizeNullableText(task.task_link) || '',
        task.status || '',
        String(task.sort_order ?? 0),
      ].join('|');
      if (dedupeSignatures.has(signature)) {
        return false;
      }
      dedupeSignatures.add(signature);
      return true;
    });

  const transitionMetadata =
    payload.transition_metadata && typeof payload.transition_metadata === 'object'
      ? payload.transition_metadata
      : undefined;

  return {
    status_catalog_id: normalizeNullableNumber(payload.status_catalog_id),
    summary: normalizeNullableText(payload.summary),
    project_item_id: normalizeNullableNumber(payload.project_item_id),
    customer_id: normalizeNullableNumber(payload.customer_id),
    project_id: normalizeNullableNumber(payload.project_id),
    product_id: normalizeNullableNumber(payload.product_id),
    requester_name: normalizeNullableText(payload.requester_name),
    reporter_contact_id: normalizeNullableNumber(payload.reporter_contact_id),
    service_group_id: normalizeNullableNumber(payload.service_group_id),
    receiver_user_id: normalizeNullableNumber(payload.receiver_user_id),
    assignee_id: normalizeNullableNumber(payload.assignee_id),
    status: normalizeNullableText(payload.status),
    sub_status: normalizeNullableText(payload.sub_status),
    priority: normalizeNullableText(payload.priority),
    requested_date: normalizeNullableText(payload.requested_date),
    assigned_date: normalizeNullableText(payload.assigned_date),
    hours_estimated: normalizeNullableNumber((payload as Record<string, unknown>).hours_estimated),
    reference_ticket_code: normalizeNullableText(payload.reference_ticket_code),
    reference_request_id: normalizeNullableNumber(payload.reference_request_id),
    notes: normalizeNullableText(payload.notes),
    transition_note: normalizeNullableText(payload.transition_note),
    internal_note: normalizeNullableText(payload.internal_note),
    transition_metadata: transitionMetadata,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments.map((attachment) => ({
          id: normalizeNullableText(attachment.id),
          fileName: attachment.fileName,
          fileUrl: normalizeNullableText(attachment.fileUrl),
          driveFileId: normalizeNullableText(attachment.driveFileId),
          fileSize: normalizeNumber(attachment.fileSize, 0),
          mimeType: normalizeNullableText(attachment.mimeType),
          createdAt: normalizeNullableText(attachment.createdAt),
          storagePath: normalizeNullableText(attachment.storagePath),
          storageDisk: normalizeNullableText(attachment.storageDisk),
          storageVisibility: normalizeNullableText(attachment.storageVisibility),
          storageProvider: normalizeNullableText(attachment.storageProvider),
        }))
      : undefined,
    tasks: [],
    ref_tasks: normalizedTasks.map((task) => ({
      task_source: task.task_source,
      task_code: task.task_code,
      task_link: task.task_link,
      task_status: task.status,
      sort_order: task.sort_order,
    })),
    worklogs: Array.isArray(payload.worklogs) ? payload.worklogs : undefined,
  };
};

const buildYeuCauCaseQueryParams = (
  query?: PaginatedQuery & { process_code?: string | null }
): URLSearchParams => {
  const params = new URLSearchParams();

  if (!query) {
    params.set('simple', '1');
    return params;
  }

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
  params.set('simple', '1');
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.sort_by && query.sort_by.trim()) params.set('sort_by', query.sort_by.trim());
  if (query.sort_dir) params.set('sort_dir', query.sort_dir);
  if (query.process_code && query.process_code.trim()) {
    params.set('process_code', query.process_code.trim());
  }

  if (query.filters) {
    Object.entries(query.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params.set(key, String(value));
    });
  }

  return params;
};

const buildQuerySuffix = (params?: Record<string, string | number | undefined>): string => {
  if (!params) {
    return '';
  }

  const filtered = Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
};

export const fetchCustomerRequestProjectItems = async (params?: {
  search?: string;
  include_project_item_id?: string | number | null;
}): Promise<ProjectItemMaster[]> => {
  const query = new URLSearchParams();
  const search = String(params?.search || '').trim();
  const includeProjectItemId = normalizeNullableNumber(params?.include_project_item_id);

  if (search !== '') {
    query.set('search', search);
  }
  if (includeProjectItemId !== null) {
    query.set('include_project_item_id', String(includeProjectItemId));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchList<ProjectItemMaster>(`/api/v5/customer-requests/project-items${suffix}`);
};

export const fetchCustomerRequestReferenceSearch = async (params?: {
  q?: string;
  exclude_id?: string | number | null;
  limit?: number;
}): Promise<CustomerRequestReferenceSearchItem[]> => {
  const query = new URLSearchParams();
  const text = normalizeNullableText(params?.q);
  const excludeId = normalizeNullableNumber(params?.exclude_id);
  const limit = normalizeNullableNumber(params?.limit);

  if (text) {
    query.set('q', text);
  }
  if (excludeId !== null) {
    query.set('exclude_id', String(excludeId));
  }
  if (limit !== null) {
    query.set('limit', String(Math.max(1, Math.min(50, Math.floor(limit)))));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/customer-requests/reference-search${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request:reference-search:${excludeId ?? 'new'}:${text ?? ''}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_REFERENCE_SEARCH_FAILED'));
  }

  return parseItemJson<CustomerRequestReferenceSearchItem[]>(res);
};

export const fetchCustomerRequestsPage = async (query: PaginatedQuery): Promise<PaginatedResult<CustomerRequest>> => {
  const suffix = buildPaginatedQueryString(query);
  const res = await apiFetch(`/api/v5/customer-requests${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'page:/api/v5/customer-requests',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUESTS_PAGE_FAILED'));
  }

  return parsePaginatedJson<CustomerRequest>(res);
};

export const fetchCustomerRequestDashboardSummary = async (
  query?: PaginatedQuery
): Promise<CustomerRequestDashboardSummaryPayload> => {
  const suffix = buildPaginatedQueryString(query);
  const path = suffix
    ? `/api/v5/customer-requests/dashboard-summary${suffix}`
    : '/api/v5/customer-requests/dashboard-summary';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request:dashboard-summary',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_DASHBOARD_SUMMARY_FAILED'));
  }

  return parseItemJson<CustomerRequestDashboardSummaryPayload>(res);
};

export const createCustomerRequest = async (
  payload: Partial<CustomerRequest> & Record<string, unknown>
): Promise<CustomerRequest> => {
  const res = await apiFetch('/api/v5/customer-requests', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildCustomerRequestRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CUSTOMER_REQUEST_FAILED'));
  }

  return parseItemJson<CustomerRequest>(res);
};

export const updateCustomerRequest = async (
  id: string | number,
  payload: Partial<CustomerRequest> & Record<string, unknown>
): Promise<CustomerRequest> => {
  const res = await apiFetch(`/api/v5/customer-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildCustomerRequestRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CUSTOMER_REQUEST_FAILED'));
  }

  return parseItemJson<CustomerRequest>(res);
};

export const deleteCustomerRequest = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_REQUEST_FAILED'));
  }
};

export const fetchCustomerRequestHistory = async (id: string | number): Promise<{
  request: CustomerRequest;
  transitions: Array<Record<string, unknown>>;
  worklogs: Array<Record<string, unknown>>;
  ref_tasks: Array<Record<string, unknown>>;
}> => {
  const res = await apiFetch(`/api/v5/customer-requests/${id}/history`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_HISTORY_FAILED'));
  }

  return parseItemJson<{
    request: CustomerRequest;
    transitions: Array<Record<string, unknown>>;
    worklogs: Array<Record<string, unknown>>;
    ref_tasks: Array<Record<string, unknown>>;
  }>(res);
};

export const fetchCustomerRequestHistories = async (params?: {
  request_id?: string | number | null;
  limit?: number;
  filters?: {
    service_group_id?: string | number | null;
    workflow_action_code?: string | null;
    to_status_catalog_id?: string | number | null;
    date_from?: string | null;
    date_to?: string | null;
  };
}): Promise<CustomerRequestChangeLogEntry[]> => {
  const search = new URLSearchParams();
  if (params?.request_id !== undefined && params.request_id !== null && `${params.request_id}`.trim() !== '') {
    search.set('request_id', String(params.request_id));
  }
  if (params?.limit !== undefined && Number.isFinite(Number(params.limit))) {
    const limit = Math.max(1, Math.min(1000, Math.floor(Number(params.limit))));
    search.set('limit', String(limit));
  }
  if (params?.filters?.service_group_id !== undefined && params.filters.service_group_id !== null && `${params.filters.service_group_id}`.trim() !== '') {
    search.set('filters[service_group_id]', String(params.filters.service_group_id));
  }
  if (params?.filters?.workflow_action_code) {
    search.set('filters[workflow_action_code]', String(params.filters.workflow_action_code).trim());
  }
  if (params?.filters?.to_status_catalog_id !== undefined && params.filters.to_status_catalog_id !== null && `${params.filters.to_status_catalog_id}`.trim() !== '') {
    search.set('filters[to_status_catalog_id]', String(params.filters.to_status_catalog_id));
  }
  if (params?.filters?.date_from) {
    search.set('filters[date_from]', String(params.filters.date_from).trim());
  }
  if (params?.filters?.date_to) {
    search.set('filters[date_to]', String(params.filters.date_to).trim());
  }

  const suffix = search.toString();
  const path = suffix ? `/api/v5/customer-request-history?${suffix}` : '/api/v5/customer-request-history';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request:histories:${search.get('request_id') || 'all'}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_HISTORIES_FAILED'));
  }

  return parseItemJson<CustomerRequestChangeLogEntry[]>(res);
};

export const importCustomerRequests = async (
  items: Array<Record<string, unknown>>
): Promise<{
  results: CustomerRequestImportRowResult[];
  created_count: number;
  updated_count: number;
  failed_count: number;
}> => {
  const res = await apiFetch('/api/v5/customer-requests/import', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'IMPORT_CUSTOMER_REQUESTS_FAILED'));
  }

  return parseItemJson<{
    results: CustomerRequestImportRowResult[];
    created_count: number;
    updated_count: number;
    failed_count: number;
  }>(res);
};

export type CustomerRequestIntakeImportResult = {
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  created_case_ids: number[];
  results: Array<{
    index: number;
    row_number: number;
    import_row_code?: string | null;
    success: boolean;
    action?: 'created';
    case_id?: number | null;
    message?: string;
  }>;
  errors: Array<{
    row_number: number;
    import_row_code?: string | null;
    field: string;
    error_code: string;
    error_message: string;
  }>;
  warnings: Array<{
    row_number: number;
    import_row_code?: string | null;
    field?: string;
    message: string;
  }>;
  error_file_token?: string | null;
};

export const fetchCustomerRequestIntakeTemplate = async (workflowDefinitionId?: number | null): Promise<{
  data: {
    sheet?: string;
    task_sheet?: string;
    lookup_sheets?: string[];
    required_headers?: string[];
    headers?: string[];
    task_headers?: string[];
    priority_labels?: string[];
    task_sources?: string[];
    task_statuses?: string[];
    status_policy?: string;
  };
}> => {
  const suffix = buildQuerySuffix({
    workflow_definition_id: workflowDefinitionId ?? undefined,
  });
  const res = await apiFetch(`/api/v5/customer-request-cases/import-intake/template${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request:intake-template',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_INTAKE_TEMPLATE_FAILED'));
  }

  return res.json();
};

export const importCustomerRequestIntake = async (
  items: Array<Record<string, unknown>>,
  workflowDefinitionId?: number | null
): Promise<CustomerRequestIntakeImportResult> => {
  const res = await apiFetch('/api/v5/customer-request-cases/import-intake', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items,
      workflow_definition_id: workflowDefinitionId ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'IMPORT_CUSTOMER_REQUEST_INTAKE_FAILED'));
  }

  const payload = (await res.json()) as { data?: CustomerRequestIntakeImportResult };
  return payload.data ?? {
    total_rows: 0,
    success_rows: 0,
    failed_rows: 0,
    created_case_ids: [],
    results: [],
    errors: [],
    warnings: [],
    error_file_token: null,
  };
};

export const exportCustomerRequestIntake = async (query?: {
  q?: string;
  status_code?: string;
}): Promise<DownloadFileResult> => {
  const suffix = buildQuerySuffix({
    q: query?.q,
    status_code: query?.status_code,
  });
  const path = suffix
    ? `/api/v5/customer-request-cases/export-intake${suffix}`
    : '/api/v5/customer-request-cases/export-intake';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: { Accept: 'text/csv,application/octet-stream' },
    cancelKey: 'customer-request:intake-export',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_CUSTOMER_REQUEST_INTAKE_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(
      res,
      `customer_request_intake_${new Date().toISOString().slice(0, 10)}.csv`
    ),
  };
};

export const exportCustomerRequestsCsv = async (query?: PaginatedQuery): Promise<DownloadFileResult> => {
  const suffix = buildPaginatedQueryString(query);
  const path = suffix
    ? `/api/v5/customer-requests/export${suffix}&format=csv`
    : '/api/v5/customer-requests/export?format=csv';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
    cancelKey: 'customer-request:export',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_CUSTOMER_REQUESTS_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, `customer_requests_${new Date().toISOString().slice(0, 10)}.csv`),
  };
};

export const exportCustomerRequestDashboardSummaryCsv = async (
  query?: PaginatedQuery
): Promise<DownloadFileResult> => {
  const suffix = buildPaginatedQueryString(query);
  const path = suffix
    ? `/api/v5/customer-requests/dashboard-summary/export${suffix}&format=csv`
    : '/api/v5/customer-requests/dashboard-summary/export?format=csv';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
    cancelKey: 'customer-request:dashboard-summary-export',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_CUSTOMER_REQUEST_DASHBOARD_SUMMARY_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(
      res,
      `customer_request_dashboard_summary_${new Date().toISOString().slice(0, 10)}.csv`
    ),
  };
};

export const fetchAsyncExportJob = async (uuid: string): Promise<AsyncExportJob> => {
  const normalizedUuid = String(uuid || '').trim();
  if (normalizedUuid === '') {
    throw new Error('Thiếu mã export.');
  }

  const res = await apiFetch(`/api/v5/exports/${encodeURIComponent(normalizedUuid)}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_ASYNC_EXPORT_JOB_FAILED'));
  }

  return parseItemJson<AsyncExportJob>(res);
};

export const downloadAsyncExportFile = async (uuid: string): Promise<DownloadFileResult> => {
  const normalizedUuid = String(uuid || '').trim();
  if (normalizedUuid === '') {
    throw new Error('Thiếu mã export.');
  }

  const res = await apiFetch(`/api/v5/exports/${encodeURIComponent(normalizedUuid)}/download`, {
    credentials: 'include',
    headers: { Accept: 'text/csv,application/octet-stream' },
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DOWNLOAD_ASYNC_EXPORT_FILE_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, `async_export_${new Date().toISOString().slice(0, 10)}.csv`),
  };
};

export const fetchCustomerRequestReceivers = async (params?: {
  project_id?: string | number | null;
  project_item_id?: string | number | null;
}): Promise<SupportRequestReceiverResult> => {
  const query = new URLSearchParams();
  const projectId = normalizeNullableNumber(params?.project_id);
  const projectItemId = normalizeNullableNumber(params?.project_item_id);
  if (projectId !== null) {
    query.set('project_id', String(projectId));
  }
  if (projectItemId !== null) {
    query.set('project_item_id', String(projectItemId));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/customer-requests/receivers${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CUSTOMER_REQUEST_RECEIVERS_FAILED'));
  }

  return parseItemJson<SupportRequestReceiverResult>(res);
};

export const fetchYeuCauProcessCatalog = async (): Promise<YeuCauProcessCatalog> => {
  const res = await apiFetch('/api/v5/customer-request-statuses', {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request-cases:process-catalog',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_PROCESS_CATALOG_FAILED'));
  }

  return parseItemJson<YeuCauProcessCatalog>(res);
};

export const fetchYeuCauProcessDefinition = async (processCode: string): Promise<YeuCauProcessMeta> => {
  const catalog = await fetchYeuCauProcessCatalog();
  for (const group of catalog.groups) {
    const found = group.processes.find((process) => process.process_code === processCode);
    if (found) {
      return found;
    }
  }
  throw new Error('Không tìm thấy tiến trình yêu cầu.');
};

export const fetchYeuCauPage = async (
  query: PaginatedQuery & { process_code?: string | null },
  options: { cancelKey?: string } = {}
): Promise<PaginatedResult<YeuCau>> => {
  const suffix = buildYeuCauCaseQueryParams(query).toString();
  const res = await apiFetch(`/api/v5/customer-request-cases${suffix ? `?${suffix}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: options.cancelKey ?? 'page:/api/v5/customer-request-cases',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_PAGE_FAILED'));
  }

  return parsePaginatedJson<YeuCau>(res);
};

export const fetchYeuCauDashboard = async (
  role: 'creator' | 'dispatcher' | 'performer' | 'overview',
  query?: PaginatedQuery & { process_code?: string | null }
): Promise<YeuCauDashboardPayload> => {
  const params = buildYeuCauCaseQueryParams(query);
  if (query?.process_code && query.process_code.trim()) {
    params.delete('process_code');
    params.set('status_code', query.process_code.trim());
  }
  params.delete('page');
  params.delete('per_page');
  params.delete('simple');

  const suffix = params.toString();
  const res = await apiFetch(`/api/v5/customer-request-cases/dashboard/${role}${suffix ? `?${suffix}` : ''}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-cases:dashboard:${role}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_DASHBOARD_FAILED'));
  }

  return parseItemJson<YeuCauDashboardPayload>(res);
};

export const fetchYeuCauPerformerWeeklyTimesheet = async (
  query?: { start_date?: string; end_date?: string }
): Promise<YeuCauPerformerWeeklyTimesheet> => {
  const params = new URLSearchParams();
  if (query?.start_date?.trim()) {
    params.set('start_date', query.start_date.trim());
  }
  if (query?.end_date?.trim()) {
    params.set('end_date', query.end_date.trim());
  }

  const suffix = params.toString();
  const res = await apiFetch(`/api/v5/customer-request-cases/timesheet/performer-weekly${suffix ? `?${suffix}` : ''}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request-cases:timesheet:performer-weekly',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_PERFORMER_TIMESHEET_FAILED'));
  }

  return parseItemJson<YeuCauPerformerWeeklyTimesheet>(res);
};

export const fetchYeuCauSearch = async (
  query: { q: string; limit?: number }
): Promise<YeuCauSearchItem[]> => {
  const params = new URLSearchParams();
  if (query.q.trim()) {
    params.set('q', query.q.trim());
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }

  const suffix = params.toString();
  const res = await apiFetch(`/api/v5/customer-request-cases/search${suffix ? `?${suffix}` : ''}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request-cases:search',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_SEARCH_FAILED'));
  }

  return parseItemJson<YeuCauSearchItem[]>(res);
};

export const fetchYeuCau = async (id: string | number): Promise<YeuCau> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_FAILED'));
  }

  return parseItemJson<YeuCau>(res);
};

export const createYeuCau = async (payload: Record<string, unknown>): Promise<YeuCau> => {
  const res = await apiFetch('/api/v5/customer-request-cases', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_YEU_CAU_FAILED'));
  }

  const detail = await parseItemJson<Record<string, unknown>>(res);
  return (detail.request_case as YeuCau | undefined) ?? (detail.yeu_cau as YeuCau | undefined) ?? (detail as unknown as YeuCau);
};

export const fetchYeuCauTimeline = async (id: string | number): Promise<YeuCauTimelineEntry[]> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/timeline`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:timeline`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_TIMELINE_FAILED'));
  }

  return parseItemJson<YeuCauTimelineEntry[]>(res);
};

export const fetchYeuCauWorklogs = async (id: string | number): Promise<YeuCauWorklog[]> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/worklogs`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:worklogs`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_WORKLOGS_FAILED'));
  }

  return parseItemJson<YeuCauWorklog[]>(res);
};

export const createYeuCauEstimate = async (
  id: string | number,
  payload: {
    estimated_hours: string | number;
    estimate_scope?: 'total' | 'remaining' | 'phase';
    estimate_type?: string;
    phase_label?: string | null;
    note?: string | null;
    estimated_by_user_id?: string | number | null;
    estimated_at?: string | null;
    sync_master?: boolean;
  }
): Promise<{ estimate: YeuCauEstimate | null; request_case: YeuCau | null }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/estimates`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      estimated_hours: normalizeNumber(payload.estimated_hours, 0),
      estimate_scope: payload.estimate_scope ?? 'total',
      estimate_type: normalizeNullableText(payload.estimate_type) ?? 'manual',
      phase_label: normalizeNullableText(payload.phase_label),
      note: normalizeNullableText(payload.note),
      estimated_by_user_id: normalizeNullableNumber(payload.estimated_by_user_id),
      estimated_at: normalizeNullableText(payload.estimated_at),
      sync_master: payload.sync_master ?? true,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_YEU_CAU_ESTIMATE_FAILED'));
  }

  return parseItemJson<{ estimate: YeuCauEstimate | null; request_case: YeuCau | null }>(res);
};

export type YeuCauWorklogStorePayload = {
  work_content: string;
  work_date?: string | null;
  activity_type_code?: string | null;
  hours_spent?: string | number | null;
  is_billable?: boolean;
  difficulty_note?: string | null;
  proposal_note?: string | null;
  difficulty_status?: 'none' | 'has_issue' | 'resolved' | null;
  detail_status_action?: 'in_progress' | 'paused' | 'completed' | null;
};

export type YeuCauWorklogStoreResult = {
  worklog: YeuCauWorklog | null;
  hours_report: YeuCauHoursReport | null;
};

const buildYeuCauWorklogBody = (payload: YeuCauWorklogStorePayload): Record<string, unknown> => ({
  work_content: normalizeNullableText(payload.work_content),
  work_date: normalizeNullableText(payload.work_date),
  activity_type_code: normalizeNullableText(payload.activity_type_code),
  hours_spent:
    payload.hours_spent === undefined || payload.hours_spent === null || payload.hours_spent === ''
      ? null
      : normalizeNumber(payload.hours_spent, 0),
  is_billable: payload.is_billable === undefined ? true : Boolean(payload.is_billable),
  difficulty_note: normalizeNullableText(payload.difficulty_note),
  proposal_note: normalizeNullableText(payload.proposal_note),
  difficulty_status: normalizeNullableText(payload.difficulty_status),
  detail_status_action: normalizeNullableText(payload.detail_status_action),
});

export const storeYeuCauWorklog = async (
  id: string | number,
  payload: YeuCauWorklogStorePayload
): Promise<YeuCauWorklogStoreResult> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/worklogs`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildYeuCauWorklogBody(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'STORE_YEU_CAU_WORKLOG_FAILED'));
  }

  const detail = (await res.json()) as ApiItemResponse<YeuCauWorklog | null>;

  return {
    worklog: detail.data ?? null,
    hours_report: detail.meta?.hours_report ?? null,
  };
};

export const storeYeuCauDetailStatusWorklog = async (
  id: string | number,
  payload: YeuCauWorklogStorePayload
): Promise<YeuCauWorklogStoreResult> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/detail-status-worklog`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildYeuCauWorklogBody(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'STORE_YEU_CAU_DETAIL_STATUS_WORKLOG_FAILED'));
  }

  const detail = (await res.json()) as ApiItemResponse<YeuCauWorklog | null>;

  return {
    worklog: detail.data ?? null,
    hours_report: detail.meta?.hours_report ?? null,
  };
};

export const updateYeuCauWorklog = async (
  id: string | number,
  worklogId: string | number,
  payload: YeuCauWorklogStorePayload
): Promise<YeuCauWorklogStoreResult> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/worklogs/${worklogId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildYeuCauWorklogBody(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_YEU_CAU_WORKLOG_FAILED'));
  }

  const detail = (await res.json()) as ApiItemResponse<YeuCauWorklog | null>;

  return {
    worklog: detail.data ?? null,
    hours_report: detail.meta?.hours_report ?? null,
  };
};

export const fetchYeuCauDetailStatus = async (
  id: string | number
): Promise<ApiDetailStatusResponse['data']> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/detail-status`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:detail-status`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_DETAIL_STATUS_FAILED'));
  }

  const detail = (await res.json()) as ApiDetailStatusResponse;
  return detail.data ?? null;
};

export const fetchYeuCauPeople = async (id: string | number): Promise<YeuCauRelatedUser[]> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/people`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:people`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_PEOPLE_FAILED'));
  }

  return parseItemJson<YeuCauRelatedUser[]>(res);
};

export const fetchYeuCauProcessDetail = async (
  id: string | number,
  processCode: string
): Promise<YeuCauProcessDetail> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/statuses/${encodeURIComponent(processCode)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:process:${processCode}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_PROCESS_DETAIL_FAILED'));
  }

  const detail = await parseItemJson<unknown>(res);
  return normalizeYeuCauProcessDetail(detail);
};

export const saveYeuCauProcess = async (
  id: string | number,
  processCode: string,
  payload: Record<string, unknown>
): Promise<YeuCau> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/statuses/${encodeURIComponent(processCode)}`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SAVE_YEU_CAU_PROCESS_FAILED'));
  }

  const detail = await parseItemJson<Record<string, unknown>>(res);
  return (detail.request_case as YeuCau | undefined) ?? (detail.yeu_cau as YeuCau | undefined) ?? (detail as unknown as YeuCau);
};

export const fetchYeuCauCaseTags = async (id: string | number): Promise<Tag[]> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/tags`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:tags`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_YEU_CAU_CASE_TAGS_FAILED'));
  }

  const detail = (await res.json()) as { tags?: Tag[] };
  return Array.isArray(detail.tags) ? detail.tags : [];
};

export const saveYeuCauCaseTags = async (
  id: string | number,
  tags: Array<Pick<Tag, 'name' | 'color'>>
): Promise<Tag[]> => {
  const tagNames = tags
    .map((tag) => String(tag.name ?? '').trim().toLowerCase())
    .filter((name) => name.length > 0);

  const uniqueTagNames = Array.from(new Set(tagNames));
  const tagColors = tags.reduce<Record<string, string>>((acc, tag) => {
    const normalizedName = String(tag.name ?? '').trim().toLowerCase();
    const normalizedColor = String(tag.color ?? '').trim().toLowerCase();
    if (!normalizedName) {
      return acc;
    }
    acc[normalizedName] = normalizedColor || 'blue';
    return acc;
  }, {});

  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/tags/bulk`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      tag_names: uniqueTagNames,
      tag_colors: tagColors,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SAVE_YEU_CAU_CASE_TAGS_FAILED'));
  }

  const detail = (await res.json()) as { tags?: Tag[] };
  return Array.isArray(detail.tags) ? detail.tags : [];
};

export const deleteYeuCau = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_HEADERS,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_YEU_CAU_FAILED'));
  }
};

export const transitionCustomerRequestCase = async (
  id: string | number,
  toStatusCode: string,
  statusPayload: Record<string, unknown> = {}
): Promise<YeuCau> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/transition`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ to_status_code: toStatusCode, status_payload: statusPayload }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TRANSITION_YEU_CAU_FAILED'));
  }

  const detail = await parseItemJson<Record<string, unknown>>(res);
  return (detail.request_case as YeuCau | undefined) ?? (detail as unknown as YeuCau);
};

export const updateCaseSubStatus = async (
  id: number,
  data: {
    coding_phase?: CodingPhase;
    dms_phase?: DmsPhase;
    task_ref?: string;
    task_url?: string;
    upcode_version?: string;
    upcode_environment?: string;
    dispatch_route?: DispatchRoute;
  },
  options?: { cancelKey?: string }
): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/sub-status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
    ...(options?.cancelKey ? { cancelKey: options.cancelKey } : {}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CASE_SUB_STATUS_FAILED'));
  }
};

export const listCustomerRequestPlans = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: CustomerRequestPlan[]; meta: PlanListMeta }> => {
  const suffix = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)])
        )
      ).toString()
    : '';
  const res = await apiFetch(`/api/v5/customer-request-plans${suffix ? `?${suffix}` : ''}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'page:/api/v5/customer-request-plans',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'LIST_PLANS_FAILED'));
  }

  return res.json();
};

export const getCustomerRequestPlan = async (
  id: number
): Promise<{ data: { plan: CustomerRequestPlan; items: CustomerRequestPlanItem[] } }> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${id}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-plan:${id}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_PLAN_FAILED'));
  }

  return res.json();
};

export const createCustomerRequestPlan = async (
  data: Partial<CustomerRequestPlan>
): Promise<{ data: CustomerRequestPlan }> => {
  const res = await apiFetch('/api/v5/customer-request-plans', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PLAN_FAILED'));
  }

  return res.json();
};

export const updateCustomerRequestPlan = async (
  id: number,
  data: Partial<CustomerRequestPlan>
): Promise<{ data: CustomerRequestPlan }> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PLAN_FAILED'));
  }

  return res.json();
};

export const deleteCustomerRequestPlan = async (id: number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PLAN_FAILED'));
  }
};

export const addPlanItem = async (
  planId: number,
  data: Partial<CustomerRequestPlanItem>
): Promise<{ data: CustomerRequestPlanItem }> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${planId}/items`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ADD_PLAN_ITEM_FAILED'));
  }

  return res.json();
};

export const updatePlanItem = async (
  planId: number,
  itemId: number,
  data: Partial<CustomerRequestPlanItem>
): Promise<{ data: CustomerRequestPlanItem }> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${planId}/items/${itemId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PLAN_ITEM_FAILED'));
  }

  return res.json();
};

export const deletePlanItem = async (planId: number, itemId: number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${planId}/items/${itemId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PLAN_ITEM_FAILED'));
  }
};

export const carryOverPlan = async (
  planId: number,
  targetPlanId: number
): Promise<{ data: { carried_count: number; target_plan_id: number } }> => {
  const res = await apiFetch(`/api/v5/customer-request-plans/${planId}/carry-over`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ target_plan_id: targetPlanId }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CARRY_OVER_PLAN_FAILED'));
  }

  return res.json();
};

export const getPlanBacklog = async (
  params?: Record<string, unknown>
): Promise<{ data: unknown[] }> => {
  const suffix = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)])
        )
      ).toString()
    : '';
  const res = await apiFetch(`/api/v5/customer-request-plans/backlog${suffix ? `?${suffix}` : ''}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'customer-request-plans:backlog',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_PLAN_BACKLOG_FAILED'));
  }

  return res.json();
};

export const getCaseFullDetail = async (id: number): Promise<{ data: CRCFullDetail }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/full-detail`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:full-detail`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_CASE_FULL_DETAIL_FAILED'));
  }

  return res.json();
};

export const getCaseSummaryCard = async (id: number): Promise<{ data: unknown }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/${id}/summary-card`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `customer-request-case:${id}:summary-card`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_CASE_SUMMARY_CARD_FAILED'));
  }

  return res.json();
};

export const getMonthlyHoursReport = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: MonthlyHoursRow[]; meta: { month: string; group_by: string; source: string } }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/reports/monthly-hours${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'reports:monthly-hours',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_MONTHLY_HOURS_FAILED'));
  }

  return res.json();
};

export const getPainPoints = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: PainPointsData; meta: { month: string } }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/reports/pain-points${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'reports:pain-points',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_PAIN_POINTS_FAILED'));
  }

  return res.json();
};

export const getWeeklyHoursReport = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: unknown[]; meta: { from: string; to: string } }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/reports/weekly-hours${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'reports:weekly-hours',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_WEEKLY_HOURS_FAILED'));
  }

  return res.json();
};

export const getTrendReport = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: unknown[]; meta: { months: number } }> => {
  const res = await apiFetch(`/api/v5/customer-request-cases/reports/trend${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'reports:trend',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_TREND_REPORT_FAILED'));
  }

  return res.json();
};

export const listEscalations = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: CustomerRequestEscalation[]; meta: PaginationMeta }> => {
  const res = await apiFetch(`/api/v5/customer-request-escalations${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'page:/api/v5/customer-request-escalations',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'LIST_ESCALATIONS_FAILED'));
  }

  return res.json();
};

export const getEscalation = async (id: number): Promise<{ data: CustomerRequestEscalation }> => {
  const res = await apiFetch(`/api/v5/customer-request-escalations/${id}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `escalation:${id}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_ESCALATION_FAILED'));
  }

  return res.json();
};

export const createEscalation = async (
  data: Partial<CustomerRequestEscalation>
): Promise<{ data: CustomerRequestEscalation }> => {
  const res = await apiFetch('/api/v5/customer-request-escalations', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_ESCALATION_FAILED'));
  }

  return res.json();
};

export const reviewEscalation = async (
  id: number,
  data: { resolution_decision: string; resolution_note?: string }
): Promise<{ data: CustomerRequestEscalation }> => {
  const res = await apiFetch(`/api/v5/customer-request-escalations/${id}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'REVIEW_ESCALATION_FAILED'));
  }

  return res.json();
};

export const resolveEscalation = async (
  id: number,
  data?: { resolution_note?: string }
): Promise<{ data: CustomerRequestEscalation }> => {
  const res = await apiFetch(`/api/v5/customer-request-escalations/${id}/resolve`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data ?? {}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'RESOLVE_ESCALATION_FAILED'));
  }

  return res.json();
};

export const getEscalationStats = async (): Promise<{ data: unknown }> => {
  const res = await apiFetch('/api/v5/customer-request-escalations/stats', {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'escalation-stats',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_ESCALATION_STATS_FAILED'));
  }

  return res.json();
};

export const getLeadershipDashboard = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: unknown }> => {
  const res = await apiFetch(`/api/v5/leadership/dashboard${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'leadership:dashboard',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_LEADERSHIP_DASHBOARD_FAILED'));
  }

  return res.json();
};

export const getLeadershipRisks = async (): Promise<{ data: unknown }> => {
  const res = await apiFetch('/api/v5/leadership/risks', {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'leadership:risks',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_LEADERSHIP_RISKS_FAILED'));
  }

  return res.json();
};

export const getTeamComparison = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: unknown[]; meta: unknown }> => {
  const res = await apiFetch(`/api/v5/leadership/team-comparison${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'leadership:team-comparison',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_TEAM_COMPARISON_FAILED'));
  }

  return res.json();
};

export const listDirectives = async (
  params?: Record<string, string | number | undefined>
): Promise<{ data: LeadershipDirective[]; meta: PaginationMeta }> => {
  const res = await apiFetch(`/api/v5/leadership/directives${buildQuerySuffix(params)}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'page:/api/v5/leadership/directives',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'LIST_DIRECTIVES_FAILED'));
  }

  return res.json();
};

export const getDirective = async (id: number): Promise<{ data: LeadershipDirective }> => {
  const res = await apiFetch(`/api/v5/leadership/directives/${id}`, {
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `directive:${id}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GET_DIRECTIVE_FAILED'));
  }

  return res.json();
};

export const createDirective = async (
  data: Partial<LeadershipDirective>
): Promise<{ data: LeadershipDirective }> => {
  const res = await apiFetch('/api/v5/leadership/directives', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DIRECTIVE_FAILED'));
  }

  return res.json();
};

export const acknowledgeDirective = async (id: number): Promise<{ data: LeadershipDirective }> => {
  const res = await apiFetch(`/api/v5/leadership/directives/${id}/acknowledge`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'ACKNOWLEDGE_DIRECTIVE_FAILED'));
  }

  return res.json();
};

export const completeDirective = async (
  id: number,
  data?: { completion_note?: string }
): Promise<{ data: LeadershipDirective }> => {
  const res = await apiFetch(`/api/v5/leadership/directives/${id}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data ?? {}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'COMPLETE_DIRECTIVE_FAILED'));
  }

  return res.json();
};
