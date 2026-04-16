import React, { useEffect, useMemo, useState } from 'react';
import type { Product, ProductPackage } from '../types';
import type {
  ProductTargetSegment,
  ProductTargetSegmentCustomerSector,
  ProductTargetSegmentFacilityType,
} from '../types/product';
import { fetchProductTargetSegments } from '../services/api/productApi';
import {
  CUSTOMER_SECTOR_OPTIONS,
  HEALTHCARE_FACILITY_TYPE_OPTIONS,
} from '../utils/customerClassification';
import { ProductTargetSegmentModal } from './ProductTargetSegmentModal';

type NotifyFn = (type: 'success' | 'error', title: string, message: string) => void;

interface ProductSalesConfigListProps {
  products: Product[];
  productPackages: ProductPackage[];
  canManage?: boolean;
  onNotify?: NotifyFn;
}

type ProductTargetSegmentSummaryState =
  | { status: 'loading'; segments: ProductTargetSegment[] }
  | { status: 'ready'; segments: ProductTargetSegment[] }
  | { status: 'unavailable'; segments: ProductTargetSegment[] }
  | { status: 'error'; segments: ProductTargetSegment[]; errorMessage: string };

const normalizeProductId = (value: string | number | null | undefined): string => String(value ?? '');

const buildPackageLabel = (item: ProductPackage): string => {
  const packageCode = String(item.package_code || '').trim();
  const packageName = String(item.package_name || '').trim();

  if (packageCode && packageName) {
    return `${packageCode} - ${packageName}`;
  }

  return packageCode || packageName || `#${item.id}`;
};

const CUSTOMER_SECTOR_LABELS = Object.fromEntries(
  CUSTOMER_SECTOR_OPTIONS.map((option) => [option.value, option.label])
) as Record<ProductTargetSegmentCustomerSector, string>;

