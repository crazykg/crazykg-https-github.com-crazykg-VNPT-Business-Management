import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDepartments,
} from '../services/api/departmentApi';
import {
  fetchEmployees,
} from '../services/api/employeeApi';
import {
  buildDepartmentWeekOptions,
  createDepartmentWeeklySchedule,
  deleteDepartmentWeeklyScheduleEntry,
  fetchDepartmentWeeklySchedules,
  fetchMonthlyCalendars,
  updateDepartmentWeeklySchedule,
} from '../services/api/supportConfigApi';
import { isRequestCanceledError } from '../services/v5Api';
import type {
  DepartmentWeeklySchedule,
  DepartmentWeeklyScheduleDay,
  DepartmentWeeklyScheduleSession,
  WorkCalendarDay,
} from '../types/scheduling';
import type { Department } from '../types/department';
import type { Employee } from '../types/employee';
import { getEmployeeLabel } from '../utils/employeeDisplay';
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
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  created_by_name?: string | null;
  updated_by?: string | number | null;
  updated_by_name?: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  is_locked?: boolean;
};

interface DepartmentWeeklyScheduleManagementProps {
  departments: Department[];
  employees: Employee[];
  currentUserId?: string | number | null;
  currentUserDepartmentId?: string | number | null;
  isAdminViewer?: boolean;
  canReadSchedules?: boolean;
  canWriteSchedules?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

type DepartmentWeeklyViewTab = 'SCHEDULE' | 'REGISTER';

const SESSION_LABELS: Record<DepartmentWeeklyScheduleSession, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
};

const SESSION_CARD_TITLES: Record<DepartmentWeeklyScheduleSession, string> = {
  MORNING: 'Buổi sáng',
  AFTERNOON: 'Buổi chiều',
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

const COMPACT_PREVIEW_BREAKPOINT = 1024;
const COMPACT_REGISTER_BREAKPOINT = 1024;
const COMPACT_SCOPE_BREAKPOINT = 1024;
const DEFAULT_VIEWPORT_WIDTH = 1440;

const VIEW_TAB_META: Array<{
  id: DepartmentWeeklyViewTab;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'SCHEDULE',
    label: 'Bảng thông báo',
    description: 'Xem trước lịch tuần theo đúng bố cục thông báo nội bộ.',
    icon: 'table_chart',
  },
  {
    id: 'REGISTER',
    label: 'Đăng ký nhanh',
    description: 'Nhập và cập nhật từng dòng công việc trực tiếp theo từng buổi.',
    icon: 'edit_note',
  },
];

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeId = (value: unknown): string => normalizeText(value);
const getViewportWidth = (): number => (typeof window !== 'undefined' ? window.innerWidth : DEFAULT_VIEWPORT_WIDTH);

const compactMultiSelectTriggerClass =
  '!h-8 !min-h-0 !rounded !border !border-slate-200 !bg-white !px-3 !py-0 !text-sm shadow-none';
const compactToolbarSelectTriggerClass =
  '!h-9 !rounded-xl !border-slate-200 !bg-white !px-3 shadow-sm';
const scheduleEntryModalDropdownZIndex = 10020;
const compactScopeSheetDropdownZIndex = 10030;

const compactParticipantSummary = (selectedOptions: Array<{ label: string }>): string => {
  const displayNames = selectedOptions
    .map((option) => {
      const label = normalizeText(option.label);
      const separatorIndex = label.indexOf(' - ');
      return separatorIndex >= 0 ? label.slice(separatorIndex + 3) : label;
    })
    .filter((value) => value !== '');

  if (displayNames.length === 0) {
    return 'Chọn nhân sự tham gia';
  }

  if (displayNames.length === 1) {
    return displayNames[0];
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]}, ${displayNames[1]}`;
  }

  return `${displayNames[0]}, ${displayNames[1]} +${displayNames.length - 2}`;
};

const isEntryMeaningful = (entry: EditableScheduleEntry): boolean => {
  const hasWork = normalizeText(entry.work_content) !== '';
  const hasLocation = normalizeText(entry.location) !== '';
  const hasParticipantText = normalizeText(entry.participant_text) !== '';
  const hasParticipants = entry.participant_user_ids.length > 0;
  return hasWork || hasLocation || hasParticipantText || hasParticipants;
};

const buildDraftScheduleEntry = (
  entries: EditableScheduleEntry[],
  calendarDate: string,
  session: DepartmentWeeklyScheduleSession
): EditableScheduleEntry => {
  const sessionEntries = entries.filter((entry) => entry.calendar_date === calendarDate && entry.session === session);
  const nextSortOrder = sessionEntries.length > 0
    ? Math.max(...sessionEntries.map((entry) => Number(entry.sort_order || 0))) + 10
    : 10;

  return {
    local_id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    calendar_date: calendarDate,
    session,
    sort_order: nextSortOrder,
    work_content: '',
    location: '',
    participant_text: '',
    participant_user_ids: [],
  };
};

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

const formatDisplayDateTime = (value: string | null | undefined): string => {
  const text = normalizeText(value);
  if (!text) {
    return '--';
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isScheduleSlotPast = (
  calendarDate: string,
  session: DepartmentWeeklyScheduleSession,
  now: Date = new Date()
): boolean => {
  const today = toDateKey(now);
  if (calendarDate < today) {
    return true;
  }

  if (calendarDate > today) {
    return false;
  }

  const cutoffHour = session === 'MORNING' ? 12 : 18;
  return now.getHours() >= cutoffHour;
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
    created_at: entry.created_at ?? null,
    updated_at: entry.updated_at ?? null,
    created_by: entry.created_by ?? null,
    created_by_name: entry.created_by_name ?? null,
    updated_by: entry.updated_by ?? null,
    updated_by_name: entry.updated_by_name ?? null,
    can_edit: Boolean(entry.can_edit),
    can_delete: Boolean(entry.can_delete),
    is_locked: Boolean(entry.is_locked),
  }));

const buildParticipantLines = (entry: EditableScheduleEntry, employeesById: Map<string, Employee>): string[] => {
  const names = entry.participant_user_ids
    .map((userId) => employeesById.get(userId))
    .filter(Boolean)
    .map((employee) => getEmployeeLabel(employee))
    .filter((value) => normalizeText(value) !== '');
  const freeText = normalizeText(entry.participant_text);
  const freeTextLines = freeText
    ? freeText
      .split(/\r?\n/)
      .map((value) => normalizeText(value))
      .filter((value) => value !== '')
    : [];

  return [...names, ...freeTextLines];
};

const buildParticipantDisplay = (entry: EditableScheduleEntry, employeesById: Map<string, Employee>): string => {
  return buildParticipantLines(entry, employeesById).join(', ');
};

const hasEntryBeenUpdated = (entry: EditableScheduleEntry): boolean => {
  const createdAt = normalizeText(entry.created_at);
  const updatedAt = normalizeText(entry.updated_at);

  return createdAt !== '' && updatedAt !== '' && createdAt !== updatedAt;
};

const resolveEntryCreatorDisplay = (entry: EditableScheduleEntry, employeesById: Map<string, Employee>): string => {
  if (hasEntryBeenUpdated(entry)) {
    const explicitUpdatedName = normalizeText(entry.updated_by_name);
    if (explicitUpdatedName) {
      return explicitUpdatedName;
    }

    const updatedById = normalizeId(entry.updated_by);
    if (updatedById) {
      const updater = employeesById.get(updatedById);
      if (updater) {
        return getEmployeeLabel(updater) || `#${updatedById}`;
      }
    }
  }

  const explicitName = normalizeText(entry.created_by_name);
  if (explicitName) {
    return explicitName;
  }

  const creatorId = normalizeId(entry.created_by);
  if (!creatorId) {
    return '--';
  }

  const creator = employeesById.get(creatorId);
  return getEmployeeLabel(creator) || `#${creatorId}`;
};

const resolveEntryAuditDateDisplay = (entry: EditableScheduleEntry): string => {
  if (hasEntryBeenUpdated(entry)) {
    const updatedAt = normalizeText(entry.updated_at);
    return formatDisplayDateTime(updatedAt);
  }

  return formatDisplayDateTime(entry.created_at);
};

const resolveEntryAuditLabels = (entry: EditableScheduleEntry): { actor: string; time: string } =>
  hasEntryBeenUpdated(entry)
    ? { actor: 'Cập nhật', time: 'ngày' }
    : { actor: 'Đăng ký', time: 'ngày' };

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
          createdByDisplay: entry ? resolveEntryCreatorDisplay(entry, employeesById) : '',
          createdAtDisplay: entry ? resolveEntryAuditDateDisplay(entry) : '',
          auditLabels: entry ? resolveEntryAuditLabels(entry) : { actor: 'Đăng ký', time: 'ngày' },
          hasAudit: Boolean(entry && (normalizeText(entry.work_content) !== '' || normalizeText(entry.location) !== '' || normalizeText(buildParticipantDisplay(entry, employeesById)) !== '') && (normalizeText(resolveEntryCreatorDisplay(entry, employeesById)) !== '--' || normalizeText(entry.created_at) !== '' || normalizeText(entry.updated_at) !== '')),
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

