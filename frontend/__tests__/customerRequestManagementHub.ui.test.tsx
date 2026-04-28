// @vitest-environment jsdom
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
const mockFetchCustomerRequestCustomerFilterOptions = vi.fn();
const mockFetchCustomerRequestProjectFilterOptions = vi.fn();
const mockFetchCustomerRequestProductFilterOptions = vi.fn();
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
  fetchCustomerRequestCustomerFilterOptions: (...args: unknown[]) =>
    mockFetchCustomerRequestCustomerFilterOptions(...args),
  fetchCustomerRequestProductFilterOptions: (...args: unknown[]) =>
    mockFetchCustomerRequestProductFilterOptions(...args),
  fetchCustomerRequestProjectItems: (...args: unknown[]) =>
    mockFetchCustomerRequestProjectItems(...args),
  fetchCustomerRequestProjectFilterOptions: (...args: unknown[]) =>
    mockFetchCustomerRequestProjectFilterOptions(...args),
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

const buildProcessMeta = (
  processCode: string,
  processLabel: string,
  groupCode: string,
  groupLabel: string
) => ({
  process_code: processCode,
  process_label: processLabel,
  group_code: groupCode,
  group_label: groupLabel,
  table_name: `customer_request_${processCode}`,
  default_status: processCode,
  read_roles: [],
  write_roles: [],
  allowed_next_processes: [],
  form_fields: [],
  list_columns: [],
});

const defaultProcessCatalog = {
  master_fields: [],
  groups: [
    {
      group_code: 'intake',
      group_label: 'Tiếp nhận',
      processes: [
        buildProcessMeta('new_intake', 'Tiếp nhận', 'intake', 'Tiếp nhận'),
        buildProcessMeta('pending_dispatch', 'Chờ điều phối', 'intake', 'Tiếp nhận'),
      ],
    },
    {
      group_code: 'processing',
      group_label: 'Xử lý',
      processes: [buildProcessMeta('in_progress', 'Đang xử lý', 'processing', 'Xử lý')],
    },
    {
      group_code: 'closure',
      group_label: 'Kết quả',
      processes: [buildProcessMeta('completed', 'Hoàn thành', 'closure', 'Kết quả')],
    },
  ],
};

const getSurfaceSwitchButton = (
  label: 'Bảng theo dõi' | 'Danh sách' | 'Phân tích',
  pressed?: boolean
): HTMLButtonElement => {
  const topShell = screen.getByTestId('customer-request-top-shell');
  const candidates = within(topShell).queryAllByRole('button', { name: label });
  const surfaceButtons = candidates.filter(
    (button) => button.getAttribute('aria-label') === label
  );
  const pool = surfaceButtons.length > 0 ? surfaceButtons : candidates;

  if (pressed !== undefined) {
    const pressedMatched = pool.find(
      (button) => button.getAttribute('aria-pressed') === String(pressed)
    );
    if (pressedMatched) {
      return pressedMatched as HTMLButtonElement;
    }
  }

  const matched = pool[0];
  if (!matched) {
    throw new Error(`Surface switch button not found: ${label}`);
  }

  return matched as HTMLButtonElement;
};

