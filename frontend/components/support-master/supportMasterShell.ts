import type { FormMode, MasterType } from './hooks/useSupportMasterShellState';

export const isWorkCalendarMasterType = (masterType: MasterType): boolean => masterType === 'work_calendar';

export const supportsSupportMasterAddAction = (masterType: MasterType): boolean =>
  !isWorkCalendarMasterType(masterType);

export const supportsSupportMasterFilters = (masterType: MasterType): boolean =>
  !isWorkCalendarMasterType(masterType);

export const supportsSupportMasterPagination = (masterType: MasterType): boolean =>
  !isWorkCalendarMasterType(masterType);

export const getSupportMasterFormTitle = (
  masterType: Exclude<MasterType, 'work_calendar'>,
  formMode: FormMode
): string => {
  const isAddMode = formMode === 'ADD';

  switch (masterType) {
    case 'group':
      return isAddMode ? 'Thêm nhóm Zalo/Tele' : 'Cập nhật nhóm Zalo/Tele';
    case 'contact_position':
      return isAddMode ? 'Thêm danh mục chức vụ' : 'Cập nhật danh mục chức vụ';
    case 'status':
      return isAddMode ? 'Thêm trạng thái hỗ trợ' : 'Cập nhật trạng thái hỗ trợ';
    case 'project_type':
      return isAddMode ? 'Thêm loại dự án' : 'Cập nhật loại dự án';
    case 'worklog_activity_type':
      return isAddMode ? 'Thêm loại công việc worklog' : 'Cập nhật loại công việc worklog';
    case 'sla_config':
      return isAddMode ? 'Thêm cấu hình SLA hỗ trợ' : 'Cập nhật cấu hình SLA hỗ trợ';
    case 'workflow_status_catalog':
      return isAddMode ? 'Thêm trạng thái workflow phân cấp' : 'Cập nhật trạng thái workflow phân cấp';
    case 'workflow_status_transition':
      return isAddMode ? 'Thêm transition workflow' : 'Cập nhật transition workflow';
    case 'workflow_form_field_config':
      return isAddMode ? 'Thêm schema field workflow' : 'Cập nhật schema field workflow';
  }
};
