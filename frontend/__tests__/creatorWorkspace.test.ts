import { describe, expect, it } from 'vitest';
import type { YeuCau } from '../types';
import { splitCreatorWorkspaceRows } from '../components/customer-request/creatorWorkspace';

const makeRow = (overrides: Partial<YeuCau>): YeuCau => ({
  id: String(overrides.id ?? Math.random()),
  ma_yc: String(overrides.ma_yc ?? 'CRC-001'),
  tieu_de: overrides.tieu_de ?? 'Yêu cầu test',
  do_uu_tien: overrides.do_uu_tien ?? 2,
  trang_thai: overrides.trang_thai ?? 'new_intake',
  ket_qua: overrides.ket_qua ?? 'dang_xu_ly',
  ...overrides,
});

describe('splitCreatorWorkspaceRows', () => {
  it('splits creator rows into review, notify, follow-up and closed groups', () => {
    const { reviewRows, notifyRows, followUpRows, closedRows } = splitCreatorWorkspaceRows([
      makeRow({ id: 1, ma_yc: 'CRC-001', trang_thai: 'waiting_customer_feedback' }),
      makeRow({ id: 2, ma_yc: 'CRC-002', trang_thai: 'completed' }),
      makeRow({ id: 3, ma_yc: 'CRC-003', trang_thai: 'new_intake' }),
      makeRow({ id: 5, ma_yc: 'CRC-005', trang_thai: 'coding' }),
      makeRow({ id: 4, ma_yc: 'CRC-004', trang_thai: 'customer_notified' }),
    ]);

    expect(reviewRows.map((row) => row.ma_yc)).toEqual(['CRC-001']);
    expect(notifyRows.map((row) => row.ma_yc)).toEqual(['CRC-002']);
    expect(followUpRows.map((row) => row.ma_yc)).toEqual(['CRC-003', 'CRC-005']);
    expect(closedRows.map((row) => row.ma_yc)).toEqual(['CRC-004']);
  });
});
