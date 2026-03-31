import { expect, test } from '@playwright/test';

const mockUser = {
  id: 1,
  username: 'admin',
  full_name: 'System Admin',
  email: 'admin@example.com',
  status: 'ACTIVE',
  roles: [],
  permissions: ['dashboard.view', 'customers.read'],
  dept_scopes: [],
  password_change_required: false,
};

test('login, bootstrap session, tab eviction, and logout work end-to-end', async ({ page }) => {
  const state = {
    loggedIn: false,
    tabEvicted: false,
    logoutCount: 0,
  };

  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/v5/bootstrap' && method === 'GET') {
      if (state.tabEvicted) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'TAB_EVICTED',
            message: 'Phiên làm việc đã được mở trên tab khác. Vui lòng đăng nhập lại.',
          }),
        });
        return;
      }

      if (!state.loggedIn) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthenticated.' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: mockUser,
            permissions: mockUser.permissions,
            counters: {},
          },
        }),
      });
      return;
    }

    if (path === '/api/v5/auth/login' && method === 'POST') {
      state.loggedIn = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: mockUser,
            password_change_required: false,
          },
          password_change_required: false,
        }),
      });
      return;
    }

    if (path === '/api/v5/auth/logout' && method === 'POST') {
      state.loggedIn = false;
      state.logoutCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ok: true } }),
      });
      return;
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      await route.fulfill({
        status: state.loggedIn ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(state.loggedIn ? { data: mockUser } : { message: 'Unauthenticated.' }),
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

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('secret123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Bảng điều khiển KPI chiến lược')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Bảng điều khiển KPI chiến lược')).toBeVisible();

  state.tabEvicted = true;
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(
    page.getByText('Tài khoản đã được đăng nhập trên một cửa sổ/tab khác. Vui lòng đăng nhập lại để tiếp tục.'),
  ).toBeVisible();

  state.tabEvicted = false;
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('secret123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Bảng điều khiển KPI chiến lược')).toBeVisible();

  await page.getByTitle('Đăng xuất').click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect.poll(() => state.logoutCount).toBe(1);
});
