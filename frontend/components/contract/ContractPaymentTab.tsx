import React from 'react';
import { CircleDollarSign, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
    <div className="p-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 text-primary" />
            Dòng tiền hợp đồng
          </h3>
          <p className="text-sm text-slate-500 mt-1">
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
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-xs font-semibold text-slate-600">Đợt custom</label>
                  <div className="h-10 rounded-lg border border-violet-200 bg-violet-50 px-3 inline-flex items-center text-sm font-semibold text-violet-700">
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
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-deep-teal disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              Sinh kỳ thanh toán
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
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
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
          {showMilestonePreview && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-violet-900">Preview mốc thanh toán đầu tư</h4>
                <p className="text-xs text-violet-700 mt-1">
                  Lịch dưới đây là gợi ý tự động theo tạm ứng, các đợt thanh toán và quyết toán.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700 border border-violet-200">
                {investmentModeLabel}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-violet-100 bg-white/80 p-3 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Cách dựng mốc</p>
                <p className="text-sm text-slate-600 mt-1">
                  Chọn dựng tự động theo công thức hoặc nhập từng đợt nghiệm thu để sinh lịch chính xác hơn.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-violet-200 bg-violet-50 p-1">
                <button
                  type="button"
                  onClick={() => onMilestoneInputModeChange('AUTO')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    milestoneInputMode === 'AUTO'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-violet-600 hover:text-violet-800'
                  }`}
                >
                  Tự động
                </button>
                <button
                  type="button"
                  onClick={() => onMilestoneInputModeChange('CUSTOM')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    milestoneInputMode === 'CUSTOM'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-violet-600 hover:text-violet-800'
                  }`}
                >
                  Nhập từng đợt
                </button>
              </div>
            </div>

            {milestoneInputMode === 'CUSTOM' && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-bold text-violet-900">Editor các đợt thanh toán</h5>
                    <p className="text-xs text-violet-700 mt-1">
                      Nhập nhãn đợt, tỷ lệ % và ngày dự kiến. Tổng tạm ứng + các đợt + giữ lại phải bằng đúng 100%.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onSyncMilestoneInstallmentsFromAuto}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Lấy theo cấu hình tự động
                    </button>
                    <button
                      type="button"
                      onClick={onAddMilestoneInstallment}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm đợt
                    </button>
                  </div>
                </div>

                <div className="overflow-auto rounded-lg border border-violet-100 bg-white">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead className="bg-violet-50 border-b border-violet-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Đợt</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Tên đợt</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">% giá trị HĐ</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-violet-500 font-bold">Số tiền</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Ngày dự kiến</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-violet-500 font-bold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-violet-100">
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
                                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
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
                                    className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
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
                                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => onRemoveMilestoneInstallment(index)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                    Tạm ứng: {formatPercentageString(clampPercentage(advancePercentage, 15))}%
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                    Các đợt: {formatPercentageString(milestoneSummary.installmentTotal)}%
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-slate-700 border border-violet-100">
                    Giữ lại: {formatPercentageString(clampPercentage(retentionPercentage, 5))}%
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold border ${
                    Math.abs(milestoneSummary.overallTotal - 100) < 0.01
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    Tổng: {formatPercentageString(milestoneSummary.overallTotal)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {showMilestonePreview && (
            milestonePreview.error ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {milestonePreview.error}
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border border-violet-100 bg-white">
                <table className="w-full min-w-[620px] border-collapse">
                  <thead className="bg-violet-50 border-b border-violet-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Mốc</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Ngày dự kiến</th>
                      <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-violet-500 font-bold">Số tiền dự kiến</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100">
                    {milestonePreview.rows.map((row, index) => {
                      const toneClasses = row.tone === 'ADVANCE'
                        ? 'bg-fuchsia-100 text-fuchsia-700'
                        : row.tone === 'RETENTION'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sky-100 text-sky-700';

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
