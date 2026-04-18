import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCauDashboardPayload } from '../types';
import { CustomerRequestDashboardCards } from '../components/customer-request/CustomerRequestDashboardCards';

const overviewDashboard: YeuCauDashboardPayload = {
  role: 'overview',
  summary: {
    total_cases: 9,
    status_counts: [],
    alert_counts: {
      missing_estimate: 2,
      over_estimate: 1,
      sla_risk: 3,
    },
    operational: {
      total_cases: 8,
      active_cases: 5,
      completed_cases: 3,
      waiting_customer_feedback_cases: 2,
      completion_rate: 37.5,
      by_type: {
        support: {
          total_cases: 5,
          active_cases: 3,
          completed_cases: 2,
          waiting_customer_feedback_cases: 1,
          completion_rate: 40,
        },
        programming: {
          total_cases: 3,
          active_cases: 2,
          completed_cases: 1,
          waiting_customer_feedback_cases: 1,
          completion_rate: 33.3,
        },
      },
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
      count: 6,
      department_name: 'Trung tâm lập trình',
      total_cases: 6,
      active_cases: 4,
      completed_cases: 2,
      waiting_customer_feedback_cases: 1,
      completion_rate: 33.3,
      support_cases: 2,
      programming_cases: 4,
    },
    {
      performer_user_id: 4,
      performer_name: 'Lê Support',
      count: 2,
      department_name: 'Trung tâm hỗ trợ',
      total_cases: 2,
      active_cases: 1,
      completed_cases: 1,
      waiting_customer_feedback_cases: 1,
      completion_rate: 50,
      support_cases: 2,
      programming_cases: 0,
    },
  ],
  unit_chart: [
    {
      unit_key: 'customer:20',
      customer_id: 20,
      customer_code: null,
      customer_name: 'VNPT Hà Nội',
      total_cases: 5,
      active_cases: 3,
      completed_cases: 2,
      waiting_customer_feedback_cases: 1,
      completion_rate: 40,
      backlog_cases: 3,
      support_cases: 5,
      programming_cases: 0,
    },
    {
      unit_key: 'customer:21',
      customer_id: 21,
      customer_code: null,
      customer_name: 'Bệnh viện Số 2',
      total_cases: 3,
      active_cases: 2,
      completed_cases: 1,
      waiting_customer_feedback_cases: 1,
      completion_rate: 33.3,
      backlog_cases: 2,
      support_cases: 0,
      programming_cases: 3,
    },
  ],
  top_backlog_units: [
    {
      unit_key: 'customer:20',
      customer_id: 20,
      customer_code: null,
      customer_name: 'VNPT Hà Nội',
      total_cases: 5,
      active_cases: 3,
      completed_cases: 2,
      waiting_customer_feedback_cases: 1,
      completion_rate: 40,
      backlog_cases: 3,
      support_cases: 5,
      programming_cases: 0,
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
  it('renders the operational analytics dashboard and removes the old helper sections', () => {
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
        onSelectAttentionCase={vi.fn()}
      />
    );

    expect(screen.getByText('Dashboard yêu cầu khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Tổng số yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Đang thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Đã hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Số lượng yêu cầu theo từng khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Top 5 khách hàng có yêu cầu tồn nhiều nhất')).toBeInTheDocument();
    expect(screen.getByText('Top 10 người xử lý')).toBeInTheDocument();

    const unitSection = screen.getByText('Số lượng yêu cầu theo từng khách hàng').closest('section');
    expect(unitSection).not.toBeNull();
    const unitScope = within(unitSection as HTMLElement);
    expect(unitScope.getByText('VNPT Hà Nội')).toBeInTheDocument();
    expect(unitScope.getByText('Bệnh viện Số 2')).toBeInTheDocument();

    const performerSection = screen.getByText('Top 10 người xử lý').closest('section');
    expect(performerSection).not.toBeNull();
    const performerScope = within(performerSection as HTMLElement);
    expect(performerScope.getByText('Ngô Dev')).toBeInTheDocument();
    expect(performerScope.getByText('Lê Support')).toBeInTheDocument();

    expect(screen.queryByText('Dải chú ý nổi bật')).not.toBeInTheDocument();
    expect(screen.queryByText('Mở đúng việc cần xử lý trước')).not.toBeInTheDocument();
    expect(screen.queryByText('Dự án cần chú ý')).not.toBeInTheDocument();
    expect(screen.queryByText('Trạng thái đang bám')).not.toBeInTheDocument();
    expect(screen.queryByText('Phân tích điều hành')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Tổng hợp tình trạng thực hiện, hoàn thành, chờ phản hồi khách hàng/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Dữ liệu theo bộ lọc hiện tại')).not.toBeInTheDocument();
    expect(screen.queryByText('Đang cập nhật dữ liệu')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mỗi dòng hiển thị tổng số YC/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sắp xếp theo số yêu cầu đang thực hiện/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Theo tổng yêu cầu phụ trách/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/người trong bảng/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Chờ KH phản hồi 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /CRC-ATTN-0061/i })).not.toBeInTheDocument();
    expect(screen.queryByText('sla_risk')).not.toBeInTheDocument();
  });
});
