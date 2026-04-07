import React, { useMemo, useState } from 'react';
import { Department, Employee, EmployeeStatus } from '../../types';
import { isAgeInAllowedRange } from '../../utils/ageValidation';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';
import { resolvePositionName } from '../../utils/employeeDisplay';
import { AGE_RANGE_ERROR_MESSAGE, normalizeDateInputToIso } from './dateFieldUtils';
import { FormSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export interface EmployeeFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Employee | null;
  departments?: Department[];
  onClose: () => void;
  onSave: (data: Partial<Employee>) => void;
  onResetPassword?: () => void | Promise<void>;
  isResettingPassword?: boolean;
  isLoading?: boolean;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  type,
  data,
  departments = [],
  onClose,
  onSave,
  onResetPassword,
  isResettingPassword = false,
}: EmployeeFormModalProps) => {
  const fieldLabelClassName = 'text-sm font-semibold text-slate-700';
  const fieldInputClassName = 'h-[46px] rounded-lg px-3 text-[15px] leading-6';

  const normalizeEmployeeStatusValue = (status: unknown): EmployeeStatus => {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'ACTIVE') return 'ACTIVE';
    if (normalized === 'SUSPENDED' || normalized === 'TRANSFERRED') return 'SUSPENDED';
    return 'INACTIVE';
  };

  const [formData, setFormData] = useState<Partial<Employee>>({
    id: data?.id || '',
    uuid: data?.uuid || '',
    user_code: data?.employee_code || data?.user_code || String(data?.id || ''),
    username: data?.username || '',
    full_name: data?.full_name || '',
    phone_number: data?.phone_number || data?.phone || data?.mobile || '',
    email: data?.email || '',
    job_title_raw: data?.job_title_vi || data?.job_title_raw || '',
    date_of_birth: (() => {
      const normalized = normalizeDateInputToIso(String(data?.date_of_birth || ''));
      if (!normalized) {
        return '';
      }
      const formatted = formatDateDdMmYyyy(normalized);
      return formatted === '--' ? '' : formatted;
    })(),
    gender: data?.gender || null,
    vpn_status: data?.vpn_status || 'NO',
    ip_address: data?.ip_address || '',
    status: normalizeEmployeeStatusValue(data?.status || 'ACTIVE'),
    department_id: data?.department_id || '',
    position_id: data?.position_id || '',
  });
  const [formErrors, setFormErrors] = useState<{ department_id?: string; date_of_birth?: string }>({});

  const positionOptions = useMemo(() => {
    const options = [
      { value: '1', label: 'Giám đốc' },
      { value: '2', label: 'Phó giám đốc' },
      { value: '3', label: 'Trưởng phòng' },
      { value: '4', label: 'Phó phòng' },
      { value: '5', label: 'Chuyên viên' },
    ];

    const currentValue = String(formData.position_id || '');
    if (currentValue && !options.some((option) => option.value === currentValue)) {
      options.unshift({ value: currentValue, label: resolvePositionName(data || { position_id: currentValue }) });
    }

    return [{ value: '', label: 'Chọn chức vụ' }, ...options];
  }, [formData.position_id, data?.position_name]);

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới nhân sự' : 'Cập nhật nhân sự'} icon="person_add" width="max-w-2xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput
          label="Mã nhân viên"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          value={String(formData.user_code || '')}
          onChange={(e: any) => setFormData({ ...formData, user_code: e.target.value })}
          placeholder="VNPT022327 / CTV091020"
          required
        />
        <FormInput label="Tên đăng nhập" labelClassName={fieldLabelClassName} inputClassName={fieldInputClassName} value={formData.username} onChange={(e: any) => setFormData({ ...formData, username: e.target.value })} placeholder="nguyenvana" required />
        <FormInput label="Họ và tên" labelClassName={fieldLabelClassName} inputClassName={fieldInputClassName} value={formData.full_name} onChange={(e: any) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Nguyễn Văn A" required />
        <FormInput
          label="Số điện thoại"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          value={String(formData.phone_number || '')}
          onChange={(e: any) => setFormData({ ...formData, phone_number: e.target.value })}
          placeholder="0912345678"
        />
        <FormInput label="Email" labelClassName={fieldLabelClassName} inputClassName={fieldInputClassName} value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} placeholder="email@vnpt.vn" required />
        <FormSelect
          label="Phòng ban tham chiếu"
          labelClassName={fieldLabelClassName}
          value={String(formData.department_id || '')}
          onChange={(e: any) => {
            setFormData({ ...formData, department_id: e.target.value });
            if (formErrors.department_id) {
              setFormErrors((prev) => ({ ...prev, department_id: undefined }));
            }
          }}
          options={[{ value: '', label: 'Chọn phòng ban' }, ...departments.map((department) => ({ value: String(department.id), label: `${department.dept_code} - ${department.dept_name}` }))]}
          required
          error={formErrors.department_id}
        />
        <FormSelect label="Chức vụ" labelClassName={fieldLabelClassName} value={String(formData.position_id || '')} onChange={(e: any) => setFormData({ ...formData, position_id: e.target.value })} options={positionOptions} required />
        <FormInput label="Chức danh" labelClassName={fieldLabelClassName} inputClassName={fieldInputClassName} value={formData.job_title_raw} onChange={(e: any) => setFormData({ ...formData, job_title_raw: e.target.value })} placeholder="Chuyên viên kinh doanh" />
        <FormInput
          label="Ngày sinh"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          type="text"
          value={formData.date_of_birth}
          onChange={(e: any) => {
            setFormData({ ...formData, date_of_birth: e.target.value || '' });
            if (formErrors.date_of_birth) {
              setFormErrors((prev) => ({ ...prev, date_of_birth: undefined }));
            }
          }}
          placeholder="dd/mm/yyyy"
          error={formErrors.date_of_birth}
        />
        <FormSelect
          label="Giới tính"
          labelClassName={fieldLabelClassName}
          value={formData.gender || ''}
          onChange={(e: any) => setFormData({ ...formData, gender: e.target.value || null })}
          options={[
            { value: '', label: 'Chọn giới tính' },
            { value: 'MALE', label: 'Nam' },
            { value: 'FEMALE', label: 'Nữ' },
            { value: 'OTHER', label: 'Khác' },
          ]}
        />
        <FormSelect
          label="Trạng thái VPN"
          labelClassName={fieldLabelClassName}
          value={formData.vpn_status || 'NO'}
          onChange={(e: any) => setFormData({ ...formData, vpn_status: e.target.value })}
          options={[
            { value: 'YES', label: 'Có' },
            { value: 'NO', label: 'Không' },
          ]}
        />
        <FormInput
          label="Địa chỉ IP"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          value={formData.ip_address}
          onChange={(e: any) => setFormData({ ...formData, ip_address: e.target.value })}
          placeholder="192.168.1.10"
          disabled={type === 'EDIT'}
        />

        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
          <FormSelect
            label="Trạng thái"
            labelClassName={fieldLabelClassName}
            value={formData.status}
            onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'INACTIVE', label: 'Không hoạt động' },
              { value: 'SUSPENDED', label: 'Luân chuyển' },
            ]}
          />
          <div></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Hủy</button>
        {type === 'EDIT' && onResetPassword ? (
          <button
            type="button"
            onClick={() => {
              void onResetPassword();
            }}
            disabled={isResettingPassword}
            className="px-4 py-2 rounded-lg border border-amber-300 text-amber-800 font-medium hover:bg-amber-50 disabled:opacity-60"
          >
            {isResettingPassword ? 'Đang reset...' : 'Reset mật khẩu'}
          </button>
        ) : null}
        <button
          onClick={() => {
            const nextErrors: { department_id?: string; date_of_birth?: string } = {};

            if (!String(formData.department_id || '').trim()) {
              nextErrors.department_id = 'Nhân sự bắt buộc thuộc một phòng ban.';
            }

            const normalizedDateOfBirth = normalizeDateInputToIso(String(formData.date_of_birth || ''));
            if (formData.date_of_birth && !normalizedDateOfBirth) {
              nextErrors.date_of_birth = 'Ngày sinh không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
            } else if (normalizedDateOfBirth && !isAgeInAllowedRange(normalizedDateOfBirth)) {
              nextErrors.date_of_birth = AGE_RANGE_ERROR_MESSAGE;
            }

            if (Object.keys(nextErrors).length > 0) {
              setFormErrors(nextErrors);
              return;
            }

            onSave({
              ...formData,
              date_of_birth: normalizedDateOfBirth,
              phone_number: String(formData.phone_number || '').trim() || null,
            });
          }}
          className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20"
        >
          {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
