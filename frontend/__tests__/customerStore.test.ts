import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useCustomerStore } from '../shared/stores/customerStore';
import { useFilterStore } from '../shared/stores/filterStore';
import type { Customer, PaginatedQuery, PaginationMeta } from '../types';

const fetchCustomersMock = vi.hoisted(() => vi.fn());
const fetchCustomersPageMock = vi.hoisted(() => vi.fn());
const createCustomerMock = vi.hoisted(() => vi.fn());
const updateCustomerMock = vi.hoisted(() => vi.fn());
const deleteCustomerApiMock = vi.hoisted(() => vi.fn());
const isRequestCanceledErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/api/customerApi', () => ({
  fetchCustomers: fetchCustomersMock,
  fetchCustomersPage: fetchCustomersPageMock,
  createCustomer: createCustomerMock,
  updateCustomer: updateCustomerMock,
  deleteCustomer: deleteCustomerApiMock,
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

const buildCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1,
  uuid: 'customer-1',
  customer_code: 'KH-001',
  customer_name: 'Công ty ABC',
  tax_code: '0123456789',
  address: '123 Đường ABC, Quận 1, TP.HCM',
  customer_sector: 'OTHER',
  created_at: '2026-03-01 00:00:00',
  updated_at: '2026-03-31 00:00:00',
  created_by: 1,
  updated_by: 1,
  ...overrides,
});

const resetCustomerStore = () => {
  useCustomerStore.setState({
    customers: [],
    customersPageRows: [],
    customersPageMeta: DEFAULT_PAGINATION_META,
    isCustomersLoading: false,
    isCustomersPageLoading: false,
    isSaving: false,
    error: null,
    dependencyError: null,
    notifier: null,
  });
};

