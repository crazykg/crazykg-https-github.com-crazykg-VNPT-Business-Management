import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Business, Product, ProductUnitMaster, Vendor } from '../types';
import { ProductFormModal } from '../components/modals/ProductFormModal';

vi.mock('../components/AttachmentManager', () => ({
  AttachmentManager: () => <div data-testid="attachment-manager">Attachment Manager</div>,
}));

const businesses: Business[] = [
  { id: 1, uuid: 'b1', domain_code: 'YTESO_PM', domain_name: 'Phần mềm Y tế số' },
];

const vendors: Vendor[] = [
  { id: 1, uuid: 'v1', vendor_code: 'DMS', vendor_name: 'Trung tâm DMS' },
];

const product: Product = {
  id: 1,
  service_group: 'GROUP_B',
  product_code: 'HISL3-1',
  product_name: 'Phần mềm VNPT-HIS',
  package_name: 'Gói VNPT-HIS-1',
  domain_id: 1,
  vendor_id: 1,
  standard_price: 1500000,
  unit: 'Gói',
  description: 'Đến 10 giường bệnh',
  is_active: true,
  attachments: [],
};

const productUnitMasters: ProductUnitMaster[] = [
  {
    id: 1,
    unit_code: 'GOI',
    unit_name: 'Gói',
    description: 'Đơn vị gói cước',
    is_active: true,
  },
  {
    id: 2,
    unit_code: 'THANG',
    unit_name: 'Tháng',
    description: 'Đơn vị tháng',
    is_active: true,
  },
  {
    id: 3,
    unit_code: 'CAI',
    unit_name: 'Cái',
    description: 'Đơn vị cái',
    is_active: false,
  },
];

describe('ProductFormModal UI', () => {
  it('keeps desktop form typography consistent across labels, inputs and helper text', () => {
    render(
      <ProductFormModal
        type="EDIT"
        data={product}
        businesses={businesses}
        vendors={vendors}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Mã sản phẩm')).toHaveClass('text-sm');
    expect(screen.getByText('Tên sản phẩm')).toHaveClass('text-sm');
    expect(screen.getByText('Gói cước')).toHaveClass('text-sm');
    expect(screen.getByText('Giá tiêu chuẩn (VNĐ)')).toHaveClass('text-sm');
    expect(screen.getByText('Mô tả')).toHaveClass('text-sm');

    expect(screen.getByDisplayValue('HISL3-1')).toHaveClass('h-[46px]', 'text-[15px]', 'leading-6');
    expect(screen.getByDisplayValue('Phần mềm VNPT-HIS')).toHaveClass('h-[46px]', 'text-[15px]', 'leading-6');
    expect(screen.getByDisplayValue('Gói VNPT-HIS-1')).toHaveClass('h-[46px]', 'text-[15px]', 'leading-6');
    expect(screen.getByDisplayValue('1.500.000')).toHaveClass('h-[46px]', 'text-[15px]', 'leading-6');
    expect(screen.getByDisplayValue('Đến 10 giường bệnh')).toHaveClass('text-[15px]', 'leading-6', 'min-h-[156px]');

    expect(screen.getByText('Một triệu năm trăm nghìn đồng')).toHaveClass('text-[13px]', 'leading-5');
  });

  it('locks the standard price field in edit mode when the backend marks the price as already used', () => {
    render(
      <ProductFormModal
        type="EDIT"
        data={{
          ...product,
          standard_price_locked: true,
          standard_price_lock_message: 'Đơn giá đã được sử dụng ở dữ liệu khác (1 hạng mục hợp đồng) nên không thể cập nhật.',
        }}
        businesses={businesses}
        vendors={vendors}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByDisplayValue('1.500.000')).toBeDisabled();
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
    expect(
      screen.getByText('Đơn giá đã được sử dụng ở dữ liệu khác (1 hạng mục hợp đồng) nên không thể cập nhật.')
    ).toBeInTheDocument();
  });

  it('uses configured product unit masters and still keeps the current edit value selectable', async () => {
    const user = userEvent.setup();

    render(
      <ProductFormModal
        type="EDIT"
        data={{ ...product, unit: 'Thùng' }}
        businesses={businesses}
        vendors={vendors}
        productUnitMasters={productUnitMasters}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByTitle('Thùng'));

    expect(screen.getByRole('button', { name: 'Gói' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tháng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thùngcheck/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cái' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'License' })).not.toBeInTheDocument();
  });
});
