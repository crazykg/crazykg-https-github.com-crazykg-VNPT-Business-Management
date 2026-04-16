import { useEffect, useMemo } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import { useRevenueReport } from '../../shared/hooks/useRevenue';
import type { Department, RevenueReportDimension, RevenueReportRow } from '../../types';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
} from '../../utils/revenueDisplay';
import { RevenueWorkspaceHeader } from './RevenueWorkspaceHeader';

interface Props {
  departments: Department[];
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

const DIMENSION_TABS: Array<{ id: RevenueReportDimension; icon: string; label: string }> = [
  { id: 'department', icon: 'corporate_fare', label: 'Theo phòng ban' },
  { id: 'customer', icon: 'people', label: 'Theo khách hàng' },
  { id: 'product', icon: 'inventory_2', label: 'Theo sản phẩm' },
  { id: 'time', icon: 'calendar_month', label: 'Theo thời gian' },
];

function findDepartmentLabel(departments: Department[], deptId: number | null): string {
  if (deptId == null) {
    return 'Toàn công ty';
  }

  return departments.find((department) => department.id === deptId)?.dept_name ?? `Đơn vị #${deptId}`;
}

function getRowLabel(row: RevenueReportRow, dimension: RevenueReportDimension): string {
  if (dimension === 'department') return row.department_name ?? 'Chưa gán đơn vị';
  if (dimension === 'customer') return row.customer_name ?? 'Chưa rõ khách hàng';
  if (dimension === 'product') return row.product_name ?? 'Chưa rõ sản phẩm';
  return row.month_label ?? row.month_key ?? 'Chưa rõ kỳ';
}

export function RevenueReportView({ departments }: Props) {
  const { periodFrom, periodTo, selectedDeptId, setDeptId, reportTab, setReportTab } = useRevenueStore();
  const addToast = useToastStore((s) => s.addToast);

  const dimension = reportTab as RevenueReportDimension;
  const reportQuery = useRevenueReport({
    period_from: periodFrom,
    period_to: periodTo,
    dimension,
    dept_id: selectedDeptId ?? undefined,
  });
  const data = reportQuery.data?.data ?? null;
  const isLoading = reportQuery.isLoading || reportQuery.isFetching;
  const dimensionMeta = DIMENSION_TABS.find((tab) => tab.id === dimension) ?? DIMENSION_TABS[0];
  const deptScopeLabel = findDepartmentLabel(departments, selectedDeptId);

  const insights = useMemo(() => {
    if (!data) {
      return [];
    }

    const shareLeader = [...data.rows]
      .filter((row) => (row.share_pct ?? 0) > 0)
      .sort((left, right) => (right.share_pct ?? 0) - (left.share_pct ?? 0))[0];
    const outstandingLeader = [...data.rows]
      .filter((row) => (row.outstanding ?? 0) > 0)
      .sort((left, right) => (right.outstanding ?? 0) - (left.outstanding ?? 0))[0];
    const collectionLeader = [...data.rows]
      .filter((row) => (row.collection_rate ?? 0) > 0)
      .sort((left, right) => (right.collection_rate ?? 0) - (left.collection_rate ?? 0))[0];
    const contractVolumeLeader = [...data.rows]
      .filter((row) => (row.contract_count ?? 0) > 0 || (row.contract_value ?? 0) > 0)
      .sort((left, right) => ((right.contract_value ?? right.contract_count ?? 0) - (left.contract_value ?? left.contract_count ?? 0)))[0];

    return [
      shareLeader
        ? {
            title: 'Tỷ trọng lớn nhất',
            value: `${shareLeader.share_pct ?? 0}%`,
            detail: `${getRowLabel(shareLeader, dimension)} đang chiếm tỷ trọng lớn nhất trong phạm vi này.`,
            tone: 'primary' as const,
          }
        : null,
      outstandingLeader
        ? {
            title: 'Cần theo dõi thu hồi',
            value: formatCompactCurrencyVnd(outstandingLeader.outstanding ?? 0),
            detail: `${getRowLabel(outstandingLeader, dimension)} hiện có số dư cần theo dõi lớn nhất.`,
            tone: 'warning' as const,
          }
        : null,
      dimension === 'product'
        ? (contractVolumeLeader
          ? {
              title: 'Danh mục nổi bật',
              value: formatCompactCurrencyVnd(contractVolumeLeader.contract_value ?? 0),
              detail: `${getRowLabel(contractVolumeLeader, dimension)} đang đóng góp ${contractVolumeLeader.contract_count ?? 0} hợp đồng.`,
              tone: 'success' as const,
            }
          : null)
        : (collectionLeader
          ? {
              title: 'Hiệu suất thu tốt nhất',
              value: `${collectionLeader.collection_rate ?? 0}%`,
              detail: `${getRowLabel(collectionLeader, dimension)} đang có tỷ lệ thu tốt nhất.`,
              tone: 'success' as const,
            }
          : null),
    ].filter(Boolean) as Array<{
      title: string;
      value: string;
      detail: string;
      tone: 'primary' | 'warning' | 'success';
    }>;
  }, [data, dimension]);

  useEffect(() => {
    if (!reportQuery.error) {
      return;
    }

    addToast('error', 'Lỗi', 'Không thể tải báo cáo doanh thu.');
  }, [reportQuery.error, addToast]);

  return (
    <div className="space-y-4 p-3 pb-6">
      <RevenueWorkspaceHeader
        icon="bar_chart"
        title="Báo cáo doanh thu"
        description="Chuyển giữa các chiều phân tích mà không rời khỏi cùng một bộ lọc ngữ cảnh. Màn này phù hợp cho góc nhìn điều hành và họp rà soát."
        badges={[
          {
            label: formatDateRangeDdMmYyyy(periodFrom, periodTo),
            icon: 'date_range',
            tone: 'primary',
          },
          {
            label: dimensionMeta.label,
            icon: dimensionMeta.icon,
            tone: 'neutral',
          },
          {
            label: deptScopeLabel,
            icon: 'corporate_fare',
            tone: selectedDeptId == null ? 'success' : 'neutral',
          },
        ]}
        metrics={[
          {
            label: 'Chiều phân tích',
            value: dimensionMeta.label,
            detail: `${data?.rows.length ?? 0} dòng dữ liệu trong phạm vi hiện tại.`,
            tone: 'primary',
          },
          {
            label: 'Khoảng báo cáo',
            value: formatDateRangeDdMmYyyy(periodFrom, periodTo),
            detail: 'Đồng bộ cùng bộ lọc với các tab doanh thu khác.',
          },
          {
            label: 'Đơn vị',
            value: deptScopeLabel,
            detail: dimension === 'department' ? 'So sánh tương quan nội bộ giữa các đơn vị.' : 'Có thể khoanh riêng phòng ban khi cần drill-down.',
            tone: selectedDeptId == null ? 'success' : 'neutral',
          },
        ]}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex overflow-x-auto rounded-md border border-slate-200 bg-white">
            {DIMENSION_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportTab(tab.id)}
                className={`flex shrink-0 items-center gap-1 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  dimension === tab.id
                    ? 'bg-primary text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dimension !== 'department' ? (
              <select
                value={selectedDeptId ?? ''}
                onChange={(e) => setDeptId(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                className="h-9 min-w-[180px] rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              >
                <option value="">Toàn công ty</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.dept_name}</option>
                ))}
              </select>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
              Executive view
            </span>
          </div>
        </div>
      </RevenueWorkspaceHeader>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <div className="text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300">analytics</span>
            <p className="mt-2 text-sm">Không có dữ liệu cho giai đoạn này.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            {data.totals ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {data.totals.total_expected != null ? (
                  <ReportSummaryCard
                    label="Tổng kỳ vọng"
                    value={formatCompactCurrencyVnd(data.totals.total_expected)}
                    tone="primary"
                  />
                ) : null}
                {data.totals.total_collected != null ? (
                  <ReportSummaryCard
                    label="Tổng đã thu"
                    value={formatCompactCurrencyVnd(data.totals.total_collected)}
                    tone="success"
                  />
                ) : null}
                {data.totals.total_outstanding != null ? (
                  <ReportSummaryCard
                    label="Tổng còn nợ"
                    value={formatCompactCurrencyVnd(data.totals.total_outstanding)}
                    tone="warning"
                  />
                ) : null}
                {data.totals.collection_rate != null ? (
                  <ReportSummaryCard
                    label="Tỷ lệ thu"
                    value={`${data.totals.collection_rate}%`}
                    tone="neutral"
                    detail="So với quy mô trong chiều phân tích hiện tại."
                  />
                ) : null}
                {data.totals.total_value != null ? (
                  <ReportSummaryCard
                    label="Tổng giá trị"
                    value={formatCompactCurrencyVnd(data.totals.total_value)}
                    tone="neutral"
                  />
                ) : null}
              </div>
            ) : <div />}

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-deep-teal">Nhìn nhanh điều hành</h3>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                  Gợi ý điểm cần bám ngay từ tập dữ liệu hiện tại của báo cáo.
                </p>
              </div>
              <div className="space-y-2 p-4">
                {insights.length > 0 ? insights.map((insight) => (
                  <div
                    key={insight.title}
                    className={`rounded-lg border p-3 ${
                      insight.tone === 'warning'
                        ? 'border-amber-200 bg-amber-50/80'
                        : insight.tone === 'success'
                          ? 'border-secondary/20 bg-secondary-fixed'
                          : 'border-primary/15 bg-primary/5'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">{insight.title}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{insight.value}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{insight.detail}</p>
                  </div>
                )) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-[11px] leading-5 text-slate-500">
                    Chưa đủ dữ liệu để tạo insight nhanh cho chiều phân tích này.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-deep-teal">Chi tiết báo cáo</h3>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                  Bảng chi tiết theo chiều {dimensionMeta.label.toLowerCase()} trong phạm vi đang xem.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {data.rows.length} dòng
              </span>
            </div>

            <div className="overflow-x-auto">
              {dimension === 'department' && <DepartmentTable rows={data.rows} />}
              {dimension === 'customer' && <CustomerTable rows={data.rows} />}
              {dimension === 'product' && <ProductTable rows={data.rows} />}
              {dimension === 'time' && <TimeTable rows={data.rows} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReportSummaryCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
  detail?: string;
}) {
  const toneClass = tone === 'primary'
    ? 'border-primary/15 bg-primary/5'
    : tone === 'success'
      ? 'border-secondary/20 bg-secondary-fixed'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/80'
        : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold text-neutral">{label}</p>
      <p className="mt-1 text-lg font-bold text-deep-teal">{value}</p>
      {detail ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
      ) : null}
    </div>
  );
}

