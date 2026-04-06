import React, { useEffect, useMemo, useState } from 'react';
import { Department, Employee, UserDeptHistory } from '../../types';
import { getEmployeeLabel, normalizeEmployeeCode } from '../../utils/employeeDisplay';
import { getUserDeptHistoryDepartmentLabel } from '../../utils/userDeptHistoryDepartmentDisplay';
import { SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const normalizeTransferCode = (value: unknown): string => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';

  if (/^LC\d+$/.test(raw)) {
    const digits = raw.replace(/\D+/g, '');
    return `LC${digits.padStart(3, '0')}`;
  }

  const digits = raw.replace(/\D+/g, '');
  if (!digits) return raw;

  return `LC${digits.padStart(3, '0')}`;
};

export interface UserDeptHistoryFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: UserDeptHistory | null;
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onSave: (data: Partial<UserDeptHistory>) => void;
}

export const UserDeptHistoryFormModal: React.FC<UserDeptHistoryFormModalProps> = ({
  type,
  data,
  employees,
  departments,
  onClose,
  onSave,
}) => {
  const resolveDeptId = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const matched = departments.find(
      (department) => String(department.id) === raw || department.dept_code === raw || department.dept_name === raw
    );
    return matched ? String(matched.id) : raw;
  };

  const [formData, setFormData] = useState<Partial<UserDeptHistory>>({
    id: data?.id || '',
    userId: String(data?.userId || ''),
    fromDeptId: resolveDeptId(data?.fromDeptId),
    toDeptId: resolveDeptId(data?.toDeptId),
    transferDate: data?.transferDate || new Date().toISOString().split('T')[0],
    decisionNumber: data?.decisionNumber || '',
    reason: data?.reason || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (type === 'ADD' && formData.userId) {
      const employee = employees.find((item) => String(item.id) === String(formData.userId));
      if (employee) {
        setFormData((prev) => ({ ...prev, fromDeptId: String(employee.department_id ?? '') }));
      }
    }
  }, [formData.userId, employees, type]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.userId) nextErrors.userId = 'Vui lòng chọn nhân sự';
    if (!formData.toDeptId) nextErrors.toDeptId = 'Vui lòng chọn đơn vị mới';
    if (!formData.transferDate) nextErrors.transferDate = 'Ngày luân chuyển là bắt buộc';
    if (formData.fromDeptId === formData.toDeptId) nextErrors.toDeptId = 'Đơn vị mới phải khác đơn vị hiện tại';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof UserDeptHistory, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const fromDeptLabel = useMemo(() => {
    const currentValue = String(formData.fromDeptId || '');
    if (!currentValue) return '';

    const matchedDept = departments.find(
      (department) =>
        String(department.id) === currentValue ||
        department.dept_code === currentValue ||
        department.dept_name === currentValue
    );
    if (matchedDept) {
      return getUserDeptHistoryDepartmentLabel(departments, currentValue, {
        deptCode: matchedDept.dept_code,
        deptName: matchedDept.dept_name,
      });
    }

    return getUserDeptHistoryDepartmentLabel(departments, currentValue, {
      deptCode: data?.fromDeptCode,
      deptName: data?.fromDeptName,
    });
  }, [formData.fromDeptId, departments, data?.fromDeptCode, data?.fromDeptName]);

  const toDepartmentOptions = useMemo(
    () =>
      departments
        .filter((department) => String(department.id) !== String(formData.fromDeptId || ''))
        .map((department) => ({
          value: String(department.id),
          label: getUserDeptHistoryDepartmentLabel(departments, department.id, {
            deptCode: department.dept_code,
            deptName: department.dept_name,
          }),
          searchText: `${department.dept_code || ''} ${department.dept_name || ''}`,
        })),
    [departments, formData.fromDeptId]
  );

  useEffect(() => {
    if (String(formData.toDeptId || '') === String(formData.fromDeptId || '')) {
      setFormData((prev) => ({ ...prev, toDeptId: '' }));
    }
  }, [formData.fromDeptId, formData.toDeptId]);

  const employeeOptions = useMemo(() => {
    const options = employees.map((employee) => ({
      value: String(employee.id),
      label: getEmployeeLabel(employee),
    }));

    const currentUserId = String(data?.userId || '');
    if (currentUserId && !options.some((option) => option.value === currentUserId)) {
      options.unshift({
        value: currentUserId,
        label: `${normalizeEmployeeCode(data?.employeeCode || currentUserId, currentUserId)}${data?.employeeName ? ` - ${data.employeeName}` : ''}`,
      });
    }

    return options;
  }, [employees, data?.userId, data?.employeeCode, data?.employeeName]);

  const transferCodeDisplay = useMemo(() => {
    if (type === 'ADD') {
      return '';
    }
    return normalizeTransferCode(formData.id || data?.id || '');
  }, [type, formData.id, data?.id]);

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm mới Luân chuyển' : 'Cập nhật Luân chuyển'}
      icon="history_edu"
      width="max-w-lg"
    >
      <div className="space-y-5 p-6">
        {type === 'EDIT' ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Mã luân chuyển
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="text"
              value={transferCodeDisplay}
              disabled
              className="h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 text-slate-500"
            />
          </div>
        ) : null}

        <SearchableSelect
          label="Nhân sự"
          required
          options={employeeOptions}
          value={formData.userId || ''}
          onChange={(value) => handleChange('userId', value)}
          error={errors.userId}
          placeholder="Chọn nhân sự"
          disabled={type === 'EDIT'}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Từ đơn vị</label>
          <input
            type="text"
            value={fromDeptLabel}
            disabled
            className="h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 text-slate-500"
            placeholder="Tự động điền..."
          />
        </div>

        <SearchableSelect
          label="Đến đơn vị"
          required
          options={toDepartmentOptions}
          value={formData.toDeptId || ''}
          onChange={(value) => handleChange('toDeptId', value)}
          error={errors.toDeptId}
          placeholder="Chọn đơn vị mới"
        />

        <FormInput
          label="Ngày luân chuyển"
          type="date"
          value={formData.transferDate}
          onChange={(e: any) => handleChange('transferDate', e.target.value)}
          required
          error={errors.transferDate}
        />

        <FormInput
          label="Số quyết định"
          value={formData.decisionNumber || ''}
          onChange={(e: any) => handleChange('decisionNumber', e.target.value)}
          placeholder="Nhập số quyết định..."
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Lý do / Ghi chú</label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Nhập lý do điều chuyển..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100">Hủy</button>
        <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-deep-teal">
          <span className="material-symbols-outlined text-lg">check</span>
          {type === 'ADD' ? 'Lưu & Cập nhật' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