const FACILITY_TYPE_LABELS = Object.fromEntries(
  HEALTHCARE_FACILITY_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<ProductTargetSegmentFacilityType, string>;

const createLoadingSegmentSummary = (): ProductTargetSegmentSummaryState => ({
  status: 'loading',
  segments: [],
});

const createReadySegmentSummary = (segments: ProductTargetSegment[]): ProductTargetSegmentSummaryState => ({
  status: 'ready',
  segments,
});

const createUnavailableSegmentSummary = (): ProductTargetSegmentSummaryState => ({
  status: 'unavailable',
  segments: [],
});

const createErrorSegmentSummary = (errorMessage: string): ProductTargetSegmentSummaryState => ({
  status: 'error',
  segments: [],
  errorMessage,
});

const normalizeFacilityTypes = (segment: ProductTargetSegment): ProductTargetSegmentFacilityType[] => {
  const sourceValues = Array.isArray(segment.facility_types) && segment.facility_types.length > 0
    ? segment.facility_types
    : segment.facility_type
      ? [segment.facility_type]
      : [];

  return Array.from(new Set(
    sourceValues.filter((value): value is ProductTargetSegmentFacilityType => Boolean(value))
  ));
};

const buildSegmentSummaryLabel = (segment: ProductTargetSegment): string => {
  const sectorLabel = CUSTOMER_SECTOR_LABELS[segment.customer_sector] || segment.customer_sector;

  if (segment.customer_sector !== 'HEALTHCARE') {
    return sectorLabel;
  }

  const facilityTypes = normalizeFacilityTypes(segment);
  if (facilityTypes.length === 0) {
    return `${sectorLabel} • Tất cả loại hình`;
  }

  if (facilityTypes.length <= 2) {
    return `${sectorLabel} • ${facilityTypes.map((value) => FACILITY_TYPE_LABELS[value] || value).join(', ')}`;
  }

  return `${sectorLabel} • ${facilityTypes.length} loại hình y tế`;
};

export const ProductSalesConfigList: React.FC<ProductSalesConfigListProps> = ({
  products,
  productPackages,
  canManage = false,
  onNotify,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [segmentSummariesByProductId, setSegmentSummariesByProductId] = useState<
    Record<string, ProductTargetSegmentSummaryState>
  >({});

  const packagesByProductId = useMemo(() => {
    const nextMap = new Map<string, ProductPackage[]>();

    (productPackages || []).forEach((item) => {
      const key = normalizeProductId(item.product_id);
      const rows = nextMap.get(key) || [];
      rows.push(item);
      nextMap.set(key, rows);
    });

    nextMap.forEach((rows, key) => {
      nextMap.set(
        key,
        [...rows].sort((left, right) => buildPackageLabel(left).localeCompare(buildPackageLabel(right), 'vi'))
      );
    });

    return nextMap;
  }, [productPackages]);

  const visibleProductIds = useMemo(
    () => Array.from(new Set((products || []).map((item) => normalizeProductId(item.id)).filter(Boolean))),
    [products]
  );
  const visibleProductIdsKey = useMemo(() => visibleProductIds.join('|'), [visibleProductIds]);

  useEffect(() => {
    let cancelled = false;

    if (visibleProductIds.length === 0) {
      setSegmentSummariesByProductId({});
      return () => {
        cancelled = true;
      };
    }

    setSegmentSummariesByProductId((currentValue) => {
      const nextValue: Record<string, ProductTargetSegmentSummaryState> = {};
      visibleProductIds.forEach((productId) => {
        nextValue[productId] = currentValue[productId] || createLoadingSegmentSummary();
      });
      return nextValue;
    });

    void Promise.all(
      visibleProductIds.map(async (productId) => {
        try {
          const response = await fetchProductTargetSegments(productId);
          return {
            productId,
            summary: response.meta?.table_available === false
              ? createUnavailableSegmentSummary()
              : createReadySegmentSummary(response.data || []),
          };
        } catch (error) {
          return {
            productId,
            summary: createErrorSegmentSummary(
              error instanceof Error ? error.message : 'Không thể tải cấu hình bán hàng.'
            ),
          };
        }
      })
    ).then((results) => {
      if (cancelled) {
        return;
      }

      setSegmentSummariesByProductId((currentValue) => {
        const nextValue: Record<string, ProductTargetSegmentSummaryState> = {};
        visibleProductIds.forEach((productId) => {
          nextValue[productId] = currentValue[productId] || createLoadingSegmentSummary();
        });
        results.forEach(({ productId, summary }) => {
          nextValue[productId] = summary;
        });
        return nextValue;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visibleProductIds, visibleProductIdsKey]);

  const handleSegmentsSaved = (productId: Product['id'], segments: ProductTargetSegment[]) => {
    const normalizedProductId = normalizeProductId(productId);
    setSegmentSummariesByProductId((currentValue) => ({
      ...currentValue,
      [normalizedProductId]: {
        status: 'ready',
        segments: segments || [],
      },
    }));
  };

  return (
    <>
      <table className="w-full min-w-[1320px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã sản phẩm</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên sản phẩm</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nhóm dịch vụ</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Gói cước liên kết</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Cấu hình bán hàng</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {products.map((item) => {
            const relatedPackages = packagesByProductId.get(normalizeProductId(item.id)) || [];
            const previewPackages = relatedPackages.slice(0, 2);
            const remainingPackages = Math.max(0, relatedPackages.length - previewPackages.length);
            const segmentSummary = segmentSummariesByProductId[normalizeProductId(item.id)] || createLoadingSegmentSummary();
            const activeSegments = (segmentSummary.segments || []).filter((segment) => segment.is_active !== false);
            const previewSegmentLabels = activeSegments.slice(0, 2).map(buildSegmentSummaryLabel);
            const remainingSegments = Math.max(0, activeSegments.length - previewSegmentLabels.length);
            const inactiveSegmentCount = Math.max(0, (segmentSummary.segments || []).length - activeSegments.length);

            return (
              <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.product_code || '--'}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-800">{item.product_name || '--'}</p>
                  {item.product_short_name ? (
                    <p className="mt-1 text-xs text-slate-500">{item.product_short_name}</p>
                  ) : null}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{item.service_group || '--'}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {relatedPackages.length > 0 ? (
                    <div className="space-y-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {relatedPackages.length} gói cước
                      </span>
                      <div className="space-y-1">
                        {previewPackages.map((productPackage) => (
                          <p key={String(productPackage.id)} className="text-xs text-slate-600">
                            {buildPackageLabel(productPackage)}
                          </p>
                        ))}
                        {remainingPackages > 0 ? (
                          <p className="text-xs font-medium text-slate-400">+{remainingPackages} gói cước khác</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        Chưa map gói cước
                      </span>
                      <p className="text-xs text-slate-500">
                        Cấu hình sẽ được áp dụng theo sản phẩm cha khi có gói cước liên kết.
                      </p>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {segmentSummary.status === 'loading' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        Đang tải cấu hình
                      </span>
                      <p className="text-xs text-slate-500">Đang đồng bộ phân khúc khách hàng đã lưu.</p>
                    </div>
                  ) : segmentSummary.status === 'unavailable' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        Chưa sẵn sàng
                      </span>
                      <p className="text-xs text-slate-500">Thiếu bảng dữ liệu cấu hình bán sản phẩm trong môi trường hiện tại.</p>
                    </div>
                  ) : segmentSummary.status === 'error' ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        Chưa tải được
                      </span>
                      <p className="text-xs text-slate-500">{segmentSummary.errorMessage}</p>
                    </div>
                  ) : activeSegments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {activeSegments.length} phân khúc
                        </span>
                        {inactiveSegmentCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            {inactiveSegmentCount} đang tắt
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewSegmentLabels.map((label) => (
                          <span
                            key={`${item.id}-${label}`}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {label}
                          </span>
                        ))}
                        {remainingSegments > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            +{remainingSegments} phân khúc khác
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : segmentSummary.segments.length > 0 ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {segmentSummary.segments.length} phân khúc
                      </span>
                      <p className="text-xs text-slate-500">Đã lưu cấu hình nhưng toàn bộ đang tạm tắt.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        Chưa cấu hình
                      </span>
                      <p className="text-xs text-slate-500">Chưa có phân khúc khách hàng nào được áp dụng.</p>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(item)}
                    aria-label={canManage ? 'Cấu hình bán sản phẩm' : 'Xem cấu hình bán sản phẩm'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-primary/30 hover:bg-slate-50 hover:text-primary"
                    title="Cấu hình bán sản phẩm"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>target</span>
                    {canManage ? 'Cấu hình' : 'Xem'}
                  </button>
                </td>
              </tr>
            );
          })}
          {products.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                Không có dữ liệu sản phẩm phù hợp để cấu hình bán.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {selectedProduct ? (
        <ProductTargetSegmentModal
          product={selectedProduct}
          relatedProductPackages={packagesByProductId.get(normalizeProductId(selectedProduct.id)) || []}
          canManage={canManage}
          onSaved={(segments) => handleSegmentsSaved(selectedProduct.id, segments)}
          onClose={() => setSelectedProduct(null)}
          onNotify={onNotify}
        />
      ) : null}
    </>
  );
};

export default ProductSalesConfigList;
