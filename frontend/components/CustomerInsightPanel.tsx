import React, { useEffect, useRef, useState } from 'react';
import { fetchCustomerInsight, fetchUpsellProductDetail } from '../services/api/customerApi';
import type {
  Customer,
  CustomerInsight,
  CustomerInsightUpsellCandidate,
  UpsellProductDetail,
  UpsellSectorCustomer,
  UpsellSimilarCustomer,
} from '../types/customer';
import {
  getCustomerSectorLabel,
  getHealthcareFacilityTypeLabel,
  resolveCustomerSector,
  resolveHealthcareFacilityType,
} from '../utils/customerClassification';
import { formatVietnameseCurrencyValue } from '../utils/vietnameseCurrency';

const fmt = (value: number) => formatVietnameseCurrencyValue(value);

const formatCompactCurrencyVnd = (value: number): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '--';
  }

  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  }

  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  SIGNED: 'Đã ký',
  RENEWED: 'Gia hạn',
  DRAFT: 'Nháp',
};

const CONTRACT_STATUS_CLS: Record<string, string> = {
  SIGNED: 'bg-emerald-100 text-emerald-700',
  RENEWED: 'bg-teal-100 text-teal-700',
  DRAFT: 'bg-slate-100 text-slate-500',
};

const SERVICE_GROUP_CLS: Record<string, string> = {
  GROUP_A: 'bg-blue-100 text-blue-700 border-blue-200',
  GROUP_B: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  GROUP_C: 'bg-orange-100 text-orange-700 border-orange-200',
};

const DESCRIPTION_CLAMP_STYLE = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
} as const;

type ActiveTab = 'overview' | 'services' | 'upsell';

