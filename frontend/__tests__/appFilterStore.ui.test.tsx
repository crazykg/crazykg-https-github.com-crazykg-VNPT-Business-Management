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
    activeTab,
    handleProjectsPageQueryChange,
    exportProjectsByCurrentQuery,
  }: {
    activeTab?: string;
    handleProjectsPageQueryChange: (query: Record<string, unknown>) => void;
    exportProjectsByCurrentQuery: () => Promise<unknown>;
  }) => (
    <div>
      <div data-testid="app-active-tab">{activeTab}</div>
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
  const renderApp = (initialEntries: string[] = ['/']) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
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

  it('keeps the access-control route inside a scrollable app shell on narrow layouts', async () => {
    const previousInnerWidth = window.innerWidth;

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    window.dispatchEvent(new Event('resize'));

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

    try {
      renderApp(['/access-control']);

      await waitFor(() => {
        expect(screen.getByTestId('app-active-tab')).toHaveTextContent('access_control');
      });

      const main = screen.getByRole('main');

      expect(main).toHaveClass('flex-1');
      expect(main).toHaveClass('overflow-y-auto');
      expect(main).toHaveClass('w-full');
      expect(main).toHaveClass('min-h-0');
      expect(main.parentElement).toHaveClass('flex-col');
      expect(main.parentElement).toHaveClass('overflow-hidden');
      expect(main.parentElement).toHaveClass('h-[100dvh]');
      expect(main.parentElement).not.toHaveClass('h-screen');
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: previousInnerWidth,
      });
      window.dispatchEvent(new Event('resize'));
    }
  });
});
