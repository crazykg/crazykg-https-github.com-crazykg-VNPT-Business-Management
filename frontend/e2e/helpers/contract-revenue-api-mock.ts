import type { Page, Route } from '@playwright/test';

type MockAnalyticsRequest = {
  period_from: string;
  period_to: string;
  grouping: 'month' | 'quarter';
  contract_id: number | null;
};

type MockContractRevenueScenarioState = {
  authUser: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  projectItems: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  paymentSchedules: Array<Record<string, unknown>>;
  analyticsRequests: MockAnalyticsRequest[];
  analyticsByGrouping: Record<'month' | 'quarter', Record<string, unknown>>;
  itemBreakdownsByContract: Record<number, Array<Record<string, unknown>>>;
};

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

export function buildContractRevenueScenarioState(): MockContractRevenueScenarioState {
  const analyticsKpis = {
    expected_revenue: 180_000_000,
    actual_collected: 120_000_000,
    outstanding: 60_000_000,
    overdue_amount: 15_000_000,
    overdue_count: 1,
    carry_over_from_previous: 10_000_000,
    cumulative_collected: 320_000_000,
    collection_rate: 67,
    avg_days_to_collect: 6,
    on_time_rate: 75,
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
        'contracts.write',
        'contracts.delete',
        'customers.read',
        'projects.read',
        'products.read',
        'documents.read',
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
    projects: [
      {
        id: 301,
        project_code: 'DA001',
        project_name: 'Dự án triển khai VNPT HIS',
        customer_id: 201,
        status: 'ONGOING',
        investment_mode: 'DAU_TU',
      },
      {
        id: 302,
        project_code: 'DA002',
        project_name: 'Dự án dịch vụ giám sát SOC',
        customer_id: 202,
        status: 'ONGOING',
        investment_mode: 'THUE_DICH_VU_DACTHU',
      },
    ],
    products: [
      {
        id: 401,
        uuid: 'prd-401',
        product_code: 'VNPT_HIS3',
        product_name: 'Phần mềm VNPT HIS L3',
        domain_id: 1,
        vendor_id: 1,
        standard_price: 150_000_000,
        unit: 'License',
      },
      {
        id: 402,
        uuid: 'prd-402',
        product_code: 'SOC_MONITOR',
        product_name: 'Dịch vụ giám sát SOC',
        domain_id: 1,
        vendor_id: 1,
        standard_price: 80_000_000,
        unit: 'Gói',
      },
      {
        id: 403,
        uuid: 'prd-403',
        product_code: 'MAINT_NOC',
        product_name: 'Dịch vụ vận hành NOC',
        domain_id: 1,
        vendor_id: 1,
        standard_price: 60_000_000,
        unit: 'Tháng',
      },
    ],
    projectItems: [
      {
        id: 501,
        project_id: 301,
        product_id: 401,
        product_code: 'VNPT_HIS3',
        product_name: 'Phần mềm VNPT HIS L3',
        quantity: 1,
        unit_price: 150_000_000,
        unit: 'License',
      },
      {
        id: 502,
        project_id: 301,
        product_id: 402,
        product_code: 'SOC_MONITOR',
        product_name: 'Dịch vụ giám sát SOC',
        quantity: 1,
        unit_price: 80_000_000,
        unit: 'Gói',
      },
      {
        id: 503,
        project_id: 302,
        product_id: 403,
        product_code: 'MAINT_NOC',
        product_name: 'Dịch vụ vận hành NOC',
        quantity: 12,
        unit_price: 5_000_000,
        unit: 'Tháng',
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
        total_value: 400_000_000,
        effective_date: '2026-01-15',
        expiry_date: '2026-12-31',
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
        total_value: 180_000_000,
        effective_date: '2026-02-01',
        expiry_date: '2026-12-31',
        status: 'SIGNED',
      },
    ],
    paymentSchedules: [
      {
        id: 601,
        contract_id: 101,
        cycle_number: 1,
        milestone_name: 'Thanh toán đợt 1',
        expected_date: '2026-01-15',
        expected_amount: 60_000_000,
        actual_paid_date: '2026-01-20',
        actual_paid_amount: 60_000_000,
        status: 'PAID',
      },
      {
        id: 602,
        contract_id: 102,
        cycle_number: 1,
        milestone_name: 'Phí dịch vụ tháng 2/2026',
        expected_date: '2026-02-20',
        expected_amount: 15_000_000,
        actual_paid_date: '2026-02-22',
        actual_paid_amount: 15_000_000,
        status: 'PAID',
      },
    ],
    analyticsRequests: [],
    analyticsByGrouping: {
      month: {
        kpis: analyticsKpis,
        by_period: [
          {
            period_key: '2026-01',
            period_label: '01/2026',
            expected: 70_000_000,
            actual: 60_000_000,
            overdue: 0,
            cumulative_expected: 70_000_000,
            cumulative_actual: 60_000_000,
            carry_over: 0,
            schedule_count: 2,
            paid_count: 1,
          },
          {
            period_key: '2026-02',
            period_label: '02/2026',
            expected: 55_000_000,
            actual: 30_000_000,
            overdue: 10_000_000,
            cumulative_expected: 125_000_000,
            cumulative_actual: 90_000_000,
            carry_over: 5_000_000,
            schedule_count: 3,
            paid_count: 1,
          },
          {
            period_key: '2026-03',
            period_label: '03/2026',
            expected: 55_000_000,
            actual: 30_000_000,
            overdue: 15_000_000,
            cumulative_expected: 180_000_000,
            cumulative_actual: 120_000_000,
            carry_over: 10_000_000,
            schedule_count: 3,
            paid_count: 1,
          },
        ],
        by_cycle: [
          {
            cycle: 'MONTHLY',
            cycle_label: 'Hàng tháng',
            contract_count: 1,
            expected: 60_000_000,
            actual: 30_000_000,
            percentage_of_total: 33,
          },
          {
            cycle: 'QUARTERLY',
            cycle_label: 'Hàng quý',
            contract_count: 1,
            expected: 120_000_000,
            actual: 90_000_000,
            percentage_of_total: 67,
          },
        ],
        by_contract: [
          {
            contract_id: 101,
            contract_code: 'HD-DT-001',
            contract_name: 'Hợp đồng triển khai VNPT HIS',
            customer_name: 'KH001 - Ngân hàng Việt Á',
            payment_cycle: 'QUARTERLY',
            contract_value: 400_000_000,
            expected_in_period: 120_000_000,
            actual_in_period: 90_000_000,
            outstanding: 30_000_000,
            items: null,
          },
          {
            contract_id: 102,
            contract_code: 'HD-DT-002',
            contract_name: 'Hợp đồng dịch vụ SOC',
            customer_name: 'KH002 - Tập đoàn Petrolimex',
            payment_cycle: 'MONTHLY',
            contract_value: 180_000_000,
            expected_in_period: 60_000_000,
            actual_in_period: 30_000_000,
            outstanding: 30_000_000,
            items: null,
          },
        ],
        by_item: null,
        overdue_details: [
          {
            schedule_id: 701,
            contract_id: 102,
            contract_code: 'HD-DT-002',
            customer_name: 'KH002 - Tập đoàn Petrolimex',
            milestone_name: 'Phí dịch vụ tháng 3/2026',
            expected_date: '2026-03-20',
            expected_amount: 15_000_000,
            days_overdue: 12,
          },
        ],
      },
      quarter: {
        kpis: analyticsKpis,
        by_period: [
          {
            period_key: '2026-Q1',
            period_label: 'Q1/2026',
            expected: 180_000_000,
            actual: 120_000_000,
            overdue: 15_000_000,
            cumulative_expected: 180_000_000,
            cumulative_actual: 120_000_000,
            carry_over: 10_000_000,
            schedule_count: 8,
            paid_count: 3,
          },
        ],
        by_cycle: [
          {
            cycle: 'MONTHLY',
            cycle_label: 'Hàng tháng',
            contract_count: 1,
            expected: 60_000_000,
            actual: 30_000_000,
            percentage_of_total: 33,
          },
          {
            cycle: 'QUARTERLY',
            cycle_label: 'Hàng quý',
            contract_count: 1,
            expected: 120_000_000,
            actual: 90_000_000,
            percentage_of_total: 67,
          },
        ],
        by_contract: [
          {
            contract_id: 101,
            contract_code: 'HD-DT-001',
            contract_name: 'Hợp đồng triển khai VNPT HIS',
            customer_name: 'KH001 - Ngân hàng Việt Á',
            payment_cycle: 'QUARTERLY',
            contract_value: 400_000_000,
            expected_in_period: 120_000_000,
            actual_in_period: 90_000_000,
            outstanding: 30_000_000,
            items: null,
          },
          {
            contract_id: 102,
            contract_code: 'HD-DT-002',
            contract_name: 'Hợp đồng dịch vụ SOC',
            customer_name: 'KH002 - Tập đoàn Petrolimex',
            payment_cycle: 'MONTHLY',
            contract_value: 180_000_000,
            expected_in_period: 60_000_000,
            actual_in_period: 30_000_000,
            outstanding: 30_000_000,
            items: null,
          },
        ],
        by_item: null,
        overdue_details: [
          {
            schedule_id: 701,
            contract_id: 102,
            contract_code: 'HD-DT-002',
            customer_name: 'KH002 - Tập đoàn Petrolimex',
            milestone_name: 'Phí dịch vụ tháng 3/2026',
            expected_date: '2026-03-20',
            expected_amount: 15_000_000,
            days_overdue: 12,
          },
        ],
      },
    },
    itemBreakdownsByContract: {
      101: [
        {
          product_id: 401,
          product_code: 'VNPT_HIS3',
          product_name: 'Phần mềm VNPT HIS L3',
          unit: 'License',
          quantity: 1,
          unit_price: 150_000_000,
          line_total: 150_000_000,
          proportion: 65,
          allocated_expected: 78_000_000,
          allocated_actual: 60_000_000,
          allocated_outstanding: 18_000_000,
        },
        {
          product_id: 402,
          product_code: 'SOC_MONITOR',
          product_name: 'Dịch vụ giám sát SOC',
          unit: 'Gói',
          quantity: 1,
          unit_price: 80_000_000,
          line_total: 80_000_000,
          proportion: 35,
          allocated_expected: 42_000_000,
          allocated_actual: 30_000_000,
          allocated_outstanding: 12_000_000,
        },
      ],
      102: [
        {
          product_id: 403,
          product_code: 'MAINT_NOC',
          product_name: 'Dịch vụ vận hành NOC',
          unit: 'Tháng',
          quantity: 12,
          unit_price: 5_000_000,
          line_total: 60_000_000,
          proportion: 100,
          allocated_expected: 60_000_000,
          allocated_actual: 30_000_000,
          allocated_outstanding: 30_000_000,
        },
      ],
    },
  };
}

