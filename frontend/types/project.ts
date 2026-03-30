export interface ProjectItemMaster {
  id: string | number;
  project_id: string | number;
  project_code?: string | null;
  project_name?: string | null;
  customer_id?: string | number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  product_id: string | number;
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  display_name?: string | null;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
  deleted_at?: string | null;
}

export type ProjectStatus = string;
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU_DACTHU' | 'THUE_DICH_VU_COSAN';
export type PaymentCycle = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface ProjectTypeOption {
  id: string | number | null;
  type_code: string;
  type_name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number | null;
  used_in_projects?: number;
  is_code_editable?: boolean;
  created_at?: string | null;
  created_by?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | number | null;
}

export interface ProjectItem {
  id: string;
  productId: string | number;
  quantity: number;
  unitPrice: number;
  discountPercent: number | string;
  discountAmount: number | string;
  lineTotal?: number;
  product_id?: string | number | null;
  unit_price?: number | null;
  line_total?: number | null;
  discountMode?: 'PERCENT' | 'AMOUNT';
}

export type RACIRole = 'A' | 'R' | 'C' | 'I';

export interface ProjectRACI {
  id: string;
  userId: string | number;
  roleType: RACIRole;
  assignedDate: string;
  user_id?: string | number | null;
  raci_role?: RACIRole | null;
  user_code?: string | null;
  username?: string | null;
  full_name?: string | null;
}

export interface ProjectRaciRow {
  id?: string | number | null;
  project_id: string | number;
  user_id: string | number;
  raci_role: RACIRole;
  user_code?: string | null;
  username?: string | null;
  full_name?: string | null;
  assigned_date?: string | null;
}

export interface Project {
  id: string | number;
  project_code: string;
  project_name: string;
  customer_id: string | number | null;
  opportunity_id?: string | number | null;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  status: ProjectStatus;
  status_reason?: string | null;
  investment_mode?: InvestmentMode | string | null;
  payment_cycle?: PaymentCycle | string | null;
  estimated_value?: number | null;
  data_scope?: string | null;
  items?: ProjectItem[];
  raci?: ProjectRACI[];
}

export interface ProjectStatusBreakdown {
  status: ProjectStatus;
  count: number;
}

export interface ProcedureTemplate {
  id: string | number;
  template_code: string;
  template_name: string;
  description?: string | null;
  is_active: boolean;
  phases?: string[];
}

export interface ProcedureTemplateStep {
  id: string | number;
  template_id: string | number;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  default_duration_days?: number | null;
  sort_order: number;
  children?: ProcedureTemplateStep[];
}

export type ProcedureStepStatus = 'CHUA_THUC_HIEN' | 'DANG_THUC_HIEN' | 'HOAN_THANH';

export interface ProjectProcedure {
  id: string | number;
  project_id: string | number;
  template_id: string | number;
  procedure_name: string;
  overall_progress: number;
  notes?: string | null;
  steps?: ProjectProcedureStep[];
  template?: ProcedureTemplate;
}

export interface ProjectProcedureStep {
  id: string | number;
  procedure_id: string | number;
  template_step_id?: string | number | null;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  phase_label?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  duration_days?: number | null;
  progress_status: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
  sort_order: number;
  worklogs_count?: number;
  blocking_worklogs_count?: number;
  created_by?: string | number | null;
  children?: ProjectProcedureStep[];
}

export interface ProcedureStepBatchUpdate {
  id: string | number;
  progress_status?: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
}

export type WorklogType = 'STATUS_CHANGE' | 'DOCUMENT_ADDED' | 'NOTE' | 'CUSTOM';

export type IssueStatus = 'JUST_ENCOUNTERED' | 'IN_PROGRESS' | 'RESOLVED';

export interface SharedTimesheet {
  id: string | number;
  procedure_step_worklog_id: string | number;
  hours_spent: string | number;
  work_date: string;
  activity_description?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SharedIssue {
  id: string | number;
  procedure_step_worklog_id: string | number;
  issue_content: string;
  proposal_content?: string | null;
  issue_status: IssueStatus;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AddWorklogPayload {
  content: string;
  hours_spent?: number | null;
  work_date?: string | null;
  activity_description?: string | null;
  difficulty?: string | null;
  proposal?: string | null;
  issue_status?: IssueStatus | null;
}

export interface ProcedureStepWorklog {
  id: string | number;
  step_id: string | number;
  procedure_id: string | number;
  log_type: WorklogType;
  content: string;
  old_value?: string | null;
  new_value?: string | null;
  created_by?: string | number | null;
  created_at: string;
  creator?: { id: string | number; full_name?: string | null; user_code?: string | null } | null;
  step?: { id: string | number; step_name: string; step_number: number } | null;
  timesheet?: SharedTimesheet | null;
  issue?: SharedIssue | null;
}

export type ProcedureRaciRole = 'R' | 'A' | 'C' | 'I';

export interface ProcedureRaciEntry {
  id: string | number;
  procedure_id: string | number;
  user_id: string | number;
  raci_role: ProcedureRaciRole;
  note?: string | null;
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  created_at?: string | null;
}

export interface ProcedureStepRaciEntry {
  id: string | number;
  step_id: string | number;
  user_id: string | number;
  raci_role: ProcedureRaciRole;
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  created_at?: string | null;
}
