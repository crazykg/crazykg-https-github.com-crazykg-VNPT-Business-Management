import React, { useMemo, useState } from 'react';
import { Building2, IdCard, Mail, ShieldCheck } from 'lucide-react';
import type { Department, Employee, EmployeePartyProfile } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { ModalWrapper } from './Modals';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { getEmployeeCode, resolvePositionName } from '../utils/employeeDisplay';

interface EmployeePartyProfileModalProps {
  type: 'ADD' | 'EDIT';
  data?: EmployeePartyProfile | null;
  employees: Employee[];
  departments: Department[];
  existingProfiles?: EmployeePartyProfile[];
  onClose: () => void;
  onSave: (payload: Partial<EmployeePartyProfile>) => void;
}

type FormState = {
  employee_id: string;
  party_card_number: string;
  ethnicity: string;
  religion: string;
  hometown: string;
  professional_qualification: string;
  political_theory_level: string;
  notes: string;
};

const FieldShell: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required = false, error, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-semibold text-slate-700">
      {label}
      {required ? <span className="text-error ml-1">*</span> : null}
    </span>
    {children}
    {error ? <span className="block text-[11px] font-medium text-error">{error}</span> : null}
  </label>
);

const inputClassName =
  'h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-50 disabled:text-slate-500';

const textareaClassName =
  'min-h-[80px] w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-50 disabled:text-slate-500';

const readonlyInfoClassName =
  'flex flex-col justify-between rounded-lg border border-slate-100 bg-surface-container p-3';

