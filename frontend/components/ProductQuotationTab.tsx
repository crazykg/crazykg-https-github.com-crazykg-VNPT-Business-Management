import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Customer, Product, ProductPackage } from '../types';
import {
  createProductQuotation,
  exportProductQuotationPdf,
  fetchProductQuotationEventsPage,
  fetchProductQuotation,
  fetchProductQuotationDefaultSettings,
  fetchProductQuotationVersion,
  fetchProductQuotationVersionsPage,
  fetchProductQuotationsPage,
  type ProductQuotationDraft,
  type ProductQuotationDefaultSettingsPayload,
  type ProductQuotationDefaultSettingsRecord,
  type ProductQuotationDraftListItem,
  type ProductQuotationDraftPayload,
  type ProductQuotationEventRecord,
  type ProductQuotationVersionDetailRecord,
  type ProductQuotationVersionRecord,
  printStoredProductQuotationWord,
  updateProductQuotationDefaultSettings,
  updateProductQuotation,
} from '../services/v5Api';
import { SearchableSelect } from './SearchableSelect';
import { openProductQuotationPreview } from '../utils/productQuotationPreview';

interface ProductQuotationTabProps {
  currentUserId?: string | number | null;
  customers?: Customer[];
  products: Product[];
  productPackages?: ProductPackage[];
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

interface ProductQuotationRow {
  id: string;
  catalogValue: string;
  productId: string;
  packageId: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  note: string;
}

interface ProductQuotationSettings {
  scopeSummary: string;
  validityDays: string;
  notesText: string;
  contactLine: string;
  closingMessage: string;
  signatoryTitle: string;
  signatoryUnit: string;
  signatoryName: string;
}

interface QuotationCatalogItem {
  value: string;
  source: 'package' | 'product';
  productId: string;
  packageId: string;
  productCode: string;
  packageCode: string;
  label: string;
  productName: string;
  productShortName: string;
  packageName: string;
  unit: string;
  unitPrice: number;
  description: string;
  searchText: string;
}

type ProductQuotationRowField = 'product' | 'unit' | 'quantity' | 'unitPrice' | 'vatRate' | 'note';
type AuditFilterValue = 'ALL' | 'PRINT' | 'DRAFT_CREATED' | 'DRAFT_UPDATED';

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

const DEFAULT_SCOPE_SUMMARY = 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị';
const DEFAULT_VALIDITY_DAYS = '90';
const DEFAULT_NOTES_TEXT = [
  'Giá cước trên đã bao gồm chi phí vận hành cơ bản và các dịch vụ có liên quan.',
  'Giá cước trên chưa bao gồm chi phí tích hợp với các phần mềm khác, tùy chỉnh chức năng đang có, phát triển chức năng mới hoặc chuyển đổi dữ liệu.',
  'Các yêu cầu ngoài phạm vi tiêu chuẩn sẽ được khảo sát và báo giá bổ sung theo khối lượng thực tế.',
  'Báo giá có hiệu lực trong vòng 90 ngày kể từ ngày ký.',
].join('\n');
const DEFAULT_CONTACT_LINE = 'Ông Phan Văn Rở - Giám đốc - Phòng Giải pháp 2 - Trung tâm Kinh doanh Giải pháp, số điện thoại: 0945.200.052./.';
const DEFAULT_CLOSING_MESSAGE = 'Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ rất mong nhận được sự ủng hộ từ Quý đơn vị và hân hạnh phục vụ!';
const DEFAULT_SIGNATORY_TITLE = 'GIÁM ĐỐC';
const DEFAULT_SIGNATORY_UNIT = 'TRUNG TÂM KINH DOANH GIẢI PHÁP';
const DEFAULT_SIGNATORY_NAME = '';
const DUPLICATE_QUOTATION_ITEM_MESSAGE = 'Không được trùng hạng mục công việc với cùng đơn giá trong một báo giá.';
const DUPLICATE_QUOTATION_ITEM_INLINE_MESSAGE = 'Trùng hạng mục với cùng đơn giá.';
const ZERO_VALUE_QUOTATION_EXPORT_MESSAGE = 'Vui lòng nhập ít nhất một hạng mục có thành tiền lớn hơn 0 trước khi xem hoặc in báo giá.';
const DEFAULT_SENDER_CITY = 'Cần Thơ';
const DEFAULT_GLOBAL_VAT_RATE = 10;
const DRAFT_AUTOSAVE_DELAY_MS = 250;
const RECENT_QUOTATION_LOOKBACK_DAYS = 90;
const HISTORY_LOOKBACK_DAYS = 90; // 3 tháng gần nhất
const QUOTATION_ROW_FIELD_ORDER: ProductQuotationRowField[] = ['product', 'unit', 'quantity', 'unitPrice', 'vatRate', 'note'];
const AUDIT_FILTER_OPTIONS: Array<{ value: AuditFilterValue; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PRINT', label: 'In' },
  { value: 'DRAFT_CREATED', label: 'Tạo nháp' },
  { value: 'DRAFT_UPDATED', label: 'Cập nhật nháp' },
];

const DEFAULT_PRODUCT_QUOTATION_SETTINGS: ProductQuotationSettings = {
  scopeSummary: DEFAULT_SCOPE_SUMMARY,
  validityDays: DEFAULT_VALIDITY_DAYS,
  notesText: DEFAULT_NOTES_TEXT,
  contactLine: DEFAULT_CONTACT_LINE,
  closingMessage: DEFAULT_CLOSING_MESSAGE,
  signatoryTitle: DEFAULT_SIGNATORY_TITLE,
  signatoryUnit: DEFAULT_SIGNATORY_UNIT,
  signatoryName: DEFAULT_SIGNATORY_NAME,
};

const createDefaultQuotationSettings = (): ProductQuotationSettings => ({
  ...DEFAULT_PRODUCT_QUOTATION_SETTINGS,
});

const createRowId = (): string => `quote-row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyRow = (): ProductQuotationRow => ({
  id: createRowId(),
  catalogValue: '',
  productId: '',
  packageId: '',
  productName: '',
  unit: '',
  quantity: '1',
  unitPrice: '0',
  vatRate: '10',
  note: '',
});

const buildRecentQuotationThreshold = (): string =>
  new Date(Date.now() - RECENT_QUOTATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

const isHistoryEligibleQuotation = (
  quotation?: Pick<ProductQuotationDraftListItem, 'total_amount'> | null
): boolean => Number(quotation?.total_amount ?? 0) > 0;

const filterHistoryEligibleQuotations = (
  quotations: ProductQuotationDraftListItem[]
): ProductQuotationDraftListItem[] => quotations.filter((quotation) => isHistoryEligibleQuotation(quotation));

const normalizeDigits = (value: unknown): string => {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return String(Math.max(0, Math.trunc(value)));
  }

  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '0';
  return digits.replace(/^0+(?=\d)/, '') || '0';
};

const readVietnameseThreeDigits = (rawValue: number, full: boolean): string => {
  const value = Math.trunc(Math.max(0, rawValue));
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  const parts: string[] = [];

  if (hundreds > 0 || full) {
    parts.push(`${VI_DIGITS[hundreds]} trăm`);
  }

  if (tens > 1) {
    parts.push(`${VI_DIGITS[tens]} mươi`);
    if (ones === 1) parts.push('mốt');
    else if (ones === 4) parts.push('tư');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(VI_DIGITS[ones]);
    return parts.join(' ').trim();
  }

  if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(VI_DIGITS[ones]);
    return parts.join(' ').trim();
  }

  if (ones > 0) {
    if (hundreds > 0 || full) {
      parts.push('lẻ');
    }
    parts.push(VI_DIGITS[ones]);
  }

  return parts.join(' ').trim();
};

const buildVietnameseMoneyParts = (value: unknown): string[] => {
  const digits = normalizeDigits(value);
  if (!digits || /^0+$/.test(digits)) {
    return [];
  }

  const groups: number[] = [];
  for (let index = digits.length; index > 0; index -= 3) {
    const start = Math.max(0, index - 3);
    groups.unshift(Number(digits.slice(start, index)));
  }

  const parts: string[] = [];
  groups.forEach((groupValue, index) => {
    if (groupValue === 0) {
      return;
    }
    const hasNonZeroBefore = groups.slice(0, index).some((item) => item > 0);
    const groupText = readVietnameseThreeDigits(groupValue, hasNonZeroBefore);
    const scale = VI_SCALES[groups.length - 1 - index] || '';
    parts.push(scale ? `${groupText} ${scale}` : groupText);
  });

  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

const toVietnameseMoneyText = (value: unknown): string => {
  const parts = buildVietnameseMoneyParts(value);
  if (parts.length === 0) {
    return 'không đồng';
  }

  const normalizedText = parts.join(' ').replace(/\s+/g, ' ').trim();
  return normalizedText ? `${normalizedText} đồng` : 'không đồng';
};

const toVietnameseMoneyUiText = (value: unknown): string => {
  const parts = buildVietnameseMoneyParts(value);
  if (parts.length === 0) {
    return 'không đồng';
  }

  const normalizedText = parts.join(', ').replace(/\s+/g, ' ').trim();
  return normalizedText ? `${normalizedText} đồng` : 'không đồng';
};

const capitalizeFirstLetter = (value: string): string => {
  const normalized = String(value || '');
  if (normalized === '') {
    return '';
  }

  return normalized.charAt(0).toLocaleUpperCase('vi-VN') + normalized.slice(1);
};

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const normalizeMoneyInput = (value: string): string => normalizeDigits(value);

const formatMoneyInputValue = (value: string): string => formatMoney(Number(normalizeMoneyInput(value)));

const formatThousandsWithDots = (digits: string): string => {
  const normalized = digits.replace(/^0+(?=\d)/, '') || '0';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const normalizeDraftSettings = (draft?: Partial<ProductQuotationDraft> | null): ProductQuotationSettings => {
  const defaults = createDefaultQuotationSettings();

  return {
    scopeSummary: String(draft?.scope_summary || '').trim() || defaults.scopeSummary,
    validityDays: String(draft?.validity_days ?? defaults.validityDays),
    notesText: String(draft?.notes_text || '').trim() || defaults.notesText,
    contactLine: String(draft?.contact_line || '').trim() || defaults.contactLine,
    closingMessage: String(draft?.closing_message || '').trim() || defaults.closingMessage,
    signatoryTitle: String(draft?.signatory_title || '').trim() || defaults.signatoryTitle,
    signatoryUnit: String(draft?.signatory_unit || '').trim() || defaults.signatoryUnit,
    signatoryName: String(draft?.signatory_name || '').trim(),
  };
};

const hasReusableQuotationSettingsUser = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  return String(value).trim() !== '';
};

const buildDefaultQuotationSettingsPayload = (
  settings: ProductQuotationSettings
): ProductQuotationDefaultSettingsPayload => ({
  scope_summary: settings.scopeSummary.trim(),
  validity_days: Math.max(1, Math.trunc(parsePositiveNumber(settings.validityDays) || 90)),
  notes_text: settings.notesText,
  contact_line: settings.contactLine.trim(),
  closing_message: settings.closingMessage.trim(),
  signatory_title: settings.signatoryTitle.trim(),
  signatory_unit: settings.signatoryUnit.trim(),
  signatory_name: settings.signatoryName.trim(),
});

const createDefaultQuotationDraftPayload = (
  settings: ProductQuotationSettings = createDefaultQuotationSettings()
): ProductQuotationDraftPayload => ({
  recipient_name: '',
  sender_city: DEFAULT_SENDER_CITY,
  scope_summary: settings.scopeSummary.trim(),
  vat_rate: DEFAULT_GLOBAL_VAT_RATE,
  validity_days: Math.max(1, Math.trunc(parsePositiveNumber(settings.validityDays) || 90)),
  notes_text: settings.notesText,
  contact_line: settings.contactLine.trim(),
  closing_message: settings.closingMessage.trim(),
  signatory_title: settings.signatoryTitle.trim(),
  signatory_unit: settings.signatoryUnit.trim(),
  signatory_name: settings.signatoryName.trim(),
  items: [],
});

const formatQuantityInputValue = (value: number): string => sanitizeQuantityInput(formatMoney(Number(value || 0)));

const buildPayloadSnapshot = (payload: ProductQuotationDraftPayload): string =>
  JSON.stringify(payload);

const calculateDraftPayloadSubtotal = (payload: ProductQuotationDraftPayload): number =>
  (Array.isArray(payload.items) ? payload.items : []).reduce((sum, item) => {
    const quantity = Number(item?.quantity ?? 0);
    const unitPrice = Number(item?.unit_price ?? 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      return sum;
    }

    return sum + Math.max(0, quantity) * Math.max(0, unitPrice);
  }, 0);

const canPersistQuotationDraft = (payload: ProductQuotationDraftPayload): boolean =>
  Array.isArray(payload.items) && payload.items.length > 0 && calculateDraftPayloadSubtotal(payload) > 0;

const buildSnapshotFromDraftDetail = (draft: ProductQuotationDraft): string =>
  buildPayloadSnapshot({
    customer_id: draft.customer_id ?? null,
    recipient_name: String(draft.recipient_name || ''),
    sender_city: String(draft.sender_city || '') || DEFAULT_SENDER_CITY,
    quote_date: draft.quote_date ?? null,
    scope_summary: String(draft.scope_summary || ''),
    vat_rate: draft.vat_rate ?? DEFAULT_GLOBAL_VAT_RATE,
    validity_days: Number(draft.validity_days || DEFAULT_VALIDITY_DAYS),
    notes_text: String(draft.notes_text || ''),
    contact_line: String(draft.contact_line || ''),
    closing_message: String(draft.closing_message || ''),
    signatory_title: String(draft.signatory_title || ''),
    signatory_unit: String(draft.signatory_unit || ''),
    signatory_name: String(draft.signatory_name || ''),
    items: [...(draft.items || [])]
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      .map((item) => ({
        product_id: item.product_id ?? null,
        package_id: item.package_id ?? null,
        product_name: String(item.product_name || ''),
        unit: String(item.unit || ''),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        vat_rate: item.vat_rate ?? null,
        note: String(item.note || ''),
      })),
  });

const sanitizeQuantityInput = (value: string): string => {
  const raw = String(value ?? '')
    .replace(/[^\d,.\s]/g, '')
    .replace(/\s+/g, '');

  if (raw === '') {
    return '';
  }

  const commaIndex = raw.indexOf(',');
  const hasComma = commaIndex >= 0;
  const integerDigits = (hasComma ? raw.slice(0, commaIndex) : raw).replace(/\D/g, '');

  if (!hasComma) {
    if (integerDigits === '') {
      return '';
    }

    return formatThousandsWithDots(integerDigits);
  }

  const formattedInteger = integerDigits === '' ? '0' : formatThousandsWithDots(integerDigits);
  const decimalDigits = raw
    .slice(commaIndex + 1)
    .replace(/\D/g, '')
    .slice(0, 2);

  if (raw.endsWith(',') && decimalDigits === '') {
    return `${formattedInteger},`;
  }

  return decimalDigits === '' ? formattedInteger : `${formattedInteger},${decimalDigits}`;
};

const parseQuantityInput = (value: string): number => {
  const sanitized = sanitizeQuantityInput(value);
  if (sanitized === '' || sanitized === '0,') {
    return 0;
  }

  const canonical = sanitized.replace(/\./g, '').replace(',', '.');
  const parsed = Number(canonical);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

const sanitizeVatRateInput = (value: string): string => {
  const raw = String(value ?? '')
    .replace(/[^\d,.\s]/g, '')
    .replace(/\s+/g, '');

  if (raw === '') {
    return '';
  }

  const separatorMatch = raw.match(/[,.]/);
  const separatorIndex = separatorMatch ? separatorMatch.index ?? -1 : -1;
  const integerDigits = (separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw).replace(/\D/g, '');
  const normalizedInteger = integerDigits.replace(/^0+(?=\d)/, '') || '0';

  if (separatorIndex < 0) {
    return normalizedInteger;
  }

  const decimalDigits = raw
    .slice(separatorIndex + 1)
    .replace(/\D/g, '')
    .slice(0, 2);

  if ((raw.endsWith(',') || raw.endsWith('.')) && decimalDigits === '') {
    return `${normalizedInteger},`;
  }

  return decimalDigits === '' ? normalizedInteger : `${normalizedInteger},${decimalDigits}`;
};

const parseOptionalVatRateInput = (value: string): number | null => {
  const sanitized = sanitizeVatRateInput(value);
  if (sanitized === '') {
    return null;
  }

  const parsed = Number(sanitized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const buildQuotationItemDuplicateKey = (productName: string, unitPrice: string): string => {
  const normalizedName = String(productName || '').trim().toLocaleLowerCase('vi-VN');
  const normalizedPrice = normalizeMoneyInput(unitPrice);

  if (!normalizedName || normalizedPrice === '') {
    return '';
  }

  return `${normalizedName}::${normalizedPrice}`;
};

const formatMoney = (value: number): string =>
  value.toLocaleString('vi-VN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return 'Chưa có dữ liệu';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const resolveQuotationWorkItemLabel = (product?: Partial<Product> | null): string => {
  const productShortName = String(product?.product_short_name || '').trim();
  if (productShortName !== '') {
    return productShortName;
  }

  const packageName = String(product?.package_name || '').trim();
  if (packageName !== '') {
    return packageName;
  }

  const productName = String(product?.product_name || '').trim();
  if (productName !== '') {
    return productName;
  }

  return String(product?.product_code || '').trim();
};

const resolveQuotationWorkItemNote = (product?: Partial<Product> | null): string => {
  const workItemLabel = resolveQuotationWorkItemLabel(product);
  const productName = String(product?.product_name || '').trim();
  const description = String(product?.description || '').trim();

  return [productName !== '' && productName !== workItemLabel ? productName : '', description]
    .filter(Boolean)
    .join('\n');
};

const resolveQuotationPackageLabel = (
  productPackage?: Partial<ProductPackage> | null,
  parentProduct?: Partial<Product> | null
): string => {
  const packageName = String(productPackage?.package_name || '').trim();
  if (packageName !== '') {
    return packageName;
  }

  const productShortName = String(parentProduct?.product_short_name || '').trim();
  if (productShortName !== '') {
    return productShortName;
  }

  const productName = String(productPackage?.product_name || parentProduct?.product_name || '').trim();
  if (productName !== '') {
    return productName;
  }

  return String(productPackage?.package_code || parentProduct?.product_code || '').trim();
};

const resolveQuotationPackageNote = (
  productPackage?: Partial<ProductPackage> | null,
  parentProduct?: Partial<Product> | null
): string => {
  const workItemLabel = resolveQuotationPackageLabel(productPackage, parentProduct);
  const productName = String(productPackage?.product_name || parentProduct?.product_name || '').trim();
  const description = String(productPackage?.description || '').trim();

  return [productName !== '' && productName !== workItemLabel ? productName : '', description]
    .filter(Boolean)
    .join('\n');
};

const normalizeQuotationCatalogLookupValue = (value: unknown): string =>
  String(value ?? '').trim().toLocaleLowerCase('vi-VN');

const buildQuotationCatalogLookupKey = (productId: string, value: unknown): string => {
  const normalizedProductId = String(productId || '').trim();
  const normalizedValue = normalizeQuotationCatalogLookupValue(value);
  if (normalizedProductId === '' || normalizedValue === '') {
    return '';
  }

  return `${normalizedProductId}::${normalizedValue}`;
};

const buildQuotationCatalogLookupCandidates = (item: QuotationCatalogItem): string[] =>
  Array.from(
    new Set(
      [
        item.label,
        item.productName,
        item.productShortName,
        item.packageName,
        item.productCode,
        item.packageCode,
      ]
        .map((value) => buildQuotationCatalogLookupKey(item.productId, value))
        .filter(Boolean)
    )
  );

const formatQuotationOptionLabel = (quotation: ProductQuotationDraftListItem): string => {
  const recipient = String(quotation.recipient_name || '').trim();
  return recipient !== '' ? recipient : `Báo giá #${quotation.id}`;
};

