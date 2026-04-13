// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductPackage } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { useImportProductPackages } from '../hooks/useImportProductPackages';
import { createProductPackagesBulk, deleteProductPackage } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createProductPackagesBulk: vi.fn(),
  deleteProductPackage: vi.fn(),
}));

const products: Product[] = [
  {
    id: 1,
    service_group: 'GROUP_B',
    product_code: 'SP001',
    product_name: 'Gói HIS cơ bản',
    domain_id: 1,
    vendor_id: 1,
    standard_price: 1200000,
    description: 'Sản phẩm HIS',
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
    package_code: 'PKG-HIS-01',
    package_name: 'Gói HIS nâng cao',
    standard_price: 2500000,
    unit: 'Gói',
    description: 'Áp dụng tuyến huyện',
    is_active: true,
    attachments: [],
  },
];

describe('useImportProductPackages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteProductPackage).mockResolvedValue(undefined);
  });

  it('imports valid product package rows in bulk and refreshes related datasets after success', async () => {
    vi.mocked(createProductPackagesBulk).mockResolvedValue({
      results: [{
        index: 0,
        success: true,
        data: {
          id: 'pkg-1',
          product_id: 1,
          package_code: 'PKG_HIS_02',
          package_name: 'Gói HIS mở rộng',
          product_name: 'Gói HIS cơ bản',
          parent_product_code: 'SP001',
          service_group: 'GROUP_B',
          standard_price: 3500000,
          unit: 'Tháng',
          description: 'Mô tả mẫu',
          is_active: true,
          attachments: [],
        } satisfies ProductPackage,
      }],
      created: [],
      created_count: 1,
      failed_count: 0,
    });

    const { result } = renderHook(() => useImportProductPackages());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const refreshProductPackagesData = vi.fn(async () => undefined);
    const refreshProductsData = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const payload: ImportPayload = {
      moduleKey: 'product_packages',
      fileName: 'goi-cuoc.xlsx',
      sheetName: 'GoiCuoc',
      headers: [
        'Mã gói cước',
        'Tên gói cước',
        'Mô tả',
        'Mã định danh sản phẩm cha',
        'Tên sản phẩm/Dịch vụ',
        'Đơn giá (Trước VAT)',
        'Đơn vị tính',
        'Trạng thái',
      ],
      rows: [[
        'PKG_HIS_02',
        'Gói HIS mở rộng',
        'Mô tả mẫu',
        'SP001',
        'Gói HIS cơ bản',
        '3500000',
        'Tháng',
        'Hoạt động',
      ]],
    };

    await act(async () => {
      await result.current.handleImportProductPackages(
        payload,
        productPackages,
        products,
        addToast,
        setImportLoadingText,
        refreshProductPackagesData,
        refreshProductsData,
        handleCloseModal,
      );
    });

    expect(createProductPackagesBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createProductPackagesBulk).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        product_id: 1,
        package_code: 'PKG_HIS_02',
        package_name: 'Gói HIS mở rộng',
        standard_price: 3500000,
        unit: 'Tháng',
        description: 'Mô tả mẫu',
        is_active: true,
      }),
    ]);
    expect(refreshProductPackagesData).toHaveBeenCalledTimes(1);
    expect(refreshProductsData).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('success', 'Nhập dữ liệu', 'Gói cước: đã lưu 1 dòng.');
  });
});
