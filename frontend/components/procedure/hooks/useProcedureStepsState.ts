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
import { computeDurationDays, computeEndDate, computeStartDate } from '../../../utils/procedureHelpers';
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

const STEP_ORDER_GAP = 10;
const DATE_RANGE_WARNING_TITLE = 'Ngày chưa hợp lệ';
const DATE_RANGE_START_MESSAGE = 'Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.';
const DATE_RANGE_END_MESSAGE = 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.';

type DateRangeField = 'start' | 'end';

const hasOwnField = (source: object, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(source, field);

const toNonNegativeInteger = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const resolveDurationDays = (
  step: ProjectProcedureStep,
  draft: Partial<ProjectProcedureStep>,
): number =>
  hasOwnField(draft, 'duration_days')
    ? toNonNegativeInteger(draft.duration_days)
    : toNonNegativeInteger(step.duration_days);

const resolveStepStartDate = (
  step: ProjectProcedureStep,
  draft: Partial<ProjectProcedureStep>,
): string | null =>
  hasOwnField(draft, 'actual_start_date')
    ? (draft.actual_start_date ?? null)
    : (step.actual_start_date ?? null);

const resolveStepEndDate = (
  step: ProjectProcedureStep,
  draft: Partial<ProjectProcedureStep>,
): string | null =>
  hasOwnField(draft, 'actual_end_date')
    ? (draft.actual_end_date ?? null)
    : (step.actual_end_date ?? null);

const resolveEffectiveStepEndDate = (
  step: ProjectProcedureStep,
  draft: Partial<ProjectProcedureStep>,
): string | null => {
  const startDate = resolveStepStartDate(step, draft);
  const days = resolveDurationDays(step, draft);
  const computedEndDate = startDate && days > 0 ? computeEndDate(startDate, days) : null;
  return computedEndDate ?? resolveStepEndDate(step, draft);
};

const getDateRangeWarningMessage = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  field: DateRangeField,
): string | null => {
  if (!startDate || !endDate || computeDurationDays(startDate, endDate)) return null;
  return field === 'start' ? DATE_RANGE_START_MESSAGE : DATE_RANGE_END_MESSAGE;
};

const getDraftDateRangeWarningMessage = (
  draft: Partial<ProjectProcedureStep>,
  field: DateRangeField,
): string | null => getDateRangeWarningMessage(
  draft.actual_start_date ?? null,
  draft.actual_end_date ?? null,
  field,
);

const getStepDateRangeWarningMessage = (
  step: ProjectProcedureStep,
  draft: Partial<ProjectProcedureStep>,
  field: DateRangeField,
): string | null => getDateRangeWarningMessage(
  resolveStepStartDate(step, draft),
  resolveStepEndDate(step, draft),
  field,
);

const normalizeStepKey = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === '' ? '' : String(value);

const compareStepOrder = (left: ProjectProcedureStep, right: ProjectProcedureStep): number => {
  const orderDiff = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const numberDiff = Number(left.step_number ?? 0) - Number(right.step_number ?? 0);
  if (numberDiff !== 0) return numberDiff;
  return normalizeStepKey(left.id).localeCompare(normalizeStepKey(right.id), 'vi');
};

const getPhaseRows = (
  steps: ProjectProcedureStep[],
  phase: string | null | undefined,
): ProjectProcedureStep[] =>
  steps.filter((row) => normalizeStepKey(row.phase) === normalizeStepKey(phase));

const getChildrenForParent = (
  steps: ProjectProcedureStep[],
  parentId: string | number,
): ProjectProcedureStep[] =>
  steps
    .filter((row) => normalizeStepKey(row.parent_step_id) === normalizeStepKey(parentId))
    .sort(compareStepOrder);

const getParentBlock = (
  steps: ProjectProcedureStep[],
  parentStep: ProjectProcedureStep,
): ProjectProcedureStep[] => [
  parentStep,
  ...getChildrenForParent(steps, parentStep.id),
];

