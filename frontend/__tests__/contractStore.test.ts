import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useContractStore } from '../shared/stores/contractStore';
import { useFilterStore } from '../shared/stores/filterStore';
import type { Contract, PaginatedQuery, PaginationMeta, PaymentSchedule } from '../types';

const fetchContractsMock = vi.hoisted(() => vi.fn());
const fetchContractsPageMock = vi.hoisted(() => vi.fn());
const fetchPaymentSchedulesMock = vi.hoisted(() => vi.fn());
const createContractMock = vi.hoisted(() => vi.fn());
const updateContractMock = vi.hoisted(() => vi.fn());
const deleteContractApiMock = vi.hoisted(() => vi.fn());
const generateContractPaymentsMock = vi.hoisted(() => vi.fn());
const updatePaymentScheduleMock = vi.hoisted(() => vi.fn());
const isRequestCanceledErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/api/contractApi', () => ({
  fetchContracts: fetchContractsMock,
  fetchContractsPage: fetchContractsPageMock,
  fetchPaymentSchedules: fetchPaymentSchedulesMock,
  createContract: createContractMock,
  updateContract: updateContractMock,
  deleteContract: deleteContractApiMock,
  generateContractPayments: generateContractPaymentsMock,
  updatePaymentSchedule: updatePaymentScheduleMock,
}));

vi.mock('../services/v5Api', async () => {
  const actual = await vi.importActual<typeof import('../services/v5Api')>('../services/v5Api');
  return {
    ...actual,
    isRequestCanceledError: isRequestCanceledErrorMock,
  };
});

const buildMeta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => ({
  ...DEFAULT_PAGINATION_META,
  ...overrides,
});

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 1,
  contract_code: 'HD-001',
  contract_name: 'Hợp đồng HIS',
  customer_id: 10,
  project_id: 20,
  project_type_code: null,
  value: 150000000,
  payment_cycle: 'ONCE',
  status: 'DRAFT',
  sign_date: '2026-03-31',
  effective_date: '2026-04-01',
  expiry_date: '2026-12-31',
  ...overrides,
});

const buildSchedule = (overrides: Partial<PaymentSchedule> = {}): PaymentSchedule => ({
  id: 100,
  contract_id: 1,
  milestone_name: 'Kỳ 1',
  cycle_number: 1,
  expected_date: '2026-04-30',
  expected_amount: 50000000,
  actual_paid_amount: 0,
  status: 'PENDING',
  ...overrides,
});

const resetContractStore = () => {
  useContractStore.setState({
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
  });
};

