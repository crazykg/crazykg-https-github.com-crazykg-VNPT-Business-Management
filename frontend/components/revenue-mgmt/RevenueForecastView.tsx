import { useEffect, useMemo } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import { useRevenueForecast, useRevenueTargetsByYears } from '../../shared/hooks/useRevenue';
import type { Department, RevenueForecastMonth } from '../../types';
import { RevenueAdjustmentPlanPanel } from './RevenueAdjustmentPlanPanel';
import { buildRevenueAdjustmentPlan } from '../../utils/revenuePlanning';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatRevenuePeriodLabel,
} from '../../utils/revenueDisplay';

interface Props {
  departments: Department[];
}

function pctColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-blue-600';
  if (pct >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

const HORIZON_OPTIONS = [
  { value: 3, label: '3 tháng' },
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
];

export function RevenueForecastView({ departments }: Props) {
  const {
    selectedDeptId,
    setDeptId,
    forecastHorizon,
    setForecastHorizon,
  } = useRevenueStore();
  const addToast = useToastStore((s) => s.addToast);
  const forecastQuery = useRevenueForecast({
    horizon_months: forecastHorizon,
    dept_id: selectedDeptId ?? undefined,
  });

  const data = forecastQuery.data?.data ?? null;
  const forecastYears = useMemo(
    () => Array.from(
      new Set(
        (data?.by_month ?? [])
          .map((month) => Number(month.month_key.slice(0, 4)))
          .filter((year) => Number.isFinite(year))
      )
    ),
    [data],
  );
  const revenueTargetsByYears = useRevenueTargetsByYears({
    years: forecastYears,
    period_type: 'MONTHLY',
    dept_id: selectedDeptId ?? undefined,
  });
  const isLoading = (
    forecastQuery.isLoading ||
    forecastQuery.isFetching ||
    revenueTargetsByYears.isLoading ||
    revenueTargetsByYears.isFetching
  );
  const targetByPeriodKey = useMemo(() => {
    const nextTargetMap: Record<string, number> = {};

    revenueTargetsByYears.data
      .filter((target) => target.target_type === 'TOTAL')
      .forEach((target) => {
        nextTargetMap[target.period_key] = (nextTargetMap[target.period_key] ?? 0) + target.target_amount;
      });

    return nextTargetMap;
  }, [revenueTargetsByYears.data]);

  useEffect(() => {
    if (!forecastQuery.error && !revenueTargetsByYears.error) {
      return;
    }

    addToast('error', 'Lỗi', 'Không thể tải dự báo doanh thu.');
  }, [forecastQuery.error, revenueTargetsByYears.error, addToast]);

  // Bar chart helper: compute max for relative bar widths
  const maxExpected = data?.by_month.reduce((mx, m) => Math.max(mx, m.expected), 0) || 1;
  const totalTarget = data?.by_month.reduce(
    (sum, month) => sum + (targetByPeriodKey[month.month_key] ?? 0),
    0
  ) ?? 0;
  const adjustmentPlan = data
    ? buildRevenueAdjustmentPlan(
        data.by_month
          .map((month) => ({
            periodKey: month.month_key,
            periodLabel: formatRevenuePeriodLabel(month.month_key),
            targetAmount: targetByPeriodKey[month.month_key] ?? 0,
            comparisonAmount: month.expected,
          }))
          .filter((item) => item.targetAmount > 0)
      )
    : null;

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Tầm nhìn:</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForecastHorizon(opt.value as 3 | 6 | 12)}
                className={`px-3 py-1 text-sm ${
                  forecastHorizon === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Không có dữ liệu.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Tổng kỳ vọng ({data.kpis.horizon_months} tháng)</div>
              <div className="text-lg font-semibold">{formatCompactCurrencyVnd(data.kpis.total_expected)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Đã xác nhận</div>
              <div className="text-lg font-semibold text-green-600">{formatCompactCurrencyVnd(data.kpis.total_confirmed)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Chờ thanh toán</div>
              <div className="text-lg font-semibold text-yellow-600">{formatCompactCurrencyVnd(data.kpis.total_pending)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Tỷ lệ xác nhận</div>
              <div className={`text-lg font-semibold ${pctColor(data.kpis.confirmation_rate)}`}>
                {data.kpis.confirmation_rate}%
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Kế hoạch trong horizon</div>
              <div className="text-lg font-semibold">{formatCompactCurrencyVnd(totalTarget)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Gap forecast</div>
              <div className={`text-lg font-semibold ${
                adjustmentPlan && adjustmentPlan.summary.totalGapAmount > 0
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}>
                {formatCompactCurrencyVnd(adjustmentPlan?.summary.totalGapAmount ?? 0)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {adjustmentPlan?.summary.periodsNeedingAdjustment ?? 0} tháng cần bám kế hoạch
              </div>
            </div>
          </div>

          {/* Risk alert */}
          {data.kpis.expiring_contracts > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-yellow-600 text-[20px] mt-0.5">warning</span>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  {data.kpis.expiring_contracts} hợp đồng hết hạn trong {forecastHorizon} tháng tới
                </p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  Tổng giá trị: {formatCurrencyVnd(data.kpis.expiring_value)}
                </p>
              </div>
            </div>
          )}

          {/* Monthly forecast bars */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dự báo theo tháng</h3>
            <div className="space-y-2">
              {data.by_month.map((m: RevenueForecastMonth) => (
                <div key={m.month_key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-16 flex-shrink-0">{m.month_label}</span>
                  <div className="flex-1 flex items-center gap-1 h-6">
                    {/* Confirmed bar */}
                    <div
                      className="h-5 bg-green-400 rounded-l"
                      style={{ width: `${(m.confirmed / maxExpected) * 100}%`, minWidth: m.confirmed > 0 ? '2px' : 0 }}
                      title={`Đã thu: ${formatCurrencyVnd(m.confirmed)}`}
                    />
                    {/* Pending bar */}
                    <div
                      className="h-5 bg-blue-200 rounded-r"
                      style={{ width: `${(m.pending / maxExpected) * 100}%`, minWidth: m.pending > 0 ? '2px' : 0 }}
                      title={`Chờ thu: ${formatCurrencyVnd(m.pending)}`}
                    />
                  </div>
                  <div className="w-40 text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">{formatCompactCurrencyVnd(m.expected)}</div>
                    <div className="text-[11px] text-gray-400">
                      KH: {formatCompactCurrencyVnd(targetByPeriodKey[m.month_key] ?? 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-green-400 rounded" /> Đã thu</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-200 rounded" /> Chờ thu</span>
            </div>
          </div>

          {adjustmentPlan && (
            <RevenueAdjustmentPlanPanel
              title="Kế hoạch điều chỉnh doanh thu theo forecast"
              compareLabel="Forecast"
              summary={adjustmentPlan.summary}
              items={adjustmentPlan.items}
              emptyMessage="Forecast hiện tại đang bám sát kế hoạch ở các tháng có target."
            />
          )}

          {/* By contract status */}
          {data.by_contract_status.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Phân bổ theo trạng thái hợp đồng</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Trạng thái</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Doanh thu kỳ vọng</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Số HĐ</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_contract_status.map((s) => (
                      <tr key={s.contract_status} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium">{s.contract_status}</td>
                        <td className="px-3 py-2 text-right">{formatCurrencyVnd(s.expected)}</td>
                        <td className="px-3 py-2 text-right">{s.contract_count}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{s.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
