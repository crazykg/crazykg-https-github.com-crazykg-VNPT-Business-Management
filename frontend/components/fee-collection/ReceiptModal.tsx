import React, { useEffect, useState } from 'react';
import { Contract, Customer, Receipt } from '../../types';
import { useCreateReceipt, useUpdateReceipt } from '../../shared/hooks/useFeeCollection';
import { ModalWrapper } from '../Modals';

interface ReceiptModalProps {
  receipt: Receipt | null;
  contracts: Contract[];
  customers: Customer[];
  invoiceId?: string | number;
  invoiceCode?: string;
  onClose: () => void;
  onSaved: () => void;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt, contracts, customers, invoiceId, invoiceCode, onClose, onSaved, onNotify,
}) => {
  const isEdit = !!receipt;
  const createReceiptMutation = useCreateReceipt();
  const updateReceiptMutation = useUpdateReceipt();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contractId, setContractId] = useState(receipt ? String(receipt.contract_id) : '');
  const [customerId, setCustomerId] = useState(receipt ? String(receipt.customer_id) : '');
  const [receiptDate, setReceiptDate] = useState(receipt?.receipt_date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(receipt ? String(receipt.amount) : '');
  const [paymentMethod, setPaymentMethod] = useState(receipt?.payment_method ?? 'BANK_TRANSFER');
  const [bankName, setBankName] = useState(receipt?.bank_name ?? '');
  const [bankAccount, setBankAccount] = useState(receipt?.bank_account ?? '');
  const [transactionRef, setTransactionRef] = useState(receipt?.transaction_ref ?? '');
  const [notes, setNotes] = useState(receipt?.notes ?? '');
  const linkedInvoiceId = invoiceId ?? receipt?.invoice_id;

  // Auto-fill customer when contract selected
  useEffect(() => {
    if (!contractId) return;
    const c = contracts.find((ct) => String(ct.id) === contractId);
    if (c?.customer_id) setCustomerId(String(c.customer_id));
  }, [contractId, contracts]);

  const handleSave = async () => {
    if (!contractId) { onNotify('error', 'Lỗi', 'Vui lòng chọn hợp đồng'); return; }
    if (!customerId) { onNotify('error', 'Lỗi', 'Vui lòng chọn khách hàng'); return; }
    if (!amount || Number(amount) <= 0) { onNotify('error', 'Lỗi', 'Vui lòng nhập số tiền thu'); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        contract_id: Number(contractId),
        customer_id: Number(customerId),
        invoice_id: linkedInvoiceId ? Number(linkedInvoiceId) : undefined,
        receipt_date: receiptDate,
        amount: Number(amount),
        payment_method: paymentMethod,
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        transaction_ref: transactionRef || null,
        notes: notes || null,
      };
      if (isEdit && receipt) {
        await updateReceiptMutation.mutateAsync({ id: receipt.id, data: payload });
        onNotify('success', 'Thành công', 'Đã cập nhật phiếu thu');
      } else {
        await createReceiptMutation.mutateAsync(payload);
        onNotify('success', 'Thành công', 'Đã tạo phiếu thu');
      }
      onSaved();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const showBank = paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'ONLINE';

  return (
    <ModalWrapper onClose={onClose} title={isEdit ? 'Sửa phiếu thu' : 'Tạo phiếu thu'} icon="payments"
      width="max-w-lg" disableClose={isSubmitting}>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {linkedInvoiceId && (
          <div className="bg-blue-50 rounded px-3 py-2 text-xs text-blue-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">receipt</span>
            Phiếu thu cho hóa đơn: <strong>{invoiceCode ?? `#${linkedInvoiceId}`}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hợp đồng <span className="text-red-500">*</span></label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Chọn hợp đồng —</option>
              {contracts.map((c) => <option key={c.id} value={String(c.id)}>{c.contract_code} — {c.contract_name}</option>)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ngày thu <span className="text-red-500">*</span></label>
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Số tiền (VND) <span className="text-red-500">*</span></label>
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phương thức thanh toán</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
            <option value="CASH">Tiền mặt</option>
            <option value="ONLINE">Online</option>
            <option value="OFFSET">Bù trừ công nợ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>

        {showBank && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngân hàng</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
                placeholder="Vietcombank, BIDV..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mã giao dịch</label>
              <input type="text" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="FT24..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2 flex-shrink-0">
        <button onClick={onClose} disabled={isSubmitting}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
          Hủy bỏ
        </button>
        <button onClick={() => { void handleSave().catch((err) => onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Lỗi')); }}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
          {isEdit ? 'Cập nhật' : 'Tạo phiếu thu'}
        </button>
      </div>
    </ModalWrapper>
  );
};
