import React, { useMemo } from 'react';
import { DateRangePresets, type DateRangePreset } from '../utils/dateRangePresets';

export type DateRangePresetValue = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

type DateRangePresetPickerProps = {
  value: DateRangePresetValue;
  onPresetChange: (value: DateRangePresetValue) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  label?: string;
  dateFromLabel?: string;
  dateToLabel?: string;
  size?: 'dense' | 'default';
  containerClassName?: string;
};

type PickerSizeConfig = {
  containerClassName: string;
  labelClassName: string;
  segmentClassName: string;
  buttonClassName: string;
  inputClassName: string;
  arrowClassName: string;
};

const PRESET_OPTIONS: Array<{ value: DateRangePresetValue; label: string }> = [
  { value: 'this_month', label: 'T.này' },
  { value: 'last_month', label: 'T.trước' },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'this_year', label: 'Năm này' },
  { value: 'custom', label: 'Tùy chọn' },
];

const PICKER_SIZE_MAP: Record<NonNullable<DateRangePresetPickerProps['size']>, PickerSizeConfig> = {
  dense: {
    containerClassName: 'flex flex-wrap items-center gap-1.5',
    labelClassName: 'shrink-0 text-[11px] font-semibold text-neutral',
    segmentClassName: 'flex shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50',
    buttonClassName: 'inline-flex h-8 items-center whitespace-nowrap border-r border-slate-200 px-2.5 text-[11px] font-semibold transition-colors last:border-r-0',
    inputClassName: 'h-8 w-32 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30',
    arrowClassName: 'text-xs text-slate-400',
  },
  default: {
    containerClassName: 'flex flex-wrap items-center gap-3',
    labelClassName: 'shrink-0 text-sm font-semibold text-slate-600',
    segmentClassName: 'flex shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
    buttonClassName: 'inline-flex h-12 items-center whitespace-nowrap border-r border-slate-200 px-5 text-sm font-semibold transition-colors last:border-r-0',
    inputClassName: 'h-12 w-[240px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20',
    arrowClassName: 'text-lg text-slate-400',
  },
};

const formatDisplayDate = (value: string): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const getDefaultCustomDateRange = (referenceDate: Date = new Date()): DateRangePreset =>
  DateRangePresets.currentMonthStartToCurrentMonthEnd(referenceDate);

export const resolveDateRangePresetRange = (
  preset: DateRangePresetValue,
  customFrom: string,
  customTo: string,
  referenceDate: Date = new Date()
): DateRangePreset => {
  if (preset === 'this_month') {
    return DateRangePresets.currentMonthStartToCurrentMonthEnd(referenceDate);
  }

  if (preset === 'last_month') {
    return DateRangePresets.previousMonthStartToPreviousMonthEnd(referenceDate);
  }

  if (preset === 'this_quarter') {
    return DateRangePresets.currentQuarterStartToCurrentQuarterEnd(referenceDate);
  }

  if (preset === 'this_year') {
    return DateRangePresets.currentYearStartToCurrentYearEnd(referenceDate);
  }

  return {
    from: customFrom,
    to: customTo,
  };
};

export const resolveDateRangePresetLabel = (
  preset: DateRangePresetValue,
  customFrom: string,
  customTo: string,
  referenceDate: Date = new Date()
): string => {
  if (preset === 'this_month') {
    return `Tháng ${referenceDate.getMonth() + 1}/${referenceDate.getFullYear()}`;
  }

  if (preset === 'last_month') {
    const previousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    return `Tháng ${previousMonth.getMonth() + 1}/${previousMonth.getFullYear()}`;
  }

  if (preset === 'this_quarter') {
    return `Quý ${Math.floor(referenceDate.getMonth() / 3) + 1}/${referenceDate.getFullYear()}`;
  }

  if (preset === 'this_year') {
    return `Năm ${referenceDate.getFullYear()}`;
  }

  if (customFrom && customTo) {
    return `${formatDisplayDate(customFrom)} → ${formatDisplayDate(customTo)}`;
  }

  if (customFrom) {
    return `Từ ${formatDisplayDate(customFrom)}`;
  }

  if (customTo) {
    return `Đến ${formatDisplayDate(customTo)}`;
  }

  return 'Tùy chọn';
};

export const DateRangePresetPicker: React.FC<DateRangePresetPickerProps> = ({
  value,
  onPresetChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  label,
  dateFromLabel = 'Ngày bắt đầu',
  dateToLabel = 'Ngày kết thúc',
  size = 'default',
  containerClassName = '',
}) => {
  const sizeConfig = PICKER_SIZE_MAP[size];
  const defaultCustomRange = useMemo(() => getDefaultCustomDateRange(), []);

  const handlePresetSelect = (nextValue: DateRangePresetValue) => {
    if (nextValue === 'custom') {
      if (!dateFrom) {
        onDateFromChange(defaultCustomRange.from);
      }
      if (!dateTo) {
        onDateToChange(defaultCustomRange.to);
      }
    }

    onPresetChange(nextValue);
  };

  return (
    <div className={`${sizeConfig.containerClassName} ${containerClassName}`.trim()}>
      {label ? <span className={sizeConfig.labelClassName}>{label}</span> : null}

      <div className={sizeConfig.segmentClassName}>
        {PRESET_OPTIONS.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePresetSelect(option.value)}
              className={`${sizeConfig.buttonClassName} ${
                isActive ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {value === 'custom' ? (
        <>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            aria-label={dateFromLabel}
            className={sizeConfig.inputClassName}
          />
          <span className={sizeConfig.arrowClassName}>→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            aria-label={dateToLabel}
            className={sizeConfig.inputClassName}
          />
        </>
      ) : null}
    </div>
  );
};
