import React from 'react';
import { useEscKey } from '../../hooks/useEscKey';
import { Customer, Department, Product } from '../../types';
import { ModalWrapper } from './shared';

const BlockerModalShell: React.FC<{
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
}> = ({ title, children, onClose, closeLabel = 'Đóng' }) => {
  useEscKey(onClose);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md rounded-xl border-l-4 border-yellow-500 bg-white p-6 shadow-2xl animate-fade-in">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-3xl text-yellow-500">warning_amber</span>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <div className="mt-2 text-slate-600">{children}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-slate-100 px-5 py-2 font-medium text-slate-700 hover:bg-slate-200">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ViewDepartmentModal: React.FC<{
  data: Department;
  departments: Department[];
  onClose: () => void;
  onEdit: () => void;
}> = ({ data, departments, onClose, onEdit }) => {
  const parentDept = (departments || []).find((department) => String(department.id) === String(data.parent_id));
  const parentName = parentDept ? `${parentDept.dept_code} - ${parentDept.dept_name}` : data.parent_id || '---';

  return (
    <ModalWrapper onClose={onClose} title="Thông tin phòng ban" icon="apartment">
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium uppercase text-slate-500">Mã phòng ban</label><p className="font-mono font-medium text-slate-900">{data.dept_code}</p></div>
          <div><label className="text-xs font-medium uppercase text-slate-500">Tên phòng ban</label><p className="font-medium text-slate-900">{data.dept_name}</p></div>
          <div><label className="text-xs font-medium uppercase text-slate-500">Phòng ban cha</label><p className="text-slate-900">{parentName}</p></div>
          <div><label className="text-xs font-medium uppercase text-slate-500">Trạng thái</label>
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${data.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {data.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
            </span>
          </div>
          <div><label className="text-xs font-medium uppercase text-slate-500">Số lượng nhân sự</label><p className="text-slate-900">{data.employeeCount || 0} nhân viên</p></div>
          <div><label className="text-xs font-medium uppercase text-slate-500">Ngày tạo</label><p className="text-slate-900">{data.createdDate || '---'}</p></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100">Đóng</button>
        <button onClick={() => { onClose(); onEdit(); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-deep-teal"><span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa</button>
      </div>
    </ModalWrapper>
  );
};

export function CannotDeleteModal({ data, onClose }: { data: Department; onClose: () => void }) {
  return (
    <BlockerModalShell title="Không thể xóa phòng ban" onClose={onClose} closeLabel="Đã hiểu">
      <p>
        Phòng ban <span className="font-bold">"{data.dept_name}"</span> đang có{' '}
        <span className="font-bold text-slate-900">{data.employeeCount} nhân sự</span>. Vui lòng điều chuyển hết nhân sự trước khi xóa.
      </p>
    </BlockerModalShell>
  );
}

export function CannotDeleteProductModal({ data, reason, onClose }: { data: Product; reason?: string | null; onClose: () => void }) {
  return (
    <BlockerModalShell title="Không thể xóa sản phẩm" onClose={onClose}>
      <p>
        {String(reason || '').trim() || (
          <>
            Sản phẩm <span className="font-bold">"{data.product_name}"</span> đang phát sinh ở dữ liệu khác. Vui lòng xóa bản ghi tham chiếu trước khi xóa sản phẩm.
          </>
        )}
      </p>
    </BlockerModalShell>
  );
}

export function CannotDeleteCustomerModal({ data, onClose }: { data: Customer; onClose: () => void }) {
  return (
    <BlockerModalShell title="Không thể xóa khách hàng" onClose={onClose}>
      <p>
        Khách hàng <span className="font-bold">"{data.customer_name || data.customer_code}"</span> đang được sử dụng trong hợp đồng,
        dự án hoặc cơ hội kinh doanh. Vui lòng gỡ các liên kết liên quan trước khi xóa.
      </p>
    </BlockerModalShell>
  );
}
