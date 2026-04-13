import { create } from 'zustand';
import type { RevenuePeriodType, RevenueSubView } from '../../types';

/**
 * Revenue Management store — shared state across hub sub-views.
 *
 * SHARED state lives here (persists across sub-view switches).
 * LOCAL/ephemeral state (isTargetModalOpen, editingTarget, isExporting)
 * stays in individual components.
 */

interface RevenueStoreState {
  // View navigation
  activeView: RevenueSubView;
  reportTab: 'department' | 'customer' | 'product' | 'time';
  forecastHorizon: 3 | 6 | 12;

  // Period filters (shared across sub-views)
  periodFrom: string;
  periodTo: string;
  periodType: RevenuePeriodType;
  grouping: 'month' | 'quarter';
  selectedDeptId: number | null;
  year: number;

  // Fee collection availability (from API meta)
  feeCollectionAvailable: boolean;

  // Actions
  setActiveView: (view: RevenueSubView) => void;
  setReportTab: (tab: RevenueStoreState['reportTab']) => void;
  setForecastHorizon: (horizon: RevenueStoreState['forecastHorizon']) => void;
  setPeriod: (from: string, to: string) => void;
  setPeriodType: (type: RevenuePeriodType) => void;
  setGrouping: (grouping: 'month' | 'quarter') => void;
  setDeptId: (id: number | null) => void;
  setYear: (year: number) => void;
  setFeeCollectionAvailable: (available: boolean) => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}

type PersistedRevenueUiState = Pick<
  RevenueStoreState,
  | 'activeView'
  | 'reportTab'
  | 'forecastHorizon'
  | 'periodFrom'
  | 'periodTo'
  | 'periodType'
  | 'grouping'
  | 'selectedDeptId'
  | 'year'
>;

const REVENUE_UI_STATE_STORAGE_KEY = 'revenue_mgmt_state';
const REVENUE_URL_PARAM_KEYS = [
  'rev_view',
  'rev_from',
  'rev_to',
  'rev_period_type',
  'rev_grouping',
  'rev_report_tab',
  'rev_horizon',
  'rev_dept_id',
] as const;

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getDefaultPeriodFrom(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function getDefaultPeriodTo(): string {
  const now = new Date();
  return `${now.getFullYear()}-12-31`;
}

function isRevenueSubView(value: string | null): value is RevenueSubView {
  return value !== null && ['OVERVIEW', 'BY_CONTRACT', 'BY_COLLECTION', 'FORECAST', 'REPORT'].includes(value);
}

function isRevenuePeriodType(value: string | null): value is RevenuePeriodType {
  return value !== null && ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(value);
}

function isRevenueReportTab(value: string | null): value is RevenueStoreState['reportTab'] {
  return value !== null && ['department', 'customer', 'product', 'time'].includes(value);
}

function isRevenueGrouping(value: string | null): value is RevenueStoreState['grouping'] {
  return value === 'month' || value === 'quarter';
}

function parseForecastHorizon(value: string | number | null | undefined): RevenueStoreState['forecastHorizon'] | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return parsed === 3 || parsed === 6 || parsed === 12 ? parsed : null;
}

function parseOptionalDeptId(value: string | number | null | undefined): number | null | undefined {
  if (value === null) {
    return null;
  }

  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function parseYear(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : undefined;
}

function deriveYearFromPeriod(periodFrom?: string): number | undefined {
  if (!periodFrom || !/^\d{4}-\d{2}-\d{2}$/.test(periodFrom)) {
    return undefined;
  }

  return parseYear(periodFrom.slice(0, 4));
}

function pickPersistedRevenueUiState(state: RevenueStoreState | PersistedRevenueUiState): PersistedRevenueUiState {
  return {
    activeView: state.activeView,
    reportTab: state.reportTab,
    forecastHorizon: state.forecastHorizon,
    periodFrom: state.periodFrom,
    periodTo: state.periodTo,
    periodType: state.periodType,
    grouping: state.grouping,
    selectedDeptId: state.selectedDeptId,
    year: state.year,
  };
}

function sanitizePersistedRevenueUiState(raw: unknown): Partial<PersistedRevenueUiState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const candidate = raw as Record<string, unknown>;
  const updates: Partial<PersistedRevenueUiState> = {};
  const activeView = typeof candidate.activeView === 'string' ? candidate.activeView : null;
  const reportTab = typeof candidate.reportTab === 'string' ? candidate.reportTab : null;
  const periodType = typeof candidate.periodType === 'string' ? candidate.periodType : null;
  const grouping = typeof candidate.grouping === 'string' ? candidate.grouping : null;
  const periodFrom = typeof candidate.periodFrom === 'string' ? candidate.periodFrom : undefined;
  const periodTo = typeof candidate.periodTo === 'string' ? candidate.periodTo : undefined;
  const selectedDeptId = parseOptionalDeptId(candidate.selectedDeptId as string | number | null | undefined);
  const forecastHorizon = parseForecastHorizon(candidate.forecastHorizon as string | number | null | undefined);
  const year = parseYear(candidate.year as string | number | null | undefined);

  if (isRevenueSubView(activeView)) {
    updates.activeView = activeView;
  }
  if (isRevenueReportTab(reportTab)) {
    updates.reportTab = reportTab;
  }
  if (forecastHorizon !== null) {
    updates.forecastHorizon = forecastHorizon;
  }
  if (periodFrom) {
    updates.periodFrom = periodFrom;
  }
  if (periodTo) {
    updates.periodTo = periodTo;
  }
  if (isRevenuePeriodType(periodType)) {
    updates.periodType = periodType;
  }
  if (isRevenueGrouping(grouping)) {
    updates.grouping = grouping;
  }
  if (selectedDeptId !== undefined) {
    updates.selectedDeptId = selectedDeptId;
  }
  if (year !== undefined) {
    updates.year = year;
  }

  if (updates.year === undefined) {
    const derivedYear = deriveYearFromPeriod(updates.periodFrom);
    if (derivedYear !== undefined) {
      updates.year = derivedYear;
    }
  }

  return updates;
}

