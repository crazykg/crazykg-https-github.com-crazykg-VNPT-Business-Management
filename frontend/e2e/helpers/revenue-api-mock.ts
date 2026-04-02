import type { Page, Route } from '@playwright/test';

type MockRevenueTargetRow = {
  id: number;
  dept_id: number | null;
  period: string;
  target_type: string;
  target_amount: number;
  notes: string | null;
  created_at: string;
};

export type MockRevenueScenarioState = {
  authUser: Record<string, unknown>;
  targets: MockRevenueTargetRow[];
  overviewRequests: Array<Record<string, unknown>>;
  nextTargetId: number;
};

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function paginatedMeta(total: number) {
  return { page: 1, per_page: Math.max(10, total || 10), total, total_pages: total > 0 ? 1 : 0 };
}

export function buildRevenueScenarioState(): MockRevenueScenarioState {
  return {
    authUser: {
      id: 1,
      username: 'admin',
      full_name: 'Admin User',
      email: 'admin@example.com',
      department_id: 10,
      roles: [],
      permissions: ['dashboard.view', 'revenue.read', 'revenue.targets', 'contracts.read'],
      password_change_required: false,
    },
    targets: [
      {
        id: 1,
        dept_id: null,
        period: '2026-01',
        target_type: 'CONTRACT_REVENUE',
        target_amount: 1000000000,
        notes: 'Company-wide target',
        created_at: new Date().toISOString(),
      },
    ],
    overviewRequests: [],
    nextTargetId: 2,
  };
}

export function registerRevenueScenarioMock(page: Page, state: MockRevenueScenarioState): void {
  page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/v5/bootstrap' && method === 'GET') {
      return fulfillJson(route, { data: { user: state.authUser } });
    }

    if (path === '/api/v5/auth/me' && method === 'GET') {
      const { id, username, full_name, email } = state.authUser as any;
      return fulfillJson(route, { data: { id, username, full_name, email } });
    }

    if (path === '/api/v5/auth/refresh' && method === 'POST') {
      return fulfillJson(route, { data: { token: 'token' } });
    }

    if (path === '/api/v5/auth/tab/claim' && method === 'POST') {
      return fulfillJson(route, { data: { tab_token: 'tab-token' } });
    }

    // Revenue overview
    if (path === '/api/v5/revenue/overview' && method === 'GET') {
      state.overviewRequests.push({ timestamp: new Date().toISOString() });
      return fulfillJson(route, {
        data: {
          total_contracted: 5000000000,
          total_collected: 3500000000,
          total_outstanding: 1500000000,
          achievement_rate: 70,
          forecast_next_3_months: 1200000000,
        },
      });
    }

    // Revenue targets
    if (path === '/api/v5/revenue/targets' && method === 'GET') {
      return fulfillJson(route, {
        data: state.targets,
        meta: paginatedMeta(state.targets.length),
      });
    }

    if (path === '/api/v5/revenue/targets' && method === 'POST') {
      const body = await request.postDataJSON();
      const newTarget: MockRevenueTargetRow = {
        id: state.nextTargetId++,
        dept_id: body.dept_id || null,
        period: body.period || '2026-02',
        target_type: body.target_type || 'CONTRACT_REVENUE',
        target_amount: body.target_amount || 0,
        notes: body.notes || null,
        created_at: new Date().toISOString(),
      };
      state.targets.push(newTarget);
      return fulfillJson(route, { data: newTarget }, 201);
    }

    if (path.match(/^\/api\/v5\/revenue\/targets\/\d+$/) && method === 'PUT') {
      const id = parseInt(path.split('/').pop() || '0');
      const body = await request.postDataJSON();
      const idx = state.targets.findIndex((t) => t.id === id);
      if (idx === -1) return fulfillJson(route, { message: 'Not found' }, 404);
      state.targets[idx] = { ...state.targets[idx], ...body };
      return fulfillJson(route, { data: state.targets[idx] });
    }

    if (path.match(/^\/api\/v5\/revenue\/targets\/\d+$/) && method === 'DELETE') {
      const id = parseInt(path.split('/').pop() || '0');
      const idx = state.targets.findIndex((t) => t.id === id);
      if (idx === -1) return fulfillJson(route, { message: 'Not found' }, 404);
      state.targets.splice(idx, 1);
      return fulfillJson(route, { data: { id } });
    }

    // Revenue forecast
    if (path === '/api/v5/revenue/forecast' && method === 'GET') {
      return fulfillJson(route, {
        data: {
          horizon_months: 3,
          by_month: [
            { month: '2026-02', revenue: 1000000000 },
            { month: '2026-03', revenue: 1100000000 },
            { month: '2026-04', revenue: 1050000000 },
          ],
        },
      });
    }

    // Revenue report
    if (path === '/api/v5/revenue/report' && method === 'GET') {
      return fulfillJson(route, {
        data: {
          by_department: [
            { dept_id: 10, dept_name: 'Sales', revenue: 2000000000 },
            { dept_id: 11, dept_name: 'Support', revenue: 1500000000 },
          ],
        },
      });
    }

    if (path.startsWith('/api/v5/')) {
      return fulfillJson(route, { data: [], meta: paginatedMeta(0) });
    }

    await route.continue();
  });
}

export async function openRevenueModule(page: Page): Promise<MockRevenueScenarioState> {
  const state = buildRevenueScenarioState();
  registerRevenueScenarioMock(page, state);
  await page.goto('/revenue-mgmt');
  await page.waitForSelector('text=/Doanh thu|Revenue/i', { timeout: 5000 });
  return state;
}
