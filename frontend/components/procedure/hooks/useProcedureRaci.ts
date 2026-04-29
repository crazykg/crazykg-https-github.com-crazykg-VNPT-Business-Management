import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { fetchEmployeesOptionsPage } from '../../../services/v5Api';
import {
  addProcedureRaci,
  addStepRaci,
  batchSetStepRaci,
  fetchProcedureRaci,
  fetchStepRaciBulk,
  removeProcedureRaci,
  removeStepRaci,
} from '../../../services/api/projectApi';
import { getEmployeeLabel, resolvePositionName } from '../../../utils/employeeDisplay';
import type {
  Employee,
  ProcedureRaciEntry,
  ProcedureRaciRole,
  ProcedureStepRaciEntry,
  ProjectProcedure,
} from '../../../types';
import type { SearchableSelectOption } from '../../SearchableSelect';

type ProcedureNotify = ((type: string, title: string, message: string) => void) | undefined;
type StepRaciCopyMode = 'overwrite' | 'merge';
type PendingRoleChange = {
  nextRole: ProcedureRaciRole;
  previousRole: ProcedureRaciRole;
} | null;

interface UseProcedureRaciParams {
  activeProcedure: ProjectProcedure | null;
  activeTab: string;
  inflightRef: MutableRefObject<Set<string>>;
  onNotify?: ProcedureNotify;
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

function mergeProcedureRaciEntry(
  prev: ProcedureRaciEntry[],
  entry: ProcedureRaciEntry,
): ProcedureRaciEntry[] {
  const filtered = prev.filter((row) => {
    if (String(row.user_id) === String(entry.user_id) && row.raci_role === entry.raci_role) return false;
    if (entry.raci_role === 'A' && row.raci_role === 'A') return false;
    return true;
  });

  return [...filtered, entry];
}

function filterStepRaciByProcedureMembers(
  prev: Record<string, ProcedureStepRaciEntry[]>,
  allowedUserIds: Set<string>,
): Record<string, ProcedureStepRaciEntry[]> {
  const next: Record<string, ProcedureStepRaciEntry[]> = {};

  for (const stepKey of Object.keys(prev)) {
    const rows = prev[stepKey] ?? [];
    const filtered = rows.filter((row) => allowedUserIds.has(String(row.user_id)));
    if (filtered.length > 0) next[stepKey] = filtered;
  }

  return next;
}

function buildEmployeeOption(employee: Employee): SearchableSelectOption {
  const position = resolvePositionName(employee);
  const label = `${getEmployeeLabel(employee)}${position ? ` — ${position}` : ''}`;
  return {
    value: String(employee.id),
    label,
    searchText: [employee.user_code, employee.full_name, employee.job_title_raw, employee.username, position]
      .filter(Boolean)
      .join(' '),
  };
}

export const useProcedureRaci = ({
  activeProcedure,
  activeTab,
  inflightRef,
  onNotify,
}: UseProcedureRaciParams) => {
  const [raciList, setRaciList] = useState<ProcedureRaciEntry[]>([]);
  const [stepRaciMap, setStepRaciMap] = useState<Record<string, ProcedureStepRaciEntry[]>>({});
  const [raciLoading, setRaciLoading] = useState(false);
  const [raciUserId, setRaciUserId] = useState('');
  const [raciRole, setRaciRole] = useState<ProcedureRaciRole>('R');
  const [raciNote, setRaciNote] = useState('');
  const [raciSaving, setRaciSaving] = useState(false);
  const [showAccountableConfirm, setShowAccountableConfirm] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange>(null);
  const [accountableReplacementConfirmed, setAccountableReplacementConfirmed] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<SearchableSelectOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [employeeCache, setEmployeeCache] = useState<Map<string, Employee>>(new Map());

  const resetAccountableConfirmState = useCallback(() => {
    setShowAccountableConfirm(false);
    setPendingRoleChange(null);
    setAccountableReplacementConfirmed(false);
  }, []);

  const resetProcedureRaci = useCallback(() => {
    setRaciList([]);
    setStepRaciMap({});
    setRaciLoading(false);
    setRaciUserId('');
    setRaciRole('R');
    setRaciNote('');
    setRaciSaving(false);
    resetAccountableConfirmState();
    setUserSearch('');
    setUserOptions([]);
    setUsersLoading(false);
    setEmployeeCache(new Map());
  }, [resetAccountableConfirmState]);

  const existingAccountable = useMemo(
    () => raciList.find((entry) => entry.raci_role === 'A') ?? null,
    [raciList],
  );

  const hasAccountableConflict = useCallback((nextUserId: string, nextRole: ProcedureRaciRole) => {
    if (nextRole !== 'A' || !existingAccountable) return false;
    if (nextUserId && String(existingAccountable.user_id) === String(nextUserId)) return false;
    return true;
  }, [existingAccountable]);

  const reloadProcedureRaci = useCallback(async () => {
    if (!activeProcedure) {
      resetProcedureRaci();
      return;
    }

    setRaciLoading(true);
    try {
      const [nextRaciList, nextStepRaciRows] = await Promise.all([
        fetchProcedureRaci(activeProcedure.id).catch(() => [] as ProcedureRaciEntry[]),
        fetchStepRaciBulk(activeProcedure.id).catch(() => [] as ProcedureStepRaciEntry[]),
      ]);
      resetAccountableConfirmState();
      setRaciList(nextRaciList);
      setStepRaciMap(groupStepRaciByStep(nextStepRaciRows));
    } finally {
      setRaciLoading(false);
    }
  }, [activeProcedure, resetAccountableConfirmState, resetProcedureRaci]);

  useEffect(() => {
    let cancelled = false;

    if (!activeProcedure) {
      resetProcedureRaci();
      return undefined;
    }

    setRaciLoading(true);
    Promise.all([
      fetchProcedureRaci(activeProcedure.id).catch(() => [] as ProcedureRaciEntry[]),
      fetchStepRaciBulk(activeProcedure.id).catch(() => [] as ProcedureStepRaciEntry[]),
    ])
      .then(([nextRaciList, nextStepRaciRows]) => {
        if (cancelled) return;
        resetAccountableConfirmState();
        setRaciList(nextRaciList);
        setStepRaciMap(groupStepRaciByStep(nextStepRaciRows));
      })
      .finally(() => {
        if (!cancelled) {
          setRaciLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProcedure?.id, resetAccountableConfirmState, resetProcedureRaci]);

  useEffect(() => {
    if (activeTab !== 'raci') {
      setUsersLoading(false);
      return undefined;
    }

    let cancelled = false;
    setUsersLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchEmployeesOptionsPage(userSearch, 1, 40);
        const data: Employee[] = (res as { data?: Employee[] }).data ?? (Array.isArray(res) ? res : []);
        const options = data.map(buildEmployeeOption);

        if (cancelled) return;
        setUserOptions(options);
        setEmployeeCache((prev) => {
          const next = new Map(prev);
          data.forEach((employee) => next.set(String(employee.id), employee));
          return next;
        });
      } catch {
        if (!cancelled) {
          setUserOptions([]);
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, userSearch]);

  const handleProcedureRaciRoleChange = useCallback((nextRole: ProcedureRaciRole) => {
    if (nextRole !== 'A') {
      resetAccountableConfirmState();
      setRaciRole(nextRole);
      return;
    }

    setRaciRole(nextRole);

    if (!hasAccountableConflict(raciUserId, nextRole) || accountableReplacementConfirmed) {
      return;
    }

    setPendingRoleChange({
      nextRole,
      previousRole: raciRole,
    });
    setShowAccountableConfirm(true);
  }, [
    accountableReplacementConfirmed,
    hasAccountableConflict,
    raciRole,
    raciUserId,
    resetAccountableConfirmState,
  ]);

  const handleConfirmAccountableReplacement = useCallback(() => {
    if (pendingRoleChange?.nextRole === 'A') {
      setRaciRole('A');
      setAccountableReplacementConfirmed(true);
    }
    setPendingRoleChange(null);
    setShowAccountableConfirm(false);
  }, [pendingRoleChange]);

  const handleCancelAccountableReplacement = useCallback(() => {
    setRaciRole(pendingRoleChange?.previousRole ?? 'R');
    resetAccountableConfirmState();
  }, [pendingRoleChange, resetAccountableConfirmState]);

  const handleAddRaci = useCallback(async () => {
    const key = 'raci-add';
    if (inflightRef.current.has(key)) return;
    if (!activeProcedure || !raciUserId) return;
    if (hasAccountableConflict(raciUserId, raciRole) && !accountableReplacementConfirmed) {
      setPendingRoleChange({
        nextRole: raciRole,
        previousRole: raciRole === 'A' ? 'R' : raciRole,
      });
      setShowAccountableConfirm(true);
      return;
    }

    inflightRef.current.add(key);
    setRaciSaving(true);
    try {
      const entry = await addProcedureRaci(activeProcedure.id, {
        user_id: raciUserId,
        raci_role: raciRole,
        note: raciNote || undefined,
      });
      const nextRaciList = mergeProcedureRaciEntry(raciList, entry);
      setRaciList(nextRaciList);
      if (entry.raci_role === 'A') {
        const allowedUserIds = new Set(nextRaciList.map((row) => String(row.user_id)));
        setStepRaciMap((prev) => filterStepRaciByProcedureMembers(prev, allowedUserIds));
      }
      setRaciUserId('');
      setRaciNote('');
      setAccountableReplacementConfirmed(false);
      setPendingRoleChange(null);
      setShowAccountableConfirm(false);
      setUserSearch('');
      onNotify?.('success', 'RACI', 'Đã thêm phân công RACI');
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm RACI');
    } finally {
      inflightRef.current.delete(key);
      setRaciSaving(false);
    }
  }, [
    accountableReplacementConfirmed,
    activeProcedure,
    hasAccountableConflict,
    inflightRef,
    onNotify,
    raciList,
    raciNote,
    raciRole,
    raciUserId,
  ]);

  const handleRemoveRaci = useCallback(async (entry: ProcedureRaciEntry) => {
    try {
      await removeProcedureRaci(entry.id);
      setRaciList((prev) => prev.filter((row) => row.id !== entry.id));
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
  }, [onNotify]);

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
  }, [inflightRef, onNotify]);

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
  }, [inflightRef, onNotify]);

  const handleSetStepAccountable = useCallback(async (stepId: string | number, userId: string | number) => {
    const stepKey = String(stepId);
    const currentA = (stepRaciMap[stepKey] ?? []).find((entry) => entry.raci_role === 'A') ?? null;
    if (currentA && String(currentA.user_id) === String(userId)) {
      await handleRemoveStepRaci(currentA.id);
      return;
    }

    await handleAddStepRaci(stepId, userId, 'A');
  }, [handleAddStepRaci, handleRemoveStepRaci, stepRaciMap]);

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
      await handleSetStepAccountable(stepId, userId);
      return;
    }

    await handleAddStepRaci(stepId, userId, role);
  }, [handleAddStepRaci, handleRemoveStepRaci, handleSetStepAccountable, stepRaciMap]);

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
  }, [activeProcedure, inflightRef, onNotify, stepRaciMap]);

  const raciSummaryBadge = useMemo(() => {
    if (!raciList.length) return '';
    const counts: Record<ProcedureRaciRole, number> = { R: 0, A: 0, C: 0, I: 0 };
    raciList.forEach((entry) => {
      counts[entry.raci_role] += 1;
    });
    return (['R', 'A', 'C', 'I'] as ProcedureRaciRole[])
      .filter((role) => counts[role] > 0)
      .map((role) => `${counts[role]}${role}`)
      .join(', ');
  }, [raciList]);

  const displayedUserOptions = useMemo(() => {
    if (!raciUserId || userOptions.some((option) => String(option.value) === String(raciUserId))) {
      return userOptions;
    }

    const selectedEmployee = employeeCache.get(String(raciUserId));
    if (!selectedEmployee) {
      return userOptions;
    }

    return [buildEmployeeOption(selectedEmployee), ...userOptions];
  }, [employeeCache, raciUserId, userOptions]);

  return {
    raciList,
    stepRaciMap,
    setStepRaciMap,
    raciLoading,
    raciUserId,
    raciRole,
    raciNote,
    raciSaving,
    userOptions: displayedUserOptions,
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
  };
};
