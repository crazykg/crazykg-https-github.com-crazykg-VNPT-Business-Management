import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import { useModuleShortcuts } from '../hooks/useModuleShortcuts';
import { Customer, CustomerAggregateKpis, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import {
  CUSTOMER_SECTOR_OPTIONS,
  getCustomerGroupDisplay,
  resolveCustomerSector,
  resolveHealthcareFacilityType,
} from '../utils/customerClassification';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';
import { exportCsv, exportCustomersByCurrentQuery, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface CustomerListQuery extends PaginatedQuery {}

interface CustomerListProps {
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Customer) => void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: CustomerListQuery) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canImport?: boolean;
  aggregateKpis?: CustomerAggregateKpis;
}

type CustomerSortDirection = 'asc' | 'desc';
type CustomerSortKey = keyof Customer;
type CustomerSortConfig = { key: CustomerSortKey; direction: CustomerSortDirection };
type CustomerCompactViewMode = 'grid' | 'list';
type HealthcareBreakdownKey = keyof CustomerAggregateKpis['healthcareBreakdown'];
type HealthcareFacilityFilterValue =
  | 'PUBLIC_HOSPITAL'
  | 'PRIVATE_HOSPITAL'
  | 'MEDICAL_CENTER'
  | 'PRIVATE_CLINIC'
  | 'TYT_PKDK'
  | 'OTHER';

const RESPONSIVE_SORT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'Mặc định' },
  { value: 'customer_code:asc', label: 'Mã khách hàng A-Z' },
  { value: 'customer_code:desc', label: 'Mã khách hàng Z-A' },
  { value: 'customer_name:asc', label: 'Tên khách hàng A-Z' },
  { value: 'customer_name:desc', label: 'Tên khách hàng Z-A' },
  { value: 'customer_sector:asc', label: 'Nhóm khách hàng A-Z' },
  { value: 'customer_sector:desc', label: 'Nhóm khách hàng Z-A' },
  { value: 'tax_code:asc', label: 'Mã số thuế tăng dần' },
  { value: 'tax_code:desc', label: 'Mã số thuế giảm dần' },
  { value: 'created_at:asc', label: 'Ngày tạo cũ nhất' },
  { value: 'created_at:desc', label: 'Ngày tạo mới nhất' },
];

const CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR: Record<string, string> = {
  HEALTHCARE: 'bg-secondary/15 text-secondary',
  GOVERNMENT: 'bg-primary/10 text-primary',
  INDIVIDUAL: 'bg-emerald-100 text-emerald-700',
  OTHER: 'bg-slate-200 text-slate-500',
};

const EMPTY_HEALTHCARE_BREAKDOWN: CustomerAggregateKpis['healthcareBreakdown'] = {
  publicHospital: 0,
  privateHospital: 0,
  medicalCenter: 0,
  privateClinic: 0,
  tytPkdk: 0,
  other: 0,
};

const HEALTHCARE_BREAKDOWN_LABELS: Array<{
  key: HealthcareBreakdownKey;
  label: string;
  accentClassName: string;
}> = [
  { key: 'publicHospital', label: 'Bệnh viện công lập', accentClassName: 'text-primary bg-primary/5 border-primary/20' },
  { key: 'privateHospital', label: 'Bệnh viện tư nhân', accentClassName: 'text-secondary bg-secondary/10 border-secondary/20' },
  { key: 'medicalCenter', label: 'Trung tâm Y tế', accentClassName: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  { key: 'privateClinic', label: 'Phòng khám tư nhân', accentClassName: 'text-deep-teal bg-deep-teal/5 border-deep-teal/20' },
  { key: 'tytPkdk', label: 'TYT và PKĐK', accentClassName: 'text-warning bg-amber-50 border-amber-100' },
  { key: 'other', label: 'Khác', accentClassName: 'text-neutral bg-slate-50 border-slate-200' },
] as const;

const HEALTHCARE_BREAKDOWN_FILTER_MAP: Record<HealthcareBreakdownKey, HealthcareFacilityFilterValue> = {
  publicHospital: 'PUBLIC_HOSPITAL',
  privateHospital: 'PRIVATE_HOSPITAL',
  medicalCenter: 'MEDICAL_CENTER',
  privateClinic: 'PRIVATE_CLINIC',
  tytPkdk: 'TYT_PKDK',
  other: 'OTHER',
};

const CUSTOMER_VIEW_MODE_OPTIONS: Array<{
  value: CustomerCompactViewMode;
  label: string;
  icon: string;
}> = [
  { value: 'grid', label: 'Lưới', icon: 'grid_view' },
  { value: 'list', label: 'Danh sách', icon: 'view_list' },
];

const CUSTOMER_VIEW_MODE_KEY = 'customers_view_mode';

const readCustomerViewMode = (): CustomerCompactViewMode => {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') {
    return 'grid';
  }

  const storedValue = window.localStorage.getItem(CUSTOMER_VIEW_MODE_KEY);
  return storedValue === 'list' ? 'list' : 'grid';
};

