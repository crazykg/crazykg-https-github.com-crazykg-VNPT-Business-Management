import React, { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useEscKey';
import {
  Customer,
  CustomerPersonnel,
  Employee,
  ModalType,
  Opportunity,
  OpportunityStage,
  OpportunityStageOption,
  Product,
} from '../types';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';
import { downloadExcelTemplate } from '../utils/excelTemplate';
import { exportCsv, exportExcel, exportPdfTable, isoDateStamp } from '../utils/exportUtils';

interface OpportunityListProps {
  opportunities: Opportunity[];
  opportunityStageOptions: OpportunityStageOption[];
  customers: Customer[];
  personnel: CustomerPersonnel[];
  products: Product[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Opportunity) => void;
  onConvert: (item: Opportunity) => void;
  onNotify?: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

interface StageMeta {
  label: string;
  color: string;
}

type OpportunitySortDirection = 'asc' | 'desc';
type OpportunitySortKey = keyof Opportunity;
type OpportunitySortConfig = { key: OpportunitySortKey; direction: OpportunitySortDirection };

const KNOWN_STAGE_META: Record<string, StageMeta> = {
  NEW: { label: 'Mới', color: 'bg-slate-100 text-slate-700' },
  PROPOSAL: { label: 'Đề xuất', color: 'bg-indigo-100 text-indigo-700' },
  NEGOTIATION: { label: 'Đàm phán', color: 'bg-yellow-100 text-yellow-700' },
  WON: { label: 'Thắng', color: 'bg-green-100 text-green-700' },
  LOST: { label: 'Thất bại', color: 'bg-red-100 text-red-700' },
};

const CUSTOM_STAGE_COLOR = 'bg-slate-100 text-slate-700';

// ── Priority metadata ───────────────────────────────────────────────────────
interface PriorityMeta { label: string; color: string; icon: string; }

const PRIORITY_META: Record<number, PriorityMeta> = {
  1: { label: 'Thấp',       color: 'bg-slate-100 text-slate-600',  icon: 'arrow_downward' },
  2: { label: 'Trung bình', color: 'bg-sky-100 text-sky-700',      icon: 'remove' },
  3: { label: 'Cao',        color: 'bg-orange-100 text-orange-700', icon: 'arrow_upward' },
  4: { label: 'Khẩn',       color: 'bg-red-100 text-red-700',      icon: 'priority_high' },
};

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả mức ưu tiên' },
  { value: '4', label: 'Khẩn' },
  { value: '3', label: 'Cao' },
  { value: '2', label: 'Trung bình' },
  { value: '1', label: 'Thấp' },
];

const RESPONSIVE_SORT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'Mặc định' },
  { value: 'opp_name:asc', label: 'Tên cơ hội A-Z' },
  { value: 'opp_name:desc', label: 'Tên cơ hội Z-A' },
  { value: 'customer_id:asc', label: 'Khách hàng A-Z' },
  { value: 'customer_id:desc', label: 'Khách hàng Z-A' },
  { value: 'amount:asc', label: 'Giá trị tăng dần' },
  { value: 'amount:desc', label: 'Giá trị giảm dần' },
  { value: 'stage:asc', label: 'Giai đoạn A-Z' },
  { value: 'stage:desc', label: 'Giai đoạn Z-A' },
  { value: 'priority:asc', label: 'Ưu tiên thấp đến cao' },
  { value: 'priority:desc', label: 'Ưu tiên cao đến thấp' },
];

const normalizeStageCode = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const sortStageDefinitions = (left: OpportunityStageOption, right: OpportunityStageOption): number => {
  const leftSort = Number(left.sort_order ?? 0);
  const rightSort = Number(right.sort_order ?? 0);

  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return String(left.stage_name || left.stage_code || '').localeCompare(
    String(right.stage_name || right.stage_code || ''),
    'vi'
  );
};

