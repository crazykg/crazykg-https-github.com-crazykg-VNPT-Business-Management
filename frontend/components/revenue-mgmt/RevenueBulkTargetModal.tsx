import { useState } from 'react';
import { bulkCreateRevenueTargets, fetchRevenueTargetSuggestion } from '../../services/v5Api';
import { useToastStore } from '../../shared/stores/toastStore';
import type {
  Department,
  RevenuePeriodType,
  RevenueSuggestion,
  RevenueTargetType,
} from '../../types';
import { formatCompactCurrencyVnd, formatRevenueTargetTypeLabel } from '../../utils/revenueDisplay';

interface Props {
  year: number;
  departments: Department[];
  defaultPeriodType?: RevenuePeriodType;
  defaultDeptIds?: number[];
  defaultTargetType?: RevenueTargetType;
  onClose: () => void;
  onSaved: () => void;
}

type PeriodRow = { period_key: string; label: string };

function buildPeriodRows(periodType: RevenuePeriodType, year: number): PeriodRow[] {
  if (periodType === 'MONTHLY') {
    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
      'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
      'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
    ];
    return monthNames.map((label, i) => ({
      period_key: `${year}-${String(i + 1).padStart(2, '0')}`,
      label,
    }));
  }
  if (periodType === 'QUARTERLY') {
    return [1, 2, 3, 4].map((q) => ({
      period_key: `${year}-Q${q}`,
      label: `Quý ${q}`,
    }));
  }
  return [{ period_key: String(year), label: `Năm ${year}` }];
}

