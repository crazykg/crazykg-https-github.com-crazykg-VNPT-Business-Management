import { describe, expect, it } from 'vitest';
import type { YeuCau } from '../types';
import {
  buildDispatcherPmWatchRows,
  buildDispatcherTeamLoadRows,
  splitDispatcherWorkspaceRows,
} from '../components/customer-request/dispatcherWorkspace';

const makeRow = (overrides: Partial<YeuCau>): YeuCau => ({
  id: String(overrides.id ?? Math.random()),
  ma_yc: String(overrides.ma_yc ?? 'CRC-001'),
  tieu_de: overrides.tieu_de ?? 'Yêu cầu test',
  do_uu_tien: overrides.do_uu_tien ?? 2,
  trang_thai: overrides.trang_thai ?? 'new_intake',
  ket_qua: overrides.ket_qua ?? 'dang_xu_ly',
  ...overrides,
});

describe('splitDispatcherWorkspaceRows', () => {
  it('groups dispatcher rows into queue, returned, feedback, approval and active buckets', () => {
    const { queueRows, returnedRows, feedbackRows, approvalRows, activeRows } = splitDispatcherWorkspaceRows([
      makeRow({ id: 1, ma_yc: 'CRC-001', trang_thai: 'new_intake', performer_user_id: null, dispatch_route: 'assign_pm' }),
      makeRow({ id: 2, ma_yc: 'CRC-002', trang_thai: 'returned_to_manager', performer_user_id: 3 }),
      makeRow({ id: 3, ma_yc: 'CRC-003', trang_thai: 'waiting_customer_feedback', performer_user_id: 3 }),
      makeRow({ id: 4, ma_yc: 'CRC-004', trang_thai: 'in_progress', performer_user_id: 3 }),
      makeRow({ id: 5, ma_yc: 'CRC-005', trang_thai: 'analysis', performer_user_id: null }),
      makeRow({ id: 7, ma_yc: 'CRC-007', trang_thai: 'new_intake', performer_user_id: 3, dispatch_route: 'self_handle' }),
      makeRow({ id: 8, ma_yc: 'CRC-008', trang_thai: 'coding', performer_user_id: 3 }),
      makeRow({ id: 6, ma_yc: 'CRC-006', trang_thai: 'completed', performer_user_id: 3 }),
    ]);

    expect(queueRows.map((row) => row.ma_yc)).toEqual(['CRC-001', 'CRC-005']);
    expect(returnedRows.map((row) => row.ma_yc)).toEqual(['CRC-002']);
    expect(feedbackRows.map((row) => row.ma_yc)).toEqual(['CRC-003']);
    expect(approvalRows.map((row) => row.ma_yc)).toEqual(['CRC-006']);
    expect(activeRows.map((row) => row.ma_yc)).toEqual(['CRC-004', 'CRC-007', 'CRC-008']);
  });

  it('builds dispatcher team load and PM watch rows from active cases', () => {
    const rows = [
      makeRow({
        id: 1,
        ma_yc: 'CRC-001',
        trang_thai: 'in_progress',
        performer_user_id: 7,
        performer_name: 'Dev A',
        total_hours_spent: 4,
        estimated_hours: 8,
      }),
      makeRow({
        id: 2,
        ma_yc: 'CRC-002',
        trang_thai: 'analysis',
        performer_user_id: 7,
        performer_name: 'Dev A',
        total_hours_spent: 3,
        estimated_hours: null,
        missing_estimate: true,
      }),
      makeRow({
        id: 3,
        ma_yc: 'CRC-003',
        trang_thai: 'returned_to_manager',
        performer_user_id: 9,
        performer_name: 'Dev B',
        total_hours_spent: 6,
        estimated_hours: 4,
        over_estimate: true,
      }),
    ];

    const teamLoadRows = buildDispatcherTeamLoadRows(rows);
    const pmWatchRows = buildDispatcherPmWatchRows(rows);

    expect(teamLoadRows).toHaveLength(2);
    expect(teamLoadRows[0]).toMatchObject({
      performer_name: 'Dev B',
      active_count: 1,
      over_estimate_count: 1,
    });
    expect(teamLoadRows[1]).toMatchObject({
      performer_name: 'Dev A',
      active_count: 2,
      missing_estimate_count: 1,
    });
    expect(pmWatchRows.map((row) => row.ma_yc)).toEqual(['CRC-003', 'CRC-002']);
  });
});
