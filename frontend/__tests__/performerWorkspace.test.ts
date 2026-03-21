import { describe, expect, it } from 'vitest';
import type { YeuCau } from '../types';
import { splitPerformerWorkspaceRows } from '../components/customer-request/performerWorkspace';

const makeRow = (overrides: Partial<YeuCau>): YeuCau => ({
  id: String(overrides.id ?? Math.random()),
  ma_yc: String(overrides.ma_yc ?? 'CRC-001'),
  tieu_de: overrides.tieu_de ?? 'Yêu cầu test',
  do_uu_tien: overrides.do_uu_tien ?? 2,
  trang_thai: overrides.trang_thai ?? 'analysis',
  ket_qua: overrides.ket_qua ?? 'dang_xu_ly',
  ...overrides,
});

describe('splitPerformerWorkspaceRows', () => {
  it('splits performer rows into pending, active and closed buckets', () => {
    const { pendingRows, activeRows, closedRows } = splitPerformerWorkspaceRows([
      makeRow({ id: 1, ma_yc: 'CRC-001', trang_thai: 'completed' }),
      makeRow({ id: 2, ma_yc: 'CRC-002', trang_thai: 'in_progress' }),
      makeRow({ id: 3, ma_yc: 'CRC-003', trang_thai: 'analysis' }),
      makeRow({ id: 4, ma_yc: 'CRC-004', trang_thai: 'returned_to_manager' }),
    ]);

    expect(pendingRows.map((row) => row.ma_yc)).toEqual(['CRC-004', 'CRC-003']);
    expect(activeRows.map((row) => row.ma_yc)).toEqual(['CRC-002']);
    expect(closedRows.map((row) => row.ma_yc)).toEqual(['CRC-001']);
  });

  it('keeps unknown non-closed statuses in the pending bucket', () => {
    const { pendingRows, activeRows, closedRows } = splitPerformerWorkspaceRows([
      makeRow({ id: 5, ma_yc: 'CRC-005', trang_thai: 'custom_status' }),
    ]);

    expect(pendingRows.map((row) => row.ma_yc)).toEqual(['CRC-005']);
    expect(activeRows).toEqual([]);
    expect(closedRows).toEqual([]);
  });
});
