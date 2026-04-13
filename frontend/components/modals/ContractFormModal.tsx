import React, { useState } from 'react';
import type { Contract, Customer, Project } from '../../types';
import { CONTRACT_STATUSES } from '../../constants';
import { useModalShortcuts } from '../../hooks/useModalShortcuts';
import { FormSelect, SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export interface ContractFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  projects: Project[];
  customers: Customer[];
  onClose: () => void;
  onSave: (data: Partial<Contract>) => void;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({
  type,
  data,
  projects,
  customers,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Contract>>({
    contract_code: data?.contract_code || data?.contract_number || '',
    contract_name: data?.contract_name || '',
    customer_id: data?.customer_id || '',
    project_id: data?.project_id || '',
    value: data?.value || data?.total_value || 0,
    status: data?.status || 'DRAFT',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    if (typeof num === 'string') return num;
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const parseNumber = (str: string | number) => {
    if (typeof str === 'number') return str;
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(normalized) || 0;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contract_code) newErrors.contract_code = 'Mã hợp đồng là bắt buộc';
    if (!formData.contract_name) newErrors.contract_name = 'Tên hợp đồng là bắt buộc';
    if (!formData.customer_id) newErrors.customer_id = 'Vui lòng chọn Khách hàng';
    if (!formData.project_id) newErrors.project_id = 'Vui lòng chọn Dự án';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    onSave({
      ...formData,
      value: typeof formData.value === 'string' ? parseNumber(formData.value) : formData.value,
    });
  };

  useModalShortcuts({ onSave: handleSubmit });

  const handleChange = (field: keyof Contract, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'project_id') {
        const project = projects.find((candidate) => candidate.id === value);
        if (project) {
          const total = (project.items || []).reduce((sum, item) => sum + (item.lineTotal || 0), 0);
          if (total > 0) {
            updated.value = total;
          }
          if (!updated.customer_id) {
            updated.customer_id = project.customer_id;
          }
        }
      }

      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm mới Hợp đồng' : 'Cập nhật Hợp đồng'}
      icon="description"
      width="max-w-lg"
    >
      <div className="p-6 space-y-5">
        <FormInput
          label="Mã hợp đồng"
          value={formData.contract_code}
          onChange={(event: any) => handleChange('contract_code', event.target.value)}
          placeholder="HD-2024-001"
          required
          error={errors.contract_code}
        />

        <FormInput
          label="Tên hợp đồng"
          value={formData.contract_name}
          onChange={(event: any) => handleChange('contract_name', event.target.value)}
          placeholder="Hợp đồng triển khai giải pháp..."
          required
          error={errors.contract_name}
        />

        <div className="col-span-1">
          <SearchableSelect
            label="Khách hàng"
            required
            options={customers.map((customer) => ({
              value: String(customer.id),
              label: `${customer.customer_code} - ${customer.customer_name}`,
            }))}
            value={formData.customer_id ? String(formData.customer_id) : ''}
            onChange={(value) => handleChange('customer_id', value)}
            error={errors.customer_id}
            placeholder="Chọn khách hàng"
          />
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Dự án liên kết"
            required
            options={(projects || [])
              .filter((project) => !formData.customer_id || String(project.customer_id) === String(formData.customer_id))
              .map((project) => ({
                value: String(project.id),
                label: `${project.project_code} - ${project.project_name}`,
              }))}
            value={formData.project_id ? String(formData.project_id) : ''}
            onChange={(value) => handleChange('project_id', value)}
            error={errors.project_id}
            placeholder="Chọn dự án"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Giá trị hợp đồng (VNĐ)</label>
          <div className="relative">
            <input
              type="text"
              value={formatNumber(formData.value)}
              onChange={(event) => handleChange('value', event.target.value)}
              onBlur={() => {
                const parsed = parseNumber(formData.value as any);
                setFormData((prev) => ({ ...prev, value: parsed }));
              }}
              placeholder="0"
              className="w-full h-11 pl-4 pr-10 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">
              ₫
            </div>
          </div>
        </div>

        <FormSelect
          label="Trạng thái"
          value={formData.status}
          onChange={(event: any) => handleChange('status', event.target.value)}
          options={CONTRACT_STATUSES}
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">check</span>
          {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
