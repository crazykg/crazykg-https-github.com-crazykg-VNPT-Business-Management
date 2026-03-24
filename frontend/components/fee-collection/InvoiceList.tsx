import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contract, Customer, Invoice, PaginationMeta } from '../../types';
import { fetchInvoices, deleteInvoice, updateInvoice } from '../../services/v5Api';
import { PaginationControls } from '../PaginationControls';
import { InvoiceModal } from './InvoiceModal';
import { InvoiceBulkGenerateModal } from './InvoiceBulkGenerateModal';

// OVERDUE is NOT a persisted status — use inv.is_overdue (computed) for overdue display logic.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', ISSUED: 'Đã phát hành', PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán', CANCELLED: 'Đã hủy', VOID: 'Void',
};
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400 line-through',
  VOID: 'bg-gray-100 text-gray-400',
};

/** Returns display label and badge class, factoring in the computed is_overdue flag. */
function getDisplayStatus(inv: Invoice): { label: string; badge: string } {
  if (inv.is_overdue && !['PAID', 'CANCELLED', 'VOID'].includes(inv.status)) {
    return { label: 'Quá hạn', badge: 'bg-red-100 text-red-700' };
  }
  return {
    label: STATUS_LABEL[inv.status] ?? inv.status,
    badge: STATUS_BADGE[inv.status] ?? 'bg-gray-100 text-gray-600',
  };
}

function fmtVnd(v: number | undefined): string {
  if (!v) return '—';
  return v.toLocaleString('vi-VN') + ' đ';
}

