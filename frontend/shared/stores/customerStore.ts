import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  fetchCustomersPage,
  type createCustomerPersonnel,
  updateCustomer,
} from '../../services/api/customerApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import type {
  Customer,
  PaginatedQuery,
  PaginationMeta,
} from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveCustomerOptions {
  id?: string | number | null;
  data: Partial<Customer>;
}

interface CustomerStoreState {
  customers: Customer[];
  customersPageRows: Customer[];
  customersPageMeta: PaginationMeta;
  isCustomersLoading: boolean;
  isCustomersPageLoading: boolean;
  isSaving: boolean;
  error: string | null;
  dependencyError: string | null;
  notifier: ToastFn | null;

  setNotifier: (notifier: ToastFn | null) => void;
  loadCustomers: () => Promise<void>;
  loadCustomersPage: (query?: PaginatedQuery) => Promise<void>;
  handleCustomersPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  saveCustomer: (options: SaveCustomerOptions) => Promise<Customer | null>;
  deleteCustomer: (customerId: string | number) => Promise<boolean>;
  clearDependencyError: () => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredCustomersQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('customersPage');

/**
 * Detect if error is a customer dependency error (customer has contracts).
 * API returns 422 Unprocessable Entity when customer still has linked contracts.
 */
const isCustomerDeleteDependencyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const status = Number((error as { status?: number }).status);
  return status === 422 || status === 409;
};

export const useCustomerStore = create<CustomerStoreState>((set, get) => ({
  customers: [],
  customersPageRows: [],
  customersPageMeta: DEFAULT_PAGINATION_META,
  isCustomersLoading: false,
  isCustomersPageLoading: false,
  isSaving: false,
  error: null,
  dependencyError: null,
  notifier: null,

  setNotifier: (notifier) => set({ notifier }),

  loadCustomers: async () => {
    set({ isCustomersLoading: true, error: null });
    try {
      const customers = await fetchCustomers();
      set({ customers });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách khách hàng.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isCustomersLoading: false });
    }
  },

  loadCustomersPage: async (query?: PaginatedQuery) => {
    const nextQuery = query ?? getStoredCustomersQuery();
    useFilterStore.getState().replaceTabFilter('customersPage', nextQuery);
    set({ isCustomersPageLoading: true, error: null });
    try {
      const result = await fetchCustomersPage(nextQuery);
      set({
        customersPageRows: result.data || [],
        customersPageMeta: result.meta || DEFAULT_PAGINATION_META,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách khách hàng.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isCustomersPageLoading: false });
    }
  },

  handleCustomersPageQueryChange: async (query: PaginatedQuery) => {
    await get().loadCustomersPage(query);
  },

  saveCustomer: async (options: SaveCustomerOptions) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      const saved = id == null
        ? await createCustomer(data)
        : await updateCustomer(id, data);

      set((state) => ({
        customers: id == null
          ? [saved, ...state.customers.filter((c) => String(c.id) !== String(saved.id))]
          : state.customers.map((c) => (String(c.id) === String(saved.id) ? saved : c)),
        customersPageRows: id == null
          ? [saved, ...state.customersPageRows.filter((c) => String(c.id) !== String(saved.id))]
          : state.customersPageRows.map((c) => (String(c.id) === String(saved.id) ? saved : c)),
      }));

      const action = id == null ? 'Thêm mới' : 'Cập nhật';
      get().notifier?.('success', 'Thành công', `${action} khách hàng thành công!`);

      // Reload page to ensure fresh data
      await get().loadCustomersPage();

      return saved;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Lưu thất bại', `Không thể lưu khách hàng vào cơ sở dữ liệu. ${message}`);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteCustomer: async (customerId: string | number) => {
    set({ isSaving: true, error: null, dependencyError: null });
    try {
      await deleteCustomer(customerId);

      set((state) => ({
        customers: state.customers.filter((c) => String(c.id) !== String(customerId)),
        customersPageRows: state.customersPageRows.filter((c) => String(c.id) !== String(customerId)),
      }));

      get().notifier?.('success', 'Thành công', 'Đã xóa khách hàng.');

      // Reload page to update pagination
      await get().loadCustomersPage();

      return true;
    } catch (error) {
      if (isCustomerDeleteDependencyError(error)) {
        const depErrorMsg = 'Không thể xóa khách hàng. Khách hàng vẫn còn hợp đồng liên kết.';
        set({ dependencyError: depErrorMsg });
        get().notifier?.('error', 'Xóa thất bại', depErrorMsg);
        return false;
      }

      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Xóa thất bại', `Không thể xóa khách hàng trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  clearDependencyError: () => set({ dependencyError: null }),
}));
