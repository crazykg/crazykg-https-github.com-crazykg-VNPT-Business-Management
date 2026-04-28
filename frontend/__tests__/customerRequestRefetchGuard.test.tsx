// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCustomerRequestDashboard } from '../components/customer-request/hooks/useCustomerRequestDashboard';
import { useCustomerRequestCreatorWorkspace } from '../components/customer-request/hooks/useCustomerRequestCreatorWorkspace';
import { useCustomerRequestDispatcherWorkspace } from '../components/customer-request/hooks/useCustomerRequestDispatcherWorkspace';
import { useCustomerRequestPerformerWorkspace } from '../components/customer-request/hooks/useCustomerRequestPerformerWorkspace';

const mockUseCRCDashboard = vi.fn();
const mockUseCRCList = vi.fn();
const mockUseCRCPerformerWeeklyTimesheet = vi.fn();
const mockIsRequestCanceledError = vi.fn((_error?: unknown) => false);

vi.mock('../shared/hooks/useCustomerRequests', () => ({
  useCRCDashboard: (role: unknown, params?: unknown, options?: unknown) =>
    mockUseCRCDashboard(role, params, options),
  useCRCList: (params: unknown, options?: unknown) => mockUseCRCList(params, options),
  useCRCPerformerWeeklyTimesheet: (params?: unknown, options?: unknown) =>
    mockUseCRCPerformerWeeklyTimesheet(params, options),
}));

vi.mock('../services/api/customerRequestApi', () => ({
  isRequestCanceledError: (error: unknown) => mockIsRequestCanceledError(error),
}));

describe('customer request refetch guards', () => {
  it('dashboard hook refetches only once per dataVersion even when refetch callbacks change', () => {
    let currentRefetchers = {
      overview: vi.fn(),
      creator: vi.fn(),
      dispatcher: vi.fn(),
      performer: vi.fn(),
    };

    mockUseCRCDashboard.mockImplementation((role: 'overview' | 'creator' | 'dispatcher' | 'performer') => ({
      data: null,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentRefetchers[role],
    }));

    const { rerender } = renderHook(
      ({ dataVersion }: { dataVersion: number }) =>
        useCustomerRequestDashboard({
          canReadRequests: true,
          dataVersion,
          params: { filters: {} },
          onError: vi.fn(),
        }),
      {
        initialProps: { dataVersion: 1 },
      },
    );

    expect(currentRefetchers.overview).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.creator).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.dispatcher).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.performer).toHaveBeenCalledTimes(1);

    currentRefetchers = {
      overview: vi.fn(),
      creator: vi.fn(),
      dispatcher: vi.fn(),
      performer: vi.fn(),
    };

    rerender({ dataVersion: 1 });

    expect(currentRefetchers.overview).not.toHaveBeenCalled();
    expect(currentRefetchers.creator).not.toHaveBeenCalled();
    expect(currentRefetchers.dispatcher).not.toHaveBeenCalled();
    expect(currentRefetchers.performer).not.toHaveBeenCalled();

    rerender({ dataVersion: 2 });

    expect(currentRefetchers.overview).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.creator).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.dispatcher).toHaveBeenCalledTimes(1);
    expect(currentRefetchers.performer).toHaveBeenCalledTimes(1);
  });

  it('creator workspace refetches only once per dataVersion', () => {
    let currentRefetch = vi.fn();

    mockUseCRCList.mockImplementation(() => ({
      data: { data: [] },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentRefetch,
    }));

    const { rerender } = renderHook(
      ({ dataVersion }: { dataVersion: number }) =>
        useCustomerRequestCreatorWorkspace({
          active: true,
          canReadRequests: true,
          dataVersion,
          onError: vi.fn(),
        }),
      {
        initialProps: { dataVersion: 1 },
      },
    );

    expect(currentRefetch).toHaveBeenCalledTimes(1);

    currentRefetch = vi.fn();
    rerender({ dataVersion: 1 });
    expect(currentRefetch).not.toHaveBeenCalled();

    rerender({ dataVersion: 2 });
    expect(currentRefetch).toHaveBeenCalledTimes(1);
  });

  it('dispatcher workspace refetches only once per dataVersion', () => {
    let currentRefetch = vi.fn();

    mockUseCRCList.mockImplementation(() => ({
      data: { data: [] },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentRefetch,
    }));

    const { rerender } = renderHook(
      ({ dataVersion }: { dataVersion: number }) =>
        useCustomerRequestDispatcherWorkspace({
          active: true,
          canReadRequests: true,
          dataVersion,
          onError: vi.fn(),
        }),
      {
        initialProps: { dataVersion: 1 },
      },
    );

    expect(currentRefetch).toHaveBeenCalledTimes(1);

    currentRefetch = vi.fn();
    rerender({ dataVersion: 1 });
    expect(currentRefetch).not.toHaveBeenCalled();

    rerender({ dataVersion: 2 });
    expect(currentRefetch).toHaveBeenCalledTimes(1);
  });

  it('performer workspace refetches list and timesheet only once per dataVersion', () => {
    let currentPerformerRefetch = vi.fn();
    let currentTimesheetRefetch = vi.fn();

    mockUseCRCList.mockImplementation(() => ({
      data: { data: [] },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentPerformerRefetch,
    }));

    mockUseCRCPerformerWeeklyTimesheet.mockImplementation(() => ({
      data: null,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentTimesheetRefetch,
    }));

    const { rerender } = renderHook(
      ({ dataVersion }: { dataVersion: number }) =>
        useCustomerRequestPerformerWorkspace({
          active: true,
          canReadRequests: true,
          dataVersion,
          onError: vi.fn(),
        }),
      {
        initialProps: { dataVersion: 1 },
      },
    );

    expect(currentPerformerRefetch).toHaveBeenCalledTimes(1);
    expect(currentTimesheetRefetch).toHaveBeenCalledTimes(1);

    currentPerformerRefetch = vi.fn();
    currentTimesheetRefetch = vi.fn();
    rerender({ dataVersion: 1 });
    expect(currentPerformerRefetch).not.toHaveBeenCalled();
    expect(currentTimesheetRefetch).not.toHaveBeenCalled();

    rerender({ dataVersion: 2 });
    expect(currentPerformerRefetch).toHaveBeenCalledTimes(1);
    expect(currentTimesheetRefetch).toHaveBeenCalledTimes(1);
  });
});
