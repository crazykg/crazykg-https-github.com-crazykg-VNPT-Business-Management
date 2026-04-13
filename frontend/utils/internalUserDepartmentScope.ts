import type { AuthUser, Department } from '../types';

const normalizeDepartmentToken = (value: unknown): string =>
  String(value ?? '')
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toUpperCase();

const sortDepartments = (departments: Department[]): Department[] =>
  [...departments].sort((left, right) =>
    `${left.dept_code} ${left.dept_name}`.localeCompare(`${right.dept_code} ${right.dept_name}`, 'vi')
  );

const dedupeDepartments = (departments: Department[]): Department[] => {
  const seen = new Set<string>();
  return departments.filter((department) => {
    const key = String(department.id);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const isAdminUser = (user: AuthUser | null | undefined): boolean => {
  if (!user) {
    return false;
  }

  const roles = (user.roles || []).map((role) => String(role || '').trim().toUpperCase());
  if (roles.includes('ADMIN')) {
    return true;
  }

  const permissions = new Set((user.permissions || []).map((permission) => String(permission || '').trim()));
  return permissions.has('*');
};

export const isBgdvtDepartment = (department: Department | null | undefined): boolean => {
  if (!department) {
    return false;
  }

  const codeToken = normalizeDepartmentToken(department.dept_code);
  const nameToken = normalizeDepartmentToken(department.dept_name);

  return codeToken === 'BGDVT' || nameToken === 'BANGIAMDOCVIENTHONG';
};

export const findDepartmentById = (
  departments: Department[],
  departmentId: string | number | null | undefined
): Department | null => {
  const normalizedId = String(departmentId ?? '').trim();
  if (!normalizedId) {
    return null;
  }

  return departments.find((department) => String(department.id) === normalizedId) ?? null;
};

export const findBgdvtRootDepartment = (departments: Department[]): Department | null =>
  departments.find((department) => isBgdvtDepartment(department)) ?? null;

export const collectDepartmentDescendants = (
  departments: Department[],
  rootDepartmentId: string | number
): Department[] => {
  const queue = [String(rootDepartmentId)];
  const descendants: Department[] = [];
  const seen = new Set<string>(queue);

  while (queue.length > 0) {
    const currentParentId = queue.shift();
    if (!currentParentId) {
      continue;
    }

    departments.forEach((department) => {
      const parentId = String(department.parent_id ?? '').trim();
      const departmentId = String(department.id);

      if (parentId !== currentParentId || seen.has(departmentId)) {
        return;
      }

      seen.add(departmentId);
      descendants.push(department);
      queue.push(departmentId);
    });
  }

  return descendants;
};

export interface InternalUserDepartmentScope {
  currentDepartment: Department | null;
  canBrowseSubDepartments: boolean;
  availableDepartments: Department[];
  defaultDepartmentId: string;
}

export const resolveInternalUserDepartmentScope = (
  authUser: AuthUser | null | undefined,
  departments: Department[]
): InternalUserDepartmentScope => {
  const sortedDepartments = sortDepartments(departments || []);
  if (!authUser) {
    return {
      currentDepartment: null,
      canBrowseSubDepartments: true,
      availableDepartments: sortedDepartments,
      defaultDepartmentId: '',
    };
  }

  const currentDepartment = findDepartmentById(sortedDepartments, authUser.department_id);
  const rootDepartment = findBgdvtRootDepartment(sortedDepartments);
  const canBrowseSubDepartments = isAdminUser(authUser) || isBgdvtDepartment(currentDepartment);

  if (canBrowseSubDepartments) {
    const scopedDepartments = rootDepartment
      ? dedupeDepartments([rootDepartment, ...collectDepartmentDescendants(sortedDepartments, rootDepartment.id)])
      : sortedDepartments;

    return {
      currentDepartment,
      canBrowseSubDepartments: true,
      availableDepartments: scopedDepartments,
      defaultDepartmentId: '',
    };
  }

  return {
    currentDepartment,
    canBrowseSubDepartments: false,
    availableDepartments: currentDepartment ? [currentDepartment] : [],
    defaultDepartmentId: currentDepartment ? String(currentDepartment.id) : '',
  };
};
