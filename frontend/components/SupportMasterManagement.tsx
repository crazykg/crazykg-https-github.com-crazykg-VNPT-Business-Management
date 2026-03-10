import React, { useEffect, useMemo, useState } from 'react';
import {
  Customer,
  OpportunityStageOption,
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
  WorklogActivityTypeOption,
} from '../types';
import {
  createWorkflowFormFieldConfig,
  createWorkflowStatusCatalog,
  fetchWorkflowFormFieldConfigs,
  fetchWorkflowStatusCatalogs,
  updateWorkflowFormFieldConfig,
  updateWorkflowStatusCatalog,
} from '../services/v5Api';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect, SearchableSelectOption } from './SearchableSelect';

type MasterType =
  | 'group'
  | 'contact_position'
  | 'status'
  | 'opportunity_stage'
  | 'worklog_activity_type'
  | 'sla_config'
  | 'workflow_status_catalog'
  | 'workflow_form_field_config';
type ActivityFilter = 'all' | 'active' | 'inactive';
type FormMode = 'ADD' | 'EDIT';

interface SupportMasterManagementProps {
  customers: Customer[];
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions: SupportContactPosition[];
  supportRequestStatuses: SupportRequestStatusOption[];
  opportunityStages: OpportunityStageOption[];
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
  onCreateOpportunityStage: (
    payload: Partial<OpportunityStageOption>,
    options?: { silent?: boolean }
  ) => Promise<OpportunityStageOption>;
  onUpdateOpportunityStage: (
    id: string | number,
    payload: Partial<OpportunityStageOption>,
    options?: { silent?: boolean }
  ) => Promise<OpportunityStageOption>;
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
  canWriteOpportunityStages?: boolean;
  canReadOpportunityStages?: boolean;
}