export async function registerContractRevenueScenarioMock(
  page: Page,
  state: MockContractRevenueScenarioState,
): Promise<void> {
  await page.route('**/api/v5/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

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

    if (path === '/api/v5/customers' && method === 'GET') {
      await fulfillJson(route, {
        data: state.customers,
        meta: paginatedMeta(state.customers.length),
      });
      return;
    }

    if (path === '/api/v5/projects' && method === 'GET') {
      await fulfillJson(route, {
        data: state.projects,
        meta: paginatedMeta(state.projects.length),
      });
      return;
    }

    if (path === '/api/v5/products' && method === 'GET') {
      await fulfillJson(route, {
        data: state.products,
        meta: paginatedMeta(state.products.length),
      });
      return;
    }

    if (path === '/api/v5/project-items' && method === 'GET') {
      await fulfillJson(route, {
        data: state.projectItems,
        meta: paginatedMeta(state.projectItems.length),
      });
      return;
    }

    if (path === '/api/v5/payment-schedules' && method === 'GET') {
      await fulfillJson(route, { data: state.paymentSchedules });
      return;
    }

    if (path === '/api/v5/contracts/revenue-analytics' && method === 'GET') {
      const grouping = url.searchParams.get('grouping') === 'quarter' ? 'quarter' : 'month';
      const contractIdRaw = Number(url.searchParams.get('contract_id') || 0);
      const contractId = Number.isFinite(contractIdRaw) && contractIdRaw > 0 ? contractIdRaw : null;

      state.analyticsRequests.push({
        period_from: String(url.searchParams.get('period_from') || ''),
        period_to: String(url.searchParams.get('period_to') || ''),
        grouping,
        contract_id: contractId,
      });

      const payload = clone(state.analyticsByGrouping[grouping]);
      payload.by_item = contractId ? clone(state.itemBreakdownsByContract[contractId] ?? []) : null;

      await fulfillJson(route, { data: payload });
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
            expiry_warning_days: 30,
            collection_rate: 67,
            new_signed_count: 2,
            new_signed_value: 580_000_000,
            overdue_payment_amount: 15_000_000,
            actual_collected_value: 120_000_000,
          },
        }),
      });
      return;
    }

    if (path.startsWith('/api/v5/') && method === 'GET') {
      await fulfillJson(route, {
        data: [],
        meta: paginatedMeta(0),
      });
      return;
    }

    if (path.startsWith('/api/v5/')) {
      await fulfillJson(route, {
        message: `Unhandled mock request: ${method} ${path}`,
      }, 500);
      return;
    }

    await route.continue();
  });
}

export async function openContractRevenueModule(page: Page): Promise<MockContractRevenueScenarioState> {
  const state = buildContractRevenueScenarioState();
  await registerContractRevenueScenarioMock(page, state);
  await page.goto('/?tab=contracts');
  return state;
}
