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

import { SupportMasterManagement } from '../components/SupportMasterManagement';
import type {
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
  WorkflowStatusTransition,
  WorklogActivityTypeOption,
} from '../types/support';
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

const workflowStatusCatalogs: WorkflowStatusCatalog[] = [
  {
    id: 'wf-1',
    level: 1,
    status_code: 'NEW',
    status_name: 'Tiep nhan',
    parent_id: null,
    parent_name: null,
    canonical_status: 'NEW',
    canonical_sub_status: null,
    flow_step: 'INTAKE',
    form_key: 'crc_form',
    is_leaf: false,
    sort_order: 10,
    is_active: true,
  },
  {
    id: 'wf-2',
    level: 2,
    status_code: 'WAIT_VENDOR',
    status_name: 'Cho vendor',
    parent_id: 'wf-1',
    parent_name: 'Tiep nhan',
    canonical_status: 'IN_PROGRESS',
    canonical_sub_status: 'WAIT_VENDOR',
    flow_step: 'HANDLE',
    form_key: 'crc_form',
    is_leaf: true,
    sort_order: 20,
    is_active: true,
  },
];

const workflowStatusTransitions: WorkflowStatusTransition[] = [
  {
    id: 'transition-1',
    from_status_catalog_id: 'wf-1',
    from_status_name: 'Tiep nhan',
    to_status_catalog_id: 'wf-2',
    to_status_name: 'Cho vendor',
    action_code: 'ASSIGN_VENDOR',
    action_name: 'Giao vendor',
    required_role: 'PM',
    condition_json: { requires_assignment: true },
    notify_targets_json: ['PM', 'CREATOR'],
    sort_order: 30,
    is_active: true,
  },
];

const workflowFormFieldConfigs: WorkflowFormFieldConfig[] = [
  {
    id: 'field-1',
    status_catalog_id: 'wf-2',
    status_name: 'Cho vendor',
    field_key: 'FOLLOW_UP_NOTE',
    field_label: 'Noi dung bo sung',
    field_type: 'textarea',
    required: true,
    sort_order: 40,
    excel_column: 'AB',
    options_json: [
      { value: 'CALL_BACK', label: 'Goi lai' },
      { value: 'WAIT_INFO', label: 'Cho thong tin' },
    ],
    is_active: true,
  },
];

