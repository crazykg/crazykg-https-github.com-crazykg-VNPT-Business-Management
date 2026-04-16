import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Business, Product, Vendor } from '../types';
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
  product_short_name: 'VNPT HIS',
  domain_id: 1,
  vendor_id: 1,
  standard_price: 1500000,
  description: 'Đến 10 giường bệnh',
  is_active: true,
  attachments: [],
};

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

    expect(screen.getByText('Mã định danh')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Tên sản phẩm')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Tên viết tắt')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Mô tả')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.queryByText('Bổ sung')).not.toBeInTheDocument();

    expect(screen.getByDisplayValue('HISL3-1')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('Phần mềm VNPT-HIS')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('VNPT HIS')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('Đến 10 giường bệnh')).toHaveClass('text-xs', 'leading-5', 'min-h-[100px]');
    expect(screen.queryByText('Đơn giá (Trước VAT)')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('1.500.000')).not.toBeInTheDocument();
  });

  it('hides the standard price field even when legacy backend lock metadata is present', () => {
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

    expect(screen.queryByText('Đơn giá (Trước VAT)')).not.toBeInTheDocument();
    expect(screen.queryByText('Đã khóa')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Đơn giá đã được sử dụng ở dữ liệu khác (1 hạng mục hợp đồng) nên không thể cập nhật.')
    ).not.toBeInTheDocument();
  });

  it('does not render the unit selector anymore', () => {
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

    expect(screen.queryByText('Đơn vị tính')).not.toBeInTheDocument();
  });
});
