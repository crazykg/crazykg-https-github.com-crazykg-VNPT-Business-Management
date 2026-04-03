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
  onTestEmailSmtp: (payload: EmailSmtpIntegrationSettingsUpdatePayload) => Promise<{
    message?: string;
    status?: 'SUCCESS' | 'FAILED';
    tested_at?: string | null;
    persisted?: boolean;
  }>;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const buildBackblazeEndpointFromRegion = (value: unknown): string => {
  const normalizedRegion = normalizeText(value);
  if (normalizedRegion === '') return '';
  return `https://s3.${normalizedRegion}.backblazeb2.com`;
};

const extractServiceAccountClientEmail = (rawJson: string): string | null => {
  const normalized = String(rawJson || '').trim();
  if (normalized === '') return null;
  try {
    const parsed = JSON.parse(normalized) as { client_email?: unknown };
    const clientEmail = String(parsed?.client_email ?? '').trim();
    return clientEmail !== '' ? clientEmail : null;
  } catch {
    return null;
  }
};

const formatTestTime = (value: string | null | undefined): string => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN');
};

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ value: SettingsGroup; label: string; sub: string; icon: string; iconColor: string }> = [
  { value: 'GOOGLE_DRIVE',           label: 'Google Drive',       sub: 'Lưu trữ tài liệu',      icon: 'cloud',        iconColor: 'text-secondary' },
  { value: 'BACKBLAZE_B2',           label: 'Backblaze B2',       sub: 'Object Storage S3',      icon: 'cloud_upload', iconColor: 'text-secondary' },
  { value: 'EMAIL_SMTP',             label: 'Email SMTP',         sub: 'Gửi email qua SMTP',     icon: 'mail',         iconColor: 'text-primary' },
  { value: 'CONTRACT_EXPIRY_ALERT',  label: 'HĐ hết hiệu lực',   sub: 'Cảnh báo ngày hết HLực', icon: 'event_busy',   iconColor: 'text-tertiary'  },
  { value: 'CONTRACT_PAYMENT_ALERT', label: 'HĐ thanh toán',     sub: 'Cảnh báo kỳ thanh toán', icon: 'payments',     iconColor: 'text-tertiary'  },
];

// ── Shared style tokens ───────────────────────────────────────────────────────

const INPUT  = 'w-full h-8 rounded border border-slate-300 px-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400';
const LABEL  = 'block text-xs font-semibold text-neutral mb-1';
const BTN_SM = 'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50';

// ── Sub-components ────────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <div className="col-span-2 flex items-center gap-2.5 py-1.5 border-b border-slate-100 mb-1">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-secondary/40 ${checked ? 'bg-secondary' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
    <span className={`text-xs font-semibold ${checked ? 'text-secondary' : 'text-neutral'}`}>{label}</span>
  </div>
);

const ConnectionBadge: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  if (status === 'SUCCESS') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">● Kết nối thành công</span>;
  if (status === 'FAILED')  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">● Kết nối lỗi</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">○ Chưa kiểm tra</span>;
};

