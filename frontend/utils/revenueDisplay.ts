import { formatDateDdMmYyyy } from './dateDisplay';

const integerFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const formatCurrencyVnd = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  return `${integerFormatter.format(Math.round(value))} đ`;
};

export const formatCompactCurrencyVnd = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absolute >= 1_000_000_000) {
    return `${sign}${decimalFormatter.format(absolute / 1_000_000_000)} tỷ`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${decimalFormatter.format(absolute / 1_000_000)} tr`;
  }

  return `${sign}${integerFormatter.format(absolute)} đ`;
};

export const formatSignedCurrencyVnd = (
  value: number,
  options?: { compact?: boolean }
): string => {
  const formatted = options?.compact
    ? formatCompactCurrencyVnd(Math.abs(value))
    : formatCurrencyVnd(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
};

export const formatRevenuePeriodTypeLabel = (periodType: string): string => {
  if (periodType === 'MONTHLY') return 'Tháng';
  if (periodType === 'QUARTERLY') return 'Quý';
  if (periodType === 'YEARLY') return 'Năm';
  return periodType;
};

export const formatRevenueTargetTypeLabel = (targetType: string): string => {
  if (targetType === 'TOTAL') return 'Tổng doanh thu';
  if (targetType === 'NEW_CONTRACT') return 'HĐ mới';
  if (targetType === 'RENEWAL') return 'Gia hạn';
  if (targetType === 'RECURRING') return 'Định kỳ';
  return targetType;
};

export const formatRevenuePeriodLabel = (periodKey?: string | null): string => {
  if (!periodKey) {
    return '--';
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    return `Tháng ${monthMatch[2]}/${monthMatch[1]}`;
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch) {
    return `Quý ${quarterMatch[2]}/${quarterMatch[1]}`;
  }

  if (/^\d{4}$/.test(periodKey)) {
    return `Năm ${periodKey}`;
  }

  return periodKey;
};

export const formatRevenuePeriodShortLabel = (periodKey?: string | null): string => {
  if (!periodKey) {
    return '--';
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    return `T${monthMatch[2]}/${monthMatch[1].slice(-2)}`;
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch) {
    return `Q${quarterMatch[2]}/${quarterMatch[1].slice(-2)}`;
  }

  if (/^\d{4}$/.test(periodKey)) {
    return `N${periodKey.slice(-2)}`;
  }

  return periodKey;
};

const formatIsoDate = (value: string): string => {
  if (ISO_DATE_ONLY_REGEX.test(value)) {
    return formatDateDdMmYyyy(`${value}T00:00:00`);
  }

  return formatDateDdMmYyyy(value);
};

export const formatDateRangeDdMmYyyy = (
  from?: string | null,
  to?: string | null
): string => {
  if (!from && !to) {
    return '--';
  }

  if (!from) {
    return `Đến ${formatIsoDate(to as string)}`;
  }

  if (!to) {
    return `Từ ${formatIsoDate(from)}`;
  }

  return `${formatIsoDate(from)} - ${formatIsoDate(to)}`;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const getRevenuePeriodBounds = (
  periodKey: string
): { start: string; end: string } | null => {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const end = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${pad2(month)}-01`,
      end: `${year}-${pad2(month)}-${pad2(end)}`,
    };
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const end = new Date(year, endMonth, 0).getDate();
    return {
      start: `${year}-${pad2(startMonth)}-01`,
      end: `${year}-${pad2(endMonth)}-${pad2(end)}`,
    };
  }

  if (/^\d{4}$/.test(periodKey)) {
    return {
      start: `${periodKey}-01-01`,
      end: `${periodKey}-12-31`,
    };
  }

  return null;
};

