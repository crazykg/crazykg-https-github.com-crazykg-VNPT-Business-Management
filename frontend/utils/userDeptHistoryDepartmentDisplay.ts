import type { Department } from '../types';

const normalizeDepartmentName = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const normalizeDepartmentIdentity = (value: unknown): string =>
  normalizeDepartmentName(value).replace(/[^a-z0-9]+/g, '');

const isTelecomRootDepartment = (department?: Department): boolean =>
  Boolean(
    department &&
    department.parent_id == null &&
    normalizeDepartmentName(department.dept_name).includes('vien thong')
  );

export const findUserDeptHistoryDepartment = (
  departments: Department[],
  value: unknown,
  deptCode?: string | null,
  deptName?: string | null,
): Department | undefined => {
  const normalizedValue = String(value ?? '').trim();

  return departments.find(
    (department) =>
      String(department.id) === normalizedValue ||
      department.dept_code === normalizedValue ||
      department.dept_name === normalizedValue ||
      (deptCode ? department.dept_code === deptCode : false) ||
      (deptName ? department.dept_name === deptName : false),
  );
};

export const getUserDeptHistoryDepartmentLabel = (
  departments: Department[],
  value: unknown,
  fallback?: {
    deptCode?: string | null;
    deptName?: string | null;
  },
): string => {
  const department = findUserDeptHistoryDepartment(
    departments,
    value,
    fallback?.deptCode,
    fallback?.deptName,
  );

  if (department) {
    const parentDepartment = department.parent_id == null
      ? undefined
      : departments.find((item) => String(item.id) === String(department.parent_id));

    if (parentDepartment && !isTelecomRootDepartment(parentDepartment)) {
      return parentDepartment.dept_name || parentDepartment.dept_code || '';
    }

    const departmentCode = String(department.dept_code ?? '').trim();
    const departmentName = String(department.dept_name ?? '').trim();

    if (
      departmentName &&
      departmentCode &&
      normalizeDepartmentIdentity(departmentCode) === normalizeDepartmentIdentity(departmentName)
    ) {
      return departmentName;
    }

    const departmentLabel = [departmentCode, departmentName].filter(Boolean).join(' - ');
    if (departmentLabel) {
      return departmentLabel;
    }
  }

  if (
    fallback?.deptName &&
    fallback?.deptCode &&
    normalizeDepartmentIdentity(fallback.deptCode) === normalizeDepartmentIdentity(fallback.deptName)
  ) {
    return fallback.deptName;
  }

  if (fallback?.deptName) return fallback.deptName;
  if (fallback?.deptCode) return fallback.deptCode;
  return String(value ?? '').trim();
};
