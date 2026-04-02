import type { Page, Route } from '@playwright/test';

type MockCustomerRow = {
  id: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  dept_id?: number;
  created_by?: number;
};

export type MockCustomerCrudScenarioState = {
  authUser: Record<string, unknown>;
  customers: MockCustomerRow[];
  customerListRequests: Array<Record<string, unknown>>;
  nextCustomerId: number;
  // For 409 conflict test: set this to true to make DELETE return 409
  hasContracts: boolean;
};

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function paginatedMeta(total: number) {
  return {
    page: 1,
    per_page: Math.max(10, total || 10),
    total,
    total_pages: total > 0 ? 1 : 0,
  };
}

export function buildCustomerCrudScenarioState(): MockCustomerCrudScenarioState {
  return {
    authUser: {
      id: 1,
      user_code: 'ADMIN01',
      username: 'admin',
      full_name: 'Admin User',
      email: 'admin@example.com',
      department_id: 10,
      status: 'ACTIVE',
      roles: [],
      permissions: [
        'dashboard.view',
        'customers.read',
        'customers.write',
        'customers.delete',
      ],
      dept_scopes: [],
      password_change_required: false,
    },
    customers: [
      {
        id: 1,
        customer_code: 'KH-0001',
        name: 'Công ty ABC',
        phone: '0912345678',
        email: 'abc@example.com',
        dept_id: 10,
        created_by: 1,
      },
    ],
    customerListRequests: [],
    nextCustomerId: 2,
    hasContracts: false,
  };
}

export function registerCustomerCrudScenarioMock(
  page: Page,
  state: MockCustomerCrudScenarioState
): void {
  page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Bootstrap
    if (path === '/api/v5/bootstrap' && method === 'GET') {
      return fulfillJson(route, { data: { user: state.authUser } });
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      const { id, username, full_name, email } = state.authUser as any;
      return fulfillJson(route, { data: { id, username, full_name, email } });
    }

    if (path === '/api/v5/auth/refresh' && method === 'POST') {
      return fulfillJson(route, { data: { token: 'refreshed-token' } });
    }

    if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
      return fulfillJson(route, { data: { tab_token: 'tab-token' } });
    }

    // GET /api/v5/customers — list with pagination
    if (path === '/api/v5/customers' && method === 'GET') {
      state.customerListRequests.push({ timestamp: new Date().toISOString() });
      return fulfillJson(route, {
        data: state.customers,
        meta: paginatedMeta(state.customers.length),
      });
    }

    // GET /api/v5/customers/:id — show single
    if (path.match(/^\/api\/v5\/customers\/\d+$/) && method === 'GET') {
      const id = parseInt(path.split('/').pop() || '0');
      const customer = state.customers.find((c) => c.id === id);
      if (!customer) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      return fulfillJson(route, { data: customer });
    }

    // POST /api/v5/customers — create
    if (path === '/api/v5/customers' && method === 'POST') {
      const body = await request.postDataJSON();
      const newCustomer: MockCustomerRow = {
        id: state.nextCustomerId++,
        customer_code: `KH-${String(state.nextCustomerId).padStart(4, '0')}`,
        name: body.name || 'New Customer',
        phone: body.phone || '',
        email: body.email || '',
        dept_id: body.dept_id || 10,
        created_by: 1,
      };
      state.customers.push(newCustomer);
      return fulfillJson(route, { data: newCustomer }, 201);
    }

    // PUT /api/v5/customers/:id — update
    if (path.match(/^\/api\/v5\/customers\/\d+$/) && method === 'PUT') {
      const id = parseInt(path.split('/').pop() || '0');
      const body = await request.postDataJSON();
      const idx = state.customers.findIndex((c) => c.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      const updated = { ...state.customers[idx], ...body };
      state.customers[idx] = updated;
      return fulfillJson(route, { data: updated });
    }

    // DELETE /api/v5/customers/:id — delete (with 409 conflict handling)
    if (path.match(/^\/api\/v5\/customers\/\d+$/) && method === 'DELETE') {
      const id = parseInt(path.split('/').pop() || '0');
      const idx = state.customers.findIndex((c) => c.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }

      // If hasContracts is true, return 409 Conflict
      if (state.hasContracts) {
        return fulfillJson(
          route,
          {
            message: 'Khách hàng còn hợp đồng đang hoạt động. Không thể xóa.',
            code: 'CUSTOMER_HAS_CONTRACTS',
          },
          409
        );
      }

      state.customers.splice(idx, 1);
      return fulfillJson(route, { data: { id } });
    }

    // Catch-all
    if (path.startsWith('/api/v5/')) {
      return fulfillJson(route, {
        data: [],
        meta: paginatedMeta(0),
      });
    }

    await route.continue();
  });
}

export async function openCustomerCrudModule(page: Page): Promise<MockCustomerCrudScenarioState> {
  const state = buildCustomerCrudScenarioState();
  registerCustomerCrudScenarioMock(page, state);
  await page.goto('/customers');
  // Wait for customers table
  await page.waitForSelector('text=/Khách hàng|Customer/i', { timeout: 5000 });
  return state;
}
