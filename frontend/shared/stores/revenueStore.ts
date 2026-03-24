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
  setPeriod: (from: string, to: string) => void;
  setPeriodType: (type: RevenuePeriodType) => void;
  setGrouping: (grouping: 'month' | 'quarter') => void;
  setDeptId: (id: number | null) => void;
  setYear: (year: number) => void;
  setFeeCollectionAvailable: (available: boolean) => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}

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

export const useRevenueStore = create<RevenueStoreState>((set, get) => ({
  activeView: 'OVERVIEW',
  reportTab: 'department',

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
  setReportTab: (tab) => set({ reportTab: tab }),
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
    const params = new URLSearchParams(window.location.search);
    const updates: Partial<RevenueStoreState> = {};

    const view = params.get('rev_view') as RevenueSubView | null;
    if (view && ['OVERVIEW', 'BY_CONTRACT', 'BY_COLLECTION', 'FORECAST', 'REPORT'].includes(view)) {
      updates.activeView = view;
    }

    const pf = params.get('rev_from');
    if (pf) updates.periodFrom = pf;

    const pt = params.get('rev_to');
    if (pt) updates.periodTo = pt;

    const pType = params.get('rev_period_type') as RevenuePeriodType | null;
    if (pType && ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(pType)) {
      updates.periodType = pType;
    }

    const g = params.get('rev_grouping');
    if (g === 'month' || g === 'quarter') {
      updates.grouping = g;
    }

    const deptId = params.get('rev_dept_id');
    if (deptId !== null) {
      updates.selectedDeptId = deptId === '' ? null : parseInt(deptId, 10);
    }

    if (Object.keys(updates).length > 0) {
      set(updates as Partial<RevenueStoreState>);
    }
  },

  syncToUrl: () => {
    const state = get();
    const params = new URLSearchParams(window.location.search);

    params.set('rev_view', state.activeView);
    params.set('rev_from', state.periodFrom);
    params.set('rev_to', state.periodTo);
    params.set('rev_period_type', state.periodType);
    params.set('rev_grouping', state.grouping);

    if (state.selectedDeptId !== null) {
      params.set('rev_dept_id', String(state.selectedDeptId));
    } else {
      params.delete('rev_dept_id');
    }

    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  },
}));
