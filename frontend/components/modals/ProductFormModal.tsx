import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../../services/v5Api';
import type { Business, Product, ProductUnitMaster, Vendor } from '../../types';
import { normalizeProductUnitForSave } from '../../utils/productUnit';
import {
  DEFAULT_PRODUCT_SERVICE_GROUP,
  isProductServiceGroupCode,
  normalizeProductServiceGroup,
  PRODUCT_SERVICE_GROUP_OPTIONS,
} from '../../utils/productServiceGroup';
import { AttachmentManager } from '../AttachmentManager';
import { FormSelect, SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const VIETNAMESE_DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VIETNAMESE_LARGE_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];
const PRODUCT_FORM_LABEL_CLASS_NAME = 'text-sm font-semibold text-slate-700';
const PRODUCT_FORM_TEXT_INPUT_CLASS_NAME = 'h-[46px] rounded-lg px-4 text-[15px] leading-6';
const PRODUCT_FORM_HELPER_TEXT_CLASS_NAME = 'text-[13px] leading-5 text-slate-500';
const PRODUCT_FORM_ERROR_TEXT_CLASS_NAME = 'mt-0.5 text-xs text-red-500';
const PRODUCT_FORM_TEXTAREA_CLASS_NAME = 'min-h-[156px] rounded-xl px-4 py-3 text-[15px] leading-6';

export type ProductFormField =
  | 'service_group'
  | 'product_code'
  | 'product_name'
  | 'package_name'
  | 'domain_id'
  | 'vendor_id'
  | 'standard_price'
  | 'unit'
  | 'description';

type ProductFormErrors = Partial<Record<ProductFormField, string>>;

const PRODUCT_FIELD_ORDER: ProductFormField[] = [
  'service_group',
  'product_code',
  'product_name',
  'package_name',
  'domain_id',
  'vendor_id',
  'unit',
  'standard_price',
  'description',
];

const parseVietnameseCurrencyInput = (value: string): number => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const sanitized = normalized
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVietnameseCurrencyInput = (value: unknown): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const sign = numeric < 0 ? '-' : '';
  const absoluteText = Math.abs(numeric).toString();
  const [integerPart, decimalPartRaw] = absoluteText.split('.');
  const integerFormatted = Number(integerPart || '0').toLocaleString('vi-VN');
  const decimalPart = (decimalPartRaw || '').replace(/0+$/, '');

  if (!decimalPart) {
    return `${sign}${integerFormatted}`;
  }

  return `${sign}${integerFormatted},${decimalPart}`;
};

