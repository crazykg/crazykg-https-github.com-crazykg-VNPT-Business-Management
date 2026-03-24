import { useState, useEffect, useCallback, useRef } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import {
  fetchRevenueByContract,
  fetchRevenueByContractDetail,
} from '../../services/v5Api';
import type {
  Department,
  RevenueByContractRow,
  RevenueByContractKpis,
  RevenueContractSchedule,
} from '../../types';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
} from '../../utils/revenueDisplay';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';

interface Props {
  departments: Department[];
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function RevenueByContractView({ departments }: Props) {
  const { periodFrom, periodTo, selectedDeptId, setDeptId } = useRevenueStore();
  const addToast = useToastStore((s) => s.addToast);

  const [rows, setRows] = useState<RevenueByContractRow[]>([]);
  const [kpis, setKpis] = useState<RevenueByContractKpis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [sortKey, setSortKey] = useState('outstanding');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Drill-down
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<RevenueContractSchedule[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchRevenueByContract({
        period_from: periodFrom,
        period_to: periodTo,
        dept_id: selectedDeptId ?? undefined,
        q: searchQ || undefined,
        page: p,
        per_page: 25,
        sort_key: sortKey,
        sort_dir: sortDir,
      });
      setRows(res.data);
      setKpis(res.meta.kpis);
      setTotalPages(res.meta.total_pages);
      setTotal(res.meta.total);
      setPage(p);
    } catch {
      addToast('error', 'Lỗi', 'Không thể tải dữ liệu theo hợp đồng.');
    } finally {
      setIsLoading(false);
    }
  }, [periodFrom, periodTo, selectedDeptId, searchQ, sortKey, sortDir, addToast]);

  useEffect(() => { load(1); }, [load]);

  const handleSearchChange = (val: string) => {
    setSearchQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1), 300);
  };

  const handleSort = (col: string) => {
    if (sortKey === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
  };

  const handleExpand = async (contractId: number) => {
    if (expandedId === contractId) {
      setExpandedId(null);
      setSchedules([]);
      return;
    }
    setExpandedId(contractId);
    setIsLoadingDetail(true);
    try {
      const res = await fetchRevenueByContractDetail(contractId, {
        period_from: periodFrom,
        period_to: periodTo,
      });
      setSchedules(res.data);
    } catch {
      addToast('error', 'Lỗi', 'Không thể tải chi tiết hợp đồng.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const sortIcon = (col: string) => {
    if (sortKey !== col) return 'unfold_more';
    return sortDir === 'asc' ? 'expand_less' : 'expand_more';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm mã HĐ, tên HĐ, khách hàng..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
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
        <span className="text-xs text-gray-500">
          {formatDateRangeDdMmYyyy(periodFrom, periodTo)}
        </span>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Hợp đồng', value: kpis.contract_count.toString(), icon: 'description' },
            { label: 'Doanh thu kỳ vọng', value: formatCompactCurrencyVnd(kpis.total_expected), icon: 'trending_up' },
            { label: 'Đã thu', value: formatCompactCurrencyVnd(kpis.total_collected), icon: 'payments' },
            { label: 'Còn nợ', value: formatCompactCurrencyVnd(kpis.total_outstanding), icon: 'account_balance' },
            { label: 'Tỷ lệ thu', value: kpis.collection_rate + '%', icon: 'percent', color: pctColor(kpis.collection_rate) },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
                {k.label}
              </div>
              <div className={`text-lg font-semibold ${k.color || 'text-gray-900'}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700 w-8" />
                {[
                  { key: 'contract_code', label: 'Mã HĐ' },
                  { key: 'customer_name', label: 'Khách hàng' },
                  { key: 'expected_revenue', label: 'Kỳ vọng' },
                  { key: 'actual_collected', label: 'Đã thu' },
                  { key: 'outstanding', label: 'Còn nợ' },
                  { key: 'collection_rate', label: '%' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="text-left px-3 py-2 font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <span className="material-symbols-outlined text-[14px] text-gray-400">{sortIcon(key)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Không có dữ liệu.</td></tr>
              ) : (
                rows.map((r) => (
                  <>
                    <tr
                      key={r.contract_id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expandedId === r.contract_id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleExpand(r.contract_id)}
                    >
                      <td className="px-3 py-2">
                        <span className="material-symbols-outlined text-[16px] text-gray-400">
                          {expandedId === r.contract_id ? 'expand_more' : 'chevron_right'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-blue-700">{r.contract_code}</td>
                      <td className="px-3 py-2 text-gray-700">{r.customer_name}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyVnd(r.expected_revenue)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatCurrencyVnd(r.actual_collected)}</td>
                      <td className="px-3 py-2 text-right text-red-600 font-medium">{formatCurrencyVnd(r.outstanding)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${pctColor(r.collection_rate)}`}>
                        {r.collection_rate}%
                      </td>
                    </tr>
                    {expandedId === r.contract_id && (
                      <tr key={`detail-${r.contract_id}`}>
                        <td colSpan={7} className="bg-gray-50 px-6 py-3">
                          {isLoadingDetail ? (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                              Đang tải...
                            </div>
                          ) : schedules.length === 0 ? (
                            <p className="text-gray-400 text-sm">Không có kỳ thanh toán trong giai đoạn này.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-200">
                                  <th className="text-left py-1 px-2">Kỳ</th>
                                  <th className="text-left py-1 px-2">Ngày dự kiến</th>
                                  <th className="text-right py-1 px-2">Kỳ vọng</th>
                                  <th className="text-right py-1 px-2">Đã thu</th>
                                  <th className="text-left py-1 px-2">Trạng thái</th>
                                  <th className="text-left py-1 px-2">Hóa đơn</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedules.map((s) => (
                                  <tr key={s.schedule_id} className="border-b border-gray-100">
                                    <td className="py-1 px-2">{s.milestone_name || `Kỳ ${s.cycle_number ?? '-'}`}</td>
                                    <td className="py-1 px-2">{formatDateDdMmYyyy(s.expected_date)}</td>
                                    <td className="py-1 px-2 text-right">{formatCurrencyVnd(s.expected_amount)}</td>
                                    <td className="py-1 px-2 text-right text-green-700">{formatCurrencyVnd(s.actual_amount)}</td>
                                    <td className="py-1 px-2">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                        s.schedule_status === 'PAID' ? 'bg-green-100 text-green-800' :
                                        s.schedule_status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                        s.schedule_status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {s.schedule_status}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2">
                                      {s.invoice_code ? (
                                        <span className="text-blue-600">{s.invoice_code}</span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            <span>{total} hợp đồng</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span>Trang {page}/{totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
