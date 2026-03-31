import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  addCustomProcedureStep,
  batchUpdateProcedureSteps,
  deleteProcedureStep,
  fetchProcedureSteps,
  renameProcedureStep,
  reorderProcedureSteps,
  updateProcedurePhaseLabel,
} from '../../../services/api/projectApi';
import { computeEndDate } from '../../../utils/procedureHelpers';
import type {
  ProcedureStepBatchUpdate,
  ProcedureStepRaciEntry,
  ProcedureStepStatus,
  ProjectProcedure,
  ProjectProcedureStep,
} from '../../../types';

type ProcedureNotify = ((type: string, title: string, message: string) => void) | undefined;

type EditingRowDraft = {
  step_name: string;
  lead_unit: string;
  expected_result: string;
  duration_days: string;
};

const EMPTY_EDITING_ROW_DRAFT: EditingRowDraft = {
  step_name: '',
  lead_unit: '',
  expected_result: '',
  duration_days: '',
};

interface UseProcedureStepsStateParams {
  activeProcedure: ProjectProcedure | null;
  inflightRef: MutableRefObject<Set<string>>;
  onNotify?: ProcedureNotify;
  setActiveProcedure: Dispatch<SetStateAction<ProjectProcedure | null>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setStepRaciMap: Dispatch<SetStateAction<Record<string, ProcedureStepRaciEntry[]>>>;
  setSteps: Dispatch<SetStateAction<ProjectProcedureStep[]>>;
}