const formatVietnameseIntegerWithThousands = (digits: string): string => {
  const normalized = String(digits || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const sanitizeVietnameseCurrencyDraft = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
  if (!normalized) {
    return '';
  }

  const cleaned = normalized.replace(/[^0-9,]/g, '');
  const firstCommaIndex = cleaned.indexOf(',');
  const hasComma = firstCommaIndex >= 0;

  const integerRaw = hasComma ? cleaned.slice(0, firstCommaIndex) : cleaned;
  const decimalRaw = hasComma ? cleaned.slice(firstCommaIndex + 1).replace(/,/g, '') : '';
  const integerDigits = integerRaw.replace(/^0+(?=\d)/, '');
  const integerFormatted = formatVietnameseIntegerWithThousands(integerDigits);
  const decimalDigits = decimalRaw.slice(0, 2);

  if (!hasComma) {
    return integerFormatted;
  }

  const integerPart = integerFormatted || '0';
  return `${integerPart},${decimalDigits}`;
};

const toTitleVietnameseSentence = (value: string): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const readVietnameseThreeDigitBlock = (value: number, forceHundreds: boolean): string => {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const unit = value % 10;
  const tokens: string[] = [];

  if (hundred > 0 || forceHundreds) {
    tokens.push(`${VIETNAMESE_DIGIT_WORDS[hundred]} trăm`);
  }

  if (ten > 1) {
    tokens.push(`${VIETNAMESE_DIGIT_WORDS[ten]} mươi`);
    if (unit === 1) tokens.push('mốt');
    else if (unit === 4) tokens.push('tư');
    else if (unit === 5) tokens.push('lăm');
    else if (unit > 0) tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
    return tokens.join(' ');
  }

  if (ten === 1) {
    tokens.push('mười');
    if (unit === 5) tokens.push('lăm');
    else if (unit > 0) tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
    return tokens.join(' ');
  }

  if (unit > 0) {
    if (hundred > 0 || forceHundreds) {
      tokens.push('lẻ');
    }
    tokens.push(VIETNAMESE_DIGIT_WORDS[unit]);
  }

  return tokens.join(' ');
};

const formatVietnameseAmountInWords = (currencyInput: string): string => {
  const sanitizedInput = sanitizeVietnameseCurrencyDraft(currencyInput);
  if (!sanitizedInput) {
    return '';
  }

  const numericAmount = parseVietnameseCurrencyInput(sanitizedInput);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return 'Giá trị không hợp lệ';
  }

  const compactInput = sanitizedInput.replace(/\./g, '');
  const [integerPartRaw = '0', decimalPartRaw = ''] = compactInput.split(',');
  const integerPart = integerPartRaw || '0';

  if (!/^\d+$/.test(integerPart) || (decimalPartRaw && !/^\d+$/.test(decimalPartRaw))) {
    return 'Giá trị không hợp lệ';
  }

  const integerValue = Number(integerPart);
  if (!Number.isSafeInteger(integerValue) || integerValue < 0) {
    return 'Giá trị không hợp lệ';
  }

  let remaining = integerValue;
  const blocks: number[] = [];

  if (remaining === 0) {
    blocks.push(0);
  } else {
    while (remaining > 0) {
      blocks.push(remaining % 1000);
      remaining = Math.floor(remaining / 1000);
    }
  }

  const spokenBlocks: string[] = [];
  let hasHigherNonZeroBlock = false;

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const blockValue = blocks[index];
    if (blockValue === 0) {
      continue;
    }

    const forceHundreds = hasHigherNonZeroBlock && blockValue < 100;
    const blockText = readVietnameseThreeDigitBlock(blockValue, forceHundreds);
    const unit = VIETNAMESE_LARGE_UNITS[index] || '';
    spokenBlocks.push(unit ? `${blockText} ${unit}` : blockText);
    hasHigherNonZeroBlock = true;
  }

  const integerWords = spokenBlocks.length > 0 ? spokenBlocks.join(' ') : 'không';

  if (!decimalPartRaw) {
    return toTitleVietnameseSentence(`${integerWords} đồng`);
  }

  const decimalWords = decimalPartRaw
    .split('')
    .map((digit) => VIETNAMESE_DIGIT_WORDS[Number(digit)] || '')
    .filter(Boolean)
    .join(' ');

  return toTitleVietnameseSentence(`${integerWords} phẩy ${decimalWords} đồng`);
};

