export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'VOID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'ONLINE' | 'OFFSET' | 'OTHER';
export type ReceiptStatus = 'CONFIRMED' | 'PENDING_CONFIRM' | 'REJECTED';

export interface InvoiceItem {
  id?: string | number;
  invoice_id?: string | number;
  product_id?: string | number | null;
  description: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  vat_rate?: number | null;
  line_total?: number;
  vat_amount?: number;
  payment_schedule_id?: string | number | null;
  sort_order?: number;
}

export interface Invoice {
  id: string | number;
  invoice_code: string;
  invoice_series?: string | null;
  contract_id: string | number;
  customer_id: string | number;
  project_id?: string | number | null;
  invoice_date: string;
  due_date: string;
  period_from?: string | null;
  period_to?: string | null;
  subtotal: number;
  vat_rate?: number | null;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  is_overdue: boolean;
  status: InvoiceStatus;
  notes?: string | null;
  items?: InvoiceItem[];
  dunning_logs?: DunningLog[];
  contract_code?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
}

export interface DunningLog {
  id: string | number;
  invoice_id: string | number;
  customer_id: string | number;
  dunning_level: number;
  sent_at: string;
  sent_via: string;
  message?: string | null;
  response_note?: string | null;
  created_by?: string | number | null;
  created_at?: string | null;
}

export interface Receipt {
  id: string | number;
  receipt_code: string;
  invoice_id?: string | number | null;
  contract_id: string | number;
  customer_id: string | number;
  receipt_date: string;
  amount: number;
  payment_method: PaymentMethod;
  bank_name?: string | null;
  bank_account?: string | null;
  transaction_ref?: string | null;
  status: ReceiptStatus;
  is_reversed?: boolean;
  is_reversal_offset?: boolean;
  original_receipt_id?: string | number | null;
  notes?: string | null;
  confirmed_by?: string | number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  invoice_code?: string | null;
  contract_code?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
}

export interface FeeCollectionKpis {
  expected_revenue: number;
  actual_collected: number;
  collection_rate: number;
  avg_days_to_collect: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
}

export interface FeeCollectionByMonth {
  month_key: string;
  month_label: string;
  invoiced: number;
  collected: number;
  outstanding_eom: number;
  cumulative_invoiced: number;
  cumulative_collected: number;
}

export interface TopDebtor {
  customer_id: number;
  customer_name: string;
  total_outstanding: number;
  overdue_amount: number;
  invoice_count: number;
  oldest_overdue_days: number;
}

export interface UrgentOverdueItem {
  invoice_id: number;
  invoice_code: string;
  customer_id: number;
  customer_name: string;
  contract_id: number;
  due_date: string;
  outstanding: number;
  days_overdue: number;
}

export interface FeeCollectionDashboard {
  kpis: FeeCollectionKpis;
  by_month: FeeCollectionByMonth[];
  top_debtors: TopDebtor[];
  urgent_overdue: UrgentOverdueItem[];
}

export interface DebtAgingRow {
  customer_id: number;
  customer_name: string;
  current_bucket: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_over_90: number;
  total_outstanding: number;
  invoices?: Invoice[];
}

export interface DebtAgingTotals {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  over_90: number;
  total: number;
}

export interface DebtAgingReport {
  rows: DebtAgingRow[];
  totals: DebtAgingTotals;
}

export interface DebtTrendPoint {
  month_key: string;
  month_label: string;
  total_outstanding: number;
  total_overdue: number;
}
