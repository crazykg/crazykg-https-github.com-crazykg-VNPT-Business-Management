import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Customer } from '../../../types/customer';
import type { ProjectTypeOption } from '../../../types/project';
import type {
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowStatusCatalog,
  WorklogActivityTypeOption,
} from '../../../types/support';
import type { SearchableSelectOption } from '../../SearchableSelect';
import type { ActivityFilter } from './useSupportMasterShellState';

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

interface UseSupportMasterNonWorkflowStateArgs {
  customers: Customer[];
  supportServiceGroups: SupportServiceGroup[];
  supportContactPositions: SupportContactPosition[];
  supportRequestStatuses: SupportRequestStatusOption[];
  projectTypes: ProjectTypeOption[];
  worklogActivityTypes: WorklogActivityTypeOption[];
  supportSlaConfigs: SupportSlaConfigOption[];
  workflowStatusCatalogs: WorkflowStatusCatalog[];
  canReadCustomers: boolean;
  searchTerm: string;
  activityFilter: ActivityFilter;
  currentPage: number;
  rowsPerPage: number;
}

interface UseSupportMasterNonWorkflowStateResult {
  editingGroup: SupportServiceGroup | null;
  editingContactPosition: SupportContactPosition | null;
  editingStatus: SupportRequestStatusOption | null;
  editingProjectType: ProjectTypeOption | null;
  editingWorklogActivityType: WorklogActivityTypeOption | null;
  editingSupportSlaConfig: SupportSlaConfigOption | null;
  groupForm: GroupFormState;
  setGroupForm: Dispatch<SetStateAction<GroupFormState>>;
  contactPositionForm: ContactPositionFormState;
  setContactPositionForm: Dispatch<SetStateAction<ContactPositionFormState>>;
  statusForm: StatusFormState;
  setStatusForm: Dispatch<SetStateAction<StatusFormState>>;
  projectTypeForm: ProjectTypeFormState;
  setProjectTypeForm: Dispatch<SetStateAction<ProjectTypeFormState>>;
  worklogActivityTypeForm: WorklogActivityTypeFormState;
  setWorklogActivityTypeForm: Dispatch<SetStateAction<WorklogActivityTypeFormState>>;
  supportSlaConfigForm: SupportSlaConfigFormState;
  setSupportSlaConfigForm: Dispatch<SetStateAction<SupportSlaConfigFormState>>;
  customerOptions: SearchableSelectOption[];
  customerSelectDisabled: boolean;
  customerSelectError: string;
  workflowStatusCatalogOptions: SearchableSelectOption[];
  workflowFormKeyOptions: SearchableSelectOption[];
  supportSlaServiceGroupOptions: SearchableSelectOption[];
  filteredGroups: SupportServiceGroup[];
  filteredContactPositions: SupportContactPosition[];
  filteredStatuses: SupportRequestStatusOption[];
  filteredProjectTypes: ProjectTypeOption[];
  filteredWorklogActivityTypes: WorklogActivityTypeOption[];
  filteredSupportSlaConfigs: SupportSlaConfigOption[];
  pagedGroups: SupportServiceGroup[];
  pagedContactPositions: SupportContactPosition[];
  pagedStatuses: SupportRequestStatusOption[];
  pagedProjectTypes: ProjectTypeOption[];
  pagedWorklogActivityTypes: WorklogActivityTypeOption[];
  pagedSupportSlaConfigs: SupportSlaConfigOption[];
  resetNonWorkflowState: () => void;
  openGroupAdd: () => void;
  openGroupEdit: (group: SupportServiceGroup) => void;
  openContactPositionAdd: () => void;
  openContactPositionEdit: (position: SupportContactPosition) => void;
  openStatusAdd: () => void;
  openStatusEdit: (status: SupportRequestStatusOption) => void;
  openProjectTypeAdd: () => void;
  openProjectTypeEdit: (item: ProjectTypeOption) => void;
  openWorklogActivityTypeAdd: () => void;
  openWorklogActivityTypeEdit: (item: WorklogActivityTypeOption) => void;
  openSupportSlaConfigAdd: () => void;
  openSupportSlaConfigEdit: (item: SupportSlaConfigOption) => void;
  statusCodeEditable: boolean;
  contactPositionCodeEditable: boolean;
  projectTypeCodeEditable: boolean;
  worklogActivityTypeCodeEditable: boolean;
  supportSlaStatusEditable: boolean;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

export const useSupportMasterNonWorkflowState = ({
  customers,
  supportServiceGroups,
  supportContactPositions,
  supportRequestStatuses,
  projectTypes,
  worklogActivityTypes,
  supportSlaConfigs,
  workflowStatusCatalogs,
  canReadCustomers,
  searchTerm,
  activityFilter,
  currentPage,
  rowsPerPage,
}: UseSupportMasterNonWorkflowStateArgs): UseSupportMasterNonWorkflowStateResult => {
  const [editingGroup, setEditingGroup] = useState<SupportServiceGroup | null>(null);
  const [editingContactPosition, setEditingContactPosition] = useState<SupportContactPosition | null>(null);
  const [editingStatus, setEditingStatus] = useState<SupportRequestStatusOption | null>(null);
  const [editingProjectType, setEditingProjectType] = useState<ProjectTypeOption | null>(null);
  const [editingWorklogActivityType, setEditingWorklogActivityType] = useState<WorklogActivityTypeOption | null>(null);
  const [editingSupportSlaConfig, setEditingSupportSlaConfig] = useState<SupportSlaConfigOption | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(defaultGroupForm);
  const [contactPositionForm, setContactPositionForm] = useState<ContactPositionFormState>(defaultContactPositionForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(() => defaultStatusForm(10));
  const [projectTypeForm, setProjectTypeForm] = useState<ProjectTypeFormState>(() => defaultProjectTypeForm(10));
  const [worklogActivityTypeForm, setWorklogActivityTypeForm] = useState<WorklogActivityTypeFormState>(() =>
    defaultWorklogActivityTypeForm(10)
  );
  const [supportSlaConfigForm, setSupportSlaConfigForm] = useState<SupportSlaConfigFormState>(() =>
    defaultSupportSlaConfigForm(10)
  );

  const nextStatusSortOrder = useMemo(() => {
    const maxSort = supportRequestStatuses.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [supportRequestStatuses]);

  const nextProjectTypeSortOrder = useMemo(() => {
    const maxSort = projectTypes.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [projectTypes]);

  const nextWorklogActivityTypeSortOrder = useMemo(() => {
    const maxSort = worklogActivityTypes.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [worklogActivityTypes]);

  const nextSupportSlaConfigSortOrder = useMemo(() => {
    const maxSort = supportSlaConfigs.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [supportSlaConfigs]);

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
    const activeRows = workflowStatusCatalogs.filter((item) => item.is_active !== false);
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

    workflowStatusCatalogs.forEach((item) => {
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

  const filteredGroups = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return supportServiceGroups.filter((group) => {
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

    return supportContactPositions.filter((position) => {
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

    return supportRequestStatuses.filter((status) => {
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

    return projectTypes.filter((item) => {
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

    return worklogActivityTypes.filter((item) => {
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

    return supportSlaConfigs.filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.status || ''} ${item.sub_status || ''} ${item.priority || ''} ${item.request_type_prefix || ''} ${item.service_group_name || ''} ${item.workflow_action_code || ''} ${item.description || ''} ${item.sla_hours || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [supportSlaConfigs, activityFilter, searchTerm]);

  const supportSlaServiceGroupOptions = useMemo<SearchableSelectOption[]>(() => {
    return supportServiceGroups.map((group) => ({
      value: String(group.id),
      label: String(group.group_name || group.group_code || `#${group.id}`),
      searchText: `${group.group_code || ''} ${group.group_name || ''} ${group.customer_name || ''}`.trim(),
    }));
  }, [supportServiceGroups]);

  const pagedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredGroups.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredGroups, currentPage, rowsPerPage]);

  const pagedContactPositions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredContactPositions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredContactPositions, currentPage, rowsPerPage]);

  const pagedStatuses = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredStatuses.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredStatuses, currentPage, rowsPerPage]);

  const pagedProjectTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredProjectTypes.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredProjectTypes, currentPage, rowsPerPage]);

  const pagedWorklogActivityTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredWorklogActivityTypes.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredWorklogActivityTypes, currentPage, rowsPerPage]);

  const pagedSupportSlaConfigs = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredSupportSlaConfigs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredSupportSlaConfigs, currentPage, rowsPerPage]);

  const resetNonWorkflowState = () => {
    setEditingGroup(null);
    setEditingContactPosition(null);
    setEditingStatus(null);
    setEditingProjectType(null);
    setEditingWorklogActivityType(null);
    setEditingSupportSlaConfig(null);
    setGroupForm(defaultGroupForm());
    setContactPositionForm(defaultContactPositionForm());
    setStatusForm(defaultStatusForm(nextStatusSortOrder));
    setProjectTypeForm(defaultProjectTypeForm(nextProjectTypeSortOrder));
    setWorklogActivityTypeForm(defaultWorklogActivityTypeForm(nextWorklogActivityTypeSortOrder));
    setSupportSlaConfigForm(defaultSupportSlaConfigForm(nextSupportSlaConfigSortOrder));
  };

  const openGroupAdd = () => {
    setEditingGroup(null);
    setGroupForm(defaultGroupForm());
  };

  const openGroupEdit = (group: SupportServiceGroup) => {
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
  };

  const openContactPositionAdd = () => {
    setEditingContactPosition(null);
    setContactPositionForm(defaultContactPositionForm());
  };

  const openContactPositionEdit = (position: SupportContactPosition) => {
    setEditingContactPosition(position);
    setContactPositionForm({
      position_code: String(position.position_code || ''),
      position_name: String(position.position_name || ''),
      description: String(position.description || ''),
      is_active: position.is_active !== false,
    });
  };

  const openStatusAdd = () => {
    setEditingStatus(null);
    setStatusForm(defaultStatusForm(nextStatusSortOrder));
  };

  const openStatusEdit = (status: SupportRequestStatusOption) => {
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
  };

  const openProjectTypeAdd = () => {
    setEditingProjectType(null);
    setProjectTypeForm(defaultProjectTypeForm(nextProjectTypeSortOrder));
  };

  const openProjectTypeEdit = (item: ProjectTypeOption) => {
    setEditingProjectType(item);
    setProjectTypeForm({
      type_code: String(item.type_code || ''),
      type_name: String(item.type_name || ''),
      description: String(item.description || ''),
      is_active: item.is_active !== false,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
    });
  };

  const openWorklogActivityTypeAdd = () => {
    setEditingWorklogActivityType(null);
    setWorklogActivityTypeForm(defaultWorklogActivityTypeForm(nextWorklogActivityTypeSortOrder));
  };

  const openWorklogActivityTypeEdit = (item: WorklogActivityTypeOption) => {
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
  };

  const openSupportSlaConfigAdd = () => {
    setEditingSupportSlaConfig(null);
    setSupportSlaConfigForm(defaultSupportSlaConfigForm(nextSupportSlaConfigSortOrder));
  };

  const openSupportSlaConfigEdit = (item: SupportSlaConfigOption) => {
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
  };

  const statusCodeEditable = Boolean(
    editingStatus?.is_code_editable ??
      ((editingStatus?.used_in_requests ?? 0) + (editingStatus?.used_in_history ?? 0) === 0)
  );

  const contactPositionCodeEditable = Boolean(
    editingContactPosition?.is_code_editable ??
      Number(editingContactPosition?.used_in_customer_personnel ?? 0) === 0
  );

  const projectTypeCodeEditable = Boolean(
    editingProjectType?.is_code_editable ??
      Number(editingProjectType?.used_in_projects ?? 0) === 0
  );

  const worklogActivityTypeCodeEditable = Boolean(
    editingWorklogActivityType?.is_code_editable ??
      Number(editingWorklogActivityType?.used_in_worklogs ?? 0) === 0
  );

  const supportSlaStatusEditable =
    editingSupportSlaConfig === null
      ? true
      : Boolean(editingSupportSlaConfig.is_status_editable ?? false);

  return {
    editingGroup,
    editingContactPosition,
    editingStatus,
    editingProjectType,
    editingWorklogActivityType,
    editingSupportSlaConfig,
    groupForm,
    setGroupForm,
    contactPositionForm,
    setContactPositionForm,
    statusForm,
    setStatusForm,
    projectTypeForm,
    setProjectTypeForm,
    worklogActivityTypeForm,
    setWorklogActivityTypeForm,
    supportSlaConfigForm,
    setSupportSlaConfigForm,
    customerOptions,
    customerSelectDisabled,
    customerSelectError,
    workflowStatusCatalogOptions,
    workflowFormKeyOptions,
    supportSlaServiceGroupOptions,
    filteredGroups,
    filteredContactPositions,
    filteredStatuses,
    filteredProjectTypes,
    filteredWorklogActivityTypes,
    filteredSupportSlaConfigs,
    pagedGroups,
    pagedContactPositions,
    pagedStatuses,
    pagedProjectTypes,
    pagedWorklogActivityTypes,
    pagedSupportSlaConfigs,
    resetNonWorkflowState,
    openGroupAdd,
    openGroupEdit,
    openContactPositionAdd,
    openContactPositionEdit,
    openStatusAdd,
    openStatusEdit,
    openProjectTypeAdd,
    openProjectTypeEdit,
    openWorklogActivityTypeAdd,
    openWorklogActivityTypeEdit,
    openSupportSlaConfigAdd,
    openSupportSlaConfigEdit,
    statusCodeEditable,
    contactPositionCodeEditable,
    projectTypeCodeEditable,
    worklogActivityTypeCodeEditable,
    supportSlaStatusEditable,
  };
};
