import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CircleDollarSign, Loader2 } from 'lucide-react';
import { CONTRACT_STATUSES } from '../constants';
import {
  Contract,
  ContractTermUnit,
  Customer,
  PaymentCycle,
  PaymentSchedule,
  PaymentScheduleStatus,
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
  projectItems?: ProjectItemMaster[];
  customers: Customer[];
  paymentSchedules: PaymentSchedule[];
  isPaymentLoading?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contract>) => Promise<void> | void;
  onGenerateSchedules?: (
    contractId: string | number,
    options?: {
      preserve_paid?: boolean;
      allocation_mode?: 'EVEN' | 'ADVANCE_PERCENT';
      advance_percentage?: number;
    }
  ) => Promise<void>;
  onRefreshSchedules?: (contractId: string | number) => Promise<void>;
  onConfirmPayment?: (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
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

const ALLOCATION_MODE_OPTIONS: Array<{ value: 'EVEN' | 'ADVANCE_PERCENT'; label: string }> = [
  { value: 'EVEN', label: 'Chia đều' },
  { value: 'ADVANCE_PERCENT', label: 'Thanh toán trước (%)' },
];

const TERM_UNIT_OPTIONS: Array<{ value: ContractTermUnit; label: string }> = [
  { value: 'MONTH', label: 'Theo tháng' },
  { value: 'DAY', label: 'Theo ngày' },
];

const INVESTMENT_MODE_LABELS: Record<string, string> = {
  DAU_TU: 'Đầu tư',
  THUE_DICH_VU: 'Thuê dịch vụ CNTT',
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
  projectItems = [],
  customers = [],
  paymentSchedules = [],
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
  const [preservePaid, setPreservePaid] = useState<boolean>(true);
  const [allocationMode, setAllocationMode] = useState<'EVEN' | 'ADVANCE_PERCENT'>('EVEN');
  const [advancePercentage, setAdvancePercentage] = useState<string>('30');

  const initialFormData = useMemo<Partial<Contract>>(() => {
    const source = (type === 'ADD' ? prefill : data) || {};
    const sourceProject = projects.find((item) => String(item.id) === String(source.project_id || '')) || null;
    const normalizedSourceTermUnit = String(source.term_unit || '').trim().toUpperCase();
    const resolvedInitialTermUnit: ContractTermUnit | null =
      normalizedSourceTermUnit === 'MONTH' || normalizedSourceTermUnit === 'DAY'
        ? (normalizedSourceTermUnit as ContractTermUnit)
        : (sourceProject ? resolveTermUnitByInvestmentMode(sourceProject.investment_mode) : null);
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
      customer_id: source.customer_id || '',
      project_id: source.project_id || '',
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

  const [formData, setFormData] = useState<Partial<Contract>>(initialFormData);
  const [expiryDateManualOverride, setExpiryDateManualOverride] = useState<boolean>(
    Boolean(initialFormData.expiry_date_manual_override)
  );

  useEffect(() => {
    setFormData(initialFormData);
    setErrors({});
    setInlineNotice('');
    setPreservePaid(true);
    setAllocationMode('EVEN');
    setAdvancePercentage('30');
    setExpiryDateManualOverride(Boolean(initialFormData.expiry_date_manual_override));
    if (type === 'EDIT') {
      setActiveTab('CONTRACT');
    }
  }, [initialFormData, type]);

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

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Chọn dự án' },
      ...(projects || [])
        .filter((project) => !formData.customer_id || String(project.customer_id) === String(formData.customer_id))
        .map((project) => ({
          value: project.id,
          label: `${project.project_code} - ${project.project_name}`,
        })),
    ],
    [projects, formData.customer_id]
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

  const contractId = data?.id;
  const schedules = useMemo(
    () => paymentSchedules.filter((item) => String(item.contract_id) === String(contractId || '')),
    [paymentSchedules, contractId]
  );

  const selectedProject = useMemo(
    () => projects.find((item) => String(item.id) === String(formData.project_id || '')) || null,
    [projects, formData.project_id]
  );

  const selectedProjectCustomer = useMemo(
    () => customers.find((item) => String(item.id) === String(selectedProject?.customer_id || '')) || null,
    [customers, selectedProject]
  );

  const selectedProjectValue = useMemo(
    () => Number(projectTotals.get(String(formData.project_id || '')) || 0),
    [projectTotals, formData.project_id]
  );

  const selectedProjectInvestmentModeLabel = useMemo(() => {
    const normalized = String(selectedProject?.investment_mode || '').trim().toUpperCase();
    if (!normalized) {
      return '--';
    }

    return INVESTMENT_MODE_LABELS[normalized] || normalized;
  }, [selectedProject?.investment_mode]);

  const isStatusDraft = String(formData.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
  const contractValueNumber = parseCurrency(formData.value || 0);
  const valueInWords = toVietnameseMoneyText(formData.value || 0);
  const hasProjectValueMismatchWarning = Boolean(formData.project_id)
    && Math.round(selectedProjectValue) !== Math.round(contractValueNumber);
  const showZeroValueWarning = contractValueNumber === 0;

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
      if (currentProject && String(currentProject.customer_id) !== String(value || '')) {
        next.project_id = '';
        notice = 'Đã bỏ chọn dự án vì không thuộc khách hàng vừa chọn.';
      }
    }

    if (field === 'project_id') {
      const project = projects.find((item) => String(item.id) === String(value));
      if (project) {
        next.customer_id = project.customer_id;
        next.value = Number(projectTotals.get(String(project.id)) || 0);
        const derivedTermUnit = resolveTermUnitByInvestmentMode(project.investment_mode);
        next.term_unit = derivedTermUnit;
        const parsedTermValue = next.term_value === null || next.term_value === undefined
          ? null
          : Number(next.term_value);
        if (derivedTermUnit === 'DAY' && parsedTermValue !== null && Number.isFinite(parsedTermValue) && !Number.isInteger(parsedTermValue)) {
          next.term_value = null;
        }
        notice = [notice, 'Đơn vị thời hạn đã tự chọn theo hình thức dự án.'].filter(Boolean).join(' ').trim();
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

  const handleChange = (field: keyof Contract, value: unknown) => {
    const { next, notice } = buildNextFormData(formData, field, value);
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

    await Promise.resolve(
      onSave({
        ...formData,
        value: parseCurrency(formData.value || 0),
        term_unit: hasTermUnit ? (normalizedTermUnit as ContractTermUnit) : null,
        term_value: Number.isFinite(normalizedTermValue) ? normalizedTermValue : null,
        expiry_date_manual_override: expiryDateManualOverride,
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

    const paidCount = schedules.filter((item) => item.status === 'PAID' || item.status === 'PARTIAL').length;
    if (schedules.length > 0) {
      const confirmMessage = preservePaid
        ? `Đã có ${schedules.length} kỳ thanh toán, gồm ${paidCount} kỳ đã thu/thu một phần. Hệ thống sẽ chỉ tái sinh kỳ chưa thu. Bạn có chắc muốn tiếp tục?`
        : `Đã có ${schedules.length} kỳ thanh toán, gồm ${paidCount} kỳ đã thu/thu một phần. Sinh lại có thể xóa dữ liệu thu tiền hiện có. Bạn có chắc muốn tiếp tục?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    const parsedAdvancePercentage = Number(advancePercentage);
    const normalizedAdvancePercentage = Number.isFinite(parsedAdvancePercentage)
      ? Math.min(100, Math.max(0, parsedAdvancePercentage))
      : 0;

    setIsGenerating(true);
    try {
      await onGenerateSchedules(contractId, {
        preserve_paid: preservePaid,
        allocation_mode: allocationMode,
        advance_percentage: allocationMode === 'ADVANCE_PERCENT' ? normalizedAdvancePercentage : undefined,
      });
    } catch {
      // Error toast is handled at App level.
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPayment = async (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
  ) => {
    if (!onConfirmPayment) return;
    await onConfirmPayment(scheduleId, payload);
  };

  const isExpandedPaymentTab = type === 'EDIT' && activeTab === 'PAYMENT';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white w-full rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in ${
          isExpandedPaymentTab ? 'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]' : 'max-w-4xl max-h-[90vh]'
        }`}
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
          {(type === 'ADD' || activeTab === 'CONTRACT') && (
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
                    onChange={(value) => handleChange('customer_id', value)}
                    options={customerOptions}
                    placeholder="Chọn khách hàng"
                    error={errors.customer_id}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <SearchableSelect
                    label="Dự án liên kết"
                    required
                    value={formData.project_id ? String(formData.project_id) : ''}
                    onChange={(value) => handleChange('project_id', value)}
                    options={projectOptions}
                    placeholder="Chọn dự án"
                    error={errors.project_id}
                  />
                </div>

                {selectedProject && (
                  <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Dự án: <span className="font-semibold text-slate-800">{selectedProject.project_code} - {selectedProject.project_name}</span>
                    {' | '}KH: <span className="font-semibold text-slate-800">{selectedProjectCustomer?.customer_name || '--'}</span>
                    {' | '}Giá trị hạng mục: <span className="font-semibold text-slate-800">{formatCurrency(selectedProjectValue)} VNĐ</span>
                    {' | '}Hình thức: <span className="font-semibold text-slate-800">{selectedProjectInvestmentModeLabel}</span>
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
                  <label className="text-sm font-semibold text-slate-700">Giá trị hợp đồng (VNĐ)</label>
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
                  ) : hasProjectValueMismatchWarning ? (
                    <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Tổng thành tiền hạng mục đang lệch Giá trị hợp đồng.
                    </p>
                  ) : showZeroValueWarning ? (
                    <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Giá trị hợp đồng đang bằng 0 VNĐ. Vui lòng kiểm tra trước khi lưu.
                    </p>
                  ) : null}
                  {!errors.value && (
                    <div className="mt-1 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                      <p className="text-sm leading-relaxed text-deep-teal">
                        <span className="font-extrabold uppercase tracking-wide">Số tiền bằng chữ:</span>{' '}
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
                    Theo dõi các mốc thu tiền theo chu kỳ {PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần'}.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    <label className="text-xs font-semibold text-slate-600">Cách phân bổ</label>
                    <select
                      value={allocationMode}
                      onChange={(event) => setAllocationMode(event.target.value as 'EVEN' | 'ADVANCE_PERCENT')}
                      className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {ALLOCATION_MODE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {allocationMode === 'ADVANCE_PERCENT' && (
                    <div className="flex flex-col gap-1 w-[120px]">
                      <label className="text-xs font-semibold text-slate-600">Thanh toán trước</label>
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

                  <label className="h-10 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={preservePaid}
                      onChange={(event) => setPreservePaid(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Giữ kỳ đã thu
                  </label>

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
                      {PAYMENT_CYCLE_LABELS[(formData.payment_cycle || 'ONCE') as PaymentCycle] || 'Một lần'}
                    </p>
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
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
