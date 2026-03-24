import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRevenueStore } from '../shared/stores/revenueStore';

const currentYear = new Date().getFullYear();

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

describe('revenueStore URL sync', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?tab=revenue_mgmt');
    resetRevenueStore();
  });

  it('restores reportTab and forecastHorizon from URL when valid', () => {
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
  });

  it('ignores invalid reportTab and horizon values', () => {
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
  });

  it('writes reportTab and horizon changes back to URL', () => {
    act(() => {
      useRevenueStore.getState().setReportTab('customer');
    });
    expect(window.location.search).toContain('rev_report_tab=customer');

    act(() => {
      useRevenueStore.getState().setForecastHorizon(3);
    });
    expect(window.location.search).toContain('rev_horizon=3');
  });
});
