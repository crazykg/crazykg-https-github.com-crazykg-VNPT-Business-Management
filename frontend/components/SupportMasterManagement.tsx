import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import {
  Customer,
  ProjectTypeOption,
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowFormFieldConfig,
  WorkflowStatusTransition,
  WorkflowStatusCatalog,
  WorklogActivityTypeOption,
  WorkCalendarDay,
} from '../types';
import {
  // createWorkflowFormFieldConfig,
  // createWorkflowStatusTransition,
  // createWorkflowStatusCatalog,
  // fetchWorkflowFormFieldConfigs,
  // fetchWorkflowStatusTransitions,
  // fetchWorkflowStatusCatalogs,
  // updateWorkflowFormFieldConfig,
  // updateWorkflowStatusTransition,
  // updateWorkflowStatusCatalog,
  fetchMonthlyCalendars,
  updateCalendarDay,
  generateCalendarDay,
} from '../services/v5Api';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect, SearchableSelectOption } from './SearchableSelect';

type MasterType =
  | 'group'
  | 'contact_position'
  | 'status'
  | 'project_type'
  | 'worklog_activity_type'
  | 'sla_config'
  | 'workflow_status_catalog'
  | 'workflow_status_transition'
  | 'workflow_form_field_config'
  | 'work_calendar';
type ActivityFilter = 'all' | 'active' | 'inactive';
type FormMode = 'ADD' | 'EDIT';

