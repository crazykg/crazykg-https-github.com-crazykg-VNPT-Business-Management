import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { AlertCircle, CircleDollarSign, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { CONTRACT_STATUSES } from '../constants';
import type {
  ContractMilestoneInstallmentInput,
  ContractPaymentAllocationMode,
  GenerateContractPaymentsPayload,
  GenerateContractPaymentsResult,
} from '../services/v5Api';
import {
  Contract,
  ContractItem,
  ContractTermUnit,
  Customer,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
  PaymentScheduleStatus,
  Product,
  Project,
  ProjectItemMaster,
} from '../types';
import { PaymentScheduleTab } from './PaymentScheduleTab';
import { SearchableSelect } from './SearchableSelect';

type ContractModalTab = 'CONTRACT' | 'PAYMENT';

interface ContractModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  prefill?: Partial<Contract> | null;
  projects: Project[];
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

const ALLOCATION_MODE_OPTIONS: Array<{ value: ContractPaymentAllocationMode; label: string }> = [
  { value: 'EVEN', label: 'Chia đều' },
  { value: 'MILESTONE', label: 'Tạm ứng + Đợt (Đầu tư)' },
];

const TERM_UNIT_OPTIONS: Array<{ value: ContractTermUnit; label: string }> = [
  { value: 'MONTH', label: 'Theo tháng' },
  { value: 'DAY', label: 'Theo ngày' },
];

const INVESTMENT_MODE_LABELS: Record<string, string> = {
  DAU_TU: 'Đầu tư',
  THUE_DICH_VU_DACTHU: 'Thuê dịch vụ CNTT đặc thù',
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

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const parseIsoDate = (value: unknown): Date | null => {
  const raw = String(value || '').trim();
  const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addUtcMonths = (value: Date, months: number): Date => {
  const next = new Date(value.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const startOfUtcMonth = (value: Date): Date => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const clampPercentage = (rawValue: unknown, fallback = 0): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
};

const roundMoney = (value: number): number => Math.round(Math.max(0, value) * 100) / 100;

const formatPreviewMoney = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDisplayDate = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString('vi-VN');
};

const normalizeTextForComparison = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const inferAllocationModeFromSchedules = (
  items: PaymentSchedule[],
  projectInvestmentModeCode: string
): ContractPaymentAllocationMode | null => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const normalizedMilestoneNames = items
    .map((item) => normalizeTextForComparison(item.milestone_name))
    .filter((item) => item !== '');

  if (normalizedMilestoneNames.length === 0) {
    return projectInvestmentModeCode === 'DAU_TU' ? 'MILESTONE' : 'EVEN';
  }

  if (normalizedMilestoneNames.some((name) =>
    name.includes('TAM UNG') || name.includes('QUYET TOAN') || name.includes('THANH TOAN DOT')
  )) {
    return 'MILESTONE';
  }

  const areCycleLabels = normalizedMilestoneNames.every((name) =>
    name === 'THANH TOAN MOT LAN'
    || name.startsWith('THANH TOAN KY ')
    || name.startsWith('PHI DICH VU KY ')
  );

  if (areCycleLabels) {
    return 'EVEN';
  }

  return projectInvestmentModeCode === 'DAU_TU' ? 'MILESTONE' : 'EVEN';
};

const resolveContractGenerationStartIso = (source: Partial<Contract>): string | null => {
  const effectiveDate = parseIsoDate(source.effective_date);
  if (effectiveDate) return toIsoDate(effectiveDate);

  const signDate = parseIsoDate(source.sign_date);
  if (signDate) return toIsoDate(signDate);

  return null;
};

type MilestonePreviewTone = 'ADVANCE' | 'INSTALLMENT' | 'RETENTION';
type MilestoneInputMode = 'AUTO' | 'CUSTOM';

interface MilestoneInstallmentDraft {
  label: string;
  percentage: string;
  expected_date: string;
}

interface MilestonePreviewRow {
  milestoneName: string;
  expectedDate: string;
  expectedAmount: number;
  tone: MilestonePreviewTone;
}

const formatPercentageString = (value: number): string => String(Number(roundMoney(value).toFixed(2)));

const buildMilestoneInstallmentPreviewDates = (
  startIso: string,
  endIso: string,
  installmentCount: number,
  hasAdvance: boolean,
  hasRetention: boolean
): string[] => {
  if (installmentCount <= 0) {
    return [];
  }

  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end || end.getTime() <= start.getTime()) {
    return Array.from({ length: installmentCount }, () => startIso);
  }

  const startMonth = startOfUtcMonth(start);
  const endMonth = startOfUtcMonth(end);
  const monthSpan = Math.max(
    1,
    ((endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) * 12) + (endMonth.getUTCMonth() - startMonth.getUTCMonth())
  );

  return Array.from({ length: installmentCount }, (_, index) => {
    const position = index + 1;

    let rawOffsetMonths = 0;
    if (hasAdvance && hasRetention) {
      rawOffsetMonths = (monthSpan / (installmentCount + 1)) * position;
    } else if (hasAdvance && !hasRetention) {
      rawOffsetMonths = (monthSpan / installmentCount) * position;
    } else if (!hasAdvance && hasRetention) {
      rawOffsetMonths = (monthSpan / (installmentCount + 1)) * position;
    } else {
      rawOffsetMonths = installmentCount === 1 ? monthSpan : (monthSpan / Math.max(1, installmentCount - 1)) * index;
    }

    const offsetMonths = Math.ceil(Math.max(0, rawOffsetMonths) - 0.000001);
    const candidate = startOfUtcMonth(addUtcMonths(startMonth, offsetMonths));
    const clamped = candidate.getTime() < start.getTime()
      ? start
      : candidate.getTime() > end.getTime()
      ? end
      : candidate;

    return toIsoDate(clamped);
  });
};

const buildMilestonePreviewRows = (
  totalAmount: number,
  startIso: string,
  endIso: string,
  advancePercentage: number,
  retentionPercentage: number,
  installmentCount: number,
  customInstallments: ContractMilestoneInstallmentInput[] = []
): MilestonePreviewRow[] => {
  const safeTotal = roundMoney(totalAmount);
  const safeAdvancePercentage = clampPercentage(advancePercentage, 15);
  const safeRetentionPercentage = clampPercentage(retentionPercentage, 5);
  const hasCustomInstallments = customInstallments.length > 0;
  const safeInstallmentCount = hasCustomInstallments
    ? customInstallments.length
    : Math.max(1, Math.min(50, Math.round(installmentCount || 3)));

  const advanceAmount = roundMoney((safeTotal * safeAdvancePercentage) / 100);
  const retentionAmount = roundMoney((safeTotal * safeRetentionPercentage) / 100);
  const installmentDates = buildMilestoneInstallmentPreviewDates(
    startIso,
    endIso,
    safeInstallmentCount,
    safeAdvancePercentage > 0,
    safeRetentionPercentage > 0
  );

  const rows: MilestonePreviewRow[] = [];

  if (safeAdvancePercentage > 0) {
    rows.push({
      milestoneName: 'Tạm ứng',
      expectedDate: startIso,
      expectedAmount: advanceAmount,
      tone: 'ADVANCE',
    });
  }

  if (hasCustomInstallments) {
    customInstallments.forEach((installment, index) => {
      rows.push({
        milestoneName: String(installment.label || '').trim() || `Thanh toán đợt ${index + 1}`,
        expectedDate: parseIsoDate(installment.expected_date)
          ? String(installment.expected_date)
          : (installmentDates[index] || endIso),
        expectedAmount: roundMoney((safeTotal * clampPercentage(installment.percentage, 0)) / 100),
        tone: 'INSTALLMENT',
      });
    });
  } else {
    const installmentPool = roundMoney(safeTotal - advanceAmount - retentionAmount);
    const baseInstallmentAmount = safeInstallmentCount > 0 ? roundMoney(installmentPool / safeInstallmentCount) : 0;

    for (let index = 0; index < safeInstallmentCount; index += 1) {
      const isLastInstallment = index === safeInstallmentCount - 1;
      const precedingInstallmentTotal = baseInstallmentAmount * Math.max(0, safeInstallmentCount - 1);
      const installmentAmount = isLastInstallment
        ? roundMoney(installmentPool - precedingInstallmentTotal)
        : baseInstallmentAmount;

      rows.push({
        milestoneName: `Thanh toán đợt ${index + 1}`,
        expectedDate: installmentDates[index] || endIso,
        expectedAmount: installmentAmount,
        tone: 'INSTALLMENT',
      });
    }
  }

  if (safeRetentionPercentage > 0) {
    rows.push({
      milestoneName: 'Quyết toán',
      expectedDate: endIso,
      expectedAmount: retentionAmount,
      tone: 'RETENTION',
    });
  }

  if (rows.length > 0) {
    const allocatedTotal = roundMoney(rows.reduce((sum, row) => sum + row.expectedAmount, 0));
    const diff = roundMoney(safeTotal - allocatedTotal);
    if (Math.abs(diff) >= 0.01) {
      rows[rows.length - 1] = {
        ...rows[rows.length - 1],
        expectedAmount: roundMoney(rows[rows.length - 1].expectedAmount + diff),
      };
    }
  }

  return rows;
};

const buildMilestoneInstallmentDrafts = (
  startIso: string,
  endIso: string,
  advancePercentage: number,
  retentionPercentage: number,
  installmentCount: number
): MilestoneInstallmentDraft[] => {
  const safeAdvancePercentage = clampPercentage(advancePercentage, 15);
  const safeRetentionPercentage = clampPercentage(retentionPercentage, 5);
  const safeInstallmentCount = Math.max(1, Math.min(50, Math.round(installmentCount || 3)));
  const remainingPercentage = roundMoney(Math.max(0, 100 - safeAdvancePercentage - safeRetentionPercentage));
  const basePercentage = safeInstallmentCount > 0 ? roundMoney(remainingPercentage / safeInstallmentCount) : 0;
  const installmentDates = buildMilestoneInstallmentPreviewDates(
    startIso,
    endIso,
    safeInstallmentCount,
    safeAdvancePercentage > 0,
    safeRetentionPercentage > 0
  );

  return Array.from({ length: safeInstallmentCount }, (_, index) => {
    const isLastInstallment = index === safeInstallmentCount - 1;
    const precedingTotal = basePercentage * Math.max(0, safeInstallmentCount - 1);
    const percentage = isLastInstallment
      ? roundMoney(remainingPercentage - precedingTotal)
      : basePercentage;

    return {
      label: `Thanh toán đợt ${index + 1}`,
      percentage: formatPercentageString(Math.max(0, percentage)),
      expected_date: installmentDates[index] || endIso,
    };
  });
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

const buildDraftContractItemsFromProjectItems = (
  projectId: unknown,
  projectItems: ProjectItemMaster[],
  products: Product[],
  contractId: string | number | null | undefined,
): ContractItem[] => {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    return [];
  }

  return (projectItems || [])
    .filter((item) => String(item.project_id || '') === normalizedProjectId)
    .map((item, index) => {
      const product = (products || []).find((candidate) => String(candidate.id) === String(item.product_id || '')) || null;
      return {
        id: `project-copy-${normalizedProjectId}-${String(item.id ?? item.product_id ?? index)}`,
        contract_id: contractId || 0,
        product_id: item.product_id,
        product_code: item.product_code || product?.product_code || null,
        product_name: item.product_name || product?.product_name || null,
        unit: item.unit || product?.unit || null,
        quantity: Number(item.quantity || 1) || 1,
        unit_price: Number(item.unit_price || 0) || 0,
      };
    });
};

const hasMeaningfulDraftContractItems = (items: ContractItem[]): boolean =>
  (items || []).some((item) => {
    const productId = Number(item.product_id || 0);
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);

    return (Number.isFinite(productId) && productId > 0)
      || (Number.isFinite(quantity) && quantity > 0)
      || (Number.isFinite(unitPrice) && unitPrice > 0);
  });

