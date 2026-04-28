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
    <div className="fixed inset-0 ui-layer-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-sm rounded-lg border border-warning/30 border-l-4 border-l-warning bg-white shadow-xl animate-fade-in">
        <div className="flex items-start gap-3 p-4">
          <div className="w-8 h-8 rounded bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-warning" style={{ fontSize: 17 }}>warning_amber</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-deep-teal">{title}</h3>
            <div className="mt-1.5 text-xs text-slate-600">{children}</div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-4 py-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
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
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã phòng ban</label><p className="mt-0.5 font-mono text-xs font-semibold text-slate-900">{data.dept_code}</p></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tên phòng ban</label><p className="mt-0.5 text-xs font-medium text-slate-900">{data.dept_name}</p></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phòng ban cha</label><p className="mt-0.5 text-xs text-slate-700">{parentName}</p></div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng thái</label>
            <div className="mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${data.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {data.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
              </span>
            </div>
          </div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Số lượng nhân sự</label><p className="mt-0.5 text-xs text-slate-700">{data.employeeCount || 0} nhân viên</p></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày tạo</label><p className="mt-0.5 text-xs text-slate-400">---</p></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          Đóng
        </button>
        <button
          onClick={() => { onClose(); onEdit(); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
          Chỉnh sửa
        </button>
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
