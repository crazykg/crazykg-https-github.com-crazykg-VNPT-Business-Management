import { INVESTMENT_MODES } from '../../constants';
import type {
  RevenueSuggestionPreview,
  RevenueSuggestionPreviewContractSource,
} from '../../types';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';
import {
  formatCompactCurrencyVnd,
  formatRevenuePeriodLabel,
} from '../../utils/revenueDisplay';
import { formatVietnameseCurrencyValue } from '../../utils/vietnameseCurrency';

interface Props {
  year: number;
  scopeLabel: string;
  preview: RevenueSuggestionPreview;
  selectedProjectIds: number[];
  selectedContractKeys: string[];
  selectedProjectTotal: number;
  selectedContractTotal: number;
  onToggleProject: (projectId: number) => void;
  onToggleAllProjects: (checked: boolean) => void;
  onToggleContract: (sourceKey: string) => void;
  onToggleAllContracts: (checked: boolean) => void;
  getContractKey: (contract: RevenueSuggestionPreviewContractSource) => string;
  onClose: () => void;
  onConfirm: () => void;
}

const investmentModeLabelMap = new Map(INVESTMENT_MODES.map((option) => [option.value, option.label]));

const getInvestmentModeLabel = (value: string): string =>
  investmentModeLabelMap.get(value as typeof INVESTMENT_MODES[number]['value'])
  ?? (value ? value.replace(/_/g, ' ') : 'Chưa rõ');

const TONE_MAP = {
  slate: { iconBox: 'bg-slate-100', iconColor: 'text-neutral', icon: 'payments' },
  emerald: { iconBox: 'bg-emerald-100', iconColor: 'text-emerald-700', icon: 'bar_chart' },
  amber: { iconBox: 'bg-amber-100', iconColor: 'text-amber-700', icon: 'description' },
  blue: { iconBox: 'bg-secondary/15', iconColor: 'text-secondary', icon: 'folder_open' },
} as const;

