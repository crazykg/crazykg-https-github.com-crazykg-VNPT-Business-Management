import { useState, useEffect, useCallback } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import { fetchRevenueReport } from '../../services/v5Api';
import type { Department, RevenueReportData, RevenueReportDimension, RevenueReportRow } from '../../types';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
} from '../../utils/revenueDisplay';

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

export function RevenueReportView({ departments }: Props) {
  const { periodFrom, periodTo, selectedDeptId, setDeptId, reportTab, setReportTab } = useRevenueStore();
  const addToast = useToastStore((s) => s.addToast);

  const [data, setData] = useState<RevenueReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dimension = reportTab as RevenueReportDimension;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchRevenueReport({
        period_from: periodFrom,
        period_to: periodTo,
        dimension,
        dept_id: selectedDeptId ?? undefined,
      });
      setData(res.data);
    } catch {
      addToast('error', 'Lỗi', 'Không thể tải báo cáo doanh thu.');
    } finally {
      setIsLoading(false);
    }
  }, [periodFrom, periodTo, dimension, selectedDeptId, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {DIMENSION_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm ${
                dimension === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        {dimension !== 'department' && (
          <select
            value={selectedDeptId ?? ''}
            onChange={(e) => setDeptId(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-[150px]"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.dept_name}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-500">
          {formatDateRangeDdMmYyyy(periodFrom, periodTo)}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300">analytics</span>
            <p className="mt-2 text-sm">Không có dữ liệu cho giai đoạn này.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Totals summary */}
          {data.totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.totals.total_expected != null && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Tổng kỳ vọng</div>
                  <div className="text-lg font-semibold">{formatCompactCurrencyVnd(data.totals.total_expected)}</div>
                </div>
              )}
              {data.totals.total_collected != null && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Tổng đã thu</div>
                  <div className="text-lg font-semibold text-green-600">{formatCompactCurrencyVnd(data.totals.total_collected)}</div>
                </div>
              )}
              {data.totals.total_outstanding != null && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Tổng còn nợ</div>
                  <div className="text-lg font-semibold text-red-600">{formatCompactCurrencyVnd(data.totals.total_outstanding)}</div>
                </div>
              )}
              {data.totals.collection_rate != null && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Tỷ lệ thu</div>
                  <div className={`text-lg font-semibold ${pctColor(data.totals.collection_rate)}`}>
                    {data.totals.collection_rate}%
                  </div>
                </div>
              )}
              {data.totals.total_value != null && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Tổng giá trị</div>
                  <div className="text-lg font-semibold">{formatCompactCurrencyVnd(data.totals.total_value)}</div>
                </div>
              )}
            </div>
          )}

          {/* Data table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
