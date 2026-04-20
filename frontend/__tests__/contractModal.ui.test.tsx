import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractModal } from '../components/ContractModal';
import type {
  Business,
  Contract,
  Customer,
  PaymentSchedule,
  Product,
  ProductPackage,
  Project,
  ProjectItemMaster,
  ProjectTypeOption,
} from '../types';

const uploadDocumentAttachmentMock = vi.fn();
const deleteUploadedDocumentAttachmentMock = vi.fn();

vi.mock('../services/v5Api', () => ({
  uploadDocumentAttachment: (...args: unknown[]) => uploadDocumentAttachmentMock(...args),
  deleteUploadedDocumentAttachment: (...args: unknown[]) => deleteUploadedDocumentAttachmentMock(...args),
}));

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
    product_package_id: 601,
    product_code: 'PKG001-A',
    product_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm phụ',
    unit: 'Trạm Y tế, PKĐK/ Tháng',
    quantity: 12,
    unit_price: 600000,
  },
  {
    id: 9002,
    project_id: 101,
    project_code: 'DA001',
    project_name: 'Triển khai HIS',
    customer_id: 1,
    customer_code: 'KH001',
    customer_name: 'Bệnh viện A',
    product_id: 501,
    product_package_id: 602,
    product_code: 'PKG001-B',
    product_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm chính',
    unit: 'Trạm Y tế, PKĐK/ Tháng',
    quantity: 12,
    unit_price: 900000,
  },
  {
    id: 9003,
    project_id: 102,
    project_code: 'DA002',
    project_name: 'Thuê dịch vụ EMR',
    customer_id: 2,
    customer_code: 'KH002',
    customer_name: 'Trung tâm Y tế B',
    product_id: 502,
    product_package_id: 603,
    product_code: 'PKG002-A',
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
    product_name: 'Hệ thống thông tin quản lý y tế',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 150000000,
    unit: 'Trạm Y tế, PKĐK/ Tháng',
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

const productPackages: ProductPackage[] = [
  {
    id: 601,
    product_id: 501,
    package_code: 'PKG001-A',
    package_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm phụ',
    product_name: 'Hệ thống thông tin quản lý y tế',
    parent_product_code: 'SP001',
    standard_price: 600000,
    unit: 'Trạm Y tế, PKĐK/ Tháng',
  },
  {
    id: 602,
    product_id: 501,
    package_code: 'PKG001-B',
    package_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm chính',
    product_name: 'Hệ thống thông tin quản lý y tế',
    parent_product_code: 'SP001',
    standard_price: 900000,
    unit: 'Trạm Y tế, PKĐK/ Tháng',
  },
  {
    id: 603,
    product_id: 502,
    package_code: 'PKG002-A',
    package_name: 'Dịch vụ EMR',
    product_name: 'Dịch vụ EMR',
    parent_product_code: 'SP002',
    standard_price: 5000000,
    unit: 'Tháng',
  },
];

const paymentSchedules: PaymentSchedule[] = [];
const fetchMock = vi.fn();
const signerOptions = [
  {
    id: 1,
    user_code: 'U001',
    full_name: 'Tester',
    department_id: 10,
    dept_code: 'P10',
    dept_name: 'Phong giai phap 10',
  },
  {
    id: 2,
    user_code: 'U002',
    full_name: 'Approver 20',
    department_id: 20,
    dept_code: 'P20',
    dept_name: 'Phong giai phap 20',
  },
];

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
      productPackages={productPackages}
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
  await waitFor(() => {
    expect(screen.getByRole('button', { name: toStartsWithMatcher(label) })).toHaveTextContent(optionLabel);
  });
};

