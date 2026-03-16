import React, { useEffect, useMemo, useState } from 'react';
import {
  buildDepartmentWeekOptions,
  createDepartmentWeeklySchedule,
  deleteDepartmentWeeklySchedule,
  fetchDepartments,
  fetchEmployees,
  fetchDepartmentWeeklySchedules,
  fetchMonthlyCalendars,
  isRequestCanceledError,
  updateDepartmentWeeklySchedule,
} from '../services/v5Api';
import type {
  Department,
  DepartmentWeeklySchedule,
  DepartmentWeeklyScheduleDay,
  DepartmentWeeklyScheduleSession,
  Employee,
  WorkCalendarDay,
} from '../types';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { SearchableSelect } from './SearchableSelect';

type ToastType = 'success' | 'error';

type EditableScheduleEntry = {
  local_id: string;
  id?: string | number | null;
  calendar_date: string;
  session: DepartmentWeeklyScheduleSession;
  sort_order: number;
  work_content: string;
  location: string;
  participant_text: string;
  participant_user_ids: string[];
};

interface DepartmentWeeklyScheduleManagementProps {
  departments: Department[];
  employees: Employee[];
  currentUserId?: string | number | null;
  canReadSchedules?: boolean;
  canWriteSchedules?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

type DepartmentWeeklyViewTab = 'SCHEDULE' | 'REGISTER';

const SESSION_LABELS: Record<DepartmentWeeklyScheduleSession, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
};

const DAY_NAMES: Record<number, string> = {
  1: 'Chủ Nhật',
  2: 'Thứ Hai',
  3: 'Thứ Ba',
  4: 'Thứ Tư',
  5: 'Thứ Năm',
  6: 'Thứ Sáu',
  7: 'Thứ Bảy',
};

