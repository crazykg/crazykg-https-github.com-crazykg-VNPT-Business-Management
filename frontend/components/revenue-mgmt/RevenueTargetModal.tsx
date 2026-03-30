import { useEffect, useState } from 'react';
import { fetchRevenueTargetSuggestion } from '../../services/v5Api';
import { useSetRevenueTarget } from '../../shared/hooks/useRevenue';
import { useToastStore } from '../../shared/stores/toastStore';
import type {
  Department,
  RevenueTarget,
  RevenuePeriodType,
  RevenueSuggestion,
  RevenueTargetType,
} from '../../types';
import {
  formatCompactCurrencyVnd,
  formatRevenuePeriodLabel,
  formatRevenueTargetTypeLabel,
  formatRevenuePeriodTypeLabel,
} from '../../utils/revenueDisplay';

interface Props {
  target: RevenueTarget | null;
  year: number;
  departments: Department[];
  defaultPeriodType?: RevenuePeriodType;
  defaultDeptId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const PERIOD_TYPE_OPTIONS: Array<{ value: RevenuePeriodType; label: string }> = [
  { value: 'MONTHLY', label: 'Tháng' },
  { value: 'QUARTERLY', label: 'Quý' },
  { value: 'YEARLY', label: 'Năm' },
];

const TARGET_TYPE_OPTIONS: RevenueTargetType[] = ['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'];

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

export function RevenueTargetModal({
  target,
  year,
  departments,
  defaultPeriodType = 'MONTHLY',
  defaultDeptId = 0,
  onClose,
  onSaved,
}: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const setRevenueTargetMutation = useSetRevenueTarget();

  const isEdit = Boolean(target);

  const [periodType, setPeriodType] = useState<RevenuePeriodType>(
    target?.period_type ?? defaultPeriodType
  );
  const [periodKey, setPeriodKey] = useState<string>(
    target?.period_key ?? buildPeriodOptions(target?.period_type ?? defaultPeriodType, year)[0] ?? `${year}-01`
  );
  const [amount, setAmount] = useState<string>(
    target ? String(target.target_amount) : ''
  );
  const [deptId, setDeptId] = useState<number>(target?.dept_id ?? defaultDeptId ?? 0);
  const [targetType, setTargetType] = useState<RevenueTargetType>(target?.target_type ?? 'TOTAL');
  const [notes, setNotes] = useState<string>(target?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Suggestion state ──
  const [suggestion, setSuggestion] = useState<RevenueSuggestion | null>(null);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const periodOptions = buildPeriodOptions(periodType, year);

  // Auto-fetch suggestion when period key + dept changes (only for new targets)
  useEffect(() => {
    if (isEdit || !periodKey) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;
    const fetchSuggestion = async () => {
      setIsSuggestLoading(true);
      try {
        const res = await fetchRevenueTargetSuggestion({
          year,
          period_type: periodType,
          dept_id: deptId,
        });
        if (cancelled) return;
        const match = res.data.find((s) => s.period_key === periodKey) ?? null;
        setSuggestion(match);
      } catch {
        if (!cancelled) setSuggestion(null);
      } finally {
        if (!cancelled) setIsSuggestLoading(false);
      }
    };

    void fetchSuggestion();
    return () => { cancelled = true; };
  }, [isEdit, year, periodType, periodKey, deptId]);

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
        await setRevenueTargetMutation.mutateAsync({
          id: target.id,
          data: {
            target_amount: amountNum,
            notes: notes || null,
          },
        });
        addToast('success', 'Đã cập nhật', 'Kế hoạch doanh thu đã được cập nhật.');
      } else {
        await setRevenueTargetMutation.mutateAsync({
          data: {
            period_type: periodType,
            period_key: periodKey,
            target_amount: amountNum,
            dept_id: deptId,
            target_type: targetType,
            notes: notes || null,
          },
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
                    <option key={o} value={o}>{formatRevenuePeriodLabel(o)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nhóm kế hoạch</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as RevenueTargetType)}
                >
                  {TARGET_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{formatRevenueTargetTypeLabel(option)}</option>
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

              {/* ── Suggestion panel ── */}
              {isSuggestLoading ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Đang tải gợi ý...
                </div>
              ) : suggestion && suggestion.suggested_total > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    Đề xuất từ dữ liệu
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-sm">
                    <span className="text-gray-600">Hợp đồng ({suggestion.contract_count}):</span>
                    <span className="text-right font-medium text-gray-800">
                      {formatCompactCurrencyVnd(suggestion.contract_amount)}
                    </span>
                    <span className="text-gray-600">Cơ hội ({suggestion.opportunity_count}):</span>
                    <span className="text-right font-medium text-gray-800">
                      {formatCompactCurrencyVnd(suggestion.opportunity_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-amber-200">
                    <span className="text-sm font-semibold text-amber-900">
                      Tổng gợi ý: {formatCompactCurrencyVnd(suggestion.suggested_total)}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-full transition-colors"
                      onClick={() => setAmount(String(suggestion.suggested_total))}
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {isEdit && (
            <div className="text-sm text-gray-600">
              Kỳ: <strong>{formatRevenuePeriodLabel(target?.period_key)}</strong>
              {' · '}
              <strong>{formatRevenuePeriodTypeLabel(target?.period_type ?? periodType)}</strong>
              {' · '}
              <strong>{formatRevenueTargetTypeLabel(target?.target_type ?? targetType)}</strong>
              {target?.dept_id === 0 ? ' · Toàn công ty' : ''}
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