interface GroupFormState {
  customer_id: string;
  group_code: string;
  group_name: string;
  description: string;
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

interface OpportunityStageFormState {
  stage_code: string;
  stage_name: string;
  description: string;
  is_terminal: boolean;
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

const normalizeOpportunityStageCodeInput = (value: string): string =>
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

const defaultOpportunityStageForm = (sortOrder: number): OpportunityStageFormState => ({
  stage_code: '',
  stage_name: '',
  description: '',
  is_terminal: false,
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

export const SupportMasterManagement: React.FC<SupportMasterManagementProps> = ({
  customers = [],
  supportServiceGroups = [],
  supportContactPositions = [],
  supportRequestStatuses = [],
  opportunityStages = [],
  worklogActivityTypes = [],
  supportSlaConfigs = [],
  onCreateSupportServiceGroup,
  onUpdateSupportServiceGroup,
  onCreateSupportContactPosition,
  onUpdateSupportContactPosition,
  onCreateSupportRequestStatus,
  onUpdateSupportRequestStatus,
  onCreateOpportunityStage,
  onUpdateOpportunityStage,
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
  canWriteOpportunityStages = true,
  canReadOpportunityStages = true,
}) => {
  const [masterType, setMasterType] = useState<MasterType>('group');
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingGroup, setEditingGroup] = useState<SupportServiceGroup | null>(null);
  const [editingContactPosition, setEditingContactPosition] = useState<SupportContactPosition | null>(null);
  const [editingStatus, setEditingStatus] = useState<SupportRequestStatusOption | null>(null);
  const [editingOpportunityStage, setEditingOpportunityStage] = useState<OpportunityStageOption | null>(null);
  const [editingWorklogActivityType, setEditingWorklogActivityType] = useState<WorklogActivityTypeOption | null>(null);
  const [editingSupportSlaConfig, setEditingSupportSlaConfig] = useState<SupportSlaConfigOption | null>(null);
  const [editingWorkflowStatusCatalog, setEditingWorkflowStatusCatalog] = useState<WorkflowStatusCatalog | null>(null);
  const [editingWorkflowFormFieldConfig, setEditingWorkflowFormFieldConfig] = useState<WorkflowFormFieldConfig | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(defaultGroupForm);
  const [contactPositionForm, setContactPositionForm] = useState<ContactPositionFormState>(defaultContactPositionForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(() => defaultStatusForm(10));
  const [opportunityStageForm, setOpportunityStageForm] = useState<OpportunityStageFormState>(() =>
    defaultOpportunityStageForm(10)
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
  const [workflowFormFieldConfigForm, setWorkflowFormFieldConfigForm] = useState<WorkflowFormFieldConfigFormState>(() =>
    defaultWorkflowFormFieldConfigForm(10)
  );
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflowStatusCatalogs, setWorkflowStatusCatalogs] = useState<WorkflowStatusCatalog[]>([]);
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

    if (canReadOpportunityStages) {
      options.push({ value: 'opportunity_stage', label: 'Giai đoạn cơ hội' });
    }
    if (canReadWorklogActivityTypes) {
      options.push({ value: 'worklog_activity_type', label: 'Loại công việc worklog' });
    }
    if (canReadSlaConfigs) {
      options.push({ value: 'sla_config', label: 'Cấu hình SLA hỗ trợ' });
    }
    if (canReadStatuses) {
      options.push({ value: 'workflow_status_catalog', label: 'Workflow trạng thái phân cấp' });
      options.push({ value: 'workflow_form_field_config', label: 'Workflow schema field' });
    }

    return options;
  }, [
    canReadServiceGroups,
    canReadContactPositions,
    canReadStatuses,
    canReadOpportunityStages,
    canReadWorklogActivityTypes,
    canReadSlaConfigs,
  ]);

  const canWriteCurrentMaster =
    masterType === 'group'
      ? canWriteServiceGroups
      : masterType === 'contact_position'
        ? canWriteContactPositions
      : masterType === 'status'
        ? canWriteStatuses
      : masterType === 'opportunity_stage'
        ? canWriteOpportunityStages
      : masterType === 'worklog_activity_type'
        ? canWriteWorklogActivityTypes
      : masterType === 'sla_config'
        ? canWriteSlaConfigs
        : canWriteStatuses;

  const nextStatusSortOrder = useMemo(() => {
    const maxSort = (supportRequestStatuses || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [supportRequestStatuses]);

  const nextOpportunityStageSortOrder = useMemo(() => {
    const maxSort = (opportunityStages || []).reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [opportunityStages]);

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
    if (!canReadStatuses) {
      return;
    }

    setIsWorkflowConfigLoading(true);
    try {
      const [catalogRows, fieldRows] = await Promise.all([
        fetchWorkflowStatusCatalogs(true),
        fetchWorkflowFormFieldConfigs(null, true),
      ]);
      setWorkflowStatusCatalogs(catalogRows || []);
      setWorkflowFormFieldConfigs(fieldRows || []);
    } catch (error) {
      console.error('Failed to load workflow config datasets', error);
    } finally {
      setIsWorkflowConfigLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkflowConfigs();
  }, [canReadStatuses]);

  const filteredGroups = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (supportServiceGroups || []).filter((group) => {
      const isActive = group.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${group.group_code || ''} ${group.group_name || ''} ${group.description || ''} ${group.customer_code || ''} ${group.customer_name || ''}`;
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

  const filteredOpportunityStages = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return (opportunityStages || []).filter((stage) => {
      const isActive = stage.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${stage.stage_code || ''} ${stage.stage_name || ''} ${stage.description || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [opportunityStages, activityFilter, searchTerm]);

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
      const haystack = `${item.status || ''} ${item.sub_status || ''} ${item.priority || ''} ${item.request_type_prefix || ''} ${item.description || ''} ${item.sla_hours || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportSlaConfigs, activityFilter, searchTerm]);

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
        : masterType === 'opportunity_stage'
          ? filteredOpportunityStages.length
        : masterType === 'worklog_activity_type'
          ? filteredWorklogActivityTypes.length
        : masterType === 'sla_config'
          ? filteredSupportSlaConfigs.length
          : masterType === 'workflow_status_catalog'
            ? filteredWorkflowStatusCatalogs.length
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

  const pagedOpportunityStages = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredOpportunityStages.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredOpportunityStages, safePage, rowsPerPage]);

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

  const pagedWorkflowFormFieldConfigs = useMemo(() => {
    const startIndex = (safePage - 1) * rowsPerPage;
    return filteredWorkflowFormFieldConfigs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorkflowFormFieldConfigs, safePage, rowsPerPage]);

  const closeForm = () => {
    setFormMode(null);
    setEditingGroup(null);
    setEditingContactPosition(null);
    setEditingStatus(null);
    setEditingOpportunityStage(null);
    setEditingWorklogActivityType(null);
    setEditingSupportSlaConfig(null);
    setEditingWorkflowStatusCatalog(null);
    setEditingWorkflowFormFieldConfig(null);
    setGroupForm(defaultGroupForm());
    setContactPositionForm(defaultContactPositionForm());
    setStatusForm(defaultStatusForm(nextStatusSortOrder));
    setOpportunityStageForm(defaultOpportunityStageForm(nextOpportunityStageSortOrder));
    setWorklogActivityTypeForm(defaultWorklogActivityTypeForm(nextWorklogActivityTypeSortOrder));
    setSupportSlaConfigForm(defaultSupportSlaConfigForm(nextSupportSlaConfigSortOrder));
    setWorkflowStatusCatalogForm(defaultWorkflowStatusCatalogForm(nextWorkflowStatusCatalogSortOrder));
    setWorkflowFormFieldConfigForm(defaultWorkflowFormFieldConfigForm(nextWorkflowFormFieldConfigSortOrder));
    setFormError('');
    setIsSubmitting(false);
  };

  const openGroupAdd = () => {
    setFormMode('ADD');
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

  const openOpportunityStageAdd = () => {
    setFormMode('ADD');
    setEditingOpportunityStage(null);
    setOpportunityStageForm(defaultOpportunityStageForm(nextOpportunityStageSortOrder));
    setFormError('');
  };

  const openOpportunityStageEdit = (stage: OpportunityStageOption) => {
    setFormMode('EDIT');
    setEditingOpportunityStage(stage);
    setOpportunityStageForm({
      stage_code: String(stage.stage_code || ''),
      stage_name: String(stage.stage_name || ''),
      description: String(stage.description || ''),
      is_terminal: stage.is_terminal === true,
      is_active: stage.is_active !== false,
      sort_order: Number.isFinite(Number(stage.sort_order)) ? Number(stage.sort_order) : 0,
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
      } else if (masterType === 'opportunity_stage') {
        const stageCode = normalizeOpportunityStageCodeInput(opportunityStageForm.stage_code);
        if (!stageCode) {
          setFormError('Mã giai đoạn là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        if (!opportunityStageForm.stage_name.trim()) {
          setFormError('Tên giai đoạn là bắt buộc.');
          setIsSubmitting(false);
          return;
        }

        const payload: Partial<OpportunityStageOption> = {
          stage_code: stageCode,
          stage_name: opportunityStageForm.stage_name.trim(),
          description: opportunityStageForm.description.trim() || null,
          is_terminal: opportunityStageForm.is_terminal,
          is_active: opportunityStageForm.is_active,
          sort_order: Math.max(0, Number(opportunityStageForm.sort_order || 0)),
        };

        if (formMode === 'ADD') {
          await onCreateOpportunityStage(payload);
        } else if (formMode === 'EDIT' && editingOpportunityStage) {
          if (editingOpportunityStage.id === null || editingOpportunityStage.id === undefined) {
            setFormError('Giai đoạn này chưa có bản ghi DB, không thể cập nhật trực tiếp.');
            setIsSubmitting(false);
            return;
          }

          await onUpdateOpportunityStage(editingOpportunityStage.id, payload);
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

  const opportunityStageCodeEditable =
    formMode === 'ADD'
      ? true
      : Boolean(
          editingOpportunityStage?.is_code_editable ??
            Number(editingOpportunityStage?.used_in_opportunities ?? 0) === 0
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
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
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
            if (masterType === 'opportunity_stage') {
              openOpportunityStageAdd();
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
            <table className="w-full min-w-[1080px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên nhóm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Khách hàng</th>
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
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
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
	          ) : masterType === 'opportunity_stage' ? (
            <table className="w-full min-w-[1240px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Tên giai đoạn</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mô tả</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Kết thúc</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sắp xếp</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đang dùng</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedOpportunityStages.map((item) => {
                  const canEditRow = canWriteOpportunityStages && item.id !== null && item.id !== undefined;
                  const usedInOpportunities = Number(item.used_in_opportunities || 0);
                  return (
                    <tr key={String(item.id ?? item.stage_code)} className="odd:bg-white even:bg-slate-50/30">
                      <td className="px-4 py-4 text-sm font-mono font-semibold text-slate-800">{item.stage_code || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.stage_name || '--'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{item.description || '--'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{item.is_terminal === true ? 'Có' : 'Không'}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{Number(item.sort_order ?? 0)}</td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{usedInOpportunities}</td>
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
                          onClick={() => openOpportunityStageEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canEditRow ? 'Cập nhật' : 'Không thể cập nhật giai đoạn chưa đồng bộ DB'}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pagedOpportunityStages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Không có dữ liệu giai đoạn phù hợp.
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
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
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
                    : masterType === 'opportunity_stage'
                      ? formMode === 'ADD'
                        ? 'Thêm giai đoạn cơ hội'
                        : 'Cập nhật giai đoạn cơ hội'
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
	              ) : masterType === 'opportunity_stage' ? (
	                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Mã giai đoạn <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={opportunityStageForm.stage_code}
                        disabled={!opportunityStageCodeEditable}
                        onChange={(event) =>
                          setOpportunityStageForm((prev) => ({
                            ...prev,
                            stage_code: normalizeOpportunityStageCodeInput(event.target.value),
                          }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Tên giai đoạn <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={opportunityStageForm.stage_name}
                        onChange={(event) =>
                          setOpportunityStageForm((prev) => ({ ...prev, stage_name: event.target.value }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  {!opportunityStageCodeEditable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Đã phát sinh dữ liệu, không cho đổi mã.
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                    <textarea
                      value={opportunityStageForm.description}
                      onChange={(event) =>
                        setOpportunityStageForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={opportunityStageForm.is_terminal}
                        onChange={(event) =>
                          setOpportunityStageForm((prev) => ({ ...prev, is_terminal: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      Trạng thái kết thúc
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={opportunityStageForm.is_active}
                        onChange={(event) =>
                          setOpportunityStageForm((prev) => ({ ...prev, is_active: event.target.checked }))
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
                      value={opportunityStageForm.sort_order}
                      onChange={(event) =>
                        setOpportunityStageForm((prev) => ({
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
    </div>
  );
};
