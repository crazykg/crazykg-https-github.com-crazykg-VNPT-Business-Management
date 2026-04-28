import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useAuthStore } from '../shared/stores/authStore';
import type { Contract, Customer, Department, PaginationMeta, Project } from '../types';

const fetchContractDetailMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api/contractApi', () => ({
  fetchContractDetail: fetchContractDetailMock,
}));

import { ContractList } from '../components/ContractList';

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 1,
  contract_code: '20260309 - 01 VNPT- CTO-NBY/HĐ.HMIS',
  contract_name: 'CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ KHÁM CHỮA BỆNH',
  customer_id: 10,
  project_id: 20,
  project_type_code: null,
  value: 18_000_000,
  payment_cycle: 'QUARTERLY',
  status: 'SIGNED',
  sign_date: '2026-03-09',
  effective_date: '2026-04-11',
  expiry_date: '2027-04-10',
  ...overrides,
});

const projects: Project[] = [
  {
    id: 20,
    project_code: 'HMIS-TH',
    project_name: 'DỰ ÁN CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ KHÁM CHỮA BỆNH',
  } as Project,
];

const customers: Customer[] = [
  {
    id: 10,
    customer_code: '93022',
    customer_name: 'Trạm Y tế Xã Tân Hòa',
  } as Customer,
];

const departments: Department[] = [
  {
    id: 10,
    dept_code: 'P10',
    dept_name: 'Phòng giải pháp 10',
  } as Department,
  {
    id: 20,
    dept_code: 'P20',
    dept_name: 'Phòng giải pháp 20',
  } as Department,
];

const paginationMeta: PaginationMeta = {
  ...DEFAULT_PAGINATION_META,
  page: 1,
  per_page: 20,
  total: 1,
  total_pages: 1,
  kpis: {
    sign_period_total_value: 125_000_000,
  },
};

