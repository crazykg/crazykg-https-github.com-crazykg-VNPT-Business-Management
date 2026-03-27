import { useState, useCallback } from 'react';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/v5Api';
import type { Product } from '../types';
import { normalizeProductUnitForSave } from '../utils/productUnit';
import { DEFAULT_PRODUCT_SERVICE_GROUP, normalizeProductServiceGroup } from '../utils/productServiceGroup';

interface UseProductsReturn {
  products: Product[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  productDeleteDependencyMessage: string | null;
  loadProducts: () => Promise<void>;
  handleSaveProduct: (data: Partial<Product>, modalType: 'ADD_PRODUCT' | 'EDIT_PRODUCT', selectedProduct: Product | null) => Promise<boolean>;
  handleDeleteProduct: (selectedProduct: Product) => Promise<boolean>;
  clearProductDeleteDependencyMessage: () => void;
}

export function useProducts(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productDeleteDependencyMessage, setProductDeleteDependencyMessage] = useState<string | null>(null);

  const normalizeProductRecord = useCallback((product: Product): Product => ({
    ...product,
    service_group: normalizeProductServiceGroup(product.service_group),
    package_name: typeof product.package_name === 'string'
      ? product.package_name
      : (product.package_name ?? null),
    unit: normalizeProductUnitForSave(product.unit),
    description: typeof product.description === 'string'
      ? product.description
      : (product.description ?? null),
    attachments: Array.isArray(product.attachments)
      ? product.attachments.map((attachment) => ({
        ...attachment,
        id: String(attachment.id ?? ''),
        fileName: String(attachment.fileName ?? ''),
        mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
        fileSize: Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : 0,
        fileUrl: String(attachment.fileUrl ?? ''),
        driveFileId: String(attachment.driveFileId ?? ''),
        createdAt: String(attachment.createdAt ?? ''),
        storagePath: typeof attachment.storagePath === 'string' ? attachment.storagePath : (attachment.storagePath ?? null),
        storageDisk: typeof attachment.storageDisk === 'string' ? attachment.storageDisk : (attachment.storageDisk ?? null),
        storageVisibility: typeof attachment.storageVisibility === 'string' ? attachment.storageVisibility : (attachment.storageVisibility ?? null),
        warningMessage: typeof attachment.warningMessage === 'string' ? attachment.warningMessage : (attachment.warningMessage ?? null),
      }))
      : [],
    is_active: product.is_active !== false,
  }), []);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchProducts();
      setProducts((rows || []).map(normalizeProductRecord));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách sản phẩm.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const handleSaveProduct = useCallback(async (
    data: Partial<Product>,
    modalType: 'ADD_PRODUCT' | 'EDIT_PRODUCT',
    selectedProduct: Product | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: Partial<Product> = {
        ...data,
        service_group: normalizeProductServiceGroup(data.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
        package_name: typeof data.package_name === 'string' ? data.package_name : null,
        unit: normalizeProductUnitForSave(data.unit),
        description: typeof data.description === 'string' ? data.description : null,
        is_active: data.is_active !== false,
        standard_price: Number.isFinite(Number(data.standard_price)) ? Number(data.standard_price) : 0,
      };

      if (modalType === 'ADD_PRODUCT') {
        const created = await createProduct(payload);
        setProducts((previous) => [created, ...(previous || [])]);
        addToast?.('success', 'Thành công', 'Thêm mới sản phẩm thành công!');
      } else if (modalType === 'EDIT_PRODUCT' && selectedProduct) {
        const updated = await updateProduct(selectedProduct.id, payload);
        setProducts((previous) =>
          previous.map((product) =>
            String(product.id) === String(updated.id) ? updated : product
          )
        );
        addToast?.('success', 'Thành công', 'Cập nhật sản phẩm thành công!');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu sản phẩm vào cơ sở dữ liệu. ${message}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  const handleDeleteProduct = useCallback(async (selectedProduct: Product): Promise<boolean> => {
    setError(null);
    try {
      await deleteProduct(selectedProduct.id);
      setProducts((prev) => prev.filter((product) => String(product.id) !== String(selectedProduct.id)));
      addToast?.('success', 'Thành công', 'Đã xóa sản phẩm.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      
      // Check for dependency error
      if (isProductDeleteDependencyError(err)) {
        setProductDeleteDependencyMessage(message);
        return false; // Return false to indicate modal should show dependency warning
      }
      
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa sản phẩm trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast]);

  const clearProductDeleteDependencyMessage = useCallback(() => {
    setProductDeleteDependencyMessage(null);
  }, []);

  return {
    products,
    isSaving,
    isLoading,
    error,
    productDeleteDependencyMessage,
    loadProducts,
    handleSaveProduct,
    handleDeleteProduct,
    clearProductDeleteDependencyMessage,
  };
}

/**
 * Checks if the error is a product delete dependency error.
 * This happens when the product is being used and cannot be deleted.
 */
function isProductDeleteDependencyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalizedMessage.includes('san pham dang duoc su dung va khong the xoa')
    || normalizedMessage.includes('san pham dang phat sinh o du lieu khac')
    || normalizedMessage.includes('xoa ban ghi tham chieu truoc khi xoa san pham');
}