import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workflowApiMocks = vi.hoisted(() => ({
  fetchWorkflowStatusCatalogs: vi.fn(),
  fetchWorkflowStatusTransitions: vi.fn(),
  fetchWorkflowFormFieldConfigs: vi.fn(),
  createWorkflowFormFieldConfig: vi.fn(),
  createWorkflowStatusCatalog: vi.fn(),
  createWorkflowStatusTransition: vi.fn(),
  updateWorkflowFormFieldConfig: vi.fn(),
  updateWorkflowStatusCatalog: vi.fn(),
  updateWorkflowStatusTransition: vi.fn(),
}));

const supportConfigApiMocks = vi.hoisted(() => ({
  fetchMonthlyCalendars: vi.fn(),
  generateCalendarYear: vi.fn(),
  updateCalendarDay: vi.fn(),
  fetchSupportAuthSessionPolicy: vi.fn(),
  updateSupportAuthSessionPolicy: vi.fn(),
}));

const productApiMocks = vi.hoisted(() => ({
  fetchProductTargetSegments: vi.fn(),
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    ...workflowApiMocks,
  };
});

vi.mock('../services/api/supportConfigApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/supportConfigApi')>(
    '../services/api/supportConfigApi'
  );
  return {
    ...actual,
    ...supportConfigApiMocks,
  };
});

vi.mock('../services/api/productApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/productApi')>(
    '../services/api/productApi'
  );
  return {
    ...actual,
    ...productApiMocks,
  };
});

import { SupportMasterManagement } from '../components/SupportMasterManagement';
import type {
  ContractSignerMaster,
  ProductUnitMaster,
  SupportAuthSessionPolicy,
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorklogActivityTypeOption,
} from '../types/support';
import type { Department } from '../types/department';
import type { Employee } from '../types/employee';
import type { Product, ProductPackage, ProductTargetSegment } from '../types/product';
import type { ProjectTypeOption } from '../types/project';
import type { WorkCalendarDay } from '../types/scheduling';

const supportContactPositions: SupportContactPosition[] = [
  {
    id: '1',
    position_code: 'DAU_MOI',
    position_name: 'Đầu mối',
    description: 'Liên hệ chính',
    is_active: true,
    used_in_customer_personnel: 3,
    created_at: '2026-03-28 01:02:03',
    created_by: 1,
    created_by_name: 'Tester One',
    updated_at: '2026-03-28 04:05:06',
    updated_by: 2,
    updated_by_name: 'Tester Two',
  },
];

const supportServiceGroups: SupportServiceGroup[] = [
  {
    id: 'group-1',
    customer_id: 'customer-1',
    customer_code: 'BV01',
    customer_name: 'Benh vien A',
    group_code: 'HIS_L2',
    group_name: 'Nhom HIS L2',
    workflow_status_catalog_id: 'wf-1',
    workflow_status_code: 'TIEP_NHAN',
    workflow_status_name: 'Tiep nhan',
    workflow_form_key: 'crc_form',
    description: 'Nhom ho tro HIS',
    used_in_customer_requests: 2,
    is_active: true,
  },
];

const supportRequestStatuses: SupportRequestStatusOption[] = [
  {
    id: 'status-1',
    status_code: 'WAITING_CUSTOMER',
    status_name: 'Cho khach hang',
    description: 'Dang cho phan hoi',
    requires_completion_dates: true,
    is_terminal: false,
    is_transfer_dev: true,
    is_active: true,
    sort_order: 20,
    used_in_requests: 2,
    used_in_history: 1,
  },
];

const worklogActivityTypes: WorklogActivityTypeOption[] = [
  {
    id: 'worklog-1',
    code: 'CODE_REVIEW',
    name: 'Code review',
    description: 'Review code truoc khi ban giao',
    default_is_billable: true,
    phase_hint: 'CODE',
    sort_order: 30,
    is_active: true,
    used_in_worklogs: 5,
  },
];

