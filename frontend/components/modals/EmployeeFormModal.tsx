import React, { useMemo, useState } from 'react';
import { Department, Employee, EmployeeStatus } from '../../types';
import { isAgeInAllowedRange } from '../../utils/ageValidation';
import { formatDateDdMmYyyy } from '../../utils/dateDisplay';
import { resolvePositionName } from '../../utils/employeeDisplay';
import { AGE_RANGE_ERROR_MESSAGE, normalizeDateInputToIso } from './dateFieldUtils';
import { FormSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;
type EmployeeFormErrors = {
  department_id?: string;
  date_of_birth?: string;
  leave_date?: string;
  email?: string;
  gmail?: string;
};

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
  const fieldLabelClassName = 'text-xs font-semibold text-neutral';
  const fieldInputClassName = 'h-8 rounded px-3 text-xs leading-5';

  const formatFormDateValue = (value: string | null | undefined): string => {
    const normalized = normalizeDateInputToIso(String(value || ''));
    if (!normalized) {
      return '';
    }
    const formatted = formatDateDdMmYyyy(normalized);
    return formatted === '--' ? '' : formatted;
  };

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
    gmail: data?.gmail || '',
    job_title_raw: data?.job_title_vi || data?.job_title_raw || '',
    date_of_birth: formatFormDateValue(data?.date_of_birth || ''),
    leave_date: formatFormDateValue(data?.leave_date || ''),
    gender: data?.gender || null,
    vpn_status: data?.vpn_status || 'NO',
    ip_address: data?.ip_address || '',
    status: normalizeEmployeeStatusValue(data?.status || 'ACTIVE'),
    department_id: data?.department_id || '',
    position_id: data?.position_id || '',
  });
  const [formErrors, setFormErrors] = useState<EmployeeFormErrors>({});
  const isInactiveStatus = formData.status === 'INACTIVE';

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
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
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
        <FormInput
          label="VNPT Mail"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          type="email"
          value={formData.email}
          onChange={(e: any) => {
            setFormData({ ...formData, email: e.target.value });
            if (formErrors.email) {
              setFormErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          placeholder="email@vnpt.vn"
          required
          error={formErrors.email}
        />
        <FormInput
          label="Gmail"
          labelClassName={fieldLabelClassName}
          inputClassName={fieldInputClassName}
          type="email"
          value={formData.gmail}
          onChange={(e: any) => {
            setFormData({ ...formData, gmail: e.target.value });
            if (formErrors.gmail) {
              setFormErrors((prev) => ({ ...prev, gmail: undefined }));
            }
          }}
          placeholder="email@gmail.com"
          error={formErrors.gmail}
        />
        <FormSelect
          label="Phòng ban tham chiếu"
          labelClassName={fieldLabelClassName}
          size="sm"
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
        <FormSelect label="Chức vụ" labelClassName={fieldLabelClassName} size="sm" value={String(formData.position_id || '')} onChange={(e: any) => setFormData({ ...formData, position_id: e.target.value })} options={positionOptions} required />
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
          size="sm"
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
          size="sm"
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
        <FormSelect
          label="Trạng thái"
          labelClassName={fieldLabelClassName}
          size="sm"
          value={formData.status}
          onChange={(e: any) => {
            const nextStatus = normalizeEmployeeStatusValue(e.target.value);
            setFormData((prev) => ({
              ...prev,
              status: nextStatus,
              leave_date: nextStatus === 'INACTIVE' ? prev.leave_date || '' : '',
            }));
            if (formErrors.leave_date) {
              setFormErrors((prev) => ({ ...prev, leave_date: undefined }));
            }
          }}
          options={[
            { value: 'ACTIVE', label: 'Hoạt động' },
            { value: 'INACTIVE', label: 'Nghỉ việc' },
            { value: 'SUSPENDED', label: 'Luân chuyển' },
          ]}
        />
        {isInactiveStatus ? (
          <FormInput
            label="Ngày nghỉ việc"
            labelClassName={fieldLabelClassName}
            inputClassName={fieldInputClassName}
            type="text"
            value={String(formData.leave_date || '')}
            onChange={(e: any) => {
              setFormData({ ...formData, leave_date: e.target.value || '' });
              if (formErrors.leave_date) {
                setFormErrors((prev) => ({ ...prev, leave_date: undefined }));
              }
            }}
            placeholder="dd/mm/yyyy"
            required
            error={formErrors.leave_date}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Hủy</button>
        {type === 'EDIT' && onResetPassword ? (
          <button
            type="button"
            onClick={() => {
              void onResetPassword();
            }}
            disabled={isResettingPassword}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-tertiary/30 text-tertiary bg-white hover:bg-tertiary/5 disabled:opacity-50"
          >
            {isResettingPassword ? 'Đang reset...' : 'Reset mật khẩu'}
          </button>
        ) : null}
        <button
          onClick={() => {
            const nextErrors: EmployeeFormErrors = {};

            if (!String(formData.department_id || '').trim()) {
              nextErrors.department_id = 'Nhân sự bắt buộc thuộc một phòng ban.';
            }

            const normalizedEmail = String(formData.email || '').trim();
            if (!normalizedEmail) {
              nextErrors.email = 'VNPT Mail là bắt buộc.';
            } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
              nextErrors.email = 'VNPT Mail không hợp lệ.';
            }

            const normalizedGmail = String(formData.gmail || '').trim();
            if (normalizedGmail && !GMAIL_PATTERN.test(normalizedGmail)) {
              nextErrors.gmail = 'Gmail phải có định dạng @gmail.com.';
            }

            const normalizedDateOfBirth = normalizeDateInputToIso(String(formData.date_of_birth || ''));
            if (formData.date_of_birth && !normalizedDateOfBirth) {
              nextErrors.date_of_birth = 'Ngày sinh không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
            } else if (normalizedDateOfBirth && !isAgeInAllowedRange(normalizedDateOfBirth)) {
              nextErrors.date_of_birth = AGE_RANGE_ERROR_MESSAGE;
            }

            const normalizedLeaveDate = isInactiveStatus
              ? normalizeDateInputToIso(String(formData.leave_date || ''))
              : null;
            if (isInactiveStatus && !String(formData.leave_date || '').trim()) {
              nextErrors.leave_date = 'Ngày nghỉ việc là bắt buộc khi chọn trạng thái Nghỉ việc.';
            } else if (isInactiveStatus && !normalizedLeaveDate) {
              nextErrors.leave_date = 'Ngày nghỉ việc không hợp lệ (dd/mm/yyyy hoặc yyyy-mm-dd).';
            }

            if (Object.keys(nextErrors).length > 0) {
              setFormErrors(nextErrors);
              return;
            }

            onSave({
              ...formData,
              date_of_birth: normalizedDateOfBirth,
              leave_date: normalizedLeaveDate,
              email: normalizedEmail,
              gmail: normalizedGmail || null,
              phone_number: String(formData.phone_number || '').trim() || null,
            });
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-sm transition-colors disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
          {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