const noopAsync = vi.fn(async () => {
  throw new Error('Not implemented in test');
});

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

  it('shows workflow status catalog columns and values on the workflow_status_catalog tab', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);

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
    await user.click(screen.getByRole('button', { name: 'Workflow trạng thái phân cấp' }));

    await waitFor(() => {
      expect(screen.getByText('Canonical status')).toBeInTheDocument();
    });

    expect(screen.getByText('Flow/Form')).toBeInTheDocument();
    expect(screen.getAllByText('WAIT_VENDOR').length).toBeGreaterThan(0);
    expect(screen.getByText('Cho vendor')).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('HANDLE')).toBeInTheDocument();
    expect(screen.getAllByText('crc_form').length).toBeGreaterThan(0);
  });

  it('opens edit mode for a workflow status catalog row and hydrates the workflow fields', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);

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
    await user.click(screen.getByRole('button', { name: 'Workflow trạng thái phân cấp' }));

    await waitFor(() => {
      expect(screen.getAllByText('WAIT_VENDOR').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByTitle('Cập nhật')[1]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật trạng thái workflow phân cấp' })).toBeInTheDocument();
    });

    const statusCodeLabel = screen.getAllByText(/Mã trạng thái/).find((element) => element.tagName === 'LABEL');
    const statusCodeField = statusCodeLabel?.closest('div');
    const statusCodeInput = statusCodeField?.querySelector('input');

    const statusNameLabel = screen.getAllByText(/Tên trạng thái/).find((element) => element.tagName === 'LABEL');
    const statusNameField = statusNameLabel?.closest('div');
    const statusNameInput = statusNameField?.querySelector('input');

    expect(statusCodeInput).not.toBeNull();
    expect(statusCodeInput).toHaveValue('WAIT_VENDOR');
    expect(statusNameInput).not.toBeNull();
    expect(statusNameInput).toHaveValue('Cho vendor');
    expect(screen.getByDisplayValue('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('WAIT_VENDOR').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('HANDLE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('crc_form')).toBeInTheDocument();
  });

  it('shows workflow transition columns and values on the workflow_status_transition tab', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);
    workflowApiMocks.fetchWorkflowStatusTransitions.mockResolvedValue(workflowStatusTransitions);

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
    await user.click(screen.getByRole('button', { name: 'Workflow transition action' }));

    await waitFor(() => {
      expect(screen.getByText('Notify targets')).toBeInTheDocument();
    });

    expect(screen.getByText('ASSIGN_VENDOR')).toBeInTheDocument();
    expect(screen.getByText('Giao vendor')).toBeInTheDocument();
    expect(screen.getByText('Tiep nhan')).toBeInTheDocument();
    expect(screen.getByText('Cho vendor')).toBeInTheDocument();
    expect(screen.getByText('PM, CREATOR')).toBeInTheDocument();
    expect(screen.getByText('PM')).toBeInTheDocument();
  });

  it('opens edit mode for a workflow transition row and hydrates transition fields', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);
    workflowApiMocks.fetchWorkflowStatusTransitions.mockResolvedValue(workflowStatusTransitions);

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
    await user.click(screen.getByRole('button', { name: 'Workflow transition action' }));

    await waitFor(() => {
      expect(screen.getByText('ASSIGN_VENDOR')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật transition workflow' })).toBeInTheDocument();
    });

    const actionCodeLabel = screen.getAllByText(/Action code/).find((element) => element.tagName === 'LABEL');
    const actionCodeField = actionCodeLabel?.closest('div');
    const actionCodeInput = actionCodeField?.querySelector('input');

    const actionNameLabel = screen.getAllByText(/Tên hành động/).find((element) => element.tagName === 'LABEL');
    const actionNameField = actionNameLabel?.closest('div');
    const actionNameInput = actionNameField?.querySelector('input');

    const conditionLabel = screen.getAllByText(/Condition JSON/).find((element) => element.tagName === 'LABEL');
    const conditionField = conditionLabel?.closest('div');
    const conditionTextarea = conditionField?.querySelector('textarea');

    expect(actionCodeInput).not.toBeNull();
    expect(actionCodeInput).toHaveValue('ASSIGN_VENDOR');
    expect(actionNameInput).not.toBeNull();
    expect(actionNameInput).toHaveValue('Giao vendor');
    expect(screen.getByText('Tiep nhan (NEW)')).toBeInTheDocument();
    expect(screen.getByText('Cho vendor (WAIT_VENDOR)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PM, CREATOR')).toBeInTheDocument();
    expect(screen.getAllByText(/^PM$/).length).toBeGreaterThan(0);
    expect(conditionTextarea).not.toBeNull();
    expect(conditionTextarea).toHaveValue('{\n  "requires_assignment": true\n}');
  });

  it('shows workflow field config columns and values on the workflow_form_field_config tab', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);
    workflowApiMocks.fetchWorkflowFormFieldConfigs.mockResolvedValue(workflowFormFieldConfigs);

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
    await user.click(screen.getByRole('button', { name: 'Workflow schema field' }));

    await waitFor(() => {
      expect(screen.getByText('Field key')).toBeInTheDocument();
    });

    expect(screen.getByText('Field type')).toBeInTheDocument();
    expect(screen.getByText('FOLLOW_UP_NOTE')).toBeInTheDocument();
    expect(screen.getByText('Noi dung bo sung')).toBeInTheDocument();
    expect(screen.getAllByText('textarea').length).toBeGreaterThan(0);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('opens edit mode for a workflow field config row and hydrates workflow field settings', async () => {
    const user = userEvent.setup();
    workflowApiMocks.fetchWorkflowStatusCatalogs.mockResolvedValue(workflowStatusCatalogs);
    workflowApiMocks.fetchWorkflowFormFieldConfigs.mockResolvedValue(workflowFormFieldConfigs);

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
    await user.click(screen.getByRole('button', { name: 'Workflow schema field' }));

    await waitFor(() => {
      expect(screen.getByText('FOLLOW_UP_NOTE')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Cập nhật'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cập nhật schema field workflow' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('FOLLOW_UP_NOTE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Noi dung bo sung')).toBeInTheDocument();
    expect(screen.getByText('Cho vendor (WAIT_VENDOR)')).toBeInTheDocument();
    expect(screen.getAllByText('textarea').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Ví dụ: [{"value":"SUCCESS","label":"SUCCESS"}]')).toHaveValue(
      '[\n  {\n    "value": "CALL_BACK",\n    "label": "Goi lai"\n  },\n  {\n    "value": "WAIT_INFO",\n    "label": "Cho thong tin"\n  }\n]'
    );
    expect(screen.getByLabelText('Bắt buộc nhập')).toBeChecked();
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

  it('shows the Danh muc chuc vu option with STT and audit information for contact positions', async () => {
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
      expect(screen.getByText('Danh mục chức vụ')).toBeInTheDocument();
    });

    expect(screen.getByText('STT')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('Tester One')).toBeInTheDocument();
    expect(screen.getByText('Tester Two')).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: 'Thêm danh mục chức vụ' })).toBeInTheDocument();
    });

    const codeLabel = screen.getAllByText(/Mã chức vụ/).find((element) => element.tagName === 'LABEL');
    const codeField = codeLabel?.closest('div');
    const codeInput = codeField?.querySelector('input');
    expect(codeInput).not.toBeNull();

    await user.type(codeInput as HTMLInputElement, 'TRUONG_TRAM');

    expect(codeInput).toHaveValue('TRUONGTRAM');
    expect(screen.getByText('Chỉ cho phép chữ và số, không dùng dấu `_`.')).toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: 'Cập nhật danh mục chức vụ' })).toBeInTheDocument();
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
