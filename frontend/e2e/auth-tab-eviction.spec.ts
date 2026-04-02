import { expect, test } from '@playwright/test';

test('handles tab eviction (409 TAB_EVICTED response) correctly', async ({ page }) => {
  const state = {
    tabToken: 'token-A',
    bootstrapDone: false,
    evictResponseSent: false,
  };

  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Bootstrap
    if (path === '/api/v5/bootstrap' && method === 'GET') {
      state.bootstrapDone = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: 1,
              username: 'testuser',
              full_name: 'Test User',
              email: 'test@example.com',
              department_id: 1,
              roles: [],
              permissions: ['dashboard.view', 'contracts.read'],
              password_change_required: false,
            },
          },
        }),
      });
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 1, username: 'testuser' } }),
      });
    }

    if (path === '/api/v5/auth/refresh' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { token: 'new-token' } }),
      });
    }

    if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { tab_token: state.tabToken } }),
      });
    }

    // First data request succeeds, second request gets 409 TAB_EVICTED
    if (
      (path === '/api/v5/contracts' ||
        path === '/api/v5/products' ||
        path === '/api/v5/customers') &&
      method === 'GET'
    ) {
      if (!state.evictResponseSent) {
        state.evictResponseSent = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { page: 1, per_page: 10, total: 0, total_pages: 0 },
          }),
        });
      }
      // Subsequent requests return 409 eviction
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'TAB_EVICTED',
          message: 'Phiên làm việc của bạn đã kết thúc trên thiết bị khác',
        }),
      });
    }

    // Catch-all
    if (path.startsWith('/api/v5/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { page: 1, per_page: 10, total: 0, total_pages: 0 },
        }),
      });
    }

    await route.continue();
  });

  // Load app
  await page.goto('/');

  // Wait for bootstrap
  await expect(page.getByRole('heading', { name: /Bảng điều khiển|Dashboard/i })).toBeVisible({
    timeout: 5000,
  });

  // Navigate to trigger data fetch
  await page.getByRole('button', { name: /Hợp đồng|Contracts/i }).click();

  // Wait briefly for first load
  await page.waitForTimeout(500);

  // Try another action that should trigger the 409
  await page.getByRole('button', { name: /Sản phẩm|Products/i }).click();

  // Should see eviction message (Vietnamese: phiên làm việc)
  await expect(page.getByText(/phiên làm việc|TAB_EVICTED/i)).toBeVisible({
    timeout: 5000,
  });

  // Should redirect to login or show eviction modal
  await expect(
    page.getByText(/kết thúc|được kết thúc|session expired/i)
  ).toBeVisible({ timeout: 5000 });
});
