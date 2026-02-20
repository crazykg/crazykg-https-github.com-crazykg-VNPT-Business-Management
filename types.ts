
export type Status = 'Active' | 'Inactive';

export interface Department {
  id: string;
  name: string;
  parent: string | null;
  status: Status;
  employeeCount?: number;
  note?: string;
  createdDate?: string;
  createdBy?: string;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  status: Status;
  createdDate?: string;
}

export interface Vendor {
  id: string;
  name: string;
  status: Status;
  createdDate?: string;
}

export interface Product {
  id: string;
  name: string;
  domain: string; // Refers to Business ID
  vendor: string; // Refers to Vendor ID
  price: number; // Standard price
  status: Status;
  createdDate?: string;
}

export interface Customer {
  id: string; // customer_code
  name: string; // company_name
  taxCode: string; // tax_code
  address: string; // address
  status: Status;
  createdDate?: string;
}

export type PositionType = 'GIAM_DOC' | 'P_GIAM_DOC' | 'TRUONG_PHONG' | 'DAU_MOI';

export interface CustomerPersonnel {
  id: string;
  fullName: string;
  birthday: string;
  positionType: PositionType;
  phoneNumber: string;
  email: string;
  customerId: string; // Links to Customer
  status: Status; // Optional, defaulting to Active for consistency
}

export type EmployeeStatus = 'Active' | 'Suspended' | 'Quit';
export type EmployeeType = 'Official' | 'Collaborator';
export type Gender = 'Male' | 'Female' | 'Other';
export type VpnStatus = 'Granted' | 'Not_Granted';

export interface Employee {
  id: string;
  name: string;
  email: string;
  dob: string;
  age: number;
  gender: Gender;
  department: string;
  type: EmployeeType;
  status: EmployeeStatus;
  phone?: string;
  position?: string;
  ipAddress?: string;
  vpnStatus?: VpnStatus;
}

export type OpportunityStatus = 'TIEM_NANG' | 'DANG_TIEP_CAN' | 'CHAO_GIA' | 'DU_THAU' | 'THUONG_THAO' | 'TRUNG_THAU' | 'THAT_THAU';

export interface Opportunity {
  id: string;
  name: string; // opportunity_name
  customerId: string; // customer_id
  personnelId: string; // personnel_id
  productId: string; // product_id
  estimatedValue: number; // estimated_value
  probability: number; // probability (0-100)
  status: OpportunityStatus;
  salesId: string; // user_id (links to Employee)
  createdDate?: string;
}

export type ProjectStatus = 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
export type InvestmentMode = 'DAU_TU' | 'THUE_DICH_VU';

export interface ProjectItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number | string;
  discountAmount: number | string;
  lineTotal?: number; // Calculated: (quantity * unitPrice) - discountAmount
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
  id: string; // project_code
  name: string; // project_name
  customerId: string; // customer_id (Read-only from Opportunity)
  opportunityId: string; // opportunity_id (Read-only)
  investmentMode: InvestmentMode;
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  status: ProjectStatus;
  items: ProjectItem[];
  raci?: ProjectRACI[];
  createdDate?: string;
}

export type ContractStatus = 'DRAFT' | 'SIGNED' | 'TERMINATED' | 'EXPIRED';

export interface Contract {
  id: string; // contract_number
  projectId: string; // project_id
  signDate: string; // sign_date
  totalValue: number; // total_value
  status: ContractStatus;
  createdDate?: string;
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
  id: string; // document_code
  name: string; // document_name
  typeId: string; // document_type_id
  customerId: string; // customer_id
  projectId?: string; // project_id
  expiryDate?: string; // expiry_date
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
  id: string; // history_code
  userId: string;
  fromDeptId: string;
  toDeptId: string;
  transferDate: string;
  reason: string;
  createdDate?: string;
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
