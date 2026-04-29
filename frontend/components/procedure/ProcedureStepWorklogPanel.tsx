import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const CONNECTOR_SAFE_PADDING = 28;
const CONNECTOR_INITIAL_LEFT = 1048;

const clampConnectorLeft = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

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

const computeHoursFromDateTimeLocal = (startedAt: string, endedAt: string): string | null => {
  if (!startedAt || !endedAt || startedAt > endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const hours = Math.round(((end - start) / 60000 / 60) * 100) / 100;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
};

const resolveDateTimeError = (enabled: boolean, startedAt: string, endedAt: string): string => {
  if (!enabled) {
    return '';
  }
  if (!startedAt || !endedAt) {
    return 'Nhập đủ Từ ngày và Đến ngày.';
  }
  if (startedAt > endedAt) {
    return 'Từ ngày không được lớn hơn Đến ngày.';
  }
  return '';
};

const formatWorklogDateTime = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) {
    return raw;
  }

  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
};

interface ProcedureStepWorklogPanelProps {
  stepId: number | string;
  stepLabel?: string;
  worklogCount?: number;
  anchorRef?: React.RefObject<HTMLElement | null>;
  projectWorklogDatetimeEnabled: boolean;
  wlogs: ProcedureStepWorklog[];
  wlogInput: string;
  wlogHours: string;
  wlogStartedAt: string;
  wlogEndedAt: string;
  wlogDifficulty: string;
  wlogProposal: string;
  wlogIssueStatus: IssueStatus;
  wlogSaving: boolean;
  editingWorklogId: string | number | null;
  editWorklogContent: string;
  editWorklogHours: string;
  editWorklogStartedAt: string;
  editWorklogEndedAt: string;
  editWorklogDiff: string;
  editWorklogProposal: string;
  editWorklogStatus: IssueStatus;
  editWorklogSaving: boolean;
  deletingWorklogId: string | number | null;
  isAdmin: boolean;
  isRaciA: boolean;
  myId: string | number | null | undefined;
  onAddWorklog: () => void;
  onClosePanel?: () => void;
  onUpdateIssueStatus: (issueId: string | number, status: IssueStatus) => void;
  onStartEditWorklog: (log: ProcedureStepWorklog) => void;
  onCancelEditWorklog: () => void;
  onSaveEditWorklog: (id: number | string) => void;
  onDeleteWorklog: (log: ProcedureStepWorklog) => void;
  onSetWlogInput: (value: string) => void;
  onSetWlogHours: (value: string) => void;
  onSetWlogStartedAt: (value: string) => void;
  onSetWlogEndedAt: (value: string) => void;
  onSetWlogDifficulty: (value: string) => void;
  onSetWlogProposal: (value: string) => void;
  onSetWlogIssueStatus: (value: IssueStatus) => void;
  onSetEditWorklogContent: (value: string) => void;
  onSetEditWorklogHours: (value: string) => void;
  onSetEditWorklogStartedAt: (value: string) => void;
  onSetEditWorklogEndedAt: (value: string) => void;
  onSetEditWorklogDiff: (value: string) => void;
  onSetEditWorklogProposal: (value: string) => void;
  onSetEditWorklogStatus: (value: IssueStatus) => void;
}

