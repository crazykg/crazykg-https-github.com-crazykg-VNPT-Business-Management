import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import type {
  Product,
  ProductFeatureCatalog,
  ProductFeatureCatalogListPage,
  ProductTargetSegment,
} from '../../types/product';
import type { DownloadFileResult } from './_infra';
import {
  apiFetch,
  buildOptionsPageQuery,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  normalizeNumber,
  parseErrorMessage,
  parseItemJson,
  resolveDownloadFilename,
} from './_infra';

export const fetchProducts = async (): Promise<Product[]> => fetchList<Product>('/api/v5/products');

export const fetchProductsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Product>> =>
  fetchPaginatedList<Product>('/api/v5/products', query);

export const fetchProductsOptionsPage = async (
  q: string,
  page = 1,
  perPage = 30
): Promise<PaginatedResult<Product>> => fetchProductsPage(buildOptionsPageQuery(q, page, perPage));

export interface ProductQuotationExportPayloadItem {
  product_id?: number | null;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  note?: string | null;
}

export interface ProductQuotationDraftPayload {
  customer_id?: number | null;
  recipient_name: string;
  sender_city?: string | null;
  scope_summary?: string | null;
  quote_date?: string | null;
  vat_rate?: number | null;
  validity_days?: number | null;
  notes_text?: string | null;
  contact_line?: string | null;
  closing_message?: string | null;
  signatory_title?: string | null;
  signatory_unit?: string | null;
  signatory_name?: string | null;
  items: ProductQuotationExportPayloadItem[];
}

export interface ProductQuotationExportPayload extends ProductQuotationDraftPayload {}

export interface ProductQuotationDraftItem {
  id: number;
  sort_order: number;
  product_id?: number | null;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
  line_total: number;
  total_with_vat?: number | null;
  note?: string | null;
}

