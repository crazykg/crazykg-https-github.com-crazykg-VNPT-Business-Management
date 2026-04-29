import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { computeDurationDays, computeEndDate, formatProcedureDatePlaceholder } from '../utils/procedureHelpers';
import {
  Project,
  AuthUser,
  ProcedureTemplate,
  ProjectProcedure,
  ProjectProcedureStep,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  IssueStatus,
  ProcedureExportFormat,
  ProjectTypeOption,
} from '../types';
import {
  createProcedurePublicShare,
  exportProjectProcedure,
  fetchProcedureTemplates,
  fetchProjectProcedures,
  createProjectProcedure,
  fetchProcedureSteps,
  updateIssueStatus,
  fetchProcedureWorklogs,
  resyncProcedure,
} from '../services/api/projectApi';
import { hasPermission } from '../utils/authorization';
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

const PROCEDURE_TABS: { key: ActiveTab; label: string; icon: string }[] = [
  { key: 'steps', label: 'Bảng thủ tục', icon: 'checklist' },
  { key: 'worklog', label: 'Worklog', icon: 'history' },
  { key: 'raci', label: 'RACI', icon: 'group' },
  { key: 'checklist_admin', label: 'Quản trị checklist', icon: 'dashboard' },
];

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

const normalizeStepKey = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : String(value);

const compareProcedureStepOrder = (left: ProjectProcedureStep, right: ProjectProcedureStep): number => {
  const orderDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const numberDiff = Number(left.step_number ?? 0) - Number(right.step_number ?? 0);
  if (numberDiff !== 0) return numberDiff;
  return normalizeStepKey(left.id).localeCompare(normalizeStepKey(right.id), 'vi');
};

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }, 1000);
};

