import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { CustomerPersonnel, Customer, ModalType, SupportContactPosition } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelWorkbook } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';

interface CusPersonnelListProps {
  personnel: CustomerPersonnel[];
  customers: Customer[];
  supportContactPositions: SupportContactPosition[];
  onOpenModal: (type: ModalType, item?: CustomerPersonnel) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;
type PersonnelSortDirection = 'asc' | 'desc';
type PersonnelSortKey = keyof CustomerPersonnel;
type PersonnelSortConfig = { key: PersonnelSortKey; direction: PersonnelSortDirection };

const RESPONSIVE_SORT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'Mặc định' },
  { value: 'customerId:asc', label: 'Khách hàng A-Z' },
  { value: 'customerId:desc', label: 'Khách hàng Z-A' },
  { value: 'fullName:asc', label: 'Họ và tên A-Z' },
  { value: 'fullName:desc', label: 'Họ và tên Z-A' },
  { value: 'birthday:asc', label: 'Ngày sinh tăng dần' },
  { value: 'birthday:desc', label: 'Ngày sinh giảm dần' },
  { value: 'positionType:asc', label: 'Chức vụ A-Z' },
  { value: 'positionType:desc', label: 'Chức vụ Z-A' },
  { value: 'status:asc', label: 'Trạng thái A-Z' },
  { value: 'status:desc', label: 'Trạng thái Z-A' },
  { value: 'phoneNumber:asc', label: 'Liên hệ tăng dần' },
  { value: 'phoneNumber:desc', label: 'Liên hệ giảm dần' },
];

