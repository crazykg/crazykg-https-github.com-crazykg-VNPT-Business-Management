import React, { memo } from 'react';
import {
  ProjectProcedureStep,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  IssueStatus,
} from '../../types';
import { type ProcedureStepAttachment } from '../../services/v5Api';
import { AttachmentManager } from '../AttachmentManager';
import { computeEndDate } from '../../utils/procedureHelpers';

// ─── Local helpers ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)     return 'Vừa xong';
  if (diff < 3600)   return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function absTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_STATUS_OPTIONS: { value: ProcedureStepStatus; label: string; color: string }[] = [
  { value: 'CHUA_THUC_HIEN', label: 'Chưa TH',    color: 'text-slate-400' },
  { value: 'DANG_THUC_HIEN', label: 'Đang TH',    color: 'text-amber-600' },
  { value: 'HOAN_THANH',     label: 'Hoàn thành', color: 'text-emerald-600' },
];

const ROW_BG: Record<ProcedureStepStatus, string> = {
  HOAN_THANH:     'bg-emerald-50/60',
  DANG_THUC_HIEN: 'bg-amber-50/60',
  CHUA_THUC_HIEN: '',
};

const WORKLOG_ICON: Record<string, string> = {
  STATUS_CHANGE:  'sync_alt',
  DOCUMENT_ADDED: 'description',
  NOTE:           'edit_note',
  CUSTOM:         'add_circle',
};

const WORKLOG_COLOR: Record<string, string> = {
  STATUS_CHANGE:  'text-blue-500 bg-blue-50',
  DOCUMENT_ADDED: 'text-emerald-500 bg-emerald-50',
  NOTE:           'text-violet-500 bg-violet-50',
  CUSTOM:         'text-amber-500 bg-amber-50',
};

