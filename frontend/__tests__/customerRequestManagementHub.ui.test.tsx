import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YeuCau, YeuCauDashboardPayload } from '../types';
import { CustomerRequestManagementHub } from '../components/CustomerRequestManagementHub';

const mockUseCustomerRequestList = vi.fn();
const mockUseCustomerRequestDashboard = vi.fn();
const mockUseCustomerRequestDetail = vi.fn();
const mockUseCustomerRequestCreatorWorkspace = vi.fn();
const mockUseCustomerRequestDispatcherWorkspace = vi.fn();
const mockUseCustomerRequestPerformerWorkspace = vi.fn();
const mockUseCustomerRequestTransition = vi.fn();
const mockUseCustomerRequestSearch = vi.fn();
const mockFetchYeuCau = vi.fn();
const mockFetchCustomerRequestProjectItems = vi.fn();
const mockFetchWorklogActivityTypes = vi.fn();
const mockCreateYeuCau = vi.fn();
const mockCreateYeuCauEstimate = vi.fn();
const mockStoreYeuCauDetailStatusWorklog = vi.fn();
const mockStoreYeuCauWorklog = vi.fn();
const mockTransitionCustomerRequestCase = vi.fn();
const mockUpdateYeuCauWorklog = vi.fn();
const mockCustomerRequestCreateModal = vi.fn();
const mockOpenTransitionModal = vi.fn();
const mockFetchYeuCauProcessCatalog = vi.fn();
const mockUseCreateCRC = vi.fn();

