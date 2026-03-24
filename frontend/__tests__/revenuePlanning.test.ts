import { describe, expect, it } from 'vitest';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
  formatRevenuePeriodLabel,
  getRevenuePeriodBounds,
} from '../utils/revenueDisplay';
import { buildRevenueAdjustmentPlan } from '../utils/revenuePlanning';

describe('revenueDisplay helpers', () => {
  it('formats VND consistently for exact and compact views', () => {
    expect(formatCurrencyVnd(1250000)).toBe('1.250.000 đ');
    expect(formatCompactCurrencyVnd(1250000)).toBe('1,3 tr');
    expect(formatCompactCurrencyVnd(999)).toBe('999 đ');
  });

  it('formats period labels and date ranges for revenue tabs', () => {
    expect(formatRevenuePeriodLabel('2026-03')).toBe('Tháng 03/2026');
    expect(formatRevenuePeriodLabel('2026-Q2')).toBe('Quý 2/2026');
    expect(formatRevenuePeriodLabel('2026')).toBe('Năm 2026');
    expect(formatDateRangeDdMmYyyy('2026-03-01', '2026-03-31')).toBe('01/03/2026 - 31/03/2026');
  });

  it('parses period bounds for month, quarter and year', () => {
    expect(getRevenuePeriodBounds('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(getRevenuePeriodBounds('2026-Q4')).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
    expect(getRevenuePeriodBounds('2026')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
});

describe('buildRevenueAdjustmentPlan', () => {
  it('classifies closed, current and future gaps for adjustment planning', () => {
    const { items, summary } = buildRevenueAdjustmentPlan(
      [
        { periodKey: '2026-01', targetAmount: 100, comparisonAmount: 80 },
        { periodKey: '2026-03', targetAmount: 100, comparisonAmount: 40 },
        { periodKey: '2026-04', targetAmount: 50, comparisonAmount: 10 },
      ],
      new Date('2026-03-15T00:00:00')
    );

    expect(items).toHaveLength(3);
    expect(items[0].status).toBe('closed_shortfall');
    expect(items[1].status).toBe('needs_adjustment');
    expect(items[1].isCurrent).toBe(true);
    expect(items[1].daysRemaining).toBe(17);
    expect(items[1].requiredPerDay).toBeCloseTo(60 / 17, 5);
    expect(items[2].status).toBe('needs_adjustment');
    expect(items[2].isClosed).toBe(false);

    expect(summary.totalGapAmount).toBe(120);
    expect(summary.periodsNeedingAdjustment).toBe(3);
    expect(summary.openPeriodsNeedingAdjustment).toBe(2);
    expect(summary.closedShortfallCount).toBe(1);
    expect(summary.currentRequiredPerDay).toBeCloseTo(60 / 17, 5);
  });
});
