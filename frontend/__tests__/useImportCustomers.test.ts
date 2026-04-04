// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '../types';
import type { ImportPayload } from '../components/modals';
import { useImportCustomers } from '../hooks/useImportCustomers';
import { createCustomersBulk } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createCustomersBulk: vi.fn(),
}));

describe('useImportCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows import rows without customer code and sends them through the bulk endpoint', async () => {
    vi.mocked(createCustomersBulk).mockResolvedValue({
      results: [
        {
          index: 0,
          success: true,
          data: {
            id: '1',
            uuid: 'customer-1',
            customer_code: 'TTYT_VI_THUY',
            customer_code_auto_generated: true,
            customer_name: 'Trung tâm Y tế Vị Thủy',
            tax_code: '',
            address: '',
            customer_sector: 'HEALTHCARE',
            healthcare_facility_type: 'MEDICAL_CENTER',
          } satisfies Customer,
        },
      ],
      created: [
        {
          id: '1',
          uuid: 'customer-1',
          customer_code: 'TTYT_VI_THUY',
          customer_code_auto_generated: true,
          customer_name: 'Trung tâm Y tế Vị Thủy',
          tax_code: '',
          address: '',
          customer_sector: 'HEALTHCARE',
          healthcare_facility_type: 'MEDICAL_CENTER',
        } satisfies Customer,
      ],
      created_count: 1,
      failed_count: 0,
    });

    const { result } = renderHook(() => useImportCustomers());
    const setCustomers = vi.fn();
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const loadCustomersPage = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const payload: ImportPayload = {
      moduleKey: 'clients',
      fileName: 'khach-hang.xlsx',
      sheetName: 'KhachHang',
      headers: ['Tên khách hàng', 'Nhóm khách hàng', 'Loại hình cơ sở y tế'],
      rows: [['Trung tâm Y tế Vị Thủy', 'Y tế', 'Trung tâm Y tế']],
    };

    await act(async () => {
      await result.current.handleImportCustomers(
        payload,
        setCustomers,
        addToast,
        setImportLoadingText,
        loadCustomersPage,
        handleCloseModal,
      );
    });

    expect(createCustomersBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createCustomersBulk).mock.calls[0]?.[0]).toMatchObject([
      {
        customer_code: null,
        customer_name: 'Trung tâm Y tế Vị Thủy',
        customer_sector: 'HEALTHCARE',
        healthcare_facility_type: 'MEDICAL_CENTER',
      },
    ]);
    expect(loadCustomersPage).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });

  it('splits customer import into 1000-row bulk requests to support large batches', async () => {
    vi.mocked(createCustomersBulk).mockImplementation(async (items) => ({
      results: items.map((item, index) => ({
        index,
        success: true,
        data: {
          id: String(index + 1),
          uuid: `customer-${index + 1}`,
          customer_code: item.customer_code || `KH_${index + 1}`,
          customer_name: item.customer_name || `Khách hàng ${index + 1}`,
          tax_code: item.tax_code || '',
          address: item.address || '',
          customer_sector: item.customer_sector || 'OTHER',
          healthcare_facility_type: item.healthcare_facility_type || null,
        } satisfies Customer,
      })),
      created: items.map((item, index) => ({
        id: String(index + 1),
        uuid: `customer-${index + 1}`,
        customer_code: item.customer_code || `KH_${index + 1}`,
        customer_name: item.customer_name || `Khách hàng ${index + 1}`,
        tax_code: item.tax_code || '',
        address: item.address || '',
        customer_sector: item.customer_sector || 'OTHER',
        healthcare_facility_type: item.healthcare_facility_type || null,
      } satisfies Customer)),
      created_count: items.length,
      failed_count: 0,
    }));

    const { result } = renderHook(() => useImportCustomers());
    const setCustomers = vi.fn();
    const addToast = vi.fn();
    const setImportLoadingText = vi.fn();
    const loadCustomersPage = vi.fn(async () => undefined);
    const handleCloseModal = vi.fn();

    const rows = Array.from({ length: 1001 }, (_, index) => [`Khách hàng ${index + 1}`, 'Khác', '']);
    const payload: ImportPayload = {
      moduleKey: 'clients',
      fileName: 'khach-hang-lon.xlsx',
      sheetName: 'KhachHang',
      headers: ['Tên khách hàng', 'Nhóm khách hàng', 'Loại hình cơ sở y tế'],
      rows,
    };

    await act(async () => {
      await result.current.handleImportCustomers(
        payload,
        setCustomers,
        addToast,
        setImportLoadingText,
        loadCustomersPage,
        handleCloseModal,
      );
    });

    expect(createCustomersBulk).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createCustomersBulk).mock.calls[0]?.[0]).toHaveLength(1000);
    expect(vi.mocked(createCustomersBulk).mock.calls[1]?.[0]).toHaveLength(1);
    expect(loadCustomersPage).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });
});