// ── Dimension-specific sub-tables ─────────────────────────────────────────────

function DepartmentTable({ rows }: { rows: RevenueReportRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-3 py-2 font-medium text-gray-700">Phòng ban</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Kỳ vọng</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Đã thu</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Còn nợ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">% Thu</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Tỷ trọng</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.department_id ?? i} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{r.department_name}</td>
            <td className="px-3 py-2 text-right">{formatCurrencyVnd(r.expected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-green-700">{formatCurrencyVnd(r.collected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-red-600">{formatCurrencyVnd(r.outstanding ?? 0)}</td>
            <td className={`px-3 py-2 text-right font-semibold ${pctColor(r.collection_rate ?? 0)}`}>
              {r.collection_rate ?? 0}%
            </td>
            <td className="px-3 py-2 text-right text-gray-500">{r.share_pct ?? 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CustomerTable({ rows }: { rows: RevenueReportRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-3 py-2 font-medium text-gray-700">Khách hàng</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Kỳ vọng</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Đã thu</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Còn nợ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">% Thu</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Số HĐ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Tỷ trọng</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.customer_id ?? i} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{r.customer_name}</td>
            <td className="px-3 py-2 text-right">{formatCurrencyVnd(r.expected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-green-700">{formatCurrencyVnd(r.collected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-red-600">{formatCurrencyVnd(r.outstanding ?? 0)}</td>
            <td className={`px-3 py-2 text-right font-semibold ${pctColor(r.collection_rate ?? 0)}`}>
              {r.collection_rate ?? 0}%
            </td>
            <td className="px-3 py-2 text-right">{r.contract_count ?? 0}</td>
            <td className="px-3 py-2 text-right text-gray-500">{r.share_pct ?? 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductTable({ rows }: { rows: RevenueReportRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-3 py-2 font-medium text-gray-700">Sản phẩm</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Giá trị HĐ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Số HĐ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Tỷ trọng</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.product_id ?? i} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{r.product_name}</td>
            <td className="px-3 py-2 text-right">{formatCurrencyVnd(r.contract_value ?? 0)}</td>
            <td className="px-3 py-2 text-right">{r.contract_count ?? 0}</td>
            <td className="px-3 py-2 text-right text-gray-500">{r.share_pct ?? 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimeTable({ rows }: { rows: RevenueReportRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-3 py-2 font-medium text-gray-700">Tháng</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Kỳ vọng</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Đã thu</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Còn nợ</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Lũy kế KV</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">Lũy kế ĐT</th>
          <th className="text-right px-3 py-2 font-medium text-gray-700">% Thu</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.month_key ?? i} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{r.month_label}</td>
            <td className="px-3 py-2 text-right">{formatCurrencyVnd(r.expected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-green-700">{formatCurrencyVnd(r.collected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-red-600">{formatCurrencyVnd(r.outstanding ?? 0)}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatCurrencyVnd(r.cumulative_expected ?? 0)}</td>
            <td className="px-3 py-2 text-right text-green-600">{formatCurrencyVnd(r.cumulative_collected ?? 0)}</td>
            <td className={`px-3 py-2 text-right font-semibold ${pctColor(r.collection_rate ?? 0)}`}>
              {r.collection_rate ?? 0}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
