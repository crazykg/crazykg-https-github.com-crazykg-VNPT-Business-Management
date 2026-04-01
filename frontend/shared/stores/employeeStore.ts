import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createEmployeeWithProvisioning,
  deleteEmployee,
  fetchEmployees,
  fetchEmployeesPage,
  resetEmployeePassword,
  updateEmployee,
} from '../../services/api/employeeApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import { useToastStore } from './toastStore';
import type {
  Employee,
  EmployeeProvisioning,
  PaginatedQuery,
  PaginationMeta,
} from '../../types';
import { getEmployeeLabel } from '../../utils/employeeDisplay';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveEmployeeOptions {
  id?: string | number | null;
  data: Partial<Employee>;
}

interface EmployeeStoreState {
  employees: Employee[];
  employeesPageRows: Employee[];
  employeesPageMeta: PaginationMeta;
  isEmployeesLoading: boolean;
  isEmployeesPageLoading: boolean;
  isSaving: boolean;
  isPasswordResetting: boolean;
  error: string | null;
  notifier: ToastFn | null;

  // Provisioning state (shown in password dialog after create)
  tempPassword: string | null;
  tempPasswordEmployeeLabel: string | null;

  setNotifier: (notifier: ToastFn | null) => void;
  loadEmployees: () => Promise<void>;
  loadEmployeesPage: (query?: PaginatedQuery) => Promise<void>;
  handleEmployeesPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  saveEmployee: (options: SaveEmployeeOptions) => Promise<Employee | null>;
  deleteEmployee: (employeeId: string | number) => Promise<boolean>;
  resetEmployeePassword: (employeeId: string | number) => Promise<boolean>;
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
  isPasswordResetting: false,
  error: null,
  notifier: null,
  tempPassword: null,
  tempPasswordEmployeeLabel: null,

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
      const message = extractErrorMessage(error, 'Không thể tải danh sách nhân sự.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isEmployeesLoading: false });
    }
  },

  loadEmployeesPage: async (query?: PaginatedQuery) => {
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
      const message = extractErrorMessage(error, 'Không thể tải danh sách nhân sự.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isEmployeesPageLoading: false });
    }
  },

  handleEmployeesPageQueryChange: async (query: PaginatedQuery) => {
    await get().loadEmployeesPage(query);
  },

  saveEmployee: async (options: SaveEmployeeOptions) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      if (id == null) {
        // CREATE with provisioning
        const result = await createEmployeeWithProvisioning(data);
        const saved = result.employee;

        set((state) => ({
          employees: [saved, ...state.employees.filter((e) => String(e.id) !== String(saved.id))],
          employeesPageRows: [saved, ...state.employeesPageRows.filter((e) => String(e.id) !== String(saved.id))],
        }));

        // Show provisioning info if available
        if (result.provisioning?.temporary_password) {
          const label = getEmployeeLabel(saved) || `#${saved.id}`;
          set({
            tempPassword: result.provisioning.temporary_password,
            tempPasswordEmployeeLabel: label,
          });
        }

        get().notifier?.('success', 'Thành công', 'Thêm mới nhân sự thành công!');
      } else {
        // UPDATE (no provisioning)
        const saved = await updateEmployee(id, data);

        set((state) => ({
          employees: state.employees.map((e) => (String(e.id) === String(saved.id) ? saved : e)),
          employeesPageRows: state.employeesPageRows.map((e) => (String(e.id) === String(saved.id) ? saved : e)),
        }));

        get().notifier?.('success', 'Thành công', 'Cập nhật nhân sự thành công!');
      }

      // Reload page to ensure fresh data
      await get().loadEmployeesPage();

      return id == null ? (await get().loadEmployees(), null) : null;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Lưu thất bại', `Không thể lưu nhân sự vào cơ sở dữ liệu. ${message}`);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteEmployee: async (employeeId: string | number) => {
    set({ isSaving: true, error: null });
    try {
      await deleteEmployee(employeeId);

      set((state) => ({
        employees: state.employees.filter((e) => String(e.id) !== String(employeeId)),
        employeesPageRows: state.employeesPageRows.filter((e) => String(e.id) !== String(employeeId)),
      }));

      get().notifier?.('success', 'Thành công', 'Đã xóa nhân sự.');

      // Reload page to update pagination
      await get().loadEmployeesPage();

      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Xóa thất bại', `Không thể xóa nhân sự trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  resetEmployeePassword: async (employeeId: string | number) => {
    set({ isPasswordResetting: true, error: null });
    try {
      const result = await resetEmployeePassword(employeeId);

      // Find the employee to get their label
      const employee = [...get().employees, ...get().employeesPageRows].find(
        (e) => String(e.id) === String(employeeId)
      );

      if (result.provisioning?.temporary_password) {
        const label = employee ? getEmployeeLabel(employee) || `#${employee.id}` : `#${employeeId}`;
        set({
          tempPassword: result.provisioning.temporary_password,
          tempPasswordEmployeeLabel: label,
        });
      }

      get().notifier?.('success', 'Thành công', 'Đặt lại mật khẩu thành công!');
      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Đặt lại thất bại', `Không thể đặt lại mật khẩu. ${message}`);
      return false;
    } finally {
      set({ isPasswordResetting: false });
    }
  },

  clearTempPassword: () => set({ tempPassword: null, tempPasswordEmployeeLabel: null }),
}));
