import { describe, expect, it } from 'vitest';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from '../utils/dateDisplay';

const pad2 = (value: number): string => String(value).padStart(2, '0');

const formatLocalDate = (value: string): string => {
  const date = new Date(value);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatLocalDateTime = (value: string): string => {
  const date = new Date(value);
  return `${formatLocalDate(value)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

describe('date display helpers', () => {
  it('returns placeholder for empty values', () => {
    expect(formatDateDdMmYyyy()).toBe('--');
    expect(formatDateTimeDdMmYyyy(null)).toBe('--');
  });

  it('returns raw text when the value cannot be parsed', () => {
    expect(formatDateDdMmYyyy('not-a-date')).toBe('not-a-date');
    expect(formatDateTimeDdMmYyyy('still-not-a-date')).toBe('still-not-a-date');
  });

  it('formats SQL date strings using UTC semantics', () => {
    const isoValue = '2026-03-19T10:15:20Z';

    expect(formatDateDdMmYyyy('2026-03-19 10:15:20')).toBe(formatLocalDate(isoValue));
  });

  it('formats SQL datetime strings using UTC semantics', () => {
    const isoValue = '2026-03-19T10:15:20Z';

    expect(formatDateTimeDdMmYyyy('2026-03-19 10:15:20')).toBe(formatLocalDateTime(isoValue));
  });
});
