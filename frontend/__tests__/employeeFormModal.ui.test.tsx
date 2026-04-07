import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeFormModal } from '../components/modals';
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

const employeeForEdit: Employee = {
  ...employeeWithoutDepartment,
  department_id: 'dept-1',
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

  it('allows editing employee code in edit mode', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <EmployeeFormModal
        type="EDIT"
        data={employeeForEdit}
        departments={departments}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const employeeCodeInput = screen.getByPlaceholderText('VNPT022327 / CTV091020');
    expect(employeeCodeInput).toBeEnabled();

    await user.clear(employeeCodeInput);
    await user.type(employeeCodeInput, 'VNPT999999');
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      user_code: 'VNPT999999',
    }));
  });

  it('uses consistent field sizing for text inputs and selects', () => {
    render(
      <EmployeeFormModal
        type="ADD"
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Mã nhân viên')).toHaveClass('text-sm');
    expect(screen.getByText('Email')).toHaveClass('text-sm');
    expect(screen.getByPlaceholderText('VNPT022327 / CTV091020')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');
    expect(screen.getByPlaceholderText('nguyenvana')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');
    expect(screen.getByPlaceholderText('email@vnpt.vn')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');

    const departmentField = screen.getByText('Phòng ban tham chiếu', { selector: 'label' }).closest('div');
    const positionField = screen.getByText('Chức vụ', { selector: 'label' }).closest('div');

    expect(within(departmentField as HTMLElement).getByRole('button')).toHaveClass('h-[46px]', 'rounded-lg');
    expect(within(positionField as HTMLElement).getByRole('button')).toHaveClass('h-[46px]', 'rounded-lg');
  });
});
