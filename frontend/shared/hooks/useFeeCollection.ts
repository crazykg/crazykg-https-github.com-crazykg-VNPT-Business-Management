import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkGenerateInvoices,
  createDunningLog,
  createInvoice,
  createReceipt,
  deleteReceipt,
  deleteInvoice,
  fetchDunningLogs,
  fetchFeeCollectionDashboard,
  fetchInvoiceDetail,
  fetchInvoices,
  fetchReceiptDetail,
  fetchReceipts,
  reverseReceipt,
  updateReceipt,
  updateInvoice,
} from '../../services/api/feeCollectionApi';
import type {
  DunningLog,
  FeeCollectionDashboard,
  Invoice,
  InvoiceItem,
  Receipt,
} from '../../types/feeCollection';
import type { PaginationMeta } from '../../types/common';
import { queryKeys, type ListQuery, type PeriodRangeQuery } from '../queryKeys';

export interface InvoiceListParams extends ListQuery {
  status?: string;
  customer_id?: number | string;
  contract_id?: number | string;
  filter_overdue?: boolean;
  invoice_date_from?: string;
  invoice_date_to?: string;
  due_date_from?: string;
  due_date_to?: string;
}

export interface InvoiceListResponse {
  data: Invoice[];
  meta: PaginationMeta & { kpis?: Record<string, number> };
}

export interface CreateInvoicePayload extends Partial<Invoice> {
  contract_id: number | string;
  customer_id: number | string;
  invoice_date: string;
  due_date: string;
  items: InvoiceItem[];
}

export interface ReceiptListParams extends ListQuery {
  customer_id?: number | string;
  payment_method?: string;
  receipt_date_from?: string;
  receipt_date_to?: string;
}

export interface ReceiptListResponse {
  data: Receipt[];
  meta: PaginationMeta;
}

export interface ReceiptMutationPayload extends Partial<Receipt> {
  contract_id: number | string;
  customer_id: number | string;
  receipt_date: string;
  amount: number;
  payment_method: Receipt['payment_method'];
}

export interface BulkGenerateInvoicesPayload {
  contract_ids?: number[];
  period_from: string;
  period_to: string;
}

const toStringParams = (params: Record<string, unknown>): Record<string, string> =>
  Object.entries(params).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return accumulator;
    }

    accumulator[key] = typeof value === 'boolean' ? String(value) : String(value);
    return accumulator;
  }, {});

export function useInvoiceList(params: InvoiceListParams): ReturnType<typeof useQuery<InvoiceListResponse>> {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => fetchInvoices(toStringParams(params)),
  });
}

export function useInvoiceDetail(id: number | string | null) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id ?? 'pending'),
    queryFn: () => fetchInvoiceDetail(id as number | string),
    enabled: id !== null && id !== undefined && String(id) !== '',
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => createInvoice(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: Partial<Invoice> & { items?: InvoiceItem[] } }) =>
      updateInvoice(id, data),
    onMutate: async (variables) => {
      const invoiceListsKey = ['invoices', 'list'] as const;

      await queryClient.cancelQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.revenue.all });

      const listSnapshots = queryClient.getQueriesData<InvoiceListResponse>({ queryKey: invoiceListsKey });
      const detailSnapshot = queryClient.getQueryData<{ data: Invoice }>(queryKeys.invoices.detail(variables.id));

      listSnapshots.forEach(([queryKey, snapshot]) => {
        if (!snapshot) {
          return;
        }

        queryClient.setQueryData<InvoiceListResponse>(queryKey, {
          ...snapshot,
          data: snapshot.data.map((invoice) => (
            String(invoice.id) === String(variables.id)
              ? {
                  ...invoice,
                  ...variables.data,
                  items: variables.data.items ?? invoice.items,
                }
              : invoice
          )),
        });
      });

      if (detailSnapshot?.data) {
        queryClient.setQueryData(queryKeys.invoices.detail(variables.id), {
          ...detailSnapshot,
          data: {
            ...detailSnapshot.data,
            ...variables.data,
            items: variables.data.items ?? detailSnapshot.data.items,
          },
        });
      }

      return { listSnapshots, detailSnapshot };
    },
    onError: (_error, variables, context) => {
      context?.listSnapshots.forEach(([queryKey, snapshot]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });

      if (context?.detailSnapshot) {
        queryClient.setQueryData(queryKeys.invoices.detail(variables.id), context.detailSnapshot);
      }
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteInvoice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useReceiptList(params: ReceiptListParams): ReturnType<typeof useQuery<ReceiptListResponse>> {
  return useQuery({
    queryKey: queryKeys.receipts.list(params),
    queryFn: () => fetchReceipts(toStringParams(params)),
  });
}

export function useReceiptDetail(id: number | string | null) {
  return useQuery({
    queryKey: queryKeys.receipts.detail(id ?? 'pending'),
    queryFn: () => fetchReceiptDetail(id as number | string),
    enabled: id !== null && id !== undefined && String(id) !== '',
  });
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReceiptMutationPayload) => createReceipt(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useUpdateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: Partial<ReceiptMutationPayload> }) =>
      updateReceipt(id, data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.detail(variables.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteReceipt(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useReverseReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => reverseReceipt(id),
    onSuccess: async (_result, receiptId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts.detail(receiptId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useBulkGenerateInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkGenerateInvoicesPayload) => bulkGenerateInvoices(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.revenue.all });
    },
  });
}

export function useDunningLogs(invoiceId: number | string | null) {
  return useQuery({
    queryKey: queryKeys.invoices.dunningLogs(invoiceId ?? 'pending'),
    queryFn: () => fetchDunningLogs(invoiceId as number | string),
    enabled: invoiceId !== null && invoiceId !== undefined && String(invoiceId) !== '',
  });
}

export function useCreateDunningLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number | string; data: Partial<DunningLog> }) =>
      createDunningLog(invoiceId, data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.dunningLogs(variables.invoiceId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useFeeCollectionDashboard(params: PeriodRangeQuery) {
  return useQuery<{ data: FeeCollectionDashboard }>({
    queryKey: queryKeys.invoices.dashboard(params),
    queryFn: () => fetchFeeCollectionDashboard({
      period_from: params.period_from,
      period_to: params.period_to,
    }),
    enabled: Boolean(params.period_from) && Boolean(params.period_to),
  });
}
