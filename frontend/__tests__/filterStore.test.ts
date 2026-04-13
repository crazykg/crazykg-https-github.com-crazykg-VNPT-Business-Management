import { beforeEach, describe, expect, it } from 'vitest';
import { useFilterStore } from '../shared/stores';
import { FILTER_DEFAULTS, getProjectsPageDefaultDateFilters } from '../shared/stores/filterStore';

describe('useFilterStore', () => {
  beforeEach(() => {
    useFilterStore.setState({
      tabFilters: {
        employeesPage: { ...FILTER_DEFAULTS.employeesPage, filters: { ...FILTER_DEFAULTS.employeesPage.filters } },
        partyProfilesPage: { ...FILTER_DEFAULTS.partyProfilesPage, filters: { ...FILTER_DEFAULTS.partyProfilesPage.filters } },
        customersPage: { ...FILTER_DEFAULTS.customersPage, filters: { ...FILTER_DEFAULTS.customersPage.filters } },
        projectsPage: { ...FILTER_DEFAULTS.projectsPage, filters: { ...FILTER_DEFAULTS.projectsPage.filters } },
        productsPage: { ...FILTER_DEFAULTS.productsPage, filters: { ...FILTER_DEFAULTS.productsPage.filters } },
        contractsPage: { ...FILTER_DEFAULTS.contractsPage, filters: { ...FILTER_DEFAULTS.contractsPage.filters } },
        passContractsPage: { ...FILTER_DEFAULTS.passContractsPage, filters: { ...FILTER_DEFAULTS.passContractsPage.filters } },
        documentsPage: { ...FILTER_DEFAULTS.documentsPage, filters: { ...FILTER_DEFAULTS.documentsPage.filters } },
        auditLogsPage: { ...FILTER_DEFAULTS.auditLogsPage, filters: { ...FILTER_DEFAULTS.auditLogsPage.filters } },
        feedbacksPage: { ...FILTER_DEFAULTS.feedbacksPage, filters: { ...FILTER_DEFAULTS.feedbacksPage.filters } },
      },
    });
  });

  it('returns repo-native defaults for each page key', () => {
    const projectDefaultDates = getProjectsPageDefaultDateFilters();

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
