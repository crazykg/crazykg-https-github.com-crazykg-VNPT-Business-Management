import { useState, useCallback } from 'react';
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
  DEFAULT_PAGINATION_META,
} from '../services/v5Api';
import type {
  Contract,
  PaymentSchedule,
  PaginatedQuery,
  PaginationMeta,
  PaymentScheduleConfirmationPayload,
} from '../types';
import type { GenerateContractPaymentsPayload } from '../services/v5Api';

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
  loadPaymentSchedules: (contractId: string | number) => Promise<void>;
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
  setPaymentSchedules: (schedules: PaymentSchedule[]) => void;
}

export function useContracts(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseContractsReturn {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsPageRows, setContractsPageRows] = useState<Contract[]>([]);
  const [contractsPageMeta, setContractsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [paymentSchedules, setPaymentSchedulesState] = useState<PaymentSchedule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isPaymentScheduleLoading, setIsPaymentScheduleLoading] = useState(false);
  const [isContractDetailLoading, setIsContractDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchContracts();
      setContracts(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách hợp đồng.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadContractsPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchContractsPage(query);
      setContractsPageRows(result.data || []);
      setContractsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách hợp đồng.';
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
      const message = err instanceof Error ? err.message : 'Không thể tải chi tiết hợp đồng.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
      return null;
    } finally {
      setIsContractDetailLoading(false);
    }
  }, [addToast]);

  const loadPaymentSchedules = useCallback(async (contractId: string | number) => {
    setIsPaymentScheduleLoading(true);
    setError(null);
    try {
      const rows = await fetchPaymentSchedules(contractId);
      replaceSchedulesByContract(contractId, rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải kế hoạch thanh toán.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  }, [addToast]);

  const replaceSchedulesByContract = useCallback((contractId: string | number, schedules: PaymentSchedule[]) => {
    setPaymentSchedulesState((prev) => [
      ...(prev || []).filter((item) => String(item.contract_id) !== String(contractId)),
      ...(schedules || []),
    ]);
  }, []);

  const handleSaveContract = useCallback(async (
    data: Partial<Contract>,
    modalType: 'ADD_CONTRACT' | 'EDIT_CONTRACT',
    selectedContractItem: Contract | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = data as Partial<Contract> & Record<string, unknown>;
      
      if (modalType === 'ADD_CONTRACT') {
        const created = await createContract(payload);
        setContracts((prev) => [created, ...prev]);
        
        // Auto-generate payment schedules if contract is signed
        if (created.status === 'SIGNED') {
          try {
            await handleGenerateSchedules(created.id, { silent: true });
            addToast?.('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (genError) {
            const message = genError instanceof Error ? genError.message : 'Lỗi không xác định';
            addToast?.('error', 'Dòng tiền', `Hợp đồng đã lưu nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast?.('success', 'Thành công', 'Thêm mới hợp đồng thành công!');
      } else if (modalType === 'EDIT_CONTRACT' && selectedContractItem) {
        const previousStatus = selectedContractItem.status;
        const updated = await updateContract(selectedContractItem.id, payload);
        setContracts((prev) =>
          prev.map((c) => (String(c.id) === String(updated.id) ? updated : c))
        );
        
        // Auto-generate payment schedules if contract just became signed
        if (updated.status === 'SIGNED' && previousStatus !== 'SIGNED') {
          try {
            await handleGenerateSchedules(updated.id, { silent: true });
            addToast?.('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
          } catch (genError) {
            const message = genError instanceof Error ? genError.message : 'Lỗi không xác định';
            addToast?.('error', 'Dòng tiền', `Hợp đồng đã cập nhật nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
          }
        }
        addToast?.('success', 'Thành công', 'Cập nhật hợp đồng thành công!');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu hợp đồng vào cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  const handleDeleteContract = useCallback(async (selectedContractItem: Contract): Promise<boolean> => {
    setError(null);
    try {
      await deleteContract(selectedContractItem.id);
      setContracts((prev) => prev.filter((c) => String(c.id) !== String(selectedContractItem.id)));
      addToast?.('success', 'Thành công', 'Đã xóa hợp đồng.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa hợp đồng trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast]);

  const handleGenerateSchedules = useCallback(async (
    contractId: string | number,
    options?: { silent?: boolean; generateOptions?: GenerateContractPaymentsPayload }
  ): Promise<void> => {
    setIsPaymentScheduleLoading(true);
    try {
      const generatedResult = await generateContractPayments(contractId, options?.generateOptions);
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
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      if (!options?.silent) {
        addToast?.('error', 'Sinh dòng tiền thất bại', `Không thể sinh kỳ thanh toán tự động. ${message}`);
      }
      throw err;
    } finally {
      setIsPaymentScheduleLoading(false);
    }
  }, [addToast, replaceSchedulesByContract]);

  const handleConfirmPaymentSchedule = useCallback(async (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ): Promise<void> => {
    try {
      const updated = await updatePaymentSchedule(scheduleId, payload);
      setPaymentSchedulesState((prev) =>
        prev.map((item) =>
          String(item.id) === String(updated.id) ? updated : item
        )
      );
      addToast?.('success', 'Thành công', 'Đã xác nhận thu tiền cho kỳ thanh toán.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      addToast?.('error', 'Cập nhật thất bại', `Không thể xác nhận thu tiền. ${message}`);
      throw err;
    }
  }, [addToast]);

  return {
    contracts,
    contractsPageRows,
    contractsPageMeta,
    paymentSchedules,
    isSaving,
    isLoading,
    isPageLoading,
    isPaymentScheduleLoading,
    isContractDetailLoading,
    error,
    loadContracts,
    loadContractsPage,
    loadContractDetail,
    loadPaymentSchedules,
    handleSaveContract,
    handleDeleteContract,
    handleGenerateSchedules,
    handleConfirmPaymentSchedule,
    setContractsPageRows,
    setContractsPageMeta,
    setPaymentSchedules: setPaymentSchedulesState,
  };
}