describe('contractStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContractStore();
    useFilterStore.getState().resetTabFilter('contractsPage');
  });

  it('loads paginated contracts and persists the latest filter query', async () => {
    const pageQuery: PaginatedQuery = {
      page: 2,
      per_page: 20,
      q: 'HIS',
      sort_by: 'contract_code',
      sort_dir: 'asc',
      filters: { status: 'SIGNED' },
    };
    const rows = [buildContract({ id: 2, status: 'SIGNED' })];

    fetchContractsPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 2, per_page: 20, total: 21, total_pages: 2 }),
    });

    await act(async () => {
      await useContractStore.getState().loadContractsPage(pageQuery);
    });

    expect(fetchContractsPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useContractStore.getState().contractsPageRows).toEqual(rows);
    expect(useContractStore.getState().contractsPageMeta.total).toBe(21);
    expect(useFilterStore.getState().getTabFilter('contractsPage')).toEqual(pageQuery);
  });

  it('saves a signed contract and auto-generates schedules', async () => {
    const notifier = vi.fn();
    const savedContract = buildContract({ id: 9, status: 'SIGNED' });
    const generatedSchedules = [buildSchedule({ id: 901, contract_id: 9 })];

    useContractStore.getState().setNotifier(notifier);
    createContractMock.mockResolvedValue(savedContract);
    fetchContractsPageMock.mockResolvedValue({
      data: [savedContract],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });
    generateContractPaymentsMock.mockResolvedValue({
      data: generatedSchedules,
      generated_data: generatedSchedules,
      meta: {
        generated_count: 1,
        allocation_mode: 'EVEN',
      },
    });

    let result: Contract | null = null;
    await act(async () => {
      result = await useContractStore.getState().saveContract({
        data: {
          contract_code: savedContract.contract_code,
          contract_name: savedContract.contract_name,
          customer_id: savedContract.customer_id,
          project_id: savedContract.project_id,
          value: savedContract.value,
          status: 'SIGNED',
        },
      });
    });

    expect(result).toEqual(savedContract);
    expect(createContractMock).toHaveBeenCalledTimes(1);
    expect(generateContractPaymentsMock).toHaveBeenCalledWith(9, undefined);
    expect(useContractStore.getState().contracts).toEqual([savedContract]);
    expect(useContractStore.getState().paymentSchedules).toEqual(generatedSchedules);
    expect(notifier).toHaveBeenCalledWith('success', 'Dòng tiền', expect.stringContaining('Đã tự động sinh kỳ thanh toán'));
  });

  it('deletes a contract and cleans payment schedules before refreshing the page', async () => {
    const notifier = vi.fn();
    const existingContract = buildContract({ id: 12 });
    const remainingContract = buildContract({ id: 13, contract_code: 'HD-013' });
    const staleSchedule = buildSchedule({ id: 701, contract_id: 12 });
    const keepSchedule = buildSchedule({ id: 702, contract_id: 13 });

    useContractStore.getState().setNotifier(notifier);
    useContractStore.setState({
      contracts: [existingContract, remainingContract],
      contractsPageRows: [existingContract, remainingContract],
      paymentSchedules: [staleSchedule, keepSchedule],
    });
    deleteContractApiMock.mockResolvedValue(undefined);
    fetchContractsPageMock.mockResolvedValue({
      data: [remainingContract],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    let deleted = false;
    await act(async () => {
      deleted = await useContractStore.getState().deleteContract(12);
    });

    expect(deleted).toBe(true);
    expect(deleteContractApiMock).toHaveBeenCalledWith(12);
    expect(useContractStore.getState().contracts).toEqual([remainingContract]);
    expect(useContractStore.getState().paymentSchedules).toEqual([keepSchedule]);
    expect(notifier).toHaveBeenCalledWith('success', 'Thành công', 'Đã xóa hợp đồng.');
  });

  it('exports all pages using the latest stored contracts filter', async () => {
    useFilterStore.getState().replaceTabFilter('contractsPage', {
      page: 3,
      per_page: 50,
      q: 'EMR',
      sort_by: 'contract_code',
      sort_dir: 'asc',
      filters: { status: 'SIGNED' },
    });

    fetchContractsPageMock
      .mockResolvedValueOnce({
        data: [buildContract({ id: 21, contract_code: 'HD-021' })],
        meta: buildMeta({ page: 1, per_page: 200, total: 2, total_pages: 2 }),
      })
      .mockResolvedValueOnce({
        data: [buildContract({ id: 22, contract_code: 'HD-022' })],
        meta: buildMeta({ page: 2, per_page: 200, total: 2, total_pages: 2 }),
      });

    let exported: Contract[] = [];
    await act(async () => {
      exported = await useContractStore.getState().exportContractsByCurrentQuery();
    });

    expect(fetchContractsPageMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      page: 1,
      per_page: 200,
      q: 'EMR',
      sort_by: 'contract_code',
      sort_dir: 'asc',
      filters: { status: 'SIGNED' },
    }));
    expect(fetchContractsPageMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page: 2,
      per_page: 200,
      q: 'EMR',
      sort_by: 'contract_code',
      sort_dir: 'asc',
      filters: { status: 'SIGNED' },
    }));
    expect(exported.map((item) => item.id)).toEqual([21, 22]);
  });
});
