import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Customer,
  Employee,
  ProjectItemMaster,
  Product,
  Project,
  SupportRequest,
  SupportRequestHistory,
  SupportRequestPriority,
  SupportRequestStatus,
  SupportServiceGroup,
} from '../types';
import { PaginationControls } from './PaginationControls';
import { downloadExcelWorkbook } from '../utils/excelTemplate';

interface SupportRequestListProps {
  supportRequests: SupportRequest[];
  supportServiceGroups: SupportServiceGroup[];
  supportRequestHistories: SupportRequestHistory[];
  projectItems: ProjectItemMaster[];
  customers: Customer[];
  projects: Project[];
  products: Product[];
  employees: Employee[];
  onCreateSupportServiceGroup: (payload: Partial<SupportServiceGroup>) => Promise<SupportServiceGroup>;
  onCreateSupportRequest: (payload: Partial<SupportRequest>) => Promise<void>;
  onUpdateSupportRequest: (id: string | number, payload: Partial<SupportRequest>) => Promise<void>;
  onDeleteSupportRequest: (id: string | number) => Promise<void>;
  onLoadSupportRequestHistory: (id: string | number) => Promise<SupportRequestHistory[]>;
  onOpenImportModal: () => void;
}

type FormMode = 'ADD' | 'EDIT';

interface SupportRequestFormState {
  ticket_code: string;
  summary: string;
  service_group_id: string;
  project_item_id: string;
  customer_id: string;
  project_id: string;
  product_id: string;
  reporter_name: string;
  assignee_id: string;
  status: SupportRequestStatus;
  priority: SupportRequestPriority;
  requested_date: string;
  due_date: string;
  resolved_date: string;
  hotfix_date: string;
  noti_date: string;
  task_link: string;
  change_log: string;
  test_note: string;
  notes: string;
}

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const STATUS_OPTIONS: Array<{ value: SupportRequestStatus; label: string; color: string }> = [
  { value: 'OPEN', label: 'Mở', color: 'bg-blue-100 text-blue-700' },
  { value: 'HOTFIXING', label: 'Hotfix', color: 'bg-orange-100 text-orange-700' },
  { value: 'RESOLVED', label: 'Đã xử lý', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'DEPLOYED', label: 'Đã triển khai', color: 'bg-teal-100 text-teal-700' },
  { value: 'PENDING', label: 'Tạm dừng', color: 'bg-amber-100 text-amber-700' },
  { value: 'CANCELLED', label: 'Hủy', color: 'bg-slate-100 text-slate-700' },
];

const PRIORITY_OPTIONS: Array<{ value: SupportRequestPriority; label: string; color: string }> = [
  { value: 'LOW', label: 'Thấp', color: 'bg-slate-100 text-slate-700' },
  { value: 'MEDIUM', label: 'Trung bình', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'Cao', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Khẩn cấp', color: 'bg-red-100 text-red-700' },
];

const normalizeToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const resolveStatusLabel = (status: string): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const resolveStatusColor = (status: string): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.color || 'bg-slate-100 text-slate-700';

const resolvePriorityLabel = (priority: string): string =>
  PRIORITY_OPTIONS.find((option) => option.value === priority)?.label || priority;

const resolvePriorityColor = (priority: string): string =>
  PRIORITY_OPTIONS.find((option) => option.value === priority)?.color || 'bg-slate-100 text-slate-700';

const toNullableText = (value: string): string | null => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const startOfCurrentYearIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};

const emptyFormState = (): SupportRequestFormState => {
  const today = todayIso();
  return {
    ticket_code: '',
    summary: '',
    service_group_id: '',
    project_item_id: '',
    customer_id: '',
    project_id: '',
    product_id: '',
    reporter_name: '',
    assignee_id: '',
    status: 'OPEN',
    priority: 'MEDIUM',
    requested_date: today,
    due_date: today,
    resolved_date: today,
    hotfix_date: today,
    noti_date: today,
    task_link: '',
    change_log: '',
    test_note: '',
    notes: '',
  };
};

