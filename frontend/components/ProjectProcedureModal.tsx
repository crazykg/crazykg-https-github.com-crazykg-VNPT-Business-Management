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
  ProcedureStepBatchUpdate,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  ProcedureStepRaciEntry,
  ProcedureRaciRole,
  IssueStatus,
  Employee,
  ProjectTypeOption,
  Attachment,
} from '../types';
import {
  fetchProcedureTemplates,
  fetchProjectProcedures,
  createProjectProcedure,
  fetchProcedureSteps,
  batchUpdateProcedureSteps,
  addCustomProcedureStep,
  deleteProcedureStep,
  renameProcedureStep,
  updateProcedurePhaseLabel,
  fetchStepWorklogs,
  addStepWorklog,
  updateStepWorklog,
  reorderProcedureSteps,
  updateIssueStatus,
  fetchProcedureRaci,
  fetchStepRaciBulk,
  addProcedureRaci,
  removeProcedureRaci,
  addStepRaci,
  removeStepRaci,
  batchSetStepRaci,
  fetchProcedureWorklogs,
  fetchEmployeesOptionsPage,
  resyncProcedure,
  getStepAttachments,
  linkStepAttachment,
  deleteStepAttachment,
  uploadDocumentAttachment,
  type ProcedureStepAttachment,
} from '../services/v5Api';
import { AttachmentManager } from './AttachmentManager';
import { StepRow } from './procedure/StepRow';
import { RaciMatrixPanel } from './procedure/RaciMatrixPanel';
import { SearchableSelect } from './SearchableSelect';
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

