import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BulkMutationResult,
  Customer,
  CustomerPersonnel,
  Employee,
  PaginatedQuery,
  PaginationMeta,
  ProjectItemMaster,
  Product,
  Project,
  SupportRequest,
  SupportRequestReceiverResult,
  SupportRequestHistory,
  SupportRequestPriority,
  SupportRequestStatus,
  SupportRequestStatusOption,
  SupportRequestTask,
  SupportRequestTaskStatus,
  SupportServiceGroup,
} from '../types';
import { PaginationControls } from './PaginationControls';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { parseImportFile } from '../utils/importParser';

interface SupportRequestListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
    priority?: string;
    service_group_id?: string;
    assignee_id?: string;
    customer_id?: string;
    requested_from?: string;
    requested_to?: string;
  };
}

interface SupportRequestListProps {
  supportRequests: SupportRequest[];
  supportServiceGroups: SupportServiceGroup[];
  supportRequestStatuses: SupportRequestStatusOption[];
  supportRequestHistories: SupportRequestHistory[];
  projectItems: ProjectItemMaster[];
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projects: Project[];
  products: Product[];
  employees: Employee[];
  onCreateSupportServiceGroup: (
    payload: Partial<SupportServiceGroup>,
    options?: { silent?: boolean }
  ) => Promise<SupportServiceGroup>;
  onCreateSupportServiceGroupBulk: (
    payloads: Array<Partial<SupportServiceGroup>>,
    options?: { silent?: boolean }
  ) => Promise<BulkMutationResult<SupportServiceGroup>>;
  onCreateSupportRequestStatus: (
    payload: Partial<SupportRequestStatusOption>,
    options?: { silent?: boolean }
  ) => Promise<SupportRequestStatusOption>;
  onCreateSupportRequestStatusesBulk: (
    payloads: Array<Partial<SupportRequestStatusOption>>,
    options?: { silent?: boolean }
  ) => Promise<BulkMutationResult<SupportRequestStatusOption>>;
  onCreateSupportRequest: (payload: Partial<SupportRequest>) => Promise<void>;
  onUpdateSupportRequest: (id: string | number, payload: Partial<SupportRequest>) => Promise<void>;
  onDeleteSupportRequest: (id: string | number) => Promise<void>;
  onLoadSupportRequestHistory: (id: string | number) => Promise<SupportRequestHistory[]>;
  onLoadSupportRequestReceivers: (params?: {
    project_id?: string | number | null;
    project_item_id?: string | number | null;
  }) => Promise<SupportRequestReceiverResult>;
  onOpenImportModal: () => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: SupportRequestListQuery) => void;
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
  reporter_contact_id: string;
  assignee_id: string;
  receiver_user_id: string;
  status: SupportRequestStatus;
  priority: SupportRequestPriority;
  requested_date: string;
  due_date: string;
  resolved_date: string;
  hotfix_date: string;
  noti_date: string;
  task_link: string;
  notes: string;
}

interface SupportTaskFormRow {
  local_id: string;
  title: string;
  task_code: string;
  task_link: string;
  status: SupportRequestTaskStatus;
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
  selectedLines?: 1 | 2;
}

interface BlackDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
}

const DEFAULT_STATUS_OPTIONS: Array<{
  value: SupportRequestStatus;
  label: string;
  color: string;
  requires_completion_dates: boolean;
  is_terminal: boolean;
}> = [
  { value: 'NEW', label: 'Mới tiếp nhận', color: 'bg-blue-100 text-blue-700', requires_completion_dates: false, is_terminal: false },
  { value: 'IN_PROGRESS', label: 'Đang xử lý', color: 'bg-indigo-100 text-indigo-700', requires_completion_dates: true, is_terminal: false },
  { value: 'WAITING_CUSTOMER', label: 'Chờ phản hồi KH', color: 'bg-amber-100 text-amber-700', requires_completion_dates: true, is_terminal: false },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700', requires_completion_dates: true, is_terminal: true },
  { value: 'PAUSED', label: 'Tạm dừng', color: 'bg-yellow-100 text-yellow-700', requires_completion_dates: true, is_terminal: false },
  { value: 'TRANSFER_DEV', label: 'Chuyển dev', color: 'bg-orange-100 text-orange-700', requires_completion_dates: true, is_terminal: false },
  { value: 'TRANSFER_DMS', label: 'Chuyển DMS', color: 'bg-cyan-100 text-cyan-700', requires_completion_dates: true, is_terminal: false },
  { value: 'UNABLE_TO_EXECUTE', label: 'Không thực hiện được', color: 'bg-slate-200 text-slate-700', requires_completion_dates: true, is_terminal: true },
];

const PRIORITY_OPTIONS: Array<{ value: SupportRequestPriority; label: string; color: string }> = [
  { value: 'LOW', label: 'Thấp', color: 'bg-slate-100 text-slate-700' },
  { value: 'MEDIUM', label: 'Trung bình', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'Cao', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Khẩn cấp', color: 'bg-red-100 text-red-700' },
];

const SUPPORT_TASK_STATUS_OPTIONS: Array<{ value: SupportRequestTaskStatus; label: string }> = [
  { value: 'TODO', label: 'Vừa tạo' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'DONE', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Huỷ' },
  { value: 'BLOCKED', label: 'Chuyển sang task khác' },
];

const SUPPORT_TASK_STATUS_COLOR_MAP: Record<SupportRequestTaskStatus, string> = {
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-200 text-slate-700',
  BLOCKED: 'bg-orange-100 text-orange-700',
};

const SUPPORT_TASK_STATUS_ALIAS_MAP: Record<string, SupportRequestTaskStatus> = {
  TODO: 'TODO',
  VUATAO: 'TODO',
  CANLAM: 'TODO',

  INPROGRESS: 'IN_PROGRESS',
  DANGTHUCHIEN: 'IN_PROGRESS',
  DANGLAM: 'IN_PROGRESS',

  DONE: 'DONE',
  DAHOANTHANH: 'DONE',
  HOANTHANH: 'DONE',

  CANCELLED: 'CANCELLED',
  HUY: 'CANCELLED',

  BLOCKED: 'BLOCKED',
  CHUYENSANGTASKKHAC: 'BLOCKED',
  DANGCHAN: 'BLOCKED',
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

const resolveSupportTaskStatusLabel = (value: unknown): string => {
  const normalized = normalizeSupportTaskStatus(value);
  return SUPPORT_TASK_STATUS_OPTIONS.find((option) => option.value === normalized)?.label || 'Vừa tạo';
};

const resolveSupportTaskStatusColor = (value: unknown): string => {
  const normalized = normalizeSupportTaskStatus(value);
  return SUPPORT_TASK_STATUS_COLOR_MAP[normalized] || SUPPORT_TASK_STATUS_COLOR_MAP.TODO;
};

const normalizeToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const resolveDefaultStatusLabel = (status: string): string =>
  DEFAULT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const resolveDefaultStatusColor = (status: string): string =>
  DEFAULT_STATUS_OPTIONS.find((option) => option.value === status)?.color || 'bg-slate-100 text-slate-700';

const resolvePriorityLabel = (priority: string): string =>
  PRIORITY_OPTIONS.find((option) => option.value === priority)?.label || priority;

const resolvePriorityColor = (priority: string): string =>
  PRIORITY_OPTIONS.find((option) => option.value === priority)?.color || 'bg-slate-100 text-slate-700';

const toNullableText = (value: string): string | null => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

interface GroupImportDraft {
  group_name: string;
  description: string | null;
}

interface StatusImportDraft {
  status_code: string;
  status_name: string;
  description: string | null;
  requires_completion_dates: boolean;
  is_terminal: boolean;
}

const GROUP_IMPORT_NAME_ALIASES = [
  'tennhomzalotelegramyeucau',
  'tennhomzalotelegram',
  'tennhomhotro',
  'tennhom',
  'groupname',
  'name',
  'group',
];

const GROUP_IMPORT_DESCRIPTION_ALIASES = [
  'mota',
  'description',
  'ghichu',
  'note',
  'notes',
];

const STATUS_IMPORT_CODE_ALIASES = [
  'matrangthai',
  'statuscode',
  'code',
  'ma',
];

const STATUS_IMPORT_NAME_ALIASES = [
  'tentrangthai',
  'statusname',
  'trangthai',
  'name',
];

const STATUS_IMPORT_DESCRIPTION_ALIASES = [
  'mota',
  'description',
  'ghichu',
  'note',
  'notes',
];

const STATUS_IMPORT_REQUIRE_DATES_ALIASES = [
  'batbuocnhapngay',
  'requirescompletiondates',
  'requiresdates',
  'requiredates',
];

const STATUS_IMPORT_TERMINAL_ALIASES = [
  'ketthuc',
  'isterminal',
  'terminal',
  'endstate',
];

const buildImportHeaderIndex = (headers: string[]): Map<string, number> => {
  const map = new Map<string, number>();
  (headers || []).forEach((header, index) => {
    const token = normalizeToken(header).replace(/[^a-z0-9]+/g, '');
    if (token && !map.has(token)) {
      map.set(token, index);
    }
  });
  return map;
};

const getImportCellByAliases = (
  row: string[],
  headerIndex: Map<string, number>,
  aliases: string[]
): string => {
  for (const alias of aliases) {
    const columnIndex = headerIndex.get(alias);
    if (columnIndex !== undefined) {
      return String(row[columnIndex] || '').trim();
    }
  }
  return '';
};

const parseGroupDraftFromColumns = (rawName: string, rawDescription: string): GroupImportDraft | null => {
  const line = String(rawName || '').trim();
  if (!line) {
    return null;
  }

  if (rawDescription.trim()) {
    return {
      group_name: line,
      description: toNullableText(rawDescription),
    };
  }

  const separator = line.includes('|') ? '|' : line.includes('\t') ? '\t' : '';
  if (!separator) {
    return {
      group_name: line,
      description: null,
    };
  }

  const [namePart, ...descriptionParts] = line.split(separator);
  const groupName = String(namePart || '').trim();
  if (!groupName) {
    return null;
  }

  return {
    group_name: groupName,
    description: toNullableText(descriptionParts.join(separator)),
  };
};

const parseGroupDraftsFromPlainText = (rawText: string): GroupImportDraft[] =>
  String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseGroupDraftFromColumns(line, ''))
    .filter((item): item is GroupImportDraft => Boolean(item?.group_name));

const parseGroupDraftsFromSheet = (headers: string[], rows: string[][]): GroupImportDraft[] => {
  const headerIndex = buildImportHeaderIndex(headers || []);
  const hasNamedColumns = GROUP_IMPORT_NAME_ALIASES.some((alias) => headerIndex.has(alias));
  const dataRows = hasNamedColumns ? rows : [headers, ...(rows || [])];

  return dataRows
    .map((row) => {
      const firstColumnName = String(row[0] || '').trim();
      const firstColumnDescription = String(row[1] || '').trim();

      if (hasNamedColumns) {
        const groupName = getImportCellByAliases(row, headerIndex, GROUP_IMPORT_NAME_ALIASES);
        const description = getImportCellByAliases(row, headerIndex, GROUP_IMPORT_DESCRIPTION_ALIASES);
        return parseGroupDraftFromColumns(groupName, description);
      }

      return parseGroupDraftFromColumns(firstColumnName, firstColumnDescription);
    })
    .filter((item): item is GroupImportDraft => Boolean(item?.group_name));
};

const sanitizeStatusCode = (value: string): string =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

const buildStatusCodeFromName = (name: string): string => sanitizeStatusCode(normalizeToken(name).toUpperCase());

const parseBooleanLikeValue = (value: string, fallback: boolean): boolean => {
  const token = normalizeToken(value).replace(/[^a-z0-9]+/g, '');
  if (!token) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'co', 'cobatbuoc', 'batbuoc', 'required'].includes(token)) {
    return true;
  }

  if (['0', 'false', 'no', 'khong', 'khongbatbuoc', 'optional'].includes(token)) {
    return false;
  }

  return fallback;
};

