import React from 'react';
import type { IssueStatus, ProcedureStepWorklog } from '../../types';

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

function relativeTime(dateStr: string): string {
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
}

function absTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ProcedureStepWorklogPanelProps {
  stepId: string | number;
  wlogs: ProcedureStepWorklog[];
  wlogInput: string;
  wlogHours: string;
  wlogDifficulty: string;
  wlogProposal: string;
  wlogIssueStatus: IssueStatus;
  wlogSaving: boolean;
  editingWorklogId: string | number | null;
  editWorklogContent: string;
  editWorklogHours: string;
  editWorklogDiff: string;
  editWorklogProposal: string;
  editWorklogStatus: IssueStatus;
  editWorklogSaving: boolean;
  onAddWorklog: () => void;
  onUpdateIssueStatus: (issueId: string | number, status: IssueStatus) => void;
  onStartEditWorklog: (log: ProcedureStepWorklog) => void;
  onCancelEditWorklog: () => void;
  onSaveEditWorklog: (logId: string | number) => void;
  onSetWlogInput: (value: string) => void;
  onSetWlogHours: (value: string) => void;
  onSetWlogDifficulty: (value: string) => void;
  onSetWlogProposal: (value: string) => void;
  onSetWlogIssueStatus: (value: IssueStatus) => void;
  onSetEditWorklogContent: (value: string) => void;
  onSetEditWorklogHours: (value: string) => void;
  onSetEditWorklogDiff: (value: string) => void;
  onSetEditWorklogProposal: (value: string) => void;
  onSetEditWorklogStatus: (value: IssueStatus) => void;
}

