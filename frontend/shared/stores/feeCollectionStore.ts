import { create } from 'zustand';

export type FeeCollectionSubView = 'DASHBOARD' | 'INVOICES' | 'RECEIPTS' | 'DEBT_REPORT';

interface FeeCollectionStoreState {
  activeView: FeeCollectionSubView;
  periodFrom: string;
  periodTo: string;
  setActiveView: (view: FeeCollectionSubView) => void;
  setPeriod: (from: string, to: string) => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}

type PersistedFeeCollectionUiState = Pick<FeeCollectionStoreState, 'activeView' | 'periodFrom' | 'periodTo'>;

const FEE_COLLECTION_UI_STATE_STORAGE_KEY = 'fee_collection_state';
const FEE_COLLECTION_URL_PARAM_KEYS = [
  'fc_view',
  'fc_period_from',
  'fc_period_to',
] as const;

function getDefaultPeriodFrom(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function getDefaultPeriodTo(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function isFeeCollectionSubView(value: string | null): value is FeeCollectionSubView {
  return value !== null && ['DASHBOARD', 'INVOICES', 'RECEIPTS', 'DEBT_REPORT'].includes(value);
}

function isIsoDateString(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sanitizePersistedFeeCollectionUiState(raw: unknown): Partial<PersistedFeeCollectionUiState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const candidate = raw as Record<string, unknown>;
  const updates: Partial<PersistedFeeCollectionUiState> = {};
  const activeView = typeof candidate.activeView === 'string' ? candidate.activeView : null;
  const periodFrom = typeof candidate.periodFrom === 'string' ? candidate.periodFrom : null;
  const periodTo = typeof candidate.periodTo === 'string' ? candidate.periodTo : null;

  if (isFeeCollectionSubView(activeView)) {
    updates.activeView = activeView;
  }
  if (isIsoDateString(periodFrom)) {
    updates.periodFrom = periodFrom;
  }
  if (isIsoDateString(periodTo)) {
    updates.periodTo = periodTo;
  }

  return updates;
}

function readPersistedFeeCollectionUiState(): Partial<PersistedFeeCollectionUiState> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(FEE_COLLECTION_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return sanitizePersistedFeeCollectionUiState(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writePersistedFeeCollectionUiState(state: PersistedFeeCollectionUiState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(FEE_COLLECTION_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

function stripFeeCollectionParamsFromUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  let changed = false;

  FEE_COLLECTION_URL_PARAM_KEYS.forEach((key) => {
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

function persistFeeCollectionUiState(state: FeeCollectionStoreState | PersistedFeeCollectionUiState): void {
  writePersistedFeeCollectionUiState({
    activeView: state.activeView,
    periodFrom: state.periodFrom,
    periodTo: state.periodTo,
  });
  stripFeeCollectionParamsFromUrl();
}

export const useFeeCollectionStore = create<FeeCollectionStoreState>((set, get) => ({
  activeView: 'DASHBOARD',
  periodFrom: getDefaultPeriodFrom(),
  periodTo: getDefaultPeriodTo(),

  setActiveView: (view) => {
    set({ activeView: view });
    get().syncToUrl();
  },

  setPeriod: (from, to) => {
    set({ periodFrom: from, periodTo: to });
    get().syncToUrl();
  },

  syncFromUrl: () => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hasLegacyFeeCollectionParams = FEE_COLLECTION_URL_PARAM_KEYS.some((key) => params.has(key));
    const updates: Partial<FeeCollectionStoreState> = {
      ...readPersistedFeeCollectionUiState(),
    };

    const view = params.get('fc_view');
    if (isFeeCollectionSubView(view)) {
      updates.activeView = view;
    }

    const periodFrom = params.get('fc_period_from');
    if (isIsoDateString(periodFrom)) {
      updates.periodFrom = periodFrom;
    }

    const periodTo = params.get('fc_period_to');
    if (isIsoDateString(periodTo)) {
      updates.periodTo = periodTo;
    }

    if (Object.keys(updates).length > 0) {
      set(updates as Partial<FeeCollectionStoreState>);
      persistFeeCollectionUiState({ ...get(), ...(updates as Partial<FeeCollectionStoreState>) } as FeeCollectionStoreState);
    } else if (hasLegacyFeeCollectionParams) {
      stripFeeCollectionParamsFromUrl();
    }
  },

  syncToUrl: () => {
    persistFeeCollectionUiState(get());
  },
}));
