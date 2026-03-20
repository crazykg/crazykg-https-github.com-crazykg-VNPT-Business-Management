/**
 * Shared API types used across all feature modules.
 *
 * These are the wire-format types that the backend returns.
 */

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  kpis?: Record<string, unknown>;
}

export interface PaginatedQuery {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export type ApiListResponse<T> = {
  data?: T[];
  meta?: Partial<PaginationMeta>;
};

export type ApiItemResponse<T> = {
  data?: T;
  provisioning?: unknown;
  password_change_required?: boolean;
};

export type ApiErrorPayload = {
  message?: string;
  code?: string;
  errors?: Record<string, string[] | string>;
};

export const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 1,
};