interface SupportMasterManagementProps {
  customers: Customer[];
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions: SupportContactPosition[];
  supportRequestStatuses: SupportRequestStatusOption[];
  worklogActivityTypes: WorklogActivityTypeOption[];
  supportSlaConfigs: SupportSlaConfigOption[];
  onCreateSupportServiceGroup: (
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  onUpdateSupportServiceGroup: (
    id: string | number,
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  onCreateSupportContactPosition: (
    payload: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ) => Promise<SupportContactPosition>;
  onCreateSupportContactPositionsBulk?: (
    items: Array<Partial<SupportContactPosition>>,
    options?: { silent?: boolean }
  ) => Promise<any>;
  onUpdateSupportContactPosition: (
    id: string | number,
    payload: Partial<SupportContactPosition>,
    options?: { silent?: boolean }
  ) => Promise<SupportContactPosition>;
  onCreateSupportRequestStatus: (
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  onUpdateSupportRequestStatus: (
    id: string | number,
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  projectTypes?: ProjectTypeOption[];
  onCreateProjectType: (
    payload: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<ProjectTypeOption>;
  onUpdateProjectType: (
    id: string | number,
    payload: Partial<ProjectTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<ProjectTypeOption>;
  canWriteProjectTypes?: boolean;
  canReadProjectTypes?: boolean;
  onCreateWorklogActivityType: (
    payload: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<WorklogActivityTypeOption>;
  onUpdateWorklogActivityType: (
    id: string | number,
    payload: Partial<WorklogActivityTypeOption>,
    options?: { silent?: boolean }
  ) => Promise<WorklogActivityTypeOption>;
  onCreateSupportSlaConfig: (
    payload: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportSlaConfigOption>;
  onUpdateSupportSlaConfig: (
    id: string | number,
    payload: Partial<SupportSlaConfigOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportSlaConfigOption>;
  canReadCustomers?: boolean;
  canReadServiceGroups?: boolean;
  canReadContactPositions?: boolean;
  canReadStatuses?: boolean;
  canReadWorklogActivityTypes?: boolean;
  canReadSlaConfigs?: boolean;
  canWriteServiceGroups?: boolean;
  canWriteContactPositions?: boolean;
  canWriteStatuses?: boolean;
  canWriteWorklogActivityTypes?: boolean;
  canWriteSlaConfigs?: boolean;
  // Lịch làm việc
  canWriteWorkCalendar?: boolean;
  canReadWorkCalendar?: boolean;
}

interface GroupFormState {
  customer_id: string;
  group_code: string;
  group_name: string;
  description: string;
  workflow_status_catalog_id: string;
  workflow_form_key: string;
  is_active: boolean;
}

interface ContactPositionFormState {
  position_code: string;
  position_name: string;
  description: string;
  is_active: boolean;
}

interface StatusFormState {
  status_code: string;
  status_name: string;
  description: string;
  requires_completion_dates: boolean;
  is_terminal: boolean;
  is_transfer_dev: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProjectTypeFormState {
  type_code: string;
  type_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface WorklogActivityTypeFormState {
  code: string;
  name: string;
  description: string;
  default_is_billable: boolean;
  phase_hint: string;
  sort_order: number;
  is_active: boolean;
}

interface SupportSlaConfigFormState {
  status: string;
  sub_status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  sla_hours: number;
  request_type_prefix: string;
  service_group_id: string;
  workflow_action_code: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface WorkflowStatusCatalogFormState {
  level: number;
  status_code: string;
  status_name: string;
  parent_id: string;
  canonical_status: string;
  canonical_sub_status: string;
  flow_step: string;
  form_key: string;
  is_leaf: boolean;
  sort_order: number;
  is_active: boolean;
}

interface WorkflowStatusTransitionFormState {
  from_status_catalog_id: string;
  to_status_catalog_id: string;
  action_code: string;
  action_name: string;
  required_role: string;
  condition_json_text: string;
  notify_targets_text: string;
  sort_order: number;
  is_active: boolean;
}

interface WorkflowFormFieldConfigFormState {
  status_catalog_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  excel_column: string;
  options_json_text: string;
  is_active: boolean;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeGroupCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const normalizeStatusCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const normalizeContactPositionCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const normalizeMasterCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const defaultGroupForm = (): GroupFormState => ({
  customer_id: '',
  group_code: '',
  group_name: '',
  description: '',
  workflow_status_catalog_id: '',
  workflow_form_key: '',
  is_active: true,
});

const defaultContactPositionForm = (): ContactPositionFormState => ({
  position_code: '',
  position_name: '',
  description: '',
  is_active: true,
});

const defaultStatusForm = (sortOrder: number): StatusFormState => ({
  status_code: '',
  status_name: '',
  description: '',
  requires_completion_dates: true,
  is_terminal: false,
  is_transfer_dev: false,
  is_active: true,
  sort_order: sortOrder,
});

const normalizeProjectTypeCodeInput = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);

const normalizeProjectTypeCodeDraftInput = (value: string): string =>
  String(value || '').slice(0, 100);

const defaultProjectTypeForm = (sortOrder: number): ProjectTypeFormState => ({
  type_code: '',
  type_name: '',
  description: '',
  is_active: true,
  sort_order: sortOrder,
});

const defaultWorklogActivityTypeForm = (sortOrder: number): WorklogActivityTypeFormState => ({
  code: '',
  name: '',
  description: '',
  default_is_billable: true,
  phase_hint: '',
  sort_order: sortOrder,
  is_active: true,
});

const defaultSupportSlaConfigForm = (sortOrder: number): SupportSlaConfigFormState => ({
  status: '',
  sub_status: '',
  priority: 'MEDIUM',
  sla_hours: 24,
  request_type_prefix: '',
  service_group_id: '',
  workflow_action_code: '',
  description: '',
  sort_order: sortOrder,
  is_active: true,
});

const defaultWorkflowStatusCatalogForm = (sortOrder: number): WorkflowStatusCatalogFormState => ({
  level: 1,
  status_code: '',
  status_name: '',
  parent_id: '',
  canonical_status: '',
  canonical_sub_status: '',
  flow_step: '',
  form_key: '',
  is_leaf: true,
  sort_order: sortOrder,
  is_active: true,
});

const defaultWorkflowStatusTransitionForm = (sortOrder: number): WorkflowStatusTransitionFormState => ({
  from_status_catalog_id: '',
  to_status_catalog_id: '',
  action_code: '',
  action_name: '',
  required_role: '',
  condition_json_text: '',
  notify_targets_text: '',
  sort_order: sortOrder,
  is_active: true,
});

const defaultWorkflowFormFieldConfigForm = (sortOrder: number): WorkflowFormFieldConfigFormState => ({
  status_catalog_id: '',
  field_key: '',
  field_label: '',
  field_type: 'text',
  required: false,
  sort_order: sortOrder,
  excel_column: '',
  options_json_text: '',
  is_active: true,
});

// ─── Work Calendar form state ────────────────────────────────────────────────

interface WorkCalendarDayFormState {
  is_working_day: boolean;
  is_holiday: boolean;
  holiday_name: string;
  note: string;
}

const defaultWorkCalendarDayForm = (): WorkCalendarDayFormState => ({
  is_working_day: true,
  is_holiday: false,
  holiday_name: '',
  note: '',
});

export const SupportMasterManagement: React.FC<SupportMasterManagementProps> = ({
  customers = [],
  supportServiceGroups = [],
  supportContactPositions = [],
  supportRequestStatuses = [],
  worklogActivityTypes = [],
  supportSlaConfigs = [],
  onCreateSupportServiceGroup,
  onUpdateSupportServiceGroup,
  onCreateSupportContactPosition,
  onUpdateSupportContactPosition,
  onCreateSupportRequestStatus,
  onUpdateSupportRequestStatus,
  projectTypes = [],
  onCreateProjectType,
  onUpdateProjectType,
  onCreateWorklogActivityType,
  onUpdateWorklogActivityType,
  onCreateSupportSlaConfig,
  onUpdateSupportSlaConfig,
  canReadCustomers = true,
  canReadServiceGroups = true,
  canReadContactPositions = true,
  canReadStatuses = true,
  canReadWorklogActivityTypes = true,
  canReadSlaConfigs = true,
  canWriteServiceGroups = true,
  canWriteContactPositions = true,
  canWriteStatuses = true,
  canWriteWorklogActivityTypes = true,
  canWriteSlaConfigs = true,
  canWriteProjectTypes = true,
  canReadProjectTypes = true,
  canWriteWorkCalendar = true,
  canReadWorkCalendar = true,
}) => {
  const [masterType, setMasterType] = useState<MasterType>('group');
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ─── Work Calendar local state ──────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-based
  const [calYear,  setCalYear]  = useState<number>(currentYear);
  const [calMonth, setCalMonth] = useState<number>(currentMonth);
  const [calDays,  setCalDays]  = useState<WorkCalendarDay[]>([]);
  const [calLoading,   setCalLoading]   = useState(false);
  const [calError,     setCalError]     = useState('');
  const [calSaving,    setCalSaving]    = useState(false);
  const [editingCalDay, setEditingCalDay] = useState<WorkCalendarDay | null>(null);
  const [calDayForm, setCalDayForm] = useState<WorkCalendarDayFormState>(defaultWorkCalendarDayForm);
  const [calGenYear,   setCalGenYear]   = useState<number>(currentYear);
  const [calGenLoading, setCalGenLoading] = useState(false);
  const [calGenMsg,    setCalGenMsg]    = useState('');
  // ────────────────────────────────────────────────────────────────────────

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingGroup, setEditingGroup] = useState<SupportServiceGroup | null>(null);
  const [editingContactPosition, setEditingContactPosition] = useState<SupportContactPosition | null>(null);
  const [editingStatus, setEditingStatus] = useState<SupportRequestStatusOption | null>(null);
  const [editingProjectType, setEditingProjectType] = useState<ProjectTypeOption | null>(null);
  const [editingWorklogActivityType, setEditingWorklogActivityType] = useState<WorklogActivityTypeOption | null>(null);
  const [editingSupportSlaConfig, setEditingSupportSlaConfig] = useState<SupportSlaConfigOption | null>(null);
  const [editingWorkflowStatusCatalog, setEditingWorkflowStatusCatalog] = useState<WorkflowStatusCatalog | null>(null);
  const [editingWorkflowStatusTransition, setEditingWorkflowStatusTransition] = useState<WorkflowStatusTransition | null>(null);
  const [editingWorkflowFormFieldConfig, setEditingWorkflowFormFieldConfig] = useState<WorkflowFormFieldConfig | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(defaultGroupForm);
  const [contactPositionForm, setContactPositionForm] = useState<ContactPositionFormState>(defaultContactPositionForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(() => defaultStatusForm(10));
  const [projectTypeForm, setProjectTypeForm] = useState<ProjectTypeFormState>(() =>
    defaultProjectTypeForm(10)
  );
  const [worklogActivityTypeForm, setWorklogActivityTypeForm] = useState<WorklogActivityTypeFormState>(() =>
    defaultWorklogActivityTypeForm(10)
  );
  const [supportSlaConfigForm, setSupportSlaConfigForm] = useState<SupportSlaConfigFormState>(() =>
    defaultSupportSlaConfigForm(10)
  );
  const [workflowStatusCatalogForm, setWorkflowStatusCatalogForm] = useState<WorkflowStatusCatalogFormState>(() =>
    defaultWorkflowStatusCatalogForm(10)
  );
  const [workflowStatusTransitionForm, setWorkflowStatusTransitionForm] = useState<WorkflowStatusTransitionFormState>(() =>
    defaultWorkflowStatusTransitionForm(10)
  );
  const [workflowFormFieldConfigForm, setWorkflowFormFieldConfigForm] = useState<WorkflowFormFieldConfigFormState>(() =>
    defaultWorkflowFormFieldConfigForm(10)
  );
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflowStatusCatalogs, setWorkflowStatusCatalogs] = useState<WorkflowStatusCatalog[]>([]);
  const [workflowStatusTransitions, setWorkflowStatusTransitions] = useState<WorkflowStatusTransition[]>([]);
  const [workflowFormFieldConfigs, setWorkflowFormFieldConfigs] = useState<WorkflowFormFieldConfig[]>([]);
  const [isWorkflowConfigLoading, setIsWorkflowConfigLoading] = useState(false);

  const customerOptions = useMemo<SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = customers.map((item) => ({
      value: String(item.id),
      label:
        [String(item.customer_code || '').trim(), String(item.customer_name || '').trim()]
          .filter((part) => part !== '')
          .join(' - ') || `#${item.id}`,
      searchText: `${item.customer_code || ''} ${item.customer_name || ''}`.trim(),
    }));

    const normalizedCustomerId = String(groupForm.customer_id || '').trim();
    const hasSelectedOption =
      normalizedCustomerId !== '' && options.some((item) => String(item.value) === normalizedCustomerId);

    if (!hasSelectedOption && normalizedCustomerId !== '' && editingGroup) {
      const fallbackLabel =
        [String(editingGroup.customer_code || '').trim(), String(editingGroup.customer_name || '').trim()]
          .filter((part) => part !== '')
          .join(' - ') || `#${normalizedCustomerId}`;

      options.unshift({
        value: normalizedCustomerId,
        label: fallbackLabel,
        searchText: fallbackLabel,
      });
    }

    return options;
  }, [customers, editingGroup, groupForm.customer_id]);

  const hasCustomerOptions = customers.length > 0;
  const customerSelectDisabled = !canReadCustomers || !hasCustomerOptions;
  const customerSelectError = !canReadCustomers
    ? 'Bạn chưa có quyền xem danh mục khách hàng.'
    : !hasCustomerOptions
      ? 'Chưa có dữ liệu khách hàng để liên kết.'
      : '';

  const workflowStatusCatalogOptions = useMemo<SearchableSelectOption[]>(() => {
    const activeRows = (workflowStatusCatalogs || []).filter((item) => item.is_active !== false);
    const options: SearchableSelectOption[] = activeRows.map((item) => ({
      value: String(item.id),
      label:
        [
          String(item.status_name || '').trim(),
          String(item.status_code || '').trim() !== '' ? `(${String(item.status_code).trim()})` : '',
        ]
          .filter((part) => part !== '')
          .join(' '),
      searchText: `${item.status_code || ''} ${item.status_name || ''} ${item.canonical_status || ''} ${item.canonical_sub_status || ''}`.trim(),
    }));

    const selectedValue = String(groupForm.workflow_status_catalog_id || '').trim();
    const hasSelectedOption = selectedValue !== '' && options.some((item) => String(item.value) === selectedValue);
    if (!hasSelectedOption && selectedValue !== '' && editingGroup?.workflow_status_name) {
      const fallbackLabel = [
        String(editingGroup.workflow_status_name || '').trim(),
        String(editingGroup.workflow_status_code || '').trim() !== ''
          ? `(${String(editingGroup.workflow_status_code).trim()})`
          : '',
      ]
        .filter((part) => part !== '')
        .join(' ');

      options.unshift({
        value: selectedValue,
        label: fallbackLabel || `#${selectedValue}`,
        searchText: fallbackLabel,
      });
    }

    return [
      { value: '', label: 'Không gắn workflow mặc định' },
      ...options,
    ];
  }, [editingGroup, groupForm.workflow_status_catalog_id, workflowStatusCatalogs]);

  const workflowFormKeyOptions = useMemo<SearchableSelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SearchableSelectOption[] = [];

    (workflowStatusCatalogs || []).forEach((item) => {
      const formKey = String(item.form_key || '').trim();
      if (formKey === '' || seen.has(formKey)) {
        return;
      }

      seen.add(formKey);
      options.push({
        value: formKey,
        label: formKey,
        searchText: `${formKey} ${item.status_name || ''}`.trim(),
      });
    });

    const selectedValue = String(groupForm.workflow_form_key || '').trim();
    if (selectedValue !== '' && !seen.has(selectedValue)) {
      options.unshift({
        value: selectedValue,
        label: selectedValue,
        searchText: selectedValue,
      });
    }

    options.sort((a, b) => String(a.label).localeCompare(String(b.label), 'vi'));

    return [
      { value: '', label: 'Dùng form theo workflow' },
      ...options,
    ];
  }, [groupForm.workflow_form_key, workflowStatusCatalogs]);

  const masterOptions = useMemo<SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = [];

    if (canReadServiceGroups) {
      options.push({ value: 'group', label: 'Nhóm Zalo/Tele' });
    }
    if (canReadContactPositions) {
      options.push({ value: 'contact_position', label: 'Chức vụ liên hệ' });
    }
    if (canReadStatuses) {
      options.push({ value: 'status', label: 'Trạng thái hỗ trợ' });
    }

    if (canReadProjectTypes) {
      options.push({ value: 'project_type', label: 'Loại dự án - quản lý dự án' });
    }
    if (canReadWorklogActivityTypes) {
      options.push({ value: 'worklog_activity_type', label: 'Loại công việc worklog' });
    }
    if (canReadSlaConfigs) {
      options.push({ value: 'sla_config', label: 'Cấu hình SLA hỗ trợ' });
    }
    if (canReadStatuses) {
      options.push({ value: 'workflow_status_catalog', label: 'Workflow trạng thái phân cấp' });
      options.push({ value: 'workflow_status_transition', label: 'Workflow transition action' });
      options.push({ value: 'workflow_form_field_config', label: 'Workflow schema field' });
    }
    if (canReadWorkCalendar) {
      options.push({ value: 'work_calendar', label: 'Lịch làm việc' });
    }

    return options;
  }, [
    canReadServiceGroups,
    canReadContactPositions,
    canReadStatuses,
    canReadProjectTypes,
    canReadWorklogActivityTypes,
    canReadSlaConfigs,
    canReadWorkCalendar,
  ]);

  const canWriteCurrentMaster =
    masterType === 'group'
      ? canWriteServiceGroups
      : masterType === 'contact_position'
        ? canWriteContactPositions
      : masterType === 'status'
        ? canWriteStatuses
      : masterType === 'project_type'
        ? canWriteProjectTypes
      : masterType === 'worklog_activity_type'
        ? canWriteWorklogActivityTypes
      : masterType === 'sla_config'
        ? canWriteSlaConfigs
      : masterType === 'work_calendar'
        ? canWriteWorkCalendar
        : canWriteStatuses;

  const nextStatusSortOrder = useMemo(() => {
    const maxSort = (supportRequestStatuses || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [supportRequestStatuses]);

  const nextProjectTypeSortOrder = useMemo(() => {
    const maxSort = (projectTypes || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [projectTypes]);

  const nextWorklogActivityTypeSortOrder = useMemo(() => {
    const maxSort = (worklogActivityTypes || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [worklogActivityTypes]);

  const nextSupportSlaConfigSortOrder = useMemo(() => {
    const maxSort = (supportSlaConfigs || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [supportSlaConfigs]);

  const nextWorkflowStatusCatalogSortOrder = useMemo(() => {
    const maxSort = (workflowStatusCatalogs || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowStatusCatalogs]);

  const nextWorkflowStatusTransitionSortOrder = useMemo(() => {
    const maxSort = (workflowStatusTransitions || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowStatusTransitions]);

  const nextWorkflowFormFieldConfigSortOrder = useMemo(() => {
    const maxSort = (workflowFormFieldConfigs || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowFormFieldConfigs]);

  useEffect(() => {
    if (masterOptions.some((option) => option.value === masterType)) {
      return;
    }

    const fallback = masterOptions[0]?.value;
    if (fallback) {
      setMasterType(fallback as MasterType);
    }
  }, [masterOptions, masterType]);

  const loadWorkflowConfigs = async (): Promise<void> => {
    // DISABLED: Old workflow config loading - replaced by new Workflow Management module
    // The new workflow management is now at /workflow-management
    // This legacy code attempted to load workflow-status-catalogs, workflow-status-transitions,
    // and workflow-form-field-configs which don't exist in the new API structure.
    // 
    // To use workflow configs, navigate to /workflow-management instead.
    
    // if (!canReadStatuses) {
    //   return;
    // }
    // setIsWorkflowConfigLoading(true);
    // try {
    //   const [catalogRows, transitionRows, fieldRows] = await Promise.all([
    //     fetchWorkflowStatusCatalogs(true),
    //     fetchWorkflowStatusTransitions(null, true),
    //     fetchWorkflowFormFieldConfigs(null, true),
    //   ]);
    //   setWorkflowStatusCatalogs(catalogRows || []);
    //   setWorkflowStatusTransitions(transitionRows || []);
    //   setWorkflowFormFieldConfigs(fieldRows || []);
    // } catch (error) {
    //   console.error('Failed to load workflow config datasets', error);
    // } finally {
    //   setIsWorkflowConfigLoading(false);
    // }
  };

  useEffect(() => {
    void loadWorkflowConfigs();
  }, [canReadStatuses]);

  // Load lịch khi chuyển sang tab work_calendar hoặc thay đổi year/month
  useEffect(() => {
    if (masterType !== 'work_calendar' || !canReadWorkCalendar) {
      return;
    }
    setCalLoading(true);
    setCalError('');
    fetchMonthlyCalendars({ year: calYear, month: calMonth })
      .then((rows) => setCalDays(rows || []))
      .catch((err) => setCalError(String(err?.message || 'Lỗi tải lịch')))
      .finally(() => setCalLoading(false));
  }, [masterType, calYear, calMonth, canReadWorkCalendar]);

  const filteredGroups = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (supportServiceGroups || []).filter((group) => {
      const isActive = group.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${group.group_code || ''} ${group.group_name || ''} ${group.description || ''} ${group.customer_code || ''} ${group.customer_name || ''} ${group.workflow_status_code || ''} ${group.workflow_status_name || ''} ${group.workflow_form_key || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportServiceGroups, activityFilter, searchTerm]);

  const filteredContactPositions = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (supportContactPositions || []).filter((position) => {
      const isActive = position.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${position.position_code || ''} ${position.position_name || ''} ${position.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportContactPositions, activityFilter, searchTerm]);

  const filteredStatuses = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (supportRequestStatuses || []).filter((status) => {
      const isActive = status.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${status.status_code || ''} ${status.status_name || ''} ${status.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportRequestStatuses, activityFilter, searchTerm]);

  const filteredProjectTypes = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (projectTypes || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.type_code || ''} ${item.type_name || ''} ${item.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [projectTypes, activityFilter, searchTerm]);

  const filteredWorklogActivityTypes = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (worklogActivityTypes || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.code || ''} ${item.name || ''} ${item.phase_hint || ''} ${item.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [worklogActivityTypes, activityFilter, searchTerm]);

  const filteredSupportSlaConfigs = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (supportSlaConfigs || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.status || ''} ${item.sub_status || ''} ${item.priority || ''} ${item.request_type_prefix || ''} ${item.service_group_name || ''} ${item.workflow_action_code || ''} ${item.description || ''} ${item.sla_hours || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportSlaConfigs, activityFilter, searchTerm]);

  const supportSlaServiceGroupOptions = useMemo<SearchableSelectOption[]>(() => {
    return (supportServiceGroups || []).map((group) => ({
      value: String(group.id),
      label: String(group.group_name || group.group_code || `#${group.id}`),
      searchText: `${group.group_code || ''} ${group.group_name || ''} ${group.customer_name || ''}`.trim(),
    }));
  }, [supportServiceGroups]);

  const supportSlaWorkflowActionOptions = useMemo<SearchableSelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SearchableSelectOption[] = [];

    (workflowStatusTransitions || []).forEach((transition) => {
      const actionCode = normalizeMasterCodeInput(transition.action_code || '');
      if (!actionCode || seen.has(actionCode)) {
        return;
      }
      seen.add(actionCode);
      options.push({
        value: actionCode,
        label: transition.action_name
          ? `${transition.action_name} (${actionCode})`
          : actionCode,
        searchText: `${actionCode} ${transition.action_name || ''}`.trim(),
      });
    });

    return options.sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [workflowStatusTransitions]);

  const filteredWorkflowStatusCatalogs = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (workflowStatusCatalogs || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.status_code || ''} ${item.status_name || ''} ${item.canonical_status || ''} ${item.canonical_sub_status || ''} ${item.form_key || ''} ${item.flow_step || ''} ${item.parent_name || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [workflowStatusCatalogs, activityFilter, searchTerm]);

  const filteredWorkflowStatusTransitions = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (workflowStatusTransitions || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.from_status_name || ''} ${item.to_status_name || ''} ${item.action_code || ''} ${item.action_name || ''} ${item.required_role || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [workflowStatusTransitions, activityFilter, searchTerm]);

  const filteredWorkflowFormFieldConfigs = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (workflowFormFieldConfigs || []).filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.status_name || ''} ${item.field_key || ''} ${item.field_label || ''} ${item.field_type || ''} ${item.excel_column || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [workflowFormFieldConfigs, activityFilter, searchTerm]);

  const totalItems =
    masterType === 'group'
      ? filteredGroups.length
      : masterType === 'contact_position'
        ? filteredContactPositions.length
        : masterType === 'status'
          ? filteredStatuses.length
        : masterType === 'project_type'
          ? filteredProjectTypes.length
        : masterType === 'worklog_activity_type'
          ? filteredWorklogActivityTypes.length
        : masterType === 'sla_config'
          ? filteredSupportSlaConfigs.length
          : masterType === 'workflow_status_catalog'
            ? filteredWorkflowStatusCatalogs.length
            : masterType === 'workflow_status_transition'
              ? filteredWorkflowStatusTransitions.length
              : filteredWorkflowFormFieldConfigs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [masterType, searchTerm, activityFilter, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedGroups = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredGroups.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredGroups, safePage, rowsPerPage]);

  const pagedContactPositions = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredContactPositions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredContactPositions, safePage, rowsPerPage]);

  const pagedStatuses = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredStatuses.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredStatuses, safePage, rowsPerPage]);

  const pagedProjectTypes = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredProjectTypes.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredProjectTypes, safePage, rowsPerPage]);

  const pagedWorklogActivityTypes = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredWorklogActivityTypes.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorklogActivityTypes, safePage, rowsPerPage]);

  const pagedSupportSlaConfigs = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredSupportSlaConfigs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredSupportSlaConfigs, safePage, rowsPerPage]);

  const pagedWorkflowStatusCatalogs = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredWorkflowStatusCatalogs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorkflowStatusCatalogs, safePage, rowsPerPage]);

  const pagedWorkflowStatusTransitions = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredWorkflowStatusTransitions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorkflowStatusTransitions, safePage, rowsPerPage]);

  const pagedWorkflowFormFieldConfigs = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredWorkflowFormFieldConfigs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorkflowFormFieldConfigs, safePage, rowsPerPage]);

  const closeForm = () => {
    setFormMode(null);
    setEditingGroup(null);
    setEditingContactPosition(null);
    setEditingStatus(null);
    setEditingProjectType(null);
    setEditingWorklogActivityType(null);
    setEditingSupportSlaConfig(null);
    setEditingWorkflowStatusCatalog(null);
    setEditingWorkflowStatusTransition(null);
    setEditingWorkflowFormFieldConfig(null);
    setGroupForm(defaultGroupForm());
    setContactPositionForm(defaultContactPositionForm());
    setStatusForm(defaultStatusForm(nextStatusSortOrder));
    setProjectTypeForm(defaultProjectTypeForm(nextProjectTypeSortOrder));
    setWorklogActivityTypeForm(defaultWorklogActivityTypeForm(nextWorklogActivityTypeSortOrder));
    setSupportSlaConfigForm(defaultSupportSlaConfigForm(nextSupportSlaConfigSortOrder));
    setWorkflowStatusCatalogForm(defaultWorkflowStatusCatalogForm(nextWorkflowStatusCatalogSortOrder));
    setWorkflowStatusTransitionForm(defaultWorkflowStatusTransitionForm(nextWorkflowStatusTransitionSortOrder));
    setWorkflowFormFieldConfigForm(defaultWorkflowFormFieldConfigForm(nextWorkflowFormFieldConfigSortOrder));
    setFormError('');
    setIsSubmitting(false);
  };

  useEscKey(closeForm, formMode !== null);

  const openGroupAdd = () => {
    setEditingGroup(null);
    setGroupForm(defaultGroupForm());
    setFormError('');
  };

  const openContactPositionAdd = () => {
    setFormMode('ADD');
    setEditingContactPosition(null);
    setContactPositionForm(defaultContactPositionForm());
    setFormError('');
  };

  const openContactPositionEdit = (position: SupportContactPosition) => {
    setFormMode('EDIT');
    setEditingContactPosition(position);
    setContactPositionForm({
      position_code: String(position.position_code || ''),
      position_name: String(position.position_name || ''),
      description: String(position.description || ''),
      is_active: position.is_active !== false,
    });
    setFormError('');
  };

  const openGroupEdit = (group: SupportServiceGroup) => {
    setFormMode('EDIT');
    setEditingGroup(group);
    setGroupForm({
      customer_id: group.customer_id ? String(group.customer_id) : '',
      group_code: String(group.group_code || ''),
      group_name: String(group.group_name || ''),
      description: String(group.description || ''),
      workflow_status_catalog_id: group.workflow_status_catalog_id ? String(group.workflow_status_catalog_id) : '',
      workflow_form_key: String(group.workflow_form_key || ''),
      is_active: group.is_active !== false,
    });
    setFormError('');
  };

  const openStatusAdd = () => {
    setFormMode('ADD');
    setEditingStatus(null);
    setStatusForm(defaultStatusForm(nextStatusSortOrder));
    setFormError('');
  };

  const openStatusEdit = (status: SupportRequestStatusOption) => {
    setFormMode('EDIT');
    setEditingStatus(status);
    setStatusForm({
      status_code: String(status.status_code || ''),
      status_name: String(status.status_name || ''),
      description: String(status.description || ''),
      requires_completion_dates: status.requires_completion_dates !== false,
      is_terminal: status.is_terminal === true,
      is_transfer_dev: status.is_transfer_dev === true,
      is_active: status.is_active !== false,
      sort_order: Number.isFinite(Number(status.sort_order)) ? Number(status.sort_order) : 0,
    });
    setFormError('');
  };

  const openProjectTypeAdd = () => {
    setFormMode('ADD');
    setEditingProjectType(null);
    setProjectTypeForm(defaultProjectTypeForm(nextProjectTypeSortOrder));
    setFormError('');
  };

  const openProjectTypeEdit = (item: ProjectTypeOption) => {
    setFormMode('EDIT');
    setEditingProjectType(item);
    setProjectTypeForm({
      type_code: String(item.type_code || ''),
      type_name: String(item.type_name || ''),
      description: String(item.description || ''),
      is_active: item.is_active !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
    });
    setFormError('');
  };

  const openWorklogActivityTypeAdd = () => {
    setFormMode('ADD');
    setEditingWorklogActivityType(null);
    setWorklogActivityTypeForm(defaultWorklogActivityTypeForm(nextWorklogActivityTypeSortOrder));
    setFormError('');
  };

  const openWorklogActivityTypeEdit = (item: WorklogActivityTypeOption) => {
    setFormMode('EDIT');
    setEditingWorklogActivityType(item);
    setWorklogActivityTypeForm({
      code: String(item.code || ''),
      name: String(item.name || ''),
      description: String(item.description || ''),
      default_is_billable: item.default_is_billable !== false,
      phase_hint: String(item.phase_hint || ''),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      is_active: item.is_active !== false,
    });
    setFormError('');
  };

  const openSupportSlaConfigAdd = () => {
    setFormMode('ADD');
    setEditingSupportSlaConfig(null);
    setSupportSlaConfigForm(defaultSupportSlaConfigForm(nextSupportSlaConfigSortOrder));
    setFormError('');
  };

  const openSupportSlaConfigEdit = (item: SupportSlaConfigOption) => {
    setFormMode('EDIT');
    setEditingSupportSlaConfig(item);
    setSupportSlaConfigForm({
      status: String(item.status || ''),
      sub_status: String(item.sub_status || ''),
      priority: String(item.priority || 'MEDIUM') as SupportSlaConfigFormState['priority'],
      sla_hours: Number.isFinite(Number(item.sla_hours)) ? Number(item.sla_hours) : 0,
      request_type_prefix: String(item.request_type_prefix || ''),
      service_group_id: item.service_group_id === null || item.service_group_id === undefined ? '' : String(item.service_group_id),
      workflow_action_code: String(item.workflow_action_code || ''),
      description: String(item.description || ''),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      is_active: item.is_active !== false,
    });
    setFormError('');
  };

  const openWorkflowStatusCatalogAdd = () => {
    setFormMode('ADD');
    setEditingWorkflowStatusCatalog(null);
    setWorkflowStatusCatalogForm(defaultWorkflowStatusCatalogForm(nextWorkflowStatusCatalogSortOrder));
    setFormError('');
  };

  const openWorkflowStatusCatalogEdit = (item: WorkflowStatusCatalog) => {
    setFormMode('EDIT');
    setEditingWorkflowStatusCatalog(item);
    setWorkflowStatusCatalogForm({
      level: Number(item.level || 1),
      status_code: String(item.status_code || ''),
      status_name: String(item.status_name || ''),
      parent_id: item.parent_id === null || item.parent_id === undefined ? '' : String(item.parent_id),
      canonical_status: String(item.canonical_status || ''),
      canonical_sub_status: String(item.canonical_sub_status || ''),
      flow_step: String(item.flow_step || ''),
      form_key: String(item.form_key || ''),
      is_leaf: item.is_leaf !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      is_active: item.is_active !== false,
    });
    setFormError('');
  };

  const openWorkflowStatusTransitionAdd = () => {
    setFormMode('ADD');
    setEditingWorkflowStatusTransition(null);
    setWorkflowStatusTransitionForm(defaultWorkflowStatusTransitionForm(nextWorkflowStatusTransitionSortOrder));
    setFormError('');
  };

  const openWorkflowStatusTransitionEdit = (item: WorkflowStatusTransition) => {
    setFormMode('EDIT');
    setEditingWorkflowStatusTransition(item);
    setWorkflowStatusTransitionForm({
      from_status_catalog_id: String(item.from_status_catalog_id || ''),
      to_status_catalog_id: String(item.to_status_catalog_id || ''),
      action_code: String(item.action_code || ''),
      action_name: String(item.action_name || ''),
      required_role: String(item.required_role || ''),
      condition_json_text: item.condition_json ? JSON.stringify(item.condition_json, null, 2) : '',
      notify_targets_text: Array.isArray(item.notify_targets_json) ? item.notify_targets_json.join(', ') : '',
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      is_active: item.is_active !== false,
    });
    setFormError('');
  };

  const openWorkflowFormFieldConfigAdd = () => {
    setFormMode('ADD');
    setEditingWorkflowFormFieldConfig(null);
    setWorkflowFormFieldConfigForm(defaultWorkflowFormFieldConfigForm(nextWorkflowFormFieldConfigSortOrder));
    setFormError('');
  };

  const openWorkflowFormFieldConfigEdit = (item: WorkflowFormFieldConfig) => {
    setFormMode('EDIT');
    setEditingWorkflowFormFieldConfig(item);
    setWorkflowFormFieldConfigForm({
      status_catalog_id: String(item.status_catalog_id || ''),
      field_key: String(item.field_key || ''),
      field_label: String(item.field_label || ''),
      field_type: String(item.field_type || 'text'),
      required: item.required === true,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
      excel_column: String(item.excel_column || ''),
      options_json_text: item.options_json ? JSON.stringify(item.options_json, null, 2) : '',
      is_active: item.is_active !== false,
    });
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    setIsSubmitting(true);

    try {
      if (masterType === 'group') {
        if (customerSelectDisabled) {
          setFormError(customerSelectError || 'Không thể chọn khách hàng ở thời điểm hiện tại.');
          setIsSubmitting(false);
          return;
        }

        if (!groupForm.customer_id) {
          setFormError('Khách hàng là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!groupForm.group_name.trim()) {
          setFormError('Tên nhóm là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<SupportServiceGroup> = {
          customer_id: groupForm.customer_id,
          group_code: groupForm.group_code.trim() || null,
          group_name: groupForm.group_name.trim(),
          description: groupForm.description.trim() || null,
          workflow_status_catalog_id: groupForm.workflow_status_catalog_id || null,
          workflow_form_key: groupForm.workflow_form_key.trim() || null,
          is_active: groupForm.is_active,
        };

        if (formMode === 'ADD') {
          await onCreateSupportServiceGroup(payload);
        } else if (formMode === 'EDIT' && editingGroup) {
          await onUpdateSupportServiceGroup(editingGroup.id, payload);
        }
      } else if (masterType === 'contact_position') {
        const positionCode = normalizeContactPositionCodeInput(contactPositionForm.position_code);
        if (!positionCode) {
          setFormError('Mã chức vụ là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!contactPositionForm.position_name.trim()) {
          setFormError('Tên chức vụ là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<SupportContactPosition> = {
          position_code: positionCode,
          position_name: contactPositionForm.position_name.trim(),
          description: contactPositionForm.description.trim() || null,
          is_active: contactPositionForm.is_active,
        };

        if (formMode === 'ADD') {
          await onCreateSupportContactPosition(payload);
        } else if (formMode === 'EDIT' && editingContactPosition) {
          await onUpdateSupportContactPosition(editingContactPosition.id, payload);
        }
      } else if (masterType === 'status') {
        const statusCode = normalizeStatusCodeInput(statusForm.status_code);
        if (!statusCode) {
          setFormError('Mã trạng thái là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!statusForm.status_name.trim()) {
          setFormError('Tên trạng thái là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<SupportRequestStatusOption> = {
          status_code: statusCode,
          status_name: statusForm.status_name.trim(),
          description: statusForm.description.trim() || null,
          requires_completion_dates: statusForm.requires_completion_dates,
          is_terminal: statusForm.is_terminal,
          is_transfer_dev: statusForm.is_transfer_dev,
          is_active: statusForm.is_active,
          sort_order: Math.max(0, Number(statusForm.sort_order || 0)),
        };

        if (formMode === 'ADD') {
          await onCreateSupportRequestStatus(payload);
        } else if (formMode === 'EDIT' && editingStatus) {
          if (editingStatus.id === null || editingStatus.id === undefined) {
            setFormError('Trạng thái này chưa có bản ghi DB, không thể cập nhật trực tiếp.');
            setIsSubmitting(false);
            return;
          }

          await onUpdateSupportRequestStatus(editingStatus.id, payload);
        }
      } else if (masterType === 'project_type') {
        const typeCode = normalizeProjectTypeCodeInput(projectTypeForm.type_code);
        if (!typeCode) {
          setFormError('Mã loại dự án là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!projectTypeForm.type_name.trim()) {
          setFormError('Tên loại dự án là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<ProjectTypeOption> = {
          type_code: typeCode,
          type_name: projectTypeForm.type_name.trim(),
          description: projectTypeForm.description.trim() || null,
          is_active: projectTypeForm.is_active,
          sort_order: Math.max(0, Number(projectTypeForm.sort_order || 0)),
        };

        if (formMode === 'ADD') {
          await onCreateProjectType(payload);
        } else if (formMode === 'EDIT' && editingProjectType) {
          if (editingProjectType.id === null || editingProjectType.id === undefined) {
            setFormError('Loại dự án này chưa có bản ghi DB, không thể cập nhật trực tiếp.');
            setIsSubmitting(false);
            return;
          }

          await onUpdateProjectType(editingProjectType.id, payload);
        }
      } else if (masterType === 'worklog_activity_type') {
        const code = normalizeMasterCodeInput(worklogActivityTypeForm.code);
        if (!code) {
          setFormError('Mã loại công việc là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!worklogActivityTypeForm.name.trim()) {
          setFormError('Tên loại công việc là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<WorklogActivityTypeOption> = {
          code,
          name: worklogActivityTypeForm.name.trim(),
          description: worklogActivityTypeForm.description.trim() || null,
          default_is_billable: worklogActivityTypeForm.default_is_billable,
          phase_hint: normalizeMasterCodeInput(worklogActivityTypeForm.phase_hint) || null,
          sort_order: Math.max(0, Number(worklogActivityTypeForm.sort_order || 0)),
          is_active: worklogActivityTypeForm.is_active,
        };

        if (formMode === 'ADD') {
          await onCreateWorklogActivityType(payload);
        } else if (formMode === 'EDIT' && editingWorklogActivityType) {
          await onUpdateWorklogActivityType(editingWorklogActivityType.id, payload);
        }
      } else if (masterType === 'sla_config') {
        const statusCode = normalizeMasterCodeInput(supportSlaConfigForm.status);
        if (!statusCode) {
          setFormError('Trạng thái là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const hours = Number(supportSlaConfigForm.sla_hours);
        if (!Number.isFinite(hours) || hours < 0) {
          setFormError('SLA (giờ) phải là số lớn hơn hoặc bằng 0.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<SupportSlaConfigOption> = {
          status: statusCode,
          sub_status: normalizeMasterCodeInput(supportSlaConfigForm.sub_status) || null,
          priority: supportSlaConfigForm.priority,
          sla_hours: hours,
          request_type_prefix: normalizeMasterCodeInput(supportSlaConfigForm.request_type_prefix) || null,
          service_group_id: supportSlaConfigForm.service_group_id || null,
          workflow_action_code: normalizeMasterCodeInput(supportSlaConfigForm.workflow_action_code) || null,
          description: supportSlaConfigForm.description.trim() || null,
          sort_order: Math.max(0, Number(supportSlaConfigForm.sort_order || 0)),
          is_active: supportSlaConfigForm.is_active,
        };

        if (formMode === 'ADD') {
          await onCreateSupportSlaConfig(payload);
        } else if (formMode === 'EDIT' && editingSupportSlaConfig) {
          await onUpdateSupportSlaConfig(editingSupportSlaConfig.id, payload);
        }
      } else if (masterType === 'workflow_status_catalog') {
        const statusCode = normalizeMasterCodeInput(workflowStatusCatalogForm.status_code);
        if (!statusCode) {
          setFormError('Mã trạng thái workflow là bắt buộc.');
          setIsSubmitting(false);
          return;
        }
        if (!workflowStatusCatalogForm.status_name.trim()) {
          setFormError('Tên trạng thái workflow là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const level = Math.max(1, Math.min(3, Number(workflowStatusCatalogForm.level || 1)));
        const parentId = workflowStatusCatalogForm.parent_id
          ? Number(workflowStatusCatalogForm.parent_id)
          : null;

        const payload: Partial<WorkflowStatusCatalog> = {
          level,
          status_code: statusCode,
          status_name: workflowStatusCatalogForm.status_name.trim(),
          parent_id: parentId,
          canonical_status: normalizeMasterCodeInput(workflowStatusCatalogForm.canonical_status) || null,
          canonical_sub_status: normalizeMasterCodeInput(workflowStatusCatalogForm.canonical_sub_status) || null,
          flow_step: normalizeMasterCodeInput(workflowStatusCatalogForm.flow_step) || null,
          form_key: workflowStatusCatalogForm.form_key.trim() || null,
          is_leaf: workflowStatusCatalogForm.is_leaf,
          sort_order: Math.max(0, Number(workflowStatusCatalogForm.sort_order || 0)),
          is_active: workflowStatusCatalogForm.is_active,
        };

        if (formMode === 'ADD') {
          await createWorkflowStatusCatalog(payload);
        } else if (formMode === 'EDIT' && editingWorkflowStatusCatalog) {
          await updateWorkflowStatusCatalog(editingWorkflowStatusCatalog.id, payload);
        }

        await loadWorkflowConfigs();
      } else if (masterType === 'workflow_status_transition') {
        const fromStatusCatalogId = Number(workflowStatusTransitionForm.from_status_catalog_id || 0);
        const toStatusCatalogId = Number(workflowStatusTransitionForm.to_status_catalog_id || 0);
        const actionCode = normalizeMasterCodeInput(workflowStatusTransitionForm.action_code);
        const actionName = workflowStatusTransitionForm.action_name.trim();

        if (!Number.isFinite(fromStatusCatalogId) || fromStatusCatalogId <= 0) {
          setFormError('Vui lòng chọn trạng thái nguồn.');
          setIsSubmitting(false);
          return;
        }
        if (!Number.isFinite(toStatusCatalogId) || toStatusCatalogId <= 0) {
          setFormError('Vui lòng chọn trạng thái đích.');
          setIsSubmitting(false);
          return;
        }
        if (fromStatusCatalogId === toStatusCatalogId) {
          setFormError('Trạng thái nguồn và đích không được trùng nhau.');
          setIsSubmitting(false);
          return;
        }
        if (!actionCode) {
          setFormError('action_code là bắt buộc.');
          setIsSubmitting(false);
          return;
        }
        if (!actionName) {
          setFormError('Tên hành động là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        let conditionJson: Record<string, unknown> | null = null;
        if (workflowStatusTransitionForm.condition_json_text.trim() !== '') {
          try {
            const parsed = JSON.parse(workflowStatusTransitionForm.condition_json_text);
            if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
              throw new Error('condition_json phải là object JSON.');
            }
            conditionJson = parsed as Record<string, unknown>;
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'condition_json không hợp lệ.');
            setIsSubmitting(false);
            return;
          }
        }

        const notifyTargets = workflowStatusTransitionForm.notify_targets_text
          .split(',')
          .map((item) => normalizeMasterCodeInput(item))
          .filter((item) => item !== '');

        const payload: Partial<WorkflowStatusTransition> = {
          from_status_catalog_id: fromStatusCatalogId,
          to_status_catalog_id: toStatusCatalogId,
          action_code: actionCode,
          action_name: actionName,
          required_role: normalizeMasterCodeInput(workflowStatusTransitionForm.required_role) || null,
          condition_json: conditionJson,
          notify_targets_json: notifyTargets.length > 0 ? notifyTargets : null,
          sort_order: Math.max(0, Number(workflowStatusTransitionForm.sort_order || 0)),
          is_active: workflowStatusTransitionForm.is_active,
        };

        if (formMode === 'ADD') {
          await createWorkflowStatusTransition(payload);
        } else if (formMode === 'EDIT' && editingWorkflowStatusTransition) {
          await updateWorkflowStatusTransition(editingWorkflowStatusTransition.id, payload);
        }

        await loadWorkflowConfigs();
      } else if (masterType === 'workflow_form_field_config') {
        const statusCatalogId = Number(workflowFormFieldConfigForm.status_catalog_id || 0);
        if (!Number.isFinite(statusCatalogId) || statusCatalogId <= 0) {
          setFormError('Vui lòng chọn trạng thái workflow (leaf).');
          setIsSubmitting(false);
          return;
        }
        const fieldKey = normalizeMasterCodeInput(workflowFormFieldConfigForm.field_key);
        if (!fieldKey) {
          setFormError('field_key là bắt buộc.');
          setIsSubmitting(false);
          return;
        }
        if (!workflowFormFieldConfigForm.field_label.trim()) {
          setFormError('field_label là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        let optionsJson: Array<{ value: string; label: string }> | null = null;
        const optionsText = workflowFormFieldConfigForm.options_json_text.trim();
        if (optionsText !== '') {
          try {
            const parsed = JSON.parse(optionsText);
            if (!Array.isArray(parsed)) {
              throw new Error('options_json phải là mảng.');
            }
            optionsJson = parsed
              .map((item) => ({
                value: String((item as Record<string, unknown>).value ?? '').trim(),
                label: String((item as Record<string, unknown>).label ?? '').trim(),
              }))
              .filter((item) => item.value !== '' && item.label !== '');
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'options_json không hợp lệ.');
            setIsSubmitting(false);
            return;
          }
        }

        const payload: Partial<WorkflowFormFieldConfig> = {
          status_catalog_id: statusCatalogId,
          field_key: fieldKey,
          field_label: workflowFormFieldConfigForm.field_label.trim(),
          field_type: workflowFormFieldConfigForm.field_type.trim().toLowerCase() || 'text',
          required: workflowFormFieldConfigForm.required,
          sort_order: Math.max(0, Number(workflowFormFieldConfigForm.sort_order || 0)),
          excel_column: normalizeMasterCodeInput(workflowFormFieldConfigForm.excel_column) || null,
          options_json: optionsJson,
          is_active: workflowFormFieldConfigForm.is_active,
        };

        if (formMode === 'ADD') {
          await createWorkflowFormFieldConfig(payload);
        } else if (formMode === 'EDIT' && editingWorkflowFormFieldConfig) {
          await updateWorkflowFormFieldConfig(editingWorkflowFormFieldConfig.id, payload);
        }

        await loadWorkflowConfigs();
      }

      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu danh mục.');
      setIsSubmitting(false);
    }
  };

  const statusCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(
          editingStatus?.is_code_editable ??
            ((editingStatus?.used_in_requests ?? 0) + (editingStatus?.used_in_history ?? 0) === 0)
        );

  const contactPositionCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(
          editingContactPosition?.is_code_editable ??
            Number(editingContactPosition?.used_in_customer_personnel ?? 0) === 0
        );

  const projectTypeCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(
          editingProjectType?.is_code_editable ??
            Number(editingProjectType?.used_in_projects ?? 0) === 0
        );

  const worklogActivityTypeCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(
          editingWorklogActivityType?.is_code_editable ??
            Number(editingWorklogActivityType?.used_in_worklogs ?? 0) === 0
        );

  const supportSlaStatusEditable = formMode === 'ADD' ? true : Boolean(editingSupportSlaConfig?.is_status_editable ?? false);

  return (
    <div
      className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl"
      style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}
    >
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý danh mục hỗ trợ</h2>
          <p className="text-slate-600 text-sm mt-1">
            Quản trị Nhóm Zalo/Tele, Chức vụ liên hệ, trạng thái hỗ trợ, workflow trạng thái/field schema, SLA và giai đoạn cơ hội.
          </p>
        </div>
        <button
          type="button"
          disabled={!canWriteCurrentMaster}
          onClick={() => {
            if (masterType === 'group') {
              openGroupAdd();
              return;
            }
            if (masterType === 'contact_position') {
              openContactPositionAdd();
              return;
            }
            if (masterType === 'status') {
              openStatusAdd();
              return;
            }
            if (masterType === 'project_type') {
              openProjectTypeAdd();
              return;
            }
            if (masterType === 'worklog_activity_type') {
              openWorklogActivityTypeAdd();
              return;
            }
            if (masterType === 'sla_config') {
              openSupportSlaConfigAdd();
              return;
            }
            if (masterType === 'workflow_status_catalog') {
              openWorkflowStatusCatalogAdd();
              return;
            }
            if (masterType === 'workflow_status_transition') {
              openWorkflowStatusTransitionAdd();
              return;
            }
            openWorkflowFormFieldConfigAdd();
          }}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Thêm mới</span>
        </button>
      </header>

      <div className="bg-white/95 p-4 md:p-5 rounded-xl border border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchableSelect
            value={masterType}
            onChange={(value) => setMasterType(value as MasterType)}
            options={masterOptions}
            placeholder="Chọn danh mục"
          />

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <SearchableSelect
            value={activityFilter}
            onChange={(value) => setActivityFilter(value as ActivityFilter)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Hoạt động' },
              { value: 'inactive', label: 'Ngưng hoạt động' },
            ]}
            placeholder="Lọc hoạt động"
          />
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          {masterType === 'group' ? (
            <table className="w-full min-w-[1320px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Khách hàng</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Workflow mặc định</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Form key</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedGroups.map((item) => (
                  <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                    <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.group_code || '--'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.group_name || '--'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {[item.customer_code, item.customer_name].filter((part) => String(part || '').trim() !== '').join(' - ') || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.workflow_status_name || '--'}</td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {item.workflow_form_key || item.workflow_status_form_key || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                      {Number(item.used_in_customer_requests || 0)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={!canWriteServiceGroups}
                        onClick={() => openGroupEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Cập nhật"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {pagedGroups.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu nhóm phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'contact_position' ? (
            <table className="w-full min-w-[920px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã chức vụ</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên chức vụ</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedContactPositions.map((item) => {
                  const canEditRow = canWriteContactPositions && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-800">{item.position_code || '--'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">{item.position_name || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                      <td className="px-6 py-4 text-center text-sm text-slate-600">{Number(item.used_in_customer_personnel || 0)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openContactPositionEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedContactPositions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu chức vụ phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'status' ? (
            <table className="w-full min-w-[1240px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bắt buộc hạn</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Chuyển Dev</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Kết thúc</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedStatuses.map((item) => {
                  const usedInRequests = Number(item.used_in_requests || 0);
                  const usedInHistory = Number(item.used_in_history || 0);
                  const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;

                  return (
                    <tr key={String(item.id ?? item.status_code)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status_code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">
                        {item.requires_completion_dates !== false ? 'Có' : 'Không'}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_transfer_dev === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_terminal === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">
                        {usedInRequests} / {usedInHistory}
                      </td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openStatusEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật trạng thái chưa đồng bộ DB'}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedStatuses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu trạng thái phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
	          ) : masterType === 'project_type' ? (
            <table className="w-full min-w-[1040px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên loại dự án</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedProjectTypes.map((item) => {
                  const canEditRow = canWriteProjectTypes && item.id !== null && item.id !== undefined;
                  const usedInProjects = Number(item.used_in_projects || 0);
                  return (
                    <tr key={String(item.id ?? item.type_code)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.type_code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.type_name || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{usedInProjects}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openProjectTypeEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật loại dự án chưa đồng bộ DB'}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedProjectTypes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Không có loại dự án phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'worklog_activity_type' ? (
            <table className="w-full min-w-[1240px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên loại công việc</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Phase hint</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Mặc định tính phí</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedWorklogActivityTypes.map((item) => {
                  const canEditRow = canWriteWorklogActivityTypes && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id ?? item.code)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.name || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.phase_hint || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.default_is_billable !== false ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.used_in_worklogs || 0)}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openWorklogActivityTypeEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedWorklogActivityTypes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu loại công việc phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'sla_config' ? (
            <table className="w-full min-w-[1320px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái phụ</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ưu tiên</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">SLA (giờ)</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Prefix</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nhóm hỗ trợ</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Action</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedSupportSlaConfigs.map((item) => {
                  const canEditRow = canWriteSlaConfigs && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.sub_status || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.priority || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sla_hours ?? 0)}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.request_type_prefix || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.service_group_name || '--'}</td>
                      <td className="px-4 py-4 text-sm font-mono text-slate-700">{item.workflow_action_code || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openSupportSlaConfigEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedSupportSlaConfigs.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu cấu hình SLA phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'workflow_status_catalog' ? (
            <table className="w-full min-w-[1480px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Cấp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái cha</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Canonical status</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Canonical sub_status</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Flow/Form</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Leaf</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isWorkflowConfigLoading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                      Đang tải cấu hình workflow...
                    </td>
                  </tr>
                ) : null}
                {pagedWorkflowStatusCatalogs.map((item) => {
                  const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-center text-sm text-slate-700">{Number(item.level || 0)}</td>
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.status_code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.parent_name || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.canonical_status || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.canonical_sub_status || '--'}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">
                        <div>{item.flow_step || '--'}</div>
                        <div className="text-[11px] text-slate-500">{item.form_key || '--'}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_leaf !== false ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openWorkflowStatusCatalogEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!isWorkflowConfigLoading && pagedWorkflowStatusCatalogs.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu cấu hình trạng thái workflow phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : masterType === 'workflow_status_transition' ? (
            <table className="w-full min-w-[1480px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái nguồn</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái đích</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Action</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Vai trò</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Notify targets</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isWorkflowConfigLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Đang tải cấu hình transition workflow...
                    </td>
                  </tr>
                ) : null}
                {pagedWorkflowStatusTransitions.map((item) => {
                  const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm text-slate-700">{item.from_status_name || `#${String(item.from_status_catalog_id || '--')}`}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.to_status_name || `#${String(item.to_status_catalog_id || '--')}`}</td>
                      <td className="px-4 py-4 text-xs text-slate-600">
                        <div className="font-mono font-semibold text-slate-800">{item.action_code || '--'}</div>
                        <div>{item.action_name || '--'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.required_role || 'ANY'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {Array.isArray(item.notify_targets_json) && item.notify_targets_json.length > 0
                          ? item.notify_targets_json.join(', ')
                          : '--'}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openWorkflowStatusTransitionEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!isWorkflowConfigLoading && pagedWorkflowStatusTransitions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu transition workflow phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1380px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái workflow</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field key</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field label</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Field type</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Bắt buộc</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Excel cột</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isWorkflowConfigLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Đang tải schema field workflow...
                    </td>
                  </tr>
                ) : null}
                {pagedWorkflowFormFieldConfigs.map((item) => {
                  const canEditRow = canWriteStatuses && item.id !== null && item.id !== undefined;
                  return (
                    <tr key={String(item.id)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm text-slate-700">{item.status_name || `#${String(item.status_catalog_id || '--')}`}</td>
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.field_key || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.field_label || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.field_type || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.required === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm font-mono text-slate-600">{item.excel_column || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.is_active !== false ? 'Hoạt động' : 'Ngưng hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={!canEditRow}
                          onClick={() => openWorkflowFormFieldConfigEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cập nhật"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!isWorkflowConfigLoading && pagedWorkflowFormFieldConfigs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu schema field workflow phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* ── Lịch làm việc — calendar grid ─────────────────────────────── */}
          {masterType === 'work_calendar' && (
            <div className="p-4">
              {/* Toolbar: chọn năm / tháng + nút generate */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">Năm:</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={calYear}
                    onChange={(e) => { setCalYear(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-24 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">Tháng:</label>
                  <select
                    value={calMonth}
                    onChange={(e) => { setCalMonth(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>

                {canWriteWorkCalendar && (
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm font-semibold text-slate-600">Tạo lịch năm:</label>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={calGenYear}
                      onChange={(e) => setCalGenYear(Number(e.target.value))}
                      className="w-24 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                    <button
                      type="button"
                      disabled={calGenLoading}
                      onClick={async () => {
                        setCalGenLoading(true);
                        setCalGenMsg('');
                        try {
                          const result = await generateCalendarYear(calGenYear, { overwrite: false });
                          setCalGenMsg(`✓ Đã tạo ${result.inserted} ngày, bỏ qua ${result.skipped} ngày có sẵn.`);
                          if (calGenYear === calYear) {
                            const rows = await fetchMonthlyCalendars({ year: calYear, month: calMonth });
                            setCalDays(rows || []);
                          }
                        } catch (err: unknown) {
                          setCalGenMsg(`✗ ${err instanceof Error ? err.message : 'Lỗi tạo lịch'}`);
                        } finally {
                          setCalGenLoading(false);
                        }
                      }}
                      className="flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-deep-teal text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {calGenLoading
                        ? <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                        : <span className="material-symbols-outlined text-base">event</span>}
                      Tạo lịch
                    </button>
                  </div>
                )}
              </div>

              {calGenMsg && (
                <p className={`text-sm mb-3 px-3 py-2 rounded-lg border ${calGenMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {calGenMsg}
                </p>
              )}

              {calLoading && (
                <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
                  <span className="text-sm">Đang tải lịch...</span>
                </div>
              )}

              {calError && !calLoading && (
                <div className="flex flex-col items-center py-12 text-red-600 gap-2">
                  <span className="material-symbols-outlined text-3xl">error</span>
                  <p className="text-sm">{calError}</p>
                </div>
              )}

              {!calLoading && !calError && calDays.length === 0 && (
                <div className="flex flex-col items-center py-16 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-4xl text-slate-300">calendar_month</span>
                  <p className="text-sm">Chưa có dữ liệu lịch tháng {calMonth}/{calYear}.</p>
                  {canWriteWorkCalendar && (
                    <p className="text-xs text-slate-400">Dùng nút "Tạo lịch" ở trên để khởi tạo.</p>
                  )}
                </div>
              )}

              {!calLoading && !calError && calDays.length > 0 && (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full min-w-[820px] border-separate border-spacing-0">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
                          <th key={d} className="px-2 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[14.28%]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sorted = [...calDays].sort((a, b) => a.date.localeCompare(b.date));
                        if (sorted.length === 0) return null;

                        const firstDay = sorted[0];
                        const startCol = (firstDay.day_of_week ?? 1) - 1;

                        const cells: (WorkCalendarDay | null)[] = [
                          ...Array<null>(startCol).fill(null),
                          ...sorted,
                        ];

                        const weeks: (WorkCalendarDay | null)[][] = [];
                        for (let i = 0; i < cells.length; i += 7) {
                          const week = cells.slice(i, i + 7);
                          while (week.length < 7) week.push(null);
                          weeks.push(week);
                        }

                        const todayStr = new Date().toISOString().slice(0, 10);

                        return weeks.map((week, wi) => (
                          <tr key={wi} className="border-b border-slate-100 last:border-0">
                            {week.map((dayItem, di) => {
                              if (!dayItem) {
                                return <td key={di} className="px-2 py-2 h-16 align-top bg-slate-50/50" />;
                              }

                              const isEditing = editingCalDay?.date === dayItem.date;
                              const isToday   = dayItem.date === todayStr;

                              const cellBg = isEditing
                                ? 'bg-primary/5 ring-2 ring-inset ring-primary/30'
                                : dayItem.is_holiday
                                  ? 'bg-red-50'
                                  : dayItem.is_weekend
                                    ? 'bg-amber-50/60'
                                    : dayItem.is_working_day
                                      ? 'bg-white'
                                      : 'bg-slate-100';

                              return (
                                <td
                                  key={di}
                                  className={`px-2 py-1.5 h-20 align-top border border-slate-100 ${canWriteWorkCalendar ? 'cursor-pointer hover:bg-primary/5' : ''} transition-colors ${cellBg}`}
                                  onClick={() => {
                                    if (!canWriteWorkCalendar) return;
                                    if (isEditing) {
                                      setEditingCalDay(null);
                                      setCalDayForm(defaultWorkCalendarDayForm());
                                    } else {
                                      setEditingCalDay(dayItem);
                                      setCalDayForm({
                                        is_working_day: dayItem.is_working_day ?? !dayItem.is_weekend,
                                        is_holiday:     dayItem.is_holiday     ?? false,
                                        holiday_name:   dayItem.holiday_name   ?? '',
                                        note:           dayItem.note           ?? '',
                                      });
                                    }
                                  }}
                                  title={canWriteWorkCalendar ? 'Click để chỉnh sửa' : undefined}
                                >
                                  <div className="flex items-start justify-between mb-0.5">
                                    <span className={`text-sm font-bold leading-none ${isToday ? 'text-primary underline' : di === 0 ? 'text-amber-600' : di === 6 ? 'text-amber-600' : 'text-slate-700'}`}>
                                      {dayItem.day}
                                    </span>
                                    <div className="flex gap-0.5">
                                      {dayItem.is_holiday && (
                                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" title="Ngày lễ" />
                                      )}
                                      {!dayItem.is_working_day && !dayItem.is_holiday && !dayItem.is_weekend && (
                                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" title="Nghỉ" />
                                      )}
                                    </div>
                                  </div>
                                  {dayItem.holiday_name && (
                                    <p className="text-[10px] text-red-600 font-medium leading-tight truncate">{dayItem.holiday_name}</p>
                                  )}
                                  {dayItem.note && (
                                    <p className="text-[10px] text-slate-500 leading-tight truncate">{dayItem.note}</p>
                                  )}
                                  {!dayItem.is_working_day && !dayItem.is_weekend && !dayItem.is_holiday && (
                                    <p className="text-[10px] text-slate-400 leading-tight">Nghỉ</p>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              {!calLoading && calDays.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />Ngày làm việc</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />Cuối tuần</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" />Ngày lễ</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" />Ngày nghỉ khác</span>
                </div>
              )}
            </div>
          )}
        </div>

        <PaginationControls
          currentPage={safePage}
          totalItems={totalItems}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45" onClick={closeForm}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <h3 className="text-lg font-bold text-slate-900">
	                {masterType === 'group'
                  ? formMode === 'ADD'
                    ? 'Thêm nhóm Zalo/Tele'
                    : 'Cập nhật nhóm Zalo/Tele'
                  : masterType === 'contact_position'
                    ? formMode === 'ADD'
                      ? 'Thêm chức vụ liên hệ'
                      : 'Cập nhật chức vụ liên hệ'
	                  : masterType === 'status'
	                    ? formMode === 'ADD'
	                      ? 'Thêm trạng thái hỗ trợ'
	                      : 'Cập nhật trạng thái hỗ trợ'
                    : masterType === 'project_type'
                      ? formMode === 'ADD'
                        ? 'Thêm loại dự án'
                        : 'Cập nhật loại dự án'
                    : masterType === 'worklog_activity_type'
                      ? formMode === 'ADD'
                        ? 'Thêm loại công việc worklog'
                        : 'Cập nhật loại công việc worklog'
                    : masterType === 'sla_config'
                      ? formMode === 'ADD'
                        ? 'Thêm cấu hình SLA hỗ trợ'
                        : 'Cập nhật cấu hình SLA hỗ trợ'
                    : masterType === 'workflow_status_catalog'
                      ? formMode === 'ADD'
                        ? 'Thêm trạng thái workflow phân cấp'
                        : 'Cập nhật trạng thái workflow phân cấp'
                    : masterType === 'workflow_status_transition'
                      ? formMode === 'ADD'
                        ? 'Thêm transition workflow'
                        : 'Cập nhật transition workflow'
                      : formMode === 'ADD'
                        ? 'Thêm schema field workflow'
                        : 'Cập nhật schema field workflow'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {masterType === 'group' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Khách hàng <span className="text-red-500">*</span>
                      </label>
                      <SearchableSelect
                        value={groupForm.customer_id}
                        onChange={(value) => setGroupForm((prev) => ({ ...prev, customer_id: value }))}
                        options={customerOptions}
                        placeholder="Chọn khách hàng"
                        searchPlaceholder="Tìm khách hàng..."
                        noOptionsText="Không tìm thấy khách hàng"
                        disabled={customerSelectDisabled}
                        error={customerSelectError}
                        usePortal
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Mã nhóm</label>
                      <input
                        value={groupForm.group_code}
                        onChange={(event) =>
                          setGroupForm((prev) => ({
                            ...prev,
                            group_code: normalizeGroupCodeInput(event.target.value),
                          }))
                        }
                        placeholder="VD: HIS_L2"
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                      />
                      <p className="text-xs text-slate-500">Để trống hệ thống tự sinh theo Tên nhóm.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Tên nhóm <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={groupForm.group_name}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, group_name: event.target.value }))}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Workflow mặc định</label>
                      <SearchableSelect
                        value={groupForm.workflow_status_catalog_id}
                        onChange={(value) =>
                          setGroupForm((prev) => ({
                            ...prev,
                            workflow_status_catalog_id: value,
                          }))
                        }
                        options={workflowStatusCatalogOptions}
                        placeholder="Chọn workflow mặc định"
                        searchPlaceholder="Tìm workflow..."
                        noOptionsText="Không tìm thấy workflow"
                        usePortal
                      />
                      <p className="text-xs text-slate-500">
                        Dùng để bind danh mục hỗ trợ với trạng thái workflow khởi đầu ở Phase 5 runtime.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Form key override</label>
                      <SearchableSelect
                        value={groupForm.workflow_form_key}
                        onChange={(value) =>
                          setGroupForm((prev) => ({
                            ...prev,
                            workflow_form_key: value,
                          }))
                        }
                        options={workflowFormKeyOptions}
                        placeholder="Chọn form key"
                        searchPlaceholder="Tìm form key..."
                        noOptionsText="Không tìm thấy form key"
                        usePortal
                      />
                      <p className="text-xs text-slate-500">
                        Để trống để dùng `form_key` mặc định của workflow đã chọn.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={groupForm.description}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={groupForm.is_active}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Hoạt động
                  </label>
                </>
              ) : masterType === 'contact_position' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Mã chức vụ <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={contactPositionForm.position_code}
                        disabled={!contactPositionCodeEditable}
                        onChange={(event) =>
                          setContactPositionForm((prev) => ({
                            ...prev,
                            position_code: normalizeContactPositionCodeInput(event.target.value),
                          }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Tên chức vụ <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={contactPositionForm.position_name}
                        onChange={(event) =>
                          setContactPositionForm((prev) => ({ ...prev, position_name: event.target.value }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  {!contactPositionCodeEditable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Đã phát sinh dữ liệu, không cho đổi mã chức vụ.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={contactPositionForm.description}
                      onChange={(event) =>
                        setContactPositionForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={contactPositionForm.is_active}
                      onChange={(event) =>
                        setContactPositionForm((prev) => ({ ...prev, is_active: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Hoạt động
                  </label>
                </>
              ) : masterType === 'status' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Mã trạng thái <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={statusForm.status_code}
                        disabled={!statusCodeEditable}
                        onChange={(event) =>
                          setStatusForm((prev) => ({
                            ...prev,
                            status_code: normalizeStatusCodeInput(event.target.value),
                          }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Tên trạng thái <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={statusForm.status_name}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, status_name: event.target.value }))}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  {!statusCodeEditable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Đã phát sinh dữ liệu, không cho đổi mã trạng thái.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={statusForm.description}
                      onChange={(event) => setStatusForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.requires_completion_dates}
                        onChange={(event) =>
                          setStatusForm((prev) => ({ ...prev, requires_completion_dates: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Bắt buộc nhập hạn/ngày hoàn thành
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_transfer_dev}
                        onChange={(event) =>
                          setStatusForm((prev) => ({ ...prev, is_transfer_dev: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Chuyển Dev
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_terminal}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, is_terminal: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Trạng thái kết thúc
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusForm.is_active}
                        onChange={(event) => setStatusForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Hoạt động
                    </label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                    <input
                      type="number"
                      min={0}
                      value={statusForm.sort_order}
                      onChange={(event) =>
                        setStatusForm((prev) => ({ ...prev, sort_order: Number(event.target.value || 0) }))
                      }
                      className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </>
	              ) : masterType === 'project_type' ? (
	                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Mã loại dự án <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={projectTypeForm.type_code}
                        disabled={!projectTypeCodeEditable}
                        onChange={(event) =>
                          setProjectTypeForm((prev) => ({
                            ...prev,
                            type_code: normalizeProjectTypeCodeDraftInput(event.target.value),
                          }))
                        }
                        onBlur={() =>
                          setProjectTypeForm((prev) => ({
                            ...prev,
                            type_code: normalizeProjectTypeCodeInput(prev.type_code),
                          }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Tên loại dự án <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={projectTypeForm.type_name}
                        onChange={(event) =>
                          setProjectTypeForm((prev) => ({ ...prev, type_name: event.target.value }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  {!projectTypeCodeEditable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Đã phát sinh dữ liệu, không cho đổi mã.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={projectTypeForm.description}
                      onChange={(event) =>
                        setProjectTypeForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={projectTypeForm.is_active}
                        onChange={(event) =>
                          setProjectTypeForm((prev) => ({ ...prev, is_active: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Hoạt động
                    </label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                    <input
                      type="number"
                      min={0}
                      value={projectTypeForm.sort_order}
                      onChange={(event) =>
                        setProjectTypeForm((prev) => ({
                          ...prev,
                          sort_order: Number(event.target.value || 0),
                        }))
                      }
                      className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
	                </>
                ) : masterType === 'worklog_activity_type' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Mã loại công việc <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={worklogActivityTypeForm.code}
                          disabled={!worklogActivityTypeCodeEditable}
                          onChange={(event) =>
                            setWorklogActivityTypeForm((prev) => ({
                              ...prev,
                              code: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Tên loại công việc <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={worklogActivityTypeForm.name}
                          onChange={(event) =>
                            setWorklogActivityTypeForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    {!worklogActivityTypeCodeEditable && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Đã phát sinh dữ liệu, không cho đổi mã loại công việc.
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Phase hint</label>
                        <SearchableSelect
                          value={worklogActivityTypeForm.phase_hint}
                          onChange={(value) =>
                            setWorklogActivityTypeForm((prev) => ({
                              ...prev,
                              phase_hint: String(value || ''),
                            }))
                          }
                          options={[
                            { value: '', label: 'Không giới hạn' },
                            { value: 'SUPPORT_HANDLE', label: 'SUPPORT_HANDLE' },
                            { value: 'ANALYZE', label: 'ANALYZE' },
                            { value: 'CODE', label: 'CODE' },
                            { value: 'UPCODE', label: 'UPCODE' },
                            { value: 'OTHER', label: 'OTHER' },
                          ]}
                          placeholder="Chọn phase"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                        <input
                          type="number"
                          min={0}
                          value={worklogActivityTypeForm.sort_order}
                          onChange={(event) =>
                            setWorklogActivityTypeForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                      <textarea
                        value={worklogActivityTypeForm.description}
                        onChange={(event) =>
                          setWorklogActivityTypeForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={worklogActivityTypeForm.default_is_billable}
                          onChange={(event) =>
                            setWorklogActivityTypeForm((prev) => ({
                              ...prev,
                              default_is_billable: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Mặc định tính phí
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={worklogActivityTypeForm.is_active}
                          onChange={(event) =>
                            setWorklogActivityTypeForm((prev) => ({ ...prev, is_active: event.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Hoạt động
                      </label>
                    </div>
                  </>
                ) : masterType === 'sla_config' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Trạng thái <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={supportSlaConfigForm.status}
                          disabled={!supportSlaStatusEditable}
                          onChange={(event) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              status: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Trạng thái phụ</label>
                        <input
                          value={supportSlaConfigForm.sub_status}
                          disabled={!supportSlaStatusEditable}
                          onChange={(event) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              sub_status: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                        />
                      </div>
                    </div>
                    {!supportSlaStatusEditable && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Rule này đã phát sinh sử dụng, không cho đổi cặp trạng thái.
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Mức ưu tiên</label>
                        <SearchableSelect
                          value={supportSlaConfigForm.priority}
                          onChange={(value) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              priority: String(value || 'MEDIUM') as SupportSlaConfigFormState['priority'],
                            }))
                          }
                          options={[
                            { value: 'LOW', label: 'LOW' },
                            { value: 'MEDIUM', label: 'MEDIUM' },
                            { value: 'HIGH', label: 'HIGH' },
                            { value: 'URGENT', label: 'URGENT' },
                          ]}
                          placeholder="Chọn mức ưu tiên"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">SLA (giờ)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={supportSlaConfigForm.sla_hours}
                          onChange={(event) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              sla_hours: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Prefix yêu cầu (tùy chọn)</label>
                        <input
                          value={supportSlaConfigForm.request_type_prefix}
                          onChange={(event) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              request_type_prefix: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Nhóm hỗ trợ (tùy chọn)</label>
                        <SearchableSelect
                          value={supportSlaConfigForm.service_group_id}
                          onChange={(value) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              service_group_id: String(value || ''),
                            }))
                          }
                          options={supportSlaServiceGroupOptions}
                          placeholder="Chọn nhóm hỗ trợ"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Workflow action code (tùy chọn)</label>
                        <SearchableSelect
                          value={supportSlaConfigForm.workflow_action_code}
                          onChange={(value) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              workflow_action_code: normalizeMasterCodeInput(String(value || '')),
                            }))
                          }
                          options={supportSlaWorkflowActionOptions}
                          placeholder="Chọn action workflow"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                        <input
                          type="number"
                          min={0}
                          value={supportSlaConfigForm.sort_order}
                          onChange={(event) =>
                            setSupportSlaConfigForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                      <textarea
                        value={supportSlaConfigForm.description}
                        onChange={(event) =>
                          setSupportSlaConfigForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={supportSlaConfigForm.is_active}
                        onChange={(event) =>
                          setSupportSlaConfigForm((prev) => ({ ...prev, is_active: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Hoạt động
                    </label>
                  </>
                ) : masterType === 'workflow_status_catalog' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Cấp trạng thái</label>
                        <SearchableSelect
                          value={String(workflowStatusCatalogForm.level)}
                          onChange={(value) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              level: Number(value || 1),
                              parent_id: Number(value || 1) > 1 ? prev.parent_id : '',
                            }))
                          }
                          options={[
                            { value: '1', label: 'Cấp 1' },
                            { value: '2', label: 'Cấp 2' },
                            { value: '3', label: 'Cấp 3' },
                          ]}
                          placeholder="Chọn cấp trạng thái"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Trạng thái cha</label>
                        <SearchableSelect
                          value={workflowStatusCatalogForm.parent_id}
                          onChange={(value) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              parent_id: String(value || ''),
                            }))
                          }
                          disabled={workflowStatusCatalogForm.level <= 1}
                          options={[
                            { value: '', label: workflowStatusCatalogForm.level <= 1 ? 'Không áp dụng' : 'Chọn trạng thái cha' },
                            ...workflowStatusCatalogs
                              .filter((item) => Number(item.level || 0) === workflowStatusCatalogForm.level - 1)
                              .map((item) => ({
                                value: String(item.id),
                                label: `${item.status_name || '--'} (${item.status_code || '--'})`,
                              })),
                          ]}
                          placeholder="Chọn trạng thái cha"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Mã trạng thái <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowStatusCatalogForm.status_code}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              status_code: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Tên trạng thái <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowStatusCatalogForm.status_name}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              status_name: event.target.value,
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Canonical status</label>
                        <input
                          value={workflowStatusCatalogForm.canonical_status}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              canonical_status: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Canonical sub_status</label>
                        <input
                          value={workflowStatusCatalogForm.canonical_sub_status}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              canonical_sub_status: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Flow step</label>
                        <input
                          value={workflowStatusCatalogForm.flow_step}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              flow_step: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Form key</label>
                        <input
                          value={workflowStatusCatalogForm.form_key}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              form_key: event.target.value,
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                        <input
                          type="number"
                          min={0}
                          value={workflowStatusCatalogForm.sort_order}
                          onChange={(event) =>
                            setWorkflowStatusCatalogForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={workflowStatusCatalogForm.is_leaf}
                            onChange={(event) =>
                              setWorkflowStatusCatalogForm((prev) => ({
                                ...prev,
                                is_leaf: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                          />
                          Là node lá (leaf)
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={workflowStatusCatalogForm.is_active}
                            onChange={(event) =>
                              setWorkflowStatusCatalogForm((prev) => ({
                                ...prev,
                                is_active: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                          />
                          Hoạt động
                        </label>
                      </div>
                    </div>
                  </>
                ) : masterType === 'workflow_status_transition' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Trạng thái nguồn <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={workflowStatusTransitionForm.from_status_catalog_id}
                          onChange={(value) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              from_status_catalog_id: String(value || ''),
                            }))
                          }
                          options={workflowStatusCatalogs.map((item) => ({
                            value: String(item.id),
                            label: `${item.status_name || '--'} (${item.status_code || '--'})`,
                          }))}
                          placeholder="Chọn trạng thái nguồn"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Trạng thái đích <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={workflowStatusTransitionForm.to_status_catalog_id}
                          onChange={(value) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              to_status_catalog_id: String(value || ''),
                            }))
                          }
                          options={workflowStatusCatalogs
                            .filter((item) => String(item.id) !== String(workflowStatusTransitionForm.from_status_catalog_id || ''))
                            .map((item) => ({
                              value: String(item.id),
                              label: `${item.status_name || '--'} (${item.status_code || '--'})`,
                            }))}
                          placeholder="Chọn trạng thái đích"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Action code <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowStatusTransitionForm.action_code}
                          onChange={(event) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              action_code: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Tên hành động <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowStatusTransitionForm.action_name}
                          onChange={(event) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              action_name: event.target.value,
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Vai trò được phép</label>
                        <SearchableSelect
                          value={workflowStatusTransitionForm.required_role}
                          onChange={(value) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              required_role: String(value || ''),
                            }))
                          }
                          options={[
                            { value: '', label: 'Không giới hạn' },
                            { value: 'ANY', label: 'ANY' },
                            { value: 'ADMIN', label: 'ADMIN' },
                            { value: 'PM', label: 'PM' },
                            { value: 'EXECUTOR', label: 'EXECUTOR' },
                            { value: 'CREATOR', label: 'CREATOR' },
                            { value: 'CUSTOMER', label: 'CUSTOMER' },
                            { value: 'OTHER', label: 'OTHER' },
                          ]}
                          placeholder="Chọn vai trò"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Notify targets</label>
                        <input
                          value={workflowStatusTransitionForm.notify_targets_text}
                          onChange={(event) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              notify_targets_text: event.target.value,
                            }))
                          }
                          placeholder="VD: PM, CREATOR, EXECUTOR"
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                        <input
                          type="number"
                          min={0}
                          value={workflowStatusTransitionForm.sort_order}
                          onChange={(event) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 mt-8">
                        <input
                          type="checkbox"
                          checked={workflowStatusTransitionForm.is_active}
                          onChange={(event) =>
                            setWorkflowStatusTransitionForm((prev) => ({
                              ...prev,
                              is_active: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Hoạt động
                      </label>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Condition JSON (tùy chọn)</label>
                      <textarea
                        value={workflowStatusTransitionForm.condition_json_text}
                        onChange={(event) =>
                          setWorkflowStatusTransitionForm((prev) => ({
                            ...prev,
                            condition_json_text: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder='VD: {"requires_assignment": true}'
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y font-mono text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Trạng thái workflow <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          value={workflowFormFieldConfigForm.status_catalog_id}
                          onChange={(value) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              status_catalog_id: String(value || ''),
                            }))
                          }
                          options={[
                            { value: '', label: 'Chọn trạng thái workflow' },
                            ...workflowStatusCatalogs
                              .filter((item) => item.is_leaf !== false)
                              .map((item) => ({
                                value: String(item.id),
                                label: `${item.status_name || '--'} (${item.status_code || '--'})`,
                              })),
                          ]}
                          placeholder="Chọn trạng thái workflow"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Field key <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowFormFieldConfigForm.field_key}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              field_key: normalizeMasterCodeInput(event.target.value),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Field label <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={workflowFormFieldConfigForm.field_label}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              field_label: event.target.value,
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Field type</label>
                        <SearchableSelect
                          value={workflowFormFieldConfigForm.field_type}
                          onChange={(value) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              field_type: String(value || 'text'),
                            }))
                          }
                          options={[
                            { value: 'text', label: 'text' },
                            { value: 'textarea', label: 'textarea' },
                            { value: 'date', label: 'date' },
                            { value: 'number', label: 'number' },
                            { value: 'boolean', label: 'boolean' },
                            { value: 'user', label: 'user' },
                            { value: 'customer', label: 'customer' },
                            { value: 'service_group', label: 'service_group' },
                            { value: 'task_ref', label: 'task_ref' },
                            { value: 'task_list', label: 'task_list' },
                            { value: 'worklog', label: 'worklog' },
                            { value: 'select', label: 'select' },
                          ]}
                          placeholder="Chọn field type"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Excel column</label>
                        <input
                          value={workflowFormFieldConfigForm.excel_column}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              excel_column: normalizeMasterCodeInput(event.target.value).slice(0, 5),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">Thứ tự sắp xếp</label>
                        <input
                          type="number"
                          min={0}
                          value={workflowFormFieldConfigForm.sort_order}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">Options JSON (cho kiểu select)</label>
                      <textarea
                        rows={5}
                        value={workflowFormFieldConfigForm.options_json_text}
                        onChange={(event) =>
                          setWorkflowFormFieldConfigForm((prev) => ({
                            ...prev,
                            options_json_text: event.target.value,
                          }))
                        }
                        placeholder='Ví dụ: [{"value":"SUCCESS","label":"SUCCESS"}]'
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y font-mono text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={workflowFormFieldConfigForm.required}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              required: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Bắt buộc nhập
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={workflowFormFieldConfigForm.is_active}
                          onChange={(event) =>
                            setWorkflowFormFieldConfigForm((prev) => ({
                              ...prev,
                              is_active: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                        Hoạt động
                      </label>
                    </div>
                  </>
                )}

              {formError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{formError}</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {isSubmitting ? 'Đang lưu...' : formMode === 'ADD' ? 'Thêm mới' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lịch làm việc — slide-in edit panel ────────────────────────────── */}
      {masterType === 'work_calendar' && editingCalDay !== null && canWriteWorkCalendar && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => { setEditingCalDay(null); setCalDayForm(defaultWorkCalendarDayForm()); }}
          />
          {/* Panel */}
          <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Chỉnh sửa ngày</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {(() => {
                    if (!editingCalDay) return '';
                    const d = new Date(editingCalDay.date + 'T00:00:00');
                    const dow = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][d.getDay()];
                    return `${dow}, ${editingCalDay.day}/${editingCalDay.month}/${editingCalDay.year}`;
                  })()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingCalDay(null); setCalDayForm(defaultWorkCalendarDayForm()); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {editingCalDay.is_weekend && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">weekend</span>Cuối tuần
                  </span>
                )}
                {editingCalDay.is_holiday && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">celebration</span>Ngày lễ
                  </span>
                )}
                {editingCalDay.is_working_day && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">work</span>Làm việc
                  </span>
                )}
                {!editingCalDay.is_working_day && !editingCalDay.is_holiday && !editingCalDay.is_weekend && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">block</span>Nghỉ
                  </span>
                )}
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={calDayForm.is_working_day}
                    onChange={(e) => setCalDayForm((prev) => ({ ...prev, is_working_day: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Ngày làm việc</p>
                    <p className="text-xs text-slate-500">Bỏ tick = ngày nghỉ</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={calDayForm.is_holiday}
                    onChange={(e) => setCalDayForm((prev) => ({
                      ...prev,
                      is_holiday: e.target.checked,
                      is_working_day: e.target.checked ? false : prev.is_working_day,
                    }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Ngày lễ chính thức</p>
                    <p className="text-xs text-slate-500">Tự động tắt "Ngày làm việc"</p>
                  </div>
                </label>
              </div>

              {/* Holiday name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Tên ngày lễ</label>
                <input
                  value={calDayForm.holiday_name}
                  onChange={(e) => setCalDayForm((prev) => ({ ...prev, holiday_name: e.target.value }))}
                  placeholder="VD: Tết Dương lịch, Quốc khánh..."
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Ghi chú</label>
                <textarea
                  value={calDayForm.note}
                  onChange={(e) => setCalDayForm((prev) => ({ ...prev, note: e.target.value }))}
                  rows={3}
                  placeholder="Ghi chú thêm về ngày này..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                />
              </div>

              {calError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{calError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                type="button"
                onClick={() => { setEditingCalDay(null); setCalDayForm(defaultWorkCalendarDayForm()); }}
                className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={calSaving}
                onClick={async () => {
                  if (!editingCalDay) return;
                  setCalSaving(true);
                  setCalError('');
                  try {
                    const updated = await updateCalendarDay(editingCalDay.date, {
                      is_working_day: calDayForm.is_working_day,
                      is_holiday:     calDayForm.is_holiday,
                      holiday_name:   calDayForm.holiday_name.trim() || null,
                      note:           calDayForm.note.trim() || null,
                    });
                    // Cập nhật local state
                    setCalDays((prev) =>
                      prev.map((d) => d.date === updated.date ? { ...d, ...updated } : d)
                    );
                    setEditingCalDay(null);
                    setCalDayForm(defaultWorkCalendarDayForm());
                  } catch (err: unknown) {
                    setCalError(err instanceof Error ? err.message : 'Lỗi lưu ngày');
                  } finally {
                    setCalSaving(false);
                  }
                }}
                className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-deep-teal transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {calSaving
                  ? <><span className="material-symbols-outlined text-sm animate-spin">refresh</span>Đang lưu...</>
                  : <><span className="material-symbols-outlined text-sm">save</span>Lưu</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