const parseStatusDraftFromColumns = (
  rawCode: string,
  rawName: string,
  rawDescription: string,
  rawRequiresDates: string,
  rawIsTerminal: string
): StatusImportDraft | null => {
  const codeFromInput = sanitizeStatusCode(rawCode);
  const statusName = String(rawName || '').trim() || String(rawCode || '').trim();
  if (!statusName) {
    return null;
  }

  const statusCode = codeFromInput || buildStatusCodeFromName(statusName);
  if (!statusCode) {
    return null;
  }

  return {
    status_code: statusCode,
    status_name: statusName,
    description: toNullableText(rawDescription),
    requires_completion_dates: parseBooleanLikeValue(rawRequiresDates, statusCode !== 'NEW'),
    is_terminal: parseBooleanLikeValue(rawIsTerminal, ['COMPLETED', 'UNABLE_TO_EXECUTE'].includes(statusCode)),
  };
};

const parseStatusDraftFromLine = (rawLine: string): StatusImportDraft | null => {
  const line = String(rawLine || '').trim();
  if (!line) {
    return null;
  }

  const separator = line.includes('|') ? '|' : line.includes('\t') ? '\t' : '';
  if (!separator) {
    return parseStatusDraftFromColumns('', line, '', '', '');
  }

  const parts = line.split(separator).map((part) => String(part || '').trim());
  return parseStatusDraftFromColumns(
    parts[0] || '',
    parts[1] || '',
    parts[2] || '',
    parts[3] || '',
    parts[4] || ''
  );
};

const parseStatusDraftsFromPlainText = (rawText: string): StatusImportDraft[] =>
  String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseStatusDraftFromLine(line))
    .filter((item): item is StatusImportDraft => Boolean(item?.status_code && item?.status_name));

const parseStatusDraftsFromSheet = (headers: string[], rows: string[][]): StatusImportDraft[] => {
  const headerIndex = buildImportHeaderIndex(headers || []);
  const hasNamedColumns = STATUS_IMPORT_NAME_ALIASES.some((alias) => headerIndex.has(alias));
  const dataRows = hasNamedColumns ? rows : [headers, ...(rows || [])];

  return dataRows
    .map((row) => {
      if (hasNamedColumns) {
        const statusCode = getImportCellByAliases(row, headerIndex, STATUS_IMPORT_CODE_ALIASES);
        const statusName = getImportCellByAliases(row, headerIndex, STATUS_IMPORT_NAME_ALIASES);
        const description = getImportCellByAliases(row, headerIndex, STATUS_IMPORT_DESCRIPTION_ALIASES);
        const requiresDates = getImportCellByAliases(row, headerIndex, STATUS_IMPORT_REQUIRE_DATES_ALIASES);
        const isTerminal = getImportCellByAliases(row, headerIndex, STATUS_IMPORT_TERMINAL_ALIASES);
        return parseStatusDraftFromColumns(statusCode, statusName, description, requiresDates, isTerminal);
      }

      const code = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      const description = String(row[2] || '').trim();
      const requiresDates = String(row[3] || '').trim();
      const isTerminal = String(row[4] || '').trim();

      if (!name && code) {
        return parseStatusDraftFromColumns('', code, description, requiresDates, isTerminal);
      }

      return parseStatusDraftFromColumns(code, name, description, requiresDates, isTerminal);
    })
    .filter((item): item is StatusImportDraft => Boolean(item?.status_code && item?.status_name));
};

const formatVietnameseNumber = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const startOfCurrentYearIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};

const parseIsoDateString = (value: string): Date | null => {
  const normalized = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
};

const toIsoDateString = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDdMmYyyy = (value: string | null | undefined): string => {
  const parsed = parseIsoDateString(String(value || '').slice(0, 10));
  if (!parsed) {
    return '';
  }

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const startOfMonth = (value: Date): Date => new Date(value.getFullYear(), value.getMonth(), 1);

const addMonths = (value: Date, months: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + months, 1);

const normalizeDayTimestamp = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

const isDateOutOfRange = (value: Date, minDate: Date | null, maxDate: Date | null): boolean => {
  const current = normalizeDayTimestamp(value);
  if (minDate && current < normalizeDayTimestamp(minDate)) {
    return true;
  }
  if (maxDate && current > normalizeDayTimestamp(maxDate)) {
    return true;
  }
  return false;
};

const isSameCalendarDay = (left: Date | null, right: Date): boolean =>
  Boolean(
    left &&
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );

const buildCalendarDays = (monthView: Date): Array<{ date: Date; iso: string; isCurrentMonth: boolean }> => {
  const firstDay = new Date(monthView.getFullYear(), monthView.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    return {
      date,
      iso: toIsoDateString(date),
      isCurrentMonth: date.getMonth() === monthView.getMonth(),
    };
  });
};

