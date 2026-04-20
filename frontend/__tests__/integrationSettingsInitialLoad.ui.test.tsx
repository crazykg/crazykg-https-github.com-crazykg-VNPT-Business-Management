import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const fetchAuthBootstrapMock = vi.hoisted(() => vi.fn());
const fetchBackblazeB2IntegrationSettingsMock = vi.hoisted(() => vi.fn());
const fetchGoogleDriveIntegrationSettingsMock = vi.hoisted(() => vi.fn());
const fetchEmailSmtpIntegrationSettingsMock = vi.hoisted(() => vi.fn());
const fetchTelegramIntegrationSettingsMock = vi.hoisted(() => vi.fn());
const fetchEmployeesMock = vi.hoisted(() => vi.fn());
const fetchContractExpiryAlertSettingsMock = vi.hoisted(() => vi.fn());
const fetchContractPaymentAlertSettingsMock = vi.hoisted(() => vi.fn());
const registerTabEvictedHandlerMock = vi.hoisted(() => vi.fn());
const unregisterTabEvictedHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('../components/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">login</div>,
}));

vi.mock('../components/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('../hooks/useImportCustomers', () => ({
  useImportCustomers: () => ({ handleImportCustomers: vi.fn() }),
}));

vi.mock('../hooks/useImportCustomerPersonnel', () => ({
  useImportCustomerPersonnel: () => ({ handleImportCustomerPersonnel: vi.fn() }),
}));

vi.mock('../hooks/useImportDepartments', () => ({
  useImportDepartments: () => ({ handleImportDepartments: vi.fn() }),
}));

vi.mock('../hooks/useImportEmployees', () => ({
  useImportEmployees: () => ({ handleImportEmployees: vi.fn() }),
}));

vi.mock('../hooks/useImportEmployeePartyProfiles', () => ({
  useImportEmployeePartyProfiles: () => ({ handleImportEmployeePartyProfiles: vi.fn() }),
}));

vi.mock('../hooks/useImportProducts', () => ({
  useImportProducts: () => ({ handleImportProducts: vi.fn() }),
}));

vi.mock('../hooks/useImportProductPackages', () => ({
  useImportProductPackages: () => ({ handleImportProductPackages: vi.fn() }),
}));

vi.mock('../hooks/useCustomerPersonnel', () => ({
  useCustomerPersonnel: () => ({
    customerPersonnel: [],
    loadCustomerPersonnel: vi.fn(),
    handleSaveCusPersonnel: vi.fn(),
    handleDeleteCusPersonnel: vi.fn(),
  }),
}));

vi.mock('../AppPages', () => ({
  AppPages: ({
    activeTab,
    emailSmtpSettings,
    telegramSettings,
  }: {
    activeTab: string;
    emailSmtpSettings: {
      smtp_username?: string | null;
      source?: string | null;
      is_enabled?: boolean | null;
    } | null;
    telegramSettings: {
      bot_username?: string | null;
      source?: string | null;
      enabled?: boolean | null;
    } | null;
  }) => (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div data-testid="smtp-username">{emailSmtpSettings?.smtp_username ?? '--'}</div>
      <div data-testid="smtp-source">{emailSmtpSettings?.source ?? '--'}</div>
      <div data-testid="smtp-enabled">{String(emailSmtpSettings?.is_enabled ?? false)}</div>
      <div data-testid="telegram-username">{telegramSettings?.bot_username ?? '--'}</div>
      <div data-testid="telegram-source">{telegramSettings?.source ?? '--'}</div>
      <div data-testid="telegram-enabled">{String(telegramSettings?.enabled ?? false)}</div>
    </div>
  ),
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');

  return {
    ...actual,
    fetchAuthBootstrap: fetchAuthBootstrapMock,
    fetchBackblazeB2IntegrationSettings: fetchBackblazeB2IntegrationSettingsMock,
    fetchGoogleDriveIntegrationSettings: fetchGoogleDriveIntegrationSettingsMock,
    fetchEmailSmtpIntegrationSettings: fetchEmailSmtpIntegrationSettingsMock,
    fetchTelegramIntegrationSettings: fetchTelegramIntegrationSettingsMock,
    fetchEmployees: fetchEmployeesMock,
    fetchContractExpiryAlertSettings: fetchContractExpiryAlertSettingsMock,
    fetchContractPaymentAlertSettings: fetchContractPaymentAlertSettingsMock,
    registerTabEvictedHandler: registerTabEvictedHandlerMock,
    unregisterTabEvictedHandler: unregisterTabEvictedHandlerMock,
  };
});

describe('Integration settings initial load', () => {
  const renderApp = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/integration-settings']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    fetchAuthBootstrapMock.mockResolvedValue({
      user: {
        id: 1,
        username: 'admin',
        full_name: 'Admin',
        roles: ['ADMIN'],
        permissions: ['*'],
        password_change_required: false,
      },
      permissions: ['*'],
      counters: {},
    });

    fetchBackblazeB2IntegrationSettingsMock.mockResolvedValue({
      provider: 'BACKBLAZE_B2',
      is_enabled: false,
      has_secret_access_key: false,
      source: 'DB',
    });

    fetchGoogleDriveIntegrationSettingsMock.mockResolvedValue({
      provider: 'GOOGLE_DRIVE',
      is_enabled: false,
      has_service_account_json: false,
      source: 'DB',
    });

    fetchEmailSmtpIntegrationSettingsMock.mockResolvedValue({
      provider: 'EMAIL_SMTP',
      is_enabled: true,
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_encryption: 'tls',
      smtp_username: 'smtp@vnpt.test',
      smtp_recipient_emails: 'smtp@vnpt.test',
      has_smtp_password: true,
      smtp_from_name: 'VNPT Business',
      source: 'DB',
    });

    fetchTelegramIntegrationSettingsMock.mockResolvedValue({
      provider: 'TELEGRAM',
      enabled: true,
      bot_username: 'vnpt_notify_bot',
      has_bot_token: true,
      source: 'DB',
    });

    fetchContractExpiryAlertSettingsMock.mockResolvedValue({
      provider: 'CONTRACT_ALERT',
      warning_days: 30,
      source: 'DB',
    });

    fetchContractPaymentAlertSettingsMock.mockResolvedValue({
      provider: 'CONTRACT_PAYMENT_ALERT',
      warning_days: 15,
      source: 'DB',
    });

    fetchEmployeesMock.mockResolvedValue([]);
  });

  it('loads Email SMTP settings immediately when opening the integration settings route', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('integration_settings');
    });

    await waitFor(() => {
      expect(fetchEmailSmtpIntegrationSettingsMock).toHaveBeenCalledTimes(1);
      expect(fetchTelegramIntegrationSettingsMock).toHaveBeenCalledTimes(1);
      expect(fetchEmployeesMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('smtp-username')).toHaveTextContent('smtp@vnpt.test');
      expect(screen.getByTestId('smtp-source')).toHaveTextContent('DB');
      expect(screen.getByTestId('smtp-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('telegram-username')).toHaveTextContent('vnpt_notify_bot');
      expect(screen.getByTestId('telegram-source')).toHaveTextContent('DB');
      expect(screen.getByTestId('telegram-enabled')).toHaveTextContent('true');
    });
  });
});
