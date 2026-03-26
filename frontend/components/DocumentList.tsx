
import React, { useState, useMemo, useEffect } from 'react';
import { Document, Customer, ModalType, PaginatedQuery, PaginationMeta } from '../types';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';

interface DocumentListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
  };
}

interface DocumentListProps {
  documents: Document[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Document) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: DocumentListQuery) => void;
}

const ITEMS_PER_PAGE = 7;

export const DocumentList: React.FC<DocumentListProps> = ({
  documents = [],
  customers = [],
  onOpenModal,
  paginationMeta,
  isLoading = false,
  onQueryChange,
}) => {
  const serverMode = Boolean(onQueryChange && paginationMeta);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Document; direction: 'asc' | 'desc' } | null>(null);

  const getCustomerName = (id: string) => {
    const customer = (customers || []).find(c => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : id;
  };
  const getDocumentTypeName = (id: string) => DOCUMENT_TYPES.find(t => t.id === id)?.name || id;
  const getStatusLabel = (status: string) => DOCUMENT_STATUSES.find(s => s.value === status)?.label || status;
  const getStatusColor = (status: string) => DOCUMENT_STATUSES.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';

  const filteredDocuments = useMemo(() => {
    if (serverMode) {
      return documents || [];
    }

    let result = (documents || []).filter(doc => {
      const customerName = getCustomerName(doc.customerId).toLowerCase();
      const docName = doc.name.toLowerCase();
      const docCode = doc.id.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = docName.includes(searchLower) || docCode.includes(searchLower) || customerName.includes(searchLower);
      const matchesStatus = statusFilter ? doc.status === statusFilter : true;
      
      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'customerId') {
            aValue = getCustomerName(a.customerId);
            bValue = getCustomerName(b.customerId);
        } else if (sortConfig.key === 'typeId') {
            aValue = getDocumentTypeName(a.typeId);
            bValue = getDocumentTypeName(b.typeId);
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
  }, [serverMode, documents, searchTerm, statusFilter, sortConfig, customers]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...DOCUMENT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
  );

  // Pagination
  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredDocuments.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: ITEMS_PER_PAGE,
      q: searchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
      },
    });
  }, [serverMode, onQueryChange, currentPage, searchTerm, statusFilter, sortConfig]);

  const currentData = serverMode
    ? (documents || [])
    : filteredDocuments.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Document) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Document) => {
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
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Hồ sơ tài liệu</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý các tài liệu, hồ sơ, biên bản và chứng chỉ liên quan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => onOpenModal('ADD_DOCUMENT')} className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Tổng số tài liệu</p>
             <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">folder</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{serverMode ? (paginationMeta?.total || 0) : documents.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <p className="text-sm font-medium text-slate-500">Đang hiệu lực</p>
             <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">task_alt</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{(documents || []).filter(d => d.status === 'ACTIVE').length}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div style={{ animationDelay: '0.2s' }}>
        <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row gap-4 items-center">
           <div className="w-full md:flex-1 relative">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm theo mã, tên tài liệu, khách hàng..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none" />
           </div>
           <SearchableSelect
             className="w-full md:w-48"
             value={statusFilter}
             onChange={setStatusFilter}
             options={statusFilterOptions}
             placeholder="Tất cả trạng thái"
             triggerClassName="w-full pl-3 pr-8 py-2 h-10 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm text-slate-600 outline-none"
           />
        </div>

        <div className="bg-white rounded-b-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[1000px]">
               <thead className="bg-slate-50 border-y border-slate-200">
                 <tr>
                   {[
                     { label: 'Mã tài liệu', key: 'id' },
                     { label: 'Tên tài liệu', key: 'name' },
                     { label: 'Loại tài liệu', key: 'typeId' },
                     { label: 'Khách hàng', key: 'customerId' },
                     { label: 'Trạng thái', key: 'status' }
                   ].map((col) => (
                     <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => handleSort(col.key as keyof Document)}>
                       <div className="flex items-center gap-1">
                         <span className="text-deep-teal">{col.label}</span>
                         {renderSortIcon(col.key as keyof Document)}
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
                       <td className="px-6 py-4 text-sm font-mono font-bold text-slate-600">{item.id}</td>
                       <td className="px-6 py-4 text-sm font-semibold text-slate-900 truncate max-w-[250px]" title={item.name}>{item.name}</td>
                       <td className="px-6 py-4 text-sm text-slate-600">{getDocumentTypeName(item.typeId)}</td>
                       <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]" title={getCustomerName(item.customerId)}>{getCustomerName(item.customerId)}</td>
                       <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(item.status)}`}>
                           {getStatusLabel(item.status)}
                         </span>
                       </td>
                       <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => onOpenModal('EDIT_DOCUMENT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                           <button onClick={() => onOpenModal('DELETE_DOCUMENT', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                         </div>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                       {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy tài liệu.'}
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>

           <PaginationControls
             currentPage={currentPage}
             totalItems={totalItems}
             rowsPerPage={ITEMS_PER_PAGE}
             onPageChange={goToPage}
             onRowsPerPageChange={() => undefined}
             rowsPerPageOptions={[ITEMS_PER_PAGE]}
           />
        </div>
      </div>
    </div>
  );
};
