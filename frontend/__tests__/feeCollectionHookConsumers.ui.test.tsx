import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeeCollectionDashboard } from '../components/fee-collection/FeeCollectionDashboard';
import { InvoiceList } from '../components/fee-collection/InvoiceList';
import { ReceiptList } from '../components/fee-collection/ReceiptList';
import {
  useDeleteReceipt,
  useDeleteInvoice,
  useFeeCollectionDashboard,
  useInvoiceList,
  useReceiptList,
  useUpdateInvoice,
} from '../shared/hooks/useFeeCollection';

vi.mock('../shared/hooks/useFeeCollection', () => ({
  useDeleteReceipt: vi.fn(),
  useDeleteInvoice: vi.fn(),
  useFeeCollectionDashboard: vi.fn(),
  useInvoiceList: vi.fn(),
  useReceiptList: vi.fn(),
  useUpdateInvoice: vi.fn(),
}));

vi.mock('../shared/hooks/useDashboardRealtime', () => ({
  useDashboardRealtime: vi.fn(() => ({ pollingEnabled: false })),
}));

vi.mock('../components/fee-collection/InvoiceModal', () => ({
  InvoiceModal: () => null,
}));

vi.mock('../components/fee-collection/InvoiceBulkGenerateModal', () => ({
  InvoiceBulkGenerateModal: () => null,
}));

vi.mock('../components/fee-collection/ReceiptModal', () => ({
  ReceiptModal: () => null,
}));

describe('Fee-collection hook consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('InvoiceList uses TanStack hooks for list loading and issue mutation', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const mutateUpdate = vi.fn().mockResolvedValue(undefined);
    const mutateDelete = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useInvoiceList).mockReturnValue({
      data: {
        data: [{
          id: 1,
          invoice_code: 'INV-202603-0001',
          contract_id: 10,
          customer_id: 20,
          customer_name: 'Công ty A',
          contract_code: 'HD-01',
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
          kpis: {
            total_invoices: 1,
            total_amount: 1100,
            total_paid: 0,
            total_outstanding: 1100,
          },
        },
      },
      isLoading: false,
      error: null,
      refetch,
    } as never);
    vi.mocked(useUpdateInvoice).mockReturnValue({
      mutateAsync: mutateUpdate,
    } as never);
    vi.mocked(useDeleteInvoice).mockReturnValue({
      mutateAsync: mutateDelete,
    } as never);

    const onNotify = vi.fn();

    render(
      <InvoiceList
        contracts={[{ id: 10, contract_code: 'HD-01', contract_name: 'Hợp đồng A', customer_id: 20 } as never]}
        customers={[{ id: 20, customer_name: 'Công ty A' } as never]}
        canAdd
        canEdit
        canDelete
        onNotify={onNotify}
      />,
    );

    expect(useInvoiceList).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      per_page: 25,
      sort_key: 'invoice_date',
      sort_dir: 'desc',
    }));

    fireEvent.click(screen.getByTitle('Phát hành'));

    await waitFor(() => {
      expect(mutateUpdate).toHaveBeenCalledWith({
        id: 1,
        data: { status: 'ISSUED' },
      });
    });

    expect(refetch).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith('success', 'Thành công', 'Đã phát hành hóa đơn INV-202603-0001');
  });

  it('FeeCollectionDashboard renders KPI data from useFeeCollectionDashboard', () => {
    vi.mocked(useFeeCollectionDashboard).mockReturnValue({
      data: {
        data: {
          kpis: {
            expected_revenue: 1_000_000,
            actual_collected: 500_000,
            outstanding: 500_000,
            overdue_amount: 100_000,
            overdue_count: 2,
            collection_rate: 50,
            avg_days_to_collect: 7,
          },
          by_month: [],
          top_debtors: [{
            customer_id: 20,
            customer_name: 'Công ty A',
            total_outstanding: 500_000,
            overdue_amount: 100_000,
            invoice_count: 2,
          }],
          urgent_overdue: [],
        },
      },
      isLoading: false,
      error: null,
    } as never);

    const onNavigateToInvoices = vi.fn();

    render(
      <FeeCollectionDashboard
        periodFrom="2026-03-01"
        periodTo="2026-03-31"
        onNotify={vi.fn()}
        onNavigateToInvoices={onNavigateToInvoices}
      />,
    );

    expect(screen.getByText('Doanh thu kỳ')).toBeInTheDocument();
    expect(screen.getByText('1.0 tr đ')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Công ty A'));
    expect(onNavigateToInvoices).toHaveBeenCalledWith({ customer_id: 20 });
  });

  it('ReceiptList uses TanStack hooks for list loading and delete mutation', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const mutateDelete = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useReceiptList).mockReturnValue({
      data: {
        data: [{
          id: 2,
          receipt_code: 'PT-202603-0001',
          contract_id: 10,
          customer_id: 20,
          customer_name: 'Công ty A',
          invoice_code: 'INV-202603-0001',
          receipt_date: '2026-03-15',
          amount: 1100,
          payment_method: 'BANK_TRANSFER',
          status: 'PENDING_CONFIRM',
        }],
        meta: {
          page: 1,
          per_page: 25,
          total: 1,
          total_pages: 1,
        },
      },
      isLoading: false,
      error: null,
      refetch,
    } as never);
    vi.mocked(useDeleteReceipt).mockReturnValue({
      mutateAsync: mutateDelete,
    } as never);

    const onNotify = vi.fn();

    render(
      <ReceiptList
        contracts={[{ id: 10, contract_code: 'HD-01', contract_name: 'Hợp đồng A', customer_id: 20 } as never]}
        customers={[{ id: 20, customer_name: 'Công ty A' } as never]}
        canAdd
        canEdit
        canDelete
        onNotify={onNotify}
      />,
    );

    expect(useReceiptList).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      per_page: 25,
      sort_key: 'receipt_date',
      sort_dir: 'desc',
    }));

    fireEvent.click(screen.getByTitle('Xóa'));

    await waitFor(() => {
      expect(mutateDelete).toHaveBeenCalledWith(2);
    });

    expect(refetch).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith('success', 'Thành công', 'Đã xóa phiếu thu PT-202603-0001');
  });
});
