import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { useProductStore } from '../shared/stores/productStore';
import { useFilterStore } from '../shared/stores/filterStore';
import type { Product, PaginatedQuery, PaginationMeta } from '../types';

const fetchProductsMock = vi.hoisted(() => vi.fn());
const fetchProductsPageMock = vi.hoisted(() => vi.fn());
const createProductMock = vi.hoisted(() => vi.fn());
const updateProductMock = vi.hoisted(() => vi.fn());
const deleteProductApiMock = vi.hoisted(() => vi.fn());
const isRequestCanceledErrorMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/api/productApi', () => ({
  fetchProducts: fetchProductsMock,
  fetchProductsPage: fetchProductsPageMock,
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  deleteProduct: deleteProductApiMock,
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

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  product_code: 'SP-001',
  product_name: 'Server',
  domain_id: 10,
  vendor_id: 1,
  standard_price: 10000000,
  unit: 'Gói',
  description: 'High-performance server',
  is_active: true,
  created_at: '2026-03-01 00:00:00',
  updated_at: '2026-03-31 00:00:00',
  created_by: 1,
  updated_by: 1,
  ...overrides,
});

const resetProductStore = () => {
  useProductStore.setState({
    products: [],
    productsPageRows: [],
    productsPageMeta: DEFAULT_PAGINATION_META,
    isProductsLoading: false,
    isProductsPageLoading: false,
    isSaving: false,
    error: null,
    notifier: null,
  });
};

describe('productStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductStore();
    useFilterStore.getState().resetTabFilter('productsPage');
  });

  it('loads paginated products and persists the latest filter query', async () => {
    const pageQuery: PaginatedQuery = {
      page: 1,
      per_page: 20,
      q: 'Server',
      sort_by: 'product_code',
      sort_dir: 'asc',
    };
    const rows = [buildProduct({ id: 2, product_name: 'Storage' })];

    fetchProductsPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 1, per_page: 20, total: 5, total_pages: 1 }),
    });

    await act(async () => {
      await useProductStore.getState().loadProductsPage(pageQuery);
    });

    expect(fetchProductsPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useProductStore.getState().productsPageRows).toEqual(rows);
    expect(useProductStore.getState().productsPageMeta.total).toBe(5);

    const storedFilter = useFilterStore.getState().getTabFilter('productsPage');
    expect(storedFilter.page).toBe(pageQuery.page);
    expect(storedFilter.per_page).toBe(pageQuery.per_page);
    expect(storedFilter.q).toBe(pageQuery.q);
  });

  it('creates a new product and notifies success', async () => {
    const notifier = vi.fn();
    const newProduct = buildProduct({ id: 10, product_name: 'Sản phẩm mới' });

    useProductStore.getState().setNotifier(notifier);
    createProductMock.mockResolvedValue(newProduct);
    fetchProductsPageMock.mockResolvedValue({
      data: [newProduct],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    let result: Product | null = null;
    await act(async () => {
      result = await useProductStore.getState().saveProduct({
        data: {
          product_name: newProduct.product_name,
          domain_id: newProduct.domain_id,
          vendor_id: newProduct.vendor_id,
          standard_price: newProduct.standard_price,
        },
      });
    });

    expect(result).toEqual(newProduct);
    expect(createProductMock).toHaveBeenCalled();
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Tạo mới sản phẩm thành công.'
    );
    expect(useProductStore.getState().productsPageRows).toContain(newProduct);
  });

  it('updates an existing product', async () => {
    const notifier = vi.fn();
    const existingProduct = buildProduct({ id: 5 });
    const updatedProduct = buildProduct({ id: 5, product_name: 'Sản phẩm cập nhật' });

    useProductStore.getState().setNotifier(notifier);
    useProductStore.setState({
      products: [existingProduct],
      productsPageRows: [existingProduct],
    });

    updateProductMock.mockResolvedValue(updatedProduct);
    fetchProductsPageMock.mockResolvedValue({
      data: [updatedProduct],
      meta: buildMeta({ total: 1, total_pages: 1 }),
    });

    await act(async () => {
      await useProductStore.getState().saveProduct({
        id: 5,
        data: { product_name: updatedProduct.product_name },
      });
    });

    expect(updateProductMock).toHaveBeenCalledWith(5, { product_name: updatedProduct.product_name });
    expect(notifier).toHaveBeenCalledWith(
      'success',
      'Thành công',
      'Cập nhật sản phẩm thành công.'
    );
  });

  it('deletes a product and reloads page', async () => {
    const notifier = vi.fn();
    const product = buildProduct({ id: 7 });

    useProductStore.getState().setNotifier(notifier);
    useProductStore.setState({
      products: [product],
      productsPageRows: [product],
    });
    deleteProductApiMock.mockResolvedValue(undefined);
    fetchProductsPageMock.mockResolvedValue({
      data: [],
      meta: buildMeta({ total: 0, total_pages: 1 }),
    });

    const result = await act(async () => {
      return await useProductStore.getState().deleteProduct(7);
    });

    expect(result).toBe(true);
    expect(deleteProductApiMock).toHaveBeenCalledWith(7);
    expect(notifier).toHaveBeenCalledWith('success', 'Thành công', 'Xóa sản phẩm thành công.');
    expect(useProductStore.getState().productsPageRows).not.toContain(product);
  });

  it('handles delete error gracefully', async () => {
    const notifier = vi.fn();
    const deleteError = new Error('Delete failed');

    useProductStore.getState().setNotifier(notifier);
    deleteProductApiMock.mockRejectedValue(deleteError);

    const result = await act(async () => {
      return await useProductStore.getState().deleteProduct(99);
    });

    expect(result).toBe(false);
    expect(useProductStore.getState().error).toBe('Delete failed');
    expect(notifier).toHaveBeenCalledWith('error', 'Xóa thất bại', 'Delete failed');
  });

  it('loads full product list', async () => {
    const products = [
      buildProduct({ id: 1 }),
      buildProduct({ id: 2, product_name: 'Sản phẩm 2' }),
    ];
    fetchProductsMock.mockResolvedValue(products);

    await act(async () => {
      await useProductStore.getState().loadProducts();
    });

    expect(fetchProductsMock).toHaveBeenCalled();
    expect(useProductStore.getState().products).toEqual(products);
  });

  it('handles page query change through handler', async () => {
    const pageQuery: PaginatedQuery = {
      page: 2,
      per_page: 10,
      q: 'test',
      sort_by: 'product_name',
      sort_dir: 'desc',
    };
    const rows = [buildProduct()];

    fetchProductsPageMock.mockResolvedValue({
      data: rows,
      meta: buildMeta({ page: 2, per_page: 10, total: 15, total_pages: 2 }),
    });

    await act(async () => {
      await useProductStore.getState().handleProductsPageQueryChange(pageQuery);
    });

    expect(fetchProductsPageMock).toHaveBeenCalledWith(pageQuery);
    expect(useProductStore.getState().productsPageMeta.page).toBe(2);
  });
});
