import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Customer, CustomerPersonnel, SupportContactPosition } from '../../types';
import { isAgeInAllowedRange } from '../../utils/ageValidation';
import { AGE_RANGE_ERROR_MESSAGE, normalizeDateInputToIso } from './dateFieldUtils';
import { SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export interface CusPersonnelFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: CustomerPersonnel | null;
  customers: Customer[];
  supportContactPositions: SupportContactPosition[];
  isCustomersLoading?: boolean;
  isSupportContactPositionsLoading?: boolean;
  onClose: () => void;
  onSave: (data: Partial<CustomerPersonnel>) => Promise<void>;
}

export const CusPersonnelFormModal: React.FC<CusPersonnelFormModalProps> = ({
  type,
  data,
  customers,
  supportContactPositions,
  isCustomersLoading = false,
  isSupportContactPositionsLoading = false,
  onClose,
  onSave,
}) => {
  const normalizePositionCode = (value: unknown): string => String(value || '').trim().toUpperCase();
  const normalizeCusPersonnelStatusValue = (value: unknown): 'Active' | 'Inactive' => {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'INACTIVE' ? 'Inactive' : 'Active';
  };
  const defaultPosition = (supportContactPositions || []).find((position) => position.is_active !== false) || supportContactPositions?.[0] || null;

  const [formData, setFormData] = useState<Partial<CustomerPersonnel>>({
    fullName: data?.fullName || '',
    birthday: normalizeDateInputToIso(String(data?.birthday || '')) || '',
    positionType: String(data?.positionType || defaultPosition?.position_code || ''),
    positionId: data?.positionId ?? (defaultPosition?.id ?? null),
    positionLabel: data?.positionLabel || String(defaultPosition?.position_name || defaultPosition?.position_code || ''),
    phoneNumber: data?.phoneNumber || '',
    email: data?.email || '',
    customerId: data?.customerId || '',
    status: normalizeCusPersonnelStatusValue(data?.status || 'Active'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const positionOptions = useMemo(() => {
    const options = (supportContactPositions || []).map((position) => ({
      value: String(position.id || ''),
      label: String(position.position_name || position.position_code || ''),
      id: String(position.id || ''),
      code: String(position.position_code || ''),
    }));

    const currentId = String(formData.positionId ?? '').trim();
    if (currentId && !options.some((option) => option.value === currentId)) {
      const fallbackCode = String(formData.positionType || '').trim();
      options.unshift({
        value: currentId,
        label: String(formData.positionLabel || data?.positionLabel || fallbackCode || `ID ${currentId}`),
        id: currentId,
        code: fallbackCode,
      });
    }

    return options;
  }, [supportContactPositions, formData.positionId, formData.positionType, formData.positionLabel, data?.positionLabel]);
  const isCustomerOptionsLoading = isCustomersLoading && customers.length === 0;
  const isPositionOptionsLoading = isSupportContactPositionsLoading && positionOptions.length === 0;

  useEffect(() => {
    if (!positionOptions.length) {
      return;
    }

    setFormData((prev) => {
      const currentId = String(prev.positionId ?? '').trim();
      const currentCode = normalizePositionCode(prev.positionType);

      let selected = currentId
        ? positionOptions.find((option) => option.id === currentId)
        : null;

      if (!selected && currentCode) {
        selected = positionOptions.find((option) => normalizePositionCode(option.code) === currentCode) || null;
      }

      if (!selected && type === 'ADD') {
        selected = positionOptions[0] || null;
      }

      if (!selected) {
        return prev;
      }

      const nextId = selected.id;
      const nextCode = String(selected.code || '').trim();
      const nextLabel = String(selected.label || '').trim();

      if (
        String(prev.positionId ?? '').trim() === nextId
        && String(prev.positionType || '').trim() === nextCode
        && String(prev.positionLabel || '').trim() === nextLabel
      ) {
        return prev;
      }

      return {
        ...prev,
        positionType: nextCode,
        positionId: nextId,
        positionLabel: nextLabel,
      };
    });
  }, [positionOptions, type]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Vui lòng nhập Họ và tên';
    if (!formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (!String(formData.positionId || '').trim()) newErrors.positionId = 'Vui lòng chọn Chức vụ';
    const normalizedBirthday = normalizeDateInputToIso(String(formData.birthday || ''));
    if (formData.birthday && !normalizedBirthday) {
      newErrors.birthday = 'Ngày sinh không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
    } else if (normalizedBirthday && !isAgeInAllowedRange(normalizedBirthday)) {
      newErrors.birthday = AGE_RANGE_ERROR_MESSAGE;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email không hợp lệ';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    const normalizedBirthday = normalizeDateInputToIso(String(formData.birthday || ''));
    const selectedPosition = positionOptions.find((option) => option.value === String(formData.positionId || ''));

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        birthday: normalizedBirthday || '',
        positionType: selectedPosition?.code || String(formData.positionType || ''),
        positionId: selectedPosition?.id ?? formData.positionId ?? null,
        positionLabel: selectedPosition?.label || formData.positionLabel || null,
        status: normalizeCusPersonnelStatusValue(formData.status || 'Active'),
      });
    } catch {
      // Parent shows the toast, modal stays open for continued editing.
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleChange = (field: keyof CustomerPersonnel, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm Nhân sự liên hệ' : 'Cập nhật Nhân sự liên hệ'}
      icon="contact_phone"
      width="max-w-3xl"
      maxHeightClass="max-h-[98vh]"
      disableClose={isSubmitting}
    >
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="col-span-2">
          <SearchableSelect
            label="Khách hàng"
            required
            options={customers.map((customer) => ({ value: String(customer.id), label: `${customer.customer_code} - ${customer.customer_name}` }))}
            value={formData.customerId || ''}
            onChange={(value) => handleChange('customerId', value)}
            error={errors.customerId}
            placeholder={isCustomerOptionsLoading ? 'Đang tải khách hàng...' : 'Chọn khách hàng'}
            disabled={isCustomerOptionsLoading}
            usePortal
          />
          {isCustomerOptionsLoading && <p className="mt-1 text-xs text-slate-500">Danh mục khách hàng đang được nạp cho biểu mẫu này.</p>}
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            placeholder="Nhập họ và tên"
            className={`w-full h-11 px-4 rounded-lg border ${errors.fullName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>

        <div className="col-span-1">
          <FormInput
            label="Ngày sinh"
            type="date"
            value={formData.birthday || ''}
            onChange={(e: any) => handleChange('birthday', e.target.value)}
            error={errors.birthday}
          />
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Chức vụ"
            required
            options={positionOptions.map((position) => ({ value: position.value, label: position.label }))}
            value={String(formData.positionId || '')}
            onChange={(value) => {
              const selectedPosition = positionOptions.find((option) => option.value === String(value || ''));
              handleChange('positionId', selectedPosition?.id ?? null);
              handleChange('positionType', selectedPosition?.code || '');
              handleChange('positionLabel', selectedPosition?.label ?? null);
            }}
            error={errors.positionId}
            placeholder={isPositionOptionsLoading ? 'Đang tải chức vụ...' : 'Chọn chức vụ'}
            disabled={isPositionOptionsLoading}
            usePortal
          />
          {isPositionOptionsLoading && <p className="mt-1 text-xs text-slate-500">Danh mục chức vụ liên hệ đang được tải.</p>}
        </div>

        <div className="col-span-1">
          <SearchableSelect
            label="Trạng thái"
            options={[
              { value: 'Active', label: 'Hoạt động' },
              { value: 'Inactive', label: 'Không hoạt động' },
            ]}
            value={String(formData.status || 'Active')}
            onChange={(value) => handleChange('status', normalizeCusPersonnelStatusValue(value))}
            placeholder="Chọn trạng thái"
            usePortal
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại</label>
          <input
            type="tel"
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            placeholder="091xxxxxxx"
            value={formData.phoneNumber || ''}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
          <input
            type="email"
            className={`w-full h-11 px-4 rounded-lg border ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
            placeholder="example@domain.com"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-lg ${isSubmitting ? 'animate-spin' : ''}`}>
            {isSubmitting ? 'progress_activity' : 'check'}
          </span>
          {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
