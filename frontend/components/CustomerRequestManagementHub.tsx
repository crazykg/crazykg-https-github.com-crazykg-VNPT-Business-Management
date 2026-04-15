import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createYeuCau,
  createYeuCauEstimate,
  deleteYeuCau,
  saveYeuCauCaseTags,
  saveYeuCauProcess,
  fetchCustomerRequestIntakeTemplate,
  fetchCustomerRequestProjectItems,
  fetchProjectRaciAssignments,
  fetchYeuCau,
  fetchYeuCauProcessCatalog,
  exportCustomerRequestIntake,
  importCustomerRequestIntake,
  isRequestCanceledError,
  storeYeuCauDetailStatusWorklog,
  storeYeuCauWorklog,
  updateYeuCauWorklog,
  uploadDocumentAttachment,
} from '../services/v5Api';
import type {
  Attachment,
  Customer,
  CustomerPersonnel,
  Employee,
  ProjectItemMaster,
  ProjectRaciRow,
  SupportServiceGroup,
  Tag,
  YeuCau,
  YeuCauEstimate,
  YeuCauHoursReport,
  YeuCauProcessCatalog,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauWorklog,
} from '../types';
import { useCustomerRequestList } from './customer-request/hooks/useCustomerRequestList';
import { useCustomerRequestDashboard } from './customer-request/hooks/useCustomerRequestDashboard';
import { useCustomerRequestDetail } from './customer-request/hooks/useCustomerRequestDetail';
import { useCustomerRequestCreatorWorkspace } from './customer-request/hooks/useCustomerRequestCreatorWorkspace';
import { useCustomerRequestDispatcherWorkspace } from './customer-request/hooks/useCustomerRequestDispatcherWorkspace';
import { useCustomerRequestOptimisticState } from './customer-request/hooks/useCustomerRequestOptimisticState';
import { useCustomerRequestPerformerWorkspace } from './customer-request/hooks/useCustomerRequestPerformerWorkspace';
import { useCustomerRequestTransition } from './customer-request/hooks/useCustomerRequestTransition';
import { useCustomerRequestSearch } from './customer-request/hooks/useCustomerRequestSearch';
import { useCustomerRequestResponsiveLayout } from './customer-request/hooks/useCustomerRequestResponsiveLayout';
import { useWorkflowDefinitions } from './customer-request/hooks/useWorkflowDefinitions';
import { CustomerRequestListPane } from './customer-request/CustomerRequestListPane';
import { CustomerRequestDetailPane } from './customer-request/CustomerRequestDetailPane';
import { CustomerRequestCreatorWorkspace } from './customer-request/CustomerRequestCreatorWorkspace';
import { CustomerRequestDispatcherWorkspace } from './customer-request/CustomerRequestDispatcherWorkspace';
import { CustomerRequestPerformerWorkspace } from './customer-request/CustomerRequestPerformerWorkspace';
import { CustomerRequestOverviewWorkspace } from './customer-request/CustomerRequestOverviewWorkspace';
import { CustomerRequestWorkspaceTabs } from './customer-request/CustomerRequestWorkspaceTabs';
import type { WorkspaceTabKey } from './customer-request/CustomerRequestWorkspaceTabs';
import { CustomerRequestSurfaceSwitch, type CustomerRequestSurfaceKey } from './customer-request/CustomerRequestSurfaceSwitch';
import { CustomerRequestDashboardCards } from './customer-request/CustomerRequestDashboardCards';
import { CustomerRequestQuickAccessBar } from './customer-request/CustomerRequestQuickAccessBar';
import { CustomerRequestDetailFrame } from './customer-request/CustomerRequestDetailFrame';
import { CustomerRequestTransitionModal } from './customer-request/CustomerRequestTransitionModal';
import { CustomerRequestCreateModal } from './customer-request/CustomerRequestCreateModal';
import {
  CustomerRequestEstimateModal,
  type CustomerRequestEstimateSubmission,
} from './customer-request/CustomerRequestEstimateModal';
import type { CustomerRequestCreateFlowDraft } from './customer-request/createFlow';
import {
  CustomerRequestWorklogModal,
  type CustomerRequestWorklogModalContext,
  type CustomerRequestWorklogSubmission,
} from './customer-request/CustomerRequestWorklogModal';
import {
  buildInitialCreateFlowDraft,
  resolveCreateRequestPlan,
} from './customer-request/createFlow';
import type {
  CustomerRequestPrimaryActionMeta,
  CustomerRequestRoleFilter,
  CustomerRequestTaskSource,
  DispatcherQuickAction,
  It360TaskFormRow,
  PerformerQuickAction,
  ReferenceTaskFormRow,
} from './customer-request/presentation';
import {
  filterXmlVisibleProcesses,
  isXmlVisibleProcessCode,
  resolveRequestProcessCode,
  resolveTransitionOptionsForRequest,
} from './customer-request/presentation';
import {
  applyHoursReportToRequest,
  buildOptimisticEstimateHoursReport,
  prependUniqueEstimate,
  prependUniqueWorklog,
} from './customer-request/hoursOptimistic';
import { buildPayloadFromDraft } from './customer-request/helpers';
import {
  buildDispatcherQuickActions,
  buildPerformerQuickActions,
} from './customer-request/quickActions';
import {
  DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS,
  type CustomerRequestQuickRequestItem,
  type CustomerRequestSavedView,
} from './customer-request/customerRequestQuickAccess';
import { useCustomerRequestQuickAccess } from './customer-request/hooks/useCustomerRequestQuickAccess';
import { ImportModal } from './modals';
import type { ImportPayload } from './modals/projectImportTypes';
import ExcelJS from 'exceljs';
import {
  buildHeaderIndex,
  exportImportFailureFile,
  getImportCell,
} from '../utils/importValidation';
import type { SearchableSelectOption } from './SearchableSelect';
import type { CustomerRequestIntakeImportResult } from '../services/api/customerRequestApi';
import { normalizeImportToken } from '../utils/importUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CustomerRequestManagementHubProps {
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projectItems: ProjectItemMaster[];
  employees: Employee[];
  supportServiceGroups: SupportServiceGroup[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canReadRequests?: boolean;
  canWriteRequests?: boolean;
  canDeleteRequests?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  onNotify?: (type: ToastType, title: string, message: string) => void;
}

const workspaceTabToRoleFilter = (
  tab: WorkspaceTabKey
): CustomerRequestRoleFilter => (tab === 'overview' ? '' : tab);

const readCustomerRequestWindowScrollY = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Math.max(
    window.scrollY ?? 0,
    window.pageYOffset ?? 0,
    document.documentElement?.scrollTop ?? 0,
    document.body?.scrollTop ?? 0
  );
};

const CRC_INTAKE_HEADER_ALIASES: Record<string, string[]> = {
  import_row_code: ['import_row_code', 'importrowcode', 'ma_dong_import', 'madongimport'],
  customer_code: ['customer_code', 'customercode', 'ma_khach_hang', 'makhachhang'],
  project_item_code: [
    'project_item_code',
    'projectitemcode',
    'ma_hang_muc',
    'mahangmuc',
    'ma_hang_muc_du_an_san_pham',
    'mahangmucduansanpham',
  ],
  customer_personnel_code: [
    'customer_personnel_code',
    'customerpersonnelcode',
    'ma_nhan_su_lien_he',
    'manhansulienhe',
    'ma_nhan_su_lien_he_khach_hang',
    'manhansulienhekhachhang',
  ],
  support_service_group_code: ['support_service_group_code', 'supportservicegroupcode', 'ma_nhom_ho_tro', 'manhomhotro'],
  source_channel: ['source_channel', 'sourcechannel', 'kenh_tiep_nhan', 'kenhtiepnhan'],
  summary: ['summary', 'tieu_de', 'tieude', 'tieu_de_yeu_cau', 'tieudeyeucau'],
  description: ['description', 'mo_ta', 'mota', 'mo_ta_yeu_cau', 'motayeucau'],
  priority_label: ['priority_label', 'prioritylabel', 'do_uu_tien', 'douutien'],
  receiver_user_code: ['receiver_user_code', 'receiverusercode', 'nguoi_tiep_nhan', 'nguoitiepnhan', 'ma_nguoi_tiep_nhan', 'manguoitiepnhan'],
  creator_user_code: ['creator_user_code', 'creatorusercode', 'nguoi_tao', 'nguoitao', 'ma_nguoi_tao', 'manguoitao'],
};

const CRC_INTAKE_TASK_HEADER_ALIASES: Record<string, string[]> = {
  import_row_code: ['import_row_code', 'importrowcode', 'ma_dong_import', 'madongimport'],
  task_source: ['task_source', 'tasksource', 'nguon_task', 'nguontask'],
  task_code: ['task_code', 'taskcode', 'ma_task', 'matask'],
  task_link: ['task_link', 'tasklink', 'link_task', 'linktask'],
  task_status: ['task_status', 'taskstatus', 'trang_thai_task', 'trangthaitask'],
};

const CRC_INTAKE_HEADER_LABELS: Record<string, string> = {
  import_row_code: 'Mã dòng import',
  customer_code: 'Mã khách hàng',
  project_item_code: 'Mã hạng mục dự án/sản phẩm',
  customer_personnel_code: 'Mã nhân sự liên hệ khách hàng',
  support_service_group_code: 'Mã nhóm hỗ trợ',
  source_channel: 'Kênh tiếp nhận',
  summary: 'Tiêu đề yêu cầu',
  description: 'Mô tả yêu cầu',
  priority_label: 'Độ ưu tiên',
  receiver_user_code: 'Mã người tiếp nhận',
  creator_user_code: 'Mã người tạo',
};

const CRC_INTAKE_TASK_HEADER_LABELS: Record<string, string> = {
  import_row_code: 'Mã dòng import',
  task_source: 'Nguồn task',
  task_code: 'Mã task',
  task_link: 'Link task',
  task_status: 'Trạng thái task',
};

const mapHeaderToVietnamese = (header: string, dictionary: Record<string, string>): string =>
  dictionary[String(header || '').trim()] || header;

const buildAutoWidths = (headers: string[], min = 120, max = 420): number[] =>
  headers.map((header) => {
    const length = String(header || '').trim().length;
    return Math.min(max, Math.max(min, length * 9 + 36));
  });

const extractCodeFromDisplayValue = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  const parts = normalized.split(/\s[-–—]\s/, 2).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0]) {
    return parts[0];
  }

  return normalized;
};

const buildCrcIntakeImportItems = (payload: ImportPayload): Array<Record<string, unknown>> => {
  const mainHeaderIndex = buildHeaderIndex(payload.headers || []);
  const intakeRows = payload.rows || [];

  const allSheets = payload.sheets || [];
  const taskSheet = allSheets.find((sheet) => {
    const token = normalizeImportToken(sheet.name);
    return token.includes('yeucautasks') || token.includes('tasks');
  });

  const taskHeaderIndex = taskSheet ? buildHeaderIndex(taskSheet.headers || []) : new Map<string, number>();
  const taskRows = taskSheet?.rows || [];
  const tasksByRowCode = new Map<string, Array<Record<string, unknown>>>();

  taskRows.forEach((row) => {
    const rowCode = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.import_row_code);
    if (!rowCode) {
      return;
    }

    const taskCode = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_code);
    const taskLink = getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_link);
    if (!taskCode && !taskLink) {
      return;
    }

    const task = {
      task_source: getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_source) || 'REFERENCE',
      task_code: taskCode || null,
      task_link: taskLink || null,
      task_status: getImportCell(row, taskHeaderIndex, CRC_INTAKE_TASK_HEADER_ALIASES.task_status) || 'TODO',
    };

    const current = tasksByRowCode.get(rowCode) || [];
    current.push(task);
    tasksByRowCode.set(rowCode, current);
  });

  const items: Array<Record<string, unknown>> = [];
  intakeRows.forEach((row, rowIndex) => {
    const mapped = {
      import_row_code: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.import_row_code) || `ROW_${rowIndex + 2}`,
      customer_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.customer_code)
      ) || null,
      project_item_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.project_item_code)
      ) || null,
      customer_personnel_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.customer_personnel_code)
      ) || null,
      support_service_group_code: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.support_service_group_code) || null,
      source_channel: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.source_channel) || null,
      summary: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.summary) || null,
      description: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.description) || null,
      priority_label: getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.priority_label) || null,
      receiver_user_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.receiver_user_code)
      ) || null,
      creator_user_code: extractCodeFromDisplayValue(
        getImportCell(row, mainHeaderIndex, CRC_INTAKE_HEADER_ALIASES.creator_user_code)
      ) || null,
    };

    const hasData = Object.entries(mapped).some(([key, value]) => key !== 'import_row_code' && !!String(value || '').trim());
    if (!hasData) {
      return;
    }

    const rowCode = String(mapped.import_row_code || '').trim();
    const refTasks = rowCode ? (tasksByRowCode.get(rowCode) || []) : [];

    items.push({
      ...mapped,
      ref_tasks: refTasks,
    });
  });

  return items;
};

const triggerBrowserDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeWorksheetName = (value: string, fallback: string): string => {
  const sanitized = String(value || '')
    .replace(/[\\/?*:[\]]/g, ' ')
    .trim();
  if (!sanitized) {
    return fallback;
  }
  return sanitized.slice(0, 31);
};

const pxToExcelWidth = (px: number): number => {
  const normalized = Number.isFinite(px) ? Math.max(60, px) : 120;
  return Math.round((normalized / 7) * 100) / 100;
};

const setWorksheetColumns = (
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  widths: number[] = []
): void => {
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `col_${index + 1}`,
    width: pxToExcelWidth(widths[index] ?? 140),
  }));
};

const addDropdownValidation = (
  worksheet: ExcelJS.Worksheet,
  columnNumber: number,
  rangeFormula: string,
  rowStart: number,
  rowEnd: number
): void => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const cell = worksheet.getCell(row, columnNumber);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangeFormula],
      showErrorMessage: true,
      errorTitle: 'Giá trị không hợp lệ',
      error: 'Vui lòng chọn giá trị từ danh sách.',
    };
  }
};

const addDropdownValidationByRowFormula = (
  worksheet: ExcelJS.Worksheet,
  columnNumber: number,
  rowStart: number,
  rowEnd: number,
  resolveFormula: (row: number) => string
): void => {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const cell = worksheet.getCell(row, columnNumber);
    cell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [resolveFormula(row)],
      showErrorMessage: true,
      errorTitle: 'Giá trị không hợp lệ',
      error: 'Vui lòng chọn giá trị từ danh sách.',
    };
  }
};

const sanitizeExcelNameKey = (value: string): string => {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
  const withPrefix = /^[A-Za-z_]/.test(normalized) ? normalized : `K_${normalized}`;
  return (withPrefix || 'K_EMPTY').slice(0, 120);
};

const quoteSheetName = (sheetName: string): string => `'${String(sheetName).replace(/'/g, "''")}'`;

