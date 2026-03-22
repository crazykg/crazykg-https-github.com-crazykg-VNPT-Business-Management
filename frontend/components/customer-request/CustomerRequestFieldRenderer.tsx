import React from 'react';
import type {
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  SupportServiceGroup,
  YeuCauProcessField,
} from '../../types';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import { isDateOnlyTransitionField, toDateInput } from './helpers';

const PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: 1, label: 'Thấp' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Cao' },
  { value: 4, label: 'Khẩn' },
];

const BOOLEAN_NULLABLE_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'Chưa xác định' },
  { value: '1', label: 'Có' },
  { value: '0', label: 'Không' },
];

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const fieldOptions = (
  field: YeuCauProcessField,
  customers: Customer[],
  employees: Employee[],
  customerPersonnel: CustomerPersonnel[],
  supportServiceGroups: SupportServiceGroup[],
  projectItems: ProjectItemMaster[],
  selectedCustomerId: string
): SearchableSelectOption[] => {
  if (field.type === 'customer_select') {
    return customers.map((customer) => ({
      value: String(customer.id),
      label: customer.customer_name,
      searchText: `${customer.customer_name} ${customer.customer_code}`,
    }));
  }

  if (field.type === 'user_select') {
    return employees.map((employee) => ({
      value: String(employee.id),
      label: employee.full_name || employee.username,
      searchText: `${employee.full_name || ''} ${employee.user_code || ''} ${employee.username || ''}`,
    }));
  }

  if (field.type === 'customer_personnel_select') {
    return customerPersonnel
      .filter((person) => !selectedCustomerId || normalizeText(person.customerId) === selectedCustomerId)
      .map((person) => ({
        value: String(person.id),
        label: person.fullName,
        searchText: `${person.fullName} ${person.phoneNumber || ''} ${person.email || ''} ${person.positionLabel || ''}`,
      }));
  }

  if (field.type === 'support_group_select') {
    return supportServiceGroups
      .filter((group) => {
        const groupCustomerId = normalizeText(group.customer_id);
        if (!selectedCustomerId) {
          return true;
        }
        return groupCustomerId === '' || groupCustomerId === selectedCustomerId;
      })
      .map((group) => ({
        value: String(group.id),
        label: group.group_name,
        searchText: `${group.group_name} ${group.group_code || ''} ${group.customer_name || ''}`,
      }));
  }

  if (field.type === 'project_item_select') {
    // Lọc theo khách hàng đã chọn (nếu có); giữ item không có customer_id để tránh mất dữ liệu
    const filtered = selectedCustomerId
      ? projectItems.filter((item) => {
          const itemCustomerId = normalizeText(item.customer_id);
          return itemCustomerId === '' || itemCustomerId === selectedCustomerId;
        })
      : projectItems;

    return filtered.map((item) => {
      const label = [item.customer_name, item.product_name || item.display_name]
        .map((part) => normalizeText(part))
        .filter(Boolean)
        .join(' | ');

      return {
        value: String(item.id),
        label: label || item.display_name || `Hạng mục #${item.id}`,
        searchText: [
          item.customer_name,
          item.customer_code,
          item.project_name,
          item.project_code,
          item.product_name,
          item.product_code,
          item.display_name,
        ]
          .map((part) => String(part ?? ''))
          .join(' '),
      };
    });
  }

  if (field.type === 'priority') {
    return PRIORITY_OPTIONS;
  }

  if (field.type === 'boolean_nullable') {
    return BOOLEAN_NULLABLE_OPTIONS;
  }

  if (field.type === 'enum') {
    return (field.options || []).map((option) => ({ value: option, label: option }));
  }

  return [];
};

type ProcessFieldInputProps = {
  field: YeuCauProcessField;
  value: unknown;
  customers: Customer[];
  employees: Employee[];
  customerPersonnel: CustomerPersonnel[];
  supportServiceGroups: SupportServiceGroup[];
  projectItems: ProjectItemMaster[];
  selectedCustomerId: string;
  disabled: boolean;
  onChange: (fieldName: string, value: unknown) => void;
};

