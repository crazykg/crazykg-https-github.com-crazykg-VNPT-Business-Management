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

type MockInvoiceRow = Record<string, unknown> & {
  id: number;
  invoice_code: string;
  contract_id: number;
  customer_id: number;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  status: string;
  lifecycle_status?: string;
  items?: Array<Record<string, unknown>>;
  customer_name?: string;
  contract_code?: string;
  is_overdue?: boolean;
};

type MockReceiptRow = Record<string, unknown> & {
  id: number;
  receipt_code: string;
  contract_id: number;
  customer_id: number;
  receipt_date: string;
  amount: number;
  payment_method: string;
  status: string;
  invoice_id?: number | null;
  invoice_code?: string | null;
  customer_name?: string;
  contract_code?: string | null;
  confirmed_by_name?: string | null;
};

export type MockFeeCollectionScenarioState = {
  authUser: Record<string, unknown>;
  customers: Array<Record<string, unknown>>;
  contracts: Array<Record<string, unknown>>;
  invoices: MockInvoiceRow[];
  receipts: MockReceiptRow[];
  dashboardRequests: MockDashboardRequest[];
  invoiceListRequests: MockInvoiceListRequest[];
  dashboardPayload: Record<string, unknown>;
  debtAgingPayload: Record<string, unknown>;
  nextInvoiceId: number;
  nextReceiptId: number;
};

const TODAY = '2026-03-31';

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearch(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compareDate(value: string, other: string): number {
  return normalizeText(value).localeCompare(normalizeText(other));
}

function buildInvoiceCode(id: number): string {
  return `INV-202603-${String(id).padStart(4, '0')}`;
}

function buildReceiptCode(id: number): string {
  return `RCP-202603-${String(id).padStart(4, '0')}`;
}

function buildInvoiceItems(items: unknown, defaultVatRate = 10): Array<Record<string, unknown>> {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((row, index) => {
    const item = row as Record<string, unknown>;
    const quantity = toNumber(item.quantity, 1);
    const unitPrice = toNumber(item.unit_price, 0);
    const vatRate = toNumber(item.vat_rate, defaultVatRate);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    const vatAmount = Number((lineTotal * vatRate / 100).toFixed(2));

    return {
      id: item.id ?? `${index + 1}`,
      description: normalizeText(item.description),
      unit: normalizeText(item.unit) || null,
      quantity,
      unit_price: unitPrice,
      vat_rate: vatRate,
      line_total: lineTotal,
      vat_amount: vatAmount,
      sort_order: item.sort_order ?? index,
    };
  });
}

function resolveInvoiceLifecycleStatus(invoice: MockInvoiceRow): string {
  const rawStatus = normalizeText(invoice.lifecycle_status ?? invoice.status).toUpperCase();
  return rawStatus || 'DRAFT';
}

function buildInvoiceKpis(invoices: MockInvoiceRow[]) {
  const activeInvoices = invoices.filter((invoice) => !['CANCELLED', 'VOID'].includes(normalizeText(invoice.status).toUpperCase()));
  const overdueInvoices = invoices.filter((invoice) => Boolean(invoice.is_overdue));

  return {
    total_invoices: invoices.length,
    total_amount: activeInvoices.reduce((sum, invoice) => sum + toNumber(invoice.total_amount), 0),
    total_paid: activeInvoices.reduce((sum, invoice) => sum + toNumber(invoice.paid_amount), 0),
    total_outstanding: activeInvoices.reduce((sum, invoice) => sum + toNumber(invoice.outstanding), 0),
    overdue_count: overdueInvoices.length,
    overdue_amount: overdueInvoices.reduce((sum, invoice) => sum + toNumber(invoice.outstanding), 0),
  };
}

function findContract(state: MockFeeCollectionScenarioState, contractId: unknown) {
  return state.contracts.find((contract) => Number(contract.id) === toNumber(contractId));
}

function findCustomer(state: MockFeeCollectionScenarioState, customerId: unknown) {
  return state.customers.find((customer) => Number(customer.id) === toNumber(customerId));
}

function syncSingleInvoice(state: MockFeeCollectionScenarioState, invoice: MockInvoiceRow): MockInvoiceRow {
  const items = buildInvoiceItems(invoice.items, toNumber(invoice.vat_rate, 10));
  const subtotal = items.length > 0
    ? Number(items.reduce((sum, item) => sum + toNumber(item.line_total), 0).toFixed(2))
    : toNumber(invoice.subtotal);
  const vatAmount = items.length > 0
    ? Number(items.reduce((sum, item) => sum + toNumber(item.vat_amount), 0).toFixed(2))
    : toNumber(invoice.vat_amount);
  const totalAmount = Number((subtotal + vatAmount).toFixed(2));
  const paidAmount = Number(toNumber(invoice.paid_amount).toFixed(2));
  const outstanding = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));
  const lifecycleStatus = resolveInvoiceLifecycleStatus(invoice);
  const isOverdue = (
    outstanding > 0
    && lifecycleStatus !== 'DRAFT'
    && !['PAID', 'CANCELLED', 'VOID'].includes(lifecycleStatus)
    && compareDate(invoice.due_date, TODAY) < 0
  );

  let status = lifecycleStatus;
  if (['CANCELLED', 'VOID'].includes(lifecycleStatus)) {
    status = lifecycleStatus;
  } else if (outstanding <= 0 && totalAmount > 0) {
    status = 'PAID';
  } else if (paidAmount > 0 && outstanding > 0) {
    status = 'PARTIAL';
  } else if (lifecycleStatus === 'OVERDUE' || (lifecycleStatus === 'ISSUED' && isOverdue)) {
    status = lifecycleStatus === 'OVERDUE' ? 'OVERDUE' : 'ISSUED';
  } else if (!lifecycleStatus) {
    status = 'DRAFT';
  }

  const contract = findContract(state, invoice.contract_id);
  const customer = findCustomer(state, invoice.customer_id);

  return {
    ...invoice,
    contract_id: toNumber(invoice.contract_id),
    customer_id: toNumber(invoice.customer_id),
    contract_code: normalizeText(invoice.contract_code) || normalizeText(contract?.contract_code) || undefined,
    customer_name: normalizeText(invoice.customer_name) || normalizeText(customer?.customer_name) || undefined,
    invoice_date: normalizeText(invoice.invoice_date),
    due_date: normalizeText(invoice.due_date),
    subtotal,
    vat_rate: toNumber(invoice.vat_rate, 10),
    vat_amount: vatAmount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    outstanding,
    is_overdue: isOverdue,
    status,
    lifecycle_status: lifecycleStatus,
    items,
  };
}

