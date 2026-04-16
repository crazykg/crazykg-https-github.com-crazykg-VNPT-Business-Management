import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ImportPayload } from '../components/modals/projectImportTypes';
import type { Customer, PaginationMeta } from '../types';

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchContractsMock = vi.hoisted(() => vi.fn());
const fetchPaymentSchedulesMock = vi.hoisted(() => vi.fn());
const fetchProjectsMock = vi.hoisted(() => vi.fn());
const fetchCustomersMock = vi.hoisted(() => vi.fn());
const fetchCustomersPageMock = vi.hoisted(() => vi.fn());
const createCustomerMock = vi.hoisted(() => vi.fn());
const updateCustomerMock = vi.hoisted(() => vi.fn());
const deleteCustomerMock = vi.hoisted(() => vi.fn());
const registerTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const unregisterTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const handleImportCustomersMock = vi.hoisted(() => vi.fn());
const existingCustomer = vi.hoisted(() => ({
  id: '93017',
  uuid: 'customer-93017',
  customer_code: 'TTYT_VI_THUY',
  customer_name: 'Trung tâm Y tế Vị Thủy',
  tax_code: '',
  address: '',
  customer_sector: 'HEALTHCARE',
  healthcare_facility_type: 'MEDICAL_CENTER',
} satisfies Customer));

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('../components/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">login</div>,
}));

