import React from 'react';
import type { IssueStatus, ProcedureStepWorklog } from '../../types';

type WorklogMeta = {
  icon: string;
  label: string;
  className: string;
};

const WORKLOG_META: Record<string, WorklogMeta> = {
  STATUS_CHANGE: {
    icon: 'sync_alt',
    label: 'Đổi tiến độ',
    className: 'border-primary/25 bg-primary/10 text-primary',
  },
  DOCUMENT_ADDED: {
    icon: 'description',
    label: 'Văn bản',
    className: 'border-emerald-800/25 bg-emerald-50 text-emerald-800',
  },
  NOTE: {
    icon: 'edit_note',
    label: 'Ghi chú',
    className: 'border-slate-300 bg-slate-50 text-slate-700',
  },
  CUSTOM: {
    icon: 'add_circle',
    label: 'Tự thêm',
    className: 'border-amber-900/25 bg-amber-50 text-amber-900',
  },
};

const ISSUE_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  JUST_ENCOUNTERED: {
    label: 'Vừa gặp',
    color: 'text-amber-900 bg-amber-50 border-amber-800/30',
    dot: 'bg-amber-800',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    color: 'text-primary bg-primary/10 border-primary/30',
    dot: 'bg-primary',
  },
  RESOLVED: {
    label: 'Đã giải quyết',
    color: 'text-emerald-800 bg-emerald-50 border-emerald-800/30',
    dot: 'bg-emerald-800',
  },
};

const fieldClassName =
  'h-11 sm:h-8 rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-500 transition-colors focus:border-primary/70 focus:ring-1 focus:ring-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500';

const textareaClassName =
  'min-h-[44px] rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-500 transition-colors focus:border-primary/70 focus:ring-1 focus:ring-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500';

const iconButtonClassName =
  'inline-flex h-9 w-9 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-400 sm:h-7 sm:w-7';

const labelClassName = 'text-[11px] font-semibold text-slate-700';

const getWorklogMeta = (type?: string): WorklogMeta => WORKLOG_META[type || ''] || WORKLOG_META.CUSTOM;

const getRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  if (absSeconds < 60) return rtf.format(diffSeconds, 'second');
  if (absSeconds < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absSeconds < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
};