const supportSlaConfigs: SupportSlaConfigOption[] = [
  {
    id: 'sla-1',
    status: 'IN_PROGRESS',
    sub_status: 'WAIT_VENDOR',
    priority: 'HIGH',
    sla_hours: 12,
    request_type_prefix: 'HT',
    service_group_id: 'group-1',
    service_group_name: 'Nhom HIS L2',
    workflow_action_code: 'REPLY_CUSTOMER',
    description: 'Ap dung cho ticket muc uu tien cao',
    is_active: true,
    sort_order: 40,
    is_status_editable: false,
  },
];

const projectTypes: ProjectTypeOption[] = [
  {
    id: 'project-type-1',
    type_code: 'IMPLEMENT',
    type_name: 'Triển khai',
    description: 'Dự án triển khai mới',
    is_active: true,
    sort_order: 10,
    used_in_projects: 4,
    is_code_editable: false,
  },
];

const productUnitMasters: ProductUnitMaster[] = [
  {
    id: 'product-unit-1',
    unit_code: 'GOI',
    unit_name: 'Gói',
    description: 'Đơn vị gói cước',
    is_active: true,
    used_in_products: 2,
    is_name_editable: false,
  },
];

const departments: Department[] = [
  {
    id: 'dept-root',
    dept_code: 'BGDVT',
    dept_name: 'Ban giám đốc Viễn thông',
    parent_id: null,
    dept_path: 'BGDVT',
    is_active: true,
  },
  {
    id: 'dept-center',
    dept_code: 'TTKDGP',
    dept_name: 'Trung tâm Kinh doanh Giải pháp',
    parent_id: 'dept-root',
    dept_path: 'BGDVT/TTKDGP',
    is_active: true,
  },
  {
    id: 'dept-child',
    dept_code: 'PGP2',
    dept_name: 'Phòng giải pháp 2',
    parent_id: 'dept-center',
    dept_path: 'BGDVT/TTKDGP/PGP2',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 'employee-1',
    uuid: 'employee-1',
    user_code: 'U001',
    username: 'nguoiky1',
    full_name: 'Người Ký 1',
    email: 'u001@example.test',
    status: 'ACTIVE',
    department_id: 'dept-child',
    position_id: null,
  },
  {
    id: 'employee-2',
    uuid: 'employee-2',
    user_code: 'U002',
    username: 'nguoiky2',
    full_name: 'Người Ký 2',
    email: 'u002@example.test',
    status: 'ACTIVE',
    department_id: 'dept-center',
    position_id: null,
  },
];

const contractSignerMasters: ContractSignerMaster[] = [
  {
    id: 'signer-master-1',
    internal_user_id: 'employee-1',
    user_code: 'U001',
    full_name: 'Người Ký 1',
    department_id: 'dept-center',
    dept_code: 'TTKDGP',
    dept_name: 'Trung tâm Kinh doanh Giải pháp',
    used_in_contracts: 2,
    is_active: true,
  },
];

const products: Product[] = [
  {
    id: 'product-1',
    product_code: 'SP-HIS',
    product_name: 'Phan mem HIS',
    product_short_name: 'HIS',
    service_group: 'Y te so',
    domain_id: 'domain-1',
    vendor_id: 'vendor-1',
    standard_price: 1000000,
    is_active: true,
  },
];

const productPackages: ProductPackage[] = [
  {
    id: 'package-1',
    product_id: 'product-1',
    package_code: 'PKG-HIS-01',
    package_name: 'HIS Standard',
    standard_price: 1000000,
    is_active: true,
  },
  {
    id: 'package-2',
    product_id: 'product-1',
    package_code: 'PKG-HIS-02',
    package_name: 'HIS Premium',
    standard_price: 1200000,
    is_active: true,
  },
];

