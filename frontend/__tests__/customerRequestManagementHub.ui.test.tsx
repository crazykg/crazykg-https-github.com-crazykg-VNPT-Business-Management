import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../services/v5Api', () => ({
  createYeuCau: vi.fn(),
  deleteYeuCau: vi.fn(),
  fetchCustomerRequestProjectItems: vi.fn(async () => []),
  fetchYeuCau: (...args: unknown[]) => mockFetchYeuCau(...args),
  fetchYeuCauProcessCatalog: vi.fn(async () => ({
    master_fields: [],
    groups: [],
  })),
  isRequestCanceledError: vi.fn(() => false),
  uploadDocumentAttachment: vi.fn(),
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

const makeRequest = (partial?: Partial<YeuCau>): YeuCau =>
  ({
    id: partial?.id ?? 7,
    ma_yc: partial?.ma_yc ?? 'CRC-202603-0007',
    request_code: partial?.request_code ?? 'CRC-202603-0007',
    tieu_de: partial?.tieu_de ?? 'Yêu cầu hỗ trợ',
    summary: partial?.summary ?? 'Yêu cầu hỗ trợ',
    trang_thai: partial?.trang_thai ?? 'new_intake',
    current_status_code: partial?.current_status_code ?? 'new_intake',
    current_status_name_vi: partial?.current_status_name_vi ?? 'Mới tiếp nhận',
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

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaMock,
  });

  mockFetchYeuCau.mockResolvedValue(
    makeRequest({
      id: 99,
      ma_yc: 'CRC-202603-0099',
      request_code: 'CRC-202603-0099',
      current_status_code: 'returned_to_manager',
      trang_thai: 'returned_to_manager',
      current_status_name_vi: 'Chuyển trả QL',
      tieu_de: 'Case mở từ attention fallback',
      summary: 'Case mở từ attention fallback',
    })
  );

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
    formAttachments: [],
    setFormAttachments: vi.fn(),
    formIt360Tasks: [],
    setFormIt360Tasks: vi.fn(),
    formReferenceTasks: [],
    setFormReferenceTasks: vi.fn(),
    timeline: [],
    caseWorklogs: [],
    isDetailLoading: false,
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
    openTransitionModal: vi.fn(),
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

  mockUseCustomerRequestSearch.mockReturnValue({
    searchKeyword: '',
    setSearchKeyword: vi.fn(),
    searchResults: [],
    searchError: '',
    isSearchLoading: false,
    isSearchOpen: false,
    setIsSearchOpen: vi.fn(),
  });
});

describe('CustomerRequestManagementHub UI', () => {
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

    expect(screen.getByText('Ca cần chú ý ngay')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /CRC-202603-0007/i }));

    expect(screen.queryByText('Ca cần chú ý ngay')).not.toBeInTheDocument();
    expect(screen.getByText(/Hiển thị/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
              current_status_name_vi: 'Chuyển trả QL',
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

    await user.click(screen.getByRole('button', { name: /CRC-202603-0099/i }));

    await waitFor(() => {
      expect(screen.queryByText('Ca cần chú ý ngay')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Hiển thị/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /CRC-202603-0099/i }));

    await waitFor(() => {
      expect(mockFetchYeuCau).toHaveBeenCalledWith(99);
    });
    expect(screen.getByText(/Hiển thị/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument();
  });
});