describe('customerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCustomerStore();
    useFilterStore.getState().resetTabFilter('customersPage');
  });

  it('loads paginated customers and persists the latest filter query', async () => {
    const pageQuery: PaginatedQuery = {
      page: 1,
      per_page: 20,
      q: 'ABC',
      sort_by: 'customer_code',
      sort_dir: 'asc',
    };
    const rows = [buildCustomer({ id: 2, customer_name: 'Công ty XYZ' })];

    fetchCustomersPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 1, per_page: 20, total: 5, total_pages: 1 }),
    });

    await act(async () => {
      await useCustomerStore.getState().loadCustomersPage(pageQuery);
    });

    expect(fetchCustomersPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useCustomerStore.getState().customersPageRows).toEqual(rows);
    expect(useCustomerStore.getState().customersPageMeta.total).toBe(5);

    // Check that filter store contains the expected query values
    const storedFilter = useFilterStore.getState().getTabFilter('customersPage');
    expect(storedFilter.page).toBe(pageQuery.page);
    expect(storedFilter.per_page).toBe(pageQuery.per_page);
    expect(storedFilter.q).toBe(pageQuery.q);
    expect(storedFilter.sort_by).toBe(pageQuery.sort_by);
    expect(storedFilter.sort_dir).toBe(pageQuery.sort_dir);
  });

  it('creates a new customer and notifies success', async () => {
    const notifier = vi.fn();
    const newCustomer = buildCustomer({ id: 10, customer_name: 'Công ty Mới' });

    useCustomerStore.getState().setNotifier(notifier);
    createCustomerMock.mockResolvedValue(newCustomer);
    fetchCustomersPageMock.mockResolvedValue({
      data: [newCustomer],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    let result: Customer | null = null;
    await act(async () => {
      result = await useCustomerStore.getState().saveCustomer({
        data: {
          customer_name: newCustomer.customer_name,
          customer_code: newCustomer.customer_code,
          tax_code: newCustomer.tax_code,
          address: newCustomer.address,
        },
      });
    });

    expect(result).toEqual(newCustomer);
    expect(createCustomerMock).toHaveBeenCalled();
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Tạo mới khách hàng thành công.'
    );
    expect(useCustomerStore.getState().customersPageRows).toContain(newCustomer);
  });

  it('updates an existing customer and notifies success', async () => {
    const notifier = vi.fn();
    const existingCustomer = buildCustomer({ id: 5 });
    const updatedCustomer = buildCustomer({ id: 5, customer_name: 'Công ty Cập nhật' });

    useCustomerStore.getState().setNotifier(notifier);
    useCustomerStore.setState({ customers: [existingCustomer], customersPageRows: [existingCustomer] });

    updateCustomerMock.mockResolvedValue(updatedCustomer);
    fetchCustomersPageMock.mockResolvedValue({
      data: [updatedCustomer],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    await act(async () => {
      await useCustomerStore.getState().saveCustomer({
        id: 5,
        data: { customer_name: updatedCustomer.customer_name },
      });
    });

    expect(updateCustomerMock).toHaveBeenCalledWith(5, { customer_name: updatedCustomer.customer_name });
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Cập nhật khách hàng thành công.'
    );
  });

  it('deletes a customer and notifies success', async () => {
    const notifier = vi.fn();
    const customer = buildCustomer({ id: 7 });

    useCustomerStore.getState().setNotifier(notifier);
    useCustomerStore.setState({ customers: [customer], customersPageRows: [customer] });
    deleteCustomerApiMock.mockResolvedValue(undefined);
    fetchCustomersPageMock.mockResolvedValue({
      data: [],
      meta: buildMeta({ total: 0, total_pages: 1 }),
    });

    const result = await act(async () => {
      return await useCustomerStore.getState().deleteCustomer(7);
    });

    expect(result).toBe(true);
    expect(deleteCustomerApiMock).toHaveBeenCalledWith(7);
    expect(notifier).toHaveBeenCalledWith('success', 'Thành công', 'Xóa khách hàng thành công.');
    expect(useCustomerStore.getState().customersPageRows).not.toContain(customer);
  });

  it('surfaces generic delete errors when backend does not return a conflict response', async () => {
    const notifier = vi.fn();
    const customer = buildCustomer({ id: 8 });

    useCustomerStore.getState().setNotifier(notifier);
    useCustomerStore.setState({ customers: [customer], customersPageRows: [customer] });

    const dependencyError = new Error('Customer has active contracts');
    (dependencyError as any).status = 422;
    deleteCustomerApiMock.mockRejectedValue(dependencyError);

    const result = await act(async () => {
      return await useCustomerStore.getState().deleteCustomer(8);
    });

    expect(result).toBe(false);
    expect(useCustomerStore.getState().dependencyError).toBe(null);
    expect(useCustomerStore.getState().error).toBe('Customer has active contracts');
    expect(notifier).toHaveBeenCalledWith(
      'error',
      'Xóa thất bại',
      'Customer has active contracts'
    );
    // Customer should still be in state after failed delete
    expect(useCustomerStore.getState().customersPageRows).toContain(customer);
  });

  it('handles 409 dependency error when deleting customer', async () => {
    const notifier = vi.fn();
    const dependencyError = new Response(
      JSON.stringify({ message: 'Không thể xóa khách hàng. Khách hàng vẫn còn hợp đồng liên kết.' }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    deleteCustomerApiMock.mockRejectedValue(dependencyError);

    useCustomerStore.getState().setNotifier(notifier);
    const result = await act(async () => {
      return await useCustomerStore.getState().deleteCustomer(99);
    });

    expect(result).toBe(false);
    expect(useCustomerStore.getState().dependencyError).not.toBe(null);
    expect(notifier).toHaveBeenCalledWith(
      'error',
      'Không thể xóa',
      expect.stringContaining('hợp đồng liên kết')
    );
  });

  it('clears dependency error', async () => {
    useCustomerStore.setState({ dependencyError: 'Some error' });
    expect(useCustomerStore.getState().dependencyError).not.toBe(null);

    await act(async () => {
      useCustomerStore.getState().clearDependencyError();
    });

    expect(useCustomerStore.getState().dependencyError).toBe(null);
  });

  it('loads full customer list', async () => {
    const customers = [
      buildCustomer({ id: 1 }),
      buildCustomer({ id: 2, customer_name: 'Công ty 2' }),
    ];
    fetchCustomersMock.mockResolvedValue(customers);

    await act(async () => {
      await useCustomerStore.getState().loadCustomers();
    });

    expect(fetchCustomersMock).toHaveBeenCalled();
    expect(useCustomerStore.getState().customers).toEqual(customers);
  });
});
