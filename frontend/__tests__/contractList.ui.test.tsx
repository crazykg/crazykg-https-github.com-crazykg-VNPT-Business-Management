import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import type { Contract, Customer, PaginationMeta, Project } from '../types';

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

const paginationMeta: PaginationMeta = {
  ...DEFAULT_PAGINATION_META,
  page: 1,
  per_page: 20,
  total: 1,
  total_pages: 1,
};

describe('ContractList', () => {
  beforeEach(() => {
    fetchContractDetailMock.mockReset();
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
