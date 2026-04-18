import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuditLog } from '../types/admin';
import type {
  Product,
  ProductFeatureCatalog,
  ProductFeatureCatalogPolicy,
  ProductFeatureCatalogListPage,
  ProductFeatureGroup,
  ProductFeatureStatus,
} from '../types/product';
import {
  fetchProductFeatureCatalog,
  fetchProductFeatureCatalogList,
  updateProductFeatureCatalog,
} from '../services/api/productApi';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { isoDateStamp } from '../utils/exportUtils';
import { useEscKey } from '../hooks/useEscKey';
import { ModalWrapper, ImportModal } from './modals';
import type { ImportPayload } from './modals/projectImportTypes';
import { SearchableSelect } from './SearchableSelect';

type NotifyFn = (type: 'success' | 'error', title: string, message: string) => void;

export type FeatureCatalogUpdatePayload = {
  groups: Array<{
    id?: string | number | null;
    uuid?: string | null;
    group_name: string;
    notes?: string | null;
    display_order?: number | null;
    features: Array<{
      id?: string | number | null;
      uuid?: string | null;
      feature_name: string;
      detail_description?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | null;
      display_order?: number | null;
    }>;
  }>;
  audit_context?: {
    source?: 'FORM' | 'IMPORT' | null;
    import_file_name?: string | null;
    import_sheet_name?: string | null;
    import_row_count?: number | null;
    import_group_count?: number | null;
    import_feature_count?: number | null;
  } | null;
};

export interface FeatureCatalogModalConfig {
  entityLabel: string;
  catalogLabel: string;
  listLabel: string;
  featureNounPlural: string;
  importModuleKey: string;
  templateFilename: string;
  exportFilenamePrefix: string;
  loadCatalog: (id: string | number) => Promise<ProductFeatureCatalog>;
  loadCatalogList: (
    id: string | number,
    params?: {
      page?: number;
      per_page?: number;
      group_id?: string | number | null;
      search?: string | null;
    }
  ) => Promise<ProductFeatureCatalogListPage>;
  updateCatalog: (id: string | number, payload: FeatureCatalogUpdatePayload) => Promise<ProductFeatureCatalog>;
}

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

type FeatureEditorDraft = {
  groupId: string | number;
  featureId: string | number;
  groupDisplayOrder: number;
  groupName: string;
  featureDisplayOrder: number;
  featureName: string;
  detailDescription: string;
  status: ProductFeatureStatus;
};

type FeatureListDisplayRow = {
  key: string;
  stt: string;
  name: string;
  detail: string;
  status: ProductFeatureStatus | null;
  isGroup: boolean;
};

type CatalogAuditContext = {
  source: 'FORM' | 'IMPORT';
  import_file_name?: string | null;
  import_sheet_name?: string | null;
  import_row_count?: number | null;
  import_group_count?: number | null;
  import_feature_count?: number | null;
};

type CatalogAuditFieldChange = {
  field?: string;
  label: string;
  from?: string | null;
  to?: string | null;
};

type CatalogAuditSummaryEntry = {
  entity_type?: string;
  action?: string;
  message: string;
  field_changes?: CatalogAuditFieldChange[];
};

type CatalogAuditSummary = {
  source?: string;
  counts?: Record<string, number>;
  import?: {
    file_name?: string | null;
    sheet_name?: string | null;
    row_count?: number | null;
    group_count?: number | null;
    feature_count?: number | null;
  };
  entries?: CatalogAuditSummaryEntry[];
};

interface ProductFeatureCatalogModalProps {
  product: Product;
  canManage?: boolean;
  onClose: () => void;
  onNotify?: NotifyFn;
  config?: FeatureCatalogModalConfig;
}

const FEATURE_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
] as const;

const PRODUCT_FEATURE_CATALOG_EDITOR_BREAKPOINT = 1024;

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

const GROUP_NAME_MAX_LENGTH = 255;
const FEATURE_NAME_MAX_LENGTH = 2000;

const DEFAULT_FEATURE_CATALOG_MODAL_CONFIG: FeatureCatalogModalConfig = {
  entityLabel: 'sản phẩm',
  catalogLabel: 'Danh mục chức năng',
  listLabel: 'Danh sách chức năng',
  featureNounPlural: 'chức năng',
  importModuleKey: 'product_feature_catalog',
  templateFilename: 'mau_nhap_danh_muc_chuc_nang_san_pham',
  exportFilenamePrefix: 'danh_muc_chuc_nang',
  loadCatalog: fetchProductFeatureCatalog,
  loadCatalogList: fetchProductFeatureCatalogList,
  updateCatalog: updateProductFeatureCatalog,
};

const createDefaultCatalogPolicy = (): ProductFeatureCatalogPolicy => ({
  owner_level: 'none',
  source: 'empty',
  can_edit: true,
  can_import: true,
  read_only: false,
  lock_reason: null,
  inherited_product_id: null,
  inherited_product_code: null,
  inherited_product_name: null,
  blocking_packages: [],
});

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const toText = (value: unknown): string => String(value ?? '').trim();

const toSentenceLabel = (value: string): string => {
  const text = toText(value);
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
};

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

const buildLengthExceededMessage = (label: string, maxLength: number, prefix?: string): string =>
  `${prefix ? `${prefix} ` : ''}${label} không được vượt quá ${maxLength} ký tự.`;

const assertMaxLength = (value: string, maxLength: number, message: string): void => {
  if (value.length > maxLength) {
    throw new Error(message);
  }
};

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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const toOptionalNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isPersistedCatalogRecord = (value: unknown): boolean => {
  const numeric = toOptionalNumber(value);
  return numeric !== null && numeric > 0;
};

const extractCatalogAuditSummary = (log: AuditLog): CatalogAuditSummary | null => {
  const payloads = [asRecord(log.new_values), asRecord(log.old_values)];

  for (const payload of payloads) {
    const summaryRecord = asRecord(payload?.change_summary);
    if (!summaryRecord) {
      continue;
    }

    const countsRecord = asRecord(summaryRecord.counts);
    const importRecord = asRecord(summaryRecord.import);
    const entries = Array.isArray(summaryRecord.entries)
      ? summaryRecord.entries.flatMap((entry): CatalogAuditSummaryEntry[] => {
          const entryRecord = asRecord(entry);
          if (!entryRecord) {
            return [];
          }

          const fieldChanges = Array.isArray(entryRecord.field_changes)
            ? entryRecord.field_changes.flatMap((change): CatalogAuditFieldChange[] => {
                const changeRecord = asRecord(change);
                if (!changeRecord) {
                  return [];
                }

                const label = toText(changeRecord.label);
                if (!label) {
                  return [];
                }

                return [{
                  field: toText(changeRecord.field) || undefined,
                  label,
                  from: changeRecord.from === null || typeof changeRecord.from === 'undefined' ? null : String(changeRecord.from),
                  to: changeRecord.to === null || typeof changeRecord.to === 'undefined' ? null : String(changeRecord.to),
                }];
              })
            : [];

          const message = toText(entryRecord.message);
          if (!message) {
            return [];
          }

          return [{
            entity_type: toText(entryRecord.entity_type) || undefined,
            action: toText(entryRecord.action) || undefined,
            message,
            field_changes: fieldChanges,
          }];
        })
      : [];

    return {
      source: toText(summaryRecord.source) || undefined,
      counts: countsRecord
        ? Object.entries(countsRecord).reduce<Record<string, number>>((accumulator, [key, rawValue]) => {
            const value = toOptionalNumber(rawValue);
            if (value !== null) {
              accumulator[key] = value;
            }
            return accumulator;
          }, {})
        : undefined,
      import: importRecord
        ? {
            file_name: toText(importRecord.file_name) || null,
            sheet_name: toText(importRecord.sheet_name) || null,
            row_count: toOptionalNumber(importRecord.row_count),
            group_count: toOptionalNumber(importRecord.group_count),
            feature_count: toOptionalNumber(importRecord.feature_count),
          }
        : undefined,
      entries,
    };
  }

  return null;
};

const catalogAuditSourceLabel = (summary: CatalogAuditSummary | null, fallbackEvent: string): string => {
  if (summary?.source === 'IMPORT') {
    return 'Lưu từ import';
  }

  if (fallbackEvent === 'INSERT') {
    return 'Khởi tạo catalog';
  }

  if (fallbackEvent === 'DELETE') {
    return 'Xóa catalog';
  }

  return 'Cập nhật trên form';
};

