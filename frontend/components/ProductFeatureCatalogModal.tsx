import React, { useEffect, useMemo, useState } from 'react';
import { AuditLog, Product, ProductFeatureCatalog, ProductFeatureGroup, ProductFeatureStatus } from '../types';
import { fetchProductFeatureCatalog, updateProductFeatureCatalog } from '../services/v5Api';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { isoDateStamp } from '../utils/exportUtils';
import { ModalWrapper, ImportModal, type ImportPayload } from './Modals';
import { SearchableSelect } from './SearchableSelect';
import { getProductServiceGroupLabel } from '../utils/productServiceGroup';

type NotifyFn = (type: 'success' | 'error', title: string, message: string) => void;

type DraftFeature = {
  id: string | number;
  persistedId?: string | number | null;
  uuid?: string | null;
  feature_name: string;
  detail_description: string;
  status: ProductFeatureStatus;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: AuditLog['actor'] | null;
  updated_by_actor?: AuditLog['actor'] | null;
};

type DraftGroup = {
  id: string | number;
  persistedId?: string | number | null;
  uuid?: string | null;
  group_name: string;
  notes: string;
  display_order: number;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  created_by_actor?: AuditLog['actor'] | null;
  updated_by_actor?: AuditLog['actor'] | null;
  features: DraftFeature[];
};

interface ProductFeatureCatalogModalProps {
  product: Product;
  canManage?: boolean;
  onClose: () => void;
  onNotify?: NotifyFn;
}

const FEATURE_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
] as const;

const FEATURE_IMPORT_HEADERS = [
  'STT nhóm',
  'Tên nhóm/phân hệ',
  'STT chức năng',
  'Tên chức năng',
  'Mô tả chi tiết',
  'Trạng thái',
] as const;

const FEATURE_STATUS_LABELS: Record<ProductFeatureStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Tạm ngưng',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeToken = (value: unknown): string =>
  toText(value)
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeStatus = (value: unknown): ProductFeatureStatus => {
  const token = normalizeToken(value);
  if (token === 'inactive' || token === 'tamngung') {
    return 'INACTIVE';
  }
  return 'ACTIVE';
};

const toRomanLabel = (value: number): string => ROMAN_NUMERALS[value - 1] || String(value);

const formatAuditDateTime = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

const actorLabel = (
  actor?: AuditLog['actor'] | null,
  fallbackId?: string | number | null
): string => {
  if (actor?.full_name) {
    return actor.full_name;
  }
  if (actor?.username) {
    return actor.username;
  }
  const fallback = toText(fallbackId);
  return fallback || 'Hệ thống';
};

const stringifyAuditPayload = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildTempId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildFeatureEditKey = (groupId: string | number, featureId: string | number): string =>
  `${String(groupId)}::${String(featureId)}`;

const createDraftFeature = (overrides: Partial<DraftFeature> = {}): DraftFeature => ({
  id: overrides.id ?? buildTempId('feature'),
  persistedId: overrides.persistedId ?? null,
  uuid: overrides.uuid ?? null,
  feature_name: overrides.feature_name ?? '',
  detail_description: overrides.detail_description ?? '',
  status: overrides.status ?? 'ACTIVE',
  display_order: overrides.display_order ?? 1,
  created_at: overrides.created_at ?? null,
  created_by: overrides.created_by ?? null,
  updated_at: overrides.updated_at ?? null,
  updated_by: overrides.updated_by ?? null,
  created_by_actor: overrides.created_by_actor ?? null,
  updated_by_actor: overrides.updated_by_actor ?? null,
});

const createDraftGroup = (overrides: Partial<DraftGroup> = {}): DraftGroup => ({
  id: overrides.id ?? buildTempId('group'),
  persistedId: overrides.persistedId ?? null,
  uuid: overrides.uuid ?? null,
  group_name: overrides.group_name ?? '',
  notes: overrides.notes ?? '',
  display_order: overrides.display_order ?? 1,
  created_at: overrides.created_at ?? null,
  created_by: overrides.created_by ?? null,
  updated_at: overrides.updated_at ?? null,
  updated_by: overrides.updated_by ?? null,
  created_by_actor: overrides.created_by_actor ?? null,
  updated_by_actor: overrides.updated_by_actor ?? null,
  features: overrides.features ?? [],
});

