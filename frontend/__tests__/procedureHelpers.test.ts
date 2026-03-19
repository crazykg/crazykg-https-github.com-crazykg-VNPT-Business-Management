import { describe, it, expect } from 'vitest';
import { computeEndDate } from '../utils/procedureHelpers';

describe('computeEndDate', () => {

  // ── Trường hợp hợp lệ ───────────────────────────────────────────────────────

  it('1 ngày → đến ngày = từ ngày (0 ngày cộng thêm)', () => {
    expect(computeEndDate('2025-01-01', 1)).toBe('2025-01-01');
  });

  it('5 ngày → đến ngày = từ ngày + 4', () => {
    expect(computeEndDate('2025-01-01', 5)).toBe('2025-01-05');
  });

  it('10 ngày bắt đầu từ giữa tháng', () => {
    expect(computeEndDate('2025-03-15', 10)).toBe('2025-03-24');
  });

  it('Vượt qua cuối tháng', () => {
    expect(computeEndDate('2025-01-28', 5)).toBe('2025-02-01');
  });

  it('Vượt qua cuối năm', () => {
    expect(computeEndDate('2025-12-30', 3)).toBe('2026-01-01');
  });

  it('Năm nhuận — tháng 2 có 29 ngày', () => {
    expect(computeEndDate('2024-02-27', 3)).toBe('2024-02-29');
  });

  it('Năm không nhuận — tháng 2 chỉ có 28 ngày', () => {
    expect(computeEndDate('2025-02-27', 3)).toBe('2025-03-01');
  });

  it('30 ngày', () => {
    expect(computeEndDate('2025-04-01', 30)).toBe('2025-04-30');
  });

  it('31 ngày bắt đầu từ đầu tháng', () => {
    expect(computeEndDate('2025-01-01', 31)).toBe('2025-01-31');
  });

  it('Kết quả luôn là định dạng YYYY-MM-DD (2 chữ số tháng và ngày)', () => {
    const result = computeEndDate('2025-01-01', 1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ── Trường hợp trả về null ──────────────────────────────────────────────────

  it('startDate là null → trả null', () => {
    expect(computeEndDate(null, 5)).toBeNull();
  });

  it('startDate là undefined → trả null', () => {
    expect(computeEndDate(undefined, 5)).toBeNull();
  });

  it('startDate là chuỗi rỗng → trả null', () => {
    expect(computeEndDate('', 5)).toBeNull();
  });

  it('durationDays là null → trả null', () => {
    expect(computeEndDate('2025-01-01', null)).toBeNull();
  });

  it('durationDays là undefined → trả null', () => {
    expect(computeEndDate('2025-01-01', undefined)).toBeNull();
  });

  it('durationDays = 0 → trả null (không tính)', () => {
    expect(computeEndDate('2025-01-01', 0)).toBeNull();
  });

  it('durationDays âm → trả null', () => {
    expect(computeEndDate('2025-01-01', -3)).toBeNull();
  });

  it('startDate không hợp lệ (chuỗi rác) → trả null', () => {
    expect(computeEndDate('not-a-date', 5)).toBeNull();
  });

  it('startDate sai định dạng (dd/mm/yyyy) → trả null', () => {
    expect(computeEndDate('01/01/2025', 5)).toBeNull();
  });

  // ── Kiểm tra không bị timezone-shift ───────────────────────────────────────

  it('Không bị lệch múi giờ — ngày cuối tháng vẫn đúng', () => {
    // 2025-03-31 + 1 ngày = 2025-03-31 (vì -1 trong công thức)
    expect(computeEndDate('2025-03-31', 1)).toBe('2025-03-31');
  });

  it('Không bị lệch múi giờ khi qua tháng mới', () => {
    expect(computeEndDate('2025-01-31', 2)).toBe('2025-02-01');
  });
});
