import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccessControl } from '../hooks/useAccessControl';
import {
  fetchPermissions,
  fetchRoles,
  fetchUserAccess,
  updateUserAccessRoles,
} from '../services/api/adminApi';

vi.mock('../services/api/adminApi', () => ({
  deleteUploadedFeedbackAttachment: vi.fn(),
  fetchAuditLogs: vi.fn(),
  fetchAuditLogsPage: vi.fn(),
  fetchBackblazeB2IntegrationSettings: vi.fn(),
  fetchContractExpiryAlertSettings: vi.fn(),
  fetchContractPaymentAlertSettings: vi.fn(),
  fetchFeedbackById: vi.fn(),
  fetchFeedbacks: vi.fn(),
  fetchFeedbacksPage: vi.fn(),
  fetchGoogleDriveIntegrationSettings: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchRoles: vi.fn(),
  fetchUserAccess: vi.fn(),
  fetchUserDeptHistory: vi.fn(),
  fetchUserDeptHistoryPage: vi.fn(),
  respondFeedback: vi.fn(),
  testBackblazeB2IntegrationSettings: vi.fn(),
  testGoogleDriveIntegrationSettings: vi.fn(),
  updateBackblazeB2IntegrationSettings: vi.fn(),
  updateContractExpiryAlertSettings: vi.fn(),
  updateContractPaymentAlertSettings: vi.fn(),
  updateGoogleDriveIntegrationSettings: vi.fn(),
  updateUserAccessDeptScopes: vi.fn(),
  updateUserAccessPermissions: vi.fn(),
  updateUserAccessRoles: vi.fn(),
  uploadFeedbackAttachment: vi.fn(),
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

describe('useAccessControl', () => {
  it('loads roles, permissions, and user access records', async () => {
    vi.mocked(fetchRoles).mockResolvedValue([
      { id: 1, role_code: 'ADMIN', role_name: 'Admin', description: null, is_system: true },
    ] as never);
    vi.mocked(fetchPermissions).mockResolvedValue([
      { id: 11, perm_key: 'dashboard.read', perm_name: 'Xem dashboard', perm_group: 'dashboard', is_active: true },
    ] as never);
    vi.mocked(fetchUserAccess).mockResolvedValue([
      {
        user: { id: 7, username: 'tester', full_name: 'Tester', email: 'tester@vnpt.test' },
        roles: [{ role_id: 1, role_code: 'ADMIN', role_name: 'Admin' }],
        permissions: [],
        dept_scopes: [],
      },
    ] as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccessControl(undefined, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.roles).toHaveLength(1));

    expect(result.current.permissions).toHaveLength(1);
    expect(result.current.userAccessRecords[0]?.user.username).toBe('tester');
  });

  it('patches cached user access records after updating roles', async () => {
    vi.mocked(fetchRoles).mockResolvedValue([
      { id: 1, role_code: 'ADMIN', role_name: 'Admin', description: null, is_system: true },
    ] as never);
    vi.mocked(fetchPermissions).mockResolvedValue([] as never);
    vi.mocked(fetchUserAccess).mockResolvedValue([
      {
        user: { id: 7, username: 'tester', full_name: 'Tester', email: 'tester@vnpt.test' },
        roles: [{ role_id: 2, role_code: 'USER', role_name: 'User' }],
        permissions: [],
        dept_scopes: [],
      },
    ] as never);
    vi.mocked(updateUserAccessRoles).mockResolvedValue({
      user: { id: 7, username: 'tester', full_name: 'Tester', email: 'tester@vnpt.test' },
      roles: [{ role_id: 1, role_code: 'ADMIN', role_name: 'Admin' }],
      permissions: [],
      dept_scopes: [],
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAccessControl(undefined, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.userAccessRecords[0]?.roles[0]?.role_code).toBe('USER'));

    await act(async () => {
      await result.current.handleUpdateAccessRoles(7, [1]);
    });

    await waitFor(() => expect(result.current.userAccessRecords[0]?.roles[0]?.role_code).toBe('ADMIN'));
  });
});
