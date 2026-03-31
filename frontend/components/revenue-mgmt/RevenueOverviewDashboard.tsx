import React, { useEffect, useState } from 'react';
import { useRevenueStore } from '../../shared/stores/revenueStore';
import { useToastStore } from '../../shared/stores/toastStore';
import {
  useDeleteRevenueTarget,
  useRevenueOverview,
  useRevenueTargets,
} from '../../shared/hooks/useRevenue';
import { useDashboardRealtime } from '../../shared/hooks/useDashboardRealtime';
import type {
  Department,
  RevenueOverviewPeriod,
  RevenueBySource,
  RevenueAlert,
  RevenueTarget,
} from '../../types';
import { RevenueTargetModal } from './RevenueTargetModal';
import { RevenueBulkTargetModal } from './RevenueBulkTargetModal';
import { RevenueAdjustmentPlanPanel } from './RevenueAdjustmentPlanPanel';
import { buildRevenueAdjustmentPlan } from '../../utils/revenuePlanning';
import {
  formatCompactCurrencyVnd,
  formatCurrencyVnd,
  formatDateRangeDdMmYyyy,
  formatRevenuePeriodLabel,
  formatRevenuePeriodShortLabel,
  formatRevenuePeriodTypeLabel,
  formatRevenueTargetTypeLabel,
  getRevenuePeriodBounds,
} from '../../utils/revenueDisplay';

