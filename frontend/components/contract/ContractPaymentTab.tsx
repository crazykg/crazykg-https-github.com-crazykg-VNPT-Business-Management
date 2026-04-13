import React from 'react';
import type { ContractPaymentAllocationMode } from '../../services/api/contractApi';
import type { PaymentSchedule, PaymentScheduleConfirmationPayload } from '../../types';
import { PaymentScheduleTab } from '../PaymentScheduleTab';

type MilestoneInputMode = 'AUTO' | 'CUSTOM';

interface MilestoneInstallmentDraftLike {
  label: string;
  percentage: string;
  expected_date: string;
}

interface MilestonePreviewRowLike {
  milestoneName: string;
  expectedDate: string;
  expectedAmount: number;
  tone: 'ADVANCE' | 'INSTALLMENT' | 'RETENTION';
}

interface CycleDraftInstallmentDraftLike {
  label: string;
  expected_date: string;
  expected_amount: string;
}

interface ContractPaymentTabProps {
  contractSummary: {
    contractCode: string;
    contractName: string;
    paymentCycleLabel: string;
    investmentModeLabel: string;
    contractValueNumber: number;
  };
  allocation: {
    allocationMode: ContractPaymentAllocationMode;
    allocationModeOptions: Array<{ value: ContractPaymentAllocationMode; label: string }>;
    allocationModeLockMessage: string;
    isAllocationModeSelectionDisabled: boolean;
    onAllocationModeChange: (nextMode: ContractPaymentAllocationMode) => void;
  };
  generation: {
    advancePercentage: string;
    retentionPercentage: string;
    installmentCount: string;
    milestoneInputMode: MilestoneInputMode;
    milestoneInstallments: MilestoneInstallmentDraftLike[];
    generateButtonLockMessage: string;
    isGenerateButtonDisabled: boolean;
    isGenerating: boolean;
    onAdvancePercentageChange: (value: string) => void;
    onRetentionPercentageChange: (value: string) => void;
    onInstallmentCountChange: (value: string) => void;
    onMilestoneInputModeChange: (nextMode: MilestoneInputMode) => void;
    onGenerateSchedules: () => void;
    onSyncMilestoneInstallmentsFromAuto: () => void;
    onAddMilestoneInstallment: () => void;
    onMilestoneInstallmentChange: (
      index: number,
      field: keyof MilestoneInstallmentDraftLike,
      value: string
    ) => void;
    onRemoveMilestoneInstallment: (index: number) => void;
  };
  preview: {
    hasCollectedSchedules: boolean;
    isPreviewDirty: boolean;
    showCyclePreview: boolean;
    cyclePreviewTab: 'PROPOSAL' | 'EDIT';
    cyclePreview: {
      error: string;
      rows: MilestonePreviewRowLike[];
    };
    cycleDraftRows: CycleDraftInstallmentDraftLike[];
    cycleDraftError: string;
    cycleDraftTotal: number;
    cycleDraftStatusLabel: string;
    isCycleDraftDirty: boolean;
    onCyclePreviewTabChange: (nextTab: 'PROPOSAL' | 'EDIT') => void;
    onCycleDraftRowChange: (
      index: number,
      field: keyof CycleDraftInstallmentDraftLike,
      value: string
    ) => void;
    onAddCycleDraftRow: () => void;
    onRemoveCycleDraftRow: (index: number) => void;
    onResetCycleDraftRows: () => void;
    showMilestonePreview: boolean;
    customInstallmentPreviewRows: MilestonePreviewRowLike[];
    milestonePreview: {
      error: string;
      rows: MilestonePreviewRowLike[];
    };
    milestoneSummary: {
      installmentTotal: number;
      overallTotal: number;
    };
  };
  paymentSchedule: {
    schedules: PaymentSchedule[];
    isLoading: boolean;
    onRefresh?: () => Promise<void> | void;
    onConfirmPayment: (
      scheduleId: string | number,
      payload: PaymentScheduleConfirmationPayload
    ) => Promise<void>;
    onDeletePaymentSchedule?: (scheduleId: string | number) => Promise<void>;
  };
  formatters: {
    formatCurrency: (value: number | string) => string;
    formatPreviewMoney: (value: number) => string;
    formatDisplayDate: (value: string) => string;
    formatPercentageString: (value: unknown) => string;
    clampPercentage: (rawValue: unknown, fallback?: number) => number;
  };
}