const toDraftGroups = (groups: ProductFeatureGroup[]): DraftGroup[] =>
  (groups || []).map((group, groupIndex) =>
    createDraftGroup({
      id: group.id,
      persistedId: group.id,
      uuid: group.uuid ?? null,
      group_name: group.group_name,
      notes: group.notes ?? '',
      display_order: group.display_order || groupIndex + 1,
      created_at: group.created_at ?? null,
      created_by: group.created_by ?? null,
      updated_at: group.updated_at ?? null,
      updated_by: group.updated_by ?? null,
      created_by_actor: group.created_by_actor ?? null,
      updated_by_actor: group.updated_by_actor ?? null,
      features: (group.features || []).map((feature, featureIndex) =>
        createDraftFeature({
          id: feature.id,
          persistedId: feature.id,
          uuid: feature.uuid ?? null,
          feature_name: feature.feature_name,
          detail_description: feature.detail_description ?? '',
          status: feature.status,
          display_order: feature.display_order || featureIndex + 1,
          created_at: feature.created_at ?? null,
          created_by: feature.created_by ?? null,
          updated_at: feature.updated_at ?? null,
          updated_by: feature.updated_by ?? null,
          created_by_actor: feature.created_by_actor ?? null,
          updated_by_actor: feature.updated_by_actor ?? null,
        })
      ),
    })
  );

const normalizeDraftGroups = (groups: DraftGroup[]): DraftGroup[] =>
  groups.map((group, groupIndex) =>
    createDraftGroup({
      ...group,
      display_order: groupIndex + 1,
      features: (group.features || []).map((feature, featureIndex) =>
        createDraftFeature({
          ...feature,
          display_order: featureIndex + 1,
        })
      ),
    })
  );

const buildCatalogPayload = (groups: DraftGroup[]) => ({
  groups: normalizeDraftGroups(groups).map((group, groupIndex) => ({
    id: typeof group.persistedId === 'undefined' ? null : group.persistedId,
    uuid: group.uuid ?? null,
    group_name: toText(group.group_name),
    notes: toText(group.notes) || null,
    display_order: groupIndex + 1,
    features: (group.features || []).map((feature, featureIndex) => ({
      id: typeof feature.persistedId === 'undefined' ? null : feature.persistedId,
      uuid: feature.uuid ?? null,
      feature_name: toText(feature.feature_name),
      detail_description: toText(feature.detail_description) || null,
      status: feature.status,
      display_order: featureIndex + 1,
    })),
  })),
});

const buildCatalogSignature = (groups: DraftGroup[]): string =>
  JSON.stringify(buildCatalogPayload(groups));

const buildFeatureExportRows = (groups: DraftGroup[]) =>
  normalizeDraftGroups(groups).flatMap((group, groupIndex) => {
    if ((group.features || []).length === 0) {
      return [[groupIndex + 1, group.group_name, '', '', '', '']];
    }

    return group.features.map((feature, featureIndex) => [
      groupIndex + 1,
      group.group_name,
      featureIndex + 1,
      feature.feature_name,
      feature.detail_description,
      FEATURE_STATUS_LABELS[feature.status],
    ]);
  });

const findHeaderIndex = (headers: string[], candidates: string[]): number =>
  headers.findIndex((header) => candidates.includes(normalizeToken(header)));

const parseImportedGroups = (headers: string[], rows: string[][], expectedProductCodes: string[]): DraftGroup[] => {
  const acceptedProductCodeTokens = expectedProductCodes.map((code) => normalizeToken(code)).filter(Boolean);
  const productCodeIndex = findHeaderIndex(headers, ['masanpham', 'masp', 'productcode']);
  const groupOrderIndex = findHeaderIndex(headers, ['sttnhom', 'sttnhomchucnang', 'thu tunhom']);
  const groupNameIndex = findHeaderIndex(headers, ['tennhomphanhe', 'tenphanhe', 'tennhomchucnang', 'tennhom']);
  const featureOrderIndex = findHeaderIndex(headers, ['sttchucnang', 'thutuchucnang', 'stttinhnang']);
  const featureNameIndex = findHeaderIndex(headers, ['tenchucnang', 'tentinhnang']);
  const detailIndex = findHeaderIndex(headers, ['motachitiet', 'motachitiettinhnang', 'mota']);
  const statusIndex = findHeaderIndex(headers, ['trangthai', 'status']);

  if (groupNameIndex < 0) {
    throw new Error('File import chưa có cột "Tên nhóm/phân hệ".');
  }

  const groups = new Map<string, DraftGroup>();

  rows.forEach((row) => {
    const productCode = productCodeIndex >= 0 ? toText(row[productCodeIndex]) : '';
    if (productCode && acceptedProductCodeTokens.length > 0 && !acceptedProductCodeTokens.includes(normalizeToken(productCode))) {
      return;
    }

    const groupName = toText(row[groupNameIndex]);
    if (!groupName) {
      return;
    }

    const groupOrder = groupOrderIndex >= 0 ? Number(row[groupOrderIndex]) || groups.size + 1 : groups.size + 1;
    const groupKey = `${groupOrder}::${groupName}`;

    if (!groups.has(groupKey)) {
      groups.set(
        groupKey,
        createDraftGroup({
          group_name: groupName,
          display_order: groupOrder,
          features: [],
        })
      );
    }

    const featureName = featureNameIndex >= 0 ? toText(row[featureNameIndex]) : '';
    if (!featureName) {
      return;
    }

    const draftGroup = groups.get(groupKey)!;
    const featureOrder = featureOrderIndex >= 0 ? Number(row[featureOrderIndex]) || draftGroup.features.length + 1 : draftGroup.features.length + 1;
    draftGroup.features.push(
      createDraftFeature({
        feature_name: featureName,
        detail_description: detailIndex >= 0 ? toText(row[detailIndex]) : '',
        status: statusIndex >= 0 ? normalizeStatus(row[statusIndex]) : 'ACTIVE',
        display_order: featureOrder,
      })
    );
  });

  const parsedGroups = Array.from(groups.values()).sort((left, right) => left.display_order - right.display_order);
  if (parsedGroups.length === 0) {
    throw new Error('Không tìm thấy dòng dữ liệu hợp lệ cho sản phẩm đang chọn trong file import.');
  }

  return normalizeDraftGroups(parsedGroups);
};

