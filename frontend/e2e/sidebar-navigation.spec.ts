import { expect, test } from '@playwright/test';

test('navigates between all major modules via sidebar', async ({ page }) => {
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Bootstrap with comprehensive permissions for all modules
    if (path === '/api/v5/bootstrap' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: 1,
              username: 'admin',
              full_name: 'Admin User',
              email: 'admin@example.com',
              department_id: 1,
              roles: [],
              permissions: [
                'dashboard.view',
                'contracts.read',
                'customers.read',
                'products.read',
                'projects.read',
                'employees.read',
                'documents.read',
                'fee_collection.read',
                'revenue.read',
                'customer_request_cases.read',
                'support_requests.read',
              ],
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
            username: 'admin',
            full_name: 'Admin User',
          },
        }),
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

    // Catch-all for data endpoints
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

  // Navigate to app
  await page.goto('/');

  // Wait for dashboard to load
  await expect(page.getByRole('heading', { name: /Bảng điều khiển|Dashboard/i })).toBeVisible({
    timeout: 5000,
  });

  // Test navigation to each module
  const modules = [
    { name: /Khách hàng|Customers/i, path: /customers/ },
    { name: /Hợp đồng|Contracts/i, path: /contracts/ },
    { name: /Dự án|Projects/i, path: /projects/ },
    { name: /Nhân viên|Employees/i, path: /employees/ },
    { name: /Sản phẩm|Products/i, path: /products/ },
    { name: /Tài liệu|Documents/i, path: /documents/ },
    { name: /Thu cước|Fee Collection/i, path: /fee-collection/ },
    { name: /Doanh thu|Revenue/i, path: /revenue-mgmt/ },
    { name: /Yêu cầu khách|Customer Request/i, path: /customer-request-management/ },
  ];

  for (const module of modules) {
    // Click sidebar button
    const button = page.getByRole('button', { name: module.name });
    await button.click({ timeout: 5000 });

    // Wait for navigation
    await page.waitForURL(module.path, { timeout: 5000 });

    // Verify page loaded with a heading
    const heading = page.getByRole('heading');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  }
});
