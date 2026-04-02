import type { Page, Route } from '@playwright/test';

type MockContractRow = {
  id: number;
  contract_code: string;
  title: string;
  customer_id: number;
  status: 'DRAFT' | 'SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  value: number;
  start_date: string;
  end_date: string;
  customer_name?: string;
};

type MockCustomerRow = {
  id: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  dept_id?: number;
};

export type MockContractCrudScenarioState = {
  authUser: Record<string, unknown>;
  contracts: MockContractRow[];
  customers: MockCustomerRow[];
  contractListRequests: Array<Record<string, unknown>>;
  nextContractId: number;
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildContractCrudScenarioState(): MockContractCrudScenarioState {
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
        'contracts.read',
        'contracts.write',
        'contracts.delete',
        'customers.read',
      ],
      dept_scopes: [],
      password_change_required: false,
    },
    contracts: [
      {
        id: 101,
        contract_code: 'HĐ-202601-0001',
        title: 'Hợp đồng cung cấp dịch vụ A',
        customer_id: 1,
        status: 'ACTIVE',
        value: 50000000,
        start_date: '2026-01-01',
        end_date: '2027-01-01',
        customer_name: 'Công ty ABC',
      },
    ],
    customers: [
      {
        id: 1,
        customer_code: 'KH-0001',
        name: 'Công ty ABC',
        phone: '0912345678',
        email: 'abc@example.com',
        dept_id: 10,
      },
      {
        id: 2,
        customer_code: 'KH-0002',
        name: 'Công ty XYZ',
        phone: '0987654321',
        email: 'xyz@example.com',
        dept_id: 10,
      },
    ],
    contractListRequests: [],
    nextContractId: 102,
  };
}

export function registerContractCrudScenarioMock(page: Page, state: MockContractCrudScenarioState): void {
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

    // GET /api/v5/contracts — list with pagination
    if (path === '/api/v5/contracts' && method === 'GET') {
      state.contractListRequests.push({ timestamp: new Date().toISOString() });
      return fulfillJson(route, {
        data: state.contracts,
        meta: paginatedMeta(state.contracts.length),
      });
    }

    // GET /api/v5/contracts/:id — show single
    if (path.match(/^\/api\/v5\/contracts\/\d+$/) && method === 'GET') {
      const id = parseInt(path.split('/').pop() || '0');
      const contract = state.contracts.find((c) => c.id === id);
      if (!contract) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      return fulfillJson(route, { data: contract });
    }

    // POST /api/v5/contracts — create
    if (path === '/api/v5/contracts' && method === 'POST') {
      const body = await request.postDataJSON();
      const newContract: MockContractRow = {
        id: state.nextContractId++,
        contract_code: `HĐ-202601-${String(state.nextContractId).padStart(4, '0')}`,
        title: body.title || 'New Contract',
        customer_id: body.customer_id || 1,
        status: body.status || 'DRAFT',
        value: body.value || 0,
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        end_date: body.end_date || new Date().toISOString().split('T')[0],
        customer_name: state.customers.find((c) => c.id === body.customer_id)?.name,
      };
      state.contracts.push(newContract);
      return fulfillJson(route, { data: newContract }, 201);
    }

    // PUT /api/v5/contracts/:id — update
    if (path.match(/^\/api\/v5\/contracts\/\d+$/) && method === 'PUT') {
      const id = parseInt(path.split('/').pop() || '0');
      const body = await request.postDataJSON();
      const idx = state.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      const updated = { ...state.contracts[idx], ...body };
      state.contracts[idx] = updated;
      return fulfillJson(route, { data: updated });
    }

    // DELETE /api/v5/contracts/:id — delete
    if (path.match(/^\/api\/v5\/contracts\/\d+$/) && method === 'DELETE') {
      const id = parseInt(path.split('/').pop() || '0');
      const idx = state.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      state.contracts.splice(idx, 1);
      return fulfillJson(route, { data: { id } });
    }

    // GET /api/v5/customers — for dropdown in contract form
    if (path === '/api/v5/customers' && method === 'GET') {
      return fulfillJson(route, {
        data: state.customers,
        meta: paginatedMeta(state.customers.length),
      });
    }

    // Catch-all for other /api/v5/* endpoints
    if (path.startsWith('/api/v5/')) {
      return fulfillJson(route, {
        data: [],
        meta: paginatedMeta(0),
      });
    }

    await route.continue();
  });
}

export async function openContractCrudModule(page: Page): Promise<MockContractCrudScenarioState> {
  const state = buildContractCrudScenarioState();
  registerContractCrudScenarioMock(page, state);
  await page.goto('/contracts');
  // Wait for contracts table to be visible
  await page.waitForSelector('text=/Hợp đồng|Contract/i', { timeout: 5000 });
  return state;
}
