import React, { useMemo } from 'react';
import type { Product } from '../types';
import type { ProductPackage } from '../types/product';
import {
  fetchProductPackageFeatureCatalog,
  fetchProductPackageFeatureCatalogList,
  updateProductPackageFeatureCatalog,
} from '../services/api/productApi';
import {
  ProductFeatureCatalogModal,
  type FeatureCatalogModalConfig,
} from './ProductFeatureCatalogModal';

type NotifyFn = (type: 'success' | 'error', title: string, message: string) => void;

interface ProductPackageFeatureCatalogModalProps {
  productPackage: ProductPackage;
  canManage?: boolean;
  onClose: () => void;
  onNotify?: NotifyFn;
}

const PRODUCT_PACKAGE_FEATURE_CATALOG_CONFIG: FeatureCatalogModalConfig = {
  entityLabel: 'gói cước',
  catalogLabel: 'Danh mục tính năng',
  listLabel: 'Danh sách tính năng',
  featureNounPlural: 'tính năng',
  importModuleKey: 'product_feature_catalog',
  templateFilename: 'mau_nhap_danh_muc_tinh_nang_goi_cuoc',
  exportFilenamePrefix: 'danh_muc_tinh_nang_goi_cuoc',
  loadCatalog: fetchProductPackageFeatureCatalog,
  loadCatalogList: fetchProductPackageFeatureCatalogList,
  updateCatalog: updateProductPackageFeatureCatalog,
};

export const ProductPackageFeatureCatalogModal: React.FC<ProductPackageFeatureCatalogModalProps> = ({
  productPackage,
  canManage = false,
  onClose,
  onNotify,
}) => {
  const pseudoProduct = useMemo<Product>(() => ({
    id: productPackage.id,
    uuid: productPackage.uuid ?? undefined,
    service_group: productPackage.service_group ?? null,
    product_code: productPackage.package_code,
    product_name: productPackage.package_name,
    product_short_name: null,
    package_name: productPackage.product_name ?? null,
    domain_id: productPackage.domain_id ?? '',
    vendor_id: productPackage.vendor_id ?? '',
    standard_price: Number(productPackage.standard_price || 0),
    unit: productPackage.unit ?? null,
    description: productPackage.description ?? null,
    is_active: productPackage.is_active !== false,
  }), [productPackage]);

  return (
    <ProductFeatureCatalogModal
      product={pseudoProduct}
      canManage={canManage}
      onClose={onClose}
      onNotify={onNotify}
      config={PRODUCT_PACKAGE_FEATURE_CATALOG_CONFIG}
    />
  );
};

export default ProductPackageFeatureCatalogModal;