export interface ProductQuotationDraft {
  id: number;
  uuid: string;
  customer_id?: number | null;
  recipient_name: string;
  sender_city?: string | null;
  quote_date?: string | null;
  scope_summary?: string | null;
  vat_rate?: number | null;
  validity_days: number;
  notes_text?: string | null;
  contact_line?: string | null;
  closing_message?: string | null;
  signatory_title?: string | null;
  signatory_unit?: string | null;
  signatory_name?: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  total_in_words?: string | null;
  uses_multi_vat_template: boolean;
  content_hash?: string | null;
  latest_version_no: number;
  last_printed_at?: string | null;
  last_printed_by?: number | null;
  status: string;
  items: ProductQuotationDraftItem[];
  versions_count: number;
  events_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductQuotationDraftListItem {
  id: number;
  uuid: string;
  customer_id?: number | null;
  recipient_name: string;
  sender_city?: string | null;
  quote_date?: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  uses_multi_vat_template: boolean;
  latest_version_no: number;
  last_printed_at?: string | null;
  last_printed_by?: number | null;
  status: string;
  items_count: number;
  versions_count: number;
  events_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductQuotationVersionRecord {
  id: number;
  quotation_id: number;
  version_no: number;
  template_key?: string | null;
  status: string;
  filename?: string | null;
  quote_date?: string | null;
  recipient_name: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  content_hash?: string | null;
  printed_at?: string | null;
  printed_by?: number | null;
  created_at?: string | null;
}

export interface ProductQuotationVersionDetailItem {
  id: number;
  sort_order: number;
  product_id?: number | null;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
  line_total: number;
  total_with_vat?: number | null;
  note?: string | null;
}

export interface ProductQuotationVersionDetailRecord extends ProductQuotationVersionRecord {
  sender_city?: string | null;
  scope_summary?: string | null;
  vat_rate?: number | null;
  validity_days: number;
  notes_text?: string | null;
  contact_line?: string | null;
  closing_message?: string | null;
  signatory_title?: string | null;
  signatory_unit?: string | null;
  signatory_name?: string | null;
  total_in_words?: string | null;
  uses_multi_vat_template: boolean;
  metadata?: Record<string, unknown> | null;
  items: ProductQuotationVersionDetailItem[];
}

export interface ProductQuotationEventRecord {
  id: number;
  quotation_id: number;
  version_id?: number | null;
  version_no?: number | null;
  event_type: string;
  event_status?: string | null;
  template_key?: string | null;
  filename?: string | null;
  content_hash?: string | null;
  metadata?: Record<string, unknown> | null;
  url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_by?: number | null;
  created_at?: string | null;
}

const serializeProductAttachments = (attachments: Product['attachments']) =>
  Array.isArray(attachments)
    ? attachments.map((attachment) => ({
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
    : undefined;

const buildProductQuotationFallbackFilename = (
  payload: ProductQuotationExportPayload,
  extension: string
): string => {
  const rawRecipient = typeof payload.recipient_name === 'string' ? payload.recipient_name : '';
  const normalizedRecipient = rawRecipient
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fallbackRecipient = normalizedRecipient || 'Khách hàng';
  const dateSource = payload.quote_date ? new Date(payload.quote_date) : new Date();
  const safeDate = Number.isNaN(dateSource.getTime()) ? new Date() : dateSource;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');

  return `Báo giá ${fallbackRecipient} ${year} ${month} ${day}.${extension.replace(/^\./, '')}`;
};

export const createProduct = async (payload: Partial<Product>): Promise<Product> => {
  const res = await apiFetch('/api/v5/products', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      service_group: normalizeNullableText(payload.service_group),
      product_code: normalizeNullableText(payload.product_code),
      product_name: normalizeNullableText(payload.product_name),
      package_name: normalizeNullableText(payload.package_name),
      domain_id: normalizeNullableNumber(payload.domain_id),
      vendor_id: normalizeNullableNumber(payload.vendor_id),
      standard_price: normalizeNumber(payload.standard_price, 0),
      unit: normalizeNullableText(payload.unit),
      description: normalizeNullableText(payload.description),
      attachments: serializeProductAttachments(payload.attachments),
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
      service_group: normalizeNullableText(payload.service_group),
      product_code: normalizeNullableText(payload.product_code),
      product_name: normalizeNullableText(payload.product_name),
      package_name: normalizeNullableText(payload.package_name),
      domain_id: normalizeNullableNumber(payload.domain_id),
      vendor_id: normalizeNullableNumber(payload.vendor_id),
      standard_price: normalizeNumber(payload.standard_price, 0),
      unit: normalizeNullableText(payload.unit),
      description: normalizeNullableText(payload.description),
      attachments: serializeProductAttachments(payload.attachments),
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

export const fetchProductFeatureCatalog = async (productId: string | number): Promise<ProductFeatureCatalog> => {
  const res = await apiFetch(`/api/v5/products/${productId}/feature-catalog`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_FEATURE_CATALOG_FAILED'));
  }

  return parseItemJson<ProductFeatureCatalog>(res);
};

export const fetchProductFeatureCatalogList = async (
  productId: string | number,
  params?: {
    page?: number;
    per_page?: number;
    group_id?: string | number | null;
    search?: string | null;
  }
): Promise<ProductFeatureCatalogListPage> => {
  const searchParams = new URLSearchParams();
  if (typeof params?.page === 'number' && Number.isFinite(params.page)) {
    searchParams.set('page', String(params.page));
  }
  if (typeof params?.per_page === 'number' && Number.isFinite(params.per_page)) {
    searchParams.set('per_page', String(params.per_page));
  }
  if (params?.group_id !== null && params?.group_id !== undefined && String(params.group_id).trim() !== '') {
    searchParams.set('group_id', String(params.group_id));
  }
  if (typeof params?.search === 'string' && params.search.trim() !== '') {
    searchParams.set('search', params.search.trim());
  }

  const queryString = searchParams.toString();
  const res = await apiFetch(`/api/v5/products/${productId}/feature-catalog/list${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_FEATURE_CATALOG_LIST_FAILED'));
  }

  return parseItemJson<ProductFeatureCatalogListPage>(res);
};

export const updateProductFeatureCatalog = async (
  productId: string | number,
  payload: {
    groups: Array<{
      id?: string | number | null;
      uuid?: string | null;
      group_name: string;
      notes?: string | null;
      display_order?: number | null;
      features: Array<{
        id?: string | number | null;
        uuid?: string | null;
        feature_name: string;
        detail_description?: string | null;
        status?: 'ACTIVE' | 'INACTIVE' | null;
        display_order?: number | null;
      }>;
    }>;
    audit_context?: {
      source?: 'FORM' | 'IMPORT' | null;
      import_file_name?: string | null;
      import_sheet_name?: string | null;
      import_row_count?: number | null;
      import_group_count?: number | null;
      import_feature_count?: number | null;
    } | null;
  }
): Promise<ProductFeatureCatalog> => {
  const res = await apiFetch(`/api/v5/products/${productId}/feature-catalog`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      groups: (payload.groups || []).map((group, groupIndex) => ({
        id: normalizeNullableNumber(group.id),
        uuid: normalizeNullableText(group.uuid),
        group_name: normalizeNullableText(group.group_name) || '',
        notes: normalizeNullableText(group.notes),
        display_order: normalizeNumber(group.display_order, groupIndex + 1),
        features: (group.features || []).map((feature, featureIndex) => ({
          id: normalizeNullableNumber(feature.id),
          uuid: normalizeNullableText(feature.uuid),
          feature_name: normalizeNullableText(feature.feature_name) || '',
          detail_description: normalizeNullableText(feature.detail_description),
          status: normalizeNullableText(feature.status) || 'ACTIVE',
          display_order: normalizeNumber(feature.display_order, featureIndex + 1),
        })),
      })),
      audit_context: payload.audit_context
        ? {
            source: normalizeNullableText(payload.audit_context.source) || 'FORM',
            import_file_name: normalizeNullableText(payload.audit_context.import_file_name),
            import_sheet_name: normalizeNullableText(payload.audit_context.import_sheet_name),
            import_row_count: normalizeNullableNumber(payload.audit_context.import_row_count),
            import_group_count: normalizeNullableNumber(payload.audit_context.import_group_count),
            import_feature_count: normalizeNullableNumber(payload.audit_context.import_feature_count),
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PRODUCT_FEATURE_CATALOG_FAILED'));
  }

  return parseItemJson<ProductFeatureCatalog>(res);
};

export interface ProductTargetSegmentListResult {
  data: ProductTargetSegment[];
  meta: {
    table_available: boolean;
  };
}

export interface ProductTargetSegmentSyncItem {
  customer_sector: ProductTargetSegment['customer_sector'];
  facility_type?: ProductTargetSegment['facility_type'];
  facility_types?: ProductTargetSegment['facility_types'];
  bed_capacity_min?: number | null;
  bed_capacity_max?: number | null;
  priority?: number | null;
  sales_notes?: string | null;
  is_active?: boolean | null;
}

export interface ProductTargetSegmentSyncResult {
  data: ProductTargetSegment[];
}

export const fetchProductTargetSegments = async (
  productId: string | number
): Promise<ProductTargetSegmentListResult> => {
  const res = await apiFetch(`/api/v5/products/${productId}/target-segments`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_TARGET_SEGMENTS_FAILED'));
  }

  return res.json() as Promise<ProductTargetSegmentListResult>;
};

export const syncProductTargetSegments = async (
  productId: string | number,
  segments: ProductTargetSegmentSyncItem[]
): Promise<ProductTargetSegmentSyncResult> => {
  const res = await apiFetch(`/api/v5/products/${productId}/target-segments-sync`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      segments: (segments || []).map((segment) => ({
        facility_types: Array.isArray(segment.facility_types)
          ? Array.from(new Set(
              segment.facility_types
                .map((value) => normalizeNullableText(value))
                .filter((value): value is string => Boolean(value))
            ))
          : [],
        customer_sector: segment.customer_sector,
        facility_type: normalizeNullableText(segment.facility_type),
        bed_capacity_min: normalizeNullableNumber(segment.bed_capacity_min),
        bed_capacity_max: normalizeNullableNumber(segment.bed_capacity_max),
        priority: normalizeNullableNumber(segment.priority),
        sales_notes: normalizeNullableText(segment.sales_notes),
        is_active: typeof segment.is_active === 'boolean' ? segment.is_active : true,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SYNC_PRODUCT_TARGET_SEGMENTS_FAILED'));
  }

  return res.json() as Promise<ProductTargetSegmentSyncResult>;
};

export const fetchProductQuotationsPage = async (
  query: PaginatedQuery
): Promise<PaginatedResult<ProductQuotationDraftListItem>> =>
  fetchPaginatedList<ProductQuotationDraftListItem>('/api/v5/products/quotations', query);

export const fetchProductQuotation = async (id: string | number): Promise<ProductQuotationDraft> => {
  const res = await apiFetch(`/api/v5/products/quotations/${id}`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_QUOTATION_FAILED'));
  }

  return parseItemJson<ProductQuotationDraft>(res);
};

export const fetchProductQuotationVersionsPage = async (
  id: string | number,
  query: PaginatedQuery
): Promise<PaginatedResult<ProductQuotationVersionRecord>> =>
  fetchPaginatedList<ProductQuotationVersionRecord>(`/api/v5/products/quotations/${id}/versions`, query);

export const fetchProductQuotationVersion = async (
  quotationId: string | number,
  versionId: string | number
): Promise<ProductQuotationVersionDetailRecord> => {
  const res = await apiFetch(`/api/v5/products/quotations/${quotationId}/versions/${versionId}`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_QUOTATION_VERSION_FAILED'));
  }

  return parseItemJson<ProductQuotationVersionDetailRecord>(res);
};

export const fetchProductQuotationEventsPage = async (
  id: string | number,
  query: PaginatedQuery
): Promise<PaginatedResult<ProductQuotationEventRecord>> =>
  fetchPaginatedList<ProductQuotationEventRecord>(`/api/v5/products/quotations/${id}/events`, query);

export const createProductQuotation = async (
  payload: ProductQuotationDraftPayload
): Promise<ProductQuotationDraft> => {
  const res = await apiFetch('/api/v5/products/quotations', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_PRODUCT_QUOTATION_FAILED'));
  }

  return parseItemJson<ProductQuotationDraft>(res);
};

export const updateProductQuotation = async (
  id: string | number,
  payload: ProductQuotationDraftPayload
): Promise<ProductQuotationDraft> => {
  const res = await apiFetch(`/api/v5/products/quotations/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PRODUCT_QUOTATION_FAILED'));
  }

  return parseItemJson<ProductQuotationDraft>(res);
};

export const printStoredProductQuotationWord = async (
  id: string | number
): Promise<DownloadFileResult> => {
  const res = await apiFetch(`/api/v5/products/quotations/${id}/print-word`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'PRINT_STORED_PRODUCT_QUOTATION_WORD_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, `bao_gia_${String(id)}.docx`),
  };
};

export const exportProductQuotationWord = async (
  payload: ProductQuotationExportPayload
): Promise<DownloadFileResult> => {
  const res = await apiFetch('/api/v5/products/quotation/export-word', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_PRODUCT_QUOTATION_WORD_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, buildProductQuotationFallbackFilename(payload, 'docx')),
  };
};

export const exportProductQuotationPdf = async (
  payload: ProductQuotationExportPayload
): Promise<DownloadFileResult> => {
  const res = await apiFetch('/api/v5/products/quotation/export-pdf', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/pdf',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_PRODUCT_QUOTATION_PDF_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, buildProductQuotationFallbackFilename(payload, 'pdf')),
  };
};

export const exportProductQuotationExcel = async (
  payload: ProductQuotationExportPayload
): Promise<DownloadFileResult> => {
  const res = await apiFetch('/api/v5/products/quotation/export-excel', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.ms-excel',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'EXPORT_PRODUCT_QUOTATION_EXCEL_FAILED'));
  }

  const blob = await res.blob();
  return {
    blob,
    filename: resolveDownloadFilename(res, buildProductQuotationFallbackFilename(payload, 'xls')),
  };
};
