import React, { useEffect, useState } from 'react';
import { Contract, Customer, Invoice, InvoiceItem } from '../../types';
import { createInvoice, updateInvoice } from '../../services/v5Api';
import { ModalWrapper } from '../Modals';

interface InvoiceModalProps {
  invoice: Invoice | null;
  contracts: Contract[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_ITEM = (): InvoiceItem => ({
  description: '', unit: '', quantity: 1, unit_price: 0, vat_rate: 10,
});

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice, contracts, customers, onClose, onSaved, onNotify,
}) => {
  const isEdit = !!invoice;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contractId, setContractId] = useState(invoice ? String(invoice.contract_id) : '');
  const [customerId, setCustomerId] = useState(invoice ? String(invoice.customer_id) : '');
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? today());
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? addDays(today(), 30));
  const [periodFrom, setPeriodFrom] = useState(invoice?.period_from ?? '');
  const [periodTo, setPeriodTo] = useState(invoice?.period_to ?? '');
  const [vatRate, setVatRate] = useState(String(invoice?.vat_rate ?? 10));
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items?.length ? invoice.items : [EMPTY_ITEM()]
  );

  // Auto-fill customer when contract selected
  useEffect(() => {
    if (!contractId) return;
    const c = contracts.find((ct) => String(ct.id) === contractId);
    if (c?.customer_id) setCustomerId(String(c.customer_id));
  }, [contractId, contracts]);

  const subtotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  const vatAmount = items.reduce((s, it) => {
    const rate = it.vat_rate ?? Number(vatRate) ?? 0;
    return s + (it.quantity * it.unit_price * rate / 100);
  }, 0);
  const totalAmount = subtotal + vatAmount;

  const handleItemChange = (i: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };
  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM()]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!contractId) { onNotify('error', 'Lỗi', 'Vui lòng chọn hợp đồng'); return; }
    if (!customerId) { onNotify('error', 'Lỗi', 'Vui lòng chọn khách hàng'); return; }
    if (items.some((it) => !it.description)) { onNotify('error', 'Lỗi', 'Vui lòng nhập mô tả cho tất cả hạng mục'); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        contract_id: Number(contractId),
        customer_id: Number(customerId),
        invoice_date: invoiceDate,
        due_date: dueDate,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        vat_rate: Number(vatRate),
        notes: notes || null,
        items: items.map((it, idx) => ({ ...it, sort_order: idx })),
      };
      if (isEdit && invoice) {
        await updateInvoice(invoice.id, payload);
        onNotify('success', 'Thành công', 'Đã cập nhật hóa đơn');
      } else {
        await createInvoice(payload as Parameters<typeof createInvoice>[0]);
        onNotify('success', 'Thành công', 'Đã tạo hóa đơn mới');
      }
      onSaved();
    } catch (err) {
      throw err; // ModalWrapper pattern: parent throws on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={isEdit ? 'Sửa hóa đơn' : 'Tạo hóa đơn'} icon={isEdit ? 'edit' : 'receipt_long'}
      width="max-w-3xl" maxHeightClass="max-h-[90vh]" disableClose={isSubmitting}>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Contract + Customer */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hợp đồng <span className="text-red-500">*</span></label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn hợp đồng —</option>
              {contracts.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.contract_code} — {c.contract_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Khách hàng <span className="text-red-500">*</span></label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.customer_name}</option>)}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ngày hóa đơn <span className="text-red-500">*</span></label>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hạn thanh toán <span className="text-red-500">*</span></label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Period */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Kỳ cước từ ngày</label>
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Đến ngày</label>
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* VAT */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-700 mb-1">Thuế suất VAT (%)</label>
          <input type="number" min={0} max={100} value={vatRate} onChange={(e) => setVatRate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Hạng mục dịch vụ</label>
            <button onClick={addItem} className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700">
              <span className="material-symbols-outlined text-sm">add_circle</span>Thêm hạng mục
            </button>
          </div>
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Mô tả</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-20">ĐVT</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-20">Số lượng</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-28">Đơn giá</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-16">VAT%</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-28">Thành tiền</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-1 py-1">
                      <input type="text" value={item.description} onChange={(e) => handleItemChange(i, 'description', e.target.value)}
                        placeholder="Tên dịch vụ / sản phẩm" className="w-full border-0 bg-transparent text-xs focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="text" value={item.unit ?? ''} onChange={(e) => handleItemChange(i, 'unit', e.target.value)}
                        placeholder="Tháng" className="w-full border-0 bg-transparent text-xs focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" min={0} value={item.quantity} onChange={(e) => handleItemChange(i, 'quantity', Number(e.target.value))}
                        className="w-full border-0 bg-transparent text-xs text-right focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" min={0} value={item.unit_price} onChange={(e) => handleItemChange(i, 'unit_price', Number(e.target.value))}
                        className="w-full border-0 bg-transparent text-xs text-right focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" min={0} max={100} value={item.vat_rate ?? 10} onChange={(e) => handleItemChange(i, 'vat_rate', Number(e.target.value))}
                        className="w-full border-0 bg-transparent text-xs text-right focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-1 text-right text-gray-600">
                      {((item.quantity * item.unit_price) * (1 + (item.vat_rate ?? 10) / 100)).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-1 py-1 text-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500">
                          <span className="material-symbols-outlined text-sm">remove_circle</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="text-xs font-medium">
                  <td colSpan={5} className="px-2 py-1.5 text-right text-gray-600">Cộng trước thuế:</td>
                  <td className="px-2 py-1.5 text-right text-gray-800">{subtotal.toLocaleString('vi-VN')} đ</td>
                  <td />
                </tr>
                <tr className="text-xs font-medium">
                  <td colSpan={5} className="px-2 py-1.5 text-right text-gray-600">Tiền thuế VAT:</td>
                  <td className="px-2 py-1.5 text-right text-gray-800">{vatAmount.toLocaleString('vi-VN')} đ</td>
                  <td />
                </tr>
                <tr className="text-sm font-bold">
                  <td colSpan={5} className="px-2 py-1.5 text-right text-gray-800">Tổng cộng:</td>
                  <td className="px-2 py-1.5 text-right text-blue-700">{totalAmount.toLocaleString('vi-VN')} đ</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2 flex-shrink-0">
        <button onClick={onClose} disabled={isSubmitting}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50">
          Hủy bỏ
        </button>
        <button onClick={() => { void handleSave().catch((err) => onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Lỗi')); }}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1">
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
          {isEdit ? 'Cập nhật' : 'Tạo hóa đơn'}
        </button>
      </div>
    </ModalWrapper>
  );
};
