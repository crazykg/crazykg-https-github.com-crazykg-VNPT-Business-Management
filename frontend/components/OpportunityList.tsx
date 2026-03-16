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

const KNOWN_STAGE_META: Record<string, StageMeta> = {
  NEW: { label: 'Mới', color: 'bg-slate-100 text-slate-700' },
  PROPOSAL: { label: 'Đề xuất', color: 'bg-indigo-100 text-indigo-700' },
  NEGOTIATION: { label: 'Đàm phán', color: 'bg-yellow-100 text-yellow-700' },
  WON: { label: 'Thắng', color: 'bg-green-100 text-green-700' },
  LOST: { label: 'Thất bại', color: 'bg-red-100 text-red-700' },
};

const CUSTOM_STAGE_COLOR = 'bg-slate-100 text-slate-700';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Opportunity; direction: 'asc' | 'desc' } | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  useEscKey(() => { setShowImportMenu(false); setShowExportMenu(false); }, showImportMenu || showExportMenu);


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

      return matchesSearch && matchesStage;
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
  }, [opportunities, searchTerm, stageFilter, sortConfig, customers, stageDefinitionByCode]);

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
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
    const headers = ['Tên cơ hội', 'Khách hàng', 'Giá trị dự kiến (VNĐ)', 'Giai đoạn'];
    const rows = filteredOpportunities.map((row) => [
      row.opp_name || '',
      getCustomerName(row.customer_id),
      Number(row.amount || 0),
      getStageLabel(String(row.stage || '')),
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng cơ hội</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">lightbulb</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{filteredOpportunities.length}</p>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng giá trị pipeline</p>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">payments</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên cơ hội, tên khách hàng..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <SearchableSelect
            className="w-full md:w-56"
            value={stageFilter}
            onChange={setStageFilter}
            options={stageFilterOptions}
            placeholder="Tất cả giai đoạn"
            triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
          />
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'Tên Cơ hội', key: 'opp_name' },
                    { label: 'Khách hàng', key: 'customer_id' },
                    { label: 'Giá trị dự kiến', key: 'amount' },
                    { label: 'Giai đoạn', key: 'stage' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort(col.key as keyof Opportunity)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Opportunity)}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((item) => {
                    const stageCode = normalizeStageCode(item.stage);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 truncate max-w-[250px]" title={item.opp_name}>
                          {item.opp_name}
                        </td>
                        <td
                          className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]"
                          title={getCustomerName(item.customer_id)}
                        >
                          {getCustomerName(item.customer_id)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-900 font-mono font-semibold">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStageColor(
                              stageCode
                            )}`}
                          >
                            {getStageLabel(stageCode)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                          <div className="flex justify-end gap-2 items-center">
                            {stageCode === 'WON' && (
                              <button
                                className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-deep-teal transition-colors mr-2 flex items-center gap-1 shadow-sm"
                                title="Chuyển thành Dự án"
                                onClick={() => onConvert(item)}
                              >
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                Dự án
                              </button>
                            )}
                            <button
                              onClick={() => onOpenModal('EDIT_OPPORTUNITY', item)}
                              className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                              title="Chỉnh sửa"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              onClick={() => onOpenModal('DELETE_OPPORTUNITY', item)}
                              className="p-1.5 text-slate-400 hover:text-error transition-colors"
                              title="Xóa"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Không tìm thấy dữ liệu.
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
