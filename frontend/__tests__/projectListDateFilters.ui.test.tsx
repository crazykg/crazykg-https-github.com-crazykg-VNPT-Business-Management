import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { ProjectList } from '../components/ProjectList';
import { useFilterStore } from '../shared/stores';
import { getDefaultTabFilter, getProjectsPageDefaultDateFilters } from '../shared/stores/filterStore';
import type { AuthUser, Customer, Department, Project, ProjectItemMaster } from '../types';

const cloneDefaults = () => ({
  employeesPage: getDefaultTabFilter('employeesPage'),
  partyProfilesPage: getDefaultTabFilter('partyProfilesPage'),
  customersPage: getDefaultTabFilter('customersPage'),
  projectsPage: getDefaultTabFilter('projectsPage'),
  productsPage: getDefaultTabFilter('productsPage'),
  contractsPage: getDefaultTabFilter('contractsPage'),
  passContractsPage: getDefaultTabFilter('passContractsPage'),
  documentsPage: getDefaultTabFilter('documentsPage'),
  auditLogsPage: getDefaultTabFilter('auditLogsPage'),
  feedbacksPage: getDefaultTabFilter('feedbacksPage'),
});

const customers: Customer[] = [
  {
    id: 1,
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Bệnh viện A',
    tax_code: '0101010101',
    address: 'Hà Nội',
  },
];

const projects: Project[] = [
  {
    id: 1,
    project_code: 'DA001',
    project_name: 'Dự án mặc định ngày',
    customer_id: 1,
    status: 'CHUAN_BI',
    start_date: '2026-03-15',
    expected_end_date: '2026-12-31',
    estimated_value: 1500000,
  } as Project,
];

const projectsWithDifferentStartDates: Project[] = [
  projects[0],
  {
    id: 2,
    project_code: 'DA002',
    project_name: 'Dự án ngoài khoảng ngày',
    customer_id: 1,
    status: 'CHUAN_BI',
    start_date: '2026-05-10',
    expected_end_date: '2026-12-31',
    estimated_value: 2000000,
  } as Project,
];

const projectItems: ProjectItemMaster[] = [
  {
    id: 1,
    project_id: 1,
    product_id: 101,
    quantity: 3,
    unit_price: 600000,
  },
];

const projectListPaginationMeta = {
  ...DEFAULT_PAGINATION_META,
  total: 1,
  total_pages: 1,
  kpis: {
    total_estimated_value: 5400000,
  },
};

const departments: Department[] = [
  {
    id: 4,
    dept_code: 'BGĐVT',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: '4/',
    is_active: true,
  },
  {
    id: 1,
    dept_code: 'TTKDGP',
    dept_name: 'Trung tâm Kinh doanh Giải pháp',
    parent_id: 4,
    dept_path: '1/',
    is_active: true,
  },
  {
    id: 2,
    dept_code: 'PGP2',
    dept_name: 'Phòng giải pháp 2',
    parent_id: 1,
    dept_path: '1/2/',
    is_active: true,
  },
  {
    id: 8,
    dept_code: 'VNPT_CAIRANG',
    dept_name: 'VNPT Cái Răng',
    parent_id: 4,
    dept_path: '4/8/',
    is_active: true,
  },
  {
    id: 6,
    dept_code: 'PKT',
    dept_name: 'Phòng Kế toán',
    parent_id: 4,
    dept_path: '4/6/',
    is_active: true,
  },
];

const solutionUser: AuthUser = {
  id: 9,
  username: 'ropv.hgi',
  full_name: 'Phan Van Ro',
  email: 'ro@example.com',
  status: 'ACTIVE',
  department_id: 2,
  roles: [],
  permissions: [],
  dept_scopes: [],
};

const areaUser: AuthUser = {
  id: 10,
  username: 'kv.user',
  full_name: 'Can bo khu vuc',
  email: 'kv@example.com',
  status: 'ACTIVE',
  department_id: 8,
  roles: [],
  permissions: [],
  dept_scopes: [],
};

