import {
  formatCompactCurrencyVnd,
  formatRevenuePeriodLabel,
  getRevenuePeriodBounds,
} from './revenueDisplay';

export interface RevenueAdjustmentInput {
  periodKey: string;
  targetAmount: number;
  comparisonAmount: number;
  periodLabel?: string | null;
}

export interface RevenueAdjustmentItem {
  periodKey: string;
  periodLabel: string;
  targetAmount: number;
  comparisonAmount: number;
  gapAmount: number;
  isClosed: boolean;
  isCurrent: boolean;
  daysRemaining: number;
  requiredPerDay: number | null;
  status: 'healthy' | 'needs_adjustment' | 'closed_shortfall';
}

export interface RevenueAdjustmentSummary {
  totalGapAmount: number;
  openGapAmount: number;
  periodsNeedingAdjustment: number;
  openPeriodsNeedingAdjustment: number;
  averageGapPerOpenPeriod: number;
  currentRequiredPerDay: number;
  closedShortfallCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value: Date): Date => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const diffDaysInclusive = (from: Date, to: Date): number => {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) + 1;
};

export const buildRevenueAdjustmentPlan = (
  periods: RevenueAdjustmentInput[],
  referenceDate = new Date()
): { items: RevenueAdjustmentItem[]; summary: RevenueAdjustmentSummary } => {
  const today = startOfDay(referenceDate);

  const items = periods
    .map((period) => {
      const bounds = getRevenuePeriodBounds(period.periodKey);
      if (!bounds) {
        return null;
      }

      const periodStart = parseDateOnly(bounds.start);
      const periodEnd = parseDateOnly(bounds.end);
      const gapAmount = Math.max(period.targetAmount - period.comparisonAmount, 0);
      const isClosed = periodEnd.getTime() < today.getTime();
      const isCurrent = periodStart.getTime() <= today.getTime() && periodEnd.getTime() >= today.getTime();

      let daysRemaining = 0;
      let requiredPerDay: number | null = null;

      if (!isClosed) {
        const remainingAnchor = isCurrent ? today : periodStart;
        daysRemaining = diffDaysInclusive(remainingAnchor, periodEnd);
        requiredPerDay = gapAmount > 0 ? gapAmount / Math.max(daysRemaining, 1) : null;
      }

      let status: RevenueAdjustmentItem['status'] = 'healthy';
      if (gapAmount > 0 && isClosed) {
        status = 'closed_shortfall';
      } else if (gapAmount > 0) {
        status = 'needs_adjustment';
      }

      return {
        periodKey: period.periodKey,
        periodLabel: period.periodLabel || formatRevenuePeriodLabel(period.periodKey),
        targetAmount: period.targetAmount,
        comparisonAmount: period.comparisonAmount,
        gapAmount,
        isClosed,
        isCurrent,
        daysRemaining,
        requiredPerDay,
        status,
      };
    })
    .filter((item): item is RevenueAdjustmentItem => Boolean(item))
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));

  const totalGapAmount = items.reduce((sum, item) => sum + item.gapAmount, 0);
  const openItems = items.filter((item) => !item.isClosed && item.gapAmount > 0);
  const currentItems = items.filter((item) => item.isCurrent && item.gapAmount > 0);
  const closedShortfallCount = items.filter((item) => item.status === 'closed_shortfall').length;

  return {
    items,
    summary: {
      totalGapAmount,
      openGapAmount: openItems.reduce((sum, item) => sum + item.gapAmount, 0),
      periodsNeedingAdjustment: items.filter((item) => item.gapAmount > 0).length,
      openPeriodsNeedingAdjustment: openItems.length,
      averageGapPerOpenPeriod: openItems.length > 0
        ? openItems.reduce((sum, item) => sum + item.gapAmount, 0) / openItems.length
        : 0,
      currentRequiredPerDay: currentItems.reduce(
        (sum, item) => sum + (item.requiredPerDay ?? 0),
        0
      ),
      closedShortfallCount,
    },
  };
};

export const describeRevenueAdjustment = (
  item: RevenueAdjustmentItem,
  compareLabel: string
): string => {
  if (item.status === 'healthy') {
    return 'Đang đạt hoặc vượt kế hoạch.';
  }

  if (item.status === 'closed_shortfall') {
    return `Kỳ đã đóng, thiếu ${formatCompactCurrencyVnd(item.gapAmount)} so với ${compareLabel.toLowerCase()}.`;
  }

  if (item.isCurrent && item.requiredPerDay) {
    return `Cần bù ${formatCompactCurrencyVnd(item.gapAmount)}, tương đương ${formatCompactCurrencyVnd(item.requiredPerDay)}/ngày.`;
  }

  if (item.daysRemaining > 0) {
    return `Còn thiếu ${formatCompactCurrencyVnd(item.gapAmount)} trong ${item.daysRemaining} ngày còn lại.`;
  }

  return `Còn thiếu ${formatCompactCurrencyVnd(item.gapAmount)} so với ${compareLabel.toLowerCase()}.`;
};