function reconcileInvoicesFromReceipts(state: MockFeeCollectionScenarioState): void {
  const paidByInvoiceId = new Map<number, number>();

  state.receipts.forEach((receipt) => {
    if (normalizeText(receipt.status).toUpperCase() !== 'CONFIRMED') {
      return;
    }

    const invoiceId = toNumber(receipt.invoice_id, 0);
    if (!invoiceId) {
      return;
    }

    paidByInvoiceId.set(invoiceId, (paidByInvoiceId.get(invoiceId) ?? 0) + toNumber(receipt.amount));
  });

  state.invoices = state.invoices
    .map((invoice) => ({
      ...invoice,
      paid_amount: Number((paidByInvoiceId.get(invoice.id) ?? 0).toFixed(2)),
    }))
    .map((invoice) => syncSingleInvoice(state, invoice))
    .sort((left, right) => Number(right.id) - Number(left.id));
}

function syncReceipt(state: MockFeeCollectionScenarioState, receipt: MockReceiptRow): MockReceiptRow {
  const contract = findContract(state, receipt.contract_id);
  const customer = findCustomer(state, receipt.customer_id);
  const linkedInvoice = receipt.invoice_id == null
    ? null
    : state.invoices.find((invoice) => invoice.id === toNumber(receipt.invoice_id));

  return {
    ...receipt,
    contract_id: toNumber(receipt.contract_id),
    customer_id: toNumber(receipt.customer_id),
    invoice_id: receipt.invoice_id == null ? null : toNumber(receipt.invoice_id),
    contract_code: normalizeText(receipt.contract_code) || normalizeText(contract?.contract_code) || undefined,
    customer_name: normalizeText(receipt.customer_name) || normalizeText(customer?.customer_name) || undefined,
    invoice_code: normalizeText(receipt.invoice_code) || normalizeText(linkedInvoice?.invoice_code) || null,
    receipt_date: normalizeText(receipt.receipt_date),
    amount: Number(toNumber(receipt.amount).toFixed(2)),
    payment_method: normalizeText(receipt.payment_method) || 'BANK_TRANSFER',
    status: normalizeText(receipt.status).toUpperCase() || 'CONFIRMED',
    confirmed_by_name: normalizeText(receipt.confirmed_by_name) || 'Smoke Tester',
  };
}

