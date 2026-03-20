import {
  AuthLoginPayload,
  AuthLoginResult,
  AuthUser,
  Attachment,
  AsyncExportJob,
  AuditLog,
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  BulkMutationItemResult,
  BulkMutationResult,
  Business,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  Contract,
  CustomerRequestChangeLogEntry,
  CustomerRequest,
  CustomerRequestDashboardSummaryPayload,
  CustomerRequestReferenceSearchItem,
  CustomerRequestImportRowResult,
  Customer,
  CustomerPersonnel,
  DepartmentWeeklySchedule,
  Department,
  DepartmentWeekOption,
  YeuCau,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
  Document,
  Employee,
  EmployeeProvisioning,
  EmployeeSaveResult,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  Opportunity,
  OpportunityRaciRow,
  OpportunityStageOption,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
  Permission,
  Product,
  ProjectItemMaster,
  ProjectRaciRow,
  Project,
  ProjectTypeOption,
  ProcedureTemplate,
  ProcedureTemplateStep,
  ProjectProcedure,
  ProjectProcedureStep,
  ProcedureStepBatchUpdate,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  ProcedureStepRaciEntry,
  IssueStatus,
  SharedIssue,
  AddWorklogPayload,
  Reminder,
  Role,
  SupportRequestReceiverResult,
  SupportRequestTaskStatus,
  SupportRequestStatusOption,
  SupportSlaConfigOption,
  SupportContactPosition,
  SupportServiceGroup,
  WorkflowFormFieldConfig,
  WorkflowStatusTransition,
  WorkflowStatusCatalog,
  WorklogActivityTypeOption,
  UserAccessRecord,
  UserDeptHistory,
  Vendor,
  WorkCalendarDay,
  FeedbackRequest,
  FeedbackResponse,
} from '../types';
import { normalizeEmployeeCode } from '../utils/employeeDisplay';

type ApiListResponse<T> = {
  data?: T[];
  meta?: Partial<PaginationMeta>;
};

type ApiItemResponse<T> = {
  data?: T;
  provisioning?: EmployeeProvisioning;
  password_change_required?: boolean;
};

type ApiBulkMutationResponse<T> = {
  data?: {
    results?: Array<BulkMutationItemResult<T>>;
    created?: T[];
    created_count?: number;
    failed_count?: number;
  };
};

type ApiErrorPayload = {
  message?: string;
  code?: string;
  errors?: Record<string, string[] | string>;
};

type DownloadFileResult = {
  blob: Blob;
  filename: string;
};

export type AuthBootstrapResult = {
  user: AuthUser;
  permissions: string[];
  counters: Record<string, number>;
};

export const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 1,
};

const JSON_ACCEPT_HEADER = { Accept: 'application/json' };
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const INTERNAL_USERS_ENDPOINT = '/api/v5/internal-users';
const API_REQUEST_TIMEOUT_MS = 45000;
const API_REQUEST_CANCELLED_MESSAGE = '__REQUEST_CANCELLED__';
const AUTH_REFRESH_ENDPOINT = '/api/v5/auth/refresh';

// ★ Global eviction callback — đăng ký từ App.tsx
type EvictionCallback = () => void;
let _onTabEvicted: EvictionCallback | null = null;
export const registerTabEvictedHandler = (cb: EvictionCallback): void => { _onTabEvicted = cb; };
export const unregisterTabEvictedHandler = (): void => { _onTabEvicted = null; };

const AUTH_REFRESH_EXCLUDED_PATHS = new Set([
  '/api/v5/auth/login',
  '/api/v5/auth/refresh',
  '/api/v5/auth/logout',
  '/api/v5/auth/change-password',
]);
const inFlightRequestControllers = new Map<string, AbortController>();
const inFlightGetRequests = new Map<string, Promise<Response>>();
let inFlightRefreshPromise: Promise<boolean> | null = null;

type ApiFetchInit = RequestInit & {
  cancelKey?: string;
  skipAuthRefresh?: boolean;
};

export const isRequestCanceledError = (error: unknown): boolean =>
  error instanceof Error && error.message === API_REQUEST_CANCELLED_MESSAGE;

const resolveRequestMethod = (input: RequestInfo | URL, requestInit: RequestInit): string => {
  const initMethod = String(requestInit.method || '').trim().toUpperCase();
  if (initMethod) {
    return initMethod;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return String(input.method || 'GET').trim().toUpperCase();
  }
  return 'GET';
};

const resolveRequestUrl = (input: RequestInfo | URL): URL | null => {
  try {
    if (typeof input === 'string') {
      return new URL(input, globalThis.location.origin);
    }
    if (input instanceof URL) {
      return input;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, globalThis.location.origin);
    }
  } catch {
    return null;
  }

  return null;
};

const shouldDedupeGetRequest = (method: string, requestInit: RequestInit): boolean =>
  method === 'GET' && typeof requestInit.body === 'undefined';

const resolveRequestIdentityKey = (
  input: RequestInfo | URL,
  method: string
): string | null => {
  const requestUrl = resolveRequestUrl(input);
  if (!requestUrl) {
    return null;
  }

  return `${method}:${requestUrl.pathname}${requestUrl.search}`;
};

const apiFetch = async (input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> => {
  const { cancelKey, signal: externalSignal, skipAuthRefresh = false, ...requestInit } = init;
  const headers = new Headers(requestInit.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const requestMethod = resolveRequestMethod(input, requestInit);
  const dedupeKey = shouldDedupeGetRequest(requestMethod, requestInit)
    ? resolveRequestIdentityKey(input, requestMethod)
    : null;
  if (dedupeKey) {
    const existingRequest = inFlightGetRequests.get(dedupeKey);
    if (existingRequest) {
      const response = await existingRequest;
      return response.clone();
    }
  }

  const abortController = new AbortController();
  if (cancelKey) {
    const previousController = inFlightRequestControllers.get(cancelKey);
    if (previousController) {
      previousController.abort();
    }
    inFlightRequestControllers.set(cancelKey, abortController);
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortController.abort();
    } else {
      externalSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
  }

  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, API_REQUEST_TIMEOUT_MS);

  const executeFetch = async (): Promise<Response> => {
    return await globalThis.fetch(input, {
      ...requestInit,
      method: requestMethod,
      credentials: 'include',
      headers,
      signal: abortController.signal,
    });
  };

  const executeRequest = async (): Promise<Response> => {
    let response = await executeFetch();

    if (
      response.status === 401
      && !skipAuthRefresh
      && shouldAttemptSessionRefresh(input)
    ) {
      // ★ Kiểm tra TAB_EVICTED trước khi thử refresh
      const cloned = response.clone();
      try {
        const body = await cloned.json() as { code?: string };
        if (body?.code === 'TAB_EVICTED') {
          _onTabEvicted?.();
          return response;
        }
      } catch {
        // body không phải JSON → tiếp tục flow bình thường
      }

      const refreshed = await refreshSession();
      if (refreshed) {
        response = await executeFetch();
      }
    }

    return response;
  };

  try {
    if (dedupeKey) {
      const pendingRequest = executeRequest();
      let trackedRequest: Promise<Response>;
      trackedRequest = pendingRequest.finally(() => {
        if (inFlightGetRequests.get(dedupeKey) === trackedRequest) {
          inFlightGetRequests.delete(dedupeKey);
        }
      });
      inFlightGetRequests.set(dedupeKey, trackedRequest);
      const response = await trackedRequest;
      return response.clone();
    }

    return await executeRequest();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (timedOut) {
        throw new Error('Không thể kết nối máy chủ (quá thời gian phản hồi). Vui lòng thử lại.');
      }

      throw new Error(API_REQUEST_CANCELLED_MESSAGE);
    }

    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc trạng thái backend.');
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (cancelKey && inFlightRequestControllers.get(cancelKey) === abortController) {
      inFlightRequestControllers.delete(cancelKey);
    }
  }
};

const resolveRequestPath = (input: RequestInfo | URL): string => {
  try {
    if (typeof input === 'string') {
      return new URL(input, globalThis.location.origin).pathname;
    }
    if (input instanceof URL) {
      return input.pathname;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, globalThis.location.origin).pathname;
    }
  } catch {
    // Ignore parsing error and fallback to empty path.
  }

  return '';
};

const shouldAttemptSessionRefresh = (input: RequestInfo | URL): boolean => {
  const pathname = resolveRequestPath(input);
  if (!pathname.startsWith('/api/v5/')) {
    return false;
  }

  return !AUTH_REFRESH_EXCLUDED_PATHS.has(pathname);
};

const refreshSession = async (): Promise<boolean> => {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const response = await globalThis.fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: JSON_ACCEPT_HEADER,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

const parseJson = async <T>(res: Response): Promise<ApiListResponse<T>> => {
  if (!res.ok) {
    return { data: [] };
  }

  const payload = await res.json();
  return payload as ApiListResponse<T>;
};

const normalizePaginationMeta = (meta?: Partial<PaginationMeta> | null): PaginationMeta => {
  const page = Number(meta?.page ?? DEFAULT_PAGINATION_META.page);
  const perPage = Number(meta?.per_page ?? DEFAULT_PAGINATION_META.per_page);
  const total = Number(meta?.total ?? DEFAULT_PAGINATION_META.total);
  const totalPages = Number(meta?.total_pages ?? DEFAULT_PAGINATION_META.total_pages);
  const kpisRaw = meta?.kpis;
  const statusCountsRaw = (kpisRaw && typeof kpisRaw === 'object' && kpisRaw.status_counts && typeof kpisRaw.status_counts === 'object')
    ? kpisRaw.status_counts
    : undefined;
  const normalizedStatusCounts = statusCountsRaw
    ? Object.entries(statusCountsRaw).reduce<Record<string, number>>((acc, [key, value]) => {
        const parsed = Number(value);
        acc[String(key)] = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
        return acc;
      }, {})
    : undefined;
  const totalRequests = Number(kpisRaw?.total_requests);
  const newCount = Number(kpisRaw?.new_count);
  const analyzingCount = Number(kpisRaw?.analyzing_count);
  const codingCount = Number(kpisRaw?.coding_count);
  const pendingUpcodeCount = Number(kpisRaw?.pending_upcode_count);
  const completedCount = Number(kpisRaw?.completed_count);
  const inProgressCount = Number(kpisRaw?.in_progress_count);
  const waitingCustomerCount = Number(kpisRaw?.waiting_customer_count);
  const approachingDueCount = Number(kpisRaw?.approaching_due_count);
  const overdueCount = Number(kpisRaw?.overdue_count);
  const inProgress = Number(kpisRaw?.in_progress);
  const completed = Number(kpisRaw?.completed);
  const overdue = Number(kpisRaw?.overdue);
  const totalContracts = Number(kpisRaw?.total_contracts);
  const signedContracts = Number(kpisRaw?.signed);
  const draftContracts = Number(kpisRaw?.draft);
  const renewedContracts = Number(kpisRaw?.renewed);
  const expiringSoonContracts = Number(kpisRaw?.expiring_soon);
  const expiryWarningDays = Number(kpisRaw?.expiry_warning_days);
  const upcomingPaymentCustomers = Number(kpisRaw?.upcoming_payment_customers);
  const upcomingPaymentContracts = Number(kpisRaw?.upcoming_payment_contracts);
  const paymentWarningDays = Number(kpisRaw?.payment_warning_days);

  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGINATION_META.page,
    per_page: Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : DEFAULT_PAGINATION_META.per_page,
    total: Number.isFinite(total) && total >= 0 ? Math.floor(total) : DEFAULT_PAGINATION_META.total,
    total_pages:
      Number.isFinite(totalPages) && totalPages > 0
        ? Math.floor(totalPages)
        : DEFAULT_PAGINATION_META.total_pages,
    kpis: {
      total_requests: Number.isFinite(totalRequests) && totalRequests >= 0 ? Math.floor(totalRequests) : 0,
      new_count: Number.isFinite(newCount) && newCount >= 0 ? Math.floor(newCount) : 0,
      analyzing_count: Number.isFinite(analyzingCount) && analyzingCount >= 0 ? Math.floor(analyzingCount) : 0,
      coding_count: Number.isFinite(codingCount) && codingCount >= 0 ? Math.floor(codingCount) : 0,
      pending_upcode_count:
        Number.isFinite(pendingUpcodeCount) && pendingUpcodeCount >= 0 ? Math.floor(pendingUpcodeCount) : 0,
      completed_count:
        Number.isFinite(completedCount) && completedCount >= 0
          ? Math.floor(completedCount)
          : (Number.isFinite(completed) && completed >= 0 ? Math.floor(completed) : 0),
      in_progress_count: Number.isFinite(inProgressCount) && inProgressCount >= 0
        ? Math.floor(inProgressCount)
        : (Number.isFinite(inProgress) && inProgress >= 0 ? Math.floor(inProgress) : 0),
      waiting_customer_count: Number.isFinite(waitingCustomerCount) && waitingCustomerCount >= 0
        ? Math.floor(waitingCustomerCount)
        : 0,
      approaching_due_count: Number.isFinite(approachingDueCount) && approachingDueCount >= 0
        ? Math.floor(approachingDueCount)
        : 0,
      overdue_count: Number.isFinite(overdueCount) && overdueCount >= 0
        ? Math.floor(overdueCount)
        : (Number.isFinite(overdue) && overdue >= 0 ? Math.floor(overdue) : 0),
      status_counts: normalizedStatusCounts,
      in_progress: Number.isFinite(inProgress) && inProgress >= 0 ? Math.floor(inProgress) : 0,
      completed: Number.isFinite(completed) && completed >= 0 ? Math.floor(completed) : 0,
      overdue: Number.isFinite(overdue) && overdue >= 0 ? Math.floor(overdue) : 0,
      total_contracts: Number.isFinite(totalContracts) && totalContracts >= 0 ? Math.floor(totalContracts) : undefined,
      signed: Number.isFinite(signedContracts) && signedContracts >= 0 ? Math.floor(signedContracts) : undefined,
      draft: Number.isFinite(draftContracts) && draftContracts >= 0 ? Math.floor(draftContracts) : undefined,
      renewed: Number.isFinite(renewedContracts) && renewedContracts >= 0 ? Math.floor(renewedContracts) : undefined,
      expiring_soon:
        Number.isFinite(expiringSoonContracts) && expiringSoonContracts >= 0
          ? Math.floor(expiringSoonContracts)
          : undefined,
      expiry_warning_days:
        Number.isFinite(expiryWarningDays) && expiryWarningDays > 0
          ? Math.floor(expiryWarningDays)
          : undefined,
      upcoming_payment_customers:
        Number.isFinite(upcomingPaymentCustomers) && upcomingPaymentCustomers >= 0
          ? Math.floor(upcomingPaymentCustomers)
          : undefined,
      upcoming_payment_contracts:
        Number.isFinite(upcomingPaymentContracts) && upcomingPaymentContracts >= 0
          ? Math.floor(upcomingPaymentContracts)
          : undefined,
      payment_warning_days:
        Number.isFinite(paymentWarningDays) && paymentWarningDays > 0
          ? Math.floor(paymentWarningDays)
          : undefined,
    },
  };
};