const resolvePreferredCompactDayKey = (weekDays: DepartmentWeeklyScheduleDay[]): string => {
  if (weekDays.length === 0) {
    return '';
  }

  const today = toDateKey(new Date());
  return weekDays.find((day) => day.date === today)?.date ?? weekDays[0].date;
};

const buildCompactDayHelperText = ({
  isExpanded,
  totalEntries,
  holidayName,
}: {
  isExpanded: boolean;
  totalEntries: number;
  holidayName?: string | null;
}): string => {
  const normalizedHolidayName = normalizeText(holidayName);
  const baseText = totalEntries === 0
    ? (isExpanded ? 'Chọn buổi bên dưới để thêm lịch.' : 'Chưa có lịch theo buổi.')
    : (isExpanded ? 'Đang hiển thị chi tiết theo từng buổi.' : 'Nhấn nút bên phải để mở chi tiết theo từng buổi.');

  return normalizedHolidayName ? `${normalizedHolidayName} · ${baseText}` : baseText;
};

const buildCompactSessionCountLabel = (count: number): string => (count === 0 ? 'Trống' : `${count} dòng`);

export const DepartmentWeeklyScheduleManagement: React.FC<DepartmentWeeklyScheduleManagementProps> = ({
  departments,
  employees,
  currentUserId,
  currentUserDepartmentId,
  isAdminViewer = false,
  canReadSchedules = false,
  canWriteSchedules = false,
  onNotify,
}) => {
  const currentYear = new Date().getFullYear();
  const [fallbackDepartments, setFallbackDepartments] = useState<Department[]>([]);
  const [fallbackEmployees, setFallbackEmployees] = useState<Employee[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const selectedYear = String(currentYear);
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState('');
  const [calendarDays, setCalendarDays] = useState<WorkCalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingEntryIds, setSavingEntryIds] = useState<string[]>([]);
  const [deletingEntryIds, setDeletingEntryIds] = useState<string[]>([]);
  const [scheduleId, setScheduleId] = useState<string | number | null>(null);
  const [loadedSchedule, setLoadedSchedule] = useState<DepartmentWeeklySchedule | null>(null);
  const [editableEntries, setEditableEntries] = useState<EditableScheduleEntry[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<DepartmentWeeklyViewTab>('SCHEDULE');
  const [viewportWidth, setViewportWidth] = useState<number>(getViewportWidth);
  const [isCompactScopeSheetOpen, setIsCompactScopeSheetOpen] = useState(false);
  const [expandedCompactDayKey, setExpandedCompactDayKey] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<{
    calendarDate: string;
    session: DepartmentWeeklyScheduleSession;
  } | null>(null);
  const availableDepartments = departments.length > 0 ? departments : fallbackDepartments;
  const availableEmployees = employees.length > 0 ? employees : fallbackEmployees;
  const normalizedCurrentDepartmentId = normalizeId(currentUserDepartmentId);
  const isDepartmentScopeLocked = !isAdminViewer && normalizedCurrentDepartmentId !== '';
  const currentDepartment = useMemo(
    () => (availableDepartments || []).find((department) => String(department.id) === normalizedCurrentDepartmentId) || null,
    [availableDepartments, normalizedCurrentDepartmentId]
  );
  const lockedDepartmentLabel = currentDepartment?.dept_name
    || normalizeText(loadedSchedule?.department_name)
    || 'Đơn vị hiện tại';

  const departmentOptions = useMemo(
    () => {
      if (isDepartmentScopeLocked) {
        return normalizedCurrentDepartmentId
          ? [{
              value: normalizedCurrentDepartmentId,
              label: lockedDepartmentLabel,
              searchText: lockedDepartmentLabel,
            }]
          : [];
      }

      return (availableDepartments || [])
        .slice()
        .sort((left, right) => `${left.dept_name}`.localeCompare(`${right.dept_name}`, 'vi'))
        .map((department) => ({
          value: String(department.id),
          label: department.dept_name,
          searchText: `${department.dept_code} ${department.dept_name}`,
        }));
    },
    [availableDepartments, isDepartmentScopeLocked, lockedDepartmentLabel, normalizedCurrentDepartmentId]
  );

  const employeeOptions = useMemo(
    () =>
      (availableEmployees || [])
        .slice()
        .sort((left, right) => `${left.full_name || left.username || ''}`.localeCompare(`${right.full_name || right.username || ''}`, 'vi'))
        .map((employee) => ({
          value: String(employee.id),
          label: getEmployeeLabel(employee) || `#${employee.id}`,
          searchText: `${employee.user_code || ''} ${employee.full_name || ''} ${employee.username || ''}`,
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

  const weekOptions = useMemo(() => buildDepartmentWeekOptions(calendarDays), [calendarDays]);
  const selectedDepartment = useMemo(
    () => (availableDepartments || []).find((department) => String(department.id) === selectedDepartmentId) || null,
    [availableDepartments, selectedDepartmentId]
  );
  const defaultDepartmentId = useMemo(() => {
    if (isDepartmentScopeLocked) {
      return normalizedCurrentDepartmentId;
    }

    const currentDepartmentToken = normalizeId(currentUserDepartmentId);
    if (!currentDepartmentToken) {
      return '';
    }

    const exists = (availableDepartments || []).some((department) => String(department.id) === currentDepartmentToken);
    return exists ? currentDepartmentToken : '';
  }, [availableDepartments, currentUserDepartmentId, isDepartmentScopeLocked, normalizedCurrentDepartmentId]);
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
  const normalizedCurrentUserId = normalizeText(currentUserId);
  const actorId = normalizedCurrentUserId !== '' && /^\d+$/.test(normalizedCurrentUserId) ? Number(normalizedCurrentUserId) : null;
  const hasPendingEntrySave = savingEntryIds.length > 0;
  const hasPendingEntryDeletion = deletingEntryIds.length > 0;
  const hasSelectedScope = Boolean(selectedDepartmentId && selectedWeekStartDate);
  const useCompactPreviewLayout = viewportWidth < COMPACT_PREVIEW_BREAKPOINT;
  const useCompactRegisterLayout = viewportWidth < COMPACT_REGISTER_BREAKPOINT;
  const useCompactScopeLayout = viewportWidth < COMPACT_SCOPE_BREAKPOINT;
  const selectedDepartmentLabel = departmentOptions.find((option) => String(option.value) === selectedDepartmentId)?.label
    || selectedDepartment?.dept_name
    || normalizeText(loadedSchedule?.department_name)
    || (isDepartmentScopeLocked ? 'Đơn vị hiện tại' : 'Chưa chọn phòng ban');
  const selectedWeekLabel = selectedWeek
    ? `Tuần ${String(selectedWeek.week_number).padStart(2, '0')}`
    : 'Chưa chọn tuần';
  const compactActionLabel = isSaving ? 'Đang lưu' : scheduleId ? 'Lưu tuần' : 'Tạo lịch';
  const desktopActionLabel = isSaving ? 'Đang lưu tuần...' : scheduleId ? 'Lưu thay đổi tuần' : 'Tạo lịch tuần';
  const compactActiveDays = activeViewTab === 'REGISTER' ? derivedWeekDays : orderedPreviewWeekDays;
  const canPersistWeek = canWriteSchedules
    && hasSelectedScope
    && editableEntries.some((entry) => isEntryMeaningful(entry) && (!entry.id || Boolean(entry.can_edit)))
    && !isSaving
    && !hasPendingEntryDeletion
    && !hasPendingEntrySave;

  const handleOpenCompactScopeSheet = () => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        setIsCompactScopeSheetOpen(true);
      });
      return;
    }

    setIsCompactScopeSheetOpen(true);
  };

  const canCreateEntryForSlot = (
    calendarDate: string,
    session: DepartmentWeeklyScheduleSession
  ): boolean => canWriteSchedules && !isScheduleSlotPast(calendarDate, session);

  const canEditEntry = (entry: EditableScheduleEntry): boolean => {
    if (!canWriteSchedules) {
      return false;
    }

    if (!entry.id) {
      return !isScheduleSlotPast(entry.calendar_date, entry.session);
    }

    return Boolean(entry.can_edit);
  };

  const getEntryRestrictionMessage = (entry: EditableScheduleEntry): string | null => {
    if (entry.id && entry.is_locked) {
      return 'Lịch làm việc đã qua không thể chỉnh sửa hoặc xóa.';
    }

    if (entry.id && !entry.can_edit) {
      return 'Chỉ người đăng ký hoặc admin mới được chỉnh sửa.';
    }

    if (!entry.id && isScheduleSlotPast(entry.calendar_date, entry.session)) {
      return 'Buổi làm việc đã qua, không thể đăng ký mới.';
    }

    return null;
  };

  const canDeleteEntry = (entry: EditableScheduleEntry): boolean => {
    if (!canWriteSchedules) {
      return false;
    }

    if (!entry.id) {
      return true;
    }

    return Boolean(entry.can_delete);
  };

  const getAllEntriesForSlot = (
    calendarDate: string,
    session: DepartmentWeeklyScheduleSession
  ): EditableScheduleEntry[] => {
    return editableEntries
      .filter((entry) => entry.calendar_date === calendarDate && entry.session === session)
      .sort((left, right) => left.sort_order - right.sort_order);
  };

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
    if (isDepartmentScopeLocked && normalizedCurrentDepartmentId && selectedDepartmentId !== normalizedCurrentDepartmentId) {
      setSelectedDepartmentId(normalizedCurrentDepartmentId);
      return;
    }

    if (selectedDepartmentId) {
      return;
    }

    if (defaultDepartmentId) {
      setSelectedDepartmentId(defaultDepartmentId);
      return;
    }

    if (departmentOptions.length > 0) {
      setSelectedDepartmentId(String(departmentOptions[0].value));
    }
  }, [defaultDepartmentId, departmentOptions, isDepartmentScopeLocked, normalizedCurrentDepartmentId, selectedDepartmentId]);

  useEffect(() => {
    if (!selectedDepartmentId || !selectedWeekStartDate) {
      setActiveViewTab('SCHEDULE');
    }
  }, [selectedDepartmentId, selectedWeekStartDate]);

  useEffect(() => {
    setEditingSlot(null);
  }, [selectedDepartmentId, selectedWeekStartDate, activeViewTab]);

  useEffect(() => {
    if (!useCompactScopeLayout && isCompactScopeSheetOpen) {
      setIsCompactScopeSheetOpen(false);
    }
  }, [isCompactScopeSheetOpen, useCompactScopeLayout]);

  useEffect(() => {
    if (!editingSlot) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseEditor();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingSlot, handleCloseEditor]);

  useEffect(() => {
    if (!isCompactScopeSheetOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCompactScopeSheetOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isCompactScopeSheetOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (compactActiveDays.length === 0) {
      setExpandedCompactDayKey(null);
      return;
    }

    if (expandedCompactDayKey === null) {
      setExpandedCompactDayKey(resolvePreferredCompactDayKey(compactActiveDays));
      return;
    }

    if (expandedCompactDayKey === '') {
      return;
    }

    if (compactActiveDays.some((day) => day.date === expandedCompactDayKey)) {
      return;
    }

    setExpandedCompactDayKey(resolvePreferredCompactDayKey(compactActiveDays));
  }, [compactActiveDays, expandedCompactDayKey]);

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
    if (!canCreateEntryForSlot(calendarDate, session)) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Buổi làm việc đã qua, không thể đăng ký mới.');
      return;
    }

    setEditableEntries((current) => [...current, buildDraftScheduleEntry(current, calendarDate, session)]);
  };

  function handleOpenSlotEditor(calendarDate: string, session: DepartmentWeeklyScheduleSession) {
    if (!canWriteSchedules) {
      return;
    }

    setEditableEntries((current) => {
      const slotEntries = current.filter((entry) => entry.calendar_date === calendarDate && entry.session === session);
      const hasDraft = slotEntries.some((entry) => !entry.id);
      const hasRegisteredEntry = slotEntries.some((entry) => Boolean(entry.id));
      const shouldAddDraft = !hasDraft && !hasRegisteredEntry && canCreateEntryForSlot(calendarDate, session);
      return shouldAddDraft ? [...current, buildDraftScheduleEntry(current, calendarDate, session)] : current;
    });
    setEditingSlot({ calendarDate, session });
  }

  function handleCloseEditor() {
    if (!editingSlot) {
      return;
    }

    const { calendarDate, session } = editingSlot;
    setEditableEntries((current) =>
      current.filter((entry) => {
        const isCurrentSlot = entry.calendar_date === calendarDate && entry.session === session;
        if (!isCurrentSlot || entry.id) {
          return true;
        }

        return isEntryMeaningful(entry);
      })
    );
    setEditingSlot(null);
  }

  const handleDeleteEntry = async (entry: EditableScheduleEntry) => {
    if (isSaving) {
      return;
    }

    if (!entry.id) {
      setEditableEntries((current) => current.filter((row) => row.local_id !== entry.local_id));
      return;
    }

    if (!scheduleId || !canDeleteEntry(entry)) {
      onNotify?.('error', 'Lịch làm việc đơn vị', getEntryRestrictionMessage(entry) || 'Chỉ người đăng ký hoặc admin mới được xóa dòng này.');
      return;
    }

    if (deletingEntryIds.includes(entry.local_id)) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm('Bạn có chắc chắn muốn xóa dòng lịch làm việc này?')) {
      return;
    }

    setDeletingEntryIds((current) => [...current, entry.local_id]);
    try {
      await deleteDepartmentWeeklyScheduleEntry(scheduleId, entry.id, actorId);
      setEditableEntries((current) => current.filter((row) => row.local_id !== entry.local_id));
      setLoadedSchedule((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          entries: (current.entries || []).filter((row) => normalizeId(row.id) !== normalizeId(entry.id)),
        };
      });
      onNotify?.('success', 'Lịch làm việc đơn vị', 'Đã xóa dòng lịch làm việc.');
    } catch (error) {
      onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể xóa dòng lịch làm việc.');
    } finally {
      setDeletingEntryIds((current) => current.filter((value) => value !== entry.local_id));
    }
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

  const getCompactDayStats = (calendarDate: string) => {
    const dayEntries = editableEntries.filter((entry) => entry.calendar_date === calendarDate && isEntryMeaningful(entry));
    const sessionCount = new Set(dayEntries.map((entry) => entry.session)).size;

    return {
      totalEntries: dayEntries.length,
      sessionCount,
    };
  };

  const toggleCompactDay = (calendarDate: string) => {
    setExpandedCompactDayKey((current) => (current === calendarDate ? '' : calendarDate));
  };

  const buildPayload = (sourceEntries: EditableScheduleEntry[] = editableEntries) => {
    const meaningfulEntries = sourceEntries.filter((entry) => isEntryMeaningful(entry));

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

  const findPersistedEntry = (
    schedule: DepartmentWeeklySchedule,
    sourceEntry: EditableScheduleEntry
  ) => {
    const entries = schedule.entries || [];
    const sourceId = normalizeId(sourceEntry.id);
    if (sourceId) {
      return entries.find((entry) => normalizeId(entry.id) === sourceId) || null;
    }

    const participantIds = [...sourceEntry.participant_user_ids].sort().join('|');
    return (
      entries.find((entry) => {
        const targetParticipantIds = (entry.participants || [])
          .map((participant) => normalizeId(participant.user_id))
          .filter((value) => value !== '')
          .sort()
          .join('|');

        return (
          normalizeText(entry.calendar_date) === normalizeText(sourceEntry.calendar_date) &&
          normalizeText(entry.session) === normalizeText(sourceEntry.session) &&
          Number(entry.sort_order ?? 0) === Number(sourceEntry.sort_order ?? 0) &&
          normalizeText(entry.work_content) === normalizeText(sourceEntry.work_content) &&
          normalizeText(entry.location) === normalizeText(sourceEntry.location) &&
          normalizeText(entry.participant_text) === normalizeText(sourceEntry.participant_text) &&
          targetParticipantIds === participantIds
        );
      }) || null
    );
  };

  const handleSaveEntry = async (entry: EditableScheduleEntry) => {
    if (!canWriteSchedules) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Bạn không có quyền cập nhật lịch làm việc đơn vị.');
      return;
    }

    if (!canEditEntry(entry)) {
      onNotify?.('error', 'Lịch làm việc đơn vị', getEntryRestrictionMessage(entry) || 'Bạn không thể cập nhật dòng lịch này.');
      return;
    }

    if (!selectedDepartmentId || !selectedWeekStartDate) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Vui lòng chọn phòng ban và tuần làm việc.');
      return;
    }

    if (isSaving || deletingEntryIds.includes(entry.local_id) || savingEntryIds.includes(entry.local_id)) {
      return;
    }

    const payload = buildPayload([entry]);
    if (!payload || payload.entries.length === 0) {
      onNotify?.('error', 'Lịch làm việc đơn vị', 'Vui lòng nhập đầy đủ thông tin cho dòng cần cập nhật.');
      return;
    }

    setSavingEntryIds((current) => [...current, entry.local_id]);
    try {
      const saved = scheduleId
        ? await updateDepartmentWeeklySchedule(scheduleId, { ...payload, updated_by: actorId })
        : await createDepartmentWeeklySchedule({ ...payload, created_by: actorId, updated_by: actorId });

      const persistedEntry = findPersistedEntry(saved, entry);
      const hydratedPersistedEntry = persistedEntry ? hydrateEditableEntries({ ...saved, entries: [persistedEntry] } as DepartmentWeeklySchedule)[0] : null;

      setLoadedSchedule(saved);
      setScheduleId(saved.id ?? null);
      if (hydratedPersistedEntry) {
        setEditableEntries((current) =>
          current.map((currentEntry) =>
            currentEntry.local_id === entry.local_id
              ? hydratedPersistedEntry
              : currentEntry
          )
        );
      }

      onNotify?.('success', 'Lịch làm việc đơn vị', entry.id ? 'Đã cập nhật dòng lịch làm việc.' : 'Đã tạo dòng lịch làm việc.');
    } catch (error) {
      onNotify?.('error', 'Lịch làm việc đơn vị', error instanceof Error ? error.message : 'Không thể cập nhật dòng lịch làm việc.');
    } finally {
      setSavingEntryIds((current) => current.filter((value) => value !== entry.local_id));
    }
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

    const payload = buildPayload(editableEntries.filter((entry) => !entry.id || canEditEntry(entry)));
    if (!payload) {
      return;
    }

    if (isSaving || hasPendingEntryDeletion || hasPendingEntrySave) {
      return;
    }

    setIsSaving(true);
    try {
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

  if (!canReadSchedules) {
    return (
      <div className="rounded-lg border border-tertiary-fixed bg-tertiary-fixed text-tertiary p-4 text-sm">
        Bạn chưa có quyền xem lịch làm việc đơn vị.
      </div>
    );
  }

  return (
    <div className="space-y-3 px-2.5 pb-6 sm:px-3">
      <div
        data-testid="department-weekly-schedule-sticky-shell"
        className="-mx-2.5 sticky top-0 z-30 bg-bg-light px-2.5 pb-2 pt-2 sm:-mx-3 sm:px-3 sm:pb-2.5 lg:pb-3"
      >
        <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/70 to-slate-100/60 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="p-2.5 sm:p-3">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary/15 sm:h-9 sm:w-9">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>calendar_month</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold leading-tight text-deep-teal sm:text-[15px]">Lịch làm việc đơn vị</h2>
                    </div>
                  </div>
                  {scheduleLoading ? (
                    <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-1 text-[10px] font-semibold text-tertiary sm:px-2.5 sm:text-[11px]">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>progress_activity</span>
                      Đang đồng bộ
                    </span>
                  ) : null}
                </div>

                {useCompactScopeLayout ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 sm:px-2.5 sm:text-[11px]">
                          <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>apartment</span>
                          <span className="truncate">{selectedDepartmentLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary sm:px-2.5 sm:text-[11px]">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>date_range</span>
                          {selectedWeekLabel}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleOpenCompactScopeSheet}
                          aria-label="Bộ lọc"
                          title="Bộ lọc"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 sm:px-3"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                          <span className="hidden sm:inline">Bộ lọc</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleSave();
                          }}
                          disabled={!canPersistWeek}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition disabled:opacity-50 sm:min-w-[108px] sm:px-3.5"
                          style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            {isSaving ? 'progress_activity' : scheduleId ? 'save' : 'add_circle'}
                          </span>
                          {compactActionLabel}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
                      {VIEW_TAB_META.map((tab) => {
                        const isActive = activeViewTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveViewTab(tab.id)}
                            title={tab.description}
                            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] px-2.5 py-2 text-center text-[11px] font-semibold transition sm:text-xs ${
                              isActive
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tab.icon}</span>
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.55fr)_minmax(280px,1.4fr)_auto]">
                    <SearchableSelect
                      value={selectedDepartmentId}
                      options={departmentOptions}
                      onChange={setSelectedDepartmentId}
                      label="Phòng ban"
                      placeholder="Chọn phòng ban"
                      disabled={isDepartmentScopeLocked || departmentOptions.length === 0}
                      searchPlaceholder="Tìm phòng ban..."
                      compact
                      denseLabel
                      usePortal
                      className="min-w-0"
                      triggerClassName={compactToolbarSelectTriggerClass}
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
                      denseLabel
                      usePortal
                      className="min-w-0"
                      triggerClassName={compactToolbarSelectTriggerClass}
                    />

                    <div className="min-w-0">
                      <span
                        aria-hidden="true"
                        className="mb-0.5 block select-none text-xs font-semibold text-transparent"
                      >
                        Chế độ xem
                      </span>
                      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
                        {VIEW_TAB_META.map((tab) => {
                          const isActive = activeViewTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveViewTab(tab.id)}
                              title={tab.description}
                              className={`group inline-flex min-h-9 items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-left text-[11px] font-semibold transition sm:text-xs ${
                                isActive
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`material-symbols-outlined ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} style={{ fontSize: 16 }}>
                                {tab.icon}
                              </span>
                              <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col xl:items-end">
                      <span
                        aria-hidden="true"
                        className="mb-0.5 block select-none text-xs font-semibold text-transparent"
                      >
                        Thao tác
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSave();
                        }}
                        disabled={!canPersistWeek}
                        className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition disabled:opacity-50 sm:w-auto xl:min-w-[190px]"
                        style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {isSaving ? 'progress_activity' : scheduleId ? 'save' : 'playlist_add_check_circle'}
                        </span>
                        {desktopActionLabel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeViewTab === 'REGISTER' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xs font-bold text-deep-teal">Không gian đăng ký theo tuần</h2>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                {useCompactRegisterLayout
                  ? 'Mở từng buổi để thêm hoặc sửa dòng công việc trong bảng chỉnh sửa gọn, hạn chế phải cuộn dài trên màn nhỏ.'
                  : 'Chuyển nhanh giữa từng ngày, thêm nhiều dòng công việc theo buổi và lưu ngay khi hoàn tất.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full bg-tertiary-fixed px-2.5 py-1.5 text-tertiary">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>wb_sunny</span>
                Buổi sáng
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-2.5 py-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>routine</span>
                Buổi chiều
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1.5 text-slate-600">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_square</span>
                Lưu từng dòng hoặc lưu cả tuần
              </span>
            </div>
          </div>

          <div className={`${useCompactRegisterLayout ? 'space-y-3' : 'max-h-[calc(100vh-340px)] space-y-3 overflow-auto pr-1'}`}>
            {derivedWeekDays.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 32 }}>calendar_clock</span>
                <p className="mt-3 font-semibold text-slate-700">Chọn phòng ban và tuần để bắt đầu nhập lịch làm việc.</p>
              </div>
            ) : useCompactRegisterLayout ? (
              derivedWeekDays.map((day) => (
                (() => {
                  const isToday = day.date === toDateKey(new Date());
                  const isExpanded = expandedCompactDayKey === day.date;
                  const { totalEntries } = getCompactDayStats(day.date);
                  const helperText = buildCompactDayHelperText({
                    isExpanded,
                    totalEntries,
                    holidayName: day.is_holiday ? day.holiday_name : null,
                  });
                  const sessionSummaries = (['MORNING', 'AFTERNOON'] as DepartmentWeeklyScheduleSession[]).map((session) => {
                    const rowCount = (groupedEditorEntries.get(`${day.date}:${session}`) || []).length;
                    return { session, rowCount };
                  });

                  return (
                    <div
                      key={day.date}
                      className={`rounded-xl border shadow-sm ${
                        day.is_holiday
                          ? 'border-rose-200 bg-red-50/30'
                          : day.is_working_day
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-surface-low'
                      }`}
                    >
                      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isToday ? (
                              <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.02em] text-white">
                                Hôm nay
                              </span>
                            ) : null}
                            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              day.is_holiday
                                ? 'bg-rose-100 text-rose-700'
                                : day.is_working_day
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {day.is_holiday ? 'Ngày lễ' : day.is_working_day ? 'Trong tuần' : 'Cuối tuần'}
                            </span>
                          </div>
                          <h2 className="mt-2 text-sm font-bold text-on-surface">
                            {DAY_NAMES[day.day_of_week] || day.day_name} - {String(day.day).padStart(2, '0')}/{String(day.month).padStart(2, '0')}
                          </h2>
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            {helperText}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {sessionSummaries.map(({ session, rowCount }) => (
                              <div
                                key={`compact-register-summary-${day.date}-${session}`}
                                className={`inline-flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 shadow-sm ${
                                  session === 'MORNING'
                                    ? 'border-orange-200 bg-orange-50/80'
                                    : 'border-slate-200 bg-white/90'
                                }`}
                              >
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  session === 'MORNING'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {SESSION_LABELS[session]}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {buildCompactSessionCountLabel(rowCount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCompactDay(day.date)}
                          aria-expanded={isExpanded}
                          aria-controls={`compact-register-day-panel-${day.date}`}
                          aria-label={`${isExpanded ? 'Thu gọn' : 'Mở rộng'} ngày ${String(day.day).padStart(2, '0')}/${String(day.month).padStart(2, '0')}`}
                          className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-400 shadow-sm transition hover:border-primary/30 hover:text-primary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>

                      {isExpanded ? (
                        <div id={`compact-register-day-panel-${day.date}`} className="grid gap-3 border-t border-slate-100 px-3 pb-3 pt-3 sm:px-4 md:grid-cols-2">
                          {(['MORNING', 'AFTERNOON'] as DepartmentWeeklyScheduleSession[]).map((session) => {
                            const rows = groupedEditorEntries.get(`${day.date}:${session}`) || [];
                            const slotIsPast = isScheduleSlotPast(day.date, session);
                            const isEditingSlot = editingSlot?.calendarDate === day.date && editingSlot?.session === session;
                            const canOpenSlot = canWriteSchedules && (rows.length > 0 || canCreateEntryForSlot(day.date, session));

                            return (
                              <div
                                key={`${day.date}-${session}`}
                                className={`rounded-xl border p-3 transition ${
                                  isEditingSlot
                                    ? 'border-primary bg-primary/10'
                                    : session === 'MORNING'
                                    ? 'border-tertiary-fixed bg-tertiary-fixed/25'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${
                                          session === 'MORNING' ? 'bg-orange-500' : 'bg-slate-400'
                                        }`} />
                                        <span className="text-sm font-bold text-slate-900">
                                          {SESSION_CARD_TITLES[session]}
                                        </span>
                                        {slotIsPast ? (
                                          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-error">
                                            Đã qua
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-2 text-[11px] text-on-surface-variant">
                                        {rows.length === 0
                                          ? `Chưa có nội dung cho buổi ${SESSION_LABELS[session].toLowerCase()}.`
                                          : 'Mở bảng chỉnh sửa để xem đầy đủ, lưu nhanh hoặc xóa từng dòng.'}
                                      </p>
                                    </div>
                                    {canWriteSchedules ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleOpenSlotEditor(day.date, session);
                                        }}
                                        disabled={!canOpenSlot}
                                        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 sm:w-auto"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                          {rows.length === 0 ? 'add' : 'edit_square'}
                                        </span>
                                        {rows.length === 0 ? 'Tạo nhanh' : 'Mở chỉnh sửa'}
                                      </button>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-slate-400">Chỉ xem</span>
                                    )}
                                  </div>

                                  {rows.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
                                      Chưa có nội dung cho buổi {SESSION_LABELS[session].toLowerCase()}.
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {rows.map((entry, index) => {
                                        const participantDisplay = buildParticipantDisplay(entry, employeesById);
                                        const participantSummary = normalizeText(participantDisplay) || '--';
                                        const locationSummary = normalizeText(entry.location) || '--';
                                        return (
                                          <div
                                            key={`compact-register-entry-${entry.local_id}`}
                                            className={`rounded-lg border px-3 py-2.5 shadow-sm ${
                                              entry.id ? 'border-slate-200 bg-white' : 'border-primary/20 bg-primary/5'
                                            }`}
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                entry.id ? 'bg-slate-100 text-slate-600' : 'bg-primary/10 text-primary'
                                              }`}>
                                                {entry.id ? `Dòng #${index + 1}` : `Bản nháp #${index + 1}`}
                                              </span>
                                              {!canEditEntry(entry) ? (
                                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                                  Chỉ xem
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                                              {normalizeText(entry.work_content) || '--'}
                                            </div>
                                            <div className="mt-1.5 space-y-1 text-[11px] text-slate-500">
                                              <div className="space-y-0.5">
                                                <span className="block font-semibold text-slate-600">Thành phần:</span>
                                                <div className="whitespace-pre-wrap break-words leading-5">
                                                  {participantSummary}
                                                </div>
                                              </div>
                                              <div>Địa điểm: {locationSummary}</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })()
              ))
            ) : (
              derivedWeekDays.map((day) => (
                <div
                  key={day.date}
                  className={`rounded-lg border p-3 shadow-sm ${
                    day.is_holiday
                      ? 'border-rose-200 bg-red-50/30'
                      : day.is_working_day
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 bg-surface-low'
                  }`}
                >
                  <div className="mb-2.5 flex flex-col gap-2 border-b border-slate-100 pb-2.5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-on-surface">
                        {DAY_NAMES[day.day_of_week] || day.day_name} - {String(day.day).padStart(2, '0')}/{String(day.month).padStart(2, '0')}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {day.is_holiday && day.holiday_name ? day.holiday_name : day.is_working_day ? 'Ngày làm việc' : 'Cuối tuần'}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                        <div
                          key={`${day.date}-${session}`}
                          className={`rounded-lg border p-3 ${
                            session === 'MORNING'
                              ? 'border-tertiary-fixed bg-tertiary-fixed/30'
                              : 'border-slate-200 bg-secondary/5'
                          }`}
                        >
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-xs font-semibold text-on-surface">{SESSION_LABELS[session]}</h3>
                              <p className="text-[11px] text-on-surface-variant">Mỗi buổi có thể thêm nhiều dòng công việc.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddEntry(day.date, session)}
                              disabled={!canCreateEntryForSlot(day.date, session)}
                              title={!canCreateEntryForSlot(day.date, session) ? 'Buổi làm việc đã qua, không thể đăng ký mới.' : undefined}
                              className="inline-flex w-full items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/30 hover:bg-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 sm:w-auto"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                              Thêm dòng
                            </button>
                          </div>

                          {rows.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
                              Chưa có nội dung cho buổi {SESSION_LABELS[session].toLowerCase()}.
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {rows.map((entry, index) => {
                                const isEditable = canEditEntry(entry);
                                const restrictionMessage = getEntryRestrictionMessage(entry);

                                return (
                                  <div
                                    key={entry.local_id}
                                    className={`rounded-lg border p-3 shadow-sm ${
                                      entry.id
                                        ? 'border-slate-200 bg-white'
                                        : 'border-primary/20 bg-primary/5'
                                    }`}
                                  >
                                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                          entry.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-tertiary-fixed text-tertiary'
                                        }`}
                                      >
                                        {entry.id ? `Dòng #${index + 1}` : `Bản nháp #${index + 1}`}
                                      </span>
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleSaveEntry(entry);
                                          }}
                                          disabled={!isEditable || isSaving || deletingEntryIds.includes(entry.local_id) || savingEntryIds.includes(entry.local_id)}
                                          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-primary/20 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                            {savingEntryIds.includes(entry.local_id)
                                              ? 'progress_activity'
                                              : entry.id
                                              ? 'save'
                                              : 'check_circle'}
                                          </span>
                                          {savingEntryIds.includes(entry.local_id)
                                            ? entry.id
                                              ? 'Đang cập nhật...'
                                              : 'Đang lưu...'
                                            : entry.id
                                            ? 'Cập nhật'
                                            : 'Lưu dòng'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleDeleteEntry(entry);
                                          }}
                                          disabled={!canDeleteEntry(entry) || deletingEntryIds.includes(entry.local_id)}
                                          title={!entry.id || canDeleteEntry(entry) ? undefined : restrictionMessage || 'Chỉ người đăng ký hoặc admin mới được xóa'}
                                          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-error/20 px-2.5 py-1.5 text-xs font-semibold text-error transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                            {deletingEntryIds.includes(entry.local_id) ? 'progress_activity' : 'delete'}
                                          </span>
                                          {deletingEntryIds.includes(entry.local_id) ? 'Đang xóa...' : 'Xóa dòng'}
                                        </button>
                                      </div>
                                    </div>

                                    {restrictionMessage ? (
                                      <div className="mb-3 rounded border border-error/20 bg-red-50 px-3 py-2 text-[11px] text-error">
                                        {restrictionMessage}
                                      </div>
                                    ) : null}

                                    <div className="space-y-3">
                                      <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-neutral">Nội dung làm việc *</span>
                                        <textarea
                                          value={entry.work_content}
                                          onChange={(event) =>
                                            updateEntry(entry.local_id, (current) => ({ ...current, work_content: event.target.value }))
                                          }
                                          rows={3}
                                          disabled={!isEditable}
                                          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                          placeholder="Mô tả nội dung làm việc trong buổi này"
                                        />
                                      </label>

                                      <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="block">
                                          <span className="mb-1.5 block text-xs font-semibold text-neutral">Thành phần (nhân sự hệ thống)</span>
                                          <SearchableMultiSelect
                                            values={entry.participant_user_ids}
                                            options={employeeOptions}
                                            onChange={(values) =>
                                              updateEntry(entry.local_id, (current) => ({
                                                ...current,
                                                participant_user_ids: values,
                                              }))
                                            }
                                            ariaLabel="Thành phần (nhân sự hệ thống)"
                                            placeholder="Chọn nhân sự tham gia"
                                            searchPlaceholder="Tìm nhân sự..."
                                            disabled={!isEditable}
                                            triggerClassName={compactMultiSelectTriggerClass}
                                            showSelectedChips={false}
                                            selectedSummaryFormatter={compactParticipantSummary}
                                          />
                                        </div>

                                        <label className="block">
                                          <span className="mb-1.5 block text-xs font-semibold text-neutral">Thành phần tự do</span>
                                          <input
                                            type="text"
                                            value={entry.participant_text}
                                            onChange={(event) =>
                                              updateEntry(entry.local_id, (current) => ({ ...current, participant_text: event.target.value }))
                                            }
                                            disabled={!isEditable}
                                            className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                            placeholder="Ví dụ: Cộng tác viên, khách mời..."
                                          />
                                        </label>
                                      </div>

                                      <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-neutral">Địa điểm</span>
                                        <input
                                          type="text"
                                          value={entry.location}
                                          onChange={(event) =>
                                            updateEntry(entry.local_id, (current) => ({ ...current, location: event.target.value }))
                                          }
                                          disabled={!isEditable}
                                          className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                          placeholder="Nhập địa điểm làm việc"
                                        />
                                      </label>

                                      {entry.id ? (
                                        <div className="flex justify-end text-right text-[11px] leading-[1.35] text-slate-500">
                                          <div>
                                            <div>
                                              <span className="font-semibold text-slate-600">{resolveEntryAuditLabels(entry).actor}:</span>{' '}
                                              {resolveEntryCreatorDisplay(entry, employeesById)}, {resolveEntryAuditLabels(entry).time} {resolveEntryAuditDateDisplay(entry)}
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
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
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {useCompactPreviewLayout ? (
              <div className="space-y-3 bg-slate-50/40 p-2.5 sm:p-3 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto">
                {orderedPreviewWeekDays.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có dữ liệu để xem trước.
                  </div>
                ) : (
                  orderedPreviewWeekDays.map((day) => {
                    const isToday = day.date === toDateKey(new Date());
                    const isExpanded = expandedCompactDayKey === day.date;
                    const { totalEntries } = getCompactDayStats(day.date);
                    const helperText = buildCompactDayHelperText({
                      isExpanded,
                      totalEntries,
                      holidayName: day.is_holiday ? day.holiday_name : null,
                    });
                    const sessionSummaries = (['MORNING', 'AFTERNOON'] as DepartmentWeeklyScheduleSession[]).map((session) => {
                      const rowCount = getAllEntriesForSlot(day.date, session).length;
                      return { session, rowCount };
                    });

                    return (
                      <div
                        key={`compact-preview-${day.date}`}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex items-start gap-3 px-3 py-3 text-left">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isToday ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.02em] text-white">
                                  Hôm nay
                                </span>
                              ) : null}
                              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                day.is_holiday
                                  ? 'bg-rose-100 text-rose-700'
                                  : day.is_working_day
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {day.is_holiday ? 'Ngày lễ' : day.is_working_day ? 'Trong tuần' : 'Cuối tuần'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-deep-teal">
                                {DAY_NAMES[day.day_of_week] || day.day_name}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {String(day.day).padStart(2, '0')}/{String(day.month).padStart(2, '0')}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-on-surface-variant">
                              {helperText}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {sessionSummaries.map(({ session, rowCount }) => (
                                <div
                                  key={`compact-preview-summary-${day.date}-${session}`}
                                  className={`inline-flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 shadow-sm ${
                                    session === 'MORNING'
                                      ? 'border-orange-200 bg-orange-50/80'
                                      : 'border-slate-200 bg-white/90'
                                  }`}
                                >
                                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    session === 'MORNING'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {SESSION_LABELS[session]}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    {buildCompactSessionCountLabel(rowCount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCompactDay(day.date)}
                            aria-expanded={isExpanded}
                            aria-controls={`compact-preview-day-panel-${day.date}`}
                            aria-label={`${isExpanded ? 'Thu gọn' : 'Mở rộng'} ngày ${String(day.day).padStart(2, '0')}/${String(day.month).padStart(2, '0')}`}
                            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-400 shadow-sm transition hover:border-primary/30 hover:text-primary"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </div>

                        {isExpanded ? (
                          <div id={`compact-preview-day-panel-${day.date}`} className="space-y-2.5 border-t border-slate-100 px-3 pb-3 pt-3">
                            {(['MORNING', 'AFTERNOON'] as DepartmentWeeklyScheduleSession[]).map((session) => {
                              const slotEntries = getAllEntriesForSlot(day.date, session);
                              const slotIsPast = isScheduleSlotPast(day.date, session);
                              const isEditingSlot = editingSlot?.calendarDate === day.date && editingSlot?.session === session;

                              return (
                                <button
                                  key={`compact-slot-${day.date}-${session}`}
                                  type="button"
                                  onClick={() => {
                                    if (!canWriteSchedules) return;
                                    handleOpenSlotEditor(day.date, session);
                                  }}
                                  className={`w-full rounded-xl border p-3 text-left transition ${
                                    canWriteSchedules ? 'hover:border-primary/40 hover:bg-primary/5' : ''
                                  } ${
                                    isEditingSlot
                                      ? 'border-primary bg-primary/10'
                                      : session === 'MORNING'
                                      ? 'border-tertiary-fixed bg-tertiary-fixed/20'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${
                                          session === 'MORNING' ? 'bg-orange-500' : 'bg-slate-400'
                                        }`} />
                                        <span className="text-sm font-bold text-slate-900">
                                          {SESSION_CARD_TITLES[session]}
                                        </span>
                                        {slotIsPast ? (
                                          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-error">
                                            Đã qua
                                          </span>
                                        ) : null}
                                      </div>

                                      <div className="mt-2 space-y-2 text-[12px] text-slate-700">
                                        {slotEntries.length === 0 ? (
                                          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400">
                                            Chưa có nội dung cho buổi {SESSION_LABELS[session].toLowerCase()}.
                                          </p>
                                        ) : (
                                          <>
                                            {slotEntries.map((entry) => {
                                              const participantDisplay = buildParticipantDisplay(entry, employeesById);
                                              const participantSummary = normalizeText(participantDisplay) || '--';
                                              const locationSummary = normalizeText(entry.location) || '--';
                                              return (
                                                <div key={`compact-entry-${entry.local_id}`} className="rounded-lg bg-white/80 px-3 py-2 shadow-sm">
                                                  <div className="line-clamp-2 font-semibold text-slate-900">
                                                    {normalizeText(entry.work_content) || '--'}
                                                  </div>
                                                  <div className="mt-1 space-y-1 text-[11px] text-slate-500">
                                                    <div className="space-y-0.5">
                                                      <span className="block font-semibold text-slate-600">Thành phần:</span>
                                                      <div className="whitespace-pre-wrap break-words leading-5">
                                                        {participantSummary}
                                                      </div>
                                                    </div>
                                                    <div>Địa điểm: {locationSummary}</div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-[11px] font-semibold text-primary sm:pl-4 sm:text-right">
                                      {canWriteSchedules ? 'Mở đăng ký' : 'Chỉ xem'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
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
                        <th key={header} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="border border-slate-200 px-6 py-6 text-center text-sm text-slate-500">
                          Chưa có dữ liệu để xem trước.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, index) => {
                        const isToday = row.day.date === toDateKey(new Date());
                        const isEditingSlot = editingSlot?.calendarDate === row.day.date && editingSlot?.session === row.session;
                        return (
                        <tr
                          key={`${row.day.date}-${row.session}-${index}`}
                          className={`align-top ${canWriteSchedules ? 'cursor-pointer transition-colors hover:bg-primary/5' : ''} ${isEditingSlot ? 'bg-primary/10' : ''}`}
                          onClick={() => {
                            if (!canWriteSchedules) return;
                            handleOpenSlotEditor(row.day.date, row.session);
                          }}
                        >
                          {row.showDayCells ? (
                            <>
                              <td rowSpan={row.dayRowSpan} className={`align-middle border border-slate-200 px-2 py-2.5 text-center text-xs font-semibold ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
                                {PREVIEW_DAY_NAMES[row.day.day_of_week] || row.day.day_name}
                              </td>
                              <td rowSpan={row.dayRowSpan} className={`align-middle border border-slate-200 px-2 py-2.5 text-center text-xs font-semibold ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
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
                            <td rowSpan={row.sessionRowSpan} className={`align-middle border border-slate-200 px-2 py-2.5 text-center text-xs font-semibold ${isToday ? 'bg-primary/5 text-primary' : 'text-slate-900'}`}>
                              {row.sessionLabel}
                            </td>
                          ) : null}

                          <td className="relative h-full border border-slate-200 px-2.5 pt-2 pb-1 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                            {normalizeText(row.workContent) ? (
                              row.hasAudit ? (
                                <>
                                  <div className="min-h-[88px] pb-8">{row.workContent}</div>
                                  <div className="absolute inset-x-2.5 bottom-0 text-right text-[10px] leading-[1.35] text-slate-500 md:text-[11px]">
                                    <div>
                                      <span className="font-semibold text-slate-600">{row.auditLabels.actor}:</span>{' '}
                                      {row.createdByDisplay}, {row.auditLabels.time} {row.createdAtDisplay}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div>{row.workContent}</div>
                              )
                            ) : '-'}
                          </td>
                          <td className="border border-slate-200 px-2.5 py-2 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                            {normalizeText(row.participantDisplay) || '-'}
                          </td>
                          <td className="border border-slate-200 px-2.5 py-2 text-[12px] leading-[1.35] whitespace-pre-wrap md:text-[13px]">
                            {normalizeText(row.location) || '-'}
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <CompactScopeSheet
        isOpen={useCompactScopeLayout && isCompactScopeSheetOpen}
        onClose={() => setIsCompactScopeSheetOpen(false)}
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={setSelectedDepartmentId}
        departmentOptions={departmentOptions}
        departmentSelectionLocked={isDepartmentScopeLocked}
        selectedWeekStartDate={selectedWeekStartDate}
        onWeekChange={setSelectedWeekStartDate}
        weekOptions={weekOptions.map((option) => ({
          value: option.week_start_date,
          label: option.label,
          searchText: `${option.label} ${option.week_start_date}`,
        }))}
        calendarLoading={calendarLoading}
      />

      {/* Modal Popup Editor rendered via Portal */}
      <ScheduleEntryModal
        editingSlot={editingSlot}
        canWriteSchedules={canWriteSchedules}
        currentUserId={normalizedCurrentUserId}
        isAdminViewer={isAdminViewer}
        canEditEntry={canEditEntry}
        canCreateEntryForSlot={canCreateEntryForSlot}
        canDeleteEntry={canDeleteEntry}
        getEntryRestrictionMessage={getEntryRestrictionMessage}
        isSaving={isSaving}
        savingEntryIds={savingEntryIds}
        deletingEntryIds={deletingEntryIds}
        employeesById={employeesById}
        employeeOptions={employeeOptions}
        getAllEntriesForSlot={getAllEntriesForSlot}
        handleSaveEntry={handleSaveEntry}
        handleDeleteEntry={handleDeleteEntry}
        handleAddEntry={handleAddEntry}
        updateEntry={updateEntry}
        resolveEntryAuditLabels={resolveEntryAuditLabels}
        resolveEntryCreatorDisplay={resolveEntryCreatorDisplay}
        resolveEntryAuditDateDisplay={resolveEntryAuditDateDisplay}
        DAY_NAMES={DAY_NAMES}
        SESSION_LABELS={SESSION_LABELS}
        formatDisplayDate={formatDisplayDate}
        orderedPreviewWeekDays={orderedPreviewWeekDays}
        onClose={handleCloseEditor}
      />
    </div>
  );
};

// Modal component rendered via Portal
const ScheduleEntryModal: React.FC<{
  editingSlot: { calendarDate: string; session: DepartmentWeeklyScheduleSession } | null;
  canWriteSchedules: boolean;
  currentUserId: string;
  isAdminViewer: boolean;
  canEditEntry: (entry: EditableScheduleEntry) => boolean;
  canCreateEntryForSlot: (calendarDate: string, session: DepartmentWeeklyScheduleSession) => boolean;
  canDeleteEntry: (entry: EditableScheduleEntry) => boolean;
  getEntryRestrictionMessage: (entry: EditableScheduleEntry) => string | null;
  isSaving: boolean;
  savingEntryIds: string[];
  deletingEntryIds: string[];
  employeesById: Map<string, Employee>;
  employeeOptions: { value: string; label: string; searchText: string }[];
  getAllEntriesForSlot: (calendarDate: string, session: DepartmentWeeklyScheduleSession) => EditableScheduleEntry[];
  handleSaveEntry: (entry: EditableScheduleEntry) => Promise<void>;
  handleDeleteEntry: (entry: EditableScheduleEntry) => Promise<void>;
  handleAddEntry: (calendarDate: string, session: DepartmentWeeklyScheduleSession) => void;
  updateEntry: (localId: string, updater: (entry: EditableScheduleEntry) => EditableScheduleEntry) => void;
  resolveEntryAuditLabels: (entry: EditableScheduleEntry) => { actor: string; time: string };
  resolveEntryCreatorDisplay: (entry: EditableScheduleEntry, employeesById: Map<string, Employee>) => string;
  resolveEntryAuditDateDisplay: (entry: EditableScheduleEntry) => string;
  DAY_NAMES: Record<number, string>;
  SESSION_LABELS: Record<DepartmentWeeklyScheduleSession, string>;
  formatDisplayDate: (value: string | null | undefined) => string;
  orderedPreviewWeekDays: DepartmentWeeklyScheduleDay[];
  onClose: () => void;
}> = ({
  editingSlot,
  canWriteSchedules,
  currentUserId,
  isAdminViewer,
  canEditEntry,
  canCreateEntryForSlot,
  canDeleteEntry,
  getEntryRestrictionMessage,
  isSaving,
  savingEntryIds,
  deletingEntryIds,
  employeesById,
  employeeOptions,
  getAllEntriesForSlot,
  handleSaveEntry,
  handleDeleteEntry,
  handleAddEntry,
  updateEntry,
  resolveEntryAuditLabels,
  resolveEntryCreatorDisplay,
  resolveEntryAuditDateDisplay,
  DAY_NAMES,
  SESSION_LABELS,
  formatDisplayDate,
  orderedPreviewWeekDays,
  onClose,
}) => {
  const slotCalendarDate = editingSlot?.calendarDate ?? '';
  const slotSession = editingSlot?.session ?? 'MORNING';
  const slotEntries = editingSlot ? getAllEntriesForSlot(slotCalendarDate, slotSession) : [];
  const registeredEntries = slotEntries.filter((entry) => Boolean(entry.id));
  const draftEntries = slotEntries.filter((entry) => !entry.id);
  const visibleRegisteredEntries = useMemo(() => {
    if (isAdminViewer) {
      return registeredEntries;
    }

    return registeredEntries.filter((entry) => {
      const creatorId = normalizeId(entry.created_by);
      if (creatorId && creatorId === currentUserId) {
        return true;
      }

      return !creatorId && Boolean(entry.can_edit);
    });
  }, [currentUserId, isAdminViewer, registeredEntries]);
  const canCreateNewEntry = editingSlot ? canCreateEntryForSlot(slotCalendarDate, slotSession) : false;
  const [selectedEntryLocalId, setSelectedEntryLocalId] = useState<string | null>(null);
  const selectableEntryIds = useMemo(
    () => new Set([...draftEntries, ...visibleRegisteredEntries].map((entry) => entry.local_id)),
    [draftEntries, visibleRegisteredEntries]
  );
  const registeredEntriesTitle = isAdminViewer ? 'Danh sách đã đăng ký' : 'Đăng ký của bạn';
  const registeredEntriesBadge = isAdminViewer
    ? `${visibleRegisteredEntries.length} đăng ký`
    : `${visibleRegisteredEntries.length} của bạn`;
  const emptyRegisteredEntriesMessage = isAdminViewer
    ? 'Chưa có lịch đã đăng ký cho buổi này.'
    : 'Bạn chưa có lịch đăng ký cho buổi này.';

  useEffect(() => {
    if (!editingSlot) {
      setSelectedEntryLocalId(null);
      return;
    }

    const hasSelectedEntry = selectedEntryLocalId !== null && selectableEntryIds.has(selectedEntryLocalId);
    if (hasSelectedEntry) {
      return;
    }

    const latestDraft = draftEntries[draftEntries.length - 1] ?? null;
    const fallbackEntry = latestDraft ?? visibleRegisteredEntries[0] ?? null;
    setSelectedEntryLocalId(fallbackEntry?.local_id ?? null);
  }, [draftEntries, editingSlot, selectableEntryIds, selectedEntryLocalId, visibleRegisteredEntries]);

  const selectedEntry = slotEntries.find((entry) => entry.local_id === selectedEntryLocalId && selectableEntryIds.has(entry.local_id))
    ?? draftEntries[draftEntries.length - 1]
    ?? visibleRegisteredEntries[0]
    ?? null;
  const selectedEntryRestriction = selectedEntry ? getEntryRestrictionMessage(selectedEntry) : null;
  const selectedEntryCanEdit = selectedEntry ? canEditEntry(selectedEntry) : false;

  if (!editingSlot || !canWriteSchedules) {
    return null;
  }

  const openNewDraft = () => {
    if (!canCreateNewEntry) {
      return;
    }

    const latestDraft = draftEntries[draftEntries.length - 1] ?? null;
    if (latestDraft) {
      setSelectedEntryLocalId(latestDraft.local_id);
      return;
    }

    handleAddEntry(editingSlot.calendarDate, editingSlot.session);
    setSelectedEntryLocalId('__new__');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      style={{ minHeight: '100vh', minWidth: '100vw' }}
    >
      <div
        className="relative mt-auto flex max-h-[calc(100dvh-0.25rem)] w-full max-w-6xl flex-col overflow-hidden rounded-t-[1.5rem] bg-white animate-in fade-in zoom-in duration-200 sm:mt-0 sm:mx-4 sm:max-h-[92vh] sm:rounded-2xl"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,28,59,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>edit_calendar</span>
            <span className="text-xs font-bold text-deep-teal sm:text-sm">
              {DAY_NAMES[orderedPreviewWeekDays.find(d => d.date === editingSlot.calendarDate)?.day_of_week ?? 2]}
              {' — '}
              {formatDisplayDate(editingSlot.calendarDate)}
              {' | Buổi '}
              {SESSION_LABELS[editingSlot.session]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 gap-3 overflow-y-auto p-2.5 sm:p-3 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="order-2 space-y-3 xl:order-1">
            <div className="rounded-lg border border-slate-200 bg-surface-low p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xs font-bold text-deep-teal">{registeredEntriesTitle}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {registeredEntriesBadge}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={openNewDraft}
                  disabled={!canCreateNewEntry}
                  className={`rounded-lg border px-3 py-3 text-left shadow-sm transition ${
                    selectedEntry !== null && !selectedEntry.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 bg-white hover:border-primary/30'
                  } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-bold text-deep-teal">Đăng ký mới</div>
                    </div>
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                      Form mới
                    </span>
                  </div>
                </button>

                {visibleRegisteredEntries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-[11px] text-slate-400">
                    {emptyRegisteredEntriesMessage}
                  </div>
                ) : (
                  visibleRegisteredEntries.map((entry, index) => {
                    const isSelected = selectedEntry?.local_id === entry.local_id;
                    const restrictionMessage = getEntryRestrictionMessage(entry);

                    return (
                      <button
                        key={`registered-${entry.local_id}`}
                        type="button"
                        onClick={() => setSelectedEntryLocalId(entry.local_id)}
                        className={`rounded-lg border p-3 text-left shadow-sm transition ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200 bg-white hover:border-primary/30'
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Đã đăng ký #{index + 1}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              entry.is_locked
                                ? 'bg-red-50 text-error'
                                : canEditEntry(entry)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {entry.is_locked ? 'Đã qua' : canEditEntry(entry) ? 'Có thể cập nhật' : 'Chỉ xem'}
                            </span>
                          </div>
                          <div className="text-right text-[11px] leading-[1.35] text-slate-500">
                            <div>
                              <span className="font-semibold text-slate-600">{resolveEntryAuditLabels(entry).actor}:</span>{' '}
                              {resolveEntryCreatorDisplay(entry, employeesById)}, {resolveEntryAuditLabels(entry).time} {resolveEntryAuditDateDisplay(entry)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <div className="line-clamp-3 whitespace-pre-wrap text-slate-900">{normalizeText(entry.work_content) || '--'}</div>
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-600">Thành phần:</span>
                            <div className="whitespace-pre-wrap break-words">
                              {buildParticipantDisplay(entry, employeesById) || '--'}
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600">Địa điểm:</span>{' '}
                            {normalizeText(entry.location) || '--'}
                          </div>
                          {restrictionMessage ? (
                            <div className="rounded bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
                              {restrictionMessage}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="order-1 space-y-3 xl:order-2">
            <div className="rounded-lg border border-slate-100 bg-surface-low p-3">
              <div>
                <h3 className="text-xs font-bold text-deep-teal">
                  {selectedEntry?.id ? 'Cập nhật đăng ký' : 'Đăng ký của bạn'}
                </h3>
              </div>
            </div>

            {!selectedEntry ? (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined mb-2" style={{ fontSize: 32 }}>inbox</span>
                <p className="text-[11px] text-on-surface-variant">Chưa có nội dung nào cho buổi này</p>
              </div>
            ) : (
              <>
                <div
                  key={selectedEntry.local_id}
                  className={`rounded-lg border p-3 shadow-sm ${
                    selectedEntry.id
                      ? 'border-slate-200 bg-white'
                      : 'border-primary/20 bg-primary/5'
                  }`}
                >
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <span
                      className={`inline-flex rounded-full text-[10px] font-bold px-2 py-0.5 ${
                        selectedEntry.id
                          ? 'bg-primary/10 text-primary'
                          : 'bg-secondary/15 text-on-surface-variant'
                      }`}
                    >
                      {selectedEntry.id ? 'Đang cập nhật' : 'Đăng ký mới'}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveEntry(selectedEntry);
                        }}
                        disabled={!selectedEntryCanEdit || isSaving || deletingEntryIds.includes(selectedEntry.local_id) || savingEntryIds.includes(selectedEntry.local_id)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-primary/20 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {savingEntryIds.includes(selectedEntry.local_id)
                            ? 'progress_activity'
                            : selectedEntry.id
                            ? 'save'
                            : 'check_circle'}
                        </span>
                        {savingEntryIds.includes(selectedEntry.local_id)
                          ? selectedEntry.id
                            ? 'Đang cập nhật...'
                            : 'Đang lưu...'
                          : selectedEntry.id
                          ? 'Cập nhật'
                          : 'Lưu dòng'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteEntry(selectedEntry);
                        }}
                        disabled={!canDeleteEntry(selectedEntry) || deletingEntryIds.includes(selectedEntry.local_id)}
                        title={!selectedEntry.id || canDeleteEntry(selectedEntry) ? undefined : selectedEntryRestriction || 'Chỉ người đăng ký hoặc admin mới được xóa'}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-error/20 px-2.5 py-1.5 text-xs font-semibold text-error transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {deletingEntryIds.includes(selectedEntry.local_id) ? 'progress_activity' : 'delete'}
                        </span>
                        {deletingEntryIds.includes(selectedEntry.local_id) ? 'Đang xóa...' : 'Xóa dòng'}
                      </button>
                    </div>
                  </div>

                  {selectedEntryRestriction ? (
                    <div className="mb-3 rounded bg-red-50 px-3 py-2 text-[11px] text-error border border-error/20">
                      {selectedEntryRestriction}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-neutral">Nội dung làm việc *</span>
                      <textarea
                        value={selectedEntry.work_content}
                        onChange={(event) =>
                          updateEntry(selectedEntry.local_id, (current) => ({ ...current, work_content: event.target.value }))
                        }
                        rows={3}
                        disabled={!selectedEntryCanEdit}
                        className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder="Mô tả nội dung làm việc trong buổi này"
                      />
                    </label>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-neutral">Thành phần (nhân sự hệ thống)</span>
                        <SearchableMultiSelect
                          values={selectedEntry.participant_user_ids}
                          options={employeeOptions}
                          onChange={(values) =>
                            updateEntry(selectedEntry.local_id, (current) => ({
                              ...current,
                              participant_user_ids: values,
                            }))
                          }
                          ariaLabel="Thành phần (nhân sự hệ thống)"
                          placeholder="Chọn nhân sự tham gia"
                          searchPlaceholder="Tìm nhân sự..."
                          disabled={!selectedEntryCanEdit}
                          triggerClassName={compactMultiSelectTriggerClass}
                          showSelectedChips={false}
                          selectedSummaryFormatter={compactParticipantSummary}
                          portalZIndex={scheduleEntryModalDropdownZIndex}
                        />
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-neutral">Thành phần tự do</span>
                        <input
                          type="text"
                          value={selectedEntry.participant_text}
                          onChange={(event) =>
                            updateEntry(selectedEntry.local_id, (current) => ({ ...current, participant_text: event.target.value }))
                          }
                          disabled={!selectedEntryCanEdit}
                          className="w-full h-8 rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                          placeholder="Ví dụ: Cộng tác viên, khách mời..."
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-neutral">Địa điểm</span>
                      <input
                        type="text"
                        value={selectedEntry.location}
                        onChange={(event) =>
                          updateEntry(selectedEntry.local_id, (current) => ({ ...current, location: event.target.value }))
                        }
                        disabled={!selectedEntryCanEdit}
                        className="w-full h-8 rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder="Nhập địa điểm làm việc"
                      />
                    </label>

                    {selectedEntry.id ? (
                      <div className="flex justify-end text-right text-[11px] leading-[1.35] text-slate-500">
                        <div>
                          <div>
                            <span className="font-semibold text-slate-600">{resolveEntryAuditLabels(selectedEntry).actor}:</span>{' '}
                            {resolveEntryCreatorDisplay(selectedEntry, employeesById)}, {resolveEntryAuditLabels(selectedEntry).time} {resolveEntryAuditDateDisplay(selectedEntry)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openNewDraft}
                  disabled={!canCreateNewEntry}
                  className="w-full rounded-lg border border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  + Thêm đăng ký mới
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const CompactScopeSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedDepartmentId: string;
  onDepartmentChange: (value: string) => void;
  departmentOptions: Array<{ value: string; label: string; searchText: string }>;
  departmentSelectionLocked: boolean;
  selectedWeekStartDate: string;
  onWeekChange: (value: string) => void;
  weekOptions: Array<{ value: string; label: string; searchText: string }>;
  calendarLoading: boolean;
}> = ({
  isOpen,
  onClose,
  selectedDepartmentId,
  onDepartmentChange,
  departmentOptions,
  departmentSelectionLocked,
  selectedWeekStartDate,
  onWeekChange,
  weekOptions,
  calendarLoading,
}) => {
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-t-[1.5rem] bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-deep-teal">Bộ lọc hiển thị</h3>
            <p className="mt-1 text-[11px] text-slate-500">Đổi phòng ban hoặc tuần rồi đóng sheet để quay lại lịch.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <SearchableSelect
            value={selectedDepartmentId}
            options={departmentOptions}
            onChange={onDepartmentChange}
            label="Phòng ban"
            placeholder="Chọn phòng ban"
            disabled={departmentSelectionLocked || departmentOptions.length === 0}
            searchPlaceholder="Tìm phòng ban..."
            compact
            usePortal
            portalZIndex={compactScopeSheetDropdownZIndex}
          />

          <SearchableSelect
            value={selectedWeekStartDate}
            options={weekOptions}
            onChange={onWeekChange}
            label="Tuần"
            placeholder={calendarLoading ? 'Đang tải tuần...' : 'Chọn tuần'}
            disabled={calendarLoading || weekOptions.length === 0}
            searchPlaceholder="Tìm tuần..."
            compact
            usePortal
            portalZIndex={compactScopeSheetDropdownZIndex}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Xong
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
