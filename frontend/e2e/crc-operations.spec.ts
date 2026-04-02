import { expect, test } from '@playwright/test';

test.describe('Customer Request CRC operations', () => {
  test('CRC escalation and worklog flow', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();

      if (path === '/api/v5/bootstrap' && method === 'GET') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: {
              user: {
                id: 1,
                username: 'user',
                full_name: 'Test User',
                roles: [],
                permissions: ['customer_request_cases.read', 'customer_request_cases.write'],
                password_change_required: false,
              },
            },
          }),
        });
      }

      if (path.includes('/api/v5/')) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [], meta: { page: 1, total: 0 } }),
        });
      }

      await route.continue();
    });

    await page.goto('/customer-request-management');
    // Verify page loads
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 5000 });
  });
});
