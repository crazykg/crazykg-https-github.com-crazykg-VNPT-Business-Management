import type { ContractItem } from '../../types';

const CONTRACT_ITEM_PACKAGE_PREFIX = 'pkg:';
const CONTRACT_ITEM_PRODUCT_PREFIX = 'prd:';

export const buildContractPackageCatalogValue = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  return normalized ? `${CONTRACT_ITEM_PACKAGE_PREFIX}${normalized}` : '';
};

export const buildContractProductCatalogValue = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  return normalized ? `${CONTRACT_ITEM_PRODUCT_PREFIX}${normalized}` : '';
};

export const parseContractItemCatalogValue = (
  value: unknown
): { kind: 'package' | 'product' | null; id: string } => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return { kind: null, id: '' };
  }

  if (normalized.startsWith(CONTRACT_ITEM_PACKAGE_PREFIX)) {
    return {
      kind: 'package',
      id: normalized.slice(CONTRACT_ITEM_PACKAGE_PREFIX.length).trim(),
    };
  }

  if (normalized.startsWith(CONTRACT_ITEM_PRODUCT_PREFIX)) {
    return {
      kind: 'product',
      id: normalized.slice(CONTRACT_ITEM_PRODUCT_PREFIX.length).trim(),
    };
  }

  return {
    kind: 'product',
    id: normalized,
  };
};

export const resolveContractItemCatalogValue = (
  item: Pick<ContractItem, 'product_package_id' | 'productPackageId' | 'product_id'>
): string => {
  const packageId = String(item.productPackageId ?? item.product_package_id ?? '').trim();
  if (packageId && packageId !== '0') {
    return buildContractPackageCatalogValue(packageId);
  }

  const productId = String(item.product_id ?? '').trim();
  return productId && productId !== '0' ? buildContractProductCatalogValue(productId) : '';
};
