import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchWorklogActivityTypes } from '../../services/api/supportConfigApi';
import type { WorklogActivityTypeOption } from '../../types/support';
import type { YeuCauHoursReport, YeuCauWorklog } from '../../types/customerRequest';
import { formatCurrentDateTimeForInput, normalizeText } from './helpers';
import { formatHoursValue } from './presentation';

export type CustomerRequestWorklogMode = 'worklog' | 'detail_status_worklog' | 'edit_worklog';

export type CustomerRequestWorklogSubmission = {
  work_content: string;
  work_date: string;
  activity_type_code?: string | null;
  hours_spent: string;
  is_billable: boolean;
  difficulty_note?: string | null;
  proposal_note?: string | null;
  difficulty_status?: 'none' | 'has_issue' | 'resolved' | null;
  detail_status_action?: 'in_progress' | 'paused' | 'completed' | null;
};

export type CustomerRequestWorklogModalContext = {
  mode: CustomerRequestWorklogMode;
  title: string;
  eyebrow?: string;
  submitLabel?: string;
  detailStatusAction?: 'in_progress' | 'paused' | null;
  editingWorklog?: YeuCauWorklog | null;
};

const DEFAULT_MODAL_CONTEXT: CustomerRequestWorklogModalContext = {
  mode: 'worklog',
  title: 'Ghi giờ công',
  eyebrow: 'Giờ công',
  submitLabel: 'Lưu giờ công',
  detailStatusAction: null,
  editingWorklog: null,
};

const todayForDateInput = (): string => formatCurrentDateTimeForInput().slice(0, 10);

const toHoursInputValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return String(numeric);
};

const normalizeWorkDateInput = (value: string | null | undefined): string => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return todayForDateInput();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(normalized)) {
    return normalized.slice(0, 10);
  }
  return todayForDateInput();
};

const normalizeWorklogForForm = (
  worklog: YeuCauWorklog,
  fallbackDate: string
): Pick<
  CustomerRequestWorklogSubmission,
  'work_content' | 'work_date' | 'activity_type_code' | 'hours_spent' | 'is_billable' | 'difficulty_note' | 'proposal_note' | 'difficulty_status' | 'detail_status_action'
> => ({
  work_content: String(worklog.work_content ?? ''),
  work_date: normalizeWorkDateInput(worklog.work_date ?? worklog.work_started_at ?? fallbackDate),
  activity_type_code: worklog.activity_type_code ?? null,
  hours_spent: toHoursInputValue(worklog.hours_spent),
  is_billable: worklog.is_billable === null || worklog.is_billable === undefined ? true : Boolean(worklog.is_billable),
  difficulty_note: worklog.difficulty_note ?? null,
  proposal_note: worklog.proposal_note ?? null,
  difficulty_status: (worklog.difficulty_status as 'none' | 'has_issue' | 'resolved' | null) ?? null,
  detail_status_action: (worklog.detail_status_action as 'in_progress' | 'paused' | 'completed' | null) ?? null,
});

const resolveHeaderCaption = (context: CustomerRequestWorklogModalContext): { eyebrow: string; title: string; submit: string } => ({
  eyebrow: context.eyebrow ?? 'Giờ công',
  title: context.title,
  submit: context.submitLabel ?? 'Lưu giờ công',
});

const modalOverlayClassName = 'fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4';
const modalPanelClassName = 'flex max-h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:max-h-[calc(100dvh-32px)]';
const fieldLabelClassName = 'mb-1 block text-xs font-semibold leading-5 text-neutral';
const fieldInputClassName =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm leading-5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const fieldTextareaClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const secondaryButtonClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto';
const primaryButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold leading-5 text-white transition hover:brightness-105 disabled:opacity-50 sm:w-auto';

type CustomerRequestWorklogModalProps = {
  open: boolean;
  isSubmitting: boolean;
  requestCode?: string | null;
  requestSummary?: string | null;
  hoursReport?: YeuCauHoursReport | null;
  context?: CustomerRequestWorklogModalContext | null;
  onClose: () => void;
  onSubmit: (payload: CustomerRequestWorklogSubmission) => void;
};

