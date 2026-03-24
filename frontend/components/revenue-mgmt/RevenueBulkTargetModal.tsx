import { useState } from 'react';
import { bulkCreateRevenueTargets } from '../../services/v5Api';
import { useToastStore } from '../../shared/stores/toastStore';
import type {
  Department,
  RevenuePeriodType,
  RevenueTargetType,
} from '../../types';
import { formatRevenueTargetTypeLabel } from '../../utils/revenueDisplay';

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
                    onChange={() => { setPeriodType(pt); setAmounts({}); }}
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

          {/* Quick fill */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Period table */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-600 w-32">Kỳ</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Số tiền kế hoạch (VND)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodRows.map((row) => (
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
                </tr>
              ))}
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
