// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerPersonnel } from '../types';
import { useCustomerPersonnel } from '../hooks/useCustomerPersonnel';
import {
  createCustomerPersonnel,
  deleteCustomerPersonnel,
  fetchCustomerPersonnel,
  updateCustomerPersonnel,
} from '../services/api/customerApi';

vi.mock('../services/api/customerApi', () => ({
  fetchCustomerPersonnel: vi.fn(),
  createCustomerPersonnel: vi.fn(),
  updateCustomerPersonnel: vi.fn(),
  deleteCustomerPersonnel: vi.fn(),
}));

describe('useCustomerPersonnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const existingPersonnel: CustomerPersonnel = {
    id: 'cp-1',
    customerId: '1',
    fullName: 'Hồ Sơn Tùng',
    birthday: '1988-10-20',
    positionType: 'DAU_MOI',
    positionId: 'p1',
    positionLabel: 'Đầu mối',
    phoneNumber: '0912345678',
    email: 'contact.93007@vnpt.local',
    status: 'Active',
  };

  it('refreshes the customer personnel list after creating a new record so the new row appears immediately', async () => {
    const createdPersonnel: CustomerPersonnel = existingPersonnel;

    vi.mocked(createCustomerPersonnel).mockResolvedValue(createdPersonnel);
    vi.mocked(fetchCustomerPersonnel).mockResolvedValue([createdPersonnel]);
    vi.mocked(updateCustomerPersonnel).mockResolvedValue(createdPersonnel);
    vi.mocked(deleteCustomerPersonnel).mockResolvedValue(undefined);

    const addToast = vi.fn();
    const { result } = renderHook(() => useCustomerPersonnel(addToast));

    await act(async () => {
      const success = await result.current.handleSaveCusPersonnel(
        {
          customerId: '1',
          fullName: 'Hồ Sơn Tùng',
          birthday: '20/10/1988',
          positionId: 'p1',
          positionType: 'DAU_MOI',
          phoneNumber: '0912345678',
          email: 'contact.93007@vnpt.local',
          status: 'Active',
        },
        'ADD_CUS_PERSONNEL',
        null,
      );

      expect(success).toBe(true);
    });

    expect(createCustomerPersonnel).toHaveBeenCalledWith(expect.objectContaining({
      customerId: '1',
      fullName: 'Hồ Sơn Tùng',
      birthday: '1988-10-20',
      positionId: 'p1',
      positionType: 'DAU_MOI',
    }));
    expect(fetchCustomerPersonnel).toHaveBeenCalledTimes(1);
    expect(result.current.customerPersonnel).toEqual([createdPersonnel]);
    expect(addToast).toHaveBeenCalledWith('success', 'Thành công', 'Thêm mới nhân sự liên hệ thành công!');
  });

  it('refreshes the customer personnel list after editing so the updated row appears immediately', async () => {
    const updatedPersonnel: CustomerPersonnel = {
      ...existingPersonnel,
      fullName: 'Hồ Sơn Tùng Mới',
      positionLabel: 'Trưởng phòng',
      positionId: 'p2',
      birthday: '1989-11-21',
    };

    vi.mocked(updateCustomerPersonnel).mockResolvedValue(updatedPersonnel);
    vi.mocked(fetchCustomerPersonnel).mockResolvedValue([updatedPersonnel]);
    vi.mocked(createCustomerPersonnel).mockResolvedValue(existingPersonnel);
    vi.mocked(deleteCustomerPersonnel).mockResolvedValue(undefined);

    const addToast = vi.fn();
    const { result } = renderHook(() => useCustomerPersonnel(addToast));

    await act(async () => {
      const success = await result.current.handleSaveCusPersonnel(
        {
          ...updatedPersonnel,
          birthday: '21/11/1989',
        },
        'EDIT_CUS_PERSONNEL',
        existingPersonnel,
      );

      expect(success).toBe(true);
    });

    expect(updateCustomerPersonnel).toHaveBeenCalledWith('cp-1', expect.objectContaining({
      fullName: 'Hồ Sơn Tùng Mới',
      birthday: '1989-11-21',
      positionId: 'p2',
    }));
    expect(fetchCustomerPersonnel).toHaveBeenCalledTimes(1);
    expect(result.current.customerPersonnel).toEqual([updatedPersonnel]);
    expect(addToast).toHaveBeenCalledWith('success', 'Thành công', 'Cập nhật nhân sự liên hệ thành công!');
  });

  it('refreshes the customer personnel list after deleting so the removed row disappears immediately', async () => {
    vi.mocked(deleteCustomerPersonnel).mockResolvedValue(undefined);
    vi.mocked(fetchCustomerPersonnel)
      .mockResolvedValueOnce([existingPersonnel])
      .mockResolvedValueOnce([]);
    vi.mocked(createCustomerPersonnel).mockResolvedValue(existingPersonnel);
    vi.mocked(updateCustomerPersonnel).mockResolvedValue(existingPersonnel);

    const addToast = vi.fn();
    const { result } = renderHook(() => useCustomerPersonnel(addToast));

    await act(async () => {
      await result.current.loadCustomerPersonnel();
    });

    expect(result.current.customerPersonnel).toEqual([existingPersonnel]);

    await act(async () => {
      const success = await result.current.handleDeleteCusPersonnel(existingPersonnel);
      expect(success).toBe(true);
    });

    expect(deleteCustomerPersonnel).toHaveBeenCalledWith('cp-1');
    expect(fetchCustomerPersonnel).toHaveBeenCalledTimes(2);
    expect(result.current.customerPersonnel).toEqual([]);
    expect(addToast).toHaveBeenCalledWith('success', 'Thành công', 'Đã xóa nhân sự liên hệ.');
  });
});
