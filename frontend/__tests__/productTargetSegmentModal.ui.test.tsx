import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductTargetSegment } from '../types/product';
import { ProductTargetSegmentModal } from '../components/ProductTargetSegmentModal';

const apiSpies = vi.hoisted(() => ({
  fetchProductTargetSegments: vi.fn(),
  syncProductTargetSegments: vi.fn(),
}));

vi.mock('../services/api/productApi', () => ({
  fetchProductTargetSegments: apiSpies.fetchProductTargetSegments,
  syncProductTargetSegments: apiSpies.syncProductTargetSegments,
}));

vi.mock('../components/Modals', () => ({
  ModalWrapper: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

const product: Product = {
  id: 1,
  service_group: 'GROUP_A',
  product_code: 'SP-HIS',
  product_name: 'Phần mềm HIS',
  package_name: 'HIS Premium',
  domain_id: 1,
  vendor_id: 1,
  standard_price: 1000000,
  description: 'Sản phẩm test',
  is_active: true,
};

const buildSegments = (): ProductTargetSegment[] => ([
  {
    id: 11,
    uuid: 'segment-11',
    product_id: 1,
    customer_sector: 'HEALTHCARE',
    facility_type: 'PUBLIC_HOSPITAL',
    facility_types: ['PUBLIC_HOSPITAL'],
    bed_capacity_min: 200,
    bed_capacity_max: null,
    priority: 1,
    sales_notes: 'Ưu tiên bệnh viện công.',
    is_active: true,
    created_at: '2026-03-30T08:00:00+07:00',
    updated_at: '2026-03-30T08:00:00+07:00',
    created_by: 7,
    updated_by: 7,
  },
]);

describe('ProductTargetSegmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiSpies.fetchProductTargetSegments.mockResolvedValue({
      data: buildSegments(),
      meta: { table_available: true },
    });
    apiSpies.syncProductTargetSegments.mockResolvedValue({
      data: buildSegments(),
    });
  });

  it('loads existing segments and saves edited data', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNotify = vi.fn();

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={onClose}
        onNotify={onNotify}
      />
    );

    await user.click(await screen.findByLabelText('Loại hình y tế'));
    await user.click(screen.getByRole('button', { name: /Trung tâm Y tế/i }));
    await user.click(screen.getByRole('button', { name: /Loại hình y tế/i }));

    const noteField = await screen.findByDisplayValue('Ưu tiên bệnh viện công.');
    await user.clear(noteField);
    await user.type(noteField, 'Bệnh viện công quy mô lớn');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(apiSpies.syncProductTargetSegments).toHaveBeenCalledWith(1, [
        expect.objectContaining({
          customer_sector: 'HEALTHCARE',
          facility_type: null,
          facility_types: ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'],
          sales_notes: 'Bệnh viện công quy mô lớn',
        }),
      ]);
    });

    expect(onNotify).toHaveBeenCalledWith(
      'success',
      'Product target segments',
      'Đã lưu cấu hình đề xuất bán hàng.'
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a row and hides healthcare-only fields when sector changes away from healthcare', async () => {
    const user = userEvent.setup();
    apiSpies.fetchProductTargetSegments.mockResolvedValueOnce({
      data: [],
      meta: { table_available: true },
    });

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByText('Chưa cấu hình đề xuất');
    await user.click(screen.getByRole('button', { name: 'Thêm segment đầu tiên' }));

    await user.selectOptions(screen.getByLabelText('Lĩnh vực khách hàng'), 'HEALTHCARE');
    expect(screen.getByLabelText('Loại hình y tế')).toBeInTheDocument();
    expect(screen.getByLabelText('Giường bệnh tối thiểu')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Lĩnh vực khách hàng'), 'GOVERNMENT');

    expect(screen.queryByLabelText('Loại hình y tế')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Giường bệnh tối thiểu')).not.toBeInTheDocument();
  });

  it('supports selecting multiple healthcare facility types', async () => {
    const user = userEvent.setup();
    apiSpies.fetchProductTargetSegments.mockResolvedValueOnce({
      data: [],
      meta: { table_available: true },
    });

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByText('Chưa cấu hình đề xuất');
    await user.click(screen.getByRole('button', { name: 'Thêm segment đầu tiên' }));
    await user.selectOptions(screen.getByLabelText('Lĩnh vực khách hàng'), 'HEALTHCARE');

    await user.click(screen.getByLabelText('Loại hình y tế'));
    await user.click(screen.getByRole('button', { name: /Bệnh viện \(Công lập\)/i }));
    await user.click(screen.getByRole('button', { name: /Trung tâm Y tế/i }));
    await user.click(screen.getByRole('button', { name: /Loại hình y tế/i }));

    expect(screen.getByText('Đã chọn 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(apiSpies.syncProductTargetSegments).toHaveBeenCalledWith(1, [
        expect.objectContaining({
          customer_sector: 'HEALTHCARE',
          facility_type: null,
          facility_types: ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'],
        }),
      ]);
    });
  });

  it('shows inline validation errors and blocks save for invalid drafts', async () => {
    const user = userEvent.setup();
    apiSpies.fetchProductTargetSegments.mockResolvedValueOnce({
      data: [],
      meta: { table_available: true },
    });

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByText('Chưa cấu hình đề xuất');
    await user.click(screen.getByRole('button', { name: 'Thêm segment đầu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Vui lòng chọn lĩnh vực khách hàng.')).toBeInTheDocument();
    expect(apiSpies.syncProductTargetSegments).not.toHaveBeenCalled();
  });

  it('shows duplicate validation when two rows target the same segment', async () => {
    const user = userEvent.setup();
    apiSpies.fetchProductTargetSegments.mockResolvedValueOnce({
      data: [],
      meta: { table_available: true },
    });

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByText('Chưa cấu hình đề xuất');
    await user.click(screen.getByRole('button', { name: 'Thêm segment đầu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Thêm segment' }));

    const sectorFields = screen.getAllByLabelText('Lĩnh vực khách hàng');
    await user.selectOptions(sectorFields[0], 'GOVERNMENT');
    await user.selectOptions(sectorFields[1], 'GOVERNMENT');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findAllByText('Segment này đang bị trùng với một cấu hình khác trong danh sách.')).toHaveLength(2);
    expect(apiSpies.syncProductTargetSegments).not.toHaveBeenCalled();
  });

  it('removes an existing segment row from the draft list', async () => {
    const user = userEvent.setup();

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    await screen.findByDisplayValue('Ưu tiên bệnh viện công.');
    await user.click(screen.getByTitle('Xóa segment'));

    expect(await screen.findByText('Chưa cấu hình đề xuất')).toBeInTheDocument();
  });

  it('renders an unavailable state when the target segment table is missing', async () => {
    apiSpies.fetchProductTargetSegments.mockResolvedValueOnce({
      data: [],
      meta: { table_available: false },
    });

    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={true}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Tính năng chưa sẵn sàng trong môi trường này.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toHaveAttribute('title', 'Tính năng chưa sẵn sàng');
    expect(screen.queryByRole('button', { name: 'Thêm segment' })).not.toBeInTheDocument();
  });

  it('hides add save and delete actions for read-only usage', async () => {
    render(
      <ProductTargetSegmentModal
        product={product}
        canManage={false}
        onClose={vi.fn()}
      />
    );

    await screen.findByDisplayValue('Ưu tiên bệnh viện công.');

    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm segment' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Xóa segment')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Lĩnh vực khách hàng')).toBeDisabled();
  });
});
