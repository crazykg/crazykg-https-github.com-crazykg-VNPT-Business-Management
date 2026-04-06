import React, { useMemo, useState } from 'react';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../../constants';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../../services/v5Api';
import { AttachmentManager } from '../AttachmentManager';
import { Customer, Document as AppDocument, Product, Project } from '../../types';
import { FormSelect, SearchableMultiSelect, SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

export interface DocumentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: AppDocument | null;
  customers: Customer[];
  projects: Project[];
  products: Product[];
  preselectedProduct?: Product | null;
  mode?: 'default' | 'product_upload';
  isCustomersLoading?: boolean;
  isProjectsLoading?: boolean;
  isProductsLoading?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (data: Partial<AppDocument>) => void;
}

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({
  type,
  data,
  customers,
  projects,
  products,
  preselectedProduct,
  mode = 'default',
  isCustomersLoading = false,
  isProjectsLoading = false,
  isProductsLoading = false,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const isProductUploadMode = mode === 'product_upload';
  const uniformLabelClassName = 'block text-sm font-semibold text-slate-700';

  const initialProductIds = useMemo(() => {
    const selected = Array.isArray(data?.productIds) && data?.productIds.length > 0
      ? data?.productIds
      : data?.productId
        ? [data.productId]
        : mode === 'product_upload' && preselectedProduct?.id
          ? [preselectedProduct.id]
          : [];

    return Array.from(
      new Set(
        selected
          .map((value) => String(value ?? '').trim())
          .filter((value) => value.length > 0)
      )
    );
  }, [data?.productId, data?.productIds, mode, preselectedProduct?.id]);

  const [formData, setFormData] = useState<Partial<AppDocument>>({
    id: data?.id || '',
    name: data?.name || '',
    typeId: data?.typeId || '',
    customerId: data?.customerId || '',
    projectId: data?.projectId || '',
    productId: initialProductIds[0] || '',
    productIds: initialProductIds,
    commissionPolicyText: data?.commissionPolicyText || '',
    expiryDate: data?.expiryDate || '',
    status: data?.status || 'ACTIVE',
    attachments: data?.attachments || [],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isBusy = isUploading || isSaving;

  const filteredProjects = useMemo(() => {
    if (!formData.customerId) return [];
    return (projects || []).filter((project) => project.customer_id === formData.customerId);
  }, [formData.customerId, projects]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id) newErrors.id = isProductUploadMode ? 'Số văn bản là bắt buộc' : 'Mã tài liệu là bắt buộc';
    if (!formData.name) newErrors.name = isProductUploadMode ? 'Tên/Trích yếu văn bản là bắt buộc' : 'Tên tài liệu là bắt buộc';
    if (!isProductUploadMode && !formData.typeId) newErrors.typeId = 'Vui lòng chọn Loại tài liệu';
    if (!isProductUploadMode && !formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (isProductUploadMode && !(formData.productIds || []).length) newErrors.productIds = 'Vui lòng chọn ít nhất 1 sản phẩm';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (isBusy) {
      return;
    }

    if (validate()) {
      if (isProductUploadMode) {
        onSave({
          ...formData,
          scope: 'PRODUCT_PRICING',
          releaseDate: formData.expiryDate,
          typeId: '',
          customerId: null,
          projectId: null,
        });
        return;
      }

      onSave({
        ...formData,
        scope: 'DEFAULT',
      });
    }
  };

  const handleChange = (field: keyof AppDocument, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const productOptions = useMemo(() => {
    const options = (products || []).map((product) => ({
      value: String(product.id),
      label: `${product.product_code} - ${product.product_name}`,
    }));

    const fallbackProductId = String(preselectedProduct?.id || '').trim();
    if (fallbackProductId && !options.some((product) => product.value === fallbackProductId)) {
      options.unshift({
        value: fallbackProductId,
        label: `${preselectedProduct?.product_code || fallbackProductId} - ${preselectedProduct?.product_name || 'Sản phẩm đang chọn'}`,
      });
    }

    return options;
  }, [products, preselectedProduct?.id, preselectedProduct?.product_code, preselectedProduct?.product_name]);
  const isCustomerOptionsLoading = isCustomersLoading && customers.length === 0;
  const isProjectOptionsLoading = isProjectsLoading && projects.length === 0;
  const isProductOptionsLoading = isProductsLoading && productOptions.length === 0;

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const newAttachment = await uploadDocumentAttachment(file);

      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment],
      }));

      if (String(newAttachment.warningMessage || '').trim() !== '') {
        alert(String(newAttachment.warningMessage || '').trim());
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Tải file thất bại. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa file đính kèm này?')) {
      try {
        const targetAttachment = (formData.attachments || []).find((attachment) => String(attachment.id) === String(id));
        if (targetAttachment) {
          await deleteUploadedDocumentAttachment({
            driveFileId: targetAttachment.driveFileId || null,
            fileUrl: targetAttachment.fileUrl || null,
          });
        }

        setFormData((prev) => ({
          ...prev,
          attachments: prev.attachments?.filter((attachment) => attachment.id !== id),
        }));
      } catch (error) {
        console.error('Delete upload failed:', error);
        alert('Xóa file đính kèm thất bại. Vui lòng thử lại.');
      }
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      disableClose={isBusy}
      title={
        mode === 'product_upload'
          ? 'Upload tài liệu sản phẩm'
          : type === 'ADD'
            ? 'Thêm mới Hồ sơ tài liệu'
            : 'Cập nhật Hồ sơ tài liệu'
      }
      icon={mode === 'product_upload' ? 'upload_file' : 'folder_open'}
      width="max-w-4xl"
    >
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
        <div className="min-w-0 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>info</span>
            Thông tin cơ bản
          </h3>

          <FormInput
            label={isProductUploadMode ? 'Số văn bản' : 'Mã tài liệu'}
            value={formData.id}
            onChange={(e: any) => handleChange('id', e.target.value)}
            placeholder={isProductUploadMode ? '123/QĐ-VNPT' : 'TL-2024-001'}
            disabled={type === 'EDIT' || isBusy}
            required
            error={errors.id}
            labelClassName={uniformLabelClassName}
          />

          <FormInput
            label={isProductUploadMode ? 'Tên/Trích yếu văn bản' : 'Tên tài liệu'}
            value={formData.name}
            onChange={(e: any) => handleChange('name', e.target.value)}
            placeholder={isProductUploadMode ? 'Nhập tên/trích yếu văn bản' : 'Nhập tên tài liệu'}
            disabled={isBusy}
            required
            error={errors.name}
            labelClassName={uniformLabelClassName}
          />

          {!isProductUploadMode && (
            <FormSelect
              label="Loại tài liệu"
              value={formData.typeId}
              onChange={(e: any) => handleChange('typeId', e.target.value)}
              options={[{ value: '', label: 'Chọn loại tài liệu' }, ...DOCUMENT_TYPES.map((typeOption) => ({ value: typeOption.id, label: typeOption.name }))]}
              disabled={isBusy}
              required
              error={errors.typeId}
            />
          )}

          {!isProductUploadMode && (
            <SearchableSelect
              label="Khách hàng"
              required
              options={customers.map((customer) => ({ value: String(customer.id), label: `${customer.customer_code} - ${customer.customer_name}` }))}
              value={formData.customerId || ''}
              onChange={(value) => handleChange('customerId', value)}
              error={errors.customerId}
              placeholder={isCustomerOptionsLoading ? 'Đang tải khách hàng...' : 'Chọn khách hàng'}
              disabled={isCustomerOptionsLoading || isBusy}
            />
          )}

          {!isProductUploadMode && (
            <SearchableSelect
              label="Dự án liên quan"
              options={filteredProjects.map((project) => ({ value: String(project.id), label: `${project.project_code} - ${project.project_name}` }))}
              value={formData.projectId || ''}
              onChange={(value) => handleChange('projectId', value)}
              disabled={!formData.customerId || isProjectOptionsLoading || isBusy}
              placeholder={
                !formData.customerId
                  ? 'Vui lòng chọn KH trước'
                  : isProjectOptionsLoading
                    ? 'Đang tải dự án...'
                    : 'Chọn dự án (không bắt buộc)'
              }
            />
          )}

          <SearchableMultiSelect
            label="Sản phẩm áp dụng"
            required={isProductUploadMode}
            options={productOptions}
            values={(formData.productIds || []).map((value) => String(value))}
            onChange={(nextValues) => {
              handleChange('productIds', nextValues);
              handleChange('productId', nextValues[0] || '');
            }}
            placeholder={isProductOptionsLoading ? 'Đang tải sản phẩm...' : 'Chọn một hoặc nhiều sản phẩm'}
            error={errors.productIds}
            disabled={isProductOptionsLoading || isBusy}
            usePortal
          />

          {isProductUploadMode ? (
            <div className="flex flex-col gap-1.5">
              <label className={uniformLabelClassName}>Chính sách hoa hồng</label>
              <textarea
                value={formData.commissionPolicyText || ''}
                onChange={(e) => handleChange('commissionPolicyText', e.target.value)}
                placeholder="Nhập nội dung chính sách hoa hồng..."
                disabled={isBusy}
                className="min-h-[108px] w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          ) : null}

          {(isCustomerOptionsLoading || isProjectOptionsLoading || isProductOptionsLoading) && (
            <p className="text-[11px] text-slate-400">
              Danh mục liên quan đang được nạp, các lựa chọn sẽ xuất hiện ngay khi dữ liệu sẵn sàng.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
            <FormInput
              label={isProductUploadMode ? 'Ngày ban hành' : 'Ngày hết hạn'}
              type="date"
              value={formData.expiryDate}
              onChange={(e: any) => handleChange('expiryDate', e.target.value)}
              disabled={isBusy}
              className="gap-1.5"
              labelClassName={uniformLabelClassName}
              inputClassName="h-[46px] rounded-lg px-4 text-[15px]"
            />
            <FormSelect
              label="Trạng thái"
              value={formData.status}
              onChange={(e: any) => handleChange('status', e.target.value)}
              disabled={isBusy}
              options={DOCUMENT_STATUSES}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <AttachmentManager
            attachments={formData.attachments || []}
            onUpload={handleUploadFile}
            onDelete={handleDeleteFile}
            isUploading={isUploading}
            disabled={isSaving}
            enableClipboardPaste
            clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm disabled:opacity-50"
        >
          <span className={`material-symbols-outlined ${isBusy ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>
            {isBusy ? 'progress_activity' : 'check'}
          </span>
          {isUploading ? 'Đang tải file...' : isSaving ? 'Đang lưu...' : type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};
