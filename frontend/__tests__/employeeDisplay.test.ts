import { describe, expect, it } from 'vitest';
import {
  getEmployeeCode,
  getEmployeeLabel,
  normalizeEmployeeCode,
  resolveJobTitleVi,
  resolvePositionName,
} from '../utils/employeeDisplay';
import type { Employee } from '../types';

const buildEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 1,
  uuid: 'emp-1',
  username: 'tester',
  full_name: 'Nguyen Van A',
  email: 'tester@example.com',
  status: 'ACTIVE',
  department_id: 10,
  position_id: 5,
  ...overrides,
});

describe('employee display helpers', () => {
  describe('normalizeEmployeeCode', () => {
    it('keeps normalized VNPT or CTV codes', () => {
      expect(normalizeEmployeeCode('vnpt123456')).toBe('VNPT123456');
      expect(normalizeEmployeeCode('ctv654321')).toBe('CTV654321');
    });

    it('converts legacy NV and CTV codes', () => {
      expect(normalizeEmployeeCode('NV12')).toBe('VNPT000012');
      expect(normalizeEmployeeCode('CTV9')).toBe('CTV000009');
    });

    it('builds VNPT codes from numeric values or ids', () => {
      expect(normalizeEmployeeCode('45')).toBe('VNPT000045');
      expect(normalizeEmployeeCode('', 321)).toBe('VNPT000321');
    });

    it('falls back to default code when nothing usable is provided', () => {
      expect(normalizeEmployeeCode(null, null)).toBe('VNPT000000');
    });
  });

  describe('getEmployeeCode and label', () => {
    it('prefers employee_code over user_code and appends the employee name', () => {
      const employee = buildEmployee({
        employee_code: 'NV7',
        user_code: 'VNPT999999',
      });

      expect(getEmployeeCode(employee)).toBe('VNPT000007');
      expect(getEmployeeLabel(employee)).toBe('VNPT000007 - Nguyen Van A');
    });
  });

  describe('resolvePositionName', () => {
    it('uses the relation name when available', () => {
      expect(resolvePositionName(buildEmployee({ position_name: 'Kiem soat vien' }))).toBe('Kiem soat vien');
    });

    it('maps position identifiers to human readable names', () => {
      expect(resolvePositionName(buildEmployee({ position_code: 'POS004' }))).toBe('Phó phòng');
      expect(resolvePositionName(buildEmployee({ position_id: '3' }))).toBe('Trưởng phòng');
    });
  });

  describe('resolveJobTitleVi', () => {
    it('maps known English titles to Vietnamese labels', () => {
      expect(resolveJobTitleVi(buildEmployee({ job_title_raw: 'developer' }))).toBe('Lập trình viên');
      expect(resolveJobTitleVi(buildEmployee({ job_title_vi: 'deputy director' }))).toBe('Phó giám đốc');
    });

    it('falls back to position mapping when job title is absent', () => {
      expect(resolveJobTitleVi(buildEmployee({ position_code: 'P001', job_title_raw: null }))).toBe('Giám đốc');
    });
  });
});
