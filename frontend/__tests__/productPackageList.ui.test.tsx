import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business, Product, ProductPackage, Vendor } from '../types';
import { ProductPackageList } from '../components/ProductPackageList';

const exportSpies = vi.hoisted(() => ({
  downloadExcelWorkbook: vi.fn(),
  exportCsv: vi.fn(),
  exportPdfTable: vi.fn(() => true),
}));

vi.mock('../utils/excelTemplate', () => ({
  downloadExcelWorkbook: exportSpies.downloadExcelWorkbook,
}));

vi.mock('../utils/exportUtils', () => ({
  exportCsv: exportSpies.exportCsv,
  exportPdfTable: exportSpies.exportPdfTable,
  isoDateStamp: vi.fn(() => '20260409'),
}));

const businesses: Business[] = [
  { id: 1, uuid: 'b1', domain_code: 'KD001', domain_name: 'Y tế số' },
  { id: 2, uuid: 'b2', domain_code: 'KD002', domain_name: 'Chuyển đổi số' },
];

const vendors: Vendor[] = [
  { id: 1, uuid: 'v1', vendor_code: 'NCC001', vendor_name: 'VNPT Software' },
  { id: 2, uuid: 'v2', vendor_code: 'NCC002', vendor_name: 'IoT Center' },
];

const products: Product[] = [
  {
    id: 1,
    service_group: 'GROUP_B',
    product_code: 'SP001',
    product_name: 'Gói HIS cơ bản',
    package_name: '',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 1200000,
    unit: 'Gói',
    description: 'Sản phẩm HIS',
    is_active: true,
  },
  {
    id: 2,
    service_group: 'GROUP_C',
    product_code: 'SP002',
    product_name: 'Cloud Camera',
    package_name: '',
    domain_id: 2,
    vendor_id: 2,
    standard_price: 900000,
    unit: 'Tháng',
    description: 'Camera AI',
    is_active: true,
  },
];

const productPackages: ProductPackage[] = [
  {
    id: 11,
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
    description: 'Áp dụng tuyến huyện',
    is_active: true,
    attachments: [],
  },
  {
    id: 12,
    product_id: 2,
    product_name: 'Cloud Camera',
    parent_product_code: 'SP002',
    service_group: 'GROUP_C',
    domain_id: 2,
    vendor_id: 2,
    package_code: 'PKG-IOT-01',
    package_name: 'Gói Camera AI',
    standard_price: 650000,
    unit: 'Tháng',
    description: 'Camera giám sát AI',
    is_active: true,
    attachments: [],
  },
];

