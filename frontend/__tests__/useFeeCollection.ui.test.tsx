import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useBulkGenerateInvoices,
  useCreateReceipt,
  useCreateInvoice,
  useFeeCollectionDashboard,
  useInvoiceList,
  useReceiptList,
  useUpdateInvoice,
} from '../shared/hooks/useFeeCollection';
import { queryKeys } from '../shared/queryKeys';
import {
  bulkGenerateInvoices,
  createReceipt,
  createInvoice,
  fetchReceipts,
  fetchFeeCollectionDashboard,
  fetchInvoices,
  updateInvoice,
} from '../services/api/feeCollectionApi';

vi.mock('../services/api/feeCollectionApi', () => ({
  bulkGenerateInvoices: vi.fn(),
  createDunningLog: vi.fn(),
  createReceipt: vi.fn(),
  createInvoice: vi.fn(),
  deleteReceipt: vi.fn(),
  deleteInvoice: vi.fn(),
  fetchDunningLogs: vi.fn(),
  fetchFeeCollectionDashboard: vi.fn(),
  fetchInvoiceDetail: vi.fn(),
  fetchInvoices: vi.fn(),
  fetchReceiptDetail: vi.fn(),
  fetchReceipts: vi.fn(),
  reverseReceipt: vi.fn(),
  updateReceipt: vi.fn(),
  updateInvoice: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useFeeCollection', () => {
  it('loads invoice list with stringified params and exposes the payload', async () => {
    vi.mocked(fetchInvoices).mockResolvedValue({
      data: [{
        id: 1,
        invoice_code: 'INV-202603-0001',
        contract_id: 10,
        customer_id: 20,
        invoice_date: '2026-03-01',
        due_date: '2026-03-31',
        subtotal: 1000,
        vat_amount: 100,
        total_amount: 1100,
        paid_amount: 0,
        outstanding: 1100,
        is_overdue: false,
        status: 'ISSUED',
      }],
      meta: {
        page: 1,
        per_page: 10,
        total: 1,
        total_pages: 1,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useInvoiceList({ page: 1, status: 'ISSUED', filter_overdue: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchInvoices).toHaveBeenCalledWith({
      page: '1',
      status: 'ISSUED',
      filter_overdue: 'true',
    });
    expect(result.current.data?.data[0]?.invoice_code).toBe('INV-202603-0001');
  });

  it('loads receipt list with stringified params and exposes the payload', async () => {
    vi.mocked(fetchReceipts).mockResolvedValue({
      data: [{
        id: 2,
        receipt_code: 'PT-202603-0001',
        contract_id: 10,
        customer_id: 20,
        receipt_date: '2026-03-15',
        amount: 1100,
        payment_method: 'BANK_TRANSFER',
        status: 'CONFIRMED',
      }],
      meta: {
        page: 1,
        per_page: 10,
        total: 1,
        total_pages: 1,
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useReceiptList({ page: 1, customer_id: 20, payment_method: 'BANK_TRANSFER' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchReceipts).toHaveBeenCalledWith({
      page: '1',
      customer_id: '20',
      payment_method: 'BANK_TRANSFER',
    });
    expect(result.current.data?.data[0]?.receipt_code).toBe('PT-202603-0001');
  });

  it('invalidates invoice and revenue caches after create mutation succeeds', async () => {
    vi.mocked(createInvoice).mockResolvedValue({
      data: {
        id: 1,
        invoice_code: 'INV-202603-0002',
        contract_id: 10,
        customer_id: 20,
        invoice_date: '2026-03-01',
        due_date: '2026-03-31',
        subtotal: 1000,
        vat_amount: 100,
        total_amount: 1100,
        paid_amount: 0,
        outstanding: 1100,
        is_overdue: false,
        status: 'DRAFT',
      },
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contract_id: 10,
        customer_id: 20,
        invoice_date: '2026-03-01',
        due_date: '2026-03-31',
        items: [{
          description: 'Dich vu FTTH',
          quantity: 1,
          unit_price: 1000,
        }],
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all });
  });

  it('loads fee collection dashboard by period range', async () => {
    vi.mocked(fetchFeeCollectionDashboard).mockResolvedValue({
      data: {
        kpis: {
          expected_revenue: 1000,
          actual_collected: 500,
          collection_rate: 50,
          avg_days_to_collect: 7,
          outstanding: 500,
          overdue_amount: 100,
          overdue_count: 1,
        },
        by_month: [],
        top_debtors: [],
        urgent_overdue: [],
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useFeeCollectionDashboard({ period_from: '2026-03-01', period_to: '2026-03-31' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchFeeCollectionDashboard).toHaveBeenCalledWith({
      period_from: '2026-03-01',
      period_to: '2026-03-31',
    });
    expect(result.current.data?.data.kpis.collection_rate).toBe(50);
  });

  it('invalidates receipt, invoice, and revenue caches after create receipt succeeds', async () => {
    vi.mocked(createReceipt).mockResolvedValue({
      data: {
        id: 2,
        receipt_code: 'PT-202603-0002',
        contract_id: 10,
        customer_id: 20,
        receipt_date: '2026-03-16',
        amount: 1100,
        payment_method: 'BANK_TRANSFER',
        status: 'CONFIRMED',
      },
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateReceipt(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contract_id: 10,
        customer_id: 20,
        receipt_date: '2026-03-16',
        amount: 1100,
        payment_method: 'BANK_TRANSFER',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.receipts.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all });
  });

  it('invalidates invoice and revenue caches after bulk invoice generation succeeds', async () => {
    vi.mocked(bulkGenerateInvoices).mockResolvedValue({
      data: {
        created_count: 2,
        invoices: [],
      },
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useBulkGenerateInvoices(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        period_from: '2026-03-01',
        period_to: '2026-03-31',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.revenue.all });
  });

  it('applies optimistic invoice updates and rolls back when the mutation fails', async () => {
    let rejectMutation: ((reason?: unknown) => void) | undefined;

    vi.mocked(updateInvoice).mockImplementation(() => new Promise((_, reject) => {
      rejectMutation = reject;
    }));

    const { queryClient, wrapper } = createWrapper();
    const listKey = queryKeys.invoices.list({ page: 1, per_page: 25, sort_key: 'invoice_date', sort_dir: 'desc' });
    queryClient.setQueryData(listKey, {
      data: [{
        id: 1,
        invoice_code: 'INV-202603-0001',
        contract_id: 10,
        customer_id: 20,
        invoice_date: '2026-03-01',
        due_date: '2026-03-31',
        subtotal: 1000,
        vat_amount: 100,
        total_amount: 1100,
        paid_amount: 0,
        outstanding: 1100,
        is_overdue: false,
        status: 'DRAFT',
      }],
      meta: {
        page: 1,
        per_page: 25,
        total: 1,
        total_pages: 1,
      },
    });
    queryClient.setQueryData(queryKeys.invoices.detail(1), {
      data: {
        id: 1,
        invoice_code: 'INV-202603-0001',
        contract_id: 10,
        customer_id: 20,
        invoice_date: '2026-03-01',
        due_date: '2026-03-31',
        subtotal: 1000,
        vat_amount: 100,
        total_amount: 1100,
        paid_amount: 0,
        outstanding: 1100,
        is_overdue: false,
        status: 'DRAFT',
      },
    });

    const { result } = renderHook(() => useUpdateInvoice(), { wrapper });

    const mutationPromise = result.current.mutateAsync({
      id: 1,
      data: { status: 'ISSUED' },
    });

    await waitFor(() => {
      expect((queryClient.getQueryData(listKey) as { data: Array<{ status: string }> }).data[0]?.status).toBe('ISSUED');
      expect((queryClient.getQueryData(queryKeys.invoices.detail(1)) as { data: { status: string } }).data.status).toBe('ISSUED');
    });

    rejectMutation?.(new Error('UPDATE_FAILED'));
    await expect(mutationPromise).rejects.toThrow('UPDATE_FAILED');

    await waitFor(() => {
      expect((queryClient.getQueryData(listKey) as { data: Array<{ status: string }> }).data[0]?.status).toBe('DRAFT');
      expect((queryClient.getQueryData(queryKeys.invoices.detail(1)) as { data: { status: string } }).data.status).toBe('DRAFT');
    });
  });
});
