import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PaginationMeta, YeuCau } from '../types';
import { CustomerRequestListPane } from '../components/customer-request/CustomerRequestListPane';

const makeRequest = (partial?: Partial<YeuCau>): YeuCau => ({
  id: partial?.id ?? 22,
  ma_yc: partial?.ma_yc ?? 'CRC-202603-0022',
  tieu_de: partial?.tieu_de ?? 'Đồng bộ báo cáo ngày',
  do_uu_tien: partial?.do_uu_tien ?? 3,
  trang_thai: partial?.trang_thai ?? 'in_progress',
  ket_qua: partial?.ket_qua ?? 'dang_xu_ly',
  summary: partial?.summary ?? 'Đồng bộ báo cáo ngày',
  current_status_name_vi: partial?.current_status_name_vi ?? 'Đang xử lý',
  warning_level: partial?.warning_level ?? 'hard',
  sla_status: partial?.sla_status ?? 'at_risk',
  tong_gio_xu_ly: partial?.tong_gio_xu_ly ?? 5,
  total_hours_spent: partial?.total_hours_spent ?? 5,
  estimated_hours: partial?.estimated_hours ?? 4,
  hours_usage_pct: partial?.hours_usage_pct ?? 125,
  khach_hang_name: partial?.khach_hang_name ?? 'VNPT Hà Nội',
  customer_name: partial?.customer_name ?? 'VNPT Hà Nội',
  support_service_group_name: partial?.support_service_group_name ?? 'SOC 01',
  dispatcher_name: partial?.dispatcher_name ?? 'Trần PM',
  performer_name: partial?.performer_name ?? 'Ngô Dev',
  project_name: partial?.project_name ?? 'SOC Dashboard',
  received_at: partial?.received_at ?? '2026-03-20 08:00:00',
  sla_due_at: partial?.sla_due_at ?? '2026-03-22 17:00:00',
  requester_name: partial?.requester_name ?? 'Nguyễn A',
  ...partial,
});

const defaultMeta: PaginationMeta = {
  page: 2,
  per_page: 20,
  total: 41,
  total_pages: 3,
};

describe('CustomerRequestListPane UI', () => {
  it('renders alerts, request row and pagination callbacks', async () => {
    const user = userEvent.setup();
    const onSelectRow = vi.fn();
    const onListPageChange = vi.fn();
    const onToggleMissingEstimate = vi.fn();

    render(
      <CustomerRequestListPane
        activeProcessCode="in_progress"
        processOptions={[{ value: 'in_progress', label: 'Đang xử lý' }]}
        onProcessCodeChange={vi.fn()}
        requestKeyword=""
        onRequestKeywordChange={vi.fn()}
        requestCustomerFilter=""
        onRequestCustomerFilterChange={vi.fn()}
        requestSupportGroupFilter=""
        onRequestSupportGroupFilterChange={vi.fn()}
        requestPriorityFilter=""
        onRequestPriorityFilterChange={vi.fn()}
        customerOptions={[]}
        supportServiceGroups={[]}
        requestMissingEstimateFilter={false}
        onToggleMissingEstimate={onToggleMissingEstimate}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 3, over_estimate: 2, sla_risk: 1 }}
        isDashboardLoading={false}
        rows={[makeRequest()]}
        isListLoading={false}
        selectedRequestId={null}
        onSelectRow={onSelectRow}
        listPage={2}
        listMeta={defaultMeta}
        onListPageChange={onListPageChange}
        hasListFilters={true}
        onClearFilters={vi.fn()}
        requestRoleFilter=""
      />
    );

    expect(screen.getByText(/Thiếu estimate \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Vượt estimate \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();
    expect(screen.getByText(/Điều phối: Trần PM/)).toBeInTheDocument();
    expect(screen.getAllByText(/Vượt estimate/)).toHaveLength(2);
    expect(screen.getByText('Nguy cơ SLA')).toBeInTheDocument();

    await user.click(screen.getByText('CRC-202603-0022'));
    expect(onSelectRow).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Sau/i }));
    expect(onListPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByText(/Thiếu estimate \(3\)/));
    expect(onToggleMissingEstimate).toHaveBeenCalledTimes(1);
  });
});
