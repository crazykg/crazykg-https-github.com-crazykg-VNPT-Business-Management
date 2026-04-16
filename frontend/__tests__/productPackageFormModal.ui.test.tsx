import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Business, Product, ProductPackage, ProductUnitMaster, Vendor } from '../types';
import { ProductPackageFormModal } from '../components/modals/ProductPackageFormModal';

vi.mock('../components/AttachmentManager', () => ({
  AttachmentManager: () => <div data-testid="attachment-manager">Attachment Manager</div>,
}));

const businesses: Business[] = [
  { id: 1, uuid: 'b1', domain_code: 'KD001', domain_name: 'Y tế số' },
];

const vendors: Vendor[] = [
  { id: 1, uuid: 'v1', vendor_code: 'NCC001', vendor_name: 'VNPT Software' },
];

const products: Product[] = [
  {
    id: 1,
    service_group: 'GROUP_B',
    product_code: 'SP001',
    product_name: 'Gói HIS cơ bản',
    package_name: 'Gói HIS chuẩn',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 1200000,
    unit: 'Gói',
    description: 'Mô tả sản phẩm cha',
    is_active: true,
  },
  {
    id: 2,
    service_group: 'GROUP_A',
    product_code: 'SP002',
    product_name: 'R_MIN - Hệ thống thông tin chuẩn đoán hình ảnh',
    package_name: '',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 600000,
    unit: 'Ca chụp',
    description: '',
    is_active: true,
  },
];

const productUnitMasters: ProductUnitMaster[] = [
  {
    id: 1,
    unit_code: 'GOI',
    unit_name: 'Gói',
    description: 'Đơn vị gói',
    is_active: true,
  },
  {
    id: 2,
    unit_code: 'THANG',
    unit_name: 'Tháng',
    description: 'Đơn vị tháng',
    is_active: true,
  },
];

const productPackage: ProductPackage = {
  id: 10,
  product_id: 1,
  product_name: 'Gói HIS cơ bản',
  parent_product_code: 'SP001',
  service_group: 'GROUP_B',
  domain_id: 1,
  vendor_id: 1,
  package_code: 'PKG-HIS-01',
  package_name: 'Gói HIS nâng cao',
  standard_price: 2500000,
  unit: 'Gói',
  description: 'Áp dụng cho cơ sở y tế tuyến huyện',
  is_active: true,
  attachments: [],
};

describe('ProductPackageFormModal UI', () => {
  it('shows compact typography and parent product summary for the selected package', () => {
    render(
      <ProductPackageFormModal
        type="EDIT"
        data={productPackage}
        products={products}
        businesses={businesses}
        vendors={vendors}
        productUnitMasters={productUnitMasters}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Sản phẩm/Dịch vụ')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Mã gói cước')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Tên gói cước')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');
    expect(screen.getByText('Đơn giá (Trước VAT)')).toHaveClass('text-xs', 'font-semibold', 'text-neutral');

    expect(screen.getByDisplayValue('PKG-HIS-01')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('Gói HIS nâng cao')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('2.500.000')).toHaveClass('h-8', 'text-xs', 'leading-5');
    expect(screen.getByDisplayValue('Áp dụng cho cơ sở y tế tuyến huyện')).toHaveClass('text-xs', 'leading-5');

    expect(screen.getByText('Dịch vụ nhóm B')).toBeInTheDocument();
    expect(screen.getByText('SP001')).toBeInTheDocument();
    expect(screen.queryByText('KD001 - Y tế số')).not.toBeInTheDocument();
    expect(screen.queryByText('NCC001 - VNPT Software')).not.toBeInTheDocument();
  });

  it('validates required fields except package name and copies package, description, unit, and price from the selected parent product', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductPackageFormModal
        type="ADD"
        data={null}
        products={products}
        businesses={businesses}
        vendors={vendors}
        productUnitMasters={productUnitMasters}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm gói cước/i }));

    expect(screen.getByText('Vui lòng chọn sản phẩm/dịch vụ cha.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mã gói cước.')).toBeInTheDocument();
    expect(screen.queryByText('Vui lòng nhập tên gói cước.')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Chọn sản phẩm/dịch vụ'));
    await user.click(screen.getByRole('button', { name: /SP001 - Gói HIS cơ bản/i }));

    expect(screen.getByText('Dịch vụ nhóm B')).toBeInTheDocument();
    expect(screen.getByText('SP001')).toBeInTheDocument();
    expect(screen.queryByText('KD001 - Y tế số')).not.toBeInTheDocument();
    expect(screen.queryByText('NCC001 - VNPT Software')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Gói HIS chuẩn')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.200.000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mô tả sản phẩm cha')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('PKG001'), 'PKG-NEW');
    await user.click(screen.getByRole('button', { name: /Thêm gói cước/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      product_id: '1',
      package_code: 'PKG-NEW',
      package_name: 'Gói HIS chuẩn',
      unit: 'Gói',
      standard_price: 1200000,
      description: 'Mô tả sản phẩm cha',
    }));
  });

  it('updates untouched auto-filled fields when switching to another parent product', async () => {
    const user = userEvent.setup();

    render(
      <ProductPackageFormModal
        type="ADD"
        data={null}
        products={products}
        businesses={businesses}
        vendors={vendors}
        productUnitMasters={productUnitMasters}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await user.click(screen.getByTitle('Chọn sản phẩm/dịch vụ'));
    await user.click(screen.getByRole('button', { name: /SP001 - Gói HIS cơ bản/i }));

    expect(screen.getByDisplayValue('Gói HIS chuẩn')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.200.000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mô tả sản phẩm cha')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /SP001 - Gói HIS cơ bản/i }));
    await user.click(screen.getByRole('button', { name: /SP002 - R_MIN - Hệ thống thông tin chuẩn đoán hình ảnh/i }));

    expect(screen.getByPlaceholderText('Ví dụ: Gói VNPT HIS 1')).toHaveValue('R_MIN - Hệ thống thông tin chuẩn đoán hình ảnh');
    expect(screen.getByDisplayValue('600.000')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mô tả gói cước sản phẩm')).toHaveValue('R_MIN - Hệ thống thông tin chuẩn đoán hình ảnh');
  });
});
