import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchContractsMock = vi.hoisted(() => vi.fn());
const fetchPaymentSchedulesMock = vi.hoisted(() => vi.fn());
const fetchProjectsMock = vi.hoisted(() => vi.fn());
const fetchCustomersMock = vi.hoisted(() => vi.fn());
const fetchProjectsPageMock = vi.hoisted(() => vi.fn());
const registerTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const unregisterTabEvictedHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('../components/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">login</div>,
}));

vi.mock('../components/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('../hooks/useImportDepartments', () => ({
  useImportDepartments: () => ({ handleImportDepartments: vi.fn() }),
}));

vi.mock('../hooks/useImportEmployees', () => ({
  useImportEmployees: () => ({ handleImportEmployees: vi.fn() }),
}));

vi.mock('../hooks/useImportCustomers', () => ({
  useImportCustomers: () => ({ handleImportCustomers: vi.fn() }),
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

vi.mock('../AppPages', () => ({
  AppPages: ({
    handleProjectsPageQueryChange,
    exportProjectsByCurrentQuery,
  }: {
    handleProjectsPageQueryChange: (query: Record<string, unknown>) => void;
    exportProjectsByCurrentQuery: () => Promise<unknown>;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          handleProjectsPageQueryChange({
            page: 2,
            per_page: 10,
            q: 'goi thau y te',
            sort_by: 'project_code',
            sort_dir: 'asc',
            filters: {
              status: 'CHUAN_BI',
            },
          })
        }
      >
        Cập nhật query dự án
      </button>
      <button
        type="button"
        onClick={() => {
          void exportProjectsByCurrentQuery();
        }}
      >
        Xuất dự án
      </button>
    </div>
  ),
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
    fetchProjectsPage: fetchProjectsPageMock,
    registerTabEvictedHandler: registerTabEvictedHandlerMock,
    unregisterTabEvictedHandler: unregisterTabEvictedHandlerMock,
  };
});

describe('App filter store integration', () => {
  const renderApp = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('uses the latest stored projects query when exporting immediately after a filter change', async () => {
    const user = userEvent.setup();

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
    fetchProjectsPageMock.mockResolvedValue({
      data: [],
      meta: {
        total_pages: 1,
      },
    });

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Cập nhật query dự án' }));
    await user.click(screen.getByRole('button', { name: 'Xuất dự án' }));

    await waitFor(() => {
      expect(fetchProjectsPageMock).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        per_page: 200,
        q: 'goi thau y te',
        sort_by: 'project_code',
        sort_dir: 'asc',
        filters: {
          status: 'CHUAN_BI',
        },
      }));
    });
  });
});