export const ProductFeatureCatalogModal: React.FC<ProductFeatureCatalogModalProps> = ({
  product,
  canManage = false,
  onClose,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'list'>('editor');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [catalog, setCatalog] = useState<ProductFeatureCatalog | null>(null);
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportReviewModal, setShowImportReviewModal] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState('');
  const [editingFeatureKeys, setEditingFeatureKeys] = useState<string[]>([]);
  const [initialSignature, setInitialSignature] = useState('[]');

  const productSummary = catalog?.product || {
    id: product.id,
    uuid: product.uuid ?? null,
    service_group: product.service_group ?? null,
    product_code: product.product_code,
    product_name: product.product_name,
    package_name: product.package_name ?? null,
    description: product.description ?? null,
    is_active: product.is_active !== false,
    catalog_package_count: 1,
  };
  const catalogScope = catalog?.catalog_scope ?? {
    catalog_product_id: product.id,
    product_ids: [product.id],
    package_count: productSummary.catalog_package_count ?? 1,
    product_codes: [product.product_code],
  };
  const acceptedProductCodes = useMemo(
    () => Array.from(new Set((catalogScope.product_codes || []).map((code) => toText(code)).filter(Boolean))),
    [catalogScope.product_codes]
  );
  const isSharedAcrossPackages = (catalogScope.package_count || productSummary.catalog_package_count || 1) > 1;
  const auditLogCount = (catalog?.audit_logs || []).length;
  const normalizedDraftGroups = useMemo(() => normalizeDraftGroups(draftGroups), [draftGroups]);
  const normalizedFeatureSearchKeyword = useMemo(
    () => normalizeToken(featureSearchKeyword),
    [featureSearchKeyword]
  );
  const groupFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Tất cả nhóm chức năng' },
      ...normalizedDraftGroups.map((group) => ({
        value: String(group.id),
        label: toText(group.group_name) || `Phân hệ ${group.display_order}`,
        searchText: `${group.group_name} ${group.notes}`,
      })),
    ],
    [normalizedDraftGroups]
  );
  const filteredDraftGroups = useMemo(() => {
    return normalizedDraftGroups.flatMap((group) => {
      if (selectedGroupFilter !== 'ALL' && String(group.id) !== selectedGroupFilter) {
        return [];
      }

      if (!normalizedFeatureSearchKeyword) {
        return [group];
      }

      const matchedFeatures = (group.features || []).filter((feature) =>
        normalizeToken(feature.feature_name).includes(normalizedFeatureSearchKeyword)
      );

      if (matchedFeatures.length === 0) {
        return [];
      }

      return [
        createDraftGroup({
          ...group,
          features: matchedFeatures,
        }),
      ];
    });
  }, [normalizedDraftGroups, normalizedFeatureSearchKeyword, selectedGroupFilter]);
  const groupFeatureCountMap = useMemo(
    () => Object.fromEntries(normalizedDraftGroups.map((group) => [String(group.id), (group.features || []).length])),
    [normalizedDraftGroups]
  );
  const hasAnyCatalogGroups = normalizedDraftGroups.length > 0;
  const featureListRows = useMemo(
    () => filteredDraftGroups.flatMap((group, groupIndex) => ([
      {
        key: `group-${group.id}`,
        stt: toRomanLabel(group.display_order || groupIndex + 1),
        name: group.group_name,
        detail: toText(group.notes) || 'Danh sách chức năng thuộc phân hệ này.',
        status: null as ProductFeatureStatus | null,
        isGroup: true,
      },
      ...(group.features || []).map((feature, featureIndex) => ({
        key: `feature-${feature.id}`,
        stt: String(feature.display_order || featureIndex + 1),
        name: feature.feature_name,
        detail: toText(feature.detail_description) || '—',
        status: feature.status,
        isGroup: false,
      })),
    ])),
    [filteredDraftGroups]
  );

  const isDirty = useMemo(
    () => buildCatalogSignature(draftGroups) !== initialSignature,
    [draftGroups, initialSignature]
  );

  const loadCatalog = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await fetchProductFeatureCatalog(product.id);
      const nextDraftGroups = toDraftGroups(result.groups || []);
      setCatalog(result);
      setDraftGroups(nextDraftGroups);
      setEditingFeatureKeys([]);
      setInitialSignature(buildCatalogSignature(nextDraftGroups));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh mục chức năng.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, [product.id]);

  useEffect(() => {
    if (selectedGroupFilter === 'ALL') {
      return;
    }

    const groupStillExists = normalizedDraftGroups.some((group) => String(group.id) === selectedGroupFilter);
    if (!groupStillExists) {
      setSelectedGroupFilter('ALL');
    }
  }, [normalizedDraftGroups, selectedGroupFilter]);

  useEffect(() => {
    setEditingFeatureKeys((previous) => {
      const validKeys = new Set(
        normalizedDraftGroups.flatMap((group) =>
          (group.features || []).map((feature) => buildFeatureEditKey(group.id, feature.id))
        )
      );
      return previous.filter((key) => validKeys.has(key));
    });
  }, [normalizedDraftGroups]);

  const requestClose = () => {
    if ((isSaving || isImporting) || !isDirty) {
      onClose();
      return;
    }

    if (window.confirm('Danh mục chức năng đang có thay đổi chưa lưu. Bạn vẫn muốn đóng?')) {
      onClose();
    }
  };

  const updateGroup = (groupId: string | number, updater: (group: DraftGroup) => DraftGroup) => {
    setDraftGroups((previous) =>
      normalizeDraftGroups(
        previous.map((group) => (String(group.id) === String(groupId) ? updater(group) : group))
      )
    );
  };

  const addGroup = () => {
    const nextGroup = createDraftGroup({
      group_name: `Phân hệ ${draftGroups.length + 1}`,
      features: [createDraftFeature({ feature_name: '' })],
    });
    setDraftGroups((previous) =>
      normalizeDraftGroups([
        ...previous,
        nextGroup,
      ])
    );
    if (nextGroup.features[0]) {
      setEditingFeatureKeys((previous) => [
        ...previous,
        buildFeatureEditKey(nextGroup.id, nextGroup.features[0].id),
      ]);
    }
  };

  const removeGroup = (groupId: string | number) => {
    const targetGroup = draftGroups.find((group) => String(group.id) === String(groupId));
    if (targetGroup && (targetGroup.features || []).length > 0) {
      onNotify?.(
        'error',
        'Không thể xóa nhóm',
        `Nhóm "${toText(targetGroup.group_name) || 'Chưa đặt tên'}" đang có chức năng con. Vui lòng xóa hết chức năng con trước khi xóa nhóm.`
      );
      return;
    }

    setDraftGroups((previous) =>
      normalizeDraftGroups(previous.filter((group) => String(group.id) !== String(groupId)))
    );
  };

  const moveGroup = (groupId: string | number, direction: 'up' | 'down') => {
    setDraftGroups((previous) => {
      const next = [...previous];
      const index = next.findIndex((group) => String(group.id) === String(groupId));
      if (index < 0) {
        return previous;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return previous;
      }
      const [group] = next.splice(index, 1);
      next.splice(targetIndex, 0, group);
      return normalizeDraftGroups(next);
    });
  };

  const addFeature = (groupId: string | number) => {
    const nextFeature = createDraftFeature({ feature_name: '', status: 'ACTIVE' });
    updateGroup(groupId, (group) =>
      createDraftGroup({
        ...group,
        features: [...(group.features || []), nextFeature],
      })
    );
    setEditingFeatureKeys((previous) =>
      previous.includes(buildFeatureEditKey(groupId, nextFeature.id))
        ? previous
        : [...previous, buildFeatureEditKey(groupId, nextFeature.id)]
    );
  };

  const updateFeature = (
    groupId: string | number,
    featureId: string | number,
    updater: (feature: DraftFeature) => DraftFeature
  ) => {
    updateGroup(groupId, (group) =>
      createDraftGroup({
        ...group,
        features: (group.features || []).map((feature) =>
          String(feature.id) === String(featureId) ? updater(feature) : feature
        ),
      })
    );
  };

  const removeFeature = (groupId: string | number, featureId: string | number) => {
    setEditingFeatureKeys((previous) =>
      previous.filter((key) => key !== buildFeatureEditKey(groupId, featureId))
    );
    updateGroup(groupId, (group) =>
      createDraftGroup({
        ...group,
        features: (group.features || []).filter((feature) => String(feature.id) !== String(featureId)),
      })
    );
  };

  const moveFeature = (groupId: string | number, featureId: string | number, direction: 'up' | 'down') => {
    updateGroup(groupId, (group) => {
      const nextFeatures = [...(group.features || [])];
      const index = nextFeatures.findIndex((feature) => String(feature.id) === String(featureId));
      if (index < 0) {
        return group;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextFeatures.length) {
        return group;
      }
      const [feature] = nextFeatures.splice(index, 1);
      nextFeatures.splice(targetIndex, 0, feature);
      return createDraftGroup({
        ...group,
        features: nextFeatures,
      });
    });
  };

  const isFeatureEditing = (groupId: string | number, featureId: string | number): boolean =>
    editingFeatureKeys.includes(buildFeatureEditKey(groupId, featureId));

  const toggleFeatureEditing = (groupId: string | number, featureId: string | number) => {
    const key = buildFeatureEditKey(groupId, featureId);
    setEditingFeatureKeys((previous) =>
      previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]
    );
  };

  const validateDraft = (): string | null => {
    const seenGroups = new Set<string>();

    for (let groupIndex = 0; groupIndex < draftGroups.length; groupIndex += 1) {
      const group = draftGroups[groupIndex];
      const groupName = toText(group.group_name);
      if (!groupName) {
        return `Phân hệ #${groupIndex + 1} chưa có tên nhóm chức năng.`;
      }
      const normalizedGroupKey = normalizeToken(groupName);
      if (normalizedGroupKey && seenGroups.has(normalizedGroupKey)) {
        return `Tên phân hệ "${groupName}" đang bị trùng. Vui lòng kiểm tra lại trước khi lưu.`;
      }
      seenGroups.add(normalizedGroupKey);

      const seenFeatures = new Set<string>();

      for (let featureIndex = 0; featureIndex < (group.features || []).length; featureIndex += 1) {
        const feature = group.features[featureIndex];
        const featureName = toText(feature.feature_name);
        if (!featureName) {
          return `Phân hệ "${group.group_name}" có chức năng #${featureIndex + 1} chưa có tên.`;
        }
        const normalizedFeatureKey = normalizeToken(featureName);
        if (normalizedFeatureKey && seenFeatures.has(normalizedFeatureKey)) {
          return `Phân hệ "${groupName}" đang có chức năng trùng tên "${featureName}".`;
        }
        seenFeatures.add(normalizedFeatureKey);
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (!isDirty) {
      onNotify?.('error', 'Chưa có thay đổi', 'Danh mục chức năng chưa có thay đổi mới để lưu.');
      return;
    }

    const validationError = validateDraft();
    if (validationError) {
      onNotify?.('error', 'Chưa thể lưu', validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const result = await updateProductFeatureCatalog(product.id, buildCatalogPayload(draftGroups));
      const nextDraftGroups = toDraftGroups(result.groups || []);
      setCatalog(result);
      setDraftGroups(nextDraftGroups);
      setInitialSignature(buildCatalogSignature(nextDraftGroups));
      onNotify?.('success', 'Danh mục chức năng', 'Đã lưu danh mục chức năng của sản phẩm.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu danh mục chức năng.';
      setErrorMessage(message);
      onNotify?.('error', 'Lưu thất bại', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadExcelWorkbook('mau_nhap_danh_muc_chuc_nang_san_pham', [
      {
        name: 'ChucNang',
        headers: [...FEATURE_IMPORT_HEADERS],
        rows: [
          [1, 'Quản trị hệ thống', 1, 'Đăng nhập', 'Cho phép người dùng đăng nhập vào hệ thống', 'Hoạt động'],
          [1, 'Quản trị hệ thống', 2, 'Trang chủ', 'Hiển thị thông báo tổng hợp trên trang chủ', 'Hoạt động'],
          [2, 'Khám bệnh', 1, 'Thiết lập khoa/phòng', 'Thiết lập phạm vi khoa phòng để tác nghiệp', 'Tạm ngưng'],
        ],
      },
      {
        name: 'TrangThai',
        headers: ['Mã', 'Nhãn'],
        rows: [
          ['ACTIVE', 'Hoạt động'],
          ['INACTIVE', 'Tạm ngưng'],
        ],
      },
    ]);
  };

  const handleExportExcel = () => {
    downloadExcelWorkbook(`danh_muc_chuc_nang_${productSummary.product_code}_${isoDateStamp()}`, [
      {
        name: 'ChucNang',
        headers: [...FEATURE_IMPORT_HEADERS],
        rows: buildFeatureExportRows(draftGroups),
      },
    ]);
  };

  const handleApplyImportedCatalog = async (payload: ImportPayload) => {
    setIsImporting(true);
    setErrorMessage('');

    try {
      if (isDirty && !window.confirm('Danh mục hiện có thay đổi chưa lưu. Bạn muốn ghi đè bằng dữ liệu import?')) {
        return;
      }

      const importedGroups = parseImportedGroups(payload.headers || [], payload.rows || [], acceptedProductCodes);
      setDraftGroups(importedGroups);
      setShowImportReviewModal(false);
      onNotify?.('success', 'Import danh mục chức năng', `Đã nạp ${importedGroups.length} phân hệ từ file, vui lòng kiểm tra rồi bấm Lưu.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể import danh mục chức năng.';
      setErrorMessage(message);
      onNotify?.('error', 'Import thất bại', message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <ModalWrapper
        onClose={requestClose}
        title={`Danh mục chức năng - Mã sản phẩm ${productSummary.product_code} - ${productSummary.product_name}`}
        icon="fact_check"
        width="max-w-[92vw]"
        maxHeightClass="max-h-[92vh]"
        disableClose={isSaving || isImporting}
      >
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  {getProductServiceGroupLabel(productSummary.service_group)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  productSummary.is_active !== false
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {productSummary.is_active !== false ? 'Sản phẩm hoạt động' : 'Sản phẩm ngưng hoạt động'}
                </span>
              </div>
              {isSharedAcrossPackages ? (
                <p className="mt-3 text-xs font-medium text-slate-400">
                  {`Danh mục dùng chung cho ${catalogScope.package_count} gói của sản phẩm này`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowImportReviewModal(true)}
                  disabled={isImporting}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  Nhập file
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Tải file mẫu
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base">table_view</span>
                Xuất Excel
              </button>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-end">
                  <div className="inline-flex w-full max-w-max rounded-2xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('editor')}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        activeTab === 'editor'
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cập nhật danh mục
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('list')}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        activeTab === 'list'
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Danh sách chức năng
                    </button>
                  </div>

                  <div className="grid flex-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nhóm chức năng
                      </p>
                      <SearchableSelect
                        value={selectedGroupFilter}
                        options={groupFilterOptions}
                        onChange={(value) => setSelectedGroupFilter(value || 'ALL')}
                        placeholder="Tất cả nhóm chức năng"
                        searchPlaceholder="Tìm kiếm nhóm chức năng..."
                        noOptionsText="Không có nhóm chức năng phù hợp"
                        compact
                        usePortal
                        portalZIndex={2300}
                        portalMinWidth={260}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tìm tên chức năng
                      </p>
                      <div className="relative">
                        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          search
                        </span>
                        <input
                          type="text"
                          value={featureSearchKeyword}
                          onChange={(event) => setFeatureSearchKeyword(event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                          placeholder="Tìm kiếm tên chức năng theo nhóm..."
                        />
                        {featureSearchKeyword ? (
                          <button
                            type="button"
                            onClick={() => setFeatureSearchKeyword('')}
                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Xóa từ khóa tìm kiếm chức năng"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManage && (
                    <button
                      type="button"
                      onClick={addGroup}
                      disabled={activeTab !== 'editor'}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      Thêm nhóm
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
                Đang tải danh mục chức năng...
              </div>
            ) : activeTab === 'list' ? (
              featureListRows.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full border-collapse text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 w-24">STT</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Tên phân hệ/chức năng</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả chi tiết tính năng</th>
                          <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 w-40">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureListRows.map((row) => (
                          <tr key={row.key} className={`border-b border-slate-100 last:border-b-0 ${row.isGroup ? 'bg-slate-50/70' : 'bg-white'}`}>
                            <td className={`px-4 py-3 align-top ${row.isGroup ? 'text-lg font-bold text-slate-800' : 'text-sm text-slate-500'}`}>
                              {row.stt}
                            </td>
                            <td className={`px-4 py-3 align-top ${row.isGroup ? 'text-xl font-bold text-slate-900' : 'text-base font-semibold text-slate-800'}`}>
                              {row.name}
                            </td>
                            <td className="px-4 py-3 align-top text-sm leading-7 text-slate-700 whitespace-pre-line">
                              {row.detail}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {row.status ? (
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  row.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {FEATURE_STATUS_LABELS[row.status]}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                  <span className="material-symbols-outlined text-5xl text-slate-300">format_list_bulleted</span>
                  <p className="mt-4 text-base font-semibold text-slate-700">
                    {hasAnyCatalogGroups ? 'Không tìm thấy chức năng phù hợp với bộ lọc hiện tại.' : 'Chưa có chức năng nào để hiển thị.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {hasAnyCatalogGroups
                      ? 'Hãy đổi nhóm chức năng hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ danh mục.'
                      : 'Hãy thêm hoặc import danh mục chức năng rồi chuyển lại tab này để xem nhanh.'}
                  </p>
                </div>
              )
            ) : !hasAnyCatalogGroups ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                <span className="material-symbols-outlined text-5xl text-slate-300">fact_check</span>
                <p className="mt-4 text-base font-semibold text-slate-700">Sản phẩm này chưa có danh mục chức năng.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Tạo nhóm chức năng đầu tiên hoặc nhập từ file mẫu để bắt đầu.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={addGroup}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep-teal"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Thêm nhóm chức năng
                  </button>
                )}
              </div>
            ) : filteredDraftGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                <span className="material-symbols-outlined text-5xl text-slate-300">manage_search</span>
                <p className="mt-4 text-base font-semibold text-slate-700">Không tìm thấy chức năng phù hợp với bộ lọc hiện tại.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Hãy đổi nhóm chức năng hoặc xóa từ khóa tìm kiếm để xem lại đầy đủ danh mục.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDraftGroups.map((group, groupIndex) => (
                  <div key={String(group.id)} className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
                    <div className="border-b border-primary/10 bg-gradient-to-r from-primary/[0.08] via-white to-white px-4 py-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="grid flex-1 gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              STT
                            </label>
                            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                              {group.display_order || groupIndex + 1}
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                              <span className="material-symbols-outlined text-sm">layers</span>
                              Tên phân hệ / nhóm chức năng
                            </label>
                            <input
                              value={group.group_name}
                              onChange={(event) =>
                                updateGroup(group.id, (current) =>
                                  createDraftGroup({
                                    ...current,
                                    group_name: event.target.value,
                                  })
                                )
                              }
                              disabled={!canManage}
                              className="h-12 w-full rounded-2xl border border-primary/20 bg-white px-4 text-base font-semibold text-slate-950 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-100 disabled:text-slate-500"
                              placeholder="Ví dụ: Quản trị hệ thống"
                              title={group.group_name}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveGroup(group.id, 'up')}
                            disabled={!canManage || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (group.display_order || groupIndex + 1) === 1}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Đưa nhóm lên trên"
                          >
                            <span className="material-symbols-outlined text-base">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGroup(group.id, 'down')}
                            disabled={!canManage || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (group.display_order || groupIndex + 1) === draftGroups.length}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Đưa nhóm xuống dưới"
                          >
                            <span className="material-symbols-outlined text-base">arrow_downward</span>
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => addFeature(group.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              <span className="material-symbols-outlined text-base">playlist_add</span>
                              Thêm chức năng
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => removeGroup(group.id)}
                              disabled={(groupFeatureCountMap[String(group.id)] || 0) > 0}
                              title={(groupFeatureCountMap[String(group.id)] || 0) > 0 ? 'Hãy xóa hết chức năng con trước khi xóa nhóm.' : 'Xóa nhóm'}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                              Xóa nhóm
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Ghi chú nhóm
                        </label>
                        <textarea
                          value={group.notes}
                          onChange={(event) =>
                            updateGroup(group.id, (current) =>
                              createDraftGroup({
                                ...current,
                                notes: event.target.value,
                              })
                            )
                          }
                          disabled={!canManage}
                          rows={2}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="Ghi chú tổng quan cho phân hệ này nếu cần..."
                        />
                      </div>

                    </div>

                    <div className="divide-y divide-slate-200">
                      <div className="bg-slate-50/70 px-4 py-3">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <span className="material-symbols-outlined text-base text-primary">checklist</span>
                          Danh sách chức năng thuộc nhóm
                        </div>
                      </div>
                      {(group.features || []).length > 0 ? (
                        group.features.map((feature, featureIndex) => {
                          const featureEditing = isFeatureEditing(group.id, feature.id);
                          return (
                          <div
                            key={String(feature.id)}
                            className={`grid gap-4 px-4 py-4 lg:grid-cols-[88px_minmax(0,1.1fr)_minmax(0,1.5fr)_180px_164px] ${
                              featureEditing
                                ? 'bg-primary/5 ring-1 ring-primary/15'
                                : feature.status === 'INACTIVE'
                                  ? 'bg-amber-50/40'
                                  : 'bg-white'
                            }`}
                          >
                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                STT
                              </label>
                              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                                {group.display_order || groupIndex + 1}.{feature.display_order || featureIndex + 1}
                              </div>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Tên chức năng
                              </label>
                              <input
                                value={feature.feature_name}
                                onChange={(event) =>
                                  updateFeature(group.id, feature.id, (current) =>
                                    createDraftFeature({
                                      ...current,
                                      feature_name: event.target.value,
                                    })
                                  )
                                }
                                disabled={!canManage || !featureEditing}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-700"
                                placeholder="Ví dụ: Đăng nhập"
                                title={feature.feature_name}
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Mô tả chi tiết tính năng
                              </label>
                              <textarea
                                value={feature.detail_description}
                                onChange={(event) =>
                                  updateFeature(group.id, feature.id, (current) =>
                                    createDraftFeature({
                                      ...current,
                                      detail_description: event.target.value,
                                    })
                                  )
                                }
                                disabled={!canManage || !featureEditing}
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-700"
                                placeholder="Mô tả chi tiết nghiệp vụ / phạm vi của chức năng..."
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Trạng thái
                              </label>
                              <SearchableSelect
                                value={feature.status}
                                options={FEATURE_STATUS_OPTIONS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                                onChange={(value) =>
                                  updateFeature(group.id, feature.id, (current) =>
                                    createDraftFeature({
                                      ...current,
                                      status: value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                    })
                                  )
                                }
                                disabled={!canManage || !featureEditing}
                                compact
                              />
                            </div>

                            <div className="flex flex-wrap items-end gap-2">
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => toggleFeatureEditing(group.id, feature.id)}
                                  className={`rounded-xl border p-2 transition-colors ${
                                    featureEditing
                                      ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15'
                                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                  title={featureEditing ? 'Hoàn tất chỉnh sửa' : 'Sửa chức năng'}
                                  aria-label={featureEditing ? 'Hoàn tất chỉnh sửa chức năng' : 'Sửa chức năng'}
                                >
                                  <span className="material-symbols-outlined text-base">
                                    {featureEditing ? 'check' : 'edit'}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => moveFeature(group.id, feature.id, 'up')}
                                disabled={!canManage || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (feature.display_order || featureIndex + 1) === 1}
                                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Đưa chức năng lên trên"
                              >
                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveFeature(group.id, feature.id, 'down')}
                                disabled={!canManage || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (feature.display_order || featureIndex + 1) === (groupFeatureCountMap[String(group.id)] || group.features.length)}
                                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Đưa chức năng xuống dưới"
                              >
                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => removeFeature(group.id, feature.id)}
                                  className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
                                  title="Xóa chức năng"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )})
                      ) : (
                        <div className="px-4 py-6 text-sm text-slate-500">
                          Phân hệ này chưa có chức năng nào. {canManage ? 'Bạn có thể bấm "Thêm chức năng" để bổ sung.' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <span className="mr-auto text-sm text-slate-500">
                {isDirty ? 'Có thay đổi chưa lưu' : 'Danh mục đã đồng bộ với dữ liệu hiện tại'}
              </span>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Đóng
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoading || !isDirty || activeTab !== 'editor'}
                  title={!isDirty ? 'Chưa có thay đổi để lưu' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  {isSaving ? 'Đang lưu...' : 'Lưu danh mục chức năng'}
                </button>
              )}
            </div>
        </div>
        </div>
      </ModalWrapper>

      <div className="fixed bottom-5 right-5 z-[70] md:bottom-6 md:right-6">
        <div className="relative">
          {showAuditHistory ? (
            <div className="absolute bottom-[calc(100%+12px)] right-0 z-40 w-[380px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-300/70 backdrop-blur">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Lịch sử thay đổi</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Theo dõi các lần cập nhật catalog chức năng của sản phẩm này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditHistory(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Đóng lịch sử thay đổi"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="max-h-[min(60vh,520px)] overflow-y-auto px-4 py-4">
                {(catalog?.audit_logs || []).length > 0 ? (
                  <div className="space-y-3">
                    {(catalog?.audit_logs || []).map((log) => (
                      <details key={`${log.id}-${log.created_at}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {log.event === 'INSERT'
                                  ? 'Khởi tạo catalog'
                                  : log.event === 'DELETE'
                                    ? 'Xóa catalog'
                                    : 'Cập nhật catalog'}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {actorLabel(log.actor, log.created_by)} • {formatAuditDateTime(log.created_at)}
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-slate-400">expand_more</span>
                          </div>
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Trước thay đổi</p>
                            <pre className="max-h-48 overflow-auto rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-100">
                              {stringifyAuditPayload(log.old_values) || '—'}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sau thay đổi</p>
                            <pre className="max-h-48 overflow-auto rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-100">
                              {stringifyAuditPayload(log.new_values) || '—'}
                            </pre>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Chưa có lịch sử thay đổi nào cho danh mục chức năng.</p>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAuditHistory((previous) => !previous)}
            className={`group relative flex h-14 w-14 items-center justify-center rounded-full border border-white text-white shadow-xl transition-all hover:scale-[1.02] ${
              showAuditHistory
                ? 'bg-deep-teal shadow-primary/20'
                : 'bg-primary shadow-primary/25'
            }`}
            aria-label={showAuditHistory ? 'Đóng lịch sử thay đổi' : 'Xem lịch sử thay đổi'}
            title={showAuditHistory ? 'Đóng lịch sử thay đổi' : 'Xem lịch sử thay đổi'}
          >
            <span className="material-symbols-outlined text-[26px]">
              {showAuditHistory ? 'history_toggle_off' : 'history'}
            </span>
            {auditLogCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold leading-none text-slate-900">
                {auditLogCount > 99 ? '99+' : auditLogCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {showImportReviewModal && (
        <ImportModal
          title="Nhập dữ liệu danh mục chức năng"
          moduleKey="product_feature_catalog"
          onClose={() => !isImporting && setShowImportReviewModal(false)}
          onSave={handleApplyImportedCatalog}
          isLoading={isImporting}
          loadingText="Đang nạp dữ liệu..."
        />
      )}
    </>
  );
};

export default ProductFeatureCatalogModal;
