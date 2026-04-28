import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTimeDdMmYyyy } from '../utils/dateDisplay';
import { formatCurrencyVnd } from '../utils/revenueDisplay';
import type { ProjectRevenueSchedule } from '../types';
import {
  fetchProjectRevenueSchedules,
  generateProjectRevenueSchedules,
  syncProjectRevenueSchedules,
} from '../services/v5Api';

interface ProjectRevenueSchedulePanelProps {
  projectId: number | string | null;
  /** Whether the project has required fields (payment_cycle, start_date, expected_end_date, items) */
  canGenerate: boolean;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onSchedulesChange?: (schedules: ProjectRevenueSchedule[]) => void;
}

interface RevenueScheduleDraft {
  id: number;
  project_id: number;
  cycle_number: number;
  expected_date: string;
  expected_amount: number;
  notes: string;
  created_by?: number | null;
  updated_by?: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const REVENUE_SECONDARY_BUTTON_CLASS_NAME =
  'inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60';
const REVENUE_PRIMARY_BUTTON_CLASS_NAME =
  'inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60';
const REVENUE_DANGER_BUTTON_CLASS_NAME =
  'inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60';
const REVENUE_INPUT_CLASS_NAME =
  'h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30';
const REVENUE_RIGHT_INPUT_CLASS_NAME = `${REVENUE_INPUT_CLASS_NAME} text-right font-semibold`;

const roundMoney = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const parseAmountInput = (value: string): number => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return 0;
  }

  return roundMoney(Number(digits));
};

