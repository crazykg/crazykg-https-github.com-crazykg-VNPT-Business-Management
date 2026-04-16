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

const legacyScopedDepartments: Department[] = [
  {
    id: 'dept-legacy',
    dept_code: 'PGP2',
    dept_name: 'Phòng giải Pháp 2',
    parent_id: null,
    dept_path: 'PGP2',
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

const defaultInnerWidth = window.innerWidth;

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

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
    setViewportWidth(defaultInnerWidth);
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

  it('keeps the top control shell sticky across desktop, tablet, and mobile layouts', async () => {
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

    const stickyShell = screen.getByTestId('department-weekly-schedule-sticky-shell');
    expect(stickyShell).toHaveClass('sticky', 'top-0', 'z-30', 'bg-bg-light');
    expect(stickyShell.className).toContain('sm:px-3');
    expect(stickyShell.className).toContain('lg:pb-3');
    expect(screen.getByLabelText(/Phòng ban/i)).toHaveClass('!h-9');
  });

  it('anchors the desktop audit summary to the bottom of tall preview rows', async () => {
    const currentWeek = buildCurrentWeekCalendarDays();
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-desktop-audit-footer',
      department_id: 'dept-1',
      week_start_date: currentWeek[0].date,
      entries: [
        {
          id: 'entry-desktop-audit-footer',
          calendar_date: currentWeek[2].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Điều phối hiện trường diện rộng',
          location: 'Sở NN',
          participant_text: 'Nhóm điều phối 1,\nNhóm điều phối 2,\nNhóm điều phối 3,\nNhóm điều phối 4,\nNhóm điều phối 5',
          participants: [],
          created_at: '2026-04-15 06:48:00',
          created_by: '100',
          created_by_name: 'Phan Văn Rở',
          updated_at: '2026-04-15 20:48:00',
          updated_by: '100',
          updated_by_name: 'Phan Văn Rở',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(1440);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(currentWeek);
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

    const workCell = screen.getByText('Điều phối hiện trường diện rộng').closest('td');
    expect(workCell).not.toBeNull();
    expect(workCell).toHaveClass('relative', 'pt-2', 'pb-1');

    const workCellLayout = workCell?.firstElementChild as HTMLElement | null;
    expect(workCellLayout).not.toBeNull();
    expect(workCellLayout).toHaveClass('min-h-[88px]', 'pb-8');

    const auditFooter = (workCell as HTMLElement).querySelector('.text-right') as HTMLElement | null;
    expect(auditFooter).not.toBeNull();
    expect(auditFooter).toHaveTextContent(/Cập nhật:/i);
    expect(auditFooter).toHaveClass('absolute', 'inset-x-2.5', 'bottom-0', 'text-right');
  });

  it('locks non-admin viewers to their current department even when the loaded department list is stale', async () => {
    render(
      <DepartmentWeeklyScheduleManagement
        departments={legacyScopedDepartments}
        employees={employees}
        currentUserId="100"
        currentUserDepartmentId="dept-current"
        canReadSchedules
        canWriteSchedules
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-current',
        week_start_date: expect.any(String),
      });
    });

    expect(screen.getByLabelText(/Phòng ban/i)).toBeDisabled();
    expect(screen.getByText(/Đơn vị hiện tại/i)).toBeInTheDocument();
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

  it('uses compact register cards on tablet widths instead of inline slot forms', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');

    setViewportWidth(768);
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
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Đăng ký nhanh/i }));

    expect(screen.getByText(/Mở từng buổi để thêm hoặc sửa dòng công việc/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Phòng ban/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm dòng/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tạo nhanh/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Bộ lọc/i }));
    expect(await screen.findByText(/Bộ lọc hiển thị/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phòng ban/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tuần/i)).toBeInTheDocument();
  });

  it('opens the compact scope sheet from the mobile filter icon', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');

    setViewportWidth(390);
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
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Bộ lọc/i }));

    expect(await screen.findByText(/Bộ lọc hiển thị/i)).toBeInTheDocument();
  });

  it('matches the desktop participant summary in compact register cards on tablet widths', async () => {
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-compact-1',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-compact-1',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Họp với SNN',
          location: 'Sở NN',
          participant_text: 'Cộng tác viên',
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
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(768);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    expect(
      screen.getByText(
        'VNPT000100 - Nguyễn Văn Tester, VNPT000200 - Trần Người Khác, VNPT000300 - Lê Đồng Nghiệp, Cộng tác viên'
      )
    ).toBeInTheDocument();
  });

  it('shows every compact preview entry on mobile instead of truncating participant content after two rows', async () => {
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-mobile-preview-all-rows',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-mobile-preview-1',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Làm việc với tổ 1',
          location: 'Phòng họp 1',
          participant_text: '',
          participants: [{ user_id: '100', sort_order: 10 }],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
        {
          id: 'entry-mobile-preview-2',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 20,
          work_content: 'Làm việc với tổ 2',
          location: 'Phòng họp 2',
          participant_text: '',
          participants: [{ user_id: '200', sort_order: 10 }],
          created_at: '2099-01-05 09:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 09:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
        {
          id: 'entry-mobile-preview-3',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 30,
          work_content: 'Làm việc với tổ 3',
          location: 'Phòng họp 3',
          participant_text: '',
          participants: [{ user_id: '300', sort_order: 10 }],
          created_at: '2099-01-05 10:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 10:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(390);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    expect(screen.getByText('Làm việc với tổ 1')).toBeInTheDocument();
    expect(screen.getByText('Làm việc với tổ 2')).toBeInTheDocument();
    expect(screen.getByText('Làm việc với tổ 3')).toBeInTheDocument();
    expect(screen.getByText('VNPT000300 - Lê Đồng Nghiệp')).toBeInTheDocument();
  });

  it('matches the desktop participant summary in compact preview cards on mobile widths', async () => {
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-mobile-preview-participants',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-mobile-preview-participants',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Họp giao ban mở rộng',
          location: 'Phòng họp lớn',
          participant_text: 'Khách mời',
          participants: [
            { user_id: '100', sort_order: 10 },
            { user_id: '200', sort_order: 20 },
            { user_id: '300', sort_order: 30 },
          ],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(390);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    expect(
      screen.getByText(
        'VNPT000100 - Nguyễn Văn Tester, VNPT000200 - Trần Người Khác, VNPT000300 - Lê Đồng Nghiệp, Khách mời'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Đang hiển thị chi tiết theo từng buổi.')).toBeInTheDocument();
    expect(screen.queryByText('1 buổi · 1 dòng')).not.toBeInTheDocument();
  });

  it('keeps the compact preview summary chips in the header and toggles details only from the right button', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-mobile-preview-toggle',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-mobile-preview-toggle',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Họp giao ban mở rộng',
          location: 'Phòng họp lớn',
          participant_text: '',
          participants: [{ user_id: '100', sort_order: 10 }],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(390);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    const previewPanelId = 'compact-preview-day-panel-2099-01-05';
    const collapsePreviewButton = screen.getByRole('button', { name: /Thu gọn ngày 05\/01/i });
    const getPreviewPanel = () => document.getElementById(previewPanelId);

    expect(screen.getAllByText('Sáng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 dòng').length).toBeGreaterThan(0);
    expect(collapsePreviewButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(getPreviewPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();

    await user.click(screen.getByText(/Thứ Hai/i));
    expect(screen.getByRole('button', { name: /Thu gọn ngày 05\/01/i })).toHaveAttribute('aria-expanded', 'true');
    expect(within(getPreviewPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();

    await user.click(collapsePreviewButton);
    expect(screen.getByRole('button', { name: /Mở rộng ngày 05\/01/i })).toHaveAttribute('aria-expanded', 'false');
    expect(getPreviewPanel()).not.toBeInTheDocument();
    expect(screen.getAllByText('Sáng').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Mở rộng ngày 05\/01/i }));
    expect(within(getPreviewPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();
  });

  it('keeps the participant placeholder visible in compact preview cards on mobile widths', async () => {
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-mobile-preview-empty-participants',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-mobile-preview-empty-participants',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Kiểm tra hiện trường',
          location: 'Điểm cầu trực tuyến',
          participant_text: '',
          participants: [],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(390);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    expect(screen.getByText('Thành phần:')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText(/Địa điểm: Điểm cầu trực tuyến/i)).toBeInTheDocument();
  });

  it('shows every compact register entry on tablet instead of hiding participant content behind a remaining-rows summary', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-tablet-register-all-rows',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-tablet-register-1',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Đi công tác tuyến 1',
          location: 'Điểm A',
          participant_text: '',
          participants: [{ user_id: '100', sort_order: 10 }],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
        {
          id: 'entry-tablet-register-2',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 20,
          work_content: 'Đi công tác tuyến 2',
          location: 'Điểm B',
          participant_text: '',
          participants: [{ user_id: '200', sort_order: 10 }],
          created_at: '2099-01-05 09:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 09:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
        {
          id: 'entry-tablet-register-3',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 30,
          work_content: 'Đi công tác tuyến 3',
          location: 'Điểm C',
          participant_text: '',
          participants: [{ user_id: '300', sort_order: 10 }],
          created_at: '2099-01-05 10:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 10:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(768);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Đăng ký nhanh/i }));

    expect(screen.getByText('Đi công tác tuyến 1')).toBeInTheDocument();
    expect(screen.getByText('Đi công tác tuyến 2')).toBeInTheDocument();
    expect(screen.getByText('Đi công tác tuyến 3')).toBeInTheDocument();
    expect(screen.getByText('VNPT000300 - Lê Đồng Nghiệp')).toBeInTheDocument();
  });

  it('moves the session summary chips into the compact register header and uses the right button to collapse', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-tablet-register-toggle',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-tablet-register-toggle',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Khảo sát hạ tầng',
          location: 'Điểm A',
          participant_text: '',
          participants: [{ user_id: '100', sort_order: 10 }],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(768);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Đăng ký nhanh/i }));

    const registerPanelId = 'compact-register-day-panel-2099-01-05';
    const collapseRegisterButton = screen.getByRole('button', { name: /Thu gọn ngày 05\/01/i });
    const getRegisterPanel = () => document.getElementById(registerPanelId);

    expect(screen.getAllByText('Sáng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 dòng').length).toBeGreaterThan(0);
    expect(collapseRegisterButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(getRegisterPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();

    await user.click(screen.getByText(/Thứ Hai/i));
    expect(screen.getByRole('button', { name: /Thu gọn ngày 05\/01/i })).toHaveAttribute('aria-expanded', 'true');
    expect(within(getRegisterPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();

    await user.click(collapseRegisterButton);
    expect(screen.getByRole('button', { name: /Mở rộng ngày 05\/01/i })).toHaveAttribute('aria-expanded', 'false');
    expect(getRegisterPanel()).not.toBeInTheDocument();
    expect(screen.getAllByText('Sáng').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Mở rộng ngày 05\/01/i }));
    expect(within(getRegisterPanel() as HTMLElement).getByText('Buổi sáng')).toBeInTheDocument();
  });

  it('replaces the duplicated day summary with an expanded helper in compact register cards', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-tablet-register-expanded-helper',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-tablet-register-expanded-helper',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Khảo sát hạ tầng',
          location: 'Điểm A',
          participant_text: '',
          participants: [{ user_id: '100', sort_order: 10 }],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(768);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Đăng ký nhanh/i }));

    expect(screen.getByText('Đang hiển thị chi tiết theo từng buổi.')).toBeInTheDocument();
    expect(screen.queryByText('1 buổi · 1 dòng')).not.toBeInTheDocument();
  });

  it('keeps the participant placeholder visible in compact register cards on tablet widths', async () => {
    const user = userEvent.setup();
    const futureWeek = buildCalendarWeek('2099-01-05');
    const existingSchedule: DepartmentWeeklySchedule = {
      id: 'schedule-tablet-register-empty-participants',
      department_id: 'dept-1',
      week_start_date: futureWeek[0].date,
      entries: [
        {
          id: 'entry-tablet-register-empty-participants',
          calendar_date: futureWeek[0].date,
          session: 'MORNING',
          sort_order: 10,
          work_content: 'Khảo sát tuyến cáp',
          location: 'Phường 1',
          participant_text: '',
          participants: [],
          created_at: '2099-01-05 08:00:00',
          created_by: '100',
          created_by_name: 'Nguyễn Văn Tester',
          updated_at: '2099-01-05 08:00:00',
          can_edit: true,
          can_delete: true,
          is_locked: false,
        },
      ],
    };

    setViewportWidth(768);
    supportConfigApiMocks.fetchMonthlyCalendars.mockResolvedValue(futureWeek);
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
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getByRole('button', { name: /Đăng ký nhanh/i }));

    expect(screen.getByText('Thành phần:')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText(/Địa điểm: Phường 1/i)).toBeInTheDocument();
  });

  it('renders the system personnel dropdown above the schedule modal overlay', async () => {
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
      expect(supportConfigApiMocks.fetchDepartmentWeeklySchedules).toHaveBeenCalledWith({
        department_id: 'dept-1',
        week_start_date: futureWeek[0].date,
      });
    });

    await user.click(screen.getAllByText('Sáng')[0]);
    await user.click(screen.getByRole('button', { name: /Thành phần \(nhân sự hệ thống\)/i }));

    const searchInput = await screen.findByPlaceholderText('Tìm nhân sự...');
    let portalRoot: HTMLElement | null = searchInput.parentElement;

    while (portalRoot && !portalRoot.style.zIndex) {
      portalRoot = portalRoot.parentElement;
    }

    expect(portalRoot).not.toBeNull();
    expect(portalRoot?.style.zIndex).toBe('10020');
  });

  it('shows registered entries from other users to admins in the modal', async () => {
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
        isAdminViewer
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

  it('hides other user entries from non-admin users inside the modal', async () => {
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

    expect(await screen.findAllByText(/Đăng ký của bạn/i)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /đã đăng ký #1/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Bạn chưa có lịch đăng ký cho buổi này/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Làm việc với đơn vị khác')).not.toBeInTheDocument();
  });

  it('shows readonly form for another user entry when opened by an admin', async () => {
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
        isAdminViewer
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