function syncReceipts(state: MockFeeCollectionScenarioState): void {
  state.receipts = state.receipts
    .map((receipt) => syncReceipt(state, receipt))
    .sort((left, right) => Number(right.id) - Number(left.id));
}

function findAutoLinkedInvoice(state: MockFeeCollectionScenarioState, contractId: number, customerId: number): MockInvoiceRow | undefined {
  return [...state.invoices]
    .sort((left, right) => Number(right.id) - Number(left.id))
    .find((invoice) => (
      Number(invoice.contract_id) === contractId
      && Number(invoice.customer_id) === customerId
      && toNumber(invoice.outstanding) > 0
      && !['CANCELLED', 'VOID', 'DRAFT'].includes(normalizeText(invoice.status).toUpperCase())
    ));
}

function createInvoiceFromPayload(state: MockFeeCollectionScenarioState, body: Record<string, unknown>): MockInvoiceRow {
  const nextId = state.nextInvoiceId++;
  const contractId = toNumber(body.contract_id);
  const customerId = toNumber(body.customer_id || findContract(state, contractId)?.customer_id);
  const items = buildInvoiceItems(body.items, toNumber(body.vat_rate, 10));
  const rawInvoice: MockInvoiceRow = {
    id: nextId,
    invoice_code: buildInvoiceCode(nextId),
    contract_id: contractId,
    customer_id: customerId,
    invoice_date: normalizeText(body.invoice_date) || TODAY,
    due_date: normalizeText(body.due_date) || TODAY,
    period_from: normalizeText(body.period_from) || null,
    period_to: normalizeText(body.period_to) || null,
    vat_rate: toNumber(body.vat_rate, 10),
    subtotal: 0,
    vat_amount: 0,
    total_amount: 0,
    paid_amount: 0,
    outstanding: 0,
    status: 'DRAFT',
    lifecycle_status: 'DRAFT',
    notes: normalizeText(body.notes) || null,
    items,
    created_at: `${TODAY} 09:00:00`,
    updated_at: `${TODAY} 09:00:00`,
  };

  const invoice = syncSingleInvoice(state, rawInvoice);
  state.invoices.unshift(invoice);
  reconcileInvoicesFromReceipts(state);
  return clone(invoice);
}

function updateInvoiceFromPayload(state: MockFeeCollectionScenarioState, id: number, body: Record<string, unknown>): MockInvoiceRow | null {
  const index = state.invoices.findIndex((invoice) => invoice.id === id);
  if (index < 0) {
    return null;
  }

  const current = state.invoices[index];
  const nextLifecycleStatus = normalizeText(body.status).toUpperCase() || resolveInvoiceLifecycleStatus(current);
  const merged: MockInvoiceRow = {
    ...current,
    ...body,
    id,
    contract_id: toNumber(body.contract_id ?? current.contract_id),
    customer_id: toNumber(body.customer_id ?? current.customer_id),
    invoice_date: normalizeText(body.invoice_date ?? current.invoice_date),
    due_date: normalizeText(body.due_date ?? current.due_date),
    notes: body.notes ?? current.notes ?? null,
    lifecycle_status: nextLifecycleStatus,
    items: body.items !== undefined ? buildInvoiceItems(body.items, toNumber(body.vat_rate ?? current.vat_rate, 10)) : current.items,
    updated_at: `${TODAY} 10:00:00`,
  };

  state.invoices[index] = syncSingleInvoice(state, merged);
  reconcileInvoicesFromReceipts(state);
  return clone(state.invoices.find((invoice) => invoice.id === id) ?? null);
}

function deleteInvoiceById(state: MockFeeCollectionScenarioState, id: number): boolean {
  const sizeBefore = state.invoices.length;
  state.invoices = state.invoices.filter((invoice) => invoice.id !== id);
  state.receipts = state.receipts.filter((receipt) => toNumber(receipt.invoice_id, 0) !== id);
  reconcileInvoicesFromReceipts(state);
  syncReceipts(state);
  return state.invoices.length !== sizeBefore;
}

