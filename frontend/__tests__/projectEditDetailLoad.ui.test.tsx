import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { ProcedureTemplate, Project } from '../types';

const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchContractsMock = vi.hoisted(() => vi.fn());
const fetchPaymentSchedulesMock = vi.hoisted(() => vi.fn());
const fetchProjectsMock = vi.hoisted(() => vi.fn());
const fetchProjectItemsMock = vi.hoisted(() => vi.fn());
const fetchCustomersMock = vi.hoisted(() => vi.fn());
const fetchProjectDetailMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const updateProjectMock = vi.hoisted(() => vi.fn());
const registerTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const unregisterTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());

fetchProcedureTemplatesMock.mockResolvedValue([
  {
    id: 1,
    template_code: 'DAU_TU',
    template_name: 'Đầu tư',
    is_active: true,
    phases: ['CHUAN_BI', 'THUC_HIEN_DAU_TU'],
  },
] as ProcedureTemplate[]);

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
  AppPages: ({ handleOpenModal }: { handleOpenModal: (type: string, item?: unknown) => void }) => (
    <>
      <button
        type="button"
        onClick={() =>
          handleOpenModal('EDIT_PROJECT', {
            id: 7,
            project_code: 'DA007',
            project_name: 'Dự án summary',
            customer_id: 1,
            status: 'CHUAN_BI',
            investment_mode: 'DAU_TU',
          })
        }
      >
        Mở sửa dự án
      </button>
      <button
        type="button"
        onClick={() => handleOpenModal('ADD_PROJECT')}
      >
        Mở thêm dự án
      </button>
      <button
        type="button"
        onClick={() =>
          handleOpenModal('ADD_PROJECT', {
            id: 7,
            project_code: 'DA007',
            project_name: 'Dự án summary copy',
            customer_id: 1,
            status: 'CHUAN_BI',
            investment_mode: 'DAU_TU',
          })
        }
      >
        Mở copy dự án
      </button>
    </>
  ),
}));

