import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Customer, Product } from '../types';
import {
  createProductQuotation,
  exportProductQuotationPdf,
  fetchProductQuotationEventsPage,
  fetchProductQuotation,
  fetchProductQuotationVersion,
  fetchProductQuotationVersionsPage,
  fetchProductQuotationsPage,
  type ProductQuotationDraft,
  type ProductQuotationDraftListItem,
  type ProductQuotationDraftPayload,
  type ProductQuotationEventRecord,
  type ProductQuotationVersionDetailRecord,
  type ProductQuotationVersionRecord,
  printStoredProductQuotationWord,
  updateProductQuotation,
} from '../services/v5Api';
import { SearchableSelect } from './SearchableSelect';
import { openProductQuotationPreview } from '../utils/productQuotationPreview';

interface ProductQuotationTabProps {
  currentUserId?: string | number | null;
  customers?: Customer[];
  products: Product[];
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

interface ProductQuotationRow {
  id: string;
  productId: string;
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
const DEFAULT_SENDER_CITY = 'Cần Thơ';
const DEFAULT_GLOBAL_VAT_RATE = 10;
const DRAFT_AUTOSAVE_DELAY_MS = 250;
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
  productId: '',
  productName: '',
  unit: '',
  quantity: '1',
  unitPrice: '0',
  vatRate: '10',
  note: '',
});

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

const formatQuotationOptionLabel = (quotation: ProductQuotationDraftListItem): string => {
  const recipient = String(quotation.recipient_name || '').trim();
  return recipient !== '' ? recipient : `Báo giá #${quotation.id}`;
};

