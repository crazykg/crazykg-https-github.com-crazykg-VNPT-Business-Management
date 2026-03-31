import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { CircleDollarSign, Loader2 } from 'lucide-react';
import { CONTRACT_STATUSES } from '../constants';
import type {
  GenerateContractPaymentsPayload,
  GenerateContractPaymentsResult,
} from '../services/api/contractApi';
import {
  Business,
  Contract,
  ContractTermUnit,
  Customer,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaymentScheduleStatus,
  Product,
  Project,
  ProjectItemMaster,
  ProjectTypeOption,
} from '../types';
import { ContractDetailsTab } from './contract/ContractDetailsTab';
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

type ContractModalTab = 'CONTRACT' | 'PAYMENT';
type ContractSourceMode = 'PROJECT' | 'INITIAL';

interface ContractModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  prefill?: Partial<Contract> | null;
  projects: Project[];
  projectTypes?: ProjectTypeOption[];
  businesses?: Business[];
  products?: Product[];
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

const resolveContractStartDate = (source: Partial<Contract>): Date => {
  const effectiveDate = parseIsoDate(source.effective_date);
  if (effectiveDate) return effectiveDate;

  const signDate = parseIsoDate(source.sign_date);
  if (signDate) return signDate;

  return addUtcDays(parseIsoDate(todayIsoDate()) || new Date(), -1);
};

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
  projects = [],
  projectTypes = [],
  businesses = [],
  products = [],
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
}: ContractModalProps) => {
  const [activeTab, setActiveTab] = useState<ContractModalTab>('CONTRACT');
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
      customer_id: source.customer_id || resolvedSourceProject?.customer_id || '',
      project_id: source.project_id || resolvedSourceProject?.id || '',
      project_type_code: normalizedSourceProjectTypeCode || null,
      value: source.value || source.total_value || 0,
      payment_cycle: source.payment_cycle || 'ONCE',
      status: source.status || 'DRAFT',
      sign_date: normalizedSignDate,
      effective_date: normalizedEffectiveDate,
      expiry_date: source.expiry_date || '',
      term_unit: resolvedInitialTermUnit,
      term_value: resolvedInitialTermValue,
      expiry_date_manual_override: Boolean(source.expiry_date_manual_override),
    };
  }, [type, prefill, data, projects]);

  const initialProjectForPaymentSettings = useMemo(
    () => projects.find((item) => String(item.id) === String(initialFormData.project_id || '')) || null,
    [projects, initialFormData.project_id]
  );
  const initialProjectInvestmentModeCode = String(
    initialProjectForPaymentSettings?.investment_mode || initialFormData.project_type_code || ''
  ).trim().toUpperCase();

  const hasGeneratedSchedules = schedules.length > 0;
  const isItemsEditable = !hasGeneratedSchedules;
  const areScheduleSourceFieldsLocked = type === 'EDIT' && hasGeneratedSchedules;
  const showEditLoadingState = type === 'EDIT' && isDetailLoading;

  useEscKey(onClose);

  useEffect(() => {
    setActiveTab('CONTRACT');
  }, [initialFormData, type]);

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

  const productById = useMemo(() => {
    const next = new Map<string, Product>();
    (products || []).forEach((product) => {
      next.set(String(product.id), product);
    });
    return next;
  }, [products]);

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
  });

  const selectedProject = useMemo(
    () => projects.find((item) => String(item.id) === String(formData.project_id || '')) || null,
    [projects, formData.project_id]
  );

  const productSelectOptions = useMemo(
    () => (products || []).map((product) => ({
      value: product.id,
      label: product.product_name || product.product_code || `Sản phẩm #${product.id}`,
      searchText: `${product.product_code || ''} ${product.product_name || ''}`.trim(),
    })),
    [products]
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
    (isProductsLoading && products.length === 0)
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
  const draftItemComputedRows = useMemo(
    () => draftItems.map((item) => {
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
    }),
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

  const isStatusDraft = String(formData.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
  const contractValueNumber = parseCurrency(formData.value || 0);
  const valueInWords = toVietnameseMoneyText(formData.value || 0);
  const showZeroValueWarning = contractValueNumber === 0;
  const scheduleSourceLockMessage = 'Các trường này đã khóa vì hợp đồng đã sinh kỳ thanh toán. Muốn điều chỉnh, hãy xử lý lại lịch thu tiền trước.';
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white w-full rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]"
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 text-slate-900">
            <span className="material-symbols-outlined text-primary text-2xl">description</span>
            <h2 className="text-lg md:text-xl font-bold leading-tight tracking-tight line-clamp-1">
              {type === 'ADD' ? 'Thêm mới Hợp đồng' : 'Cập nhật Hợp đồng'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {type === 'EDIT' && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('CONTRACT')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'CONTRACT' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Thông tin hợp đồng
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAYMENT')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                activeTab === 'PAYMENT' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CircleDollarSign className="w-4 h-4" />
              Dòng tiền
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {showEditLoadingState ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 py-10">
              <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Đang tải chi tiết hợp đồng...
              </div>
            </div>
          ) : (type === 'ADD' || activeTab === 'CONTRACT') && (
            <ContractDetailsTab
              formData={formData}
              errors={errors}
              sourceMode={currentContractMode}
              sourceSelection={{
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
                isItemsEditable,
                isContractProductOptionsLoading,
                productSelectOptions,
                onAddDraftItem: handleAddDraftItem,
                onRemoveDraftItem: handleRemoveDraftItem,
                onDraftProductChange: handleDraftProductChange,
                onDraftItemChange: handleDraftItemChange,
                onDraftVatAmountChange: handleDraftVatAmountChange,
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

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">
            Hủy
          </button>
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
            <button
              onClick={handleSave}
              disabled={showEditLoadingState || isSaving}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">check</span>
              )}{' '}
              {isSaving ? 'Đang lưu...' : type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