export const ProcedureStepWorklogPanel: React.FC<ProcedureStepWorklogPanelProps> = ({
  stepId,
  stepLabel,
  anchorRef,
  projectWorklogDatetimeEnabled,
  wlogs,
  wlogInput,
  wlogHours,
  wlogStartedAt,
  wlogEndedAt,
  wlogDifficulty,
  wlogProposal,
  wlogIssueStatus,
  wlogSaving,
  editingWorklogId,
  editWorklogContent,
  editWorklogHours,
  editWorklogStartedAt,
  editWorklogEndedAt,
  editWorklogDiff,
  editWorklogProposal,
  editWorklogStatus,
  editWorklogSaving,
  deletingWorklogId,
  isAdmin,
  isRaciA,
  myId,
  onAddWorklog,
  onClosePanel,
  onUpdateIssueStatus,
  onStartEditWorklog,
  onCancelEditWorklog,
  onSaveEditWorklog,
  onDeleteWorklog,
  onSetWlogInput,
  onSetWlogHours,
  onSetWlogStartedAt,
  onSetWlogEndedAt,
  onSetWlogDifficulty,
  onSetWlogProposal,
  onSetWlogIssueStatus,
  onSetEditWorklogContent,
  onSetEditWorklogHours,
  onSetEditWorklogStartedAt,
  onSetEditWorklogEndedAt,
  onSetEditWorklogDiff,
  onSetEditWorklogProposal,
  onSetEditWorklogStatus,
}) => {
  const issueFieldsVisible = wlogDifficulty.trim().length > 0;
  const panelLabel = String(stepLabel || stepId);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [connectorLeft, setConnectorLeft] = useState(CONNECTOR_INITIAL_LEFT);
  const createDateTimeError = useMemo(
    () => resolveDateTimeError(projectWorklogDatetimeEnabled, wlogStartedAt, wlogEndedAt),
    [projectWorklogDatetimeEnabled, wlogEndedAt, wlogStartedAt],
  );
  const editDateTimeError = useMemo(
    () => resolveDateTimeError(projectWorklogDatetimeEnabled, editWorklogStartedAt, editWorklogEndedAt),
    [editWorklogEndedAt, editWorklogStartedAt, projectWorklogDatetimeEnabled],
  );
  const canAddWorklog = Boolean(wlogInput.trim()) && !wlogSaving && createDateTimeError === '';

  const handleCreateStartedAtChange = (value: string) => {
    onSetWlogStartedAt(value);
    const computedHours = computeHoursFromDateTimeLocal(value, wlogEndedAt);
    if (computedHours !== null) {
      onSetWlogHours(computedHours);
    }
  };

  const handleCreateEndedAtChange = (value: string) => {
    onSetWlogEndedAt(value);
    const computedHours = computeHoursFromDateTimeLocal(wlogStartedAt, value);
    if (computedHours !== null) {
      onSetWlogHours(computedHours);
    }
  };

  const handleEditStartedAtChange = (value: string) => {
    onSetEditWorklogStartedAt(value);
    const computedHours = computeHoursFromDateTimeLocal(value, editWorklogEndedAt);
    if (computedHours !== null) {
      onSetEditWorklogHours(computedHours);
    }
  };

  const handleEditEndedAtChange = (value: string) => {
    onSetEditWorklogEndedAt(value);
    const computedHours = computeHoursFromDateTimeLocal(editWorklogStartedAt, value);
    if (computedHours !== null) {
      onSetEditWorklogHours(computedHours);
    }
  };

  const syncConnectorPosition = useCallback(() => {
    const anchorElement = anchorRef?.current;
    const surfaceElement = surfaceRef.current;

    if (!anchorElement || !surfaceElement) {
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const surfaceRect = surfaceElement.getBoundingClientRect();

    if (anchorRect.width <= 0 || surfaceRect.width <= 0) {
      return;
    }

    const anchorCenter = anchorRect.left + (anchorRect.width / 2);
    const maxLeft = Math.max(CONNECTOR_SAFE_PADDING, surfaceRect.width - CONNECTOR_SAFE_PADDING);
    setConnectorLeft(clampConnectorLeft(anchorCenter - surfaceRect.left, CONNECTOR_SAFE_PADDING, maxLeft));
  }, [anchorRef]);

  useEffect(() => {
    syncConnectorPosition();

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('resize', syncConnectorPosition);
    window.addEventListener('scroll', syncConnectorPosition, true);

    return () => {
      window.removeEventListener('resize', syncConnectorPosition);
      window.removeEventListener('scroll', syncConnectorPosition, true);
    };
  }, [syncConnectorPosition]);

  return (
    <tr data-testid={`step-worklog-row-${stepId}`}>
      <td colSpan={13} className="border-t border-primary/20 bg-slate-50/95 p-0">
        <div
          data-testid={`step-worklog-panel-viewport-${stepId}`}
          className="sticky left-0 z-10 w-[min(1500px,calc(100vw-2rem))] max-w-full p-2 sm:p-3"
        >
          <div
            ref={surfaceRef}
            data-testid={`step-worklog-panel-surface-${stepId}`}
            className="relative ml-0 w-full sm:ml-auto sm:max-w-[1080px]"
          >
            <div
              aria-hidden="true"
              data-testid={`step-worklog-connector-${stepId}`}
              className="pointer-events-none absolute right-0 -top-6 z-20 hidden h-[230px] sm:block"
              style={{ left: connectorLeft }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 180 230"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id={`worklog-connector-gradient-${stepId}`} x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(6,95,143)" stopOpacity="0.95" />
                    <stop offset="38%" stopColor="rgb(14,165,233)" stopOpacity="0.86" />
                    <stop offset="70%" stopColor="rgb(244,63,94)" stopOpacity="0.74" />
                    <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 0 C0 18 16 22 34 24 C72 28 134 18 161 45 C187 71 179 126 165 158 C150 194 112 214 70 216"
                  fill="none"
                  pathLength={1}
                  stroke={`url(#worklog-connector-gradient-${stepId})`}
                  strokeDasharray="0.785 1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.25"
                />
              </svg>
              <span className="absolute left-0 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_2px_rgba(6,95,143,0.12)]" />
              <span className="absolute right-0 top-[182px] h-px w-8 rounded-full bg-gradient-to-l from-primary/30 to-transparent" />
            </div>
          <section
            id={`step-worklog-panel-${stepId}`}
            data-testid={`step-worklog-panel-${stepId}`}
            role="region"
            aria-labelledby={`step-worklog-panel-title-${stepId}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && onClosePanel) {
                event.stopPropagation();
                onClosePanel();
              }
            }}
            className="flex max-h-[min(560px,calc(100dvh-220px))] min-h-0 flex-col overflow-hidden rounded-lg border border-primary/25 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p id={`step-worklog-panel-title-${stepId}`} className="truncate text-sm font-bold text-primary">
                  Worklog · Bước {panelLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={onClosePanel}
                disabled={!onClosePanel}
                className="inline-flex h-8 items-center justify-center gap-1 rounded border border-primary/25 bg-white px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">close</span>
                Đóng dòng
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
              <div className="rounded border border-slate-200 bg-white p-2 sm:p-3">
              {projectWorklogDatetimeEnabled ? (
                <div className="grid grid-cols-1 gap-2">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className={labelClassName}>Nội dung worklog</span>
                    <input
                      type="text"
                      value={wlogInput}
                      onChange={(event) => onSetWlogInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && canAddWorklog) onAddWorklog();
                      }}
                      data-testid={`step-worklog-input-${stepId}`}
                      placeholder="Ghi worklog mới... (Enter để lưu)"
                      disabled={wlogSaving}
                      className={`${fieldClassName} w-full`}
                    />
                  </label>
                  <div
                    data-testid={`step-worklog-action-row-${stepId}`}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_auto] sm:items-end"
                  >
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className={labelClassName}>Từ ngày</span>
                      <input
                        type="datetime-local"
                        value={wlogStartedAt}
                        onChange={(event) => handleCreateStartedAtChange(event.target.value)}
                        data-testid={`step-worklog-started-at-${stepId}`}
                        disabled={wlogSaving}
                        aria-invalid={createDateTimeError !== ''}
                        className={`${fieldClassName} w-full ${createDateTimeError ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : ''}`}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className={labelClassName}>Đến ngày</span>
                      <input
                        type="datetime-local"
                        value={wlogEndedAt}
                        onChange={(event) => handleCreateEndedAtChange(event.target.value)}
                        data-testid={`step-worklog-ended-at-${stepId}`}
                        disabled={wlogSaving}
                        aria-invalid={createDateTimeError !== ''}
                        className={`${fieldClassName} w-full ${createDateTimeError ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : ''}`}
                      />
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={wlogHours}
                      onChange={(event) => onSetWlogHours(event.target.value)}
                      data-testid={`step-worklog-hours-${stepId}`}
                      placeholder="0.5"
                      aria-label="Số giờ"
                      disabled={wlogSaving}
                      className={`${fieldClassName} w-full`}
                    />
                    <button
                      type="button"
                      onClick={onAddWorklog}
                      data-testid={`step-worklog-add-${stepId}`}
                      disabled={!canAddWorklog}
                      aria-label={wlogSaving ? 'Đang thêm worklog' : 'Thêm worklog'}
                      className="inline-flex h-11 w-full items-center justify-center rounded bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:h-8 sm:w-auto sm:text-xs"
                    >
                      {wlogSaving ? '...' : 'Thêm'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  data-testid={`step-worklog-action-row-${stepId}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_96px_auto] sm:items-end"
                >
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className={labelClassName}>Nội dung worklog</span>
                    <input
                      type="text"
                      value={wlogInput}
                      onChange={(event) => onSetWlogInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && canAddWorklog) onAddWorklog();
                      }}
                      data-testid={`step-worklog-input-${stepId}`}
                      placeholder="Ghi worklog mới... (Enter để lưu)"
                      disabled={wlogSaving}
                      className={`${fieldClassName} w-full`}
                    />
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={wlogHours}
                    onChange={(event) => onSetWlogHours(event.target.value)}
                    data-testid={`step-worklog-hours-${stepId}`}
                    placeholder="0.5"
                    aria-label="Số giờ"
                    disabled={wlogSaving}
                    className={`${fieldClassName} w-full`}
                  />
                  <button
                    type="button"
                    onClick={onAddWorklog}
                    data-testid={`step-worklog-add-${stepId}`}
                    disabled={!canAddWorklog}
                    aria-label={wlogSaving ? 'Đang thêm worklog' : 'Thêm worklog'}
                    className="inline-flex h-11 w-full items-center justify-center rounded bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:h-8 sm:w-auto sm:text-xs"
                  >
                    {wlogSaving ? '...' : 'Thêm'}
                  </button>
                </div>
              )}
              {createDateTimeError ? (
                <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
                  {createDateTimeError}
                </p>
              ) : null}

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
            className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin"
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
                      <div
                        className={
                          projectWorklogDatetimeEnabled
                            ? 'grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[176px_176px_88px_minmax(0,1fr)_160px]'
                            : 'grid grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)_160px]'
                        }
                      >
                        {projectWorklogDatetimeEnabled ? (
                          <>
                            <label className="flex min-w-0 flex-col gap-1">
                              <span className={labelClassName}>Từ ngày khi sửa</span>
                              <input
                                type="datetime-local"
                                value={editWorklogStartedAt}
                                onChange={(event) => handleEditStartedAtChange(event.target.value)}
                                data-testid={`step-worklog-edit-started-at-${log.id}`}
                                className={`${fieldClassName} w-full ${editDateTimeError ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : ''}`}
                              />
                            </label>
                            <label className="flex min-w-0 flex-col gap-1">
                              <span className={labelClassName}>Đến ngày khi sửa</span>
                              <input
                                type="datetime-local"
                                value={editWorklogEndedAt}
                                onChange={(event) => handleEditEndedAtChange(event.target.value)}
                                data-testid={`step-worklog-edit-ended-at-${log.id}`}
                                className={`${fieldClassName} w-full ${editDateTimeError ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : ''}`}
                              />
                            </label>
                          </>
                        ) : null}
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className="sr-only">Số giờ khi sửa</span>
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
                        <label className="flex min-w-0 flex-col gap-1">
                          <span className={labelClassName}>Khó khăn khi sửa</span>
                          <textarea
                            value={editWorklogDiff}
                            onChange={(event) => onSetEditWorklogDiff(event.target.value)}
                            rows={2}
                            className={`${textareaClassName} w-full`}
                          />
                        </label>
                        <label className="flex min-w-0 flex-col gap-1">
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
                      {editDateTimeError ? (
                        <p className="text-xs font-semibold text-rose-700" role="alert">
                          {editDateTimeError}
                        </p>
                      ) : null}
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
                          disabled={!editWorklogContent.trim() || editWorklogSaving || editDateTimeError !== ''}
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
                        {log.timesheet?.work_started_at && log.timesheet?.work_ended_at ? (
                          <div className="mt-1 text-[11px] font-medium text-slate-600">
                            {formatWorklogDateTime(log.timesheet.work_started_at)} - {formatWorklogDateTime(log.timesheet.work_ended_at)}
                          </div>
                        ) : null}
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
          </section>
          </div>
        </div>
      </td>
    </tr>
  );
};
