import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  created_at: partial?.created_at ?? '2026-03-20 08:00:00',
  current_entered_at: partial?.current_entered_at ?? '2026-03-21 08:30:00',
  completed_at: partial?.completed_at ?? '2026-03-21 17:45:00',
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
  it('renders compact filters, request row and pagination callbacks', async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onSelectRow = vi.fn();
    const onPrimaryAction = vi.fn();
    const onListPageChange = vi.fn();
    const onRowsPerPageChange = vi.fn();
    const onRequestPriorityFilterChange = vi.fn();
    const onRequestCustomerFilterChange = vi.fn();
    const rows = [
      makeRequest({
        to_user_id_name: 'Phan Văn Rở',
        performer_name: 'Ngô Dev',
      }),
      makeRequest({
        id: 33,
        ma_yc: 'CRC-202603-0033',
        tieu_de: 'Theo dõi ca không có ngày',
        summary: 'Theo dõi ca không có ngày',
        current_entered_at: null,
        completed_at: null,
      }),
    ];

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
        requestCreatedFrom="2026-01-01"
        onRequestCreatedFromChange={vi.fn()}
        requestCreatedTo="2026-03-31"
        onRequestCreatedToChange={vi.fn()}
        customerOptions={[
          {
            value: '21',
            label: 'VNPT Hồ Chí Minh',
            searchText: 'VNPT Hồ Chí Minh VNPT-HCM-21 0301234567 21',
          },
        ]}
        supportServiceGroups={[]}
        requestMissingEstimateFilter={false}
        onToggleMissingEstimate={vi.fn()}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 3, over_estimate: 2, sla_risk: 1 }}
        isDashboardLoading={false}
        rows={rows}
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

    expect(screen.queryByText(/Thiếu ước lượng \(3\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vượt ước lượng \(2\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nguy cơ SLA \(1\)/)).not.toBeInTheDocument();
    expect(screen.getByText('Mã yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Tên yêu cầu')).toBeInTheDocument();
    expect(screen.queryByText('Phụ trách')).not.toBeInTheDocument();
    expect(screen.getByText('Người xử lý')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái XL')).toBeInTheDocument();
    expect(screen.queryByText('Ngày tạo')).not.toBeInTheDocument();
    expect(screen.queryByText('Giờ')).not.toBeInTheDocument();
    expect(screen.getByText('Ngày thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Ngày kết thúc')).toBeInTheDocument();
    expect(screen.queryByText('Cập nhật')).not.toBeInTheDocument();
    expect(screen.queryByText('CTA')).not.toBeInTheDocument();
    expect(screen.queryByText('Ưu tiên mở trước')).not.toBeInTheDocument();
    expect(screen.queryByText('Độ ưu tiên')).not.toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();
    expect(screen.queryByText('Người xử lý hiện tại')).not.toBeInTheDocument();
    expect(screen.queryByText('Ngày tạo yêu cầu')).not.toBeInTheDocument();
    expect(screen.queryByText('125% kế hoạch')).not.toBeInTheDocument();
    expect(screen.queryByText(/Hạn:/)).not.toBeInTheDocument();
    const requestRow = screen.getByText('CRC-202603-0022').closest('tr');
    expect(requestRow).not.toBeNull();
    expect(within(requestRow as HTMLTableRowElement).getByText('Phan Văn Rở')).toBeInTheDocument();
    expect(within(requestRow as HTMLTableRowElement).getAllByText(/Đang xử lý/i)).toHaveLength(1);
    expect(within(requestRow as HTMLTableRowElement).queryByText('20/03/2026 15:00')).not.toBeInTheDocument();
    expect(within(requestRow as HTMLTableRowElement).getByText('21/03/2026 15:30')).toBeInTheDocument();
    expect(within(requestRow as HTMLTableRowElement).getByText('22/03/2026 00:45')).toBeInTheDocument();
    const emptyDateRow = screen.getByText('CRC-202603-0033').closest('tr');
    expect(emptyDateRow).not.toBeNull();
    expect(within(emptyDateRow as HTMLTableRowElement).getAllByText('--')).toHaveLength(2);
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...').className).toContain('h-10');
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...').className).toContain('bg-[var(--ui-surface-subtle)]');
    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-03-31')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa lọc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bộ lọc/i }).className).toContain('h-10');
    expect(screen.getByDisplayValue('2026-01-01').closest('div.grid')?.className).toContain(
      'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
    );
    expect(
      screen.getByDisplayValue('2026-01-01').compareDocumentPosition(
        screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(screen.getByText('CRC-202603-0022'));
    expect(onSelectRow).toHaveBeenCalledTimes(1);

    expect(onPrimaryAction).not.toHaveBeenCalled();

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
        requestCreatedFrom="2026-01-01"
        onRequestCreatedFromChange={vi.fn()}
        requestCreatedTo="2026-03-31"
        onRequestCreatedToChange={vi.fn()}
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
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...').className).toContain('h-11');
    expect(screen.getByDisplayValue('2026-01-01').className).toContain('h-11');
    expect(screen.getByDisplayValue('2026-03-31').className).toContain('h-11');
    expect(
      screen.getByDisplayValue('2026-01-01').compareDocumentPosition(
        screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Bộ lọc/i }));
    expect(screen.getByRole('button', { name: 'Ưu tiên' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Ra soat estimate/i })).not.toBeInTheDocument();
    expect(onPrimaryAction).not.toHaveBeenCalled();
    expect(screen.queryByText('Phụ trách')).not.toBeInTheDocument();
    expect(screen.queryByText('Cập nhật')).not.toBeInTheDocument();
    expect(screen.queryByText('Người xử lý hiện tại')).not.toBeInTheDocument();
    expect(screen.queryByText('125% kế hoạch')).not.toBeInTheDocument();
    expect(screen.queryByText(/Hạn:/)).not.toBeInTheDocument();
    expect(screen.getByText('Giờ')).toBeInTheDocument();
    expect(screen.getByText('Ngày tạo')).toBeInTheDocument();
    expect(screen.getByText('Ngày thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Ngày kết thúc')).toBeInTheDocument();
    expect(screen.getByText('21/03/2026 15:30')).toBeInTheDocument();
    expect(screen.getByText('22/03/2026 00:45')).toBeInTheDocument();
  });

  it('keeps desktop loading and empty states aligned with the reduced table column count', () => {
    setViewportWidth(1440);

    const { rerender } = render(
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
        requestCreatedFrom="2026-01-01"
        onRequestCreatedFromChange={vi.fn()}
        requestCreatedTo="2026-03-31"
        onRequestCreatedToChange={vi.fn()}
        customerOptions={[]}
        supportServiceGroups={[]}
        requestMissingEstimateFilter={false}
        onToggleMissingEstimate={vi.fn()}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 0, over_estimate: 0, sla_risk: 0 }}
        isDashboardLoading={false}
        rows={[]}
        isListLoading
        selectedRequestId={null}
        onSelectRow={vi.fn()}
        onPrimaryAction={vi.fn()}
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

    expect(screen.getByText('Đang tải danh sách yêu cầu...').closest('td')).toHaveAttribute('colspan', '7');

    rerender(
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
        requestCreatedFrom="2026-01-01"
        onRequestCreatedFromChange={vi.fn()}
        requestCreatedTo="2026-03-31"
        onRequestCreatedToChange={vi.fn()}
        customerOptions={[]}
        supportServiceGroups={[]}
        requestMissingEstimateFilter={false}
        onToggleMissingEstimate={vi.fn()}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 0, over_estimate: 0, sla_risk: 0 }}
        isDashboardLoading={false}
        rows={[]}
        isListLoading={false}
        selectedRequestId={null}
        onSelectRow={vi.fn()}
        onPrimaryAction={vi.fn()}
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

    expect(screen.getByText('Không có yêu cầu nào phù hợp với bộ lọc hiện tại.').closest('td')).toHaveAttribute('colspan', '7');
  });

  it('can hide the internal filter toolbar when a shared hub filter bar is used', () => {
    setViewportWidth(1440);

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
        requestCreatedFrom="2026-01-01"
        onRequestCreatedFromChange={vi.fn()}
        requestCreatedTo="2026-03-31"
        onRequestCreatedToChange={vi.fn()}
        customerOptions={[]}
        supportServiceGroups={[]}
        requestMissingEstimateFilter={false}
        onToggleMissingEstimate={vi.fn()}
        requestOverEstimateFilter={false}
        onToggleOverEstimate={vi.fn()}
        requestSlaRiskFilter={false}
        onToggleSlaRisk={vi.fn()}
        alertCounts={{ missing_estimate: 0, over_estimate: 0, sla_risk: 0 }}
        isDashboardLoading={false}
        rows={[makeRequest()]}
        isListLoading={false}
        selectedRequestId={null}
        onSelectRow={vi.fn()}
        onPrimaryAction={vi.fn()}
        listPage={1}
        rowsPerPage={20}
        listMeta={{ ...defaultMeta, page: 1 }}
        onListPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
        hasListFilters={false}
        onClearFilters={vi.fn()}
        requestRoleFilter=""
        presentation="responsive"
        showFilterToolbar={false}
      />
    );

    expect(screen.queryByPlaceholderText('Tìm mã YC, tên yêu cầu...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bộ lọc/i })).not.toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();
  });
});
