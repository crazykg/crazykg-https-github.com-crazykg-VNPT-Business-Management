import { useState, useCallback } from 'react';
import {
  fetchEmployees,
  fetchEmployeesPage,
  createEmployeeWithProvisioning,
  updateEmployee,
  deleteEmployee,
  resetEmployeePassword,
  DEFAULT_PAGINATION_META,
} from '../services/v5Api';
import type { Employee, PaginatedQuery, PaginationMeta } from '../types';
import { getEmployeeLabel } from '../utils/employeeDisplay';

interface EmployeeProvisioningInfo {
  employeeLabel: string;
  provisioning: { temporary_password: string };
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
  handleSaveEmployee: (data: Partial<Employee>, modalType: 'ADD_EMPLOYEE' | 'EDIT_EMPLOYEE', selectedEmployee: Employee | null) => Promise<boolean>;
  handleDeleteEmployee: (selectedEmployee: Employee) => Promise<boolean>;
  handleResetEmployeePassword: (selectedEmployee: Employee) => Promise<boolean>;
  setEmployeesPageRows: (rows: Employee[]) => void;
  setEmployeesPageMeta: (meta: PaginationMeta) => void;
}

export function useEmployees(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseEmployeesReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesPageRows, setEmployeesPageRows] = useState<Employee[]>([]);
  const [employeesPageMeta, setEmployeesPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeProvisioning, setEmployeeProvisioning] = useState<EmployeeProvisioningInfo | null>(null);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchEmployees();
      setEmployees(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách nhân sự.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadEmployeesPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchEmployeesPage(query);
      setEmployeesPageRows(result.data || []);
      setEmployeesPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách nhân sự.';
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
    setIsSaving(true);
    setError(null);
    try {
      if (modalType === 'ADD_EMPLOYEE') {
        const result = await createEmployeeWithProvisioning(data);
        const created = result.employee;
        setEmployees((prev) => [created, ...prev]);
        if (result.provisioning?.temporary_password) {
          setEmployeeProvisioning({
            employeeLabel: getEmployeeLabel(created) || `#${created.id}`,
            provisioning: result.provisioning,
          });
        }
        addToast?.('success', 'Thành công', 'Thêm mới nhân sự thành công!');
      } else if (modalType === 'EDIT_EMPLOYEE' && selectedEmployee) {
        const updated = await updateEmployee(selectedEmployee.id, data);
        setEmployees((prev) =>
          prev.map((e) => (String(e.id) === String(updated.id) ? updated : e))
        );
        addToast?.('success', 'Thành công', 'Cập nhật thông tin nhân sự thành công!');
      }
      void loadEmployeesPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu nhân sự vào cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadEmployeesPage]);

  const handleDeleteEmployee = useCallback(async (selectedEmployee: Employee): Promise<boolean> => {
    setError(null);
    try {
      await deleteEmployee(selectedEmployee.id);
      setEmployees((prev) => prev.filter((e) => String(e.id) !== String(selectedEmployee.id)));
      addToast?.('success', 'Thành công', 'Đã xóa nhân sự thành công.');
      void loadEmployeesPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa nhân sự trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, loadEmployeesPage]);

  const handleResetEmployeePassword = useCallback(async (selectedEmployee: Employee): Promise<boolean> => {
    setIsPasswordResetting(true);
    setError(null);
    try {
      const result = await resetEmployeePassword(selectedEmployee.id);
      const updatedEmployee = result.employee;

      setEmployees((current) =>
        current.map((employee) =>
          String(employee.id) === String(updatedEmployee.id) ? updatedEmployee : employee
        )
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
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Reset mật khẩu thất bại', message);
      return false;
    } finally {
      setIsPasswordResetting(false);
    }
  }, [addToast, loadEmployeesPage]);

  return {
    employees,
    employeesPageRows,
    employeesPageMeta,
    isSaving,
    isLoading,
    isPageLoading,
    isPasswordResetting,
    error,
    employeeProvisioning,
    loadEmployees,
    loadEmployeesPage,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleResetEmployeePassword,
    setEmployeesPageRows,
    setEmployeesPageMeta,
  };
}