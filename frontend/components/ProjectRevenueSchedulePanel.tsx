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
      <div className="text-sm text-gray-500 py-6 text-center">
        Vui lòng lưu dự án trước khi quản lý phân kỳ doanh thu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + generate button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Phân kỳ doanh thu dự kiến</h4>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={
            !canGenerate
              ? 'Cần có: Chu kỳ thanh toán, ngày bắt đầu, ngày kết thúc, và hạng mục dự án'
              : 'Tạo phân kỳ tự động từ giá trị hạng mục'
          }
        >
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          {isGenerating ? 'Đang tạo...' : 'Tạo phân kỳ tự động'}
        </button>
      </div>

      {!canGenerate && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
          Để tạo phân kỳ tự động, cần cập nhật: Chu kỳ thanh toán, Ngày bắt đầu, Ngày kết thúc dự kiến, và ít nhất 1 hạng mục.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Đang tải...</div>
      ) : schedules.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
          Chưa có phân kỳ doanh thu. Bấm "Tạo phân kỳ tự động" để bắt đầu.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-3 w-12">Kỳ</th>
                  <th className="py-2 px-3">Ngày dự kiến</th>
                  <th className="py-2 px-3 text-right">Số tiền dự kiến</th>
                  <th className="py-2 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{s.cycle_number}</td>
                    <td className="py-2 px-3 text-gray-700">
                      {s.expected_date ? formatDateDdMmYyyy(s.expected_date) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-800">
                      {formatCurrencyVnd(s.expected_amount)}
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{s.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
              <span className="text-gray-500">Tổng phân kỳ:</span>{' '}
              <span className="font-semibold text-gray-800">{formatCurrencyVnd(totalExpected)}</span>
              <span className="text-gray-400 ml-2">({schedules.length} kỳ)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
