import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InternalUserModuleTabs } from '../components/InternalUserModuleTabs';
import type { AuthUser, Department, Employee, EmployeePartyListItem } from '../types';

const departments: Department[] = [
  {
    id: 1,
    dept_code: 'BGDVT',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: '1',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 1,
    uuid: 'emp-1',
    user_code: 'VNPT000001',
    employee_code: 'VNPT000001',
    username: 'admin',
    full_name: 'Nguyen Van A',
    email: 'admin@vnpt.vn',
    status: 'ACTIVE',
    department_id: 1,
    position_id: 1,
  },
];

const scopedDepartments: Department[] = [
  {
    id: 1,
    dept_code: 'BGĐVT',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: 'BGĐVT',
    is_active: true,
  },
  {
    id: 2,
    dept_code: 'PKD',
    dept_name: 'Phòng Kinh doanh',
    parent_id: 1,
    dept_path: 'BGĐVT/PKD',
    is_active: true,
  },
  {
    id: 3,
    dept_code: 'TTKDGP',
    dept_name: 'Trung tâm Kinh doanh Giải pháp',
    parent_id: 1,
    dept_path: 'BGĐVT/TTKDGP',
    is_active: true,
  },
  {
    id: 4,
    dept_code: 'PGP2',
    dept_name: 'Phòng giải pháp 2',
    parent_id: 3,
    dept_path: 'BGĐVT/TTKDGP/PGP2',
    is_active: true,
  },
];

const scopedEmployees: Employee[] = [
  {
    ...employees[0],
    id: 21,
    uuid: 'emp-21',
    user_code: 'VNPT000021',
    employee_code: 'VNPT000021',
    full_name: 'Nguyen Van Kinh Doanh',
    department_id: 2,
  },
  {
    ...employees[0],
    id: 22,
    uuid: 'emp-22',
    user_code: 'VNPT000022',
    employee_code: 'VNPT000022',
    full_name: 'Nguyen Van Giai Phap',
    department_id: 4,
  },
];

const scopedPartyProfiles: EmployeePartyListItem[] = [
  {
    id: 'party-21',
    employee_id: 21,
    employee: scopedEmployees[0],
    party_card_number: 'PD-21',
  },
  {
    id: 'party-22',
    employee_id: 22,
    employee: scopedEmployees[1],
    party_card_number: 'PD-22',
  },
];

const adminUser: AuthUser = {
  id: 1,
  username: 'admin',
  full_name: 'Admin',
  email: 'admin@vnpt.vn',
  status: 'ACTIVE',
  department_id: 1,
  roles: ['ADMIN'],
  permissions: [],
  dept_scopes: [],
};

const salesUser: AuthUser = {
  id: 2,
  username: 'sales',
  full_name: 'Sales User',
  email: 'sales@vnpt.vn',
  status: 'ACTIVE',
  department_id: 2,
  roles: [],
  permissions: [],
  dept_scopes: [],
};

