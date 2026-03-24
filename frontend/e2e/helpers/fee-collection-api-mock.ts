import type { Page, Route } from '@playwright/test';

type MockDashboardRequest = {
  period_from: string;
  period_to: string;
};

type MockInvoiceListRequest = {
  status?: string;
  customer_id?: string;
  q?: string;
  page?: string;
};

export type MockFeeCollectionScenarioState = {
  authUser: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  receipts: Array<Record<string, unknown>>;
  dashboardRequests: MockDashboardRequest[];
  invoiceListRequests: MockInvoiceListRequest[];
  dashboardPayload: Record<string, unknown>;
  debtAgingPayload: Record<string, unknown>;
};

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function paginatedMeta(total: number, extra: Record<string, unknown> = {}) {
  return {
    page: 1,
    per_page: Math.max(10, total || 10),
    total,
    total_pages: total > 0 ? 1 : 0,
    ...extra,
  };
}

export function buildFeeCollectionScenarioState(): MockFeeCollectionScenarioState {
  const kpis = {
    expected_revenue: 250_000_000,
    actual_collected: 175_000_000,
    outstanding: 75_000_000,
    overdue_amount: 30_000_000,
    overdue_count: 2,
    collection_rate: 70,
    avg_days_to_collect: 12,
  };

  const dashboardPayload: Record<string, unknown> = {
    kpis,
    by_month: [
      {
        month_key: '2026-01',
        month_label: 'Tháng 1/2026',
        expected: 80_000_000,
        actual: 70_000_000,
        outstanding: 10_000_000,
        cumulative_expected: 80_000_000,
        cumulative_actual: 70_000_000,
      },
      {
        month_key: '2026-02',
        month_label: 'Tháng 2/2026',
        expected: 90_000_000,
        actual: 60_000_000,
        outstanding: 30_000_000,
        cumulative_expected: 170_000_000,
        cumulative_actual: 130_000_000,
      },
      {
        month_key: '2026-03',
        month_label: 'Tháng 3/2026',
        expected: 80_000_000,
        actual: 45_000_000,
        outstanding: 35_000_000,
        cumulative_expected: 250_000_000,
        cumulative_actual: 175_000_000,
      },
    ],
    cumulative: [
      {
        month_key: '2026-01',
        month_label: 'Tháng 1/2026',
        cumulative_expected: 80_000_000,
        cumulative_actual: 70_000_000,
      },
      {
        month_key: '2026-02',
        month_label: 'Tháng 2/2026',
        cumulative_expected: 170_000_000,
        cumulative_actual: 130_000_000,
      },
      {
        month_key: '2026-03',
        month_label: 'Tháng 3/2026',
        cumulative_expected: 250_000_000,
        cumulative_actual: 175_000_000,
      },
    ],
    top_debtors: [
      {
        customer_id: 201,
        customer_name: 'Ngân hàng Việt Á',
        total_outstanding: 45_000_000,
        overdue_amount: 30_000_000,
        invoice_count: 3,
        oldest_overdue_days: 35,
      },
      {
        customer_id: 202,
        customer_name: 'Tập đoàn Petrolimex',
        total_outstanding: 30_000_000,
        overdue_amount: 0,
        invoice_count: 2,
        oldest_overdue_days: 0,
      },
    ],
    urgent_overdue: [
      {
        schedule_id: 701,
        contract_id: 102,
        contract_code: 'HD-DT-002',
        customer_name: 'Ngân hàng Việt Á',
        milestone_name: 'Phí dịch vụ tháng 2/2026',
        expected_date: '2026-02-20',
        expected_amount: 15_000_000,
        days_overdue: 35,
      },
    ],
  };

  const debtAgingPayload: Record<string, unknown> = {
    rows: [
      {
        customer_id: 201,
        customer_name: 'Ngân hàng Việt Á',
        current_bucket: 15_000_000,
        bucket_1_30: 0,
        bucket_31_60: 30_000_000,
        bucket_61_90: 0,
        bucket_over_90: 0,
        total_outstanding: 45_000_000,
      },
      {
        customer_id: 202,
        customer_name: 'Tập đoàn Petrolimex',
        current_bucket: 30_000_000,
        bucket_1_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_over_90: 0,
        total_outstanding: 30_000_000,
      },
    ],
    totals: {
      current: 45_000_000,
      d1_30: 0,
      d31_60: 30_000_000,
      d61_90: 0,
      over_90: 0,
      total: 75_000_000,
    },
  };

  return {
    authUser: {
      id: 1,
      user_code: 'ADMIN01',
      username: 'tester',
      full_name: 'Smoke Tester',
      email: 'tester@example.com',
      department_id: 10,
      status: 'ACTIVE',
      roles: [],
      permissions: [
        'dashboard.view',
        'contracts.read',
        'customers.read',
        'projects.read',
        'products.read',
        'fee_collection.read',
        'fee_collection.write',
        'fee_collection.delete',
      ],
      dept_scopes: [],
      password_change_required: false,
    },
    customers: [
      {
        id: 201,
        uuid: 'cus-201',
        customer_code: 'KH001',
        customer_name: 'Ngân hàng Việt Á',
      },
      {
        id: 202,
        uuid: 'cus-202',
        customer_code: 'KH002',
        customer_name: 'Tập đoàn Petrolimex',
      },
    ],
    contracts: [
      {
        id: 101,
        contract_code: 'HD-DT-001',
        contract_name: 'Hợp đồng triển khai VNPT HIS',
        customer_id: 201,
        project_id: 301,
        payment_cycle: 'QUARTERLY',
        value: 400_000_000,
        status: 'SIGNED',
      },
      {
        id: 102,
        contract_code: 'HD-DT-002',
        contract_name: 'Hợp đồng dịch vụ SOC',
        customer_id: 202,
        project_id: 302,
        payment_cycle: 'MONTHLY',
        value: 180_000_000,
        status: 'SIGNED',
      },
    ],
    invoices: [
      {
        id: 1001,
        invoice_code: 'INV-202601-0001',
        contract_id: 101,
        contract_code: 'HD-DT-001',
        customer_id: 201,
        customer_name: 'Ngân hàng Việt Á',
        invoice_date: '2026-01-10',
        due_date: '2026-02-10',
        subtotal: 100_000_000,
        vat_rate: 10,
        vat_amount: 10_000_000,
        total_amount: 110_000_000,
        paid_amount: 110_000_000,
        outstanding: 0,
        status: 'PAID',
      },
      {
        id: 1002,
        invoice_code: 'INV-202602-0001',
        contract_id: 102,
        contract_code: 'HD-DT-002',
        customer_id: 201,
        customer_name: 'Ngân hàng Việt Á',
        invoice_date: '2026-02-05',
        due_date: '2026-02-20',
        subtotal: 27_272_727,
        vat_rate: 10,
        vat_amount: 2_727_273,
        total_amount: 30_000_000,
        paid_amount: 0,
        outstanding: 30_000_000,
        status: 'OVERDUE',
      },
      {
        id: 1003,
        invoice_code: 'INV-202603-0001',
        contract_id: 102,
        contract_code: 'HD-DT-002',
        customer_id: 202,
        customer_name: 'Tập đoàn Petrolimex',
        invoice_date: '2026-03-01',
        due_date: '2026-04-01',
        subtotal: 27_272_727,
        vat_rate: 10,
        vat_amount: 2_727_273,
        total_amount: 30_000_000,
        paid_amount: 0,
        outstanding: 30_000_000,
        status: 'ISSUED',
      },
    ],
    receipts: [
      {
        id: 2001,
        receipt_code: 'RCP-202601-0001',
        invoice_id: 1001,
        invoice_code: 'INV-202601-0001',
        contract_id: 101,
        customer_id: 201,
        customer_name: 'Ngân hàng Việt Á',
        receipt_date: '2026-01-20',
        amount: 110_000_000,
        payment_method: 'BANK_TRANSFER',
        transaction_ref: 'BIDV-20260120-001',
        status: 'CONFIRMED',
      },
    ],
    dashboardRequests: [],
    invoiceListRequests: [],
    dashboardPayload,
    debtAgingPayload,
  };
}

