import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useEmployeeStore } from '../shared/stores/employeeStore';
import { useFilterStore } from '../shared/stores/filterStore';
import type { Employee, EmployeeProvisioning, PaginatedQuery, PaginationMeta } from '../types';

const fetchEmployeesMock = vi.hoisted(() => vi.fn());
const fetchEmployeesPageMock = vi.hoisted(() => vi.fn());
const createEmployeeWithProvisioningMock = vi.hoisted(() => vi.fn());
const updateEmployeeMock = vi.hoisted(() => vi.fn());
const deleteEmployeeApiMock = vi.hoisted(() => vi.fn());
const isRequestCanceledErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/api/employeeApi', () => ({
  fetchEmployees: fetchEmployeesMock,
  fetchEmployeesPage: fetchEmployeesPageMock,
  createEmployeeWithProvisioning: createEmployeeWithProvisioningMock,
  updateEmployee: updateEmployeeMock,
  deleteEmployee: deleteEmployeeApiMock,
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    isRequestCanceledError: isRequestCanceledErrorMock,
  };
});

const buildMeta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => ({
  ...DEFAULT_PAGINATION_META,
  ...overrides,
});

const buildEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 1,
  uuid: 'employee-1',
  user_code: 'NV001',
  username: 'user001',
  full_name: 'Nguyễn Văn A',
  email: 'a@example.com',
  phone: '0901234567',
  phone_number: '0901234567',
  department_id: 10,
  position_id: 2,
  position_name: 'Developer',
  date_of_birth: '1990-01-01',
  leave_date: null,
  status: 'ACTIVE',
  ...overrides,
});

const buildProvisioning = (overrides: Partial<EmployeeProvisioning> = {}): EmployeeProvisioning => ({
  temporary_password: 'TempPass123!',
  must_change_password: true,
  delivery: 'one_time',
  ...overrides,
});

const resetEmployeeStore = () => {
  useEmployeeStore.setState({
    employees: [],
    employeesPageRows: [],
    employeesPageMeta: DEFAULT_PAGINATION_META,
    isEmployeesLoading: false,
    isEmployeesPageLoading: false,
    isSaving: false,
    error: null,
    notifier: null,
    tempPassword: null,
  });
};

