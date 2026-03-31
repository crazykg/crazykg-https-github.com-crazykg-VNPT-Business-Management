import { expect, test } from '@playwright/test';

const limitedUser = {
  id: 9,
  username: 'limited.user',
  full_name: 'Limited User',
  email: 'limited@example.com',
  status: 'ACTIVE',
  roles: [],
  permissions: ['dashboard.view'],
  dept_scopes: [],
  password_change_required: false,
};

test('redirects a signed-in user back to dashboard when opening a denied module', async ({ page }) => {
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/v5/bootstrap' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: limitedUser,
            permissions: limitedUser.permissions,
            counters: {},
          },
        }),
      });
      return;
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: limitedUser }),
      });
      return;
    }

    if (path === '/api/v5/auth/refresh' || path === '/api/v5/auth/tab/claim') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ok: true } }),
      });
      return;
    }

    if (path.startsWith('/api/v5/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { page: 1, per_page: 10, total: 0, total_pages: 0 } }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/fee-collection');

  await expect(page.getByText('Bảng điều khiển KPI chiến lược')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thu cước & Công nợ' })).not.toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
});
