import React, { useEffect, useMemo, useState } from 'react';
import {
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
} from '../types';

type SettingsGroup = 'GOOGLE_DRIVE' | 'BACKBLAZE_B2' | 'EMAIL_SMTP' | 'CONTRACT_EXPIRY_ALERT' | 'CONTRACT_PAYMENT_ALERT';

interface IntegrationSettingsPanelProps {
  backblazeB2Settings: BackblazeB2IntegrationSettings | null;
  settings: GoogleDriveIntegrationSettings | null;
  emailSmtpSettings: EmailSmtpIntegrationSettings | null;
  contractExpiryAlertSettings: ContractExpiryAlertSettings | null;
  contractPaymentAlertSettings: ContractPaymentAlertSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isSavingBackblazeB2: boolean;
  isTestingBackblazeB2: boolean;
  isSavingEmailSmtp: boolean;
  isTestingEmailSmtp: boolean;
  isSavingContractExpiryAlert: boolean;
  isSavingContractPaymentAlert: boolean;
  onRefresh: () => Promise<void>;
  onSaveBackblazeB2: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<void>;
  onSave: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<void>;
  onSaveEmailSmtp: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<void>;
  onTestEmailSmtp: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
  }>;
  onSaveContractExpiryAlert: (payload: ContractExpiryAlertSettingsUpdatePayload) => Promise<void>;
  onSaveContractPaymentAlert: (payload: ContractPaymentAlertSettingsUpdatePayload) => Promise<void>;
  onTestBackblazeB2: (payload: BackblazeB2IntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
  onTest: (payload: GoogleDriveIntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    user_email?: string | null;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
}

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const buildBackblazeEndpointFromRegion = (value: unknown): string => {
  const normalizedRegion = normalizeText(value);
  if (normalizedRegion === '') {
    return '';
  }

  return `https://s3.${normalizedRegion}.backblazeb2.com`;
};

const extractServiceAccountClientEmail = (rawJson: string): string | null => {
  const normalized = String(rawJson || '').trim();
  if (normalized === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as { client_email?: unknown };
    const clientEmail = String(parsed?.client_email ?? '').trim();
    return clientEmail !== '' ? clientEmail : null;
  } catch {
    return null;
  }
};

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
  { value: 'BACKBLAZE_B2', label: 'Cấu hình Backblaze B2' },
  { value: 'EMAIL_SMTP', label: 'Cấu hình gửi Email qua Gmail' },
  { value: 'CONTRACT_EXPIRY_ALERT', label: 'Cảnh báo hợp đồng sắp hết hiệu lực' },
  { value: 'CONTRACT_PAYMENT_ALERT', label: 'Cảnh báo hợp đồng sắp thanh toán' },
];

