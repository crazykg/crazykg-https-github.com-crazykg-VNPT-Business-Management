import React, { useEffect, useMemo, useState } from 'react';
import {
  ContractExpiryAlertSettings,
  ContractExpiryAlertSettingsUpdatePayload,
  ContractPaymentAlertSettings,
  ContractPaymentAlertSettingsUpdatePayload,
  GoogleDriveIntegrationSettings,
  GoogleDriveIntegrationSettingsUpdatePayload,
} from '../types';

type SettingsGroup = 'GOOGLE_DRIVE' | 'CONTRACT_EXPIRY_ALERT' | 'CONTRACT_PAYMENT_ALERT';

interface IntegrationSettingsPanelProps {
  settings: GoogleDriveIntegrationSettings | null;
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isSavingContractExpiryAlert: boolean;
  isSavingContractPaymentAlert: boolean;
  onRefresh: () => Promise<void>;
  onSave: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  onSaveContractExpiryAlert: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  onSaveContractPaymentAlert: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  onTest: () => Promise<void>;
}

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const formatTestTime = (value: string | null | undefined): string => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN');
};

const SETTINGS_GROUP_OPTIONS: Array<{ value: SettingsGroup; label: string }> = [
  { value: 'GOOGLE_DRIVE', label: 'Cấu hình Google Drive' },
  { value: 'CONTRACT_EXPIRY_ALERT', label: 'Cảnh báo hợp đồng sắp hết hiệu lực' },
  { value: 'CONTRACT_PAYMENT_ALERT', label: 'Cảnh báo hợp đồng sắp thanh toán' },
];

