import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserDeptHistoryList } from '../components/UserDeptHistoryList';
import type { Department, Employee, UserDeptHistory } from '../types';

const departments: Department[] = [
  {
    id: 1,
    dept_code: 'VTCT',
    dept_name: 'Viễn thông Cần Thơ',
    parent_id: null,
    dept_path: '1',
    is_active: true,
  },
  {
    id: 2,
    dept_code: 'TTKD',
    dept_name: 'Trung tam Kinh doanh',
    parent_id: 1,
    dept_path: '1/2',
    is_active: true,
  },
  {
    id: 3,
    dept_code: 'PGP',
    dept_name: 'Phong Giai phap',
    parent_id: 2,
    dept_path: '1/2/3',
    is_active: true,
  },
  {
    id: 4,
    dept_code: 'KTVH',
    dept_name: 'Ky thuat van hanh',
    parent_id: 1,
    dept_path: '1/4',
    is_active: true,
  },
  {
    id: 5,
    dept_code: 'VNPT_CAIRANG',
    dept_name: 'VNPT Cai Rang',
    parent_id: null,
    dept_path: '5',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 101,
    uuid: 'emp-101',
    user_code: 'VNPT000101',
    employee_code: 'VNPT000101',
    username: 'nguyenvana',
    full_name: 'Nguyen Van A',
    email: 'nguyenvana@vnpt.vn',
    status: 'ACTIVE',
    department_id: 3,
    position_id: 1,
  },
];

const history: UserDeptHistory[] = [
  {
    id: 'LC1',
    userId: '101',
    fromDeptId: '3',
    toDeptId: '4',
    transferDate: '2026-04-05',
    reason: 'Dieu chuyen noi bo',
    employeeCode: 'VNPT000101',
    employeeName: 'Nguyen Van A',
    fromDeptCode: 'PGP',
    fromDeptName: 'Phong Giai phap',
    toDeptCode: 'KTVH',
    toDeptName: 'Ky thuat van hanh',
  },
  {
    id: 'LC2',
    userId: '101',
    fromDeptId: '5',
    toDeptId: '5',
    transferDate: '2026-04-04',
    reason: 'Dieu chuyen noi bo',
    employeeCode: 'VNPT000101',
    employeeName: 'Nguyen Van A',
    fromDeptCode: 'VNPT_CAIRANG',
    fromDeptName: 'VNPT Cai Rang',
    toDeptCode: 'VNPT_CAIRANG',
    toDeptName: 'VNPT Cai Rang',
  },
];

describe('UserDeptHistoryList', () => {
  it('shows direct parent unit when the parent is not the telecom root and formats transfer date', () => {
    render(
      <UserDeptHistoryList
        history={history}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('Từ đơn vị')).toBeInTheDocument();
    expect(screen.getByText('Đến đơn vị')).toBeInTheDocument();
    expect(screen.getByText('Trung tam Kinh doanh')).toBeInTheDocument();
    expect(screen.getByText('Ky thuat van hanh')).toBeInTheDocument();
    expect(screen.queryByText('KTVH - Ky thuat van hanh')).not.toBeInTheDocument();
    expect(screen.getAllByText('VNPT Cai Rang').length).toBeGreaterThan(0);
    expect(screen.getByText('05/04/2026')).toBeInTheDocument();
  });
});