function KpiCard({ label, value, sub, icon, cls }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  cls: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${cls}`}>
      <span className="material-symbols-outlined mt-0.5 text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium opacity-70">{label}</p>
        <p className="truncate text-lg font-bold leading-tight">{value}</p>
        {sub ? <p className="mt-0.5 text-xs opacity-60">{sub}</p> : null}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border bg-slate-50 p-4">
      <div className="mb-2 h-3 w-1/2 rounded bg-slate-200" />
      <div className="h-5 w-3/4 rounded bg-slate-200" />
    </div>
  );
}

function OverviewTab({ insight }: { insight: CustomerInsight }) {
  const { contracts_summary: contractsSummary, crc_summary: crcSummary } = insight;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Hợp đồng đang hiệu lực"
          value={(contractsSummary.by_status.SIGNED ?? 0) + (contractsSummary.by_status.RENEWED ?? 0)}
          sub={`Tổng ${contractsSummary.total_count} hợp đồng`}
          icon="description"
          cls="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <KpiCard
          label="Tổng giá trị hợp đồng"
          value={fmt(contractsSummary.total_value)}
          sub={`Đang TH: ${fmt(contractsSummary.active_value)}`}
          icon="payments"
          cls="border-sky-200 bg-sky-50 text-sky-800"
        />
        <KpiCard
          label="Yêu cầu đang xử lý"
          value={crcSummary.open_cases}
          sub={`Tổng ${crcSummary.total_cases} yêu cầu`}
          icon="support_agent"
          cls={crcSummary.open_cases > 0
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-slate-200 bg-slate-50 text-slate-600'}
        />
      </div>

      {crcSummary.total_cases > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Yêu cầu theo trạng thái</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(crcSummary.by_status).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                <span>{status.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ServicesTab({ insight }: { insight: CustomerInsight }) {
  const { services_used: servicesUsed, contracts_summary: contractsSummary } = insight;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Dịch vụ đang sử dụng</h3>
        {servicesUsed.length === 0 ? (
          <p className="text-sm italic text-slate-400">Chưa có dịch vụ nào trong hợp đồng</p>
        ) : (
          <div className="space-y-2">
            {servicesUsed.map((service) => (
              <div
                key={String(service.product_id)}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="material-symbols-outlined text-base text-sky-500">deployed_code</span>
                  <span className="truncate text-sm font-medium text-slate-800">{service.product_name}</span>
                  {service.service_group ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SERVICE_GROUP_CLS[service.service_group] ?? 'bg-slate-100 text-slate-500'}`}>
                      {service.service_group.replace('GROUP_', 'G')}
                    </span>
                  ) : null}
                  {service.unit ? <span className="text-xs text-slate-400">/ {service.unit}</span> : null}
                </div>
                <div className="flex items-center gap-4 text-sm md:ml-4 md:shrink-0">
                  <span className="text-xs text-slate-500">{service.contract_count} hợp đồng</span>
                  <span className="font-semibold text-emerald-700">{fmt(service.total_value)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Phân bổ hợp đồng</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(contractsSummary.by_status).map(([status, count]) => (
            <div
              key={status}
              className={`min-w-[80px] rounded-lg border px-4 py-3 text-center ${CONTRACT_STATUS_CLS[status] ?? 'border-slate-200 bg-slate-50'}`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="mt-0.5 text-xs">{CONTRACT_STATUS_LABEL[status] ?? status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildCustomerProfileItems(insight: CustomerInsight): string[] {
  const resolvedSector = resolveCustomerSector(insight.customer);
  const resolvedFacilityType = resolveHealthcareFacilityType(insight.customer);
  const items = [`Lĩnh vực: ${getCustomerSectorLabel(resolvedSector)}`];
  const facilityLabel = resolvedFacilityType ? getHealthcareFacilityTypeLabel(resolvedFacilityType) : null;

  if (facilityLabel) {
    items.push(`Loại hình: ${facilityLabel}`);
  }
  if (typeof insight.customer.bed_capacity === 'number' && Number.isFinite(insight.customer.bed_capacity)) {
    items.push(`Quy mô: ${insight.customer.bed_capacity.toLocaleString('vi-VN')} giường`);
  }

  items.push(`Đang dùng: ${insight.services_used.length} SP`);
  return items;
}

function describeSimilarCustomer(customer: UpsellSimilarCustomer | UpsellSectorCustomer): string {
  const parts: string[] = [];
  const resolvedSector = resolveCustomerSector({
    customer_sector: customer.customer_sector as Customer['customer_sector'],
    customer_name: customer.customer_name,
    company_name: null,
  });
  if (resolvedSector) {
    parts.push(getCustomerSectorLabel(resolvedSector));
  }
  const resolvedFacilityType = resolveHealthcareFacilityType({
    healthcare_facility_type: customer.healthcare_facility_type as Customer['healthcare_facility_type'],
    customer_name: customer.customer_name,
    company_name: null,
  });
  const facilityLabel = resolvedFacilityType ? getHealthcareFacilityTypeLabel(resolvedFacilityType) : null;
  if (facilityLabel) {
    parts.push(facilityLabel);
  }
  return parts.join(' · ');
}

function UpsellSection({
  title,
  subtitle,
  icon,
  toneClass,
  candidates,
  expandedProductId,
  detailCache,
  detailLoadingProductId,
  detailErrors,
  onToggleDetail,
}: {
  title: string;
  subtitle: string;
  icon: string;
  toneClass: string;
  candidates: CustomerInsightUpsellCandidate[];
  expandedProductId: string | number | null;
  detailCache: Record<string, UpsellProductDetail>;
  detailLoadingProductId: string | null;
  detailErrors: Record<string, string>;
  onToggleDetail: (productId: string | number) => Promise<void> | void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${toneClass}`}>{icon}</span>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {candidates.length} sản phẩm
          </span>
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {candidates.map((candidate) => {
          const key = String(candidate.product_id);
          const expanded = expandedProductId === candidate.product_id;
          return (
            <React.Fragment key={key}>
              <UpsellCard
                candidate={candidate}
                expanded={expanded}
                detail={detailCache[key] ?? null}
                detailLoading={detailLoadingProductId === key}
                detailError={detailErrors[key] ?? null}
                onToggleDetail={onToggleDetail}
              />
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function UpsellTab({
  customerId,
  insight,
}: {
  customerId: string | number;
  insight: CustomerInsight;
}) {
  const { upsell_candidates: upsellCandidates } = insight;
  const [expandedProductId, setExpandedProductId] = useState<string | number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, UpsellProductDetail>>({});
  const [detailLoadingProductId, setDetailLoadingProductId] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const expandRequestRef = useRef<string | number | null>(null);

  useEffect(() => {
    setExpandedProductId(null);
    setDetailCache({});
    setDetailLoadingProductId(null);
    setDetailErrors({});
    expandRequestRef.current = null;
  }, [customerId]);

  if (upsellCandidates.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <span className="material-symbols-outlined mb-2 block text-4xl">storefront</span>
        <p className="text-sm">Khách hàng đã sử dụng đầy đủ sản phẩm</p>
      </div>
    );
  }

  const targetedCandidates = upsellCandidates.filter((candidate) => candidate.recommendation_type === 'targeted');
  const popularCandidates = upsellCandidates.filter((candidate) => candidate.recommendation_type === 'popular');
  const profileItems = buildCustomerProfileItems(insight);

  const handleToggleDetail = async (productId: string | number) => {
    const key = String(productId);
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      if (expandRequestRef.current === productId) {
        expandRequestRef.current = null;
        setDetailLoadingProductId(null);
      }
      return;
    }

    setExpandedProductId(productId);
    setDetailErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (detailCache[key]) {
      expandRequestRef.current = productId;
      setDetailLoadingProductId(null);
      return;
    }

    expandRequestRef.current = productId;
    setDetailLoadingProductId(key);

    try {
      const { data } = await fetchUpsellProductDetail(customerId, productId);
      if (expandRequestRef.current === productId) {
        setDetailCache((prev) => ({ ...prev, [key]: data }));
      }
    } catch (error: unknown) {
      if (expandRequestRef.current === productId) {
        setDetailErrors((prev) => ({
          ...prev,
          [key]: error instanceof Error ? error.message : 'Không tải được chi tiết sản phẩm',
        }));
      }
    } finally {
      if (expandRequestRef.current === productId) {
        setDetailLoadingProductId(null);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-sky-600">insights</span>
              <h3 className="text-sm font-semibold text-slate-900">Gợi ý sản phẩm phù hợp</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {profileItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <UpsellSection
        title="Đề xuất phù hợp"
        subtitle="Được ưu tiên dựa trên ngành, loại hình và quy mô khách hàng."
        icon="target"
        toneClass="text-amber-500"
        candidates={targetedCandidates}
        expandedProductId={expandedProductId}
        detailCache={detailCache}
        detailLoadingProductId={detailLoadingProductId}
        detailErrors={detailErrors}
        onToggleDetail={handleToggleDetail}
      />

      <UpsellSection
        title="Sản phẩm phổ biến khác"
        subtitle="Nhóm bổ sung theo độ phổ biến khi danh sách phù hợp chưa đủ số lượng."
        icon="trending_up"
        toneClass="text-sky-500"
        candidates={popularCandidates}
        expandedProductId={expandedProductId}
        detailCache={detailCache}
        detailLoadingProductId={detailLoadingProductId}
        detailErrors={detailErrors}
        onToggleDetail={handleToggleDetail}
      />
    </div>
  );
}

function SimilarCustomersBlock({ customers }: { customers: UpsellSimilarCustomer[] }) {
  if (customers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-sm text-emerald-500">verified</span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Khách hàng tham khảo</p>
      </div>
      <div className="space-y-2">
        {customers.slice(0, 3).map((customer) => (
          <div key={`${customer.customer_name}-${customer.healthcare_facility_type ?? ''}`} className="rounded-lg bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-700">{customer.customer_name}</span>
              {customer.is_same_type ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  cùng loại
                </span>
              ) : null}
            </div>
            {describeSimilarCustomer(customer) ? (
              <p className="mt-1 text-xs text-slate-500">{describeSimilarCustomer(customer)}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureTree({ detail }: { detail: UpsellProductDetail }) {
  if (detail.feature_groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Chưa có thông tin chức năng chi tiết cho sản phẩm này.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {detail.feature_groups.map((group) => (
        <div key={String(group.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-sky-500">folder_open</span>
            <h5 className="text-sm font-semibold text-slate-800">{group.group_name}</h5>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {group.features.length} chức năng
            </span>
          </div>
          <div className="mt-3 space-y-2 border-l border-slate-200 pl-4">
            {group.features.length === 0 ? (
              <p className="text-xs text-slate-500">Nhóm này chưa có chức năng kích hoạt.</p>
            ) : (
              group.features.map((feature) => (
                <div key={`${group.id}-${feature.feature_name}`} className="relative rounded-lg bg-white px-3 py-2">
                  <span className="absolute -left-[18px] top-4 h-px w-3 bg-slate-300" />
                  <p className="text-sm font-medium text-slate-700">{feature.feature_name}</p>
                  {feature.detail_description ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{feature.detail_description}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectorCustomerTable({ customers }: { customers: UpsellSectorCustomer[] }) {
  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Chưa có khách hàng tham chiếu chi tiết cho sản phẩm này.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_88px_96px] gap-3 bg-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Tên KH</span>
        <span>Loại hình</span>
        <span>Số HĐ</span>
        <span>Giá trị</span>
      </div>
      <div className="divide-y divide-slate-200 bg-white">
        {customers.slice(0, 5).map((customer) => (
          <div
            key={`${customer.customer_name}-${customer.contract_count}`}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_88px_96px] gap-3 px-4 py-3 text-sm text-slate-700"
          >
            <span className="truncate font-medium">{customer.customer_name}</span>
            <span className="truncate text-slate-500">{describeSimilarCustomer(customer) || '--'}</span>
            <span>{customer.contract_count}</span>
            <span className="font-semibold text-emerald-700">{formatCompactCurrencyVnd(customer.total_value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpsellCard({
  candidate,
  expanded,
  detail,
  detailLoading,
  detailError,
  onToggleDetail,
}: {
  candidate: CustomerInsightUpsellCandidate;
  expanded: boolean;
  detail: UpsellProductDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onToggleDetail: (productId: string | number) => Promise<void> | void;
}) {
  const groupCls = SERVICE_GROUP_CLS[candidate.service_group ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all ${
        expanded
          ? 'border-sky-300 ring-1 ring-sky-100 xl:col-span-2'
          : candidate.recommendation_type === 'targeted'
            ? 'border-amber-200'
            : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              candidate.recommendation_type === 'targeted'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {candidate.recommendation_type === 'targeted' ? 'Phù hợp' : 'Phổ biến'}
            </span>
            {candidate.is_priority ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                <span className="material-symbols-outlined text-sm">star</span>
                Ưu tiên
              </span>
            ) : null}
            {candidate.segment_priority ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Mức độ {candidate.segment_priority}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined mt-0.5 text-lg ${
                candidate.recommendation_type === 'targeted' ? 'text-amber-500' : 'text-sky-500'
              }`}>
                inventory_2
              </span>
              <div className="min-w-0 space-y-1">
                <h4 className="text-base font-semibold text-slate-900">{candidate.product_name}</h4>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{candidate.product_code}</p>
              </div>
            </div>

            {candidate.product_description ? (
              <p className="text-sm leading-6 text-slate-600" style={DESCRIPTION_CLAMP_STYLE}>
                {candidate.product_description}
              </p>
            ) : (
              <p className="text-sm italic text-slate-400">Chưa có mô tả sản phẩm.</p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Đơn giá</p>
          <p className="text-lg font-bold text-emerald-700">{fmt(candidate.standard_price)}</p>
          <div className="text-xs text-slate-500">
            {candidate.unit ? <p>/ {candidate.unit}</p> : null}
            <p>{candidate.popularity} KH đang dùng</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${groupCls}`}>
          {candidate.service_group_label}
        </span>
      </div>

      {candidate.sales_notes ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-amber-600">lightbulb</span>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Gợi ý bán hàng</p>
          </div>
          <p className="text-sm leading-6 text-amber-900">{candidate.sales_notes}</p>
        </div>
      ) : null}

      <SimilarCustomersBlock customers={candidate.similar_customers} />

      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
        <div className="text-xs text-slate-500">
          {candidate.reference_customers.length > 0
            ? `${candidate.reference_customers.length} khách hàng tham khảo`
            : 'Chưa có khách hàng tham khảo'}
        </div>
        <button
          type="button"
          onClick={() => void onToggleDetail(candidate.product_id)}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          {expanded ? 'Thu gọn' : 'Xem chi tiết chức năng'}
          <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      {expanded ? (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-16 animate-pulse rounded-xl bg-white" />
              <div className="h-20 animate-pulse rounded-xl bg-white" />
            </div>
          ) : null}

          {!detailLoading && detailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {detailError}
            </div>
          ) : null}

          {!detailLoading && !detailError && detail ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-sky-600">account_tree</span>
                    <h5 className="text-sm font-semibold text-slate-900">Chức năng sản phẩm</h5>
                  </div>
                  <FeatureTree detail={detail} />
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-emerald-600">groups</span>
                    <h5 className="text-sm font-semibold text-slate-900">KH cùng loại đang triển khai</h5>
                  </div>
                  <SectorCustomerTable customers={detail.sector_customers} />
                </section>
              </div>

              {detail.segment_match ? (
                <div className="rounded-xl border border-sky-200 bg-white px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Mức độ phù hợp</p>
                      <p className="text-sm font-medium text-slate-800">{detail.segment_match.match_criteria}</p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      Ưu tiên {detail.segment_match.priority}
                    </span>
                  </div>
                  {detail.segment_match.sales_notes ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">{detail.segment_match.sales_notes}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

interface Props {
  customer: Customer;
  onClose: () => void;
}

export default function CustomerInsightPanel({ customer, onClose }: Props) {
  const [insight, setInsight] = useState<CustomerInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCustomerInsight(customer.id)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        setInsight(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer.id, reloadKey]);

  const upsellCount = insight?.upsell_candidates.length ?? 0;

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'dashboard' },
    { id: 'services', label: 'Dịch vụ & HĐ', icon: 'description' },
    { id: 'upsell', label: 'Gợi ý bán hàng', icon: 'storefront' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
              <span className="material-symbols-outlined text-sky-600">person</span>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-slate-800">{customer.customer_name}</h2>
              <p className="text-xs text-slate-500">
                {customer.customer_code}
                {customer.tax_code ? ` · MST: ${customer.tax_code}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
              {tab.id === 'upsell' && upsellCount > 0 ? (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                  {upsellCount > 9 ? '9+' : upsellCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined mb-2 block text-4xl text-red-400">error</span>
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 text-sm text-sky-600 hover:underline"
              >
                Thử lại
              </button>
            </div>
          ) : null}

          {!loading && !error && insight ? (
            <>
              {activeTab === 'overview' ? <OverviewTab insight={insight} /> : null}
              {activeTab === 'services' ? <ServicesTab insight={insight} /> : null}
              {activeTab === 'upsell' ? <UpsellTab customerId={customer.id} insight={insight} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
