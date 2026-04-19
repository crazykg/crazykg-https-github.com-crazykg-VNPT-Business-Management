import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCauDashboardPayload } from '../types';
import { CustomerRequestOverviewWorkspace } from '../components/customer-request/CustomerRequestOverviewWorkspace';

const overviewDashboard: YeuCauDashboardPayload = {
  role: 'overview',
  summary: {
    total_cases: 6,
    status_counts: [],
    alert_counts: {
      missing_estimate: 6,
      over_estimate: 0,
      sla_risk: 2,
    },
  },
  top_customers: [
    { customer_id: 101, customer_name: 'Tổng công ty ABC', count: 11 },
  ],
  top_projects: [
    { project_id: 201, project_name: 'Dự án CRM doanh nghiệp', count: 7 },
  ],
  top_performers: [],
  attention_cases: [
    {
      request_case: {
        id: 7,
        ma_yc: 'CRC-202603-0007',
        request_code: 'CRC-202603-0007',
        tieu_de: 'Yêu cầu hỗ trợ',
        summary: 'Yêu cầu hỗ trợ',
        do_uu_tien: 3,
        ket_qua: 'dang_xu_ly',
        current_status_code: 'new_intake',
        trang_thai: 'new_intake',
        current_status_name_vi: 'Mới tiếp nhận',
        customer_name: 'Bệnh viện Sản',
        project_name: 'Nhi Hậu Giang',
        performer_name: 'Lý Thị Ngọc Mai',
        updated_at: '2026-03-22 16:41:00',
      },
      reasons: ['missing_estimate'],
    },
  ],
};

describe('CustomerRequestOverviewWorkspace UI', () => {
  it('opens detail from attention card using native button shell', async () => {
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();
    const onOpenListSurface = vi.fn();

    render(
      <CustomerRequestOverviewWorkspace
        loading={false}
        overviewDashboard={overviewDashboard}
        roleDashboards={{
          creator: null,
          dispatcher: null,
          performer: null,
        }}
        onOpenRequest={onOpenRequest}
        onOpenWorkspace={vi.fn()}
        onOpenListSurface={onOpenListSurface}
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    expect(onOpenRequest).toHaveBeenCalledWith(7, 'new_intake');
    expect(screen.getByRole('button', { name: /Mở workspace Người tạo/i })).toBeInTheDocument();
    expect(screen.getByText('Xem chi tiết')).toBeInTheDocument();
    expect(screen.getByText('Phụ trách')).toBeInTheDocument();
    expect(screen.getByText('Tiếp theo')).toBeInTheDocument();
    expect(screen.getByText('Giờ')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.getByText('Ca nóng:')).toBeInTheDocument();
    expect(screen.queryByText('missing_estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Bức tranh chung')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở Phân tích/i })).not.toBeInTheDocument();
    expect(onOpenListSurface).not.toHaveBeenCalled();
  });

  it('opens list surface from ranking links', async () => {
    const user = userEvent.setup();
    const onOpenListSurface = vi.fn();

    render(
      <CustomerRequestOverviewWorkspace
        loading={false}
        overviewDashboard={overviewDashboard}
        roleDashboards={{
          creator: null,
          dispatcher: null,
          performer: null,
        }}
        onOpenRequest={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenListSurface={onOpenListSurface}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Tổng công ty ABC' }));
    await user.click(screen.getAllByRole('button', { name: 'Vào danh sách' })[0]);

    expect(onOpenListSurface).toHaveBeenCalledTimes(2);
  });
});
