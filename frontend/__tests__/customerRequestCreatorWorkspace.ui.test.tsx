import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCau, YeuCauDashboardPayload } from '../types';
import { CustomerRequestCreatorWorkspace } from '../components/customer-request/CustomerRequestCreatorWorkspace';

const makeRequest = (partial?: Partial<YeuCau>): YeuCau => ({
  id: partial?.id ?? 1,
  ma_yc: partial?.ma_yc ?? 'CRC-CREATOR-0001',
  tieu_de: partial?.tieu_de ?? 'Yêu cầu creator cần theo dõi',
  do_uu_tien: partial?.do_uu_tien ?? 3,
  trang_thai: partial?.trang_thai ?? 'new_intake',
  ket_qua: partial?.ket_qua ?? 'dang_xu_ly',
  current_status_name_vi: partial?.current_status_name_vi ?? 'Mới tiếp nhận',
  updated_at: partial?.updated_at ?? '2026-03-21 10:00:00',
  ...partial,
});

describe('CustomerRequestCreatorWorkspace UI', () => {
  it('shows creator workspace blocks, opens a request, and triggers create action', async () => {
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();
    const onCreateRequest = vi.fn();
    const reviewRow = makeRequest({
      id: 51,
      ma_yc: 'CRC-REVIEW-0051',
      tieu_de: 'Khách hàng đã phản hồi cần creator đánh giá',
      trang_thai: 'waiting_customer_feedback',
      current_status_name_vi: 'Đợi phản hồi KH',
      khach_hang_name: 'VNPT Hà Nội',
      performer_name: 'Ngô Dev',
    });
    const dashboard: YeuCauDashboardPayload = {
      role: 'creator',
      summary: {
        total_cases: 4,
        status_counts: [],
        alert_counts: {
          missing_estimate: 1,
          over_estimate: 0,
          sla_risk: 1,
        },
      },
      top_customers: [
        {
          customer_id: 20,
          customer_name: 'VNPT Hà Nội',
          count: 3,
        },
      ],
      top_projects: [
        {
          project_id: 501,
          project_name: 'SOC Dashboard',
          count: 2,
        },
      ],
      top_performers: [],
      attention_cases: [
        {
          request_case: reviewRow,
          reasons: ['sla_risk'],
        },
      ],
    };

    render(
      <CustomerRequestCreatorWorkspace
        loading={false}
        creatorName="Nguyễn A"
        totalRows={4}
        reviewRows={[reviewRow]}
        notifyRows={[makeRequest({ id: 52, ma_yc: 'CRC-NOTIFY-0052', trang_thai: 'completed', current_status_name_vi: 'Hoàn thành' })]}
        followUpRows={[makeRequest({ id: 53, ma_yc: 'CRC-FOLLOW-0053', trang_thai: 'new_intake' })]}
        closedRows={[makeRequest({ id: 54, ma_yc: 'CRC-CLOSED-0054', trang_thai: 'customer_notified', current_status_name_vi: 'Báo khách hàng' })]}
        dashboard={dashboard}
        onOpenRequest={onOpenRequest}
        onCreateRequest={onCreateRequest}
      />
    );

    expect(screen.getByText(/yêu cầu do bạn tạo/i)).toBeInTheDocument();
    expect(screen.getByText('KH đã phản hồi')).toBeInTheDocument();
    expect(screen.getByText('Cần hành động')).toBeInTheDocument();
    expect(screen.getByText('Top khách hàng của tôi')).toBeInTheDocument();
    expect(screen.getAllByText('VNPT Hà Nội').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phụ trách').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tiếp theo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Giờ').length).toBeGreaterThan(0);
    expect(screen.queryByText('sla_risk')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /CRC-REVIEW-0051/i })[0]);
    expect(onOpenRequest).toHaveBeenCalledWith(51, 'waiting_customer_feedback');

    await user.click(screen.getByRole('button', { name: /Tạo YC mới/i }));
    expect(onCreateRequest).toHaveBeenCalledTimes(1);
  });
});
