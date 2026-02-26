import {
  AuthLoginPayload,
  AuthLoginResult,
  AuthUser,
  Attachment,
  AuditLog,
  BulkMutationItemResult,
  BulkMutationResult,
  Business,
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document,
  Employee,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  Opportunity,
  PaymentCycle,
  PaymentSchedule,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
  Permission,
  Product,
  ProjectItemMaster,
  Project,
  Reminder,
  Role,
  SupportRequest,
  SupportRequestHistory,
  SupportServiceGroup,
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
const API_REQUEST_TIMEOUT_MS = 20000;

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    return await globalThis.fetch(input, {
      ...init,
      credentials: 'include',
      headers,
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Không thể kết nối máy chủ (quá thời gian phản hồi). Vui lòng thử lại.');
    }

    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng hoặc trạng thái backend.');
  } finally {
    globalThis.clearTimeout(timeoutId);
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

  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGINATION_META.page,
    per_page: Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : DEFAULT_PAGINATION_META.per_page,
    total: Number.isFinite(total) && total >= 0 ? Math.floor(total) : DEFAULT_PAGINATION_META.total,
    total_pages:
      Number.isFinite(totalPages) && totalPages > 0
        ? Math.floor(totalPages)
        : DEFAULT_PAGINATION_META.total_pages,
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
  return {
    uuid: payload.uuid,
    user_code: normalizedEmployeeCode,
    username: payload.username || normalizedEmployeeCode,
    full_name: payload.full_name,
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
  ticket_code: normalizeNullableText(payload.ticket_code),
  summary: payload.summary,
  service_group_id: normalizeNullableNumber(payload.service_group_id),
  project_item_id: normalizeNullableNumber(payload.project_item_id),
  customer_id: normalizeNullableNumber(payload.customer_id),
  project_id: normalizeNullableNumber(payload.project_id),
  product_id: normalizeNullableNumber(payload.product_id),
  reporter_name: normalizeNullableText(payload.reporter_name),
  assignee_id: normalizeNullableNumber(payload.assignee_id),
  status: payload.status || 'OPEN',
  priority: payload.priority || 'MEDIUM',
  requested_date: payload.requested_date,
  due_date: normalizeNullableText(payload.due_date),
  resolved_date: normalizeNullableText(payload.resolved_date),
  hotfix_date: normalizeNullableText(payload.hotfix_date),
  noti_date: normalizeNullableText(payload.noti_date),
  task_link: normalizeNullableText(payload.task_link),
  change_log: normalizeNullableText(payload.change_log),
  test_note: normalizeNullableText(payload.test_note),
  notes: normalizeNullableText(payload.notes),
  created_by: normalizeNullableNumber(payload.created_by),
});

const fetchList = async <T>(path: string): Promise<T[]> => {
  const res = await apiFetch(path, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `FETCH_${path.toUpperCase()}_FAILED`));
  }

  const payload = await parseJson<T>(res);
  return payload.data ?? [];
};

const fetchPaginatedList = async <T>(path: string, query?: PaginatedQuery): Promise<PaginatedResult<T>> => {
  const suffix = buildPaginatedQueryString(query);
  const res = await apiFetch(`${path}${suffix}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
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
export const fetchCustomerPersonnel = async (): Promise<CustomerPersonnel[]> =>
  fetchList<CustomerPersonnel>('/api/v5/customer-personnel');
export const fetchVendors = async (): Promise<Vendor[]> => fetchList<Vendor>('/api/v5/vendors');
export const fetchProjects = async (): Promise<Project[]> => fetchList<Project>('/api/v5/projects');
export const fetchProjectsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Project>> =>
  fetchPaginatedList<Project>('/api/v5/projects', query);
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
export const fetchSupportServiceGroups = async (): Promise<SupportServiceGroup[]> =>
  fetchList<SupportServiceGroup>('/api/v5/support-service-groups');
export const fetchSupportRequests = async (): Promise<SupportRequest[]> => fetchList<SupportRequest>('/api/v5/support-requests');
export const fetchSupportRequestsPage = async (query: PaginatedQuery): Promise<PaginatedResult<SupportRequest>> =>
  fetchPaginatedList<SupportRequest>('/api/v5/support-requests', query);

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
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      user_code: normalizedEmployeeCode,
      username: payload.username,
      full_name: payload.full_name,
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
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PROJECT_FAILED'));
  }

  return parseItemJson<Project>(res);
};

export const updateProject = async (id: string | number, payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
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
      expiry_date: payload.expiry_date,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const updateContract = async (id: string | number, payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
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
      expiry_date: payload.expiry_date,
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

export const generateContractPayments = async (contractId: string | number): Promise<PaymentSchedule[]> => {
  const res = await apiFetch(`/api/v5/contracts/${contractId}/generate-payments`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CONTRACT_PAYMENTS_FAILED'));
  }

  const payload = (await res.json()) as ApiListResponse<PaymentSchedule>;
  return payload.data ?? [];
};

export const createSupportServiceGroup = async (payload: Partial<SupportServiceGroup>): Promise<SupportServiceGroup> => {
  const res = await apiFetch('/api/v5/support-service-groups', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
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
      ticket_code: normalizeNullableText(payload.ticket_code),
      summary: payload.summary,
      service_group_id: normalizeNullableNumber(payload.service_group_id),
      project_item_id: normalizeNullableNumber(payload.project_item_id),
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      product_id: normalizeNullableNumber(payload.product_id),
      reporter_name: normalizeNullableText(payload.reporter_name),
      assignee_id: normalizeNullableNumber(payload.assignee_id),
      status: payload.status,
      priority: payload.priority,
      requested_date: normalizeNullableText(payload.requested_date),
      due_date: normalizeNullableText(payload.due_date),
      resolved_date: normalizeNullableText(payload.resolved_date),
      hotfix_date: normalizeNullableText(payload.hotfix_date),
      noti_date: normalizeNullableText(payload.noti_date),
      task_link: normalizeNullableText(payload.task_link),
      change_log: normalizeNullableText(payload.change_log),
      test_note: normalizeNullableText(payload.test_note),
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

export const fetchSupportRequestHistories = async (requestId?: string | number): Promise<SupportRequestHistory[]> => {
  const query = requestId !== undefined && requestId !== null && `${requestId}` !== ''
    ? `?request_id=${encodeURIComponent(String(requestId))}`
    : '';
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
