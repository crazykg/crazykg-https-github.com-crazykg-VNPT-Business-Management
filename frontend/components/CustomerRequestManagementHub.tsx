import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createCustomerRequest,
  deleteCustomerRequest,
  exportCustomerRequestsCsv,
  fetchCustomerRequestHistory,
  fetchCustomerRequestsPage,
  fetchSupportRequestReceivers,
  fetchSupportRequestReferenceMatches,
  fetchWorkflowFormFieldConfigs,
  fetchWorkflowStatusCatalogs,
  importCustomerRequests,
  isRequestCanceledError,
  updateCustomerRequest,
} from '../services/v5Api';
import {
  Customer,
  CustomerPersonnel,
  CustomerRequest,
  Employee,
  ProjectItemMaster,
  SupportRequest,
  SupportRequestTaskStatus,
  SupportServiceGroup,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
} from '../types';
import { SearchableSelect } from './SearchableSelect';
import { parseImportFile, pickImportSheetByModule } from '../utils/importParser';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type FormMode = 'create' | 'edit';

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  canReadRequests?: boolean;
  canWriteRequests?: boolean;
  canDeleteRequests?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

type HistoryState = {
  request: CustomerRequest;
  transitions: Array<Record<string, unknown>>;
  worklogs: Array<Record<string, unknown>>;
  ref_tasks: Array<Record<string, unknown>>;
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeFieldToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const toDisplayDate = (value: unknown): string => {
  const text = normalizeText(value);
  if (text === '') {
    return '--';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleDateString('vi-VN');
};

const FLOW_BADGE_CLASS: Record<string, string> = {
  GD1: 'bg-blue-100 text-blue-700',
  GD2: 'bg-orange-100 text-orange-700',
  GD3: 'bg-amber-100 text-amber-700',
  GD4: 'bg-rose-100 text-rose-700',
  GD5: 'bg-emerald-100 text-emerald-700',
  GD6: 'bg-cyan-100 text-cyan-700',
  GD7: 'bg-slate-100 text-slate-700',
  GD8: 'bg-indigo-100 text-indigo-700',
  GD9: 'bg-violet-100 text-violet-700',
  GD10: 'bg-purple-100 text-purple-700',
  GD11: 'bg-teal-100 text-teal-700',
  GD12: 'bg-fuchsia-100 text-fuchsia-700',
  GD13: 'bg-rose-100 text-rose-700',
  GD14: 'bg-sky-100 text-sky-700',
  GD15: 'bg-sky-100 text-sky-700',
  GD16: 'bg-sky-100 text-sky-700',
  GD17: 'bg-sky-100 text-sky-700',
  GD18: 'bg-emerald-100 text-emerald-700',
};

const BASE_FIELD_KEYS = new Set([
  'request_code',
  'project_item_id',
  'project_id',
  'product_id',
  'summary',
  'customer_id',
  'requester_name',
  'reporter_contact_id',
  'service_group_id',
  'receiver_user_id',
  'assignee_id',
  'reference_ticket_code',
  'reference_request_id',
  'requested_date',
  'notes',
]);

const BASE_FIELD_TOKEN_SET = new Set(
  Array.from(BASE_FIELD_KEYS).map((fieldKey) => normalizeFieldToken(fieldKey))
);

const WORKFLOW_STATIC_FIELD_ALIAS_TOKENS = new Set([
  ...Array.from(BASE_FIELD_TOKEN_SET),
  'idyeucau',
  'mayeucau',
  'mayc',
  'fieldidyeucu',
  'summary',
  'noidung',
  'noidungyeucau',
  'fieldnidung',
  'donvi',
  'fielddnv',
  'nguoiyeucau',
  'fieldngiyeucu',
  'nhomhotro',
  'fieldnhomhtr',
  'nguoitiepnhan',
  'fieldngitipnhn',
  'nguoixuly',
  'fieldngixly',
  'ngaytiepnhan',
  'fieldngaytipnhan',
  'mataskthamchieu',
  'fieldmataskthamchiu',
  'taskcode',
  'ghichu',
]);

const isStaticOrDuplicatedWorkflowField = (field: Pick<WorkflowFormFieldConfig, 'field_key' | 'field_label'>): boolean => {
  const key = String(field.field_key || '').trim();
  if (key !== '' && BASE_FIELD_KEYS.has(key)) {
    return true;
  }

  const keyToken = normalizeFieldToken(key);
  if (keyToken !== '' && WORKFLOW_STATIC_FIELD_ALIAS_TOKENS.has(keyToken)) {
    return true;
  }

  const labelToken = normalizeFieldToken(field.field_label || '');
  if (labelToken !== '' && WORKFLOW_STATIC_FIELD_ALIAS_TOKENS.has(labelToken)) {
    return true;
  }

  return false;
};

const PAGE_SIZE = 20;
const IMPORT_ACCEPT = '.xlsx,.xls,.xml,.csv';

const emptyFormValues = (): Record<string, string> => ({
  request_code: '',
  project_item_id: '',
  project_id: '',
  product_id: '',
  summary: '',
  customer_id: '',
  requester_name: '',
  reporter_contact_id: '',
  service_group_id: '',
  receiver_user_id: '',
  assignee_id: '',
  reference_ticket_code: '',
  reference_request_id: '',
  requested_date: new Date().toISOString().slice(0, 10),
  notes: '',
});

type SupportTaskFormRow = {
  local_id: string;
  task_code: string;
  task_link: string;
  status: SupportRequestTaskStatus;
};

const SUPPORT_TASK_STATUS_OPTIONS: Array<{ value: SupportRequestTaskStatus; label: string }> = [
  { value: 'TODO', label: 'Vừa tạo' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'DONE', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Huỷ' },
  { value: 'BLOCKED', label: 'Chuyển task khác' },
];

const SUPPORT_TASK_STATUS_ALIAS_MAP: Record<string, SupportRequestTaskStatus> = {
  TODO: 'TODO',
  VUATAO: 'TODO',
  INPROGRESS: 'IN_PROGRESS',
  DANGTHUCHIEN: 'IN_PROGRESS',
  DONE: 'DONE',
  DAHOANTHANH: 'DONE',
  HOANTHANH: 'DONE',
  CANCELLED: 'CANCELLED',
  HUY: 'CANCELLED',
  BLOCKED: 'BLOCKED',
  CHUYENSANGTASKKHAC: 'BLOCKED',
};

const normalizeSupportTaskStatusToken = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();

const normalizeSupportTaskStatus = (value: unknown): SupportRequestTaskStatus => {
  const token = normalizeSupportTaskStatusToken(value);
  return SUPPORT_TASK_STATUS_ALIAS_MAP[token] || 'TODO';
};

const buildTaskRowId = (): string => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyTaskRow = (partial?: Partial<SupportTaskFormRow>): SupportTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

const parseMaybeInt = (value: string): number | null => {
  const text = normalizeText(value);
  if (!text || !/^\d+$/.test(text)) {
    return null;
  }
  return Number(text);
};

const parseTaskList = (value: string): string[] =>
  String(value || '')
    .split(/\r\n|\r|\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const resolveSupportTaskCode = (item: Partial<SupportRequest> | null | undefined): string =>
  String(item?.ticket_code || item?.request_code || '').trim();

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  canReadRequests = true,
  canWriteRequests = true,
  canDeleteRequests = true,
  canImportRequests = true,
  canExportRequests = true,
  onNotify,
}) => {
  const notify = (type: ToastType, title: string, message: string) => {
    if (onNotify) {
      onNotify(type, title, message);
      return;
    }
    if (type === 'error') {
      window.alert(`${title}: ${message}`);
    }
  };

  const [rows, setRows] = useState<CustomerRequest[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [catalogs, setCatalogs] = useState<WorkflowStatusCatalog[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<WorkflowFormFieldConfig[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingRow, setEditingRow] = useState<CustomerRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>(emptyFormValues);
  const [formTasks, setFormTasks] = useState<SupportTaskFormRow[]>([createEmptyTaskRow()]);
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [selectedLevel1, setSelectedLevel1] = useState('');
  const [selectedLevel2, setSelectedLevel2] = useState('');
  const [selectedLevel3, setSelectedLevel3] = useState('');
  const [receiverOptions, setReceiverOptions] = useState<Array<{ value: string; label: string }>>([
    { value: '', label: 'Chọn người tiếp nhận' },
  ]);
  const [isReceiverLoading, setIsReceiverLoading] = useState(false);
  const receiverRequestVersionRef = useRef(0);

  const [supportRequestReferenceSource, setSupportRequestReferenceSource] = useState<SupportRequest[]>([]);
  const [isReferenceSearchLoading, setIsReferenceSearchLoading] = useState(false);
  const referenceRequestVersionRef = useRef(0);
  const editHistoryRequestVersionRef = useRef(0);
  const catalogRequestVersionRef = useRef(0);
  const listRequestVersionRef = useRef(0);

  const [historyRow, setHistoryRow] = useState<CustomerRequest | null>(null);
  const [historyData, setHistoryData] = useState<HistoryState | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectItemMap = useMemo(() => {
    const map = new Map<string, ProjectItemMaster>();
    (projectItems || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [projectItems]);

  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [customers]);

  const customerPersonnelById = useMemo(() => {
    const map = new Map<string, CustomerPersonnel>();
    (customerPersonnel || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [customerPersonnel]);

  const projectItemOptions = useMemo(
    () => [
      { value: '', label: 'Chọn phần mềm triển khai' },
      ...(projectItems || []).map((item) => {
        const product = normalizeText(item.product_name || item.product_code || `#${item.product_id}`);
        const project = normalizeText(item.project_name || item.project_code || '');
        const customer = normalizeText(item.customer_name || item.customer_code || '');
        const label = [product, project, customer].filter((part) => part !== '').join(' | ');
        return { value: String(item.id), label: label || `#${item.id}` };
      }),
    ],
    [projectItems]
  );

  const customerOptions = useMemo(
    () => [
      { value: '', label: 'Chọn đơn vị/khách hàng' },
      ...customers.map((item) => ({ value: String(item.id), label: item.customer_name || `#${item.id}` })),
    ],
    [customers]
  );

  const supportGroupOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhóm hỗ trợ' },
      ...supportServiceGroups
        .filter((item) => item.is_active !== false)
        .map((item) => ({ value: String(item.id), label: item.group_name || `#${item.id}` })),
    ],
    [supportServiceGroups]
  );

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhân sự' },
      ...employees.map((item) => {
        const code = normalizeText(item.user_code || item.username || '');
        const name = normalizeText(item.full_name || '--');
        return { value: String(item.id), label: code ? `${code} - ${name}` : name };
      }),
    ],
    [employees]
  );

  const receiverFallbackOptions = useMemo(
    () => [{ value: '', label: 'Chọn người tiếp nhận' }, ...employeeOptions.filter((item) => item.value !== '')],
    [employeeOptions]
  );

  const reporterContactOptions = useMemo(() => {
    const customerId = String(formValues.customer_id || '');
    const rows = (customerPersonnel || [])
      .filter((item) => String(item.customerId || '') === customerId && item.status !== 'Inactive')
      .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'));

    return [
      { value: '', label: 'Chọn người yêu cầu' },
      ...rows.map((item) => ({
        value: String(item.id),
        label: item.phoneNumber ? `${item.fullName} | ${item.phoneNumber}` : item.fullName,
      })),
    ];
  }, [customerPersonnel, formValues.customer_id]);

  const supportRequestReferenceMap = useMemo(() => {
    const map = new Map<string, SupportRequest>();

    supportRequestReferenceSource.forEach((item) => {
      const code = resolveSupportTaskCode(item);
      if (!code) {
        return;
      }

      const key = normalizeToken(code);
      if (!key) {
        return;
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        return;
      }

      const currentId = Number(item.id);
      const existingId = Number(existing.id);
      if (Number.isFinite(currentId) && Number.isFinite(existingId) && currentId > existingId) {
        map.set(key, item);
      }
    });

    return map;
  }, [supportRequestReferenceSource]);

  const supportRequestReferenceOptions = useMemo(() => {
    const options = [{ value: '', label: 'Không tham chiếu' }];
    const editingId = formMode === 'edit' && editingRow ? String(editingRow.id) : '';
    const rows: SupportRequest[] = [];

    supportRequestReferenceMap.forEach((item) => {
      if (editingId !== '' && String(item.id) === editingId) {
        return;
      }
      rows.push(item);
    });

    rows
      .sort((left, right) => resolveSupportTaskCode(right).localeCompare(resolveSupportTaskCode(left), 'vi'))
      .forEach((item) => {
        const taskCode = resolveSupportTaskCode(item);
        options.push({
          value: taskCode,
          label: `${taskCode || '--'} - ${String(item.summary || '--')}`,
        });
      });

    const currentCode = String(formValues.reference_ticket_code || '').trim();
    if (currentCode !== '' && !options.some((item) => item.value === currentCode)) {
      options.push({
        value: currentCode,
        label: `${currentCode} - (tham chiếu ngoài danh sách hiện tại)`,
      });
    }

    return options;
  }, [supportRequestReferenceMap, formMode, editingRow, formValues.reference_ticket_code]);

  const selectedReferenceRequest = useMemo(() => {
    const token = normalizeToken(formValues.reference_ticket_code || '');
    if (!token) {
      return null;
    }

    const matched = supportRequestReferenceMap.get(token);
    if (!matched) {
      return null;
    }

    if (formMode === 'edit' && editingRow && String(matched.id) === String(editingRow.id)) {
      return null;
    }

    return matched;
  }, [supportRequestReferenceMap, formValues.reference_ticket_code, formMode, editingRow]);

  const statusById = useMemo(() => {
    const map = new Map<string, WorkflowStatusCatalog>();
    catalogs.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [catalogs]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, WorkflowStatusCatalog[]>();
    catalogs.forEach((item) => {
      const key = item.parent_id !== null && item.parent_id !== undefined ? String(item.parent_id) : 'root';
      const rowsByParent = map.get(key) || [];
      rowsByParent.push(item);
      map.set(key, rowsByParent);
    });
    map.forEach((list, key) => {
      list.sort((left, right) => {
        const leftSort = Number(left.sort_order || 0);
        const rightSort = Number(right.sort_order || 0);
        if (leftSort !== rightSort) {
          return leftSort - rightSort;
        }
        return String(left.status_name || '').localeCompare(String(right.status_name || ''), 'vi');
      });
      map.set(key, list);
    });
    return map;
  }, [catalogs]);

  const level1Options = useMemo(
    () => [{ value: '', label: 'Chọn hướng xử lý' }, ...(childrenByParent.get('root') || []).map((item) => ({ value: String(item.id), label: item.status_name }))],
    [childrenByParent]
  );

  const level2Children = useMemo(
    () => childrenByParent.get(String(selectedLevel1 || '')) || [],
    [childrenByParent, selectedLevel1]
  );

  const level2Options = useMemo(
    () => [{ value: '', label: 'Chọn trạng thái xử lý' }, ...level2Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level2Children]
  );

  const level3Children = useMemo(
    () => childrenByParent.get(String(selectedLevel2 || '')) || [],
    [childrenByParent, selectedLevel2]
  );

  const level3Options = useMemo(
    () => [{ value: '', label: 'Chọn xử lý' }, ...level3Children.map((item) => ({ value: String(item.id), label: item.status_name }))],
    [level3Children]
  );

  const showLevel2 = selectedLevel1 !== '' && level2Children.length > 0;
  const showLevel3 = showLevel2 && selectedLevel2 !== '' && level3Children.length > 0;

  const selectedLeafStatusId = useMemo(() => {
    if (selectedLevel3) {
      return selectedLevel3;
    }

    if (selectedLevel2) {
      const node = statusById.get(String(selectedLevel2));
      if (node?.is_leaf) {
        return String(selectedLevel2);
      }
    }

    if (selectedLevel1) {
      const node = statusById.get(String(selectedLevel1));
      if (node?.is_leaf) {
        return String(selectedLevel1);
      }
    }

    return '';
  }, [selectedLevel1, selectedLevel2, selectedLevel3, statusById]);

  const activeFieldConfigs = useMemo(() => {
    if (!selectedLeafStatusId) {
      return [];
    }

    return fieldConfigs
      .filter((item) => String(item.status_catalog_id) === String(selectedLeafStatusId) && item.is_active !== false)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  }, [fieldConfigs, selectedLeafStatusId]);

  const statusFilterOptions = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((item) => {
      const status = normalizeText(item.status);
      if (status) {
        unique.add(status);
      }
    });

    return ['ALL', ...Array.from(unique)];
  }, [rows]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const newCount = rows.filter((item) => ['MOI_TIEP_NHAN', 'NEW'].includes(String(item.status || '').toUpperCase())).length;
    const processingCount = rows.filter((item) => ['DANG_XU_LY', 'LAP_TRINH', 'CHUYEN_DMS', 'PHAN_TICH', 'IN_PROGRESS'].includes(String(item.status || '').toUpperCase())).length;
    const completedCount = rows.filter((item) => ['HOAN_THANH', 'COMPLETED', 'BAO_KHACH_HANG'].includes(String(item.status || '').toUpperCase())).length;

    return { total, newCount, processingCount, completedCount };
  }, [rows]);

  const selectedProjectItem = useMemo(
    () => projectItemMap.get(String(formValues.project_item_id || '')) || null,
    [projectItemMap, formValues.project_item_id]
  );

  const selectedCustomerName = useMemo(() => {
    const id = String(formValues.customer_id || '');
    if (!id) {
      return '';
    }
    return customerById.get(id)?.customer_name || '';
  }, [customerById, formValues.customer_id]);

  const loadCatalogAndFields = async () => {
    const requestVersion = catalogRequestVersionRef.current + 1;
    catalogRequestVersionRef.current = requestVersion;
    setIsCatalogLoading(true);
    try {
      const [statusRows, fieldRows] = await Promise.all([
        fetchWorkflowStatusCatalogs(false),
        fetchWorkflowFormFieldConfigs(null, false),
      ]);
      if (catalogRequestVersionRef.current !== requestVersion) {
        return;
      }
      setCatalogs(statusRows || []);
      setFieldConfigs(fieldRows || []);
    } catch (error) {
      if (catalogRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải cấu hình workflow.';
      notify('error', 'Lỗi cấu hình workflow', message);
    } finally {
      if (catalogRequestVersionRef.current === requestVersion) {
        setIsCatalogLoading(false);
      }
    }
  };

  const loadRows = async (page: number, q: string, status: string) => {
    const requestVersion = listRequestVersionRef.current + 1;
    listRequestVersionRef.current = requestVersion;
    setIsLoading(true);
    try {
      const payload = await fetchCustomerRequestsPage({
        page,
        per_page: PAGE_SIZE,
        q: q || undefined,
        filters: status && status !== 'ALL' ? { status } : undefined,
      });
      if (listRequestVersionRef.current !== requestVersion) {
        return;
      }

      setRows(payload.data || []);
      setCurrentPage(payload.meta?.page || page);
      setTotalPages(payload.meta?.total_pages || 1);
      setTotalRows(payload.meta?.total || 0);
    } catch (error) {
      if (listRequestVersionRef.current !== requestVersion || isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách yêu cầu.';
      notify('error', 'Lỗi tải dữ liệu', message);
    } finally {
      if (listRequestVersionRef.current === requestVersion) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCatalogAndFields();
  }, []);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }
    loadRows(currentPage, searchText, statusFilter);
  }, [canReadRequests, currentPage, searchText, statusFilter]);

  useEffect(() => {
    setReceiverOptions(receiverFallbackOptions);
  }, [receiverFallbackOptions]);

  useEffect(() => {
    if (!showLevel2) {
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (!showLevel3) {
      setSelectedLevel3('');
    }
  }, [showLevel2, showLevel3]);

  const triggerReferenceSearch = async (keyword: string) => {
    const requestVersion = referenceRequestVersionRef.current + 1;
    referenceRequestVersionRef.current = requestVersion;
    setIsReferenceSearchLoading(true);

    try {
      const rows = await fetchSupportRequestReferenceMatches({
        q: keyword || undefined,
        exclude_id: formMode === 'edit' && editingRow ? editingRow.id : undefined,
        limit: 50,
      });
      if (referenceRequestVersionRef.current !== requestVersion) {
        return;
      }
      setSupportRequestReferenceSource(rows || []);
    } catch (error) {
      if (referenceRequestVersionRef.current !== requestVersion) {
        return;
      }
      if (isRequestCanceledError(error)) {
        return;
      }
      setSupportRequestReferenceSource([]);
    } finally {
      if (referenceRequestVersionRef.current === requestVersion) {
        setIsReferenceSearchLoading(false);
      }
    }
  };

  const handleProjectItemChange = (value: string) => {
    const selected = projectItemMap.get(String(value || ''));
    setFormValues((prev) => {
      const nextCustomerId = selected?.customer_id ? String(selected.customer_id) : '';
      const keepReporter = nextCustomerId !== '' && nextCustomerId === String(prev.customer_id || '');
      return {
        ...prev,
        project_item_id: value,
        customer_id: nextCustomerId,
        project_id: selected?.project_id ? String(selected.project_id) : '',
        product_id: selected?.product_id ? String(selected.product_id) : '',
        reporter_contact_id: keepReporter ? prev.reporter_contact_id : '',
        requester_name: keepReporter ? prev.requester_name : '',
      };
    });
  };

  const addFormTaskRow = () => {
    setFormTasks((prev) => [...prev, createEmptyTaskRow()]);
  };

  const updateTaskRow = (localId: string, field: keyof Omit<SupportTaskFormRow, 'local_id'>, value: string) => {
    setFormTasks((prev) =>
      prev.map((row) =>
        row.local_id === localId
          ? {
              ...row,
              [field]: field === 'status' ? normalizeSupportTaskStatus(value) : value,
            }
          : row
      )
    );
  };

  const removeTaskRow = (localId: string) => {
    setFormTasks((prev) => {
      const next = prev.filter((row) => row.local_id !== localId);
      return next.length > 0 ? next : [createEmptyTaskRow()];
    });
  };

  useEffect(() => {
    if (!formMode || !formValues.reporter_contact_id) {
      return;
    }

    const stillExists = reporterContactOptions.some((option) => option.value === formValues.reporter_contact_id);
    if (!stillExists) {
      setFormValues((prev) => ({
        ...prev,
        reporter_contact_id: '',
        requester_name: '',
      }));
    }
  }, [formMode, formValues.reporter_contact_id, reporterContactOptions]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const selectedContact = customerPersonnelById.get(String(formValues.reporter_contact_id || ''));
    if (!selectedContact) {
      return;
    }

    const normalizedName = String(selectedContact.fullName || '').trim();
    if (!normalizedName || normalizedName === String(formValues.requester_name || '').trim()) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      requester_name: normalizedName,
    }));
  }, [formMode, formValues.reporter_contact_id, formValues.requester_name, customerPersonnelById]);

  useEffect(() => {
    if (!formMode || formValues.project_item_id || !formValues.project_id || !formValues.product_id) {
      return;
    }

    const matched = (projectItems || []).find(
      (item) =>
        String(item.project_id || '') === String(formValues.project_id || '') &&
        String(item.product_id || '') === String(formValues.product_id || '')
    );

    if (!matched) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      project_item_id: String(matched.id),
      customer_id: matched.customer_id ? String(matched.customer_id) : prev.customer_id,
    }));
  }, [formMode, formValues.project_item_id, formValues.project_id, formValues.product_id, projectItems]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    setFormValues((prev) => {
      const currentCode = normalizeText(prev.reference_ticket_code);
      if (!currentCode) {
        if (prev.reference_request_id === '') {
          return prev;
        }
        return { ...prev, reference_request_id: '' };
      }

      if (selectedReferenceRequest?.id !== undefined && selectedReferenceRequest?.id !== null) {
        const nextReferenceId = String(selectedReferenceRequest.id);
        if (prev.reference_request_id === nextReferenceId) {
          return prev;
        }
        return { ...prev, reference_request_id: nextReferenceId };
      }

      return prev;
    });
  }, [formMode, selectedReferenceRequest, formValues.reference_ticket_code]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const projectId = String(formValues.project_id || '').trim();
    const projectItemId = String(formValues.project_item_id || '').trim();
    if (!projectId && !projectItemId) {
      setReceiverOptions(receiverFallbackOptions);
      setFormValues((prev) => {
        if (!prev.receiver_user_id) {
          return prev;
        }
        const hasFallback = receiverFallbackOptions.some((option) => option.value === prev.receiver_user_id);
        return hasFallback ? prev : { ...prev, receiver_user_id: '' };
      });
      return;
    }

    const requestVersion = receiverRequestVersionRef.current + 1;
    receiverRequestVersionRef.current = requestVersion;
    setIsReceiverLoading(true);

    void (async () => {
      try {
        const response = await fetchSupportRequestReceivers({
          project_id: projectId || null,
          project_item_id: projectItemId || null,
        });

        if (receiverRequestVersionRef.current !== requestVersion) {
          return;
        }

        const raciOptions = [
          { value: '', label: 'Chọn người tiếp nhận' },
          ...((response?.options || []).map((option) => {
            const userId = String(option.user_id || '');
            const displayName = String(option.full_name || '').trim();
            const code = String(option.user_code || option.username || '').trim();
            const role = String(option.raci_role || '').trim();
            const roleTag = role ? ` [${role}]` : '';
            const label = code ? `${code} - ${displayName}${roleTag}` : `${displayName}${roleTag}`;
            return { value: userId, label: label.trim() };
          })),
        ].filter((item) => item.value === '' || item.label !== '');

        const nextOptions = raciOptions.length > 1 ? raciOptions : receiverFallbackOptions;
        setReceiverOptions(nextOptions);

        const defaultReceiverId = String(response?.default_receiver_user_id || '').trim();
        setFormValues((prev) => {
          const available = new Set(nextOptions.map((item) => item.value));
          let nextReceiver = prev.receiver_user_id;
          if (nextReceiver && !available.has(nextReceiver)) {
            nextReceiver = '';
          }
          if (!nextReceiver && defaultReceiverId && available.has(defaultReceiverId)) {
            nextReceiver = defaultReceiverId;
          }
          if (nextReceiver === prev.receiver_user_id) {
            return prev;
          }
          return { ...prev, receiver_user_id: nextReceiver };
        });
      } catch {
        if (receiverRequestVersionRef.current !== requestVersion) {
          return;
        }
        setReceiverOptions(receiverFallbackOptions);
      } finally {
        if (receiverRequestVersionRef.current === requestVersion) {
          setIsReceiverLoading(false);
        }
      }
    })();
  }, [formMode, formValues.project_id, formValues.project_item_id, receiverFallbackOptions]);

  const closeFormModal = () => {
    editHistoryRequestVersionRef.current += 1;
    setFormMode(null);
    setEditingRow(null);
    setFormError('');
    setFormValues(emptyFormValues());
    setFormTasks([createEmptyTaskRow()]);
    setFormPriority('MEDIUM');
    setSelectedLevel1('');
    setSelectedLevel2('');
    setSelectedLevel3('');
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
    setSupportRequestReferenceSource([]);
    setIsReferenceSearchLoading(false);
  };

  const applyStatusPathByLeaf = (leafId: string | number | null | undefined) => {
    if (!leafId) {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    const leafNode = statusById.get(String(leafId));
    if (!leafNode) {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (leafNode.level === 1) {
      setSelectedLevel1(String(leafNode.id));
      setSelectedLevel2('');
      setSelectedLevel3('');
      return;
    }

    if (leafNode.level === 2) {
      setSelectedLevel2(String(leafNode.id));
      setSelectedLevel3('');
      if (leafNode.parent_id) {
        setSelectedLevel1(String(leafNode.parent_id));
      }
      return;
    }

    const level2 = leafNode.parent_id ? statusById.get(String(leafNode.parent_id)) : null;
    const level1 = level2?.parent_id ? statusById.get(String(level2.parent_id)) : null;

    setSelectedLevel3(String(leafNode.id));
    setSelectedLevel2(level2 ? String(level2.id) : '');
    setSelectedLevel1(level1 ? String(level1.id) : '');
  };

  const openCreateModal = () => {
    if (!canWriteRequests) {
      return;
    }

    editHistoryRequestVersionRef.current += 1;
    setFormMode('create');
    setEditingRow(null);
    setFormError('');
    setFormValues(emptyFormValues());
    setFormTasks([createEmptyTaskRow()]);
    setFormPriority('MEDIUM');
    setReceiverOptions(receiverFallbackOptions);
    void triggerReferenceSearch('');

    const firstLevel1 = (childrenByParent.get('root') || [])[0];
    if (firstLevel1) {
      applyStatusPathByLeaf(String(firstLevel1.id));
    } else {
      setSelectedLevel1('');
      setSelectedLevel2('');
      setSelectedLevel3('');
    }
  };

  const openEditModal = (row: CustomerRequest) => {
    if (!canWriteRequests) {
      return;
    }

    editHistoryRequestVersionRef.current += 1;
    setFormMode('edit');
    setEditingRow(row);
    setFormError('');
    setFormPriority((String(row.priority || 'MEDIUM').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'));

    const metadata = row.transition_metadata && typeof row.transition_metadata === 'object'
      ? (row.transition_metadata as Record<string, unknown>)
      : {};

    const mappedTaskRows = (Array.isArray(row.tasks) ? row.tasks : [])
      .map((task) =>
        createEmptyTaskRow({
          task_code: String(task?.task_code || ''),
          task_link: String(task?.task_link || ''),
          status: normalizeSupportTaskStatus(task?.status || 'TODO'),
        })
      )
      .filter((task) => task.task_code.trim() !== '' || task.task_link.trim() !== '');

    if (mappedTaskRows.length === 0 && String(row.reference_ticket_code || '').trim() !== '') {
      mappedTaskRows.push(
        createEmptyTaskRow({
          task_code: String(row.reference_ticket_code || '').trim(),
        })
      );
    }
    setFormTasks(mappedTaskRows.length > 0 ? mappedTaskRows : [createEmptyTaskRow()]);

    setFormValues({
      ...emptyFormValues(),
      ...Object.keys(metadata).reduce<Record<string, string>>((acc, key) => {
        acc[key] = String(metadata[key] ?? '');
        return acc;
      }, {}),
      summary: String(row.summary || ''),
      project_item_id: row.project_item_id ? String(row.project_item_id) : '',
      project_id: row.project_id ? String(row.project_id) : '',
      product_id: row.product_id ? String(row.product_id) : '',
      customer_id: row.customer_id ? String(row.customer_id) : '',
      requester_name: String(row.requester_name || ''),
      reporter_contact_id: row.reporter_contact_id ? String(row.reporter_contact_id) : '',
      service_group_id: row.service_group_id ? String(row.service_group_id) : '',
      receiver_user_id: row.receiver_user_id ? String(row.receiver_user_id) : '',
      assignee_id: row.assignee_id ? String(row.assignee_id) : '',
      reference_ticket_code: String(row.reference_ticket_code || ''),
      reference_request_id: row.reference_request_id ? String(row.reference_request_id) : '',
      requested_date: row.requested_date ? String(row.requested_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: String(row.notes || ''),
      request_code: String(row.request_code || ''),
    });

    applyStatusPathByLeaf(row.status_catalog_id);
    void triggerReferenceSearch('');

    const requestVersion = editHistoryRequestVersionRef.current;
    void (async () => {
      try {
        const payload = await fetchCustomerRequestHistory(row.id);
        if (editHistoryRequestVersionRef.current !== requestVersion) {
          return;
        }

        const historyTasks = Array.isArray(payload.ref_tasks)
          ? payload.ref_tasks
              .map((task) =>
                createEmptyTaskRow({
                  task_code: String((task as Record<string, unknown>)?.task_code || ''),
                  task_link: String((task as Record<string, unknown>)?.task_link || ''),
                  status: normalizeSupportTaskStatus((task as Record<string, unknown>)?.task_status || 'TODO'),
                })
              )
              .filter((task) => task.task_code.trim() !== '' || task.task_link.trim() !== '')
          : [];

        if (historyTasks.length > 0) {
          setFormTasks(historyTasks);
        }
      } catch {
        // keep current task rows if history lookup fails
      }
    })();
  };

  const handleSave = async () => {
    if (!formMode) {
      return;
    }

    if (!selectedLeafStatusId) {
      setFormError('Vui lòng chọn đủ trạng thái để xác định form workflow.');
      return;
    }

    const summary = normalizeText(formValues.summary);
    if (summary === '') {
      setFormError('Nội dung yêu cầu là bắt buộc.');
      return;
    }
    if (!normalizeText(formValues.project_item_id)) {
      setFormError('Phần mềm triển khai là bắt buộc.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const transitionMetadata: Record<string, unknown> = {};
      const refTasks: Array<Record<string, unknown>> = [];
      const worklogs: Array<Record<string, unknown>> = [];
      const baseTaskRows = formTasks
        .map((task, index) => ({
          task_source: 'IT360',
          task_code: normalizeText(task.task_code) || null,
          task_link: normalizeText(task.task_link) || null,
          task_status: normalizeSupportTaskStatus(task.status || 'TODO'),
          sort_order: index,
        }))
        .filter((task) => task.task_code !== null || task.task_link !== null);

      if (baseTaskRows.length > 0) {
        refTasks.push(...baseTaskRows);
      }

      activeFieldConfigs.forEach((field) => {
        const key = String(field.field_key || '');
        if (!key || isStaticOrDuplicatedWorkflowField(field)) {
          return;
        }

        const fieldType = String(field.field_type || 'text');
        const rawValue = normalizeText(formValues[key]);

        if (rawValue === '') {
          return;
        }

        if (fieldType === 'task_ref') {
          refTasks.push({ task_source: 'IT360', task_code: rawValue, sort_order: refTasks.length });
          return;
        }

        if (fieldType === 'task_list') {
          parseTaskList(rawValue).forEach((taskCode) => {
            refTasks.push({ task_source: 'IT360', task_code: taskCode, sort_order: refTasks.length });
          });
          return;
        }

        if (fieldType === 'worklog') {
          worklogs.push({
            phase: 'OTHER',
            logged_date: normalizeText(formValues.requested_date) || new Date().toISOString().slice(0, 10),
            hours_spent: 1,
            content: rawValue,
          });
          return;
        }

        if (fieldType === 'number') {
          transitionMetadata[key] = Number(rawValue);
          return;
        }

        if (fieldType === 'boolean') {
          transitionMetadata[key] = ['1', 'true', 'yes'].includes(rawValue.toLowerCase());
          return;
        }

        transitionMetadata[key] = rawValue;
      });

      const payload: Record<string, unknown> = {
        status_catalog_id: Number(selectedLeafStatusId),
        summary,
        project_item_id: parseMaybeInt(formValues.project_item_id),
        customer_id: parseMaybeInt(formValues.customer_id),
        project_id: parseMaybeInt(formValues.project_id),
        product_id: parseMaybeInt(formValues.product_id),
        requester_name: normalizeText(formValues.requester_name) || null,
        reporter_contact_id: parseMaybeInt(formValues.reporter_contact_id),
        service_group_id: parseMaybeInt(formValues.service_group_id),
        receiver_user_id: parseMaybeInt(formValues.receiver_user_id),
        assignee_id: parseMaybeInt(formValues.assignee_id),
        status: undefined,
        sub_status: undefined,
        priority: formPriority,
        requested_date: normalizeText(formValues.requested_date) || null,
        reference_ticket_code: normalizeText(formValues.reference_ticket_code) || null,
        reference_request_id: selectedReferenceRequest?.id ?? parseMaybeInt(formValues.reference_request_id),
        notes: normalizeText(formValues.notes) || null,
        transition_metadata: transitionMetadata,
        transition_note: normalizeText(formValues.notes) || null,
        tasks: refTasks.map((task) => ({
          task_source: task.task_source,
          task_code: task.task_code,
          task_link: task.task_link,
          status: task.task_status,
          sort_order: task.sort_order,
        })),
        ref_tasks: refTasks,
        worklogs,
      };

      if (formMode === 'create') {
        await createCustomerRequest(payload);
        notify('success', 'Tạo yêu cầu', 'Đã tạo yêu cầu khách hàng mới.');
      } else if (editingRow) {
        await updateCustomerRequest(editingRow.id, payload);
        notify('success', 'Cập nhật yêu cầu', 'Đã cập nhật yêu cầu khách hàng.');
      }

      closeFormModal();
      await loadRows(currentPage, searchText, statusFilter);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu yêu cầu khách hàng.';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: CustomerRequest) => {
    if (!canDeleteRequests) {
      return;
    }

    const confirmed = window.confirm(`Xóa yêu cầu ${row.request_code}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteCustomerRequest(row.id);
      notify('success', 'Xóa yêu cầu', 'Đã xóa yêu cầu khách hàng.');
      await loadRows(currentPage, searchText, statusFilter);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể xóa yêu cầu.';
      notify('error', 'Xóa yêu cầu thất bại', message);
    }
  };

  const openHistory = async (row: CustomerRequest) => {
    setHistoryRow(row);
    setHistoryData(null);
    setHistoryError('');
    setIsHistoryLoading(true);

    try {
      const payload = await fetchCustomerRequestHistory(row.id);
      setHistoryData(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử.';
      setHistoryError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleExport = async () => {
    if (!canExportRequests) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportCustomerRequestsCsv({
        page: currentPage,
        per_page: PAGE_SIZE,
        q: searchText || undefined,
        filters: statusFilter !== 'ALL' ? { status: statusFilter } : undefined,
      });
      triggerDownload(result.blob, result.filename);
      notify('success', 'Xuất dữ liệu', 'Đã tạo file xuất yêu cầu khách hàng.');
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể xuất dữ liệu.';
      notify('error', 'Xuất dữ liệu thất bại', message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (!canImportRequests || isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      const parsed = await parseImportFile(file);
      const sheet = pickImportSheetByModule('customer_requests', parsed) || parsed.sheets[0];
      if (!sheet) {
        throw new Error('Không đọc được sheet dữ liệu import.');
      }

      const items: Array<Record<string, unknown>> = (sheet.rows || [])
        .map((row) => {
          const get = (index: number): string => String(row[index] || '').trim();
          return {
            B: get(1),
            C: get(2),
            D: get(3),
            E: get(4),
            F: get(5),
            G: get(6),
            H: get(7),
            I: get(8),
            J: get(9),
            K: get(10),
            L: get(11),
            M: get(12),
            N: get(13),
            O: get(14),
            P: get(15),
            Q: get(16),
            R: get(17),
            status_level_1: get(1),
            status_level_2: get(2),
            status_level_3: get(3),
          };
        })
        .filter((item) => {
          const hasStatus = [item.B, item.C, item.D].some((value) => normalizeText(value) !== '');
          const hasPayload = [item.E, item.F, item.G, item.H, item.I, item.J, item.K, item.L, item.M, item.N, item.O, item.P, item.Q, item.R]
            .some((value) => normalizeText(value) !== '');
          return hasStatus && hasPayload;
        });

      if (items.length === 0) {
        throw new Error('File import không có dòng dữ liệu hợp lệ.');
      }

      const result = await importCustomerRequests(items);
      notify(
        result.failed_count > 0 ? 'warning' : 'success',
        'Nhập dữ liệu',
        `Tạo mới: ${result.created_count}, cập nhật: ${result.updated_count}, lỗi: ${result.failed_count}`
      );

      await loadRows(1, searchText, statusFilter);
      setCurrentPage(1);
    } catch (error) {
      if (isRequestCanceledError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Không thể nhập dữ liệu.';
      notify('error', 'Nhập dữ liệu thất bại', message);
    } finally {
      setIsImporting(false);
    }
  };

  const renderFieldInput = (field: WorkflowFormFieldConfig) => {
    const key = String(field.field_key || '');
    const fieldType = String(field.field_type || 'text');
    const value = String(formValues[key] || '');
    const label = field.field_label || key;
    const required = field.required === true;

    if (key === 'request_code') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
          <input
            type="text"
            value={formMode === 'edit' ? value : '-- tự sinh sau khi lưu --'}
            readOnly
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
          />
        </div>
      );
    }

    if (fieldType === 'customer') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={customerOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn khách hàng"
          searchPlaceholder="Tìm khách hàng..."
        />
      );
    }

    if (fieldType === 'service_group') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={supportGroupOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn nhóm hỗ trợ"
          searchPlaceholder="Tìm nhóm hỗ trợ..."
        />
      );
    }

    if (fieldType === 'user') {
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={employeeOptions}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn nhân sự"
          searchPlaceholder="Tìm nhân sự..."
        />
      );
    }

    if (fieldType === 'date') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {required ? <span className="text-red-500">*</span> : null}
          </label>
          <input
            type="date"
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (fieldType === 'textarea' || fieldType === 'worklog' || fieldType === 'task_list') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {required ? <span className="text-red-500">*</span> : null}
          </label>
          <textarea
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            rows={fieldType === 'task_list' ? 4 : 3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (fieldType === 'number') {
      return (
        <div key={key}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            {label} {required ? <span className="text-red-500">*</span> : null}
          </label>
          <input
            type="number"
            value={value}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    if (fieldType === 'boolean') {
      return (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={['1', 'true', 'yes'].includes(value.toLowerCase())}
            onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.checked ? '1' : '0' }))}
          />
          <span>{label}</span>
        </label>
      );
    }

    if (fieldType === 'select') {
      const options = Array.isArray(field.options_json) ? field.options_json : [];
      return (
        <SearchableSelect
          key={key}
          label={label}
          required={required}
          value={value}
          options={[{ value: '', label: 'Chọn...' }, ...options.map((item) => ({ value: item.value, label: item.label }))]}
          onChange={(next) => setFormValues((prev) => ({ ...prev, [key]: next }))}
          placeholder="Chọn giá trị"
        />
      );
    }

    return (
      <div key={key}>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          type="text"
          value={value}
          onChange={(event) => setFormValues((prev) => ({ ...prev, [key]: event.target.value }))}
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    );
  };

  if (!canReadRequests) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Bạn không có quyền xem dữ liệu Quản lý yêu cầu KH.
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl"
      style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}
    >
      <header className="mb-6 md:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý yêu cầu KH</h2>
          <p className="mt-1 text-sm text-slate-600">Màn hình độc lập quản lý workflow yêu cầu khách hàng theo trạng thái.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={!canImportRequests || isImporting}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">upload</span>
            <span className="hidden sm:inline">{isImporting ? 'Đang nhập...' : 'Nhập'}</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExportRequests || isExporting}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">{isExporting ? 'progress_activity' : 'download'}</span>
            <span className="hidden sm:inline">{isExporting ? 'Đang xuất...' : 'Xuất'}</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canWriteRequests}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleImportFile} />

      <div className="mb-6 md:mb-8 grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Tổng yêu cầu</p>
            <span className="material-symbols-outlined rounded-lg bg-blue-50 p-2 text-blue-600">support_agent</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.total}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Mới tiếp nhận</p>
            <span className="material-symbols-outlined rounded-lg bg-indigo-50 p-2 text-indigo-600">new_releases</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.newCount}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Đang xử lý</p>
            <span className="material-symbols-outlined rounded-lg bg-amber-50 p-2 text-amber-600">pending_actions</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.processingCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Hoàn thành</p>
            <span className="material-symbols-outlined rounded-lg bg-emerald-50 p-2 text-emerald-600">task_alt</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 md:text-3xl">{kpi.completedCount}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white/95 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)] md:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px_auto]">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo mã yêu cầu, trạng thái, nội dung..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <SearchableSelect
              value={statusFilter}
              options={statusFilterOptions.map((item) => ({ value: item, label: item === 'ALL' ? 'Tất cả trạng thái' : item }))}
              onChange={(value) => {
                setStatusFilter(value || 'ALL');
                setCurrentPage(1);
              }}
              placeholder="Tất cả trạng thái"
              triggerClassName="h-10 md:h-11 border-slate-200 shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                setSearchText(searchInput.trim());
              }}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 md:h-11"
            >
              Tìm kiếm
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1180px] w-full border-collapse text-left">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th className="min-w-[180px] px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Mã YC</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Nội dung</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Trạng thái</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Khách hàng</span></th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Người xử lý</span></th>
                  <th className="min-w-[160px] px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="text-deep-teal">Ngày nhận</span></th>
                  <th className="min-w-[150px] bg-slate-50 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Đang tải dữ liệu...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">Không có dữ liệu</td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const flowStep = String(row.flow_step || '').toUpperCase();
                    const badgeClass = FLOW_BADGE_CLASS[flowStep] || 'bg-slate-100 text-slate-700';
                    return (
                      <tr key={String(row.id)} className="odd:bg-white even:bg-slate-50/40 transition-colors hover:bg-teal-50/40">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.request_code || '--'}</td>
                        <td className="max-w-[360px] px-6 py-4 text-sm text-slate-900">
                          <p className="line-clamp-2 font-semibold">{row.summary || '--'}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.notes || '--'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                            {row.status_name || row.status || '--'}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{row.sub_status || row.flow_step || '--'}</p>
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-4 text-sm text-slate-600" title={row.customer_name || ''}>
                          {row.customer_name || '--'}
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-4 text-sm text-slate-600" title={row.assignee_name || ''}>
                          {row.assignee_name || '--'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{toDisplayDate(row.requested_date)}</td>
                        <td className="bg-white px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openHistory(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-primary"
                              title="Lịch sử"
                            >
                              <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                            <button
                              type="button"
                              disabled={!canWriteRequests}
                              onClick={() => openEditModal(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-primary disabled:opacity-40"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={!canDeleteRequests}
                              onClick={() => handleDelete(row)}
                              className="p-1.5 text-slate-400 transition-colors hover:text-error disabled:opacity-40"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>Tổng {totalRows} bản ghi. Trang {currentPage}/{Math.max(1, totalPages)}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages || 1, prev + 1))}
                disabled={currentPage >= (totalPages || 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      </div>

      {formMode ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {formMode === 'create' ? 'Thêm yêu cầu khách hàng' : `Cập nhật ${editingRow?.request_code || ''}`}
              </h3>
              <button type="button" onClick={closeFormModal} className="material-symbols-outlined text-slate-500">close</button>
            </div>

            <div className="space-y-4 p-5">
              {isCatalogLoading ? <div className="text-sm text-slate-500">Đang tải cấu hình workflow...</div> : null}

              <div className="grid gap-3 md:grid-cols-2">
                {formMode === 'edit' ? (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">ID yêu cầu</label>
                    <input
                      type="text"
                      value={formValues.request_code || '--'}
                      readOnly
                      className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                    />
                  </div>
                ) : null}

                <SearchableSelect
                  className="md:col-span-2"
                  value={formValues.project_item_id}
                  options={projectItemOptions}
                  onChange={handleProjectItemChange}
                  label="Phần mềm triển khai"
                  required
                  placeholder="Chọn phần mềm triển khai"
                  searchPlaceholder="Tìm phần mềm triển khai..."
                />
                {selectedProjectItem ? (
                  <p className="md:col-span-2 -mt-2 text-xs text-slate-500">
                    Dự án:
                    {' '}
                    <span className="font-medium text-slate-700">{selectedProjectItem.project_name || '--'}</span>
                    {' | '}
                    Sản phẩm:
                    {' '}
                    <span className="font-medium text-slate-700">{selectedProjectItem.product_name || '--'}</span>
                  </p>
                ) : null}

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Nội dung yêu cầu <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formValues.summary}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, summary: event.target.value }))}
                    rows={3}
                    placeholder="Mô tả chi tiết yêu cầu cần xử lý..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Đơn vị</label>
                  <input
                    type="text"
                    value={selectedCustomerName || '--'}
                    readOnly
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
                  />
                </div>

                <SearchableSelect
                  value={formValues.service_group_id}
                  options={supportGroupOptions}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, service_group_id: value }))}
                  label="Nhóm hỗ trợ"
                  placeholder="Chọn nhóm hỗ trợ"
                  searchPlaceholder="Tìm nhóm hỗ trợ..."
                />

                <SearchableSelect
                  value={formValues.reporter_contact_id}
                  options={reporterContactOptions}
                  onChange={(value) => {
                    const selectedContact = customerPersonnelById.get(String(value || ''));
                    setFormValues((prev) => ({
                      ...prev,
                      reporter_contact_id: value,
                      requester_name: selectedContact?.fullName || '',
                    }));
                  }}
                  label="Người yêu cầu"
                  placeholder={
                    formValues.customer_id
                      ? 'Chọn người yêu cầu'
                      : 'Chọn phần mềm triển khai để tải người yêu cầu'
                  }
                  disabled={!formValues.customer_id}
                />

                <SearchableSelect
                  value={formValues.assignee_id}
                  options={employeeOptions}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, assignee_id: value }))}
                  label="Người xử lý"
                  placeholder="Chọn người xử lý"
                  searchPlaceholder="Tìm người xử lý..."
                />

                <SearchableSelect
                  value={formValues.receiver_user_id}
                  options={receiverOptions}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, receiver_user_id: value }))}
                  label="Người tiếp nhận"
                  placeholder={isReceiverLoading ? 'Đang tải người tiếp nhận...' : 'Chọn người tiếp nhận'}
                  searchPlaceholder="Tìm người tiếp nhận..."
                  searching={isReceiverLoading}
                  disabled={isReceiverLoading}
                />

                <SearchableSelect
                  value={formValues.reference_ticket_code}
                  options={supportRequestReferenceOptions}
                  onChange={(value) => {
                    const matched = supportRequestReferenceMap.get(normalizeToken(value || ''));
                    setFormValues((prev) => ({
                      ...prev,
                      reference_ticket_code: value,
                      reference_request_id:
                        matched?.id !== undefined && matched?.id !== null ? String(matched.id) : '',
                    }));
                  }}
                  label="Mã task tham chiếu"
                  placeholder="Chọn/Nhập mã task tham chiếu"
                  searchPlaceholder="Nhập mã task tham chiếu để tìm..."
                  searching={isReferenceSearchLoading}
                  onSearchTermChange={(keyword) => {
                    void triggerReferenceSearch(keyword);
                  }}
                />

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Ngày nhận yêu cầu</label>
                  <input
                    type="date"
                    value={formValues.requested_date}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, requested_date: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <SearchableSelect
                  value={formPriority}
                  options={[
                    { value: 'LOW', label: 'Thấp' },
                    { value: 'MEDIUM', label: 'Trung bình' },
                    { value: 'HIGH', label: 'Cao' },
                    { value: 'URGENT', label: 'Khẩn cấp' },
                  ]}
                  onChange={(value) =>
                    setFormPriority((['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(value) ? value : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')
                  }
                  label="Mức ưu tiên"
                />
              </div>

              {selectedReferenceRequest ? (
                <p className="text-xs text-slate-500">
                  Tham chiếu tới:
                  {' '}
                  <span className="font-semibold text-slate-700">{resolveSupportTaskCode(selectedReferenceRequest) || '--'}</span>
                  {' - '}
                  <span className="text-slate-600">{selectedReferenceRequest.summary || '--'}</span>
                </p>
              ) : null}

              <div
                className={[
                  'grid gap-3',
                  showLevel3 ? 'md:grid-cols-3' : showLevel2 ? 'md:grid-cols-2' : 'md:grid-cols-1',
                ].join(' ')}
              >
                <SearchableSelect
                  value={selectedLevel1}
                  options={level1Options}
                  onChange={(value) => {
                    setSelectedLevel1(value);
                    setSelectedLevel2('');
                    setSelectedLevel3('');
                  }}
                  label="Hướng xử lý"
                  placeholder="Chọn hướng xử lý"
                />
                {showLevel2 ? (
                  <SearchableSelect
                    value={selectedLevel2}
                    options={level2Options}
                    onChange={(value) => {
                      setSelectedLevel2(value);
                      setSelectedLevel3('');
                    }}
                    label="Trạng thái xử lý"
                    placeholder="Chọn trạng thái xử lý"
                  />
                ) : null}
                {showLevel3 ? (
                  <SearchableSelect
                    value={selectedLevel3}
                    options={level3Options}
                    onChange={(value) => setSelectedLevel3(value)}
                    label="Xử lý"
                    placeholder="Chọn xử lý"
                  />
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Danh sách task tham chiếu</h4>
                  <button
                    type="button"
                    onClick={addFormTaskRow}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Thêm task
                  </button>
                </div>
                <div className="space-y-2">
                  {formTasks.map((task, index) => (
                    <div key={task.local_id} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1.2fr_0.9fr_auto]">
                      <input
                        type="text"
                        value={task.task_code}
                        onChange={(event) => updateTaskRow(task.local_id, 'task_code', event.target.value)}
                        placeholder={`Mã task #${index + 1}`}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <input
                        type="text"
                        value={task.task_link}
                        onChange={(event) => updateTaskRow(task.local_id, 'task_link', event.target.value)}
                        placeholder="Link task (tuỳ chọn)"
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <SearchableSelect
                        value={task.status}
                        options={SUPPORT_TASK_STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                        onChange={(value) => updateTaskRow(task.local_id, 'status', value)}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => removeTaskRow(task.local_id)}
                        className="material-symbols-outlined rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        title="Xoá task"
                      >
                        delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Ghi chú</label>
                <textarea
                  value={formValues.notes}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {activeFieldConfigs
                  .filter((field) => !isStaticOrDuplicatedWorkflowField(field))
                  .map((field) => renderFieldInput(field))}
              </div>

              {formError ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</div> : null}
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button type="button" onClick={closeFormModal} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600">
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyRow ? (
        <div className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Lịch sử yêu cầu {historyRow.request_code}</h3>
              <button
                type="button"
                onClick={() => {
                  setHistoryRow(null);
                  setHistoryData(null);
                  setHistoryError('');
                }}
                className="material-symbols-outlined text-slate-500"
              >
                close
              </button>
            </div>

            <div className="space-y-4 p-5">
              {isHistoryLoading ? <div className="text-sm text-slate-500">Đang tải lịch sử...</div> : null}
              {historyError ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{historyError}</div> : null}

              {historyData ? (
                <>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-700">Transitions ({historyData.transitions.length})</div>
                    <div className="mt-2 space-y-2">
                      {historyData.transitions.map((item, index) => (
                        <div key={`t_${index}`} className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
                          <div>
                            {(item.to_status as string) || '--'}
                            {(item.sub_status as string) ? ` / ${String(item.sub_status)}` : ''}
                          </div>
                          <div className="text-xs text-slate-500">{toDisplayDate(item.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-700">Worklog ({historyData.worklogs.length})</div>
                    <div className="mt-2 space-y-2">
                      {historyData.worklogs.map((item, index) => (
                        <div key={`w_${index}`} className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
                          <div>{String(item.worklog_note || '--')}</div>
                          <div className="text-xs text-slate-500">{toDisplayDate(item.report_date || item.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
