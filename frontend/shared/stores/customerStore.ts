import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  fetchCustomersPage,
  fetchCustomerPersonnelPage,
  updateCustomer,
} from '../../services/api/customerApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import { useToastStore } from './toastStore';
import type { Customer, CustomerPersonnel, PaginatedQuery, PaginationMeta } from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveCustomerOptions {
  id?: string | number | null;
  data: Partial<Customer>;
}

interface CustomerStoreState {
  // --- state ---
  customers: Customer[];
  customersPageRows: Customer[];
  customersPageMeta: PaginationMeta;
  customerPersonnel: CustomerPersonnel[];
  isCustomersLoading: boolean;
  isCustomersPageLoading: boolean;
  isCustomerPersonnelLoading: boolean;
  isSaving: boolean;
  error: string | null;
  dependencyError: string | null;
  notifier: ToastFn | null;

  // --- actions ---
  setNotifier: (notifier: ToastFn | null) => void;
  loadCustomers: () => Promise<void>;
  loadCustomersPage: (query?: PaginatedQuery) => Promise<void>;
  handleCustomersPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  loadCustomerPersonnel: () => Promise<void>;
  saveCustomer: (options: SaveCustomerOptions) => Promise<Customer | null>;
  deleteCustomer: (customerId: string | number) => Promise<boolean>;
  clearDependencyError: () => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredCustomersQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('customersPage');

export const useCustomerStore = create<CustomerStoreState>((set, get) => ({
  customers: [],
  customersPageRows: [],
  customersPageMeta: DEFAULT_PAGINATION_META,
  customerPersonnel: [],
  isCustomersLoading: false,
  isCustomersPageLoading: false,
  isCustomerPersonnelLoading: false,
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

  loadCustomersPage: async (query) => {
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

  handleCustomersPageQueryChange: async (query) => {
    await get().loadCustomersPage(query);
  },

  loadCustomerPersonnel: async () => {
    set({ isCustomerPersonnelLoading: true, error: null });
    try {
      const result = await fetchCustomerPersonnelPage({ page: 1, per_page: 1000 });
      set({ customerPersonnel: result.data || [] });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách nhân viên khách hàng.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isCustomerPersonnelLoading: false });
    }
  },

  saveCustomer: async (options) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      let savedCustomer: Customer;

      if (id) {
        savedCustomer = await updateCustomer(id, data);
      } else {
        savedCustomer = await createCustomer(data);
      }

      // Cascading refresh: reload both customers and customer personnel
      await Promise.all([get().loadCustomersPage(), get().loadCustomerPersonnel()]);

      const action = id ? 'Cập nhật' : 'Tạo mới';
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', `${action} khách hàng thành công.`);

      return savedCustomer;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể lưu khách hàng.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Lưu thất bại', message);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteCustomer: async (customerId) => {
    set({ isSaving: true, error: null, dependencyError: null });
    try {
      await deleteCustomer(customerId);

      // Remove from local state
      set((state) => ({
        customersPageRows: state.customersPageRows.filter((c) => String(c.id) !== String(customerId)),
        customers: state.customers.filter((c) => String(c.id) !== String(customerId)),
      }));

      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', 'Xóa khách hàng thành công.');
      return true;
    } catch (error) {
      // Handle 409 Conflict (customer has dependent contracts)
      if (error instanceof Response && error.status === 409) {
        const errorData = await error.json();
        const message = errorData.message || 'Khách hàng còn hợp đồng đang hoạt động. Không thể xóa.';
        set({ dependencyError: message });
        const toastFn = get().notifier || useToastStore.getState().addToast;
        toastFn('error', 'Không thể xóa', message);
        return false;
      }

      const message = extractErrorMessage(error, 'Không thể xóa khách hàng.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Xóa thất bại', message);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  clearDependencyError: () => set({ dependencyError: null }),
}));