const productTargetSegments: ProductTargetSegment[] = [
  {
    id: 'segment-1',
    product_id: 'product-1',
    customer_sector: 'HEALTHCARE',
    facility_type: 'PUBLIC_HOSPITAL',
    facility_types: ['PUBLIC_HOSPITAL'],
    bed_capacity_min: 200,
    bed_capacity_max: null,
    priority: 1,
    sales_notes: 'Ưu tiên bệnh viện công.',
    is_active: true,
  },
];

const workCalendarDays: WorkCalendarDay[] = [
  {
    date: '2026-01-01',
    year: 2026,
    month: 1,
    day: 1,
    day_of_week: 4,
    week_number: 1,
    is_weekend: false,
    is_working_day: false,
    is_holiday: true,
    holiday_name: 'Tết Dương lịch',
    note: 'Nghỉ toàn công ty',
  },
];

const supportAuthSessionPolicy: SupportAuthSessionPolicy = {
  provider: 'AUTH_SESSION_POLICY',
  same_browser_multi_tab_enabled: true,
  updated_at: '2026-04-25 10:20:30',
  updated_by: 1,
  updated_by_name: 'System Admin',
  source: 'DB',
};

const noopAsync = vi.fn(async () => {
  throw new Error('Not implemented in test');
});

const toStartsWithMatcher = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

const renderSupportMasterManagement = (
  overrides: Partial<React.ComponentProps<typeof SupportMasterManagement>> = {}
) =>
  render(
    <SupportMasterManagement
      customers={[]}
      supportServiceGroups={[]}
      supportContactPositions={[]}
      departments={[]}
      employees={[]}
      products={[]}
      productPackages={[]}
      productUnitMasters={[]}
      contractSignerMasters={[]}
      supportRequestStatuses={[]}
      projectTypes={[]}
      worklogActivityTypes={[]}
      supportSlaConfigs={[]}
      onCreateSupportServiceGroup={noopAsync}
      onUpdateSupportServiceGroup={noopAsync}
      onCreateSupportContactPosition={noopAsync}
      onCreateProductUnitMaster={noopAsync}
      onCreateContractSignerMaster={noopAsync}
      onCreateSupportContactPositionsBulk={noopAsync}
      onUpdateSupportContactPosition={noopAsync}
      onUpdateProductUnitMaster={noopAsync}
      onUpdateContractSignerMaster={noopAsync}
      onCreateSupportRequestStatus={noopAsync}
      onUpdateSupportRequestStatus={noopAsync}
      onCreateProjectType={noopAsync}
      onUpdateProjectType={noopAsync}
      onCreateWorklogActivityType={noopAsync}
      onUpdateWorklogActivityType={noopAsync}
      onCreateSupportSlaConfig={noopAsync}
      onUpdateSupportSlaConfig={noopAsync}
      canReadCustomers={false}
      canReadServiceGroups={false}
      canReadContactPositions={false}
      canReadProducts={false}
      canReadProductUnitMasters={false}
      canReadContractSigners={false}
      canReadStatuses={false}
      canReadWorklogActivityTypes={false}
      canReadSlaConfigs={false}
      canReadProjectTypes={false}
      canReadWorkCalendar={false}
      canWriteServiceGroups={false}
      canWriteContactPositions={false}
      canWriteProducts={false}
      canWriteProductUnitMasters={false}
      canWriteContractSigners={false}
      canWriteStatuses={false}
      canWriteWorklogActivityTypes={false}
      canWriteSlaConfigs={false}
      canWriteProjectTypes={false}
      canWriteWorkCalendar={false}
      {...overrides}
    />
  );