export const ContractModal: React.FC<ContractModalProps> = ({
  type,
  data,
  prefill,
  projects = [],
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
  onClose,
  onSave,
  onGenerateSchedules,
  onRefreshSchedules,
  onConfirmPayment,
}) => {
  const [activeTab, setActiveTab] = useState<ContractModalTab>('CONTRACT');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState('');
  const contractId = data?.id;
  const schedules = useMemo(
    () => paymentSchedules.filter((item) => String(item.contract_id) === String(contractId || '')),
    [paymentSchedules, contractId]
  );
  const initialFormData = useMemo<Partial<Contract>>(() => {
    const source = (type === 'ADD' ? prefill : data) || {};
    const sourceProject = projects.find((item) => String(item.id) === String(source.project_id || '')) || null;
    const fallbackProject = !sourceProject && source.customer_id
      ? projects.find((item) => String(item.customer_id) === String(source.customer_id)) || null
      : null;
    const resolvedSourceProject = sourceProject || fallbackProject;
    const normalizedSourceTermUnit = String(source.term_unit || '').trim().toUpperCase();
    const resolvedInitialTermUnit: ContractTermUnit | null =
      normalizedSourceTermUnit === 'MONTH' || normalizedSourceTermUnit === 'DAY'
        ? (normalizedSourceTermUnit as ContractTermUnit)
        : (resolvedSourceProject ? resolveTermUnitByInvestmentMode(resolvedSourceProject.investment_mode) : null);
    const rawTermValue = source.term_value;
    const parsedTermValue = rawTermValue === null || rawTermValue === undefined || rawTermValue === ''
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
  const initialProjectInvestmentModeCode = String(initialProjectForPaymentSettings?.investment_mode || '').trim().toUpperCase();
  const defaultAllocationMode = inferAllocationModeFromSchedules(schedules, initialProjectInvestmentModeCode) || (
    initialProjectInvestmentModeCode === 'DAU_TU'
      ? 'MILESTONE'
      : 'EVEN'
  );
  const defaultAdvancePercentage = defaultAllocationMode === 'MILESTONE' ? '15' : '30';
  const defaultRetentionPercentage = '5';
  const defaultInstallmentCount = '3';

  const [formData, setFormData] = useState<Partial<Contract>>(initialFormData);
  const [draftItems, setDraftItems] = useState<ContractItem[]>([]);
  const [isProjectItemsReferenceOpen, setIsProjectItemsReferenceOpen] = useState(false);
  const [expiryDateManualOverride, setExpiryDateManualOverride] = useState<boolean>(
    Boolean(initialFormData.expiry_date_manual_override)
  );
  const [allocationMode, setAllocationMode] = useState<ContractPaymentAllocationMode>(defaultAllocationMode);
  const [advancePercentage, setAdvancePercentage] = useState<string>(defaultAdvancePercentage);
  const [retentionPercentage, setRetentionPercentage] = useState<string>(defaultRetentionPercentage);
  const [installmentCount, setInstallmentCount] = useState<string>(defaultInstallmentCount);
  const [milestoneInputMode, setMilestoneInputMode] = useState<MilestoneInputMode>('AUTO');
  const [milestoneInstallments, setMilestoneInstallments] = useState<MilestoneInstallmentDraft[]>([]);
  const [previewDirty, setPreviewDirty] = useState<boolean>(true);
  const previewTrackingReadyRef = useRef(false);
  const paymentModeHydrationRef = useRef(false);
  const scheduleModeAutoDetectedRef = useRef(false);
  const showEditLoadingState = type === 'EDIT' && isDetailLoading;

  useEscKey(onClose);

  useEffect(() => {
    const initialDraftItems = Array.isArray(data?.items) && data.items.length > 0
      ? data.items.map((item) => ({
          id: item.id,
          contract_id: item.contract_id,
          product_id: item.product_id,
          product_code: item.product_code || null,
          product_name: item.product_name || null,
          unit: item.unit || null,
          quantity: Number(item.quantity || 1) || 1,
          unit_price: Number(item.unit_price || 0) || 0,
        }))
      : buildDraftContractItemsFromProjectItems(
          initialFormData.project_id,
          projectItems,
          products,
          contractId
        );

    setFormData(initialFormData);
    setDraftItems(initialDraftItems);
    setIsProjectItemsReferenceOpen(false);
    setErrors({});
    setInlineNotice('');
    setAllocationMode(defaultAllocationMode);
    setAdvancePercentage(defaultAdvancePercentage);
    setRetentionPercentage(defaultRetentionPercentage);
    setInstallmentCount(defaultInstallmentCount);
    setMilestoneInputMode('AUTO');
    setMilestoneInstallments([]);
    setPreviewDirty(schedules.length === 0);
    previewTrackingReadyRef.current = false;
    paymentModeHydrationRef.current = true;
    scheduleModeAutoDetectedRef.current = false;
    setExpiryDateManualOverride(Boolean(initialFormData.expiry_date_manual_override));
    if (type === 'EDIT') {
      setActiveTab('CONTRACT');
    }
  }, [
    contractId,
    data?.items,
    defaultAdvancePercentage,
    defaultAllocationMode,
    defaultInstallmentCount,
    defaultRetentionPercentage,
    initialFormData,
    products,
    projectItems,
    type,
  ]);

  useEffect(() => {
    if (expiryDateManualOverride) {
      return;
    }

    const calculatedExpiry = resolveContractExpiryByTerm(formData);
    if (!calculatedExpiry) {
      return;
    }

    if (calculatedExpiry === String(formData.expiry_date || '')) {
      return;
    }

    setFormData((prev) => ({ ...prev, expiry_date: calculatedExpiry }));
    setErrors((prev) => ({ ...prev, expiry_date: '' }));
  }, [
    expiryDateManualOverride,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.term_unit,
    formData.term_value,
  ]);

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'Chọn khách hàng' },
      ...customers.map((customer) => ({
        value: customer.id,
        label: `${customer.customer_code} - ${customer.customer_name}`,
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

  const selectedProject = useMemo(
    () => projects.find((item) => String(item.id) === String(formData.project_id || '')) || null,
    [projects, formData.project_id]
  );

  const productById = useMemo(() => {
    const next = new Map<string, Product>();
    (products || []).forEach((product) => {
      next.set(String(product.id), product);
    });
    return next;
  }, [products]);

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
  const isContractCustomerSelectionLoading = (
    (isCustomersLoading && customers.length === 0)
    || (isProjectsLoading && projects.length === 0)
  );
  const isContractProductOptionsLoading = (
    (isProductsLoading && products.length === 0)
    || (isProjectItemsLoading && String(formData.project_id || '').trim() !== '' && selectedProjectItems.length === 0)
  );
  const isContractProjectReferenceLoading = (
    isProjectItemsLoading
    && String(formData.project_id || '').trim() !== ''
    && selectedProjectItems.length === 0
  );

  const selectedProjectInvestmentModeLabel = useMemo(() => {
    const normalized = String(selectedProject?.investment_mode || '').trim().toUpperCase();
    if (!normalized) {
      return '--';
    }

    return INVESTMENT_MODE_LABELS[normalized] || normalized;
  }, [selectedProject?.investment_mode]);

  const selectedProjectInvestmentModeCode = useMemo(
    () => String(selectedProject?.investment_mode || '').trim().toUpperCase(),
    [selectedProject?.investment_mode]
  );

  const isInvestmentProject = selectedProjectInvestmentModeCode === 'DAU_TU';
  const isItemsEditable = schedules.length === 0;
  const draftItemsTotal = useMemo(
    () => roundMoney(draftItems.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      return sum + (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
    }, 0)),
    [draftItems]
  );

  const findFirstProjectForCustomer = (customerId: unknown): Project | null =>
    (projects || []).find((project) => String(project.customer_id) === String(customerId || '')) || null;

  const applyProjectSelection = (next: Partial<Contract>, project: Project | null): string => {
    if (!project) {
      next.project_id = '';
      return '';
    }

    next.project_id = project.id;
    next.customer_id = project.customer_id;
    next.value = Number(projectTotals.get(String(project.id)) || 0);

    const derivedTermUnit = resolveTermUnitByInvestmentMode(project.investment_mode);
    next.term_unit = derivedTermUnit;

    const parsedTermValue = next.term_value === null || next.term_value === undefined
      ? null
      : Number(next.term_value);
    if (
      derivedTermUnit === 'DAY'
      && parsedTermValue !== null
      && Number.isFinite(parsedTermValue)
      && !Number.isInteger(parsedTermValue)
    ) {
      next.term_value = null;
    }

    return 'Đơn vị thời hạn đã tự chọn theo hình thức dự án.';
  };

  const isStatusDraft = String(formData.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
  const contractValueNumber = parseCurrency(formData.value || 0);
  const valueInWords = toVietnameseMoneyText(formData.value || 0);
  const draftItemsDifference = roundMoney(draftItemsTotal - contractValueNumber);
  const hasDraftItemsMismatchWarning = draftItems.length > 0 && Math.abs(draftItemsDifference) >= 0.5;
  const showZeroValueWarning = contractValueNumber === 0;
  const canSyncContractValueFromDraftItems = isItemsEditable && hasDraftItemsMismatchWarning;

  const syncDraftItemsFromProject = (projectId: unknown) => {
    setDraftItems(buildDraftContractItemsFromProjectItems(projectId, projectItems, products, contractId));
  };

  const handleSyncContractValueFromDraftItems = () => {
    setFormData((prev) => ({ ...prev, value: draftItemsTotal }));
    setErrors((prev) => ({ ...prev, value: '' }));
    setInlineNotice(`Đã đồng bộ Giá trị hợp đồng theo tổng hạng mục hợp đồng: ${formatCurrency(draftItemsTotal)} VNĐ.`);
  };

  useEffect(() => {
    if (type !== 'EDIT' || schedules.length === 0 || scheduleModeAutoDetectedRef.current) {
      return;
    }

    setAllocationMode(defaultAllocationMode);
    setAdvancePercentage(defaultAdvancePercentage);
    setRetentionPercentage(defaultRetentionPercentage);
    setInstallmentCount(defaultInstallmentCount);
    scheduleModeAutoDetectedRef.current = true;
  }, [
    defaultAdvancePercentage,
    defaultAllocationMode,
    defaultInstallmentCount,
    defaultRetentionPercentage,
    schedules.length,
    type,
  ]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    if (paymentModeHydrationRef.current) {
      paymentModeHydrationRef.current = false;
      if (type === 'EDIT' && schedules.length > 0) {
        return;
      }
    }

    if (selectedProjectInvestmentModeCode === 'DAU_TU') {
      setAllocationMode('MILESTONE');
      setAdvancePercentage('15');
      setRetentionPercentage('5');
      setInstallmentCount('3');
      setMilestoneInputMode('AUTO');
      setMilestoneInstallments([]);
      return;
    }

    setRetentionPercentage('5');
    setInstallmentCount('3');
    setMilestoneInputMode('AUTO');
    setMilestoneInstallments([]);
    if (allocationMode === 'MILESTONE') {
      setAllocationMode('EVEN');
    }
  }, [allocationMode, schedules.length, selectedProject?.id, selectedProjectInvestmentModeCode, type]);

  const allocationModeOptions = useMemo(
    () => (isInvestmentProject
      ? ALLOCATION_MODE_OPTIONS
      : ALLOCATION_MODE_OPTIONS.filter((item) => item.value !== 'MILESTONE')),
    [isInvestmentProject]
  );

  const normalizedMilestoneInstallments = useMemo<ContractMilestoneInstallmentInput[]>(
    () => milestoneInstallments.map((installment) => ({
      label: String(installment.label || '').trim() || undefined,
      percentage: Number(installment.percentage),
      expected_date: String(installment.expected_date || '').trim() || null,
    })),
    [milestoneInstallments]
  );

  const milestoneSummary = useMemo(() => {
    const advance = clampPercentage(advancePercentage, 15);
    const retention = clampPercentage(retentionPercentage, 5);
    const installmentTotal = roundMoney(normalizedMilestoneInstallments.reduce((sum, installment) => {
      const percentage = Number(installment.percentage);
      return sum + (Number.isFinite(percentage) ? percentage : 0);
    }, 0));

    return {
      installmentCount: normalizedMilestoneInstallments.length,
      installmentTotal,
      overallTotal: roundMoney(advance + retention + installmentTotal),
      invalidPercentageCount: normalizedMilestoneInstallments.filter((installment) => {
        const percentage = Number(installment.percentage);
        return !Number.isFinite(percentage) || percentage <= 0;
      }).length,
      invalidDateIndex: normalizedMilestoneInstallments.findIndex((installment) =>
        Boolean(installment.expected_date) && !parseIsoDate(installment.expected_date)
      ),
    };
  }, [advancePercentage, normalizedMilestoneInstallments, retentionPercentage]);

  const syncMilestoneInstallmentsFromAuto = () => {
    const startIso = resolveContractGenerationStartIso(formData) || todayIsoDate();
    const expiryIso = String(formData.expiry_date || '').trim();
    const endIso = parseIsoDate(expiryIso) ? expiryIso : startIso;
    const safeInstallmentCount = Math.max(1, Math.min(50, Math.round(Number(installmentCount) || 3)));

    setMilestoneInstallments(
      buildMilestoneInstallmentDrafts(
        startIso,
        endIso,
        Number(advancePercentage),
        Number(retentionPercentage),
        safeInstallmentCount
      )
    );
  };

  const handleMilestoneInputModeChange = (nextMode: MilestoneInputMode) => {
    if (nextMode === 'CUSTOM' && milestoneInstallments.length === 0) {
      syncMilestoneInstallmentsFromAuto();
    }
    setMilestoneInputMode(nextMode);
  };

  const handleMilestoneInstallmentChange = (
    index: number,
    field: keyof MilestoneInstallmentDraft,
    value: string
  ) => {
    setMilestoneInstallments((prev) => prev.map((installment, installmentIndex) =>
      installmentIndex === index
        ? { ...installment, [field]: value }
        : installment
    ));
  };

  const handleAddMilestoneInstallment = () => {
    setMilestoneInstallments((prev) => [
      ...prev,
      {
        label: `Thanh toán đợt ${prev.length + 1}`,
        percentage: '0',
        expected_date: '',
      },
    ]);
  };

  const handleRemoveMilestoneInstallment = (index: number) => {
    setMilestoneInstallments((prev) => prev.filter((_, installmentIndex) => installmentIndex !== index));
  };

  useEffect(() => {
    if (allocationMode !== 'MILESTONE') {
      previewTrackingReadyRef.current = true;
      return;
    }

    if (!previewTrackingReadyRef.current) {
      previewTrackingReadyRef.current = true;
      return;
    }

    setPreviewDirty(true);
  }, [
    advancePercentage,
    allocationMode,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.value,
    installmentCount,
    milestoneInputMode,
    milestoneInstallments,
    retentionPercentage,
  ]);

  const milestonePreview = useMemo(() => {
    if (allocationMode !== 'MILESTONE') {
      return { rows: [] as MilestonePreviewRow[], error: '' };
    }

    const startIso = resolveContractGenerationStartIso(formData);
    const endIso = String(formData.expiry_date || '').trim();
    if (!startIso) {
      return { rows: [] as MilestonePreviewRow[], error: 'Cần có Ngày hiệu lực hoặc Ngày ký để preview mốc thanh toán.' };
    }
    if (!parseIsoDate(endIso)) {
      return { rows: [] as MilestonePreviewRow[], error: 'Cần có Ngày hết hiệu lực hợp lệ để preview mốc thanh toán.' };
    }
    if (parseCurrency(formData.value || 0) <= 0) {
      return { rows: [] as MilestonePreviewRow[], error: 'Giá trị hợp đồng phải lớn hơn 0 để preview mốc thanh toán.' };
    }

    const safeAdvancePercentage = clampPercentage(advancePercentage, 15);
    const safeRetentionPercentage = clampPercentage(retentionPercentage, 5);
    const safeInstallmentCount = Math.max(1, Math.min(50, Math.round(Number(installmentCount) || 3)));

    if (milestoneInputMode === 'CUSTOM') {
      if (normalizedMilestoneInstallments.length === 0) {
        return { rows: [] as MilestonePreviewRow[], error: 'Hãy thêm ít nhất 1 đợt thanh toán cho cấu hình custom.' };
      }
      if (milestoneSummary.invalidPercentageCount > 0) {
        return { rows: [] as MilestonePreviewRow[], error: 'Mỗi đợt thanh toán custom phải có tỷ lệ % lớn hơn 0.' };
      }
      if (milestoneSummary.invalidDateIndex >= 0) {
        return {
          rows: [] as MilestonePreviewRow[],
          error: `Ngày dự kiến của đợt ${milestoneSummary.invalidDateIndex + 1} không hợp lệ.`,
        };
      }
      if (Math.abs(milestoneSummary.overallTotal - 100) >= 0.01) {
        return {
          rows: [] as MilestonePreviewRow[],
          error: 'Tổng % tạm ứng, các đợt custom và % giữ lại phải đúng 100%.',
        };
      }

      return {
        rows: buildMilestonePreviewRows(
          parseCurrency(formData.value || 0),
          startIso,
          endIso,
          safeAdvancePercentage,
          safeRetentionPercentage,
          normalizedMilestoneInstallments.length,
          normalizedMilestoneInstallments
        ),
        error: '',
      };
    }

    if (safeAdvancePercentage + safeRetentionPercentage >= 100) {
      return { rows: [] as MilestonePreviewRow[], error: 'Tổng % tạm ứng và % giữ lại phải nhỏ hơn 100%.' };
    }

    return {
      rows: buildMilestonePreviewRows(
        parseCurrency(formData.value || 0),
        startIso,
        endIso,
        safeAdvancePercentage,
        safeRetentionPercentage,
        safeInstallmentCount
      ),
      error: '',
    };
  }, [
    advancePercentage,
    allocationMode,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.value,
    installmentCount,
    milestoneInputMode,
    milestoneSummary.invalidDateIndex,
    milestoneSummary.invalidPercentageCount,
    milestoneSummary.overallTotal,
    normalizedMilestoneInstallments,
    retentionPercentage,
  ]);

  const customInstallmentPreviewRows = useMemo(() => {
    if (allocationMode !== 'MILESTONE' || milestoneInputMode !== 'CUSTOM' || normalizedMilestoneInstallments.length === 0) {
      return [] as MilestonePreviewRow[];
    }
    if (milestoneSummary.invalidPercentageCount > 0 || Math.abs(milestoneSummary.overallTotal - 100) >= 0.01) {
      return [] as MilestonePreviewRow[];
    }

    const startIso = resolveContractGenerationStartIso(formData);
    const endIso = String(formData.expiry_date || '').trim();
    const totalAmount = parseCurrency(formData.value || 0);
    if (!startIso || !parseIsoDate(endIso) || totalAmount <= 0) {
      return [] as MilestonePreviewRow[];
    }

    return buildMilestonePreviewRows(
      totalAmount,
      startIso,
      endIso,
      clampPercentage(advancePercentage, 15),
      clampPercentage(retentionPercentage, 5),
      normalizedMilestoneInstallments.length,
      normalizedMilestoneInstallments
    ).filter((row) => row.tone === 'INSTALLMENT');
  }, [
    advancePercentage,
    allocationMode,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.value,
    milestoneInputMode,
    milestoneSummary.invalidPercentageCount,
    milestoneSummary.overallTotal,
    normalizedMilestoneInstallments,
    retentionPercentage,
  ]);

  const showMilestonePreview = allocationMode === 'MILESTONE' && (previewDirty || schedules.length === 0);

  const createEmptyDraftItem = (): ContractItem => ({
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    contract_id: contractId || 0,
    product_id: 0,
    quantity: 1,
    unit_price: 0,
  });

  const handleAddDraftItem = () => {
    setDraftItems((prev) => [...prev, createEmptyDraftItem()]);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDraftItemChange = (index: number, field: keyof ContractItem, value: unknown) => {
    setDraftItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      return {
        ...item,
        [field]: value,
      };
    }));
  };

  const handleDraftProductChange = (index: number, nextProductId: string) => {
    const product = productById.get(String(nextProductId)) || null;
    setDraftItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      const currentUnitPrice = Number(item.unit_price || 0);
      return {
        ...item,
        product_id: nextProductId,
        product_code: product?.product_code || null,
        product_name: product?.product_name || null,
        unit: product?.unit || null,
        unit_price: currentUnitPrice === 0 && Number(product?.standard_price || 0) > 0
          ? Number(product?.standard_price || 0)
          : currentUnitPrice,
      };
    }));
  };

  const validateField = (field: keyof Contract, source: Partial<Contract>): string => {
    const isDraftStatus = String(source.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
    const normalizedTermUnit = String(source.term_unit || '').trim().toUpperCase();
    const hasTermUnit = normalizedTermUnit === 'MONTH' || normalizedTermUnit === 'DAY';
    const hasTermValue = source.term_value !== null && source.term_value !== undefined && String(source.term_value).trim() !== '';
    const parsedTermValue = hasTermValue ? Number(source.term_value) : null;

    if (field === 'contract_code' && !String(source.contract_code || '').trim()) {
      return 'Mã hợp đồng là bắt buộc.';
    }
    if (field === 'contract_name' && !String(source.contract_name || '').trim()) {
      return 'Tên hợp đồng là bắt buộc.';
    }
    if (field === 'customer_id' && !String(source.customer_id || '').trim()) {
      return 'Vui lòng chọn khách hàng.';
    }
    if (field === 'project_id' && !String(source.project_id || '').trim()) {
      return 'Vui lòng chọn dự án.';
    }
    if (field === 'payment_cycle' && !String(source.payment_cycle || '').trim()) {
      return 'Vui lòng chọn chu kỳ thanh toán.';
    }
    if (field === 'value') {
      const integerDigits = countCurrencyIntegerDigits(source.value || 0);
      if (integerDigits > MAX_CONTRACT_VALUE_INTEGER_DIGITS) {
        return `Giá trị hợp đồng tối đa ${MAX_CONTRACT_VALUE_INTEGER_DIGITS} chữ số phần nguyên.`;
      }
    }
    if (field === 'term_unit' && hasTermValue && !hasTermUnit) {
      return 'Vui lòng chọn đơn vị thời hạn.';
    }
    if (field === 'term_value') {
      if (hasTermUnit && !hasTermValue) {
        return 'Vui lòng nhập thời hạn hợp đồng.';
      }
      if (hasTermValue && (!Number.isFinite(parsedTermValue) || Number(parsedTermValue) <= 0)) {
        return 'Thời hạn hợp đồng phải lớn hơn 0.';
      }
      if (
        hasTermUnit
        && normalizedTermUnit === 'DAY'
        && hasTermValue
        && Number.isFinite(parsedTermValue)
        && !Number.isInteger(parsedTermValue)
      ) {
        return 'Thời hạn theo ngày phải là số nguyên.';
      }
    }
    if (field === 'effective_date' && !isDraftStatus && !String(source.effective_date || '').trim()) {
      return 'Ngày hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
    }
    if (field === 'expiry_date' && !isDraftStatus && !String(source.expiry_date || '').trim()) {
      return 'Ngày hết hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
    }

    return '';
  };

  const validateDateConstraints = (source: Partial<Contract>): Pick<Record<string, string>, 'effective_date' | 'expiry_date'> => {
    const nextErrors: Pick<Record<string, string>, 'effective_date' | 'expiry_date'> = {
      effective_date: '',
      expiry_date: '',
    };

    const signDate = parseDateValue(source.sign_date);
    const effectiveDate = parseDateValue(source.effective_date);
    const expiryDate = parseDateValue(source.expiry_date);
    const normalizedStatus = String(source.status || 'DRAFT').trim().toUpperCase();
    const startDate = effectiveDate ?? signDate;

    if (normalizedStatus !== 'DRAFT') {
      if (!String(source.effective_date || '').trim()) {
        nextErrors.effective_date = 'Ngày hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
      }
      if (!String(source.expiry_date || '').trim()) {
        nextErrors.expiry_date = 'Ngày hết hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
      }
    }

    if (!nextErrors.effective_date && signDate !== null && effectiveDate !== null && effectiveDate < signDate) {
      nextErrors.effective_date = 'Ngày hiệu lực phải lớn hơn hoặc bằng ngày ký.';
    }

    if (!nextErrors.expiry_date && startDate !== null && expiryDate !== null && expiryDate < startDate) {
      nextErrors.expiry_date = 'Ngày hết hiệu lực phải lớn hơn hoặc bằng mốc tính hạn.';
    }

    return nextErrors;
  };

  const handleBlurValidate = (field: keyof Contract) => {
    setErrors((prev) => {
      const next = {
        ...prev,
        [field]: validateField(field, formData),
      };

      if (
        field === 'sign_date'
        || field === 'status'
        || field === 'effective_date'
        || field === 'expiry_date'
        || field === 'term_unit'
        || field === 'term_value'
      ) {
        const dateErrors = validateDateConstraints(formData);
        next.effective_date = dateErrors.effective_date;
        next.expiry_date = dateErrors.expiry_date;
      }

      return next;
    });
  };

  const buildNextFormData = (source: Partial<Contract>, field: keyof Contract, value: unknown): { next: Partial<Contract>; notice: string } => {
    const next = { ...source, [field]: value };
    let notice = '';

    if (field === 'customer_id') {
      const currentProject = projects.find((item) => String(item.id) === String(next.project_id || ''));
      if (!currentProject || String(currentProject.customer_id) !== String(value || '')) {
        const autoLinkedProject = findFirstProjectForCustomer(value);
        const projectNotice = applyProjectSelection(next, autoLinkedProject);
        if (autoLinkedProject) {
          notice = [
            `Đã tự động liên kết dự án ${autoLinkedProject.project_code} - ${autoLinkedProject.project_name}.`,
            projectNotice,
          ].filter(Boolean).join(' ').trim();
        } else {
          notice = 'Không tìm thấy dự án liên kết phù hợp cho khách hàng vừa chọn.';
        }
      }
    }

    if (field === 'project_id') {
      const project = projects.find((item) => String(item.id) === String(value));
      if (project) {
        const projectNotice = applyProjectSelection(next, project);
        notice = [notice, projectNotice].filter(Boolean).join(' ').trim();
      }
    }

    if (field === 'status') {
      const normalizedStatus = String(value || '').trim().toUpperCase();
      if (normalizedStatus === 'SIGNED' && !String(next.sign_date || '').trim()) {
        next.sign_date = todayIsoDate();
        notice = 'Đã tự động điền Ngày ký là hôm nay vì trạng thái chuyển sang Đã ký.';
      }
    }

    if (field === 'term_unit') {
      const normalizedTermUnit = String(value || '').trim().toUpperCase();
      if (normalizedTermUnit !== 'MONTH' && normalizedTermUnit !== 'DAY') {
        next.term_value = null;
      }
    }

    if (field === 'value') {
      next.value = parseCurrency(value as string | number);
    }

    return { next, notice };
  };

  const applyNextFormState = (field: keyof Contract, next: Partial<Contract>, notice: string) => {
    setFormData(next);
    setInlineNotice(notice);

    const inlineValidateFields: Array<keyof Contract> = [
      'customer_id',
      'project_id',
      'payment_cycle',
      'value',
      'status',
      'term_unit',
      'term_value',
      'effective_date',
      'expiry_date',
      'sign_date',
    ];
    if (inlineValidateFields.includes(field)) {
      const dateErrors = validateDateConstraints(next);
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, next),
        project_id: validateField('project_id', next),
        value: validateField('value', next),
        effective_date: dateErrors.effective_date,
        expiry_date: dateErrors.expiry_date,
      }));
      return;
    }

    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleProjectLinkedFieldChange = (field: 'customer_id' | 'project_id', value: unknown) => {
    const { next, notice } = buildNextFormData(formData, field, value);
    const currentProjectId = String(formData.project_id || '');
    const nextProjectId = String(next.project_id || '');
    const projectChanged = nextProjectId !== currentProjectId;

    if (projectChanged && isItemsEditable) {
      const hasExistingDraft = hasMeaningfulDraftContractItems(draftItems);
      if (!hasExistingDraft) {
        syncDraftItemsFromProject(nextProjectId);
      } else {
        const confirmed = window.confirm('Đổi dự án sẽ thay thế toàn bộ hạng mục hợp đồng hiện tại theo dự án mới. Tiếp tục?');
        if (!confirmed) {
          return;
        }
        syncDraftItemsFromProject(nextProjectId);
      }
    }

    applyNextFormState(field, next, notice);
  };

  const handleChange = (field: keyof Contract, value: unknown) => {
    const { next, notice } = buildNextFormData(formData, field, value);
    applyNextFormState(field, next, notice);
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    ([
      'contract_code',
      'contract_name',
      'customer_id',
      'project_id',
      'payment_cycle',
      'value',
      'term_unit',
      'term_value',
    ] as Array<keyof Contract>).forEach((field) => {
      const errorMessage = validateField(field, formData);
      if (errorMessage) {
        nextErrors[field] = errorMessage;
      }
    });

    const dateErrors = validateDateConstraints(formData);
    if (dateErrors.effective_date) {
      nextErrors.effective_date = dateErrors.effective_date;
    }
    if (dateErrors.expiry_date) {
      nextErrors.expiry_date = dateErrors.expiry_date;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const normalizedTermUnit = String(formData.term_unit || '').trim().toUpperCase();
    const hasTermUnit = normalizedTermUnit === 'MONTH' || normalizedTermUnit === 'DAY';
    const normalizedTermValue = hasTermUnit && formData.term_value !== null && formData.term_value !== undefined
      ? Number(formData.term_value)
      : null;
    const normalizedDraftItems = isItemsEditable
      ? draftItems
          .filter((item) => Number(item.product_id || 0) > 0)
          .map((item) => ({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
          }))
      : undefined;

    await Promise.resolve(
      onSave({
        ...formData,
        value: parseCurrency(formData.value || 0),
        term_unit: hasTermUnit ? (normalizedTermUnit as ContractTermUnit) : null,
        term_value: Number.isFinite(normalizedTermValue) ? normalizedTermValue : null,
        expiry_date_manual_override: expiryDateManualOverride,
        items: normalizedDraftItems,
      })
    );
  };

  const handleExpiryDateChange = (value: string) => {
    setExpiryDateManualOverride(true);
    handleChange('expiry_date', value);
  };

  const handleRecalculateExpiryDate = () => {
    const recalculatedExpiry = resolveContractExpiryByTerm(formData);
    if (!recalculatedExpiry) {
      setInlineNotice('Không đủ dữ liệu để tính lại hạn. Vui lòng nhập Đơn vị thời hạn và Thời hạn hợp đồng hợp lệ.');
      return;
    }

    setExpiryDateManualOverride(false);
    setFormData((prev) => ({ ...prev, expiry_date: recalculatedExpiry }));
    setErrors((prev) => ({ ...prev, expiry_date: '', term_unit: '', term_value: '' }));
    setInlineNotice('Đã tính lại Ngày hết hiệu lực theo thời hạn hợp đồng.');
  };

  const handleGenerateSchedules = async () => {
    if (!contractId || !onGenerateSchedules) return;

    if (draftItems.length === 0) {
      const confirmed = window.confirm('Chưa có hạng mục hợp đồng. Bạn có chắc muốn sinh kỳ thanh toán?');
      if (!confirmed) {
        return;
      }
    }

    if (hasDraftItemsMismatchWarning) {
      const confirmed = window.confirm(
        `Tổng hạng mục (${formatCurrency(draftItemsTotal)}) đang lệch Giá trị HĐ (${formatCurrency(contractValueNumber)}). Tiếp tục?`
      );
      if (!confirmed) {
        return;
      }
    }

    if (allocationMode === 'MILESTONE' && milestonePreview.error) {
      window.alert(milestonePreview.error);
      return;
    }

    if (schedules.length > 0) {
      const confirmMessage = `Đã có ${schedules.length} kỳ thanh toán. Sinh lại sẽ thay toàn bộ lịch thu tiền hiện có. Bạn có chắc muốn tiếp tục?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    const parsedAdvancePercentage = Number(advancePercentage);
    const normalizedAdvancePercentage = Number.isFinite(parsedAdvancePercentage)
      ? Math.min(100, Math.max(0, parsedAdvancePercentage))
      : 0;
    const parsedRetentionPercentage = Number(retentionPercentage);
    const normalizedRetentionPercentage = Number.isFinite(parsedRetentionPercentage)
      ? Math.min(100, Math.max(0, parsedRetentionPercentage))
      : 5;
    const parsedInstallmentCount = Number(installmentCount);
    const normalizedInstallmentCount = Number.isFinite(parsedInstallmentCount)
      ? Math.min(50, Math.max(1, Math.round(parsedInstallmentCount)))
      : 3;
    const milestoneInstallmentPayload = allocationMode === 'MILESTONE' && milestoneInputMode === 'CUSTOM'
      ? normalizedMilestoneInstallments.map((installment) => ({
          label: installment.label,
          percentage: Number(installment.percentage),
          expected_date: installment.expected_date || null,
        }))
      : undefined;

    setIsGenerating(true);
    try {
      await onGenerateSchedules(contractId, {
        allocation_mode: allocationMode,
        advance_percentage: allocationMode === 'MILESTONE' ? normalizedAdvancePercentage : undefined,
        retention_percentage: allocationMode === 'MILESTONE' ? normalizedRetentionPercentage : undefined,
        installment_count: allocationMode === 'MILESTONE'
          ? (milestoneInputMode === 'CUSTOM' ? normalizedMilestoneInstallments.length : normalizedInstallmentCount)
          : undefined,
        installments: milestoneInstallmentPayload,
      });
      setPreviewDirty(false);
    } catch {
      // Error toast is handled at App level.
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPayment = async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => {
    if (!onConfirmPayment) return;
    await onConfirmPayment(scheduleId, payload);
  };

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
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mã hợp đồng <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.contract_code || ''}
                    onChange={(e) => handleChange('contract_code', e.target.value)}
                    onBlur={() => handleBlurValidate('contract_code')}
                    placeholder="HD-2026-001"
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.contract_code ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.contract_code && (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.contract_code}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Tên hợp đồng <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.contract_name || ''}
                    onChange={(e) => handleChange('contract_name', e.target.value)}
                    onBlur={() => handleBlurValidate('contract_name')}
                    placeholder="Hợp đồng triển khai giải pháp..."
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.contract_name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.contract_name && (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.contract_name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <SearchableSelect
                    label="Khách hàng"
                    required
                    value={formData.customer_id ? String(formData.customer_id) : ''}
                    onChange={(value) => handleProjectLinkedFieldChange('customer_id', value)}
                    options={customerOptions}
                    placeholder={isContractCustomerSelectionLoading ? 'Đang tải khách hàng và dự án...' : 'Chọn khách hàng'}
                    error={errors.customer_id}
                    disabled={isContractCustomerSelectionLoading}
                  />
                </div>

                {isContractCustomerSelectionLoading && (
                  <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Đang tải dữ liệu khách hàng và dự án để liên kết hợp đồng.
                  </div>
                )}

                {(selectedProject || errors.project_id) && (
                  <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {selectedProject ? (
                      <>
                        Dự án: <span className="font-semibold text-slate-800">{selectedProject.project_code} - {selectedProject.project_name}</span>
                        {' | '}KH: <span className="font-semibold text-slate-800">{selectedProjectCustomer?.customer_name || '--'}</span>
                        {' | '}Giá trị hạng mục DA: <span className="font-semibold text-slate-800">{formatCurrency(selectedProjectValue)} VNĐ ({selectedProjectItems.length} HM)</span>
                        {' | '}Hình thức: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
                      </>
                    ) : (
                      <span className="text-red-600 inline-flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.project_id}
                      </span>
                    )}
                  </div>
                )}

                {selectedProject && (
                  <div className="md:col-span-2 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsProjectItemsReferenceOpen((prev) => !prev)}
                        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left"
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Hạng mục dự án gốc ({selectedProjectItems.length} hạng mục)
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Bảng tham chiếu read-only từ dự án liên kết.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <span className="material-symbols-outlined text-base">
                            {isProjectItemsReferenceOpen ? 'expand_less' : 'expand_more'}
                          </span>
                          {isProjectItemsReferenceOpen ? 'Thu gọn' : 'Xem chi tiết'}
                        </span>
                      </button>

                      {isProjectItemsReferenceOpen && (
                        <div className="overflow-auto">
                          {isContractProjectReferenceLoading && (
                            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                              Đang tải hạng mục gốc của dự án liên kết...
                            </div>
                          )}
                          <table className="w-full min-w-[720px] border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">#</th>
                                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Sản phẩm/Dịch vụ</th>
                                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">SL</th>
                                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {selectedProjectItems.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-5 text-center text-sm text-slate-500">
                                    Dự án này chưa có hạng mục nào để đối chiếu.
                                  </td>
                                </tr>
                              ) : (
                                selectedProjectItems.map((item, index) => {
                                  const quantity = Number(item.quantity || 0);
                                  const unitPrice = Number(item.unit_price || 0);
                                  const amount = Math.max(0, (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0));
                                  const itemLabel = String(
                                    item.product_name
                                      || item.product_code
                                      || item.display_name
                                      || item.project_name
                                      || `Hạng mục #${index + 1}`
                                  ).trim();

                                  return (
                                    <tr key={`project-item-${item.id}-${index}`} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 text-sm font-medium text-slate-600">{index + 1}</td>
                                      <td className="px-4 py-3 text-sm text-slate-900">{itemLabel}</td>
                                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatQuantity(quantity)}</td>
                                      <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(unitPrice)} đ</td>
                                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{formatCurrency(amount)} đ</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                            <tfoot className="border-t border-slate-200 bg-slate-50">
                              <tr>
                                <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Tổng hạng mục dự án
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                                  {formatCurrency(selectedProjectValue)} đ
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              Hạng mục hợp đồng ({draftItems.length} hạng mục)
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Snapshot thương mại riêng của hợp đồng, không ghi ngược về dự án.
                            </p>
                          </div>
                          {isItemsEditable ? (
                            <button
                              type="button"
                              onClick={handleAddDraftItem}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Thêm hạng mục
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              <span className="material-symbols-outlined text-sm">lock</span>
                              Không thể sửa - đã có kỳ thanh toán
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-auto">
                        <table className="w-full min-w-[980px] border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">#</th>
                              <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Sản phẩm/DV</th>
                              <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">ĐVT</th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">SL</th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Đơn giá</th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thành tiền</th>
                              {isItemsEditable && (
                                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {draftItems.length === 0 ? (
                              <tr>
                                <td colSpan={isItemsEditable ? 7 : 6} className="px-4 py-5 text-center text-sm text-slate-500">
                                  Chưa có hạng mục hợp đồng.
                                </td>
                              </tr>
                            ) : (
                              draftItems.map((item, index) => {
                                const quantity = Number(item.quantity || 0);
                                const unitPrice = Number(item.unit_price || 0);
                                const amount = Math.max(0, (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0));
                                const takenProductIds = new Set(
                                  draftItems
                                    .filter((_, itemIndex) => itemIndex !== index)
                                    .map((draftItem) => String(draftItem.product_id || ''))
                                    .filter(Boolean)
                                );
                                const rowProductOptions = productSelectOptions.map((option) => ({
                                  ...option,
                                  disabled: takenProductIds.has(String(option.value)),
                                }));

                                return (
                                  <tr key={`contract-item-${String(item.id)}`} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">{index + 1}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 min-w-[260px]">
                                      {isItemsEditable ? (
                                        <SearchableSelect
                                          value={String(item.product_id || '')}
                                          onChange={(value) => handleDraftProductChange(index, value)}
                                          options={rowProductOptions}
                                          placeholder={isContractProductOptionsLoading ? 'Đang tải sản phẩm...' : 'Chọn sản phẩm'}
                                          compact
                                          usePortal
                                          disabled={isContractProductOptionsLoading}
                                        />
                                      ) : (
                                        item.product_name || item.product_code || '--'
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                      {item.unit || productById.get(String(item.product_id || ''))?.unit || '--'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                                      {isItemsEditable ? (
                                        <input
                                          type="number"
                                          min={0.01}
                                          step={0.01}
                                          value={quantity || ''}
                                          onChange={(event) => {
                                            const parsed = Number(event.target.value);
                                            handleDraftItemChange(index, 'quantity', Number.isFinite(parsed) ? parsed : 0);
                                          }}
                                          className="w-24 h-10 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                      ) : (
                                        formatQuantity(quantity)
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                                      {isItemsEditable ? (
                                        <input
                                          type="text"
                                          value={formatCurrency(unitPrice)}
                                          onChange={(event) => handleDraftItemChange(index, 'unit_price', parseCurrency(event.target.value))}
                                          className="w-36 h-10 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                      ) : (
                                        `${formatCurrency(unitPrice)} đ`
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 whitespace-nowrap">
                                      {formatCurrency(amount)} đ
                                    </td>
                                    {isItemsEditable && (
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDraftItem(index)}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                          aria-label={`Xóa hạng mục ${index + 1}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          <tfoot className="border-t border-slate-200 bg-slate-50">
                            <tr>
                              <td colSpan={isItemsEditable ? 5 : 4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Tổng hạng mục
                              </td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                                {formatCurrency(draftItemsTotal)} đ
                              </td>
                              {isItemsEditable && <td className="px-4 py-2.5" />}
                            </tr>
                            <tr>
                              <td colSpan={isItemsEditable ? 5 : 4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Giá trị HĐ
                              </td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">
                                {formatCurrency(contractValueNumber)} đ
                              </td>
                              {isItemsEditable && <td className="px-4 py-2.5" />}
                            </tr>
                            <tr className={hasDraftItemsMismatchWarning ? 'bg-amber-50' : 'bg-emerald-50'}>
                              <td colSpan={isItemsEditable ? 5 : 4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Chênh lệch
                              </td>
                              <td className={`px-4 py-2.5 text-right text-sm font-bold ${
                                hasDraftItemsMismatchWarning ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {draftItemsDifference > 0 ? '+' : draftItemsDifference < 0 ? '-' : ''}
                                {formatCurrency(Math.abs(draftItemsDifference))} đ
                              </td>
                              {isItemsEditable && (
                                <td className="px-4 py-2.5 text-right">
                                  {canSyncContractValueFromDraftItems && (
                                    <button
                                      type="button"
                                      onClick={handleSyncContractValueFromDraftItems}
                                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      Đồng bộ giá trị HĐ
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {!!inlineNotice && (
                  <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 inline-flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{inlineNotice}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <SearchableSelect
                    label="Trạng thái"
                    value={formData.status || 'DRAFT'}
                    onChange={(value) => handleChange('status', value)}
                    options={statusOptions}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <SearchableSelect
                    label="Chu kỳ thanh toán"
                    required
                    value={formData.payment_cycle || ''}
                    onChange={(value) => handleChange('payment_cycle', value as PaymentCycle)}
                    options={cycleSelectOptions}
                    error={errors.payment_cycle}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày ký</label>
                  <input
                    type="date"
                    value={formData.sign_date || ''}
                    onChange={(e) => handleChange('sign_date', e.target.value)}
                    onBlur={() => handleBlurValidate('sign_date')}
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.sign_date ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.sign_date && (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.sign_date}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-700">Giá trị hợp đồng (VNĐ)</label>
                    {canSyncContractValueFromDraftItems && (
                      <button
                        type="button"
                        onClick={handleSyncContractValueFromDraftItems}
                        className="text-xs font-semibold text-primary hover:text-deep-teal"
                      >
                        Đồng bộ từ hạng mục HĐ
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrency(formData.value || 0)}
                      onChange={(e) => handleChange('value', e.target.value)}
                      onBlur={() => {
                        setFormData((prev) => ({ ...prev, value: parseCurrency(prev.value || 0) }));
                        handleBlurValidate('value');
                      }}
                      placeholder="0"
                      className={`w-full h-11 pl-4 pr-10 rounded-lg border bg-white text-slate-900 outline-none transition-all font-bold ${
                        errors.value
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                      }`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">₫</div>
                  </div>
                  {errors.value ? (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.value}
                    </p>
                  ) : hasDraftItemsMismatchWarning ? (
                    <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Tổng thành tiền hạng mục hợp đồng đang lệch Giá trị hợp đồng.
                    </p>
                  ) : showZeroValueWarning ? (
                    <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Giá trị hợp đồng đang bằng 0 VNĐ. Vui lòng kiểm tra trước khi lưu.
                    </p>
                  ) : null}
                  {!errors.value && (
                    <div className="mt-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5">
                      <p className="text-xs leading-relaxed text-deep-teal">
                        <span className="font-bold uppercase tracking-wide">Số tiền bằng chữ:</span>{' '}
                        <span className="font-bold text-slate-900 break-words">{valueInWords}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <SearchableSelect
                    label="Đơn vị thời hạn"
                    value={formData.term_unit || ''}
                    onChange={(value) => handleChange('term_unit', value as ContractTermUnit)}
                    options={TERM_UNIT_OPTIONS}
                    placeholder="Chọn đơn vị thời hạn"
                    error={errors.term_unit}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Thời hạn hợp đồng</label>
                  <input
                    type="number"
                    min={0}
                    step={String(formData.term_unit || '').toUpperCase() === 'DAY' ? 1 : 0.1}
                    value={formData.term_value ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        handleChange('term_value', null);
                        return;
                      }

                      const parsed = Number(raw);
                      handleChange('term_value', Number.isFinite(parsed) ? parsed : null);
                    }}
                    onBlur={() => handleBlurValidate('term_value')}
                    placeholder={String(formData.term_unit || '').toUpperCase() === 'DAY' ? 'Ví dụ: 30' : 'Ví dụ: 1.5'}
                    className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 outline-none transition-all ${
                      errors.term_value
                        ? 'border-red-500 ring-1 ring-red-500'
                        : 'border-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.term_value ? (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.term_value}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Mốc tính hạn: Ngày hiệu lực {'->'} Ngày ký {'->'} hôm qua. Công thức: hạn = mốc bắt đầu + N - 1.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Ngày hiệu lực
                    {!isStatusDraft && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.effective_date || ''}
                    onChange={(e) => handleChange('effective_date', e.target.value)}
                    onBlur={() => handleBlurValidate('effective_date')}
                    className={`w-full h-11 px-4 rounded-lg border text-slate-900 outline-none transition-all ${
                      errors.effective_date
                        ? 'border-red-500 ring-1 ring-red-500 bg-white'
                        : !isStatusDraft
                        ? 'border-amber-300 bg-amber-50/50 focus:ring-2 focus:ring-amber-200 focus:border-amber-400'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.effective_date && (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.effective_date}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Ngày hết hiệu lực
                      {!isStatusDraft && <span className="text-red-500"> *</span>}
                    </label>
                    {expiryDateManualOverride && (
                      <button
                        type="button"
                        onClick={handleRecalculateExpiryDate}
                        className="text-xs font-semibold text-primary hover:text-deep-teal"
                      >
                        Tính lại theo thời hạn
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.expiry_date || ''}
                    onChange={(e) => handleExpiryDateChange(e.target.value)}
                    onBlur={() => handleBlurValidate('expiry_date')}
                    className={`w-full h-11 px-4 rounded-lg border text-slate-900 outline-none transition-all ${
                      errors.expiry_date
                        ? 'border-red-500 ring-1 ring-red-500 bg-white'
                        : !isStatusDraft
                        ? 'border-amber-300 bg-amber-50/50 focus:ring-2 focus:ring-amber-200 focus:border-amber-400'
                        : 'border-slate-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {errors.expiry_date && (
                    <p className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.expiry_date}
                    </p>
                  )}
                  {!errors.expiry_date && expiryDateManualOverride && (
                    <p className="text-xs text-slate-500">Đang dùng ngày hết hiệu lực chỉnh tay.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {type === 'EDIT' && activeTab === 'PAYMENT' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-primary" />
                    Dòng tiền hợp đồng
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {allocationMode === 'MILESTONE'
                      ? 'Theo dõi các mốc thu tiền theo tạm ứng, các đợt nghiệm thu và quyết toán.'
                      : `Theo dõi các mốc thu tiền theo chu kỳ ${PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần'}.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    <label className="text-xs font-semibold text-slate-600">Cách phân bổ</label>
                    <select
                      value={allocationMode}
                      onChange={(event) => setAllocationMode(event.target.value as ContractPaymentAllocationMode)}
                      className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {allocationModeOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {allocationMode === 'MILESTONE' && (
                    <div className="flex flex-col gap-1 w-[120px]">
                      <label className="text-xs font-semibold text-slate-600">Tạm ứng (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={advancePercentage}
                        onChange={(event) => setAdvancePercentage(event.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}

                  {allocationMode === 'MILESTONE' && (
                    <>
                      <div className="flex flex-col gap-1 w-[120px]">
                        <label className="text-xs font-semibold text-slate-600">Giữ lại (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={retentionPercentage}
                          onChange={(event) => setRetentionPercentage(event.target.value)}
                          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      {milestoneInputMode === 'AUTO' ? (
                        <div className="flex flex-col gap-1 w-[120px]">
                          <label className="text-xs font-semibold text-slate-600">Số đợt</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={installmentCount}
                            onChange={(event) => setInstallmentCount(event.target.value)}
                            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <label className="text-xs font-semibold text-slate-600">Đợt custom</label>
                          <div className="h-10 rounded-lg border border-violet-200 bg-violet-50 px-3 inline-flex items-center text-sm font-semibold text-violet-700">
                            {Math.max(0, milestoneInstallments.length)} đợt
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateSchedules}
                    disabled={!contractId || !onGenerateSchedules || isGenerating}
                    className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-deep-teal disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Sinh kỳ thanh toán
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Thông tin hợp đồng</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <p className="text-slate-500">Mã hợp đồng</p>
                    <p className="font-medium text-slate-800">{String(formData.contract_code || data?.contract_code || '--')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Chu kỳ thanh toán</p>
                    <p className="font-medium text-slate-800">
                      {allocationMode === 'MILESTONE'
                        ? 'Theo mốc nghiệm thu'
                        : (PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần')}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Hình thức dự án</p>
                    <p className="font-medium text-slate-800">{selectedProjectInvestmentModeLabel}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tên hợp đồng</p>
                    <p className="font-medium text-slate-800">{String(formData.contract_name || data?.contract_name || '--')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Giá trị hợp đồng</p>
                    <p className="font-medium text-slate-800">{formatCurrency(parseCurrency(formData.value || 0))} đ</p>
                  </div>
                </div>
              </div>

              {allocationMode === 'MILESTONE' && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
                  {showMilestonePreview && (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-violet-900">Preview mốc thanh toán đầu tư</h4>
                        <p className="text-xs text-violet-700 mt-1">
                          Lịch dưới đây là gợi ý tự động theo tạm ứng, các đợt thanh toán và quyết toán.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700 border border-violet-200">
                        {selectedProjectInvestmentModeLabel}
                      </span>
                    </div>
                  )}

                  <div className="rounded-xl border border-violet-100 bg-white/80 p-3 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Cách dựng mốc</p>
                        <p className="text-sm text-slate-600 mt-1">
                          Chọn dựng tự động theo công thức hoặc nhập từng đợt nghiệm thu để sinh lịch chính xác hơn.
                        </p>
                      </div>
                      <div className="inline-flex rounded-lg border border-violet-200 bg-violet-50 p-1">
                        <button
                          type="button"
                          onClick={() => handleMilestoneInputModeChange('AUTO')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            milestoneInputMode === 'AUTO'
                              ? 'bg-white text-violet-700 shadow-sm'
                              : 'text-violet-600 hover:text-violet-800'
                          }`}
                        >
                          Tự động
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMilestoneInputModeChange('CUSTOM')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            milestoneInputMode === 'CUSTOM'
                              ? 'bg-white text-violet-700 shadow-sm'
                              : 'text-violet-600 hover:text-violet-800'
                          }`}
                        >
                          Nhập từng đợt
                        </button>
                      </div>
                    </div>

                    {milestoneInputMode === 'CUSTOM' && (
                      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-bold text-violet-900">Editor các đợt thanh toán</h5>
                            <p className="text-xs text-violet-700 mt-1">
                              Nhập nhãn đợt, tỷ lệ % và ngày dự kiến. Tổng tạm ứng + các đợt + giữ lại phải bằng đúng 100%.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={syncMilestoneInstallmentsFromAuto}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Lấy theo cấu hình tự động
                            </button>
                            <button
                              type="button"
                              onClick={handleAddMilestoneInstallment}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Thêm đợt
                            </button>
                          </div>
                        </div>

                        <div className="overflow-auto rounded-lg border border-violet-100 bg-white">
                          <table className="w-full min-w-[900px] border-collapse">
                            <thead className="bg-violet-50 border-b border-violet-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Đợt</th>
                                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Tên đợt</th>
                                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">% giá trị HĐ</th>
                                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-violet-500 font-bold">Số tiền</th>
                                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Ngày dự kiến</th>
                                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-violet-500 font-bold">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-100">
                              {milestoneInstallments.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-3 py-4 text-sm text-slate-500 text-center">
                                    Chưa có đợt nào. Dùng nút `Thêm đợt` hoặc `Lấy theo cấu hình tự động` để khởi tạo.
                                  </td>
                                </tr>
                              ) : (
                                milestoneInstallments.map((installment, index) => {
                                  const rawInstallmentAmount = roundMoney(
                                    (parseCurrency(formData.value || 0) * clampPercentage(installment.percentage, 0)) / 100
                                  );
                                  const installmentAmount = customInstallmentPreviewRows[index]?.expectedAmount ?? rawInstallmentAmount;

                                  return (
                                    <tr key={`milestone-installment-${index}`}>
                                      <td className="px-3 py-2 text-sm font-semibold text-slate-700 whitespace-nowrap">#{index + 1}</td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={installment.label}
                                          onChange={(event) => handleMilestoneInstallmentChange(index, 'label', event.target.value)}
                                          placeholder={`Thanh toán đợt ${index + 1}`}
                                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="relative">
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            value={installment.percentage}
                                            onChange={(event) => handleMilestoneInstallmentChange(index, 'percentage', event.target.value)}
                                            className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                                          />
                                          <span className="absolute inset-y-0 right-0 pr-3 inline-flex items-center text-xs font-semibold text-slate-400">%</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-600 whitespace-nowrap">
                                        {formatPreviewMoney(installmentAmount)} đ
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={installment.expected_date}
                                          onChange={(event) => handleMilestoneInstallmentChange(index, 'expected_date', event.target.value)}
                                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMilestoneInstallment(index)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Xóa
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                            Tạm ứng: {formatPercentageString(clampPercentage(advancePercentage, 15))}%
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                            Các đợt: {formatPercentageString(milestoneSummary.installmentTotal)}%
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                            Giữ lại: {formatPercentageString(clampPercentage(retentionPercentage, 5))}%
                          </span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold border ${
                            Math.abs(milestoneSummary.overallTotal - 100) < 0.01
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            Tổng: {formatPercentageString(milestoneSummary.overallTotal)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {showMilestonePreview && (
                    milestonePreview.error ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {milestonePreview.error}
                      </div>
                    ) : (
                      <div className="overflow-auto rounded-lg border border-violet-100 bg-white">
                        <table className="w-full min-w-[620px] border-collapse">
                          <thead className="bg-violet-50 border-b border-violet-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Mốc</th>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Ngày dự kiến</th>
                              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Số tiền dự kiến</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-100">
                            {milestonePreview.rows.map((row, index) => {
                              const toneClasses = row.tone === 'ADVANCE'
                                ? 'bg-fuchsia-100 text-fuchsia-700'
                                : row.tone === 'RETENTION'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700';

                              return (
                                <tr key={`${row.milestoneName}-${index}`}>
                                  <td className="px-3 py-2 text-sm text-slate-800">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses}`}>
                                      {row.milestoneName}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-slate-600">{formatDisplayDate(row.expectedDate)}</td>
                                  <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatPreviewMoney(row.expectedAmount)} đ</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              )}

              <PaymentScheduleTab
                contractCode={String(formData.contract_code || data?.contract_code || '')}
                schedules={schedules}
                isLoading={isPaymentLoading}
                onRefresh={contractId && onRefreshSchedules ? () => onRefreshSchedules(contractId) : undefined}
                onConfirmPayment={(scheduleId, payload) =>
                  handleConfirmPayment(scheduleId, {
                    actual_paid_date: payload.actual_paid_date || todayIsoDate(),
                    actual_paid_amount: Number(payload.actual_paid_amount || 0),
                    status: (payload.status || 'PAID') as PaymentScheduleStatus,
                    notes: payload.notes || null,
                    attachments: payload.attachments || [],
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">
            Hủy
          </button>
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
            <button
              onClick={handleSave}
              disabled={showEditLoadingState}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
