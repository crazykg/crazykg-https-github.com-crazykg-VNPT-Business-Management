export type DateRangePreset = {
  from: string;
  to: string;
};

export class DateRangePresets {
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
