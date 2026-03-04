import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PaginationMeta, Employee, ProjectItemMaster } from '../types';
import {
  IProgrammingRequest,
  isProgrammingRequestStatus,
  ProgrammingRequestFilters,
  ProgrammingRequestStatus,
  ProgrammingRequestType,
  PROGRAMMING_REQUEST_STATUSES,
  PROGRAMMING_REQUEST_TYPES,
} from '../types/programmingRequest';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  ANALYZING: 'bg-amber-100 text-amber-700',
  CODING: 'bg-blue-100 text-blue-700',
  PENDING_UPCODE: 'bg-orange-100 text-orange-700',
  UPCODED: 'bg-purple-100 text-purple-700',
  NOTIFIED: 'bg-cyan-100 text-cyan-700',
  CLOSED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới tạo',
  ANALYZING: 'Phân tích',
  CODING: 'Lập trình',
  PENDING_UPCODE: 'Chờ upcode',
  UPCODED: 'Đã upcode',
  NOTIFIED: 'Đã thông báo',
  CLOSED: 'Đóng',
  CANCELLED: 'Hủy',
};

const TYPE_LABEL: Record<ProgrammingRequestType, string> = {
  FEATURE: 'Tính năng',
  BUG: 'Lỗi',
  OPTIMIZE: 'Tối ưu',
  REPORT: 'Báo cáo',
  OTHER: 'Khác',
};

const toComparableDate = (value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString().slice(0, 10);
};

const formatDisplayDate = (value: string | null | undefined): string => {
  const comparable = toComparableDate(value);
  if (!comparable) {
    return '-';
  }
  const [year, month, day] = comparable.split('-');
  if (!year || !month || !day) {
    return '-';
  }
  return `${day}/${month}/${year}`;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

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

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const toLocalIsoDateString = (value: Date): string =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const todayIso = (): string => toLocalIsoDateString(new Date());

const startOfCurrentMonthIso = (): string => {
  const now = new Date();
  return toLocalIsoDateString(new Date(now.getFullYear(), now.getMonth(), 1));
};

const formatDatePickerDisplay = (value: string | null | undefined): string => {
  const parsed = parseIsoDateString(String(value || '').slice(0, 10));
  if (!parsed) {
    return '';
  }

  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
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
      iso: toLocalIsoDateString(date),
      isCurrentMonth: date.getMonth() === monthView.getMonth(),
    };
  });
};

const DATE_PICKER_WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DATE_PICKER_MONTH_FORMATTER = new Intl.DateTimeFormat('vi-VN', {
  month: 'long',
  year: 'numeric',
});

interface BlackDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
}

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
  const displayValue = formatDatePickerDisplay(value);

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

    onChange(toLocalIsoDateString(date));
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

interface ProgrammingRequestListProps {
  items: IProgrammingRequest[];
  employees: Employee[];
  projectItems: ProjectItemMaster[];
  isLoading?: boolean;
  paginationMeta?: PaginationMeta;
  onQueryChange?: (query: ProgrammingRequestFilters) => void;
  onExport?: (query: ProgrammingRequestFilters) => Promise<void> | void;
  onOpenImportModal?: () => void;
  onOpenCreate?: () => void;
  onOpenEdit?: (item: IProgrammingRequest) => void;
  onOpenDetail?: (item: IProgrammingRequest) => void;
  onCancel?: (item: IProgrammingRequest) => void;
}

