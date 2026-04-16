import { create } from 'zustand';
import type { PaginatedQuery } from '../../types';

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

const formatDateForFilter = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getProjectsPageDefaultDateFilters = (): { start_date_from: string; start_date_to: string } => ({
  start_date_from: '',
  start_date_to: '',
});

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

const buildInitialFilters = (): Record<FilterTabKey, PaginatedQuery> => ({
  employeesPage: cloneQuery(FILTER_DEFAULTS.employeesPage),
  partyProfilesPage: cloneQuery(FILTER_DEFAULTS.partyProfilesPage),
  customersPage: cloneQuery(FILTER_DEFAULTS.customersPage),
  projectsPage: cloneQuery(FILTER_DEFAULTS.projectsPage),
  productsPage: cloneQuery(FILTER_DEFAULTS.productsPage),
  contractsPage: cloneQuery(FILTER_DEFAULTS.contractsPage),
  passContractsPage: cloneQuery(FILTER_DEFAULTS.passContractsPage),
  documentsPage: cloneQuery(FILTER_DEFAULTS.documentsPage),
  auditLogsPage: cloneQuery(FILTER_DEFAULTS.auditLogsPage),
  feedbacksPage: cloneQuery(FILTER_DEFAULTS.feedbacksPage),
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
    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [tab]: {
          ...cloneQuery(state.tabFilters[tab] ?? FILTER_DEFAULTS[tab]),
          ...query,
          filters: query.filters ? { ...query.filters } : state.tabFilters[tab]?.filters ?? {},
        },
      },
    })),

  replaceTabFilter: (tab, query) =>
    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [tab]: cloneQuery(query),
      },
    })),

  getTabFilter: (tab) => cloneQuery(get().tabFilters[tab] ?? FILTER_DEFAULTS[tab]),

  resetTabFilter: (tab) =>
    set((state) => ({
      tabFilters: {
        ...state.tabFilters,
        [tab]: cloneQuery(FILTER_DEFAULTS[tab]),
      },
    })),
}));