interface ProcedureStepWorklogPanelProps {
  stepId: number | string;
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
  deletingWorklogId: string | number | null;
  isAdmin: boolean;
  isRaciA: boolean;
  myId: string | number | null | undefined;
  onAddWorklog: () => void;
  onUpdateIssueStatus: (issueId: string | number, status: IssueStatus) => void;
  onStartEditWorklog: (log: ProcedureStepWorklog) => void;
  onCancelEditWorklog: () => void;
  onSaveEditWorklog: (id: number | string) => void;
  onDeleteWorklog: (log: ProcedureStepWorklog) => void;
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
  deletingWorklogId,
  isAdmin,
  isRaciA,
  myId,
  onAddWorklog,
  onUpdateIssueStatus,
  onStartEditWorklog,
  onCancelEditWorklog,
  onSaveEditWorklog,
  onDeleteWorklog,
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
}) => {
  const issueFieldsVisible = wlogDifficulty.trim().length > 0;

  return (
    <tr>
      <td
        colSpan={12}
        id={`step-worklog-panel-${stepId}`}
        data-testid={`step-worklog-panel-${stepId}`}
        className="px-4 py-3 bg-violet-50/50 border-t border-violet-100"
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-violet-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_88px_auto]">
              <label className="flex min-w-0 flex-col gap-1">
                <span className={labelClassName}>Nội dung worklog</span>
                <input
                  type="text"
                  value={wlogInput}
                  onChange={(event) => onSetWlogInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onAddWorklog();
                  }}
                  data-testid={`step-worklog-input-${stepId}`}
                  placeholder="Ghi worklog mới... (Enter để lưu)"
                  disabled={wlogSaving}
                  className={`${fieldClassName} w-full`}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={labelClassName}>Giờ</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={wlogHours}
                  onChange={(event) => onSetWlogHours(event.target.value)}
                  data-testid={`step-worklog-hours-${stepId}`}
                  placeholder="Giờ"
                  disabled={wlogSaving}
                  className={`${fieldClassName} w-full`}
                />
              </label>
              <button
                type="button"
                onClick={onAddWorklog}
                data-testid={`step-worklog-add-${stepId}`}
                disabled={!wlogInput.trim() || wlogSaving}
                aria-label={wlogSaving ? 'Đang thêm worklog' : 'Thêm worklog'}
                className="inline-flex h-11 items-center justify-center rounded bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:mt-5 sm:h-8 sm:text-xs"
              >
                {wlogSaving ? '...' : 'Thêm'}
              </button>
            </div>

            <label className="mt-2 flex flex-col gap-1">
              <span className={labelClassName}>Khó khăn (tùy chọn)</span>
              <textarea
                value={wlogDifficulty}
                onChange={(event) => onSetWlogDifficulty(event.target.value)}
                data-testid={`step-worklog-difficulty-${stepId}`}
                placeholder="Khó khăn (tùy chọn)..."
                disabled={wlogSaving}
                rows={2}
                className={`${textareaClassName} w-full`}
              />
            </label>

            {issueFieldsVisible && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px]" aria-live="polite">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className={labelClassName}>Đề xuất / giải pháp</span>
                  <textarea
                    value={wlogProposal}
                    onChange={(event) => onSetWlogProposal(event.target.value)}
                    data-testid={`step-worklog-proposal-${stepId}`}
                    placeholder="Đề xuất / giải pháp..."
                    disabled={wlogSaving}
                    rows={2}
                    className={`${textareaClassName} w-full`}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className={labelClassName}>Trạng thái khó khăn</span>
                  <select
                    value={wlogIssueStatus}
                    onChange={(event) => onSetWlogIssueStatus(event.target.value as IssueStatus)}
                    data-testid={`step-worklog-status-${stepId}`}
                    disabled={wlogSaving}
                    className={`${fieldClassName} w-full`}
                  >
                    <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="RESOLVED">Đã giải quyết</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <ol
            role="list"
            aria-label={`Nhật ký worklog của bước ${stepId}`}
            className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin"
          >
            {wlogs.map((log) => {
              const issue = log.issue;
              const issueStatus: IssueStatus = issue?.issue_status || 'JUST_ENCOUNTERED';
              const issueMeta = ISSUE_STATUS_META[issueStatus] || ISSUE_STATUS_META.JUST_ENCOUNTERED;
              const worklogMeta = getWorklogMeta(log.log_type);
              const isEditing = String(editingWorklogId) === String(log.id);
              const creatorId = log.creator?.id ?? log.created_by;
              const canMutate = isAdmin || isRaciA || (myId != null && String(creatorId) === String(myId));
              const isDeleting = String(deletingWorklogId) === String(log.id);
              const hoursSpent = log.timesheet?.hours_spent;

              return (
                <li
                  key={log.id}
                  className="group rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1">
                        <span className={labelClassName}>Nội dung worklog khi sửa</span>
                        <input
                          type="text"
                          value={editWorklogContent}
                          onChange={(event) => onSetEditWorklogContent(event.target.value)}
                          data-testid={`step-worklog-edit-input-${log.id}`}
                          className={`${fieldClassName} w-full`}
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)_160px]">
                        <label className="flex flex-col gap-1">
                          <span className={labelClassName}>Giờ khi sửa</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={editWorklogHours}
                            onChange={(event) => onSetEditWorklogHours(event.target.value)}
                            data-testid={`step-worklog-edit-hours-${log.id}`}
                            className={`${fieldClassName} w-full`}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={labelClassName}>Khó khăn khi sửa</span>
                          <textarea
                            value={editWorklogDiff}
                            onChange={(event) => onSetEditWorklogDiff(event.target.value)}
                            rows={2}
                            className={`${textareaClassName} w-full`}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className={labelClassName}>Trạng thái khó khăn khi sửa</span>
                          <select
                            value={editWorklogStatus}
                            onChange={(event) => onSetEditWorklogStatus(event.target.value as IssueStatus)}
                            className={`${fieldClassName} w-full`}
                          >
                            <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                            <option value="IN_PROGRESS">Đang xử lý</option>
                            <option value="RESOLVED">Đã giải quyết</option>
                          </select>
                        </label>
                      </div>
                      <label className="flex flex-col gap-1">
                        <span className={labelClassName}>Đề xuất / giải pháp khi sửa</span>
                        <textarea
                          value={editWorklogProposal}
                          onChange={(event) => onSetEditWorklogProposal(event.target.value)}
                          rows={2}
                          className={`${textareaClassName} w-full`}
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelEditWorklog}
                          disabled={editWorklogSaving}
                          className="inline-flex h-11 items-center rounded border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 sm:h-8 sm:text-xs"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => onSaveEditWorklog(log.id)}
                          disabled={!editWorklogContent.trim() || editWorklogSaving}
                          className="inline-flex h-11 items-center rounded bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:h-8 sm:text-xs"
                        >
                          {editWorklogSaving ? '...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border ${worklogMeta.className}`}
                      >
                        <span className="material-symbols-outlined text-[15px]">{worklogMeta.icon}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex h-6 items-center rounded border px-2 text-[11px] font-semibold ${worklogMeta.className}`}
                          >
                            {worklogMeta.label}
                          </span>
                          <span className="min-w-0 font-semibold leading-5 text-slate-800">{log.content}</span>
                          {hoursSpent != null ? (
                            <span className="text-xs font-medium text-slate-700">• {Number(hoursSpent).toFixed(2)}h</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {log.creator?.full_name || 'Người dùng'} • {getRelativeTime(log.created_at)}
                        </div>
                        {issue?.issue_content ? (
                          <div className="mt-2 rounded border border-amber-800/25 border-l-4 bg-amber-50/80 p-2 text-xs text-slate-800">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span
                                className="material-symbols-outlined text-[14px] text-amber-800"
                                aria-hidden="true"
                              >
                                warning
                              </span>
                              <span className="font-semibold text-amber-900">Khó khăn</span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${issueMeta.color}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${issueMeta.dot}`} aria-hidden="true" />
                                {issueMeta.label}
                              </span>
                            </div>
                            <p className="text-slate-800">{issue.issue_content}</p>
                            {issue.proposal_content ? (
                              <p className="mt-1 flex items-start gap-1 text-slate-700">
                                <span
                                  className="material-symbols-outlined text-[14px] text-emerald-800"
                                  aria-hidden="true"
                                >
                                  lightbulb
                                </span>
                                <span>
                                  <span className="font-semibold">Đề xuất:</span> {issue.proposal_content}
                                </span>
                              </p>
                            ) : null}
                            <label className="mt-2 flex w-full flex-col gap-1 sm:w-48">
                              <span className={labelClassName}>Trạng thái khó khăn {issue.issue_content}</span>
                              <select
                                value={issueStatus}
                                onChange={(event) => onUpdateIssueStatus(issue.id, event.target.value as IssueStatus)}
                                data-testid={`step-worklog-issue-status-${log.id}`}
                                className={`${fieldClassName} w-full text-xs`}
                              >
                                <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                                <option value="IN_PROGRESS">Đang xử lý</option>
                                <option value="RESOLVED">Đã giải quyết</option>
                              </select>
                            </label>
                          </div>
                        ) : null}
                      </div>
                      {canMutate ? (
                        <div className="flex flex-none gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => onStartEditWorklog(log)}
                            title="Chỉnh sửa"
                            aria-label={`Chỉnh sửa worklog ${log.content}`}
                            className={iconButtonClassName}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWorklog(log)}
                            title="Xóa"
                            aria-label={`Xóa worklog ${log.content}`}
                            disabled={isDeleting}
                            className={`${iconButtonClassName} hover:text-red-700`}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              {isDeleting ? 'hourglass_empty' : 'delete'}
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </td>
    </tr>
  );
};