const parsePaginatedJson = async <T>(res: Response): Promise<PaginatedResult<T>> => {
  const payload = (await res.json()) as ApiListResponse<T>;
  return {
    data: payload.data ?? [],
    meta: normalizePaginationMeta(payload.meta),
  };
};

const parseBulkMutationJson = async <T>(res: Response): Promise<BulkMutationResult<T>> => {
  const payload = (await res.json()) as ApiBulkMutationResponse<T>;
  const data = payload.data || {};
  const results = Array.isArray(data.results) ? data.results : [];
  const created = Array.isArray(data.created) ? data.created : [];
  const createdCount = Number(data.created_count ?? created.length);
  const failedCount = Number(
    data.failed_count ?? results.filter((item) => item && item.success !== true).length
  );

  return {
    results,
    created,
    created_count: Number.isFinite(createdCount) ? createdCount : created.length,
    failed_count: Number.isFinite(failedCount)
      ? failedCount
      : results.filter((item) => item && item.success !== true).length,
  };
};

const buildPaginatedQueryString = (query?: PaginatedQuery): string => {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
  params.set('simple', '1');
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.sort_by && query.sort_by.trim()) params.set('sort_by', query.sort_by.trim());
  if (query.sort_dir) params.set('sort_dir', query.sort_dir);

  if (query.filters) {
    Object.entries(query.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(`filters[${key}]`, String(value));
    });
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

const buildPaginatedRequestQuery = (query?: PaginatedQuery): Record<string, unknown> => {
  if (!query) {
    return {};
  }

  const payload: Record<string, unknown> = { simple: 1 };
  if (query.page !== undefined) payload.page = query.page;
  if (query.per_page !== undefined) payload.per_page = query.per_page;
  if (query.q && query.q.trim()) payload.q = query.q.trim();
  if (query.sort_by && query.sort_by.trim()) payload.sort_by = query.sort_by.trim();
  if (query.sort_dir) payload.sort_dir = query.sort_dir;

  if (query.filters) {
    const filters: Record<string, string | number | boolean> = {};
    Object.entries(query.filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      filters[key] = value;
    });
    if (Object.keys(filters).length > 0) {
      payload.filters = filters;
    }
  }

  return payload;
};

const FIELD_LABEL_MAP: Record<string, string> = {
  dept_code: 'Mã phòng ban',
  dept_name: 'Tên phòng ban',
  parent_id: 'Phòng ban cha',
  user_code: 'Mã nhân viên',
  username: 'Username',
  full_name: 'Họ và tên',
  email: 'Email',
  department_id: 'Phòng ban tham chiếu',
  position_id: 'Chức vụ',
  customer_code: 'Mã khách hàng',
  customer_name: 'Tên khách hàng',
  vendor_code: 'Mã đối tác',
  vendor_name: 'Tên đối tác',
  project_code: 'Mã dự án',
  project_name: 'Tên dự án',
  contract_code: 'Mã hợp đồng',
  contract_name: 'Tên hợp đồng',
  opp_name: 'Tên cơ hội',
  amount: 'Giá trị',
  value: 'Giá trị',
  status: 'Trạng thái',
};

