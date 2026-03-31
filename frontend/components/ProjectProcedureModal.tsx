import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { computeEndDate } from '../utils/procedureHelpers';
import {
  Project,
  AuthUser,
  ProcedureTemplate,
  ProjectProcedure,
  ProjectProcedureStep,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  IssueStatus,
  ProjectTypeOption,
} from '../types';
import {
  fetchProcedureTemplates,
  fetchProjectProcedures,
  createProjectProcedure,
  fetchProcedureSteps,
  updateIssueStatus,
  fetchProcedureWorklogs,
  resyncProcedure,
} from '../services/api/projectApi';
import { ProcedureChecklistAdminTab } from './procedure/ProcedureChecklistAdminTab';
import { ProcedurePhaseGroupSection } from './procedure/ProcedurePhaseGroupSection';
import { ProcedureRaciTab } from './procedure/ProcedureRaciTab';
import { ProcedureWorklogTab } from './procedure/ProcedureWorklogTab';
import { RaciMatrixPanel } from './procedure/RaciMatrixPanel';
import { useProcedureAttachments } from './procedure/hooks/useProcedureAttachments';
import { useProcedureRaci } from './procedure/hooks/useProcedureRaci';
import { useProcedureStepsState } from './procedure/hooks/useProcedureStepsState';
import { useProcedureStepWorklogs } from './procedure/hooks/useProcedureStepWorklogs';
import { PHASE_LABELS } from '../constants';

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'steps' | 'worklog' | 'raci' | 'checklist_admin';

interface ProjectProcedureModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  projectTypes?: ProjectTypeOption[];
  authUser?: AuthUser | null;
}

