export type DateRangePreset = {
  from: string;
  to: string;
};

export class DateRangePresets {
  static currentMonthStartToCurrentMonthEnd(referenceDate: Date = new Date()): DateRangePreset {
    return {
      from: this.formatForDateInput(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
      to: this.formatForDateInput(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)),
    };
  }

  static previousMonthStartToPreviousMonthEnd(referenceDate: Date = new Date()): DateRangePreset {
    return {
      from: this.formatForDateInput(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1)),
      to: this.formatForDateInput(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0)),
    };
  }

  static currentQuarterStartToCurrentQuarterEnd(referenceDate: Date = new Date()): DateRangePreset {
    const currentQuarter = Math.floor(referenceDate.getMonth() / 3);
    const startMonth = currentQuarter * 3;

    return {
      from: this.formatForDateInput(new Date(referenceDate.getFullYear(), startMonth, 1)),
      to: this.formatForDateInput(new Date(referenceDate.getFullYear(), startMonth + 3, 0)),
    };
  }

  static currentYearStartToCurrentYearEnd(referenceDate: Date = new Date()): DateRangePreset {
    return {
      from: this.formatForDateInput(new Date(referenceDate.getFullYear(), 0, 1)),
      to: this.formatForDateInput(new Date(referenceDate.getFullYear(), 11, 31)),
    };
  }

  static currentYearStartToCurrentMonthEnd(referenceDate: Date = new Date()): DateRangePreset {
    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth();

    return {
      from: this.formatForDateInput(new Date(currentYear, 0, 1)),
      to: this.formatForDateInput(new Date(currentYear, currentMonth + 1, 0)),
    };
  }

  private static formatForDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
