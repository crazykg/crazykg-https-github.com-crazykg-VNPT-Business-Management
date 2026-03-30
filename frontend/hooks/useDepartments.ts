import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
} from '../services/api/departmentApi';
import { queryKeys } from '../shared/queryKeys';
import type { Department } from '../types/department';

interface UseDepartmentsOptions {
  enabled?: boolean;
}

interface UseDepartmentsReturn {
  departments: Department[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  loadDepartments: () => Promise<void>;
  setDepartments: Dispatch<SetStateAction<Department[]>>;
  handleSaveDepartment: (
    data: Partial<Department>,
    modalType: 'ADD_DEPARTMENT' | 'EDIT_DEPARTMENT',
    selectedDept: Department | null
  ) => Promise<boolean>;
  handleDeleteDepartment: (selectedDept: Department) => Promise<boolean>;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

export function useDepartments(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseDepartmentsOptions = {},
): UseDepartmentsReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments.all,
    queryFn: fetchDepartments,
    enabled,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: createDepartment,
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Department> }) =>
      updateDepartment(id, payload),
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: string | number) => deleteDepartment(id),
  });

  const loadDepartments = useCallback(async () => {
    setError(null);
    try {
      await departmentsQuery.refetch();
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách phòng ban.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, departmentsQuery]);

  const setDepartments: Dispatch<SetStateAction<Department[]>> = useCallback((value) => {
    queryClient.setQueryData<Department[]>(queryKeys.departments.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const handleSaveDepartment = useCallback(async (
    data: Partial<Department>,
    modalType: 'ADD_DEPARTMENT' | 'EDIT_DEPARTMENT',
    selectedDept: Department | null
  ): Promise<boolean> => {
    setError(null);
    try {
      if (modalType === 'ADD_DEPARTMENT') {
        const created = await createDepartmentMutation.mutateAsync(data);
        queryClient.setQueryData<Department[]>(queryKeys.departments.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        addToast?.('success', 'Thành công', 'Thêm mới phòng ban thành công!');
        return true;
      }

      if (modalType === 'EDIT_DEPARTMENT' && selectedDept) {
        const updated = await updateDepartmentMutation.mutateAsync({ id: selectedDept.id, payload: data });
        queryClient.setQueryData<Department[]>(queryKeys.departments.all, (prev = []) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật phòng ban thành công!');
        return true;
      }

      return false;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu phòng ban vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createDepartmentMutation, queryClient, updateDepartmentMutation]);

  const handleDeleteDepartment = useCallback(async (selectedDept: Department): Promise<boolean> => {
    setError(null);
    try {
      await deleteDepartmentMutation.mutateAsync(selectedDept.id);
      queryClient.setQueryData<Department[]>(queryKeys.departments.all, (prev = []) =>
        prev.filter((item) => String(item.id) !== String(selectedDept.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa phòng ban khỏi hệ thống.');
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa phòng ban trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteDepartmentMutation, queryClient]);

  return {
    departments: departmentsQuery.data ?? [],
    isSaving:
      createDepartmentMutation.isPending
      || updateDepartmentMutation.isPending
      || deleteDepartmentMutation.isPending,
    isLoading: departmentsQuery.isLoading || departmentsQuery.isFetching,
    error: error || (departmentsQuery.error instanceof Error ? departmentsQuery.error.message : null),
    loadDepartments,
    setDepartments,
    handleSaveDepartment,
    handleDeleteDepartment,
  };
}
