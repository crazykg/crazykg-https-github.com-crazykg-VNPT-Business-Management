import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import {
  Project,
  ProcedureTemplate,
  ProjectProcedure,
  ProjectProcedureStep,
  ProcedureStepStatus,
  ProcedureStepBatchUpdate,
  ProcedureStepWorklog,
  ProcedureRaciEntry,
  ProcedureRaciRole,
  Employee,
  ProjectTypeOption,
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
  fetchProcedureRaci,
  addProcedureRaci,
  removeProcedureRaci,
  fetchProcedureWorklogs,
  fetchEmployeesOptionsPage,
  resyncProcedure,
} from '../services/v5Api';
import { SearchableSelect } from './SearchableSelect';
import type { SearchableSelectOption } from './SearchableSelect';
import { getEmployeeLabel, resolvePositionName } from '../utils/employeeDisplay';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_STATUS_OPTIONS: { value: ProcedureStepStatus; label: string; color: string; dot: string }[] = [
  { value: 'CHUA_THUC_HIEN', label: 'Chưa TH',    color: 'text-slate-400', dot: 'bg-slate-300' },
  { value: 'DANG_THUC_HIEN', label: 'Đang TH',    color: 'text-amber-600', dot: 'bg-amber-400' },
  { value: 'HOAN_THANH',     label: 'Hoàn thành', color: 'text-emerald-600', dot: 'bg-emerald-500' },
];

const PHASE_LABELS: Record<string, string> = {
  CHUAN_BI:         'Chuẩn bị',
  CHUAN_BI_DAU_TU:  'Chuẩn bị đầu tư',
  THUC_HIEN_DAU_TU: 'Thực hiện đầu tư',
  KET_THUC_DAU_TU:  'Kết thúc đầu tư',
  CHUAN_BI_KH_THUE: 'Chuẩn bị thực hiện KH thuê',
};

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

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTab = 'steps' | 'worklog' | 'raci';

interface ProjectProcedureModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  projectTypes?: ProjectTypeOption[];
}

