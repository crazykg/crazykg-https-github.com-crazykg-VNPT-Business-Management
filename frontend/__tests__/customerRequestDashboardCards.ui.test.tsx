import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCauDashboardPayload } from '../types';
import { CustomerRequestDashboardCards } from '../components/customer-request/CustomerRequestDashboardCards';

const overviewDashboard: YeuCauDashboardPayload = {
  role: 'overview',
  summary: {
    total_cases: 8,
    status_counts: [],
    alert_counts: {
      missing_estimate: 2,
      over_estimate: 1,
      sla_risk: 3,
    },
  },
  top_customers: [
    {
      customer_id: 20,
      customer_name: 'VNPT Hà Nội',
      count: 5,
    },
  ],
  top_projects: [
    {
      project_id: 501,
      project_name: 'SOC Dashboard',
      count: 4,
    },
    {
      project_id: 777,
      project_name: 'CRM Sync',
      count: 2,
    },
  ],
  top_performers: [
    {
      performer_user_id: 3,
      performer_name: 'Ngô Dev',
      count: 4,
    },
  ],
  attention_cases: [
    {
      request_case: {
        id: 61,
        ma_yc: 'CRC-ATTN-0061',
        tieu_de: 'Ca cần chú ý từ dashboard',
        do_uu_tien: 3,
        trang_thai: 'in_progress',
        ket_qua: 'dang_xu_ly',
        current_status_name_vi: 'Đang xử lý',
        project_name: 'Dự án khác',
        updated_at: '2026-03-21 10:00:00',
      },
      reasons: ['sla_risk'],
    },
  ],
};

describe('CustomerRequestDashboardCards UI', () => {
  it('renders top projects from dashboard aggregate and opens attention case', async () => {
    const user = userEvent.setup();
    const onSelectAttentionCase = vi.fn();

    render(
      <CustomerRequestDashboardCards
        activeRoleFilter=""
        onRoleFilterChange={vi.fn()}
        overviewDashboard={overviewDashboard}
        roleDashboards={{
          creator: null,
          dispatcher: null,
          performer: null,
        }}
        isDashboardLoading={false}
        activeProcessCode=""
        onProcessCodeChange={vi.fn()}
        getStatusCount={() => 0}
        onSelectAttentionCase={onSelectAttentionCase}
      />
    );

    const projectSection = screen.getByText('Dự án cần chú ý').parentElement;
    expect(projectSection).not.toBeNull();
    const projectScope = within(projectSection as HTMLElement);
    expect(projectScope.getByText('SOC Dashboard')).toBeInTheDocument();
    expect(projectScope.getByText('CRM Sync')).toBeInTheDocument();
    expect(projectScope.queryByText('Dự án khác')).not.toBeInTheDocument();
    expect(screen.getByText('Phụ trách')).toBeInTheDocument();
    expect(screen.getByText('Tiếp theo')).toBeInTheDocument();
    expect(screen.getByText('Giờ')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.queryByText('sla_risk')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /CRC-ATTN-0061/i }));
    expect(onSelectAttentionCase).toHaveBeenCalledWith(61, 'in_progress');
  });
});
