import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contract, Customer, PaginationMeta, Receipt } from '../../types';
import { fetchReceipts, deleteReceipt } from '../../services/v5Api';
import { PaginationControls } from '../PaginationControls';
import { ReceiptModal } from './ReceiptModal';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', ONLINE: 'Online',
  OFFSET: 'Bù trừ', OTHER: 'Khác',
};
const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING_CONFIRM: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
  REVERSED: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận', PENDING_CONFIRM: 'Chờ xác nhận',
  REJECTED: 'Từ chối', REVERSED: 'Đã hoàn',
};

function fmtVnd(v: number | undefined): string {
  if (!v) return '—';
  return v.toLocaleString('vi-VN') + ' đ';
}

const PAGE_SIZE = 25;

interface ReceiptListProps {
  contracts: Contract[];
  customers: Customer[];
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  contracts, customers, canAdd, canEdit, canDelete, onNotify,
}) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('receipt_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setCurrentPage(1); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [customerFilter, methodFilter, dateFrom, dateTo]);

  const qRef = useRef({ searchTerm, customerFilter, methodFilter, dateFrom, dateTo, currentPage, sortKey, sortDir });
  qRef.current = { searchTerm, customerFilter, methodFilter, dateFrom, dateTo, currentPage, sortKey, sortDir };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = qRef.current;
      const params: Record<string, string> = {
        page: String(q.currentPage), per_page: String(PAGE_SIZE),
        sort_key: q.sortKey, sort_dir: q.sortDir,
      };
      if (q.searchTerm) params.q = q.searchTerm;
      if (q.customerFilter) params.customer_id = q.customerFilter;
      if (q.methodFilter) params.payment_method = q.methodFilter;
      if (q.dateFrom) params.receipt_date_from = q.dateFrom;
      if (q.dateTo) params.receipt_date_to = q.dateTo;
      const res = await fetchReceipts(params);
      setReceipts(res.data);
      setMeta(res.meta as PaginationMeta);
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không tải được danh sách phiếu thu');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { void load(); }, [load, searchTerm, customerFilter, methodFilter, dateFrom, dateTo, currentPage, sortKey, sortDir]);

  const handleDelete = async (r: Receipt) => {
    if (!window.confirm(`Xóa phiếu thu ${r.receipt_code}?`)) return;
    try {
      await deleteReceipt(r.id);
      onNotify('success', 'Thành công', `Đã xóa phiếu thu ${r.receipt_code}`);
      void load();
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không xóa được phiếu thu');
    }
  };

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const activeFilters = searchInput || customerFilter || methodFilter || dateFrom || dateTo;

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input type="text" placeholder="Tìm mã phiếu thu, khách hàng..."
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả KH</option>
          {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.customer_name}</option>)}
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả phương thức</option>
          {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {activeFilters && (
          <button onClick={() => { setSearchInput(''); setCustomerFilter(''); setMethodFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-base">close</span>Xóa bộ lọc
          </button>
        )}
        <div className="flex-1" />
        {canAdd && (
          <button onClick={() => { setEditingReceipt(null); setModalOpen(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
            <span className="material-symbols-outlined text-base">add</span>
            Tạo phiếu thu
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                { key: 'receipt_code', label: 'Mã phiếu thu' },
                { key: 'customer_name', label: 'Khách hàng' },
                { key: 'invoice_code', label: 'Hóa đơn' },
                { key: 'receipt_date', label: 'Ngày thu' },
                { key: 'amount', label: 'Số tiền' },
                { key: 'payment_method', label: 'Phương thức' },
                { key: 'status', label: 'Trạng thái' },
                { key: 'confirmed_by_name', label: 'Xác nhận bởi' },
                { key: '', label: '' },
              ].map((col) => (
                <th key={col.key || '__x'} onClick={col.key ? () => handleSort(col.key) : undefined}
                  className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide ${col.key ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">
              <span className="material-symbols-outlined animate-spin mr-1 align-middle">progress_activity</span>Đang tải...
            </td></tr>}
            {!loading && receipts.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">
              {activeFilters ? 'Không tìm thấy phiếu thu phù hợp' : 'Chưa có phiếu thu nào'}
            </td></tr>}
            {!loading && receipts.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-mono text-green-700 font-medium text-xs">{r.receipt_code}</td>
                <td className="px-3 py-2.5 text-gray-800">{r.customer_name ?? '—'}</td>
                <td className="px-3 py-2.5 text-blue-600 text-xs">{r.invoice_code ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-600">{r.receipt_date}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmtVnd(r.amount)}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{METHOD_LABEL[r.payment_method] ?? r.payment_method}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{r.confirmed_by_name ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-0.5">
                    {canEdit && r.status === 'PENDING_CONFIRM' && (
                      <button onClick={() => { setEditingReceipt(r); setModalOpen(true); }}
                        title="Sửa" className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                    )}
                    {canDelete && r.status !== 'CONFIRMED' && (
                      <button onClick={() => handleDelete(r)} title="Xóa"
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
        <ReceiptModal receipt={editingReceipt} contracts={contracts} customers={customers}
          onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); void load(); }} onNotify={onNotify} />
      )}
    </div>
  );
};