vi.mock('../components/Toast', () => ({
  ToastContainer: ({ toasts }: { toasts?: Array<{ title: string; message: string }> }) => (
    <div data-testid="toast-container">
      {(toasts || []).map((toast) => (
        <div key={`${toast.title}-${toast.message}`}>
          <div>{toast.title}</div>
          <div>{toast.message}</div>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../AppPages', () => ({
  AppPages: ({ handleOpenModal }: { handleOpenModal: (type: string, item?: Customer) => void }) => (
    <div>
      <button type="button" onClick={() => handleOpenModal('ADD_CUSTOMER')}>
        Mở thêm khách hàng
      </button>
      <button type="button" onClick={() => handleOpenModal('EDIT_CUSTOMER', existingCustomer)}>
        Mở sửa khách hàng
      </button>
      <button type="button" onClick={() => handleOpenModal('DELETE_CUSTOMER', existingCustomer)}>
        Mở xóa khách hàng
      </button>
      <button type="button" onClick={() => handleOpenModal('IMPORT_DATA')}>
        Mở import khách hàng
      </button>
    </div>
  ),
}));

vi.mock('../components/modals', () => ({
  CustomerFormModal: ({ onSave }: { onSave?: (payload: Partial<Customer>) => void | Promise<void> }) => (
    <div data-testid="customer-form-modal">
      <button
        type="button"
        onClick={() =>
          onSave?.({
            customer_code: null,
            customer_name: 'Trung tâm Y tế Vị Thủy',
            customer_sector: 'HEALTHCARE',
            healthcare_facility_type: 'MEDICAL_CENTER',
          })
        }
      >
        Lưu khách hàng mock
      </button>
    </div>
  ),
  DeleteCustomerModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <div data-testid="delete-customer-modal">
      <button type="button" onClick={() => onConfirm?.()}>
        Xóa khách hàng mock
      </button>
    </div>
  ),
  ImportModal: ({ moduleKey, onSave }: { moduleKey?: string; onSave?: (payload: ImportPayload) => void | Promise<void> }) => (
    <div data-testid="import-modal">
      <div data-testid="import-module-key">{moduleKey}</div>
      <button
        type="button"
        onClick={() =>
          onSave?.({
            moduleKey: 'clients',
            fileName: 'khach-hang.xlsx',
            sheetName: 'KhachHang',
            headers: ['Tên khách hàng'],
            rows: [['Trung tâm Y tế Vị Thủy']],
          })
        }
      >
        Lưu import mock
      </button>
    </div>
  ),
}));

vi.mock('../hooks/useImportDepartments', () => ({
  useImportDepartments: () => ({ handleImportDepartments: vi.fn() }),
}));

vi.mock('../hooks/useImportEmployees', () => ({
  useImportEmployees: () => ({ handleImportEmployees: vi.fn() }),
}));

vi.mock('../hooks/useImportCustomers', () => ({
  useImportCustomers: () => ({ handleImportCustomers: handleImportCustomersMock }),
}));

vi.mock('../hooks/useImportEmployeePartyProfiles', () => ({
  useImportEmployeePartyProfiles: () => ({ handleImportEmployeePartyProfiles: vi.fn() }),
}));

vi.mock('../hooks/useImportProducts', () => ({
  useImportProducts: () => ({ handleImportProducts: vi.fn() }),
}));

vi.mock('../hooks/useImportProductPackages', () => ({
  useImportProductPackages: () => ({ handleImportProductPackages: vi.fn() }),
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');

  return {
    ...actual,
    fetchAuthBootstrap: fetchAuthBootstrapMock,
    fetchContracts: fetchContractsMock,
    fetchPaymentSchedules: fetchPaymentSchedulesMock,
    fetchProjects: fetchProjectsMock,
    fetchCustomers: fetchCustomersMock,
    fetchCustomersPage: fetchCustomersPageMock,
    createCustomer: createCustomerMock,
    updateCustomer: updateCustomerMock,
    deleteCustomer: deleteCustomerMock,
    registerTabEvictedHandler: registerTabEvictedHandlerMock,
    unregisterTabEvictedHandler: unregisterTabEvictedHandlerMock,
  };
});

describe('Clients page immediate refresh flows', () => {
  const paginationMeta: PaginationMeta = {
    page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
  };

  const renderApp = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/clients']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    fetchAuthBootstrapMock.mockResolvedValue({
      user: {
        id: 1,
        username: 'admin',
        full_name: 'Admin',
        roles: ['ADMIN'],
        permissions: ['*'],
        password_change_required: false,
      },
      permissions: ['*'],
      counters: {},
    });
    fetchContractsMock.mockResolvedValue([]);
    fetchPaymentSchedulesMock.mockResolvedValue([]);
    fetchProjectsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchCustomersPageMock.mockResolvedValue({
      data: [],
      meta: paginationMeta,
    });
    createCustomerMock.mockResolvedValue(existingCustomer);
    updateCustomerMock.mockResolvedValue({
      ...existingCustomer,
      customer_name: 'Trung tâm Y tế Vị Thủy cập nhật',
    } satisfies Customer);
    deleteCustomerMock.mockResolvedValue(undefined);
    handleImportCustomersMock.mockImplementation(
      async (
        _payload: ImportPayload,
        _setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>,
        _addToast: (type: 'success' | 'error', title: string, message: string) => void,
        _setImportLoadingText: React.Dispatch<React.SetStateAction<string>>,
        refreshCustomersData: () => Promise<void>,
        closeImportModal: () => void,
      ) => {
        await refreshCustomersData();
        closeImportModal();
      },
    );
  });

  it('reloads the clients list immediately after saving a new customer', async () => {
    const user = userEvent.setup();

    renderApp();

    await waitFor(() => {
      expect(fetchCustomersPageMock).toHaveBeenCalled();
    });

    const initialPageCalls = fetchCustomersPageMock.mock.calls.length;
    const initialCustomersCalls = fetchCustomersMock.mock.calls.length;

    await user.click(await screen.findByRole('button', { name: 'Mở thêm khách hàng' }));
    expect(await screen.findByTestId('customer-form-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu khách hàng mock' }));

    await waitFor(() => {
      expect(createCustomerMock).toHaveBeenCalledWith(expect.objectContaining({
        customer_code: null,
        customer_name: 'Trung tâm Y tế Vị Thủy',
      }));
    });

    await waitFor(() => {
      expect(fetchCustomersPageMock.mock.calls.length).toBeGreaterThan(initialPageCalls);
    });

    await waitFor(() => {
      expect(fetchCustomersMock.mock.calls.length).toBeGreaterThan(initialCustomersCalls);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('customer-form-modal')).not.toBeInTheDocument();
    });
  });

  it('reloads the clients list immediately after editing a customer', async () => {
    const user = userEvent.setup();

    renderApp();

    await waitFor(() => {
      expect(fetchCustomersPageMock).toHaveBeenCalled();
    });

    const initialPageCalls = fetchCustomersPageMock.mock.calls.length;
    const initialCustomersCalls = fetchCustomersMock.mock.calls.length;

    await user.click(await screen.findByRole('button', { name: 'Mở sửa khách hàng' }));
    expect(await screen.findByTestId('customer-form-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu khách hàng mock' }));

    await waitFor(() => {
      expect(updateCustomerMock).toHaveBeenCalledWith(
        '93017',
        expect.objectContaining({
          customer_name: 'Trung tâm Y tế Vị Thủy',
          healthcare_facility_type: 'MEDICAL_CENTER',
        }),
      );
    });

    await waitFor(() => {
      expect(fetchCustomersPageMock.mock.calls.length).toBeGreaterThan(initialPageCalls);
    });

    await waitFor(() => {
      expect(fetchCustomersMock.mock.calls.length).toBeGreaterThan(initialCustomersCalls);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('customer-form-modal')).not.toBeInTheDocument();
    });
  });

  it('reloads the clients list immediately after deleting a customer', async () => {
    const user = userEvent.setup();

    renderApp();

    await waitFor(() => {
      expect(fetchCustomersPageMock).toHaveBeenCalled();
    });

    const initialPageCalls = fetchCustomersPageMock.mock.calls.length;
    const initialCustomersCalls = fetchCustomersMock.mock.calls.length;

    await user.click(await screen.findByRole('button', { name: 'Mở xóa khách hàng' }));
    expect(await screen.findByTestId('delete-customer-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xóa khách hàng mock' }));

    await waitFor(() => {
      expect(deleteCustomerMock).toHaveBeenCalledWith('93017');
    });

    await waitFor(() => {
      expect(fetchCustomersPageMock.mock.calls.length).toBeGreaterThan(initialPageCalls);
    });

    await waitFor(() => {
      expect(fetchCustomersMock.mock.calls.length).toBeGreaterThan(initialCustomersCalls);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('delete-customer-modal')).not.toBeInTheDocument();
    });
  });

  it('reloads the clients list immediately after importing customers', async () => {
    const user = userEvent.setup();

    renderApp();

    await waitFor(() => {
      expect(fetchCustomersPageMock).toHaveBeenCalled();
    });

    const initialPageCalls = fetchCustomersPageMock.mock.calls.length;
    const initialCustomersCalls = fetchCustomersMock.mock.calls.length;

    await user.click(await screen.findByRole('button', { name: 'Mở import khách hàng' }));
    expect(await screen.findByTestId('import-modal')).toBeInTheDocument();
    expect(screen.getByTestId('import-module-key')).toHaveTextContent('clients');

    await user.click(screen.getByRole('button', { name: 'Lưu import mock' }));

    await waitFor(() => {
      expect(handleImportCustomersMock).toHaveBeenCalled();
    });

    expect(handleImportCustomersMock.mock.calls[0]?.[0]).toMatchObject({
      moduleKey: 'clients',
      fileName: 'khach-hang.xlsx',
    });

    await waitFor(() => {
      expect(fetchCustomersPageMock.mock.calls.length).toBeGreaterThan(initialPageCalls);
    });

    await waitFor(() => {
      expect(fetchCustomersMock.mock.calls.length).toBeGreaterThan(initialCustomersCalls);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('import-modal')).not.toBeInTheDocument();
    });
  });
});
