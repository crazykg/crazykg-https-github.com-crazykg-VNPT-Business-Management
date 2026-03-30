import React, { useState } from 'react';
import { Employee, Reminder } from '../../types';
import { getEmployeeLabel } from '../../utils/employeeDisplay';
import { SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export interface ReminderFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Reminder | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (data: Partial<Reminder>) => void;
}

export const ReminderFormModal: React.FC<ReminderFormModalProps> = ({
  type,
  data,
  employees,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Reminder>>({
    id: data?.id || '',
    title: data?.title || '',
    content: data?.content || '',
    remindDate: data?.remindDate || '',
    assignedToUserId: data?.assignedToUserId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.title) nextErrors.title = 'Tiêu đề là bắt buộc';
    if (!formData.remindDate) nextErrors.remindDate = 'Ngày nhắc là bắt buộc';
    if (!formData.assignedToUserId) nextErrors.assignedToUserId = 'Vui lòng chọn người được giao';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof Reminder, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm nhắc việc' : 'Cập nhật nhắc việc'}
      icon="notifications_active"
      width="max-w-lg"
    >
      <div className="space-y-5 p-6">
        <FormInput
          label="Tiêu đề nhắc việc"
          value={formData.title}
          onChange={(e: any) => handleChange('title', e.target.value)}
          placeholder="Nhập tiêu đề..."
          required
          error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Nội dung</label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={formData.content}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder="Chi tiết công việc cần làm..."
          />
        </div>

        <FormInput
          label="Ngày nhắc"
          type="date"
          value={formData.remindDate}
          onChange={(e: any) => handleChange('remindDate', e.target.value)}
          required
          error={errors.remindDate}
        />

        <SearchableSelect
          label="Người được giao"
          required
          options={employees.map((employee) => ({ value: String(employee.id), label: getEmployeeLabel(employee) }))}
          value={formData.assignedToUserId || ''}
          onChange={(value) => handleChange('assignedToUserId', value)}
          error={errors.assignedToUserId}
          placeholder="Chọn nhân viên"
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100">Hủy</button>
        <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-deep-teal">
          <span className="material-symbols-outlined text-lg">check</span>
          {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
