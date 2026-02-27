import React, { useState, useMemo, useEffect } from 'react';
import { Opportunity, Customer, CustomerPersonnel, Product, Employee, ModalType } from '../types';
import { OPPORTUNITY_STATUSES } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';

interface OpportunityListProps {
  opportunities: Opportunity[];
  customers: Customer[];
  personnel: CustomerPersonnel[];
  products: Product[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Opportunity) => void;
  onConvert: (item: Opportunity) => void;
}

export const OpportunityList: React.FC<OpportunityListProps> = ({
  opportunities = [],
  customers = [],
  onOpenModal,
  onConvert,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Opportunity; direction: 'asc' | 'desc' } | null>(null);

  const getCustomerName = (id: string | number) => {
    const customer = (customers || []).find((c) => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
  };

  const getStageLabel = (stage: string) => OPPORTUNITY_STATUSES.find((s) => s.value === stage)?.label || stage;
  const getStageColor = (stage: string) =>
    OPPORTUNITY_STATUSES.find((s) => s.value === stage)?.color || 'bg-slate-100 text-slate-700';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  const filteredOpportunities = useMemo(() => {
    let result = (opportunities || []).filter((opp) => {
      const customerName = getCustomerName(opp.customer_id).toLowerCase();
      const oppName = (opp.opp_name || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = oppName.includes(searchLower) || customerName.includes(searchLower);
      const matchesStage = stageFilter ? opp.stage === stageFilter : true;

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
  }, [opportunities, searchTerm, stageFilter, sortConfig, customers]);

  const stageFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả giai đoạn' },
      ...OPPORTUNITY_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
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

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Cơ hội kinh doanh</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý các cơ hội bán hàng và trạng thái theo giai đoạn SQL v5.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onOpenModal('ADD_OPPORTUNITY')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
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
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên cơ hội, tên khách hàng..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
          </div>
          <SearchableSelect
            className="w-full md:w-48"
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-slate-50 sticky right-0">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.length > 0 ? (
                  currentData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 truncate max-w-[250px]" title={item.opp_name}>{item.opp_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={getCustomerName(item.customer_id)}>{getCustomerName(item.customer_id)}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 font-mono font-semibold">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStageColor(item.stage)}`}>
                          {getStageLabel(item.stage)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2 items-center">
                          {item.stage === 'WON' && (
                            <button
                              className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-deep-teal transition-colors mr-2 flex items-center gap-1 shadow-sm"
                              title="Chuyển thành Dự án"
                              onClick={() => onConvert(item)}
                            >
                              <span className="material-symbols-outlined text-sm">rocket_launch</span>
                              Dự án
                            </button>
                          )}
                          <button onClick={() => onOpenModal('EDIT_OPPORTUNITY', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                          <button onClick={() => onOpenModal('DELETE_OPPORTUNITY', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
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
