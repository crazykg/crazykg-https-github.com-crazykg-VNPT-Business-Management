export type ProductServiceGroupCode = 'GROUP_A' | 'GROUP_B' | 'GROUP_C';

export interface ProductServiceGroupMeta {
  code: ProductServiceGroupCode;
  label: string;
  shortLabel: string;
  badgeClassName: string;
  aliases: string[];
}

export const DEFAULT_PRODUCT_SERVICE_GROUP: ProductServiceGroupCode = 'GROUP_B';

const PRODUCT_SERVICE_GROUP_META_LIST: ProductServiceGroupMeta[] = [
  {
    code: 'GROUP_A',
    label: 'Dịch vụ nhóm A',
    shortLabel: 'Nhóm A',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    aliases: ['A', 'NHOM A', 'DICH VU NHOM A', 'DICHVU NHOM A'],
  },
  {
    code: 'GROUP_B',
    label: 'Dịch vụ nhóm B',
    shortLabel: 'Nhóm B',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    aliases: ['B', 'NHOM B', 'DICH VU NHOM B', 'DICHVU NHOM B'],
  },
  {
    code: 'GROUP_C',
    label: 'Dịch vụ nhóm C',
    shortLabel: 'Nhóm C',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    aliases: ['C', 'NHOM C', 'DICH VU NHOM C', 'DICHVU NHOM C'],
  },
];

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ');

const metaByCode = new Map<ProductServiceGroupCode, ProductServiceGroupMeta>(
  PRODUCT_SERVICE_GROUP_META_LIST.map((item) => [item.code, item])
);

const codeByAlias = new Map<string, ProductServiceGroupCode>();

PRODUCT_SERVICE_GROUP_META_LIST.forEach((item) => {
  const aliasPool = [item.code, item.label, item.shortLabel, ...item.aliases];
  aliasPool.forEach((alias) => {
    const normalized = normalizeToken(alias);
    if (normalized) {
      codeByAlias.set(normalized, item.code);
    }
  });
});

export const PRODUCT_SERVICE_GROUP_OPTIONS = PRODUCT_SERVICE_GROUP_META_LIST.map((item) => ({
  value: item.code,
  label: item.label,
  searchText: [item.code, item.label, item.shortLabel, ...item.aliases].join(' '),
}));

export const PRODUCT_SERVICE_GROUP_TEMPLATE_ROWS = PRODUCT_SERVICE_GROUP_META_LIST.map((item) => [
  item.code,
  item.label,
]);

export const isProductServiceGroupCode = (value: unknown): value is ProductServiceGroupCode =>
  metaByCode.has(String(value ?? '').trim().toUpperCase() as ProductServiceGroupCode);

export const normalizeProductServiceGroup = (value: unknown): ProductServiceGroupCode => {
  const matched = codeByAlias.get(normalizeToken(value));
  return matched || DEFAULT_PRODUCT_SERVICE_GROUP;
};

export const resolveProductServiceGroupImportValue = (value: unknown): ProductServiceGroupCode | null => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return DEFAULT_PRODUCT_SERVICE_GROUP;
  }

  return codeByAlias.get(normalizeToken(raw)) || null;
};

export const getProductServiceGroupMeta = (value: unknown): ProductServiceGroupMeta =>
  metaByCode.get(normalizeProductServiceGroup(value)) || metaByCode.get(DEFAULT_PRODUCT_SERVICE_GROUP)!;

export const getProductServiceGroupLabel = (value: unknown): string =>
  getProductServiceGroupMeta(value).label;

export const getProductServiceGroupShortLabel = (value: unknown): string =>
  getProductServiceGroupMeta(value).shortLabel;
