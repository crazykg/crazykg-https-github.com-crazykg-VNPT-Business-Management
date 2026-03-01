import React, { useState, useMemo, useEffect } from 'react';
import { Contract, Project, Customer, ModalType, PaymentCycle, PaginatedQuery, PaginationMeta } from '../types';
import { CONTRACT_STATUSES } from '../constants';
import { PaginationControls } from './PaginationControls';
import { SearchableSelect } from './SearchableSelect';

interface ContractListQuery extends PaginatedQuery {
  filters?: {
    status?: string;
  };
}

interface ContractListProps {
  contracts: Contract[];
  projects: Project[];
  customers: Customer[];
  onOpenModal: (type: ModalType, item?: Contract) => void;
  paginationMeta?: PaginationMeta;
  isLoading?: boolean;
  onQueryChange?: (query: ContractListQuery) => void;
}

export const ContractList: React.FC<ContractListProps> = ({
  contracts = [],
  projects = [],
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
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Contract; direction: 'asc' | 'desc' } | null>(null);

  const getProjectName = (id: string | number) => {
    const project = (projects || []).find((p) => String(p.id) === String(id));
    return project ? `${project.project_code} - ${project.project_name}` : String(id);
  };
  const getCustomerName = (id: string | number) => {
    const customer = (customers || []).find((c) => String(c.id) === String(id));
    return customer ? `${customer.customer_code} - ${customer.customer_name}` : String(id);
  };
  const getStatusLabel = (status: string) => CONTRACT_STATUSES.find((s) => s.value === status)?.label || status;
  const getStatusColor = (status: string) =>
    CONTRACT_STATUSES.find((s) => s.value === status)?.color || 'bg-slate-100 text-slate-700';
  const getPaymentCycleLabel = (cycle: PaymentCycle | string | undefined) => {
    const normalized = String(cycle || 'ONCE').toUpperCase();
    if (normalized === 'MONTHLY') return 'Hàng tháng';
    if (normalized === 'QUARTERLY') return 'Hàng quý';
    if (normalized === 'HALF_YEARLY') return '6 tháng/lần';
    if (normalized === 'YEARLY') return 'Hàng năm';
    return 'Một lần';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return value;
    return new Intl.DateTimeFormat('vi-VN').format(new Date(timestamp));
  };

  const filteredContracts = useMemo(() => {
    if (serverMode) {
      return contracts || [];
    }

    let result = (contracts || []).filter((contract) => {
      const projectName = getProjectName(contract.project_id).toLowerCase();
      const customerName = getCustomerName(contract.customer_id).toLowerCase();
      const contractCode = (contract.contract_code || '').toLowerCase();
      const contractName = (contract.contract_name || '').toLowerCase();
      const paymentCycle = getPaymentCycleLabel(contract.payment_cycle).toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch =
        contractCode.includes(searchLower) ||
        contractName.includes(searchLower) ||
        customerName.includes(searchLower) ||
        projectName.includes(searchLower) ||
        paymentCycle.includes(searchLower);
      const matchesStatus = statusFilter ? contract.status === statusFilter : true;

      return matchesSearch && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'project_id') {
          aValue = getProjectName(a.project_id);
          bValue = getProjectName(b.project_id);
        }

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
  }, [serverMode, contracts, searchTerm, statusFilter, sortConfig, projects, customers]);

  const statusFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả trạng thái' },
      ...CONTRACT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
    ],
    []
  );

  const totalItems = serverMode ? (paginationMeta?.total || 0) : filteredContracts.length;
  const totalPages = serverMode
    ? Math.max(1, paginationMeta?.total_pages || 1)
    : Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const totalContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.total_contracts);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return totalItems;
  })();
  const signedContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.signed);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return (contracts || []).filter((c) => c.status === 'SIGNED').length;
  })();
  const expiringSoonContractsKpi = (() => {
    const value = Number(paginationMeta?.kpis?.expiring_soon);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return 0;
  })();
  const expiryWarningDays = (() => {
    const value = Number(paginationMeta?.kpis?.expiry_warning_days);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    return 30;
  })();
  const upcomingPaymentCustomersKpi = (() => {
    const value = Number(paginationMeta?.kpis?.upcoming_payment_customers);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
    return 0;
  })();
  const paymentWarningDays = (() => {
    const value = Number(paginationMeta?.kpis?.payment_warning_days);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    return 30;
  })();

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!serverMode || !onQueryChange) {
      return;
    }

    onQueryChange({
      page: currentPage,
      per_page: rowsPerPage,
      q: searchTerm.trim(),
      sort_by: sortConfig?.key ? String(sortConfig.key) : 'id',
      sort_dir: sortConfig?.direction || 'desc',
      filters: {
        status: statusFilter,
      },
    });
  }, [serverMode, onQueryChange, currentPage, rowsPerPage, searchTerm, statusFilter, sortConfig]);

  const currentData = serverMode
    ? (contracts || [])
    : filteredContracts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleSort = (key: keyof Contract) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Contract) => {
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
          <h2 className="text-xl md:text-2xl font-black text-deep-teal tracking-tight">Quản lý Hợp đồng</h2>
          <p className="text-slate-500 text-sm mt-1">Quản lý và theo dõi các hợp đồng kinh tế của dự án.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onOpenModal('ADD_CONTRACT')}
            className="flex-auto lg:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-deep-teal transition-all text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Thêm mới</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Tổng số hợp đồng</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">description</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{totalContractsKpi}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Đã ký kết</p>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg material-symbols-outlined">verified</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{signedContractsKpi}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Sắp hết hiệu lực ({expiryWarningDays} ngày)</p>
            <span className="p-2 bg-orange-50 text-orange-600 rounded-lg material-symbols-outlined">warning</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{expiringSoonContractsKpi}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Khách hàng sắp thanh toán ({paymentWarningDays} ngày)</p>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg material-symbols-outlined">payments</span>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-slate-900">{upcomingPaymentCustomersKpi}</p>
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
              placeholder="Tìm theo mã/tên hợp đồng, khách hàng, dự án..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-slate-400 outline-none"
            />
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
            <table className="w-full text-left border-collapse min-w-[1460px]">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  {[
                    { label: 'Mã hợp đồng', key: 'contract_code' },
                    { label: 'Tên hợp đồng', key: 'contract_name' },
                    { label: 'Khách hàng', key: 'customer_id' },
                    { label: 'Dự án', key: 'project_id' },
                    { label: 'Chu kỳ TT', key: 'payment_cycle' },
                    { label: 'Giá trị HĐ', key: 'value' },
                    { label: 'Ngày ký', key: 'sign_date' },
                    { label: 'Ngày hiệu lực', key: 'effective_date' },
                    { label: 'Trạng thái', key: 'status' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort(col.key as keyof Contract)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-deep-teal">{col.label}</span>
                        {renderSortIcon(col.key as keyof Contract)}
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
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-600">{item.contract_code}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 truncate max-w-[250px]" title={item.contract_name}>
                        {item.contract_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={getCustomerName(item.customer_id)}>
                        {getCustomerName(item.customer_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={getProjectName(item.project_id)}>
                        {getProjectName(item.project_id)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{getPaymentCycleLabel(item.payment_cycle)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(item.value)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.sign_date || null)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.effective_date || null)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-white shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => onOpenModal('EDIT_CONTRACT', item)} className="p-1.5 text-slate-400 hover:text-primary transition-colors" title="Chỉnh sửa"><span className="material-symbols-outlined text-lg">edit</span></button>
                          <button onClick={() => onOpenModal('DELETE_CONTRACT', item)} className="p-1.5 text-slate-400 hover:text-error transition-colors" title="Xóa"><span className="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                      {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy hợp đồng.'}
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
          />
        </div>
      </div>
    </div>
  );
};
