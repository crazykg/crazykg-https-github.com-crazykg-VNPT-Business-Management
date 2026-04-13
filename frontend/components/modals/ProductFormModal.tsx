import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../../services/v5Api';
import type { Business, Product, Vendor } from '../../types';
import { useToastStore } from '../../shared/stores/toastStore';
import {
  DEFAULT_PRODUCT_SERVICE_GROUP,
  isProductServiceGroupCode,
  normalizeProductServiceGroup,
  PRODUCT_SERVICE_GROUP_OPTIONS,
} from '../../utils/productServiceGroup';
import { AttachmentManager } from '../AttachmentManager';
import { FormSelect, SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';
import { useModalShortcuts } from '../../hooks/useModalShortcuts';

const PRODUCT_FORM_LABEL_CLASS_NAME = 'text-xs font-semibold text-neutral';
const PRODUCT_FORM_TEXT_INPUT_CLASS_NAME = 'h-8 rounded px-3 text-xs leading-5';
const PRODUCT_FORM_ERROR_TEXT_CLASS_NAME = 'mt-0.5 text-[11px] text-error';
const PRODUCT_FORM_TEXTAREA_CLASS_NAME = 'min-h-[100px] rounded px-3 py-2 text-xs leading-5';

export type ProductFormField =
  | 'service_group'
  | 'product_code'
  | 'product_name'
  | 'product_short_name'
  | 'domain_id'
  | 'vendor_id'
  | 'standard_price'
  | 'description';

type ProductFormErrors = Partial<Record<ProductFormField, string>>;

const PRODUCT_FIELD_ORDER: ProductFormField[] = [
  'service_group',
  'product_code',
  'product_name',
  'product_short_name',
  'domain_id',
  'vendor_id',
  'standard_price',
  'description',
];

export const validateProductForm = (data: Partial<Product>): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  const serviceGroup = String(data.service_group ?? '').trim();
  const productCode = String(data.product_code ?? '').trim();
  const productName = String(data.product_name ?? '').trim();
  const productShortName = String(data.product_short_name ?? '').trim();
  const domainId = String(data.domain_id ?? '').trim();
  const vendorId = String(data.vendor_id ?? '').trim();
  const description = String(data.description ?? '').trim();
  const price = Number(data.standard_price ?? 0);

  if (!serviceGroup || !isProductServiceGroupCode(serviceGroup)) {
    errors.service_group = 'Vui lòng chọn nhóm dịch vụ.';
  }

  if (!productCode) {
    errors.product_code = 'Vui lòng nhập mã định danh.';
  } else if (productCode.length > 100) {
    errors.product_code = 'Mã định danh không được vượt quá 100 ký tự.';
  }

  if (!productName) {
    errors.product_name = 'Vui lòng nhập tên sản phẩm.';
  } else if (productName.length > 255) {
    errors.product_name = 'Tên sản phẩm không được vượt quá 255 ký tự.';
  }

  if (productShortName.length > 255) {
    errors.product_short_name = 'Tên viết tắt không được vượt quá 255 ký tự.';
  }

  if (!domainId) {
    errors.domain_id = 'Vui lòng chọn lĩnh vực kinh doanh.';
  }

  if (!vendorId) {
    errors.vendor_id = 'Vui lòng chọn nhà cung cấp.';
  }

  if (!Number.isFinite(price) || price < 0) {
    errors.standard_price = 'Giá tiêu chuẩn phải lớn hơn hoặc bằng 0.';
  }

  if (description.length > 2000) {
    errors.description = 'Mô tả không được vượt quá 2000 ký tự.';
  }

  return errors;
};

