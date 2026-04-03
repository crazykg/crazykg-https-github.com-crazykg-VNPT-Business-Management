import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBackblazeB2IntegrationSettings,
  fetchContractExpiryAlertSettings,
  fetchContractPaymentAlertSettings,
  fetchEmailSmtpIntegrationSettings,
  fetchGoogleDriveIntegrationSettings,
  testBackblazeB2IntegrationSettings,
  testEmailSmtpIntegrationSettings,
  testGoogleDriveIntegrationSettings,
  updateBackblazeB2IntegrationSettings,
  updateContractExpiryAlertSettings,
  updateContractPaymentAlertSettings,
  updateEmailSmtpIntegrationSettings,
  updateGoogleDriveIntegrationSettings,
} from '../services/api/adminApi';
import { queryKeys } from '../shared/queryKeys';
import type {
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  EmailSmtpIntegrationSettings,
  EmailSmtpIntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
} from '../types/admin';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface IntegrationSettingsLoadingStates {
  isBackblazeB2SettingsLoading: boolean;
  isBackblazeB2SettingsSaving: boolean;
  isBackblazeB2SettingsTesting: boolean;
  isGoogleDriveSettingsLoading: boolean;
  isGoogleDriveSettingsSaving: boolean;
  isGoogleDriveSettingsTesting: boolean;
  isEmailSmtpSettingsLoading: boolean;
  isEmailSmtpSettingsSaving: boolean;
  isEmailSmtpSettingsTesting: boolean;
  isContractExpiryAlertSettingsLoading: boolean;
  isContractExpiryAlertSettingsSaving: boolean;
  isContractPaymentAlertSettingsLoading: boolean;
  isContractPaymentAlertSettingsSaving: boolean;
}

interface UseIntegrationSettingsOptions {
  enabled?: boolean;
}

interface UseIntegrationSettingsReturn {
  backblazeB2Settings: BackblazeB2IntegrationSettings | null;
  googleDriveSettings: GoogleDriveIntegrationSettings | null;
  emailSmtpSettings: EmailSmtpIntegrationSettings | null;
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  loadingStates: IntegrationSettingsLoadingStates;
  error: string | null;
  refreshIntegrationSettings: () => Promise<void>;
  handleSaveBackblazeB2Settings: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveGoogleDriveSettings: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveEmailSmtpSettings: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveContractExpiryAlertSettings: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  handleSaveContractPaymentAlertSettings: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  handleTestBackblazeB2Integration: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<{ message?: string; status?: 'SUCCESS' | 'FAILED'; tested_at?: string | null; persisted?: boolean }>;
  handleTestGoogleDriveIntegration: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<{ message?: string; user_email?: string | null; status?: 'SUCCESS' | 'FAILED'; tested_at?: string | null; persisted?: boolean }>;
  handleTestEmailSmtpIntegration: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<{ message?: string; status?: 'SUCCESS' | 'FAILED'; tested_at?: string | null; persisted?: boolean }>;
}

const extractErrorMessage = (error: unknown, fallback = 'Lỗi không xác định'): string =>
  error instanceof Error ? error.message : fallback;

