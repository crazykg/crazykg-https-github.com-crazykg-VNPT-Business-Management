import type { SupportRequestPriority, SupportRequestTask } from './support';

export interface CustomerRequestAvailableAction {
  id?: string | number;
  from_status_catalog_id?: string | number | null;
  from_status_name?: string | null;
  to_status_catalog_id?: string | number | null;
  to_status_name?: string | null;
  action_code: string;
  action_name: string;
  required_role?: string | null;
  condition_json?: Record<string, unknown> | null;
  notify_targets_json?: string[] | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface CustomerRequestViewerRoleContext {
  primary_role?: 'ADMIN' | 'PM' | 'EXECUTOR' | 'CREATOR' | 'OTHER' | null;
  roles?: string[];
  can_view?: boolean;
  is_admin?: boolean;
  is_creator?: boolean;
  is_pm?: boolean;
  is_executor?: boolean;
}

export interface CustomerRequest {
  id: string | number;
  uuid?: string | null;
  request_code: string;
  status_catalog_id?: string | number | null;
  summary: string;
  project_item_id?: string | number | null;
  customer_id?: string | number | null;
  project_id?: string | number | null;
  product_id?: string | number | null;
  customer_name?: string | null;
  requester_name?: string | null;
  reporter_contact_id?: string | number | null;
  reporter_contact_name?: string | null;
  reporter_contact_phone?: string | null;
  reporter_contact_email?: string | null;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  service_group_workflow_status_catalog_id?: string | number | null;
  service_group_workflow_status_code?: string | null;
  service_group_workflow_status_name?: string | null;
  service_group_workflow_form_key?: string | null;
  receiver_user_id?: string | number | null;
  receiver_name?: string | null;
  assignee_id?: string | number | null;
  assignee_name?: string | null;
  viewer_execution_role?: 'WORKER' | 'ASSIGNER' | 'INITIAL_RECEIVER' | 'OTHER' | null;
  viewer_is_assignee?: boolean;
  viewer_is_receiver?: boolean;
  viewer_is_assigner?: boolean;
  viewer_is_initial_receiver_stage?: boolean;
  viewer_can_view?: boolean;
  viewer_role_context?: CustomerRequestViewerRoleContext | null;
  has_configured_transitions?: boolean;
  available_actions?: CustomerRequestAvailableAction[];
  reference_ticket_code?: string | null;
  reference_request_id?: string | number | null;
  status: string;
  sub_status?: string | null;
  status_name?: string | null;
  priority: SupportRequestPriority | string;
  requested_date?: string | null;
  assigned_date?: string | null;
  latest_transition_id?: string | number | null;
  hours_estimated?: number | string | null;
  notes?: string | null;
  attachments?: Attachment[];
  transition_metadata?: Record<string, unknown> | null;
  tasks?: SupportRequestTask[];
  flow_step?: string | null;
  form_key?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface CustomerRequestImportRowResult {
  index: number;
  success: boolean;
  action?: 'created' | 'updated';
  message?: string;
  data?: CustomerRequest;
}

export interface CustomerRequestChangeLogEntry {
  source_type: 'TRANSITION' | 'WORKLOG' | 'REF_TASK' | string;
  request_id: string | number;
  request_code?: string | null;
  request_summary?: string | null;
  task_code?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  sub_status?: string | null;
  note?: string | null;
  transition_metadata?: Record<string, unknown> | null;
  hours_estimated?: number | string | null;
  pause_reason?: string | null;
  upcode_status?: string | null;
  progress?: number | string | null;
  actor_name?: string | null;
  occurred_at?: string | null;
}

export interface CustomerRequestDashboardDatasetRow {
  workflow_action_code: string;
  action_name?: string | null;
  service_group_id?: string | number | null;
  service_group_name?: string | null;
  to_status_catalog_id?: string | number | null;
  to_status_name?: string | null;
  transition_count: number;
  sla_tracked_count: number;
  sla_breached_count: number;
  sla_on_time_count: number;
  notification_total: number;
  notification_resolved: number;
  notification_skipped: number;
}

export interface CustomerRequestDashboardSummaryFilters {
  q?: string;
  status?: string | null;
  sub_status?: string | null;
  service_group_id?: string | number | null;
  workflow_action_code?: string | null;
  to_status_catalog_id?: string | number | null;
  date_from?: string | null;
  date_to?: string | null;
}

export interface CustomerRequestDashboardMetricTotals {
  transition_count: number;
  sla_tracked_count: number;
  sla_breached_count: number;
  sla_on_time_count: number;
  notification_total: number;
  notification_resolved: number;
  notification_skipped: number;
}

export interface CustomerRequestDashboardSummaryPayload {
  generated_at?: string | null;
  filters?: CustomerRequestDashboardSummaryFilters;
  summary: {
    totals: CustomerRequestDashboardMetricTotals;
    by_action: Array<CustomerRequestDashboardMetricTotals & {
      workflow_action_code: string;
      action_name?: string | null;
    }>;
    by_service_group: Array<CustomerRequestDashboardMetricTotals & {
      service_group_id?: string | number | null;
      service_group_name?: string | null;
    }>;
    by_target_status: Array<CustomerRequestDashboardMetricTotals & {
      to_status_catalog_id?: string | number | null;
      to_status_name?: string | null;
    }>;
    notifications: {
      total_logs: number;
      resolved_count: number;
      skipped_count: number;
    };
    sla: {
      tracked_count: number;
      breached_count: number;
      on_time_count: number;
    };
  };
  dataset: CustomerRequestDashboardDatasetRow[];
}

export interface CustomerRequestReferenceSearchItem {
  id: string | number;
  task_code?: string | null;
  request_code?: string | null;
  ticket_code?: string | null;
  summary?: string | null;
  status?: string | null;
  requested_date?: string | null;
}

export interface YeuCauProcessField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'datetime'
    | 'boolean_nullable'
    | 'enum'
    | 'priority'
    | 'customer_select'
    | 'customer_personnel_select'
    | 'support_group_select'
    | 'project_item_select'
    | 'user_select'
    | 'hidden'
    | 'json_textarea';
  required?: boolean;
  options?: string[];
}

export interface YeuCauProcessListColumn {
  key: string;
  label: string;
}

export interface YeuCauProcessMeta {
  process_code: string;
  status_code?: string | null;
  process_label: string;
  group_code: string;
  group_label: string;
  table_name: string;
  default_status: string;
  read_roles: string[];
  write_roles: string[];
  allowed_next_processes: string[];
  allowed_previous_processes?: string[];
  form_fields: YeuCauProcessField[];
  list_columns: YeuCauProcessListColumn[];
  active_count?: number;
  decision_context_code?: string | null;
  decision_outcome_code?: string | null;
  decision_source_status_code?: string | null;
}

export interface YeuCauProcessGroup {
  group_code: string;
  group_label: string;
  processes: YeuCauProcessMeta[];
}

export interface YeuCauProcessCatalog {
  master_fields: YeuCauProcessField[];
  groups: YeuCauProcessGroup[];
}

export interface YeuCau {
  id: string | number;
  don_vi_id?: string | number | null;
  ma_yc: string;
  request_code?: string;
  nguoi_tao_id?: string | number | null;
  nguoi_tao_name?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  khach_hang_id?: string | number | null;
  khach_hang_name?: string | null;
  customer_id?: string | number | null;
  customer_name?: string | null;
  project_id?: string | number | null;
  project_item_id?: string | number | null;
  product_id?: string | number | null;
  customer_personnel_id?: string | number | null;
  requester_name?: string | null;
  support_service_group_id?: string | number | null;
  support_service_group_name?: string | null;
  received_by_user_id?: string | number | null;
  received_by_name?: string | null;
  dispatcher_user_id?: string | number | null;
  dispatcher_name?: string | null;
  performer_user_id?: string | number | null;
  performer_name?: string | null;
  received_at?: string | null;
  summary?: string | null;
  tieu_de: string;
  mo_ta?: string | null;
  do_uu_tien: number;
  loai_yc?: string | null;
  kenh_tiep_nhan?: string | null;
  kenh_khac?: string | null;
  source_channel?: string | null;
  pm_id?: string | number | null;
  pm_name?: string | null;
  ba_id?: string | number | null;
  ba_name?: string | null;
  r_id?: string | number | null;
  r_name?: string | null;
  dev_id?: string | number | null;
  dev_name?: string | null;
  nguoi_trao_doi_id?: string | number | null;
  nguoi_trao_doi_name?: string | null;
  trang_thai: string;
  tien_trinh_hien_tai?: string | null;
  tt_id_hien_tai?: string | number | null;
  ket_qua: 'dang_xu_ly' | 'hoan_thanh' | 'khong_tiep_nhan' | 'ket_thuc' | string;
  hoan_thanh_luc?: string | null;
  tong_gio_xu_ly?: number | null;
  estimated_hours?: number | null;
  estimated_by_user_id?: string | number | null;
  estimated_at?: string | null;
  total_hours_spent?: number | null;
  hours_usage_pct?: number | null;
  warning_level?: string | null;
  over_estimate?: boolean;
  missing_estimate?: boolean;
  project_name?: string | null;
  product_name?: string | null;
  customer_personnel_name?: string | null;
  sla_due_at?: string | null;
  sla_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  current_process_label?: string | null;
  current_process_group_label?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  current_status_instance_id?: string | number | null;
  current_entered_at?: string | null;
  nguoi_xu_ly_id?: string | number | null;
  nguoi_xu_ly_name?: string | null;
  current_owner_user_id?: string | number | null;
  current_owner_name?: string | null;
  current_owner_field?: string | null;
  dispatch_route?: string | null;
  dispatched_at?: string | null;
  performer_accepted_at?: string | null;
  receiver_user_id?: string | number | null;
  receiver_name?: string | null;
  receiver_username?: string | null;
  receiver_code?: string | null;
  performer_id?: string | number | null;
  completed_at?: string | null;
  process_row?: YeuCauProcessRow | null;
  status_row?: YeuCauProcessRow | null;
}

export type CRCStatusCode =
  | 'new_intake'
  | 'assigned_to_dispatcher'
  | 'dispatched'
  | 'assigned_to_performer'
  | 'assigned_to_receiver'
  | 'in_progress'
  | 'completed'
  | 'customer_notified'
  | 'not_executed'
  | 'waiting_customer_feedback'
  | 'analysis'
  | 'analysis_completed'
  | 'analysis_suspended'
  | 'returned_to_dispatcher'
  | 'returned_to_manager'
  | 'pending_dispatch'
  | 'coding'
  | 'coding_in_progress'
  | 'coding_suspended'
  | 'dms_transfer'
  | 'dms_task_created'
  | 'dms_in_progress'
  | 'dms_suspended';

export type CodingPhase = 'coding' | 'coding_done' | 'upcode_pending' | 'upcode_deployed' | 'suspended';
export type DmsPhase = 'exchange' | 'task_created' | 'in_progress' | 'completed' | 'suspended';
export type DispatchRoute = 'self_handle' | 'assign_pm' | 'assign_direct';

export interface YeuCauRelatedUser {
  id: string | number;
  yeu_cau_id: string | number;
  user_id: string | number;
  user_name?: string | null;
  user_code?: string | null;
  vai_tro: string;
  trang_thai_bat_dau?: string | null;
  cap_quyen_luc?: string | null;
  thu_hoi_luc?: string | null;
  cap_boi_id?: string | number | null;
  cap_boi_name?: string | null;
  is_active?: boolean;
}

export interface YeuCauTimelineEntry {
  id: string | number;
  yeu_cau_id: string | number;
  tien_trinh: string;
  status_code?: string | null;
  tien_trinh_id?: string | number | null;
  trang_thai_cu?: string | null;
  trang_thai_moi?: string | null;
  nguoi_thay_doi_id?: string | number | null;
  nguoi_thay_doi_name?: string | null;
  nguoi_thay_doi_code?: string | null;
  nguoi_chuyen_id?: string | number | null;
  nguoi_chuyen_name?: string | null;
  nguoi_xu_ly_id?: string | number | null;
  nguoi_xu_ly_name?: string | null;
  ly_do?: string | null;
  decision_context_code?: string | null;
  decision_outcome_code?: string | null;
  decision_source_status_code?: string | null;
  decision_reason_label?: string | null;
  thoi_gian_o_trang_thai_cu_gio?: number | null;
  thay_doi_luc?: string | null;
  entered_at?: string | null;
  exited_at?: string | null;
  created_at?: string | null;
}

export interface YeuCauProcessRow {
  process_code: string;
  process_label: string;
  table_name: string;
  data: Record<string, unknown>;
}

export interface YeuCauRefTaskRow {
  id?: string | number | null;
  ref_task_id?: string | number | null;
  request_code?: string | null;
  task_code?: string | null;
  task_link?: string | null;
  task_source?: string | null;
  task_status?: string | null;
  task_note?: string | null;
  sort_order?: number | null;
}

export interface YeuCauTag {
  id: number;
  name: string;
  color: string;
  usage_count?: number;
}

export interface YeuCauEstimate {
  id: string | number;
  request_case_id?: string | number | null;
  status_instance_id?: string | number | null;
  status_code?: string | null;
  estimated_hours?: number | null;
  estimate_type?: string | null;
  estimate_scope?: string | null;
  phase_label?: string | null;
  note?: string | null;
  estimated_by_user_id?: string | number | null;
  estimated_by_name?: string | null;
  estimated_by_code?: string | null;
  estimated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface YeuCauHoursByPerformer {
  performed_by_user_id?: string | number | null;
  performed_by_name?: string | null;
  hours_spent?: number | null;
  worklog_count?: number;
}

export interface YeuCauHoursByActivity {
  activity_type_code: string;
  hours_spent?: number | null;
  worklog_count?: number;
}

export interface YeuCauHoursReport {
  request_case_id: string | number;
  estimated_hours?: number | null;
  total_hours_spent?: number | null;
  remaining_hours?: number | null;
  hours_usage_pct?: number | null;
  warning_level?: string | null;
  over_estimate?: boolean;
  missing_estimate?: boolean;
  latest_estimate?: YeuCauEstimate | null;
  worklog_count?: number;
  billable_hours?: number | null;
  non_billable_hours?: number | null;
  by_performer?: YeuCauHoursByPerformer[];
  by_activity?: YeuCauHoursByActivity[];
}

export interface YeuCauSearchItem {
  id: number;
  request_case_id?: number;
  request_code?: string | null;
  label?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  dispatcher_name?: string | null;
  performer_name?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  updated_at?: string | null;
}

export interface YeuCauWorklog {
  id: number;
  request_case_id?: number | null;
  status_instance_id?: number | null;
  status_code?: string | null;
  status_name_vi?: string | null;
  performed_by_user_id?: number | null;
  performed_by_name?: string | null;
  performed_by_code?: string | null;
  work_content?: string | null;
  work_date?: string | null;
  activity_type_code?: string | null;
  is_billable?: boolean | null;
  is_auto_transition?: boolean | null;
  transition_id?: number | null;
  work_started_at?: string | null;
  work_ended_at?: string | null;
  difficulty_note?: string | null;
  proposal_note?: string | null;
  difficulty_status?: 'none' | 'has_issue' | 'resolved' | string | null;
  detail_status_action?: 'in_progress' | 'paused' | string | null;
  hours_spent?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface YeuCauAvailableActions {
  can_write?: boolean;
  can_transition?: boolean;
  can_transition_backward?: boolean;
  can_transition_forward?: boolean;
  can_add_worklog?: boolean;
  can_add_estimate?: boolean;
  can_delete?: boolean;
  pm_missing_customer_info_decision?: {
    enabled?: boolean;
    context_code: string;
    source_status_code?: string | null;
    target_status_codes: string[];
  } | null;
}

export interface YeuCauDashboardStatusCount {
  status_code: string;
  count: number;
}

export interface YeuCauDashboardAlertCounts {
  over_estimate: number;
  missing_estimate: number;
  sla_risk: number;
}

export interface YeuCauDashboardOperationalCounts {
  total_cases: number;
  active_cases: number;
  completed_cases: number;
  waiting_customer_feedback_cases: number;
  completion_rate: number;
}

export interface YeuCauDashboardOperationalSummary extends YeuCauDashboardOperationalCounts {
  by_type: {
    support: YeuCauDashboardOperationalCounts;
    programming: YeuCauDashboardOperationalCounts;
  };
}

export interface YeuCauDashboardSummary {
  total_cases: number;
  status_counts: YeuCauDashboardStatusCount[];
  alert_counts: YeuCauDashboardAlertCounts;
  operational?: YeuCauDashboardOperationalSummary;
}

export interface YeuCauDashboardTopCustomer {
  customer_id: string | number;
  customer_name?: string | null;
  count: number;
}

export interface YeuCauDashboardTopProject {
  project_id: string | number;
  project_name?: string | null;
  count: number;
}

export interface YeuCauDashboardTopPerformer {
  performer_user_id: string | number;
  performer_name?: string | null;
  count: number;
  department_id?: string | number | null;
  department_name?: string | null;
  total_cases?: number;
  active_cases?: number;
  completed_cases?: number;
  waiting_customer_feedback_cases?: number;
  completion_rate?: number;
  support_cases?: number;
  programming_cases?: number;
}

export interface YeuCauDashboardAttentionCase {
  request_case: YeuCau;
  reasons: string[];
}

export interface YeuCauDashboardUnitMetric {
  unit_key: string;
  customer_id?: string | number | null;
  customer_code?: string | null;
  customer_name: string;
  total_cases: number;
  active_cases: number;
  completed_cases: number;
  waiting_customer_feedback_cases: number;
  completion_rate: number;
  backlog_cases?: number;
  support_cases: number;
  programming_cases: number;
}

export interface YeuCauDashboardPayload {
  role: string;
  summary: YeuCauDashboardSummary;
  top_customers: YeuCauDashboardTopCustomer[];
  top_projects?: YeuCauDashboardTopProject[];
  top_performers: YeuCauDashboardTopPerformer[];
  unit_chart?: YeuCauDashboardUnitMetric[];
  top_backlog_units?: YeuCauDashboardUnitMetric[];
  attention_cases: YeuCauDashboardAttentionCase[];
}

export interface YeuCauPerformerTimesheetDay {
  date: string;
  hours_spent: number;
  billable_hours: number;
  non_billable_hours: number;
  entry_count: number;
}

export interface YeuCauPerformerTimesheetCase {
  request_case_id: string | number;
  request_code?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  status_code?: string | null;
  status_name_vi?: string | null;
  hours_spent: number;
  entry_count: number;
  last_worked_at?: string | null;
}

export interface YeuCauPerformerTimesheetEntry extends YeuCauWorklog {
  request_code?: string | null;
  summary?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  current_status_code?: string | null;
  current_status_name_vi?: string | null;
  worked_on?: string | null;
}

export interface YeuCauPerformerWeeklyTimesheet {
  start_date: string;
  end_date: string;
  performer_user_id?: string | number | null;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  worklog_count: number;
  days: YeuCauPerformerTimesheetDay[];
  top_cases: YeuCauPerformerTimesheetCase[];
  recent_entries: YeuCauPerformerTimesheetEntry[];
}

export interface YeuCauProcessDetail {
  yeu_cau: YeuCau;
  current_status?: YeuCauProcessMeta | null;
  current_process?: YeuCauProcessMeta | null;
  process: YeuCauProcessMeta;
  process_row?: YeuCauProcessRow | null;
  status_row?: YeuCauProcessRow | null;
  current_detail_status?: 'open' | 'in_progress' | 'paused' | 'completed' | string | null;
  can_transition_main_status?: boolean;
  can_transition_from_detail_status?: boolean;
  allowed_next_processes: YeuCauProcessMeta[];
  allowed_previous_processes?: YeuCauProcessMeta[];
  transition_allowed: boolean;
  can_write: boolean;
  available_actions?: YeuCauAvailableActions;
  people?: YeuCauRelatedUser[];
  estimates?: YeuCauEstimate[];
  hours_report?: YeuCauHoursReport | null;
  attachments?: Attachment[];
  ref_tasks?: YeuCauRefTaskRow[];
  tags?: YeuCauTag[];
  worklogs?: YeuCauWorklog[];
}

export interface CustomerHealthcareBreakdownKpis {
  publicHospital: number;
  privateHospital: number;
  medicalCenter: number;
  privateClinic: number;
  tytPkdk: number;
  other: number;
}

export interface CustomerAggregateKpis {
  totalCustomers: number;
  healthcareCustomers: number;
  governmentCustomers: number;
  individualCustomers: number;
  healthcareBreakdown: CustomerHealthcareBreakdownKpis;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  driveFileId: string;
  createdAt: string;
  storageProvider?: 'LOCAL' | 'GOOGLE_DRIVE' | 'BACKBLAZE_B2';
  storagePath?: string | null;
  storageDisk?: string | null;
  storageVisibility?: string | null;
  warningMessage?: string | null;
}

export interface CustomerRequestPlan {
  id: number;
  plan_code: string;
  plan_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  dispatcher_user_id: number | null;
  dispatcher_name: string | null;
  dispatcher_code?: string | null;
  status: 'draft' | 'submitted' | 'approved';
  note: string | null;
  total_planned_hours: number;
  item_count?: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerRequestPlanItem {
  id: number;
  plan_id: number;
  request_case_id: number;
  request_code?: string | null;
  summary?: string | null;
  current_status_code?: string | null;
  performer_user_id: number | null;
  performer_name?: string | null;
  performer_code?: string | null;
  planned_hours: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  priority_order: number;
  note: string | null;
  actual_hours: number;
  actual_status: 'pending' | 'in_progress' | 'completed' | 'carried_over' | 'cancelled';
  carried_to_plan_id: number | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CRCFullDetail {
  request_case: Record<string, unknown>;
  people: unknown[];
  timeline: unknown[];
  worklog_summary: unknown[];
  estimates: unknown[];
  ref_tasks: unknown[];
  attachments: unknown[];
  hours: Record<string, unknown>;
}

export interface MonthlyHoursRow {
  user_id?: number | null;
  user_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  activity_type_code?: string | null;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  estimated_hours: number;
  request_count: number;
  completed_count: number;
  billable_percent?: number;
  hours_by_activity?: Record<string, number> | null;
}

export interface PainPointsData {
  overloaded_users: unknown[];
  low_billable_users: unknown[];
  estimate_variance: unknown[];
  long_running_cases: unknown[];
  status_stuck: unknown[];
  meeting_heavy: unknown[];
  top_customer_load: unknown[];
}

export interface CustomerRequestEscalation {
  id: number;
  escalation_code: string;
  request_case_id: number;
  request_code?: string | null;
  summary?: string | null;
  raised_by_user_id: number;
  raiser_name?: string | null;
  raiser_code?: string | null;
  raised_at: string;
  difficulty_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact_description: string | null;
  blocked_since: string | null;
  proposed_action: string | null;
  proposed_handler_user_id: number | null;
  proposed_additional_hours: number | null;
  proposed_deadline_extension: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'closed';
  reviewed_by_user_id: number | null;
  reviewer_name?: string | null;
  reviewed_at: string | null;
  resolution_decision: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadershipDirective {
  id: number;
  directive_code: string;
  issued_by_user_id: number;
  issuer_name?: string | null;
  assigned_to_user_id: number;
  assignee_name?: string | null;
  cc_user_ids: number[] | null;
  directive_type: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  source_type: string | null;
  source_escalation_id: number | null;
  linked_case_ids: number[] | null;
  deadline: string | null;
  status: 'pending' | 'acknowledged' | 'completed';
  acknowledged_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string | null;
  updated_at?: string | null;
}
