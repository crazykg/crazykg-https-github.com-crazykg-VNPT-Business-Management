import React, { useEffect, useState } from 'react';
import type {
  Product,
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
import { ModalWrapper } from './Modals';
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
  canManage?: boolean;
  onClose: () => void;
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
  canManage = false,
  onClose,
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
      await syncProductTargetSegments(product.id, buildSyncPayload(segments));
      onNotify?.('success', 'Cấu hình đề xuất bán hàng', 'Đã lưu cấu hình đề xuất bán hàng.');
      onClose();
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Không thể lưu cấu hình đề xuất bán hàng.';
      setSaveError(message);
      onNotify?.('error', 'Cấu hình đề xuất bán hàng', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={`Cấu hình đề xuất bán hàng • ${product.product_name}`}
      icon="target"
      width="max-w-[1120px]"
      panelClassName="rounded-3xl"
      headerClassName="gap-2 px-4 py-3 md:px-5 md:py-3"
    >
      <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <div className="border-b border-amber-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              {product.product_code}
            </span>
            {product.package_name ? (
              <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700">
                {product.package_name}
              </span>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">Đang tải danh sách phân khúc khách hàng...</p>
          </div>
        ) : error ? (
          <div className="px-4 py-6">
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4">
              <p className="text-base font-semibold text-red-700">Không thể tải cấu hình phân khúc khách hàng.</p>
              <p className="mt-2 text-sm leading-6 text-red-600">{error}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-base font-semibold text-amber-900">Tính năng chưa sẵn sàng trong môi trường này.</p>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Bảng dữ liệu `product_target_segments` chưa được tạo. Vui lòng chạy migration trước khi cấu hình đề xuất bán hàng.
                  </p>
                </div>
              ) : segments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-amber-300 bg-white/90 p-5 text-center">
                  <p className="text-lg font-semibold text-slate-900">Chưa cấu hình đề xuất</p>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                    Sản phẩm này chưa được gắn với phân khúc khách hàng nào. Hãy thêm phân khúc để hệ thống gợi ý đúng đối tượng hơn.
                  </p>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => setSegments([createEmptySegment()])}
                      className="mt-5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                    >
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
                        className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatSegmentSubtitle(segment)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                              <input
                                type="checkbox"
                                checked={segment.is_active}
                                onChange={(event) => updateSegment(segment._tempId, 'is_active', event.target.checked)}
                                disabled={disableEditing}
                              />
                              Hoạt động
                            </label>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => removeSegment(segment._tempId)}
                                disabled={disableEditing}
                                title="Xóa phân khúc"
                                className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-3 px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="flex flex-col gap-1.5 xl:col-span-1">
                            <label className="text-sm font-semibold text-slate-700">Lĩnh vực khách hàng</label>
                            <select
                              aria-label="Lĩnh vực khách hàng"
                              value={segment.customer_sector}
                              onChange={(event) => updateSegment(segment._tempId, 'customer_sector', event.target.value)}
                              disabled={disableEditing}
                              className={`h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-colors ${
                                segmentErrors.customer_sector ? 'border-red-400' : 'border-slate-200'
                              } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-amber-400'}`}
                            >
                              <option value="">Chọn lĩnh vực</option>
                              {CUSTOMER_SECTOR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {segmentErrors.customer_sector ? (
                              <p className="text-xs font-medium text-red-500">{segmentErrors.customer_sector}</p>
                            ) : null}
                          </div>

                          {isHealthcare ? (
                            <div className="flex flex-col gap-1.5 xl:col-span-1">
                              <label className="text-sm font-semibold text-slate-700">Loại hình y tế</label>
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
                                disabled={disableEditing}
                                triggerClassName={`h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 ${
                                  segmentErrors.facility_types ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
                                } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : ''}`}
                                dropdownClassName="z-[160] rounded-2xl"
                              />
                              {segmentErrors.facility_types ? (
                                <p className="text-xs font-medium text-red-500">{segmentErrors.facility_types}</p>
                              ) : (
                                <p className="text-xs text-slate-500">
                                  Bỏ trống để áp dụng cho tất cả loại hình y tế. Có thể chọn nhiều giá trị cùng lúc.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500 xl:col-span-1">
                              Trường loại hình và quy mô giường bệnh chỉ áp dụng cho nhóm khách hàng Y tế.
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5 xl:col-span-1">
                            <label className="text-sm font-semibold text-slate-700">Mức ưu tiên</label>
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
                              className={`h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-colors ${
                                segmentErrors.priority ? 'border-red-400' : 'border-slate-200'
                              } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-amber-400'}`}
                            />
                            {segmentErrors.priority ? (
                              <p className="text-xs font-medium text-red-500">{segmentErrors.priority}</p>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 xl:col-span-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tóm tắt</p>
                            <p className="mt-2 text-sm font-medium text-slate-700">{formatSegmentSubtitle(segment)}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {segment.is_active ? 'Đang được dùng để gợi ý bán hàng.' : 'Tạm ngưng áp dụng.'}
                            </p>
                          </div>

                          {isHealthcare ? (
                            <>
                              <div className="flex flex-col gap-1.5 xl:col-span-2">
                                <label className="text-sm font-semibold text-slate-700">Giường bệnh tối thiểu</label>
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
                                  className={`h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-colors ${
                                    segmentErrors.bed_capacity_min ? 'border-red-400' : 'border-slate-200'
                                  } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-amber-400'}`}
                                />
                                {segmentErrors.bed_capacity_min ? (
                                  <p className="text-xs font-medium text-red-500">{segmentErrors.bed_capacity_min}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-col gap-1.5 xl:col-span-2">
                                <label className="text-sm font-semibold text-slate-700">Giường bệnh tối đa</label>
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
                                  className={`h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-colors ${
                                    segmentErrors.bed_capacity_max ? 'border-red-400' : 'border-slate-200'
                                  } ${disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-amber-400'}`}
                                />
                                {segmentErrors.bed_capacity_max ? (
                                  <p className="text-xs font-medium text-red-500">{segmentErrors.bed_capacity_max}</p>
                                ) : null}
                              </div>
                            </>
                          ) : null}

                          <div className="flex flex-col gap-1.5 xl:col-span-4">
                            <label className="text-sm font-semibold text-slate-700">Ghi chú bán hàng</label>
                            <textarea
                              aria-label="Ghi chú bán hàng"
                              rows={3}
                              value={segment.sales_notes}
                              onChange={(event) => updateSegment(segment._tempId, 'sales_notes', event.target.value)}
                              disabled={disableEditing}
                              placeholder="Gợi ý cho nhân viên bán hàng khi tư vấn sản phẩm này cho nhóm khách hàng tương ứng."
                              className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors ${
                                disableEditing ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'focus:border-amber-400'
                              }`}
                            />
                          </div>

                          {segmentErrors.duplicate ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 xl:col-span-4">
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
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {saveError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap gap-3">
                {canManage && tableAvailable ? (
                  <button
                    type="button"
                    onClick={() => setSegments((currentSegments) => [...currentSegments, createEmptySegment()])}
                    disabled={disableEditing || !tableAvailable}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Thêm phân khúc
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {canManage ? 'Hủy' : 'Đóng'}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !tableAvailable}
                    title={!tableAvailable ? 'Tính năng chưa sẵn sàng' : undefined}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
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