interface InvoiceListProps {
  contracts: Contract[];
  customers: Customer[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
  initialCustomerFilter?: string;
  initialStatusFilter?: string;
}

const PAGE_SIZE = 25;

export const InvoiceList: React.FC<InvoiceListProps> = ({
  contracts, customers, canAdd, canEdit, canDelete, onNotify,
  initialCustomerFilter = '', initialStatusFilter = '',
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [customerFilter, setCustomerFilter] = useState(initialCustomerFilter);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('invoice_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setCurrentPage(1); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, customerFilter, dateFrom, dateTo, sortKey, sortDir]);

  const queryRef = useRef({ searchTerm, statusFilter, customerFilter, dateFrom, dateTo, currentPage, sortKey, sortDir });
  queryRef.current = { searchTerm, statusFilter, customerFilter, dateFrom, dateTo, currentPage, sortKey, sortDir };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = queryRef.current;
      const params: Record<string, string> = {
        page: String(q.currentPage), per_page: String(PAGE_SIZE),
        sort_key: q.sortKey, sort_dir: q.sortDir,
      };
      if (q.searchTerm) params.q = q.searchTerm;
      if (q.statusFilter) params.status = q.statusFilter;
      if (q.customerFilter) params.customer_id = q.customerFilter;
      if (q.dateFrom) params.invoice_date_from = q.dateFrom;
      if (q.dateTo) params.invoice_date_to = q.dateTo;
      const res = await fetchInvoices(params);
      setInvoices(res.data);
      setMeta(res.meta as PaginationMeta);
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không tải được danh sách hóa đơn');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { void load(); }, [load, searchTerm, statusFilter, customerFilter, dateFrom, dateTo, currentPage, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortIcon = (key: string) => {
    if (key !== sortKey) return <span className="material-symbols-outlined text-xs text-gray-300">unfold_more</span>;
    return <span className="material-symbols-outlined text-xs text-blue-600">{sortDir === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>;
  };

  const handleIssue = async (inv: Invoice) => {
    try {
      await updateInvoice(inv.id, { status: 'ISSUED' });
      onNotify('success', 'Thành công', `Đã phát hành hóa đơn ${inv.invoice_code}`);
      void load();
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không phát hành được');
    }
  };

  const handleCancel = async (inv: Invoice) => {
    if (!window.confirm(`Hủy hóa đơn ${inv.invoice_code}?`)) return;
    try {
      await updateInvoice(inv.id, { status: 'CANCELLED' });
      onNotify('success', 'Thành công', `Đã hủy hóa đơn ${inv.invoice_code}`);
      void load();
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không hủy được hóa đơn');
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(`Xóa hóa đơn ${inv.invoice_code}?`)) return;
    try {
      await deleteInvoice(inv.id);
      onNotify('success', 'Thành công', `Đã xóa hóa đơn ${inv.invoice_code}`);
      void load();
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không xóa được hóa đơn');
    }
  };

  const activeFilters = searchInput || statusFilter || customerFilter || dateFrom || dateTo;

  return (
    <div className="p-4 space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input type="text" placeholder="Tìm mã HĐ, tên khách hàng..."
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-48">
          <option value="">Tất cả KH</option>
          {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.customer_name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {activeFilters && (
          <button onClick={() => { setSearchInput(''); setStatusFilter(''); setCustomerFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-base">close</span>Xóa bộ lọc
          </button>
        )}
        <div className="flex-1" />
        {canAdd && (
          <>
            <button onClick={() => setBulkModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              Sinh HĐ loạt
            </button>
            <button onClick={() => { setEditingInvoice(null); setModalOpen(true); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              <span className="material-symbols-outlined text-base">add</span>
              Tạo hóa đơn
            </button>
          </>
        )}
      </div>

      {/* KPIs from meta */}
      {meta?.kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Tổng hóa đơn', v: meta.kpis.total_invoices, isMoney: false },
            { label: 'Tổng giá trị', v: meta.kpis.total_amount, isMoney: true },
            { label: 'Đã thu', v: meta.kpis.total_paid, isMoney: true },
            { label: 'Còn nợ', v: meta.kpis.total_outstanding, isMoney: true },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded border border-gray-200 p-3 shadow-sm">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-base font-bold text-gray-800">{k.isMoney ? fmtVnd(k.v) : k.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                { key: 'invoice_code', label: 'Mã hóa đơn', cls: 'w-40' },
                { key: 'customer_name', label: 'Khách hàng', cls: '' },
                { key: 'contract_code', label: 'Hợp đồng', cls: 'w-32' },
                { key: 'invoice_date', label: 'Ngày HĐ', cls: 'w-28' },
                { key: 'due_date', label: 'Hạn TT', cls: 'w-28' },
                { key: 'total_amount', label: 'Tổng tiền', cls: 'w-32 text-right' },
                { key: 'paid_amount', label: 'Đã thu', cls: 'w-28 text-right' },
                { key: 'outstanding', label: 'Còn nợ', cls: 'w-28 text-right' },
                { key: 'status', label: 'Trạng thái', cls: 'w-36' },
                { key: '', label: '', cls: 'w-20' },
              ].map((col) => (
                <th key={col.key || '__a'} onClick={col.key ? () => handleSort(col.key) : undefined}
                  className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide ${col.key ? 'cursor-pointer hover:bg-gray-100 select-none' : ''} ${col.cls}`}>
                  <span className="flex items-center gap-0.5 justify-between">{col.label}{col.key && sortIcon(col.key)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400 text-sm">
              <span className="material-symbols-outlined animate-spin mr-1 align-middle">progress_activity</span>Đang tải...
            </td></tr>}
            {!loading && invoices.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400 text-sm">
              {activeFilters ? 'Không tìm thấy hóa đơn phù hợp' : 'Chưa có hóa đơn nào'}
            </td></tr>}
            {!loading && invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-mono text-blue-700 font-medium text-xs">{inv.invoice_code}</td>
                <td className="px-3 py-2.5 text-gray-800 max-w-0 truncate">{inv.customer_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{inv.contract_code ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{inv.invoice_date}</td>
                <td className={`px-3 py-2.5 ${inv.is_overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{inv.due_date}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-800">{fmtVnd(inv.total_amount)}</td>
                <td className="px-3 py-2.5 text-right text-green-700">{inv.paid_amount > 0 ? fmtVnd(inv.paid_amount) : '—'}</td>
                <td className={`px-3 py-2.5 text-right font-semibold ${inv.outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {inv.outstanding > 0 ? fmtVnd(inv.outstanding) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {(() => { const ds = getDisplayStatus(inv); return (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ds.badge}`}>
                    {ds.label}
                  </span>
                  ); })()}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-0.5">
                    {canEdit && ['DRAFT', 'ISSUED'].includes(inv.status) && (
                      <button onClick={() => { setEditingInvoice(inv); setModalOpen(true); }}
                        title="Sửa" className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                    )}
                    {canEdit && inv.status === 'DRAFT' && (
                      <button onClick={() => handleIssue(inv)} title="Phát hành"
                        className="p-0.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded">
                        <span className="material-symbols-outlined text-base">send</span>
                      </button>
                    )}
                    {canEdit && !['PAID', 'VOID', 'CANCELLED'].includes(inv.status) && (
                      <button onClick={() => handleCancel(inv)} title="Hủy"
                        className="p-0.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded">
                        <span className="material-symbols-outlined text-base">cancel</span>
                      </button>
                    )}
                    {canDelete && inv.status === 'DRAFT' && (
                      <button onClick={() => handleDelete(inv)} title="Xóa"
                        className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total_pages > 1 && (
        <PaginationControls currentPage={currentPage} totalPages={meta.total_pages} total={meta.total} perPage={meta.per_page} onPageChange={setCurrentPage} />
      )}

      {modalOpen && (
        <InvoiceModal invoice={editingInvoice} contracts={contracts} customers={customers}
          onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); void load(); }} onNotify={onNotify} />
      )}
      {bulkModalOpen && (
        <InvoiceBulkGenerateModal contracts={contracts}
          onClose={() => setBulkModalOpen(false)}
          onGenerated={() => { setBulkModalOpen(false); void load(); }} onNotify={onNotify} />
      )}
    </div>
  );
};
