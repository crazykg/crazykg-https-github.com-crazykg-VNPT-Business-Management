import type { Attachment } from '../../types';
import type { PaginatedQuery, PaginatedResult } from '../../types/common';
import type {
  Contract,
  ContractRevenueAnalytics,
  ContractSignerOption,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
} from '../../types/contract';
import type { PaymentCycle } from '../../types/project';
import {
  apiFetch,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNumber,
  normalizeNullableNumber,
  normalizeNullableText,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

type ApiListResponse<T> = {
  data?: T[];
  generated_data?: T[];
  meta?: {
    generated_count?: number;
    allocation_mode?: ContractPaymentAllocationMode;
  };
};

const normalizePaymentCycle = (value: unknown, fallback: PaymentCycle = 'ONCE'): PaymentCycle => {
  const normalized = String(value || '').trim().toUpperCase();
  if (
    normalized === 'ONCE'
    || normalized === 'MONTHLY'
    || normalized === 'QUARTERLY'
    || normalized === 'HALF_YEARLY'
    || normalized === 'YEARLY'
  ) {
    return normalized;
  }

  return fallback;
};

const normalizeContractItems = (
  items: Partial<Contract>['items']
):
  | Array<{
      product_id: number;
      product_package_id: number | null;
      product_name: string | null;
      unit: string | null;
      quantity: number;
      unit_price: number;
      vat_rate: number | null;
      vat_amount: number | null;
    }>
  | undefined => {
  if (!Array.isArray(items)) {
    return undefined;
  }

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as unknown as Record<string, unknown>;
      const productId = normalizeNullableNumber(source.product_id ?? source.productId);
      if (productId === null || productId <= 0) {
        return null;
      }

      return {
        product_id: productId,
        product_package_id: normalizeNullableNumber(
          source.product_package_id ?? source.productPackageId
        ),
        product_name: normalizeNullableText(source.product_name ?? source.productName),
        unit: normalizeNullableText(source.unit),
        quantity: normalizeNumber(source.quantity, 1),
        unit_price: normalizeNumber(source.unit_price ?? source.unitPrice, 0),
        vat_rate: normalizeNullableNumber(source.vat_rate ?? source.vatRate),
        vat_amount: normalizeNullableNumber(source.vat_amount ?? source.vatAmount),
      };
    })
    .filter(
      (
        item
      ): item is {
        product_id: number;
        product_package_id: number | null;
        product_name: string | null;
        unit: string | null;
        quantity: number;
        unit_price: number;
        vat_rate: number | null;
        vat_amount: number | null;
      } => item !== null
    );
};

const normalizeAttachments = (attachments?: Attachment[]) =>
  Array.isArray(attachments)
    ? attachments.map((attachment) => ({
        id: normalizeNullableText(attachment.id),
        fileName: normalizeNullableText(attachment.fileName),
        mimeType: normalizeNullableText(attachment.mimeType),
        fileSize: normalizeNumber(attachment.fileSize, 0),
        fileUrl: normalizeNullableText(attachment.fileUrl),
        driveFileId: normalizeNullableText(attachment.driveFileId),
        createdAt: normalizeNullableText(attachment.createdAt),
        storageProvider: normalizeNullableText(attachment.storageProvider),
        storagePath: normalizeNullableText(attachment.storagePath),
        storageDisk: normalizeNullableText(attachment.storageDisk),
        storageVisibility: normalizeNullableText(attachment.storageVisibility),
      }))
    : undefined;

export interface RevenueAnalyticsParams {
  period_from: string;
  period_to: string;
  grouping?: 'month' | 'quarter';
  contract_id?: number;
  source_mode?: 'PROJECT' | 'INITIAL';
}

export type ContractPaymentAllocationMode = 'EVEN' | 'MILESTONE';

export interface ContractMilestoneInstallmentInput {
  label?: string;
  percentage: number;
  expected_date?: string | null;
}

export interface ContractCycleDraftInstallmentInput {
  label: string;
  expected_date: string;
  expected_amount: number;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
}

export interface GenerateContractPaymentsPayload {
  allocation_mode?: ContractPaymentAllocationMode;
  advance_percentage?: number;
  retention_percentage?: number;
  installment_count?: number;
  installments?: ContractMilestoneInstallmentInput[];
  draft_installments?: ContractCycleDraftInstallmentInput[];
}

