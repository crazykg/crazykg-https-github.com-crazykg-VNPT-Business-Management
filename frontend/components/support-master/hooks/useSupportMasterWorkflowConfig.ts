import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  WorkflowFormFieldConfig,
  WorkflowStatusCatalog,
  WorkflowStatusTransition,
} from '../../../types/support';
import {
  fetchWorkflowFormFieldConfigs,
  fetchWorkflowStatusCatalogs,
  fetchWorkflowStatusTransitions,
} from '../../../services/v5Api';
import type { SearchableSelectOption } from '../../SearchableSelect';

type ActivityFilter = 'all' | 'active' | 'inactive';

export interface WorkflowStatusCatalogFormState {
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

export interface WorkflowStatusTransitionFormState {
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

export interface WorkflowFormFieldConfigFormState {
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

interface UseSupportMasterWorkflowConfigArgs {
  canReadStatuses: boolean;
  activityFilter: ActivityFilter;
  searchTerm: string;
}

interface UseSupportMasterWorkflowConfigResult {
  editingWorkflowStatusCatalog: WorkflowStatusCatalog | null;
  editingWorkflowStatusTransition: WorkflowStatusTransition | null;
  editingWorkflowFormFieldConfig: WorkflowFormFieldConfig | null;
  workflowStatusCatalogForm: WorkflowStatusCatalogFormState;
  setWorkflowStatusCatalogForm: Dispatch<SetStateAction<WorkflowStatusCatalogFormState>>;
  workflowStatusTransitionForm: WorkflowStatusTransitionFormState;
  setWorkflowStatusTransitionForm: Dispatch<SetStateAction<WorkflowStatusTransitionFormState>>;
  workflowFormFieldConfigForm: WorkflowFormFieldConfigFormState;
  setWorkflowFormFieldConfigForm: Dispatch<SetStateAction<WorkflowFormFieldConfigFormState>>;
  workflowStatusCatalogs: WorkflowStatusCatalog[];
  workflowStatusTransitions: WorkflowStatusTransition[];
  workflowFormFieldConfigs: WorkflowFormFieldConfig[];
  isWorkflowConfigLoading: boolean;
  supportSlaWorkflowActionOptions: SearchableSelectOption[];
  workflowStatusCatalogParentOptions: SearchableSelectOption[];
  workflowStatusTransitionSourceOptions: SearchableSelectOption[];
  workflowStatusTransitionTargetOptions: SearchableSelectOption[];
  workflowFieldStatusOptions: SearchableSelectOption[];
  filteredWorkflowStatusCatalogs: WorkflowStatusCatalog[];
  filteredWorkflowStatusTransitions: WorkflowStatusTransition[];
  filteredWorkflowFormFieldConfigs: WorkflowFormFieldConfig[];
  loadWorkflowConfigs: () => Promise<void>;
  resetWorkflowConfigState: () => void;
  openWorkflowStatusCatalogAdd: () => void;
  openWorkflowStatusCatalogEdit: (item: WorkflowStatusCatalog) => void;
  openWorkflowStatusTransitionAdd: () => void;
  openWorkflowStatusTransitionEdit: (item: WorkflowStatusTransition) => void;
  openWorkflowFormFieldConfigAdd: () => void;
  openWorkflowFormFieldConfigEdit: (item: WorkflowFormFieldConfig) => void;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeMasterCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

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

export const useSupportMasterWorkflowConfig = ({
  canReadStatuses,
  activityFilter,
  searchTerm,
}: UseSupportMasterWorkflowConfigArgs): UseSupportMasterWorkflowConfigResult => {
  const [editingWorkflowStatusCatalog, setEditingWorkflowStatusCatalog] = useState<WorkflowStatusCatalog | null>(null);
  const [editingWorkflowStatusTransition, setEditingWorkflowStatusTransition] = useState<WorkflowStatusTransition | null>(null);
  const [editingWorkflowFormFieldConfig, setEditingWorkflowFormFieldConfig] = useState<WorkflowFormFieldConfig | null>(null);
  const [workflowStatusCatalogForm, setWorkflowStatusCatalogForm] = useState<WorkflowStatusCatalogFormState>(() =>
    defaultWorkflowStatusCatalogForm(10)
  );
  const [workflowStatusTransitionForm, setWorkflowStatusTransitionForm] = useState<WorkflowStatusTransitionFormState>(() =>
    defaultWorkflowStatusTransitionForm(10)
  );
  const [workflowFormFieldConfigForm, setWorkflowFormFieldConfigForm] = useState<WorkflowFormFieldConfigFormState>(() =>
    defaultWorkflowFormFieldConfigForm(10)
  );
  const [workflowStatusCatalogs, setWorkflowStatusCatalogs] = useState<WorkflowStatusCatalog[]>([]);
  const [workflowStatusTransitions, setWorkflowStatusTransitions] = useState<WorkflowStatusTransition[]>([]);
  const [workflowFormFieldConfigs, setWorkflowFormFieldConfigs] = useState<WorkflowFormFieldConfig[]>([]);
  const [isWorkflowConfigLoading, setIsWorkflowConfigLoading] = useState(false);

  const nextWorkflowStatusCatalogSortOrder = useMemo(() => {
    const maxSort = workflowStatusCatalogs.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowStatusCatalogs]);

  const nextWorkflowStatusTransitionSortOrder = useMemo(() => {
    const maxSort = workflowStatusTransitions.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowStatusTransitions]);

  const nextWorkflowFormFieldConfigSortOrder = useMemo(() => {
    const maxSort = workflowFormFieldConfigs.reduce((max, item) => {
      const value = Number(item.sort_order ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);

    return Math.max(10, maxSort + 10);
  }, [workflowFormFieldConfigs]);

  const loadWorkflowConfigs = useCallback(async (): Promise<void> => {
    if (!canReadStatuses) {
      return;
    }

    setIsWorkflowConfigLoading(true);
    try {
      const [catalogRows, transitionRows, fieldRows] = await Promise.all([
        fetchWorkflowStatusCatalogs(true),
        fetchWorkflowStatusTransitions(null, true),
        fetchWorkflowFormFieldConfigs(null, true),
      ]);
      setWorkflowStatusCatalogs(catalogRows || []);
      setWorkflowStatusTransitions(transitionRows || []);
      setWorkflowFormFieldConfigs(fieldRows || []);
    } catch (error) {
      console.error('Failed to load workflow config datasets', error);
    } finally {
      setIsWorkflowConfigLoading(false);
    }
  }, [canReadStatuses]);

  useEffect(() => {
    void loadWorkflowConfigs();
  }, [loadWorkflowConfigs]);

  const supportSlaWorkflowActionOptions = useMemo<SearchableSelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SearchableSelectOption[] = [];

    workflowStatusTransitions.forEach((transition) => {
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

  const workflowStatusCatalogParentOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: workflowStatusCatalogForm.level <= 1 ? 'Không áp dụng' : 'Chọn trạng thái cha' },
      ...workflowStatusCatalogs
        .filter((item) => Number(item.level || 0) === workflowStatusCatalogForm.level - 1)
        .map((item) => ({
          value: String(item.id),
          label: `${item.status_name || '--'} (${item.status_code || '--'})`,
        })),
    ];
  }, [workflowStatusCatalogForm.level, workflowStatusCatalogs]);

  const workflowStatusTransitionSourceOptions = useMemo<SearchableSelectOption[]>(() => {
    return workflowStatusCatalogs.map((item) => ({
      value: String(item.id),
      label: `${item.status_name || '--'} (${item.status_code || '--'})`,
    }));
  }, [workflowStatusCatalogs]);

  const workflowStatusTransitionTargetOptions = useMemo<SearchableSelectOption[]>(() => {
    return workflowStatusCatalogs
      .filter((item) => String(item.id) !== String(workflowStatusTransitionForm.from_status_catalog_id || ''))
      .map((item) => ({
        value: String(item.id),
        label: `${item.status_name || '--'} (${item.status_code || '--'})`,
      }));
  }, [workflowStatusCatalogs, workflowStatusTransitionForm.from_status_catalog_id]);

  const workflowFieldStatusOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = workflowStatusCatalogs
      .filter((item) => item.is_leaf !== false)
      .map((item) => ({
        value: String(item.id),
        label: `${item.status_name || '--'} (${item.status_code || '--'})`,
        searchText: `${item.status_code || ''} ${item.status_name || ''} ${item.canonical_status || ''} ${item.canonical_sub_status || ''}`.trim(),
      }));

    const selectedValue = String(workflowFormFieldConfigForm.status_catalog_id || '').trim();
    const hasSelectedOption = selectedValue !== '' && options.some((item) => String(item.value) === selectedValue);
    if (!hasSelectedOption && selectedValue !== '' && editingWorkflowFormFieldConfig?.status_name) {
      const fallbackLabel = String(editingWorkflowFormFieldConfig.status_name || '').trim();
      options.unshift({
        value: selectedValue,
        label: fallbackLabel || `#${selectedValue}`,
        searchText: fallbackLabel,
      });
    }

    return [
      { value: '', label: 'Chọn trạng thái workflow' },
      ...options,
    ];
  }, [
    editingWorkflowFormFieldConfig,
    workflowFormFieldConfigForm.status_catalog_id,
    workflowStatusCatalogs,
  ]);