const formatEditableAmount = (value: number): string => {
  const normalized = roundMoney(value);
  return normalized.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const toDraftSchedules = (rows: ProjectRevenueSchedule[]): RevenueScheduleDraft[] =>
  rows.map((row) => ({
    id: Number(row.id),
    project_id: Number(row.project_id),
    cycle_number: Number(row.cycle_number),
    expected_date: String(row.expected_date || '').slice(0, 10),
    expected_amount: roundMoney(Number(row.expected_amount || 0)),
    notes: String(row.notes || ''),
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    created_by_name: row.created_by_name ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));

const serializeDraftSchedules = (rows: RevenueScheduleDraft[]): string =>
  JSON.stringify(
    rows.map((row, index) => ({
      id: row.id,
      cycle_number: index + 1,
      expected_date: row.expected_date,
      expected_amount: roundMoney(row.expected_amount),
      notes: row.notes.trim(),
    }))
  );

const parseIsoDateToTimestamp = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
};

const resolveBalanceIndex = (length: number, changedIndex: number): number | null => {
  if (length <= 1) {
    return null;
  }

  return changedIndex === length - 1 ? length - 2 : length - 1;
};

export const ProjectRevenueSchedulePanel: React.FC<ProjectRevenueSchedulePanelProps> = ({
  projectId,
  canGenerate,
  projectStartDate,
  projectEndDate,
  onNotify,
  onSchedulesChange,
}) => {
  const [schedules, setSchedules] = useState<ProjectRevenueSchedule[]>([]);
  const [draftSchedules, setDraftSchedules] = useState<RevenueScheduleDraft[]>([]);
  const [lockedTotal, setLockedTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const deleteAllInFlightRef = useRef(false);

  const applySchedules = useCallback(
    (nextSchedules: ProjectRevenueSchedule[]) => {
      const normalized = Array.isArray(nextSchedules) ? nextSchedules : [];
      setSchedules(normalized);
      setDraftSchedules(toDraftSchedules(normalized));
      setLockedTotal(
        roundMoney(
          normalized.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0)
        )
      );
      onSchedulesChange?.(normalized);
    },
    [onSchedulesChange]
  );

  const loadSchedules = useCallback(async () => {
    if (!projectId) {
      applySchedules([]);
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetchProjectRevenueSchedules(projectId);
      applySchedules(resp.data ?? []);
    } catch {
      // silent — schedules not available
      applySchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [applySchedules, projectId]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const initialDraftSnapshot = useMemo(
    () => serializeDraftSchedules(toDraftSchedules(schedules)),
    [schedules]
  );
  const draftSnapshot = useMemo(
    () => serializeDraftSchedules(draftSchedules),
    [draftSchedules]
  );
  const isDirty = draftSnapshot !== initialDraftSnapshot;

  const totalExpected = useMemo(
    () => roundMoney(draftSchedules.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0)),
    [draftSchedules]
  );

  const validationMessage = useMemo(() => {
    if (draftSchedules.length === 0) {
      return '';
    }

    const normalizedStartDate = String(projectStartDate || '').trim();
    const normalizedEndDate = String(projectEndDate || '').trim();
    const startTimestamp = parseIsoDateToTimestamp(normalizedStartDate);
    const endTimestamp = parseIsoDateToTimestamp(normalizedEndDate);

    if (startTimestamp === null || endTimestamp === null) {
      return 'Dự án phải có ngày bắt đầu và ngày kết thúc trước khi chỉnh phân kỳ doanh thu.';
    }

    let previousTimestamp: number | null = null;
    for (let index = 0; index < draftSchedules.length; index += 1) {
      const row = draftSchedules[index];
      const currentTimestamp = parseIsoDateToTimestamp(row.expected_date);

      if (currentTimestamp === null) {
        return `Vui lòng nhập ngày dự kiến cho kỳ ${index + 1}.`;
      }
      if (currentTimestamp < startTimestamp || currentTimestamp > endTimestamp) {
        return `Ngày dự kiến kỳ ${index + 1} phải nằm trong khoảng ${normalizedStartDate} đến ${normalizedEndDate}.`;
      }
      if (previousTimestamp !== null && currentTimestamp <= previousTimestamp) {
        return `Ngày dự kiến kỳ ${index + 1} phải sau kỳ ${index}.`;
      }
      previousTimestamp = currentTimestamp;
    }

    if (Math.abs(totalExpected - lockedTotal) > 0.5) {
      return `Tổng phân kỳ phải giữ nguyên ${formatCurrencyVnd(lockedTotal)}.`;
    }

    return '';
  }, [draftSchedules, lockedTotal, projectEndDate, projectStartDate, totalExpected]);

  const handleGenerate = async () => {
    if (!projectId) return;
    setIsGenerating(true);
    try {
      const resp = await generateProjectRevenueSchedules(projectId);
      applySchedules(resp.data ?? []);
      onNotify?.('success', 'Thành công', 'Đã tạo phân kỳ doanh thu tự động.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      onNotify?.('error', 'Lỗi tạo phân kỳ', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!projectId || schedules.length === 0 || deleteAllInFlightRef.current) {
      return;
    }

    deleteAllInFlightRef.current = true;
    setIsDeleting(true);
    try {
      const resp = await syncProjectRevenueSchedules(projectId, []);
      applySchedules(resp.data ?? []);
      onNotify?.(
        'success',
        'Thành công',
        'Đã xóa toàn bộ phân kỳ doanh thu. Bạn có thể cập nhật lại dự án.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      onNotify?.('error', 'Lỗi xóa phân kỳ', msg);
    } finally {
      deleteAllInFlightRef.current = false;
      setIsDeleting(false);
    }
  };

  const handleResetDrafts = () => {
    setDraftSchedules(toDraftSchedules(schedules));
  };

  const handleDateChange = (index: number, value: string) => {
    setDraftSchedules((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              expected_date: value,
            }
          : row
      )
    );
  };

  const handleNotesChange = (index: number, value: string) => {
    setDraftSchedules((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              notes: value,
            }
          : row
      )
    );
  };

  const handleAmountChange = (index: number, rawValue: string) => {
    setDraftSchedules((prev) => {
      const balanceIndex = resolveBalanceIndex(prev.length, index);
      if (balanceIndex === null) {
        return prev;
      }

      const parsedValue = parseAmountInput(rawValue);
      const fixedSum = prev.reduce((sum, row, rowIndex) => {
        if (rowIndex === index || rowIndex === balanceIndex) {
          return sum;
        }

        return sum + Number(row.expected_amount || 0);
      }, 0);
      const maxEditable = Math.max(0, roundMoney(lockedTotal - fixedSum));
      const safeValue = Math.min(parsedValue, maxEditable);
      const balancedValue = roundMoney(maxEditable - safeValue);

      return prev.map((row, rowIndex) => {
        if (rowIndex === index) {
          return {
            ...row,
            expected_amount: safeValue,
          };
        }

        if (rowIndex === balanceIndex) {
          return {
            ...row,
            expected_amount: balancedValue,
          };
        }

        return row;
      });
    });
  };

  const handleDeleteRow = (index: number) => {
    setDraftSchedules((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      const removedRow = prev[index];
      const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
      const balanceIndex = nextRows.length - 1;

      nextRows[balanceIndex] = {
        ...nextRows[balanceIndex],
        expected_amount: roundMoney(
          Number(nextRows[balanceIndex].expected_amount || 0) + Number(removedRow.expected_amount || 0)
        ),
      };

      return nextRows;
    });
  };

  const handleSaveChanges = async () => {
    if (!projectId || validationMessage || draftSchedules.length === 0) {
      if (validationMessage) {
        onNotify?.('error', 'Không thể lưu phân kỳ', validationMessage);
      }
      return;
    }

    setIsSaving(true);
    try {
      const resp = await syncProjectRevenueSchedules(
        projectId,
        draftSchedules.map((row) => ({
          id: row.id,
          expected_date: row.expected_date,
          expected_amount: roundMoney(row.expected_amount),
          notes: row.notes.trim() || null,
        }))
      );
      applySchedules(resp.data ?? []);
      onNotify?.('success', 'Thành công', 'Đã cập nhật phân kỳ doanh thu.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      onNotify?.('error', 'Không thể lưu phân kỳ', msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
        Vui lòng lưu dự án trước khi quản lý phân kỳ doanh thu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Phân kỳ doanh thu dự kiến
          {schedules.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 normal-case tracking-normal">
              {schedules.length} kỳ
            </span>
          )}
        </h3>
        {schedules.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleResetDrafts}
              disabled={!isDirty || isSaving}
              className={REVENUE_SECONDARY_BUTTON_CLASS_NAME}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
              Khôi phục
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!isDirty || Boolean(validationMessage) || isSaving}
              className={REVENUE_PRIMARY_BUTTON_CLASS_NAME}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi phân kỳ'}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className={REVENUE_DANGER_BUTTON_CLASS_NAME}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
              {isDeleting ? 'Đang xóa...' : 'Xóa toàn bộ phân kỳ'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className={REVENUE_PRIMARY_BUTTON_CLASS_NAME}
            title={
              !canGenerate
                ? 'Cần có: Chu kỳ thanh toán, ngày bắt đầu, ngày kết thúc, và hạng mục dự án'
                : 'Tạo phân kỳ tự động từ giá trị hạng mục'
            }
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
            {isGenerating ? 'Đang tạo...' : 'Tạo phân kỳ tự động'}
          </button>
        )}
      </div>

      {schedules.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 13 }}>lock</span>
          <span>
            Dự án đang có <strong>{schedules.length} phân kỳ doanh thu</strong>. Bạn có thể sửa tiền, ngày dự kiến hoặc xóa từng kỳ ngay tại bảng dưới.
            Muốn cập nhật thông tin dự án hoặc hạng mục, vui lòng dùng <strong>Xóa toàn bộ phân kỳ</strong> trước.
          </span>
        </div>
      )}

      {!canGenerate && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 13 }}>info</span>
          <span>
            Để tạo phân kỳ tự động, cần cập nhật: <strong>Chu kỳ thanh toán</strong>, <strong>Ngày bắt đầu</strong>,
            <strong> Ngày kết thúc dự kiến</strong>, và ít nhất 1 hạng mục.
          </span>
        </div>
      )}

      {validationMessage && schedules.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 13 }}>error</span>
          <span>{validationMessage}</span>
        </div>
      )}

      {schedules.length > 1 && (
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
          Hệ thống luôn giữ nguyên tổng phân kỳ <strong>{formatCurrencyVnd(lockedTotal)}</strong>.
          Khi bạn sửa tiền một kỳ hoặc xóa một kỳ, số tiền sẽ tự cân lại ở kỳ còn lại.
        </div>
      )}

      {isLoading ? (
        <div className="rounded border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-400">
          Đang tải...
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-xs text-slate-400">
          Chưa có phân kỳ doanh thu. Bấm <strong className="text-slate-600">Tạo phân kỳ tự động</strong> để bắt đầu.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: 64 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 170 }} />
                  <col />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 104 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Kỳ', 'Ngày dự kiến', 'Số tiền dự kiến', 'Ghi chú', 'Người tạo', 'Ngày tạo', 'Thao tác'].map((label, index) => (
                      <th
                        key={label}
                        className={`sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm${
                          index === 2 ? ' text-right' : ''
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {draftSchedules.map((schedule, index) => {
                    const isSingleRow = draftSchedules.length === 1;

                    return (
                      <tr key={schedule.id} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-xs font-semibold text-slate-500">{index + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            value={schedule.expected_date}
                            onChange={(event) => handleDateChange(index, event.target.value)}
                            className={REVENUE_INPUT_CLASS_NAME}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatEditableAmount(schedule.expected_amount)}
                            onChange={(event) => handleAmountChange(index, event.target.value)}
                            disabled={isSingleRow}
                            className={`${REVENUE_RIGHT_INPUT_CLASS_NAME} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                            title={isSingleRow ? 'Kỳ duy nhất phải giữ nguyên toàn bộ tổng phân kỳ.' : undefined}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={schedule.notes}
                            onChange={(event) => handleNotesChange(index, event.target.value)}
                            placeholder="Ghi chú kỳ này"
                            className={REVENUE_INPUT_CLASS_NAME}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600">
                          {schedule.created_by_name || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600">
                          {formatDateTimeDdMmYyyy(schedule.created_at)}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(index)}
                              disabled={draftSchedules.length <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              title={
                                draftSchedules.length <= 1
                                  ? 'Kỳ cuối cùng chỉ có thể xóa bằng nút Xóa toàn bộ phân kỳ.'
                                  : 'Xóa kỳ này và dồn tiền sang kỳ còn lại'
                              }
                              aria-label={`Xóa kỳ doanh thu ${index + 1}`}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
              <span className="text-slate-400">Tổng phân kỳ:</span>{' '}
              <span className="font-black text-deep-teal">{formatCurrencyVnd(totalExpected)}</span>
              <span className="ml-2 text-slate-400">({draftSchedules.length} kỳ)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
