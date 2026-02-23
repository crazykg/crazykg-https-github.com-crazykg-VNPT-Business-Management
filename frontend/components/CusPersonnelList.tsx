
import React, { useState, useMemo } from 'react';
import { CustomerPersonnel, Customer, ModalType } from '../types';
import { POSITION_TYPES } from '../constants';

interface CusPersonnelListProps {
  personnel: CustomerPersonnel[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: CustomerPersonnel) => void;
}

const ITEMS_PER_PAGE = 7;

export const CusPersonnelList: React.FC<CusPersonnelListProps> = ({ personnel = [], customers = [], onOpenModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CustomerPersonnel; direction: 'asc' | 'desc' } | null>(null);
  
  // Stats
  const activeCount = (personnel || []).length;

  const getCustomerName = (id: string) => {
    return (customers || []).find(c => String(c.id) === String(id))?.customer_name || id;
  };

  const getPositionLabel = (type: string) => {
    return POSITION_TYPES.find(p => p.value === type)?.label || type;
  };

  const getPositionColor = (type: string) => {
    return POSITION_TYPES.find(p => p.value === type)?.color || 'bg-slate-100 text-slate-700';
  };

  // Filter & Sort
  const filteredPersonnel = useMemo(() => {
    let result = (personnel || []).filter(p => {
      const customerName = getCustomerName(p.customerId).toLowerCase();
      // General search
      const matchesSearch = 
        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        customerName.includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPosition = positionFilter ? p.positionType === positionFilter : true;
      
      // Advanced filters
      const matchesPhone = phoneFilter ? p.phoneNumber.includes(phoneFilter) : true;
      const matchesEmail = emailFilter ? p.email.toLowerCase().includes(emailFilter.toLowerCase()) : true;
      
      return matchesSearch && matchesPosition && matchesPhone && matchesEmail;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Handle customer name sorting
        if (sortConfig.key === 'customerId') {
            aValue = getCustomerName(a.customerId);
            bValue = getCustomerName(b.customerId);
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
  }, [personnel, searchTerm, positionFilter, phoneFilter, emailFilter, sortConfig, customers]);

  // Pagination
  const totalItems = filteredPersonnel.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const currentData = filteredPersonnel.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof CustomerPersonnel) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof CustomerPersonnel) => {
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
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Nhân sự liên hệ</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý danh sách nhân sự đầu mối từ khách hàng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onOpenModal('ADD_CUS_PERSONNEL')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng số</p>
             <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">perm_contact_calendar</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeCount}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col gap-4">
           <div className="flex flex-col md:flex-row gap-4 items-center">
               <div className="w-full md:flex-1 relative">
                 <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                 <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm theo tên nhân sự, tên khách hàng..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" />
               </div>
               <div className="w-full md:w-48 relative">
                 <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className="w-full pl-3 pr-8 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm appearance-none text-slate-600 outline-none cursor-pointer">
                   <option value="">Tất cả vai trò</option>
                   {POSITION_TYPES.map(p => (
                       <option key={p.value} value={p.value}>{p.label}</option>
                   ))}
                 </select>
                 <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
               </div>
               <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex justify-center items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200 ${showAdvanced ? 'bg-secondary/20 text-deep-teal border-secondary/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="material-symbols-outlined text-xl">filter_list</span>
                  <span className="hidden md:inline">Bộ lọc</span>
               </button>
           </div>

           {/* Advanced Filters */}
           {showAdvanced && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 animate-slide-in">
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">call</span>
                  <input 
                    type="text"
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" 
                    placeholder="Lọc theo số điện thoại" 
                  />
               </div>
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input 
                    type="text"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" 
                    placeholder="Lọc theo email" 
                  />
               </div>
             </div>
           )}
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1200px]">
               <thead className="bg-slate-50 border-y border-slate-200">
                 <tr>
                   {[
                     { label: 'Khách hàng', key: 'customerId' },
                     { label: 'Họ và tên', key: 'fullName' },
                     { label: 'Ngày sinh', key: 'birthday' },
                     { label: 'Chức vụ', key: 'positionType' },
                     { label: 'Liên hệ', key: 'phoneNumber' }
                   ].map((col) => (
                     <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleSort(col.key as keyof CustomerPersonnel)}>
                       <div className="flex items-center gap-1">
                         <span className="text-deep-teal">{col.label}</span>
                         {renderSortIcon(col.key as keyof CustomerPersonnel)}
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
                       <td className="px-6 py-4 text-sm text-slate-600 font-medium truncate max-w-[200px]" title={getCustomerName(item.customerId)}>
                           {getCustomerName(item.customerId)}
                       </td>
                       <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                           <div className="flex flex-col">
                               <span>{item.fullName}</span>
                               <span className="text-xs text-slate-500 font-normal">{item.email}</span>
                           </div>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-600">{item.birthday ? new Date(item.birthday).toLocaleDateString('vi-VN') : '--'}</td>
                       <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(item.positionType)}`}>
                           {getPositionLabel(item.positionType)}
                         </span>
                       </td>
                       <td className="px-6 py-4">
                           <div className="flex gap-2">
                               {item.phoneNumber && (
                                   <a href={`tel:${item.phoneNumber}`} className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors" title={item.phoneNumber}>
                                       <span className="material-symbols-outlined text-lg">call</span>
                                   </a>
                               )}
                               {item.email && (
                                   <a href={`mailto:${item.email}`} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title={item.email}>
                                       <span className="material-symbols-outlined text-lg">mail</span>
                                   </a>
                               )}
                           </div>
                       </td>
                       <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => onOpenModal('EDIT_CUS_PERSONNEL', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                           <button onClick={() => onOpenModal('DELETE_CUS_PERSONNEL', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                         </div>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Không tìm thấy dữ liệu.</td></tr>
                 )}
               </tbody>
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
