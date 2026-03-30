import type { FeeCollectionDashboard } from './feeCollection';

export type RevenuePeriodType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RevenueTargetType = 'TOTAL' | 'NEW_CONTRACT' | 'RENEWAL' | 'RECURRING';
export type RevenueComparisonMode = 'MoM' | 'QoQ' | 'YoY';
export type RevenueAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type RevenueAlertType = 'UNDER_TARGET' | 'HIGH_OVERDUE' | 'CONTRACT_EXPIRING' | 'COLLECTION_DROP';
export type RevenueSubView = 'OVERVIEW' | 'BY_CONTRACT' | 'BY_COLLECTION' | 'FORECAST' | 'REPORT';

export interface RevenueOverviewKpis {
  target_amount: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  achievement_pct: number;
  collection_rate: number;
  growth_pct: number;
  overdue_amount: number;
}

export interface RevenueOverviewPeriod {
  period_key: string;
  period_label: string;
  target: number;
  contract_expected: number;
  contract_actual: number;
  invoice_expected: number;
  invoice_actual: number;
  total_expected: number;
  total_actual: number;
  cumulative_target: number;
  cumulative_expected: number;
  cumulative_actual: number;
  achievement_pct: number;
}

export interface RevenueBySource {
  source: string;
  label: string;
  amount: number;
  pct: number;
}

export interface RevenueAlert {
  type: RevenueAlertType;
  severity: RevenueAlertSeverity;
  message: string;
  context: Record<string, unknown>;
}

export interface RevenueOverviewData {
  kpis: RevenueOverviewKpis;
  by_period: RevenueOverviewPeriod[];
  by_source: RevenueBySource[];
  alerts: RevenueAlert[];
}

export interface RevenueOverviewResponse {
  meta: {
    fee_collection_available: boolean;
    data_sources: string[];
  };
  data: RevenueOverviewData;
}

export interface RevenueTarget {
  id: number;
  period_type: RevenuePeriodType;
  period_key: string;
  period_start: string;
  period_end: string;
  dept_id: number;
  target_type: RevenueTargetType;
  target_amount: number;
  actual_amount: number;
  achievement_pct: number;
  notes: string | null;
  approved_by: number | null;
  approved_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RevenueTargetBulkInput {
  year: number;
  period_type: RevenuePeriodType;
  target_type: RevenueTargetType;
  dept_ids: number[];
  targets: Array<{ period_key: string; amount: number }>;
}

export interface RevenueSuggestion {
  period_key: string;
  contract_amount: number;
  opportunity_amount: number;
  suggested_total: number;
  contract_count: number;
  opportunity_count: number;
}

export interface RevenueSuggestionPreviewProjectPeriod {
  cycle_number: number;
  expected_date: string | null;
  expected_amount: number;
  period_key: string | null;
}

export interface RevenueSuggestionPreviewProjectSource {
  project_id: number;
  project_code: string;
  project_name: string;
  investment_mode: string;
  project_status: string;
  accountable_user_id: number | null;
  accountable_user_code: string | null;
  accountable_full_name: string | null;
  schedule_count: number;
  total_amount: number;
  periods: RevenueSuggestionPreviewProjectPeriod[];
}

export interface RevenueSuggestionPreviewContractSource {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  project_id: number | null;
  project_code: string;
  project_name: string;
  expected_date: string | null;
  period_key: string | null;
  expected_amount: number;
  actual_paid_amount: number;
  outstanding_amount: number;
  schedule_status: string;
}

export interface RevenueSuggestionPreview {
  project_total: number;
  contract_total: number;
  project_sources: RevenueSuggestionPreviewProjectSource[];
  contract_sources: RevenueSuggestionPreviewContractSource[];
}

export interface RevenueSuggestionResponse {
  data: RevenueSuggestion[];
  meta: {
    year: number;
    period_type: string;
    total_suggested: number;
  };
  preview?: RevenueSuggestionPreview;
}

export interface ProjectRevenueSchedule {
  id: number;
  project_id: number;
  cycle_number: number;
  expected_date: string | null;
  expected_amount: number;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RevenueByContractRow {
  contract_id: number;
  contract_code: string;
  contract_name: string;
  contract_status: string;
  customer_id: number;
  customer_name: string;
  schedule_count: number;
  expected_revenue: number;
  actual_collected: number;
  outstanding: number;
  collection_rate: number;
}

export interface RevenueByContractKpis {
  contract_count: number;
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
}

export interface RevenueByContractResponse {
  data: RevenueByContractRow[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    kpis: RevenueByContractKpis;
  };
}

export interface RevenueContractSchedule {
  schedule_id: number;
  milestone_name: string | null;
  cycle_number: number | null;
  expected_date: string;
  expected_amount: number;
  actual_amount: number;
  actual_paid_date: string | null;
  schedule_status: string;
  invoice_id: number | null;
  invoice_code: string | null;
  invoice_status: string | null;
  invoice_total: number | null;
  invoice_paid: number | null;
}

export interface RevenueForecastKpis {
  total_expected: number;
  total_confirmed: number;
  total_pending: number;
  confirmation_rate: number;
  expiring_contracts: number;
  expiring_value: number;
  horizon_months: number;
}

export interface RevenueForecastMonth {
  month_key: string;
  month_label: string;
  expected: number;
  confirmed: number;
  pending: number;
  schedule_count: number;
  contract_count: number;
}

export interface RevenueForecastByStatus {
  contract_status: string;
  expected: number;
  contract_count: number;
  percentage: number;
}

export interface RevenueForecastData {
  kpis: RevenueForecastKpis;
  by_month: RevenueForecastMonth[];
  by_contract_status: RevenueForecastByStatus[];
}

export interface RevenueReportRow {
  department_id?: number;
  department_name?: string;
  customer_id?: number;
  customer_name?: string;
  product_id?: number;
  product_name?: string;
  contract_value?: number;
  month_key?: string;
  month_label?: string;
  cumulative_expected?: number;
  cumulative_collected?: number;
  expected?: number;
  collected?: number;
  outstanding?: number;
  collection_rate?: number;
  contract_count?: number;
  share_pct?: number;
}

export type RevenueReportDimension = 'department' | 'customer' | 'product' | 'time';

export interface RevenueReportData {
  dimension: RevenueReportDimension;
  rows: RevenueReportRow[];
  totals: Record<string, number>;
}

export type RevenueByCollectionResponse = {
  data: FeeCollectionDashboard;
};