export const IntegrationSettingsPanel: React.FC<IntegrationSettingsPanelProps> = ({
  settings,
  contractExpiryAlertSettings,
  contractPaymentAlertSettings,
  isLoading,
  isSaving,
  isTesting,
  isSavingContractExpiryAlert,
  isSavingContractPaymentAlert,
  onRefresh,
  onSave,
  onSaveContractExpiryAlert,
  onSaveContractPaymentAlert,
  onTest,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<SettingsGroup>('GOOGLE_DRIVE');

  const [isEnabled, setIsEnabled] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [folderId, setFolderId] = useState('');
  const [scopes, setScopes] = useState('https://www.googleapis.com/auth/drive.file');
  const [impersonateUser, setImpersonateUser] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [clearCredentials, setClearCredentials] = useState(false);
  const [expiryWarningDays, setExpiryWarningDays] = useState('30');
  const [paymentWarningDays, setPaymentWarningDays] = useState('30');

  useEffect(() => {
    setIsEnabled(Boolean(settings?.is_enabled));
    setAccountEmail(settings?.account_email || '');
    setFolderId(settings?.folder_id || '');
    setScopes(settings?.scopes || 'https://www.googleapis.com/auth/drive.file');
    setImpersonateUser(settings?.impersonate_user || '');
    setFilePrefix(settings?.file_prefix || '');
    setServiceAccountJson('');
    setClearCredentials(false);
  }, [settings]);

  useEffect(() => {
    const value = Number(contractExpiryAlertSettings?.warning_days ?? 30);
    if (Number.isFinite(value) && value > 0) {
      setExpiryWarningDays(String(Math.floor(value)));
      return;
    }
    setExpiryWarningDays('30');
  }, [contractExpiryAlertSettings]);

  useEffect(() => {
    const value = Number(contractPaymentAlertSettings?.warning_days ?? 30);
    if (Number.isFinite(value) && value > 0) {
      setPaymentWarningDays(String(Math.floor(value)));
      return;
    }
    setPaymentWarningDays('30');
  }, [contractPaymentAlertSettings]);

  const testStatusClass = useMemo(() => {
    if (settings?.last_test_status === 'SUCCESS') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (settings?.last_test_status === 'FAILED') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-slate-100 text-slate-600';
  }, [settings?.last_test_status]);

  const globalBusy =
    isLoading ||
    isSaving ||
    isTesting ||
    isSavingContractExpiryAlert ||
    isSavingContractPaymentAlert;

  const handleSaveGoogleDrive = async () => {
    const payload: GoogleDriveIntegrationSettingsUpdatePayload = {
      is_enabled: isEnabled,
      account_email: normalizeText(accountEmail) || null,
      folder_id: normalizeText(folderId) || null,
      scopes: normalizeText(scopes) || null,
      impersonate_user: normalizeText(impersonateUser) || null,
      file_prefix: normalizeText(filePrefix) || null,
      clear_service_account_json: clearCredentials,
    };

    const rawJson = normalizeText(serviceAccountJson);
    if (rawJson && !clearCredentials) {
      payload.service_account_json = rawJson;
    }

    await onSave(payload);
  };

  const handleSaveContractExpiryAlert = async () => {
    const parsed = Number(expiryWarningDays);
    const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    await onSaveContractExpiryAlert({ warning_days: normalized });
  };

  const handleSaveContractPaymentAlert = async () => {
    const parsed = Number(paymentWarningDays);
    const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    await onSaveContractPaymentAlert({ warning_days: normalized });
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Cấu hình tích hợp</h2>
          <p className="text-slate-500 text-sm mt-1">Quản trị kết nối hệ thống và các ngưỡng cảnh báo tiện ích.</p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={globalBusy}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Làm mới
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
        <div className="p-5 md:p-6 border-b border-slate-100">
          <label className="text-sm font-bold text-slate-700">Chọn nhóm cấu hình</label>
          <select
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value as SettingsGroup)}
            className="mt-2 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          >
            {SETTINGS_GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {selectedGroup === 'GOOGLE_DRIVE' && (
          <>
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="material-symbols-outlined text-primary text-base">cloud</span>
                  Cấu hình Google Drive
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${testStatusClass}`}>
                  {settings?.last_test_status === 'SUCCESS'
                    ? 'Kết nối thành công'
                    : settings?.last_test_status === 'FAILED'
                      ? 'Kết nối lỗi'
                      : 'Chưa kiểm tra'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onTest()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-3 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isTesting ? 'animate-spin' : ''}`}>
                    {isTesting ? 'progress_activity' : 'verified'}
                  </span>
                  Kiểm tra kết nối
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGoogleDrive()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isSaving ? 'animate-spin' : ''}`}>
                    {isSaving ? 'progress_activity' : 'save'}
                  </span>
                  Lưu cấu hình
                </button>
              </div>
            </div>

            <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Bật tích hợp Google Drive</label>
                <button
                  type="button"
                  onClick={() => setIsEnabled((prev) => !prev)}
                  className={`w-full h-11 rounded-lg border text-sm font-bold transition-colors ${
                    isEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isEnabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Email tài khoản dịch vụ</label>
                <input
                  type="text"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  placeholder="vnpthishg@gmail.com hoặc service-account@..."
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Google Drive Folder ID</label>
                <input
                  type="text"
                  value={folderId}
                  onChange={(event) => setFolderId(event.target.value)}
                  placeholder="1AbCdEfGh..."
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Tiền tố file</label>
                <input
                  type="text"
                  value={filePrefix}
                  onChange={(event) => setFilePrefix(event.target.value)}
                  placeholder="VNPT"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Scopes</label>
                <input
                  type="text"
                  value={scopes}
                  onChange={(event) => setScopes(event.target.value)}
                  placeholder="https://www.googleapis.com/auth/drive.file"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Impersonate user (tuỳ chọn)</label>
                <input
                  type="text"
                  value={impersonateUser}
                  onChange={(event) => setImpersonateUser(event.target.value)}
                  placeholder="user@domain.com"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Service Account JSON</label>
                <textarea
                  value={serviceAccountJson}
                  onChange={(event) => {
                    setServiceAccountJson(event.target.value);
                    if (normalizeText(event.target.value)) {
                      setClearCredentials(false);
                    }
                  }}
                  rows={8}
                  placeholder="Dán JSON service account vào đây (để trống nếu giữ nguyên cấu hình hiện tại)."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={clearCredentials}
                    onChange={(event) => {
                      setClearCredentials(event.target.checked);
                      if (event.target.checked) {
                        setServiceAccountJson('');
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  Xóa Service Account JSON đang lưu
                </label>
                <p className="text-xs text-slate-500">
                  Trạng thái key hiện tại: <strong>{settings?.has_service_account_json ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
                </p>
              </div>
            </div>

            <div className="px-5 md:px-6 pb-5 md:pb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="font-bold text-slate-700">Nguồn cấu hình</p>
                  <p>{settings?.source || 'ENV'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Lần kiểm tra gần nhất</p>
                  <p>{formatTestTime(settings?.last_tested_at || null)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Thông điệp hệ thống</p>
                  <p className="break-words">{settings?.last_test_message || '--'}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedGroup === 'CONTRACT_EXPIRY_ALERT' && (
          <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Số ngày cảnh báo hợp đồng sắp hết hiệu lực</label>
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                value={expiryWarningDays}
                onChange={(event) => setExpiryWarningDays(event.target.value)}
                placeholder="30"
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <p className="text-xs text-slate-500">
                KPI cảnh báo các hợp đồng có ngày hết hiệu lực nằm trong khoảng từ hôm nay đến số ngày này.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-700">Thông tin cấu hình hiện tại</p>
              <p className="mt-1">Nguồn cấu hình: <strong>{contractExpiryAlertSettings?.source || 'DEFAULT'}</strong></p>
              <p className="mt-1">Lần cập nhật cuối: <strong>{formatTestTime(contractExpiryAlertSettings?.updated_at || null)}</strong></p>
              <p className="mt-1">Ngưỡng hiện tại: <strong>{contractExpiryAlertSettings?.warning_days ?? 30} ngày</strong></p>
            </div>

            <div className="lg:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveContractExpiryAlert()}
                disabled={globalBusy}
                className="inline-flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${isSavingContractExpiryAlert ? 'animate-spin' : ''}`}>
                  {isSavingContractExpiryAlert ? 'progress_activity' : 'save'}
                </span>
                Lưu cấu hình cảnh báo hết hiệu lực
              </button>
            </div>
          </div>
        )}

        {selectedGroup === 'CONTRACT_PAYMENT_ALERT' && (
          <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">Số ngày cảnh báo khách hàng sắp thanh toán</label>
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                value={paymentWarningDays}
                onChange={(event) => setPaymentWarningDays(event.target.value)}
                placeholder="30"
                className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <p className="text-xs text-slate-500">
                KPI chỉ tính hợp đồng theo chu kỳ (không tính một lần), và cảnh báo khi đến hạn thanh toán trong khoảng số ngày này.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-700">Thông tin cấu hình hiện tại</p>
              <p className="mt-1">Nguồn cấu hình: <strong>{contractPaymentAlertSettings?.source || 'DEFAULT'}</strong></p>
              <p className="mt-1">Lần cập nhật cuối: <strong>{formatTestTime(contractPaymentAlertSettings?.updated_at || null)}</strong></p>
              <p className="mt-1">Ngưỡng hiện tại: <strong>{contractPaymentAlertSettings?.warning_days ?? 30} ngày</strong></p>
            </div>

            <div className="lg:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveContractPaymentAlert()}
                disabled={globalBusy}
                className="inline-flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-base ${isSavingContractPaymentAlert ? 'animate-spin' : ''}`}>
                  {isSavingContractPaymentAlert ? 'progress_activity' : 'save'}
                </span>
                Lưu cấu hình cảnh báo thanh toán
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