describe('InternalUserModuleTabs', () => {
  it('renders the employee tab without legacy module copy', () => {
    render(
      <InternalUserModuleTabs
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        activeSubTab="list"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getAllByRole('heading', { name: /^Danh sách nhân sự$/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Module nhân sự nội bộ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quản lý hồ sơ nhân sự, tra cứu trạng thái và thao tác nhập xuất dữ liệu tập trung/i)).not.toBeInTheDocument();
  });

  it('shows the module KPI cards on the party tab', () => {
    render(
      <InternalUserModuleTabs
        employees={employees}
        departments={departments}
        partyProfiles={[]}
        onOpenModal={vi.fn()}
        activeSubTab="party"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Quản lý Đảng viên/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Đảng viên$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/^Nhân sự$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Phòng ban$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Đảng viên$/i).length).toBeGreaterThan(1);
  });

  it('keeps the module metrics and sub tabs inline in three columns for compact screens', () => {
    render(
      <InternalUserModuleTabs
        employees={employees}
        departments={departments}
        partyProfiles={[]}
        onOpenModal={vi.fn()}
        activeSubTab="dashboard"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('internal-user-module-signals')).toHaveClass('flex-wrap');
    expect(screen.getByTestId('internal-user-module-tabs-grid')).toHaveClass('grid-cols-3');
  });

  it('hides legacy dashboard section copy and shows the current KPI labels', () => {
    render(
      <InternalUserModuleTabs
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        activeSubTab="dashboard"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('VPN kích hoạt')).toBeInTheDocument();
    expect(screen.getAllByText('Chức danh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
    expect(screen.getByText('Khoảng lệch giới')).toBeInTheDocument();
    expect(screen.getByText('ĐV lớn nhất')).toBeInTheDocument();
    expect(screen.queryByText('Cài đặt VPN')).not.toBeInTheDocument();
    expect(screen.queryByText('Phân tích chức danh')).not.toBeInTheDocument();
    expect(screen.queryByText('Phủ VPN')).not.toBeInTheDocument();
    expect(screen.queryByText('Không hoạt động')).not.toBeInTheDocument();
    expect(screen.queryByText('Nên rà soát nguyên nhân dừng sử dụng.')).not.toBeInTheDocument();
    expect(screen.queryByText('Lực lượng nòng cốt')).not.toBeInTheDocument();
    expect(screen.queryByText('Mật độ vận hành')).not.toBeInTheDocument();
    expect(screen.queryByText('Vai trò chiếm ưu thế')).not.toBeInTheDocument();
    expect(screen.queryByText('Hồ sơ chưa ổn định')).not.toBeInTheDocument();
    expect(screen.queryByText('Tương quan giới tính và loại hình lực lượng')).not.toBeInTheDocument();
    expect(screen.queryByText('Bản đồ phòng ban')).not.toBeInTheDocument();
    expect(screen.queryByText('Vai trò nổi bật')).not.toBeInTheDocument();
  });

  it('breaks down job titles separately even when employees share the same position', () => {
    render(
      <InternalUserModuleTabs
        employees={[
          {
            ...employees[0],
            id: 11,
            uuid: 'emp-11',
            user_code: 'VNPT000011',
            employee_code: 'VNPT000011',
            position_id: 5,
            position_name: 'Chuyên viên',
            job_title_raw: 'Chuyên viên Tư vấn Giải pháp',
          },
          {
            ...employees[0],
            id: 12,
            uuid: 'emp-12',
            user_code: 'VNPT000012',
            employee_code: 'VNPT000012',
            position_id: 5,
            position_name: 'Chuyên viên',
            job_title_raw: 'Kỹ sư lập trình',
          },
        ]}
        departments={departments}
        onOpenModal={vi.fn()}
        activeSubTab="dashboard"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Chuyên viên Tư vấn Giải pháp')).toBeInTheDocument();
    expect(screen.getByText('Kỹ sư lập trình')).toBeInTheDocument();
    expect(screen.queryByText(/^Chuyên viên$/i)).not.toBeInTheDocument();
  });

  it('shows the shared department filter and lets admin browse BGĐVT child departments', async () => {
    const user = userEvent.setup();

    render(
      <InternalUserModuleTabs
        authUser={adminUser}
        employees={scopedEmployees}
        departments={scopedDepartments}
        partyProfiles={scopedPartyProfiles}
        onOpenModal={vi.fn()}
        activeSubTab="dashboard"
        onSubTabChange={vi.fn()}
      />
    );

    const filter = screen.getByTestId('internal-user-module-department-filter');
    await user.click(within(filter).getByRole('button', { name: 'Tất cả phòng ban' }));

    expect(screen.getByRole('button', { name: 'BGĐVT - Ban giám đốc Viễn Thông' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PKD - Phòng Kinh doanh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TTKDGP - Trung tâm Kinh doanh Giải pháp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PGP2 - Phòng giải pháp 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'PGP2 - Phòng giải pháp 2' }));

    expect(screen.getByText('Phòng giải pháp 2')).toBeInTheDocument();
    expect(screen.queryByText('Phòng Kinh doanh')).not.toBeInTheDocument();
  });

  it('locks the shared department filter to the current department for non-BGĐVT users', () => {
    render(
      <InternalUserModuleTabs
        authUser={salesUser}
        employees={scopedEmployees}
        departments={scopedDepartments}
        onOpenModal={vi.fn()}
        activeSubTab="list"
        onSubTabChange={vi.fn()}
      />
    );

    const filter = screen.getByTestId('internal-user-module-department-filter');
    const trigger = within(filter).getByRole('button', { name: /Phòng ban hiện tại/i });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('PKD - Phòng Kinh doanh');
    expect(screen.getByText('Nguyen Van Kinh Doanh')).toBeInTheDocument();
    expect(screen.queryByText('Nguyen Van Giai Phap')).not.toBeInTheDocument();
  });

  it('applies the shared department filter to the party tab results', async () => {
    const user = userEvent.setup();

    render(
      <InternalUserModuleTabs
        authUser={adminUser}
        employees={scopedEmployees}
        departments={scopedDepartments}
        partyProfiles={scopedPartyProfiles}
        onOpenModal={vi.fn()}
        activeSubTab="party"
        onSubTabChange={vi.fn()}
      />
    );

    const filter = screen.getByTestId('internal-user-module-department-filter');
    await user.click(within(filter).getByRole('button', { name: 'Tất cả phòng ban' }));
    await user.click(screen.getByRole('button', { name: 'PKD - Phòng Kinh doanh' }));

    expect(screen.getAllByText('Nguyen Van Kinh Doanh').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nguyen Van Giai Phap')).not.toBeInTheDocument();
  });
});
