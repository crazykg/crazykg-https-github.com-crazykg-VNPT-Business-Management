import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeList } from '../components/EmployeeList';
import type { Department, Employee, PaginationMeta } from '../types';

const exportSpies = vi.hoisted(() => ({
  exportExcel: vi.fn(),
  exportCsv: vi.fn(),
  exportPdfTable: vi.fn(() => true),
}));

const v5ApiSpies = vi.hoisted(() => ({
  fetchEmployeesPage: vi.fn(),
}));

vi.mock('../utils/exportUtils', async () => {
  const actual = await vi.importActual<typeof import('../utils/exportUtils')>('../utils/exportUtils');
  return {
    ...actual,
    exportExcel: exportSpies.exportExcel,
    exportCsv: exportSpies.exportCsv,
    exportPdfTable: exportSpies.exportPdfTable,
    isoDateStamp: vi.fn(() => '20260331'),
  };
});

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    fetchEmployeesPage: v5ApiSpies.fetchEmployeesPage,
  };
});

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

const paginationMeta: PaginationMeta = {
  page: 1,
  per_page: 7,
  total: 14,
  total_pages: 2,
};

const buildEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 1,
  uuid: 'employee-1',
  user_code: 'VNPT00001',
  employee_code: 'VNPT00001',
  username: 'nguyenvana',
  full_name: 'Nguyen Van A',
  email: 'nguyenvana@vnpt.vn',
  gmail: 'nguyenvana@gmail.com',
  phone_number: '0912345678',
  status: 'ACTIVE',
  position_code: 'POS003',
  position_name: 'Truong phong',
  job_title_vi: 'Truong phong kinh doanh',
  date_of_birth: '1995-08-10',
  gender: 'MALE',
  ip_address: '10.10.1.15',
  vpn_status: 'YES',
  department_id: 1,
  position_id: 3,
  ...overrides,
});

describe('EmployeeList remote filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    v5ApiSpies.fetchEmployeesPage.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 200, total: 0, total_pages: 1 },
    });
  });

  it('renders a compact employee list header without legacy summary copy', async () => {
    const onQueryChange = vi.fn();

    render(
      <EmployeeList
        employees={[]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: /^Bảng nhân sự$/i })).toBeInTheDocument();
    expect(screen.getByTestId('employee-list-summary-strip')).toHaveClass('flex-wrap');
    expect(screen.getByTestId('employee-list-filter-row')).toHaveClass('mt-2');
    expect(screen.queryByRole('button', { name: /Nhập/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm nhân sự/i })).toBeInTheDocument();
    expect(screen.queryByText(/Bộ lọc và tra cứu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nhân sự theo bộ lọc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/People Directory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Trang 1\/2$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tập trung quản trị hồ sơ nhân sự, trạng thái vận hành tài khoản và các thao tác nhập xuất dữ liệu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tìm nhanh theo mã, tài khoản, email, phòng ban và trạng thái vận hành/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tổng số hồ sơ khớp với truy vấn hiện tại/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đếm trên tập dữ liệu đang tải của trang hiện tại/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Số hồ sơ có trạng thái VPN khả dụng trên dữ liệu đang hiển thị/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Số đơn vị xuất hiện trong tập dữ liệu đang hiển thị/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hiển thị\s+0\s*\/\s*14/i)).not.toBeInTheDocument();
  });

  it('groups employee row data in compact columns and hides the internal id', () => {
    const employee = buildEmployee();

    render(
      <EmployeeList
        employees={[employee]}
        departments={departments}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('NHÂN SỰ')).toBeInTheDocument();
    expect(screen.getByText('TÀI KHOẢN')).toBeInTheDocument();
    expect(screen.getByText('PHÒNG BAN / CHỨC DANH')).toBeInTheDocument();
    expect(screen.getByText('TRUY CẬP')).toBeInTheDocument();
    expect(screen.queryByText('ID: 1')).not.toBeInTheDocument();
    expect(screen.queryByText('NGÀY SINH')).not.toBeInTheDocument();

    const row = screen.getByText('VNPT00001').closest('tr');
    expect(row).not.toBeNull();
    expect(row?.querySelector('td')).toHaveClass('align-middle');
    expect(within(row as HTMLTableRowElement).getByRole('button', { name: /Chỉnh sửa Nguyen Van A/i })).toBeInTheDocument();
  });

  it('maps the department filter to department_id and returns to page 1', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <EmployeeList
        employees={[]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 })
    );

    await user.click(screen.getByRole('button', { name: 'Phòng ban' }));
    await user.click(await screen.findByRole('button', { name: 'PGP2 - Phòng giải pháp 2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
        }),
      })
    );
  });

  it('keeps the dedicated VNPT Mail filter in the remote query payload', async () => {
    const onQueryChange = vi.fn();

    render(
      <EmployeeList
        employees={[]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('VNPT Mail'), {
      target: { value: 'admin@vnpt.vn' },
    });

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          email: 'admin@vnpt.vn',
        }),
      })
    );
  });

  it('exports all remote rows that match the current query instead of only the current page', async () => {
    const user = userEvent.setup();
    const pageOneEmployee = buildEmployee();
    const pageTwoEmployee = buildEmployee({
      id: 2,
      uuid: 'employee-2',
      user_code: 'VNPT00002',
      employee_code: 'VNPT00002',
      username: 'tranthib',
      full_name: 'Tran Thi B',
      email: 'tranthib@vnpt.vn',
      gmail: 'tranthib@gmail.com',
      phone_number: '0987654321',
      department_id: 2,
      position_id: 5,
      position_code: 'POS005',
      position_name: 'Chuyen vien',
      job_title_vi: 'Chuyen vien cham soc khach hang',
      gender: 'FEMALE',
      vpn_status: 'NO',
      ip_address: '10.10.1.28',
    });

    v5ApiSpies.fetchEmployeesPage
      .mockResolvedValueOnce({
        data: [pageOneEmployee],
        meta: { page: 1, per_page: 200, total: 2, total_pages: 2 },
      })
      .mockResolvedValueOnce({
        data: [pageTwoEmployee],
        meta: { page: 2, per_page: 200, total: 2, total_pages: 2 },
      });

    render(
      <EmployeeList
        employees={[pageOneEmployee]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /xuất/i }));
    await user.click(screen.getByRole('button', { name: /excel/i }));

    await waitFor(() => expect(exportSpies.exportExcel).toHaveBeenCalledTimes(1));

    expect(v5ApiSpies.fetchEmployeesPage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      page: 1,
      per_page: 200,
      sort_by: 'user_code',
      sort_dir: 'asc',
    }));
    expect(v5ApiSpies.fetchEmployeesPage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page: 2,
      per_page: 200,
      sort_by: 'user_code',
      sort_dir: 'asc',
    }));

    const [, , headers, rows] = exportSpies.exportExcel.mock.calls[0];
    expect(headers).toEqual(expect.arrayContaining(['VNPT Mail', 'Gmail']));
    expect(rows).toHaveLength(2);
    expect(rows.map((row: unknown[]) => row[0])).toEqual(['VNPT00001', 'VNPT00002']);
    expect(rows.map((row: unknown[]) => row[2])).toEqual(['Nguyen Van A', 'Tran Thi B']);
    expect(rows.map((row: unknown[]) => row[5])).toEqual(['nguyenvana@gmail.com', 'tranthib@gmail.com']);
  });
});
