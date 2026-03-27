import { useState, useCallback } from 'react';
import {
  fetchBackblazeB2IntegrationSettings,
  fetchGoogleDriveIntegrationSettings,
  fetchContractExpiryAlertSettings,
  fetchContractPaymentAlertSettings,
  updateBackblazeB2IntegrationSettings,
  updateGoogleDriveIntegrationSettings,
  updateContractExpiryAlertSettings,
  updateContractPaymentAlertSettings,
  testBackblazeB2IntegrationSettings,
  testGoogleDriveIntegrationSettings,
} from '../services/v5Api';
import type {
  BackblazeB2IntegrationSettings,
  BackblazeB2IntegrationSettingsUpdatePayload,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
} from '../types';

interface IntegrationSettingsLoadingStates {
  isBackblazeB2SettingsLoading: boolean;
  isBackblazeB2SettingsSaving: boolean;
  isBackblazeB2SettingsTesting: boolean;
  isGoogleDriveSettingsLoading: boolean;
  isGoogleDriveSettingsSaving: boolean;
  isGoogleDriveSettingsTesting: boolean;
  isContractExpiryAlertSettingsLoading: boolean;
  isContractExpiryAlertSettingsSaving: boolean;
  isContractPaymentAlertSettingsLoading: boolean;
  isContractPaymentAlertSettingsSaving: boolean;
}

interface UseIntegrationSettingsReturn {
  backblazeB2Settings: BackblazeB2IntegrationSettings | null;
  googleDriveSettings: GoogleDriveIntegrationSettings | null;
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  loadingStates: IntegrationSettingsLoadingStates;
  error: string | null;
  refreshIntegrationSettings: () => Promise<void>;
  handleSaveBackblazeB2Settings: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveGoogleDriveSettings: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  handleSaveContractExpiryAlertSettings: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  handleSaveContractPaymentAlertSettings: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  handleTestBackblazeB2Integration: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<{ message?: string }>;
  handleTestGoogleDriveIntegration: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<{ message?: string }>;
}

