import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InternalUserModuleTabs } from '../components/InternalUserModuleTabs';
import type { Department, Employee } from '../types';

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

    expect(screen.getByRole('heading', { name: /^Danh sách nhân sự$/i })).toBeInTheDocument();
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

  it('hides legacy dashboard section copy and renames the VPN KPI', () => {
    render(
      <InternalUserModuleTabs
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        activeSubTab="dashboard"
        onSubTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Cài đặt VPN')).toBeInTheDocument();
    expect(screen.getByText('Phân tích chức danh')).toBeInTheDocument();
    expect(screen.getAllByText('Nghỉ việc').length).toBeGreaterThan(0);
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
});
