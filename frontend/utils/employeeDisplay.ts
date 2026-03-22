import { Employee } from '../types';

const POSITION_NAME_MAP: Record<string, string> = {
  '1': 'Giám đốc',
  '2': 'Phó giám đốc',
  '3': 'Trưởng phòng',
  '4': 'Phó phòng',
  '5': 'Chuyên viên',
  P001: 'Giám đốc',
  P002: 'Phó giám đốc',
  P003: 'Trưởng phòng',
  P004: 'Phó phòng',
  P005: 'Chuyên viên',
  POS001: 'Giám đốc',
  POS002: 'Phó giám đốc',
  POS003: 'Trưởng phòng',
  POS004: 'Phó phòng',
  POS005: 'Chuyên viên',
};

const JOB_TITLE_VI_MAP: Record<string, string> = {
  'system administrator': 'Quản trị hệ thống',
  'sales executive': 'Chuyên viên kinh doanh',
  'automation operator': 'Vận hành tự động hóa',
  director: 'Giám đốc',
  'deputy director': 'Phó giám đốc',
  manager: 'Trưởng phòng',
  'assistant manager': 'Phó phòng',
  specialist: 'Chuyên viên',
  engineer: 'Kỹ sư',
  developer: 'Lập trình viên',
  operator: 'Nhân viên vận hành',
  'business analyst': 'Chuyên viên phân tích nghiệp vụ',
};

const asText = (value: unknown): string => String(value ?? '').trim();

const onlyDigits = (value: unknown): string => asText(value).replace(/\D+/g, '');

const normalizePositionKey = (value: unknown): string => asText(value).toUpperCase();

const positionFromKey = (value: unknown): string => {
  const key = normalizePositionKey(value);
  if (!key) return '';

  if (POSITION_NAME_MAP[key]) {
    return POSITION_NAME_MAP[key];
  }

  const digits = onlyDigits(key);
  if (!digits) {
    return '';
  }

  const normalizedNumber = String(Number(digits));
  if (POSITION_NAME_MAP[normalizedNumber]) {
    return POSITION_NAME_MAP[normalizedNumber];
  }

  const normalizedCode = `POS${digits.padStart(3, '0')}`;
  if (POSITION_NAME_MAP[normalizedCode]) {
    return POSITION_NAME_MAP[normalizedCode];
  }

  return '';
};

export const normalizeEmployeeCode = (rawCode: unknown, id?: unknown): string => {
  const code = asText(rawCode).toUpperCase();
  if (code && /^(VNPT|CTV)\d{5,}$/.test(code)) {
    return code;
  }

  const legacyVnpt = code.match(/^NV(\d+)$/);
  if (legacyVnpt) {
    return `VNPT${legacyVnpt[1].padStart(6, '0')}`;
  }

  const legacyCtv = code.match(/^CTV(\d+)$/);
  if (legacyCtv) {
    return `CTV${legacyCtv[1].padStart(6, '0')}`;
  }

  if (/^\d+$/.test(code)) {
    return `VNPT${code.padStart(6, '0')}`;
  }

  const idDigits = onlyDigits(id);
  if (idDigits) {
    return `VNPT${idDigits.padStart(6, '0')}`;
  }

  return code || 'VNPT000000';
};

export const getEmployeeCode = (employee?: Partial<Employee> | null): string => {
  if (!employee) {
    return 'VNPT000000';
  }

  const preferred = asText(employee.employee_code);
  if (preferred) {
    return normalizeEmployeeCode(preferred, employee.id);
  }

  return normalizeEmployeeCode(employee.user_code, employee.id);
};

export const getEmployeeLabel = (employee?: Partial<Employee> | null): string => {
  if (!employee) return '';

  const code = getEmployeeCode(employee);
  const name = asText(employee.full_name || employee.username);

  return name ? `${code} - ${name}` : code;
};

export const resolvePositionName = (employee?: Partial<Employee> | null): string => {
  if (!employee) {
    return 'Chưa cập nhật';
  }

  const relationName = asText(employee.position_name);
  if (relationName) {
    return relationName;
  }

  for (const candidate of [employee.position_code, employee.position_id, employee.job_title_raw]) {
    const mapped = positionFromKey(candidate);
    if (mapped) {
      return mapped;
    }
  }

  return 'Chưa cập nhật';
};

export const resolveJobTitleVi = (employee?: Partial<Employee> | null): string => {
  if (!employee) {
    return 'Chưa cập nhật';
  }

  const fromVi = asText(employee.job_title_vi);
  if (fromVi) {
    const mapped = JOB_TITLE_VI_MAP[fromVi.toLowerCase()];
    return mapped || positionFromKey(fromVi) || fromVi;
  }

  const raw = asText(employee.job_title_raw);
  if (raw) {
    const mapped = JOB_TITLE_VI_MAP[raw.toLowerCase()];
    if (mapped) {
      return mapped;
    }

    const positionFromRaw = positionFromKey(raw);
    if (positionFromRaw) {
      return positionFromRaw;
    }

    return raw;
  }

  return resolvePositionName(employee);
};
