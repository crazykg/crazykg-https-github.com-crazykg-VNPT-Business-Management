import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../components/Dashboard';
import type { DashboardStats } from '../types/dashboard';

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
  it('renders KPI cards and overview sections from the dashboard module', () => {
    render(<Dashboard stats={stats} />);

    expect(screen.getByRole('heading', { name: 'Bảng điều khiển KPI chiến lược' })).toBeInTheDocument();
    expect(screen.getByText('Doanh thu thực tế')).toBeInTheDocument();
    expect(screen.getByText(/25\.000\.000\s*đ/)).toBeInTheDocument();
    expect(screen.getByText('Forecast tháng hiện tại')).toBeInTheDocument();
    expect(screen.getByText(/15\.000\.000\s*đ/)).toBeInTheDocument();
    expect(screen.getByText('Doanh thu thực tế vs Kế hoạch theo tháng')).toBeInTheDocument();
    expect(screen.getByText('HĐ sắp hết hiệu lực')).toBeInTheDocument();
    expect(screen.getByText('Bệnh viện Trung tâm')).toBeInTheDocument();
    expect(screen.getByText('17 ngày')).toBeInTheDocument();
  });
});