vi.mock('../components/customer-request/hooks/useCustomerRequestList', () => ({
  useCustomerRequestList: (...args: unknown[]) => mockUseCustomerRequestList(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestDashboard', () => ({
  useCustomerRequestDashboard: (...args: unknown[]) => mockUseCustomerRequestDashboard(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestDetail', () => ({
  useCustomerRequestDetail: (...args: unknown[]) => mockUseCustomerRequestDetail(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestCreatorWorkspace', () => ({
  useCustomerRequestCreatorWorkspace: (...args: unknown[]) =>
    mockUseCustomerRequestCreatorWorkspace(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestDispatcherWorkspace', () => ({
  useCustomerRequestDispatcherWorkspace: (...args: unknown[]) =>
    mockUseCustomerRequestDispatcherWorkspace(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestPerformerWorkspace', () => ({
  useCustomerRequestPerformerWorkspace: (...args: unknown[]) =>
    mockUseCustomerRequestPerformerWorkspace(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestTransition', () => ({
  useCustomerRequestTransition: (...args: unknown[]) =>
    mockUseCustomerRequestTransition(...args),
}));

vi.mock('../components/customer-request/hooks/useCustomerRequestSearch', () => ({
  useCustomerRequestSearch: (...args: unknown[]) => mockUseCustomerRequestSearch(...args),
}));

vi.mock('../shared/hooks/useCustomerRequests', () => ({
  useCreateCRC: (...args: unknown[]) => mockUseCreateCRC(...args),
}));

vi.mock('../services/api/supportConfigApi', () => ({
  fetchWorklogActivityTypes: (...args: unknown[]) => mockFetchWorklogActivityTypes(...args),
}));

vi.mock('../services/v5Api', () => ({
  createYeuCau: (...args: unknown[]) => mockCreateYeuCau(...args),
  createYeuCauEstimate: (...args: unknown[]) => mockCreateYeuCauEstimate(...args),
  deleteYeuCau: vi.fn(),
  fetchCustomerRequestProjectItems: (...args: unknown[]) =>
    mockFetchCustomerRequestProjectItems(...args),
  fetchYeuCau: (...args: unknown[]) => mockFetchYeuCau(...args),
  fetchYeuCauProcessCatalog: (...args: unknown[]) => mockFetchYeuCauProcessCatalog(...args),
  isRequestCanceledError: vi.fn(() => false),
  storeYeuCauDetailStatusWorklog: (...args: unknown[]) =>
    mockStoreYeuCauDetailStatusWorklog(...args),
  storeYeuCauWorklog: (...args: unknown[]) => mockStoreYeuCauWorklog(...args),
  transitionCustomerRequestCase: (...args: unknown[]) => mockTransitionCustomerRequestCase(...args),
  updateYeuCauWorklog: (...args: unknown[]) => mockUpdateYeuCauWorklog(...args),
  uploadDocumentAttachment: vi.fn(),
}));

vi.mock('../components/customer-request/CustomerRequestCreateModal', () => ({
  CustomerRequestCreateModal: (props: unknown) => {
    mockCustomerRequestCreateModal(props);
    return <div data-testid="customer-request-create-modal" />;
  },
}));

const matchMediaMock = vi.fn().mockImplementation(() => ({
  matches: true,
  media: '(min-width: 1536px)',
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

const setScrollTop = (value: number) => {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    writable: true,
    value,
  });
  Object.defineProperty(window, 'pageYOffset', {
    configurable: true,
    writable: true,
    value,
  });
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    writable: true,
    value,
  });
  Object.defineProperty(document.body, 'scrollTop', {
    configurable: true,
    writable: true,
    value,
  });
};

const makeRequest = (partial?: Partial<YeuCau>): YeuCau =>
  ({
    id: partial?.id ?? 7,
    ma_yc: partial?.ma_yc ?? 'CRC-202603-0007',
    request_code: partial?.request_code ?? 'CRC-202603-0007',
    tieu_de: partial?.tieu_de ?? 'Yêu cầu hỗ trợ',
    summary: partial?.summary ?? 'Yêu cầu hỗ trợ',
    trang_thai: partial?.trang_thai ?? 'new_intake',
    current_status_code: partial?.current_status_code ?? 'new_intake',
    current_status_name_vi: partial?.current_status_name_vi ?? 'Tiếp nhận',
    warning_level: partial?.warning_level ?? 'missing',
    khach_hang_name: partial?.khach_hang_name ?? 'Bệnh viện Sản',
    customer_name: partial?.customer_name ?? 'Bệnh viện Sản',
    project_name: partial?.project_name ?? 'Nhi Hậu Giang',
    performer_name: partial?.performer_name ?? 'Lý Thị Ngọc Mai',
    total_hours_spent: partial?.total_hours_spent ?? 0,
    estimated_hours: partial?.estimated_hours ?? null,
    do_uu_tien: partial?.do_uu_tien ?? 3,
    updated_at: partial?.updated_at ?? '2026-03-22 16:41:00',
    ...partial,
  }) as YeuCau;

const overviewDashboard: YeuCauDashboardPayload = {
  role: 'overview',
  summary: {
    total_cases: 6,
    status_counts: [],
    alert_counts: {
      missing_estimate: 6,
      over_estimate: 0,
      sla_risk: 2,
    },
  },
  top_customers: [],
  top_projects: [],
  top_performers: [],
  attention_cases: [
    {
      request_case: makeRequest(),
      reasons: ['missing_estimate'],
    },
  ],
};

const waitingCustomerFeedbackDecisionProcess = (sourceStatusCode: string) => ({
  process_code: 'waiting_customer_feedback',
  process_label: 'Chờ khách hàng cung cấp thông tin',
  group_code: 'feedback',
  group_label: 'Phản hồi',
  table_name: 'customer_request_waiting_customer_feedbacks',
  default_status: 'waiting_customer_feedback',
  read_roles: [],
  write_roles: [],
  allowed_next_processes: [],
  form_fields: [],
  list_columns: [],
  decision_context_code: 'pm_missing_customer_info_review',
  decision_outcome_code: 'customer_missing_info',
  decision_source_status_code: sourceStatusCode,
});

const notExecutedDecisionProcess = (sourceStatusCode: string) => ({
  process_code: 'not_executed',
  process_label: 'Không thực hiện',
  group_code: 'closure',
  group_label: 'Kết quả',
  table_name: 'customer_request_not_executed',
  default_status: 'not_executed',
  read_roles: [],
  write_roles: [],
  allowed_next_processes: [],
  form_fields: [],
  list_columns: [],
  decision_context_code: 'pm_missing_customer_info_review',
  decision_outcome_code: 'other_reason',
  decision_source_status_code: sourceStatusCode,
});

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(1600);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaMock,
  });
  setScrollTop(0);

  mockFetchYeuCau.mockResolvedValue(
    makeRequest({
      id: 99,
      ma_yc: 'CRC-202603-0099',
      request_code: 'CRC-202603-0099',
      current_status_code: 'returned_to_manager',
      trang_thai: 'returned_to_manager',
      current_status_name_vi: 'Giao PM/Trả YC cho PM',
      tieu_de: 'Case mở từ attention fallback',
      summary: 'Case mở từ attention fallback',
    })
  );
  mockFetchCustomerRequestProjectItems.mockResolvedValue([]);
  mockFetchWorklogActivityTypes.mockResolvedValue([]);
  mockFetchYeuCauProcessCatalog.mockResolvedValue({
    master_fields: [],
    groups: [],
  });
  mockCustomerRequestCreateModal.mockReset();
  mockCreateYeuCau.mockReset();
  mockCreateYeuCauEstimate.mockReset();
  mockStoreYeuCauWorklog.mockReset();
  mockTransitionCustomerRequestCase.mockReset();

  mockUseCustomerRequestList.mockReturnValue({
    listRows: [makeRequest()],
    isListLoading: false,
    listMeta: {
      page: 1,
      per_page: 20,
      total: 1,
      total_pages: 1,
    },
  });

  mockUseCustomerRequestDashboard.mockReturnValue({
    isDashboardLoading: false,
    overviewDashboard,
    roleDashboards: {
      creator: null,
      dispatcher: null,
      performer: null,
    },
  });

  mockUseCustomerRequestDetail.mockReturnValue({
    processDetail: null,
    setProcessDetail: vi.fn(),
    people: [],
    masterDraft: {},
    setMasterDraft: vi.fn(),
    processDraft: {},
    setProcessDraft: vi.fn(),
    formTags: [],
    setFormTags: vi.fn(),
    formAttachments: [],
    setFormAttachments: vi.fn(),
    formIt360Tasks: [],
    setFormIt360Tasks: vi.fn(),
    formReferenceTasks: [],
    setFormReferenceTasks: vi.fn(),
    timeline: [],
    caseWorklogs: [],
    setCaseWorklogs: vi.fn(),
    isDetailLoading: false,
    refreshDetail: vi.fn(async () => undefined),
  });

  mockUseCustomerRequestCreatorWorkspace.mockReturnValue({
    isLoading: false,
    creatorRows: [],
    reviewRows: [],
    notifyRows: [],
    followUpRows: [],
    closedRows: [],
  });

  mockUseCustomerRequestDispatcherWorkspace.mockReturnValue({
    isLoading: false,
    dispatcherRows: [],
    queueRows: [],
    returnedRows: [],
    feedbackRows: [],
    approvalRows: [],
    activeRows: [],
    teamLoadRows: [],
    pmWatchRows: [],
  });

  mockUseCustomerRequestPerformerWorkspace.mockReturnValue({
    isLoading: false,
    performerRows: [],
    pendingRows: [],
    activeRows: [],
    timesheet: null,
  });

  mockUseCustomerRequestTransition.mockReturnValue({
    openTransitionModal: mockOpenTransitionModal,
    showTransitionModal: false,
    modalStatusPayload: {},
    setModalStatusPayload: vi.fn(),
    modalIt360Tasks: [],
    addModalIt360Task: vi.fn(),
    updateModalIt360Task: vi.fn(),
    setModalIt360Tasks: vi.fn(),
    modalRefTasks: [],
    addModalReferenceTask: vi.fn(),
    updateModalReferenceTask: vi.fn(),
    setModalRefTasks: vi.fn(),
    modalAttachments: [],
    handleModalUpload: vi.fn(),
    setModalAttachments: vi.fn(),
    isModalUploading: false,
    modalNotes: '',
    setModalNotes: vi.fn(),
    modalActiveTaskTab: 'IT360',
    setModalActiveTaskTab: vi.fn(),
    isTransitioning: false,
    closeTransitionModal: vi.fn(),
    handleTransitionConfirm: vi.fn(),
    modalTimeline: [],
    modalHandlerUserId: '',
    setModalHandlerUserId: vi.fn(),
  });
  mockOpenTransitionModal.mockReset();

  mockUseCustomerRequestSearch.mockReturnValue({
    searchKeyword: '',
    setSearchKeyword: vi.fn(),
    searchResults: [],
    searchError: '',
    isSearchLoading: false,
    isSearchOpen: false,
    setIsSearchOpen: vi.fn(),
  });

  mockUseCreateCRC.mockReturnValue({
    mutateAsync: mockCreateYeuCau,
  });
});

describe('CustomerRequestManagementHub UI', () => {
  it('loads the request list with the default created-date range from current year to current month end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00+07:00'));

    try {
      render(
        <CustomerRequestManagementHub
          customers={[]}
          customerPersonnel={[]}
          projectItems={[]}
          employees={[]}
          supportServiceGroups={[]}
          canReadRequests
        />
      );

      expect(mockUseCustomerRequestList).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            created_from: '2026-01-01 00:00:00',
            created_to: '2026-04-30 23:59:59',
          }),
        })
      );
      expect(mockUseCustomerRequestDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            filters: expect.objectContaining({
              created_from: '2026-01-01 00:00:00',
              created_to: '2026-04-30 23:59:59',
            }),
          }),
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides role workspace cards from the tracking toolbar', () => {
    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    expect(screen.getByRole('button', { name: /Bảng theo dõi/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Người tạo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Điều phối/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Người xử lý/i })).not.toBeInTheDocument();
  });

  it('opens nested worklog and estimate dialogs above the detail frame', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestDetail.mockReturnValue({
      processDetail: {
        yeu_cau: makeRequest({
          id: 12,
          ma_yc: 'CRC-202604-0012',
          request_code: 'CRC-202604-0012',
          tieu_de: 'Yc1',
          summary: 'Yc1',
          trang_thai: 'new_intake',
          current_status_code: 'new_intake',
          current_status_name_vi: 'Tiếp nhận',
        }),
        can_write: true,
        allowed_next_processes: [],
        available_actions: {
          can_write: true,
          can_transition: false,
          can_add_worklog: true,
          can_add_estimate: true,
        },
        hours_report: {
          request_case_id: 12,
          estimated_hours: 8,
          total_hours_spent: 2,
          remaining_hours: 6,
          hours_usage_pct: 25,
        },
        estimates: [],
      },
      setProcessDetail: vi.fn(),
      people: [],
      masterDraft: {},
      setMasterDraft: vi.fn(),
      processDraft: {},
      setProcessDraft: vi.fn(),
      formTags: [],
      setFormTags: vi.fn(),
      formAttachments: [],
      setFormAttachments: vi.fn(),
      formIt360Tasks: [],
      setFormIt360Tasks: vi.fn(),
      formReferenceTasks: [],
      setFormReferenceTasks: vi.fn(),
      timeline: [],
      caseWorklogs: [],
      setCaseWorklogs: vi.fn(),
      isDetailLoading: false,
      refreshDetail: vi.fn(async () => undefined),
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));
    await screen.findByText(/Vận hành yêu cầu/i);
    await user.click(screen.getByRole('button', { name: /Ghi giờ công/i }));
    expect(await screen.findByRole('dialog', { name: /Ghi giờ công/i })).toHaveClass('z-[130]');
    await user.click(screen.getByRole('button', { name: /Huỷ/i }));

    const estimateTabButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Ước lượng') && !button.textContent?.includes('Cập nhật'));
    expect(estimateTabButton).toBeDefined();
    await user.click(estimateTabButton!);
    await user.click(screen.getByRole('button', { name: /Cập nhật ước lượng/i }));
    expect(await screen.findByRole('dialog', { name: /Cập nhật ước lượng/i })).toHaveClass('z-[130]');
  });

  it('shows backend-filtered performer-lane targets for a new_intake case already assigned to performer', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestDetail.mockReturnValue({
      processDetail: {
        yeu_cau: makeRequest({
          id: 11,
          ma_yc: 'CRC-202603-0011',
          request_code: 'CRC-202603-0011',
          trang_thai: 'new_intake',
          current_status_code: 'new_intake',
          current_status_name_vi: 'Tiếp nhận',
          performer_user_id: 3,
          performer_name: 'Người xử lý',
          dispatch_route: 'self_handle',
        }),
        can_write: true,
        allowed_next_processes: [
          {
            process_code: 'waiting_customer_feedback',
            process_label: 'Chờ khách hàng cung cấp thông tin',
            group_code: 'feedback',
            group_label: 'Phản hồi',
            table_name: 'customer_request_waiting_customer_feedbacks',
            default_status: 'waiting_customer_feedback',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
          {
            process_code: 'assigned_to_receiver',
            process_label: 'Giao R thực hiện',
            group_code: 'processing',
            group_label: 'Xử lý',
            table_name: 'customer_request_assigned_to_receiver',
            default_status: 'assigned_to_receiver',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
          {
            process_code: 'analysis',
            process_label: 'Chuyển BA Phân tích',
            group_code: 'analysis',
            group_label: 'Phân tích',
            table_name: 'customer_request_analysis',
            default_status: 'analysis',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
          {
            process_code: 'returned_to_manager',
            process_label: 'Giao PM/Trả YC cho PM',
            group_code: 'analysis',
            group_label: 'Phân tích',
            table_name: 'customer_request_returned_to_manager',
            default_status: 'returned_to_manager',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
        ],
        available_actions: {
          can_write: true,
          can_transition: true,
          can_add_worklog: true,
          can_add_estimate: true,
        },
      },
      setProcessDetail: vi.fn(),
      people: [],
      masterDraft: {
        customer_id: '1',
        project_item_id: '11',
        summary: 'nội dung yêu cầu',
      },
      setMasterDraft: vi.fn(),
      processDraft: {},
      setProcessDraft: vi.fn(),
      formTags: [],
      setFormTags: vi.fn(),
      formAttachments: [],
      setFormAttachments: vi.fn(),
      formIt360Tasks: [],
      setFormIt360Tasks: vi.fn(),
      formReferenceTasks: [],
      setFormReferenceTasks: vi.fn(),
      timeline: [],
      caseWorklogs: [],
      setCaseWorklogs: vi.fn(),
      isDetailLoading: false,
      refreshDetail: vi.fn(async () => undefined),
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await waitFor(() => expect(mockFetchYeuCauProcessCatalog).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    const optionLabels = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(optionLabels).toEqual(['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Giao PM/Trả YC cho PM']);
  });

  it('shows backend-filtered in_progress outcomes under the XML contract', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestDetail.mockReturnValue({
      processDetail: {
        yeu_cau: makeRequest({
          id: 16,
          ma_yc: 'CRC-202603-0016',
          request_code: 'CRC-202603-0016',
          trang_thai: 'in_progress',
          current_status_code: 'in_progress',
          current_status_name_vi: 'R Đang thực hiện',
          performer_user_id: 3,
          performer_name: 'Người xử lý',
          dispatch_route: 'self_handle',
        }),
        can_write: true,
        allowed_next_processes: [
          {
            process_code: 'completed',
            process_label: 'Hoàn thành',
            group_code: 'closure',
            group_label: 'Kết quả',
            table_name: 'customer_request_completed',
            default_status: 'completed',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
        ],
        available_actions: {
          can_write: true,
          can_transition: true,
          can_add_worklog: true,
          can_add_estimate: true,
        },
      },
      setProcessDetail: vi.fn(),
      people: [],
      masterDraft: {
        customer_id: '1',
        project_item_id: '11',
        summary: 'nội dung yêu cầu',
      },
      setMasterDraft: vi.fn(),
      processDraft: {},
      setProcessDraft: vi.fn(),
      formTags: [],
      setFormTags: vi.fn(),
      formAttachments: [],
      setFormAttachments: vi.fn(),
      formIt360Tasks: [],
      setFormIt360Tasks: vi.fn(),
      formReferenceTasks: [],
      setFormReferenceTasks: vi.fn(),
      timeline: [],
      caseWorklogs: [],
      setCaseWorklogs: vi.fn(),
      isDetailLoading: false,
      refreshDetail: vi.fn(async () => undefined),
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await waitFor(() => expect(mockFetchYeuCauProcessCatalog).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    const optionLabels = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(optionLabels).toEqual(['Hoàn thành']);
  });

  it('builds the PM missing-customer-info decision from backend transition metadata for dispatcher lane', async () => {
    const user = userEvent.setup();
    const waitingCustomerFeedbackProcess = waitingCustomerFeedbackDecisionProcess('new_intake');
    const assignedToReceiverProcess = {
      process_code: 'assigned_to_receiver',
      process_label: 'Giao R thực hiện',
      group_code: 'processing',
      group_label: 'Xử lý',
      table_name: 'customer_request_assigned_to_receiver',
      default_status: 'assigned_to_receiver',
      read_roles: [],
      write_roles: [],
      allowed_next_processes: [],
      form_fields: [],
      list_columns: [],
    };
    const analysisProcess = {
      process_code: 'analysis',
      process_label: 'Chuyển BA Phân tích',
      group_code: 'analysis',
      group_label: 'Phân tích',
      table_name: 'customer_request_analysis',
      default_status: 'analysis',
      read_roles: [],
      write_roles: [],
      allowed_next_processes: [],
      form_fields: [],
      list_columns: [],
    };
    const notExecutedProcess = notExecutedDecisionProcess('new_intake');

    mockFetchYeuCauProcessCatalog.mockResolvedValue({
      master_fields: [],
      groups: [
        {
          group_code: 'intake',
          group_label: 'Tiếp nhận',
          processes: [waitingCustomerFeedbackProcess, assignedToReceiverProcess, analysisProcess, notExecutedProcess],
        },
      ],
    });

    mockUseCustomerRequestDetail.mockReturnValue({
      processDetail: {
        yeu_cau: makeRequest({
          id: 12,
          ma_yc: 'CRC-202603-0012',
          request_code: 'CRC-202603-0012',
          trang_thai: 'new_intake',
          current_status_code: 'new_intake',
          current_status_name_vi: 'Tiếp nhận',
          performer_user_id: null,
          performer_name: null,
          dispatcher_user_id: 5,
          dispatcher_name: 'PM điều phối',
          dispatch_route: 'assign_pm',
        }),
        can_write: true,
        allowed_next_processes: [
          waitingCustomerFeedbackProcess,
          assignedToReceiverProcess,
          analysisProcess,
          notExecutedProcess,
        ],
        available_actions: {
          can_write: true,
          can_transition: true,
          can_add_worklog: true,
          can_add_estimate: true,
        },
      },
      setProcessDetail: vi.fn(),
      people: [],
      masterDraft: {
        customer_id: '1',
        project_item_id: '11',
        summary: 'nội dung yêu cầu',
      },
      setMasterDraft: vi.fn(),
      processDraft: {},
      setProcessDraft: vi.fn(),
      formTags: [],
      setFormTags: vi.fn(),
      formAttachments: [],
      setFormAttachments: vi.fn(),
      formIt360Tasks: [],
      setFormIt360Tasks: vi.fn(),
      formReferenceTasks: [],
      setFormReferenceTasks: vi.fn(),
      timeline: [],
      caseWorklogs: [],
      setCaseWorklogs: vi.fn(),
      isDetailLoading: false,
      refreshDetail: vi.fn(async () => undefined),
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    const optionLabels = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(optionLabels).toEqual(['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Không tiếp nhận']);
  });

  it('reuses backend PM missing-customer-info decision metadata for returned_to_manager', async () => {
    const user = userEvent.setup();
    const waitingCustomerFeedbackProcess = waitingCustomerFeedbackDecisionProcess('returned_to_manager');
    const assignedToReceiverProcess = {
      process_code: 'assigned_to_receiver',
      process_label: 'Giao R thực hiện',
      group_code: 'processing',
      group_label: 'Xử lý',
      table_name: 'customer_request_assigned_to_receiver',
      default_status: 'assigned_to_receiver',
      read_roles: [],
      write_roles: [],
      allowed_next_processes: [],
      form_fields: [],
      list_columns: [],
    };
    const analysisProcess = {
      process_code: 'analysis',
      process_label: 'Chuyển BA Phân tích',
      group_code: 'analysis',
      group_label: 'Phân tích',
      table_name: 'customer_request_analysis',
      default_status: 'analysis',
      read_roles: [],
      write_roles: [],
      allowed_next_processes: [],
      form_fields: [],
      list_columns: [],
    };
    const notExecutedProcess = notExecutedDecisionProcess('returned_to_manager');

    mockFetchYeuCauProcessCatalog.mockResolvedValue({
      master_fields: [],
      groups: [
        {
          group_code: 'analysis',
          group_label: 'Phân tích',
          processes: [waitingCustomerFeedbackProcess, assignedToReceiverProcess, analysisProcess, notExecutedProcess],
        },
      ],
    });

    mockUseCustomerRequestDetail.mockReturnValue({
      processDetail: {
        yeu_cau: makeRequest({
          id: 13,
          ma_yc: 'CRC-202603-0013',
          request_code: 'CRC-202603-0013',
          trang_thai: 'returned_to_manager',
          current_status_code: 'returned_to_manager',
          current_status_name_vi: 'Giao PM/Trả YC cho PM',
          dispatcher_user_id: 5,
          dispatcher_name: 'PM điều phối',
          performer_user_id: 3,
          performer_name: 'Người xử lý',
        }),
        can_write: true,
        allowed_next_processes: [
          waitingCustomerFeedbackProcess,
          assignedToReceiverProcess,
          analysisProcess,
          notExecutedProcess,
        ],
        available_actions: {
          can_write: true,
          can_transition: true,
          can_add_worklog: true,
          can_add_estimate: true,
        },
      },
      setProcessDetail: vi.fn(),
      people: [],
      masterDraft: {
        customer_id: '1',
        project_item_id: '11',
        summary: 'nội dung yêu cầu',
      },
      setMasterDraft: vi.fn(),
      processDraft: {},
      setProcessDraft: vi.fn(),
      formTags: [],
      setFormTags: vi.fn(),
      formAttachments: [],
      setFormAttachments: vi.fn(),
      formIt360Tasks: [],
      setFormIt360Tasks: vi.fn(),
      formReferenceTasks: [],
      setFormReferenceTasks: vi.fn(),
      timeline: [],
      caseWorklogs: [],
      setCaseWorklogs: vi.fn(),
      isDetailLoading: false,
      refreshDetail: vi.fn(async () => undefined),
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await waitFor(() => expect(mockFetchYeuCauProcessCatalog).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    const optionLabels = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(optionLabels).toEqual(['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Không thực hiện']);
  });
  });

  it('switches from overview inbox to list/detail when clicking an attention case', async () => {
    const user = userEvent.setup();

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    expect(screen.getByText('Bảng theo dõi', { selector: 'p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));

    expect(screen.queryByText('Bảng theo dõi', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument();
  });

  it('opens list/detail for an attention case not present in the current list page', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [makeRequest()],
      isListLoading: false,
      listMeta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      },
    });

    mockUseCustomerRequestDashboard.mockReturnValue({
      isDashboardLoading: false,
      overviewDashboard: {
        ...overviewDashboard,
        attention_cases: [
          {
            request_case: makeRequest({
              id: 99,
              ma_yc: 'CRC-202603-0099',
              request_code: 'CRC-202603-0099',
              current_status_code: 'returned_to_manager',
              trang_thai: 'returned_to_manager',
              current_status_name_vi: 'Giao PM/Trả YC cho PM',
              tieu_de: 'Case attention không có trong trang list',
              summary: 'Case attention không có trong trang list',
            }),
            reasons: ['missing_estimate'],
          },
        ],
      },
      roleDashboards: {
        creator: null,
        dispatcher: null,
        performer: null,
      },
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0099/i }));

    await waitFor(() => {
      expect(screen.queryByText('Bảng theo dõi', { selector: 'p' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument();
    expect(mockFetchYeuCau).not.toHaveBeenCalled();
  });

  it('falls back to fetching the case when an attention item is missing status metadata', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [makeRequest()],
      isListLoading: false,
      listMeta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      },
    });

    mockUseCustomerRequestDashboard.mockReturnValue({
      isDashboardLoading: false,
      overviewDashboard: {
        ...overviewDashboard,
        attention_cases: [
          {
            request_case: {
              id: 99,
              ma_yc: 'CRC-202603-0099',
              request_code: 'CRC-202603-0099',
              tieu_de: 'Case thiếu status metadata',
              summary: 'Case thiếu status metadata',
            },
            reasons: ['missing_estimate'],
          },
        ],
      },
      roleDashboards: {
        creator: null,
        dispatcher: null,
        performer: null,
      },
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0099/i }));

    await waitFor(() => {
      expect(mockFetchYeuCau).toHaveBeenCalledWith(99);
    });
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument();
  });

  it('uses only scoped CRC project items in create modal instead of bootstrap project items', async () => {
    const user = userEvent.setup();

    mockFetchCustomerRequestProjectItems.mockResolvedValue([
      {
        id: 11,
        customer_id: 1,
        customer_name: 'Bệnh viện Sản',
        product_name: 'HIS L3',
      },
    ]);

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[
          {
            id: 99,
            customer_id: 98,
            customer_name: 'Trạm Y tế Xã Vị Bình',
            product_name: 'Phần mềm VNPT HIS L3',
          } as never,
        ]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
        canWriteRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Thêm yêu cầu/i }));

    await waitFor(() => {
      expect(mockFetchCustomerRequestProjectItems).toHaveBeenCalled();
    });

    await waitFor(() => {
      const latestProps = mockCustomerRequestCreateModal.mock.calls.at(-1)?.[0] as
        | { projectItems?: Array<{ id: number; customer_name?: string }> }
        | undefined;

      expect(latestProps?.projectItems).toEqual([
        expect.objectContaining({
          id: 11,
          customer_name: 'Bệnh viện Sản',
        }),
      ]);
    });
  });

  it('filters the tracking board to only missing-estimate cases when selecting Thiếu estimate', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [
        makeRequest({
          id: 11,
          ma_yc: 'CRC-202603-0011',
          request_code: 'CRC-202603-0011',
          tieu_de: 'Case thiếu estimate',
          summary: 'Case thiếu estimate',
          missing_estimate: true,
          warning_level: 'medium',
        }),
        makeRequest({
          id: 12,
          ma_yc: 'CRC-202603-0012',
          request_code: 'CRC-202603-0012',
          tieu_de: 'Case đủ estimate',
          summary: 'Case đủ estimate',
          missing_estimate: false,
          warning_level: 'low',
        }),
      ],
      isListLoading: false,
      listMeta: {
        page: 1,
        per_page: 20,
        total: 2,
        total_pages: 1,
      },
    });

    mockUseCustomerRequestDashboard.mockReturnValue({
      isDashboardLoading: false,
      overviewDashboard: {
        ...overviewDashboard,
        summary: {
          ...overviewDashboard.summary,
          alert_counts: {
            ...overviewDashboard.summary.alert_counts,
            missing_estimate: 1,
          },
        },
        attention_cases: [],
      },
      roleDashboards: {
        creator: null,
        dispatcher: null,
        performer: null,
      },
    });

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Thiếu estimate/i }));

    expect(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0011/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở chi tiết CRC-202603-0012/i })).not.toBeInTheDocument();
  });

  it('keeps quick chips compact in inbox and removes them when switching to list on mobile', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    expect(screen.getByRole('button', { name: /Ghim 0/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gần đây 0/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)).toHaveLength(2);
    const refreshButton = screen.getByRole('button', { name: /Làm mới/i });
    const toolbar = refreshButton.parentElement as HTMLElement | null;

    expect(toolbar?.className).toContain('items-center');
    expect(within(toolbar ?? document.body).getByRole('button', { name: /Bảng theo dõi/i })).toBeInTheDocument();

    const listSurfaceButton = screen
      .getAllByRole('button', { name: /Danh sách/i })
      .find((button) => button.getAttribute('aria-pressed') === 'false');

    expect(listSurfaceButton).toBeTruthy();
    await user.click(listSurfaceButton!);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Làm mới/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ghim 0/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gần đây 0/i })).not.toBeInTheDocument();
  });

  it('merges the top header actions and surface switch into one shell', () => {
    setViewportWidth(1600);

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
        canImportRequests
        canExportRequests
        canWriteRequests
      />
    );

    const topShell = screen.getByTestId('customer-request-top-shell');

    expect(within(topShell).getByRole('heading', { name: /Quản lý yêu cầu khách hàng/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Bảng theo dõi/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Danh sách/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Phân tích/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Làm mới/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /^Nhập/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Thêm yêu cầu/i })).toBeInTheDocument();
  });

  it('shows analytics filters in two visible rows without the advanced filter toggle', async () => {
    const user = userEvent.setup();

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
      />
    );

    await user.click(screen.getByRole('button', { name: /Phân tích/i }));

    await waitFor(() => {
      expect(screen.getByText('Tất cả khách hàng')).toBeInTheDocument();
    });

    expect(screen.getByText('Tất cả kênh')).toBeInTheDocument();
    expect(screen.getByText('Tất cả ưu tiên')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bộ lọc/i })).not.toBeInTheDocument();
  });

  it('groups intake template, import, and export actions under the Nhập menu', async () => {
    const user = userEvent.setup();

    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
        canImportRequests
        canExportRequests
      />
    );

    expect(screen.queryByRole('button', { name: /Tải mẫu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nhập/i }));

    expect(screen.getByRole('menuitem', { name: /Tải mẫu nhập/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Nhập từ Excel/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Xuất dữ liệu/i })).toBeInTheDocument();
  });