export const ProgrammingRequestList: React.FC<ProgrammingRequestListProps> = ({
  items,
  employees,
  projectItems = [],
  isLoading = false,
  paginationMeta,
  onQueryChange,
  onExport,
  onOpenImportModal,
  onOpenCreate,
  onOpenEdit,
  onOpenDetail,
  onCancel,
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<ProgrammingRequestStatus[]>([]);
  const [reqType, setReqType] = useState<ProgrammingRequestType | ''>('');
  const [coderId, setCoderId] = useState<string>('');
  const [requestedDateFrom, setRequestedDateFrom] = useState(startOfCurrentMonthIso);
  const [requestedDateTo, setRequestedDateTo] = useState(todayIso);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const onQueryChangeRef = useRef<typeof onQueryChange>(onQueryChange);
  const lastQuerySignatureRef = useRef<string>('');

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  const queryPayload = useMemo<ProgrammingRequestFilters>(
    () => ({
      page: currentPage,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      status: statusFilters,
      req_type: reqType,
      coder_id: coderId ? Number(coderId) : null,
      requested_date_from: requestedDateFrom,
      requested_date_to: requestedDateTo,
    }),
    [currentPage, rowsPerPage, searchTerm, statusFilters, reqType, coderId, requestedDateFrom, requestedDateTo]
  );

  useEffect(() => {
    if (!serverMode || !onQueryChangeRef.current) {
      return;
    }

    const querySignature = JSON.stringify(queryPayload);
    if (querySignature === lastQuerySignatureRef.current) {
      return;
    }
    lastQuerySignatureRef.current = querySignature;
    onQueryChangeRef.current(queryPayload);
  }, [serverMode, queryPayload]);

  const filteredItems = useMemo(() => {
    if (serverMode) {
      return items;
    }

    return items.filter((item) => {
      const keyword = searchTerm.trim().toLowerCase();
      const searchableText = [
        item.req_code,
        item.req_name,
        item.ticket_code || '',
        item.description || '',
        item.product_name || '',
        item.customer_name || '',
        item.coder_name || '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !keyword || searchableText.includes(keyword);
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(item.status);
      const matchesType = !reqType || item.req_type === reqType;
      const matchesCoder = !coderId || Number(item.coder_id) === Number(coderId);
      const itemRequestedDate = toComparableDate(item.requested_date);
      const fromDate = toComparableDate(requestedDateFrom);
      const toDate = toComparableDate(requestedDateTo);
      const matchesFromDate = !fromDate || (itemRequestedDate !== null && itemRequestedDate >= fromDate);
      const matchesToDate = !toDate || (itemRequestedDate !== null && itemRequestedDate <= toDate);
      return matchesSearch && matchesStatus && matchesType && matchesCoder && matchesFromDate && matchesToDate;
    });
  }, [serverMode, items, searchTerm, statusFilters, reqType, coderId, requestedDateFrom, requestedDateTo]);

  const pagedItems = useMemo(() => {
    if (serverMode) {
      return items;
    }

    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [serverMode, items, filteredItems, currentPage, rowsPerPage]);

  const totalItems = serverMode ? paginationMeta?.total || 0 : filteredItems.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilters, reqType, coderId, requestedDateFrom, requestedDateTo, rowsPerPage]);

  const coderOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả Dev' },
      ...employees.map((employee) => ({
        value: String(employee.id),
        label: `${employee.user_code || employee.employee_code || employee.id} - ${employee.full_name}`,
      })),
    ],
    [employees]
  );

  const statusFilterOptions = useMemo(
    () =>
      PROGRAMMING_REQUEST_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABEL[status],
        searchText: `${status} ${STATUS_LABEL[status]}`,
      })),
    []
  );

  const managementKpis = useMemo(() => {
    const kpiSource = items;
    const countByStatus = (status: ProgrammingRequestStatus) =>
      kpiSource.filter((item) => item.status === status).length;
    const completed = kpiSource.filter((item) => ['UPCODED', 'NOTIFIED', 'CLOSED'].includes(item.status)).length;
    const serverKpis = serverMode ? paginationMeta?.kpis : undefined;
    const parseKpiValue = (value: unknown): number | null => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
      }
      return Math.floor(parsed);
    };

    const localCounts = {
      total: filteredItems.length,
      newCount: countByStatus('NEW'),
      analyzingCount: countByStatus('ANALYZING'),
      codingCount: countByStatus('CODING'),
      pendingUpcodeCount: countByStatus('PENDING_UPCODE'),
      completedCount: completed,
    };

    const total = serverMode
      ? (parseKpiValue(serverKpis?.total_requests) ?? parseKpiValue(paginationMeta?.total) ?? kpiSource.length)
      : localCounts.total;
    const newCount = serverMode ? (parseKpiValue(serverKpis?.new_count) ?? localCounts.newCount) : localCounts.newCount;
    const analyzingCount = serverMode
      ? (parseKpiValue(serverKpis?.analyzing_count) ?? localCounts.analyzingCount)
      : localCounts.analyzingCount;
    const codingCount = serverMode
      ? (parseKpiValue(serverKpis?.coding_count) ?? localCounts.codingCount)
      : localCounts.codingCount;
    const pendingUpcodeCount = serverMode
      ? (parseKpiValue(serverKpis?.pending_upcode_count) ?? localCounts.pendingUpcodeCount)
      : localCounts.pendingUpcodeCount;
    const completedCount = serverMode
      ? (parseKpiValue(serverKpis?.completed_count) ?? localCounts.completedCount)
      : localCounts.completedCount;

    return [
      {
        key: 'total',
        label: 'Tổng yêu cầu',
        value: total,
        tone: 'bg-blue-50 text-blue-700 border-blue-100',
      },
      {
        key: 'new',
        label: 'Mới tạo',
        value: newCount,
        tone: 'bg-slate-50 text-slate-700 border-slate-200',
      },
      {
        key: 'analyzing',
        label: 'Phân tích',
        value: analyzingCount,
        tone: 'bg-amber-50 text-amber-700 border-amber-100',
      },
      {
        key: 'coding',
        label: 'Lập trình',
        value: codingCount,
        tone: 'bg-cyan-50 text-cyan-700 border-cyan-100',
      },
      {
        key: 'pending-upcode',
        label: 'Chờ upcode',
        value: pendingUpcodeCount,
        tone: 'bg-orange-50 text-orange-700 border-orange-100',
      },
      {
        key: 'completed',
        label: 'Hoàn tất',
        value: completedCount,
        tone: 'bg-green-50 text-green-700 border-green-100',
      },
    ];
  }, [items, filteredItems, serverMode, paginationMeta?.kpis, paginationMeta?.total]);

  const renderProgressPercent = (value: number | null) => {
    const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
    return `${safeValue}%`;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilters([]);
    setReqType('');
    setCoderId('');
    setRequestedDateFrom(startOfCurrentMonthIso());
    setRequestedDateTo(todayIso());
    setCurrentPage(1);
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);
    const firstProjectItem = projectItems[0];
    const firstDeveloper = employees[0];
    const firstDeveloperCode =
      String(firstDeveloper?.employee_code || firstDeveloper?.user_code || firstDeveloper?.id || '').trim() || '';

    downloadExcelWorkbook('mau_nhap_yeu_cau_lap_trinh', [
      {
        name: 'ProgrammingRequests',
        headers: [
          'Tên YC',
          'Phần mềm triển khai',
          'Loại YC',
          'Trạng thái',
          'Ngày nhận yêu cầu',
          'Dev',
          'Mã task',
          'Liên kết task',
          'Mô tả',
        ],
        rows: [
          [
            'Tối ưu tốc độ đồng bộ báo cáo tổng hợp',
            firstProjectItem?.display_name || firstProjectItem?.id || '',
            'FEATURE',
            'NEW',
            todayIso(),
            firstDeveloperCode,
            'REQ-DEV-001',
            'https://jira.example/REQ-DEV-001',
            'Tạo mới tối thiểu từ import file mẫu.',
          ],
        ],
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
        rows: projectItems.map((item) => [
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
      {
        name: 'Developers',
        headers: ['ID', 'Mã nhân sự', 'Tên đăng nhập', 'Họ tên'],
        rows: employees.map((employee) => [
          employee.id,
          employee.employee_code || employee.user_code || '',
          employee.username || '',
          employee.full_name || '',
        ]),
      },
    ]);
  };

  const exportHeaders = [
    'Mã YC',
    'Tên YC',
    'Sản phẩm',
    'Khách hàng',
    'Loại',
    'Trạng thái',
    'Tiến độ (%)',
    'Hạn phân tích',
    'Hạn code',
    'Ngày TBKH',
    'Dev',
    'Ngày nhận yêu cầu',
  ];

  const buildProgrammingExportRows = (): string[][] =>
    filteredItems.map((item) => [
      String(item.req_code || ''),
      String(item.req_name || ''),
      String(item.product_name || ''),
      String(item.customer_name || ''),
      TYPE_LABEL[item.req_type] || String(item.req_type || ''),
      STATUS_LABEL[item.status] || String(item.status || ''),
      renderProgressPercent(item.overall_progress),
      formatDisplayDate(item.analyze_end_date),
      formatDisplayDate(item.code_end_date),
      formatDisplayDate(item.noti_date),
      String(item.coder_name || ''),
      formatDisplayDate(item.requested_date),
    ]);

  const exportCsvLocal = () => {
    const rows = buildProgrammingExportRows();
    const csvContent = [
      exportHeaders.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `programming_requests_${todayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportExcelLocal = () => {
    downloadExcelWorkbook(`programming_requests_${todayIso()}`, [
      {
        name: 'ProgrammingRequests',
        headers: exportHeaders,
        rows: buildProgrammingExportRows(),
      },
    ]);
  };

  const exportPdfLocal = () => {
    const rows = buildProgrammingExportRows();
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
          <title>Danh sách yêu cầu lập trình</title>
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
          <h1>Danh sách yêu cầu lập trình</h1>
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

  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    if (isExporting) {
      return;
    }

    if (type === 'excel') {
      exportExcelLocal();
      return;
    }

    if (type === 'pdf') {
      exportPdfLocal();
      return;
    }

    if (onExport) {
      setIsExporting(true);
      try {
        await onExport({
          ...queryPayload,
          page: 1,
        });
      } finally {
        setIsExporting(false);
      }
      return;
    }

    exportCsvLocal();
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-deep-teal tracking-tight">Yêu cầu lập trình</h2>
          <p className="text-sm text-slate-500 mt-1">Quản lý vòng đời Phân tích → Lập trình → Upcode → Thông báo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 md:flex-none">
            <button
              type="button"
              disabled={!onOpenImportModal}
              onClick={() => {
                if (!onOpenImportModal) {
                  return;
                }
                setShowExportMenu(false);
                setShowImportMenu((prev) => !prev);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Nhập</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>

            {showImportMenu && onOpenImportModal && (
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

          <div className="relative flex-1 md:flex-none">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                if (isExporting) {
                  return;
                }
                setShowImportMenu(false);
                setShowExportMenu((prev) => !prev);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">{isExporting ? 'progress_activity' : 'download'}</span>
              <span className="hidden sm:inline">{isExporting ? 'Đang xuất...' : 'Xuất'}</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    type="button"
                    onClick={() => void handleExport('excel')}
                    disabled={isExporting}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport('csv')}
                    disabled={isExporting}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport('pdf')}
                    disabled={isExporting}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-deep-teal"
          >
            <span className="material-symbols-outlined">add</span>
            Thêm yêu cầu
          </button>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {managementKpis.map((kpi) => (
          <div key={kpi.key} className={`rounded-xl border p-4 shadow-sm ${kpi.tone}`}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">{kpi.label}</p>
            <p className="mt-2 text-3xl font-black leading-none">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-t-xl border border-slate-200 border-b-0 bg-white/95 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3">
          <div className="w-full flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative flex-1">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo mã yêu cầu, trạng thái, nội dung, khách hàng, người xử lý..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="h-11 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 whitespace-nowrap"
            >
              Xóa lọc
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SearchableMultiSelect
              values={statusFilters}
              onChange={(values) =>
                setStatusFilters(
                  values.filter(
                    (value): value is ProgrammingRequestStatus =>
                      isProgrammingRequestStatus(value)
                  )
                )
              }
              options={statusFilterOptions}
              placeholder="Tất cả trạng thái"
              triggerClassName="border-slate-200 bg-white"
            />
            <SearchableSelect
              value={reqType}
              onChange={(value) => setReqType(value as ProgrammingRequestType | '')}
              options={[
                { value: '', label: 'Tất cả loại YC' },
                ...PROGRAMMING_REQUEST_TYPES.map((type) => ({
                  value: type,
                  label: TYPE_LABEL[type],
                })),
              ]}
              placeholder="Tất cả loại YC"
              triggerClassName="h-11 w-full border border-slate-200 bg-white text-sm shadow-sm"
            />
            <SearchableSelect
              value={coderId}
              onChange={(value) => setCoderId(value)}
              options={coderOptions}
              placeholder="Tất cả Dev"
              triggerClassName="h-11 w-full border border-slate-200 bg-white text-sm shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Từ ngày nhận yêu cầu</label>
              <BlackDatePicker
                value={requestedDateFrom}
                onChange={setRequestedDateFrom}
                max={requestedDateTo}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đến ngày nhận yêu cầu</label>
              <BlackDatePicker
                value={requestedDateTo}
                onChange={setRequestedDateTo}
                min={requestedDateFrom}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full border-collapse text-left">
            <thead className="border-y border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Mã YC</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Tên YC</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Sản phẩm</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Khách hàng</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Loại</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Tiến độ</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Hạn phân tích</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Hạn Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Ngày TBKH</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-deep-teal">Dev</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-sm text-slate-500">
                    Không có dữ liệu phù hợp.
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-6 py-4 align-top">
                      <p className="font-bold text-slate-800">{item.req_code}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatDisplayDate(item.requested_date)}</p>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <p className="font-semibold text-slate-800">{item.req_name}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700 max-w-[260px]" title={item.product_name || '-'}>
                      <p className="line-clamp-2">{item.product_name || '-'}</p>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700 max-w-[260px]" title={item.customer_name || '-'}>
                      <p className="line-clamp-2">{item.customer_name || '-'}</p>
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{TYPE_LABEL[item.req_type]}</td>
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[item.status] || 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABEL[item.status] || String(item.status || '-')}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-sm font-semibold text-slate-700">{renderProgressPercent(item.overall_progress)}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{formatDisplayDate(item.analyze_end_date)}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{formatDisplayDate(item.code_end_date)}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{formatDisplayDate(item.noti_date)}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-700">{item.coder_name || '-'}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          title="Chi tiết"
                          aria-label="Chi tiết"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit?.(item)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          title="Sửa"
                          aria-label="Sửa"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        {item.status === 'NEW' && (
                          <button
                            type="button"
                            onClick={() => onCancel?.(item)}
                            className="p-1.5 text-slate-400 hover:text-error transition-colors"
                            title="Hủy yêu cầu"
                            aria-label="Hủy yêu cầu"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={serverMode ? paginationMeta?.page || 1 : currentPage}
          totalItems={totalItems}
          rowsPerPage={serverMode ? paginationMeta?.per_page || rowsPerPage : rowsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          onRowsPerPageChange={(rows) => setRowsPerPage(rows)}
        />
      </section>
    </div>
  );
};
