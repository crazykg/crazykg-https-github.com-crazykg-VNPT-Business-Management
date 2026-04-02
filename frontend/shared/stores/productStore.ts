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
import { useToastStore } from './toastStore';
import type { Product, PaginatedQuery, PaginationMeta } from '../../types';

type ToastFn = (type: 'success' | 'error', title: string, message: string) => void;

interface SaveProductOptions {
  id?: string | number | null;
  data: Partial<Product>;
}

interface ProductStoreState {
  // --- state ---
  products: Product[];
  productsPageRows: Product[];
  productsPageMeta: PaginationMeta;
  isProductsLoading: boolean;
  isProductsPageLoading: boolean;
  isSaving: boolean;
  error: string | null;
  dependencyError: string | null;
  notifier: ToastFn | null;

  // --- actions ---
  setNotifier: (notifier: ToastFn | null) => void;
  loadProducts: () => Promise<void>;
  loadProductsPage: (query?: PaginatedQuery) => Promise<void>;
  handleProductsPageQueryChange: (query: PaginatedQuery) => Promise<void>;
  saveProduct: (options: SaveProductOptions) => Promise<Product | null>;
  deleteProduct: (productId: string | number) => Promise<boolean>;
  clearDependencyError: () => void;
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
  dependencyError: null,
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

  loadProductsPage: async (query) => {
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

  handleProductsPageQueryChange: async (query) => {
    await get().loadProductsPage(query);
  },

  saveProduct: async (options) => {
    const { id, data } = options;
    set({ isSaving: true, error: null });
    try {
      let savedProduct: Product;

      if (id) {
        savedProduct = await updateProduct(id, data);
      } else {
        savedProduct = await createProduct(data);
      }

      // Refresh products list
      await get().loadProductsPage();

      const action = id ? 'Cập nhật' : 'Tạo mới';
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', `${action} sản phẩm thành công.`);

      return savedProduct;
    } catch (error) {
      const message = extractErrorMessage(error, 'Không thể lưu sản phẩm.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Lưu thất bại', message);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProduct: async (productId) => {
    set({ isSaving: true, error: null, dependencyError: null });
    try {
      await deleteProduct(productId);

      // Remove from local state
      set((state) => ({
        productsPageRows: state.productsPageRows.filter((p) => String(p.id) !== String(productId)),
        products: state.products.filter((p) => String(p.id) !== String(productId)),
      }));

      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('success', 'Thành công', 'Xóa sản phẩm thành công.');
      return true;
    } catch (error) {
      // Handle 409 Conflict (product referenced by contract items)
      if (error instanceof Response && error.status === 409) {
        const errorData = await error.json();
        const message = errorData.message || 'Sản phẩm còn được sử dụng trong hợp đồng. Không thể xóa.';
        set({ dependencyError: message });
        const toastFn = get().notifier || useToastStore.getState().addToast;
        toastFn('error', 'Không thể xóa', message);
        return false;
      }

      const message = extractErrorMessage(error, 'Không thể xóa sản phẩm.');
      set({ error: message });
      const toastFn = get().notifier || useToastStore.getState().addToast;
      toastFn('error', 'Xóa thất bại', message);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  clearDependencyError: () => set({ dependencyError: null }),
}));