const buildTaskRowId = (): string =>
  `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyTaskRow = (partial?: Partial<SupportTaskFormRow>): SupportTaskFormRow => ({
  local_id: partial?.local_id || buildTaskRowId(),
  title: partial?.title || '',
  task_code: partial?.task_code || '',
  task_link: partial?.task_link || '',
  status: normalizeSupportTaskStatus(partial?.status || 'TODO'),
});

const mapSupportRequestTasksToFormRows = (request: SupportRequest | null | undefined): SupportTaskFormRow[] => {
  const rawTasks = Array.isArray(request?.tasks) ? request?.tasks : [];
  const mappedRows = rawTasks
    .map((task) => createEmptyTaskRow({
      title: String(task?.title || ''),
      task_code: String(task?.task_code || ''),
      task_link: String(task?.task_link || ''),
      status: normalizeSupportTaskStatus(task?.status || 'TODO'),
    }))
    .filter((row) => row.title.trim() !== '' || row.task_code.trim() !== '' || row.task_link.trim() !== '');

  if (mappedRows.length > 0) {
    return mappedRows;
  }

  const legacyTaskCode = String(request?.ticket_code || '').trim();
  const legacyTaskLink = String(request?.task_link || '').trim();
  if (legacyTaskCode || legacyTaskLink) {
    return [createEmptyTaskRow({ task_code: legacyTaskCode, task_link: legacyTaskLink })];
  }

  return [createEmptyTaskRow()];
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
    reporter_contact_id: '',
    assignee_id: '',
    receiver_user_id: '',
    status: 'NEW',
    priority: 'MEDIUM',
    requested_date: today,
    due_date: '',
    resolved_date: '',
    hotfix_date: '',
    noti_date: '',
    task_link: '',
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
    reporter_contact_id: String(request.reporter_contact_id || ''),
    assignee_id: String(request.assignee_id || ''),
    receiver_user_id: String(request.receiver_user_id || ''),
    status: request.status || 'NEW',
    priority: request.priority || 'MEDIUM',
    requested_date: String(request.requested_date || today),
    due_date: String(request.due_date || ''),
    resolved_date: String(request.resolved_date || ''),
    hotfix_date: String(request.hotfix_date || ''),
    noti_date: String(request.noti_date || ''),
    task_link: String(request.task_link || ''),
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
  selectedLines = 1,
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
        className={`w-full px-4 rounded-lg border border-slate-300 bg-white text-left text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
          selectedLines === 2 ? 'min-h-11 py-2.5' : 'h-11'
        }`}
        title={selectedOption?.label || ''}
      >
        <span
          className={`${selectedOption ? 'text-slate-900' : 'text-slate-400'} block pr-8 leading-5`}
          style={selectedLines === 2 ? {
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } : undefined}
        >
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
                  title={option.label}
                >
                  <span className="block whitespace-normal break-words leading-5">{option.label}</span>
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

const DATE_PICKER_WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DATE_PICKER_MONTH_FORMATTER = new Intl.DateTimeFormat('vi-VN', {
  month: 'long',
  year: 'numeric',
});

const BlackDatePicker: React.FC<BlackDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  disabled = false,
  className = '',
  min,
  max,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const parsed = parseIsoDateString(value);
    return startOfMonth(parsed || new Date());
  });

  const selectedDate = useMemo(() => parseIsoDateString(value), [value]);
  const minDate = useMemo(() => parseIsoDateString(String(min || '')), [min]);
  const maxDate = useMemo(() => parseIsoDateString(String(max || '')), [max]);
  const displayValue = formatDateDdMmYyyy(value);

  useEffect(() => {
    const parsed = parseIsoDateString(value);
    if (parsed) {
      setViewMonth(startOfMonth(parsed));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dayCells = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const selectDate = (date: Date) => {
    if (isDateOutOfRange(date, minDate, maxDate)) {
      return;
    }

    onChange(toIsoDateString(date));
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-white/95 text-left text-slate-900 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none hover:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
      >
        <span className={displayValue ? 'text-slate-900' : 'text-slate-400'}>{displayValue || placeholder}</span>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          calendar_month
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-[95] mt-2 w-full min-w-[300px] rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => addMonths(prev, -1))}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500"
              aria-label="Tháng trước"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <p className="text-sm font-semibold text-slate-700 capitalize">{DATE_PICKER_MONTH_FORMATTER.format(viewMonth)}</p>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500"
              aria-label="Tháng sau"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          <div className="px-2 pt-2">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DATE_PICKER_WEEK_DAYS.map((dayLabel) => (
                <div key={dayLabel} className="h-8 flex items-center justify-center text-[11px] font-semibold text-slate-400">
                  {dayLabel}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 pb-2">
              {dayCells.map((dayCell) => {
                const isDisabled = isDateOutOfRange(dayCell.date, minDate, maxDate);
                const isSelected = isSameCalendarDay(selectedDate, dayCell.date);
                return (
                  <button
                    key={dayCell.iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(dayCell.date)}
                    className={`h-9 rounded-md text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : dayCell.isCurrentMonth
                          ? 'text-slate-700 hover:bg-teal-50'
                          : 'text-slate-300 hover:bg-slate-50'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
                  >
                    {dayCell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Xóa ngày
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayIso());
                setViewMonth(startOfMonth(new Date()));
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-primary hover:text-deep-teal"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const SupportRequestList: React.FC<SupportRequestListProps> = ({
  supportRequests = [],
  supportServiceGroups = [],
  supportRequestStatuses = [],
  supportRequestHistories = [],
  projectItems = [],
  customers = [],
  customerPersonnel = [],
  projects = [],
  products = [],
  employees = [],
  onCreateSupportServiceGroup,
  onCreateSupportServiceGroupBulk,
  onCreateSupportRequestStatus,
  onCreateSupportRequestStatusesBulk,
  onCreateSupportRequest,
  onUpdateSupportRequest,
  onDeleteSupportRequest,
  onLoadSupportRequestHistory,
  onLoadSupportRequestReceivers,
  onOpenImportModal,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const onQueryChangeRef = useRef(onQueryChange);
  const onLoadSupportRequestReceiversRef = useRef(onLoadSupportRequestReceivers);
  const receiverRequestVersionRef = useRef(0);
  const historyCacheRef = useRef<Record<string, SupportRequestHistory[]>>({});
  const historySectionRef = useRef<HTMLDivElement>(null);
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
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingRequest, setEditingRequest] = useState<SupportRequest | null>(null);
  const [formData, setFormData] = useState<SupportRequestFormState>(emptyFormState);
  const [formTasks, setFormTasks] = useState<SupportTaskFormRow[]>(() => [createEmptyTaskRow()]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<SupportRequest | null>(null);
  const [historyRows, setHistoryRows] = useState<SupportRequestHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [groupImportText, setGroupImportText] = useState('');
  const [groupImportFile, setGroupImportFile] = useState<File | null>(null);
  const [groupImportFileName, setGroupImportFileName] = useState('');
  const [groupFormError, setGroupFormError] = useState('');
  const [groupFormSuccess, setGroupFormSuccess] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const groupImportFileInputRef = useRef<HTMLInputElement>(null);

  const [isCreateStatusOpen, setIsCreateStatusOpen] = useState(false);
  const [newStatusCode, setNewStatusCode] = useState('');
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusDescription, setNewStatusDescription] = useState('');
  const [newStatusRequiresDates, setNewStatusRequiresDates] = useState(true);
  const [newStatusIsTerminal, setNewStatusIsTerminal] = useState(false);
  const [statusImportText, setStatusImportText] = useState('');
  const [statusImportFile, setStatusImportFile] = useState<File | null>(null);
  const [statusImportFileName, setStatusImportFileName] = useState('');
  const [statusFormError, setStatusFormError] = useState('');
  const [statusFormSuccess, setStatusFormSuccess] = useState('');
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const statusImportFileInputRef = useRef<HTMLInputElement>(null);

  const [receiverOptions, setReceiverOptions] = useState<SearchableSelectOption[]>([
    { value: '', label: 'Chọn người tiếp nhận' },
  ]);
  const [isReceiverLoading, setIsReceiverLoading] = useState(false);

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  useEffect(() => {
    onLoadSupportRequestReceiversRef.current = onLoadSupportRequestReceivers;
  }, [onLoadSupportRequestReceivers]);

  const activeGroups = useMemo(
    () =>
      (supportServiceGroups || [])
        .filter((group) => group.is_active !== false)
        .sort((a, b) => String(a.group_name || '').localeCompare(String(b.group_name || ''), 'vi')),
    [supportServiceGroups]
  );

  const groupOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả nhóm Zalo/Telegram yêu cầu' },
      ...activeGroups.map((group) => ({ value: String(group.id), label: group.group_name })),
    ],
    [activeGroups]
  );

  const statusDefinitions = useMemo(() => {
    const colorMap = new Map(DEFAULT_STATUS_OPTIONS.map((item) => [item.value, item.color]));
    const defaultsByCode = new Map(
      DEFAULT_STATUS_OPTIONS.map((item) => [item.value, item])
    );
    const resultByCode = new Map<string, {
      value: string;
      label: string;
      color: string;
      requires_completion_dates: boolean;
      is_terminal: boolean;
      sort_order: number;
      is_active: boolean;
    }>();

    (supportRequestStatuses || []).forEach((row, index) => {
      const code = sanitizeStatusCode(String(row.status_code || ''));
      const name = String(row.status_name || '').trim();
      if (!code || !name) {
        return;
      }

      const defaultItem = defaultsByCode.get(code);
      resultByCode.set(code, {
        value: code,
        label: name,
        color: colorMap.get(code) || 'bg-slate-100 text-slate-700',
        requires_completion_dates:
          row.requires_completion_dates === undefined
            ? (defaultItem?.requires_completion_dates ?? code !== 'NEW')
            : Boolean(row.requires_completion_dates),
        is_terminal:
          row.is_terminal === undefined
            ? (defaultItem?.is_terminal ?? false)
            : Boolean(row.is_terminal),
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index + 1,
        is_active: row.is_active !== false,
      });
    });

    DEFAULT_STATUS_OPTIONS.forEach((item, index) => {
      if (resultByCode.has(item.value)) {
        return;
      }

      resultByCode.set(item.value, {
        value: item.value,
        label: item.label,
        color: item.color,
        requires_completion_dates: item.requires_completion_dates,
        is_terminal: item.is_terminal,
        sort_order: (index + 1) * 10,
        is_active: true,
      });
    });

    return Array.from(resultByCode.values())
      .filter((item) => item.is_active)
      .sort((left, right) => {
        const orderCompare = left.sort_order - right.sort_order;
        if (orderCompare !== 0) {
          return orderCompare;
        }
        return left.label.localeCompare(right.label, 'vi');
      });
  }, [supportRequestStatuses]);

  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    statusDefinitions.forEach((item) => map.set(item.value, item.label));
    return map;
  }, [statusDefinitions]);

  const statusColorMap = useMemo(() => {
    const map = new Map<string, string>();
    statusDefinitions.forEach((item) => map.set(item.value, item.color));
    return map;
  }, [statusDefinitions]);

  const statusRequiresCompletionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    statusDefinitions.forEach((item) => map.set(item.value, Boolean(item.requires_completion_dates)));
    return map;
  }, [statusDefinitions]);

  const statusTerminalSet = useMemo(() => {
    const values = statusDefinitions
      .filter((item) => item.is_terminal)
      .map((item) => item.value);
    return new Set(values);
  }, [statusDefinitions]);

  const resolveStatusLabel = (status: string): string =>
    statusLabelMap.get(String(status || '').trim()) || resolveDefaultStatusLabel(String(status || '').trim());

  const resolveStatusColor = (status: string): string =>
    statusColorMap.get(String(status || '').trim()) || resolveDefaultStatusColor(String(status || '').trim());

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
      { value: '', label: 'Chọn phần mềm triển khai' },
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
      ...statusDefinitions.map((option) => ({ value: option.value, label: option.label })),
    ],
    [statusDefinitions]
  );

  const priorityFilterOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Tất cả ưu tiên' },
      ...PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    ],
    []
  );

  const statusFormOptions = useMemo<SearchableSelectOption[]>(
    () => statusDefinitions.map((option) => ({ value: option.value, label: option.label })),
    [statusDefinitions]
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

  const receiverFallbackOptions = useMemo<SearchableSelectOption[]>(
    () => [
      { value: '', label: 'Chọn người tiếp nhận' },
      ...employeeFormOptions
        .filter((option) => option.value !== '')
        .map((option) => ({ value: option.value, label: option.label })),
    ],
    [employeeFormOptions]
  );

  const customerPersonnelById = useMemo(() => {
    const map = new Map<string, CustomerPersonnel>();
    (customerPersonnel || []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [customerPersonnel]);

  const reporterContactOptions = useMemo<SearchableSelectOption[]>(() => {
    const customerId = String(formData.customer_id || '');
    const rows = (customerPersonnel || [])
      .filter((item) => String(item.customerId || '') === customerId && item.status !== 'Inactive')
      .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'));

    return [
      { value: '', label: 'Chọn người báo yêu cầu' },
      ...rows.map((item) => {
        const phone = item.phoneNumber ? ` | ${item.phoneNumber}` : '';
        return {
          value: String(item.id),
          label: `${item.fullName}${phone}`,
        };
      }),
    ];
  }, [customerPersonnel, formData.customer_id]);

  const handleProjectItemChange = (value: string) => {
    const selected = projectItemMap.get(String(value || ''));
    setFormData((prev) => ({
      ...prev,
      project_item_id: value,
      customer_id: selected?.customer_id ? String(selected.customer_id) : '',
      project_id: selected?.project_id ? String(selected.project_id) : '',
      product_id: selected?.product_id ? String(selected.product_id) : '',
      reporter_contact_id:
        selected?.customer_id && String(selected.customer_id) === String(prev.customer_id || '')
          ? prev.reporter_contact_id
          : '',
      reporter_name:
        selected?.customer_id && String(selected.customer_id) === String(prev.customer_id || '')
          ? prev.reporter_name
          : '',
    }));
  };

  const openCreateModal = () => {
    setFormMode('ADD');
    setEditingRequest(null);
    setFormData(emptyFormState());
    setFormTasks([createEmptyTaskRow()]);
    setFormError('');
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
  };

  const resetCreateGroupModalState = () => {
    setNewGroupName('');
    setNewGroupDescription('');
    setGroupImportText('');
    setGroupImportFile(null);
    setGroupImportFileName('');
    setGroupFormError('');
    setGroupFormSuccess('');
    setIsCreatingGroup(false);
    if (groupImportFileInputRef.current) {
      groupImportFileInputRef.current.value = '';
    }
  };

  const openCreateGroupModal = () => {
    resetCreateGroupModalState();
    setIsCreateGroupOpen(true);
  };

  const closeCreateGroupModal = () => {
    setIsCreateGroupOpen(false);
    resetCreateGroupModalState();
  };

  const resetCreateStatusModalState = () => {
    setNewStatusCode('');
    setNewStatusName('');
    setNewStatusDescription('');
    setNewStatusRequiresDates(true);
    setNewStatusIsTerminal(false);
    setStatusImportText('');
    setStatusImportFile(null);
    setStatusImportFileName('');
    setStatusFormError('');
    setStatusFormSuccess('');
    setIsCreatingStatus(false);
    if (statusImportFileInputRef.current) {
      statusImportFileInputRef.current.value = '';
    }
  };

  const openCreateStatusModal = () => {
    resetCreateStatusModalState();
    setIsCreateStatusOpen(true);
  };

  const closeCreateStatusModal = () => {
    setIsCreateStatusOpen(false);
    resetCreateStatusModalState();
  };

  const openEditModal = (request: SupportRequest) => {
    setFormMode('EDIT');
    setEditingRequest(request);
    setFormData(requestToFormState(request));
    setFormTasks(mapSupportRequestTasksToFormRows(request));
    setFormError('');
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
  };

  const closeFormModal = () => {
    setFormMode(null);
    setEditingRequest(null);
    setFormData(emptyFormState());
    setFormTasks([createEmptyTaskRow()]);
    setFormError('');
    setIsSubmitting(false);
    setIsCreateGroupOpen(false);
    setIsCreateStatusOpen(false);
    resetCreateGroupModalState();
    resetCreateStatusModalState();
    setReceiverOptions(receiverFallbackOptions);
    setIsReceiverLoading(false);
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

  useEffect(() => {
    if (!formMode || !formData.reporter_contact_id) {
      return;
    }

    const stillExists = reporterContactOptions.some((option) => option.value === formData.reporter_contact_id);
    if (!stillExists) {
      setFormData((prev) => ({
        ...prev,
        reporter_contact_id: '',
      }));
    }
  }, [formMode, formData.reporter_contact_id, reporterContactOptions]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const selectedContact = customerPersonnelById.get(String(formData.reporter_contact_id || ''));
    if (!selectedContact) {
      return;
    }

    const normalizedName = String(selectedContact.fullName || '').trim();
    if (!normalizedName || normalizedName === String(formData.reporter_name || '').trim()) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      reporter_name: normalizedName,
    }));
  }, [formMode, formData.reporter_contact_id, formData.reporter_name, customerPersonnelById]);

  useEffect(() => {
    if (!formMode) {
      return;
    }

    const projectId = String(formData.project_id || '').trim();
    const projectItemId = String(formData.project_item_id || '').trim();
    if (!projectId && !projectItemId) {
      setReceiverOptions(receiverFallbackOptions);
      setFormData((prev) => {
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
        const response = await onLoadSupportRequestReceiversRef.current({
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
            const raciRole = String(option.raci_role || '').trim();
            const roleLabel = raciRole ? ` [${raciRole}]` : '';
            const label = code ? `${code} - ${displayName}${roleLabel}` : `${displayName}${roleLabel}`;
            return {
              value: userId,
              label: label.trim(),
            };
          })),
        ].filter((option) => option.value === '' || option.label.trim() !== '');

        const nextOptions = raciOptions.length > 1 ? raciOptions : receiverFallbackOptions;
        setReceiverOptions(nextOptions);

        const defaultReceiverId = String(response?.default_receiver_user_id || '').trim();
        setFormData((prev) => {
          const availableValues = new Set(nextOptions.map((option) => option.value));
          let nextReceiver = prev.receiver_user_id;

          if (nextReceiver && !availableValues.has(nextReceiver)) {
            nextReceiver = '';
          }

          if (!nextReceiver && defaultReceiverId && availableValues.has(defaultReceiverId)) {
            nextReceiver = defaultReceiverId;
          }

          if (nextReceiver === prev.receiver_user_id) {
            return prev;
          }

          return {
            ...prev,
            receiver_user_id: nextReceiver,
          };
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
  }, [formMode, formData.project_id, formData.project_item_id, receiverFallbackOptions]);

  const filteredRequests = useMemo(() => {
    if (serverMode) {
      return supportRequests || [];
    }

    const keyword = normalizeToken(searchTerm.trim());

    return (supportRequests || []).filter((item) => {
      const customerLabel = item.customer_name || customerMap.get(String(item.customer_id)) || '';
      const assigneeLabel = item.assignee_name || employeeMap.get(String(item.assignee_id || '')) || '';
      const groupLabel = item.service_group_name || '';
      const taskSearchText = (item.tasks || [])
        .map((task) => `${task.task_code || ''} ${task.title || ''} ${task.task_link || ''}`)
        .join(' ');
      const matchesSearch = keyword
        ? normalizeToken(String(item.ticket_code || '')).includes(keyword) ||
          normalizeToken(String(item.summary || '')).includes(keyword) ||
          normalizeToken(taskSearchText).includes(keyword) ||
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
    serverMode,
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

  const historySourceRows = useMemo(
    () => (historyTarget ? historyRows : []),
    [historyTarget, historyRows]
  );

  const filteredHistories = useMemo(() => {
    const keyword = normalizeToken(historySearchTerm.trim());
    if (!keyword) {
      return historySourceRows;
    }

    return historySourceRows.filter((history) => {
      const ticket = history.ticket_code || '';
      const summary = history.request_summary || '';
      const actor = history.created_by_name || history.created_by_username || 'Hệ thống';
      return (
        normalizeToken(ticket).includes(keyword) ||
        normalizeToken(summary).includes(keyword) ||
        normalizeToken(actor).includes(keyword) ||
        normalizeToken(resolveStatusLabel(history.new_status)).includes(keyword) ||
        normalizeToken(resolveStatusLabel(history.old_status || 'NEW')).includes(keyword)
      );
    });
  }, [historySourceRows, historySearchTerm, statusLabelMap]);

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredRequests.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode) {
      return;
    }

    setCurrentPage(1);
  }, [
    serverMode,
    searchTerm,
    statusFilter,
    priorityFilter,
    groupFilter,
    assigneeFilter,
    customerFilter,
    requestedFromFilter,
    requestedToFilter,
  ]);

  useEffect(() => {
    if (!serverMode || !onQueryChangeRef.current) {
      return;
    }

    const debounceId = window.setTimeout(() => {
      onQueryChangeRef.current?.({
        page: currentPage,
        per_page: rowsPerPage,
        q: searchTerm.trim(),
        sort_by: 'requested_date',
        sort_dir: 'desc',
        filters: {
          status: statusFilter,
          priority: priorityFilter,
          service_group_id: groupFilter,
          assignee_id: assigneeFilter,
          customer_id: customerFilter,
          requested_from: requestedFromFilter,
          requested_to: requestedToFilter,
        },
      });
    }, 300);

    return () => window.clearTimeout(debounceId);
  }, [
    serverMode,
    currentPage,
    rowsPerPage,
    searchTerm,
    statusFilter,
    priorityFilter,
    groupFilter,
    assigneeFilter,
    customerFilter,
    requestedFromFilter,
    requestedToFilter,
  ]);

  const currentData = useMemo(
    () => (serverMode
      ? (supportRequests || [])
      : filteredRequests.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)),
    [serverMode, supportRequests, filteredRequests, currentPage, rowsPerPage]
  );

  const parseKpiValue = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  };

  const approachingDueFallback = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return (supportRequests || []).filter((item) => {
      if (!item.due_date) return false;
      if (statusTerminalSet.has(String(item.status || '').trim())) return false;

      const dueDate = new Date(`${item.due_date}T00:00:00`);
      if (Number.isNaN(dueDate.getTime())) return false;

      const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);
      return diffDays >= 0 && diffDays <= 1;
    }).length;
  }, [supportRequests, statusTerminalSet]);

  const totalRequests = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.total_requests);
    }

    return supportRequests.length;
  }, [serverMode, paginationMeta, supportRequests]);

  const totalNewCount = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.new_count);
    }

    return (supportRequests || []).filter((item) => item.status === 'NEW').length;
  }, [serverMode, paginationMeta, supportRequests]);

  const totalInProgress = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.in_progress_count);
    }

    return (supportRequests || []).filter((item) => item.status === 'IN_PROGRESS').length;
  }, [serverMode, paginationMeta, supportRequests]);

  const totalWaitingCustomer = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.waiting_customer_count);
    }

    return (supportRequests || []).filter((item) => item.status === 'WAITING_CUSTOMER').length;
  }, [serverMode, paginationMeta, supportRequests]);

  const totalApproachingDue = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.approaching_due_count);
    }

    return approachingDueFallback;
  }, [serverMode, paginationMeta, approachingDueFallback]);

  const overdueFallback = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return (supportRequests || []).filter((item) => {
      if (!item.due_date) return false;
      if (statusTerminalSet.has(String(item.status || '').trim())) return false;

      const dueDate = new Date(`${item.due_date}T00:00:00`);
      if (Number.isNaN(dueDate.getTime())) return false;

      return dueDate.getTime() < now.getTime();
    }).length;
  }, [supportRequests, statusTerminalSet]);

  const totalOverdue = useMemo(() => {
    if (serverMode && paginationMeta?.kpis) {
      return parseKpiValue(paginationMeta.kpis.overdue_count);
    }

    return overdueFallback;
  }, [serverMode, paginationMeta, overdueFallback]);

  const formStatusRequiresCompletionDates =
    statusRequiresCompletionMap.get(String(formData.status || '').trim()) ?? (formData.status !== 'NEW');

  const updateFormTaskRow = (localId: string, field: keyof Omit<SupportTaskFormRow, 'local_id'>, value: string) => {
    setFormTasks((prev) =>
      prev.map((row) => {
        if (row.local_id !== localId) {
          return row;
        }

        if (field === 'status') {
          return { ...row, status: normalizeSupportTaskStatus(value) };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const addFormTaskRow = () => {
    setFormTasks((prev) => [...prev, createEmptyTaskRow()]);
  };

  const removeFormTaskRow = (localId: string) => {
    setFormTasks((prev) => {
      const next = prev.filter((row) => row.local_id !== localId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const requiresCompletionDates =
      statusRequiresCompletionMap.get(String(formData.status || '').trim()) ?? (formData.status !== 'NEW');

    if (!formData.summary.trim()) {
      setFormError('Nội dung yêu cầu là bắt buộc.');
      return;
    }
    if (!formData.project_item_id) {
      setFormError('Phần mềm triển khai là bắt buộc.');
      return;
    }
    if (!formData.requested_date) {
      setFormError('Ngày nhận yêu cầu là bắt buộc.');
      return;
    }
    if (requiresCompletionDates && !formData.due_date) {
      setFormError('Hạn hoàn thành là bắt buộc khi trạng thái khác "Mới tiếp nhận".');
      return;
    }
    if (requiresCompletionDates && !formData.resolved_date) {
      setFormError('Ngày hoàn thành TT là bắt buộc khi trạng thái khác "Mới tiếp nhận".');
      return;
    }
    if (formData.requested_date && formData.due_date && formData.due_date < formData.requested_date) {
      setFormError('Hạn hoàn thành phải lớn hơn hoặc bằng Ngày nhận yêu cầu.');
      return;
    }

    const normalizedTasks = formTasks
      .map((row, index) => ({
        title: row.title.trim() || null,
        task_code: row.task_code.trim() || null,
        task_link: row.task_link.trim() || null,
        status: normalizeSupportTaskStatus(row.status || 'TODO'),
        sort_order: index,
      }))
      .filter((row) => row.title || row.task_code || row.task_link);

    setIsSubmitting(true);
    setFormError('');

    const selectedReporterContact = customerPersonnelById.get(String(formData.reporter_contact_id || ''));
    const resolvedReporterName = selectedReporterContact?.fullName || formData.reporter_name;
    const firstTask = normalizedTasks[0];

    const payload: Partial<SupportRequest> = {
      ticket_code: firstTask?.task_code || null,
      summary: formData.summary.trim(),
      service_group_id: toNullableText(formData.service_group_id),
      project_item_id: toNullableText(formData.project_item_id),
      customer_id: formData.customer_id,
      project_id: toNullableText(formData.project_id),
      product_id: toNullableText(formData.product_id),
      reporter_name: toNullableText(resolvedReporterName),
      reporter_contact_id: toNullableText(formData.reporter_contact_id),
      assignee_id: toNullableText(formData.assignee_id),
      receiver_user_id: toNullableText(formData.receiver_user_id),
      status: formData.status,
      priority: formData.priority,
      requested_date: formData.requested_date,
      due_date: toNullableText(formData.due_date),
      resolved_date: toNullableText(formData.resolved_date),
      hotfix_date: toNullableText(formData.hotfix_date),
      noti_date: toNullableText(formData.noti_date),
      task_link: firstTask?.task_link || null,
      tasks: normalizedTasks as SupportRequestTask[],
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
      setGroupFormError('Tên nhóm Zalo/Telegram yêu cầu là bắt buộc.');
      return;
    }

    setGroupFormSuccess('');
    setGroupFormError('');
    setIsCreatingGroup(true);
    try {
      const created = await onCreateSupportServiceGroup({
        group_name: groupName,
        description: toNullableText(newGroupDescription),
        is_active: true,
      });
      setFormData((prev) => ({ ...prev, service_group_id: String(created.id) }));
      closeCreateGroupModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo nhóm Zalo/Telegram yêu cầu.';
      setGroupFormError(message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleGroupImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setGroupImportFile(file);
    setGroupImportFileName(file?.name || '');
    setGroupFormError('');
    setGroupFormSuccess('');
    event.target.value = '';
  };

  const loadGroupDraftsFromFile = async (file: File): Promise<GroupImportDraft[]> => {
    const fileName = String(file.name || '').toLowerCase();
    if (fileName.endsWith('.txt')) {
      const text = await file.text();
      return parseGroupDraftsFromPlainText(text);
    }

    const parsedFile = await parseImportFile(file);
    const candidateSheet = (parsedFile.sheets || []).find(
      (sheet) => (sheet.headers || []).length > 0 || (sheet.rows || []).length > 0
    );

    if (!candidateSheet) {
      return [];
    }

    return parseGroupDraftsFromSheet(candidateSheet.headers || [], candidateSheet.rows || []);
  };

  const handleCreateGroupBulk = async () => {
    const draftsFromText = parseGroupDraftsFromPlainText(groupImportText);
    let draftsFromFile: GroupImportDraft[] = [];

    setGroupFormSuccess('');
    setGroupFormError('');

    if (groupImportFile) {
      try {
        draftsFromFile = await loadGroupDraftsFromFile(groupImportFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể đọc file import nhóm.';
        setGroupFormError(message);
        return;
      }
    }

    const mergedDrafts = [...draftsFromText, ...draftsFromFile];
    if (mergedDrafts.length === 0) {
      setGroupFormError('Vui lòng nhập danh sách nhóm hoặc chọn file để import.');
      return;
    }

    const existingTokens = new Set(
      (activeGroups || []).map((group) => normalizeToken(String(group.group_name || '')).replace(/[^a-z0-9]+/g, ''))
    );
    const uniqueMap = new Map<string, GroupImportDraft>();

    mergedDrafts.forEach((draft) => {
      const token = normalizeToken(draft.group_name).replace(/[^a-z0-9]+/g, '');
      if (!token || uniqueMap.has(token)) {
        return;
      }
      uniqueMap.set(token, {
        group_name: draft.group_name.trim(),
        description: toNullableText(String(draft.description || '')),
      });
    });

    if (uniqueMap.size === 0) {
      setGroupFormError('Không tìm thấy dòng dữ liệu nhóm hợp lệ.');
      return;
    }

    const candidates = Array.from(uniqueMap.entries());
    const candidatePayloads: Array<Partial<SupportServiceGroup>> = [];
    const failedMessages: string[] = [];

    candidates.forEach(([token, draft]) => {
      if (existingTokens.has(token)) {
        failedMessages.push(`"${draft.group_name}" đã tồn tại.`);
        return;
      }

      candidatePayloads.push({
        group_name: draft.group_name,
        description: draft.description,
        is_active: true,
      });
      existingTokens.add(token);
    });

    if (candidatePayloads.length === 0) {
      const preview = failedMessages.slice(0, 3).join(' ');
      const suffix = failedMessages.length > 3 ? ` (+${failedMessages.length - 3} lỗi khác)` : '';
      setGroupFormError(preview ? `${preview}${suffix}` : 'Không có nhóm hợp lệ để tạo.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const bulkResult = await onCreateSupportServiceGroupBulk(candidatePayloads, { silent: true });
      const createdItems = bulkResult.created || [];

      (bulkResult.results || []).forEach((result) => {
        if (result.success) {
          return;
        }
        const draft = candidatePayloads[result.index];
        const groupName = String(draft?.group_name || `Dòng ${result.index + 1}`);
        const message = String(result.message || 'Không thể tạo nhóm.');
        failedMessages.push(`"${groupName}": ${message}`);
      });

      if (createdItems.length > 0) {
        setFormData((prev) => ({
          ...prev,
          service_group_id: prev.service_group_id || String(createdItems[0].id),
        }));
      }

      if (createdItems.length > 0) {
        setGroupFormSuccess(
          failedMessages.length > 0
            ? `Đã tạo ${createdItems.length}/${candidatePayloads.length} nhóm.`
            : `Đã tạo thành công ${createdItems.length} nhóm Zalo/Telegram yêu cầu.`
        );
      }

      if (failedMessages.length > 0) {
        const preview = failedMessages.slice(0, 3).join(' ');
        const suffix = failedMessages.length > 3 ? ` (+${failedMessages.length - 3} lỗi khác)` : '';
        setGroupFormError(`${preview}${suffix}`);
      }

      if (createdItems.length > 0 && failedMessages.length === 0) {
        closeCreateGroupModal();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể import nhóm hỗ trợ.';
      setGroupFormError(message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleStatusImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setStatusImportFile(file);
    setStatusImportFileName(file?.name || '');
    setStatusFormError('');
    setStatusFormSuccess('');
    event.target.value = '';
  };

  const loadStatusDraftsFromFile = async (file: File): Promise<StatusImportDraft[]> => {
    const fileName = String(file.name || '').toLowerCase();
    if (fileName.endsWith('.txt')) {
      const text = await file.text();
      return parseStatusDraftsFromPlainText(text);
    }

    const parsedFile = await parseImportFile(file);
    const candidateSheet = (parsedFile.sheets || []).find(
      (sheet) => (sheet.headers || []).length > 0 || (sheet.rows || []).length > 0
    );

    if (!candidateSheet) {
      return [];
    }

    return parseStatusDraftsFromSheet(candidateSheet.headers || [], candidateSheet.rows || []);
  };

  const handleCreateStatus = async () => {
    const statusName = String(newStatusName || '').trim();
    if (!statusName) {
      setStatusFormError('Tên trạng thái là bắt buộc.');
      return;
    }

    const statusCode = sanitizeStatusCode(newStatusCode) || buildStatusCodeFromName(statusName);
    if (!statusCode) {
      setStatusFormError('Mã trạng thái không hợp lệ.');
      return;
    }

    const existingCodeSet = new Set(
      statusDefinitions.map((item) => String(item.value || '').trim().toUpperCase())
    );
    if (existingCodeSet.has(statusCode)) {
      setStatusFormError('Mã trạng thái đã tồn tại.');
      return;
    }

    setIsCreatingStatus(true);
    setStatusFormError('');
    setStatusFormSuccess('');

    try {
      const created = await onCreateSupportRequestStatus({
        status_code: statusCode,
        status_name: statusName,
        description: toNullableText(newStatusDescription),
        requires_completion_dates: newStatusRequiresDates,
        is_terminal: newStatusIsTerminal,
        is_active: true,
      });

      setFormData((prev) => ({ ...prev, status: String(created.status_code || statusCode) as SupportRequestStatus }));
      closeCreateStatusModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo trạng thái yêu cầu hỗ trợ.';
      setStatusFormError(message);
    } finally {
      setIsCreatingStatus(false);
    }
  };

  const handleCreateStatusBulk = async () => {
    const draftsFromText = parseStatusDraftsFromPlainText(statusImportText);
    let draftsFromFile: StatusImportDraft[] = [];

    setStatusFormSuccess('');
    setStatusFormError('');

    if (statusImportFile) {
      try {
        draftsFromFile = await loadStatusDraftsFromFile(statusImportFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể đọc file import trạng thái.';
        setStatusFormError(message);
        return;
      }
    }

    const mergedDrafts = [...draftsFromText, ...draftsFromFile];
    if (mergedDrafts.length === 0) {
      setStatusFormError('Vui lòng nhập danh sách trạng thái hoặc chọn file để import.');
      return;
    }

    const existingCodeSet = new Set(
      statusDefinitions.map((item) => String(item.value || '').trim().toUpperCase())
    );
    const uniqueMap = new Map<string, StatusImportDraft>();

    mergedDrafts.forEach((draft) => {
      const statusCode = sanitizeStatusCode(draft.status_code) || buildStatusCodeFromName(draft.status_name);
      const statusName = String(draft.status_name || '').trim();
      if (!statusCode || !statusName || uniqueMap.has(statusCode)) {
        return;
      }

      uniqueMap.set(statusCode, {
        ...draft,
        status_code: statusCode,
        status_name: statusName,
      });
    });

    if (uniqueMap.size === 0) {
      setStatusFormError('Không tìm thấy dòng dữ liệu trạng thái hợp lệ.');
      return;
    }

    const candidatePayloads: Array<Partial<SupportRequestStatusOption>> = [];
    const failedMessages: string[] = [];

    uniqueMap.forEach((draft, statusCode) => {
      if (existingCodeSet.has(statusCode)) {
        failedMessages.push(`"${draft.status_name}" đã tồn tại.`);
        return;
      }

      candidatePayloads.push({
        status_code: statusCode,
        status_name: draft.status_name,
        description: draft.description,
        requires_completion_dates: draft.requires_completion_dates,
        is_terminal: draft.is_terminal,
        is_active: true,
      });
      existingCodeSet.add(statusCode);
    });

    if (candidatePayloads.length === 0) {
      const preview = failedMessages.slice(0, 3).join(' ');
      const suffix = failedMessages.length > 3 ? ` (+${failedMessages.length - 3} lỗi khác)` : '';
      setStatusFormError(preview ? `${preview}${suffix}` : 'Không có trạng thái hợp lệ để tạo.');
      return;
    }

    setIsCreatingStatus(true);
    try {
      const bulkResult = await onCreateSupportRequestStatusesBulk(candidatePayloads, { silent: true });
      const createdItems = bulkResult.created || [];

      (bulkResult.results || []).forEach((result) => {
        if (result.success) {
          return;
        }
        const draft = candidatePayloads[result.index];
        const statusName = String(draft?.status_name || `Dòng ${result.index + 1}`);
        const message = String(result.message || 'Không thể tạo trạng thái.');
        failedMessages.push(`"${statusName}": ${message}`);
      });

      if (createdItems.length > 0) {
        setFormData((prev) => ({
          ...prev,
          status: String(createdItems[0].status_code || prev.status || ''),
        }));
      }

      if (createdItems.length > 0) {
        setStatusFormSuccess(
          failedMessages.length > 0
            ? `Đã tạo ${createdItems.length}/${candidatePayloads.length} trạng thái.`
            : `Đã tạo thành công ${createdItems.length} trạng thái yêu cầu hỗ trợ.`
        );
      }

      if (failedMessages.length > 0) {
        const preview = failedMessages.slice(0, 3).join(' ');
        const suffix = failedMessages.length > 3 ? ` (+${failedMessages.length - 3} lỗi khác)` : '';
        setStatusFormError(`${preview}${suffix}`);
      }

      if (createdItems.length > 0 && failedMessages.length === 0) {
        closeCreateStatusModal();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể import trạng thái yêu cầu hỗ trợ.';
      setStatusFormError(message);
    } finally {
      setIsCreatingStatus(false);
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
    setHistoryError('');
    historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const cacheKey = String(request.id);
    const cachedRows = historyCacheRef.current[cacheKey];
    if (cachedRows) {
      setHistoryRows(cachedRows);
      setIsHistoryLoading(false);
      return;
    }

    setHistoryRows([]);
    setIsHistoryLoading(true);

    try {
      const rows = await onLoadSupportRequestHistory(request.id);
      historyCacheRef.current[cacheKey] = rows;
      setHistoryRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử thay đổi.';
      setHistoryError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const clearHistoryFocus = () => {
    setHistoryTarget(null);
    setHistoryRows([]);
    setHistoryError('');
    setIsHistoryLoading(false);
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);

    const today = todayIso();
    downloadExcelWorkbook('mau_nhap_yeu_cau_ho_tro', [
      {
        name: 'SupportRequests',
        headers: [
          'Mã task',
          'Nội dung yêu cầu',
          'Phần mềm triển khai',
          'Nhóm Zalo/Telegram yêu cầu',
          'Người xử lý',
          'Người tiếp nhận',
          'Người báo yêu cầu',
          'Mức ưu tiên',
          'Trạng thái',
          'Ngày nhận yêu cầu',
          'Hạn hoàn thành',
          'Ngày hoàn thành TT',
          'Ngày đẩy hotfix',
          'Ngày thông báo KH',
          'Liên kết task',
          'Ghi chú',
        ],
        rows: [
          [
            'IT360-1234',
            'Lỗi đồng bộ dữ liệu bệnh án',
            projectItemOptions[1]?.label || 'DA001 - Dự án VNPT HIS - Vietcombank | SOC_MONITOR - Dịch vụ giám sát SOC | Ngân hàng Vietcombank',
            groupOptions[1]?.label || 'HIS L2',
            employeeFormOptions[1]?.label || 'VNPT000001 - System Admin',
            receiverOptions[1]?.label || employeeFormOptions[1]?.label || 'VNPT000001 - System Admin',
            reporterContactOptions[1]?.label || 'Nguyễn Văn A',
            'HIGH',
            'NEW',
            today,
            today,
            today,
            today,
            today,
            'https://jira.example/IT360-1234',
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
          'Phần mềm triển khai',
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

  const resetListFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPriorityFilter('');
    setGroupFilter('');
    setAssigneeFilter('');
    setCustomerFilter('');
    setRequestedFromFilter(startOfCurrentYearIso());
    setRequestedToFilter(todayIso());
    setCurrentPage(1);
  };

  const exportHeaders = [
    'Mã task',
    'Liên kết task',
    'Nội dung',
    'Nhóm Zalo/Telegram yêu cầu',
    'Khách hàng',
    'Người xử lý',
    'Người tiếp nhận',
    'Người báo yêu cầu',
    'Ưu tiên',
    'Trạng thái',
    'Ngày nhận yêu cầu',
    'Hạn xử lý',
  ];

  const buildSupportRequestExportRows = (): string[][] =>
    filteredRequests.map((item) => {
      const taskCodes = (item.tasks || [])
        .map((task) => String(task.task_code || '').trim())
        .filter((value) => value !== '');
      const taskLinks = (item.tasks || [])
        .map((task) => String(task.task_link || '').trim())
        .filter((value) => value !== '');

      return [
        taskCodes.length > 0 ? taskCodes.join(' | ') : String(item.ticket_code || ''),
        taskLinks.length > 0 ? taskLinks.join(' | ') : String(item.task_link || ''),
        (item.summary || '').replace(/\n/g, ' '),
        item.service_group_name || '',
        item.customer_name || customerMap.get(String(item.customer_id)) || '',
        item.assignee_name || employeeMap.get(String(item.assignee_id || '')) || '',
        item.receiver_name || employeeMap.get(String(item.receiver_user_id || '')) || '',
        item.reporter_contact_name || item.reporter_name || '',
        resolvePriorityLabel(item.priority),
        resolveStatusLabel(item.status),
        formatDateDdMmYyyy(item.requested_date),
        formatDateDdMmYyyy(item.due_date),
      ];
    });

  const exportCsv = () => {
    const rows = buildSupportRequestExportRows();
    const csvContent = [
      exportHeaders.join(','),
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

  const exportExcel = () => {
    const rows = buildSupportRequestExportRows();
    downloadExcelWorkbook(`support_requests_${todayIso()}`, [
      {
        name: 'SupportRequests',
        headers: exportHeaders,
        rows,
      },
    ]);
  };

  const exportPdf = () => {
    const rows = buildSupportRequestExportRows();
    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
    if (!printWindow) {
      return;
    }

    const headerCells = exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const bodyRows = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell || ''))}</td>`).join('')}</tr>`)
      .join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Danh sách yêu cầu hỗ trợ</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            p { margin: 0 0 16px; color: #475569; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            tr:nth-child(even) { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Danh sách yêu cầu hỗ trợ</h1>
          <p>Ngày xuất: ${escapeHtml(new Date().toLocaleString('vi-VN'))}</p>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    if (type === 'excel') {
      exportExcel();
      return;
    }
    if (type === 'pdf') {
      exportPdf();
      return;
    }
    exportCsv();
  };

  return (
    <div
      className="p-4 md:p-8 pb-20 md:pb-8 rounded-2xl"
      style={{ backgroundColor: 'rgb(242 239 231 / var(--tw-bg-opacity, 1))' }}
    >
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Quản lý yêu cầu hỗ trợ</h2>
          <p className="text-slate-600 text-sm mt-1">Theo dõi tiến độ xử lý task hỗ trợ theo khách hàng, dự án và sản phẩm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:flex-none">
            <button
              type="button"
              onClick={() => {
                setShowExportMenu(false);
                setShowImportMenu((prev) => !prev);
              }}
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

          <div className="relative flex-1 lg:flex-none">
            <button
              type="button"
              onClick={() => {
                setShowImportMenu(false);
                setShowExportMenu((prev) => !prev);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Xuất</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-gradient-to-br from-blue-50 to-white p-5 md:p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng yêu cầu</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">support_agent</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatVietnameseNumber(totalRequests)}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-white p-5 md:p-6 rounded-xl border border-indigo-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Mới tiếp nhận</p>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg material-symbols-outlined">new_releases</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatVietnameseNumber(totalNewCount)}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-white p-5 md:p-6 rounded-xl border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Đang xử lý</p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg material-symbols-outlined">pending_actions</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatVietnameseNumber(totalInProgress)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-white p-5 md:p-6 rounded-xl border border-orange-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Chờ phản hồi KH</p>
            <span className="p-2 bg-orange-50 text-orange-600 rounded-lg material-symbols-outlined">hourglass_top</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatVietnameseNumber(totalWaitingCustomer)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white p-5 md:p-6 rounded-xl border border-red-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Sắp đến hạn</p>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg material-symbols-outlined">event_upcoming</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatVietnameseNumber(totalApproachingDue)}</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-white p-5 md:p-6 rounded-xl border border-rose-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Đã quá hạn xử lý</p>
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg material-symbols-outlined">warning</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-rose-700">{formatVietnameseNumber(totalOverdue)}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white/95 p-4 md:p-5 rounded-t-xl border border-slate-200 border-b-0 shadow-[0_6px_20px_rgba(15,23,42,0.04)] flex flex-col gap-3">
          <div className="w-full flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã task, nội dung, khách hàng, người xử lý..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm placeholder:text-slate-400 outline-none shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={resetListFilters}
              className="h-10 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 whitespace-nowrap"
            >
              Xóa lọc
            </button>
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
              placeholder="Tất cả nhóm Zalo/Telegram yêu cầu"
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
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Từ ngày nhận yêu cầu</label>
              <BlackDatePicker
                value={requestedFromFilter}
                onChange={setRequestedFromFilter}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đến ngày nhận yêu cầu</label>
              <BlackDatePicker
                value={requestedToFilter}
                onChange={setRequestedToFilter}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1540px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Mã task</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Nội dung</span></th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"><span className="text-deep-teal">Nhóm Zalo/Telegram yêu cầu</span></th>
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
                    <tr key={item.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-teal-50/40 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-700">
                        {(() => {
                          const taskCount = Math.max(
                            Number(item.task_count || 0),
                            Array.isArray(item.tasks) ? item.tasks.length : 0
                          );
                          const firstTask = item.tasks?.[0];
                          const firstTaskCode = String(firstTask?.task_code || item.ticket_code || '').trim();
                          const firstTaskStatus = firstTask?.status ? normalizeSupportTaskStatus(firstTask.status) : null;
                          const firstTaskStatusLabel = firstTaskStatus ? resolveSupportTaskStatusLabel(firstTaskStatus) : null;
                          const firstTaskStatusColor = firstTaskStatus ? resolveSupportTaskStatusColor(firstTaskStatus) : '';
                          return (
                            <div className="flex flex-col gap-1">
                              <span>{firstTaskCode || '--'}</span>
                              {firstTaskStatusLabel && (
                                <span className={`text-[11px] font-semibold w-fit px-2 py-0.5 rounded-full ${firstTaskStatusColor}`}>
                                  {firstTaskStatusLabel}
                                </span>
                              )}
                              {taskCount > 1 && (
                                <span className="text-[11px] font-semibold text-primary bg-primary/10 w-fit px-2 py-0.5 rounded-full">
                                  +{taskCount - 1} task
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 max-w-[340px]">
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(item)}
                          className="text-left group w-full"
                          title="Xem nhật ký thay đổi của task"
                        >
                          <p className="font-semibold line-clamp-2 group-hover:text-primary transition-colors" title={item.summary}>
                            {item.summary}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 group-hover:text-slate-700 transition-colors">
                            {item.project_name || projectMap.get(String(item.project_id || '')) || '--'} | {item.product_name || productMap.get(String(item.product_id || '')) || '--'}
                          </p>
                        </button>
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
                        <p className="font-medium whitespace-nowrap">{formatDateDdMmYyyy(item.due_date) || '--'}</p>
                        {item.due_date && item.due_date < todayIso() && item.status !== 'COMPLETED' && item.status !== 'UNABLE_TO_EXECUTE' && (
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
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy yêu cầu hỗ trợ phù hợp.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

      <div ref={historySectionRef} className="mt-6 md:mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '0.25s' }}>
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-bold text-slate-900">Nhật ký thay đổi</h3>
            {historyTarget ? (
              <p className="text-xs text-slate-500 mt-0.5 truncate" title={`${historyTarget.ticket_code || '--'} - ${historyTarget.summary || ''}`}>
                Đang hiển thị task: <span className="font-semibold text-slate-700">{historyTarget.ticket_code || '--'}</span> - {historyTarget.summary || '--'}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">Hiển thị các lần chuyển trạng thái gần nhất của yêu cầu hỗ trợ.</p>
            )}
          </div>
          <div className="w-full md:w-auto flex items-center gap-2">
            {historyTarget && (
              <button
                type="button"
                onClick={clearHistoryFocus}
                className="h-10 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold whitespace-nowrap"
              >
                Bỏ lọc task
              </button>
            )}
            <div className="relative w-full md:w-[320px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={historySearchTerm}
                onChange={(event) => setHistorySearchTerm(event.target.value)}
                placeholder="Tìm theo mã task, nội dung, người cập nhật..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Mã task</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Nội dung</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Trạng thái</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Ghi chú</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Người cập nhật</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isHistoryLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Đang tải lịch sử thay đổi...</td>
                </tr>
              ) : historyError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-red-600">{historyError}</td>
                </tr>
              ) : filteredHistories.length > 0 ? (
                filteredHistories.slice(0, 30).map((history) => (
                  <tr key={history.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-teal-50/40 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-slate-700">{history.ticket_code || '--'}</td>
                    <td className="px-6 py-3 text-sm text-slate-700 max-w-[260px] truncate" title={history.request_summary || ''}>
                      {history.request_summary || '--'}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${resolveStatusColor(history.old_status || 'NEW')}`}>
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
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    {historyTarget ? 'Task này chưa có nhật ký thay đổi.' : 'Chưa chọn task để xem nhật ký thay đổi.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-200/70 backdrop-blur-[2px]" onClick={closeFormModal}></div>
          <div className="relative bg-white w-full max-w-6xl max-h-[92vh] rounded-xl border border-slate-200 shadow-[0_28px_80px_rgba(15,23,42,0.18)] flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
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
                  <label className="text-sm font-semibold text-slate-700">Phần mềm triển khai <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    value={formData.project_item_id}
                    onChange={handleProjectItemChange}
                    options={projectItemOptions}
                    placeholder="Chọn phần mềm triển khai"
                    selectedLines={2}
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
                    <label className="text-sm font-semibold text-slate-700">Nhóm Zalo/Telegram yêu cầu</label>
                    <button
                      type="button"
                      onClick={openCreateGroupModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 text-primary hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Tạo nhóm yêu cầu
                    </button>
                  </div>
                  <SearchableSelect
                    value={formData.service_group_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, service_group_id: value }))}
                    options={[{ value: '', label: 'Chọn nhóm Zalo/Telegram yêu cầu' }, ...groupOptions.filter((option) => option.value !== '')]}
                    placeholder="Chọn nhóm Zalo/Telegram yêu cầu"
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
                  <label className="text-sm font-semibold text-slate-700">Người tiếp nhận</label>
                  <SearchableSelect
                    value={formData.receiver_user_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, receiver_user_id: value }))}
                    options={receiverOptions}
                    placeholder={isReceiverLoading ? 'Đang tải người tiếp nhận...' : 'Chọn người tiếp nhận'}
                    disabled={isReceiverLoading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Người báo yêu cầu</label>
                  <SearchableSelect
                    value={formData.reporter_contact_id}
                    onChange={(value) => {
                      const selectedContact = customerPersonnelById.get(value);
                      setFormData((prev) => ({
                        ...prev,
                        reporter_contact_id: value,
                        reporter_name: selectedContact?.fullName || prev.reporter_name,
                      }));
                    }}
                    options={reporterContactOptions}
                    placeholder={
                      formData.customer_id
                        ? 'Chọn người báo yêu cầu'
                        : 'Chọn phần mềm triển khai để tải người liên hệ'
                    }
                    disabled={!formData.customer_id}
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Trạng thái</label>
                    <button
                      type="button"
                      onClick={openCreateStatusModal}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 text-primary hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Tạo trạng thái
                    </button>
                  </div>
                  <SearchableSelect
                    value={formData.status}
                    onChange={(value) => setFormData((prev) => ({ ...prev, status: value as SupportRequestStatus }))}
                    options={statusFormOptions}
                    placeholder="Chọn trạng thái"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày nhận yêu cầu <span className="text-red-500">*</span></label>
                  <BlackDatePicker
                    value={formData.requested_date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, requested_date: value }))}
                    max={formData.due_date || undefined}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Hạn hoàn thành
                    {formStatusRequiresCompletionDates && <span className="text-red-500"> *</span>}
                  </label>
                  <BlackDatePicker
                    value={formData.due_date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, due_date: value }))}
                    min={formData.requested_date || undefined}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Ngày hoàn thành TT
                    {formStatusRequiresCompletionDates && <span className="text-red-500"> *</span>}
                  </label>
                  <BlackDatePicker
                    value={formData.resolved_date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, resolved_date: value }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày đẩy hotfix</label>
                  <BlackDatePicker
                    value={formData.hotfix_date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, hotfix_date: value }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày thông báo KH</label>
                  <BlackDatePicker
                    value={formData.noti_date}
                    onChange={(value) => setFormData((prev) => ({ ...prev, noti_date: value }))}
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Danh sách task hỗ trợ</label>
                    <button
                      type="button"
                      onClick={addFormTaskRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Thêm task
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="hidden md:grid grid-cols-[1.1fr_1fr_1.2fr_0.9fr_auto] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Nội dung task</span>
                      <span>Mã task</span>
                      <span>Liên kết task</span>
                      <span>Trạng thái</span>
                      <span className="text-right">Thao tác</span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100">
                      {formTasks.length > 0 ? (
                        formTasks.map((task, index) => (
                          <div key={task.local_id} className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr_1.2fr_0.9fr_auto] gap-2 p-3">
                            <input
                              value={task.title}
                              onChange={(event) => updateFormTaskRow(task.local_id, 'title', event.target.value)}
                              placeholder={`Nội dung task #${index + 1}`}
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                            />
                            <input
                              value={task.task_code}
                              onChange={(event) => updateFormTaskRow(task.local_id, 'task_code', event.target.value)}
                              placeholder="IT360-1234"
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                            />
                            <input
                              value={task.task_link}
                              onChange={(event) => updateFormTaskRow(task.local_id, 'task_link', event.target.value)}
                              placeholder="https://jira..., https://bitbucket..."
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
                            />
                            <select
                              value={task.status}
                              onChange={(event) => updateFormTaskRow(task.local_id, 'status', event.target.value)}
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            >
                              {SUPPORT_TASK_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => removeFormTaskRow(task.local_id)}
                                className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                                title="Xóa task"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-sm text-slate-500">
                          Chưa khai báo task hỗ trợ. Bạn có thể lưu yêu cầu mà không cần task hoặc bấm "Thêm task".
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Có thể để trống task. Nếu có khai báo task, task đầu tiên sẽ được dùng làm mã/link đại diện để tương thích dữ liệu cũ.
                  </p>
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

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-100">
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
          <div className="absolute inset-0 bg-slate-200/70 backdrop-blur-[2px]" onClick={closeCreateGroupModal}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <h3 className="text-lg font-bold text-slate-900">Tạo nhóm Zalo/Telegram yêu cầu</h3>
              <button type="button" onClick={closeCreateGroupModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Tạo nhanh 1 nhóm</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Tên nhóm Zalo/Telegram yêu cầu <span className="text-red-500">*</span></label>
                  <input
                    value={newGroupName}
                    onChange={(event) => {
                      setNewGroupName(event.target.value);
                      setGroupFormError('');
                      setGroupFormSuccess('');
                    }}
                    placeholder="Ví dụ: HIS L2"
                    className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                  <textarea
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                <p className="text-sm font-semibold text-slate-900">Import hàng loạt</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Dán danh sách nhóm</label>
                  <textarea
                    value={groupImportText}
                    onChange={(event) => {
                      setGroupImportText(event.target.value);
                      setGroupFormError('');
                      setGroupFormSuccess('');
                    }}
                    rows={4}
                    placeholder={'Mỗi dòng 1 nhóm hoặc "Tên nhóm | Mô tả"'}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">Hoặc chọn file import</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => groupImportFileInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Chọn file (.txt, .csv, .xls, .xlsx)
                    </button>
                    {groupImportFileName && (
                      <>
                        <span className="text-sm text-slate-600 truncate max-w-[360px]" title={groupImportFileName}>
                          {groupImportFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setGroupImportFile(null);
                            setGroupImportFileName('');
                            setGroupFormError('');
                            setGroupFormSuccess('');
                          }}
                          className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white"
                        >
                          Bỏ file
                        </button>
                      </>
                    )}
                  </div>
                  <input
                    ref={groupImportFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.csv,.xls,.xlsx"
                    onChange={handleGroupImportFileChange}
                  />
                  <p className="text-xs text-slate-500">
                    Hệ thống ưu tiên đọc cột `Tên nhóm` và `Mô tả`. Nếu file không có header, cột 1 là tên nhóm, cột 2 là mô tả.
                  </p>
                </div>
              </div>

              {groupFormSuccess && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
                  {groupFormSuccess}
                </div>
              )}
              {groupFormError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{groupFormError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateGroupModal} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100">Hủy</button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="px-4 py-2.5 rounded-lg border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 disabled:opacity-60"
              >
                {isCreatingGroup ? 'Đang tạo...' : 'Tạo 1 nhóm'}
              </button>
              <button
                type="button"
                onClick={handleCreateGroupBulk}
                disabled={isCreatingGroup || (!groupImportText.trim() && !groupImportFile)}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {isCreatingGroup ? 'Đang import...' : 'Tạo hàng loạt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateStatusOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-200/70 backdrop-blur-[2px]" onClick={closeCreateStatusModal}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white">
              <h3 className="text-lg font-bold text-slate-900">Tạo trạng thái yêu cầu hỗ trợ</h3>
              <button type="button" onClick={closeCreateStatusModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Tạo nhanh 1 trạng thái</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mã trạng thái</label>
                    <input
                      value={newStatusCode}
                      onChange={(event) => {
                        setNewStatusCode(event.target.value);
                        setStatusFormError('');
                        setStatusFormSuccess('');
                      }}
                      placeholder="VD: WAITING_PARTNER"
                      className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Tên trạng thái <span className="text-red-500">*</span></label>
                    <input
                      value={newStatusName}
                      onChange={(event) => {
                        setNewStatusName(event.target.value);
                        setStatusFormError('');
                        setStatusFormSuccess('');
                      }}
                      placeholder="VD: Chờ đối tác phản hồi"
                      className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                  <textarea
                    value={newStatusDescription}
                    onChange={(event) => setNewStatusDescription(event.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newStatusRequiresDates}
                      onChange={(event) => setNewStatusRequiresDates(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Bắt buộc nhập Hạn/Ngày hoàn thành
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newStatusIsTerminal}
                      onChange={(event) => setNewStatusIsTerminal(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Trạng thái kết thúc
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                <p className="text-sm font-semibold text-slate-900">Import hàng loạt</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Dán danh sách trạng thái</label>
                  <textarea
                    value={statusImportText}
                    onChange={(event) => {
                      setStatusImportText(event.target.value);
                      setStatusFormError('');
                      setStatusFormSuccess('');
                    }}
                    rows={4}
                    placeholder={'Mỗi dòng: \"Mã | Tên | Mô tả | Bắt buộc ngày(0/1) | Kết thúc(0/1)\" hoặc chỉ \"Tên\"'}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-y"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">Hoặc chọn file import</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => statusImportFileInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Chọn file (.txt, .csv, .xls, .xlsx)
                    </button>
                    {statusImportFileName && (
                      <>
                        <span className="text-sm text-slate-600 truncate max-w-[360px]" title={statusImportFileName}>
                          {statusImportFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusImportFile(null);
                            setStatusImportFileName('');
                            setStatusFormError('');
                            setStatusFormSuccess('');
                          }}
                          className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white"
                        >
                          Bỏ file
                        </button>
                      </>
                    )}
                  </div>
                  <input
                    ref={statusImportFileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.csv,.xls,.xlsx"
                    onChange={handleStatusImportFileChange}
                  />
                </div>
              </div>

              {statusFormSuccess && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
                  {statusFormSuccess}
                </div>
              )}
              {statusFormError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{statusFormError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateStatusModal} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100">Hủy</button>
              <button
                type="button"
                onClick={handleCreateStatus}
                disabled={isCreatingStatus || !newStatusName.trim()}
                className="px-4 py-2.5 rounded-lg border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 disabled:opacity-60"
              >
                {isCreatingStatus ? 'Đang tạo...' : 'Tạo 1 trạng thái'}
              </button>
              <button
                type="button"
                onClick={handleCreateStatusBulk}
                disabled={isCreatingStatus || (!statusImportText.trim() && !statusImportFile)}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {isCreatingStatus ? 'Đang import...' : 'Tạo hàng loạt'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