export async function registerFeeCollectionScenarioMock(
  page: Page,
  state: MockFeeCollectionScenarioState,
): Promise<void> {
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // Auth endpoints
    if (path === '/api/v5/bootstrap' && method === 'GET') {
      await fulfillJson(route, {
        data: {
          user: state.authUser,
          permissions: state.authUser.permissions ?? [],
          counters: {},
        },
      });
      return;
    }
    if (path === '/api/v5/auth/refresh') {
      await fulfillJson(route, { data: { ok: true } });
      return;
    }
    if (path === '/api/v5/auth/me' && method === 'GET') {
      await fulfillJson(route, { data: state.authUser });
      return;
    }
    if (path === '/api/v5/auth/tab/claim') {
      await fulfillJson(route, { data: { ok: true } });
      return;
    }
    if (path === '/api/v5/auth/login' && method === 'POST') {
      await fulfillJson(route, {
        data: {
          user: state.authUser,
          password_change_required: false,
        },
        password_change_required: false,
      });
      return;
    }

    // Master data
    if (path === '/api/v5/customers' && method === 'GET') {
      await fulfillJson(route, {
        data: state.customers,
        meta: paginatedMeta(state.customers.length),
      });
      return;
    }
    if (path === '/api/v5/contracts' && method === 'GET') {
      await fulfillJson(route, {
        data: state.contracts,
        meta: paginatedMeta(state.contracts.length, {
          kpis: {
            total_contracts: state.contracts.length,
            signed: 2,
            draft: 0,
            renewed: 0,
            expiring_soon: 0,
          },
        }),
      });
      return;
    }

    // Fee collection: Dashboard
    if (path === '/api/v5/fee-collection/dashboard' && method === 'GET') {
      state.dashboardRequests.push({
        period_from: String(url.searchParams.get('period_from') || ''),
        period_to: String(url.searchParams.get('period_to') || ''),
      });
      await fulfillJson(route, { data: state.dashboardPayload });
      return;
    }

    // Fee collection: Invoices
    if (path === '/api/v5/invoices' && method === 'GET') {
      state.invoiceListRequests.push({
        status: url.searchParams.get('status') ?? undefined,
        customer_id: url.searchParams.get('customer_id') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
        page: url.searchParams.get('page') ?? undefined,
      });
      const statusFilter = url.searchParams.get('status');
      const filtered = statusFilter
        ? state.invoices.filter((inv) => inv['status'] === statusFilter)
        : state.invoices;
      await fulfillJson(route, {
        data: filtered,
        meta: paginatedMeta(filtered.length, {
          kpis: {
            total_invoices: state.invoices.length,
            total_amount: 170_000_000,
            total_paid: 110_000_000,
            total_outstanding: 60_000_000,
            overdue_count: 1,
            overdue_amount: 30_000_000,
          },
        }),
      });
      return;
    }
    if (path.match(/^\/api\/v5\/invoices\/\d+$/) && method === 'GET') {
      const id = Number(path.split('/').pop());
      const inv = state.invoices.find((i) => i['id'] === id);
      if (inv) {
        await fulfillJson(route, { data: { ...inv, items: [] } });
      } else {
        await fulfillJson(route, { message: 'Not found' }, 404);
      }
      return;
    }
    if (path === '/api/v5/invoices' && method === 'POST') {
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      const newInvoice = {
        id: 9999,
        invoice_code: 'INV-202603-0099',
        status: 'DRAFT',
        total_amount: 0,
        paid_amount: 0,
        outstanding: 0,
        ...body,
      };
      state.invoices.push(newInvoice);
      await fulfillJson(route, { data: newInvoice }, 201);
      return;
    }

    // Fee collection: Receipts
    if (path === '/api/v5/receipts' && method === 'GET') {
      await fulfillJson(route, {
        data: state.receipts,
        meta: paginatedMeta(state.receipts.length, {
          kpis: { total_receipts: state.receipts.length, total_amount: 110_000_000 },
        }),
      });
      return;
    }
    if (path === '/api/v5/receipts' && method === 'POST') {
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      const newReceipt = {
        id: 9998,
        receipt_code: 'RCP-202603-0099',
        status: 'CONFIRMED',
        ...body,
      };
      state.receipts.push(newReceipt);
      await fulfillJson(route, { data: newReceipt }, 201);
      return;
    }

    // Fee collection: Debt reports
    if (path === '/api/v5/fee-collection/debt-aging' && method === 'GET') {
      await fulfillJson(route, { data: state.debtAgingPayload });
      return;
    }
    if (path === '/api/v5/fee-collection/debt-by-customer' && method === 'GET') {
      await fulfillJson(route, {
        data: (state.debtAgingPayload as { rows: unknown[] }).rows,
        meta: paginatedMeta(2),
      });
      return;
    }
    if (path === '/api/v5/fee-collection/debt-trend' && method === 'GET') {
      await fulfillJson(route, {
        data: [
          { month_key: '2025-10', month_label: 'Tháng 10/2025', total_outstanding: 20_000_000, total_overdue: 0 },
          { month_key: '2025-11', month_label: 'Tháng 11/2025', total_outstanding: 35_000_000, total_overdue: 10_000_000 },
          { month_key: '2025-12', month_label: 'Tháng 12/2025', total_outstanding: 50_000_000, total_overdue: 15_000_000 },
          { month_key: '2026-01', month_label: 'Tháng 1/2026', total_outstanding: 40_000_000, total_overdue: 10_000_000 },
          { month_key: '2026-02', month_label: 'Tháng 2/2026', total_outstanding: 60_000_000, total_overdue: 30_000_000 },
          { month_key: '2026-03', month_label: 'Tháng 3/2026', total_outstanding: 75_000_000, total_overdue: 30_000_000 },
        ],
      });
      return;
    }

    // Generic fallback
    if (path.startsWith('/api/v5/') && method === 'GET') {
      await fulfillJson(route, { data: [], meta: paginatedMeta(0) });
      return;
    }
    if (path.startsWith('/api/v5/')) {
      await fulfillJson(route, { message: `Unhandled mock: ${method} ${path}` }, 500);
      return;
    }

    await route.continue();
  });
}

export async function openFeeCollectionModule(page: Page): Promise<MockFeeCollectionScenarioState> {
  const state = buildFeeCollectionScenarioState();
  await registerFeeCollectionScenarioMock(page, state);
  await page.goto('/?tab=fee_collection');
  return state;
}
