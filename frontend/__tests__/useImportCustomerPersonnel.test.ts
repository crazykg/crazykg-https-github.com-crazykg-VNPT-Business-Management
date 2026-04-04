// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerPersonnel, SupportContactPosition } from '../types';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import { useImportCustomerPersonnel } from '../hooks/useImportCustomerPersonnel';
import { createCustomerPersonnelBulk, deleteCustomerPersonnel } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createCustomerPersonnelBulk: vi.fn(),
  deleteCustomerPersonnel: vi.fn(),
}));

describe('useImportCustomerPersonnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports cus-personnel rows, trims extra whitespace, and refreshes the list immediately after saving', async () => {
    const customers: Customer[] = [
      {
        id: '1',
        uuid: 'customer-1',
        customer_code: '93007',
        customer_name: 'Bệnh viện Sản - Nhi Hậu Giang',
        tax_code: '1800000001',
        address: 'Hậu Giang',
      },
    ];
    const supportContactPositions: SupportContactPosition[] = [
      {
        id: 'p1',
        position_code: 'DAU_MOI',
        position_name: 'Đầu mối',
        is_active: true,
      },
    ];
    const createdPersonnel: CustomerPersonnel = {
      id: 'cp-1',
      customerId: '1',
      fullName: 'Hồ Sơn Tùng',
      birthday: '1990-05-15',
      positionType: 'DAU_MOI',
      positionId: 'p1',
      positionLabel: 'Đầu mối',
      phoneNumber: '0912345678',
      email: 'contact.93007@vnpt.local',
      status: 'Active',
    };

    vi.mocked(createCustomerPersonnelBulk).mockResolvedValue({
      results: [
        {
          index: 0,
          success: true,
          data: createdPersonnel,
        },
      ],
      created: [createdPersonnel],
      created_count: 1,
      failed_count: 0,
    });
    vi.mocked(deleteCustomerPersonnel).mockResolvedValue(undefined);

    const { result } = renderHook(() => useImportCustomerPersonnel());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const loadCustomerPersonnel = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const payload: ImportPayload = {
      moduleKey: 'cus_personnel',
      fileName: 'nhan-su-lien-he.xlsx',
      sheetName: 'NhanSuLienHe',
      headers: ['Mã khách hàng', 'Họ và tên', 'Ngày sinh', 'Mã chức vụ', 'Số điện thoại', 'Email', 'Trạng thái'],
      rows: [[
        ' 93007 ',
        '  Hồ   Sơn   Tùng  ',
        ' 15 / 05 / 1990 ',
        ' DAU_MOI ',
        ' 0912 345 678 ',
        ' contact.93007@vnpt.local ',
        ' Active ',
      ]],
    };

    await act(async () => {
      await result.current.handleImportCustomerPersonnel(
        payload,
        customers,
        supportContactPositions,
        addToast,
        setImportLoadingText,
        loadCustomerPersonnel,
        handleCloseModal,
      );
    });

    expect(createCustomerPersonnelBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createCustomerPersonnelBulk).mock.calls[0]?.[0]).toMatchObject([
      {
        customerId: '1',
        fullName: 'Hồ Sơn Tùng',
        birthday: '1990-05-15',
        positionId: 'p1',
        positionType: 'DAU_MOI',
        positionLabel: 'Đầu mối',
        phoneNumber: '0912345678',
        email: 'contact.93007@vnpt.local',
        status: 'Active',
      },
    ]);
    expect(loadCustomerPersonnel).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });

  it('splits cus-personnel import into 1000-row bulk requests', async () => {
    const customers: Customer[] = [
      {
        id: '1',
        uuid: 'customer-1',
        customer_code: '93007',
        customer_name: 'Bệnh viện Sản - Nhi Hậu Giang',
        tax_code: '1800000001',
        address: 'Hậu Giang',
      },
    ];
    const supportContactPositions: SupportContactPosition[] = [
      {
        id: 'p1',
        position_code: 'DAU_MOI',
        position_name: 'Đầu mối',
        is_active: true,
      },
    ];

    vi.mocked(createCustomerPersonnelBulk).mockImplementation(async (items) => ({
      results: items.map((item, index) => ({
        index,
        success: true,
        data: {
          id: `cp-${index + 1}`,
          customerId: String(item.customerId || '1'),
          fullName: String(item.fullName || ''),
          birthday: String(item.birthday || ''),
          positionType: String(item.positionType || 'DAU_MOI'),
          positionId: String(item.positionId || 'p1'),
          positionLabel: String(item.positionLabel || 'Đầu mối'),
          phoneNumber: String(item.phoneNumber || ''),
          email: String(item.email || ''),
          status: String(item.status || 'Active') as CustomerPersonnel['status'],
        } satisfies CustomerPersonnel,
      })),
      created: items.map((item, index) => ({
        id: `cp-${index + 1}`,
        customerId: String(item.customerId || '1'),
        fullName: String(item.fullName || ''),
        birthday: String(item.birthday || ''),
        positionType: String(item.positionType || 'DAU_MOI'),
        positionId: String(item.positionId || 'p1'),
        positionLabel: String(item.positionLabel || 'Đầu mối'),
        phoneNumber: String(item.phoneNumber || ''),
        email: String(item.email || ''),
        status: String(item.status || 'Active') as CustomerPersonnel['status'],
      } satisfies CustomerPersonnel)),
      created_count: items.length,
      failed_count: 0,
    }));

    const { result } = renderHook(() => useImportCustomerPersonnel());
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const loadCustomerPersonnel = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const rows = Array.from({ length: 1001 }, (_, index) => [
      '93007',
      `Nhân sự ${index + 1}`,
      '15/05/1990',
      'DAU_MOI',
      `090900${String(index + 1).padStart(4, '0')}`,
      `person${index + 1}@example.com`,
      'Active',
    ]);

    const payload: ImportPayload = {
      moduleKey: 'cus_personnel',
      fileName: 'nhan-su-lien-he-lon.xlsx',
      sheetName: 'NhanSuLienHe',
      headers: ['Mã khách hàng', 'Họ và tên', 'Ngày sinh', 'Mã chức vụ', 'Số điện thoại', 'Email', 'Trạng thái'],
      rows,
    };

    await act(async () => {
      await result.current.handleImportCustomerPersonnel(
        payload,
        customers,
        supportContactPositions,
        addToast,
        setImportLoadingText,
        loadCustomerPersonnel,
        handleCloseModal,
      );
    });

    expect(createCustomerPersonnelBulk).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createCustomerPersonnelBulk).mock.calls[0]?.[0]).toHaveLength(1000);
    expect(vi.mocked(createCustomerPersonnelBulk).mock.calls[1]?.[0]).toHaveLength(1);
    expect(loadCustomerPersonnel).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });
});
