import type { Page, Route } from '@playwright/test';

type MockEmployeeRow = {
  id: number;
  user_code: string;
  full_name: string;
  email: string;
  phone?: string;
  department_id: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type MockDepartmentRow = {
  id: number;
  dept_code: string;
  dept_name: string;
};

export type MockEmployeeCrudScenarioState = {
  authUser: Record<string, unknown>;
  employees: MockEmployeeRow[];
  departments: MockDepartmentRow[];
  employeeListRequests: Array<Record<string, unknown>>;
  nextEmployeeId: number;
  lastTempPassword: string | null; // Set when employee is created
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

export function buildEmployeeCrudScenarioState(): MockEmployeeCrudScenarioState {
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
        'employees.read',
        'employees.write',
        'employees.delete',
      ],
      dept_scopes: [],
      password_change_required: false,
    },
    employees: [
      {
        id: 101,
        user_code: 'EMP001',
        full_name: 'Nhân viên A',
        email: 'emp-a@example.com',
        phone: '0912345678',
        department_id: 10,
        status: 'ACTIVE',
      },
    ],
    departments: [
      {
        id: 10,
        dept_code: 'DEPT-01',
        dept_name: 'Phòng Kinh doanh',
      },
      {
        id: 11,
        dept_code: 'DEPT-02',
        dept_name: 'Phòng Kỹ thuật',
      },
    ],
    employeeListRequests: [],
    nextEmployeeId: 102,
    lastTempPassword: null,
  };
}

export function registerEmployeeCrudScenarioMock(
  page: Page,
  state: MockEmployeeCrudScenarioState
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

    // GET /api/v5/internal-users — employee list
    if (path === '/api/v5/internal-users' && method === 'GET') {
      state.employeeListRequests.push({ timestamp: new Date().toISOString() });
      return fulfillJson(route, {
        data: state.employees,
        meta: paginatedMeta(state.employees.length),
      });
    }

    // GET /api/v5/internal-users/:id
    if (path.match(/^\/api\/v5\/internal-users\/\d+$/) && method === 'GET') {
      const id = parseInt(path.split('/').pop() || '0');
      const employee = state.employees.find((e) => e.id === id);
      if (!employee) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      return fulfillJson(route, { data: employee });
    }

    // POST /api/v5/internal-users — create with temp password
    if (path === '/api/v5/internal-users' && method === 'POST') {
      const body = await request.postDataJSON();
      const tempPassword = `TmpPwd@${Date.now().toString().slice(-6)}`;
      const newEmployee: MockEmployeeRow = {
        id: state.nextEmployeeId++,
        user_code: `EMP${String(state.nextEmployeeId).padStart(3, '0')}`,
        full_name: body.full_name || 'New Employee',
        email: body.email || 'newemp@example.com',
        phone: body.phone || '',
        department_id: body.department_id || 10,
        status: 'ACTIVE',
      };
      state.employees.push(newEmployee);
      state.lastTempPassword = tempPassword;
      return fulfillJson(
        route,
        {
          data: newEmployee,
          temp_password: tempPassword,
        },
        201
      );
    }

    // PUT /api/v5/internal-users/:id — update
    if (path.match(/^\/api\/v5\/internal-users\/\d+$/) && method === 'PUT') {
      const id = parseInt(path.split('/').pop() || '0');
      const body = await request.postDataJSON();
      const idx = state.employees.findIndex((e) => e.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      const updated = { ...state.employees[idx], ...body };
      state.employees[idx] = updated;
      return fulfillJson(route, { data: updated });
    }

    // DELETE /api/v5/internal-users/:id
    if (path.match(/^\/api\/v5\/internal-users\/\d+$/) && method === 'DELETE') {
      const id = parseInt(path.split('/').pop() || '0');
      const idx = state.employees.findIndex((e) => e.id === id);
      if (idx === -1) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      state.employees.splice(idx, 1);
      return fulfillJson(route, { data: { id } });
    }

    // GET /api/v5/departments — for dropdown
    if (path === '/api/v5/departments' && method === 'GET') {
      return fulfillJson(route, {
        data: state.departments,
        meta: paginatedMeta(state.departments.length),
      });
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

export async function openEmployeeCrudModule(page: Page): Promise<MockEmployeeCrudScenarioState> {
  const state = buildEmployeeCrudScenarioState();
  registerEmployeeCrudScenarioMock(page, state);
  await page.goto('/employees');
  // Wait for employees table
  await page.waitForSelector('text=/Nhân viên|Employee/i', { timeout: 5000 });
  return state;
}
