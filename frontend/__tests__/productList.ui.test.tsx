import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business, Product, Vendor } from '../types';
import { ProductList } from '../components/ProductList';
import type { ProductQuotationDraft } from '../services/v5Api';

const exportSpies = vi.hoisted(() => ({
  downloadExcelWorkbook: vi.fn(),
  exportExcel: vi.fn(),
  exportCsv: vi.fn(),
  exportPdfTable: vi.fn(() => true),
}));

const quotationApiSpies = vi.hoisted(() => ({
  fetchProductQuotationsPage: vi.fn(),
  fetchProductQuotation: vi.fn(),
  fetchProductQuotationVersionsPage: vi.fn(),
  fetchProductQuotationEventsPage: vi.fn(),
  createProductQuotation: vi.fn(),
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

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    fetchProductQuotationsPage: quotationApiSpies.fetchProductQuotationsPage,
    fetchProductQuotation: quotationApiSpies.fetchProductQuotation,
    fetchProductQuotationVersionsPage: quotationApiSpies.fetchProductQuotationVersionsPage,
    fetchProductQuotationEventsPage: quotationApiSpies.fetchProductQuotationEventsPage,
    createProductQuotation: quotationApiSpies.createProductQuotation,
  };
});

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
    description: null,
    is_active: true,
  },
];

const createStorageMock = () => {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

const buildDraftResponse = (overrides: Partial<ProductQuotationDraft> = {}): ProductQuotationDraft => ({
  id: 901,
  uuid: 'quotation-901',
  customer_id: null,
  recipient_name: '',
  sender_city: 'Cần Thơ',
  quote_date: null,
  scope_summary: 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị',
  vat_rate: 10,
  validity_days: 90,
  notes_text: 'Ghi chú mặc định',
  contact_line: 'Liên hệ mặc định',
  closing_message: 'Lời kết mặc định',
  signatory_title: 'GIÁM ĐỐC',
  signatory_unit: 'TRUNG TÂM KINH DOANH GIẢI PHÁP',
  signatory_name: '',
  subtotal: 0,
  vat_amount: 0,
  total_amount: 0,
  total_in_words: '',
  uses_multi_vat_template: false,
  content_hash: 'draft-hash',
  latest_version_no: 0,
  last_printed_at: null,
  last_printed_by: null,
  status: 'DRAFT',
  items: [],
  versions_count: 0,
  events_count: 0,
  created_at: '2026-03-25T10:00:00+07:00',
  updated_at: '2026-03-25T10:00:00+07:00',
  ...overrides,
});

describe('ProductList UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = createStorageMock();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    vi.stubGlobal('localStorage', storage);
    window.history.replaceState({}, '', '/?tab=products');
    quotationApiSpies.fetchProductQuotationsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 1, total: 0, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotation.mockResolvedValue(buildDraftResponse());
    quotationApiSpies.fetchProductQuotationVersionsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 6, total: 0, total_pages: 0 },
    });
    quotationApiSpies.fetchProductQuotationEventsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 8, total: 0, total_pages: 0 },
    });
    quotationApiSpies.createProductQuotation.mockResolvedValue(buildDraftResponse());
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

  it('renders the new product table column order and short service group badge labels', () => {
    const { container } = render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    const headerTexts = Array.from(container.querySelectorAll('thead th')).map((element) =>
      String(element.textContent || '')
        .replace(/unfold_more|arrow_upward/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );

    expect(headerTexts).toEqual([
      'STT',
      'Mã SP',
      'Gói cước',
      'Mô tả',
      'Đơn giá',
      'Nhóm dịch vụ',
      'Tên SP',
      'Lĩnh vực KD',
      'Nhà cung cấp',
      'Đơn vị tính',
      'Trạng thái',
      'Thao tác',
    ]);

    const firstRow = screen.getByText('SP-A').closest('tr');
    expect(firstRow).not.toBeNull();
    expect(firstRow).toHaveTextContent('Nhóm A');
    expect(firstRow).not.toHaveTextContent('Dịch vụ nhóm A');
  });

  it('shows a fallback dash in the description column when a product has no description', () => {
    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    const secondRow = screen.getByText('SP-B').closest('tr');
    expect(secondRow).not.toBeNull();
    expect(secondRow).toHaveTextContent('—');
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

  it('does not render the old badge and title block above the product tabs', () => {
    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.queryByText('Danh mục sản phẩm dịch vụ')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sản phẩm' })).not.toBeInTheDocument();
  });

  it('opens the feature catalog modal action from each product row', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    render(
      <ProductList
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={onOpenModal}
      />
    );

    await user.click(screen.getAllByTitle('Danh mục chức năng')[0]);

    expect(onOpenModal).toHaveBeenCalledWith('PRODUCT_FEATURE_CATALOG', expect.objectContaining({ id: 1 }));
  });

  it('passes currentUserId to the quotation tab so floating settings hydrate per user', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/?tab=products&products_view=quote');
    quotationApiSpies.fetchProductQuotationsPage.mockResolvedValueOnce({
      data: [buildDraftResponse({ id: 91 })],
      meta: { page: 1, per_page: 1, total: 1, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotation.mockResolvedValueOnce(
      buildDraftResponse({
        id: 91,
        scope_summary: 'Nội dung user 91',
        validity_days: 30,
        notes_text: 'Ghi chú user 91',
        contact_line: 'Liên hệ user 91',
        closing_message: 'Lời kết user 91',
        signatory_title: 'TRƯỞNG PHÒNG',
        signatory_unit: 'TRUNG TÂM USER 91',
      })
    );

    render(
      <ProductList
        currentUserId={91}
        products={products}
        businesses={businesses}
        vendors={vendors}
        onOpenModal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cấu hình báo giá/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));

    expect(screen.getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(30);
    expect(screen.getByLabelText(/Nội dung triển khai/i)).toHaveValue('Nội dung user 91');
    expect(screen.getByLabelText(/Dòng liên hệ/i)).toHaveValue('Liên hệ user 91');
    expect(screen.getByLabelText(/Lời kết/i)).toHaveValue('Lời kết user 91');
  });
});
