export interface Department {
  id: string | number;
  dept_code: string;
  dept_name: string;
  parent_id: string | number | null;
  dept_path: string;
  is_active: boolean;
  employeeCount?: number;
}
