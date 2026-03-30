import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContractModal } from '../components/ContractModal';
import type {
  Business,
  Contract,
  Customer,
  PaymentSchedule,
  Product,
  Project,
  ProjectItemMaster,
  ProjectTypeOption,
} from '../types';

const customers: Customer[] = [
  {
    id: 1,
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Bệnh viện A',
    tax_code: '0101',
    address: 'Cần Thơ',
  },
  {
    id: 2,
    uuid: 'customer-2',
    customer_code: 'KH002',
    customer_name: 'Trung tâm Y tế B',
    tax_code: '0202',
    address: 'Hậu Giang',
  },
];

const projectTypes: ProjectTypeOption[] = [
  { id: 1, type_code: 'DAU_TU', type_name: 'Đầu tư' },
  { id: 2, type_code: 'THUE_DICH_VU_DACTHU', type_name: 'Thuê dịch vụ CNTT đặc thù' },
  { id: 3, type_code: 'THUE_DICH_VU_COSAN', type_name: 'Thuê dịch vụ CNTT có sẵn' },
];

const projects: Project[] = [
  {
    id: 101,
    project_code: 'DA001',
    project_name: 'Triển khai HIS',
    customer_id: 1,
    status: 'CHUAN_BI_DAU_TU',
    investment_mode: 'DAU_TU',
  },
  {
    id: 102,
    project_code: 'DA002',
    project_name: 'Thuê dịch vụ EMR',
    customer_id: 2,
    status: 'CHUAN_BI_KH_THUE',
    investment_mode: 'THUE_DICH_VU_COSAN',
  },
];

const projectItems: ProjectItemMaster[] = [
  {
    id: 9001,
    project_id: 101,
    project_code: 'DA001',
    project_name: 'Triển khai HIS',
    customer_id: 1,
    customer_code: 'KH001',
    customer_name: 'Bệnh viện A',
    product_id: 501,
    product_code: 'SP001',
    product_name: 'Giải pháp HIS',
    quantity: 1,
    unit_price: 150000000,
  },
  {
    id: 9002,
    project_id: 102,
    project_code: 'DA002',
    project_name: 'Thuê dịch vụ EMR',
    customer_id: 2,
    customer_code: 'KH002',
    customer_name: 'Trung tâm Y tế B',
    product_id: 502,
    product_code: 'SP002',
    product_name: 'Dịch vụ EMR',
    quantity: 12,
    unit_price: 5000000,
  },
];

const businesses: Business[] = [
  { id: 1, domain_code: 'KD001', domain_name: 'Y tế số' },
];

const products: Product[] = [
  {
    id: 501,
    product_code: 'SP001',
    product_name: 'Giải pháp HIS',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 150000000,
    unit: 'Gói',
  },
  {
    id: 502,
    product_code: 'SP002',
    product_name: 'Dịch vụ EMR',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 5000000,
    unit: 'Tháng',
  },
];

const paymentSchedules: PaymentSchedule[] = [];

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 7001,
  contract_code: 'HD-001',
  contract_name: 'Hợp đồng mẫu',
  customer_id: 1,
  project_id: 101,
  project_type_code: null,
  value: 150000000,
  payment_cycle: 'ONCE',
  status: 'DRAFT',
  sign_date: '2026-03-01',
  effective_date: '2026-03-01',
  expiry_date: '2026-12-31',
  term_unit: 'DAY',
  term_value: 30,
  ...overrides,
});

const renderModal = (overrides: Partial<React.ComponentProps<typeof ContractModal>> = {}) => {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);

  render(
    <ContractModal
      type="ADD"
      data={null}
      prefill={null}
      projects={projects}
      projectTypes={projectTypes}
      businesses={businesses}
      products={products}
      projectItems={projectItems}
      customers={customers}
      paymentSchedules={paymentSchedules}
      onClose={vi.fn()}
      onSave={onSave}
      {...overrides}
    />
  );

  return {
    onSave,
  };
};

const toStartsWithMatcher = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