function readPersistedRevenueUiState(): Partial<PersistedRevenueUiState> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(REVENUE_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return sanitizePersistedRevenueUiState(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writePersistedRevenueUiState(state: PersistedRevenueUiState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(REVENUE_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

function stripRevenueParamsFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  let changed = false;

  REVENUE_URL_PARAM_KEYS.forEach((key) => {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  });

  if (!changed) {
    return;
  }

  const nextQuery = params.toString();
  const nextUrl = nextQuery
    ? `${window.location.pathname}?${nextQuery}`
    : window.location.pathname;

  window.history.replaceState({}, '', nextUrl);
}

function persistRevenueUiState(state: RevenueStoreState | PersistedRevenueUiState): void {
  writePersistedRevenueUiState(pickPersistedRevenueUiState(state));
  stripRevenueParamsFromUrl();
}

export const useRevenueStore = create<RevenueStoreState>((set, get) => ({
  activeView: 'OVERVIEW',
  reportTab: 'department',
  forecastHorizon: 6,

  periodFrom: getDefaultPeriodFrom(),
  periodTo: getDefaultPeriodTo(),
  periodType: 'MONTHLY',
  grouping: 'month',
  selectedDeptId: null,
  year: getCurrentYear(),

  feeCollectionAvailable: false,

  setActiveView: (view) => {
    set({ activeView: view });
    get().syncToUrl();
  },
  setReportTab: (tab) => {
    set({ reportTab: tab });
    get().syncToUrl();
  },
  setForecastHorizon: (horizon) => {
    set({ forecastHorizon: horizon });
    get().syncToUrl();
  },
  setPeriod: (from, to) => {
    set({ periodFrom: from, periodTo: to });
    get().syncToUrl();
  },
  setPeriodType: (type) => {
    set({ periodType: type });
    get().syncToUrl();
  },
  setGrouping: (grouping) => {
    set({ grouping });
    get().syncToUrl();
  },
  setDeptId: (id) => {
    set({ selectedDeptId: id });
    get().syncToUrl();
  },
  setYear: (year) => {
    set({
      year,
      periodFrom: `${year}-01-01`,
      periodTo: `${year}-12-31`,
    });
    get().syncToUrl();
  },
  setFeeCollectionAvailable: (available) => set({ feeCollectionAvailable: available }),

  syncFromUrl: () => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hasLegacyRevenueParams = REVENUE_URL_PARAM_KEYS.some((key) => params.has(key));
    const updates: Partial<RevenueStoreState> = {
      ...readPersistedRevenueUiState(),
    };

    const view = params.get('rev_view');
    if (isRevenueSubView(view)) {
      updates.activeView = view;
    }

    const periodFrom = params.get('rev_from');
    if (periodFrom) {
      updates.periodFrom = periodFrom;
    }

    const periodTo = params.get('rev_to');
    if (periodTo) {
      updates.periodTo = periodTo;
    }

    const periodType = params.get('rev_period_type');
    if (isRevenuePeriodType(periodType)) {
      updates.periodType = periodType;
    }

    const grouping = params.get('rev_grouping');
    if (isRevenueGrouping(grouping)) {
      updates.grouping = grouping;
    }

    if (params.has('rev_dept_id')) {
      const deptId = parseOptionalDeptId(params.get('rev_dept_id'));
      if (deptId !== undefined) {
        updates.selectedDeptId = deptId;
      }
    }

    const reportTab = params.get('rev_report_tab');
    if (isRevenueReportTab(reportTab)) {
      updates.reportTab = reportTab;
    }

    const forecastHorizon = parseForecastHorizon(params.get('rev_horizon'));
    if (forecastHorizon !== null) {
      updates.forecastHorizon = forecastHorizon;
    }

    if (updates.year === undefined) {
      const derivedYear = deriveYearFromPeriod(updates.periodFrom);
      if (derivedYear !== undefined) {
        updates.year = derivedYear;
      }
    }

    if (Object.keys(updates).length > 0) {
      set(updates as Partial<RevenueStoreState>);
      persistRevenueUiState({ ...get(), ...(updates as Partial<RevenueStoreState>) } as RevenueStoreState);
    } else if (hasLegacyRevenueParams) {
      stripRevenueParamsFromUrl();
    }
  },

  syncToUrl: () => {
    persistRevenueUiState(get());
  },
}));
