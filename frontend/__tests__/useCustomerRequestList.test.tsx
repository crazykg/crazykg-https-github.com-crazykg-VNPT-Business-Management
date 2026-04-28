// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCustomerRequestList } from '../components/customer-request/hooks/useCustomerRequestList';

const mockUseCRCList = vi.fn();
const mockIsRequestCanceledError = vi.fn((_error?: unknown) => false);

vi.mock('../shared/hooks/useCustomerRequests', () => ({
  useCRCList: (params: unknown, options?: unknown) => mockUseCRCList(params, options),
}));

vi.mock('../services/v5Api', () => ({
  DEFAULT_PAGINATION_META: {
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 1,
  },
  isRequestCanceledError: (error: unknown) => mockIsRequestCanceledError(error),
}));

describe('useCustomerRequestList', () => {
  it('does not trigger onPageOverflow while waiting for real query meta', () => {
    const onError = vi.fn();
    const onPageOverflow = vi.fn();

    mockUseCRCList.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: true,
      refetch: vi.fn(),
    });

    renderHook(() =>
      useCustomerRequestList({
        canReadRequests: true,
        isCreateMode: false,
        listPage: 2,
        pageSize: 10,
        dataVersion: 0,
        requestKeyword: '',
        filters: {},
        currentUserId: 3,
        onError,
        onPageOverflow,
      }),
    );

    expect(onPageOverflow).not.toHaveBeenCalled();
  });

  it('triggers onPageOverflow when real query meta confirms page overflow', () => {
    const onError = vi.fn();
    const onPageOverflow = vi.fn();

    mockUseCRCList.mockReturnValue({
      data: {
        data: [],
        meta: {
          page: 1,
          per_page: 10,
          total: 10,
          total_pages: 1,
        },
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderHook(() =>
      useCustomerRequestList({
        canReadRequests: true,
        isCreateMode: false,
        listPage: 2,
        pageSize: 10,
        dataVersion: 0,
        requestKeyword: '',
        filters: {},
        currentUserId: 3,
        onError,
        onPageOverflow,
      }),
    );

    expect(onPageOverflow).toHaveBeenCalledWith(1);
  });

  it('refetches only once for the same dataVersion even if the query refetch function changes', () => {
    const onError = vi.fn();
    const onPageOverflow = vi.fn();
    let currentRefetch = vi.fn();

    mockUseCRCList.mockImplementation(() => ({
      data: {
        data: [],
        meta: {
          page: 1,
          per_page: 10,
          total: 0,
          total_pages: 1,
        },
      },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: currentRefetch,
    }));

    const { rerender } = renderHook(
      ({ dataVersion }: { dataVersion: number }) =>
        useCustomerRequestList({
          canReadRequests: true,
          isCreateMode: false,
          listPage: 1,
          pageSize: 10,
          dataVersion,
          requestKeyword: '',
          filters: {},
          currentUserId: 3,
          onError,
          onPageOverflow,
        }),
      {
        initialProps: { dataVersion: 1 },
      },
    );

    expect(currentRefetch).toHaveBeenCalledTimes(1);

    const nextRefetch = vi.fn();
    currentRefetch = nextRefetch;
    rerender({ dataVersion: 1 });

    expect(nextRefetch).not.toHaveBeenCalled();

    rerender({ dataVersion: 2 });

    expect(nextRefetch).toHaveBeenCalledTimes(1);
  });
});