const formatCatalogAuditCount = (summary: CatalogAuditSummary | null, action: 'created' | 'updated' | 'deleted'): string | null => {
  if (!summary?.counts) {
    return null;
  }

  const groupCount = summary.counts[`groups_${action}`] || 0;
  const featureCount = summary.counts[`features_${action}`] || 0;
  if (groupCount <= 0 && featureCount <= 0) {
    return null;
  }

  const parts: string[] = [];
  if (groupCount > 0) {
    parts.push(`${groupCount} phân hệ`);
  }
  if (featureCount > 0) {
    parts.push(`${featureCount} chức năng`);
  }

  const verb = action === 'created' ? 'Tạo' : action === 'updated' ? 'Cập nhật' : 'Xóa';
  return `${verb}: ${parts.join(', ')}`;
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

const buildCatalogPayload = (groups: DraftGroup[], auditContext?: CatalogAuditContext | null) => ({
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
  ...(auditContext ? { audit_context: auditContext } : {}),
});

const buildCatalogSignature = (groups: DraftGroup[]): string =>
  JSON.stringify(buildCatalogPayload(groups));

const buildFeatureListRowsFromDraftGroups = (groups: DraftGroup[]): FeatureListDisplayRow[] =>
  normalizeDraftGroups(groups).flatMap((group, groupIndex) => ([
    {
      key: `group-${group.id}`,
      stt: toRomanLabel(group.display_order || groupIndex + 1),
      name: group.group_name,
      detail: toText(group.notes) || 'Danh sách chức năng thuộc phân hệ này.',
      status: null,
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
  ]));

const buildFeatureListRowsFromPage = (page: ProductFeatureCatalogListPage | null): FeatureListDisplayRow[] =>
  (page?.rows || []).map((row) => ({
    key: row.row_type === 'group'
      ? `group-${String(row.group_id)}`
      : `feature-${String(row.feature_id ?? `${row.group_id}-${row.feature_display_order ?? 0}`)}`,
    stt: row.row_type === 'group'
      ? toRomanLabel(row.group_display_order || 1)
      : String(row.feature_display_order || 1),
    name: toText(row.name),
    detail: row.row_type === 'group'
      ? (toText(row.detail) || 'Danh sách chức năng thuộc phân hệ này.')
      : (toText(row.detail) || '—'),
    status: null,
    isGroup: row.row_type === 'group',
  }));

const buildFeatureDocumentRows = (groups: DraftGroup[]) =>
  normalizeDraftGroups(groups).flatMap((group, groupIndex) => {
    const normalizedGroupIndex = group.display_order || groupIndex + 1;
    const groupRow = [
      { value: toRomanLabel(normalizedGroupIndex), styleId: 'CatalogSttGroup' },
      { value: toText(group.group_name), styleId: 'CatalogGroupName' },
      { value: '', styleId: 'CatalogGroupDetail' },
    ];

    if ((group.features || []).length === 0) {
      return [groupRow];
    }

    return [
      groupRow,
      ...(group.features || []).map((feature, featureIndex) => [
        { value: feature.display_order || featureIndex + 1, styleId: 'CatalogSttFeature' },
        { value: toText(feature.feature_name), styleId: 'CatalogFeatureName' },
        { value: formatDocumentDetailText(feature.detail_description), styleId: 'CatalogFeatureDetail' },
      ]),
    ];
  });

const BULLET_MARKER_PATTERN = '[-+*•●▪◦–—]';
const ORDERED_MARKER_PATTERN = '\\d+[.)]';

const formatDocumentDetailText = (value: unknown): string => {
  const text = toText(value);
  if (!text) {
    return '';
  }

  const normalizeListLine = (line: string, markerPattern: string, markerSpacingPattern: RegExp): string[] =>
    line
      .replace(new RegExp(`\\s+(?=${markerPattern})`, 'g'), '\n')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `\u00A0${item.replace(markerSpacingPattern, '$1 ')}`);

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(new RegExp(`([:;])\\s*(?=(?:${BULLET_MARKER_PATTERN}|${ORDERED_MARKER_PATTERN}))`, 'g'), '$1\n ');

  return normalized
    .split('\n')
    .flatMap((line) => {
      const trimmedLeft = line.trimStart();
      const trimmed = trimmedLeft.trimEnd();
      if (!trimmed) {
        return [''];
      }

      if (new RegExp(`^${BULLET_MARKER_PATTERN}`).test(trimmed)) {
        return normalizeListLine(trimmed, `${BULLET_MARKER_PATTERN}(?=\\S|\\s)`, new RegExp(`^(${BULLET_MARKER_PATTERN})\\s*`));
      }

      if (new RegExp(`^${ORDERED_MARKER_PATTERN}`).test(trimmed)) {
        return normalizeListLine(trimmed, `${ORDERED_MARKER_PATTERN}(?=\\S|\\s)`, /^(\d+[.)])\s*/);
      }

      return [trimmed];
    })
    .map((line) => {
      if (!line) {
        return '';
      }
      return line;
    })
    .join('\n');
};

const findHeaderIndex = (headers: string[], candidates: string[]): number =>
  headers.findIndex((header) => candidates.includes(normalizeToken(header)));

const isRomanOrdinalLabel = (value: string): boolean => {
  const token = toText(value).toUpperCase();
  return token !== '' && /^[IVXLCDM]+$/.test(token);
};

const parseCompactImportedGroups = (
  rows: string[][],
  compactOrderIndex: number,
  compactNameIndex: number,
  compactDetailIndex: number,
  productCodeIndex: number,
  acceptedProductCodeTokens: string[]
): DraftGroup[] => {
  const groups: DraftGroup[] = [];
  let currentGroup: DraftGroup | null = null;

  rows.forEach((row, rowIndex) => {
    const productCode = productCodeIndex >= 0 ? toText(row[productCodeIndex]) : '';
    if (productCode && acceptedProductCodeTokens.length > 0 && !acceptedProductCodeTokens.includes(normalizeToken(productCode))) {
      return;
    }

    const rowName = toText(row[compactNameIndex]);
    if (!rowName) {
      return;
    }

    const rawOrder = compactOrderIndex >= 0 ? toText(row[compactOrderIndex]) : '';
    const detail = compactDetailIndex >= 0 ? toText(row[compactDetailIndex]) : '';

    if (isRomanOrdinalLabel(rawOrder)) {
      assertMaxLength(
        rowName,
        GROUP_NAME_MAX_LENGTH,
        buildLengthExceededMessage('Tên nhóm/phân hệ', GROUP_NAME_MAX_LENGTH, `Dòng import #${rowIndex + 1}`)
      );
      currentGroup = createDraftGroup({
        group_name: rowName,
        notes: detail,
        display_order: groups.length + 1,
        features: [],
      });
      groups.push(currentGroup);
      return;
    }

    if (!currentGroup) {
      assertMaxLength(
        rowName,
        GROUP_NAME_MAX_LENGTH,
        buildLengthExceededMessage('Tên nhóm/phân hệ', GROUP_NAME_MAX_LENGTH, `Dòng import #${rowIndex + 1}`)
      );
      currentGroup = createDraftGroup({
        group_name: rowName,
        notes: detail,
        display_order: groups.length + 1,
        features: [],
      });
      groups.push(currentGroup);
      return;
    }

    assertMaxLength(
      rowName,
      FEATURE_NAME_MAX_LENGTH,
      buildLengthExceededMessage('Tên chức năng', FEATURE_NAME_MAX_LENGTH, `Dòng import #${rowIndex + 1}`)
    );
    currentGroup.features.push(
      createDraftFeature({
        feature_name: rowName,
        detail_description: detail,
        status: 'ACTIVE',
        display_order: Number(rawOrder) || currentGroup.features.length + 1,
      })
    );
  });

  if (groups.length === 0) {
    throw new Error('Không tìm thấy dòng dữ liệu hợp lệ cho sản phẩm đang chọn trong file import.');
  }

  return normalizeDraftGroups(groups);
};

