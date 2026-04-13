import React, { memo, useMemo } from 'react';
import {
  Attachment,
  ProjectProcedureStep,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  IssueStatus,
  ProcedureRaciEntry,
  ProcedureRaciRole,
  ProcedureStepRaciEntry,
} from '../../types';
import { computeEndDate } from '../../utils/procedureHelpers';
import { ProcedureAttachmentPanel } from './ProcedureAttachmentPanel';
import { ProcedureStepWorklogPanel } from './ProcedureStepWorklogPanel';

function formatDateValue(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleDateString('vi-VN');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_STATUS_OPTIONS: { value: ProcedureStepStatus; label: string; color: string }[] = [
  { value: 'CHUA_THUC_HIEN', label: 'Chưa TH',    color: 'text-slate-400' },
  { value: 'DANG_THUC_HIEN', label: 'Đang TH',    color: 'text-tertiary' },
  { value: 'HOAN_THANH',     label: 'Hoàn thành', color: 'text-success' },
];

const ROW_BG: Record<ProcedureStepStatus, string> = {
  HOAN_THANH:     'bg-success/5',
  DANG_THUC_HIEN: 'bg-warning/5',
  CHUA_THUC_HIEN: '',
};

const STEP_RACI_ROLE_ORDER: ProcedureRaciRole[] = ['A', 'R', 'C', 'I'];

const STEP_RACI_META: Record<ProcedureRaciRole, {
  full: string;
  badge: string;
  buttonFilled: string;
  buttonOutline: string;
}> = {
  R: {
    full: 'Responsible',
    badge: 'border-primary/25 bg-primary/8 text-primary',
    buttonFilled: 'border-primary/30 bg-primary/10 text-primary',
    buttonOutline: 'border-primary/20 bg-white text-primary/70 hover:bg-primary/5',
  },
  A: {
    full: 'Accountable',
    badge: 'border-deep-teal/25 bg-deep-teal/8 text-deep-teal',
    buttonFilled: 'border-deep-teal/30 bg-deep-teal/10 text-deep-teal',
    buttonOutline: 'border-deep-teal/20 bg-white text-deep-teal/70 hover:bg-deep-teal/5',
  },
  C: {
    full: 'Consulted',
    badge: 'border-tertiary/25 bg-tertiary/8 text-tertiary',
    buttonFilled: 'border-tertiary/30 bg-tertiary/10 text-tertiary',
    buttonOutline: 'border-tertiary/20 bg-white text-tertiary/70 hover:bg-tertiary/5',
  },
  I: {
    full: 'Informed',
    badge: 'border-neutral/20 bg-neutral/8 text-neutral',
    buttonFilled: 'border-neutral/25 bg-neutral/10 text-neutral',
    buttonOutline: 'border-neutral/15 bg-white text-neutral/70 hover:bg-neutral/5',
  },
};

const PROCEDURE_DATE_INPUT_BASE_CLASS =
  'h-9 w-[124px] min-w-[124px] max-w-[124px] rounded border text-xs outline-none [color-scheme:light] ' +
  '[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-0 ' +
  '[&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:min-h-[1rem]';

const PROCEDURE_DATE_INPUT_EDITABLE_CLASS =
  `${PROCEDURE_DATE_INPUT_BASE_CLASS} border-slate-200 bg-white px-2 pr-1.5 focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20`;

const PROCEDURE_DATE_INPUT_DISABLED_CLASS =
  `${PROCEDURE_DATE_INPUT_BASE_CLASS} border-slate-200 bg-slate-50 px-2 pr-1.5 text-slate-400 cursor-not-allowed`;

const PROCEDURE_CHILD_DATE_INPUT_BASE_CLASS =
  'h-9 w-[124px] min-w-[124px] max-w-[124px] rounded text-xs border outline-none [color-scheme:light] ' +
  '[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-0 ' +
  '[&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:min-h-[1rem]';

function getUserDisplayName(user: {
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  user_id?: string | number | null;
}): string {
  return String(user.full_name || user.user_code || user.username || user.user_id || 'Thành viên');
}

function getUserShortLabel(user: {
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  user_id?: string | number | null;
}): string {
  const fullName = String(user.full_name || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 10);
    return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join('');
  }
  if (user.user_code) return String(user.user_code).trim();
  if (user.username) return String(user.username).trim();
  return String(user.user_id || 'TV');
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepRowProps {
  // Data
  step: ProjectProcedureStep;
  draft: Record<string, any>;
  stepsInPhase: ProjectProcedureStep[]; // parent steps only, sorted — for reorder

  // Derived booleans (prevent re-render when shared state changes but not this row)
  isEditing: boolean;
  isExpanded: boolean;
  isWlogOpen: boolean;
  isAttachOpen: boolean;
  isAddingChild: boolean;
  isAddingChildSubmitting: boolean;
  hasChildren: boolean;

  // Auth (computed once in parent)
  isAdmin: boolean;
  isRaciA: boolean;
  myId: string;

  // Step RACI
  stepRaciEntries: ProcedureStepRaciEntry[];
  raciMembers: ProcedureRaciEntry[];

  // Per-step worklog state slices
  wlogs: ProcedureStepWorklog[];
  wlogInput: string;
  wlogHours: string;
  wlogDifficulty: string;
  wlogProposal: string;
  wlogIssueStatus: IssueStatus;
  wlogSaving: boolean;

  // Inline row edit
  editingRowDraft: { step_name: string; lead_unit: string; expected_result: string; duration_days: string };

  // Attachments
  attachList: Attachment[];
  attachLoading: boolean;
  attachUploading: boolean;

  // Child form
  newChildName: string;
  newChildUnit: string;
  newChildDays: string;
  newChildStartDate: string;
  newChildEndDate: string;
  newChildStatus: ProcedureStepStatus;

  // Worklog edit
  editingWorklogId: string | number | null;
  editWorklogContent: string;
  editWorklogHours: string;
  editWorklogDiff: string;
  editWorklogProposal: string;
  editWorklogStatus: IssueStatus;
  editWorklogSaving: boolean;

  // Stable callbacks
  onDraftChange: (id: string | number, field: string, value: string | null) => void;
  onStartDateChange: (step: ProjectProcedureStep, date: string | null) => void;
  onReorder: (step: ProjectProcedureStep, dir: 'up' | 'down') => void;
  onToggleDetail: (id: string | number) => void;
  onStartEditRow: (step: ProjectProcedureStep) => void;
  onCancelEditRow: () => void;
  onSaveEditRow: (step: ProjectProcedureStep) => void;
  onSetEditingRowDraft: React.Dispatch<React.SetStateAction<{ step_name: string; lead_unit: string; expected_result: string; duration_days: string }>>;
  onDeleteStep: (step: ProjectProcedureStep) => void;
  onOpenAttachments: (step: ProjectProcedureStep) => void;
  onUploadFile: (stepId: string | number, file: File) => void;
  onDeleteAttachment: (stepId: string | number, id: string) => void;
  onToggleWorklog: (id: string | number) => void;
  onAddWorklog: (id: string | number) => void;
  onAssignA: (stepId: string | number, userId: string | number) => void;
  onUpdateIssueStatus: (stepId: string | number, issueId: string | number, status: IssueStatus) => void;
  onStartEditWorklog: (log: ProcedureStepWorklog) => void;
  onCancelEditWorklog: () => void;
  onSaveEditWorklog: (stepId: string | number, logId: string | number) => void;
  onSetWlogInput: (stepId: string | number, val: string) => void;
  onSetWlogHours: (stepId: string | number, val: string) => void;
  onSetWlogDifficulty: (stepId: string | number, val: string) => void;
  onSetWlogProposal: (stepId: string | number, val: string) => void;
  onSetWlogIssueStatus: (stepId: string | number, val: IssueStatus) => void;
  onSetEditWorklogContent: React.Dispatch<React.SetStateAction<string>>;
  onSetEditWorklogHours: React.Dispatch<React.SetStateAction<string>>;
  onSetEditWorklogDiff: React.Dispatch<React.SetStateAction<string>>;
  onSetEditWorklogProposal: React.Dispatch<React.SetStateAction<string>>;
  onSetEditWorklogStatus: React.Dispatch<React.SetStateAction<IssueStatus>>;
  onToggleAddChild: (id: string | number) => void;
  onAddChildStep: (parent: ProjectProcedureStep) => void;
  onSetChildName: React.Dispatch<React.SetStateAction<string>>;
  onSetChildUnit: React.Dispatch<React.SetStateAction<string>>;
  onSetChildDays: React.Dispatch<React.SetStateAction<string>>;
  onSetChildStartDate: React.Dispatch<React.SetStateAction<string>>;
  onSetChildEndDate: React.Dispatch<React.SetStateAction<string>>;
  onSetChildStatus: React.Dispatch<React.SetStateAction<ProcedureStepStatus>>;
  onCancelChild: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StepRow = memo(function StepRow({
  step, draft, stepsInPhase,
  isEditing, isExpanded, isWlogOpen, isAttachOpen, isAddingChild, isAddingChildSubmitting, hasChildren,
  isAdmin, isRaciA, myId,
  stepRaciEntries,
  wlogs, wlogInput, wlogHours, wlogDifficulty, wlogProposal, wlogIssueStatus, wlogSaving,
  editingRowDraft,
  attachList, attachLoading, attachUploading,
  newChildName, newChildUnit, newChildDays, newChildStartDate, newChildEndDate, newChildStatus,
  editingWorklogId, editWorklogContent, editWorklogHours, editWorklogDiff,
  editWorklogProposal, editWorklogStatus, editWorklogSaving,
  onDraftChange, onStartDateChange, onReorder, onToggleDetail,
  onStartEditRow, onCancelEditRow, onSaveEditRow, onSetEditingRowDraft,
  onDeleteStep, onOpenAttachments, onUploadFile, onDeleteAttachment,
  onToggleWorklog, onAddWorklog, onUpdateIssueStatus,
  onStartEditWorklog, onCancelEditWorklog, onSaveEditWorklog,
  onSetWlogInput, onSetWlogHours, onSetWlogDifficulty, onSetWlogProposal, onSetWlogIssueStatus,
  onSetEditWorklogContent, onSetEditWorklogHours, onSetEditWorklogDiff,
  onSetEditWorklogProposal, onSetEditWorklogStatus,
  onToggleAddChild, onAddChildStep,
  onSetChildName, onSetChildUnit, onSetChildDays, onSetChildStartDate, onSetChildEndDate, onSetChildStatus, onCancelChild,
}: StepRowProps) {
  const isChild  = !!step.parent_step_id;
  const status   = (draft.progress_status ?? step.progress_status) as ProcedureStepStatus;
  const isCustom = !step.template_step_id;

  const worklogCount      = step.worklogs_count ?? wlogs.length;
  const blockingWlogCount = step.blocking_worklogs_count
    ?? wlogs.filter((log) => log.log_type !== 'CUSTOM').length;

  const isCreator = isCustom && !!myId && String(step.created_by) === myId;
  const canMutate = blockingWlogCount === 0 && (isAdmin || isRaciA || isCreator);
  const canDelete = canMutate && !hasChildren;
  const deleteBlockedReason = hasChildren
    ? 'Dòng này đang có bước con nên chưa thể xóa'
    : 'Xóa bước';
  const lockReason = blockingWlogCount > 0
    ? 'Đã có worklog nghiệp vụ — không thể sửa/xóa'
    : 'Chỉ admin, người A trong RACI hoặc người tạo bước tự thêm mới được sửa/xóa';

  const ri         = stepsInPhase.findIndex((s) => s.id === step.id);
  const attachCount = attachList.length;

  // Đến ngày
  const days        = step.duration_days;
  const hasAutoCalc = !!days && days > 0;
  const startVal    = draft.actual_start_date ?? step.actual_start_date ?? null;
  const autoEnd     = hasAutoCalc ? computeEndDate(startVal, days) : null;
  const endDisplay  = autoEnd ?? (draft.actual_end_date ?? step.actual_end_date ?? '');
  const documentNumber = (Object.prototype.hasOwnProperty.call(draft, 'document_number')
    ? draft.document_number
    : step.document_number) ?? '';
  const documentDate = (Object.prototype.hasOwnProperty.call(draft, 'document_date')
    ? draft.document_date
    : step.document_date) ?? '';
  const normalizedDocumentNumber = String(documentNumber).trim();
  const hasDocument = normalizedDocumentNumber.length > 0;
  const documentTitle = hasDocument
    ? `Số VB: ${normalizedDocumentNumber}${documentDate ? ` · Ngày: ${formatDateValue(String(documentDate))}` : ''}`
    : 'Chưa có văn bản. Mở File để nhập thông tin văn bản.';
  const attachmentTitle = `${documentTitle} · ${attachCount} file đính kèm`;

  const sortedStepRaciEntries = useMemo(() =>
    [...stepRaciEntries].sort((a, b) => {
      const roleDiff = STEP_RACI_ROLE_ORDER.indexOf(a.raci_role) - STEP_RACI_ROLE_ORDER.indexOf(b.raci_role);
      if (roleDiff !== 0) return roleDiff;
      return getUserDisplayName(a).localeCompare(getUserDisplayName(b), 'vi');
    }),
  [stepRaciEntries]);

  const parentStart = startVal;
  const parentEnd = endDisplay || null;
  const parsedChildDays = Number.parseInt(newChildDays, 10);
  const childDurationDays = Number.isNaN(parsedChildDays) ? 0 : parsedChildDays;
  const isChildEndAutoCalc = childDurationDays > 0 && !!newChildStartDate;
  const effectiveNewChildEndDate = isChildEndAutoCalc
    ? (computeEndDate(newChildStartDate, childDurationDays) ?? '')
    : newChildEndDate;
  const childDateError = (() => {
    if (newChildStartDate && effectiveNewChildEndDate && effectiveNewChildEndDate < newChildStartDate) {
      return 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.';
    }
    if (newChildStartDate && parentStart && newChildStartDate < parentStart) {
      return `Từ ngày bước con không được trước bước cha (${formatDateValue(parentStart)}).`;
    }
    if (newChildStartDate && parentEnd && newChildStartDate > parentEnd) {
      return `Từ ngày bước con không được sau bước cha (${formatDateValue(parentEnd)}).`;
    }
    if (effectiveNewChildEndDate && parentStart && effectiveNewChildEndDate < parentStart) {
      return `Đến ngày bước con không được trước bước cha (${formatDateValue(parentStart)}).`;
    }
    if (effectiveNewChildEndDate && parentEnd && effectiveNewChildEndDate > parentEnd) {
      return `Đến ngày bước con không được sau bước cha (${formatDateValue(parentEnd)}).`;
    }
    return '';
  })();
  const childRangeHint = parentStart || parentEnd
    ? `Khoảng ngày bước cha: ${parentStart ? formatDateValue(parentStart) : '…'} → ${parentEnd ? formatDateValue(parentEnd) : '…'}`
    : '';
  const handleChildStartDateChange = (value: string) => {
    onSetChildStartDate(value);
    if (!value) {
      onSetChildEndDate('');
      return;
    }
    if (childDurationDays > 0) {
      onSetChildEndDate(computeEndDate(value, childDurationDays) ?? '');
    }
  };
  const handleChildDaysChange = (value: string) => {
    onSetChildDays(value);
    const nextDays = Number.parseInt(value, 10);
    if (!Number.isNaN(nextDays) && nextDays > 0 && newChildStartDate) {
      onSetChildEndDate(computeEndDate(newChildStartDate, nextDays) ?? '');
    }
  };
  const handleSubmitChild = () => {
    if (!newChildName.trim() || isAddingChildSubmitting || childDateError) return;
    onAddChildStep(step);
  };

  return (
    <React.Fragment>
      <tr data-testid={`step-row-${step.id}`} className={`transition-colors ${isEditing ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : `hover:bg-slate-50/60 ${ROW_BG[status]}`}`}>

        {/* ▲/▼ Reorder */}
        <td className="px-1 py-1">
          {!isChild && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onReorder(step, 'up')}
                disabled={ri === 0}
                className="p-0.5 text-slate-200 hover:text-deep-teal disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Di chuyển lên"
              >
                <span className="material-symbols-outlined leading-none" style={{ fontSize: 18 }}>arrow_drop_up</span>
              </button>
              <button
                type="button"
                onClick={() => onReorder(step, 'down')}
                disabled={ri === stepsInPhase.length - 1}
                className="p-0.5 text-slate-200 hover:text-deep-teal disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Di chuyển xuống"
              >
                <span className="material-symbols-outlined leading-none" style={{ fontSize: 18 }}>arrow_drop_down</span>
              </button>
            </div>
          )}
        </td>

        {/* TT */}
        <td className="px-3 py-2 text-xs font-mono text-slate-400 text-center">
          {isChild ? <span className="text-slate-300">└</span> : step.step_number}
        </td>

        {/* Tên bước */}
        <td className="px-3 py-2 text-sm text-slate-800" style={{ paddingLeft: isChild ? '28px' : '12px' }}>
          {isEditing ? (
            <input
              autoFocus
              value={editingRowDraft.step_name}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, step_name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); if (e.key === 'Enter') onSaveEditRow(step); }}
              className="w-full px-2 py-1 text-sm rounded border border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          ) : (
            <div className="min-w-0">
              <div className="flex items-start gap-1 flex-wrap group">
                {step.step_detail && (
                  <button type="button" onClick={() => onToggleDetail(step.id)} className="p-0 text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-xs">{isExpanded ? 'expand_more' : 'chevron_right'}</span>
                  </button>
                )}
                <span
                  className={`${isChild ? 'text-slate-600 text-xs' : 'font-medium'} ${canMutate ? 'cursor-pointer hover:text-primary hover:underline decoration-dotted underline-offset-2 transition-colors' : ''}`}
                  onClick={() => canMutate && onStartEditRow(step)}
                  title={canMutate ? 'Click để sửa' : lockReason}
                >
                  {step.step_name}
                </span>
                {isCustom && (
                  <span className="px-1 py-0.5 rounded text-[9px] bg-primary/8 text-primary font-semibold shrink-0">TỰ THÊM</span>
                )}
                {canMutate ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStartEditRow(step); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-primary transition-all shrink-0"
                    title="Sửa bước"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                  </button>
                ) : (
                  <span className="material-symbols-outlined text-[10px] text-slate-300 mt-0.5 shrink-0" title={lockReason}>lock</span>
                )}
              </div>

              {!isChild && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {sortedStepRaciEntries.map((entry) => (
                    <span
                      key={entry.id}
                      data-testid={`step-raci-badge-${step.id}-${entry.raci_role}-${entry.user_id}`}
                      title={`${getUserDisplayName(entry)} — ${STEP_RACI_META[entry.raci_role].full}`}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STEP_RACI_META[entry.raci_role].badge}`}
                    >
                      <span className="font-black">{entry.raci_role}</span>
                      <span className="max-w-[60px] truncate">{getUserShortLabel(entry)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isEditing && isExpanded && step.step_detail && (
            <div className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 border border-slate-100">{step.step_detail}</div>
          )}
        </td>

        {/* ĐV chủ trì */}
        <td className="px-3 py-2 text-xs text-slate-600">
          {isEditing ? (
            <input
              value={editingRowDraft.lead_unit}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, lead_unit: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); }}
              className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              placeholder="ĐV chủ trì..."
            />
          ) : (
            <span className="line-clamp-2">{step.lead_unit || '—'}</span>
          )}
        </td>

        {/* Kết quả dự kiến */}
        <td className="px-3 py-2 text-xs text-slate-600">
          {isEditing ? (
            <textarea
              value={editingRowDraft.expected_result}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, expected_result: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); }}
              rows={2}
              className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none"
              placeholder="Kết quả dự kiến..."
            />
          ) : (
            <span className="line-clamp-2">{step.expected_result || '—'}</span>
          )}
        </td>

        {/* Ngày */}
        <td className="px-3 py-2 text-xs text-slate-400 text-center">
          {isEditing ? (
            <input
              type="number" min={0}
              value={editingRowDraft.duration_days}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, duration_days: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); }}
              className="w-16 px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-center"
            />
          ) : (
            step.duration_days || 0
          )}
        </td>

        {/* Từ ngày */}
        <td className="px-2 py-2">
          <div className="flex items-center justify-center">
            <input
              type="date"
              value={draft.actual_start_date ?? step.actual_start_date ?? ''}
              onChange={(e) => onStartDateChange(step, e.target.value || null)}
              data-testid={`step-start-date-${step.id}`}
              className={PROCEDURE_DATE_INPUT_EDITABLE_CLASS}
            />
          </div>
        </td>

        {/* Đến ngày */}
        <td className="px-2 py-2">
          <div className="flex items-center justify-center">
            <input
              type="date"
              value={endDisplay}
              readOnly={hasAutoCalc}
              tabIndex={hasAutoCalc ? -1 : 0}
              data-testid={`step-end-date-${step.id}`}
              onChange={hasAutoCalc ? undefined : (e) => onDraftChange(step.id, 'actual_end_date', e.target.value || null)}
              title={hasAutoCalc ? `Tự tính: Từ ngày + ${days} - 1 ngày` : undefined}
              className={hasAutoCalc ? PROCEDURE_DATE_INPUT_DISABLED_CLASS : PROCEDURE_DATE_INPUT_EDITABLE_CLASS}
            />
          </div>
        </td>

        {/* Tiến độ */}
        <td className="px-3 py-2">
          <select
            value={status}
            onChange={(e) => onDraftChange(step.id, 'progress_status', e.target.value)}
            data-testid={`step-progress-${step.id}`}
            className={`w-full px-2 py-1 rounded text-xs font-medium border border-slate-200 bg-white cursor-pointer ${STEP_STATUS_OPTIONS.find((o) => o.value === status)?.color || ''}`}
          >
            {STEP_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </td>

        {/* Worklog */}
        <td className="px-3 py-2">
          <button
            onClick={() => onToggleWorklog(step.id)}
            data-testid={`step-worklog-trigger-${step.id}`}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors w-full ${
              isWlogOpen ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500 hover:bg-primary/8 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
            <span>{`Worklog(${worklogCount})`}</span>
            <span className="material-symbols-outlined ml-auto" style={{ fontSize: 12 }}>{isWlogOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* File đính kèm */}
        <td className="px-3 py-2">
          <button
            onClick={() => onOpenAttachments(step)}
            data-testid={`step-file-trigger-${step.id}`}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-colors w-full ${
              isAttachOpen ? 'bg-tertiary/10 text-tertiary' : 'bg-slate-100 text-slate-500 hover:bg-tertiary/8 hover:text-tertiary'
            }`}
            title={attachmentTitle}
          >
            {attachLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
              : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>
            }
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className={`truncate ${hasDocument ? 'font-semibold' : 'text-slate-400'}`}>
                {hasDocument ? normalizedDocumentNumber : 'Thêm VB'}
              </div>
              <div className="text-[10px] opacity-70">
                {attachCount} file
              </div>
            </div>
            <span className="material-symbols-outlined ml-auto" style={{ fontSize: 12 }}>{isAttachOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* Actions */}
        <td className="px-2 py-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onSaveEditRow(step)} className="p-1 text-success hover:text-success/80 transition-colors" title="Lưu">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
              </button>
              <button onClick={onCancelEditRow} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title="Hủy">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          ) : canMutate ? (
            <div className="flex items-center gap-0.5">
              {!isChild && (
                <button
                  onClick={() => onToggleAddChild(step.id)}
                  className={`p-1 transition-colors ${isAddingChild ? 'text-primary' : 'text-slate-300 hover:text-primary'}`}
                  title="Thêm bước con"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>subdirectory_arrow_right</span>
                </button>
              )}
              <button
                onClick={() => canDelete && onDeleteStep(step)}
                disabled={!canDelete}
                className="p-1 text-slate-300 hover:text-error disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title={deleteBlockedReason}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {/* ── Worklog panel ── */}
      {isWlogOpen && (
        <ProcedureStepWorklogPanel
          stepId={step.id}
          wlogs={wlogs}
          wlogInput={wlogInput}
          wlogHours={wlogHours}
          wlogDifficulty={wlogDifficulty}
          wlogProposal={wlogProposal}
          wlogIssueStatus={wlogIssueStatus}
          wlogSaving={wlogSaving}
          editingWorklogId={editingWorklogId}
          editWorklogContent={editWorklogContent}
          editWorklogHours={editWorklogHours}
          editWorklogDiff={editWorklogDiff}
          editWorklogProposal={editWorklogProposal}
          editWorklogStatus={editWorklogStatus}
          editWorklogSaving={editWorklogSaving}
          onAddWorklog={() => onAddWorklog(step.id)}
          onUpdateIssueStatus={(issueId, status) => onUpdateIssueStatus(step.id, issueId, status)}
          onStartEditWorklog={onStartEditWorklog}
          onCancelEditWorklog={onCancelEditWorklog}
          onSaveEditWorklog={(logId) => onSaveEditWorklog(step.id, logId)}
          onSetWlogInput={(value) => onSetWlogInput(step.id, value)}
          onSetWlogHours={(value) => onSetWlogHours(step.id, value)}
          onSetWlogDifficulty={(value) => onSetWlogDifficulty(step.id, value)}
          onSetWlogProposal={(value) => onSetWlogProposal(step.id, value)}
          onSetWlogIssueStatus={(value) => onSetWlogIssueStatus(step.id, value)}
          onSetEditWorklogContent={onSetEditWorklogContent}
          onSetEditWorklogHours={onSetEditWorklogHours}
          onSetEditWorklogDiff={onSetEditWorklogDiff}
          onSetEditWorklogProposal={onSetEditWorklogProposal}
          onSetEditWorklogStatus={onSetEditWorklogStatus}
        />
      )}

      {/* ── Attachment panel ── */}
      {isAttachOpen && (
        <ProcedureAttachmentPanel
          stepId={step.id}
          documentNumber={String(documentNumber)}
          documentDate={String(documentDate)}
          hasDocument={hasDocument}
          attachList={attachList}
          attachUploading={attachUploading}
          onDocumentNumberChange={(value) => onDraftChange(step.id, 'document_number', value)}
          onDocumentDateChange={(value) => onDraftChange(step.id, 'document_date', value)}
          onUploadFile={(file) => onUploadFile(step.id, file)}
          onDeleteAttachment={(id) => onDeleteAttachment(step.id, id)}
        />
      )}

      {/* ── Add child form ── */}
      {!isChild && isAddingChild && (
        <tr className="bg-primary/3 border-t border-primary/15">
          <td />
          <td className="px-3 py-2 text-center text-primary/60 font-mono text-xs select-none">└+</td>
          <td />
          <td className="px-2 py-2" style={{ paddingLeft: '28px' }}>
            <input
              autoFocus type="text"
              value={newChildName}
              disabled={isAddingChildSubmitting}
              onChange={(e) => onSetChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isAddingChildSubmitting && newChildName.trim() && !childDateError) handleSubmitChild();
                if (e.key === 'Escape' && !isAddingChildSubmitting) onCancelChild();
              }}
              placeholder="Tên bước con..."
              className="w-full px-2.5 py-1.5 rounded text-xs border border-primary/30 bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-medium placeholder:text-slate-300"
            />
          </td>
          <td className="px-2 py-2">
            <input
              type="text"
              value={newChildUnit}
              disabled={isAddingChildSubmitting}
              onChange={(e) => onSetChildUnit(e.target.value)}
              placeholder="ĐV chủ trì..."
              className="w-full px-2 py-1.5 rounded text-xs border border-primary/20 bg-white focus:border-primary/50 outline-none placeholder:text-slate-300"
            />
          </td>
          <td />
          <td className="px-2 py-2 min-w-[88px]">
            <input
              type="number"
              value={newChildDays}
              disabled={isAddingChildSubmitting}
              onChange={(e) => handleChildDaysChange(e.target.value)}
              placeholder="Số ngày"
              min="0"
              className="w-full min-w-[88px] px-2.5 py-1.5 rounded text-xs font-medium border border-primary/20 bg-white focus:border-primary/50 outline-none text-center placeholder:text-slate-300"
            />
          </td>
          <td className="px-2 py-2">
            <div className="flex items-center justify-center">
              <input
                type="date"
                value={newChildStartDate}
                disabled={isAddingChildSubmitting}
                min={parentStart || undefined}
                max={parentEnd || undefined}
                onChange={(e) => handleChildStartDateChange(e.target.value)}
                data-testid={`step-child-start-date-${step.id}`}
                className={`${PROCEDURE_CHILD_DATE_INPUT_BASE_CLASS} px-2 pr-1.5 ${
                  childDateError && newChildStartDate
                    ? 'border-error/40 bg-error/5 focus:border-error/50'
                    : 'border-primary/20 bg-white focus:border-primary/50'
                }`}
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="flex items-center justify-center">
              <input
                type="date"
                value={effectiveNewChildEndDate}
                disabled={isAddingChildSubmitting || isChildEndAutoCalc}
                readOnly={isChildEndAutoCalc}
                tabIndex={isChildEndAutoCalc ? -1 : 0}
                min={newChildStartDate || parentStart || undefined}
                max={parentEnd || undefined}
                onChange={isChildEndAutoCalc ? undefined : (e) => onSetChildEndDate(e.target.value)}
                data-testid={`step-child-end-date-${step.id}`}
                title={isChildEndAutoCalc ? `Tự tính: Từ ngày + ${childDurationDays} - 1 ngày` : undefined}
                className={`${PROCEDURE_CHILD_DATE_INPUT_BASE_CLASS} px-2 pr-1.5 ${
                  isChildEndAutoCalc
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : childDateError && effectiveNewChildEndDate
                      ? 'border-error/40 bg-error/5 focus:border-error/50'
                      : 'border-primary/20 bg-white focus:border-primary/50'
                }`}
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <select
              value={newChildStatus}
              disabled={isAddingChildSubmitting}
              onChange={(e) => onSetChildStatus(e.target.value as ProcedureStepStatus)}
              data-testid={`step-child-progress-${step.id}`}
              className="w-full px-2 py-1.5 rounded text-xs border border-primary/20 bg-white focus:border-primary/50 outline-none"
            >
              {STEP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </td>
          <td colSpan={3} className="px-3 py-2">
            <div className="flex flex-col gap-1.5">
              {childRangeHint ? (
                <div className="flex items-center gap-1 text-[10px] text-deep-teal">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
                  <span>{childRangeHint}</span>
                </div>
              ) : null}
              {childDateError ? (
                <div className="text-[10px] font-medium text-error">{childDateError}</div>
              ) : null}
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitChild}
                disabled={!newChildName.trim() || isAddingChildSubmitting || !!childDateError}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAddingChildSubmitting ? 'Đang thêm...' : 'Thêm'}
              </button>
              <button
                type="button"
                onClick={onCancelChild}
                disabled={isAddingChildSubmitting}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});
