import React, { useMemo, useState } from 'react';
import { CalendarClock, CircleDollarSign, Loader2, RefreshCw } from 'lucide-react';
import { PaymentSchedule, PaymentScheduleStatus } from '../types';

const DATE_INPUT_MIN = '1900-01-01';
const DATE_INPUT_MAX = '9999-12-31';
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

interface PaymentScheduleTabProps {
  schedules: PaymentSchedule[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
  onConfirmPayment: (
    scheduleId: string | number,
    payload: Pick<PaymentSchedule, 'actual_paid_date' | 'actual_paid_amount' | 'status' | 'notes'>
  ) => Promise<void>;
}

const STATUS_STYLES: Record<PaymentScheduleStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  INVOICED: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-cyan-100 text-cyan-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-700',
};

const STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
  PENDING: 'Chờ thu',
  INVOICED: 'Đã xuất HĐ',
  PARTIAL: 'Thu một phần',
  PAID: 'Đã thu đủ',
  OVERDUE: 'Quá hạn',
  CANCELLED: 'Hủy',
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

const formatDate = (value?: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
};

const parseAmount = (rawValue: string): number => {
  const normalized = rawValue.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isValidIsoDate = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const matched = normalized.match(ISO_DATE_REGEX);
  if (!matched) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || year < 1900 || year > 9999) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const PaymentScheduleTab: React.FC<PaymentScheduleTabProps> = ({
  schedules = [],
  isLoading = false,
  onRefresh,
  onConfirmPayment,
}) => {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [actualDate, setActualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [actualAmount, setActualAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | number | null>(null);
  const [formError, setFormError] = useState<string>('');

  const summary = useMemo(() => {
    return schedules.reduce(
      (acc, item) => {
        acc.expected += Number(item.expected_amount || 0);
        acc.actual += Number(item.actual_paid_amount || 0);
        return acc;
      },
      { expected: 0, actual: 0 }
    );
  }, [schedules]);

  const startConfirm = (item: PaymentSchedule) => {
    setEditingId(item.id);
    setActualDate(item.actual_paid_date || new Date().toISOString().slice(0, 10));
    setActualAmount(String(item.actual_paid_amount || item.expected_amount || 0));
    setNotes(item.notes || '');
    setFormError('');
  };

  const cancelConfirm = () => {
    setEditingId(null);
    setActualDate(new Date().toISOString().slice(0, 10));
    setActualAmount('');
    setNotes('');
    setFormError('');
  };

  const handleConfirm = async (item: PaymentSchedule) => {
    const parsedAmount = parseAmount(actualAmount);
    if (!actualDate || !isValidIsoDate(actualDate)) {
      setFormError('Ngày thực thu phải đúng định dạng dd/mm/yyyy.');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError('Số tiền thực thu phải lớn hơn 0.');
      return;
    }

    const status: PaymentScheduleStatus = parsedAmount >= Number(item.expected_amount || 0) ? 'PAID' : 'PARTIAL';

    setSubmittingId(item.id);
    setFormError('');
    try {
      await onConfirmPayment(item.id, {
        actual_paid_date: actualDate,
        actual_paid_amount: parsedAmount,
        status,
        notes: notes || null,
      });
      cancelConfirm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật kỳ thanh toán.';
      setFormError(message);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dự kiến thu</p>
            <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(summary.expected)}</p>
          </div>
          <CircleDollarSign className="w-5 h-5 text-primary" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Đã thu thực tế</p>
            <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(summary.actual)}</p>
          </div>
          <CircleDollarSign className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Còn phải thu</p>
            <p className="text-lg font-black text-amber-600 mt-1">{formatCurrency(Math.max(0, summary.expected - summary.actual))}</p>
          </div>
          <CalendarClock className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Danh sách kỳ thanh toán</p>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải dòng tiền...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Kỳ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ngày dự kiến</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Số tiền dự kiến</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ngày thực thu</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Số tiền thực thu</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {schedules.length > 0 ? (
                  schedules.map((item) => {
                    const canConfirm = item.status !== 'PAID' && item.status !== 'CANCELLED';
                    const isEditing = String(editingId) === String(item.id);
                    const isSaving = String(submittingId) === String(item.id);

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                            {item.milestone_name} <span className="text-xs text-slate-400">#{item.cycle_number}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(item.expected_date)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{formatCurrency(item.expected_amount)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(item.actual_paid_date)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{formatCurrency(item.actual_paid_amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canConfirm ? (
                              <button
                                type="button"
                                onClick={() => startConfirm(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-deep-teal transition-colors"
                              >
                                <CircleDollarSign className="w-3.5 h-3.5" />
                                Xác nhận thu tiền
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        </tr>

                        {isEditing && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 bg-slate-50">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-slate-600">Ngày thực thu</label>
                                  <input
                                    type="date"
                                    value={actualDate}
                                    onChange={(e) => setActualDate(e.target.value)}
                                    lang="vi-VN"
                                    min={DATE_INPUT_MIN}
                                    max={DATE_INPUT_MAX}
                                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-slate-600">Số tiền thực thu</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={actualAmount}
                                    onChange={(e) => setActualAmount(e.target.value)}
                                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-slate-600">Ghi chú</label>
                                  <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Nội dung thu tiền"
                                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelConfirm}
                                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirm(item)}
                                    disabled={isSaving}
                                    className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal disabled:opacity-60 inline-flex items-center gap-1.5"
                                  >
                                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Lưu thu tiền
                                  </button>
                                </div>
                              </div>
                              {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có kỳ thanh toán nào cho hợp đồng này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
