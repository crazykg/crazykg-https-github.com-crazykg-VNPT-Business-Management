import {
  apiFetch,
  isRequestCanceledError,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  parseApiError,
  registerTabEvictedHandler,
  unregisterTabEvictedHandler,
} from '../../shared/api/apiFetch';
import { DEFAULT_PAGINATION_META } from '../../shared/api/types';
import type {
  BulkMutationItemResult,
  BulkMutationResult,
  PaginatedQuery,
  PaginatedResult,
  PaginationMeta,
} from '../../types';

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

export type DownloadFileResult = {
  blob: Blob;
  filename: string;
  emailStatus?: string | null;
  emailMessage?: string | null;
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
  const totalEstimatedValue = Number(kpisRaw?.total_estimated_value);
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
      total_estimated_value:
        Number.isFinite(totalEstimatedValue) && totalEstimatedValue >= 0
          ? totalEstimatedValue
          : undefined,
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

export const parseBulkMutationJson = async <T>(res: Response): Promise<BulkMutationResult<T>> => {
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

const getFirstValidationError = (errors: Record<string, string[] | string> | undefined): { field: string; message: string } | null => {
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

export const parseErrorMessage = async (res: Response, _fallback: string): Promise<string> => {
  try {
    const payload = await parseApiError(res);
    const firstValidationError = getFirstValidationError(payload.errors);
    if (firstValidationError) {
      return localizeValidationMessage(firstValidationError.field, firstValidationError.message);
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

export const resolveDownloadFilename = (res: Response, fallback: string): string => {
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

export const parseItemJson = async <T>(res: Response): Promise<T> => {
  const payload = (await res.json()) as ApiItemResponse<T>;
  return payload.data as T;
};

export const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
};

export const fetchList = async <T>(path: string): Promise<T[]> => {
  const res = await apiFetch(path, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  const parsed = await parseJson<T>(res);
  return parsed.data ?? [];
};

export const fetchPaginatedList = async <T>(
  path: string,
  query?: PaginatedQuery
): Promise<PaginatedResult<T>> => {
  const queryString = buildPaginatedQueryString(query);
  const res = await apiFetch(`${path}${queryString}`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_LIST_FAILED'));
  }

  return parsePaginatedJson<T>(res);
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

export const buildOptionsPageQuery = (q: string, page = 1, perPage = 30): PaginatedQuery => ({
  page,
  per_page: perPage,
  q,
  simple: false,
  sort_by: 'id',
  sort_dir: 'desc',
});

export {
  apiFetch,
  DEFAULT_PAGINATION_META,
  isRequestCanceledError,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  registerTabEvictedHandler,
  unregisterTabEvictedHandler,
};
