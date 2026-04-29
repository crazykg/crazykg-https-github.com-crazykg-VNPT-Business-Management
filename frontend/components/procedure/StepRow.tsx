import React, { memo } from 'react';
import {
  Attachment,
  ProjectProcedureStep,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  IssueStatus,
} from '../../types';
import { computeDurationDays, computeEndDate, computeStartDate } from '../../utils/procedureHelpers';
import { ProjectDateInput } from '../project/ProjectDateInput';
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
  { value: 'CHUA_THUC_HIEN', label: 'Chưa TH',    color: 'text-slate-600' },
  { value: 'DANG_THUC_HIEN', label: 'Đang TH',    color: 'text-tertiary' },
  { value: 'HOAN_THANH',     label: 'Hoàn thành', color: 'text-[var(--ui-success-fg)]' },
];

const ROW_BG: Record<ProcedureStepStatus, string> = {
  HOAN_THANH:     'bg-emerald-50',
  DANG_THUC_HIEN: 'bg-amber-50',
  CHUA_THUC_HIEN: '',
};

const ACTION_CELL_BASE_CLASS =
  'sticky right-0 z-10 border-l border-slate-300 bg-slate-50/95 px-0 py-2 text-center align-middle shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)] transition-colors';

const ACTION_BUTTON_BASE_CLASS =
  'inline-flex h-8 w-6 items-center justify-center rounded text-slate-700 transition-colors hover:bg-white hover:text-primary focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-500 disabled:opacity-100';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepRowProps {
  // Data
  step: ProjectProcedureStep;
  displayNumber: string;
  datePlaceholder: string;
  draft: Record<string, any>;
  stepsInScope: ProjectProcedureStep[]; // parents in phase or children under the same parent, sorted for reorder

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
  deletingWorklogId: string | number | null;

  // Stable callbacks
  onDraftChange: (id: string | number, field: string, value: string | null) => void;
  onStartDateChange: (step: ProjectProcedureStep, date: string | null) => void;
  onEndDateChange: (step: ProjectProcedureStep, date: string | null) => void;
  onDateRangeBlur: (step: ProjectProcedureStep, field: 'start' | 'end') => void;
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
  onUpdateIssueStatus: (stepId: string | number, issueId: string | number, status: IssueStatus) => void;
  onStartEditWorklog: (log: ProcedureStepWorklog) => void;
  onCancelEditWorklog: () => void;
  onSaveEditWorklog: (stepId: string | number, logId: string | number) => void;
  onDeleteWorklog: (stepId: string | number, log: ProcedureStepWorklog) => void;
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
  step, displayNumber, datePlaceholder, draft, stepsInScope,
  isEditing, isExpanded, isWlogOpen, isAttachOpen, isAddingChild, isAddingChildSubmitting, hasChildren,
  isAdmin, isRaciA, myId,
  wlogs, wlogInput, wlogHours, wlogDifficulty, wlogProposal, wlogIssueStatus, wlogSaving,
  editingRowDraft,
  attachList, attachLoading, attachUploading,
  newChildName, newChildUnit, newChildDays, newChildStartDate, newChildEndDate, newChildStatus,
  editingWorklogId, editWorklogContent, editWorklogHours, editWorklogDiff,
  editWorklogProposal, editWorklogStatus, editWorklogSaving, deletingWorklogId,
  onDraftChange, onStartDateChange, onEndDateChange, onDateRangeBlur, onReorder, onToggleDetail,
  onStartEditRow, onCancelEditRow, onSaveEditRow, onSetEditingRowDraft,
  onDeleteStep, onOpenAttachments, onUploadFile, onDeleteAttachment,
  onToggleWorklog, onAddWorklog, onUpdateIssueStatus,
  onStartEditWorklog, onCancelEditWorklog, onSaveEditWorklog, onDeleteWorklog,
  onSetWlogInput, onSetWlogHours, onSetWlogDifficulty, onSetWlogProposal, onSetWlogIssueStatus,
  onSetEditWorklogContent, onSetEditWorklogHours, onSetEditWorklogDiff,
  onSetEditWorklogProposal, onSetEditWorklogStatus,
  onToggleAddChild, onAddChildStep,
  onSetChildName, onSetChildUnit, onSetChildDays, onSetChildStartDate, onSetChildEndDate, onSetChildStatus, onCancelChild,
}: StepRowProps) {
  const isChild  = !!step.parent_step_id;
  const status   = (draft.progress_status ?? step.progress_status) as ProcedureStepStatus;
  const isCustom = !step.template_step_id;
  const countableWlogs = wlogs.filter((log) => log.log_type !== 'CUSTOM' && log.content.trim().length > 0);

  const worklogCount      = step.worklogs_count ?? countableWlogs.length;
  const blockingWlogCount = step.blocking_worklogs_count
    ?? countableWlogs.length;

  const isCreator = isCustom && !!myId && String(step.created_by) === myId;
  const canMutate = blockingWlogCount === 0 && (isAdmin || isRaciA || isCreator);
  const canDelete = canMutate && !hasChildren;
  const deleteBlockedReason = hasChildren
    ? 'Dòng này đang có bước con nên chưa thể xóa'
    : 'Xóa bước';
  const lockReason = blockingWlogCount > 0
    ? 'Đã có worklog nghiệp vụ — không thể sửa/xóa'
    : 'Chỉ admin, người A trong RACI hoặc người tạo bước tự thêm mới được sửa/xóa';
  const actionCellClassName = `${ACTION_CELL_BASE_CLASS} ${
    isEditing ? 'bg-primary/8' : 'group-hover/step-row:bg-slate-100'
  }`;

  const ri         = stepsInScope.findIndex((s) => s.id === step.id);
  const attachCount = attachList.length;

  // Đến ngày
  const parsedDays = Number(draft.duration_days ?? step.duration_days ?? 0);
  const days        = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 0;
  const startDisplay = draft.actual_start_date ?? step.actual_start_date ?? '';
  const startVal    = startDisplay || null;
  const autoEnd     = days > 0 ? computeEndDate(startVal, days) : null;
  const endDisplay  = autoEnd ?? (draft.actual_end_date ?? step.actual_end_date ?? '');
  const hasAutoCalc = !!startVal && days > 0 && !!autoEnd;
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
  const readableStepName = displayNumber ? `bước ${displayNumber} ${step.step_name}` : `bước ${step.step_name}`;
  const worklogPanelId = `step-worklog-panel-${step.id}`;
  const filePanelId = `step-file-panel-${step.id}`;
  const saveButtonLabel = `Lưu thay đổi ${readableStepName}`;
  const cancelButtonLabel = `Hủy sửa ${readableStepName}`;
  const addChildButtonLabel = `Thêm bước con cho ${readableStepName}`;
  const deleteButtonLabel = canDelete
    ? `Xóa ${readableStepName}`
    : `${deleteBlockedReason}: ${readableStepName}`;
  const worklogButtonLabel = `${isWlogOpen ? 'Đóng' : 'Mở'} worklog của ${readableStepName}: ${worklogCount} mục`;
  const fileDocumentLabel = hasDocument
    ? `, số văn bản ${normalizedDocumentNumber}${documentDate ? ` ngày ${formatDateValue(String(documentDate))}` : ''}`
    : ', chưa có số văn bản';
  const fileButtonLabel = `${isAttachOpen ? 'Đóng' : 'Mở'} file văn bản của ${readableStepName}: ${attachCount} file đính kèm${fileDocumentLabel}`;

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
      return;
    }
    if (effectiveNewChildEndDate) {
      const inferredDays = computeDurationDays(value, effectiveNewChildEndDate);
      onSetChildDays(String(inferredDays ?? 0));
      if (!inferredDays) onSetChildEndDate(effectiveNewChildEndDate);
      return;
    }
    if (childDurationDays > 0) {
      onSetChildEndDate(computeEndDate(value, childDurationDays) ?? '');
    }
  };
  const handleChildDaysChange = (value: string) => {
    onSetChildDays(value);
    const nextDays = Number.parseInt(value, 10);
    if (Number.isNaN(nextDays) || nextDays <= 0) return;
    if (effectiveNewChildEndDate) {
      onSetChildStartDate(computeStartDate(effectiveNewChildEndDate, nextDays) ?? newChildStartDate);
      return;
    }
    if (newChildStartDate) {
      onSetChildEndDate(computeEndDate(newChildStartDate, nextDays) ?? '');
    }
  };
  const handleChildEndDateChange = (value: string) => {
    onSetChildEndDate(value);
    if (!value) return;
    if (newChildStartDate) {
      const inferredDays = computeDurationDays(newChildStartDate, value);
      onSetChildDays(String(inferredDays ?? 0));
      return;
    }
    if (childDurationDays > 0) {
      onSetChildStartDate(computeStartDate(value, childDurationDays) ?? newChildStartDate);
    }
  };
  const handleSubmitChild = () => {
    if (!newChildName.trim() || isAddingChildSubmitting || childDateError) return;
    onAddChildStep(step);
  };

  return (
    <React.Fragment>
      <tr data-testid={`step-row-${step.id}`} className={`group/step-row transition-colors ${isEditing ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : `hover:bg-slate-50/60 ${ROW_BG[status]}`}`}>

        {/* ▲/▼ Reorder */}
        <td className="px-1 py-1">
          {stepsInScope.length > 1 && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onReorder(step, 'up')}
                disabled={ri === 0}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-60"
                title={isChild ? 'Di chuyển bước con lên trong cùng bước cha' : 'Di chuyển bước cha lên'}
                aria-label={isChild ? `Di chuyển bước con ${step.step_name} lên trong cùng bước cha` : `Di chuyển bước cha ${step.step_name} lên`}
                data-testid={`step-reorder-up-${step.id}`}
              >
                <span className="material-symbols-outlined leading-none" style={{ fontSize: 18 }}>arrow_drop_up</span>
              </button>
              <button
                type="button"
                onClick={() => onReorder(step, 'down')}
                disabled={ri === stepsInScope.length - 1}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-600 transition-colors hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-60"
                title={isChild ? 'Di chuyển bước con xuống trong cùng bước cha' : 'Di chuyển bước cha xuống'}
                aria-label={isChild ? `Di chuyển bước con ${step.step_name} xuống trong cùng bước cha` : `Di chuyển bước cha ${step.step_name} xuống`}
                data-testid={`step-reorder-down-${step.id}`}
              >
                <span className="material-symbols-outlined leading-none" style={{ fontSize: 18 }}>arrow_drop_down</span>
              </button>
            </div>
          )}
        </td>

        {/* TT */}
        <td className="px-3 py-2 text-xs font-mono text-slate-600 text-center">
          <span data-testid={`step-display-number-${step.id}`}>{displayNumber}</span>
        </td>

        {/* Tên bước */}
        <td className="px-3 py-2 text-sm text-slate-800" style={{ paddingLeft: isChild ? '28px' : '12px' }}>
          {isEditing ? (
            <input
              autoFocus
              value={editingRowDraft.step_name}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, step_name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); if (e.key === 'Enter') onSaveEditRow(step); }}
              className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
            />
          ) : (
            <div className="min-w-0">
              <div className="flex items-start gap-1 flex-wrap group">
                {step.step_detail && (
                  <button type="button" onClick={() => onToggleDetail(step.id)} className="p-0 text-slate-600 hover:text-primary shrink-0 mt-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20">
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
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-primary transition-all shrink-0 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-primary/20"
                    title="Sửa bước"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                  </button>
                ) : (
                  <span className="material-symbols-outlined text-[10px] text-slate-500 mt-0.5 shrink-0" title={lockReason}>lock</span>
                )}
              </div>

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
              className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
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
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none resize-none placeholder:text-slate-500 focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
              placeholder="Kết quả dự kiến..."
            />
          ) : (
            <span className="line-clamp-2">{step.expected_result || '—'}</span>
          )}
        </td>

        {/* Ngày */}
        <td className="px-3 py-2 text-xs text-slate-600 text-center">
          {isEditing ? (
            <input
              type="number" min={0}
              value={editingRowDraft.duration_days}
              onChange={(e) => onSetEditingRowDraft((p) => ({ ...p, duration_days: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditRow(); }}
              className="h-8 w-20 rounded border border-slate-300 bg-white px-2.5 text-sm outline-none text-center focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
            />
          ) : (
            days || 0
          )}
        </td>

        {/* Từ ngày */}
        <td className="px-2 py-2">
          <div className="relative flex items-center justify-center">
            <ProjectDateInput
              value={startDisplay}
              onChange={(nextDate) => onStartDateChange(step, nextDate)}
              onBlur={() => onDateRangeBlur(step, 'start')}
              placeholder={datePlaceholder}
              ariaLabel={`Từ ngày của bước ${step.step_name}`}
              testId={`step-start-date-${step.id}`}
            />
          </div>
        </td>

        {/* Đến ngày */}
        <td className="px-2 py-2">
          <div className="relative flex items-center justify-center">
            <ProjectDateInput
              value={endDisplay}
              onChange={(nextDate) => onEndDateChange(step, nextDate)}
              onBlur={() => onDateRangeBlur(step, 'end')}
              placeholder={datePlaceholder}
              ariaLabel={`Đến ngày của bước ${step.step_name}`}
              testId={`step-end-date-${step.id}`}
              title={hasAutoCalc ? `Tự tính: Từ ngày + ${days} - 1 ngày. Có thể nhập Đến ngày để suy ra Từ ngày.` : undefined}
            />
          </div>
        </td>

        {/* Tiến độ */}
        <td className="px-2 py-2">
          <select
            value={status}
            onChange={(e) => onDraftChange(step.id, 'progress_status', e.target.value)}
            data-testid={`step-progress-${step.id}`}
            className={`h-8 w-full min-w-[112px] rounded border border-slate-300 bg-white px-2.5 pr-7 text-sm font-medium cursor-pointer outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/15 ${STEP_STATUS_OPTIONS.find((o) => o.value === status)?.color || ''}`}
          >
            {STEP_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </td>

        {/* Worklog */}
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={() => onToggleWorklog(step.id)}
            data-testid={`step-worklog-trigger-${step.id}`}
            aria-expanded={isWlogOpen}
            aria-controls={worklogPanelId}
            aria-label={worklogButtonLabel}
            title={worklogButtonLabel}
            className={`flex h-8 w-full min-w-[124px] items-center gap-1 rounded border bg-white px-2.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isWlogOpen ? 'border-primary/70 bg-primary/10 text-primary' : 'border-slate-300 text-slate-700 hover:border-primary/40 hover:bg-primary/8 hover:text-primary'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
            <span aria-live="polite">{`Worklog (${worklogCount})`}</span>
            <span aria-hidden="true" className="material-symbols-outlined ml-auto" style={{ fontSize: 12 }}>{isWlogOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* File đính kèm */}
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={() => onOpenAttachments(step)}
            data-testid={`step-file-trigger-${step.id}`}
            aria-expanded={isAttachOpen}
            aria-controls={filePanelId}
            aria-label={fileButtonLabel}
            aria-busy={attachLoading || attachUploading}
            className={`flex h-8 w-full min-w-[100px] items-center gap-1 rounded border bg-white px-2.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isAttachOpen ? 'border-amber-900/70 bg-amber-50 text-amber-900' : 'border-slate-300 text-slate-700 hover:border-amber-900/40 hover:bg-amber-50 hover:text-amber-900'
            }`}
            title={attachmentTitle}
          >
            {attachLoading
              ? <span aria-hidden="true" className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
              : <span aria-hidden="true" className="material-symbols-outlined text-amber-900" style={{ fontSize: 15 }}>add</span>
            }
            <span aria-live="polite" className={`min-w-0 flex-1 truncate text-left ${hasDocument ? 'font-semibold' : ''}`}>
              VB ({attachCount})
            </span>
            <span aria-hidden="true" className="material-symbols-outlined ml-auto" style={{ fontSize: 12 }}>{isAttachOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* Actions */}
        <td className={actionCellClassName}>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => onSaveEditRow(step)}
                className={`${ACTION_BUTTON_BASE_CLASS} text-[var(--ui-success-fg)] hover:bg-emerald-50 hover:text-emerald-800`}
                aria-label={saveButtonLabel}
              >
                <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
              </button>
              <button
                type="button"
                onClick={onCancelEditRow}
                className={`${ACTION_BUTTON_BASE_CLASS} hover:text-slate-800`}
                aria-label={cancelButtonLabel}
              >
                <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          ) : canMutate ? (
            <div className="flex items-center justify-center gap-0.5">
              {!isChild && (
                <button
                  type="button"
                  onClick={() => onToggleAddChild(step.id)}
                  className={`${ACTION_BUTTON_BASE_CLASS} ${isAddingChild ? 'bg-primary/10 text-primary' : ''}`}
                  aria-label={addChildButtonLabel}
                  aria-pressed={isAddingChild}
                >
                  <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>subdirectory_arrow_right</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => canDelete && onDeleteStep(step)}
                disabled={!canDelete}
                className={`${ACTION_BUTTON_BASE_CLASS} hover:bg-rose-50 hover:text-error`}
                aria-label={deleteButtonLabel}
              >
                <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
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
          deletingWorklogId={deletingWorklogId}
          isAdmin={isAdmin}
          isRaciA={isRaciA}
          myId={myId}
          onAddWorklog={() => onAddWorklog(step.id)}
          onUpdateIssueStatus={(issueId, status) => onUpdateIssueStatus(step.id, issueId, status)}
          onStartEditWorklog={onStartEditWorklog}
          onCancelEditWorklog={onCancelEditWorklog}
          onSaveEditWorklog={(logId) => onSaveEditWorklog(step.id, logId)}
          onDeleteWorklog={(log) => onDeleteWorklog(step.id, log)}
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
              className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none font-medium placeholder:text-slate-500"
            />
          </td>
          <td className="px-2 py-2">
            <input
              type="text"
              value={newChildUnit}
              disabled={isAddingChildSubmitting}
              onChange={(e) => onSetChildUnit(e.target.value)}
              placeholder="ĐV chủ trì..."
              className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none placeholder:text-slate-500"
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
              className="h-8 w-full min-w-[88px] rounded px-2.5 text-sm font-medium border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none text-center placeholder:text-slate-500"
            />
          </td>
          <td className="px-2 py-2">
            <div className="relative flex items-center justify-center">
              <ProjectDateInput
                value={newChildStartDate}
                disabled={isAddingChildSubmitting}
                min={parentStart || undefined}
                max={parentEnd || undefined}
                onChange={(nextDate) => handleChildStartDateChange(nextDate ?? '')}
                placeholder={datePlaceholder}
                ariaLabel={`Từ ngày bước con của ${step.step_name}`}
                error={Boolean(childDateError && newChildStartDate)}
                testId={`step-child-start-date-${step.id}`}
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="relative flex items-center justify-center">
              <ProjectDateInput
                value={effectiveNewChildEndDate}
                disabled={isAddingChildSubmitting}
                min={childDurationDays > 0 ? (parentStart || undefined) : (newChildStartDate || parentStart || undefined)}
                max={parentEnd || undefined}
                onChange={(nextDate) => handleChildEndDateChange(nextDate ?? '')}
                placeholder={datePlaceholder}
                ariaLabel={`Đến ngày bước con của ${step.step_name}`}
                error={Boolean(childDateError && effectiveNewChildEndDate)}
                testId={`step-child-end-date-${step.id}`}
                title={isChildEndAutoCalc ? `Tự tính: Từ ngày + ${childDurationDays} - 1 ngày. Có thể nhập Đến ngày để suy ra Từ ngày.` : undefined}
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <select
              value={newChildStatus}
              disabled={isAddingChildSubmitting}
              onChange={(e) => onSetChildStatus(e.target.value as ProcedureStepStatus)}
              data-testid={`step-child-progress-${step.id}`}
              className="h-8 w-full min-w-[112px] rounded border border-slate-300 bg-white px-2.5 pr-7 text-sm outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
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
                <div className="text-[10px] font-medium text-[var(--ui-danger-fg)]">{childDateError}</div>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmitChild}
                  disabled={!newChildName.trim() || isAddingChildSubmitting || !!childDateError}
                  className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-2.5 text-xs font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAddingChildSubmitting ? 'Đang thêm...' : 'Thêm'}
                </button>
                <button
                  type="button"
                  onClick={onCancelChild}
                  disabled={isAddingChildSubmitting}
                  className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/15"
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