const persistCustomerViewMode = (value: CustomerCompactViewMode): void => {
  if (typeof window === 'undefined' || typeof window.localStorage?.setItem !== 'function') {
    return;
  }

  window.localStorage.setItem(CUSTOMER_VIEW_MODE_KEY, value);
};

const isCompactKpiViewport = (): boolean => (
  typeof window !== 'undefined' ? window.innerWidth < 768 : false
);

export const CustomerList: React.FC<CustomerListProps> = ({
  customers = [],
  onOpenModal,
  onNotify,
  paginationMeta,
  isLoading = false,
  onQueryChange,
  canEdit = false,
  canDelete = false,
  canImport = false,
  aggregateKpis,
}: CustomerListProps) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerSectors, setSelectedCustomerSectors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<CustomerSortConfig | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [compactViewMode, setCompactViewMode] = useState<CustomerCompactViewMode>(readCustomerViewMode);
  const [showHealthcareBreakdown, setShowHealthcareBreakdown] = useState(false);
  const [kpiCollapsed, setKpiCollapsed] = useState(isCompactKpiViewport);
  const [selectedHealthcareFacilityType, setSelectedHealthcareFacilityType] = useState<HealthcareFacilityFilterValue | null>(null);

  useEscKey(() => {
    setShowImportMenu(false);
    setShowExportMenu(false);
  }, showImportMenu || showExportMenu);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);

  useModuleShortcuts({
    onNew: () => onOpenModal('ADD_CUSTOMER'),
    onUpdate: () => {
      if (selectedRowId) {
        const item = (customers ?? []).find((c) => String(c.id) === String(selectedRowId));
        if (item) onOpenModal('EDIT_CUSTOMER', item);
      }
    },
    onDelete: () => {
      if (selectedRowId) {
        const item = (customers ?? []).find((c) => String(c.id) === String(selectedRowId));
        if (item) onOpenModal('DELETE_CUSTOMER', item);
      }
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  const showActionColumn = canEdit || canDelete;
  const hasActiveFilters = searchTerm.trim() !== '' || selectedCustomerSectors.length > 0 || selectedHealthcareFacilityType !== null;
  const customerSectorFilterOptions = useMemo(
    () => CUSTOMER_SECTOR_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      searchText: `${option.label} ${option.description}`,
    })),
    [],
  );

  const fallbackAggregateKpis = useMemo<CustomerAggregateKpis>(() => {
    const next: CustomerAggregateKpis = {
      totalCustomers: 0,
      healthcareCustomers: 0,
      governmentCustomers: 0,
      individualCustomers: 0,
      healthcareBreakdown: { ...EMPTY_HEALTHCARE_BREAKDOWN },
    };

    for (const customer of customers) {
      const sector = resolveCustomerSector(customer);

      if (sector === 'HEALTHCARE') {
        next.healthcareCustomers += 1;

        const facilityType = resolveHealthcareFacilityType(customer) || 'OTHER';
        if (facilityType === 'PUBLIC_HOSPITAL') next.healthcareBreakdown.publicHospital += 1;
        else if (facilityType === 'PRIVATE_HOSPITAL') next.healthcareBreakdown.privateHospital += 1;
        else if (facilityType === 'MEDICAL_CENTER') next.healthcareBreakdown.medicalCenter += 1;
        else if (facilityType === 'PRIVATE_CLINIC') next.healthcareBreakdown.privateClinic += 1;
        else if (facilityType === 'TYT_PKDK') next.healthcareBreakdown.tytPkdk += 1;
        else next.healthcareBreakdown.other += 1;

        continue;
      }

      if (sector === 'GOVERNMENT') {
        next.governmentCustomers += 1;
        continue;
      }

      if (sector === 'INDIVIDUAL') {
        next.individualCustomers += 1;
      }
    }

    next.totalCustomers = next.healthcareCustomers + next.governmentCustomers + next.individualCustomers;

    return next;
  }, [customers]);

  const effectiveAggregateKpis = useMemo<CustomerAggregateKpis>(() => ({
    totalCustomers: aggregateKpis?.totalCustomers ?? fallbackAggregateKpis.totalCustomers,
    healthcareCustomers: aggregateKpis?.healthcareCustomers ?? fallbackAggregateKpis.healthcareCustomers,
    governmentCustomers: aggregateKpis?.governmentCustomers ?? fallbackAggregateKpis.governmentCustomers,
    individualCustomers: aggregateKpis?.individualCustomers ?? fallbackAggregateKpis.individualCustomers,
    healthcareBreakdown: {
      ...fallbackAggregateKpis.healthcareBreakdown,
      ...(aggregateKpis?.healthcareBreakdown || {}),
    },
  }), [aggregateKpis, fallbackAggregateKpis]);

  const healthcareBreakdownItems = useMemo(
    () => HEALTHCARE_BREAKDOWN_LABELS.filter(
      (item) => item.key !== 'other' || effectiveAggregateKpis.healthcareBreakdown.other > 0,
    ),
    [effectiveAggregateKpis.healthcareBreakdown.other],
  );

  useEffect(() => {
    if (effectiveAggregateKpis.healthcareCustomers === 0 && showHealthcareBreakdown) {
      setShowHealthcareBreakdown(false);
    }
  }, [effectiveAggregateKpis.healthcareCustomers, showHealthcareBreakdown]);

  const filteredCustomers = useMemo(() => {
    if (serverMode) {
      return customers || [];
    }

    let result = (customers || []).filter((customer) => {
      const sector = resolveCustomerSector(customer);

      if (selectedCustomerSectors.length > 0) {
        if (!selectedCustomerSectors.includes(sector)) {
          return false;
        }
      }

      if (selectedHealthcareFacilityType !== null) {
        if (sector !== 'HEALTHCARE') {
          return false;
        }

        const facilityType = resolveHealthcareFacilityType(customer) || 'OTHER';
        if (facilityType !== selectedHealthcareFacilityType) {
          return false;
        }
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      return (
        String(customer.customer_name || '').toLowerCase().includes(normalizedSearch)
        || String(customer.customer_code || '').toLowerCase().includes(normalizedSearch)
        || String(customer.tax_code || '').toLowerCase().includes(normalizedSearch)
      );
    });

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue: string | number | null | undefined = a[sortConfig.key] as string | number | null | undefined;
        let bValue: string | number | null | undefined = b[sortConfig.key] as string | number | null | undefined;

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
  }, [serverMode, customers, searchTerm, selectedCustomerSectors, selectedHealthcareFacilityType, sortConfig]);

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredCustomers.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    const nextFilters: Record<string, string> = {};
    if (selectedCustomerSectors.length > 0) {
      nextFilters.customer_sector = selectedCustomerSectors.join(',');
    }
    if (selectedHealthcareFacilityType !== null) {
      nextFilters.healthcare_facility_type = selectedHealthcareFacilityType;
    }

    onQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'customer_code',
      sort_dir: sortConfig?.direction || 'asc',
      filters: nextFilters,
    });
  }, [
    serverMode,
    onQueryChange,
    currentPage,
    rowsPerPage,
    searchTerm,
    sortConfig,
    selectedCustomerSectors,
    selectedHealthcareFacilityType,
  ]);

  const currentData = serverMode
    ? (customers || [])
    : filteredCustomers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const showNoDataState = !isLoading && (
    serverMode
      ? totalItems === 0 && !hasActiveFilters
      : customers.length === 0
  );
  const showNoMatchState = !isLoading && !showNoDataState && currentData.length === 0;

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCustomerSectors([]);
    setSelectedHealthcareFacilityType(null);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCustomerSectorFilterChange = (values: string[]) => {
    setSelectedCustomerSectors(values);
    setCurrentPage(1);
  };

  const handleHealthcareBreakdownFilterToggle = (breakdownKey: HealthcareBreakdownKey) => {
    const nextFacilityType = HEALTHCARE_BREAKDOWN_FILTER_MAP[breakdownKey];
    setSelectedHealthcareFacilityType((previous) => (
      previous === nextFacilityType ? null : nextFacilityType
    ));
    setCurrentPage(1);
  };

  const handleSort = (key: keyof Customer) => {
    let direction: CustomerSortDirection = 'asc';
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
      key: key as CustomerSortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof Customer) => {
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
    const headers = ['Mã khách hàng', 'Tên khách hàng', 'Nhóm khách hàng', 'Loại hình cơ sở y tế', 'Quy mô giường bệnh', 'Mã số thuế', 'Địa chỉ'];
    const sampleRows = [
      ['93002', 'Trung tâm Y tế khu vực Vị Thủy', 'Y tế', 'Trung tâm Y tế', '320', '0127160495', 'Số 02 Nguyễn Trãi, Vị Thủy, Hậu Giang'],
      ['93003', 'Trung tâm Y tế khu vực Long Mỹ', 'Y tế', 'Trung tâm Y tế', '280', '0135802471', 'Long Mỹ, Hậu Giang'],
      ['93100', 'Bệnh viện Đa khoa Tỉnh Hậu Giang', 'Y tế', 'Bệnh viện (Công lập)', '500', '0101234567', 'Vị Thanh, Hậu Giang'],
      ['93107', 'Bệnh viện Tư nhân Quốc tế Phương Nam', 'Y tế', 'Bệnh viện (Tư nhân)', '220', '0107654321', 'Ninh Kiều, Cần Thơ'],
      ['93106', 'Phòng khám Đa khoa An Bình', 'Y tế', 'TYT và PKĐK', '', '1800123456', 'Ngã Bảy, Hậu Giang'],
      ['93122', 'Phòng khám tư nhân Tâm Đức', 'Y tế', 'Phòng khám (Tư nhân)', '', '1800765432', 'Vị Thanh, Hậu Giang'],
      ['93123', 'Trung tâm Chăm sóc sức khỏe cộng đồng', 'Y tế', 'Khác', '', '1800111222', 'Sóc Trăng'],
      ['CQ001', 'UBND Phường Vị Thanh', 'Chính quyền', '', '', '1800999001', 'Phường I, Vị Thanh, Hậu Giang'],
      ['CN001', 'Nguyễn Văn An', 'Cá nhân', '', '', '', 'Long Mỹ, Hậu Giang'],
      ['KHAC01', 'Công ty TNHH Thiết bị Y tế Minh Phúc', 'Khác', '', '', '0312345678', 'Ninh Kiều, Cần Thơ'],
    ];
    downloadExcelTemplate('mau_nhap_khach_hang', 'KhachHang', headers, sampleRows);
  };

  const buildRemoteExportQuery = (): CustomerListQuery => {
    const nextFilters: Record<string, string> = {};
    if (selectedCustomerSectors.length > 0) {
      nextFilters.customer_sector = selectedCustomerSectors.join(',');
    }
    if (selectedHealthcareFacilityType !== null) {
      nextFilters.healthcare_facility_type = selectedHealthcareFacilityType;
    }

    return {
      page: 1,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'customer_code',
      sort_dir: sortConfig?.direction || 'asc',
      filters: nextFilters,
    };
  };

  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    if (isExporting) {
      return;
    }

    setShowExportMenu(false);
    setIsExporting(true);

    try {
      const dataToExport = serverMode
        ? await exportCustomersByCurrentQuery(buildRemoteExportQuery())
        : filteredCustomers;
      const headers = ['Mã KH', 'Tên Khách Hàng', 'Nhóm khách hàng', 'Mã số thuế', 'Địa chỉ', 'Ngày tạo'];
      const rows = dataToExport.map((row) => [
        row.customer_code || '',
        row.customer_name,
        getCustomerGroupDisplay(row).label,
        row.tax_code || '',
        row.address || '',
        row.created_at || '',
      ]);
      const fileName = `ds_khach_hang_${isoDateStamp()}`;

      if (type === 'excel') {
        exportExcel(fileName, 'KhachHang', headers, rows);
        return;
      }

      if (type === 'csv') {
        exportCsv(fileName, headers, rows);
        return;
      }

      const canPrint = exportPdfTable({
        fileName,
        title: 'Danh sách khách hàng',
        headers,
        rows,
        subtitle: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`,
        landscape: true,
      });

      if (!canPrint) {
        onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
      }
    } catch (error) {
      const message = error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'Không thể xuất dữ liệu khách hàng.';
      onNotify?.('error', 'Xuất dữ liệu', message);
    } finally {
      setIsExporting(false);
    }
  };

  const renderActionButtons = (item: Customer, className = 'justify-end') => {
    if (!showActionColumn) {
      return null;
    }

    return (
      <div className={`flex ${className} gap-0.5`}>
        {canEdit ? (
          <button
            onClick={() => onOpenModal('EDIT_CUSTOMER', item)}
            className="rounded p-0.5 text-slate-400 transition-colors hover:text-primary hover:bg-slate-100"
            title="Chỉnh sửa"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={() => onOpenModal('DELETE_CUSTOMER', item)}
            className="rounded p-0.5 text-slate-400 transition-colors hover:text-error hover:bg-slate-100"
            title="Xóa"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
          </button>
        ) : null}
      </div>
    );
  };

  const renderDetailButton = (item: Customer, iconOnly = false) => (
    <button
      onClick={() => onOpenModal('CUSTOMER_INSIGHT', item)}
      className={`rounded text-slate-400 transition-colors hover:bg-secondary/10 hover:text-secondary ${iconOnly ? 'p-0.5' : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold'}`}
      title="Xem chi tiết khách hàng 360"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_search</span>
      {iconOnly ? null : <span>Khách hàng 360</span>}
    </button>
  );

  const renderCustomerGroup = (item: Customer, compact = false) => {
    const group = getCustomerGroupDisplay(item);
    const badgeClassName = CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR[group.sector] || CUSTOMER_GROUP_BADGE_CLASS_BY_SECTOR.OTHER;
    const healthcareDetail = group.sector === 'HEALTHCARE' ? group.detail : null;

    return (
      <div className={`${compact ? '' : 'min-w-0'} space-y-1`}>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClassName}`}>
          {group.label}
        </span>
        {healthcareDetail ? (
          <p className="max-w-full break-words text-[11px] leading-4 text-slate-500">
            {healthcareDetail}
          </p>
        ) : null}
      </div>
    );
  };

  const renderCustomerCode = (item: Customer, _compact = false) => {
    const customerCode = item.customer_code || '--';

    return (
      <div className="min-w-0 space-y-1">
        <p className="font-mono font-bold text-xs text-slate-600">{customerCode}</p>
        {item.customer_code_auto_generated ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Tự sinh
          </span>
        ) : null}
      </div>
    );
  };

  const selectedSectorLabels = customerSectorFilterOptions
    .filter((option) => selectedCustomerSectors.includes(String(option.value)))
    .map((option) => option.label);
  const selectedHealthcareFacilityLabel = selectedHealthcareFacilityType
    ? (
      HEALTHCARE_BREAKDOWN_LABELS.find(
        (item) => HEALTHCARE_BREAKDOWN_FILTER_MAP[item.key] === selectedHealthcareFacilityType,
      )?.label || 'Khác'
    )
    : null;
  const isGridView = compactViewMode === 'grid';

  return (
    <div className="p-3 pb-6 space-y-3">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>groups</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Khách hàng</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canImport ? (
            <div className="relative">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload</span>
                Nhập
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute top-full left-0 z-20 mt-1 flex w-44 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <button
                      onClick={() => { setShowImportMenu(false); onOpenModal('IMPORT_DATA'); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>upload_file</span>
                      Nhập dữ liệu
                    </button>
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
              Xuất
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute top-full right-0 z-20 mt-1 flex w-36 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>table_view</span>
                    Excel
                  </button>
                  <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 hover:text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>csv</span>
                    CSV
                  </button>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 hover:text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>picture_as_pdf</span>
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>

          {canEdit ? (
            <button
              onClick={() => onOpenModal('ADD_CUSTOMER')}
              title="Thêm khách hàng (Ctrl+N / ⌘N)"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Thêm khách hàng
            </button>
          ) : null}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className={kpiCollapsed ? 'hidden' : 'block'}>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {/* Tổng số */}
          <div className="rounded-lg border border-primary/20 bg-primary p-3 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold opacity-80">Tổng số khách hàng</span>
              <div className="w-7 h-7 rounded bg-white/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>groups</span>
              </div>
            </div>
            <p className="text-xl font-black leading-tight">{effectiveAggregateKpis.totalCustomers.toLocaleString('vi-VN')}</p>
            <p className="text-[10px] opacity-70 mt-0.5">Tổng quy mô được hệ thống theo dõi</p>
          </div>

          {/* Y tế — clickable */}
          <button
            type="button"
            aria-expanded={showHealthcareBreakdown}
            onClick={() => {
              if (effectiveAggregateKpis.healthcareCustomers === 0) return;
              setShowHealthcareBreakdown((prev) => !prev);
            }}
            className={`rounded-lg p-3 text-left shadow-sm transition ${
              effectiveAggregateKpis.healthcareCustomers > 0
                ? showHealthcareBreakdown
                  ? 'border border-secondary/30 bg-secondary/10'
                  : 'border border-slate-200 bg-white hover:border-secondary/30 hover:bg-secondary/5'
                : 'border border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral">Khách hàng Y tế</span>
              <div className="flex items-center gap-1">
                <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>local_hospital</span>
                </div>
                {effectiveAggregateKpis.healthcareCustomers > 0 ? (
                  <span
                    className="material-symbols-outlined text-slate-400 transition-transform duration-200"
                    style={{ fontSize: 16, transform: showHealthcareBreakdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    expand_more
                  </span>
                ) : null}
              </div>
            </div>
            <p className="text-xl font-black text-deep-teal leading-tight">{effectiveAggregateKpis.healthcareCustomers.toLocaleString('vi-VN')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {effectiveAggregateKpis.healthcareCustomers > 0 ? 'Nhấn để xem cơ cấu cơ sở y tế' : 'Chưa có dữ liệu y tế'}
            </p>
          </button>

          {/* Chính quyền */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral">Chính quyền</span>
              <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>account_balance</span>
              </div>
            </div>
            <p className="text-xl font-black text-deep-teal leading-tight">{effectiveAggregateKpis.governmentCustomers.toLocaleString('vi-VN')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cơ quan, đơn vị hành chính</p>
          </div>

          {/* Cá nhân */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral">Cá nhân</span>
              <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-700" style={{ fontSize: 15 }}>person</span>
              </div>
            </div>
            <p className="text-xl font-black text-deep-teal leading-tight">{effectiveAggregateKpis.individualCustomers.toLocaleString('vi-VN')}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Khách hàng cá nhân và mua lẻ</p>
          </div>
        </div>

        {/* ── Healthcare breakdown ── */}
        {showHealthcareBreakdown ? (
          <section className="rounded-lg border border-secondary/20 bg-secondary/5 p-3 mt-3" data-testid="customer-healthcare-kpi-breakdown">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-700">Chi tiết loại hình Y tế</span>
              <span className="text-[11px] text-slate-400">— phân rã theo loại cơ sở</span>
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
            >
              {healthcareBreakdownItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selectedHealthcareFacilityType === HEALTHCARE_BREAKDOWN_FILTER_MAP[item.key]}
                  onClick={() => handleHealthcareBreakdownFilterToggle(item.key)}
                  className={`rounded border p-2.5 text-left transition ${
                    selectedHealthcareFacilityType === HEALTHCARE_BREAKDOWN_FILTER_MAP[item.key]
                      ? `${item.accentClassName} ring-2 ring-offset-1 ring-primary/30 shadow-sm`
                      : `${item.accentClassName} hover:-translate-y-0.5 hover:shadow-sm`
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider">{item.label}</p>
                  <p className="mt-1.5 text-xl font-black text-deep-teal">
                    {effectiveAggregateKpis.healthcareBreakdown[item.key].toLocaleString('vi-VN')}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <button
        onClick={() => setKpiCollapsed(prev => !prev)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
      >
        <span className="material-symbols-outlined text-sm">
          {kpiCollapsed ? 'expand_more' : 'expand_less'}
        </span>
        {kpiCollapsed ? 'Hiện phân tích' : 'Ẩn phân tích'}
      </button>

      {/* ── Table section ── */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Filter bar */}
        <div className="border-b border-slate-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-[220px,minmax(260px,1fr),180px,auto] 2xl:items-center">
            <SearchableMultiSelect
              values={selectedCustomerSectors}
              options={customerSectorFilterOptions}
              onChange={handleCustomerSectorFilterChange}
              placeholder="Nhóm khách hàng"
              searchPlaceholder="Tìm nhóm khách hàng..."
              showSelectedChips={false}
              className="w-full min-w-0"
              triggerClassName="!h-8 !min-h-0 !rounded !border !border-slate-200 !bg-white !px-3 !py-0 !text-xs"
            />

            <div className="relative w-full min-w-0">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm mã KH, tên khách hàng, mã số thuế..."
                className="h-8 w-full rounded border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="relative w-full">
              <label htmlFor="customer-list-sort" className="sr-only">Sắp xếp danh sách khách hàng</label>
              <select
                id="customer-list-sort"
                value={sortSelectValue}
                onChange={(e) => handleResponsiveSortChange(e.target.value)}
                className="h-8 w-full appearance-none rounded border border-slate-200 bg-white pl-3 pr-8 text-xs text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              >
                {RESPONSIVE_SORT_OPTIONS.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 16 }}>swap_vert</span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5"
                role="group"
                aria-label="Chế độ hiển thị khách hàng"
                data-testid="customer-view-mode-toggle"
              >
                {CUSTOMER_VIEW_MODE_OPTIONS.map((option) => {
                  const isActive = compactViewMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setCompactViewMode(option.value);
                        persistCustomerViewMode(option.value);
                      }}
                      aria-pressed={isActive}
                      data-testid={`customer-view-mode-${option.value}`}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{option.icon}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
                  Xóa lọc
                </button>
              ) : null}
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>filter_alt</span>
                Đang lọc
              </span>
              {selectedSectorLabels.length > 0 ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  Nhóm: {selectedSectorLabels.join(', ')}
                </span>
              ) : null}
              {selectedHealthcareFacilityLabel ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  Loại hình Y tế: {selectedHealthcareFacilityLabel}
                </span>
              ) : null}
              {searchTerm.trim() ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  Từ khóa: "{searchTerm.trim()}"
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="px-3 py-8 text-center text-xs text-slate-500">Đang tải dữ liệu...</div>
        ) : currentData.length > 0 ? (
          <>
            <div
              data-testid="customer-grid-view"
              className={isGridView ? 'block' : 'hidden'}
            >
              <div
                data-testid="customer-responsive-list"
                className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2"
              >
                {currentData.map((item) => (
                  <article
                    key={`customer-card-${String(item.id)}`}
                    onClick={() => setSelectedRowId((prev) => (String(prev) === String(item.id) ? null : item.id))}
                    className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-colors ${
                      String(selectedRowId) === String(item.id)
                        ? 'border-primary/40 ring-1 ring-primary/30 bg-secondary/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex items-start gap-3 border-b border-slate-100 pb-2">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã khách hàng</p>
                          <div className="min-w-0 flex-1">{renderCustomerCode(item, true)}</div>
                        </div>

                        <div className="flex items-start gap-3 border-b border-slate-100 pb-2">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên khách hàng</p>
                          <p className="min-w-0 flex-1 break-words text-sm font-bold leading-6 text-slate-900">{item.customer_name}</p>
                        </div>

                        <div className="flex items-start gap-3 border-b border-slate-100 pb-2">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nhóm</p>
                          <div className="min-w-0 flex-1">{renderCustomerGroup(item, true)}</div>
                        </div>

                        <div className="flex items-start gap-3 border-b border-slate-100 pb-2">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã số thuế</p>
                          <p className="min-w-0 flex-1 font-mono text-xs font-medium text-slate-700">{item.tax_code || '--'}</p>
                        </div>

                        <div className="flex items-start gap-3 border-b border-slate-100 pb-2">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày tạo</p>
                          <p className="min-w-0 flex-1 text-xs font-medium text-slate-700">{formatDateDdMmYyyy(item.created_at)}</p>
                        </div>

                        <div className="flex items-start gap-3">
                          <p className="w-28 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Địa chỉ</p>
                          <p className="min-w-0 flex-1 break-words text-xs leading-5 text-slate-600">{item.address || '--'}</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 pt-0.5">
                        {renderDetailButton(item, true)}
                        {renderActionButtons(item)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div
              data-testid="customer-list-view"
              className={isGridView ? 'hidden' : 'block'}
            >
              <div className="overflow-x-auto" data-testid="customer-list-table-wrapper">
                <table
                  data-testid="customer-desktop-table"
                  className={`w-full table-fixed border-collapse text-left ${showActionColumn ? 'min-w-[1160px]' : 'min-w-[1080px]'}`}
                >
                  <thead className="border-y border-slate-200 bg-slate-50/90">
                    <tr>
                      {[
                        { label: 'Mã khách hàng', key: 'customer_code', widthClassName: 'w-[136px] min-w-[136px]' },
                        { label: 'Tên khách hàng', key: 'customer_name', widthClassName: 'w-[240px] min-w-[240px]' },
                        { label: 'Nhóm khách hàng', key: 'customer_sector', widthClassName: 'w-[180px] min-w-[180px]' },
                        { label: 'Mã số thuế', key: 'tax_code', widthClassName: 'w-[136px] min-w-[136px]' },
                        { label: 'Địa chỉ', key: 'address', widthClassName: 'w-[220px] min-w-[220px]' },
                        { label: 'Ngày tạo', key: 'created_at', widthClassName: 'w-[104px] min-w-[104px]' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                          onClick={() => handleSort(col.key as keyof Customer)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-deep-teal">{col.label}</span>
                            {renderSortIcon(col.key as keyof Customer)}
                          </div>
                        </th>
                      ))}
                      {showActionColumn ? (
                        <th className="sticky right-[48px] w-[72px] min-w-[72px] bg-slate-50/95 px-2.5 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.2)]">
                          Thao tác
                        </th>
                      ) : null}
                      <th className="sticky right-0 w-[48px] min-w-[48px] bg-slate-50/95 px-2.5 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.2)]">
                        360
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentData.map((item) => (
                      <tr key={String(item.id)} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-3 py-2 align-middle text-xs font-mono font-bold text-slate-500">
                          {renderCustomerCode(item)}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs font-semibold text-slate-900">
                          <div className="max-w-[212px] whitespace-normal break-words leading-5">{item.customer_name}</div>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-slate-600">
                          {renderCustomerGroup(item)}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs font-mono text-slate-600">{item.tax_code || '--'}</td>
                        <td className="px-3 py-2 align-middle text-xs text-slate-600" title={item.address || ''}>
                          <div className="max-w-[190px] whitespace-normal break-words leading-5">{item.address || '--'}</div>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-slate-600">{formatDateDdMmYyyy(item.created_at)}</td>
                        {showActionColumn ? (
                          <td className="sticky right-[48px] bg-white px-2.5 py-2 text-right align-middle shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.2)]">
                            {renderActionButtons(item)}
                          </td>
                        ) : null}
                        <td className="sticky right-0 bg-white px-2.5 py-2 text-center align-middle shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.2)]">
                          {renderDetailButton(item, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="px-3 py-8 text-center text-slate-500">
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>
                {showNoDataState ? 'groups_2' : 'search_off'}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  {showNoDataState ? 'Chưa có khách hàng nào.' : 'Không tìm thấy khách hàng phù hợp.'}
                </p>
                <p className="max-w-xs text-[11px] text-slate-400">
                  {showNoDataState
                    ? (canEdit ? 'Nhấn "Thêm khách hàng" để bắt đầu.' : 'Dữ liệu sẽ hiển thị tại đây khi có phát sinh.')
                    : 'Thử điều chỉnh từ khóa tìm kiếm hoặc xóa bộ lọc.'}
                </p>
              </div>
              {showNoDataState && canEdit ? (
                <button
                  onClick={() => onOpenModal('ADD_CUSTOMER')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                  Thêm khách hàng
                </button>
              ) : null}
              {showNoMatchState && hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
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
          onPageChange={goToPage}
          onRowsPerPageChange={(rows) => {
            setRowsPerPage(rows);
            setCurrentPage(1);
          }}
        />
      </section>
    </div>
  );
};
