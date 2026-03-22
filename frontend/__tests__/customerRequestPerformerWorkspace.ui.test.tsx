import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCau, YeuCauPerformerWeeklyTimesheet } from '../types';
import { CustomerRequestPerformerWorkspace } from '../components/customer-request/CustomerRequestPerformerWorkspace';

const makeRequest = (partial?: Partial<YeuCau>): YeuCau => ({
  id: partial?.id ?? 1,
  ma_yc: partial?.ma_yc ?? 'CRC-PERF-0001',
  tieu_de: partial?.tieu_de ?? 'Xử lý yêu cầu performer',
  do_uu_tien: partial?.do_uu_tien ?? 3,
  trang_thai: partial?.trang_thai ?? 'analysis',
  ket_qua: partial?.ket_qua ?? 'dang_xu_ly',
  current_status_name_vi: partial?.current_status_name_vi ?? 'Phân tích',
  updated_at: partial?.updated_at ?? '2026-03-21 10:00:00',
  ...partial,
});

describe('CustomerRequestPerformerWorkspace UI', () => {
  it('shows performer workspace metrics and opens a request from top weekly cases', async () => {
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();
    const timesheet: YeuCauPerformerWeeklyTimesheet = {
      start_date: '2026-03-16',
      end_date: '2026-03-22',
      performer_user_id: 9,
      total_hours: 12.5,
      billable_hours: 10,
      non_billable_hours: 2.5,
      worklog_count: 5,
      days: [
        { date: '2026-03-17', hours_spent: 2, billable_hours: 2, non_billable_hours: 0, entry_count: 1 },
        { date: '2026-03-18', hours_spent: 4.5, billable_hours: 3.5, non_billable_hours: 1, entry_count: 2 },
      ],
      top_cases: [
        {
          request_case_id: 31,
          request_code: 'CRC-TOP-0031',
          summary: 'Case top giờ công tuần này',
          customer_name: 'VNPT Hà Nội',
          project_name: 'SOC Dashboard',
          status_code: 'in_progress',
          status_name_vi: 'Đang xử lý',
          hours_spent: 6.5,
          entry_count: 3,
          last_worked_at: '2026-03-21 08:30:00',
        },
      ],
      recent_entries: [
        {
          id: 91,
          request_case_id: 31,
          request_code: 'CRC-TOP-0031',
          summary: 'Case top giờ công tuần này',
          project_name: 'SOC Dashboard',
          current_status_code: 'in_progress',
          current_status_name_vi: 'Đang xử lý',
          work_content: 'Rà lại mapping dữ liệu và test đầu ra.',
          worked_on: '2026-03-21',
          created_at: '2026-03-21 08:30:00',
          hours_spent: 2.5,
        },
      ],
    };

    render(
      <CustomerRequestPerformerWorkspace
        loading={false}
        performerName="Ngô Dev"
        totalRows={4}
        pendingRows={[makeRequest({ id: 41, ma_yc: 'CRC-PENDING-0041', tieu_de: 'Việc mới cần nhận', trang_thai: 'analysis' })]}
        activeRows={[makeRequest({ id: 42, ma_yc: 'CRC-ACTIVE-0042', tieu_de: 'Việc đang thực hiện', trang_thai: 'in_progress', current_status_name_vi: 'Đang xử lý' })]}
        timesheet={timesheet}
        onOpenRequest={onOpenRequest}
      />
    );

    expect(screen.getByText(/Khu vực người xử lý/i)).toBeInTheDocument();
    expect(screen.getByText('Bảng giờ công tuần')).toBeInTheDocument();
    expect(screen.getByText('Top yêu cầu tuần này')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật gần đây')).toBeInTheDocument();
    expect(screen.getAllByText('CRC-TOP-0031')).toHaveLength(2);
    expect(screen.getByText(/5 nhật ký công việc/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /CRC-TOP-0031/i })[0]);
    expect(onOpenRequest).toHaveBeenCalledWith(31, 'in_progress');
  });
});