describe('ContractModal contract source modes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    fetchMock.mockReset();
    uploadDocumentAttachmentMock.mockReset();
    deleteUploadedDocumentAttachmentMock.mockReset();
    uploadDocumentAttachmentMock.mockResolvedValue({
      id: 'ATT-001',
      fileName: 'hop-dong.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      fileUrl: 'https://files.local/hop-dong.pdf',
      driveFileId: '',
      createdAt: '2026-04-11T08:00:00Z',
      storageProvider: 'LOCAL',
      storagePath: '/contracts/hop-dong.pdf',
      storageDisk: 'local',
      storageVisibility: 'private',
      warningMessage: null,
    });
    deleteUploadedDocumentAttachmentMock.mockResolvedValue(undefined);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes('/api/v5/contracts/signer-options')) {
        return new Response(JSON.stringify({ data: signerOptions }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('fetches signer options and rehydrates existing signer selection', async () => {
    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7005,
        signer_user_id: 2,
        signer_user_code: 'U002',
        signer_full_name: 'Approver 20',
        dept_id: 20,
        dept_code: 'P20',
        dept_name: 'Phong giai phap 20',
      }),
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: toStartsWithMatcher('Người ký hợp đồng') })).toBeInTheDocument();
    });

    expect(screen.queryByText(/Phòng ban ownership sẽ lưu cho hợp đồng:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/P20 - Phong giai phap 20/)).not.toBeInTheDocument();
  });

  it('temporarily locks schedule-sensitive fields while payment schedules are still loading', async () => {
    renderModal({
      type: 'EDIT',
      isPaymentLoading: true,
      data: buildContract({
        id: 7006,
        payment_cycle: 'MONTHLY',
      }),
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByRole('button', { name: toStartsWithMatcher('Chu kỳ thanh toán') })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeDisabled();
    expect(screen.getByText('Đang kiểm tra lịch thu tiền của hợp đồng. Vui lòng chờ trong giây lát trước khi cập nhật.')).toBeInTheDocument();
  });

  it('keeps non schedule fields editable while generated payment schedules lock the schedule source', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderModal({
      type: 'EDIT',
      onSave,
      data: buildContract({
        id: 7007,
        payment_cycle: 'MONTHLY',
        payment_schedule_count: 12,
        has_generated_payment_schedules: true,
        can_edit_schedule_source_fields: false,
        can_delete_unpaid_schedules: true,
        status: 'DRAFT',
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: toStartsWithMatcher('Chu kỳ thanh toán') })).toBeDisabled();
    expect(screen.getByText('Hợp đồng đã có 12 kỳ thanh toán. Muốn đổi chu kỳ, giá trị hoặc thời hạn, hãy xóa toàn bộ kỳ chưa thu tiền trong tab Dòng tiền trước.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: toStartsWithMatcher('Trạng thái') })).toBeEnabled();

    await selectSearchableOption(user, 'Trạng thái', 'Đã ký');
    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as Partial<Contract>;
    expect(payload.status).toBe('SIGNED');
    expect(Object.prototype.hasOwnProperty.call(payload, 'payment_cycle')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'value')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'items')).toBe(false);
  });

  it('shows read only fallback contract items from the linked project when the contract snapshot is empty', async () => {
    renderModal({
      type: 'EDIT',
      businesses: [
        { id: 1, domain_code: 'KD001_PM', domain_name: 'Y tế số' },
      ],
      data: buildContract({
        id: 7008,
        project_id: 101,
        value: 18000000,
        items: [],
        payment_schedule_count: 12,
        has_generated_payment_schedules: true,
        can_edit_schedule_source_fields: false,
        can_delete_unpaid_schedules: true,
      }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByText(/Hạng mục hợp đồng \(2 hạng mục\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống đang hiển thị tạm từ hạng mục dự án liên kết để bạn đối chiếu\./i)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Thuê Hệ thống thông tin quản lý y tế Trạm phụ/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Thuê Hệ thống thông tin quản lý y tế Trạm chính/i })).toBeInTheDocument();
    expect(screen.getAllByText('10%')).toHaveLength(2);
    expect(screen.getByText('720.000 đ')).toBeInTheDocument();
    expect(screen.getByText('1.080.000 đ')).toBeInTheDocument();
    expect(screen.getByText('1.800.000 đ')).toBeInTheDocument();
    expect(screen.getByText('19.800.000 đ')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có hạng mục hợp đồng.')).not.toBeInTheDocument();
  });

  it('keeps the current signer visible when the edit contract points to an inactive signer outside the active allowlist', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes('/api/v5/contracts/signer-options')) {
        return new Response(JSON.stringify({ data: [signerOptions[0]] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7006,
        signer_user_id: 2,
        signer_user_code: 'U002',
        signer_full_name: 'Approver 20',
        dept_id: 20,
        dept_code: 'P20',
        dept_name: 'Phong giai phap 20',
      }),
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: toStartsWithMatcher('Người ký hợp đồng') })).toHaveTextContent(
        'U002 - Approver 20'
      );
    });

    expect(screen.queryByText(/Phòng ban ownership sẽ lưu cho hợp đồng:/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: toStartsWithMatcher('Người ký hợp đồng') }));
    expect(screen.getByRole('button', { name: 'U001 - Tester' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'U002 - Approver 20' })).not.toBeInTheDocument();
  });

  it('hides helper copy in the edit modal contract tab', async () => {
    renderModal({
      type: 'EDIT',
      data: buildContract({
        id: 7007,
        project_id: 101,
        customer_id: 1,
        signer_user_id: 2,
        signer_user_code: 'U002',
        signer_full_name: 'Approver 20',
        dept_id: 20,
        dept_code: 'P20',
        dept_name: 'Phong giai phap 20',
      }),
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Cập nhật hợp đồng' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Nguồn hợp đồng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chế độ cố định:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chỉ để tham chiếu read-only từ dự án liên kết/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Snapshot thương mại riêng của hợp đồng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phòng ban ownership sẽ lưu cho hợp đồng:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mốc tính hạn:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đính kèm bản PDF hợp đồng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0 file$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chỉ nhận file PDF cho hợp đồng đầu kỳ hoặc hợp đồng theo dự án/)).not.toBeInTheDocument();
  });

  it('submits edited contracts after changing the payment cycle', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      onSave,
      data: buildContract({
        id: 7010,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_COSAN',
        payment_cycle: 'ONCE',
        term_unit: 'MONTH',
        term_value: 12,
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await selectSearchableOption(user, 'Chu kỳ thanh toán', 'Hàng quý');
    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      payment_cycle: 'QUARTERLY',
      signer_user_id: 1,
      customer_id: 2,
      project_id: null,
      project_type_code: 'THUE_DICH_VU_COSAN',
    }));
  });

  it('shows the save error inline when edit update fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Không thể cập nhật hợp đồng lúc này.'));

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      onSave,
      data: buildContract({
        id: 7011,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_COSAN',
        payment_cycle: 'ONCE',
        term_unit: 'MONTH',
        term_value: 12,
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Không thể cập nhật hợp đồng lúc này.')).toBeInTheDocument();
  });

  it('submits initial contracts with customer and project type only', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-INITIAL-001');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng đầu kỳ');
    await selectSearchableOption(user, 'Người ký hợp đồng', 'U001 - Tester');
    await selectSearchableOption(user, 'Khách hàng', 'KH001 - Bệnh viện A');
    await selectSearchableOption(user, 'Loại dự án', 'Thuê dịch vụ CNTT có sẵn');
    await user.type(screen.getByPlaceholderText('Ví dụ: 1.5'), '12');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput as HTMLInputElement, new File(['pdf'], 'hop-dong.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(uploadDocumentAttachmentMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('hop-dong.pdf').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      contract_code: 'HD-INITIAL-001',
      contract_name: 'Hợp đồng đầu kỳ',
      signer_user_id: '1',
      customer_id: '1',
      project_id: null,
      project_type_code: 'THUE_DICH_VU_COSAN',
      term_unit: 'MONTH',
      term_value: 12,
      attachments: [
        expect.objectContaining({
          id: 'ATT-001',
          fileName: 'hop-dong.pdf',
          mimeType: 'application/pdf',
        }),
      ],
    }));
  });

  it('hydrates stored contract attachments when opening the edit modal', async () => {
    renderModal({
      type: 'EDIT',
      data: buildContract({
        attachments: [
          {
            id: 'ATT-EXISTING-1',
            fileName: 'hop-dong-da-ky.pdf',
            mimeType: 'application/pdf',
            fileSize: 4096,
            fileUrl: 'https://files.local/hop-dong-da-ky.pdf',
            driveFileId: '',
            createdAt: '2026-04-11T08:00:00Z',
            storageProvider: 'LOCAL',
            storagePath: '/contracts/hop-dong-da-ky.pdf',
            storageDisk: 'local',
            storageVisibility: 'private',
          },
        ],
      }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByText('Tệp hợp đồng')).toBeInTheDocument();
    expect(screen.getAllByText('hop-dong-da-ky.pdf').length).toBeGreaterThan(0);
  });

  it('rejects non-pdf contract attachments before upload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderModal({ fixedSourceMode: 'INITIAL' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    await user.upload(
      fileInput as HTMLInputElement,
      new File(['docx'], 'hop-dong.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );

    expect(uploadDocumentAttachmentMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Chỉ cho phép tải lên file PDF cho hợp đồng/i)).toBeInTheDocument();
  });

  it('deletes uploaded contract attachments through the existing upload cleanup api', async () => {
    const user = userEvent.setup();
    renderModal({ fixedSourceMode: 'INITIAL' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    await user.upload(fileInput as HTMLInputElement, new File(['pdf'], 'hop-dong.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(uploadDocumentAttachmentMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('hop-dong.pdf').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Xóa/i }));

    await waitFor(() => expect(deleteUploadedDocumentAttachmentMock).toHaveBeenCalledTimes(1));
    expect(deleteUploadedDocumentAttachmentMock).toHaveBeenCalledWith(expect.objectContaining({
      attachmentId: null,
      fileUrl: 'https://files.local/hop-dong.pdf',
      storagePath: '/contracts/hop-dong.pdf',
      storageDisk: 'local',
    }));
    expect(screen.queryByText('hop-dong.pdf')).not.toBeInTheDocument();
    expect(screen.getByText(/Đã gỡ file hợp đồng khỏi biểu mẫu/i)).toBeInTheDocument();
  });

  it('locks the add modal to project source when opened from the project contract menu', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ fixedSourceMode: 'PROJECT' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Thêm mới hợp đồng' })).toBeInTheDocument();
    expect(screen.queryByText('Nguồn hợp đồng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chế độ cố định:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo dự án' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đầu kỳ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: toStartsWithMatcher('Dự án') })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-PROJECT-LOCKED');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng theo dự án khóa nguồn');
    await selectSearchableOption(user, 'Người ký hợp đồng', 'U001 - Tester');
    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng chọn dự án.')).toBeInTheDocument();
  });

  it('hides helper copy in the add modal contract tab', async () => {
    renderModal();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Thêm mới hợp đồng' })).toBeInTheDocument();
    expect(screen.queryByText('Nguồn hợp đồng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chế độ cố định:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theo dự án' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đầu kỳ' })).toBeInTheDocument();
    expect(screen.queryByText(/Chỉ để tham chiếu read-only từ dự án liên kết/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Snapshot thương mại riêng của hợp đồng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phòng ban ownership sẽ lưu cho hợp đồng:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mốc tính hạn:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đính kèm bản PDF hợp đồng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0 file$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chỉ nhận file PDF cho hợp đồng đầu kỳ hoặc hợp đồng theo dự án/)).not.toBeInTheDocument();
  });

  it('uses linked project items for manual contract items and hydrates unit from the selected project item package', async () => {
    const user = userEvent.setup();

    renderModal({
      type: 'ADD',
      fixedSourceMode: 'PROJECT',
      prefill: {
        project_id: 101,
        customer_id: 1,
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByText('Thêm hạng mục')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Thêm hạng mục'));
    await user.click(screen.getByRole('button', { name: 'Chọn sản phẩm/DV' }));
    expect(screen.getByText('PKG001-A - Thuê Hệ thống thông tin quản lý y tế Trạm phụ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PKG001-B - Thuê Hệ thống thông tin quản lý y tế Trạm chính' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dịch vụ EMR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sản phẩm #/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'PKG001-A - Thuê Hệ thống thông tin quản lý y tế Trạm phụ' }));

    expect(screen.getByText('PKG001-A - Thuê Hệ thống thông tin quản lý y tế Trạm phụ')).toBeInTheDocument();
    expect(screen.getByText('Trạm Y tế, PKĐK/ Tháng')).toBeInTheDocument();
    expect(screen.getByDisplayValue('600.000')).toBeInTheDocument();
  });

  it('locks the add modal to initial source when opened from the initial contract menu', async () => {
    renderModal({ fixedSourceMode: 'INITIAL' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Thêm mới hợp đồng đầu kỳ' })).toBeInTheDocument();
    expect(screen.queryByText('Kiểm soát nguồn hợp đồng, giá trị thương mại và lịch thanh toán trên cùng một modal.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguồn hợp đồng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chế độ cố định:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo dự án' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đầu kỳ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: toStartsWithMatcher('Khách hàng') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: toStartsWithMatcher('Dự án') })).not.toBeInTheDocument();
  });

  it('submits project-linked contracts with derived customer and cleared initial project type', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-PROJECT-001');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng theo dự án');
    await selectSearchableOption(user, 'Người ký hợp đồng', 'U001 - Tester');
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
      signer_user_id: '1',
      customer_id: 1,
      project_id: 101,
      project_type_code: null,
      value: 18000000,
      term_unit: 'DAY',
      term_value: 45,
    }));
  });

  it('imports project items into contract draft items from the linked project', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ fixedSourceMode: 'PROJECT' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-IMPORT-001');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng lấy hạng mục dự án');
    await selectSearchableOption(user, 'Người ký hợp đồng', 'U001 - Tester');
    await selectSearchableOption(user, 'Dự án', 'DA001 - Triển khai HIS');

    const importButton = screen.getByRole('button', { name: /Lấy hạng mục từ dự án/i });
    expect(importButton).toBeEnabled();

    await user.click(importButton);

    expect(screen.getByRole('row', { name: /Thuê Hệ thống thông tin quản lý y tế Trạm phụ/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Thuê Hệ thống thông tin quản lý y tế Trạm chính/i })).toBeInTheDocument();
    expect(screen.getByText(/Hạng mục hợp đồng \(2 hạng mục\)/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Ví dụ: 30'), '30');

    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      contract_code: 'HD-IMPORT-001',
      contract_name: 'Hợp đồng lấy hạng mục dự án',
      project_id: 101,
      items: [
        expect.objectContaining({
          product_id: 501,
          product_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm phụ',
          unit: 'Trạm Y tế, PKĐK/ Tháng',
          quantity: 12,
          unit_price: 600000,
        }),
        expect.objectContaining({
          product_id: 501,
          product_name: 'Thuê Hệ thống thông tin quản lý y tế Trạm chính',
          unit: 'Trạm Y tế, PKĐK/ Tháng',
          quantity: 12,
          unit_price: 900000,
        }),
      ],
    }));
  });

  it('blocks save when signer is missing', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('HD-2026-001'), 'HD-NO-SIGNER');
    await user.type(screen.getByPlaceholderText('Hợp đồng triển khai giải pháp...'), 'Hợp đồng thiếu signer');
    await selectSearchableOption(user, 'Khách hàng', 'KH001 - Bệnh viện A');
    await selectSearchableOption(user, 'Loại dự án', 'Thuê dịch vụ CNTT có sẵn');
    await user.click(screen.getByRole('button', { name: /Lưu/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Vui lòng chọn người ký hợp đồng.')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Sinh kỳ thanh toán' }));

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

  it('shows an inline generate action inside the empty payment schedule state', async () => {
    const user = userEvent.setup();
    const onGenerateSchedules = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      onGenerateSchedules,
      data: buildContract({
        id: 7012,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_COSAN',
        payment_cycle: 'MONTHLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    expect(screen.getByText(/Hãy sinh kỳ thanh toán để đồng bộ/i)).toBeInTheDocument();
    expect(screen.getByText('Chưa có kỳ thanh toán nào cho hợp đồng này.')).toBeInTheDocument();

    const emptyStateRow = screen.getByRole('row', { name: /Chưa có kỳ thanh toán nào cho hợp đồng này\./i });
    await user.click(within(emptyStateRow).getByRole('button', { name: /Sinh kỳ thanh toán ngay/i }));

    await waitFor(() => expect(onGenerateSchedules).toHaveBeenCalledTimes(1));
    expect(onGenerateSchedules).toHaveBeenCalledWith(7012, expect.objectContaining({
      allocation_mode: 'EVEN',
    }));

    confirmSpy.mockRestore();
  });

  it('shows draft payment rows for even quarterly service contracts before schedules are regenerated', async () => {
    const user = userEvent.setup();

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      data: buildContract({
        id: 7014,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        sign_date: '2026-04-11',
        effective_date: '2026-04-11',
        expiry_date: '2027-01-11',
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
      paymentSchedules: [
        {
          id: 9201,
          contract_id: 7014,
          milestone_name: 'Phí dịch vụ kỳ 1 (quý)',
          cycle_number: 1,
          expected_date: '2026-04-11',
          expected_amount: 4500000,
          actual_paid_amount: 0,
          status: 'PENDING',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    expect(screen.getByText('Dự thảo kỳ thanh toán')).toBeInTheDocument();
    expect(screen.queryByText(/Lịch dưới đây là bản dự thảo theo chu kỳ Hàng quý/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đề xuất' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeInTheDocument();
    expect(screen.getByText(/Theo cấu hình hiện tại|Chưa chốt lại/)).toBeInTheDocument();

    const [previewTable, scheduleTable] = screen.getAllByRole('table');
    expect(within(previewTable).getByText('Kỳ đề xuất')).toBeInTheDocument();
    expect(within(previewTable).getByText('Phí dịch vụ kỳ 1 (quý)')).toBeInTheDocument();
    expect(within(previewTable).getByText('Phí dịch vụ kỳ 4 (quý)')).toBeInTheDocument();
    expect(within(previewTable).getAllByText('4.500.000 đ')).toHaveLength(4);
    expect(within(scheduleTable).getByText('Phí dịch vụ kỳ 1 (quý)')).toBeInTheDocument();
  });

  it('locks and collapses the even draft preview when the contract already has collected schedules', async () => {
    const user = userEvent.setup();

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      data: buildContract({
        id: 7020,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        sign_date: '2026-04-11',
        effective_date: '2026-04-11',
        expiry_date: '2027-01-11',
        signer_user_id: 1,
      }),
      paymentSchedules: [
        {
          id: 9301,
          contract_id: 7020,
          milestone_name: 'Phí dịch vụ kỳ 1 (quý)',
          cycle_number: 1,
          expected_date: '2026-04-11',
          expected_amount: 4500000,
          actual_paid_amount: 4500000,
          status: 'PAID',
        },
        {
          id: 9302,
          contract_id: 7020,
          milestone_name: 'Phí dịch vụ kỳ 2 (quý)',
          cycle_number: 2,
          expected_date: '2026-07-11',
          expected_amount: 4500000,
          actual_paid_amount: 0,
          status: 'PENDING',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    expect(screen.getByText('Dự thảo kỳ thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đã xác nhận thu tiền')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem tham chiếu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đề xuất' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lấy lại từ đề xuất/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm dòng/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Kỳ tham chiếu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sinh kỳ thanh toán' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Xem tham chiếu/i }));

    expect(screen.getByText('Kỳ tham chiếu')).toBeInTheDocument();
    expect(screen.getAllByText('Phí dịch vụ kỳ 1 (quý)')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Ẩn tham chiếu/i })).toBeInTheDocument();
  });

  it('renders the payment confirmation modal with formatted currency input and balanced upload action', async () => {
    const user = userEvent.setup();

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      data: buildContract({
        id: 7018,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        signer_user_id: 1,
        signer_user_code: 'U001',
        signer_full_name: 'Tester',
        dept_id: 10,
        dept_code: 'P10',
        dept_name: 'Phong giai phap 10',
      }),
      paymentSchedules: [
        {
          id: 9203,
          contract_id: 7018,
          milestone_name: 'Phí dịch vụ kỳ 3 (quý)',
          cycle_number: 3,
          expected_date: '2026-04-12',
          expected_amount: 4500000,
          actual_paid_amount: 0,
          status: 'PENDING',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    const [, scheduleTable] = screen.getAllByRole('table');
    const scheduleRow = within(scheduleTable).getByRole('row', { name: /Phí dịch vụ kỳ 3 \(quý\)/i });
    await user.click(within(scheduleRow).getByRole('button', { name: /Xác nhận thu tiền/i }));

    expect(screen.getByRole('heading', { name: 'Xác nhận thu tiền' })).toBeInTheDocument();
    expect(screen.queryByText('Ghi nhận thực thu, hồ sơ đính kèm và trạng thái kỳ thanh toán.')).not.toBeInTheDocument();
    expect(screen.queryByText('Trạng thái hiện tại')).not.toBeInTheDocument();
    expect(screen.queryByText('Hồ sơ đính kèm')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('4.500.000')).toBeInTheDocument();

    const uploadButton = screen.getByRole('button', { name: /Tải file nghiệm thu/i });
    const saveButton = screen.getByRole('button', { name: 'Lưu thu tiền' });
    expect(uploadButton.className).toBe(saveButton.className);
  });

  it('allows editing even draft rows and resetting them from the proposal tab', async () => {
    const user = userEvent.setup();

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      data: buildContract({
        id: 7015,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        sign_date: '2026-04-11',
        effective_date: '2026-04-11',
        expiry_date: '2027-01-11',
        signer_user_id: 1,
      }),
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));

    const firstLabelInput = screen.getByDisplayValue('Phí dịch vụ kỳ 1 (quý)');
    const firstDateInput = screen.getByDisplayValue('2026-04-11');
    const firstAmountInput = screen.getAllByDisplayValue('4.500.000')[0];

    await user.clear(firstLabelInput);
    await user.type(firstLabelInput, 'Kỳ khởi tạo');
    fireEvent.change(firstDateInput, { target: { value: '2026-04-15' } });
    await user.clear(firstAmountInput);
    await user.type(firstAmountInput, '4000000');

    expect(screen.getByText('Đã chỉnh tay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kỳ khởi tạo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4.000.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lấy lại từ đề xuất/i }));

    expect(screen.getByDisplayValue('Phí dịch vụ kỳ 1 (quý)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-11')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('4.500.000')[0]).toBeInTheDocument();
    expect(screen.getByText(/Theo cấu hình hiện tại|Chưa chốt lại/)).toBeInTheDocument();
  });

  it('submits custom even draft rows when generating schedules', async () => {
    const user = userEvent.setup();
    const onGenerateSchedules = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      onGenerateSchedules,
      data: buildContract({
        id: 7016,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        sign_date: '2026-04-11',
        effective_date: '2026-04-11',
        expiry_date: '2027-01-11',
        signer_user_id: 1,
      }),
      paymentSchedules: [
        {
          id: 9202,
          contract_id: 7016,
          milestone_name: 'Phí dịch vụ kỳ 1 (quý)',
          cycle_number: 1,
          expected_date: '2026-04-11',
          expected_amount: 4500000,
          actual_paid_amount: 0,
          status: 'PENDING',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));

    const labelInputs = screen.getAllByDisplayValue(/Phí dịch vụ kỳ \d \(quý\)/);
    const amountInputs = screen.getAllByDisplayValue('4.500.000');

    await user.clear(labelInputs[0]);
    await user.type(labelInputs[0], 'Kỳ mở đầu');
    await user.clear(amountInputs[0]);
    await user.type(amountInputs[0], '4000000');
    await user.clear(amountInputs[1]);
    await user.type(amountInputs[1], '5000000');

    await user.click(screen.getByRole('button', { name: 'Sinh kỳ thanh toán' }));

    await waitFor(() => expect(onGenerateSchedules).toHaveBeenCalledTimes(1));
    expect(onGenerateSchedules).toHaveBeenCalledWith(7016, expect.objectContaining({
      allocation_mode: 'EVEN',
      draft_installments: expect.arrayContaining([
        expect.objectContaining({
          label: 'Kỳ mở đầu',
          expected_date: '2026-04-11',
          expected_amount: 4000000,
        }),
        expect.objectContaining({
          label: 'Phí dịch vụ kỳ 2 (quý)',
          expected_date: '2026-07-11',
          expected_amount: 5000000,
        }),
      ]),
    }));

    confirmSpy.mockRestore();
  });

  it('blocks schedule generation when the editable even draft total does not match the contract value', async () => {
    const user = userEvent.setup();
    const onGenerateSchedules = vi.fn().mockResolvedValue(undefined);

    renderModal({
      type: 'EDIT',
      fixedSourceMode: 'INITIAL',
      onGenerateSchedules,
      data: buildContract({
        id: 7017,
        project_id: null,
        customer_id: 2,
        project_type_code: 'THUE_DICH_VU_DACTHU',
        payment_cycle: 'QUARTERLY',
        term_unit: 'MONTH',
        term_value: 12,
        value: 18000000,
        sign_date: '2026-04-11',
        effective_date: '2026-04-11',
        expiry_date: '2027-01-11',
        signer_user_id: 1,
      }),
    });

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));

    const firstAmountInput = screen.getAllByDisplayValue('4.500.000')[0];
    await user.clear(firstAmountInput);
    await user.type(firstAmountInput, '4000000');

    expect(screen.getByText('Tổng dự thảo phải bằng 18.000.000 đ để sinh kỳ thanh toán.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sinh kỳ thanh toán' })).toBeDisabled();
    expect(onGenerateSchedules).not.toHaveBeenCalled();
  });

  it('shows unpaid schedules immediately and keeps manual deletions without auto-syncing the full schedule back', async () => {
    const user = userEvent.setup();
    const onGenerateSchedules = vi.fn().mockResolvedValue(undefined);
    const onDeletePaymentSchedule = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const paymentScheduleRows: PaymentSchedule[] = [
      {
        id: 9101,
        contract_id: 7013,
        milestone_name: 'Phí dịch vụ kỳ 1 (tháng)',
        cycle_number: 1,
        expected_date: '2026-01-01',
        expected_amount: 1500000,
        actual_paid_amount: 0,
        status: 'PENDING',
      },
      {
        id: 9102,
        contract_id: 7013,
        milestone_name: 'Phí dịch vụ kỳ 2 (tháng)',
        cycle_number: 2,
        expected_date: '2026-02-01',
        expected_amount: 1500000,
        actual_paid_amount: 0,
        status: 'PENDING',
      },
    ];

    const contractData = buildContract({
      id: 7013,
      project_id: null,
      customer_id: 2,
      project_type_code: 'THUE_DICH_VU_COSAN',
      payment_cycle: 'MONTHLY',
      term_unit: 'MONTH',
      term_value: 12,
      value: 3000000,
      signer_user_id: 1,
      signer_user_code: 'U001',
      signer_full_name: 'Tester',
      dept_id: 10,
      dept_code: 'P10',
      dept_name: 'Phong giai phap 10',
    });

    const StatefulHarness: React.FC = () => {
      const [rows, setRows] = React.useState<PaymentSchedule[]>(paymentScheduleRows);

      return (
        <ContractModal
          type="EDIT"
          data={contractData}
          prefill={null}
          fixedSourceMode="INITIAL"
          projects={projects}
          projectTypes={projectTypes}
          businesses={businesses}
          products={products}
          productPackages={productPackages}
          projectItems={projectItems}
          customers={customers}
          paymentSchedules={rows}
          onClose={vi.fn()}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onGenerateSchedules={onGenerateSchedules}
          onDeletePaymentSchedule={async (scheduleId) => {
            onDeletePaymentSchedule(scheduleId);
            setRows((prev) => prev.filter((item) => String(item.id) !== String(scheduleId)));
          }}
        />
      );
    };

    render(<StatefulHarness />);

    await user.click(screen.getByRole('button', { name: /Dòng tiền/i }));

    const [, scheduleTable] = screen.getAllByRole('table');
    expect(within(scheduleTable).getByText('Phí dịch vụ kỳ 2 (tháng)')).toBeInTheDocument();

    const firstScheduleRow = within(scheduleTable).getByRole('row', { name: /Phí dịch vụ kỳ 1 \(tháng\)/i });
    await user.click(within(firstScheduleRow).getByRole('button', { name: 'Xóa kỳ' }));

    await waitFor(() => expect(onDeletePaymentSchedule).toHaveBeenCalledWith(9101));
    await waitFor(() => {
      expect(within(scheduleTable).queryByText('Phí dịch vụ kỳ 1 (tháng)')).not.toBeInTheDocument();
      expect(within(scheduleTable).getByText('Phí dịch vụ kỳ 2 (tháng)')).toBeInTheDocument();
    });
    expect(onGenerateSchedules).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledWith('Bạn có chắc muốn xóa kỳ thanh toán "Phí dịch vụ kỳ 1 (tháng)" không?');

    confirmSpy.mockRestore();
  });
});
