import { useState, useCallback } from 'react';
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../services/v5Api';
import type { Department } from '../types';

interface UseDepartmentsReturn {
  departments: Department[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  loadDepartments: () => Promise<void>;
  handleSaveDepartment: (data: Partial<Department>, modalType: 'ADD_DEPARTMENT' | 'EDIT_DEPARTMENT', selectedDept: Department | null) => Promise<boolean>;
  handleDeleteDepartment: (selectedDept: Department) => Promise<boolean>;
}

export function useDepartments(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseDepartmentsReturn {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchDepartments();
      setDepartments(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách phòng ban.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const handleSaveDepartment = useCallback(async (
    data: Partial<Department>,
    modalType: 'ADD_DEPARTMENT' | 'EDIT_DEPARTMENT',
    selectedDept: Department | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      if (modalType === 'ADD_DEPARTMENT') {
        const created = await createDepartment(data);
        setDepartments((prev) => [created, ...prev]);
        addToast?.('success', 'Thành công', 'Thêm mới phòng ban thành công!');
      } else if (modalType === 'EDIT_DEPARTMENT' && selectedDept) {
        const updated = await updateDepartment(selectedDept.id, data);
        setDepartments((prev) =>
          prev.map((d) => (String(d.id) === String(updated.id) ? updated : d))
        );
        addToast?.('success', 'Thành công', 'Cập nhật phòng ban thành công!');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu phòng ban vào cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  const handleDeleteDepartment = useCallback(async (selectedDept: Department): Promise<boolean> => {
    setError(null);
    try {
      await deleteDepartment(selectedDept.id);
      setDepartments((prev) => prev.filter((d) => String(d.id) !== String(selectedDept.id)));
      addToast?.('success', 'Thành công', 'Đã xóa phòng ban khỏi hệ thống.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa phòng ban trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast]);

  return {
    departments,
    isSaving,
    isLoading,
    error,
    loadDepartments,
    handleSaveDepartment,
    handleDeleteDepartment,
  };
}