import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, Product } from '../types';
import { ProductQuotationTab } from '../components/ProductQuotationTab';
import type {
  ProductQuotationDraft,
  ProductQuotationEventRecord,
  ProductQuotationVersionDetailRecord,
  ProductQuotationVersionRecord,
} from '../services/v5Api';

const previewSpies = vi.hoisted(() => ({
  openProductQuotationPreview: vi.fn(),
}));

const quotationApiSpies = vi.hoisted(() => ({
  fetchProductQuotationsPage: vi.fn(),
  fetchProductQuotation: vi.fn(),
  fetchProductQuotationVersionsPage: vi.fn(),
  fetchProductQuotationVersion: vi.fn(),
  fetchProductQuotationEventsPage: vi.fn(),
  createProductQuotation: vi.fn(),
  updateProductQuotation: vi.fn(),
  exportProductQuotationPdf: vi.fn(),
  printStoredProductQuotationWord: vi.fn(),
}));

vi.mock('../utils/productQuotationPreview', () => ({
  openProductQuotationPreview: previewSpies.openProductQuotationPreview,
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    fetchProductQuotationsPage: quotationApiSpies.fetchProductQuotationsPage,
    fetchProductQuotation: quotationApiSpies.fetchProductQuotation,
    fetchProductQuotationVersionsPage: quotationApiSpies.fetchProductQuotationVersionsPage,
    fetchProductQuotationVersion: quotationApiSpies.fetchProductQuotationVersion,
    fetchProductQuotationEventsPage: quotationApiSpies.fetchProductQuotationEventsPage,
    createProductQuotation: quotationApiSpies.createProductQuotation,
    updateProductQuotation: quotationApiSpies.updateProductQuotation,
    exportProductQuotationPdf: quotationApiSpies.exportProductQuotationPdf,
    printStoredProductQuotationWord: quotationApiSpies.printStoredProductQuotationWord,
  };
});

const DEFAULT_NOTES_TEXT = [
  'Giá cước trên đã bao gồm chi phí vận hành cơ bản và các dịch vụ có liên quan.',
  'Giá cước trên chưa bao gồm chi phí tích hợp với các phần mềm khác, tùy chỉnh chức năng đang có, phát triển chức năng mới hoặc chuyển đổi dữ liệu.',
  'Các yêu cầu ngoài phạm vi tiêu chuẩn sẽ được khảo sát và báo giá bổ sung theo khối lượng thực tế.',
  'Báo giá có hiệu lực trong vòng 90 ngày kể từ ngày ký.',
].join('\n');
const DEFAULT_CONTACT_LINE = 'Ông Phan Văn Rở - Giám đốc - Phòng Giải pháp 2 - Trung tâm Kinh doanh Giải pháp, số điện thoại: 0945.200.052./.';
const DEFAULT_CLOSING_MESSAGE = 'Trung tâm Kinh doanh Giải pháp - VNPT Cần Thơ rất mong nhận được sự ủng hộ từ Quý đơn vị và hân hạnh phục vụ!';
const DEFAULT_SIGNATORY_TITLE = 'GIÁM ĐỐC';
const DEFAULT_SIGNATORY_UNIT = 'TRUNG TÂM KINH DOANH GIẢI PHÁP';
const DEFAULT_SIGNATORY_NAME = '';
const DEFAULT_SCOPE_SUMMARY = 'phục vụ triển khai các sản phẩm/dịch vụ theo nhu cầu của Quý đơn vị';
const DEFAULT_VALIDITY_DAYS = '90';

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

const products: Product[] = [
  {
    id: 1,
    product_code: 'HIS_CLOUD',
    product_name: 'VNPT HIS Cloud',
    package_name: 'Gói HIS tiêu chuẩn',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 180000000,
    unit: 'Gói/Năm',
    description: 'Bao gồm triển khai cơ bản',
    is_active: true,
  },
];

const customers: Customer[] = [
  {
    id: 10,
    uuid: 'c-10',
    customer_code: 'KH010',
    customer_name: 'Bệnh viện Đa khoa Cần Thơ',
    tax_code: '1800123456',
    address: 'Ninh Kiều, Cần Thơ',
  },
  {
    id: 11,
    uuid: 'c-11',
    customer_code: 'KH011',
    customer_name: 'Trung tâm Y tế Quận Ninh Kiều',
    tax_code: '1800654321',
    address: 'Ninh Kiều, Cần Thơ',
  },
];

