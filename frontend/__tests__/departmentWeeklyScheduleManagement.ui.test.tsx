import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentWeeklyScheduleManagement } from '../components/DepartmentWeeklyScheduleManagement';
import type { Department } from '../types/department';
import type { Employee } from '../types/employee';
import type { DepartmentWeeklySchedule, WorkCalendarDay } from '../types/scheduling';

const supportConfigApiMocks = vi.hoisted(() => ({
  fetchMonthlyCalendars: vi.fn(),
  fetchDepartmentWeeklySchedules: vi.fn(),
  createDepartmentWeeklySchedule: vi.fn(),
  updateDepartmentWeeklySchedule: vi.fn(),
  deleteDepartmentWeeklyScheduleEntry: vi.fn(),
}));

vi.mock('../services/api/supportConfigApi', async () => {
  const actual = await vi.importActual<typeof import('../services/api/supportConfigApi')>(
    '../services/api/supportConfigApi'
  );

  return {
    ...actual,
    ...supportConfigApiMocks,
  };
});

const departments: Department[] = [
  {
    id: 'dept-1',
    dept_code: 'KD',
    dept_name: 'Phòng Kinh doanh',
    parent_id: null,
    dept_path: 'KD',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: '100',
    uuid: 'employee-100',
    user_code: 'NV100',
    username: 'tester',
    full_name: 'Nguyễn Văn Tester',
    email: 'tester@example.com',
    status: 'ACTIVE',
    department_id: 'dept-1',
    position_id: null,
    department: 'dept-1',
  },
  {
    id: '200',
    uuid: 'employee-200',
    user_code: 'NV200',
    username: 'other-user',
    full_name: 'Trần Người Khác',
    email: 'other@example.com',
    status: 'ACTIVE',
    department_id: 'dept-1',
    position_id: null,
    department: 'dept-1',
  },
];

const toDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCurrentWeekCalendarDays = (): WorkCalendarDay[] => {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOffset = monday.getDay() === 0 ? -6 : 1 - monday.getDay();
  monday.setDate(monday.getDate() + dayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    current.setDate(monday.getDate() + index);
    const jsDay = current.getDay();
    const dayOfWeek = jsDay === 0 ? 1 : jsDay + 1;
    const isWeekend = dayOfWeek === 1 || dayOfWeek === 7;

    return {
      date: toDateKey(current),
      year: current.getFullYear(),
      month: current.getMonth() + 1,
      day: current.getDate(),
      week_number: 1,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      is_working_day: !isWeekend,
      is_holiday: false,
    };
  });
};

describe('DepartmentWeeklyScheduleManagement', () => {
  beforeEach(() => {
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(buildCurrentWeekCalendarDays());
    supportConfigApiMocks.fetchDepartmentWeeklySchedules.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the entry form immediately when clicking an empty schedule slot', async () => {
    const user = userEvent.setup();
    const currentWeek = buildCurrentWeekCalendarDays();

    render(
      <DepartmentWeeklyScheduleManagement
        departments={departments}
        employees={employees}
        currentUserId="100"
        currentUserDepartmentId="dept-1"
        canReadSchedules
        canWriteSchedules
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(supportConfigApiMocks.fetchMonthlyCalendars).toHaveBeenCalledWith({ year: new Date().getFullYear() });
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: currentWeek[0].date,
      });
    });

    await user.click(screen.getAllByText('Chiều')[0]);

    expect(await screen.findByLabelText(/Nội dung làm việc/i)).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có nội dung nào cho buổi này/i)).not.toBeInTheDocument();
  });

  it('shows registered entries and still opens a fresh form when the slot already has a schedule', async () => {
    const user = userEvent.setup();
    const currentWeek = buildCurrentWeekCalendarDays();
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-1',
      department_id: 'dept-1',
      week_start_date: currentWeek[0].date,
      entries: [
        {
          id: 'entry-1',
          calendar_date: currentWeek[3].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Họp triển khai đầu ngày',
          location: 'Phòng họp tầng 3',
          participant_text: 'Khách mời dự án',
          participants: [
            {
              user_id: '200',
              sort_order: 10,
            },
          ],
          created_at: '2026-04-02 08:00:00',
          created_by: '200',
          created_by_name: 'Trần Người Khác',
          updated_at: '2026-04-02 08:00:00',
          can_delete: false,
        },
      ],
    };

    supportConfigApiMocks.fetchDepartmentWeeklySchedules.mockResolvedValue([existingSchedule]);

    render(
      <DepartmentWeeklyScheduleManagement
        departments={departments}
        employees={employees}
        currentUserId="100"
        currentUserDepartmentId="dept-1"
        canReadSchedules
        canWriteSchedules
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: currentWeek[0].date,
      });
    });

    await user.click(await screen.findByText('Họp triển khai đầu ngày'));

    expect(await screen.findByText(/Danh sách đã đăng ký/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Trần Người Khác/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Phòng họp tầng 3/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Đăng ký của bạn/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nội dung làm việc/i)).toHaveValue('');
  });
});
