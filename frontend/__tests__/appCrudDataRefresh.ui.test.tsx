import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { PaginationMeta } from '../types';

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchContractsMock = vi.hoisted(() => vi.fn());
const fetchPaymentSchedulesMock = vi.hoisted(() => vi.fn());
const fetchProjectsMock = vi.hoisted(() => vi.fn());
const fetchCustomersMock = vi.hoisted(() => vi.fn());
const fetchDepartmentsMock = vi.hoisted(() => vi.fn());
const fetchEmployeesMock = vi.hoisted(() => vi.fn());
const fetchEmployeesPageMock = vi.hoisted(() => vi.fn());
const fetchEmployeePartyProfilesPageMock = vi.hoisted(() => vi.fn());
const fetchBusinessesMock = vi.hoisted(() => vi.fn());
const fetchVendorsMock = vi.hoisted(() => vi.fn());
const fetchProductsMock = vi.hoisted(() => vi.fn());
const fetchProductPackagesMock = vi.hoisted(() => vi.fn());
const fetchProjectsPageMock = vi.hoisted(() => vi.fn());
const fetchProjectItemsMock = vi.hoisted(() => vi.fn());
const fetchContractsPageMock = vi.hoisted(() => vi.fn());
const fetchContractDetailMock = vi.hoisted(() => vi.fn());
const fetchDocumentsMock = vi.hoisted(() => vi.fn());
const fetchDocumentsPageMock = vi.hoisted(() => vi.fn());
const fetchUserDeptHistoryMock = vi.hoisted(() => vi.fn());
const fetchFeedbacksPageMock = vi.hoisted(() => vi.fn());
const fetchSupportServiceGroupsMock = vi.hoisted(() => vi.fn());
const fetchSupportContactPositionsMock = vi.hoisted(() => vi.fn());
const fetchProductUnitMastersMock = vi.hoisted(() => vi.fn());
const fetchContractSignerMastersMock = vi.hoisted(() => vi.fn());
const fetchSupportRequestStatusesMock = vi.hoisted(() => vi.fn());
const fetchWorklogActivityTypesMock = vi.hoisted(() => vi.fn());
const fetchSupportSlaConfigsMock = vi.hoisted(() => vi.fn());
const fetchProjectTypesMock = vi.hoisted(() => vi.fn());
const createDepartmentMock = vi.hoisted(() => vi.fn());
const deleteDepartmentMock = vi.hoisted(() => vi.fn());
const createEmployeeWithProvisioningMock = vi.hoisted(() => vi.fn());
const deleteEmployeeMock = vi.hoisted(() => vi.fn());
const upsertEmployeePartyProfileMock = vi.hoisted(() => vi.fn());
const createBusinessMock = vi.hoisted(() => vi.fn());
const deleteBusinessMock = vi.hoisted(() => vi.fn());
const createVendorMock = vi.hoisted(() => vi.fn());
const deleteVendorMock = vi.hoisted(() => vi.fn());
const createProductMock = vi.hoisted(() => vi.fn());
const deleteProductMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const deleteProjectMock = vi.hoisted(() => vi.fn());
const createContractMock = vi.hoisted(() => vi.fn());
const deleteContractMock = vi.hoisted(() => vi.fn());
const generateContractPaymentsMock = vi.hoisted(() => vi.fn());
const updatePaymentScheduleMock = vi.hoisted(() => vi.fn());
const deletePaymentScheduleMock = vi.hoisted(() => vi.fn());
const createDocumentMock = vi.hoisted(() => vi.fn());
const deleteDocumentMock = vi.hoisted(() => vi.fn());
const createUserDeptHistoryMock = vi.hoisted(() => vi.fn());
const updateUserDeptHistoryMock = vi.hoisted(() => vi.fn());
const deleteUserDeptHistoryMock = vi.hoisted(() => vi.fn());
const createFeedbackMock = vi.hoisted(() => vi.fn());
const deleteFeedbackMock = vi.hoisted(() => vi.fn());
const registerTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const unregisterTabEvictedHandlerMock = vi.hoisted(() => vi.fn());

const existingDepartment = vi.hoisted(() => ({ id: 'dept-1', dept_code: 'KD', dept_name: 'Kinh doanh' }));
const existingEmployee = vi.hoisted(() => ({
  id: 'emp-1',
  user_code: 'NV001',
  employee_code: 'NV001',
  username: 'nguyenvana',
  full_name: 'Nguyễn Văn A',
  department_id: 'dept-1',
}));
const existingPartyProfile = vi.hoisted(() => ({ id: 'party-1', employee_id: 'emp-1', party_card_number: '093066006328', employee: existingEmployee }));
const existingBusiness = vi.hoisted(() => ({ id: 'biz-1', domain_code: 'YT', domain_name: 'Y tế' }));
const existingVendor = vi.hoisted(() => ({ id: 'vendor-1', vendor_code: 'VNPT', vendor_name: 'VNPT' }));
const existingProduct = vi.hoisted(() => ({ id: 'product-1', product_code: 'SP001', product_name: 'HIS', service_group: 'CORE_SERVICE' }));
const existingProject = vi.hoisted(() => ({ id: 'project-1', project_code: 'DA001', project_name: 'Triển khai HIS' }));
const existingContract = vi.hoisted(() => ({ id: 'contract-1', contract_code: 'HD001', contract_name: 'Hợp đồng HIS' }));
const existingDocument = vi.hoisted(() => ({ id: 'doc-1', name: 'Biên bản', status: 'ACTIVE' }));
const existingUserDeptHistory = vi.hoisted(() => ({
  id: 'history-1',
  userId: 'emp-1',
  fromDeptId: 'dept-1',
  toDeptId: 'dept-2',
  transferDate: '2026-04-05',
  reason: 'Điều chuyển thử',
}));
const existingFeedback = vi.hoisted(() => ({ id: 'fb-1', title: 'Góp ý', priority: 'MEDIUM' }));

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