export const CusPersonnelList: React.FC<CusPersonnelListProps> = ({
  personnel = [],
  customers = [],
  supportContactPositions = [],
  onOpenModal,
  onNotify,
  canEdit = false,
  canDelete = false,
  canImport = false,
}: CusPersonnelListProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<PersonnelSortConfig | null>(null);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const showActionColumn = canEdit || canDelete;
  const hasActiveFilters = [
    searchInput.trim(),
    positionFilter,
    statusFilter,
    phoneInput.trim(),
    emailInput.trim(),
  ].some(Boolean);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhoneFilter(phoneInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [phoneInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmailFilter(emailInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [emailInput]);

  const customerById = useMemo(
    () => new Map((customers || []).map((customer) => [String(customer.id), customer])),
    [customers]
  );

  const customerLabelById = useMemo(
    () => new Map((customers || []).map((customer) => [String(customer.id), `${customer.customer_code} - ${customer.customer_name}`])),
    [customers]
  );

  const getCustomerName = (id: string | number | null | undefined) => {
    const key = String(id ?? '').trim();
    return customerLabelById.get(key) || key || '--';
  };

  const normalizePositionCode = (value: unknown): string => String(value || '').trim().toUpperCase();

  const positionLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (supportContactPositions || []).forEach((position) => {
      const id = String(position.id || '').trim();
      const label = String(position.position_name || '').trim();
      if (id && label) {
        map.set(id, label);
      }
    });
    return map;
  }, [supportContactPositions]);

  const positionIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    (supportContactPositions || []).forEach((position) => {
      const code = normalizePositionCode(position.position_code);
      const id = String(position.id || '').trim();
      if (code && id) {
        map.set(code, id);
      }
    });
    return map;
  }, [supportContactPositions]);

  const positionLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    (supportContactPositions || []).forEach((position) => {
      const code = normalizePositionCode(position.position_code);
      const label = String(position.position_name || '').trim();
      if (code && label) {
        map.set(code, label);
      }
    });
    return map;
  }, [supportContactPositions]);

  const resolvePositionLabel = (item: CustomerPersonnel): string => {
    const byId = positionLabelById.get(String(item.positionId || '').trim());
    if (byId) {
      return byId;
    }

    const byCode = positionLabelByCode.get(normalizePositionCode(item.positionType));
    if (byCode) {
      return byCode;
    }

    const rawLabel = String(item.positionLabel || '').trim();
    const normalizedCode = normalizePositionCode(item.positionType);
    if (rawLabel && normalizePositionCode(rawLabel) !== normalizedCode) {
      return rawLabel;
    }

    if (rawLabel && !normalizedCode) {
      return rawLabel;
    }

    return '--';
  };

  const resolvePositionFilterValue = (item: CustomerPersonnel): string => {
    const positionId = String(item.positionId || '').trim();
    if (positionId) {
      return positionId;
    }

    const code = normalizePositionCode(item.positionType);
    if (!code) {
      return '';
    }

    return positionIdByCode.get(code) || `legacy:${code}`;
  };

  const formatBirthday = (value: string | null | undefined): string => {
    const normalized = String(value || '').trim();
    return normalized ? formatDateDdMmYyyy(normalized) : '--';
  };

  const normalizeStatus = (value: unknown): 'Active' | 'Inactive' => {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'INACTIVE' ? 'Inactive' : 'Active';
  };

  const statusMeta = (value: unknown): { label: string; className: string } => {
    const normalized = normalizeStatus(value);
    if (normalized === 'Inactive') {
      return {
        label: 'Không hoạt động',
        className: 'bg-surface-container text-neutral',
      };
    }

    return {
      label: 'Hoạt động',
      className: 'bg-secondary-fixed text-deep-teal',
    };
  };

  const totalCount = (personnel || []).length;
  const activeCount = useMemo(
    () => (personnel || []).filter((item) => normalizeStatus(item.status) === 'Active').length,
    [personnel]
  );
  const inactiveCount = Math.max(0, totalCount - activeCount);

  const positionFilterOptions = useMemo(() => {
    const options = [{ value: '', label: 'Tất cả vai trò' }];
    const seenValues = new Set<string>();

    (supportContactPositions || []).forEach((position) => {
      const id = String(position.id || '').trim();
      const label = String(position.position_name || '').trim();
      if (!id || !label || seenValues.has(id)) {
        return;
      }

      seenValues.add(id);
      options.push({
        value: id,
        label,
      });
    });

    (personnel || []).forEach((item) => {
      const optionValue = resolvePositionFilterValue(item);
      if (!optionValue || seenValues.has(optionValue)) {
        return;
      }

      seenValues.add(optionValue);
      options.push({
        value: optionValue,
        label: resolvePositionLabel(item),
      });
    });

    return options;
  }, [supportContactPositions, personnel, positionIdByCode, positionLabelByCode, positionLabelById]);

  const filteredPersonnel = useMemo(() => {
    let result = (personnel || []).filter((item) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const customerName = getCustomerName(item.customerId).toLowerCase();
      const fullName = String(item.fullName || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const phoneNumber = String(item.phoneNumber || '');

      const matchesSearch = !normalizedSearch
        || fullName.includes(normalizedSearch)
        || customerName.includes(normalizedSearch)
        || email.includes(normalizedSearch);
      const matchesPosition = positionFilter ? resolvePositionFilterValue(item) === positionFilter : true;
      const matchesStatus = statusFilter ? normalizeStatus(item.status) === statusFilter : true;
      const matchesPhone = phoneFilter ? phoneNumber.includes(phoneFilter) : true;
      const matchesEmail = emailFilter ? email.includes(emailFilter.toLowerCase()) : true;

      return matchesSearch && matchesPosition && matchesStatus && matchesPhone && matchesEmail;
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | null | undefined = a[sortConfig.key] as string | number | null | undefined;
        let bValue: string | number | null | undefined = b[sortConfig.key] as string | number | null | undefined;

        if (sortConfig.key === 'customerId') {
          aValue = getCustomerName(a.customerId);
          bValue = getCustomerName(b.customerId);
        } else if (sortConfig.key === 'positionType') {
          aValue = resolvePositionLabel(a);
          bValue = resolvePositionLabel(b);
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue, 'vi')
            : bValue.localeCompare(aValue, 'vi');
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [
    personnel,
    searchTerm,
    positionFilter,
    statusFilter,
    phoneFilter,
    emailFilter,
    sortConfig,
    customers,
    supportContactPositions,
    customerLabelById,
    positionLabelByCode,
    positionLabelById,
    positionIdByCode,
  ]);

  const totalItems = filteredPersonnel.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredPersonnel.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const showNoDataState = personnel.length === 0;
  const showNoMatchState = personnel.length > 0 && filteredPersonnel.length === 0;

  const resetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setPositionFilter('');
    setStatusFilter('');
    setPhoneInput('');
    setPhoneFilter('');
    setEmailInput('');
    setEmailFilter('');
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSort = (key: keyof CustomerPersonnel) => {
    let direction: PersonnelSortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortSelectValue = sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : '';

  const handleResponsiveSortChange = (value: string) => {
    if (!value) {
      setSortConfig(null);
      setCurrentPage(1);
      return;
    }

    const [key, direction] = value.split(':');
    if (!key) {
      setSortConfig(null);
      setCurrentPage(1);
      return;
    }

    setSortConfig({
      key: key as PersonnelSortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof CustomerPersonnel) => {
    if (sortConfig?.key === key) {
      return (
        <span
          className="material-symbols-outlined text-sm ml-1 transition-transform duration-200"
          style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
  };

  const handleDownloadTemplate = () => {
    setShowImportMenu(false);

    const customerSheetRows = (customers || []).map((customer) => [
      String(customer.id),
      customer.customer_code || '',
      customer.customer_name || '',
    ]);

    const positionRows = (supportContactPositions || []).map((position) => [
      String(position.position_code || ''),
      String(position.position_name || ''),
    ]);

    downloadExcelWorkbook('mau_nhap_nhan_su_lien_he', [
      {
        name: 'NhanSuLienHe',
        headers: [
          'Mã khách hàng',
          'Họ và tên',
          'Ngày sinh',
          'Mã chức vụ',
          'Số điện thoại',
          'Email',
          'Trạng thái',
        ],
        rows: [
          [
            customers[0]?.customer_code || 'KH001',
            'Nguyễn Văn A',
            '1990-05-15',
            String(supportContactPositions[0]?.position_code || ''),
            '0912345678',
            'nguyenvana@example.com',
            'Active',
          ],
        ],
      },
      {
        name: 'KhachHang',
        headers: ['ID', 'Mã khách hàng', 'Tên khách hàng'],
        rows: customerSheetRows,
      },
      {
        name: 'ChucVu',
        headers: ['Mã chức vụ', 'Tên chức vụ'],
        rows: positionRows,
      },
    ]);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);

    const headers = ['Mã KH', 'Tên khách hàng', 'Họ và tên', 'Ngày sinh', 'Chức vụ', 'Số điện thoại', 'Email', 'Trạng thái'];
    const rows = filteredPersonnel.map((item) => {
      const customer = customerById.get(String(item.customerId));
      return [
        customer?.customer_code || String(item.customerId || ''),
        customer?.customer_name || '',
        item.fullName || '',
        item.birthday || '',
        resolvePositionLabel(item),
        item.phoneNumber || '',
        item.email || '',
        statusMeta(item.status).label,
      ];
    });
    const fileName = `ds_nhan_su_lien_he_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'NhanSuLienHe', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sách nhân sự liên hệ',
      headers,
      rows,
      subtitle: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });
    if (!canPrint) {
      onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const renderPositionBadge = (item: CustomerPersonnel) => (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
      {resolvePositionLabel(item)}
    </span>
  );

  const renderStatusBadge = (item: CustomerPersonnel) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusMeta(item.status).className}`}>
      {statusMeta(item.status).label}
    </span>
  );

  const renderContactInfo = (phoneNumber: string, email: string) => {
    if (!phoneNumber && !email) {
      return <span className="text-xs text-slate-400">--</span>;
    }

    return (
      <div className="flex min-w-0 flex-col gap-1">
        {phoneNumber ? (
          <a
            href={`tel:${phoneNumber}`}
            className="text-xs font-medium text-slate-700 underline-offset-2 hover:text-primary hover:underline break-all"
          >
            {phoneNumber}
          </a>
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            className="text-[11px] text-slate-500 underline-offset-2 hover:text-primary hover:underline break-all"
          >
            {email}
          </a>
        ) : null}
      </div>
    );
  };

  const renderActionButtons = (item: CustomerPersonnel, className = 'justify-end') => {
    if (!showActionColumn) {
      return null;
    }

    return (
      <div className={`flex ${className} gap-1`}>
        {canEdit ? (
          <button
            onClick={() => onOpenModal('EDIT_CUS_PERSONNEL', item)}
            className="rounded p-1 text-slate-400 transition-colors hover:text-primary hover:bg-slate-100"
            title="Chỉnh sửa"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={() => onOpenModal('DELETE_CUS_PERSONNEL', item)}
            className="rounded p-1 text-slate-400 transition-colors hover:text-error hover:bg-slate-100"
            title="Xóa"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="p-3 pb-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>perm_contact_calendar</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Đầu mối liên hệ</h2>
            <p className="text-[11px] text-slate-400 leading-tight">Quản lý nhân sự liên hệ của khách hàng.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import */}
          {canImport && (
            <div className="relative">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>upload</span>
                Nhập
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute top-full left-0 z-20 mt-1.5 w-44 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                    <button
                      onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>upload_file</span>
                      Nhập dữ liệu
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>download</span>
              Xuất
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute top-full right-0 z-20 mt-1.5 w-36 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>table_view</span> Excel
                  </button>
                  <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>csv</span> CSV
                  </button>
                  <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Add */}
          {canEdit && (
            <button
              onClick={() => onOpenModal('ADD_CUS_PERSONNEL')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Thêm đầu mối
            </button>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-neutral">Tổng đầu mối</span>
            <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>perm_contact_calendar</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-neutral">Hoạt động</span>
            <div className="w-7 h-7 rounded bg-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-deep-teal" style={{ fontSize: 15 }}>check_circle</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-neutral">Không hoạt động</span>
            <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-neutral" style={{ fontSize: 15 }}>pause_circle</span>
            </div>
          </div>
          <p className="text-xl font-black text-deep-teal leading-tight">{inactiveCount}</p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white px-3 py-2 rounded-t-lg border border-slate-200 border-b-0 space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên nhân sự, tên khách hàng, email..."
              className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary text-xs placeholder:text-slate-400 outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              className="w-48"
              value={positionFilter}
              onChange={(value) => {
                setPositionFilter(value);
                setCurrentPage(1);
              }}
              options={positionFilterOptions}
              placeholder="Tất cả vai trò"
              triggerClassName="h-8 text-xs border-slate-200 focus:border-primary"
            />
            <SearchableSelect
              className="w-40"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(String(value || ''));
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'Active', label: 'Hoạt động' },
                { value: 'Inactive', label: 'Không hoạt động' },
              ]}
              placeholder="Tất cả trạng thái"
              triggerClassName="h-8 text-xs border-slate-200 focus:border-primary"
            />
            <div className="relative lg:hidden">
              <label htmlFor="cus-personnel-sort" className="sr-only">Sắp xếp danh sách</label>
              <select
                id="cus-personnel-sort"
                value={sortSelectValue}
                onChange={(e) => handleResponsiveSortChange(e.target.value)}
                className="h-8 appearance-none rounded border border-slate-200 bg-slate-50 pl-2.5 pr-8 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                aria-label="Sắp xếp danh sách"
              >
                {RESPONSIVE_SORT_OPTIONS.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>swap_vert</span>
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors ${showAdvanced ? 'border-primary/20 bg-primary-container-soft text-deep-teal' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span>
              <span className="hidden md:inline">Bộ lọc</span>
            </button>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                Xóa lọc
              </button>
            ) : null}
          </div>
        </div>

        {showAdvanced ? (
          <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2 md:grid-cols-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>call</span>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary text-xs placeholder:text-slate-400 outline-none"
                placeholder="Lọc theo số điện thoại"
              />
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>mail</span>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary text-xs placeholder:text-slate-400 outline-none"
                placeholder="Lọc theo email"
              />
            </div>
          </div>
        ) : null}

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container-soft px-2 py-0.5 text-[10px] font-bold text-deep-teal">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>filter_alt</span>
              Đang lọc
            </span>
            {searchInput.trim() && <p className="text-[10px] text-slate-500">Từ khóa: "{searchInput.trim()}"</p>}
          </div>
        ) : null}
      </div>

      {/* ── Table section ── */}
      <div className="bg-white rounded-b-lg border border-slate-200 overflow-hidden shadow-sm">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700">Danh sách đầu mối liên hệ</span>
          {hasActiveFilters ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container-soft px-2 py-0.5 text-[10px] font-bold text-deep-teal">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>filter_alt</span>
              Bộ lọc đang bật
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden">
          {currentData.length > 0 ? (
            <>
              {/* Mobile cards */}
              <div data-testid="cus-personnel-responsive-list" className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:hidden">
                {currentData.map((item) => {
                  const phoneNumber = String(item.phoneNumber || '').trim();
                  const email = String(item.email || '').trim();

                  return (
                    <article key={`mobile-${String(item.id)}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khách hàng</p>
                          <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-slate-800" title={getCustomerName(item.customerId)}>
                            {getCustomerName(item.customerId)}
                          </p>
                        </div>
                        <div className="shrink-0">{renderActionButtons(item)}</div>
                      </div>

                      <div className="mt-2.5 space-y-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Họ và tên</p>
                          <p className="mt-0.5 break-words text-xs font-bold leading-5 text-slate-900">{item.fullName || '--'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày sinh</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">{formatBirthday(item.birthday)}</p>
                          </div>
                          <div className="flex flex-wrap items-start gap-1">
                            {renderPositionBadge(item)}
                            {renderStatusBadge(item)}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Liên hệ</p>
                          <div className="mt-0.5 min-w-0">
                            {renderContactInfo(phoneNumber, email)}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table
                  data-testid="cus-personnel-desktop-table"
                  className={`w-full table-fixed text-left border-collapse ${showActionColumn ? 'min-w-[1200px]' : 'min-w-[1100px]'}`}
                >
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      {[
                        { label: 'Khách hàng', key: 'customerId', widthClassName: 'w-[260px] min-w-[260px]' },
                        { label: 'Họ và tên', key: 'fullName', widthClassName: 'w-[220px] min-w-[220px]' },
                        { label: 'Ngày sinh', key: 'birthday', widthClassName: 'w-[130px] min-w-[130px]' },
                        { label: 'Chức vụ', key: 'positionType', widthClassName: 'w-[160px] min-w-[160px]' },
                        { label: 'Trạng thái', key: 'status', widthClassName: 'w-[150px] min-w-[150px]' },
                        { label: 'Liên hệ', key: 'phoneNumber', widthClassName: 'w-[260px] min-w-[260px]' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                          onClick={() => handleSort(col.key as keyof CustomerPersonnel)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-deep-teal">{col.label}</span>
                            {renderSortIcon(col.key as keyof CustomerPersonnel)}
                          </div>
                        </th>
                      ))}
                      {showActionColumn ? (
                        <th className="sticky right-0 w-[90px] min-w-[90px] bg-slate-50 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Thao tác
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentData.map((item) => {
                      const phoneNumber = String(item.phoneNumber || '').trim();
                      const email = String(item.email || '').trim();

                      return (
                        <tr key={String(item.id)} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-3 py-2 align-top text-xs font-medium text-slate-700" title={getCustomerName(item.customerId)}>
                            <div className="max-w-[230px] whitespace-normal break-words leading-5">
                              {getCustomerName(item.customerId)}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-xs font-semibold text-slate-900">
                            <div className="max-w-[190px] whitespace-normal break-words leading-5">
                              {item.fullName || '--'}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-xs text-slate-600">{formatBirthday(item.birthday)}</td>
                          <td className="px-3 py-2 align-top">
                            {renderPositionBadge(item)}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {renderStatusBadge(item)}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {renderContactInfo(phoneNumber, email)}
                          </td>
                          {showActionColumn ? (
                            <td className="sticky right-0 bg-white px-3 py-2 text-right align-top shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                              {renderActionButtons(item)}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="px-3 py-8 text-center text-slate-500">
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>
                  {showNoDataState ? 'perm_contact_calendar' : 'search_off'}
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    {showNoDataState ? 'Chưa có nhân sự liên hệ nào.' : 'Không tìm thấy nhân sự phù hợp.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {showNoDataState
                      ? (canEdit ? 'Nhấn "Thêm đầu mối" để bắt đầu.' : 'Dữ liệu sẽ hiển thị tại đây khi có phát sinh.')
                      : 'Thử thay đổi bộ lọc hoặc xóa bộ lọc để xem lại danh sách.'}
                  </p>
                </div>
                {showNoDataState && canEdit ? (
                  <button
                    onClick={() => onOpenModal('ADD_CUS_PERSONNEL')}
                    className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-deep-teal shadow-sm"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                    Thêm đầu mối
                  </button>
                ) : null}
                {showNoMatchState && hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_alt_off</span>
                    Xóa bộ lọc
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onPageChange={goToPage}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
};