const compactControlClass =
  'h-8 rounded border border-slate-300 bg-white px-3 text-sm leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-white shadow-sm transition-colors hover:bg-deep-teal disabled:opacity-50';

const draftInputClass =
  'h-8 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium leading-5 text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30';

const sectionTitleClass = 'text-sm font-bold leading-5 text-slate-700';
const fieldLabelClass = 'text-xs font-semibold uppercase tracking-wide leading-4 text-slate-500';
const tableHeaderClass = 'px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500';
const tableHeaderRightClass = 'px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide leading-4 text-slate-500';
const rowPrimaryTextClass = 'text-sm font-medium leading-5 text-on-surface';
const rowMutedTextClass = 'text-sm font-medium leading-5 text-slate-600';
const rowMetaTextClass = 'text-xs font-medium leading-4 text-slate-500';
const inlineSummaryValueClass = 'ml-2 text-sm font-medium leading-5 text-slate-800';
const cardValueClass = 'text-base font-bold leading-6 text-on-surface';

const normalizeDraftMoneyInput = (value: string): string => String(value ?? '').replace(/[^\d]/g, '');

const formatDraftMoneyInput = (value: string): string => {
  const normalized = normalizeDraftMoneyInput(value);
  if (!normalized) return '';
  return Number(normalized).toLocaleString('vi-VN');
};

