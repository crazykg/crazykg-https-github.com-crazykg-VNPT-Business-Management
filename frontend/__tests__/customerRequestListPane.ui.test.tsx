import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PaginationMeta, YeuCau } from '../types';
import { CustomerRequestListPane } from '../components/customer-request/CustomerRequestListPane';

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

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
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onSelectRow = vi.fn();
    const onPrimaryAction = vi.fn();
    const onListPageChange = vi.fn();
    const onRowsPerPageChange = vi.fn();
    const onToggleMissingEstimate = vi.fn();
    const onRequestPriorityFilterChange = vi.fn();
    const onRequestCustomerFilterChange = vi.fn();

    const { container } = render(
      <CustomerRequestListPane
        activeProcessCode="in_progress"
        processOptions={[{ value: 'in_progress', label: 'Đang xử lý' }]}
        onProcessCodeChange={vi.fn()}
        requestKeyword=""
        onRequestKeywordChange={vi.fn()}
        requestCustomerFilter=""
        onRequestCustomerFilterChange={onRequestCustomerFilterChange}
        requestSupportGroupFilter=""
        onRequestSupportGroupFilterChange={vi.fn()}
        requestPriorityFilter=""
        onRequestPriorityFilterChange={onRequestPriorityFilterChange}
        customerOptions={[
          {
            value: '21',
            label: 'VNPT Hồ Chí Minh',
            searchText: 'VNPT Hồ Chí Minh VNPT-HCM-21 0301234567 21',
          },
        ]}
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
        onPrimaryAction={onPrimaryAction}
        listPage={2}
        rowsPerPage={20}
        listMeta={defaultMeta}
        onListPageChange={onListPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        hasListFilters={true}
        onClearFilters={vi.fn()}
        requestRoleFilter=""
        presentation="responsive"
      />
    );

    expect(screen.getByText(/Thiếu ước lượng \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Vượt ước lượng \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Sức khỏe xử lý')).toBeInTheDocument();
    expect(screen.getByText('CTA')).toBeInTheDocument();
    expect(screen.queryByText('Độ ưu tiên')).not.toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();
    expect(screen.getByText(/Điều phối: Trần PM/)).toBeInTheDocument();
    expect(screen.getAllByText(/Vượt ước lượng/)).toHaveLength(2);
    expect(screen.getAllByText('Nguy cơ SLA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('⚡ Cao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ra soat estimate/i })).toBeInTheDocument();

    await user.click(screen.getByText('CRC-202603-0022'));
    expect(onSelectRow).toHaveBeenCalledTimes(1);

    const actionButtons = screen.getAllByRole('button', { name: /Ra soat estimate/i });
    await user.click(actionButtons[actionButtons.length - 1] as HTMLElement);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction.mock.calls[0]?.[1]).toMatchObject({
      kind: 'detail',
      label: 'Ra soat estimate',
    });

    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    expect(container.querySelector('input[placeholder="Tìm ưu tiên..."]')).toBeNull();
    expect(screen.getByPlaceholderText('Tìm ưu tiên...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Khẩn' }));
    expect(onRequestPriorityFilterChange).toHaveBeenCalledWith('4');

    await user.click(screen.getByRole('button', { name: 'Khách hàng' }));
    expect(container.querySelector('input[placeholder="Tìm khách hàng..."]')).toBeNull();
    expect(screen.getByPlaceholderText('Tìm khách hàng...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Tìm ưu tiên...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '21' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tìm khách hàng...'), 'VNPT-HCM-21');
    await user.click(screen.getByRole('button', { name: 'VNPT Hồ Chí Minh' }));
    expect(onRequestCustomerFilterChange).toHaveBeenCalledWith('21');

    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onListPageChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByLabelText('Số dòng trên mỗi trang'), {
      target: { value: '50' },
    });
    expect(onRowsPerPageChange).toHaveBeenCalledWith(50);

    await user.click(screen.getByText(/Thiếu ước lượng \(3\)/));
    expect(onToggleMissingEstimate).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        (_, element) => element?.textContent === '21 – 40 / 41 bản ghi'
      )
    ).toBeInTheDocument();
  });

  it('uses card layout and collapsible filters on mobile', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onPrimaryAction = vi.fn();

    render(
      <CustomerRequestListPane
        activeProcessCode=""
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
        onToggleMissingEstimate={vi.fn()}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 3, over_estimate: 2, sla_risk: 1 }}
        isDashboardLoading={false}
        rows={[makeRequest()]}
        isListLoading={false}
        selectedRequestId={null}
        onSelectRow={vi.fn()}
        onPrimaryAction={onPrimaryAction}
        listPage={1}
        rowsPerPage={20}
        listMeta={{ ...defaultMeta, page: 1 }}
        onListPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
        hasListFilters={false}
        onClearFilters={vi.fn()}
        requestRoleFilter=""
        presentation="responsive"
      />
    );

    expect(screen.queryByText('Yêu cầu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Bộ lọc/i }));
    expect(screen.getByRole('button', { name: 'Ưu tiên' })).toBeInTheDocument();

    const actionButtons = screen.getAllByRole('button', { name: /Ra soat estimate/i });
    await user.click(actionButtons[actionButtons.length - 1] as HTMLElement);
    expect(onPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 22 }),
      expect.objectContaining({ kind: 'detail', label: 'Ra soat estimate' })
    );
  });
});
