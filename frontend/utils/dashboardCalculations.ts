import type {
  DashboardStats,
  ContractAggregateKpis,
  CustomerAggregateKpis,
  Project,
  Contract,
  PaymentSchedule,
  Customer,
  ContractStatus,
  ContractStatusBreakdown,
  ExpiringContractSummary,
  ProjectStatus,
} from '../types';

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'CHUAN_BI',
  'CHUAN_BI_DAU_TU',
  'THUC_HIEN_DAU_TU',
  'KET_THUC_DAU_TU',
  'CHUAN_BI_KH_THUE',
  'TAM_NGUNG',
  'HUY',
];

const CONTRACT_STATUS_ORDER: ContractStatus[] = ['DRAFT', 'SIGNED', 'RENEWED'];

export const EMPTY_CONTRACT_AGGREGATE_KPIS: ContractAggregateKpis = {
  draftCount: 0,
  renewedCount: 0,
  signedTotalValue: 0,
  collectionRate: 0,
  newSignedCount: 0,
  newSignedValue: 0,
  totalPipelineValue: 0,
  overduePaymentAmount: 0,
  actualCollectedValue: 0,
};

export const EMPTY_CUSTOMER_AGGREGATE_KPIS: CustomerAggregateKpis = {
  totalCustomers: 0,
  healthcareCustomers: 0,
  governmentCustomers: 0,
  individualCustomers: 0,
  healthcareBreakdown: {
    publicHospital: 0,
    privateHospital: 0,
    medicalCenter: 0,
    privateClinic: 0,
    tytPkdk: 0,
    other: 0,
  },
};

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalRevenue: 0,
  actualRevenue: 0,
  forecastRevenueMonth: 0,
  forecastRevenueQuarter: 0,
  monthlyRevenueComparison: [],
  projectStatusCounts: [],
  contractStatusCounts: [],
  collectionRate: 0,
  overduePaymentCount: 0,
  overduePaymentAmount: 0,
  expiringContracts: [],
};

/**
 * Calculates contract KPIs from contracts and payment schedules.
 */
export function calculateContractKpis(
  contracts: Contract[],
  contractsPageMeta?: { kpis?: Record<string, unknown> },
  paymentSchedules?: PaymentSchedule[]
): ContractAggregateKpis {
  const kpis = contractsPageMeta?.kpis ?? {};
  const schedules = Array.isArray(paymentSchedules) ? paymentSchedules : [];

  // Frontend fallback for collection rate - include PAID and PARTIAL statuses
  const totalExpectedRevenue = schedules
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);
  const actualRevenue = schedules
    .filter((schedule) => schedule.status === 'PAID' || schedule.status === 'PARTIAL')
    .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);
  const frontendCollectionRate = totalExpectedRevenue > 0
    ? Math.max(0, Math.min(100, Math.round((actualRevenue / totalExpectedRevenue) * 100)))
    : 0;

  const frontendSignedTotalValue = (contracts || [])
    .filter((contract) => contract.status === 'SIGNED')
    .reduce((sum, contract) => sum + Number(contract.value ?? contract.total_value ?? 0), 0);

  return {
    draftCount: typeof kpis.draft === 'number' ? kpis.draft
      : (contracts || []).filter((contract) => contract.status === 'DRAFT').length,
    renewedCount: typeof kpis.renewed === 'number' ? kpis.renewed
      : (contracts || []).filter((contract) => contract.status === 'RENEWED').length,
    signedTotalValue: typeof kpis.new_signed_value === 'number' ? kpis.new_signed_value
      : frontendSignedTotalValue,
    collectionRate: typeof kpis.collection_rate === 'number' ? kpis.collection_rate
      : frontendCollectionRate,
    newSignedCount: typeof kpis.new_signed_count === 'number' ? kpis.new_signed_count : 0,
    newSignedValue: typeof kpis.new_signed_value === 'number' ? kpis.new_signed_value : 0,
    totalPipelineValue: typeof kpis.total_pipeline_value === 'number' ? kpis.total_pipeline_value : 0,
    overduePaymentAmount: typeof kpis.overdue_payment_amount === 'number' ? kpis.overdue_payment_amount : 0,
    actualCollectedValue: typeof kpis.actual_collected_value === 'number' ? kpis.actual_collected_value : 0,
  };
}