  const filteredWorkflowStatusCatalogs = useMemo(() => {
    const keyword = normalizeToken(searchTerm);

    return workflowStatusCatalogs.filter((item) => {
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

    return workflowStatusTransitions.filter((item) => {
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

    return workflowFormFieldConfigs.filter((item) => {
      const isActive = item.is_active !== false;
      const matchesActivity =
        activityFilter === 'all' ? true : activityFilter === 'active' ? isActive : !isActive;
      const haystack = `${item.status_name || ''} ${item.field_key || ''} ${item.field_label || ''} ${item.field_type || ''} ${item.excel_column || ''}`;
      const matchesSearch = keyword ? normalizeToken(haystack).includes(keyword) : true;

      return matchesActivity && matchesSearch;
    });
  }, [workflowFormFieldConfigs, activityFilter, searchTerm]);

  const resetWorkflowConfigState = useCallback(() => {
    setEditingWorkflowStatusCatalog(null);
    setEditingWorkflowStatusTransition(null);
    setEditingWorkflowFormFieldConfig(null);
    setWorkflowStatusCatalogForm(defaultWorkflowStatusCatalogForm(nextWorkflowStatusCatalogSortOrder));
    setWorkflowStatusTransitionForm(defaultWorkflowStatusTransitionForm(nextWorkflowStatusTransitionSortOrder));
    setWorkflowFormFieldConfigForm(defaultWorkflowFormFieldConfigForm(nextWorkflowFormFieldConfigSortOrder));
  }, [
    nextWorkflowFormFieldConfigSortOrder,
    nextWorkflowStatusCatalogSortOrder,
    nextWorkflowStatusTransitionSortOrder,
  ]);

  const openWorkflowStatusCatalogAdd = useCallback(() => {
    setEditingWorkflowStatusCatalog(null);
    setWorkflowStatusCatalogForm(defaultWorkflowStatusCatalogForm(nextWorkflowStatusCatalogSortOrder));
  }, [nextWorkflowStatusCatalogSortOrder]);

  const openWorkflowStatusCatalogEdit = useCallback((item: WorkflowStatusCatalog) => {
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
  }, []);

  const openWorkflowStatusTransitionAdd = useCallback(() => {
    setEditingWorkflowStatusTransition(null);
    setWorkflowStatusTransitionForm(defaultWorkflowStatusTransitionForm(nextWorkflowStatusTransitionSortOrder));
  }, [nextWorkflowStatusTransitionSortOrder]);

  const openWorkflowStatusTransitionEdit = useCallback((item: WorkflowStatusTransition) => {
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
  }, []);

  const openWorkflowFormFieldConfigAdd = useCallback(() => {
    setEditingWorkflowFormFieldConfig(null);
    setWorkflowFormFieldConfigForm(defaultWorkflowFormFieldConfigForm(nextWorkflowFormFieldConfigSortOrder));
  }, [nextWorkflowFormFieldConfigSortOrder]);

  const openWorkflowFormFieldConfigEdit = useCallback((item: WorkflowFormFieldConfig) => {
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
  }, []);

  return {
    editingWorkflowStatusCatalog,
    editingWorkflowStatusTransition,
    editingWorkflowFormFieldConfig,
    workflowStatusCatalogForm,
    setWorkflowStatusCatalogForm,
    workflowStatusTransitionForm,
    setWorkflowStatusTransitionForm,
    workflowFormFieldConfigForm,
    setWorkflowFormFieldConfigForm,
    workflowStatusCatalogs,
    workflowStatusTransitions,
    workflowFormFieldConfigs,
    isWorkflowConfigLoading,
    supportSlaWorkflowActionOptions,
    workflowStatusCatalogParentOptions,
    workflowStatusTransitionSourceOptions,
    workflowStatusTransitionTargetOptions,
    workflowFieldStatusOptions,
    filteredWorkflowStatusCatalogs,
    filteredWorkflowStatusTransitions,
    filteredWorkflowFormFieldConfigs,
    loadWorkflowConfigs,
    resetWorkflowConfigState,
    openWorkflowStatusCatalogAdd,
    openWorkflowStatusCatalogEdit,
    openWorkflowStatusTransitionAdd,
    openWorkflowStatusTransitionEdit,
    openWorkflowFormFieldConfigAdd,
    openWorkflowFormFieldConfigEdit,
  };
};
