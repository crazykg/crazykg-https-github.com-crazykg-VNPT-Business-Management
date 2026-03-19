import React, { useEffect, useMemo, useState } from 'react';
import {
  ProjectProcedureStep,
  ProcedureRaciEntry,
  ProcedureRaciRole,
  ProcedureStepRaciEntry,
} from '../../types';

type CopyMode = 'overwrite' | 'merge';

interface RaciMatrixPanelProps {
  phase: string;
  phaseLabel: string;
  steps: ProjectProcedureStep[];
  raciMembers: ProcedureRaciEntry[];
  stepRaciMap: Record<string, ProcedureStepRaciEntry[]>;
  onToggle: (stepId: string | number, userId: string | number, role: ProcedureRaciRole) => void | Promise<void>;
  onCopy: (sourceStepId: string | number, targetStepIds: Array<string | number>, mode: CopyMode) => void | Promise<void>;
  onClose: () => void;
}

const ROLE_ORDER: ProcedureRaciRole[] = ['A', 'R', 'C', 'I'];

const ROLE_META: Record<ProcedureRaciRole, { tone: string; outline: string; label: string }> = {
  A: {
    tone: 'border-amber-300 bg-amber-100 text-amber-700',
    outline: 'border-dashed border-amber-200 bg-white text-amber-400 hover:border-solid hover:bg-amber-50 hover:text-amber-600',
    label: 'Accountable',
  },
  R: {
    tone: 'border-rose-300 bg-rose-100 text-rose-700',
    outline: 'border-dashed border-rose-200 bg-white text-rose-400 hover:border-solid hover:bg-rose-50 hover:text-rose-600',
    label: 'Responsible',
  },
  C: {
    tone: 'border-blue-300 bg-blue-100 text-blue-700',
    outline: 'border-dashed border-blue-200 bg-white text-blue-400 hover:border-solid hover:bg-blue-50 hover:text-blue-600',
    label: 'Consulted',
  },
  I: {
    tone: 'border-slate-300 bg-slate-100 text-slate-600',
    outline: 'border-dashed border-slate-200 bg-white text-slate-300 hover:border-solid hover:bg-slate-50 hover:text-slate-500',
    label: 'Informed',
  },
};

function getDisplayName(user: {
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  user_id?: string | number | null;
}): string {
  return String(user.full_name || user.user_code || user.username || user.user_id || 'Thành viên');
}

function getInitials(user: {
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  user_id?: string | number | null;
}): string {
  const fullName = String(user.full_name || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join('');
  }
  const fallback = String(user.user_code || user.username || user.user_id || 'TV');
  return fallback.slice(0, 2).toUpperCase();
}