const PREVIEW_DAY_NAMES: Record<number, string> = {
  1: 'CN',
  2: 'Hai',
  3: 'Ba',
  4: 'Tư',
  5: 'Năm',
  6: 'Sáu',
  7: 'Bảy',
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeId = (value: unknown): string => normalizeText(value);

const formatDisplayDate = (value: string | null | undefined): string => {
  const text = normalizeText(value);
  if (!text) {
    return '--';
  }

  const parts = text.split('-');
  if (parts.length !== 3) {
    return text;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const buildYearOptions = (baseYear: number): Array<{ value: string; label: string }> => {
  return [{ value: String(baseYear), label: `Năm ${baseYear}` }];
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildWeekDays = (
  weekStartDate: string,
  calendarDays: WorkCalendarDay[],
  scheduleDays?: DepartmentWeeklyScheduleDay[]
): DepartmentWeeklyScheduleDay[] => {
  const byDate = new Map((calendarDays || []).map((day) => [String(day.date), day]));
  const scheduleByDate = new Map((scheduleDays || []).map((day) => [String(day.date), day]));
  const start = new Date(`${weekStartDate}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start.getTime());
    current.setDate(current.getDate() + index);
    const dateKey = toDateKey(current);
    const rawDay = byDate.get(dateKey);
    const existingDay = scheduleByDate.get(dateKey);
    const jsDay = current.getDay();
    const dayOfWeek = rawDay?.day_of_week ?? (jsDay === 0 ? 1 : jsDay + 1);

    return {
      date: dateKey,
      day: rawDay?.day ?? current.getDate(),
      month: rawDay?.month ?? current.getMonth() + 1,
      year: rawDay?.year ?? current.getFullYear(),
      day_of_week: dayOfWeek,
      day_name: existingDay?.day_name || PREVIEW_DAY_NAMES[dayOfWeek] || DAY_NAMES[dayOfWeek] || '',
      is_weekend: rawDay?.is_weekend ?? (dayOfWeek === 1 || dayOfWeek === 7),
      is_working_day: rawDay?.is_working_day ?? !(dayOfWeek === 1 || dayOfWeek === 7),
      is_holiday: rawDay?.is_holiday ?? false,
      holiday_name: rawDay?.holiday_name ?? null,
      sessions: existingDay?.sessions ?? {
        MORNING: [],
        AFTERNOON: [],
      },
    };
  });
};

const hydrateEditableEntries = (schedule: DepartmentWeeklySchedule | null): EditableScheduleEntry[] =>
  (schedule?.entries || []).map((entry, index) => ({
    local_id: normalizeId(entry.id) || `loaded-${index}-${entry.calendar_date}-${entry.session}`,
    id: entry.id ?? null,
    calendar_date: entry.calendar_date,
    session: entry.session,
    sort_order: Number(entry.sort_order ?? (index + 1) * 10),
    work_content: String(entry.work_content ?? ''),
    location: String(entry.location ?? ''),
    participant_text: String(entry.participant_text ?? ''),
    participant_user_ids: (entry.participants || [])
      .map((participant) => normalizeId(participant.user_id))
      .filter((value) => value !== ''),
  }));

const buildParticipantDisplay = (entry: EditableScheduleEntry, employeesById: Map<string, Employee>): string => {
  const names = entry.participant_user_ids
    .map((userId) => employeesById.get(userId))
    .filter(Boolean)
    .map((employee) => employee?.full_name || employee?.name || employee?.username || employee?.user_code || '');

  const freeText = normalizeText(entry.participant_text);
  return [...names.filter((value) => normalizeText(value) !== ''), ...(freeText ? [freeText] : [])].join(', ');
};

const buildPreviewRows = (
  weekDays: DepartmentWeeklyScheduleDay[],
  entries: EditableScheduleEntry[],
  employeesById: Map<string, Employee>
) => {
  const entryMap = new Map<string, EditableScheduleEntry[]>();
  entries.forEach((entry) => {
    const key = `${entry.calendar_date}:${entry.session}`;
    const bucket = entryMap.get(key) || [];
    bucket.push(entry);
    entryMap.set(key, bucket);
  });

  return weekDays.flatMap((day) => {
    const morning = (entryMap.get(`${day.date}:MORNING`) || []).sort((left, right) => left.sort_order - right.sort_order);
    const afternoon = (entryMap.get(`${day.date}:AFTERNOON`) || []).sort((left, right) => left.sort_order - right.sort_order);

    const sessions: Array<{ session: DepartmentWeeklyScheduleSession; rows: EditableScheduleEntry[] }> = [
      { session: 'MORNING', rows: morning.length > 0 ? morning : [] },
      { session: 'AFTERNOON', rows: afternoon.length > 0 ? afternoon : [] },
    ];

    const sessionRowCounts = sessions.map(({ rows }) => Math.max(rows.length, 1));
    const totalRows = sessionRowCounts.reduce((sum, value) => sum + value, 0);
    let rowCursor = 0;

    return sessions.flatMap(({ session, rows }, sessionIndex) => {
      const safeRows = rows.length > 0 ? rows : [null];
      return safeRows.map((entry, rowIndex) => {
        const isFirstRowOfDay = rowCursor === 0;
        const isFirstRowOfSession = rowIndex === 0;
        const row = {
          day,
          session,
          sessionLabel: SESSION_LABELS[session],
          showDayCells: isFirstRowOfDay,
          dayRowSpan: totalRows,
          showSessionCell: isFirstRowOfSession,
          sessionRowSpan: sessionRowCounts[sessionIndex],
          workContent: entry ? entry.work_content : '',
          participantDisplay: entry ? buildParticipantDisplay(entry, employeesById) : '',
          location: entry ? entry.location : '',
        };
        rowCursor += 1;
        return row;
      });
    });
  });
};

const orderPreviewWeekDays = (
  weekDays: DepartmentWeeklyScheduleDay[],
  selectedWeek: { week_start_date: string; week_end_date: string } | null
): DepartmentWeeklyScheduleDay[] => {
  if (!selectedWeek || weekDays.length === 0) {
    return weekDays;
  }

  const today = toDateKey(new Date());
  if (today < selectedWeek.week_start_date || today > selectedWeek.week_end_date) {
    return weekDays;
  }

  const todayDay = weekDays.find((day) => day.date === today);
  if (!todayDay) {
    return weekDays;
  }

  const futureDays = weekDays.filter((day) => day.date > today);
  const pastDays = weekDays.filter((day) => day.date < today);
  return [todayDay, ...futureDays, ...pastDays];
};

export const DepartmentWeeklyScheduleManagement: React.FC<DepartmentWeeklyScheduleManagementProps> = ({
  departments,
  employees,
  currentUserId,
  canReadSchedules = false,
  canWriteSchedules = false,
  onNotify,
}) => {
  const currentYear = new Date().getFullYear();
  const [fallbackDepartments, setFallbackDepartments] = useState<Department[]>([]);
  const [fallbackEmployees, setFallbackEmployees] = useState<Employee[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState('');
  const [calendarDays, setCalendarDays] = useState<WorkCalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scheduleId, setScheduleId] = useState<string | number | null>(null);
  const [loadedSchedule, setLoadedSchedule] = useState<DepartmentWeeklySchedule | null>(null);
  const [editableEntries, setEditableEntries] = useState<EditableScheduleEntry[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<DepartmentWeeklyViewTab>('REGISTER');
  const availableDepartments = departments.length > 0 ? departments : fallbackDepartments;
  const availableEmployees = employees.length > 0 ? employees : fallbackEmployees;

  const departmentOptions = useMemo(
    () =>
      (availableDepartments || [])
        .slice()
        .sort((left, right) => `${left.dept_name}`.localeCompare(`${right.dept_name}`, 'vi'))
        .map((department) => ({
          value: String(department.id),
          label: department.dept_name,
          searchText: `${department.dept_code} ${department.dept_name}`,
        })),
    [availableDepartments]
  );

  const employeeOptions = useMemo(
    () =>
      (availableEmployees || [])
        .slice()
        .sort((left, right) => `${left.full_name || left.name || ''}`.localeCompare(`${right.full_name || right.name || ''}`, 'vi'))
        .map((employee) => ({
          value: String(employee.id),
          label: employee.full_name || employee.name || employee.username || employee.user_code || `#${employee.id}`,
          searchText: `${employee.user_code || ''} ${employee.full_name || employee.name || ''} ${employee.username || ''}`,
        })),
    [availableEmployees]
  );

  const employeesById = useMemo(() => {
    const next = new Map<string, Employee>();
    (availableEmployees || []).forEach((employee) => {
      next.set(String(employee.id), employee);
    });
    return next;
  }, [availableEmployees]);

  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);
  const weekOptions = useMemo(() => buildDepartmentWeekOptions(calendarDays), [calendarDays]);
  const selectedDepartment = useMemo(
    () => (availableDepartments || []).find((department) => String(department.id) === selectedDepartmentId) || null,
    [availableDepartments, selectedDepartmentId]
  );
  const selectedWeek = useMemo(
    () => weekOptions.find((option) => option.week_start_date === selectedWeekStartDate) || null,
    [weekOptions, selectedWeekStartDate]
  );
  const derivedWeekDays = useMemo(
    () => (selectedWeekStartDate ? buildWeekDays(selectedWeekStartDate, calendarDays, loadedSchedule?.days) : []),
    [calendarDays, loadedSchedule?.days, selectedWeekStartDate]
  );
  const orderedPreviewWeekDays = useMemo(
    () => orderPreviewWeekDays(derivedWeekDays, selectedWeek),
    [derivedWeekDays, selectedWeek]
  );
  const previewRows = useMemo(
    () => buildPreviewRows(orderedPreviewWeekDays, editableEntries, employeesById),
    [orderedPreviewWeekDays, editableEntries, employeesById]
  );
  const previewWeekHeading = selectedWeek
    ? `Tuần ${String(selectedWeek.week_number).padStart(2, '0')}-${selectedWeek.year}`
    : 'Chưa chọn tuần';

  useEffect(() => {
    if (!canReadSchedules) {
      return;
    }

    let cancelled = false;

    if (departments.length === 0) {
      fetchDepartments()
        .then((rows) => {
          if (!cancelled) {
            setFallbackDepartments(rows || []);
          }
        })
        .catch((error) => {
          if (!cancelled && !isRequestCanceledError(error)) {
            onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể tải danh sách phòng ban.');
          }
        });
    }

    if (employees.length === 0) {
      fetchEmployees()
        .then((rows) => {
          if (!cancelled) {
            setFallbackEmployees(rows || []);
          }
        })
        .catch((error) => {
          if (!cancelled && !isRequestCanceledError(error)) {
            onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể tải danh sách nhân sự.');
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [canReadSchedules, departments.length, employees.length, onNotify]);

  useEffect(() => {
    if (!selectedDepartmentId && departmentOptions.length > 0) {
      setSelectedDepartmentId(String(departmentOptions[0].value));
    }
  }, [departmentOptions, selectedDepartmentId]);

  useEffect(() => {
    if (!selectedDepartmentId || !selectedWeekStartDate) {
      setActiveViewTab('REGISTER');
      return;
    }

    setActiveViewTab(scheduleId ? 'SCHEDULE' : 'REGISTER');
  }, [scheduleId, selectedDepartmentId, selectedWeekStartDate]);

  useEffect(() => {
    let cancelled = false;
    setCalendarLoading(true);

    fetchMonthlyCalendars({ year: Number(selectedYear) })
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setCalendarDays(rows);
      })
      .catch((error) => {
        if (cancelled || isRequestCanceledError(error)) {
          return;
        }
        onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể tải dữ liệu lịch.');
        setCalendarDays([]);
      })
      .finally(() => {
        if (!cancelled) {
          setCalendarLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onNotify, selectedYear]);

  useEffect(() => {
    if (weekOptions.length === 0) {
      setSelectedWeekStartDate('');
      return;
    }

    if (selectedWeekStartDate && weekOptions.some((option) => option.week_start_date === selectedWeekStartDate)) {
      return;
    }

    const today = toDateKey(new Date());
    const matchingCurrentWeek = weekOptions.find((option) => option.week_start_date <= today && option.week_end_date >= today);
    setSelectedWeekStartDate(matchingCurrentWeek?.week_start_date || weekOptions[0].week_start_date);
  }, [selectedWeekStartDate, weekOptions]);

  useEffect(() => {
    if (!selectedDepartmentId || !selectedWeekStartDate || !canReadSchedules) {
      setLoadedSchedule(null);
      setScheduleId(null);
      setEditableEntries([]);
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);

    fetchDepartmentWeeklySchedules({
      department_id: selectedDepartmentId,
      week_start_date: selectedWeekStartDate,
    })
      .then((rows) => {
        if (cancelled) {
          return;
        }

        const schedule = rows[0] || null;
        setLoadedSchedule(schedule);
        setScheduleId(schedule?.id ?? null);
        setEditableEntries(hydrateEditableEntries(schedule));
      })
      .catch((error) => {
        if (cancelled || isRequestCanceledError(error)) {
          return;
        }
        onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể tải lịch tuần.');
        setLoadedSchedule(null);
        setScheduleId(null);
        setEditableEntries([]);
      })
      .finally(() => {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadSchedules, onNotify, selectedDepartmentId, selectedWeekStartDate]);

  const updateEntry = (localId: string, updater: (entry: EditableScheduleEntry) => EditableScheduleEntry) => {
    setEditableEntries((current) => current.map((entry) => (entry.local_id === localId ? updater(entry) : entry)));
  };

  const handleAddEntry = (calendarDate: string, session: DepartmentWeeklyScheduleSession) => {
    setEditableEntries((current) => {
      const sessionEntries = current.filter((entry) => entry.calendar_date === calendarDate && entry.session === session);
      const nextSortOrder = sessionEntries.length > 0
        ? Math.max(...sessionEntries.map((entry) => Number(entry.sort_order || 0))) + 10
        : 10;

      return [
        ...current,
        {
          local_id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          calendar_date: calendarDate,
          session,
          sort_order: nextSortOrder,
          work_content: '',
          location: '',
          participant_text: '',
          participant_user_ids: [],
        },
      ];
    });
  };

  const handleDeleteEntry = (localId: string) => {
    setEditableEntries((current) => current.filter((entry) => entry.local_id !== localId));
  };

  const groupedEditorEntries = useMemo(() => {
    const grouped = new Map<string, EditableScheduleEntry[]>();
    editableEntries.forEach((entry) => {
      const key = `${entry.calendar_date}:${entry.session}`;
      const bucket = grouped.get(key) || [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

    grouped.forEach((bucket) => {
      bucket.sort((left, right) => left.sort_order - right.sort_order);
    });

    return grouped;
  }, [editableEntries]);

  const buildPayload = () => {
    const meaningfulEntries = editableEntries.filter((entry) => {
      const hasWork = normalizeText(entry.work_content) !== '';
      const hasLocation = normalizeText(entry.location) !== '';
      const hasParticipantText = normalizeText(entry.participant_text) !== '';
      const hasParticipants = entry.participant_user_ids.length > 0;
      return hasWork || hasLocation || hasParticipantText || hasParticipants;
    });

    const invalidEntry = meaningfulEntries.find((entry) => normalizeText(entry.work_content) === '');
    if (invalidEntry) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Vui lòng nhập nội dung làm việc cho tất cả các dòng đã thêm.');
      return null;
    }

    return {
      id: scheduleId,
      department_id: selectedDepartmentId,
      week_start_date: selectedWeekStartDate,
      entries: meaningfulEntries
        .sort((left, right) =>
          `${left.calendar_date}-${left.session}-${String(left.sort_order).padStart(4, '0')}`.localeCompare(
            `${right.calendar_date}-${right.session}-${String(right.sort_order).padStart(4, '0')}`
          )
        )
        .map((entry, index) => ({
          id: entry.id ?? undefined,
          calendar_date: entry.calendar_date,
          session: entry.session,
          sort_order: Number(entry.sort_order || (index + 1) * 10),
          work_content: normalizeText(entry.work_content),
          location: normalizeText(entry.location) || null,
          participant_text: normalizeText(entry.participant_text) || null,
          participants: entry.participant_user_ids.map((userId, participantIndex) => ({
            user_id: userId,
            sort_order: (participantIndex + 1) * 10,
          })),
        })),
    };
  };

  const handleSave = async () => {
    if (!canWriteSchedules) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Bạn không có quyền cập nhật lịch làm việc đơn vị.');
      return;
    }

    if (!selectedDepartmentId || !selectedWeekStartDate) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Vui lòng chọn phòng ban và tuần làm việc.');
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      const actorIdToken = normalizeText(currentUserId);
      const actorId = actorIdToken !== '' && /^\d+$/.test(actorIdToken) ? Number(actorIdToken) : null;
      const saved = scheduleId
        ? await updateDepartmentWeeklySchedule(scheduleId, { ...payload, updated_by: actorId })
        : await createDepartmentWeeklySchedule({ ...payload, created_by: actorId, updated_by: actorId });

      setLoadedSchedule(saved);
      setScheduleId(saved.id ?? null);
      setEditableEntries(hydrateEditableEntries(saved));
      onNotify?.('success', 'Lịch làm việc đơn vị', scheduleId ? 'Đã cập nhật lịch tuần phòng ban.' : 'Đã tạo lịch tuần phòng ban.');
    } catch (error) {
      onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể lưu lịch tuần phòng ban.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!scheduleId || !canWriteSchedules) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('Bạn có chắc chắn muốn xóa lịch tuần hiện tại?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDepartmentWeeklySchedule(scheduleId);
      setLoadedSchedule(null);
      setScheduleId(null);
      setEditableEntries([]);
      onNotify?.('success', 'Lịch làm việc đơn vị', 'Đã xóa lịch tuần phòng ban.');
    } catch (error) {
      onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể xóa lịch tuần phòng ban.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canReadSchedules) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-800">
        Bạn chưa có quyền xem lịch làm việc đơn vị.
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <div className="sticky top-0 z-20 -mx-1 bg-bg-light/95 px-1 pb-1 pt-2 backdrop-blur-sm">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 lg:p-4.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Lịch làm việc đơn vị</h1>
                <p className="mt-1.5 text-sm text-slate-500 max-lg:pr-4">
                  Lập kế hoạch làm việc theo tuần cho từng phòng ban và xem trước đúng mẫu bảng thông báo.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!scheduleId || isDeleting || isSaving || !canWriteSchedules}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  {isDeleting ? 'Đang xóa...' : 'Xóa lịch tuần'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isDeleting || !canWriteSchedules}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSaving ? 'Đang lưu...' : scheduleId ? 'Cập nhật lịch tuần' : 'Lưu lịch tuần'}
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 p-4 lg:p-5">
            <div className="grid gap-2.5 xl:grid-cols-[1.6fr_0.9fr_1.15fr]">
              <SearchableSelect
                value={selectedDepartmentId}
                options={departmentOptions}
                onChange={setSelectedDepartmentId}
                label="Phòng ban"
                placeholder="Chọn phòng ban"
                searchPlaceholder="Tìm phòng ban..."
                compact
                usePortal
              />

              <SearchableSelect
                value={selectedYear}
                options={yearOptions}
                onChange={setSelectedYear}
                label="Năm"
                placeholder="Chọn năm"
                disabled={yearOptions.length <= 1}
                compact
                usePortal
              />

              <SearchableSelect
                value={selectedWeekStartDate}
                options={weekOptions.map((option) => ({
                  value: option.week_start_date,
                  label: option.label,
                  searchText: `${option.label} ${option.week_start_date}`,
                }))}
                onChange={setSelectedWeekStartDate}
                label="Tuần"
                placeholder={calendarLoading ? 'Đang tải tuần...' : 'Chọn tuần'}
                disabled={calendarLoading || weekOptions.length === 0}
                searchPlaceholder="Tìm tuần..."
                compact
                usePortal
              />
            </div>

            <div className="mt-2.5 flex justify-end">
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Chế độ lịch làm việc đơn vị">
                {([
                  { key: 'SCHEDULE', label: 'Lịch làm việc', icon: 'calendar_month' },
                  { key: 'REGISTER', label: 'Đăng ký lịch làm việc', icon: 'edit_calendar' },
                ] as const).map((tab) => {
                  const isActive = activeViewTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveViewTab(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeViewTab === 'REGISTER' ? (
        <div className="max-h-[calc(100vh-300px)] space-y-3 overflow-auto pr-1">
          {derivedWeekDays.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Chọn phòng ban và tuần để bắt đầu nhập lịch làm việc.
            </div>
          ) : (
            derivedWeekDays.map((day) => (
              <div key={day.date} className="rounded-[26px] border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="mb-2.5 flex flex-col gap-2 border-b border-slate-100 pb-2.5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-900">
                      {DAY_NAMES[day.day_of_week] || day.day_name} - {String(day.day).padStart(2, '0')}/{String(day.month).padStart(2, '0')}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {day.is_holiday && day.holiday_name ? day.holiday_name : day.is_working_day ? 'Ngày làm việc' : 'Cuối tuần'}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    day.is_holiday
                      ? 'bg-rose-100 text-rose-700'
                      : day.is_working_day
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {day.is_holiday ? 'Ngày lễ' : day.is_working_day ? 'Trong tuần' : 'Cuối tuần'}
                  </span>
                </div>

                <div className="grid gap-2.5 xl:grid-cols-2">
                  {(['MORNING', 'AFTERNOON'] as DepartmentWeeklyScheduleSession[]).map((session) => {
                    const rows = groupedEditorEntries.get(`${day.date}:${session}`) || [];
                    return (
                      <div key={`${day.date}-${session}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-[16px] font-semibold text-slate-900">{SESSION_LABELS[session]}</h3>
                            <p className="text-[11px] text-slate-500">Mỗi buổi có thể thêm nhiều dòng công việc.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddEntry(day.date, session)}
                            disabled={!canWriteSchedules}
                            className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                            Thêm dòng
                          </button>
                        </div>

                        {rows.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-400">
                            Chưa có nội dung cho buổi {SESSION_LABELS[session].toLowerCase()}.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {rows.map((entry, index) => (
                              <div key={entry.local_id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    Dòng #{index + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(entry.local_id)}
                                    disabled={!canWriteSchedules}
                                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                    Xóa dòng
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  <label className="block">
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Nội dung làm việc *</span>
                                    <textarea
                                      value={entry.work_content}
                                      onChange={(event) =>
                                        updateEntry(entry.local_id, (current) => ({ ...current, work_content: event.target.value }))
                                      }
                                      rows={3}
                                      disabled={!canWriteSchedules}
                                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                      placeholder="Mô tả nội dung làm việc trong buổi này"
                                    />
                                  </label>

                                  <div className="grid gap-3 lg:grid-cols-2">
                                    <SearchableMultiSelect
                                      values={entry.participant_user_ids}
                                      options={employeeOptions}
                                      onChange={(values) =>
                                        updateEntry(entry.local_id, (current) => ({
                                          ...current,
                                          participant_user_ids: values,
                                        }))
                                      }
                                      label="Thành phần (nhân sự hệ thống)"
                                      placeholder="Chọn nhân sự tham gia"
                                      searchPlaceholder="Tìm nhân sự..."
                                      disabled={!canWriteSchedules}
                                    />

                                    <label className="block">
                                      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Thành phần tự do</span>
                                      <input
                                        type="text"
                                        value={entry.participant_text}
                                        onChange={(event) =>
                                        updateEntry(entry.local_id, (current) => ({ ...current, participant_text: event.target.value }))
                                      }
                                      disabled={!canWriteSchedules}
                                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                      placeholder="Ví dụ: Cộng tác viên, khách mời..."
                                    />
                                  </label>
                                  </div>

                                  <label className="block">
                                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Địa điểm</span>
                                    <input
                                      type="text"
                                      value={entry.location}
                                      onChange={(event) =>
                                        updateEntry(entry.local_id, (current) => ({ ...current, location: event.target.value }))
                                      }
                                      disabled={!canWriteSchedules}
                                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                      placeholder="Nhập địa điểm làm việc"
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="w-full overflow-hidden rounded-[28px] border-[2.5px] border-slate-900 bg-white">
            <div className="border-b-2 border-slate-900 px-4 py-3 text-center">
              <div className="flex flex-col items-center justify-center gap-0.5">
                <p className="text-[18px] font-black uppercase leading-tight text-slate-900 max-md:text-[16px]">
                  {selectedDepartment?.dept_name || 'Phòng ban'}
                </p>
                <p className="text-[12px] font-black italic leading-tight text-slate-900 max-md:text-[11px]">
                  {previewWeekHeading}
                  {selectedWeek ? `: (${formatDisplayDate(selectedWeek.week_start_date)} - ${formatDisplayDate(selectedWeek.week_end_date)})` : ''}
                </p>
              </div>
            </div>
            <div className="max-h-[calc(100vh-300px)] overflow-auto">
              <table className="w-full table-fixed border-collapse text-slate-900">
                <colgroup>
                  <col className="w-[8.5%]" />
                  <col className="w-[8.5%]" />
                  <col className="w-[7.5%]" />
                  <col className="w-[35%]" />
                  <col className="w-[22%]" />
                  <col className="w-[18.5%]" />
                </colgroup>
                <thead>
                  <tr className="sticky top-0 z-10 bg-primary text-white">
                    {['Thứ', 'Ngày', 'Buổi', 'Nội dung làm việc', 'Thành phần', 'Địa điểm'].map((header) => (
                      <th key={header} className="border-2 border-slate-900 px-2 py-2 text-center text-[14px] font-bold tracking-[0.01em] md:text-[15px]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border-2 border-slate-900 px-6 py-6 text-center text-sm text-slate-500">
                        Chưa có dữ liệu để xem trước.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, index) => {
                      const isToday = row.day.date === toDateKey(new Date());
                      return (
                      <tr key={`${row.day.date}-${row.session}-${index}`} className="align-top">
                        {row.showDayCells ? (
                          <>
                            <td rowSpan={row.dayRowSpan} className={`align-middle border-2 border-slate-900 px-2 py-2.5 text-center text-[14px] font-bold md:text-[15px] ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
                              {PREVIEW_DAY_NAMES[row.day.day_of_week] || row.day.day_name}
                            </td>
                            <td rowSpan={row.dayRowSpan} className={`align-middle border-2 border-slate-900 px-2 py-2.5 text-center text-[14px] font-bold md:text-[15px] ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span>{String(row.day.day).padStart(2, '0')}/{String(row.day.month).padStart(2, '0')}</span>
                                {isToday ? (
                                  <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em] text-white">
                                    Hôm nay
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </>
                        ) : null}

                        {row.showSessionCell ? (
                          <td rowSpan={row.sessionRowSpan} className={`align-middle border-2 border-slate-900 px-2 py-2.5 text-center text-[14px] font-bold md:text-[15px] ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
                            {row.sessionLabel}
                          </td>
                        ) : null}

                        <td className="border-2 border-slate-900 px-2.5 py-2 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                          {normalizeText(row.workContent) || '-'}
                        </td>
                        <td className="border-2 border-slate-900 px-2.5 py-2 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                          {normalizeText(row.participantDisplay) || '-'}
                        </td>
                        <td className="border-2 border-slate-900 px-2.5 py-2 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                          {normalizeText(row.location) || '-'}
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
