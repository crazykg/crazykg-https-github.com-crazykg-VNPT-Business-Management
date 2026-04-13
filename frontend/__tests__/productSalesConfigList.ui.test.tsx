import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductPackage, ProductTargetSegment } from '../types/product';
import { ProductSalesConfigList } from '../components/ProductSalesConfigList';

const productApiMocks = vi.hoisted(() => ({
  fetchProductTargetSegments: vi.fn(),
}));

vi.mock('../services/api/productApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/productApi')>('../services/api/productApi');
  return {
    ...actual,
    fetchProductTargetSegments: productApiMocks.fetchProductTargetSegments,
  };
});

vi.mock('../components/ProductTargetSegmentModal', () => ({
  ProductTargetSegmentModal: ({
    product,
    onSaved,
    onClose,
  }: {
    product: Product;
    onSaved?: (segments: ProductTargetSegment[]) => void;
    onClose: () => void;
  }) => (
    <div>
      <div>{`Modal ${product.product_name}`}</div>
      <button
        type="button"
        onClick={() => {
          onSaved?.([
            {
              id: 'segment-1',
              product_id: product.id,
              customer_sector: 'HEALTHCARE',
              facility_type: 'PUBLIC_HOSPITAL',
              facility_types: ['PUBLIC_HOSPITAL'],
              bed_capacity_min: 200,
              bed_capacity_max: null,
              priority: 1,
              sales_notes: 'Ưu tiên bệnh viện công.',
              is_active: true,
            },
          ]);
          onClose();
        }}
      >
        Lưu cấu hình mock
      </button>
    </div>
  ),
}));

const products: Product[] = [
  {
    id: 'product-1',
    product_code: 'SP-HIS',
    product_name: 'Phần mềm HIS',
    product_short_name: 'HIS',
    service_group: 'Y tế số',
    domain_id: 'domain-1',
    vendor_id: 'vendor-1',
    standard_price: 1000000,
    is_active: true,
  },
];

const productPackages: ProductPackage[] = [
  {
    id: 'package-1',
    product_id: 'product-1',
    package_code: 'PKG-HIS-01',
    package_name: 'HIS Standard',
    standard_price: 1000000,
    is_active: true,
  },
];

describe('ProductSalesConfigList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productApiMocks.fetchProductTargetSegments.mockResolvedValue({
      data: [],
      meta: { table_available: true },
    });
  });

  it('updates the table summary immediately after saving a sales configuration', async () => {
    const user = userEvent.setup();

    render(
      <ProductSalesConfigList
        products={products}
        productPackages={productPackages}
        canManage={true}
      />
    );

    expect(await screen.findByText('SP-HIS')).toBeInTheDocument();
    expect(await screen.findByText('Chưa cấu hình')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cấu hình bán sản phẩm' }));
    expect(await screen.findByText('Modal Phần mềm HIS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình mock' }));

    await waitFor(() => {
      expect(screen.getByText('1 phân khúc')).toBeInTheDocument();
      expect(screen.getByText('Y tế • Bệnh viện (Công lập)')).toBeInTheDocument();
    });
  });
});
