import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectFormModal } from '../components/modals';
import type { ProcedureTemplate, Product, ProductPackage, Project } from '../types';

const PROJECT_FORM_SUBMIT_TIMEOUT_MS = 16000;
const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProjectImplementationUnitOptionsMock = vi.hoisted(() => vi.fn());
const fetchProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const generateProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const syncProjectRevenueSchedulesMock = vi.hoisted(() => vi.fn());
const fetchProductQuotationsPageMock = vi.hoisted(() => vi.fn());
const fetchProductQuotationMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

fetchProjectImplementationUnitOptionsMock.mockResolvedValue([]);
fetchProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
generateProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
syncProjectRevenueSchedulesMock.mockResolvedValue({ data: [] });
fetchProductQuotationsPageMock.mockResolvedValue({ data: [] });
fetchProductQuotationMock.mockResolvedValue(null);

vi.mock('../services/v5Api', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  fetchProjectRevenueSchedules: fetchProjectRevenueSchedulesMock,
  generateProjectRevenueSchedules: generateProjectRevenueSchedulesMock,
  syncProjectRevenueSchedules: syncProjectRevenueSchedulesMock,
  deleteUploadedDocumentAttachment: vi.fn(),
  uploadDocumentAttachment: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
  deleteUploadedFeedbackAttachment: vi.fn(),
}));

vi.mock('../services/api/projectApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/projectApi')>(
    '../services/api/projectApi'
  );

  return {
    ...actual,
    fetchProjectImplementationUnitOptions:
      fetchProjectImplementationUnitOptionsMock,
  };
});

vi.mock('../services/api/productApi', () => ({
  fetchProductQuotationsPage: fetchProductQuotationsPageMock,
  fetchProductQuotation: fetchProductQuotationMock,
}));

const baseProjectData: Project = {
  id: 300,
  project_code: 'DA300',
  project_name: 'Dự án kiểm tra payload save',
  customer_id: 1,
  status: 'CHUAN_BI',
  investment_mode: 'DAU_TU',
  payment_cycle: 'QUARTERLY',
  opportunity_score: 1,
  start_date: '2026-02-25',
  expected_end_date: '2026-11-25',
  actual_end_date: null,
  items: [
    {
      id: 'ITEM_1',
      productId: '11',
      product_id: 11,
      quantity: 1,
      unitPrice: 10000000,
      unit_price: 10000000,
      discountPercent: 0,
      discountAmount: 0,
      lineTotal: 10000000,
      line_total: 10000000,
    },
  ],
  raci: [
    {
      id: 'RACI_1',
      userId: '22',
      user_id: 22,
      roleType: 'R',
      raci_role: 'R',
      assignedDate: '28/03/2026',
    },
  ],
} as Project;

