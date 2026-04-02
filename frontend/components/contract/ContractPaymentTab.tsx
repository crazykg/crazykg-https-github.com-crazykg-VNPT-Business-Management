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
  'h-8 rounded border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';

const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:opacity-50';

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
  const { showMilestonePreview, customInstallmentPreviewRows, milestonePreview, milestoneSummary } = preview;
  const { schedules, isLoading, onRefresh, onConfirmPayment } = paymentSchedule;
  const {
    formatCurrency,
    formatPreviewMoney,
    formatDisplayDate,
    formatPercentageString,
    clampPercentage,
  } = formatters;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>
              payments
            </span>
            Dòng tiền hợp đồng
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {allocationMode === 'MILESTONE'
              ? 'Theo dõi các mốc thu tiền theo tạm ứng, các đợt nghiệm thu và quyết toán.'
              : `Theo dõi các mốc thu tiền theo chu kỳ ${paymentCycleLabel}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div
            className="flex flex-col gap-1 min-w-[180px]"
            title={allocationModeLockMessage || undefined}
          >
            <label className="text-xs font-semibold text-slate-600">Cách phân bổ</label>
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
              <label className="text-xs font-semibold text-slate-600">Tạm ứng (%)</label>
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
                <label className="text-xs font-semibold text-slate-600">Giữ lại (%)</label>
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
                  <label className="text-xs font-semibold text-slate-600">Số đợt</label>
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
                  <label className="text-xs font-semibold text-slate-600">Đợt custom</label>
                  <div className="inline-flex h-8 items-center rounded border border-secondary/20 bg-secondary/10 px-3 text-xs font-semibold text-secondary">
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

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mã HĐ</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
              {contractCode || '--'}
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tên HĐ</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
              {contractName || '--'}
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Chu kỳ</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
              {allocationMode === 'MILESTONE' ? 'Theo mốc nghiệm thu' : paymentCycleLabel}
            </p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hình thức</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{investmentModeLabel}</p>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giá trị</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
              {formatCurrency(contractValueNumber)} đ
            </p>
          </div>
        </div>
      </div>

      {allocationMode === 'MILESTONE' && (
        <div className="space-y-3 rounded-lg border border-secondary/20 bg-secondary/10 p-3">
          {showMilestonePreview && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-deep-teal">Preview mốc thanh toán đầu tư</h4>
                <p className="mt-1 text-[11px] text-slate-600">
                  Lịch dưới đây là gợi ý tự động theo tạm ứng, các đợt thanh toán và quyết toán.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-white px-2 py-0.5 text-[10px] font-bold text-secondary">
                {investmentModeLabel}
              </span>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral">Cách dựng mốc</p>
                <p className="mt-1 text-sm text-slate-600">
                  Chọn dựng tự động theo công thức hoặc nhập từng đợt nghiệm thu để sinh lịch chính xác hơn.
                </p>
              </div>
              <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => onMilestoneInputModeChange('AUTO')}
                  className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
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
                  className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
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
                    <h5 className="text-xs font-bold text-deep-teal">Editor các đợt thanh toán</h5>
                    <p className="mt-1 text-[11px] text-slate-600">
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
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Đợt</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Tên đợt</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">% giá trị HĐ</th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Số tiền</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Ngày dự kiến</th>
                        <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {milestoneInstallments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-sm text-slate-500 text-center">
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
                              <td className="px-3 py-2 text-sm font-semibold text-slate-700 whitespace-nowrap">#{index + 1}</td>
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
                                  <span className="absolute inset-y-0 right-0 pr-3 inline-flex items-center text-xs font-semibold text-slate-400">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-slate-600 whitespace-nowrap">
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
                                  className="inline-flex items-center gap-1.5 rounded border border-error/20 bg-error/10 px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-error/15"
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
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Tạm ứng: {formatPercentageString(clampPercentage(advancePercentage, 15))}%
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Các đợt: {formatPercentageString(milestoneSummary.installmentTotal)}%
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Giữ lại: {formatPercentageString(clampPercentage(retentionPercentage, 5))}%
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
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
              <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                {milestonePreview.error}
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[620px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Mốc</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Ngày dự kiến</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Số tiền dự kiến</th>
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
                          <td className="px-3 py-2 text-sm text-slate-800">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses}`}>
                              {row.milestoneName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600">{formatDisplayDate(row.expectedDate)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatPreviewMoney(row.expectedAmount)} đ</td>
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
        onRefresh={onRefresh}
        onConfirmPayment={onConfirmPayment}
      />
    </div>
  );
};