const DUPLICATE_FIELD_HINTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /dept[\s_]?code/i, label: 'Mã phòng ban' },
  { pattern: /(user|employee)[\s_]?code/i, label: 'Mã nhân viên' },
  { pattern: /customer[\s_]?code/i, label: 'Mã khách hàng' },
  { pattern: /vendor[\s_]?code/i, label: 'Mã đối tác' },
  { pattern: /project[\s_]?code/i, label: 'Mã dự án' },
  { pattern: /contract[\s_]?code/i, label: 'Mã hợp đồng' },
  { pattern: /email/i, label: 'Email' },
  { pattern: /username/i, label: 'Username' },
];

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const resolveFieldLabel = (field: string): string => {
  if (FIELD_LABEL_MAP[field]) {
    return FIELD_LABEL_MAP[field];
  }

  const normalized = field.replace(/\[\d+\]/g, '').replace(/[_.]+/g, ' ').trim();
  if (!normalized) {
    return 'Trường dữ liệu';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const localizeServerMessage = (rawMessage: string): string => {
  const message = normalizeWhitespace(rawMessage);
  const lower = message.toLowerCase();

  if (
    lower.includes('call to private method')
    || lower.includes('from scope app\\')
    || lower.includes('from scope app/services')
    || lower.includes('/users/')
    || lower.includes('stack trace')
  ) {
    return 'Hệ thống gặp lỗi nội bộ. Vui lòng thử lại sau.';
  }

  if (lower.includes('unauthenticated')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (lower.includes('this action is unauthorized') || lower.includes('forbidden') || lower.includes('not authorized')) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  if (lower.includes('parent_id is invalid')) {
    return 'Phòng ban cha không hợp lệ.';
  }

  if (lower.includes('has already been taken')) {
    const duplicateHint = DUPLICATE_FIELD_HINTS.find((hint) => hint.pattern.test(lower));
    return duplicateHint ? `${duplicateHint.label} đã tồn tại.` : 'Dữ liệu đã tồn tại.';
  }

  return message;
};

const localizeValidationMessage = (field: string, rawMessage: string): string => {
  const message = normalizeWhitespace(rawMessage);
  const lower = message.toLowerCase();
  const label = resolveFieldLabel(field);

  if (lower.includes('has already been taken')) {
    return `${label} đã tồn tại.`;
  }

  if (lower.includes('field is required')) {
    return `${label} là bắt buộc.`;
  }

  if (lower.includes('selected') && lower.includes('is invalid')) {
    return `${label} không hợp lệ.`;
  }

  if (lower.includes('must be an integer')) {
    return `${label} phải là số nguyên hợp lệ.`;
  }

  if (lower.includes('must be a number')) {
    return `${label} phải là số hợp lệ.`;
  }

  if (lower.includes('must be true or false')) {
    return `${label} phải là giá trị đúng hoặc sai.`;
  }

  if (lower.includes('must be a valid email')) {
    return `${label} không đúng định dạng email.`;
  }

  if (lower.includes('format is invalid')) {
    return `${label} không đúng định dạng.`;
  }

  if (lower.includes('may not be greater than')) {
    return `${label} vượt quá giới hạn cho phép.`;
  }

  return localizeServerMessage(message);
};

const getFirstValidationError = (errors: ApiErrorPayload['errors']): { field: string; message: string } | null => {
  if (!errors || typeof errors !== 'object') {
    return null;
  }

  for (const [field, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value;
    if (typeof message === 'string' && message.trim()) {
      return { field, message };
    }
  }

  return null;
};

const parseErrorMessage = async (res: Response, _fallback: string): Promise<string> => {
  try {
    const payload = (await res.json()) as ApiErrorPayload;
    if (typeof payload?.code === 'string' && payload.code.trim()) {
      return payload.code.trim();
    }
    const firstValidationError = getFirstValidationError(payload?.errors);
    if (firstValidationError) {
      return localizeValidationMessage(firstValidationError.field, firstValidationError.message);
    }

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return localizeServerMessage(payload.message);
    }
  } catch {
    // Ignore parsing error.
  }

  if (res.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (res.status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  if (res.status === 404) {
    return 'Không tìm thấy dữ liệu yêu cầu.';
  }

  if (res.status === 409) {
    return 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.';
  }

  if (res.status === 422) {
    return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
  }

  if (res.status >= 500) {
    return 'Hệ thống đang bận. Vui lòng thử lại sau.';
  }

  return `Yêu cầu thất bại (HTTP ${res.status}).`;
};

const resolveDownloadFilename = (res: Response, fallback: string): string => {
  const disposition = res.headers.get('content-disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (asciiMatch && asciiMatch[1]) {
    return asciiMatch[1];
  }

  return fallback;
};

const parseItemJson = async <T>(res: Response): Promise<T> => {
  const payload = (await res.json()) as ApiItemResponse<T>;
  return payload.data as T;
};

const parseItemResponse = async <T>(res: Response): Promise<ApiItemResponse<T>> => {
  return (await res.json()) as ApiItemResponse<T>;
};

export const login = async (payload: AuthLoginPayload): Promise<AuthLoginResult> => {
  const res = await apiFetch('/api/v5/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'LOGIN_FAILED'));
  }

  const parsed = await parseItemResponse<AuthLoginResult>(res);
  const result = parsed?.data;
  const user = result?.user;

  if (!user) {
    throw new Error('Phản hồi đăng nhập không hợp lệ.');
  }

  return {
    user: {
      ...user,
      password_change_required: Boolean(result?.password_change_required ?? parsed.password_change_required ?? user.password_change_required),
    },
    password_change_required: Boolean(result?.password_change_required ?? parsed.password_change_required ?? user.password_change_required),
  };
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const res = await apiFetch('/api/v5/auth/me', {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_AUTH_ME_FAILED'));
  }

  const payload = await parseItemResponse<AuthUser>(res);
  const user = payload.data;
  if (!user) {
    throw new Error('Phản hồi người dùng hiện tại không hợp lệ.');
  }

  return {
    ...user,
    password_change_required: Boolean(payload.password_change_required ?? user.password_change_required),
  };
};

export const fetchAuthBootstrap = async (): Promise<AuthBootstrapResult> => {
  const res = await apiFetch('/api/v5/bootstrap', {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_AUTH_BOOTSTRAP_FAILED'));
  }

  return parseItemJson<AuthBootstrapResult>(res);
};

export const logout = async (): Promise<void> => {
  await apiFetch('/api/v5/auth/logout', {
    method: 'POST',
    headers: JSON_ACCEPT_HEADER,
  });
};

export const changePasswordFirstLogin = async (payload: {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}): Promise<AuthLoginResult> => {
  const res = await apiFetch('/api/v5/auth/change-password', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CHANGE_PASSWORD_FAILED'));
  }

  const parsed = await parseItemResponse<AuthLoginResult>(res);
  const result = parsed?.data;
  const user = result?.user;
  if (!user) {
    throw new Error('Phản hồi đổi mật khẩu không hợp lệ.');
  }

  return {
    user: {
      ...user,
      password_change_required: false,
    },
    password_change_required: false,
  };
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
  const normalized = normalizeNullableNumber(value);
  return normalized ?? fallback;
};

const normalizeNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
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

const normalizePaymentCycle = (value: unknown, fallback: PaymentCycle = 'ONCE'): PaymentCycle => {
  const normalized = String(value || '').trim().toUpperCase();
  if (
    normalized === 'ONCE' ||
    normalized === 'MONTHLY' ||
    normalized === 'QUARTERLY' ||
    normalized === 'HALF_YEARLY' ||
    normalized === 'YEARLY'
  ) {
    return normalized;
  }
  return fallback;
};

const normalizePositionId = (value: unknown): number | null => {
  const numeric = normalizeNullableNumber(value);
  if (numeric !== null) {
    return numeric;
  }

  const text = normalizeNullableText(value);
  if (!text) {
    return null;
  }

  const matched = text.toUpperCase().match(/^(?:POS|P)?0*(\d+)$/);
  if (!matched) {
    return null;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildEmployeeRequestPayload = (payload: Partial<Employee>) => {
  const normalizedEmployeeCode = normalizeEmployeeCode(payload.user_code || payload.employee_code || payload.id, payload.id);
  const normalizedPhone = normalizeNullableText(payload.phone_number || payload.phone || payload.mobile);
  return {
    uuid: payload.uuid,
    user_code: normalizedEmployeeCode,
    username: payload.username || normalizedEmployeeCode,
    full_name: payload.full_name,
    phone_number: normalizedPhone,
    phone: normalizedPhone,
    email: payload.email,
    status: payload.status || 'ACTIVE',
    job_title_raw: normalizeNullableText(payload.job_title_raw),
    date_of_birth: normalizeNullableText(payload.date_of_birth),
    gender: normalizeNullableText(payload.gender),
    vpn_status: normalizeNullableText(payload.vpn_status) || 'NO',
    ip_address: normalizeNullableText(payload.ip_address),
    department_id: normalizeNullableNumber(payload.department_id),
    position_id: normalizePositionId(payload.position_id),
  };
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
      const taskSource = (normalizeNullableText((task as any)?.task_source) || 'IT360').toUpperCase();
      const isReferenceTask = taskSource === 'REFERENCE';
      return {
        task_source: taskSource,
        task_code: normalizeNullableText((task as any)?.task_code),
        task_link: isReferenceTask ? null : normalizeNullableText((task as any)?.task_link),
        status: isReferenceTask
          ? null
          : normalizeSupportRequestTaskStatus((task as any)?.status ?? (task as any)?.task_status),
        sort_order: normalizeNumber((task as any)?.sort_order, index),
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

const fetchList = async <T>(path: string): Promise<T[]> => {
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `list:${path}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `FETCH_${path.toUpperCase()}_FAILED`));
  }

  const payload = await parseJson<T>(res);
  return payload.data ?? [];
};

const fetchPaginatedList = async <T>(
  path: string,
  query?: PaginatedQuery,
  queryStringBuilder: (query?: PaginatedQuery) => string = buildPaginatedQueryString
): Promise<PaginatedResult<T>> => {
  const suffix = queryStringBuilder(query);
  const res = await apiFetch(`${path}${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: `page:${path}`,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `FETCH_${path.toUpperCase()}_FAILED`));
  }

  return parsePaginatedJson<T>(res);
};

const buildOptionsPageQuery = (q: string, page = 1, perPage = 30): PaginatedQuery => ({
  page: Math.max(1, Math.floor(Number(page) || 1)),
  per_page: Math.max(1, Math.min(200, Math.floor(Number(perPage) || 30))),
  q: String(q || '').trim(),
  sort_by: 'id',
  sort_dir: 'asc',
});

export const fetchDepartments = async (): Promise<Department[]> => fetchList<Department>('/api/v5/departments');
export const fetchEmployees = async (): Promise<Employee[]> => fetchList<Employee>(INTERNAL_USERS_ENDPOINT);
export const fetchEmployeesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Employee>> =>
  fetchPaginatedList<Employee>(INTERNAL_USERS_ENDPOINT, query);
export const fetchEmployeesOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Employee>> =>
  fetchEmployeesPage(buildOptionsPageQuery(q, page, perPage));
export const fetchBusinesses = async (): Promise<Business[]> => fetchList<Business>('/api/v5/businesses');
export const fetchBusinessesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Business>> =>
  fetchPaginatedList<Business>('/api/v5/businesses', query);
export const fetchBusinessesOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Business>> =>
  fetchBusinessesPage(buildOptionsPageQuery(q, page, perPage));
export const fetchProducts = async (): Promise<Product[]> => fetchList<Product>('/api/v5/products');
export const fetchProductsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Product>> =>
  fetchPaginatedList<Product>('/api/v5/products', query);
export const fetchProductsOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Product>> =>
  fetchProductsPage(buildOptionsPageQuery(q, page, perPage));
export const fetchCustomers = async (): Promise<Customer[]> => fetchList<Customer>('/api/v5/customers');
export const fetchCustomersPage = async (query: PaginatedQuery): Promise<PaginatedResult<Customer>> =>
  fetchPaginatedList<Customer>('/api/v5/customers', query);
export const fetchCustomersOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Customer>> =>
  fetchCustomersPage(buildOptionsPageQuery(q, page, perPage));
export const fetchCustomerPersonnel = async (
  customerId?: number | null,
  status?: string | null
): Promise<CustomerPersonnel[]> => {
  const params = new URLSearchParams();

  if (Number.isFinite(Number(customerId))) {
    params.set('customer_id', String(Number(customerId)));
  }

  const normalizedStatus = String(status || '').trim().toUpperCase();
  if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'INACTIVE') {
    params.set('status', normalizedStatus);
  }

  const query = params.toString();
  return fetchList<CustomerPersonnel>(`/api/v5/customer-personnel${query ? `?${query}` : ''}`);
};
export const fetchCustomerPersonnelPage = async (query: PaginatedQuery): Promise<PaginatedResult<CustomerPersonnel>> =>
  fetchPaginatedList<CustomerPersonnel>('/api/v5/customer-personnel', query);
export const fetchCustomerPersonnelOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<CustomerPersonnel>> => fetchCustomerPersonnelPage(buildOptionsPageQuery(q, page, perPage));
export const fetchVendors = async (): Promise<Vendor[]> => fetchList<Vendor>('/api/v5/vendors');
export const fetchVendorsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Vendor>> =>
  fetchPaginatedList<Vendor>('/api/v5/vendors', query);
export const fetchVendorsOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Vendor>> =>
  fetchVendorsPage(buildOptionsPageQuery(q, page, perPage));
export const fetchProjects = async (): Promise<Project[]> => fetchList<Project>('/api/v5/projects');
export const fetchProjectsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Project>> =>
  fetchPaginatedList<Project>('/api/v5/projects', query);
export const fetchProjectDetail = async (id: string | number): Promise<Project> => {
  const res = await apiFetch(`/api/v5/projects/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROJECT_DETAIL_FAILED'));
  }

  return parseItemJson<Project>(res);
};
export const fetchProjectRaciAssignments = async (
  projectIds: Array<string | number>
): Promise<ProjectRaciRow[]> => {
  const normalizedIds = (projectIds || [])
    .map((value) => normalizeNullableNumber(value))
    .filter((value): value is number => value !== null && value > 0);

  if (normalizedIds.length === 0) {
    return [];
  }

  const query = new URLSearchParams();
  query.set('project_ids', normalizedIds.join(','));
  const res = await apiFetch(`/api/v5/projects/raci-assignments?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROJECT_RACI_ASSIGNMENTS_FAILED'));
  }

  const payload = await parseJson<ProjectRaciRow>(res);
  return payload.data ?? [];
};
export const fetchProjectItems = async (): Promise<ProjectItemMaster[]> =>
  fetchList<ProjectItemMaster>('/api/v5/project-items');
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
export const fetchProjectItemsPage = async (query: PaginatedQuery): Promise<PaginatedResult<ProjectItemMaster>> =>
  fetchPaginatedList<ProjectItemMaster>('/api/v5/project-items', query);
export const fetchProjectItemsOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<ProjectItemMaster>> => fetchProjectItemsPage(buildOptionsPageQuery(q, page, perPage));
export const fetchContracts = async (): Promise<Contract[]> => fetchList<Contract>('/api/v5/contracts');
export const fetchContractsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Contract>> =>
  fetchPaginatedList<Contract>('/api/v5/contracts', query);
export const fetchOpportunities = async (): Promise<Opportunity[]> => fetchList<Opportunity>('/api/v5/opportunities');
export const fetchOpportunitiesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Opportunity>> =>
  fetchPaginatedList<Opportunity>('/api/v5/opportunities', query);
export const fetchOpportunitiesOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Opportunity>> => fetchOpportunitiesPage(buildOptionsPageQuery(q, page, perPage));
export const fetchOpportunityRaciAssignments = async (
  opportunityIds: Array<string | number>
): Promise<OpportunityRaciRow[]> => {
  const normalizedIds = (opportunityIds || [])
    .map((value) => normalizeNullableNumber(value))
    .filter((value): value is number => value !== null && value > 0);

  if (normalizedIds.length === 0) {
    return [];
  }

  const query = new URLSearchParams();
  query.set('opportunity_ids', normalizedIds.join(','));
  const res = await apiFetch(`/api/v5/opportunities/raci-assignments?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_OPPORTUNITY_RACI_ASSIGNMENTS_FAILED'));
  }

  const payload = await parseJson<OpportunityRaciRow>(res);
  return payload.data ?? [];
};
export const fetchDocuments = async (): Promise<Document[]> => fetchList<Document>('/api/v5/documents');
export const fetchDocumentsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Document>> =>
  fetchPaginatedList<Document>('/api/v5/documents', query);
export const fetchReminders = async (): Promise<Reminder[]> => fetchList<Reminder>('/api/v5/reminders');
export const fetchRemindersPage = async (query: PaginatedQuery): Promise<PaginatedResult<Reminder>> =>
  fetchPaginatedList<Reminder>('/api/v5/reminders', query);
export const fetchUserDeptHistory = async (): Promise<UserDeptHistory[]> =>
  fetchList<UserDeptHistory>('/api/v5/user-dept-history');
export const fetchUserDeptHistoryPage = async (query: PaginatedQuery): Promise<PaginatedResult<UserDeptHistory>> =>
  fetchPaginatedList<UserDeptHistory>('/api/v5/user-dept-history', query);
export const fetchAuditLogs = async (): Promise<AuditLog[]> => fetchList<AuditLog>('/api/v5/audit-logs');
export const fetchAuditLogsPage = async (query: PaginatedQuery): Promise<PaginatedResult<AuditLog>> =>
  fetchPaginatedList<AuditLog>('/api/v5/audit-logs', query);
export const fetchSupportServiceGroups = async (includeInactive = false): Promise<SupportServiceGroup[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportServiceGroup>(`/api/v5/support-service-groups${query}`);
};
export const fetchAvailableSupportServiceGroups = async (params: {
  customer_id: string | number;
  include_group_id?: string | number | null;
  include_inactive?: boolean;
}): Promise<SupportServiceGroup[]> => {
  const searchParams = new URLSearchParams();
  searchParams.set('customer_id', String(params.customer_id));
  if (params.include_group_id !== null && params.include_group_id !== undefined && params.include_group_id !== '') {
    searchParams.set('include_group_id', String(params.include_group_id));
  }
  if (params.include_inactive) {
    searchParams.set('include_inactive', '1');
  }

  return fetchList<SupportServiceGroup>(`/api/v5/support-service-groups/available?${searchParams.toString()}`);
};
export const fetchSupportContactPositions = async (includeInactive = false): Promise<SupportContactPosition[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportContactPosition>(`/api/v5/support-contact-positions${query}`);
};
export const fetchSupportRequestStatuses = async (includeInactive = false): Promise<SupportRequestStatusOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportRequestStatusOption>(`/api/v5/support-request-statuses${query}`);
};
export const fetchWorklogActivityTypes = async (includeInactive = false): Promise<WorklogActivityTypeOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<WorklogActivityTypeOption>(`/api/v5/worklog-activity-types${query}`);
};
export const fetchSupportSlaConfigs = async (includeInactive = false): Promise<SupportSlaConfigOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportSlaConfigOption>(`/api/v5/support-sla-configs${query}`);
};
export const fetchWorkflowStatusCatalogs = async (includeInactive = false): Promise<WorkflowStatusCatalog[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<WorkflowStatusCatalog>(`/api/v5/workflow-status-catalogs${query}`);
};
export const fetchWorkflowStatusTransitions = async (
  fromStatusCatalogId?: string | number | null,
  includeInactive = false
): Promise<WorkflowStatusTransition[]> => {
  const params = new URLSearchParams();
  if (includeInactive) {
    params.set('include_inactive', '1');
  }
  if (fromStatusCatalogId !== undefined && fromStatusCatalogId !== null && `${fromStatusCatalogId}`.trim() !== '') {
    params.set('from_status_catalog_id', String(fromStatusCatalogId));
  }
  const suffix = params.toString();
  return fetchList<WorkflowStatusTransition>(`/api/v5/workflow-status-transitions${suffix ? `?${suffix}` : ''}`);
};
export const fetchWorkflowFormFieldConfigs = async (
  statusCatalogId?: string | number | null,
  includeInactive = false
): Promise<WorkflowFormFieldConfig[]> => {
  const params = new URLSearchParams();
  if (includeInactive) {
    params.set('include_inactive', '1');
  }
  if (statusCatalogId !== undefined && statusCatalogId !== null && `${statusCatalogId}`.trim() !== '') {
    params.set('status_catalog_id', String(statusCatalogId));
  }
  const suffix = params.toString();
  return fetchList<WorkflowFormFieldConfig>(`/api/v5/workflow-form-field-configs${suffix ? `?${suffix}` : ''}`);
};
export const createWorkflowStatusCatalog = async (
  payload: Partial<WorkflowStatusCatalog>
): Promise<WorkflowStatusCatalog> => {
  const res = await apiFetch('/api/v5/workflow-status-catalogs', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_WORKFLOW_STATUS_CATALOG_FAILED'));
  }
  return parseItemJson<WorkflowStatusCatalog>(res);
};
export const updateWorkflowStatusCatalog = async (
  id: string | number,
  payload: Partial<WorkflowStatusCatalog>
): Promise<WorkflowStatusCatalog> => {
  const res = await apiFetch(`/api/v5/workflow-status-catalogs/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKFLOW_STATUS_CATALOG_FAILED'));
  }
  return parseItemJson<WorkflowStatusCatalog>(res);
};
export const createWorkflowStatusTransition = async (
  payload: Partial<WorkflowStatusTransition>
): Promise<WorkflowStatusTransition> => {
  const res = await apiFetch('/api/v5/workflow-status-transitions', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_WORKFLOW_STATUS_TRANSITION_FAILED'));
  }
  return parseItemJson<WorkflowStatusTransition>(res);
};
export const updateWorkflowStatusTransition = async (
  id: string | number,
  payload: Partial<WorkflowStatusTransition>
): Promise<WorkflowStatusTransition> => {
  const res = await apiFetch(`/api/v5/workflow-status-transitions/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKFLOW_STATUS_TRANSITION_FAILED'));
  }
  return parseItemJson<WorkflowStatusTransition>(res);
};
export const createWorkflowFormFieldConfig = async (
  payload: Partial<WorkflowFormFieldConfig>
): Promise<WorkflowFormFieldConfig> => {
  const res = await apiFetch('/api/v5/workflow-form-field-configs', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_WORKFLOW_FORM_FIELD_CONFIG_FAILED'));
  }
  return parseItemJson<WorkflowFormFieldConfig>(res);
};
export const updateWorkflowFormFieldConfig = async (
  id: string | number,
  payload: Partial<WorkflowFormFieldConfig>
): Promise<WorkflowFormFieldConfig> => {
  const res = await apiFetch(`/api/v5/workflow-form-field-configs/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKFLOW_FORM_FIELD_CONFIG_FAILED'));
  }
  return parseItemJson<WorkflowFormFieldConfig>(res);
};
export const fetchCustomerRequestsPage = async (query: PaginatedQuery): Promise<PaginatedResult<CustomerRequest>> =>
  fetchPaginatedList<CustomerRequest>('/api/v5/customer-requests', query);
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
export const createCustomerRequest = async (payload: Partial<CustomerRequest> & Record<string, unknown>): Promise<CustomerRequest> => {
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
  if (
    params?.filters?.to_status_catalog_id !== undefined
    && params.filters.to_status_catalog_id !== null
    && `${params.filters.to_status_catalog_id}`.trim() !== ''
  ) {
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
export const exportCustomerRequestDashboardSummaryCsv = async (query?: PaginatedQuery): Promise<DownloadFileResult> => {
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
    filename: resolveDownloadFilename(res, `customer_request_dashboard_summary_${new Date().toISOString().slice(0, 10)}.csv`),
  };
};
export const fetchOpportunityStages = async (includeInactive = false): Promise<OpportunityStageOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<OpportunityStageOption>(`/api/v5/opportunity-stages${query}`);
};
export const fetchProjectTypes = async (includeInactive = false): Promise<ProjectTypeOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<ProjectTypeOption>(`/api/v5/project-types${query}`);
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

export const fetchV5MasterData = async () => {
  const requests = await Promise.allSettled([
    apiFetch('/api/v5/departments', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch(INTERNAL_USERS_ENDPOINT, { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/businesses', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/products', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/customers', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/customer-personnel', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/vendors', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/projects', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/project-items', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/contracts', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/payment-schedules', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/opportunities', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/documents', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/reminders', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/user-dept-history', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/audit-logs', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/support-service-groups', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/support-contact-positions', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/support-request-statuses', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/roles', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/permissions', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/user-access', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
  ]);

  const [
    departmentsRes,
    employeesRes,
    businessesRes,
    productsRes,
    customersRes,
    customerPersonnelRes,
    vendorsRes,
    projectsRes,
    projectItemsRes,
    contractsRes,
    paymentSchedulesRes,
    opportunitiesRes,
    documentsRes,
    remindersRes,
    userDeptHistoryRes,
    auditLogsRes,
    supportServiceGroupsRes,
    supportContactPositionsRes,
    supportRequestStatusesRes,
    rolesRes,
    permissionsRes,
    userAccessRes,
  ] = requests;

  const departments = departmentsRes.status === 'fulfilled' ? await parseJson<Department>(departmentsRes.value) : { data: [] };
  const employees = employeesRes.status === 'fulfilled' ? await parseJson<Employee>(employeesRes.value) : { data: [] };
  const businesses = businessesRes.status === 'fulfilled' ? await parseJson<Business>(businessesRes.value) : { data: [] };
  const products = productsRes.status === 'fulfilled' ? await parseJson<Product>(productsRes.value) : { data: [] };
  const customers = customersRes.status === 'fulfilled' ? await parseJson<Customer>(customersRes.value) : { data: [] };
  const customerPersonnel = customerPersonnelRes.status === 'fulfilled' ? await parseJson<CustomerPersonnel>(customerPersonnelRes.value) : { data: [] };
  const vendors = vendorsRes.status === 'fulfilled' ? await parseJson<Vendor>(vendorsRes.value) : { data: [] };
  const projects = projectsRes.status === 'fulfilled' ? await parseJson<Project>(projectsRes.value) : { data: [] };
  const projectItems = projectItemsRes.status === 'fulfilled' ? await parseJson<ProjectItemMaster>(projectItemsRes.value) : { data: [] };
  const contracts = contractsRes.status === 'fulfilled' ? await parseJson<Contract>(contractsRes.value) : { data: [] };
  const paymentSchedules = paymentSchedulesRes.status === 'fulfilled' ? await parseJson<PaymentSchedule>(paymentSchedulesRes.value) : { data: [] };
  const opportunities = opportunitiesRes.status === 'fulfilled' ? await parseJson<Opportunity>(opportunitiesRes.value) : { data: [] };
  const documents = documentsRes.status === 'fulfilled' ? await parseJson<Document>(documentsRes.value) : { data: [] };
  const reminders = remindersRes.status === 'fulfilled' ? await parseJson<Reminder>(remindersRes.value) : { data: [] };
  const userDeptHistory = userDeptHistoryRes.status === 'fulfilled' ? await parseJson<UserDeptHistory>(userDeptHistoryRes.value) : { data: [] };
  const auditLogs = auditLogsRes.status === 'fulfilled' ? await parseJson<AuditLog>(auditLogsRes.value) : { data: [] };
  const supportServiceGroups = supportServiceGroupsRes.status === 'fulfilled' ? await parseJson<SupportServiceGroup>(supportServiceGroupsRes.value) : { data: [] };
  const supportContactPositions = supportContactPositionsRes.status === 'fulfilled' ? await parseJson<SupportContactPosition>(supportContactPositionsRes.value) : { data: [] };
  const supportRequestStatuses = supportRequestStatusesRes.status === 'fulfilled' ? await parseJson<SupportRequestStatusOption>(supportRequestStatusesRes.value) : { data: [] };
  const roles = rolesRes.status === 'fulfilled' ? await parseJson<Role>(rolesRes.value) : { data: [] };
  const permissions = permissionsRes.status === 'fulfilled' ? await parseJson<Permission>(permissionsRes.value) : { data: [] };
  const userAccess = userAccessRes.status === 'fulfilled' ? await parseJson<UserAccessRecord>(userAccessRes.value) : { data: [] };

  return {
    departments: departments.data ?? [],
    employees: employees.data ?? [],
    businesses: businesses.data ?? [],
    products: products.data ?? [],
    customers: customers.data ?? [],
    customerPersonnel: customerPersonnel.data ?? [],
    vendors: vendors.data ?? [],
    projects: projects.data ?? [],
    projectItems: projectItems.data ?? [],
    contracts: contracts.data ?? [],
    paymentSchedules: paymentSchedules.data ?? [],
    opportunities: opportunities.data ?? [],
    documents: documents.data ?? [],
    reminders: reminders.data ?? [],
    userDeptHistory: userDeptHistory.data ?? [],
    auditLogs: auditLogs.data ?? [],
    supportServiceGroups: supportServiceGroups.data ?? [],
    supportContactPositions: supportContactPositions.data ?? [],
    supportRequestStatuses: supportRequestStatuses.data ?? [],
    roles: roles.data ?? [],
    permissions: permissions.data ?? [],
    userAccess: userAccess.data ?? [],
  };
};

export const createDepartment = async (payload: Partial<Department>): Promise<Department> => {
  const res = await apiFetch('/api/v5/departments', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      dept_code: payload.dept_code,
      dept_name: payload.dept_name,
      parent_id: normalizeNullableNumber(payload.parent_id),
      is_active: payload.is_active ?? true,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DEPARTMENT_FAILED'));
  }

  return parseItemJson<Department>(res);
};

export const updateDepartment = async (id: string | number, payload: Partial<Department>): Promise<Department> => {
  const res = await apiFetch(`/api/v5/departments/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      dept_code: payload.dept_code,
      dept_name: payload.dept_name,
      parent_id: normalizeNullableNumber(payload.parent_id),
      is_active: payload.is_active,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DEPARTMENT_FAILED'));
  }

  return parseItemJson<Department>(res);
};

export const deleteDepartment = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/departments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_FAILED'));
  }
};

export const createEmployeeWithProvisioning = async (payload: Partial<Employee>): Promise<EmployeeSaveResult> => {
  const res = await apiFetch(INTERNAL_USERS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildEmployeeRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEE_FAILED'));
  }

  const parsed = await parseItemResponse<Employee>(res);
  if (!parsed.data) {
    throw new Error('Phản hồi tạo nhân sự không hợp lệ.');
  }

  return {
    employee: parsed.data,
    provisioning: parsed.provisioning || null,
  };
};

export const createEmployee = async (payload: Partial<Employee>): Promise<Employee> => {
  const result = await createEmployeeWithProvisioning(payload);
  return result.employee;
};

export const createEmployeesBulk = async (items: Array<Partial<Employee>>): Promise<BulkMutationResult<Employee>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/bulk`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => buildEmployeeRequestPayload(item)),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEES_BULK_FAILED'));
  }

  return parseBulkMutationJson<Employee>(res);
};

export const updateEmployee = async (id: string | number, payload: Partial<Employee>): Promise<Employee> => {
  const normalizedEmployeeCode = normalizeEmployeeCode(payload.user_code || payload.employee_code || id, id);
  const normalizedPhone = normalizeNullableText(payload.phone_number || payload.phone || payload.mobile);
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      user_code: normalizedEmployeeCode,
      username: payload.username,
      full_name: payload.full_name,
      phone_number: normalizedPhone,
      phone: normalizedPhone,
      email: payload.email,
      status: payload.status,
      job_title_raw: normalizeNullableText(payload.job_title_raw),
      date_of_birth: normalizeNullableText(payload.date_of_birth),
      gender: normalizeNullableText(payload.gender),
      vpn_status: normalizeNullableText(payload.vpn_status),
      ip_address: normalizeNullableText(payload.ip_address),
      department_id: normalizeNullableNumber(payload.department_id),
      position_id: normalizePositionId(payload.position_id),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_EMPLOYEE_FAILED'));
  }

  return parseItemJson<Employee>(res);
};

export const deleteEmployee = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_EMPLOYEE_FAILED'));
  }
};

export const resetEmployeePassword = async (id: string | number): Promise<EmployeeSaveResult> => {
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${id}/reset-password`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'RESET_EMPLOYEE_PASSWORD_FAILED'));
  }

  const parsed = await parseItemResponse<Employee>(res);
  if (!parsed.data) {
    throw new Error('Phản hồi reset mật khẩu nhân sự không hợp lệ.');
  }

  return {
    employee: parsed.data,
    provisioning: parsed.provisioning || null,
  };
};

export const createCustomer = async (payload: Partial<Customer>): Promise<Customer> => {
  const res = await apiFetch('/api/v5/customers', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      customer_code: payload.customer_code,
      customer_name: payload.customer_name,
      tax_code: payload.tax_code,
      address: payload.address,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CUSTOMER_FAILED'));
  }

  return parseItemJson<Customer>(res);
};

export const updateCustomer = async (id: string | number, payload: Partial<Customer>): Promise<Customer> => {
  const res = await apiFetch(`/api/v5/customers/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      customer_code: payload.customer_code,
      customer_name: payload.customer_name,
      tax_code: payload.tax_code,
      address: payload.address,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CUSTOMER_FAILED'));
  }

  return parseItemJson<Customer>(res);
};

export const deleteCustomer = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customers/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_FAILED'));
  }
};

export const createCustomerPersonnel = async (
  payload: Partial<CustomerPersonnel>
): Promise<CustomerPersonnel> => {
  const res = await apiFetch('/api/v5/customer-personnel', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customerId),
      full_name: normalizeNullableText(payload.fullName),
      date_of_birth: normalizeNullableText(payload.birthday),
      position_type: normalizeNullableText(payload.positionType) || 'DAU_MOI',
      position_id: normalizeNullableNumber(payload.positionId),
      phone: normalizeNullableText(payload.phoneNumber),
      email: normalizeNullableText(payload.email),
      status: normalizeNullableText(payload.status) || 'ACTIVE',
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CUSTOMER_PERSONNEL_FAILED'));
  }

  return parseItemJson<CustomerPersonnel>(res);
};

export const updateCustomerPersonnel = async (
  id: string | number,
  payload: Partial<CustomerPersonnel>
): Promise<CustomerPersonnel> => {
  const res = await apiFetch(`/api/v5/customer-personnel/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customerId),
      full_name: normalizeNullableText(payload.fullName),
      date_of_birth: normalizeNullableText(payload.birthday),
      position_type: normalizeNullableText(payload.positionType) || 'DAU_MOI',
      position_id: normalizeNullableNumber(payload.positionId),
      phone: normalizeNullableText(payload.phoneNumber),
      email: normalizeNullableText(payload.email),
      status: normalizeNullableText(payload.status) || 'ACTIVE',
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CUSTOMER_PERSONNEL_FAILED'));
  }

  return parseItemJson<CustomerPersonnel>(res);
};

export const deleteCustomerPersonnel = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/customer-personnel/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_PERSONNEL_FAILED'));
  }
};

export const createBusiness = async (payload: Partial<Business>): Promise<Business> => {
  const res = await apiFetch('/api/v5/businesses', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      domain_code: normalizeNullableText(payload.domain_code),
      domain_name: normalizeNullableText(payload.domain_name),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_BUSINESS_FAILED'));
  }

  return parseItemJson<Business>(res);
};

export const updateBusiness = async (id: string | number, payload: Partial<Business>): Promise<Business> => {
  const res = await apiFetch(`/api/v5/businesses/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      domain_code: normalizeNullableText(payload.domain_code),
      domain_name: normalizeNullableText(payload.domain_name),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_BUSINESS_FAILED'));
  }

  return parseItemJson<Business>(res);
};

export const deleteBusiness = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/businesses/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_BUSINESS_FAILED'));
  }
};

export const createVendor = async (payload: Partial<Vendor>): Promise<Vendor> => {
  const res = await apiFetch('/api/v5/vendors', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      vendor_code: payload.vendor_code,
      vendor_name: payload.vendor_name,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_VENDOR_FAILED'));
  }

  return parseItemJson<Vendor>(res);
};

export const updateVendor = async (id: string | number, payload: Partial<Vendor>): Promise<Vendor> => {
  const res = await apiFetch(`/api/v5/vendors/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      vendor_code: payload.vendor_code,
      vendor_name: payload.vendor_name,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_VENDOR_FAILED'));
  }

  return parseItemJson<Vendor>(res);
};

export const deleteVendor = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/vendors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_VENDOR_FAILED'));
  }
};

export const createProduct = async (payload: Partial<Product>): Promise<Product> => {
  const res = await apiFetch('/api/v5/products', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      product_code: normalizeNullableText(payload.product_code),
      product_name: normalizeNullableText(payload.product_name),
      domain_id: normalizeNullableNumber(payload.domain_id),
      vendor_id: normalizeNullableNumber(payload.vendor_id),
      standard_price: normalizeNumber(payload.standard_price, 0),
      unit: normalizeNullableText(payload.unit),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PRODUCT_FAILED'));
  }

  return parseItemJson<Product>(res);
};

export const updateProduct = async (id: string | number, payload: Partial<Product>): Promise<Product> => {
  const res = await apiFetch(`/api/v5/products/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      product_code: normalizeNullableText(payload.product_code),
      product_name: normalizeNullableText(payload.product_name),
      domain_id: normalizeNullableNumber(payload.domain_id),
      vendor_id: normalizeNullableNumber(payload.vendor_id),
      standard_price: normalizeNumber(payload.standard_price, 0),
      unit: normalizeNullableText(payload.unit),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PRODUCT_FAILED'));
  }

  return parseItemJson<Product>(res);
};

export const deleteProduct = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/products/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PRODUCT_FAILED'));
  }
};