export const ContractPaymentTab: React.FC<ContractPaymentTabProps> = ({
  contractSummary,
  allocation,
  generation,
  preview,
  paymentSchedule,
  formatters,
}) => {
  const { contractCode, contractName, paymentCycleLabel, investmentModeLabel, contractValueNumber } = contractSummary;
  const {
    allocationMode,
    allocationModeOptions,
    allocationModeLockMessage,
    isAllocationModeSelectionDisabled,
    onAllocationModeChange,
  } = allocation;
  const {
    advancePercentage,
    retentionPercentage,
    installmentCount,
    milestoneInputMode,
    milestoneInstallments,
    generateButtonLockMessage,
    isGenerateButtonDisabled,
    isGenerating,
    onAdvancePercentageChange,
    onRetentionPercentageChange,
    onInstallmentCountChange,
    onMilestoneInputModeChange,
    onGenerateSchedules,
    onSyncMilestoneInstallmentsFromAuto,
    onAddMilestoneInstallment,
    onMilestoneInstallmentChange,
    onRemoveMilestoneInstallment,
  } = generation;
  const {
    hasCollectedSchedules,
    isPreviewDirty,
    showCyclePreview,
    cyclePreviewTab,
    cyclePreview,
    cycleDraftRows,
    cycleDraftError,
    cycleDraftTotal,
    cycleDraftStatusLabel,
    onCyclePreviewTabChange,
    onCycleDraftRowChange,
    onAddCycleDraftRow,
    onRemoveCycleDraftRow,
    onResetCycleDraftRows,
    showMilestonePreview,
    customInstallmentPreviewRows,
    milestonePreview,
    milestoneSummary,
  } = preview;
  const { schedules, isLoading, onRefresh, onConfirmPayment, onDeletePaymentSchedule } = paymentSchedule;
  const {
    formatCurrency,
    formatPreviewMoney,
    formatDisplayDate,
    formatPercentageString,
    clampPercentage,
  } = formatters;
  const cyclePreviewTotal = cyclePreview.rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.expectedAmount) ? row.expectedAmount : 0),
    0
  );
  const cyclePreviewRowCount = cyclePreview.rows.length;
  const cycleDraftRowCount = cycleDraftRows.length;
  const [isLockedCyclePreviewExpanded, setIsLockedCyclePreviewExpanded] = React.useState(false);
  React.useEffect(() => {
    if (hasCollectedSchedules) {
      setIsLockedCyclePreviewExpanded(false);
    }
  }, [hasCollectedSchedules]);
  const lockedCycleReferenceRows = React.useMemo(() => {
    if (!hasCollectedSchedules) {
      return [] as Array<{ milestoneName: string; expectedDate: string; expectedAmount: number }>;
    }

    if (schedules.length > 0) {
      return schedules.map((item, index) => ({
        milestoneName: String(item.milestone_name || '').trim() || `Kỳ ${index + 1}`,
        expectedDate: String(item.expected_date || '').trim(),
        expectedAmount: Number(item.expected_amount || 0),
      }));
    }

    return cyclePreview.rows.map((row) => ({
      milestoneName: row.milestoneName,
      expectedDate: row.expectedDate,
      expectedAmount: row.expectedAmount,
    }));
  }, [cyclePreview.rows, hasCollectedSchedules, schedules]);
  const lockedCycleReferenceCount = lockedCycleReferenceRows.length;
  const lockedCycleReferenceTotal = lockedCycleReferenceRows.reduce(
    (sum, row) => sum + (Number.isFinite(row.expectedAmount) ? row.expectedAmount : 0),
    0
  );
  const cycleSummaryRowCount = hasCollectedSchedules
    ? lockedCycleReferenceCount
    : (cyclePreviewTab === 'EDIT' ? cycleDraftRowCount : cyclePreviewRowCount);
  const cycleSummaryTotal = hasCollectedSchedules
    ? lockedCycleReferenceTotal
    : (cyclePreviewTab === 'EDIT' ? cycleDraftTotal : cyclePreviewTotal);
  const cycleWorkspaceSummaryClass = cycleDraftError
    ? 'border-warning/20 bg-warning/10 text-warning'
    : cyclePreviewTab === 'EDIT'
      ? 'border-secondary/20 bg-secondary/10 text-secondary'
      : 'border-primary/15 bg-primary/10 text-primary';

  return (
    <div className="space-y-2.5 px-4 py-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className={`inline-flex items-center gap-2 ${sectionTitleClass}`}>
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
              payments
            </span>
            Dòng tiền hợp đồng
          </h3>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div
            className="flex flex-col gap-1 min-w-[180px]"
            title={allocationModeLockMessage || undefined}
          >
            <label className="text-xs font-semibold leading-4 text-neutral">Cách phân bổ</label>
            <select
              value={allocationMode}
              onChange={(event) => onAllocationModeChange(event.target.value as ContractPaymentAllocationMode)}
              disabled={isAllocationModeSelectionDisabled}
              className={`min-w-[180px] ${compactControlClass}`}
            >
              {allocationModeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {allocationMode === 'MILESTONE' && (
            <div className="flex flex-col gap-1 w-[120px]">
              <label className="text-xs font-semibold leading-4 text-neutral">Tạm ứng (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={advancePercentage}
                onChange={(event) => onAdvancePercentageChange(event.target.value)}
                className={compactControlClass}
              />
            </div>
          )}

          {allocationMode === 'MILESTONE' && (
            <>
              <div className="flex flex-col gap-1 w-[120px]">
                <label className="text-xs font-semibold leading-4 text-neutral">Giữ lại (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={retentionPercentage}
                  onChange={(event) => onRetentionPercentageChange(event.target.value)}
                  className={compactControlClass}
                />
              </div>
              {milestoneInputMode === 'AUTO' ? (
                <div className="flex flex-col gap-1 w-[120px]">
                  <label className="text-xs font-semibold leading-4 text-neutral">Số đợt</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={installmentCount}
                    onChange={(event) => onInstallmentCountChange(event.target.value)}
                    className={compactControlClass}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-xs font-semibold leading-4 text-neutral">Đợt custom</label>
                  <div className="inline-flex h-8 items-center rounded border border-secondary/20 bg-secondary/10 px-3 text-sm font-semibold leading-5 text-secondary">
                    {Math.max(0, milestoneInstallments.length)} đợt
                  </div>
                </div>
              )}
            </>
          )}

          <div
            className="inline-flex"
            title={generateButtonLockMessage || undefined}
          >
            <button
              type="button"
              onClick={onGenerateSchedules}
              disabled={isGenerateButtonDisabled}
              className={primaryButtonClass}
            >
              {isGenerating && (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>
                  progress_activity
                </span>
              )}
              Sinh kỳ thanh toán
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <div className="space-y-1.5">
          <div className="rounded-lg border border-white/80 bg-white/85 px-3 py-2 shadow-sm">
            <div className="flex flex-col gap-1.5 leading-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-1">
              <div className="min-w-0">
                <span className={fieldLabelClass}>Mã HĐ:</span>
                <span className={`${inlineSummaryValueClass} break-words`}>{contractCode || '--'}</span>
              </div>
              <span className="hidden lg:inline text-slate-200">|</span>
              <div className="min-w-0 flex-1">
                <span className={fieldLabelClass}>Tên HĐ:</span>
                <span className={`${inlineSummaryValueClass} break-words`}>{contractName || '--'}</span>
              </div>
              <span className="hidden lg:inline text-slate-200">|</span>
              <div className="min-w-0 whitespace-nowrap">
                <span className={fieldLabelClass}>Giá trị:</span>
                <span className={inlineSummaryValueClass}>
                  {formatCurrency(contractValueNumber)} đ
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/80 bg-white/85 px-3 py-2 shadow-sm">
            <div className="flex flex-col gap-1.5 leading-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-1">
              <div className="min-w-0">
                <span className={fieldLabelClass}>Chu kỳ:</span>
                <span className={inlineSummaryValueClass}>
                  {allocationMode === 'MILESTONE' ? 'Theo mốc nghiệm thu' : paymentCycleLabel}
                </span>
              </div>
              <span className="hidden lg:inline text-slate-200">|</span>
              <div className="min-w-0 flex-1">
                <span className={fieldLabelClass}>Hình thức:</span>
                <span className={`${inlineSummaryValueClass} break-words`}>{investmentModeLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCyclePreview && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded border border-primary/20 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide leading-4 text-primary shadow-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
                    calendar_month
                  </span>
                  Dự thảo kỳ thanh toán
                </div>
                <div className="rounded-lg border border-white/80 bg-white/85 px-3 py-2 shadow-sm">
                  <div className="flex flex-col gap-1.5 leading-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-1">
                    <div className="min-w-0">
                      <span className={fieldLabelClass}>Chu kỳ:</span>
                      <span className={`${cardValueClass} ml-2`}>{paymentCycleLabel}</span>
                    </div>
                    <span className="hidden lg:inline text-slate-200">|</span>
                    <div className="min-w-0">
                      <span className={fieldLabelClass}>Số kỳ:</span>
                      <span className={`${cardValueClass} ml-2`}>
                        {cycleSummaryRowCount} kỳ
                      </span>
                    </div>
                    <span className="hidden lg:inline text-slate-200">|</span>
                    <div className="min-w-0">
                      <span className={fieldLabelClass}>Tổng tạm tính:</span>
                      <span className={`${cardValueClass} ml-2`}>
                        {formatPreviewMoney(cycleSummaryTotal)} đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:max-w-[320px] xl:justify-end">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-white px-2.5 py-1 text-xs font-semibold leading-4 text-primary">
                  {paymentCycleLabel}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${
                  hasCollectedSchedules
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : cycleDraftStatusLabel === 'Đã chỉnh tay'
                    ? 'border-secondary/20 bg-secondary/10 text-secondary'
                    : isPreviewDirty
                      ? 'border-warning/20 bg-warning/10 text-warning'
                      : 'border-success/20 bg-success/10 text-success'
                }`}>
                  {hasCollectedSchedules ? 'Đã xác nhận thu tiền' : cycleDraftStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 sm:p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/85 p-2.5">
              {hasCollectedSchedules ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold leading-4 text-slate-700">
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        lock
                      </span>
                      {lockedCycleReferenceCount} kỳ tham chiếu
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLockedCyclePreviewExpanded((current) => !current)}
                      className={secondaryButtonClass}
                      aria-expanded={isLockedCyclePreviewExpanded}
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                        {isLockedCyclePreviewExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                      {isLockedCyclePreviewExpanded ? 'Ẩn tham chiếu' : 'Xem tham chiếu'}
                    </button>
                  </div>

                  {isLockedCyclePreviewExpanded && (
                    <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      <table className="w-full min-w-[620px] border-collapse">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className={tableHeaderClass}>Kỳ tham chiếu</th>
                            <th className={tableHeaderClass}>Ngày dự kiến</th>
                            <th className={tableHeaderRightClass}>Số tiền dự kiến</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lockedCycleReferenceRows.map((row, index) => (
                            <tr key={`${row.milestoneName}-${row.expectedDate}-${index}`}>
                              <td className={`px-3 py-2.5 ${rowPrimaryTextClass}`}>
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold leading-4 text-slate-700">
                                  {row.milestoneName}
                                </span>
                              </td>
                              <td className={`px-3 py-2.5 ${rowMutedTextClass}`}>{formatDisplayDate(row.expectedDate)}</td>
                              <td className="px-3 py-2.5 text-right text-sm font-medium leading-5 text-on-surface">{formatPreviewMoney(row.expectedAmount)} đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="inline-flex w-fit rounded border border-slate-200 bg-white p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => onCyclePreviewTabChange('PROPOSAL')}
                        className={`rounded px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] transition-colors ${
                          cyclePreviewTab === 'PROPOSAL'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Đề xuất
                      </button>
                      <button
                        type="button"
                        onClick={() => onCyclePreviewTabChange('EDIT')}
                        className={`rounded px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] transition-colors ${
                          cyclePreviewTab === 'EDIT'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Chỉnh sửa
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
                      <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold leading-4 ${cycleWorkspaceSummaryClass}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                          {cyclePreviewTab === 'EDIT' ? 'edit_note' : 'checklist'}
                        </span>
                        {cyclePreviewTab === 'EDIT'
                          ? `${cycleDraftRowCount} dòng chỉnh sửa`
                          : `${cyclePreviewRowCount} dòng đề xuất`}
                      </div>

                      {cyclePreviewTab === 'EDIT' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={onResetCycleDraftRows}
                            className={secondaryButtonClass}
                          >
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                              refresh
                            </span>
                            Lấy lại từ đề xuất
                          </button>
                          <button
                            type="button"
                            onClick={onAddCycleDraftRow}
                            className={primaryButtonClass}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                              add
                            </span>
                            Thêm dòng
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2.5">
                    {cyclePreviewTab === 'PROPOSAL' ? (
                      cyclePreview.error ? (
                        <div className="rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-xs font-medium leading-4 text-warning">
                          {cyclePreview.error}
                        </div>
                      ) : (
                        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                          <table className="w-full min-w-[620px] border-collapse">
                            <thead className="border-b border-slate-200 bg-slate-50">
                              <tr>
                                <th className={tableHeaderClass}>Kỳ đề xuất</th>
                                <th className={tableHeaderClass}>Ngày dự kiến</th>
                                <th className={tableHeaderRightClass}>Số tiền dự kiến</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cyclePreview.rows.map((row, index) => (
                                <tr key={`${row.milestoneName}-${row.expectedDate}-${index}`}>
                                  <td className={`px-3 py-2.5 ${rowPrimaryTextClass}`}>
                                    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold leading-4 text-primary">
                                      {row.milestoneName}
                                    </span>
                                  </td>
                                  <td className={`px-3 py-2.5 ${rowMutedTextClass}`}>{formatDisplayDate(row.expectedDate)}</td>
                                  <td className="px-3 py-2.5 text-right text-sm font-medium leading-5 text-on-surface">{formatPreviewMoney(row.expectedAmount)} đ</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                          <table className="w-full min-w-[940px] border-collapse">
                            <thead className="border-b border-slate-200 bg-slate-50">
                              <tr>
                                <th className={tableHeaderClass}>Kỳ chỉnh sửa</th>
                                <th className={tableHeaderClass}>Ngày dự kiến</th>
                                <th className={tableHeaderRightClass}>Số tiền dự kiến</th>
                                <th className={tableHeaderRightClass}>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cycleDraftRows.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-3 py-5 text-center text-sm font-medium leading-5 text-slate-500">
                                    Chưa có kỳ dự thảo nào. Hãy thêm dòng hoặc lấy lại từ đề xuất.
                                  </td>
                                </tr>
                              ) : (
                                cycleDraftRows.map((row, index) => (
                                  <tr key={`cycle-draft-${index}`}>
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="text"
                                        value={row.label}
                                        onChange={(event) => onCycleDraftRowChange(index, 'label', event.target.value)}
                                        placeholder={`Phí dịch vụ kỳ ${index + 1}`}
                                        className={draftInputClass}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="date"
                                        value={row.expected_date}
                                        onChange={(event) => onCycleDraftRowChange(index, 'expected_date', event.target.value)}
                                        className={draftInputClass}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={formatDraftMoneyInput(row.expected_amount)}
                                        onChange={(event) =>
                                          onCycleDraftRowChange(
                                            index,
                                            'expected_amount',
                                            normalizeDraftMoneyInput(event.target.value)
                                          )
                                        }
                                        className={`${draftInputClass} text-right`}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => onRemoveCycleDraftRow(index)}
                                        className="inline-flex items-center gap-1.5 rounded border border-error/20 bg-error/10 px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-error hover:bg-error/15"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                          delete
                                        </span>
                                        Xóa
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:flex-row md:items-center md:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={fieldLabelClass}>Tổng dự thảo</span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold leading-4 text-slate-600">
                              {cycleDraftRowCount} dòng
                            </span>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <span className="text-right text-base font-bold leading-6 text-on-surface">
                              {formatPreviewMoney(cycleDraftTotal)} đ
                            </span>
                            <span className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${
                              cycleDraftError
                                ? 'border-warning/20 bg-warning/10 text-warning'
                                : 'border-success/20 bg-success/10 text-success'
                            }`}>
                              {cycleDraftError ? 'Cần kiểm tra lại' : 'Hợp lệ'}
                            </span>
                          </div>
                        </div>

                        {cycleDraftError && (
                          <div className="rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-xs font-medium leading-4 text-warning">
                            {cycleDraftError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {allocationMode === 'MILESTONE' && (
        <div className="space-y-3 rounded-lg border border-secondary/20 bg-secondary/10 p-3">
          {showMilestonePreview && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h4 className={`${sectionTitleClass} text-deep-teal`}>Preview mốc thanh toán đầu tư</h4>
                <p className={rowMetaTextClass}>
                  Lịch dưới đây là gợi ý tự động theo tạm ứng, các đợt thanh toán và quyết toán.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-white px-2 py-0.5 text-xs font-semibold leading-4 text-secondary">
                {investmentModeLabel}
              </span>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide leading-4 text-neutral">Cách dựng mốc</p>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
                  Chọn dựng tự động theo công thức hoặc nhập từng đợt nghiệm thu để sinh lịch chính xác hơn.
                </p>
              </div>
              <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => onMilestoneInputModeChange('AUTO')}
                  className={`rounded px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] transition-colors ${
                    milestoneInputMode === 'AUTO'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  Tự động
                </button>
                <button
                  type="button"
                  onClick={() => onMilestoneInputModeChange('CUSTOM')}
                  className={`rounded px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] transition-colors ${
                    milestoneInputMode === 'CUSTOM'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  Nhập từng đợt
                </button>
              </div>
            </div>

            {milestoneInputMode === 'CUSTOM' && (
              <div className="space-y-3 rounded-lg border border-secondary/20 bg-secondary/10 p-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h5 className={`${sectionTitleClass} text-deep-teal`}>Editor các đợt thanh toán</h5>
                    <p className={rowMetaTextClass}>
                      Nhập nhãn đợt, tỷ lệ % và ngày dự kiến. Tổng tạm ứng + các đợt + giữ lại phải bằng đúng 100%.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onSyncMilestoneInstallmentsFromAuto}
                      className={secondaryButtonClass}
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>
                        refresh
                      </span>
                      Lấy theo cấu hình tự động
                    </button>
                    <button
                      type="button"
                      onClick={onAddMilestoneInstallment}
                      className={primaryButtonClass}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                        add
                      </span>
                      Thêm đợt
                    </button>
                  </div>
                </div>

                <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Đợt</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Tên đợt</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">% giá trị HĐ</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Số tiền</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Ngày dự kiến</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {milestoneInstallments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-sm font-medium leading-5 text-slate-500">
                            Chưa có đợt nào. Dùng nút `Thêm đợt` hoặc `Lấy theo cấu hình tự động` để khởi tạo.
                          </td>
                        </tr>
                      ) : (
                        milestoneInstallments.map((installment, index) => {
                          const rawInstallmentAmount = Math.round(
                            ((contractValueNumber * clampPercentage(installment.percentage, 0)) / 100) * 100
                          ) / 100;
                          const installmentAmount = customInstallmentPreviewRows[index]?.expectedAmount ?? rawInstallmentAmount;

                          return (
                            <tr key={`milestone-installment-${index}`}>
                              <td className="px-3 py-2 text-sm font-medium leading-5 text-slate-700 whitespace-nowrap">#{index + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={installment.label}
                                  onChange={(event) => onMilestoneInstallmentChange(index, 'label', event.target.value)}
                                  placeholder={`Thanh toán đợt ${index + 1}`}
                                  className={`w-full ${compactControlClass}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    value={installment.percentage}
                                    onChange={(event) => onMilestoneInstallmentChange(index, 'percentage', event.target.value)}
                                    className={`w-full ${compactControlClass} pr-8`}
                                  />
                                  <span className="absolute inset-y-0 right-0 inline-flex items-center pr-3 text-xs font-medium leading-4 text-slate-400">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium leading-5 text-slate-600 whitespace-nowrap">
                                {formatPreviewMoney(installmentAmount)} đ
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={installment.expected_date}
                                  onChange={(event) => onMilestoneInstallmentChange(index, 'expected_date', event.target.value)}
                                  className={`w-full ${compactControlClass}`}
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => onRemoveMilestoneInstallment(index)}
                                  className="inline-flex items-center gap-1.5 rounded border border-error/20 bg-error/10 px-2.5 py-1.5 text-[13px] font-semibold leading-[18px] text-error hover:bg-error/15"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                    delete
                                  </span>
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold leading-4 text-slate-600">
                    Tạm ứng: {formatPercentageString(clampPercentage(advancePercentage, 15))}%
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold leading-4 text-slate-600">
                    Các đợt: {formatPercentageString(milestoneSummary.installmentTotal)}%
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold leading-4 text-slate-600">
                    Giữ lại: {formatPercentageString(clampPercentage(retentionPercentage, 5))}%
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-4 ${
                    Math.abs(milestoneSummary.overallTotal - 100) < 0.01
                      ? 'border-success/20 bg-success/10 text-success'
                      : 'border-warning/20 bg-warning/10 text-warning'
                  }`}>
                    Tổng: {formatPercentageString(milestoneSummary.overallTotal)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {showMilestonePreview && (
            milestonePreview.error ? (
              <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-medium leading-4 text-warning">
                {milestonePreview.error}
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[620px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Mốc</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Ngày dự kiến</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide leading-4 text-slate-500">Số tiền dự kiến</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {milestonePreview.rows.map((row, index) => {
                      const toneClasses = row.tone === 'ADVANCE'
                        ? 'bg-secondary/15 text-secondary'
                        : row.tone === 'RETENTION'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-primary/10 text-primary';

                      return (
                        <tr key={`${row.milestoneName}-${index}`}>
                          <td className="px-3 py-2 text-sm font-medium leading-5 text-slate-800">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${toneClasses}`}>
                              {row.milestoneName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm font-medium leading-5 text-slate-600">{formatDisplayDate(row.expectedDate)}</td>
                          <td className="px-3 py-2 text-sm font-medium leading-5 text-on-surface">{formatPreviewMoney(row.expectedAmount)} đ</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      <PaymentScheduleTab
        contractCode={contractCode}
        contractAmount={contractValueNumber}
        schedules={schedules}
        isLoading={isLoading}
        generateSchedulesLockMessage={generateButtonLockMessage}
        isGeneratingSchedules={isGenerating}
        isGenerateSchedulesDisabled={isGenerateButtonDisabled}
        onRefresh={onRefresh}
        onGenerateSchedules={async () => {
          onGenerateSchedules();
        }}
        onConfirmPayment={onConfirmPayment}
        onDeletePaymentSchedule={onDeletePaymentSchedule}
      />
    </div>
  );
};