/**
 * Calculates customer KPIs from page meta.
 */
export function calculateCustomerKpis(
  customersPageMeta?: { total?: number; kpis?: Record<string, unknown> }
): CustomerAggregateKpis {
  const kpis = customersPageMeta?.kpis ?? {};
  const rawHealthcareBreakdown = (
    typeof kpis.healthcare_breakdown === 'object'
    && kpis.healthcare_breakdown !== null
  )
    ? kpis.healthcare_breakdown as Record<string, unknown>
    : {};

  const healthcareCustomers = typeof kpis.healthcare_customers === 'number' ? kpis.healthcare_customers : 0;
  const governmentCustomers = typeof kpis.government_customers === 'number' ? kpis.government_customers : 0;
  const individualCustomers = typeof kpis.individual_customers === 'number' ? kpis.individual_customers : 0;
  const derivedTotalCustomers = healthcareCustomers + governmentCustomers + individualCustomers;

  return {
    totalCustomers: derivedTotalCustomers > 0
      ? derivedTotalCustomers
      : (typeof kpis.total_customers === 'number' ? kpis.total_customers : Number(customersPageMeta?.total || 0)),
    healthcareCustomers,
    governmentCustomers,
    individualCustomers,
    healthcareBreakdown: {
      publicHospital: typeof rawHealthcareBreakdown.public_hospital === 'number' ? rawHealthcareBreakdown.public_hospital : 0,
      privateHospital: typeof rawHealthcareBreakdown.private_hospital === 'number' ? rawHealthcareBreakdown.private_hospital : 0,
      medicalCenter: typeof rawHealthcareBreakdown.medical_center === 'number' ? rawHealthcareBreakdown.medical_center : 0,
      privateClinic: typeof rawHealthcareBreakdown.private_clinic === 'number' ? rawHealthcareBreakdown.private_clinic : 0,
      tytPkdk: typeof rawHealthcareBreakdown.tyt_pkdk === 'number' ? rawHealthcareBreakdown.tyt_pkdk : 0,
      other: typeof rawHealthcareBreakdown.other === 'number' ? rawHealthcareBreakdown.other : 0,
    },
  };
}

/**
 * Calculates dashboard statistics from contracts, payment schedules, projects, and customers.
 */
export function calculateDashboardStats(
  contracts: Contract[],
  paymentSchedules: PaymentSchedule[],
  projects: Project[],
  customers: Customer[]
): DashboardStats {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
  const quarterEndMonth = quarterStartMonth + 2;

  const totalRevenue = (contracts || [])
    .filter((contract) => contract.status === 'SIGNED')
    .reduce((sum, contract) => sum + (contract.value || 0), 0);

  // Include PAID and PARTIAL statuses for actual revenue
  const actualRevenue = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PAID' || schedule.status === 'PARTIAL')
    .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

  // Forecast: include PENDING and INVOICED statuses (not yet paid)
  const forecastRevenueMonth = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING' || schedule.status === 'INVOICED' || schedule.status === 'OVERDUE')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return expected.getFullYear() === currentYear && expected.getMonth() === currentMonth;
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  // Forecast: include PENDING and INVOICED statuses (not yet paid)
  const forecastRevenueQuarter = (paymentSchedules || [])
    .filter((schedule) => schedule.status === 'PENDING' || schedule.status === 'INVOICED' || schedule.status === 'OVERDUE')
    .filter((schedule) => {
      const expected = new Date(schedule.expected_date);
      return (
        expected.getFullYear() === currentYear &&
        expected.getMonth() >= quarterStartMonth &&
        expected.getMonth() <= quarterEndMonth
      );
    })
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  const monthlyRevenueComparison = calculateMonthlyRevenueComparison(paymentSchedules, currentYear, currentMonth);

  const projectStatusCounts = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    count: (projects || []).filter((project) => project.status === status).length,
  }));

  const totalExpectedRevenue = (paymentSchedules || [])
    .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);
  const collectionRate = totalExpectedRevenue > 0
    ? Math.max(0, Math.min(100, Math.round((actualRevenue / totalExpectedRevenue) * 100)))
    : 0;

  const contractStatusCounts: ContractStatusBreakdown[] = CONTRACT_STATUS_ORDER.map((status) => ({
    status,
    count: (contracts || []).filter((contract) => contract.status === status).length,
    totalValue: (contracts || [])
      .filter((contract) => contract.status === status)
      .reduce((sum, contract) => sum + Number(contract.value ?? contract.total_value ?? 0), 0),
  }));

  const overdueSchedules = (paymentSchedules || []).filter((schedule) => schedule.status === 'OVERDUE');
  const overduePaymentCount = overdueSchedules.length;
  const overduePaymentAmount = overdueSchedules.reduce(
    (sum, schedule) =>
      sum + Math.max(0, Number(schedule.expected_amount || 0) - Number(schedule.actual_paid_amount || 0)),
    0
  );

  const expiringContracts = calculateExpiringContracts(contracts, customers, now);

  return {
    totalRevenue,
    actualRevenue,
    forecastRevenueMonth,
    forecastRevenueQuarter,
    monthlyRevenueComparison,
    projectStatusCounts,
    contractStatusCounts,
    collectionRate,
    overduePaymentCount,
    overduePaymentAmount,
    expiringContracts,
  };
}

