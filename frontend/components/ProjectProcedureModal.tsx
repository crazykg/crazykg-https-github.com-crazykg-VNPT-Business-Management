import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { computeEndDate } from '../utils/procedureHelpers';
import {
  Project,
  AuthUser,
  ProcedureTemplate,
  ProjectProcedure,
  ProjectProcedureStep,
  ProcedureStepStatus,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  ProcedureStepRaciEntry,
  ProcedureRaciRole,
  IssueStatus,
  Employee,
  ProjectTypeOption,
} from '../types';
import { fetchEmployeesOptionsPage } from '../services/v5Api';
import {
  fetchProcedureTemplates,
  fetchProjectProcedures,
  createProjectProcedure,
  fetchProcedureSteps,
  updateIssueStatus,
  fetchProcedureRaci,
  fetchStepRaciBulk,
  addProcedureRaci,
  removeProcedureRaci,
  addStepRaci,
  removeStepRaci,
  batchSetStepRaci,
  fetchProcedureWorklogs,
  resyncProcedure,
} from '../services/api/projectApi';
import { ProcedureChecklistAdminTab } from './procedure/ProcedureChecklistAdminTab';
import { ProcedureRaciTab } from './procedure/ProcedureRaciTab';
import { ProcedureWorklogTab } from './procedure/ProcedureWorklogTab';
import { StepRow } from './procedure/StepRow';
import { RaciMatrixPanel } from './procedure/RaciMatrixPanel';
import { useProcedureAttachments } from './procedure/hooks/useProcedureAttachments';
import { useProcedureStepsState } from './procedure/hooks/useProcedureStepsState';
import { useProcedureStepWorklogs } from './procedure/hooks/useProcedureStepWorklogs';
import type { SearchableSelectOption } from './SearchableSelect';
import { getEmployeeLabel, resolvePositionName } from '../utils/employeeDisplay';
import { PHASE_LABELS } from '../constants';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_STATUS_OPTIONS: { value: ProcedureStepStatus; label: string; color: string; dot: string }[] = [
  { value: 'CHUA_THUC_HIEN', label: 'Chưa TH',    color: 'text-slate-400', dot: 'bg-slate-300' },
  { value: 'DANG_THUC_HIEN', label: 'Đang TH',    color: 'text-amber-600', dot: 'bg-amber-400' },
  { value: 'HOAN_THANH',     label: 'Hoàn thành', color: 'text-emerald-600', dot: 'bg-emerald-500' },
];

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

const ROW_BG: Record<ProcedureStepStatus, string> = {
  HOAN_THANH:     'bg-emerald-50/60',
  DANG_THUC_HIEN: 'bg-amber-50/60',
  CHUA_THUC_HIEN: '',
};

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'steps' | 'worklog' | 'raci' | 'checklist_admin';
type StepRaciCopyMode = 'overwrite' | 'merge';

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

