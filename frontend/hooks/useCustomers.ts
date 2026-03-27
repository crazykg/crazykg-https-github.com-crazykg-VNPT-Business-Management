import { useState, useCallback } from 'react';
import {
  fetchCustomers,
  fetchCustomersPage,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  DEFAULT_PAGINATION_META,
} from '../services/v5Api';
import type { Customer, PaginatedQuery, PaginationMeta } from '../types';

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
  handleSaveCustomer: (data: Partial<Customer>, modalType: 'ADD_CUSTOMER' | 'EDIT_CUSTOMER', selectedCustomer: Customer | null) => Promise<boolean>;
  handleDeleteCustomer: (selectedCustomer: Customer) => Promise<boolean>;
  setCustomersPageRows: (rows: Customer[]) => void;
  setCustomersPageMeta: (meta: PaginationMeta) => void;
}

export function useCustomers(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersPageRows, setCustomersPageRows] = useState<Customer[]>([]);
  const [customersPageMeta, setCustomersPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchCustomers();
      setCustomers(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách khách hàng.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadCustomersPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchCustomersPage(query);
      setCustomersPageRows(result.data || []);
      setCustomersPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách khách hàng.';
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
    setIsSaving(true);
    setError(null);
    try {
      if (modalType === 'ADD_CUSTOMER') {
        const created = await createCustomer(data);
        setCustomers((previous) => [created, ...(previous || [])]);
        addToast?.('success', 'Thành công', 'Thêm mới khách hàng thành công!');
      } else if (modalType === 'EDIT_CUSTOMER' && selectedCustomer) {
        const updated = await updateCustomer(selectedCustomer.id, data);
        setCustomers((previous) =>
          previous.map((c) =>
            String(c.id) === String(updated.id) ? updated : c
          )
        );
        addToast?.('success', 'Thành công', 'Cập nhật khách hàng thành công!');
      }
      void loadCustomersPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu khách hàng vào cơ sở dữ liệu. ${message}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadCustomersPage]);

  const handleDeleteCustomer = useCallback(async (selectedCustomer: Customer): Promise<boolean> => {
    setError(null);
    try {
      await deleteCustomer(selectedCustomer.id);
      setCustomers((previous) => previous.filter((c) => String(c.id) !== String(selectedCustomer.id)));
      addToast?.('success', 'Thành công', 'Đã xóa khách hàng.');
      void loadCustomersPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      
      // Check for dependency error (422 status)
      if (isCustomerDeleteDependencyError(err)) {
        return false; // Return false to indicate modal should show dependency warning
      }
      
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa khách hàng trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, loadCustomersPage]);

  return {
    customers,
    customersPageRows,
    customersPageMeta,
    isSaving,
    isLoading,
    isPageLoading,
    error,
    loadCustomers,
    loadCustomersPage,
    handleSaveCustomer,
    handleDeleteCustomer,
    setCustomersPageRows,
    setCustomersPageMeta,
  };
}

/**
 * Checks if the error is a customer delete dependency error.
 * This happens when the customer has related records (422 status).
 */
function isCustomerDeleteDependencyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return Number((error as { status?: number }).status) === 422;
}