export const ProcedureStepWorklogPanel: React.FC<ProcedureStepWorklogPanelProps> = ({
  stepId,
  wlogs,
  wlogInput,
  wlogHours,
  wlogDifficulty,
  wlogProposal,
  wlogIssueStatus,
  wlogSaving,
  editingWorklogId,
  editWorklogContent,
  editWorklogHours,
  editWorklogDiff,
  editWorklogProposal,
  editWorklogStatus,
  editWorklogSaving,
  onAddWorklog,
  onUpdateIssueStatus,
  onStartEditWorklog,
  onCancelEditWorklog,
  onSaveEditWorklog,
  onSetWlogInput,
  onSetWlogHours,
  onSetWlogDifficulty,
  onSetWlogProposal,
  onSetWlogIssueStatus,
  onSetEditWorklogContent,
  onSetEditWorklogHours,
  onSetEditWorklogDiff,
  onSetEditWorklogProposal,
  onSetEditWorklogStatus,
}) => (
  <tr>
    <td data-testid={`step-worklog-panel-${stepId}`} colSpan={13} className="px-4 py-3 bg-violet-50/50 border-t border-violet-100">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 bg-white border border-violet-100 rounded-xl p-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={wlogInput}
              onChange={(e) => onSetWlogInput(e.target.value)}
              data-testid={`step-worklog-input-${stepId}`}
              onKeyDown={(e) => { if (e.key === 'Enter' && !wlogSaving) onAddWorklog(); }}
              placeholder="Ghi worklog mới... (Enter để lưu)"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
            />
            <input
              type="number"
              min="0.01"
              max="24"
              step="0.25"
              value={wlogHours}
              onChange={(e) => onSetWlogHours(e.target.value)}
              data-testid={`step-worklog-hours-${stepId}`}
              placeholder="Giờ"
              title="Giờ thực hiện"
              className="w-20 px-2 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none text-right"
            />
            <button
              onClick={onAddWorklog}
              data-testid={`step-worklog-add-${stepId}`}
              disabled={!wlogInput.trim() || wlogSaving}
              className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {wlogSaving ? '...' : 'Thêm'}
            </button>
          </div>
          <textarea
            value={wlogDifficulty}
            onChange={(e) => onSetWlogDifficulty(e.target.value)}
            data-testid={`step-worklog-difficulty-${stepId}`}
            placeholder="Khó khăn (tuỳ chọn)…"
            rows={2}
            className="w-full px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none resize-none"
          />
          {wlogDifficulty.trim() && (
            <div className="flex gap-2">
              <textarea
                value={wlogProposal}
                onChange={(e) => onSetWlogProposal(e.target.value)}
                data-testid={`step-worklog-proposal-${stepId}`}
                placeholder="Đề xuất / giải pháp…"
                rows={2}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none resize-none"
              />
              <select
                value={wlogIssueStatus}
                onChange={(e) => onSetWlogIssueStatus(e.target.value as IssueStatus)}
                data-testid={`step-worklog-status-${stepId}`}
                className="w-36 px-2 py-1 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none self-start mt-0.5"
              >
                <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="RESOLVED">Đã giải quyết</option>
              </select>
            </div>
          )}
        </div>

        {wlogs.length > 0 ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            {wlogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs group">
                <span className={`p-1 rounded-full shrink-0 ${WORKLOG_COLOR[log.log_type] || 'bg-slate-100 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-xs leading-none">{WORKLOG_ICON[log.log_type] || 'info'}</span>
                </span>
                <div className="flex-1 min-w-0">
                  {editingWorklogId === log.id ? (
                    <div className="flex flex-col gap-1.5 bg-violet-50 border border-violet-200 rounded-lg p-2">
                      <input
                        autoFocus
                        type="text"
                        value={editWorklogContent}
                        onChange={(e) => onSetEditWorklogContent(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditWorklog(); }}
                        className="w-full px-2 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          min="0.01"
                          max="24"
                          step="0.25"
                          value={editWorklogHours}
                          onChange={(e) => onSetEditWorklogHours(e.target.value)}
                          placeholder="Giờ"
                          className="w-20 px-2 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none text-right"
                        />
                        <textarea
                          value={editWorklogDiff}
                          onChange={(e) => onSetEditWorklogDiff(e.target.value)}
                          placeholder="Khó khăn…"
                          rows={2}
                          className="flex-1 px-2 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none resize-none"
                        />
                      </div>
                      {editWorklogDiff.trim() && (
                        <div className="flex gap-1.5">
                          <textarea
                            value={editWorklogProposal}
                            onChange={(e) => onSetEditWorklogProposal(e.target.value)}
                            placeholder="Đề xuất…"
                            rows={2}
                            className="flex-1 px-2 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none resize-none"
                          />
                          <select
                            value={editWorklogStatus}
                            onChange={(e) => onSetEditWorklogStatus(e.target.value as IssueStatus)}
                            className="w-32 px-1.5 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none self-start"
                          >
                            <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                            <option value="IN_PROGRESS">Đang xử lý</option>
                            <option value="RESOLVED">Đã giải quyết</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={onCancelEditWorklog} className="px-2 py-0.5 text-[10px] rounded border border-slate-200 text-slate-500 hover:bg-slate-50">Huỷ</button>
                        <button
                          onClick={() => onSaveEditWorklog(log.id)}
                          disabled={!editWorklogContent.trim() || editWorklogSaving}
                          className="px-2 py-0.5 text-[10px] rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                        >
                          {editWorklogSaving ? '...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-700">{log.content}</span>
                        {log.timesheet && Number(log.timesheet.hours_spent) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold border border-blue-100">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            {Number(log.timesheet.hours_spent).toFixed(2)}h
                          </span>
                        )}
                        {log.log_type === 'NOTE' && (
                          <button
                            onClick={() => onStartEditWorklog(log)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-violet-500 transition-all"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-[12px]">edit</span>
                          </button>
                        )}
                      </div>
                      {log.issue && (
                        <div className="mt-1.5 pl-2 border-l-2 border-orange-200 space-y-0.5">
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="material-symbols-outlined text-[10px] text-orange-400 mt-0.5">warning</span>
                            <span className="text-slate-600 text-[11px] flex-1">{log.issue.issue_content}</span>
                            <div className="relative group/status">
                              <button className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${ISSUE_STATUS_META[log.issue.issue_status]?.color || ''}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${ISSUE_STATUS_META[log.issue.issue_status]?.dot || ''}`} />
                                {ISSUE_STATUS_META[log.issue.issue_status]?.label || log.issue.issue_status}
                                <span className="material-symbols-outlined text-[10px]">expand_more</span>
                              </button>
                              <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover/status:flex flex-col bg-white border border-slate-200 rounded-lg shadow-lg min-w-[130px] overflow-hidden">
                                {(['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'] as IssueStatus[]).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => onUpdateIssueStatus(log.issue!.id, status)}
                                    className={`text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 ${status === log.issue!.issue_status ? 'font-semibold' : ''} ${ISSUE_STATUS_META[status]?.color || ''}`}
                                  >
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ISSUE_STATUS_META[status]?.dot || ''}`} />
                                    {ISSUE_STATUS_META[status]?.label || status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {log.issue.proposal_content && (
                            <p className="text-[10px] text-slate-500 flex items-start gap-1">
                              <span className="material-symbols-outlined text-[10px] text-emerald-400 shrink-0 mt-px">lightbulb</span>
                              {log.issue.proposal_content}
                            </p>
                          )}
                        </div>
                      )}
                      <span className="text-slate-400 mt-0.5 block">
                        {log.creator?.full_name || 'Hệ thống'}
                        {' · '}
                        <span title={absTime(log.created_at)} className="cursor-default">{relativeTime(log.created_at)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có worklog cho bước này.</p>
        )}
      </div>
    </td>
  </tr>
);
