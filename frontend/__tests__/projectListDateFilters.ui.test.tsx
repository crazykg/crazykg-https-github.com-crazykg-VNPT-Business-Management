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

const structuredSearchCustomers: Customer[] = [
  {
    id: 11,
    uuid: 'customer-11',
    customer_code: 'TYT_TQ',
    customer_name: 'Trạm y tế Thạnh Quới',
    tax_code: '0303030303',
    address: 'Hậu Giang',
  },
  {
    id: 12,
    uuid: 'customer-12',
    customer_code: 'BV_CT',
    customer_name: 'Bệnh viện Cần Thơ',
    tax_code: '0404040404',
    address: 'Cần Thơ',
  },
];

const structuredSearchProjects: Project[] = [
  {
    id: 101,
    project_code: 'HSSK_NB',
    project_name: 'Hồ sơ sức khỏe nội bộ',
    customer_id: 11,
    status: 'CO_HOI',
    start_date: '2026-04-10',
    expected_end_date: '2026-12-31',
    estimated_value: 1000000,
  } as Project,
  {
    id: 102,
    project_code: 'SOC_TQ',
    project_name: 'Kho dữ liệu xã hội',
    customer_id: 11,
    status: 'CO_HOI',
    start_date: '2026-04-11',
    expected_end_date: '2026-12-31',
    estimated_value: 2000000,
  } as Project,
  {
    id: 201,
    project_code: 'HIS_BVCT',
    project_name: 'Triển khai HIS bệnh viện',
    customer_id: 12,
    status: 'CO_HOI',
    start_date: '2026-04-12',
    expected_end_date: '2026-12-31',
    estimated_value: 3000000,
  } as Project,
];

