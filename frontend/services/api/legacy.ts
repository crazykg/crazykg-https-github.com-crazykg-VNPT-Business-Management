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
  ContractRevenueAnalytics,
  CustomerRequestChangeLogEntry,
  CustomerRequest,
  CustomerRequestDashboardSummaryPayload,
  CustomerRequestReferenceSearchItem,
  CustomerRequestImportRowResult,
  Customer,
  CustomerInsight,
  CustomerPersonnel,
  Department,
  YeuCau,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
  YeuCauWorklog,
  Document,
  Employee,
  EmployeeProvisioning,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
  Permission,
  Product,
  ProductFeatureCatalog,
  ProductFeatureCatalogListPage,
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
  FeedbackRequest,
  FeedbackResponse,
  YeuCauDashboardPayload,
  YeuCauPerformerWeeklyTimesheet,
  YeuCauSearchItem,
  CodingPhase,
  DmsPhase,
  CustomerRequestPlan,
  CustomerRequestPlanItem,
  CRCFullDetail,
  MonthlyHoursRow,
  PainPointsData,
  CustomerRequestEscalation,
  LeadershipDirective,
  RevenueOverviewResponse,
  RevenueTarget,
  RevenueTargetBulkInput,
  RevenueSuggestion,
  RevenueSuggestionResponse,
  ProjectRevenueSchedule,
  Invoice,
  InvoiceItem,
  Receipt,
  DunningLog,
  FeeCollectionDashboard,
  DebtAgingReport,
  DebtTrendPoint,
  DebtAgingRow,
  RevenueByContractResponse,
  RevenueContractSchedule,
  RevenueForecastData,
  RevenueReportData,
  UpsellProductDetail,
} from '../../types';
import { parseApiError } from '../../shared/api/apiFetch';
export * from './businessVendorApi';
export * from './contractApi';
export * from './departmentApi';
export * from './documentApi';
export * from './employeeApi';
export * from './customerApi';
export * from './productApi';
export * from './projectApi';
export * from './supportConfigApi';
export * from './customerRequestApi';
export * from './adminApi';
export * from './revenueApi';
export * from './feeCollectionApi';

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
const AUTH_REFRESH_TIMEOUT_MS = 5000;
const API_REQUEST_CANCELLED_MESSAGE = '__REQUEST_CANCELLED__';
const TAB_EVICTED_ERROR_CODE = 'TAB_EVICTED';
const TAB_EVICTED_ERROR_MESSAGE = 'Phiên làm việc đã được mở trên tab khác. Vui lòng đăng nhập lại.';
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
  timeoutMs?: number;
  timeoutMessage?: string;
};

export const isRequestCanceledError = (error: unknown): boolean =>
  error instanceof Error && error.message === API_REQUEST_CANCELLED_MESSAGE;

export const isTabEvictedMessage = (message: unknown): boolean => {
  const normalized = String(message ?? '').trim().toUpperCase();

  return normalized === TAB_EVICTED_ERROR_CODE
    || String(message ?? '').trim() === TAB_EVICTED_ERROR_MESSAGE;
};

