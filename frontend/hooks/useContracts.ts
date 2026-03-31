import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchContracts,
  fetchContractsPage,
  fetchContractDetail,
  fetchPaymentSchedules,
  createContract,
  updateContract,
  deleteContract,
  generateContractPayments,
  updatePaymentSchedule,
  type GenerateContractPaymentsPayload,
} from '../services/api/contractApi';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { queryKeys } from '../shared/queryKeys';
import type {
  Contract,
  PaymentSchedule,
  PaginatedQuery,
  PaginationMeta,
  PaymentScheduleConfirmationPayload,
} from '../types';

interface UseContractsReturn {
  contracts: Contract[];
  contractsPageRows: Contract[];
  contractsPageMeta: PaginationMeta;
  paymentSchedules: PaymentSchedule[];
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  isPaymentScheduleLoading: boolean;
  isContractDetailLoading: boolean;
  error: string | null;
  loadContracts: () => Promise<void>;
  loadContractsPage: (query?: PaginatedQuery) => Promise<void>;
  loadContractDetail: (contractId: string | number) => Promise<Contract | null>;
  loadPaymentSchedules: (contractId?: string | number) => Promise<void>;
  setContracts: Dispatch<SetStateAction<Contract[]>>;
  handleSaveContract: (
    data: Partial<Contract>,
    modalType: 'ADD_CONTRACT' | 'EDIT_CONTRACT',
    selectedContract: Contract | null
  ) => Promise<boolean>;
  handleDeleteContract: (selectedContract: Contract) => Promise<boolean>;
  handleGenerateSchedules: (
    contractId: string | number,
    options?: { silent?: boolean; generateOptions?: GenerateContractPaymentsPayload }
  ) => Promise<void>;
  handleConfirmPaymentSchedule: (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => Promise<void>;
  setContractsPageRows: (rows: Contract[]) => void;
  setContractsPageMeta: (meta: PaginationMeta) => void;
  setPaymentSchedules: Dispatch<SetStateAction<PaymentSchedule[]>>;
}

interface UseContractsOptions {
  enabled?: boolean;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

const filterSchedulesByOtherContracts = (
  rows: PaymentSchedule[],
  contractId: string | number,
): PaymentSchedule[] =>
  (rows || []).filter((item) => String(item.contract_id) !== String(contractId));

export function useContracts(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseContractsOptions = {},
): UseContractsReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [isContractDetailLoading, setIsContractDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractsQuery = useQuery({
    queryKey: queryKeys.contracts.all,
    queryFn: fetchContracts,
    enabled,
  });
  const { refetch: refetchContracts } = contractsQuery;

  const paymentSchedulesQuery = useQuery({
    queryKey: queryKeys.contracts.paymentSchedules('all'),
    queryFn: () => fetchPaymentSchedules(),
    enabled,
  });
  const { refetch: refetchAllPaymentSchedules } = paymentSchedulesQuery;

  const createContractMutation = useMutation({
    mutationFn: createContract,
  });

  const updateContractMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Contract> & Record<string, unknown> }) =>
      updateContract(id, payload),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: string | number) => deleteContract(id),
  });

  const generateSchedulesMutation = useMutation({
    mutationFn: ({ contractId, payload }: { contractId: string | number; payload?: GenerateContractPaymentsPayload }) =>
      generateContractPayments(contractId, payload),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: PaymentScheduleConfirmationPayload }) =>
      updatePaymentSchedule(id, payload),
  });

  const setContracts: Dispatch<SetStateAction<Contract[]>> = useCallback((value) => {
    queryClient.setQueryData<Contract[]>(queryKeys.contracts.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const setPaymentSchedules: Dispatch<SetStateAction<PaymentSchedule[]>> = useCallback((value) => {
    queryClient.setQueryData<PaymentSchedule[]>(queryKeys.contracts.paymentSchedules('all'), (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const replaceSchedulesByContract = useCallback((contractId: string | number, schedules: PaymentSchedule[]) => {
    const nextSchedules = [
      ...filterSchedulesByOtherContracts(
        queryClient.getQueryData<PaymentSchedule[]>(queryKeys.contracts.paymentSchedules('all')) || [],
        contractId,
      ),
      ...(schedules || []),
    ];

    queryClient.setQueryData<PaymentSchedule[]>(queryKeys.contracts.paymentSchedules('all'), nextSchedules);
    queryClient.setQueryData<PaymentSchedule[]>(queryKeys.contracts.paymentSchedules(contractId), schedules || []);
  }, [queryClient]);

  const loadContracts = useCallback(async () => {
    setError(null);
    try {
      await refetchContracts();
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách hợp đồng.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, refetchContracts]);

  const loadContractsPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchContractsPage(query ?? {});
      setContractsPageRows(result.data || []);
      setContractsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách hợp đồng.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const loadContractDetail = useCallback(async (contractId: string | number): Promise<Contract | null> => {
    setIsContractDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchContractDetail(contractId);
      return detail;
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải chi tiết hợp đồng.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
      return null;
    } finally {
      setIsContractDetailLoading(false);
    }
  }, [addToast]);

  const loadPaymentSchedules = useCallback(async (contractId?: string | number) => {
    setIsPaymentScheduleLoading(true);
    setError(null);
    try {
      if (contractId === undefined || contractId === null || String(contractId) === '') {
        await refetchAllPaymentSchedules();
      } else {
        const rows = await fetchPaymentSchedules(contractId);
        replaceSchedulesByContract(contractId, rows);
      }
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải kế hoạch thanh toán.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  }, [addToast, refetchAllPaymentSchedules, replaceSchedulesByContract]);

  const handleGenerateSchedules = useCallback(async (
    contractId: string | number,
    options?: { silent?: boolean; generateOptions?: GenerateContractPaymentsPayload }
  ): Promise<void> => {
    setError(null);
    setIsPaymentScheduleLoading(true);
    try {
      const generatedResult = await generateSchedulesMutation.mutateAsync({
        contractId,
        payload: options?.generateOptions,
      });
      const generatedData = generatedResult.data || [];

      replaceSchedulesByContract(contractId, generatedData);

      if (!options?.silent) {
        const metadata = generatedResult.meta;
        const generatedCount = metadata?.generated_count ?? generatedData.length;
        const allocationModeLabel = metadata?.allocation_mode === 'MILESTONE'
          ? 'Mốc nghiệm thu'
          : 'Chia đều';
        addToast?.('success', 'Thành công', `Đã đồng bộ ${generatedCount} kỳ thanh toán (${allocationModeLabel}).`);
      }
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      if (!options?.silent) {
        addToast?.('error', 'Sinh dòng tiền thất bại', `Không thể sinh kỳ thanh toán tự động. ${message}`);
      }
      throw err;
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  }, [addToast, generateSchedulesMutation, replaceSchedulesByContract]);

  const handleSaveContract = useCallback(async (
    data: Partial<Contract>,
    modalType: 'ADD_CONTRACT' | 'EDIT_CONTRACT',
    selectedContractItem: Contract | null
  ): Promise<boolean> => {
    setError(null);
    try {
      const payload = data as Partial<Contract> & Record<string, unknown>;

      if (modalType === 'ADD_CONTRACT') {
        const created = await createContractMutation.mutateAsync(payload);
        setContracts((previous) => [
          created,
          ...previous.filter((item) => String(item.id) !== String(created.id)),
        ]);

        if (created.status === 'SIGNED') {
          try {
            await handleGenerateSchedules(created.id, { silent: true });
            addToast?.('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (genError) {
            const message = extractErrorMessage(genError, 'Lỗi không xác định');
            addToast?.('error', 'Dòng tiền', `Hợp đồng đã lưu nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }

        addToast?.('success', 'Thành công', 'Thêm mới hợp đồng thành công!');
      } else if (modalType === 'EDIT_CONTRACT' && selectedContractItem) {
        const previousStatus = selectedContractItem.status;
        const updated = await updateContractMutation.mutateAsync({
          id: selectedContractItem.id,
          payload,
        });
        setContracts((previous) =>
          previous.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );

        if (updated.status === 'SIGNED' && previousStatus !== 'SIGNED') {
          try {
            await handleGenerateSchedules(updated.id, { silent: true });
            addToast?.('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (genError) {
            const message = extractErrorMessage(genError, 'Lỗi không xác định');
            addToast?.('error', 'Dòng tiền', `Hợp đồng đã cập nhật nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }

        addToast?.('success', 'Thành công', 'Cập nhật hợp đồng thành công!');
      }

      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu hợp đồng vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createContractMutation, handleGenerateSchedules, setContracts, updateContractMutation]);

  const handleDeleteContract = useCallback(async (selectedContractItem: Contract): Promise<boolean> => {
    setError(null);
    try {
      await deleteContractMutation.mutateAsync(selectedContractItem.id);
      setContracts((previous) =>
        previous.filter((item) => String(item.id) !== String(selectedContractItem.id))
      );
      setPaymentSchedules((previous) =>
        filterSchedulesByOtherContracts(previous, selectedContractItem.id)
      );
      addToast?.('success', 'Thành công', 'Đã xóa hợp đồng.');
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa hợp đồng trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteContractMutation, setContracts, setPaymentSchedules]);

  const handleConfirmPaymentSchedule = useCallback(async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ): Promise<void> => {
    try {
      const updated = await confirmPaymentMutation.mutateAsync({ id: scheduleId, payload });
      setPaymentSchedules((previous) =>
        previous.map((item) => (String(item.id) === String(updated.id) ? updated : item))
      );
      addToast?.('success', 'Thành công', 'Đã xác nhận thu tiền cho kỳ thanh toán.');
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      addToast?.('error', 'Cập nhật thất bại', `Không thể xác nhận thu tiền. ${message}`);
      throw err;
    }
  }, [addToast, confirmPaymentMutation, setPaymentSchedules]);

  return {
    contracts: contractsQuery.data ?? [],
    contractsPageRows,
    contractsPageMeta,
    paymentSchedules: paymentSchedulesQuery.data ?? [],
    isSaving:
      createContractMutation.isPending
      || updateContractMutation.isPending
      || deleteContractMutation.isPending,
    isLoading: contractsQuery.isLoading || contractsQuery.isFetching,
    isPageLoading,
    isPaymentScheduleLoading:
      isPaymentScheduleLoading
      || paymentSchedulesQuery.isLoading
      || paymentSchedulesQuery.isFetching
      || generateSchedulesMutation.isPending
      || confirmPaymentMutation.isPending,
    isContractDetailLoading,
    error:
      error
      || (contractsQuery.error instanceof Error ? contractsQuery.error.message : null)
      || (paymentSchedulesQuery.error instanceof Error ? paymentSchedulesQuery.error.message : null),
    loadContracts,
    loadContractsPage,
    loadContractDetail,
    loadPaymentSchedules,
    setContracts,
    handleSaveContract,
    handleDeleteContract,
    handleGenerateSchedules,
    handleConfirmPaymentSchedule,
    setContractsPageRows,
    setContractsPageMeta,
    setPaymentSchedules,
  };
}
