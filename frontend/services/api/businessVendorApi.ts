import type { Business, Vendor } from '../../types/businessVendor';
import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import {
  apiFetch,
  buildOptionsPageQuery,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableText,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

export const fetchBusinesses = async (): Promise<Business[]> => fetchList<Business>('/api/v5/businesses');

export const fetchBusinessesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Business>> =>
  fetchPaginatedList<Business>('/api/v5/businesses', query);

export const fetchBusinessesOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Business>> => fetchBusinessesPage(buildOptionsPageQuery(q, page, perPage));

export const fetchVendors = async (): Promise<Vendor[]> => fetchList<Vendor>('/api/v5/vendors');

export const fetchVendorsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Vendor>> =>
  fetchPaginatedList<Vendor>('/api/v5/vendors', query);

export const fetchVendorsOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Vendor>> => fetchVendorsPage(buildOptionsPageQuery(q, page, perPage));

export const createBusiness = async (payload: Partial<Business>): Promise<Business> => {
  const res = await apiFetch('/api/v5/businesses', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      domain_code: normalizeNullableText(payload.domain_code),
      domain_name: normalizeNullableText(payload.domain_name),
      focal_point_name: normalizeNullableText(payload.focal_point_name),
      focal_point_phone: normalizeNullableText(payload.focal_point_phone),
      focal_point_email: normalizeNullableText(payload.focal_point_email),
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
      focal_point_name: normalizeNullableText(payload.focal_point_name),
      focal_point_phone: normalizeNullableText(payload.focal_point_phone),
      focal_point_email: normalizeNullableText(payload.focal_point_email),
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
