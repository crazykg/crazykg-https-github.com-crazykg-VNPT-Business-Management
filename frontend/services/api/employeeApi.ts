import type { EmployeeProvisioning, EmployeeSaveResult } from '../../types';
import type { BulkMutationResult, PaginatedQuery, PaginatedResult } from '../../types/common';
import type { Employee, EmployeePartyListItem, EmployeePartyProfile } from '../../types/employee';
import { normalizeEmployeeCode } from '../../utils/employeeDisplay';
import {
  apiFetch,
  buildOptionsPageQuery,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  parseBulkMutationJson,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

const INTERNAL_USERS_ENDPOINT = '/api/v5/internal-users';
const EMPLOYEE_PARTY_PROFILES_ENDPOINT = '/api/v5/employee-party-profiles';

type EmployeeApiItemResponse<T> = {
  data?: T;
  provisioning?: EmployeeProvisioning | null;
  password_change_required?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

const normalizeEmployeeStatus = (value: unknown): Employee['status'] => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'SUSPENDED' || normalized === 'TRANSFERRED') return 'SUSPENDED';
  if (normalized === 'INACTIVE' || normalized === 'BANNED') return 'INACTIVE';
  return 'INACTIVE';
};

const normalizeEmployeeRecord = (payload: Partial<Employee> & Record<string, unknown>): Employee => {
  const normalizedEmployeeCode = normalizeEmployeeCode(
    normalizeNullableText(payload.user_code ?? payload.employee_code ?? payload.username ?? payload.id) || '',
    payload.id ?? null,
  );
  const normalizedPhone = normalizeNullableText(
    payload.phone_number ?? payload.phone ?? payload.mobile ?? payload.phoneNumber
  );

  return {
    ...(payload as Employee),
    id: (payload.id ?? '') as string | number,
    uuid: String(payload.uuid ?? ''),
    user_code: normalizedEmployeeCode,
    employee_code: normalizedEmployeeCode,
    username: String(payload.username ?? normalizedEmployeeCode),
    full_name: String(payload.full_name ?? ''),
    email: String(normalizeNullableText(payload.email) ?? ''),
    phone_number: normalizedPhone,
    phone: normalizedPhone,
    mobile: normalizedPhone,
    status: normalizeEmployeeStatus(payload.status),
    department_id: (payload.department_id ?? payload.department ?? null) as string | number | null,
    position_id: (payload.position_id ?? null) as string | number | null,
  };
};

