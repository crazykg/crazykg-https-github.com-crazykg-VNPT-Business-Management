import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Contract,
  ContractRevenueAnalytics,
  Customer,
  PaymentSchedule,
  Project,
  RevenueByContract,
  RevenueByItem,
} from '../../types';
import { fetchContractRevenueAnalytics } from '../../services/v5Api';
import { RevenueBarChart } from './RevenueBarChart';
import { RevenueCumulativeChart } from './RevenueCumulativeChart';

interface ContractRevenueViewProps {
  periodFrom: string | null;
  periodTo: string | null;
  periodLabel: string;
  fixedSourceMode?: 'PROJECT' | 'INITIAL';
  paymentSchedules?: PaymentSchedule[];
  contracts?: Contract[];
  customers?: Customer[];
  projects?: Project[];
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

type RevenueSortField = 'outstanding' | 'expected_in_period' | 'actual_in_period' | 'contract_name';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN').format(new Date(timestamp));
};

const paymentCycleLabel = (cycle?: string | null): string => {
  const normalized = String(cycle || 'ONCE').toUpperCase();
  if (normalized === 'MONTHLY') return 'Hàng tháng';
  if (normalized === 'QUARTERLY') return 'Hàng quý';
  if (normalized === 'HALF_YEARLY') return '6 tháng/lần';
  if (normalized === 'YEARLY') return 'Hàng năm';
  return 'Một lần';
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

const progressTone = (value: number): string => {
  if (value >= 80) return 'bg-success';
  if (value >= 50) return 'bg-warning';
  return 'bg-error';
};

const toneBadgeClass = (value: number): string => {
  if (value >= 80) return 'bg-emerald-100 text-emerald-700';
  if (value >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const overdueTone = (days: number): string => {
  if (days >= 30) return 'text-error bg-error/10';
  if (days >= 7) return 'text-warning bg-warning/15';
  return 'text-slate-700 bg-slate-100';
};

export const ContractRevenueView: React.FC<ContractRevenueViewProps> = ({
  periodFrom,
  periodTo,
  periodLabel,
  fixedSourceMode,
  onNotify,
}) => {
  const [analytics, setAnalytics] = useState<ContractRevenueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [grouping, setGrouping] = useState<'month' | 'quarter'>('month');
  const [expandedContractId, setExpandedContractId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<RevenueSortField>('outstanding');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailLoadingContractId, setDetailLoadingContractId] = useState<number | null>(null);
  const [itemBreakdowns, setItemBreakdowns] = useState<Record<number, RevenueByItem[]>>({});
  const loadVersionRef = useRef(0);
  const detailLoadVersionRef = useRef(0);

  useEffect(() => {
    setExpandedContractId(null);
    setItemBreakdowns({});
  }, [periodFrom, periodTo, grouping]);

  useEffect(() => {
    if (!periodFrom || !periodTo) {
      setAnalytics(null);
      return;
    }

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    setIsLoading(true);

    void fetchContractRevenueAnalytics({
      period_from: periodFrom,
      period_to: periodTo,
      grouping,
      source_mode: fixedSourceMode,
    })
      .then((result) => {
        if (loadVersionRef.current !== loadVersion) {
          return;
        }
        setAnalytics(result);
      })
      .catch((error) => {
        if (loadVersionRef.current !== loadVersion) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Không tải được dữ liệu doanh thu.';
        onNotify?.('error', 'Tải doanh thu thất bại', message);
      })
      .finally(() => {
        if (loadVersionRef.current === loadVersion) {
          setIsLoading(false);
        }
      });
  }, [fixedSourceMode, grouping, onNotify, periodFrom, periodTo]);

  const sortedContracts = useMemo(() => {
    const rows = [...(analytics?.by_contract ?? [])];
    rows.sort((left, right) => {
      const leftValue = left[sortBy];
      const rightValue = right[sortBy];

      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return sortDir === 'asc'
          ? leftValue.localeCompare(rightValue, 'vi')
          : rightValue.localeCompare(leftValue, 'vi');
      }

      if (leftValue < rightValue) return sortDir === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [analytics?.by_contract, sortBy, sortDir]);

  const requestContractBreakdown = async (contractId: number): Promise<void> => {
    if (!periodFrom || !periodTo || itemBreakdowns[contractId]) {
      return;
    }

    const detailVersion = detailLoadVersionRef.current + 1;
    detailLoadVersionRef.current = detailVersion;
    setDetailLoadingContractId(contractId);

    try {
      const result = await fetchContractRevenueAnalytics({
        period_from: periodFrom,
        period_to: periodTo,
        grouping,
        contract_id: contractId,
        source_mode: fixedSourceMode,
      });
      if (detailLoadVersionRef.current !== detailVersion) {
        return;
      }
      setItemBreakdowns((current) => ({
        ...current,
        [contractId]: result.by_item ?? [],
      }));
    } catch (error) {
      if (detailLoadVersionRef.current !== detailVersion) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không tải được chi tiết hạng mục.';
      onNotify?.('error', 'Tải chi tiết thất bại', message);
    } finally {
      if (detailLoadVersionRef.current === detailVersion) {
        setDetailLoadingContractId(null);
      }
    }
  };

  const toggleExpandContract = (contractId: number): void => {
    if (expandedContractId === contractId) {
      setExpandedContractId(null);
      return;
    }

    setExpandedContractId(contractId);
    void requestContractBreakdown(contractId);
  };

  const handleSort = (field: RevenueSortField): void => {
    if (sortBy === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(field);
    setSortDir(field === 'contract_name' ? 'asc' : 'desc');
  };

  const renderSortIcon = (field: RevenueSortField): React.ReactNode => {
    if (sortBy !== field) {
      return <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 14 }}>unfold_more</span>;
    }

    return (
      <span
        className="material-symbols-outlined transition-transform duration-200"
        style={{ fontSize: 14, transform: sortDir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        arrow_upward
      </span>
    );
  };

  if (!periodFrom || !periodTo) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Chọn khoảng thời gian để xem phân tích doanh thu.
      </div>
    );
  }

  if (isLoading && !analytics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`rev-kpi-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-6 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`rev-chart-${index}`} className="h-[280px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Không có dữ liệu doanh thu cho kỳ {periodLabel}.
      </div>
    );
  }

  const { kpis } = analytics;

  return (
    <div className="space-y-4">
      {/* ── Section header + grouping toggle ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-700">
            {fixedSourceMode === 'INITIAL'
              ? 'Phân tích doanh thu HĐ đầu kỳ'
              : fixedSourceMode === 'PROJECT'
                ? 'Phân tích doanh thu HĐ theo dự án'
                : 'Phân tích doanh thu hợp đồng'}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">Theo dõi dự kiến, thực thu, tồn đọng và chi tiết thu tiền trong kỳ {periodLabel}.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {([
            { value: 'month', label: 'Theo tháng' },
            { value: 'quarter', label: 'Theo quý' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGrouping(option.value)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                grouping === option.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Doanh thu dự kiến',
            value: formatCurrency(kpis.expected_revenue),
            hint: 'Tổng dòng tiền đến hạn trong kỳ',
            icon: 'account_balance',
            tone: 'bg-secondary/15 text-secondary',
          },
          {
            label: 'Đã thu được',
            value: formatCurrency(kpis.actual_collected),
            hint: `${kpis.collection_rate}% kế hoạch kỳ này`,
            icon: 'payments',
            tone: 'bg-emerald-100 text-emerald-700',
          },
          {
            label: 'Tồn chưa thu',
            value: formatCurrency(kpis.outstanding),
            hint: 'Giá trị chưa thu trong kỳ hiện tại',
            icon: 'pending_actions',
            tone: 'bg-amber-100 text-amber-700',
          },
          {
            label: 'Quá hạn TT',
            value: formatCurrency(kpis.overdue_amount),
            hint: `${kpis.overdue_count} đợt quá hạn`,
            icon: 'warning',
            tone: kpis.overdue_amount > 0 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-500',
          },
          {
            label: 'Dồn kỳ trước',
            value: formatCurrency(kpis.carry_over_from_previous),
            hint: 'Công nợ mở đầu kỳ',
            icon: 'history',
            tone: 'bg-deep-teal/10 text-deep-teal',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-neutral">{card.label}</p>
                <p className="mt-1.5 text-xl font-black text-deep-teal leading-tight">{card.value}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{card.hint}</p>
              </div>
              <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${card.tone}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary metrics row ── */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Tỷ lệ thu tiền',
            value: `${kpis.collection_rate}%`,
            meta: `${formatCurrency(kpis.actual_collected)} / ${formatCurrency(kpis.expected_revenue)}`,
            progress: clampPercent(kpis.collection_rate),
          },
          {
            label: 'Số ngày thu TB',
            value: `${kpis.avg_days_to_collect || 0} ngày`,
            meta: 'Tính trên các đợt đã có thực thu',
          },
          {
            label: 'Tỷ lệ đúng hạn',
            value: `${kpis.on_time_rate}%`,
            meta: 'Đợt thu đúng/sớm hơn ngày dự kiến',
            badgeClass: toneBadgeClass(kpis.on_time_rate),
          },
          {
            label: 'Số đợt quá hạn',
            value: `${kpis.overdue_count}`,
            meta: 'Các đợt đang mang trạng thái OVERDUE',
            badgeClass: kpis.overdue_count > 0 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-600',
          },
          {
            label: 'Lũy kế đã thu',
            value: formatCurrency(kpis.cumulative_collected),
            meta: `Đến hết ${formatDate(periodTo)}`,
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg bg-slate-50 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral">{metric.label}</p>
                <p className="mt-1 text-base font-black text-deep-teal leading-tight">{metric.value}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{metric.meta}</p>
              </div>
              {metric.badgeClass && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${metric.badgeClass}`}>
                  {metric.value}
                </span>
              )}
            </div>
            {typeof metric.progress === 'number' && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full transition-all ${progressTone(metric.progress)}`} style={{ width: `${metric.progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RevenueBarChart data={analytics.by_period} />
        <RevenueCumulativeChart data={analytics.by_period} />
      </div>

      {/* ── By cycle table ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-700">Doanh thu theo chu kỳ thanh toán</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">Xem chu kỳ nào đang đóng góp doanh thu lớn nhất trong kỳ.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-slate-200">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Chu kỳ</th>
                <th className="pb-2">Số HĐ</th>
                <th className="pb-2">DT dự kiến</th>
                <th className="pb-2">Đã thu</th>
                <th className="pb-2">Tỷ trọng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.by_cycle.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                    Chưa có chu kỳ thanh toán nào trong kỳ đã chọn.
                  </td>
                </tr>
              ) : (
                analytics.by_cycle.map((row) => (
                  <tr key={row.cycle} className="text-xs text-slate-700">
                    <td className="py-2.5 font-semibold text-slate-900">{row.cycle_label}</td>
                    <td className="py-2.5">{row.contract_count}</td>
                    <td className="py-2.5 font-semibold">{formatCurrency(row.expected)}</td>
                    <td className="py-2.5">{formatCurrency(row.actual)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.percentage_of_total)}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">{row.percentage_of_total}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── By contract table ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-700">Doanh thu theo hợp đồng</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">Mở rộng từng hợp đồng để xem phân bổ doanh thu theo hạng mục.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left">
            <thead className="border-b border-slate-200">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Chi tiết</th>
                <th className="pb-2 cursor-pointer" onClick={() => handleSort('contract_name')}>
                  <div className="inline-flex items-center gap-1">Hợp đồng {renderSortIcon('contract_name')}</div>
                </th>
                <th className="pb-2">Khách hàng</th>
                <th className="pb-2">Chu kỳ</th>
                <th className="pb-2">Giá trị HĐ</th>
                <th className="pb-2 cursor-pointer" onClick={() => handleSort('expected_in_period')}>
                  <div className="inline-flex items-center gap-1">DT kỳ {renderSortIcon('expected_in_period')}</div>
                </th>
                <th className="pb-2 cursor-pointer" onClick={() => handleSort('actual_in_period')}>
                  <div className="inline-flex items-center gap-1">Thực thu {renderSortIcon('actual_in_period')}</div>
                </th>
                <th className="pb-2 cursor-pointer" onClick={() => handleSort('outstanding')}>
                  <div className="inline-flex items-center gap-1">Tồn đọng {renderSortIcon('outstanding')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-500">
                    Chưa có hợp đồng phát sinh doanh thu trong kỳ này.
                  </td>
                </tr>
              ) : (
                sortedContracts.map((row) => {
                  const isExpanded = expandedContractId === row.contract_id;
                  const detailRows = itemBreakdowns[row.contract_id];
                  const isDetailLoading = detailLoadingContractId === row.contract_id;

                  return (
                    <React.Fragment key={row.contract_id}>
                      <tr className="text-xs text-slate-700 hover:bg-slate-50/70">
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpandContract(row.contract_id)}
                            className="inline-flex items-center rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                          </button>
                        </td>
                        <td className="py-2.5">
                          <div className="font-semibold text-slate-900">{row.contract_code}</div>
                          <div className="mt-0.5 text-[10px] text-slate-500">{row.contract_name}</div>
                        </td>
                        <td className="py-2.5 text-slate-600">{row.customer_name || '-'}</td>
                        <td className="py-2.5 text-slate-600">{paymentCycleLabel(row.payment_cycle)}</td>
                        <td className="py-2.5 font-semibold text-slate-900">
                          {row.is_terminated ? (
                            <div>
                              <span className="line-through text-slate-400">{formatCurrency(row.contract_value)}</span>
                              {row.penalty_amount != null && row.penalty_amount > 0 && (
                                <span
                                  className="ml-1.5 inline-flex items-center rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-bold text-error"
                                  title={`Phí phạt: ${formatCurrency(row.penalty_amount)}`}
                                >
                                  Phạt {formatCurrency(row.penalty_amount)}
                                </span>
                              )}
                            </div>
                          ) : (
                            formatCurrency(row.contract_value)
                          )}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-900">{formatCurrency(row.expected_in_period)}</td>
                        <td className="py-2.5 text-success font-semibold">{formatCurrency(row.actual_in_period)}</td>
                        <td className="py-2.5">
                          <div className="inline-flex rounded-full bg-tertiary/10 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                            {formatCurrency(row.outstanding)}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-4 py-3">
                            {isDetailLoading ? (
                              <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
                                Đang tải phân bổ hạng mục...
                              </div>
                            ) : detailRows && detailRows.length > 0 ? (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-[960px] w-full text-left">
                                  <thead className="border-b border-slate-200 bg-slate-50">
                                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      <th className="px-3 py-2">Sản phẩm</th>
                                      <th className="px-3 py-2">ĐVT</th>
                                      <th className="px-3 py-2">SL</th>
                                      <th className="px-3 py-2">Đơn giá</th>
                                      <th className="px-3 py-2">Thành tiền</th>
                                      <th className="px-3 py-2">Tỷ trọng</th>
                                      <th className="px-3 py-2">DT kỳ</th>
                                      <th className="px-3 py-2">Thực thu</th>
                                      <th className="px-3 py-2">Tồn đọng</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {detailRows.map((item) => (
                                      <tr key={item.product_id} className="text-xs text-slate-700">
                                        <td className="px-3 py-2.5">
                                          <div className="font-semibold text-slate-900">{item.product_code}</div>
                                          <div className="mt-0.5 text-[10px] text-slate-500">{item.product_name}</div>
                                        </td>
                                        <td className="px-3 py-2.5">{item.unit || '--'}</td>
                                        <td className="px-3 py-2.5">{item.quantity}</td>
                                        <td className="px-3 py-2.5">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-3 py-2.5 font-semibold">{formatCurrency(item.line_total)}</td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.proportion)}%` }} />
                                            </div>
                                            <span className="text-[10px] font-semibold text-slate-500">{item.proportion}%</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-slate-900">{formatCurrency(item.allocated_expected)}</td>
                                        <td className="px-3 py-2.5 text-success font-semibold">{formatCurrency(item.allocated_actual)}</td>
                                        <td className="px-3 py-2.5 text-warning font-semibold">{formatCurrency(item.allocated_outstanding)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">
                                Hợp đồng này chưa có hạng mục chi tiết để phân bổ doanh thu.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Overdue details ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-700">Chi tiết đợt thanh toán quá hạn</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">Các đợt đã quá hạn trong kỳ {periodLabel} để ưu tiên xử lý thu nợ.</p>
          </div>
          {analytics.overdue_details.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2.5 py-0.5 text-[10px] font-bold text-error">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              {analytics.overdue_details.length} đợt cần lưu ý
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-slate-200">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Mã HĐ</th>
                <th className="pb-2">Khách hàng</th>
                <th className="pb-2">Đợt TT</th>
                <th className="pb-2">Ngày dự kiến</th>
                <th className="pb-2">Số tiền</th>
                <th className="pb-2">Số ngày quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.overdue_details.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                    Không có đợt thanh toán quá hạn trong kỳ này.
                  </td>
                </tr>
              ) : (
                analytics.overdue_details.map((detail) => (
                  <tr key={detail.schedule_id} className="text-xs text-slate-700">
                    <td className="py-2.5 font-semibold text-slate-900">{detail.contract_code}</td>
                    <td className="py-2.5">{detail.customer_name || '-'}</td>
                    <td className="py-2.5">{detail.milestone_name}</td>
                    <td className="py-2.5">{formatDate(detail.expected_date)}</td>
                    <td className="py-2.5 font-semibold">{formatCurrency(detail.expected_amount)}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${overdueTone(detail.days_overdue)}`}>
                        {detail.days_overdue} ngày
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