describe('ProjectFormModal save payload', () => {
  it('keeps the add-project modal open on backdrop click while still allowing Cancel, X, and Escape to close it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ProjectFormModal
        type="ADD"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Đóng modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the edit-project modal open on backdrop click while still allowing Cancel, X, and Escape to close it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Đóng modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not sync items or raci when only general project info is saved', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.queryByText('Ngày kết thúc thực tế')).not.toBeInTheDocument();
    expect(screen.queryByText('Điểm cơ hội')).not.toBeInTheDocument();

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.project_code).toBe('DA300');
    expect(payload.project_name).toBe('Dự án kiểm tra payload save');
    expect(payload.start_date).toBe('2026-02-25');
    expect(payload.expected_end_date).toBe('2026-11-25');
    expect(payload.actual_end_date).toBeNull();
    expect(payload.opportunity_score).toBe(1);
    expect(payload.items).toBeUndefined();
    expect(payload.raci).toBeUndefined();
  });

  it('shows opportunity_score before payment_cycle when status is Cơ hội', () => {
    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          status: 'CO_HOI',
          opportunity_score: 2,
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const opportunityLabel = screen.getByText('Điểm cơ hội');
    const paymentCycleLabel = screen.getByText('Chu kỳ thanh toán');

    expect(
      opportunityLabel.compareDocumentPosition(paymentCycleLabel)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /2 điểm - Cao/i })).toBeInTheDocument();
  });

  it('defaults opportunity_score to 0 when switching to Cơ hội and keeps it when hidden again', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          status: 'CHUAN_BI',
          opportunity_score: null,
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const getStatusTrigger = () =>
      within(screen.getByText('Trạng thái').closest('.col-span-1') as HTMLElement).getByRole('button');

    expect(screen.queryByText('Điểm cơ hội')).not.toBeInTheDocument();

    await user.click(getStatusTrigger());
    await user.click(screen.getByRole('button', { name: 'Cơ hội' }));

    expect(screen.getByText('Điểm cơ hội')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /0 điểm - Thấp/i })).toBeInTheDocument();

    await user.click(getStatusTrigger());
    await user.click(screen.getByRole('button', { name: 'Thực hiện đầu tư' }));

    expect(screen.queryByText('Điểm cơ hội')).not.toBeInTheDocument();

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.opportunity_score).toBe(0);
  });

  it('keeps a non-opportunity template phase selected when the template returns Vietnamese phase labels', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    fetchProcedureTemplatesMock.mockResolvedValueOnce([
      {
        id: 3,
        template_code: 'THUE_DICH_VU_DACTHU',
        template_name: 'Thuê dịch vụ CNTT đặc thù',
        is_active: true,
        phases: ['Phê duyệt chủ trương', 'Triển khai hợp đồng'],
      },
    ] as ProcedureTemplate[]);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          status: 'CO_HOI',
          investment_mode: 'THUE_DICH_VU_DACTHU',
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const getStatusTrigger = () =>
      within(screen.getByText('Trạng thái').closest('.col-span-1') as HTMLElement).getByRole('button');

    await user.click(getStatusTrigger());
    await user.click(await screen.findByRole('button', { name: 'Phê duyệt chủ trương' }));

    expect(within(getStatusTrigger()).getByText('Phê duyệt chủ trương')).toBeInTheDocument();
    expect(screen.queryByText('Điểm cơ hội')).not.toBeInTheDocument();

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.status).toBe('PHÊ DUYỆT CHỦ TRƯƠNG');
  });

  it('syncs project items after the items tab is edited', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="items"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm hạng mục/i }));
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items).toHaveLength(2);
    expect(payload.raci).toBeUndefined();
  });

  it('keeps the quotation unit snapshot when merging imported items into an existing project item', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    fetchProductQuotationsPageMock.mockResolvedValue({
      data: [
        {
          id: 501,
          recipient_name: 'Bệnh viện Sản - Nhi Hậu Giang',
          total_amount: 48000000,
          updated_at: '2026-04-26T10:00:00Z',
        },
      ],
    });
    fetchProductQuotationMock.mockResolvedValue({
      id: 501,
      recipient_name: 'Bệnh viện Sản - Nhi Hậu Giang',
      items: [
        {
          id: 9001,
          product_id: 11,
          package_id: 101,
          quantity: 24,
          unit_price: 2000000,
          unit: '4 Máy/Tháng',
        },
      ],
    });

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          items: [
            {
              id: 'ITEM_1',
              productId: '11',
              productPackageId: '101',
              product_id: 11,
              product_package_id: 101,
              quantity: 12,
              unitPrice: 500000,
              unit_price: 500000,
              discountPercent: 0,
              discountAmount: 0,
              lineTotal: 6000000,
              line_total: 6000000,
            },
          ],
        }}
        initialTab="items"
        customers={[]}
        products={[
          {
            id: 11,
            product_code: 'XN01',
            product_name: 'Thuê phần mềm quản lý xét nghiệm',
          } as Product,
        ]}
        productPackages={[
          {
            id: 101,
            product_id: 11,
            package_code: 'PKG-XN',
            package_name: 'Thuê phần mềm quản lý xét nghiệm',
            unit: 'Máy/Tháng',
          } as ProductPackage,
        ]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Lấy từ Báo giá/i }));
    await user.click(
      await screen.findByRole('button', {
        name: /Bệnh viện Sản - Nhi Hậu Giang/i,
      })
    );

    expect(await screen.findByText('4 Máy/Tháng')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lấy 1 hạng mục/i }));

    await waitFor(() => {
      expect(screen.getByText('4 Máy/Tháng')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.items?.[0]?.unit).toBe('4 Máy/Tháng');
    expect(payload.items?.[0]?.quantity).toBe(36);
  });

  it('formats item quantity with thousand separators while preserving numeric save payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const baseItem = baseProjectData.items?.[0];

    expect(baseItem).toBeDefined();

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          items: [
            {
              ...baseItem!,
              quantity: 45000,
              lineTotal: 450000000000,
              line_total: 450000000000,
            },
          ],
        }}
        initialTab="items"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const quantityInput = screen.getByLabelText('Số lượng hạng mục dòng 1');
    expect(quantityInput).toHaveValue('45.000');

    await user.click(quantityInput);
    await user.clear(quantityInput);
    await user.type(quantityInput, '1234,75');

    await waitFor(() => {
      expect(screen.getByLabelText('Số lượng hạng mục dòng 1')).toHaveValue('1.234,75');
    });

    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.items?.[0]?.quantity).toBe(1234.75);
  });

  it('warns but still saves when copied items duplicate the same product in one project', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="items"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Sao chép hạng mục dòng 1/i }));
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    expect(
      await screen.findByText(
        'Có hạng mục đang bị trùng trong cùng dự án. Hệ thống chỉ cảnh báo để bạn kiểm tra lại, nhưng vẫn cho phép cập nhật dự án.'
      )
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.items).toHaveLength(2);
  });

  it('requires and normalizes payment_cycle when saving an investment project', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          payment_cycle: 'Hàng quý',
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Chu kỳ thanh toán')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Hàng quý/i }));
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.status).toBe('CHUAN_BI');
    expect(payload.payment_cycle).toBe('QUARTERLY');
  });

  it('includes implementation_user_id when a deployment unit is selected', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    fetchProjectImplementationUnitOptionsMock.mockResolvedValueOnce([
      {
        id: 88,
        user_code: 'USR088',
        full_name: 'Nguyen Van Trien Khai',
        department_id: 20,
        dept_code: 'P20',
        dept_name: 'Phong Giai Phap 20',
      },
    ]);

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /Chọn người phụ trách/i })
    );
    await user.click(
      await screen.findByRole('button', {
        name: /USR088 - Nguyen Van Trien Khai/i,
      })
    );
    await user.click(
      screen.getByText('Cập nhật').closest('button') as HTMLButtonElement
    );

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.implementation_user_id).toBe('88');
  });

  it('blocks saving when Thuê dịch vụ CNTT có sẵn is selected without a payment cycle', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          investment_mode: 'THUE_DICH_VU_COSAN',
          payment_cycle: null,
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Chu kỳ thanh toán')).toBeInTheDocument();
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.')).toBeInTheDocument();
  });

  it('shows and requires payment_cycle when Thuê dịch vụ CNTT đặc thù is selected', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectFormModal
        type="EDIT"
        data={{
          ...baseProjectData,
          investment_mode: 'THUE_DICH_VU_DACTHU',
          payment_cycle: null,
        }}
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Chu kỳ thanh toán')).toBeInTheDocument();
    await user.click(screen.getByText('Cập nhật').closest('button') as HTMLButtonElement);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.')).toBeInTheDocument();
  });

  it('locks project items but keeps project team updates available when revenue schedules already exist', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    fetchProjectRevenueSchedulesMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            project_id: 300,
            cycle_number: 1,
            expected_date: '2026-04-30',
            expected_amount: 10000000,
            notes: 'Ky 1',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            project_id: 300,
            cycle_number: 1,
            expected_date: '2026-04-30',
            expected_amount: 10000000,
            notes: 'Ky 1',
          },
        ],
      });
    syncProjectRevenueSchedulesMock.mockResolvedValueOnce({ data: [] });

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="items"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /Dự án đang có 1 phân kỳ doanh thu\. Bạn vẫn có thể cập nhật đội ngũ dự án, nhưng muốn đổi thông tin chung hoặc hạng mục thì vui lòng vào tab Phân kỳ doanh thu và xóa trước\./i
        ).length
      ).toBe(1);
    });
    expect(screen.getByRole('button', { name: /Thêm hạng mục/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cập nhật/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Đội ngũ dự án/i }));
    await user.click(within(screen.getByRole('table')).getAllByTitle('Xóa')[0]);
    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0] as Partial<Project>;
    expect(payload.items).toBeUndefined();
    expect(payload.raci).toEqual([]);

    await user.click(screen.getByRole('button', { name: /Phân kỳ doanh thu/i }));
    await user.click(
      await screen.findByRole('button', { name: /Xóa toàn bộ phân kỳ/i })
    );

    await waitFor(() => {
      expect(syncProjectRevenueSchedulesMock).toHaveBeenCalledWith(300, []);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Bạn vẫn có thể cập nhật đội ngũ dự án/i)).not.toBeInTheDocument();
    });
  });

  it('deduplicates delete-all revenue schedule requests when the button is clicked rapidly', async () => {
    const onNotify = vi.fn();
    let resolveSync: (value: { data: [] }) => void = () => undefined;

    fetchProjectRevenueSchedulesMock.mockClear();
    syncProjectRevenueSchedulesMock.mockClear();
    fetchProjectRevenueSchedulesMock.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          project_id: 300,
          cycle_number: 1,
          expected_date: '2026-04-30',
          expected_amount: 10000000,
          notes: 'Ky 1',
        },
      ],
    });
    syncProjectRevenueSchedulesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve as (value: { data: [] }) => void;
        })
    );

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="revenue_schedules"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onNotify={onNotify}
      />
    );

    const deleteButton = await screen.findByRole('button', {
      name: /Xóa toàn bộ phân kỳ/i,
    });

    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(syncProjectRevenueSchedulesMock).toHaveBeenCalledTimes(1);
    expect(syncProjectRevenueSchedulesMock).toHaveBeenCalledWith(300, []);

    resolveSync({ data: [] });

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        'success',
        'Thành công',
        'Đã xóa toàn bộ phân kỳ doanh thu. Bạn có thể cập nhật lại dự án.'
      );
    });
    expect(onNotify).toHaveBeenCalledTimes(1);
  });

  it('allows editing revenue schedule amounts and dates while keeping the total locked and showing audit columns', async () => {
    const user = userEvent.setup();

    fetchProjectRevenueSchedulesMock.mockResolvedValueOnce({
      data: [
        {
          id: 11,
          project_id: 300,
          cycle_number: 1,
          expected_date: '2026-04-30',
          expected_amount: 10000000,
          notes: 'Ky 1',
          created_by: 1,
          created_by_name: 'Admin Revenue',
          created_at: '2026-04-01 08:00:00',
        },
        {
          id: 12,
          project_id: 300,
          cycle_number: 2,
          expected_date: '2026-06-30',
          expected_amount: 8000000,
          notes: 'Ky 2',
          created_by: 1,
          created_by_name: 'Admin Revenue',
          created_at: '2026-04-02 09:00:00',
        },
      ],
    });
    syncProjectRevenueSchedulesMock.mockResolvedValueOnce({
      data: [
        {
          id: 11,
          project_id: 300,
          cycle_number: 1,
          expected_date: '2026-05-05',
          expected_amount: 12000000,
          notes: 'Ky 1 cap nhat',
          created_by: 1,
          created_by_name: 'Admin Revenue',
          created_at: '2026-04-01 08:00:00',
        },
        {
          id: 12,
          project_id: 300,
          cycle_number: 2,
          expected_date: '2026-06-30',
          expected_amount: 6000000,
          notes: 'Ky 2',
          created_by: 1,
          created_by_name: 'Admin Revenue',
          created_at: '2026-04-02 09:00:00',
        },
      ],
    });

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="revenue_schedules"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect((await screen.findAllByText('Admin Revenue')).length).toBe(2);
    expect((await screen.findAllByText(/0[12]\/04\/2026/)).length).toBe(2);

    const dateInputs = await screen.findAllByDisplayValue(/2026-\d{2}-\d{2}/);
    const amountInputs = Array.from(
      document.querySelectorAll('input[inputmode="numeric"]')
    ) as HTMLInputElement[];
    const noteInputs = screen.getAllByPlaceholderText('Ghi chú kỳ này');

    expect(amountInputs).toHaveLength(2);

    fireEvent.change(dateInputs[0], { target: { value: '2026-05-05' } });
    fireEvent.change(amountInputs[0], { target: { value: '12.000.000' } });
    fireEvent.change(noteInputs[0], { target: { value: 'Ky 1 cap nhat' } });

    expect(screen.getByDisplayValue('6.000.000')).toBeInTheDocument();
    expect(screen.getAllByText('18.000.000 đ').length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: /Lưu thay đổi phân kỳ/i }));

    await waitFor(() => {
      expect(syncProjectRevenueSchedulesMock).toHaveBeenCalledWith(300, [
        {
          id: 11,
          expected_date: '2026-05-05',
          expected_amount: 12000000,
          notes: 'Ky 1 cap nhat',
        },
        {
          id: 12,
          expected_date: '2026-06-30',
          expected_amount: 6000000,
          notes: 'Ky 2',
        },
      ]);
    });
  });

  it('redistributes the deleted revenue schedule amount into the remaining row before saving', async () => {
    const user = userEvent.setup();

    fetchProjectRevenueSchedulesMock.mockResolvedValueOnce({
      data: [
        {
          id: 21,
          project_id: 300,
          cycle_number: 1,
          expected_date: '2026-04-30',
          expected_amount: 10000000,
          notes: 'Ky 1',
        },
        {
          id: 22,
          project_id: 300,
          cycle_number: 2,
          expected_date: '2026-06-30',
          expected_amount: 8000000,
          notes: 'Ky 2',
        },
      ],
    });
    syncProjectRevenueSchedulesMock.mockResolvedValueOnce({
      data: [
        {
          id: 21,
          project_id: 300,
          cycle_number: 1,
          expected_date: '2026-04-30',
          expected_amount: 18000000,
          notes: 'Ky 1',
        },
      ],
    });

    render(
      <ProjectFormModal
        type="EDIT"
        data={baseProjectData}
        initialTab="revenue_schedules"
        customers={[]}
        products={[]}
        employees={[]}
        departments={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await screen.findByDisplayValue('10.000.000');

    await user.click(screen.getByRole('button', { name: /Xóa kỳ doanh thu 2/i }));

    expect(screen.getByDisplayValue('18.000.000')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('8.000.000')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lưu thay đổi phân kỳ/i }));

    await waitFor(() => {
      expect(syncProjectRevenueSchedulesMock).toHaveBeenCalledWith(300, [
        {
          id: 21,
          expected_date: '2026-04-30',
          expected_amount: 18000000,
          notes: 'Ky 1',
        },
      ]);
    });
  });

  it('shows an inline success notice after saving while keeping the modal open', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <React.StrictMode>
        <ProjectFormModal
          type="EDIT"
          data={baseProjectData}
          customers={[]}
          products={[]}
          employees={[]}
          departments={[]}
          onClose={vi.fn()}
          onSave={onSave}
        />
      </React.StrictMode>
    );

    await user.click(screen.getByRole('button', { name: /Cập nhật/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Đã cập nhật dự án\. Modal vẫn mở để tiếp tục thao tác\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đang lưu/i })).not.toBeInTheDocument();
  });

  it('releases the save button when the project save promise hangs', async () => {
    vi.useFakeTimers();
    const onNotify = vi.fn();
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    try {
      render(
        <ProjectFormModal
          type="EDIT"
          data={{
            ...baseProjectData,
            status: 'CO_HOI',
            payment_cycle: 'QUARTERLY',
          }}
          customers={[]}
          products={[]}
          employees={[]}
          departments={[]}
          onClose={vi.fn()}
          onSave={onSave}
          onNotify={onNotify}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cập nhật/i }));

      expect(screen.getByRole('button', { name: /Đang lưu/i })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(PROJECT_FORM_SUBMIT_TIMEOUT_MS + 1);
        await Promise.resolve();
      });

      expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeInTheDocument();
      expect(screen.getByText('Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.')).toBeInTheDocument();
      expect(onNotify).toHaveBeenCalledWith(
        'error',
        'Lưu thất bại',
        'Không thể cập nhật dự án (quá thời gian phản hồi). Vui lòng thử lại.'
      );
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});