const buildDraftResponse = (overrides: Partial<ProductQuotationDraft> = {}): ProductQuotationDraft => ({
  id: 501,
  uuid: 'quotation-501',
  customer_id: null,
  recipient_name: '',
  sender_city: 'Cần Thơ',
  quote_date: null,
  scope_summary: DEFAULT_SCOPE_SUMMARY,
  vat_rate: 10,
  validity_days: 90,
  notes_text: DEFAULT_NOTES_TEXT,
  contact_line: DEFAULT_CONTACT_LINE,
  closing_message: DEFAULT_CLOSING_MESSAGE,
  signatory_title: DEFAULT_SIGNATORY_TITLE,
  signatory_unit: DEFAULT_SIGNATORY_UNIT,
  signatory_name: DEFAULT_SIGNATORY_NAME,
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

const buildVersionResponse = (overrides: Partial<ProductQuotationVersionRecord> = {}): ProductQuotationVersionRecord => ({
  id: 701,
  quotation_id: 501,
  version_no: 3,
  template_key: 'default',
  status: 'SUCCESS',
  filename: 'Báo giá Bệnh viện Đa khoa Cần Thơ 2026 03 25.docx',
  quote_date: '2026-03-25',
  recipient_name: 'Bệnh viện Đa khoa Cần Thơ',
  subtotal: 180000000,
  vat_amount: 18000000,
  total_amount: 198000000,
  content_hash: 'version-hash-001',
  printed_at: '2026-03-25T10:30:00+07:00',
  printed_by: 15,
  created_at: '2026-03-25T10:30:00+07:00',
  ...overrides,
});

const buildEventResponse = (overrides: Partial<ProductQuotationEventRecord> = {}): ProductQuotationEventRecord => ({
  id: 801,
  quotation_id: 501,
  version_id: 701,
  version_no: 3,
  event_type: 'PRINT_CONFIRMED',
  event_status: 'SUCCESS',
  template_key: 'default',
  filename: 'Báo giá Bệnh viện Đa khoa Cần Thơ 2026 03 25.docx',
  content_hash: 'event-hash-001',
  metadata: {
    filename: 'Báo giá Bệnh viện Đa khoa Cần Thơ 2026 03 25.docx',
  },
  url: 'http://localhost/api/v5/products/quotations/501/print-word',
  ip_address: '127.0.0.1',
  user_agent: 'Vitest',
  created_by: 15,
  created_at: '2026-03-25T10:30:00+07:00',
  ...overrides,
});

const buildVersionDetailResponse = (
  overrides: Partial<ProductQuotationVersionDetailRecord> = {}
): ProductQuotationVersionDetailRecord => ({
  ...buildVersionResponse(),
  sender_city: 'Cần Thơ',
  scope_summary: 'Triển khai theo nhu cầu của đơn vị',
  vat_rate: 10,
  validity_days: 90,
  notes_text: 'Dòng 1\nDòng 2',
  contact_line: 'Ông Phan Văn Rở',
  closing_message: 'Rất mong hợp tác',
  signatory_title: 'GIÁM ĐỐC',
  signatory_unit: 'TRUNG TÂM KINH DOANH GIẢI PHÁP',
  signatory_name: 'Phan Văn Rở',
  total_in_words: 'Một trăm chín mươi tám triệu đồng',
  uses_multi_vat_template: false,
  metadata: { source: 'confirmed_print' },
  items: [
    {
      id: 1,
      sort_order: 1,
      product_id: 1,
      product_name: 'VNPT HIS Cloud',
      unit: 'Gói/Năm',
      quantity: 1,
      unit_price: 180000000,
      vat_rate: 10,
      vat_amount: 18000000,
      line_total: 180000000,
      total_with_vat: 198000000,
      note: 'Gói HIS tiêu chuẩn\nBao gồm triển khai cơ bản',
    },
  ],
  ...overrides,
});

const renderProductQuotationTab = async (props: React.ComponentProps<typeof ProductQuotationTab> = {}) => {
  render(<ProductQuotationTab customers={customers} products={products} onNotify={vi.fn()} {...props} />);
  await screen.findByRole('button', { name: /Cấu hình báo giá/i });
};

const seedSavedQuotation = (
  listOverrides: Partial<ProductQuotationDraft> = {},
  detailOverrides: Partial<ProductQuotationDraft> = {}
) => {
  const savedDraft = buildDraftResponse({
    id: 501,
    recipient_name: 'Bệnh viện Đa khoa Cần Thơ',
    ...listOverrides,
  });

  quotationApiSpies.fetchProductQuotationsPage.mockResolvedValue({
    data: [savedDraft],
    meta: { page: 1, per_page: 200, total: 1, total_pages: 1 },
  });
  quotationApiSpies.fetchProductQuotation.mockResolvedValue(
    buildDraftResponse({
      id: savedDraft.id,
      recipient_name: savedDraft.recipient_name,
      ...detailOverrides,
    })
  );
};

const searchAndSelectCustomer = async (user: ReturnType<typeof userEvent.setup>, searchText: string, optionName: string) => {
  await user.click(screen.getByRole('button', { name: /Chọn khách hàng/i }));
  await user.type(await screen.findByLabelText('Tìm khách hàng...'), searchText);
  await user.click(await screen.findByRole('button', { name: optionName }));
};

const openSavedQuotation = async (
  user: ReturnType<typeof userEvent.setup>,
  optionName = 'Bệnh viện Đa khoa Cần Thơ'
) => {
  const optionPattern = new RegExp(optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  await user.click(screen.getByRole('button', { name: /Mở báo giá cũ/i }));
  await user.click(await screen.findByRole('button', { name: optionPattern }));
};

describe('ProductQuotationTab UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = createStorageMock();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-download'),
      revokeObjectURL: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = vi.fn();
    quotationApiSpies.fetchProductQuotationsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 1, total: 0, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotation.mockResolvedValue(buildDraftResponse());
    quotationApiSpies.fetchProductQuotationVersionsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 6, total: 0, total_pages: 0 },
    });
    quotationApiSpies.fetchProductQuotationVersion.mockResolvedValue(buildVersionDetailResponse());
    quotationApiSpies.fetchProductQuotationEventsPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
    });
    quotationApiSpies.createProductQuotation.mockResolvedValue(buildDraftResponse());
    quotationApiSpies.updateProductQuotation.mockImplementation(async (_id: number, payload: Record<string, unknown>) =>
      buildDraftResponse({
        recipient_name: String(payload.recipient_name || ''),
        customer_id: typeof payload.customer_id === 'number' ? payload.customer_id : null,
        scope_summary: String(payload.scope_summary || DEFAULT_SCOPE_SUMMARY),
        validity_days: Number(payload.validity_days || 90),
        notes_text: String(payload.notes_text || DEFAULT_NOTES_TEXT),
        contact_line: String(payload.contact_line || DEFAULT_CONTACT_LINE),
        closing_message: String(payload.closing_message || DEFAULT_CLOSING_MESSAGE),
        signatory_title: String(payload.signatory_title || DEFAULT_SIGNATORY_TITLE),
        signatory_unit: String(payload.signatory_unit || DEFAULT_SIGNATORY_UNIT),
        signatory_name: String(payload.signatory_name || DEFAULT_SIGNATORY_NAME),
        items: Array.isArray(payload.items)
          ? payload.items.map((item, index) => ({
              id: index + 1,
              sort_order: index + 1,
              product_id: typeof item?.product_id === 'number' ? item.product_id : null,
              product_name: String(item?.product_name || ''),
              unit: String(item?.unit || ''),
              quantity: Number(item?.quantity || 0),
              unit_price: Number(item?.unit_price || 0),
              vat_rate: typeof item?.vat_rate === 'number' ? item.vat_rate : null,
              vat_amount: 0,
              line_total: Number(item?.quantity || 0) * Number(item?.unit_price || 0),
              total_with_vat: 0,
              note: String(item?.note || ''),
            }))
          : [],
      })
    );
    quotationApiSpies.exportProductQuotationPdf.mockResolvedValue({
      blob: new Blob(['pdf-preview'], { type: 'application/pdf' }),
      filename: 'bao_gia_test.pdf',
    });
    quotationApiSpies.printStoredProductQuotationWord.mockResolvedValue({
      blob: new Blob(['word-preview'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      filename: 'bao_gia_test.docx',
    });
    previewSpies.openProductQuotationPreview.mockResolvedValue(true);
  });

  it('renders a blank quotation form on mount and does not auto-load the latest draft', async () => {
    await renderProductQuotationTab();

    expect(quotationApiSpies.fetchProductQuotationsPage).toHaveBeenCalledWith({
      page: 1,
      per_page: 200,
      sort_by: 'updated_at',
      sort_dir: 'desc',
    });
    expect(quotationApiSpies.fetchProductQuotation).not.toHaveBeenCalled();
    expect(quotationApiSpies.createProductQuotation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Mở báo giá cũ/i })).toHaveTextContent('Mở báo giá cũ');
    expect(screen.getByText('Form trắng')).toBeInTheDocument();
    expect(screen.getByText(/Chưa chọn báo giá nào. Hãy bấm "Thêm báo giá" hoặc mở báo giá cũ./i)).toBeInTheDocument();
  });

  it('renders saved quotations in updated order and hydrates the selected draft from the dropdown', async () => {
    const user = userEvent.setup();
    quotationApiSpies.fetchProductQuotationsPage.mockResolvedValue({
      data: [
        buildDraftResponse({
          id: 91,
          recipient_name: 'Bệnh viện Phổi Hậu Giang',
          updated_at: '2026-03-26T09:00:00+07:00',
          total_amount: 300000000,
        }),
        buildDraftResponse({
          id: 77,
          recipient_name: 'Bệnh viện Đa khoa Cần Thơ',
          updated_at: '2026-03-25T10:00:00+07:00',
          total_amount: 198000000,
        }),
      ],
      meta: { page: 1, per_page: 200, total: 2, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotation.mockResolvedValue(
      buildDraftResponse({
        id: 91,
        recipient_name: 'Bệnh viện Phổi Hậu Giang',
        validity_days: 45,
        closing_message: 'Lời kết đã lưu cho Hậu Giang',
      })
    );

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Mở báo giá cũ/i }));
    const quotationOptions = screen.getAllByRole('button', {
      name: /Bệnh viện (Phổi Hậu Giang|Đa khoa Cần Thơ)/i,
    });
    expect(quotationOptions[0]).toHaveTextContent('Bệnh viện Phổi Hậu Giang');
    expect(quotationOptions[1]).toHaveTextContent('Bệnh viện Đa khoa Cần Thơ');

    await user.click(quotationOptions[0]);

    await waitFor(() => {
      expect(quotationApiSpies.fetchProductQuotation).toHaveBeenCalledWith(91);
      expect(screen.getByRole('button', { name: /Mở báo giá cũ/i })).toHaveTextContent('Bệnh viện Phổi Hậu Giang');
    });
    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));
    const drawer = screen.getByTestId('quotation-settings-drawer');
    expect(within(drawer).getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(45);
    expect(within(drawer).getByLabelText(/Lời kết/i)).toHaveValue('Lời kết đã lưu cho Hậu Giang');
  });

  it('resets back to a blank form when clicking Thêm báo giá from a saved quotation', async () => {
    const user = userEvent.setup();
    seedSavedQuotation(
      { id: 77, recipient_name: 'Bệnh viện Đa khoa Cần Thơ' },
      { id: 77, recipient_name: 'Bệnh viện Đa khoa Cần Thơ', validity_days: 60 }
    );

    await renderProductQuotationTab();
    await openSavedQuotation(user);

    expect(screen.getByRole('button', { name: /Mở báo giá cũ/i })).toHaveTextContent('Bệnh viện Đa khoa Cần Thơ');
    await user.click(screen.getByRole('button', { name: /Thêm báo giá/i }));

    expect(screen.getByRole('button', { name: /Mở báo giá cũ/i })).toHaveTextContent('Mở báo giá cũ');
    expect(screen.getByText('Form trắng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chọn khách hàng/i })).toHaveTextContent('Chọn khách hàng');
  });

  it('creates a new quotation lazily from the blank form and refreshes the old quotation dropdown', async () => {
    const user = userEvent.setup();
    quotationApiSpies.fetchProductQuotationsPage
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, per_page: 200, total: 0, total_pages: 1 },
      })
      .mockResolvedValueOnce({
        data: [buildDraftResponse({ id: 501, recipient_name: 'Bệnh viện Đa khoa Cần Thơ' })],
        meta: { page: 1, per_page: 200, total: 1, total_pages: 1 },
      });
    previewSpies.openProductQuotationPreview.mockImplementation(async ({ loadPdf }) => {
      await loadPdf();
      return true;
    });

    await renderProductQuotationTab();

    await searchAndSelectCustomer(user, 'Đa khoa', 'Bệnh viện Đa khoa Cần Thơ');
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    await waitFor(() => {
      expect(quotationApiSpies.createProductQuotation).toHaveBeenCalledTimes(1);
      expect(quotationApiSpies.fetchProductQuotationsPage).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole('button', { name: /Mở báo giá cũ/i })).toHaveTextContent('Bệnh viện Đa khoa Cần Thơ');
  });

  it('renders version history and audit history from backend', async () => {
    const user = userEvent.setup();
    seedSavedQuotation();
    quotationApiSpies.fetchProductQuotationVersionsPage.mockResolvedValueOnce({
      data: [buildVersionResponse()],
      meta: { page: 1, per_page: 6, total: 1, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotationEventsPage.mockResolvedValueOnce({
      data: [buildEventResponse()],
      meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
    });

    await renderProductQuotationTab();
    await openSavedQuotation(user);

    expect(await screen.findByTestId('quotation-history-section')).toBeInTheDocument();
    expect(screen.getByText('Phiên bản in')).toBeInTheDocument();
    expect(screen.getByText('Nhật ký audit')).toBeInTheDocument();
    expect(screen.getByText(/v3 gần nhất/i)).toBeInTheDocument();
    expect(screen.getAllByText('Báo giá Bệnh viện Đa khoa Cần Thơ 2026 03 25.docx').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Xác nhận in').length).toBeGreaterThan(0);
    expect(screen.getByText('1 phiên bản')).toBeInTheDocument();
    expect(screen.getByText('1 audit')).toBeInTheDocument();
  });

  it('refreshes history after a successful confirmed print', async () => {
    const user = userEvent.setup();
    quotationApiSpies.fetchProductQuotationVersionsPage.mockResolvedValue({
      data: [buildVersionResponse({ version_no: 1 })],
      meta: { page: 1, per_page: 6, total: 1, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotationEventsPage.mockResolvedValue({
      data: [buildEventResponse({ version_no: 1 })],
      meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
    });

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn khách hàng/i }));
    await user.click(screen.getByRole('button', { name: 'Bệnh viện Đa khoa Cần Thơ' }));
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^In báo giá$/i }));
    await user.click(screen.getByRole('button', { name: /Xác nhận in/i }));

    await waitFor(() => {
      expect(quotationApiSpies.printStoredProductQuotationWord).toHaveBeenCalledTimes(1);
      expect(quotationApiSpies.fetchProductQuotationVersionsPage).toHaveBeenCalledTimes(2);
      expect(quotationApiSpies.fetchProductQuotationEventsPage).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/v1 gần nhất/i)).toBeInTheDocument();
    expect(screen.getAllByText('Xác nhận in').length).toBeGreaterThan(0);
  });

  it('opens a modal to show version detail for a selected version', async () => {
    const user = userEvent.setup();
    seedSavedQuotation();
    quotationApiSpies.fetchProductQuotationVersionsPage.mockResolvedValueOnce({
      data: [buildVersionResponse({ id: 712, version_no: 4 })],
      meta: { page: 1, per_page: 6, total: 1, total_pages: 1 },
    });
    quotationApiSpies.fetchProductQuotationVersion.mockResolvedValueOnce(
      buildVersionDetailResponse({
        id: 712,
        version_no: 4,
        items: [
          {
            id: 2,
            sort_order: 1,
            product_id: 1,
            product_name: 'VNPT HIS Cloud',
            unit: 'Gói/Năm',
            quantity: 2,
            unit_price: 180000000,
            vat_rate: 10,
            vat_amount: 36000000,
            line_total: 360000000,
            total_with_vat: 396000000,
            note: 'Gói HIS tiêu chuẩn',
          },
        ],
      })
    );

    await renderProductQuotationTab();
    await openSavedQuotation(user);
    const versionHistory = screen.getByTestId('quotation-version-history');

    await user.click(await within(versionHistory).findByRole('button', { name: /Xem chi tiết/i }));

    expect(quotationApiSpies.fetchProductQuotationVersion).toHaveBeenCalledWith(501, 712);
    expect(await screen.findByTestId('quotation-version-detail-modal')).toBeInTheDocument();
    expect(screen.getByText(/Chi tiết version v4/i)).toBeInTheDocument();
    expect(screen.getAllByText('VNPT HIS Cloud').length).toBeGreaterThan(0);
    expect(screen.getByText('Phan Văn Rở')).toBeInTheDocument();
  });

  it('filters audit history by group', async () => {
    const user = userEvent.setup();
    seedSavedQuotation();
    quotationApiSpies.fetchProductQuotationEventsPage.mockResolvedValueOnce({
      data: [
        buildEventResponse({ id: 1, event_type: 'PRINT_CONFIRMED' }),
        buildEventResponse({ id: 2, event_type: 'DRAFT_CREATED', version_id: null, version_no: null, filename: null }),
        buildEventResponse({ id: 3, event_type: 'DRAFT_UPDATED', version_id: null, version_no: null, filename: null }),
      ],
      meta: { page: 1, per_page: 20, total: 3, total_pages: 1 },
    });

    await renderProductQuotationTab();
    await openSavedQuotation(user);
    const auditSection = screen.getByTestId('quotation-audit-history');
    const getEventList = async () => within(await within(auditSection).findByTestId('quotation-audit-event-list'));

    expect(await (await getEventList()).findByText('Xác nhận in')).toBeInTheDocument();

    await user.click(within(auditSection).getByRole('button', { name: /^Tạo nháp$/i }));
    expect((await getEventList()).getAllByText('Tạo nháp').length).toBeGreaterThan(0);
    expect((await getEventList()).queryByText('Cập nhật nháp')).not.toBeInTheDocument();

    await user.click(within(auditSection).getByRole('button', { name: /^In$/i }));
    expect((await getEventList()).getAllByText('Xác nhận in').length).toBeGreaterThan(0);
    expect((await getEventList()).queryByText('Cập nhật nháp')).not.toBeInTheDocument();
  });

  it('auto-fills unit price, unit and note when a product is selected from the catalog', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    expect(screen.getByDisplayValue('Gói/Năm')).toBeInTheDocument();
    expect(screen.getByDisplayValue('180.000.000')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue((value) =>
        value.includes('Gói HIS tiêu chuẩn') && value.includes('Bao gồm triển khai cơ bản')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('180.000.000')).toBeInTheDocument();
  });

  it('formats quantity with thousand separators and comma decimals before exporting', async () => {
    const user = userEvent.setup();
    previewSpies.openProductQuotationPreview.mockImplementation(async ({ loadPdf }) => {
      await loadPdf();
      return true;
    });

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn khách hàng/i }));
    await user.click(screen.getByRole('button', { name: 'Bệnh viện Đa khoa Cần Thơ' }));
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    const quantityInput = screen.getByDisplayValue('1');
    await user.clear(quantityInput);
    await user.type(quantityInput, '1234,75');

    expect(screen.getByDisplayValue('1.234,75')).toBeInTheDocument();
    expect(screen.getAllByText('222.255.000.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Hai trăm bốn mươi tư tỷ, bốn trăm tám mươi triệu, năm trăm nghìn đồng')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    await waitFor(() => {
      expect(quotationApiSpies.exportProductQuotationPdf).toHaveBeenCalledTimes(1);
    });

    expect(quotationApiSpies.exportProductQuotationPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            quantity: 1234.75,
          }),
        ],
      })
    );
  });

  it('renders product search results with package, description and price in a portal dropdown', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.type(screen.getByLabelText('Tìm kiếm...'), '180000000');

    const option = screen.getByRole('button', { name: /VNPT HIS Cloud/i });
    expect(option).toHaveTextContent('Gói cước: Gói HIS tiêu chuẩn');
    expect(option).toHaveTextContent('Bao gồm triển khai cơ bản');
    expect(option).toHaveTextContent('180.000.000 đ');
    expect(option.closest('td')).toBeNull();

    await user.clear(screen.getByLabelText('Tìm kiếm...'));
    await user.type(screen.getByLabelText('Tìm kiếm...'), 'tiêu chuẩn');
    expect(screen.getByRole('button', { name: /VNPT HIS Cloud/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Tìm kiếm...'));
    await user.type(screen.getByLabelText('Tìm kiếm...'), 'triển khai cơ bản');
    expect(screen.getByRole('button', { name: /VNPT HIS Cloud/i })).toBeInTheDocument();
  });

  it('renders VAT before line total and keeps the item name column wider than TT', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent?.trim());
    expect(headers).toEqual([
      'TT',
      'Hạng mục công việc',
      'Đơn vị tính',
      'Số lượng',
      'Đơn giá',
      'Thuế VAT',
      'Thành tiền',
      'Ghi chú',
      'Tác vụ',
    ]);

    expect(screen.getByLabelText(/Thuế VAT dòng 1/i)).toHaveValue('10');
    expect(screen.getByText('180.000.000')).toBeInTheDocument();
  });

  it('allows editing VAT by row without changing the on-screen totals and still sends the row VAT in export payload', async () => {
    const user = userEvent.setup();
    previewSpies.openProductQuotationPreview.mockImplementation(async ({ loadPdf }) => {
      await loadPdf();
      return true;
    });

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn khách hàng/i }));
    await user.click(screen.getByRole('button', { name: 'Bệnh viện Đa khoa Cần Thơ' }));
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    const vatInput = screen.getByLabelText(/Thuế VAT dòng 1/i);
    await user.clear(vatInput);
    await user.type(vatInput, '8');

    const summary = screen.getByTestId('quote-table-summary');
    expect(within(summary).getByText('180.000.000 đ')).toBeInTheDocument();
    expect(within(summary).getByText('18.000.000 đ')).toBeInTheDocument();
    expect(within(summary).getByText('198.000.000 đ')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    await waitFor(() => {
      expect(quotationApiSpies.exportProductQuotationPdf).toHaveBeenCalledTimes(1);
    });

    expect(quotationApiSpies.exportProductQuotationPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        vat_rate: 10,
        items: [
          expect.objectContaining({
            vat_rate: 8,
          }),
        ],
      })
    );
  });

  it('replaces the inline configuration cards with a floating settings button and right drawer', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    expect(screen.queryByLabelText(/Số ngày hiệu lực/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nội dung triển khai/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ghi chú và điều kiện/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Liên hệ và ký tên/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));

    const drawer = screen.getByTestId('quotation-settings-drawer');
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(90);
    expect(within(drawer).getByLabelText(/Nội dung triển khai/i)).toHaveValue(DEFAULT_SCOPE_SUMMARY);
    expect(within(drawer).getByLabelText(/Ghi chú chi tiết/i)).toHaveValue(DEFAULT_NOTES_TEXT);
    expect(within(drawer).getByLabelText(/Dòng liên hệ/i)).toHaveValue(DEFAULT_CONTACT_LINE);
    expect(within(drawer).getByLabelText(/Lời kết/i)).toHaveValue(DEFAULT_CLOSING_MESSAGE);
    expect(within(drawer).getByLabelText(/Chức danh ký/i)).toHaveValue(DEFAULT_SIGNATORY_TITLE);
    expect(within(drawer).getByLabelText(/Đơn vị ký/i)).toHaveValue(DEFAULT_SIGNATORY_UNIT);
    expect(within(drawer).getByLabelText(/Tên giám đốc/i)).toHaveValue(DEFAULT_SIGNATORY_NAME);
  });

  it('discards drawer draft changes when canceled', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));
    const drawer = screen.getByTestId('quotation-settings-drawer');
    const closingMessageField = within(drawer).getByLabelText(/Lời kết/i);
    const validityDaysField = within(drawer).getByLabelText(/Số ngày hiệu lực/i);

    await user.clear(closingMessageField);
    await user.type(closingMessageField, 'Lời kết nháp chưa lưu');
    await user.clear(validityDaysField);
    await user.type(validityDaysField, '45');
    await user.click(within(drawer).getByRole('button', { name: /^Hủy$/i }));

    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));
    const reopenedDrawer = screen.getByTestId('quotation-settings-drawer');
    expect(within(reopenedDrawer).getByLabelText(/Lời kết/i)).toHaveValue(DEFAULT_CLOSING_MESSAGE);
    expect(within(reopenedDrawer).getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(90);
  });

  it('hydrates saved settings from database and can restore defaults before saving', async () => {
    const user = userEvent.setup();
    seedSavedQuotation(
      { id: 77, recipient_name: 'Bệnh viện Đa khoa Cần Thơ' },
      {
        id: 77,
        scope_summary: 'Triển khai theo gói user 77',
        validity_days: 60,
        notes_text: 'Ghi chú đã lưu',
        contact_line: 'Liên hệ đã lưu',
        closing_message: 'Lời kết đã lưu',
        signatory_title: 'PHÓ GIÁM ĐỐC',
        signatory_unit: 'TRUNG TÂM KINH DOANH 2',
        signatory_name: 'Nguyễn Văn C',
      }
    );

    await renderProductQuotationTab({ currentUserId: 77 });
    await openSavedQuotation(user);

    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));
    const drawer = screen.getByTestId('quotation-settings-drawer');
    expect(within(drawer).getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(60);
    expect(within(drawer).getByLabelText(/Nội dung triển khai/i)).toHaveValue('Triển khai theo gói user 77');
    expect(within(drawer).getByLabelText(/Ghi chú chi tiết/i)).toHaveValue('Ghi chú đã lưu');
    expect(within(drawer).getByLabelText(/Dòng liên hệ/i)).toHaveValue('Liên hệ đã lưu');
    expect(within(drawer).getByLabelText(/Tên giám đốc/i)).toHaveValue('Nguyễn Văn C');

    await user.click(within(drawer).getByRole('button', { name: /Khôi phục mặc định/i }));

    expect(within(drawer).getByLabelText(/Số ngày hiệu lực/i)).toHaveValue(90);
    expect(within(drawer).getByLabelText(/Nội dung triển khai/i)).toHaveValue(DEFAULT_SCOPE_SUMMARY);
    expect(within(drawer).getByLabelText(/Ghi chú chi tiết/i)).toHaveValue(DEFAULT_NOTES_TEXT);
    expect(within(drawer).getByLabelText(/Dòng liên hệ/i)).toHaveValue(DEFAULT_CONTACT_LINE);
    expect(within(drawer).getByLabelText(/Lời kết/i)).toHaveValue(DEFAULT_CLOSING_MESSAGE);
    expect(within(drawer).getByLabelText(/Chức danh ký/i)).toHaveValue(DEFAULT_SIGNATORY_TITLE);
    expect(within(drawer).getByLabelText(/Đơn vị ký/i)).toHaveValue(DEFAULT_SIGNATORY_UNIT);
    expect(within(drawer).getByLabelText(/Tên giám đốc/i)).toHaveValue(DEFAULT_SIGNATORY_NAME);

    await user.click(within(drawer).getByRole('button', { name: /^Lưu$/i }));

    await waitFor(() => {
      expect(quotationApiSpies.updateProductQuotation).toHaveBeenCalled();
    });
    expect(window.localStorage.getItem).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(quotationApiSpies.updateProductQuotation).toHaveBeenCalledWith(
        77,
        expect.objectContaining({
          scope_summary: DEFAULT_SCOPE_SUMMARY,
          validity_days: 90,
          notes_text: DEFAULT_NOTES_TEXT,
          contact_line: DEFAULT_CONTACT_LINE,
          closing_message: DEFAULT_CLOSING_MESSAGE,
          signatory_title: DEFAULT_SIGNATORY_TITLE,
          signatory_unit: DEFAULT_SIGNATORY_UNIT,
          signatory_name: DEFAULT_SIGNATORY_NAME,
        })
      );
    });
  });

  it('opens quotation preview with the selected payload and saved drawer settings', async () => {
    const user = userEvent.setup();
    previewSpies.openProductQuotationPreview.mockImplementation(async ({ loadPdf }) => {
      await loadPdf();
      return true;
    });

    await renderProductQuotationTab({ currentUserId: 15 });

    await user.click(screen.getByRole('button', { name: /Cấu hình báo giá/i }));
    const drawer = screen.getByTestId('quotation-settings-drawer');
    const closingMessageField = within(drawer).getByLabelText(/Lời kết/i);
    const contactLineField = within(drawer).getByLabelText(/Dòng liên hệ/i);
    const validityDaysField = within(drawer).getByLabelText(/Số ngày hiệu lực/i);
    const scopeSummaryField = within(drawer).getByLabelText(/Nội dung triển khai/i);
    const signatoryNameField = within(drawer).getByLabelText(/Tên giám đốc/i);

    await user.clear(closingMessageField);
    await user.type(closingMessageField, 'Lời kết đã cấu hình qua drawer');
    await user.clear(contactLineField);
    await user.type(contactLineField, 'Ông Nguyễn Văn B - 0909.000.111');
    await user.clear(validityDaysField);
    await user.type(validityDaysField, '45');
    await user.clear(scopeSummaryField);
    await user.type(scopeSummaryField, 'triển khai hệ thống theo phạm vi đã khảo sát');
    await user.clear(signatoryNameField);
    await user.type(signatoryNameField, 'Phan Văn Rở');
    await user.click(within(drawer).getByRole('button', { name: /^Lưu$/i }));

    await searchAndSelectCustomer(user, 'Đa khoa', 'Bệnh viện Đa khoa Cần Thơ');
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    await waitFor(() => {
      expect(previewSpies.openProductQuotationPreview).toHaveBeenCalledTimes(1);
    });

    expect(quotationApiSpies.exportProductQuotationPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_name: 'Bệnh viện Đa khoa Cần Thơ',
        scope_summary: 'triển khai hệ thống theo phạm vi đã khảo sát',
        validity_days: 45,
        contact_line: 'Ông Nguyễn Văn B - 0909.000.111',
        closing_message: 'Lời kết đã cấu hình qua drawer',
        signatory_name: 'Phan Văn Rở',
        items: [
          expect.objectContaining({
            product_id: 1,
            product_name: 'VNPT HIS Cloud',
            unit: 'Gói/Năm',
            quantity: 1,
            unit_price: 180000000,
            vat_rate: 10,
          }),
        ],
      })
    );

    expect(previewSpies.openProductQuotationPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Xem báo giá',
        loadPdf: expect.any(Function),
      })
    );

    const payload = quotationApiSpies.exportProductQuotationPdf.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty('quote_date');
    await waitFor(() => {
      expect(quotationApiSpies.updateProductQuotation).toHaveBeenCalled();
    });
    expect(quotationApiSpies.updateProductQuotation).toHaveBeenLastCalledWith(
      501,
      expect.objectContaining({
        scope_summary: 'triển khai hệ thống theo phạm vi đã khảo sát',
        validity_days: 45,
        contact_line: 'Ông Nguyễn Văn B - 0909.000.111',
        closing_message: 'Lời kết đã cấu hình qua drawer',
        signatory_name: 'Phan Văn Rở',
      })
    );
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  }, 10000);

  it('opens a print confirm modal and only prints after confirmation', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await searchAndSelectCustomer(user, 'Ninh Kiều', 'Trung tâm Y tế Quận Ninh Kiều');
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^In báo giá$/i }));

    expect(screen.getByRole('dialog', { name: /Xác nhận in báo giá/i })).toBeInTheDocument();
    expect(screen.getByText(/Bạn vui lòng bấm xác nhận in/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Huỷ không in/i }));
    expect(quotationApiSpies.printStoredProductQuotationWord).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^In báo giá$/i }));
    await user.click(screen.getByRole('button', { name: /Xác nhận in/i }));

    await waitFor(() => {
      expect(quotationApiSpies.printStoredProductQuotationWord).toHaveBeenCalledTimes(1);
    });
    expect(quotationApiSpies.printStoredProductQuotationWord).toHaveBeenCalledWith(501);
  });

  it('downloads the Word quotation file from the confirmed print option', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await searchAndSelectCustomer(user, 'Ninh Kiều', 'Trung tâm Y tế Quận Ninh Kiều');
    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    expect(screen.queryByRole('button', { name: /^Xuất Word$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Xuất Excel$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^In báo giá$/i }));
    await user.click(screen.getByRole('button', { name: /Xác nhận in/i }));

    await waitFor(() => {
      expect(quotationApiSpies.printStoredProductQuotationWord).toHaveBeenCalledTimes(1);
    });

    expect(quotationApiSpies.printStoredProductQuotationWord).toHaveBeenCalledWith(501);
    expect(previewSpies.openProductQuotationPreview).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('blocks preview when recipient is empty and reports a validation error', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    await renderProductQuotationTab({ onNotify });

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));
    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    expect(previewSpies.openProductQuotationPreview).not.toHaveBeenCalled();
    expect(quotationApiSpies.exportProductQuotationPdf).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Báo giá',
      'Vui lòng chọn thông tin "Kính gửi" trước khi xuất file.'
    );
  });

  it('blocks export when rows duplicate the same work item and unit price combination', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();

    await renderProductQuotationTab({ onNotify });

    await user.click(screen.getByRole('button', { name: /Chọn khách hàng/i }));
    await user.click(screen.getByRole('button', { name: 'Bệnh viện Đa khoa Cần Thơ' }));

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    await user.click(screen.getByRole('button', { name: /Thêm dòng/i }));
    await user.click(screen.getAllByRole('button', { name: /Chọn sản phẩm từ danh mục/i })[1]);
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    expect(screen.getAllByText('Trùng hạng mục với cùng đơn giá.')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Xuất báo giá/i }));
    await user.click(screen.getByRole('button', { name: /^Xem báo giá$/i }));

    expect(previewSpies.openProductQuotationPreview).not.toHaveBeenCalled();
    expect(quotationApiSpies.exportProductQuotationPdf).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Báo giá',
      'Không được trùng hạng mục công việc với cùng đơn giá trong một báo giá.'
    );
  });

  it('renders total amount in Vietnamese with accents', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    expect(screen.getByText('Một trăm chín mươi tám triệu đồng')).toBeInTheDocument();
  });

  it('renders sticky table headers, quick summary and the new floating settings trigger', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    expect(screen.getByTestId('quotation-settings-fab')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Chọn sản phẩm từ danh mục/i }));
    await user.click(screen.getByRole('button', { name: /VNPT HIS Cloud/i }));

    expect(screen.getByRole('columnheader', { name: /Hạng mục công việc/i })).toHaveClass('sticky', 'top-0');

    const summary = screen.getByTestId('quote-table-summary');
    expect(within(summary).getByText(/Tiền trước VAT/i)).toBeInTheDocument();
    expect(within(summary).getByText('180.000.000 đ')).toBeInTheDocument();
    expect(within(summary).getByText('18.000.000 đ')).toBeInTheDocument();
    expect(within(summary).getByText('198.000.000 đ')).toBeInTheDocument();
    expect(within(summary).getByText('Một trăm chín mươi tám triệu đồng')).toBeInTheDocument();
    expect(screen.getByTestId('quote-summary-metrics')).toHaveClass('flex', 'flex-wrap');
    expect(within(summary).getByText('180.000.000 đ')).toHaveClass('whitespace-nowrap');
  });

  it('selects recipient from the customer searchable select', async () => {
    const user = userEvent.setup();

    await renderProductQuotationTab();

    await searchAndSelectCustomer(user, 'Ninh Kiều', 'Trung tâm Y tế Quận Ninh Kiều');

    expect(screen.getByRole('button', { name: /Chọn khách hàng/i })).toHaveTextContent('Trung tâm Y tế Quận Ninh Kiều');
  });
});