const buildPublicProcedureUrl = (token: string): string => {
  const encodedToken = encodeURIComponent(token);
  return `${window.location.origin}/public/project-procedure/${encodedToken}`;
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

const formatShareExpiry = (value: string | null | undefined): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

function buildStepDisplayNumberMap(phaseGroups: PhaseGroup[]): Record<string, string> {
  const displayNumbers: Record<string, string> = {};

  phaseGroups.forEach((group) => {
    const parents = group.steps
      .filter((step) => !step.parent_step_id)
      .sort(compareProcedureStepOrder);
    const childrenByParentId = new Map<string, ProjectProcedureStep[]>();

    group.steps
      .filter((step) => step.parent_step_id != null)
      .forEach((step) => {
        const parentKey = normalizeStepKey(step.parent_step_id);
        const children = childrenByParentId.get(parentKey) ?? [];
        children.push(step);
        childrenByParentId.set(parentKey, children);
      });

    childrenByParentId.forEach((children) => children.sort(compareProcedureStepOrder));
    parents.forEach((parent, parentIndex) => {
      const parentNumber = String(parentIndex + 1);
      const parentKey = normalizeStepKey(parent.id);
      displayNumbers[parentKey] = parentNumber;
      (childrenByParentId.get(parentKey) ?? []).forEach((child, childIndex) => {
        displayNumbers[normalizeStepKey(child.id)] = `${parentNumber}.${childIndex + 1}`;
      });
    });
  });

  return displayNumbers;
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ProcedureExportFormat | null>(null);
  const [isCreatingPublicShare, setIsCreatingPublicShare] = useState(false);

  // ── Worklog state ──
  const [worklogs,        setWorklogs]        = useState<ProcedureStepWorklog[]>([]);
  const [worklogsLoading, setWorklogsLoading] = useState(false);

  // ── RACI state ──
  const [raciMatrixPhase, setRaciMatrixPhase] = useState<string | null>(null);
  const [collapsedPhaseCodes, setCollapsedPhaseCodes] = useState<Set<string>>(new Set());
  const collapseInitializedProcedureRef = useRef<string | null>(null);

  const autoCreatedRef   = useRef(false);
  // ── Inflight guard — prevent double-submit on any save action ──
  const inflightRef = useRef<Set<string>>(new Set());
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const procedureDatePlaceholder = useMemo(() => formatProcedureDatePlaceholder(), [isOpen, project.id]);

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
    existingAccountable,
    showAccountableConfirm,
    raciSummaryBadge,
    setRaciUserId,
    handleProcedureRaciRoleChange,
    setRaciNote,
    setUserSearch,
    resetProcedureRaci,
    reloadProcedureRaci,
    handleConfirmAccountableReplacement,
    handleCancelAccountableReplacement,
    handleAddRaci,
    handleRemoveRaci,
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
    handleEndDateChange,
    handleDateRangeBlur,
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
    deletingWorklogId,
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
    handleDeleteStepWorklog,
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
      setCollapsedPhaseCodes(new Set());
      collapseInitializedProcedureRef.current = null;
      resetProcedureStepsState();
      return;
    }
    setIsLoading(true);
    // Clear stale cache của các tab phụ ngay khi procedure thay đổi
    resetProcedureStepsState();
    setWorklogs([]);
    setCollapsedPhaseCodes(new Set());
    collapseInitializedProcedureRef.current = null;
    resetProcedureStepWorklogs();
    resetProcedureAttachments();
    fetchProcedureSteps(activeProcedure.id)
      .then((stepsData) => {
        setSteps(stepsData);
      })
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message || 'Không thể tải bước')))
      .finally(() => setIsLoading(false));
  }, [activeProcedure?.id, resetProcedureAttachments, resetProcedureStepWorklogs, resetProcedureStepsState]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isExportMenuOpen]);

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
  const stepDisplayNumberById = useMemo(() => buildStepDisplayNumberMap(phaseGroups), [phaseGroups]);
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
    () => {
      if (raciMatrixPhase && collapsedPhaseCodes.has(raciMatrixPhase)) return null;
      return phaseGroups.find((group) => group.phase === raciMatrixPhase) ?? null;
    },
    [collapsedPhaseCodes, phaseGroups, raciMatrixPhase],
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
          const durationDays = Number(stepDraft.duration_days ?? s.duration_days ?? 0);
          const endDate = startDate && durationDays > 0
            ? computeEndDate(startDate, durationDays)
            : hasDraftEnd
              ? (stepDraft.actual_end_date ?? null)
              : (s.actual_end_date ?? null);

          if (!startDate || !endDate || computeDurationDays(startDate, endDate) === null) return acc;

          acc.stepsWithDates += 1;
          acc.minDate = !acc.minDate || startDate < acc.minDate ? startDate : acc.minDate;
          acc.maxDate = !acc.maxDate || endDate > acc.maxDate ? endDate : acc.maxDate;
          return acc;
        },
        { minDate: null as string | null, maxDate: null as string | null, stepsWithDates: 0 },
      );
      const calendarDays = minDate && maxDate ? computeDurationDays(minDate, maxDate) : null;

      return {
        total: top.length,
        completed,
        percent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
        totalDays: top.reduce((sum: number, s: ProjectProcedureStep) => {
          const draftDays = drafts[String(s.id)]?.duration_days;
          return sum + (Number(draftDays ?? s.duration_days ?? 0) || 0);
        }, 0),
        calendarDays,
        dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
        stepsWithDates,
        isAllDone: completed === top.length && top.length > 0,
      };
    }),
    [phaseGroups, drafts],
  );
  useEffect(() => {
    if (!activeProcedure || phaseGroups.length === 0) return;
    const procedureKey = String(activeProcedure.id);
    if (collapseInitializedProcedureRef.current === procedureKey) return;

    const hasOpenStepPanel = openWorklogStep !== null || openAttachStep !== null;
    const hasActiveRowWork = editingStepId !== null || addingChildToStepId !== null || addingInPhase !== null;
    const hasDrafts = Object.keys(drafts).length > 0;
    if (hasOpenStepPanel || hasActiveRowWork || hasDrafts) return;

    const completedPhaseCodes = phaseGroups
      .filter((group, index) => phaseStats[index]?.isAllDone)
      .map((group) => group.phase);

    setCollapsedPhaseCodes(new Set(completedPhaseCodes));
    collapseInitializedProcedureRef.current = procedureKey;
  }, [
    activeProcedure,
    addingChildToStepId,
    addingInPhase,
    drafts,
    editingStepId,
    openAttachStep,
    openWorklogStep,
    phaseGroups,
    phaseStats,
  ]);
  useEffect(() => {
    if (raciMatrixPhase && collapsedPhaseCodes.has(raciMatrixPhase)) {
      setRaciMatrixPhase(null);
    }
  }, [collapsedPhaseCodes, raciMatrixPhase]);

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
  const canExportProcedure = useMemo(() => hasPermission(authUser ?? null, 'projects.read'), [authUser]);
  const canCreatePublicShare = useMemo(() => hasPermission(authUser ?? null, 'projects.write'), [authUser]);

  // ── Handlers — steps ──

  const handleChangeIssueStatus = useCallback(async (
    issueId: string | number,
    newStatus: IssueStatus,
  ) => {
    try {
      const updated = await updateIssueStatus(issueId, newStatus);
      const nextStatus = updated?.issue_status ?? newStatus;
      setWorklogs((prev) => prev.map((w) =>
        w.issue && String(w.issue.id) === String(issueId)
          ? { ...w, issue: { ...w.issue, issue_status: nextStatus } }
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
    setCollapsedPhaseCodes(new Set());
    collapseInitializedProcedureRef.current = null;
    resetProcedureStepWorklogs();
    resetProcedureAttachments();
    onClose();
  }, [hasDirtyChanges, onClose, resetProcedureAttachments, resetProcedureRaci, resetProcedureStepWorklogs, resetProcedureStepsState]);

  useEscKey(handleClose, isOpen);

  const handleReorderStepRow = useCallback((step: ProjectProcedureStep, direction: 'up' | 'down') => {
    return handleReorderStep(steps, step, direction);
  }, [handleReorderStep, steps]);
  const handleTogglePhaseCollapsed = useCallback((phase: string) => {
    const shouldCollapse = !collapsedPhaseCodes.has(phase);
    setCollapsedPhaseCodes((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
    if (shouldCollapse) {
      setRaciMatrixPhase((current) => (current === phase ? null : current));
    }
  }, [collapsedPhaseCodes]);

  const handleExportProcedure = useCallback(async (format: ProcedureExportFormat) => {
    setIsExportMenuOpen(false);
    if (!activeProcedure) return;
    if (!canExportProcedure) {
      onNotify?.('error', 'Xuất thủ tục', 'Bạn không có quyền xuất dữ liệu thủ tục.');
      return;
    }
    if (hasDirtyChanges) {
      onNotify?.('error', 'Xuất thủ tục', 'Vui lòng lưu thay đổi trước khi xuất dữ liệu.');
      return;
    }

    try {
      setExportingFormat(format);
      const result = await exportProjectProcedure(activeProcedure.id, format);
      triggerBrowserDownload(result.blob, result.filename);
      onNotify?.('success', 'Xuất thủ tục', `Đã tải file ${format === 'word' ? 'Word' : 'Excel'}.`);
    } catch (error) {
      onNotify?.(
        'error',
        'Xuất thủ tục',
        error instanceof Error ? error.message : 'Không thể xuất dữ liệu thủ tục.'
      );
    } finally {
      setExportingFormat(null);
    }
  }, [activeProcedure, canExportProcedure, hasDirtyChanges, onNotify]);

  const handleCreatePublicShare = useCallback(async () => {
    if (!activeProcedure) return;
    if (!canCreatePublicShare) {
      onNotify?.('error', 'Public thủ tục', 'Bạn không có quyền public bảng thủ tục.');
      return;
    }
    if (hasDirtyChanges) {
      onNotify?.('error', 'Public thủ tục', 'Vui lòng lưu thay đổi trước khi tạo link public.');
      return;
    }

    try {
      setIsCreatingPublicShare(true);
      const result = await createProcedurePublicShare(activeProcedure.id);
      const publicUrl = buildPublicProcedureUrl(result.token);
      const copied = await copyToClipboard(publicUrl);
      const expiresAt = formatShareExpiry(result.expires_at);
      onNotify?.(
        'success',
        'Public thủ tục',
        `${copied ? 'Đã tạo và copy link public.' : `Đã tạo link public: ${publicUrl}`} Link hết hạn${expiresAt ? ` lúc ${expiresAt}` : ' sau 7 ngày'}.`
      );
    } catch (error) {
      onNotify?.(
        'error',
        'Public thủ tục',
        error instanceof Error ? error.message : 'Không thể tạo link public.'
      );
    } finally {
      setIsCreatingPublicShare(false);
    }
  }, [activeProcedure, canCreatePublicShare, hasDirtyChanges, onNotify]);

  const handleProcedureTabKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ActiveTab,
  ) => {
    const currentIndex = PROCEDURE_TABS.findIndex((tab) => tab.key === currentTab);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % PROCEDURE_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + PROCEDURE_TABS.length) % PROCEDURE_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = PROCEDURE_TABS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = PROCEDURE_TABS[nextIndex];
    setActiveTab(nextTab.key);
    window.requestAnimationFrame(() => {
      document.getElementById(`procedure-tab-${nextTab.key}`)?.focus();
    });
  }, []);

  const activeMatrixSteps = useMemo(() => {
    if (!activeMatrixGroup) return [];
    return activeMatrixGroup.steps
      .filter((step) => !step.parent_step_id)
      .slice()
      .sort(compareProcedureStepOrder);
  }, [activeMatrixGroup]);

  if (!isOpen) return null;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 ui-layer-modal flex items-start justify-center overflow-hidden bg-[var(--ui-modal-backdrop)] p-3 sm:p-4">
      <div
        data-testid="project-procedure-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Thủ tục dự án ${project.project_code || project.project_name || ''}`.trim()}
        className="relative flex w-full max-w-[1600px] flex-col rounded-[var(--ui-modal-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] shadow-cloud max-h-[var(--ui-modal-max-height)]"
      >

        {/* ══ Header ══ */}
        <div className="flex min-h-[var(--ui-modal-header-min-height)] shrink-0 items-center justify-between rounded-t-[var(--ui-modal-radius)] border-b border-slate-200 bg-[var(--ui-surface-bg)] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Đóng modal thủ tục"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            </button>
            <div className="w-7 h-7 rounded bg-primary-container-soft flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>account_tree</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-deep-teal leading-tight">
                Thủ tục: {project.project_code} — {project.project_name}
              </h2>
              <p className="text-[11px] text-slate-600 leading-tight">
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasDirtyChanges && activeTab === 'steps' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
                {Object.keys(drafts).length} thay đổi
              </span>
            )}
            {activeProcedure && canExportProcedure && (
              <div ref={exportMenuRef} className="relative">
                <button
                  type="button"
                  data-testid="procedure-export-menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={isExportMenuOpen}
                  onClick={() => setIsExportMenuOpen((open) => !open)}
                  disabled={exportingFormat !== null}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {exportingFormat ? 'progress_activity' : 'download'}
                  </span>
                  Xuất
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                {isExportMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Xuất dữ liệu thủ tục"
                    className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="procedure-export-word"
                      onClick={() => handleExportProcedure('word')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-[15px]" aria-hidden="true">description</span>
                      Word (.docx)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="procedure-export-excel"
                      onClick={() => handleExportProcedure('excel')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-[15px]" aria-hidden="true">table_view</span>
                      Excel (.xls)
                    </button>
                  </div>
                )}
              </div>
            )}
            {activeProcedure && canCreatePublicShare && (
              <button
                type="button"
                data-testid="procedure-public-share"
                onClick={handleCreatePublicShare}
                disabled={isCreatingPublicShare}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-primary bg-white px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`material-symbols-outlined ${isCreatingPublicShare ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>
                  {isCreatingPublicShare ? 'progress_activity' : 'ios_share'}
                </span>
                Public
              </button>
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
                className="inline-flex items-center gap-1.5 rounded border border-primary bg-white px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-600 disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync</span>
                Đồng bộ mẫu
              </button>
            )}
          </div>
        </div>

        {/* ══ Tabs ══ */}
        {activeProcedure && (
          <div
            role="tablist"
            aria-label="Điều hướng thủ tục dự án"
            className="flex items-center gap-0.5 border-b border-slate-200 bg-[var(--ui-surface-bg)] px-4 pt-3 pb-0 shrink-0"
          >
            {PROCEDURE_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab.key}
                id={`procedure-tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`procedure-tabpanel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => handleProcedureTabKeyDown(event, tab.key)}
                data-testid={`procedure-tab-${tab.key}`}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  activeTab === tab.key
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-transparent text-slate-700 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 15 }}>{tab.icon}</span>
                {tab.label}
                {tab.key === 'raci' && raciSummaryBadge && (
                  <span className="ml-0.5 rounded bg-primary/8 px-1 py-0.5 text-[10px] font-semibold text-primary">
                    ({raciSummaryBadge})
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto pb-2 text-[11px] text-slate-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-deep-teal" />
              {overallPercent}% hoàn thành
            </div>
          </div>
        )}

        {/* ══ Content ══ */}
        <div
          {...(activeProcedure
            ? {
                id: `procedure-tabpanel-${activeTab}`,
                role: 'tabpanel',
                'aria-labelledby': `procedure-tab-${activeTab}`,
              }
            : {})}
          className="flex-1 overflow-y-auto overscroll-contain bg-[var(--ui-surface-subtle)] px-4 py-4"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-7 h-7 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
              <span className="ml-3 text-sm text-slate-500">Đang tải...</span>
            </div>

          ) : !activeProcedure ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="material-symbols-outlined text-slate-500 mb-3" style={{ fontSize: 48 }}>checklist</span>
              {!project.investment_mode ? (
                <>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">Chưa xác định loại dự án</h3>
                  <p className="text-xs text-slate-500">Vui lòng cập nhật <strong>Loại dự án</strong> trong thông tin dự án.</p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">Đang khởi tạo thủ tục...</h3>
                  <p className="text-xs text-slate-500">Vui lòng đóng và mở lại.</p>
                </>
              )}
            </div>

          ) : activeTab === 'steps' ? (
            /* ══════════════════════ TAB: BẢNG THỦ TỤC ══════════════════════ */
            <>
              {/* Progress bar */}
              <div className="rounded-lg border border-[var(--ui-border)] bg-white shadow-sm p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral">Tiến độ tổng thể</span>
                  <span className="text-xl font-black text-deep-teal">{overallPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 ring-1 ring-inset ring-slate-500 overflow-hidden mb-2">
                  <div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{ width: `${overallPercent}%` }} />
                </div>
                <div className="flex gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--ui-success-fg)]"/>Hoàn thành: <strong>{completedSteps}</strong></span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-tertiary"/>Đang TH: <strong>{inProgressSteps}</strong></span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"/>Chưa TH: <strong>{totalSteps - completedSteps - inProgressSteps}</strong></span>
                </div>
              </div>

              {/* Phase groups */}
              <div className="space-y-3">
                {phaseGroups.map((group, gIdx) => (
                  <ProcedurePhaseGroupSection
                    key={group.phase}
                    group={group}
                    groupIndex={gIdx}
                    stats={phaseStats[gIdx]}
                    datePlaceholder={procedureDatePlaceholder}
                    isCollapsed={collapsedPhaseCodes.has(group.phase)}
                    raciMatrixPhase={raciMatrixPhase}
                    editingPhase={editingPhase}
                    editingPhaseLabel={editingPhaseLabel}
                    phaseLabelSaving={phaseLabelSaving}
                    phaseLabelInputRef={phaseLabelInputRef}
                    onSetEditingPhaseLabel={setEditingPhaseLabel}
                    onSavePhaseLabel={handleSavePhaseLabel}
                    onCancelEditPhase={handleCancelEditPhase}
                    onStartEditPhase={handleStartEditPhase}
                    onToggleCollapsed={handleTogglePhaseCollapsed}
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
                    deletingWorklogId={deletingWorklogId}
                    openWorklogStep={openWorklogStep}
                    onDraftChange={handleDraftChange}
                    onStartDateChange={handleStartDateChange}
                    onEndDateChange={handleEndDateChange}
                    onDateRangeBlur={handleDateRangeBlur}
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
                    onUpdateIssueStatus={handleUpdateIssueStatus}
                    onStartEditWorklog={handleStartEditWorklog}
                    onCancelEditWorklog={handleCancelEditWorklog}
                    onSaveEditWorklog={handleSaveEditWorklog}
                    onDeleteWorklog={handleDeleteStepWorklog}
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
              existingAccountable={existingAccountable}
              showAccountableConfirm={showAccountableConfirm}
              onRaciUserChange={setRaciUserId}
              onUserSearchChange={setUserSearch}
              onRaciRoleChange={handleProcedureRaciRoleChange}
              onRaciNoteChange={setRaciNote}
              onConfirmAccountableReplacement={handleConfirmAccountableReplacement}
              onCancelAccountableReplacement={handleCancelAccountableReplacement}
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
            steps={activeMatrixSteps}
            displayNumberByStepId={stepDisplayNumberById}
            raciMembers={raciList}
            stepRaciMap={stepRaciMap}
            onToggle={handleToggleStepRaci}
            onCopy={handleCopyStepRaci}
            onClose={() => setRaciMatrixPhase(null)}
          />
        )}

        {/* ══ Footer ══ */}
        {activeProcedure && (
          <div className="flex min-h-[var(--ui-modal-footer-min-height)] shrink-0 items-center justify-between rounded-b-[var(--ui-modal-radius)] border-t border-slate-200 bg-[var(--ui-surface-subtle)] px-4 py-3">
            <div className="text-[11px] text-slate-600">
              {totalSteps} bước chính • {completedSteps} hoàn thành • {overallPercent}%
              {raciList.length > 0 && <> • {raciList.length} phân công RACI</>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleClose} className="inline-flex items-center gap-1.5 rounded border border-slate-500 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60">
                Đóng
              </button>
              {activeTab === 'steps' && (
                <button
                  data-testid="procedure-save"
                  onClick={handleSave}
                  disabled={!hasDirtyChanges || isSaving}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 ${
                    hasDirtyChanges ? 'bg-primary text-white hover:bg-deep-teal' : 'bg-slate-200 text-slate-700 cursor-not-allowed'
                  }`}
                >
                  {isSaving
                    ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full" />Đang lưu...</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>Lưu{hasDirtyChanges ? ` (${Object.keys(drafts).length})` : ''}</>
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
