import {
  AuditLog,
  Business,
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document,
  Employee,
  Opportunity,
  PaymentCycle,
  PaymentSchedule,
  Product,
  Project,
  Reminder,
  UserDeptHistory,
  Vendor
} from '../types';
import { normalizeEmployeeCode } from '../utils/employeeDisplay';

type ApiListResponse<T> = {
  data?: T[];
};

type ApiItemResponse<T> = {
  data?: T;
};

type ApiErrorPayload = {
  message?: string;
  errors?: Record<string, string[] | string>;
};

const JSON_ACCEPT_HEADER = { Accept: 'application/json' };
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const INTERNAL_USERS_ENDPOINT = '/api/v5/internal-users';

const parseJson = async <T>(res: Response): Promise<ApiListResponse<T>> => {
  if (!res.ok) {
    return { data: [] };
  }

  const payload = await res.json();
  return payload as ApiListResponse<T>;
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

export const fetchV5MasterData = async () => {
  const requests = await Promise.allSettled([
    fetch('/api/v5/departments', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch(INTERNAL_USERS_ENDPOINT, { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/businesses', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/products', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/customers', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/customer-personnel', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/vendors', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/projects', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/contracts', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/payment-schedules', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/opportunities', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/documents', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/reminders', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/user-dept-history', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
    fetch('/api/v5/audit-logs', { credentials: 'include', headers: JSON_ACCEPT_HEADER }),
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
    contractsRes,
    paymentSchedulesRes,
    opportunitiesRes,
    documentsRes,
    remindersRes,
    userDeptHistoryRes,
    auditLogsRes,
  ] = requests;

  const departments = departmentsRes.status === 'fulfilled' ? await parseJson<Department>(departmentsRes.value) : { data: [] };
  const employees = employeesRes.status === 'fulfilled' ? await parseJson<Employee>(employeesRes.value) : { data: [] };
  const businesses = businessesRes.status === 'fulfilled' ? await parseJson<Business>(businessesRes.value) : { data: [] };
  const products = productsRes.status === 'fulfilled' ? await parseJson<Product>(productsRes.value) : { data: [] };
  const customers = customersRes.status === 'fulfilled' ? await parseJson<Customer>(customersRes.value) : { data: [] };
  const customerPersonnel = customerPersonnelRes.status === 'fulfilled' ? await parseJson<CustomerPersonnel>(customerPersonnelRes.value) : { data: [] };
  const vendors = vendorsRes.status === 'fulfilled' ? await parseJson<Vendor>(vendorsRes.value) : { data: [] };
  const projects = projectsRes.status === 'fulfilled' ? await parseJson<Project>(projectsRes.value) : { data: [] };
  const contracts = contractsRes.status === 'fulfilled' ? await parseJson<Contract>(contractsRes.value) : { data: [] };
  const paymentSchedules = paymentSchedulesRes.status === 'fulfilled' ? await parseJson<PaymentSchedule>(paymentSchedulesRes.value) : { data: [] };
  const opportunities = opportunitiesRes.status === 'fulfilled' ? await parseJson<Opportunity>(opportunitiesRes.value) : { data: [] };
  const documents = documentsRes.status === 'fulfilled' ? await parseJson<Document>(documentsRes.value) : { data: [] };
  const reminders = remindersRes.status === 'fulfilled' ? await parseJson<Reminder>(remindersRes.value) : { data: [] };
  const userDeptHistory = userDeptHistoryRes.status === 'fulfilled' ? await parseJson<UserDeptHistory>(userDeptHistoryRes.value) : { data: [] };
  const auditLogs = auditLogsRes.status === 'fulfilled' ? await parseJson<AuditLog>(auditLogsRes.value) : { data: [] };

  return {
    departments: departments.data ?? [],
    employees: employees.data ?? [],
    businesses: businesses.data ?? [],
    products: products.data ?? [],
    customers: customers.data ?? [],
    customerPersonnel: customerPersonnel.data ?? [],
    vendors: vendors.data ?? [],
    projects: projects.data ?? [],
    contracts: contracts.data ?? [],
    paymentSchedules: paymentSchedules.data ?? [],
    opportunities: opportunities.data ?? [],
    documents: documents.data ?? [],
    reminders: reminders.data ?? [],
    userDeptHistory: userDeptHistory.data ?? [],
    auditLogs: auditLogs.data ?? [],
  };
};

export const createDepartment = async (payload: Partial<Department>): Promise<Department> => {
  const res = await fetch('/api/v5/departments', {
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
  const res = await fetch(`/api/v5/departments/${id}`, {
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
  const res = await fetch(`/api/v5/departments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DEPARTMENT_FAILED'));
  }
};

export const createEmployee = async (payload: Partial<Employee>): Promise<Employee> => {
  const normalizedEmployeeCode = normalizeEmployeeCode(payload.user_code || payload.employee_code || payload.id, payload.id);
  const res = await fetch(INTERNAL_USERS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
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
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEE_FAILED'));
  }

  return parseItemJson<Employee>(res);
};

export const updateEmployee = async (id: string | number, payload: Partial<Employee>): Promise<Employee> => {
  const normalizedEmployeeCode = normalizeEmployeeCode(payload.user_code || payload.employee_code || id, id);
  const res = await fetch(`${INTERNAL_USERS_ENDPOINT}/${id}`, {
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
  const res = await fetch(`${INTERNAL_USERS_ENDPOINT}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_EMPLOYEE_FAILED'));
  }
};

export const createCustomer = async (payload: Partial<Customer>): Promise<Customer> => {
  const res = await fetch('/api/v5/customers', {
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
  const res = await fetch(`/api/v5/customers/${id}`, {
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
  const res = await fetch(`/api/v5/customers/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_FAILED'));
  }
};

export const createVendor = async (payload: Partial<Vendor>): Promise<Vendor> => {
  const res = await fetch('/api/v5/vendors', {
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
  const res = await fetch(`/api/v5/vendors/${id}`, {
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
  const res = await fetch(`/api/v5/vendors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_VENDOR_FAILED'));
  }
};

export const createOpportunity = async (payload: Partial<Opportunity>): Promise<Opportunity> => {
  const res = await fetch('/api/v5/opportunities', {
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
  const res = await fetch(`/api/v5/opportunities/${id}`, {
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
  const res = await fetch(`/api/v5/opportunities/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_OPPORTUNITY_FAILED'));
  }
};

export const createProject = async (payload: Partial<Project> & Record<string, unknown>): Promise<Project> => {
  const res = await fetch('/api/v5/projects', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      project_code: payload.project_code,
      project_name: payload.project_name,
      customer_id: normalizeNullableNumber(payload.customer_id),
      status: payload.status || 'PLANNING',
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
  const res = await fetch(`/api/v5/projects/${id}`, {
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
  const res = await fetch(`/api/v5/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PROJECT_FAILED'));
  }
};

export const createContract = async (payload: Partial<Contract> & Record<string, unknown>): Promise<Contract> => {
  const res = await fetch('/api/v5/contracts', {
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
  const res = await fetch(`/api/v5/contracts/${id}`, {
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
  const res = await fetch(`/api/v5/contracts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CONTRACT_FAILED'));
  }
};

export const fetchPaymentSchedules = async (contractId?: string | number): Promise<PaymentSchedule[]> => {
  const query = contractId !== undefined && contractId !== null && `${contractId}` !== ''
    ? `?contract_id=${encodeURIComponent(String(contractId))}`
    : '';

  const res = await fetch(`/api/v5/payment-schedules${query}`, {
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
  const res = await fetch(`/api/v5/payment-schedules/${id}`, {
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
  const res = await fetch(`/api/v5/contracts/${contractId}/generate-payments`, {
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
