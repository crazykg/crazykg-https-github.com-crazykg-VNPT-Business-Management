import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createEmployeeWithProvisioning,
  deleteEmployee,
  fetchEmployees,
  fetchEmployeesPage,
  updateEmployee,
} from '../../services/api/employeeApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import { useToastStore } from './toastStore';
import type { Employee, EmployeeSaveResult, PaginatedQuery, PaginationMeta } from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveEmployeeOptions {
  id?: string | number | null;
  data: Partial<Employee>;
}

interface EmployeeStoreState {
  // --- state ---
  employees: Employee[];
  employeesPageRows: Employee[];
  employeesPageMeta: PaginationMeta;
  isEmployeesLoading: boolean;
  isEmployeesPageLoading: boolean;
  isSaving: boolean;
  error: string | null;
  tempPassword: string | null;
  notifier: ToastFn | null;

  // --- actions ---
  setNotifier: (notifier: ToastFn | null) => void;
  loadEmployees: () => Promise<void>;
  loadEmployeesPage: (query?: PaginatedQuery) => Promise<void>;
  handleEmployeesPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  saveEmployee: (options: SaveEmployeeOptions, isCreating?: boolean) => Promise<Employee | null>;
  deleteEmployee: (employeeId: string | number) => Promise<boolean>;
  clearTempPassword: () => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredEmployeesQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('employeesPage');

export const useEmployeeStore = create<EmployeeStoreState>((set, get) => ({
  employees: [],
  employeesPageRows: [],
  employeesPageMeta: DEFAULT_PAGINATION_META,
  isEmployeesLoading: false,
  isEmployeesPageLoading: false,
  isSaving: false,
  error: null,
  tempPassword: null,
  notifier: null,

  setNotifier: (notifier) => set({ notifier }),

  loadEmployees: async () => {
    set({ isEmployeesLoading: true, error: null });
    try {
      const employees = await fetchEmployees();
      set({ employees });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách nhân viên.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isEmployeesLoading: false });
    }
  },

  loadEmployeesPage: async (query) => {
    const nextQuery = query ?? getStoredEmployeesQuery();
    useFilterStore.getState().replaceTabFilter('employeesPage', nextQuery);
    set({ isEmployeesPageLoading: true, error: null });
    try {
      const result = await fetchEmployeesPage(nextQuery);
      set({
        employeesPageRows: result.data || [],
        employeesPageMeta: result.meta || DEFAULT_PAGINATION_META,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách nhân viên.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isEmployeesPageLoading: false });
    }
  },

  handleEmployeesPageQueryChange: async (query) => {
    await get().loadEmployeesPage(query);
  },

  saveEmployee: async (options, isCreating = false) => {
    const { id, data } = options;
    set({ isSaving: true, error: null, tempPassword: null });
    try {
      let savedEmployee: Employee;

      if (id) {
        savedEmployee = await updateEmployee(id, data);
      } else {
        // CREATE — use provisioning API to get temp password
        const result = (await createEmployeeWithProvisioning(data)) as EmployeeSaveResult;
        savedEmployee = result.employee;

        // Store temp password for display in dialog
        if (result.provisioning?.temporary_password) {
          set({ tempPassword: result.provisioning.temporary_password });
        }
      }

      // Refresh employees list
      await get().loadEmployeesPage();

      const action = id ? 'Cập nhật' : 'Tạo mới';
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', `${action} nhân viên thành công.`);

      return savedEmployee;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể lưu nhân viên.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Lưu thất bại', message);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteEmployee: async (employeeId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteEmployee(employeeId);

      // Remove from local state
      set((state) => ({
        employeesPageRows: state.employeesPageRows.filter((e) => String(e.id) !== String(employeeId)),
        employees: state.employees.filter((e) => String(e.id) !== String(employeeId)),
      }));

      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', 'Xóa nhân viên thành công.');
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể xóa nhân viên.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Xóa thất bại', message);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  clearTempPassword: () => set({ tempPassword: null }),
}));