vi.mock('../components/modals/index', () => ({
  ProjectFormModal: ({ data, onSave }: { data?: Project | null; onSave?: (payload: Partial<Project>) => void | Promise<void> }) => (
    <div data-testid="project-form-modal">
      <div data-testid="project-name">{data?.project_name ?? ''}</div>
      <div data-testid="project-items-count">{data?.items?.length ?? 0}</div>
      <div data-testid="project-raci-count">{data?.raci?.length ?? 0}</div>
      <button
        type="button"
        onClick={() => onSave?.({
          ...data,
          project_name: 'Dự án đã cập nhật và vẫn mở modal',
        })}
      >
        Lưu project mock
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

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');

  return {
    ...actual,
    fetchAuthBootstrap: fetchAuthBootstrapMock,
    fetchContracts: fetchContractsMock,
    fetchPaymentSchedules: fetchPaymentSchedulesMock,
    fetchProjects: fetchProjectsMock,
    fetchProjectItems: fetchProjectItemsMock,
    fetchCustomers: fetchCustomersMock,
    fetchProjectDetail: fetchProjectDetailMock,
    createProject: createProjectMock,
    updateProject: updateProjectMock,
    fetchProcedureTemplates: fetchProcedureTemplatesMock,
    registerTabEvictedHandler: registerTabEvictedHandlerMock,
    unregisterTabEvictedHandler: unregisterTabEvictedHandlerMock,
  };
});

describe('Project edit detail loading', () => {
  beforeEach(() => {
    fetchAuthBootstrapMock.mockReset();
    fetchContractsMock.mockReset();
    fetchPaymentSchedulesMock.mockReset();
    fetchProjectsMock.mockReset();
    fetchProjectItemsMock.mockReset();
    fetchCustomersMock.mockReset();
    fetchProjectDetailMock.mockReset();
    createProjectMock.mockReset();
    updateProjectMock.mockReset();
    fetchProcedureTemplatesMock.mockClear();
    registerTabEvictedHandlerMock.mockClear();
    unregisterTabEvictedHandlerMock.mockClear();
  });

  const renderApp = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('loads project detail before rendering the edit modal so items and raci are preserved', async () => {
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
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchProjectDetailMock.mockResolvedValue({
      id: 7,
      project_code: 'DA007',
      project_name: 'Dự án đã hydrate detail',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [
        {
          id: 'ITEM_1',
          productId: '11',
          product_id: 11,
          quantity: 1,
          unitPrice: 10000000,
          unit_price: 10000000,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 10000000,
          line_total: 10000000,
        },
      ],
      raci: [
        {
          id: 'RACI_1',
          userId: '22',
          user_id: 22,
          roleType: 'R',
          raci_role: 'R',
          assignedDate: '28/03/2026',
        },
      ],
    } satisfies Partial<Project>);

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Mở sửa dự án' }));

    await waitFor(() => {
      expect(fetchProjectDetailMock).toHaveBeenCalledWith(7);
    });

    expect(await screen.findByTestId('project-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Dự án đã hydrate detail');
    expect(screen.getByTestId('project-items-count')).toHaveTextContent('1');
    expect(screen.getByTestId('project-raci-count')).toHaveTextContent('1');
  });

  it('does not show generic load-failed toast when the tab session has been evicted', async () => {
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
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchProjectDetailMock.mockRejectedValue(new Error('TAB_EVICTED'));

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Mở sửa dự án' }));

    await waitFor(() => {
      expect(fetchProjectDetailMock).toHaveBeenCalledWith(7);
    });

    expect(screen.queryByText('Tải dữ liệu thất bại')).not.toBeInTheDocument();
    expect(screen.queryByText('TAB_EVICTED')).not.toBeInTheDocument();
  });

  it('opens add-project as copy flow with project code reset and detail-prefilled items/raci', async () => {
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
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchProjectDetailMock.mockResolvedValue({
      id: 7,
      project_code: 'DA007',
      project_name: 'Dự án copy theo detail',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [
        {
          id: 'ITEM_1',
          productId: '11',
          product_id: 11,
          quantity: 1,
          unitPrice: 10000000,
          unit_price: 10000000,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 10000000,
          line_total: 10000000,
        },
      ],
      raci: [
        {
          id: 'RACI_1',
          userId: '22',
          user_id: 22,
          roleType: 'R',
          raci_role: 'R',
          assignedDate: '28/03/2026',
        },
      ],
    } satisfies Partial<Project>);
    createProjectMock.mockResolvedValue({
      id: 8,
      project_code: 'DA008',
      project_name: 'Dự án đã cập nhật và vẫn mở modal',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [],
      raci: [],
    } satisfies Partial<Project>);

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Mở copy dự án' }));

    await waitFor(() => {
      expect(fetchProjectDetailMock).toHaveBeenCalledWith(7);
    });

    expect(await screen.findByTestId('project-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Dự án copy theo detail');
    expect(screen.getByTestId('project-items-count')).toHaveTextContent('1');
    expect(screen.getByTestId('project-raci-count')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Lưu project mock' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          project_code: '',
          project_name: 'Dự án đã cập nhật và vẫn mở modal',
          sync_items: true,
          sync_raci: true,
        })
      );
    });

    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Tạo dự án thành công.')).toBeInTheDocument();
  });

  it('keeps the add modal open after a successful project create by switching into edit mode', async () => {
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
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    createProjectMock.mockResolvedValue({
      id: 8,
      project_code: 'DA008',
      project_name: 'Dự án đã cập nhật và vẫn mở modal',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [],
      raci: [],
    } satisfies Partial<Project>);

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Mở thêm dự án' }));

    expect(await screen.findByTestId('project-form-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu project mock' }));

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          project_name: 'Dự án đã cập nhật và vẫn mở modal',
          sync_items: false,
          sync_raci: false,
        })
      );
    });

    expect(screen.getByTestId('project-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Dự án đã cập nhật và vẫn mở modal');
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Tạo dự án thành công.')).toBeInTheDocument();
  });
  it('keeps the edit modal open after a successful project update so tab work can continue', async () => {
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
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchProjectDetailMock.mockResolvedValue({
      id: 7,
      project_code: 'DA007',
      project_name: 'Dự án đang sửa',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [
        {
          id: 'ITEM_1',
          productId: '11',
          product_id: 11,
          quantity: 1,
          unitPrice: 10000000,
          unit_price: 10000000,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 10000000,
          line_total: 10000000,
        },
      ],
      raci: [
        {
          id: 'RACI_1',
          userId: '22',
          user_id: 22,
          roleType: 'R',
          raci_role: 'R',
          assignedDate: '28/03/2026',
        },
      ],
    } satisfies Partial<Project>);
    updateProjectMock.mockResolvedValue({
      id: 7,
      project_code: 'DA007',
      project_name: 'Dự án đã cập nhật và vẫn mở modal',
      customer_id: 1,
      status: 'CHUAN_BI',
      investment_mode: 'DAU_TU',
      items: [
        {
          id: 'ITEM_1',
          productId: '11',
          product_id: 11,
          quantity: 1,
          unitPrice: 10000000,
          unit_price: 10000000,
          discountPercent: 0,
          discountAmount: 0,
          lineTotal: 10000000,
          line_total: 10000000,
        },
      ],
      raci: [
        {
          id: 'RACI_1',
          userId: '22',
          user_id: 22,
          roleType: 'R',
          raci_role: 'R',
          assignedDate: '28/03/2026',
        },
      ],
    } satisfies Partial<Project>);

    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Mở sửa dự án' }));

    expect(await screen.findByTestId('project-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Dự án đang sửa');

    await user.click(screen.getByRole('button', { name: 'Lưu project mock' }));

    await waitFor(() => {
      expect(updateProjectMock).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          project_name: 'Dự án đã cập nhật và vẫn mở modal',
          sync_items: true,
          sync_raci: true,
        })
      );
    });

    expect(screen.getByTestId('project-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Dự án đã cập nhật và vẫn mở modal');
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật dự án thành công.')).toBeInTheDocument();
  });
});