export function useIntegrationSettings(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseIntegrationSettingsReturn {
  const [backblazeB2Settings, setBackblazeB2Settings] = useState<BackblazeB2IntegrationSettings | null>(null);
  const [googleDriveSettings, setGoogleDriveSettings] = useState<GoogleDriveIntegrationSettings | null>(null);
  const [contractExpiryAlertSettings, setContractExpiryAlertSettings] = useState<ContractExpiryAlertSettings | null>(null);
  const [contractPaymentAlertSettings, setContractPaymentAlertSettings] = useState<ContractPaymentAlertSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isBackblazeB2SettingsLoading, setIsBackblazeB2SettingsLoading] = useState(false);
  const [isBackblazeB2SettingsSaving, setIsBackblazeB2SettingsSaving] = useState(false);
  const [isBackblazeB2SettingsTesting, setIsBackblazeB2SettingsTesting] = useState(false);
  const [isGoogleDriveSettingsLoading, setIsGoogleDriveSettingsLoading] = useState(false);
  const [isGoogleDriveSettingsSaving, setIsGoogleDriveSettingsSaving] = useState(false);
  const [isGoogleDriveSettingsTesting, setIsGoogleDriveSettingsTesting] = useState(false);
  const [isContractExpiryAlertSettingsLoading, setIsContractExpiryAlertSettingsLoading] = useState(false);
  const [isContractExpiryAlertSettingsSaving, setIsContractExpiryAlertSettingsSaving] = useState(false);
  const [isContractPaymentAlertSettingsLoading, setIsContractPaymentAlertSettingsLoading] = useState(false);
  const [isContractPaymentAlertSettingsSaving, setIsContractPaymentAlertSettingsSaving] = useState(false);

  const refreshBackblazeB2Settings = useCallback(async () => {
    setIsBackblazeB2SettingsLoading(true);
    setError(null);
    try {
      const data = await fetchBackblazeB2IntegrationSettings();
      setBackblazeB2Settings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Tải cấu hình Backblaze thất bại', message);
    } finally {
      setIsBackblazeB2SettingsLoading(false);
    }
  }, [addToast]);

  const refreshGoogleDriveSettings = useCallback(async () => {
    setIsGoogleDriveSettingsLoading(true);
    setError(null);
    try {
      const data = await fetchGoogleDriveIntegrationSettings();
      setGoogleDriveSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Tải cấu hình thất bại', message);
    } finally {
      setIsGoogleDriveSettingsLoading(false);
    }
  }, [addToast]);

  const refreshContractExpiryAlertSettings = useCallback(async () => {
    setIsContractExpiryAlertSettingsLoading(true);
    setError(null);
    try {
      const data = await fetchContractExpiryAlertSettings();
      setContractExpiryAlertSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Tải cấu hình cảnh báo thất bại', message);
    } finally {
      setIsContractExpiryAlertSettingsLoading(false);
    }
  }, [addToast]);

  const refreshContractPaymentAlertSettings = useCallback(async () => {
    setIsContractPaymentAlertSettingsLoading(true);
    setError(null);
    try {
      const data = await fetchContractPaymentAlertSettings();
      setContractPaymentAlertSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Tải cấu hình cảnh báo thanh toán thất bại', message);
    } finally {
      setIsContractPaymentAlertSettingsLoading(false);
    }
  }, [addToast]);

  const refreshIntegrationSettings = useCallback(async () => {
    await Promise.all([
      refreshBackblazeB2Settings(),
      refreshGoogleDriveSettings(),
      refreshContractExpiryAlertSettings(),
      refreshContractPaymentAlertSettings(),
    ]);
  }, [refreshBackblazeB2Settings, refreshGoogleDriveSettings, refreshContractExpiryAlertSettings, refreshContractPaymentAlertSettings]);

  const handleSaveBackblazeB2Settings = useCallback(async (payload: BackblazeB2IntegrationSettingsUpdatePayload) => {
    setIsBackblazeB2SettingsSaving(true);
    setError(null);
    try {
      const updated = await updateBackblazeB2IntegrationSettings(payload);
      setBackblazeB2Settings(updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình Backblaze B2.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu cấu hình thất bại', message);
      throw err;
    } finally {
      setIsBackblazeB2SettingsSaving(false);
    }
  }, [addToast]);

  const handleSaveGoogleDriveSettings = useCallback(async (payload: GoogleDriveIntegrationSettingsUpdatePayload) => {
    setIsGoogleDriveSettingsSaving(true);
    setError(null);
    try {
      const updated = await updateGoogleDriveIntegrationSettings(payload);
      setGoogleDriveSettings(updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình Google Drive.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu cấu hình thất bại', message);
      throw err;
    } finally {
      setIsGoogleDriveSettingsSaving(false);
    }
  }, [addToast]);

  const handleSaveContractExpiryAlertSettings = useCallback(async (payload: ContractExpiryAlertSettingsUpdatePayload) => {
    setIsContractExpiryAlertSettingsSaving(true);
    setError(null);
    try {
      const updated = await updateContractExpiryAlertSettings(payload);
      setContractExpiryAlertSettings(updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp hết hiệu lực.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu cấu hình cảnh báo thất bại', message);
      throw err;
    } finally {
      setIsContractExpiryAlertSettingsSaving(false);
    }
  }, [addToast]);

  const handleSaveContractPaymentAlertSettings = useCallback(async (payload: ContractPaymentAlertSettingsUpdatePayload) => {
    setIsContractPaymentAlertSettingsSaving(true);
    setError(null);
    try {
      const updated = await updateContractPaymentAlertSettings(payload);
      setContractPaymentAlertSettings(updated);
      addToast?.('success', 'Thành công', 'Đã lưu cấu hình cảnh báo hợp đồng sắp thanh toán.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu cấu hình cảnh báo thanh toán thất bại', message);
      throw err;
    } finally {
      setIsContractPaymentAlertSettingsSaving(false);
    }
  }, [addToast]);

  const handleTestBackblazeB2Integration = useCallback(async (payload: BackblazeB2IntegrationSettingsUpdatePayload): Promise<{ message?: string }> => {
    setIsBackblazeB2SettingsTesting(true);
    setError(null);
    try {
      const result = await testBackblazeB2IntegrationSettings(payload);
      addToast?.('success', 'Kết nối Backblaze B2', result.message || 'Kết nối thành công.');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Kiểm tra kết nối thất bại', message);
      throw err;
    } finally {
      setIsBackblazeB2SettingsTesting(false);
    }
  }, [addToast]);

  const handleTestGoogleDriveIntegration = useCallback(async (payload: GoogleDriveIntegrationSettingsUpdatePayload): Promise<{ message?: string }> => {
    setIsGoogleDriveSettingsTesting(true);
    setError(null);
    try {
      const result = await testGoogleDriveIntegrationSettings(payload);
      addToast?.('success', 'Kết nối Google Drive', result.message || 'Kết nối thành công.');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Kiểm tra kết nối thất bại', message);
      throw err;
    } finally {
      setIsGoogleDriveSettingsTesting(false);
    }
  }, [addToast]);

  return {
    backblazeB2Settings,
    googleDriveSettings,
    contractExpiryAlertSettings,
    contractPaymentAlertSettings,
    loadingStates: {
      isBackblazeB2SettingsLoading,
      isBackblazeB2SettingsSaving,
      isBackblazeB2SettingsTesting,
      isGoogleDriveSettingsLoading,
      isGoogleDriveSettingsSaving,
      isGoogleDriveSettingsTesting,
      isContractExpiryAlertSettingsLoading,
      isContractExpiryAlertSettingsSaving,
      isContractPaymentAlertSettingsLoading,
      isContractPaymentAlertSettingsSaving,
    },
    error,
    refreshIntegrationSettings,
    handleSaveBackblazeB2Settings,
    handleSaveGoogleDriveSettings,
    handleSaveContractExpiryAlertSettings,
    handleSaveContractPaymentAlertSettings,
    handleTestBackblazeB2Integration,
    handleTestGoogleDriveIntegration,
  };
}