describe('ProductPackageList UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Vietnamese title and opens filter dropdowns through a portal layer', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    expect(screen.getByRole('heading', { name: 'Gói cước Sản phẩm' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm mã gói, tên gói hoặc sản phẩm...')).toHaveClass('h-8', 'rounded-md', 'bg-slate-50');
    expect(screen.getByRole('button', { name: 'Hoạt động' }).className).toContain('!h-8');
    expect(screen.getByRole('button', { name: 'Hoạt động' }).className).toContain('!text-xs');
    expect(screen.getByText('Dòng/trang')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Lĩnh vực KD')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhà cung cấp')).not.toBeInTheDocument();
    expect(screen.queryByText('SP001')).not.toBeInTheDocument();
    expect(screen.queryByText('SP002')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nhóm dịch vụ' }));

    const dropdownSearch = screen.getByPlaceholderText('Tìm kiếm...');
    expect(container.contains(dropdownSearch)).toBe(false);
    expect(screen.getByRole('button', { name: /Tất cả nhóm dịch vụ/i })).toBeInTheDocument();
  });

  it('filters packages by search term and parent product', async () => {
    const user = userEvent.setup();

    render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    await user.type(screen.getByPlaceholderText('Tìm mã gói, tên gói hoặc sản phẩm...'), 'Camera');

    await waitFor(() => {
      expect(screen.getAllByText('PKG-IOT-01').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('PKG-HIS-01')).toHaveLength(0);
    });

    await user.clear(screen.getByPlaceholderText('Tìm mã gói, tên gói hoặc sản phẩm...'));
    await user.click(screen.getByRole('button', { name: 'Sản phẩm cha' }));
    expect(screen.getByText(/SP001 - Gói HIS cơ bản/i)).toHaveClass('truncate', 'text-xs');
    await user.click(screen.getByRole('button', { name: /SP001 - Gói HIS cơ bản/i }));

    expect(screen.getAllByText('PKG-HIS-01').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('PKG-IOT-01')).toHaveLength(0);
  });

  it('opens feature catalog, add, edit, and delete actions through the shared modal callback', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={onOpenModal}
        canImport
      />
    );

    await user.click(screen.getAllByTitle('Danh mục tính năng')[0]);
    await user.click(screen.getByRole('button', { name: /Thêm gói cước/i }));
    await user.click(screen.getAllByTitle('Chỉnh sửa')[0]);
    await user.click(screen.getAllByTitle('Xóa')[0]);

    expect(onOpenModal).toHaveBeenNthCalledWith(1, 'PRODUCT_PACKAGE_FEATURE_CATALOG', productPackages[0]);
    expect(onOpenModal).toHaveBeenNthCalledWith(2, 'ADD_PRODUCT_PACKAGE');
    expect(onOpenModal).toHaveBeenNthCalledWith(3, 'EDIT_PRODUCT_PACKAGE', productPackages[0]);
    expect(onOpenModal).toHaveBeenNthCalledWith(4, 'DELETE_PRODUCT_PACKAGE', productPackages[0]);
  });

  it('opens the shared import modal and downloads an import template for product packages', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={onOpenModal}
        canImport
      />
    );

    await user.click(screen.getByRole('button', { name: /Nhập/i }));
    await user.click(screen.getByRole('button', { name: /Nhập dữ liệu/i }));
    expect(onOpenModal).toHaveBeenCalledWith('IMPORT_DATA');

    await user.click(screen.getByRole('button', { name: /Nhập/i }));
    await user.click(screen.getByRole('button', { name: /Tải file mẫu/i }));

    expect(exportSpies.downloadExcelWorkbook).toHaveBeenCalledTimes(1);
    const [fileName, sheets] = exportSpies.downloadExcelWorkbook.mock.calls[0];
    expect(fileName).toBe('mau_nhap_goi_cuoc_san_pham');
    expect(sheets[0].name).toBe('GoiCuoc');
    expect(sheets[0].headers).toContain('Mã gói cước');
    expect(sheets[0].headers).toContain('Mã định danh sản phẩm cha');
    expect(sheets[0].headers).toContain('Đơn giá (Trước VAT)');
    expect(sheets[1].name).toBe('SanPham');
    expect(sheets[1].headers).toContain('Mã định danh');
  });

  it('exports product packages to excel, csv, and pdf', async () => {
    const user = userEvent.setup();

    render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    await user.click(screen.getByRole('button', { name: /Xuất/i }));
    await user.click(screen.getByRole('button', { name: /Excel/i }));
    expect(exportSpies.downloadExcelWorkbook).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Xuất/i }));
    await user.click(screen.getByRole('button', { name: /CSV/i }));
    expect(exportSpies.exportCsv).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Xuất/i }));
    await user.click(screen.getByRole('button', { name: /PDF/i }));
    expect(exportSpies.exportPdfTable).toHaveBeenCalledTimes(1);
  });

  it('renders the compact master rows without the previous wide desktop columns', () => {
    render(
      <ProductPackageList
        productPackages={productPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    expect(screen.getByText('Gói cước')).toBeInTheDocument();
    expect(screen.getAllByText('Sản phẩm cha').length).toBeGreaterThan(0);
    expect(screen.getByText('Giá / ĐVT')).toHaveClass('text-right');
    expect(screen.getByText('Trạng thái')).toBeInTheDocument();
    expect(screen.getAllByText('2.500.000 đ')[0]).toHaveClass('text-right', 'whitespace-nowrap', 'tabular-nums');
    expect(screen.getAllByText('Áp dụng tuyến huyện')[0]).toBeInTheDocument();
    expect(screen.queryByText('Mô tả')).not.toBeInTheDocument();
    expect(screen.getAllByText('PKG-HIS-01')[0]).toHaveClass('text-deep-teal');
  });

  it('paginates compact rows with the default 15 packages per page', async () => {
    const user = userEvent.setup();
    const manyPackages: ProductPackage[] = Array.from({ length: 16 }, (_, index) => ({
      ...productPackages[0],
      id: 100 + index,
      package_code: `PKG-PAGE-${String(index + 1).padStart(2, '0')}`,
      package_name: `Gói phân trang ${index + 1}`,
      description: `Mô tả phân trang ${index + 1}`,
    }));

    render(
      <ProductPackageList
        productPackages={manyPackages}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport
      />
    );

    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getByText('1-15')).toBeInTheDocument();
    expect(screen.queryAllByText('PKG-PAGE-16')).toHaveLength(0);

    await user.click(screen.getByTitle('Trang sau'));

    expect(screen.getAllByText('PKG-PAGE-16').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('PKG-PAGE-01')).toHaveLength(0);
  });
});