const requestToFormState = (request: SupportRequest): SupportRequestFormState => {
  const today = todayIso();
  return {
    ticket_code: String(request.ticket_code || ''),
    summary: String(request.summary || ''),
    service_group_id: String(request.service_group_id || ''),
    project_item_id: String(request.project_item_id || ''),
    customer_id: String(request.customer_id || ''),
    project_id: String(request.project_id || ''),
    product_id: String(request.product_id || ''),
    reporter_name: String(request.reporter_name || ''),
    assignee_id: String(request.assignee_id || ''),
    status: request.status || 'OPEN',
    priority: request.priority || 'MEDIUM',
    requested_date: String(request.requested_date || today),
    due_date: String(request.due_date || today),
    resolved_date: String(request.resolved_date || today),
    hotfix_date: String(request.hotfix_date || today),
    noti_date: String(request.noti_date || today),
    task_link: String(request.task_link || ''),
    change_log: String(request.change_log || ''),
    test_note: String(request.test_note || ''),
    notes: String(request.notes || ''),
  };
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Chọn...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    normalizeToken(option.label).includes(normalizeToken(searchTerm.trim()))
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-left text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400"
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-[80] mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                ref={inputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    option.value === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-sm text-slate-400 text-center">Không có kết quả phù hợp.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SupportRequestList: React.FC<SupportRequestListProps> = ({
  supportRequests = [],
  supportServiceGroups = [],
  supportRequestHistories = [],
  projectItems = [],
  customers = [],
  projects = [],
  products = [],
  employees = [],
  onCreateSupportServiceGroup,
  onCreateSupportRequest,
  onUpdateSupportRequest,
  onDeleteSupportRequest,
  onLoadSupportRequestHistory,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [requestedFromFilter, setRequestedFromFilter] = useState(startOfCurrentYearIso);
  const [requestedToFilter, setRequestedToFilter] = useState(todayIso);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingRequest, setEditingRequest] = useState<SupportRequest | null>(null);
  const [formData, setFormData] = useState<SupportRequestFormState>(emptyFormState);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<SupportRequest | null>(null);
  const [historyRows, setHistoryRows] = useState<SupportRequestHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [groupFormError, setGroupFormError] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const activeGroups = useMemo(
    () =>
      (supportServiceGroups || [])
        .filter((group) => group.is_active !== false)
        .sort((a, b) => String(a.group_name || '').localeCompare(String(b.group_name || ''), 'vi')),
    [supportServiceGroups]
  );

  const groupOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả nhóm hỗ trợ' },
      ...activeGroups.map((group) => ({ value: String(group.id), label: group.group_name })),
    ],
    [activeGroups]
  );

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn khách hàng' },
      ...(customers || []).map((customer) => ({
        value: String(customer.id),
        label: `${customer.customer_code} - ${customer.customer_name}`,
      })),
    ],
    [customers]
  );

  const projectOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn dự án' },
      ...(projects || []).map((project) => ({
        value: String(project.id),
        label: `${project.project_code} - ${project.project_name}`,
      })),
    ],
    [projects]
  );

  const productOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn sản phẩm' },
      ...(products || []).map((product) => ({
        value: String(product.id),
        label: `${product.product_code} - ${product.product_name}`,
      })),
    ],
    [products]
  );

  const employeeOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả người xử lý' },
      ...(employees || []).map((employee) => {
        const code = employee.employee_code || employee.user_code || employee.username;
        return {
          value: String(employee.id),
          label: `${code} - ${employee.full_name}`,
        };
      }),
    ],
    [employees]
  );

  const employeeFormOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn người xử lý' },
      ...employeeOptions.filter((option) => option.value !== ''),
    ],
    [employeeOptions]
  );

  const projectItemOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn hạng mục dự án' },
      ...(projectItems || []).map((item) => {
        const projectLabel = item.project_name || '--';
        const productLabel = item.product_name || '--';
        const customerLabel = item.customer_name || '--';
        const display = `${projectLabel} | ${productLabel} | ${customerLabel}`;
        return {
          value: String(item.id),
          label: display,
        };
      }),
    ],
    [projectItems]
  );

  const projectItemMap = useMemo(() => {
    const map = new Map<string, ProjectItemMaster>();
    (projectItems || []).forEach((item) => map.set(String(item.id), item));
    return map;
  }, [projectItems]);

  const statusFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    ],
    []
  );

  const priorityFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả ưu tiên' },
      ...PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    ],
    []
  );

  const statusFormOptions = useMemo<SearchableSelectOption[]>(
    () => STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const priorityFormOptions = useMemo<SearchableSelectOption[]>(
    () => PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const customerFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả khách hàng' },
      ...customerOptions.filter((option) => option.value !== ''),
    ],
    [customerOptions]
  );

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customerOptions
      .filter((option) => option.value !== '')
      .forEach((option) => map.set(option.value, option.label));
    return map;
  }, [customerOptions]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projectOptions
      .filter((option) => option.value !== '')
      .forEach((option) => map.set(option.value, option.label));
    return map;
  }, [projectOptions]);

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    productOptions
      .filter((option) => option.value !== '')
      .forEach((option) => map.set(option.value, option.label));
    return map;
  }, [productOptions]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    employeeFormOptions
      .filter((option) => option.value !== '')
      .forEach((option) => map.set(option.value, option.label));
    return map;
  }, [employeeFormOptions]);

  const handleProjectItemChange = (value: string) => {
    const selected = projectItemMap.get(String(value || ''));
    setFormData((prev) => ({
      ...prev,
      project_item_id: value,
      customer_id: selected?.customer_id ? String(selected.customer_id) : '',
      project_id: selected?.project_id ? String(selected.project_id) : '',
      product_id: selected?.product_id ? String(selected.product_id) : '',
    }));
  };

  const openCreateModal = () => {
    setFormMode('ADD');
    setEditingRequest(null);
    setFormData(emptyFormState());
    setFormError('');
  };

  const openEditModal = (request: SupportRequest) => {
    setFormMode('EDIT');
    setEditingRequest(request);
    setFormData(requestToFormState(request));
    setFormError('');
  };

  const closeFormModal = () => {
    setFormMode(null);
    setEditingRequest(null);
    setFormData(emptyFormState());
    setFormError('');
    setIsSubmitting(false);
    setIsCreateGroupOpen(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setGroupFormError('');
  };

  const closeHistoryModal = () => {
    setHistoryTarget(null);
    setHistoryRows([]);
    setHistoryError('');
    setIsHistoryLoading(false);
  };

  useEffect(() => {
    if (!formMode || formData.project_item_id || !formData.project_id || !formData.product_id) {
      return;
    }

    const matched = (projectItems || []).find(
      (item) =>
        String(item.project_id || '') === String(formData.project_id) &&
        String(item.product_id || '') === String(formData.product_id)
    );

    if (!matched) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      project_item_id: String(matched.id),
      customer_id: matched.customer_id ? String(matched.customer_id) : prev.customer_id,
    }));
  }, [formMode, formData.project_item_id, formData.project_id, formData.product_id, projectItems]);

  const filteredRequests = useMemo(() => {
    const keyword = normalizeToken(searchTerm.trim());

    return (supportRequests || []).filter((item) => {
      const customerLabel = item.customer_name || customerMap.get(String(item.customer_id)) || '';
      const assigneeLabel = item.assignee_name || employeeMap.get(String(item.assignee_id || '')) || '';
      const groupLabel = item.service_group_name || '';
      const matchesSearch = keyword
        ? normalizeToken(String(item.ticket_code || '')).includes(keyword) ||
          normalizeToken(String(item.summary || '')).includes(keyword) ||
          normalizeToken(String(customerLabel)).includes(keyword) ||
          normalizeToken(String(assigneeLabel)).includes(keyword) ||
          normalizeToken(String(groupLabel)).includes(keyword)
        : true;
      const matchesStatus = statusFilter ? item.status === statusFilter : true;
      const matchesPriority = priorityFilter ? item.priority === priorityFilter : true;
      const matchesGroup = groupFilter ? String(item.service_group_id || '') === groupFilter : true;
      const matchesAssignee = assigneeFilter ? String(item.assignee_id || '') === assigneeFilter : true;
      const matchesCustomer = customerFilter ? String(item.customer_id || '') === customerFilter : true;
      const requestedDate = String(item.requested_date || '').slice(0, 10);
      const matchesRequestedFrom = requestedFromFilter ? (requestedDate !== '' && requestedDate >= requestedFromFilter) : true;
      const matchesRequestedTo = requestedToFilter ? (requestedDate !== '' && requestedDate <= requestedToFilter) : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesGroup &&
        matchesAssignee &&
        matchesCustomer &&
        matchesRequestedFrom &&
        matchesRequestedTo
      );
    });
  }, [
    supportRequests,
    searchTerm,
    statusFilter,
    priorityFilter,
    groupFilter,
    assigneeFilter,
    customerFilter,
    requestedFromFilter,
    requestedToFilter,
    customerMap,
    employeeMap,
  ]);

  const filteredHistories = useMemo(() => {
    const keyword = normalizeToken(historySearchTerm.trim());
    if (!keyword) {
      return supportRequestHistories || [];
    }

    return (supportRequestHistories || []).filter((history) => {
      const ticket = history.ticket_code || '';
      const summary = history.request_summary || '';
      const actor = history.created_by_name || history.created_by_username || 'Hệ thống';
      return (
        normalizeToken(ticket).includes(keyword) ||
        normalizeToken(summary).includes(keyword) ||
        normalizeToken(actor).includes(keyword) ||
        normalizeToken(resolveStatusLabel(history.new_status)).includes(keyword) ||
        normalizeToken(resolveStatusLabel(history.old_status || 'OPEN')).includes(keyword)
      );
    });
  }, [supportRequestHistories, historySearchTerm]);

  const totalItems = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = useMemo(
    () => filteredRequests.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [filteredRequests, currentPage, rowsPerPage]
  );

  const totalOpen = useMemo(
    () => (supportRequests || []).filter((item) => item.status === 'OPEN' || item.status === 'HOTFIXING').length,
    [supportRequests]
  );
  const totalResolved = useMemo(
    () => (supportRequests || []).filter((item) => item.status === 'RESOLVED' || item.status === 'DEPLOYED').length,
    [supportRequests]
  );
  const totalOverdue = useMemo(() => {
    const today = todayIso();
    return (supportRequests || []).filter((item) => {
      if (!item.due_date) return false;
      if (item.status === 'RESOLVED' || item.status === 'DEPLOYED' || item.status === 'CANCELLED') return false;
      return item.due_date < today;
    }).length;
  }, [supportRequests]);

  const handleSubmit = async () => {
    if (!formData.summary.trim()) {
      setFormError('Nội dung yêu cầu là bắt buộc.');
      return;
    }
    if (!formData.project_item_id) {
      setFormError('Hạng mục dự án là bắt buộc.');
      return;
    }
    if (!formData.requested_date) {
      setFormError('Ngày nhận yêu cầu là bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload: Partial<SupportRequest> = {
      ticket_code: toNullableText(formData.ticket_code),
      summary: formData.summary.trim(),
      service_group_id: toNullableText(formData.service_group_id),
      project_item_id: toNullableText(formData.project_item_id),
      customer_id: formData.customer_id,
      project_id: toNullableText(formData.project_id),
      product_id: toNullableText(formData.product_id),
      reporter_name: toNullableText(formData.reporter_name),
      assignee_id: toNullableText(formData.assignee_id),
      status: formData.status,
      priority: formData.priority,
      requested_date: formData.requested_date,
      due_date: toNullableText(formData.due_date),
      resolved_date: toNullableText(formData.resolved_date),
      hotfix_date: toNullableText(formData.hotfix_date),
      noti_date: toNullableText(formData.noti_date),
      task_link: toNullableText(formData.task_link),
      change_log: toNullableText(formData.change_log),
      test_note: toNullableText(formData.test_note),
      notes: toNullableText(formData.notes),
    };

    try {
      if (formMode === 'ADD') {
        await onCreateSupportRequest(payload);
      } else if (formMode === 'EDIT' && editingRequest) {
        await onUpdateSupportRequest(editingRequest.id, payload);
      }
      closeFormModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu yêu cầu hỗ trợ.';
      setFormError(message);
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    const groupName = newGroupName.trim();
    if (!groupName) {
      setGroupFormError('Tên nhóm hỗ trợ là bắt buộc.');
      return;
    }

    setGroupFormError('');
    setIsCreatingGroup(true);
    try {
      const created = await onCreateSupportServiceGroup({
        group_name: groupName,
        description: toNullableText(newGroupDescription),
        is_active: true,
      });
      setFormData((prev) => ({ ...prev, service_group_id: String(created.id) }));
      setIsCreateGroupOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo nhóm hỗ trợ.';
      setGroupFormError(message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDelete = async (request: SupportRequest) => {
    const confirmed = window.confirm(`Xóa yêu cầu "${request.summary}"?`);
    if (!confirmed) return;

    try {
      await onDeleteSupportRequest(request.id);
    } catch {
      // Toast đã xử lý ở App.
    }
  };

  const handleOpenHistory = async (request: SupportRequest) => {
    setHistoryTarget(request);
    setHistoryRows([]);
    setHistoryError('');
    setIsHistoryLoading(true);

    try {
      const rows = await onLoadSupportRequestHistory(request.id);
      setHistoryRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử thay đổi.';
      setHistoryError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);

    const today = todayIso();
    downloadExcelWorkbook('mau_nhap_yeu_cau_ho_tro', [
      {
        name: 'SupportRequests',
        headers: [
          'Ticket',
          'Nội dung yêu cầu',
          'Hạng mục dự án',
          'Nhóm hỗ trợ',
          'Người xử lý',
          'Người báo yêu cầu',
          'Mức ưu tiên',
          'Trạng thái',
          'Ngày nhận yêu cầu',
          'Hạn hoàn thành',
          'Ngày hoàn thành',
          'Ngày đẩy hotfix',
          'Ngày thông báo KH',
          'Task link',
          'Hướng xử lý',
          'Ghi chú kiểm thử',
          'Ghi chú',
        ],
        rows: [
          [
            'IT360-1234',
            'Lỗi đồng bộ dữ liệu bệnh án',
            projectItemOptions[1]?.label || 'DA001 - Dự án VNPT HIS - Vietcombank | SOC_MONITOR - Dịch vụ giám sát SOC | Ngân hàng Vietcombank',
            groupOptions[1]?.label || 'HIS L2',
            employeeFormOptions[1]?.label || 'VNPT000001 - System Admin',
            'Nguyễn Văn A',
            'HIGH',
            'OPEN',
            today,
            today,
            today,
            today,
            today,
            'https://jira.example/IT360-1234',
            'Kiểm tra log và cập nhật service.',
            'Đã test QA pass.',
            'Theo dõi sau triển khai.',
          ],
        ],
      },
      {
        name: 'NhomHoTro',
        headers: ['ID', 'Tên nhóm'],
        rows: activeGroups.map((group) => [group.id, group.group_name]),
      },
      {
        name: 'ProjectItems',
        headers: [
          'ID',
          'Hạng mục dự án',
          'Mã dự án',
          'Tên dự án',
          'Mã sản phẩm',
          'Tên sản phẩm',
          'Mã khách hàng',
          'Tên khách hàng',
        ],
        rows: (projectItems || []).map((item) => [
          item.id,
          item.display_name || `${item.project_name || '--'} | ${item.product_name || '--'} | ${item.customer_name || '--'}`,
          item.project_code || '',
          item.project_name || '',
          item.product_code || '',
          item.product_name || '',
          item.customer_code || '',
          item.customer_name || '',
        ]),
      },
    ]);
  };

  const exportCsv = () => {
    const headers = [
      'Ticket',
      'Nội dung',
      'Nhóm hỗ trợ',
      'Khách hàng',
      'Người xử lý',
      'Ưu tiên',
      'Trạng thái',
      'Ngày nhận',
      'Hạn xử lý',
    ];
    const rows = filteredRequests.map((item) => [
      item.ticket_code || '',
      (item.summary || '').replace(/\n/g, ' '),
      item.service_group_name || '',
      item.customer_name || customerMap.get(String(item.customer_id)) || '',
      item.assignee_name || employeeMap.get(String(item.assignee_id || '')) || '',
      resolvePriorityLabel(item.priority),
      resolveStatusLabel(item.status),
      item.requested_date || '',
      item.due_date || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `support_requests_${todayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý yêu cầu hỗ trợ</h2>
          <p className="text-slate-500 text-sm mt-1">Theo dõi tiến độ xử lý task hỗ trợ theo khách hàng, dự án và sản phẩm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:flex-none">
            <button
              type="button"
              onClick={() => setShowImportMenu((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Nhập</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>

            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportMenu(false);
                      onOpenImportModal();
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">upload_file</span>
                    Nhập dữ liệu
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Tải file mẫu
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>Xuất</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng yêu cầu</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">support_agent</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{supportRequests.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Đang xử lý</p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg material-symbols-outlined">pending_actions</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalOpen}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Quá hạn xử lý</p>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg material-symbols-outlined">error</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalOverdue}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Đã hoàn thành</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg material-symbols-outlined">task_alt</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalResolved}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-3">
          <div className="w-full relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo ticket, nội dung, khách hàng, người xử lý..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
            />

            <SearchableSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityFilterOptions}
              placeholder="Tất cả ưu tiên"
            />

            <SearchableSelect
              value={groupFilter}
              onChange={setGroupFilter}
              options={groupOptions}
              placeholder="Tất cả nhóm hỗ trợ"
            />

            <SearchableSelect
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={employeeOptions}
              placeholder="Tất cả người xử lý"
            />

            <SearchableSelect
              value={customerFilter}
              onChange={setCustomerFilter}
              options={customerFilterOptions}
              placeholder="Tất cả khách hàng"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Từ ngày phát sinh</label>
              <input
                type="date"
                value={requestedFromFilter}
                onChange={(event) => setRequestedFromFilter(event.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đến ngày phát sinh</label>
              <input
                type="date"
                value={requestedToFilter}
                onChange={(event) => setRequestedToFilter(event.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1540px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Ticket</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Nội dung</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Nhóm hỗ trợ</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Khách hàng</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Người xử lý</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[170px] whitespace-nowrap"><span className="text-deep-teal">Ưu tiên</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Trạng thái</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px] whitespace-nowrap"><span className="text-deep-teal">Hạn xử lý</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0 z-30 min-w-[160px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-700">{item.ticket_code || `SUP-${item.id}`}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 max-w-[340px]">
                        <p className="font-semibold line-clamp-2" title={item.summary}>{item.summary}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.project_name || projectMap.get(String(item.project_id || '')) || '--'} | {item.product_name || productMap.get(String(item.product_id || '')) || '--'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.service_group_name || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-[240px] truncate" title={item.customer_name || ''}>
                        {item.customer_name || customerMap.get(String(item.customer_id)) || '--'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-[240px] truncate" title={item.assignee_name || ''}>
                        {item.assignee_name || employeeMap.get(String(item.assignee_id || '')) || '--'}
                      </td>
                      <td className="px-6 py-4 min-w-[170px]">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${resolvePriorityColor(item.priority)}`}>
                          {resolvePriorityLabel(item.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit whitespace-nowrap ${resolveStatusColor(item.status)}`}>
                          {resolveStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 min-w-[180px]">
                        <p className="font-medium whitespace-nowrap">{item.due_date || '--'}</p>
                        {item.due_date && item.due_date < todayIso() && item.status !== 'RESOLVED' && item.status !== 'DEPLOYED' && item.status !== 'CANCELLED' && (
                          <p className="text-xs text-red-600 font-medium mt-1">Quá hạn</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 z-20 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => handleOpenHistory(item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Lịch sử trạng thái">
                            <span className="material-symbols-outlined text-lg">history</span>
                          </button>
                          <button type="button" onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa">
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button type="button" onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">Không tìm thấy yêu cầu hỗ trợ phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60">
            <p className="text-xs text-slate-500">Đã hoàn thành: <span className="font-semibold text-slate-700">{totalResolved}</span></p>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="mt-6 md:mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '0.25s' }}>
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-900">Nhật ký thay đổi</h3>
            <p className="text-xs text-slate-500 mt-0.5">Hiển thị các lần chuyển trạng thái gần nhất của yêu cầu hỗ trợ.</p>
          </div>
          <div className="w-full md:w-[320px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={historySearchTerm}
              onChange={(event) => setHistorySearchTerm(event.target.value)}
              placeholder="Tìm theo ticket, nội dung, người cập nhật..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ticket</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nội dung</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ghi chú</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Người cập nhật</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredHistories.length > 0 ? (
                filteredHistories.slice(0, 30).map((history) => (
                  <tr key={history.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-slate-700">{history.ticket_code || `SUP-${history.request_id}`}</td>
                    <td className="px-6 py-3 text-sm text-slate-700 max-w-[260px] truncate" title={history.request_summary || ''}>
                      {history.request_summary || '--'}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${resolveStatusColor(history.old_status || 'OPEN')}`}>
                          {history.old_status ? resolveStatusLabel(history.old_status) : 'Khởi tạo'}
                        </span>
                        <span className="material-symbols-outlined text-slate-300 text-sm">arrow_forward</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${resolveStatusColor(history.new_status)}`}>
                          {resolveStatusLabel(history.new_status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600 max-w-[280px] truncate" title={history.comment || ''}>
                      {history.comment || '--'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {history.created_by_name || history.created_by_username || 'Hệ thống'}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{history.created_at || '--'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Chưa có nhật ký thay đổi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeFormModal}></div>
          <div className="relative bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3 text-slate-900">
                <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
                <h3 className="text-lg md:text-xl font-bold leading-tight">
                  {formMode === 'ADD' ? 'Thêm yêu cầu hỗ trợ' : 'Cập nhật yêu cầu hỗ trợ'}
                </h3>
              </div>
              <button type="button" onClick={closeFormModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ticket</label>
                  <input
                    value={formData.ticket_code}
                    onChange={(event) => setFormData((prev) => ({ ...prev, ticket_code: event.target.value }))}
                    placeholder="IT360-1234"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Hạng mục dự án <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    value={formData.project_item_id}
                    onChange={handleProjectItemChange}
                    options={projectItemOptions}
                    placeholder="Chọn hạng mục dự án"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nội dung yêu cầu <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.summary}
                    onChange={(event) => setFormData((prev) => ({ ...prev, summary: event.target.value }))}
                    rows={3}
                    placeholder="Mô tả chi tiết yêu cầu cần xử lý..."
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 resize-y min-h-[90px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Nhóm hỗ trợ</label>
                    <button
                      type="button"
                      onClick={() => setIsCreateGroupOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 text-primary hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Tạo nhóm hỗ trợ
                    </button>
                  </div>
                  <SearchableSelect
                    value={formData.service_group_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, service_group_id: value }))}
                    options={[{ value: '', label: 'Chọn nhóm hỗ trợ' }, ...groupOptions.filter((option) => option.value !== '')]}
                    placeholder="Chọn nhóm hỗ trợ"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Người xử lý</label>
                  <SearchableSelect
                    value={formData.assignee_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, assignee_id: value }))}
                    options={employeeFormOptions}
                    placeholder="Chọn người xử lý"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Đơn vị yêu cầu</label>
                  <input
                    value={customerMap.get(String(formData.customer_id || '')) || ''}
                    readOnly
                    placeholder="Chọn hạng mục dự án để tự động điền"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Dự án</label>
                  <input
                    value={projectMap.get(String(formData.project_id || '')) || ''}
                    readOnly
                    placeholder="Tự động điền theo hạng mục"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Sản phẩm</label>
                  <input
                    value={productMap.get(String(formData.product_id || '')) || ''}
                    readOnly
                    placeholder="Tự động điền theo hạng mục"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Người báo yêu cầu</label>
                  <input
                    value={formData.reporter_name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, reporter_name: event.target.value }))}
                    placeholder="Tên người báo lỗi/yêu cầu"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mức ưu tiên</label>
                  <SearchableSelect
                    value={formData.priority}
                    onChange={(value) => setFormData((prev) => ({ ...prev, priority: value as SupportRequestPriority }))}
                    options={priorityFormOptions}
                    placeholder="Chọn mức ưu tiên"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Trạng thái</label>
                  <SearchableSelect
                    value={formData.status}
                    onChange={(value) => setFormData((prev) => ({ ...prev, status: value as SupportRequestStatus }))}
                    options={statusFormOptions}
                    placeholder="Chọn trạng thái"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày nhận yêu cầu <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.requested_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, requested_date: event.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Hạn hoàn thành</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày hoàn thành</label>
                  <input
                    type="date"
                    value={formData.resolved_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, resolved_date: event.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày đẩy hotfix</label>
                  <input
                    type="date"
                    value={formData.hotfix_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, hotfix_date: event.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày thông báo KH</label>
                  <input
                    type="date"
                    value={formData.noti_date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, noti_date: event.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Liên kết task</label>
                  <input
                    value={formData.task_link}
                    onChange={(event) => setFormData((prev) => ({ ...prev, task_link: event.target.value }))}
                    placeholder="https://jira... hoặc https://bitbucket..."
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Hướng xử lý kỹ thuật</label>
                  <textarea
                    value={formData.change_log}
                    onChange={(event) => setFormData((prev) => ({ ...prev, change_log: event.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y min-h-[90px]"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ghi chú kiểm thử</label>
                  <textarea
                    value={formData.test_note}
                    onChange={(event) => setFormData((prev) => ({ ...prev, test_note: event.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ghi chú chung</label>
                  <textarea
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>
              </div>

              {formError && <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{formError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={closeFormModal} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors">Hủy</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-60"
              >
                {isSubmitting ? 'Đang lưu...' : formMode === 'ADD' ? 'Lưu' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCreateGroupOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Tạo nhóm hỗ trợ</h3>
              <button type="button" onClick={() => setIsCreateGroupOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Tên nhóm <span className="text-red-500">*</span></label>
                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="Ví dụ: HIS L2"
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                <textarea
                  value={newGroupDescription}
                  onChange={(event) => setNewGroupDescription(event.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                />
              </div>
              {groupFormError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{groupFormError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsCreateGroupOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100">Hủy</button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {isCreatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeHistoryModal}></div>
          <div className="relative bg-white w-full max-w-3xl max-h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">history</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Lịch sử trạng thái</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{historyTarget.ticket_code || `SUP-${historyTarget.id}`} - {historyTarget.summary}</p>
                </div>
              </div>
              <button type="button" onClick={closeHistoryModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {isHistoryLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3"></span>
                  <p className="text-sm font-medium">Đang tải lịch sử...</p>
                </div>
              )}

              {!isHistoryLoading && historyError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{historyError}</div>
              )}

              {!isHistoryLoading && !historyError && (
                <div className="space-y-4">
                  {historyRows.length > 0 ? (
                    historyRows.map((row) => (
                      <div key={row.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50/40">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${resolveStatusColor(row.old_status || 'OPEN')}`}>
                            {row.old_status ? resolveStatusLabel(row.old_status) : 'Khởi tạo'}
                          </span>
                          <span className="material-symbols-outlined text-slate-400 text-base">arrow_forward</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${resolveStatusColor(row.new_status)}`}>
                            {resolveStatusLabel(row.new_status)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{row.comment || 'Không có ghi chú.'}</p>
                        <p className="text-xs text-slate-500 mt-2">{row.created_by_name || row.created_by_username || 'Hệ thống'} | {row.created_at || '--'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-500">Chưa có lịch sử thay đổi trạng thái.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
