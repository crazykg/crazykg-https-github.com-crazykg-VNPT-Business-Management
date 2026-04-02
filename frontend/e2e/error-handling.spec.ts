import { expect, test } from '@playwright/test';

test('displays error messages for network, server, and validation errors', async ({
  page,
}) => {
  let errorScenario = 'none'; // 'timeout', 'server', or 'none'

  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Bootstrap
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
              permissions: ['dashboard.view', 'contracts.read', 'contracts.write'],
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
        body: JSON.stringify({ data: { token: 'token' } }),
      });
    }

    if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { tab_token: 'tab-token' } }),
      });
    }

    // Simulate different error scenarios
    if (path === '/api/v5/contracts' && method === 'GET') {
      if (errorScenario === 'timeout') {
        // Abort the request to simulate network timeout
        return route.abort('timedout');
      } else if (errorScenario === 'server') {
        // Server error
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Internal Server Error',
            error: 'Database connection failed',
          }),
        });
      }
      // Normal success
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: 1, contract_code: 'HĐ-001', title: 'Contract A' }],
          meta: { page: 1, per_page: 10, total: 1, total_pages: 1 },
        }),
      });
    }

    // Validation error (422)
    if (path === '/api/v5/contracts' && method === 'POST') {
      if (errorScenario === 'validation') {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Validation failed',
            errors: {
              title: ['Tiêu đề là bắt buộc'],
              value: ['Giá trị phải là số dương'],
            },
          }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 2, contract_code: 'HĐ-002', title: 'New Contract' },
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

  // Wait for dashboard
  await expect(page.getByRole('heading', { name: /Bảng điều khiển|Dashboard/i })).toBeVisible({
    timeout: 5000,
  });

  // TEST 1: Network timeout error
  errorScenario = 'timeout';
  await page.getByRole('button', { name: /Hợp đồng|Contracts/i }).click();
  await page.waitForTimeout(1000); // Give it time to detect the error
  // Should show an error toast
  await expect(
    page.getByText(/lỗi mạng|timeout|không thể kết nối/i)
  ).toBeVisible({ timeout: 5000 }).catch(() => {
    // If no specific error message, check for generic error alert
    return expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
  });

  errorScenario = 'none';
  await page.waitForTimeout(500);

  // TEST 2: Server error (500)
  errorScenario = 'server';
  await page.getByRole('button', { name: /Hợp đồng|Contracts/i }).click();
  await page.waitForTimeout(1000);
  // Should show error related to server failure
  await expect(
    page.getByText(/lỗi máy chủ|error|failed/i)
  ).toBeVisible({ timeout: 5000 }).catch(() => {
    return expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
  });

  errorScenario = 'none';
  await page.waitForTimeout(500);

  // TEST 3: Form validation error (422)
  errorScenario = 'validation';
  // Open create contract form
  await page.getByRole('button', { name: /Tạo|Create/i }).click({ timeout: 5000 });
  // Submit empty form
  await page.getByRole('button', { name: /Lưu|Tạo|Save|Create/i }).last().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  // Should show validation error message
  await expect(
    page.getByText(/bắt buộc|required|không hợp lệ|invalid/i)
  ).toBeVisible({ timeout: 5000 });
});