const ISSUE_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  JUST_ENCOUNTERED: { label: 'Vừa gặp',       color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  IN_PROGRESS:      { label: 'Đang xử lý',    color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  RESOLVED:         { label: 'Đã giải quyết', color: 'text-green-700 bg-green-50 border-green-200',    dot: 'bg-green-500'  },
};

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
  attachList: ProcedureStepAttachment[];
  attachLoading: boolean;
  attachUploading: boolean;

  // Child form
  newChildName: string;
  newChildUnit: string;
  newChildDays: string;

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
  onCancelChild: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StepRow = memo(function StepRow({
  step, draft, stepsInPhase,
  isEditing, isExpanded, isWlogOpen, isAttachOpen, isAddingChild,
  isAdmin, isRaciA, myId,
  wlogs, wlogInput, wlogHours, wlogDifficulty, wlogProposal, wlogIssueStatus, wlogSaving,
  editingRowDraft,
  attachList, attachLoading, attachUploading,
  newChildName, newChildUnit, newChildDays,
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
  onSetChildName, onSetChildUnit, onSetChildDays, onCancelChild,
}: StepRowProps) {
  const isChild  = !!step.parent_step_id;
  const status   = (draft.progress_status ?? step.progress_status) as ProcedureStepStatus;
  const isCustom = !step.template_step_id;

  const worklogCount      = step.worklogs_count ?? wlogs.length;
  const blockingWlogCount = step.blocking_worklogs_count
    ?? wlogs.filter((log) => log.log_type !== 'CUSTOM').length;

  const isCreator = isCustom && !!myId && String(step.created_by) === myId;
  const canMutate = blockingWlogCount === 0 && (isAdmin || isRaciA || isCreator);
  const canDelete = isCustom && canMutate;
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

  return (
    <React.Fragment>
      <tr className={`transition-colors ${isEditing ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : `hover:bg-slate-50/60 ${ROW_BG[status]}`}`}>

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
                <span className="material-symbols-outlined text-base leading-none">arrow_drop_up</span>
              </button>
              <button
                type="button"
                onClick={() => onReorder(step, 'down')}
                disabled={ri === stepsInPhase.length - 1}
                className="p-0.5 text-slate-200 hover:text-deep-teal disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                title="Di chuyển xuống"
              >
                <span className="material-symbols-outlined text-base leading-none">arrow_drop_down</span>
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
                <span className="px-1 py-0.5 rounded text-[9px] bg-violet-100 text-violet-600 font-semibold shrink-0">TỰ THÊM</span>
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
        <td className="px-3 py-2">
          <input
            type="date"
            value={draft.actual_start_date ?? step.actual_start_date ?? ''}
            onChange={(e) => onStartDateChange(step, e.target.value || null)}
            className="w-full px-2 py-1 rounded text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
          />
        </td>

        {/* Đến ngày */}
        <td className="px-3 py-2">
          <input
            type="date"
            value={endDisplay}
            readOnly={hasAutoCalc}
            tabIndex={hasAutoCalc ? -1 : 0}
            onChange={hasAutoCalc ? undefined : (e) => onDraftChange(step.id, 'actual_end_date', e.target.value || null)}
            title={hasAutoCalc ? `Tự tính: Từ ngày + ${days} - 1 ngày` : undefined}
            className={`w-full px-2 py-1 rounded text-xs border border-slate-200 outline-none ${
              hasAutoCalc ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20'
            }`}
          />
        </td>

        {/* Tiến độ */}
        <td className="px-3 py-2">
          <select
            value={status}
            onChange={(e) => onDraftChange(step.id, 'progress_status', e.target.value)}
            className={`w-full px-2 py-1 rounded text-xs font-medium border border-slate-200 bg-white cursor-pointer ${STEP_STATUS_OPTIONS.find((o) => o.value === status)?.color || ''}`}
          >
            {STEP_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </td>

        {/* Số văn bản */}
        <td className="px-3 py-2">
          <input
            type="text"
            value={draft.document_number ?? step.document_number ?? ''}
            onChange={(e) => onDraftChange(step.id, 'document_number', e.target.value || null)}
            className="w-full px-2 py-1 rounded text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
            placeholder="Số VB..."
          />
        </td>

        {/* Ngày VB */}
        <td className="px-3 py-2">
          <input
            type="date"
            value={draft.document_date ?? step.document_date ?? ''}
            onChange={(e) => onDraftChange(step.id, 'document_date', e.target.value || null)}
            className="w-full px-2 py-1 rounded text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
          />
        </td>

        {/* Worklog */}
        <td className="px-3 py-2">
          <button
            onClick={() => onToggleWorklog(step.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors w-full ${
              isWlogOpen ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600'
            }`}
          >
            <span className="material-symbols-outlined text-sm">history</span>
            <span>{`Worklog(${worklogCount})`}</span>
            <span className="material-symbols-outlined text-xs ml-auto">{isWlogOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* File đính kèm */}
        <td className="px-3 py-2">
          <button
            onClick={() => onOpenAttachments(step)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors w-full ${
              isAttachOpen ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
            }`}
            title="File đính kèm"
          >
            {attachLoading
              ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-sm">attach_file</span>
            }
            <span>{attachCount > 0 ? `${attachCount}` : ''}</span>
            <span className="material-symbols-outlined text-xs ml-auto">{isAttachOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
        </td>

        {/* Actions */}
        <td className="px-2 py-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onSaveEditRow(step)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Lưu">
                <span className="material-symbols-outlined text-base">check</span>
              </button>
              <button onClick={onCancelEditRow} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title="Hủy">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ) : canMutate ? (
            <div className="flex items-center gap-0.5">
              {!isChild && (
                <button
                  onClick={() => onToggleAddChild(step.id)}
                  className={`p-1 transition-colors ${isAddingChild ? 'text-teal-500' : 'text-slate-300 hover:text-teal-500'}`}
                  title="Thêm bước con"
                >
                  <span className="material-symbols-outlined text-base">subdirectory_arrow_right</span>
                </button>
              )}
              {canDelete && (
                <button onClick={() => onDeleteStep(step)} className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="Xóa bước tự thêm">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              )}
            </div>
          ) : null}
        </td>
      </tr>

      {/* ── Worklog panel ── */}
      {isWlogOpen && (
        <tr>
          <td colSpan={11} className="px-4 py-3 bg-violet-50/50 border-t border-violet-100">
            <div className="flex flex-col gap-2">
              {/* Form nhập worklog */}
              <div className="flex flex-col gap-2 bg-white border border-violet-100 rounded-xl p-2.5">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={wlogInput}
                    onChange={(e) => onSetWlogInput(step.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !wlogSaving) onAddWorklog(step.id); }}
                    placeholder="Ghi worklog mới... (Enter để lưu)"
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
                  />
                  <input
                    type="number" min="0.01" max="24" step="0.25"
                    value={wlogHours}
                    onChange={(e) => onSetWlogHours(step.id, e.target.value)}
                    placeholder="Giờ"
                    title="Giờ thực hiện"
                    className="w-20 px-2 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none text-right"
                  />
                  <button
                    onClick={() => onAddWorklog(step.id)}
                    disabled={!wlogInput.trim() || wlogSaving}
                    className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {wlogSaving ? '...' : 'Thêm'}
                  </button>
                </div>
                <textarea
                  value={wlogDifficulty}
                  onChange={(e) => onSetWlogDifficulty(step.id, e.target.value)}
                  placeholder="Khó khăn (tuỳ chọn)…"
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none resize-none"
                />
                {wlogDifficulty.trim() && (
                  <div className="flex gap-2">
                    <textarea
                      value={wlogProposal}
                      onChange={(e) => onSetWlogProposal(step.id, e.target.value)}
                      placeholder="Đề xuất / giải pháp…"
                      rows={2}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none resize-none"
                    />
                    <select
                      value={wlogIssueStatus}
                      onChange={(e) => onSetWlogIssueStatus(step.id, e.target.value as IssueStatus)}
                      className="w-36 px-2 py-1 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none self-start mt-0.5"
                    >
                      <option value="JUST_ENCOUNTERED">Vừa gặp</option>
                      <option value="IN_PROGRESS">Đang xử lý</option>
                      <option value="RESOLVED">Đã giải quyết</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Danh sách worklog */}
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
                              autoFocus type="text"
                              value={editWorklogContent}
                              onChange={(e) => onSetEditWorklogContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Escape') onCancelEditWorklog(); }}
                              className="w-full px-2 py-1 rounded text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none"
                            />
                            <div className="flex gap-1.5">
                              <input
                                type="number" min="0.01" max="24" step="0.25"
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
                                onClick={() => onSaveEditWorklog(step.id, log.id)}
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
                                      {(['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'] as IssueStatus[]).map((s) => (
                                        <button
                                          key={s}
                                          onClick={() => onUpdateIssueStatus(step.id, log.issue!.id, s)}
                                          className={`text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 ${s === log.issue!.issue_status ? 'font-semibold' : ''} ${ISSUE_STATUS_META[s]?.color || ''}`}
                                        >
                                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ISSUE_STATUS_META[s]?.dot || ''}`} />
                                          {ISSUE_STATUS_META[s]?.label || s}
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
      )}

      {/* ── Attachment panel ── */}
      {isAttachOpen && (
        <tr>
          <td colSpan={11} className="px-4 py-3 bg-amber-50/40 border-t border-amber-100">
            <AttachmentManager
              attachments={attachList}
              onUpload={(file) => onUploadFile(step.id, file)}
              onDelete={(id) => onDeleteAttachment(step.id, id)}
              isUploading={attachUploading}
              uploadButtonLabel="Tải file đính kèm"
              emptyStateDescription="Chưa có file đính kèm cho bước này"
              helperText="PDF, Word, Excel, ảnh — tối đa 20MB • Upload thẳng lên Backblaze B2"
              enableClipboardPaste={true}
              clipboardPasteHint="Ctrl+V để dán ảnh chụp màn hình"
            />
          </td>
        </tr>
      )}

      {/* ── Add child form ── */}
      {!isChild && isAddingChild && (
        <tr className="bg-teal-50/60 border-t border-teal-100">
          <td />
          <td className="px-3 py-2 text-center text-teal-400 font-mono text-xs select-none">└+</td>
          <td className="px-2 py-2" style={{ paddingLeft: '28px' }}>
            <input
              autoFocus type="text"
              value={newChildName}
              onChange={(e) => onSetChildName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAddChildStep(step); if (e.key === 'Escape') onCancelChild(); }}
              placeholder="Tên bước con..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-teal-300 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none font-medium placeholder:text-slate-300"
            />
          </td>
          <td className="px-2 py-2">
            <input
              type="text"
              value={newChildUnit}
              onChange={(e) => onSetChildUnit(e.target.value)}
              placeholder="ĐV chủ trì..."
              className="w-full px-2 py-1.5 rounded-lg text-xs border border-teal-200 bg-white focus:border-teal-400 outline-none placeholder:text-slate-300"
            />
          </td>
          <td />
          <td className="px-2 py-2">
            <input
              type="number"
              value={newChildDays}
              onChange={(e) => onSetChildDays(e.target.value)}
              placeholder="0" min="0"
              className="w-full px-2 py-1.5 rounded-lg text-xs border border-teal-200 bg-white focus:border-teal-400 outline-none text-center placeholder:text-slate-300"
            />
          </td>
          <td colSpan={8} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAddChildStep(step)}
                disabled={!newChildName.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Thêm
              </button>
              <button
                type="button"
                onClick={onCancelChild}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});
