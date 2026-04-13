import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuotationPickerModal } from '../components/modals/QuotationPickerModal';
import type { ProductQuotationDraft, ProductQuotationDraftListItem } from '../services/api/productApi';
import type { Product, ProjectItem } from '../types';

const fetchProductQuotationsPageMock = vi.hoisted(() => vi.fn());
const fetchProductQuotationMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api/productApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/productApi')>(
    '../services/api/productApi'
  );

  return {
    ...actual,
    fetchProductQuotationsPage: fetchProductQuotationsPageMock,
    fetchProductQuotation: fetchProductQuotationMock,
  };
});

describe('QuotationPickerModal', () => {
  it('widens the modal, hides zero-value quotations, and imports only checked quotation items', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const productById = new Map<string, Product>([
      [
        '801',
        {
          id: 801,
          product_code: 'HIS01',
          product_name: 'Phần mềm VNPT-HIS',
          standard_price: 2000000,
          unit: 'Gói/tháng',
        } as Product,
      ],
      [
        '802',
        {
          id: 802,
          product_code: 'RIS01',
          product_name: 'Phần mềm RIS',
          standard_price: 71686000,
          unit: 'Gói',
        } as Product,
      ],
    ]);

    const quotationList: ProductQuotationDraftListItem[] = [
      {
        id: 9001,
        uuid: 'quotation-zero',
        customer_id: 77,
        recipient_name: 'Bệnh viện Phổi Hậu Giang',
        subtotal: 0,
        vat_amount: 0,
        total_amount: 0,
        uses_multi_vat_template: false,
        latest_version_no: 1,
        status: 'draft',
        items_count: 0,
        versions_count: 0,
        events_count: 0,
        created_at: '2026-04-10T01:00:00.000Z',
        updated_at: '2026-04-10T01:00:00.000Z',
      },
      {
        id: 9002,
        uuid: 'quotation-live',
        customer_id: 77,
        recipient_name: 'Bệnh viện Phổi Hậu Giang',
        subtotal: 73686000,
        vat_amount: 7368600,
        total_amount: 81054600,
        uses_multi_vat_template: false,
        latest_version_no: 2,
        status: 'draft',
        items_count: 2,
        versions_count: 1,
        events_count: 0,
        created_at: '2026-04-10T02:00:00.000Z',
        updated_at: '2026-04-10T02:00:00.000Z',
      },
    ];

    const quotationDetail: ProductQuotationDraft = {
      id: 9002,
      uuid: 'quotation-live',
      customer_id: 77,
      recipient_name: 'Bệnh viện Phổi Hậu Giang',
      subtotal: 73686000,
      vat_amount: 7368600,
      total_amount: 81054600,
      total_in_words: 'Tám mươi mốt triệu, không trăm năm mươi bốn nghìn sáu trăm đồng',
      uses_multi_vat_template: false,
      latest_version_no: 2,
      validity_days: 30,
      status: 'draft',
      versions_count: 1,
      events_count: 0,
      items: [
        {
          id: 1,
          sort_order: 1,
          product_id: 801,
          product_name: 'Thuê phần mềm VNPT-HIS',
          unit: 'Gói/tháng',
          quantity: 9,
          unit_price: 2000000,
          vat_rate: 10,
          vat_amount: 1800000,
          line_total: 18000000,
          total_with_vat: 19800000,
          note: null,
        },
        {
          id: 2,
          sort_order: 2,
          product_id: 802,
          product_name: 'Thuê phần mềm quản lý chẩn đoán hình ảnh RIS',
          unit: 'Gói',
          quantity: 1,
          unit_price: 71686000,
          vat_rate: 10,
          vat_amount: 7168600,
          line_total: 71686000,
          total_with_vat: 78854600,
          note: null,
        },
      ],
      created_at: '2026-04-10T02:00:00.000Z',
      updated_at: '2026-04-10T02:00:00.000Z',
    };

    fetchProductQuotationsPageMock.mockResolvedValue({
      data: quotationList,
      meta: { page: 1, per_page: 100, total: 2, total_pages: 1 },
    });
    fetchProductQuotationMock.mockResolvedValue(quotationDetail);

    render(
      <QuotationPickerModal
        projectCustomerId={77}
        productById={productById}
        existingItems={[] as ProjectItem[]}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    const quotationModal = await screen.findByTestId('quotation-picker-modal');
    expect(quotationModal).toHaveClass('max-w-[50.5rem]');

    expect(screen.queryByText(/0 hạng mục/i)).not.toBeInTheDocument();

    const quotationButton = screen.getByRole('button', { name: /Bệnh viện Phổi Hậu Giang/i });
    expect(within(quotationButton).getByText(/2 hạng mục/i)).toBeInTheDocument();
    expect(within(quotationButton).getByText(/81\.054\.600 đ/i)).toBeInTheDocument();

    await user.click(quotationButton);

    await waitFor(() => {
      expect(fetchProductQuotationMock).toHaveBeenCalledWith(9002);
    });

    const allCheckbox = await screen.findByLabelText('Chọn tất cả hạng mục báo giá');
    const hisCheckbox = await screen.findByLabelText('Chọn hạng mục Thuê phần mềm VNPT-HIS');
    const risCheckbox = await screen.findByLabelText('Chọn hạng mục Thuê phần mềm quản lý chẩn đoán hình ảnh RIS');
    expect(allCheckbox).toBeChecked();
    expect(hisCheckbox).toBeChecked();
    expect(risCheckbox).toBeChecked();
    expect(screen.getByText('Đã chọn 2/2 hạng mục')).toBeInTheDocument();

    await user.click(risCheckbox);

    expect(screen.getByText('Đã chọn 1/2 hạng mục')).toBeInTheDocument();
    expect(screen.getByText('18.000.000 đ')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lấy 1 hạng mục/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          productId: '801',
          product_id: 801,
          quantity: 9,
          unitPrice: 2000000,
          unit_price: 2000000,
          lineTotal: 18000000,
          line_total: 18000000,
        }),
      ],
      'merge'
    );
  });
});