export const createOpportunity = async (payload: Partial<Opportunity>): Promise<Opportunity> => {
  const normalizedRaci = Array.isArray(payload.raci)
    ? payload.raci
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const userId = normalizeNullableNumber(source.user_id ?? source.userId);
          if (userId === null || userId <= 0) {
            return null;
          }

          const role = String(source.raci_role ?? source.roleType ?? '')
            .trim()
            .toUpperCase();
          if (!['R', 'A', 'C', 'I'].includes(role)) {
            return null;
          }

          return {
            user_id: userId,
            raci_role: role,
          };
        })
        .filter((item): item is { user_id: number; raci_role: string } => item !== null)
    : undefined;

  const res = await apiFetch('/api/v5/opportunities', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage || 'NEW',
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      raci: normalizedRaci,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_OPPORTUNITY_FAILED'));
  }

  return parseItemJson<Opportunity>(res);
};

export const updateOpportunity = async (id: string | number, payload: Partial<Opportunity>): Promise<Opportunity> => {
  const normalizedRaci = Array.isArray(payload.raci)
    ? payload.raci
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const userId = normalizeNullableNumber(source.user_id ?? source.userId);
          if (userId === null || userId <= 0) {
            return null;
          }

          const role = String(source.raci_role ?? source.roleType ?? '')
            .trim()
            .toUpperCase();
          if (!['R', 'A', 'C', 'I'].includes(role)) {
            return null;
          }

          return {
            user_id: userId,
            raci_role: role,
          };
        })
        .filter((item): item is { user_id: number; raci_role: string } => item !== null)
    : undefined;

  const res = await apiFetch(`/api/v5/opportunities/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage,
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      raci: normalizedRaci,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_OPPORTUNITY_FAILED'));
  }

  return parseItemJson<Opportunity>(res);
};

export const deleteOpportunity = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/opportunities/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_OPPORTUNITY_FAILED'));
  }
};

export const createProject = async (payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const normalizedItems = Array.isArray(payload.items)
    ? payload.items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const productId = normalizeNullableNumber(source.productId ?? source.product_id);
          if (productId === null || productId <= 0) {
            return null;
          }

          return {
            product_id: productId,
            quantity: normalizeNumber(source.quantity, 1),
            unit_price: normalizeNumber(source.unitPrice ?? source.unit_price, 0),
          };
        })
        .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
    : undefined;

  const normalizedRaci = Array.isArray(payload.raci)
    ? payload.raci
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const userId = normalizeNullableNumber(source.userId ?? source.user_id);
          if (userId === null || userId <= 0) {
            return null;
          }

          const role = String(source.roleType ?? source.raci_role ?? '')
            .trim()
            .toUpperCase();
          if (!role) {
            return null;
          }

          const assignedDateRaw = normalizeNullableText(source.assignedDate ?? source.assigned_date);

          return {
            user_id: userId,
            raci_role: role,
            ...(assignedDateRaw ? { assigned_date: assignedDateRaw } : {}),
          };
        })
        .filter((item): item is { user_id: number; raci_role: string } => item !== null)
    : undefined;

  const res = await apiFetch('/api/v5/projects', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status || 'TRIAL',
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      investment_mode: payload.investment_mode,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
      sync_items: typeof payload.sync_items === 'boolean' ? payload.sync_items : undefined,
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      items: normalizedItems,
      raci: normalizedRaci,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const updateProject = async (id: string | number, payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const normalizedItems = Array.isArray(payload.items)
    ? payload.items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const productId = normalizeNullableNumber(source.productId ?? source.product_id);
          if (productId === null || productId <= 0) {
            return null;
          }

          return {
            product_id: productId,
            quantity: normalizeNumber(source.quantity, 1),
            unit_price: normalizeNumber(source.unitPrice ?? source.unit_price, 0),
          };
        })
        .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
    : undefined;

  const normalizedRaci = Array.isArray(payload.raci)
    ? payload.raci
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const userId = normalizeNullableNumber(source.userId ?? source.user_id);
          if (userId === null || userId <= 0) {
            return null;
          }

          const role = String(source.roleType ?? source.raci_role ?? '')
            .trim()
            .toUpperCase();
          if (!role) {
            return null;
          }

          const assignedDateRaw = normalizeNullableText(source.assignedDate ?? source.assigned_date);

          return {
            user_id: userId,
            raci_role: role,
            ...(assignedDateRaw ? { assigned_date: assignedDateRaw } : {}),
          };
        })
        .filter((item): item is { user_id: number; raci_role: string } => item !== null)
    : undefined;

  const res = await apiFetch(`/api/v5/projects/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status,
      opportunity_id: normalizeNullableNumber(payload.opportunity_id),
      investment_mode: payload.investment_mode,
      start_date: payload.start_date,
      expected_end_date: payload.expected_end_date,
      actual_end_date: payload.actual_end_date,
      sync_items: typeof payload.sync_items === 'boolean' ? payload.sync_items : undefined,
      sync_raci: typeof payload.sync_raci === 'boolean' ? payload.sync_raci : undefined,
      items: normalizedItems,
      raci: normalizedRaci,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const deleteProject = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROJECT_FAILED'));
  }
};