export const CustomerRequestWorklogModal: React.FC<CustomerRequestWorklogModalProps> = ({
  open,
  isSubmitting,
  requestCode,
  requestSummary,
  hoursReport,
  context,
  onClose,
  onSubmit,
}) => {
  const resolvedContext = context ?? DEFAULT_MODAL_CONTEXT;
  const [workContent, setWorkContent] = useState('');
  const [workDate, setWorkDate] = useState(todayForDateInput());
  const [activityTypeCode, setActivityTypeCode] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [difficultyNote, setDifficultyNote] = useState('');
  const [proposalNote, setProposalNote] = useState('');
  const [difficultyStatus, setDifficultyStatus] = useState<'none' | 'has_issue' | 'resolved'>('none');
  const [activityTypes, setActivityTypes] = useState<WorklogActivityTypeOption[]>([]);
  const [isActivityTypesLoading, setIsActivityTypesLoading] = useState(false);
  const [activityTypesError, setActivityTypesError] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  const headerCaption = useMemo(() => resolveHeaderCaption(resolvedContext), [resolvedContext]);

  const summaryCaption = useMemo(() => {
    if (!hoursReport) {
      return '--';
    }

    const total = formatHoursValue(hoursReport.total_hours_spent);
    const estimated = hoursReport.estimated_hours == null ? '--' : formatHoursValue(hoursReport.estimated_hours);
    const remaining = hoursReport.remaining_hours == null ? '--' : formatHoursValue(hoursReport.remaining_hours);
    return `${total} đã dùng / ${estimated} ước lượng / còn ${remaining}`;
  }, [hoursReport]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const editing = resolvedContext.editingWorklog;
    if (resolvedContext.mode === 'edit_worklog' && editing) {
      const normalized = normalizeWorklogForForm(editing, todayForDateInput());
      setWorkContent(normalized.work_content);
      setWorkDate(normalized.work_date);
      setActivityTypeCode(normalized.activity_type_code ?? '');
      setHoursSpent(normalized.hours_spent);
      setIsBillable(normalized.is_billable);
      setDifficultyNote(normalized.difficulty_note ?? '');
      setProposalNote(normalized.proposal_note ?? '');
      setDifficultyStatus(normalized.difficulty_status ?? 'none');
      setValidationMessage('');
      return;
    }

    setWorkContent('');
    setWorkDate(todayForDateInput());
    setActivityTypeCode('');
    setHoursSpent('');
    setIsBillable(true);
    setDifficultyNote('');
    setProposalNote('');
    setDifficultyStatus('none');
    setValidationMessage('');
  }, [open, requestCode, resolvedContext]);

  useEffect(() => {
    if (!open || activityTypes.length > 0) {
      return;
    }

    let cancelled = false;
    setIsActivityTypesLoading(true);
    setActivityTypesError('');

    void fetchWorklogActivityTypes(false)
      .then((rows) => {
        if (!cancelled) {
          setActivityTypes(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActivityTypesError(error instanceof Error ? error.message : 'Không thể tải danh sách loại hoạt động.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsActivityTypesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activityTypes.length, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const selectedActivity = activityTypes.find((item) => item.code === activityTypeCode);

  const handleSubmit = () => {
    const numericHours = Number(hoursSpent);
    if (!Number.isFinite(numericHours) || numericHours < 0) {
      setValidationMessage('Giờ công phải là số lớn hơn hoặc bằng 0.');
      return;
    }

    setValidationMessage('');
    onSubmit({
      work_content: workContent.trim(),
      work_date: workDate.trim(),
      activity_type_code: activityTypeCode.trim() || null,
      hours_spent: hoursSpent.trim(),
      is_billable: isBillable,
      difficulty_note: normalizeText(difficultyNote) ? difficultyNote.trim() : null,
      proposal_note: normalizeText(proposalNote) ? proposalNote.trim() : null,
      difficulty_status: difficultyStatus,
      detail_status_action: resolvedContext.mode === 'detail_status_worklog'
        ? (resolvedContext.detailStatusAction ?? null)
        : null,
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headerCaption.title}
      className={modalOverlayClassName}
    >
      <div className={modalPanelClassName}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral">{headerCaption.eyebrow}</p>
            <h3 className="mt-1 text-[20px] font-bold leading-tight text-deep-teal sm:text-[22px]">{headerCaption.title}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {requestCode ? `${requestCode} · ` : ''}
              {requestSummary || 'Yêu cầu hiện tại'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3.5 sm:px-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral">Tóm tắt giờ công</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{summaryCaption}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,132px)_minmax(0,170px)_minmax(0,1fr)]">
            <div>
              <label htmlFor="crc-worklog-hours" className={fieldLabelClassName}>Giờ công</label>
              <input
                id="crc-worklog-hours"
                type="number"
                min="0"
                step="0.25"
                value={hoursSpent}
                onChange={(event) => setHoursSpent(event.target.value)}
                disabled={isSubmitting}
                placeholder="0"
                className={fieldInputClassName}
              />
            </div>

            <div>
              <label htmlFor="crc-worklog-date" className={fieldLabelClassName}>Ngày làm việc</label>
              <input
                id="crc-worklog-date"
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                disabled={isSubmitting}
                className={fieldInputClassName}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label htmlFor="crc-worklog-activity" className={fieldLabelClassName}>Loại hoạt động</label>
              <select
                id="crc-worklog-activity"
                value={activityTypeCode}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  setActivityTypeCode(nextCode);
                  const nextActivity = activityTypes.find((item) => item.code === nextCode);
                  if (nextActivity) {
                    setIsBillable(Boolean(nextActivity.default_is_billable));
                  }
                }}
                disabled={isSubmitting || isActivityTypesLoading}
                className={fieldInputClassName}
              >
                <option value="">{isActivityTypesLoading ? 'Đang tải loại hoạt động...' : 'Chọn loại hoạt động (tuỳ chọn)'}</option>
                {activityTypes.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              {activityTypesError ? <p className="mt-1 text-xs text-rose-600">{activityTypesError}</p> : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,302px)_minmax(0,1fr)]">
            <div>
              <label htmlFor="crc-worklog-difficulty-status" className={fieldLabelClassName}>Trạng thái xử lý khó khăn</label>
              <select
                id="crc-worklog-difficulty-status"
                value={difficultyStatus}
                onChange={(event) => setDifficultyStatus(event.target.value as 'none' | 'has_issue' | 'resolved')}
                disabled={isSubmitting}
                className={fieldInputClassName}
              >
                <option value="none">Không</option>
                <option value="has_issue">Có</option>
                <option value="resolved">Đã giải quyết</option>
              </select>
            </div>

            <div>
              <p aria-hidden="true" className={`hidden md:block ${fieldLabelClassName} select-none opacity-0`}>
                Tính vào giờ tính phí
              </p>
              <label className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={(event) => setIsBillable(event.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="min-w-0 truncate text-sm font-semibold leading-5 text-slate-700">
                  Tính vào giờ tính phí
                  {selectedActivity ? ` · ${selectedActivity.name}` : ''}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="crc-worklog-content" className={fieldLabelClassName}>Nội dung công việc</label>
            <textarea
              id="crc-worklog-content"
              rows={4}
              value={workContent}
              onChange={(event) => setWorkContent(event.target.value)}
              disabled={isSubmitting}
              placeholder="Mô tả ngắn gọn phần việc đã thực hiện."
              className={fieldTextareaClassName}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label htmlFor="crc-worklog-difficulty-note" className={fieldLabelClassName}>Khó khăn</label>
              <textarea
                id="crc-worklog-difficulty-note"
                rows={3}
                value={difficultyNote}
                onChange={(event) => setDifficultyNote(event.target.value)}
                disabled={isSubmitting}
                placeholder="Mô tả khó khăn (nếu có)."
                className={fieldTextareaClassName}
              />
            </div>
            <div>
              <label htmlFor="crc-worklog-proposal-note" className={fieldLabelClassName}>Đề xuất</label>
              <textarea
                id="crc-worklog-proposal-note"
                rows={3}
                value={proposalNote}
                onChange={(event) => setProposalNote(event.target.value)}
                disabled={isSubmitting}
                placeholder="Đề xuất hướng xử lý."
                className={fieldTextareaClassName}
              />
            </div>
          </div>

          {validationMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-5 text-rose-700">
              {validationMessage}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={secondaryButtonClassName}
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={primaryButtonClassName}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSubmitting ? 'progress_activity' : 'history'}
            </span>
            {headerCaption.submit}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
