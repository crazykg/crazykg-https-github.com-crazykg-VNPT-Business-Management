import React, { useEffect, useMemo, useState } from 'react';
import { Department } from '../../types';
import { FormSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const ROOT_DEPARTMENT_CODE = 'BGĐVT';
const MAX_DEPARTMENT_LEVEL = 2;
const SOLUTION_DEPARTMENT_CODE_PREFIX = 'PGP';
const SOLUTION_SUMMARY_TEAM_CODE = 'TTH';
const SOLUTION_CENTER_CODE_TOKENS = ['TTKDGIAIPHAP', 'TTKDGP', 'TTGP'];
const SOLUTION_CENTER_NAME_TOKEN = 'TRUNGTAMKINHDOANHGIAIPHAP';

const isRootDepartmentCode = (value: unknown): boolean => {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
  return normalized === 'BGĐVT' || normalized === 'BGDVT';
};

const normalizeDepartmentCodeToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

const normalizeDepartmentNameToken = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
};

const isSolutionDepartmentCode = (value: unknown): boolean => {
  const token = normalizeDepartmentCodeToken(value);
  return token.startsWith(SOLUTION_DEPARTMENT_CODE_PREFIX);
};

const isSolutionSummaryTeamCode = (value: unknown): boolean =>
  normalizeDepartmentCodeToken(value) === SOLUTION_SUMMARY_TEAM_CODE;

const isSolutionChildDepartmentCode = (value: unknown): boolean =>
  isSolutionDepartmentCode(value) || isSolutionSummaryTeamCode(value);

const isSolutionCenterDepartment = (department: Partial<Department> | null | undefined): boolean => {
  if (!department) {
    return false;
  }

  const codeToken = normalizeDepartmentCodeToken(department.dept_code);
  if (SOLUTION_CENTER_CODE_TOKENS.includes(codeToken)) {
    return true;
  }

  const nameToken = normalizeDepartmentNameToken(department.dept_name);
  return nameToken.includes(SOLUTION_CENTER_NAME_TOKEN);
};

