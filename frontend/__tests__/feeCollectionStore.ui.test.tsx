import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFeeCollectionStore } from '../shared/stores/feeCollectionStore';

const FEE_COLLECTION_UI_STATE_STORAGE_KEY = 'fee_collection_state';

const resetFeeCollectionStore = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  useFeeCollectionStore.setState({
    activeView: 'DASHBOARD',
    periodFrom: from,
    periodTo: to,
  });
};

describe('feeCollectionStore state persistence', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/fee-collection');
    window.sessionStorage.clear();
    resetFeeCollectionStore();
  });

  it('restores legacy URL state and cleans fee-collection params from the address bar', () => {
    window.history.replaceState(
      {},
      '',
      '/fee-collection?fc_view=INVOICES&fc_period_from=2026-01-01&fc_period_to=2026-12-31'
    );

    act(() => {
      useFeeCollectionStore.getState().syncFromUrl();
    });

    const state = useFeeCollectionStore.getState();
    expect(state.activeView).toBe('INVOICES');
    expect(state.periodFrom).toBe('2026-01-01');
    expect(state.periodTo).toBe('2026-12-31');
    expect(window.location.search).toBe('');
  });

  it('persists fee-collection state in session storage without extending the URL', () => {
    act(() => {
      useFeeCollectionStore.getState().setActiveView('RECEIPTS');
    });

    act(() => {
      useFeeCollectionStore.getState().setPeriod('2026-01-01', '2026-12-31');
    });

    expect(window.location.search).toBe('');
    expect(JSON.parse(window.sessionStorage.getItem(FEE_COLLECTION_UI_STATE_STORAGE_KEY) ?? '{}')).toMatchObject({
      activeView: 'RECEIPTS',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
    });
  });

  it('restores persisted session state when the URL is clean', () => {
    window.sessionStorage.setItem(FEE_COLLECTION_UI_STATE_STORAGE_KEY, JSON.stringify({
      activeView: 'DEBT_REPORT',
      periodFrom: '2026-02-01',
      periodTo: '2026-02-28',
    }));

    act(() => {
      useFeeCollectionStore.getState().syncFromUrl();
    });

    const state = useFeeCollectionStore.getState();
    expect(state.activeView).toBe('DEBT_REPORT');
    expect(state.periodFrom).toBe('2026-02-01');
    expect(state.periodTo).toBe('2026-02-28');
    expect(window.location.search).toBe('');
  });
});
