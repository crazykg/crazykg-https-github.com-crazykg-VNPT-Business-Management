import React from 'react';
import type { ProcedureStepWorklog } from '../../types';

const WORKLOG_ICON: Record<string, string> = {
  STATUS_CHANGE: 'sync_alt',
  DOCUMENT_ADDED: 'description',
  NOTE: 'edit_note',
  CUSTOM: 'add_circle',
};

const WORKLOG_COLOR: Record<string, string> = {
  STATUS_CHANGE: 'text-primary bg-primary/10',
  DOCUMENT_ADDED: 'text-success bg-success/10',
  NOTE: 'text-secondary bg-secondary/10',
  CUSTOM: 'text-tertiary bg-tertiary/10',
};

const ISSUE_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  JUST_ENCOUNTERED: { label: 'Vừa gặp', color: 'text-error bg-error/8 border-error/20', dot: 'bg-error' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'text-tertiary bg-tertiary/8 border-tertiary/20', dot: 'bg-tertiary' },
  RESOLVED: { label: 'Đã giải quyết', color: 'text-success bg-success/10 border-success/20', dot: 'bg-success' },
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          Lịch sử hoạt động
          {worklogs.length > 0 && (
            <span className="text-[10px] font-normal text-slate-400">({worklogs.length} mục)</span>
          )}
        </h3>
        <button
          onClick={() => void onRefresh()}
          className="p-1.5 text-slate-400 hover:text-deep-teal hover:bg-slate-100 rounded transition-colors"
          title="Làm mới"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
        </button>
      </div>

      {worklogsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
          <span className="ml-2 text-slate-400 text-xs">Đang tải...</span>
        </div>
      ) : worklogs.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          <span className="material-symbols-outlined text-slate-200 block mb-2" style={{ fontSize: 36 }}>history</span>
          Chưa có hoạt động nào được ghi nhận.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />
          <div className="space-y-2.5">
            {worklogs.map((log) => (
              <div key={log.id} className="flex gap-2.5 relative">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${WORKLOG_COLOR[log.log_type] || 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{WORKLOG_ICON[log.log_type] || 'info'}</span>
                </span>

                <div className="flex-1 rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">{log.content}</span>
                        {log.timesheet && Number(log.timesheet.hours_spent) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/8 text-primary text-[10px] font-semibold border border-primary/15">
                            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>schedule</span>
                            {Number(log.timesheet.hours_spent).toFixed(2)}h
                          </span>
                        )}
                      </div>
                      {log.step && (
                        <span className="ml-0 mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
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
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>person</span>
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
                      <span className="px-1.5 py-0.5 rounded bg-error/8 text-error line-through">{log.old_value}</span>
                      <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 10 }}>arrow_forward</span>
                      <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-semibold">{log.new_value}</span>
                    </div>
                  )}

                  {log.issue && (
                    <div className="mt-2 pl-2 border-l-2 border-tertiary/30 space-y-0.5">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="material-symbols-outlined text-tertiary mt-0.5" style={{ fontSize: 10 }}>warning</span>
                        <span className="text-slate-600 text-[11px] flex-1">{log.issue.issue_content}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${ISSUE_STATUS_META[log.issue.issue_status]?.color || ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ISSUE_STATUS_META[log.issue.issue_status]?.dot || ''}`} />
                          {ISSUE_STATUS_META[log.issue.issue_status]?.label || log.issue.issue_status}
                        </span>
                      </div>
                      {log.issue.proposal_content && (
                        <p className="text-[10px] text-slate-500 flex items-start gap-1">
                          <span className="material-symbols-outlined text-success shrink-0 mt-px" style={{ fontSize: 10 }}>lightbulb</span>
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
