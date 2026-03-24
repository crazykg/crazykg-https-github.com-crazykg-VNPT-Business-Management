import React, { useState } from 'react';
import { Contract } from '../../types';
import { bulkGenerateInvoices } from '../../services/v5Api';
import { ModalWrapper } from '../Modals';

interface Props {
  contracts: Contract[];
  onClose: () => void;
  onGenerated: () => void;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
}

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export const InvoiceBulkGenerateModal: React.FC<Props> = ({ contracts, onClose, onGenerated, onNotify }) => {
  const [periodFrom, setPeriodFrom] = useState(firstDayOfMonth());
  const [periodTo, setPeriodTo] = useState(lastDayOfMonth());
  const [selectedContracts, setSelectedContracts] = useState<number[]>([]);
  const [allContracts, setAllContracts] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ created_count: number } | null>(null);

  const signedContracts = contracts.filter((c) => c.status === 'SIGNED' || c.status === 'RENEWED');

  const toggleContract = (id: number) => {
    setSelectedContracts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (!periodFrom || !periodTo) { onNotify('error', 'Lỗi', 'Vui lòng chọn kỳ thanh toán'); return; }
    setIsGenerating(true);
    try {
      const payload: Parameters<typeof bulkGenerateInvoices>[0] = {
        period_from: periodFrom,
        period_to: periodTo,
      };
      if (!allContracts && selectedContracts.length > 0) payload.contract_ids = selectedContracts;
      const res = await bulkGenerateInvoices(payload);
      setResult({ created_count: res.data.created_count });
    } catch (err) {
      onNotify('error', 'Lỗi', err instanceof Error ? err.message : 'Không sinh được hóa đơn');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Sinh hóa đơn hàng loạt" icon="auto_awesome" width="max-w-lg" disableClose={isGenerating}>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {result ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
            <p className="text-lg font-bold text-gray-800 mt-2">Sinh thành công!</p>
            <p className="text-gray-600 mt-1">Đã tạo <span className="font-bold text-blue-700">{result.created_count}</span> hóa đơn mới.</p>
            <button onClick={onGenerated} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
              Xem danh sách hóa đơn
            </button>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
              Hệ thống sẽ tự động sinh hóa đơn từ các kỳ thanh toán <strong>PENDING</strong> trong kỳ chọn. Mỗi kỳ được sinh đúng 1 hóa đơn.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Từ ngày <span className="text-red-500">*</span></label>
                <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Đến ngày <span className="text-red-500">*</span></label>
                <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={allContracts} onChange={(e) => setAllContracts(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Tất cả hợp đồng đang hoạt động ({signedContracts.length} hợp đồng)
              </label>
            </div>

            {!allContracts && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Chọn hợp đồng cụ thể</label>
                <div className="border border-gray-200 rounded max-h-48 overflow-y-auto">
                  {signedContracts.length === 0 && (
                    <div className="px-3 py-4 text-center text-gray-400 text-xs">Không có hợp đồng đang hoạt động</div>
                  )}
                  {signedContracts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0">
                      <input type="checkbox" checked={selectedContracts.includes(Number(c.id))}
                        onChange={() => toggleContract(Number(c.id))}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                      <span className="text-xs text-gray-700">{c.contract_code} — {c.contract_name}</span>
                    </label>
                  ))}
                </div>
                {selectedContracts.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">Đã chọn {selectedContracts.length} hợp đồng</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!result && (
        <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} disabled={isGenerating}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            Hủy bỏ
          </button>
          <button onClick={() => void handleGenerate()} disabled={isGenerating || (!allContracts && selectedContracts.length === 0)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            {isGenerating && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            Sinh hóa đơn
          </button>
        </div>
      )}
    </ModalWrapper>
  );
};
