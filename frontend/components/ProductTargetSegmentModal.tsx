import React, { useEffect, useState } from 'react';
import type {
  Product,
  ProductPackage,
  ProductTargetSegment,
  ProductTargetSegmentCustomerSector,
  ProductTargetSegmentFacilityType,
} from '../types/product';
import {
  fetchProductTargetSegments,
  syncProductTargetSegments,
  type ProductTargetSegmentSyncItem,
} from '../services/api/productApi';
import {
  CUSTOMER_SECTOR_OPTIONS,
  HEALTHCARE_FACILITY_TYPE_OPTIONS,
} from '../utils/customerClassification';
import { ModalWrapper } from './modals';
import { SearchableMultiSelect } from './SearchableMultiSelect';

type NotifyFn = (type: 'success' | 'error', title: string, message: string) => void;

type DraftSegment = {
  _tempId: string;
  id?: string | number | null;
  customer_sector: ProductTargetSegmentCustomerSector | '';
  facility_types: ProductTargetSegmentFacilityType[];
  bed_capacity_min: number | null;
  bed_capacity_max: number | null;
  priority: number;
  sales_notes: string;
  is_active: boolean;
};

type SegmentFieldError = Partial<Record<
  'customer_sector' | 'facility_types' | 'bed_capacity_min' | 'bed_capacity_max' | 'priority' | 'duplicate',
  string
>>;

interface ProductTargetSegmentModalProps {
  product: Product;
  relatedProductPackages?: ProductPackage[];
  canManage?: boolean;
  onClose: () => void;
  onSaved?: (segments: ProductTargetSegment[]) => void;
  onNotify?: NotifyFn;
}

const CUSTOMER_SECTOR_LABELS = Object.fromEntries(
  CUSTOMER_SECTOR_OPTIONS.map((option) => [option.value, option.label])
) as Record<ProductTargetSegmentCustomerSector, string>;

