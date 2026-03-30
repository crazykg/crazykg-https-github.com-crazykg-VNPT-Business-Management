import React, { useEffect, useMemo } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import type { Customer } from '../types/customer';
import type { ProjectTypeOption } from '../types/project';
import type {
  SupportContactPosition,
  SupportRequestStatusOption,
  SupportServiceGroup,
  SupportSlaConfigOption,
  WorkflowFormFieldConfig,
  WorkflowStatusTransition,
  WorkflowStatusCatalog,
  WorklogActivityTypeOption,
} from '../types/support';
import {
  createWorkflowFormFieldConfig,
  createWorkflowStatusTransition,
  createWorkflowStatusCatalog,
  updateWorkflowFormFieldConfig,
  updateWorkflowStatusTransition,
  updateWorkflowStatusCatalog,
} from '../services/v5Api';
import { formatDateTimeDdMmYyyy } from '../utils/dateDisplay';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import {
  ServiceGroupFormFields,
  ServiceGroupManagement,
} from './support-master/ServiceGroupManagement';
import {
  ContactPositionFormFields,
  ContactPositionManagement,
} from './support-master/ContactPositionManagement';
import {
  RequestStatusFormFields,
  RequestStatusManagement,
} from './support-master/RequestStatusManagement';
import {
  WorklogActivityFormFields,
  WorklogActivityManagement,
} from './support-master/WorklogActivityManagement';
import {
  SlaConfigFormFields,
  SlaConfigManagement,
} from './support-master/SlaConfigManagement';
import {
  ProjectTypeFormFields,
  ProjectTypeManagement,
} from './support-master/ProjectTypeManagement';
import {
  WorkflowCatalogFormFields,
  WorkflowCatalogManagement,
} from './support-master/WorkflowCatalogManagement';
import {
  WorkflowTransitionFormFields,
  WorkflowTransitionManagement,
} from './support-master/WorkflowTransitionManagement';
import {
  WorkflowFieldConfigFormFields,
  WorkflowFieldConfigManagement,
} from './support-master/WorkflowFieldConfigManagement';
import {
  WorkCalendarEditPanel,
  WorkCalendarManagement,
} from './support-master/WorkCalendarManagement';
import {
  useSupportMasterShellState,
  type ActivityFilter,
  type MasterType,
} from './support-master/hooks/useSupportMasterShellState';
import { useSupportMasterNonWorkflowState } from './support-master/hooks/useSupportMasterNonWorkflowState';
import { useSupportMasterWorkCalendar } from './support-master/hooks/useSupportMasterWorkCalendar';
import { useSupportMasterWorkflowConfig } from './support-master/hooks/useSupportMasterWorkflowConfig';
import {
  getSupportMasterFormTitle,
  supportsSupportMasterAddAction,
  supportsSupportMasterFilters,
  supportsSupportMasterPagination,
} from './support-master/supportMasterShell';

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
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 50);

const normalizeMasterCodeInput = (value: string): string =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const resolveAuditActorLabel = (
  actorName?: string | null,
  actorId?: string | number | null
): string => {
  const normalizedName = String(actorName || '').trim();
  if (normalizedName) {
    return normalizedName;
  }

  const normalizedId = String(actorId ?? '').trim();
  return normalizedId ? `User #${normalizedId}` : 'Chưa ghi nhận';
};

