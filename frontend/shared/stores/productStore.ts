import { create } from 'zustand';
import { DEFAULT_PAGINATION_META } from '../../services/api/_infra';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  fetchProductsPage,
  updateProduct,
} from '../../services/api/productApi';
import { isRequestCanceledError } from '../../services/v5Api';
import { FILTER_DEFAULTS, useFilterStore } from './filterStore';
import type {
  Product,
  PaginatedQuery,
  PaginationMeta,
} from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveProductOptions {
  id?: string | number | null;
  data: Partial<Product>;
}

interface ProductStoreState {
  products: Product[];
  productsPageRows: Product[];
  productsPageMeta: PaginationMeta;
  isProductsLoading: boolean;
  isProductsPageLoading: boolean;
  isSaving: boolean;
  error: string | null;
  notifier: ToastFn | null;

  setNotifier: (notifier: ToastFn | null) => void;
  loadProducts: () => Promise<void>;
  loadProductsPage: (query?: PaginatedQuery) => Promise<void>;
  handleProductsPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  saveProduct: (options: SaveProductOptions) => Promise<Product | null>;
  deleteProduct: (productId: string | number) => Promise<boolean>;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getStoredProductsQuery = (): PaginatedQuery =>
  useFilterStore.getState().getTabFilter('productsPage');

export const useProductStore = create<ProductStoreState>((set, get) => ({
  products: [],
  productsPageRows: [],
  productsPageMeta: DEFAULT_PAGINATION_META,
  isProductsLoading: false,
  isProductsPageLoading: false,
  isSaving: false,
  error: null,
  notifier: null,

  setNotifier: (notifier) => set({ notifier }),

  loadProducts: async () => {
    set({ isProductsLoading: true, error: null });
    try {
      const products = await fetchProducts();
      set({ products });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách sản phẩm.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isProductsLoading: false });
    }
  },

  loadProductsPage: async (query?: PaginatedQuery) => {
    const nextQuery = query ?? getStoredProductsQuery();
    useFilterStore.getState().replaceTabFilter('productsPage', nextQuery);
    set({ isProductsPageLoading: true, error: null });
    try {
      const result = await fetchProductsPage(nextQuery);
      set({
        productsPageRows: result.data || [],
        productsPageMeta: result.meta || DEFAULT_PAGINATION_META,
      });
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = extractErrorMessage(error, 'Không thể tải danh sách sản phẩm.');
      set({ error: message });
      get().notifier?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      set({ isProductsPageLoading: false });
    }
  },

  handleProductsPageQueryChange: async (query: PaginatedQuery) => {
    await get().loadProductsPage(query);
  },

  saveProduct: async (options: SaveProductOptions) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      const saved = id == null
        ? await createProduct(data)
        : await updateProduct(id, data);

      set((state) => ({
        products: id == null
          ? [saved, ...state.products.filter((p) => String(p.id) !== String(saved.id))]
          : state.products.map((p) => (String(p.id) === String(saved.id) ? saved : p)),
        productsPageRows: id == null
          ? [saved, ...state.productsPageRows.filter((p) => String(p.id) !== String(saved.id))]
          : state.productsPageRows.map((p) => (String(p.id) === String(saved.id) ? saved : p)),
      }));

      const action = id == null ? 'Thêm mới' : 'Cập nhật';
      get().notifier?.('success', 'Thành công', `${action} sản phẩm thành công!`);

      // Reload page to ensure fresh data
      await get().loadProductsPage();

      return saved;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Lưu thất bại', `Không thể lưu sản phẩm vào cơ sở dữ liệu. ${message}`);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProduct: async (productId: string | number) => {
    set({ isSaving: true, error: null });
    try {
      await deleteProduct(productId);

      set((state) => ({
        products: state.products.filter((p) => String(p.id) !== String(productId)),
        productsPageRows: state.productsPageRows.filter((p) => String(p.id) !== String(productId)),
      }));

      get().notifier?.('success', 'Thành công', 'Đã xóa sản phẩm.');

      // Reload page to update pagination
      await get().loadProductsPage();

      return true;
    } catch (error) {
      const message = extractErrorMessage(error, 'Lỗi không xác định');
      set({ error: message });
      get().notifier?.('error', 'Xóa thất bại', `Không thể xóa sản phẩm trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },
}));
