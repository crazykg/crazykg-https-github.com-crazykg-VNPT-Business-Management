export type ProductCatalogDisplayMode = 'table' | 'list';

export interface PersistedProductListUiState {
  catalogDisplayMode: ProductCatalogDisplayMode;
  currentPage: number;
  rowsPerPage: number;
}

export const PRODUCT_LIST_UI_STATE_STORAGE_KEY = 'products_catalog_ui_state';

const isProductCatalogDisplayMode = (value: unknown): value is ProductCatalogDisplayMode =>
  value === 'table' || value === 'list';

const parsePositiveNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
};

function sanitizePersistedProductListUiState(raw: unknown): Partial<PersistedProductListUiState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const candidate = raw as Record<string, unknown>;
  const updates: Partial<PersistedProductListUiState> = {};

  if (isProductCatalogDisplayMode(candidate.catalogDisplayMode)) {
    updates.catalogDisplayMode = candidate.catalogDisplayMode;
  }

  const currentPage = parsePositiveNumber(candidate.currentPage);
  if (currentPage !== undefined) {
    updates.currentPage = currentPage;
  }

  const rowsPerPage = parsePositiveNumber(candidate.rowsPerPage);
  if (rowsPerPage !== undefined) {
    updates.rowsPerPage = rowsPerPage;
  }

  return updates;
}

export function readPersistedProductListUiState(): Partial<PersistedProductListUiState> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(PRODUCT_LIST_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return sanitizePersistedProductListUiState(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writePersistedProductListUiState(state: PersistedProductListUiState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(PRODUCT_LIST_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / private mode errors.
  }
}
