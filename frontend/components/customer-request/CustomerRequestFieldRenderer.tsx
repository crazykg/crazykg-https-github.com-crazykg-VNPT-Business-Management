import React, { useMemo } from 'react';
import type { YeuCauProcessField } from '../../types/customerRequest';
import type { Customer, CustomerPersonnel } from '../../types/customer';
import type { Employee } from '../../types/employee';
import type { ProjectItemMaster } from '../../types/project';
import type { SupportServiceGroup } from '../../types/support';
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect';
import {
  combineDateWithExistingTime,
  isDateOnlyTransitionField,
  isReadonlyDateTimeTransitionField,
  toDateInput,
  toDateTimeLocal,
  toTimeInput,
} from './helpers';
import {
  customerRequestFieldClass,
  customerRequestFieldLabelClass,
  customerRequestReadonlyFieldClass,
  customerRequestSelectTriggerClass,
  customerRequestTextareaClass,
} from './uiClasses';

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

const isSourceChannelField = (field: YeuCauProcessField): boolean =>
  normalizeText(field.name) === 'source_channel';

const isSupportGroupField = (field: YeuCauProcessField): boolean =>
  field.type === 'support_group_select' || normalizeText(field.name) === 'support_service_group_id';

const resolveFieldLabel = (field: YeuCauProcessField): string =>
  isSupportGroupField(field) ? 'Zalo/Tele' : field.label;

const resolveFieldPlaceholder = (field: YeuCauProcessField): string =>
  `Chọn ${resolveFieldLabel(field).toLowerCase()}`;

const resolveFieldSearchPlaceholder = (field: YeuCauProcessField): string =>
  isSupportGroupField(field)
    ? 'Tìm zalo/tele...'
    : `Tìm ${resolveFieldLabel(field).toLowerCase()}...`;

const compactFieldLabelClass = 'mb-1 block text-xs font-semibold text-neutral';

const resolveProjectItemSelectValue = (
  value: unknown,
  projectItems: ProjectItemMaster[]
): string => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return '';
  }

  const directMatch = projectItems.find((item) => String(item.id) === rawValue);
  if (directMatch) {
    return String(directMatch.id);
  }

  const byCodeMatch = projectItems.find((item) => {
    const raw = item as unknown as Record<string, unknown>;
    const candidates = [
      item.project_code,
      item.product_code,
      raw.project_item_code,
      raw.projectItemCode,
      raw.item_code,
      raw.itemCode,
      raw.code,
    ];

    return candidates.some((candidate) => normalizeText(candidate) === rawValue);
  });

  return byCodeMatch ? String(byCodeMatch.id) : rawValue;
};

const resolveCustomerPersonnelSelectValue = (
  value: unknown,
  customerPersonnel: CustomerPersonnel[]
): string => {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return '';
  }

  const directMatch = customerPersonnel.find((person) => String(person.id) === rawValue);
  if (directMatch) {
    return String(directMatch.id);
  }

  const byCodeMatch = customerPersonnel.find((person) => {
    const raw = person as unknown as Record<string, unknown>;
    const candidates = [
      raw.personnel_code,
      raw.personnelCode,
      raw.customer_personnel_code,
      raw.customerPersonnelCode,
      raw.contact_code,
      raw.contactCode,
      raw.code,
      raw.personnel_id,
      raw.personnelId,
    ];

    return candidates.some((candidate) => normalizeText(candidate) === rawValue);
  });

  return byCodeMatch ? String(byCodeMatch.id) : rawValue;
};

const resolveSelectValue = (
  field: YeuCauProcessField,
  value: unknown,
  projectItems: ProjectItemMaster[],
  customerPersonnel: CustomerPersonnel[]
): string => {
  if (field.type === 'project_item_select') {
    return resolveProjectItemSelectValue(value, projectItems);
  }

  if (field.type === 'customer_personnel_select') {
    return resolveCustomerPersonnelSelectValue(value, customerPersonnel);
  }

  return String(value ?? '');
};


const isProgressPercentField = (field: YeuCauProcessField): boolean =>
  field.type === 'number' && normalizeText(field.name) === 'progress_percent';

