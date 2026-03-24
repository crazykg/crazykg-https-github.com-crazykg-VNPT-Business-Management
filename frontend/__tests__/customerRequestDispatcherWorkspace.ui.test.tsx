import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCau, YeuCauDashboardPayload } from '../types';
import { CustomerRequestDispatcherWorkspace } from '../components/customer-request/CustomerRequestDispatcherWorkspace';
import type { DispatcherTeamLoadRow } from '../components/customer-request/dispatcherWorkspace';

const makeRequest = (partial?: Partial<YeuCau>): YeuCau => ({
  id: partial?.id ?? 1,
  ma_yc: partial?.ma_yc ?? 'CRC-REQ-0001',
  tieu_de: partial?.tieu_de ?? 'Đồng bộ báo cáo điều phối',
  do_uu_tien: partial?.do_uu_tien ?? 3,
  trang_thai: partial?.trang_thai ?? 'new_intake',
  ket_qua: partial?.ket_qua ?? 'dang_xu_ly',
  current_status_name_vi: partial?.current_status_name_vi ?? 'Mới tiếp nhận',
  updated_at: partial?.updated_at ?? '2026-03-21 09:15:00',
  ...partial,
});

describe('CustomerRequestDispatcherWorkspace UI', () => {
  it('shows dispatcher workspace sections and opens a selected request', async () => {
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();
    const queueRow = makeRequest({
      id: 11,
      ma_yc: 'CRC-QUEUE-0011',
      tieu_de: 'Ca chờ phân công performer',
      trang_thai: 'new_intake',
      khach_hang_name: 'VNPT Hà Nội',
      updated_at: '2026-03-21 08:00:00',
    });
    const returnedRow = makeRequest({
      id: 12,
      ma_yc: 'CRC-RETURN-0012',
      tieu_de: 'Ca performer chuyển trả',
      trang_thai: 'returned_to_manager',
      current_status_name_vi: 'Chuyển trả QL',
    });
    const approvalRow = makeRequest({
      id: 13,
      ma_yc: 'CRC-APPROVAL-0013',
      tieu_de: 'Ca chờ duyệt kết quả',
      trang_thai: 'completed',
      current_status_name_vi: 'Hoàn thành',
      performer_name: 'Ngô Dev',
      project_name: 'SOC Dashboard',
      over_estimate: true,
    });
    const dashboard: YeuCauDashboardPayload = {
      role: 'dispatcher',
      summary: {
        total_cases: 6,
        status_counts: [],
        alert_counts: {
          missing_estimate: 1,
          over_estimate: 2,
          sla_risk: 1,
        },
      },
      top_customers: [],
      top_performers: [],
      attention_cases: [
        {
          request_case: makeRequest({
            id: 21,
            ma_yc: 'CRC-ATTN-0021',
            tieu_de: 'Ca nóng cần PM bám',
            trang_thai: 'in_progress',
            current_status_name_vi: 'Đang xử lý',
            performer_name: 'Ngô Dev',
            project_name: 'SOC Dashboard',
          }),
          reasons: ['Nguy cơ SLA', 'Thiếu ước lượng'],
        },
      ],
    };
    const teamLoadRows: DispatcherTeamLoadRow[] = [
      {
        performer_user_id: '9',
        performer_name: 'Ngô Dev',
        active_count: 3,
        total_hours_spent: 8.5,
        estimated_hours: 10,
        load_pct: 85,
        missing_estimate_count: 1,
        over_estimate_count: 1,
      },
    ];

    render(
      <CustomerRequestDispatcherWorkspace
        loading={false}
        dispatcherName="Trần PM"
        totalRows={6}
        queueRows={[queueRow]}
        returnedRows={[returnedRow]}
        feedbackRows={[]}
        approvalRows={[approvalRow]}
        activeRows={[makeRequest({ id: 14, ma_yc: 'CRC-ACTIVE-0014', trang_thai: 'in_progress', current_status_name_vi: 'Đang xử lý' })]}
        teamLoadRows={teamLoadRows}
        pmWatchRows={[approvalRow]}
        dashboard={dashboard}
        onOpenRequest={onOpenRequest}
      />
    );

    expect(screen.getByText(/yêu cầu trong phạm vi điều phối/i)).toBeInTheDocument();
    expect(screen.getByText('Hàng chờ phân công')).toBeInTheDocument();
    expect(screen.getByText('Ca PM cần chốt ước lượng / nhật ký công việc')).toBeInTheDocument();
    expect(screen.getAllByText('Ngô Dev').length).toBeGreaterThan(0);
    expect(screen.getByText('Điểm nóng điều phối')).toBeInTheDocument();
    expect(screen.getByText('CRC-ATTN-0021')).toBeInTheDocument();
    expect(screen.getAllByText('Phụ trách').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tiếp theo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Giờ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nguy cơ SLA').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /CRC-QUEUE-0011/i }));
    expect(onOpenRequest).toHaveBeenCalledWith(11, 'new_intake');
  });
});