const parseImportedGroups = (headers: string[], rows: string[][], expectedProductCodes: string[]): DraftGroup[] => {
  const acceptedProductCodeTokens = expectedProductCodes.map((code) => normalizeToken(code)).filter(Boolean);
  const productCodeIndex = findHeaderIndex(headers, ['masanpham', 'masp', 'productcode']);
  const compactOrderIndex = findHeaderIndex(headers, ['stt']);
  const compactNameIndex = findHeaderIndex(headers, ['tenphanhechucnang', 'tennhomphanhechucnang']);
  const compactDetailIndex = findHeaderIndex(headers, ['motachitiettinhnang', 'motachitiet', 'mota']);
  const groupOrderIndex = findHeaderIndex(headers, ['sttnhom', 'sttnhomchucnang', 'thu tunhom']);
  const groupNameIndex = findHeaderIndex(headers, ['tennhomphanhe', 'tenphanhe', 'tennhomchucnang', 'tennhom']);
  const featureOrderIndex = findHeaderIndex(headers, ['sttchucnang', 'thutuchucnang', 'stttinhnang']);
  const featureNameIndex = findHeaderIndex(headers, ['tenchucnang', 'tentinhnang']);
  const detailIndex = findHeaderIndex(headers, ['motachitiet', 'motachitiettinhnang', 'mota']);
  const statusIndex = findHeaderIndex(headers, ['trangthai', 'status']);

  if (compactOrderIndex >= 0 && compactNameIndex >= 0) {
    return parseCompactImportedGroups(
      rows,
      compactOrderIndex,
      compactNameIndex,
      compactDetailIndex,
      productCodeIndex,
      acceptedProductCodeTokens
    );
  }

  if (groupNameIndex < 0) {
    throw new Error('File import chưa có cột "Tên nhóm/phân hệ".');
  }

  const groups = new Map<string, DraftGroup>();

  rows.forEach((row, rowIndex) => {
    const productCode = productCodeIndex >= 0 ? toText(row[productCodeIndex]) : '';
    if (productCode && acceptedProductCodeTokens.length > 0 && !acceptedProductCodeTokens.includes(normalizeToken(productCode))) {
      return;
    }

    const groupName = toText(row[groupNameIndex]);
    if (!groupName) {
      return;
    }

    assertMaxLength(
      groupName,
      GROUP_NAME_MAX_LENGTH,
      buildLengthExceededMessage('Tên nhóm/phân hệ', GROUP_NAME_MAX_LENGTH, `Dòng import #${rowIndex + 1}`)
    );

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

    assertMaxLength(
      featureName,
      FEATURE_NAME_MAX_LENGTH,
      buildLengthExceededMessage('Tên chức năng', FEATURE_NAME_MAX_LENGTH, `Dòng import #${rowIndex + 1}`)
    );

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

const mergeImportedFeaturesWithExisting = (
  importedFeatures: DraftFeature[],
  existingFeatures: DraftFeature[]
): DraftFeature[] => {
  const remainingByOrder = new Map<number, DraftFeature[]>();
  const remainingByName = new Map<string, DraftFeature[]>();

  existingFeatures.forEach((feature) => {
    const orderKey = Number(feature.display_order) || 0;
    if (orderKey > 0) {
      const bucket = remainingByOrder.get(orderKey) || [];
      bucket.push(feature);
      remainingByOrder.set(orderKey, bucket);
    }

    const nameKey = normalizeToken(feature.feature_name);
    if (nameKey) {
      const bucket = remainingByName.get(nameKey) || [];
      bucket.push(feature);
      remainingByName.set(nameKey, bucket);
    }
  });

  const consumeFeature = (feature: DraftFeature) => {
    const orderKey = Number(feature.display_order) || 0;
    if (orderKey > 0) {
      const orderBucket = remainingByOrder.get(orderKey) || [];
      if (orderBucket.length > 0) {
        const matched = orderBucket.shift()!;
        if (orderBucket.length === 0) {
          remainingByOrder.delete(orderKey);
        } else {
          remainingByOrder.set(orderKey, orderBucket);
        }

        const nameKey = normalizeToken(matched.feature_name);
        if (nameKey) {
          const nameBucket = remainingByName.get(nameKey) || [];
          const nextNameBucket = nameBucket.filter((item) => String(item.id) !== String(matched.id));
          if (nextNameBucket.length === 0) {
            remainingByName.delete(nameKey);
          } else {
            remainingByName.set(nameKey, nextNameBucket);
          }
        }

        return matched;
      }
    }

    const nameKey = normalizeToken(feature.feature_name);
    if (!nameKey) {
      return null;
    }

    const nameBucket = remainingByName.get(nameKey) || [];
    if (nameBucket.length === 0) {
      return null;
    }

    const matched = nameBucket.shift()!;
    if (nameBucket.length === 0) {
      remainingByName.delete(nameKey);
    } else {
      remainingByName.set(nameKey, nameBucket);
    }

    const matchedOrderKey = Number(matched.display_order) || 0;
    if (matchedOrderKey > 0) {
      const orderBucket = remainingByOrder.get(matchedOrderKey) || [];
      const nextOrderBucket = orderBucket.filter((item) => String(item.id) !== String(matched.id));
      if (nextOrderBucket.length === 0) {
        remainingByOrder.delete(matchedOrderKey);
      } else {
        remainingByOrder.set(matchedOrderKey, nextOrderBucket);
      }
    }

    return matched;
  };

  return importedFeatures.map((feature) => {
    const matched = consumeFeature(feature);
    if (!matched) {
      return feature;
    }

    return createDraftFeature({
      ...feature,
      id: matched.id,
      persistedId: matched.persistedId ?? matched.id,
      uuid: matched.uuid ?? feature.uuid ?? null,
      created_at: matched.created_at ?? feature.created_at ?? null,
      created_by: matched.created_by ?? feature.created_by ?? null,
      updated_at: matched.updated_at ?? feature.updated_at ?? null,
      updated_by: matched.updated_by ?? feature.updated_by ?? null,
      created_by_actor: matched.created_by_actor ?? feature.created_by_actor ?? null,
      updated_by_actor: matched.updated_by_actor ?? feature.updated_by_actor ?? null,
    });
  });
};

const mergeImportedGroupsWithExisting = (
  importedGroups: DraftGroup[],
  existingGroups: DraftGroup[]
): DraftGroup[] => {
  const remainingByOrder = new Map<number, DraftGroup[]>();
  const remainingByName = new Map<string, DraftGroup[]>();

  existingGroups.forEach((group) => {
    const orderKey = Number(group.display_order) || 0;
    if (orderKey > 0) {
      const bucket = remainingByOrder.get(orderKey) || [];
      bucket.push(group);
      remainingByOrder.set(orderKey, bucket);
    }

    const nameKey = normalizeToken(group.group_name);
    if (nameKey) {
      const bucket = remainingByName.get(nameKey) || [];
      bucket.push(group);
      remainingByName.set(nameKey, bucket);
    }
  });

  const consumeGroup = (group: DraftGroup) => {
    const orderKey = Number(group.display_order) || 0;
    if (orderKey > 0) {
      const orderBucket = remainingByOrder.get(orderKey) || [];
      if (orderBucket.length > 0) {
        const matched = orderBucket.shift()!;
        if (orderBucket.length === 0) {
          remainingByOrder.delete(orderKey);
        } else {
          remainingByOrder.set(orderKey, orderBucket);
        }

        const nameKey = normalizeToken(matched.group_name);
        if (nameKey) {
          const nameBucket = remainingByName.get(nameKey) || [];
          const nextNameBucket = nameBucket.filter((item) => String(item.id) !== String(matched.id));
          if (nextNameBucket.length === 0) {
            remainingByName.delete(nameKey);
          } else {
            remainingByName.set(nameKey, nextNameBucket);
          }
        }

        return matched;
      }
    }

    const nameKey = normalizeToken(group.group_name);
    if (!nameKey) {
      return null;
    }

    const nameBucket = remainingByName.get(nameKey) || [];
    if (nameBucket.length === 0) {
      return null;
    }

    const matched = nameBucket.shift()!;
    if (nameBucket.length === 0) {
      remainingByName.delete(nameKey);
    } else {
      remainingByName.set(nameKey, nameBucket);
    }

    const matchedOrderKey = Number(matched.display_order) || 0;
    if (matchedOrderKey > 0) {
      const orderBucket = remainingByOrder.get(matchedOrderKey) || [];
      const nextOrderBucket = orderBucket.filter((item) => String(item.id) !== String(matched.id));
      if (nextOrderBucket.length === 0) {
        remainingByOrder.delete(matchedOrderKey);
      } else {
        remainingByOrder.set(matchedOrderKey, nextOrderBucket);
      }
    }

    return matched;
  };

  return normalizeDraftGroups(importedGroups.map((group) => {
    const matched = consumeGroup(group);
    if (!matched) {
      return group;
    }

    return createDraftGroup({
      ...group,
      id: matched.id,
      persistedId: matched.persistedId ?? matched.id,
      uuid: matched.uuid ?? group.uuid ?? null,
      notes: toText(group.notes) || matched.notes || '',
      created_at: matched.created_at ?? group.created_at ?? null,
      created_by: matched.created_by ?? group.created_by ?? null,
      updated_at: matched.updated_at ?? group.updated_at ?? null,
      updated_by: matched.updated_by ?? group.updated_by ?? null,
      created_by_actor: matched.created_by_actor ?? group.created_by_actor ?? null,
      updated_by_actor: matched.updated_by_actor ?? group.updated_by_actor ?? null,
      features: mergeImportedFeaturesWithExisting(group.features || [], matched.features || []),
    });
  }));
};

export const ProductFeatureCatalogModal: React.FC<ProductFeatureCatalogModalProps> = ({
  product,
  canManage = false,
  onClose,
  onNotify,
  config = DEFAULT_FEATURE_CATALOG_MODAL_CONFIG,
}) => {
  const entityLabel = toText(config.entityLabel) || 'sản phẩm';
  const entityLabelCapitalized = toSentenceLabel(entityLabel);
  const catalogLabel = toText(config.catalogLabel) || 'Danh mục chức năng';
  const catalogLabelLower = catalogLabel.toLocaleLowerCase('vi-VN');
  const listLabel = toText(config.listLabel) || 'Danh sách chức năng';
  const featureNounPlural = toText(config.featureNounPlural) || 'chức năng';
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? PRODUCT_FEATURE_CATALOG_EDITOR_BREAKPOINT : window.innerWidth
  );
  const [activeTab, setActiveTab] = useState<'editor' | 'list'>(() =>
    typeof window === 'undefined' || window.innerWidth >= PRODUCT_FEATURE_CATALOG_EDITOR_BREAKPOINT ? 'editor' : 'list'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [catalog, setCatalog] = useState<ProductFeatureCatalog | null>(null);
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importMenuStyle, setImportMenuStyle] = useState<React.CSSProperties>({});
  const [showImportReviewModal, setShowImportReviewModal] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState('');
  const [editingFeatureKeys, setEditingFeatureKeys] = useState<string[]>([]);
  const [featureEditorDraft, setFeatureEditorDraft] = useState<FeatureEditorDraft | null>(null);
  const [featureEditorError, setFeatureEditorError] = useState('');
  const [initialSignature, setInitialSignature] = useState(() => buildCatalogSignature([]));
  const [pendingAuditContext, setPendingAuditContext] = useState<CatalogAuditContext | null>(null);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isListLoadingMore, setIsListLoadingMore] = useState(false);
  const [isLoadingAllListPages, setIsLoadingAllListPages] = useState(false);
  const [listRows, setListRows] = useState<FeatureListDisplayRow[]>([]);
  const [listMeta, setListMeta] = useState<ProductFeatureCatalogListPage['meta'] | null>(null);
  const [hasAttemptedListLoadMore, setHasAttemptedListLoadMore] = useState(false);
  const [listGroupFilters, setListGroupFilters] = useState<ProductFeatureCatalogListPage['group_filters']>([]);
  const [listCatalogPolicy, setListCatalogPolicy] = useState<ProductFeatureCatalogPolicy | null>(null);
  const [listCatalogScope, setListCatalogScope] = useState<ProductFeatureCatalog['catalog_scope'] | null>(null);
  const [listCatalogProduct, setListCatalogProduct] = useState<ProductFeatureCatalog['product'] | null>(null);
  const listRequestIdRef = useRef(0);
  const featureEditorNameInputRef = useRef<HTMLInputElement>(null);
  const importMenuButtonRef = useRef<HTMLButtonElement>(null);
  const canUsePortal = typeof document !== 'undefined';
  const showEditorTab = viewportWidth >= PRODUCT_FEATURE_CATALOG_EDITOR_BREAKPOINT;

  useEscKey(() => setShowImportMenu(false), showImportMenu);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (showEditorTab || activeTab !== 'editor') {
      return;
    }

    setActiveTab('list');
  }, [activeTab, showEditorTab]);

  const syncImportMenuPlacement = useCallback(() => {
    if (!showImportMenu || !importMenuButtonRef.current) {
      return;
    }

    const rect = importMenuButtonRef.current.getBoundingClientRect();
    const width = 240;
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const left = Math.min(Math.max(12, rect.left), maxLeft);

    setImportMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left,
      width,
      zIndex: 150,
    });
  }, [showImportMenu]);

  useEffect(() => {
    if (!showImportMenu || !canUsePortal) {
      return;
    }

    syncImportMenuPlacement();
    window.addEventListener('resize', syncImportMenuPlacement);
    window.addEventListener('scroll', syncImportMenuPlacement, true);

    return () => {
      window.removeEventListener('resize', syncImportMenuPlacement);
      window.removeEventListener('scroll', syncImportMenuPlacement, true);
    };
  }, [canUsePortal, showImportMenu, syncImportMenuPlacement]);

  const productSummary = catalog?.product || listCatalogProduct || {
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
  const catalogScope = catalog?.catalog_scope ?? listCatalogScope ?? {
    catalog_product_id: product.id,
    product_ids: [product.id],
    package_count: productSummary.catalog_package_count ?? 1,
    product_codes: [product.product_code],
  };
  const catalogPolicy = catalog?.catalog_policy ?? listCatalogPolicy ?? createDefaultCatalogPolicy();
  const acceptedProductCodes = useMemo(
    () => Array.from(new Set((catalogScope.product_codes || []).map((code) => toText(code)).filter(Boolean))),
    [catalogScope.product_codes]
  );
  const canEditCatalog = canManage && catalogPolicy.can_edit;
  const canImportCatalog = canManage && catalogPolicy.can_import;
  const isPolicyLoading = canManage && catalog === null && listCatalogPolicy === null;
  const importButtonTitle = useMemo(() => {
    if (isPolicyLoading) {
      return `Đang tải trạng thái ${catalogLabelLower}...`;
    }
    if (catalogPolicy.lock_reason === 'blocked_by_product') {
      const inheritedLabel = [catalogPolicy.inherited_product_code, catalogPolicy.inherited_product_name]
        .map((value) => toText(value))
        .filter(Boolean)
        .join(' - ');
      return inheritedLabel
        ? `Đang tham chiếu từ product ${inheritedLabel}. Không thể nhập tại ${entityLabel}.`
        : `Đang tham chiếu từ product. Không thể nhập tại ${entityLabel}.`;
    }
    if (catalogPolicy.lock_reason === 'blocked_by_package') {
      const packageLabels = (catalogPolicy.blocking_packages || [])
        .map((pkg) => [toText(pkg.package_code), toText(pkg.package_name)].filter(Boolean).join(' - '))
        .filter(Boolean);
      return packageLabels.length > 0
        ? `Product đang bị khóa vì đã có danh sách chức năng ở package: ${packageLabels.join(', ')}.`
        : 'Product đang bị khóa vì đã có danh sách chức năng ở package.';
    }
    return undefined;
  }, [catalogLabelLower, catalogPolicy, entityLabel, isPolicyLoading]);
  const policyNotice = useMemo(() => {
    if (catalogPolicy.lock_reason === 'blocked_by_product') {
      const inheritedLabel = [catalogPolicy.inherited_product_code, catalogPolicy.inherited_product_name]
        .map((value) => toText(value))
        .filter(Boolean)
        .join(' - ');

      return {
        title: 'Đang tham chiếu từ product',
        message: inheritedLabel
          ? `${entityLabelCapitalized} này đang dùng danh mục từ product ${inheritedLabel} và hiện ở chế độ chỉ đọc.`
          : `${entityLabelCapitalized} này đang dùng danh mục từ product và hiện ở chế độ chỉ đọc.`,
      };
    }

    if (catalogPolicy.lock_reason === 'blocked_by_package') {
      const packageLabels = (catalogPolicy.blocking_packages || [])
        .map((pkg) => [toText(pkg.package_code), toText(pkg.package_name)].filter(Boolean).join(' - '))
        .filter(Boolean);

      return {
        title: 'Product bị khóa vì đã có danh sách chức năng ở package',
        message: packageLabels.length > 0
          ? `Sản phẩm này chỉ đọc vì các package sau đã có danh sách chức năng riêng: ${packageLabels.join(', ')}.`
          : 'Sản phẩm này chỉ đọc vì đã có danh sách chức năng ở package.',
      };
    }

    return null;
  }, [catalogPolicy, entityLabelCapitalized]);
  const isSharedAcrossPackages = (catalogScope.package_count || productSummary.catalog_package_count || 1) > 1;
  const auditLogCount = (catalog?.audit_logs || []).length;
  const normalizedDraftGroups = useMemo(() => normalizeDraftGroups(draftGroups), [draftGroups]);
  const featureEditorContext = useMemo(() => {
    if (!featureEditorDraft) {
      return null;
    }

    const targetGroup = normalizedDraftGroups.find((group) => String(group.id) === String(featureEditorDraft.groupId));
    const targetFeature = targetGroup?.features?.find((feature) => String(feature.id) === String(featureEditorDraft.featureId));

    if (!targetGroup || !targetFeature) {
      return null;
    }

    return {
      group: targetGroup,
      feature: targetFeature,
      siblingFeatures: (targetGroup.features || []).map((feature) => ({
        id: feature.id,
        displayOrder: feature.display_order,
        name: toText(feature.feature_name) || 'Chưa đặt tên',
      })),
    };
  }, [featureEditorDraft, normalizedDraftGroups]);
  const normalizedFeatureSearchKeyword = useMemo(
    () => normalizeToken(featureSearchKeyword),
    [featureSearchKeyword]
  );
  const availableGroupFilters = useMemo(() => {
    if (normalizedDraftGroups.length > 0) {
      return normalizedDraftGroups.map((group) => ({
        value: String(group.id),
        label: toText(group.group_name) || `Phân hệ ${group.display_order}`,
        searchText: `${group.group_name} ${group.notes}`,
      }));
    }

    return (listGroupFilters || []).map((group) => ({
      value: String(group.id),
      label: toText(group.group_name) || `Phân hệ ${group.display_order}`,
      searchText: `${group.group_name} ${group.notes ?? ''}`,
    }));
  }, [listGroupFilters, normalizedDraftGroups]);
  const groupFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: `Tất cả nhóm ${featureNounPlural}` },
      ...availableGroupFilters,
    ],
    [availableGroupFilters, featureNounPlural]
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
  const hasAnyListGroups = listGroupFilters.length > 0 || (listMeta?.total ?? 0) > 0;
  const localFeatureListRows = useMemo(
    () => buildFeatureListRowsFromDraftGroups(filteredDraftGroups),
    [filteredDraftGroups]
  );
  const isDirty = useMemo(
    () => buildCatalogSignature(draftGroups) !== initialSignature,
    [draftGroups, initialSignature]
  );
  const hasLoadedServerList = listMeta !== null || isListLoading || isListLoadingMore;
  const shouldUseServerList = activeTab === 'list' && !isDirty && (!hasAnyCatalogGroups || hasLoadedServerList);
  const featureListRows = shouldUseServerList ? listRows : localFeatureListRows;

  const loadCatalog = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await config.loadCatalog(product.id);
      const nextDraftGroups = toDraftGroups(result.groups || []);
      setCatalog(result);
      setDraftGroups(nextDraftGroups);
      setEditingFeatureKeys([]);
      setInitialSignature(buildCatalogSignature(nextDraftGroups));
      setPendingAuditContext(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Không thể tải ${catalogLabelLower}.`;
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFeatureListPage = async (page: number, append: boolean) => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;

    if (append) {
      setHasAttemptedListLoadMore(true);
      setIsListLoadingMore(true);
    } else {
      setHasAttemptedListLoadMore(false);
      setIsListLoading(true);
      setErrorMessage('');
      setListRows([]);
      setListMeta(null);
    }

    try {
      const result = await config.loadCatalogList(product.id, {
        page,
        per_page: 100,
        group_id: selectedGroupFilter === 'ALL' ? null : selectedGroupFilter,
        search: featureSearchKeyword || null,
      });

      if (requestId !== listRequestIdRef.current) {
        return;
      }

      setListCatalogProduct(result.product || null);
      setListCatalogScope(result.catalog_scope ?? null);
      setListCatalogPolicy(result.catalog_policy ?? createDefaultCatalogPolicy());
      setListGroupFilters(result.group_filters || []);
      setListMeta(result.meta || null);
      setListRows((previous) => {
        const nextRows = buildFeatureListRowsFromPage(result);
        if (!append) {
          return nextRows;
        }

        const existingKeys = new Set(previous.map((row) => row.key));
        return [
          ...previous,
          ...nextRows.filter((row) => !existingKeys.has(row.key)),
        ];
      });
    } catch (error) {
      if (requestId !== listRequestIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : `Không thể tải ${listLabel.toLocaleLowerCase('vi-VN')}.`;
      setErrorMessage(message);
    } finally {
      if (requestId === listRequestIdRef.current) {
        setIsListLoading(false);
        setIsListLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    setActiveTab(
      typeof window === 'undefined' || window.innerWidth >= PRODUCT_FEATURE_CATALOG_EDITOR_BREAKPOINT ? 'editor' : 'list'
    );
    setCatalog(null);
    setDraftGroups([]);
    setErrorMessage('');
    setSelectedGroupFilter('ALL');
    setFeatureSearchKeyword('');
    setEditingFeatureKeys([]);
    setInitialSignature(buildCatalogSignature([]));
    setPendingAuditContext(null);
    setIsLoading(true);
    setIsListLoading(false);
    setIsListLoadingMore(false);
    setIsLoadingAllListPages(false);
    setListRows([]);
    setListMeta(null);
    setHasAttemptedListLoadMore(false);
    setListGroupFilters([]);
    setListCatalogPolicy(null);
    setListCatalogScope(null);
    setListCatalogProduct(null);
    listRequestIdRef.current = 0;
  }, [product.id]);

  useEffect(() => {
    if (activeTab !== 'editor' || catalog !== null) {
      return;
    }

    void loadCatalog();
  }, [activeTab, catalog, product.id]);

  useEffect(() => {
    if (activeTab !== 'list' || isDirty) {
      return;
    }

    void loadFeatureListPage(1, false);
  }, [activeTab, isDirty, product.id, selectedGroupFilter, featureSearchKeyword]);

  useEffect(() => {
    if (selectedGroupFilter === 'ALL') {
      return;
    }

    const groupStillExists = availableGroupFilters.some((group) => group.value === selectedGroupFilter);
    if (!groupStillExists) {
      setSelectedGroupFilter('ALL');
    }
  }, [availableGroupFilters, selectedGroupFilter]);

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

  const hasMoreListPages = (listMeta?.page ?? 0) < (listMeta?.total_pages ?? 0);

  const loadAllRemainingListPages = async () => {
    if (!shouldUseServerList || isListLoading || isListLoadingMore || isLoadingAllListPages || !hasMoreListPages) {
      return;
    }

    setHasAttemptedListLoadMore(true);
    setIsLoadingAllListPages(true);

    try {
      let nextPage = (listMeta?.page ?? 0) + 1;
      const totalPages = listMeta?.total_pages ?? 0;

      while (nextPage > 0 && nextPage <= totalPages) {
        // eslint-disable-next-line no-await-in-loop
        await loadFeatureListPage(nextPage, true);
        nextPage += 1;
      }
    } finally {
      setIsLoadingAllListPages(false);
    }
  };

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!shouldUseServerList || isListLoading || isListLoadingMore || isLoadingAllListPages || !hasMoreListPages) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight > 220) {
      return;
    }

    void loadFeatureListPage((listMeta?.page ?? 0) + 1, true);
  };

  const requestClose = () => {
    if ((isSaving || isImporting) || !isDirty) {
      onClose();
      return;
    }

    if (window.confirm(`${catalogLabel} đang có thay đổi chưa lưu. Bạn vẫn muốn đóng?`)) {
      onClose();
    }
  };

  const notifyCatalogLocked = (actionLabel: string) => {
    const fallbackMessage = `Không thể ${actionLabel} khi ${catalogLabelLower} đang ở chế độ chỉ đọc.`;
    onNotify?.(
      'error',
      'Danh mục đang bị khóa',
      importButtonTitle || fallbackMessage
    );
  };

  const updateGroup = (groupId: string | number, updater: (group: DraftGroup) => DraftGroup) => {
    if (!canEditCatalog) {
      return;
    }

    setPendingAuditContext((previous) => previous?.source === 'FORM' ? previous : { source: 'FORM' });
    setDraftGroups((previous) =>
      normalizeDraftGroups(
        previous.map((group) => (String(group.id) === String(groupId) ? updater(group) : group))
      )
    );
  };

  const openFeatureEditorWithData = (group: DraftGroup, feature: DraftFeature) => {
    const nextDraft: FeatureEditorDraft = {
      groupId: group.id,
      featureId: feature.id,
      groupDisplayOrder: group.display_order || 1,
      groupName: group.group_name,
      featureDisplayOrder: feature.display_order || 1,
      featureName: feature.feature_name,
      detailDescription: feature.detail_description,
      status: feature.status,
    };

    setEditingFeatureKeys([buildFeatureEditKey(group.id, feature.id)]);
    setFeatureEditorError('');
    setFeatureEditorDraft(nextDraft);
  };

  const openFeatureEditor = (groupId: string | number, featureId: string | number) => {
    if (!canEditCatalog) {
      return;
    }

    const targetGroup = normalizedDraftGroups.find((group) => String(group.id) === String(groupId));
    const targetFeature = targetGroup?.features?.find((feature) => String(feature.id) === String(featureId));
    if (!targetGroup || !targetFeature) {
      return;
    }

    openFeatureEditorWithData(targetGroup, targetFeature);
  };

  const closeFeatureEditor = () => {
    setEditingFeatureKeys([]);
    setFeatureEditorDraft(null);
    setFeatureEditorError('');
  };

  useEffect(() => {
    if (featureEditorDraft && !featureEditorContext) {
      closeFeatureEditor();
    }
  }, [featureEditorContext, featureEditorDraft]);

  useEffect(() => {
    if (!featureEditorDraft || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      featureEditorNameInputRef.current?.focus();
      featureEditorNameInputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [featureEditorDraft?.groupId, featureEditorDraft?.featureId]);

  const addGroup = () => {
    if (!canEditCatalog) {
      notifyCatalogLocked('thêm nhóm');
      return;
    }

    setPendingAuditContext((previous) => previous?.source === 'FORM' ? previous : { source: 'FORM' });
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
      openFeatureEditorWithData(nextGroup, nextGroup.features[0]);
    }
  };

  const removeGroup = (groupId: string | number) => {
    if (!canEditCatalog) {
      notifyCatalogLocked('xóa nhóm');
      return;
    }

    const targetGroup = draftGroups.find((group) => String(group.id) === String(groupId));
    if (targetGroup && isPersistedCatalogRecord(targetGroup.id)) {
      onNotify?.(
        'error',
        'Không thể xóa nhóm',
        `Nhóm "${toText(targetGroup.group_name) || 'Chưa đặt tên'}" đã phát sinh dữ liệu danh mục chức năng. Không thể xóa nhóm đã lưu.`
      );
      return;
    }

    if (targetGroup && (targetGroup.features || []).length > 0) {
      onNotify?.(
        'error',
        'Không thể xóa nhóm',
        `Nhóm "${toText(targetGroup.group_name) || 'Chưa đặt tên'}" đang có chức năng con. Vui lòng xóa hết chức năng con trước khi xóa nhóm.`
      );
      return;
    }

    setPendingAuditContext((previous) => previous?.source === 'FORM' ? previous : { source: 'FORM' });
    setDraftGroups((previous) =>
      normalizeDraftGroups(previous.filter((group) => String(group.id) !== String(groupId)))
    );
  };

  const moveGroup = (groupId: string | number, direction: 'up' | 'down') => {
    if (!canEditCatalog) {
      return;
    }

    setPendingAuditContext((previous) => previous?.source === 'FORM' ? previous : { source: 'FORM' });
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
    if (!canEditCatalog) {
      notifyCatalogLocked('thêm chức năng');
      return;
    }

    const nextFeature = createDraftFeature({ feature_name: '', status: 'ACTIVE' });
    const sourceGroup = normalizedDraftGroups.find((group) => String(group.id) === String(groupId));
    updateGroup(groupId, (group) =>
      createDraftGroup({
        ...group,
        features: [...(group.features || []), nextFeature],
      })
    );
    openFeatureEditorWithData(
      createDraftGroup({
        ...(sourceGroup || createDraftGroup({ id: groupId })),
        features: [...(sourceGroup?.features || []), nextFeature],
      }),
      nextFeature
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
    if (!canEditCatalog) {
      notifyCatalogLocked('xóa chức năng');
      return;
    }

    if (featureEditorDraft && String(featureEditorDraft.groupId) === String(groupId) && String(featureEditorDraft.featureId) === String(featureId)) {
      closeFeatureEditor();
    }
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
    if (!canEditCatalog) {
      return;
    }

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

  const applyFeatureEditor = () => {
    if (!canEditCatalog) {
      notifyCatalogLocked('cập nhật chức năng');
      return;
    }

    if (!featureEditorDraft) {
      return;
    }

    const nextGroupName = toText(featureEditorDraft.groupName);
    const nextFeatureName = toText(featureEditorDraft.featureName);

    if (!nextGroupName) {
      setFeatureEditorError('Tên nhóm chức năng không được để trống.');
      return;
    }

    if (!nextFeatureName) {
      setFeatureEditorError('Tên chức năng không được để trống.');
      return;
    }

    if (nextGroupName.length > GROUP_NAME_MAX_LENGTH) {
      setFeatureEditorError(buildLengthExceededMessage('Tên nhóm chức năng', GROUP_NAME_MAX_LENGTH));
      return;
    }

    if (nextFeatureName.length > FEATURE_NAME_MAX_LENGTH) {
      setFeatureEditorError(buildLengthExceededMessage('Tên chức năng', FEATURE_NAME_MAX_LENGTH));
      return;
    }

    updateGroup(featureEditorDraft.groupId, (group) =>
      createDraftGroup({
        ...group,
        group_name: nextGroupName,
        features: (group.features || []).map((feature) =>
          String(feature.id) === String(featureEditorDraft.featureId)
            ? createDraftFeature({
                ...feature,
                feature_name: nextFeatureName,
                detail_description: featureEditorDraft.detailDescription,
                status: featureEditorDraft.status,
              })
            : feature
        ),
      })
    );
    closeFeatureEditor();
  };

  const validateDraft = (): string | null => {
    const seenGroups = new Set<string>();

    for (let groupIndex = 0; groupIndex < draftGroups.length; groupIndex += 1) {
      const group = draftGroups[groupIndex];
      const groupName = toText(group.group_name);
      if (!groupName) {
        return `Phân hệ #${groupIndex + 1} chưa có tên nhóm chức năng.`;
      }
      if (groupName.length > GROUP_NAME_MAX_LENGTH) {
        return `Phân hệ #${groupIndex + 1} có tên nhóm chức năng vượt quá ${GROUP_NAME_MAX_LENGTH} ký tự.`;
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
        if (featureName.length > FEATURE_NAME_MAX_LENGTH) {
          return `Phân hệ #${groupIndex + 1} có chức năng #${featureIndex + 1} có tên vượt quá ${FEATURE_NAME_MAX_LENGTH} ký tự.`;
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
    if (!canEditCatalog) {
      notifyCatalogLocked('lưu');
      return;
    }

    if (!isDirty) {
      onNotify?.('error', 'Chưa có thay đổi', `${catalogLabel} chưa có thay đổi mới để lưu.`);
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
      const auditContext = pendingAuditContext ?? { source: 'FORM' as const };
      const result = await config.updateCatalog(product.id, buildCatalogPayload(draftGroups, auditContext));
      const nextDraftGroups = toDraftGroups(result.groups || []);
      setCatalog(result);
      setDraftGroups(nextDraftGroups);
      setInitialSignature(buildCatalogSignature(nextDraftGroups));
      setPendingAuditContext(null);
      if (activeTab === 'list') {
        void loadFeatureListPage(1, false);
      }
      onNotify?.('success', catalogLabel, `Đã lưu ${catalogLabelLower} của ${entityLabel}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Không thể lưu ${catalogLabelLower}.`;
      setErrorMessage(message);
      onNotify?.('error', 'Lưu thất bại', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadExcelWorkbook(config.templateFilename, [
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
    downloadExcelWorkbook(`${config.exportFilenamePrefix}_${productSummary.product_code}_${isoDateStamp()}`, [
      {
        name: 'DanhMucChucNang',
        headers: ['STT', 'Tên phân hệ/chức năng', 'Mô tả chi tiết tính năng'],
        headerStyleId: 'CatalogHeader',
        columns: [52, 420, 860],
        styles: [
          {
            id: 'CatalogHeader',
            fontName: 'Times New Roman',
            fontSize: 13,
            bold: true,
            horizontal: 'Center',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogSttGroup',
            fontName: 'Times New Roman',
            fontSize: 13,
            bold: true,
            horizontal: 'Center',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogGroupName',
            fontName: 'Times New Roman',
            fontSize: 13,
            bold: true,
            horizontal: 'Left',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogGroupDetail',
            fontName: 'Times New Roman',
            fontSize: 13,
            horizontal: 'Left',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogSttFeature',
            fontName: 'Times New Roman',
            fontSize: 13,
            horizontal: 'Center',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogFeatureName',
            fontName: 'Times New Roman',
            fontSize: 13,
            horizontal: 'Left',
            vertical: 'Center',
            wrapText: true,
            border: true,
          },
          {
            id: 'CatalogFeatureDetail',
            fontName: 'Times New Roman',
            fontSize: 13,
            horizontal: 'Left',
            vertical: 'Top',
            wrapText: true,
            border: true,
          },
        ],
        rows: buildFeatureDocumentRows(draftGroups),
      },
    ]);
  };

  const handleApplyImportedCatalog = async (payload: ImportPayload) => {
    if (!canImportCatalog) {
      notifyCatalogLocked('nhập dữ liệu');
      return;
    }

    setIsImporting(true);
    setErrorMessage('');

    try {
      if (isDirty && !window.confirm('Danh mục hiện có thay đổi chưa lưu. Bạn muốn ghi đè bằng dữ liệu import?')) {
        return;
      }

      const importedGroups = parseImportedGroups(payload.headers || [], payload.rows || [], acceptedProductCodes);
      const mergedGroups = mergeImportedGroupsWithExisting(importedGroups, normalizedDraftGroups);
      setDraftGroups(mergedGroups);
      setPendingAuditContext({
        source: 'IMPORT',
        import_file_name: toText(payload.fileName) || null,
        import_sheet_name: toText(payload.sheetName) || null,
        import_row_count: (payload.rows || []).length,
        import_group_count: importedGroups.length,
        import_feature_count: importedGroups.reduce((total, group) => total + (group.features || []).length, 0),
      });
      setShowImportReviewModal(false);
      onNotify?.('success', `Import ${catalogLabelLower}`, `Đã nạp ${mergedGroups.length} phân hệ từ file, vui lòng kiểm tra rồi bấm Lưu.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Không thể import ${catalogLabelLower}.`;
      onNotify?.('error', 'Import thất bại', message);
    } finally {
      setIsImporting(false);
    }
  };

  const importMenuContent = showImportMenu ? (
    <>
      <div className="fixed inset-0 z-[140]" onClick={() => setShowImportMenu(false)} />
      <div
        role="menu"
        style={canUsePortal ? importMenuStyle : undefined}
        className={`flex min-w-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${
          canUsePortal ? '' : 'absolute left-0 top-full z-20 mt-2'
        }`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowImportMenu(false);
            setShowImportReviewModal(true);
          }}
          className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
        >
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Nhập dữ liệu
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowImportMenu(false);
            handleDownloadTemplate();
          }}
          className="flex items-center gap-3 border-t border-slate-100 px-5 py-4 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          Tải file mẫu
        </button>
      </div>
    </>
  ) : null;

  const modalTitleSegments = [toText(productSummary.product_code), toText(productSummary.product_name)].filter(Boolean);
  const modalTitle = modalTitleSegments.length > 0
    ? `${catalogLabel}: ${modalTitleSegments.join(' - ')}`
    : catalogLabel;

  return (
    <>
      <ModalWrapper
        onClose={requestClose}
        title={modalTitle}
        icon="fact_check"
        width="max-w-[92vw]"
        heightClass="h-[calc(100vh-32px)]"
        minHeightClass="min-h-[calc(100vh-32px)]"
        maxHeightClass="max-h-[calc(100vh-32px)]"
        panelClassName="rounded-none"
        headerClassName="gap-2 px-4 py-2.5 md:px-5"
        disableClose={isSaving || isImporting}
        headerAside={(
          <>
            {canManage ? (
              <div className="relative">
                <button
                  ref={importMenuButtonRef}
                  type="button"
                  onClick={() => {
                    if (!canImportCatalog || isPolicyLoading) {
                      return;
                    }
                    setShowImportMenu((prev) => !prev);
                  }}
                  disabled={isImporting || !canImportCatalog || isPolicyLoading}
                  title={importButtonTitle}
                  aria-label="Nhập"
                  aria-haspopup="menu"
                  aria-expanded={showImportMenu}
                  className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>upload</span>
                  Nhập
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 15 }}>expand_more</span>
                </button>
                {importMenuContent ? (canUsePortal ? createPortal(importMenuContent, document.body) : importMenuContent) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                Tải file mẫu
              </button>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_view</span>
              Xuất Excel
            </button>
          </>
        )}
      >
      <div className={`bg-[#f8f4eb] px-3 pb-0 pt-2 ${activeTab === 'list' ? 'flex min-h-full flex-col gap-3' : 'space-y-3'}`}>
        {errorMessage ? (
          <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {errorMessage}
          </div>
        ) : null}

        {policyNotice ? (
          <div className="rounded-lg border border-secondary/20 bg-secondary/5 px-3 py-2.5 text-xs text-slate-700">
            <p className="font-semibold text-secondary">{policyNotice.title}</p>
            <p className="mt-1 text-slate-600">{policyNotice.message}</p>
          </div>
        ) : null}

        <div className={activeTab === 'list' ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white px-3">
                <div
                  data-testid="catalog-tab-switcher"
                  className={showEditorTab
                    ? 'grid grid-cols-2 gap-1 sm:flex sm:items-center sm:gap-1 sm:overflow-x-auto'
                    : 'flex items-center justify-center'}
                >
                  {showEditorTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('editor')}
                      className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-center text-xs font-semibold leading-tight transition-colors sm:whitespace-nowrap sm:px-3 ${
                        activeTab === 'editor'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                      Cập nhật danh mục
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-center text-xs font-semibold leading-tight transition-colors sm:whitespace-nowrap sm:px-3 ${
                      showEditorTab ? '' : 'w-full'
                    } ${
                      activeTab === 'list'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>table_rows</span>
                    {listLabel}
                  </button>
                </div>
              </div>

              <div className="sticky top-0 z-20 border-t border-slate-100 bg-white px-3 py-2">
                <div className="mx-auto flex max-w-[1180px] flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex min-w-0 items-center gap-2 md:w-[340px] md:max-w-[340px]">
                    <label className="shrink-0 text-xs font-semibold text-neutral">Nhóm</label>
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value={selectedGroupFilter}
                        options={groupFilterOptions}
                        onChange={(value) => setSelectedGroupFilter(value || 'ALL')}
                        placeholder={`Tất cả nhóm ${featureNounPlural}`}
                        searchPlaceholder={`Tìm kiếm nhóm ${featureNounPlural}...`}
                        noOptionsText={`Không có nhóm ${featureNounPlural} phù hợp`}
                        usePortal
                        portalZIndex={2300}
                        portalMinWidth={260}
                        triggerClassName="flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 md:flex-1">
                    <label className="shrink-0 text-xs font-semibold text-neutral">Tìm kiếm</label>
                    <div className="relative min-w-0 flex-1">
                      <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>
                        search
                      </span>
                      <input
                        type="text"
                        value={featureSearchKeyword}
                        onChange={(event) => setFeatureSearchKeyword(event.target.value)}
                        className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-8 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
                        placeholder={`Tìm kiếm tên ${featureNounPlural} theo nhóm...`}
                      />
                      {featureSearchKeyword ? (
                        <button
                          type="button"
                          onClick={() => setFeatureSearchKeyword('')}
                          className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          aria-label={`Xóa từ khóa tìm kiếm ${featureNounPlural}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManage && showEditorTab && (
                    <button
                      type="button"
                      onClick={addGroup}
                      disabled={!canEditCatalog || activeTab !== 'editor' || isPolicyLoading}
                      title={!canEditCatalog ? importButtonTitle : undefined}
                      className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                      Thêm nhóm
                    </button>
                  )}
                </div>
                </div>
              </div>
            </div>

            {activeTab === 'editor' && isLoading ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 shadow-sm">
                {`Đang tải ${catalogLabelLower}...`}
              </div>
            ) : activeTab === 'list' ? (
              shouldUseServerList && isListLoading && featureListRows.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 shadow-sm">
                  {`Đang tải ${listLabel.toLocaleLowerCase('vi-VN')}...`}
                </div>
              ) : (
              featureListRows.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-hidden border border-slate-300 bg-white shadow-sm">
                  <div
                    className="h-full overflow-auto"
                    onScroll={handleListScroll}
                    data-testid="feature-list-scroll"
                  >
                    <table
                      data-testid="feature-list-table"
                      className="w-full table-fixed border-collapse bg-white text-left lg:min-w-[1080px]"
                    >
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr>
                          <th className="w-[64px] border border-slate-900 px-1.5 py-2 text-center font-serif text-[0.92rem] font-bold text-slate-950 sm:w-[72px] sm:px-2 sm:py-3 sm:text-[1rem]">
                            STT
                          </th>
                          <th className="w-[42%] border border-slate-900 px-2 py-2 text-center font-serif text-[0.92rem] font-bold text-slate-950 sm:px-3 sm:py-3 sm:text-[1rem] lg:w-[32%]">
                            Tên phân hệ/chức năng
                          </th>
                          <th className="border border-slate-900 px-2 py-2 text-center font-serif text-[0.92rem] font-bold text-slate-950 sm:px-3 sm:py-3 sm:text-[1rem]">
                            Mô tả chi tiết tính năng
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {featureListRows.map((row) => {
                          if (row.isGroup) {
                            return (
                            <tr key={row.key} className="bg-white align-middle">
                              <td className="border border-slate-900 px-1.5 py-2 text-center align-top font-serif text-[0.98rem] font-bold text-slate-950 sm:px-2 sm:py-2.5 sm:text-[1.08rem]">
                                  {row.stt}
                              </td>
                                <td className="border border-slate-900 px-2 py-2 text-left align-top font-serif text-[1rem] font-bold leading-[1.35] text-slate-950 break-words [overflow-wrap:anywhere] sm:px-3 sm:py-2.5 sm:text-[1.08rem]">
                                  {row.name}
                                </td>
                                <td className="border border-slate-900 px-2 py-2 align-top font-serif text-[0.88rem] leading-[1.5] text-slate-950 whitespace-pre-line break-words [overflow-wrap:anywhere] sm:px-3 sm:py-2.5 sm:text-[0.98rem]">
                                  {toText(row.detail) === 'Danh sách chức năng thuộc phân hệ này.' ? '' : row.detail}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={row.key} className="bg-white align-middle">
                              <td className="border border-slate-900 px-1.5 py-2 text-center align-top font-serif text-[0.9rem] font-normal text-slate-950 sm:px-2 sm:py-2.5 sm:text-[1rem]">
                                {row.stt}
                              </td>
                              <td className="border border-slate-900 px-2 py-2 text-left align-top font-serif text-[0.95rem] font-medium leading-[1.45] text-slate-950 break-words [overflow-wrap:anywhere] sm:px-3 sm:py-2.5 sm:text-[1rem]">
                                {row.name}
                              </td>
                              <td className="border border-slate-900 px-2 py-2 align-top font-serif text-[0.84rem] font-normal leading-[1.55] text-slate-950 whitespace-pre-line break-words [overflow-wrap:anywhere] sm:px-3 sm:py-2.5 sm:text-[0.98rem]">
                                {row.detail}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {shouldUseServerList && (isListLoadingMore || isLoadingAllListPages) ? (
                      <div className="border-x border-b border-slate-300 px-4 py-3 text-center text-xs text-slate-500">
                        {isLoadingAllListPages ? `Đang tải toàn bộ ${featureNounPlural}...` : `Đang tải thêm ${featureNounPlural}...`}
                      </div>
                    ) : shouldUseServerList && hasMoreListPages ? (
                      <div className="border-x border-b border-slate-300 px-4 py-2.5 text-center text-[11px] text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-3">
                          <span>{`Đang hiển thị ${featureListRows.length} / ${listMeta?.total ?? 0} ${featureNounPlural} — ${hasAttemptedListLoadMore ? 'bấm "Tải thêm" để tiếp tục' : 'kéo xuống để xem thêm'}`}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void loadFeatureListPage((listMeta?.page ?? 0) + 1, true)}
                              disabled={isListLoading || isListLoadingMore}
                              className="inline-flex items-center rounded border border-primary/40 bg-white px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Tải thêm
                            </button>
                            <button
                              type="button"
                              onClick={() => void loadAllRemainingListPages()}
                              disabled={!hasMoreListPages || isListLoading || isListLoadingMore || isLoadingAllListPages}
                              className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Tải hết
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center shadow-sm">
                  <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>format_list_bulleted</span>
                  <p className="mt-3 text-xs font-semibold text-slate-700">
                    {(shouldUseServerList ? hasAnyListGroups : hasAnyCatalogGroups) ? `Không tìm thấy ${featureNounPlural} phù hợp với bộ lọc hiện tại.` : `Chưa có ${featureNounPlural} nào để hiển thị.`}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {(shouldUseServerList ? hasAnyListGroups : hasAnyCatalogGroups)
                      ? `Hãy đổi nhóm ${featureNounPlural} hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ danh mục.`
                      : canEditCatalog
                        ? `Hãy thêm hoặc import ${catalogLabelLower} rồi chuyển lại tab này để xem nhanh.`
                        : `Danh mục hiện đang ở chế độ chỉ đọc.`}
                  </p>
                </div>
              )
              )
            ) : !hasAnyCatalogGroups ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center shadow-sm">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>fact_check</span>
                <p className="mt-3 text-xs font-semibold text-slate-700">{`${entityLabelCapitalized} này chưa có ${catalogLabelLower}.`}</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {canEditCatalog
                    ? `Tạo nhóm ${featureNounPlural} đầu tiên hoặc nhập từ file mẫu để bắt đầu.`
                    : `Danh mục này hiện ở chế độ chỉ đọc nên chưa thể tạo dữ liệu mới.`}
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={addGroup}
                    disabled={!canEditCatalog || isPolicyLoading}
                    title={!canEditCatalog ? importButtonTitle : undefined}
                    className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                    {`Thêm nhóm ${featureNounPlural}`}
                  </button>
                )}
              </div>
            ) : filteredDraftGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center shadow-sm">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>manage_search</span>
                <p className="mt-3 text-xs font-semibold text-slate-700">{`Không tìm thấy ${featureNounPlural} phù hợp với bộ lọc hiện tại.`}</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  {`Hãy đổi nhóm ${featureNounPlural} hoặc xóa từ khóa tìm kiếm để xem lại đầy đủ danh mục.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDraftGroups.map((group, groupIndex) => {
                  const isPersistedGroup = isPersistedCatalogRecord(group.id);
                  const hasChildFeatures = (groupFeatureCountMap[String(group.id)] || 0) > 0;
                  const deleteGroupTitle = isPersistedGroup
                    ? 'Dữ liệu đã phát sinh. Không thể xóa nhóm đã lưu.'
                    : hasChildFeatures
                      ? 'Hãy xóa hết chức năng con trước khi xóa nhóm.'
                      : 'Xóa nhóm';

                  return (
                    <div key={String(group.id)} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-end">
                            <div className="w-20 shrink-0">
                              <label className="mb-1 block text-xs font-semibold text-neutral">
                                STT
                              </label>
                              <div className="flex h-8 items-center justify-center rounded border border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-700">
                                {toRomanLabel(group.display_order || groupIndex + 1)}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 xl:max-w-[1000px]">
                              <label className="mb-1 block text-xs font-semibold text-neutral">Tên phân hệ / nhóm chức năng</label>
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
                                maxLength={GROUP_NAME_MAX_LENGTH}
                                disabled={!canEditCatalog}
                                className="h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="Ví dụ: Quản trị hệ thống"
                                title={group.group_name}
                              />
                            </div>
                          </div>

                          <div className="flex flex-nowrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => moveGroup(group.id, 'up')}
                              disabled={!canEditCatalog || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (group.display_order || groupIndex + 1) === 1}
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Đưa nhóm lên trên"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_upward</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGroup(group.id, 'down')}
                              disabled={!canEditCatalog || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (group.display_order || groupIndex + 1) === draftGroups.length}
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Đưa nhóm xuống dưới"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_downward</span>
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => addFeature(group.id)}
                                disabled={!canEditCatalog || isPolicyLoading}
                                title={!canEditCatalog ? importButtonTitle : undefined}
                                className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>playlist_add</span>
                                Thêm chức năng
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => removeGroup(group.id)}
                                disabled={!canEditCatalog || isPersistedGroup || hasChildFeatures}
                                title={deleteGroupTitle}
                                className="inline-flex items-center gap-1.5 rounded border border-error/30 bg-error/10 px-2.5 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                                Xóa nhóm
                              </button>
                            )}
                          </div>
                        </div>

                      </div>

                      <div className="divide-y divide-slate-100">
                        <div className="bg-slate-50 px-3 py-1.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>checklist</span>
                            Danh sách chức năng thuộc nhóm
                          </div>
                        </div>
                        {(group.features || []).length > 0 ? (
                        group.features.map((feature, featureIndex) => {
                          const featureEditing = isFeatureEditing(group.id, feature.id);
                          return (
                          <div
                            key={String(feature.id)}
                            className={`grid gap-2.5 px-3 py-2 lg:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.25fr)_220px] ${
                              featureEditing
                                ? 'bg-primary/5 ring-1 ring-primary/20'
                                : feature.status === 'INACTIVE'
                                  ? 'bg-warning/10'
                                  : 'bg-white'
                            }`}
                          >
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-neutral">
                                STT
                              </label>
                              <div className="flex h-8 items-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                                {feature.display_order || featureIndex + 1}
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-neutral">
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
                              disabled
                                className="h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-700"
                                placeholder="Ví dụ: Đăng nhập"
                                title={feature.feature_name}
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-neutral">
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
                              disabled
                                rows={3}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-700 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-700"
                                placeholder="Mô tả chi tiết nghiệp vụ / phạm vi của chức năng..."
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-neutral">
                                Trạng thái
                              </label>
                              <div className="flex flex-col gap-1.5">
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
                                  disabled
                                  compact
                                  triggerClassName="flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-none"
                                />

                                <div className="flex flex-nowrap items-center gap-1.5">
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => openFeatureEditor(group.id, feature.id)}
                                      disabled={!canEditCatalog || isPolicyLoading}
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors ${
                                        featureEditing
                                          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                      } disabled:cursor-not-allowed disabled:opacity-40`}
                                      title="Sửa chức năng"
                                      aria-label="Sửa chức năng"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => moveFeature(group.id, feature.id, 'up')}
                                    disabled={!canEditCatalog || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (feature.display_order || featureIndex + 1) === 1}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Đưa chức năng lên trên"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_upward</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveFeature(group.id, feature.id, 'down')}
                                    disabled={!canEditCatalog || selectedGroupFilter !== 'ALL' || normalizedFeatureSearchKeyword !== '' || (feature.display_order || featureIndex + 1) === (groupFeatureCountMap[String(group.id)] || group.features.length)}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Đưa chức năng xuống dưới"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_downward</span>
                                  </button>
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => removeFeature(group.id, feature.id)}
                                      disabled={!canEditCatalog || isPolicyLoading}
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-error/30 bg-error/10 text-error transition-colors hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
                                      title="Xóa chức năng"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )})
                        ) : (
                          <div className="px-3 py-4 text-xs text-slate-500">
                            Phân hệ này chưa có chức năng nào. {canEditCatalog ? 'Bạn có thể bấm "Thêm chức năng" để bổ sung.' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'editor' ? (
              <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#f8f4eb] via-[#f8f4eb] to-transparent px-3 pb-3 pt-2">
                <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                  <span className="mr-auto text-xs text-slate-400">
                    {isDirty ? 'Có thay đổi chưa lưu' : 'Danh mục đã đồng bộ với dữ liệu hiện tại'}
                  </span>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!canEditCatalog || isSaving || isLoading || !isDirty || activeTab !== 'editor'}
                      title={!canEditCatalog ? importButtonTitle : (!isDirty ? 'Chưa có thay đổi để lưu' : undefined)}
                      className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
                      {isSaving ? 'Đang lưu...' : `Lưu ${catalogLabelLower}`}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
        </div>
        </div>
      </ModalWrapper>

      {featureEditorDraft ? (
        <ModalWrapper
          onClose={closeFeatureEditor}
          title={featureEditorDraft.featureName ? `Chỉnh sửa chức năng: ${featureEditorDraft.featureName}` : 'Chỉnh sửa chức năng mới'}
          icon="edit_note"
          width="max-w-[1120px]"
          maxHeightClass="max-h-[92vh]"
          panelClassName="rounded-2xl"
          headerClassName="gap-2 px-5 py-4"
        >
          <div className="space-y-4 bg-slate-50/70 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_300px]">
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3">
                    <h3 className="text-xs font-bold text-slate-700">Thông tin nhóm chức năng</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral">
                        STT nhóm
                      </label>
                      <div className="flex h-8 items-center justify-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                        {toRomanLabel(featureEditorDraft.groupDisplayOrder || 1)}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral">
                        Tên phân hệ / nhóm chức năng
                      </label>
                      <input
                        value={featureEditorDraft.groupName}
                        onChange={(event) => {
                          setFeatureEditorError('');
                          setFeatureEditorDraft((previous) => previous ? ({
                            ...previous,
                            groupName: event.target.value,
                          }) : previous);
                        }}
                        maxLength={GROUP_NAME_MAX_LENGTH}
                        disabled={!canEditCatalog}
                        className="h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="Ví dụ: Quản trị hệ thống"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3">
                    <h3 className="text-xs font-bold text-slate-700">Thông tin chức năng</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)_220px]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral">
                        STT chức năng
                      </label>
                      <div className="flex h-8 items-center justify-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                        {featureEditorDraft.featureDisplayOrder || 1}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral">
                        Tên chức năng
                      </label>
                      <input
                        ref={featureEditorNameInputRef}
                        value={featureEditorDraft.featureName}
                        onChange={(event) => {
                          setFeatureEditorError('');
                          setFeatureEditorDraft((previous) => previous ? ({
                            ...previous,
                            featureName: event.target.value,
                          }) : previous);
                        }}
                        maxLength={FEATURE_NAME_MAX_LENGTH}
                        disabled={!canEditCatalog}
                        className="h-8 w-full rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="Ví dụ: Đăng nhập"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral">
                        Trạng thái
                      </label>
                      <SearchableSelect
                        value={featureEditorDraft.status}
                        options={FEATURE_STATUS_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        onChange={(value) => {
                          setFeatureEditorError('');
                          setFeatureEditorDraft((previous) => previous ? ({
                            ...previous,
                            status: value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          }) : previous);
                        }}
                        disabled={!canEditCatalog}
                        triggerClassName="flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-neutral">
                      Mô tả chi tiết tính năng
                    </label>
                    <textarea
                      value={featureEditorDraft.detailDescription}
                      onChange={(event) => {
                        setFeatureEditorError('');
                        setFeatureEditorDraft((previous) => previous ? ({
                          ...previous,
                          detailDescription: event.target.value,
                        }) : previous);
                      }}
                      disabled={!canEditCatalog}
                      rows={10}
                      className="min-h-[220px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-700 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="Mô tả chi tiết nghiệp vụ / phạm vi của chức năng..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-700">Các chức năng trong nhóm</h4>
                  <div className="mt-3 space-y-1.5">
                    {(featureEditorContext?.siblingFeatures || []).map((feature) => {
                      const isCurrent = String(feature.id) === String(featureEditorDraft.featureId);
                      return (
                        <div
                          key={String(feature.id)}
                          className={`rounded border px-2.5 py-2 text-xs transition-colors ${
                            isCurrent
                              ? 'border-primary/30 bg-primary/5 text-primary'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                              isCurrent ? 'bg-primary/15 text-primary' : 'bg-white text-slate-500'
                            }`}>
                              {feature.displayOrder || 0}
                            </span>
                            <span className="min-w-0 flex-1 leading-5">{feature.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {featureEditorError ? (
              <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
                {featureEditorError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <button
                type="button"
                onClick={closeFeatureEditor}
                className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={applyFeatureEditor}
                disabled={!canEditCatalog}
                className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
                Cập nhật thông tin
              </button>
            </div>
          </div>
        </ModalWrapper>
      ) : null}

      <div className="fixed bottom-5 right-5 z-[70] md:bottom-6 md:right-6">
        <div className="relative">
          {showAuditHistory ? (
            <div className="absolute bottom-[calc(100%+10px)] right-0 z-40 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Lịch sử thay đổi</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {`Theo dõi các lần cập nhật ${catalogLabelLower} của ${entityLabel} này.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditHistory(false)}
                  className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Đóng lịch sử thay đổi"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div className="max-h-[min(60vh,480px)] overflow-y-auto px-3 py-3">
                {(catalog?.audit_logs || []).length > 0 ? (
                  <div className="space-y-2.5">
                    {(catalog?.audit_logs || []).map((log) => (
                      <details key={`${log.id}-${log.created_at}`} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {(() => {
                                const summary = extractCatalogAuditSummary(log);
                                const createdCount = formatCatalogAuditCount(summary, 'created');
                                const updatedCount = formatCatalogAuditCount(summary, 'updated');
                                const deletedCount = formatCatalogAuditCount(summary, 'deleted');

                                return (
                                  <>
                              <p className="text-xs font-semibold text-slate-900">
                                      {catalogAuditSourceLabel(summary, log.event)}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {actorLabel(log.actor, log.created_by)} • {formatAuditDateTime(log.created_at)}
                              </p>
                                    {summary?.import ? (
                                      <div className="mt-1.5 rounded border border-secondary/20 bg-secondary/5 px-2.5 py-1.5 text-[10px] text-secondary">
                                        <p className="font-bold">Nguồn import</p>
                                        <p className="mt-0.5">
                                          File: {summary.import.file_name || 'Không rõ'}
                                          {summary.import.sheet_name ? ` • Sheet: ${summary.import.sheet_name}` : ''}
                                        </p>
                                        <p className="mt-0.5">
                                          {(summary.import.row_count ?? 0) > 0 ? `${summary.import.row_count} dòng` : '0 dòng'}
                                          {(summary.import.group_count ?? 0) > 0 ? ` • ${summary.import.group_count} phân hệ` : ''}
                                          {(summary.import.feature_count ?? 0) > 0 ? ` • ${summary.import.feature_count} chức năng` : ''}
                                        </p>
                                      </div>
                                    ) : null}
                                    {(createdCount || updatedCount || deletedCount) ? (
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {createdCount ? (
                                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            {createdCount}
                                          </span>
                                        ) : null}
                                        {updatedCount ? (
                                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                            {updatedCount}
                                          </span>
                                        ) : null}
                                        {deletedCount ? (
                                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                            {deletedCount}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </div>
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>expand_more</span>
                          </div>
                        </summary>
                        <div className="mt-2.5 space-y-2">
                          {(() => {
                            const summary = extractCatalogAuditSummary(log);
                            if (summary?.entries && summary.entries.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  {summary.entries.map((entry, index) => (
                                    <div key={`${log.id}-entry-${index}`} className="rounded border border-slate-200 bg-white px-2.5 py-2">
                                      <p className="text-xs font-semibold text-slate-800">{entry.message}</p>
                                      {(entry.field_changes || []).length > 0 ? (
                                        <div className="mt-1.5 space-y-1">
                                          {(entry.field_changes || []).map((change, changeIndex) => (
                                            <p key={`${log.id}-entry-${index}-change-${changeIndex}`} className="text-[10px] leading-5 text-slate-600">
                                              <span className="font-semibold text-slate-700">{change.label}:</span>{' '}
                                              <span className="text-slate-500">{change.from || '—'}</span>{' '}
                                              <span className="text-slate-400">→</span>{' '}
                                              <span className="text-slate-900">{change.to || '—'}</span>
                                            </p>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            return (
                              <>
                                <div>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Trước thay đổi</p>
                                  <pre className="max-h-40 overflow-auto rounded bg-slate-900 px-2.5 py-2 text-[10px] leading-5 text-slate-100">
                                    {stringifyAuditPayload(log.old_values) || '—'}
                                  </pre>
                                </div>
                                <div>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sau thay đổi</p>
                                  <pre className="max-h-40 overflow-auto rounded bg-slate-900 px-2.5 py-2 text-[10px] leading-5 text-slate-100">
                                    {stringifyAuditPayload(log.new_values) || '—'}
                                  </pre>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{`Chưa có lịch sử thay đổi nào cho ${catalogLabelLower}.`}</p>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAuditHistory((previous) => !previous)}
            className={`group relative flex h-11 w-11 items-center justify-center rounded-full border border-white text-white shadow-xl transition-all hover:scale-[1.02] ${
              showAuditHistory
                ? 'bg-deep-teal shadow-primary/20'
                : 'bg-primary shadow-primary/25'
            }`}
            aria-label={showAuditHistory ? 'Đóng lịch sử thay đổi' : 'Xem lịch sử thay đổi'}
            title={showAuditHistory ? 'Đóng lịch sử thay đổi' : 'Xem lịch sử thay đổi'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {showAuditHistory ? 'history_toggle_off' : 'history'}
            </span>
            {auditLogCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-warning px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                {auditLogCount > 99 ? '99+' : auditLogCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {showImportReviewModal && (
        <ImportModal
          title={`Nhập dữ liệu ${catalogLabelLower}`}
          moduleKey={config.importModuleKey}
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