const InfoFooter: React.FC<{ source: string; testedAt: string | null; message: string }> = ({ source, testedAt, message }) => (
  <div className="px-4 pb-3 mt-auto shrink-0">
    <div className="grid grid-cols-3 gap-px rounded overflow-hidden border border-slate-200 text-xs">
      {[
        { label: 'Nguồn cấu hình', value: source },
        { label: 'Kiểm tra gần nhất', value: formatTestTime(testedAt) },
        { label: 'Thông điệp hệ thống', value: message || '--' },
      ].map(({ label, value }) => (
        <div key={label} className="bg-slate-50 px-3 py-2">
          <span className="font-semibold text-slate-600 block mb-0.5">{label}</span>
          <span className="text-slate-500 break-all">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

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
  onSaveContractExpiryAlert,
  onSaveContractPaymentAlert,
  onTestBackblazeB2,
  onTest,
  onTestEmailSmtp,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<SettingsGroup>('GOOGLE_DRIVE');

  // Backblaze state
  const [isBackblazeEnabled,      setIsBackblazeEnabled]      = useState(false);
  const [backblazeAccessKeyId,    setBackblazeAccessKeyId]    = useState('');
  const [backblazeBucketId,       setBackblazeBucketId]       = useState('');
  const [backblazeBucketName,     setBackblazeBucketName]     = useState('');
  const [backblazeRegion,         setBackblazeRegion]         = useState('');
  const [backblazeFilePrefix,     setBackblazeFilePrefix]     = useState('');
  const [backblazeSecretAccessKey,setBackblazeSecretAccessKey]= useState('');
  const [clearBackblazeSecret,    setClearBackblazeSecret]    = useState(false);

  // Google Drive state
  const [isEnabled,           setIsEnabled]           = useState(false);
  const [accountEmail,        setAccountEmail]        = useState('');
  const [folderId,            setFolderId]            = useState('');
  const [scopes,              setScopes]              = useState('https://www.googleapis.com/auth/drive.file');
  const [impersonateUser,     setImpersonateUser]     = useState('');
  const [filePrefix,          setFilePrefix]          = useState('');
  const [serviceAccountJson,  setServiceAccountJson]  = useState('');
  const [clearCredentials,    setClearCredentials]    = useState(false);

  // Email SMTP state
  const [isSmtpEnabled,        setIsSmtpEnabled]        = useState(false);
  const [smtpHost,             setSmtpHost]             = useState('smtp.gmail.com');
  const [smtpPort,             setSmtpPort]             = useState('587');
  const [smtpEncryption,       setSmtpEncryption]       = useState<'tls'|'ssl'|'none'>('tls');
  const [smtpUsername,         setSmtpUsername]         = useState('');
  const [smtpPassword,         setSmtpPassword]         = useState('');
  const [smtpFromAddress,      setSmtpFromAddress]      = useState('');
  const [smtpFromName,         setSmtpFromName]         = useState('VNPT Business');
  const [clearSmtpPassword,    setClearSmtpPassword]    = useState(false);
  const [testRecipientEmail,   setTestRecipientEmail]   = useState('');

  // Alert state
  const [expiryWarningDays,  setExpiryWarningDays]  = useState('30');
  const [paymentWarningDays, setPaymentWarningDays] = useState('30');

  // Displayed test results (optimistic update)
  const [displayedBackblazeTestStatus,  setDisplayedBackblazeTestStatus]  = useState<BackblazeB2IntegrationSettings['last_test_status']>(null);
  const [displayedBackblazeTestMessage, setDisplayedBackblazeTestMessage] = useState('');
  const [displayedBackblazeTestedAt,    setDisplayedBackblazeTestedAt]    = useState<string | null>(null);
  const [displayedTestStatus,  setDisplayedTestStatus]  = useState<GoogleDriveIntegrationSettings['last_test_status']>(null);
  const [displayedTestMessage, setDisplayedTestMessage] = useState('');
  const [displayedTestedAt,    setDisplayedTestedAt]    = useState<string | null>(null);
  const [displayedSmtpTestStatus,  setDisplayedSmtpTestStatus]  = useState<EmailSmtpIntegrationSettings['last_test_status']>(null);
  const [displayedSmtpTestMessage, setDisplayedSmtpTestMessage] = useState('');
  const [displayedSmtpTestedAt,    setDisplayedSmtpTestedAt]    = useState<string | null>(null);

  // ── Effects ─────────────────────────────────────────────────────────────────

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
    [backblazeRegion],
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
    setExpiryWarningDays(Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : '30');
  }, [contractExpiryAlertSettings]);

  useEffect(() => {
    const value = Number(contractPaymentAlertSettings?.warning_days ?? 30);
    setPaymentWarningDays(Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : '30');
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
    setIsSmtpEnabled(Boolean(emailSmtpSettings?.is_enabled));
    setSmtpHost(emailSmtpSettings?.smtp_host || 'smtp.gmail.com');
    setSmtpPort(String(emailSmtpSettings?.smtp_port || 587));
    setSmtpEncryption((emailSmtpSettings?.smtp_encryption as 'tls'|'ssl'|'none') || 'tls');
    setSmtpUsername(emailSmtpSettings?.smtp_username || '');
    setSmtpFromAddress(emailSmtpSettings?.smtp_from_address || '');
    setSmtpFromName(emailSmtpSettings?.smtp_from_name || 'VNPT Business');
    setSmtpPassword('');
    setClearSmtpPassword(false);
    setTestRecipientEmail(emailSmtpSettings?.smtp_username || '');
  }, [emailSmtpSettings]);

  useEffect(() => {
    setDisplayedSmtpTestStatus(emailSmtpSettings?.last_test_status ?? null);
    setDisplayedSmtpTestMessage(emailSmtpSettings?.last_test_message || '');
    setDisplayedSmtpTestedAt(emailSmtpSettings?.last_tested_at || null);
  }, [emailSmtpSettings?.last_test_message, emailSmtpSettings?.last_test_status, emailSmtpSettings?.last_tested_at]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const globalBusy = isLoading || isSavingBackblazeB2 || isTestingBackblazeB2 || isSaving || isTesting || isSavingEmailSmtp || isTestingEmailSmtp || isSavingContractExpiryAlert || isSavingContractPaymentAlert;

  // ── Payload builders ──────────────────────────────────────────────────────────

  const buildBackblazePayload = (): BackblazeB2IntegrationSettingsUpdatePayload => {
    const payload: BackblazeB2IntegrationSettingsUpdatePayload = {
      is_enabled:             isBackblazeEnabled,
      access_key_id:          normalizeText(backblazeAccessKeyId)  || null,
      bucket_id:              normalizeText(backblazeBucketId)     || null,
      bucket_name:            normalizeText(backblazeBucketName)   || null,
      region:                 normalizeText(backblazeRegion)       || null,
      file_prefix:            normalizeText(backblazeFilePrefix)   || null,
      clear_secret_access_key: clearBackblazeSecret,
    };
    const rawSecret = normalizeText(backblazeSecretAccessKey);
    if (rawSecret !== '' && !clearBackblazeSecret) payload.secret_access_key = rawSecret;
    return payload;
  };

  const buildGoogleDrivePayload = (): GoogleDriveIntegrationSettingsUpdatePayload => {
    const rawJson = normalizeText(serviceAccountJson);
    const clientEmailFromJson = !clearCredentials ? extractServiceAccountClientEmail(rawJson) : null;
    const payload: GoogleDriveIntegrationSettingsUpdatePayload = {
      is_enabled:                  isEnabled,
      account_email:               clientEmailFromJson ?? (normalizeText(accountEmail) || null),
      folder_id:                   normalizeText(folderId)         || null,
      scopes:                      normalizeText(scopes)           || null,
      impersonate_user:            normalizeText(impersonateUser)  || null,
      file_prefix:                 normalizeText(filePrefix)       || null,
      clear_service_account_json:  clearCredentials,
    };
    if (rawJson && !clearCredentials) payload.service_account_json = rawJson;
    return payload;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSaveBackblaze = async () => { await onSaveBackblazeB2(buildBackblazePayload()); };
  const handleSaveGoogleDrive = async () => { await onSave(buildGoogleDrivePayload()); };

  const buildEmailSmtpPayload = (): EmailSmtpIntegrationSettingsUpdatePayload => ({
    is_enabled:               isSmtpEnabled,
    smtp_host:                normalizeText(smtpHost) || null,
    smtp_port:                smtpPort ? Number(smtpPort) : null,
    smtp_encryption:          smtpEncryption || 'tls',
    smtp_username:            normalizeText(smtpUsername) || null,
    smtp_password:            normalizeText(smtpPassword) || null,
    clear_smtp_password:      clearSmtpPassword,
    smtp_from_address:        normalizeText(smtpFromAddress) || null,
    smtp_from_name:           normalizeText(smtpFromName) || 'VNPT Business',
    test_recipient_email:     normalizeText(testRecipientEmail) || normalizeText(smtpUsername) || null,
  });

  const handleSaveEmailSmtp = async () => { await onSaveEmailSmtp(buildEmailSmtpPayload()); };

  const handleTestEmailSmtp = async () => {
    try {
      const result = await onTestEmailSmtp(buildEmailSmtpPayload());
      setDisplayedSmtpTestStatus(result.status || 'SUCCESS');
      setDisplayedSmtpTestMessage(result.message || 'Kết nối thành công.');
      setDisplayedSmtpTestedAt(result.tested_at || new Date().toISOString());
    } catch (error) {
      setDisplayedSmtpTestStatus('FAILED');
      setDisplayedSmtpTestMessage(error instanceof Error ? error.message : 'Lỗi không xác định');
      setDisplayedSmtpTestedAt(new Date().toISOString());
    }
  };

  const handleTestBackblaze = async () => {
    try {
      const result = await onTestBackblazeB2(buildBackblazePayload());
      setDisplayedBackblazeTestStatus(result.status || 'SUCCESS');
      setDisplayedBackblazeTestMessage(result.message || 'Kết nối thành công.');
      setDisplayedBackblazeTestedAt(result.tested_at || new Date().toISOString());
    } catch (error) {
      setDisplayedBackblazeTestStatus('FAILED');
      setDisplayedBackblazeTestMessage(error instanceof Error ? error.message : 'Lỗi không xác định');
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
      setDisplayedTestStatus('FAILED');
      setDisplayedTestMessage(error instanceof Error ? error.message : 'Lỗi không xác định');
      setDisplayedTestedAt(new Date().toISOString());
    }
  };

  const handleSaveContractExpiryAlert = async () => {
    const parsed = Number(expiryWarningDays);
    await onSaveContractExpiryAlert({ warning_days: Number.isFinite(parsed) ? Math.floor(parsed) : 0 });
  };

  const handleSaveContractPaymentAlert = async () => {
    const parsed = Number(paymentWarningDays);
    await onSaveContractPaymentAlert({ warning_days: Number.isFinite(parsed) ? Math.floor(parsed) : 0 });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 pb-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>tune</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Cấu hình tích hợp</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Kết nối hệ thống & ngưỡng cảnh báo tiện ích</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={globalBusy}
          className={`${BTN_SM} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          <span className={`material-symbols-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          Làm mới
        </button>
      </div>

      {/* ── Two-pane card ────────────────────────────────────────────────────── */}
      <div className="flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" style={{ minHeight: 460 }}>

        {/* Left navigation */}
        <nav className="w-44 shrink-0 border-r border-slate-200 py-1 bg-slate-50/60">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhóm cấu hình</p>
          {NAV_ITEMS.map((item) => {
            const isActive  = selectedGroup === item.value;
            const connStatus = item.value === 'GOOGLE_DRIVE'   ? displayedTestStatus
                             : item.value === 'BACKBLAZE_B2'   ? displayedBackblazeTestStatus
                             : null;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelectedGroup(item.value)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2 border-l-2 transition-colors ${
                  isActive
                    ? 'bg-secondary/10 border-secondary'
                    : 'border-transparent hover:bg-white/80'
                }`}
              >
                <span
                  className={`material-symbols-outlined shrink-0 mt-0.5 ${isActive ? 'text-secondary' : item.iconColor}`}
                  style={{ fontSize: 17 }}
                >
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold truncate leading-tight ${isActive ? 'text-deep-teal' : 'text-slate-700'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{item.sub}</div>
                  {connStatus !== null && (
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight ${
                      connStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700'
                      : connStatus === 'FAILED' ? 'bg-red-100 text-red-700'
                      : 'bg-slate-200 text-slate-500'
                    }`}>
                      {connStatus === 'SUCCESS' ? '● OK' : connStatus === 'FAILED' ? '● Lỗi' : '○ Chưa test'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right content pane */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* ════════ BACKBLAZE B2 ════════ */}
          {selectedGroup === 'BACKBLAZE_B2' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>cloud_upload</span>
                  <span className="text-xs font-bold text-slate-700">Backblaze B2</span>
                  <ConnectionBadge status={displayedBackblazeTestStatus} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void handleTestBackblaze()} disabled={globalBusy}
                    className={`${BTN_SM} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isTestingBackblazeB2 ? 'animate-spin' : ''}`}>
                      {isTestingBackblazeB2 ? 'progress_activity' : 'verified'}
                    </span>
                    Kiểm tra
                  </button>
                  <button type="button" onClick={() => void handleSaveBackblaze()} disabled={globalBusy}
                    className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isSavingBackblazeB2 ? 'animate-spin' : ''}`}>
                      {isSavingBackblazeB2 ? 'progress_activity' : 'save'}
                    </span>
                    Lưu cấu hình
                  </button>
                </div>
              </div>

              {/* Form body */}
              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 flex-1 content-start">
                <ToggleSwitch
                  checked={isBackblazeEnabled}
                  onChange={() => setIsBackblazeEnabled((p) => !p)}
                  label={isBackblazeEnabled ? 'Tích hợp Backblaze B2 đang bật' : 'Tích hợp Backblaze B2 đang tắt'}
                />

                <div>
                  <label className={LABEL}>Application Key ID</label>
                  <input type="text" value={backblazeAccessKeyId}
                    onChange={(e) => setBackblazeAccessKeyId(e.target.value)}
                    placeholder="00438a9b..." className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Bucket ID</label>
                  <input type="text" value={backblazeBucketId}
                    onChange={(e) => setBackblazeBucketId(e.target.value)}
                    placeholder="93f8ca298bf4d000..." className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Bucket name</label>
                  <input type="text" value={backblazeBucketName}
                    onChange={(e) => setBackblazeBucketName(e.target.value)}
                    placeholder="tailieu-qlcv" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Region</label>
                  <input type="text" value={backblazeRegion}
                    onChange={(e) => setBackblazeRegion(e.target.value)}
                    placeholder="us-west-004" className={INPUT} />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Endpoint (tự suy từ Region)</label>
                  <div className="h-8 flex items-center px-2.5 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 truncate">
                    {backblazeDerivedEndpoint || <span className="text-slate-400 italic">Nhập Region để hệ thống tự suy endpoint</span>}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Tiền tố file</label>
                  <input type="text" value={backblazeFilePrefix}
                    onChange={(e) => setBackblazeFilePrefix(e.target.value)}
                    placeholder="VNPT" className={INPUT} />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Application Key</label>
                  <textarea
                    value={backblazeSecretAccessKey}
                    onChange={(e) => {
                      setBackblazeSecretAccessKey(e.target.value);
                      if (normalizeText(e.target.value)) setClearBackblazeSecret(false);
                    }}
                    rows={3}
                    placeholder="Dán Application Key vào đây (để trống nếu giữ nguyên)"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none resize-none"
                  />
                  <div className="flex items-center gap-4 mt-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox" checked={clearBackblazeSecret}
                        onChange={(e) => {
                          setClearBackblazeSecret(e.target.checked);
                          if (e.target.checked) setBackblazeSecretAccessKey('');
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Xóa key đang lưu
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Trạng thái: <strong className="text-slate-600">{backblazeB2Settings?.has_secret_access_key ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
                      {backblazeB2Settings?.secret_access_key_preview && (
                        <span className="font-mono ml-1 text-slate-500">{backblazeB2Settings.secret_access_key_preview}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer info strip */}
              <InfoFooter
                source={backblazeB2Settings?.source || 'ENV'}
                testedAt={displayedBackblazeTestedAt}
                message={displayedBackblazeTestMessage}
              />
            </>
          )}

          {/* ════════ GOOGLE DRIVE ════════ */}
          {selectedGroup === 'GOOGLE_DRIVE' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>cloud</span>
                  <span className="text-xs font-bold text-slate-700">Google Drive</span>
                  <ConnectionBadge status={displayedTestStatus} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void handleTestGoogleDrive()} disabled={globalBusy}
                    className={`${BTN_SM} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isTesting ? 'animate-spin' : ''}`}>
                      {isTesting ? 'progress_activity' : 'verified'}
                    </span>
                    Kiểm tra
                  </button>
                  <button type="button" onClick={() => void handleSaveGoogleDrive()} disabled={globalBusy}
                    className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isSaving ? 'animate-spin' : ''}`}>
                      {isSaving ? 'progress_activity' : 'save'}
                    </span>
                    Lưu cấu hình
                  </button>
                </div>
              </div>

              {/* Form body */}
              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 flex-1 content-start">
                <ToggleSwitch
                  checked={isEnabled}
                  onChange={() => setIsEnabled((p) => !p)}
                  label={isEnabled ? 'Tích hợp Google Drive đang bật' : 'Tích hợp Google Drive đang tắt'}
                />

                <div>
                  <label className={LABEL}>Email tài khoản dịch vụ</label>
                  <input type="text" value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="service-account@project.iam.gserviceaccount.com" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Folder ID</label>
                  <input type="text" value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    placeholder="1AbCdEfGh..." className={INPUT} />
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    Phải là thư mục Shared Drive nếu không dùng Impersonate user
                  </p>
                </div>

                <div>
                  <label className={LABEL}>Tiền tố file</label>
                  <input type="text" value={filePrefix}
                    onChange={(e) => setFilePrefix(e.target.value)}
                    placeholder="VNPT" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Impersonate user <span className="font-normal text-slate-400">(tuỳ chọn)</span></label>
                  <input type="text" value={impersonateUser}
                    onChange={(e) => setImpersonateUser(e.target.value)}
                    placeholder="user@domain.com" className={INPUT} />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Scopes</label>
                  <input type="text" value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                    placeholder="https://www.googleapis.com/auth/drive.file" className={INPUT} />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Service Account JSON</label>
                  <textarea
                    value={serviceAccountJson}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setServiceAccountJson(nextValue);
                      if (normalizeText(nextValue)) setClearCredentials(false);
                      const clientEmail = extractServiceAccountClientEmail(nextValue);
                      if (clientEmail) setAccountEmail(clientEmail);
                    }}
                    rows={4}
                    placeholder="Dán nội dung JSON service account vào đây (để trống nếu giữ nguyên cấu hình hiện tại)"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none resize-none"
                  />
                  <div className="flex items-center gap-4 mt-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox" checked={clearCredentials}
                        onChange={(e) => {
                          setClearCredentials(e.target.checked);
                          if (e.target.checked) setServiceAccountJson('');
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Xóa JSON đang lưu
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Trạng thái: <strong className="text-slate-600">{settings?.has_service_account_json ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
                      {settings?.has_service_account_json && <span className="ml-1">· JSON đã lưu mã hóa, không hiển thị lại</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer info strip */}
              <InfoFooter
                source={settings?.source || 'ENV'}
                testedAt={displayedTestedAt}
                message={displayedTestMessage}
              />
            </>
          )}

          {/* ════════ EMAIL SMTP ════════ */}
          {selectedGroup === 'EMAIL_SMTP' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>mail</span>
                  <span className="text-xs font-bold text-slate-700">Email SMTP</span>
                  <ConnectionBadge status={displayedSmtpTestStatus} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void handleTestEmailSmtp()} disabled={globalBusy}
                    className={`${BTN_SM} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isTestingEmailSmtp ? 'animate-spin' : ''}`}>
                      {isTestingEmailSmtp ? 'progress_activity' : 'verified'}
                    </span>
                    Kiểm tra
                  </button>
                  <button type="button" onClick={() => void handleSaveEmailSmtp()} disabled={globalBusy}
                    className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isSavingEmailSmtp ? 'animate-spin' : ''}`}>
                      {isSavingEmailSmtp ? 'progress_activity' : 'save'}
                    </span>
                    Lưu cấu hình
                  </button>
                </div>
              </div>

              {/* Form body */}
              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 flex-1 content-start">
                <ToggleSwitch
                  checked={isSmtpEnabled}
                  onChange={() => setIsSmtpEnabled((p) => !p)}
                  label={isSmtpEnabled ? 'Tích hợp Email SMTP đang bật' : 'Tích hợp Email SMTP đang tắt'}
                />

                <div>
                  <label className={LABEL}>SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className={INPUT}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">smtp.gmail.com cho Gmail</p>
                </div>

                <div>
                  <label className={LABEL}>SMTP Port</label>
                  <select
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className={INPUT}
                  >
                    <option value="587">587 - TLS (khuyến nghị)</option>
                    <option value="465">465 - SSL</option>
                    <option value="25">25 - Không mã hóa</option>
                  </select>
                </div>

                <div>
                  <label className={LABEL}>Mã hóa</label>
                  <select
                    value={smtpEncryption}
                    onChange={(e) => setSmtpEncryption(e.target.value as 'tls'|'ssl'|'none')}
                    className={INPUT}
                  >
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">Không</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Email Gmail (SMTP Username)</label>
                  <input
                    type="email"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="your-email@gmail.com"
                    className={INPUT}
                  />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>App Password (mật khẩu ứng dụng)</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => {
                      setSmtpPassword(e.target.value);
                      if (normalizeText(e.target.value)) setClearSmtpPassword(false);
                    }}
                    placeholder="xxxx xxxx xxxx xxxx (16 ký tự)"
                    className={INPUT}
                  />
                  <div className="flex items-center gap-4 mt-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearSmtpPassword}
                        onChange={(e) => {
                          setClearSmtpPassword(e.target.checked);
                          if (e.target.checked) setSmtpPassword('');
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Xóa mật khẩu đang lưu
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Trạng thái: <strong className="text-slate-600">{emailSmtpSettings?.has_smtp_password ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Lấy App Password tại đây
                    </a>
                    {' '}— Không dùng mật khẩu Gmail thông thường
                  </p>
                </div>

                <div>
                  <label className={LABEL}>Email hiển thị (From)</label>
                  <input
                    type="email"
                    value={smtpFromAddress}
                    onChange={(e) => setSmtpFromAddress(e.target.value)}
                    placeholder="your-email@gmail.com"
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className={LABEL}>Tên hiển thị (From)</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="VNPT Business"
                    className={INPUT}
                  />
                </div>

                <div className="col-span-2">
                  <label className={LABEL}>Email nhận test</label>
                  <input
                    type="email"
                    value={testRecipientEmail}
                    onChange={(e) => setTestRecipientEmail(e.target.value)}
                    placeholder={smtpUsername || "your-email@gmail.com"}
                    className={INPUT}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Để trống sẽ gửi đến email SMTP username</p>
                </div>
              </div>

              {/* Footer info strip */}
              <InfoFooter
                source={emailSmtpSettings?.source || 'DEFAULT'}
                testedAt={displayedSmtpTestedAt}
                message={displayedSmtpTestMessage}
              />
            </>
          )}

          {/* ════════ CONTRACT EXPIRY ALERT ════════ */}
          {selectedGroup === 'CONTRACT_EXPIRY_ALERT' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>event_busy</span>
                  <span className="text-xs font-bold text-slate-700">Cảnh báo hợp đồng hết hiệu lực</span>
                </div>
                <button type="button" onClick={() => void handleSaveContractExpiryAlert()} disabled={globalBusy}
                  className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
                >
                  <span className={`material-symbols-outlined text-sm ${isSavingContractExpiryAlert ? 'animate-spin' : ''}`}>
                    {isSavingContractExpiryAlert ? 'progress_activity' : 'save'}
                  </span>
                  Lưu
                </button>
              </div>

              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className={LABEL}>Số ngày cảnh báo trước khi hết hiệu lực</label>
                  <input
                    type="number" min={1} max={365} step={1}
                    value={expiryWarningDays}
                    onChange={(e) => setExpiryWarningDays(e.target.value)}
                    placeholder="30" className={INPUT}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    KPI cảnh báo các hợp đồng có ngày hết hiệu lực nằm trong khoảng từ hôm nay đến số ngày này.
                  </p>
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Cấu hình đang lưu</p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Nguồn</dt>
                      <dd className="font-semibold text-slate-700">{contractExpiryAlertSettings?.source || 'DEFAULT'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Cập nhật</dt>
                      <dd className="font-semibold text-slate-700">{formatTestTime(contractExpiryAlertSettings?.updated_at || null)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Ngưỡng hiện tại</dt>
                      <dd className="font-bold text-secondary">{contractExpiryAlertSettings?.warning_days ?? 30} ngày</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </>
          )}

          {/* ════════ CONTRACT PAYMENT ALERT ════════ */}
          {selectedGroup === 'CONTRACT_PAYMENT_ALERT' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 16 }}>payments</span>
                  <span className="text-xs font-bold text-slate-700">Cảnh báo hợp đồng đến kỳ thanh toán</span>
                </div>
                <button type="button" onClick={() => void handleSaveContractPaymentAlert()} disabled={globalBusy}
                  className={`${BTN_SM} bg-primary text-white hover:bg-deep-teal shadow-sm`}
                >
                  <span className={`material-symbols-outlined text-sm ${isSavingContractPaymentAlert ? 'animate-spin' : ''}`}>
                    {isSavingContractPaymentAlert ? 'progress_activity' : 'save'}
                  </span>
                  Lưu
                </button>
              </div>

              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className={LABEL}>Số ngày cảnh báo trước kỳ thanh toán</label>
                  <input
                    type="number" min={1} max={365} step={1}
                    value={paymentWarningDays}
                    onChange={(e) => setPaymentWarningDays(e.target.value)}
                    placeholder="30" className={INPUT}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Áp dụng cho hợp đồng theo chu kỳ. Cảnh báo khi đến hạn thanh toán trong khoảng số ngày này.
                  </p>
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Cấu hình đang lưu</p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Nguồn</dt>
                      <dd className="font-semibold text-slate-700">{contractPaymentAlertSettings?.source || 'DEFAULT'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Cập nhật</dt>
                      <dd className="font-semibold text-slate-700">{formatTestTime(contractPaymentAlertSettings?.updated_at || null)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Ngưỡng hiện tại</dt>
                      <dd className="font-bold text-secondary">{contractPaymentAlertSettings?.warning_days ?? 30} ngày</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </>
          )}

        </div>{/* end right pane */}
      </div>{/* end two-pane card */}
    </div>
  );
};