interface Props {
  canManageTargets: boolean;
  departments: Department[];
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function alertSeverityClass(severity: string): string {
  if (severity === 'CRITICAL') return 'bg-red-50 border-red-300 text-red-800';
  if (severity === 'WARNING') return 'bg-yellow-50 border-yellow-300 text-yellow-800';
  return 'bg-blue-50 border-blue-300 text-blue-800';
}

function alertIcon(severity: string): string {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'info';
}

type TargetAdjustmentMeta = {
  gapAmount: number;
  statusLabel: string;
  statusTone: string;
  suggestion: string;
};

function getTargetAdjustmentMeta(target: RevenueTarget, referenceDate = new Date()): TargetAdjustmentMeta {
  const bounds = getRevenuePeriodBounds(target.period_key);
  const gapAmount = Math.max(target.target_amount - target.actual_amount, 0);

  if (!bounds || gapAmount <= 0) {
    return {
      gapAmount,
      statusLabel: 'Đạt kế hoạch',
      statusTone: 'bg-green-50 text-green-700 border-green-200',
      suggestion: 'Không cần điều chỉnh thêm.',
    };
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(`${bounds.start}T00:00:00`);
  const endDate = new Date(`${bounds.end}T00:00:00`);

  if (today.getTime() > endDate.getTime()) {
    return {
      gapAmount,
      statusLabel: 'Đóng kỳ, còn thiếu',
      statusTone: 'bg-red-50 text-red-700 border-red-200',
      suggestion: `Kỳ đã chốt, còn thiếu ${formatCompactCurrencyVnd(gapAmount)}.`,
    };
  }

  const anchor = today.getTime() >= startDate.getTime() ? today : startDate;
  const daysRemaining = Math.max(
    1,
    Math.floor((endDate.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  if (today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime()) {
    return {
      gapAmount,
      statusLabel: 'Cần điều chỉnh ngay',
      statusTone: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      suggestion: `Cần bù ${formatCompactCurrencyVnd(gapAmount)} (${formatCompactCurrencyVnd(gapAmount / daysRemaining)}/ngày).`,
    };
  }

  return {
    gapAmount,
    statusLabel: 'Cần bám kế hoạch',
    statusTone: 'bg-blue-50 text-blue-700 border-blue-200',
    suggestion: `Chuẩn bị bù ${formatCompactCurrencyVnd(gapAmount)} trong kỳ tới.`,
  };
}

export const RevenueOverviewDashboard = React.memo(function RevenueOverviewDashboardComponent({ canManageTargets, departments }: Props) {
  useDashboardRealtime(['revenue']);

  const {
    periodFrom, periodTo, grouping, selectedDeptId, periodType,
    setPeriod, setGrouping, setDeptId, setYear, setPeriodType,
    setFeeCollectionAvailable, year,
  } = useRevenueStore();

  const addToast = useToastStore((s) => s.addToast);
  const overviewQuery = useRevenueOverview({
    period_from: periodFrom,
    period_to: periodTo,
    grouping,
    dept_id: selectedDeptId ?? undefined,
  });
  const targetsQuery = useRevenueTargets({
    period_type: periodType,
    year,
    dept_id: selectedDeptId ?? undefined,
  });
  const deleteRevenueTargetMutation = useDeleteRevenueTarget();

  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<RevenueTarget | null>(null);
  const [deletingTargetId, setDeletingTargetId] = useState<number | null>(null);

  const data = overviewQuery.data?.data ?? null;
  const targets = targetsQuery.data?.data ?? [];
  const isLoading = overviewQuery.isLoading || overviewQuery.isFetching;
  const isLoadingTargets = targetsQuery.isLoading || targetsQuery.isFetching;

  useEffect(() => {
    if (!overviewQuery.error) {
      return;
    }

    addToast('error', 'Lỗi', 'Không thể tải dữ liệu doanh thu.');
  }, [overviewQuery.error, addToast]);

  useEffect(() => {
    if (!overviewQuery.data) {
      return;
    }

    setFeeCollectionAvailable(overviewQuery.data.meta.fee_collection_available);
  }, [overviewQuery.data, setFeeCollectionAvailable]);

  const handleDeleteTarget = async (id: number) => {
    setDeletingTargetId(id);
    try {
      await deleteRevenueTargetMutation.mutateAsync(id);
      addToast('success', 'Đã xóa', 'Kế hoạch doanh thu đã được xóa.');
    } catch (err) {
      addToast('error', 'Lỗi', (err as Error).message);
    } finally {
      setDeletingTargetId(null);
    }
  };

  const kpis = data?.kpis;
  const overviewAdjustmentPlan = data
    ? buildRevenueAdjustmentPlan(
        data.by_period
          .filter((period) => period.target > 0)
          .map((period) => ({
            periodKey: period.period_key,
            periodLabel: period.period_label,
            targetAmount: period.target,
            comparisonAmount: period.total_actual,
          }))
      )
    : null;
  const targetSectionTitle = `Kế hoạch doanh thu theo ${formatRevenuePeriodTypeLabel(periodType).toLowerCase()} năm ${year}`;

  return (
    <div className="p-4 space-y-4">
      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Năm</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Từ</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={periodFrom}
            onChange={(e) => setPeriod(e.target.value, periodTo)}
          />
          <label className="text-xs font-medium text-gray-600">Đến</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={periodTo}
            onChange={(e) => setPeriod(periodFrom, e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Nhóm</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as 'month' | 'quarter')}
          >
            <option value="month">Tháng</option>
            <option value="quarter">Quý</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Kế hoạch</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
          >
            <option value="MONTHLY">Theo tháng</option>
            <option value="QUARTERLY">Theo quý</option>
            <option value="YEARLY">Theo năm</option>
          </select>
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Đơn vị</label>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={selectedDeptId ?? ''}
              onChange={(e) => setDeptId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Toàn công ty</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.dept_name}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => void overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          {overviewQuery.isFetching ? 'Đang tải...' : 'Làm mới'}
        </button>

        {canManageTargets && (
          <>
            <button
              onClick={() => { setEditingTarget(null); setIsTargetModalOpen(true); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Kế hoạch
            </button>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              <span className="material-symbols-outlined text-[16px]">table</span>
              Kế hoạch hàng loạt
            </button>
          </>
        )}

        <div className="w-full text-xs text-gray-500">
          Giai đoạn đang xem: {formatDateRangeDdMmYyyy(periodFrom, periodTo)}
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────── */}
      {data && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert: RevenueAlert, i: number) => (
            <div key={`alert-${i}`}>
              <RevenueAlertBanner alert={alert} />
            </div>
          ))}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Kế hoạch doanh thu"
          value={kpis ? formatCompactCurrencyVnd(kpis.target_amount) : '—'}
          icon="flag"
          color="gray"
          isLoading={isLoading}
        />
        <KpiCard
          label="Doanh thu thực thu"
          value={kpis ? formatCompactCurrencyVnd(kpis.actual_collected) : '—'}
          icon="payments"
          color="green"
          isLoading={isLoading}
          subLabel={kpis ? `${kpis.achievement_pct.toFixed(1)}% kế hoạch` : undefined}
          subColor={kpis ? pctColor(kpis.achievement_pct) : undefined}
        />
        <KpiCard
          label="Doanh thu chờ thu"
          value={kpis ? formatCompactCurrencyVnd(kpis.outstanding) : '—'}
          icon="pending"
          color="blue"
          isLoading={isLoading}
          subLabel={kpis ? `Tỷ lệ thu: ${kpis.collection_rate.toFixed(1)}%` : undefined}
        />
        <KpiCard
          label="Nợ quá hạn"
          value={kpis ? formatCompactCurrencyVnd(kpis.overdue_amount) : '—'}
          icon="warning"
          color={kpis && kpis.overdue_amount > 0 ? 'red' : 'gray'}
          isLoading={isLoading}
          subLabel={kpis && kpis.growth_pct !== 0
            ? `Tăng trưởng: ${kpis.growth_pct > 0 ? '+' : ''}${kpis.growth_pct.toFixed(1)}%`
            : undefined}
        />
      </div>

      {/* ── By-period bar chart ─────────────────────── */}
      {data && data.by_period.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Doanh thu theo kỳ</h3>
          <RevenueBarChart periods={data.by_period} />
        </div>
      )}

      {/* ── By-source breakdown ─────────────────────── */}
      {data && data.by_source.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Cơ cấu doanh thu</h3>
          <RevenueSourceTable sources={data.by_source} />
        </div>
      )}

      {overviewAdjustmentPlan && (
        <RevenueAdjustmentPlanPanel
          title="Kế hoạch điều chỉnh doanh thu theo kỳ"
          compareLabel="Thực thu"
          summary={overviewAdjustmentPlan.summary}
          items={overviewAdjustmentPlan.items}
          emptyMessage="Các kỳ đang xem đều đang đạt hoặc vượt kế hoạch."
        />
      )}

      {/* ── Targets table ──────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            {targetSectionTitle}
          </h3>
          {isLoadingTargets && (
            <span className="text-xs text-gray-400">Đang tải...</span>
          )}
        </div>
        {targets.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {isLoadingTargets ? 'Đang tải...' : 'Chưa có kế hoạch nào. Nhấn "+ Kế hoạch" để thêm.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 font-medium text-gray-600">Kỳ</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Loại</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Kế hoạch</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Thực tế</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Đạt %</th>
                  <th className="px-4 py-2 font-medium text-gray-600 text-right">Còn thiếu/dư</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Điều chỉnh</th>
                  {canManageTargets && <th className="px-4 py-2 w-16" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {targets.map((t) => {
                  const pct = t.achievement_pct ?? 0;
                  const gap = t.target_amount - t.actual_amount;
                  const adjustment = getTargetAdjustmentMeta(t);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-800">{formatRevenuePeriodLabel(t.period_key)}</div>
                        <div className="text-xs text-gray-500">{formatRevenuePeriodTypeLabel(t.period_type)}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{formatRevenueTargetTypeLabel(t.target_type)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrencyVnd(t.target_amount)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrencyVnd(t.actual_amount)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${pctColor(pct)}`}>
                        {pct.toFixed(1)}%
                        <div className="mt-0.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-blue-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-2 text-right text-sm ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {gap > 0 ? `-${formatCurrencyVnd(gap)}` : `+${formatCurrencyVnd(Math.abs(gap))}`}
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${adjustment.statusTone}`}>
                          {adjustment.statusLabel}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{adjustment.suggestion}</div>
                      </td>
                      {canManageTargets && (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditingTarget(t); setIsTargetModalOpen(true); }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => void handleDeleteTarget(t.id)}
                              disabled={deletingTargetId === t.id}
                              className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {deletingTargetId === t.id ? 'hourglass_empty' : 'delete'}
                              </span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────── */}
      {isTargetModalOpen && (
        <RevenueTargetModal
          target={editingTarget}
          year={year}
          departments={departments}
          defaultPeriodType={periodType}
          defaultDeptId={selectedDeptId}
          onClose={() => { setIsTargetModalOpen(false); setEditingTarget(null); }}
          onSaved={() => { setIsTargetModalOpen(false); setEditingTarget(null); }}
        />
      )}
      {isBulkModalOpen && (
        <RevenueBulkTargetModal
          year={year}
          departments={departments}
          defaultPeriodType={periodType}
          defaultDeptIds={selectedDeptId != null ? [selectedDeptId] : [0]}
          onClose={() => setIsBulkModalOpen(false)}
          onSaved={() => setIsBulkModalOpen(false)}
        />
      )}
    </div>
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, color, isLoading, subLabel, subColor,
}: {
  label: string;
  value: string;
  icon: string;
  color: 'gray' | 'green' | 'blue' | 'red';
  isLoading: boolean;
  subLabel?: string;
  subColor?: string;
}) {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-500',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      {isLoading ? (
        <div className="h-7 bg-gray-100 rounded animate-pulse w-24" />
      ) : (
        <p className="text-xl font-bold text-gray-800">{value}</p>
      )}
      {subLabel && !isLoading && (
        <p className={`text-xs mt-1 ${subColor ?? 'text-gray-500'}`}>{subLabel}</p>
      )}
    </div>
  );
}