export const ProcessFieldInput: React.FC<ProcessFieldInputProps> = ({
  field,
  value,
  customers,
  employees,
  customerPersonnel,
  supportServiceGroups,
  projectItems,
  selectedCustomerId,
  disabled,
  onChange,
}) => {
  if (field.type === 'hidden') {
    return null;
  }

  const options = fieldOptions(
    field,
    customers,
    employees,
    customerPersonnel,
    supportServiceGroups,
    projectItems,
    selectedCustomerId
  );

  const commonLabel = (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  if (field.type === 'textarea' || field.type === 'json_textarea') {
    return (
      <div>
        {commonLabel}
        <textarea
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          rows={field.type === 'json_textarea' ? 7 : 4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number' || field.type === 'datetime') {
    const isDateOnlyField = field.type === 'datetime' && isDateOnlyTransitionField(field.name);
    return (
      <div>
        {commonLabel}
        <input
          type={isDateOnlyField ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'}
          value={isDateOnlyField ? toDateInput(value) : String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    );
  }

  if (field.type === 'customer_select' || field.type === 'user_select' || field.type === 'priority' || field.type === 'boolean_nullable' || field.type === 'enum') {
    return (
      <SearchableSelect
        value={String(value ?? '')}
        options={options}
        onChange={(nextValue) => onChange(field.name, nextValue)}
        label={field.label}
        placeholder={`Chọn ${field.label.toLowerCase()}`}
        searchPlaceholder={`Tìm ${field.label.toLowerCase()}...`}
        disabled={disabled}
        compact
      />
    );
  }

  if (field.type === 'customer_personnel_select' || field.type === 'support_group_select' || field.type === 'project_item_select') {
    const searchPlaceholder =
      field.type === 'project_item_select'
        ? 'Tìm theo khách hàng, dự án, sản phẩm...'
        : `Tìm ${field.label.toLowerCase()}...`;

    const customerLabel =
      selectedCustomerId !== ''
        ? customers.find((customer) => String(customer.id) === selectedCustomerId)?.customer_name || 'khách hàng đã chọn'
        : '';

    const helperText =
      field.type === 'project_item_select'
        ? options.length === 0
          ? selectedCustomerId
            ? `Không có sản phẩm / dự án nào thuộc khách hàng ${customerLabel}. Thử chọn khách hàng khác hoặc bỏ trống để tìm trên toàn bộ danh mục.`
            : 'Chưa có sản phẩm / dự án trong phạm vi truy cập hiện tại. Hệ thống sẽ lấy danh sách từ module yêu cầu khách hàng, không phụ thuộc hoàn toàn vào danh mục dự án chung.'
          : selectedCustomerId
          ? `Đang lọc theo khách hàng: ${customerLabel}. Có ${options.length} sản phẩm / dự án phù hợp.`
          : `Có ${options.length} khách hàng / dự án / sản phẩm phù hợp để chọn.`
        : field.type === 'customer_personnel_select'
        ? selectedCustomerId
          ? `Đang lọc theo khách hàng: ${customerLabel}. Có ${options.length} người yêu cầu phù hợp.`
          : 'Chọn khách hàng trước để lọc danh sách người yêu cầu đúng phạm vi.'
        : field.type === 'support_group_select'
        ? selectedCustomerId
          ? `Đang lọc theo khách hàng: ${customerLabel}. Có ${options.length} kênh tiếp nhận phù hợp.`
          : ''
        : '';

    return (
      <div>
        <SearchableSelect
          value={String(value ?? '')}
          options={options}
          onChange={(nextValue) => onChange(field.name, nextValue)}
          label={field.label}
          placeholder={`Chọn ${field.label.toLowerCase()}`}
          searchPlaceholder={searchPlaceholder}
          noOptionsText={
            field.type === 'project_item_select'
              ? 'Không tìm thấy khách hàng / dự án / sản phẩm phù hợp trong phạm vi hiện tại'
              : undefined
          }
          disabled={disabled}
          compact
        />
        {helperText ? <p className="mt-1.5 text-xs text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  return null;
};
