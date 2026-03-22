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
    domain_id: 1,
    vendor_id: 1,
    standard_price: 1000000,
    unit: 'Gói',
    is_active: true,
  },
  {
    id: 2,
    service_group: 'GROUP_B',
    product_code: 'SP-B',
    product_name: 'San pham B',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 2000000,
    unit: 'Gói',
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

  it('puts the service group column first in the import template', async () => {
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
    expect(sheets[0].headers[0]).toBe('Nhóm dịch vụ');
    expect(sheets[1].name).toBe('NhomDichVu');
  });

  it('exports the service group as the first column', async () => {
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

    const [, , headers] = exportSpies.exportExcel.mock.calls[0];
    expect(headers[0]).toBe('Nhóm dịch vụ');
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
});
