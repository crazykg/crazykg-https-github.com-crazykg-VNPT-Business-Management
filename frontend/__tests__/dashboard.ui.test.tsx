import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../components/Dashboard';
import type { DashboardStats } from '../types/dashboard';

const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api/projectApi', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
}));

const stats: DashboardStats = {
  totalRevenue: 85000000,
  actualRevenue: 25000000,
  forecastRevenueMonth: 15000000,
  forecastRevenueQuarter: 45000000,
  monthlyRevenueComparison: [
    { month: '2026-01', planned: 10000000, actual: 9000000 },
    { month: '2026-02', planned: 12000000, actual: 11000000 },
  ],
  projectStatusCounts: [
    { status: 'CHUAN_BI', count: 2 },
    { status: 'THUC_HIEN_DAU_TU', count: 4 },
  ],
  contractStatusCounts: [
    { status: 'SIGNED', count: 5, totalValue: 85000000 },
  ],
  collectionRate: 72,
  overduePaymentCount: 3,
  overduePaymentAmount: 5000000,
  expiringContracts: [
    {
      id: 10,
      contract_code: 'HD001',
      contract_name: 'Hợp đồng HIS',
      customer_name: 'Bệnh viện Trung tâm',
      expiry_date: '2026-04-15',
      daysRemaining: 17,
      value: 85000000,
    },
  ],
};

describe('Dashboard UI', () => {
  it('loads project progress phases from the latest template configuration', async () => {
    fetchProcedureTemplatesMock.mockResolvedValue([
      {
        id: 1,
        template_code: 'DAU_TU',
        template_name: 'Đầu tư',
        is_active: true,
        phases: ['CHUAN_BI', 'PHE_DUYET_DU_AN', 'THUC_HIEN_DAU_TU'],
      },
    ]);

    render(
      <Dashboard
        contracts={[]}
        paymentSchedules={[]}
        projects={[
          {
            id: 1,
            project_code: 'DA001',
            project_name: 'Dự án theo cấu hình mới',
            customer_id: null,
            status: 'CHUAN_BI',
          },
        ]}
        customers={[]}
        departments={[]}
        employees={[]}
      />
    );

    await waitFor(() => expect(fetchProcedureTemplatesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Chuẩn bị')).toBeInTheDocument();
    expect(screen.getByText('PHE_DUYET_DU_AN')).toBeInTheDocument();
    expect(screen.getByText('Thực hiện đầu tư')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('renders KPI cards and overview sections from the dashboard module', () => {
    fetchProcedureTemplatesMock.mockResolvedValue([]);

    render(<Dashboard stats={stats} />);

    expect(screen.getByRole('heading', { name: 'Bảng điều khiển KPI chiến lược' })).toBeInTheDocument();
    expect(screen.getByText('Doanh thu thực tế')).toBeInTheDocument();
    expect(screen.getByText(/25\.000\.000\s*đ/)).toBeInTheDocument();
    expect(screen.getByText('Forecast tháng hiện tại')).toBeInTheDocument();
    expect(screen.getByText(/15\.000\.000\s*đ/)).toBeInTheDocument();
    expect(screen.getByText('Doanh thu 6 tháng gần nhất')).toBeInTheDocument();
    expect(screen.getByText('Hợp đồng sắp hết hiệu lực')).toBeInTheDocument();
    expect(screen.getByText('Bệnh viện Trung tâm')).toBeInTheDocument();
    expect(screen.getByText('17d')).toBeInTheDocument();
  });
});
