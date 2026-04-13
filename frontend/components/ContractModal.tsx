import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { CONTRACT_STATUSES } from '../constants';
import {
  fetchContractSignerOptions,
  type GenerateContractPaymentsPayload,
  type GenerateContractPaymentsResult,
} from '../services/api/contractApi';
import {
  Attachment,
  Business,
  Contract,
  ContractSignerOption,
  ContractTermUnit,
  Customer,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaymentScheduleStatus,
  Product,
  ProductPackage,
  Project,
  ProjectItemMaster,
  ProjectTypeOption,
} from '../types';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../services/v5Api';
import { ContractDetailsTab, type ContractDraftItemComputedRow } from './contract/ContractDetailsTab';
import {
  addUtcDays,
  addUtcMonths,
  clampPercentage,
  formatDisplayDate,
  formatPercentageString,
  formatPreviewMoney,
  parseIsoDate,
  roundMoney,
  todayIsoDate,
  toIsoDate,
} from './contract/contractPaymentUtils';
import { useContractForm } from './contract/hooks/useContractForm';
import { useContractPaymentGeneration } from './contract/hooks/useContractPaymentGeneration';
import { ContractPaymentTab } from './contract/ContractPaymentTab';
import {
  buildContractPackageCatalogValue,
  buildContractProductCatalogValue,
} from './contract/contractItemCatalogUtils';

type ContractModalTab = 'CONTRACT' | 'PAYMENT';
type ContractSourceMode = 'PROJECT' | 'INITIAL';

interface ContractModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  prefill?: Partial<Contract> | null;
  fixedSourceMode?: ContractSourceMode | null;
  projects: Project[];
  projectTypes?: ProjectTypeOption[];
  businesses?: Business[];
  products?: Product[];
  productPackages?: ProductPackage[];
  projectItems?: ProjectItemMaster[];
  customers: Customer[];
  paymentSchedules: PaymentSchedule[];
  isCustomersLoading?: boolean;
  isProjectsLoading?: boolean;
  isProductsLoading?: boolean;
  isProjectItemsLoading?: boolean;
  isDetailLoading?: boolean;
  isPaymentLoading?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contract>) => Promise<void> | void;
  onGenerateSchedules?: (
    contractId: string | number,
    options?: GenerateContractPaymentsPayload
  ) => Promise<GenerateContractPaymentsResult | void>;
  onRefreshSchedules?: (contractId: string | number) => Promise<void>;
  onConfirmPayment?: (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => Promise<void>;
  onDeletePaymentSchedule?: (scheduleId: string | number) => Promise<void>;
}

const PAYMENT_CYCLE_LABELS: Record<PaymentCycle, string> = {
  ONCE: 'Một lần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  HALF_YEARLY: '6 tháng/lần',
  YEARLY: 'Hàng năm',
};

const PAYMENT_CYCLE_OPTIONS: Array<{ value: PaymentCycle; label: string }> = [
  { value: 'ONCE', label: 'Một lần' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'QUARTERLY', label: 'Hàng quý' },
  { value: 'HALF_YEARLY', label: '6 tháng/lần' },
  { value: 'YEARLY', label: 'Hàng năm' },
];

const TERM_UNIT_OPTIONS: Array<{ value: ContractTermUnit; label: string }> = [
  { value: 'MONTH', label: 'Theo tháng' },
  { value: 'DAY', label: 'Theo ngày' },
];

const INVESTMENT_MODE_LABELS: Record<string, string> = {
  DAU_TU: 'Đầu tư',
  THUE_DICH_VU_DACTHU: 'Thuê dịch vụ CNTT đặc thù',
  THUE_DICH_VU_COSAN: 'Thuê dịch vụ CNTT có sẵn',
};

const MAX_CONTRACT_VALUE_INTEGER_DIGITS = 16;
const CONTRACT_ATTACHMENT_ACCEPT = '.pdf,application/pdf';

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

const normalizeCurrencyDigits = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '0';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return String(Math.max(0, Math.trunc(value)));
  }

  const digits = String(value).replace(/\D/g, '');
  if (!digits) {
    return '0';
  }

  return digits.replace(/^0+(?=\d)/, '');
};

const countCurrencyIntegerDigits = (value: unknown): number => normalizeCurrencyDigits(value).length;

const formatCurrencyDigits = (digits: string): string => {
  const normalized = digits.replace(/^0+(?=\d)/, '') || '0';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

const toVietnameseMoneyText = (value: unknown): string => {
  const digits = normalizeCurrencyDigits(value);
  if (!digits || /^0+$/.test(digits)) {
    return 'không đồng';
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

  const normalizedText = parts.join(' ').replace(/\s+/g, ' ').trim();
  return normalizedText ? `${normalizedText} đồng` : 'không đồng';
};

const resolveTermUnitByInvestmentMode = (mode: unknown): ContractTermUnit => {
  const normalized = String(mode || '').trim().toUpperCase();
  return normalized === 'DAU_TU' ? 'DAY' : 'MONTH';
};

const formatCurrency = (value: number | string): string => {
  if (value === '' || value === null || value === undefined) return '';
  const digits = normalizeCurrencyDigits(value);
  return formatCurrencyDigits(digits);
};

const formatQuantity = (value: unknown): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '--';
  }

  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
};

