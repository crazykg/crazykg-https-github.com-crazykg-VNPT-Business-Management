// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '../types';
import type { ImportPayload } from '../components/modals';
import { useImportCustomers } from '../hooks/useImportCustomers';
import { createCustomer, deleteCustomer } from '../services/v5Api';

vi.mock('../services/v5Api', () => ({
  createCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
}));

describe('useImportCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows import rows without customer code and lets the backend auto-generate it', async () => {
    vi.mocked(createCustomer).mockResolvedValue({
      id: '1',
      uuid: 'customer-1',
      customer_code: 'TTYT_VI_THUY',
      customer_code_auto_generated: true,
      customer_name: 'Trung tâm Y tế Vị Thủy',
      tax_code: '',
      address: '',
      customer_sector: 'HEALTHCARE',
      healthcare_facility_type: 'MEDICAL_CENTER',
    } as Customer);
    vi.mocked(deleteCustomer).mockResolvedValue(undefined);

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

    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createCustomer).mock.calls[0]?.[0]).toMatchObject({
      customer_code: null,
      customer_name: 'Trung tâm Y tế Vị Thủy',
      customer_sector: 'HEALTHCARE',
      healthcare_facility_type: 'MEDICAL_CENTER',
    });
    expect(loadCustomersPage).toHaveBeenCalledTimes(1);
    expect(handleCloseModal).toHaveBeenCalledTimes(1);
  });
});
