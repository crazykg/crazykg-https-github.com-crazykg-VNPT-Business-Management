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
}) => {
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
        className: 'bg-slate-100 text-slate-600',
      };
    }

    return {
      label: 'Hoạt động',
      className: 'bg-green-100 text-green-700',
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
        let aValue: unknown = a[sortConfig.key];
        let bValue: unknown = b[sortConfig.key];

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
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {resolvePositionLabel(item)}
    </span>
  );

  const renderStatusBadge = (item: CustomerPersonnel) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta(item.status).className}`}>
      {statusMeta(item.status).label}
    </span>
  );

  const renderContactInfo = (phoneNumber: string, email: string) => {
    if (!phoneNumber && !email) {
      return <span className="text-sm text-slate-400">--</span>;
    }

    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        {phoneNumber ? (
          <a
            href={`tel:${phoneNumber}`}
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-primary hover:underline break-all"
          >
            {phoneNumber}
          </a>
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            className="text-xs text-slate-500 underline-offset-2 hover:text-primary hover:underline break-all"
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
      <div className={`flex ${className} gap-2`}>
        {canEdit ? (
          <button
            onClick={() => onOpenModal('EDIT_CUS_PERSONNEL', item)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-primary"
            title="Chỉnh sửa"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={() => onOpenModal('DELETE_CUS_PERSONNEL', item)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-error"
            title="Xóa"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Nhân sự liên hệ</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh sách nhân sự đầu mối từ khách hàng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canImport && (
            <div className="relative flex-1 lg:flex-none">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">upload</span>
                <span className="hidden sm:inline">Nhập</span>
                <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)}></div>
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                    <button
                      onClick={() => {
                        setShowImportMenu(false);
                        onOpenModal('IMPORT_DATA');
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-lg">upload_file</span>
                      Nhập dữ liệu
                    </button>
                    <button
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
          )}

          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
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
                    onClick={() => handleExport('excel')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span> Excel
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span> CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span> PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {canEdit && (
            <button
              onClick={() => onOpenModal('ADD_CUS_PERSONNEL')}
              className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Thêm mới</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">perm_contact_calendar</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Hoạt động</p>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">check_circle</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Không hoạt động</p>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-lg material-symbols-outlined">pause_circle</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{inactiveCount}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="w-full md:flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên nhân sự, tên khách hàng..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
              />
            </div>
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
              <SearchableSelect
                className="w-full md:w-auto xl:w-48"
                value={positionFilter}
                onChange={(value) => {
                  setPositionFilter(value);
                  setCurrentPage(1);
                }}
                options={positionFilterOptions}
                placeholder="Tất cả vai trò"
                triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
              <SearchableSelect
                className="w-full md:w-auto xl:w-44"
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
                triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
              <div className="relative lg:hidden">
                <label htmlFor="cus-personnel-sort" className="sr-only">Sắp xếp danh sách</label>
                <select
                  id="cus-personnel-sort"
                  value={sortSelectValue}
                  onChange={(e) => handleResponsiveSortChange(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border-none bg-slate-50 pl-3 pr-9 text-sm text-slate-600 outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  aria-label="Sắp xếp danh sách"
                >
                  {RESPONSIVE_SORT_OPTIONS.map((option) => (
                    <option key={option.value || 'default'} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  swap_vert
                </span>
              </div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex h-10 justify-center items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors ${showAdvanced ? 'bg-secondary/20 text-deep-teal border-secondary/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="material-symbols-outlined text-xl">filter_list</span>
                <span className="hidden md:inline">Bộ lọc</span>
              </button>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                Xóa bộ lọc
              </button>
            ) : null}
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 animate-slide-in">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">call</span>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                  placeholder="Lọc theo số điện thoại"
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
                  placeholder="Lọc theo email"
                />
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                Đang lọc
              </span>
              {searchInput.trim() && <p className="text-xs text-slate-500">Từ khóa: "{searchInput.trim()}"</p>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          {currentData.length > 0 ? (
            <>
              <div data-testid="cus-personnel-responsive-list" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 lg:hidden">
                {currentData.map((item) => {
                  const phoneNumber = String(item.phoneNumber || '').trim();
                  const email = String(item.email || '').trim();

                  return (
                    <article key={`mobile-${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Khách hàng</p>
                          <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-800" title={getCustomerName(item.customerId)}>
                            {getCustomerName(item.customerId)}
                          </p>
                        </div>
                        <div className="shrink-0">{renderActionButtons(item)}</div>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Họ và tên</p>
                          <p className="mt-1 break-words text-base font-bold leading-6 text-slate-900">{item.fullName || '--'}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Ngày sinh</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">{formatBirthday(item.birthday)}</p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                            {renderPositionBadge(item)}
                            {renderStatusBadge(item)}
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Liên hệ</p>
                          <div className="mt-1 min-w-0">
                            {renderContactInfo(phoneNumber, email)}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table
                  data-testid="cus-personnel-desktop-table"
                  className={`w-full table-fixed text-left border-collapse ${showActionColumn ? 'min-w-[1340px]' : 'min-w-[1220px]'}`}
                >
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      {[
                        { label: 'Khách hàng', key: 'customerId', widthClassName: 'w-[300px] min-w-[300px]' },
                        { label: 'Họ và tên', key: 'fullName', widthClassName: 'w-[250px] min-w-[250px]' },
                        { label: 'Ngày sinh', key: 'birthday', widthClassName: 'w-[150px] min-w-[150px]' },
                        { label: 'Chức vụ', key: 'positionType', widthClassName: 'w-[170px] min-w-[170px]' },
                        { label: 'Trạng thái', key: 'status', widthClassName: 'w-[170px] min-w-[170px]' },
                        { label: 'Liên hệ', key: 'phoneNumber', widthClassName: 'w-[300px] min-w-[300px]' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`cursor-pointer select-none px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                          onClick={() => handleSort(col.key as keyof CustomerPersonnel)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-deep-teal">{col.label}</span>
                            {renderSortIcon(col.key as keyof CustomerPersonnel)}
                          </div>
                        </th>
                      ))}
                      {showActionColumn ? (
                        <th className="sticky right-0 w-[120px] min-w-[120px] bg-slate-50 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                          Thao tác
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentData.map((item) => {
                      const phoneNumber = String(item.phoneNumber || '').trim();
                      const email = String(item.email || '').trim();

                      return (
                        <tr key={String(item.id)} className="transition-colors hover:bg-slate-50">
                          <td className="px-6 py-4 align-top text-sm font-medium text-slate-700" title={getCustomerName(item.customerId)}>
                            <div className="max-w-[268px] whitespace-normal break-words leading-6">
                              {getCustomerName(item.customerId)}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top text-sm font-semibold text-slate-900">
                            <div className="max-w-[220px] whitespace-normal break-words leading-6">
                              {item.fullName || '--'}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top text-sm text-slate-600">{formatBirthday(item.birthday)}</td>
                          <td className="px-6 py-4 align-top">
                            {renderPositionBadge(item)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {renderStatusBadge(item)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {renderContactInfo(phoneNumber, email)}
                          </td>
                          {showActionColumn ? (
                            <td className="sticky right-0 bg-white px-6 py-4 text-right align-top shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
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
            <div className="px-6 py-10 text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-slate-300">
                  {showNoDataState ? 'perm_contact_calendar' : 'search_off'}
                </span>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-700">
                    {showNoDataState ? 'Chưa có nhân sự liên hệ nào.' : 'Không tìm thấy nhân sự phù hợp.'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {showNoDataState
                      ? (canEdit ? 'Nhấn "Thêm mới" để bắt đầu tạo đầu mối liên hệ đầu tiên.' : 'Dữ liệu nhân sự liên hệ sẽ hiển thị tại đây khi có phát sinh.')
                      : 'Thử thay đổi bộ lọc hoặc xóa bộ lọc để xem lại danh sách.'}
                  </p>
                </div>
                {showNoDataState && canEdit ? (
                  <button
                    onClick={() => onOpenModal('ADD_CUS_PERSONNEL')}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Thêm mới
                  </button>
                ) : null}
                {showNoMatchState && hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-lg">filter_alt_off</span>
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