function createReceiptFromPayload(state: MockFeeCollectionScenarioState, body: Record<string, unknown>): MockReceiptRow {
  const nextId = state.nextReceiptId++;
  const contractId = toNumber(body.contract_id);
  const customerId = toNumber(body.customer_id || findContract(state, contractId)?.customer_id);
  const requestedInvoiceId = body.invoice_id == null ? null : toNumber(body.invoice_id);
  const linkedInvoice = requestedInvoiceId
    ? state.invoices.find((invoice) => invoice.id === requestedInvoiceId)
    : findAutoLinkedInvoice(state, contractId, customerId);

  const receipt: MockReceiptRow = {
    id: nextId,
    receipt_code: buildReceiptCode(nextId),
    contract_id: contractId,
    customer_id: customerId,
    invoice_id: linkedInvoice?.id ?? null,
    invoice_code: linkedInvoice?.invoice_code ?? null,
    receipt_date: normalizeText(body.receipt_date) || TODAY,
    amount: Number(toNumber(body.amount).toFixed(2)),
    payment_method: normalizeText(body.payment_method) || 'BANK_TRANSFER',
    bank_name: body.bank_name ?? null,
    bank_account: body.bank_account ?? null,
    transaction_ref: body.transaction_ref ?? null,
    notes: body.notes ?? null,
    status: 'CONFIRMED',
    confirmed_by_name: 'Smoke Tester',
    confirmed_at: `${TODAY} 10:30:00`,
    created_at: `${TODAY} 10:30:00`,
  };

  state.receipts.unshift(syncReceipt(state, receipt));
  reconcileInvoicesFromReceipts(state);
  syncReceipts(state);
  return clone(state.receipts.find((item) => item.id === nextId)!);
}

function updateReceiptFromPayload(state: MockFeeCollectionScenarioState, id: number, body: Record<string, unknown>): MockReceiptRow | null {
  const index = state.receipts.findIndex((receipt) => receipt.id === id);
  if (index < 0) {
    return null;
  }

  const current = state.receipts[index];
  const requestedInvoiceId = body.invoice_id == null
    ? (current.invoice_id == null ? null : toNumber(current.invoice_id))
    : toNumber(body.invoice_id);
  const linkedInvoice = requestedInvoiceId
    ? state.invoices.find((invoice) => invoice.id === requestedInvoiceId)
    : findAutoLinkedInvoice(
        state,
        toNumber(body.contract_id ?? current.contract_id),
        toNumber(body.customer_id ?? current.customer_id),
      );

  state.receipts[index] = syncReceipt(state, {
    ...current,
    ...body,
    id,
    invoice_id: linkedInvoice?.id ?? null,
    invoice_code: linkedInvoice?.invoice_code ?? null,
  });
  reconcileInvoicesFromReceipts(state);
  syncReceipts(state);
  return clone(state.receipts.find((item) => item.id === id) ?? null);
}

