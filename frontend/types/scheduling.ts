export interface WorkCalendarDay {
  date: string;
  year: number;
  month: number;
  day: number;
  week_number: number;
  day_of_week: number;
  is_weekend: boolean;
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
}

export type DepartmentWeeklyScheduleSession = 'MORNING' | 'AFTERNOON';

export interface DepartmentWeeklyScheduleParticipant {
  id?: string | number | null;
  user_id?: string | number | null;
  user_code?: string | null;
  full_name?: string | null;
  participant_name_snapshot?: string | null;
  sort_order?: number | null;
  display_name?: string | null;
}

export interface DepartmentWeeklyScheduleEntry {
  id?: string | number | null;
  calendar_date: string;
  session: DepartmentWeeklyScheduleSession;
  session_label?: string | null;
  sort_order?: number | null;
  work_content: string;
  location?: string | null;
  participant_text?: string | null;
  participants: DepartmentWeeklyScheduleParticipant[];
  participant_display?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  can_delete?: boolean;
}

export interface DepartmentWeeklyScheduleDay {
  date: string;
  day: number;
  month: number;
  year: number;
  day_of_week: number;
  day_name: string;
  is_weekend: boolean;
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name?: string | null;
  sessions: Record<DepartmentWeeklyScheduleSession, DepartmentWeeklyScheduleEntry[]>;
}

export interface DepartmentWeeklySchedule {
  id?: string | number | null;
  department_id: string | number;
  department_code?: string | null;
  department_name?: string | null;
  week_start_date: string;
  week_end_date?: string | null;
  week_number?: number | null;
  year?: number | null;
  week_label?: string | null;
  date_range_label?: string | null;
  entries: DepartmentWeeklyScheduleEntry[];
  days?: DepartmentWeeklyScheduleDay[];
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  created_by_username?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  updated_by_username?: string | null;
}

export interface DepartmentWeekOption {
  week_start_date: string;
  week_end_date: string;
  week_number: number;
  year: number;
  label: string;
}