export interface GenerateContractPaymentsResult {
  data: PaymentSchedule[];
  generated_data: PaymentSchedule[];
  meta: {
    generated_count: number;
    allocation_mode: ContractPaymentAllocationMode;
  };
}

export const fetchContracts = async (): Promise<Contract[]> => fetchList<Contract>('/api/v5/contracts');

export const fetchContractsPage = async (
  query: PaginatedQuery
): Promise<PaginatedResult<Contract>> => fetchPaginatedList<Contract>('/api/v5/contracts', query);

export const fetchContractDetail = async (id: string | number): Promise<Contract> => {
  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_DETAIL_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const fetchContractSignerOptions = async (): Promise<ContractSignerOption[]> =>
  fetchList<ContractSignerOption>('/api/v5/contracts/signer-options');

export const fetchContractRevenueAnalytics = async (
  params: RevenueAnalyticsParams
): Promise<ContractRevenueAnalytics> => {
  const query = new URLSearchParams();
  query.set('period_from', params.period_from);
  query.set('period_to', params.period_to);
  if (params.grouping) {
    query.set('grouping', params.grouping);
  }
  if (typeof params.contract_id === 'number' && Number.isFinite(params.contract_id) && params.contract_id > 0) {
    query.set('contract_id', String(params.contract_id));
  }
  if (params.source_mode === 'PROJECT' || params.source_mode === 'INITIAL') {
    query.set('source_mode', params.source_mode);
  }

  const res = await apiFetch(`/api/v5/contracts/revenue-analytics?${query.toString()}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_REVENUE_ANALYTICS_FAILED'));
  }

  return parseItemJson<ContractRevenueAnalytics>(res);
};

export const createContract = async (
  payload: Partial<Contract> & Record<string, unknown>
): Promise<Contract> => {
  const termUnitRaw = String(payload.term_unit || '').trim().toUpperCase();
  const normalizedTermUnit = termUnitRaw === 'MONTH' || termUnitRaw === 'DAY' ? termUnitRaw : null;

  const res = await apiFetch('/api/v5/contracts', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contract_code: payload.contract_code,
      contract_name: payload.contract_name,
      signer_user_id: normalizeNullableNumber(payload.signer_user_id),
      customer_id: normalizeNullableNumber(payload.customer_id),
      project_id: normalizeNullableNumber(payload.project_id),
      value: normalizeNumber(payload.value, 0),
      payment_cycle: normalizePaymentCycle(payload.payment_cycle, 'ONCE'),
      status: payload.status || 'DRAFT',
      sign_date: payload.sign_date,
      effective_date: payload.effective_date,
      expiry_date: payload.expiry_date,
      project_type_code: payload.project_type_code ? String(payload.project_type_code).trim().toUpperCase() : null,
      term_unit: normalizedTermUnit,
      term_value: normalizeNullableNumber(payload.term_value),
      attachments: normalizeAttachments(payload.attachments),
      items: normalizeContractItems(payload.items),
      expiry_date_manual_override:
        payload.expiry_date_manual_override === undefined
          ? undefined
          : Boolean(payload.expiry_date_manual_override),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const updateContract = async (
  id: string | number,
  payload: Partial<Contract> & Record<string, unknown>
): Promise<Contract> => {
  const termUnitRaw = String(payload.term_unit || '').trim().toUpperCase();
  const normalizedTermUnit = termUnitRaw === 'MONTH' || termUnitRaw === 'DAY' ? termUnitRaw : null;
  const body: Record<string, unknown> = {};
  const assignIfPresent = (key: string, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(payload, key) && value !== undefined) {
      body[key] = value;
    }
  };

  assignIfPresent('contract_code', payload.contract_code);
  assignIfPresent('contract_name', payload.contract_name);
  assignIfPresent('signer_user_id', normalizeNullableNumber(payload.signer_user_id));
  assignIfPresent('customer_id', normalizeNullableNumber(payload.customer_id));
  assignIfPresent('project_id', normalizeNullableNumber(payload.project_id));
  assignIfPresent('value', normalizeNumber(payload.value, 0));
  assignIfPresent('payment_cycle', normalizePaymentCycle(payload.payment_cycle, 'ONCE'));
  assignIfPresent('status', payload.status);
  assignIfPresent('sign_date', payload.sign_date);
  assignIfPresent('effective_date', payload.effective_date);
  assignIfPresent('expiry_date', payload.expiry_date);
  assignIfPresent(
    'project_type_code',
    payload.project_type_code ? String(payload.project_type_code).trim().toUpperCase() : null
  );
  assignIfPresent('term_unit', normalizedTermUnit);
  assignIfPresent('term_value', normalizeNullableNumber(payload.term_value));
  assignIfPresent('attachments', normalizeAttachments(payload.attachments));
  assignIfPresent('items', normalizeContractItems(payload.items));
  assignIfPresent(
    'expiry_date_manual_override',
    payload.expiry_date_manual_override === undefined
      ? undefined
      : Boolean(payload.expiry_date_manual_override)
  );

  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_CONTRACT_FAILED'));
  }

  return parseItemJson<Contract>(res);
};

export const deleteContract = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_CONTRACT_FAILED'));
  }
};

export const fetchPaymentSchedules = async (
  contractId?: string | number
): Promise<PaymentSchedule[]> => {
  const query =
    contractId !== undefined && contractId !== null && `${contractId}` !== ''
      ? `?contract_id=${encodeURIComponent(String(contractId))}`
      : '';

  const res = await apiFetch(`/api/v5/payment-schedules${query}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PAYMENT_SCHEDULES_FAILED'));
  }

  const payload = (await res.json()) as ApiListResponse<PaymentSchedule>;
  return payload.data ?? [];
};

export const updatePaymentSchedule = async (
  id: string | number,
  payload: PaymentScheduleConfirmationPayload
): Promise<PaymentSchedule> => {
  const res = await apiFetch(`/api/v5/payment-schedules/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      actual_paid_date: normalizeNullableText(payload.actual_paid_date),
      actual_paid_amount: normalizeNumber(payload.actual_paid_amount, 0),
      status: payload.status,
      notes: normalizeNullableText(payload.notes),
      attachments: normalizeAttachments(payload.attachments),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_PAYMENT_SCHEDULE_FAILED'));
  }

  return parseItemJson<PaymentSchedule>(res);
};

export const deletePaymentSchedule = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/payment-schedules/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_PAYMENT_SCHEDULE_FAILED'));
  }
};

export const generateContractPayments = async (
  contractId: string | number,
  payload?: GenerateContractPaymentsPayload
): Promise<GenerateContractPaymentsResult> => {
  const res = await apiFetch(`/api/v5/contracts/${contractId}/generate-payments`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      allocation_mode: payload?.allocation_mode,
      advance_percentage: normalizeNullableNumber(payload?.advance_percentage),
      retention_percentage: normalizeNullableNumber(payload?.retention_percentage),
      installment_count: normalizeNullableNumber(payload?.installment_count),
      installments: Array.isArray(payload?.installments)
        ? payload.installments.map((installment) => ({
            label: normalizeNullableText(installment.label),
            percentage: normalizeNumber(installment.percentage, 0),
            expected_date: normalizeNullableText(installment.expected_date),
          }))
        : undefined,
      draft_installments: Array.isArray(payload?.draft_installments)
        ? payload.draft_installments.map((installment) => ({
            label: normalizeNullableText(installment.label),
            expected_date: normalizeNullableText(installment.expected_date),
            expected_amount: normalizeNumber(installment.expected_amount, 0),
            expected_start_date: normalizeNullableText(installment.expected_start_date),
            expected_end_date: normalizeNullableText(installment.expected_end_date),
          }))
        : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'GENERATE_CONTRACT_PAYMENTS_FAILED'));
  }

  const rawPayload = (await res.json()) as ApiListResponse<PaymentSchedule>;
  return {
    data: rawPayload.data ?? [],
    generated_data: rawPayload.generated_data ?? rawPayload.data ?? [],
    meta: {
      generated_count: Number(rawPayload.meta?.generated_count ?? (rawPayload.data ?? []).length) || 0,
      allocation_mode: rawPayload.meta?.allocation_mode === 'MILESTONE' ? 'MILESTONE' : 'EVEN',
    },
  };
};
