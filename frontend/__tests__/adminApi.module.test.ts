import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchUserAccess,
  updateGoogleDriveIntegrationSettings,
  updateTelegramIntegrationSettings,
} from '../services/api/adminApi';

const fetchMock = vi.fn();

describe('adminApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds encoded search params for user-access queries', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchUserAccess('pham van');

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/user-access?search=pham%20van');
  });

  it('normalizes nullable Google Drive settings fields before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { provider: 'GOOGLE_DRIVE', is_enabled: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updateGoogleDriveIntegrationSettings({
      is_enabled: true,
      account_email: ' admin@example.com ',
      folder_id: ' ',
      scopes: ' drive.readonly ',
      impersonate_user: null,
      file_prefix: ' docs ',
      service_account_json: ' {"key":"x"} ',
      clear_service_account_json: false,
    });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload).toMatchObject({
      is_enabled: true,
      account_email: 'admin@example.com',
      folder_id: null,
      scopes: 'drive.readonly',
      impersonate_user: null,
      file_prefix: 'docs',
      service_account_json: '{"key":"x"}',
      clear_service_account_json: false,
    });
  });

  it('normalizes Telegram settings fields before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { provider: 'TELEGRAM', enabled: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updateTelegramIntegrationSettings({
      enabled: true,
      bot_username: ' vnpt_notify_bot ',
      bot_token: ' 123:abc ',
      clear_bot_token: false,
    });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload).toMatchObject({
      enabled: true,
      bot_username: 'vnpt_notify_bot',
      bot_token: '123:abc',
      clear_bot_token: false,
    });
  });
});
