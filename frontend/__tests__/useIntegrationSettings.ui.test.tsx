import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntegrationSettings } from '../hooks/useIntegrationSettings';
import {
  fetchBackblazeB2IntegrationSettings,
  fetchContractExpiryAlertSettings,
  fetchContractPaymentAlertSettings,
  fetchGoogleDriveIntegrationSettings,
  testGoogleDriveIntegrationSettings,
  updateBackblazeB2IntegrationSettings,
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
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useIntegrationSettings', () => {
  it('loads all integration settings when enabled', async () => {
    vi.mocked(fetchBackblazeB2IntegrationSettings).mockResolvedValue({
      is_enabled: true,
      access_key_id: 'key-1',
      bucket_id: 'bucket-1',
      bucket_name: 'demo',
      region: 'apac',
      file_prefix: 'vnpt/',
      last_test_status: null,
      last_test_message: null,
      last_tested_at: null,
    } as never);
    vi.mocked(fetchGoogleDriveIntegrationSettings).mockResolvedValue({
      is_enabled: true,
      account_email: 'drive@vnpt.test',
      folder_id: 'folder-1',
      scopes: 'scope-a',
      impersonate_user: null,
      file_prefix: 'docs/',
      last_test_status: null,
      last_test_message: null,
      last_tested_at: null,
    } as never);
    vi.mocked(fetchContractExpiryAlertSettings).mockResolvedValue({
      warning_days: 45,
    } as never);
    vi.mocked(fetchContractPaymentAlertSettings).mockResolvedValue({
      warning_days: 15,
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIntegrationSettings(undefined, { enabled: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.backblazeB2Settings?.bucket_name).toBe('demo');
      expect(result.current.googleDriveSettings?.account_email).toBe('drive@vnpt.test');
    });

    expect(fetchBackblazeB2IntegrationSettings).toHaveBeenCalledTimes(1);
    expect(fetchGoogleDriveIntegrationSettings).toHaveBeenCalledTimes(1);
    expect(result.current.contractExpiryAlertSettings?.warning_days).toBe(45);
    expect(result.current.contractPaymentAlertSettings?.warning_days).toBe(15);
  });

  it('updates cached settings after save and test mutations', async () => {
    vi.mocked(fetchBackblazeB2IntegrationSettings).mockResolvedValue({
      is_enabled: false,
      access_key_id: null,
      bucket_id: null,
      bucket_name: null,
      region: null,
      file_prefix: null,
      last_test_status: null,
      last_test_message: null,
      last_tested_at: null,
    } as never);
    vi.mocked(fetchGoogleDriveIntegrationSettings).mockResolvedValue({
      is_enabled: true,
      account_email: 'old@vnpt.test',
      folder_id: 'folder-1',
      scopes: 'scope-a',
      impersonate_user: null,
      file_prefix: 'docs/',
      last_test_status: null,
      last_test_message: null,
      last_tested_at: null,
    } as never);
    vi.mocked(fetchContractExpiryAlertSettings).mockResolvedValue({ warning_days: 30 } as never);
    vi.mocked(fetchContractPaymentAlertSettings).mockResolvedValue({ warning_days: 10 } as never);
    vi.mocked(updateBackblazeB2IntegrationSettings).mockResolvedValue({
      is_enabled: true,
      access_key_id: 'key-2',
      bucket_id: 'bucket-2',
      bucket_name: 'new-bucket',
      region: 'us-west',
      file_prefix: 'release/',
      last_test_status: null,
      last_test_message: null,
      last_tested_at: null,
    } as never);
    vi.mocked(testGoogleDriveIntegrationSettings).mockResolvedValue({
      status: 'SUCCESS',
      message: 'Connected',
      tested_at: '2026-03-29T10:00:00.000Z',
      user_email: 'new@vnpt.test',
    } as never);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIntegrationSettings(undefined, { enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.googleDriveSettings?.account_email).toBe('old@vnpt.test'));

    await act(async () => {
      await result.current.handleSaveBackblazeB2Settings({
        is_enabled: true,
        access_key_id: 'key-2',
        bucket_name: 'new-bucket',
      });
    });

    await waitFor(() => expect(result.current.backblazeB2Settings?.bucket_name).toBe('new-bucket'));

    await act(async () => {
      await result.current.handleTestGoogleDriveIntegration({
        is_enabled: true,
        account_email: 'new@vnpt.test',
      });
    });

    await waitFor(() => expect(result.current.googleDriveSettings?.account_email).toBe('new@vnpt.test'));
    expect(result.current.googleDriveSettings?.last_test_status).toBe('SUCCESS');
  });
});
