import { useState } from 'react';
import { createRevenueTarget, updateRevenueTarget } from '../../services/v5Api';
import { useToastStore } from '../../shared/stores/toastStore';
import type { Department, RevenueTarget, RevenuePeriodType } from '../../types';

interface Props {
  target: RevenueTarget | null;
  year: number;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}

const PERIOD_TYPE_OPTIONS: Array<{ value: RevenuePeriodType; label: string }> = [
  { value: 'MONTHLY', label: 'Tháng' },
  { value: 'QUARTERLY', label: 'Quý' },
  { value: 'YEARLY', label: 'Năm' },
];

function buildPeriodOptions(periodType: RevenuePeriodType, year: number): string[] {
  if (periodType === 'MONTHLY') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${year}-${m}`;
    });
  }
  if (periodType === 'QUARTERLY') {
    return [1, 2, 3, 4].map((q) => `${year}-Q${q}`);
  }
  return [String(year)];
}

export function RevenueTargetModal({ target, year, departments, onClose, onSaved }: Props) {
  const addToast = useToastStore((s) => s.addToast);

  const isEdit = Boolean(target);

  const [periodType, setPeriodType] = useState<RevenuePeriodType>(
    target?.period_type ?? 'MONTHLY'
  );
  const [periodKey, setPeriodKey] = useState<string>(
    target?.period_key ?? `${year}-01`
  );
  const [amount, setAmount] = useState<string>(
    target ? String(target.target_amount) : ''
  );
  const [deptId, setDeptId] = useState<number>(target?.dept_id ?? 0);
  const [notes, setNotes] = useState<string>(target?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = buildPeriodOptions(periodType, year);

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount.replace(/[^\d.]/g, ''));
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Vui lòng nhập số tiền kế hoạch hợp lệ.');
      return;
    }
    if (!periodKey) {
      setError('Vui lòng chọn kỳ kế hoạch.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (isEdit && target) {
        await updateRevenueTarget(target.id, {
          target_amount: amountNum,
          notes: notes || null,
        });
        addToast('success', 'Đã cập nhật', 'Kế hoạch doanh thu đã được cập nhật.');
      } else {
        await createRevenueTarget({
          period_type: periodType,
          period_key: periodKey,
          target_amount: amountNum,
          dept_id: deptId,
          notes: notes || null,
        });
        addToast('success', 'Đã tạo', 'Kế hoạch doanh thu đã được tạo.');
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? 'Sửa kế hoạch doanh thu' : 'Thêm kế hoạch doanh thu'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <span className="material-symbols-outlined text-[20px] text-gray-500">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {!isEdit && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loại kỳ</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={periodType}
                  onChange={(e) => {
                    const pt = e.target.value as RevenuePeriodType;
                    setPeriodType(pt);
                    const opts = buildPeriodOptions(pt, year);
                    setPeriodKey(opts[0] ?? '');
                  }}
                >
                  {PERIOD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kỳ kế hoạch</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={periodKey}
                  onChange={(e) => setPeriodKey(e.target.value)}
                >
                  {periodOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {departments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đơn vị</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={deptId}
                    onChange={(e) => setDeptId(Number(e.target.value))}
                  >
                    <option value={0}>Toàn công ty</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.dept_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {isEdit && (
            <div className="text-sm text-gray-600">
              Kỳ: <strong>{target?.period_key}</strong>
              {target?.dept_id === 0 ? ' — Toàn công ty' : ''}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Số tiền kế hoạch (VND)
            </label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ví dụ: 500000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Ghi chú tùy chọn..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
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
            {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo kế hoạch'}
          </button>
        </div>
      </div>
    </div>
  );
}
