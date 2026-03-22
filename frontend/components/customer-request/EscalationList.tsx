import React, { useState } from 'react';
import type { CustomerRequestEscalation } from '../../types';

type Props = {
  items: CustomerRequestEscalation[];
  onReview: (id: number) => void;
  onView: (id: number) => void;
  isLoading?: boolean;
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border border-rose-200',
  high:     'bg-orange-100 text-orange-700 border border-orange-200',
  medium:   'bg-amber-100 text-amber-700 border border-amber-200',
  low:      'bg-slate-100 text-slate-600 border border-slate-200',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Nghiêm trọng',
  high:     'Cao',
  medium:   'Trung bình',
  low:      'Thấp',
};

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-indigo-100 text-indigo-700',
  reviewing: 'bg-blue-100 text-blue-700',
  resolved:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-slate-100 text-slate-500',
  closed:    'bg-slate-100 text-slate-500',
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'Chờ duyệt',
  reviewing: 'Đang xem xét',
  resolved:  'Đã giải quyết',
  rejected:  'Từ chối',
  closed:    'Đã đóng',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  technical:    'Kỹ thuật',
  resource:     'Nguồn lực',
  customer:     'Khách hàng',
  scope_change: 'Thay đổi phạm vi',
  dependency:   'Phụ thuộc',
  sla_risk:     'Nguy cơ SLA',
};

const FILTER_STATUSES  = ['', 'pending', 'reviewing', 'resolved', 'rejected', 'closed'] as const;
const FILTER_SEVERITIES = ['', 'critical', 'high', 'medium', 'low'] as const;

export function EscalationList({ items, onReview, onView, isLoading = false }: Props) {
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const filtered = items.filter((e) => {
    if (filterStatus   && e.status   !== filterStatus)   return false;
    if (filterSeverity && e.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả trạng thái</option>
          {FILTER_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả mức độ</option>
          {FILTER_SEVERITIES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{SEVERITY_LABEL[s] ?? s}</option>
          ))}
        </select>
        {isLoading && <span className="text-xs text-slate-400">Đang tải...</span>}
      </div>

      {filtered.length === 0 && !isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Không có escalation nào.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Mã</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Mã YC</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Loại</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Mức độ</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Người báo</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Ngày</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Trạng thái</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{e.escalation_code}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{e.request_code ?? e.request_case_id}</td>
                  <td className="px-3 py-2 text-slate-600">{DIFFICULTY_LABEL[e.difficulty_type] ?? e.difficulty_type}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[e.severity] ?? 'bg-slate-100 text-slate-600'}`}>
                      {SEVERITY_LABEL[e.severity] ?? e.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{e.raiser_name ?? e.raised_by_user_id}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                    {e.raised_at ? new Date(e.raised_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[e.status] ?? 'bg-slate-100'}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      {(e.status === 'pending' || e.status === 'reviewing') && (
                        <button
                          type="button"
                          onClick={() => onReview(e.id)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          Duyệt
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onView(e.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
