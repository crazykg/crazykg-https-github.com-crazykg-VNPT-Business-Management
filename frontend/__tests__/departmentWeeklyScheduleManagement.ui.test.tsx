import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  {
    id: '300',
    uuid: 'employee-300',
    user_code: 'NV300',
    username: 'third-user',
    full_name: 'Lê Đồng Nghiệp',
    email: 'third@example.com',
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

const buildCalendarWeek = (monday: string): WorkCalendarDay[] => {
  const [year, month, day] = monday.split('-').map((value) => Number(value));
  const mondayDate = new Date(year, month - 1, day);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate());
    current.setDate(mondayDate.getDate() + index);
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

  it('keeps a compact header without the legacy summary cards and helper copy', async () => {
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
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: /Lịch làm việc đơn vị/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Phòng ban/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tuần/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Năm/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phòng ban đang xem/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dòng đã lưu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bản nháp đang mở/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tuần công tác/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Điều phối lịch theo tuần cho từng phòng ban/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chọn đúng phòng ban và tuần làm việc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Xem trước lịch tuần theo đúng bố cục thông báo nội bộ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nhập và cập nhật từng dòng công việc trực tiếp theo từng buổi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo lịch tuần/i })).toBeInTheDocument();
  });

  it('opens the entry form immediately when clicking an empty schedule slot', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);

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
      expect(supportConfigApiMocks.fetchMonthlyCalendars).toHaveBeenCalledWith({ year: 2026 });
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getAllByText('Sáng')[0]);

    expect(await screen.findByLabelText(/Nội dung làm việc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thành phần \(nhân sự hệ thống\)/i })).toHaveClass('!h-8');
    expect(screen.queryByText(/Chưa có nội dung nào cho buổi này/i)).not.toBeInTheDocument();
  });

  it('shows registered entries and opens the selected registered form when the slot already has a schedule', async () => {
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
          can_edit: false,
          can_delete: false,
          is_locked: false,
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
    expect(screen.getAllByText(/Đăng ký:/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Người đăng ký:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ngày tạo:/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Phòng họp tầng 3/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cập nhật đăng ký/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nội dung làm việc/i)).toHaveValue('Họp triển khai đầu ngày');
    expect(screen.getByLabelText(/Nội dung làm việc/i)).toBeDisabled();
  });

  it('loads selected registered entry from the left panel into the form for editing', async () => {
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
          work_content: 'Khảo sát hiện trạng hệ thống',
          location: 'Trung tâm dữ liệu',
          participant_text: 'Đại diện khách hàng',
          participants: [
            {
              user_id: '100',
              sort_order: 10,
            },
            {
              user_id: '200',
              sort_order: 20,
            },
            {
              user_id: '300',
              sort_order: 30,
            },
          ],
          created_at: '2026-04-02 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2026-04-02 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
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

    await user.click(await screen.findByText('Khảo sát hiện trạng hệ thống'));
    await user.click(screen.getByRole('button', { name: /đã đăng ký #1/i }));

    const workContent = screen.getByLabelText(/Nội dung làm việc/i);
    expect(workContent).toHaveValue('Khảo sát hiện trạng hệ thống');
    expect(workContent).not.toBeDisabled();
    expect(screen.getByDisplayValue('Trung tâm dữ liệu')).toBeInTheDocument();
    const participantTrigger = screen.getByRole('button', { name: /Thành phần \(nhân sự hệ thống\)/i });
    expect(within(participantTrigger).getByText('Nguyễn Văn Tester, Trần Người Khác +1')).toBeInTheDocument();
  });

  it('shows readonly form when opening another user entry from the left panel', async () => {
    const user = userEvent.setup();
    const currentWeek = buildCurrentWeekCalendarDays();
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-1',
      department_id: 'dept-1',
      week_start_date: currentWeek[0].date,
      entries: [
        {
          id: 'entry-1',
          calendar_date: currentWeek[2].date,
          session: 'AFTERNOON',
          sort_order: 10,
          work_content: 'Làm việc với đơn vị khác',
          location: 'Phòng họp B',
          participant_text: 'Khách mời',
          participants: [],
          created_at: '2026-04-02 08:00:00',
          created_by: '200',
          created_by_name: 'Trần Người Khác',
          updated_at: '2026-04-02 08:00:00',
          can_edit: false,
          can_delete: false,
          is_locked: false,
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

    await user.click(await screen.findByText('Làm việc với đơn vị khác'));
    await user.click(screen.getByRole('button', { name: /đã đăng ký #1/i }));

    const workContent = screen.getByLabelText(/Nội dung làm việc/i);
    expect(workContent).toHaveValue('Làm việc với đơn vị khác');
    expect(workContent).toBeDisabled();
    expect(screen.getAllByText(/Chỉ người đăng ký hoặc admin mới được chỉnh sửa/i).length).toBeGreaterThan(0);
  });

  it('blocks editing when the selected entry is already past', async () => {
    const user = userEvent.setup();
    const pastWeek = buildCalendarWeek('2000-01-03');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-1',
      department_id: 'dept-1',
      week_start_date: pastWeek[0].date,
      entries: [
        {
          id: 'entry-1',
          calendar_date: pastWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Lịch buổi sáng đã qua',
          location: 'Phòng họp A',
          participant_text: '',
          participants: [],
          created_at: '2026-04-02 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2026-04-02 08:00:00',
          can_edit: false,
          can_delete: false,
          is_locked: true,
        },
      ],
    };

    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(pastWeek);
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
        week_start_date: pastWeek[0].date,
      });
    });

    await user.click(await screen.findByText('Lịch buổi sáng đã qua'));

    const workContent = screen.getByLabelText(/Nội dung làm việc/i);
    expect(workContent).toHaveValue('Lịch buổi sáng đã qua');
    expect(workContent).toBeDisabled();
    expect(screen.getAllByText(/Lịch làm việc đã qua không thể chỉnh sửa hoặc xóa/i).length).toBeGreaterThan(0);
    screen.getAllByRole('button', { name: /đăng ký mới/i }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
