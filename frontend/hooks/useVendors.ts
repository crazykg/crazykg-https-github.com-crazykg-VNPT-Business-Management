import { useState, useCallback } from 'react';
import {
  createVendor,
  deleteVendor,
  fetchVendors,
  updateVendor,
} from '../services/api/businessVendorApi';
import type { Vendor } from '../types/businessVendor';

interface UseVendorsReturn {
  vendors: Vendor[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  loadVendors: () => Promise<void>;
  handleSaveVendor: (data: Partial<Vendor>, modalType: 'ADD_VENDOR' | 'EDIT_VENDOR', selectedVendor: Vendor | null) => Promise<boolean>;
  handleDeleteVendor: (selectedVendor: Vendor) => Promise<boolean>;
}

export function useVendors(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseVendorsReturn {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchVendors();
      setVendors(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách đối tác.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const handleSaveVendor = useCallback(async (
    data: Partial<Vendor>,
    modalType: 'ADD_VENDOR' | 'EDIT_VENDOR',
    selectedVendor: Vendor | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      if (modalType === 'ADD_VENDOR') {
        const created = await createVendor(data);
        setVendors((prev) => [created, ...prev]);
        addToast?.('success', 'Thành công', 'Thêm mới đối tác thành công!');
      } else if (modalType === 'EDIT_VENDOR' && selectedVendor) {
        const updated = await updateVendor(selectedVendor.id, data);
        setVendors((prev) =>
          prev.map((v) => (String(v.id) === String(updated.id) ? updated : v))
        );
        addToast?.('success', 'Thành công', 'Cập nhật đối tác thành công!');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu đối tác vào cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  const handleDeleteVendor = useCallback(async (selectedVendor: Vendor): Promise<boolean> => {
    setError(null);
    try {
      await deleteVendor(selectedVendor.id);
      setVendors((prev) => prev.filter((v) => String(v.id) !== String(selectedVendor.id)));
      addToast?.('success', 'Thành công', 'Đã xóa đối tác.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa đối tác trên cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast]);

  return {
    vendors,
    isSaving,
    isLoading,
    error,
    loadVendors,
    handleSaveVendor,
    handleDeleteVendor,
  };
}
