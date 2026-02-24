export type Status = 'Active' | 'Inactive';

export interface Department {
  id: string | number;
  dept_code: string;
  dept_name: string;
  parent_id: string | number | null;
  dept_path: string;
  is_active: boolean;
  employeeCount?: number;
}

export interface Business {
  id: string | number;
  uuid?: string;
  domain_code: string;
  domain_name: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Vendor {
  id: string | number;
  uuid: string;
  vendor_code: string;
  vendor_name: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Product {
  id: string | number;
  uuid?: string;
  product_code: string;
  product_name: string;
  domain_id: string | number;
  vendor_id: string | number;
  standard_price: number;
  unit?: string | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface Customer {
  id: string | number;
  uuid: string;
  customer_code: string;
  customer_name: string;
  tax_code: string;
  address: string;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export type PositionType = 'GIAM_DOC' | 'TRUONG_PHONG' | 'DAU_MOI';

export interface CustomerPersonnel {
  id: string;
  fullName: string;
  birthday: string;
  positionType: PositionType;
  phoneNumber: string;
  email: string;
  customerId: string;
  status: Status;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
export type EmployeeType = 'Official' | 'Collaborator';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type VpnStatus = 'YES' | 'NO';
export type HRPersonnelType = 'OFFICIAL' | 'CTV';

export interface Employee {
  id: string | number;
  uuid: string;
  user_code?: string;
  employee_code?: string;
  username: string;
  full_name: string;
  email: string;
  status: EmployeeStatus;
  position_code?: string | null;
  position_name?: string | null;
  job_title_raw?: string | null;
  job_title_vi?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  ip_address?: string | null;
  vpn_status?: VpnStatus | null;
  department_id: string | number | null;
  position_id: string | number | null;
  // Backward-compatible aliases used by a few legacy views.
  name?: string;
  department?: string | number | null;
}

export type InternalUser = Employee;

export interface HRPersonnelTypeBreakdown {
  type: HRPersonnelType;
  label: string;
  count: number;
  percentage: number;
}

export interface HRGenderBreakdown {
  gender: Gender | 'UNKNOWN';
  label: string;
  count: number;
  percentage: number;
  avgAge: number | null;
}

export interface HRStatusBreakdown {
  status: EmployeeStatus | 'UNKNOWN';
  label: string;
  count: number;
  percentage: number;
}

export interface HRPositionBreakdown {
  position_code: string | null;
  position_name: string;
  count: number;
}

export interface HRDepartmentTypeBreakdown {
  department_id: string | number | null;
  dept_code: string;
  dept_name: string;
  official_count: number;
  ctv_count: number;
  total: number;
}

export interface HRStatistics {
  totalEmployees: number;
  officialEmployees: number;
  ctvEmployees: number;
  officialPercentage: number;
  ctvPercentage: number;
  maleCount: number;
  femaleCount: number;
  malePercentage: number;
  femalePercentage: number;
  avgAgeMale: number | null;
  avgAgeFemale: number | null;
  vpnEnabledCount: number;
  vpnEnabledPercentage: number;
  statusBreakdown: HRStatusBreakdown[];
  genderBreakdown: HRGenderBreakdown[];
  personnelTypeBreakdown: HRPersonnelTypeBreakdown[];
  positionBreakdown: HRPositionBreakdown[];
  departmentTypeBreakdown: HRDepartmentTypeBreakdown[];
}

export type AuditEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE';

export interface AuditLog {
  id: string | number;
  uuid?: string;
  event: AuditEvent | string;
  auditable_type: string;
  auditable_id: string | number;
  old_values?: Record<string, unknown> | string | null;
  new_values?: Record<string, unknown> | string | null;
  url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  created_by?: string | number | null;
  actor?: Pick<Employee, 'id' | 'full_name' | 'username'> | null;
}

export type OpportunityStage = 'NEW' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type OpportunityStatus = OpportunityStage;

export interface Opportunity {
  id: string | number;
  opp_name: string;
  customer_id: string | number;
  amount: number;
  stage: OpportunityStage;
}

export interface PipelineStageBreakdown {
  stage: OpportunityStage;
  value: number;
}

export type ProjectStatus = 'PLANNING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU';

export interface ProjectItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number | string;
  discountAmount: number | string;
  lineTotal?: number;
  discountMode?: 'PERCENT' | 'AMOUNT';
}

export type RACIRole = 'A' | 'R' | 'C' | 'I';

export interface ProjectRACI {
  id: string;
  userId: string;
  roleType: RACIRole;
  assignedDate: string;
}

export interface Project {
  id: string | number;
  project_code: string;
  project_name: string;
  customer_id: string | number;
  status: ProjectStatus;
  investment_mode?: InvestmentMode | string | null;
  items?: ProjectItem[];
}

export interface ProjectStatusBreakdown {
  status: ProjectStatus;
  count: number;
}

export interface MonthlyRevenueComparison {
  month: string;
  planned: number;
  actual: number;
}

export interface DashboardStats {
  totalRevenue: number;
  actualRevenue: number;
  forecastRevenueMonth: number;
  forecastRevenueQuarter: number;
  monthlyRevenueComparison: MonthlyRevenueComparison[];
  pipelineByStage: PipelineStageBreakdown[];
  projectStatusCounts: ProjectStatusBreakdown[];
}

export type ContractStatus = 'DRAFT' | 'PENDING' | 'SIGNED' | 'LIQUIDATED';
export type PaymentCycle = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type PaymentScheduleStatus = 'PENDING' | 'INVOICED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Contract {
  id: string | number;
  contract_code: string;
  contract_number?: string;
  contract_name: string;
  customer_id: string | number;
  project_id: string | number;
  value: number;
  total_value?: number;
  payment_cycle?: PaymentCycle;
  status: ContractStatus;
  sign_date?: string | null;
  expiry_date?: string | null;
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
  created_at?: string;
  updated_at?: string;
}

export type DocumentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface DocumentType {
  id: string;
  name: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  driveFileId: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  typeId: string;
  customerId: string;
  projectId?: string;
  expiryDate?: string;
  status: DocumentStatus;
  attachments: Attachment[];
  createdDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  content: string;
  remindDate: string;
  assignedToUserId: string;
  createdDate?: string;
}

export interface UserDeptHistory {
  id: string;
  userId: string;
  fromDeptId: string;
  toDeptId: string;
  transferDate: string;
  reason: string;
  createdDate?: string;
  decisionNumber?: string;
  userCode?: string;
  userName?: string;
  fromDeptCode?: string | null;
  fromDeptName?: string | null;
  toDeptCode?: string | null;
  toDeptName?: string | null;
}

export type ModalType =
  | 'ADD_DEPARTMENT'
  | 'EDIT_DEPARTMENT'
  | 'VIEW_DEPARTMENT'
  | 'DELETE_DEPARTMENT'
  | 'CANNOT_DELETE'
  | 'IMPORT_DATA'
  | 'ADD_EMPLOYEE'
  | 'EDIT_EMPLOYEE'
  | 'DELETE_EMPLOYEE'
  | 'ADD_BUSINESS'
  | 'EDIT_BUSINESS'
  | 'DELETE_BUSINESS'
  | 'ADD_VENDOR'
  | 'EDIT_VENDOR'
  | 'DELETE_VENDOR'
  | 'ADD_PRODUCT'
  | 'EDIT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'ADD_CUSTOMER'
  | 'EDIT_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'ADD_CUS_PERSONNEL'
  | 'EDIT_CUS_PERSONNEL'
  | 'DELETE_CUS_PERSONNEL'
  | 'ADD_OPPORTUNITY'
  | 'EDIT_OPPORTUNITY'
  | 'DELETE_OPPORTUNITY'
  | 'ADD_PROJECT'
  | 'EDIT_PROJECT'
  | 'DELETE_PROJECT'
  | 'ADD_CONTRACT'
  | 'EDIT_CONTRACT'
  | 'DELETE_CONTRACT'
  | 'ADD_DOCUMENT'
  | 'EDIT_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'ADD_REMINDER'
  | 'EDIT_REMINDER'
  | 'DELETE_REMINDER'
  | 'ADD_USER_DEPT_HISTORY'
  | 'EDIT_USER_DEPT_HISTORY'
  | 'DELETE_USER_DEPT_HISTORY'
  | null;

export interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}