export interface ProductFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Product | null;
  businesses: Business[];
  vendors: Vendor[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  type,
  data,
  businesses,
  vendors,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    service_group: normalizeProductServiceGroup(data?.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
    product_code: data?.product_code || '',
    product_name: data?.product_name || '',
    product_short_name: typeof data?.product_short_name === 'string' ? data.product_short_name : '',
    domain_id: data?.domain_id || '',
    vendor_id: data?.vendor_id || '',
    standard_price: data?.standard_price || 0,
    description: typeof data?.description === 'string' ? data.description : '',
    attachments: Array.isArray(data?.attachments) ? data.attachments : [],
    is_active: data?.is_active !== false,
  });
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const businessOptions = useMemo(
    () => [
      { value: '', label: 'Chọn lĩnh vực' },
      ...(businesses || []).map((business) => ({
        value: String(business.id),
        label: `${business.domain_code} - ${business.domain_name}`,
      })),
    ],
    [businesses]
  );

  const vendorOptions = useMemo(
    () => [
      { value: '', label: 'Chọn nhà cung cấp' },
      ...(vendors || []).map((vendor) => ({
        value: String(vendor.id),
        label: `${vendor.vendor_code} - ${vendor.vendor_name}`,
      })),
    ],
    [vendors]
  );

  const serviceGroupOptions = useMemo(
    () =>
      PRODUCT_SERVICE_GROUP_OPTIONS.map((option) => ({
        value: String(option.value),
        label: option.label,
      })),
    []
  );

  const clearFieldError = (field: ProductFormField) => {
    setErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const focusField = (field: ProductFormField) => {
    if (typeof document === 'undefined') {
      return;
    }

    const selector = `[data-product-field="${field}"] input, [data-product-field="${field}"] button, [data-product-field="${field}"] textarea`;
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof element.focus === 'function') {
      element.focus();
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validateProductForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstInvalidField = PRODUCT_FIELD_ORDER.find((field) => validationErrors[field]);
      if (firstInvalidField) {
        requestAnimationFrame(() => focusField(firstInvalidField));
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        service_group: normalizeProductServiceGroup(formData.service_group),
      });
    } catch (error) {
      useToastStore.getState().addToast('error', 'Lưu thất bại', error instanceof Error ? error.message : 'Không thể lưu sản phẩm. Vui lòng thử lại.');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  useModalShortcuts({ onSave: handleSubmit, enabled: !isSubmitting && !isUploadingAttachments });

  const handleUploadAttachment = async (file: File) => {
    setIsUploadingAttachments(true);
    try {
      const uploadedAttachment = await uploadDocumentAttachment(file);
      setFormData((previous) => ({
        ...previous,
        attachments: [...(previous.attachments || []), uploadedAttachment],
      }));

      if (String(uploadedAttachment.warningMessage || '').trim() !== '') {
        alert(String(uploadedAttachment.warningMessage || '').trim());
      }
    } catch (error) {
      console.error('Product attachment upload failed:', error);
      alert('Tải file minh chứng thất bại. Vui lòng thử lại.');
    } finally {
      if (isMountedRef.current) {
        setIsUploadingAttachments(false);
      }
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa file minh chứng này?')) {
      return;
    }

    const targetAttachment = (formData.attachments || []).find((attachment) => String(attachment.id) === String(id));
    if (!targetAttachment) {
      return;
    }

    try {
      const attachmentId = /^\d+$/.test(String(targetAttachment.id)) ? Number(targetAttachment.id) : null;
      await deleteUploadedDocumentAttachment({
        attachmentId,
        driveFileId: targetAttachment.driveFileId || null,
        fileUrl: targetAttachment.fileUrl || null,
        storagePath: targetAttachment.storagePath || null,
        storageDisk: targetAttachment.storageDisk || null,
      });

      setFormData((previous) => ({
        ...previous,
        attachments: (previous.attachments || []).filter((attachment) => String(attachment.id) !== String(id)),
      }));
    } catch (error) {
      console.error('Product attachment delete failed:', error);
      alert('Xóa file minh chứng thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm sản phẩm' : 'Cập nhật sản phẩm'}
      icon="inventory_2"
      width="max-w-5xl"
      disableClose={isSubmitting || isUploadingAttachments}
    >
      <div className="space-y-3 bg-slate-50/70 p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-700">Phân loại</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div data-product-field="service_group">
              <SearchableSelect
                label="Nhóm dịch vụ"
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                size="sm"
                required
                options={serviceGroupOptions}
                value={String(formData.service_group || DEFAULT_PRODUCT_SERVICE_GROUP)}
                onChange={(value) => {
                  setFormData({ ...formData, service_group: value });
                  clearFieldError('service_group');
                }}
                placeholder="Chọn nhóm dịch vụ"
                error={errors.service_group}
              />
            </div>
            <div data-product-field="is_active">
              <FormSelect
                label="Trạng thái"
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                size="sm"
                value={formData.is_active === false ? '0' : '1'}
                onChange={(event: any) => setFormData({ ...formData, is_active: String(event.target.value) !== '0' })}
                options={[
                  { value: '1', label: 'Hoạt động' },
                  { value: '0', label: 'Ngưng hoạt động' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div data-product-field="product_code">
              <FormInput
                label="Mã định danh"
                value={formData.product_code}
                onChange={(event: any) => {
                  setFormData({ ...formData, product_code: event.target.value });
                  clearFieldError('product_code');
                }}
                placeholder="SP001"
                required
                error={errors.product_code}
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
            <div data-product-field="product_name">
              <FormInput
                label="Tên sản phẩm"
                value={formData.product_name}
                onChange={(event: any) => {
                  setFormData({ ...formData, product_name: event.target.value });
                  clearFieldError('product_name');
                }}
                placeholder="Tên sản phẩm"
                required
                error={errors.product_name}
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
            <div data-product-field="product_short_name">
              <FormInput
                label="Tên viết tắt"
                value={String(formData.product_short_name || '')}
                onChange={(event: any) => {
                  setFormData({ ...formData, product_short_name: event.target.value });
                  clearFieldError('product_short_name');
                }}
                placeholder="Ví dụ: VNPT HIS"
                error={errors.product_short_name}
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div data-product-field="domain_id">
              <SearchableSelect
                label="Lĩnh vực kinh doanh"
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                size="sm"
                required
                options={businessOptions}
                value={String(formData.domain_id || '')}
                onChange={(value) => {
                  setFormData({ ...formData, domain_id: value });
                  clearFieldError('domain_id');
                }}
                placeholder="Chọn lĩnh vực"
                error={errors.domain_id}
              />
            </div>
            <div data-product-field="vendor_id">
              <SearchableSelect
                label="Nhà cung cấp"
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                size="sm"
                required
                options={vendorOptions}
                value={String(formData.vendor_id || '')}
                onChange={(value) => {
                  setFormData({ ...formData, vendor_id: value });
                  clearFieldError('vendor_id');
                }}
                placeholder="Chọn nhà cung cấp"
                error={errors.vendor_id}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="space-y-3">
            <div data-product-field="description" className="flex flex-col gap-1.5">
              <label className={PRODUCT_FORM_LABEL_CLASS_NAME}>Mô tả</label>
              <textarea
                value={String(formData.description || '')}
                onChange={(event) => {
                  setFormData({ ...formData, description: event.target.value });
                  clearFieldError('description');
                }}
                placeholder="Mô tả sản phẩm/dịch vụ"
                rows={3}
                className={`w-full border bg-white ${PRODUCT_FORM_TEXTAREA_CLASS_NAME} text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30 ${errors.description ? 'border-error ring-1 ring-error/30' : 'border-slate-300'}`}
              />
              {errors.description ? <p className={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}>{errors.description}</p> : null}
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3">
              <AttachmentManager
                attachments={formData.attachments || []}
                onUpload={handleUploadAttachment}
                onDelete={handleDeleteAttachment}
                isUploading={isUploadingAttachments}
                helperText="Tải lên tài liệu, hình ảnh hoặc bảng giá để lưu làm minh chứng cho sản phẩm."
                emptyStateDescription="Chưa có file minh chứng nào. Bạn có thể tải tài liệu kỹ thuật, bảng giá hoặc ảnh minh họa tại đây."
                uploadButtonLabel="Tải file minh chứng"
                enableClipboardPaste
                clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán nhanh ảnh chụp minh chứng."
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3 flex-shrink-0">
        <button
          onClick={onClose}
          disabled={isSubmitting || isUploadingAttachments}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploadingAttachments}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors text-white shadow-sm disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }}
        >
          <span className={`material-symbols-outlined ${isSubmitting ? 'animate-spin' : ''}`} style={{ fontSize: 14 }}>
            {isSubmitting ? 'progress_activity' : 'check'}
          </span>
          {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
};
