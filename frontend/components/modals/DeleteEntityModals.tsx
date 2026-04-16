import React from 'react';
import type {
  Contract,
  Customer,
  CustomerPersonnel,
  Department,
  Document as AppDocument,
  Employee,
  FeedbackRequest,
  Product,
  ProductPackage,
  Project,
  Reminder,
  UserDeptHistory,
} from '../../types';
import { getUserDeptHistoryTransferTypeLabel, normalizeUserDeptHistoryTransferType } from '../../utils/userDeptHistoryTransferType';
import { DeleteConfirmModal } from './shared';

const normalizeTransferCode = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'LC000';

  const digits = raw.replace(/\D+/g, '');
  if (!digits) return raw;

  return `LC${digits.padStart(3, '0')}`;
};

export const DeleteWarningModal: React.FC<{ data: Department; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa phòng ban"
    message={<p>Bạn có chắc chắn muốn xóa phòng ban <span className="font-bold text-slate-900">"{data.dept_name}"</span>? Hành động này không thể hoàn tác.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteEmployeeModal: React.FC<{ data: Employee; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa nhân sự"
    message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.full_name || data.username || data.user_code}"</span>? Dữ liệu này không thể khôi phục.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteProductModal: React.FC<{ data: Product; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa sản phẩm" message={<p>Xóa sản phẩm <span className="font-bold">"{data.product_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const DeleteProductPackageModal: React.FC<{ data: ProductPackage; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa gói cước sản phẩm"
    message={<p>Xóa gói cước <span className="font-bold">"{data.package_name}"</span>?</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteCustomerModal: React.FC<{ data: Customer; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa khách hàng" message={<p>Xóa khách hàng <span className="font-bold">"{data.customer_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const DeleteCusPersonnelModal: React.FC<{ data: CustomerPersonnel; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa nhân sự liên hệ"
    message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.fullName}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteProjectModal: React.FC<{ data: Project; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa Dự án"
    message={<p>Bạn có chắc chắn muốn xóa dự án <span className="font-bold text-slate-900">"{data.project_name}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteContractModal: React.FC<{ data: Contract; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa Hợp đồng"
    message={<p>Bạn có chắc chắn muốn xóa hợp đồng <span className="font-bold text-slate-900">"{data.contract_code || data.contract_number}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteDocumentModal: React.FC<{ data: AppDocument; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa Hồ sơ tài liệu"
    message={<p>Bạn có chắc chắn muốn xóa hồ sơ <span className="font-bold text-slate-900">"{data.name}"</span>? Các file đính kèm liên quan sẽ không bị xóa trên Drive nhưng sẽ mất liên kết.</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteReminderModal: React.FC<{ data: Reminder; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa nhắc việc"
    message={<p>Bạn có chắc chắn muốn xóa nhắc việc <span className="font-bold text-slate-900">"{data.title}"</span>?</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteUserDeptHistoryModal: React.FC<{ data: UserDeptHistory; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title={`Xóa ${getUserDeptHistoryTransferTypeLabel(normalizeUserDeptHistoryTransferType(data.transferType))}`}
    message={<p>Bạn có chắc chắn muốn xóa bản ghi <span className="font-bold text-slate-900">"{normalizeTransferCode(data.id)}"</span>?</p>}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);

export const DeleteFeedbackModal: React.FC<{
  data: FeedbackRequest;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal
    title="Xóa góp ý"
    message={
      <p>
        Bạn có chắc chắn muốn xóa góp ý{' '}
        <span className="font-bold text-slate-900">"{data.title}"</span>? Hành động này không thể hoàn tác.
      </p>
    }
    onClose={onClose}
    onConfirm={onConfirm}
  />
);
