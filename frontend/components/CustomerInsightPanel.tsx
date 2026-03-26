import React, { useEffect, useRef, useState } from 'react';
import { fetchCustomerInsight } from '../services/v5Api';
import type { Customer, CustomerInsight, CustomerInsightUpsellCandidate } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('vi-VN') + ' đ';

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
  GROUP_B: 'bg-purple-100 text-purple-700 border-purple-200',
  GROUP_C: 'bg-orange-100 text-orange-700 border-orange-200',
};

type ActiveTab = 'overview' | 'services' | 'upsell';

// ── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, cls }: {
  label: string; value: string | number; sub?: string; icon: string; cls: string;
}) {
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${cls}`}>
      <span className="material-symbols-outlined text-2xl mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium opacity-70 truncate">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-slate-50 p-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
      <div className="h-5 bg-slate-200 rounded w-3/4" />
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ insight }: { insight: CustomerInsight }) {
  const { contracts_summary: c, crc_summary: crc } = insight;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Hợp đồng đang hiệu lực"
          value={(c.by_status['SIGNED'] ?? 0) + (c.by_status['RENEWED'] ?? 0)}
          sub={`Tổng ${c.total_count} hợp đồng`}
          icon="description"
          cls="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <KpiCard
          label="Tổng giá trị hợp đồng"
          value={fmt(c.total_value)}
          sub={`Đang TH: ${fmt(c.active_value)}`}
          icon="payments"
          cls="border-sky-200 bg-sky-50 text-sky-800"
        />
        <KpiCard
          label="Yêu cầu đang xử lý"
          value={crc.open_cases}
          sub={`Tổng ${crc.total_cases} case`}
          icon="support_agent"
          cls={crc.open_cases > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}
        />
      </div>

      {/* CRC by status */}
      {crc.total_cases > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Yêu cầu theo trạng thái</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(crc.by_status).map(([status, count]) => (
              <span key={status}
                className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                <span>{status.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesTab({ insight }: { insight: CustomerInsight }) {
  const { services_used, contracts_summary } = insight;

  return (
    <div className="space-y-6">
      {/* Services used */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Dịch vụ đang sử dụng</h3>
        {services_used.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Chưa có dịch vụ nào trong hợp đồng</p>
        ) : (
          <div className="space-y-2">
            {services_used.map((s) => (
              <div key={String(s.product_id)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-base text-sky-500">deployed_code</span>
                  <span className="font-medium text-sm text-slate-800 truncate">{s.product_name}</span>
                  {s.service_group && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERVICE_GROUP_CLS[s.service_group] ?? 'bg-slate-100 text-slate-500'}`}>
                      {s.service_group.replace('GROUP_', 'G')}
                    </span>
                  )}
                  {s.unit && <span className="text-xs text-slate-400">/ {s.unit}</span>}
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className="text-xs text-slate-500">{s.contract_count} hợp đồng</span>
                  <span className="text-sm font-semibold text-emerald-700">{fmt(s.total_value)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contracts by status */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Phân bổ hợp đồng</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(contracts_summary.by_status).map(([status, count]) => (
            <div key={status}
              className={`rounded-lg border px-4 py-3 text-center min-w-[80px] ${CONTRACT_STATUS_CLS[status] ?? 'bg-slate-50 border-slate-200'}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5">{CONTRACT_STATUS_LABEL[status] ?? status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Upsell tab ────────────────────────────────────────────────────────────────

function UpsellTab({
  insight,
}: {
  insight: CustomerInsight;
}) {
  const { upsell_candidates } = insight;

  if (upsell_candidates.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <span className="material-symbols-outlined text-4xl mb-2 block">storefront</span>
        <p className="text-sm">Khách hàng đã sử dụng đầy đủ sản phẩm</p>
      </div>
    );
  }

  const priorityItems = upsell_candidates.filter((c) => c.is_priority);
  const otherItems    = upsell_candidates.filter((c) => !c.is_priority);

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Các sản phẩm phổ biến chưa có trong hợp đồng của khách hàng này.
        Sản phẩm <span className="font-semibold text-blue-700">Dịch vụ nhóm A</span> được ưu tiên tư vấn trước.
      </p>

      {/* ── GROUP_A priority section ── */}
      {priorityItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-500">star</span>
            <h4 className="text-sm font-semibold text-slate-700">Ưu tiên tư vấn</h4>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Dịch vụ nhóm A</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {priorityItems.map((c) => (
              <React.Fragment key={String(c.product_id)}>
                <UpsellCard candidate={c} />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ── Remaining products ── */}
      {otherItems.length > 0 && (
        <div className="space-y-2">
          {priorityItems.length > 0 && (
            <h4 className="text-sm font-semibold text-slate-700">Sản phẩm bổ sung</h4>
          )}
          <div className="grid grid-cols-2 gap-3">
            {otherItems.map((c) => (
              <React.Fragment key={String(c.product_id)}>
                <UpsellCard candidate={c} />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UpsellCard({
  candidate: c,
}: {
  candidate: CustomerInsightUpsellCandidate;
}) {
  const groupCls = SERVICE_GROUP_CLS[c.service_group ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <div className={`rounded-lg border bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow
      ${c.is_priority ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}>

      {/* Header: tên + nhóm dịch vụ */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className={`material-symbols-outlined text-base mt-0.5
            ${c.is_priority ? 'text-blue-500' : 'text-purple-400'}`}>
            inventory_2
          </span>
          <span className="font-semibold text-sm text-slate-800 leading-snug">{c.product_name}</span>
        </div>

        {/* Nhóm dịch vụ */}
        {c.service_group && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {c.is_priority && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                <span className="material-symbols-outlined text-xs">star</span>
                Ưu tiên
              </span>
            )}
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium border ${groupCls}`}>
              {c.service_group_label}
            </span>
          </div>
        )}
      </div>

      {/* Giá + độ phổ biến */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-base font-bold text-emerald-700">{fmt(c.standard_price)}</p>
          {c.unit && <p className="text-xs text-slate-400">/ {c.unit}</p>}
        </div>
        {c.popularity > 0 && (
          <div className="text-right">
            <span className="text-xs font-medium text-slate-500">
              {c.popularity} KH đang dùng
            </span>
          </div>
        )}
      </div>

      {/* Khách hàng minh chứng */}
      {c.reference_customers.length > 0 && (
        <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 space-y-0.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Đang triển khai tại</p>
          {c.reference_customers.map((name) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-emerald-500">verified</span>
              <span className="text-xs text-slate-600 truncate">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  customer: Customer;
  onClose: () => void;
}

export default function CustomerInsightPanel({ customer, onClose }: Props) {
  const [insight, setInsight] = useState<CustomerInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    fetchCustomerInsight(customer.id)
      .then(({ data }) => { if (!cancelled) { setInsight(data); setLoading(false); } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
          setLoading(false);
        }
      });

    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [customer.id]);

  const upsellCount = insight?.upsell_candidates.length ?? 0;

  const TABS: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'dashboard' },
    { id: 'services', label: 'Dịch vụ & HĐ', icon: 'description' },
    { id: 'upsell', label: 'Gợi ý bán hàng', icon: 'storefront' },
  ];

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {/* Panel */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-sky-600">person</span>
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">{customer.customer_name}</h2>
              <p className="text-xs text-slate-500">
                {customer.customer_code}
                {customer.tax_code ? ` · MST: ${customer.tax_code}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative
                ${activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
              {tab.id === 'upsell' && upsellCount > 0 && (
                <span className="ml-1 bg-rose-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {upsellCount > 9 ? '9+' : upsellCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2 block">error</span>
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={() => { setLoading(true); setError(null); }}
                className="mt-3 text-sm text-sky-600 hover:underline">
                Thử lại
              </button>
            </div>
          )}

          {!loading && !error && insight && (
            <>
              {activeTab === 'overview' && <OverviewTab insight={insight} />}
              {activeTab === 'services' && <ServicesTab insight={insight} />}
              {activeTab === 'upsell' && (
                <UpsellTab insight={insight} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
