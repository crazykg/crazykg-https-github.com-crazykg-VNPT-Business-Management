const SQL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const parseSqlDateTime = (value: string): Date | null => {
  if (!SQL_DATETIME_REGEX.test(value)) {
    return null;
  }

  const [datePart, timePart] = value.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, second);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return null;
  }

  return parsed;
};

export const formatDateDdMmYyyy = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const parsed = parseSqlDateTime(value) || new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
};

export const formatDateTimeDdMmYyyy = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const parsed = parseSqlDateTime(value) || new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
};
