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
  const toneClasses = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      {helper ? <p className="mt-1 text-xs opacity-80">{helper}</p> : null}
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
  const allProjectsSelected = preview.project_sources.length > 0
    && selectedProjectIds.length === preview.project_sources.length;
  const allContractsSelected = preview.contract_sources.length > 0
    && selectedContractKeys.length === preview.contract_sources.length;
  const selectedGrandTotal = selectedProjectTotal + selectedContractTotal;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/55 backdrop-blur-sm p-4 md:p-8 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-7xl items-start justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/60">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#fff7ed_55%,#ffffff_100%)] px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Kiểm tra dữ liệu gợi ý kế hoạch doanh thu
                  </h2>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Năm {year}
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    {scopeLabel}
                  </span>
                </div>
                <p className="mt-2 max-w-4xl text-sm text-slate-600">
                  Kiểm tra lại nguồn phân kỳ trước khi đổ vào bảng kế hoạch. Bạn có thể bỏ chọn từng dự án
                  hoặc từng dòng tiền hợp đồng nếu chưa muốn đưa vào đợt nhập này.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 md:px-8">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
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

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Phân kỳ doanh thu theo dự án</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Hiển thị dự án nguồn, loại hình, người phụ trách vai trò A và từng kỳ phân bổ.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allProjectsSelected}
                    onChange={(event) => onToggleAllProjects(event.target.checked)}
                  />
                  Chọn tất cả dự án
                </label>
              </div>

              {preview.project_sources.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  Không có dự án phân kỳ nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-white/80">
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-3 font-medium">Chọn</th>
                        <th className="px-4 py-3 font-medium">Mã dự án</th>
                        <th className="px-4 py-3 font-medium">Tên dự án</th>
                        <th className="px-4 py-3 font-medium">Loại hình</th>
                        <th className="px-4 py-3 font-medium">Người phụ trách A</th>
                        <th className="px-4 py-3 font-medium text-center">Số kỳ</th>
                        <th className="px-4 py-3 font-medium text-right">Tổng phân kỳ</th>
                        <th className="px-4 py-3 font-medium">Chi tiết kỳ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {preview.project_sources.map((project) => {
                        const checked = selectedProjectIds.includes(project.project_id);

                        return (
                          <tr key={project.project_id} className="bg-white">
                            <td className="px-4 py-4 align-top">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleProject(project.project_id)}
                              />
                            </td>
                            <td className="px-4 py-4 align-top font-semibold text-slate-800">
                              {project.project_code || `DA${project.project_id}`}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="max-w-[320px]">
                                <p className="font-medium text-slate-800">{project.project_name || '--'}</p>
                                <p className="mt-1 text-xs text-slate-500">Trạng thái: {project.project_status || '--'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                {getInvestmentModeLabel(project.investment_mode)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="max-w-[220px]">
                                <p className="font-medium text-slate-800">
                                  {project.accountable_full_name || 'Chưa gán'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {project.accountable_user_code || 'Vai trò A chưa có người phụ trách'}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-center font-medium text-slate-700">
                              {project.schedule_count}
                            </td>
                            <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                              {formatVietnameseCurrencyValue(project.total_amount)}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <details className="group rounded-2xl border border-slate-200 bg-slate-50">
                                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-sky-700 transition group-open:border-b group-open:border-slate-200 group-open:bg-white">
                                  {`Xem ${project.periods.length} kỳ`}
                                </summary>
                                <div className="max-h-60 overflow-auto bg-white">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-slate-50 text-slate-500">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">Kỳ</th>
                                        <th className="px-3 py-2 text-left font-medium">Ngày dự kiến</th>
                                        <th className="px-3 py-2 text-right font-medium">Số tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {project.periods.map((period, index) => (
                                        <tr key={`${project.project_id}-${period.period_key ?? index}`}>
                                          <td className="px-3 py-2 text-slate-700">
                                            {formatRevenuePeriodLabel(period.period_key)}
                                          </td>
                                          <td className="px-3 py-2 text-slate-500">
                                            {period.expected_date ? formatDateDdMmYyyy(period.expected_date) : '--'}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-800">
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

            <section className="rounded-3xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Dòng tiền hợp đồng cộng thêm</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Phần này giúp bạn kiểm tra các dòng tiền hợp đồng sẽ được cộng vào tổng gợi ý.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
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
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  Kỳ này không có dòng tiền hợp đồng nào được cộng thêm.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-4 py-3 font-medium">Chọn</th>
                        <th className="px-4 py-3 font-medium">Hợp đồng</th>
                        <th className="px-4 py-3 font-medium">Dự án liên kết</th>
                        <th className="px-4 py-3 font-medium">Kỳ kế hoạch</th>
                        <th className="px-4 py-3 font-medium">Ngày dự kiến</th>
                        <th className="px-4 py-3 font-medium text-right">Dư phải thu</th>
                        <th className="px-4 py-3 font-medium text-right">Giá trị gốc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {preview.contract_sources.map((contract) => {
                        const sourceKey = getContractKey(contract);
                        const checked = selectedContractKeys.includes(sourceKey);

                        return (
                          <tr key={sourceKey} className="bg-white">
                            <td className="px-4 py-4 align-top">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleContract(sourceKey)}
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="max-w-[260px]">
                                <p className="font-medium text-slate-800">
                                  {contract.contract_code || `HD${contract.contract_id}`}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{contract.contract_name || '--'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="max-w-[260px]">
                                <p className="font-medium text-slate-800">{contract.project_name || '--'}</p>
                                <p className="mt-1 text-xs text-slate-500">{contract.project_code || 'Không có mã dự án'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-slate-700">
                              {formatRevenuePeriodLabel(contract.period_key)}
                            </td>
                            <td className="px-4 py-4 align-top text-slate-500">
                              {contract.expected_date ? formatDateDdMmYyyy(contract.expected_date) : '--'}
                            </td>
                            <td className="px-4 py-4 text-right align-top font-semibold text-slate-900">
                              {formatVietnameseCurrencyValue(contract.outstanding_amount)}
                            </td>
                            <td className="px-4 py-4 text-right align-top text-slate-500">
                              <div>{formatVietnameseCurrencyValue(contract.expected_amount)}</div>
                              <div className="mt-1 text-xs text-emerald-600">
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

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <p className="text-sm text-slate-500">
              Xác nhận sẽ đổ tổng <span className="font-semibold text-slate-800">{formatVietnameseCurrencyValue(selectedGrandTotal)}</span> vào bảng kế hoạch.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-[18px]">playlist_add_check</span>
                Xác nhận đưa vào kế hoạch
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
