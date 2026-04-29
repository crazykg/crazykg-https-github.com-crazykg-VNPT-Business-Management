import React, { useMemo } from 'react';
import type {
  Attachment,
  IssueStatus,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  ProjectProcedureStep,
} from '../../types';
import { StepRow, type StepRowProps } from './StepRow';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const PROCEDURE_TABLE_COLUMNS = [
  40,
  52,
  336,
  176,
  220,
  96,
  140,
  140,
  136,
  148,
  124,
  52,
] as const;
const PROCEDURE_TABLE_COLUMN_COUNT = PROCEDURE_TABLE_COLUMNS.length;
const PROCEDURE_TABLE_MIN_WIDTH = 'min-w-[1660px]';

interface PhaseGroup {
  phase: string;
  label: string;
  steps: ProjectProcedureStep[];
}

interface PhaseStatsEntry {
  total: number;
  completed: number;
  percent: number;
  totalDays: number;
  calendarDays: number | null;
  dateRange: { min: string; max: string } | null;
  stepsWithDates: number;
  isAllDone: boolean;
}

interface ProcedurePhaseGroupSectionProps {
  group: PhaseGroup;
  groupIndex: number;
  stats: PhaseStatsEntry;
  datePlaceholder: string;
  isCollapsed: boolean;
  raciMatrixPhase: string | null;
  editingPhase: string | null;
  editingPhaseLabel: string;
  phaseLabelSaving: boolean;
  phaseLabelInputRef: React.RefObject<HTMLInputElement | null>;
  onSetEditingPhaseLabel: React.Dispatch<React.SetStateAction<string>>;
  onSavePhaseLabel: () => void;
  onCancelEditPhase: () => void;
  onStartEditPhase: (phase: string, label: string) => void;
  onToggleCollapsed: (phase: string) => void;
  onToggleRaciMatrixPhase: (phase: string) => void;
  addingInPhase: string | null;
  addingStepSubmittingPhase: string | null;
  newStepName: string;
  newStepUnit: string;
  newStepResult: string;
  newStepDays: string;
  onSetNewStepName: React.Dispatch<React.SetStateAction<string>>;
  onSetNewStepUnit: React.Dispatch<React.SetStateAction<string>>;
  onSetNewStepResult: React.Dispatch<React.SetStateAction<string>>;
  onSetNewStepDays: React.Dispatch<React.SetStateAction<string>>;
  onToggleAddStep: (phase: string) => void;
  onAddStep: (phase: string) => void;
  onResetAddStepForm: () => void;
  drafts: Record<string, Partial<ProjectProcedureStep>>;
  editingStepId: string | number | null;
  expandedDetails: Set<string | number>;
  addingChildToStepId: string | number | null;
  addingChildSubmittingStepId: string | number | null;
  isAdmin: boolean;
  isRaciA: boolean;
  myId: string;
  stepWorklogs: Record<string, ProcedureStepWorklog[]>;
  stepWorklogInput: Record<string, string>;
  stepWorklogHours: Record<string, string>;
  stepWorklogDifficulty: Record<string, string>;
  stepWorklogProposal: Record<string, string>;
  stepWorklogIssueStatus: Record<string, IssueStatus>;
  stepWorklogSaving: Record<string, boolean>;
  editingRowDraft: StepRowProps['editingRowDraft'];
  stepAttachments: Record<string, Attachment[]>;
  attachLoadingStep: string | number | null;
  openAttachStep: string | null;
  attachUploading: Record<string, boolean>;
  newChildName: string;
  newChildUnit: string;
  newChildDays: string;
  newChildStartDate: string;
  newChildEndDate: string;
  newChildStatus: ProcedureStepStatus;
  editingWorklogId: string | number | null;
  editWorklogContent: string;
  editWorklogHours: string;
  editWorklogDiff: string;
  editWorklogProposal: string;
  editWorklogStatus: IssueStatus;
  editWorklogSaving: boolean;
  deletingWorklogId: string | number | null;
  openWorklogStep: string | number | null;
  onDraftChange: StepRowProps['onDraftChange'];
  onStartDateChange: StepRowProps['onStartDateChange'];
  onEndDateChange: StepRowProps['onEndDateChange'];
  onDateRangeBlur: StepRowProps['onDateRangeBlur'];
  onReorder: StepRowProps['onReorder'];
  onToggleDetail: StepRowProps['onToggleDetail'];
  onStartEditRow: StepRowProps['onStartEditRow'];
  onCancelEditRow: StepRowProps['onCancelEditRow'];
  onSaveEditRow: StepRowProps['onSaveEditRow'];
  onSetEditingRowDraft: StepRowProps['onSetEditingRowDraft'];
  onDeleteStep: StepRowProps['onDeleteStep'];
  onOpenAttachments: StepRowProps['onOpenAttachments'];
  onUploadFile: StepRowProps['onUploadFile'];
  onDeleteAttachment: StepRowProps['onDeleteAttachment'];
  onToggleWorklog: StepRowProps['onToggleWorklog'];
  onAddWorklog: StepRowProps['onAddWorklog'];
  onUpdateIssueStatus: StepRowProps['onUpdateIssueStatus'];
  onStartEditWorklog: StepRowProps['onStartEditWorklog'];
  onCancelEditWorklog: StepRowProps['onCancelEditWorklog'];
  onSaveEditWorklog: StepRowProps['onSaveEditWorklog'];
  onDeleteWorklog: StepRowProps['onDeleteWorklog'];
  onSetWlogInput: StepRowProps['onSetWlogInput'];
  onSetWlogHours: StepRowProps['onSetWlogHours'];
  onSetWlogDifficulty: StepRowProps['onSetWlogDifficulty'];
  onSetWlogProposal: StepRowProps['onSetWlogProposal'];
  onSetWlogIssueStatus: StepRowProps['onSetWlogIssueStatus'];
  onSetEditWorklogContent: StepRowProps['onSetEditWorklogContent'];
  onSetEditWorklogHours: StepRowProps['onSetEditWorklogHours'];
  onSetEditWorklogDiff: StepRowProps['onSetEditWorklogDiff'];
  onSetEditWorklogProposal: StepRowProps['onSetEditWorklogProposal'];
  onSetEditWorklogStatus: StepRowProps['onSetEditWorklogStatus'];
  onToggleAddChild: StepRowProps['onToggleAddChild'];
  onAddChildStep: StepRowProps['onAddChildStep'];
  onSetChildName: StepRowProps['onSetChildName'];
  onSetChildUnit: StepRowProps['onSetChildUnit'];
  onSetChildDays: StepRowProps['onSetChildDays'];
  onSetChildStartDate: StepRowProps['onSetChildStartDate'];
  onSetChildEndDate: StepRowProps['onSetChildEndDate'];
  onSetChildStatus: StepRowProps['onSetChildStatus'];
  onCancelChild: StepRowProps['onCancelChild'];
}

function formatMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
}

const normalizeStepKey = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : String(value);

const compareStepOrder = (left: ProjectProcedureStep, right: ProjectProcedureStep): number => {
  const orderDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const numberDiff = Number(left.step_number ?? 0) - Number(right.step_number ?? 0);
  if (numberDiff !== 0) return numberDiff;
  return normalizeStepKey(left.id).localeCompare(normalizeStepKey(right.id), 'vi');
};

const EMPTY_STEP_DRAFT: Record<string, any> = {};
const EMPTY_PROCEDURE_STEPS: ProjectProcedureStep[] = [];
const EMPTY_WORKLOGS: ProcedureStepWorklog[] = [];
const EMPTY_ATTACHMENTS: Attachment[] = [];

export const ProcedurePhaseGroupSection: React.FC<ProcedurePhaseGroupSectionProps> = ({
  group,
  groupIndex,
  stats,
  datePlaceholder,
  isCollapsed,
  raciMatrixPhase,
  editingPhase,
  editingPhaseLabel,
  phaseLabelSaving,
  phaseLabelInputRef,
  onSetEditingPhaseLabel,
  onSavePhaseLabel,
  onCancelEditPhase,
  onStartEditPhase,
  onToggleCollapsed,
  onToggleRaciMatrixPhase,
  addingInPhase,
  addingStepSubmittingPhase,
  newStepName,
  newStepUnit,
  newStepResult,
  newStepDays,
  onSetNewStepName,
  onSetNewStepUnit,
  onSetNewStepResult,
  onSetNewStepDays,
  onToggleAddStep,
  onAddStep,
  onResetAddStepForm,
  drafts,
  editingStepId,
  expandedDetails,
  addingChildToStepId,
  addingChildSubmittingStepId,
  isAdmin,
  isRaciA,
  myId,
  stepWorklogs,
  stepWorklogInput,
  stepWorklogHours,
  stepWorklogDifficulty,
  stepWorklogProposal,
  stepWorklogIssueStatus,
  stepWorklogSaving,
  editingRowDraft,
  stepAttachments,
  attachLoadingStep,
  openAttachStep,
  attachUploading,
  newChildName,
  newChildUnit,
  newChildDays,
  newChildStartDate,
  newChildEndDate,
  newChildStatus,
  editingWorklogId,
  editWorklogContent,
  editWorklogHours,
  editWorklogDiff,
  editWorklogProposal,
  editWorklogStatus,
  editWorklogSaving,
  deletingWorklogId,
  openWorklogStep,
  onDraftChange,
  onStartDateChange,
  onEndDateChange,
  onDateRangeBlur,
  onReorder,
  onToggleDetail,
  onStartEditRow,
  onCancelEditRow,
  onSaveEditRow,
  onSetEditingRowDraft,
  onDeleteStep,
  onOpenAttachments,
  onUploadFile,
  onDeleteAttachment,
  onToggleWorklog,
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
  onToggleAddChild,
  onAddChildStep,
  onSetChildName,
  onSetChildUnit,
  onSetChildDays,
  onSetChildStartDate,
  onSetChildEndDate,
  onSetChildStatus,
  onCancelChild,
}) => {
  const phaseRangeLabel = stats.dateRange
    ? (() => {
      const minLabel = formatMonthYear(stats.dateRange.min);
      const maxLabel = formatMonthYear(stats.dateRange.max);
      if (!minLabel || !maxLabel) return null;
      return minLabel === maxLabel ? minLabel : `${minLabel} → ${maxLabel}`;
    })()
    : null;
  const isAddingHere = addingInPhase === group.phase;
  const isAddingStepSubmitting = addingStepSubmittingPhase === group.phase;

  const childParentIds = useMemo(
    () => new Set(
      group.steps
        .filter((step) => step.parent_step_id != null)
        .map((step) => String(step.parent_step_id)),
    ),
    [group.steps],
  );

  const stepsInPhase = useMemo(
    () => group.steps
      .filter((step) => !step.parent_step_id)
      .sort(compareStepOrder),
    [group.steps],
  );
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, ProjectProcedureStep[]>();
    group.steps
      .filter((step) => step.parent_step_id != null)
      .forEach((step) => {
        const parentKey = normalizeStepKey(step.parent_step_id);
        const children = map.get(parentKey) ?? [];
        children.push(step);
        map.set(parentKey, children);
      });
    map.forEach((children) => children.sort(compareStepOrder));
    return map;
  }, [group.steps]);
  const orderedSteps = useMemo(
    () => stepsInPhase.flatMap((step) => [
      step,
      ...(childrenByParentId.get(normalizeStepKey(step.id)) ?? []),
    ]),
    [childrenByParentId, stepsInPhase],
  );
  const displayNumberByStepId = useMemo(() => {
    const map = new Map<string, string>();
    stepsInPhase.forEach((step, parentIndex) => {
      const parentNumber = String(parentIndex + 1);
      const parentKey = normalizeStepKey(step.id);
      map.set(parentKey, parentNumber);
      const children = childrenByParentId.get(parentKey) ?? EMPTY_PROCEDURE_STEPS;
      children.forEach((child, childIndex) => {
        map.set(normalizeStepKey(child.id), `${parentNumber}.${childIndex + 1}`);
      });
    });
    return map;
  }, [childrenByParentId, stepsInPhase]);
  const bodyId = `procedure-phase-body-${group.phase}`;
  const toggleTitle = isCollapsed ? 'Mở chi tiết giai đoạn' : 'Thu gọn giai đoạn';

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-white shadow-sm" data-testid={`procedure-phase-group-${group.phase}`}>
      <div className={`flex items-center justify-between border-b border-slate-200 border-l-4 px-4 py-3 ${stats.isAllDone ? 'border-l-emerald-700 bg-white' : 'border-l-primary bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleCollapsed(group.phase)}
            aria-expanded={!isCollapsed}
            aria-controls={bodyId}
            aria-label={`${toggleTitle}: ${group.label}`}
            title={toggleTitle}
            data-testid={`phase-collapse-toggle-${group.phase}`}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary/20 sm:h-8 sm:w-8"
          >
            <span className="material-symbols-outlined text-base">{isCollapsed ? 'chevron_right' : 'expand_more'}</span>
          </button>
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 shadow-sm border ${stats.isAllDone ? 'border-emerald-700 bg-emerald-100 text-emerald-700' : 'border-primary bg-primary text-white'}`}>
            {ROMAN[groupIndex] ?? groupIndex + 1}
          </span>
          <div>
            {editingPhase === group.phase ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={phaseLabelInputRef}
                  type="text"
                  value={editingPhaseLabel}
                  onChange={(event) => onSetEditingPhaseLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSavePhaseLabel();
                    if (event.key === 'Escape') onCancelEditPhase();
                  }}
                  className="h-8 min-w-0 w-48 rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/15"
                  placeholder="Tên giai đoạn..."
                  maxLength={255}
                  autoComplete="off"
                  disabled={phaseLabelSaving}
                />
                <button
                  onClick={onSavePhaseLabel}
                  disabled={phaseLabelSaving}
                  className="flex h-8 w-8 items-center justify-center rounded bg-primary text-white transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-60"
                  title="Lưu tên giai đoạn"
                >
                  <span className="material-symbols-outlined text-sm">{phaseLabelSaving ? 'progress_activity' : 'check'}</span>
                </button>
                <button
                  onClick={onCancelEditPhase}
                  disabled={phaseLabelSaving}
                  className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/15 disabled:opacity-60"
                  title="Hủy"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/phase-label">
                <span className="text-sm font-bold text-slate-800">{group.label}</span>
                <button
                  onClick={() => onStartEditPhase(group.phase, group.label)}
                  className="flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover/phase-label:opacity-100 text-slate-600 hover:text-primary hover:bg-primary/10 transition-all focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  title="Đổi tên giai đoạn"
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
            )}
            <span className="mt-0.5 block text-xs text-slate-600">
              {stats.completed}/{stats.total} bước {stats.isAllDone && '✓'}
              {stats.totalDays > 0 && (
                <span className="ml-2 text-deep-teal font-medium">• {stats.totalDays} ngày công</span>
              )}
              {stats.total > 0 && stats.stepsWithDates === stats.total && stats.calendarDays != null ? (
                <span className={`${stats.totalDays > 0 ? 'ml-1' : 'ml-2'} text-slate-500 font-normal`}>
                  {stats.totalDays > 0 ? '· ' : '• '}
                  {stats.calendarDays} ngày lịch
                </span>
              ) : phaseRangeLabel ? (
                <span className={`${stats.totalDays > 0 ? 'ml-1' : 'ml-2'} text-slate-500 font-normal`}>
                  {stats.totalDays > 0 ? '· ' : '• '}
                  {phaseRangeLabel}
                </span>
              ) : null}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <div className="w-20 h-1.5 bg-slate-100 ring-1 ring-inset ring-slate-300 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${stats.isAllDone ? 'bg-[var(--ui-success-fg)]' : 'bg-primary'}`} style={{ width: `${stats.percent}%` }} />
            </div>
            <span className="text-xs text-slate-600">{stats.percent}%</span>
          </div>
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleRaciMatrixPhase(group.phase)}
              data-testid={`phase-raci-${group.phase}`}
              className={`flex h-8 items-center gap-1 rounded border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-primary/20 ${
                raciMatrixPhase === group.phase
                  ? 'text-primary bg-primary/8 border-primary'
                  : 'text-primary bg-white border-primary hover:bg-primary/5'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
              Phân công
            </button>
            <button
              type="button"
              onClick={() => onToggleAddStep(group.phase)}
              className="flex h-8 items-center gap-1 rounded border border-primary bg-white px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/20"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isAddingHere ? 'close' : 'add'}</span>
              {isAddingHere ? 'Hủy' : 'Thêm bước'}
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div id={bodyId} className="overflow-x-auto" data-testid={`procedure-phase-body-${group.phase}`}>
          <table className={`w-full ${PROCEDURE_TABLE_MIN_WIDTH} table-fixed border-collapse text-left`}>
            <colgroup>
              {PROCEDURE_TABLE_COLUMNS.map((width, index) => (
                <col key={`${group.phase}-${index}`} style={{ width }} />
              ))}
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-1 py-2" title="Xếp thứ tự" aria-label="Xếp thứ tự" />
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">TT</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">Trình tự công việc</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">ĐV chủ trì</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">Kết quả dự kiến</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase text-center">Ngày</th>
                <th scope="col" className="px-2 py-2 text-[11px] font-semibold text-slate-700 uppercase">Từ ngày</th>
                <th scope="col" className="px-2 py-2 text-[11px] font-semibold text-slate-700 uppercase">Đến ngày</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">Tiến độ</th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-xs">history</span>
                    Worklog
                  </span>
                </th>
                <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase">
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-xs">attach_file</span>
                    File
                  </span>
                </th>
                <th
                  scope="col"
                  className="sticky right-0 z-20 border-l border-slate-300 bg-slate-100 px-2 py-2 shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]"
                  aria-label="Thao tác"
                >
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
            {orderedSteps.map((step) => {
              const stepKey = normalizeStepKey(step.id);
              const stepsInScope = step.parent_step_id
                ? (childrenByParentId.get(normalizeStepKey(step.parent_step_id)) ?? EMPTY_PROCEDURE_STEPS)
                : stepsInPhase;

              return (
                <StepRow
                  key={step.id}
                  step={step}
                  displayNumber={displayNumberByStepId.get(stepKey) ?? ''}
                  datePlaceholder={datePlaceholder}
                  draft={drafts[stepKey] ?? EMPTY_STEP_DRAFT}
                  stepsInScope={stepsInScope}
                  isEditing={editingStepId === step.id}
                  isExpanded={expandedDetails.has(step.id)}
                  isWlogOpen={openWorklogStep === step.id}
                  isAttachOpen={openAttachStep === stepKey}
                  isAddingChild={addingChildToStepId === step.id}
                  isAddingChildSubmitting={addingChildSubmittingStepId === step.id}
                  hasChildren={childParentIds.has(stepKey)}
                  isAdmin={isAdmin}
                  isRaciA={isRaciA}
                  myId={myId}
                  wlogs={stepWorklogs[stepKey] ?? EMPTY_WORKLOGS}
                  wlogInput={stepWorklogInput[stepKey] ?? ''}
                  wlogHours={stepWorklogHours[stepKey] ?? ''}
                  wlogDifficulty={stepWorklogDifficulty[stepKey] ?? ''}
                  wlogProposal={stepWorklogProposal[stepKey] ?? ''}
                  wlogIssueStatus={(stepWorklogIssueStatus[stepKey] ?? 'JUST_ENCOUNTERED') as IssueStatus}
                  wlogSaving={stepWorklogSaving[stepKey] ?? false}
                  editingRowDraft={editingRowDraft}
                  attachList={stepAttachments[stepKey] ?? EMPTY_ATTACHMENTS}
                  attachLoading={attachLoadingStep === stepKey}
                  attachUploading={attachUploading[stepKey] ?? false}
                  newChildName={newChildName}
                  newChildUnit={newChildUnit}
                  newChildDays={newChildDays}
                  newChildStartDate={newChildStartDate}
                  newChildEndDate={newChildEndDate}
                  newChildStatus={newChildStatus}
                  editingWorklogId={editingWorklogId}
                  editWorklogContent={editWorklogContent}
                  editWorklogHours={editWorklogHours}
                  editWorklogDiff={editWorklogDiff}
                  editWorklogProposal={editWorklogProposal}
                  editWorklogStatus={editWorklogStatus}
                  editWorklogSaving={editWorklogSaving}
                  deletingWorklogId={deletingWorklogId}
                  onDraftChange={onDraftChange}
                  onStartDateChange={onStartDateChange}
                  onEndDateChange={onEndDateChange}
                  onDateRangeBlur={onDateRangeBlur}
                  onReorder={onReorder}
                  onToggleDetail={onToggleDetail}
                  onStartEditRow={onStartEditRow}
                  onCancelEditRow={onCancelEditRow}
                  onSaveEditRow={onSaveEditRow}
                  onSetEditingRowDraft={onSetEditingRowDraft}
                  onDeleteStep={onDeleteStep}
                  onOpenAttachments={onOpenAttachments}
                  onUploadFile={onUploadFile}
                  onDeleteAttachment={onDeleteAttachment}
                  onToggleWorklog={onToggleWorklog}
                  onAddWorklog={onAddWorklog}
                  onUpdateIssueStatus={onUpdateIssueStatus}
                  onStartEditWorklog={onStartEditWorklog}
                  onCancelEditWorklog={onCancelEditWorklog}
                  onSaveEditWorklog={onSaveEditWorklog}
                  onDeleteWorklog={onDeleteWorklog}
                  onSetWlogInput={onSetWlogInput}
                  onSetWlogHours={onSetWlogHours}
                  onSetWlogDifficulty={onSetWlogDifficulty}
                  onSetWlogProposal={onSetWlogProposal}
                  onSetWlogIssueStatus={onSetWlogIssueStatus}
                  onSetEditWorklogContent={onSetEditWorklogContent}
                  onSetEditWorklogHours={onSetEditWorklogHours}
                  onSetEditWorklogDiff={onSetEditWorklogDiff}
                  onSetEditWorklogProposal={onSetEditWorklogProposal}
                  onSetEditWorklogStatus={onSetEditWorklogStatus}
                  onToggleAddChild={onToggleAddChild}
                  onAddChildStep={onAddChildStep}
                  onSetChildName={onSetChildName}
                  onSetChildUnit={onSetChildUnit}
                  onSetChildDays={onSetChildDays}
                  onSetChildStartDate={onSetChildStartDate}
                  onSetChildEndDate={onSetChildEndDate}
                  onSetChildStatus={onSetChildStatus}
                  onCancelChild={onCancelChild}
                />
              );
            })}

            {isAddingHere && (
              <tr className="bg-primary/5 border-t-2 border-primary/20">
                <td className="px-1 py-2" />
                <td className="px-3 py-2 text-xs text-slate-600 text-center font-mono">+</td>
                <td className="px-2 py-2">
                  <input
                    autoFocus
                    type="text"
                    value={newStepName}
                    disabled={isAddingStepSubmitting}
                    onChange={(event) => onSetNewStepName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !isAddingStepSubmitting && newStepName.trim()) onAddStep(group.phase);
                    }}
                    placeholder="Tên bước mới..."
                    className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none font-medium placeholder:text-slate-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={newStepUnit}
                    disabled={isAddingStepSubmitting}
                    onChange={(event) => onSetNewStepUnit(event.target.value)}
                    placeholder="ĐV chủ trì..."
                    className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none placeholder:text-slate-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={newStepResult}
                    disabled={isAddingStepSubmitting}
                    onChange={(event) => onSetNewStepResult(event.target.value)}
                    placeholder="Kết quả dự kiến..."
                    className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none placeholder:text-slate-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={newStepDays}
                    disabled={isAddingStepSubmitting}
                    onChange={(event) => onSetNewStepDays(event.target.value)}
                    placeholder="0"
                    min="0"
                    className="h-8 w-full rounded px-2.5 text-sm border border-slate-300 bg-white focus:border-primary/70 focus:ring-1 focus:ring-primary/15 outline-none text-center placeholder:text-slate-500"
                  />
                </td>
                <td colSpan={6} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAddStep(group.phase)}
                      disabled={!newStepName.trim() || isAddingStepSubmitting}
                      className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-2.5 text-xs font-semibold text-white transition-colors hover:bg-deep-teal focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAddingStepSubmitting ? 'Đang thêm...' : 'Thêm'}
                    </button>
                    <button
                      type="button"
                      disabled={isAddingStepSubmitting}
                      onClick={onResetAddStepForm}
                      className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/15"
                    >
                      Hủy
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {orderedSteps.length === 0 && !isAddingHere && (
              <tr>
                <td colSpan={PROCEDURE_TABLE_COLUMN_COUNT} className="px-4 py-4 text-center text-xs text-slate-600">Chưa có bước nào.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
};
