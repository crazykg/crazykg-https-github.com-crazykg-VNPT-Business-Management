import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProductPackage } from '../types/product';
import { ProductPackageFeatureCatalogModal } from '../components/ProductPackageFeatureCatalogModal';

const modalSpy = vi.fn();

vi.mock('../components/ProductFeatureCatalogModal', () => ({
  ProductFeatureCatalogModal: (props: Record<string, unknown>) => {
    modalSpy(props);
    return <div data-testid="product-package-feature-catalog-proxy" />;
  },
}));

describe('ProductPackageFeatureCatalogModal', () => {
  it('maps product package data into the shared catalog modal with package-specific config', () => {
    const productPackage: ProductPackage = {
      id: 21,
      uuid: 'pkg-21',
      product_id: 9,
      package_code: 'PKG-001',
      package_name: 'Gói triển khai HIS',
      product_name: 'Phần mềm VNPT-HIS',
      parent_product_code: 'SP001',
      service_group: 'GROUP_B',
      domain_id: 1,
      vendor_id: 2,
      standard_price: 880000,
      unit: 'Tháng',
      description: 'Mô tả gói',
      is_active: true,
    };

    render(
      <ProductPackageFeatureCatalogModal
        productPackage={productPackage}
        canManage
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    expect(modalSpy).toHaveBeenCalledTimes(1);
    const props = modalSpy.mock.calls[0]?.[0] as {
      product: Record<string, unknown>;
      config: Record<string, unknown>;
      canManage: boolean;
    };

    expect(props.canManage).toBe(true);
    expect(props.product.product_code).toBe('PKG-001');
    expect(props.product.product_name).toBe('Gói triển khai HIS');
    expect(props.product.package_name).toBe('Phần mềm VNPT-HIS');
    expect(props.config.entityLabel).toBe('gói cước');
    expect(props.config.catalogLabel).toBe('Danh mục tính năng');
  });
});