vi.mock('../AppPages', async () => {
  const { useLocation, useNavigate } = await import('react-router-dom');

  return {
    AppPages: ({
      activeTab,
      handleOpenModal,
    }: {
      activeTab: string;
      handleOpenModal: (type: string, item?: unknown) => void;
    }) => {
      const location = useLocation();
      const navigate = useNavigate();

      return (
        <div>
          <div data-testid="app-active-tab">{activeTab}</div>
          <div data-testid="app-location-path">{location.pathname}</div>
          <button type="button" onClick={() => navigate('/products/quote')}>Mở tab báo giá sản phẩm</button>
          <button type="button" onClick={() => handleOpenModal('ADD_DEPARTMENT')}>Mở thêm phòng ban</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_DEPARTMENT', existingDepartment)}>Mở xóa phòng ban</button>
          <button type="button" onClick={() => handleOpenModal('ADD_EMPLOYEE')}>Mở thêm nhân sự</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_EMPLOYEE', existingEmployee)}>Mở xóa nhân sự</button>
          <button type="button" onClick={() => handleOpenModal('ADD_PARTY_PROFILE')}>Mở thêm hồ sơ đảng viên</button>
          <button type="button" onClick={() => handleOpenModal('ADD_BUSINESS')}>Mở thêm lĩnh vực</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_BUSINESS', existingBusiness)}>Mở xóa lĩnh vực</button>
          <button type="button" onClick={() => handleOpenModal('ADD_VENDOR')}>Mở thêm nhà cung cấp</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_VENDOR', existingVendor)}>Mở xóa nhà cung cấp</button>
          <button type="button" onClick={() => handleOpenModal('ADD_PRODUCT')}>Mở thêm sản phẩm</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_PRODUCT', existingProduct)}>Mở xóa sản phẩm</button>
          <button type="button" onClick={() => handleOpenModal('ADD_PROJECT')}>Mở thêm dự án</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_PROJECT', existingProject)}>Mở xóa dự án</button>
          <button type="button" onClick={() => handleOpenModal('ADD_CONTRACT')}>Mở thêm hợp đồng</button>
          <button type="button" onClick={() => handleOpenModal('EDIT_CONTRACT', existingContract)}>Mở sửa hợp đồng</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_CONTRACT', existingContract)}>Mở xóa hợp đồng</button>
          <button type="button" onClick={() => handleOpenModal('ADD_DOCUMENT')}>Mở thêm tài liệu</button>
          <button type="button" onClick={() => handleOpenModal('UPLOAD_PRODUCT_DOCUMENT', existingProduct)}>Mở upload tài liệu sản phẩm</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_DOCUMENT', existingDocument)}>Mở xóa tài liệu</button>
          <button type="button" onClick={() => handleOpenModal('ADD_USER_DEPT_HISTORY')}>Mở thêm luân chuyển</button>
          <button type="button" onClick={() => handleOpenModal('ADD_USER_DEPT_HISTORY', existingEmployee)}>Mở thêm luân chuyển từ nhân sự</button>
          <button type="button" onClick={() => handleOpenModal('EDIT_USER_DEPT_HISTORY', existingUserDeptHistory)}>Mở sửa luân chuyển</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_USER_DEPT_HISTORY', existingUserDeptHistory)}>Mở xóa luân chuyển</button>
          <button type="button" onClick={() => handleOpenModal('ADD_FEEDBACK')}>Mở thêm góp ý</button>
          <button type="button" onClick={() => handleOpenModal('DELETE_FEEDBACK', existingFeedback)}>Mở xóa góp ý</button>
        </div>
      );
    },
  };
});

