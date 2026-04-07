import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrencyVnd } from '../utils/revenueDisplay';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import type { ProjectRevenueSchedule } from '../types';
import {
  fetchProjectRevenueSchedules,
  generateProjectRevenueSchedules,
} from '../services/v5Api';

interface ProjectRevenueSchedulePanelProps {
  projectId: number | string | null;
  /** Whether the project has required fields (payment_cycle, start_date, expected_end_date, items) */
  canGenerate: boolean;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ProjectRevenueSchedulePanel: React.FC<ProjectRevenueSchedulePanelProps> = ({
  projectId,
  canGenerate,
  onNotify,
}) => {
  const [schedules, setSchedules] = useState<ProjectRevenueSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const resp = await fetchProjectRevenueSchedules(projectId);
      setSchedules(resp.data ?? []);
    } catch {
      // silent — schedules not available
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleGenerate = async () => {
    if (!projectId) return;
    setIsGenerating(true);
    try {
      const resp = await generateProjectRevenueSchedules(projectId);
      setSchedules(resp.data ?? []);
      onNotify?.('success', 'Thành công', 'Đã tạo phân kỳ doanh thu tự động.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      onNotify?.('error', 'Lỗi tạo phân kỳ', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalExpected = schedules.reduce((sum, s) => sum + (s.expected_amount ?? 0), 0);

  if (!projectId) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
        Vui lòng lưu dự án trước khi quản lý phân kỳ doanh thu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Phân kỳ doanh thu dự kiến
          {schedules.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 normal-case tracking-normal">
              {schedules.length} kỳ
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded bg-primary text-white hover:bg-deep-teal shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !canGenerate
              ? 'Cần có: Chu kỳ thanh toán, ngày bắt đầu, ngày kết thúc, và hạng mục dự án'
              : 'Tạo phân kỳ tự động từ giá trị hạng mục'
          }
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
          {isGenerating ? 'Đang tạo...' : 'Tạo phân kỳ tự động'}
        </button>
      </div>

      {/* ── Warning ── */}
      {!canGenerate && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 13 }}>info</span>
          <span>Để tạo phân kỳ tự động, cần cập nhật: <strong>Chu kỳ thanh toán</strong>, <strong>Ngày bắt đầu</strong>, <strong>Ngày kết thúc dự kiến</strong>, và ít nhất 1 hạng mục.</span>
        </div>
      )}

      {/* ── Content ── */}
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
              <table className="min-w-[480px] w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: 52 }} />
                  <col style={{ width: 140 }} />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Kỳ', 'Ngày dự kiến', 'Số tiền dự kiến', 'Ghi chú'].map((label, i) => (
                      <th
                        key={label}
                        className={`sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm${i >= 2 ? ' text-right' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 text-xs font-semibold text-slate-500">{s.cycle_number}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-700">
                        {s.expected_date ? formatDateDdMmYyyy(s.expected_date) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs font-semibold text-slate-900">
                        {formatCurrencyVnd(s.expected_amount)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-400">{s.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="flex justify-end">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
              <span className="text-slate-400">Tổng phân kỳ:</span>{' '}
              <span className="font-black text-deep-teal">{formatCurrencyVnd(totalExpected)}</span>
              <span className="ml-2 text-slate-400">({schedules.length} kỳ)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
