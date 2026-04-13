import type { ProjectItem, ProjectRACI } from '../../types';
import { downloadExcelWorkbook } from '../../utils/excelTemplate';

export interface ProjectImportSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export const normalizeProjectItemImportToken = (value: unknown): string =>
  String(value ?? '')
    .replace(/\uFEFF/g, '')
    .trim()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const PROJECT_ITEM_PACKAGE_PREFIX = 'pkg:';
const PROJECT_ITEM_PRODUCT_PREFIX = 'prd:';

export const buildProjectPackageCatalogValue = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  return normalized ? `${PROJECT_ITEM_PACKAGE_PREFIX}${normalized}` : '';
};

export const buildProjectProductCatalogValue = (value: unknown): string => {
  const normalized = String(value ?? '').trim();
  return normalized ? `${PROJECT_ITEM_PRODUCT_PREFIX}${normalized}` : '';
};

export const parseProjectItemCatalogValue = (
  value: unknown
): { kind: 'package' | 'product' | null; id: string } => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return { kind: null, id: '' };
  }

  if (normalized.startsWith(PROJECT_ITEM_PACKAGE_PREFIX)) {
    return {
      kind: 'package',
      id: normalized.slice(PROJECT_ITEM_PACKAGE_PREFIX.length).trim(),
    };
  }

  if (normalized.startsWith(PROJECT_ITEM_PRODUCT_PREFIX)) {
    return {
      kind: 'product',
      id: normalized.slice(PROJECT_ITEM_PRODUCT_PREFIX.length).trim(),
    };
  }

  return {
    kind: 'product',
    id: normalized,
  };
};

export const resolveProjectItemCatalogValue = (
  item: Pick<
    ProjectItem,
    'catalogValue' | 'productPackageId' | 'product_package_id' | 'productId' | 'product_id'
  >
): string => {
  const explicitCatalogValue = String(item.catalogValue ?? '').trim();
  if (explicitCatalogValue) {
    return explicitCatalogValue;
  }

  const packageId = String(item.productPackageId ?? item.product_package_id ?? '').trim();
  if (packageId) {
    return buildProjectPackageCatalogValue(packageId);
  }

  const productId = String(item.productId ?? item.product_id ?? '').trim();
  return buildProjectProductCatalogValue(productId);
};

export const buildProjectItemIdentityKey = (
  item: Pick<
    ProjectItem,
    'catalogValue' | 'productPackageId' | 'product_package_id' | 'productId' | 'product_id'
  >
): string => normalizeProjectItemImportToken(resolveProjectItemCatalogValue(item));

export const downloadProjectItemImportTemplate = (): void => {
  downloadExcelWorkbook('mau_nhap_hang_muc_du_an', [
    {
      name: 'DuAn',
      headers: ['Mã DA', 'Tên dự án'],
      rows: [
        ['DA001', 'Dự án VNPT HIS'],
        ['DA002', 'Dự án SOC'],
      ],
    },
    {
      name: 'HangMuc',
      headers: ['Mã DA', 'Mã gói cước', 'Số lượng', 'Đơn giá', '% CK', 'Giảm giá'],
      rows: [
        ['DA001', 'PKG-HIS-CORE', 2, 1500000, 10, ''],
        ['DA002', 'PKG-SOC-01', 1, 2000000, '', 100000],
      ],
    },
  ]);
};

export const downloadProjectRaciImportTemplate = (): void => {
  downloadExcelWorkbook('mau_nhap_doi_ngu_du_an', [
    {
      name: 'MaHangMuc',
      headers: ['Mã hạng mục dự án', 'Tên hạng mục dự án'],
      rows: [
        ['HM-DA001-01', 'Hạng mục HIS Core'],
        ['HM-DA001-02', 'Hạng mục HIS Report'],
      ],
    },
    {
      name: 'RACI',
      headers: ['Mã hạng mục dự án', 'Mã nhân sự', 'Vai trò RACI', 'Ngày phân công'],
      rows: [
        ['HM-DA001-01', 'NV001', 'A', '01/03/2026'],
        ['HM-DA001-02', 'NV001', 'R', '01/03/2026'],
      ],
    },
  ]);
};

