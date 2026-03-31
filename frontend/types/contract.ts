import type { Attachment } from './legacy';
import type { InvestmentMode, PaymentCycle } from './project';

export interface MonthlyRevenueComparison {
  month: string;
  planned: number;
  actual: number;
}

export interface ContractStatusBreakdown {
  status: ContractStatus;
  count: number;
  totalValue: number;
}

export interface ExpiringContractSummary {
  id: string | number;
  contract_code: string;
  contract_name: string;
  customer_name: string;
  expiry_date: string;
  daysRemaining: number;
  value: number;
}

export interface ContractAggregateKpis {
  draftCount: number;
  renewedCount: number;
  signedTotalValue: number;
  collectionRate: number;
  newSignedCount: number;
  newSignedValue: number;
  totalPipelineValue: number;
  overduePaymentAmount: number;
  actualCollectedValue: number;
}

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'RENEWED';
export type ContractTermUnit = 'MONTH' | 'DAY';
export type PaymentScheduleStatus = 'PENDING' | 'INVOICED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type AddendumType = 'EXTENSION' | 'AMENDMENT' | 'LIQUIDATION';
export type ContinuityStatus = 'STANDALONE' | 'EARLY' | 'CONTINUOUS' | 'GAP';

export interface ContractItem {
  id: string | number;
  contract_id: string | number;
  product_id: string | number;
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  vat_amount?: number | null;
}

export interface ContractSignerOption {
  id: string | number;
  user_code?: string | null;
  full_name?: string | null;
  department_id: string | number;
  dept_code?: string | null;
  dept_name?: string | null;
}

export interface Contract {
  id: string | number;
  contract_code: string;
  contract_number?: string;
  contract_name: string;
  customer_id: string | number | null;
  project_id: string | number | null;
  signer_user_id?: string | number | null;
  signer_user_code?: string | null;
  signer_full_name?: string | null;
  dept_id?: string | number | null;
  dept_code?: string | null;
  dept_name?: string | null;
  project_type_code?: InvestmentMode | string | null;
  value: number;
  total_value?: number;
  payment_cycle?: PaymentCycle;
  status: ContractStatus;
  sign_date?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  expiry_date_manual_override?: boolean;
  term_unit?: ContractTermUnit | null;
  term_value?: number | null;
  items?: ContractItem[];
  parent_contract_id?: string | number | null;
  addendum_type?: AddendumType | null;
  gap_days?: number | null;
  continuity_status?: ContinuityStatus | null;
  penalty_rate?: number | null;
  parent_contract?: {
    id: number;
    contract_code: string;
    contract_name: string;
    expiry_date?: string | null;
    deleted_at?: string | null;
  } | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface PaymentSchedule {
  id: string | number;
  contract_id: string | number;
  project_id?: string | number | null;
  milestone_name: string;
  cycle_number: number;
  expected_date: string;
  expected_amount: number;
  actual_paid_date?: string | null;
  actual_paid_amount: number;
  status: PaymentScheduleStatus;
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  attachments?: Attachment[];
  original_amount?: number | null;
  penalty_rate?: number | null;
  penalty_amount?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentScheduleConfirmationPayload {
  actual_paid_date?: string | null;
  actual_paid_amount?: number | null;
  status?: PaymentScheduleStatus;
  notes?: string | null;
  attachments?: Attachment[];
}

export interface RevenueAnalyticsKpis {
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  carry_over_from_previous: number;
  cumulative_collected: number;
  collection_rate: number;
  avg_days_to_collect: number;
  on_time_rate: number;
}

export interface RevenueByPeriod {
  period_key: string;
  period_label: string;
  expected: number;
  actual: number;
  overdue: number;
  cumulative_expected: number;
  cumulative_actual: number;
  carry_over: number;
  schedule_count: number;
  paid_count: number;
}

export interface RevenueByCycle {
  cycle: PaymentCycle;
  cycle_label: string;
  contract_count: number;
  expected: number;
  actual: number;
  percentage_of_total: number;
}

export interface RevenueByItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  proportion: number;
  allocated_expected: number;
  allocated_actual: number;
  allocated_outstanding: number;
}

export interface RevenueByContract {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  customer_name: string;
  payment_cycle: PaymentCycle | string;
  contract_value: number;
  expected_in_period: number;
  actual_in_period: number;
  outstanding: number;
  items: RevenueByItem[] | null;
  is_terminated?: boolean;
  penalty_amount?: number | null;
}

export interface OverdueDetail {
  schedule_id: number;
  contract_id: number;
  contract_code: string;
  customer_name: string;
  milestone_name: string;
  expected_date: string;
  expected_amount: number;
  days_overdue: number;
}

export interface ContractRevenueAnalytics {
  kpis: RevenueAnalyticsKpis;
  by_period: RevenueByPeriod[];
  by_cycle: RevenueByCycle[];
  by_contract: RevenueByContract[];
  by_item: RevenueByItem[] | null;
  overdue_details: OverdueDetail[];
}
