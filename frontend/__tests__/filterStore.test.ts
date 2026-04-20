import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '../shared/stores';
import { FILTER_DEFAULTS, getDefaultTabFilter, getProjectsPageDefaultDateFilters } from '../shared/stores/filterStore';

const cloneDefaultTabFilter = (tab: keyof typeof FILTER_DEFAULTS) => getDefaultTabFilter(tab);

describe('useFilterStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T09:00:00+07:00'));
    useFilterStore.setState({
      tabFilters: {
        employeesPage: cloneDefaultTabFilter('employeesPage'),
        partyProfilesPage: cloneDefaultTabFilter('partyProfilesPage'),
        customersPage: cloneDefaultTabFilter('customersPage'),
        projectsPage: cloneDefaultTabFilter('projectsPage'),
        productsPage: cloneDefaultTabFilter('productsPage'),
        contractsPage: cloneDefaultTabFilter('contractsPage'),
        passContractsPage: cloneDefaultTabFilter('passContractsPage'),
        documentsPage: cloneDefaultTabFilter('documentsPage'),
        auditLogsPage: cloneDefaultTabFilter('auditLogsPage'),
        feedbacksPage: cloneDefaultTabFilter('feedbacksPage'),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns repo-native defaults for each page key', () => {
    const projectDefaultDates = getProjectsPageDefaultDateFilters();

    expect(projectDefaultDates).toEqual({
      start_date_from: '2026-01-01',
      start_date_to: '2026-04-30',
    });

    expect(useFilterStore.getState().getTabFilter('employeesPage')).toMatchObject({
      page: 1,
      per_page: 7,
      sort_by: 'user_code',
      sort_dir: 'asc',
    });

    expect(useFilterStore.getState().getTabFilter('contractsPage')).toMatchObject({
      page: 1,
      per_page: 10,
      sort_by: 'id',
      sort_dir: 'desc',
    });

    expect(useFilterStore.getState().getTabFilter('projectsPage')).toMatchObject({
      page: 1,
      per_page: 10,
      sort_by: 'id',
      sort_dir: 'desc',
      filters: {
        start_date_from: projectDefaultDates.start_date_from,
        start_date_to: projectDefaultDates.start_date_to,
      },
    });
  });

  it('merges incoming page query updates into the active tab filter', () => {
    useFilterStore.getState().setTabFilter('customersPage', {
      q: 'benh vien',
      page: 2,
      filters: {
        customer_sector: 'HEALTHCARE',
      },
    });

    expect(useFilterStore.getState().getTabFilter('customersPage')).toMatchObject({
      page: 2,
      per_page: 10,
      q: 'benh vien',
      sort_by: 'customer_code',
      filters: {
        customer_sector: 'HEALTHCARE',
      },
    });
  });

  it('replaces and resets a stored filter snapshot deterministically', () => {
    const projectDefaultDates = getProjectsPageDefaultDateFilters();

    useFilterStore.getState().replaceTabFilter('projectsPage', {
      page: 3,
      per_page: 50,
      q: 'demo',
      sort_by: 'project_code',
      sort_dir: 'asc',
      filters: {
        status: 'CHUAN_BI',
      },
    });

    expect(useFilterStore.getState().getTabFilter('projectsPage')).toMatchObject({
      page: 3,
      per_page: 50,
      q: 'demo',
      sort_by: 'project_code',
      filters: {
        start_date_from: projectDefaultDates.start_date_from,
        start_date_to: projectDefaultDates.start_date_to,
        status: 'CHUAN_BI',
      },
    });

    useFilterStore.getState().resetTabFilter('projectsPage');

    expect(useFilterStore.getState().getTabFilter('projectsPage')).toMatchObject({
      page: 1,
      per_page: 10,
      q: '',
      sort_by: 'id',
      sort_dir: 'desc',
      filters: {
        start_date_from: projectDefaultDates.start_date_from,
        start_date_to: projectDefaultDates.start_date_to,
      },
    });
  });
});
