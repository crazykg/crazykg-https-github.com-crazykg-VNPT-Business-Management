import type {
  ContractMilestoneInstallmentInput,
  ContractPaymentAllocationMode,
} from '../../services/api/contractApi';
import type { Contract, PaymentSchedule } from '../../types';

export const ALLOCATION_MODE_OPTIONS: Array<{ value: ContractPaymentAllocationMode; label: string }> = [
  { value: 'EVEN', label: 'Chia đều' },
  { value: 'MILESTONE', label: 'Tạm ứng + Đợt (Đầu tư)' },
];

type MilestonePreviewTone = 'ADVANCE' | 'INSTALLMENT' | 'RETENTION';
export type MilestoneInputMode = 'AUTO' | 'CUSTOM';

export interface MilestoneInstallmentDraft {
  label: string;
  percentage: string;
  expected_date: string;
}

export interface MilestonePreviewRow {
  milestoneName: string;
  expectedDate: string;
  expectedAmount: number;
  tone: MilestonePreviewTone;
}

export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export const parseIsoDate = (value: unknown): Date | null => {
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

export const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

export const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const addUtcMonths = (value: Date, months: number): Date => {
  const next = new Date(value.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

export const startOfUtcMonth = (value: Date): Date => (
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
);

export const clampPercentage = (rawValue: unknown, fallback = 0): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, parsed));
};

export const roundMoney = (value: number): number => Math.round(Math.max(0, value) * 100) / 100;

export const formatPreviewMoney = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatDisplayDate = (value: string): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString('vi-VN');
};

export const formatPercentageString = (value: number): string => String(Number(roundMoney(value).toFixed(2)));

const normalizeTextForComparison = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export const inferAllocationModeFromSchedules = (
  items: PaymentSchedule[],
  projectInvestmentModeCode: string
): ContractPaymentAllocationMode | null => {
  if (projectInvestmentModeCode === 'DAU_TU') {
    return 'MILESTONE';
  }

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

export const resolveContractGenerationStartIso = (source: Partial<Contract>): string | null => {
  const effectiveDate = parseIsoDate(source.effective_date);
  if (effectiveDate) {
    return toIsoDate(effectiveDate);
  }

  const signDate = parseIsoDate(source.sign_date);
  if (signDate) {
    return toIsoDate(signDate);
  }

  return null;
};

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
    ((endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) * 12)
      + (endMonth.getUTCMonth() - startMonth.getUTCMonth())
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
      rawOffsetMonths = installmentCount === 1
        ? monthSpan
        : (monthSpan / Math.max(1, installmentCount - 1)) * index;
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

export const buildMilestonePreviewRows = (
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
    const baseInstallmentAmount = safeInstallmentCount > 0
      ? roundMoney(installmentPool / safeInstallmentCount)
      : 0;

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

export const buildMilestoneInstallmentDrafts = (
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
