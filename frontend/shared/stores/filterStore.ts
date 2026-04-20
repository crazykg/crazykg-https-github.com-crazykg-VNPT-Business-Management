import { create } from 'zustand';
import type { PaginatedQuery } from '../../types';
import { DateRangePresets } from '../../utils/dateRangePresets';

export type FilterTabKey =
  | 'employeesPage'
  | 'partyProfilesPage'
  | 'customersPage'
  | 'projectsPage'
  | 'productsPage'
  | 'contractsPage'
  | 'passContractsPage'
  | 'documentsPage'
  | 'auditLogsPage'
  | 'feedbacksPage';

const cloneQuery = (query: PaginatedQuery): PaginatedQuery => ({
  ...query,
  filters: query.filters ? { ...query.filters } : {},
});

const mergeQueryWithFilters = (
  baseQuery: PaginatedQuery,
  incomingQuery?: Partial<PaginatedQuery> | PaginatedQuery
): PaginatedQuery => ({
  ...baseQuery,
  ...(incomingQuery ?? {}),
  filters: incomingQuery?.filters
    ? { ...(baseQuery.filters || {}), ...incomingQuery.filters }
    : { ...(baseQuery.filters || {}) },
});

export const getProjectsPageDefaultDateFilters = (): { start_date_from: string; start_date_to: string } => {
  const dateRange = DateRangePresets.currentYearStartToCurrentMonthEnd();

  return {
    start_date_from: dateRange.from,
    start_date_to: dateRange.to,
  };
};

export const FILTER_DEFAULTS: Record<FilterTabKey, PaginatedQuery> = {
  employeesPage: { page: 1, per_page: 7, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} },
  partyProfilesPage: { page: 1, per_page: 10, sort_by: 'user_code', sort_dir: 'asc', q: '', filters: {} },
  customersPage: { page: 1, per_page: 10, sort_by: 'customer_code', sort_dir: 'asc', q: '', filters: {} },
  projectsPage: {
    page: 1,
    per_page: 10,
    sort_by: 'id',
    sort_dir: 'desc',
    q: '',
    filters: {},
  },
  productsPage: { page: 1, per_page: 10, sort_by: 'product_code', sort_dir: 'asc', q: '', filters: {} },
  contractsPage: { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} },
  passContractsPage: { page: 1, per_page: 10, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} },
  documentsPage: { page: 1, per_page: 7, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} },
  auditLogsPage: { page: 1, per_page: 10, sort_by: 'created_at', sort_dir: 'desc', q: '', filters: {} },
  feedbacksPage: { page: 1, per_page: 20, sort_by: 'id', sort_dir: 'desc', q: '', filters: {} },
};

export const getDefaultTabFilter = (tab: FilterTabKey): PaginatedQuery => {
  const baseQuery = FILTER_DEFAULTS[tab];

  if (tab !== 'projectsPage') {
    return cloneQuery(baseQuery);
  }

  return cloneQuery(mergeQueryWithFilters(baseQuery, {
    filters: getProjectsPageDefaultDateFilters(),
  }));
};

const buildInitialFilters = (): Record<FilterTabKey, PaginatedQuery> => ({
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

interface FilterState {
  tabFilters: Record<FilterTabKey, PaginatedQuery>;
  setTabFilter: (tab: FilterTabKey, query: Partial<PaginatedQuery>) => void;
  replaceTabFilter: (tab: FilterTabKey, query: PaginatedQuery) => void;
  getTabFilter: (tab: FilterTabKey) => PaginatedQuery;
  resetTabFilter: (tab: FilterTabKey) => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  tabFilters: buildInitialFilters(),

  setTabFilter: (tab, query) =>
    set((state) => {
      const currentQuery = mergeQueryWithFilters(getDefaultTabFilter(tab), state.tabFilters[tab]);

      return {
        tabFilters: {
          ...state.tabFilters,
          [tab]: cloneQuery(mergeQueryWithFilters(currentQuery, query)),
        },
      };
    }),

  replaceTabFilter: (tab, query) =>
    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [tab]: cloneQuery(mergeQueryWithFilters(getDefaultTabFilter(tab), query)),
      },
    })),

  getTabFilter: (tab) => cloneQuery(mergeQueryWithFilters(getDefaultTabFilter(tab), get().tabFilters[tab])),

  resetTabFilter: (tab) =>
    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [tab]: getDefaultTabFilter(tab),
      },
    })),
}));
