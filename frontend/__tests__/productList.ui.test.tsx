import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business, Product, Vendor } from '../types';
import { ProductList } from '../components/ProductList';

const exportSpies = vi.hoisted(() => ({
  downloadExcelWorkbook: vi.fn(),
  exportExcel: vi.fn(),
  exportCsv: vi.fn(),
  exportPdfTable: vi.fn(() => true),
}));

vi.mock('../utils/excelTemplate', () => ({
  downloadExcelWorkbook: exportSpies.downloadExcelWorkbook,
}));

vi.mock('../utils/exportUtils', () => ({
  exportCsv: exportSpies.exportCsv,
  exportExcel: exportSpies.exportExcel,
  exportPdfTable: exportSpies.exportPdfTable,
  isoDateStamp: vi.fn(() => '2026-03-22'),
}));

const businesses: Business[] = [
  { id: 1, uuid: 'b1', domain_code: 'KD001', domain_name: 'Y tế số' },
];

const vendors: Vendor[] = [
  { id: 1, uuid: 'v1', vendor_code: 'NCC001', vendor_name: 'DMS' },
];

const products: Product[] = [
  {
    id: 1,
    service_group: 'GROUP_A',
    product_code: 'SP-A',
    product_name: 'San pham A',
    package_name: 'Goi VNPT HIS 1',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 1000000,
    unit: 'Gói',
    description: 'Mo ta A',
    is_active: true,
  },
  {
    id: 2,
    service_group: 'GROUP_B',
    product_code: 'SP-B',
    product_name: 'San pham B',
    package_name: 'Goi VNPT HIS 2',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 2000000,
    unit: 'Gói',
    description: 'Mo ta B',
    is_active: true,
  },
];

describe('ProductList UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/?tab=products');
  });

  it('filters by service group and syncs the filter to the URL', async () => {
    const user = userEvent.setup();

    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Nhóm dịch vụ' }));
    await user.click(screen.getByRole('button', { name: 'Dịch vụ nhóm A' }));

    expect(screen.getByText('SP-A')).toBeInTheDocument();
    expect(screen.queryByText('SP-B')).not.toBeInTheDocument();
    expect(window.location.search).toContain('products_service_group=GROUP_A');
  });

  it('applies the matching service group filter when a KPI card is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Lọc theo Nhóm B' }));

    expect(screen.getByText('SP-B')).toBeInTheDocument();
    expect(screen.queryByText('SP-A')).not.toBeInTheDocument();
    expect(window.location.search).toContain('products_service_group=GROUP_B');

    await user.click(screen.getByRole('button', { name: 'Lọc theo Nhóm B' }));

    expect(screen.getByText('SP-A')).toBeInTheDocument();
    expect(screen.getByText('SP-B')).toBeInTheDocument();
  });

  it('uses a complete import template for products', async () => {
    const user = userEvent.setup();

    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
        canImport={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /Nhập/i }));
    await user.click(screen.getByRole('button', { name: /Tải file mẫu/i }));

    expect(exportSpies.downloadExcelWorkbook).toHaveBeenCalledTimes(1);
    const [, sheets] = exportSpies.downloadExcelWorkbook.mock.calls[0];
    expect(sheets[0].headers[0]).toBe('Mã nhóm');
    expect(sheets[0].headers).toContain('Gói cước');
    expect(sheets[0].headers).toContain('Trạng thái');
    expect(sheets[0].headers).toContain('Mô tả');
    expect(sheets[0].rows[0][0]).toBe('GROUP_A');
    expect(sheets[0].rows[0][3]).toBe('Gói VNPT HIS 1');
    expect(sheets[0].rows[0][8]).toBe('Hoạt động');
    expect(sheets[1].name).toBe('NhomDichVu');
    expect(sheets[2].name).toBe('TrangThai');
  });

  it('exports an import-ready spreadsheet with full product fields', async () => {
    const user = userEvent.setup();

    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Xuất/i }));
    await user.click(screen.getByRole('button', { name: /Excel/i }));

    await waitFor(() => {
      expect(exportSpies.exportExcel).toHaveBeenCalledTimes(1);
    });

    const [, , headers, rows] = exportSpies.exportExcel.mock.calls[0];
    expect(headers[0]).toBe('Mã nhóm');
    expect(headers).toContain('Gói cước');
    expect(headers).toContain('Mã lĩnh vực');
    expect(headers).toContain('Mã nhà cung cấp');
    expect(headers).toContain('Trạng thái');
    expect(headers).toContain('Mô tả');
    expect(rows[0][0]).toBe('GROUP_A');
    expect(rows[0][4]).toBe('Goi VNPT HIS 1');
    expect(rows[0][5]).toBe('KD001');
    expect(rows[0][7]).toBe('NCC001');
    expect(rows[0][11]).toBe('Hoạt động');
    expect(rows[0][12]).toBe('Mo ta A');
  });

  it('locks fixed widths for service group, product code and price columns', () => {
    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByRole('table')).toHaveClass('table-fixed');
    expect(screen.getByRole('columnheader', { name: /Nhóm dịch vụ/i })).toHaveClass('w-[180px]', 'min-w-[180px]');
    expect(screen.getByRole('columnheader', { name: /Mã SP/i })).toHaveClass('w-[160px]', 'min-w-[160px]');
    expect(screen.getByRole('columnheader', { name: /Đơn giá/i })).toHaveClass('w-[220px]', 'min-w-[220px]');
  });

  it('wraps long product codes inside the fixed column instead of letting text spill into adjacent columns', () => {
    const longCode = 'SMARTCA_NHAN_VIEN_VNPT_SMARTCA_DANH_CHO_BAC_SI_CAN_BO_Y_TE_36_THANG';

    render(
      <ProductList
        products={[
          {
            ...products[0],
            id: 99,
            product_code: longCode,
          },
        ]}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    const productCodeCell = screen.getByText(longCode).closest('td');
    expect(productCodeCell).toHaveClass('overflow-hidden', 'whitespace-normal');
    expect(productCodeCell).not.toHaveClass('whitespace-nowrap');
  });
});