describe('ProjectList date filters', () => {
  beforeEach(() => {
    useFilterStore.setState({ tabFilters: cloneDefaults() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('seeds the default project date range into the inputs and query callback', async () => {
    const defaultDateFilters = getProjectsPageDefaultDateFilters();
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));

    expect(screen.getByLabelText('Từ ngày')).toHaveValue(defaultDateFilters.start_date_from);
    expect(screen.getByLabelText('Đến ngày')).toHaveValue(defaultDateFilters.start_date_to);

    fireEvent.click(screen.getByTitle('Tìm kiếm (Enter)'));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          start_date_from: defaultDateFilters.start_date_from,
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });

    expect(screen.getByText('Danh sách dự án')).toBeInTheDocument();
    expect(screen.getByText('1 dự án')).toBeInTheDocument();
    expect(screen.getByText('Tổng giá trị trong kỳ')).toBeInTheDocument();
    expect(screen.getByText('Thành tiền')).toBeInTheDocument();
    expect(screen.getByText('1.800.000 đ')).toBeInTheDocument();
    expect(screen.getByTestId('project-period-total-value')).toHaveTextContent('5.400.000 đ');
    expect(screen.queryByText('Tổng cộng')).not.toBeInTheDocument();
    expect(screen.queryByText('1.500.000 đ')).not.toBeInTheDocument();
  });

  it('resets the project date filters back to the default window and applies the list filter', async () => {
    const defaultDateFilters = getProjectsPageDefaultDateFilters();
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        paginationMeta={DEFAULT_PAGINATION_META}
        onQueryChange={onQueryChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));

    const fromInput = screen.getByLabelText('Từ ngày');
    const toInput = screen.getByLabelText('Đến ngày');

    fireEvent.change(fromInput, { target: { value: '2026-02-01' } });
    fireEvent.change(toInput, { target: { value: '2026-02-28' } });

    expect(fromInput).toHaveValue('2026-02-01');
    expect(toInput).toHaveValue('2026-02-28');

    fireEvent.click(screen.getByTitle('Xóa lọc ngày'));

    expect(fromInput).toHaveValue(defaultDateFilters.start_date_from);
    expect(toInput).toHaveValue(defaultDateFilters.start_date_to);

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          start_date_from: defaultDateFilters.start_date_from,
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });
  });

  it('applies preset date windows from the shared range picker immediately', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T08:00:00.000Z'));

    const onQueryChange = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        onOpenModal={vi.fn()}
        paginationMeta={DEFAULT_PAGINATION_META}
        onQueryChange={onQueryChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'T.trước' }));
    vi.runAllTimers();

    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      filters: expect.objectContaining({
        start_date_from: '2026-03-01',
        start_date_to: '2026-03-31',
      }),
    }));
    expect(screen.getByText('Đang lọc')).toBeInTheDocument();
    expect(screen.queryByText('01/03/2026 - 31/03/2026')).not.toBeInTheDocument();
  });

  it('filters the local project list by start_date within the selected date range', () => {
    useFilterStore.setState({
      tabFilters: {
        ...cloneDefaults(),
        projectsPage: {
          ...getDefaultTabFilter('projectsPage'),
          filters: {
            start_date_from: '2026-01-01',
            start_date_to: '2026-04-30',
          },
        },
      },
    });

    render(
      <ProjectList
        projects={projectsWithDifferentStartDates}
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('Dự án mặc định ngày')).toBeInTheDocument();
    expect(screen.queryByText('Dự án ngoài khoảng ngày')).not.toBeInTheDocument();
  });

  it('submits project keyword search on Enter with the expanded search field shell', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    const searchForm = screen.getByRole('search');
    const searchInput = screen.getByPlaceholderText('Tìm theo tên dự án, mã dự án hoặc khách hàng...');
    const searchButton = screen.getByTitle('Tìm kiếm (Enter)');
    const resetButton = screen.getByTitle('Làm mới / Xóa tất cả bộ lọc');

    expect(searchForm).toBeInTheDocument();
    expect(searchForm).toHaveClass(
      'lg:grid-cols-[minmax(280px,320px)_minmax(170px,190px)_minmax(280px,1fr)_auto_auto]',
      'xl:grid-cols-[minmax(320px,360px)_minmax(180px,200px)_minmax(360px,1.4fr)_auto_auto]'
    );
    expect(searchInput).toHaveAttribute('type', 'search');
    expect(searchInput).toHaveAttribute('enterkeyhint', 'search');
    expect(searchButton).toHaveClass('whitespace-nowrap', 'shrink-0', 'lg:min-w-[108px]');
    expect(resetButton).toHaveClass('whitespace-nowrap', 'shrink-0', 'lg:min-w-[96px]');

    await user.type(searchInput, 'DA001{enter}');

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        q: 'DA001',
        page: 1,
      }));
    });

    expect(screen.queryByText('Có thay đổi chưa áp dụng')).not.toBeInTheDocument();
  });

  it('does not show a pending helper chip before project filters are applied', async () => {
    const user = userEvent.setup();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Tìm theo tên dự án, mã dự án hoặc khách hàng...');

    await user.type(searchInput, 'DA001');

    expect(screen.queryByText('Có thay đổi chưa áp dụng')).not.toBeInTheDocument();
  });

  it('defaults the project department filter to the solution center parent for solution-child users', async () => {
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        authUser={solutionUser}
        projects={projects}
        customers={customers}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={DEFAULT_PAGINATION_META}
        onQueryChange={onQueryChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Tất cả phòng ban' })).toHaveTextContent('Trung tâm Kinh doanh Giải pháp');

    fireEvent.click(screen.getByTitle('Tìm kiếm (Enter)'));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          department_id: '1',
        }),
      }));
    });
  });

  it('defaults the project department filter to the current department for direct BGDVT children', async () => {
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        authUser={areaUser}
        projects={projects}
        customers={customers}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={DEFAULT_PAGINATION_META}
        onQueryChange={onQueryChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Tất cả phòng ban' })).toHaveTextContent('VNPT Cái Răng');

    fireEvent.click(screen.getByTitle('Tìm kiếm (Enter)'));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          department_id: '8',
        }),
      }));
    });
  });

  it('prefers a stored project department filter over the resolved user ownership department', async () => {
    const onQueryChange = vi.fn();

    useFilterStore.setState({
      tabFilters: {
        ...cloneDefaults(),
        projectsPage: {
          ...getDefaultTabFilter('projectsPage'),
          filters: {
            ...getProjectsPageDefaultDateFilters(),
            department_id: '8',
          },
        },
      },
    });

    render(
      <ProjectList
        authUser={solutionUser}
        projects={projects}
        customers={customers}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={DEFAULT_PAGINATION_META}
        onQueryChange={onQueryChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Tất cả phòng ban' })).toHaveTextContent('VNPT Cái Răng');

    fireEvent.click(screen.getByTitle('Tìm kiếm (Enter)'));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          department_id: '8',
        }),
      }));
    });
  });

  it('renders copy action before create-contract and opens add-project copy modal with row payload', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={onOpenModal}
        onCreateContract={vi.fn()}
        onOpenProcedure={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    const row = screen.getByText('Dự án mặc định ngày').closest('tr') as HTMLElement;
    const actionButtons = within(row).getAllByRole('button');
    const copyIndex = actionButtons.findIndex((button) => button.getAttribute('title') === 'Sao chép dự án');
    const createContractIndex = actionButtons.findIndex((button) => button.getAttribute('title') === 'Tạo hợp đồng');

    expect(copyIndex).toBeGreaterThanOrEqual(0);
    expect(createContractIndex).toBeGreaterThanOrEqual(0);
    expect(copyIndex).toBeLessThan(createContractIndex);

    await user.click(screen.getByTestId('project-copy-1'));

    expect(onOpenModal).toHaveBeenCalledWith('ADD_PROJECT', expect.objectContaining({
      id: 1,
      project_code: 'DA001',
    }));
  });

  it('keeps manual-search mode and allows paging in server mode before first search click', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={{
          ...DEFAULT_PAGINATION_META,
          total: 25,
          total_pages: 3,
        }}
        onQueryChange={onQueryChange}
      />
    );

    expect(onQueryChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        page: 2,
      }));
    });

    fireEvent.click(screen.getByTitle('Tìm kiếm (Enter)'));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        page: 1,
      }));
    });
  });

  it('groups project code and project name into a single Du an column like contracts', () => {
    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: /Dự án/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Mã DA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Tên dự án' })).not.toBeInTheDocument();

    const projectRow = screen.getByText('Dự án mặc định ngày').closest('tr');
    expect(projectRow).not.toBeNull();

    const projectNameCell = screen.getByText('Dự án mặc định ngày').closest('td');
    expect(projectNameCell).not.toBeNull();
    expect(within(projectNameCell as HTMLElement).getByText('DA001')).toBeInTheDocument();
    expect((projectNameCell as HTMLElement).getAttribute('title')).toContain('DA001');
  });

  it('keeps project table headers stable when the filtered result is empty', () => {
    render(
      <ProjectList
        projects={[]}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={{ ...DEFAULT_PAGINATION_META, total: 0, total_pages: 1 }}
        onQueryChange={vi.fn()}
      />
    );

    const projectTable = screen.getByRole('table');
    const customerHeader = screen.getByRole('columnheader', { name: /Khách hàng/i });
    const emptyStateCell = screen.getByText('Không tìm thấy dự án phù hợp').closest('td');
    const customerLabel = within(customerHeader).getByText('Khách hàng');

    expect(projectTable).toHaveClass('min-w-[1300px]', 'table-fixed');
    expect(customerHeader).toHaveClass('w-[220px]');
    expect(customerLabel).toHaveClass('whitespace-nowrap');
    expect(emptyStateCell).toHaveAttribute('colspan', '7');
  });

  it('vertically centers every project row cell', () => {
    render(
      <ProjectList
        projects={projects}
        customers={customers}
        projectItems={projectItems}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    const projectRow = screen.getByText('Dự án mặc định ngày').closest('tr');

    expect(projectRow).not.toBeNull();

    within(projectRow as HTMLElement)
      .getAllByRole('cell')
      .forEach((cell) => {
        expect(cell).toHaveClass('align-middle');
      });

    expect(screen.getByText('Thành tiền').closest('th')).toHaveClass('text-right');
    expect(screen.getByText('Thành tiền').closest('div')).toHaveClass('flex', 'justify-end');
    expect(screen.getByText('1.800.000 đ').closest('div')).toHaveClass('flex', 'items-center', 'justify-end');
    const summaryAmount = screen.getByTestId('project-period-total-value');
    expect(summaryAmount).toHaveClass('text-sm', 'font-semibold', 'text-deep-teal');
    expect(screen.queryByRole('columnheader', { name: 'Tổng cộng' })).not.toBeInTheDocument();
  });
});
