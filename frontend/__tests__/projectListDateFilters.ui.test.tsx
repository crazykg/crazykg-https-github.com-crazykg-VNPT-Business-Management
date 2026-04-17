import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { ProjectList } from '../components/ProjectList';
import { useFilterStore } from '../shared/stores';
import { FILTER_DEFAULTS, getProjectsPageDefaultDateFilters } from '../shared/stores/filterStore';
import type { AuthUser, Customer, Department, Project, ProjectItemMaster } from '../types';

const cloneDefaults = () => ({
  employeesPage: { ...FILTER_DEFAULTS.employeesPage, filters: { ...(FILTER_DEFAULTS.employeesPage.filters || {}) } },
  partyProfilesPage: { ...FILTER_DEFAULTS.partyProfilesPage, filters: { ...(FILTER_DEFAULTS.partyProfilesPage.filters || {}) } },
  customersPage: { ...FILTER_DEFAULTS.customersPage, filters: { ...(FILTER_DEFAULTS.customersPage.filters || {}) } },
  projectsPage: { ...FILTER_DEFAULTS.projectsPage, filters: { ...(FILTER_DEFAULTS.projectsPage.filters || {}) } },
  productsPage: { ...FILTER_DEFAULTS.productsPage, filters: { ...(FILTER_DEFAULTS.productsPage.filters || {}) } },
  contractsPage: { ...FILTER_DEFAULTS.contractsPage, filters: { ...(FILTER_DEFAULTS.contractsPage.filters || {}) } },
  passContractsPage: { ...FILTER_DEFAULTS.passContractsPage, filters: { ...(FILTER_DEFAULTS.passContractsPage.filters || {}) } },
  documentsPage: { ...FILTER_DEFAULTS.documentsPage, filters: { ...(FILTER_DEFAULTS.documentsPage.filters || {}) } },
  auditLogsPage: { ...FILTER_DEFAULTS.auditLogsPage, filters: { ...(FILTER_DEFAULTS.auditLogsPage.filters || {}) } },
  feedbacksPage: { ...FILTER_DEFAULTS.feedbacksPage, filters: { ...(FILTER_DEFAULTS.feedbacksPage.filters || {}) } },
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

    expect(screen.getByTitle('Từ ngày')).toHaveValue(defaultDateFilters.start_date_from);
    expect(screen.getByTitle('Đến ngày')).toHaveValue(defaultDateFilters.start_date_to);

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          start_date_from: defaultDateFilters.start_date_from,
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });

    expect(screen.getByText('Thành tiền')).toBeInTheDocument();
    expect(screen.getByText('Tổng cộng')).toBeInTheDocument();
    expect(screen.getByText('1.800.000 đ')).toBeInTheDocument();
    expect(screen.getByText('5.400.000 đ')).toBeInTheDocument();
    expect(screen.queryByText('1.500.000 đ')).not.toBeInTheDocument();
  });

  it('resets the project date filters back to the default window instead of blank', async () => {
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

    const fromInput = screen.getByTitle('Từ ngày');
    const toInput = screen.getByTitle('Đến ngày');

    fireEvent.change(fromInput, { target: { value: '2026-02-01' } });
    fireEvent.change(toInput, { target: { value: '2026-02-28' } });

    expect(fromInput).toHaveValue('2026-02-01');
    expect(toInput).toHaveValue('2026-02-28');

    fireEvent.click(screen.getByTitle('Xóa lọc ngày'));

    expect(fromInput).toHaveValue(defaultDateFilters.start_date_from);
    expect(toInput).toHaveValue(defaultDateFilters.start_date_to);

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({
        filters: expect.objectContaining({
          start_date_from: defaultDateFilters.start_date_from,
          start_date_to: defaultDateFilters.start_date_to,
        }),
      }));
    });
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

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
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

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
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
          ...FILTER_DEFAULTS.projectsPage,
          filters: {
            ...(FILTER_DEFAULTS.projectsPage.filters || {}),
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

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
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
    const summaryAmount = screen.getByText('5.400.000 đ');
    expect(summaryAmount).toHaveClass('text-lg', 'font-black', 'leading-none', 'text-primary');
    expect(screen.queryByRole('columnheader', { name: 'Tổng cộng' })).not.toBeInTheDocument();
  });
});