// ─── Project Procedure (Checklist) APIs ───

export const fetchProcedureTemplates = async (): Promise<ProcedureTemplate[]> =>
  fetchList<ProcedureTemplate>('/api/v5/project-procedure-templates');

export const createProcedureTemplate = async (
  payload: Partial<ProcedureTemplate>
): Promise<ProcedureTemplate> => {
  const res = await apiFetch('/api/v5/project-procedure-templates', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      template_code: normalizeNullableText(payload.template_code),
      template_name: normalizeNullableText(payload.template_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'CREATE_TEMPLATE_FAILED'));
  return parseItemJson<ProcedureTemplate>(res);
};

export const updateProcedureTemplate = async (
  id: string | number,
  payload: Partial<ProcedureTemplate>
): Promise<ProcedureTemplate> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      template_code: normalizeNullableText(payload.template_code),
      template_name: normalizeNullableText(payload.template_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_TEMPLATE_FAILED'));
  return parseItemJson<ProcedureTemplate>(res);
};

export const fetchProcedureTemplateSteps = async (
  templateId: string | number
): Promise<ProcedureTemplateStep[]> =>
  fetchList<ProcedureTemplateStep>(`/api/v5/project-procedure-templates/${templateId}/steps`);

export const createProcedureTemplateStep = async (
  templateId: string | number,
  payload: Partial<ProcedureTemplateStep>
): Promise<ProcedureTemplateStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      step_number: payload.step_number,
      parent_step_id: payload.parent_step_id ?? null,
      phase: normalizeNullableText(payload.phase),
      step_name: normalizeNullableText(payload.step_name),
      step_detail: normalizeNullableText(payload.step_detail),
      lead_unit: normalizeNullableText(payload.lead_unit),
      support_unit: normalizeNullableText(payload.support_unit),
      expected_result: normalizeNullableText(payload.expected_result),
      default_duration_days: payload.default_duration_days ?? null,
      sort_order: payload.sort_order ?? null,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'CREATE_TEMPLATE_STEP_FAILED'));
  return parseItemJson<ProcedureTemplateStep>(res);
};

export const updateProcedureTemplateStep = async (
  templateId: string | number,
  stepId: string | number,
  payload: Partial<ProcedureTemplateStep>
): Promise<ProcedureTemplateStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      step_number: payload.step_number,
      parent_step_id: payload.parent_step_id,
      phase: normalizeNullableText(payload.phase),
      step_name: normalizeNullableText(payload.step_name),
      step_detail: normalizeNullableText(payload.step_detail),
      lead_unit: normalizeNullableText(payload.lead_unit),
      support_unit: normalizeNullableText(payload.support_unit),
      expected_result: normalizeNullableText(payload.expected_result),
      default_duration_days: payload.default_duration_days,
      sort_order: payload.sort_order,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_TEMPLATE_STEP_FAILED'));
  return parseItemJson<ProcedureTemplateStep>(res);
};

export const deleteProcedureTemplateStep = async (
  templateId: string | number,
  stepId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-templates/${templateId}/steps/${stepId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'DELETE_TEMPLATE_STEP_FAILED'));
};

export const fetchProjectProcedures = async (projectId: string | number): Promise<ProjectProcedure[]> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/procedures`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_PROCEDURES_FAILED'));
  const json = await res.json() as ApiListResponse<ProjectProcedure>;
  return json.data ?? [];
};

export const createProjectProcedure = async (
  projectId: string | number,
  templateId: string | number,
): Promise<ProjectProcedure> => {
  const res = await apiFetch(`/api/v5/projects/${projectId}/procedures`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ template_id: templateId }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'CREATE_PROCEDURE_FAILED'));
  const json = await res.json() as ApiItemResponse<ProjectProcedure>;
  return json.data!;
};

export const fetchProcedureSteps = async (procedureId: string | number): Promise<ProjectProcedureStep[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/steps`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_PROCEDURE_STEPS_FAILED'));
  const json = await res.json() as ApiListResponse<ProjectProcedureStep>;
  return json.data ?? [];
};

export const resyncProcedure = async (procedureId: string | number): Promise<ProjectProcedure> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/resync`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'RESYNC_PROCEDURE_FAILED'));
  return parseItemJson<ProjectProcedure>(res);
};

export const updateProcedureStep = async (
  stepId: string | number,
  payload: Partial<ProjectProcedureStep>,
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_PROCEDURE_STEP_FAILED'));
  const json = await res.json() as ApiItemResponse<ProjectProcedureStep>;
  return json.data!;
};

export const batchUpdateProcedureSteps = async (
  steps: ProcedureStepBatchUpdate[],
): Promise<{ updated_count: number; overall_progress: Record<number, number> }> => {
  const res = await apiFetch('/api/v5/project-procedure-steps/batch', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ steps }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'BATCH_UPDATE_STEPS_FAILED'));
  const json = await res.json();
  return json.data ?? { updated_count: 0, overall_progress: {} };
};

export const addCustomProcedureStep = async (
  procedureId: string | number,
  payload: {
    step_name: string;
    phase?: string | null;
    lead_unit?: string | null;
    expected_result?: string | null;
    duration_days?: number;
    parent_step_id?: string | number | null;
    actual_start_date?: string | null;
    actual_end_date?: string | null;
    progress_status?: string | null;
  },
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/steps`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'ADD_CUSTOM_STEP_FAILED'));
  const json = await res.json() as ApiItemResponse<ProjectProcedureStep>;
  return json.data!;
};

export const reorderProcedureSteps = async (
  steps: { id: string | number; sort_order: number }[],
): Promise<void> => {
  const res = await apiFetch('/api/v5/project-procedure-steps/reorder', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ steps }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'REORDER_STEPS_FAILED'));
};

export const deleteProcedureStep = async (stepId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'DELETE_PROCEDURE_STEP_FAILED'));
};

export const renameProcedureStep = async (
  stepId: string | number,
  payload: Partial<Pick<ProjectProcedureStep, 'step_name' | 'lead_unit' | 'expected_result' | 'duration_days'>>,
): Promise<ProjectProcedureStep> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_PROCEDURE_STEP_FAILED'));
  const json = await res.json() as ApiItemResponse<ProjectProcedureStep>;
  return json.data!;
};

export const updateProcedurePhaseLabel = async (
  procedureId: string | number,
  phase: string,
  phaseLabel: string,
): Promise<{ phase: string; phase_label: string }> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/phase-label`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ phase, phase_label: phaseLabel }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_PHASE_LABEL_FAILED'));
  return res.json();
};

// ── Worklog ──────────────────────────────────────────────────

export const fetchStepWorklogs = async (stepId: string | number): Promise<ProcedureStepWorklog[]> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/worklogs`, {
    credentials: 'include', headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_WORKLOGS_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureStepWorklog>;
  return json.data ?? [];
};

export const addStepWorklog = async (
  stepId: string | number,
  payload: AddWorklogPayload,
): Promise<ProcedureStepWorklog> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/worklogs`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'ADD_WORKLOG_FAILED'));
  const json = await res.json() as ApiItemResponse<ProcedureStepWorklog>;
  return json.data!;
};

export const updateStepWorklog = async (
  logId: string | number,
  payload: AddWorklogPayload,
): Promise<ProcedureStepWorklog> => {
  const res = await apiFetch(`/api/v5/project-procedure-worklogs/${logId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_WORKLOG_FAILED'));
  const json = await res.json() as ApiItemResponse<ProcedureStepWorklog>;
  return json.data!;
};

export const updateIssueStatus = async (
  issueId: string | number,
  status: IssueStatus,
): Promise<SharedIssue> => {
  const res = await apiFetch(`/api/v5/shared-issues/${issueId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ issue_status: status }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'UPDATE_ISSUE_STATUS_FAILED'));
  const json = await res.json() as ApiItemResponse<SharedIssue>;
  return json.data!;
};

export const fetchProcedureWorklogs = async (procedureId: string | number): Promise<ProcedureStepWorklog[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/worklogs`, {
    credentials: 'include', headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_PROC_WORKLOGS_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureStepWorklog>;
  return json.data ?? [];
};

// ── RACI ─────────────────────────────────────────────────────

export const fetchProcedureRaci = async (procedureId: string | number): Promise<ProcedureRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/raci`, {
    credentials: 'include', headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_RACI_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureRaciEntry>;
  return json.data ?? [];
};

export const addProcedureRaci = async (
  procedureId: string | number,
  payload: { user_id: string | number; raci_role: string; note?: string },
): Promise<ProcedureRaciEntry> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/raci`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'ADD_RACI_FAILED'));
  const json = await res.json() as ApiItemResponse<ProcedureRaciEntry>;
  return json.data!;
};

export const removeProcedureRaci = async (raciId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-raci/${raciId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'REMOVE_RACI_FAILED'));
};

export const fetchStepRaciBulk = async (procedureId: string | number): Promise<ProcedureStepRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/step-raci`, {
    credentials: 'include', headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_STEP_RACI_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureStepRaciEntry>;
  return json.data ?? [];
};

export const addStepRaci = async (
  stepId: string | number,
  payload: { user_id: string | number; raci_role: string },
): Promise<ProcedureStepRaciEntry> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/raci`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'ADD_STEP_RACI_FAILED'));
  const json = await res.json() as ApiItemResponse<ProcedureStepRaciEntry>;
  return json.data!;
};