export const validateProductForm = (data: Partial<Product>): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  const serviceGroup = String(data.service_group ?? '').trim();
  const productCode = String(data.product_code ?? '').trim();
  const productName = String(data.product_name ?? '').trim();
  const packageName = String(data.package_name ?? '').trim();
  const domainId = String(data.domain_id ?? '').trim();
  const vendorId = String(data.vendor_id ?? '').trim();
  const unit = normalizeProductUnitForSave(data.unit);
  const description = String(data.description ?? '').trim();
  const price = Number(data.standard_price ?? 0);

  if (!serviceGroup || !isProductServiceGroupCode(serviceGroup)) {
    errors.service_group = 'Vui lòng chọn nhóm dịch vụ.';
  }

  if (!productCode) {
    errors.product_code = 'Vui lòng nhập mã sản phẩm.';
  } else if (productCode.length > 100) {
    errors.product_code = 'Mã sản phẩm không được vượt quá 100 ký tự.';
  }

  if (!productName) {
    errors.product_name = 'Vui lòng nhập tên sản phẩm.';
  } else if (productName.length > 255) {
    errors.product_name = 'Tên sản phẩm không được vượt quá 255 ký tự.';
  }

  if (packageName.length > 255) {
    errors.package_name = 'Gói cước không được vượt quá 255 ký tự.';
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

  if (unit && unit.length > 50) {
    errors.unit = 'Đơn vị tính không được vượt quá 50 ký tự.';
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
  productUnitMasters?: ProductUnitMaster[];
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  type,
  data,
  businesses,
  vendors,
  productUnitMasters = [],
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    service_group: normalizeProductServiceGroup(data?.service_group || DEFAULT_PRODUCT_SERVICE_GROUP),
    product_code: data?.product_code || '',
    product_name: data?.product_name || '',
    package_name: typeof data?.package_name === 'string' ? data.package_name : '',
    domain_id: data?.domain_id || '',
    vendor_id: data?.vendor_id || '',
    standard_price: data?.standard_price || 0,
    unit: typeof data?.unit === 'string' ? data.unit : '',
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

  const unitOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Chọn đơn vị tính' },
      ...(productUnitMasters || [])
        .filter((item) => item.is_active !== false)
        .map((item) => ({
          value: String(item.unit_name || '').trim(),
          label: String(item.unit_name || '').trim(),
        }))
        .filter((item) => item.value !== ''),
    ];
    const currentUnit = normalizeProductUnitForSave(formData.unit);

    if (currentUnit && !options.some((option) => option.value === currentUnit)) {
      options.splice(1, 0, { value: currentUnit, label: currentUnit });
    }

    return options;
  }, [formData.unit, productUnitMasters]);

  const standardPriceDraft = formatVietnameseCurrencyInput(formData.standard_price);
  const standardPriceInWords = standardPriceDraft ? formatVietnameseAmountInWords(standardPriceDraft) : '';
  const isStandardPriceLocked = type === 'EDIT' && data?.standard_price_locked === true;
  const standardPriceHelperText = isStandardPriceLocked
    ? (String(data?.standard_price_lock_message || '').trim() || 'Đơn giá đã được sử dụng ở dữ liệu khác nên không thể cập nhật.')
    : (standardPriceInWords || 'Giá trị sẽ tự định dạng theo chuẩn tiền tệ Việt Nam.');

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
    } catch {
      // Parent handles the toast.
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

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
      <div className="space-y-5 bg-slate-50/70 p-5 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Phân loại</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-product-field="service_group">
              <SearchableSelect
                label="Nhóm dịch vụ"
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-product-field="product_code">
              <FormInput
                label="Mã sản phẩm"
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
            <div data-product-field="package_name" className="md:col-span-2">
              <FormInput
                label="Gói cước"
                value={String(formData.package_name || '')}
                onChange={(event: any) => {
                  setFormData({ ...formData, package_name: event.target.value });
                  clearFieldError('package_name');
                }}
                placeholder="Ví dụ: Gói VNPT HIS 1"
                error={errors.package_name}
                labelClassName={PRODUCT_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-product-field="domain_id">
              <SearchableSelect
                label="Lĩnh vực kinh doanh"
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
            <div data-product-field="unit" className="flex flex-col gap-1.5">
              <SearchableSelect
                label="Đơn vị tính"
                options={unitOptions}
                value={String(formData.unit ?? '')}
                onChange={(value) => {
                  setFormData({ ...formData, unit: value });
                  clearFieldError('unit');
                }}
                placeholder="Chọn đơn vị tính"
                error={errors.unit}
              />
            </div>
            <div data-product-field="standard_price" className="flex flex-col gap-1.5">
              <label className={PRODUCT_FORM_LABEL_CLASS_NAME}>
                Giá tiêu chuẩn (VNĐ)
                {isStandardPriceLocked ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                    Đã khóa
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={standardPriceDraft}
                onChange={(event) => {
                  setFormData({
                    ...formData,
                    standard_price: parseVietnameseCurrencyInput(event.target.value),
                  });
                  clearFieldError('standard_price');
                }}
                disabled={isSubmitting || isUploadingAttachments || isStandardPriceLocked}
                placeholder="0"
                className={`w-full border ${isStandardPriceLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'} ${PRODUCT_FORM_TEXT_INPUT_CLASS_NAME} outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:focus:border-slate-300 disabled:focus:ring-0 ${errors.standard_price ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
              />
              <p className={PRODUCT_FORM_HELPER_TEXT_CLASS_NAME}>
                {standardPriceHelperText}
              </p>
              {errors.standard_price ? <p className={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}>{errors.standard_price}</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900">Bổ sung</p>
          </div>
          <div className="space-y-5">
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
                className={`w-full border bg-white ${PRODUCT_FORM_TEXTAREA_CLASS_NAME} text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 ${errors.description ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
              />
              {errors.description ? <p className={PRODUCT_FORM_ERROR_TEXT_CLASS_NAME}>{errors.description}</p> : null}
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
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
      <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 flex-shrink-0">
        <button
          onClick={onClose}
          disabled={isSubmitting || isUploadingAttachments}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploadingAttachments}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-lg ${isSubmitting ? 'animate-spin' : ''}`}>
            {isSubmitting ? 'progress_activity' : 'check'}
          </span>
          {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
};
