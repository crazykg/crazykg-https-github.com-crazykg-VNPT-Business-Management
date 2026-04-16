import type { AuthUser, Department } from '../types';

const ROOT_DEPARTMENT_CODE = 'BGDVT';
const ROOT_DEPARTMENT_NAME_TOKEN = 'BANGIAMDOCVIENTHONG';
const SOLUTION_CENTER_CODE_TOKENS = new Set(['TTKDGIAIPHAP', 'TTKDGP', 'TTGP']);
const SOLUTION_CENTER_NAME_TOKEN = 'TRUNGTAMKINHDOANHGIAIPHAP';

const normalizeDepartmentToken = (value: unknown): string =>
  String(value ?? '')
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toUpperCase();

const findDepartmentById = (
  departments: Department[],
  departmentId: string | number | null | undefined
): Department | null => {
  const normalizedId = String(departmentId ?? '').trim();
  if (!normalizedId) {
    return null;
  }

  return departments.find((department) => String(department.id) === normalizedId) ?? null;
};

const isSolutionCenterDepartment = (department: Department | null | undefined): boolean => {
  if (!department) {
    return false;
  }

  const codeToken = normalizeDepartmentToken(department.dept_code);
  if (SOLUTION_CENTER_CODE_TOKENS.has(codeToken)) {
    return true;
  }

  const nameToken = normalizeDepartmentToken(department.dept_name);
  return nameToken.includes(SOLUTION_CENTER_NAME_TOKEN);
};

const isRootDepartment = (department: Department | null | undefined): boolean => {
  if (!department) {
    return false;
  }

  const codeToken = normalizeDepartmentToken(department.dept_code);
  if (codeToken === ROOT_DEPARTMENT_CODE) {
    return true;
  }

  const nameToken = normalizeDepartmentToken(department.dept_name);
  return nameToken === ROOT_DEPARTMENT_NAME_TOKEN;
};

export const resolveProjectOwnershipDepartment = (
  authUser: AuthUser | null | undefined,
  departments: Department[]
): Department | null => {
  if (!authUser) {
    return null;
  }

  const currentDepartment = findDepartmentById(departments, authUser.department_id);
  if (!currentDepartment) {
    return null;
  }

  const parentDepartment = findDepartmentById(departments, currentDepartment.parent_id);
  if (isSolutionCenterDepartment(parentDepartment)) {
    return parentDepartment;
  }

  if (isRootDepartment(parentDepartment)) {
    return currentDepartment;
  }

  return currentDepartment;
};

export const resolveProjectDefaultDepartmentFilterId = (
  authUser: AuthUser | null | undefined,
  departments: Department[],
  availableDepartmentIds?: Set<string>
): string => {
  const department = resolveProjectOwnershipDepartment(authUser, departments);
  const resolvedId = department ? String(department.id) : '';

  if (!resolvedId) {
    return '';
  }

  if (availableDepartmentIds && !availableDepartmentIds.has(resolvedId)) {
    return '';
  }

  return resolvedId;
};