vi.mock('../components/ContractModal', () => ({
  ContractModal: ({
    type,
    data,
    paymentSchedules,
    isPaymentLoading,
    onSave,
    onGenerateSchedules,
    onDeletePaymentSchedule,
  }: {
    type: 'ADD' | 'EDIT';
    data?: { id?: string | number } | null;
    paymentSchedules?: Array<{ id: string | number }>;
    isPaymentLoading?: boolean;
    onSave?: (payload: Record<string, unknown>) => void | Promise<void>;
    onGenerateSchedules?: (contractId: string | number) => void | Promise<void>;
    onDeletePaymentSchedule?: (scheduleId: string | number) => void | Promise<void>;
  }) => (
    <div data-testid={`contract-modal-${String(type).toLowerCase()}`}>
      <div data-testid="contract-payment-schedule-count">{String(paymentSchedules?.length || 0)}</div>
      <div data-testid="contract-payment-loading-flag">{String(Boolean(isPaymentLoading))}</div>
      <button type="button" onClick={() => onSave?.({ contract_code: 'HD002', contract_name: 'Hợp đồng mới' })}>
        Lưu hợp đồng mock
      </button>
      {type === 'EDIT' && data?.id ? (
        <button type="button" onClick={() => onGenerateSchedules?.(data.id!)}>
          Sinh kỳ thanh toán mock
        </button>
      ) : null}
      {type === 'EDIT' && (paymentSchedules?.length || 0) > 0 ? (
        <button type="button" onClick={() => onDeletePaymentSchedule?.(paymentSchedules?.[0]?.id || 'schedule-1')}>
          Xóa kỳ thanh toán mock
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../components/EmployeePartyProfileModal', () => ({
  EmployeePartyProfileModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <div data-testid="employee-party-profile-modal">
      <button type="button" onClick={() => onSave?.({ employee_id: 'emp-1', party_card_number: '093066006328' })}>
        Lưu hồ sơ đảng viên mock
      </button>
    </div>
  ),
}));

vi.mock('../components/modals', () => ({
  DepartmentFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ dept_code: 'KD', dept_name: 'Kinh doanh' })}>Lưu phòng ban mock</button>
  ),
  DeleteWarningModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa phòng ban mock</button>
  ),
  EmployeeFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ user_code: 'NV002', full_name: 'Nhân sự mới' })}>Lưu nhân sự mock</button>
  ),
  DeleteEmployeeModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa nhân sự mock</button>
  ),
  BusinessFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ domain_code: 'YT', domain_name: 'Y tế' })}>Lưu lĩnh vực mock</button>
  ),
  DeleteBusinessModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa lĩnh vực mock</button>
  ),
  VendorFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ vendor_code: 'VNPT', vendor_name: 'VNPT' })}>Lưu nhà cung cấp mock</button>
  ),
  DeleteVendorModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa nhà cung cấp mock</button>
  ),
  ProductFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ product_code: 'SP002', product_name: 'Sản phẩm mới', service_group: 'CORE_SERVICE' })}>Lưu sản phẩm mock</button>
  ),
  DeleteProductModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa sản phẩm mock</button>
  ),
  CannotDeleteProductModal: ({ reason }: { reason?: string | null }) => (
    <div data-testid="cannot-delete-product-modal">{reason || 'Không thể xóa sản phẩm'}</div>
  ),
  FeedbackFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ title: 'Góp ý mới', priority: 'MEDIUM' })}>Lưu góp ý mock</button>
  ),
  DeleteFeedbackModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa góp ý mock</button>
  ),
  ProjectFormModal: ({ onSave }: { onSave?: (payload: Record<string, unknown>) => void | Promise<void> }) => (
    <button type="button" onClick={() => onSave?.({ project_code: 'DA002', project_name: 'Dự án mới' })}>Lưu dự án mock</button>
  ),
  DeleteProjectModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa dự án mock</button>
  ),
  DeleteContractModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa hợp đồng mock</button>
  ),
  DocumentFormModal: ({
    onSave,
    mode,
    preselectedProduct,
  }: {
    onSave?: (payload: Record<string, unknown>) => void | Promise<void>;
    mode?: 'default' | 'product_upload';
    preselectedProduct?: { product_code?: string } | null;
  }) => (
    <div data-testid={mode === 'product_upload' ? 'product-upload-document-modal' : 'document-form-modal'}>
      {mode === 'product_upload' ? <span>{`Upload tài liệu sản phẩm ${preselectedProduct?.product_code ?? ''}`}</span> : null}
      <button
        type="button"
        onClick={() => onSave?.(
          mode === 'product_upload'
            ? { id: 'VB-01', name: 'Quyết định giá', productIds: ['product-1'], scope: 'PRODUCT_PRICING', status: 'ACTIVE' }
            : { name: 'Tài liệu mới', status: 'ACTIVE' }
        )}
      >
        {mode === 'product_upload' ? 'Lưu upload tài liệu sản phẩm mock' : 'Lưu tài liệu mock'}
      </button>
    </div>
  ),
  DeleteDocumentModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa tài liệu mock</button>
  ),
  UserDeptHistoryFormModal: ({
    type,
    data,
    onSave,
  }: {
    type: 'ADD' | 'EDIT';
    data?: { userId?: string; fromDeptId?: string } | null;
    onSave?: (payload: Record<string, unknown>) => void | Promise<void>;
  }) => (
    <div data-testid={`user-dept-history-${type.toLowerCase()}-modal`}>
      <div data-testid="user-dept-history-modal-user">{String(data?.userId ?? '')}</div>
      <div data-testid="user-dept-history-modal-from-dept">{String(data?.fromDeptId ?? '')}</div>
      <button
        type="button"
        onClick={() => onSave?.(
          type === 'ADD'
            ? {
                userId: 'emp-1',
                fromDeptId: 'dept-1',
                toDeptId: 'dept-2',
                transferDate: '2026-04-06',
                reason: 'Luân chuyển mới',
              }
            : {
                userId: 'emp-1',
                fromDeptId: 'dept-1',
                toDeptId: 'dept-3',
                transferDate: '2026-04-07',
                reason: 'Cập nhật luân chuyển',
              }
        )}
      >
        {type === 'ADD' ? 'Lưu luân chuyển mock' : 'Cập nhật luân chuyển mock'}
      </button>
    </div>
  ),
  DeleteUserDeptHistoryModal: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => (
    <button type="button" onClick={() => onConfirm?.()}>Xóa luân chuyển mock</button>
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

vi.mock('../hooks/useImportCustomerPersonnel', () => ({
  useImportCustomerPersonnel: () => ({ handleImportCustomerPersonnel: vi.fn() }),
}));

vi.mock('../hooks/useImportProducts', () => ({
  useImportProducts: () => ({ handleImportProducts: vi.fn() }),
}));

vi.mock('../hooks/useImportProductPackages', () => ({
  useImportProductPackages: () => ({ handleImportProductPackages: vi.fn() }),
}));

vi.mock('../hooks/useCustomerPersonnel', () => ({
  useCustomerPersonnel: () => ({
    customerPersonnel: [],
    loadCustomerPersonnel: vi.fn(),
    handleSaveCusPersonnel: vi.fn(),
    handleDeleteCusPersonnel: vi.fn(),
  }),
}));

vi.mock('../services/api/adminApi', () => ({
  fetchFeedbackDetail: vi.fn(),
}));

vi.mock('../services/api/employeeApi', () => ({
  fetchEmployeePartyProfilesPage: fetchEmployeePartyProfilesPageMock,
  upsertEmployeePartyProfile: upsertEmployeePartyProfileMock,
}));

vi.mock('../services/api/productApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/productApi')>('../services/api/productApi');

  return {
    ...actual,
    fetchProductPackages: fetchProductPackagesMock,
  };
});

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');

  return {
    ...actual,
    fetchAuthBootstrap: fetchAuthBootstrapMock,
    fetchContracts: fetchContractsMock,
    fetchPaymentSchedules: fetchPaymentSchedulesMock,
    fetchProjects: fetchProjectsMock,
    fetchCustomers: fetchCustomersMock,
    fetchDepartments: fetchDepartmentsMock,
    fetchEmployees: fetchEmployeesMock,
    fetchEmployeesPage: fetchEmployeesPageMock,
    fetchBusinesses: fetchBusinessesMock,
    fetchVendors: fetchVendorsMock,
    fetchProducts: fetchProductsMock,
    fetchSupportServiceGroups: fetchSupportServiceGroupsMock,
    fetchSupportContactPositions: fetchSupportContactPositionsMock,
    fetchProductUnitMasters: fetchProductUnitMastersMock,
    fetchContractSignerMasters: fetchContractSignerMastersMock,
    fetchSupportRequestStatuses: fetchSupportRequestStatusesMock,
    fetchWorklogActivityTypes: fetchWorklogActivityTypesMock,
    fetchSupportSlaConfigs: fetchSupportSlaConfigsMock,
    fetchProjectTypes: fetchProjectTypesMock,
    fetchProjectsPage: fetchProjectsPageMock,
    fetchProjectItems: fetchProjectItemsMock,
    fetchContractsPage: fetchContractsPageMock,
    fetchContractDetail: fetchContractDetailMock,
    fetchDocuments: fetchDocumentsMock,
    fetchDocumentsPage: fetchDocumentsPageMock,
    fetchUserDeptHistory: fetchUserDeptHistoryMock,
    fetchFeedbacksPage: fetchFeedbacksPageMock,
    createDepartment: createDepartmentMock,
    deleteDepartment: deleteDepartmentMock,
    createEmployeeWithProvisioning: createEmployeeWithProvisioningMock,
    deleteEmployee: deleteEmployeeMock,
    createBusiness: createBusinessMock,
    deleteBusiness: deleteBusinessMock,
    createVendor: createVendorMock,
    deleteVendor: deleteVendorMock,
    createProduct: createProductMock,
    deleteProduct: deleteProductMock,
    createProject: createProjectMock,
    deleteProject: deleteProjectMock,
    createContract: createContractMock,
    generateContractPayments: generateContractPaymentsMock,
    updatePaymentSchedule: updatePaymentScheduleMock,
    deletePaymentSchedule: deletePaymentScheduleMock,
    deleteContract: deleteContractMock,
    createDocument: createDocumentMock,
    deleteDocument: deleteDocumentMock,
    createUserDeptHistory: createUserDeptHistoryMock,
    updateUserDeptHistory: updateUserDeptHistoryMock,
    deleteUserDeptHistory: deleteUserDeptHistoryMock,
    createFeedback: createFeedbackMock,
    deleteFeedback: deleteFeedbackMock,
    registerTabEvictedHandler: registerTabEvictedHandlerMock,
    unregisterTabEvictedHandler: unregisterTabEvictedHandlerMock,
  };
});