const formatActorLabel = (
  value?: number | null,
  actor?: { user_code?: string | null; full_name?: string | null; username?: string | null } | null
): string => {
  const actorCode = String(actor?.user_code || '').trim();
  const actorName = String(actor?.full_name || actor?.username || '').trim();

  if (actorCode !== '' && actorName !== '') {
    return `User: ${actorCode} - ${actorName}`;
  }

  if (actorName !== '') {
    return `User: ${actorName}`;
  }

  if (!Number.isFinite(Number(value))) {
    return 'Hệ thống';
  }

  return `User #${Number(value)}`;
};

const formatHashPreview = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  if (normalized === '') {
    return 'Chưa có hash';
  }

  return normalized.length <= 18 ? normalized : `${normalized.slice(0, 10)}...${normalized.slice(-6)}`;
};

const getTemplateLabel = (templateKey?: string | null): string => {
  if (templateKey === 'multi_vat') {
    return 'Mẫu nhiều VAT';
  }

  return 'Mẫu chuẩn';
};

const getVersionStatusMeta = (status?: string | null): { label: string; className: string } => {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return {
        label: 'Thành công',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'FAILED':
      return {
        label: 'Lỗi',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    case 'PENDING':
      return {
        label: 'Đang xử lý',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    default:
      return {
        label: String(status || 'Chưa rõ'),
        className: 'border-slate-200 bg-slate-100 text-slate-600',
      };
  }
};

const getEventStatusMeta = (status?: string | null): { label: string; className: string } => {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return {
        label: 'Thành công',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'FAILED':
      return {
        label: 'Thất bại',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    default:
      return {
        label: String(status || 'Ghi nhận'),
        className: 'border-slate-200 bg-slate-100 text-slate-600',
      };
  }
};

const getEventTypeLabel = (eventType?: string | null): string => {
  switch (String(eventType || '').toUpperCase()) {
    case 'DRAFT_CREATED':
      return 'Tạo nháp';
    case 'DRAFT_UPDATED':
      return 'Cập nhật nháp';
    case 'PRINT_CONFIRMED':
      return 'Xác nhận in';
    case 'PRINT_FAILED':
      return 'In lỗi';
    default:
      return String(eventType || 'Sự kiện');
  }
};

const matchesAuditFilter = (eventType: string | null | undefined, filterValue: AuditFilterValue): boolean => {
  const normalizedType = String(eventType || '').toUpperCase();

  if (filterValue === 'ALL') {
    return true;
  }

  if (filterValue === 'PRINT') {
    return normalizedType === 'PRINT_CONFIRMED' || normalizedType === 'PRINT_FAILED';
  }

  return normalizedType === filterValue;
};

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
};

export const ProductQuotationTab: React.FC<ProductQuotationTabProps> = ({
  currentUserId,
  customers = [],
  products = [],
  productPackages = [],
  onNotify,
}: ProductQuotationTabProps) => {
  const activeProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.is_active !== false)
        .sort((left, right) =>
          resolveQuotationWorkItemLabel(left).localeCompare(resolveQuotationWorkItemLabel(right), 'vi')
        ),
    [products]
  );

  const allProductsById = useMemo(
    () =>
      new Map(
        products.map((product) => [
          String(product.id),
          product,
        ])
      ),
    [products]
  );

  const activeProductPackages = useMemo(
    () =>
      [...productPackages]
        .filter((productPackage) => productPackage.is_active !== false)
        .sort((left, right) => {
          const leftParent = allProductsById.get(String(left.product_id));
          const rightParent = allProductsById.get(String(right.product_id));

          return resolveQuotationPackageLabel(left, leftParent).localeCompare(
            resolveQuotationPackageLabel(right, rightParent),
            'vi'
          );
        }),
    [allProductsById, productPackages]
  );

  const quotationCatalog = useMemo<QuotationCatalogItem[]>(() => {
    if (activeProductPackages.length > 0) {
      const packageCatalogItems = activeProductPackages.map((productPackage) => {
        const parentProduct = allProductsById.get(String(productPackage.product_id));
        const label = resolveQuotationPackageLabel(productPackage, parentProduct);
        const productName = String(productPackage.product_name || parentProduct?.product_name || '').trim();
        const productShortName = String(parentProduct?.product_short_name || '').trim();
        const packageName = String(productPackage.package_name || '').trim();
        const productCode = String(parentProduct?.product_code || productPackage.parent_product_code || '').trim();
        const packageCode = String(productPackage.package_code || '').trim();
        const description = String(productPackage.description || '').trim();
        const unitPrice = Number(productPackage.standard_price || 0);

        return {
          value: `package:${String(productPackage.id)}`,
          source: 'package' as const,
          productId: String(productPackage.product_id || ''),
          packageId: String(productPackage.id || ''),
          productCode,
          packageCode,
          label,
          productName,
          productShortName,
          packageName,
          unit: String(productPackage.unit || '').trim(),
          unitPrice,
          description,
          searchText: [
            packageCode,
            packageName,
            productCode,
            productShortName,
            productName,
            description,
            String(productPackage.unit || ''),
            String(unitPrice),
            formatMoney(unitPrice),
            `${formatMoney(unitPrice)} đ`,
          ]
            .filter(Boolean)
            .join(' '),
        };
      });

      const packagedProductIds = new Set(packageCatalogItems.map((catalogItem) => catalogItem.productId));
      const standaloneProductItems = activeProducts
        .filter((product) => !packagedProductIds.has(String(product.id)))
        .map((product) => {
          const label = resolveQuotationWorkItemLabel(product);
          const productName = String(product.product_name || '').trim();
          const productShortName = String(product.product_short_name || '').trim();
          const packageName = String(product.package_name || '').trim();
          const productCode = String(product.product_code || '').trim();
          const description = String(product.description || '').trim();
          const unitPrice = Number(product.standard_price || 0);

          return {
            value: `product:${String(product.id)}`,
            source: 'product' as const,
            productId: String(product.id || ''),
            packageId: '',
            productCode,
            packageCode: '',
            label,
            productName,
            productShortName,
            packageName,
            unit: String(product.unit || '').trim(),
            unitPrice,
            description,
            searchText: [
              productCode,
              productShortName,
              productName,
              packageName,
              description,
              String(product.unit || ''),
              String(unitPrice),
              formatMoney(unitPrice),
              `${formatMoney(unitPrice)} đ`,
            ]
              .filter(Boolean)
              .join(' '),
          };
        });

      return [...packageCatalogItems, ...standaloneProductItems].sort((left, right) =>
        left.label.localeCompare(right.label, 'vi')
      );
    }

    return activeProducts.map((product) => {
      const label = resolveQuotationWorkItemLabel(product);
      const productName = String(product.product_name || '').trim();
      const productShortName = String(product.product_short_name || '').trim();
      const packageName = String(product.package_name || '').trim();
      const productCode = String(product.product_code || '').trim();
      const description = String(product.description || '').trim();
      const unitPrice = Number(product.standard_price || 0);

      return {
        value: `product:${String(product.id)}`,
        source: 'product' as const,
        productId: String(product.id || ''),
        packageId: '',
        productCode,
        packageCode: '',
        label,
        productName,
        productShortName,
        packageName,
        unit: String(product.unit || '').trim(),
        unitPrice,
        description,
        searchText: [
          productCode,
          productShortName,
          productName,
          packageName,
          description,
          String(product.unit || ''),
          String(unitPrice),
          formatMoney(unitPrice),
          `${formatMoney(unitPrice)} đ`,
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [activeProductPackages, activeProducts, allProductsById]);

  const quotationCatalogByValue = useMemo(
    () =>
      new Map(
        quotationCatalog.map((catalogItem) => [
          catalogItem.value,
          catalogItem,
        ])
      ),
    [quotationCatalog]
  );

  const quotationCatalogValuesByProductId = useMemo(() => {
    const nextMap = new Map<string, QuotationCatalogItem[]>();

    quotationCatalog.forEach((catalogItem) => {
      const entries = nextMap.get(catalogItem.productId) ?? [];
      entries.push(catalogItem);
      nextMap.set(catalogItem.productId, entries);
    });

    return nextMap;
  }, [quotationCatalog]);

  const quotationCatalogValueByPackageId = useMemo(() => {
    const nextMap = new Map<string, string>();

    quotationCatalog.forEach((catalogItem) => {
      const packageId = String(catalogItem.packageId || '').trim();
      if (packageId !== '' && !nextMap.has(packageId)) {
        nextMap.set(packageId, catalogItem.value);
      }
    });

    return nextMap;
  }, [quotationCatalog]);

  const quotationCatalogValueByLookupKey = useMemo(() => {
    const nextMap = new Map<string, string>();

    quotationCatalog.forEach((catalogItem) => {
      buildQuotationCatalogLookupCandidates(catalogItem).forEach((lookupKey) => {
        if (!nextMap.has(lookupKey)) {
          nextMap.set(lookupKey, catalogItem.value);
        }
      });
    });

    return nextMap;
  }, [quotationCatalog]);

  const resolveDraftRowCatalogValue = useCallback(
    (item: ProductQuotationDraft['items'][number]): string => {
      const packageId = item.package_id ? String(item.package_id) : '';
      if (packageId !== '') {
        const directPackageMatch = quotationCatalogValueByPackageId.get(packageId);
        if (directPackageMatch) {
          return directPackageMatch;
        }
      }

      const productId = item.product_id ? String(item.product_id) : '';
      if (productId === '') {
        return '';
      }

      const directMatch = quotationCatalogValueByLookupKey.get(
        buildQuotationCatalogLookupKey(productId, item.product_name)
      );
      if (directMatch) {
        return directMatch;
      }

      const unit = String(item.unit || '').trim();
      const unitPrice = Number(item.unit_price || 0);
      const catalogItems = quotationCatalogValuesByProductId.get(productId) ?? [];
      const matchedByPricing = catalogItems.find(
        (catalogItem) =>
          catalogItem.unit === unit &&
          Number(catalogItem.unitPrice || 0) === unitPrice
      );
      if (matchedByPricing) {
        return matchedByPricing.value;
      }

      if (catalogItems.length === 1) {
        return catalogItems[0].value;
      }

      return '';
    },
    [quotationCatalogValueByLookupKey, quotationCatalogValueByPackageId, quotationCatalogValuesByProductId]
  );

  const productById = useMemo(
    () =>
      new Map(
        activeProducts.map((product) => [
          String(product.id),
          product,
        ])
      ),
    [activeProducts]
  );

  const customerById = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          String(customer.id),
          customer,
        ])
      ),
    [customers]
  );

  const productOptions = useMemo(
    () =>
      quotationCatalog.map((catalogItem) => ({
        value: catalogItem.value,
        label: catalogItem.label,
        searchText: catalogItem.searchText,
      })),
    [quotationCatalog]
  );

  const customerOptions = useMemo(
    () =>
      [...customers]
        .sort((left, right) =>
          String(left.customer_name || '').localeCompare(String(right.customer_name || ''), 'vi')
        )
        .map((customer) => ({
          value: String(customer.id),
          label: String(customer.customer_name || '').trim(),
          searchText: [
            customer.customer_code,
            customer.customer_name,
            customer.tax_code,
            customer.address,
          ]
            .filter(Boolean)
            .join(' '),
        }))
        .filter((option) => option.value !== ''),
    [customers]
  );
  const [quotationId, setQuotationId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [senderCity, setSenderCity] = useState(DEFAULT_SENDER_CITY);
  const vatRate = '10';
  const [defaultQuotationSettings, setDefaultQuotationSettings] = useState<ProductQuotationSettings>(() =>
    createDefaultQuotationSettings()
  );
  const [quotationSettings, setQuotationSettings] = useState<ProductQuotationSettings>(() =>
    createDefaultQuotationSettings()
  );
  const [draftSettings, setDraftSettings] = useState<ProductQuotationSettings>(() =>
    createDefaultQuotationSettings()
  );
  const [rows, setRows] = useState<ProductQuotationRow[]>([createEmptyRow()]);
  const [isInitializingDraft, setIsInitializingDraft] = useState(true);
  const [isLoadingQuotationList, setIsLoadingQuotationList] = useState(false);
  const [isLoadingQuotationDetail, setIsLoadingQuotationDetail] = useState(false);
  const [isPersistingDraft, setIsPersistingDraft] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showPrintConfirmModal, setShowPrintConfirmModal] = useState(false);
  const [auditFilter, setAuditFilter] = useState<AuditFilterValue>('ALL');
  const [selectedVersionDetail, setSelectedVersionDetail] = useState<ProductQuotationVersionDetailRecord | null>(null);
  const [isLoadingVersionDetail, setIsLoadingVersionDetail] = useState(false);
  const [versionHistory, setVersionHistory] = useState<ProductQuotationVersionRecord[]>([]);
  const [auditHistory, setAuditHistory] = useState<ProductQuotationEventRecord[]>([]);
  const [versionHistoryTotal, setVersionHistoryTotal] = useState(0);
  const [auditHistoryTotal, setAuditHistoryTotal] = useState(0);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [quotationList, setQuotationList] = useState<ProductQuotationDraftListItem[]>([]);
  const [selectedQuotationOptionValue, setSelectedQuotationOptionValue] = useState('');
  const [isNewQuotationStarted, setIsNewQuotationStarted] = useState(false);
  const recipientOptions = useMemo(() => {
    if (selectedCustomerId !== null || recipientName.trim() === '') {
      return customerOptions;
    }

    const fallbackRecipient = recipientName.trim();
    const hasRecipientOption = customerOptions.some((option) => String(option.value) === fallbackRecipient);

    if (hasRecipientOption) {
      return customerOptions;
    }

    return [
      {
        value: fallbackRecipient,
        label: fallbackRecipient,
        searchText: fallbackRecipient,
      },
      ...customerOptions,
    ];
  }, [customerOptions, recipientName, selectedCustomerId]);
  const hasReusableDefaultSettings = hasReusableQuotationSettingsUser(currentUserId);
  const quotationIdRef = useRef<number | null>(null);
  const payloadRef = useRef<ProductQuotationDraftPayload>(createDefaultQuotationDraftPayload());
  const payloadSnapshotRef = useRef<string>(buildPayloadSnapshot(createDefaultQuotationDraftPayload()));
  const lastSavedSnapshotRef = useRef<string>(payloadSnapshotRef.current);
  const saveTimeoutRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<number | null>>(Promise.resolve<number | null>(null));
  const historyRequestRef = useRef(0);
  const quotationListRequestRef = useRef(0);
  const lastLoadedQuotationFilterKeyRef = useRef<string | null>(null);
  const rowFieldRefs = useRef<Record<string, HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | null>>({});

  const normalizedRows = useMemo(
    () =>
      rows
        .map((row) => {
          const quantity = parseQuantityInput(row.quantity);
          const unitPrice = parsePositiveNumber(row.unitPrice);
          const itemVatRate = parseOptionalVatRateInput(row.vatRate);
          const productName = String(row.productName || '').trim();
          const unit = String(row.unit || '').trim();
          const note = String(row.note || '').trim();
          const lineTotal = quantity * unitPrice;

          return {
            ...row,
            productName,
            unit,
            note,
            quantityValue: quantity,
            unitPriceValue: unitPrice,
            vatRateValue: itemVatRate,
            lineTotal,
          };
        })
        .filter((row) => row.productName !== ''),
    [rows]
  );

  const subtotal = useMemo(
    () => normalizedRows.reduce((sum, row) => sum + row.lineTotal, 0),
    [normalizedRows]
  );
  const vatRateValue = useMemo(() => parsePositiveNumber(vatRate), [vatRate]);
  const vatAmount = useMemo(() => subtotal * (vatRateValue / 100), [subtotal, vatRateValue]);
  const total = subtotal + vatAmount;
  const totalInWords = capitalizeFirstLetter(toVietnameseMoneyUiText(Math.round(total)));
  const duplicateRowIds = useMemo(() => {
    const rowIdsByKey = new Map<string, string[]>();

    rows.forEach((row) => {
      const key = buildQuotationItemDuplicateKey(row.productName, row.unitPrice);
      if (!key) {
        return;
      }

      const rowIds = rowIdsByKey.get(key) ?? [];
      rowIds.push(row.id);
      rowIdsByKey.set(key, rowIds);
    });

    return new Set(
      Array.from(rowIdsByKey.values())
        .filter((rowIds) => rowIds.length > 1)
        .flat()
    );
  }, [rows]);
  const isExporting = isPreparingPreview || isDownloadingWord;
  const latestVersion = versionHistory[0] ?? null;
  const latestAuditEvent = auditHistory[0] ?? null;
  const filteredAuditHistory = useMemo(
    () => auditHistory.filter((event) => matchesAuditFilter(event.event_type, auditFilter)),
    [auditFilter, auditHistory]
  );
  const quotationSelectOptions = useMemo(
    () =>
      quotationList.map((quotation) => ({
        value: String(quotation.id),
        label: formatQuotationOptionLabel(quotation),
        searchText: [
          quotation.id,
          quotation.uuid,
          quotation.recipient_name,
          quotation.status,
          quotation.updated_at,
          quotation.created_at,
          formatMoney(Number(quotation.total_amount || 0)),
          `v${Number(quotation.latest_version_no || 0)}`,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [quotationList]
  );
  const quotationListFilterKey = selectedCustomerId === null ? 'RECENT_ALL_UNITS' : `CUSTOMER:${selectedCustomerId}`;

  const buildRowFieldRefKey = useCallback((rowId: string, field: ProductQuotationRowField): string => `${rowId}:${field}`, []);
  const setRowFieldRef = useCallback(
    (rowId: string, field: ProductQuotationRowField) =>
      (node: HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | null) => {
        const key = buildRowFieldRefKey(rowId, field);
        if (node) {
          rowFieldRefs.current[key] = node;
          return;
        }
        delete rowFieldRefs.current[key];
      },
    [buildRowFieldRefKey]
  );
  const focusRowField = useCallback(
    (rowId: string, field: ProductQuotationRowField) => {
      const key = buildRowFieldRefKey(rowId, field);
      rowFieldRefs.current[key]?.focus();
      window.requestAnimationFrame(() => {
        rowFieldRefs.current[key]?.focus();
        window.requestAnimationFrame(() => {
          rowFieldRefs.current[key]?.focus();
        });
      });
    },
    [buildRowFieldRefKey]
  );

  const currentPayload = useMemo<ProductQuotationDraftPayload>(
    () => ({
      customer_id: selectedCustomerId,
      recipient_name: recipientName.trim(),
      sender_city: senderCity.trim(),
      scope_summary: quotationSettings.scopeSummary.trim(),
      vat_rate: parsePositiveNumber(vatRate),
      validity_days: Math.max(1, Math.trunc(parsePositiveNumber(quotationSettings.validityDays) || 90)),
      notes_text: quotationSettings.notesText,
      contact_line: quotationSettings.contactLine.trim(),
      closing_message: quotationSettings.closingMessage.trim(),
      signatory_title: quotationSettings.signatoryTitle.trim(),
      signatory_unit: quotationSettings.signatoryUnit.trim(),
      signatory_name: quotationSettings.signatoryName.trim(),
      items: normalizedRows.map((row) => ({
        product_id: row.productId ? Number(row.productId) : null,
        package_id: row.packageId ? Number(row.packageId) : null,
        product_name: row.productName,
        unit: row.unit,
        quantity: row.quantityValue,
        unit_price: row.unitPriceValue,
        vat_rate: row.vatRateValue,
        note: row.note,
      })),
    }),
    [normalizedRows, quotationSettings, recipientName, selectedCustomerId, senderCity]
  );
  const currentPayloadSnapshot = useMemo(
    () => buildPayloadSnapshot(currentPayload),
    [currentPayload]
  );
  const canPersistCurrentPayload = useMemo(
    () => canPersistQuotationDraft(currentPayload),
    [currentPayload]
  );

  useEffect(() => {
    quotationIdRef.current = quotationId;
  }, [quotationId]);

  useEffect(() => {
    payloadRef.current = currentPayload;
    payloadSnapshotRef.current = currentPayloadSnapshot;
  }, [currentPayload, currentPayloadSnapshot]);

  const resetDraftEditor = useCallback((
    nextSettings: ProductQuotationSettings = createDefaultQuotationSettings(),
    options: { enableRecipient?: boolean } = {}
  ) => {
    const fallbackSettings = { ...nextSettings };
    const nextSnapshot = buildPayloadSnapshot(createDefaultQuotationDraftPayload(fallbackSettings));

    quotationIdRef.current = null;
    lastSavedSnapshotRef.current = nextSnapshot;
    payloadSnapshotRef.current = nextSnapshot;
    setQuotationId(null);
    setSelectedQuotationOptionValue('');
    setSelectedCustomerId(null);
    setRecipientName('');
    setSenderCity(DEFAULT_SENDER_CITY);
    setQuotationSettings(fallbackSettings);
    setDraftSettings(fallbackSettings);
    setRows([createEmptyRow()]);
    setIsNewQuotationStarted(Boolean(options.enableRecipient));
    setSelectedVersionDetail(null);
    setVersionHistory([]);
    setAuditHistory([]);
    setVersionHistoryTotal(0);
    setAuditHistoryTotal(0);
    setHistoryError(null);
    setAuditFilter('ALL');
    setShowExportMenu(false);
    setShowPrintConfirmModal(false);
    setShowSettingsDrawer(false);
  }, []);

  const applyDraftDetail = useCallback((draft: ProductQuotationDraft) => {
    const nextSettings = normalizeDraftSettings(draft);
    const nextRows = draft.items.length > 0
      ? [...draft.items]
          .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
          .map((item) => ({
            id: String(item.id || createRowId()),
            catalogValue: resolveDraftRowCatalogValue(item),
            productId: item.product_id ? String(item.product_id) : '',
            packageId: item.package_id ? String(item.package_id) : '',
            productName: String(item.product_name || ''),
            unit: String(item.unit || ''),
            quantity: formatQuantityInputValue(Number(item.quantity || 0)),
            unitPrice: String(Number(item.unit_price || 0)),
            vatRate: item.vat_rate === null || typeof item.vat_rate === 'undefined'
              ? ''
              : sanitizeVatRateInput(String(item.vat_rate)),
            note: String(item.note || ''),
          }))
      : [createEmptyRow()];
    const nextSnapshot = buildSnapshotFromDraftDetail(draft);

    quotationIdRef.current = draft.id;
    lastSavedSnapshotRef.current = nextSnapshot;
    payloadSnapshotRef.current = nextSnapshot;
    setQuotationId(draft.id);
    setSelectedQuotationOptionValue(String(draft.id));
    setSelectedCustomerId(typeof draft.customer_id === 'number' ? draft.customer_id : null);
    setRecipientName(String(draft.recipient_name || ''));
    setSenderCity(String(draft.sender_city || '').trim() || DEFAULT_SENDER_CITY);
    setQuotationSettings(nextSettings);
    setDraftSettings(nextSettings);
    setRows(nextRows);
    setIsNewQuotationStarted(true);
    setSelectedVersionDetail(null);
    setAuditFilter('ALL');
    setShowSettingsDrawer(false);
    setShowPrintConfirmModal(false);
    setShowExportMenu(false);
  }, [resolveDraftRowCatalogValue]);

  const loadQuotationList = useCallback(
    async ({ notifyOnError = false }: { notifyOnError?: boolean } = {}): Promise<ProductQuotationDraftListItem[]> => {
      const requestId = quotationListRequestRef.current + 1;
      quotationListRequestRef.current = requestId;
      lastLoadedQuotationFilterKeyRef.current = quotationListFilterKey;
      setIsLoadingQuotationList(true);

      try {
        const query = selectedCustomerId === null
          ? {
              page: 1,
              per_page: 200,
              sort_by: 'updated_at',
              sort_dir: 'desc' as const,
              filters: {
                updated_from: buildRecentQuotationThreshold(),
                history_only: true,
              },
            }
          : {
              page: 1,
              per_page: 200,
              sort_by: 'updated_at',
              sort_dir: 'desc' as const,
              filters: {
                customer_id: selectedCustomerId,
                history_only: true,
              },
            };
        const listResult = await fetchProductQuotationsPage(query);
        const nextList = filterHistoryEligibleQuotations(
          Array.isArray(listResult.data) ? listResult.data : []
        );

        if (quotationListRequestRef.current === requestId) {
          setQuotationList(nextList);
        }

        return nextList;
      } catch (error) {
        if (quotationListRequestRef.current === requestId) {
          setQuotationList([]);
        }
        if (notifyOnError) {
          onNotify?.(
            'error',
            'Báo giá',
            error instanceof Error ? error.message : 'Không thể tải danh sách báo giá.'
          );
        }
        return [];
      } finally {
        if (quotationListRequestRef.current === requestId) {
          setIsLoadingQuotationList(false);
        }
      }
    },
    [onNotify, quotationListFilterKey, selectedCustomerId]
  );
  const loadQuotationListRef = useRef(loadQuotationList);

  useEffect(() => {
    loadQuotationListRef.current = loadQuotationList;
  }, [loadQuotationList]);

  const persistDraftSnapshot = useCallback(
    async (
      payload: ProductQuotationDraftPayload,
      snapshot: string,
      { notifyOnError = true, force = false }: { notifyOnError?: boolean; force?: boolean } = {}
    ): Promise<number | null> => {
      const executeSave = async (): Promise<number | null> => {
        const activeQuotationId = quotationIdRef.current;

        if (!force && snapshot === lastSavedSnapshotRef.current) {
          return activeQuotationId;
        }

        if (!canPersistQuotationDraft(payload)) {
          return activeQuotationId;
        }

        setIsPersistingDraft(true);
        try {
          if (activeQuotationId === null) {
            const created = await createProductQuotation(payload);
            quotationIdRef.current = created.id;
            setQuotationId(created.id);
            setSelectedQuotationOptionValue(String(created.id));
            lastSavedSnapshotRef.current = snapshot;
            await loadQuotationList();
            return created.id;
          }

          await updateProductQuotation(activeQuotationId, payload);
          lastSavedSnapshotRef.current = snapshot;
          return activeQuotationId;
        } catch (error) {
          if (notifyOnError) {
            onNotify?.(
              'error',
              'Báo giá',
              error instanceof Error ? error.message : 'Không thể lưu nháp báo giá vào cơ sở dữ liệu.'
            );
          }
          return null;
        } finally {
          setIsPersistingDraft(false);
        }
      };

      const queuedSave = saveQueueRef.current.then(executeSave, executeSave);
      saveQueueRef.current = queuedSave.then((savedId) => savedId, () => null);
      return queuedSave;
    },
    [loadQuotationList, onNotify]
  );

  const persistDraft = useCallback(
    async ({ notifyOnError = true, force = false }: { notifyOnError?: boolean; force?: boolean } = {}): Promise<number | null> =>
      persistDraftSnapshot(payloadRef.current, payloadSnapshotRef.current, { notifyOnError, force }),
    [persistDraftSnapshot]
  );

  const flushPendingDraftSave = useCallback(
    async (notifyOnError = true): Promise<number | null> => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      return persistDraft({ notifyOnError });
    },
    [persistDraft]
  );

  const loadQuotationHistory = useCallback(
    async (
      targetQuotationId: number | null,
      { notifyOnError = false }: { notifyOnError?: boolean } = {}
    ): Promise<void> => {
      if (targetQuotationId === null) {
        setVersionHistory([]);
        setAuditHistory([]);
        setVersionHistoryTotal(0);
        setAuditHistoryTotal(0);
        setHistoryError(null);
        return;
      }

      const requestId = historyRequestRef.current + 1;
      historyRequestRef.current = requestId;
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const historyCreatedFrom = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const [versionsResult, eventsResult] = await Promise.all([
          fetchProductQuotationVersionsPage(targetQuotationId, {
            page: 1,
            per_page: 50,
            filters: { created_from: historyCreatedFrom },
          }),
          fetchProductQuotationEventsPage(targetQuotationId, {
            page: 1,
            per_page: 50,
            filters: { created_from: historyCreatedFrom },
          }),
        ]);

        if (historyRequestRef.current !== requestId) {
          return;
        }

        setVersionHistory(versionsResult.data);
        setAuditHistory(eventsResult.data);
        setVersionHistoryTotal(Number(versionsResult.meta?.total || versionsResult.data.length || 0));
        setAuditHistoryTotal(Number(eventsResult.meta?.total || eventsResult.data.length || 0));
      } catch (error) {
        if (historyRequestRef.current !== requestId) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Không thể tải lịch sử báo giá.';
        setHistoryError(message);
        setVersionHistory([]);
        setAuditHistory([]);
        setVersionHistoryTotal(0);
        setAuditHistoryTotal(0);
        if (notifyOnError) {
          onNotify?.('error', 'Báo giá', message);
        }
      } finally {
        if (historyRequestRef.current === requestId) {
          setIsLoadingHistory(false);
        }
      }
    },
    [onNotify]
  );

  useEffect(() => {
    let isActive = true;

    const bootstrapDraft = async () => {
      setIsInitializingDraft(true);
      try {
        let nextDefaultSettings = createDefaultQuotationSettings();

        if (hasReusableDefaultSettings) {
          try {
            const defaultSettings = await fetchProductQuotationDefaultSettings();
            if (!isActive) {
              return;
            }

            nextDefaultSettings = normalizeDraftSettings(
              defaultSettings as Partial<ProductQuotationDraft> & Partial<ProductQuotationDefaultSettingsRecord>
            );
          } catch (error) {
            if (!isActive) {
              return;
            }

            onNotify?.(
              'error',
              'Báo giá',
              error instanceof Error ? error.message : 'Không thể tải cấu hình mặc định báo giá.'
            );
          }
        }

        setDefaultQuotationSettings(nextDefaultSettings);
        resetDraftEditor(nextDefaultSettings);
        await loadQuotationListRef.current();
        if (!isActive) {
          return;
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        onNotify?.(
          'error',
          'Báo giá',
          error instanceof Error ? error.message : 'Không thể tải danh sách báo giá từ cơ sở dữ liệu.'
        );
      } finally {
        if (isActive) {
          setIsInitializingDraft(false);
        }
      }
    };

    void bootstrapDraft();

    return () => {
      isActive = false;
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasReusableDefaultSettings, onNotify, resetDraftEditor]);

  useEffect(() => {
    if (isInitializingDraft) {
      return;
    }

    if (lastLoadedQuotationFilterKeyRef.current === quotationListFilterKey) {
      return;
    }

    void loadQuotationList();
  }, [isInitializingDraft, loadQuotationList, quotationListFilterKey]);

  useEffect(() => {
    if (isInitializingDraft) {
      return;
    }

    if (currentPayloadSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (!canPersistCurrentPayload) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void persistDraft({ notifyOnError: false });
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [canPersistCurrentPayload, currentPayloadSnapshot, isInitializingDraft, persistDraft]);

  useEffect(() => {
    void loadQuotationHistory(quotationId);
  }, [loadQuotationHistory, quotationId]);

  const addRow = () => {
    if (!(selectedCustomerId !== null || (quotationId !== null && recipientName.trim() !== ''))) {
      return;
    }
    setRows((current) => [...current, createEmptyRow()]);
  };

  const focusNextRowProductField = useCallback(
    (rowIndex: number) => {
      const nextRow = rows[rowIndex + 1];
      if (nextRow) {
        focusRowField(nextRow.id, 'product');
        return;
      }

      const nextRowDraft = createEmptyRow();
      setRows((current) => [...current, nextRowDraft]);
      focusRowField(nextRowDraft.id, 'product');
    },
    [focusRowField, rows]
  );

  const focusNextRowField = useCallback(
    (rowIndex: number, field: ProductQuotationRowField) => {
      const currentFieldIndex = QUOTATION_ROW_FIELD_ORDER.indexOf(field);
      if (currentFieldIndex < 0) {
        return;
      }

      if (currentFieldIndex === QUOTATION_ROW_FIELD_ORDER.length - 1) {
        focusNextRowProductField(rowIndex);
        return;
      }

      const nextField = QUOTATION_ROW_FIELD_ORDER[currentFieldIndex + 1];
      const currentRow = rows[rowIndex];
      if (!currentRow) {
        return;
      }

      focusRowField(currentRow.id, nextField);
    },
    [focusNextRowProductField, focusRowField, rows]
  );

  const handleRowFieldEnter = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, rowIndex: number, field: ProductQuotationRowField) => {
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const nativeEvent = event.nativeEvent as KeyboardEvent | undefined;
      if (nativeEvent?.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      focusNextRowField(rowIndex, field);
    },
    [focusNextRowField]
  );

  const removeRow = (rowId: string) => {
    setRows((current) => {
      if (current.length === 1) {
        return [createEmptyRow()];
      }
      return current.filter((row) => row.id !== rowId);
    });
  };

  const updateRow = (rowId: string, updater: (current: ProductQuotationRow) => ProductQuotationRow) => {
    setRows((current) => current.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const updateDraftSettings = <K extends keyof ProductQuotationSettings>(
    field: K,
    value: ProductQuotationSettings[K]
  ) => {
    setDraftSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleOpenSettingsDrawer = () => {
    setShowExportMenu(false);
    setDraftSettings(quotationSettings);
    setShowSettingsDrawer(true);
  };

  const handleCloseSettingsDrawer = () => {
    setDraftSettings(quotationSettings);
    setShowSettingsDrawer(false);
  };

  const handleResetDraftSettings = () => {
    setDraftSettings(defaultQuotationSettings);
  };

  const handleSaveSettings = async () => {
    const nextSettings = { ...draftSettings };
    const nextPayload: ProductQuotationDraftPayload = {
      ...currentPayload,
      scope_summary: nextSettings.scopeSummary.trim(),
      validity_days: Math.max(1, Math.trunc(parsePositiveNumber(nextSettings.validityDays) || 90)),
      notes_text: nextSettings.notesText,
      contact_line: nextSettings.contactLine.trim(),
      closing_message: nextSettings.closingMessage.trim(),
      signatory_title: nextSettings.signatoryTitle.trim(),
      signatory_unit: nextSettings.signatoryUnit.trim(),
      signatory_name: nextSettings.signatoryName.trim(),
    };
    const nextSnapshot = buildPayloadSnapshot(nextPayload);
    const hadUnsavedSettingsChange = nextSnapshot !== lastSavedSnapshotRef.current;
    const shouldPersistDraftSettings = hadUnsavedSettingsChange && canPersistQuotationDraft(nextPayload);

    if (hasReusableDefaultSettings) {
      try {
        await updateProductQuotationDefaultSettings(buildDefaultQuotationSettingsPayload(nextSettings));
      } catch (error) {
        onNotify?.(
          'error',
          'Báo giá',
          error instanceof Error ? error.message : 'Không thể lưu cấu hình mặc định báo giá.'
        );
        return;
      }
    }

    if (shouldPersistDraftSettings) {
      const savedId = await persistDraftSnapshot(nextPayload, nextSnapshot, {
        notifyOnError: true,
        force: hadUnsavedSettingsChange,
      });

      if (savedId === null) {
        return;
      }
    }

    payloadRef.current = nextPayload;
    payloadSnapshotRef.current = nextSnapshot;
    setDefaultQuotationSettings(nextSettings);
    setQuotationSettings(nextSettings);
    setDraftSettings(nextSettings);
    setShowSettingsDrawer(false);
  };

  const handleRecipientChange = (nextValue: string) => {
    const matchedCustomer = customerById.get(String(nextValue));
    if (matchedCustomer) {
      setSelectedCustomerId(Number(matchedCustomer.id));
      setRecipientName(String(matchedCustomer.customer_name || '').trim());
      return;
    }

    setSelectedCustomerId(null);
    setRecipientName(nextValue);
  };

  const handleProductChange = (rowId: string, catalogValue: string) => {
    const catalogItem = quotationCatalogByValue.get(catalogValue);
    updateRow(rowId, (current) => {
      if (!catalogItem) {
        return {
          ...current,
          catalogValue: '',
          productId: '',
          packageId: '',
          productName: '',
          unit: '',
          unitPrice: '0',
          note: '',
        };
      }

      return {
        ...current,
        catalogValue,
        productId: catalogItem.productId,
        packageId: catalogItem.packageId,
        productName: catalogItem.label,
        unit: catalogItem.unit,
        unitPrice: String(Number(catalogItem.unitPrice || 0)),
        vatRate: '10',
        note:
          catalogItem.source === 'package'
            ? resolveQuotationPackageNote(
                {
                  package_code: catalogItem.packageCode,
                  package_name: catalogItem.packageName,
                  product_name: catalogItem.productName,
                  description: catalogItem.description,
                },
                productById.get(catalogItem.productId)
              )
            : resolveQuotationWorkItemNote(productById.get(catalogItem.productId)),
      };
    });
  };

  const handleOpenQuotation = useCallback(
    async (nextValue: string) => {
      const nextQuotationId = Number(nextValue);
      if (!Number.isFinite(nextQuotationId) || nextQuotationId <= 0) {
        return;
      }

      if (quotationIdRef.current === nextQuotationId && payloadSnapshotRef.current === lastSavedSnapshotRef.current) {
        return;
      }

      setShowExportMenu(false);
      setShowPrintConfirmModal(false);
      setShowSettingsDrawer(false);
      setSelectedVersionDetail(null);
      setIsLoadingQuotationDetail(true);

      try {
        const shouldPersistCurrentDraft =
          payloadSnapshotRef.current !== lastSavedSnapshotRef.current &&
          canPersistQuotationDraft(payloadRef.current);
        if (shouldPersistCurrentDraft) {
          const savedId = await flushPendingDraftSave(true);
          if (payloadSnapshotRef.current !== lastSavedSnapshotRef.current && savedId === null) {
            return;
          }
        }

        const detail = await fetchProductQuotation(nextQuotationId);
        applyDraftDetail(detail);
      } catch (error) {
        onNotify?.(
          'error',
          'Báo giá',
          error instanceof Error ? error.message : 'Không thể tải báo giá đã chọn.'
        );
      } finally {
        setIsLoadingQuotationDetail(false);
      }
    },
    [applyDraftDetail, flushPendingDraftSave, onNotify]
  );

  const handleStartNewQuotation = useCallback(async () => {
    const shouldPersistCurrentDraft =
      quotationIdRef.current !== null &&
      payloadSnapshotRef.current !== lastSavedSnapshotRef.current &&
      canPersistQuotationDraft(payloadRef.current);
    if (shouldPersistCurrentDraft) {
      const savedId = await flushPendingDraftSave(true);
      if (savedId === null) {
        return;
      }
    }

    resetDraftEditor(quotationSettings, { enableRecipient: true });
  }, [flushPendingDraftSave, quotationSettings, resetDraftEditor]);

  const validateBeforeExport = (): boolean => {
    if (isLoadingQuotationDetail) {
      onNotify?.('error', 'Báo giá', 'Báo giá đang được tải từ cơ sở dữ liệu. Vui lòng thử lại sau giây lát.');
      return false;
    }

    if (recipientName.trim() === '') {
      onNotify?.('error', 'Báo giá', 'Vui lòng chọn thông tin "Kính gửi" trước khi xuất file.');
      return false;
    }

    if (normalizedRows.length === 0) {
      onNotify?.('error', 'Báo giá', 'Vui lòng chọn ít nhất một sản phẩm trong bảng báo giá.');
      return false;
    }

    if (!canPersistCurrentPayload) {
      onNotify?.('error', 'Báo giá', ZERO_VALUE_QUOTATION_EXPORT_MESSAGE);
      return false;
    }

    if (duplicateRowIds.size > 0) {
      onNotify?.('error', 'Báo giá', DUPLICATE_QUOTATION_ITEM_MESSAGE);
      return false;
    }

    return true;
  };

  const handlePreviewQuotation = async () => {
    setShowExportMenu(false);
    if (!validateBeforeExport()) return;

    try {
      setIsPreparingPreview(true);
      const savedDraftId = await flushPendingDraftSave(true);
      if (savedDraftId === null) {
        return;
      }

      const opened = await openProductQuotationPreview({
        title: 'Xem báo giá',
        loadPdf: async () => {
          const result = await exportProductQuotationPdf(payloadRef.current);
          return result.blob;
        },
      });

      if (!opened) {
        onNotify?.('error', 'Báo giá', 'Trình duyệt đã chặn popup xem báo giá. Vui lòng cho phép mở tab mới.');
      }
    } catch (error) {
      onNotify?.(
        'error',
        'Báo giá',
        error instanceof Error ? error.message : 'Không thể tạo file PDF xem báo giá.'
      );
    } finally {
      setIsPreparingPreview(false);
    }
  };

  const handleRequestPrintQuotation = () => {
    setShowExportMenu(false);
    if (!validateBeforeExport()) return;
    setShowPrintConfirmModal(true);
  };

  const handleConfirmPrintQuotation = async () => {
    setShowPrintConfirmModal(false);

    try {
      const savedDraftId = await flushPendingDraftSave(true);
      if (savedDraftId === null) {
        return;
      }

      setIsDownloadingWord(true);
      const result = await printStoredProductQuotationWord(savedDraftId);
      triggerBrowserDownload(result.blob, result.filename);
      if (String(result.emailStatus || '').toUpperCase() === 'FAILED') {
        const warningMessage = (result.emailMessage || '').trim();
        onNotify?.(
          'error',
          'Báo giá',
          warningMessage !== ''
            ? `Đã tải file Word, nhưng email lưu trữ không gửi được: ${warningMessage}`
            : 'Đã tải file Word, nhưng email lưu trữ không gửi được.'
        );
      }
      await loadQuotationHistory(savedDraftId);
    } catch (error) {
      onNotify?.(
        'error',
        'Báo giá',
        error instanceof Error ? error.message : 'Không thể tải file Word báo giá.'
      );
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleViewVersionDetail = async (versionId: number) => {
    if (quotationId === null) {
      return;
    }

    try {
      setIsLoadingVersionDetail(true);
      const detail = await fetchProductQuotationVersion(quotationId, versionId);
      setSelectedVersionDetail(detail);
    } catch (error) {
      onNotify?.(
        'error',
        'Báo giá',
        error instanceof Error ? error.message : 'Không thể tải chi tiết version báo giá.'
      );
    } finally {
      setIsLoadingVersionDetail(false);
    }
  };

  const hasActiveQuotation = quotationId !== null;
  const canSelectRecipient = isNewQuotationStarted || hasActiveQuotation;
  const canEditLineItems = selectedCustomerId !== null || (hasActiveQuotation && recipientName.trim() !== '');
  const quotationSelectorValue = selectedQuotationOptionValue;
  const selectedRecipientValue =
    selectedCustomerId !== null && customerById.has(String(selectedCustomerId))
      ? String(selectedCustomerId)
      : recipientName;
  const toolbarFieldLabelClassName =
    'mb-1 text-[9px] font-bold uppercase tracking-[0.14em] leading-none';
  const toolbarSelectTriggerClassName =
    '!h-8 !min-h-0 !rounded-md !border !border-slate-200 !bg-slate-50 !px-2.5 !py-0 !text-xs !text-slate-700 shadow-sm hover:!bg-white';
  const quotationRowSelectTriggerClassName =
    '!h-[30px] !min-h-0 !rounded !border !border-slate-300 !bg-white !px-2.5 !py-0 !text-xs !leading-4';
  const quotationMobileRowSelectTriggerClassName =
    '!h-11 !min-h-0 !rounded !border !border-slate-300 !bg-white !px-3 !py-0 !text-sm !leading-4';

  // ── UI-only state: row collapse + duplicate ──
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(() => new Set());
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const toggleRowCollapse = (rowId: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) { next.delete(rowId); } else { next.add(rowId); }
      return next;
    });
  };
  const duplicateRow = (rowId: string) => {
    const source = rows.find((r) => r.id === rowId);
    if (!source) return;
    const newRow = { ...source, id: createRowId() };
    setRows((current) => {
      const idx = current.findIndex((r) => r.id === rowId);
      const next = [...current];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  return (
    <>
      <div className="pb-4 pt-0">
        {/* ── Command bar ── */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div
            className="flex flex-col divide-y divide-slate-100 lg:flex-row lg:items-center lg:divide-x lg:divide-y-0"
            data-testid="quotation-toolbar-row"
          >

            {/* Zone 1+3 — Mở báo giá cũ + Actions (cùng hàng trên mobile) */}
            <div className="flex min-w-0 items-end gap-2 px-3 py-2.5 lg:w-[300px] lg:shrink-0">
              <span className="material-symbols-outlined mb-1 shrink-0 text-slate-400" style={{ fontSize: 18 }}>folder_open</span>
              <div className="min-w-0 flex-1">
                <p className={`${toolbarFieldLabelClassName} text-slate-400`}>Mở báo giá cũ</p>
                <SearchableSelect
                  className="w-full"
                  value={quotationSelectorValue}
                  options={quotationSelectOptions}
                  onChange={(value) => { void handleOpenQuotation(value); }}
                  placeholder={isLoadingQuotationList ? 'Đang tải...' : 'Chọn báo giá'}
                  searchPlaceholder="Tìm báo giá..."
                  noOptionsText="Chưa có báo giá nào"
                  searching={isLoadingQuotationList}
                  disabled={isLoadingQuotationDetail}
                  optionEstimateSize={84}
                  dropdownClassName="max-w-[620px]"
                  portalMinWidth={460}
                  portalMaxWidth={620}
                  usePortal
                  triggerClassName={toolbarSelectTriggerClassName}
                  renderOptionContent={(option, state) => {
                    const quotation = quotationList.find((item) => String(item.id) === String(option.value));
                    return (
                      <div className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-1">
                        <div className="min-w-0 flex-1 text-left">
                          <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900">{option.label}</p>
                          <p className="mt-1 text-xs text-slate-500">Cập nhật: {formatDateTime(quotation?.updated_at || quotation?.created_at)}</p>
                        </div>
                        <div className="min-w-[116px] shrink-0 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tổng tiền</p>
                          <p className={`mt-1 whitespace-nowrap text-sm font-bold ${state.isSelected ? 'text-primary' : 'text-slate-900'}`}>
                            {formatMoney(Number(quotation?.total_amount || 0))} đ
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            v{Number(quotation?.latest_version_no || 0)}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
              {/* Actions — hiển thị inline bên phải trên mobile, ẩn ở lg (Zone 3 riêng) */}
              <div className="mb-0.5 flex shrink-0 items-center gap-1.5 lg:hidden">
                <button
                  type="button"
                  onClick={() => { void handleStartNewQuotation(); }}
                  disabled={isPersistingDraft || isLoadingQuotationDetail}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  title="Thêm báo giá mới"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((current) => !current)}
                    disabled={isExporting || isLoadingQuotationDetail}
                    aria-haspopup="menu"
                    aria-expanded={showExportMenu}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                    title={isExporting ? 'Đang chuẩn bị...' : 'Xuất báo giá'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                        <button type="button" aria-label="Xem báo giá" onClick={() => { void handlePreviewQuotation(); }} disabled={isPreparingPreview}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                          <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>visibility</span>Xem báo giá
                        </button>
                        <button type="button" aria-label="In báo giá" onClick={() => { handleRequestPrintQuotation(); }} disabled={isDownloadingWord}
                          className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                          <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>description</span>In báo giá
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Zone 2 — Kính gửi */}
            <div className={`flex min-w-0 flex-1 items-end gap-2.5 px-3 py-2.5 transition-colors lg:rounded-none ${
              canSelectRecipient ? 'bg-white' : 'bg-slate-50/60'
            }`}>
              <span className={`material-symbols-outlined mb-1 shrink-0 transition-colors ${
                selectedRecipientValue
                  ? 'text-emerald-500'
                  : canSelectRecipient
                    ? 'text-primary'
                    : 'text-slate-300'
              }`} style={{ fontSize: 18 }}>
                {selectedRecipientValue ? 'check_circle' : canSelectRecipient ? 'business' : 'lock'}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`${toolbarFieldLabelClassName} transition-colors ${
                  canSelectRecipient ? 'text-slate-400' : 'text-slate-300'
                }`}>Kính gửi</p>
                {canSelectRecipient ? (
                  <SearchableSelect
                    className="w-full"
                    value={selectedRecipientValue}
                    options={recipientOptions}
                    onChange={handleRecipientChange}
                    placeholder="Chọn khách hàng..."
                    searchPlaceholder="Tìm khách hàng..."
                    noOptionsText="Không tìm thấy khách hàng"
                    disabled={false}
                    dropdownClassName="max-w-[620px]"
                    portalMinWidth={360}
                    portalMaxWidth={620}
                    usePortal
                    triggerClassName={toolbarSelectTriggerClassName}
                  />
                ) : (
                  <p className="mb-1 h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs italic leading-8 text-slate-400 shadow-sm">Bấm <strong className="font-semibold not-italic text-slate-500">Thêm mới</strong> để bắt đầu</p>
                )}
              </div>
            </div>

            {/* Zone 3 — Actions (chỉ lg+) */}
            <div
              className="hidden shrink-0 items-end gap-2 px-3 py-2.5 lg:ml-auto lg:flex"
              data-testid="quotation-action-row"
            >
              <button
                type="button"
                onClick={() => { void handleStartNewQuotation(); }}
                disabled={isPersistingDraft || isLoadingQuotationDetail}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_circle</span>
                Thêm mới
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((current) => !current)}
                  disabled={isExporting || isLoadingQuotationDetail}
                  aria-haspopup="menu"
                  aria-expanded={showExportMenu}
                  aria-label="Xuất báo giá"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                  {isExporting ? 'Đang chuẩn bị...' : 'Xuất'}
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                      <button
                        type="button"
                        aria-label="Xem báo giá"
                        onClick={() => { void handlePreviewQuotation(); }}
                        disabled={isPreparingPreview}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>visibility</span>
                        Xem báo giá
                      </button>
                      <button
                        type="button"
                        aria-label="In báo giá"
                        onClick={() => { handleRequestPrintQuotation(); }}
                        disabled={isDownloadingWord}
                        className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>description</span>
                        In báo giá
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="space-y-2">
        {/* ── Bảng hạng mục ── */}
        <div className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all ${
          canEditLineItems ? 'border-slate-200' : 'border-dashed border-slate-200'
        }`}>
          <div className={`border-b border-slate-100 px-3 py-1.5 transition-colors ${
            canEditLineItems ? 'bg-slate-50/70' : 'bg-slate-50'
          }`}>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={addRow}
                disabled={!canEditLineItems || isLoadingQuotationDetail}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 14 }}>add</span>
                Thêm dòng
              </button>
            </div>
          </div>
          {/* Locked overlay khi chưa chọn khách hàng */}
          {!canEditLineItems && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
              <span className="text-xs font-semibold">Chọn khách hàng ở bước 1 để thêm hạng mục</span>
            </div>
          )}
          {canEditLineItems && (
          <>
          {/* ── Desktop: table (lg+) ── */}
          <div className="hidden lg:block">
          <div className="max-h-[580px] overflow-auto">
            <table className="w-full min-w-[1240px] table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 324 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 84 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 154 }} />
                <col style={{ width: 286 }} />
                <col style={{ width: 64 }} />
              </colgroup>
              <thead className="bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-200">
                  {['TT', 'Hạng mục công việc', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Thuế VAT', 'Thành tiền', 'Ghi chú', 'Tác vụ'].map((label) => (
                    <th
                      key={label}
                      className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const quantityValue = parseQuantityInput(row.quantity);
                  const unitPriceValue = parsePositiveNumber(row.unitPrice);
                  const lineTotal = quantityValue * unitPriceValue;
                  const isDuplicateCombination = duplicateRowIds.has(row.id);
                  const isCollapsed = collapsedRows.has(row.id);
                  const hasData = row.productName.trim() !== '';

                  if (isCollapsed && hasData) {
                    return (
                      <tr key={row.id} className="cursor-pointer bg-slate-50/60 hover:bg-slate-50 align-middle" onClick={() => toggleRowCollapse(row.id)}>
                        <td className="px-2 py-1.5 text-center text-xs font-semibold text-slate-500">{index + 1}</td>
                        <td colSpan={5} className="px-2 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>chevron_right</span>
                            <span className="truncate text-xs font-semibold text-slate-700">{row.productName}</span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {quantityValue} × {formatMoney(unitPriceValue)} đ
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span className="whitespace-nowrap text-xs font-bold text-slate-900">{formatMoney(lineTotal)} đ</span>
                        </td>
                        <td colSpan={2} className="px-2 py-1.5 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">đã nhập</span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRowCollapse(row.id)}
                          disabled={!hasData}
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                            {isCollapsed ? 'chevron_right' : 'expand_more'}
                          </span>
                        </button>
                        <div className="text-xs font-semibold text-slate-500 leading-none mt-0.5">{index + 1}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect
                          value={row.catalogValue}
                          options={productOptions}
                          onChange={(value) => handleProductChange(row.id, value)}
                          placeholder="Chọn sản phẩm từ danh mục"
                          disabled={!canEditLineItems || isLoadingQuotationDetail}
                          triggerButtonRef={setRowFieldRef(row.id, 'product')}
                          onTriggerKeyDown={(event) => handleRowFieldEnter(event, index, 'product')}
                          optionEstimateSize={92}
                          dropdownClassName="min-w-[560px] max-w-[720px]"
                          portalMinWidth={560}
                          portalMaxWidth={720}
                          usePortal
                          label=""
                          triggerClassName={`${quotationRowSelectTriggerClassName} ${isDuplicateCombination ? '!border-rose-300 ring-1 ring-rose-200' : ''}`}
                          renderOptionContent={(option, state) => {
                            const catalogItem = quotationCatalogByValue.get(String(option.value));
                            const productShortName = String(catalogItem?.productShortName || '').trim();
                            const packageName = String(catalogItem?.packageName || '').trim();
                            const productName = String(catalogItem?.productName || '').trim();
                            const description = String(catalogItem?.description || '').trim();
                            const unitPrice = Number(catalogItem?.unitPrice || 0);
                            const workItemLabel = String(catalogItem?.label || option.label).trim();

                            return (
                              <div className="flex min-h-[72px] items-start justify-between gap-4 py-1">
                                <div className="min-w-0 flex-1 text-left">
                                  <p className="truncate text-sm font-semibold leading-5 text-slate-900">
                                    {workItemLabel}
                                  </p>
                                  {productName !== '' && productName !== workItemLabel ? (
                                    <p className="mt-0.5 truncate text-xs leading-4 text-slate-500">
                                      Sản phẩm: {productName}
                                    </p>
                                  ) : null}
                                  {productShortName && productShortName !== workItemLabel ? (
                                    <p className="mt-0.5 truncate text-xs leading-4 text-slate-500">
                                      Tên ngắn: {productShortName}
                                    </p>
                                  ) : null}
                                  {packageName && packageName !== workItemLabel ? (
                                    <p className="mt-0.5 truncate text-xs leading-4 text-slate-500">
                                      Gói cước: {packageName}
                                    </p>
                                  ) : null}
                                  {catalogItem?.packageCode ? (
                                    <p className="mt-0.5 truncate text-xs leading-4 text-slate-400">
                                      Mã gói: {catalogItem.packageCode}
                                    </p>
                                  ) : null}
                                  {description ? (
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400">
                                      {description}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="shrink-0 self-center text-right">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    Đơn giá
                                  </p>
                                  <p className={`mt-1 whitespace-nowrap text-sm font-bold ${state.isSelected ? 'text-primary' : 'text-slate-900'}`}>
                                    {formatMoney(unitPrice)} đ
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        {isDuplicateCombination ? (
                          <p className="mt-1 text-[10px] font-semibold text-error">
                            {DUPLICATE_QUOTATION_ITEM_INLINE_MESSAGE}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          ref={setRowFieldRef(row.id, 'unit')}
                          type="text"
                          aria-label={`Đơn vị tính dòng ${index + 1}`}
                          value={row.unit}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({ ...current, unit: event.target.value }))
                          }
                          onKeyDown={(event) => handleRowFieldEnter(event, index, 'unit')}
                          disabled={!canEditLineItems || isLoadingQuotationDetail}
                          className="h-[30px] w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs leading-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          ref={setRowFieldRef(row.id, 'quantity')}
                          type="text"
                          inputMode="decimal"
                          aria-label={`Số lượng dòng ${index + 1}`}
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              quantity: sanitizeQuantityInput(event.target.value),
                            }))
                          }
                          onKeyDown={(event) => handleRowFieldEnter(event, index, 'quantity')}
                          disabled={!canEditLineItems || isLoadingQuotationDetail}
                          className="h-[30px] w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs leading-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          ref={setRowFieldRef(row.id, 'unitPrice')}
                          type="text"
                          inputMode="numeric"
                          aria-label={`Đơn giá dòng ${index + 1}`}
                          value={formatMoneyInputValue(row.unitPrice)}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              unitPrice: normalizeMoneyInput(event.target.value),
                            }))
                          }
                          onKeyDown={(event) => handleRowFieldEnter(event, index, 'unitPrice')}
                          disabled={!canEditLineItems || isLoadingQuotationDetail}
                          className={`h-[30px] w-full rounded border bg-white px-2 py-1 text-right text-xs font-semibold leading-4 text-slate-900 outline-none transition-all focus:ring-1 ${isDuplicateCombination ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:border-primary focus:ring-primary/30'}`}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <div className="relative mx-auto w-full max-w-[78px]">
                          <input
                            ref={setRowFieldRef(row.id, 'vatRate')}
                            type="text"
                            inputMode="decimal"
                            aria-label={`Thuế VAT dòng ${index + 1}`}
                            value={row.vatRate}
                            onChange={(event) =>
                              updateRow(row.id, (current) => ({
                                ...current,
                                vatRate: sanitizeVatRateInput(event.target.value),
                              }))
                            }
                            onKeyDown={(event) => handleRowFieldEnter(event, index, 'vatRate')}
                            disabled={!canEditLineItems || isLoadingQuotationDetail}
                            className="h-[30px] w-full rounded border border-slate-300 bg-white px-1.5 pr-4 text-center text-xs font-semibold text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                            placeholder="0"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[10px] font-semibold text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex h-[30px] items-center justify-end whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-bold leading-4 text-slate-900">
                          {formatMoney(lineTotal)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <textarea
                          ref={setRowFieldRef(row.id, 'note')}
                          aria-label={`Ghi chú dòng ${index + 1}`}
                          value={row.note}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({ ...current, note: event.target.value }))
                          }
                          onKeyDown={(event) => handleRowFieldEnter(event, index, 'note')}
                          rows={2}
                          disabled={!canEditLineItems || isLoadingQuotationDetail}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs leading-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => duplicateRow(row.id)}
                            disabled={!canEditLineItems || isLoadingQuotationDetail || !hasData}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                            title="Nhân đôi dòng này"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={!canEditLineItems || isLoadingQuotationDetail}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-error"
                            title="Xóa dòng"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>{/* end hidden lg:block desktop table */}

          {/* ── Mobile/Tablet: card stack (< lg) ── */}
          <div className="block lg:hidden divide-y divide-slate-100">
            {rows.map((row, index) => {
              const quantityValue = parseQuantityInput(row.quantity);
              const unitPriceValue = parsePositiveNumber(row.unitPrice);
              const lineTotal = quantityValue * unitPriceValue;
              const isDuplicateCombination = duplicateRowIds.has(row.id);
              const isCollapsed = collapsedRows.has(row.id);
              const hasData = row.productName.trim() !== '';

              if (isCollapsed && hasData) {
                return (
                  <div
                    key={row.id}
                    className="flex cursor-pointer items-start gap-2 px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100"
                    onClick={() => toggleRowCollapse(row.id)}
                  >
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-slate-400" style={{ fontSize: 16 }}>chevron_right</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{row.productName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {quantityValue} × {formatMoney(unitPriceValue)} đ
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{formatMoney(lineTotal)} đ</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">đã nhập</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={row.id} className="px-3 py-3 space-y-3">
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleRowCollapse(row.id)}
                        disabled={!hasData}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                        title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
                      </button>
                      <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateRow(row.id)}
                        disabled={!canEditLineItems || isLoadingQuotationDetail || !hasData}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                        title="Nhân đôi dòng"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 17 }}>content_copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={!canEditLineItems || isLoadingQuotationDetail}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-error"
                        title="Xóa dòng"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Sản phẩm */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hạng mục</p>
                    <SearchableSelect
                      value={row.catalogValue}
                      options={productOptions}
                      onChange={(value) => handleProductChange(row.id, value)}
                      placeholder="Chọn sản phẩm từ danh mục"
                      disabled={!canEditLineItems || isLoadingQuotationDetail}
                      optionEstimateSize={92}
                      dropdownClassName="min-w-[320px] max-w-[96vw]"
                      portalMinWidth={320}
                      portalMaxWidth={640}
                      usePortal
                      label=""
                      triggerClassName={`${quotationMobileRowSelectTriggerClassName} ${isDuplicateCombination ? '!border-rose-300 ring-1 ring-rose-200' : ''}`}
                      renderOptionContent={(option, state) => {
                        const catalogItem = quotationCatalogByValue.get(String(option.value));
                        const productShortName = String(catalogItem?.productShortName || '').trim();
                        const packageName = String(catalogItem?.packageName || '').trim();
                        const productName = String(catalogItem?.productName || '').trim();
                        const description = String(catalogItem?.description || '').trim();
                        const unitPrice = Number(catalogItem?.unitPrice || 0);
                        const workItemLabel = String(catalogItem?.label || option.label).trim();
                        return (
                          <div className="flex min-h-[60px] items-center justify-between gap-3 py-1">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{workItemLabel}</p>
                              {productName !== '' && productName !== workItemLabel ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">Sản phẩm: {productName}</p>
                              ) : null}
                              {productShortName && productShortName !== workItemLabel ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">Tên ngắn: {productShortName}</p>
                              ) : null}
                              {packageName && packageName !== workItemLabel ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">Gói cước: {packageName}</p>
                              ) : null}
                              {catalogItem?.packageCode ? (
                                <p className="mt-0.5 truncate text-xs text-slate-400">Mã gói: {catalogItem.packageCode}</p>
                              ) : null}
                              {description ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{description}</p> : null}
                            </div>
                            <p className={`shrink-0 whitespace-nowrap text-sm font-bold ${state.isSelected ? 'text-primary' : 'text-slate-900'}`}>
                              {formatMoney(unitPrice)} đ
                            </p>
                          </div>
                        );
                      }}
                    />
                    {isDuplicateCombination ? (
                      <p className="mt-1 text-[10px] font-semibold text-error">{DUPLICATE_QUOTATION_ITEM_INLINE_MESSAGE}</p>
                    ) : null}
                  </div>

                  {/* Đơn giá */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đơn giá (chưa VAT)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Đơn giá dòng ${index + 1}`}
                      value={formatMoneyInputValue(row.unitPrice)}
                      onChange={(event) =>
                        updateRow(row.id, (current) => ({
                          ...current,
                          unitPrice: normalizeMoneyInput(event.target.value),
                        }))
                      }
                      disabled={!canEditLineItems || isLoadingQuotationDetail}
                      className={`h-11 w-full rounded border bg-white px-3 text-right text-sm font-semibold text-slate-900 outline-none transition-all focus:ring-1 ${isDuplicateCombination ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:border-primary focus:ring-primary/30'}`}
                    />
                  </div>

                  {/* ĐVT + Số lượng + VAT chips — 3 col grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đơn vị tính</p>
                      <input
                        type="text"
                        aria-label={`Đơn vị tính dòng ${index + 1}`}
                        value={row.unit}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({ ...current, unit: event.target.value }))
                        }
                        disabled={!canEditLineItems || isLoadingQuotationDetail}
                        className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Số lượng</p>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Số lượng dòng ${index + 1}`}
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            quantity: sanitizeQuantityInput(event.target.value),
                          }))
                        }
                        disabled={!canEditLineItems || isLoadingQuotationDetail}
                        className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-right text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Thuế VAT</p>
                      <div className="flex h-11 items-stretch gap-0.5" role="group" aria-label={`Thuế VAT dòng ${index + 1}`}>
                        {(['0', '5', '10'] as const).map((chip) => {
                          const isActive = row.vatRate === chip;
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => updateRow(row.id, (current) => ({ ...current, vatRate: chip }))}
                              disabled={!canEditLineItems || isLoadingQuotationDetail}
                              className={`flex-1 rounded border text-[11px] font-bold transition-all focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                isActive
                                  ? 'border-primary bg-primary text-white shadow-sm'
                                  : 'border-slate-300 bg-white text-slate-600 hover:border-primary/60 hover:bg-primary/5'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                              title={`VAT ${chip}%`}
                            >
                              {chip}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Thành tiền */}
                  <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-semibold text-slate-400">Thành tiền</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900">{formatMoney(lineTotal)} đ</span>
                      <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: 15 }}>check_circle</span>
                    </div>
                  </div>

                  {/* Ghi chú */}
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ghi chú</p>
                    <textarea
                      aria-label={`Ghi chú dòng ${index + 1}`}
                      value={row.note}
                      onChange={(event) =>
                        updateRow(row.id, (current) => ({ ...current, note: event.target.value }))
                      }
                      rows={2}
                      disabled={!canEditLineItems || isLoadingQuotationDetail}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
              );
            })}

            {/* Add row button — mobile */}
            <div className="px-3 py-2">
              <button
                type="button"
                onClick={addRow}
                disabled={!canEditLineItems || isLoadingQuotationDetail}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>add</span>
                Thêm dòng mới
              </button>
            </div>
          </div>
          </>
          )}{/* end canEditLineItems */}

          <div
            data-testid="quote-table-summary"
            className="border-t border-slate-100 bg-slate-50/60 px-3 py-3"
          >
            {/* 2-col grid on mobile, 4-col on xl */}
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
              <div
                data-testid="quote-summary-metrics"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tiền trước VAT</p>
                <p className="mt-0.5 whitespace-nowrap text-sm font-black text-slate-900">{formatMoney(subtotal)} đ</p>
              </div>
              <div
                data-testid="quote-tax-summary-card"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Thuế GTGT</p>
                <p className="mt-0.5 whitespace-nowrap text-sm font-black text-slate-900">{formatMoney(vatAmount)} đ</p>
              </div>
              <div className="col-span-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 shadow-sm xl:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Tổng thanh toán</p>
                <p className="mt-0.5 whitespace-nowrap text-sm font-black text-deep-teal">{formatMoney(total)} đ</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm xl:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Bằng chữ</p>
                <p className="mt-1 text-xs font-semibold leading-[1.125rem] text-slate-800">{totalInWords}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Lịch sử báo giá ── */}
        <div
          data-testid="quotation-history-section"
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        >
          {/* ── Header — luôn hiển thị, click để toggle ── */}
          <button
            type="button"
            onClick={() => {
              setShowHistoryPanel((prev) => {
                if (!prev && quotationId !== null && versionHistory.length === 0 && auditHistory.length === 0) {
                  void loadQuotationHistory(quotationId);
                }
                return !prev;
              });
            }}
            className="w-full border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-left transition-colors hover:bg-slate-100/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${showHistoryPanel ? 'rotate-90' : ''}`} style={{ fontSize: 16 }}>
                  chevron_right
                </span>
                <h4 className="text-xs font-bold text-slate-700">Lịch sử báo giá</h4>
                {latestVersion ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    v{latestVersion.version_no} gần nhất
                  </span>
                ) : null}
                {latestAuditEvent ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                    {getEventTypeLabel(latestAuditEvent.event_type)}
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-slate-400">
                  {versionHistoryTotal > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full border border-slate-200 bg-white">{versionHistoryTotal} phiên bản</span>
                  )}
                  {auditHistoryTotal > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full border border-slate-200 bg-white">{auditHistoryTotal} audit</span>
                  )}
                  {!showHistoryPanel && !hasActiveQuotation && (
                    <span className="text-slate-300 italic">Chưa có báo giá</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                {showHistoryPanel ? 'Thu gọn' : 'Xem lịch sử'}
              </span>
            </div>
          </button>

          {/* ── Body — ẩn mặc định ── */}
          {showHistoryPanel && (
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2">
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="quotation-history-refresh"
                onClick={() => { void loadQuotationHistory(quotationId, { notifyOnError: true }); }}
                disabled={quotationId === null || isLoadingHistory}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`material-symbols-outlined ${isLoadingHistory ? 'animate-spin' : ''}`} style={{ fontSize: 15 }}>
                  refresh
                </span>
                {isLoadingHistory ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>
          </div>
          )}

          {showHistoryPanel && (
          <div className="grid grid-cols-1 gap-3 px-3 py-3 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Version history */}
            <div
              data-testid="quotation-version-history"
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">Phiên bản in</h5>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                  {versionHistory.length}/{versionHistoryTotal || versionHistory.length}
                </span>
              </div>

              {versionHistory.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] leading-[1.125rem] text-slate-500">
                  {hasActiveQuotation ? 'Chưa phát sinh lần in nào để tạo version.' : 'Chưa chọn báo giá nào. Hãy bấm "Thêm báo giá mới" hoặc mở báo giá cũ.'}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {versionHistory.map((version) => {
                    const versionStatus = getVersionStatusMeta(version.status);

                    return (
                      <article
                        key={version.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-[0.14em]">
                              v{version.version_no}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${versionStatus.className}`}>
                              {versionStatus.label}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                              {getTemplateLabel(version.template_key)}
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-slate-500">{formatDateTime(version.printed_at || version.created_at)}</p>
                        </div>
                        <p className="mt-1.5 break-all text-xs font-semibold leading-[1.125rem] text-slate-900">
                          {version.filename || `Báo giá version ${version.version_no}`}
                        </p>
                        <dl className="mt-1.5 grid grid-cols-1 gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Khách hàng</dt>
                            <dd className="mt-0.5 text-xs font-semibold text-slate-700">{version.recipient_name || 'Chưa chọn khách hàng'}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tổng tiền</dt>
                            <dd className="mt-0.5 text-xs font-black text-slate-900">{formatMoney(version.total_amount)} đ</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Người in</dt>
                            <dd className="mt-0.5 text-xs font-semibold text-slate-700">
                              {formatActorLabel(version.printed_by, version.printed_by_actor)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hash nội dung</dt>
                            <dd className="mt-0.5 font-mono text-[11px] text-slate-600">{formatHashPreview(version.content_hash)}</dd>
                          </div>
                        </dl>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => { void handleViewVersionDetail(version.id); }}
                            disabled={isLoadingVersionDetail}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>visibility</span>
                            Xem chi tiết
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audit history */}
            <div
              data-testid="quotation-audit-history"
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">Nhật ký audit</h5>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                  {filteredAuditHistory.length}/{auditHistoryTotal || auditHistory.length}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {AUDIT_FILTER_OPTIONS.map((option) => {
                  const isActive = auditFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAuditFilter(option.value)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${isActive ? 'border-primary/20 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {historyError ? (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-[1.125rem] text-error">
                  {historyError}
                </div>
              ) : null}

              {auditHistory.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] leading-[1.125rem] text-slate-500">
                  {hasActiveQuotation ? 'Chưa có audit nào cho báo giá này.' : 'Chưa có lịch sử để hiển thị trên form trắng.'}
                </div>
              ) : filteredAuditHistory.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] leading-[1.125rem] text-slate-500">
                  Không có sự kiện phù hợp với bộ lọc đã chọn.
                </div>
              ) : (
                <ol data-testid="quotation-audit-event-list" className="mt-2 space-y-2">
                  {filteredAuditHistory.map((event, index) => {
                    const eventStatus = getEventStatusMeta(event.event_status);
                    const message =
                      event.metadata && typeof event.metadata.message === 'string'
                        ? event.metadata.message
                        : '';

                    return (
                      <li key={event.id} className="relative pl-5">
                        <span className={`absolute left-0 top-2 inline-flex h-2 w-2 rounded-full ${index === 0 ? 'bg-primary' : 'bg-slate-300'}`} />
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900">{getEventTypeLabel(event.event_type)}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eventStatus.className}`}>
                              {eventStatus.label}
                            </span>
                            {event.version_no ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                                v{event.version_no}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {formatDateTime(event.created_at)} · {formatActorLabel(event.created_by, event.actor)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            {event.template_key ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">
                                {getTemplateLabel(event.template_key)}
                              </span>
                            ) : null}
                            {event.filename ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">
                                {event.filename}
                              </span>
                            ) : null}
                            {event.content_hash ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                                {formatHashPreview(event.content_hash)}
                              </span>
                            ) : null}
                          </div>
                          {message ? (
                            <p className="mt-1.5 text-[10px] leading-[1.125rem] text-error">{message}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
          )}{/* end showHistoryPanel */}
        </div>
        </div>
      </div>

      {/* ── FAB Settings ── */}
      <button
        type="button"
        title="Cấu hình báo giá"
        aria-label="Cấu hình báo giá"
        data-testid="quotation-settings-fab"
        onClick={handleOpenSettingsDrawer}
        disabled={isLoadingQuotationDetail || isInitializingDraft}
        className="fixed bottom-4 right-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-deep-teal focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
      </button>

      {/* ── Settings Drawer ── */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={handleCloseSettingsDrawer}
          />
          <div
            data-testid="quotation-settings-drawer"
            className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>settings</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Cấu hình báo giá</h3>
                  <p className="text-[11px] text-slate-500">Thiết lập nội dung dùng khi xuất Word/Excel.</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng cấu hình báo giá"
                onClick={handleCloseSettingsDrawer}
                className="p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 rounded"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Thiết lập chung</h4>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Số ngày hiệu lực</span>
                    <input
                      type="number"
                      min="1"
                      value={draftSettings.validityDays}
                      onChange={(event) => updateDraftSettings('validityDays', event.target.value)}
                      className="h-8 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Nội dung triển khai</span>
                    <textarea
                      value={draftSettings.scopeSummary}
                      onChange={(event) => updateDraftSettings('scopeSummary', event.target.value)}
                      rows={4}
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Ghi chú và điều kiện</h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Mỗi dòng trong ô dưới đây sẽ được đưa thành một ghi chú riêng trong file Word/Excel.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Ghi chú chi tiết</span>
                    <textarea
                      value={draftSettings.notesText}
                      onChange={(event) => updateDraftSettings('notesText', event.target.value)}
                      rows={8}
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-700">Liên hệ và ký tên</h4>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Dòng liên hệ</span>
                    <textarea
                      value={draftSettings.contactLine}
                      onChange={(event) => updateDraftSettings('contactLine', event.target.value)}
                      rows={4}
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Lời kết</span>
                    <textarea
                      value={draftSettings.closingMessage}
                      onChange={(event) => updateDraftSettings('closingMessage', event.target.value)}
                      rows={3}
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-neutral">Chức danh ký</span>
                      <input
                        type="text"
                        value={draftSettings.signatoryTitle}
                        onChange={(event) => updateDraftSettings('signatoryTitle', event.target.value)}
                        className="h-8 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-neutral">Đơn vị ký</span>
                      <input
                        type="text"
                        value={draftSettings.signatoryUnit}
                        onChange={(event) => updateDraftSettings('signatoryUnit', event.target.value)}
                        className="h-8 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral">Tên giám đốc</span>
                    <input
                      type="text"
                      value={draftSettings.signatoryName}
                      onChange={(event) => updateDraftSettings('signatoryName', event.target.value)}
                      className="h-8 rounded border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={handleResetDraftSettings}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              >
                Khôi phục mặc định
              </button>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSettingsDrawer}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isLoadingVersionDetail || selectedVersionDetail) && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
            onClick={() => {
              if (!isLoadingVersionDetail) {
                setSelectedVersionDetail(null);
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-version-detail-title"
            data-testid="quotation-version-detail-modal"
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <h3 id="quotation-version-detail-title" className="text-sm font-bold text-slate-900">
                  {selectedVersionDetail ? `Chi tiết version v${selectedVersionDetail.version_no}` : 'Đang tải chi tiết version'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Snapshot nội dung đã được lưu tại thời điểm xác nhận in báo giá.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết version"
                onClick={() => setSelectedVersionDetail(null)}
                disabled={isLoadingVersionDetail}
                className="p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 rounded disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {isLoadingVersionDetail && !selectedVersionDetail ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 22 }}>progress_activity</span>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-700">Đang tải chi tiết version...</p>
              </div>
            ) : selectedVersionDetail ? (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-[0.14em]">
                        v{selectedVersionDetail.version_no}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getVersionStatusMeta(selectedVersionDetail.status).className}`}>
                        {getVersionStatusMeta(selectedVersionDetail.status).label}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                        {getTemplateLabel(selectedVersionDetail.template_key)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Khách hàng</dt>
                        <dd className="mt-0.5 text-xs font-semibold text-slate-900">{selectedVersionDetail.recipient_name || 'Chưa chọn khách hàng'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Thời điểm in</dt>
                        <dd className="mt-0.5 text-xs font-semibold text-slate-900">{formatDateTime(selectedVersionDetail.printed_at || selectedVersionDetail.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Người in</dt>
                        <dd className="mt-0.5 text-xs font-semibold text-slate-900">
                          {formatActorLabel(selectedVersionDetail.printed_by, selectedVersionDetail.printed_by_actor)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tên file</dt>
                        <dd className="mt-0.5 text-xs break-all font-semibold text-slate-900">{selectedVersionDetail.filename || 'Chưa có file'}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tiền trước VAT</dt>
                        <dd className="mt-0.5 text-xs font-black text-slate-900">{formatMoney(selectedVersionDetail.subtotal)} đ</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tổng thanh toán</dt>
                        <dd className="mt-0.5 text-xs font-black text-primary">{formatMoney(selectedVersionDetail.total_amount)} đ</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hash nội dung</dt>
                        <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-600">{selectedVersionDetail.content_hash || 'Chưa có hash'}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">Nội dung snapshot</h4>
                    <div className="mt-2 space-y-2 text-xs text-slate-700">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nội dung triển khai</p>
                        <p className="mt-0.5 leading-5">{selectedVersionDetail.scope_summary || 'Không có nội dung'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ghi chú và điều kiện</p>
                        <p className="mt-0.5 whitespace-pre-line leading-5">{selectedVersionDetail.notes_text || 'Không có ghi chú'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Liên hệ</p>
                        <p className="mt-0.5 leading-5">{selectedVersionDetail.contact_line || 'Không có thông tin liên hệ'}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ký tên</p>
                          <p className="mt-0.5 font-semibold text-slate-900">{selectedVersionDetail.signatory_title || 'Chưa cấu hình'}</p>
                          <p className="mt-0.5 leading-5">{selectedVersionDetail.signatory_unit || 'Chưa cấu hình'}</p>
                          <p className="mt-0.5 leading-5">{selectedVersionDetail.signatory_name || 'Chưa cấu hình'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Khác</p>
                          <p className="mt-0.5 leading-5">Thành phố ký: {selectedVersionDetail.sender_city || 'Cần Thơ'}</p>
                          <p className="mt-0.5 leading-5">Hiệu lực: {selectedVersionDetail.validity_days} ngày</p>
                          <p className="mt-0.5 leading-5">Bằng chữ: {selectedVersionDetail.total_in_words || 'Chưa có dữ liệu'}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="mt-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-3 py-2">
                    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">Chi tiết hạng mục của version</h4>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-xs">
                      <colgroup>
                        <col style={{ width: 60 }} />
                        <col style={{ width: 260 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 120 }} />
                        <col style={{ width: 160 }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 170 }} />
                        <col style={{ width: 260 }} />
                      </colgroup>
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          {['TT', 'Hạng mục công việc', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'VAT', 'Thành tiền', 'Ghi chú'].map((label) => (
                            <th key={label} className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedVersionDetail.items.map((item) => (
                          <tr key={item.id} className="align-top">
                            <td className="px-3 py-2 text-center font-semibold text-slate-500">{item.sort_order}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{item.product_name}</td>
                            <td className="px-3 py-2 text-slate-700">{item.unit || ''}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{formatMoney(item.quantity)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(item.unit_price)}</td>
                            <td className="px-3 py-2 text-center font-semibold text-slate-700">
                              {item.vat_rate === null || typeof item.vat_rate === 'undefined' ? '-' : `${formatMoney(item.vat_rate)}%`}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">{formatMoney(item.line_total)}</td>
                            <td className="px-3 py-2 whitespace-pre-line leading-5 text-slate-700">{item.note || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showPrintConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
            onClick={() => setShowPrintConfirmModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-print-confirm-title"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>print</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="quotation-print-confirm-title" className="text-sm font-bold text-slate-900">
                  Xác nhận in báo giá
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Bạn vui lòng bấm xác nhận in. Thời điểm xác nhận sẽ được ghi nhận vào bảng audit.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPrintConfirmModal(false)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              >
                Huỷ không in
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmPrintQuotation(); }}
                disabled={isDownloadingWord || isPersistingDraft}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloadingWord ? 'Đang in...' : 'Xác nhận in'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── (B) Sticky summary bar ── */}
      {normalizedRows.length > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-primary/20 bg-white/95 px-4 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-slate-500">
              {normalizedRows.length} hạng mục
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Trước VAT: <span className="font-semibold text-slate-700">{formatMoney(subtotal)} đ</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-sm font-black text-deep-teal">
                Tổng: {formatMoney(total)} đ
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