const applySortOrderPayload = (
  rows: ProjectProcedureStep[],
  payload: { id: string | number; sort_order: number }[],
): ProjectProcedureStep[] => {
  const orderMap = new Map(payload.map((item) => [normalizeStepKey(item.id), item.sort_order]));
  return rows.map((row) => {
    const nextSortOrder = orderMap.get(normalizeStepKey(row.id));
    return nextSortOrder === undefined ? row : { ...row, sort_order: nextSortOrder };
  });
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
      const days = resolveDurationDays(step, existing);
      const currentEndDate = resolveEffectiveStepEndDate(step, existing);
      const nextDraft: Partial<ProjectProcedureStep> = {
        ...existing,
        actual_start_date: newStartDate,
      };

      if (!newStartDate) {
        nextDraft.actual_end_date = null;
      } else if (currentEndDate) {
        const inferredDuration = computeDurationDays(newStartDate, currentEndDate);
        if (!inferredDuration) {
          nextDraft.duration_days = 0;
          nextDraft.actual_end_date = currentEndDate;
        } else {
          nextDraft.duration_days = inferredDuration;
          nextDraft.actual_end_date = currentEndDate;
        }
      } else if (days > 0) {
        nextDraft.actual_end_date = computeEndDate(newStartDate, days);
      }

      return {
        ...prev,
        [String(step.id)]: nextDraft,
      };
    });
  }, []);

  const handleEndDateChange = useCallback((step: ProjectProcedureStep, newEndDate: string | null) => {
    setDrafts((prev) => {
      const existing = prev[String(step.id)] ?? {};
      const days = resolveDurationDays(step, existing);
      const currentStartDate = resolveStepStartDate(step, existing);
      const nextDraft: Partial<ProjectProcedureStep> = {
        ...existing,
        actual_end_date: newEndDate,
      };

      if (!newEndDate) {
        nextDraft.actual_end_date = null;
      } else if (currentStartDate) {
        const inferredDuration = computeDurationDays(currentStartDate, newEndDate);
        if (!inferredDuration) {
          nextDraft.duration_days = 0;
          nextDraft.actual_start_date = currentStartDate;
        } else {
          nextDraft.duration_days = inferredDuration;
          nextDraft.actual_start_date = currentStartDate;
        }
      } else if (days > 0) {
        nextDraft.actual_start_date = computeStartDate(newEndDate, days);
      }

      return {
        ...prev,
        [String(step.id)]: nextDraft,
      };
    });
  }, []);

  const handleDateRangeBlur = useCallback((step: ProjectProcedureStep, field: DateRangeField) => {
    const message = getStepDateRangeWarningMessage(step, drafts[String(step.id)] ?? {}, field);
    if (message) {
      onNotify?.('warning', DATE_RANGE_WARNING_TITLE, message);
    }
  }, [drafts, onNotify]);

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

    const invalidRangeMessage = Object.values(drafts)
      .map((draft) => getDraftDateRangeWarningMessage(draft, 'end'))
      .find((message): message is string => Boolean(message));
    if (invalidRangeMessage) {
      onNotify?.('warning', DATE_RANGE_WARNING_TITLE, invalidRangeMessage);
      return;
    }

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
          duration_days: changes.duration_days,
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
    const parentDurationDays = resolveDurationDays(parentStep, parentDraft);
    const parentStartDate = resolveStepStartDate(parentStep, parentDraft);
    const parentEndDate = parentStartDate && parentDurationDays > 0
      ? computeEndDate(parentStartDate, parentDurationDays)
      : resolveStepEndDate(parentStep, parentDraft);
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
    const isChildStep = step.parent_step_id !== null && step.parent_step_id !== undefined && step.parent_step_id !== '';
    const phaseRows = getPhaseRows(steps, step.phase);
    const payload = (() => {
      if (isChildStep) {
        const siblings = phaseRows
          .filter((row) => normalizeStepKey(row.parent_step_id) === normalizeStepKey(step.parent_step_id))
          .sort(compareStepOrder);
        const index = siblings.findIndex((row) => normalizeStepKey(row.id) === normalizeStepKey(step.id));
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return [];
        const nextSiblings = [...siblings];
        [nextSiblings[index], nextSiblings[swapIndex]] = [nextSiblings[swapIndex], nextSiblings[index]];
        const sortOrders = siblings
          .map((row) => Number(row.sort_order ?? 0))
          .sort((left, right) => left - right);
        return nextSiblings.map((row, rowIndex) => ({
          id: row.id,
          sort_order: sortOrders[rowIndex] ?? ((rowIndex + 1) * STEP_ORDER_GAP),
        }));
      }

      const parents = phaseRows
        .filter((row) => !row.parent_step_id)
        .sort(compareStepOrder);
      const index = parents.findIndex((row) => normalizeStepKey(row.id) === normalizeStepKey(step.id));
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || swapIndex < 0 || swapIndex >= parents.length) return [];

      const currentBlock = getParentBlock(phaseRows, parents[index]);
      const targetBlock = getParentBlock(phaseRows, parents[swapIndex]);
      const nextRows = direction === 'up'
        ? [...currentBlock, ...targetBlock]
        : [...targetBlock, ...currentBlock];
      const sortOrders = [...currentBlock, ...targetBlock]
        .map((row) => Number(row.sort_order ?? 0))
        .sort((left, right) => left - right);

      return nextRows.map((row, rowIndex) => ({
        id: row.id,
        sort_order: sortOrders[rowIndex] ?? ((rowIndex + 1) * STEP_ORDER_GAP),
      }));
    })();

    if (payload.length === 0) return;

    const previousRows = steps.filter((row) =>
      payload.some((item) => normalizeStepKey(item.id) === normalizeStepKey(row.id)),
    );

    setSteps((prev) => applySortOrderPayload(prev, payload));
    try {
      await reorderProcedureSteps(payload);
    } catch (error: any) {
      const rollbackPayload = previousRows.map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
      }));
      setSteps((prev) => applySortOrderPayload(prev, rollbackPayload));
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
  };
};
