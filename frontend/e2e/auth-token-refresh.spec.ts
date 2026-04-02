import { expect, test } from '@playwright/test';

test('handles 401 response and auto-refreshes token', async ({ page }) => {
  // Track refresh attempts and retries
  const state = {
    refreshCount: 0,
    retrySucceeded: false,
    firstCallGot401: false,
  };

  // Set up API mock
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Critical auth endpoints must always work
    if (path === '/api/v5/bootstrap' && method === 'GET') {
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
        body: JSON.stringify({
          data: {
            id: 1,
            username: 'testuser',
            full_name: 'Test User',
            email: 'test@example.com',
            department_id: 1,
          },
        }),
      });
    }

    if (path === '/api/v5/auth/refresh' && method === 'POST') {
      state.refreshCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { token: `refreshed-token-${state.refreshCount}` },
        }),
      });
    }

    if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { tab_token: 'test-tab-token' } }),
      });
    }

    // First call to contracts returns 401, second call returns 200
    if (path === '/api/v5/contracts' && method === 'GET') {
      if (!state.firstCallGot401) {
        state.firstCallGot401 = true;
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      }
      state.retrySucceeded = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 1,
              contract_code: 'HĐ-202601-0001',
              title: 'Contract A',
              customer_id: 1,
              status: 'ACTIVE',
            },
          ],
          meta: { page: 1, per_page: 10, total: 1, total_pages: 1 },
        }),
      });
    }

    // Catch-all for other /api/v5/* endpoints
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

    // Allow non-API traffic through
    await route.continue();
  });

  // Load app
  await page.goto('/');

  // App should bootstrap and show dashboard
  await expect(page.getByRole('heading', { name: /Bảng điều khiển|Dashboard/i })).toBeVisible({
    timeout: 5000,
  });

  // Navigate to contracts to trigger the 401 → refresh → retry flow
  await page.getByRole('button', { name: /Hợp đồng|Contracts/i }).click();

  // Wait for the auto-refresh and retry to complete
  await expect.poll(() => state.refreshCount, { timeout: 5000 }).toBeGreaterThan(0);
  await expect.poll(() => state.retrySucceeded, { timeout: 5000 }).toBe(true);

  // Verify contracts loaded after retry
  await expect(page.getByText('HĐ-202601-0001')).toBeVisible({ timeout: 5000 });
});