export const isTabEvictedError = (error: unknown): boolean =>
  error instanceof Error && isTabEvictedMessage(error.message);

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
  const {
    cancelKey,
    signal: externalSignal,
    skipAuthRefresh = false,
    timeoutMs,
    timeoutMessage,
    ...requestInit
  } = init;
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

  const requestTimeoutMs = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : API_REQUEST_TIMEOUT_MS;
  const requestTimeoutMessage = String(timeoutMessage || '').trim() || 'Không thể kết nối máy chủ (quá thời gian phản hồi). Vui lòng thử lại.';

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
  }, requestTimeoutMs);

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
        const body = await cloned.json() as { code?: string; error?: { code?: string } };
        const errorCode = typeof body?.error?.code === 'string' ? body.error.code : body?.code;
        if (errorCode === TAB_EVICTED_ERROR_CODE) {
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
        throw new Error(requestTimeoutMessage);
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
    const abortController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      abortController.abort();
    }, AUTH_REFRESH_TIMEOUT_MS);

    try {
      const response = await globalThis.fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: JSON_ACCEPT_HEADER,
        signal: abortController.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      globalThis.clearTimeout(timeoutId);
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
  const totalCustomers = Number(kpisRaw?.total_customers);
  const healthcareCustomers = Number(kpisRaw?.healthcare_customers);
  const governmentCustomers = Number(kpisRaw?.government_customers);
  const individualCustomers = Number(kpisRaw?.individual_customers);
  const healthcareBreakdownRaw = (
    kpisRaw
    && typeof kpisRaw === 'object'
    && kpisRaw.healthcare_breakdown
    && typeof kpisRaw.healthcare_breakdown === 'object'
  )
    ? kpisRaw.healthcare_breakdown as Record<string, unknown>
    : undefined;
  const publicHospitalCustomers = Number(healthcareBreakdownRaw?.public_hospital);
  const privateHospitalCustomers = Number(healthcareBreakdownRaw?.private_hospital);
  const medicalCenterCustomers = Number(healthcareBreakdownRaw?.medical_center);
  const privateClinicCustomers = Number(healthcareBreakdownRaw?.private_clinic);
  const tytPkdkCustomers = Number(healthcareBreakdownRaw?.tyt_pkdk);
  const otherHealthcareCustomers = Number(healthcareBreakdownRaw?.other);

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
      total_customers:
        Number.isFinite(totalCustomers) && totalCustomers >= 0
          ? Math.floor(totalCustomers)
          : undefined,
      healthcare_customers:
        Number.isFinite(healthcareCustomers) && healthcareCustomers >= 0
          ? Math.floor(healthcareCustomers)
          : undefined,
      government_customers:
        Number.isFinite(governmentCustomers) && governmentCustomers >= 0
          ? Math.floor(governmentCustomers)
          : undefined,
      individual_customers:
        Number.isFinite(individualCustomers) && individualCustomers >= 0
          ? Math.floor(individualCustomers)
          : undefined,
      healthcare_breakdown: healthcareBreakdownRaw
        ? {
            public_hospital:
              Number.isFinite(publicHospitalCustomers) && publicHospitalCustomers >= 0
                ? Math.floor(publicHospitalCustomers)
                : 0,
            private_hospital:
              Number.isFinite(privateHospitalCustomers) && privateHospitalCustomers >= 0
                ? Math.floor(privateHospitalCustomers)
                : 0,
            medical_center:
              Number.isFinite(medicalCenterCustomers) && medicalCenterCustomers >= 0
                ? Math.floor(medicalCenterCustomers)
                : 0,
            private_clinic:
              Number.isFinite(privateClinicCustomers) && privateClinicCustomers >= 0
                ? Math.floor(privateClinicCustomers)
                : 0,
            tyt_pkdk:
              Number.isFinite(tytPkdkCustomers) && tytPkdkCustomers >= 0
                ? Math.floor(tytPkdkCustomers)
                : 0,
            other:
              Number.isFinite(otherHealthcareCustomers) && otherHealthcareCustomers >= 0
                ? Math.floor(otherHealthcareCustomers)
                : 0,
          }
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
  const useSimplePagination = query.simple !== undefined ? Boolean(query.simple) : true;

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.per_page !== undefined) params.set('per_page', String(query.per_page));
  params.set('simple', useSimplePagination ? '1' : '0');
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

  const payload: Record<string, unknown> = {
    simple: query.simple !== undefined ? (query.simple ? 1 : 0) : 1,
  };
  if (query.page !== undefined) payload.page = query.page;
  if (query.per_page !== undefined) payload.per_page = query.per_page;
  if (query.q && query.q.trim()) payload.q = query.q.trim();
  if (query.sort_by && query.sort_by.trim()) payload.sort_by = query.sort_by.trim();
  if (query.sort_dir) payload.sort_dir = query.sort_dir;

  if (query.filters) {
    const filters: Record<string, string | number | boolean | Array<string | number>> = {};
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
  party_card_number: 'Số thẻ Đảng',
  ethnicity: 'Dân tộc',
  religion: 'Tôn giáo',
  hometown: 'Quê quán',
  professional_qualification: 'Trình độ chuyên môn',
  political_theory_level: 'LLCT',
  service_group: 'Nhóm dịch vụ',
  package_name: 'Gói cước',
  customer_code: 'Mã khách hàng',
  customer_name: 'Tên khách hàng',
  vendor_code: 'Mã đối tác',
  vendor_name: 'Tên đối tác',
  project_code: 'Mã dự án',
  project_name: 'Tên dự án',
  contract_code: 'Mã hợp đồng',
  contract_name: 'Tên hợp đồng',
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
  { pattern: /party[\s_]?card[\s_]?number/i, label: 'Số thẻ Đảng' },
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
    const payload = await parseApiError(res);
    const firstValidationError = getFirstValidationError(payload.errors);
    if (firstValidationError) {
      return localizeValidationMessage(firstValidationError.field, firstValidationError.message);
    }

    if (typeof payload.code === 'string' && isTabEvictedMessage(payload.code)) {
      return TAB_EVICTED_ERROR_MESSAGE;
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return localizeServerMessage(payload.message);
    }

    if (typeof payload.code === 'string' && payload.code.trim() && payload.code !== 'UNKNOWN') {
      return payload.code.trim();
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

const normalizeLegacyYeuCauProcessDetail = (value: unknown): YeuCauProcessDetail => {
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

  return {
    ...(raw as unknown as YeuCauProcessDetail),
    yeu_cau: nestedRequest as unknown as YeuCau,
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
      ) ??
      {
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

export const updateCurrentUserAvatar = async (file: File): Promise<AuthUser> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await apiFetch('/api/v5/auth/avatar', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CURRENT_USER_AVATAR_FAILED'));
  }

  return parseItemJson<AuthUser>(res);
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

const normalizeUserDeptHistoryRecord = (payload: Record<string, unknown>): UserDeptHistory => ({
  id: String(payload.id ?? ''),
  userId: String(payload.userId ?? ''),
  fromDeptId: String(payload.fromDeptId ?? ''),
  toDeptId: String(payload.toDeptId ?? ''),
  transferDate: String(payload.transferDate ?? ''),
  reason: String(payload.reason ?? ''),
  createdDate: normalizeNullableText(payload.createdDate) ?? undefined,
  decisionNumber: normalizeNullableText(payload.decisionNumber) ?? undefined,
  transferType: normalizeNullableText(payload.transferType) === 'BIET_PHAI' ? 'BIET_PHAI' : 'LUAN_CHUYEN',
  employeeCode: normalizeNullableText(payload.employeeCode ?? payload.userCode) ?? undefined,
  employeeName: normalizeNullableText(payload.employeeName ?? payload.userName) ?? undefined,
  fromDeptCode: normalizeNullableText(payload.fromDeptCode),
  fromDeptName: normalizeNullableText(payload.fromDeptName),
  toDeptCode: normalizeNullableText(payload.toDeptCode),
  toDeptName: normalizeNullableText(payload.toDeptName),
});

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

export const fetchWorkflowStatusCatalogs = async (includeInactive = false): Promise<WorkflowStatusCatalog[]> => {
  void includeInactive;
  return [];
};
export const fetchWorkflowStatusTransitions = async (
  fromStatusCatalogId?: string | number | null,
  includeInactive = false
): Promise<WorkflowStatusTransition[]> => {
  void fromStatusCatalogId;
  void includeInactive;
  return [];
};
export const fetchWorkflowFormFieldConfigs = async (
  statusCatalogId?: string | number | null,
  includeInactive = false
): Promise<WorkflowFormFieldConfig[]> => {
  void statusCatalogId;
  void includeInactive;
  return [];
};

const raiseLegacyWorkflowConfigError = (): never => {
  throw new Error('Cấu hình workflow cũ đã chuyển sang màn Quản lý Luồng công việc.');
};

export const createWorkflowStatusCatalog = async (
  payload: Partial<WorkflowStatusCatalog>
): Promise<WorkflowStatusCatalog> => {
  void payload;
  return raiseLegacyWorkflowConfigError();
};
export const updateWorkflowStatusCatalog = async (
  id: string | number,
  payload: Partial<WorkflowStatusCatalog>
): Promise<WorkflowStatusCatalog> => {
  void id;
  void payload;
  return raiseLegacyWorkflowConfigError();
};
export const createWorkflowStatusTransition = async (
  payload: Partial<WorkflowStatusTransition>
): Promise<WorkflowStatusTransition> => {
  void payload;
  return raiseLegacyWorkflowConfigError();
};
export const updateWorkflowStatusTransition = async (
  id: string | number,
  payload: Partial<WorkflowStatusTransition>
): Promise<WorkflowStatusTransition> => {
  void id;
  void payload;
  return raiseLegacyWorkflowConfigError();
};
export const createWorkflowFormFieldConfig = async (
  payload: Partial<WorkflowFormFieldConfig>
): Promise<WorkflowFormFieldConfig> => {
  void payload;
  return raiseLegacyWorkflowConfigError();
};
export const updateWorkflowFormFieldConfig = async (
  id: string | number,
  payload: Partial<WorkflowFormFieldConfig>
): Promise<WorkflowFormFieldConfig> => {
  void id;
  void payload;
  return raiseLegacyWorkflowConfigError();
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
  const documents = documentsRes.status === 'fulfilled' ? await parseJson<Document>(documentsRes.value) : { data: [] };
  const reminders = remindersRes.status === 'fulfilled' ? await parseJson<Reminder>(remindersRes.value) : { data: [] };
  const userDeptHistory = userDeptHistoryRes.status === 'fulfilled' ? await parseJson<Record<string, unknown>>(userDeptHistoryRes.value) : { data: [] };
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
    documents: documents.data ?? [],
    reminders: reminders.data ?? [],
    userDeptHistory: (userDeptHistory.data ?? []).map((item) => normalizeUserDeptHistoryRecord(item)),
    auditLogs: auditLogs.data ?? [],
    supportServiceGroups: supportServiceGroups.data ?? [],
    supportContactPositions: supportContactPositions.data ?? [],
    supportRequestStatuses: supportRequestStatuses.data ?? [],
    roles: roles.data ?? [],
    permissions: permissions.data ?? [],
    userAccess: userAccess.data ?? [],
  };
};