export function useIntegrationSettings(
  addToast?: ToastFn,
  options: UseIntegrationSettingsOptions = {},
): UseIntegrationSettingsReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();

  const backblazeQuery = useQuery({
    queryKey: queryKeys.integrationSettings.backblazeB2(),
    queryFn: fetchBackblazeB2IntegrationSettings,
    enabled,
  });

  const googleDriveQuery = useQuery({
    queryKey: queryKeys.integrationSettings.googleDrive(),
    queryFn: fetchGoogleDriveIntegrationSettings,
    enabled,
  });

  const contractExpiryQuery = useQuery({
    queryKey: queryKeys.integrationSettings.contractExpiryAlert(),
    queryFn: fetchContractExpiryAlertSettings,
    enabled,
  });

  const contractPaymentQuery = useQuery({
    queryKey: queryKeys.integrationSettings.contractPaymentAlert(),
    queryFn: fetchContractPaymentAlertSettings,
    enabled,
  });

  const emailSmtpQuery = useQuery({
    queryKey: queryKeys.integrationSettings.emailSmtp(),
    queryFn: fetchEmailSmtpIntegrationSettings,
    enabled,
  });

  const saveBackblazeMutation = useMutation({
    mutationFn: updateBackblazeB2IntegrationSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.integrationSettings.backblazeB2(), updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình Backblaze B2.');
    },
    onError: (error) => {
      addToast?.('error', 'Lưu cấu hình thất bại', extractErrorMessage(error));
    },
  });

  const saveGoogleDriveMutation = useMutation({
    mutationFn: updateGoogleDriveIntegrationSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.integrationSettings.googleDrive(), updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình Google Drive.');
    },
    onError: (error) => {
      addToast?.('error', 'Lưu cấu hình thất bại', extractErrorMessage(error));
    },
  });

  const saveContractExpiryMutation = useMutation({
    mutationFn: updateContractExpiryAlertSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.integrationSettings.contractExpiryAlert(), updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp hết hiệu lực.');
    },
    onError: (error) => {
      addToast?.('error', 'Lưu cấu hình cảnh báo thất bại', extractErrorMessage(error));
    },
  });

  const saveContractPaymentMutation = useMutation({
    mutationFn: updateContractPaymentAlertSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.integrationSettings.contractPaymentAlert(), updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp thanh toán.');
    },
    onError: (error) => {
      addToast?.('error', 'Lưu cấu hình cảnh báo thanh toán thất bại', extractErrorMessage(error));
    },
  });

  const saveEmailSmtpMutation = useMutation({
    mutationFn: updateEmailSmtpIntegrationSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.integrationSettings.emailSmtp(), updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình Email SMTP.');
    },
    onError: (error) => {
      addToast?.('error', 'Lưu cấu hình thất bại', extractErrorMessage(error));
    },
  });

  const testEmailSmtpMutation = useMutation({
    mutationFn: testEmailSmtpIntegrationSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.integrationSettings.emailSmtp(),
        (current: EmailSmtpIntegrationSettings | null | undefined) =>
          current
            ? {
                ...current,
                last_test_status: result.status ?? current.last_test_status,
                last_test_message: result.message ?? current.last_test_message,
                last_tested_at: result.tested_at ?? current.last_tested_at,
              }
            : current ?? null,
      );
      addToast?.('success', 'Kết nối Email SMTP', result.message || 'Kết nối thành công.');
    },
    onError: (error) => {
      addToast?.('error', 'Kiểm tra kết nối thất bại', extractErrorMessage(error));
    },
  });

  const testBackblazeMutation = useMutation({
    mutationFn: testBackblazeB2IntegrationSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.integrationSettings.backblazeB2(),
        (current: BackblazeB2IntegrationSettings | null | undefined) =>
          current
            ? {
                ...current,
                last_test_status: result.status ?? current.last_test_status,
                last_test_message: result.message ?? current.last_test_message,
                last_tested_at: result.tested_at ?? current.last_tested_at,
              }
            : current ?? null,
      );
      addToast?.('success', 'Kết nối Backblaze B2', result.message || 'Kết nối thành công.');
    },
    onError: (error) => {
      addToast?.('error', 'Kiểm tra kết nối thất bại', extractErrorMessage(error));
    },
  });

  const testGoogleDriveMutation = useMutation({
    mutationFn: testGoogleDriveIntegrationSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.integrationSettings.googleDrive(),
        (current: GoogleDriveIntegrationSettings | null | undefined) =>
          current
            ? {
                ...current,
                last_test_status: result.status ?? current.last_test_status,
                last_test_message: result.message ?? current.last_test_message,
                last_tested_at: result.tested_at ?? current.last_tested_at,
                account_email: result.user_email ?? current.account_email,
              }
            : current ?? null,
      );
      addToast?.('success', 'Kết nối Google Drive', result.message || 'Kết nối thành công.');
    },
    onError: (error) => {
      addToast?.('error', 'Kiểm tra kết nối thất bại', extractErrorMessage(error));
    },
  });

  const refreshIntegrationSettings = useCallback(async () => {
    await Promise.all([
      backblazeQuery.refetch(),
      googleDriveQuery.refetch(),
      emailSmtpQuery.refetch(),
      contractExpiryQuery.refetch(),
      contractPaymentQuery.refetch(),
    ]);
  }, [backblazeQuery, contractExpiryQuery, contractPaymentQuery, emailSmtpQuery, googleDriveQuery]);

  const error =
    extractErrorMessage(backblazeQuery.error, '') ||
    extractErrorMessage(googleDriveQuery.error, '') ||
    extractErrorMessage(emailSmtpQuery.error, '') ||
    extractErrorMessage(contractExpiryQuery.error, '') ||
    extractErrorMessage(contractPaymentQuery.error, '') ||
    null;

  return {
    backblazeB2Settings: backblazeQuery.data ?? null,
    googleDriveSettings: googleDriveQuery.data ?? null,
    emailSmtpSettings: emailSmtpQuery.data ?? null,
    contractExpiryAlertSettings: contractExpiryQuery.data ?? null,
    contractPaymentAlertSettings: contractPaymentQuery.data ?? null,
    loadingStates: {
      isBackblazeB2SettingsLoading: backblazeQuery.isLoading || backblazeQuery.isFetching,
      isBackblazeB2SettingsSaving: saveBackblazeMutation.isPending,
      isBackblazeB2SettingsTesting: testBackblazeMutation.isPending,
      isGoogleDriveSettingsLoading: googleDriveQuery.isLoading || googleDriveQuery.isFetching,
      isGoogleDriveSettingsSaving: saveGoogleDriveMutation.isPending,
      isGoogleDriveSettingsTesting: testGoogleDriveMutation.isPending,
      isEmailSmtpSettingsLoading: emailSmtpQuery.isLoading || emailSmtpQuery.isFetching,
      isEmailSmtpSettingsSaving: saveEmailSmtpMutation.isPending,
      isEmailSmtpSettingsTesting: testEmailSmtpMutation.isPending,
      isContractExpiryAlertSettingsLoading: contractExpiryQuery.isLoading || contractExpiryQuery.isFetching,
      isContractExpiryAlertSettingsSaving: saveContractExpiryMutation.isPending,
      isContractPaymentAlertSettingsLoading: contractPaymentQuery.isLoading || contractPaymentQuery.isFetching,
      isContractPaymentAlertSettingsSaving: saveContractPaymentMutation.isPending,
    },
    error,
    refreshIntegrationSettings,
    handleSaveBackblazeB2Settings: useCallback(async (payload) => {
      await saveBackblazeMutation.mutateAsync(payload);
    }, [saveBackblazeMutation]),
    handleSaveGoogleDriveSettings: useCallback(async (payload) => {
      await saveGoogleDriveMutation.mutateAsync(payload);
    }, [saveGoogleDriveMutation]),
    handleSaveEmailSmtpSettings: useCallback(async (payload) => {
      await saveEmailSmtpMutation.mutateAsync(payload);
    }, [saveEmailSmtpMutation]),
    handleSaveContractExpiryAlertSettings: useCallback(async (payload) => {
      await saveContractExpiryMutation.mutateAsync(payload);
    }, [saveContractExpiryMutation]),
    handleSaveContractPaymentAlertSettings: useCallback(async (payload) => {
      await saveContractPaymentMutation.mutateAsync(payload);
    }, [saveContractPaymentMutation]),
    handleTestBackblazeB2Integration: useCallback(async (payload) => {
      return await testBackblazeMutation.mutateAsync(payload);
    }, [testBackblazeMutation]),
    handleTestGoogleDriveIntegration: useCallback(async (payload) => {
      return await testGoogleDriveMutation.mutateAsync(payload);
    }, [testGoogleDriveMutation]),
    handleTestEmailSmtpIntegration: useCallback(async (payload) => {
      return await testEmailSmtpMutation.mutateAsync(payload);
    }, [testEmailSmtpMutation]),
  };
}
