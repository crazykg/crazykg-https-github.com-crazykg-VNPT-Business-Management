import { expect, test } from '@playwright/test';

const mockUser = {
  id: 1,
  username: 'admin',
  full_name: 'System Admin',
  email: 'admin@example.com',
  status: 'ACTIVE',
  roles: [],
  permissions: ['dashboard.view'],
  dept_scopes: [],
  password_change_required: false,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v5/bootstrap', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Unauthenticated.',
      }),
    });
  });
});

test('shows the login screen when there is no active session', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeDisabled();
});

test('logs in successfully with mocked API responses', async ({ page }) => {
  await page.route('**/api/v5/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: mockUser,
          password_change_required: false,
        },
      }),
    });
  });

  await page.goto('/');

  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('secret123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByText('Bảng điều khiển KPI chiến lược')).toBeVisible();
  await expect(page.getByText('Doanh thu thực tế', { exact: true })).toBeVisible();
});
