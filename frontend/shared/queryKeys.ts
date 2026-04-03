export interface ListQuery {
  page?: number;
  per_page?: number;
  q?: string;
  sort_key?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface PeriodRangeQuery {
  period_from: string;
  period_to: string;
  [key: string]: unknown;
}

export interface RevenueTargetsQuery {
  period_type?: string;
  year?: number;
  dept_id?: number;
  [key: string]: unknown;
}

export interface RevenueForecastQuery {
  horizon_months?: number;
  dept_id?: number;
  [key: string]: unknown;
}

export interface RevenueReportQuery extends PeriodRangeQuery {
  dimension: string;
}

export interface CustomerRequestTimesheetQuery {
  start_date?: string;
  end_date?: string;
  [key: string]: unknown;
}

export interface SupportConfigQuery extends Record<string, unknown> {
  include_inactive?: boolean;
}

const normalizeKeyPart = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeKeyPart);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeKeyPart((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
};

const normalizeListQuery = <T extends Record<string, unknown>>(filters: T): T =>
  normalizeKeyPart(filters) as T;

export const queryKeys = {
  admin: {
    all: ['admin'] as const,
    roles: () => ['admin', 'roles'] as const,
    permissions: () => ['admin', 'permissions'] as const,
    userAccess: () => ['admin', 'user-access'] as const,
    auditLogs: (filters: ListQuery = {}) => ['admin', 'audit-logs', normalizeListQuery(filters)] as const,
    feedbacks: (filters: ListQuery = {}) => ['admin', 'feedbacks', normalizeListQuery(filters)] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (filters: ListQuery = {}) => ['customers', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['customers', 'detail', id] as const,
  },
  departments: {
    all: ['departments'] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (filters: ListQuery = {}) => ['documents', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['documents', 'detail', id] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (filters: ListQuery = {}) => ['employees', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['employees', 'detail', id] as const,
    partyProfiles: (filters: ListQuery = {}) => ['employees', 'party-profiles', normalizeListQuery(filters)] as const,
  },
  contracts: {
    all: ['contracts'] as const,
    list: (filters: ListQuery = {}) => ['contracts', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['contracts', 'detail', id] as const,
    paymentSchedules: (contractId: number | string | 'all' = 'all') =>
      ['contracts', 'payment-schedules', contractId] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters: ListQuery = {}) => ['invoices', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['invoices', 'detail', id] as const,
    dashboard: (period: PeriodRangeQuery) => ['invoices', 'dashboard', normalizeListQuery(period)] as const,
    dunningLogs: (id: number | string) => ['invoices', 'detail', id, 'dunning-logs'] as const,
  },
  customerRequests: {
    all: ['customer-requests'] as const,
    list: (filters: ListQuery = {}) => ['customer-requests', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['customer-requests', 'detail', id] as const,
    processDetail: (id: number | string, processCode: string) =>
      ['customer-requests', 'detail', id, 'process', processCode] as const,
    timeline: (id: number | string) => ['customer-requests', 'detail', id, 'timeline'] as const,
    worklogs: (id: number | string) => ['customer-requests', 'detail', id, 'worklogs'] as const,
    timesheet: (filters: CustomerRequestTimesheetQuery) =>
      ['customer-requests', 'timesheet', normalizeListQuery(filters)] as const,
    dashboard: (role: string, filters?: Record<string, unknown>) =>
      ['customer-requests', 'dashboard', role, normalizeListQuery(filters ?? {})] as const,
  },
  revenue: {
    all: ['revenue'] as const,
    overview: (filters: PeriodRangeQuery) => ['revenue', 'overview', normalizeListQuery(filters)] as const,
    targets: (filters: RevenueTargetsQuery) => ['revenue', 'targets', normalizeListQuery(filters)] as const,
    forecast: (filters: RevenueForecastQuery) => ['revenue', 'forecast', normalizeListQuery(filters)] as const,
    report: (filters: RevenueReportQuery) => ['revenue', 'report', normalizeListQuery(filters)] as const,
  },
  receipts: {
    all: ['receipts'] as const,
    list: (filters: ListQuery = {}) => ['receipts', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['receipts', 'detail', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (filters: ListQuery = {}) => ['projects', 'list', normalizeListQuery(filters)] as const,
    detail: (id: number | string) => ['projects', 'detail', id] as const,
    items: () => ['projects', 'items'] as const,
    raci: (id: number | string) => ['projects', 'detail', id, 'raci'] as const,
  },
  masterData: {
    products: ['master-data', 'products'] as const,
    departments: ['master-data', 'departments'] as const,
    employees: ['master-data', 'employees'] as const,
    vendors: ['master-data', 'vendors'] as const,
    customers: ['master-data', 'customers'] as const,
  },
  integrationSettings: {
    all: ['integration-settings'] as const,
    backblazeB2: () => ['integration-settings', 'backblaze-b2'] as const,
    googleDrive: () => ['integration-settings', 'google-drive'] as const,
    emailSmtp: () => ['integration-settings', 'email-smtp'] as const,
    contractExpiryAlert: () => ['integration-settings', 'contract-expiry-alert'] as const,
    contractPaymentAlert: () => ['integration-settings', 'contract-payment-alert'] as const,
  },
  supportConfig: {
    all: ['support-config'] as const,
    serviceGroups: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'service-groups', normalizeListQuery(filters)] as const,
    contactPositions: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'contact-positions', normalizeListQuery(filters)] as const,
    requestStatuses: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'request-statuses', normalizeListQuery(filters)] as const,
    projectTypes: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'project-types', normalizeListQuery(filters)] as const,
    worklogActivityTypes: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'worklog-activity-types', normalizeListQuery(filters)] as const,
    slaConfigs: (filters: SupportConfigQuery = {}) =>
      ['support-config', 'sla-configs', normalizeListQuery(filters)] as const,
  },
} as const;