const clampProgressPercent = (value: string): string => {
  const normalized = normalizeText(value);
  if (normalized === '') {
    return '';
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return String(Math.max(0, Math.min(100, parsed)));
};

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
    const filtered = projectItems;

    return filtered.map((item) => {
      const label = [item.customer_name, item.project_name, item.product_name || item.display_name]
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
  density?: 'default' | 'compact';
  onChange: (fieldName: string, value: unknown) => void;
  onOpenAddCustomerPersonnelModal?: () => void;
};

export const ProcessFieldInput: React.FC<ProcessFieldInputProps> = React.memo(({
  field,
  value,
  customers,
  employees,
  customerPersonnel,
  supportServiceGroups,
  projectItems,
  selectedCustomerId,
  disabled,
  density = 'default',
  onChange,
  onOpenAddCustomerPersonnelModal,
}) => {
  if (field.type === 'hidden') {
    return null;
  }

  const fieldLabel = resolveFieldLabel(field);

  const options = useMemo(() => fieldOptions(
    field,
    customers,
    employees,
    customerPersonnel,
    supportServiceGroups,
    projectItems,
    selectedCustomerId
  ), [field, customers, employees, customerPersonnel, supportServiceGroups, projectItems, selectedCustomerId]);

  const commonLabelClassName = density === 'compact'
    ? compactFieldLabelClass
    : `mb-1.5 ${customerRequestFieldLabelClass}`;

  const commonLabel = (
    <label className={commonLabelClassName}>
      {fieldLabel}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  if (isSourceChannelField(field)) {
    return (
      <div>
        {commonLabel}
        <input
          type="text"
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          className={customerRequestFieldClass}
        />
      </div>
    );
  }

  if (field.type === 'textarea' || field.type === 'json_textarea') {
    return (
      <div>
        {commonLabel}
        <textarea
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          rows={field.type === 'json_textarea' ? (density === 'compact' ? 5 : 7) : density === 'compact' ? 3 : 4}
          className={customerRequestTextareaClass}
        />
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number' || field.type === 'datetime') {
    const isDateOnlyField = field.type === 'datetime' && isDateOnlyTransitionField(field.name);
    const isReadonlyDateTimeField =
      field.type === 'datetime' && isReadonlyDateTimeTransitionField(field.name);
    const isBoundedProgressField = isProgressPercentField(field);
    if (isReadonlyDateTimeField) {
      return (
        <div>
          {commonLabel}
          <div className="w-full sm:max-w-[360px]">
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
              <input
                type="date"
                value={toDateInput(value)}
                disabled={disabled}
                onChange={(event) =>
                  onChange(field.name, combineDateWithExistingTime(event.target.value, value))
                }
                className={`min-w-0 ${customerRequestFieldClass}`}
              />
              <input
                type="time"
                value={toTimeInput(value)}
                disabled
                readOnly
                aria-label={`${field.label} (giờ cố định)`}
                className={customerRequestReadonlyFieldClass}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {commonLabel}
        <input
          type={isDateOnlyField ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'}
          value={
            isDateOnlyField
              ? toDateInput(value)
              : field.type === 'datetime'
              ? toDateTimeLocal(value)
              : String(value ?? '')
          }
          disabled={disabled}
          min={isBoundedProgressField ? 0 : undefined}
          max={isBoundedProgressField ? 100 : undefined}
          step={isBoundedProgressField ? 1 : undefined}
          inputMode={isBoundedProgressField ? 'numeric' : undefined}
          onChange={(event) =>
            onChange(
              field.name,
              isBoundedProgressField ? clampProgressPercent(event.target.value) : event.target.value
            )
          }
          className={customerRequestFieldClass}
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
        label={fieldLabel}
        required={field.required}
        placeholder={resolveFieldPlaceholder(field)}
        searchPlaceholder={resolveFieldSearchPlaceholder(field)}
        disabled={disabled}
        compact
        denseLabel={density === 'compact'}
        triggerClassName={customerRequestSelectTriggerClass}
      />
    );
  }

  if (field.type === 'customer_personnel_select' || field.type === 'support_group_select' || field.type === 'project_item_select') {
    const searchPlaceholder =
      field.type === 'project_item_select'
        ? 'Tìm theo khách hàng, dự án, sản phẩm...'
        : resolveFieldSearchPlaceholder(field);

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
          : ''
        : field.type === 'customer_personnel_select'
        ? ''
        : field.type === 'support_group_select'
        ? ''
        : '';

    return (
      <div>
        <SearchableSelect
          value={resolveSelectValue(field, value, projectItems, customerPersonnel)}
          options={options}
          onChange={(nextValue) => onChange(field.name, nextValue)}
          label={fieldLabel}
          required={field.required}
          placeholder={resolveFieldPlaceholder(field)}
          searchPlaceholder={searchPlaceholder}
          noOptionsText={
            field.type === 'project_item_select'
              ? 'Không tìm thấy khách hàng / dự án / sản phẩm phù hợp trong phạm vi hiện tại'
              : undefined
          }
          disabled={disabled}
          compact
          denseLabel={density === 'compact'}
          triggerClassName={customerRequestSelectTriggerClass}
          rightAction={
            field.type === 'customer_personnel_select' && onOpenAddCustomerPersonnelModal
              ? {
                  icon: 'add',
                  label: 'Thêm nhân sự liên hệ',
                  onClick: onOpenAddCustomerPersonnelModal,
                  disabled,
                }
              : undefined
          }
        />
        {helperText ? (
          <p className={`${density === 'compact' ? 'mt-1 text-[11px] leading-4' : 'mt-1.5'} text-xs text-slate-500`}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}, (prevProps, nextProps) => {
  // Custom comparison: chỉ re-render khi thực sự thay đổi
  return (
    prevProps.field === nextProps.field &&
    prevProps.value === nextProps.value &&
    prevProps.customers === nextProps.customers &&
    prevProps.employees === nextProps.employees &&
    prevProps.customerPersonnel === nextProps.customerPersonnel &&
    prevProps.supportServiceGroups === nextProps.supportServiceGroups &&
    prevProps.projectItems === nextProps.projectItems &&
    prevProps.selectedCustomerId === nextProps.selectedCustomerId &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.density === nextProps.density &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.onOpenAddCustomerPersonnelModal === nextProps.onOpenAddCustomerPersonnelModal
  );
});