const SummaryCard = ({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'emerald' | 'amber' | 'blue';
  helper?: string;
}) => {
  const { iconBox, iconColor, icon } = TONE_MAP[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-neutral">{label}</span>
        <div className={`w-7 h-7 rounded ${iconBox} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: 15 }}>{icon}</span>
        </div>
      </div>
      <p className="text-xl font-black text-deep-teal leading-tight">{value}</p>
      {helper ? <p className="text-[10px] text-slate-400 mt-0.5">{helper}</p> : null}
    </div>
  );
};

export function RevenueSuggestionPreviewModal({
  year,
  scopeLabel,
  preview,
  selectedProjectIds,
  selectedContractKeys,
  selectedProjectTotal,
  selectedContractTotal,
  onToggleProject,
  onToggleAllProjects,
  onToggleContract,
  onToggleAllContracts,
  getContractKey,
  onClose,
  onConfirm,
}: Props) {
  const allProjectsSelected =
    preview.project_sources.length > 0 &&
    selectedProjectIds.length === preview.project_sources.length;
  const allContractsSelected =
    preview.contract_sources.length > 0 &&
    selectedContractKeys.length === preview.contract_sources.length;
  const selectedGrandTotal = selectedProjectTotal + selectedContractTotal;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/55 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-7xl items-start justify-center">
        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl my-4">

          {/* Header */}
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>show_chart</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-sm font-bold text-deep-teal leading-tight">
                      Kiểm tra dữ liệu gợi ý kế hoạch doanh thu
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Năm {year}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                      {scopeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                    Kiểm tra lại nguồn phân kỳ trước khi đổ vào bảng kế hoạch. Bạn có thể bỏ chọn từng dự án
                    hoặc từng dòng tiền hợp đồng nếu chưa muốn đưa vào đợt nhập này.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600 shrink-0"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 px-4 py-4">

            {/* KPI summary cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <SummaryCard
                label="Dự án được chọn"
                value={`${selectedProjectIds.length}/${preview.project_sources.length}`}
                tone="blue"
                helper="Số dự án phân kỳ đang được áp dụng"
              />
              <SummaryCard
                label="Tổng phân kỳ dự án"
                value={formatVietnameseCurrencyValue(selectedProjectTotal)}
                tone="emerald"
                helper="Phần đến từ kế hoạch doanh thu dự án"
              />
              <SummaryCard
                label="Dòng tiền hợp đồng"
                value={formatVietnameseCurrencyValue(selectedContractTotal)}
                tone="amber"
                helper={`${selectedContractKeys.length}/${preview.contract_sources.length} dòng đang được chọn`}
              />
              <SummaryCard
                label="Tổng sẽ đưa vào"
                value={formatVietnameseCurrencyValue(selectedGrandTotal)}
                tone="slate"
                helper="Giá trị sẽ đổ vào modal nhập kế hoạch"
              />
            </div>

            {/* Project sources section */}
            <section className="rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700">Phân kỳ doanh thu theo dự án</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hiển thị dự án nguồn, loại hình, đơn vị và từng kỳ phân bổ.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={allProjectsSelected}
                    onChange={(event) => onToggleAllProjects(event.target.checked)}
                  />
                  Chọn tất cả dự án
                </label>
              </div>

              {preview.project_sources.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Không có dự án phân kỳ nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-white/80">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 text-xs font-semibold">Chọn</th>
                        <th className="px-3 py-2 text-xs font-semibold">Mã dự án</th>
                        <th className="px-3 py-2 text-xs font-semibold">Tên dự án</th>
                        <th className="px-3 py-2 text-xs font-semibold">Loại hình</th>
                        <th className="px-3 py-2 text-xs font-semibold">Đơn vị</th>
                        <th className="px-3 py-2 text-xs font-semibold text-center">Số kỳ</th>
                        <th className="px-3 py-2 text-xs font-semibold text-right">Tổng phân kỳ</th>
                        <th className="px-3 py-2 text-xs font-semibold">Chi tiết kỳ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {preview.project_sources.map((project) => {
                        const checked = selectedProjectIds.includes(project.project_id);
                        return (
                          <tr key={project.project_id} className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 align-top">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleProject(project.project_id)}
                              />
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs font-semibold text-slate-800">
                              {project.project_code || `DA${project.project_id}`}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="max-w-[280px]">
                                <p className="text-xs font-medium text-slate-800">{project.project_name || '--'}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Trạng thái: {project.project_status || '--'}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                                {getInvestmentModeLabel(project.investment_mode)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="max-w-[200px]">
                                <p className="text-xs font-medium text-slate-800">
                                  {project.department_name || (project.dept_id > 0 ? `Đơn vị #${project.dept_id}` : 'Chưa gán đơn vị')}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top text-center text-xs font-medium text-slate-700">
                              {project.schedule_count}
                            </td>
                            <td className="px-3 py-2.5 align-top text-right text-xs font-semibold text-slate-900">
                              {formatVietnameseCurrencyValue(project.total_amount)}
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <details className="group rounded border border-slate-200 bg-slate-50">
                                <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-medium text-primary transition group-open:border-b group-open:border-slate-200 group-open:bg-white">
                                  {`Xem ${project.periods.length} kỳ`}
                                </summary>
                                <div className="max-h-60 overflow-auto bg-white">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-500">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold">Kỳ</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold">Ngày dự kiến</th>
                                        <th className="px-3 py-2 text-right text-[10px] font-semibold">Số tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {project.periods.map((period, index) => (
                                        <tr key={`${project.project_id}-${period.period_key ?? index}`}>
                                          <td className="px-3 py-1.5 text-slate-700">
                                            {formatRevenuePeriodLabel(period.period_key)}
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-400">
                                            {period.expected_date ? formatDateDdMmYyyy(period.expected_date) : '--'}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                                            {formatVietnameseCurrencyValue(period.expected_amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Contract sources section */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700">Dòng tiền hợp đồng cộng thêm</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Phần này giúp bạn kiểm tra các dòng tiền hợp đồng sẽ được cộng vào tổng gợi ý.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={allContractsSelected}
                    onChange={(event) => onToggleAllContracts(event.target.checked)}
                    disabled={preview.contract_sources.length === 0}
                  />
                  Chọn tất cả dòng hợp đồng
                </label>
              </div>

              {preview.contract_sources.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Kỳ này không có dòng tiền hợp đồng nào được cộng thêm.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 text-xs font-semibold">Chọn</th>
                        <th className="px-3 py-2 text-xs font-semibold">Hợp đồng</th>
                        <th className="px-3 py-2 text-xs font-semibold">Dự án liên kết</th>
                        <th className="px-3 py-2 text-xs font-semibold">Kỳ kế hoạch</th>
                        <th className="px-3 py-2 text-xs font-semibold">Ngày dự kiến</th>
                        <th className="px-3 py-2 text-xs font-semibold text-right">Dư phải thu</th>
                        <th className="px-3 py-2 text-xs font-semibold text-right">Giá trị gốc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {preview.contract_sources.map((contract) => {
                        const sourceKey = getContractKey(contract);
                        const checked = selectedContractKeys.includes(sourceKey);

                        return (
                          <tr key={sourceKey} className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 align-top">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleContract(sourceKey)}
                              />
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="max-w-[220px]">
                                <p className="text-xs font-medium text-slate-800">
                                  {contract.contract_code || `HD${contract.contract_id}`}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{contract.contract_name || '--'}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top">
                              <div className="max-w-[220px]">
                                <p className="text-xs font-medium text-slate-800">{contract.project_name || '--'}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{contract.project_code || 'Không có mã dự án'}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-slate-700">
                              {formatRevenuePeriodLabel(contract.period_key)}
                            </td>
                            <td className="px-3 py-2.5 align-top text-xs text-slate-400">
                              {contract.expected_date ? formatDateDdMmYyyy(contract.expected_date) : '--'}
                            </td>
                            <td className="px-3 py-2.5 text-right align-top text-xs font-semibold text-slate-900">
                              {formatVietnameseCurrencyValue(contract.outstanding_amount)}
                            </td>
                            <td className="px-3 py-2.5 text-right align-top text-xs text-slate-400">
                              <div>{formatVietnameseCurrencyValue(contract.expected_amount)}</div>
                              <div className="text-[10px] text-emerald-600 mt-0.5">
                                Thu rồi: {formatCompactCurrencyVnd(contract.actual_paid_amount)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-500">
              Xác nhận sẽ đổ tổng{' '}
              <span className="font-semibold text-slate-800">{formatVietnameseCurrencyValue(selectedGrandTotal)}</span>{' '}
              vào bảng kế hoạch.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>playlist_add_check</span>
                Xác nhận đưa vào kế hoạch
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