export const RaciMatrixPanel: React.FC<RaciMatrixPanelProps> = ({
  phase,
  phaseLabel,
  steps,
  raciMembers,
  stepRaciMap,
  onToggle,
  onCopy,
  onClose,
}) => {
  const [copySourceStepId, setCopySourceStepId] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<Record<string, boolean>>({});
  const [copyMode, setCopyMode] = useState<CopyMode>('overwrite');
  const [copySaving, setCopySaving] = useState(false);
  const [flashStepIds, setFlashStepIds] = useState<string[]>([]);

  const members = useMemo(() => {
    const seen = new Set<string>();
    return raciMembers.filter((member) => {
      const key = String(member.user_id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [raciMembers]);

  const roleLookup = useMemo(() => {
    const lookup: Record<string, Record<string, Set<ProcedureRaciRole>>> = {};
    Object.keys(stepRaciMap).forEach((stepId) => {
      const rows = stepRaciMap[stepId] ?? [];
      lookup[stepId] = {};
      rows.forEach((row) => {
        const userKey = String(row.user_id);
        if (!lookup[stepId][userKey]) {
          lookup[stepId][userKey] = new Set<ProcedureRaciRole>();
        }
        lookup[stepId][userKey].add(row.raci_role);
      });
    });
    return lookup;
  }, [stepRaciMap]);

  useEffect(() => {
    if (!copySourceStepId) {
      setCopyTargets({});
      setCopyMode('overwrite');
      return;
    }

    const nextTargets: Record<string, boolean> = {};
    steps.forEach((step) => {
      const key = String(step.id);
      if (key !== copySourceStepId) nextTargets[key] = true;
    });
    setCopyTargets(nextTargets);
    setCopyMode('overwrite');
  }, [copySourceStepId, steps]);

  useEffect(() => {
    if (flashStepIds.length === 0) return undefined;
    const timer = window.setTimeout(() => setFlashStepIds([]), 1400);
    return () => window.clearTimeout(timer);
  }, [flashStepIds]);

  const copyTargetIds = useMemo(
    () => Object.keys(copyTargets).filter((stepId) => copyTargets[stepId]),
    [copyTargets],
  );

  const handleApplyCopy = async () => {
    if (!copySourceStepId || copyTargetIds.length === 0) return;
    setCopySaving(true);
    try {
      await Promise.resolve(onCopy(copySourceStepId, copyTargetIds, copyMode));
      setFlashStepIds(copyTargetIds);
      setCopySourceStepId(null);
    } finally {
      setCopySaving(false);
    }
  };

  return (
    <div
      data-testid="raci-matrix-panel"
      className="absolute inset-0 z-30 flex items-start justify-center bg-slate-900/20 backdrop-blur-[1px] p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Phân công RACI - {phaseLabel}</h3>
            <p className="text-xs text-slate-500">
              Phase {phase} • Click trực tiếp từng ô để gán hoặc bỏ vai trò. Vai trò A chỉ có tối đa một người trên mỗi bước.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Đóng
          </button>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          {members.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">
              <span className="material-symbols-outlined mb-2 block text-4xl text-slate-300">group_off</span>
              Vui lòng thêm thành viên ở tab RACI trước khi phân công theo bước.
            </div>
          ) : (
            <table className="min-w-[980px] w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-20 min-w-[260px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Bước
                  </th>
                  {members.map((member) => (
                    <th key={String(member.user_id)} className="min-w-[150px] px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-deep-teal/10 text-[11px] font-bold text-deep-teal">
                          {getInitials(member)}
                        </span>
                        <span className="max-w-[120px] truncate text-[11px] font-semibold text-slate-700" title={getDisplayName(member)}>
                          {getDisplayName(member)}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="min-w-[56px] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Copy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {steps.map((step) => {
                  const stepKey = String(step.id);
                  const stepEntries = stepRaciMap[stepKey] ?? [];
                  const hasAssignments = stepEntries.length > 0;
                  const isFlashing = flashStepIds.includes(stepKey);
                  return (
                    <tr
                      key={stepKey}
                      data-testid={`raci-row-${step.id}`}
                      className={`transition-colors ${isFlashing ? 'bg-amber-50/80' : 'hover:bg-slate-50/60'}`}
                    >
                      <td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-4 py-3 align-top">
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-400">#{step.step_number}</div>
                          <div className="text-sm font-medium text-slate-800">{step.step_name}</div>
                        </div>
                      </td>
                      {members.map((member) => {
                        const assignedRoles = roleLookup[stepKey]?.[String(member.user_id)] ?? new Set<ProcedureRaciRole>();
                        return (
                          <td key={`${stepKey}-${String(member.user_id)}`} className="px-3 py-3 align-top">
                            <div className="flex items-center justify-center gap-1">
                              {ROLE_ORDER.map((role) => {
                                const isAssigned = assignedRoles.has(role);
                                const tone = ROLE_META[role];
                                return (
                                  <button
                                    key={role}
                                    type="button"
                                    data-testid={`raci-cell-${step.id}-${member.user_id}-${role}`}
                                    aria-pressed={isAssigned}
                                    onClick={() => onToggle(step.id, member.user_id, role)}
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-black transition-colors ${
                                      isAssigned ? tone.tone : tone.outline
                                    }`}
                                    title={`${isAssigned ? 'Bỏ' : 'Gán'} vai trò ${role} cho ${getDisplayName(member)}`}
                                  >
                                    {role}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center align-top">
                        {hasAssignments ? (
                          <button
                            type="button"
                            data-testid={`raci-copy-${step.id}`}
                            onClick={() => setCopySourceStepId(stepKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-deep-teal/30 hover:text-deep-teal"
                            title="Sao chép RACI của bước này"
                          >
                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                          </button>
                        ) : (
                          <span className="text-slate-200">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {copySourceStepId && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/20 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Sao chép RACI</h4>
                  <p className="text-[11px] text-slate-500">
                    Áp dụng phân công từ bước #{steps.find((step) => String(step.id) === copySourceStepId)?.step_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCopySourceStepId(null)}
                  className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    steps.forEach((step) => {
                      const key = String(step.id);
                      if (key !== copySourceStepId) next[key] = true;
                    });
                    setCopyTargets(next);
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    steps.forEach((step) => {
                      const key = String(step.id);
                      if (key !== copySourceStepId) next[key] = false;
                    });
                    setCopyTargets(next);
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {steps
                  .filter((step) => String(step.id) !== copySourceStepId)
                  .map((step) => {
                    const key = String(step.id);
                    return (
                      <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                        <input
                          type="checkbox"
                          data-testid={`raci-copy-target-${step.id}`}
                          checked={copyTargets[key] ?? false}
                          onChange={(event) => setCopyTargets((prev) => ({ ...prev, [key]: event.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-deep-teal focus:ring-deep-teal/20"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-700">#{step.step_number} {step.step_name}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 text-[11px] font-semibold text-slate-500">Chế độ áp dụng</div>
                <div className="space-y-2">
                  {([
                    { value: 'overwrite', label: 'Ghi đè', description: 'Xóa RACI cũ của bước đích rồi gán mới.' },
                    { value: 'merge', label: 'Gộp thêm', description: 'Giữ R/C/I cũ, chỉ thay A nếu nguồn có A và thêm phần còn thiếu.' },
                  ] as Array<{ value: CopyMode; label: string; description: string }>).map((option) => (
                    <label key={option.value} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <input
                        type="radio"
                        name="copy-raci-mode"
                        data-testid={`raci-copy-mode-${option.value}`}
                        checked={copyMode === option.value}
                        onChange={() => setCopyMode(option.value)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-deep-teal focus:ring-deep-teal/20"
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{option.label}</div>
                        <div className="text-[11px] text-slate-500">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCopySourceStepId(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  data-testid="raci-copy-apply"
                  onClick={handleApplyCopy}
                  disabled={copySaving || copyTargetIds.length === 0}
                  className="rounded-lg bg-deep-teal px-3 py-2 text-xs font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copySaving ? 'Đang áp dụng...' : `Áp dụng cho ${copyTargetIds.length} bước`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