export const removeStepRaci = async (raciId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-step-raci/${raciId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'REMOVE_STEP_RACI_FAILED'));
};

export const batchSetStepRaci = async (
  procedureId: string | number,
  payload: {
    assignments: Array<{ step_id: string | number; user_id: string | number; raci_role: string }>;
    mode: 'overwrite' | 'merge';
  },
): Promise<ProcedureStepRaciEntry[]> => {
  const res = await apiFetch(`/api/v5/project-procedures/${procedureId}/step-raci/batch`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'BATCH_STEP_RACI_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureStepRaciEntry>;
  return json.data ?? [];
};

// ── Step Attachments ────────────────────────────────────────────────────────

export interface ProcedureStepAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  driveFileId: string | null;
  storageDisk: string | null;
  storagePath: string | null;
  storageVisibility: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
}

export const getStepAttachments = async (stepId: string | number): Promise<Attachment[]> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'GET_STEP_ATTACHMENTS_FAILED'));
  const json = await res.json() as ApiListResponse<ProcedureStepAttachment>;
  // Map ProcedureStepAttachment → Attachment (id as string cho AttachmentManager)
  return (json.data ?? []).map((a): Attachment => ({
    id: String(a.id),
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    fileSize: a.fileSize ?? 0,
    mimeType: a.mimeType ?? '',
    driveFileId: a.driveFileId ?? '',
    createdAt: a.createdAt,
    storageProvider: a.storageDisk === 'backblaze_b2' || a.storageDisk === 'b2'
      ? 'BACKBLAZE_B2'
      : a.driveFileId ? 'GOOGLE_DRIVE' : 'LOCAL',
    storageDisk: a.storageDisk,
    storagePath: a.storagePath,
    storageVisibility: a.storageVisibility,
  }));
};

export const linkStepAttachment = async (
  stepId: string | number,
  payload: {
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string | null;
    driveFileId?: string | null;
    storageDisk?: string | null;
    storagePath?: string | null;
    storageVisibility?: string | null;
  },
): Promise<Attachment> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...JSON_ACCEPT_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'LINK_STEP_ATTACHMENT_FAILED'));
  const json = await res.json() as ApiItemResponse<ProcedureStepAttachment>;
  const a = json.data;
  // Map về Attachment để dùng với AttachmentManager
  return {
    id: String(a.id),
    fileName: a.fileName ?? payload.fileName,
    fileUrl: a.fileUrl ?? payload.fileUrl,
    fileSize: a.fileSize ?? payload.fileSize ?? 0,
    mimeType: a.mimeType ?? payload.mimeType ?? '',
    driveFileId: a.driveFileId ?? payload.driveFileId ?? '',
    createdAt: a.createdAt ?? new Date().toISOString(),
    storageProvider: (payload.storageDisk === 'backblaze_b2' || payload.storageDisk === 'b2')
      ? 'BACKBLAZE_B2'
      : payload.driveFileId ? 'GOOGLE_DRIVE' : 'LOCAL',
    storageDisk: payload.storageDisk ?? null,
    storagePath: payload.storagePath ?? null,
    storageVisibility: payload.storageVisibility ?? null,
  };
};

export const deleteStepAttachment = async (stepId: string | number, attachmentId: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/project-procedure-steps/${stepId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'DELETE_STEP_ATTACHMENT_FAILED'));
};

export const createContract = async (payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const termUnitRaw = String(payload.term_unit || '').trim().toUpperCase();
  const normalizedTermUnit = termUnitRaw === 'MONTH' || termUnitRaw === 'DAY' ? termUnitRaw : null;
  const normalizedItems = Array.isArray(payload.items)
    ? payload.items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const productId = normalizeNullableNumber(source.product_id ?? source.productId);
          if (productId === null || productId <= 0) {
            return null;
          }

          return {
            product_id: productId,
            quantity: normalizeNumber(source.quantity, 1),
            unit_price: normalizeNumber(source.unit_price ?? source.unitPrice, 0),
          };
        })
        .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
    : undefined;

  const res = await apiFetch('/api/v5/contracts', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contract_code: payload.contract_code,
      contract_name: payload.contract_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      value: normalizeNumber(payload.value, 0),
      payment_cycle: normalizePaymentCycle(payload.payment_cycle, 'ONCE'),
      status: payload.status || 'DRAFT',
      sign_date: payload.sign_date,
      effective_date: payload.effective_date,
      expiry_date: payload.expiry_date,
      term_unit: normalizedTermUnit,
      term_value: normalizeNullableNumber(payload.term_value),
      items: normalizedItems,
      expiry_date_manual_override: payload.expiry_date_manual_override === undefined
        ? undefined
        : Boolean(payload.expiry_date_manual_override),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const updateContract = async (id: string | number, payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const termUnitRaw = String(payload.term_unit || '').trim().toUpperCase();
  const normalizedTermUnit = termUnitRaw === 'MONTH' || termUnitRaw === 'DAY' ? termUnitRaw : null;
  const normalizedItems = Array.isArray(payload.items)
    ? payload.items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const source = item as unknown as Record<string, unknown>;
          const productId = normalizeNullableNumber(source.product_id ?? source.productId);
          if (productId === null || productId <= 0) {
            return null;
          }

          return {
            product_id: productId,
            quantity: normalizeNumber(source.quantity, 1),
            unit_price: normalizeNumber(source.unit_price ?? source.unitPrice, 0),
          };
        })
        .filter((item): item is { product_id: number; quantity: number; unit_price: number } => item !== null)
    : undefined;

  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contract_code: payload.contract_code,
      contract_name: payload.contract_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      value: normalizeNumber(payload.value, 0),
      payment_cycle: normalizePaymentCycle(payload.payment_cycle, 'ONCE'),
      status: payload.status,
      sign_date: payload.sign_date,
      effective_date: payload.effective_date,
      expiry_date: payload.expiry_date,
      term_unit: normalizedTermUnit,
      term_value: normalizeNullableNumber(payload.term_value),
      items: normalizedItems,
      expiry_date_manual_override: payload.expiry_date_manual_override === undefined
        ? undefined
        : Boolean(payload.expiry_date_manual_override),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const deleteContract = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CONTRACT_FAILED'));
  }
};