const openSharedAdvancedFilters = async (user: ReturnType<typeof userEvent.setup>) => {
  if (!screen.queryByRole('button', { name: 'Ưu tiên' })) {
    const toggle = screen.queryByRole('button', { name: /Bộ lọc/i });
    if (toggle) {
      await user.click(toggle);
    }
  }
};

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
  mockFetchCustomerRequestCustomerFilterOptions.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 30, has_more: false },
  });
  mockFetchCustomerRequestProjectFilterOptions.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 30, has_more: false },
  });
  mockFetchCustomerRequestProductFilterOptions.mockResolvedValue({
    data: [],
    meta: { page: 1, per_page: 30, has_more: false },
  });
  mockFetchCustomerRequestProjectItems.mockResolvedValue([]);
  mockFetchWorklogActivityTypes.mockResolvedValue([]);
  mockFetchYeuCauProcessCatalog.mockResolvedValue(defaultProcessCatalog);
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
    const pickLabels = (labels: Array<string | null>): string[] =>
      labels
        .filter((label): label is string => label !== null)
        .filter((label) => ['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Giao PM/Trả YC cho PM'].includes(label));

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
    expect(pickLabels(optionLabels)).toEqual([
      'Chờ khách hàng cung cấp thông tin',
      'Giao R thực hiện',
      'Chuyển BA Phân tích',
      'Giao PM/Trả YC cho PM',
    ]);
  });

  it('shows backend-filtered in_progress outcomes under the XML contract', async () => {
    const user = userEvent.setup();
    const pickLabels = (labels: Array<string | null>): string[] =>
      labels
        .filter((label): label is string => label !== null)
        .filter((label) => ['Hoàn thành'].includes(label));

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
    expect(pickLabels(optionLabels)).toEqual(['Hoàn thành']);
  });

  it('builds the PM missing-customer-info decision from backend transition metadata for dispatcher lane', async () => {
    const user = userEvent.setup();
    const pickLabels = (labels: Array<string | null>): string[] =>
      labels
        .filter((label): label is string => label !== null)
        .filter((label) => ['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Không tiếp nhận'].includes(label));
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
    expect(pickLabels(optionLabels)).toEqual([
      'Chờ khách hàng cung cấp thông tin',
      'Giao R thực hiện',
      'Chuyển BA Phân tích',
      'Không tiếp nhận',
    ]);
  });

  it('reuses backend PM missing-customer-info decision metadata for returned_to_manager', async () => {
    const user = userEvent.setup();
    const pickLabels = (labels: Array<string | null>): string[] =>
      labels
        .filter((label): label is string => label !== null)
        .filter((label) => ['Chờ khách hàng cung cấp thông tin', 'Giao R thực hiện', 'Chuyển BA Phân tích', 'Không thực hiện'].includes(label));
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
    expect(pickLabels(optionLabels)).toEqual([
      'Chờ khách hàng cung cấp thông tin',
      'Giao R thực hiện',
      'Chuyển BA Phân tích',
      'Không thực hiện',
    ]);
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

  it('uses project RACI accountable as PM on the tracking board', () => {
    mockUseCustomerRequestList.mockReturnValue({
      listRows: [],
      isListLoading: false,
      listMeta: {
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 1,
      },
    });

    mockUseCustomerRequestDashboard.mockReturnValue({
      isDashboardLoading: false,
      overviewDashboard: {
        ...overviewDashboard,
        summary: {
          ...overviewDashboard.summary,
          total_cases: 1,
        },
        attention_cases: [{
          request_case: makeRequest({
            id: 44,
            ma_yc: 'CRC-202603-0044',
            request_code: 'CRC-202603-0044',
            tieu_de: 'Case có PM từ RACI A',
            summary: 'Case có PM từ RACI A',
            accountable_name: 'PM RACI A',
            pm_name: null,
            dispatcher_name: null,
            missing_estimate: true,
          }),
          reasons: ['missing_estimate'],
        }],
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

    expect(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0044/i })).toBeInTheDocument();
    expect(screen.getByText('PM RACI A')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có PM')).not.toBeInTheDocument();
  });

  it('keeps quick chips compact in inbox and retains the shared search layout on mobile', async () => {
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
    expect(screen.getByRole('button', { name: /Gần đây/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở tìm kiếm/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)).not.toBeInTheDocument();

    const refreshedToolbar = screen.getByRole('button', { name: /Làm mới/i }).parentElement as HTMLElement | null;

    expect(refreshedToolbar?.className).toContain('items-center');
    expect(within(refreshedToolbar ?? document.body).queryByText('Bảng theo dõi', { selector: 'span:not(.sr-only)' })).not.toBeInTheDocument();
    expect(within(refreshedToolbar ?? document.body).queryByText('Danh sách', { selector: 'span:not(.sr-only)' })).not.toBeInTheDocument();
    expect(within(refreshedToolbar ?? document.body).queryByText('Phân tích', { selector: 'span:not(.sr-only)' })).not.toBeInTheDocument();

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Làm mới/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ghim\s+\d+/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gần đây/i })).not.toBeInTheDocument();
  });

  it('places priority after progress and keeps keyword search as an Enter-submit form', async () => {
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

    await openSharedAdvancedFilters(user);

    const progressButton = screen.getByRole('button', { name: 'Tiến trình' });
    const priorityButton = screen.getByRole('button', { name: 'Ưu tiên' });
    const keywordInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    const progressRow = progressButton.closest('.grid');

    expect(priorityButton.closest('.grid')).toBe(progressRow);
    expect(keywordInput.closest('form')).toHaveAttribute('role', 'search');
    expect(keywordInput).toHaveAttribute('type', 'search');
    expect(progressButton.compareDocumentPosition(priorityButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(priorityButton.compareDocumentPosition(keywordInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps row 1 and row 3 visible when toggling shared advanced filters', async () => {
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

    const filterToggle = screen.getByRole('button', { name: /Bộ lọc/i });
    expect(filterToggle).toHaveTextContent('Đang ẩn');
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false');
    expect(filterToggle).toHaveAttribute('aria-controls', 'customer-request-shared-advanced-filters');
    expect(screen.queryByRole('button', { name: 'Tiến trình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ưu tiên' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Khách hàng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dự án' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sản phẩm' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();

    await user.click(filterToggle);

    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toHaveTextContent('Đang hiện');
    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Tiến trình' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ưu tiên' })).toBeInTheDocument();
  });

  it('keeps mobile header actions icon-only in one row and hides the subtitle', () => {
    setViewportWidth(390);

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
    const intakeButton = within(topShell).getByRole('button', { name: /^Nhập$/i });
    const createButton = within(topShell).getByRole('button', { name: /Thêm yêu cầu/i });
    const actionContainer = createButton.parentElement as HTMLElement;

    expect(actionContainer.className).toContain('items-center');
    expect(actionContainer.className).not.toContain('flex-wrap');
    expect(actionContainer).toContainElement(intakeButton);
    expect(intakeButton.className).toContain('w-10');
    expect(createButton.className).toContain('w-10');
    expect(within(topShell).queryByText('Nhập')).not.toBeInTheDocument();
    expect(within(topShell).queryByText('Thêm yêu cầu')).not.toBeInTheDocument();
    expect(within(topShell).queryByText('Workspace tổng hợp cho bảng theo dõi, danh sách và phân tích yêu cầu CRC.')).not.toBeInTheDocument();
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
      expect(screen.getByRole('heading', { name: /Dashboard yêu cầu khách hàng/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Số lượng yêu cầu theo từng khách hàng')).toBeInTheDocument();
    expect(screen.getByText('Top 5 khách hàng có yêu cầu tồn nhiều nhất')).toBeInTheDocument();
    expect(screen.getByText('Top 10 người xử lý')).toBeInTheDocument();
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

  it('only applies list filters after clicking the shared search button', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.clear(searchInput);
    await user.type(searchInput, 'CRC-202603-0007');

    const latestAfterTyping = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[] };
    };
    expect(latestAfterTyping.requestKeyword).toBe('');
    expect(latestAfterTyping.filters?.status_code).toBeUndefined();

    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });
    const beforeSubmitCallCount = mockUseCustomerRequestList.mock.calls.length;
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockUseCustomerRequestList.mock.calls.length).toBeGreaterThan(beforeSubmitCallCount);
    });
    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[] };
    };

    expect(latestArgs.requestKeyword).toBe('CRC-202603-0007');
    expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
  });

  it('submits all draft filters together when pressing Enter in the search input', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    const latestBeforeEnter = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { priority?: string[] };
    };
    expect(latestBeforeEnter.requestKeyword).toBe('');
    expect(latestBeforeEnter.filters?.priority).toBeUndefined();

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    const beforeSubmitCallCount = mockUseCustomerRequestList.mock.calls.length;
    await user.clear(searchInput);
    await user.type(searchInput, 'urgent{enter}');

    await waitFor(() => {
      expect(mockUseCustomerRequestList.mock.calls.length).toBeGreaterThan(beforeSubmitCallCount);
    });
    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { priority?: string[] };
    };

    expect(latestArgs.requestKeyword).toBe('urgent');
    expect(latestArgs.filters?.priority).toEqual(['4']);
  });

  it('disables shared search button when draft filters match applied filters', async () => {
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

    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });
    expect(searchButton).toBeDisabled();

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'abc');
    expect(searchButton).not.toBeDisabled();

    await user.click(searchButton);

    await waitFor(() => {
      expect(searchButton).toBeDisabled();
    });
  });

  it('clears both draft and applied filters when clicking Xóa lọc', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'abc');
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('abc');
    });

    await openSharedAdvancedFilters(user);
    const clearButton = screen.getByRole('button', { name: /Xóa lọc/i });
    await user.click(clearButton);

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('');
    });

    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();
  });

  it('applies SLA quick chip immediately and syncs draft filters', async () => {
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

    await user.click(screen.getByRole('button', { name: /SLA risk/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        filters?: { sla_risk?: 1 };
      };
      expect(latestArgs.filters?.sla_risk).toBe(1);
    });

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();
  });

  it('applies analytics status click immediately and keeps shared draft in sync', async () => {
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

    expect(screen.getByRole('heading', { name: /Dashboard yêu cầu khách hàng/i })).toBeInTheDocument();
    expect(screen.getByText('Top 10 người xử lý')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đang xử lý/i })).not.toBeInTheDocument();
    expect(mockUseCustomerRequestList).toHaveBeenCalled();
    expect(mockUseCustomerRequestDashboard).toHaveBeenCalled();

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestArgs.filters?.status_code).toBeUndefined();

    const latestDashboardArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardArgs.params?.filters?.status_code).toBeUndefined();

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeInTheDocument();

    const latestAfterListArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterListArgs.filters?.status_code).toBeUndefined();

    const latestAfterListDashboardArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestAfterListDashboardArgs.params?.filters?.status_code).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Bảng theo dõi/i }));

    const latestAfterInboxArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterInboxArgs.filters?.status_code).toBeUndefined();

    const latestAfterInboxDashboardArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestAfterInboxDashboardArgs.params?.filters?.status_code).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /SLA risk/i }));

    await waitFor(() => {
      const latestWithSla = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        filters?: { sla_risk?: 1 };
      };
      expect(latestWithSla.filters?.sla_risk).toBe(1);
    });

    const latestWithSlaDashboardArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { sla_risk?: 1 } };
    };
    expect(latestWithSlaDashboardArgs.params?.filters?.sla_risk).toBe(1);
  });

  it('keeps list-pane toolbar hidden while using shared top filter shell', () => {
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

    expect(screen.getByRole('button', { name: /Bộ lọc/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiến trình' })).not.toBeInTheDocument();
  });

  it('syncs shared draft from applied filters when saved view is applied', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'temp');

    const latestBeforeQuickFilter = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { sla_risk?: 1 };
    };
    expect(latestBeforeQuickFilter.requestKeyword).toBe('');
    expect(latestBeforeQuickFilter.filters?.sla_risk).toBeUndefined();

    const viewButton = screen.getByRole('button', { name: /SLA risk/i });
    await user.click(viewButton);

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { sla_risk?: 1 };
      };
      expect(latestArgs.requestKeyword).toBe('');
      expect(latestArgs.filters?.sla_risk).toBe(1);
    });

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toHaveValue('');

    const latestDashboardArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { q?: string; filters?: { sla_risk?: 1 } };
    };
    expect(latestDashboardArgs.params?.q).toBeUndefined();
    expect(latestDashboardArgs.params?.filters?.sla_risk).toBe(1);
  });

  it('uses draft filter values in list pane props to avoid eager API calls', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'draft-only');

    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toHaveValue('draft-only');
    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('draft-only');
    });
  });

  it('keeps applied filter badge counts and list filters based on applied state only', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'abc');

    await openSharedAdvancedFilters(user);
    expect(screen.queryByRole('button', { name: /Xóa lọc/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await openSharedAdvancedFilters(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xóa lọc/i })).toBeInTheDocument();
    });
  });

  it('preserves role filter behavior while delaying list filter application until submit', async () => {
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

    const initialListCallCount = mockUseCustomerRequestList.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /Bảng theo dõi/i }));

    expect(mockUseCustomerRequestList.mock.calls.length).toBeGreaterThanOrEqual(initialListCallCount);

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'role-test');

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).not.toBeDisabled();
  });

  it('applies all filters in one API call when clicking search button', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'full-filter');

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[]; priority?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();
    expect(latestBeforeSubmit.filters?.priority).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[]; priority?: string[] };
    };

    expect(latestArgs.requestKeyword).toBe('full-filter');
    expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
    expect(latestArgs.filters?.priority).toEqual(['4']);
  });

  it('does not apply draft filter changes to inbox rows until search submit', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [
        makeRequest({ id: 21, ma_yc: 'CRC-202603-0021', summary: 'Case A', missing_estimate: true }),
        makeRequest({ id: 22, ma_yc: 'CRC-202603-0022', summary: 'Case B', missing_estimate: false }),
      ],
      isListLoading: false,
      listMeta: {
        page: 1,
        per_page: 20,
        total: 2,
        total_pages: 1,
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    expect(screen.getByText('CRC-202603-0021')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    expect(screen.getByText('CRC-202603-0021')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();
    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();

    await user.click(getSurfaceSwitchButton('Bảng theo dõi', false));

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    expect(screen.getByText('CRC-202603-0021')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();

    const latestAfterRoundtrip = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterRoundtrip.filters?.status_code).toBeUndefined();

    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });
    expect(searchButton).not.toBeDisabled();

    const beforeSubmitCallCount = mockUseCustomerRequestList.mock.calls.length;

    await user.click(searchButton);

    await waitFor(() => {
      expect(mockUseCustomerRequestList.mock.calls.length).toBeGreaterThan(beforeSubmitCallCount);
    });

    const latestAfterSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterSubmit.filters?.status_code).toEqual(['new_intake']);

    await user.click(getSurfaceSwitchButton('Bảng theo dõi', false));
    await user.click(getSurfaceSwitchButton('Danh sách', false));
    expect(screen.getByText('CRC-202603-0021')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();

    const latestAfterInbox = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterInbox.filters?.status_code).toEqual(['new_intake']);

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const latestAfterListAgain = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterListAgain.filters?.status_code).toEqual(['new_intake']);

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();

    const latestDashboardAfterListAgain = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardAfterListAgain.params?.filters?.status_code).toEqual(['new_intake']);

    await user.click(getSurfaceSwitchButton('Phân tích', false));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Dashboard yêu cầu khách hàng/i })).toBeInTheDocument();
    });

    const latestAfterAnalytics = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterAnalytics.filters?.status_code).toEqual(['new_intake']);

    const latestDashboardAfterAnalytics = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardAfterAnalytics.params?.filters?.status_code).toEqual(['new_intake']);

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const latestAfterBackToList = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterBackToList.filters?.status_code).toEqual(['new_intake']);

    const searchButtonAfterBackToList = screen.getByRole('button', { name: /Tìm kiếm/i });
    expect(searchButtonAfterBackToList).toBeDisabled();

    const beforeNoopSubmit = mockUseCustomerRequestList.mock.calls.length;
    await user.click(searchButtonAfterBackToList);
    expect(mockUseCustomerRequestList.mock.calls.length).toBe(beforeNoopSubmit);

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: /Xóa lọc/i }));

    await waitFor(() => {
      const latestAfterClear = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        filters?: { status_code?: string[] };
      };
      expect(latestAfterClear.filters?.status_code).toBeUndefined();
    });

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();

    const latestDashboardAfterClear = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardAfterClear.params?.filters?.status_code).toBeUndefined();

    await user.click(getSurfaceSwitchButton('Bảng theo dõi', false));
    await user.click(getSurfaceSwitchButton('Danh sách', false));
    expect(screen.getByText('CRC-202603-0021')).toBeInTheDocument();
    expect(screen.getByText('CRC-202603-0022')).toBeInTheDocument();

    const latestAfterFinalInbox = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterFinalInbox.filters?.status_code).toBeUndefined();

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const latestAfterFinalList = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterFinalList.filters?.status_code).toBeUndefined();

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();

    const latestDashboardAfterFinalList = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardAfterFinalList.params?.filters?.status_code).toBeUndefined();

    const latestArgsOverall = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
      listPage?: number;
    };
    expect(latestArgsOverall.filters?.status_code).toBeUndefined();
    expect(latestArgsOverall.listPage).toBe(1);

    const beforeFinalNoop = mockUseCustomerRequestList.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
    expect(mockUseCustomerRequestList.mock.calls.length).toBe(beforeFinalNoop);

    await user.click(getSurfaceSwitchButton('Phân tích', false));

    const latestAfterFinalAnalytics = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterFinalAnalytics.filters?.status_code).toBeUndefined();

    const latestDashboardAfterFinalAnalytics = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { filters?: { status_code?: string[] } };
    };
    expect(latestDashboardAfterFinalAnalytics.params?.filters?.status_code).toBeUndefined();

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const latestAfterVeryFinalList = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterVeryFinalList.filters?.status_code).toBeUndefined();

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).toBeDisabled();

    const veryLastNoop = mockUseCustomerRequestList.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
    expect(mockUseCustomerRequestList.mock.calls.length).toBe(veryLastNoop);
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      expect(mockUseCustomerRequestList).toHaveBeenCalled();
    });
  });

  it('uses applied filters for export to avoid exporting unsubmitted draft filters', async () => {
    render(
      <CustomerRequestManagementHub
        customers={[]}
        customerPersonnel={[]}
        projectItems={[]}
        employees={[]}
        supportServiceGroups={[]}
        canReadRequests
        canExportRequests
      />
    );

    expect(mockUseCustomerRequestList).toHaveBeenCalled();
  });

  it('retains dashboard/list sync while deferring top-shell filter edits', async () => {
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
    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'sync');

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).not.toBeDisabled();
  });

  it('only sends one list API update when multiple draft filter edits are applied together', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'batch');

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[]; priority?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();
    expect(latestBeforeSubmit.filters?.priority).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { status_code?: string[]; priority?: string[] };
      };
      expect(latestArgs.requestKeyword).toBe('batch');
      expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
      expect(latestArgs.filters?.priority).toEqual(['4']);
    });
  });

  it('keeps search button enabled state accurate after applying and then editing draft again', async () => {
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

    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });
    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');

    await user.type(searchInput, 'first');
    expect(searchButton).not.toBeDisabled();

    await user.click(searchButton);
    await waitFor(() => expect(searchButton).toBeDisabled());

    await user.type(searchInput, ' second');
    expect(searchButton).not.toBeDisabled();
  });

  it('keeps applied filters unchanged when only opening filter dropdowns without selecting values', async () => {
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

    const latestBeforeOpen = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestBeforeOpen.filters?.status_code).toBeUndefined();

    await openSharedAdvancedFilters(user);
    const processButton = screen.getByRole('button', { name: 'Tiến trình' });
    await user.click(processButton);
    await user.keyboard('{Escape}');

    const latestAfterClose = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestAfterClose.filters?.status_code).toBeUndefined();
  });

  it('keeps the default created-date range when submitting shared shell filters without date fields', async () => {
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

    const initialArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { created_from?: string; created_to?: string };
    };
    expect(initialArgs.filters?.created_from).toBeTruthy();
    expect(initialArgs.filters?.created_to).toBeTruthy();
    expect(screen.queryByDisplayValue(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...'), 'date-hidden');

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { created_from?: string; created_to?: string };
      };
      expect(latestArgs.requestKeyword).toBe('date-hidden');
      expect(latestArgs.filters?.created_from).toBe(initialArgs.filters?.created_from);
      expect(latestArgs.filters?.created_to).toBe(initialArgs.filters?.created_to);
    });
  });

  it('keeps mobile shared filter selections as draft until search submit', async () => {
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

    await openSharedAdvancedFilters(user);
    const processButton = screen.getByRole('button', { name: 'Tiến trình' });
    await user.click(processButton);
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();

    const searchButtons = screen.getAllByRole('button', { name: /Tìm kiếm/i });
    await user.click(searchButtons[searchButtons.length - 1]);

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        filters?: { status_code?: string[] };
      };
      expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
    });
  });

  it('keeps dashboard hook params based on applied filters only', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'dash-draft');

    const latestBeforeSubmit = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
      params?: { q?: string };
    };
    expect(latestBeforeSubmit.params?.q).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
        params?: { q?: string };
      };
      expect(latestArgs.params?.q).toBe('dash-draft');
    });
  });

  it('submits top-shell filters even when list pane toolbar is hidden', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'hidden-toolbar');

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('hidden-toolbar');
    });
  });

  it('keeps applied filters when draft changes are abandoned by switching surfaces', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'persisted');
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('persisted');
    });

    await user.clear(searchInput);
    await user.type(searchInput, 'draft-change');

    await user.click(screen.getByRole('button', { name: /Phân tích/i }));
    await user.click(getSurfaceSwitchButton('Danh sách', false));

    expect(screen.getByRole('button', { name: /Tìm kiếm/i })).not.toBeDisabled();
  });

  it('updates listPage to 1 only when filters are applied, not while editing drafts', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [makeRequest()],
      isListLoading: false,
      listMeta: {
        page: 3,
        per_page: 20,
        total: 100,
        total_pages: 5,
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'page-reset');

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      listPage?: number;
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.listPage).toBe(1);

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        listPage?: number;
      };
      expect(latestArgs.listPage).toBe(1);
    });
  });

  it('uses the same submit behavior in shared shell and Enter key pathways', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'enter-path{enter}');

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('enter-path');
    });
  });

  it('keeps API call count stable while editing multiple filter drafts before submit', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'multi');

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { priority?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.priority).toBeUndefined();
  });

  it('applies role filter defaults independently from deferred list filters', async () => {
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

    await user.click(screen.getByRole('button', { name: /SLA risk/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        filters?: { sla_risk?: 1 };
      };
      expect(latestArgs.filters?.sla_risk).toBe(1);
    });

    const latestAfterQuickFilter = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { priority?: string[]; sla_risk?: 1 };
    };
    expect(latestAfterQuickFilter.requestKeyword).toBe('');
    expect(latestAfterQuickFilter.filters?.priority).toBeUndefined();
  });

  it('keeps search button state driven by draft-vs-applied diff for all filter groups', async () => {
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

    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });
    expect(searchButton).toBeDisabled();

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    expect(searchButton).not.toBeDisabled();

    await user.click(searchButton);

    await waitFor(() => {
      expect(searchButton).toBeDisabled();
    });
  });

  it('keeps existing mobile/list/analytics surfaces operational after deferred-filter refactor', async () => {
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
    expect(screen.getByRole('button', { name: /Danh sách/i })).toBeInTheDocument();

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    expect(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Bảng theo dõi/i }));
    expect(screen.getByRole('button', { name: /SLA risk/i })).toBeInTheDocument();
  });

  it('applies one-shot all-filter submission semantics requested by user', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'one-shot');

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[]; priority?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();
    expect(latestBeforeSubmit.filters?.priority).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { status_code?: string[]; priority?: string[] };
      };
      expect(latestArgs.requestKeyword).toBe('one-shot');
      expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
      expect(latestArgs.filters?.priority).toEqual(['4']);
    });
  });

  it('does not trigger list API refresh when only draft controls change', async () => {
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

    await user.type(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...'), 'no-api');

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
    };
    expect(latestArgs.requestKeyword).toBe('');
  });

  it('still allows immediate analytics card-driven process filtering where intended', async () => {
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

    expect(screen.getByRole('heading', { name: /Dashboard yêu cầu khách hàng/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đang xử lý/i })).not.toBeInTheDocument();

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      filters?: { status_code?: string[] };
    };
    expect(latestArgs.filters?.status_code).toBeUndefined();
  });

  it('keeps search button disabled immediately after clear filters resets both states', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });

    await user.type(searchInput, 'abc');
    await user.click(searchButton);

    await waitFor(() => expect(searchButton).toBeDisabled());

    await user.type(searchInput, 'new');
    expect(searchButton).not.toBeDisabled();

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: /Xóa lọc/i }));
    expect(searchButton).toBeDisabled();
  });

  it('maintains list query defaults when no submitted filters are active', () => {
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

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[]; priority?: string[]; tag_id?: string[] };
    };

    expect(latestArgs.requestKeyword).toBe('');
    expect(latestArgs.filters?.status_code).toBeUndefined();
    expect(latestArgs.filters?.priority).toBeUndefined();
    expect(latestArgs.filters?.tag_id).toBeUndefined();
  });

  it('keeps dashboard params aligned with applied filters after explicit submit', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'dashboard-sync');

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestDashboard.mock.calls.at(-1)?.[0] as {
        params?: { q?: string };
      };
      expect(latestArgs.params?.q).toBe('dashboard-sync');
    });
  });

  it('prevents accidental repeated submits when no draft changes remain', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    const searchButton = screen.getByRole('button', { name: /Tìm kiếm/i });

    await user.type(searchInput, 'once');
    await user.click(searchButton);

    await waitFor(() => {
      expect(searchButton).toBeDisabled();
    });

    const callsAfterSubmit = mockUseCustomerRequestList.mock.calls.length;
    await user.click(searchButton);
    expect(mockUseCustomerRequestList.mock.calls.length).toBe(callsAfterSubmit);
  });

  it('retains expected behavior of missing-estimate quick bucket filtering', async () => {
    const user = userEvent.setup();

    mockUseCustomerRequestList.mockReturnValue({
      listRows: [
        makeRequest({
          id: 41,
          ma_yc: 'CRC-202603-0041',
          request_code: 'CRC-202603-0041',
          missing_estimate: true,
        }),
        makeRequest({
          id: 42,
          ma_yc: 'CRC-202603-0042',
          request_code: 'CRC-202603-0042',
          missing_estimate: false,
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

    expect(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0041/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở chi tiết CRC-202603-0042/i })).not.toBeInTheDocument();
  });

  it('uses top shared search button as single submit point for all list filters', async () => {
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

    await user.type(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...'), 'single-point');

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Ưu tiên' }));
    await user.click(screen.getByRole('button', { name: 'Khẩn' }));

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { priority?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.priority).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { priority?: string[] };
      };
      expect(latestArgs.requestKeyword).toBe('single-point');
      expect(latestArgs.filters?.priority).toEqual(['4']);
    });
  });

  it('keeps list pane search interactions compatible with deferred filter apply flow', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'list-mode');

    const before = mockUseCustomerRequestList.mock.calls.length;
    expect(mockUseCustomerRequestList.mock.calls.length).toBe(before);

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('list-mode');
    });
  });

  it('does not auto-run search when editing shared shell keyword input', async () => {
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

    await user.type(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...'), 'typing-only');

    const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
    };
    expect(latestArgs.requestKeyword).toBe('');
  });

  it('does not render shared shell date fields after the filter wireframe simplification', () => {
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

    expect(screen.queryByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)).not.toBeInTheDocument();
  });

  it('keeps clear-filter behavior as immediate reset + API reload', async () => {
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

    const searchInput = screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...');
    await user.type(searchInput, 'clear-me');
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('clear-me');
    });

    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: /Xóa lọc/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
      };
      expect(latestArgs.requestKeyword).toBe('');
    });
  });

  it('maintains previous passing UI shell tests after filter flow changes', () => {
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

    const topShell = screen.getByTestId('customer-request-top-shell');

    expect(topShell).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Bảng theo dõi/i })).toBeInTheDocument();
    expect(within(topShell).getByRole('button', { name: /Danh sách/i })).toBeInTheDocument();
  });

  it('ensures search button now controls full filter submission as requested', async () => {
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

    await user.click(getSurfaceSwitchButton('Danh sách', false));
    await openSharedAdvancedFilters(user);
    await user.click(screen.getByRole('button', { name: 'Tiến trình' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận' }));

    await user.type(screen.getByPlaceholderText('Tìm mã YC, tên yêu cầu...'), 'final-check');

    const latestBeforeSubmit = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
      requestKeyword?: string;
      filters?: { status_code?: string[] };
    };
    expect(latestBeforeSubmit.requestKeyword).toBe('');
    expect(latestBeforeSubmit.filters?.status_code).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    await waitFor(() => {
      const latestArgs = mockUseCustomerRequestList.mock.calls.at(-1)?.[0] as {
        requestKeyword?: string;
        filters?: { status_code?: string[] };
      };
      expect(latestArgs.requestKeyword).toBe('final-check');
      expect(latestArgs.filters?.status_code).toEqual(['new_intake']);
    });
  });
});