export const EmployeePartyProfileModal: React.FC<EmployeePartyProfileModalProps> = ({
  type,
  data,
  employees,
  departments,
  existingProfiles = [],
  onClose,
  onSave,
}: EmployeePartyProfileModalProps) => {
  const [formData, setFormData] = useState<FormState>({
    employee_id: String(data?.employee?.id ?? data?.employee_id ?? ''),
    party_card_number: data?.party_card_number ?? '',
    ethnicity: data?.ethnicity ?? '',
    religion: data?.religion ?? '',
    hometown: data?.hometown ?? '',
    professional_qualification: data?.professional_qualification ?? '',
    political_theory_level: data?.political_theory_level ?? '',
    notes: data?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((left, right) =>
          `${getEmployeeCode(left)} ${left.full_name}`.localeCompare(
            `${getEmployeeCode(right)} ${right.full_name}`,
            'vi'
          )
        )
        .map((employee) => ({
          value: String(employee.id),
          label: `${getEmployeeCode(employee)} - ${employee.full_name}`,
          searchText: `${getEmployeeCode(employee)} ${employee.username} ${employee.full_name} ${employee.email}`,
        })),
    [employees]
  );

  const selectedEmployee = useMemo(() => {
    const matched = employees.find((employee) => String(employee.id) === String(formData.employee_id));
    if (matched) {
      return matched;
    }
    return data?.employee ?? null;
  }, [data?.employee, employees, formData.employee_id]);

  const getDepartmentLabel = (employee: Employee | null | undefined): string => {
    if (!employee) return '--';
    if (employee.department && typeof employee.department === 'object') {
      const department = employee.department as { dept_code?: string; dept_name?: string };
      const code = String(department.dept_code || '').trim();
      const name = String(department.dept_name || '').trim();
      if (code || name) {
        return [code, name].filter(Boolean).join(' - ');
      }
    }
    const department = departments.find((item) => String(item.id) === String(employee.department_id));
    if (department) {
      return `${department.dept_code} - ${department.dept_name}`;
    }
    return '--';
  };

  const duplicatePartyCardProfile = useMemo(() => {
    const normalized = formData.party_card_number.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    return existingProfiles.find((profile) => {
      if (String(profile.id) === String(data?.id || '')) {
        return false;
      }
      return String(profile.party_card_number || '').trim().toUpperCase() === normalized;
    }) || null;
  }, [data?.id, existingProfiles, formData.party_card_number]);

  const duplicateProfileLabel = useMemo(() => {
    if (!duplicatePartyCardProfile) {
      return '';
    }

    if (duplicatePartyCardProfile.employee?.full_name) {
      return duplicatePartyCardProfile.employee.full_name;
    }

    return String(duplicatePartyCardProfile.employee_id || 'hồ sơ khác');
  }, [duplicatePartyCardProfile]);

  const employeeSnapshot = useMemo(
    () => [
      {
        label: 'Mã NV',
        value: selectedEmployee ? getEmployeeCode(selectedEmployee) : '--',
        icon: <IdCard className="h-4 w-4" />,
      },
      {
        label: 'Chức vụ',
        value: selectedEmployee ? resolvePositionName(selectedEmployee) : '--',
        icon: <ShieldCheck className="h-4 w-4" />,
      },
      {
        label: 'Email',
        value: selectedEmployee?.email || '--',
        icon: <Mail className="h-4 w-4" />,
      },
      {
        label: 'Đơn vị',
        value: getDepartmentLabel(selectedEmployee),
        icon: <Building2 className="h-4 w-4" />,
      },
    ],
    [selectedEmployee]
  );

  const handleSave = () => {
    const nextErrors: Record<string, string> = {};

    if (!String(formData.employee_id || '').trim()) {
      nextErrors.employee_id = 'Vui lòng chọn nhân sự theo Mã NV.';
    }

    if (!selectedEmployee) {
      nextErrors.employee_id = 'Không tìm thấy nhân sự nội bộ tương ứng.';
    }

    if (duplicatePartyCardProfile) {
      nextErrors.party_card_number = 'Số thẻ Đảng đã tồn tại trên một hồ sơ khác.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      id: data?.id,
      employee_id: formData.employee_id,
      party_card_number: formData.party_card_number.trim() || null,
      ethnicity: formData.ethnicity.trim() || null,
      religion: formData.religion.trim() || null,
      hometown: formData.hometown.trim() || null,
      professional_qualification: formData.professional_qualification.trim() || null,
      political_theory_level: formData.political_theory_level.trim() || null,
      notes: formData.notes.trim() || null,
      employee: selectedEmployee || undefined,
    });
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm hồ sơ Đảng viên' : 'Cập nhật hồ sơ Đảng viên'}
      icon="badge"
      width="max-w-5xl"
    >
      <div className="space-y-3 p-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldShell label="Mã nhân viên" required error={errors.employee_id}>
                <SearchableSelect
                  value={formData.employee_id}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, employee_id: value }));
                    if (errors.employee_id) {
                      setErrors((prev) => ({ ...prev, employee_id: '' }));
                    }
                  }}
                  options={employeeOptions}
                  placeholder="Chọn Mã NV - Họ tên"
                  searchPlaceholder="Tìm theo mã, tên đăng nhập, họ tên"
                  disabled={type === 'EDIT'}
                  triggerClassName="h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  usePortal
                  portalZIndex={2100}
                />
              </FieldShell>
              <FieldShell label="Họ và tên">
                <input className={inputClassName} value={selectedEmployee?.full_name || ''} disabled />
              </FieldShell>
              <FieldShell label="Ngày sinh">
                <input
                  className={inputClassName}
                  value={formatDateDdMmYyyy(selectedEmployee?.date_of_birth || null)}
                  disabled
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {employeeSnapshot.map((item) => (
                <div key={item.label} className={readonlyInfoClassName}>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-secondary/15 text-secondary shrink-0">
                      {item.icon}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral">{item.label}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{item.value || '--'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="space-y-3">
              {duplicatePartyCardProfile ? (
                <div className="rounded border border-tertiary/20 bg-tertiary-fixed px-3 py-2 text-xs leading-5 text-tertiary">
                  Số thẻ này đang trùng với hồ sơ của{' '}
                  <span className="font-bold">{duplicateProfileLabel}</span>
                  . Vui lòng kiểm tra lại trước khi lưu.
                </div>
              ) : null}

              <FieldShell label="Số thẻ Đảng" error={errors.party_card_number}>
                <input
                  className={inputClassName}
                  value={formData.party_card_number}
                  onChange={(event) => {
                    setFormData((prev) => ({ ...prev, party_card_number: event.target.value }));
                    if (errors.party_card_number) {
                      setErrors((prev) => ({ ...prev, party_card_number: '' }));
                    }
                  }}
                  placeholder="093066006328"
                />
              </FieldShell>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldShell label="Dân tộc">
                <input
                  className={inputClassName}
                  value={formData.ethnicity}
                  onChange={(event) => setFormData((prev) => ({ ...prev, ethnicity: event.target.value }))}
                  placeholder="Kinh"
                />
              </FieldShell>

              <FieldShell label="Tôn giáo">
                <input
                  className={inputClassName}
                  value={formData.religion}
                  onChange={(event) => setFormData((prev) => ({ ...prev, religion: event.target.value }))}
                  placeholder="Không"
                />
              </FieldShell>

              <FieldShell label="Quê quán">
                <input
                  className={inputClassName}
                  value={formData.hometown}
                  onChange={(event) => setFormData((prev) => ({ ...prev, hometown: event.target.value }))}
                  placeholder="Xã..., Huyện..., Tỉnh..."
                />
              </FieldShell>

              <FieldShell label="Trình độ chuyên môn">
                <input
                  className={inputClassName}
                  value={formData.professional_qualification}
                  onChange={(event) => setFormData((prev) => ({ ...prev, professional_qualification: event.target.value }))}
                  placeholder="Kỹ sư CNTT"
                />
              </FieldShell>

              <FieldShell label="LLCT">
                <input
                  className={inputClassName}
                  value={formData.political_theory_level}
                  onChange={(event) => setFormData((prev) => ({ ...prev, political_theory_level: event.target.value }))}
                  placeholder="Trung cấp"
                />
              </FieldShell>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <FieldShell label="Ghi chú">
            <textarea
              aria-label="Lưu ý hồ sơ Đảng viên"
              className={textareaClassName}
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Bổ sung lưu ý hồ sơ, tình trạng giấy tờ hoặc phần cần rà soát thêm..."
            />
          </FieldShell>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
          {type === 'ADD' ? 'Lưu hồ sơ' : 'Cập nhật hồ sơ'}
        </button>
      </div>
    </ModalWrapper>
  );
};
