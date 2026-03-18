import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYeuCau,
  deleteYeuCau,
  fetchCustomerRequestProjectItems,
  fetchCustomerRequestReferenceSearch,
  fetchProjectRaciAssignments,
  fetchYeuCauPage,
  fetchYeuCauPeople,
  fetchYeuCauProcessCatalog,
  fetchYeuCauProcessDetail,
  isRequestCanceledError,
  saveYeuCauProcess,
  transitionCustomerRequestCase,
  uploadDocumentAttachment,
} from '../services/v5Api';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  CustomerRequestReferenceSearchItem,
  Employee,
  ProjectRaciRow,
  ProjectItemMaster,
  SupportServiceGroup,
  SupportRequestTaskStatus,
  YeuCau,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRefTaskRow,
  YeuCauRelatedUser,
} from '../types';
import { AttachmentManager } from './AttachmentManager';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { formatDateTimeDdMmYyyy } from '../utils/dateDisplay';

type YeuCauManagementHubProps = {
  customers: Customer[];
  customerPersonnel?: CustomerPersonnel[];
  projectItems?: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups?: SupportServiceGroup[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  canReadRequests: boolean;
  canWriteRequests: boolean;
  canDeleteRequests?: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
};

type DraftState = Record<string, unknown>;

const PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: 1, label: 'Thấp' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Cao' },
  { value: 4, label: 'Khẩn' },
];

// Màu và nhãn cho từng trạng thái xử lý (customer_request_status_catalogs)
const STATUS_COLOR_MAP: Record<string, { label: string; cls: string }> = {
  new_intake:                { label: 'Mới tiếp nhận',      cls: 'bg-sky-100 text-sky-700' },
  waiting_customer_feedback: { label: 'Đợi phản hồi KH',    cls: 'bg-yellow-100 text-yellow-700' },
  in_progress:               { label: 'Đang xử lý',         cls: 'bg-amber-100 text-amber-700' },
  not_executed:              { label: 'Không thực hiện',     cls: 'bg-slate-100 text-slate-500' },
  completed:                 { label: 'Hoàn thành',          cls: 'bg-emerald-100 text-emerald-700' },
  customer_notified:         { label: 'Báo khách hàng',      cls: 'bg-teal-100 text-teal-700' },
  returned_to_manager:       { label: 'Chuyển trả QL',       cls: 'bg-orange-100 text-orange-700' },
  analysis:                  { label: 'Phân tích',           cls: 'bg-purple-100 text-purple-700' },
};

const BOOLEAN_NULLABLE_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'Chưa xác định' },
  { value: '1', label: 'Có' },
  { value: '0', label: 'Không' },
];

type CustomerRequestTaskSource = 'IT360' | 'REFERENCE';
type CustomerRequestViewTab = 'list' | 'form';

type It360TaskFormRow = {
  local_id: string;
  id?: string | number | null;
  task_code: string;
  task_link: string;
  status: SupportRequestTaskStatus;
};

type ReferenceTaskFormRow = {
  local_id: string;
  id?: string | number | null;
  task_code: string;
};

const SUPPORT_TASK_STATUS_OPTIONS: Array<{ value: SupportRequestTaskStatus; label: string }> = [
  { value: 'TODO', label: 'Vừa tạo' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'DONE', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Huỷ' },
  { value: 'BLOCKED', label: 'Chuyển task khác' },
];

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

const buildTaskRowId = (): string => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeSupportTaskStatus = (value: unknown): SupportRequestTaskStatus => {
  const token = normalizeToken(value);
  if (token === 'INPROGRESS' || token === 'DANGTHUCHIEN') {
    return 'IN_PROGRESS';
  }
  if (token === 'DONE' || token === 'HOANTHANH' || token === 'DAHOANTHANH') {
    return 'DONE';
  }
  if (token === 'CANCELLED' || token === 'HUY') {
    return 'CANCELLED';
  }
  if (token === 'BLOCKED' || token === 'CHUYENSANGTASKKHAC') {
    return 'BLOCKED';
  }

  return 'TODO';
};

const normalizeCustomerRequestTaskSource = (
  value: unknown,
  fallback: CustomerRequestTaskSource = 'IT360'
): CustomerRequestTaskSource => {
  const token = normalizeToken(value);
  if (token === 'REFERENCE' || token === 'THAMCHIEU' || token === 'REFERENCETASK') {
    return 'REFERENCE';
  }
  if (token === 'IT360') {
    return 'IT360';
  }

  return fallback;
};

const createEmptyIt360TaskRow = (partial?: Partial<It360TaskFormRow>): It360TaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  id: partial?.id ?? null,
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

const createEmptyReferenceTaskRow = (partial?: Partial<ReferenceTaskFormRow>): ReferenceTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  id: partial?.id ?? null,
  task_code: partial?.task_code || '',
});

const formatCurrentDateForDateInput = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIt360TaskSignature = (task: It360TaskFormRow): string =>
  [normalizeToken(task.task_code), normalizeText(task.task_link), normalizeSupportTaskStatus(task.status)].join('|');

const dedupeIt360TaskRows = (rows: It360TaskFormRow[]): It360TaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: It360TaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = buildIt360TaskSignature(task);
    if (signature === '' || seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

const dedupeReferenceTaskRows = (rows: ReferenceTaskFormRow[]): ReferenceTaskFormRow[] => {
  const seen = new Set<string>();
  const deduped: ReferenceTaskFormRow[] = [];
  rows.forEach((task) => {
    const signature = normalizeToken(task.task_code);
    if (signature === '' || seen.has(signature)) {
      return;
    }
    seen.add(signature);
    deduped.push(task);
  });
  return deduped;
};

const splitCustomerRequestTaskRows = (
  rows: YeuCauRefTaskRow[]
): { it360Rows: It360TaskFormRow[]; referenceRows: ReferenceTaskFormRow[] } => {
  const it360Rows: It360TaskFormRow[] = [];
  const referenceRows: ReferenceTaskFormRow[] = [];

  rows.forEach((task) => {
    const source = normalizeCustomerRequestTaskSource(task.task_source, 'REFERENCE');
    const taskCode = normalizeText(task.task_code);
    const taskLink = normalizeText(task.task_link);
    const taskId = task.id ?? task.ref_task_id ?? null;
    const id = typeof taskId === 'string' || typeof taskId === 'number' ? taskId : null;

    if (source === 'REFERENCE') {
      if (taskCode !== '') {
        referenceRows.push(createEmptyReferenceTaskRow({ id, task_code: taskCode }));
      }
      return;
    }

    if (taskCode === '' && taskLink === '') {
      return;
    }

    it360Rows.push(
      createEmptyIt360TaskRow({
        id,
        task_code: taskCode,
        task_link: taskLink,
        status: normalizeSupportTaskStatus(task.task_status ?? 'TODO'),
      })
    );
  });

  return {
    it360Rows: dedupeIt360TaskRows(it360Rows),
    referenceRows: dedupeReferenceTaskRows(referenceRows),
  };
};

const toDateTimeLocal = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.replace(' ', 'T').slice(0, 16);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 16);
  }

  return normalized;
};

const toSqlDateTime = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace('T', ' ')}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return normalized;
};

const findProcessByCode = (
  catalog: YeuCauProcessCatalog | null,
  processCode: string | null | undefined
): YeuCauProcessMeta | null => {
  const target = normalizeText(processCode);
  if (!catalog || !target) {
    return null;
  }

  for (const group of catalog.groups) {
    const match = group.processes.find((process) => process.process_code === target);
    if (match) {
      return match;
    }
  }

  return null;
};

const buildDraftFromFields = (fields: YeuCauProcessField[], source: Record<string, unknown> | null | undefined): DraftState => {
  const nextDraft: DraftState = {};
  for (const field of fields) {
    const rawValue = source?.[field.name];
    if (field.type === 'datetime') {
      nextDraft[field.name] = toDateTimeLocal(rawValue);
      continue;
    }
    if (field.type === 'boolean_nullable') {
      if (rawValue === true || rawValue === 1 || rawValue === '1') {
        nextDraft[field.name] = '1';
      } else if (rawValue === false || rawValue === 0 || rawValue === '0') {
        nextDraft[field.name] = '0';
      } else {
        nextDraft[field.name] = '';
      }
      continue;
    }
    if (field.type === 'json_textarea' && rawValue && typeof rawValue !== 'string') {
      nextDraft[field.name] = JSON.stringify(rawValue, null, 2);
      continue;
    }
    nextDraft[field.name] = rawValue ?? '';
  }

  return nextDraft;
};

const serializeDraftValue = (field: YeuCauProcessField, value: unknown): unknown => {
  if (field.type === 'datetime') {
    return toSqlDateTime(value);
  }
  if (field.type === 'boolean_nullable') {
    const normalized = normalizeText(value);
    if (!normalized) {
      return null;
    }
    return normalized === '1';
  }
  if (field.type === 'number' || field.type === 'priority' || field.type === 'user_select' || field.type === 'customer_select') {
    const normalized = normalizeText(value);
    return normalized ? normalized : null;
  }
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
};

const buildPayloadFromDraft = (fields: YeuCauProcessField[], draft: DraftState): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    payload[field.name] = serializeDraftValue(field, draft[field.name]);
  }
  return payload;
};

