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
  if (pct >= 100) return 'text-emerald-600';
  if (pct >= 80) return 'text-primary';
  if (pct >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

function alertSeverityClass(severity: string): string {
  if (severity === 'CRITICAL') return 'border-rose-200 bg-rose-50/90 text-rose-700';
  if (severity === 'WARNING') return 'border-amber-200 bg-amber-50/90 text-amber-700';
  return 'border-primary/20 bg-primary-container-soft text-deep-teal';
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
      statusTone: 'border-secondary/30 bg-secondary-fixed text-deep-teal',
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
      statusTone: 'border-rose-200 bg-rose-50 text-rose-700',
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
      statusTone: 'border-amber-200 bg-amber-50 text-amber-700',
      suggestion: `Cần bù ${formatCompactCurrencyVnd(gapAmount)} (${formatCompactCurrencyVnd(gapAmount / daysRemaining)}/ngày).`,
    };
  }

  return {
    gapAmount,
    statusLabel: 'Cần bám kế hoạch',
    statusTone: 'border-primary/20 bg-primary-container-soft text-deep-teal',
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
    <div className="space-y-3 p-3 pb-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary/15">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
                  monitoring
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral">Revenue Overview</p>
                <h2 className="text-sm font-bold leading-tight text-deep-teal">Tổng quan doanh thu</h2>
                <p className="text-[11px] leading-tight text-slate-400">
                  Kết hợp kỳ theo dõi, cấu trúc nguồn thu và nhịp bám kế hoạch trên cùng một màn tác nghiệp.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {formatRevenuePeriodTypeLabel(periodType)}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {grouping === 'month' ? 'Nhóm theo tháng' : 'Nhóm theo quý'}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {year}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-slate-50/70 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[120px_minmax(280px,1.5fr)_180px_180px_minmax(220px,1fr)]">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">Năm</span>
              <select
                className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">Giai đoạn</span>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input
                  type="date"
                  className="h-8 rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  value={periodFrom}
                  onChange={(e) => setPeriod(e.target.value, periodTo)}
                />
                <span className="text-center text-xs font-semibold text-slate-400">đến</span>
                <input
                  type="date"
                  className="h-8 rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  value={periodTo}
                  onChange={(e) => setPeriod(periodFrom, e.target.value)}
                />
              </div>
            </div>

            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">Nhóm kỳ</span>
              <select
                className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as 'month' | 'quarter')}
              >
                <option value="month">Tháng</option>
                <option value="quarter">Quý</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">Kế hoạch</span>
              <select
                className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
              >
                <option value="MONTHLY">Theo tháng</option>
                <option value="QUARTERLY">Theo quý</option>
                <option value="YEARLY">Theo năm</option>
              </select>
            </label>

            {departments.length > 0 ? (
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">Đơn vị</span>
                <select
                  className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  value={selectedDeptId ?? ''}
                  onChange={(e) => setDeptId(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">Toàn công ty</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.dept_name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary-container-soft px-2 py-0.5 text-[10px] font-bold text-deep-teal">
                {formatDateRangeDdMmYyyy(periodFrom, periodTo)}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
                {selectedDeptId == null ? 'Toàn công ty' : 'Đã lọc đơn vị'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void overviewQuery.refetch()}
                disabled={overviewQuery.isFetching}
                className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
                {overviewQuery.isFetching ? 'Đang tải...' : 'Làm mới'}
              </button>

              {canManageTargets ? (
                <button
                  onClick={() => { setEditingTarget(null); setIsTargetModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                  Kế hoạch
                </button>
              ) : null}

              {canManageTargets ? (
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table</span>
                  Kế hoạch hàng loạt
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {data && data.alerts.length > 0 ? (
        <div className="space-y-2">
          {data.alerts.map((alert: RevenueAlert, i: number) => (
            <div key={`alert-${i}`}>
              <RevenueAlertBanner alert={alert} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {data && data.by_period.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-deep-teal">Doanh thu theo kỳ</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">So sánh kế hoạch, dự kiến và thực thu theo từng mốc theo dõi.</p>
          </div>
          <div className="p-4">
            <RevenueBarChart periods={data.by_period} />
          </div>
        </div>
      ) : null}

      {data && data.by_source.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-deep-teal">Cơ cấu doanh thu</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Nhìn nhanh tỷ trọng nguồn thu để điều phối ưu tiên hành động.</p>
          </div>
          <div className="p-4">
            <RevenueSourceTable sources={data.by_source} />
          </div>
        </div>
      ) : null}

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
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-deep-teal">{targetSectionTitle}</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Theo dõi mức đạt kế hoạch, phần còn thiếu và gợi ý điều chỉnh theo từng kỳ.</p>
          </div>
          {isLoadingTargets ? (
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral ring-1 ring-slate-200">
              Đang tải...
            </span>
          ) : null}
        </div>
        {targets.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-2">
              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 34 }}>timeline</span>
              <p className="text-sm font-semibold text-slate-700">
                {isLoadingTargets ? 'Đang tải...' : 'Chưa có kế hoạch nào cho phạm vi đang xem.'}
              </p>
              <p className="text-[11px] leading-5 text-slate-400">
                {canManageTargets
                  ? 'Nhấn "Kế hoạch" hoặc "Kế hoạch hàng loạt" để bắt đầu theo dõi target doanh thu.'
                  : 'Kế hoạch doanh thu sẽ hiển thị tại đây khi dữ liệu được cấu hình.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Kỳ</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Loại</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Kế hoạch</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Thực tế</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Đạt %</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Còn thiếu/dư</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Điều chỉnh</th>
                  {canManageTargets ? <th className="w-20 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-neutral">Thao tác</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {targets.map((t) => {
                  const pct = t.achievement_pct ?? 0;
                  const gap = t.target_amount - t.actual_amount;
                  const adjustment = getTargetAdjustmentMeta(t);
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-900">{formatRevenuePeriodLabel(t.period_key)}</div>
                        <div className="text-xs text-slate-500">{formatRevenuePeriodTypeLabel(t.period_type)}</div>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{formatRevenueTargetTypeLabel(t.target_type)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">{formatCurrencyVnd(t.target_amount)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">{formatCurrencyVnd(t.actual_amount)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${pctColor(pct)}`}>
                        {pct.toFixed(1)}%
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-primary' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-2 text-right text-sm font-semibold ${gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {gap > 0 ? `-${formatCurrencyVnd(gap)}` : `+${formatCurrencyVnd(Math.abs(gap))}`}
                      </td>
                      <td className="px-4 py-2">
                        <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${adjustment.statusTone}`}>
                          {adjustment.statusLabel}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{adjustment.suggestion}</div>
                      </td>
                      {canManageTargets && (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditingTarget(t); setIsTargetModalOpen(true); }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button
                              onClick={() => void handleDeleteTarget(t.id)}
                              disabled={deletingTargetId === t.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
    gray: 'bg-surface-container text-neutral',
    green: 'bg-secondary-fixed text-deep-teal',
    blue: 'bg-primary-container-soft text-primary',
    red: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold leading-tight text-neutral">{label}</p>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      {isLoading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="text-xl font-black leading-tight text-deep-teal">{value}</p>
      )}
      {subLabel && !isLoading && (
        <p className={`mt-1 text-[11px] leading-5 ${subColor ?? 'text-slate-500'}`}>{subLabel}</p>
      )}
    </div>
  );
}

function RevenueAlertBanner({ alert }: { alert: RevenueAlert }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-sm ${alertSeverityClass(alert.severity)}`}>
      <span className="material-symbols-outlined text-[18px] flex-none mt-0.5">{alertIcon(alert.severity)}</span>
      <span>{alert.message}</span>
    </div>
  );
}

function RevenueBarChart({ periods }: { periods: RevenueOverviewPeriod[] }) {
  const maxVal = Math.max(...periods.flatMap((p) => [p.target, p.total_expected, p.total_actual]), 1);

  return (
    <div className="overflow-x-auto">
      <div className="relative flex min-w-max items-end gap-2 rounded-lg bg-slate-50/70 px-3 pb-6 pt-4" style={{ minHeight: 180 }}>
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
                    className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400"
                    style={{ bottom: `${targetPct}%` }}
                    title={`Kế hoạch: ${formatCurrencyVnd(p.target)}`}
                  />
                )}
                {/* Expected bar */}
                <div
                  className="flex-1 cursor-default rounded-t bg-primary/20 transition-colors hover:bg-primary/30"
                  style={{ height: `${expectedPct}%` }}
                  title={`Dự kiến: ${formatCurrencyVnd(p.total_expected)}`}
                />
                {/* Actual bar */}
                <div
                  className={`flex-1 cursor-default rounded-t transition-opacity hover:opacity-80 ${p.achievement_pct >= 100 ? 'bg-emerald-500' : p.achievement_pct >= 80 ? 'bg-primary' : p.achievement_pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ height: `${actualPct}%` }}
                  title={`Thực thu: ${formatCurrencyVnd(p.total_actual)} (${p.achievement_pct.toFixed(0)}%)`}
                />
              </div>
              <p className="whitespace-nowrap text-center text-[10px] leading-tight text-slate-500">
                {formatRevenuePeriodShortLabel(p.period_key)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-primary/20" />Dự kiến
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-primary" />Thực thu
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t-2 border-dashed border-slate-400" />Kế hoạch
        </span>
      </div>
    </div>
  );
}

function RevenueSourceTable({ sources }: { sources: RevenueBySource[] }) {
  return (
    <div className="space-y-3">
      {sources.map((s) => (
        <div key={s.source} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700">{s.label}</p>
              <p className="text-[10px] text-slate-400">{s.source}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-deep-teal">{formatCompactCurrencyVnd(s.amount)}</p>
              <p className="text-[10px] font-semibold text-slate-500">{s.pct.toFixed(1)}%</p>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(s.pct, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
