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
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<SearchableSelectOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [employeeCache, setEmployeeCache] = useState<Map<string, Employee>>(new Map());

  const resetProcedureRaci = useCallback(() => {
    setRaciList([]);
    setStepRaciMap({});
    setRaciLoading(false);
    setRaciUserId('');
    setRaciRole('R');
    setRaciNote('');
    setRaciSaving(false);
    setUserSearch('');
    setUserOptions([]);
    setUsersLoading(false);
    setEmployeeCache(new Map());
  }, []);

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
      setRaciList(nextRaciList);
      setStepRaciMap(groupStepRaciByStep(nextStepRaciRows));
    } finally {
      setRaciLoading(false);
    }
  }, [activeProcedure, resetProcedureRaci]);

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
  }, [activeProcedure?.id, resetProcedureRaci]);

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
        const options: SearchableSelectOption[] = data.map((employee) => {
          const position = resolvePositionName(employee);
          const label = `${getEmployeeLabel(employee)}${position ? ` — ${position}` : ''}`;
          return {
            value: String(employee.id),
            label,
            searchText: [employee.user_code, employee.full_name, employee.job_title_raw, employee.username, position]
              .filter(Boolean)
              .join(' '),
          };
        });

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

  const handleAddRaci = useCallback(async () => {
    const key = 'raci-add';
    if (inflightRef.current.has(key)) return;
    if (!activeProcedure || !raciUserId) return;

    inflightRef.current.add(key);
    setRaciSaving(true);
    try {
      const entry = await addProcedureRaci(activeProcedure.id, {
        user_id: raciUserId,
        raci_role: raciRole,
        note: raciNote || undefined,
      });
      setRaciList((prev) => {
        const filtered = prev.filter(
          (row) => !(String(row.user_id) === String(entry.user_id) && row.raci_role === entry.raci_role),
        );
        return [...filtered, entry];
      });
      setRaciUserId('');
      setRaciNote('');
      setUserSearch('');
      onNotify?.('success', 'RACI', 'Đã thêm phân công RACI');
    } catch (err: any) {
      onNotify?.('error', 'Lỗi', err?.message || 'Không thể thêm RACI');
    } finally {
      inflightRef.current.delete(key);
      setRaciSaving(false);
    }
  }, [activeProcedure, inflightRef, onNotify, raciNote, raciRole, raciUserId]);

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

  const handleAssignA = useCallback(async (stepId: string | number, userId: string | number) => {
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
      await handleAssignA(stepId, userId);
      return;
    }

    await handleAddStepRaci(stepId, userId, role);
  }, [handleAddStepRaci, handleAssignA, handleRemoveStepRaci, stepRaciMap]);

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

  return {
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
  };
};