const paginationMeta: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 1,
};

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
    </QueryClientProvider>,
  );
};

describe('App CRUD data refresh audit', () => {
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
    fetchContractDetailMock.mockResolvedValue(existingContract);
    fetchPaymentSchedulesMock.mockResolvedValue([]);
    generateContractPaymentsMock.mockResolvedValue({ data: [], generated_data: [], meta: { generated_count: 0, allocation_mode: 'EVEN' } });
    updatePaymentScheduleMock.mockResolvedValue({});
    deletePaymentScheduleMock.mockResolvedValue(undefined);
    fetchProjectsMock.mockResolvedValue([]);
    fetchCustomersMock.mockResolvedValue([]);
    fetchDepartmentsMock.mockResolvedValue([]);
    fetchEmployeesMock.mockResolvedValue([]);
    fetchEmployeesPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchEmployeePartyProfilesPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchBusinessesMock.mockResolvedValue([]);
    fetchVendorsMock.mockResolvedValue([]);
    fetchProductsMock.mockResolvedValue([]);
    fetchProductPackagesMock.mockResolvedValue([]);
    fetchProjectsPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchProjectItemsMock.mockResolvedValue([]);
    fetchContractsPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchDocumentsMock.mockResolvedValue([]);
    fetchDocumentsPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchUserDeptHistoryMock.mockResolvedValue([]);
    fetchFeedbacksPageMock.mockResolvedValue({ data: [], meta: paginationMeta });
    fetchSupportServiceGroupsMock.mockResolvedValue([]);
    fetchSupportContactPositionsMock.mockResolvedValue([]);
    fetchProductUnitMastersMock.mockResolvedValue([]);
    fetchContractSignerMastersMock.mockResolvedValue([]);
    fetchSupportRequestStatusesMock.mockResolvedValue([]);
    fetchWorklogActivityTypesMock.mockResolvedValue([]);
    fetchSupportSlaConfigsMock.mockResolvedValue([]);
    fetchProjectTypesMock.mockResolvedValue([]);

    createDepartmentMock.mockResolvedValue(existingDepartment);
    deleteDepartmentMock.mockResolvedValue(undefined);
    createEmployeeWithProvisioningMock.mockResolvedValue({
      employee: existingEmployee,
      provisioning: null,
    });
    deleteEmployeeMock.mockResolvedValue(undefined);
    upsertEmployeePartyProfileMock.mockResolvedValue(existingPartyProfile);
    createBusinessMock.mockResolvedValue(existingBusiness);
    deleteBusinessMock.mockResolvedValue(undefined);
    createVendorMock.mockResolvedValue(existingVendor);
    deleteVendorMock.mockResolvedValue(undefined);
    createProductMock.mockResolvedValue(existingProduct);
    deleteProductMock.mockResolvedValue(undefined);
    createProjectMock.mockResolvedValue(existingProject);
    deleteProjectMock.mockResolvedValue(undefined);
    createContractMock.mockResolvedValue(existingContract);
    deleteContractMock.mockResolvedValue(undefined);
    createDocumentMock.mockResolvedValue(existingDocument);
    deleteDocumentMock.mockResolvedValue(undefined);
    createUserDeptHistoryMock.mockResolvedValue(existingUserDeptHistory);
    updateUserDeptHistoryMock.mockResolvedValue(existingUserDeptHistory);
    deleteUserDeptHistoryMock.mockResolvedValue(undefined);
    createFeedbackMock.mockResolvedValue(existingFeedback);
    deleteFeedbackMock.mockResolvedValue(undefined);
  });

  it('reloads departments and employees immediately after department CRUD', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm phòng ban' });

    const initialDepartmentCalls = fetchDepartmentsMock.mock.calls.length;
    const initialEmployeeCalls = fetchEmployeesMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm phòng ban' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu phòng ban mock' }));

    await waitFor(() => {
      expect(createDepartmentMock).toHaveBeenCalledTimes(1);
      expect(fetchDepartmentsMock.mock.calls.length).toBeGreaterThan(initialDepartmentCalls);
      expect(fetchEmployeesMock.mock.calls.length).toBeGreaterThan(initialEmployeeCalls);
    });

    const afterCreateDepartmentCalls = fetchDepartmentsMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa phòng ban' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa phòng ban mock' }));

    await waitFor(() => {
      expect(deleteDepartmentMock).toHaveBeenCalledWith('dept-1');
      expect(fetchDepartmentsMock.mock.calls.length).toBeGreaterThan(afterCreateDepartmentCalls);
    });
  });

  it('reloads the employee datasets immediately after employee CRUD', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm nhân sự' });

    const initialEmployeeListCalls = fetchEmployeesMock.mock.calls.length;
    const initialEmployeePageCalls = fetchEmployeesPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm nhân sự' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu nhân sự mock' }));

    await waitFor(() => {
      expect(createEmployeeWithProvisioningMock).toHaveBeenCalledTimes(1);
      expect(fetchEmployeesMock.mock.calls.length).toBeGreaterThan(initialEmployeeListCalls);
      expect(fetchEmployeesPageMock.mock.calls.length).toBeGreaterThan(initialEmployeePageCalls);
    });

    const afterCreatePageCalls = fetchEmployeesPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa nhân sự' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa nhân sự mock' }));

    await waitFor(() => {
      expect(deleteEmployeeMock).toHaveBeenCalledWith('emp-1');
      expect(fetchEmployeesPageMock.mock.calls.length).toBeGreaterThan(afterCreatePageCalls);
    });
  });

  it('reloads business, vendor and product lists immediately after CRUD', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm lĩnh vực' });

    const initialBusinessCalls = fetchBusinessesMock.mock.calls.length;
    const initialVendorCalls = fetchVendorsMock.mock.calls.length;
    const initialProductCalls = fetchProductsMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm lĩnh vực' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu lĩnh vực mock' }));
    await waitFor(() => expect(fetchBusinessesMock.mock.calls.length).toBeGreaterThan(initialBusinessCalls));

    await user.click(screen.getByRole('button', { name: 'Mở thêm nhà cung cấp' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu nhà cung cấp mock' }));
    await waitFor(() => expect(fetchVendorsMock.mock.calls.length).toBeGreaterThan(initialVendorCalls));

    await user.click(screen.getByRole('button', { name: 'Mở thêm sản phẩm' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu sản phẩm mock' }));
    await waitFor(() => expect(fetchProductsMock.mock.calls.length).toBeGreaterThan(initialProductCalls));

    const afterCreateProductCalls = fetchProductsMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa sản phẩm' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa sản phẩm mock' }));

    await waitFor(() => {
      expect(deleteProductMock).toHaveBeenCalledWith('product-1');
      expect(fetchProductsMock.mock.calls.length).toBeGreaterThan(afterCreateProductCalls);
    });
  });

  it('shows the product blocker modal when delete is rejected by references', async () => {
    const user = userEvent.setup();
    deleteProductMock.mockRejectedValueOnce(new Error('Sản phẩm đang phát sinh ở dữ liệu khác. Vui lòng xóa bản ghi tham chiếu trước khi xóa sản phẩm.'));

    renderApp();

    await screen.findByRole('button', { name: 'Mở xóa sản phẩm' });

    await user.click(screen.getByRole('button', { name: 'Mở xóa sản phẩm' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa sản phẩm mock' }));

    await waitFor(() => {
      expect(deleteProductMock).toHaveBeenCalledWith('product-1');
      expect(screen.getByTestId('cannot-delete-product-modal')).toHaveTextContent('Sản phẩm đang phát sinh ở dữ liệu khác');
    });
  });

  it('reloads paginated project, document and feedback views immediately after CRUD', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm dự án' });

    const initialProjectPageCalls = fetchProjectsPageMock.mock.calls.length;
    const initialProjectItemCalls = fetchProjectItemsMock.mock.calls.length;
    const initialDocumentPageCalls = fetchDocumentsPageMock.mock.calls.length;
    const initialFeedbackPageCalls = fetchFeedbacksPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm dự án' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu dự án mock' }));
    await waitFor(() => {
      expect(fetchProjectsPageMock.mock.calls.length).toBeGreaterThan(initialProjectPageCalls);
      expect(fetchProjectItemsMock.mock.calls.length).toBeGreaterThan(initialProjectItemCalls);
    });

    const afterCreateProjectPageCalls = fetchProjectsPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa dự án' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa dự án mock' }));
    await waitFor(() => {
      expect(deleteProjectMock).toHaveBeenCalledWith('project-1');
      expect(fetchProjectsPageMock.mock.calls.length).toBeGreaterThan(afterCreateProjectPageCalls);
    });

    await user.click(screen.getByRole('button', { name: 'Mở thêm tài liệu' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu tài liệu mock' }));
    await waitFor(() => {
      expect(fetchDocumentsPageMock.mock.calls.length).toBeGreaterThan(initialDocumentPageCalls);
    });

    await user.click(screen.getByRole('button', { name: 'Mở thêm góp ý' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu góp ý mock' }));
    await waitFor(() => {
      expect(fetchFeedbacksPageMock.mock.calls.length).toBeGreaterThan(initialFeedbackPageCalls);
    });
  });

  it('shows an error toast when project delete is rejected', async () => {
    const user = userEvent.setup();
    deleteProjectMock.mockRejectedValueOnce(new Error('Không thể xóa dự án vì đang có dữ liệu liên quan.'));

    renderApp();

    await screen.findByRole('button', { name: 'Mở xóa dự án' });

    await user.click(screen.getByRole('button', { name: 'Mở xóa dự án' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa dự án mock' }));

    await waitFor(() => {
      expect(deleteProjectMock).toHaveBeenCalledWith('project-1');
      expect(screen.getByText('Xóa thất bại')).toBeInTheDocument();
      expect(screen.getByText('Không thể xóa dự án vì đang có dữ liệu liên quan.')).toBeInTheDocument();
    });
  });

  it('opens the product document upload modal and refreshes documents after saving', async () => {
    const user = userEvent.setup();
    renderApp(['/products']);

    await screen.findByRole('button', { name: 'Mở upload tài liệu sản phẩm' });

    const initialDocumentPageCalls = fetchDocumentsPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở upload tài liệu sản phẩm' }));

    expect(await screen.findByTestId('product-upload-document-modal')).toBeInTheDocument();
    expect(screen.getByText(/Upload tài liệu sản phẩm SP001/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu upload tài liệu sản phẩm mock' }));

    await waitFor(() => {
      expect(createDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
        id: 'VB-01',
        name: 'Quyết định giá',
        productIds: ['product-1'],
        scope: 'PRODUCT_PRICING',
      }));
      expect(fetchDocumentsPageMock.mock.calls.length).toBeGreaterThan(initialDocumentPageCalls);
    });

    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Đã lưu tài liệu minh chứng giá sản phẩm.')).toBeInTheDocument();
  });

  it('shows a toast and keeps the product upload modal open when saving fails', async () => {
    const user = userEvent.setup();
    createDocumentMock.mockRejectedValueOnce(new Error('Mã văn bản đã tồn tại.'));
    renderApp(['/products']);

    await screen.findByRole('button', { name: 'Mở upload tài liệu sản phẩm' });

    await user.click(screen.getByRole('button', { name: 'Mở upload tài liệu sản phẩm' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu upload tài liệu sản phẩm mock' }));

    await waitFor(() => {
      expect(screen.getByText('Lưu thất bại')).toBeInTheDocument();
      expect(screen.getByText('Không thể lưu hồ sơ tài liệu vào cơ sở dữ liệu. Mã văn bản đã tồn tại.')).toBeInTheDocument();
    });

    expect(screen.getByTestId('product-upload-document-modal')).toBeInTheDocument();
  });

  it('reloads transfer history datasets immediately after user department CRUD', async () => {
    const user = userEvent.setup();
    renderApp(['/user-dept-history']);

    await screen.findByRole('button', { name: 'Mở thêm luân chuyển' });

    const initialHistoryCalls = fetchUserDeptHistoryMock.mock.calls.length;
    const initialEmployeeCalls = fetchEmployeesMock.mock.calls.length;
    const initialDepartmentCalls = fetchDepartmentsMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm luân chuyển' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu luân chuyển mock' }));

    await waitFor(() => {
      expect(createUserDeptHistoryMock).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'emp-1',
        fromDeptId: 'dept-1',
        toDeptId: 'dept-2',
      }));
      expect(fetchUserDeptHistoryMock.mock.calls.length).toBeGreaterThan(initialHistoryCalls);
      expect(fetchEmployeesMock.mock.calls.length).toBeGreaterThan(initialEmployeeCalls);
      expect(fetchDepartmentsMock.mock.calls.length).toBeGreaterThan(initialDepartmentCalls);
    });

    const afterCreateHistoryCalls = fetchUserDeptHistoryMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở sửa luân chuyển' }));
    await user.click(await screen.findByRole('button', { name: 'Cập nhật luân chuyển mock' }));

    await waitFor(() => {
      expect(updateUserDeptHistoryMock).toHaveBeenCalledWith('history-1', expect.objectContaining({
        toDeptId: 'dept-3',
      }));
      expect(fetchUserDeptHistoryMock.mock.calls.length).toBeGreaterThan(afterCreateHistoryCalls);
    });

    const afterUpdateHistoryCalls = fetchUserDeptHistoryMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa luân chuyển' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa luân chuyển mock' }));

    await waitFor(() => {
      expect(deleteUserDeptHistoryMock).toHaveBeenCalledWith('history-1');
      expect(fetchUserDeptHistoryMock.mock.calls.length).toBeGreaterThan(afterUpdateHistoryCalls);
    });
  });

  it('shows a toast and keeps the delete transfer modal open when deletion is rejected', async () => {
    const user = userEvent.setup();
    deleteUserDeptHistoryMock.mockRejectedValueOnce(
      new Error('Chỉ người tạo dòng hoặc admin mới được xóa lịch sử luân chuyển này.')
    );

    renderApp(['/user-dept-history']);

    await screen.findByRole('button', { name: 'Mở xóa luân chuyển' });

    await user.click(screen.getByRole('button', { name: 'Mở xóa luân chuyển' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa luân chuyển mock' }));

    await waitFor(() => {
      expect(screen.getByText('Xóa thất bại')).toBeInTheDocument();
      expect(screen.getByText('Chỉ người tạo dòng hoặc admin mới được xóa lịch sử luân chuyển này.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Xóa luân chuyển mock' })).toBeInTheDocument();
  });

  it('opens a clean add-transfer modal and supports employee-prefill for user department history', async () => {
    const user = userEvent.setup();
    renderApp(['/user-dept-history']);

    await screen.findByRole('button', { name: 'Mở sửa luân chuyển' });

    await user.click(screen.getByRole('button', { name: 'Mở sửa luân chuyển' }));
    expect(await screen.findByTestId('user-dept-history-edit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('user-dept-history-modal-user')).toHaveTextContent('emp-1');
    expect(screen.getByTestId('user-dept-history-modal-from-dept')).toHaveTextContent('dept-1');

    await user.click(screen.getByRole('button', { name: 'Mở thêm luân chuyển' }));
    expect(await screen.findByTestId('user-dept-history-add-modal')).toBeInTheDocument();
    expect(screen.getByTestId('user-dept-history-modal-user')).toHaveTextContent('');
    expect(screen.getByTestId('user-dept-history-modal-from-dept')).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: 'Mở thêm luân chuyển từ nhân sự' }));
    expect(await screen.findByTestId('user-dept-history-add-modal')).toBeInTheDocument();
    expect(screen.getByTestId('user-dept-history-modal-user')).toHaveTextContent('emp-1');
    expect(screen.getByTestId('user-dept-history-modal-from-dept')).toHaveTextContent('dept-1');
  });

  it('reloads contracts, payment schedules and the paginated contract view immediately after contract CRUD', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm hợp đồng' });

    const initialContractCalls = fetchContractsMock.mock.calls.length;
    const initialPaymentCalls = fetchPaymentSchedulesMock.mock.calls.length;
    const initialContractPageCalls = fetchContractsPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm hợp đồng' }));
    expect(await screen.findByTestId('contract-modal-add')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Lưu hợp đồng mock' }));

    await waitFor(() => {
      expect(createContractMock).toHaveBeenCalledTimes(1);
      expect(fetchContractsMock.mock.calls.length).toBeGreaterThan(initialContractCalls);
      expect(fetchPaymentSchedulesMock.mock.calls.length).toBeGreaterThan(initialPaymentCalls);
      expect(fetchContractsPageMock.mock.calls.length).toBeGreaterThan(initialContractPageCalls);
      expect(screen.queryByTestId('contract-modal-add')).not.toBeInTheDocument();
      expect(screen.getByTestId('contract-modal-edit')).toBeInTheDocument();
    });

    const afterCreateContractPageCalls = fetchContractsPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở xóa hợp đồng' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa hợp đồng mock' }));

    await waitFor(() => {
      expect(deleteContractMock).toHaveBeenCalledWith('contract-1');
      expect(fetchContractsPageMock.mock.calls.length).toBeGreaterThan(afterCreateContractPageCalls);
    });
  });

  it('shows generated payment schedules in the contract modal immediately after generation', async () => {
    const user = userEvent.setup();
    renderApp();

    generateContractPaymentsMock.mockResolvedValue({
      data: [
        {
          id: 'schedule-1',
          contract_id: 'contract-1',
          milestone_name: 'Kỳ 1',
          cycle_number: 1,
          expected_date: '2026-05-01',
          expected_amount: 18000000,
          actual_paid_amount: 0,
          status: 'PENDING',
        },
      ],
      generated_data: [],
      meta: {
        generated_count: 1,
        allocation_mode: 'EVEN',
      },
    });

    await screen.findByRole('button', { name: 'Mở sửa hợp đồng' });
    await user.click(screen.getByRole('button', { name: 'Mở sửa hợp đồng' }));

    expect(await screen.findByTestId('contract-modal-edit')).toBeInTheDocument();
    expect(screen.getByTestId('contract-payment-schedule-count')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Sinh kỳ thanh toán mock' }));

    await waitFor(() => {
      expect(generateContractPaymentsMock).toHaveBeenCalledWith('contract-1', undefined);
      expect(screen.getByTestId('contract-payment-schedule-count')).toHaveTextContent('1');
    });
  });

  it('loads payment schedules for the selected contract when opening the edit modal', async () => {
    const user = userEvent.setup();
    renderApp();

    fetchPaymentSchedulesMock.mockImplementation(async (contractId?: string | number) => (
      contractId === 'contract-1'
        ? [{
            id: 'schedule-1',
            contract_id: 'contract-1',
          }]
        : []
    ));

    await screen.findByRole('button', { name: 'Mở sửa hợp đồng' });
    await user.click(screen.getByRole('button', { name: 'Mở sửa hợp đồng' }));

    expect(await screen.findByTestId('contract-modal-edit')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchContractDetailMock).toHaveBeenCalledWith('contract-1');
      expect(fetchPaymentSchedulesMock).toHaveBeenCalledWith('contract-1');
      expect(screen.getByTestId('contract-payment-schedule-count')).toHaveTextContent('1');
    });
  });

  it('opens the party profile form and reloads the party profile list after saving', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('button', { name: 'Mở thêm hồ sơ đảng viên' });

    const initialPartyProfileCalls = fetchEmployeePartyProfilesPageMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Mở thêm hồ sơ đảng viên' }));
    await user.click(await screen.findByRole('button', { name: 'Lưu hồ sơ đảng viên mock' }));

    await waitFor(() => {
      expect(upsertEmployeePartyProfileMock).toHaveBeenCalledWith('emp-1', expect.objectContaining({
        employee_id: 'emp-1',
        party_card_number: '093066006328',
      }));
      expect(fetchEmployeePartyProfilesPageMock.mock.calls.length).toBeGreaterThan(initialPartyProfileCalls);
    });
  });

  it('keeps the products module active when navigating to the nested quotation route', async () => {
    const user = userEvent.setup();
    renderApp(['/products']);

    await waitFor(() => {
      expect(screen.getByTestId('app-active-tab')).toHaveTextContent('products');
      expect(screen.getByTestId('app-location-path')).toHaveTextContent('/products');
    });

    await user.click(screen.getByRole('button', { name: 'Mở tab báo giá sản phẩm' }));

    await waitFor(() => {
      expect(screen.getByTestId('app-location-path')).toHaveTextContent('/products/quote');
      expect(screen.getByTestId('app-active-tab')).toHaveTextContent('product_quotes');
      expect(fetchProductPackagesMock).toHaveBeenCalled();
    });
  });

  it('loads product sales config datasets when opening support master management directly', async () => {
    renderApp(['/support-master-management']);

    await waitFor(() => {
      expect(screen.getByTestId('app-active-tab')).toHaveTextContent('support_master_management');
      expect(fetchSupportServiceGroupsMock).toHaveBeenCalled();
      expect(fetchProductsMock).toHaveBeenCalled();
      expect(fetchProductPackagesMock).toHaveBeenCalled();
      expect(fetchContractSignerMastersMock).toHaveBeenCalled();
      expect(fetchDepartmentsMock).toHaveBeenCalled();
      expect(fetchEmployeesMock).toHaveBeenCalled();
    });
  });

  it('loads product package datasets when opening the projects module directly', async () => {
    renderApp(['/projects']);

    await waitFor(() => {
      expect(screen.getByTestId('app-active-tab')).toHaveTextContent('projects');
      expect(fetchProjectsPageMock).toHaveBeenCalled();
      expect(fetchProductsMock).toHaveBeenCalled();
      expect(fetchProductPackagesMock).toHaveBeenCalled();
    });
  });
});
