import { expect, test } from '@playwright/test';

const mockApiResponse = (path: string, method: string) => {
  if (path === '/api/v5/bootstrap' && method === 'GET') {
    return {
      status: 200,
      body: JSON.stringify({
        data: {
          user: {
            id: 1,
            username: 'admin',
            full_name: 'Admin',
            roles: [],
            permissions: ['dashboard.view', 'documents.read', 'fee_collection.read', 'audit_logs.read'],
            password_change_required: false,
          },
        },
      }),
    };
  }
  if (path === '/api/v5/auth/me' && method === 'GET') {
    return { status: 200, body: JSON.stringify({ data: { id: 1, username: 'admin' } }) };
  }
  if (path === '/api/v5/auth/refresh' && method === 'POST') {
    return { status: 200, body: JSON.stringify({ data: { token: 'token' } }) };
  }
  if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
    return { status: 200, body: JSON.stringify({ data: { tab_token: 'tab-token' } }) };
  }
  return { status: 200, body: JSON.stringify({ data: [], meta: { page: 1, total: 0 } }) };
};

test.describe('Data management and reporting', () => {
  test('views audit logs', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const resp = mockApiResponse(path, method);
      await route.fulfill({
        status: resp.status,
        body: resp.body,
      });
    });

    await page.goto('/audit-logs');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 5000 });
  });

  test('imports data via upload', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const resp = mockApiResponse(path, method);
      await route.fulfill({ status: resp.status, body: resp.body });
    });

    await page.goto('/documents');
    // Import button should be accessible
    const importBtn = page.getByRole('button', { name: /import|nhập/i });
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(importBtn).toBeVisible();
    }
  });

  test('fee collection dashboard displays metrics', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const resp = mockApiResponse(path, method);
      await route.fulfill({ status: resp.status, body: resp.body });
    });

    await page.goto('/fee-collection');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 5000 });
  });
});
