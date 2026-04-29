export type WorkloadSource = 'all' | 'crc' | 'project';

export interface WorkloadQueryParams {
  from?: string;
  to?: string;
  source?: WorkloadSource;
  user_id?: string | number;
  user_ids?: string;
  department_id?: string | number;
  project_id?: string | number;
  page?: number;
  per_page?: number;
}

export interface WorkloadMeta {
  from: string;
  to: string;
  source: WorkloadSource | string;
  generated_at?: string;
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
}

export interface WorkloadKpis {
  total_hours: number;
  capacity_hours: number;
  utilization_percent: number;
  planned_hours: number;
  actual_hours: number;
  variance_hours: number;
  entry_count: number;
  user_count: number;
  project_count: number;
  alert_count: number;
}

export interface WorkloadGroupRow {
  source?: string;
  source_label?: string;
  work_date?: string;
  user_id?: number | null;
  user_name?: string | null;
  department_name?: string | null;
  total_hours: number;
  entry_count: number;
}

export interface WorkloadSummaryPayload {
  kpis: WorkloadKpis;
  by_source: WorkloadGroupRow[];
  by_day: WorkloadGroupRow[];
  by_user: WorkloadGroupRow[];
  alerts_preview: WorkloadWeeklyAlert[];
}

export interface WorkloadDailySeriesRow {
  date: string;
  hours: number;
}

export interface WorkloadComparisonUser {
  user_id: number;
  user_name: string | null;
  department_name: string | null;
}

export interface WorkloadDailyComparisonPayload {
  users: WorkloadComparisonUser[];
  series: Array<Record<string, string | number>>;
}

export interface WorkloadProjectSummaryRow {
  project_id: number | null;
  project_name: string | null;
  total_hours: number;
  crc_hours: number;
  project_hours: number;
  entry_count: number;
  user_count: number;
}

export interface WorkloadCapacityRow {
  date: string;
  user_id: number;
  user_name: string | null;
  department_id: number | null;
  department_name: string | null;
  capacity_hours: number;
  actual_hours: number;
  utilization_percent: number;
  status: string;
  status_label: string;
}

export interface WorkloadWeeklyAlert {
  week_start: string;
  user_id: number;
  user_name: string | null;
  department_name: string | null;
  actual_hours: number;
  capacity_hours: number;
  utilization_percent: number;
  missing_day_count: number;
  overload_day_count: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | string;
  label: string;
}

export interface WorkloadPlannedActualRow {
  user_id?: number;
  user_name?: string | null;
  project_id?: number;
  project_name?: string | null;
  planned_hours: number;
  actual_hours: number;
  variance_hours: number;
  status: string;
}

export interface WorkloadPlannedActualPayload {
  totals: {
    planned_hours: number;
    actual_hours: number;
    variance_hours: number;
  };
  by_user: WorkloadPlannedActualRow[];
  by_project: WorkloadPlannedActualRow[];
  notes?: Record<string, string>;
}

export interface WorkloadEntry {
  source: 'crc' | 'project' | string;
  source_label: string;
  worklog_id: number;
  work_date: string;
  user_id: number | null;
  user_name: string | null;
  user_code: string | null;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  project_id: number | null;
  project_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  reference_id: number | null;
  reference_code: string | null;
  activity_type_code: string | null;
  description: string | null;
  hours_spent: number;
  is_billable: boolean | null;
}

export interface WorkloadApiResponse<T> {
  data: T;
  meta: WorkloadMeta;
}
