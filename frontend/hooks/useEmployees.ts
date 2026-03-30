import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEmployeeWithProvisioning,
  deleteEmployee,
  fetchEmployees,
  fetchEmployeesPage,
  resetEmployeePassword,
  updateEmployee,
} from '../services/api/employeeApi';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { queryKeys } from '../shared/queryKeys';
import type { PaginatedQuery, PaginationMeta } from '../types';
import type { Employee } from '../types/employee';
import { getEmployeeLabel } from '../utils/employeeDisplay';

interface EmployeeProvisioningInfo {
  employeeLabel: string;
  provisioning: { temporary_password: string };
}

interface UseEmployeesOptions {
  enabled?: boolean;
}

interface UseEmployeesReturn {
  employees: Employee[];
  employeesPageRows: Employee[];
  employeesPageMeta: PaginationMeta;
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  isPasswordResetting: boolean;
  error: string | null;
  employeeProvisioning: EmployeeProvisioningInfo | null;
  loadEmployees: () => Promise<void>;
  loadEmployeesPage: (query?: PaginatedQuery) => Promise<void>;
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  handleSaveEmployee: (data: Partial<Employee>, modalType: 'ADD_EMPLOYEE' | 'EDIT_EMPLOYEE', selectedEmployee: Employee | null) => Promise<boolean>;
  handleDeleteEmployee: (selectedEmployee: Employee) => Promise<boolean>;
  handleResetEmployeePassword: (selectedEmployee: Employee) => Promise<boolean>;
  setEmployeesPageRows: (rows: Employee[]) => void;
  setEmployeesPageMeta: (meta: PaginationMeta) => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

export function useEmployees(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseEmployeesOptions = {},
): UseEmployeesReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeProvisioning, setEmployeeProvisioning] = useState<EmployeeProvisioningInfo | null>(null);

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees.all,
    queryFn: fetchEmployees,
    enabled,
  });

  const createEmployeeMutation = useMutation({
    mutationFn: createEmployeeWithProvisioning,
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Employee> }) =>
      updateEmployee(id, payload),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: string | number) => deleteEmployee(id),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string | number) => resetEmployeePassword(id),
  });

  const loadEmployees = useCallback(async () => {
    setError(null);
    try {
      await employeesQuery.refetch();
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách nhân sự.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, employeesQuery]);

  const setEmployees: Dispatch<SetStateAction<Employee[]>> = useCallback((value) => {
    queryClient.setQueryData<Employee[]>(queryKeys.employees.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const loadEmployeesPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchEmployeesPage(query);
      setEmployeesPageRows(result.data || []);
      setEmployeesPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách nhân sự.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const handleSaveEmployee = useCallback(async (
    data: Partial<Employee>,
    modalType: 'ADD_EMPLOYEE' | 'EDIT_EMPLOYEE',
    selectedEmployee: Employee | null
  ): Promise<boolean> => {
    setError(null);
    try {
      if (modalType === 'ADD_EMPLOYEE') {
        const result = await createEmployeeMutation.mutateAsync(data);
        const created = result.employee;
        queryClient.setQueryData<Employee[]>(queryKeys.employees.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        if (result.provisioning?.temporary_password) {
          setEmployeeProvisioning({
            employeeLabel: getEmployeeLabel(created) || `#${created.id}`,
            provisioning: result.provisioning,
          });
        }
        addToast?.('success', 'Thành công', 'Thêm mới nhân sự thành công!');
      } else if (modalType === 'EDIT_EMPLOYEE' && selectedEmployee) {
        const updated = await updateEmployeeMutation.mutateAsync({ id: selectedEmployee.id, payload: data });
        queryClient.setQueryData<Employee[]>(queryKeys.employees.all, (prev = []) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật thông tin nhân sự thành công!');
      }

      void loadEmployeesPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu nhân sự vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createEmployeeMutation, loadEmployeesPage, queryClient, updateEmployeeMutation]);

  const handleDeleteEmployee = useCallback(async (selectedEmployee: Employee): Promise<boolean> => {
    setError(null);
    try {
      await deleteEmployeeMutation.mutateAsync(selectedEmployee.id);
      queryClient.setQueryData<Employee[]>(queryKeys.employees.all, (prev = []) =>
        prev.filter((item) => String(item.id) !== String(selectedEmployee.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa nhân sự thành công.');
      void loadEmployeesPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa nhân sự trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteEmployeeMutation, loadEmployeesPage, queryClient]);

  const handleResetEmployeePassword = useCallback(async (selectedEmployee: Employee): Promise<boolean> => {
    setError(null);
    try {
      const result = await resetPasswordMutation.mutateAsync(selectedEmployee.id);
      const updatedEmployee = result.employee;

      queryClient.setQueryData<Employee[]>(queryKeys.employees.all, (prev = []) =>
        prev.map((item) => (String(item.id) === String(updatedEmployee.id) ? updatedEmployee : item))
      );

      if (result.provisioning?.temporary_password) {
        setEmployeeProvisioning({
          employeeLabel: getEmployeeLabel(updatedEmployee) || `#${updatedEmployee.id}`,
          provisioning: result.provisioning,
        });
      }

      addToast?.('success', 'Bảo mật tài khoản', 'Đã reset mật khẩu tạm thời cho nhân sự.');
      void loadEmployeesPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Reset mật khẩu thất bại', message);
      return false;
    }
  }, [addToast, loadEmployeesPage, queryClient, resetPasswordMutation]);

  return {
    employees: employeesQuery.data ?? [],
    employeesPageRows,
    employeesPageMeta,
    isSaving: createEmployeeMutation.isPending || updateEmployeeMutation.isPending || deleteEmployeeMutation.isPending,
    isLoading: employeesQuery.isLoading || employeesQuery.isFetching,
    isPageLoading,
    isPasswordResetting: resetPasswordMutation.isPending,
    error: error || (employeesQuery.error instanceof Error ? employeesQuery.error.message : null),
    employeeProvisioning,
    loadEmployees,
    loadEmployeesPage,
    setEmployees,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleResetEmployeePassword,
    setEmployeesPageRows,
    setEmployeesPageMeta,
  };
}