const resolveAuditDateTimeLabel = (value?: string | null): string => {
  const formatted = formatDateTimeDdMmYyyy(value);
  return formatted === '--' ? 'Chưa ghi nhận' : formatted;
};

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
  const {
    masterType,
    setMasterType,
    searchTerm,
    setSearchTerm,
    activityFilter,
    setActivityFilter,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    formMode,
    setFormMode,
    formError,
    setFormError,
    isSubmitting,
    setIsSubmitting,
    masterOptions,
    canWriteCurrentMaster,
  } = useSupportMasterShellState({
    canReadServiceGroups,
    canReadContactPositions,
    canReadStatuses,
    canReadProjectTypes,
    canReadWorklogActivityTypes,
    canReadSlaConfigs,
    canReadWorkCalendar,
    canWriteServiceGroups,
    canWriteContactPositions,
    canWriteStatuses,
    canWriteProjectTypes,
    canWriteWorklogActivityTypes,
    canWriteSlaConfigs,
    canWriteWorkCalendar,
  });
  const {
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
    openWorkflowStatusCatalogAdd: hydrateWorkflowStatusCatalogAdd,
    openWorkflowStatusCatalogEdit: hydrateWorkflowStatusCatalogEdit,
    openWorkflowStatusTransitionAdd: hydrateWorkflowStatusTransitionAdd,
    openWorkflowStatusTransitionEdit: hydrateWorkflowStatusTransitionEdit,
    openWorkflowFormFieldConfigAdd: hydrateWorkflowFormFieldConfigAdd,
    openWorkflowFormFieldConfigEdit: hydrateWorkflowFormFieldConfigEdit,
  } = useSupportMasterWorkflowConfig({
    canReadStatuses,
    activityFilter,
    searchTerm,
  });
  const {
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
    openGroupAdd: hydrateGroupAdd,
    openGroupEdit: hydrateGroupEdit,
    openContactPositionAdd: hydrateContactPositionAdd,
    openContactPositionEdit: hydrateContactPositionEdit,
    openStatusAdd: hydrateStatusAdd,
    openStatusEdit: hydrateStatusEdit,
    openProjectTypeAdd: hydrateProjectTypeAdd,
    openProjectTypeEdit: hydrateProjectTypeEdit,
    openWorklogActivityTypeAdd: hydrateWorklogActivityTypeAdd,
    openWorklogActivityTypeEdit: hydrateWorklogActivityTypeEdit,
    openSupportSlaConfigAdd: hydrateSupportSlaConfigAdd,
    openSupportSlaConfigEdit: hydrateSupportSlaConfigEdit,
    statusCodeEditable,
    contactPositionCodeEditable,
    projectTypeCodeEditable,
    worklogActivityTypeCodeEditable,
    supportSlaStatusEditable,
  } = useSupportMasterNonWorkflowState({
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
  });
  const {
    calendarYear,
    setCalendarYear,
    calendarMonth,
    setCalendarMonth,
    calendarDays,
    isCalendarLoading,
    calendarError,
    isCalendarSaving,
    editingCalendarDay,
    calendarDayForm,
    setCalendarDayForm,
    calendarGenerationYear,
    setCalendarGenerationYear,
    isCalendarGenerating,
    calendarGenerationMessage,
    openCalendarDay,
    closeCalendarDay,
    saveCalendarDay,
    generateCalendarForYear,
  } = useSupportMasterWorkCalendar({
    enabled: masterType === 'work_calendar',
    canReadWorkCalendar,
  });
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
            : masterType === 'workflow_form_field_config'
                ? filteredWorkflowFormFieldConfigs.length
                : calendarDays.length;
  const showMasterFilters = supportsSupportMasterFilters(masterType);
  const showPaginationControls = supportsSupportMasterPagination(masterType);
  const canOpenAddForm = supportsSupportMasterAddAction(masterType) && canWriteCurrentMaster;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, setCurrentPage, totalPages]);

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
    resetNonWorkflowState();
    resetWorkflowConfigState();
    setFormError('');
    setIsSubmitting(false);
  };

  useEscKey(closeForm, formMode !== null);

  const handleOpenAdd = () => {
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
    if (masterType === 'workflow_form_field_config') {
      openWorkflowFormFieldConfigAdd();
    }
  };

  const openGroupAdd = () => {
    setFormMode('ADD');
    hydrateGroupAdd();
    setFormError('');
  };

  const openContactPositionAdd = () => {
    setFormMode('ADD');
    hydrateContactPositionAdd();
    setFormError('');
  };

  const openContactPositionEdit = (position: SupportContactPosition) => {
    setFormMode('EDIT');
    hydrateContactPositionEdit(position);
    setFormError('');
  };

  const openGroupEdit = (group: SupportServiceGroup) => {
    setFormMode('EDIT');
    hydrateGroupEdit(group);
    setFormError('');
  };

  const openStatusAdd = () => {
    setFormMode('ADD');
    hydrateStatusAdd();
    setFormError('');
  };

  const openStatusEdit = (status: SupportRequestStatusOption) => {
    setFormMode('EDIT');
    hydrateStatusEdit(status);
    setFormError('');
  };

  const openProjectTypeAdd = () => {
    setFormMode('ADD');
    hydrateProjectTypeAdd();
    setFormError('');
  };

  const openProjectTypeEdit = (item: ProjectTypeOption) => {
    setFormMode('EDIT');
    hydrateProjectTypeEdit(item);
    setFormError('');
  };

  const openWorklogActivityTypeAdd = () => {
    setFormMode('ADD');
    hydrateWorklogActivityTypeAdd();
    setFormError('');
  };

  const openWorklogActivityTypeEdit = (item: WorklogActivityTypeOption) => {
    setFormMode('EDIT');
    hydrateWorklogActivityTypeEdit(item);
    setFormError('');
  };

  const openSupportSlaConfigAdd = () => {
    setFormMode('ADD');
    hydrateSupportSlaConfigAdd();
    setFormError('');
  };

  const openSupportSlaConfigEdit = (item: SupportSlaConfigOption) => {
    setFormMode('EDIT');
    hydrateSupportSlaConfigEdit(item);
    setFormError('');
  };

  const openWorkflowStatusCatalogAdd = () => {
    setFormMode('ADD');
    hydrateWorkflowStatusCatalogAdd();
    setFormError('');
  };

  const openWorkflowStatusCatalogEdit = (item: WorkflowStatusCatalog) => {
    setFormMode('EDIT');
    hydrateWorkflowStatusCatalogEdit(item);
    setFormError('');
  };

  const openWorkflowStatusTransitionAdd = () => {
    setFormMode('ADD');
    hydrateWorkflowStatusTransitionAdd();
    setFormError('');
  };

  const openWorkflowStatusTransitionEdit = (item: WorkflowStatusTransition) => {
    setFormMode('EDIT');
    hydrateWorkflowStatusTransitionEdit(item);
    setFormError('');
  };

  const openWorkflowFormFieldConfigAdd = () => {
    setFormMode('ADD');
    hydrateWorkflowFormFieldConfigAdd();
    setFormError('');
  };

  const openWorkflowFormFieldConfigEdit = (item: WorkflowFormFieldConfig) => {
    setFormMode('EDIT');
    hydrateWorkflowFormFieldConfigEdit(item);
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

  return (
    <div
      className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl"
      style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}
    >
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý danh mục hỗ trợ</h2>
          <p className="text-slate-600 text-sm mt-1">
            Quản trị Nhóm Zalo/Tele, Danh mục chức vụ đầu mối liên hệ, trạng thái hỗ trợ, workflow trạng thái/field schema, SLA và giai đoạn cơ hội.
          </p>
        </div>
        {supportsSupportMasterAddAction(masterType) && (
          <button
            type="button"
            disabled={!canOpenAddForm}
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        )}
      </header>

      <div className="bg-white/95 p-4 md:p-5 rounded-xl border border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
        {showMasterFilters ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_1fr] gap-3 items-start">
            <SearchableSelect
              value={masterType}
              onChange={(value) => setMasterType(value as MasterType)}
              options={masterOptions}
              placeholder="Chọn danh mục"
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
              Lịch làm việc dùng bộ điều khiển năm/tháng riêng trong khu vực nội dung, nên không áp dụng tìm kiếm, lọc trạng thái hay phân trang chuẩn.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          {masterType === 'group' ? (
            <ServiceGroupManagement
              items={pagedGroups}
              canWriteServiceGroups={canWriteServiceGroups}
              onEdit={openGroupEdit}
            />
          ) : masterType === 'contact_position' ? (
            <ContactPositionManagement
              items={pagedContactPositions}
              safePage={safePage}
              rowsPerPage={rowsPerPage}
              canWriteContactPositions={canWriteContactPositions}
              onEdit={openContactPositionEdit}
              resolveAuditActorLabel={resolveAuditActorLabel}
              resolveAuditDateTimeLabel={resolveAuditDateTimeLabel}
            />
          ) : masterType === 'status' ? (
            <RequestStatusManagement
              items={pagedStatuses}
              canWriteStatuses={canWriteStatuses}
              onEdit={openStatusEdit}
            />
          ) : masterType === 'project_type' ? (
            <ProjectTypeManagement
              items={pagedProjectTypes}
              canWriteProjectTypes={canWriteProjectTypes}
              onEdit={openProjectTypeEdit}
            />
          ) : masterType === 'worklog_activity_type' ? (
            <WorklogActivityManagement
              items={pagedWorklogActivityTypes}
              canWriteWorklogActivityTypes={canWriteWorklogActivityTypes}
              onEdit={openWorklogActivityTypeEdit}
            />
          ) : masterType === 'sla_config' ? (
            <SlaConfigManagement
              items={pagedSupportSlaConfigs}
              canWriteSlaConfigs={canWriteSlaConfigs}
              onEdit={openSupportSlaConfigEdit}
            />
          ) : masterType === 'workflow_status_catalog' ? (
            <WorkflowCatalogManagement
              items={pagedWorkflowStatusCatalogs}
              isLoading={isWorkflowConfigLoading}
              canWriteStatuses={canWriteStatuses}
              onEdit={openWorkflowStatusCatalogEdit}
            />
          ) : masterType === 'workflow_status_transition' ? (
            <WorkflowTransitionManagement
              items={pagedWorkflowStatusTransitions}
              isLoading={isWorkflowConfigLoading}
              canWriteStatuses={canWriteStatuses}
              onEdit={openWorkflowStatusTransitionEdit}
            />
          ) : masterType === 'workflow_form_field_config' ? (
            <WorkflowFieldConfigManagement
              items={pagedWorkflowFormFieldConfigs}
              isLoading={isWorkflowConfigLoading}
              canWriteStatuses={canWriteStatuses}
              onEdit={openWorkflowFormFieldConfigEdit}
            />
          ) : (
            <WorkCalendarManagement
              calendarYear={calendarYear}
              calendarMonth={calendarMonth}
              calendarGenerationYear={calendarGenerationYear}
              calendarGenerationMessage={calendarGenerationMessage}
              calendarDays={calendarDays}
              canWriteWorkCalendar={canWriteWorkCalendar}
              isCalendarLoading={isCalendarLoading}
              isCalendarGenerating={isCalendarGenerating}
              calendarError={calendarError}
              editingCalendarDay={editingCalendarDay}
              onCalendarYearChange={setCalendarYear}
              onCalendarMonthChange={setCalendarMonth}
              onCalendarGenerationYearChange={setCalendarGenerationYear}
              onGenerateCalendar={generateCalendarForYear}
              onSelectCalendarDay={openCalendarDay}
            />
          )}
        </div>

        {showPaginationControls && (
          <PaginationControls
            currentPage={safePage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
          />
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45" onClick={closeForm}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <h3 className="text-lg font-bold text-slate-900">
                {masterType === 'work_calendar'
                  ? 'Lịch làm việc'
                  : getSupportMasterFormTitle(masterType, formMode)}
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
                <ServiceGroupFormFields
                  customerId={groupForm.customer_id}
                  groupCode={groupForm.group_code}
                  groupName={groupForm.group_name}
                  workflowStatusCatalogId={groupForm.workflow_status_catalog_id}
                  workflowFormKey={groupForm.workflow_form_key}
                  description={groupForm.description}
                  isActive={groupForm.is_active}
                  customerOptions={customerOptions}
                  customerSelectDisabled={customerSelectDisabled}
                  customerSelectError={customerSelectError}
                  workflowStatusCatalogOptions={workflowStatusCatalogOptions}
                  workflowFormKeyOptions={workflowFormKeyOptions}
                  onCustomerChange={(value) => setGroupForm((prev) => ({ ...prev, customer_id: value }))}
                  onGroupCodeChange={(value) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      group_code: normalizeGroupCodeInput(value),
                    }))
                  }
                  onGroupNameChange={(value) => setGroupForm((prev) => ({ ...prev, group_name: value }))}
                  onWorkflowStatusCatalogChange={(value) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      workflow_status_catalog_id: value,
                    }))
                  }
                  onWorkflowFormKeyChange={(value) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      workflow_form_key: value,
                    }))
                  }
                  onDescriptionChange={(value) =>
                    setGroupForm((prev) => ({ ...prev, description: value }))
                  }
                  onIsActiveChange={(checked) =>
                    setGroupForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              ) : masterType === 'contact_position' ? (
                <ContactPositionFormFields
                  positionCode={contactPositionForm.position_code}
                  positionName={contactPositionForm.position_name}
                  description={contactPositionForm.description}
                  isActive={contactPositionForm.is_active}
                  isCodeEditable={contactPositionCodeEditable}
                  onPositionCodeChange={(value) =>
                    setContactPositionForm((prev) => ({
                      ...prev,
                      position_code: normalizeContactPositionCodeInput(value),
                    }))
                  }
                  onPositionNameChange={(value) =>
                    setContactPositionForm((prev) => ({ ...prev, position_name: value }))
                  }
                  onDescriptionChange={(value) =>
                    setContactPositionForm((prev) => ({ ...prev, description: value }))
                  }
                  onIsActiveChange={(checked) =>
                    setContactPositionForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              ) : masterType === 'status' ? (
                <RequestStatusFormFields
                  statusCode={statusForm.status_code}
                  statusName={statusForm.status_name}
                  description={statusForm.description}
                  requiresCompletionDates={statusForm.requires_completion_dates}
                  isTransferDev={statusForm.is_transfer_dev}
                  isTerminal={statusForm.is_terminal}
                  isActive={statusForm.is_active}
                  sortOrder={statusForm.sort_order}
                  isCodeEditable={statusCodeEditable}
                  onStatusCodeChange={(value) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      status_code: normalizeStatusCodeInput(value),
                    }))
                  }
                  onStatusNameChange={(value) =>
                    setStatusForm((prev) => ({ ...prev, status_name: value }))
                  }
                  onDescriptionChange={(value) =>
                    setStatusForm((prev) => ({ ...prev, description: value }))
                  }
                  onRequiresCompletionDatesChange={(checked) =>
                    setStatusForm((prev) => ({ ...prev, requires_completion_dates: checked }))
                  }
                  onIsTransferDevChange={(checked) =>
                    setStatusForm((prev) => ({ ...prev, is_transfer_dev: checked }))
                  }
                  onIsTerminalChange={(checked) =>
                    setStatusForm((prev) => ({ ...prev, is_terminal: checked }))
                  }
                  onIsActiveChange={(checked) =>
                    setStatusForm((prev) => ({ ...prev, is_active: checked }))
                  }
                  onSortOrderChange={(value) =>
                    setStatusForm((prev) => ({ ...prev, sort_order: value }))
                  }
                />
	              ) : masterType === 'project_type' ? (
	                <ProjectTypeFormFields
                    typeCode={projectTypeForm.type_code}
                    typeName={projectTypeForm.type_name}
                    description={projectTypeForm.description}
                    isActive={projectTypeForm.is_active}
                    sortOrder={projectTypeForm.sort_order}
                    isCodeEditable={projectTypeCodeEditable}
                    onTypeCodeChange={(value) =>
                      setProjectTypeForm((prev) => ({
                        ...prev,
                        type_code: normalizeProjectTypeCodeDraftInput(value),
                      }))
                    }
                    onTypeCodeBlur={() =>
                      setProjectTypeForm((prev) => ({
                        ...prev,
                        type_code: normalizeProjectTypeCodeInput(prev.type_code),
                      }))
                    }
                    onTypeNameChange={(value) =>
                      setProjectTypeForm((prev) => ({ ...prev, type_name: value }))
                    }
                    onDescriptionChange={(value) =>
                      setProjectTypeForm((prev) => ({ ...prev, description: value }))
                    }
                    onIsActiveChange={(checked) =>
                      setProjectTypeForm((prev) => ({ ...prev, is_active: checked }))
                    }
                    onSortOrderChange={(value) =>
                      setProjectTypeForm((prev) => ({ ...prev, sort_order: value }))
                    }
                  />
                ) : masterType === 'worklog_activity_type' ? (
                  <WorklogActivityFormFields
                    code={worklogActivityTypeForm.code}
                    name={worklogActivityTypeForm.name}
                    phaseHint={worklogActivityTypeForm.phase_hint}
                    sortOrder={worklogActivityTypeForm.sort_order}
                    description={worklogActivityTypeForm.description}
                    defaultIsBillable={worklogActivityTypeForm.default_is_billable}
                    isActive={worklogActivityTypeForm.is_active}
                    isCodeEditable={worklogActivityTypeCodeEditable}
                    onCodeChange={(value) =>
                      setWorklogActivityTypeForm((prev) => ({
                        ...prev,
                        code: normalizeMasterCodeInput(value),
                      }))
                    }
                    onNameChange={(value) =>
                      setWorklogActivityTypeForm((prev) => ({ ...prev, name: value }))
                    }
                    onPhaseHintChange={(value) =>
                      setWorklogActivityTypeForm((prev) => ({
                        ...prev,
                        phase_hint: String(value || ''),
                      }))
                    }
                    onSortOrderChange={(value) =>
                      setWorklogActivityTypeForm((prev) => ({
                        ...prev,
                        sort_order: value,
                      }))
                    }
                    onDescriptionChange={(value) =>
                      setWorklogActivityTypeForm((prev) => ({ ...prev, description: value }))
                    }
                    onDefaultIsBillableChange={(checked) =>
                      setWorklogActivityTypeForm((prev) => ({
                        ...prev,
                        default_is_billable: checked,
                      }))
                    }
                    onIsActiveChange={(checked) =>
                      setWorklogActivityTypeForm((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                ) : masterType === 'sla_config' ? (
                  <SlaConfigFormFields
                    status={supportSlaConfigForm.status}
                    subStatus={supportSlaConfigForm.sub_status}
                    priority={supportSlaConfigForm.priority}
                    slaHours={supportSlaConfigForm.sla_hours}
                    requestTypePrefix={supportSlaConfigForm.request_type_prefix}
                    serviceGroupId={supportSlaConfigForm.service_group_id}
                    workflowActionCode={supportSlaConfigForm.workflow_action_code}
                    description={supportSlaConfigForm.description}
                    sortOrder={supportSlaConfigForm.sort_order}
                    isActive={supportSlaConfigForm.is_active}
                    isStatusEditable={supportSlaStatusEditable}
                    serviceGroupOptions={supportSlaServiceGroupOptions}
                    workflowActionOptions={supportSlaWorkflowActionOptions}
                    onStatusChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({
                        ...prev,
                        status: normalizeMasterCodeInput(value),
                      }))
                    }
                    onSubStatusChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({
                        ...prev,
                        sub_status: normalizeMasterCodeInput(value),
                      }))
                    }
                    onPriorityChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({ ...prev, priority: value }))
                    }
                    onSlaHoursChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({ ...prev, sla_hours: value }))
                    }
                    onRequestTypePrefixChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({
                        ...prev,
                        request_type_prefix: normalizeMasterCodeInput(value),
                      }))
                    }
                    onServiceGroupChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({
                        ...prev,
                        service_group_id: String(value || ''),
                      }))
                    }
                    onWorkflowActionCodeChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({
                        ...prev,
                        workflow_action_code: normalizeMasterCodeInput(String(value || '')),
                      }))
                    }
                    onSortOrderChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({ ...prev, sort_order: value }))
                    }
                    onDescriptionChange={(value) =>
                      setSupportSlaConfigForm((prev) => ({ ...prev, description: value }))
                    }
                    onIsActiveChange={(checked) =>
                      setSupportSlaConfigForm((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                ) : masterType === 'workflow_status_catalog' ? (
                  <WorkflowCatalogFormFields
                    level={workflowStatusCatalogForm.level}
                    parentId={workflowStatusCatalogForm.parent_id}
                    statusCode={workflowStatusCatalogForm.status_code}
                    statusName={workflowStatusCatalogForm.status_name}
                    canonicalStatus={workflowStatusCatalogForm.canonical_status}
                    canonicalSubStatus={workflowStatusCatalogForm.canonical_sub_status}
                    flowStep={workflowStatusCatalogForm.flow_step}
                    formKey={workflowStatusCatalogForm.form_key}
                    sortOrder={workflowStatusCatalogForm.sort_order}
                    isLeaf={workflowStatusCatalogForm.is_leaf}
                    isActive={workflowStatusCatalogForm.is_active}
                    parentOptions={workflowStatusCatalogParentOptions}
                    onLevelChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        level: value,
                        parent_id: value > 1 ? prev.parent_id : '',
                      }))
                    }
                    onParentChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        parent_id: String(value || ''),
                      }))
                    }
                    onStatusCodeChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        status_code: normalizeMasterCodeInput(value),
                      }))
                    }
                    onStatusNameChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        status_name: value,
                      }))
                    }
                    onCanonicalStatusChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        canonical_status: normalizeMasterCodeInput(value),
                      }))
                    }
                    onCanonicalSubStatusChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        canonical_sub_status: normalizeMasterCodeInput(value),
                      }))
                    }
                    onFlowStepChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        flow_step: normalizeMasterCodeInput(value),
                      }))
                    }
                    onFormKeyChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        form_key: value,
                      }))
                    }
                    onSortOrderChange={(value) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        sort_order: value,
                      }))
                    }
                    onIsLeafChange={(checked) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        is_leaf: checked,
                      }))
                    }
                    onIsActiveChange={(checked) =>
                      setWorkflowStatusCatalogForm((prev) => ({
                        ...prev,
                        is_active: checked,
                      }))
                    }
                  />
                ) : masterType === 'workflow_status_transition' ? (
                  <WorkflowTransitionFormFields
                    fromStatusCatalogId={workflowStatusTransitionForm.from_status_catalog_id}
                    toStatusCatalogId={workflowStatusTransitionForm.to_status_catalog_id}
                    actionCode={workflowStatusTransitionForm.action_code}
                    actionName={workflowStatusTransitionForm.action_name}
                    requiredRole={workflowStatusTransitionForm.required_role}
                    notifyTargetsText={workflowStatusTransitionForm.notify_targets_text}
                    sortOrder={workflowStatusTransitionForm.sort_order}
                    isActive={workflowStatusTransitionForm.is_active}
                    conditionJsonText={workflowStatusTransitionForm.condition_json_text}
                    fromStatusOptions={workflowStatusTransitionSourceOptions}
                    toStatusOptions={workflowStatusTransitionTargetOptions}
                    onFromStatusChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        from_status_catalog_id: String(value || ''),
                      }))
                    }
                    onToStatusChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        to_status_catalog_id: String(value || ''),
                      }))
                    }
                    onActionCodeChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        action_code: normalizeMasterCodeInput(value),
                      }))
                    }
                    onActionNameChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        action_name: value,
                      }))
                    }
                    onRequiredRoleChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        required_role: String(value || ''),
                      }))
                    }
                    onNotifyTargetsChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        notify_targets_text: value,
                      }))
                    }
                    onSortOrderChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        sort_order: value,
                      }))
                    }
                    onIsActiveChange={(checked) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        is_active: checked,
                      }))
                    }
                    onConditionJsonChange={(value) =>
                      setWorkflowStatusTransitionForm((prev) => ({
                        ...prev,
                        condition_json_text: value,
                      }))
                    }
                  />
                ) : (
                  <WorkflowFieldConfigFormFields
                    statusCatalogId={workflowFormFieldConfigForm.status_catalog_id}
                    fieldKey={workflowFormFieldConfigForm.field_key}
                    fieldLabel={workflowFormFieldConfigForm.field_label}
                    fieldType={workflowFormFieldConfigForm.field_type}
                    excelColumn={workflowFormFieldConfigForm.excel_column}
                    sortOrder={workflowFormFieldConfigForm.sort_order}
                    optionsJsonText={workflowFormFieldConfigForm.options_json_text}
                    required={workflowFormFieldConfigForm.required}
                    isActive={workflowFormFieldConfigForm.is_active}
                    statusOptions={workflowFieldStatusOptions}
                    onStatusCatalogChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        status_catalog_id: String(value || ''),
                      }))
                    }
                    onFieldKeyChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        field_key: normalizeMasterCodeInput(value),
                      }))
                    }
                    onFieldLabelChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        field_label: value,
                      }))
                    }
                    onFieldTypeChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        field_type: String(value || 'text'),
                      }))
                    }
                    onExcelColumnChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        excel_column: normalizeMasterCodeInput(value).slice(0, 5),
                      }))
                    }
                    onSortOrderChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        sort_order: value,
                      }))
                    }
                    onOptionsJsonChange={(value) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        options_json_text: value,
                      }))
                    }
                    onRequiredChange={(checked) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        required: checked,
                      }))
                    }
                    onIsActiveChange={(checked) =>
                      setWorkflowFormFieldConfigForm((prev) => ({
                        ...prev,
                        is_active: checked,
                      }))
                    }
                  />
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

      <WorkCalendarEditPanel
        editingCalendarDay={editingCalendarDay}
        calendarDayForm={calendarDayForm}
        canWriteWorkCalendar={canWriteWorkCalendar}
        isCalendarSaving={isCalendarSaving}
        calendarError={calendarError}
        onCalendarDayFormChange={(updater) => setCalendarDayForm(updater)}
        onClose={closeCalendarDay}
        onSave={saveCalendarDay}
      />
    </div>
  );
};