function RevenueAlertBanner({ alert }: { alert: RevenueAlert }) {
  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${alertSeverityClass(alert.severity)}`}>
      <span className="material-symbols-outlined text-[18px] flex-none mt-0.5">{alertIcon(alert.severity)}</span>
      <span>{alert.message}</span>
    </div>
  );
}

function RevenueBarChart({ periods }: { periods: RevenueOverviewPeriod[] }) {
  const maxVal = Math.max(...periods.flatMap((p) => [p.target, p.total_expected, p.total_actual]), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-2 min-w-max pb-6 relative" style={{ minHeight: 160 }}>
        {periods.map((p) => {
          const targetPct = (p.target / maxVal) * 100;
          const expectedPct = (p.total_expected / maxVal) * 100;
          const actualPct = (p.total_actual / maxVal) * 100;

          return (
            <div key={p.period_key} className="flex flex-col items-center gap-1" style={{ width: 56 }}>
              <div className="relative flex items-end gap-0.5 w-full" style={{ height: 120 }}>
                {/* Target line */}
                {p.target > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-gray-400"
                    style={{ bottom: `${targetPct}%` }}
                    title={`Kế hoạch: ${formatCurrencyVnd(p.target)}`}
                  />
                )}
                {/* Expected bar */}
                <div
                  className="flex-1 bg-blue-200 rounded-t hover:bg-blue-300 transition-colors cursor-default"
                  style={{ height: `${expectedPct}%` }}
                  title={`Dự kiến: ${formatCurrencyVnd(p.total_expected)}`}
                />
                {/* Actual bar */}
                <div
                  className={`flex-1 rounded-t hover:opacity-80 transition-opacity cursor-default ${p.achievement_pct >= 100 ? 'bg-green-500' : p.achievement_pct >= 80 ? 'bg-blue-500' : p.achievement_pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                  style={{ height: `${actualPct}%` }}
                  title={`Thực thu: ${formatCurrencyVnd(p.total_actual)} (${p.achievement_pct.toFixed(0)}%)`}
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center leading-tight whitespace-nowrap">
                {formatRevenuePeriodShortLabel(p.period_key)}
              </p>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-200" />Dự kiến
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-500" />Thực thu
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t-2 border-dashed border-gray-400" />Kế hoạch
        </span>
      </div>
    </div>
  );
}

function RevenueSourceTable({ sources }: { sources: RevenueBySource[] }) {
  return (
    <div className="space-y-2">
      {sources.map((s) => (
        <div key={s.source} className="flex items-center gap-3">
          <div className="w-28 text-xs text-gray-600 truncate">{s.label}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(s.pct, 100)}%` }}
            />
          </div>
          <div className="w-20 text-right text-xs text-gray-700">{formatCompactCurrencyVnd(s.amount)}</div>
          <div className="w-12 text-right text-xs font-medium text-gray-500">{s.pct.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}