/**
 * Calculates monthly revenue comparison for the last 6 months.
 */
function calculateMonthlyRevenueComparison(
  paymentSchedules: PaymentSchedule[],
  currentYear: number,
  currentMonth: number
): Array<{ month: string; planned: number; actual: number }> {
  const monthLabels: Array<{ month: string; year: number; monthIndex: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const point = new Date(currentYear, currentMonth - i, 1);
    monthLabels.push({
      month: point.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }),
      year: point.getFullYear(),
      monthIndex: point.getMonth(),
    });
  }

  return monthLabels.map((point) => {
    const planned = (paymentSchedules || [])
      .filter((schedule) => {
        const expected = new Date(schedule.expected_date);
        return expected.getFullYear() === point.year && expected.getMonth() === point.monthIndex;
      })
      .reduce((sum, schedule) => sum + Number(schedule.expected_amount || 0), 0);

  // Include PAID and PARTIAL statuses for actual revenue
  const actual = (paymentSchedules || [])
      .filter((schedule) => schedule.status === 'PAID' || schedule.status === 'PARTIAL')
      .filter((schedule) => {
        const paidDate = schedule.actual_paid_date ? new Date(schedule.actual_paid_date) : null;
        return paidDate !== null && paidDate.getFullYear() === point.year && paidDate.getMonth() === point.monthIndex;
      })
      .reduce((sum, schedule) => sum + Number(schedule.actual_paid_amount || 0), 0);

    return {
      month: point.month,
      planned,
      actual,
    };
  });
}

/**
 * Calculates expiring contracts (within 30 days).
 */
function calculateExpiringContracts(
  contracts: Contract[],
  customers: Customer[],
  now: Date
): ExpiringContractSummary[] {
  const customerNameById = new Map<string, string>(
    (customers || []).map((customer) => [
      String(customer.id),
      String(customer.customer_name || customer.customer_code || '').trim(),
    ])
  );
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return (contracts || [])
    .map((contract): ExpiringContractSummary | null => {
      if (!contract.expiry_date || contract.status === 'DRAFT') {
        return null;
      }

      const expiry = new Date(contract.expiry_date);
      const expiryTs = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();
      if (!Number.isFinite(expiryTs)) {
        return null;
      }

      const daysRemaining = Math.ceil((expiryTs - todayStart) / 86_400_000);
      if (daysRemaining < 0 || daysRemaining > 30) {
        return null;
      }

      return {
        id: contract.id,
        contract_code: contract.contract_code,
        contract_name: contract.contract_name,
        customer_name: customerNameById.get(String(contract.customer_id)) || '--',
        expiry_date: contract.expiry_date,
        daysRemaining,
        value: Number(contract.value ?? contract.total_value ?? 0),
      };
    })
    .filter((contract): contract is ExpiringContractSummary => contract !== null)
    .sort((left, right) => left.daysRemaining - right.daysRemaining)
    .slice(0, 5);
}