export const useProcedureStepsState = ({
  activeProcedure,
  inflightRef,
  onNotify,
  setActiveProcedure,
  setIsSaving,
  setStepRaciMap,
  setSteps,
}: UseProcedureStepsStateParams) => {
  const [drafts, setDrafts] = useState<Record<string, Partial<ProjectProcedureStep>>>({});
  const [expandedDetails, setExpandedDetails] = useState<Set<string | number>>(new Set());

  const [addingInPhase, setAddingInPhase] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState('');
  const [newStepUnit, setNewStepUnit] = useState('');
  const [newStepDays, setNewStepDays] = useState('');
  const [newStepResult, setNewStepResult] = useState('');
  const [addingStepSubmittingPhase, setAddingStepSubmittingPhase] = useState<string | null>(null);

  const [addingChildToStepId, setAddingChildToStepId] = useState<string | number | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [newChildUnit, setNewChildUnit] = useState('');
  const [newChildDays, setNewChildDays] = useState('');
  const [newChildStartDate, setNewChildStartDate] = useState('');
  const [newChildEndDate, setNewChildEndDate] = useState('');
  const [newChildStatus, setNewChildStatus] = useState<ProcedureStepStatus>('CHUA_THUC_HIEN');
  const [addingChildSubmittingStepId, setAddingChildSubmittingStepId] = useState<string | number | null>(null);

  const [editingStepId, setEditingStepId] = useState<string | number | null>(null);
  const [editingRowDraft, setEditingRowDraft] = useState<EditingRowDraft>(EMPTY_EDITING_ROW_DRAFT);

  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingPhaseLabel, setEditingPhaseLabel] = useState('');
  const [phaseLabelSaving, setPhaseLabelSaving] = useState(false);
  const phaseLabelInputRef = useRef<HTMLInputElement>(null);

  const hasDirtyChanges = useMemo(() => Object.keys(drafts).length > 0, [drafts]);

  const handleDraftChange = useCallback((stepId: string | number, field: string, value: string | null) => {
    setDrafts((prev) => ({ ...prev, [String(stepId)]: { ...prev[String(stepId)], [field]: value } }));
  }, []);

  const handleStartDateChange = useCallback((step: ProjectProcedureStep, newStartDate: string | null) => {
    setDrafts((prev) => {
      const existing = prev[String(step.id)] ?? {};
      const days = step.duration_days;
      const endDate = (days && days > 0 && newStartDate)
        ? computeEndDate(newStartDate, days)
        : (!newStartDate ? null : existing.actual_end_date ?? null);
      return {
        ...prev,
        [String(step.id)]: {
          ...existing,
          actual_start_date: newStartDate,
          actual_end_date: endDate,
        },
      };
    });
  }, []);

  const handleToggleDetail = useCallback((stepId: string | number) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const resetAddStepForm = useCallback(() => {
    setAddingInPhase(null);
    setNewStepName('');
    setNewStepUnit('');
    setNewStepDays('');
    setNewStepResult('');
    setAddingStepSubmittingPhase(null);
  }, []);

  const handleToggleAddStep = useCallback((phase: string) => {
    setAddingInPhase((prev) => (prev === phase ? null : phase));
    setNewStepName('');
    setNewStepUnit('');
    setNewStepDays('');
    setNewStepResult('');
  }, []);

  const resetChildForm = useCallback(() => {
    setAddingChildToStepId(null);
    setNewChildName('');
    setNewChildUnit('');
    setNewChildDays('');
    setNewChildStartDate('');
    setNewChildEndDate('');
    setNewChildStatus('CHUA_THUC_HIEN');
    setAddingChildSubmittingStepId(null);
  }, []);

  const handleCancelChild = useCallback(() => {
    resetChildForm();
  }, [resetChildForm]);

  const handleToggleAddChild = useCallback((stepId: string | number) => {
    setAddingChildToStepId((prev) => (prev === stepId ? null : stepId));
    setNewChildName('');
    setNewChildUnit('');
    setNewChildDays('');
    setNewChildStartDate('');
    setNewChildEndDate('');
    setNewChildStatus('CHUA_THUC_HIEN');
  }, []);

  const handleSave = useCallback(async () => {
    const key = 'batch-save';
    if (inflightRef.current.has(key)) return;
    if (!hasDirtyChanges || !activeProcedure) return;

    inflightRef.current.add(key);
    try {
      setIsSaving(true);
      const batch: ProcedureStepBatchUpdate[] = Object.keys(drafts).map((id) => {
        const changes = drafts[id];
        return {
          id,
          progress_status: changes.progress_status,
          document_number: changes.document_number,
          document_date: changes.document_date,
          actual_start_date: changes.actual_start_date,
          actual_end_date: changes.actual_end_date,
        };
      });
      const result = await batchUpdateProcedureSteps(batch);
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      setDrafts({});
      const newProgress = result.overall_progress[Number(activeProcedure.id)] ?? activeProcedure.overall_progress;
      setActiveProcedure((prev) => (prev ? { ...prev, overall_progress: newProgress } : null));
      onNotify?.('success', 'Đã lưu', `Cập nhật ${result.updated_count} bước thành công`);
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể lưu thay đổi');
    } finally {
      inflightRef.current.delete(key);
      setIsSaving(false);
    }
  }, [activeProcedure, drafts, hasDirtyChanges, inflightRef, onNotify, setActiveProcedure, setIsSaving, setSteps]);

  const handleAddStep = useCallback(async (phase: string) => {
    if (!activeProcedure || !newStepName.trim()) return;
    const key = `add-step:${activeProcedure.id}:${phase}`;
    if (inflightRef.current.has(key)) return;

    inflightRef.current.add(key);
    setAddingStepSubmittingPhase(phase);
    try {
      await addCustomProcedureStep(activeProcedure.id, {
        step_name: newStepName.trim(),
        phase,
        lead_unit: newStepUnit.trim() || null,
        expected_result: newStepResult.trim() || null,
        duration_days: newStepDays ? Number.parseInt(newStepDays, 10) : 0,
      });
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      resetAddStepForm();
      onNotify?.('success', 'Đã thêm', 'Thêm bước thành công');
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể thêm bước');
    } finally {
      inflightRef.current.delete(key);
      setAddingStepSubmittingPhase((prev) => (prev === phase ? null : prev));
    }
  }, [
    activeProcedure,
    inflightRef,
    newStepDays,
    newStepName,
    newStepResult,
    newStepUnit,
    onNotify,
    resetAddStepForm,
    setSteps,
  ]);

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
        step_name: newChildName.trim(),
        phase: parentStep.phase,
        lead_unit: newChildUnit.trim() || null,
        duration_days: childDurationDays,
        parent_step_id: parentStep.id,
        actual_start_date: childStartDate,
        actual_end_date: childEndDate,
        progress_status: newChildStatus || 'CHUA_THUC_HIEN',
      });
      const refreshed = await fetchProcedureSteps(activeProcedure.id);
      setSteps(refreshed);
      resetChildForm();
      onNotify?.('success', 'Đã thêm', 'Thêm bước con thành công');
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể thêm bước con');
    } finally {
      inflightRef.current.delete(key);
      setAddingChildSubmittingStepId((prev) => (String(prev) === parentStepId ? null : prev));
    }
  }, [
    activeProcedure,
    drafts,
    inflightRef,
    newChildDays,
    newChildEndDate,
    newChildName,
    newChildStartDate,
    newChildStatus,
    newChildUnit,
    onNotify,
    resetChildForm,
    setSteps,
  ]);

  const handleDeleteStep = useCallback(async (step: ProjectProcedureStep) => {
    if (!window.confirm(`Xóa bước "${step.step_name}"?`)) return;
    try {
      await deleteProcedureStep(step.id);
      setSteps((prev) => prev.filter((row) => row.id !== step.id));
      setStepRaciMap((prev) => {
        const next = { ...prev };
        delete next[String(step.id)];
        return next;
      });
      onNotify?.('success', 'Đã xóa', 'Đã xóa bước thành công');
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể xóa');
    }
  }, [onNotify, setStepRaciMap, setSteps]);

  const handleReorderStep = useCallback(async (steps: ProjectProcedureStep[], step: ProjectProcedureStep, direction: 'up' | 'down') => {
    const phaseSteps = steps
      .filter((row) => row.phase === step.phase && !row.parent_step_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = phaseSteps.findIndex((row) => row.id === step.id);
    if (index === -1) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= phaseSteps.length) return;

    const stepA = phaseSteps[index];
    const stepB = phaseSteps[swapIndex];
    const nextSortOrderA = stepB.sort_order === stepA.sort_order
      ? (direction === 'up' ? stepB.sort_order - 1 : stepB.sort_order + 1)
      : stepB.sort_order;
    const nextSortOrderB = stepA.sort_order;

    setSteps((prev) => prev.map((row) =>
      row.id === stepA.id ? { ...row, sort_order: nextSortOrderA }
        : row.id === stepB.id ? { ...row, sort_order: nextSortOrderB }
          : row
    ));
    try {
      await reorderProcedureSteps([
        { id: stepA.id, sort_order: nextSortOrderA },
        { id: stepB.id, sort_order: nextSortOrderB },
      ]);
    } catch (error: any) {
      setSteps((prev) => prev.map((row) =>
        row.id === stepA.id ? { ...row, sort_order: stepA.sort_order }
          : row.id === stepB.id ? { ...row, sort_order: stepB.sort_order }
            : row
      ));
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể đổi thứ tự bước');
    }
  }, [onNotify, setSteps]);

  const handleStartEditRow = useCallback((step: ProjectProcedureStep) => {
    setEditingStepId(step.id);
    setEditingRowDraft({
      step_name: step.step_name,
      lead_unit: step.lead_unit ?? '',
      expected_result: step.expected_result ?? '',
      duration_days: String(step.duration_days ?? ''),
    });
  }, []);

  const handleCancelEditRow = useCallback(() => {
    setEditingStepId(null);
    setEditingRowDraft(EMPTY_EDITING_ROW_DRAFT);
  }, []);

  const handleSaveEditRow = useCallback(async (step: ProjectProcedureStep) => {
    const draft = editingRowDraft;
    setEditingStepId(null);
    setEditingRowDraft(EMPTY_EDITING_ROW_DRAFT);

    const payload: Record<string, string | number | null> = {};
    const name = draft.step_name.trim();
    if (name && name !== step.step_name) payload.step_name = name;
    if (draft.lead_unit.trim() !== (step.lead_unit ?? '')) payload.lead_unit = draft.lead_unit.trim() || null;
    if (draft.expected_result.trim() !== (step.expected_result ?? '')) payload.expected_result = draft.expected_result.trim() || null;
    const daysNum = draft.duration_days === '' ? null : Number(draft.duration_days);
    if (daysNum !== (step.duration_days ?? null)) payload.duration_days = daysNum;

    if (Object.keys(payload).length === 0) return;
    try {
      const updated = await renameProcedureStep(step.id, payload as never);
      setSteps((prev) => prev.map((row) => row.id === step.id ? { ...row, ...updated } : row));
      onNotify?.('success', 'Đã lưu', 'Bước đã được cập nhật');
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể cập nhật bước');
    }
  }, [editingRowDraft, onNotify, setSteps]);

  const handleStartEditPhase = useCallback((phase: string, currentLabel: string) => {
    setEditingPhase(phase);
    setEditingPhaseLabel(currentLabel);
    setTimeout(() => phaseLabelInputRef.current?.focus(), 50);
  }, []);

  const handleSavePhaseLabel = useCallback(async () => {
    if (!editingPhase || !activeProcedure) return;
    const trimmed = editingPhaseLabel.trim();
    if (!trimmed) {
      setEditingPhase(null);
      return;
    }
    if (phaseLabelSaving) return;

    setPhaseLabelSaving(true);
    try {
      await updateProcedurePhaseLabel(activeProcedure.id, editingPhase, trimmed);
      setSteps((prev) =>
        prev.map((step) => step.phase === editingPhase ? { ...step, phase_label: trimmed } : step),
      );
      setEditingPhase(null);
    } catch {
      // keep editing open on failure to match previous behavior
    } finally {
      setPhaseLabelSaving(false);
    }
  }, [activeProcedure, editingPhase, editingPhaseLabel, phaseLabelSaving, setSteps]);

  const handleCancelEditPhase = useCallback(() => {
    setEditingPhase(null);
    setEditingPhaseLabel('');
  }, []);

  const resetProcedureStepsState = useCallback(() => {
    setDrafts({});
    setExpandedDetails(new Set());
    resetAddStepForm();
    resetChildForm();
    setEditingStepId(null);
    setEditingRowDraft(EMPTY_EDITING_ROW_DRAFT);
    setEditingPhase(null);
    setEditingPhaseLabel('');
    setPhaseLabelSaving(false);
  }, [resetAddStepForm, resetChildForm]);

  return {
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
    setDrafts,
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
  };
};
