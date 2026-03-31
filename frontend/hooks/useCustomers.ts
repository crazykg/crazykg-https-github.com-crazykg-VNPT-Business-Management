import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import {
  fetchCustomers,
  fetchCustomersPage,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../services/api/customerApi';
import { queryKeys } from '../shared/queryKeys';
import type { Customer } from '../types/customer';
import type { PaginatedQuery, PaginationMeta } from '../types/common';

interface UseCustomersOptions {
  enabled?: boolean;
}

interface UseCustomersReturn {
  customers: Customer[];
  customersPageRows: Customer[];
  customersPageMeta: PaginationMeta;
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  error: string | null;
  loadCustomers: () => Promise<void>;
  loadCustomersPage: (query?: PaginatedQuery) => Promise<void>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  handleSaveCustomer: (data: Partial<Customer>, modalType: 'ADD_CUSTOMER' | 'EDIT_CUSTOMER', selectedCustomer: Customer | null) => Promise<boolean>;
  handleDeleteCustomer: (selectedCustomer: Customer) => Promise<boolean>;
  setCustomersPageRows: (rows: Customer[]) => void;
  setCustomersPageMeta: (meta: PaginationMeta) => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

export function useCustomers(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseCustomersOptions = {},
): UseCustomersReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.all,
    queryFn: fetchCustomers,
    enabled,
  });
  const { refetch: refetchCustomers } = customersQuery;

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Customer> }) =>
      updateCustomer(id, payload),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string | number) => deleteCustomer(id),
  });

  const loadCustomers = useCallback(async () => {
    setError(null);
    try {
      await refetchCustomers();
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách khách hàng.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, refetchCustomers]);

  const setCustomers: Dispatch<SetStateAction<Customer[]>> = useCallback((value) => {
    queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const loadCustomersPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchCustomersPage(query ?? {});
      setCustomersPageRows(result.data || []);
      setCustomersPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách khách hàng.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const handleSaveCustomer = useCallback(async (
    data: Partial<Customer>,
    modalType: 'ADD_CUSTOMER' | 'EDIT_CUSTOMER',
    selectedCustomer: Customer | null
  ): Promise<boolean> => {
    setError(null);
    try {
      if (modalType === 'ADD_CUSTOMER') {
        const created = await createCustomerMutation.mutateAsync(data);
        queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        addToast?.('success', 'Thành công', 'Thêm mới khách hàng thành công!');
      } else if (modalType === 'EDIT_CUSTOMER' && selectedCustomer) {
        const updated = await updateCustomerMutation.mutateAsync({ id: selectedCustomer.id, payload: data });
        queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev = []) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật khách hàng thành công!');
      }
      void loadCustomersPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu khách hàng vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createCustomerMutation, loadCustomersPage, queryClient, updateCustomerMutation]);

  const handleDeleteCustomer = useCallback(async (selectedCustomer: Customer): Promise<boolean> => {
    setError(null);
    try {
      await deleteCustomerMutation.mutateAsync(selectedCustomer.id);
      queryClient.setQueryData<Customer[]>(queryKeys.customers.all, (prev = []) =>
        prev.filter((item) => String(item.id) !== String(selectedCustomer.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa khách hàng.');
      void loadCustomersPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');

      if (isCustomerDeleteDependencyError(err)) {
        return false;
      }

      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa khách hàng trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteCustomerMutation, loadCustomersPage, queryClient]);

  return {
    customers: customersQuery.data ?? [],
    customersPageRows,
    customersPageMeta,
    isSaving:
      createCustomerMutation.isPending
      || updateCustomerMutation.isPending
      || deleteCustomerMutation.isPending,
    isLoading: customersQuery.isLoading || customersQuery.isFetching,
    isPageLoading,
    error: error || (customersQuery.error instanceof Error ? customersQuery.error.message : null),
    loadCustomers,
    loadCustomersPage,
    setCustomers,
    handleSaveCustomer,
    handleDeleteCustomer,
    setCustomersPageRows,
    setCustomersPageMeta,
  };
}

function isCustomerDeleteDependencyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return Number((error as { status?: number }).status) === 422;
}
