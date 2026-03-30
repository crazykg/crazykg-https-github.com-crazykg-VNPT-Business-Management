import type {
  Customer,
  CustomerInsight,
  CustomerPersonnel,
  UpsellProductDetail,
} from '../../types/customer';
import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import {
  apiFetch,
  buildOptionsPageQuery,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

export const fetchCustomers = async (): Promise<Customer[]> => fetchList<Customer>('/api/v5/customers');

export const fetchCustomersPage = async (query: PaginatedQuery): Promise<PaginatedResult<Customer>> =>
  fetchPaginatedList<Customer>('/api/v5/customers', { ...query, simple: false });

export const fetchCustomersOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Customer>> => fetchCustomersPage(buildOptionsPageQuery(q, page, perPage));

export const fetchCustomerInsight = async (id: string | number): Promise<{ data: CustomerInsight }> => {
  const res = await apiFetch(`/api/v5/customers/${id}/insight`);
  return res.json() as Promise<{ data: CustomerInsight }>;
};

export const fetchUpsellProductDetail = async (
  customerId: string | number,
  productId: string | number,
): Promise<{ data: UpsellProductDetail }> => {
  const res = await apiFetch(`/api/v5/customers/${customerId}/insight/product-detail/${productId}`);
  return res.json() as Promise<{ data: UpsellProductDetail }>;
};

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

export const fetchCustomerPersonnelPage = async (
  query: PaginatedQuery
): Promise<PaginatedResult<CustomerPersonnel>> =>
  fetchPaginatedList<CustomerPersonnel>('/api/v5/customer-personnel', query);

export const fetchCustomerPersonnelOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<CustomerPersonnel>> => fetchCustomerPersonnelPage(buildOptionsPageQuery(q, page, perPage));

export const createCustomer = async (payload: Partial<Customer>): Promise<Customer> => {
  const res = await apiFetch('/api/v5/customers', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      uuid: payload.uuid,
      customer_code: normalizeNullableText(payload.customer_code),
      customer_name: normalizeNullableText(payload.customer_name),
      tax_code: normalizeNullableText(payload.tax_code),
      address: normalizeNullableText(payload.address),
      customer_sector: payload.customer_sector,
      healthcare_facility_type: payload.healthcare_facility_type,
      bed_capacity: payload.bed_capacity,
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
      customer_code: normalizeNullableText(payload.customer_code),
      customer_name: normalizeNullableText(payload.customer_name),
      tax_code: normalizeNullableText(payload.tax_code),
      address: normalizeNullableText(payload.address),
      customer_sector: payload.customer_sector,
      healthcare_facility_type: payload.healthcare_facility_type,
      bed_capacity: payload.bed_capacity,
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
    const error = new Error(await parseErrorMessage(res, 'DELETE_CUSTOMER_FAILED')) as Error & { status?: number };
    error.status = res.status;
    throw error;
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
