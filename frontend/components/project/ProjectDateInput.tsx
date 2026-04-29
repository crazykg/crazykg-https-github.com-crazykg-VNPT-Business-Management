import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export const PROJECT_DATE_INPUT_MIN = '2025-01-01';
export const PROJECT_DATE_INPUT_MAX = '2999-12-31';
export const PROJECT_DATE_INPUT_PLACEHOLDER = 'dd/mm/yyyy';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DIGIT_PATTERN = /^\d{0,8}$/;

type NativeDateInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export interface ProjectDateInputProps {
  value: string | null | undefined;
  onChange: (nextIso: string | null) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  error?: string | boolean;
  testId?: string;
  className?: string;
  title?: string;
  onBlur?: () => void;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface DisplayDraftResult {
  accepted: boolean;
  displayValue: string;
  isoValue: string | null;
  isComplete: boolean;
}

function parseIsoDateParts(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getIsoYear(value: string | undefined, fallback: number): number {
  const parsed = parseIsoDateParts(value);
  return parsed?.year ?? fallback;
}

function hasRealCalendarDate({ year, month, day }: DateParts): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

export function isValidProjectDateIso(
  value: string | null | undefined,
  min = PROJECT_DATE_INPUT_MIN,
  max = PROJECT_DATE_INPUT_MAX
): boolean {
  const parts = parseIsoDateParts(value);
  if (!parts) return false;
  if (!hasRealCalendarDate(parts)) return false;
  if (min && value! < min) return false;
  if (max && value! > max) return false;
  return true;
}

export function formatProjectDateDisplay(value: string | null | undefined): string {
  const parts = parseIsoDateParts(value);
  if (!parts || !hasRealCalendarDate(parts)) return '';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${String(parts.year).padStart(4, '0')}`;
}

function formatDigitsAsDisplay(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function canYearPrefixReachRange(prefix: string, minYear: number, maxYear: number): boolean {
  if (!prefix) return true;
  const lower = Number(prefix.padEnd(4, '0'));
  const upper = Number(prefix.padEnd(4, '9'));
  return upper >= minYear && lower <= maxYear;
}

function isValidPartialDateDigits(digits: string, minYear: number, maxYear: number): boolean {
  if (!DISPLAY_DIGIT_PATTERN.test(digits)) return false;

  if (digits.length >= 1 && !['0', '1', '2', '3'].includes(digits[0])) {
    return false;
  }

  if (digits.length >= 2) {
    const day = Number(digits.slice(0, 2));
    if (day < 1 || day > 31) return false;
  }

  if (digits.length >= 3 && !['0', '1'].includes(digits[2])) {
    return false;
  }

  if (digits.length >= 4) {
    const month = Number(digits.slice(2, 4));
    if (month < 1 || month > 12) return false;
  }

  if (digits.length > 4) {
    const yearPrefix = digits.slice(4);
    if (!canYearPrefixReachRange(yearPrefix, minYear, maxYear)) return false;
  }

  if (digits.length === 8) {
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));
    return hasRealCalendarDate({ year, month, day });
  }

  return true;
}

export function buildProjectDateDisplayDraft(
  rawInput: string,
  previousDisplay = '',
  min = PROJECT_DATE_INPUT_MIN,
  max = PROJECT_DATE_INPUT_MAX
): DisplayDraftResult {
  const digits = rawInput.replace(/\D/g, '');
  const previousDigits = previousDisplay.replace(/\D/g, '');
  const minYear = getIsoYear(min, 2025);
  const maxYear = getIsoYear(max, 2999);

  if (!DISPLAY_DIGIT_PATTERN.test(digits)) {
    return {
      accepted: false,
      displayValue: formatDigitsAsDisplay(previousDigits),
      isoValue: null,
      isComplete: previousDigits.length === 8,
    };
  }

  if (!isValidPartialDateDigits(digits, minYear, maxYear)) {
    return {
      accepted: false,
      displayValue: formatDigitsAsDisplay(previousDigits),
      isoValue: null,
      isComplete: previousDigits.length === 8,
    };
  }

  const displayValue = formatDigitsAsDisplay(digits);
  const isComplete = digits.length === 8;
  if (!isComplete) {
    return { accepted: true, displayValue, isoValue: null, isComplete: false };
  }

  const isoValue = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  if (!isValidProjectDateIso(isoValue, min, max)) {
    return {
      accepted: false,
      displayValue: formatDigitsAsDisplay(previousDigits),
      isoValue: null,
      isComplete: previousDigits.length === 8,
    };
  }

  return { accepted: true, displayValue, isoValue, isComplete: true };
}

function errorMessage(error: string | boolean | undefined): string {
  return typeof error === 'string' ? error : '';
}

export function ProjectDateInput({
  value,
  onChange,
  min = PROJECT_DATE_INPUT_MIN,
  max = PROJECT_DATE_INPUT_MAX,
  placeholder = PROJECT_DATE_INPUT_PLACEHOLDER,
  disabled = false,
  required = false,
  ariaLabel,
  error,
  testId,
  className = '',
  title,
  onBlur,
}: ProjectDateInputProps) {
  const nativeInputRef = useRef<NativeDateInputWithPicker | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();
  const errorText = errorMessage(error);
  const errorId = errorText ? `${generatedId}-error` : undefined;
  const [displayValue, setDisplayValue] = useState(() => formatProjectDateDisplay(value));

  useEffect(() => {
    setDisplayValue(formatProjectDateDisplay(value));
  }, [value]);

  const hasError = Boolean(error);
  const inputClassName = useMemo(() => {
    const stateClassName = hasError
      ? 'border-error bg-error/5 text-slate-800 focus:border-error focus:ring-1 focus:ring-error/30'
      : 'border-slate-300 bg-white text-slate-700 focus:border-primary/70 focus:ring-1 focus:ring-primary/15';
    const disabledClassName = disabled
      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
      : '';
    return [
      'h-11 w-[136px] min-w-[136px] max-w-[136px] rounded border px-2 pr-11 text-sm outline-none placeholder:text-slate-500 focus-visible:outline-none sm:h-8 sm:w-[120px] sm:min-w-[120px] sm:max-w-[120px] sm:pr-8',
      stateClassName,
      disabledClassName,
      className,
    ].filter(Boolean).join(' ');
  }, [className, disabled, hasError]);

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const draft = buildProjectDateDisplayDraft(event.target.value, displayValue, min, max);
    if (!draft.accepted) return;

    setDisplayValue(draft.displayValue);
    if (!draft.displayValue) {
      onChange(null);
      return;
    }
    if (draft.isComplete && draft.isoValue) {
      onChange(draft.isoValue);
    }
  };

  const handleTextBlur = () => {
    const digits = displayValue.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 8) {
      setDisplayValue(formatProjectDateDisplay(value));
    }
    onBlur?.();
  };

  const handleCalendarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value || null;
    if (nextValue && !isValidProjectDateIso(nextValue, min, max)) return;
    setDisplayValue(formatProjectDateDisplay(nextValue));
    onChange(nextValue);
    textInputRef.current?.focus();
  };

  const handleCalendarOpen = () => {
    if (disabled) return;
    const nativeInput = nativeInputRef.current;
    if (!nativeInput) return;
    if (typeof nativeInput.showPicker === 'function') {
      nativeInput.showPicker();
      return;
    }
    nativeInput.click();
  };

  return (
    <span className="relative inline-flex w-[136px] items-center sm:w-[120px]">
      <input
        ref={textInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        aria-describedby={errorId}
        data-testid={testId}
        title={title}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        className={inputClassName}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ? `Chọn ${ariaLabel}` : 'Chọn ngày'}
        onClick={handleCalendarOpen}
        className="absolute right-0 inline-flex h-11 w-11 items-center justify-center rounded text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-slate-400 sm:right-1.5 sm:h-6 sm:w-6 sm:focus-visible:outline-offset-2"
      >
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>calendar_today</span>
      </button>
      <input
        ref={nativeInputRef}
        type="date"
        value={isValidProjectDateIso(value, min, max) ? value ?? '' : ''}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        data-testid={testId ? `${testId}-native` : undefined}
        onChange={handleCalendarChange}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      {errorText ? (
        <span id={errorId} role="alert" className="sr-only">
          {errorText}
        </span>
      ) : null}
    </span>
  );
}