function groupStepRaciByStep(entries: ProcedureStepRaciEntry[]): Record<string, ProcedureStepRaciEntry[]> {
  return entries.reduce<Record<string, ProcedureStepRaciEntry[]>>((acc, entry) => {
    const key = String(entry.step_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
}

function mergeStepRaciEntry(
  prev: Record<string, ProcedureStepRaciEntry[]>,
  entry: ProcedureStepRaciEntry,
): Record<string, ProcedureStepRaciEntry[]> {
  const stepKey = String(entry.step_id);
  const existing = prev[stepKey] ?? [];
  const filtered = existing.filter((row) => {
    if (String(row.user_id) === String(entry.user_id) && row.raci_role === entry.raci_role) return false;
    if (entry.raci_role === 'A' && row.raci_role === 'A') return false;
    return true;
  });
  return { ...prev, [stepKey]: [...filtered, entry] };
}

function removeStepRaciEntry(
  prev: Record<string, ProcedureStepRaciEntry[]>,
  raciId: string | number,
): Record<string, ProcedureStepRaciEntry[]> {
  const next: Record<string, ProcedureStepRaciEntry[]> = {};
  for (const stepKey of Object.keys(prev)) {
    const rows = prev[stepKey] ?? [];
    const filtered = rows.filter((row) => String(row.id) !== String(raciId));
    if (filtered.length > 0) next[stepKey] = filtered;
  }
  return next;
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

function formatMonthYear(dateStr: string | null | undefined): string {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return '';
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProjectProcedureModal: React.FC<ProjectProcedureModalProps> = ({
  project, isOpen, onClose, onNotify, projectTypes = [], authUser,
}) => {

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
  const [raciList,      setRaciList]      = useState<ProcedureRaciEntry[]>([]);
  const [stepRaciMap,   setStepRaciMap]   = useState<Record<string, ProcedureStepRaciEntry[]>>({});
  const [raciMatrixPhase, setRaciMatrixPhase] = useState<string | null>(null);
  const [raciLoading,   setRaciLoading]   = useState(false);
  const [raciUserId,    setRaciUserId]    = useState('');
  const [raciRole,      setRaciRole]      = useState<ProcedureRaciRole>('R');
  const [raciNote,      setRaciNote]      = useState('');
  const [raciSaving,    setRaciSaving]    = useState(false);
  // ── RACI user search ──
  const [userSearch,    setUserSearch]    = useState('');
  const [userOptions,   setUserOptions]   = useState<SearchableSelectOption[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(false);
  const [employeeCache, setEmployeeCache] = useState<Map<string, Employee>>(new Map());

  const autoCreatedRef   = useRef(false);
  // ── Inflight guard — prevent double-submit on any save action ──
  const inflightRef = useRef<Set<string>>(new Set());

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

  // ── Load employee options for RACI user picker (debounced) ──
  useEffect(() => {
    if (activeTab !== 'raci') return;
    setUsersLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchEmployeesOptionsPage(userSearch, 1, 40);
        const data: Employee[] = (res as any).data ?? (Array.isArray(res) ? res : []);
        const newCache = new Map(employeeCache);
        const opts: SearchableSelectOption[] = data.map((e) => {
          newCache.set(String(e.id), e);
          const position = resolvePositionName(e);
          const label = `${getEmployeeLabel(e)}${position ? ` — ${position}` : ''}`;
          return {
            value: String(e.id),
            label,
            searchText: [e.user_code, e.full_name, e.job_title_raw, e.username, position]
              .filter(Boolean).join(' '),
          };
        });
        setUserOptions(opts);
        setEmployeeCache(newCache);
      } catch { /* silent */ }
      finally { setUsersLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch, activeTab]);

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
      setStepRaciMap({});
      setRaciMatrixPhase(null);
      resetProcedureStepsState();
      return;
    }
    setIsLoading(true);
    // Clear stale cache của các tab phụ ngay khi procedure thay đổi
    resetProcedureStepsState();
    setWorklogs([]);
    resetProcedureStepWorklogs();
    setRaciList([]);
    setStepRaciMap({});
    resetProcedureAttachments();
    // Load steps + RACI song song để badge hiện ngay không cần vào tab RACI trước
    Promise.all([
      fetchProcedureSteps(activeProcedure.id),
      fetchProcedureRaci(activeProcedure.id).catch(() => [] as typeof raciList),
      fetchStepRaciBulk(activeProcedure.id).catch(() => [] as ProcedureStepRaciEntry[]),
    ])
      .then(([stepsData, raciData, stepRaciData]) => {
        setSteps(stepsData);
        setRaciList(raciData);
        setStepRaciMap(groupStepRaciByStep(stepRaciData));
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

  // ── Load RACI khi chuyển tab (refresh + guard không fetch lại nếu đã có) ──
  useEffect(() => {
    if (activeTab !== 'raci' || !activeProcedure) return;
    // Đã eager-load khi mở procedure — chỉ refresh nếu raciList rỗng (reset khi đổi procedure)
    if (raciList.length > 0) return;
    setRaciLoading(true);
    fetchProcedureRaci(activeProcedure.id)
      .then(setRaciList)
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message)))
      .finally(() => setRaciLoading(false));
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

  // RACI grouped by role
  const raciByRole = useMemo(() => {
    const g: Record<ProcedureRaciRole, ProcedureRaciEntry[]> = { R: [], A: [], C: [], I: [] };
    for (const r of raciList) { g[r.raci_role]?.push(r); }
    return g;
  }, [raciList]);

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

  // Badge đếm nhanh RACI — hiện trên tab bar (ví dụ: "2R, 1A, 1C")
  const raciSummaryBadge = useMemo(() => {
    if (!raciList.length) return '';
    return (['R', 'A', 'C', 'I'] as ProcedureRaciRole[])
      .filter((r) => raciByRole[r].length > 0)
      .map((r) => `${raciByRole[r].length}${r}`)
      .join(', ');
  }, [raciByRole, raciList]);

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
    setActiveProcedure(null); setSteps([]); setWorklogs([]); setRaciList([]);
    setStepRaciMap({});
    setRaciMatrixPhase(null);
    resetProcedureStepWorklogs();
    resetProcedureAttachments();
    onClose();
  }, [hasDirtyChanges, onClose, resetProcedureAttachments, resetProcedureStepWorklogs, resetProcedureStepsState]);

  useEscKey(handleClose, isOpen);

  // ── Handlers — RACI ──

  const handleAddRaci = useCallback(async () => {
    const key = 'raci-add';
    if (inflightRef.current.has(key)) return;          // ← block double-submit
    if (!activeProcedure || !raciUserId) return;
    inflightRef.current.add(key);
    setRaciSaving(true);
    try {
      const entry = await addProcedureRaci(activeProcedure.id, {
        user_id: raciUserId, raci_role: raciRole, note: raciNote || undefined,
      });
      setRaciList((prev) => {
        const filtered = prev.filter(
          (r) => !(String(r.user_id) === String(entry.user_id) && r.raci_role === entry.raci_role)
        );
        return [...filtered, entry];
      });
      setRaciUserId(''); setRaciNote(''); setUserSearch('');
      onNotify?.('success', 'RACI', 'Đã thêm phân công RACI');
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm RACI');
    } finally {
      inflightRef.current.delete('raci-add');
      setRaciSaving(false);
    }
  }, [activeProcedure, raciUserId, raciRole, raciNote]);

  const handleRemoveRaci = useCallback(async (entry: ProcedureRaciEntry) => {
    try {
      await removeProcedureRaci(entry.id);
      setRaciList((prev) => prev.filter((r) => r.id !== entry.id));
      setStepRaciMap((prev) => {
        const next: Record<string, ProcedureStepRaciEntry[]> = {};
        for (const stepId of Object.keys(prev)) {
          const rows = prev[stepId] ?? [];
          const filtered = rows.filter((row) => String(row.user_id) !== String(entry.user_id));
          if (filtered.length > 0) next[stepId] = filtered;
        }
        return next;
      });
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa RACI');
    }
  }, []);

  const handleAddStepRaci = useCallback(async (
    stepId: string | number,
    userId: string | number,
    role: ProcedureRaciRole,
  ) => {
    const key = `step-raci-add:${stepId}:${userId}:${role}`;
    if (inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    try {
      const entry = await addStepRaci(stepId, { user_id: userId, raci_role: role });
      setStepRaciMap((prev) => mergeStepRaciEntry(prev, entry));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm phân công bước');
    } finally {
      inflightRef.current.delete(key);
    }
  }, []);

  const handleRemoveStepRaci = useCallback(async (raciId: string | number) => {
    const key = `step-raci-remove:${raciId}`;
    if (inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    try {
      await removeStepRaci(raciId);
      setStepRaciMap((prev) => removeStepRaciEntry(prev, raciId));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa phân công bước');
    } finally {
      inflightRef.current.delete(key);
    }
  }, []);

  const handleAssignA = useCallback(async (stepId: string | number, userId: string | number) => {
    const stepKey = String(stepId);
    const currentA = (stepRaciMap[stepKey] ?? []).find((entry) => entry.raci_role === 'A') ?? null;
    if (currentA && String(currentA.user_id) === String(userId)) {
      await handleRemoveStepRaci(currentA.id);
      return;
    }
    await handleAddStepRaci(stepId, userId, 'A');
  }, [stepRaciMap, handleAddStepRaci, handleRemoveStepRaci]);

  const handleToggleStepRaci = useCallback(async (
    stepId: string | number,
    userId: string | number,
    role: ProcedureRaciRole,
  ) => {
    const existing = (stepRaciMap[String(stepId)] ?? []).find(
      (entry) => String(entry.user_id) === String(userId) && entry.raci_role === role,
    );

    if (existing) {
      await handleRemoveStepRaci(existing.id);
      return;
    }

    if (role === 'A') {
      await handleAssignA(stepId, userId);
      return;
    }

    await handleAddStepRaci(stepId, userId, role);
  }, [stepRaciMap, handleAddStepRaci, handleAssignA, handleRemoveStepRaci]);

  const handleCopyStepRaci = useCallback(async (
    sourceStepId: string | number,
    targetStepIds: Array<string | number>,
    mode: StepRaciCopyMode,
  ) => {
    if (!activeProcedure || targetStepIds.length === 0) return;
    const sourceEntries = stepRaciMap[String(sourceStepId)] ?? [];
    if (sourceEntries.length === 0) return;

    const key = `step-raci-copy:${sourceStepId}:${mode}:${targetStepIds.map(String).join(',')}`;
    if (inflightRef.current.has(key)) return;
    inflightRef.current.add(key);

    try {
      const assignments = targetStepIds.flatMap((stepId) =>
        sourceEntries.map((entry) => ({
          step_id: stepId,
          user_id: entry.user_id,
          raci_role: entry.raci_role,
        })),
      );
      const rows = await batchSetStepRaci(activeProcedure.id, { assignments, mode });
      setStepRaciMap(groupStepRaciByStep(rows));
      onNotify?.('success', 'RACI', `Đã sao chép phân công cho ${targetStepIds.length} bước`);
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể sao chép phân công');
    } finally {
      inflightRef.current.delete(key);
    }
  }, [activeProcedure, stepRaciMap]);

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
                    setRaciList([]);
                    setStepRaciMap({});
                    setRaciMatrixPhase(null);
                    resetProcedureStepsState();
                    // Reload steps
                    const newSteps = await fetchProcedureSteps(activeProcedure.id);
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
                {phaseGroups.map((group, gIdx) => {
                  const {
                    total: phTotal,
                    completed: phCompleted,
                    percent: phPercent,
                    isAllDone,
                    totalDays: phTotalDays,
                    calendarDays,
                    dateRange,
                    stepsWithDates,
                  } = phaseStats[gIdx];
                  const phaseRangeLabel = dateRange
                    ? (() => {
                      const minLabel = formatMonthYear(dateRange.min);
                      const maxLabel = formatMonthYear(dateRange.max);
                      if (!minLabel || !maxLabel) return null;
                      return minLabel === maxLabel ? minLabel : `${minLabel} → ${maxLabel}`;
                    })()
                    : null;
                  const isAddingHere = addingInPhase === group.phase;
                  const isAddingStepSubmitting = addingStepSubmittingPhase === group.phase;
                  const childParentIds = new Set(
                    group.steps
                      .filter((s) => s.parent_step_id != null)
                      .map((s) => String(s.parent_step_id))
                  );
                  const stepsInPhase = (group.steps as ProjectProcedureStep[])
                    .filter((s) => !s.parent_step_id)
                    .sort((a, b) => a.sort_order - b.sort_order);

                  return (
                    <div key={group.phase} className="border border-slate-200 rounded-xl overflow-hidden">

                      {/* Phase header — Mục lớn với số thứ tự La Mã */}
                      <div className={`flex items-center justify-between px-4 py-3 ${isAllDone ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-slate-50 border-b border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 shadow-sm ${isAllDone ? 'bg-emerald-500 text-white' : 'bg-deep-teal text-white'}`}>
                            {ROMAN[gIdx] ?? gIdx + 1}
                          </span>
                          <div>
                            {editingPhase === group.phase ? (
                              /* ── Inline edit mode ── */
                              <div className="flex items-center gap-1.5">
                                <input
                                  ref={phaseLabelInputRef}
                                  type="text"
                                  value={editingPhaseLabel}
                                  onChange={(e) => setEditingPhaseLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSavePhaseLabel();
                                    if (e.key === 'Escape') handleCancelEditPhase();
                                  }}
                                  className="h-7 min-w-0 w-40 rounded-lg border border-primary/60 bg-white px-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/25"
                                  placeholder="Tên giai đoạn..."
                                  maxLength={255}
                                  autoComplete="off"
                                  disabled={phaseLabelSaving}
                                />
                                <button
                                  onClick={handleSavePhaseLabel}
                                  disabled={phaseLabelSaving}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-white hover:bg-deep-teal disabled:opacity-50 transition-colors"
                                  title="Lưu tên giai đoạn"
                                >
                                  <span className="material-symbols-outlined text-sm">{phaseLabelSaving ? 'progress_activity' : 'check'}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditPhase}
                                  disabled={phaseLabelSaving}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                  title="Hủy"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              /* ── Display mode ── */
                              <div className="flex items-center gap-1.5 group/phase-label">
                                <span className="text-sm font-bold text-slate-800">{group.label}</span>
                                <button
                                  onClick={() => handleStartEditPhase(group.phase, group.label)}
                                  className="flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover/phase-label:opacity-100 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                                  title="Đổi tên giai đoạn"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </div>
                            )}
                            <span className="mt-0.5 block text-xs text-slate-400">
                              {phCompleted}/{phTotal} bước {isAllDone && '✓'}
                              {phTotalDays > 0 && (
                                <span className="ml-2 text-deep-teal font-medium">• {phTotalDays} ngày công</span>
                              )}
                              {phTotal > 0 && stepsWithDates === phTotal && calendarDays != null ? (
                                <span className={`${phTotalDays > 0 ? 'ml-1' : 'ml-2'} text-slate-500 font-normal`}>
                                  {phTotalDays > 0 ? '· ' : '• '}
                                  {calendarDays} ngày lịch
                                </span>
                              ) : phaseRangeLabel ? (
                                <span className={`${phTotalDays > 0 ? 'ml-1' : 'ml-2'} text-slate-500 font-normal`}>
                                  {phTotalDays > 0 ? '· ' : '• '}
                                  {phaseRangeLabel}
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 ml-2">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isAllDone ? 'bg-emerald-500' : 'bg-deep-teal'}`} style={{ width: `${phPercent}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{phPercent}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRaciMatrixPhase((prev) => (prev === group.phase ? null : group.phase))}
                            data-testid={`phase-raci-${group.phase}`}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-lg transition-colors ${
                              raciMatrixPhase === group.phase
                                ? 'text-violet-700 bg-violet-50 border-violet-200'
                                : 'text-violet-600 bg-white border-violet-200 hover:bg-violet-50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">group</span>
                            Phân công
                          </button>
                          <button
                            onClick={() => handleToggleAddStep(group.phase)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-deep-teal bg-white border border-deep-teal/30 rounded-lg hover:bg-deep-teal/5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">{isAddingHere ? 'close' : 'add'}</span>
                            {isAddingHere ? 'Hủy' : 'Thêm bước'}
                          </button>
                        </div>
                      </div>

                      {/* Steps table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1190px]">
                          <thead className="bg-white border-b border-slate-100">
                            <tr>
                              <th className="px-1 py-2 w-10" title="Xếp thứ tự" />
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[40px]">TT</th>
                              <th className="px-1 py-2 text-[10px] font-bold text-slate-400 uppercase w-[44px] text-center">A</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Trình tự công việc</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[150px]">ĐV chủ trì</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[150px]">Kết quả dự kiến</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[84px] text-center">Ngày</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[110px]">Từ ngày</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[110px]">Đến ngày</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[120px]">Tiến độ</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[140px]">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">history</span>
                                  Worklog
                                </span>
                              </th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[150px]">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">attach_file</span>
                                  File
                                </span>
                              </th>
                              <th className="px-2 py-2 w-[30px]" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {group.steps.map((step) => (
                              <StepRow
                                key={step.id}
                                step={step}
                                draft={drafts[String(step.id)] ?? {}}
                                stepsInPhase={stepsInPhase}
                                isEditing={editingStepId === step.id}
                                isExpanded={expandedDetails.has(step.id)}
                                isWlogOpen={openWorklogStep === step.id}
                                isAttachOpen={openAttachStep === String(step.id)}
                                isAddingChild={addingChildToStepId === step.id}
                                isAddingChildSubmitting={addingChildSubmittingStepId === step.id}
                                hasChildren={childParentIds.has(String(step.id))}
                                isAdmin={isAdmin}
                                isRaciA={isRaciA}
                                myId={myId}
                                stepRaciEntries={stepRaciMap[String(step.id)] ?? []}
                                raciMembers={raciList}
                                wlogs={stepWorklogs[String(step.id)] ?? []}
                                wlogInput={stepWorklogInput[String(step.id)] ?? ''}
                                wlogHours={stepWorklogHours[String(step.id)] ?? ''}
                                wlogDifficulty={stepWorklogDifficulty[String(step.id)] ?? ''}
                                wlogProposal={stepWorklogProposal[String(step.id)] ?? ''}
                                wlogIssueStatus={(stepWorklogIssueStatus[String(step.id)] ?? 'JUST_ENCOUNTERED') as IssueStatus}
                                wlogSaving={stepWorklogSaving[String(step.id)] ?? false}
                                editingRowDraft={editingRowDraft}
                                attachList={stepAttachments[String(step.id)] ?? []}
                                attachLoading={attachLoadingStep === String(step.id)}
                                attachUploading={attachUploading[String(step.id)] ?? false}
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

                            {/* Inline add-step form */}
                            {isAddingHere && (
                              <tr className="bg-violet-50 border-t-2 border-violet-200">
                                {/* ▲/▼ — trống vì hàng mới */}
                                <td className="px-1 py-2" />
                                {/* TT */}
                                <td className="px-3 py-2 text-xs text-slate-400 text-center font-mono">+</td>
                                {/* A */}
                                <td className="px-1 py-2" />
                                {/* Trình tự công việc — CV1: input đủ rộng, autoFocus */}
                                <td className="px-2 py-2">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={newStepName}
                                    disabled={isAddingStepSubmitting}
                                    onChange={(e) => setNewStepName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !isAddingStepSubmitting && newStepName.trim()) handleAddStep(group.phase);
                                    }}
                                    placeholder="Tên bước mới..."
                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-violet-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none font-medium placeholder:text-slate-300"
                                  />
                                </td>
                                {/* CV2: ĐV chủ trì */}
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    value={newStepUnit}
                                    disabled={isAddingStepSubmitting}
                                    onChange={(e) => setNewStepUnit(e.target.value)}
                                    placeholder="ĐV chủ trì..."
                                    className="w-full px-2 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none placeholder:text-slate-300"
                                  />
                                </td>
                                {/* CV2: Kết quả dự kiến */}
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    value={newStepResult}
                                    disabled={isAddingStepSubmitting}
                                    onChange={(e) => setNewStepResult(e.target.value)}
                                    placeholder="Kết quả dự kiến..."
                                    className="w-full px-2 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none placeholder:text-slate-300"
                                  />
                                </td>
                                {/* CV2: Ngày */}
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    value={newStepDays}
                                    disabled={isAddingStepSubmitting}
                                    onChange={(e) => setNewStepDays(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    className="w-full px-2 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 outline-none text-center placeholder:text-slate-300"
                                  />
                                </td>
                                {/* Các cột còn lại (Từ ngày, Đến ngày, Tiến độ, Worklog, File, actions) — gộp + nút */}
                                <td colSpan={6} className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAddStep(group.phase)}
                                      disabled={!newStepName.trim() || isAddingStepSubmitting}
                                      className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {isAddingStepSubmitting ? 'Đang thêm...' : 'Thêm'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isAddingStepSubmitting}
                                      onClick={resetAddStepForm}
                                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {group.steps.length === 0 && !isAddingHere && (
                              <tr>
                                <td colSpan={13} className="px-4 py-4 text-center text-xs text-slate-400">Chưa có bước nào.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
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
