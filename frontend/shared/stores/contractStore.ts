import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createContract,
  deleteContract,
  fetchContracts,
  fetchContractsPage,
  fetchPaymentSchedules,
  generateContractPayments,
  type GenerateContractPaymentsPayload,
  type GenerateContractPaymentsResult,
  updateContract,
  updatePaymentSchedule,
} from '../../services/api/contractApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { prependContractInCollection, replaceContractInCollection } from '../../utils/contractCollections';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import type {
  Contract,
  PaginatedQuery,
  PaginationMeta,
  PaymentSchedule,
  PaymentScheduleConfirmationPayload,
} from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveContractOptions {
  id?: string | number | null;
  data: Partial<Contract>;
  previousStatus?: Contract['status'] | null;
}

interface ContractStoreState {
  contracts: Contract[];
  contractsPageRows: Contract[];
  contractsPageMeta: PaginationMeta;
  paymentSchedules: PaymentSchedule[];
  isContractsLoading: boolean;
  isContractsPageLoading: boolean;
  isPaymentScheduleLoading: boolean;
  isSaving: boolean;
  error: string | null;
  notifier: ToastFn | null;
  setNotifier: (notifier: ToastFn | null) => void;
  loadContracts: () => Promise<void>;
  loadContractsPage: (query?: PaginatedQuery) => Promise<void>;
  handleContractsPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  loadPaymentSchedules: (contractId?: string | number) => Promise<void>;
  saveContract: (options: SaveContractOptions) => Promise<Contract | null>;
  deleteContract: (contractId: string | number) => Promise<boolean>;
  generateSchedules: (
    contractId: string | number,
    options?: { silent?: boolean; generateOptions?: GenerateContractPaymentsPayload }
  ) => Promise<GenerateContractPaymentsResult>;
  confirmPaymentSchedule: (
    scheduleId: string | number,
    payload: PaymentScheduleConfirmationPayload
  ) => Promise<PaymentSchedule>;
  exportContractsByCurrentQuery: () => Promise<Contract[]>;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredContractsQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('contractsPage');

const replaceSchedulesByContract = (
  currentSchedules: PaymentSchedule[],
  contractId: string | number,
  nextSchedules: PaymentSchedule[],
): PaymentSchedule[] => [
  ...(currentSchedules || []).filter((item) => String(item.contract_id) !== String(contractId)),
  ...(nextSchedules || []),
];

export const useContractStore = create<ContractStoreState>((set, get) => ({
  contracts: [],
  contractsPageRows: [],
  contractsPageMeta: DEFAULT_PAGINATION_META,
  paymentSchedules: [],
  isContractsLoading: false,
  isContractsPageLoading: false,
  isPaymentScheduleLoading: false,
  isSaving: false,
  error: null,
  notifier: null,

  setNotifier: (notifier) => set({ notifier }),

  loadContracts: async () => {
    set({ isContractsLoading: true, error: null });
    try {
      const contracts = await fetchContracts();
      set({ contracts });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách hợp đồng.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isContractsLoading: false });
    }
  },

  loadContractsPage: async (query) => {
    const nextQuery = query ?? getStoredContractsQuery();
    useFilterStore.getState().replaceTabFilter('contractsPage', nextQuery);
    set({ isContractsPageLoading: true, error: null });
    try {
      const result = await fetchContractsPage(nextQuery);
      set({
        contractsPageRows: result.data || [],
        contractsPageMeta: result.meta || DEFAULT_PAGINATION_META,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải danh sách hợp đồng.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isContractsPageLoading: false });
    }
  },

  handleContractsPageQueryChange: async (query) => {
    await get().loadContractsPage(query);
  },

  loadPaymentSchedules: async (contractId) => {
    set({ isPaymentScheduleLoading: true, error: null });
    try {
      const schedules = await fetchPaymentSchedules(contractId);
      if (contractId === undefined || contractId === null || String(contractId) === '') {
        set({ paymentSchedules: schedules });
        return;
      }

      set((state) => ({
        paymentSchedules: replaceSchedulesByContract(state.paymentSchedules, contractId, schedules),
      }));
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }

      const message = extractErrorMessage(error, 'Không thể tải kế hoạch thanh toán.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isPaymentScheduleLoading: false });
    }
  },

  saveContract: async ({ id, data, previousStatus = null }) => {
    set({ isSaving: true, error: null });
    try {
      const payload = data as Partial<Contract> & Record<string, unknown>;
      const saved = id == null
        ? await createContract(payload)
        : await updateContract(id, payload);

      set((state) => ({
        contracts: id == null
          ? prependContractInCollection(state.contracts, saved)
          : replaceContractInCollection(state.contracts, saved),
        contractsPageRows: id == null
          ? prependContractInCollection(state.contractsPageRows, saved)
          : replaceContractInCollection(state.contractsPageRows, saved),
      }));

      await get().loadContractsPage();

      const shouldGenerateSchedules = saved.status === 'SIGNED'
        && (id == null || previousStatus !== 'SIGNED');
      if (shouldGenerateSchedules) {
        try {
          await get().generateSchedules(saved.id, { silent: true });
          get().notifier?.('success', 'Dòng tiền', 'Đã tự động sinh kỳ thanh toán sau khi hợp đồng chuyển Đã ký.');
        } catch (generationError) {
          const message = extractErrorMessage(generationError, 'Lỗi không xác định');
          get().notifier?.('error', 'Dòng tiền', `Hợp đồng đã lưu nhưng chưa sinh được kỳ thanh toán tự động. ${message}`);
        }
      }

      get().notifier?.(
        'success',
        'Thành công',
        id == null ? 'Thêm mới hợp đồng thành công.' : 'Cập nhật hợp đồng thành công.',
      );
      return saved;
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return null;
      }

      const message = extractErrorMessage(error, 'Không thể lưu hợp đồng.');
      set({ error: message });
      get().notifier?.('error', 'Lưu thất bại', message);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteContract: async (contractId) => {
    set({ isSaving: true, error: null });
    try {
      await deleteContract(contractId);
      set((state) => ({
        contracts: state.contracts.filter((item) => String(item.id) !== String(contractId)),
        contractsPageRows: state.contractsPageRows.filter((item) => String(item.id) !== String(contractId)),
        paymentSchedules: state.paymentSchedules.filter((item) => String(item.contract_id) !== String(contractId)),
      }));
      await get().loadContractsPage();
      get().notifier?.('success', 'Thành công', 'Đã xóa hợp đồng.');
      return true;
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return false;
      }

      const message = extractErrorMessage(error, 'Không thể xóa hợp đồng.');
      set({ error: message });
      get().notifier?.('error', 'Xóa thất bại', message);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  generateSchedules: async (contractId, options) => {
    set({ isPaymentScheduleLoading: true, error: null });
    try {
      const result = await generateContractPayments(contractId, options?.generateOptions);
      const nextSchedules = result.data || [];
      set((state) => ({
        paymentSchedules: replaceSchedulesByContract(state.paymentSchedules, contractId, nextSchedules),
      }));

      if (!options?.silent) {
        const generatedCount = result.meta?.generated_count ?? nextSchedules.length;
        const allocationModeLabel = result.meta?.allocation_mode === 'MILESTONE' ? 'Mốc nghiệm thu' : 'Chia đều';
        get().notifier?.('success', 'Thành công', `Đã đồng bộ ${generatedCount} kỳ thanh toán (${allocationModeLabel}).`);
      }

      return result;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể sinh kỳ thanh toán.');
      set({ error: message });
      if (!options?.silent) {
        get().notifier?.('error', 'Sinh dòng tiền thất bại', message);
      }
      throw error;
    } finally {
      set({ isPaymentScheduleLoading: false });
    }
  },

  confirmPaymentSchedule: async (scheduleId, payload) => {
    set({ isPaymentScheduleLoading: true, error: null });
    try {
      const updated = await updatePaymentSchedule(scheduleId, payload);
      set((state) => ({
        paymentSchedules: state.paymentSchedules.map((item) => (
          String(item.id) === String(updated.id) ? updated : item
        )),
      }));
      get().notifier?.('success', 'Thành công', 'Đã xác nhận thu tiền cho kỳ thanh toán.');
      return updated;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể xác nhận thu tiền.');
      set({ error: message });
      get().notifier?.('error', 'Cập nhật thất bại', message);
      throw error;
    } finally {
      set({ isPaymentScheduleLoading: false });
    }
  },

  exportContractsByCurrentQuery: async () => {
    const seedQuery = {
      ...FILTER_DEFAULTS.contractsPage,
      ...getStoredContractsQuery(),
      page: 1,
      per_page: 200,
    };
    const rows: Contract[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await fetchContractsPage({ ...seedQuery, page });
      rows.push(...(result.data || []));
      totalPages = Math.max(1, result.meta?.total_pages || 1);
      page += 1;
    } while (page <= totalPages);

    const seen = new Set<string>();
    return rows.filter((item) => {
      const key = String(item.id ?? '');
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  },
}));
