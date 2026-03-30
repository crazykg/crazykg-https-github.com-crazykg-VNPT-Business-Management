import type {
  DebtAgingReport,
  DebtAgingRow,
  DebtTrendPoint,
  DunningLog,
  FeeCollectionDashboard,
  Invoice,
  InvoiceItem,
  Receipt,
} from '../../types/feeCollection';
import type { PaginationMeta } from '../../types/common';
import {
  apiFetch,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  parseErrorMessage,
} from './_infra';

export const fetchInvoices = async (params: Record<string, string>): Promise<{
  data: Invoice[];
  meta: PaginationMeta & { kpis?: Record<string, number> };
}> => {
  const qs = new URLSearchParams(params).toString();
  const res = await apiFetch(`/api/v5/invoices?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_INVOICES_FAILED'));
  }

  return res.json();
};

export const fetchInvoiceDetail = async (id: number | string): Promise<{ data: Invoice }> => {
  const res = await apiFetch(`/api/v5/invoices/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_INVOICE_FAILED'));
  }

  return res.json();
};

export const createInvoice = async (
  data: Partial<Invoice> & { items: InvoiceItem[] }
): Promise<{ data: Invoice }> => {
  const res = await apiFetch('/api/v5/invoices', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_INVOICE_FAILED'));
  }

  return res.json();
};

export const updateInvoice = async (
  id: number | string,
  data: Partial<Invoice> & { items?: InvoiceItem[] }
): Promise<{ data: Invoice }> => {
  const res = await apiFetch(`/api/v5/invoices/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_INVOICE_FAILED'));
  }

  return res.json();
};

export const deleteInvoice = async (id: number | string): Promise<void> => {
  const res = await apiFetch(`/api/v5/invoices/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_INVOICE_FAILED'));
  }
};

export const bulkGenerateInvoices = async (data: {
  contract_ids?: number[];
  period_from: string;
  period_to: string;
}): Promise<{ data: { created_count: number; invoices: Invoice[] } }> => {
  const res = await apiFetch('/api/v5/invoices/bulk-generate', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'BULK_GENERATE_INVOICES_FAILED'));
  }

  return res.json();
};

export const fetchDunningLogs = async (
  invoiceId: number | string
): Promise<{ data: DunningLog[] }> => {
  const res = await apiFetch(`/api/v5/invoices/${invoiceId}/dunning-logs`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DUNNING_LOGS_FAILED'));
  }

  return res.json();
};

export const createDunningLog = async (
  invoiceId: number | string,
  data: Partial<DunningLog>
): Promise<{ data: DunningLog }> => {
  const res = await apiFetch(`/api/v5/invoices/${invoiceId}/dunning-logs`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DUNNING_LOG_FAILED'));
  }

  return res.json();
};

export const fetchReceipts = async (params: Record<string, string>): Promise<{
  data: Receipt[];
  meta: PaginationMeta;
}> => {
  const qs = new URLSearchParams(params).toString();
  const res = await apiFetch(`/api/v5/receipts?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_RECEIPTS_FAILED'));
  }

  return res.json();
};

export const fetchReceiptDetail = async (
  id: number | string
): Promise<{ data: Receipt }> => {
  const res = await apiFetch(`/api/v5/receipts/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_RECEIPT_FAILED'));
  }

  return res.json();
};

export const createReceipt = async (
  data: Partial<Receipt>
): Promise<{ data: Receipt }> => {
  const res = await apiFetch('/api/v5/receipts', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_RECEIPT_FAILED'));
  }

  return res.json();
};

export const updateReceipt = async (
  id: number | string,
  data: Partial<Receipt>
): Promise<{ data: Receipt }> => {
  const res = await apiFetch(`/api/v5/receipts/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_RECEIPT_FAILED'));
  }

  return res.json();
};

export const deleteReceipt = async (id: number | string): Promise<void> => {
  const res = await apiFetch(`/api/v5/receipts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_RECEIPT_FAILED'));
  }
};

export const reverseReceipt = async (
  id: number | string
): Promise<{ data: Receipt }> => {
  const res = await apiFetch(`/api/v5/receipts/${id}/reverse`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'REVERSE_RECEIPT_FAILED'));
  }

  return res.json();
};

export const fetchFeeCollectionDashboard = async (params: {
  period_from: string;
  period_to: string;
}): Promise<{ data: FeeCollectionDashboard }> => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const res = await apiFetch(`/api/v5/fee-collection/dashboard?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_FEE_COLLECTION_DASHBOARD_FAILED'));
  }

  return res.json();
};

export const fetchDebtAgingReport = async (
  params?: { customer_id?: number }
): Promise<{ data: DebtAgingReport }> => {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await apiFetch(`/api/v5/fee-collection/debt-aging${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEBT_AGING_FAILED'));
  }

  return res.json();
};

export const fetchDebtByCustomer = async (params: {
  page?: number;
  per_page?: number;
  q?: string;
}): Promise<{ data: DebtAgingRow[]; meta: PaginationMeta }> => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    )
  ).toString();

  const res = await apiFetch(`/api/v5/fee-collection/debt-by-customer?${qs}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEBT_BY_CUSTOMER_FAILED'));
  }

  return res.json();
};

export const fetchDebtTrend = async (
  params?: { months?: number }
): Promise<{ data: DebtTrendPoint[] }> => {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await apiFetch(`/api/v5/fee-collection/debt-trend${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_DEBT_TREND_FAILED'));
  }

  return res.json();
};