const selectSearchableOption = async (user: ReturnType<typeof userEvent.setup>, label: string, optionLabel: string) => {
  await user.click(screen.getByRole('button', { name: toStartsWithMatcher(label) }));
  await user.click(screen.getByRole('button', { name: optionLabel }));
};

describe('ContractModal contract source modes', () => {
  it('opens existing project-linked contracts in project mode', () => {
    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7002,
        project_id: 101,
        customer_id: 1,
        project_type_code: null,
      }),
    });

    expect(screen.getByRole('button', { name: toStartsWithMatcher('Dự án') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: toStartsWithMatcher('Khách hàng') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: toStartsWithMatcher('Loại dự án') })).not.toBeInTheDocument();
    expect(screen.getByText(/Dự án:/)).toBeInTheDocument();
    expect(screen.getAllByText(/DA001 - Triển khai HIS/).length).toBeGreaterThan(0);
  });

  it('opens contracts without project in initial mode', () => {
    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7003,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_COSAN',
        term_unit: 'MONTH',
        term_value: 12,
      }),
    });

    expect(screen.getByRole('button', { name: toStartsWithMatcher('Khách hàng') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: toStartsWithMatcher('Loại dự án') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: toStartsWithMatcher('Dự án') })).not.toBeInTheDocument();
    expect(screen.getByText(/Hợp đồng đầu kỳ không gắn dự án cụ thể/)).toBeInTheDocument();
  });

  it('submits initial contracts with customer and project type only', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-INITIAL-001');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng đầu kỳ');
    await selectSearchableOption(user, 'Khách hàng', 'KH001 - Bệnh viện A');
    await selectSearchableOption(user, 'Loại dự án', 'Thuê dịch vụ CNTT có sẵn');
    await user.type(screen.getByPlaceholderText('Ví dụ: 1.5'), '12');
    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      contract_code: 'HD-INITIAL-001',
      contract_name: 'Hợp đồng đầu kỳ',
      customer_id: '1',
      project_id: '',
      project_type_code: 'THUE_DICH_VU_COSAN',
      term_unit: 'MONTH',
      term_value: 12,
    }));
  });

  it('submits project-linked contracts with derived customer and cleared initial project type', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-PROJECT-001');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng theo dự án');
    await user.click(screen.getByRole('button', { name: 'Theo dự án' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: toStartsWithMatcher('Dự án') })).toBeInTheDocument();
    });
    await selectSearchableOption(user, 'Dự án', 'DA001 - Triển khai HIS');
    await user.type(screen.getByPlaceholderText('Ví dụ: 30'), '45');
    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      contract_code: 'HD-PROJECT-001',
      contract_name: 'Hợp đồng theo dự án',
      customer_id: 1,
      project_id: 101,
      project_type_code: null,
      value: 150000000,
      term_unit: 'DAY',
      term_value: 45,
    }));
  });

  it('renders payment generation shell and submits milestone schedules for investment contracts', async () => {
    const user = userEvent.setup();
    const onGenerateSchedules = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7004,
        project_id: 101,
        customer_id: 1,
        project_type_code: null,
      }),
      onGenerateSchedules,
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    expect(screen.getByText('Dòng tiền hợp đồng')).toBeInTheDocument();
    expect(screen.getByText('Cách phân bổ')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nhập từng đợt' }));
    await waitFor(() => {
      expect(screen.getByText('Editor các đợt thanh toán')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Thanh toán đợt 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Sinh kỳ thanh toán/i }));

    await waitFor(() => expect(onGenerateSchedules).toHaveBeenCalledTimes(1));
    expect(onGenerateSchedules).toHaveBeenCalledWith(7004, expect.objectContaining({
      allocation_mode: 'MILESTONE',
      advance_percentage: 15,
      retention_percentage: 5,
      installment_count: 3,
      installments: expect.arrayContaining([
        expect.objectContaining({ label: 'Thanh toán đợt 1' }),
      ]),
    }));
    expect(confirmSpy).toHaveBeenCalledWith('Chưa có hạng mục hợp đồng. Bạn có chắc muốn sinh kỳ thanh toán?');

    confirmSpy.mockRestore();
  });
});
