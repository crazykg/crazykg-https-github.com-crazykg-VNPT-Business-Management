import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SearchableSelectOption } from '../../SearchableSelect';

export type MasterType =
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

export type ActivityFilter = 'all' | 'active' | 'inactive';
export type FormMode = 'ADD' | 'EDIT';

interface UseSupportMasterShellStateArgs {
  canReadServiceGroups: boolean;
  canReadContactPositions: boolean;
  canReadStatuses: boolean;
  canReadProjectTypes: boolean;
  canReadWorklogActivityTypes: boolean;
  canReadSlaConfigs: boolean;
  canReadWorkCalendar: boolean;
  canWriteServiceGroups: boolean;
  canWriteContactPositions: boolean;
  canWriteStatuses: boolean;
  canWriteProjectTypes: boolean;
  canWriteWorklogActivityTypes: boolean;
  canWriteSlaConfigs: boolean;
  canWriteWorkCalendar: boolean;
}

interface UseSupportMasterShellStateResult {
  masterType: MasterType;
  setMasterType: Dispatch<SetStateAction<MasterType>>;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  activityFilter: ActivityFilter;
  setActivityFilter: Dispatch<SetStateAction<ActivityFilter>>;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: Dispatch<SetStateAction<number>>;
  formMode: FormMode | null;
  setFormMode: Dispatch<SetStateAction<FormMode | null>>;
  formError: string;
  setFormError: Dispatch<SetStateAction<string>>;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  masterOptions: SearchableSelectOption[];
  canWriteCurrentMaster: boolean;
}

export const useSupportMasterShellState = ({
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
}: UseSupportMasterShellStateArgs): UseSupportMasterShellStateResult => {
  const [masterType, setMasterType] = useState<MasterType>('group');
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const masterOptions = useMemo<SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = [];

    if (canReadServiceGroups) {
      options.push({ value: 'group', label: 'Nhóm Zalo/Tele' });
    }
    if (canReadContactPositions) {
      options.push({ value: 'contact_position', label: 'Danh mục chức vụ' });
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

  useEffect(() => {
    if (masterOptions.some((option) => option.value === masterType)) {
      return;
    }

    const fallback = masterOptions[0]?.value as MasterType | undefined;
    if (fallback) {
      setMasterType(fallback);
    }
  }, [masterOptions, masterType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [masterType, searchTerm, activityFilter, rowsPerPage]);

  return {
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
  };
};
