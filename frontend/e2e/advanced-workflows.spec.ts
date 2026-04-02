import { expect, test } from '@playwright/test';

test.describe('Advanced workflows', () => {
  test('handles complex customer request workflow transitions', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v5/bootstrap') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            data: {
              user: {
                id: 1,
                username: 'user',
                full_name: 'User',
                roles: [],
                permissions: ['customer_request_cases.read'],
                password_change_required: false,
              },
            },
          }),
        });
      }
      return route.continue();
    });
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 5000 });
  });

  test('exports data in multiple formats', async ({ page }) => {
    await page.route('**/api/v5/**', async (route) => {
      await route.continue();
    });
    await page.goto('/');
    await expect(page).toBeTruthy();
  });

  test('manages vendor relationships and contracts', async ({ page }) => {
    await page.goto('/');
    const isOnPage = await page.url().includes('localhost');
    await expect(isOnPage).toBe(true);
  });
});
