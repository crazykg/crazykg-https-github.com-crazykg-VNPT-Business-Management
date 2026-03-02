import { AuthUser, ModalType } from '../types';

const TAB_PERMISSION_MAP: Record<string, string | null> = {
  dashboard: 'dashboard.view',
  internal_user_dashboard: 'employees.read',
  internal_user_list: 'employees.read',
  departments: 'departments.read',
  user_dept_history: 'user_dept_history.read',
  businesses: 'businesses.read',
  vendors: 'vendors.read',
  products: 'products.read',
  clients: 'customers.read',
  cus_personnel: 'customer_personnel.read',
  opportunities: 'opportunities.read',
  projects: 'projects.read',
  contracts: 'contracts.read',
  documents: 'documents.read',
  reminders: 'reminders.read',
  support_requests: 'support_requests.read',
  support_master_management: 'support_requests.read',
  programming_requests: 'support_requests.read',
  audit_logs: 'audit_logs.read',
  integration_settings: 'authz.manage',
  access_control: 'authz.manage',
};

const MODAL_PERMISSION_MAP: Partial<Record<Exclude<ModalType, null>, string | null>> = {
  ADD_DEPARTMENT: 'departments.write',
  EDIT_DEPARTMENT: 'departments.write',
  DELETE_DEPARTMENT: 'departments.delete',
  ADD_EMPLOYEE: 'employees.write',
  EDIT_EMPLOYEE: 'employees.write',
  DELETE_EMPLOYEE: 'employees.delete',
  ADD_BUSINESS: 'businesses.write',
  EDIT_BUSINESS: 'businesses.write',
  DELETE_BUSINESS: 'businesses.delete',
  ADD_VENDOR: 'vendors.write',
  EDIT_VENDOR: 'vendors.write',
  DELETE_VENDOR: 'vendors.delete',
  ADD_PRODUCT: 'products.write',
  EDIT_PRODUCT: 'products.write',
  DELETE_PRODUCT: 'products.delete',
  ADD_CUSTOMER: 'customers.write',
  EDIT_CUSTOMER: 'customers.write',
  DELETE_CUSTOMER: 'customers.delete',
  ADD_CUS_PERSONNEL: 'customer_personnel.write',
  EDIT_CUS_PERSONNEL: 'customer_personnel.write',
  DELETE_CUS_PERSONNEL: 'customer_personnel.delete',
  ADD_OPPORTUNITY: 'opportunities.write',
  EDIT_OPPORTUNITY: 'opportunities.write',
  DELETE_OPPORTUNITY: 'opportunities.delete',
  ADD_PROJECT: 'projects.write',
  EDIT_PROJECT: 'projects.write',
  DELETE_PROJECT: 'projects.delete',
  ADD_CONTRACT: 'contracts.write',
  EDIT_CONTRACT: 'contracts.write',
  DELETE_CONTRACT: 'contracts.delete',
  ADD_DOCUMENT: 'documents.write',
  EDIT_DOCUMENT: 'documents.write',
  UPLOAD_PRODUCT_DOCUMENT: 'documents.write',
  DELETE_DOCUMENT: 'documents.delete',
  ADD_REMINDER: 'reminders.write',
  EDIT_REMINDER: 'reminders.write',
  DELETE_REMINDER: 'reminders.delete',
  ADD_USER_DEPT_HISTORY: 'user_dept_history.write',
  EDIT_USER_DEPT_HISTORY: 'user_dept_history.write',
  DELETE_USER_DEPT_HISTORY: 'user_dept_history.delete',
};

const IMPORT_PERMISSION_BY_MODULE: Record<string, string | null> = {
  departments: 'departments.import',
  internal_user_list: 'employees.import',
  businesses: 'businesses.import',
  vendors: 'vendors.import',
  products: 'products.import',
  clients: 'customers.import',
  opportunities: 'opportunities.import',
  projects: 'projects.import',
  contracts: 'contracts.import',
  support_requests: 'support_requests.import',
  programming_requests: 'support_requests.import',
};

export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
  if (!permission) {
    return true;
  }
  if (!user) {
    return false;
  }

  const roles = (user.roles || []).map((role) => String(role).toUpperCase());
  if (roles.includes('ADMIN')) {
    return true;
  }

  const permissions = new Set((user.permissions || []).map((perm) => String(perm).trim()));
  if (permissions.has('*')) {
    return true;
  }

  return permissions.has(permission);
};

export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  return hasPermission(user, TAB_PERMISSION_MAP[tabId] ?? null);
};

export const resolveImportPermission = (moduleKey: string): string | null => {
  return IMPORT_PERMISSION_BY_MODULE[moduleKey] ?? null;
};

export const canOpenModal = (
  user: AuthUser | null,
  modalType: ModalType,
  activeModuleKey: string
): boolean => {
  if (!modalType) {
    return true;
  }

  if (modalType === 'IMPORT_DATA') {
    return hasPermission(user, resolveImportPermission(activeModuleKey));
  }

  return hasPermission(user, MODAL_PERMISSION_MAP[modalType] ?? null);
};
