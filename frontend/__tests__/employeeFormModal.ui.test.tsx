import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeFormModal } from '../components/Modals';
import type { Department, Employee } from '../types';

const departments: Department[] = [
  {
    id: 'dept-1',
    dept_code: 'PKD',
    dept_name: 'Phòng Kinh doanh',
    parent_id: 'root',
    dept_path: 'BGDVT/PKD',
    is_active: true,
  },
];

const employeeWithoutDepartment: Employee = {
  id: 'emp-1',
  uuid: 'emp-uuid-1',
  employee_code: 'NV001',
  user_code: 'NV001',
  username: 'nguyenvana',
  full_name: 'Nguyễn Văn A',
  phone_number: '0912345678',
  email: 'nguyenvana@vnpt.vn',
  department_id: '',
  position_id: '3',
  status: 'ACTIVE',
  vpn_status: 'NO',
};

describe('EmployeeFormModal', () => {
  it('keeps reset action and blocks submit when department is missing', async () => {
    const user = userEvent.setup();
    const onResetPassword = vi.fn();
    const onSave = vi.fn();

    render(
      <EmployeeFormModal
        type="EDIT"
        data={employeeWithoutDepartment}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
        onResetPassword={onResetPassword}
      />
    );

    expect(screen.getByText('Cập nhật nhân sự')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset mật khẩu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset mật khẩu' }));
    expect(onResetPassword).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cập nhật' }));

    expect(screen.getByText('Nhân sự bắt buộc thuộc một phòng ban.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