function deleteReceiptById(state: MockFeeCollectionScenarioState, id: number): boolean {
  const sizeBefore = state.receipts.length;
  state.receipts = state.receipts.filter((receipt) => receipt.id !== id);
  reconcileInvoicesFromReceipts(state);
  syncReceipts(state);
  return state.receipts.length !== sizeBefore;
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

  const state: MockFeeCollectionScenarioState = {
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
        lifecycle_status: 'ISSUED',
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
        lifecycle_status: 'OVERDUE',
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
        lifecycle_status: 'ISSUED',
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
    nextInvoiceId: 1004,
    nextReceiptId: 2002,
  };

  reconcileInvoicesFromReceipts(state);
  syncReceipts(state);
  return state;
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
    if (path === '/api/v5/auth/logout' && method === 'POST') {
      await fulfillJson(route, { data: { ok: true } });
      return;
    }

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

    if (path === '/api/v5/fee-collection/dashboard' && method === 'GET') {
      state.dashboardRequests.push({
        period_from: String(url.searchParams.get('period_from') || ''),
        period_to: String(url.searchParams.get('period_to') || ''),
      });
      await fulfillJson(route, { data: state.dashboardPayload });
      return;
    }

    if (path === '/api/v5/invoices' && method === 'GET') {
      state.invoiceListRequests.push({
        status: url.searchParams.get('status') ?? undefined,
        customer_id: url.searchParams.get('customer_id') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
        page: url.searchParams.get('page') ?? undefined,
      });

      const statusFilter = normalizeText(url.searchParams.get('status')).toUpperCase();
      const customerFilter = normalizeText(url.searchParams.get('customer_id'));
      const query = normalizeSearch(url.searchParams.get('q'));
      const rows = state.invoices.filter((invoice) => {
        if (statusFilter && normalizeText(invoice.status).toUpperCase() !== statusFilter) {
          return false;
        }
        if (customerFilter && String(invoice.customer_id) !== customerFilter) {
          return false;
        }
        if (query) {
          return [
            invoice.invoice_code,
            invoice.customer_name,
            invoice.contract_code,
          ].some((field) => normalizeSearch(field).includes(query));
        }
        return true;
      });

      await fulfillJson(route, {
        data: clone(rows),
        meta: paginatedMeta(rows.length, {
          kpis: buildInvoiceKpis(state.invoices),
        }),
      });
      return;
    }

    const invoiceMatch = path.match(/^\/api\/v5\/invoices\/(\d+)$/);
    if (invoiceMatch && method === 'GET') {
      const id = Number(invoiceMatch[1]);
      const invoice = state.invoices.find((item) => item.id === id);
      if (!invoice) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: clone(invoice) });
      return;
    }
    if (invoiceMatch && method === 'PUT') {
      const id = Number(invoiceMatch[1]);
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      const updated = updateInvoiceFromPayload(state, id, body);
      if (!updated) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: updated });
      return;
    }
    if (invoiceMatch && method === 'DELETE') {
      const id = Number(invoiceMatch[1]);
      if (!deleteInvoiceById(state, id)) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: { ok: true } });
      return;
    }
    if (path === '/api/v5/invoices' && method === 'POST') {
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      await fulfillJson(route, { data: createInvoiceFromPayload(state, body) }, 201);
      return;
    }
    if (path === '/api/v5/invoices/bulk-generate' && method === 'POST') {
      await fulfillJson(route, { data: { created_count: 0, invoices: [] } });
      return;
    }

    if (path === '/api/v5/receipts' && method === 'GET') {
      const customerFilter = normalizeText(url.searchParams.get('customer_id'));
      const methodFilter = normalizeText(url.searchParams.get('payment_method')).toUpperCase();
      const query = normalizeSearch(url.searchParams.get('q'));
      const rows = state.receipts.filter((receipt) => {
        if (customerFilter && String(receipt.customer_id) !== customerFilter) {
          return false;
        }
        if (methodFilter && normalizeText(receipt.payment_method).toUpperCase() !== methodFilter) {
          return false;
        }
        if (query) {
          return [
            receipt.receipt_code,
            receipt.customer_name,
            receipt.invoice_code,
          ].some((field) => normalizeSearch(field).includes(query));
        }
        return true;
      });

      await fulfillJson(route, {
        data: clone(rows),
        meta: paginatedMeta(rows.length, {
          kpis: {
            total_receipts: rows.length,
            total_amount: rows.reduce((sum, receipt) => sum + toNumber(receipt.amount), 0),
          },
        }),
      });
      return;
    }

    const receiptMatch = path.match(/^\/api\/v5\/receipts\/(\d+)$/);
    if (receiptMatch && method === 'GET') {
      const id = Number(receiptMatch[1]);
      const receipt = state.receipts.find((item) => item.id === id);
      if (!receipt) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: clone(receipt) });
      return;
    }
    if (receiptMatch && method === 'PUT') {
      const id = Number(receiptMatch[1]);
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      const updated = updateReceiptFromPayload(state, id, body);
      if (!updated) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: updated });
      return;
    }
    if (receiptMatch && method === 'DELETE') {
      const id = Number(receiptMatch[1]);
      if (!deleteReceiptById(state, id)) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: { ok: true } });
      return;
    }
    const reverseReceiptMatch = path.match(/^\/api\/v5\/receipts\/(\d+)\/reverse$/);
    if (reverseReceiptMatch && method === 'POST') {
      const id = Number(reverseReceiptMatch[1]);
      const updated = updateReceiptFromPayload(state, id, { status: 'REJECTED' });
      if (!updated) {
        await fulfillJson(route, { message: 'Not found' }, 404);
        return;
      }

      await fulfillJson(route, { data: updated });
      return;
    }
    if (path === '/api/v5/receipts' && method === 'POST') {
      const body = (await request.postDataJSON()) as Record<string, unknown>;
      await fulfillJson(route, { data: createReceiptFromPayload(state, body) }, 201);
      return;
    }

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
  await page.goto('/');
  await page.getByText('Bảng điều khiển KPI chiến lược').first().waitFor();
  await page.getByRole('button', { name: /Thu cước/ }).click();
  await page.getByRole('heading', { name: 'Thu cước & Công nợ' }).waitFor();
  return state;
}