const formatActorLabel = (value?: number | null): string => {
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
  onNotify,
}: ProductQuotationTabProps) => {
  const activeProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.is_active !== false)
        .sort((left, right) =>
          String(left.product_name || '').localeCompare(String(right.product_name || ''), 'vi')
        ),
    [products]
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
      activeProducts.map((product) => ({
        value: String(product.id),
        label: String(product.product_name || '').trim() || String(product.product_code || '').trim(),
        searchText: [
          product.product_code,
          product.product_name,
          product.package_name,
          product.description,
          product.unit,
          String(product.standard_price ?? ''),
          formatMoney(Number(product.standard_price || 0)),
          `${formatMoney(Number(product.standard_price || 0))} đ`,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [activeProducts]
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
  const quotationIdRef = useRef<number | null>(null);
  const payloadRef = useRef<ProductQuotationDraftPayload>(createDefaultQuotationDraftPayload());
  const payloadSnapshotRef = useRef<string>(buildPayloadSnapshot(createDefaultQuotationDraftPayload()));
  const lastSavedSnapshotRef = useRef<string>(payloadSnapshotRef.current);
  const saveTimeoutRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<number | null>>(Promise.resolve<number | null>(null));
  const historyRequestRef = useRef(0);
  const quotationListRequestRef = useRef(0);

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

  useEffect(() => {
    quotationIdRef.current = quotationId;
  }, [quotationId]);

  useEffect(() => {
    payloadRef.current = currentPayload;
    payloadSnapshotRef.current = currentPayloadSnapshot;
  }, [currentPayload, currentPayloadSnapshot]);

  const resetDraftEditor = useCallback(() => {
    const fallbackSettings = createDefaultQuotationSettings();
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
            productId: item.product_id ? String(item.product_id) : '',
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
    setSelectedVersionDetail(null);
    setAuditFilter('ALL');
    setShowSettingsDrawer(false);
    setShowPrintConfirmModal(false);
    setShowExportMenu(false);
  }, []);

  const loadQuotationList = useCallback(
    async ({ notifyOnError = false }: { notifyOnError?: boolean } = {}): Promise<ProductQuotationDraftListItem[]> => {
      const requestId = quotationListRequestRef.current + 1;
      quotationListRequestRef.current = requestId;
      setIsLoadingQuotationList(true);

      try {
        const query = currentUserId == null
          ? { page: 1, per_page: 200, sort_by: 'updated_at', sort_dir: 'desc' as const }
          : { page: 1, per_page: 200, sort_by: 'updated_at', sort_dir: 'desc' as const, filters: { mine: 1 } };
        const listResult = await fetchProductQuotationsPage(query);
        const nextList = Array.isArray(listResult.data) ? listResult.data : [];

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
    [currentUserId, onNotify]
  );

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
        const [versionsResult, eventsResult] = await Promise.all([
          fetchProductQuotationVersionsPage(targetQuotationId, { page: 1, per_page: 6 }),
          fetchProductQuotationEventsPage(targetQuotationId, { page: 1, per_page: 20 }),
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
      resetDraftEditor();
      setIsInitializingDraft(true);
      try {
        await loadQuotationList();
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
  }, [loadQuotationList, onNotify, resetDraftEditor]);

  useEffect(() => {
    if (isInitializingDraft) {
      return;
    }

    if (currentPayloadSnapshot === lastSavedSnapshotRef.current) {
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
  }, [currentPayloadSnapshot, isInitializingDraft, persistDraft]);

  useEffect(() => {
    void loadQuotationHistory(quotationId);
  }, [loadQuotationHistory, quotationId]);

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

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
    setDraftSettings(createDefaultQuotationSettings());
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

    const savedId = await persistDraftSnapshot(nextPayload, nextSnapshot, {
      notifyOnError: true,
      force: hadUnsavedSettingsChange,
    });

    if (hadUnsavedSettingsChange && savedId === null) {
      return;
    }

    payloadRef.current = nextPayload;
    payloadSnapshotRef.current = nextSnapshot;
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

  const handleProductChange = (rowId: string, productId: string) => {
    const product = productById.get(productId);
    updateRow(rowId, (current) => {
      if (!product) {
        return {
          ...current,
          productId: '',
          productName: '',
          unit: '',
          unitPrice: '0',
          note: '',
        };
      }

      const nextNote = [String(product.package_name || '').trim(), String(product.description || '').trim()]
        .filter(Boolean)
        .join('\n');

      return {
        ...current,
        productId,
        productName: String(product.product_name || '').trim(),
        unit: String(product.unit || '').trim(),
        unitPrice: String(Number(product.standard_price || 0)),
        note: nextNote,
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
        if (payloadSnapshotRef.current !== lastSavedSnapshotRef.current) {
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
    if (quotationIdRef.current !== null && payloadSnapshotRef.current !== lastSavedSnapshotRef.current) {
      const savedId = await flushPendingDraftSave(true);
      if (savedId === null) {
        return;
      }
    }

    resetDraftEditor();
  }, [flushPendingDraftSave, resetDraftEditor]);

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
  const quotationSelectorValue = selectedQuotationOptionValue;
  const selectedRecipientValue =
    selectedCustomerId !== null && customerById.has(String(selectedCustomerId))
      ? String(selectedCustomerId)
      : recipientName;

  return (
    <>
      <div className="pb-10 pt-0 md:pb-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="w-full md:max-w-[340px]">
            <SearchableSelect
              className="w-full"
              value={quotationSelectorValue}
              options={quotationSelectOptions}
              onChange={(value) => {
                void handleOpenQuotation(value);
              }}
              placeholder={isLoadingQuotationList ? 'Đang tải báo giá...' : 'Mở báo giá cũ'}
              searchPlaceholder="Tìm báo giá cũ..."
              noOptionsText="Chưa có báo giá nào"
              searching={isLoadingQuotationList}
              disabled={isLoadingQuotationDetail}
              optionEstimateSize={84}
              dropdownClassName="max-w-[620px]"
              portalMinWidth={460}
              portalMaxWidth={620}
              usePortal
              triggerClassName="h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm text-slate-900"
              renderOptionContent={(option, state) => {
                const quotation = quotationList.find((item) => String(item.id) === String(option.value));

                return (
                  <div className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-1">
                    <div className="min-w-0 flex-1 text-left">
                      <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cập nhật: {formatDateTime(quotation?.updated_at || quotation?.created_at)}
                      </p>
                    </div>
                    <div className="min-w-[116px] shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Tổng tiền
                      </p>
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
          <button
            type="button"
            onClick={() => {
              void handleStartNewQuotation();
            }}
            disabled={isPersistingDraft || isLoadingQuotationDetail}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Thêm báo giá
          </button>
          <div className="relative md:shrink-0">
            <button
              type="button"
              onClick={() => setShowExportMenu((current) => !current)}
              disabled={isExporting || isLoadingQuotationDetail}
              aria-haspopup="menu"
              aria-expanded={showExportMenu}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              {isExporting ? 'Đang chuẩn bị...' : 'Xuất báo giá'}
              <span className="material-symbols-outlined text-base">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 flex min-w-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <button
                    type="button"
                    aria-label="Xem báo giá"
                    onClick={() => {
                      void handlePreviewQuotation();
                    }}
                    disabled={isPreparingPreview}
                    className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Xem báo giá
                  </button>
                  <button
                    type="button"
                    aria-label="In báo giá"
                    onClick={() => {
                      handleRequestPrintQuotation();
                    }}
                    disabled={isDownloadingWord}
                    className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">description</span>
                    In báo giá
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
        <section className="grid grid-cols-1 gap-4">
          <div className="rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.10),transparent_35%),linear-gradient(180deg,#ffffff_0%,#fcfffe_100%)] px-4 py-4 shadow-sm md:px-5 md:py-5">
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-3 shadow-sm md:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="shrink-0 whitespace-nowrap text-sm font-black uppercase tracking-[0.16em] text-slate-700">Kính gửi</span>
                <SearchableSelect
                  className="min-w-0 flex-1"
                  value={selectedRecipientValue}
                  options={customerOptions}
                  onChange={handleRecipientChange}
                  placeholder="Chọn khách hàng"
                  searchPlaceholder="Tìm khách hàng..."
                  noOptionsText="Không tìm thấy khách hàng"
                  allowCustomValue
                  customValueLabel={(value) => `Dùng "${value}"`}
                  triggerClassName="h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1">
                <h4 className="text-lg font-black text-slate-900">Bảng hạng mục báo giá</h4>
              </div>
              <button
                type="button"
                onClick={addRow}
                disabled={isLoadingQuotationDetail}
                className="inline-flex items-center justify-center gap-3 rounded-[22px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[24px]">add</span>
                Thêm dòng
              </button>
            </div>
          </div>
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[1130px] table-fixed border-collapse text-left">
              <colgroup>
                <col style={{ width: 52 }} />
                <col style={{ width: 328 }} />
                <col style={{ width: 112 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 148 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 192 }} />
                <col style={{ width: 224 }} />
                <col style={{ width: 84 }} />
              </colgroup>
              <thead className="bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-200">
                  {['TT', 'Hạng mục công việc', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Thuế VAT', 'Thành tiền', 'Ghi chú', 'Tác vụ'].map((label) => (
                    <th
                      key={label}
                      className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, index) => {
                  const quantityValue = parseQuantityInput(row.quantity);
                  const unitPriceValue = parsePositiveNumber(row.unitPrice);
                  const lineTotal = quantityValue * unitPriceValue;
                  const isDuplicateCombination = duplicateRowIds.has(row.id);

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-2 py-3 text-center text-sm font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-3 py-3">
                        <SearchableSelect
                          value={row.productId}
                          options={productOptions}
                          onChange={(value) => handleProductChange(row.id, value)}
                          placeholder="Chọn sản phẩm từ danh mục"
                          optionEstimateSize={92}
                          dropdownClassName="min-w-[560px] max-w-[720px]"
                          portalMinWidth={560}
                          portalMaxWidth={720}
                          usePortal
                          label=""
                          triggerClassName={`h-9 rounded-md px-3 text-sm ${isDuplicateCombination ? 'border-rose-300 ring-1 ring-rose-200' : ''}`}
                          renderOptionContent={(option, state) => {
                            const product = productById.get(String(option.value));
                            const packageName = String(product?.package_name || '').trim();
                            const description = String(product?.description || '').trim();
                            const unitPrice = Number(product?.standard_price || 0);

                            return (
                              <div className="flex min-h-[72px] items-start justify-between gap-4 py-1">
                                <div className="min-w-0 flex-1 text-left">
                                  <p className="truncate text-sm font-semibold leading-5 text-slate-900">
                                    {option.label}
                                  </p>
                                  {packageName ? (
                                    <p className="mt-0.5 truncate text-xs leading-4 text-slate-500">
                                      Gói cước: {packageName}
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
                          <p className="mt-2 text-xs font-semibold text-rose-600">
                            {DUPLICATE_QUOTATION_ITEM_INLINE_MESSAGE}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({ ...current, unit: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              quantity: sanitizeQuantityInput(event.target.value),
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatMoneyInputValue(row.unitPrice)}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({
                              ...current,
                              unitPrice: normalizeMoneyInput(event.target.value),
                            }))
                          }
                          className={`w-full rounded-xl border bg-white px-3 py-2 text-right text-sm font-semibold text-slate-900 outline-none transition-all focus:ring-2 ${isDuplicateCombination ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:border-primary focus:ring-primary/10'}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="relative">
                          <input
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
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-7 text-center text-sm font-semibold text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm font-semibold text-slate-400">
                            %
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-right text-[15px] font-bold text-slate-900">
                          {formatMoney(lineTotal)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          value={row.note}
                          onChange={(event) =>
                            updateRow(row.id, (current) => ({ ...current, note: event.target.value }))
                          }
                          rows={3}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            data-testid="quote-table-summary"
            className="border-t border-slate-200 bg-slate-50/70 px-4 py-3"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div
                data-testid="quote-summary-metrics"
                className="flex flex-wrap items-stretch gap-2.5"
              >
                <div className="w-fit min-w-[205px] rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tiền trước VAT</p>
                  <p className="mt-1.5 whitespace-nowrap text-lg font-black text-slate-900 sm:text-xl">{formatMoney(subtotal)} đ</p>
                </div>
                <div
                  data-testid="quote-tax-summary-card"
                  className="w-fit min-w-[185px] rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Thuế GTGT</p>
                  <p className="mt-1.5 whitespace-nowrap text-lg font-black text-slate-900 sm:text-xl">{formatMoney(vatAmount)} đ</p>
                </div>
                <div className="w-fit min-w-[215px] rounded-2xl border border-primary/15 bg-primary/5 px-3.5 py-2.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Tổng thanh toán</p>
                  <p className="mt-1.5 whitespace-nowrap text-lg font-black text-deep-teal sm:text-xl">{formatMoney(total)} đ</p>
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm xl:min-w-[440px] xl:flex-[1.2]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Bằng chữ</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{totalInWords}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          data-testid="quotation-history-section"
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black text-slate-900">Lịch sử báo giá</h4>
                  {latestVersion ? (
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      v{latestVersion.version_no} gần nhất
                    </span>
                  ) : null}
                  {latestAuditEvent ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {getEventTypeLabel(latestAuditEvent.event_type)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500">
                  Theo dõi các lần in đã tạo version mới và nhật ký thao tác gần nhất ngay trên tab báo giá.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    {versionHistoryTotal} phiên bản
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    {auditHistoryTotal} audit
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    {hasActiveQuotation ? `Draft #${quotationId}` : 'Form trắng'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="quotation-history-refresh"
                onClick={() => {
                  void loadQuotationHistory(quotationId, { notifyOnError: true });
                }}
                disabled={quotationId === null || isLoadingHistory}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[20px] ${isLoadingHistory ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                {isLoadingHistory ? 'Đang tải lịch sử...' : 'Làm mới lịch sử'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div
              data-testid="quotation-version-history"
              className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Phiên bản in</h5>
                  <p className="mt-1 text-xs text-slate-500">Hiển thị tối đa 6 version gần nhất đã được hệ thống ghi nhận.</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {versionHistory.length}/{versionHistoryTotal || versionHistory.length}
                </span>
              </div>

              {versionHistory.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  {hasActiveQuotation ? 'Chưa phát sinh lần in nào để tạo version.' : 'Chưa chọn báo giá nào. Hãy bấm "Thêm báo giá" hoặc mở báo giá cũ.'}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {versionHistory.map((version) => {
                    const versionStatus = getVersionStatusMeta(version.status);

                    return (
                      <article
                        key={version.id}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary">
                              v{version.version_no}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${versionStatus.className}`}>
                              {versionStatus.label}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {getTemplateLabel(version.template_key)}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-500">{formatDateTime(version.printed_at || version.created_at)}</p>
                        </div>
                        <p className="mt-3 break-all text-sm font-semibold text-slate-900">
                          {version.filename || `Báo giá version ${version.version_no}`}
                        </p>
                        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                          <div>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Khách hàng</dt>
                            <dd className="mt-1 text-sm font-semibold text-slate-700">{version.recipient_name || 'Chưa chọn khách hàng'}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Tổng tiền</dt>
                            <dd className="mt-1 text-sm font-black text-slate-900">{formatMoney(version.total_amount)} đ</dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Người in</dt>
                            <dd className="mt-1 text-sm font-semibold text-slate-700">{formatActorLabel(version.printed_by)}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">Hash nội dung</dt>
                            <dd className="mt-1 font-mono text-[11px] text-slate-600">{formatHashPreview(version.content_hash)}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              void handleViewVersionDetail(version.id);
                            }}
                            disabled={isLoadingVersionDetail}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                            Xem chi tiết
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              data-testid="quotation-audit-history"
              className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Nhật ký audit</h5>
                  <p className="mt-1 text-xs text-slate-500">Hiển thị tối đa 20 sự kiện gần nhất của nháp và các lần in báo giá.</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredAuditHistory.length}/{auditHistoryTotal || auditHistory.length}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {AUDIT_FILTER_OPTIONS.map((option) => {
                  const isActive = auditFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAuditFilter(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'border-primary/20 bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {historyError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {historyError}
                </div>
              ) : null}

              {auditHistory.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  {hasActiveQuotation ? 'Chưa có audit nào cho báo giá này.' : 'Chưa có lịch sử để hiển thị trên form trắng.'}
                </div>
              ) : filteredAuditHistory.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Không có sự kiện phù hợp với bộ lọc đã chọn.
                </div>
              ) : (
                <ol data-testid="quotation-audit-event-list" className="mt-4 space-y-4">
                  {filteredAuditHistory.map((event, index) => {
                    const eventStatus = getEventStatusMeta(event.event_status);
                    const message =
                      event.metadata && typeof event.metadata.message === 'string'
                        ? event.metadata.message
                        : '';

                    return (
                      <li key={event.id} className="relative pl-6">
                        <span className={`absolute left-0 top-2 inline-flex h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-slate-300'}`} />
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{getEventTypeLabel(event.event_type)}</p>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${eventStatus.className}`}>
                              {eventStatus.label}
                            </span>
                            {event.version_no ? (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                v{event.version_no}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(event.created_at)} · {formatActorLabel(event.created_by)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {event.template_key ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                                {getTemplateLabel(event.template_key)}
                              </span>
                            ) : null}
                            {event.filename ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                                {event.filename}
                              </span>
                            ) : null}
                            {event.content_hash ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-500">
                                {formatHashPreview(event.content_hash)}
                              </span>
                            ) : null}
                          </div>
                          {message ? (
                            <p className="mt-3 text-xs leading-5 text-rose-600">{message}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </section>
        </div>
      </div>

      <button
        type="button"
        title="Cấu hình báo giá"
        aria-label="Cấu hình báo giá"
        data-testid="quotation-settings-fab"
        onClick={handleOpenSettingsDrawer}
        disabled={isLoadingQuotationDetail}
        className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-deep-teal focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 md:bottom-6 md:right-6"
      >
        <span className="material-symbols-outlined text-[24px]">settings</span>
      </button>

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
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3 text-slate-900">
                <span className="material-symbols-outlined rounded-xl bg-primary/10 p-2 text-[22px] text-primary">settings</span>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Cấu hình báo giá</h3>
                  <p className="mt-0.5 text-sm text-slate-500">Thiết lập nội dung dùng khi xuất Word/Excel.</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng cấu hình báo giá"
                onClick={handleCloseSettingsDrawer}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h4 className="text-base font-bold text-slate-900">Thiết lập chung</h4>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Số ngày hiệu lực</span>
                    <input
                      type="number"
                      min="1"
                      value={draftSettings.validityDays}
                      onChange={(event) => updateDraftSettings('validityDays', event.target.value)}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Nội dung triển khai</span>
                    <textarea
                      value={draftSettings.scopeSummary}
                      onChange={(event) => updateDraftSettings('scopeSummary', event.target.value)}
                      rows={4}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Ghi chú và điều kiện</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Mỗi dòng trong ô dưới đây sẽ được đưa thành một ghi chú riêng trong file Word/Excel.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Ghi chú chi tiết</span>
                    <textarea
                      value={draftSettings.notesText}
                      onChange={(event) => updateDraftSettings('notesText', event.target.value)}
                      rows={8}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h4 className="text-base font-bold text-slate-900">Liên hệ và ký tên</h4>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Dòng liên hệ</span>
                    <textarea
                      value={draftSettings.contactLine}
                      onChange={(event) => updateDraftSettings('contactLine', event.target.value)}
                      rows={4}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Lời kết</span>
                    <textarea
                      value={draftSettings.closingMessage}
                      onChange={(event) => updateDraftSettings('closingMessage', event.target.value)}
                      rows={3}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-slate-700">Chức danh ký</span>
                      <input
                        type="text"
                        value={draftSettings.signatoryTitle}
                        onChange={(event) => updateDraftSettings('signatoryTitle', event.target.value)}
                        className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-slate-700">Đơn vị ký</span>
                      <input
                        type="text"
                        value={draftSettings.signatoryUnit}
                        onChange={(event) => updateDraftSettings('signatoryUnit', event.target.value)}
                        className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">Tên giám đốc</span>
                    <input
                      type="text"
                      value={draftSettings.signatoryName}
                      onChange={(event) => updateDraftSettings('signatoryName', event.target.value)}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={handleResetDraftSettings}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Khôi phục mặc định
              </button>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseSettingsDrawer}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-deep-teal"
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
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h3 id="quotation-version-detail-title" className="text-lg font-black text-slate-900">
                  {selectedVersionDetail ? `Chi tiết version v${selectedVersionDetail.version_no}` : 'Đang tải chi tiết version'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Snapshot nội dung đã được lưu tại thời điểm xác nhận in báo giá.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết version"
                onClick={() => setSelectedVersionDetail(null)}
                disabled={isLoadingVersionDetail}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {isLoadingVersionDetail && !selectedVersionDetail ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-700">Đang tải chi tiết version...</p>
              </div>
            ) : selectedVersionDetail ? (
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-primary">
                        v{selectedVersionDetail.version_no}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getVersionStatusMeta(selectedVersionDetail.status).className}`}>
                        {getVersionStatusMeta(selectedVersionDetail.status).label}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {getTemplateLabel(selectedVersionDetail.template_key)}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Khách hàng</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{selectedVersionDetail.recipient_name || 'Chưa chọn khách hàng'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Thời điểm in</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{formatDateTime(selectedVersionDetail.printed_at || selectedVersionDetail.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Người in</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{formatActorLabel(selectedVersionDetail.printed_by)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tên file</dt>
                        <dd className="mt-1 break-all font-semibold text-slate-900">{selectedVersionDetail.filename || 'Chưa có file'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tiền trước VAT</dt>
                        <dd className="mt-1 font-black text-slate-900">{formatMoney(selectedVersionDetail.subtotal)} đ</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tổng thanh toán</dt>
                        <dd className="mt-1 font-black text-primary">{formatMoney(selectedVersionDetail.total_amount)} đ</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Hash nội dung</dt>
                        <dd className="mt-1 break-all font-mono text-[12px] text-slate-600">{selectedVersionDetail.content_hash || 'Chưa có hash'}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4">
                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Nội dung snapshot</h4>
                    <div className="mt-4 space-y-4 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Nội dung triển khai</p>
                        <p className="mt-1 leading-6">{selectedVersionDetail.scope_summary || 'Không có nội dung'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Ghi chú và điều kiện</p>
                        <p className="mt-1 whitespace-pre-line leading-6">{selectedVersionDetail.notes_text || 'Không có ghi chú'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Liên hệ</p>
                        <p className="mt-1 leading-6">{selectedVersionDetail.contact_line || 'Không có thông tin liên hệ'}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Ký tên</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedVersionDetail.signatory_title || 'Chưa cấu hình'}</p>
                          <p className="mt-1 leading-6">{selectedVersionDetail.signatory_unit || 'Chưa cấu hình'}</p>
                          <p className="mt-1 leading-6">{selectedVersionDetail.signatory_name || 'Chưa cấu hình'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Khác</p>
                          <p className="mt-1 leading-6">Thành phố ký: {selectedVersionDetail.sender_city || 'Cần Thơ'}</p>
                          <p className="mt-1 leading-6">Hiệu lực: {selectedVersionDetail.validity_days} ngày</p>
                          <p className="mt-1 leading-6">Bằng chữ: {selectedVersionDetail.total_in_words || 'Chưa có dữ liệu'}</p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="mt-4 rounded-[24px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Chi tiết hạng mục của version</h4>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
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
                            <th key={label} className="px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedVersionDetail.items.map((item) => (
                          <tr key={item.id} className="align-top">
                            <td className="px-3 py-3 text-center font-semibold text-slate-500">{item.sort_order}</td>
                            <td className="px-3 py-3 font-semibold text-slate-900">{item.product_name}</td>
                            <td className="px-3 py-3 text-slate-700">{item.unit || ''}</td>
                            <td className="px-3 py-3 text-right text-slate-700">{formatMoney(item.quantity)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(item.unit_price)}</td>
                            <td className="px-3 py-3 text-center font-semibold text-slate-700">
                              {item.vat_rate === null || typeof item.vat_rate === 'undefined' ? '-' : `${formatMoney(item.vat_rate)}%`}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-slate-900">{formatMoney(item.line_total)}</td>
                            <td className="px-3 py-3 whitespace-pre-line leading-6 text-slate-700">{item.note || ''}</td>
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
            className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[24px]">print</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="quotation-print-confirm-title" className="text-lg font-black text-slate-900">
                  Xác nhận in báo giá
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Bạn vui lòng bấm xác nhận in. Thời điểm xác nhận sẽ được ghi nhận vào bảng audit.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPrintConfirmModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Huỷ không in
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmPrintQuotation();
                }}
                disabled={isDownloadingWord || isPersistingDraft}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloadingWord ? 'Đang in...' : 'Xác nhận in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