const structuredSearchProjectItems: ProjectItemMaster[] = [
  {
    id: 'item-hssk',
    project_id: 101,
    product_id: 'product-his',
    product_code: 'HIS',
    product_name: 'HIS Core',
    quantity: 1,
    unit_price: 1000000,
  },
  {
    id: 'item-soc',
    project_id: 102,
    product_id: 'product-crm',
    product_code: 'CRM',
    product_name: 'CRM Care',
    quantity: 1,
    unit_price: 2000000,
  },
  {
    id: 'item-bv',
    project_id: 201,
    product_id: 'product-his',
    product_code: 'HIS',
    product_name: 'HIS Core',
    quantity: 1,
    unit_price: 3000000,
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

const setProjectListViewport = (isMobile: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile && query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const selectCascadingProjectFilterOption = async (
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionName: RegExp,
) => {
  await user.click(screen.getByRole('button', { name: triggerName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
};

const openProjectDesktopAdvancedFilters = () => {
  fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/i }));
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
    setProjectListViewport(false);
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

    openProjectDesktopAdvancedFilters();
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

    openProjectDesktopAdvancedFilters();
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

    openProjectDesktopAdvancedFilters();
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

  it('submits scoped project keyword search on Enter with the structured search shell', async () => {
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
    const searchInput = screen.getByLabelText('Tìm tự do trong phạm vi đã chọn');
    const searchButton = screen.getByTitle('Tìm kiếm (Enter)');
    const resetButton = screen.getByTitle('Làm mới / Xóa tất cả bộ lọc');

    expect(searchForm).toBeInTheDocument();
    expect(searchForm).toHaveClass('space-y-2');
    expect(screen.getByRole('button', { name: 'Lọc theo khách hàng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lọc theo dự án' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lọc theo sản phẩm' })).toBeInTheDocument();
    const advancedToggle = screen.getByTestId('project-advanced-filter-toggle');
    expect(advancedToggle).toHaveTextContent('Xem chi tiết');
    expect(advancedToggle.closest('fieldset')).toContainElement(screen.getByRole('button', { name: 'Lọc theo sản phẩm' }));
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Phòng ban, trạng thái và ngày bắt đầu đang được thu gọn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('project-secondary-filter-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('project-date-filter-row')).not.toBeInTheDocument();

    await user.click(advancedToggle);

    expect(screen.getByRole('button', { name: /Thu gọn/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('project-secondary-filter-row')).toHaveClass(
      'lg:grid-cols-[minmax(260px,360px)_minmax(170px,220px)]'
    );
    expect(screen.getByTestId('project-date-filter-row')).toHaveClass(
      'overflow-visible',
      'rounded-md',
      'border',
      'bg-slate-50/60'
    );
    expect(screen.getByText('Ngày bắt đầu:').closest('div')).toHaveClass('flex-wrap', 'min-w-0');
    expect(screen.getByText('Ngày bắt đầu:').closest('div')).not.toHaveClass('!flex-nowrap');
    expect(
      screen.getByTestId('project-secondary-filter-row').compareDocumentPosition(
        screen.getByTestId('project-date-filter-row')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByTestId('project-date-filter-row').compareDocumentPosition(
        screen.getByTestId('project-structured-search-row')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

    const searchInput = screen.getByLabelText('Tìm tự do trong phạm vi đã chọn');

    await user.type(searchInput, 'DA001');

    expect(screen.queryByText('Có thay đổi chưa áp dụng')).not.toBeInTheDocument();
  });

  it('filters local projects by selected customers before applying scoped free text', async () => {
    const user = userEvent.setup();

    render(
      <ProjectList
        projects={structuredSearchProjects}
        customers={structuredSearchCustomers}
        projectItems={structuredSearchProjectItems}
        onOpenModal={vi.fn()}
      />
    );

    await selectCascadingProjectFilterOption(user, 'Lọc theo khách hàng', /Trạm y tế Thạnh Quới/);
    await user.type(screen.getByLabelText('Tìm tự do trong phạm vi đã chọn'), 'HIS');
    await user.click(screen.getByTitle('Tìm kiếm (Enter)'));

    expect(screen.getByText('Hồ sơ sức khỏe nội bộ')).toBeInTheDocument();
    expect(screen.queryByText('Kho dữ liệu xã hội')).not.toBeInTheDocument();
    expect(screen.queryByText('Triển khai HIS bệnh viện')).not.toBeInTheDocument();
  });

  it('filters local projects inside selected projects before matching free text', async () => {
    const user = userEvent.setup();

    render(
      <ProjectList
        projects={structuredSearchProjects}
        customers={structuredSearchCustomers}
        projectItems={structuredSearchProjectItems}
        onOpenModal={vi.fn()}
      />
    );

    await selectCascadingProjectFilterOption(user, 'Lọc theo dự án', /Kho dữ liệu xã hội/);
    await user.type(screen.getByLabelText('Tìm tự do trong phạm vi đã chọn'), 'CRM');
    await user.click(screen.getByTitle('Tìm kiếm (Enter)'));

    expect(screen.getAllByText('Kho dữ liệu xã hội').some((node) => node.closest('tr'))).toBe(true);
    expect(screen.queryByText('Hồ sơ sức khỏe nội bộ')).not.toBeInTheDocument();
    expect(screen.queryByText('Triển khai HIS bệnh viện')).not.toBeInTheDocument();
  });

  it('filters local projects by selected products and scoped free text, then reset clears structured search', async () => {
    const user = userEvent.setup();

    render(
      <ProjectList
        projects={structuredSearchProjects}
        customers={structuredSearchCustomers}
        projectItems={structuredSearchProjectItems}
        onOpenModal={vi.fn()}
      />
    );

    await selectCascadingProjectFilterOption(user, 'Lọc theo sản phẩm', /HIS Core/);
    await user.type(screen.getByLabelText('Tìm tự do trong phạm vi đã chọn'), 'bệnh viện');
    await user.click(screen.getByTitle('Tìm kiếm (Enter)'));

    expect(screen.getByText('Triển khai HIS bệnh viện')).toBeInTheDocument();
    expect(screen.queryByText('Hồ sơ sức khỏe nội bộ')).not.toBeInTheDocument();
    expect(screen.queryByText('Kho dữ liệu xã hội')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Làm mới / Xóa tất cả bộ lọc'));

    expect(screen.getByLabelText('Tìm tự do trong phạm vi đã chọn')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Lọc theo khách hàng' })).toHaveTextContent('Khách hàng');
    expect(screen.getByRole('button', { name: 'Lọc theo khách hàng' })).not.toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Lọc theo dự án' })).toHaveTextContent('Dự án');
    expect(screen.getByRole('button', { name: 'Lọc theo dự án' })).not.toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Lọc theo sản phẩm' })).toHaveTextContent('Sản phẩm');
    expect(screen.getByRole('button', { name: 'Lọc theo sản phẩm' })).not.toHaveTextContent('0');
    expect(screen.getByText('Hồ sơ sức khỏe nội bộ')).toBeInTheDocument();
    expect(screen.getByText('Kho dữ liệu xã hội')).toBeInTheDocument();
    expect(screen.getByText('Triển khai HIS bệnh viện')).toBeInTheDocument();
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

    openProjectDesktopAdvancedFilters();
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

    openProjectDesktopAdvancedFilters();
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

    openProjectDesktopAdvancedFilters();
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
    const projectHeader = screen.getByRole('columnheader', { name: /Dự án/i });
    const startDateHeader = screen.getByRole('columnheader', { name: /Ngày BĐ/i });
    const endDateHeader = screen.getByRole('columnheader', { name: /Ngày KT/i });
    const amountHeader = screen.getByRole('columnheader', { name: /Thành tiền/i });
    const emptyStateCell = screen.getByText('Không tìm thấy dự án phù hợp').closest('td');
    const customerLabel = within(customerHeader).getByText('Khách hàng');

    expect(projectTable).toHaveClass('w-full', 'min-w-[1168px]', 'xl:min-w-[1300px]', 'table-fixed');
    expect(projectHeader).toHaveClass('w-[360px]', 'xl:w-[380px]');
    expect(customerHeader).toHaveClass('w-[240px]', 'xl:w-[248px]');
    expect(startDateHeader).toHaveClass('w-[96px]');
    expect(endDateHeader).toHaveClass('w-[96px]', 'hidden', 'xl:table-cell');
    expect(amountHeader).toHaveClass('w-[148px]', 'text-right', 'tabular-nums');
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
    expect(screen.getByText('1.800.000 đ').closest('div')).toHaveClass('flex', 'items-center', 'justify-end', 'tabular-nums');
    const summaryAmount = screen.getByTestId('project-period-total-value');
    expect(summaryAmount).toHaveClass('text-sm', 'font-semibold', 'text-deep-teal');
    expect(screen.queryByRole('columnheader', { name: 'Tổng cộng' })).not.toBeInTheDocument();
  });

  it('keeps the maximum project amount compact and right aligned on desktop/tablet', () => {
    render(
      <ProjectList
        projects={[{ ...projects[0], estimated_value: 66002000000 }]}
        customers={customers}
        projectItems={[]}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    const amountCell = screen.getByTestId('project-amount-1');

    expect(amountCell).toHaveTextContent('66.002.000.000 đ');
    expect(amountCell).toHaveClass('justify-end', 'whitespace-nowrap', 'tabular-nums');
  });

  it('uses a compact mobile record list with primary actions and an overflow action group', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();
    const onOpenProcedure = vi.fn();

    setProjectListViewport(true);

    render(
      <ProjectList
        projects={[{ ...projects[0], estimated_value: 66002000000 }]}
        customers={customers}
        projectItems={[]}
        onOpenModal={onOpenModal}
        onCreateContract={vi.fn()}
        onOpenProcedure={onOpenProcedure}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-mobile-filter-header')).toBeInTheDocument();
    expect(screen.getByTestId('project-mobile-summary')).toHaveTextContent('1 dự án');
    expect(screen.getByPlaceholderText('Tìm dự án, mã, khách hàng...')).toBeInTheDocument();
    expect(screen.getByTestId('project-mobile-open-filters')).toHaveTextContent('Bộ lọc');
    expect(screen.getByTestId('project-mobile-add')).toBeInTheDocument();
    expect(screen.getByTestId('project-mobile-header-actions-toggle')).toBeInTheDocument();
    expect(screen.queryByTitle('Tìm kiếm (Enter)')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Lọc trạng thái Chuẩn bị đầu tư')).not.toBeInTheDocument();

    const mobileRow = screen.getByTestId('project-mobile-row-1');
    expect(within(mobileRow).getByText('DA001')).toBeInTheDocument();
    expect(within(mobileRow).getByText('Dự án mặc định ngày')).toBeInTheDocument();
    expect(within(mobileRow).getByText('KH: Bệnh viện A')).toBeInTheDocument();
    expect(within(mobileRow).getByText('BĐ: 15/03/2026')).toBeInTheDocument();
    expect(within(mobileRow).getByText('KT: 31/12/2026')).toBeInTheDocument();

    const mobileActionFooter = screen.getByTestId('project-mobile-action-footer-1');
    expect(mobileActionFooter).toHaveClass(
      'grid',
      'grid-cols-[auto_minmax(0,1fr)_auto]',
      'items-center',
      'gap-2'
    );

    const mobileAmount = screen.getByTestId('project-mobile-amount-1');
    expect(mobileAmount).toHaveTextContent('66.002.000.000 đ');
    expect(mobileAmount).toHaveClass('justify-self-end', 'whitespace-nowrap', 'text-right', 'tabular-nums');

    const procedureButton = screen.getByTestId('project-mobile-open-procedure-1');
    const procedureButtonVisual = procedureButton.firstElementChild as HTMLElement;
    const editButton = within(mobileActionFooter).getByTitle('Sửa');
    const editButtonVisual = editButton.firstElementChild as HTMLElement;

    expect(within(mobileActionFooter).getByText('Thủ tục')).toBeInTheDocument();
    expect(within(mobileActionFooter).getByText('66.002.000.000 đ')).toBeInTheDocument();
    expect(within(mobileActionFooter).getByTitle('Thao tác khác')).toBeInTheDocument();
    expect(procedureButton).toHaveClass('h-11', 'min-w-[112px]', 'rounded-md', 'px-1');
    expect(procedureButton).not.toHaveClass('rounded-full', 'px-4');
    expect(procedureButtonVisual).toHaveClass('h-8', 'rounded-md', 'px-2.5');
    expect(procedureButtonVisual).not.toHaveClass('rounded-full');
    expect(editButton).toHaveClass('h-11', 'w-11', 'rounded-md');
    expect(editButtonVisual).toHaveClass('h-8', 'w-8', 'rounded-md');

    await user.click(procedureButton);
    expect(onOpenProcedure).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

    await user.click(within(mobileRow).getByTitle('Thao tác khác'));
    const overflowMenu = screen.getByTestId('project-mobile-actions-menu-1');
    expect(overflowMenu).toBeInTheDocument();
    expect(overflowMenu).toHaveAttribute('role', 'menu');
    expect(overflowMenu).toHaveClass('ml-auto', 'w-[220px]', 'rounded-md', 'p-1');
    expect(overflowMenu).not.toHaveClass('grid', 'grid-cols-3', 'rounded-full', 'p-0.5');
    expect(within(overflowMenu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(overflowMenu).getByRole('menuitem', { name: /Sao chép/i })).toBeInTheDocument();
    expect(within(overflowMenu).getByRole('menuitem', { name: /Tạo HĐ/i })).toBeInTheDocument();
    expect(within(overflowMenu).getByRole('menuitem', { name: /Xóa/i })).toBeInTheDocument();

    await user.click(screen.getByTestId('project-mobile-copy-1'));
    expect(onOpenModal).toHaveBeenCalledWith('ADD_PROJECT', expect.objectContaining({ id: 1 }));
  });

  it('keeps advanced mobile filters in a bottom sheet until the user applies them', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const defaultDateFilters = getProjectsPageDefaultDateFilters();

    setProjectListViewport(true);

    render(
      <ProjectList
        projects={projects}
        customers={customers}
        departments={departments}
        projectItems={[]}
        onOpenModal={vi.fn()}
        paginationMeta={projectListPaginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    const mobileHeader = screen.getByTestId('project-mobile-filter-header');
    expect(mobileHeader.parentElement).toHaveClass('px-3', 'pt-1.5', 'pb-6', 'md:p-3', 'md:pb-6');

    await user.type(screen.getByPlaceholderText('Tìm dự án, mã, khách hàng...'), 'DA001');
    await user.click(screen.getByTestId('project-mobile-open-filters'));

    let filterDialog = screen.getByRole('dialog', { name: 'Bộ lọc' });
    const filterContainer = filterDialog.parentElement as HTMLElement;
    expect(filterContainer.parentElement).toBe(document.body);
    expect(filterContainer).toHaveClass(
      'fixed',
      'inset-0',
      'h-[100dvh]',
      'min-h-[100dvh]',
      'overflow-hidden',
      'overscroll-none',
      'bg-[var(--ui-modal-backdrop)]'
    );
    expect(screen.getByTestId('modal-backdrop')).toHaveClass('bg-transparent');
    expect(filterDialog).toHaveClass('h-[82dvh]', 'sm:h-auto', 'max-h-[calc(100dvh-8px)]', 'sm:max-h-[90vh]');
    expect(within(filterDialog).getByText('Phòng ban')).toBeInTheDocument();
    expect(within(filterDialog).getByText('Trạng thái')).toBeInTheDocument();
    expect(within(filterDialog).getByText('Ngày bắt đầu')).toBeInTheDocument();
    expect(within(filterDialog).getByLabelText('Từ ngày')).toHaveValue(defaultDateFilters.start_date_from);

    await user.click(within(filterDialog).getByRole('button', { name: 'Lọc trạng thái Cơ hội' }));
    fireEvent.change(within(filterDialog).getByLabelText('Từ ngày'), { target: { value: '2026-02-01' } });
    expect(onQueryChange).not.toHaveBeenCalled();

    await user.click(within(filterDialog).getByRole('button', { name: 'Đóng' }));
    expect(onQueryChange).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('project-mobile-open-filters'));
    filterDialog = screen.getByRole('dialog', { name: 'Bộ lọc' });
    expect(within(filterDialog).getByRole('button', { name: 'Lọc trạng thái Cơ hội' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(filterDialog).getByLabelText('Từ ngày')).toHaveValue(defaultDateFilters.start_date_from);

    await user.click(within(filterDialog).getByRole('button', { name: 'Lọc trạng thái Cơ hội' }));
    fireEvent.change(within(filterDialog).getByLabelText('Từ ngày'), { target: { value: '2026-02-01' } });
    await user.click(within(filterDialog).getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        q: 'DA001',
        filters: expect.objectContaining({
          status: 'CO_HOI',
          start_date_from: '2026-02-01',
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });

    expect(screen.queryByRole('dialog', { name: 'Bộ lọc' })).not.toBeInTheDocument();
    expect(screen.getByTestId('project-mobile-open-filters')).toHaveTextContent('2');
    expect(screen.getByTestId('project-mobile-applied-filters')).toHaveTextContent('Cơ hội');
    expect(screen.getByTestId('project-mobile-applied-filters')).toHaveTextContent('01/02/2026');

    await user.click(screen.getByTestId('project-mobile-open-filters'));
    filterDialog = screen.getByRole('dialog', { name: 'Bộ lọc' });
    await user.click(within(filterDialog).getByRole('button', { name: 'Đặt lại' }));

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        q: '',
        filters: expect.objectContaining({
          status: '',
          department_id: '',
          start_date_from: defaultDateFilters.start_date_from,
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });

    expect(screen.queryByRole('dialog', { name: 'Bộ lọc' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm dự án, mã, khách hàng...')).toHaveValue('');
  });
});
