import {
  Department,
  Employee,
  EmployeeStatus,
  Gender,
  HRDepartmentTypeBreakdown,
  HRGenderBreakdown,
  HRPersonnelTypeBreakdown,
  HRPositionBreakdown,
  HRStatistics,
  HRStatusBreakdown,
} from '../types';
import { resolvePositionName } from './employeeDisplay';

const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10;

const percentage = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return roundOneDecimal((count / total) * 100);
};

const normalizeStatus = (value: unknown): EmployeeStatus | 'UNKNOWN' => {
  const status = String(value ?? '').trim().toUpperCase();
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'INACTIVE') return 'INACTIVE';
  if (status === 'BANNED') return 'BANNED';
  if (status === 'SUSPENDED' || status === 'TRANSFERRED') return 'SUSPENDED';
  return 'UNKNOWN';
};

const normalizeGender = (value: unknown): Gender | 'UNKNOWN' => {
  const gender = String(value ?? '').trim().toUpperCase();
  if (gender === 'MALE') return 'MALE';
  if (gender === 'FEMALE') return 'FEMALE';
  if (gender === 'OTHER') return 'OTHER';
  return 'UNKNOWN';
};

const isOfficialEmployee = (employee: Employee): boolean => {
  const rawCode = String(employee.user_code ?? employee.employee_code ?? '').trim();
  return /^vnpt/i.test(rawCode);
};

const getAgeByYear = (dateOfBirth: unknown): number | null => {
  const raw = String(dateOfBirth ?? '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  if (!Number.isFinite(year) || year < 1900) return null;

  return new Date().getFullYear() - year;
};

const avgAge = (ages: number[]): number | null => {
  if (ages.length === 0) return null;
  const total = ages.reduce((sum, age) => sum + age, 0);
  return roundOneDecimal(total / ages.length);
};

const resolveDepartmentBreakdownItem = (
  employee: Employee,
  departmentById: Map<string, Department>,
  departmentByCode: Map<string, Department>
): { department_id: string | number | null; dept_code: string; dept_name: string } => {
  const rawDepartment = employee.department_id ?? employee.department ?? null;
  const normalized = String(rawDepartment ?? '').trim();

  if (normalized) {
    const byId = departmentById.get(normalized);
    if (byId) {
      return {
        department_id: byId.id,
        dept_code: byId.dept_code,
        dept_name: byId.dept_name,
      };
    }

    const byCode = departmentByCode.get(normalized.toUpperCase());
    if (byCode) {
      return {
        department_id: byCode.id,
        dept_code: byCode.dept_code,
        dept_name: byCode.dept_name,
      };
    }
  }

  return {
    department_id: rawDepartment,
    dept_code: '--',
    dept_name: 'Chưa xác định',
  };
};

const STATUS_LABELS: Record<HRStatusBreakdown['status'], string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Không hoạt động',
  BANNED: 'Bị khóa',
  SUSPENDED: 'Luân chuyển',
  UNKNOWN: 'Chưa xác định',
};

const GENDER_LABELS: Record<HRGenderBreakdown['gender'], string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
  UNKNOWN: 'Chưa xác định',
};