const findSingleSupportGroupForCustomer = (
  supportServiceGroups: SupportServiceGroup[],
  customerId: string
): SupportServiceGroup | null => {
  const normalizedCustomerId = normalizeText(customerId);
  if (normalizedCustomerId === '') {
    return null;
  }

  const exactMatches = supportServiceGroups.filter(
    (group) => normalizeText(group.customer_id) === normalizedCustomerId
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  return null;
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
    return projectItems.map((item) => {
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

const ProcessFieldInput: React.FC<{
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
}> = ({ field, value, customers, employees, customerPersonnel, supportServiceGroups, projectItems, selectedCustomerId, disabled, onChange }) => {
  if (field.type === 'hidden') {
    return null;
  }

  const options = fieldOptions(field, customers, employees, customerPersonnel, supportServiceGroups, projectItems, selectedCustomerId);

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
    return (
      <div>
        {commonLabel}
        <input
          type={field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
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
        ? ''
        : field.type === 'customer_personnel_select'
        ? selectedCustomerId
          ? `Đang lọc theo khách hàng: ${customerLabel}. Có ${options.length} người yêu cầu phù hợp.`
          : 'Chọn khách hàng trước để lọc danh sách người yêu cầu đúng phạm vi.'
        : field.type === 'support_group_select'
        ? ''
        : selectedCustomerId
        ? `Đang lọc theo khách hàng: ${customerLabel}. Có ${options.length} kênh tiếp nhận phù hợp.`
        : 'Chọn khách hàng trước để lọc danh sách kênh tiếp nhận đúng phạm vi.';

    return (
      <div>
        <SearchableSelect
          value={String(value ?? '')}
          options={options}
          onChange={(nextValue) => onChange(field.name, nextValue)}
          label={field.label}
          placeholder={`Chọn ${field.label.toLowerCase()}`}
          searchPlaceholder={searchPlaceholder}
          disabled={disabled}
          compact
        />
        {helperText ? <p className="mt-1.5 text-xs text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  return null;
};

const humanizeKetQua = (value: string): string => {
  switch (value) {
    case 'dang_xu_ly':
      return 'Đang xử lý';
    case 'hoan_thanh':
      return 'Hoàn thành';
    case 'khong_tiep_nhan':
      return 'Không tiếp nhận';
    case 'ket_thuc':
      return 'Kết thúc';
    default:
      return value;
  }
};

export const YeuCauManagementHub: React.FC<YeuCauManagementHubProps> = ({
  customers,
  customerPersonnel = [],
  projectItems = [],
  employees,
  supportServiceGroups = [],
  currentUserId,
  isAdminViewer,
  canReadRequests,
  canWriteRequests,
  canDeleteRequests,
  onNotify,
}) => {
  const [catalog, setCatalog] = useState<YeuCauProcessCatalog | null>(null);
  const [activeProcessCode, setActiveProcessCode] = useState<string>('');
  const [listRows, setListRows] = useState<YeuCau[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState<string>('');
  const [processDetail, setProcessDetail] = useState<YeuCauProcessDetail | null>(null);
  const [people, setPeople] = useState<YeuCauRelatedUser[]>([]);
  const [masterDraft, setMasterDraft] = useState<DraftState>({});
  const [processDraft, setProcessDraft] = useState<DraftState>({});
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<CustomerRequestViewTab>('list');
  const [requestKeyword, setRequestKeyword] = useState('');
  const [requestCustomerFilter, setRequestCustomerFilter] = useState('');
  const [requestSupportGroupFilter, setRequestSupportGroupFilter] = useState('');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [transitionStatusCode, setTransitionStatusCode] = useState('');      // status dropdown trong form
  const [showTransitionModal, setShowTransitionModal] = useState(false);     // hiện modal chuyển TT
  const [modalStatusPayload, setModalStatusPayload] = useState<Record<string, unknown>>({});
  const [modalIt360Tasks, setModalIt360Tasks] = useState<It360TaskFormRow[]>([]);
  const [modalRefTasks, setModalRefTasks] = useState<ReferenceTaskFormRow[]>([]);
  const [modalAttachments, setModalAttachments] = useState<Attachment[]>([]);
  const [modalNotes, setModalNotes] = useState('');
  const [modalActiveTaskTab, setModalActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalUploading, setIsModalUploading] = useState(false);
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 20;
  const [requestScopedProjectItems, setRequestScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [projectRaciRows, setProjectRaciRows] = useState<ProjectRaciRow[]>([]);
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [formIt360Tasks, setFormIt360Tasks] = useState<It360TaskFormRow[]>([createEmptyIt360TaskRow()]);
  const [formReferenceTasks, setFormReferenceTasks] = useState<ReferenceTaskFormRow[]>([createEmptyReferenceTaskRow()]);
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');
  const [taskReferenceSearchTerm, setTaskReferenceSearchTerm] = useState('');
  const [taskReferenceSearchResults, setTaskReferenceSearchResults] = useState<CustomerRequestReferenceSearchItem[]>([]);
  const [isTaskReferenceSearchLoading, setIsTaskReferenceSearchLoading] = useState(false);
  const [taskReferenceSearchError, setTaskReferenceSearchError] = useState('');
  const taskReferenceSearchRequestVersionRef = useRef(0);

  const availableProjectItems = useMemo(() => {
    const next = new Map<string, ProjectItemMaster>();
    [...projectItems, ...requestScopedProjectItems].forEach((item) => {
      next.set(String(item.id), item);
    });
    return Array.from(next.values());
  }, [projectItems, requestScopedProjectItems]);

  const employeeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: employee.full_name || employee.username,
        searchText: `${employee.full_name || ''} ${employee.user_code || ''} ${employee.username || ''}`,
      })),
    [employees]
  );

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.customer_name,
        searchText: `${customer.customer_name} ${customer.customer_code}`,
      })),
    [customers]
  );

  const customerPersonnelById = useMemo(() => {
    const next = new Map<string, CustomerPersonnel>();
    customerPersonnel.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [customerPersonnel]);

  const supportServiceGroupById = useMemo(() => {
    const next = new Map<string, SupportServiceGroup>();
    supportServiceGroups.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [supportServiceGroups]);

  const projectItemById = useMemo(() => {
    const next = new Map<string, ProjectItemMaster>();
    availableProjectItems.forEach((item) => {
      next.set(String(item.id), item);
    });
    return next;
  }, [availableProjectItems]);

  const selectedCustomerId = normalizeText(masterDraft.customer_id);
  const selectedProjectId = useMemo(
    () =>
      normalizeText(
        masterDraft.project_id ||
          processDetail?.yeu_cau?.project_id ||
          projectItemById.get(normalizeText(masterDraft.project_item_id))?.project_id
      ),
    [masterDraft.project_id, masterDraft.project_item_id, processDetail?.yeu_cau?.project_id, projectItemById]
  );

  const employeeById = useMemo(() => {
    const next = new Map<string, Employee>();
    employees.forEach((employee) => {
      next.set(String(employee.id), employee);
    });
    return next;
  }, [employees]);

  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(() => {
    const next = new Map<string, SearchableSelectOption>();

    formReferenceTasks.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        value,
        label: taskCode,
        searchText: taskCode,
      });
    });

    taskReferenceSearchResults.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      const label = [task.task_code, task.request_code, task.summary].map((part) => normalizeText(part)).filter(Boolean).join(' | ');
      next.set(value, {
        value,
        label: label || taskCode,
        searchText: [task.task_code, task.request_code, task.ticket_code, task.summary, task.status].map((part) => String(part ?? '')).join(' '),
      });
    });

    return Array.from(next.values());
  }, [formReferenceTasks, taskReferenceSearchResults]);

  const taskReferenceLookup = useMemo(() => {
    const next = new Map<string, { id?: string | number | null; task_code: string }>();

    formReferenceTasks.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        id: task.id ?? null,
        task_code: taskCode,
      });
    });

    taskReferenceSearchResults.forEach((task) => {
      const taskCode = normalizeText(task.task_code);
      if (taskCode === '') {
        return;
      }

      const value = task.id != null ? String(task.id) : taskCode;
      next.set(value, {
        id: task.id ?? null,
        task_code: taskCode,
      });
    });

    return next;
  }, [formReferenceTasks, taskReferenceSearchResults]);

  const masterFields = catalog?.master_fields ?? [];
  const createInitialProcess = findProcessByCode(catalog, 'new_intake');
  const filteredRequestRows = useMemo(() => {
    const keyword = normalizeToken(requestKeyword);
    const customerFilter = normalizeText(requestCustomerFilter);
    const supportGroupFilter = normalizeText(requestSupportGroupFilter);
    const priorityFilter = normalizeText(requestPriorityFilter);

    return listRows.filter((row) => {
      if (customerFilter !== '' && normalizeText(row.customer_id ?? row.khach_hang_id) !== customerFilter) {
        return false;
      }
      if (supportGroupFilter !== '' && normalizeText(row.support_service_group_id) !== supportGroupFilter) {
        return false;
      }
      if (priorityFilter !== '' && String(row.do_uu_tien ?? '') !== priorityFilter) {
        return false;
      }
      if (keyword !== '') {
        const haystack = normalizeToken(
          [
            row.ma_yc,
            row.request_code,
            row.tieu_de,
            row.summary,
            row.khach_hang_name,
            row.customer_name,
            row.support_service_group_name,
            row.requester_name,
          ].join(' ')
        );
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (requestStatusFilter !== '' && String(row.trang_thai ?? '') !== requestStatusFilter) {
        return false;
      }

      return true;
    });
  }, [listRows, requestCustomerFilter, requestKeyword, requestPriorityFilter, requestSupportGroupFilter, requestStatusFilter]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    setIsCatalogLoading(true);
    void fetchYeuCauProcessCatalog()
      .then((nextCatalog) => {
        if (cancelled) {
          return;
        }
        setCatalog(nextCatalog);
        const firstProcess = nextCatalog.groups[0]?.processes[0]?.process_code ?? 'new_intake';
        setActiveProcessCode((current) => current || firstProcess);
        setActiveEditorProcessCode((current) => current || 'new_intake');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải tiến trình', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    void fetchCustomerRequestProjectItems()
      .then((rows) => {
        if (!cancelled) {
          setRequestScopedProjectItems(rows || []);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if ((projectItems || []).length === 0) {
          onNotify('error', 'Không thể tải phần mềm triển khai', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify, projectItems]);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    if (!selectedProjectId) {
      setProjectRaciRows([]);
      return;
    }

    let cancelled = false;
    void fetchProjectRaciAssignments([selectedProjectId])
      .then((rows) => {
        if (!cancelled) {
          setProjectRaciRows(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setProjectRaciRows([]);
        onNotify('error', 'Không thể tải RACI dự án', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify, selectedProjectId]);

  useEffect(() => {
    if (!canReadRequests || !activeProcessCode || isCreateMode) {
      return;
    }

    let cancelled = false;
    setIsListLoading(true);
    void fetchYeuCauPage({
      page: 1,
      per_page: 50,
      process_code: activeProcessCode,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setListRows(result.data);
        if (!selectedRequestId && result.data[0]) {
          startTransition(() => {
            setSelectedRequestId(result.data[0].id);
            setActiveEditorProcessCode(result.data[0].tien_trinh_hien_tai || activeProcessCode);
          });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải danh sách yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProcessCode, canReadRequests, isCreateMode, onNotify, selectedRequestId]);

  useEffect(() => {
    if (isCreateMode) {
      return;
    }

    if (filteredRequestRows.length === 0) {
      if (selectedRequestId !== null) {
        setSelectedRequestId(null);
      }
      return;
    }

    const stillExists = filteredRequestRows.some((row) => String(row.id) === String(selectedRequestId));
    if (!stillExists) {
      const nextSelected = filteredRequestRows[0];
      startTransition(() => {
        setSelectedRequestId(nextSelected.id);
        setActiveEditorProcessCode(nextSelected.tien_trinh_hien_tai || activeProcessCode);
      });
    }
  }, [activeProcessCode, filteredRequestRows, isCreateMode, selectedRequestId]);

  useEffect(() => {
    if (isCreateMode) {
      setPeople([]);
      const nextMasterDraft = buildDraftFromFields(masterFields, null);
      const nextProcessDraft = buildDraftFromFields(createInitialProcess?.form_fields ?? [], null);
      setMasterDraft(nextMasterDraft);
      setProcessDraft(nextProcessDraft);
      setProcessDetail(null);
      setFormAttachments([]);
      setAttachmentError('');
      setAttachmentNotice('');
      setFormIt360Tasks([createEmptyIt360TaskRow()]);
      setFormReferenceTasks([createEmptyReferenceTaskRow()]);
      setActiveTaskTab('IT360');
      setTaskReferenceSearchTerm('');
      setTaskReferenceSearchResults([]);
      setTaskReferenceSearchError('');
      setIsTaskReferenceSearchLoading(false);
      taskReferenceSearchRequestVersionRef.current += 1;
      return;
    }

    if (!selectedRequestId || !activeEditorProcessCode) {
      setProcessDetail(null);
      setPeople([]);
      setFormAttachments([]);
      setFormIt360Tasks([createEmptyIt360TaskRow()]);
      setFormReferenceTasks([createEmptyReferenceTaskRow()]);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    Promise.all([fetchYeuCauProcessDetail(selectedRequestId, activeEditorProcessCode), fetchYeuCauPeople(selectedRequestId)])
      .then(([detail, nextPeople]) => {
        if (cancelled) {
          return;
        }
        const { it360Rows, referenceRows } = splitCustomerRequestTaskRows(
          Array.isArray(detail.ref_tasks) ? detail.ref_tasks : []
        );
        setProcessDetail(detail);
        setPeople(nextPeople);
        setMasterDraft(buildDraftFromFields(masterFields, detail.yeu_cau as unknown as Record<string, unknown>));
        setProcessDraft(buildDraftFromFields(detail.process.form_fields, detail.process_row?.data));
        setFormAttachments(Array.isArray(detail.attachments) ? detail.attachments : []);
        setAttachmentError('');
        setAttachmentNotice('');
        setFormIt360Tasks(it360Rows.length > 0 ? it360Rows : [createEmptyIt360TaskRow()]);
        setFormReferenceTasks(referenceRows.length > 0 ? referenceRows : [createEmptyReferenceTaskRow()]);
        setTaskReferenceSearchTerm('');
        setTaskReferenceSearchResults([]);
        setTaskReferenceSearchError('');
        setIsTaskReferenceSearchLoading(false);
        taskReferenceSearchRequestVersionRef.current += 1;
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải chi tiết yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeEditorProcessCode, createInitialProcess?.form_fields, isCreateMode, masterFields, onNotify, selectedRequestId]);

  useEffect(() => {
    if (activeTaskTab !== 'REFERENCE') {
      return;
    }

    const searchTerm = taskReferenceSearchTerm.trim();
    taskReferenceSearchRequestVersionRef.current += 1;
    const requestVersion = taskReferenceSearchRequestVersionRef.current;

    setIsTaskReferenceSearchLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const items = await fetchCustomerRequestReferenceSearch({
            q: searchTerm,
            exclude_id: isCreateMode ? null : selectedRequestId,
            limit: 20,
          });
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion) {
            return;
          }

          setTaskReferenceSearchResults(Array.isArray(items) ? items : []);
          setTaskReferenceSearchError('');
        } catch (error) {
          if (taskReferenceSearchRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
            return;
          }

          setTaskReferenceSearchResults([]);
          setTaskReferenceSearchError(error instanceof Error ? error.message : 'Không tải được danh sách task tham chiếu.');
        } finally {
          if (taskReferenceSearchRequestVersionRef.current === requestVersion) {
            setIsTaskReferenceSearchLoading(false);
          }
        }
      })();
    }, searchTerm === '' ? 0 : 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTaskTab, isCreateMode, selectedRequestId, taskReferenceSearchTerm]);

  const editorProcessMeta = isCreateMode
    ? createInitialProcess
    : processDetail?.process ?? findProcessByCode(catalog, activeEditorProcessCode);

  const transitionOptions = useMemo(() => {
    if (isCreateMode || !processDetail) {
      return [];
    }

    const currentCode = processDetail.current_process?.process_code || processDetail.yeu_cau?.trang_thai || '';

    const options = (processDetail.allowed_next_processes || [])
      .filter((item): item is YeuCauProcessMeta => Boolean(item))
      .filter((item) => item.process_code !== currentCode)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.process_code === item.process_code) === index);

    return options;
  }, [isCreateMode, processDetail]);

  const canEditActiveForm = canWriteRequests && (isCreateMode || Boolean(processDetail?.can_write));
  const canDeleteActiveRequest =
    Boolean(canDeleteRequests || isAdminViewer) && !isCreateMode && selectedRequestId !== null && !isSaving && !isDeleting;

  const defaultProcessor = useMemo(
    () => projectRaciRows.find((row) => row.raci_role === 'A') ?? null,
    [projectRaciRows]
  );

  const currentUserName = useMemo(() => {
    const user = employeeById.get(normalizeText(currentUserId));
    return normalizeText(user?.full_name || user?.username);
  }, [currentUserId, employeeById]);

  const relatedSummaryItems = useMemo(() => {
    const persistedCreatorName = normalizeText(processDetail?.yeu_cau?.created_by_name || processDetail?.yeu_cau?.nguoi_tao_name);
    const creatorName = isCreateMode ? currentUserName || 'Sẽ ghi theo tài khoản đang đăng nhập' : persistedCreatorName || '--';
    const createdAt = isCreateMode ? 'Ghi khi bấm Lưu' : formatDateTimeDdMmYyyy(processDetail?.yeu_cau?.created_at || null) || '--';
    const processorName =
      normalizeText(
        people.find((person) => person.vai_tro === 'nguoi_xu_ly')?.user_name ||
          defaultProcessor?.full_name ||
          defaultProcessor?.username
      ) || (selectedProjectId ? 'Chưa có vai trò A trong RACI dự án' : 'Chọn Khách hàng | Dự án | Sản phẩm');

    return [
      { label: 'Người xử lý mặc định', value: processorName },
      { label: 'Người tạo yêu cầu', value: creatorName },
      { label: 'Thời gian tạo', value: createdAt },
    ];
  }, [currentUserName, defaultProcessor, isCreateMode, people, processDetail?.yeu_cau?.created_at, processDetail?.yeu_cau?.created_by_name, processDetail?.yeu_cau?.nguoi_tao_name, selectedProjectId]);

  const applyCustomerScopeToDraft = (draft: DraftState, customerId: string): DraftState => {
    const next = { ...draft };
    const normalizedCustomerId = normalizeText(customerId);

    const selectedPersonnel = customerPersonnelById.get(normalizeText(next.customer_personnel_id));
    if (selectedPersonnel && normalizeText(selectedPersonnel.customerId) !== normalizedCustomerId) {
      next.customer_personnel_id = '';
    }

    const selectedSupportGroup = supportServiceGroupById.get(normalizeText(next.support_service_group_id));
    if (selectedSupportGroup) {
      const groupCustomerId = normalizeText(selectedSupportGroup.customer_id);
      if (groupCustomerId && groupCustomerId !== normalizedCustomerId) {
        next.support_service_group_id = '';
      }
    }

    const selectedProjectItem = projectItemById.get(normalizeText(next.project_item_id));
    if (selectedProjectItem) {
      const itemCustomerId = normalizeText(selectedProjectItem.customer_id);
      if (itemCustomerId && itemCustomerId !== normalizedCustomerId) {
        next.project_item_id = '';
        next.project_id = '';
        next.product_id = '';
      }
    }

    if (normalizedCustomerId !== '') {
      const singleSupportGroup = findSingleSupportGroupForCustomer(supportServiceGroups, normalizedCustomerId);
      if (singleSupportGroup) {
        next.support_service_group_id = String(singleSupportGroup.id);
      }
    }

    return next;
  };

  const handleMasterFieldChange = (fieldName: string, value: unknown) => {
    setMasterDraft((current) => {
      const next: DraftState = {
        ...current,
        [fieldName]: value,
      };

      if (fieldName === 'project_item_id') {
        const selectedProjectItem = projectItemById.get(normalizeText(value));
        if (!selectedProjectItem) {
          next.project_id = '';
          next.product_id = '';
          return next;
        }

        next.project_id = selectedProjectItem.project_id != null ? String(selectedProjectItem.project_id) : '';
        next.product_id = selectedProjectItem.product_id != null ? String(selectedProjectItem.product_id) : '';

        const linkedCustomerId = normalizeText(selectedProjectItem.customer_id);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }

        return next;
      }

      if (fieldName === 'customer_id') {
        const nextCustomerId = normalizeText(value);
        if (!nextCustomerId) {
          next.customer_personnel_id = '';
          next.support_service_group_id = '';
          return applyCustomerScopeToDraft(next, nextCustomerId);
        }

        return applyCustomerScopeToDraft(next, nextCustomerId);
      }

      if (fieldName === 'customer_personnel_id') {
        const selectedPersonnel = customerPersonnelById.get(normalizeText(value));
        const linkedCustomerId = normalizeText(selectedPersonnel?.customerId);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }
        return next;
      }

      if (fieldName === 'support_service_group_id') {
        const selectedSupportGroup = supportServiceGroupById.get(normalizeText(value));
        const linkedCustomerId = normalizeText(selectedSupportGroup?.customer_id);
        if (linkedCustomerId) {
          next.customer_id = linkedCustomerId;
          return applyCustomerScopeToDraft(next, linkedCustomerId);
        }
        return next;
      }

      return next;
    });
  };

  const addTaskRowByActiveTab = () => {
    if (activeTaskTab === 'REFERENCE') {
      setFormReferenceTasks((current) => [...current, createEmptyReferenceTaskRow()]);
      return;
    }

    setFormIt360Tasks((current) => [...current, createEmptyIt360TaskRow()]);
  };

  const updateIt360TaskRow = (localId: string, fieldName: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => {
    setFormIt360Tasks((current) =>
      current.map((task) =>
        task.local_id === localId
          ? {
              ...task,
              [fieldName]:
                fieldName === 'status'
                  ? normalizeSupportTaskStatus(value)
                  : normalizeText(value),
            }
          : task
      )
    );
  };

  const removeIt360TaskRow = (localId: string) => {
    setFormIt360Tasks((current) => {
      const next = current.filter((task) => task.local_id !== localId);
      return next.length > 0 ? next : [createEmptyIt360TaskRow()];
    });
  };

  const updateReferenceTaskRow = (localId: string, value: string) => {
    const selectedTask = taskReferenceLookup.get(String(value));
    const taskCode = normalizeText(selectedTask?.task_code ?? value);
    const taskId = selectedTask?.id ?? null;

    setFormReferenceTasks((current) =>
      current.map((task) =>
        task.local_id === localId
          ? {
              ...task,
              id: taskId,
              task_code: taskCode,
            }
          : task
      )
    );
  };

  const removeReferenceTaskRow = (localId: string) => {
    setFormReferenceTasks((current) => {
      const next = current.filter((task) => task.local_id !== localId);
      return next.length > 0 ? next : [createEmptyReferenceTaskRow()];
    });
  };

  const handleUploadAttachment = async (file: File) => {
    if (!canEditActiveForm) {
      return;
    }

    setAttachmentError('');
    setAttachmentNotice('');
    setIsUploadingAttachment(true);

    try {
      const uploaded = await uploadDocumentAttachment(file);
      setFormAttachments((current) => [...current, uploaded]);
      if (normalizeText(uploaded.warningMessage) !== '') {
        setAttachmentNotice(normalizeText(uploaded.warningMessage));
      }
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Tải file thất bại.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    if (!canEditActiveForm) {
      return;
    }

    const confirmed = window.confirm('Gỡ file này khỏi yêu cầu? File đã tải lên sẽ không bị xóa khỏi kho lưu trữ.');
    if (!confirmed) {
      return;
    }

    setAttachmentError('');
    setAttachmentNotice('');
    setFormAttachments((current) => current.filter((attachment) => String(attachment.id) !== String(id)));
  };

  const buildRefTaskPayload = (): Array<Record<string, unknown>> => {
    const it360Rows = dedupeIt360TaskRows(
      formIt360Tasks
        .map((task, index) =>
          createEmptyIt360TaskRow({
            ...task,
            task_code: normalizeText(task.task_code),
            task_link: normalizeText(task.task_link),
            status: normalizeSupportTaskStatus(task.status),
            id: task.id ?? null,
            local_id: task.local_id || `task-${index}`,
          })
        )
        .filter((task) => normalizeText(task.task_code) !== '' || normalizeText(task.task_link) !== '')
    );

    const referenceRows = dedupeReferenceTaskRows(
      formReferenceTasks
        .map((task, index) =>
          createEmptyReferenceTaskRow({
            ...task,
            task_code: normalizeText(task.task_code),
            id: task.id ?? null,
            local_id: task.local_id || `reference-${index}`,
          })
        )
        .filter((task) => normalizeText(task.task_code) !== '')
    );

    return [
      ...it360Rows.map((task, index) => ({
        id: task.id ?? undefined,
        task_source: 'IT360',
        task_code: normalizeText(task.task_code) || null,
        task_link: normalizeText(task.task_link) || null,
        task_status: normalizeSupportTaskStatus(task.status),
        sort_order: index,
      })),
      ...referenceRows.map((task, index) => ({
        id: task.id ?? undefined,
        task_source: 'REFERENCE',
        task_code: normalizeText(task.task_code) || null,
        sort_order: it360Rows.length + index,
      })),
    ];
  };

  const handleCreateMode = () => {
    startTransition(() => {
      setActiveViewTab('form');
      setIsCreateMode(true);
      setSelectedRequestId(null);
      setActiveEditorProcessCode('new_intake');
    });
  };

  const handleDelete = async () => {
    if (!canDeleteActiveRequest || selectedRequestId === null) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteYeuCau(selectedRequestId);
      onNotify('success', 'Đã xóa yêu cầu', 'Yêu cầu đã được xóa thành công.');
      startTransition(() => {
        setSelectedRequestId(null);
        setProcessDetail(null);
        setPeople([]);
        setMasterDraft({});
        setProcessDraft({});
      });
      const nextCatalog = await fetchYeuCauProcessCatalog();
      setCatalog(nextCatalog);
      if (activeProcessCode) {
        const nextPage = await fetchYeuCauPage({
          page: 1,
          per_page: 50,
          process_code: activeProcessCode,
        });
        setListRows(nextPage.data);
      } else {
        setListRows([]);
      }
    } catch (error) {
      onNotify('error', 'Không thể xóa yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editorProcessMeta) {
      onNotify('error', 'Chưa xác định tiến trình', 'Vui lòng chọn một tiến trình hợp lệ để lưu.');
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode) {
        const created = await createYeuCau({
          ...buildPayloadFromDraft(masterFields, masterDraft),
          created_by: currentUserId,
          nguoi_tao_id: currentUserId,
          status_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
          attachments: formAttachments,
          ref_tasks: buildRefTaskPayload(),
        });

        onNotify('success', 'Đã tạo yêu cầu', `Yêu cầu ${created.ma_yc} đã được tạo thành công.`);
        setIsCreateMode(false);
        startTransition(() => {
          setActiveProcessCode(created.tien_trinh_hien_tai || 'new_intake');
          setSelectedRequestId(created.id);
          setActiveEditorProcessCode(created.tien_trinh_hien_tai || 'new_intake');
        });
      } else if (selectedRequestId !== null) {
        const saved = await saveYeuCauProcess(selectedRequestId, editorProcessMeta.process_code, {
          ...buildPayloadFromDraft(masterFields, masterDraft),
          updated_by: currentUserId,
          status_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
          attachments: formAttachments,
          ref_tasks: buildRefTaskPayload(),
        });

        const nextProcessCode = saved.tien_trinh_hien_tai || editorProcessMeta.process_code;
        onNotify(
          'success',
          'Đã lưu yêu cầu',
          editorProcessMeta.process_code === processDetail?.current_process?.process_code
            ? `Yêu cầu ${saved.ma_yc} đã được cập nhật.`
            : `Yêu cầu ${saved.ma_yc} đã chuyển sang ${findProcessByCode(catalog, nextProcessCode)?.process_label || nextProcessCode}.`
        );

        startTransition(() => {
          setActiveProcessCode(nextProcessCode);
          setSelectedRequestId(saved.id);
          setActiveEditorProcessCode(nextProcessCode);
        });
      }

      const nextCatalog = await fetchYeuCauProcessCatalog();
      setCatalog(nextCatalog);
    } catch (error) {
      onNotify('error', 'Không thể lưu yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mở modal — reset các state của modal rồi mở
  const openTransitionModal = () => {
    const today = formatCurrentDateForDateInput();
    setModalStatusPayload({
      feedback_requested_at: today,
      customer_due_at: today,
      started_at: today,
      expected_completed_at: today,
      decision_at: today,
      completed_at: today,
      notified_at: today,
      returned_at: today,
      analysis_completed_at: today,
    });
    setModalIt360Tasks([]);
    setModalRefTasks([]);
    setModalAttachments([]);
    setModalNotes('');
    setModalActiveTaskTab('IT360');
    setShowTransitionModal(true);
  };

  // Upload file trong modal
  const handleModalUpload = async (file: File) => {
    setIsModalUploading(true);
    try {
      const uploaded = await uploadDocumentAttachment(file);
      setModalAttachments((prev) => [...prev, uploaded]);
    } catch {
      onNotify('error', 'Upload thất bại', 'Không thể tải file lên. Vui lòng thử lại.');
    } finally {
      setIsModalUploading(false);
    }
  };

  // Xác nhận chuyển trạng thái từ modal
  const handleTransitionConfirm = async () => {
    if (!selectedRequestId || !transitionStatusCode) return;

    // Validate
    if (transitionStatusCode === 'not_executed' && !String(modalStatusPayload.decision_reason ?? '').trim()) {
      onNotify('error', 'Thiếu thông tin', 'Vui lòng nhập lý do không thực hiện.');
      return;
    }
    if (transitionStatusCode === 'waiting_customer_feedback') {
      const d1 = String(modalStatusPayload.feedback_requested_at ?? '');
      const d2 = String(modalStatusPayload.customer_due_at ?? '');
      if (d1 && d2 && d1 > d2) {
        onNotify('error', 'Ngày không hợp lệ', 'Ngày phản hồi KH không được sau Ngày KH phản hồi.');
        return;
      }
    }

    setIsTransitioning(true);
    try {
      const modalIt360Payload = modalIt360Tasks
        .filter((t) => t.task_code.trim() !== '')
        .map((t) => ({ task_code: t.task_code, task_link: t.task_link, status: t.status, task_source: 'IT360' }));

      const modalRefPayload = modalRefTasks
        .filter((t) => t.task_code.trim() !== '' || t.id != null)
        .map((t) => ({ id: t.id, task_code: t.task_code, task_source: 'REFERENCE' }));

      const transitioned = await transitionCustomerRequestCase(selectedRequestId, transitionStatusCode, {
        ...modalStatusPayload,
        notes: modalNotes || undefined,
        ref_tasks: [...modalIt360Payload, ...modalRefPayload],
        attachments: modalAttachments.map((a) => ({ id: a.id })),
      });

      const newStatusMeta = STATUS_COLOR_MAP[transitionStatusCode];
      onNotify('success', 'Đã chuyển trạng thái', `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} → "${newStatusMeta?.label ?? transitionStatusCode}".`);

      setShowTransitionModal(false);

      // Refresh catalog + detail
      const nextCatalog = await fetchYeuCauProcessCatalog();
      setCatalog(nextCatalog);
      startTransition(() => {
        setActiveProcessCode(transitionStatusCode);
        setActiveEditorProcessCode(transitionStatusCode);
        setSelectedRequestId(transitioned.id ?? selectedRequestId);
      });
    } catch (error) {
      onNotify('error', 'Chuyển trạng thái thất bại', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsTransitioning(false);
    }
  };

  // Sync transitionStatusCode → chỉ giữ trạng thái đích hợp lệ, không cho trùng trạng thái hiện tại.
  useEffect(() => {
    if (isCreateMode) {
      setTransitionStatusCode('');
      return;
    }

    const validCodes = transitionOptions.map((option) => option.process_code);
    setTransitionStatusCode((prev) => {
      const isValid = prev !== '' && validCodes.includes(prev);
      if (isValid) return prev;
      return validCodes[0] ?? '';
    });
  }, [isCreateMode, processDetail?.yeu_cau?.id, transitionOptions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // F1 → Lưu / Cập nhật
      if (event.key === 'F1') {
        event.preventDefault();
        if (!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting) return;
        void handleSave();
        return;
      }

      if (!ctrlOrCmd) return;

      // Ctrl/Cmd + N → Tạo yêu cầu mới
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        if (!canWriteRequests || isSaving) return;
        handleCreateMode();
        return;
      }

      // Ctrl/Cmd + U → Cập nhật yêu cầu
      if (event.key === 'u' || event.key === 'U') {
        event.preventDefault();
        if (!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting) return;
        void handleSave();
        return;
      }

      // Ctrl/Cmd + D → Xóa yêu cầu
      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        if (!canDeleteActiveRequest || isDeleting || isSaving) return;
        void handleDelete();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canWriteRequests, canEditActiveForm, canDeleteActiveRequest, editorProcessMeta, handleSave, handleCreateMode, handleDelete, isDeleting, isSaving]);

  if (!canReadRequests) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Quản lý yêu cầu khách hàng</h2>
        <p className="mt-3 text-sm text-slate-500">Bạn chưa có quyền xem module này.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
      <div className="sticky top-0 z-30 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Quản lý yêu cầu khách hàng</h2>

          <div className="flex flex-wrap items-center gap-3">
            {/* Nút Xóa — chỉ hiện khi đang xem form chi tiết (không phải tạo mới) */}
            {activeViewTab === 'form' && !isCreateMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDeleteActiveRequest || isDeleting || isSaving}
                title="Xóa yêu cầu (Ctrl+D / ⌘D)"
                className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isDeleting ? 'progress_activity' : 'delete'}</span>
                Xóa yêu cầu
              </button>
            )}

            {/* Nút Cập nhật / Lưu — chỉ hiện khi đang xem form */}
            {(activeViewTab === 'form' || isCreateMode) && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEditActiveForm || !editorProcessMeta || isSaving || isDeleting}
                title={isCreateMode ? 'Lưu (F1)' : 'Cập nhật yêu cầu (Ctrl+U / ⌘U)'}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isSaving ? 'progress_activity' : 'save'}</span>
                {isCreateMode
                  ? 'Lưu (F1)'
                  : editorProcessMeta?.process_code !== processDetail?.current_process?.process_code
                  ? `Chuyển sang ${editorProcessMeta?.process_label || 'tiến trình mới'}`
                  : 'Cập nhật yêu cầu'}
              </button>
            )}

            {/* Nút Tạo mới — luôn hiển thị */}
            <button
              type="button"
              onClick={handleCreateMode}
              disabled={!canWriteRequests || isSaving}
              title="Tạo yêu cầu mới (Ctrl+N / ⌘N)"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Tạo yêu cầu mới
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              {(isCreateMode || activeViewTab === 'form') && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {isCreateMode ? 'Tạo mới' : 'Nhập yêu cầu'}
                </p>
              )}
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {isCreateMode
                  ? 'Yêu cầu mới'
                  : activeViewTab === 'list'
                  ? 'Danh sách yêu cầu'
                  : processDetail?.yeu_cau?.tieu_de || 'Chọn một yêu cầu để thao tác'}
              </h3>
              {!isCreateMode && activeViewTab === 'form' && processDetail ? (
                <p className="mt-2 text-sm text-slate-500">
                  Tiến trình hiện tại: <span className="font-semibold text-slate-700">{processDetail.current_process?.process_label || '--'}</span>
                  {' · '}
                  Kết quả: <span className="font-semibold text-slate-700">{humanizeKetQua(processDetail.yeu_cau.ket_qua)}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mb-6 border-b border-slate-100 pb-4">
            <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1 lg:w-auto">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    if (isCreateMode) {
                      setIsCreateMode(false);
                    }
                    setActiveViewTab('list');
                  });
                }}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition lg:flex-none ${
                  !isCreateMode && activeViewTab === 'list'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Danh sách YC
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setActiveViewTab('form');
                  });
                }}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition lg:flex-none ${
                  activeViewTab === 'form'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Nhập yêu cầu
              </button>
            </div>
          </div>

          {!isCreateMode && activeViewTab === 'list' ? (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {/* ── Header ── */}
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Danh sách yêu cầu tiếp nhận</h4>
                  <p className="mt-1 text-sm text-slate-500">Lọc nhanh danh sách theo tiến trình, khách hàng, kênh tiếp nhận và độ ưu tiên.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                  {filteredRequestRows.length} / {listRows.length} yêu cầu
                </span>
              </div>

              {/* ── Filters ── */}
              <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_180px_180px_160px_160px]">
                <SearchableSelect
                  value={activeProcessCode}
                  options={(catalog?.groups || []).flatMap((group) =>
                    group.processes.map((process) => ({
                      value: process.process_code,
                      label: `${group.group_label} · ${process.process_label}`,
                      searchText: `${group.group_label} ${process.process_label} ${process.table_name}`,
                    }))
                  )}
                  onChange={(nextValue) => {
                    startTransition(() => {
                      setActiveProcessCode(nextValue);
                      setActiveEditorProcessCode(nextValue);
                      setSelectedRequestId(null);
                      setListPage(1);
                    });
                  }}
                  label="Tiến trình"
                  placeholder={isCatalogLoading ? 'Đang tải tiến trình...' : 'Chọn tiến trình'}
                  searchPlaceholder="Tìm tiến trình..."
                  disabled={isCatalogLoading || (catalog?.groups || []).length === 0}
                  compact
                />

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tìm kiếm</label>
                  <input
                    type="text"
                    value={requestKeyword}
                    onChange={(event) => { setRequestKeyword(event.target.value); setListPage(1); }}
                    placeholder="Tìm theo mã YC, nội dung, khách hàng..."
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <SearchableSelect
                  value={requestCustomerFilter}
                  options={[{ value: '', label: 'Tất cả khách hàng' }, ...customerOptions]}
                  onChange={(v) => { setRequestCustomerFilter(v); setListPage(1); }}
                  label="Khách hàng"
                  placeholder="Tất cả khách hàng"
                  searchPlaceholder="Tìm khách hàng..."
                  compact
                />

                <SearchableSelect
                  value={requestSupportGroupFilter}
                  options={[
                    { value: '', label: 'Tất cả kênh tiếp nhận' },
                    ...supportServiceGroups.map((group) => ({
                      value: String(group.id),
                      label: group.group_name,
                      searchText: `${group.group_name} ${group.group_code || ''} ${group.customer_name || ''}`,
                    })),
                  ]}
                  onChange={(v) => { setRequestSupportGroupFilter(v); setListPage(1); }}
                  label="Kênh tiếp nhận"
                  placeholder="Tất cả kênh tiếp nhận"
                  searchPlaceholder="Tìm kênh tiếp nhận..."
                  compact
                />

                <SearchableSelect
                  value={requestPriorityFilter}
                  options={[{ value: '', label: 'Tất cả ưu tiên' }, ...PRIORITY_OPTIONS]}
                  onChange={(v) => { setRequestPriorityFilter(v); setListPage(1); }}
                  label="Độ ưu tiên"
                  placeholder="Tất cả ưu tiên"
                  searchPlaceholder="Tìm độ ưu tiên..."
                  compact
                />

                <SearchableSelect
                  value={requestStatusFilter}
                  options={[
                    { value: '', label: 'Tất cả trạng thái' },
                    ...Object.entries(STATUS_COLOR_MAP).map(([code, meta]) => ({
                      value: code,
                      label: meta.label,
                    })),
                  ]}
                  onChange={(v) => { setRequestStatusFilter(v); setListPage(1); }}
                  label="Trạng thái xử lý"
                  placeholder="Tất cả trạng thái"
                  searchPlaceholder="Tìm trạng thái..."
                  compact
                />
              </div>

              {/* ── Items ── */}
              {(() => {
                const totalPages = Math.max(1, Math.ceil(filteredRequestRows.length / LIST_PAGE_SIZE));
                const safePage = Math.min(listPage, totalPages);
                const pageRows = filteredRequestRows.slice((safePage - 1) * LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE);

                const priorityBadge = (val: string | number | undefined) => {
                  const map: Record<string, { label: string; cls: string }> = {
                    '4': { label: 'Khẩn', cls: 'bg-red-100 text-red-700' },
                    '3': { label: 'Cao',  cls: 'bg-orange-100 text-orange-700' },
                    '2': { label: 'Trung bình', cls: 'bg-blue-100 text-blue-700' },
                    '1': { label: 'Thấp', cls: 'bg-slate-100 text-slate-500' },
                  };
                  const key = String(val ?? '');
                  const entry = map[key];
                  if (!entry) return null;
                  return (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${entry.cls}`}>
                      ⚡ {entry.label}
                    </span>
                  );
                };

                const ketQuaBadge = (val: string) => {
                  const map: Record<string, { label: string; cls: string }> = {
                    dang_xu_ly:       { label: 'Đang xử lý',      cls: 'bg-amber-100 text-amber-700' },
                    hoan_thanh:       { label: 'Hoàn thành',       cls: 'bg-emerald-100 text-emerald-700' },
                    khong_tiep_nhan:  { label: 'Không tiếp nhận',  cls: 'bg-slate-100 text-slate-500' },
                    ket_thuc:         { label: 'Kết thúc',         cls: 'bg-slate-100 text-slate-500' },
                  };
                  const entry = map[val] ?? { label: val || '--', cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${entry.cls}`}>
                      {entry.label}
                    </span>
                  );
                };

                const processBadge = (label: string | undefined, statusCode: string | undefined) => {
                  if (!label && !statusCode) return null;
                  const meta = statusCode ? STATUS_COLOR_MAP[statusCode] : undefined;
                  const cls = meta ? meta.cls : 'bg-sky-100 text-sky-700';
                  const text = meta ? meta.label : (label ?? statusCode ?? '--');
                  return (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
                      ● {text}
                    </span>
                  );
                };

                const daysSince = (dateStr: string | null | undefined): string => {
                  if (!dateStr) return '--';
                  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
                  if (diff === 0) return 'Hôm nay';
                  if (diff === 1) return '1 ngày';
                  return `${diff} ngày`;
                };

                return (
                  <>
                    <div className="mt-4 space-y-2.5">
                      {isListLoading ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                          Đang tải danh sách yêu cầu...
                        </div>
                      ) : filteredRequestRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                          Không có yêu cầu nào phù hợp với bộ lọc hiện tại.
                        </div>
                      ) : (
                        pageRows.map((row) => {
                          const isActive = String(row.id) === String(selectedRequestId);
                          const processLabel = (() => {
                            const code = row.tien_trinh_hien_tai;
                            if (!code || !catalog) return undefined;
                            for (const group of catalog.groups) {
                              const found = group.processes.find((p) => p.process_code === code);
                              if (found) return found.process_label;
                            }
                            return code;
                          })();

                          return (
                            <button
                              key={String(row.id)}
                              type="button"
                              onClick={() => {
                                startTransition(() => {
                                  setSelectedRequestId(row.id);
                                  setActiveEditorProcessCode(row.tien_trinh_hien_tai || activeProcessCode);
                                  setActiveViewTab('form');
                                });
                              }}
                              className={`w-full rounded-2xl border px-4 py-3.5 text-left transition ${
                                isActive
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50'
                              }`}
                            >
                              {/* Dòng 1: Badges + ngày giờ */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                    {row.ma_yc}
                                  </span>
                                  {processBadge(processLabel, row.trang_thai)}
                                  {ketQuaBadge(row.ket_qua)}
                                  {priorityBadge(row.do_uu_tien)}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {formatDateTimeDdMmYyyy(row.received_at || null)}
                                </span>
                              </div>

                              {/* Dòng 2: Tiêu đề */}
                              <p className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
                                {row.tieu_de || row.summary || '--'}
                              </p>

                              {/* Dòng 3: Meta info */}
                              <p className="mt-1.5 text-xs text-slate-500">
                                {row.khach_hang_name || row.customer_name || '--'}
                                {row.support_service_group_name ? ` · ${row.support_service_group_name}` : ''}
                                {row.requester_name ? ` · YC: ${row.requester_name}` : ''}
                              </p>

                              {/* Dòng 4: Người xử lý + thời gian xử lý */}
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-400">
                                  {row.assignee_name ? `👤 ${row.assignee_name}` : ''}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  ⏱ {daysSince(row.received_at)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* ── Phân trang ── */}
                    {filteredRequestRows.length > LIST_PAGE_SIZE && (
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => setListPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                          Trước
                        </button>

                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                              if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                                acc.push('...');
                              }
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, idx) =>
                              p === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                              ) : (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setListPage(p as number)}
                                  className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition ${
                                    p === safePage
                                      ? 'bg-primary text-white shadow-sm'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                  }`}
                                >
                                  {p}
                                </button>
                              )
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Sau
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : null}

          {activeViewTab === 'form' && isDetailLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">Đang tải chi tiết yêu cầu...</div>
          ) : activeViewTab === 'form' && !isCreateMode && !processDetail ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              {isListLoading
                ? 'Đang tải yêu cầu trong tiến trình này.'
                : 'Chọn một yêu cầu ở tab Danh sách YC hoặc tạo yêu cầu mới.'}
            </div>
          ) : activeViewTab === 'form' ? (
            <div className="space-y-6">

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="self-start rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                  {/* ── TRẠNG THÁI XỬ LÝ ── compact card ── */}
                  {!isCreateMode && (
                    <div className="mb-6 pb-6 border-b border-slate-100">
                      <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Trạng thái xử lý</h4>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Badge trạng thái hiện tại */}
                        {(() => {
                          const code = processDetail?.yeu_cau?.trang_thai ?? '';
                          const meta = STATUS_COLOR_MAP[code];
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${meta ? meta.cls : 'bg-slate-100 text-slate-500'}`}>
                              ● {meta ? meta.label : (processDetail?.yeu_cau?.current_status_name_vi ?? code ?? '--')}
                            </span>
                          );
                        })()}

                        {canEditActiveForm && transitionOptions.length > 0 && (
                          <>
                            <span className="material-symbols-outlined text-slate-300 text-[18px]">arrow_forward</span>

                            {/* Dropdown chọn trạng thái đích */}
                            <select
                              value={transitionStatusCode}
                              onChange={(e) => {
                                const chosen = e.target.value;
                                if (chosen !== (processDetail?.yeu_cau?.trang_thai ?? '')) {
                                  setTransitionStatusCode(chosen);
                                }
                              }}
                              disabled={isSaving}
                              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                            >
                              {transitionOptions.map((option) => {
                                const meta = STATUS_COLOR_MAP[option.process_code];
                                return (
                                  <option key={option.process_code} value={option.process_code}>
                                    {meta?.label || option.process_label}
                                  </option>
                                );
                              })}
                            </select>

                            {/* Nút mở modal — chỉ hiện khi chọn TT khác */}
                            {transitionStatusCode !== (processDetail?.yeu_cau?.trang_thai ?? '') && (
                              <button
                                type="button"
                                onClick={openTransitionModal}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                                Chuyển →
                              </button>
                            )}
                          </>
                        )}

                        {canEditActiveForm && transitionOptions.length === 0 ? (
                          <span className="text-xs font-medium text-slate-400">
                            Không có trạng thái đích hợp lệ từ bước hiện tại.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* ── THÔNG TIN YÊU CẦU ── */}
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Thông tin yêu cầu</h4>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {masterFields.map((field) => {
                        if (field.type === 'hidden') {
                          return null;
                        }

                        return (
                          <div
                            key={field.name}
                            className={
                              field.name === 'project_item_id' || field.name === 'summary' || field.name === 'description'
                                ? 'md:col-span-2'
                                : undefined
                            }
                          >
                            <ProcessFieldInput
                              field={field}
                              value={masterDraft[field.name]}
                              customers={customers}
                              employees={employees}
                              customerPersonnel={customerPersonnel}
                              supportServiceGroups={supportServiceGroups}
                              projectItems={availableProjectItems}
                              selectedCustomerId={selectedCustomerId}
                              disabled={!canEditActiveForm || isSaving}
                              onChange={handleMasterFieldChange}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {editorProcessMeta && editorProcessMeta.form_fields.length > 0 ? (
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <div className="mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{editorProcessMeta.process_label}</h4>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {editorProcessMeta.form_fields.map((field) => (
                          <ProcessFieldInput
                            key={field.name}
                            field={field}
                            value={processDraft[field.name]}
                            customers={customers}
                            employees={employees}
                            customerPersonnel={customerPersonnel}
                            supportServiceGroups={supportServiceGroups}
                            projectItems={availableProjectItems}
                            selectedCustomerId={normalizeText(masterDraft.customer_id)}
                            disabled={!canEditActiveForm || isSaving}
                            onChange={(fieldName, value) =>
                              setProcessDraft((current) => ({
                                ...current,
                                [fieldName]: value,
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Task liên quan & file đính kèm</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Tái sử dụng task IT360, task tham chiếu và kho file đính kèm từ module cũ để đi cùng yêu cầu.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTaskTab('IT360')}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            activeTaskTab === 'IT360'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">deployed_code</span>
                          Task IT360
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTaskTab('REFERENCE')}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            activeTaskTab === 'REFERENCE'
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">dataset_linked</span>
                          Task tham chiếu
                        </button>
                        {canEditActiveForm ? (
                          <button
                            type="button"
                            onClick={addTaskRowByActiveTab}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            {activeTaskTab === 'IT360' ? 'Thêm Task IT360' : 'Thêm task tham chiếu'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        {activeTaskTab === 'IT360' ? (
                          <div className="space-y-2">
                            {formIt360Tasks.map((task, index) => (
                              <div
                                key={task.local_id}
                                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_220px_auto]"
                              >
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task IT360 #{index + 1}</p>
                                  <input
                                    type="text"
                                    value={task.task_code}
                                    onChange={(event) => updateIt360TaskRow(task.local_id, 'task_code', event.target.value)}
                                    placeholder={`Nhập mã task IT360 #${index + 1}`}
                                    disabled={!canEditActiveForm || isSaving}
                                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Link task</p>
                                  <input
                                    type="text"
                                    value={task.task_link}
                                    onChange={(event) => updateIt360TaskRow(task.local_id, 'task_link', event.target.value)}
                                    placeholder="Link task IT360"
                                    disabled={!canEditActiveForm || isSaving}
                                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p>
                                  <SearchableSelect
                                    value={task.status}
                                    options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                                    onChange={(value) => updateIt360TaskRow(task.local_id, 'status', value)}
                                    disabled={!canEditActiveForm || isSaving}
                                    compact
                                  />
                                </div>

                                <div className="flex items-end justify-end">
                                  {canEditActiveForm ? (
                                    <button
                                      type="button"
                                      onClick={() => removeIt360TaskRow(task.local_id)}
                                      className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                      title="Xoá task IT360"
                                    >
                                      delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {formReferenceTasks.map((task, index) => (
                              <div
                                key={task.local_id}
                                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                              >
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Task tham chiếu #{index + 1}
                                  </p>
                                  <SearchableSelect
                                    value={task.id != null ? String(task.id) : task.task_code}
                                    options={taskReferenceOptions}
                                    onChange={(value) => updateReferenceTaskRow(task.local_id, value)}
                                    onSearchTermChange={setTaskReferenceSearchTerm}
                                    placeholder={`Chọn task tham chiếu #${index + 1}`}
                                    searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                                    noOptionsText={
                                      taskReferenceSearchError ||
                                      (taskReferenceSearchTerm.trim() === ''
                                        ? 'Nhập mã task hoặc mã yêu cầu để lọc thêm, hoặc chọn từ danh sách gợi ý.'
                                        : 'Không tìm thấy task tham chiếu')
                                    }
                                    searching={isTaskReferenceSearchLoading}
                                    disabled={!canEditActiveForm || isSaving}
                                    compact
                                  />
                                  {taskReferenceSearchError ? (
                                    <p className="text-xs text-rose-600">{taskReferenceSearchError}</p>
                                  ) : null}
                                </div>

                                <div className="flex items-end justify-end">
                                  {canEditActiveForm ? (
                                    <button
                                      type="button"
                                      onClick={() => removeReferenceTaskRow(task.local_id)}
                                      className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                      title="Xoá task tham chiếu"
                                    >
                                      delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <AttachmentManager
                        attachments={formAttachments}
                        onUpload={handleUploadAttachment}
                        onDelete={handleRemoveAttachment}
                        isUploading={isUploadingAttachment}
                        disabled={!canEditActiveForm || isSaving}
                        helperText={formAttachments.length > 0 ? "Gắn file đính kèm trực tiếp cho yêu cầu để theo dõi xuyên suốt các bước xử lý." : undefined}
                        emptyStateDescription="Chưa có file đính kèm nào. Kéo thả hoặc Ctrl+V để dán ảnh."
                        enableClipboardPaste
                        clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
                      />

                      {attachmentError ? <p className="text-sm text-rose-600">{attachmentError}</p> : null}
                      {!attachmentError && attachmentNotice ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          {attachmentNotice}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Người liên quan</h4>
                    <div className="mt-4 space-y-3">
                      {relatedSummaryItems.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{item.value || '--'}</p>
                          {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>

    {/* ════════════════════════════════════════════════════════
        MODAL CHUYỂN TRẠNG THÁI
        ════════════════════════════════════════════════════════ */}
    {showTransitionModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget && !isTransitioning) setShowTransitionModal(false); }}
      >
        <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">

          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              {(() => {
                const currentCode = processDetail?.yeu_cau?.trang_thai ?? '';
                const currentMeta = STATUS_COLOR_MAP[currentCode];
                const targetMeta = STATUS_COLOR_MAP[transitionStatusCode];
                return (
                  <>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${currentMeta ? currentMeta.cls : 'bg-slate-100 text-slate-500'}`}>
                      {currentMeta ? currentMeta.label : currentCode}
                    </span>
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">arrow_forward</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${targetMeta ? targetMeta.cls : 'bg-slate-100 text-slate-500'}`}>
                      {targetMeta ? targetMeta.label : transitionStatusCode}
                    </span>
                  </>
                );
              })()}
            </div>
            <button
              type="button"
              onClick={() => setShowTransitionModal(false)}
              disabled={isTransitioning}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* ── Body scrollable ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* 1. Fields đặc thù theo trạng thái đích */}
            {transitionStatusCode !== 'new_intake' && (
              <div>
                <h5 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Thông tin cho trạng thái mới
                </h5>
                <div className="grid gap-3 md:grid-cols-2">

                  {/* waiting_customer_feedback */}
                  {transitionStatusCode === 'waiting_customer_feedback' && (<>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Nội dung cần KH phản hồi</label>
                      <textarea rows={3} value={String(modalStatusPayload.feedback_request_content ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, feedback_request_content: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày phản hồi KH</label>
                      <input type="date" value={String(modalStatusPayload.feedback_requested_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, feedback_requested_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày KH phản hồi</label>
                      <input type="date" value={String(modalStatusPayload.customer_due_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, customer_due_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* in_progress */}
                  {transitionStatusCode === 'in_progress' && (<>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Người thực hiện</label>
                      <select value={String(modalStatusPayload.performer_user_id ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, performer_user_id: e.target.value || null }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50">
                        <option value="">-- Chọn người thực hiện --</option>
                        {employees.map((emp) => (
                          <option key={String(emp.id)} value={String(emp.id)}>{emp.name ?? emp.full_name ?? String(emp.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Tiến độ (%)</label>
                      <input type="number" min={0} max={100} value={String(modalStatusPayload.progress_percent ?? 0)}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, progress_percent: Number(e.target.value) }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày bắt đầu</label>
                      <input type="date" value={String(modalStatusPayload.started_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, started_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày dự kiến hoàn thành</label>
                      <input type="date" value={String(modalStatusPayload.expected_completed_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, expected_completed_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Nội dung xử lý</label>
                      <textarea rows={3} value={String(modalStatusPayload.processing_content ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, processing_content: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* not_executed */}
                  {transitionStatusCode === 'not_executed' && (<>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Lý do không thực hiện <span className="text-red-500">*</span></label>
                      <textarea rows={3} value={String(modalStatusPayload.decision_reason ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, decision_reason: e.target.value }))}
                        disabled={isTransitioning}
                        placeholder="Bắt buộc nhập lý do..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày xác nhận</label>
                      <input type="date" value={String(modalStatusPayload.decision_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, decision_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* completed */}
                  {transitionStatusCode === 'completed' && (<>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Kết quả thực hiện</label>
                      <textarea rows={3} value={String(modalStatusPayload.result_content ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, result_content: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày hoàn thành</label>
                      <input type="date" value={String(modalStatusPayload.completed_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, completed_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* customer_notified */}
                  {transitionStatusCode === 'customer_notified' && (<>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Kênh báo KH</label>
                      <input type="text" value={String(modalStatusPayload.notification_channel ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, notification_channel: e.target.value }))}
                        disabled={isTransitioning}
                        placeholder="Email, Zalo, Điện thoại..."
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày báo KH</label>
                      <input type="date" value={String(modalStatusPayload.notified_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, notified_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Nội dung báo KH</label>
                      <textarea rows={2} value={String(modalStatusPayload.notification_content ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, notification_content: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* returned_to_manager */}
                  {transitionStatusCode === 'returned_to_manager' && (<>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Lý do chuyển trả</label>
                      <textarea rows={3} value={String(modalStatusPayload.return_reason ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, return_reason: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày chuyển trả</label>
                      <input type="date" value={String(modalStatusPayload.returned_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, returned_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                  {/* analysis */}
                  {transitionStatusCode === 'analysis' && (<>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Nội dung phân tích</label>
                      <textarea rows={4} value={String(modalStatusPayload.analysis_content ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, analysis_content: e.target.value }))}
                        disabled={isTransitioning}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày hoàn thành phân tích</label>
                      <input type="date" value={String(modalStatusPayload.analysis_completed_at ?? '')}
                        onChange={(e) => setModalStatusPayload((p) => ({ ...p, analysis_completed_at: e.target.value }))}
                        disabled={isTransitioning}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                    </div>
                  </>)}

                </div>
              </div>
            )}

            {/* 2. Task đính kèm bước này */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Task đính kèm bước này
                </h5>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setModalActiveTaskTab('IT360')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${modalActiveTaskTab === 'IT360' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Task IT360
                  </button>
                  <button type="button"
                    onClick={() => setModalActiveTaskTab('REFERENCE')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${modalActiveTaskTab === 'REFERENCE' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Tham chiếu
                  </button>
                  <button type="button"
                    disabled={isTransitioning}
                    onClick={() => {
                      if (modalActiveTaskTab === 'IT360') {
                        setModalIt360Tasks((prev) => [...prev, createEmptyIt360TaskRow()]);
                      } else {
                        setModalRefTasks((prev) => [...prev, createEmptyReferenceTaskRow()]);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50">
                    <span className="material-symbols-outlined text-[14px]">add</span>Thêm
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 space-y-2 min-h-[60px]">
                {modalActiveTaskTab === 'IT360' ? (
                  modalIt360Tasks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">Chưa có task IT360. Bấm "+ Thêm" để thêm.</p>
                  ) : (
                    modalIt360Tasks.map((task, idx) => (
                      <div key={task.local_id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px_auto]">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Mã task #{idx + 1}</p>
                          <input type="text" value={task.task_code}
                            onChange={(e) => setModalIt360Tasks((prev) => prev.map((t) => t.local_id === task.local_id ? { ...t, task_code: e.target.value } : t))}
                            disabled={isTransitioning}
                            placeholder="VD: IT360-0001"
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Link task</p>
                          <input type="text" value={task.task_link}
                            onChange={(e) => setModalIt360Tasks((prev) => prev.map((t) => t.local_id === task.local_id ? { ...t, task_link: e.target.value } : t))}
                            disabled={isTransitioning}
                            placeholder="https://..."
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Trạng thái</p>
                          <SearchableSelect
                            value={task.status}
                            options={SUPPORT_TASK_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            onChange={(v) => setModalIt360Tasks((prev) => prev.map((t) => t.local_id === task.local_id ? { ...t, status: normalizeSupportTaskStatus(v) } : t))}
                            disabled={isTransitioning}
                            compact
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          <button type="button"
                            onClick={() => setModalIt360Tasks((prev) => prev.filter((t) => t.local_id !== task.local_id))}
                            disabled={isTransitioning}
                            className="material-symbols-outlined rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                            delete
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  modalRefTasks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">Chưa có task tham chiếu. Bấm "+ Thêm" để thêm.</p>
                  ) : (
                    modalRefTasks.map((task, idx) => (
                      <div key={task.local_id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Task tham chiếu #{idx + 1}</p>
                          <SearchableSelect
                            value={task.id != null ? String(task.id) : task.task_code}
                            options={taskReferenceOptions}
                            onChange={(v) => {
                              const found = taskReferenceSearchResults.find((r) => String(r.id) === v);
                              setModalRefTasks((prev) => prev.map((t) => t.local_id === task.local_id
                                ? { ...t, id: found?.id ?? null, task_code: found?.task_code ?? v }
                                : t));
                            }}
                            onSearchTermChange={setTaskReferenceSearchTerm}
                            placeholder="Chọn hoặc tìm task tham chiếu"
                            searchPlaceholder="Tìm theo mã task hoặc mã yêu cầu..."
                            noOptionsText={taskReferenceSearchTerm.trim() === '' ? 'Nhập để tìm kiếm...' : 'Không tìm thấy'}
                            searching={isTaskReferenceSearchLoading}
                            disabled={isTransitioning}
                            compact
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          <button type="button"
                            onClick={() => setModalRefTasks((prev) => prev.filter((t) => t.local_id !== task.local_id))}
                            disabled={isTransitioning}
                            className="material-symbols-outlined rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                            delete
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

            {/* 3. File đính kèm bước này */}
            <div>
              <h5 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                File đính kèm bước này
              </h5>
              <AttachmentManager
                attachments={modalAttachments}
                onUpload={handleModalUpload}
                onDelete={(id) => setModalAttachments((prev) => prev.filter((a) => String(a.id) !== String(id)))}
                isUploading={isModalUploading}
                disabled={isTransitioning}
                helperText="File đính kèm sẽ được gắn với bước chuyển trạng thái này."
                emptyStateDescription="Chưa có file đính kèm cho bước này."
                enableClipboardPaste
                clipboardPasteHint="Ctrl/Cmd+V để dán ảnh chụp màn hình."
              />
            </div>

            {/* 4. Ghi chú */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Ghi chú
              </label>
              <textarea
                rows={2}
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                disabled={isTransitioning}
                placeholder="Ghi chú thêm cho lần chuyển trạng thái này..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={() => setShowTransitionModal(false)}
              disabled={isTransitioning}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => void handleTransitionConfirm()}
              disabled={isTransitioning}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isTransitioning ? 'progress_activity' : 'swap_horiz'}
              </span>
              {isTransitioning ? 'Đang xử lý...' : 'Xác nhận chuyển trạng thái'}
            </button>
          </div>

        </div>
      </div>
    )}

    </>
  );
};