export const OpportunityList: React.FC<OpportunityListProps> = ({
  opportunities = [],
  opportunityStageOptions = [],
  customers = [],
  onOpenModal,
  onConvert,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<OpportunitySortConfig | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);
  const hasActiveFilters = [searchTerm.trim(), stageFilter, priorityFilter].some(Boolean);


  const stageDefinitionByCode = useMemo(() => {
    const map = new Map<string, OpportunityStageOption>();

    (opportunityStageOptions || []).forEach((stage) => {
      const code = normalizeStageCode(stage.stage_code);
      if (!code || map.has(code)) {
        return;
      }
      map.set(code, stage);
    });

    Object.keys(KNOWN_STAGE_META).forEach((code) => {
      if (!map.has(code)) {
        map.set(code, {
          id: null,
          stage_code: code,
          stage_name: KNOWN_STAGE_META[code].label,
          is_active: true,
          sort_order: 0,
        });
      }
    });

    return map;
  }, [opportunityStageOptions]);

  const activeStageOptions = useMemo(() => {
    const options = (opportunityStageOptions || [])
      .filter((stage) => stage.is_active !== false)
      .slice()
      .sort(sortStageDefinitions)
      .map((stage) => {
        const code = normalizeStageCode(stage.stage_code);
        return {
          value: code,
          label: stage.stage_name || KNOWN_STAGE_META[code]?.label || code,
        };
      })
      .filter((option) => option.value !== '');

    if (options.length > 0) {
      return options;
    }

    return Object.entries(KNOWN_STAGE_META).map(([value, meta]) => ({ value, label: meta.label }));
  }, [opportunityStageOptions]);

  const getCustomerName = (id: string | number) => {
    const customer = (customers || []).find((c) => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
  };

  const getStageLabel = (stage: string): string => {
    const stageCode = normalizeStageCode(stage);
    const definition = stageDefinitionByCode.get(stageCode);
    if (definition?.stage_name && String(definition.stage_name).trim() !== '') {
      return String(definition.stage_name);
    }
    return KNOWN_STAGE_META[stageCode]?.label || stageCode || String(stage || '--');
  };

  const getStageColor = (stage: string): string => {
    const stageCode = normalizeStageCode(stage);
    return KNOWN_STAGE_META[stageCode]?.color || CUSTOM_STAGE_COLOR;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  const filteredOpportunities = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    const result = (opportunities || []).filter((opp) => {
      const customerName = getCustomerName(opp.customer_id).toLowerCase();
      const oppName = (opp.opp_name || '').toLowerCase();
      const matchesSearch = oppName.includes(searchLower) || customerName.includes(searchLower);
      const matchesStage = stageFilter
        ? normalizeStageCode(opp.stage) === normalizeStageCode(stageFilter)
        : true;
      const matchesPriority = priorityFilter
        ? String(opp.priority ?? 2) === priorityFilter
        : true;

      return matchesSearch && matchesStage && matchesPriority;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customer_id') {
          aValue = getCustomerName(a.customer_id);
          bValue = getCustomerName(b.customer_id);
        }

        if (sortConfig.key === 'stage') {
          aValue = getStageLabel(String(a.stage || ''));
          bValue = getStageLabel(String(b.stage || ''));
        }

        if (sortConfig.key === 'priority') {
          aValue = Number(a.priority ?? 2);
          bValue = Number(b.priority ?? 2);
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
  }, [opportunities, searchTerm, stageFilter, priorityFilter, sortConfig, customers, stageDefinitionByCode]);

  const stageFilterOptions = useMemo(
    () => [{ value: '', label: 'Tất cả giai đoạn' }, ...activeStageOptions],
    [activeStageOptions]
  );

  const totalAmount = useMemo(
    () => filteredOpportunities.reduce((sum, item) => sum + (item.amount || 0), 0),
    [filteredOpportunities]
  );

  const totalItems = filteredOpportunities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentData = filteredOpportunities.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Opportunity) => {
    let direction: OpportunitySortDirection = 'asc';
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
      key: key as OpportunitySortKey,
      direction: direction === 'desc' ? 'desc' : 'asc',
    });
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof Opportunity) => {
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
    const headers = ['Tên cơ hội', 'Khách hàng (Mã KH/ID/Tên KH)', 'Giá trị dự kiến (VNĐ)', 'Giai đoạn'];
    const sampleRows = [
      ['Triển khai VNPT HIS cho Vietcombank', 'KH001', '150000000', 'Đề xuất'],
      ['Dịch vụ SOC cho Petrolimex', 'KH002', '80000000', 'Đàm phán'],
    ];
    downloadExcelTemplate('mau_nhap_co_hoi_kinh_doanh', 'CoHoiKinhDoanh', headers, sampleRows);
  };

  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const headers = ['Tên cơ hội', 'Khách hàng', 'Giá trị dự kiến (VNĐ)', 'Giai đoạn', 'Ưu tiên'];
    const rows = filteredOpportunities.map((row) => [
      row.opp_name || '',
      getCustomerName(row.customer_id),
      Number(row.amount || 0),
      getStageLabel(String(row.stage || '')),
      PRIORITY_META[Number(row.priority ?? 2)]?.label ?? 'Trung bình',
    ]);
    const fileName = `ds_co_hoi_kinh_doanh_${isoDateStamp()}`;

    if (type === 'excel') {
      exportExcel(fileName, 'CoHoiKinhDoanh', headers, rows);
      return;
    }

    if (type === 'csv') {
      exportCsv(fileName, headers, rows);
      return;
    }

    const canPrint = exportPdfTable({
      fileName,
      title: 'Danh sach co hoi kinh doanh',
      headers,
      rows,
      subtitle: `Ngay xuat: ${new Date().toLocaleString('vi-VN')}`,
      landscape: true,
    });

    if (!canPrint) {
      onNotify?.('error', 'Xuất dữ liệu', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStageFilter('');
    setPriorityFilter('');
    setSortConfig(null);
    setCurrentPage(1);
  };

  const renderStageBadge = (stageCode: string) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStageColor(stageCode)}`}>
      {getStageLabel(stageCode)}
    </span>
  );

  const renderPriorityBadge = (priorityValue: number | null | undefined) => {
    const meta = PRIORITY_META[Number(priorityValue ?? 2)] || PRIORITY_META[2];

    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}>
        <span className="material-symbols-outlined text-sm">{meta.icon}</span>
        {meta.label}
      </span>
    );
  };

  const renderActionButtons = (item: Opportunity, stageCode: string, className = 'justify-end') => (
    <div className={`flex flex-wrap items-center ${className} gap-2`}>
      {stageCode === 'WON' ? (
        <button
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal"
          title="Chuyển thành Dự án"
          onClick={() => onConvert(item)}
        >
          <span className="material-symbols-outlined text-sm">rocket_launch</span>
          Dự án
        </button>
      ) : null}
      <button
        onClick={() => onOpenModal('EDIT_OPPORTUNITY', item)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-primary"
        title="Chỉnh sửa"
      >
        <span className="material-symbols-outlined text-lg">edit</span>
      </button>
      <button
        onClick={() => onOpenModal('DELETE_OPPORTUNITY', item)}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-error"
        title="Xóa"
      >
        <span className="material-symbols-outlined text-lg">delete</span>
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Cơ hội kinh doanh</h2>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý các cơ hội bán hàng và trạng thái theo giai đoạn SQL v5.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => {
                setShowImportMenu((prev) => !prev);
                setShowExportMenu(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Nhập</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
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

          <div className="relative flex-1 lg:flex-none">
            <button
              onClick={() => {
                setShowExportMenu((prev) => !prev);
                setShowImportMenu(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-600 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Xuất</span>
              <span className="material-symbols-outlined text-sm ml-1">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in flex flex-col">
                  <button
                    onClick={() => handleExport('excel')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span>
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">csv</span>
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors text-left border-t border-slate-100"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onOpenModal('ADD_OPPORTUNITY')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8 animate-fade-in"
        style={{ animationDelay: '0.1s' }}
      >
        {/* 1. Tổng cơ hội */}
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Tổng cơ hội</p>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined text-base">lightbulb</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-900">{filteredOpportunities.length}</p>
        </div>

        {/* 2. Tổng giá trị pipeline */}
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Tổng giá trị</p>
            <span className="p-1.5 bg-green-50 text-green-600 rounded-lg material-symbols-outlined text-base">payments</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
        </div>

        {/* 3. Ưu tiên Cao */}
        <div className="bg-white p-4 md:p-5 rounded-xl border border-orange-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Cao</p>
            <span className="p-1.5 bg-orange-50 text-orange-600 rounded-lg material-symbols-outlined text-base">arrow_upward</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-orange-700">
            {filteredOpportunities.filter((o) => (o.priority ?? 2) === 3).length}
          </p>
        </div>

        {/* 4. Ưu tiên Trung bình */}
        <div className="bg-white p-4 md:p-5 rounded-xl border border-sky-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Trung bình</p>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg material-symbols-outlined text-base">remove</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-sky-700">
            {filteredOpportunities.filter((o) => (o.priority ?? 2) === 2).length}
          </p>
        </div>

        {/* 5. Ưu tiên Thấp */}
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Thấp</p>
            <span className="p-1.5 bg-slate-100 text-slate-500 rounded-lg material-symbols-outlined text-base">arrow_downward</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-600">
            {filteredOpportunities.filter((o) => (o.priority ?? 2) === 1).length}
          </p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="w-full md:flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo tên cơ hội, tên khách hàng..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
              />
            </div>
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
              <SearchableSelect
                className="w-full md:w-auto xl:w-56"
                value={stageFilter}
                onChange={(value) => {
                  setStageFilter(value);
                  setCurrentPage(1);
                }}
                options={stageFilterOptions}
                placeholder="Tất cả giai đoạn"
                triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
              <SearchableSelect
                className="w-full md:w-auto xl:w-48"
                value={priorityFilter}
                onChange={(value) => {
                  setPriorityFilter(value);
                  setCurrentPage(1);
                }}
                options={PRIORITY_FILTER_OPTIONS}
                placeholder="Tất cả mức ưu tiên"
                triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
              />
              <div className="relative lg:hidden">
                <label htmlFor="opportunity-list-sort" className="sr-only">Sắp xếp danh sách cơ hội</label>
                <select
                  id="opportunity-list-sort"
                  value={sortSelectValue}
                  onChange={(e) => handleResponsiveSortChange(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border-none bg-slate-50 pl-3 pr-9 text-sm text-slate-600 outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  aria-label="Sắp xếp danh sách cơ hội"
                >
                  {RESPONSIVE_SORT_OPTIONS.map((option) => (
                    <option key={option.value || 'default'} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  swap_vert
                </span>
              </div>
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

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                Đang lọc
              </span>
              {searchTerm.trim() ? <p className="text-xs text-slate-500">Từ khóa: "{searchTerm.trim()}"</p> : null}
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          {currentData.length > 0 ? (
            <>
              <div data-testid="opportunity-responsive-list" className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5 lg:hidden">
                {currentData.map((item) => {
                  const stageCode = normalizeStageCode(item.stage);
                  return (
                    <article key={`opportunity-card-${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Khách hàng</p>
                        <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-800">{getCustomerName(item.customer_id)}</p>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tên cơ hội</p>
                          <p className="mt-1 break-words text-base font-bold leading-6 text-slate-900">{item.opp_name || '--'}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Giá trị dự kiến</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                            {renderStageBadge(stageCode)}
                            {renderPriorityBadge(item.priority)}
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3">
                          {renderActionButtons(item, stageCode, 'justify-start')}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table
                  data-testid="opportunity-desktop-table"
                  className="w-full table-fixed text-left border-collapse min-w-[1320px]"
                >
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      {[
                        { label: 'Tên Cơ hội', key: 'opp_name', widthClassName: 'w-[320px] min-w-[320px]' },
                        { label: 'Khách hàng', key: 'customer_id', widthClassName: 'w-[320px] min-w-[320px]' },
                        { label: 'Giá trị dự kiến', key: 'amount', widthClassName: 'w-[190px] min-w-[190px]' },
                        { label: 'Giai đoạn', key: 'stage', widthClassName: 'w-[170px] min-w-[170px]' },
                        { label: 'Ưu tiên', key: 'priority', widthClassName: 'w-[170px] min-w-[170px]' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`cursor-pointer select-none px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 ${col.widthClassName}`}
                          onClick={() => handleSort(col.key as keyof Opportunity)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-deep-teal">{col.label}</span>
                            {renderSortIcon(col.key as keyof Opportunity)}
                          </div>
                        </th>
                      ))}
                      <th className="sticky right-0 w-[220px] min-w-[220px] bg-slate-50 px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentData.map((item) => {
                      const stageCode = normalizeStageCode(item.stage);
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-6 py-4 align-top text-sm font-bold text-slate-900">
                            <div className="max-w-[288px] whitespace-normal break-words leading-6">{item.opp_name || '--'}</div>
                          </td>
                          <td className="px-6 py-4 align-top text-sm text-slate-600" title={getCustomerName(item.customer_id)}>
                            <div className="max-w-[288px] whitespace-normal break-words leading-6">{getCustomerName(item.customer_id)}</div>
                          </td>
                          <td className="px-6 py-4 align-top text-sm font-mono font-semibold text-slate-900">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {renderStageBadge(stageCode)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {renderPriorityBadge(item.priority)}
                          </td>
                          <td className="sticky right-0 bg-white px-6 py-4 text-right align-top shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                            {renderActionButtons(item, stageCode)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="px-6 py-8 text-center text-slate-500">
              <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-slate-300">
                  {hasActiveFilters ? 'search_off' : 'lightbulb'}
                </span>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-700">
                    {hasActiveFilters ? 'Không tìm thấy cơ hội phù hợp.' : 'Chưa có cơ hội kinh doanh nào.'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {hasActiveFilters
                      ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem lại danh sách.'
                      : 'Nhấn "Thêm mới" để bắt đầu tạo cơ hội đầu tiên.'}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                    Xóa bộ lọc
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenModal('ADD_OPPORTUNITY')}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Thêm mới
                  </button>
                )}
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
            rowsPerPageOptions={[7, 10, 20, 50]}
          />
        </div>
      </div>
    </div>
  );
};