export const IntegrationSettingsPanel: React.FC<IntegrationSettingsPanelProps> = ({
  backblazeB2Settings,
  settings,
  emailSmtpSettings,
  contractExpiryAlertSettings,
  contractPaymentAlertSettings,
  isLoading,
  isSaving,
  isTesting,
  isSavingBackblazeB2,
  isTestingBackblazeB2,
  isSavingEmailSmtp,
  isTestingEmailSmtp,
  isSavingContractExpiryAlert,
  isSavingContractPaymentAlert,
  onRefresh,
  onSaveBackblazeB2,
  onSave,
  onSaveEmailSmtp,
  onTestEmailSmtp,
  onSaveContractExpiryAlert,
  onSaveContractPaymentAlert,
  onTestBackblazeB2,
  onTest,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<SettingsGroup>('GOOGLE_DRIVE');

  const [isBackblazeEnabled, setIsBackblazeEnabled] = useState(false);
  const [backblazeAccessKeyId, setBackblazeAccessKeyId] = useState('');
  const [backblazeBucketId, setBackblazeBucketId] = useState('');
  const [backblazeBucketName, setBackblazeBucketName] = useState('');
  const [backblazeRegion, setBackblazeRegion] = useState('');
  const [backblazeFilePrefix, setBackblazeFilePrefix] = useState('');
  const [backblazeSecretAccessKey, setBackblazeSecretAccessKey] = useState('');
  const [clearBackblazeSecret, setClearBackblazeSecret] = useState(false);
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

  // Email SMTP state
  const [isEmailEnabled, setIsEmailEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>('tls');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [smtpFromAddress, setSmtpFromAddress] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('VNPT Business');
  const [displayedEmailTestStatus, setDisplayedEmailTestStatus] = useState<EmailSmtpIntegrationSettings['last_test_status']>(null);
  const [displayedEmailTestMessage, setDisplayedEmailTestMessage] = useState('');
  const [displayedEmailTestedAt, setDisplayedEmailTestedAt] = useState<string | null>(null);

  const [displayedBackblazeTestStatus, setDisplayedBackblazeTestStatus] = useState<BackblazeB2IntegrationSettings['last_test_status']>(null);
  const [displayedBackblazeTestMessage, setDisplayedBackblazeTestMessage] = useState('');
  const [displayedBackblazeTestedAt, setDisplayedBackblazeTestedAt] = useState<string | null>(null);
  const [displayedTestStatus, setDisplayedTestStatus] = useState<GoogleDriveIntegrationSettings['last_test_status']>(null);
  const [displayedTestMessage, setDisplayedTestMessage] = useState('');
  const [displayedTestedAt, setDisplayedTestedAt] = useState<string | null>(null);

  useEffect(() => {
    setIsBackblazeEnabled(Boolean(backblazeB2Settings?.is_enabled));
    setBackblazeAccessKeyId(backblazeB2Settings?.access_key_id || '');
    setBackblazeBucketId(backblazeB2Settings?.bucket_id || '');
    setBackblazeBucketName(backblazeB2Settings?.bucket_name || '');
    setBackblazeRegion(backblazeB2Settings?.region || '');
    setBackblazeFilePrefix(backblazeB2Settings?.file_prefix || '');
    setBackblazeSecretAccessKey('');
    setClearBackblazeSecret(false);
  }, [backblazeB2Settings]);

  const backblazeDerivedEndpoint = useMemo(
    () => buildBackblazeEndpointFromRegion(backblazeRegion),
    [backblazeRegion]
  );

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

  useEffect(() => {
    setDisplayedBackblazeTestStatus(backblazeB2Settings?.last_test_status ?? null);
    setDisplayedBackblazeTestMessage(backblazeB2Settings?.last_test_message || '');
    setDisplayedBackblazeTestedAt(backblazeB2Settings?.last_tested_at || null);
  }, [backblazeB2Settings?.last_test_message, backblazeB2Settings?.last_test_status, backblazeB2Settings?.last_tested_at]);

  useEffect(() => {
    setDisplayedTestStatus(settings?.last_test_status ?? null);
    setDisplayedTestMessage(settings?.last_test_message || '');
    setDisplayedTestedAt(settings?.last_tested_at || null);
  }, [settings?.last_test_message, settings?.last_test_status, settings?.last_tested_at]);

  useEffect(() => {
    const host = emailSmtpSettings?.smtp_host || 'smtp.gmail.com';
    setIsEmailEnabled(Boolean(emailSmtpSettings?.is_enabled));
    setSmtpHost(host);
    setSmtpPort(emailSmtpSettings?.smtp_port || (emailSmtpSettings?.smtp_encryption === 'ssl' ? 465 : 587));
    setSmtpEncryption((emailSmtpSettings?.smtp_encryption as 'tls' | 'ssl' | 'none') || 'tls');
    setSmtpUsername(emailSmtpSettings?.smtp_username || '');
    setSmtpPassword('');
    setClearSmtpPassword(false);
    setSmtpFromAddress(emailSmtpSettings?.smtp_from_address || '');
    setSmtpFromName(emailSmtpSettings?.smtp_from_name || 'VNPT Business');
    setDisplayedEmailTestStatus(emailSmtpSettings?.last_test_status ?? null);
    setDisplayedEmailTestMessage(emailSmtpSettings?.last_test_message || '');
    setDisplayedEmailTestedAt(emailSmtpSettings?.last_tested_at || null);
  }, [emailSmtpSettings]);

  const backblazeTestStatusClass = useMemo(() => {
    if (displayedBackblazeTestStatus === 'SUCCESS') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (displayedBackblazeTestStatus === 'FAILED') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-slate-100 text-slate-600';
  }, [displayedBackblazeTestStatus]);

  const testStatusClass = useMemo(() => {
    if (displayedTestStatus === 'SUCCESS') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (displayedTestStatus === 'FAILED') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-slate-100 text-slate-600';
  }, [displayedTestStatus]);

  const globalBusy =
    isLoading ||
    isSavingBackblazeB2 ||
    isTestingBackblazeB2 ||
    isSaving ||
    isTesting ||
    isSavingEmailSmtp ||
    isTestingEmailSmtp ||
    isSavingContractExpiryAlert ||
    isSavingContractPaymentAlert;

  const buildBackblazePayload = (): BackblazeB2IntegrationSettingsUpdatePayload => {
    const payload: BackblazeB2IntegrationSettingsUpdatePayload = {
      is_enabled: isBackblazeEnabled,
      access_key_id: normalizeText(backblazeAccessKeyId) || null,
      bucket_id: normalizeText(backblazeBucketId) || null,
      bucket_name: normalizeText(backblazeBucketName) || null,
      region: normalizeText(backblazeRegion) || null,
      file_prefix: normalizeText(backblazeFilePrefix) || null,
      clear_secret_access_key: clearBackblazeSecret,
    };

    const rawSecret = normalizeText(backblazeSecretAccessKey);
    if (rawSecret !== '' && !clearBackblazeSecret) {
      payload.secret_access_key = rawSecret;
    }

    return payload;
  };

  const buildGoogleDrivePayload = (): GoogleDriveIntegrationSettingsUpdatePayload => {
    const rawJson = normalizeText(serviceAccountJson);
    const clientEmailFromJson = !clearCredentials ? extractServiceAccountClientEmail(rawJson) : null;
    const payload: GoogleDriveIntegrationSettingsUpdatePayload = {
      is_enabled: isEnabled,
      account_email: clientEmailFromJson ?? (normalizeText(accountEmail) || null),
      folder_id: normalizeText(folderId) || null,
      scopes: normalizeText(scopes) || null,
      impersonate_user: normalizeText(impersonateUser) || null,
      file_prefix: normalizeText(filePrefix) || null,
      clear_service_account_json: clearCredentials,
    };

    if (rawJson && !clearCredentials) {
      payload.service_account_json = rawJson;
    }

    return payload;
  };

  const handleSaveBackblaze = async () => {
    await onSaveBackblazeB2(buildBackblazePayload());
  };

  const handleSaveGoogleDrive = async () => {
    await onSave(buildGoogleDrivePayload());
  };

  const handleTestBackblaze = async () => {
    try {
      const result = await onTestBackblazeB2(buildBackblazePayload());
      setDisplayedBackblazeTestStatus(result.status || 'SUCCESS');
      setDisplayedBackblazeTestMessage(result.message || 'Kết nối thành công.');
      setDisplayedBackblazeTestedAt(result.tested_at || new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      setDisplayedBackblazeTestStatus('FAILED');
      setDisplayedBackblazeTestMessage(message);
      setDisplayedBackblazeTestedAt(new Date().toISOString());
    }
  };

  const handleTestGoogleDrive = async () => {
    try {
      const result = await onTest(buildGoogleDrivePayload());
      setDisplayedTestStatus(result.status || 'SUCCESS');
      setDisplayedTestMessage(result.message || 'Kết nối thành công.');
      setDisplayedTestedAt(result.tested_at || new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      setDisplayedTestStatus('FAILED');
      setDisplayedTestMessage(message);
      setDisplayedTestedAt(new Date().toISOString());
    }
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

  const buildEmailPayload = (): EmailSmtpIntegrationSettingsUpdatePayload => {
    const payload: EmailSmtpIntegrationSettingsUpdatePayload = {
      is_enabled: isEmailEnabled,
      smtp_host: smtpHost || null,
      smtp_port: smtpPort || null,
      smtp_encryption: smtpEncryption || 'tls',
      smtp_username: smtpUsername || null,
      smtp_from_address: smtpFromAddress || null,
      smtp_from_name: smtpFromName || null,
    };

    if (clearSmtpPassword) {
      payload.clear_smtp_password = true;
    } else if (smtpPassword) {
      payload.smtp_password = smtpPassword;
    }

    return payload;
  };

  const handleSaveEmailSmtp = async () => {
    await onSaveEmailSmtp(buildEmailPayload());
  };

  const handleTestEmailSmtp = async () => {
    try {
      const result = await onTestEmailSmtp(buildEmailPayload());
      setDisplayedEmailTestStatus(result.status || 'SUCCESS');
      setDisplayedEmailTestMessage(result.message || 'Kết nối thành công.');
      setDisplayedEmailTestedAt(result.tested_at || new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      setDisplayedEmailTestStatus('FAILED');
      setDisplayedEmailTestMessage(message);
      setDisplayedEmailTestedAt(new Date().toISOString());
    }
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 md:mb-8">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

        {selectedGroup === 'BACKBLAZE_B2' && (
          <>
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="material-symbols-outlined text-primary text-base">cloud_upload</span>
                  Cấu hình Backblaze B2
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${backblazeTestStatusClass}`}>
                  {displayedBackblazeTestStatus === 'SUCCESS'
                    ? 'Kết nối thành công'
                    : displayedBackblazeTestStatus === 'FAILED'
                      ? 'Kết nối lỗi'
                      : 'Chưa kiểm tra'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestBackblaze()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-3 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isTestingBackblazeB2 ? 'animate-spin' : ''}`}>
                    {isTestingBackblazeB2 ? 'progress_activity' : 'verified'}
                  </span>
                  Kiểm tra kết nối
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveBackblaze()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isSavingBackblazeB2 ? 'animate-spin' : ''}`}>
                    {isSavingBackblazeB2 ? 'progress_activity' : 'save'}
                  </span>
                  Lưu cấu hình
                </button>
              </div>
            </div>

            <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Bật tích hợp Backblaze B2</label>
                <button
                  type="button"
                  onClick={() => setIsBackblazeEnabled((prev) => !prev)}
                  className={`w-full h-11 rounded-lg border text-sm font-bold transition-colors ${
                    isBackblazeEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isBackblazeEnabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Application Key ID</label>
                <input
                  type="text"
                  value={backblazeAccessKeyId}
                  onChange={(event) => setBackblazeAccessKeyId(event.target.value)}
                  placeholder="00438a9b..."
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Bucket ID</label>
                <input
                  type="text"
                  value={backblazeBucketId}
                  onChange={(event) => setBackblazeBucketId(event.target.value)}
                  placeholder="93f8ca298bf4d00098c80518"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Bucket name</label>
                <input
                  type="text"
                  value={backblazeBucketName}
                  onChange={(event) => setBackblazeBucketName(event.target.value)}
                  placeholder="tailieu-qlcv"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Region</label>
                <input
                  type="text"
                  value={backblazeRegion}
                  onChange={(event) => setBackblazeRegion(event.target.value)}
                  placeholder="us-west-004"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Endpoint suy ra từ Region</label>
                <div className="w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  {backblazeDerivedEndpoint || 'Nhập Region để hệ thống tự suy endpoint.'}
                </div>
                <p className="text-xs text-slate-500">
                  Đây là endpoint tham khảo do hệ thống tự suy từ Region, ví dụ <strong>https://s3.us-west-004.backblazeb2.com</strong>.
                </p>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Tiền tố file</label>
                <input
                  type="text"
                  value={backblazeFilePrefix}
                  onChange={(event) => setBackblazeFilePrefix(event.target.value)}
                  placeholder="VNPT"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-sm font-bold text-slate-700">Application Key</label>
                <textarea
                  value={backblazeSecretAccessKey}
                  onChange={(event) => {
                    setBackblazeSecretAccessKey(event.target.value);
                    if (normalizeText(event.target.value)) {
                      setClearBackblazeSecret(false);
                    }
                  }}
                  rows={5}
                  placeholder="Dán Application Key vào đây (để trống nếu giữ nguyên cấu hình hiện tại)."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={clearBackblazeSecret}
                    onChange={(event) => {
                      setClearBackblazeSecret(event.target.checked);
                      if (event.target.checked) {
                        setBackblazeSecretAccessKey('');
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  Xóa Application Key đang lưu
                </label>
                <p className="text-xs text-slate-500">
                  Trạng thái key hiện tại: <strong>{backblazeB2Settings?.has_secret_access_key ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
                </p>
                {backblazeB2Settings?.has_secret_access_key && backblazeB2Settings?.secret_access_key_preview ? (
                  <p className="text-xs text-slate-500 break-all">
                    Application Key đang lưu: <strong className="font-mono">{backblazeB2Settings.secret_access_key_preview}</strong>
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">
                  Application Key được lưu mã hóa trên hệ thống. UI chỉ hiển thị preview đã che để đối chiếu cấu hình.
                </p>
              </div>
            </div>

            <div className="px-5 md:px-6 pb-5 md:pb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="font-bold text-slate-700">Nguồn cấu hình</p>
                  <p>{backblazeB2Settings?.source || 'ENV'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Lần kiểm tra gần nhất</p>
                  <p>{formatTestTime(displayedBackblazeTestedAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Thông điệp hệ thống</p>
                  <p className="break-words">{displayedBackblazeTestMessage || '--'}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedGroup === 'EMAIL_SMTP' && (
          <>
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="material-symbols-outlined text-primary text-base">mail</span>
                  Cấu hình gửi Email qua Gmail
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  displayedEmailTestStatus === 'SUCCESS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : displayedEmailTestStatus === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {displayedEmailTestStatus === 'SUCCESS'
                    ? 'Kết nối thành công'
                    : displayedEmailTestStatus === 'FAILED'
                      ? 'Kết nối lỗi'
                      : 'Chưa kiểm tra'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestEmailSmtp()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-3 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isTestingEmailSmtp ? 'animate-spin' : ''}`}>
                    {isTestingEmailSmtp ? 'progress_activity' : 'verified'}
                  </span>
                  Kiểm tra kết nối
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEmailSmtp()}
                  disabled={globalBusy}
                  className="flex items-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-3 py-2 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-base ${isSavingEmailSmtp ? 'animate-spin' : ''}`}>
                    {isSavingEmailSmtp ? 'progress_activity' : 'save'}
                  </span>
                  Lưu cấu hình
                </button>
              </div>
            </div>

            <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Bật gửi email</label>
                <button
                  type="button"
                  onClick={() => setIsEmailEnabled((prev) => !prev)}
                  className={`w-full h-11 rounded-lg border text-sm font-bold transition-colors ${
                    isEmailEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {isEmailEnabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">SMTP Host</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(event) => setSmtpHost(event.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">SMTP Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={smtpPort}
                  onChange={(event) => setSmtpPort(Number(event.target.value))}
                  placeholder="587"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <p className="text-xs text-slate-500">Gmail: 587 cho TLS, 465 cho SSL</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Mã hóa</label>
                <select
                  value={smtpEncryption}
                  onChange={(event) => setSmtpEncryption(event.target.value as 'tls' | 'ssl' | 'none')}
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">SMTP Username</label>
                <input
                  type="email"
                  value={smtpUsername}
                  onChange={(event) => setSmtpUsername(event.target.value)}
                  placeholder="your-email@gmail.com"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <p className="text-xs text-slate-500">Địa chỉ email Gmail</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">SMTP Password</label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(event) => {
                    setSmtpPassword(event.target.value);
                    if (event.target.value) {
                      setClearSmtpPassword(false);
                    }
                  }}
                  placeholder="App Password (16 ký tự)"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={clearSmtpPassword}
                    onChange={(event) => {
                      setClearSmtpPassword(event.target.checked);
                      if (event.target.checked) {
                        setSmtpPassword('');
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  Xóa mật khẩu đang lưu
                </label>
                <p className="text-xs text-slate-500">
                  ⚠ Sử dụng App Password nếu bật 2FA
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Email gửi (From)</label>
                <input
                  type="email"
                  value={smtpFromAddress}
                  onChange={(event) => setSmtpFromAddress(event.target.value)}
                  placeholder="your-email@gmail.com"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700">Tên người gửi</label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(event) => setSmtpFromName(event.target.value)}
                  placeholder="VNPT Business"
                  className="w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            <div className="px-5 md:px-6 pb-5 md:pb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="font-bold text-slate-700">Nguồn cấu hình</p>
                  <p>{emailSmtpSettings?.source || 'DEFAULT'}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Lần kiểm tra gần nhất</p>
                  <p>{formatTestTime(displayedEmailTestedAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Thông điệp hệ thống</p>
                  <p className="break-words">{displayedEmailTestMessage || '--'}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedGroup === 'GOOGLE_DRIVE' && (
          <>
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="material-symbols-outlined text-primary text-base">cloud</span>
                  Cấu hình Google Drive
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${testStatusClass}`}>
                  {displayedTestStatus === 'SUCCESS'
                    ? 'Kết nối thành công'
                    : displayedTestStatus === 'FAILED'
                      ? 'Kết nối lỗi'
                      : 'Chưa kiểm tra'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestGoogleDrive()}
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
                <p className="text-xs text-slate-500">
                  Nếu không dùng <strong>Impersonate user</strong>, Folder ID này phải là thư mục nằm trong <strong>Shared Drive</strong>, không phải thư mục thường trong My Drive.
                </p>
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
                    const nextValue = event.target.value;
                    setServiceAccountJson(nextValue);
                    if (normalizeText(nextValue)) {
                      setClearCredentials(false);
                    }
                    const clientEmail = extractServiceAccountClientEmail(nextValue);
                    if (clientEmail) {
                      setAccountEmail(clientEmail);
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
                <p className="text-xs text-slate-500">
                  JSON được lưu mã hóa trên hệ thống và sẽ không hiển thị lại sau khi lưu thành công.
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
                  <p>{formatTestTime(displayedTestedAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Thông điệp hệ thống</p>
                  <p className="break-words">{displayedTestMessage || '--'}</p>
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
