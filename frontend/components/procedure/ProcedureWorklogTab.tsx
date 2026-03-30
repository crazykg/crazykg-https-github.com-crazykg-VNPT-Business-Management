import React from 'react';
import type { ProcedureStepWorklog } from '../../types';

const WORKLOG_ICON: Record<string, string> = {
  STATUS_CHANGE: 'sync_alt',
  DOCUMENT_ADDED: 'description',
  NOTE: 'edit_note',
  CUSTOM: 'add_circle',
};

const WORKLOG_COLOR: Record<string, string> = {
  STATUS_CHANGE: 'text-blue-500 bg-blue-50',
  DOCUMENT_ADDED: 'text-emerald-500 bg-emerald-50',
  NOTE: 'text-violet-500 bg-violet-50',
  CUSTOM: 'text-amber-500 bg-amber-50',
};

const ISSUE_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  JUST_ENCOUNTERED: { label: 'Vừa gặp', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  RESOLVED: { label: 'Đã giải quyết', color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
};

const relativeTime = (dateStr: string): string => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const absTime = (dateStr: string): string => new Date(dateStr).toLocaleDateString('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface ProcedureWorklogTabProps {
  worklogs: ProcedureStepWorklog[];
  worklogsLoading: boolean;
  onRefresh: () => void | Promise<void>;
}

export const ProcedureWorklogTab: React.FC<ProcedureWorklogTabProps> = ({
  worklogs,
  worklogsLoading,
  onRefresh,
}) => {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-700">
          Lịch sử hoạt động
          {worklogs.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">({worklogs.length} mục)</span>
          )}
        </h3>
        <button
          onClick={() => void onRefresh()}
          className="p-1.5 text-slate-400 hover:text-deep-teal transition-colors"
          title="Làm mới"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      </div>

      {worklogsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
          <span className="ml-2 text-slate-400 text-sm">Đang tải...</span>
        </div>
      ) : worklogs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <span className="material-symbols-outlined text-4xl text-slate-200 block mb-2">history</span>
          Chưa có hoạt động nào được ghi nhận.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100" />
          <div className="space-y-3">
            {worklogs.map((log) => (
              <div key={log.id} className="flex gap-3 relative">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${WORKLOG_COLOR[log.log_type] || 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-base">{WORKLOG_ICON[log.log_type] || 'info'}</span>
                </span>

                <div className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">{log.content}</span>
                        {log.timesheet && Number(log.timesheet.hours_spent) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold border border-blue-100">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            {Number(log.timesheet.hours_spent).toFixed(2)}h
                          </span>
                        )}
                      </div>
                      {log.step && (
                        <span className="ml-0 mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                          #{log.step.step_number} {log.step.step_name}
                        </span>
                      )}
                    </div>
                    <span
                      title={absTime(log.created_at)}
                      className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap cursor-default"
                    >
                      {relativeTime(log.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">person</span>
                      {log.creator?.full_name || 'Hệ thống'}
                      {log.creator?.user_code && (
                        <span className="ml-1 text-slate-300">({log.creator.user_code})</span>
                      )}
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="text-slate-300">{absTime(log.created_at)}</span>
                  </div>

                  {log.old_value && log.new_value && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 line-through">{log.old_value}</span>
                      <span className="material-symbols-outlined text-[10px] text-slate-300">arrow_forward</span>
                      <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-semibold">{log.new_value}</span>
                    </div>
                  )}

                  {log.issue && (
                    <div className="mt-2 pl-2 border-l-2 border-orange-200 space-y-0.5">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="material-symbols-outlined text-[10px] text-orange-400 mt-0.5">warning</span>
                        <span className="text-slate-600 text-[11px] flex-1">{log.issue.issue_content}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${ISSUE_STATUS_META[log.issue.issue_status]?.color || ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ISSUE_STATUS_META[log.issue.issue_status]?.dot || ''}`} />
                          {ISSUE_STATUS_META[log.issue.issue_status]?.label || log.issue.issue_status}
                        </span>
                      </div>
                      {log.issue.proposal_content && (
                        <p className="text-[10px] text-slate-500 flex items-start gap-1">
                          <span className="material-symbols-outlined text-[10px] text-emerald-400 shrink-0 mt-px">lightbulb</span>
                          {log.issue.proposal_content}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