const hasOwn = <T extends object>(payload: T, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(payload, key);

const normalizeEmployeePartyProfileRecord = (
  payload: Partial<EmployeePartyProfile> & Record<string, unknown>
): EmployeePartyProfile => {
  const employeePayload = isRecord(payload.employee)
    ? normalizeEmployeeRecord(payload.employee)
    : null;

  return {
    ...(payload as EmployeePartyProfile),
    id: (payload.id ?? '') as string | number,
    employee_id: (payload.employee_id ?? employeePayload?.id ?? '') as string | number,
    ethnicity: normalizeNullableText(payload.ethnicity),
    religion: normalizeNullableText(payload.religion),
    hometown: normalizeNullableText(payload.hometown),
    professional_qualification: normalizeNullableText(payload.professional_qualification),
    political_theory_level: normalizeNullableText(payload.political_theory_level),
    party_card_number: normalizeNullableText(payload.party_card_number),
    notes: normalizeNullableText(payload.notes),
    created_at: normalizeNullableText(payload.created_at),
    updated_at: normalizeNullableText(payload.updated_at),
    employee: employeePayload,
    profile_quality: isRecord(payload.profile_quality)
      ? {
          missing_card_number: Boolean(payload.profile_quality.missing_card_number),
        }
      : undefined,
  };
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

const buildEmployeeBulkImportRequestPayload = (payload: Partial<Employee>) => {
  const requestPayload: Record<string, unknown> = {};
  const rawEmployeeCode = normalizeNullableText(payload.user_code ?? payload.employee_code);
  if (rawEmployeeCode) {
    requestPayload.user_code = normalizeEmployeeCode(rawEmployeeCode, payload.id);
  }

  if (hasOwn(payload, 'uuid')) {
    const uuid = normalizeNullableText(payload.uuid);
    if (uuid) {
      requestPayload.uuid = uuid;
    }
  }

  if (hasOwn(payload, 'username')) {
    const username = normalizeNullableText(payload.username);
    if (username) {
      requestPayload.username = username;
    }
  }

  if (hasOwn(payload, 'full_name')) {
    const fullName = normalizeNullableText(payload.full_name);
    if (fullName) {
      requestPayload.full_name = fullName;
    }
  }

  if (hasOwn(payload, 'email')) {
    const email = normalizeNullableText(payload.email);
    if (email) {
      requestPayload.email = email;
    }
  }

  if (hasOwn(payload, 'phone_number') || hasOwn(payload, 'phone') || hasOwn(payload, 'mobile')) {
    const normalizedPhone = normalizeNullableText(payload.phone_number || payload.phone || payload.mobile);
    if (normalizedPhone) {
      requestPayload.phone_number = normalizedPhone;
      requestPayload.phone = normalizedPhone;
    }
  }

  if (hasOwn(payload, 'status') && payload.status) {
    requestPayload.status = payload.status;
  }

  if (hasOwn(payload, 'job_title_raw')) {
    const jobTitle = normalizeNullableText(payload.job_title_raw);
    if (jobTitle) {
      requestPayload.job_title_raw = jobTitle;
    }
  }

  if (hasOwn(payload, 'date_of_birth')) {
    const dateOfBirth = normalizeNullableText(payload.date_of_birth);
    if (dateOfBirth) {
      requestPayload.date_of_birth = dateOfBirth;
    }
  }

  if (hasOwn(payload, 'gender') && payload.gender) {
    requestPayload.gender = payload.gender;
  }

  if (hasOwn(payload, 'vpn_status') && payload.vpn_status) {
    requestPayload.vpn_status = payload.vpn_status;
  }

  if (hasOwn(payload, 'ip_address')) {
    const ipAddress = normalizeNullableText(payload.ip_address);
    if (ipAddress) {
      requestPayload.ip_address = ipAddress;
    }
  }

  if (hasOwn(payload, 'department_id')) {
    const departmentId = normalizeNullableNumber(payload.department_id);
    if (departmentId !== null) {
      requestPayload.department_id = departmentId;
    }
  }

  if (hasOwn(payload, 'position_id')) {
    const positionId = normalizePositionId(payload.position_id);
    if (positionId !== null) {
      requestPayload.position_id = positionId;
    }
  }

  return requestPayload;
};

const buildEmployeePartyProfileRequestPayload = (
  payload: Partial<EmployeePartyProfile> & { employee_code?: string }
) => ({
  employee_code: normalizeNullableText(payload.employee?.user_code || payload.employee?.employee_code || payload.employee_code),
  ethnicity: normalizeNullableText(payload.ethnicity),
  religion: normalizeNullableText(payload.religion),
  hometown: normalizeNullableText(payload.hometown),
  professional_qualification: normalizeNullableText(payload.professional_qualification),
  political_theory_level: normalizeNullableText(payload.political_theory_level),
  party_card_number: normalizeNullableText(payload.party_card_number),
  notes: normalizeNullableText(payload.notes),
});

const parseEmployeeItemResponse = async <T>(res: Response): Promise<EmployeeApiItemResponse<T>> =>
  (await res.json()) as EmployeeApiItemResponse<T>;

export const fetchEmployees = async (): Promise<Employee[]> => {
  const rows = await fetchList<Record<string, unknown>>(INTERNAL_USERS_ENDPOINT);
  return rows.map((item) => normalizeEmployeeRecord(item));
};

export const fetchEmployeesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Employee>> => {
  const result = await fetchPaginatedList<Record<string, unknown>>(INTERNAL_USERS_ENDPOINT, query);
  return {
    data: result.data.map((item) => normalizeEmployeeRecord(item)),
    meta: result.meta,
  };
};

export const fetchEmployeesOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Employee>> => fetchEmployeesPage(buildOptionsPageQuery(q, page, perPage));

export const fetchEmployeePartyProfilesPage = async (
  query: PaginatedQuery
): Promise<PaginatedResult<EmployeePartyListItem>> => {
  const result = await fetchPaginatedList<Record<string, unknown>>(EMPLOYEE_PARTY_PROFILES_ENDPOINT, query);
  return {
    data: result.data.map((item) => normalizeEmployeePartyProfileRecord(item)),
    meta: result.meta,
  };
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

  const parsed = await parseEmployeeItemResponse<Record<string, unknown>>(res);
  if (!parsed.data) {
    throw new Error('Phản hồi tạo nhân sự không hợp lệ.');
  }

  return {
    employee: normalizeEmployeeRecord(parsed.data),
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
      items: items.map((item) => buildEmployeeBulkImportRequestPayload(item)),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_EMPLOYEES_BULK_FAILED'));
  }

  const parsed = await parseBulkMutationJson<Record<string, unknown>>(res);
  return {
    ...parsed,
    results: parsed.results.map((item) => ({
      ...item,
      data: item.data ? normalizeEmployeeRecord(item.data) : undefined,
    })),
    created: parsed.created.map((item) => normalizeEmployeeRecord(item)),
  };
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

  const employee = await parseItemJson<Record<string, unknown>>(res);
  return normalizeEmployeeRecord(employee);
};

export const fetchEmployeePartyProfile = async (employeeId: string | number): Promise<EmployeePartyProfile | null> => {
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${employeeId}/party-profile`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_EMPLOYEE_PARTY_PROFILE_FAILED'));
  }

  const parsed = await parseEmployeeItemResponse<Record<string, unknown> | null>(res);
  if (!parsed.data) {
    return null;
  }

  return normalizeEmployeePartyProfileRecord(parsed.data);
};

export const upsertEmployeePartyProfile = async (
  employeeId: string | number,
  payload: Partial<EmployeePartyProfile>
): Promise<EmployeePartyProfile> => {
  const res = await apiFetch(`${INTERNAL_USERS_ENDPOINT}/${employeeId}/party-profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildEmployeePartyProfileRequestPayload(payload)),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPSERT_EMPLOYEE_PARTY_PROFILE_FAILED'));
  }

  const parsed = await parseItemJson<Record<string, unknown>>(res);
  return normalizeEmployeePartyProfileRecord(parsed);
};

export const bulkUpsertEmployeePartyProfiles = async (
  items: Array<Partial<EmployeePartyProfile> & { employee_code?: string }>
): Promise<BulkMutationResult<EmployeePartyProfile>> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], created: [], created_count: 0, failed_count: 0 };
  }

  const res = await apiFetch(`${EMPLOYEE_PARTY_PROFILES_ENDPOINT}/bulk-upsert`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      items: items.map((item) => buildEmployeePartyProfileRequestPayload(item)),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'BULK_UPSERT_EMPLOYEE_PARTY_PROFILE_FAILED'));
  }

  const parsed = await parseBulkMutationJson<Record<string, unknown>>(res);
  return {
    ...parsed,
    results: parsed.results.map((item) => ({
      ...item,
      data: item.data ? normalizeEmployeePartyProfileRecord(item.data) : undefined,
    })),
    created: parsed.created.map((item) => normalizeEmployeePartyProfileRecord(item)),
  };
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

  const parsed = await parseEmployeeItemResponse<Employee>(res);
  if (!parsed.data) {
    throw new Error('Phản hồi reset mật khẩu nhân sự không hợp lệ.');
  }

  return {
    employee: parsed.data,
    provisioning: parsed.provisioning || null,
  };
};