export interface DepartmentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Department | null;
  departments?: Department[];
  onClose: () => void;
  onSave: (data: Partial<Department>) => void;
  isLoading?: boolean;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  type,
  data,
  departments = [],
  onClose,
  onSave,
  isLoading,
}: DepartmentFormModalProps) => {
  const rootDepartment = useMemo(
    () =>
      departments.find((department) => isRootDepartmentCode(department.dept_code)) ||
      null,
    [departments]
  );
  const solutionCenterDepartment = useMemo(() => {
    const currentId = data?.id === null || data?.id === undefined ? '' : String(data.id);
    const otherDepartments = departments.filter((department) => String(department.id) !== currentId);

    return (
      otherDepartments.find((department) => isSolutionCenterDepartment(department)) ||
      departments.find((department) => isSolutionCenterDepartment(department)) ||
      null
    );
  }, [departments, data?.id]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, string[]>();
    (departments || []).forEach((department) => {
      const parentToken =
        department.parent_id === null || department.parent_id === undefined || department.parent_id === ''
          ? ''
          : String(department.parent_id);
      if (!parentToken) {
        return;
      }
      const next = map.get(parentToken) || [];
      next.push(String(department.id));
      map.set(parentToken, next);
    });
    return map;
  }, [departments]);

  const levelById = useMemo(() => {
    const byId = new Map<string, Department>();
    (departments || []).forEach((department) => {
      byId.set(String(department.id), department);
    });

    const cache = new Map<string, number>();
    const resolveLevel = (id: string, trail: Set<string> = new Set()): number => {
      if (cache.has(id)) {
        return cache.get(id) as number;
      }
      if (trail.has(id)) {
        return MAX_DEPARTMENT_LEVEL + 99;
      }

      const current = byId.get(id);
      if (!current) {
        return MAX_DEPARTMENT_LEVEL + 99;
      }

      const parentToken =
        current.parent_id === null || current.parent_id === undefined || current.parent_id === ''
          ? ''
          : String(current.parent_id);
      if (!parentToken) {
        cache.set(id, 0);
        return 0;
      }

      const nextTrail = new Set(trail);
      nextTrail.add(id);
      const level = resolveLevel(parentToken, nextTrail) + 1;
      cache.set(id, level);
      return level;
    };

    const result = new Map<string, number>();
    (departments || []).forEach((department) => {
      const token = String(department.id);
      result.set(token, resolveLevel(token));
    });
    return result;
  }, [departments]);

  const currentDepartmentToken = data?.id === null || data?.id === undefined ? '' : String(data.id);
  const descendantDepartmentIds = useMemo(() => {
    if (!currentDepartmentToken) {
      return new Set<string>();
    }
    const visited = new Set<string>();
    const stack = [...(childrenByParentId.get(currentDepartmentToken) || [])];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const children = childrenByParentId.get(current) || [];
      children.forEach((child) => stack.push(child));
    }
    return visited;
  }, [childrenByParentId, currentDepartmentToken]);

  const subtreeMaxDepth = useMemo(() => {
    if (!currentDepartmentToken) {
      return 0;
    }
    let maxDepth = 0;
    const stack: Array<{ id: string; depth: number }> = [{ id: currentDepartmentToken, depth: 0 }];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop() as { id: string; depth: number };
      if (visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);
      if (current.depth > maxDepth) {
        maxDepth = current.depth;
      }
      const children = childrenByParentId.get(current.id) || [];
      children.forEach((child) => stack.push({ id: child, depth: current.depth + 1 }));
    }
    return maxDepth;
  }, [childrenByParentId, currentDepartmentToken]);

  const [formData, setFormData] = useState<Partial<Department>>({
    id: data?.id,
    dept_code: isRootDepartmentCode(data?.dept_code) ? ROOT_DEPARTMENT_CODE : data?.dept_code || '',
    dept_name: data?.dept_name || '',
    parent_id: data?.parent_id ?? null,
    is_active: data?.is_active ?? true,
  });

  const isRootDepartment = isRootDepartmentCode(formData.dept_code);
  const isSolutionChildDepartment = isSolutionChildDepartmentCode(formData.dept_code);
  const maxAllowedParentLevel = 1 - subtreeMaxDepth;

  const candidateParents = useMemo(() => {
    if (isRootDepartment) {
      return [] as Department[];
    }

    if (isSolutionChildDepartment) {
      if (!solutionCenterDepartment) {
        return [] as Department[];
      }
      return [solutionCenterDepartment];
    }

    return (departments || []).filter((department) => {
      const departmentIdToken = String(department.id);
      if (!departmentIdToken) {
        return false;
      }
      if (departmentIdToken === currentDepartmentToken) {
        return false;
      }
      if (descendantDepartmentIds.has(departmentIdToken)) {
        return false;
      }

      const level = levelById.get(departmentIdToken);
      if (level === undefined || !Number.isFinite(level)) {
        return false;
      }

      return level <= maxAllowedParentLevel;
    });
  }, [
    isRootDepartment,
    isSolutionChildDepartment,
    solutionCenterDepartment,
    departments,
    currentDepartmentToken,
    descendantDepartmentIds,
    levelById,
    maxAllowedParentLevel,
  ]);

  useEffect(() => {
    setFormData((prev) => {
      if (isRootDepartmentCode(prev.dept_code)) {
        if (prev.parent_id !== null) {
          return { ...prev, dept_code: ROOT_DEPARTMENT_CODE, parent_id: null };
        }
        if (prev.dept_code !== ROOT_DEPARTMENT_CODE) {
          return { ...prev, dept_code: ROOT_DEPARTMENT_CODE };
        }
        return prev;
      }

      if (isSolutionChildDepartmentCode(prev.dept_code)) {
        if (!solutionCenterDepartment) {
          return prev;
        }
        if (String(prev.parent_id ?? '') !== String(solutionCenterDepartment.id)) {
          return { ...prev, parent_id: solutionCenterDepartment.id };
        }
        return prev;
      }

      const parentToken = prev.parent_id === null || prev.parent_id === undefined || prev.parent_id === ''
        ? ''
        : String(prev.parent_id);
      const candidateIds = new Set(candidateParents.map((department) => String(department.id)));

      if (parentToken && !candidateIds.has(parentToken)) {
        return { ...prev, parent_id: null };
      }

      if (!parentToken && rootDepartment && candidateIds.has(String(rootDepartment.id))) {
        return { ...prev, parent_id: rootDepartment.id };
      }

      return prev;
    });
  }, [candidateParents, rootDepartment, solutionCenterDepartment, formData.dept_code]);

  const parentOptions = useMemo(() => {
    if (isRootDepartment) {
      return [{ value: '', label: 'Không có (phòng ban gốc)' }];
    }

    const sortedCandidates = [...candidateParents].sort((a, b) => {
      const levelA = levelById.get(String(a.id)) ?? 99;
      const levelB = levelById.get(String(b.id)) ?? 99;
      if (levelA !== levelB) {
        return levelA - levelB;
      }
      return String(a.dept_code || '').localeCompare(String(b.dept_code || ''), 'vi');
    });

    return sortedCandidates.map((department) => ({
      value: String(department.id),
      label: `${department.dept_code} - ${department.dept_name}`,
    }));
  }, [isRootDepartment, candidateParents, levelById]);

  const parentError = useMemo(() => {
    if (isRootDepartment) {
      return '';
    }

    if (isSolutionChildDepartment && !solutionCenterDepartment) {
      return 'Vui lòng tạo Trung tâm Kinh doanh Giải pháp trước khi thêm mã PGP/TTH.';
    }

    if (candidateParents.length === 0) {
      return 'Không có phòng ban cha hợp lệ. Hệ thống chỉ cho phép tối đa 3 cấp (0,1,2).';
    }

    return '';
  }, [isRootDepartment, isSolutionChildDepartment, solutionCenterDepartment, candidateParents.length]);

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm mới phòng ban' : 'Chỉnh sửa phòng ban'}
      icon={type === 'ADD' ? 'domain_add' : 'edit_note'}
    >
      <div className="relative space-y-5 p-6">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px]">
            <div className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
            <p className="animate-pulse text-sm font-semibold text-primary">Đang lưu dữ liệu...</p>
          </div>
        ) : null}

        <FormInput
          label="Mã phòng ban"
          value={formData.dept_code}
          onChange={(e: any) => setFormData({ ...formData, dept_code: e.target.value })}
          placeholder={`Nhập mã phòng ban (gốc: ${ROOT_DEPARTMENT_CODE})`}
          required
          error={type === 'ADD' && !formData.dept_code ? 'Mã phòng ban là bắt buộc' : ''}
        />
        <FormInput
          label="Tên phòng ban"
          value={formData.dept_name}
          onChange={(e: any) => setFormData({ ...formData, dept_name: e.target.value })}
          placeholder="Nhập tên phòng ban"
          required
        />
        <FormSelect
          label="Phòng ban cha"
          value={formData.parent_id === null || formData.parent_id === undefined ? '' : String(formData.parent_id)}
          onChange={(e: any) => {
            const raw = e.target.value;
            if (!raw) {
              setFormData({ ...formData, parent_id: null });
              return;
            }
            const numeric = Number(raw);
            setFormData({ ...formData, parent_id: Number.isNaN(numeric) ? raw : numeric });
          }}
          options={parentOptions}
          disabled={isRootDepartment || parentOptions.length === 0}
          error={parentError}
        />

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Trạng thái hoạt động</label>
            <span className="text-xs text-slate-500">Kích hoạt để cho phép phòng ban hoạt động ngay</span>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={Boolean(formData.is_active)}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']"></div>
          </label>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
          Hủy
        </button>
        <button
          onClick={() => {
            if (!isRootDepartment && parentError) {
              return;
            }

            const rawParentId = isRootDepartment ? null : formData.parent_id;
            const normalizedParentId =
              rawParentId === null || rawParentId === undefined || rawParentId === ''
                ? null
                : Number.isNaN(Number(rawParentId))
                  ? rawParentId
                  : Number(rawParentId);

            onSave({
              ...formData,
              dept_code: isRootDepartment ? ROOT_DEPARTMENT_CODE : formData.dept_code,
              parent_id: normalizedParentId,
            });
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
        >
          {isLoading ? 'Đang lưu...' : (type === 'ADD' ? 'Lưu' : 'Lưu thay đổi')}
        </button>
      </div>
    </ModalWrapper>
  );
};
