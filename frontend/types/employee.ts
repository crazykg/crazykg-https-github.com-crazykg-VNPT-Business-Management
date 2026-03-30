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
  phone?: string | null;
  phone_number?: string | null;
  mobile?: string | null;
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
  department?: string | number | null;
}

export interface EmployeePartyProfileQuality {
  missing_card_number: boolean;
}

export interface EmployeePartyProfile {
  id: string | number;
  employee_id: string | number;
  ethnicity?: string | null;
  religion?: string | null;
  hometown?: string | null;
  professional_qualification?: string | null;
  political_theory_level?: string | null;
  party_card_number?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  employee?: Employee | null;
  profile_quality?: EmployeePartyProfileQuality;
}

export type EmployeePartyListItem = EmployeePartyProfile;

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