export function RevenueBulkTargetModal({
  year,
  departments,
  defaultPeriodType = 'MONTHLY',
  defaultDeptIds = [0],
  defaultTargetType = 'TOTAL',
  onClose,
  onSaved,
}: Props) {
  const addToast = useToastStore((s) => s.addToast);

  const [periodType, setPeriodType] = useState<RevenuePeriodType>(defaultPeriodType);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(defaultDeptIds);
  const [targetType, setTargetType] = useState<RevenueTargetType>(defaultTargetType);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Suggestion state ──
  const [suggestions, setSuggestions] = useState<RevenueSuggestion[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const periodRows = buildPeriodRows(periodType, year);

  const toggleDept = (id: number) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleAmountChange = (key: string, val: string) => {
    setAmounts((prev) => ({ ...prev, [key]: val }));
  };

  const fillAll = (val: string) => {
    const filled: Record<string, string> = {};
    periodRows.forEach((r) => {
      filled[r.period_key] = val;
    });
    setAmounts(filled);
  };

  // ── Fetch suggestions and populate amounts ──
  const handleSuggestAll = async () => {
    const deptId = selectedDeptIds.length === 1 ? selectedDeptIds[0] : 0;
    setIsSuggestLoading(true);
    try {
      const res = await fetchRevenueTargetSuggestion({
        year,
        period_type: periodType,
        dept_id: deptId,
      });
      setSuggestions(res.data);
      // Populate amounts from suggestions
      const filled: Record<string, string> = {};
      for (const s of res.data) {
        if (s.suggested_total > 0) {
          filled[s.period_key] = String(s.suggested_total);
        }
      }
      setAmounts((prev) => ({ ...prev, ...filled }));
      if (res.data.length === 0 || res.meta.total_suggested === 0) {
        addToast('info', 'Không có gợi ý', 'Không tìm thấy dữ liệu phân kỳ để gợi ý.');
      } else {
        addToast('success', 'Đã gợi ý', `Tổng gợi ý: ${formatCompactCurrencyVnd(res.meta.total_suggested)}`);
      }
    } catch (err) {
      addToast('error', 'Lỗi', (err as Error).message);
    } finally {
      setIsSuggestLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedDeptIds.length === 0) {
      setError('Vui lòng chọn ít nhất một đơn vị.');
      return;
    }

    const targets = periodRows
      .filter((r) => amounts[r.period_key] && amounts[r.period_key].trim() !== '')
      .map((r) => ({
        period_key: r.period_key,
        amount: parseFloat(amounts[r.period_key].replace(/[^\d.]/g, '')),
      }))
      .filter((t) => !isNaN(t.amount) && t.amount >= 0);

    if (targets.length === 0) {
      setError('Vui lòng nhập ít nhất một số tiền kế hoạch.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await bulkCreateRevenueTargets({
        year,
        period_type: periodType,
        target_type: targetType,
        dept_ids: selectedDeptIds,
        targets,
      });
      addToast(
        'success',
        'Đã lưu kế hoạch',
        `Tạo mới: ${res.data.created} · Cập nhật: ${res.data.updated}`
      );
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Look up suggestion for a given period_key
  const getSuggestionForPeriod = (key: string): RevenueSuggestion | undefined =>
    suggestions.find((s) => s.period_key === key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-none">
          <h2 className="text-base font-semibold text-gray-800">
            Nhập kế hoạch doanh thu hàng loạt — Năm {year}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <span className="material-symbols-outlined text-[20px] text-gray-500">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Loại kỳ */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-600 w-20">Loại kỳ</label>
            <div className="flex gap-2">
              {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as RevenuePeriodType[]).map((pt) => (
                <label key={pt} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="period_type"
                    value={pt}
                    checked={periodType === pt}
                    onChange={() => { setPeriodType(pt); setAmounts({}); setSuggestions([]); }}
                  />
                  {pt === 'MONTHLY' ? 'Tháng' : pt === 'QUARTERLY' ? 'Quý' : 'Năm'}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-600 w-20">Chỉ tiêu</label>
            <select
              aria-label="Nhóm kế hoạch"
              className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[220px]"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as RevenueTargetType)}
            >
              {(['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'] as RevenueTargetType[]).map((option) => (
                <option key={option} value={option}>{formatRevenueTargetTypeLabel(option)}</option>
              ))}
            </select>
          </div>

          {/* Đơn vị */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Áp dụng cho đơn vị</label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-sm cursor-pointer px-2 py-1 border rounded-full">
                <input
                  type="checkbox"
                  checked={selectedDeptIds.includes(0)}
                  onChange={() => toggleDept(0)}
                />
                Toàn công ty
              </label>
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-1 text-sm cursor-pointer px-2 py-1 border rounded-full">
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.includes(d.id as number)}
                    onChange={() => toggleDept(d.id as number)}
                  />
                  {d.dept_name}
                </label>
              ))}
            </div>
          </div>

          {/* Quick fill + Suggest */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500">Điền đều tất cả kỳ:</label>
            <input
              type="number"
              min={0}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
              placeholder="Số tiền..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fillAll((e.currentTarget as HTMLInputElement).value);
                }
              }}
            />
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => {
                const input = (e.currentTarget as HTMLButtonElement)
                  .previousElementSibling as HTMLInputElement;
                if (input) fillAll(input.value);
              }}
            >
              Áp dụng
            </button>
            <span className="text-gray-300 mx-1">|</span>
            <button
              type="button"
              disabled={isSuggestLoading}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
              onClick={() => void handleSuggestAll()}
            >
              <span className="material-symbols-outlined text-sm">lightbulb</span>
              {isSuggestLoading ? 'Đang tải...' : 'Đề xuất từ dữ liệu'}
            </button>
          </div>

          {/* Period table */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-600 w-32">Kỳ</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Số tiền kế hoạch (VND)
                </th>
                {suggestions.length > 0 && (
                  <th className="px-4 py-2 text-right font-medium text-gray-600 w-36">
                    Gợi ý
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodRows.map((row) => {
                const hint = getSuggestionForPeriod(row.period_key);
                return (
                  <tr key={row.period_key} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{row.label}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                        placeholder="0"
                        value={amounts[row.period_key] ?? ''}
                        onChange={(e) => handleAmountChange(row.period_key, e.target.value)}
                      />
                    </td>
                    {suggestions.length > 0 && (
                      <td className="px-4 py-2 text-right">
                        {hint && hint.suggested_total > 0 ? (
                          <button
                            type="button"
                            className="text-xs text-amber-700 hover:text-amber-900 hover:underline"
                            title={`HĐ: ${formatCompactCurrencyVnd(hint.contract_amount)} + CH: ${formatCompactCurrencyVnd(hint.opportunity_amount)}`}
                            onClick={() => handleAmountChange(row.period_key, String(hint.suggested_total))}
                          >
                            {formatCompactCurrencyVnd(hint.suggested_total)}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">--</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 flex-none">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu kế hoạch'}
          </button>
        </div>
      </div>
    </div>
  );
}
