// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Department, Employee } from '../types';
import type { ImportPayload } from '../components/modals';
import { useImportEmployees } from '../hooks/useImportEmployees';
import { createEmployeesBulk, deleteEmployee } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createEmployeesBulk: vi.fn(),
  deleteEmployee: vi.fn(),
}));

describe('useImportEmployees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows sparse import rows and treats update-only bulk responses as success', async () => {
    vi.mocked(createEmployeesBulk).mockResolvedValue({
      results: [{
        index: 0,
        success: true,
        data: {
          id: 'emp-1',
          uuid: 'emp-1',
          user_code: 'VNPT900001',
          employee_code: 'VNPT900001',
          username: 'vnpt900001',
          full_name: 'Nguyễn Văn A mới',
          email: 'vnpt900001@import.local',
          status: 'ACTIVE',
          department_id: '1',
          position_id: null,
        } as Employee,
      }],
      created: [],
      created_count: 0,
      failed_count: 0,
    });
    vi.mocked(deleteEmployee).mockResolvedValue(undefined);

    const { result } = renderHook(() => useImportEmployees());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const setIsSaving = vi.fn();
    const setEmployees = vi.fn();
    const loadEmployeesPage = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const departments: Department[] = [{
      id: '1',
      dept_code: 'BGDVT',
      dept_name: 'Ban Giám đốc',
      parent_id: null,
      dept_path: 'BGDVT',
      is_active: true,
    }];

    const payload: ImportPayload = {
      moduleKey: 'internal_user_list',
      fileName: 'nhan-su.xlsx',
      sheetName: 'NhanSu',
      headers: ['Mã NV', 'Họ và tên'],
      rows: [['VNPT900001', 'Nguyễn Văn A mới']],
    };

    await act(async () => {
      await result.current.handleImportEmployees(
        payload,
        departments,
        addToast,
        setImportLoadingText,
        setIsSaving,
        setEmployees,
        loadEmployeesPage,
        handleCloseModal,
      );
    });

    expect(createEmployeesBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createEmployeesBulk).mock.calls[0]?.[0]).toEqual([{
      user_code: 'VNPT900001',
      full_name: 'Nguyễn Văn A mới',
    }]);
    expect(loadEmployeesPage).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('success', 'Nhập dữ liệu', 'Nhân sự: đã lưu 1 dòng.');
  });

  it('maps VNPT Mail and Gmail headers into employee bulk payloads', async () => {
    vi.mocked(createEmployeesBulk).mockResolvedValue({
      results: [{
        index: 0,
        success: true,
        data: {
          id: 'emp-2',
          uuid: 'emp-2',
          user_code: 'VNPT900002',
          employee_code: 'VNPT900002',
          username: 'vnpt900002',
          full_name: 'Nguyễn Văn B',
          email: 'vnpt900002@vnpt.vn',
          gmail: 'vnpt900002@gmail.com',
          status: 'ACTIVE',
          department_id: null,
          position_id: null,
        } as Employee,
      }],
      created: [],
      created_count: 0,
      failed_count: 0,
    });
    vi.mocked(deleteEmployee).mockResolvedValue(undefined);

    const { result } = renderHook(() => useImportEmployees());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const setIsSaving = vi.fn();
    const setEmployees = vi.fn();
    const loadEmployeesPage = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const payload: ImportPayload = {
      moduleKey: 'internal_user_list',
      fileName: 'nhan-su.xlsx',
      sheetName: 'NhanSu',
      headers: ['Mã NV', 'VNPT Mail', 'Gmail'],
      rows: [['VNPT900002', 'vnpt900002@vnpt.vn', 'vnpt900002@gmail.com']],
    };

    await act(async () => {
      await result.current.handleImportEmployees(
        payload,
        [],
        addToast,
        setImportLoadingText,
        setIsSaving,
        setEmployees,
        loadEmployeesPage,
        handleCloseModal,
      );
    });

    expect(createEmployeesBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createEmployeesBulk).mock.calls[0]?.[0]).toEqual([{
      user_code: 'VNPT900002',
      email: 'vnpt900002@vnpt.vn',
      gmail: 'vnpt900002@gmail.com',
    }]);
    expect(loadEmployeesPage).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });
});