describe('ContractList', () => {
  beforeEach(() => {
    fetchContractDetailMock.mockReset();
    useAuthStore.setState({
      user: null,
      isAuthLoading: false,
      isLoginLoading: false,
      passwordChangeRequired: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders long contract and project names without hard truncate wrappers', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    const contractCell = screen.getByTestId('contract-name-cell-1');
    const projectCell = screen.getByTestId('contract-project-cell-1');

    expect(contractCell).toHaveTextContent('CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ KHÁM CHỮA BỆNH');
    expect(contractCell.className).toContain('whitespace-normal');
    expect(contractCell.className).toContain('break-words');
    expect(contractCell.className).not.toContain('truncate');

    expect(projectCell).toHaveTextContent('HMIS-TH - DỰ ÁN CUNG CẤP DỊCH VỤ PHẦN MỀM QUẢN LÝ KHÁM CHỮA BỆNH');
    expect(projectCell.className).toContain('whitespace-normal');
    expect(projectCell.className).toContain('break-words');
    expect(projectCell.className).not.toContain('truncate');
  });

  it('shows full currency values and hides the project column in project master layout', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
        fixedSourceMode="PROJECT"
      />
    );

    expect(screen.queryByRole('columnheader', { name: /Dự án/i })).not.toBeInTheDocument();

    const valueCell = screen.getByTestId('contract-value-cell-1');
    expect(valueCell).toHaveTextContent('18.000.000');
    expect(valueCell).not.toHaveTextContent(/18\s*tr/i);
    expect(valueCell.closest('td')).toHaveClass('align-middle');
    expect(screen.getByText('93022 - Trạm Y tế Xã Tân Hòa').closest('td')).toHaveClass('align-middle');
  });

  it('labels contracts without parent links as standalone instead of HĐ gốc', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.getByText('HĐ độc lập')).toBeInTheDocument();
    expect(screen.queryByText('HĐ gốc')).not.toBeInTheDocument();
    expect(screen.getByText('Hợp đồng độc lập')).toBeInTheDocument();
  });

  it('renders a compact management summary and grouped table headers for dense contract browsing', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('contract-management-summary')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Hợp đồng/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Khách hàng \/ dự án/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Thời hạn/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Tên hợp đồng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Hiệu lực/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Hết hạn/i })).not.toBeInTheDocument();
    expect(screen.getByText('1 hợp đồng')).toBeInTheDocument();
    expect(screen.queryByText('1 bản ghi')).not.toBeInTheDocument();
    expect(screen.getByText(/Tổng giá trị trong kỳ/i)).toBeInTheDocument();
    expect(screen.getByTestId('contract-period-total-value')).toHaveTextContent('125.000.000 đ');
    expect(screen.queryByText(/Chọn dòng để mở tác vụ nhanh/i)).not.toBeInTheDocument();
  });

  it('hydrates the custom date preset with the current month range by default', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T08:00:00.000Z'));

    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));

    expect(screen.getByLabelText('Ngày ký từ')).toHaveValue('2026-04-01');
    expect(screen.getByLabelText('Ngày ký đến')).toHaveValue('2026-04-30');
  });

  it('defaults the signer department filter to the current user department and sends it in server queries', async () => {
    const onQueryChange = vi.fn();

    useAuthStore.setState({
      user: {
        id: 1,
        username: 'tester',
        full_name: 'Tester',
        email: 'tester@example.com',
        status: 'ACTIVE',
        department_id: 20,
        roles: [],
        permissions: [],
        dept_scopes: [],
      },
      isAuthLoading: false,
      isLoginLoading: false,
      passwordChangeRequired: false,
    });

    render(
      <ContractList
        contracts={[buildContract({ id: 2, dept_id: 20 })]}
        contractsPageRows={[buildContract({ id: 2, dept_id: 20 })]}
        paginationMeta={paginationMeta}
        isLoading={false}
        departments={departments}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Đơn vị ký hợp đồng' })).toHaveTextContent('Phòng giải pháp 20');
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          dept_id: '20',
        }),
      }));
    });
  });

  it('keeps the contracts filter toolbar dense without a stacked department label', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        departments={departments}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('contract-filter-toolbar').className).toContain('lg:grid-cols-[');
    expect(screen.getByRole('button', { name: 'Đơn vị ký hợp đồng' })).toHaveTextContent('Tất cả đơn vị ký');
    expect(screen.queryByText('Đơn vị ký hợp đồng')).not.toBeInTheDocument();
  });

  it('does not render a duplicate standalone period badge above the summary strip', () => {
    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        departments={departments}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.getByText('Kỳ: Năm 2026')).toBeInTheDocument();
    expect(screen.queryByText(/^Năm 2026$/)).not.toBeInTheDocument();
  });

  it('opens the detail drawer from the row context menu and loads full contract detail', async () => {
    const user = userEvent.setup();
    fetchContractDetailMock.mockResolvedValue({
      ...buildContract({
        contract_number: 'HĐ-001/2026',
        signer_full_name: 'Trần Thanh Duy',
        signer_user_code: 'CTV062802',
        dept_code: 'PGP2',
        dept_name: 'Phòng giải Pháp 2',
        items: [
          {
            id: 'item-1',
            contract_id: 1,
            product_id: 101,
            product_name: 'Hệ thống thông tin quản lý y tế',
            unit: 'Gói',
            quantity: 12,
            unit_price: 1_500_000,
          },
        ],
      }),
    });

    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
        fixedSourceMode="PROJECT"
      />
    );

    fireEvent.contextMenu(screen.getByTestId('contract-row-1'));

    const contextMenu = await screen.findByTestId('contract-row-context-menu');
    await user.click(within(contextMenu).getByRole('button', { name: /Xem chi tiết tất cả thông tin/i }));

    await waitFor(() => expect(fetchContractDetailMock).toHaveBeenCalledWith(1));

    const drawer = await screen.findByTestId('contract-detail-drawer');
    expect(drawer.className).toContain('max-w-[840px]');
    expect(within(drawer).getByText(/Mã hợp đồng:/i)).toBeInTheDocument();
    expect(within(drawer).queryByText(/Số hợp đồng:/i)).not.toBeInTheDocument();
    expect(within(drawer).getByText('CTV062802 - Trần Thanh Duy')).toBeInTheDocument();
    expect(within(drawer).getByText('PGP2 - Phòng giải Pháp 2')).toBeInTheDocument();
    expect(within(drawer).getByText('Hệ thống thông tin quản lý y tế')).toBeInTheDocument();
    expect(within(drawer).getAllByText('18.000.000 đ').length).toBeGreaterThan(0);
  });

  it('refreshes the large detail drawer even when a stale cached detail already exists', async () => {
    const user = userEvent.setup();
    fetchContractDetailMock
      .mockResolvedValueOnce({
        ...buildContract({
          contract_number: 'HĐ-001/2026',
          items: [],
        }),
      })
      .mockResolvedValueOnce({
        ...buildContract({
          contract_number: 'HĐ-001/2026',
          items: [
            {
              id: 'item-1',
              contract_id: 1,
              product_id: 101,
              product_name: 'Hệ thống thông tin quản lý y tế',
              unit: 'Gói',
              quantity: 12,
              unit_price: 1_500_000,
            },
          ],
        }),
      });

    render(
      <ContractList
        contractsPageRows={[buildContract()]}
        paginationMeta={paginationMeta}
        isLoading={false}
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        onQueryChange={vi.fn()}
        fixedSourceMode="PROJECT"
      />
    );

    fireEvent.contextMenu(screen.getByTestId('contract-row-1'));
    let contextMenu = await screen.findByTestId('contract-row-context-menu');
    await user.click(within(contextMenu).getByRole('button', { name: /Xem chi tiết tất cả thông tin/i }));

    await waitFor(() => expect(fetchContractDetailMock).toHaveBeenCalledTimes(1));
    const firstDrawer = await screen.findByTestId('contract-detail-drawer');
    expect(within(firstDrawer).getByText(/Hợp đồng này chưa có hạng mục chi tiết để hiển thị/i)).toBeInTheDocument();

    await user.click(within(firstDrawer).getByRole('button', { name: /Đóng chi tiết hợp đồng/i }));
    await waitFor(() => expect(screen.queryByTestId('contract-detail-drawer')).not.toBeInTheDocument());

    fireEvent.contextMenu(screen.getByTestId('contract-row-1'));
    contextMenu = await screen.findByTestId('contract-row-context-menu');
    await user.click(within(contextMenu).getByRole('button', { name: /Xem chi tiết tất cả thông tin/i }));

    await waitFor(() => expect(fetchContractDetailMock).toHaveBeenCalledTimes(2));
    const secondDrawer = await screen.findByTestId('contract-detail-drawer');
    await waitFor(() => expect(within(secondDrawer).getByText('Hệ thống thông tin quản lý y tế')).toBeInTheDocument());
  });
});
