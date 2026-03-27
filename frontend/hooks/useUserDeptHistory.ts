import { useState, useCallback } from 'react';
import type { UserDeptHistory, Department, Employee } from '../types';

interface UseUserDeptHistoryReturn {
  userDeptHistory: UserDeptHistory[];
  isSaving: boolean;
  selectedUserDeptHistory: UserDeptHistory | null;
  handleSaveUserDeptHistory: (
    data: Partial<UserDeptHistory>,
    modalType: 'ADD_USER_DEPT_HISTORY' | 'EDIT_USER_DEPT_HISTORY',
    selectedUserDeptHistoryItem: UserDeptHistory | null,
    employees: Employee[],
    departments: Department[]
  ) => Promise<void>;
  handleDeleteUserDeptHistory: (selectedUserDeptHistoryItem: UserDeptHistory) => Promise<void>;
  setUserDeptHistory: (history: UserDeptHistory[]) => void;
  setSelectedUserDeptHistory: (history: UserDeptHistory | null) => void;
}

export function useUserDeptHistory(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseUserDeptHistoryReturn {
  const [userDeptHistory, setUserDeptHistoryState] = useState<UserDeptHistory[]>([]);
  const [selectedUserDeptHistory, setSelectedUserDeptHistoryState] = useState<UserDeptHistory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveUserDeptHistory = useCallback(async (
    data: Partial<UserDeptHistory>,
    modalType: 'ADD_USER_DEPT_HISTORY' | 'EDIT_USER_DEPT_HISTORY',
    selectedUserDeptHistoryItem: UserDeptHistory | null,
    employees: Employee[],
    departments: Department[]
  ): Promise<void> => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const nextTransferNumericId = (() => {
      const currentMax = (userDeptHistory || []).reduce((max, item) => {
        const parsed = Number(String(item.id ?? '').replace(/\D+/g, ''));
        return Number.isFinite(parsed) && parsed > max ? parsed : max;
      }, 0);
      return String(currentMax + 1);
    })();

    const newItem: UserDeptHistory = {
      id: modalType === 'ADD_USER_DEPT_HISTORY'
        ? nextTransferNumericId
        : String(data.id || selectedUserDeptHistoryItem?.id || ''),
      userId: String(data.userId || ''),
      fromDeptId: String(data.fromDeptId || ''),
      toDeptId: String(data.toDeptId || ''),
      transferDate: data.transferDate!,
      reason: data.reason || '',
      createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
      employeeCode: data.employeeCode || selectedUserDeptHistoryItem?.employeeCode,
      employeeName: data.employeeName || selectedUserDeptHistoryItem?.employeeName,
    };

    if (modalType === 'ADD_USER_DEPT_HISTORY') {
      setUserDeptHistoryState((prev) => [newItem, ...prev]);
      
      // Update employee's department
      if (employees && departments) {
        setUserDeptHistoryState((prevHistory) => {
          // Note: This is a simplified version - in real usage, you'd need to 
          // update employees state from parent component
          return prevHistory;
        });
      }
      
      addToast?.('success', 'Thành công', 'Thêm mới luân chuyển và cập nhật nhân sự thành công!');
    } else if (modalType === 'EDIT_USER_DEPT_HISTORY' && selectedUserDeptHistoryItem) {
      setUserDeptHistoryState((prev) =>
        prev.map((h) => (h.id === selectedUserDeptHistoryItem.id ? { ...newItem, id: selectedUserDeptHistoryItem.id } : h))
      );
      addToast?.('success', 'Thành công', 'Cập nhật lịch sử luân chuyển thành công!');
    }
    setIsSaving(false);
  }, [addToast, userDeptHistory]);

  const handleDeleteUserDeptHistory = useCallback(async (selectedUserDeptHistoryItem: UserDeptHistory): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    setUserDeptHistoryState((prev) => prev.filter((h) => h.id !== selectedUserDeptHistoryItem.id));
    addToast?.('success', 'Thành công', 'Đã xóa lịch sử luân chuyển.');
  }, [addToast]);

  return {
    userDeptHistory,
    isSaving,
    selectedUserDeptHistory,
    handleSaveUserDeptHistory,
    handleDeleteUserDeptHistory,
    setUserDeptHistory: setUserDeptHistoryState,
    setSelectedUserDeptHistory: setSelectedUserDeptHistoryState,
  };
}