describe('SupportMasterManagement', () => {
  beforeEach(() => {
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue([]);
    workflowApiMocks.fetchWorkflowStatusTransitions.mockResolvedValue([]);
    workflowApiMocks.fetchWorkflowFormFieldConfigs.mockResolvedValue([]);
    workflowApiMocks.createWorkflowFormFieldConfig.mockResolvedValue({});
    workflowApiMocks.createWorkflowStatusCatalog.mockResolvedValue({});
    workflowApiMocks.createWorkflowStatusTransition.mockResolvedValue({});
    workflowApiMocks.updateWorkflowFormFieldConfig.mockResolvedValue({});
    workflowApiMocks.updateWorkflowStatusCatalog.mockResolvedValue({});
    workflowApiMocks.updateWorkflowStatusTransition.mockResolvedValue({});
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue([]);
    supportConfigApiMocks.generateCalendarYear.mockResolvedValue({
      message: 'ok',
      year: 2026,
      inserted: 0,
      skipped: 0,
    });
    supportConfigApiMocks.updateCalendarDay.mockResolvedValue(workCalendarDays[0]);
    supportConfigApiMocks.fetchSupportAuthSessionPolicy.mockResolvedValue(supportAuthSessionPolicy);
    supportConfigApiMocks.updateSupportAuthSessionPolicy.mockResolvedValue({
      ...supportAuthSessionPolicy,
      same_browser_multi_tab_enabled: false,
    });
    productApiMocks.fetchProductTargetSegments.mockResolvedValue({
      data: productTargetSegments,
      meta: { table_available: true },
    });
  });

  it('shows product sales configuration with linked package mapping under support master management', async () => {
    renderSupportMasterManagement({
      products,
      productPackages,
      canReadProducts: true,
      canWriteProducts: true,
    });

    await waitFor(() => {
      expect(screen.getByText('SP-HIS')).toBeInTheDocument();
    });

    expect(screen.getByText('Cấu hình bán sản phẩm')).toBeInTheDocument();
    expect(screen.getByText('Phan mem HIS')).toBeInTheDocument();
    expect(screen.getByText('2 gói cước')).toBeInTheDocument();
    expect(screen.getByText('PKG-HIS-01 - HIS Standard')).toBeInTheDocument();
    expect(await screen.findByText('1 phân khúc')).toBeInTheDocument();
    expect(screen.getByText('Y tế • Bệnh viện (Công lập)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cấu hình bán sản phẩm' })).toBeInTheDocument();
  });

  it('loads and saves same-browser multi-tab session policy from support master management', async () => {
    const user = userEvent.setup();
    const notifyMock = vi.fn();

    renderSupportMasterManagement({
      canReadStatuses: true,
      canWriteStatuses: true,
      onNotify: notifyMock,
    });

    await waitFor(() => {
      expect(supportConfigApiMocks.fetchSupportAuthSessionPolicy).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Chọn danh mục' }));
    await user.click(await screen.findByRole('button', { name: /phiên đăng nhập nhiều tab/i }));

    expect(await screen.findByText('Cho phép 1 tài khoản dùng nhiều tab trong cùng trình duyệt')).toBeInTheDocument();
    expect(screen.getByText('System Admin')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /đang bật nhiều tab/i }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() => {
      expect(supportConfigApiMocks.updateSupportAuthSessionPolicy).toHaveBeenCalledWith({
        same_browser_multi_tab_enabled: false,
      });
    });

    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      'Cấu hình phiên đăng nhập',
      'Đã tắt đăng nhập nhiều tab trong cùng trình duyệt.'
    );
  });

  it('shows and creates contract signer masters with ownership department mapping', async () => {
    const user = userEvent.setup();
    const onCreateContractSignerMaster = vi.fn().mockResolvedValue({
      id: 'signer-master-2',
      internal_user_id: 'employee-1',
      user_code: 'U001',
      full_name: 'Người Ký 1',
      department_id: 'dept-center',
      dept_code: 'TTKDGP',
      dept_name: 'Trung tâm Kinh doanh Giải pháp',
      used_in_contracts: 0,
      is_active: true,
    });

    renderSupportMasterManagement({
      departments,
      employees,
      contractSignerMasters,
      onCreateContractSignerMaster,
      canReadContractSigners: true,
      canWriteContractSigners: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Người ký hợp đồng')).toBeInTheDocument();
    });

    expect(screen.getByText('U001')).toBeInTheDocument();
    expect(screen.getByText('Người Ký 1')).toBeInTheDocument();
    expect(screen.getByText('TTKDGP - Trung tâm Kinh doanh Giải pháp')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Thêm mới/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thêm người ký hợp đồng' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: toStartsWithMatcher('Chọn nhân sự nội bộ') }));
    await user.click(screen.getByRole('button', { name: 'U001 - Người Ký 1' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('TTKDGP - Trung tâm Kinh doanh Giải pháp')).toBeInTheDocument();
    });

    const submitButton = screen.getAllByRole('button', { name: /Thêm mới/i }).at(-1);
    expect(submitButton).toBeDefined();
    await user.click(submitButton!);

    await waitFor(() => {
      expect(onCreateContractSignerMaster).toHaveBeenCalledWith({
        internal_user_id: 'employee-1',
        is_active: true,
      });
    });
  });

  it('shows worklog activity columns and values on the worklog tab', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={worklogActivityTypes}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Loại công việc worklog')).toBeInTheDocument();
    });

    expect(screen.getByText('Phase hint')).toBeInTheDocument();
    expect(screen.getByText('Mặc định tính phí')).toBeInTheDocument();
    expect(screen.getByText('CODE_REVIEW')).toBeInTheDocument();
    expect(screen.getByText('Code review')).toBeInTheDocument();
    expect(screen.getByText('CODE')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('opens edit mode for a worklog activity type and keeps the code locked when it is already in use', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={worklogActivityTypes}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật loại công việc worklog' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã loại công việc/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');

    expect(codeInput).not.toBeNull();
    expect(codeInput).toHaveValue('CODE_REVIEW');
    expect(codeInput).toBeDisabled();
    expect(screen.getByText('Đã phát sinh dữ liệu, không cho đổi mã loại công việc.')).toBeInTheDocument();
  });

  it('shows SLA config columns and values on the sla_config tab', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={supportServiceGroups}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={supportSlaConfigs}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cấu hình SLA hỗ trợ')).toBeInTheDocument();
    });

    expect(screen.getByText('SLA (giờ)')).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getAllByText('WAIT_VENDOR').length).toBeGreaterThan(0);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Nhom HIS L2')).toBeInTheDocument();
    expect(screen.getByText('REPLY_CUSTOMER')).toBeInTheDocument();
  });

  it('opens edit mode for an SLA config and keeps the status pair locked when the rule is already in use', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={supportServiceGroups}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={supportSlaConfigs}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật cấu hình SLA hỗ trợ' })).toBeInTheDocument();
    });

    const statusLabel = screen.getAllByText(/^Trạng thái$/).find((element) => element.tagName === 'LABEL');
    const statusField = statusLabel?.closest('div');
    const statusInput = statusField?.querySelector('input');

    expect(statusInput).not.toBeNull();
    expect(statusInput).toHaveValue('IN_PROGRESS');
    expect(statusInput).toBeDisabled();
    expect(screen.getByText('Rule này đã phát sinh sử dụng, không cho đổi cặp trạng thái.')).toBeInTheDocument();
  });

  it('shows support status columns and values on the status tab', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={supportRequestStatuses}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Trạng thái hỗ trợ')).toBeInTheDocument();
    });

    expect(screen.getByText('Bắt buộc hạn')).toBeInTheDocument();
    expect(screen.getByText('Chuyển Dev')).toBeInTheDocument();
    expect(screen.getByText('WAITING_CUSTOMER')).toBeInTheDocument();
    expect(screen.getByText('Cho khach hang')).toBeInTheDocument();
    expect(screen.getByText('2 / 1')).toBeInTheDocument();
  });

  it('shows product unit master columns and values on the product unit tab', async () => {
    renderSupportMasterManagement({
      productUnitMasters,
      canReadProductUnitMasters: true,
      canWriteProductUnitMasters: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Đơn vị tính sản phẩm')).toBeInTheDocument();
    });

    expect(screen.getByText('Mã đơn vị tính')).toBeInTheDocument();
    expect(screen.getByText('Tên đơn vị tính')).toBeInTheDocument();
    expect(screen.getByText('GOI')).toBeInTheDocument();
    expect(screen.getByText('Gói')).toBeInTheDocument();
    expect(screen.getByText('Đơn vị gói cước')).toBeInTheDocument();
  });

  it('opens edit mode for a product unit master and keeps the name locked when it is already in use', async () => {
    const user = userEvent.setup();

    renderSupportMasterManagement({
      productUnitMasters,
      canReadProductUnitMasters: true,
      canWriteProductUnitMasters: true,
    });

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật đơn vị tính sản phẩm' })).toBeInTheDocument();
    });

    const nameLabel = screen.getAllByText(/Tên đơn vị tính/).find((element) => element.tagName === 'LABEL');
    const nameField = nameLabel?.closest('div');
    const nameInput = nameField?.querySelector('input');

    expect(nameInput).not.toBeNull();
    expect(nameInput).toHaveValue('Gói');
    expect(nameInput).toBeDisabled();
    expect(screen.getByText('Đã phát sinh sản phẩm, không cho đổi tên đơn vị tính.')).toBeInTheDocument();
  });

  it('hides legacy workflow master options and avoids calling removed workflow endpoints', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Chọn danh mục' }));

    expect(screen.getByRole('button', { name: /Trạng thái hỗ trợ/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workflow trạng thái phân cấp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workflow transition action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workflow schema field' })).not.toBeInTheDocument();
    expect(workflowApiMocks.fetchWorkflowStatusCatalogs).not.toHaveBeenCalled();
    expect(workflowApiMocks.fetchWorkflowStatusTransitions).not.toHaveBeenCalled();
    expect(workflowApiMocks.fetchWorkflowFormFieldConfigs).not.toHaveBeenCalled();
  });

  it('opens edit mode for a status and keeps the code locked when the status is already in use', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={supportRequestStatuses}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật trạng thái hỗ trợ' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã trạng thái/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');

    expect(codeInput).not.toBeNull();
    expect(codeInput).toHaveValue('WAITING_CUSTOMER');
    expect(codeInput).toBeDisabled();
    expect(screen.getByText('Đã phát sinh dữ liệu, không cho đổi mã trạng thái.')).toBeInTheDocument();
  });

  it('shows service group workflow and form-key information on the group tab', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={supportServiceGroups}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Nhóm Zalo/Tele')).toBeInTheDocument();
    });

    expect(screen.getByText('Workflow mặc định')).toBeInTheDocument();
    expect(screen.getByText('Form key')).toBeInTheDocument();
    expect(screen.getByText('Nhom HIS L2')).toBeInTheDocument();
    expect(screen.getByText('Tiep nhan')).toBeInTheDocument();
    expect(screen.getByText('crc_form')).toBeInTheDocument();
  });

  it('opens add mode for a service group and normalizes the group code input', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={supportServiceGroups}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm mới/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thêm nhóm Zalo/Tele' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã nhóm/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');

    expect(codeInput).not.toBeNull();

    await user.type(codeInput as HTMLInputElement, 'his l2@@');

    expect(codeInput).toHaveValue('HISL2');
    expect(screen.getByText('Để trống hệ thống tự sinh theo Tên nhóm.')).toBeInTheDocument();
  });

  it('shows the Chức vụ liên hệ option with usage information for contact positions', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={supportContactPositions}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chức vụ liên hệ')).toBeInTheDocument();
    });

    expect(screen.getByText('Đang dùng')).toBeInTheDocument();
    expect(screen.getByText('DAU_MOI')).toBeInTheDocument();
    expect(screen.getByText('Đầu mối')).toBeInTheDocument();
  });

  it('removes underscore characters from the position code input', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={supportContactPositions}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm mới/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thêm chức vụ liên hệ' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã chức vụ/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');
    expect(codeInput).not.toBeNull();

    await user.type(codeInput as HTMLInputElement, 'TRUONG_TRAM');

    expect(codeInput).toHaveValue('TRUONGTRAM');
  });

  it('opens edit mode for a contact position and keeps the code locked when the position is already in use', async () => {
    const user = userEvent.setup();

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={supportContactPositions}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar={false}
      />
    );

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật chức vụ liên hệ' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã chức vụ/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');

    expect(codeInput).not.toBeNull();
    expect(codeInput).toHaveValue('DAU_MOI');
    expect(codeInput).toBeDisabled();
    expect(screen.getByText('Đã phát sinh dữ liệu, không cho đổi mã chức vụ.')).toBeInTheDocument();
  });

  it('shows project type columns and values on the project_type tab', async () => {
    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={projectTypes}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes
        canReadWorkCalendar={false}
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes
        canWriteWorkCalendar={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Loại dự án - quản lý dự án')).toBeInTheDocument();
    });

    expect(screen.getByText('IMPLEMENT')).toBeInTheDocument();
    expect(screen.getByText('Triển khai')).toBeInTheDocument();
    expect(screen.getByText('Dự án triển khai mới')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('loads work calendar, hides list-specific shell controls, and saves an edited day', async () => {
    const user = userEvent.setup();
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(workCalendarDays);
    supportConfigApiMocks.updateCalendarDay.mockResolvedValue({
      ...workCalendarDays[0],
      note: 'Đã cập nhật ghi chú',
    });

    render(
      <SupportMasterManagement
        customers={[]}
        supportServiceGroups={[]}
        supportContactPositions={[]}
        supportRequestStatuses={[]}
        projectTypes={[]}
        worklogActivityTypes={[]}
        supportSlaConfigs={[]}
        onCreateSupportServiceGroup={noopAsync}
        onUpdateSupportServiceGroup={noopAsync}
        onCreateSupportContactPosition={noopAsync}
        onCreateSupportContactPositionsBulk={noopAsync}
        onUpdateSupportContactPosition={noopAsync}
        onCreateSupportRequestStatus={noopAsync}
        onUpdateSupportRequestStatus={noopAsync}
        onCreateProjectType={noopAsync}
        onUpdateProjectType={noopAsync}
        onCreateWorklogActivityType={noopAsync}
        onUpdateWorklogActivityType={noopAsync}
        onCreateSupportSlaConfig={noopAsync}
        onUpdateSupportSlaConfig={noopAsync}
        canReadCustomers={false}
        canReadServiceGroups={false}
        canReadContactPositions={false}
        canReadStatuses={false}
        canReadWorklogActivityTypes={false}
        canReadSlaConfigs={false}
        canReadProjectTypes={false}
        canReadWorkCalendar
        canWriteServiceGroups={false}
        canWriteContactPositions={false}
        canWriteStatuses={false}
        canWriteWorklogActivityTypes={false}
        canWriteSlaConfigs={false}
        canWriteProjectTypes={false}
        canWriteWorkCalendar
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tết Dương lịch')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Thêm mới/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Dòng/trang')).not.toBeInTheDocument();

    const holidayCell = screen.getByText('Tết Dương lịch').closest('td');
    expect(holidayCell).not.toBeNull();
    await user.click(holidayCell as HTMLTableCellElement);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chỉnh sửa ngày' })).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Ghi chú thêm về ngày này...');
    await user.clear(noteInput);
    await user.type(noteInput, 'Đã cập nhật ghi chú');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => {
      expect(supportConfigApiMocks.updateCalendarDay).toHaveBeenCalledWith('2026-01-01', {
        is_working_day: false,
        is_holiday: true,
        holiday_name: 'Tết Dương lịch',
        note: 'Đã cập nhật ghi chú',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Đã cập nhật ghi chú')).toBeInTheDocument();
    });
  });
});
