import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WorkCalendarDay } from '../../../types/scheduling';
import {
  fetchMonthlyCalendars,
  generateCalendarYear,
  updateCalendarDay,
} from '../../../services/api/supportConfigApi';

export interface WorkCalendarDayFormState {
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name: string;
  note: string;
}

interface UseSupportMasterWorkCalendarArgs {
  enabled: boolean;
  canReadWorkCalendar: boolean;
}

interface UseSupportMasterWorkCalendarResult {
  calendarYear: number;
  setCalendarYear: Dispatch<SetStateAction<number>>;
  calendarMonth: number;
  setCalendarMonth: Dispatch<SetStateAction<number>>;
  calendarDays: WorkCalendarDay[];
  isCalendarLoading: boolean;
  calendarError: string;
  isCalendarSaving: boolean;
  editingCalendarDay: WorkCalendarDay | null;
  calendarDayForm: WorkCalendarDayFormState;
  setCalendarDayForm: Dispatch<SetStateAction<WorkCalendarDayFormState>>;
  calendarGenerationYear: number;
  setCalendarGenerationYear: Dispatch<SetStateAction<number>>;
  isCalendarGenerating: boolean;
  calendarGenerationMessage: string;
  loadCalendarDays: () => Promise<void>;
  openCalendarDay: (day: WorkCalendarDay) => void;
  closeCalendarDay: () => void;
  saveCalendarDay: () => Promise<void>;
  generateCalendarForYear: () => Promise<void>;
}

const defaultWorkCalendarDayForm = (): WorkCalendarDayFormState => ({
  is_working_day: true,
  is_holiday: false,
  holiday_name: '',
  note: '',
});

const buildWorkCalendarDayForm = (day: WorkCalendarDay): WorkCalendarDayFormState => ({
  is_working_day: day.is_working_day ?? !day.is_weekend,
  is_holiday: day.is_holiday ?? false,
  holiday_name: day.holiday_name ?? '',
  note: day.note ?? '',
});

export const useSupportMasterWorkCalendar = ({
  enabled,
  canReadWorkCalendar,
}: UseSupportMasterWorkCalendarArgs): UseSupportMasterWorkCalendarResult => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [calendarYear, setCalendarYear] = useState<number>(currentYear);
  const [calendarMonth, setCalendarMonth] = useState<number>(currentMonth);
  const [calendarDays, setCalendarDays] = useState<WorkCalendarDay[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [isCalendarSaving, setIsCalendarSaving] = useState(false);
  const [editingCalendarDay, setEditingCalendarDay] = useState<WorkCalendarDay | null>(null);
  const [calendarDayForm, setCalendarDayForm] = useState<WorkCalendarDayFormState>(defaultWorkCalendarDayForm);
  const [calendarGenerationYear, setCalendarGenerationYear] = useState<number>(currentYear);
  const [isCalendarGenerating, setIsCalendarGenerating] = useState(false);
  const [calendarGenerationMessage, setCalendarGenerationMessage] = useState('');

  const closeCalendarDay = useCallback(() => {
    setEditingCalendarDay(null);
    setCalendarDayForm(defaultWorkCalendarDayForm());
  }, []);

  const loadCalendarDays = useCallback(async (): Promise<void> => {
    if (!enabled || !canReadWorkCalendar) {
      return;
    }

    setIsCalendarLoading(true);
    setCalendarError('');

    try {
      const rows = await fetchMonthlyCalendars({ year: calendarYear, month: calendarMonth });
      setCalendarDays(rows || []);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : 'Lỗi tải lịch');
    } finally {
      setIsCalendarLoading(false);
    }
  }, [calendarMonth, calendarYear, canReadWorkCalendar, enabled]);

  useEffect(() => {
    void loadCalendarDays();
  }, [loadCalendarDays]);

  const openCalendarDay = useCallback(
    (day: WorkCalendarDay) => {
      if (editingCalendarDay?.date === day.date) {
        closeCalendarDay();
        return;
      }

      setEditingCalendarDay(day);
      setCalendarDayForm(buildWorkCalendarDayForm(day));
    },
    [closeCalendarDay, editingCalendarDay]
  );

  const saveCalendarDay = useCallback(async (): Promise<void> => {
    if (!editingCalendarDay) {
      return;
    }

    setIsCalendarSaving(true);
    setCalendarError('');

    try {
      const updated = await updateCalendarDay(editingCalendarDay.date, {
        is_working_day: calendarDayForm.is_working_day,
        is_holiday: calendarDayForm.is_holiday,
        holiday_name: calendarDayForm.holiday_name.trim() || null,
        note: calendarDayForm.note.trim() || null,
      });

      setCalendarDays((currentDays) =>
        currentDays.map((item) => (item.date === updated.date ? { ...item, ...updated } : item))
      );
      closeCalendarDay();
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : 'Lỗi lưu ngày');
    } finally {
      setIsCalendarSaving(false);
    }
  }, [calendarDayForm, closeCalendarDay, editingCalendarDay]);

  const generateCalendarForYear = useCallback(async (): Promise<void> => {
    setIsCalendarGenerating(true);
    setCalendarGenerationMessage('');

    try {
      const result = await generateCalendarYear(calendarGenerationYear, { overwrite: false });
      setCalendarGenerationMessage(`✓ Đã tạo ${result.inserted} ngày, bỏ qua ${result.skipped} ngày có sẵn.`);

      if (calendarGenerationYear === calendarYear && enabled && canReadWorkCalendar) {
        const rows = await fetchMonthlyCalendars({ year: calendarYear, month: calendarMonth });
        setCalendarDays(rows || []);
      }
    } catch (error) {
      setCalendarGenerationMessage(`✗ ${error instanceof Error ? error.message : 'Lỗi tạo lịch'}`);
    } finally {
      setIsCalendarGenerating(false);
    }
  }, [calendarGenerationYear, calendarMonth, calendarYear, canReadWorkCalendar, enabled]);

  return {
    calendarYear,
    setCalendarYear,
    calendarMonth,
    setCalendarMonth,
    calendarDays,
    isCalendarLoading,
    calendarError,
    isCalendarSaving,
    editingCalendarDay,
    calendarDayForm,
    setCalendarDayForm,
    calendarGenerationYear,
    setCalendarGenerationYear,
    isCalendarGenerating,
    calendarGenerationMessage,
    loadCalendarDays,
    openCalendarDay,
    closeCalendarDay,
    saveCalendarDay,
    generateCalendarForYear,
  };
};