export const buildHrStatistics = (
  employees: Employee[] = [],
  departments: Department[] = []
): HRStatistics => {
  const totalEmployees = employees.length;
  const departmentById = new Map<string, Department>();
  const departmentByCode = new Map<string, Department>();

  (departments || []).forEach((department) => {
    departmentById.set(String(department.id), department);
    departmentByCode.set(String(department.dept_code).trim().toUpperCase(), department);
  });

  let officialEmployees = 0;
  let ctvEmployees = 0;

  let maleCount = 0;
  let femaleCount = 0;

  let vpnEnabledCount = 0;

  const maleAges: number[] = [];
  const femaleAges: number[] = [];

  const statusCounts: Record<HRStatusBreakdown['status'], number> = {
    ACTIVE: 0,
    INACTIVE: 0,
    BANNED: 0,
    SUSPENDED: 0,
    UNKNOWN: 0,
  };

  const genderCounts: Record<HRGenderBreakdown['gender'], number> = {
    MALE: 0,
    FEMALE: 0,
    OTHER: 0,
    UNKNOWN: 0,
  };

  const positionCounter = new Map<string, HRPositionBreakdown>();
  const departmentCounter = new Map<string, HRDepartmentTypeBreakdown>();

  (employees || []).forEach((employee) => {
    const official = isOfficialEmployee(employee);
    if (official) {
      officialEmployees += 1;
    } else {
      ctvEmployees += 1;
    }

    const status = normalizeStatus(employee.status);
    statusCounts[status] += 1;

    const gender = normalizeGender(employee.gender);
    genderCounts[gender] += 1;

    if (gender === 'MALE') maleCount += 1;
    if (gender === 'FEMALE') femaleCount += 1;

    const age = getAgeByYear(employee.date_of_birth);
    if (age !== null) {
      if (gender === 'MALE') maleAges.push(age);
      if (gender === 'FEMALE') femaleAges.push(age);
    }

    if (String(employee.vpn_status ?? '').trim().toUpperCase() === 'YES') {
      vpnEnabledCount += 1;
    }

    const positionName = resolvePositionName(employee);
    const positionCode = String(employee.position_code ?? '').trim().toUpperCase() || null;
    const positionKey = `${positionCode ?? '--'}|${positionName}`;
    const currentPosition = positionCounter.get(positionKey);

    if (currentPosition) {
      currentPosition.count += 1;
    } else {
      positionCounter.set(positionKey, {
        position_code: positionCode,
        position_name: positionName || 'Chưa cập nhật',
        count: 1,
      });
    }

    const dept = resolveDepartmentBreakdownItem(employee, departmentById, departmentByCode);
    const deptKey = String(dept.department_id ?? `${dept.dept_code}|${dept.dept_name}`);
    const currentDepartment = departmentCounter.get(deptKey);

    if (currentDepartment) {
      if (official) currentDepartment.official_count += 1;
      else currentDepartment.ctv_count += 1;
      currentDepartment.total += 1;
    } else {
      departmentCounter.set(deptKey, {
        department_id: dept.department_id,
        dept_code: dept.dept_code,
        dept_name: dept.dept_name,
        official_count: official ? 1 : 0,
        ctv_count: official ? 0 : 1,
        total: 1,
      });
    }
  });

  const statusOrder: HRStatusBreakdown['status'][] = ['ACTIVE', 'INACTIVE', 'BANNED', 'SUSPENDED', 'UNKNOWN'];
  const statusBreakdown = statusOrder
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: statusCounts[status],
      percentage: percentage(statusCounts[status], totalEmployees),
    }))
    .filter((item) => item.count > 0 || item.status !== 'UNKNOWN');

  const genderOrder: HRGenderBreakdown['gender'][] = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'];
  const avgAgeMale = avgAge(maleAges);
  const avgAgeFemale = avgAge(femaleAges);

  const genderBreakdown = genderOrder
    .map((gender) => ({
      gender,
      label: GENDER_LABELS[gender],
      count: genderCounts[gender],
      percentage: percentage(genderCounts[gender], totalEmployees),
      avgAge:
        gender === 'MALE'
          ? avgAgeMale
          : gender === 'FEMALE'
            ? avgAgeFemale
            : null,
    }))
    .filter((item) => item.count > 0 || item.gender === 'MALE' || item.gender === 'FEMALE');

  const personnelTypeBreakdown: HRPersonnelTypeBreakdown[] = [
    {
      type: 'OFFICIAL',
      label: 'Chính thức',
      count: officialEmployees,
      percentage: percentage(officialEmployees, totalEmployees),
    },
    {
      type: 'CTV',
      label: 'CTV',
      count: ctvEmployees,
      percentage: percentage(ctvEmployees, totalEmployees),
    },
  ];

  const positionBreakdown = Array.from(positionCounter.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.position_name.localeCompare(b.position_name, 'vi');
  });

  const departmentTypeBreakdown = Array.from(departmentCounter.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return `${a.dept_code} ${a.dept_name}`.localeCompare(`${b.dept_code} ${b.dept_name}`, 'vi');
  });

  return {
    totalEmployees,
    officialEmployees,
    ctvEmployees,
    officialPercentage: percentage(officialEmployees, totalEmployees),
    ctvPercentage: percentage(ctvEmployees, totalEmployees),
    maleCount,
    femaleCount,
    malePercentage: percentage(maleCount, totalEmployees),
    femalePercentage: percentage(femaleCount, totalEmployees),
    avgAgeMale,
    avgAgeFemale,
    vpnEnabledCount,
    vpnEnabledPercentage: percentage(vpnEnabledCount, totalEmployees),
    statusBreakdown,
    genderBreakdown,
    personnelTypeBreakdown,
    positionBreakdown,
    departmentTypeBreakdown,
  };
};
