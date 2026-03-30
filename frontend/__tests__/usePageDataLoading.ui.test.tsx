import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePageDataLoading } from '../hooks/usePageDataLoading';
import { useFilterStore } from '../shared/stores';
import { FILTER_DEFAULTS } from '../shared/stores/filterStore';
import type { Customer, Project } from '../types';

const fetchCustomersPageMock = vi.hoisted(() => vi.fn());
const fetchProjectsPageMock = vi.hoisted(() => vi.fn());

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');

  return {
    ...actual,
    fetchCustomersPage: fetchCustomersPageMock,
    fetchProjectsPage: fetchProjectsPageMock,
  };
});

const cloneDefaults = () => ({
  employeesPage: { ...FILTER_DEFAULTS.employeesPage, filters: { ...(FILTER_DEFAULTS.employeesPage.filters || {}) } },
  partyProfilesPage: { ...FILTER_DEFAULTS.partyProfilesPage, filters: { ...(FILTER_DEFAULTS.partyProfilesPage.filters || {}) } },
  customersPage: { ...FILTER_DEFAULTS.customersPage, filters: { ...(FILTER_DEFAULTS.customersPage.filters || {}) } },
  projectsPage: { ...FILTER_DEFAULTS.projectsPage, filters: { ...(FILTER_DEFAULTS.projectsPage.filters || {}) } },
  contractsPage: { ...FILTER_DEFAULTS.contractsPage, filters: { ...(FILTER_DEFAULTS.contractsPage.filters || {}) } },
  documentsPage: { ...FILTER_DEFAULTS.documentsPage, filters: { ...(FILTER_DEFAULTS.documentsPage.filters || {}) } },
  auditLogsPage: { ...FILTER_DEFAULTS.auditLogsPage, filters: { ...(FILTER_DEFAULTS.auditLogsPage.filters || {}) } },
  feedbacksPage: { ...FILTER_DEFAULTS.feedbacksPage, filters: { ...(FILTER_DEFAULTS.feedbacksPage.filters || {}) } },
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe('usePageDataLoading', () => {
  beforeEach(() => {
    useFilterStore.setState({ tabFilters: cloneDefaults() });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('loads the current customers page into query cache and lets page rows be patched locally', async () => {
    fetchCustomersPageMock.mockResolvedValue({
      data: [
        {
          id: 1,
          customer_name: 'BV Đa khoa A',
        },
      ],
      meta: {
        page: 2,
        per_page: 10,
        total: 1,
        total_pages: 1,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePageDataLoading(), { wrapper });

    await act(async () => {
      await result.current.loadCustomersPage({
        page: 2,
        per_page: 10,
        q: 'benh vien',
        sort_by: 'customer_code',
        sort_dir: 'asc',
        filters: { sector: 'HEALTHCARE' },
      });
    });

    await waitFor(() => expect(result.current.customersPageRows).toHaveLength(1));
    expect(fetchCustomersPageMock).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      q: 'benh vien',
      filters: { sector: 'HEALTHCARE' },
    }));
    expect(result.current.getStoredFilter('customersPage')).toEqual(expect.objectContaining({
      page: 2,
      q: 'benh vien',
      filters: { sector: 'HEALTHCARE' },
    }));

    await act(async () => {
      result.current.setCustomersPageRows((previous) => [
        ...previous,
        {
          id: 2,
          customer_name: 'PK Tư nhân B',
        } as Customer,
      ]);
    });

    await waitFor(() => expect(result.current.customersPageRows).toHaveLength(2));
    expect(result.current.customersPageMeta?.page).toBe(2);
  });

  it('stores project filters immediately and triggers a debounced page refresh', async () => {
    fetchProjectsPageMock.mockResolvedValue({
      data: [
        {
          id: 7,
          project_code: 'DA007',
          project_name: 'Dự án y tế',
        },
      ],
      meta: {
        page: 3,
        per_page: 10,
        total: 1,
        total_pages: 1,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePageDataLoading(), { wrapper });

    act(() => {
      result.current.handleProjectsPageQueryChange({
        page: 3,
        per_page: 10,
        q: 'du an y te',
        sort_by: 'project_code',
        sort_dir: 'asc',
        filters: { status: 'CHUAN_BI' },
      });
    });

    expect(result.current.getStoredFilter('projectsPage')).toEqual(expect.objectContaining({
      page: 3,
      q: 'du an y te',
      filters: { status: 'CHUAN_BI' },
    }));
    expect(fetchProjectsPageMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchProjectsPageMock).toHaveBeenCalledWith(expect.objectContaining({
      page: 3,
      q: 'du an y te',
      filters: { status: 'CHUAN_BI' },
    })));
    await waitFor(() => expect(result.current.projectsPageRows[0]).toEqual(expect.objectContaining({
      project_code: 'DA007',
    } as Partial<Project>)));
  });
});
