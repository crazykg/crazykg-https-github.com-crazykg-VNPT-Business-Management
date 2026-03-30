import React, { useState } from 'react';
import type { Business } from '../../types';
import { DeleteConfirmModal, FormInput, ModalWrapper } from './shared';

export const BusinessFormModal: React.FC<{
  type: 'ADD' | 'EDIT';
  data?: Business | null;
  onClose: () => void;
  onSave: (data: Partial<Business>) => void;
}> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Business>>({
    domain_code: data?.domain_code || '',
    domain_name: data?.domain_name || '',
    focal_point_name: data?.focal_point_name || '',
    focal_point_phone: data?.focal_point_phone || '',
    focal_point_email: data?.focal_point_email || '',
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm lĩnh vực kinh doanh' : 'Cập nhật lĩnh vực'} icon="category" width="max-w-2xl">
      <div className="p-6 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-bold text-slate-800">Thông tin lĩnh vực</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Mã lĩnh vực" value={formData.domain_code} onChange={(event) => setFormData({ ...formData, domain_code: event.target.value })} placeholder="KD001" required />
            <FormInput label="Tên lĩnh vực" value={formData.domain_name} onChange={(event) => setFormData({ ...formData, domain_name: event.target.value })} placeholder="Tên lĩnh vực" required />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Đầu mối chuyên quản</p>
            </div>
            <span className="material-symbols-outlined text-slate-300">contact_phone</span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormInput
                label="Họ tên đầu mối"
                value={formData.focal_point_name}
                onChange={(event) => setFormData({ ...formData, focal_point_name: event.target.value })}
                placeholder="Nguyễn Việt Hưng (TT.DAS)"
              />
            </div>
            <FormInput
              label="Số điện thoại đầu mối"
              value={formData.focal_point_phone}
              onChange={(event) => setFormData({ ...formData, focal_point_phone: event.target.value })}
              placeholder="0889773979"
              type="tel"
            />
            <FormInput
              label="Email đầu mối"
              value={formData.focal_point_email}
              onChange={(event) => setFormData({ ...formData, focal_point_email: event.target.value })}
              placeholder="ndvhung@vnpt.vn"
              type="email"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteBusinessModal: React.FC<{ data: Business; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa lĩnh vực" message={<p>Xóa lĩnh vực <span className="font-bold">"{data.domain_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);
