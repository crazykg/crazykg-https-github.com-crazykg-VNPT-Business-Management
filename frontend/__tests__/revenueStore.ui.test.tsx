import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRevenueStore } from '../shared/stores/revenueStore';

const currentYear = new Date().getFullYear();
const REVENUE_UI_STATE_STORAGE_KEY = 'revenue_mgmt_state';

const resetRevenueStore = () => {
  useRevenueStore.setState({
    activeView: 'OVERVIEW',
    reportTab: 'department',
    forecastHorizon: 6,
    periodFrom: `${currentYear}-01-01`,
    periodTo: `${currentYear}-12-31`,
    periodType: 'MONTHLY',
    grouping: 'month',
    selectedDeptId: null,
    year: currentYear,
    feeCollectionAvailable: false,
  });
};

describe('revenueStore state persistence', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?tab=revenue_mgmt');
    window.sessionStorage.clear();
    resetRevenueStore();
  });

  it('restores legacy URL state and cleans revenue params from the address bar', () => {
    window.history.replaceState(
      {},
      '',
      '/?tab=revenue_mgmt&rev_view=REPORT&rev_report_tab=time&rev_horizon=12'
    );

    act(() => {
      useRevenueStore.getState().syncFromUrl();
    });

    const state = useRevenueStore.getState();
    expect(state.activeView).toBe('REPORT');
    expect(state.reportTab).toBe('time');
    expect(state.forecastHorizon).toBe(12);
    expect(window.location.search).toBe('?tab=revenue_mgmt');
  });

  it('ignores invalid reportTab and horizon values from legacy URL state', () => {
    window.history.replaceState(
      {},
      '',
      '/?tab=revenue_mgmt&rev_report_tab=invalid&rev_horizon=5'
    );

    act(() => {
      useRevenueStore.getState().syncFromUrl();
    });

    const state = useRevenueStore.getState();
    expect(state.reportTab).toBe('department');
    expect(state.forecastHorizon).toBe(6);
    expect(window.location.search).toBe('?tab=revenue_mgmt');
  });

  it('persists report state in session storage without extending the URL', () => {
    act(() => {
      useRevenueStore.getState().setReportTab('customer');
    });

    act(() => {
      useRevenueStore.getState().setForecastHorizon(3);
    });

    expect(window.location.search).toBe('?tab=revenue_mgmt');
    expect(JSON.parse(window.sessionStorage.getItem(REVENUE_UI_STATE_STORAGE_KEY) ?? '{}')).toMatchObject({
      reportTab: 'customer',
      forecastHorizon: 3,
    });
  });

  it('restores persisted session state when the URL is clean', () => {
    window.sessionStorage.setItem(REVENUE_UI_STATE_STORAGE_KEY, JSON.stringify({
      activeView: 'REPORT',
      reportTab: 'time',
      forecastHorizon: 12,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      periodType: 'YEARLY',
      grouping: 'quarter',
      selectedDeptId: 7,
      year: 2026,
    }));

    act(() => {
      useRevenueStore.getState().syncFromUrl();
    });

    const state = useRevenueStore.getState();
    expect(state.activeView).toBe('REPORT');
    expect(state.reportTab).toBe('time');
    expect(state.forecastHorizon).toBe(12);
    expect(state.periodType).toBe('YEARLY');
    expect(state.grouping).toBe('quarter');
    expect(state.selectedDeptId).toBe(7);
    expect(state.year).toBe(2026);
  });
});
