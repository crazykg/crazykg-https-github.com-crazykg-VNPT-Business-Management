import React, { useMemo, useState } from 'react';
import { BadgeCheck, Building2, FileText, IdCard, Mail, MapPin, ShieldCheck, UserRoundSearch } from 'lucide-react';
import type { Department, Employee, EmployeePartyProfile } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { ModalWrapper } from './modals';
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
  <label className="block space-y-2">
    <span className="text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="text-red-500 ml-1">*</span> : null}
    </span>
    {children}
    {error ? <span className="block text-xs font-medium text-red-600">{error}</span> : null}
  </label>
);

const inputClassName =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-slate-500';

const textareaClassName =
  'min-h-[128px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-slate-500';

const readonlyInfoClassName =
  'flex min-h-[92px] flex-col justify-between rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.32)]';

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ eyebrow, title, description, icon }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-deep-teal/75">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-deep-teal">
      {icon}
    </span>
  </div>
);

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
        label: 'Phòng ban',
        value: getDepartmentLabel(selectedEmployee),
        icon: <Building2 className="h-4 w-4" />,
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
      <div className="space-y-6 p-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(145deg,#f8fbff_0%,#eef7fb_46%,#f7fbf8_100%)] p-5 shadow-[0_24px_60px_-42px_rgba(0,63,122,0.4)] md:p-6">
          <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-6 h-20 w-20 rounded-full bg-blue-200/20 blur-2xl" />

          <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-deep-teal/75">Party Profile Editor</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {type === 'ADD' ? 'Thêm hồ sơ Đảng viên' : 'Cập nhật hồ sơ Đảng viên'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gắn hồ sơ với đúng nhân sự nội bộ theo Mã NV. Dữ liệu nhân sự gốc chỉ hiển thị để đối chiếu, không chỉnh sửa trong modal này.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 ring-1 ring-white/80">
                <UserRoundSearch className="h-3.5 w-3.5" />
                Chọn theo Mã NV
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1.5 ring-1 ring-white/80">
                <BadgeCheck className="h-3.5 w-3.5" />
                Kiểm tra trùng số thẻ
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <SectionHeader
            eyebrow="Nhân sự gốc"
            title="Liên kết hồ sơ với nhân viên nội bộ"
            description="Chọn đúng nhân sự trước khi nhập hồ sơ. Các trường thông tin gốc bên dưới chỉ để đối chiếu và tự động lấy từ danh sách nhân sự."
            icon={<UserRoundSearch className="h-5 w-5" />}
          />

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                  triggerClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  usePortal
                  portalZIndex={2100}
                />
              </FieldShell>
              <FieldShell label="Họ và tên">
                <input className={inputClassName} value={selectedEmployee?.full_name || ''} disabled />
              </FieldShell>
              <FieldShell label="Phòng ban">
                <input className={inputClassName} value={getDepartmentLabel(selectedEmployee)} disabled />
              </FieldShell>
              <FieldShell label="Ngày sinh">
                <input
                  className={inputClassName}
                  value={formatDateDdMmYyyy(selectedEmployee?.date_of_birth || null)}
                  disabled
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {employeeSnapshot.map((item) => (
                <div key={item.label} className={readonlyInfoClassName}>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-deep-teal">
                      {item.icon}
                    </span>
                    {item.label}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-slate-900">{item.value || '--'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
            <SectionHeader
              eyebrow="Thông tin lõi"
              title="Dữ liệu hồ sơ cần kiểm soát"
              description="Phần này lưu trực tiếp vào hồ sơ Đảng viên và được kiểm tra trùng lặp theo số thẻ Đảng."
              icon={<IdCard className="h-5 w-5" />}
            />

            {duplicatePartyCardProfile ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
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

            <div className="rounded-[22px] bg-slate-50/90 p-4 ring-1 ring-slate-100">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-deep-teal shadow-sm">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Nguyên tắc dữ liệu</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Hồ sơ Đảng viên được lưu tách biệt với nhân sự lõi, nên bạn có thể bổ sung số thẻ và mô tả mà không làm thay đổi hồ sơ nhân sự gốc.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
            <SectionHeader
              eyebrow="Mô tả hồ sơ"
              title="Bổ sung thông tin nền"
              description="Nhóm trường này phục vụ tra cứu hồ sơ và làm sạch dữ liệu, không can thiệp vào trạng thái nhân sự."
              icon={<MapPin className="h-5 w-5" />}
            />

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

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <SectionHeader
            eyebrow="Ghi chú nghiệp vụ"
            title="Không gian lưu ý bổ sung"
            description="Dùng để ghi các lưu ý hồ sơ, tình trạng giấy tờ hoặc phần cần rà soát thêm trước khi import hàng loạt."
            icon={<FileText className="h-5 w-5" />}
          />

          <FieldShell label="Ghi chú">
            <textarea
              className={`${textareaClassName} mt-5`}
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Bổ sung ghi chú hồ sơ, tình trạng giấy tờ hoặc lưu ý nghiệp vụ..."
            />
          </FieldShell>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-[linear-gradient(180deg,#fafcfe_0%,#f4f8fb_100%)] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-[linear-gradient(135deg,#003F7A_0%,#005BAA_48%,#0E7490_100%)] px-5 py-2 font-semibold text-white shadow-[0_18px_34px_-20px_rgba(0,63,122,0.7)] transition hover:-translate-y-0.5"
        >
          {type === 'ADD' ? 'Lưu hồ sơ' : 'Cập nhật hồ sơ'}
        </button>
      </div>
    </ModalWrapper>
  );
};