interface PhaseGroup {
  phase: string;
  label: string;
  steps: ProjectProcedureStep[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByPhase(flat: ProjectProcedureStep[]): PhaseGroup[] {
  const sorted = [...flat].sort((a, b) => a.sort_order - b.sort_order);
  const order: string[] = [];
  const map = new Map<string, ProjectProcedureStep[]>();
  for (const s of sorted) {
    const ph = s.phase || 'KHAC';
    if (!map.has(ph)) { map.set(ph, []); order.push(ph); }
    map.get(ph)!.push(s);
  }
  return order.map((ph) => {
    const steps = map.get(ph)!;
    // Ưu tiên phase_label từ DB (step đầu tiên trong group), fallback về PHASE_LABELS constant
    const customLabel = steps.find((s) => s.phase_label)?.phase_label;
    return { phase: ph, label: customLabel || PHASE_LABELS[ph] || ph, steps };
  });
}

function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffCalendarDaysInclusive(startDate: string, endDate: string): number | null {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || end.getTime() < start.getTime()) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProjectProcedureModal: React.FC<ProjectProcedureModalProps> = ({
  project, isOpen, onClose, onNotify, projectTypes = [], authUser,
}: ProjectProcedureModalProps) => {

  // ── Core state ──
  const [_templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [activeProcedure, setActiveProcedure] = useState<ProjectProcedure | null>(null);
  const [steps, setSteps]         = useState<ProjectProcedureStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('steps');

  // ── Worklog state ──
  const [worklogs,        setWorklogs]        = useState<ProcedureStepWorklog[]>([]);
  const [worklogsLoading, setWorklogsLoading] = useState(false);

  // ── RACI state ──
  const [raciMatrixPhase, setRaciMatrixPhase] = useState<string | null>(null);

  const autoCreatedRef   = useRef(false);
  // ── Inflight guard — prevent double-submit on any save action ──
  const inflightRef = useRef<Set<string>>(new Set());

  const {
    raciList,
    stepRaciMap,
    setStepRaciMap,
    raciLoading,
    raciUserId,
    raciRole,
    raciNote,
    raciSaving,
    userOptions,
    usersLoading,
    employeeCache,
    raciSummaryBadge,
    setRaciUserId,
    setRaciRole,
    setRaciNote,
    setUserSearch,
    resetProcedureRaci,
    reloadProcedureRaci,
    handleAddRaci,
    handleRemoveRaci,
    handleAssignA,
    handleToggleStepRaci,
    handleCopyStepRaci,
  } = useProcedureRaci({
    activeProcedure,
    activeTab,
    inflightRef,
    onNotify: onNotify as ((type: string, title: string, message: string) => void) | undefined,
  });

  const {
    drafts,
    hasDirtyChanges,
    expandedDetails,
    addingInPhase,
    newStepName,
    newStepUnit,
    newStepDays,
    newStepResult,
    addingStepSubmittingPhase,
    addingChildToStepId,
    newChildName,
    newChildUnit,
    newChildDays,
    newChildStartDate,
    newChildEndDate,
    newChildStatus,
    addingChildSubmittingStepId,
    editingStepId,
    editingRowDraft,
    editingPhase,
    editingPhaseLabel,
    phaseLabelSaving,
    phaseLabelInputRef,
    setNewStepName,
    setNewStepUnit,
    setNewStepDays,
    setNewStepResult,
    setNewChildName,
    setNewChildUnit,
    setNewChildDays,
    setNewChildStartDate,
    setNewChildEndDate,
    setNewChildStatus,
    setEditingRowDraft,
    setEditingPhaseLabel,
    handleDraftChange,
    handleStartDateChange,
    handleToggleDetail,
    handleToggleAddStep,
    resetAddStepForm,
    handleSave,
    handleAddStep,
    handleAddChildStep,
    handleDeleteStep,
    handleReorderStep,
    handleStartEditRow,
    handleCancelEditRow,
    handleSaveEditRow,
    handleCancelChild,
    handleToggleAddChild,
    handleStartEditPhase,
    handleSavePhaseLabel,
    handleCancelEditPhase,
    resetProcedureStepsState,
  } = useProcedureStepsState({
    activeProcedure,
    inflightRef,
    onNotify: onNotify as ((type: string, title: string, message: string) => void) | undefined,
    setActiveProcedure,
    setIsSaving,
    setStepRaciMap,
    setSteps,
  });

  const {
    stepAttachments,
    attachLoadingStep,
    openAttachStep,
    attachUploading,
    closeAttachmentPanel,
    resetProcedureAttachments,
    handleOpenAttachments,
    handleUploadStepFile,
    handleDeleteAttachment,
  } = useProcedureAttachments({
    onNotify: onNotify as ((type: string, title: string, message: string) => void) | undefined,
  });

  const {
    openWorklogStep,
    stepWorklogs,
    stepWorklogInput,
    stepWorklogSaving,
    stepWorklogHours,
    stepWorklogDifficulty,
    stepWorklogProposal,
    stepWorklogIssueStatus,
    editingWorklogId,
    editWorklogContent,
    editWorklogHours,
    editWorklogDiff,
    editWorklogProposal,
    editWorklogStatus,
    editWorklogSaving,
    setEditWorklogContent,
    setEditWorklogHours,
    setEditWorklogDiff,
    setEditWorklogProposal,
    setEditWorklogStatus,
    closeStepWorklogPanel,
    resetProcedureStepWorklogs,
    handleToggleStepWorklog,
    handleAddStepWorklog,
    handleUpdateIssueStatus,
    handleStartEditWorklog,
    handleCancelEditWorklog,
    handleSaveEditWorklog,
    handleSetWlogInput,
    handleSetWlogHours,
    handleSetWlogDifficulty,
    handleSetWlogProposal,
    handleSetWlogIssueStatus,
  } = useProcedureStepWorklogs({
    inflightRef,
    onNotify: onNotify as ((type: string, title: string, message: string) => void) | undefined,
    onBeforeOpenStepWorklog: closeAttachmentPanel,
    setSteps,
    setWorklogs,
  });

  const handleOpenProcedureAttachments = useCallback((step: ProjectProcedureStep) => {
    closeStepWorklogPanel();
    return handleOpenAttachments(step);
  }, [closeStepWorklogPanel, handleOpenAttachments]);

  // ── Load procedure ──
  useEffect(() => {
    if (!isOpen) { autoCreatedRef.current = false; return; }
    setIsLoading(true);
    setActiveTab('steps');
    Promise.all([fetchProcedureTemplates(), fetchProjectProcedures(project.id)])
      .then(async ([tmpl, procs]) => {
        const active = tmpl.filter((t) => t.is_active);
        setTemplates(active);
        const matched = procs.filter((p) => {
          const tpl = active.find((t) => String(t.id) === String(p.template_id));
          return tpl?.template_code === project.investment_mode;
        });
        if (matched.length > 0) {
          setActiveProcedure(matched[0]);
        } else if (!autoCreatedRef.current && project.investment_mode && active.length > 0) {
          autoCreatedRef.current = true;
          const tpl = active.find((t) => t.template_code === project.investment_mode);
          if (tpl) {
            try {
              const proc = await createProjectProcedure(project.id, tpl.id);
              setActiveProcedure(proc);
            } catch (err: any) {
              onNotify?.('error', 'Lỗi', err?.message || 'Không thể tự tạo thủ tục');
            }
          }
        }
      })
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message || 'Không thể tải dữ liệu')))
      .finally(() => setIsLoading(false));
  }, [isOpen, project.id]);