const FACILITY_TYPE_LABELS = Object.fromEntries(
  HEALTHCARE_FACILITY_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<ProductTargetSegmentFacilityType, string>;

let draftSegmentCounter = 0;

const buildDraftSegmentId = (): string => {
  draftSegmentCounter += 1;
  return `segment-draft-${draftSegmentCounter}`;
};

const normalizeFacilityTypeList = (
  facilityTypes: ProductTargetSegment['facility_types'],
  legacyFacilityType?: ProductTargetSegment['facility_type'],
): ProductTargetSegmentFacilityType[] => {
  const sourceValues = Array.isArray(facilityTypes) && facilityTypes.length > 0
    ? facilityTypes
    : legacyFacilityType
      ? [legacyFacilityType]
      : [];

  return Array.from(new Set(
    sourceValues.filter((value): value is ProductTargetSegmentFacilityType => (
      HEALTHCARE_FACILITY_TYPE_OPTIONS.some((option) => option.value === value)
    ))
  ));
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
};

const createEmptySegment = (): DraftSegment => ({
  _tempId: buildDraftSegmentId(),
  id: null,
  customer_sector: '',
  facility_types: [],
  bed_capacity_min: null,
  bed_capacity_max: null,
  priority: 1,
  sales_notes: '',
  is_active: true,
});

const formatRelatedProductPackageLabel = (productPackage: ProductPackage): string => (
  [productPackage.package_code, productPackage.package_name].filter(Boolean).join(' - ') || `#${productPackage.id}`
);

const toDraftSegment = (segment: ProductTargetSegment): DraftSegment => ({
  _tempId: buildDraftSegmentId(),
  id: segment.id,
  customer_sector: segment.customer_sector,
  facility_types: normalizeFacilityTypeList(segment.facility_types, segment.facility_type),
  bed_capacity_min: toOptionalNumber(segment.bed_capacity_min),
  bed_capacity_max: toOptionalNumber(segment.bed_capacity_max),
  priority: Math.max(1, Math.min(255, Number(segment.priority || 1))),
  sales_notes: String(segment.sales_notes || ''),
  is_active: segment.is_active !== false,
});

const validateDraftSegments = (segments: DraftSegment[]): Record<string, SegmentFieldError> => {
  const nextErrors: Record<string, SegmentFieldError> = {};
  const duplicateLookup = new Map<string, string[]>();

  segments.forEach((segment) => {
    const segmentErrors: SegmentFieldError = {};
    const isHealthcare = segment.customer_sector === 'HEALTHCARE';

    if (!segment.customer_sector) {
      segmentErrors.customer_sector = 'Vui lòng chọn lĩnh vực khách hàng.';
    }

    if (!Number.isFinite(segment.priority) || segment.priority < 1 || segment.priority > 255) {
      segmentErrors.priority = 'Mức ưu tiên phải nằm trong khoảng từ 1 đến 255.';
    }

    if (isHealthcare) {
      if (
        segment.bed_capacity_min !== null
        && segment.bed_capacity_max !== null
        && segment.bed_capacity_min > segment.bed_capacity_max
      ) {
        segmentErrors.bed_capacity_max = 'Giường bệnh tối đa phải lớn hơn hoặc bằng tối thiểu.';
      }
    } else {
      if (segment.facility_types.length > 0) {
        segmentErrors.facility_types = 'Loại hình chỉ áp dụng cho phân khúc Y tế.';
      }
      if (segment.bed_capacity_min !== null || segment.bed_capacity_max !== null) {
        segmentErrors.bed_capacity_min = 'Số giường bệnh chỉ áp dụng cho phân khúc Y tế.';
      }
    }

    if (segment.customer_sector) {
      const duplicateKey = [
        segment.customer_sector,
        [...segment.facility_types].sort().join(','),
        segment.bed_capacity_min ?? '',
        segment.bed_capacity_max ?? '',
      ].join('|');

      const entries = duplicateLookup.get(duplicateKey) || [];
      entries.push(segment._tempId);
      duplicateLookup.set(duplicateKey, entries);
    }

    if (Object.keys(segmentErrors).length > 0) {
      nextErrors[segment._tempId] = segmentErrors;
    }
  });

  duplicateLookup.forEach((tempIds) => {
    if (tempIds.length < 2) {
      return;
    }

    tempIds.forEach((tempId) => {
      nextErrors[tempId] = {
        ...(nextErrors[tempId] || {}),
        duplicate: 'Phân khúc này đang bị trùng với một cấu hình khác trong danh sách.',
      };
    });
  });

  return nextErrors;
};

const buildSyncPayload = (segments: DraftSegment[]): ProductTargetSegmentSyncItem[] => segments.map((segment) => {
  const isHealthcare = segment.customer_sector === 'HEALTHCARE';

  return {
    customer_sector: segment.customer_sector as ProductTargetSegmentCustomerSector,
    facility_type: isHealthcare && segment.facility_types.length === 1 ? segment.facility_types[0] : null,
    facility_types: isHealthcare ? segment.facility_types : [],
    bed_capacity_min: isHealthcare ? segment.bed_capacity_min : null,
    bed_capacity_max: isHealthcare ? segment.bed_capacity_max : null,
    priority: Math.max(1, Math.min(255, Math.floor(Number(segment.priority || 1)))),
    sales_notes: segment.sales_notes.trim() || null,
    is_active: segment.is_active,
  };
});

const formatSegmentSubtitle = (segment: DraftSegment): string => {
  if (!segment.customer_sector) {
    return 'Chưa chọn lĩnh vực khách hàng';
  }

  const sectorLabel = CUSTOMER_SECTOR_LABELS[segment.customer_sector] || segment.customer_sector;
  if (segment.customer_sector !== 'HEALTHCARE') {
    return sectorLabel;
  }

  const facilityLabel = segment.facility_types.length === 0
    ? 'Tất cả loại hình'
    : segment.facility_types.length <= 2
      ? segment.facility_types.map((value) => FACILITY_TYPE_LABELS[value] || value).join(', ')
      : `${segment.facility_types.length} loại hình y tế`;
  return `${sectorLabel} • ${facilityLabel}`;
};

export const ProductTargetSegmentModal: React.FC<ProductTargetSegmentModalProps> = ({
  product,
  relatedProductPackages = [],
  canManage = false,
  onClose,
  onSaved,
  onNotify,
}) => {
  const [segments, setSegments] = useState<DraftSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tableAvailable, setTableAvailable] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, SegmentFieldError>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [showAllRelatedPackages, setShowAllRelatedPackages] = useState(false);

  const hasRelatedProductPackages = relatedProductPackages.length > 0;
  const canToggleRelatedPackages = relatedProductPackages.length > 2;
  const visibleRelatedProductPackages = showAllRelatedPackages
    ? relatedProductPackages
    : relatedProductPackages.slice(0, 2);
  const hiddenRelatedPackageCount = Math.max(0, relatedProductPackages.length - visibleRelatedProductPackages.length);

  useEffect(() => {
    let cancelled = false;

    const loadSegments = async () => {
      setLoading(true);
      setError(null);
      setSaveError(null);

      try {
        const response = await fetchProductTargetSegments(product.id);
        if (cancelled) {
          return;
        }

        setSegments((response.data || []).map(toDraftSegment));
        setTableAvailable(response.meta?.table_available !== false);
        setValidationErrors({});
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách segment.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSegments();

    return () => {
      cancelled = true;
    };
  }, [product.id, reloadKey]);

  useEffect(() => {
    setShowAllRelatedPackages(false);
  }, [product.id, relatedProductPackages.length]);

  const disableEditing = !canManage || saving;

  const updateSegment = (
    tempId: string,
    field: keyof DraftSegment,
    value: DraftSegment[keyof DraftSegment]
  ) => {
    setSegments((currentSegments) => currentSegments.map((segment) => {
      if (segment._tempId !== tempId) {
        return segment;
      }

      if (field === 'customer_sector') {
        const nextSector = value as DraftSegment['customer_sector'];
        return {
          ...segment,
          customer_sector: nextSector,
          facility_types: nextSector === 'HEALTHCARE' ? segment.facility_types : [],
          bed_capacity_min: nextSector === 'HEALTHCARE' ? segment.bed_capacity_min : null,
          bed_capacity_max: nextSector === 'HEALTHCARE' ? segment.bed_capacity_max : null,
        };
      }

      return {
        ...segment,
        [field]: value,
      };
    }));

    setValidationErrors((currentErrors) => {
      if (!currentErrors[tempId]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[tempId];
      return nextErrors;
    });
  };

  const removeSegment = (tempId: string) => {
    setSegments((currentSegments) => currentSegments.filter((segment) => segment._tempId !== tempId));
    setValidationErrors((currentErrors) => {
      if (!currentErrors[tempId]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[tempId];
      return nextErrors;
    });
  };

  const handleSave = async () => {
    setSaveError(null);

    const nextErrors = validateDraftSegments(segments);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !tableAvailable || disableEditing) {
      return;
    }

    setSaving(true);
    try {
      const response = await syncProductTargetSegments(product.id, buildSyncPayload(segments));
      onSaved?.(response.data || []);
      onNotify?.('success', 'Cấu hình bán sản phẩm', 'Đã lưu cấu hình bán sản phẩm.');
      onClose();
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Không thể lưu cấu hình bán sản phẩm.';
      setSaveError(message);
      onNotify?.('error', 'Cấu hình bán sản phẩm', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={`Cấu hình bán sản phẩm • ${product.product_name}`}
      icon="target"
      width="max-w-[1120px]"
      panelClassName="rounded-lg"
      headerClassName="gap-2 px-4 py-3 md:px-5 md:py-3"
    >
      <div className="bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {product.product_code}
            </span>
            {product.package_name ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary">
                {product.package_name}
              </span>
            ) : null}
          </div>
          <div
            className={`mt-3 rounded-lg border px-3 py-3 ${
              hasRelatedProductPackages
                ? 'border-blue-100 bg-blue-50/70'
                : 'border-amber-200 bg-amber-50/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      hasRelatedProductPackages
                        ? 'bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]'
                        : 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.14)]'
                    }`}
                  />
                  <p className="text-xs font-semibold text-slate-800">Map với gói cước</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      hasRelatedProductPackages
                        ? 'bg-white text-blue-700'
                        : 'bg-white text-amber-700'
                    }`}
                  >
                    {hasRelatedProductPackages ? `${relatedProductPackages.length} gói cước` : 'Chưa map'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  {hasRelatedProductPackages
                    ? `Đang áp dụng cho ${relatedProductPackages.length} gói cước, tự đồng bộ theo sản phẩm cha.`
                    : 'Chưa có gói cước liên kết. Cấu hình sẽ áp dụng khi phát sinh map.'}
                </p>
              </div>
              {canToggleRelatedPackages ? (
                <button
                  type="button"
                  onClick={() => setShowAllRelatedPackages((currentValue) => !currentValue)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:border-blue-200 hover:text-blue-800"
                >
                  <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {showAllRelatedPackages ? 'expand_less' : 'expand_more'}
                  </span>
                  {showAllRelatedPackages ? 'Thu gọn' : 'Xem tất cả'}
                </button>
              ) : null}
            </div>
            {hasRelatedProductPackages ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleRelatedProductPackages.map((item) => (
                  <span
                    key={String(item.id)}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-all"
                  >
                    {formatRelatedProductPackageLabel(item)}
                  </span>
                ))}
                {!showAllRelatedPackages && hiddenRelatedPackageCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRelatedPackages(true)}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-blue-700"
                  >
                    +{hiddenRelatedPackageCount} gói cước khác
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <p className="text-xs font-semibold text-on-surface-variant">Đang tải danh sách phân khúc khách hàng...</p>
          </div>
        ) : error ? (
          <div className="px-4 py-6">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-deep-teal">Không thể tải cấu hình phân khúc khách hàng.</p>
              <p className="mt-1.5 text-xs text-error leading-5">{error}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-error text-white hover:bg-red-700"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-4">
              {!tableAvailable ? (
                <div className="rounded-lg border border-slate-200 bg-surface-low px-3 py-2">
                  <p className="text-xs font-semibold text-on-surface">Tính năng chưa sẵn sàng trong môi trường này.</p>
                  <p className="mt-1 text-xs text-on-surface-variant leading-5">
                    Bảng dữ liệu `product_target_segments` chưa được tạo. Vui lòng chạy migration trước khi cấu hình bán sản phẩm.
                  </p>
                </div>
              ) : segments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-surface-low px-3 py-6 text-center">
                  <p className="text-sm font-bold text-deep-teal">Chưa cấu hình bán sản phẩm</p>
                  <p className="mx-auto mt-2 max-w-xl text-xs text-on-surface-variant leading-5">
                    Sản phẩm này chưa được gắn với phân khúc khách hàng nào. Hãy thêm phân khúc để hệ thống gợi ý đúng đối tượng hơn.
                  </p>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => setSegments([createEmptySegment()])}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white shadow-sm mt-4"
                      style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                      Thêm phân khúc đầu tiên
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {segments.map((segment) => {
                    const segmentErrors = validationErrors[segment._tempId] || {};
                    const isHealthcare = segment.customer_sector === 'HEALTHCARE';

                    return (
                      <section
                        key={segment._tempId}
                        className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                          <div>
                            <p className="text-xs font-semibold text-on-surface">{formatSegmentSubtitle(segment)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={segment.is_active}
                                onChange={(event) => updateSegment(segment._tempId, 'is_active', event.target.checked)}
                                disabled={disableEditing}
                              />
                              {segment.is_active ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                  Hoạt động
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                  Tạm ngưng
                                </span>
                              )}
                            </label>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => removeSegment(segment._tempId)}
                                disabled={disableEditing}
                                title="Xóa phân khúc"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-error/20 text-error hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                Xóa
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-3 px-3 py-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="flex flex-col gap-1 xl:col-span-1">
                            <label className="text-xs font-semibold text-neutral">Lĩnh vực khách hàng</label>
                            <select
                              aria-label="Lĩnh vực khách hàng"
                              value={segment.customer_sector}
                              onChange={(event) => updateSegment(segment._tempId, 'customer_sector', event.target.value)}
                              disabled={disableEditing}
                              className={`h-8 px-3 rounded border bg-white text-xs text-slate-900 outline-none transition-colors ${
                                segmentErrors.customer_sector ? 'border-red-400' : 'border-slate-200'
                              } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'}`}
                            >
                              <option value="">Chọn lĩnh vực</option>
                              {CUSTOMER_SECTOR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {segmentErrors.customer_sector ? (
                              <p className="text-xs font-medium text-error">{segmentErrors.customer_sector}</p>
                            ) : null}
                          </div>

                          {isHealthcare ? (
                            <div className="flex flex-col gap-1 xl:col-span-1">
                              <label className="text-xs font-semibold text-neutral">Loại hình y tế</label>
                              <SearchableMultiSelect
                                ariaLabel="Loại hình y tế"
                                values={segment.facility_types}
                                onChange={(values) => updateSegment(
                                  segment._tempId,
                                  'facility_types',
                                  values as ProductTargetSegmentFacilityType[]
                                )}
                                options={HEALTHCARE_FACILITY_TYPE_OPTIONS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                  searchText: `${option.label} ${option.description || ''}`,
                                }))}
                                placeholder="Tất cả loại hình"
                                searchPlaceholder="Tìm loại hình y tế..."
                                noOptionsText="Không tìm thấy loại hình phù hợp"
                                showSelectedChips={false}
                                disabled={disableEditing}
                                triggerClassName={`!min-h-0 !h-8 !rounded !border !bg-white !px-3 !py-1 !text-xs !text-slate-900 ${
                                  segmentErrors.facility_types ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
                                } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'}`}
                                dropdownClassName="z-[160] rounded-lg"
                              />
                              {segmentErrors.facility_types ? (
                                <p className="text-xs font-medium text-error">{segmentErrors.facility_types}</p>
                              ) : (
                                <p className="text-xs text-on-surface-variant">
                                  Bỏ trống để áp dụng cho tất cả loại hình y tế. Có thể chọn nhiều giá trị cùng lúc.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-surface-low px-3 py-2 text-xs text-on-surface-variant xl:col-span-1">
                              Trường loại hình và quy mô giường bệnh chỉ áp dụng cho nhóm khách hàng Y tế.
                            </div>
                          )}

                          <div className="flex flex-col gap-1 xl:col-span-1">
                            <label className="text-xs font-semibold text-neutral">Mức ưu tiên</label>
                            <input
                              aria-label="Mức ưu tiên"
                              type="number"
                              min={1}
                              max={255}
                              value={segment.priority}
                              onChange={(event) => updateSegment(
                                segment._tempId,
                                'priority',
                                Math.max(1, Math.min(255, Number(event.target.value || 1)))
                              )}
                              disabled={disableEditing}
                              className={`h-8 px-3 rounded border bg-white text-xs text-slate-900 outline-none transition-colors ${
                                segmentErrors.priority ? 'border-red-400' : 'border-slate-200'
                              } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'}`}
                            />
                            {segmentErrors.priority ? (
                              <p className="text-xs font-medium text-error">{segmentErrors.priority}</p>
                            ) : null}
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-surface-low px-3 py-2 xl:col-span-1">
                            <p className="text-[10px] font-semibold text-neutral uppercase tracking-wide">Tóm tắt</p>
                            <p className="mt-1 text-xs font-semibold text-on-surface">{formatSegmentSubtitle(segment)}</p>
                            <p className="mt-0.5 text-xs text-on-surface-variant">
                              {segment.is_active ? 'Đang được dùng để gợi ý bán hàng.' : 'Tạm ngưng áp dụng.'}
                            </p>
                          </div>

                          {isHealthcare ? (
                            <>
                              <div className="flex flex-col gap-1 xl:col-span-2">
                                <label className="text-xs font-semibold text-neutral">Giường bệnh tối thiểu</label>
                                <input
                                  aria-label="Giường bệnh tối thiểu"
                                  type="number"
                                  min={0}
                                  value={segment.bed_capacity_min ?? ''}
                                  onChange={(event) => updateSegment(
                                    segment._tempId,
                                    'bed_capacity_min',
                                    toOptionalNumber(event.target.value)
                                  )}
                                  disabled={disableEditing}
                                  placeholder="Không giới hạn"
                                  className={`h-8 px-3 rounded border bg-white text-xs text-slate-900 outline-none transition-colors ${
                                    segmentErrors.bed_capacity_min ? 'border-red-400' : 'border-slate-200'
                                  } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'}`}
                                />
                                {segmentErrors.bed_capacity_min ? (
                                  <p className="text-xs font-medium text-error">{segmentErrors.bed_capacity_min}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-col gap-1 xl:col-span-2">
                                <label className="text-xs font-semibold text-neutral">Giường bệnh tối đa</label>
                                <input
                                  aria-label="Giường bệnh tối đa"
                                  type="number"
                                  min={0}
                                  value={segment.bed_capacity_max ?? ''}
                                  onChange={(event) => updateSegment(
                                    segment._tempId,
                                    'bed_capacity_max',
                                    toOptionalNumber(event.target.value)
                                  )}
                                  disabled={disableEditing}
                                  placeholder="Không giới hạn"
                                  className={`h-8 px-3 rounded border bg-white text-xs text-slate-900 outline-none transition-colors ${
                                    segmentErrors.bed_capacity_max ? 'border-red-400' : 'border-slate-200'
                                  } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'}`}
                                />
                                {segmentErrors.bed_capacity_max ? (
                                  <p className="text-xs font-medium text-error">{segmentErrors.bed_capacity_max}</p>
                                ) : null}
                              </div>
                            </>
                          ) : null}

                          <div className="flex flex-col gap-1 xl:col-span-4">
                            <label className="text-xs font-semibold text-neutral">Ghi chú bán hàng</label>
                            <textarea
                              aria-label="Ghi chú bán hàng"
                              rows={3}
                              value={segment.sales_notes}
                              onChange={(event) => updateSegment(segment._tempId, 'sales_notes', event.target.value)}
                              disabled={disableEditing}
                              placeholder="Gợi ý cho nhân viên bán hàng khi tư vấn sản phẩm này cho nhóm khách hàng tương ứng."
                              className={`rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors ${
                                disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-primary'
                              }`}
                            />
                          </div>

                          {segmentErrors.duplicate ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-error xl:col-span-4">
                              {segmentErrors.duplicate}
                            </div>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {saveError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-error">
                  {saveError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {canManage && tableAvailable ? (
                  <button
                    type="button"
                    onClick={() => setSegments((currentSegments) => [...currentSegments, createEmptySegment()])}
                    disabled={disableEditing || !tableAvailable}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    Thêm phân khúc
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  {canManage ? 'Hủy' : 'Đóng'}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !tableAvailable}
                    title={!tableAvailable ? 'Tính năng chưa sẵn sàng' : undefined}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white hover:bg-deep-teal shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </ModalWrapper>
  );

};

export default ProductTargetSegmentModal;