describe('employeeStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEmployeeStore();
    useFilterStore.getState().resetTabFilter('employeesPage');
  });

  it('loads paginated employees and persists the latest filter query', async () => {
    const pageQuery: PaginatedQuery = {
      page: 1,
      per_page: 20,
      q: 'Nguyễn',
      sort_by: 'full_name',
      sort_dir: 'asc',
    };
    const rows = [buildEmployee({ id: 2, full_name: 'Nguyễn Văn B' })];

    fetchEmployeesPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 1, per_page: 20, total: 5, total_pages: 1 }),
    });

    await act(async () => {
      await useEmployeeStore.getState().loadEmployeesPage(pageQuery);
    });

    expect(fetchEmployeesPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useEmployeeStore.getState().employeesPageRows).toEqual(rows);
    expect(useEmployeeStore.getState().employeesPageMeta.total).toBe(5);

    const storedFilter = useFilterStore.getState().getTabFilter('employeesPage');
    expect(storedFilter.page).toBe(pageQuery.page);
    expect(storedFilter.per_page).toBe(pageQuery.per_page);
    expect(storedFilter.q).toBe(pageQuery.q);
  });

  it('creates a new employee with provisioning and exposes temp password', async () => {
    const notifier = vi.fn();
    const newEmployee = buildEmployee({ id: 10, full_name: 'Trần Thị Mới' });
    const provisioning = buildProvisioning();

    useEmployeeStore.getState().setNotifier(notifier);
    createEmployeeWithProvisioningMock.mockResolvedValue({
      employee: newEmployee,
      provisioning,
    });
    fetchEmployeesPageMock.mockResolvedValue({
      data: [newEmployee],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    fetchEmployeesMock.mockResolvedValue([newEmployee]);

    let result: Employee | null = null;
    await act(async () => {
      result = await useEmployeeStore.getState().saveEmployee({
        data: {
          full_name: newEmployee.full_name,
          email: newEmployee.email,
          department_id: newEmployee.department_id,
        },
      });
    });

    expect(createEmployeeWithProvisioningMock).toHaveBeenCalled();
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Tạo mới nhân viên thành công.'
    );

    expect(useEmployeeStore.getState().tempPassword).toBe(provisioning.temporary_password);
  });

  it('creates employee without provisioning (no temp password exposed)', async () => {
    const notifier = vi.fn();
    const newEmployee = buildEmployee({ id: 11 });

    useEmployeeStore.getState().setNotifier(notifier);
    createEmployeeWithProvisioningMock.mockResolvedValue({
      employee: newEmployee,
      provisioning: null,
    });
    fetchEmployeesPageMock.mockResolvedValue({
      data: [newEmployee],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    fetchEmployeesMock.mockResolvedValue([newEmployee]);

    await act(async () => {
      await useEmployeeStore.getState().saveEmployee({
        data: { full_name: newEmployee.full_name },
      });
    });

    expect(useEmployeeStore.getState().tempPassword).toBe(null);
  });

  it('updates an existing employee without provisioning', async () => {
    const notifier = vi.fn();
    const existingEmployee = buildEmployee({ id: 5 });
    const updatedEmployee = buildEmployee({ id: 5, full_name: 'Nguyễn Văn A (Updated)' });

    useEmployeeStore.getState().setNotifier(notifier);
    useEmployeeStore.setState({
      employees: [existingEmployee],
      employeesPageRows: [existingEmployee],
    });

    updateEmployeeMock.mockResolvedValue(updatedEmployee);
    fetchEmployeesPageMock.mockResolvedValue({
      data: [updatedEmployee],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    await act(async () => {
      await useEmployeeStore.getState().saveEmployee({
        id: 5,
        data: { full_name: updatedEmployee.full_name },
      });
    });

    expect(updateEmployeeMock).toHaveBeenCalledWith(5, { full_name: updatedEmployee.full_name });
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Cập nhật nhân viên thành công.'
    );
  });

  it('deletes an employee and reloads page', async () => {
    const notifier = vi.fn();
    const employee = buildEmployee({ id: 7 });

    useEmployeeStore.getState().setNotifier(notifier);
    useEmployeeStore.setState({
      employees: [employee],
      employeesPageRows: [employee],
    });
    deleteEmployeeApiMock.mockResolvedValue(undefined);
    fetchEmployeesPageMock.mockResolvedValue({
      data: [],
      meta: buildMeta({ total: 0, total_pages: 1 }),
    });

    const result = await act(async () => {
      return await useEmployeeStore.getState().deleteEmployee(7);
    });

    expect(result).toBe(true);
    expect(deleteEmployeeApiMock).toHaveBeenCalledWith(7);
    expect(notifier).toHaveBeenCalledWith('success', 'Thành công', 'Xóa nhân viên thành công.');
    expect(useEmployeeStore.getState().employeesPageRows).not.toContain(employee);
  });

  it('clears temp password state', async () => {
    useEmployeeStore.setState({
      tempPassword: 'SomePass123!',
    });

    expect(useEmployeeStore.getState().tempPassword).not.toBe(null);

    await act(async () => {
      useEmployeeStore.getState().clearTempPassword();
    });

    expect(useEmployeeStore.getState().tempPassword).toBe(null);
  });

  it('loads full employee list', async () => {
    const employees = [
      buildEmployee({ id: 1 }),
      buildEmployee({ id: 2, full_name: 'Nguyễn Văn B' }),
    ];
    fetchEmployeesMock.mockResolvedValue(employees);

    await act(async () => {
      await useEmployeeStore.getState().loadEmployees();
    });

    expect(fetchEmployeesMock).toHaveBeenCalled();
    expect(useEmployeeStore.getState().employees).toEqual(employees);
  });

  it('handles delete error gracefully', async () => {
    const notifier = vi.fn();
    const deleteError = new Error('Delete failed');

    useEmployeeStore.getState().setNotifier(notifier);
    deleteEmployeeApiMock.mockRejectedValue(deleteError);

    const result = await act(async () => {
      return await useEmployeeStore.getState().deleteEmployee(99);
    });

    expect(result).toBe(false);
    expect(useEmployeeStore.getState().error).toBe('Delete failed');
    expect(notifier).toHaveBeenCalledWith('error', 'Xóa thất bại', 'Delete failed');
  });
});