  // ── Load steps — reset toàn bộ cache local khi đổi procedure ──
  useEffect(() => {
    if (!activeProcedure) {
      setSteps([]);
      setRaciMatrixPhase(null);
      resetProcedureStepsState();
      return;
    }
    setIsLoading(true);
    // Clear stale cache của các tab phụ ngay khi procedure thay đổi
    resetProcedureStepsState();
    setWorklogs([]);
    resetProcedureStepWorklogs();
    resetProcedureAttachments();
    fetchProcedureSteps(activeProcedure.id)
      .then((stepsData) => {
        setSteps(stepsData);
      })
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message || 'Không thể tải bước')))
      .finally(() => setIsLoading(false));
  }, [activeProcedure?.id, resetProcedureAttachments, resetProcedureStepWorklogs, resetProcedureStepsState]);

  // ── Load worklogs khi chuyển tab — dùng chung cho 'worklog' và 'checklist_admin' ──
  useEffect(() => {
    if ((activeTab !== 'worklog' && activeTab !== 'checklist_admin') || !activeProcedure) return;
    // Skip nếu đã có data (tránh re-fetch khi đổi qua lại giữa 2 tab)
    if (worklogs.length > 0) return;
    setWorklogsLoading(true);
    fetchProcedureWorklogs(activeProcedure.id)
      .then(setWorklogs)
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message)))
      .finally(() => setWorklogsLoading(false));
  }, [activeTab, activeProcedure?.id]);

  // ── Computed (memoized — tránh filter lặp mỗi render) ──
  const phaseGroups = useMemo(() => groupByPhase(steps), [steps]);
  useEffect(() => {
    if (!raciMatrixPhase) return;
    const hasPhase = phaseGroups.some((group) => group.phase === raciMatrixPhase);
    if (!hasPhase) setRaciMatrixPhase(null);
  }, [phaseGroups, raciMatrixPhase]);
  useEffect(() => {
    if (activeTab !== 'steps') setRaciMatrixPhase(null);
  }, [activeTab]);
  const { totalSteps, completedSteps, inProgressSteps, overallPercent, hasAnyWorklog } = useMemo(() => {
    const top = steps.filter((s) => !s.parent_step_id);
    const completed = top.filter((s) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
    const inProgress = top.filter((s) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'DANG_THUC_HIEN').length;
    return {
      totalSteps: top.length,
      completedSteps: completed,
      inProgressSteps: inProgress,
      overallPercent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
      hasAnyWorklog: steps.some((s) => (s.worklogs_count ?? 0) > 0),
    };
  }, [steps, drafts]);
  const activeMatrixGroup = useMemo(
    () => phaseGroups.find((group) => group.phase === raciMatrixPhase) ?? null,
    [phaseGroups, raciMatrixPhase],
  );

  // ── Per-phase stats (memoized — tránh 3× filter trong mỗi phase header) ──
  const phaseStats = useMemo(() =>
    phaseGroups.map((g) => {
      const top = g.steps.filter((s: ProjectProcedureStep) => !s.parent_step_id);
      const completed = top.filter((s: ProjectProcedureStep) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
      const { minDate, maxDate, stepsWithDates } = top.reduce(
        (acc, s: ProjectProcedureStep) => {
          const stepDraft = drafts[String(s.id)] ?? {};
          const hasDraftStart = Object.prototype.hasOwnProperty.call(stepDraft, 'actual_start_date');
          const hasDraftEnd = Object.prototype.hasOwnProperty.call(stepDraft, 'actual_end_date');
          const startDate = hasDraftStart
            ? (stepDraft.actual_start_date ?? null)
            : (s.actual_start_date ?? null);
          const endDate = startDate && (s.duration_days ?? 0) > 0
            ? computeEndDate(startDate, s.duration_days)
            : hasDraftEnd
              ? (stepDraft.actual_end_date ?? null)
              : (s.actual_end_date ?? null);

          if (!startDate || !endDate || !parseLocalDate(startDate) || !parseLocalDate(endDate)) return acc;

          acc.stepsWithDates += 1;
          acc.minDate = !acc.minDate || startDate < acc.minDate ? startDate : acc.minDate;
          acc.maxDate = !acc.maxDate || endDate > acc.maxDate ? endDate : acc.maxDate;
          return acc;
        },
        { minDate: null as string | null, maxDate: null as string | null, stepsWithDates: 0 },
      );
      const calendarDays = minDate && maxDate ? diffCalendarDaysInclusive(minDate, maxDate) : null;

      return {
        total: top.length,
        completed,
        percent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
        totalDays: top.reduce((sum: number, s: ProjectProcedureStep) => sum + (s.duration_days || 0), 0),
        calendarDays,
        dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
        stepsWithDates,
        isAllDone: completed === top.length && top.length > 0,
      };
    }),
    [phaseGroups, drafts],
  );

  // ── Auth / permission — tính 1 lần, dùng chung cho mọi step row ──
  const { myId, isAdmin, isRaciA } = useMemo(() => {
    const mid = authUser?.id != null ? String(authUser.id) : '';
    const roles = (authUser?.roles ?? []).map((r: string) => String(r).toUpperCase());
    const perms = new Set((authUser?.permissions ?? []).map((p: string) => String(p).trim()));
    return {
      myId: mid,
      isAdmin: roles.includes('ADMIN') || perms.has('*'),
      isRaciA: !!mid && raciList.some((r) => String(r.user_id) === mid && r.raci_role === 'A'),
    };
  }, [authUser, raciList]);

  // ── Handlers — steps ──

  const handleChangeIssueStatus = useCallback(async (
    logId: string | number,
    newStatus: IssueStatus,
  ) => {
    try {
      await updateIssueStatus(logId, newStatus);
      setWorklogs((prev) => prev.map((w) =>
        w.id === logId && w.issue
          ? { ...w, issue: { ...w.issue, issue_status: newStatus } }
          : w,
      ));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể cập nhật trạng thái');
    }
  }, [onNotify]);

  const handleRefreshWorklogs = useCallback(() => {
    if (!activeProcedure) return;
    setWorklogsLoading(true);
    fetchProcedureWorklogs(activeProcedure.id)
      .then(setWorklogs)
      .catch(() => {})
      .finally(() => setWorklogsLoading(false));
  }, [activeProcedure]);

  const handleClose = useCallback(() => {
    if (hasDirtyChanges && !window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) return;
    resetProcedureStepsState();
    resetProcedureRaci();
    setActiveProcedure(null); setSteps([]); setWorklogs([]);
    setRaciMatrixPhase(null);
    resetProcedureStepWorklogs();
    resetProcedureAttachments();
    onClose();
  }, [hasDirtyChanges, onClose, resetProcedureAttachments, resetProcedureRaci, resetProcedureStepWorklogs, resetProcedureStepsState]);

  useEscKey(handleClose, isOpen);

  const handleReorderStepRow = useCallback((step: ProjectProcedureStep, direction: 'up' | 'down') => {
    return handleReorderStep(steps, step, direction);
  }, [handleReorderStep, steps]);

  if (!isOpen) return null;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
      <div data-testid="project-procedure-modal" className="relative w-full max-w-[1600px] mx-4 my-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh]">

        {/* ══ Header ══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-deep-teal/5 to-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h2 className="text-lg font-bold text-deep-teal">
                Thủ tục: {project.project_code} — {project.project_name}
              </h2>
              <p className="text-xs text-slate-500">
                {(() => {
                  const code = String(project.investment_mode || '').trim().toUpperCase();
                  if (!code) return '';
                  const match = projectTypes.find(
                    (pt) => String(pt.type_code || '').trim().toUpperCase() === code
                  );
                  if (match) return match.type_name;
                  if (code === 'DAU_TU') return 'Đầu tư';
                  if (code === 'THUE_DICH_VU_DACTHU') return 'Thuê dịch vụ CNTT đặc thù';
                  if (code === 'THUE_DICH_VU_COSAN') return 'Thuê dịch vụ CNTT có sẵn';
                  return code;
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasDirtyChanges && activeTab === 'steps' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                <span className="material-symbols-outlined text-sm">edit_note</span>
                {Object.keys(drafts).length} thay đổi
              </span>
            )}
            {activeProcedure && !hasAnyWorklog && (
              <button
                type="button"
                title="Xoá bước cũ và tạo lại toàn bộ từ mẫu thủ tục (template) hiện tại"
                onClick={async () => {
                  if (!confirm('Đồng bộ lại sẽ XOÁ toàn bộ bước hiện tại (bao gồm worklog, RACI) và tạo lại từ mẫu template.\n\nBạn chắc chắn?')) return;
                  try {
                    setIsLoading(true);
                    await resyncProcedure(activeProcedure.id);
                    // Clear toàn bộ cache local — worklogs/RACI cũ đã bị xoá phía server
                    setWorklogs([]);
                    resetProcedureStepWorklogs();
                    resetProcedureRaci();
                    setRaciMatrixPhase(null);
                    resetProcedureStepsState();
                    // Reload steps + RACI sau khi server đã tạo lại dữ liệu
                    const [newSteps] = await Promise.all([
                      fetchProcedureSteps(activeProcedure.id),
                      reloadProcedureRaci(),
                    ]);
                    setSteps(newSteps);
                    onNotify?.('success', 'Thành công', 'Đã đồng bộ lại thủ tục từ mẫu template.');
                  } catch (err: any) {
                    onNotify?.('error', 'Lỗi', err?.message || 'Không thể đồng bộ');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">sync</span>
                Đồng bộ mẫu
              </button>
            )}
          </div>
        </div>

        {/* ══ Tabs ══ */}
        {activeProcedure && (
          <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-slate-200 shrink-0">
            {([
              { key: 'steps',           label: 'Bảng thủ tục',       icon: 'checklist' },
              { key: 'worklog',         label: 'Worklog',             icon: 'history' },
              { key: 'raci',            label: 'RACI',                icon: 'group' },
              { key: 'checklist_admin', label: 'Quản trị checklist',  icon: 'dashboard' },
            ] as { key: ActiveTab; label: string; icon: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`procedure-tab-${tab.key}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-deep-teal text-deep-teal'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
                {tab.key === 'raci' && raciSummaryBadge && (
                  <span className="ml-0.5 text-[10px] font-normal opacity-60">
                    ({raciSummaryBadge})
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto pb-2 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-deep-teal" />
              {overallPercent}% hoàn thành
            </div>
          </div>
        )}

        {/* ══ Content ══ */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin w-8 h-8 border-[3px] border-deep-teal/20 border-t-deep-teal rounded-full" />
              <span className="ml-3 text-slate-500">Đang tải...</span>
            </div>

          ) : !activeProcedure ? (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">checklist</span>
              {!project.investment_mode ? (
                <>
                  <h3 className="text-base font-semibold text-slate-700 mb-1">Chưa xác định loại dự án</h3>
                  <p className="text-sm text-slate-500">Vui lòng cập nhật <strong>Loại dự án</strong> trong thông tin dự án.</p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-700 mb-1">Đang khởi tạo thủ tục...</h3>
                  <p className="text-sm text-slate-500">Vui lòng đóng và mở lại.</p>
                </>
              )}
            </div>

          ) : activeTab === 'steps' ? (
            /* ══════════════════════ TAB: BẢNG THỦ TỤC ══════════════════════ */
            <>
              {/* Progress bar */}
              <div className="bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Tiến độ tổng thể</span>
                  <span className="text-2xl font-black text-deep-teal">{overallPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-deep-teal to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${overallPercent}%` }} />
                </div>
                <div className="flex gap-5 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"/>Hoàn thành: <strong>{completedSteps}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"/>Đang TH: <strong>{inProgressSteps}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300"/>Chưa TH: <strong>{totalSteps - completedSteps - inProgressSteps}</strong></span>
                </div>
              </div>

              {/* Phase groups */}
              <div className="space-y-4">
                {phaseGroups.map((group, gIdx) => (
                  <ProcedurePhaseGroupSection
                    key={group.phase}
                    group={group}
                    groupIndex={gIdx}
                    stats={phaseStats[gIdx]}
                    raciMatrixPhase={raciMatrixPhase}
                    editingPhase={editingPhase}
                    editingPhaseLabel={editingPhaseLabel}
                    phaseLabelSaving={phaseLabelSaving}
                    phaseLabelInputRef={phaseLabelInputRef}
                    onSetEditingPhaseLabel={setEditingPhaseLabel}
                    onSavePhaseLabel={handleSavePhaseLabel}
                    onCancelEditPhase={handleCancelEditPhase}
                    onStartEditPhase={handleStartEditPhase}
                    onToggleRaciMatrixPhase={(phase) => setRaciMatrixPhase((prev) => (prev === phase ? null : phase))}
                    addingInPhase={addingInPhase}
                    addingStepSubmittingPhase={addingStepSubmittingPhase}
                    newStepName={newStepName}
                    newStepUnit={newStepUnit}
                    newStepResult={newStepResult}
                    newStepDays={newStepDays}
                    onSetNewStepName={setNewStepName}
                    onSetNewStepUnit={setNewStepUnit}
                    onSetNewStepResult={setNewStepResult}
                    onSetNewStepDays={setNewStepDays}
                    onToggleAddStep={handleToggleAddStep}
                    onAddStep={handleAddStep}
                    onResetAddStepForm={resetAddStepForm}
                    drafts={drafts}
                    editingStepId={editingStepId}
                    expandedDetails={expandedDetails}
                    addingChildToStepId={addingChildToStepId}
                    addingChildSubmittingStepId={addingChildSubmittingStepId}
                    isAdmin={isAdmin}
                    isRaciA={isRaciA}
                    myId={myId}
                    stepRaciMap={stepRaciMap}
                    raciList={raciList}
                    stepWorklogs={stepWorklogs}
                    stepWorklogInput={stepWorklogInput}
                    stepWorklogHours={stepWorklogHours}
                    stepWorklogDifficulty={stepWorklogDifficulty}
                    stepWorklogProposal={stepWorklogProposal}
                    stepWorklogIssueStatus={stepWorklogIssueStatus}
                    stepWorklogSaving={stepWorklogSaving}
                    editingRowDraft={editingRowDraft}
                    stepAttachments={stepAttachments}
                    attachLoadingStep={attachLoadingStep}
                    openAttachStep={openAttachStep}
                    attachUploading={attachUploading}
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
                    openWorklogStep={openWorklogStep}
                    onDraftChange={handleDraftChange}
                    onStartDateChange={handleStartDateChange}
                    onReorder={handleReorderStepRow}
                    onToggleDetail={handleToggleDetail}
                    onStartEditRow={handleStartEditRow}
                    onCancelEditRow={handleCancelEditRow}
                    onSaveEditRow={handleSaveEditRow}
                    onSetEditingRowDraft={setEditingRowDraft}
                    onDeleteStep={handleDeleteStep}
                    onOpenAttachments={handleOpenProcedureAttachments}
                    onUploadFile={handleUploadStepFile}
                    onDeleteAttachment={handleDeleteAttachment}
                    onToggleWorklog={handleToggleStepWorklog}
                    onAddWorklog={handleAddStepWorklog}
                    onAssignA={handleAssignA}
                    onUpdateIssueStatus={handleUpdateIssueStatus}
                    onStartEditWorklog={handleStartEditWorklog}
                    onCancelEditWorklog={handleCancelEditWorklog}
                    onSaveEditWorklog={handleSaveEditWorklog}
                    onSetWlogInput={handleSetWlogInput}
                    onSetWlogHours={handleSetWlogHours}
                    onSetWlogDifficulty={handleSetWlogDifficulty}
                    onSetWlogProposal={handleSetWlogProposal}
                    onSetWlogIssueStatus={handleSetWlogIssueStatus}
                    onSetEditWorklogContent={setEditWorklogContent}
                    onSetEditWorklogHours={setEditWorklogHours}
                    onSetEditWorklogDiff={setEditWorklogDiff}
                    onSetEditWorklogProposal={setEditWorklogProposal}
                    onSetEditWorklogStatus={setEditWorklogStatus}
                    onToggleAddChild={handleToggleAddChild}
                    onAddChildStep={handleAddChildStep}
                    onSetChildName={setNewChildName}
                    onSetChildUnit={setNewChildUnit}
                    onSetChildDays={setNewChildDays}
                    onSetChildStartDate={setNewChildStartDate}
                    onSetChildEndDate={setNewChildEndDate}
                    onSetChildStatus={setNewChildStatus}
                    onCancelChild={handleCancelChild}
                  />
                ))}
              </div>
            </>

          ) : activeTab === 'worklog' ? (
            <ProcedureWorklogTab
              worklogs={worklogs}
              worklogsLoading={worklogsLoading}
              onRefresh={handleRefreshWorklogs}
            />

          ) : activeTab === 'raci' ? (
            <ProcedureRaciTab
              raciLoading={raciLoading}
              raciUserId={raciUserId}
              raciRole={raciRole}
              raciNote={raciNote}
              raciSaving={raciSaving}
              userOptions={userOptions}
              usersLoading={usersLoading}
              raciList={raciList}
              employeeCache={employeeCache}
              onRaciUserChange={setRaciUserId}
              onUserSearchChange={setUserSearch}
              onRaciRoleChange={setRaciRole}
              onRaciNoteChange={setRaciNote}
              onAddRaci={handleAddRaci}
              onRemoveRaci={handleRemoveRaci}
            />
          ) : activeTab === 'checklist_admin' ? (
            <ProcedureChecklistAdminTab
              steps={steps}
              worklogs={worklogs}
              worklogsLoading={worklogsLoading}
              overallPercent={overallPercent}
              onRefresh={handleRefreshWorklogs}
              onChangeIssueStatus={handleChangeIssueStatus}
            />
          ) : null}

        </div>

        {activeTab === 'steps' && activeMatrixGroup && (
          <RaciMatrixPanel
            phase={activeMatrixGroup.phase}
            phaseLabel={activeMatrixGroup.label}
            steps={activeMatrixGroup.steps
              .filter((step) => !step.parent_step_id)
              .sort((a, b) => a.sort_order - b.sort_order)}
            raciMembers={raciList}
            stepRaciMap={stepRaciMap}
            onToggle={handleToggleStepRaci}
            onCopy={handleCopyStepRaci}
            onClose={() => setRaciMatrixPhase(null)}
          />
        )}

        {/* ══ Footer ══ */}
        {activeProcedure && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl shrink-0">
            <div className="text-xs text-slate-400">
              {totalSteps} bước chính • {completedSteps} hoàn thành • {overallPercent}%
              {raciList.length > 0 && <> • {raciList.length} phân công RACI</>}
            </div>
            <div className="flex gap-3">
              <button onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Đóng
              </button>
              {activeTab === 'steps' && (
                <button
                  data-testid="procedure-save"
                  onClick={handleSave}
                  disabled={!hasDirtyChanges || isSaving}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                    hasDirtyChanges ? 'bg-deep-teal text-white hover:bg-deep-teal/90 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSaving
                    ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />Đang lưu...</span>
                    : <>Lưu thay đổi{hasDirtyChanges ? ` (${Object.keys(drafts).length})` : ''}</>
                  }
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
