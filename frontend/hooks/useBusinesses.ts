import { useState, useCallback } from 'react';
import {
  createBusiness,
  deleteBusiness,
  fetchBusinesses,
  updateBusiness,
} from '../services/api/businessVendorApi';
import type { Business } from '../types/businessVendor';

interface UseBusinessesReturn {
  businesses: Business[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  loadBusinesses: () => Promise<void>;
  handleSaveBusiness: (data: Partial<Business>, modalType: 'ADD_BUSINESS' | 'EDIT_BUSINESS', selectedBusiness: Business | null) => Promise<boolean>;
  handleDeleteBusiness: (selectedBusiness: Business) => Promise<boolean>;
}

export function useBusinesses(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseBusinessesReturn {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeBusinessCode = useCallback((value: unknown): string => {
    return String(value ?? '').trim().toUpperCase();
  }, []);

  const normalizeBusinessName = useCallback((value: unknown): string => {
    return String(value ?? '').trim();
  }, []);

  const normalizeBusinessOptionalText = useCallback((value: unknown): string | null => {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }, []);

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchBusinesses();
      setBusinesses(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách lĩnh vực.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const handleSaveBusiness = useCallback(async (
    data: Partial<Business>,
    modalType: 'ADD_BUSINESS' | 'EDIT_BUSINESS',
    selectedBusiness: Business | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    const payload: Partial<Business> = {
      domain_code: normalizeBusinessCode(data.domain_code),
      domain_name: normalizeBusinessName(data.domain_name),
      focal_point_name: normalizeBusinessOptionalText(data.focal_point_name),
      focal_point_phone: normalizeBusinessOptionalText(data.focal_point_phone),
      focal_point_email: normalizeBusinessOptionalText(data.focal_point_email),
    };

    try {
      if (modalType === 'ADD_BUSINESS') {
        const created = await createBusiness(payload);
        setBusinesses((prev) => [created, ...(prev || []).filter((item) => String(item.id) !== String(created.id))]);
        addToast?.('success', 'Thành công', 'Thêm mới lĩnh vực kinh doanh thành công!');
        handleCloseAndRefresh();
      } else if (modalType === 'EDIT_BUSINESS' && selectedBusiness) {
        const currentCode = normalizeBusinessCode(selectedBusiness.domain_code);
        const currentName = normalizeBusinessName(selectedBusiness.domain_name);
        const currentFocalPointName = normalizeBusinessOptionalText(selectedBusiness.focal_point_name);
        const currentFocalPointPhone = normalizeBusinessOptionalText(selectedBusiness.focal_point_phone);
        const currentFocalPointEmail = normalizeBusinessOptionalText(selectedBusiness.focal_point_email);

        if (
          payload.domain_code === currentCode &&
          payload.domain_name === currentName &&
          payload.focal_point_name === currentFocalPointName &&
          payload.focal_point_phone === currentFocalPointPhone &&
          payload.focal_point_email === currentFocalPointEmail
        ) {
          addToast?.('success', 'Thông báo', 'Không có thay đổi để cập nhật.');
          setIsSaving(false);
          return false;
        }

        const updated = await updateBusiness(selectedBusiness.id, payload);
        setBusinesses((prev) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật lĩnh vực thành công!');
        handleCloseAndRefresh();
      } else {
        setIsSaving(false);
        return false;
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu lĩnh vực vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast]);

  const handleCloseAndRefresh = async () => {
    try {
      const rows = await fetchBusinesses();
      setBusinesses(rows || []);
    } catch {
      // Keep current state if refresh fails
    }
  };

  const handleDeleteBusiness = useCallback(async (selectedBusiness: Business): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteBusiness(selectedBusiness.id);
      setBusinesses((prev) => prev.filter((item) => String(item.id) !== String(selectedBusiness.id)));
      addToast?.('success', 'Thành công', 'Đã xóa lĩnh vực kinh doanh.');
      handleCloseAndRefresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa lĩnh vực trên cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  return {
    businesses,
    isSaving,
    isLoading,
    error,
    loadBusinesses,
    handleSaveBusiness,
    handleDeleteBusiness,
  };
}
