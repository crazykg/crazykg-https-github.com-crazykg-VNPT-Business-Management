import { useState, useCallback } from 'react';
import {
  fetchCustomerPersonnel,
  createCustomerPersonnel,
  updateCustomerPersonnel,
  deleteCustomerPersonnel,
} from '../services/api/customerApi';
import type { CustomerPersonnel } from '../types/customer';
import { normalizeImportDate } from '../utils/importUtils';

interface UseCustomerPersonnelReturn {
  customerPersonnel: CustomerPersonnel[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  loadCustomerPersonnel: () => Promise<void>;
  handleSaveCusPersonnel: (data: Partial<CustomerPersonnel>, modalType: 'ADD_CUS_PERSONNEL' | 'EDIT_CUS_PERSONNEL', selectedCusPersonnel: CustomerPersonnel | null) => Promise<boolean>;
  handleDeleteCusPersonnel: (selectedCusPersonnel: CustomerPersonnel) => Promise<boolean>;
  setCustomerPersonnel: (personnel: CustomerPersonnel[]) => void;
}

export function useCustomerPersonnel(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseCustomerPersonnelReturn {
  const [customerPersonnel, setCustomerPersonnel] = useState<CustomerPersonnel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeCustomerPersonnelRows = useCallback((rows: CustomerPersonnel[]): CustomerPersonnel[] => (
    (rows || []).map((item) => ({
      ...item,
      birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
    }))
  ), []);

  const refreshCustomerPersonnel = useCallback(async () => {
    const rows = await fetchCustomerPersonnel();
    setCustomerPersonnel(normalizeCustomerPersonnelRows(rows || []));
  }, [normalizeCustomerPersonnelRows]);

  const loadCustomerPersonnel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await refreshCustomerPersonnel();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách nhân sự liên hệ.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, refreshCustomerPersonnel]);

  const handleSaveCusPersonnel = useCallback(async (
    data: Partial<CustomerPersonnel>,
    modalType: 'ADD_CUS_PERSONNEL' | 'EDIT_CUS_PERSONNEL',
    selectedCusPersonnel: CustomerPersonnel | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const normalizedBirthday = normalizeImportDate(String(data.birthday || '')) || String(data.birthday || '').trim();
      const payload: Partial<CustomerPersonnel> = {
        ...data,
        birthday: normalizedBirthday,
      };

      if (modalType === 'ADD_CUS_PERSONNEL') {
        const created = await createCustomerPersonnel(payload);
        setCustomerPersonnel((previous) => [created, ...(previous || [])]);
        addToast?.('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công!');
      } else if (modalType === 'EDIT_CUS_PERSONNEL' && selectedCusPersonnel) {
        const updated = await updateCustomerPersonnel(selectedCusPersonnel.id, payload);
        setCustomerPersonnel((previous) =>
          previous.map((p) => (p.id === selectedCusPersonnel.id ? updated : p))
        );
        addToast?.('success', 'Thành công', 'Cập nhật nhân sự liên hệ thành công!');
      }

      await refreshCustomerPersonnel();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu nhân sự liên hệ vào cơ sở dữ liệu. ${message}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, refreshCustomerPersonnel]);

  const handleDeleteCusPersonnel = useCallback(async (selectedCusPersonnel: CustomerPersonnel): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteCustomerPersonnel(selectedCusPersonnel.id);
      setCustomerPersonnel((prev) => prev.filter((p) => p.id !== selectedCusPersonnel.id));
      addToast?.('success', 'Thành công', 'Đã xóa nhân sự liên hệ.');
      
      await refreshCustomerPersonnel();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa nhân sự liên hệ trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, refreshCustomerPersonnel]);

  return {
    customerPersonnel,
    isSaving,
    isLoading,
    error,
    loadCustomerPersonnel,
    handleSaveCusPersonnel,
    handleDeleteCusPersonnel,
    setCustomerPersonnel,
  };
}
