import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSupportConfig } from '../hooks/useSupportConfig';
import {
  createSupportServiceGroup,
  fetchSupportContactPositions,
  fetchSupportRequestStatuses,
  fetchSupportServiceGroups,
  fetchSupportSlaConfigs,
  fetchWorklogActivityTypes,
} from '../services/api/supportConfigApi';
import { fetchProjectTypes } from '../services/api/projectApi';

vi.mock('../services/api/supportConfigApi', () => ({
  createSupportContactPosition: vi.fn(),
  createSupportContactPositionsBulk: vi.fn(),
  createSupportRequestStatus: vi.fn(),
  createSupportServiceGroup: vi.fn(),
  createSupportSlaConfig: vi.fn(),
  createWorklogActivityType: vi.fn(),
  fetchAvailableSupportServiceGroups: vi.fn(),
  fetchDepartmentWeeklySchedules: vi.fn(),
  fetchMonthlyCalendars: vi.fn(),
  fetchSupportContactPositions: vi.fn(),
  fetchSupportRequestStatuses: vi.fn(),
  fetchSupportServiceGroups: vi.fn(),
  fetchSupportSlaConfigs: vi.fn(),
  fetchWorklogActivityTypes: vi.fn(),
  generateCalendarYear: vi.fn(),
  updateCalendarDay: vi.fn(),
  updateDepartmentWeeklySchedule: vi.fn(),
  updateSupportContactPosition: vi.fn(),
  updateSupportRequestStatusDefinition: vi.fn(),
  updateSupportServiceGroup: vi.fn(),
  updateSupportSlaConfig: vi.fn(),
  updateWorklogActivityType: vi.fn(),
}));

vi.mock('../services/api/projectApi', () => ({
  createProjectType: vi.fn(),
  fetchProjectItems: vi.fn(),
  fetchProjectRaciAssignments: vi.fn(),
  fetchProjectTypes: vi.fn(),
  fetchProjects: vi.fn(),
  fetchProjectsPage: vi.fn(),
  updateProjectType: vi.fn(),
}));

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

afterEach(() => {
  vi.clearAllMocks();
});

describe('useSupportConfig', () => {
  it('loads support config datasets for the support master screens', async () => {
    vi.mocked(fetchSupportServiceGroups).mockResolvedValue([
      { id: 1, group_name: 'Y te' },
    ] as never);
    vi.mocked(fetchSupportContactPositions).mockResolvedValue([
      { id: 2, position_name: 'Giam doc' },
    ] as never);
    vi.mocked(fetchSupportRequestStatuses).mockResolvedValue([
      { id: 3, status_code: 'NEW', status_name: 'Mới' },
    ] as never);
    vi.mocked(fetchProjectTypes).mockResolvedValue([
      { id: 4, type_code: 'DAU_TU', type_name: 'Đầu tư' },
    ] as never);
    vi.mocked(fetchWorklogActivityTypes).mockResolvedValue([
      { id: 5, code: 'ANALYSIS', name: 'Phân tích' },
    ] as never);
    vi.mocked(fetchSupportSlaConfigs).mockResolvedValue([
      { id: 6, priority: 'HIGH', sla_hours: 8 },
    ] as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSupportConfig(undefined, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.supportServiceGroups).toHaveLength(1));

    expect(result.current.supportContactPositions[0]?.position_name).toBe('Giam doc');
    expect(result.current.projectTypes[0]?.type_code).toBe('DAU_TU');
    expect(result.current.supportSlaConfigs[0]?.sla_hours).toBe(8);
  });

  it('prepends created support service groups into cached state', async () => {
    vi.mocked(fetchSupportServiceGroups).mockResolvedValue([
      { id: 1, group_name: 'Old group' },
    ] as never);
    vi.mocked(fetchSupportContactPositions).mockResolvedValue([] as never);
    vi.mocked(fetchSupportRequestStatuses).mockResolvedValue([] as never);
    vi.mocked(fetchProjectTypes).mockResolvedValue([] as never);
    vi.mocked(fetchWorklogActivityTypes).mockResolvedValue([] as never);
    vi.mocked(fetchSupportSlaConfigs).mockResolvedValue([] as never);
    vi.mocked(createSupportServiceGroup).mockResolvedValue({
      id: 9,
      group_name: 'New group',
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSupportConfig(undefined, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.supportServiceGroups[0]?.group_name).toBe('Old group'));

    await act(async () => {
      await result.current.handleCreateSupportServiceGroup({ group_name: 'New group' });
    });

    await waitFor(() => expect(result.current.supportServiceGroups[0]?.group_name).toBe('New group'));
    expect(result.current.supportServiceGroups).toHaveLength(2);
  });
});
