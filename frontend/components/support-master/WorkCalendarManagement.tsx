import React, { useMemo } from 'react';
import type { WorkCalendarDay } from '../../types/scheduling';
import type { WorkCalendarDayFormState } from './hooks/useSupportMasterWorkCalendar';

interface WorkCalendarManagementProps {
  calendarYear: number;
  calendarMonth: number;
  calendarGenerationYear: number;
  calendarGenerationMessage: string;
  calendarDays: WorkCalendarDay[];
  canWriteWorkCalendar: boolean;
  isCalendarLoading: boolean;
  isCalendarGenerating: boolean;
  calendarError: string;
  editingCalendarDay: WorkCalendarDay | null;
  onCalendarYearChange: (value: number) => void;
  onCalendarMonthChange: (value: number) => void;
  onCalendarGenerationYearChange: (value: number) => void;
  onGenerateCalendar: () => void | Promise<void>;
  onSelectCalendarDay: (day: WorkCalendarDay) => void;
}

interface WorkCalendarEditPanelProps {
  editingCalendarDay: WorkCalendarDay | null;
  calendarDayForm: WorkCalendarDayFormState;
  canWriteWorkCalendar: boolean;
  isCalendarSaving: boolean;
  calendarError: string;
  onCalendarDayFormChange: (updater: (prev: WorkCalendarDayFormState) => WorkCalendarDayFormState) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

const buildCalendarWeeks = (calendarDays: WorkCalendarDay[]): Array<Array<WorkCalendarDay | null>> => {
  const sorted = [...calendarDays].sort((left, right) => left.date.localeCompare(right.date));
  if (sorted.length === 0) {
    return [];
  }

  const firstDay = sorted[0];
  const startColumn = (firstDay.day_of_week ?? 1) - 1;
  const cells: Array<WorkCalendarDay | null> = [...Array<null>(startColumn).fill(null), ...sorted];
  const weeks: Array<Array<WorkCalendarDay | null>> = [];

  for (let index = 0; index < cells.length; index += 7) {
    const week = cells.slice(index, index + 7);
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  return weeks;
};

const formatEditingCalendarLabel = (day: WorkCalendarDay | null): string => {
  if (!day) {
    return '';
  }

  const date = new Date(`${day.date}T00:00:00`);
  const dayOfWeekLabels = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return `${dayOfWeekLabels[date.getDay()]}, ${day.day}/${day.month}/${day.year}`;
};

export const WorkCalendarManagement: React.FC<WorkCalendarManagementProps> = ({
  calendarYear,
  calendarMonth,
  calendarGenerationYear,
  calendarGenerationMessage,
  calendarDays,
  canWriteWorkCalendar,
  isCalendarLoading,
  isCalendarGenerating,
  calendarError,
  editingCalendarDay,
  onCalendarYearChange,
  onCalendarMonthChange,
  onCalendarGenerationYearChange,
  onGenerateCalendar,
  onSelectCalendarDay,
}) => {
  const calendarWeeks = useMemo(() => buildCalendarWeeks(calendarDays), [calendarDays]);
  const todayString = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600">Năm:</label>
          <input
            type="number"
            min={2000}
            max={2100}
            value={calendarYear}
            onChange={(event) => onCalendarYearChange(Number(event.target.value))}
            className="w-24 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-600">Tháng:</label>
          <select
            value={calendarMonth}
            onChange={(event) => onCalendarMonthChange(Number(event.target.value))}
            className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                Tháng {month}
              </option>
            ))}
          </select>
        </div>

        {canWriteWorkCalendar && (
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-semibold text-slate-600">Tạo lịch năm:</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={calendarGenerationYear}
              onChange={(event) => onCalendarGenerationYearChange(Number(event.target.value))}
              className="w-24 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <button
              type="button"
              disabled={isCalendarGenerating}
              onClick={() => {
                void onGenerateCalendar();
              }}
              className="flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-deep-teal text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCalendarGenerating ? (
                <span className="material-symbols-outlined text-base animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined text-base">event</span>
              )}
              Tạo lịch
            </button>
          </div>
        )}
      </div>

      {calendarGenerationMessage && (
        <p
          className={`text-sm mb-3 px-3 py-2 rounded-lg border ${
            calendarGenerationMessage.startsWith('✓')
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {calendarGenerationMessage}
        </p>
      )}

      {isCalendarLoading && (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
          <span className="text-sm">Đang tải lịch...</span>
        </div>
      )}

      {calendarError && !isCalendarLoading && (
        <div className="flex flex-col items-center py-12 text-red-600 gap-2">
          <span className="material-symbols-outlined text-3xl">error</span>
          <p className="text-sm">{calendarError}</p>
        </div>
      )}

      {!isCalendarLoading && !calendarError && calendarDays.length === 0 && (
        <div className="flex flex-col items-center py-16 text-slate-500 gap-2">
          <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
          <p className="text-sm">Chưa có dữ liệu lịch tháng {calendarMonth}/{calendarYear}.</p>
          {canWriteWorkCalendar && (
            <p className="text-xs text-slate-400">Dùng nút "Tạo lịch" ở trên để khởi tạo.</p>
          )}
        </div>
      )}

      {!isCalendarLoading && !calendarError && calendarDays.length > 0 && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[820px] border-separate border-spacing-0">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label) => (
                  <th
                    key={label}
                    className="px-2 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[14.28%]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarWeeks.map((week, weekIndex) => (
                <tr key={`${calendarYear}-${calendarMonth}-week-${weekIndex}`} className="border-b border-slate-100 last:border-0">
                  {week.map((dayItem, dayIndex) => {
                    if (!dayItem) {
                      return <td key={`${weekIndex}-${dayIndex}`} className="px-2 py-2 h-16 align-top bg-slate-50/50" />;
                    }

                    const isEditing = editingCalendarDay?.date === dayItem.date;
                    const isToday = dayItem.date === todayString;
                    const cellBackground = isEditing
                      ? 'bg-primary/5 ring-2 ring-inset ring-primary/30'
                      : dayItem.is_holiday
                        ? 'bg-red-50'
                        : dayItem.is_weekend
                          ? 'bg-amber-50/60'
                          : dayItem.is_working_day
                            ? 'bg-white'
                            : 'bg-slate-100';

                    return (
                      <td
                        key={dayItem.date}
                        className={`px-2 py-1.5 h-20 align-top border border-slate-100 ${
                          canWriteWorkCalendar ? 'cursor-pointer hover:bg-primary/5' : ''
                        } transition-colors ${cellBackground}`}
                        onClick={() => {
                          if (!canWriteWorkCalendar) {
                            return;
                          }
                          onSelectCalendarDay(dayItem);
                        }}
                        title={canWriteWorkCalendar ? 'Click để chỉnh sửa' : undefined}
                      >
                        <div className="flex items-start justify-between mb-0.5">
                          <span
                            className={`text-sm font-bold leading-none ${
                              isToday
                                ? 'text-primary underline'
                                : dayIndex === 0 || dayIndex === 6
                                  ? 'text-amber-600'
                                  : 'text-slate-700'
                            }`}
                          >
                            {dayItem.day}
                          </span>
                          <div className="flex gap-0.5">
                            {dayItem.is_holiday && (
                              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" title="Ngày lễ" />
                            )}
                            {!dayItem.is_working_day && !dayItem.is_holiday && !dayItem.is_weekend && (
                              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" title="Nghỉ" />
                            )}
                          </div>
                        </div>
                        {dayItem.holiday_name && (
                          <p className="text-[10px] text-red-600 font-medium leading-tight truncate">{dayItem.holiday_name}</p>
                        )}
                        {dayItem.note && (
                          <p className="text-[10px] text-slate-500 leading-tight truncate">{dayItem.note}</p>
                        )}
                        {!dayItem.is_working_day && !dayItem.is_weekend && !dayItem.is_holiday && (
                          <p className="text-[10px] text-slate-400 leading-tight">Nghỉ</p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isCalendarLoading && calendarDays.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />
            Ngày làm việc
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />
            Cuối tuần
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />
            Ngày lễ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" />
            Ngày nghỉ khác
          </span>
        </div>
      )}
    </div>
  );
};

export const WorkCalendarEditPanel: React.FC<WorkCalendarEditPanelProps> = ({
  editingCalendarDay,
  calendarDayForm,
  canWriteWorkCalendar,
  isCalendarSaving,
  calendarError,
  onCalendarDayFormChange,
  onClose,
  onSave,
}) => {
  if (!editingCalendarDay || !canWriteWorkCalendar) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Chỉnh sửa ngày</h3>
            <p className="text-sm text-slate-500 mt-0.5">{formatEditingCalendarLabel(editingCalendarDay)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {editingCalendarDay.is_weekend && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">weekend</span>
                Cuối tuần
              </span>
            )}
            {editingCalendarDay.is_holiday && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">celebration</span>
                Ngày lễ
              </span>
            )}
            {editingCalendarDay.is_working_day && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">work</span>
                Làm việc
              </span>
            )}
            {!editingCalendarDay.is_working_day && !editingCalendarDay.is_holiday && !editingCalendarDay.is_weekend && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">block</span>
                Nghỉ
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={calendarDayForm.is_working_day}
                onChange={(event) =>
                  onCalendarDayFormChange((currentState) => ({
                    ...currentState,
                    is_working_day: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700">Ngày làm việc</p>
                <p className="text-xs text-slate-500">Bỏ tick = ngày nghỉ</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={calendarDayForm.is_holiday}
                onChange={(event) =>
                  onCalendarDayFormChange((currentState) => ({
                    ...currentState,
                    is_holiday: event.target.checked,
                    is_working_day: event.target.checked ? false : currentState.is_working_day,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700">Ngày lễ chính thức</p>
                <p className="text-xs text-slate-500">Tự động tắt "Ngày làm việc"</p>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Tên ngày lễ</label>
            <input
              value={calendarDayForm.holiday_name}
              onChange={(event) =>
                onCalendarDayFormChange((currentState) => ({
                  ...currentState,
                  holiday_name: event.target.value,
                }))
              }
              placeholder="VD: Tết Dương lịch, Quốc khánh..."
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Ghi chú</label>
            <textarea
              value={calendarDayForm.note}
              onChange={(event) =>
                onCalendarDayFormChange((currentState) => ({
                  ...currentState,
                  note: event.target.value,
                }))
              }
              rows={3}
              placeholder="Ghi chú thêm về ngày này..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
            />
          </div>

          {calendarError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{calendarError}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isCalendarSaving}
            onClick={() => {
              void onSave();
            }}
            className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isCalendarSaving ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                Đang lưu...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                Lưu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