export const fetchContractDetail = async (id: string | number): Promise<Contract> => {
  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_DETAIL_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const createDocument = async (payload: Partial<Document>): Promise<Document> => {
  const normalizedProductIds = Array.from(
    new Set(
      (payload.productIds && payload.productIds.length > 0
        ? payload.productIds
        : payload.productId
          ? [payload.productId]
          : []
      )
        .map((item) => normalizeNullableNumber(item))
        .filter((item): item is number => item !== null)
    )
  );

  const res = await apiFetch('/api/v5/documents', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      scope: normalizeNullableText(payload.scope) ?? 'DEFAULT',
      id: payload.id,
      name: payload.name,
      typeId: normalizeNullableText(payload.typeId),
      customerId: normalizeNullableNumber(payload.customerId),
      projectId: normalizeNullableNumber(payload.projectId),
      expiryDate: normalizeNullableText(payload.expiryDate),
      releaseDate: normalizeNullableText(payload.releaseDate),
      status: payload.status,
      productIds: normalizedProductIds,
      attachments: (payload.attachments || []).map((attachment) => ({
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
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DOCUMENT_FAILED'));
  }

  return parseItemJson<Document>(res);
};

export const updateDocument = async (id: string | number, payload: Partial<Document>): Promise<Document> => {
  const normalizedProductIds = Array.from(
    new Set(
      (payload.productIds && payload.productIds.length > 0
        ? payload.productIds
        : payload.productId
          ? [payload.productId]
          : []
      )
        .map((item) => normalizeNullableNumber(item))
        .filter((item): item is number => item !== null)
    )
  );

  const res = await apiFetch(`/api/v5/documents/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      scope: normalizeNullableText(payload.scope) ?? 'DEFAULT',
      id: payload.id,
      name: payload.name,
      typeId: normalizeNullableText(payload.typeId),
      customerId: normalizeNullableNumber(payload.customerId),
      projectId: normalizeNullableNumber(payload.projectId),
      expiryDate: normalizeNullableText(payload.expiryDate),
      releaseDate: normalizeNullableText(payload.releaseDate),
      status: payload.status,
      productIds: normalizedProductIds,
      attachments: payload.attachments
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
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DOCUMENT_FAILED'));
  }

  return parseItemJson<Document>(res);
};

export const deleteDocument = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/documents/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DOCUMENT_FAILED'));
  }
};

export const uploadDocumentAttachment = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/api/v5/documents/upload-attachment', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPLOAD_DOCUMENT_ATTACHMENT_FAILED'));
  }

  return parseItemJson<Attachment>(res);
};

export const deleteUploadedDocumentAttachment = async (payload: {
  attachmentId?: number | string | null;
  driveFileId?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  storageDisk?: string | null;
}): Promise<void> => {
  const query = new URLSearchParams();
  const attachmentId = normalizeNullableNumber(payload.attachmentId);
  if (attachmentId !== null) {
    query.set('attachmentId', String(attachmentId));
  }
  if (payload.driveFileId) {
    query.set('driveFileId', payload.driveFileId);
  }
  if (payload.fileUrl) {
    query.set('fileUrl', payload.fileUrl);
  }
  if (payload.storagePath) {
    query.set('storagePath', payload.storagePath);
  }
  if (payload.storageDisk) {
    query.set('storageDisk', payload.storageDisk);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/documents/upload-attachment${suffix}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DOCUMENT_ATTACHMENT_FAILED'));
  }
};

// ── Feedback Attachment Upload (tái dùng storage pipeline của Document) ───────

export const uploadFeedbackAttachment = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/api/v5/documents/upload-attachment', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPLOAD_FEEDBACK_ATTACHMENT_FAILED'));
  }

  return parseItemJson<Attachment>(res);
};

export const deleteUploadedFeedbackAttachment = async (payload: {
  attachmentId?: number | string | null;
  driveFileId?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  storageDisk?: string | null;
}): Promise<void> => {
  const query = new URLSearchParams();
  const attachmentId = payload.attachmentId != null ? String(Number(payload.attachmentId)) : null;
  if (attachmentId !== null && attachmentId !== 'NaN') query.set('attachmentId', attachmentId);
  if (payload.driveFileId)  query.set('driveFileId',  payload.driveFileId);
  if (payload.fileUrl)      query.set('fileUrl',      payload.fileUrl);
  if (payload.storagePath)  query.set('storagePath',  payload.storagePath);
  if (payload.storageDisk)  query.set('storageDisk',  payload.storageDisk);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/documents/upload-attachment${suffix}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_ATTACHMENT_FAILED'));
  }
};

export const fetchGoogleDriveIntegrationSettings = async (): Promise<GoogleDriveIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/google-drive', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<GoogleDriveIntegrationSettings>(res);
};

export const updateGoogleDriveIntegrationSettings = async (
  payload: GoogleDriveIntegrationSettingsUpdatePayload
): Promise<GoogleDriveIntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/google-drive', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_enabled: payload.is_enabled,
      account_email: normalizeNullableText(payload.account_email),
      folder_id: normalizeNullableText(payload.folder_id),
      scopes: normalizeNullableText(payload.scopes),
      impersonate_user: normalizeNullableText(payload.impersonate_user),
      file_prefix: normalizeNullableText(payload.file_prefix),
      service_account_json: normalizeNullableText(payload.service_account_json),
      clear_service_account_json: Boolean(payload.clear_service_account_json),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<GoogleDriveIntegrationSettings>(res);
};

export const testGoogleDriveIntegrationSettings = async (
  payload?: GoogleDriveIntegrationSettingsUpdatePayload
): Promise<{
  message?: string;
  user_email?: string | null;
  status?: 'SUCCESS' | 'FAILED';
  tested_at?: string | null;
  persisted?: boolean;
}> => {
  const res = await apiFetch('/api/v5/integrations/google-drive/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: payload ? JSON.stringify({
      is_enabled: payload.is_enabled,
      account_email: normalizeNullableText(payload.account_email),
      folder_id: normalizeNullableText(payload.folder_id),
      scopes: normalizeNullableText(payload.scopes),
      impersonate_user: normalizeNullableText(payload.impersonate_user),
      file_prefix: normalizeNullableText(payload.file_prefix),
      service_account_json: normalizeNullableText(payload.service_account_json),
      clear_service_account_json: Boolean(payload.clear_service_account_json),
    }) : undefined,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<{ message?: string; user_email?: string | null }>(res);
};

export const fetchBackblazeB2IntegrationSettings = async (): Promise<BackblazeB2IntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<BackblazeB2IntegrationSettings>(res);
};

export const updateBackblazeB2IntegrationSettings = async (
  payload: BackblazeB2IntegrationSettingsUpdatePayload
): Promise<BackblazeB2IntegrationSettings> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_enabled: payload.is_enabled,
      access_key_id: normalizeNullableText(payload.access_key_id),
      bucket_id: normalizeNullableText(payload.bucket_id),
      bucket_name: normalizeNullableText(payload.bucket_name),
      region: normalizeNullableText(payload.region),
      file_prefix: normalizeNullableText(payload.file_prefix),
      secret_access_key: normalizeNullableText(payload.secret_access_key),
      clear_secret_access_key: Boolean(payload.clear_secret_access_key),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<BackblazeB2IntegrationSettings>(res);
};

export const testBackblazeB2IntegrationSettings = async (
  payload?: BackblazeB2IntegrationSettingsUpdatePayload
): Promise<{
  message?: string;
  status?: 'SUCCESS' | 'FAILED';
  tested_at?: string | null;
  persisted?: boolean;
}> => {
  const res = await apiFetch('/api/v5/integrations/backblaze-b2/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: payload
      ? JSON.stringify({
          is_enabled: payload.is_enabled,
          access_key_id: normalizeNullableText(payload.access_key_id),
          bucket_id: normalizeNullableText(payload.bucket_id),
          bucket_name: normalizeNullableText(payload.bucket_name),
          region: normalizeNullableText(payload.region),
          file_prefix: normalizeNullableText(payload.file_prefix),
          secret_access_key: normalizeNullableText(payload.secret_access_key),
          clear_secret_access_key: Boolean(payload.clear_secret_access_key),
        })
      : undefined,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_BACKBLAZE_B2_INTEGRATION_FAILED'));
  }

  return parseItemJson<{ message?: string; status?: 'SUCCESS' | 'FAILED'; tested_at?: string | null; persisted?: boolean }>(res);
};

export const fetchContractExpiryAlertSettings = async (): Promise<ContractExpiryAlertSettings> => {
  const res = await apiFetch('/api/v5/utilities/contract-expiry-alert', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_EXPIRY_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractExpiryAlertSettings>(res);
};

export const updateContractExpiryAlertSettings = async (
  payload: ContractExpiryAlertSettingsUpdatePayload
): Promise<ContractExpiryAlertSettings> => {
  const warningDays = Number(payload.warning_days);

  const res = await apiFetch('/api/v5/utilities/contract-expiry-alert', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      warning_days: Number.isFinite(warningDays) ? Math.floor(warningDays) : 0,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_EXPIRY_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractExpiryAlertSettings>(res);
};

export const fetchContractPaymentAlertSettings = async (): Promise<ContractPaymentAlertSettings> => {
  const res = await apiFetch('/api/v5/utilities/contract-payment-alert', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_PAYMENT_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractPaymentAlertSettings>(res);
};

export const updateContractPaymentAlertSettings = async (
  payload: ContractPaymentAlertSettingsUpdatePayload
): Promise<ContractPaymentAlertSettings> => {
  const warningDays = Number(payload.warning_days);

  const res = await apiFetch('/api/v5/utilities/contract-payment-alert', {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      warning_days: Number.isFinite(warningDays) ? Math.floor(warningDays) : 0,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_PAYMENT_ALERT_SETTINGS_FAILED'));
  }

  return parseItemJson<ContractPaymentAlertSettings>(res);
};

export const fetchPaymentSchedules = async (contractId?: string | number): Promise<PaymentSchedule[]> => {
  const query = contractId !== undefined && contractId !== null && `${contractId}` !== ''
    ? `?contract_id=${encodeURIComponent(String(contractId))}`
    : '';

  const res = await apiFetch(`/api/v5/payment-schedules${query}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PAYMENT_SCHEDULES_FAILED'));
  }

  const payload = await parseJson<PaymentSchedule>(res);
  return payload.data ?? [];
};

export const updatePaymentSchedule = async (
  id: string | number,
  payload: PaymentScheduleConfirmationPayload
): Promise<PaymentSchedule> => {
  const res = await apiFetch(`/api/v5/payment-schedules/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      actual_paid_date: normalizeNullableText(payload.actual_paid_date),
      actual_paid_amount: normalizeNumber(payload.actual_paid_amount, 0),
      status: payload.status,
      notes: normalizeNullableText(payload.notes),
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments.map((attachment) => ({
            id: normalizeNullableText(attachment.id),
            fileName: normalizeNullableText(attachment.fileName),
            mimeType: normalizeNullableText(attachment.mimeType),
            fileSize: normalizeNumber(attachment.fileSize, 0),
            fileUrl: normalizeNullableText(attachment.fileUrl),
            driveFileId: normalizeNullableText(attachment.driveFileId),
            createdAt: normalizeNullableText(attachment.createdAt),
            storageProvider: normalizeNullableText(attachment.storageProvider),
            storagePath: normalizeNullableText(attachment.storagePath),
            storageDisk: normalizeNullableText(attachment.storageDisk),
            storageVisibility: normalizeNullableText(attachment.storageVisibility),
          }))
        : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PAYMENT_SCHEDULE_FAILED'));
  }

  return parseItemJson<PaymentSchedule>(res);
};

export type ContractPaymentAllocationMode = 'EVEN' | 'MILESTONE';

export interface ContractMilestoneInstallmentInput {
  label?: string;
  percentage: number;
  expected_date?: string | null;
}

export interface GenerateContractPaymentsPayload {
  allocation_mode?: ContractPaymentAllocationMode;
  advance_percentage?: number;
  retention_percentage?: number;
  installment_count?: number;
  installments?: ContractMilestoneInstallmentInput[];
}

export interface GenerateContractPaymentsResult {
  data: PaymentSchedule[];
  generated_data: PaymentSchedule[];
  meta: {
    generated_count: number;
    allocation_mode: ContractPaymentAllocationMode;
  };
}

export const generateContractPayments = async (
  contractId: string | number,
  payload?: GenerateContractPaymentsPayload
): Promise<GenerateContractPaymentsResult> => {
  const res = await apiFetch(`/api/v5/contracts/${contractId}/generate-payments`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      allocation_mode: payload?.allocation_mode,
      advance_percentage: normalizeNullableNumber(payload?.advance_percentage),
      retention_percentage: normalizeNullableNumber(payload?.retention_percentage),
      installment_count: normalizeNullableNumber(payload?.installment_count),
      installments: Array.isArray(payload?.installments)
        ? payload?.installments.map((installment) => ({
            label: normalizeNullableText(installment.label),
            percentage: normalizeNumber(installment.percentage, 0),
            expected_date: normalizeNullableText(installment.expected_date),
          }))
        : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CONTRACT_PAYMENTS_FAILED'));
  }

  const rawPayload = (await res.json()) as ApiListResponse<PaymentSchedule> & {
    generated_data?: PaymentSchedule[];
    meta?: {
      generated_count?: number;
      allocation_mode?: ContractPaymentAllocationMode;
    };
  };

  return {
    data: rawPayload.data ?? [],
    generated_data: rawPayload.generated_data ?? rawPayload.data ?? [],
    meta: {
      generated_count: Number(rawPayload.meta?.generated_count ?? (rawPayload.data ?? []).length) || 0,
      allocation_mode: rawPayload.meta?.allocation_mode === 'MILESTONE' ? 'MILESTONE' : 'EVEN',
    },
  };
};

export const createSupportServiceGroup = async (payload: Partial<SupportServiceGroup>): Promise<SupportServiceGroup> => {
  const res = await apiFetch('/api/v5/support-service-groups', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customer_id),
      group_code: normalizeNullableText(payload.group_code),
      group_name: payload.group_name,
      description: normalizeNullableText(payload.description),
      workflow_status_catalog_id: normalizeNullableNumber(payload.workflow_status_catalog_id),
      workflow_form_key: normalizeNullableText(payload.workflow_form_key),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SERVICE_GROUP_FAILED'));
  }

  return parseItemJson<SupportServiceGroup>(res);
};

export const updateSupportServiceGroup = async (
  id: string | number,
  payload: Partial<SupportServiceGroup>
): Promise<SupportServiceGroup> => {
  const res = await apiFetch(`/api/v5/support-service-groups/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      customer_id: normalizeNullableNumber(payload.customer_id),
      group_code: normalizeNullableText(payload.group_code),
      group_name: normalizeNullableText(payload.group_name),
      description: normalizeNullableText(payload.description),
      workflow_status_catalog_id: normalizeNullableNumber(payload.workflow_status_catalog_id),
      workflow_form_key: normalizeNullableText(payload.workflow_form_key),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_SERVICE_GROUP_FAILED'));
  }

  return parseItemJson<SupportServiceGroup>(res);
};

export const createSupportServiceGroupsBulk = async (
  items: Array<Partial<SupportServiceGroup>>
): Promise<BulkMutationResult<SupportServiceGroup>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-service-groups/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => ({
        customer_id: normalizeNullableNumber(item.customer_id),
        group_code: normalizeNullableText(item.group_code),
        group_name: item.group_name,
        description: normalizeNullableText(item.description),
        is_active: item.is_active ?? true,
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SERVICE_GROUPS_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportServiceGroup>(res);
};

export const createSupportContactPosition = async (
  payload: Partial<SupportContactPosition>
): Promise<SupportContactPosition> => {
  const res = await apiFetch('/api/v5/support-contact-positions', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      position_code: normalizeNullableText(payload.position_code),
      position_name: normalizeNullableText(payload.position_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active ?? true,
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_CONTACT_POSITION_FAILED'));
  }

  return parseItemJson<SupportContactPosition>(res);
};

export const updateSupportContactPosition = async (
  id: string | number,
  payload: Partial<SupportContactPosition>
): Promise<SupportContactPosition> => {
  const res = await apiFetch(`/api/v5/support-contact-positions/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      position_code: normalizeNullableText(payload.position_code),
      position_name: normalizeNullableText(payload.position_name),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active,
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_CONTACT_POSITION_FAILED'));
  }

  return parseItemJson<SupportContactPosition>(res);
};

export const createSupportContactPositionsBulk = async (
  items: Array<Partial<SupportContactPosition>>
): Promise<BulkMutationResult<SupportContactPosition>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-contact-positions/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => ({
        position_code: normalizeNullableText(item.position_code),
        position_name: normalizeNullableText(item.position_name),
        description: normalizeNullableText(item.description),
        is_active: item.is_active ?? true,
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_CONTACT_POSITIONS_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportContactPosition>(res);
};

export const createSupportRequestStatus = async (
  payload: Partial<SupportRequestStatusOption>
): Promise<SupportRequestStatusOption> => {
  const res = await apiFetch('/api/v5/support-request-statuses', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status_code: normalizeNullableText(payload.status_code),
      status_name: normalizeNullableText(payload.status_name),
      description: normalizeNullableText(payload.description),
      requires_completion_dates:
        payload.requires_completion_dates === undefined ? true : Boolean(payload.requires_completion_dates),
      is_terminal: payload.is_terminal === undefined ? false : Boolean(payload.is_terminal),
      is_transfer_dev: payload.is_transfer_dev === undefined ? false : Boolean(payload.is_transfer_dev),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      sort_order: normalizeNumber(payload.sort_order, 0),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUEST_STATUS_FAILED'));
  }

  return parseItemJson<SupportRequestStatusOption>(res);
};

export const createSupportRequestStatusesBulk = async (
  items: Array<Partial<SupportRequestStatusOption>>
): Promise<BulkMutationResult<SupportRequestStatusOption>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-request-statuses/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item, index) => ({
        status_code: normalizeNullableText(item.status_code),
        status_name: normalizeNullableText(item.status_name),
        description: normalizeNullableText(item.description),
        requires_completion_dates:
          item.requires_completion_dates === undefined ? true : Boolean(item.requires_completion_dates),
        is_terminal: item.is_terminal === undefined ? false : Boolean(item.is_terminal),
        is_transfer_dev: item.is_transfer_dev === undefined ? false : Boolean(item.is_transfer_dev),
        is_active: item.is_active === undefined ? true : Boolean(item.is_active),
        sort_order: normalizeNumber(item.sort_order, index),
        created_by: normalizeNullableNumber(item.created_by),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUEST_STATUSES_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportRequestStatusOption>(res);
};

export const updateSupportRequestStatusDefinition = async (
  id: string | number,
  payload: Partial<SupportRequestStatusOption>
): Promise<SupportRequestStatusOption> => {
  const res = await apiFetch(`/api/v5/support-request-statuses/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status_code: normalizeNullableText(payload.status_code),
      status_name: normalizeNullableText(payload.status_name),
      description: normalizeNullableText(payload.description),
      requires_completion_dates:
        payload.requires_completion_dates === undefined ? undefined : Boolean(payload.requires_completion_dates),
      is_terminal: payload.is_terminal === undefined ? undefined : Boolean(payload.is_terminal),
      is_transfer_dev: payload.is_transfer_dev === undefined ? undefined : Boolean(payload.is_transfer_dev),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_REQUEST_STATUS_DEFINITION_FAILED'));
  }

  return parseItemJson<SupportRequestStatusOption>(res);
};

export const createWorklogActivityType = async (
  payload: Partial<WorklogActivityTypeOption>
): Promise<WorklogActivityTypeOption> => {
  const res = await apiFetch('/api/v5/worklog-activity-types', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      code: normalizeNullableText(payload.code),
      name: normalizeNullableText(payload.name),
      description: normalizeNullableText(payload.description),
      default_is_billable:
        payload.default_is_billable === undefined ? true : Boolean(payload.default_is_billable),
      phase_hint: normalizeNullableText(payload.phase_hint),
      sort_order: payload.sort_order === undefined ? 0 : normalizeNumber(payload.sort_order, 0),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_WORKLOG_ACTIVITY_TYPE_FAILED'));
  }

  return parseItemJson<WorklogActivityTypeOption>(res);
};

export const updateWorklogActivityType = async (
  id: string | number,
  payload: Partial<WorklogActivityTypeOption>
): Promise<WorklogActivityTypeOption> => {
  const res = await apiFetch(`/api/v5/worklog-activity-types/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      code: normalizeNullableText(payload.code),
      name: normalizeNullableText(payload.name),
      description: normalizeNullableText(payload.description),
      default_is_billable:
        payload.default_is_billable === undefined ? undefined : Boolean(payload.default_is_billable),
      phase_hint: normalizeNullableText(payload.phase_hint),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_WORKLOG_ACTIVITY_TYPE_FAILED'));
  }

  return parseItemJson<WorklogActivityTypeOption>(res);
};

export const createSupportSlaConfig = async (
  payload: Partial<SupportSlaConfigOption>
): Promise<SupportSlaConfigOption> => {
  const res = await apiFetch('/api/v5/support-sla-configs', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status: normalizeNullableText(payload.status),
      sub_status: normalizeNullableText(payload.sub_status),
      priority: normalizeNullableText(payload.priority),
      sla_hours: normalizeNumber(payload.sla_hours, 0),
      request_type_prefix: normalizeNullableText(payload.request_type_prefix),
      service_group_id: normalizeNullableNumber(payload.service_group_id),
      workflow_action_code: normalizeNullableText(payload.workflow_action_code),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active === undefined ? true : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? 0 : normalizeNumber(payload.sort_order, 0),
      created_by: normalizeNullableNumber(payload.created_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_SLA_CONFIG_FAILED'));
  }

  return parseItemJson<SupportSlaConfigOption>(res);
};

export const updateSupportSlaConfig = async (
  id: string | number,
  payload: Partial<SupportSlaConfigOption>
): Promise<SupportSlaConfigOption> => {
  const res = await apiFetch(`/api/v5/support-sla-configs/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      status: normalizeNullableText(payload.status),
      sub_status: normalizeNullableText(payload.sub_status),
      priority: normalizeNullableText(payload.priority),
      sla_hours: payload.sla_hours === undefined ? undefined : normalizeNumber(payload.sla_hours, 0),
      request_type_prefix: normalizeNullableText(payload.request_type_prefix),
      service_group_id: payload.service_group_id === undefined ? undefined : normalizeNullableNumber(payload.service_group_id),
      workflow_action_code: payload.workflow_action_code === undefined ? undefined : normalizeNullableText(payload.workflow_action_code),
      description: normalizeNullableText(payload.description),
      is_active: payload.is_active === undefined ? undefined : Boolean(payload.is_active),
      sort_order: payload.sort_order === undefined ? undefined : normalizeNumber(payload.sort_order, 0),
      updated_by: normalizeNullableNumber(payload.updated_by),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_SLA_CONFIG_FAILED'));
  }

  return parseItemJson<SupportSlaConfigOption>(res);
};

export const createOpportunityStage = async (
  payload: Partial<OpportunityStageOption>
): Promise<OpportunityStageOption> => {
  const res = await apiFetch('/api/v5/opportunity-stages', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      stage_code: normalizeNullableText(payload.stage_code),
      stage_name: normalizeNullableText(payload.stage_name),
      description: normalizeNullableText(payload.description),
      is_terminal: typeof payload.is_terminal === 'boolean' ? payload.is_terminal : undefined,
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order: payload.sort_order === null || payload.sort_order === undefined
        ? undefined
        : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_OPPORTUNITY_STAGE_FAILED'));
  }

  return parseItemJson<OpportunityStageOption>(res);
};

export const updateOpportunityStage = async (
  id: string | number,
  payload: Partial<OpportunityStageOption>
): Promise<OpportunityStageOption> => {
  const res = await apiFetch(`/api/v5/opportunity-stages/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      stage_code: normalizeNullableText(payload.stage_code),
      stage_name: normalizeNullableText(payload.stage_name),
      description: normalizeNullableText(payload.description),
      is_terminal: typeof payload.is_terminal === 'boolean' ? payload.is_terminal : undefined,
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order: payload.sort_order === null || payload.sort_order === undefined
        ? undefined
        : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_OPPORTUNITY_STAGE_FAILED'));
  }

  return parseItemJson<OpportunityStageOption>(res);
};

export const createProjectType = async (
  payload: Partial<ProjectTypeOption>
): Promise<ProjectTypeOption> => {
  const res = await apiFetch('/api/v5/project-types', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type_code: normalizeNullableText(payload.type_code),
      type_name: normalizeNullableText(payload.type_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order: payload.sort_order === null || payload.sort_order === undefined
        ? undefined
        : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_TYPE_FAILED'));
  }

  return parseItemJson<ProjectTypeOption>(res);
};

export const updateProjectType = async (
  id: string | number,
  payload: Partial<ProjectTypeOption>
): Promise<ProjectTypeOption> => {
  const res = await apiFetch(`/api/v5/project-types/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type_code: normalizeNullableText(payload.type_code),
      type_name: normalizeNullableText(payload.type_name),
      description: normalizeNullableText(payload.description),
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : undefined,
      sort_order: payload.sort_order === null || payload.sort_order === undefined
        ? undefined
        : normalizeNumber(payload.sort_order, 0),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROJECT_TYPE_FAILED'));
  }

  return parseItemJson<ProjectTypeOption>(res);
};

// ─── Monthly Calendars — Lịch làm việc ────────────────────────────────────

/** Lấy danh sách lịch, lọc theo year và/hoặc month. */
export const fetchMonthlyCalendars = async (
  params: { year?: number; month?: number; include_inactive?: boolean } = {}
): Promise<WorkCalendarDay[]> => {
  const qs = new URLSearchParams();
  if (params.year  !== undefined) qs.set('year',  String(params.year));
  if (params.month !== undefined) qs.set('month', String(params.month));
  if (params.include_inactive)    qs.set('include_inactive', 'true');

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/v5/monthly-calendars${query}`, {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_MONTHLY_CALENDARS_FAILED'));
  }

  const payload = await parseJson<WorkCalendarDay>(res);
  return payload.data ?? [];
};

/** Cập nhật (hoặc tạo) một ngày trong lịch. */
export const updateCalendarDay = async (
  date: string, // "YYYY-MM-DD"
  payload: Partial<Pick<WorkCalendarDay, 'is_working_day' | 'is_holiday' | 'holiday_name' | 'note'>> & {
    updated_by?: number | null;
  }
): Promise<WorkCalendarDay> => {
  const res = await apiFetch(`/api/v5/monthly-calendars/${date}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      is_working_day: typeof payload.is_working_day === 'boolean' ? payload.is_working_day : undefined,
      is_holiday:     typeof payload.is_holiday     === 'boolean' ? payload.is_holiday     : undefined,
      holiday_name:   normalizeNullableText(payload.holiday_name),
      note:           normalizeNullableText(payload.note),
      updated_by:     payload.updated_by ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CALENDAR_DAY_FAILED'));
  }

  return parseItemJson<WorkCalendarDay>(res);
};

/** Tạo hàng loạt lịch cho một năm. */
export const generateCalendarYear = async (
  year: number,
  options: { overwrite?: boolean; created_by?: number | null } = {}
): Promise<{ message: string; year: number; inserted: number; skipped: number }> => {
  const res = await apiFetch('/api/v5/monthly-calendars/generate', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      year,
      overwrite:   options.overwrite  ?? false,
      created_by:  options.created_by ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CALENDAR_YEAR_FAILED'));
  }

  return res.json();
};

// ─── Department Weekly Schedules — Lịch làm việc đơn vị ────────────────────

export const fetchDepartmentWeeklySchedules = async (
  params: { department_id?: string | number | null; week_start_date?: string | null } = {}
): Promise<DepartmentWeeklySchedule[]> => {
  const qs = new URLSearchParams();
  if (params.department_id !== undefined && params.department_id !== null && String(params.department_id).trim() !== '') {
    qs.set('department_id', String(params.department_id));
  }
  if (params.week_start_date) {
    qs.set('week_start_date', params.week_start_date);
  }

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/v5/department-weekly-schedules${query}`, {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEPARTMENT_WEEKLY_SCHEDULES_FAILED'));
  }

  const payload = await parseJson<DepartmentWeeklySchedule>(res);
  return payload.data ?? [];
};

export const fetchDepartmentWeeklySchedule = async (id: string | number): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const createDepartmentWeeklySchedule = async (
  payload: DepartmentWeeklySchedule & { created_by?: string | number | null }
): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch('/api/v5/department-weekly-schedules', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const updateDepartmentWeeklySchedule = async (
  id: string | number,
  payload: DepartmentWeeklySchedule & { updated_by?: string | number | null }
): Promise<DepartmentWeeklySchedule> => {
  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }

  return parseItemJson<DepartmentWeeklySchedule>(res);
};

export const deleteDepartmentWeeklySchedule = async (
  id: string | number,
  actorId?: string | number | null
): Promise<void> => {
  const body =
    actorId !== undefined && actorId !== null && String(actorId).trim() !== ''
      ? JSON.stringify({ actor_id: actorId })
      : undefined;

  const res = await apiFetch(`/api/v5/department-weekly-schedules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? JSON_HEADERS : JSON_ACCEPT_HEADER,
    body,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_WEEKLY_SCHEDULE_FAILED'));
  }
};

export const deleteDepartmentWeeklyScheduleEntry = async (
  scheduleId: string | number,
  entryId: string | number,
  actorId?: string | number | null
): Promise<void> => {
  const body =
    actorId !== undefined && actorId !== null && String(actorId).trim() !== ''
      ? JSON.stringify({ actor_id: actorId })
      : undefined;

  const res = await apiFetch(`/api/v5/department-weekly-schedules/${scheduleId}/entries/${entryId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? JSON_HEADERS : JSON_ACCEPT_HEADER,
    body,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_WEEKLY_SCHEDULE_ENTRY_FAILED'));
  }
};

// ─── Yêu cầu mới theo mô hình yeu_cau + tt_* ───────────────────────────────

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
  query: PaginatedQuery & { process_code?: string | null }
): Promise<PaginatedResult<YeuCau>> => {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
  params.set('simple', '1');
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  if (query.sort_by && query.sort_by.trim()) params.set('sort_by', query.sort_by.trim());
  if (query.sort_dir) params.set('sort_dir', query.sort_dir);
  if (query.process_code && query.process_code.trim()) {
    params.set('process_code', query.process_code.trim());
  }

  const suffix = params.toString();
  const res = await apiFetch(`/api/v5/customer-request-cases${suffix ? `?${suffix}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'page:/api/v5/customer-request-cases',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_/API/V5/YEU-CAU_FAILED'));
  }

  return parsePaginatedJson<YeuCau>(res);
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

export const createYeuCau = async (
  payload: Record<string, unknown>
): Promise<YeuCau> => {
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

  return parseItemJson<YeuCauProcessDetail>(res);
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

// Chuyển trạng thái yêu cầu — POST /api/v5/customer-request-cases/{id}/transition
// Backend tự động: validate transition, tạo status_instance, insert vào bảng detail
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

export const buildDepartmentWeekOptions = (calendarDays: WorkCalendarDay[]): DepartmentWeekOption[] => {
  const weekStarts = (calendarDays || [])
    .filter((day) => Number(day.day_of_week) === 2)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));

  const options = weekStarts.map((day) => {
    const start = new Date(`${day.date}T00:00:00`);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 6);
    const endDate = end.toISOString().slice(0, 10);

    return {
      week_start_date: day.date,
      week_end_date: endDate,
      week_number: Number(day.week_number ?? 0),
      year: Number(day.year ?? start.getFullYear()),
      label: `Tuần ${String(day.week_number ?? '').padStart(2, '0')}-${day.year} (${String(day.day).padStart(2, '0')}/${String(day.month).padStart(2, '0')} - ${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')})`,
    };
  });

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentAndFuture = options
    .filter((option) => option.week_end_date >= todayKey)
    .sort((left, right) => left.week_start_date.localeCompare(right.week_start_date));
  const past = options
    .filter((option) => option.week_end_date < todayKey)
    .sort((left, right) => right.week_start_date.localeCompare(left.week_start_date));

  return [...currentAndFuture, ...past];
};

export const fetchRoles = async (): Promise<Role[]> => {
  const res = await apiFetch('/api/v5/roles', {
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_ROLES_FAILED'));
  }
  const payload = await parseJson<Role>(res);
  return payload.data ?? [];
};

export const fetchPermissions = async (): Promise<Permission[]> => {
  const res = await apiFetch('/api/v5/permissions', {
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PERMISSIONS_FAILED'));
  }
  const payload = await parseJson<Permission>(res);
  return payload.data ?? [];
};

export const fetchUserAccess = async (search?: string): Promise<UserAccessRecord[]> => {
  const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const res = await apiFetch(`/api/v5/user-access${query}`, {
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_USER_ACCESS_FAILED'));
  }
  const payload = await parseJson<UserAccessRecord>(res);
  return payload.data ?? [];
};

export const updateUserAccessRoles = async (
  userId: string | number,
  roleIds: number[]
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/roles`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ role_ids: roleIds }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_ROLES_FAILED'));
  }
  return parseItemJson<UserAccessRecord>(res);
};

export const updateUserAccessPermissions = async (
  userId: string | number,
  overrides: Array<{
    permission_id: number;
    type: 'GRANT' | 'DENY';
    reason?: string | null;
    expires_at?: string | null;
  }>
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/permissions`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ overrides }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_PERMISSIONS_FAILED'));
  }
  return parseItemJson<UserAccessRecord>(res);
};

export const updateUserAccessDeptScopes = async (
  userId: string | number,
  scopes: Array<{
    dept_id: number;
    scope_type: 'SELF_ONLY' | 'DEPT_ONLY' | 'DEPT_AND_CHILDREN' | 'ALL';
  }>
): Promise<UserAccessRecord> => {
  const res = await apiFetch(`/api/v5/user-access/${userId}/dept-scopes`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ scopes }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_USER_ACCESS_SCOPES_FAILED'));
  }
  return parseItemJson<UserAccessRecord>(res);
};

// ── Feedback (Góp ý người dùng) ──────────────────────────────────────────────

export const fetchFeedbacks = async (): Promise<FeedbackRequest[]> =>
  fetchList<FeedbackRequest>('/api/v5/feedback-requests');

export const fetchFeedbacksPage = async (
  query: PaginatedQuery & { filters?: { q?: string; status?: string; priority?: string } }
): Promise<PaginatedResult<FeedbackRequest>> =>
  fetchPaginatedList<FeedbackRequest>('/api/v5/feedback-requests', query);

export const fetchFeedbackDetail = async (id: string | number): Promise<FeedbackRequest> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_FEEDBACK_DETAIL_FAILED'));
  }
  return parseItemJson<FeedbackRequest>(res);
};

export const createFeedback = async (payload: {
  title: string;
  description?: string | null;
  priority?: string;
}): Promise<FeedbackRequest> => {
  const res = await apiFetch('/api/v5/feedback-requests', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_FEEDBACK_FAILED'));
  }
  return parseItemJson<FeedbackRequest>(res);
};

export const updateFeedback = async (
  id: string | number,
  payload: {
    title?: string;
    description?: string | null;
    priority?: string;
    status?: string;
  }
): Promise<FeedbackRequest> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_FEEDBACK_FAILED'));
  }
  return parseItemJson<FeedbackRequest>(res);
};

export const deleteFeedback = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_FAILED'));
  }
};

export const createFeedbackResponse = async (
  feedbackId: string | number,
  payload: { content: string; is_admin_response?: boolean }
): Promise<FeedbackResponse> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${feedbackId}/responses`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_FEEDBACK_RESPONSE_FAILED'));
  }
  return parseItemJson<FeedbackResponse>(res);
};

export const deleteFeedbackResponse = async (
  feedbackId: string | number,
  responseId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/feedback-requests/${feedbackId}/responses/${responseId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_FEEDBACK_RESPONSE_FAILED'));
  }
};