const createCrcIntakeTemplateWorkbook = async (params: {
  fileNameBase: string;
  intakeSheetName: string;
  taskSheetName: string;
  viHeaders: string[];
  viTaskHeaders: string[];
  customerRows: readonly (readonly [string, string])[];
  projectItemRows: readonly (readonly [string, string])[];
  customerPersonnelRows: readonly (readonly [string, string])[];
  supportGroupRows: readonly (readonly [string, string])[];
  personnelRows: readonly (readonly [string, string, string])[];
  projectItemByCustomerCode: ReadonlyMap<string, readonly (readonly [string, string])[]>;
  customerPersonnelByCustomerCode: ReadonlyMap<string, readonly (readonly [string, string])[]>;
  sourceChannelRows: readonly string[];
  priorityRows: readonly string[];
  taskSources: readonly string[];
  taskStatuses: readonly string[];
  hasLookupData: boolean;
  headerOrder: string[];
}): Promise<{ blob: Blob; fileName: string }> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VNPT Business Management';
  workbook.created = new Date();

  const intakeSheet = workbook.addWorksheet(normalizeWorksheetName(params.intakeSheetName, 'YeuCauNhap'));
  setWorksheetColumns(intakeSheet, params.viHeaders, buildAutoWidths(params.viHeaders));
  intakeSheet.getRow(1).font = { bold: true };
  intakeSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2FF' },
  };
  const customerDisplayRows = params.customerRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const projectItemDisplayRows = params.projectItemRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const customerPersonnelDisplayRows = params.customerPersonnelRows.map(([code, name]) => {
    const displayName = String(name || code || '').trim();
    return [code, name, `${code} - ${displayName}`] as const;
  });

  const internalPersonnelDisplayRows = params.personnelRows.map(([code, fullName, username]) => {
    const displayName = String(fullName || username || code || '').trim();
    return [code, fullName, username, `${code} - ${displayName}`] as const;
  });

  const customerDisplayByCode = new Map<string, string>();
  customerDisplayRows.forEach(([code, _name, display]) => {
    customerDisplayByCode.set(String(code).trim(), display);
  });

  const customerDisplayByProjectDisplay = new Map<string, string[]>();
  params.projectItemByCustomerCode.forEach((rows, customerCode) => {
    const safeCustomerCode = String(customerCode).trim();
    const customerDisplay = customerDisplayByCode.get(safeCustomerCode) || safeCustomerCode;
    const displayRows = rows
      .map(([code, name]) => {
        const displayName = String(name || code || '').trim();
        return `${code} - ${displayName}`;
      })
      .filter(Boolean);
    displayRows.forEach((projectDisplay) => {
      const currentCustomers = customerDisplayByProjectDisplay.get(projectDisplay) || [];
      if (!currentCustomers.includes(customerDisplay)) {
        currentCustomers.push(customerDisplay);
        customerDisplayByProjectDisplay.set(projectDisplay, currentCustomers);
      }
    });
  });

  if (customerDisplayByProjectDisplay.size === 0) {
    const allCustomers = Array.from(new Set(Array.from(customerDisplayByCode.values()).filter(Boolean)));
    projectItemDisplayRows.forEach((row) => {
      const projectDisplay = row[2];
      customerDisplayByProjectDisplay.set(projectDisplay, [...allCustomers]);
    });
  }

  customerDisplayByProjectDisplay.forEach((customers, projectDisplay) => {
    customerDisplayByProjectDisplay.set(projectDisplay, [...customers].sort((a, b) => a.localeCompare(b, 'vi')));
  });

  const customerPersonnelDisplayByCustomerCode = new Map<string, string[]>();
  params.customerPersonnelByCustomerCode.forEach((rows, customerCode) => {
    const displayRows = rows
      .map(([code, name]) => {
        const displayName = String(name || code || '').trim();
        return `${code} - ${displayName}`;
      })
      .filter(Boolean);
    customerPersonnelDisplayByCustomerCode.set(String(customerCode).trim(), Array.from(new Set(displayRows)));
  });

  const sampleCellByHeader: Record<string, string> = {
    import_row_code: 'ROW_001',
    project_item_code: projectItemDisplayRows[0]?.[2] || '',
    customer_code: customerDisplayRows[0]?.[2] || '',
    customer_personnel_code: customerPersonnelDisplayRows[0]?.[2] || '',
    support_group_code: params.supportGroupRows[0]?.[0] || '',
    source_channel: params.sourceChannelRows[0] || 'Email',
    summary: 'Mô tả yêu cầu mẫu',
    description: 'Chi tiết yêu cầu mẫu',
    priority: params.priorityRows[1] || params.priorityRows[0] || 'Trung bình',
    receiver_user_code: internalPersonnelDisplayRows[0]?.[3] || '',
    creator_user_code: internalPersonnelDisplayRows[0]?.[3] || '',
  };
  intakeSheet.addRow(params.headerOrder.map((header) => sampleCellByHeader[header] || ''));

  const intakeColumnIndexByHeader = new Map<string, number>();
  params.headerOrder.forEach((header, index) => {
    intakeColumnIndexByHeader.set(header, index + 1);
  });

  const customerColumnIndex = intakeColumnIndexByHeader.get('customer_code') ?? 2;
  const projectItemColumnIndex = intakeColumnIndexByHeader.get('project_item_code') ?? 3;
  const customerPersonnelColumnIndex = intakeColumnIndexByHeader.get('customer_personnel_code') ?? 4;
  const supportGroupColumnIndex = intakeColumnIndexByHeader.get('support_group_code') ?? 5;
  const sourceChannelColumnIndex = intakeColumnIndexByHeader.get('source_channel') ?? 6;
  const priorityColumnIndex = intakeColumnIndexByHeader.get('priority') ?? 9;
  const receiverColumnIndex = intakeColumnIndexByHeader.get('receiver_user_code') ?? 10;
  const creatorColumnIndex = intakeColumnIndexByHeader.get('creator_user_code') ?? 11;

  const customerColumnLetter = intakeSheet.getColumn(customerColumnIndex).letter;
  const projectItemColumnLetter = intakeSheet.getColumn(projectItemColumnIndex).letter;

  const taskSheet = workbook.addWorksheet(normalizeWorksheetName(params.taskSheetName, 'YeuCauTasks'));
  setWorksheetColumns(taskSheet, params.viTaskHeaders, buildAutoWidths(params.viTaskHeaders));
  taskSheet.getRow(1).font = { bold: true };
  taskSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEAF2FF' },
  };
  taskSheet.addRow([
    'ROW_001',
    params.taskSources[0] || 'IT360',
    'TASK-001',
    '',
    params.taskStatuses[0] || 'TODO',
  ]);

  const customerSheet = workbook.addWorksheet('KhachHang');
  setWorksheetColumns(customerSheet, ['Mã khách hàng', 'Tên khách hàng', 'Hiển thị'], [180, 280, 320]);
  customerSheet.getRow(1).font = { bold: true };
  customerDisplayRows.forEach((row) => customerSheet.addRow([...row]));
  customerSheet.getColumn(3).hidden = true;

  const projectItemSheet = workbook.addWorksheet('HangMucDuAnSanPham');
  setWorksheetColumns(projectItemSheet, ['Mã hạng mục', 'Tên hạng mục', 'Hiển thị'], [220, 320, 360]);
  projectItemSheet.getRow(1).font = { bold: true };
  projectItemDisplayRows.forEach((row) => projectItemSheet.addRow([...row]));
  projectItemSheet.getColumn(3).hidden = true;

  const customerPersonnelSheet = workbook.addWorksheet('NhanSuLienHe');
  setWorksheetColumns(customerPersonnelSheet, ['Mã nhân sự liên hệ', 'Tên nhân sự liên hệ', 'Hiển thị'], [220, 280, 360]);
  customerPersonnelSheet.getRow(1).font = { bold: true };
  customerPersonnelDisplayRows.forEach((row) => customerPersonnelSheet.addRow([...row]));
  customerPersonnelSheet.getColumn(3).hidden = true;

  const supportGroupSheet = workbook.addWorksheet('NhomHoTro');
  setWorksheetColumns(supportGroupSheet, ['Mã nhóm hỗ trợ', 'Tên nhóm hỗ trợ'], [200, 280]);
  supportGroupSheet.getRow(1).font = { bold: true };
  params.supportGroupRows.forEach((row) => supportGroupSheet.addRow([...row]));

  const internalPersonnelSheet = workbook.addWorksheet('NhanSuNoiBo');
  setWorksheetColumns(internalPersonnelSheet, ['Mã nhân sự', 'Họ tên', 'Tài khoản', 'Hiển thị'], [160, 220, 180, 320]);
  internalPersonnelSheet.getRow(1).font = { bold: true };
  internalPersonnelDisplayRows.forEach((row) => internalPersonnelSheet.addRow([...row]));
  internalPersonnelSheet.getColumn(4).hidden = true;

  const sourceChannelSheet = workbook.addWorksheet('KenhTiepNhan');
  setWorksheetColumns(sourceChannelSheet, ['Kênh tiếp nhận'], [180]);
  sourceChannelSheet.getRow(1).font = { bold: true };
  params.sourceChannelRows.forEach((value) => sourceChannelSheet.addRow([value]));

  const prioritySheet = workbook.addWorksheet('DoUuTien');
  setWorksheetColumns(prioritySheet, ['Độ ưu tiên'], [160]);
  prioritySheet.getRow(1).font = { bold: true };
  params.priorityRows.forEach((value) => prioritySheet.addRow([value]));

  const dependentLookupSheet = workbook.addWorksheet('_LookupByCustomer');
  dependentLookupSheet.state = 'hidden';
  setWorksheetColumns(
    dependentLookupSheet,
    [
      'project_display_name',
      'customer_display_name',
      'personnel_display_name',
      'customer_key',
      'personnel_key',
    ],
    [360, 320, 360, 220, 220]
  );

  const customerNameKeyMap = new Map<string, string>();
  const personnelNameKeyMap = new Map<string, string>();

  dependentLookupSheet.getCell(1, 4).value = '';
  dependentLookupSheet.getCell(1, 5).value = '';
  workbook.definedNames.add(`${quoteSheetName('_LookupByCustomer')}!$D$1:$D$1`, 'EMPTY_CUSTOMER');
  workbook.definedNames.add(`${quoteSheetName('_LookupByCustomer')}!$E$1:$E$1`, 'EMPTY_PERSONNEL');

  const sortedProjectDisplays = Array.from(customerDisplayByProjectDisplay.keys()).sort((a, b) => a.localeCompare(b, 'vi'));
  const lookupSheetRef = quoteSheetName('_LookupByCustomer');

  sortedProjectDisplays.forEach((projectDisplay) => {
    const customerKey = sanitizeExcelNameKey(`CUSTOMER_${projectDisplay}`);
    customerNameKeyMap.set(projectDisplay, customerKey);
  });

  customerDisplayRows.forEach(([customerCode]) => {
    const safeCustomerCode = String(customerCode).trim();
    const personnelKey = sanitizeExcelNameKey(`PERSONNEL_${safeCustomerCode}`);
    personnelNameKeyMap.set(safeCustomerCode, personnelKey);
  });

  let lookupRowIndex = 2;
  sortedProjectDisplays.forEach((projectDisplay) => {
    const linkedCustomers = customerDisplayByProjectDisplay.get(projectDisplay) || [];
    const customerKey = customerNameKeyMap.get(projectDisplay) || 'EMPTY_CUSTOMER';

    const maxRows = Math.max(1, linkedCustomers.length);
    const startRow = lookupRowIndex;

    for (let index = 0; index < maxRows; index += 1) {
      dependentLookupSheet.getCell(lookupRowIndex, 1).value = projectDisplay;
      dependentLookupSheet.getCell(lookupRowIndex, 2).value = linkedCustomers[index] || '';
      dependentLookupSheet.getCell(lookupRowIndex, 3).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 4).value = customerKey;
      dependentLookupSheet.getCell(lookupRowIndex, 5).value = '';
      lookupRowIndex += 1;
    }

    const endRow = lookupRowIndex - 1;
    workbook.definedNames.add(`${lookupSheetRef}!$B$${startRow}:$B$${endRow}`, customerKey);
  });

  const sortedLookupCustomerKeys = Array.from(customerDisplayByCode.keys()).sort((a, b) => a.localeCompare(b, 'vi'));
  const personnelLookupStartRow = lookupRowIndex;

  sortedLookupCustomerKeys.forEach((safeCustomerCode) => {
    const customerDisplay = customerDisplayByCode.get(safeCustomerCode) || safeCustomerCode;
    const personnelKey = personnelNameKeyMap.get(safeCustomerCode) || 'EMPTY_PERSONNEL';
    const personnelDisplayList = customerPersonnelDisplayByCustomerCode.get(safeCustomerCode) || [];

    const maxRows = Math.max(1, personnelDisplayList.length);
    const startRow = lookupRowIndex;

    for (let index = 0; index < maxRows; index += 1) {
      dependentLookupSheet.getCell(lookupRowIndex, 1).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 2).value = customerDisplay;
      dependentLookupSheet.getCell(lookupRowIndex, 3).value = personnelDisplayList[index] || '';
      dependentLookupSheet.getCell(lookupRowIndex, 4).value = '';
      dependentLookupSheet.getCell(lookupRowIndex, 5).value = personnelKey;
      lookupRowIndex += 1;
    }

    const endRow = lookupRowIndex - 1;
    workbook.definedNames.add(`${lookupSheetRef}!$C$${startRow}:$C$${endRow}`, personnelKey);
  });

  for (let col = 1; col <= 5; col += 1) {
    dependentLookupSheet.getColumn(col).hidden = true;
  }

  const lookupLastRow = Math.max(2, lookupRowIndex - 1);

  const customerFormulaByRow = (row: number): string =>
    `INDIRECT(IFERROR(VLOOKUP($${projectItemColumnLetter}${row},${lookupSheetRef}!$A$2:$D$${lookupLastRow},4,FALSE),"EMPTY_CUSTOMER"))`;

  const personnelFormulaByRow = (row: number): string =>
    `INDIRECT(IFERROR(VLOOKUP($${customerColumnLetter}${row},${lookupSheetRef}!$B$${personnelLookupStartRow}:$E$${lookupLastRow},4,FALSE),"EMPTY_PERSONNEL"))`;

  const projectFormula = `'HangMucDuAnSanPham'!$C$2:$C$${Math.max(2, projectItemDisplayRows.length + 1)}`;

  const guideSheet = workbook.addWorksheet('HuongDan');
  setWorksheetColumns(guideSheet, ['Nội dung'], [560]);
  guideSheet.getRow(1).font = { bold: true };
  [
    '1. Điền dữ liệu tại sheet YeuCauNhap.',
    '2. import_row_code là mã khóa để nối với sheet YeuCauTasks.',
    '3. Chọn Mã hạng mục dự án/sản phẩm trước, sau đó cột Mã khách hàng sẽ lọc theo hạng mục đã chọn.',
    '4. Cột Mã nhân sự liên hệ khách hàng sẽ lọc theo Mã khách hàng đã chọn.',
    '5. Nếu cần tra cứu toàn bộ dữ liệu, xem sheet HangMucDuAnSanPham và NhanSuLienHe.',
    '6. Cột Mã nhóm hỗ trợ tra ở sheet NhomHoTro.',
    '7. Cột Mã người tiếp nhận và Mã người tạo tra ở sheet NhanSuNoiBo.',
    '8. Không import trạng thái, hệ thống luôn tạo ở new_intake.',
    `9. Priority hợp lệ: ${params.priorityRows.join(', ') || 'Thấp, Trung bình, Cao, Khẩn'}.`,
    `10. Task source hợp lệ: ${params.taskSources.join(', ') || 'IT360, REFERENCE'}.`,
    `11. Task status hợp lệ: ${params.taskStatuses.join(', ') || 'TODO, IN_PROGRESS, DONE, CANCELLED, BLOCKED'}.`,
    params.hasLookupData
      ? '12. File mẫu đã đổ sẵn dữ liệu mã từ danh mục hiện tại.'
      : '12. Chưa có dữ liệu lookup trong phiên hiện tại, vui lòng nhập mã theo dữ liệu hệ thống.',
  ].forEach((line) => guideSheet.addRow([line]));

  const maxTemplateRows = 1000;
  const supportGroupFormula = `'NhomHoTro'!$A$2:$A$${Math.max(2, params.supportGroupRows.length + 1)}`;
  const personnelDisplayFormula = `'NhanSuNoiBo'!$D$2:$D$${Math.max(2, internalPersonnelDisplayRows.length + 1)}`;
  const sourceChannelFormula = `'KenhTiepNhan'!$A$2:$A$${Math.max(2, params.sourceChannelRows.length + 1)}`;
  const priorityFormula = `'DoUuTien'!$A$2:$A$${Math.max(2, params.priorityRows.length + 1)}`;

  addDropdownValidationByRowFormula(intakeSheet, customerColumnIndex, 2, maxTemplateRows, customerFormulaByRow);
  addDropdownValidation(intakeSheet, projectItemColumnIndex, projectFormula, 2, maxTemplateRows);
  addDropdownValidationByRowFormula(intakeSheet, customerPersonnelColumnIndex, 2, maxTemplateRows, personnelFormulaByRow);
  addDropdownValidation(intakeSheet, supportGroupColumnIndex, supportGroupFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, sourceChannelColumnIndex, sourceChannelFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, priorityColumnIndex, priorityFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, receiverColumnIndex, personnelDisplayFormula, 2, maxTemplateRows);
  addDropdownValidation(intakeSheet, creatorColumnIndex, personnelDisplayFormula, 2, maxTemplateRows);

  const hiddenTaskSourcesSheet = workbook.addWorksheet('_TaskLookup');
  hiddenTaskSourcesSheet.state = 'hidden';
  setWorksheetColumns(hiddenTaskSourcesSheet, ['Task source', 'Task status'], [180, 180]);
  params.taskSources.forEach((value, index) => {
    const rowIndex = index + 2;
    hiddenTaskSourcesSheet.getCell(rowIndex, 1).value = value;
  });
  params.taskStatuses.forEach((value, index) => {
    const rowIndex = index + 2;
    hiddenTaskSourcesSheet.getCell(rowIndex, 2).value = value;
  });
  const taskSourceLookupFormula = `'_TaskLookup'!$A$2:$A$${Math.max(2, params.taskSources.length + 1)}`;
  const taskStatusLookupFormula = `'_TaskLookup'!$B$2:$B$${Math.max(2, params.taskStatuses.length + 1)}`;
  addDropdownValidation(taskSheet, 2, taskSourceLookupFormula, 2, maxTemplateRows);
  addDropdownValidation(taskSheet, 5, taskStatusLookupFormula, 2, maxTemplateRows);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob,
    fileName: `${params.fileNameBase}.xlsx`,
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CustomerRequestManagementHub: React.FC<CustomerRequestManagementHubProps> = ({
  customers,
  customerPersonnel,
  projectItems,
  employees,
  supportServiceGroups,
  currentUserId,
  isAdminViewer = false,
  canReadRequests = false,
  canWriteRequests = false,
  canDeleteRequests = false,
  canImportRequests = false,
  canExportRequests = false,
  onNotify,
}) => {
  // -------------------------------------------------------------------------
  // 1. Notify helper
  // -------------------------------------------------------------------------
  const notify = useCallback(
    (type: ToastType, title: string, message: string) => {
      onNotify?.(type, title, message);
    },
    [onNotify]
  );

  // -------------------------------------------------------------------------
  // 2. Hub state
  // -------------------------------------------------------------------------
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [selectedRequestPreview, setSelectedRequestPreview] = useState<YeuCau | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createFormTags, setCreateFormTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImportingIntake, setIsImportingIntake] = useState(false);
  const [isExportingIntake, setIsExportingIntake] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isSubmittingWorklog, setIsSubmittingWorklog] = useState(false);
  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [scopedProjectItems, setScopedProjectItems] = useState<ProjectItemMaster[]>([]);
  const [projectRaciRows, setProjectRaciRows] = useState<ProjectRaciRow[]>([]);
  const [showWorklogModal, setShowWorklogModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [worklogModalContext, setWorklogModalContext] = useState<CustomerRequestWorklogModalContext | null>(null);
  const [pendingPrimaryAction, setPendingPrimaryAction] = useState<{
    requestId: string;
    action: CustomerRequestPrimaryActionMeta;
  } | null>(null);

  // List / filter state
  const [activeProcessCode, setActiveProcessCode] = useState('');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(20);
  const [requestKeyword, setRequestKeyword] = useState('');
  const [requestCustomerFilter, setRequestCustomerFilter] = useState('');
  const [requestSupportGroupFilter, setRequestSupportGroupFilter] = useState('');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState('');
  const [requestRoleFilter, setRequestRoleFilter] = useState<CustomerRequestRoleFilter>('');
  /** Kiểm soát workspace nào hiển thị — độc lập với requestRoleFilter (lọc list) */
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTabKey>('overview');
  const [activeSurface, setActiveSurface] = useState<CustomerRequestSurfaceKey>('inbox');
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [requestMissingEstimateFilter, setRequestMissingEstimateFilter] = useState(false);
  const [requestOverEstimateFilter, setRequestOverEstimateFilter] = useState(false);
  const [requestSlaRiskFilter, setRequestSlaRiskFilter] = useState(false);
  const [isQuickAccessCollapsedOnMobile, setIsQuickAccessCollapsedOnMobile] = useState(false);
  const [isQuickAccessAutoHideArmed, setIsQuickAccessAutoHideArmed] = useState(true);

  // Transition state
  const [transitionStatusCode, setTransitionStatusCode] = useState('');

  // Task tab state (detail pane)
  const [activeTaskTab, setActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');

  // Create flow draft
  const [createFlowDraft, setCreateFlowDraft] =
    useState<CustomerRequestCreateFlowDraft>(() => buildInitialCreateFlowDraft(currentUserId));
  
  // Workflow selection for new request
  const { defaultWorkflowId, isLoading: isLoadingWorkflows } = useWorkflowDefinitions({ enabled: isCreateMode });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // Set default workflow when creating new request
  useEffect(() => {
    if (isCreateMode && defaultWorkflowId !== null && selectedWorkflowId === null) {
      setSelectedWorkflowId(defaultWorkflowId);
    }
  }, [isCreateMode, defaultWorkflowId, selectedWorkflowId]);
  
  const quickAccessAnchorRef = useRef<HTMLDivElement | null>(null);
  const quickAccessRestoreTimeoutRef = useRef<number | null>(null);
  const layoutMode = useCustomerRequestResponsiveLayout();
  const isMobileListSurface = layoutMode === 'mobile' && activeSurface === 'list' && !isCreateMode;
  const shouldCollapseQuickAccessOnMobile =
    isMobileListSurface &&
    (isQuickAccessCollapsedOnMobile ||
      (isQuickAccessAutoHideArmed && readCustomerRequestWindowScrollY() >= 280));

  const {
    pinnedItems,
    recentItems,
    pushRecentRequest,
    togglePinnedRequest,
    removePinnedRequest,
    isPinnedRequest,
  } = useCustomerRequestQuickAccess(currentUserId);

  useEffect(() => {
    if (quickAccessRestoreTimeoutRef.current !== null) {
      window.clearTimeout(quickAccessRestoreTimeoutRef.current);
      quickAccessRestoreTimeoutRef.current = null;
    }

    if (!isMobileListSurface) {
      setIsQuickAccessCollapsedOnMobile(false);
      setIsQuickAccessAutoHideArmed(true);
      return;
    }

    const handleScroll = () => {
      if (!isQuickAccessAutoHideArmed) {
        return;
      }

      if (readCustomerRequestWindowScrollY() >= 280) {
        setIsQuickAccessCollapsedOnMobile(true);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isMobileListSurface, isQuickAccessAutoHideArmed]);

  useEffect(() => {
    return () => {
      if (quickAccessRestoreTimeoutRef.current !== null) {
        window.clearTimeout(quickAccessRestoreTimeoutRef.current);
      }
    };
  }, []);

  const handleRevealQuickAccess = useCallback(() => {
    setIsQuickAccessCollapsedOnMobile(false);
    setIsQuickAccessAutoHideArmed(false);

    if (quickAccessRestoreTimeoutRef.current !== null) {
      window.clearTimeout(quickAccessRestoreTimeoutRef.current);
    }

    quickAccessRestoreTimeoutRef.current = window.setTimeout(() => {
      setIsQuickAccessAutoHideArmed(true);
      quickAccessRestoreTimeoutRef.current = null;
    }, 1200);

    window.requestAnimationFrame(() => {
      quickAccessAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  // -------------------------------------------------------------------------
  // 3. Process catalog
  // -------------------------------------------------------------------------
  const [processCatalog, setProcessCatalog] = useState<YeuCauProcessCatalog | null>(null);

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchYeuCauProcessCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setProcessCatalog(catalog);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !isRequestCanceledError(error)) {
          notify(
            'error',
            'Tải danh mục quy trình thất bại',
            error instanceof Error ? error.message : 'Không thể tải danh mục.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadRequests]);

  // Derived from catalog
  const masterFields = useMemo<YeuCauProcessField[]>(
    () => processCatalog?.master_fields ?? [],
    [processCatalog]
  );

  const allProcesses = useMemo<YeuCauProcessMeta[]>(() => {
    if (!processCatalog) return [];
    return processCatalog.groups.flatMap((g) => g.processes);
  }, [processCatalog]);

  const xmlVisibleProcesses = useMemo<YeuCauProcessMeta[]>(
    () => filterXmlVisibleProcesses(allProcesses),
    [allProcesses]
  );

  const processMap = useMemo<Map<string, YeuCauProcessMeta>>(() => {
    const map = new Map<string, YeuCauProcessMeta>();
    allProcesses.forEach((p) => map.set(p.process_code, p));
    return map;
  }, [allProcesses]);

  const processOptions = useMemo<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [{ value: '', label: 'Tất cả' }];
    xmlVisibleProcesses.forEach((p) =>
      opts.push({ value: p.process_code, label: p.process_label })
    );
    return opts;
  }, [xmlVisibleProcesses]);

  const effectiveProjectItems = useMemo(() => {
    // CRC phải chỉ hiển thị project item đã được scope theo đội ngũ dự án
    // từ endpoint chuyên dụng; không union với bootstrap list chung của app
    // vì sẽ làm lộ các dự án/sản phẩm chưa được phân công RACI.
    return scopedProjectItems;
  }, [scopedProjectItems]);

  const newIntakeFields = useMemo<YeuCauProcessField[]>(
    () => processMap.get('new_intake')?.form_fields ?? [],
    [processMap]
  );

  const activeEditorMeta = useMemo<YeuCauProcessMeta | null>(
    () => (isXmlVisibleProcessCode(activeEditorProcessCode) ? (processMap.get(activeEditorProcessCode) ?? null) : null),
    [processMap, activeEditorProcessCode]
  );

  const transitionProcessMeta = useMemo<YeuCauProcessMeta | null>(
    () =>
      transitionStatusCode && isXmlVisibleProcessCode(transitionStatusCode)
        ? (processMap.get(transitionStatusCode) ?? null)
        : null,
    [processMap, transitionStatusCode]
  );

  const transitionRenderableFields = useMemo<YeuCauProcessField[]>(
    () => ([
      { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime' },
      { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime' },
      { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime' },
      { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number' },
      { name: 'from_user_id', label: 'Người chuyển', type: 'user_select' },
      { name: 'to_user_id', label: 'Người nhận', type: 'user_select' },
      { name: 'notes', label: 'Ghi chú', type: 'textarea' },
    ]),
    []
  );

  // -------------------------------------------------------------------------
  // 4. Search hook
  // -------------------------------------------------------------------------
  const {
    searchKeyword,
    setSearchKeyword,
    searchResults,
    searchError,
    isSearchLoading,
    isSearchOpen,
    setIsSearchOpen,
  } = useCustomerRequestSearch({ canReadRequests });


  // -------------------------------------------------------------------------
  // 5. Stable error/callback refs — prevent hook useEffect re-firing on every
  //    render due to inline arrow functions changing reference each render.
  // -------------------------------------------------------------------------
  const handleListError = useCallback(
    (msg: string) => notify('error', 'Tải danh sách thất bại', msg),
    [notify]
  );
  const handlePageOverflow = useCallback((page: number) => setListPage(page), []);
  const handleDashboardError = useCallback(
    (msg: string) => notify('error', 'Tải dashboard thất bại', msg),
    [notify]
  );
  const handleCreatorError = useCallback(
    (msg: string) => notify('error', 'Khu vực người tạo', msg),
    [notify]
  );
  const handleDispatcherError = useCallback(
    (msg: string) => notify('error', 'Khu vực điều phối', msg),
    [notify]
  );
  const handlePerformerError = useCallback(
    (msg: string) => notify('error', 'Khu vực người xử lý', msg),
    [notify]
  );
  const handleDetailError = useCallback(
    (msg: string) => notify('error', 'Tải chi tiết yêu cầu thất bại', msg),
    [notify]
  );

  // -------------------------------------------------------------------------
  // 6. List hook
  // -------------------------------------------------------------------------
  const listFilters = useMemo(
    () => ({
      customer_id: requestCustomerFilter || undefined,
      support_service_group_id: requestSupportGroupFilter || undefined,
      priority: requestPriorityFilter || undefined,
      my_role: requestRoleFilter || undefined,
      missing_estimate: requestMissingEstimateFilter ? (1 as const) : undefined,
      over_estimate: requestOverEstimateFilter ? (1 as const) : undefined,
      sla_risk: requestSlaRiskFilter ? (1 as const) : undefined,
    }),
    [
      requestCustomerFilter,
      requestSupportGroupFilter,
      requestPriorityFilter,
      requestRoleFilter,
      requestMissingEstimateFilter,
      requestOverEstimateFilter,
      requestSlaRiskFilter,
    ]
  );

  const { listRows, isListLoading, listMeta } = useCustomerRequestList({
    canReadRequests,
    activeProcessCode,
    isCreateMode,
    listPage,
    pageSize: listPageSize,
    dataVersion,
    requestKeyword,
    filters: listFilters,
    onError: handleListError,
    onPageOverflow: handlePageOverflow,
  });

  const taskReferenceCatalog = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string; label: string; searchText: string }>();

    const addTaskReference = (raw: {
      id?: string | number | null;
      taskCode: string;
      summary?: string | null;
      customerName?: string | null;
      projectName?: string | null;
    }) => {
      const taskCode = String(raw.taskCode || '').trim();
      if (!taskCode) {
        return;
      }

      const normalizedCode = taskCode.toLowerCase();
      if (map.has(normalizedCode)) {
        return;
      }

      const summary = String(raw.summary || '').trim();
      map.set(normalizedCode, {
        id: raw.id ?? null,
        task_code: taskCode,
        label: summary ? `${taskCode} — ${summary}` : taskCode,
        searchText: `${taskCode} ${summary} ${String(raw.customerName || '')} ${String(raw.projectName || '')}`,
      });
    };

    listRows.forEach((row) => {
      addTaskReference({
        id: row.id,
        taskCode: row.request_code ?? row.ma_yc ?? String(row.id ?? ''),
        summary: row.summary ?? row.tieu_de,
        customerName: row.customer_name ?? row.khach_hang_name,
        projectName: (row as unknown as Record<string, unknown>).project_name as string | undefined,
      });
    });

    searchResults.forEach((r) => {
      addTaskReference({
        id: r.id,
        taskCode: r.request_code ?? String(r.id),
        summary: r.summary ?? r.label,
        customerName: r.customer_name,
        projectName: r.project_name,
      });
    });

    return map;
  }, [listRows, searchResults]);

  // -------------------------------------------------------------------------
  // 7. Dashboard hook
  // -------------------------------------------------------------------------
  const { isDashboardLoading, overviewDashboard, roleDashboards } =
    useCustomerRequestDashboard({
      canReadRequests,
      dataVersion,
      onError: handleDashboardError,
    });

  // -------------------------------------------------------------------------
  // 8. Role workspace hooks
  // -------------------------------------------------------------------------
  const isWorkspaceActive = !isCreateMode && activeSurface === 'inbox';

  const creatorWS = useCustomerRequestCreatorWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleCreatorError,
  });

  const dispatcherWS = useCustomerRequestDispatcherWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handleDispatcherError,
  });

  const performerWS = useCustomerRequestPerformerWorkspace({
    active: isWorkspaceActive,
    canReadRequests,
    dataVersion,
    onError: handlePerformerError,
  });

  // -------------------------------------------------------------------------
  // 8. Detail hook
  // -------------------------------------------------------------------------
  const {
    processDetail,
    setProcessDetail,
    people,
    masterDraft,
    setMasterDraft,
    processDraft,
    setProcessDraft,
    formAttachments,
    setFormAttachments,
    formIt360Tasks,
    setFormIt360Tasks,
    formReferenceTasks,
    setFormReferenceTasks,
    formTags,
    setFormTags,
    timeline,
    caseWorklogs,
    setCaseWorklogs,
    isDetailLoading,
    refreshDetail,
  } = useCustomerRequestDetail({
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    dataVersion,
    masterFields,
    createInitialFields: newIntakeFields,
    onError: handleDetailError,
  });

  // -------------------------------------------------------------------------
  // 8b. Merged task reference catalog (includes form reference tasks)
  // -------------------------------------------------------------------------
  const mergedTaskReferenceCatalog = useMemo(() => {
    const map = new Map(taskReferenceCatalog);
    formReferenceTasks.forEach((task) => {
      if (task.task_code && task.id) {
        const taskCode = String(task.task_code).trim();
        if (!taskCode) return;
        const normalizedCode = taskCode.toLowerCase();
        if (!map.has(normalizedCode)) {
          map.set(normalizedCode, {
            id: task.id,
            task_code: taskCode,
            label: taskCode,
            searchText: taskCode,
          });
        }
      }
    });
    return map;
  }, [taskReferenceCatalog, formReferenceTasks]);

  // Task reference options (default from current list + search results + form reference tasks)
  const taskReferenceOptions = useMemo<SearchableSelectOption[]>(
    () =>
      Array.from(mergedTaskReferenceCatalog.values()).map((item) => ({
        value: item.task_code,
        label: item.label,
        searchText: item.searchText,
      })),
    [mergedTaskReferenceCatalog]
  );

  // Task reference lookup for transition/detail hooks
  const taskReferenceLookup = useMemo(() => {
    const map = new Map<string, { id?: string | number | null; task_code: string }>();
    mergedTaskReferenceCatalog.forEach((item, key) => {
      map.set(key, { id: item.id, task_code: item.task_code });
      map.set(item.task_code, { id: item.id, task_code: item.task_code });
    });
    return map;
  }, [mergedTaskReferenceCatalog]);

  // -------------------------------------------------------------------------
  // 9. Derived detail props
  // -------------------------------------------------------------------------
  const currentUserName = useMemo(() => {
    const user = employees.find((e) => String(e.id) === String(currentUserId ?? ''));
    return user?.full_name ?? '';
  }, [employees, currentUserId]);

  // Auto-fetch reference task data when formReferenceTasks is populated from API
  const searchedTaskCodesRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canReadRequests || formReferenceTasks.length === 0) {
      return;
    }

    // Get task_codes that haven't been searched yet
    const missingTaskCodes = formReferenceTasks
      .map((t) => t.task_code)
      .filter((code): code is string => !!(code && !searchedTaskCodesRef.current.has(code)));

    if (missingTaskCodes.length > 0 && !isSearchLoading) {
      // Mark as searched to avoid re-triggering
      searchedTaskCodesRef.current.add(missingTaskCodes[0]);
      // Trigger search for the first missing task_code
      // User can then click dropdown to see the option, or type to search
      setSearchKeyword(missingTaskCodes[0]);
    }
  }, [canReadRequests, formReferenceTasks, isSearchLoading, setSearchKeyword]);

  const {
    registerOptimisticRequestUpdate,
    getPatchedRequest,
    patchedListRows,
    patchedCreatorRows,
    patchedCreatorBuckets,
    patchedDispatcherRows,
    patchedDispatcherBuckets,
    patchedDispatcherTeamLoadRows,
    patchedDispatcherPmWatchRows,
    patchedPerformerRows,
    patchedPerformerBuckets,
    patchedOverviewDashboard,
    patchedRoleDashboards,
  } = useCustomerRequestOptimisticState({
    currentUserId,
    dataVersion,
    listRows,
    creatorRows: creatorWS.creatorRows,
    dispatcherRows: dispatcherWS.dispatcherRows,
    performerRows: performerWS.performerRows,
    overviewDashboard,
    roleDashboards,
  });

  const selectedCustomerId = String(masterDraft.customer_id ?? '');

  const selectedProjectItem = useMemo(
    () =>
      effectiveProjectItems.find(
        (p) => String(p.id) === String(masterDraft.project_item_id ?? '')
      ) ?? null,
    [effectiveProjectItems, masterDraft.project_item_id]
  );

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;

    void fetchCustomerRequestProjectItems({
      include_project_item_id: (masterDraft.project_item_id as string | number | null | undefined) ?? null,
    })
      .then((items) => {
        if (!cancelled) {
          setScopedProjectItems(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScopedProjectItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, masterDraft.project_item_id]);

  // Fetch project RACI assignments for the selected request's project
  useEffect(() => {
    const projectItemId = processDetail?.yeu_cau?.project_item_id;
    if (!projectItemId || !canReadRequests) {
      setProjectRaciRows([]);
      return;
    }

    let cancelled = false;

    void fetchProjectRaciAssignments([projectItemId])
      .then((rows) => {
        if (!cancelled) {
          // Lấy tất cả roles, không chỉ 'R'
          const rRows = Array.isArray(rows) ? rows : [];
          setProjectRaciRows(rRows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectRaciRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, processDetail?.yeu_cau?.project_item_id]);

  const transitionOptions = useMemo<YeuCauProcessMeta[]>(
    () => {
      const options = resolveTransitionOptionsForRequest(
        processDetail?.allowed_next_processes ?? [],
        processDetail?.yeu_cau ?? null
      );

      return options;
    },
    [processDetail]
  );

  useEffect(() => {
    if (isCreateMode || !selectedRequestId || transitionOptions.length === 0) {
      if (transitionStatusCode !== '') {
        setTransitionStatusCode('');
      }
      return;
    }

    const hasCurrentSelection = transitionOptions.some(
      (option) => option.process_code === transitionStatusCode
    );

    if (!hasCurrentSelection) {
      setTransitionStatusCode(transitionOptions[0]?.process_code ?? '');
    }
  }, [isCreateMode, selectedRequestId, transitionOptions, transitionStatusCode]);

  const canTransitionActiveRequest =
    !isCreateMode && !!selectedRequestId;

  const canEditActiveForm = useMemo(() => {
    if (!canWriteRequests) return false;
    if (isCreateMode) return true;
    if (!processDetail) return false;
    return processDetail.can_write;
  }, [canWriteRequests, isCreateMode, processDetail]);

  const defaultProcessor: ProjectRaciRow | null = null;

  const relatedSummaryItems = useMemo(() => {
    if (!processDetail?.yeu_cau) return [];
    const yc = processDetail.yeu_cau;
    const raw = yc as unknown as Record<string, unknown>;
    const people = processDetail.people ?? [];
    const statusRow = processDetail.status_row?.data as Record<string, unknown> | undefined;
    const processRow = processDetail.process_row?.data as Record<string, unknown> | undefined;
    const currentStatusCode = yc.current_status_code ?? yc.trang_thai;

    // Lấy assignee theo status hiện tại từ status_row/process_row trước
    const receiverUserIdFromStatusRow = statusRow?.receiver_user_id ?? processRow?.receiver_user_id;
    const dispatcherUserIdFromStatusRow = statusRow?.dispatcher_user_id ?? processRow?.dispatcher_user_id;

    // Tìm người thực hiện từ people array (vai_tro = "nguoi_thuc_hien")
    const nguoiThucHien = people.find((p) => p.vai_tro === 'nguoi_thuc_hien' && p.is_active);
    const performerUserIdFromPeople = nguoiThucHien?.user_id;

    // Với status "completed", lấy completed_by_user_id
    const completedByUserId = currentStatusCode === 'completed'
      ? statusRow?.completed_by_user_id ?? statusRow?.created_by
      : null;

    const handlerUserId = yc.nguoi_xu_ly_id
      ?? yc.current_owner_user_id
      ?? (currentStatusCode === 'pending_dispatch'
        ? dispatcherUserIdFromStatusRow ?? yc.dispatcher_user_id
        : receiverUserIdFromStatusRow ?? completedByUserId ?? performerUserIdFromPeople ?? yc.receiver_user_id ?? yc.performer_user_id ?? yc.performer_id);

    // Tìm trong RACI rows trước
    const performerFromRaci = handlerUserId
      ? projectRaciRows.find((row) => String(row.user_id) === String(handlerUserId))
      : null;

    // Nếu không tìm thấy trong RACI, tìm trong employees
    const performerFromEmployees = !performerFromRaci && handlerUserId
      ? employees.find((emp) => String(emp.id) === String(handlerUserId))
      : null;

    // Lấy tên từ status_row nếu có
    const receiverNameFromStatusRow = statusRow?.receiver_user_id_name as string | undefined;
    const dispatcherNameFromStatusRow = statusRow?.dispatcher_user_id_name as string | undefined;
    const completedByName = statusRow?.completed_by_user_id_name as string | undefined;

    // pending_dispatch phải ưu tiên PM/dispatcher hiện tại
    const performerName = yc.nguoi_xu_ly_name
      ?? yc.current_owner_name
      ?? (currentStatusCode === 'pending_dispatch'
        ? performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? dispatcherNameFromStatusRow
          ?? yc.dispatcher_name
        : performerFromRaci?.full_name
          ?? performerFromRaci?.username
          ?? performerFromEmployees?.full_name
          ?? receiverNameFromStatusRow
          ?? completedByName
          ?? yc.performer_name
          ?? yc.receiver_name);

    return [
      { label: 'Mã yêu cầu', value: (yc.ma_yc ?? yc.request_code) as string | null | undefined },
      { label: 'Khách hàng', value: (yc.customer_name ?? yc.khach_hang_name) as string | null | undefined },
      { label: 'Dự án', value: raw.project_name as string | null | undefined },
      { label: 'Người tiếp nhận', value: yc.received_by_name },
      { label: 'Người điều phối', value: yc.dispatcher_name },
      { label: 'Người xử lý', value: performerName },
    ].filter((item): item is { label: string; value: string } => !!item.value);
  }, [processDetail, projectRaciRows, employees]);

  const currentHoursReport = useMemo<YeuCauHoursReport | null | undefined>(
    () => processDetail?.hours_report ?? null,
    [processDetail]
  );

  const estimateHistory = useMemo<YeuCauEstimate[]>(
    () => processDetail?.estimates ?? [],
    [processDetail]
  );

  const canOpenWorklogModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_worklog);

  const canOpenEstimateModal =
    !isCreateMode && !!selectedRequestId && Boolean(processDetail?.available_actions?.can_add_estimate);

  const runPrimaryActionForLoadedRequest = useCallback(
    (action: CustomerRequestPrimaryActionMeta): boolean => {
      if (action.kind === 'estimate') {
        if (!processDetail?.available_actions?.can_add_estimate) {
          return false;
        }
        setShowEstimateModal(true);
        return true;
      }

      if (action.kind === 'worklog') {
        if (!processDetail?.available_actions?.can_add_worklog) {
          return false;
        }
        setShowWorklogModal(true);
        return true;
      }

      if (action.kind === 'transition' && action.targetStatusCode) {
        const nextTransitionCode = transitionOptions.some(
          (option) => option.process_code === action.targetStatusCode
        )
          ? action.targetStatusCode
          : transitionOptions[0]?.process_code ?? '';

        if (!nextTransitionCode) {
          return false;
        }

        setTransitionStatusCode(nextTransitionCode);
        return true;
      }

      return false;
    },
    [
      processDetail?.available_actions?.can_add_estimate,
      processDetail?.available_actions?.can_add_worklog,
      transitionOptions,
    ]
  );

  useEffect(() => {
    if (!pendingPrimaryAction || isCreateMode || !selectedRequestId) {
      return;
    }

    if (String(selectedRequestId) !== pendingPrimaryAction.requestId) {
      return;
    }

    const detailRequestId = String(processDetail?.yeu_cau?.id ?? '');
    if (!detailRequestId || detailRequestId !== pendingPrimaryAction.requestId) {
      return;
    }

    runPrimaryActionForLoadedRequest(pendingPrimaryAction.action);
    setPendingPrimaryAction(null);
  }, [
    isCreateMode,
    pendingPrimaryAction,
    processDetail?.yeu_cau?.id,
    runPrimaryActionForLoadedRequest,
    selectedRequestId,
  ]);

  useEffect(() => {
    if (isCreateMode || !processDetail?.yeu_cau?.id) {
      return;
    }
    pushRecentRequest(processDetail.yeu_cau);
  }, [isCreateMode, processDetail?.yeu_cau, pushRecentRequest]);

  const dispatcherQuickActions = useMemo<DispatcherQuickAction[]>(() => {
    return buildDispatcherQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  const performerQuickActions = useMemo<PerformerQuickAction[]>(() => {
    return buildPerformerQuickActions({
      canTransitionActiveRequest,
      isCreateMode,
      transitionOptions,
      currentUserId,
    });
  }, [canTransitionActiveRequest, currentUserId, isCreateMode, transitionOptions]);

  // -------------------------------------------------------------------------
  // 10. Transition hook
  // -------------------------------------------------------------------------
  const transitionHook = useCustomerRequestTransition({
    currentUserId,
    selectedRequestId,
    transitionStatusCode,
    transitionProcessMeta,
    processDetail,
    people: people as YeuCauRelatedUser[],
    defaultProcessor,
    taskReferenceLookup,
    onNotify: (type, title, msg) => notify(type, title, msg),
    onTransitionSuccess: (requestId, statusCode) => {
      setSelectedRequestId(requestId);
      setSelectedRequestPreview((prev) =>
        prev ? { ...prev, id: requestId, current_status_code: statusCode } : prev
      );
      setIsCreateMode(false);
      setActiveEditorProcessCode(statusCode || 'new_intake');
      setTransitionStatusCode('');
      setPendingPrimaryAction(null);
      bumpDataVersion();
    },
    bumpDataVersion,
    caseContextIt360Tasks: formIt360Tasks,
    caseContextReferenceTasks: formReferenceTasks,
  });

  // -------------------------------------------------------------------------
  // 11. Handlers
  // -------------------------------------------------------------------------
  const handleSelectRow = useCallback((row: YeuCau) => {
    pushRecentRequest(row);
    setSelectedRequestId(row.id);
    setSelectedRequestPreview(row);
    setIsCreateMode(false);
    setActiveSurface('list');
    setActiveEditorProcessCode(resolveRequestProcessCode(row));
    setTransitionStatusCode('');
    setPendingPrimaryAction(null);
    setActiveSavedViewId(null);
    setProcessDetail(null);
  }, [pushRecentRequest, setProcessDetail]);

  const requestLookup = useMemo(() => {
    const map = new Map<string, YeuCau>();

    const appendRows = (rows: Array<YeuCau | null | undefined>) => {
      rows.forEach((row) => {
        if (!row?.id) {
          return;
        }
        map.set(String(row.id), row);
      });
    };

    const appendAttentionCases = (
      dashboard: typeof overviewDashboard | null | undefined
    ) => {
      (dashboard?.attention_cases ?? []).forEach((item) => {
        const requestCase = item?.request_case as YeuCau | undefined;
        if (!requestCase?.id) {
          return;
        }
        map.set(String(requestCase.id), requestCase);
      });
    };

    appendRows(patchedListRows);
    appendRows(patchedCreatorRows);
    appendRows(patchedDispatcherRows);
    appendRows(patchedPerformerRows);
    appendAttentionCases(patchedOverviewDashboard);
    appendAttentionCases(patchedRoleDashboards.creator);
    appendAttentionCases(patchedRoleDashboards.dispatcher);
    appendAttentionCases(patchedRoleDashboards.performer);

    return map;
  }, [
    patchedCreatorRows,
    patchedDispatcherRows,
    patchedListRows,
    patchedOverviewDashboard,
    patchedPerformerRows,
    patchedRoleDashboards.creator,
    patchedRoleDashboards.dispatcher,
    patchedRoleDashboards.performer,
  ]);

  const handleOpenRequest = useCallback(
    async (requestId: string | number, statusCode?: string | null) => {
      const lookupKey = String(requestId);
      const knownRow = requestLookup.get(lookupKey) ?? null;
      const listRow = patchedListRows.find((r) => String(r.id) === lookupKey) ?? null;

      if (listRow) {
        handleSelectRow(listRow);
        return;
      }

      setSelectedRequestId(requestId);
      setSelectedRequestPreview(knownRow);
      setIsCreateMode(false);
      setActiveSurface('list');
      setPendingPrimaryAction(null);
      setTransitionStatusCode('');
      setActiveSavedViewId(null);
      setProcessDetail(null);

      let requestPreview = knownRow;
      let resolvedCode =
        String(statusCode ?? '').trim() ||
        (knownRow ? resolveRequestProcessCode(knownRow) : '');

      if (!requestPreview || !resolvedCode) {
        try {
          const fetched = await fetchYeuCau(requestId);
          requestPreview = fetched;
          resolvedCode = resolveRequestProcessCode(fetched) || resolvedCode;
          setSelectedRequestPreview(fetched);
          pushRecentRequest(fetched);
        } catch (error: unknown) {
          if (!isRequestCanceledError(error)) {
            notify(
              'error',
              'Mở chi tiết yêu cầu thất bại',
              error instanceof Error ? error.message : 'Không thể tải yêu cầu.'
            );
          }
          setSelectedRequestId(null);
          setSelectedRequestPreview(null);
          setActiveEditorProcessCode('');
          return;
        }
      } else {
        pushRecentRequest(requestPreview);
      }

      if (!resolvedCode) {
        notify(
          'error',
          'Mở chi tiết yêu cầu thất bại',
          'Không xác định được tiến trình hiện tại của yêu cầu.'
        );
        setSelectedRequestId(null);
        setSelectedRequestPreview(null);
        setActiveEditorProcessCode('');
        return;
      }

      setActiveEditorProcessCode(resolvedCode);
    },
    [
      handleSelectRow,
      isRequestCanceledError,
      patchedListRows,
      notify,
      pushRecentRequest,
      requestLookup,
      setProcessDetail,
    ]
  );

  const handleCreateRequest = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setCreateFormTags([]);
    setIsCreateMode(true);
    setActiveEditorProcessCode('new_intake');
    setTransitionStatusCode('');
    setCreateFlowDraft(buildInitialCreateFlowDraft(currentUserId));
    setSelectedWorkflowId(null); // Reset workflow selection
    setActiveSavedViewId(null);
  }, [currentUserId]);

  const handleWorkspaceTabChange = useCallback((tab: WorkspaceTabKey) => {
    setActiveWorkspaceTab(tab);
    setRequestRoleFilter(workspaceTabToRoleFilter(tab));
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleDashboardRoleFilterChange = useCallback((role: CustomerRequestRoleFilter) => {
    setActiveWorkspaceTab(role || 'overview');
    setListPage(1);
    setActiveSavedViewId(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRequestId(null);
    setSelectedRequestPreview(null);
    setPendingPrimaryAction(null);
    setTransitionStatusCode('');
    setShowWorklogModal(false);
    setWorklogModalContext(null);
    setShowEstimateModal(false);
  }, []);

  const handleSubmitWorklog = useCallback(
    async (payload: CustomerRequestWorklogSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      const mode = worklogModalContext?.mode ?? 'worklog';
      const editingWorklog = worklogModalContext?.editingWorklog ?? null;

      setIsSubmittingWorklog(true);
      try {
        const result = mode === 'edit_worklog' && editingWorklog
          ? await updateYeuCauWorklog(selectedRequestId, editingWorklog.id, payload)
          : mode === 'detail_status_worklog'
            ? await storeYeuCauDetailStatusWorklog(selectedRequestId, payload)
            : await storeYeuCauWorklog(selectedRequestId, payload);

        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextHoursReport = result.hours_report;
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
        });

        if (result.worklog) {
          setCaseWorklogs((prev) => prependUniqueWorklog(prev, result.worklog));
        }
        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport ?? prev.hours_report ?? null,
            worklogs: prependUniqueWorklog(prev.worklogs ?? [], result.worklog),
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview((prev) =>
            applyHoursReportToRequest({
              request: prev,
              hoursReport: nextHoursReport,
              requestPatch: nextRequest,
            })
          );
        }
        setShowWorklogModal(false);
        setWorklogModalContext(null);
        notify(
          'success',
          mode === 'edit_worklog' ? 'Cập nhật giờ công' : 'Giờ công',
          mode === 'edit_worklog' ? 'Đã cập nhật bản ghi giờ công.' : 'Đã lưu giờ công cho yêu cầu.'
        );
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            mode === 'edit_worklog' ? 'Cập nhật giờ công thất bại' : 'Lưu giờ công thất bại',
            error instanceof Error ? error.message : 'Không thể lưu giờ công.'
          );
        }
      } finally {
        setIsSubmittingWorklog(false);
      }
    },
    [
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setCaseWorklogs,
      setProcessDetail,
      storeYeuCauDetailStatusWorklog,
      storeYeuCauWorklog,
      updateYeuCauWorklog,
      worklogModalContext,
    ]
  );

  const handleSubmitEstimate = useCallback(
    async (payload: CustomerRequestEstimateSubmission) => {
      if (!selectedRequestId) {
        return;
      }

      setIsSubmittingEstimate(true);
      try {
        const result = await createYeuCauEstimate(selectedRequestId, {
          ...payload,
          estimate_type: 'manual',
          estimated_by_user_id: currentUserId ?? undefined,
        });
        const previousRequest = processDetail?.yeu_cau ?? selectedRequestPreview ?? null;
        const nextEstimateHistory = prependUniqueEstimate(estimateHistory, result.estimate);
        const nextHoursReport = buildOptimisticEstimateHoursReport({
          currentHoursReport,
          requestCase: result.request_case,
          estimate: result.estimate,
          fallbackRequestCaseId: selectedRequestId,
        });
        const nextRequest = applyHoursReportToRequest({
          request: previousRequest,
          hoursReport: nextHoursReport,
          requestPatch: result.request_case ?? undefined,
        });

        registerOptimisticRequestUpdate(previousRequest, nextRequest);
        setProcessDetail((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            yeu_cau: nextRequest ?? prev.yeu_cau,
            hours_report: nextHoursReport,
            estimates: nextEstimateHistory,
          };
        });
        if (nextRequest) {
          setSelectedRequestPreview(nextRequest);
        }
        setShowEstimateModal(false);
        notify('success', 'Ước lượng', 'Đã cập nhật ước lượng cho yêu cầu.');
        void refreshDetail();
      } catch (error: unknown) {
        if (!isRequestCanceledError(error)) {
          notify(
            'error',
            'Cập nhật ước lượng thất bại',
            error instanceof Error ? error.message : 'Không thể lưu ước lượng.'
          );
        }
      } finally {
        setIsSubmittingEstimate(false);
      }
    },
    [
      currentHoursReport,
      currentUserId,
      estimateHistory,
      isRequestCanceledError,
      notify,
      processDetail?.yeu_cau,
      registerOptimisticRequestUpdate,
      refreshDetail,
      selectedRequestId,
      selectedRequestPreview,
      setProcessDetail,
    ]
  );

  const handleOpenQuickAccessItem = useCallback(
    (item: CustomerRequestQuickRequestItem) => {
      handleOpenRequest(item.requestId, item.statusCode);
    },
    [handleOpenRequest]
  );

  const handleApplySavedView = useCallback((view: CustomerRequestSavedView) => {
    const filters = view.filters ?? {};

    setActiveWorkspaceTab(view.workspaceTab);
    setActiveSurface(view.surface);
    setSelectedRequestId(null);
    setIsCreateMode(false);
    setTransitionStatusCode('');
    setActiveSavedViewId(view.id);
    setActiveProcessCode(filters.processCode ?? '');
    setRequestKeyword(filters.keyword ?? '');
    setRequestCustomerFilter(filters.customerId ?? '');
    setRequestSupportGroupFilter(filters.supportGroupId ?? '');
    setRequestPriorityFilter(filters.priority ?? '');
    setRequestRoleFilter(
      filters.roleFilter ?? workspaceTabToRoleFilter(view.workspaceTab)
    );
    setRequestMissingEstimateFilter(Boolean(filters.missingEstimate));
    setRequestOverEstimateFilter(Boolean(filters.overEstimate));
    setRequestSlaRiskFilter(Boolean(filters.slaRisk));
    setListPage(1);
  }, []);

  const handleClearSavedView = useCallback(() => {
    setActiveSavedViewId(null);
  }, []);

  const handleTogglePinnedRequest = useCallback((row: YeuCau) => {
    togglePinnedRequest(row);
  }, [togglePinnedRequest]);

  const handleOpenOverviewRoleWorkspace = useCallback(
    (tab: Extract<WorkspaceTabKey, 'creator' | 'dispatcher' | 'performer'>) => {
      setActiveWorkspaceTab(tab);
      setRequestRoleFilter(workspaceTabToRoleFilter(tab));
      setActiveSurface('inbox');
      setListPage(1);
      setActiveSavedViewId(null);
    },
    []
  );

  const handleMasterFieldChange = useCallback(
    (field: string, value: unknown) => {
      setMasterDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setMasterDraft]
  );

  const handleProcessDraftChange = useCallback(
    (field: string, value: unknown) => {
      setProcessDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setProcessDraft]
  );

  const handleUpdateIt360Row = useCallback(
    (localId: string, field: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) => {
      setFormIt360Tasks((prev) =>
        prev.map((r) => (r.local_id === localId ? { ...r, [field]: value } : r))
      );
    },
    [setFormIt360Tasks]
  );

  const handleRemoveIt360Row = useCallback(
    (localId: string) => {
      setFormIt360Tasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormIt360Tasks]
  );

  const handleUpdateRefRow = useCallback(
    (localId: string, value: string) => {
      const normalizedValue = String(value || '').trim();
      const found = taskReferenceLookup.get(normalizedValue.toLowerCase())
        ?? taskReferenceLookup.get(normalizedValue);

      setFormReferenceTasks((prev) =>
        prev.map((r) =>
          r.local_id === localId
            ? {
                ...r,
                id: found?.id ?? r.id ?? null,
                task_code: found?.task_code ?? normalizedValue,
              }
            : r
        )
      );

      // Trigger search to load full data for the selected task
      // This ensures the task appears in dropdown and is available for submission
      if (found?.task_code && found.task_code !== searchKeyword) {
        setSearchKeyword(found.task_code);
      }
    },
    [setFormReferenceTasks, taskReferenceLookup, setSearchKeyword, searchKeyword]
  );

  const handleRemoveRefRow = useCallback(
    (localId: string) => {
      setFormReferenceTasks((prev) => prev.filter((r) => r.local_id !== localId));
    },
    [setFormReferenceTasks]
  );

  const handleAddTaskRow = useCallback(() => {
    if (activeTaskTab === 'IT360') {
      setFormIt360Tasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' },
      ]);
    } else {
      setFormReferenceTasks((prev) => [
        ...prev,
        { local_id: String(Date.now()), task_code: '' },
      ]);
    }
  }, [activeTaskTab, setFormIt360Tasks, setFormReferenceTasks]);

  /** Dùng riêng cho modal tạo mới (tab nội bộ trong modal) */
  const handleAddIt360Task = useCallback(() => {
    setFormIt360Tasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '', task_link: '', status: 'TODO' as const },
    ]);
  }, [setFormIt360Tasks]);

  const handleAddReferenceTask = useCallback(() => {
    setFormReferenceTasks((prev) => [
      ...prev,
      { local_id: String(Date.now()), task_code: '' },
    ]);
  }, [setFormReferenceTasks]);

  const handleUploadAttachment = useCallback(
    async (file: File) => {
      setAttachmentError('');
      setAttachmentNotice('');
      setIsUploadingAttachment(true);
      try {
        const uploaded = await uploadDocumentAttachment(file);
        setFormAttachments((prev) => [...prev, uploaded]);
        setAttachmentNotice(`Đã tải lên ${file.name}`);
      } catch (e: unknown) {
        setAttachmentError(e instanceof Error ? e.message : 'Tải file thất bại.');
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [setFormAttachments]
  );

  const handleDeleteAttachment = useCallback(
    async (id: string | number) => {
      setFormAttachments((prev) => prev.filter((a) => String(a.id) !== String(id)));
    },
    [setFormAttachments]
  );

  const handleSaveCase = useCallback(async () => {
    if (!canWriteRequests) return;
    if (!isCreateMode) return;

    const plan = resolveCreateRequestPlan(createFlowDraft, { actorUserId: currentUserId });
    if (plan.validationErrors.length > 0) {
      notify('error', 'Tạo yêu cầu thất bại', plan.validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    try {
      const basePayload = buildPayloadFromDraft(masterFields, masterDraft);

      // --- Canonical persist: gửi attachments + ref_tasks cùng request tạo mới ---
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : {}),
            ...(r.task_code.trim() !== '' ? { task_code: r.task_code.trim() } : {}),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...basePayload,
        ...plan.masterOverrides,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        // Include workflow_definition_id if selected
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const created = await createYeuCau(payload);
      let effectiveRequest = created;
      const followUpWarnings: string[] = [];

      if (plan.estimatePayload && created.id != null) {
        try {
          const estimateResult = await createYeuCauEstimate(created.id, plan.estimatePayload);
          effectiveRequest = estimateResult.request_case ?? effectiveRequest;
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được ước lượng ban đầu: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      // Save tags if any
      if (createFormTags.length > 0 && created.id != null) {
        try {
          const normalizedTags = createFormTags
            .map((tag) => ({
              name: String(tag.name ?? '').trim().toLowerCase(),
              color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
            }))
            .filter((tag) => tag.name.length > 0);

          await saveYeuCauCaseTags(created.id, normalizedTags);
        } catch (error: unknown) {
          followUpWarnings.push(
            `Chưa lưu được tags: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
          );
        }
      }

      setIsCreateMode(false);
      setCreateFormTags([]);
      setSelectedRequestId(effectiveRequest.id ?? created.id);
      setSelectedRequestPreview(effectiveRequest);
      setActiveEditorProcessCode(resolveRequestProcessCode(effectiveRequest) || 'new_intake');
      // bumpDataVersion triggers useCustomerRequestDetail to reload detail
      // (GET rehydrate) and populate formAttachments/formIt360Tasks/formReferenceTasks
      // with persisted data from server — see §4.5 frontend create-flow complete.
      bumpDataVersion();

      const requestCode =
        effectiveRequest.ma_yc ??
        effectiveRequest.request_code ??
        created.ma_yc ??
        created.request_code ??
        '';

      if (followUpWarnings.length > 0) {
        notify(
          'warning',
          'Tạo yêu cầu chưa hoàn tất toàn bộ',
          [`Đã tạo yêu cầu ${requestCode}.`, ...followUpWarnings].join(' ')
        );
      } else {
        notify('success', 'Tạo yêu cầu', `Đã tạo yêu cầu ${requestCode}`);
      }
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Tạo yêu cầu thất bại',
          e instanceof Error ? e.message : 'Không thể tạo yêu cầu.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    createFlowDraft,
    currentUserId,
    masterFields,
    masterDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    createFormTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
  ]);

  const handleSaveStatusDetail = useCallback(async () => {
    if (!canWriteRequests || isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    setIsSaving(true);
    try {
      const masterPayload = buildPayloadFromDraft(masterFields, masterDraft);
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : { task_code: r.task_code.trim() }),
          })),
      ];

      await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, {
        master_payload: masterPayload,
        status_payload: processDraft,
        ref_tasks: refTasksPayload,
      });
      bumpDataVersion();
      notify('success', 'Cập nhật trạng thái', 'Đã cập nhật thông tin trạng thái.');
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Cập nhật trạng thái thất bại',
          e instanceof Error ? e.message : 'Không thể cập nhật trạng thái.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formIt360Tasks,
    formReferenceTasks,
    bumpDataVersion,
    notify,
  ]);

  const handleSaveTaskReference = useCallback(async () => {
    if (!canWriteRequests || isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    setIsSaving(true);
    try {
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            ...(r.id != null ? { id: r.id } : {}),
            ...(r.task_code.trim() !== '' ? { task_code: r.task_code.trim() } : {}),
          })),
      ];

      await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, {
        ref_tasks: refTasksPayload,
      });
      bumpDataVersion();
      notify('success', 'Cập nhật Task/Ref', 'Đã cập nhật danh sách task liên quan.');
    } catch (e: unknown) {
      if (!isRequestCanceledError(e)) {
        notify(
          'error',
          'Cập nhật Task/Ref thất bại',
          e instanceof Error ? e.message : 'Không thể cập nhật task liên quan.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    isCreateMode,
    selectedRequestId,
    activeEditorProcessCode,
    formIt360Tasks,
    formReferenceTasks,
    bumpDataVersion,
    notify,
  ]);

  const handleDeleteCase = useCallback(async () => {
    if (!canDeleteRequests || !selectedRequestId) return;
    const row = patchedListRows.find((r) => String(r.id) === String(selectedRequestId));
    const label = row?.ma_yc ?? row?.request_code ?? String(selectedRequestId);
    if (!window.confirm(`Xóa yêu cầu ${label}?`)) return;
    try {
      await deleteYeuCau(selectedRequestId);
      setSelectedRequestId(null);
      setSelectedRequestPreview(null);
      setIsCreateMode(false);
      bumpDataVersion();
      notify('success', 'Xóa yêu cầu', 'Đã xóa yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Xóa yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể xóa.'
      );
    }
  }, [canDeleteRequests, selectedRequestId, patchedListRows, bumpDataVersion, notify]);

  const handleUpdateCase = useCallback(async () => {
    if (!canWriteRequests || !selectedRequestId || !activeEditorProcessCode) return;
    try {
      setIsSaving(true);

      const normalizedTags = formTags
        .map((tag) => ({
          name: String(tag.name ?? '').trim().toLowerCase(),
          color: String(tag.color ?? '').trim().toLowerCase() || 'blue',
        }))
        .filter((tag) => tag.name.length > 0);

      // Build attachments payload
      const attachmentsPayload = formAttachments
        .filter((a) => a.id)
        .map((a) => ({ id: a.id }));

      // Build ref_tasks payload (IT360 + Reference tasks)
      const refTasksPayload: Array<Record<string, unknown>> = [
        ...formIt360Tasks
          .filter((r) => r.task_code.trim())
          .map((r) => ({
            task_source: 'IT360',
            task_code: r.task_code.trim(),
            task_link: r.task_link || null,
            task_status: r.status,
            ...(r.id != null ? { id: r.id } : {}),
          })),
        ...formReferenceTasks
          .filter((r) => r.task_code.trim() || r.id != null)
          .map((r) => ({
            task_source: 'REFERENCE',
            task_code: r.task_code.trim(),
          })),
      ];

      const payload: Record<string, unknown> = {
        ...buildPayloadFromDraft(masterFields, masterDraft),
        ...processDraft,
        ...(attachmentsPayload.length > 0 ? { attachments: attachmentsPayload } : {}),
        ...(refTasksPayload.length > 0 ? { ref_tasks: refTasksPayload } : {}),
        ...(selectedWorkflowId ? { workflow_definition_id: selectedWorkflowId } : {}),
      };

      const updated = await saveYeuCauProcess(selectedRequestId, activeEditorProcessCode, payload);
      setSelectedRequestPreview(updated);

      if (selectedRequestId != null) {
        try {
          const savedTags = await saveYeuCauCaseTags(selectedRequestId, normalizedTags);
          setFormTags(savedTags);
        } catch (error: unknown) {
          notify(
            'warning',
            'Cập nhật tags chưa hoàn tất',
            error instanceof Error ? error.message : 'Không thể đồng bộ tags.'
          );
        }
      }

      bumpDataVersion();
      notify('success', 'Cập nhật yêu cầu', 'Đã cập nhật yêu cầu.');
    } catch (e: unknown) {
      notify(
        'error',
        'Cập nhật yêu cầu thất bại',
        e instanceof Error ? e.message : 'Không thể cập nhật.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    canWriteRequests,
    selectedRequestId,
    activeEditorProcessCode,
    masterFields,
    masterDraft,
    processDraft,
    formAttachments,
    formIt360Tasks,
    formReferenceTasks,
    formTags,
    selectedWorkflowId,
    bumpDataVersion,
    notify,
    setFormTags,
  ]);

  const handleOpenTransitionModal = useCallback(() => {
    if (!transitionStatusCode) return;
    transitionHook.openTransitionModal({
      targetProcessMeta: processMap.get(transitionStatusCode) ?? null,
    });
  }, [transitionStatusCode, transitionHook, processMap]);

  const handleRunDispatcherAction = useCallback(
    (action: DispatcherQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunPerformerAction = useCallback(
    (action: PerformerQuickAction) => {
      setTransitionStatusCode(action.targetStatusCode);
      transitionHook.openTransitionModal({
        targetProcessMeta: processMap.get(action.targetStatusCode) ?? null,
        payloadOverrides: action.payloadOverrides,
        notes: action.notePreset,
      });
    },
    [transitionHook, processMap]
  );

  const handleRunListPrimaryAction = useCallback(
    (row: YeuCau, action: CustomerRequestPrimaryActionMeta) => {
      const isCurrentSelection =
        !isCreateMode &&
        selectedRequestId !== null &&
        String(selectedRequestId) === String(row.id) &&
        String(processDetail?.yeu_cau?.id ?? '') === String(row.id);

      if (action.kind === 'detail' && !action.targetStatusCode) {
        if (!isCurrentSelection) {
          handleSelectRow(row);
        }
        return;
      }

      if (isCurrentSelection && runPrimaryActionForLoadedRequest(action)) {
        return;
      }

      handleSelectRow(row);
      setPendingPrimaryAction({ requestId: String(row.id), action });
    },
    [
      handleSelectRow,
      isCreateMode,
      processDetail?.yeu_cau?.id,
      runPrimaryActionForLoadedRequest,
      selectedRequestId,
    ]
  );

  const handleModalStatusPayloadChange = useCallback(
    (fieldName: string, value: unknown) => {
      transitionHook.setModalStatusPayload((prev) => ({ ...prev, [fieldName]: value }));
    },
    [transitionHook]
  );

  // Status count helper for dashboard cards
  const getStatusCount = useCallback(
    (statusCode: string): number => {
      if (!patchedOverviewDashboard) return 0;
      const found = patchedOverviewDashboard.summary.status_counts.find(
        (s) => s.status_code === statusCode
      );
      return found?.count ?? 0;
    },
    [patchedOverviewDashboard]
  );

  // Alert counts
  const alertCounts = useMemo(
    () => ({
      missing_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.missing_estimate ?? 0,
      over_estimate:
        patchedOverviewDashboard?.summary?.alert_counts?.over_estimate ?? 0,
      sla_risk: patchedOverviewDashboard?.summary?.alert_counts?.sla_risk ?? 0,
    }),
    [patchedOverviewDashboard]
  );

  // Customer options for list pane filter
  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((c) => {
        const raw = c as unknown as Record<string, unknown>;
        const displayLabel = String(
          c.customer_name ||
            raw.name ||
            raw.company_name ||
            `Khách hàng #${c.id}`
        );
        return {
          value: String(c.id),
          label: displayLabel,
          searchText: [
            c.customer_name,
            c.customer_code,
            c.tax_code,
            raw.name,
            raw.company_name,
            c.id,
          ]
            .filter(Boolean)
            .join(' '),
        };
      }),
    [customers]
  );

  const pinnedRequestIds = useMemo(
    () => new Set(pinnedItems.map((item) => String(item.requestId))),
    [pinnedItems]
  );

  const selectedRequestSummary = useMemo<YeuCau | null>(() => {
    if (!selectedRequestId) {
      return null;
    }

    const detailRequest = processDetail?.yeu_cau ?? null;
    const previewRequest =
      selectedRequestPreview && String(selectedRequestPreview.id) === String(selectedRequestId)
        ? selectedRequestPreview
        : null;
    const matchedDetailRequest =
      detailRequest && String(detailRequest.id) === String(selectedRequestId)
        ? detailRequest
        : null;

    return (
      patchedListRows.find((row) => String(row.id) === String(selectedRequestId)) ??
      matchedDetailRequest ??
      getPatchedRequest(previewRequest) ??
      null
    );
  }, [
    getPatchedRequest,
    patchedListRows,
    processDetail?.yeu_cau,
    selectedRequestId,
    selectedRequestPreview,
  ]);

  const dashboardRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);

  const hasListFilters =
    !!(
      activeProcessCode ||
      requestKeyword ||
      requestCustomerFilter ||
      requestSupportGroupFilter ||
      requestPriorityFilter ||
      (requestRoleFilter &&
        requestRoleFilter !==
          (activeSurface === 'analytics'
            ? workspaceTabToRoleFilter(activeWorkspaceTab)
            : workspaceTabToRoleFilter(activeWorkspaceTab))) ||
      requestMissingEstimateFilter ||
      requestOverEstimateFilter ||
      requestSlaRiskFilter
    );

  const handleClearFilters = useCallback(() => {
    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setActiveProcessCode('');
    setRequestKeyword('');
    setRequestCustomerFilter('');
    setRequestSupportGroupFilter('');
    setRequestPriorityFilter('');
    setRequestRoleFilter(defaultRoleFilter);
    setRequestMissingEstimateFilter(false);
    setRequestOverEstimateFilter(false);
    setRequestSlaRiskFilter(false);
    setListPage(1);
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (activeSurface === 'analytics') {
      return;
    }

    const defaultRoleFilter = workspaceTabToRoleFilter(activeWorkspaceTab);
    setRequestRoleFilter((prev) => (prev === defaultRoleFilter ? prev : defaultRoleFilter));
  }, [activeSurface, activeWorkspaceTab]);

  useEffect(() => {
    if (!activeSavedViewId) {
      return;
    }

    const activeView = DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS.find(
      (view) => view.id === activeSavedViewId
    );

    if (!activeView) {
      setActiveSavedViewId(null);
      return;
    }

    const filters = activeView.filters ?? {};
    const matches =
      activeWorkspaceTab === activeView.workspaceTab &&
      activeSurface === activeView.surface &&
      activeProcessCode === (filters.processCode ?? '') &&
      requestKeyword === (filters.keyword ?? '') &&
      requestCustomerFilter === (filters.customerId ?? '') &&
      requestSupportGroupFilter === (filters.supportGroupId ?? '') &&
      requestPriorityFilter === (filters.priority ?? '') &&
      requestRoleFilter ===
        (filters.roleFilter ?? workspaceTabToRoleFilter(activeView.workspaceTab)) &&
      requestMissingEstimateFilter === Boolean(filters.missingEstimate) &&
      requestOverEstimateFilter === Boolean(filters.overEstimate) &&
      requestSlaRiskFilter === Boolean(filters.slaRisk);

    if (!matches) {
      setActiveSavedViewId(null);
    }
  }, [
    activeProcessCode,
    activeSavedViewId,
    activeSurface,
    activeWorkspaceTab,
    requestCustomerFilter,
    requestKeyword,
    requestMissingEstimateFilter,
    requestOverEstimateFilter,
    requestPriorityFilter,
    requestRoleFilter,
    requestSlaRiskFilter,
    requestSupportGroupFilter,
  ]);

  // Creator workspace name
  const creatorName = useMemo(() => {
    if (!currentUserId) return null;
    const user = employees.find((e) => String(e.id) === String(currentUserId));
    return user?.full_name ?? null;
  }, [employees, currentUserId]);

  const handleTransitionStatusCodeChange = useCallback((value: string) => {
    setTransitionStatusCode(value);
  }, []);

  const handleCreateFlowDraftChange = useCallback(
    (patch: Partial<CustomerRequestCreateFlowDraft>) => {
      setCreateFlowDraft((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleOpenWorklogModal = useCallback(() => {
    setWorklogModalContext({
      mode: 'worklog',
      title: 'Ghi giờ công',
      eyebrow: 'Giờ công',
      submitLabel: 'Lưu giờ công',
      detailStatusAction: null,
      editingWorklog: null,
    });
    setShowWorklogModal(true);
  }, []);

  const handleOpenDetailStatusWorklogModal = useCallback((action: 'in_progress' | 'paused') => {
    setWorklogModalContext({
      mode: 'detail_status_worklog',
      title: action === 'paused' ? 'Tạm ngưng xử lý' : 'Đánh dấu đang thực hiện',
      eyebrow: 'Trạng thái xử lý',
      submitLabel: action === 'paused' ? 'Lưu tạm ngưng' : 'Lưu đang thực hiện',
      detailStatusAction: action,
      editingWorklog: null,
    });
    setShowWorklogModal(true);
  }, []);

  const handleEditWorklog = useCallback((worklog: YeuCauWorklog) => {
    setWorklogModalContext({
      mode: 'edit_worklog',
      title: 'Cập nhật giờ công',
      eyebrow: 'Chỉnh sửa worklog',
      submitLabel: 'Lưu cập nhật',
      detailStatusAction: null,
      editingWorklog: worklog,
    });
    setShowWorklogModal(true);
  }, []);

  const handleCloseWorklogModal = useCallback(() => {
    setShowWorklogModal(false);
    setWorklogModalContext(null);
  }, []);

  const handleOpenEstimateModal = useCallback(() => {
    setShowEstimateModal(true);
  }, []);

  const handleCloseEstimateModal = useCallback(() => {
    setShowEstimateModal(false);
  }, []);

  const handleSurfaceChange = useCallback((surface: CustomerRequestSurfaceKey) => {
    setActiveSurface(surface);
    setActiveSavedViewId(null);
  }, []);

  const handleDownloadIntakeTemplate = useCallback(async () => {
    if (!canImportRequests) {
      return;
    }

    setIsDownloadingTemplate(true);
    try {
      const response = await fetchCustomerRequestIntakeTemplate(selectedWorkflowId);
      const template = response?.data ?? {};
      const headers = template.headers || [];
      const taskHeaders = template.task_headers || [];
      const priorityLabels = template.priority_labels || [];
      const taskSources = template.task_sources || [];
      const taskStatuses = template.task_statuses || [];

      const orderedHeaders = (() => {
        const result = [...headers];
        const projectIndex = result.indexOf('project_item_code');
        const customerIndex = result.indexOf('customer_code');
        if (projectIndex !== -1 && customerIndex !== -1 && projectIndex > customerIndex) {
          const [projectHeader] = result.splice(projectIndex, 1);
          result.splice(customerIndex, 0, projectHeader);
        }
        return result;
      })();

      const viHeaders = orderedHeaders.map((header) => mapHeaderToVietnamese(header, CRC_INTAKE_HEADER_LABELS));
      const viTaskHeaders = taskHeaders.map((header) => mapHeaderToVietnamese(header, CRC_INTAKE_TASK_HEADER_LABELS));

      const personnelRows = employees
        .map((employee) => {
          const code = String((employee as unknown as Record<string, unknown>).user_code || '').trim();
          const username = String(employee.username || '').trim();
          const fullName = String(employee.full_name || '').trim();
          if (!code && !username && !fullName) {
            return null;
          }
          const effectiveCode = code || username;
          return [effectiveCode, fullName || username, username] as const;
        })
        .filter((row): row is readonly [string, string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const customerIdToCode = new Map<string, string>();
      const customerRows = customers
        .map((customer) => {
          const raw = customer as unknown as Record<string, unknown>;
          const code = String(
            customer.customer_code
              || raw.customer_code
              || raw.customerCode
              || raw.code
              || ''
          ).trim();
          const name = String(
            customer.customer_name
              || raw.customer_name
              || raw.customerName
              || raw.company_name
              || raw.companyName
              || raw.name
              || ''
          ).trim();
          const customerId = String(customer.id || raw.customer_id || raw.customerId || raw.id || '').trim();
          if (!code && !name) {
            return null;
          }
          if (customerId && code) {
            customerIdToCode.set(customerId, code);
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const projectItemRows = effectiveProjectItems
        .map((item) => {
          const raw = item as unknown as Record<string, unknown>;
          const code = String(
            raw.project_item_code
              || raw.projectItemCode
              || raw.item_code
              || raw.itemCode
              || raw.external_code
              || raw.externalCode
              || raw.code
              || item.id
              || ''
          ).trim();
          const name = String(
            raw.item_name
              || raw.itemName
              || raw.project_item_name
              || raw.projectItemName
              || raw.display_name
              || raw.displayName
              || raw.name
              || ''
          ).trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const projectItemByCustomerCode = new Map<string, Array<readonly [string, string]>>();
      effectiveProjectItems.forEach((item) => {
        const raw = item as unknown as Record<string, unknown>;
        const code = String(
          raw.project_item_code
            || raw.projectItemCode
            || raw.item_code
            || raw.itemCode
            || raw.external_code
            || raw.externalCode
            || raw.code
            || item.id
            || ''
        ).trim();
        const name = String(
          raw.item_name
            || raw.itemName
            || raw.project_item_name
            || raw.projectItemName
            || raw.display_name
            || raw.displayName
            || raw.name
            || ''
        ).trim();
        if (!code && !name) {
          return;
        }

        const customerCode = String(raw.customer_code || raw.customerCode || '').trim();
        const customerId = String(raw.customer_id || raw.customerId || '').trim();
        const resolvedCustomerCode = customerCode || customerIdToCode.get(customerId) || '';
        if (!resolvedCustomerCode) {
          return;
        }
        const currentRows = projectItemByCustomerCode.get(resolvedCustomerCode) || [];
        const dedupKey = `${code}__${name}`;
        if (!currentRows.some(([existingCode, existingName]) => `${existingCode}__${existingName}` === dedupKey)) {
          currentRows.push([code, name]);
          projectItemByCustomerCode.set(resolvedCustomerCode, currentRows);
        }
      });

      if (projectItemRows.length === 0 && projectItemByCustomerCode.size > 0) {
        projectItemByCustomerCode.forEach((rows) => {
          rows.forEach(([code, name]) => {
            const normalizedCode = String(code || '').trim();
            const normalizedName = String(name || '').trim();
            if (normalizedCode || normalizedName) {
              projectItemRows.push([normalizedCode, normalizedName]);
            }
          });
        });
      }


      const dedupProjectItemMap = new Map<string, readonly [string, string]>();
      projectItemRows.forEach((row) => {
        dedupProjectItemMap.set(`${row[0]}__${row[1]}`, row);
      });
      const finalProjectItemRows = Array.from(dedupProjectItemMap.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));


      const projectItemRowsForTemplate =
        finalProjectItemRows.length > 0
          ? finalProjectItemRows
          : Array.from(new Map(
              Array.from(projectItemByCustomerCode.values())
                .flatMap((rows) => rows)
                .map((row) => [`${row[0]}__${row[1]}`, row] as const)
            ).values())
              .filter((row): row is readonly [string, string] => Array.isArray(row) && row.length >= 2)
              .map((row) => [String(row[0] || ''), String(row[1] || '')] as const)
              .filter(([code, name]) => Boolean(code || name))
              .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const finalProjectItemByCustomerCode = new Map<string, readonly (readonly [string, string])[]>();
      projectItemByCustomerCode.forEach((rows, customerCode) => {
        finalProjectItemByCustomerCode.set(
          customerCode,
          [...rows].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
        );
      });

      const customerPersonnelRows = customerPersonnel
        .map((person) => {
          const raw = person as unknown as Record<string, unknown>;
          const code = String(
            raw.personnel_code
              || raw.personnelCode
              || raw.customer_personnel_code
              || raw.customerPersonnelCode
              || raw.contact_code
              || raw.contactCode
              || raw.code
              || raw.personnel_id
              || raw.personnelId
              || raw.id
              || person.id
              || ''
          ).trim();
          const name = String(
            raw.full_name
              || raw.fullName
              || raw.personnel_name
              || raw.personnelName
              || raw.name
              || ''
          ).trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const dedupCustomerPersonnelMap = new Map<string, readonly [string, string]>();
      customerPersonnelRows.forEach((row) => {
        dedupCustomerPersonnelMap.set(`${row[0]}__${row[1]}`, row);
      });
      const finalCustomerPersonnelRows = Array.from(dedupCustomerPersonnelMap.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const customerPersonnelByCustomerCode = new Map<string, Array<readonly [string, string]>>();
      customerPersonnel.forEach((person) => {
        const raw = person as unknown as Record<string, unknown>;
        const code = String(
          raw.personnel_code
            || raw.personnelCode
            || raw.customer_personnel_code
            || raw.customerPersonnelCode
            || raw.contact_code
            || raw.contactCode
            || raw.code
            || raw.personnel_id
            || raw.personnelId
            || raw.id
            || person.id
            || ''
        ).trim();
        const name = String(
          raw.full_name
            || raw.fullName
            || raw.personnel_name
            || raw.personnelName
            || raw.name
            || ''
        ).trim();
        if (!code && !name) {
          return;
        }

        const customerCode = String(raw.customer_code || raw.customerCode || '').trim();
        const customerId = String(raw.customer_id || raw.customerId || person.customerId || '').trim();
        const resolvedCustomerCode = customerCode || customerIdToCode.get(customerId) || '';

        if (!resolvedCustomerCode) {
          return;
        }

        const currentRows = customerPersonnelByCustomerCode.get(resolvedCustomerCode) || [];
        const dedupKey = `${code}__${name}`;
        if (!currentRows.some(([existingCode, existingName]) => `${existingCode}__${existingName}` === dedupKey)) {
          currentRows.push([code, name]);
          customerPersonnelByCustomerCode.set(resolvedCustomerCode, currentRows);
        }
      });

      if (finalCustomerPersonnelRows.length === 0 && customerPersonnelByCustomerCode.size > 0) {
        customerPersonnelByCustomerCode.forEach((rows) => {
          rows.forEach(([code, name]) => {
            const normalizedCode = String(code || '').trim();
            const normalizedName = String(name || '').trim();
            if (normalizedCode || normalizedName) {
              finalCustomerPersonnelRows.push([normalizedCode, normalizedName]);
            }
          });
        });
      }

      const dedupFallbackCustomerPersonnel = new Map<string, readonly [string, string]>();
      finalCustomerPersonnelRows.forEach((row) => {
        dedupFallbackCustomerPersonnel.set(`${row[0]}__${row[1]}`, row);
      });
      const finalCustomerPersonnelRowsForTemplate = Array.from(dedupFallbackCustomerPersonnel.values())
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const finalCustomerPersonnelByCustomerCode = new Map<string, readonly (readonly [string, string])[]>();
      customerPersonnelByCustomerCode.forEach((rows, customerCode) => {
        finalCustomerPersonnelByCustomerCode.set(
          customerCode,
          [...rows].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
        );
      });

      const sourceChannelRows = ['Email', 'Điện thoại', 'Zalo', 'Portal', 'Khác'];
      const priorityRows = (priorityLabels.length > 0 ? priorityLabels : ['Thấp', 'Trung bình', 'Cao', 'Khẩn']).map((value) => [value]);
      const supportGroupRows = supportServiceGroups
        .map((group) => {
          const raw = group as unknown as Record<string, unknown>;
          const isDeleted = raw.deleted_at !== null && raw.deleted_at !== undefined && String(raw.deleted_at).trim() !== '';
          const isInactive = raw.is_active === false || raw.is_active === 0 || raw.is_active === '0';
          if (isDeleted || isInactive) {
            return null;
          }
          const code = String(group.group_code || '').trim();
          const name = String(group.group_name || '').trim();
          if (!code && !name) {
            return null;
          }
          return [code, name] as const;
        })
        .filter((row): row is readonly [string, string] => row !== null)
        .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

      const hasLookupData =
        customerRows.length > 0 ||
        projectItemRowsForTemplate.length > 0 ||
        finalCustomerPersonnelRowsForTemplate.length > 0 ||
        supportGroupRows.length > 0 ||
        personnelRows.length > 0;

      const { blob, fileName } = await createCrcIntakeTemplateWorkbook({
        fileNameBase: 'import_mau_customer_request_tiep_nhan',
        intakeSheetName: template.sheet || 'YeuCauNhap',
        taskSheetName: template.task_sheet || 'YeuCauTasks',
        viHeaders,
        viTaskHeaders,
        customerRows,
        projectItemRows: projectItemRowsForTemplate,
        customerPersonnelRows: finalCustomerPersonnelRowsForTemplate,
        supportGroupRows,
        personnelRows,
        projectItemByCustomerCode: finalProjectItemByCustomerCode,
        customerPersonnelByCustomerCode: finalCustomerPersonnelByCustomerCode,
        sourceChannelRows,
        priorityRows: priorityRows.map((row) => row[0]),
        taskSources,
        taskStatuses,
        hasLookupData,
        headerOrder: orderedHeaders,
      });

      triggerBrowserDownload(blob, fileName);

      notify('success', 'Template import', 'Đã tải file mẫu intake (.xlsx) có dropdown ở sheet YeuCauNhap.');
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Tải template thất bại',
          error instanceof Error ? error.message : 'Không thể tải template import.'
        );
      }
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, [
    canImportRequests,
    effectiveProjectItems,
    customers,
    customerPersonnel,
    supportServiceGroups,
    employees,
    isRequestCanceledError,
    notify,
    selectedWorkflowId,
  ]);


  const handleExportIntake = useCallback(async () => {
    if (!canExportRequests) {
      return;
    }

    setIsExportingIntake(true);
    try {
      const exported = await exportCustomerRequestIntake({
        q: requestKeyword || undefined,
        status_code: activeProcessCode || undefined,
      });
      triggerBrowserDownload(exported.blob, exported.filename || 'customer_request_intake.csv');
      notify('success', 'Export intake', 'Đã xuất danh sách CRC intake.');
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Export thất bại',
          error instanceof Error ? error.message : 'Không thể export danh sách intake.'
        );
      }
    } finally {
      setIsExportingIntake(false);
    }
  }, [activeProcessCode, canExportRequests, isRequestCanceledError, notify, requestKeyword]);

  const handleImportIntake = useCallback(async (payload: ImportPayload) => {
    setIsImportingIntake(true);
    try {
      const items = buildCrcIntakeImportItems(payload);
      if (items.length === 0) {
        notify('error', 'Import intake', 'File không có dòng dữ liệu hợp lệ để import.');
        return;
      }

      const result: CustomerRequestIntakeImportResult = await importCustomerRequestIntake(items, selectedWorkflowId);
      const failureMessages = (result.errors || []).map(
        (err) => `Dòng ${err.row_number}: ${err.error_message}`
      );

      if (result.success_rows > 0) {
        bumpDataVersion();
        notify(
          result.failed_rows > 0 ? 'warning' : 'success',
          'Import intake',
          `Thành công ${result.success_rows}/${result.total_rows} dòng.${result.failed_rows > 0 ? ` Lỗi ${result.failed_rows} dòng.` : ''}`
        );
      } else {
        notify('error', 'Import intake', 'Không có dòng nào được import thành công.');
      }

      if (failureMessages.length > 0) {
        exportImportFailureFile(payload, 'Customer Request Intake', failureMessages, (type, title, message) => {
          notify(type, title, message);
        });
      }

      if (result.failed_rows === 0) {
        setShowImportModal(false);
      }
    } catch (error: unknown) {
      if (!isRequestCanceledError(error)) {
        notify(
          'error',
          'Import intake thất bại',
          error instanceof Error ? error.message : 'Không thể import dữ liệu intake.'
        );
      }
      throw error;
    } finally {
      setIsImportingIntake(false);
    }
  }, [bumpDataVersion, isRequestCanceledError, notify, selectedWorkflowId]);

  const handleToggleSelectedRequestPin = useCallback(() => {
    if (selectedRequestSummary) {
      handleTogglePinnedRequest(selectedRequestSummary);
    }
  }, [handleTogglePinnedRequest, selectedRequestSummary]);

  const noopOpenCreatorFeedbackModal = useCallback(() => undefined, []);
  const noopOpenNotifyCustomerModal = useCallback(() => undefined, []);

  const handleRemoveModalIt360Task = useCallback(
    (localId: string) => {
      transitionHook.setModalIt360Tasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleRemoveModalReferenceTask = useCallback(
    (localId: string) => {
      transitionHook.setModalRefTasks((prev) =>
        prev.filter((task) => task.local_id !== localId)
      );
    },
    [transitionHook]
  );

  const handleDeleteModalAttachment = useCallback(
    (id: string) => {
      transitionHook.setModalAttachments((prev) =>
        prev.filter((attachment) => String(attachment.id) !== String(id))
      );
    },
    [transitionHook]
  );

  const handleCloseCreateMode = useCallback(() => {
    setIsCreateMode(false);
    setSelectedRequestId(null);
  }, []);

  // -------------------------------------------------------------------------
  // 12. Render
  // -------------------------------------------------------------------------

  /* Shared ListPane props */
  const listPaneProps = {
    activeProcessCode,
    processOptions,
    onProcessCodeChange: (v: string) => { setActiveProcessCode(v); setListPage(1); },
    requestKeyword,
    onRequestKeywordChange: (v: string) => { setRequestKeyword(v); setListPage(1); },
    requestCustomerFilter,
    onRequestCustomerFilterChange: (v: string) => { setRequestCustomerFilter(v); setListPage(1); },
    requestSupportGroupFilter,
    onRequestSupportGroupFilterChange: (v: string) => { setRequestSupportGroupFilter(v); setListPage(1); },
    requestPriorityFilter,
    onRequestPriorityFilterChange: (v: string) => { setRequestPriorityFilter(v); setListPage(1); },
    customerOptions,
    supportServiceGroups,
    requestMissingEstimateFilter,
    onToggleMissingEstimate: () => { setRequestMissingEstimateFilter((x) => !x); setListPage(1); },
    requestOverEstimateFilter,
    onToggleOverEstimate: () => { setRequestOverEstimateFilter((x) => !x); setListPage(1); },
    requestSlaRiskFilter,
    onToggleSlaRisk: () => { setRequestSlaRiskFilter((x) => !x); setListPage(1); },
    alertCounts,
    isDashboardLoading,
    rows: patchedListRows,
    isListLoading,
    selectedRequestId,
    onSelectRow: handleSelectRow,
    listPage,
    rowsPerPage: listPageSize,
    listMeta,
    onListPageChange: (page: number) => setListPage(page),
    onRowsPerPageChange: (rows: number) => {
      setListPageSize(rows);
      setListPage(1);
    },
    hasListFilters,
    onClearFilters: handleClearFilters,
    requestRoleFilter,
    presentation: 'responsive' as const,
    pinnedRequestIds,
    onTogglePinRequest: handleTogglePinnedRequest,
    onPrimaryAction: handleRunListPrimaryAction,
  } as const;

  const detailPaneNode = (
    <CustomerRequestDetailPane
      isDetailLoading={isDetailLoading}
      isListLoading={isListLoading}
      isCreateMode={false}
      isRequestSelected={selectedRequestId !== null}
      processDetail={processDetail}
      canTransitionActiveRequest={canTransitionActiveRequest}
      transitionOptions={transitionOptions}
      transitionStatusCode={transitionStatusCode}
      onTransitionStatusCodeChange={(v) => setTransitionStatusCode(v)}
      onOpenTransitionModal={handleOpenTransitionModal}
      isSaving={isSaving}
      canEditActiveForm={canEditActiveForm}
      onSaveRequest={handleUpdateCase}
      masterFields={masterFields}
      masterDraft={masterDraft}
      onMasterFieldChange={handleMasterFieldChange}
      editorProcessMeta={activeEditorMeta}
      processDraft={processDraft}
      onProcessDraftChange={handleProcessDraftChange}
      onSaveStatusDetail={handleSaveStatusDetail}
      onSaveTaskReference={handleSaveTaskReference}
      customers={customers}
      employees={employees}
      customerPersonnel={customerPersonnel}
      supportServiceGroups={supportServiceGroups}
      availableProjectItems={effectiveProjectItems}
      selectedProjectItem={selectedProjectItem}
      selectedCustomerId={selectedCustomerId}
      activeTaskTab={activeTaskTab}
      onActiveTaskTabChange={setActiveTaskTab}
      onAddTaskRow={handleAddTaskRow}
      formIt360Tasks={formIt360Tasks}
      onUpdateIt360TaskRow={handleUpdateIt360Row}
      onRemoveIt360TaskRow={handleRemoveIt360Row}
      formReferenceTasks={formReferenceTasks}
      formTags={formTags}
      onFormTagsChange={setFormTags}
      taskReferenceOptions={taskReferenceOptions}
      onUpdateReferenceTaskRow={handleUpdateRefRow}
      onTaskReferenceSearchTermChange={setSearchKeyword}
      taskReferenceSearchTerm={searchKeyword}
      taskReferenceSearchError={searchError}
      isTaskReferenceSearchLoading={isSearchLoading}
      onRemoveReferenceTaskRow={handleRemoveRefRow}
      formAttachments={formAttachments}
      onUploadAttachment={handleUploadAttachment}
      onDeleteAttachment={handleDeleteAttachment}
      isUploadingAttachment={isUploadingAttachment}
      attachmentError={attachmentError}
      attachmentNotice={attachmentNotice}
      relatedSummaryItems={relatedSummaryItems}
      currentHoursReport={currentHoursReport}
      estimateHistory={estimateHistory}
      timeline={timeline}
      caseWorklogs={caseWorklogs}
      canOpenCreatorFeedbackModal={false}
      onOpenCreatorFeedbackModal={() => undefined}
      canOpenNotifyCustomerModal={false}
      onOpenNotifyCustomerModal={() => undefined}
      canOpenWorklogModal={canOpenWorklogModal}
      onOpenWorklogModal={handleOpenWorklogModal}
      onOpenDetailStatusWorklogModal={handleOpenDetailStatusWorklogModal}
      onEditWorklog={handleEditWorklog}
      isSubmittingWorklog={isSubmittingWorklog}
      canOpenEstimateModal={canOpenEstimateModal}
      onOpenEstimateModal={handleOpenEstimateModal}
      isSubmittingEstimate={isSubmittingEstimate}
      dispatcherQuickActions={dispatcherQuickActions}
      onRunDispatcherAction={handleRunDispatcherAction}
      performerQuickActions={performerQuickActions}
      onRunPerformerAction={handleRunPerformerAction}
    />
  );

  const showDetailModal = selectedRequestId !== null;

  return (
    <div className="p-3 pb-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>support_agent</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Quản lý yêu cầu khách hàng</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Theo dõi và xử lý các yêu cầu từ khách hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdminViewer && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-tertiary">
              Chế độ xem quản trị
            </span>
          )}
          {canImportRequests && (
            <button
              type="button"
              onClick={handleDownloadIntakeTemplate}
              disabled={isDownloadingTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Tải mẫu
            </button>
          )}
          {canImportRequests && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              disabled={isImportingIntake}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
              Import
            </button>
          )}
          {canExportRequests && (
            <button
              type="button"
              onClick={handleExportIntake}
              disabled={isExportingIntake}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>ios_share</span>
              Export
            </button>
          )}
          {canWriteRequests && (
            <button
              type="button"
              onClick={handleCreateRequest}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors text-white shadow-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Thêm yêu cầu
            </button>
          )}
        </div>
      </div>

      {/* Sticky header: Workspace tabs + Surface switch + Refresh button */}
      <div className="sticky top-0 z-40 space-y-3 bg-white/95 backdrop-blur-sm">
        <CustomerRequestWorkspaceTabs
          activeTab={activeWorkspaceTab}
          onTabChange={handleWorkspaceTabChange}
          overviewActionCount={patchedOverviewDashboard?.attention_cases.length ?? 0}
          creatorActionCount={patchedCreatorBuckets.reviewRows.length + patchedCreatorBuckets.notifyRows.length}
          dispatcherActionCount={patchedDispatcherBuckets.queueRows.length + patchedDispatcherBuckets.returnedRows.length}
          performerActionCount={patchedPerformerBuckets.pendingRows.length}
          showPanels={activeSurface === 'inbox' && !isCreateMode}
          toolbar={
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <CustomerRequestSurfaceSwitch
                activeSurface={activeSurface}
                onSurfaceChange={(surface) => {
                  setActiveSurface(surface);
                  setActiveSavedViewId(null);
                }}
              />
              <button
                type="button"
                onClick={() => bumpDataVersion()}
                disabled={isDashboardLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                title="Làm mới dữ liệu"
              >
                <span className={`material-symbols-outlined ${isDashboardLoading ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
                  refresh
                </span>
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>
          }
        overviewWorkspace={
          <CustomerRequestOverviewWorkspace
            loading={isDashboardLoading}
            overviewDashboard={patchedOverviewDashboard}
            roleDashboards={patchedRoleDashboards}
            onOpenRequest={handleOpenRequest}
            onOpenWorkspace={handleOpenOverviewRoleWorkspace}
          />
        }
        creatorWorkspace={
          <CustomerRequestCreatorWorkspace
            loading={creatorWS.isLoading}
            creatorName={creatorName}
            totalRows={patchedCreatorRows.length}
            reviewRows={patchedCreatorBuckets.reviewRows}
            notifyRows={patchedCreatorBuckets.notifyRows}
            followUpRows={patchedCreatorBuckets.followUpRows}
            closedRows={patchedCreatorBuckets.closedRows}
            dashboard={patchedRoleDashboards.creator}
            onOpenRequest={handleOpenRequest}
            onCreateRequest={handleCreateRequest}
          />
        }
        dispatcherWorkspace={
          <CustomerRequestDispatcherWorkspace
            loading={dispatcherWS.isLoading}
            dispatcherName={currentUserName}
            totalRows={patchedDispatcherRows.length}
            queueRows={patchedDispatcherBuckets.queueRows}
            returnedRows={patchedDispatcherBuckets.returnedRows}
            feedbackRows={patchedDispatcherBuckets.feedbackRows}
            approvalRows={patchedDispatcherBuckets.approvalRows}
            activeRows={patchedDispatcherBuckets.activeRows}
            teamLoadRows={patchedDispatcherTeamLoadRows}
            pmWatchRows={patchedDispatcherPmWatchRows}
            dashboard={patchedRoleDashboards.dispatcher}
            onOpenRequest={handleOpenRequest}
          />
        }
        performerWorkspace={
          <CustomerRequestPerformerWorkspace
            loading={performerWS.isLoading}
            performerName={currentUserName}
            totalRows={patchedPerformerRows.length}
            pendingRows={patchedPerformerBuckets.pendingRows}
            activeRows={patchedPerformerBuckets.activeRows}
            timesheet={performerWS.timesheet}
            onOpenRequest={handleOpenRequest}
          />
        }
      />
      </div>

      <div ref={quickAccessAnchorRef} className={activeSurface === 'list' ? 'sticky top-[120px] z-30' : ''}>
        {shouldCollapseQuickAccessOnMobile ? (
          <div className="sticky top-[72px] z-20 mb-2 sm:hidden">
            <button
              type="button"
              onClick={handleRevealQuickAccess}
              aria-label="Lối tắt"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-slate-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 15 }}>
                bookmark_manager
              </span>
              <span>Lối tắt</span>
            </button>
          </div>
        ) : (
          <CustomerRequestQuickAccessBar
            activeSurface={activeSurface}
            savedViews={DEFAULT_CUSTOMER_REQUEST_SAVED_VIEWS}
            activeSavedViewId={activeSavedViewId}
            onApplySavedView={handleApplySavedView}
            onClearSavedView={handleClearSavedView}
            pinnedItems={pinnedItems}
            recentItems={recentItems}
            onOpenRequest={handleOpenQuickAccessItem}
            onRemovePinned={removePinnedRequest}
          />
        )}
      </div>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      {activeSurface === 'analytics' ? (
        <div>
        <CustomerRequestDashboardCards
          activeRoleFilter={dashboardRoleFilter}
          onRoleFilterChange={handleDashboardRoleFilterChange}
          overviewDashboard={patchedOverviewDashboard}
          roleDashboards={patchedRoleDashboards}
          isDashboardLoading={isDashboardLoading}
          activeProcessCode={activeProcessCode}
          onProcessCodeChange={(statusCode) => { setActiveProcessCode(statusCode); setListPage(1); }}
          getStatusCount={getStatusCount}
          onSelectAttentionCase={handleOpenRequest}
        />
        </div>
      ) : activeSurface === 'list' ? (
        <>
          <div className={`${layoutMode === 'mobile' ? 'h-[calc(100vh-240px)]' : 'h-[calc(100vh-240px)] md:h-[calc(100vh-200px)]'} flex-1 overflow-hidden ${selectedRequestId !== null && layoutMode !== 'mobile' ? 'md:w-[calc(100%-450px)]' : ''}`}>
            <CustomerRequestListPane {...listPaneProps} />
          </div>

          {/* Inline detail pane for desktop mode */}
          {!showDetailModal && selectedRequestId !== null && layoutMode !== 'mobile' && (
            <div className="absolute top-[152px] right-3 bottom-6 w-[420px] z-10">
              <CustomerRequestDetailFrame
                mode="inline"
                request={selectedRequestSummary}
                isPinned={isPinnedRequest(selectedRequestSummary?.id)}
                onTogglePinned={() => {
                  if (selectedRequestSummary) {
                    handleTogglePinnedRequest(selectedRequestSummary);
                  }
                }}
                onClose={handleCloseDetail}
              >
                {detailPaneNode}
              </CustomerRequestDetailFrame>
            </div>
          )}
        </>
      ) : null}

      {/* Detail modal — dùng một bề mặt duy nhất để hiển thị đủ thông tin
          cho mọi case đã chọn, thay cho inline pane / drawer cũ. */}
      {showDetailModal ? (
        <CustomerRequestDetailFrame
          mode="modal"
          request={selectedRequestSummary}
          isPinned={isPinnedRequest(selectedRequestSummary?.id)}
          onTogglePinned={() => {
            if (selectedRequestSummary) {
              handleTogglePinnedRequest(selectedRequestSummary);
            }
          }}
          onClose={handleCloseDetail}
        >
          {detailPaneNode}
        </CustomerRequestDetailFrame>
      ) : null}

      <CustomerRequestWorklogModal
        open={showWorklogModal}
        isSubmitting={isSubmittingWorklog}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        context={worklogModalContext}
        onClose={handleCloseWorklogModal}
        onSubmit={handleSubmitWorklog}
      />

      <CustomerRequestEstimateModal
        open={showEstimateModal}
        isSubmitting={isSubmittingEstimate}
        requestCode={selectedRequestSummary?.ma_yc ?? selectedRequestSummary?.request_code}
        requestSummary={selectedRequestSummary?.tieu_de ?? selectedRequestSummary?.summary}
        hoursReport={currentHoursReport}
        latestEstimate={estimateHistory[0] ?? currentHoursReport?.latest_estimate ?? null}
        onClose={() => setShowEstimateModal(false)}
        onSubmit={handleSubmitEstimate}
      />

      {/* Transition modal */}
      <CustomerRequestTransitionModal
        show={transitionHook.showTransitionModal}
        processDetail={processDetail}
        transitionStatusCode={transitionStatusCode}
        transitionRenderableFields={transitionRenderableFields}
        modalStatusPayload={transitionHook.modalStatusPayload}
        onModalStatusPayloadChange={handleModalStatusPayloadChange}
        modalIt360Tasks={transitionHook.modalIt360Tasks}
        onAddModalIt360Task={transitionHook.addModalIt360Task}
        onUpdateModalIt360Task={transitionHook.updateModalIt360Task}
        onRemoveModalIt360Task={(localId) =>
          transitionHook.setModalIt360Tasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalRefTasks={transitionHook.modalRefTasks}
        onAddModalReferenceTask={transitionHook.addModalReferenceTask}
        onUpdateModalReferenceTask={transitionHook.updateModalReferenceTask}
        onRemoveModalReferenceTask={(localId) =>
          transitionHook.setModalRefTasks((prev) =>
            prev.filter((t) => t.local_id !== localId)
          )
        }
        modalAttachments={transitionHook.modalAttachments}
        onUploadModalAttachment={transitionHook.handleModalUpload}
        onDeleteModalAttachment={(id) =>
          transitionHook.setModalAttachments((prev) =>
            prev.filter((a) => String(a.id) !== String(id))
          )
        }
        isModalUploading={transitionHook.isModalUploading}
        modalNotes={transitionHook.modalNotes}
        onModalNotesChange={transitionHook.setModalNotes}
        modalActiveTaskTab={transitionHook.modalActiveTaskTab}
        onModalActiveTaskTabChange={transitionHook.setModalActiveTaskTab}
        isTransitioning={transitionHook.isTransitioning}
        onClose={transitionHook.closeTransitionModal}
        onConfirm={transitionHook.handleTransitionConfirm}
        modalTimeline={transitionHook.modalTimeline}
        modalHandlerUserId={transitionHook.modalHandlerUserId}
        onModalHandlerUserIdChange={transitionHook.setModalHandlerUserId}
        projectRaciRows={projectRaciRows}
        employees={employees}
        customers={customers}
        customerPersonnel={customerPersonnel}
        supportServiceGroups={supportServiceGroups}
        projectItems={effectiveProjectItems}
        selectedCustomerId={selectedCustomerId}
        taskReferenceOptions={taskReferenceOptions}
        taskReferenceSearchError={searchError}
        taskReferenceSearchTerm={searchKeyword}
        onTaskReferenceSearchTermChange={setSearchKeyword}
        isTaskReferenceSearchLoading={isSearchLoading}
        caseContextAttachments={formAttachments}
        caseContextIt360Tasks={formIt360Tasks}
        caseContextReferenceTasks={formReferenceTasks}
      />

      {/* ── Modal tạo mới yêu cầu ──────────────────────────────────── */}
      {isCreateMode && (
        <CustomerRequestCreateModal
          masterFields={masterFields}
          masterDraft={masterDraft}
          onMasterFieldChange={handleMasterFieldChange}
          customers={customers}
          employees={employees}
          customerPersonnel={customerPersonnel}
          supportServiceGroups={supportServiceGroups}
          projectItems={effectiveProjectItems}
          /* attachments */
          formAttachments={formAttachments}
          onUploadAttachment={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
          isUploadingAttachment={isUploadingAttachment}
          attachmentError={attachmentError}
          attachmentNotice={attachmentNotice}
          /* it360 tasks */
          formIt360Tasks={formIt360Tasks}
          onAddIt360Task={handleAddIt360Task}
          onUpdateIt360TaskRow={handleUpdateIt360Row}
          onRemoveIt360TaskRow={handleRemoveIt360Row}
          /* reference tasks */
          formReferenceTasks={formReferenceTasks}
          onAddReferenceTask={handleAddReferenceTask}
          onUpdateReferenceTaskRow={handleUpdateRefRow}
          onRemoveReferenceTaskRow={handleRemoveRefRow}
          taskReferenceOptions={taskReferenceOptions}
          taskReferenceSearchTerm={searchKeyword}
          onTaskReferenceSearchTermChange={setSearchKeyword}
          taskReferenceSearchError={searchError}
          isTaskReferenceSearchLoading={isSearchLoading}
          /* tags */
          formTags={createFormTags}
          onTagsChange={setCreateFormTags}
          isSaving={isSaving}
          onSave={handleSaveCase}
          onClose={() => {
            setIsCreateMode(false);
            setSelectedRequestId(null);
          }}
        />
      )}

      {showImportModal ? (
        <ImportModal
          title="Import intake yêu cầu khách hàng"
          moduleKey="customer_request_intake"
          onClose={() => {
            if (!isImportingIntake) {
              setShowImportModal(false);
            }
          }}
          onSave={handleImportIntake}
          isLoading={isImportingIntake}
          loadingText="Đang import dữ liệu..."
        />
      ) : null}
    </div>
  );
};
