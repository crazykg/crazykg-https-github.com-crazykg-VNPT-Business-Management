import React, { useState } from 'react';
import type { Vendor } from '../../types';
import { DeleteConfirmModal, FormInput, ModalWrapper } from './shared';

export const VendorFormModal: React.FC<{
  type: 'ADD' | 'EDIT';
  data?: Vendor | null;
  onClose: () => void;
  onSave: (data: Partial<Vendor>) => void;
}> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Vendor>>({
    vendor_code: data?.vendor_code || '',
    vendor_name: data?.vendor_name || '',
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm đối tác' : 'Cập nhật đối tác'} icon="storefront" width="max-w-lg">
      <div className="px-5 py-4 space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-2.5 text-blue-600 shadow-sm">
              <span className="material-symbols-outlined">storefront</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Thông tin đối tác / nhà cung cấp</p>
              <p className="mt-1 text-xs text-slate-500">Dùng mã ngắn gọn, tên rõ ràng để đồng bộ với danh mục sản phẩm, hợp đồng và báo giá.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Thông tin cơ bản</p>
              <p className="mt-1 text-xs text-slate-500">Hai trường này là nền tảng để liên kết danh mục đối tác trên toàn hệ thống.</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">badge</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput label="Mã đối tác" value={formData.vendor_code} onChange={(event) => setFormData({ ...formData, vendor_code: event.target.value })} placeholder="DT001" required />
            <FormInput label="Tên đối tác" value={formData.vendor_name} onChange={(event) => setFormData({ ...formData, vendor_name: event.target.value })} placeholder="Tên đối tác" required />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
        <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">Hủy</button>
        <button onClick={() => onSave(formData)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteVendorModal: React.FC<{ data: Vendor; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa đối tác" message={<p>Xóa đối tác <span className="font-bold">"{data.vendor_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);