const resolveVatMetaByBusiness = (business: Business | null): { rate: number | null; badge: 'PM' | 'PC' | null } => {
  const domainCode = String(business?.domain_code || '').trim().toUpperCase();
  const domainName = String(business?.domain_name || '').trim().toLowerCase();

  if (
    domainCode.endsWith('_PM')
    || domainName.includes('phần mềm')
  ) {
    return { rate: 10, badge: 'PM' };
  }

  if (
    domainCode.endsWith('_PC')
    || domainName.includes('phần cứng')
  ) {
    return { rate: 8, badge: 'PC' };
  }

  return { rate: null, badge: null };
};

const resolveVatRateByBusiness = (business: Business | null): number | null => {
  return resolveVatMetaByBusiness(business).rate;
};

const normalizeVatRate = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(Math.max(0, Math.min(100, parsed)) * 100) / 100;
};

const normalizeVatAmount = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return roundMoney(Math.max(0, parsed));
};

const computeVatAmountByRate = (amountBeforeVat: number, vatRate: number | null): number | null => {
  if (vatRate === null) {
    return null;
  }

  return roundMoney((roundMoney(Math.max(0, amountBeforeVat)) * vatRate) / 100);
};

const resolveEffectiveVatAmount = (
  storedVatAmount: unknown,
  amountBeforeVat: number,
  vatRate: number | null
): number => {
  const normalizedStoredVatAmount = normalizeVatAmount(storedVatAmount);
  if (
    normalizedStoredVatAmount !== null
    && !(normalizedStoredVatAmount === 0 && vatRate !== null && vatRate > 0 && amountBeforeVat > 0)
  ) {
    return normalizedStoredVatAmount;
  }

  return computeVatAmountByRate(amountBeforeVat, vatRate) ?? 0;
};

const computeContractItemComputedRow = (
  item: {
    product_id: string | number | null | undefined;
    quantity: number | null | undefined;
    unit_price: number | null | undefined;
    vat_rate?: number | null;
    vat_amount?: number | null;
  },
  productById: Map<string, Product>,
  businessById: Map<string, Business>
): ContractDraftItemComputedRow => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);
  const amountBeforeVat = roundMoney(
    Math.max(0, (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0))
  );
  const product = productById.get(String(item.product_id || '')) || null;
  const vatBusinessMeta = resolveVatMetaByBusiness(
    businessById.get(String(product?.domain_id || '')) || null
  );
  const defaultVatRate = vatBusinessMeta.rate;
  const vatRate = normalizeVatRate(item.vat_rate) ?? defaultVatRate;
  const vatAmount = resolveEffectiveVatAmount(item.vat_amount, amountBeforeVat, vatRate);
  const amountWithVat = roundMoney(amountBeforeVat + vatAmount);
  const vatLabel = vatRate !== null ? `${formatPercentageString(vatRate)}%` : '--';

  return {
    product,
    vatRate,
    vatLabel,
    amountBeforeVat,
    vatAmount,
    amountWithVat,
  };
};

