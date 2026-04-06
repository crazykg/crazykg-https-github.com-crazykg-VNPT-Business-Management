import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePartyList } from '../components/EmployeePartyList';
import type { Department, Employee, EmployeePartyListItem, PaginationMeta } from '../types';

const departments: Department[] = [
  {
    id: 1,
    dept_code: 'BGDVT',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: '1',
    is_active: true,
  },
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

const paginationMeta: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 20,
  total_pages: 2,
  kpis: {
    total_party_members: 20,
    missing_party_card_number_count: 5,
  },
};

const partyProfiles: EmployeePartyListItem[] = [
  {
    id: 'profile-1',
    employee_id: 1,
    employee: {
      ...employees[0],
      date_of_birth: '1990-04-03',
    },
    party_card_number: '093066006328',
    hometown: 'Can Tho',
    ethnicity: 'Kinh',
    religion: 'Khong',
    professional_qualification: 'Cu nhan',
    political_theory_level: 'Trung cap',
    notes: 'Ho so da doi soat',
    profile_quality: {
      missing_card_number: false,
    },
  },
];

describe('EmployeePartyList remote filters', () => {
  it('hides import actions when import permission/support is not enabled', () => {
    render(
      <EmployeePartyList
        partyProfiles={[]}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Nhập/i })).not.toBeInTheDocument();
  });

  it('renders a compact party list header without legacy summary copy', async () => {
    const onQueryChange = vi.fn();

    render(
      <EmployeePartyList
        partyProfiles={[]}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        canImport
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: /Quản lý Đảng viên/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nhập/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm hồ sơ Đảng viên/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Party Registry$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Trang 1\/2$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Theo dõi hồ sơ Đảng viên gắn với nhân sự nội bộ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tổng số hồ sơ Đảng viên khớp với truy vấn hiện tại/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hồ sơ đã sẵn sàng cho đối soát và xuất dữ liệu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Những hồ sơ cần ưu tiên bổ sung trường dữ liệu lõi/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Số đơn vị xuất hiện trong tập kết quả hiện tại/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tìm nhanh theo mã nhân sự, phòng ban và trạng thái thiếu số thẻ Đảng/i)).not.toBeInTheDocument();
  });

  it('renames the party list headings to que quan and the dang card section', async () => {
    render(
      <EmployeePartyList
        partyProfiles={partyProfiles}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        canImport
        paginationMeta={paginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    expect(await screen.findByText(/^QUÊ QUÁN$/i)).toBeInTheDocument();
    expect(screen.getByText(/^THẺ ĐẢNG$/i)).toBeInTheDocument();
    expect(screen.getByText(/Quê quán và ghi chú/i)).toBeInTheDocument();
    expect(screen.queryByText(/^NHÂN THÂN$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^CHẤT LƯỢNG$/i)).not.toBeInTheDocument();
  });

  it('shows department filter options by name only and removes the export reminder for missing party cards', async () => {
    const user = userEvent.setup();

    render(
      <EmployeePartyList
        partyProfiles={[
          {
            ...partyProfiles[0],
            id: 'profile-2',
            party_card_number: '',
            profile_quality: {
              missing_card_number: true,
            },
          },
        ]}
        employees={[
          {
            ...employees[0],
            department_id: 2,
          },
        ]}
        departments={departments}
        onOpenModal={vi.fn()}
        canImport
        paginationMeta={paginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    const selectButtons = screen.getAllByRole('button', { name: /Phòng ban|Thiếu thông tin/ });
    await user.click(selectButtons[0]);

    expect(await screen.findByRole('button', { name: 'Phòng giải pháp 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PGP2 - Phòng giải pháp 2' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nên bổ sung số thẻ trước khi xuất biểu mẫu.')).not.toBeInTheDocument();
  });

  it('sends department and missing-info filters and resets pagination to page 1', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <EmployeePartyList
        partyProfiles={[]}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        canImport
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }));

    const selectButtons = screen.getAllByRole('button', { name: /Phòng ban|Thiếu thông tin/ });
    await user.click(selectButtons[0]);
    await user.click(await screen.findByRole('button', { name: 'Phòng giải pháp 2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
        }),
      })
    );

    await user.click(screen.getByRole('button', { name: 'Thiếu thông tin' }));
    await user.click(await screen.findByRole('button', { name: 'Thiếu số thẻ Đảng' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
          missing_info: 'CARD_NUMBER',
        }),
      })
    );
  });
});