const RACI_META: Record<ProcedureRaciRole, { label: string; full: string; color: string; bg: string; border: string }> = {
  R: { label: 'R', full: 'Responsible',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  A: { label: 'A', full: 'Accountable',  color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  C: { label: 'C', full: 'Consulted',    color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  I: { label: 'I', full: 'Informed',     color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
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

  // ── Draft edits ──
  const [drafts, setDrafts] = useState<Record<string, Partial<ProjectProcedureStep>>>({});
  const [expandedDetails, setExpandedDetails] = useState<Set<string | number>>(new Set());

  // ── Add-step inline form ──
  const [addingInPhase, setAddingInPhase] = useState<string | null>(null);
  const [newStepName,   setNewStepName]   = useState('');
  const [newStepUnit,   setNewStepUnit]   = useState('');
  const [newStepDays,   setNewStepDays]   = useState('');
  const [newStepResult, setNewStepResult] = useState('');
  const [addingStepSubmittingPhase, setAddingStepSubmittingPhase] = useState<string | null>(null);

  // ── Add child step state ──
  const [addingChildToStepId, setAddingChildToStepId] = useState<string | number | null>(null);
  const [newChildName,        setNewChildName]         = useState('');
  const [newChildUnit,        setNewChildUnit]         = useState('');
  const [newChildDays,        setNewChildDays]         = useState('');
  const [newChildStartDate,   setNewChildStartDate]    = useState('');
  const [newChildEndDate,     setNewChildEndDate]      = useState('');
  const [newChildStatus,      setNewChildStatus]       = useState<ProcedureStepStatus>('CHUA_THUC_HIEN');
  const [addingChildSubmittingStepId, setAddingChildSubmittingStepId] = useState<string | number | null>(null);

  // ── Worklog state ──
  const [worklogs,        setWorklogs]        = useState<ProcedureStepWorklog[]>([]);
  const [worklogsLoading, setWorklogsLoading] = useState(false);
  // Per-step worklog panel
  const [openWorklogStep, setOpenWorklogStep]     = useState<string | number | null>(null);
  const [stepWorklogs,    setStepWorklogs]         = useState<Record<string, ProcedureStepWorklog[]>>({});
  const [stepWorklogInput,       setStepWorklogInput]       = useState<Record<string, string>>({});
  const [stepWorklogSaving,      setStepWorklogSaving]      = useState<Record<string, boolean>>({});
  const [stepWorklogHours,       setStepWorklogHours]       = useState<Record<string, string>>({});
  const [stepWorklogDifficulty,  setStepWorklogDifficulty]  = useState<Record<string, string>>({});
  const [stepWorklogProposal,    setStepWorklogProposal]    = useState<Record<string, string>>({});
  const [stepWorklogIssueStatus, setStepWorklogIssueStatus] = useState<Record<string, IssueStatus>>({});
  // Per-worklog edit state: logId → true/false
  const [editingWorklogId,     setEditingWorklogId]     = useState<string | number | null>(null);
  const [editWorklogContent,   setEditWorklogContent]   = useState('');
  const [editWorklogHours,     setEditWorklogHours]     = useState('');
  const [editWorklogDiff,      setEditWorklogDiff]      = useState('');
  const [editWorklogProposal,  setEditWorklogProposal]  = useState('');
  const [editWorklogStatus,    setEditWorklogStatus]    = useState<IssueStatus>('JUST_ENCOUNTERED');
  const [editWorklogSaving,    setEditWorklogSaving]    = useState(false);

  // ── Inline row edit state ──
  const [editingStepId,  setEditingStepId]  = useState<string | number | null>(null);
  const [editingRowDraft, setEditingRowDraft] = useState<{
    step_name: string; lead_unit: string; expected_result: string; duration_days: string;
  }>({ step_name: '', lead_unit: '', expected_result: '', duration_days: '' });

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

  // ── Phase label inline edit state ──
  const [editingPhase,      setEditingPhase]      = useState<string | null>(null);
  const [editingPhaseLabel, setEditingPhaseLabel] = useState('');
  const [phaseLabelSaving,  setPhaseLabelSaving]  = useState(false);
  const phaseLabelInputRef = useRef<HTMLInputElement>(null);

  // ── Step Attachments ──
  const [stepAttachments,    setStepAttachments]    = useState<Record<string, Attachment[]>>({});
  const [attachLoadingStep,  setAttachLoadingStep]  = useState<string | null>(null);
  const [openAttachStep,     setOpenAttachStep]     = useState<string | null>(null);
  const [attachUploading,    setAttachUploading]    = useState<Record<string, boolean>>({});

  const autoCreatedRef   = useRef(false);
  const issuesSectionRef = useRef<HTMLDivElement>(null);
  // ── Inflight guard — prevent double-submit on any save action ──
  const inflightRef = useRef<Set<string>>(new Set());

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
    if (!activeProcedure) { setSteps([]); setStepRaciMap({}); setRaciMatrixPhase(null); return; }
    setIsLoading(true);
    // Clear stale cache của các tab phụ ngay khi procedure thay đổi
    setWorklogs([]);
    setStepWorklogs({});
    setRaciList([]);
    setStepRaciMap({});
    // Load steps + RACI song song để badge hiện ngay không cần vào tab RACI trước
    Promise.all([
      fetchProcedureSteps(activeProcedure.id),
      fetchProcedureRaci(activeProcedure.id).catch(() => [] as typeof raciList),
      fetchStepRaciBulk(activeProcedure.id).catch(() => [] as ProcedureStepRaciEntry[]),
    ])
      .then(([stepsData, raciData, stepRaciData]) => {
        setSteps(stepsData);
        setDrafts({});
        setRaciList(raciData);
        setStepRaciMap(groupStepRaciByStep(stepRaciData));
      })
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message || 'Không thể tải bước')))
      .finally(() => setIsLoading(false));
  }, [activeProcedure?.id]);

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
  const hasDirtyChanges = Object.keys(drafts).length > 0;
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

  // ── Quản trị checklist — state & computed ──
  const [issueFilterTab, setIssueFilterTab] = useState<IssueStatus | 'all'>('all');
  const [issueUpdating,  setIssueUpdating]  = useState<Record<string | number, boolean>>({});

  const issueWorklogs = useMemo(() =>
    worklogs.filter((w) => w.issue != null),
  [worklogs]);

  const issuesByStatus = useMemo(() => ({
    JUST_ENCOUNTERED: issueWorklogs.filter((w) => w.issue?.issue_status === 'JUST_ENCOUNTERED'),
    IN_PROGRESS:      issueWorklogs.filter((w) => w.issue?.issue_status === 'IN_PROGRESS'),
    RESOLVED:         issueWorklogs.filter((w) => w.issue?.issue_status === 'RESOLVED'),
  }), [issueWorklogs]);

  const stepStats = useMemo(() => {
    const top = steps.filter((s) => !s.parent_step_id);
    return {
      total:      top.length,
      done:       top.filter((s) => s.progress_status === 'HOAN_THANH').length,
      inProgress: top.filter((s) => s.progress_status === 'DANG_THUC_HIEN').length,
      todo:       top.filter((s) => s.progress_status === 'CHUA_THUC_HIEN').length,
    };
  }, [steps]);

  const handleChangeIssueStatus = useCallback(async (
    logId: string | number,
    newStatus: IssueStatus,
  ) => {
    setIssueUpdating((prev) => ({ ...prev, [logId]: true }));
    try {
      await updateIssueStatus(logId, newStatus);
      // Cập nhật local state ngay — không cần re-fetch
      setWorklogs((prev) => prev.map((w) =>
        w.id === logId && w.issue
          ? { ...w, issue: { ...w.issue, issue_status: newStatus } }
          : w,
      ));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setIssueUpdating((prev) => ({ ...prev, [logId]: false }));
    }
  }, []);

  const handleRefreshChecklist = useCallback(() => {
    if (!activeProcedure) return;
    setWorklogsLoading(true);
    fetchProcedureWorklogs(activeProcedure.id)
      .then(setWorklogs)
      .catch(() => {})
      .finally(() => setWorklogsLoading(false));
  }, [activeProcedure]);

  const handleDraftChange = useCallback(
    (stepId: string | number, field: string, value: string | null) => {
      setDrafts((prev) => ({ ...prev, [String(stepId)]: { ...prev[String(stepId)], [field]: value } }));
    }, [],
  );

  /** Khi user chọn "Từ ngày": lưu draft và tự tính "Đến ngày" nếu duration_days > 0 */
  const handleStartDateChange = useCallback(
    (step: ProjectProcedureStep, newStartDate: string | null) => {
      setDrafts((prev) => {
        const existing = prev[String(step.id)] ?? {};
        const days = step.duration_days;
        const endDate = (days && days > 0 && newStartDate)
          ? computeEndDate(newStartDate, days)
          : (!newStartDate ? null : existing.actual_end_date ?? null);
        return {
          ...prev,
          [String(step.id)]: { ...existing, actual_start_date: newStartDate, actual_end_date: endDate },
        };
      });
    }, [computeEndDate],
  );

  const handleSave = useCallback(async () => {
    const key = 'batch-save';
    if (inflightRef.current.has(key)) return;          // ← block double-submit
    if (!hasDirtyChanges || !activeProcedure) return;
    inflightRef.current.add(key);
    try {
      setIsSaving(true);
      const batch: ProcedureStepBatchUpdate[] = Object.keys(drafts).map((id) => {
        const c = drafts[id];
        return { id, progress_status: c.progress_status, document_number: c.document_number,
                 document_date: c.document_date, actual_start_date: c.actual_start_date,
                 actual_end_date: c.actual_end_date };
      });
      const result = await batchUpdateProcedureSteps(batch);
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setDrafts({});
      // overall_progress là map {procedureId: number} — lấy đúng giá trị theo id hiện tại
      const newProgress = result.overall_progress[activeProcedure.id] ?? activeProcedure.overall_progress;
      setActiveProcedure((prev) => prev ? { ...prev, overall_progress: newProgress } : null);
      onNotify?.('success', 'Đã lưu', `Cập nhật ${result.updated_count} bước thành công`);
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể lưu thay đổi');
    } finally {
      inflightRef.current.delete('batch-save');
      setIsSaving(false);
    }
  }, [hasDirtyChanges, activeProcedure, drafts]);

  const handleClose = useCallback(() => {
    if (hasDirtyChanges && !window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?')) return;
    setDrafts({}); setActiveProcedure(null); setSteps([]); setWorklogs([]); setRaciList([]);
    setStepRaciMap({});
    setRaciMatrixPhase(null);
    setOpenWorklogStep(null); setStepWorklogs({});
    setStepAttachments({}); setOpenAttachStep(null);
    setAddingStepSubmittingPhase(null); setAddingChildSubmittingStepId(null);
    setAddingChildToStepId(null); setNewChildName(''); setNewChildUnit(''); setNewChildDays('');
    setNewChildStartDate(''); setNewChildEndDate(''); setNewChildStatus('CHUA_THUC_HIEN');
    onClose();
  }, [hasDirtyChanges, onClose]);

  useEscKey(handleClose, isOpen);

  const toggleDetail = useCallback((id: string | number) => {
    setExpandedDetails((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleAddStep = useCallback(async (phase: string) => {
    if (!activeProcedure || !newStepName.trim()) return;
    const key = `add-step:${activeProcedure.id}:${phase}`;
    if (inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    setAddingStepSubmittingPhase(phase);
    try {
      await addCustomProcedureStep(activeProcedure.id, {
        step_name:       newStepName.trim(), phase,
        lead_unit:       newStepUnit.trim()   || null,
        expected_result: newStepResult.trim() || null,
        duration_days:   newStepDays ? parseInt(newStepDays, 10) : 0,
      });
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setNewStepName(''); setNewStepUnit(''); setNewStepResult(''); setNewStepDays(''); setAddingInPhase(null);
      onNotify?.('success', 'Đã thêm', 'Thêm bước thành công');
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm bước');
    } finally {
      inflightRef.current.delete(key);
      setAddingStepSubmittingPhase((prev) => (prev === phase ? null : prev));
    }
  }, [activeProcedure, newStepName, newStepUnit, newStepResult, newStepDays]);

  const handleAddChildStep = useCallback(async (parentStep: ProjectProcedureStep) => {
    if (!activeProcedure || !newChildName.trim()) return;
    const parentDraft = drafts[String(parentStep.id)] ?? {};
    const hasDraftStart = Object.prototype.hasOwnProperty.call(parentDraft, 'actual_start_date');
    const hasDraftEnd = Object.prototype.hasOwnProperty.call(parentDraft, 'actual_end_date');
    const parentStartDate = hasDraftStart
      ? (parentDraft.actual_start_date ?? null)
      : (parentStep.actual_start_date ?? null);
    const parentEndDate = parentStartDate && (parentStep.duration_days ?? 0) > 0
      ? computeEndDate(parentStartDate, parentStep.duration_days)
      : hasDraftEnd
        ? (parentDraft.actual_end_date ?? null)
        : (parentStep.actual_end_date ?? null);
    const parsedChildDays = Number.parseInt(newChildDays, 10);
    const childDurationDays = Number.isNaN(parsedChildDays) ? 0 : parsedChildDays;
    const childStartDate = newChildStartDate || null;
    const childEndDate = childDurationDays > 0 && childStartDate
      ? computeEndDate(childStartDate, childDurationDays)
      : (newChildEndDate || null);

    if (childStartDate && childEndDate && childEndDate < childStartDate) {
      onNotify?.('warning', 'Ngày chưa hợp lệ', 'Đến ngày bước con phải lớn hơn hoặc bằng Từ ngày.');
      return;
    }
    if (childStartDate && parentStartDate && childStartDate < parentStartDate) {
      onNotify?.('warning', 'Ngày chưa hợp lệ', `Từ ngày bước con không được trước bước cha (${parentStartDate}).`);
      return;
    }
    if (childStartDate && parentEndDate && childStartDate > parentEndDate) {
      onNotify?.('warning', 'Ngày chưa hợp lệ', `Từ ngày bước con không được sau bước cha (${parentEndDate}).`);
      return;
    }
    if (childEndDate && parentStartDate && childEndDate < parentStartDate) {
      onNotify?.('warning', 'Ngày chưa hợp lệ', `Đến ngày bước con không được trước bước cha (${parentStartDate}).`);
      return;
    }
    if (childEndDate && parentEndDate && childEndDate > parentEndDate) {
      onNotify?.('warning', 'Ngày chưa hợp lệ', `Đến ngày bước con không được sau bước cha (${parentEndDate}).`);
      return;
    }

    const parentStepId = String(parentStep.id);
    const key = `add-child:${activeProcedure.id}:${parentStepId}`;
    if (inflightRef.current.has(key)) return;
    inflightRef.current.add(key);
    setAddingChildSubmittingStepId(parentStep.id);
    try {
      await addCustomProcedureStep(activeProcedure.id, {
        step_name:      newChildName.trim(),
        phase:          parentStep.phase,
        lead_unit:      newChildUnit.trim() || null,
        duration_days:  childDurationDays,
        parent_step_id: parentStep.id,
        actual_start_date: childStartDate,
        actual_end_date: childEndDate,
        progress_status: newChildStatus || 'CHUA_THUC_HIEN',
      });
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setNewChildName(''); setNewChildUnit(''); setNewChildDays('');
      setNewChildStartDate(''); setNewChildEndDate(''); setNewChildStatus('CHUA_THUC_HIEN');
      setAddingChildToStepId(null);
      onNotify?.('success', 'Đã thêm', 'Thêm bước con thành công');
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm bước con');
    } finally {
      inflightRef.current.delete(key);
      setAddingChildSubmittingStepId((prev) => (String(prev) === parentStepId ? null : prev));
    }
  }, [
    activeProcedure,
    drafts,
    newChildName,
    newChildUnit,
    newChildDays,
    newChildStartDate,
    newChildEndDate,
    newChildStatus,
    onNotify,
  ]);

  const handleDeleteStep = useCallback(async (step: ProjectProcedureStep) => {
    if (!window.confirm(`Xóa bước "${step.step_name}"?`)) return;
    try {
      await deleteProcedureStep(step.id);
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
      setStepRaciMap((prev) => {
        const next = { ...prev };
        delete next[String(step.id)];
        return next;
      });
      onNotify?.('success', 'Đã xóa', 'Đã xóa bước thành công');
    } catch (err: any) { onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa'); }
  }, []);

  // ── Handlers: Step Attachments ──
  const handleOpenAttachments = useCallback(async (step: ProjectProcedureStep) => {
    const key = String(step.id);
    if (openAttachStep === key) { setOpenAttachStep(null); return; }
    setOpenWorklogStep(null);
    setOpenAttachStep(key);
    if (stepAttachments[key]) return; // đã load rồi
    setAttachLoadingStep(key);
    try {
      const list = await getStepAttachments(step.id);
      setStepAttachments((prev) => ({ ...prev, [key]: list }));
    } catch { onNotify?.('error', 'Lỗi', 'Không tải được file đính kèm'); }
    finally   { setAttachLoadingStep(null); }
  }, [openAttachStep, stepAttachments]);

  // Upload file thật (B2 → fallback local) → link vào bước
  const handleUploadStepFile = useCallback(async (stepId: string | number, file: File) => {
    const key = String(stepId);
    setAttachUploading((prev) => ({ ...prev, [key]: true }));
    try {
      // 1. Upload lên B2; nếu B2 lỗi backend tự fallback về lưu tạm máy chủ nội bộ
      const uploaded = await uploadDocumentAttachment(file);

      // 2. Lưu record attachment gắn với bước quy trình
      const saved = await linkStepAttachment(stepId, {
        fileName:          uploaded.fileName,
        fileUrl:           uploaded.fileUrl,
        fileSize:          uploaded.fileSize,
        mimeType:          uploaded.mimeType,
        driveFileId:       uploaded.driveFileId || null,
        storageDisk:       uploaded.storageDisk ?? null,
        storagePath:       uploaded.storagePath ?? null,
        storageVisibility: uploaded.storageVisibility ?? null,
      });

      // 3. Thêm warningMessage để badge "Máy chủ nội bộ" biết là do fallback
      const savedWithWarning: typeof saved = uploaded.warningMessage
        ? { ...saved, warningMessage: uploaded.warningMessage }
        : saved;

      setStepAttachments((prev) => ({ ...prev, [key]: [savedWithWarning, ...(prev[key] ?? [])] }));

      // 4. Thông báo kết quả
      if (uploaded.storageProvider === 'BACKBLAZE_B2') {
        // Thành công lên B2 — không cần notify (UI badge đã rõ)
      } else if (uploaded.warningMessage) {
        // B2 lỗi → đã fallback local, hiện warning chi tiết
        onNotify?.('warning', '⚠️ B2 không khả dụng — lưu tạm máy chủ', uploaded.warningMessage);
      } else {
        // B2 chưa cấu hình → lưu local bình thường
        onNotify?.('info', 'Đã tải lên', `"${file.name}" lưu trên máy chủ nội bộ.`);
      }
    } catch (err: any) {
      onNotify?.('error', 'Lỗi tải file', err?.message || 'Không thể tải file lên');
    } finally {
      setAttachUploading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const handleDeleteAttachment = useCallback(async (stepId: string | number, attachId: string) => {
    if (!window.confirm('Xóa file đính kèm này?')) return;
    const key = String(stepId);
    try {
      await deleteStepAttachment(stepId, attachId);
      setStepAttachments((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((a) => a.id !== attachId) }));
      onNotify?.('success', 'Đã xóa', 'File đính kèm đã được xóa');
    } catch (err: any) { onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa file'); }
  }, []);

  // ── Handler: Xếp lại thứ tự bước (▲/▼) trong cùng phase ──

  const handleReorderStep = useCallback(async (
    step: ProjectProcedureStep,
    direction: 'up' | 'down',
  ) => {
    const phaseSteps = steps
      .filter((s) => s.phase === step.phase && !s.parent_step_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = phaseSteps.findIndex((s) => s.id === step.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= phaseSteps.length) return;
    const stepA = phaseSteps[idx];
    const stepB = phaseSteps[swapIdx];
    // Tránh trùng sort_order (edge case dữ liệu cũ)
    const soA = stepB.sort_order === stepA.sort_order
      ? (direction === 'up' ? stepB.sort_order - 1 : stepB.sort_order + 1)
      : stepB.sort_order;
    const soB = stepA.sort_order;
    // Optimistic update
    setSteps((prev) => prev.map((s) =>
      s.id === stepA.id ? { ...s, sort_order: soA }
        : s.id === stepB.id ? { ...s, sort_order: soB }
          : s
    ));
    try {
      await reorderProcedureSteps([{ id: stepA.id, sort_order: soA }, { id: stepB.id, sort_order: soB }]);
    } catch (err: any) {
      // Rollback
      setSteps((prev) => prev.map((s) =>
        s.id === stepA.id ? { ...s, sort_order: stepA.sort_order }
          : s.id === stepB.id ? { ...s, sort_order: stepB.sort_order }
            : s
      ));
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể đổi thứ tự bước');
    }
  }, [steps]);

  const handleStartEditRow = useCallback((step: ProjectProcedureStep) => {
    setEditingStepId(step.id);
    setEditingRowDraft({
      step_name:       step.step_name,
      lead_unit:       step.lead_unit       ?? '',
      expected_result: step.expected_result ?? '',
      duration_days:   String(step.duration_days ?? ''),
    });
  }, []);

  const handleCancelEditRow = useCallback(() => {
    setEditingStepId(null);
    setEditingRowDraft({ step_name: '', lead_unit: '', expected_result: '', duration_days: '' });
  }, []);

  // ── Inline edit phase label ──
  const handleStartEditPhase = useCallback((phase: string, currentLabel: string) => {
    setEditingPhase(phase);
    setEditingPhaseLabel(currentLabel);
    setTimeout(() => phaseLabelInputRef.current?.focus(), 50);
  }, []);

  const handleSavePhaseLabel = useCallback(async () => {
    if (!editingPhase || !activeProcedure) return;
    const trimmed = editingPhaseLabel.trim();
    if (!trimmed) { setEditingPhase(null); return; }
    if (phaseLabelSaving) return;
    setPhaseLabelSaving(true);
    try {
      await updateProcedurePhaseLabel(activeProcedure.id, editingPhase, trimmed);
      // Cập nhật local steps để groupByPhase lấy label mới ngay
      setSteps((prev) =>
        prev.map((s) => s.phase === editingPhase ? { ...s, phase_label: trimmed } : s),
      );
      setEditingPhase(null);
    } catch {
      // ignore, keep editing open
    } finally {
      setPhaseLabelSaving(false);
    }
  }, [activeProcedure, editingPhase, editingPhaseLabel, phaseLabelSaving]);

  const handleCancelEditPhase = useCallback(() => {
    setEditingPhase(null);
    setEditingPhaseLabel('');
  }, []);

  const handleSaveEditRow = useCallback(async (step: ProjectProcedureStep) => {
    const draft = editingRowDraft;
    setEditingStepId(null);
    setEditingRowDraft({ step_name: '', lead_unit: '', expected_result: '', duration_days: '' });

    const payload: Record<string, string | number | null> = {};
    const name = draft.step_name.trim();
    if (name && name !== step.step_name)                                           payload.step_name       = name;
    if (draft.lead_unit.trim()       !== (step.lead_unit       ?? ''))             payload.lead_unit       = draft.lead_unit.trim()       || null;
    if (draft.expected_result.trim() !== (step.expected_result ?? ''))             payload.expected_result = draft.expected_result.trim() || null;
    const daysNum = draft.duration_days === '' ? null : Number(draft.duration_days);
    if (daysNum !== (step.duration_days ?? null))                                  payload.duration_days   = daysNum;

    if (Object.keys(payload).length === 0) return;
    try {
      const updated = await renameProcedureStep(step.id, payload as any);
      setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, ...updated } : s));
      onNotify?.('success', 'Đã lưu', 'Bước đã được cập nhật');
    } catch (err: any) { onNotify?.('error', 'Lỗi', err?.message || 'Không thể cập nhật bước'); }
  }, [editingRowDraft]);

  // ── Handlers — worklog per step ──

  const handleToggleStepWorklog = useCallback(async (stepId: string | number) => {
    if (openWorklogStep === stepId) { setOpenWorklogStep(null); return; }
    setOpenAttachStep(null);
    setOpenWorklogStep(stepId);
    if (!stepWorklogs[String(stepId)]) {
      try {
        const logs = await fetchStepWorklogs(stepId);
        setStepWorklogs((prev) => ({ ...prev, [String(stepId)]: logs }));
      } catch { /* silent */ }
    }
  }, [openWorklogStep, stepWorklogs]);

  const handleAddStepWorklog = useCallback(async (stepId: string | number) => {
    const key = `wlog-${stepId}`;
    if (inflightRef.current.has(key)) return;          // ← block double-submit
    const sid = String(stepId);
    const content = (stepWorklogInput[sid] || '').trim();
    if (!content) return;
    inflightRef.current.add(key);
    setStepWorklogSaving((prev) => ({ ...prev, [sid]: true }));
    try {
      const hoursRaw = parseFloat(stepWorklogHours[sid] || '');
      const difficulty = (stepWorklogDifficulty[sid] || '').trim();
      const log = await addStepWorklog(stepId, {
        content,
        hours_spent:   isNaN(hoursRaw) ? null : hoursRaw,
        difficulty:    difficulty || null,
        proposal:      difficulty ? (stepWorklogProposal[sid] || '').trim() || null : null,
        issue_status:  difficulty ? (stepWorklogIssueStatus[sid] || 'JUST_ENCOUNTERED') : null,
      });
      setStepWorklogs((prev) => ({ ...prev, [sid]: [log, ...(prev[sid] || [])] }));
      // Bump counters để các rule khóa UI phản ánh ngay mà không cần refetch
      setSteps((prev) => prev.map((s) =>
        String(s.id) === sid
          ? {
              ...s,
              worklogs_count: (s.worklogs_count ?? 0) + 1,
              blocking_worklogs_count: (s.blocking_worklogs_count ?? 0) + (log.log_type === 'CUSTOM' ? 0 : 1),
            }
          : s
      ));
      // Reset all fields
      setStepWorklogInput((prev)       => ({ ...prev, [sid]: '' }));
      setStepWorklogHours((prev)       => ({ ...prev, [sid]: '' }));
      setStepWorklogDifficulty((prev)  => ({ ...prev, [sid]: '' }));
      setStepWorklogProposal((prev)    => ({ ...prev, [sid]: '' }));
      setStepWorklogIssueStatus((prev) => ({ ...prev, [sid]: 'JUST_ENCOUNTERED' }));
      // Cập nhật worklog tab nếu đang mở — optimistic prepend, không refetch
      setWorklogs((prev) => {
        if (!prev.some((w) => w.id === log.id)) return [log, ...prev];
        return prev;
      });
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm worklog');
    } finally {
      inflightRef.current.delete(key);
      setStepWorklogSaving((prev) => ({ ...prev, [sid]: false }));
    }
  }, [stepWorklogInput, stepWorklogHours, stepWorklogDifficulty, stepWorklogProposal, stepWorklogIssueStatus]);

  const handleUpdateIssueStatus = useCallback(async (
    stepId: string | number,
    issueId: string | number,
    newStatus: IssueStatus,
  ) => {
    try {
      const updated = await updateIssueStatus(issueId, newStatus);
      setStepWorklogs((prev) => {
        const logs = prev[String(stepId)] || [];
        return {
          ...prev,
          [String(stepId)]: logs.map((l) =>
            l.issue && String(l.issue.id) === String(issueId)
              ? { ...l, issue: { ...l.issue, issue_status: updated.issue_status } }
              : l,
          ),
        };
      });
      setWorklogs((prev) => prev.map((l) =>
        l.issue && String(l.issue.id) === String(issueId)
          ? { ...l, issue: { ...l.issue, issue_status: updated.issue_status } }
          : l,
      ));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể cập nhật trạng thái');
    }
  }, []);

  // ── Handlers — Edit Worklog ──

  const handleStartEditWorklog = useCallback((log: ProcedureStepWorklog) => {
    setEditingWorklogId(log.id);
    setEditWorklogContent(log.content);
    setEditWorklogHours(log.timesheet ? String(Number(log.timesheet.hours_spent)) : '');
    setEditWorklogDiff(log.issue?.issue_content ?? '');
    setEditWorklogProposal(log.issue?.proposal_content ?? '');
    setEditWorklogStatus(log.issue?.issue_status ?? 'JUST_ENCOUNTERED');
  }, []);

  const handleCancelEditWorklog = useCallback(() => {
    setEditingWorklogId(null);
    setEditWorklogContent('');
    setEditWorklogHours('');
    setEditWorklogDiff('');
    setEditWorklogProposal('');
    setEditWorklogStatus('JUST_ENCOUNTERED');
  }, []);

  const handleSaveEditWorklog = useCallback(async (
    stepId: string | number,
    logId: string | number,
  ) => {
    const content = editWorklogContent.trim();
    if (!content || editWorklogSaving) return;
    setEditWorklogSaving(true);
    try {
      const hoursRaw = parseFloat(editWorklogHours);
      const difficulty = editWorklogDiff.trim();
      const updated = await updateStepWorklog(logId, {
        content,
        hours_spent:  isNaN(hoursRaw) ? null : hoursRaw,
        difficulty:   difficulty || null,
        proposal:     difficulty ? editWorklogProposal.trim() || null : null,
        issue_status: difficulty ? editWorklogStatus : null,
      });
      // Cập nhật trong step worklogs
      setStepWorklogs((prev) => {
        const list = prev[String(stepId)] || [];
        return { ...prev, [String(stepId)]: list.map((l) => String(l.id) === String(logId) ? updated : l) };
      });
      // Cập nhật trong global worklogs tab
      setWorklogs((prev) => prev.map((l) => String(l.id) === String(logId) ? updated : l));
      handleCancelEditWorklog();
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể lưu chỉnh sửa');
    } finally {
      setEditWorklogSaving(false);
    }
  }, [editWorklogContent, editWorklogHours, editWorklogDiff, editWorklogProposal, editWorklogStatus, editWorklogSaving, handleCancelEditWorklog]);

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

  if (!isOpen) return null;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  // ── Stable wrapper callbacks cho StepRow (tránh inline setState trong .map()) ──
  const handleSetWlogInput = useCallback((stepId: string | number, val: string) => {
    setStepWorklogInput((prev) => ({ ...prev, [String(stepId)]: val }));
  }, []);
  const handleSetWlogHours = useCallback((stepId: string | number, val: string) => {
    setStepWorklogHours((prev) => ({ ...prev, [String(stepId)]: val }));
  }, []);
  const handleSetWlogDifficulty = useCallback((stepId: string | number, val: string) => {
    setStepWorklogDifficulty((prev) => ({ ...prev, [String(stepId)]: val }));
  }, []);
  const handleSetWlogProposal = useCallback((stepId: string | number, val: string) => {
    setStepWorklogProposal((prev) => ({ ...prev, [String(stepId)]: val }));
  }, []);
  const handleSetWlogIssueStatus = useCallback((stepId: string | number, val: IssueStatus) => {
    setStepWorklogIssueStatus((prev) => ({ ...prev, [String(stepId)]: val }));
  }, []);
  const handleCancelChild = useCallback(() => {
    setAddingChildToStepId(null);
    setNewChildName('');
    setNewChildUnit('');
    setNewChildDays('');
    setNewChildStartDate('');
    setNewChildEndDate('');
    setNewChildStatus('CHUA_THUC_HIEN');
  }, []);
  const handleToggleAddChild = useCallback((stepId: string | number) => {
    setAddingChildToStepId((prev) => (prev === stepId ? null : stepId));
    setNewChildName('');
    setNewChildUnit('');
    setNewChildDays('');
    setNewChildStartDate('');
    setNewChildEndDate('');
    setNewChildStatus('CHUA_THUC_HIEN');
  }, []);

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
                    setStepWorklogs({});
                    setRaciList([]);
                    setStepRaciMap({});
                    setRaciMatrixPhase(null);
                    setDrafts({});
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
                            onClick={() => { setAddingInPhase(isAddingHere ? null : group.phase); setNewStepName(''); setNewStepUnit(''); setNewStepDays(''); }}
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
                              <th className="px-1 py-2 w-10" title="Xếp thứ tự" /> {/* ▲/▼ reorder */}
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
                                onReorder={handleReorderStep}
                                onToggleDetail={toggleDetail}
                                onStartEditRow={handleStartEditRow}
                                onCancelEditRow={handleCancelEditRow}
                                onSaveEditRow={handleSaveEditRow}
                                onSetEditingRowDraft={setEditingRowDraft}
                                onDeleteStep={handleDeleteStep}
                                onOpenAttachments={handleOpenAttachments}
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
                                      onClick={() => { setAddingInPhase(null); setNewStepName(''); setNewStepUnit(''); setNewStepResult(''); setNewStepDays(''); }}
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
            /* ══════════════════════ TAB: WORKLOG TOÀN BỘ ══════════════════════ */
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-700">
                  Lịch sử hoạt động
                  {worklogs.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-400">({worklogs.length} mục)</span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    if (!activeProcedure) return;
                    setWorklogsLoading(true);
                    fetchProcedureWorklogs(activeProcedure.id).then(setWorklogs).catch(() => {}).finally(() => setWorklogsLoading(false));
                  }}
                  className="p-1.5 text-slate-400 hover:text-deep-teal transition-colors"
                  title="Làm mới"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
              </div>

              {worklogsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
                  <span className="ml-2 text-slate-400 text-sm">Đang tải...</span>
                </div>
              ) : worklogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  <span className="material-symbols-outlined text-4xl text-slate-200 block mb-2">history</span>
                  Chưa có hoạt động nào được ghi nhận.
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100" />
                  <div className="space-y-3">
                    {worklogs.map((log) => (
                      <div key={log.id} className="flex gap-3 relative">
                        {/* Icon */}
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${WORKLOG_COLOR[log.log_type] || 'bg-slate-100 text-slate-400'}`}>
                          <span className="material-symbols-outlined text-base">{WORKLOG_ICON[log.log_type] || 'info'}</span>
                        </span>
                        {/* Card */}
                        <div className="flex-1 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-700">{log.content}</span>
                                {/* Badge giờ */}
                                {log.timesheet && Number(log.timesheet.hours_spent) > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold border border-blue-100">
                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                    {Number(log.timesheet.hours_spent).toFixed(2)}h
                                  </span>
                                )}
                              </div>
                              {log.step && (
                                <span className="ml-0 mt-0.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                                  #{log.step.step_number} {log.step.step_name}
                                </span>
                              )}
                            </div>
                            {/* Relative + absolute datetime on hover */}
                            <span
                              title={absTime(log.created_at)}
                              className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap cursor-default"
                            >
                              {relativeTime(log.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">person</span>
                              {log.creator?.full_name || 'Hệ thống'}
                              {log.creator?.user_code && (
                                <span className="ml-1 text-slate-300">({log.creator.user_code})</span>
                              )}
                            </span>
                            <span className="text-slate-200">·</span>
                            <span className="text-slate-300">{absTime(log.created_at)}</span>
                          </div>
                          {/* Old → New */}
                          {log.old_value && log.new_value && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-500 line-through">{log.old_value}</span>
                              <span className="material-symbols-outlined text-[10px] text-slate-300">arrow_forward</span>
                              <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-semibold">{log.new_value}</span>
                            </div>
                          )}
                          {/* Issue panel */}
                          {log.issue && (
                            <div className="mt-2 pl-2 border-l-2 border-orange-200 space-y-0.5">
                              <div className="flex items-start gap-1.5 flex-wrap">
                                <span className="material-symbols-outlined text-[10px] text-orange-400 mt-0.5">warning</span>
                                <span className="text-slate-600 text-[11px] flex-1">{log.issue.issue_content}</span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${ISSUE_STATUS_META[log.issue.issue_status]?.color || ''}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${ISSUE_STATUS_META[log.issue.issue_status]?.dot || ''}`} />
                                  {ISSUE_STATUS_META[log.issue.issue_status]?.label || log.issue.issue_status}
                                </span>
                              </div>
                              {log.issue.proposal_content && (
                                <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                  <span className="material-symbols-outlined text-[10px] text-emerald-400 shrink-0 mt-px">lightbulb</span>
                                  {log.issue.proposal_content}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          ) : activeTab === 'raci' ? (
            /* ══════════════════════ TAB: RACI ══════════════════════ */
            <div className="max-w-4xl mx-auto">

              {/* ── 1. Form Thêm phân công RACI (đứng đầu) ── */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-deep-teal">person_add</span>
                  Thêm phân công RACI
                </h4>
                <div className="flex flex-wrap gap-3 items-end">
                  {/* Thành viên — SearchableSelect */}
                  <div className="flex-1 min-w-[240px]">
                    <label className="text-xs text-slate-500 mb-1 block">Thành viên</label>
                    <SearchableSelect
                      value={raciUserId}
                      options={userOptions}
                      onChange={setRaciUserId}
                      onSearchTermChange={setUserSearch}
                      searching={usersLoading}
                      placeholder="Chọn thành viên..."
                      searchPlaceholder="Tìm theo tên, mã NV, chức vụ..."
                      noOptionsText={usersLoading ? 'Đang tìm...' : 'Không tìm thấy nhân viên'}
                      usePortal
                      portalZIndex={9999}
                      triggerClassName="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
                      dropdownClassName="min-w-[380px] max-w-[520px]"
                    />
                  </div>

                  {/* Vai trò RACI */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Vai trò RACI</label>
                    <select
                      value={raciRole}
                      onChange={(e) => setRaciRole(e.target.value as ProcedureRaciRole)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white font-semibold"
                    >
                      {(['R','A','C','I'] as ProcedureRaciRole[]).map((role) => (
                        <option key={role} value={role}>{role} — {RACI_META[role].full}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ghi chú */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-slate-500 mb-1 block">Ghi chú (tùy chọn)</label>
                    <input
                      type="text"
                      value={raciNote}
                      onChange={(e) => setRaciNote(e.target.value)}
                      placeholder="Ghi chú..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none bg-white"
                    />
                  </div>

                  <button
                    onClick={handleAddRaci}
                    disabled={!raciUserId || raciSaving}
                    className="px-5 py-2 text-sm font-semibold bg-deep-teal text-white rounded-lg hover:bg-deep-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {raciSaving ? 'Đang lưu...' : 'Thêm'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  * Mỗi người dùng có thể đảm nhận nhiều vai trò R/A/C/I trong cùng một thủ tục.
                </p>
              </div>

              {/* ── 2. RACI Legend — hình vuông bo góc, grid 4 cột ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {(Object.entries(RACI_META) as [ProcedureRaciRole, typeof RACI_META['R']][]).map(([role, meta]) => (
                  <div key={role} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${meta.bg} ${meta.border}`}>
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-black shrink-0 ${meta.bg} ${meta.color} border ${meta.border}`}>
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold leading-tight ${meta.color}`}>{meta.full}</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        {role === 'R' && 'Người thực hiện'}
                        {role === 'A' && 'Người chịu trách nhiệm'}
                        {role === 'C' && 'Người tư vấn'}
                        {role === 'I' && 'Người được thông báo'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 3. Bảng danh sách thành viên RACI ── */}
              {raciLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-6 h-6 border-2 border-deep-teal/20 border-t-deep-teal rounded-full" />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Thành viên</th>
                        {(['R','A','C','I'] as ProcedureRaciRole[]).map((role) => (
                          <th key={role} className="px-4 py-3 text-center w-[90px]">
                            <span className={`inline-flex w-7 h-7 rounded-md items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                              {role}
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-3 w-[36px]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Array.from(new Set(raciList.map((r) => String(r.user_id)))).map((uid) => {
                        const userRows = raciList.filter((r) => String(r.user_id) === uid);
                        const user = userRows[0];
                        const cachedEmp = employeeCache.get(uid);
                        const displayName = user.full_name || cachedEmp?.full_name || user.username || uid;
                        const displayCode = user.user_code || cachedEmp?.user_code || '';
                        const displayPosition = resolvePositionName(cachedEmp ?? null);
                        const initials = displayName.charAt(0).toUpperCase();
                        return (
                          <tr key={uid} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-full bg-deep-teal/10 text-deep-teal flex items-center justify-center text-sm font-bold shrink-0">
                                  {initials}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-slate-700 leading-tight">{displayName}</div>
                                  {displayCode && (
                                    <div className="text-xs text-slate-400 leading-tight">{displayCode}</div>
                                  )}
                                  {displayPosition && displayPosition !== 'Chưa cập nhật' && (
                                    <div className="text-[11px] text-slate-400 leading-tight italic">{displayPosition}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            {(['R','A','C','I'] as ProcedureRaciRole[]).map((role) => {
                              const entry = userRows.find((r) => r.raci_role === role);
                              return (
                                <td key={role} className="px-4 py-3 text-center">
                                  {entry ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black ${RACI_META[role].bg} ${RACI_META[role].color}`}>
                                        {role}
                                      </span>
                                      <button
                                        onClick={() => handleRemoveRaci(entry)}
                                        data-testid={`procedure-raci-remove-${entry.id}`}
                                        title="Xóa phân công này"
                                        className="text-[10px] text-slate-300 hover:text-red-400 transition-colors leading-none"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td />
                          </tr>
                        );
                      })}
                      {raciList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                            <span className="material-symbols-outlined text-3xl block mb-2 text-slate-300">group</span>
                            Chưa có phân công RACI nào. Sử dụng form phía trên để thêm thành viên.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ══════════════════════════════════════════════════════
              TAB: QUẢN TRỊ CHECKLIST
          ══════════════════════════════════════════════════════ */}
          {activeTab === 'checklist_admin' && (
            <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">

              {/* ── Header ── */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-deep-teal">dashboard</span>
                  Quản trị checklist
                </h3>
                <button
                  onClick={handleRefreshChecklist}
                  disabled={worklogsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-sm ${worklogsLoading ? 'animate-spin' : ''}`}>refresh</span>
                  Làm mới
                </button>
              </div>

              {/* ════════════════════════════════════════
                  ROW 1: Tiến độ + Donut chart
              ════════════════════════════════════════ */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                {/* ── Card A: Stat cards + progress bar ── */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-deep-teal">trending_up</span>
                    Tiến độ tổng thể
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tổng bước',  value: stepStats.total,      color: 'text-slate-700',   bg: 'bg-slate-50',   icon: 'format_list_numbered' },
                      { label: 'Hoàn thành', value: stepStats.done,       color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'check_circle' },
                      { label: 'Đang TH',    value: stepStats.inProgress, color: 'text-amber-700',   bg: 'bg-amber-50',   icon: 'sync' },
                      { label: 'Chưa TH',    value: stepStats.todo,       color: 'text-slate-400',   bg: 'bg-slate-50',   icon: 'radio_button_unchecked' },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-xl ${s.bg} px-3 py-2 flex items-center gap-2`}>
                        <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
                        <div>
                          <div className={`text-xl font-black leading-none ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Stacked progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tỷ lệ hoàn thành</span>
                      <span className="font-bold text-deep-teal">{overallPercent}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                      {stepStats.total > 0 && (
                        <>
                          <div className="h-full bg-emerald-400 transition-all duration-500"
                               style={{ width: `${Math.round((stepStats.done / stepStats.total) * 100)}%` }} />
                          <div className="h-full bg-amber-400 transition-all duration-500"
                               style={{ width: `${Math.round((stepStats.inProgress / stepStats.total) * 100)}%` }} />
                        </>
                      )}
                    </div>
                    <div className="flex gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Hoàn thành</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Đang TH</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block"/>Chưa TH</span>
                    </div>
                  </div>
                </div>

                {/* ── Card B: Donut SVG (Tình trạng bước) ── */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col items-center gap-3">
                  <h4 className="w-full text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-deep-teal">donut_large</span>
                    Phân bố trạng thái
                  </h4>
                  {(() => {
                    const total = stepStats.total || 1;
                    const segments = [
                      { val: stepStats.done,       color: '#34d399', label: 'Hoàn thành' },
                      { val: stepStats.inProgress, color: '#fbbf24', label: 'Đang TH' },
                      { val: stepStats.todo,        color: '#e2e8f0', label: 'Chưa TH' },
                    ];
                    const r = 52; const cx = 64; const cy = 64; const stroke = 20;
                    let offset = 0;
                    const circumference = 2 * Math.PI * r;
                    return (
                      <div className="flex items-center gap-6">
                        <svg width="128" height="128" viewBox="0 0 128 128">
                          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke}/>
                          {segments.map((seg, i) => {
                            const pct   = seg.val / total;
                            const dash  = pct * circumference;
                            const gap   = circumference - dash;
                            const el = (
                              <circle
                                key={i}
                                cx={cx} cy={cy} r={r}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth={stroke}
                                strokeDasharray={`${dash} ${gap}`}
                                strokeDashoffset={-offset * circumference}
                                strokeLinecap="butt"
                                style={{ transition: 'stroke-dasharray 0.5s ease' }}
                                transform={`rotate(-90 ${cx} ${cy})`}
                              />
                            );
                            offset += pct;
                            return el;
                          })}
                          <text x={cx} y={cy - 5} textAnchor="middle" className="font-black" fontSize="18" fontWeight="900" fill="#0f4c5c">{overallPercent}%</text>
                          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">hoàn thành</text>
                        </svg>
                        <div className="space-y-1.5">
                          {segments.map((seg) => (
                            <div key={seg.label} className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }}/>
                              <span className="text-slate-500">{seg.label}</span>
                              <span className="font-bold text-slate-700 ml-auto pl-2">{seg.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  ROW 2: Bar chart tiến độ theo phase + Issue donut
              ════════════════════════════════════════ */}
              {(() => {
                type PhaseRow = { total: number; done: number; inProg: number; label: string };
                const phaseMap = steps.reduce<Record<string, PhaseRow>>((acc, s) => {
                  if (s.parent_step_id) return acc;
                  const ph  = s.phase ?? 'KHAC';
                  const lbl = s.phase_label ?? PHASE_LABELS[ph] ?? ph;
                  if (!acc[ph]) acc[ph] = { total: 0, done: 0, inProg: 0, label: lbl };
                  acc[ph].total++;
                  if (s.progress_status === 'HOAN_THANH')    acc[ph].done++;
                  if (s.progress_status === 'DANG_THUC_HIEN') acc[ph].inProg++;
                  return acc;
                }, {});
                const phases = (Object.entries(phaseMap) as [string, PhaseRow][]).filter(([, d]) => d.total > 0);
                const hasPhases = phases.length > 1;
                const hasIssues = issueWorklogs.length > 0;
                if (!hasPhases && !hasIssues) return null;
                return (
                  <div className={`grid grid-cols-1 gap-4 ${hasPhases && hasIssues ? 'lg:grid-cols-2' : ''}`}>

                    {/* Bar chart theo phase */}
                    {hasPhases && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-deep-teal">bar_chart</span>
                          Tiến độ theo giai đoạn
                        </h4>
                        <div className="space-y-2">
                          {phases.map(([ph, d]) => {
                            const donePct   = Math.round((d.done   / d.total) * 100);
                            const inProgPct = Math.round((d.inProg / d.total) * 100);
                            return (
                              <div key={ph} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-600 truncate max-w-[180px]" title={d.label}>{d.label}</span>
                                  <span className="text-slate-400 shrink-0 ml-2">{d.done}/{d.total}</span>
                                </div>
                                <div className="h-4 w-full rounded-md bg-slate-100 overflow-hidden flex">
                                  <div className="h-full bg-emerald-400 transition-all duration-500 flex items-center justify-center"
                                       style={{ width: `${donePct}%` }}>
                                    {donePct >= 15 && <span className="text-[9px] font-bold text-white">{donePct}%</span>}
                                  </div>
                                  <div className="h-full bg-amber-400 transition-all duration-500"
                                       style={{ width: `${inProgPct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Issue donut */}
                    {hasIssues && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-rose-500">troubleshoot</span>
                          Tình trạng xử lý vấn đề
                          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {issueWorklogs.length} vấn đề
                          </span>
                        </h4>
                        {(() => {
                          const total = issueWorklogs.length || 1;
                          const segs = [
                            { val: issuesByStatus.JUST_ENCOUNTERED.length, color: '#f87171', label: 'Vừa gặp' },
                            { val: issuesByStatus.IN_PROGRESS.length,      color: '#fbbf24', label: 'Đang xử lý' },
                            { val: issuesByStatus.RESOLVED.length,         color: '#34d399', label: 'Đã giải quyết' },
                          ].filter(s => s.val > 0);
                          const r = 40; const cx = 50; const cy = 50; const sw = 16;
                          const circ = 2 * Math.PI * r;
                          let off = 0;
                          return (
                            <div className="flex items-center gap-4">
                              <svg width="100" height="100" viewBox="0 0 100 100">
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw}/>
                                {segs.map((seg, i) => {
                                  const pct  = seg.val / total;
                                  const dash = pct * circ;
                                  const el = (
                                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                                      stroke={seg.color} strokeWidth={sw}
                                      strokeDasharray={`${dash} ${circ - dash}`}
                                      strokeDashoffset={-off * circ}
                                      transform={`rotate(-90 ${cx} ${cy})`}/>
                                  );
                                  off += pct;
                                  return el;
                                })}
                                <text x={cx} y={cy - 3} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f4c5c">{issueWorklogs.length}</text>
                                <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill="#94a3b8">vấn đề</text>
                              </svg>
                              <div className="flex-1 space-y-1.5">
                                {([
                                  { val: issuesByStatus.JUST_ENCOUNTERED.length, color: '#f87171', label: 'Vừa gặp',        statusKey: 'JUST_ENCOUNTERED' as IssueStatus },
                                  { val: issuesByStatus.IN_PROGRESS.length,      color: '#fbbf24', label: 'Đang xử lý',     statusKey: 'IN_PROGRESS' as IssueStatus },
                                  { val: issuesByStatus.RESOLVED.length,         color: '#34d399', label: 'Đã giải quyết',  statusKey: 'RESOLVED' as IssueStatus },
                                ]).map((seg) => (
                                  <button
                                    key={seg.label}
                                    onClick={() => {
                                      setIssueFilterTab(seg.statusKey);
                                      issuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className="w-full flex items-center gap-1.5 text-[11px] rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                                  >
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }}/>
                                    <span className="text-slate-500 flex-1">{seg.label}</span>
                                    <span className="font-bold text-slate-700">{seg.val}</span>
                                    <span className="text-slate-300 text-[10px]">({Math.round((seg.val / (issueWorklogs.length || 1)) * 100)}%)</span>
                                    <span className="material-symbols-outlined text-[12px] text-slate-300">chevron_right</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ════════════════════════════════════════
                  ROW 3: Danh sách khó khăn & đề xuất
              ════════════════════════════════════════ */}
              <div ref={issuesSectionRef} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-500">warning</span>
                    Khó khăn &amp; Đề xuất
                    {issueWorklogs.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                        {issueWorklogs.length}
                      </span>
                    )}
                  </h4>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 flex-wrap">
                  {([
                    { key: 'all',              label: 'Tất cả',          count: issueWorklogs.length,                   color: 'text-slate-600 bg-slate-100' },
                    { key: 'JUST_ENCOUNTERED', label: '🔴 Vừa gặp',       count: issuesByStatus.JUST_ENCOUNTERED.length, color: 'text-rose-700 bg-rose-50' },
                    { key: 'IN_PROGRESS',      label: '🟡 Đang xử lý',    count: issuesByStatus.IN_PROGRESS.length,      color: 'text-amber-700 bg-amber-50' },
                    { key: 'RESOLVED',         label: '🟢 Đã giải quyết', count: issuesByStatus.RESOLVED.length,         color: 'text-emerald-700 bg-emerald-50' },
                  ] as { key: IssueStatus | 'all'; label: string; count: number; color: string }[]).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setIssueFilterTab(f.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        issueFilterTab === f.key
                          ? f.color + ' ring-1 ring-inset ring-current'
                          : 'text-slate-400 hover:text-slate-600 bg-slate-50'
                      }`}
                    >
                      {f.label}
                      {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
                    </button>
                  ))}
                </div>

                {/* Issue cards */}
                {worklogsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Đang tải dữ liệu...
                  </div>
                ) : (() => {
                  const displayed = issueFilterTab === 'all'
                    ? issueWorklogs
                    : issuesByStatus[issueFilterTab as IssueStatus] ?? [];
                  if (displayed.length === 0) {
                    return (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        {issueWorklogs.length === 0
                          ? 'Chưa có khó khăn nào được ghi nhận.'
                          : 'Không có vấn đề ở trạng thái này.'}
                      </div>
                    );
                  }
                  const statusCfg: Record<IssueStatus, { label: string; color: string; dot: string }> = {
                    JUST_ENCOUNTERED: { label: 'Vừa gặp',       color: 'text-rose-700 bg-rose-50 border-rose-200',         dot: 'bg-rose-500' },
                    IN_PROGRESS:      { label: 'Đang xử lý',    color: 'text-amber-700 bg-amber-50 border-amber-200',       dot: 'bg-amber-400' },
                    RESOLVED:         { label: 'Đã giải quyết', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
                  };
                  return (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {displayed.map((wl) => {
                        const iss = wl.issue!;
                        const sc  = statusCfg[iss.issue_status];
                        const isUpdating = issueUpdating[wl.id] ?? false;
                        return (
                          <div key={wl.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 hover:border-slate-300 transition-colors">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {wl.step && (
                                <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  #{wl.step.step_number} {wl.step.step_name}
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
                                {sc.label}
                              </span>
                              <span className="ml-auto text-slate-400">
                                {wl.creator?.full_name ?? ''}
                                {wl.creator?.user_code ? ` (${wl.creator.user_code})` : ''}
                                {wl.created_at ? ` — ${new Date(wl.created_at).toLocaleDateString('vi-VN')}` : ''}
                              </span>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                              <span className="material-symbols-outlined text-sm text-rose-400 shrink-0 mt-0.5">error_outline</span>
                              <p className="text-slate-700 leading-snug">{iss.issue_content}</p>
                            </div>
                            {iss.proposal_content && (
                              <div className="flex items-start gap-2 text-xs">
                                <span className="material-symbols-outlined text-sm text-amber-400 shrink-0 mt-0.5">lightbulb</span>
                                <p className="text-slate-600 leading-snug italic">{iss.proposal_content}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                              <span className="text-[10px] text-slate-400 font-medium">Đổi trạng thái:</span>
                              {(['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'] as IssueStatus[]).map((st) => (
                                <button
                                  key={st}
                                  disabled={isUpdating || iss.issue_status === st}
                                  onClick={() => void handleChangeIssueStatus(wl.id, st)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                    iss.issue_status === st
                                      ? statusCfg[st].color + ' cursor-default'
                                      : 'text-slate-500 bg-white border-slate-200 hover:border-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {isUpdating && iss.issue_status !== st ? '...' : statusCfg[st].label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          )}

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
