// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business, Product, Vendor } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { useImportProducts } from '../hooks/useImportProducts';
import { createProductsBulk, deleteProduct } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createProductsBulk: vi.fn(),
  deleteProduct: vi.fn(),
}));

const businesses: Business[] = [{
  id: 10,
  domain_code: 'VT',
  domain_name: 'Viễn thông',
}];

const vendors: Vendor[] = [{
  id: 20,
  uuid: 'vendor-20',
  vendor_code: 'VNPT',
  vendor_name: 'VNPT Hậu Giang',
}];

describe('useImportProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteProduct).mockResolvedValue(undefined);
  });

  it('imports valid product rows in bulk and refreshes the products list after success', async () => {
    vi.mocked(createProductsBulk).mockResolvedValue({
      results: [{
        index: 0,
        success: true,
        data: {
          id: 'product-1',
          uuid: 'product-1',
          service_group: 'GROUP_C',
          product_code: 'SP_001',
          product_name: 'Internet doanh nghiệp',
          product_short_name: 'Internet DN',
          domain_id: 10,
          vendor_id: 20,
          standard_price: 123000,
          description: 'Mô tả mẫu',
          is_active: true,
          attachments: [],
        } satisfies Product,
      }],
      created: [],
      created_count: 1,
      failed_count: 0,
    });

    const { result } = renderHook(() => useImportProducts());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const refreshProductsData = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const payload: ImportPayload = {
      moduleKey: 'products',
      fileName: 'san-pham.xlsx',
      sheetName: 'SanPham',
      headers: [
        'Mã định danh',
        'Tên sản phẩm',
        'Mô tả',
        'Mã nhóm dịch vụ',
        'Tên viết tắt',
        'Mã lĩnh vực',
        'Mã nhà cung cấp',
        'Trạng thái',
      ],
      rows: [[
        'SP_001',
        'Internet doanh nghiệp',
        'Mô tả mẫu',
        'Nhóm C',
        'Internet DN',
        'VT',
        'VNPT',
        'Hoạt động',
      ]],
    };

    await act(async () => {
      await result.current.handleImportProducts(
        payload,
        [],
        businesses,
        vendors,
        addToast,
        setImportLoadingText,
        refreshProductsData,
        handleCloseModal,
      );
    });

    expect(createProductsBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createProductsBulk).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        service_group: 'GROUP_C',
        product_code: 'SP_001',
        product_name: 'Internet doanh nghiệp',
        product_short_name: 'Internet DN',
        domain_id: 10,
        vendor_id: 20,
        standard_price: 0,
        description: 'Mô tả mẫu',
        is_active: true,
      }),
    ]);
    expect(refreshProductsData).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('success', 'Nhập dữ liệu', 'Sản phẩm: đã lưu 1 dòng.');
  });

  it('chunks product imports into 1000-row bulk requests for large files', async () => {
    vi.mocked(createProductsBulk).mockImplementation(async (items) => ({
      results: items.map((item, index) => ({
        index,
        success: true,
        data: {
          id: `product-${index}`,
          uuid: `product-${index}`,
          service_group: item.service_group ?? 'GROUP_B',
          product_code: item.product_code ?? '',
          product_name: item.product_name ?? '',
          domain_id: item.domain_id ?? 10,
          vendor_id: item.vendor_id ?? 20,
          standard_price: item.standard_price ?? 0,
          description: item.description ?? '',
          is_active: item.is_active !== false,
          attachments: [],
        } satisfies Product,
      })),
      created: [],
      created_count: items.length,
      failed_count: 0,
    }));

    const { result } = renderHook(() => useImportProducts());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const refreshProductsData = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const rows = Array.from({ length: 1001 }, (_, index) => ([
      `SP_${String(index + 1).padStart(4, '0')}`,
      `Sản phẩm ${index + 1}`,
      `Mô tả ${index + 1}`,
      'Nhóm B',
      `SP ${index + 1}`,
      'VT',
      'VNPT',
      'Hoạt động',
    ]));

    await act(async () => {
      await result.current.handleImportProducts(
        {
          moduleKey: 'products',
          fileName: 'san-pham-lon.xlsx',
          sheetName: 'SanPham',
          headers: [
            'Mã định danh',
            'Tên sản phẩm',
            'Mô tả',
            'Mã nhóm dịch vụ',
            'Tên viết tắt',
            'Mã lĩnh vực',
            'Mã nhà cung cấp',
            'Trạng thái',
          ],
          rows,
        },
        [],
        businesses,
        vendors,
        addToast,
        setImportLoadingText,
        refreshProductsData,
        handleCloseModal,
      );
    });

    expect(createProductsBulk).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createProductsBulk).mock.calls[0]?.[0]).toHaveLength(1000);
    expect(vi.mocked(createProductsBulk).mock.calls[1]?.[0]).toHaveLength(1);
    expect(refreshProductsData).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('success', 'Nhập dữ liệu', 'Sản phẩm: đã lưu 1001 dòng.');
  });
});
