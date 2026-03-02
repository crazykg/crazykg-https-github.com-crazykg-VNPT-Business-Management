export const PROGRAMMING_REQUEST_STATUSES = [
  'NEW',
  'ANALYZING',
  'CODING',
  'PENDING_UPCODE',
  'UPCODED',
  'NOTIFIED',
  'CLOSED',
  'CANCELLED',
] as const;

export type ProgrammingRequestStatus = (typeof PROGRAMMING_REQUEST_STATUSES)[number];

export const PROGRAMMING_REQUEST_SOURCE_TYPES = ['DIRECT', 'FROM_SUPPORT'] as const;
export type ProgrammingRequestSourceType = (typeof PROGRAMMING_REQUEST_SOURCE_TYPES)[number];

export const PROGRAMMING_REQUEST_TYPES = ['FEATURE', 'BUG', 'OPTIMIZE', 'REPORT', 'OTHER'] as const;
export type ProgrammingRequestType = (typeof PROGRAMMING_REQUEST_TYPES)[number];

export const PROGRAMMING_REQUEST_UPCODE_STATUSES = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const;
export type ProgrammingRequestUpcodeStatus = (typeof PROGRAMMING_REQUEST_UPCODE_STATUSES)[number];

export const PROGRAMMING_REQUEST_NOTI_STATUSES = ['PENDING', 'NOTIFIED', 'FAILED'] as const;
export type ProgrammingRequestNotiStatus = (typeof PROGRAMMING_REQUEST_NOTI_STATUSES)[number];

export const WORKLOG_PHASES = ['ANALYZE', 'CODE', 'UPCODE', 'NOTIFY', 'OTHER'] as const;
export type WorklogPhase = (typeof WORKLOG_PHASES)[number];

export interface IProgrammingRequest {
  id: string | number;
  uuid: string;
  req_code: string;
  req_name: string;
  ticket_code: string | null;
  task_link: string | null;
  parent_id: number | null;
  depth: number;
  reference_request_id: number | null;
  source_type: ProgrammingRequestSourceType;
  req_type: ProgrammingRequestType;
  service_group_id: number | null;
  support_request_id: number | null;
  priority: number | null;
  overall_progress: number | null;
  status: ProgrammingRequestStatus;
  description: string | null;
  doc_link: string | null;
  customer_id: number | null;
  requested_date: string;
  reporter_name: string | null;
  reporter_contact_id: number | null;
  receiver_id: number | null;
  project_id: number | null;
  product_id: number | null;
  project_item_id: number | null;
  analyze_estimated_hours: number | null;
  analyze_start_date: string | null;
  analyze_end_date: string | null;
  analyze_extend_date: string | null;
  analyzer_id: number | null;
  analyze_progress: number | null;
  code_estimated_hours: number | null;
  code_start_date: string | null;
  code_end_date: string | null;
  code_extend_date: string | null;
  code_actual_date: string | null;
  coder_id: number | null;
  code_progress: number | null;
  upcode_status: ProgrammingRequestUpcodeStatus | null;
  upcode_date: string | null;
  upcoder_id: number | null;
  noti_status: ProgrammingRequestNotiStatus | null;
  noti_date: string | null;
  notifier_id: number | null;
  notified_internal_id: number | null;
  notified_customer_id: number | null;
  noti_doc_link: string | null;
  created_at: string | null;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;
  deleted_at: string | null;
  parent_req_code?: string | null;
  reference_req_code?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  product_name?: string | null;
  coder_name?: string | null;
}

export interface ProgrammingRequestReferenceMatch {
  id: number;
  req_code: string;
  req_name: string;
  status: ProgrammingRequestStatus;
  requested_date: string | null;
  depth: number;
}

export interface IWorklog {
  id: string | number;
  programming_request_id: number;
  phase: WorklogPhase;
  content: string;
  logged_date: string;
  hours_estimated: number | null;
  hours_spent: number;
  created_at: string | null;
  created_by: number;
  updated_at: string | null;
  updated_by: number | null;
  deleted_at: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface IProgrammingRequestForm {
  req_code: string;
  req_name: string;
  ticket_code: string;
  task_link: string;
  parent_id: number | null;
  depth: number;
  reference_request_id: number | null;
  source_type: ProgrammingRequestSourceType;
  req_type: ProgrammingRequestType;
  service_group_id: number | null;
  support_request_id: number | null;
  priority: number | null;
  overall_progress: number | null;
  status: ProgrammingRequestStatus;
  description: string;
  doc_link: string;
  customer_id: number | null;
  requested_date: string;
  reporter_name: string;
  reporter_contact_id: number | null;
  receiver_id: number | null;
  project_id: number | null;
  product_id: number | null;
  project_item_id: number | null;
  analyze_estimated_hours: number | null;
  analyze_start_date: string;
  analyze_end_date: string;
  analyze_extend_date: string;
  analyzer_id: number | null;
  analyze_progress: number | null;
  code_estimated_hours: number | null;
  code_start_date: string;
  code_end_date: string;
  code_extend_date: string;
  code_actual_date: string;
  coder_id: number | null;
  code_progress: number | null;
  upcode_status: ProgrammingRequestUpcodeStatus | '';
  upcode_date: string;
  upcoder_id: number | null;
  noti_status: ProgrammingRequestNotiStatus | '';
  noti_date: string;
  notifier_id: number | null;
  notified_internal_id: number | null;
  notified_customer_id: number | null;
  noti_doc_link: string;
}

export type ProgrammingRequestFilters = {
  page?: number;
  per_page?: number;
  q?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  status?: ProgrammingRequestStatus[];
  req_type?: ProgrammingRequestType | '';
  coder_id?: number | null;
  customer_id?: number | null;
  project_id?: number | null;
  requested_date_from?: string;
  requested_date_to?: string;
};

export type WorklogPhaseSummary = {
  phase: WorklogPhase;
  hours_spent_sum: number;
  hours_estimated_sum: number;
};