interface PhaseGroup {
  phase: string;
  label: string;
  steps: ProjectProcedureStep[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByPhase(flat: ProjectProcedureStep[]): PhaseGroup[] {
  const order: string[] = [];
  const map = new Map<string, ProjectProcedureStep[]>();
  for (const s of flat) {
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProjectProcedureModal: React.FC<ProjectProcedureModalProps> = ({
  project, isOpen, onClose, onNotify, projectTypes = [],
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

  // ── Worklog state ──
  const [worklogs,        setWorklogs]        = useState<ProcedureStepWorklog[]>([]);
  const [worklogsLoading, setWorklogsLoading] = useState(false);
  // Per-step worklog panel
  const [openWorklogStep, setOpenWorklogStep]     = useState<string | number | null>(null);
  const [stepWorklogs,    setStepWorklogs]         = useState<Record<string, ProcedureStepWorklog[]>>({});
  const [stepWorklogInput, setStepWorklogInput]    = useState<Record<string, string>>({});
  const [stepWorklogSaving, setStepWorklogSaving]  = useState<Record<string, boolean>>({});

  // ── Inline row edit state ──
  const [editingStepId,  setEditingStepId]  = useState<string | number | null>(null);
  const [editingRowDraft, setEditingRowDraft] = useState<{
    step_name: string; lead_unit: string; expected_result: string; duration_days: string;
  }>({ step_name: '', lead_unit: '', expected_result: '', duration_days: '' });

  // ── RACI state ──
  const [raciList,      setRaciList]      = useState<ProcedureRaciEntry[]>([]);
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

  const autoCreatedRef = useRef(false);
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

  // ── Load steps ──
  useEffect(() => {
    if (!activeProcedure) { setSteps([]); return; }
    setIsLoading(true);
    fetchProcedureSteps(activeProcedure.id)
      .then((data) => { setSteps(data); setDrafts({}); })
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message || 'Không thể tải bước')))
      .finally(() => setIsLoading(false));
  }, [activeProcedure?.id]);

  // ── Load worklogs when tab switches — skip if already populated ──
  useEffect(() => {
    if (activeTab !== 'worklog' || !activeProcedure) return;
    if (worklogs.length > 0) return;                   // ← already populated, skip
    setWorklogsLoading(true);
    fetchProcedureWorklogs(activeProcedure.id)
      .then(setWorklogs)
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message)))
      .finally(() => setWorklogsLoading(false));
  }, [activeTab, activeProcedure?.id]);                // worklogs intentionally excluded

  // ── Load RACI when tab switches ──
  useEffect(() => {
    if (activeTab !== 'raci' || !activeProcedure) return;
    setRaciLoading(true);
    fetchProcedureRaci(activeProcedure.id)
      .then(setRaciList)
      .catch((err) => onNotify?.('error', 'Lỗi', String(err?.message)))
      .finally(() => setRaciLoading(false));
  }, [activeTab, activeProcedure?.id]);

  // ── Computed ──
  const phaseGroups = useMemo(() => groupByPhase(steps), [steps]);
  const totalSteps      = steps.filter((s) => !s.parent_step_id).length;
  const completedSteps  = steps.filter((s) => !s.parent_step_id && (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
  const inProgressSteps = steps.filter((s) => !s.parent_step_id && (drafts[s.id]?.progress_status ?? s.progress_status) === 'DANG_THUC_HIEN').length;
  const overallPercent  = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const hasDirtyChanges = Object.keys(drafts).length > 0;

  // RACI grouped by role
  const raciByRole = useMemo(() => {
    const g: Record<ProcedureRaciRole, ProcedureRaciEntry[]> = { R: [], A: [], C: [], I: [] };
    for (const r of raciList) { g[r.raci_role]?.push(r); }
    return g;
  }, [raciList]);

  // ── Handlers — steps ──

  const handleDraftChange = useCallback(
    (stepId: string | number, field: string, value: string | null) => {
      setDrafts((prev) => ({ ...prev, [String(stepId)]: { ...prev[String(stepId)], [field]: value } }));
    }, [],
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
                 document_date: c.document_date };
      });
      const result = await batchUpdateProcedureSteps(batch);
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setDrafts({});
      setActiveProcedure((prev) => prev ? { ...prev, overall_progress: result.overall_progress } : null);
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
    setOpenWorklogStep(null); setStepWorklogs({}); onClose();
  }, [hasDirtyChanges, onClose]);

  useEscKey(handleClose, isOpen);

  const toggleDetail = useCallback((id: string | number) => {
    setExpandedDetails((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleAddStep = useCallback(async (phase: string) => {
    if (!activeProcedure || !newStepName.trim()) return;
    try {
      await addCustomProcedureStep(activeProcedure.id, {
        step_name: newStepName.trim(), phase,
        lead_unit: newStepUnit.trim() || null,
        duration_days: newStepDays ? parseInt(newStepDays, 10) : 0,
      });
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setNewStepName(''); setNewStepUnit(''); setNewStepDays(''); setAddingInPhase(null);
      onNotify?.('success', 'Đã thêm', 'Thêm bước thành công');
    } catch (err: any) { onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm bước'); }
  }, [activeProcedure, newStepName, newStepUnit, newStepDays]);

  const handleDeleteStep = useCallback(async (step: ProjectProcedureStep) => {
    if (!window.confirm(`Xóa bước "${step.step_name}"?`)) return;
    try {
      await deleteProcedureStep(step.id);
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
      onNotify?.('success', 'Đã xóa', 'Đã xóa bước thành công');
    } catch (err: any) { onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa'); }
  }, []);

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
    const content = (stepWorklogInput[String(stepId)] || '').trim();
    if (!content) return;
    inflightRef.current.add(key);
    setStepWorklogSaving((prev) => ({ ...prev, [String(stepId)]: true }));
    try {
      const log = await addStepWorklog(stepId, content);
      setStepWorklogs((prev) => ({ ...prev, [String(stepId)]: [log, ...(prev[String(stepId)] || [])] }));
      setStepWorklogInput((prev) => ({ ...prev, [String(stepId)]: '' }));
      // Cập nhật worklog tab nếu đang mở — optimistic prepend, không refetch
      setWorklogs((prev) => {
        if (!prev.some((w) => w.id === log.id)) return [log, ...prev];
        return prev;
      });
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm worklog');
    } finally {
      inflightRef.current.delete(key);
      setStepWorklogSaving((prev) => ({ ...prev, [String(stepId)]: false }));
    }
  }, [stepWorklogInput]);

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

  const handleRemoveRaci = useCallback(async (raciId: string | number) => {
    try {
      await removeProcedureRaci(raciId);
      setRaciList((prev) => prev.filter((r) => r.id !== raciId));
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể xóa RACI');
    }
  }, []);

  if (!isOpen) return null;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
      <div className="w-full max-w-[1600px] mx-4 my-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[96vh]">

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
            {activeProcedure && (
              <button
                type="button"
                title="Xoá bước cũ và tạo lại toàn bộ từ mẫu thủ tục (template) hiện tại"
                onClick={async () => {
                  if (!confirm('Đồng bộ lại sẽ XOÁ toàn bộ bước hiện tại (bao gồm worklog, RACI) và tạo lại từ mẫu template.\n\nBạn chắc chắn?')) return;
                  try {
                    setIsLoading(true);
                    await resyncProcedure(activeProcedure.id);
                    // Reload steps
                    const newSteps = await fetchProcedureSteps(activeProcedure.id);
                    setSteps(newSteps);
                    setDrafts({});
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
              { key: 'steps',   label: 'Bảng thủ tục',  icon: 'checklist' },
              { key: 'worklog', label: 'Worklog',        icon: 'history' },
              { key: 'raci',    label: 'RACI',           icon: 'group' },
            ] as { key: ActiveTab; label: string; icon: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-deep-teal text-deep-teal'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
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
                  const phTotal     = group.steps.filter((s) => !s.parent_step_id).length;
                  const phCompleted = group.steps.filter((s) => !s.parent_step_id && (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
                  const phPercent   = phTotal > 0 ? Math.round((phCompleted / phTotal) * 100) : 0;
                  const isAllDone   = phCompleted === phTotal && phTotal > 0;
                  const isAddingHere = addingInPhase === group.phase;

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
                            <span className="mt-0.5 block text-xs text-slate-400">{phCompleted}/{phTotal} bước {isAllDone && '✓'}</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 ml-2">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isAllDone ? 'bg-emerald-500' : 'bg-deep-teal'}`} style={{ width: `${phPercent}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{phPercent}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => { setAddingInPhase(isAddingHere ? null : group.phase); setNewStepName(''); setNewStepUnit(''); setNewStepDays(''); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-deep-teal bg-white border border-deep-teal/30 rounded-lg hover:bg-deep-teal/5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">{isAddingHere ? 'close' : 'add'}</span>
                          {isAddingHere ? 'Hủy' : 'Thêm bước'}
                        </button>
                      </div>

                      {/* Steps table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1140px]">
                          <thead className="bg-white border-b border-slate-100">
                            <tr>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[40px]">TT</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Trình tự công việc</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[150px]">ĐV chủ trì</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[150px]">Kết quả dự kiến</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[40px] text-center">Ngày</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[120px]">Tiến độ</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[125px]">Số văn bản</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[110px]">Ngày VB</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[140px]">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">history</span>
                                  Worklog
                                </span>
                              </th>
                              <th className="px-2 py-2 w-[30px]" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {group.steps.map((step) => {
                              const isChild   = !!step.parent_step_id;
                              const draft     = drafts[String(step.id)] ?? {};
                              const status    = (draft.progress_status ?? step.progress_status) as ProcedureStepStatus;
                              const isExpanded = expandedDetails.has(step.id);
                              const isCustom   = !step.template_step_id;
                              const isWlogOpen = openWorklogStep === step.id;
                              const wlogs      = stepWorklogs[String(step.id)] ?? [];
                              const wlogInput  = stepWorklogInput[String(step.id)] ?? '';
                              const wlogSaving = stepWorklogSaving[String(step.id)] ?? false;
                              const wlogCount  = step.worklogs_count ?? wlogs.length;
                              const canMutate  = wlogCount === 0;
                              const isEditing  = editingStepId === step.id;

                              return (
                                <React.Fragment key={step.id}>
                                  <tr className={`transition-colors ${isEditing ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : `hover:bg-slate-50/60 ${ROW_BG[status]}`}`}>

                                    {/* TT */}
                                    <td className="px-3 py-2 text-xs font-mono text-slate-400 text-center">
                                      {isChild ? <span className="text-slate-300">└</span> : step.step_number}
                                    </td>

                                    {/* Name */}
                                    <td
                                      className="px-3 py-2 text-sm text-slate-800"
                                      style={{ paddingLeft: isChild ? '28px' : '12px' }}
                                    >
                                      {isEditing ? (
                                        <input
                                          autoFocus
                                          value={editingRowDraft.step_name}
                                          onChange={(e) => setEditingRowDraft((p) => ({ ...p, step_name: e.target.value }))}
                                          onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEditRow(); }}
                                          className="w-full px-2 py-1 text-sm rounded border border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                        />
                                      ) : (
                                        <div
                                          className="flex items-start gap-1 flex-wrap group cursor-pointer"
                                          onClick={() => step.step_detail && toggleDetail(step.id)}
                                        >
                                          {step.step_detail && (
                                            <span className="material-symbols-outlined text-xs text-slate-400 mt-0.5 shrink-0">
                                              {isExpanded ? 'expand_more' : 'chevron_right'}
                                            </span>
                                          )}
                                          <span className={isChild ? 'text-slate-600 text-xs' : 'font-medium'}>
                                            {step.step_name}
                                          </span>
                                          {isCustom && (
                                            <span className="px-1 py-0.5 rounded text-[9px] bg-violet-100 text-violet-600 font-semibold shrink-0">
                                              TỰ THÊM
                                            </span>
                                          )}
                                          {canMutate ? (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); handleStartEditRow(step); }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-primary transition-all shrink-0"
                                              title="Sửa bước"
                                            >
                                              <span className="material-symbols-outlined text-xs">edit</span>
                                            </button>
                                          ) : (
                                            <span
                                              className="material-symbols-outlined text-[10px] text-slate-300 mt-0.5 shrink-0"
                                              title="Đã có worklog — không thể sửa/xóa"
                                            >lock</span>
                                          )}
                                        </div>
                                      )}
                                      {!isEditing && isExpanded && step.step_detail && (
                                        <div className="mt-1 text-xs text-slate-500 bg-slate-50 rounded p-2 border border-slate-100">
                                          {step.step_detail}
                                        </div>
                                      )}
                                    </td>

                                    {/* Lead unit */}
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                      {isEditing ? (
                                        <input
                                          value={editingRowDraft.lead_unit}
                                          onChange={(e) => setEditingRowDraft((p) => ({ ...p, lead_unit: e.target.value }))}
                                          onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEditRow(); }}
                                          className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                          placeholder="ĐV chủ trì..."
                                        />
                                      ) : (
                                        <span className="line-clamp-2">{step.lead_unit || '—'}</span>
                                      )}
                                    </td>

                                    {/* Expected result */}
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                      {isEditing ? (
                                        <textarea
                                          value={editingRowDraft.expected_result}
                                          onChange={(e) => setEditingRowDraft((p) => ({ ...p, expected_result: e.target.value }))}
                                          onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEditRow(); }}
                                          rows={2}
                                          className="w-full px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none resize-none"
                                          placeholder="Kết quả dự kiến..."
                                        />
                                      ) : (
                                        <span className="line-clamp-2">{step.expected_result || '—'}</span>
                                      )}
                                    </td>

                                    {/* Days */}
                                    <td className="px-3 py-2 text-xs text-slate-400 text-center">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          value={editingRowDraft.duration_days}
                                          onChange={(e) => setEditingRowDraft((p) => ({ ...p, duration_days: e.target.value }))}
                                          onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEditRow(); }}
                                          className="w-16 px-2 py-1 text-xs rounded border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-center"
                                        />
                                      ) : (
                                        step.duration_days || 0
                                      )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-3 py-2">
                                      <select
                                        value={status}
                                        onChange={(e) => handleDraftChange(step.id, 'progress_status', e.target.value)}
                                        className={`w-full px-2 py-1 rounded text-xs font-medium border border-slate-200 bg-white cursor-pointer ${STEP_STATUS_OPTIONS.find((o) => o.value === status)?.color || ''}`}
                                      >
                                        {STEP_STATUS_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </td>

                                    {/* Doc number */}
                                    <td className="px-3 py-2">
                                      <input type="text"
                                        value={draft.document_number ?? step.document_number ?? ''}
                                        onChange={(e) => handleDraftChange(step.id, 'document_number', e.target.value || null)}
                                        className="w-full px-2 py-1 rounded text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
                                        placeholder="Số VB..."
                                      />
                                    </td>

                                    {/* Doc date */}
                                    <td className="px-3 py-2">
                                      <input type="date"
                                        value={draft.document_date ?? step.document_date ?? ''}
                                        onChange={(e) => handleDraftChange(step.id, 'document_date', e.target.value || null)}
                                        className="w-full px-2 py-1 rounded text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
                                      />
                                    </td>

                                    {/* ★ WORKLOG cell */}
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={() => handleToggleStepWorklog(step.id)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors w-full ${
                                          isWlogOpen
                                            ? 'bg-violet-100 text-violet-700'
                                            : 'bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600'
                                        }`}
                                      >
                                        <span className="material-symbols-outlined text-sm">history</span>
                                        <span>{wlogs.length > 0 ? `${wlogs.length} log` : 'Worklog'}</span>
                                        <span className="material-symbols-outlined text-xs ml-auto">{isWlogOpen ? 'expand_less' : 'expand_more'}</span>
                                      </button>
                                    </td>

                                    {/* Delete / Confirm edit */}
                                    <td className="px-2 py-2">
                                      {isEditing ? (
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => handleSaveEditRow(step)} className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors" title="Lưu">
                                            <span className="material-symbols-outlined text-base">check</span>
                                          </button>
                                          <button onClick={handleCancelEditRow} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" title="Hủy">
                                            <span className="material-symbols-outlined text-base">close</span>
                                          </button>
                                        </div>
                                      ) : canMutate ? (
                                        <button onClick={() => handleDeleteStep(step)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                          <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                      ) : null}
                                    </td>
                                  </tr>

                                  {/* Worklog expanded panel */}
                                  {isWlogOpen && (
                                    <tr>
                                      <td colSpan={10} className="px-4 py-3 bg-violet-50/50 border-t border-violet-100">
                                        <div className="flex flex-col gap-2">
                                          {/* Add worklog */}
                                          <div className="flex gap-2">
                                            <input
                                              autoFocus
                                              type="text"
                                              value={wlogInput}
                                              onChange={(e) => setStepWorklogInput((prev) => ({ ...prev, [String(step.id)]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !wlogSaving) handleAddStepWorklog(step.id);
                                              }}
                                              placeholder="Ghi worklog mới... (Enter để lưu)"
                                              className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-violet-200 bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
                                            />
                                            <button
                                              onClick={() => handleAddStepWorklog(step.id)}
                                              disabled={!wlogInput.trim() || wlogSaving}
                                              className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                              {wlogSaving ? '...' : 'Thêm'}
                                            </button>
                                          </div>
                                          {/* Log list */}
                                          {wlogs.length > 0 ? (
                                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                                              {wlogs.map((log) => (
                                                <div key={log.id} className="flex items-start gap-2 text-xs group">
                                                  <span className={`p-1 rounded-full shrink-0 ${WORKLOG_COLOR[log.log_type] || 'bg-slate-100 text-slate-400'}`}>
                                                    <span className="material-symbols-outlined text-xs leading-none">{WORKLOG_ICON[log.log_type] || 'info'}</span>
                                                  </span>
                                                  <div className="flex-1 min-w-0">
                                                    <span className="text-slate-700">{log.content}</span>
                                                    <span className="text-slate-400 ml-2">
                                                      {log.creator?.full_name || 'Hệ thống'}
                                                      {' · '}
                                                      <span title={absTime(log.created_at)} className="cursor-default">
                                                        {relativeTime(log.created_at)}
                                                      </span>
                                                    </span>
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
                                </React.Fragment>
                              );
                            })}

                            {/* Inline add-step form */}
                            {isAddingHere && (
                              <tr className="bg-violet-50 border-t-2 border-violet-200">
                                <td className="px-3 py-2 text-xs text-slate-400 text-center">+</td>
                                <td className="px-3 py-2">
                                  <input autoFocus type="text" value={newStepName}
                                    onChange={(e) => setNewStepName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStep(group.phase)}
                                    placeholder="Tên bước mới..."
                                    className="w-full px-2 py-1 rounded text-xs border border-violet-300 bg-white focus:border-violet-500 outline-none font-medium"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="text" value={newStepUnit} onChange={(e) => setNewStepUnit(e.target.value)}
                                    placeholder="ĐV chủ trì..." className="w-full px-2 py-1 rounded text-xs border border-violet-300 bg-white outline-none" />
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-400">—</td>
                                <td className="px-3 py-2">
                                  <input type="number" value={newStepDays} onChange={(e) => setNewStepDays(e.target.value)}
                                    placeholder="0" className="w-full px-2 py-1 rounded text-xs border border-violet-300 bg-white outline-none text-center" min="0" />
                                </td>
                                <td colSpan={5} className="px-3 py-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => handleAddStep(group.phase)} disabled={!newStepName.trim()}
                                      className="px-3 py-1 text-xs font-semibold bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                      Thêm
                                    </button>
                                    <button onClick={() => setAddingInPhase(null)}
                                      className="px-3 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50">
                                      Hủy
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {group.steps.length === 0 && !isAddingHere && (
                              <tr>
                                <td colSpan={10} className="px-4 py-4 text-center text-xs text-slate-400">Chưa có bước nào.</td>
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
                              <span className="text-xs font-semibold text-slate-700">{log.content}</span>
                              {log.step && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          ) : (
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
                                        onClick={() => handleRemoveRaci(entry.id)}
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
          )}
        </div>

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