const parseCurrency = (value: number | string): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const parsed = Number(normalizeCurrencyDigits(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateValue = (value: unknown): number | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isPdfAttachmentFile = (file: File): boolean => {
  const mimeType = String(file.type || '').trim().toLowerCase();
  const fileName = String(file.name || '').trim().toLowerCase();
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
};

const resolveContractStartDate = (source: Partial<Contract>): Date => {
  const effectiveDate = parseIsoDate(source.effective_date);
  if (effectiveDate) return effectiveDate;

  const signDate = parseIsoDate(source.sign_date);
  if (signDate) return signDate;

  return addUtcDays(parseIsoDate(todayIsoDate()) || new Date(), -1);
};

const modalActionButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-50';

const modalSecondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50';

const resolveContractExpiryByTerm = (source: Partial<Contract>): string | null => {
  const termUnitRaw = String(source.term_unit || '').trim().toUpperCase();
  if (termUnitRaw !== 'MONTH' && termUnitRaw !== 'DAY') {
    return null;
  }

  const termValue = Number(source.term_value);
  if (!Number.isFinite(termValue) || termValue <= 0) {
    return null;
  }

  if (termUnitRaw === 'DAY' && !Number.isInteger(termValue)) {
    return null;
  }

  const startDate = resolveContractStartDate(source);
  if (termUnitRaw === 'DAY') {
    return toIsoDate(addUtcDays(startDate, termValue - 1));
  }

  const months = Math.floor(termValue);
  let days = Math.round((termValue - months) * 30);
  if (months === 0 && days === 0) {
    days = 1;
  }

  const afterMonths = addUtcMonths(startDate, months);
  return toIsoDate(addUtcDays(afterMonths, days - 1));
};

export const ContractModal: React.FC<ContractModalProps> = ({
  type,
  data,
  prefill,
  fixedSourceMode = null,
  projects = [],
  projectTypes = [],
  businesses = [],
  products = [],
  productPackages = [],
  projectItems = [],
  customers = [],
  paymentSchedules = [],
  isCustomersLoading = false,
  isProjectsLoading = false,
  isProductsLoading = false,
  isProjectItemsLoading = false,
  isDetailLoading = false,
  isPaymentLoading = false,
  isSaving = false,
  onClose,
  onSave,
  onGenerateSchedules,
  onRefreshSchedules,
  onConfirmPayment,
  onDeletePaymentSchedule,
}: ContractModalProps) => {
  const [activeTab, setActiveTab] = useState<ContractModalTab>('CONTRACT');
  const [signerOptions, setSignerOptions] = useState<ContractSignerOption[]>([]);
  const [isSignerOptionsLoading, setIsSignerOptionsLoading] = useState(false);
  const [signerOptionsError, setSignerOptionsError] = useState('');
  const [isUploadingContractAttachment, setIsUploadingContractAttachment] = useState(false);
  const [contractAttachmentError, setContractAttachmentError] = useState('');
  const [contractAttachmentNotice, setContractAttachmentNotice] = useState('');
  const contractId = data?.id;
  const schedules = useMemo(
    () => paymentSchedules.filter((item) => String(item.contract_id) === String(contractId || '')),
    [paymentSchedules, contractId]
  );
  const initialFormData = useMemo<Partial<Contract>>(() => {
    const source = (type === 'ADD' ? prefill : data) || {};
    const sourceProject = projects.find((item) => String(item.id) === String(source.project_id || '')) || null;
    const resolvedSourceProject = sourceProject;
    const normalizedSourceProjectTypeCode = String(source.project_type_code || '').trim().toUpperCase();
    const normalizedSourceTermUnit = String(source.term_unit || '').trim().toUpperCase();
    const resolvedInitialTermUnit: ContractTermUnit | null =
      normalizedSourceTermUnit === 'MONTH' || normalizedSourceTermUnit === 'DAY'
        ? (normalizedSourceTermUnit as ContractTermUnit)
        : (resolvedSourceProject
          ? resolveTermUnitByInvestmentMode(resolvedSourceProject.investment_mode)
          : (normalizedSourceProjectTypeCode ? resolveTermUnitByInvestmentMode(normalizedSourceProjectTypeCode) : null));
    const rawTermValue = source.term_value;
    const parsedTermValue = rawTermValue === null || rawTermValue === undefined || String(rawTermValue).trim() === ''
      ? null
      : Number(rawTermValue);
    const normalizedInitialTermValue = Number.isFinite(parsedTermValue) ? parsedTermValue : null;
    const resolvedInitialTermValue = resolvedInitialTermUnit === 'DAY'
      && normalizedInitialTermValue !== null
      && !Number.isInteger(normalizedInitialTermValue)
      ? null
      : normalizedInitialTermValue;
    const todayValue = todayIsoDate();
    const sourceSignDate = String(source.sign_date || '').trim();
    const sourceEffectiveDate = String(source.effective_date || '').trim();

    let normalizedSignDate = sourceSignDate;
    let normalizedEffectiveDate = sourceEffectiveDate;

    // Default one-time sync: sign_date = effective_date when one is missing.
    if (!normalizedSignDate && !normalizedEffectiveDate) {
      normalizedSignDate = todayValue;
      normalizedEffectiveDate = todayValue;
    } else if (!normalizedSignDate && normalizedEffectiveDate) {
      normalizedSignDate = normalizedEffectiveDate;
    } else if (normalizedSignDate && !normalizedEffectiveDate) {
      normalizedEffectiveDate = normalizedSignDate;
    }

    return {
      contract_code: source.contract_code || source.contract_number || '',
      contract_name: source.contract_name || '',
      signer_user_id: source.signer_user_id || '',
      customer_id: fixedSourceMode === 'PROJECT'
        ? (source.customer_id || resolvedSourceProject?.customer_id || '')
        : (source.customer_id || ''),
      project_id: fixedSourceMode === 'INITIAL'
        ? ''
        : (source.project_id || resolvedSourceProject?.id || ''),
      project_type_code: fixedSourceMode === 'PROJECT'
        ? null
        : (normalizedSourceProjectTypeCode || null),
      value: source.value || source.total_value || 0,
      payment_cycle: source.payment_cycle || 'ONCE',
      status: source.status || 'DRAFT',
      sign_date: normalizedSignDate,
      effective_date: normalizedEffectiveDate,
      expiry_date: source.expiry_date || '',
      term_unit: resolvedInitialTermUnit,
      term_value: resolvedInitialTermValue,
      expiry_date_manual_override: Boolean(source.expiry_date_manual_override),
      attachments: Array.isArray(source.attachments) ? source.attachments : [],
    };
  }, [type, prefill, data, projects, fixedSourceMode]);

  const initialProjectForPaymentSettings = useMemo(
    () => projects.find((item) => String(item.id) === String(initialFormData.project_id || '')) || null,
    [projects, initialFormData.project_id]
  );
  const initialProjectInvestmentModeCode = String(
    initialProjectForPaymentSettings?.investment_mode || initialFormData.project_type_code || ''
  ).trim().toUpperCase();

  const backendPaymentScheduleCount = Number(data?.payment_schedule_count || 0);
  const effectivePaymentScheduleCount = Math.max(
    0,
    Number.isFinite(backendPaymentScheduleCount) ? backendPaymentScheduleCount : 0,
    schedules.length
  );
  const hasGeneratedSchedules = Boolean(data?.has_generated_payment_schedules) || effectivePaymentScheduleCount > 0;
  const isScheduleStatusPending = type === 'EDIT' && isPaymentLoading && !hasGeneratedSchedules;
  const canEditScheduleSourceFields = type !== 'EDIT'
    ? true
    : !isScheduleStatusPending && !hasGeneratedSchedules && data?.can_edit_schedule_source_fields !== false;
  const isItemsEditable = canEditScheduleSourceFields;
  const areScheduleSourceFieldsLocked = type === 'EDIT' && !canEditScheduleSourceFields;
  const showEditLoadingState = type === 'EDIT' && isDetailLoading;

  useEscKey(onClose);

  useEffect(() => {
    setActiveTab('CONTRACT');
  }, [initialFormData, type]);

  useEffect(() => {
    setIsUploadingContractAttachment(false);
    setContractAttachmentError('');
    setContractAttachmentNotice('');
  }, [initialFormData, type]);

  useEffect(() => {
    let isMounted = true;

    setIsSignerOptionsLoading(true);
    setSignerOptionsError('');

    void fetchContractSignerOptions()
      .then((rows) => {
        if (!isMounted) {
          return;
        }
        setSignerOptions(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setSignerOptions([]);
        setSignerOptionsError(error instanceof Error ? error.message : 'Không tải được danh sách người ký hợp đồng.');
      })
      .finally(() => {
        if (isMounted) {
          setIsSignerOptionsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'Chọn khách hàng' },
      ...customers.map((customer) => ({
        value: customer.id,
        label: `${customer.customer_code} - ${customer.customer_name}`,
        searchText: `${customer.customer_code || ''} ${customer.customer_name || ''}`.trim(),
      })),
    ],
    [customers]
  );

  const projectTotals = useMemo(() => {
    const totals = new Map<string, number>();
    (projectItems || []).forEach((item) => {
      const projectId = String(item.project_id || '');
      if (!projectId) {
        return;
      }

      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const amount = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      const current = totals.get(projectId) || 0;
      totals.set(projectId, current + Math.max(0, amount));
    });
    return totals;
  }, [projectItems]);

  const cycleSelectOptions = useMemo(
    () => PAYMENT_CYCLE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const statusOptions = useMemo(
    () => CONTRACT_STATUSES.map((item) => ({ value: item.value, label: item.label })),
    []
  );

  const projectTypeOptions = useMemo(() => {
    const source = projectTypes.length > 0
      ? projectTypes.map((item) => ({
          value: String(item.type_code || '').trim().toUpperCase(),
          label: item.type_name || String(item.type_code || '').trim().toUpperCase(),
        }))
      : Object.entries(INVESTMENT_MODE_LABELS).map(([value, label]) => ({ value, label }));

    const seen = new Set<string>();
    return source.filter((item) => {
      const key = String(item.value || '').trim().toUpperCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [projectTypes]);

  const projectOptions = useMemo(
    () => (projects || []).map((project) => {
      const normalizedMode = String(project.investment_mode || '').trim().toUpperCase();
      const customer = customers.find((item) => String(item.id) === String(project.customer_id || '')) || null;
      const customerLabel = customer ? `${customer.customer_code} - ${customer.customer_name}` : 'Chưa gắn khách hàng';
      const projectTypeLabel = projectTypeOptions.find((item) => String(item.value) === normalizedMode)?.label
        || INVESTMENT_MODE_LABELS[normalizedMode]
        || normalizedMode
        || '--';

      return {
        value: project.id,
        label: `${project.project_code} - ${project.project_name}`,
        searchText: `${project.project_code || ''} ${project.project_name || ''} ${customerLabel} ${projectTypeLabel}`.trim(),
      };
    }),
    [customers, projectTypeOptions, projects]
  );

  const contractSignerOptions = useMemo(() => {
    const fallbackSigner = (type === 'ADD' ? prefill : data) || {};
    const fallbackSignerId = fallbackSigner.signer_user_id;
    const fallbackDepartmentId = fallbackSigner.dept_id;
    const fallbackOption = fallbackSignerId
      ? {
          id: fallbackSignerId,
          user_code: fallbackSigner.signer_user_code || null,
          full_name: fallbackSigner.signer_full_name || null,
          department_id: fallbackDepartmentId || 0,
          dept_code: fallbackSigner.dept_code || null,
          dept_name: fallbackSigner.dept_name || null,
        }
      : null;

    if (
      fallbackOption
      && !signerOptions.some((item) => String(item.id) === String(fallbackOption.id))
      && String(fallbackOption.department_id || '').trim() !== ''
    ) {
      return [...signerOptions, fallbackOption];
    }

    return signerOptions;
  }, [data, prefill, signerOptions, type]);

  const signerSelectOptions = useMemo(
    () => [
      { value: '', label: 'Chọn người ký hợp đồng' },
      ...contractSignerOptions.map((signer) => {
        const userCode = String(signer.user_code || '').trim();
        const fullName = String(signer.full_name || '').trim();
        const deptCode = String(signer.dept_code || '').trim();
        const deptName = String(signer.dept_name || '').trim();
        const signerLabel = [userCode, fullName].filter(Boolean).join(' - ') || `Nhân sự #${signer.id}`;
        const searchText = [userCode, fullName, deptCode, deptName].filter(Boolean).join(' ').trim();

        return {
          value: signer.id,
          label: signerLabel,
          searchText,
        };
      }),
    ],
    [contractSignerOptions]
  );

  const productById = useMemo(() => {
    const next = new Map<string, Product>();
    (products || []).forEach((product) => {
      next.set(String(product.id), product);
    });
    return next;
  }, [products]);

  const packageById = useMemo(() => {
    const next = new Map<string, ProductPackage>();
    (productPackages || []).forEach((productPackage) => {
      next.set(String(productPackage.id), productPackage);
    });
    return next;
  }, [productPackages]);

  const businessById = useMemo(() => {
    const next = new Map<string, Business>();
    businesses.forEach((business) => {
      next.set(String(business.id), business);
    });
    return next;
  }, [businesses]);

  const {
    errors,
    inlineNotice,
    setInlineNotice,
    formData,
    contractSourceMode,
    draftItems,
    isProjectItemsReferenceOpen,
    expiryDateManualOverride,
    handleFieldBlur,
    handleChange,
    handleContractSourceModeChange,
    handleAddDraftItem,
    handleRemoveDraftItem,
    handleDraftItemChange,
    handleDraftProductChange,
    handleDraftVatAmountChange,
    handleImportProjectItems,
    handleExpiryDateChange,
    handleRecalculateExpiryDate,
    handleToggleProjectItemsReference,
    handleSave,
  } = useContractForm({
    type,
    data,
    initialFormData,
    projects,
    projectTotals,
    productById,
    packageById,
    businessById,
    contractId,
    areScheduleSourceFieldsLocked,
    isItemsEditable,
    maxContractValueIntegerDigits: MAX_CONTRACT_VALUE_INTEGER_DIGITS,
    onSave,
    countCurrencyIntegerDigits,
    parseCurrency,
    parseDateValue,
    todayIsoDate,
    resolveContractExpiryByTerm,
    resolveTermUnitByInvestmentMode,
    normalizeVatRate,
    normalizeVatAmount,
    computeVatAmountByRate,
    resolveEffectiveVatAmount,
    resolveVatRateByBusiness,
    roundMoney,
    fixedSourceMode,
  });

  const selectedProject = useMemo(
    () => projects.find((item) => String(item.id) === String(formData.project_id || '')) || null,
    [projects, formData.project_id]
  );
  const contractAttachments = useMemo<Attachment[]>(
    () => (Array.isArray(formData.attachments) ? formData.attachments : []),
    [formData.attachments]
  );

  const selectedSigner = useMemo(
    () => contractSignerOptions.find((item) => String(item.id) === String(formData.signer_user_id || '')) || null,
    [contractSignerOptions, formData.signer_user_id]
  );

  const productSelectOptions = useMemo(
    () => {
      const options: Array<{
        value: string;
        label: string;
        searchText: string;
      }> = [];
      const seen = new Set<string>();

      (productPackages || []).forEach((productPackage) => {
        const optionValue = buildContractPackageCatalogValue(productPackage.id);
        if (!optionValue || seen.has(optionValue)) {
          return;
        }

        const parentProduct = productById.get(String(productPackage.product_id ?? '').trim()) || null;
        const packageName = String(productPackage.package_name || '').trim();
        const fallbackName = String(productPackage.product_name || '').trim()
          || String(parentProduct?.product_name || '').trim();
        const label = packageName || fallbackName || String(productPackage.package_code || '').trim() || `Gói cước #${productPackage.id}`;
        const resolvedUnit = String(productPackage.unit || '').trim() || String(parentProduct?.unit || '').trim();

        options.push({
          value: optionValue,
          label,
          searchText: [
            productPackage.package_code,
            productPackage.package_name,
            productPackage.product_name,
            productPackage.parent_product_code,
            parentProduct?.product_code,
            parentProduct?.product_name,
            resolvedUnit,
          ]
            .filter(Boolean)
            .join(' '),
        });
        seen.add(optionValue);
      });

      draftItems.forEach((item) => {
        const packageId = String(item.productPackageId ?? item.product_package_id ?? '').trim();
        if (packageId) {
          return;
        }

        const productId = String(item.product_id ?? '').trim();
        if (!productId) {
          return;
        }

        const product = productById.get(productId);
        if (!product) {
          return;
        }

        const optionValue = buildContractProductCatalogValue(product.id);
        if (!optionValue || seen.has(optionValue)) {
          return;
        }

        options.push({
          value: optionValue,
          label: String(item.product_name || '').trim() || product.product_name || product.product_code || `Sản phẩm #${product.id}`,
          searchText: [
            product.product_code,
            product.product_name,
            item.product_name,
            product.unit,
            item.unit,
          ]
            .filter(Boolean)
            .join(' '),
        });
        seen.add(optionValue);
      });

      return options;
    },
    [draftItems, productById, productPackages]
  );

  const selectedProjectCustomer = useMemo(
    () => customers.find((item) => String(item.id) === String(selectedProject?.customer_id || '')) || null,
    [customers, selectedProject]
  );

  const selectedProjectValue = useMemo(
    () => Number(projectTotals.get(String(formData.project_id || '')) || 0),
    [projectTotals, formData.project_id]
  );

  const selectedProjectItems = useMemo(
    () => (projectItems || []).filter((item) => String(item.project_id || '') === String(formData.project_id || '')),
    [projectItems, formData.project_id]
  );
  const currentContractMode = contractSourceMode;
  const isProjectSelectionLoading = isProjectsLoading && projects.length === 0;
  const isInitialCustomerSelectionLoading = isCustomersLoading && customers.length === 0;
  const isContractProductOptionsLoading = (
    (isProductsLoading && products.length === 0 && productPackages.length === 0)
    || (isProjectItemsLoading && String(formData.project_id || '').trim() !== '' && selectedProjectItems.length === 0)
  );
  const isContractProjectReferenceLoading = (
    isProjectItemsLoading
    && String(formData.project_id || '').trim() !== ''
    && selectedProjectItems.length === 0
  );

  const selectedProjectInvestmentModeCode = useMemo(
    () => String(selectedProject?.investment_mode || formData.project_type_code || '').trim().toUpperCase(),
    [formData.project_type_code, selectedProject?.investment_mode]
  );

  const selectedProjectInvestmentModeLabel = useMemo(() => {
    const normalized = selectedProjectInvestmentModeCode;
    if (!normalized) {
      return '--';
    }

    const dynamicLabel = projectTypeOptions.find((item) => String(item.value) === normalized)?.label;
    return dynamicLabel || INVESTMENT_MODE_LABELS[normalized] || normalized;
  }, [projectTypeOptions, selectedProjectInvestmentModeCode]);
  const selectedSignerDepartmentLabel = useMemo(() => {
    if (!selectedSigner) {
      return '';
    }

    const deptCode = String(selectedSigner.dept_code || '').trim();
    const deptName = String(selectedSigner.dept_name || '').trim();
    if (!deptCode && !deptName) {
      return 'Chưa xác định phòng ban của người ký.';
    }

    return [deptCode, deptName].filter(Boolean).join(' - ');
  }, [selectedSigner]);
  const draftItemComputedRows = useMemo(
    () => draftItems.map((item) => computeContractItemComputedRow(item, productById, businessById)),
    [businessById, draftItems, productById]
  );
  const draftItemsTotal = useMemo(
    () => roundMoney(draftItemComputedRows.reduce((sum, item) => sum + item.amountBeforeVat, 0)),
    [draftItemComputedRows]
  );
  const draftItemsVatTotal = useMemo(
    () => roundMoney(draftItemComputedRows.reduce((sum, item) => sum + item.vatAmount, 0)),
    [draftItemComputedRows]
  );
  const draftItemsGrandTotal = useMemo(
    () => roundMoney(draftItemComputedRows.reduce((sum, item) => sum + item.amountWithVat, 0)),
    [draftItemComputedRows]
  );
  const projectFallbackComputedRows = useMemo(
    () => selectedProjectItems.map((item) => {
      const fallbackVatSource = item as ProjectItemMaster & {
        vat_rate?: number | null;
        vat_amount?: number | null;
      };

      return computeContractItemComputedRow(
        {
          product_id: item.product_id,
          quantity: item.quantity ?? 0,
          unit_price: item.unit_price ?? 0,
          vat_rate: fallbackVatSource.vat_rate ?? null,
          vat_amount: fallbackVatSource.vat_amount ?? null,
        },
        productById,
        businessById
      );
    }),
    [businessById, productById, selectedProjectItems]
  );
  const projectFallbackTotal = useMemo(
    () => roundMoney(projectFallbackComputedRows.reduce((sum, item) => sum + item.amountBeforeVat, 0)),
    [projectFallbackComputedRows]
  );
  const projectFallbackVatTotal = useMemo(
    () => roundMoney(projectFallbackComputedRows.reduce((sum, item) => sum + item.vatAmount, 0)),
    [projectFallbackComputedRows]
  );
  const projectFallbackGrandTotal = useMemo(
    () => roundMoney(projectFallbackComputedRows.reduce((sum, item) => sum + item.amountWithVat, 0)),
    [projectFallbackComputedRows]
  );

  const isStatusDraft = String(formData.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
  const contractValueNumber = parseCurrency(formData.value || 0);
  const valueInWords = toVietnameseMoneyText(formData.value || 0);
  const showZeroValueWarning = contractValueNumber === 0;
  const scheduleSourceLockMessage = isScheduleStatusPending
    ? 'Đang kiểm tra lịch thu tiền của hợp đồng. Vui lòng chờ trong giây lát trước khi cập nhật.'
    : effectivePaymentScheduleCount > 0
      ? `Hợp đồng đã có ${effectivePaymentScheduleCount} kỳ thanh toán. Muốn đổi chu kỳ, giá trị hoặc thời hạn, hãy ${
          data?.can_delete_unpaid_schedules
            ? 'xóa toàn bộ kỳ chưa thu tiền trong tab Dòng tiền trước.'
            : 'xử lý các kỳ thu hiện có trước.'
        }`
      : 'Các trường nguồn dòng tiền đang sẵn sàng để cập nhật.';
  const projectTypeLockMessage = 'Đã phát sinh kỳ thanh toán nên không thể đổi nguồn hợp đồng hoặc loại dự án.';
  const isProjectSelectionDisabled = isProjectSelectionLoading || areScheduleSourceFieldsLocked;
  const isInitialCustomerSelectionDisabled = isInitialCustomerSelectionLoading || areScheduleSourceFieldsLocked;
  const isInitialProjectTypeSelectionDisabled = areScheduleSourceFieldsLocked;
  const paymentGeneration = useContractPaymentGeneration({
    type,
    activeTab,
    contractId,
    initialFormData,
    formData,
    schedules,
    initialProjectInvestmentModeCode,
    selectedProjectInvestmentModeCode,
    contractValueNumber,
    draftItemsCount: draftItems.length,
    isPaymentLoading,
    setInlineNotice,
    onGenerateSchedules,
  });

  const handleConfirmPayment = async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => {
    if (!onConfirmPayment) return;
    await onConfirmPayment(scheduleId, payload);
  };

  const handleDeletePaymentSchedule = async (scheduleId: string | number) => {
    if (!onDeletePaymentSchedule) return;
    await onDeletePaymentSchedule(scheduleId);
  };

  const contractPaymentCycleLabel =
    PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần';
  const contractDisplayCode = String(formData.contract_code || data?.contract_code || '');
  const contractDisplayName = String(formData.contract_name || data?.contract_name || '');
  const handlePaymentScheduleConfirm = (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => handleConfirmPayment(scheduleId, {
    actual_paid_date: payload.actual_paid_date || todayIsoDate(),
    actual_paid_amount: Number(payload.actual_paid_amount || 0),
    status: (payload.status || 'PAID') as PaymentScheduleStatus,
    notes: payload.notes || null,
    attachments: payload.attachments || [],
  });

  const handleContractAttachmentUpload = async (file: File) => {
    setContractAttachmentError('');
    setContractAttachmentNotice('');

    if (!isPdfAttachmentFile(file)) {
      setContractAttachmentError('Chỉ cho phép tải lên file PDF cho hợp đồng.');
      return;
    }

    setIsUploadingContractAttachment(true);
    try {
      const uploaded = await uploadDocumentAttachment(file);
      handleChange('attachments', [...contractAttachments, uploaded]);
      if (String(uploaded.warningMessage || '').trim() !== '') {
        setContractAttachmentNotice(String(uploaded.warningMessage || '').trim());
      }
    } catch (error) {
      setContractAttachmentError(error instanceof Error ? error.message : 'Tải file PDF thất bại.');
    } finally {
      setIsUploadingContractAttachment(false);
    }
  };

  const handleContractAttachmentDelete = async (id: string) => {
    const targetAttachment = contractAttachments.find((attachment) => String(attachment.id) === String(id));
    if (!targetAttachment) {
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa file hợp đồng này?')) {
      return;
    }

    setContractAttachmentError('');
    setContractAttachmentNotice('');

    try {
      const attachmentId = /^\d+$/.test(String(targetAttachment.id)) ? Number(targetAttachment.id) : null;
      await deleteUploadedDocumentAttachment({
        attachmentId,
        driveFileId: targetAttachment.driveFileId || null,
        fileUrl: targetAttachment.fileUrl || null,
        storagePath: targetAttachment.storagePath || null,
        storageDisk: targetAttachment.storageDisk || null,
      });

      handleChange(
        'attachments',
        contractAttachments.filter((attachment) => String(attachment.id) !== String(id))
      );
      setContractAttachmentNotice('Đã gỡ file hợp đồng khỏi biểu mẫu.');
    } catch (error) {
      setContractAttachmentError(error instanceof Error ? error.message : 'Không thể xóa file hợp đồng. Vui lòng thử lại.');
    }
  };

  const modalTitle = type === 'ADD'
    ? (fixedSourceMode === 'INITIAL' ? 'Thêm mới hợp đồng đầu kỳ' : 'Thêm mới hợp đồng')
    : 'Cập nhật hợp đồng';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className="relative flex max-h-[94vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl xl:max-w-[1400px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-secondary/15">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                description
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-6 text-deep-teal">
                {modalTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        {type === 'EDIT' && (
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="inline-flex rounded border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('CONTRACT')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold leading-5 transition-colors ${
                activeTab === 'CONTRACT' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                description
              </span>
              Thông tin hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAYMENT')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold leading-5 transition-colors ${
                activeTab === 'PAYMENT' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                payments
              </span>
              Dòng tiền
            </button>
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {showEditLoadingState ? (
            <div className="flex min-h-[320px] items-center justify-center px-4 py-8">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold leading-[18px] text-slate-600">
                <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 16 }}>
                  progress_activity
                </span>
                Đang tải chi tiết hợp đồng...
              </div>
            </div>
          ) : (type === 'ADD' || activeTab === 'CONTRACT') && (
            <ContractDetailsTab
              modalType={type}
              formData={formData}
              errors={errors}
              sourceMode={currentContractMode}
              sourceSelection={{
                fixedSourceMode,
                areScheduleSourceFieldsLocked,
                projectTypeLockMessage,
                isProjectSelectionLoading,
                isInitialCustomerSelectionLoading,
                isProjectSelectionDisabled,
                isInitialCustomerSelectionDisabled,
                isInitialProjectTypeSelectionDisabled,
                customerOptions,
                projectOptions,
                projectTypeOptions,
                onSourceModeChange: handleContractSourceModeChange,
              }}
              projectReference={{
                selectedProject,
                selectedProjectCustomerName: selectedProjectCustomer?.customer_name || '--',
                selectedProjectValue,
                selectedProjectItems,
                selectedProjectInvestmentModeLabel,
                isProjectItemsReferenceOpen,
                isContractProjectReferenceLoading,
                onToggleProjectItemsReference: handleToggleProjectItemsReference,
              }}
              contractItems={{
                draftItems,
                computedRows: draftItemComputedRows,
                draftItemsTotal,
                draftItemsVatTotal,
                draftItemsGrandTotal,
                projectFallbackComputedRows,
                projectFallbackTotal,
                projectFallbackVatTotal,
                projectFallbackGrandTotal,
                isItemsEditable,
                isContractProductOptionsLoading,
                productSelectOptions,
                onAddDraftItem: handleAddDraftItem,
                onImportProjectItems: () => handleImportProjectItems(selectedProjectItems),
                onRemoveDraftItem: handleRemoveDraftItem,
                onDraftProductChange: handleDraftProductChange,
                onDraftItemChange: handleDraftItemChange,
                onDraftVatAmountChange: handleDraftVatAmountChange,
              }}
              signerSelection={{
                signerOptions: signerSelectOptions,
                isSignerOptionsLoading,
                signerOptionsError,
                selectedSignerDepartmentLabel,
              }}
              contractAttachments={{
                attachments: contractAttachments,
                isUploading: isUploadingContractAttachment,
                error: contractAttachmentError,
                notice: contractAttachmentNotice,
                accept: CONTRACT_ATTACHMENT_ACCEPT,
                onUpload: handleContractAttachmentUpload,
                onDelete: handleContractAttachmentDelete,
              }}
              contractMeta={{
                inlineNotice,
                scheduleSourceLockMessage,
                isStatusDraft,
                showZeroValueWarning,
                valueInWords,
                expiryDateManualOverride,
                statusOptions,
                cycleSelectOptions,
                onRecalculateExpiryDate: handleRecalculateExpiryDate,
              }}
              callbacks={{
                onFieldChange: handleChange,
                onFieldBlur: handleFieldBlur,
                onExpiryDateChange: handleExpiryDateChange,
              }}
              formatters={{
                formatCurrency,
                formatQuantity,
                parseCurrency,
              }}
            />
          )}

          {type === 'EDIT' && activeTab === 'PAYMENT' && (
            <ContractPaymentTab
              contractSummary={{
                contractCode: contractDisplayCode,
                contractName: contractDisplayName,
                paymentCycleLabel: contractPaymentCycleLabel,
                investmentModeLabel: selectedProjectInvestmentModeLabel,
                contractValueNumber,
              }}
              allocation={paymentGeneration.allocation}
              generation={paymentGeneration.generation}
              preview={paymentGeneration.preview}
              paymentSchedule={{
                schedules,
                isLoading: isPaymentLoading,
                onRefresh: contractId && onRefreshSchedules ? () => onRefreshSchedules(contractId) : undefined,
                onConfirmPayment: handlePaymentScheduleConfirm,
                onDeletePaymentSchedule: handleDeletePaymentSchedule,
              }}
              formatters={{
                formatCurrency,
                formatPreviewMoney,
                formatDisplayDate,
                formatPercentageString,
                clampPercentage,
              }}
            />
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button type="button" onClick={onClose} className={modalSecondaryButtonClass}>
            Hủy
          </button>
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={showEditLoadingState || isSaving || isScheduleStatusPending}
              className={modalActionButtonClass}
            >
              {isSaving ? (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  save
                </span>
              )}{' '}
              {isSaving ? 'Đang lưu...' : type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
