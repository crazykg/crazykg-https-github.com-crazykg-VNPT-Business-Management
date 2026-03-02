import {
  AuthLoginPayload,
  AuthLoginResult,
  AuthUser,
  Attachment,
  AuditLog,
  BulkMutationItemResult,
  BulkMutationResult,
  Business,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document,
  Employee,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  Opportunity,
  OpportunityStageOption,
  PaymentCycle,
  PaymentSchedule,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
  Permission,
  Product,
  ProjectItemMaster,
  ProjectRaciRow,
  Project,
  Reminder,
  Role,
  IProgrammingRequest,
  IProgrammingRequestForm,
  SupportRequest,
  SupportRequestReceiverResult,
  SupportRequestHistory,
  SupportRequestTaskStatus,
  SupportRequestStatusOption,
  SupportServiceGroup,
  IWorklog,
  ProgrammingRequestFilters,
  ProgrammingRequestReferenceMatch,
  WorklogPhaseSummary,
  UserAccessRecord,
  UserDeptHistory,
  Vendor
} from '../types';
import { normalizeEmployeeCode } from '../utils/employeeDisplay';

type ApiListResponse<T> = {
  data?: T[];
  meta?: Partial<PaginationMeta>;
};

type ApiItemResponse<T> = {
  data?: T;
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
const inFlightRequestControllers = new Map<string, AbortController>();

type ApiFetchInit = RequestInit & {
  cancelKey?: string;
};

export const isRequestCanceledError = (error: unknown): boolean =>
  error instanceof Error && error.message === API_REQUEST_CANCELLED_MESSAGE;

const apiFetch = async (input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> => {
  const { cancelKey, signal: externalSignal, ...requestInit } = init;
  const headers = new Headers(requestInit.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
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

  try {

    return await globalThis.fetch(input, {
      ...requestInit,
      credentials: 'include',
      headers,
      signal: abortController.signal,
    });
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

const buildSupportRequestsQueryString = (query?: PaginatedQuery): string => {
  const baseQuery = buildPaginatedQueryString(query);
  const params = new URLSearchParams(baseQuery.startsWith('?') ? baseQuery.slice(1) : baseQuery);
  if (!query) {
    return params.toString() ? `?${params.toString()}` : '';
  }

  const supportQuery = query as PaginatedQuery & {
    status?: string;
    priority?: string;
    group?: string;
    assignee?: string;
    customer?: string;
    from?: string;
    to?: string;
    sort?: string;
  };
  const filters = query.filters || {};

  const getFilterValue = (key: string): string => {
    const value = filters[key];
    return value === undefined || value === null ? '' : String(value).trim();
  };

  const status = String(supportQuery.status || getFilterValue('status')).trim();
  const priority = String(supportQuery.priority || getFilterValue('priority')).trim();
  const group = String(supportQuery.group || getFilterValue('service_group_id')).trim();
  const assignee = String(supportQuery.assignee || getFilterValue('assignee_id')).trim();
  const customer = String(supportQuery.customer || getFilterValue('customer_id')).trim();
  const from = String(supportQuery.from || getFilterValue('requested_from')).trim();
  const to = String(supportQuery.to || getFilterValue('requested_to')).trim();
  const sort = String(
    supportQuery.sort
    || (query.sort_by ? `${query.sort_by}:${query.sort_dir || 'desc'}` : '')
  ).trim();

  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (group) params.set('group', group);
  if (assignee) params.set('assignee', assignee);
  if (customer) params.set('customer', customer);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (sort) params.set('sort', sort);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
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

  const parsed = (await res.json()) as ApiItemResponse<AuthLoginResult>;
  const result = parsed?.data;

  if (!result?.user) {
    throw new Error('Phản hồi đăng nhập không hợp lệ.');
  }

  return result;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const res = await apiFetch('/api/v5/auth/me', {
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_AUTH_ME_FAILED'));
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

const buildSupportRequestRequestPayload = (payload: Partial<SupportRequest>) => ({
  reference_ticket_code: normalizeNullableText(payload.reference_ticket_code),
  reference_request_id: normalizeNullableNumber(payload.reference_request_id),
  summary: payload.summary,
  service_group_id: normalizeNullableNumber(payload.service_group_id),
  project_item_id: normalizeNullableNumber(payload.project_item_id),
  customer_id: normalizeNullableNumber(payload.customer_id),
  project_id: normalizeNullableNumber(payload.project_id),
  product_id: normalizeNullableNumber(payload.product_id),
  reporter_name: normalizeNullableText(payload.reporter_name),
  reporter_contact_id: normalizeNullableNumber(payload.reporter_contact_id),
  assignee_id: normalizeNullableNumber(payload.assignee_id),
  receiver_user_id: normalizeNullableNumber(payload.receiver_user_id),
  status: payload.status || 'NEW',
  priority: payload.priority || 'MEDIUM',
  requested_date: payload.requested_date,
  due_date: normalizeNullableText(payload.due_date),
  resolved_date: normalizeNullableText(payload.resolved_date),
  hotfix_date: normalizeNullableText(payload.hotfix_date),
  noti_date: normalizeNullableText(payload.noti_date),
  tasks: Array.isArray(payload.tasks)
    ? payload.tasks.map((task, index) => ({
      task_code: normalizeNullableText(task?.task_code),
      task_link: normalizeNullableText(task?.task_link),
      status: normalizeSupportRequestTaskStatus(task?.status),
      sort_order: normalizeNumber(task?.sort_order, index),
    }))
    : undefined,
  notes: normalizeNullableText(payload.notes),
  created_by: normalizeNullableNumber(payload.created_by),
});

const buildProgrammingRequestRequestPayload = (payload: Partial<IProgrammingRequestForm | IProgrammingRequest>) => ({
  req_code: normalizeNullableText(payload.req_code),
  req_name: normalizeNullableText(payload.req_name),
  ticket_code: normalizeNullableText(payload.ticket_code),
  task_link: normalizeNullableText(payload.task_link),
  parent_id: normalizeNullableNumber(payload.parent_id),
  depth: normalizeNumber(payload.depth, 0),
  reference_request_id: normalizeNullableNumber(payload.reference_request_id),
  source_type: normalizeNullableText(payload.source_type) ?? 'DIRECT',
  req_type: normalizeNullableText(payload.req_type) ?? 'FEATURE',
  service_group_id: normalizeNullableNumber(payload.service_group_id),
  support_request_id: normalizeNullableNumber(payload.support_request_id),
  priority: normalizeNullableNumber(payload.priority),
  overall_progress: normalizeNullableNumber(payload.overall_progress),
  status: normalizeNullableText(payload.status) ?? 'NEW',
  description: normalizeNullableText(payload.description),
  doc_link: normalizeNullableText(payload.doc_link),
  customer_id: normalizeNullableNumber(payload.customer_id),
  requested_date: normalizeNullableText(payload.requested_date),
  reporter_name: normalizeNullableText(payload.reporter_name),
  reporter_contact_id: normalizeNullableNumber(payload.reporter_contact_id),
  receiver_id: normalizeNullableNumber(payload.receiver_id),
  project_id: normalizeNullableNumber(payload.project_id),
  product_id: normalizeNullableNumber(payload.product_id),
  project_item_id: normalizeNullableNumber(payload.project_item_id),
  analyze_estimated_hours: normalizeNullableNumber(payload.analyze_estimated_hours),
  analyze_start_date: normalizeNullableText(payload.analyze_start_date),
  analyze_end_date: normalizeNullableText(payload.analyze_end_date),
  analyze_extend_date: normalizeNullableText(payload.analyze_extend_date),
  analyzer_id: normalizeNullableNumber(payload.analyzer_id),
  analyze_progress: normalizeNullableNumber(payload.analyze_progress),
  code_estimated_hours: normalizeNullableNumber(payload.code_estimated_hours),
  code_start_date: normalizeNullableText(payload.code_start_date),
  code_end_date: normalizeNullableText(payload.code_end_date),
  code_extend_date: normalizeNullableText(payload.code_extend_date),
  code_actual_date: normalizeNullableText(payload.code_actual_date),
  coder_id: normalizeNullableNumber(payload.coder_id),
  code_progress: normalizeNullableNumber(payload.code_progress),
  upcode_status: normalizeNullableText(payload.upcode_status),
  upcode_date: normalizeNullableText(payload.upcode_date),
  upcoder_id: normalizeNullableNumber(payload.upcoder_id),
  noti_status: normalizeNullableText(payload.noti_status),
  noti_date: normalizeNullableText(payload.noti_date),
  notifier_id: normalizeNullableNumber(payload.notifier_id),
  notified_internal_id: normalizeNullableNumber(payload.notified_internal_id),
  notified_customer_id: normalizeNullableNumber(payload.notified_customer_id),
  noti_doc_link: normalizeNullableText(payload.noti_doc_link),
});

const buildProgrammingRequestWorklogPayload = (payload: Partial<IWorklog>) => ({
  phase: normalizeNullableText(payload.phase) ?? 'OTHER',
  content: normalizeNullableText(payload.content),
  logged_date: normalizeNullableText(payload.logged_date),
  hours_estimated: normalizeNullableNumber(payload.hours_estimated),
  hours_spent: normalizeNullableNumber(payload.hours_spent),
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

export const fetchDepartments = async (): Promise<Department[]> => fetchList<Department>('/api/v5/departments');
export const fetchEmployees = async (): Promise<Employee[]> => fetchList<Employee>(INTERNAL_USERS_ENDPOINT);
export const fetchEmployeesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Employee>> =>
  fetchPaginatedList<Employee>(INTERNAL_USERS_ENDPOINT, query);
export const fetchBusinesses = async (): Promise<Business[]> => fetchList<Business>('/api/v5/businesses');
export const fetchProducts = async (): Promise<Product[]> => fetchList<Product>('/api/v5/products');
export const fetchCustomers = async (): Promise<Customer[]> => fetchList<Customer>('/api/v5/customers');
export const fetchCustomersPage = async (query: PaginatedQuery): Promise<PaginatedResult<Customer>> =>
  fetchPaginatedList<Customer>('/api/v5/customers', query);
export const fetchCustomerPersonnel = async (customerId?: number | null): Promise<CustomerPersonnel[]> => {
  const query = Number.isFinite(Number(customerId)) ? `?customer_id=${Number(customerId)}` : '';
  return fetchList<CustomerPersonnel>(`/api/v5/customer-personnel${query}`);
};
export const fetchVendors = async (): Promise<Vendor[]> => fetchList<Vendor>('/api/v5/vendors');
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
export const fetchContracts = async (): Promise<Contract[]> => fetchList<Contract>('/api/v5/contracts');
export const fetchContractsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Contract>> =>
  fetchPaginatedList<Contract>('/api/v5/contracts', query);
export const fetchOpportunities = async (): Promise<Opportunity[]> => fetchList<Opportunity>('/api/v5/opportunities');
export const fetchDocuments = async (): Promise<Document[]> => fetchList<Document>('/api/v5/documents');
export const fetchDocumentsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Document>> =>
  fetchPaginatedList<Document>('/api/v5/documents', query);
export const fetchReminders = async (): Promise<Reminder[]> => fetchList<Reminder>('/api/v5/reminders');
export const fetchUserDeptHistory = async (): Promise<UserDeptHistory[]> =>
  fetchList<UserDeptHistory>('/api/v5/user-dept-history');
export const fetchAuditLogs = async (): Promise<AuditLog[]> => fetchList<AuditLog>('/api/v5/audit-logs');
export const fetchAuditLogsPage = async (query: PaginatedQuery): Promise<PaginatedResult<AuditLog>> =>
  fetchPaginatedList<AuditLog>('/api/v5/audit-logs', query);
export const fetchSupportServiceGroups = async (includeInactive = false): Promise<SupportServiceGroup[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportServiceGroup>(`/api/v5/support-service-groups${query}`);
};
export const fetchSupportRequestStatuses = async (includeInactive = false): Promise<SupportRequestStatusOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<SupportRequestStatusOption>(`/api/v5/support-request-statuses${query}`);
};
export const fetchOpportunityStages = async (includeInactive = false): Promise<OpportunityStageOption[]> => {
  const query = includeInactive ? '?include_inactive=1' : '';
  return fetchList<OpportunityStageOption>(`/api/v5/opportunity-stages${query}`);
};
export const fetchSupportRequestsPage = async (query: PaginatedQuery): Promise<PaginatedResult<SupportRequest>> =>
  fetchPaginatedList<SupportRequest>('/api/v5/support-requests', query, buildSupportRequestsQueryString);
export const fetchSupportRequestReferenceMatches = async (params?: {
  q?: string;
  exclude_id?: string | number | null;
  limit?: number;
}): Promise<SupportRequest[]> => {
  const search = new URLSearchParams();
  const keyword = String(params?.q || '').trim();
  if (keyword !== '') {
    search.set('q', keyword);
  }
  if (params?.exclude_id !== undefined && params?.exclude_id !== null && `${params.exclude_id}`.trim() !== '') {
    search.set('exclude_id', String(params.exclude_id));
  }
  if (params?.limit !== undefined) {
    const limit = Math.max(1, Math.min(50, Math.floor(Number(params.limit))));
    if (Number.isFinite(limit)) {
      search.set('limit', String(limit));
    }
  }

  const suffix = search.toString();
  const res = await apiFetch(`/api/v5/support-requests/reference-search${suffix ? `?${suffix}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'support:reference-search',
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_SUPPORT_REQUEST_REFERENCE_MATCHES_FAILED'));
  }

  const payload = await parseJson<SupportRequest>(res);
  return payload.data ?? [];
};

export const exportSupportRequestsCsv = async (query?: PaginatedQuery): Promise<DownloadFileResult> => {
  const suffix = buildSupportRequestsQueryString(query);
  const path = suffix
    ? `/api/v5/support-requests/export${suffix}&format=csv`
    : '/api/v5/support-requests/export?format=csv';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
    cancelKey: 'support:export',
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_SUPPORT_REQUESTS_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, `support_requests_${new Date().toISOString().slice(0, 10)}.csv`),
  };
};
export const fetchProgrammingRequestsPage = async (
  query: ProgrammingRequestFilters
): Promise<PaginatedResult<IProgrammingRequest>> => {
  const statusFilter = Array.isArray(query.status) && query.status.length > 0
    ? query.status.join(',')
    : '';

  const paginatedQuery: PaginatedQuery = {
    page: query.page,
    per_page: query.per_page,
    q: query.q,
    sort_by: query.sort_by,
    sort_dir: query.sort_dir,
    filters: {
      status: statusFilter,
      req_type: query.req_type || '',
      coder_id: query.coder_id ?? '',
      customer_id: query.customer_id ?? '',
      project_id: query.project_id ?? '',
      requested_date_from: query.requested_date_from || '',
      requested_date_to: query.requested_date_to || '',
    },
  };

  return fetchPaginatedList<IProgrammingRequest>('/api/v5/programming-requests', paginatedQuery);
};

export const fetchProgrammingRequestReferenceMatches = async (params?: {
  q?: string;
  exclude_id?: string | number | null;
  limit?: number;
}): Promise<ProgrammingRequestReferenceMatch[]> => {
  const search = new URLSearchParams();
  const keyword = String(params?.q || '').trim();
  if (keyword !== '') {
    search.set('q', keyword);
  }
  if (params?.exclude_id !== undefined && params?.exclude_id !== null && `${params.exclude_id}`.trim() !== '') {
    search.set('exclude_id', String(params.exclude_id));
  }
  if (params?.limit !== undefined) {
    const limit = Math.max(1, Math.min(50, Math.floor(Number(params.limit))));
    if (Number.isFinite(limit)) {
      search.set('limit', String(limit));
    }
  }

  const suffix = search.toString();
  const res = await apiFetch(`/api/v5/programming-requests/reference-search${suffix ? `?${suffix}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'programming:reference-search',
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROGRAMMING_REQUEST_REFERENCE_MATCHES_FAILED'));
  }

  const payload = await parseJson<ProgrammingRequestReferenceMatch>(res);
  return payload.data ?? [];
};

export const exportProgrammingRequestsCsv = async (query?: ProgrammingRequestFilters): Promise<DownloadFileResult> => {
  const statusFilter = Array.isArray(query?.status) && query.status.length > 0
    ? query.status.join(',')
    : '';

  const paginatedQuery: PaginatedQuery = {
    page: 1,
    per_page: query?.per_page,
    q: query?.q,
    sort_by: query?.sort_by,
    sort_dir: query?.sort_dir,
    filters: {
      status: statusFilter,
      req_type: query?.req_type || '',
      coder_id: query?.coder_id ?? '',
      customer_id: query?.customer_id ?? '',
      project_id: query?.project_id ?? '',
      requested_date_from: query?.requested_date_from || '',
      requested_date_to: query?.requested_date_to || '',
    },
  };

  const suffix = buildPaginatedQueryString(paginatedQuery);
  const path = suffix
    ? `/api/v5/programming-requests/export${suffix}&format=csv`
    : '/api/v5/programming-requests/export?format=csv';
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
    cancelKey: 'programming:export',
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_PROGRAMMING_REQUESTS_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, `programming_requests_${new Date().toISOString().slice(0, 10)}.csv`),
  };
};

export const fetchProgrammingRequestById = async (id: string | number): Promise<IProgrammingRequest> => {
  const res = await apiFetch(`/api/v5/programming-requests/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROGRAMMING_REQUEST_FAILED'));
  }

  return parseItemJson<IProgrammingRequest>(res);
};

export const fetchProgrammingRequestWorklogs = async (
  requestId: string | number
): Promise<{ data: IWorklog[]; summary: WorklogPhaseSummary[] }> => {
  const res = await apiFetch(`/api/v5/programming-requests/${requestId}/worklogs`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROGRAMMING_WORKLOGS_FAILED'));
  }

  const payload = (await res.json()) as {
    data?: IWorklog[];
    summary?: WorklogPhaseSummary[];
  };

  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    summary: Array.isArray(payload.summary) ? payload.summary : [],
  };
};
export const fetchSupportRequestReceivers = async (params?: {
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
  const res = await apiFetch(`/api/v5/support-requests/receivers${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_SUPPORT_REQUEST_RECEIVERS_FAILED'));
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
    apiFetch('/api/v5/support-request-statuses', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/support-requests', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    apiFetch('/api/v5/support-request-history', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
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
    supportRequestStatusesRes,
    supportRequestsRes,
    supportRequestHistoriesRes,
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
  const supportRequestStatuses = supportRequestStatusesRes.status === 'fulfilled' ? await parseJson<SupportRequestStatusOption>(supportRequestStatusesRes.value) : { data: [] };
  const supportRequests = supportRequestsRes.status === 'fulfilled' ? await parseJson<SupportRequest>(supportRequestsRes.value) : { data: [] };
  const supportRequestHistories = supportRequestHistoriesRes.status === 'fulfilled' ? await parseJson<SupportRequestHistory>(supportRequestHistoriesRes.value) : { data: [] };
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
    supportRequestStatuses: supportRequestStatuses.data ?? [],
    supportRequests: supportRequests.data ?? [],
    supportRequestHistories: supportRequestHistories.data ?? [],
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

export const createEmployee = async (payload: Partial<Employee>): Promise<Employee> => {
  const res = await apiFetch(INTERNAL_USERS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildEmployeeRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEE_FAILED'));
  }

  return parseItemJson<Employee>(res);
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
  const res = await apiFetch('/api/v5/opportunities', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage || 'NEW',
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_OPPORTUNITY_FAILED'));
  }

  return parseItemJson<Opportunity>(res);
};

export const updateOpportunity = async (id: string | number, payload: Partial<Opportunity>): Promise<Opportunity> => {
  const res = await apiFetch(`/api/v5/opportunities/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      opp_name: payload.opp_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      amount: normalizeNumber(payload.amount, 0),
      stage: payload.stage,
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
          if (!role) {
            return null;
          }

          return {
            user_id: userId,
            raci_role: role,
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
          if (!role) {
            return null;
          }

          return {
            user_id: userId,
            raci_role: role,
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

export const createContract = async (payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const termUnitRaw = String(payload.term_unit || '').trim().toUpperCase();
  const normalizedTermUnit = termUnitRaw === 'MONTH' || termUnitRaw === 'DAY' ? termUnitRaw : null;

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
        fileName: attachment.fileName,
        fileUrl: normalizeNullableText(attachment.fileUrl),
        driveFileId: normalizeNullableText(attachment.driveFileId),
        fileSize: normalizeNumber(attachment.fileSize, 0),
        mimeType: normalizeNullableText(attachment.mimeType),
        createdAt: normalizeNullableText(attachment.createdAt),
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
          fileName: attachment.fileName,
          fileUrl: normalizeNullableText(attachment.fileUrl),
          driveFileId: normalizeNullableText(attachment.driveFileId),
          fileSize: normalizeNumber(attachment.fileSize, 0),
          mimeType: normalizeNullableText(attachment.mimeType),
          createdAt: normalizeNullableText(attachment.createdAt),
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
  driveFileId?: string | null;
  fileUrl?: string | null;
}): Promise<void> => {
  const query = new URLSearchParams();
  if (payload.driveFileId) {
    query.set('driveFileId', payload.driveFileId);
  }
  if (payload.fileUrl) {
    query.set('fileUrl', payload.fileUrl);
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

export const testGoogleDriveIntegrationSettings = async (): Promise<{
  message?: string;
  user_email?: string | null;
}> => {
  const res = await apiFetch('/api/v5/integrations/google-drive/test', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'TEST_GOOGLE_DRIVE_INTEGRATION_FAILED'));
  }

  return parseItemJson<{ message?: string; user_email?: string | null }>(res);
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
  payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
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
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PAYMENT_SCHEDULE_FAILED'));
  }

  return parseItemJson<PaymentSchedule>(res);
};

export type ContractPaymentAllocationMode = 'EVEN' | 'ADVANCE_PERCENT';

export interface GenerateContractPaymentsPayload {
  preserve_paid?: boolean;
  allocation_mode?: ContractPaymentAllocationMode;
  advance_percentage?: number;
}

export interface GenerateContractPaymentsResult {
  data: PaymentSchedule[];
  meta: {
    generated_count: number;
    preserved_count: number;
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
      preserve_paid: payload?.preserve_paid,
      allocation_mode: payload?.allocation_mode,
      advance_percentage: normalizeNullableNumber(payload?.advance_percentage),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CONTRACT_PAYMENTS_FAILED'));
  }

  const rawPayload = (await res.json()) as ApiListResponse<PaymentSchedule> & {
    meta?: {
      generated_count?: number;
      preserved_count?: number;
      allocation_mode?: ContractPaymentAllocationMode;
    };
  };

  return {
    data: rawPayload.data ?? [],
    meta: {
      generated_count: Number(rawPayload.meta?.generated_count ?? (rawPayload.data ?? []).length) || 0,
      preserved_count: Number(rawPayload.meta?.preserved_count ?? 0) || 0,
      allocation_mode: rawPayload.meta?.allocation_mode === 'ADVANCE_PERCENT' ? 'ADVANCE_PERCENT' : 'EVEN',
    },
  };
};

export const createSupportServiceGroup = async (payload: Partial<SupportServiceGroup>): Promise<SupportServiceGroup> => {
  const res = await apiFetch('/api/v5/support-service-groups', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      group_code: normalizeNullableText(payload.group_code),
      group_name: payload.group_name,
      description: normalizeNullableText(payload.description),
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
      group_code: normalizeNullableText(payload.group_code),
      group_name: normalizeNullableText(payload.group_name),
      description: normalizeNullableText(payload.description),
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

export const createSupportRequest = async (payload: Partial<SupportRequest>): Promise<SupportRequest> => {
  const res = await apiFetch('/api/v5/support-requests', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildSupportRequestRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUEST_FAILED'));
  }

  return parseItemJson<SupportRequest>(res);
};

export const createSupportRequestsBulk = async (
  items: Array<Partial<SupportRequest>>
): Promise<BulkMutationResult<SupportRequest>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch('/api/v5/support-requests/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => buildSupportRequestRequestPayload(item)),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_SUPPORT_REQUESTS_BULK_FAILED'));
  }

  return parseBulkMutationJson<SupportRequest>(res);
};

export const updateSupportRequest = async (
  id: string | number,
  payload: Partial<SupportRequest> & { status_comment?: string | null }
): Promise<SupportRequest> => {
  const res = await apiFetch(`/api/v5/support-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      reference_ticket_code: normalizeNullableText(payload.reference_ticket_code),
      reference_request_id: normalizeNullableNumber(payload.reference_request_id),
      summary: payload.summary,
      service_group_id: normalizeNullableNumber(payload.service_group_id),
      project_item_id: normalizeNullableNumber(payload.project_item_id),
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      product_id: normalizeNullableNumber(payload.product_id),
      reporter_name: normalizeNullableText(payload.reporter_name),
      reporter_contact_id: normalizeNullableNumber(payload.reporter_contact_id),
      assignee_id: normalizeNullableNumber(payload.assignee_id),
      receiver_user_id: normalizeNullableNumber(payload.receiver_user_id),
      status: payload.status,
      priority: payload.priority,
      requested_date: normalizeNullableText(payload.requested_date),
      due_date: normalizeNullableText(payload.due_date),
      resolved_date: normalizeNullableText(payload.resolved_date),
      hotfix_date: normalizeNullableText(payload.hotfix_date),
      noti_date: normalizeNullableText(payload.noti_date),
      tasks: Array.isArray(payload.tasks)
        ? payload.tasks.map((task, index) => ({
          task_code: normalizeNullableText(task?.task_code),
          task_link: normalizeNullableText(task?.task_link),
          status: normalizeSupportRequestTaskStatus(task?.status),
          sort_order: normalizeNumber(task?.sort_order, index),
        }))
        : undefined,
      notes: normalizeNullableText(payload.notes),
      updated_by: normalizeNullableNumber(payload.updated_by),
      status_comment: normalizeNullableText(payload.status_comment),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_REQUEST_FAILED'));
  }

  return parseItemJson<SupportRequest>(res);
};

export const deleteSupportRequest = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/support-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_SUPPORT_REQUEST_FAILED'));
  }
};

export const updateSupportRequestStatus = async (
  id: string | number,
  payload: {
    new_status: SupportRequest['status'];
    comment?: string | null;
    updated_by?: string | number | null;
    resolved_date?: string | null;
    hotfix_date?: string | null;
    noti_date?: string | null;
  }
): Promise<SupportRequest> => {
  const res = await apiFetch(`/api/v5/support-requests/${id}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      new_status: payload.new_status,
      comment: normalizeNullableText(payload.comment),
      updated_by: normalizeNullableNumber(payload.updated_by),
      resolved_date: normalizeNullableText(payload.resolved_date),
      hotfix_date: normalizeNullableText(payload.hotfix_date),
      noti_date: normalizeNullableText(payload.noti_date),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_SUPPORT_STATUS_FAILED'));
  }

  return parseItemJson<SupportRequest>(res);
};

export const fetchSupportRequestHistory = async (id: string | number): Promise<SupportRequestHistory[]> => {
  const res = await apiFetch(`/api/v5/support-requests/${id}/history`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_SUPPORT_HISTORY_FAILED'));
  }

  const payload = await parseJson<SupportRequestHistory>(res);
  return payload.data ?? [];
};

export const fetchSupportRequestHistories = async (
  requestId?: string | number,
  limit?: number
): Promise<SupportRequestHistory[]> => {
  const params = new URLSearchParams();
  if (requestId !== undefined && requestId !== null && `${requestId}` !== '') {
    params.set('request_id', String(requestId));
  }
  if (Number.isFinite(limit) && Number(limit) > 0) {
    params.set('limit', String(Math.min(1000, Math.floor(Number(limit)))));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/v5/support-request-history${query}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_SUPPORT_HISTORIES_FAILED'));
  }

  const payload = await parseJson<SupportRequestHistory>(res);
  return payload.data ?? [];
};

export const createProgrammingRequest = async (
  payload: Partial<IProgrammingRequestForm | IProgrammingRequest>
): Promise<IProgrammingRequest> => {
  const requestPayload = buildProgrammingRequestRequestPayload(payload);
  delete requestPayload.req_code;

  const res = await apiFetch('/api/v5/programming-requests', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(requestPayload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROGRAMMING_REQUEST_FAILED'));
  }

  return parseItemJson<IProgrammingRequest>(res);
};

export const fetchProgrammingRequestNextCode = async (): Promise<string> => {
  const res = await apiFetch('/api/v5/programming-requests/next-code', {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
    cancelKey: 'programmingRequests:nextCode',
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PROGRAMMING_REQUEST_NEXT_CODE_FAILED'));
  }

  const payload = await parseItemJson<{ req_code?: string | null }>(res);
  return typeof payload?.req_code === 'string' ? payload.req_code : '';
};

export const updateProgrammingRequest = async (
  id: string | number,
  payload: Partial<IProgrammingRequestForm | IProgrammingRequest>
): Promise<IProgrammingRequest> => {
  const requestPayload = buildProgrammingRequestRequestPayload(payload);
  delete requestPayload.req_code;

  const res = await apiFetch(`/api/v5/programming-requests/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(requestPayload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROGRAMMING_REQUEST_FAILED'));
  }

  return parseItemJson<IProgrammingRequest>(res);
};

export const deleteProgrammingRequest = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/programming-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROGRAMMING_REQUEST_FAILED'));
  }
};

export const createProgrammingRequestWorklog = async (
  requestId: string | number,
  payload: Partial<IWorklog>
): Promise<IWorklog> => {
  const res = await apiFetch(`/api/v5/programming-requests/${requestId}/worklogs`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildProgrammingRequestWorklogPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROGRAMMING_WORKLOG_FAILED'));
  }

  return parseItemJson<IWorklog>(res);
};

export const updateProgrammingRequestWorklog = async (
  requestId: string | number,
  worklogId: string | number,
  payload: Partial<IWorklog>
): Promise<IWorklog> => {
  const res = await apiFetch(`/api/v5/programming-requests/${requestId}/worklogs/${worklogId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildProgrammingRequestWorklogPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PROGRAMMING_WORKLOG_FAILED'));
  }

  return parseItemJson<IWorklog>(res);
};

export const deleteProgrammingRequestWorklog = async (
  requestId: string | number,
  worklogId: string | number
): Promise<void> => {
  const res = await apiFetch(`/api/v5/programming-requests/${requestId}/worklogs/${worklogId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROGRAMMING_WORKLOG_FAILED'));
  }
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
