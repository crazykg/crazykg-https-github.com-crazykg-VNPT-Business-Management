
import React, { useState, useMemo } from 'react';
import { Opportunity, Customer, CustomerPersonnel, Product, Employee, ModalType } from '../types';
import { OPPORTUNITY_STATUSES } from '../constants';

interface OpportunityListProps {
  opportunities: Opportunity[];
  customers: Customer[];
  personnel: CustomerPersonnel[];
  products: Product[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Opportunity) => void;
  onConvert: (item: Opportunity) => void;
}

const ITEMS_PER_PAGE = 7;

export const OpportunityList: React.FC<OpportunityListProps> = ({ 
  opportunities = [], customers = [], personnel = [], products = [], employees = [], onOpenModal, onConvert 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Opportunity; direction: 'asc' | 'desc' } | null>(null);

  // Helpers
  const getCustomerName = (id: string) => (customers || []).find(c => c.id === id)?.name || id;
  const getProductName = (id: string) => (products || []).find(p => p.id === id)?.name || id;
  const getSalesName = (id: string) => (employees || []).find(e => e.id === id)?.name || id;
  const getPersonnelName = (id: string) => (personnel || []).find(p => p.id === id)?.fullName || '---';

  const getStatusLabel = (status: string) => OPPORTUNITY_STATUSES.find(s => s.value === status)?.label || status;
  const getStatusColor = (status: string) => OPPORTUNITY_STATUSES.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Filter & Sort
  const filteredOpportunities = useMemo(() => {
    let result = (opportunities || []).filter(opp => {
      const customerName = getCustomerName(opp.customerId).toLowerCase();
      const oppName = opp.name.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = oppName.includes(searchLower) || customerName.includes(searchLower);
      const matchesStatus = statusFilter ? opp.status === statusFilter : true;
      
      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customerId') {
            aValue = getCustomerName(a.customerId);
            bValue = getCustomerName(b.customerId);
        } else if (sortConfig.key === 'salesId') {
            aValue = getSalesName(a.salesId);
            bValue = getSalesName(b.salesId);
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
  }, [opportunities, searchTerm, statusFilter, sortConfig, customers, employees]);

  // Stats
  const activeCount = filteredOpportunities.length;
  const totalEstimatedValue = useMemo(() => filteredOpportunities.reduce((sum, item) => sum + (item.estimatedValue || 0), 0), [filteredOpportunities]);

  // Pagination
  const totalItems = filteredOpportunities.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const currentData = filteredOpportunities.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const pageTotalValue = currentData.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);

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
        <span className="material-symbols-outlined text-sm ml-1 transition-transform duration-200" style={{ transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          arrow_upward
        </span>
      );
    }
    return <span className="material-symbols-outlined text-sm text-slate-300 ml-1">unfold_more</span>;
  };

  return (
    <div className="p-4 md:p-8 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8 animate-fade-in">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Cơ hội kinh doanh</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý các cơ hội bán hàng và trạng thái dự án.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onOpenModal('ADD_OPPORTUNITY')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng cơ hội</p>
             <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">lightbulb</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeCount}</p>
        </div>
        
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng giá trị dự kiến</p>
             <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">payments</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{formatCurrency(totalEstimatedValue)}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
           <div className="w-full md:flex-1 relative">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm theo tên cơ hội, tên khách hàng..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" />
           </div>
           <div className="w-full md:w-48 relative">
             <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer">
               <option value="">Tất cả trạng thái</option>
               {OPPORTUNITY_STATUSES.map(s => (
                   <option key={s.value} value={s.value}>{s.label}</option>
               ))}
             </select>
             <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
           </div>
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1300px]">
               <thead className="bg-slate-50 border-y border-slate-200">
                 <tr>
                   {[
                     { label: 'Tên Cơ hội', key: 'name' },
                     { label: 'Khách hàng', key: 'customerId' },
                     { label: 'Sản phẩm', key: 'productId' },
                     { label: 'Giá trị dự kiến', key: 'estimatedValue' },
                     { label: 'Xác suất', key: 'probability' },
                     { label: 'Sales phụ trách', key: 'salesId' },
                     { label: 'Trạng thái', key: 'status' }
                   ].map((col) => (
                     <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleSort(col.key as keyof Opportunity)}>
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
                       <td className="px-6 py-4 text-sm font-bold text-slate-900 truncate max-w-[200px]" title={item.name}>
                           {item.name}
                           <div className="text-xs font-normal text-slate-500 mt-0.5">Đầu mối: {getPersonnelName(item.personnelId)}</div>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]" title={getCustomerName(item.customerId)}>
                           {getCustomerName(item.customerId)}
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{getProductName(item.productId)}</td>
                       <td className="px-6 py-4 text-sm text-slate-900 font-mono font-semibold">{formatCurrency(item.estimatedValue)}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">
                           <div className="flex items-center gap-2">
                               <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                   <div className="h-full bg-primary" style={{ width: `${item.probability}%` }}></div>
                               </div>
                               <span className="text-xs font-medium">{item.probability}%</span>
                           </div>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{getSalesName(item.salesId)}</td>
                       <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(item.status)}`}>
                           {getStatusLabel(item.status)}
                         </span>
                       </td>
                       <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                         <div className="flex justify-end gap-2 items-center">
                           {item.status === 'TRUNG_THAU' && (
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
                   <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
                 )}
               </tbody>
               {/* Summary Footer */}
               {currentData.length > 0 && (
                 <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-bold text-slate-700 text-right">Tổng trang này:</td>
                        <td className="px-6 py-4 text-sm font-bold text-primary font-mono">{formatCurrency(pageTotalValue)}</td>
                        <td colSpan={4}></td>
                    </tr>
                 </tfoot>
               )}
             </table>
           </div>

           {/* Pagination */}
           <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                <span className="font-medium">{totalItems > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span>-
                <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> / <span className="font-medium">{totalItems}</span>
              </p>
              <div className="flex gap-1">
                 <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                 {Array.from({ length: totalPages }, (_, i) => i + 1).filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)).map((page, idx, arr) => (
                    <React.Fragment key={page}>
                       {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-slate-400">...</span>}
                       <button onClick={() => goToPage(page)} className={`w-8 h-8 rounded-lg text-sm font-bold ${currentPage === page ? 'bg-primary text-white' : 'bg-white border text-slate-600'}`}>{page}</button>
                    </React.Fragment>
                 ))}
                 <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
