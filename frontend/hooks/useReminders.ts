import { useState, useCallback } from 'react';
import type { Reminder } from '../types';

interface UseRemindersReturn {
  reminders: Reminder[];
  isSaving: boolean;
  selectedReminder: Reminder | null;
  handleSaveReminder: (data: Partial<Reminder>, modalType: 'ADD_REMINDER' | 'EDIT_REMINDER', selectedReminderItem: Reminder | null) => Promise<void>;
  handleDeleteReminder: (selectedReminderItem: Reminder) => Promise<void>;
  setReminders: (reminders: Reminder[]) => void;
  setSelectedReminder: (reminder: Reminder | null) => void;
}

export function useReminders(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseRemindersReturn {
  const [reminders, setRemindersState] = useState<Reminder[]>([]);
  const [selectedReminder, setSelectedReminderState] = useState<Reminder | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveReminder = useCallback(async (
    data: Partial<Reminder>,
    modalType: 'ADD_REMINDER' | 'EDIT_REMINDER',
    selectedReminderItem: Reminder | null
  ): Promise<void> => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newItem: Reminder = {
      id: data.id || `REM${Date.now()}`,
      title: data.title!,
      content: data.content || '',
      remindDate: data.remindDate!,
      assignedToUserId: data.assignedToUserId!,
      createdDate: data.createdDate || new Date().toLocaleDateString('vi-VN'),
    };

    if (modalType === 'ADD_REMINDER') {
      setRemindersState((prev) => [newItem, ...prev]);
      addToast?.('success', 'Thành công', 'Thêm mới nhắc việc thành công!');
    } else if (modalType === 'EDIT_REMINDER' && selectedReminderItem) {
      setRemindersState((prev) =>
        prev.map((r) => (r.id === selectedReminderItem.id ? { ...newItem, id: selectedReminderItem.id } : r))
      );
      addToast?.('success', 'Thành công', 'Cập nhật nhắc việc thành công!');
    }
    setIsSaving(false);
  }, [addToast]);

  const handleDeleteReminder = useCallback(async (selectedReminderItem: Reminder): Promise<void> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRemindersState((prev) => prev.filter((r) => r.id !== selectedReminderItem.id));
    addToast?.('success', 'Thành công', 'Đã xóa nhắc việc.');
  }, [addToast]);

  return {
    reminders,
    isSaving,
    selectedReminder,
    handleSaveReminder,
    handleDeleteReminder,
    setReminders: setRemindersState,
    setSelectedReminder: setSelectedReminderState,
  };
}