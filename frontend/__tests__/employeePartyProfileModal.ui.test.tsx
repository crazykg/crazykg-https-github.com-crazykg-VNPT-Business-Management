import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePartyProfileModal } from '../components/EmployeePartyProfileModal';
import type { Department, Employee } from '../types';

vi.mock('../components/modals', () => ({
  ModalWrapper: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock('../components/SearchableSelect', () => ({
  SearchableSelect: ({
    value,
    onChange,
    options,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Mã nhân viên"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder || 'Chọn nhân sự'}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const departments: Department[] = [
  {
    id: 2,
    dept_code: 'PGP2',
    dept_name: 'Phòng giải pháp 2',
    parent_id: null,
    dept_path: '2',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 1,
    uuid: 'emp-1',
    employee_code: 'VNPT000001',
    user_code: 'VNPT000001',
    username: 'ropv.hgi',
    full_name: 'Phan Văn Rở',
    email: 'ropv.hgi@vnpt.vn',
    status: 'ACTIVE',
    department_id: 2,
    position_id: 10,
    position_name: 'Chuyên viên',
    date_of_birth: '1990-04-03',
  },
];

describe('EmployeePartyProfileModal', () => {
  it('renders a compact modal without legacy helper copy', () => {
    render(
      <EmployeePartyProfileModal
        type="EDIT"
        data={{
          id: 'profile-1',
          employee_id: 1,
          employee: employees[0],
          party_card_number: '093066006328',
        }}
        employees={employees}
        departments={departments}
        existingProfiles={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Cập nhật hồ sơ Đảng viên' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mã nhân viên')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Phan Văn Rở')).toBeInTheDocument();
    expect(screen.getByDisplayValue('03/04/1990')).toBeInTheDocument();
    expect(screen.getByText('Ghi chú')).toBeInTheDocument();
    expect(screen.getByLabelText('Lưu ý hồ sơ Đảng viên')).toBeInTheDocument();

    expect(screen.queryByText('Nhân sự gốc')).not.toBeInTheDocument();
    expect(screen.queryByText('Liên kết hồ sơ với nhân viên nội bộ')).not.toBeInTheDocument();
    expect(screen.queryByText(/Chọn đúng nhân sự trước khi nhập hồ sơ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lưu trực tiếp vào hồ sơ Đảng viên/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Nguyên tắc dữ liệu')).not.toBeInTheDocument();
    expect(screen.queryByText('verified_user')).not.toBeInTheDocument();
    expect(screen.queryByText('Mô tả hồ sơ')).not.toBeInTheDocument();
    expect(screen.queryByText('Bổ sung thông tin nền')).not.toBeInTheDocument();
    expect(screen.queryByText(/Phục vụ tra cứu hồ sơ và làm sạch dữ liệu/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Không gian lưu ý bổ sung')).not.toBeInTheDocument();
    expect(screen.queryByText('Phòng ban')).not.toBeInTheDocument();
  });
});