export const withMinimumDelay = async <T,>(
  runner: () => Promise<T>,
  minimumMs: number
): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await runner();
    const elapsed = Date.now() - startedAt;
    if (elapsed < minimumMs) {
      await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
    }
    return result;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < minimumMs) {
      await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
    }
    throw error;
  }
};

export const findProjectImportSheet = (
  sheets: ProjectImportSheet[],
  keywords: string[],
  fallbackToFirst = false
): ProjectImportSheet | undefined => {
  const byName = sheets.find((sheet) => {
    const token = normalizeProjectItemImportToken(sheet.name || '');
    return keywords.some((keyword) => token.includes(keyword));
  });

  if (byName) {
    return byName;
  }

  if (!fallbackToFirst) {
    return undefined;
  }

  return sheets.find((sheet) => (sheet.headers || []).length > 0);
};

export const buildProjectItemHeaderIndex = (headers: string[]): Map<string, number> => {
  const indexMap = new Map<string, number>();
  (headers || []).forEach((header, index) => {
    const token = normalizeProjectItemImportToken(header);
    if (!token || indexMap.has(token)) {
      return;
    }
    indexMap.set(token, index);
  });
  return indexMap;
};

export const getProjectItemImportCell = (
  row: string[],
  headerIndex: Map<string, number>,
  aliases: string[]
): string => {
  for (const alias of aliases) {
    const key = normalizeProjectItemImportToken(alias);
    const index = headerIndex.get(key);
    if (typeof index === 'number' && index >= 0 && index < row.length) {
      return String(row[index] ?? '').trim();
    }
  }
  return '';
};

export const normalizeRaciRoleImport = (value: string): ProjectRACI['roleType'] | null => {
  const raw = String(value || '').trim().toUpperCase();
  if (['R', 'A', 'C', 'I'].includes(raw)) {
    return raw as ProjectRACI['roleType'];
  }

  const token = normalizeProjectItemImportToken(value);
  if (token === 'responsible' || token === 'thuchien') return 'R';
  if (token === 'accountable' || token === 'chiutrachnhiem') return 'A';
  if (token === 'consulted' || token === 'thamkhao') return 'C';
  if (token === 'informed' || token === 'duocthongbao') return 'I';
  return null;
};

export const mergeImportedProjectItems = (
  existingItems: ProjectItem[],
  importedItems: ProjectItem[]
): ProjectItem[] => {
  const nextItems = [...(existingItems || [])];
  const existingIndexByProduct = new Map<string, number>();

  nextItems.forEach((item, index) => {
    const key = buildProjectItemIdentityKey(item);
    if (!key || existingIndexByProduct.has(key)) {
      return;
    }
    existingIndexByProduct.set(key, index);
  });

  importedItems.forEach((importedItem) => {
    const productKey = buildProjectItemIdentityKey(importedItem);
    if (!productKey) {
      return;
    }

    const existingIndex = existingIndexByProduct.get(productKey);
    if (existingIndex !== undefined) {
      const preservedId = nextItems[existingIndex]?.id || importedItem.id;
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        ...importedItem,
        id: preservedId,
      };
      return;
    }

    nextItems.push(importedItem);
  });

  return nextItems;
};

export const mergeImportedProjectRaci = (
  existingRaci: ProjectRACI[],
  importedRaci: ProjectRACI[]
): ProjectRACI[] => {
  const next = [...(existingRaci || [])];
  const indexByIdentity = new Map<string, number>();

  next.forEach((item, index) => {
    const identity = `${String(item.userId || '').trim()}|${String(item.roleType || '').trim().toUpperCase()}`;
    if (!identity || indexByIdentity.has(identity)) {
      return;
    }
    indexByIdentity.set(identity, index);
  });

  importedRaci.forEach((item) => {
    const identity = `${String(item.userId || '').trim()}|${String(item.roleType || '').trim().toUpperCase()}`;
    if (!identity) {
      return;
    }

    const currentIndex = indexByIdentity.get(identity);
    if (currentIndex !== undefined) {
      const preservedId = next[currentIndex]?.id || item.id;
      next[currentIndex] = {
        ...next[currentIndex],
        ...item,
        id: preservedId,
      };
      return;
    }

    next.push(item);
  });

  return next;
};
