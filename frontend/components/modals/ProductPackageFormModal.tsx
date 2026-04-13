import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteUploadedDocumentAttachment, uploadDocumentAttachment } from '../../services/v5Api';
import type { Business, Product, ProductPackage, ProductUnitMaster, Vendor } from '../../types';
import { normalizeProductUnitForSave } from '../../utils/productUnit';
import { useToastStore } from '../../shared/stores/toastStore';
import {
  getProductServiceGroupLabel,
  isProductServiceGroupCode,
} from '../../utils/productServiceGroup';
import { AttachmentManager } from '../AttachmentManager';
import { SearchableSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const VIETNAMESE_DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VIETNAMESE_LARGE_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];
const PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME = 'text-xs font-semibold text-neutral';
const PRODUCT_PACKAGE_FORM_TEXT_INPUT_CLASS_NAME = 'h-8 rounded px-3 text-xs leading-5';
const PRODUCT_PACKAGE_FORM_HELPER_TEXT_CLASS_NAME = 'text-[11px] leading-5 text-slate-400';
const PRODUCT_PACKAGE_FORM_ERROR_TEXT_CLASS_NAME = 'mt-0.5 text-[11px] text-error';
const PRODUCT_PACKAGE_FORM_TEXTAREA_CLASS_NAME = 'min-h-[100px] rounded px-3 py-2 text-xs leading-5';

type ProductPackageFormField =
  | 'product_id'
  | 'package_code'
  | 'package_name'
  | 'unit'
  | 'standard_price'
  | 'description';

type ProductPackageFormErrors = Partial<Record<ProductPackageFormField, string>>;
type ProductPackageAutoFillField = 'package_name' | 'description' | 'unit' | 'standard_price';
type ProductPackageAutoFillSnapshot = Partial<Record<ProductPackageAutoFillField, string | number>>;

const PRODUCT_PACKAGE_FIELD_ORDER: ProductPackageFormField[] = [
  'product_id',
  'package_code',
  'package_name',
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

  return `${integerFormatted || '0'},${decimalDigits}`;
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

  const compactInput = sanitizedInput.replace(/\./g, '');
  const [integerPartRaw = '0', decimalPartRaw = ''] = compactInput.split(',');
  if (!/^\d+$/.test(integerPartRaw) || (decimalPartRaw && !/^\d+$/.test(decimalPartRaw))) {
    return 'Giá trị không hợp lệ';
  }

  const integerValue = Number(integerPartRaw);
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
    if (blockValue === 0) continue;
    const blockText = readVietnameseThreeDigitBlock(blockValue, hasHigherNonZeroBlock && blockValue < 100);
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

export const validateProductPackageForm = (data: Partial<ProductPackage>): ProductPackageFormErrors => {
  const errors: ProductPackageFormErrors = {};
  const productId = String(data.product_id ?? '').trim();
  const packageCode = String(data.package_code ?? '').trim();
  const packageName = String(data.package_name ?? '').trim();
  const unit = normalizeProductUnitForSave(data.unit);
  const description = String(data.description ?? '').trim();
  const price = Number(data.standard_price ?? 0);

  if (!productId) {
    errors.product_id = 'Vui lòng chọn sản phẩm/dịch vụ cha.';
  }
  if (!packageCode) {
    errors.package_code = 'Vui lòng nhập mã gói cước.';
  } else if (packageCode.length > 100) {
    errors.package_code = 'Mã gói cước không được vượt quá 100 ký tự.';
  }
  if (packageName.length > 255) {
    errors.package_name = 'Tên gói cước không được vượt quá 255 ký tự.';
  }
  if (unit && unit.length > 50) {
    errors.unit = 'Đơn vị tính không được vượt quá 50 ký tự.';
  }
  if (!Number.isFinite(price) || price < 0) {
    errors.standard_price = 'Đơn giá phải lớn hơn hoặc bằng 0.';
  }
  if (description.length > 2000) {
    errors.description = 'Mô tả không được vượt quá 2000 ký tự.';
  }

  return errors;
};

export interface ProductPackageFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: ProductPackage | null;
  products: Product[];
  businesses: Business[];
  vendors: Vendor[];
  productUnitMasters?: ProductUnitMaster[];
  onClose: () => void;
  onSave: (data: Partial<ProductPackage>) => Promise<void>;
}

export const ProductPackageFormModal: React.FC<ProductPackageFormModalProps> = ({
  type,
  data,
  products,
  productUnitMasters = [],
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<ProductPackage>>({
    product_id: data?.product_id || '',
    package_code: data?.package_code || '',
    package_name: data?.package_name || '',
    standard_price: data?.standard_price || 0,
    unit: typeof data?.unit === 'string' ? data.unit : '',
    description: typeof data?.description === 'string' ? data.description : '',
    attachments: Array.isArray(data?.attachments) ? data.attachments : [],
    is_active: data?.is_active !== false,
  });
  const [errors, setErrors] = useState<ProductPackageFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const isMountedRef = useRef(true);
  const touchedFieldsRef = useRef<Set<ProductPackageFormField>>(new Set(type === 'EDIT'
    ? PRODUCT_PACKAGE_FIELD_ORDER
    : ['product_id', 'package_code']));
  const lastAutoFilledValuesRef = useRef<ProductPackageAutoFillSnapshot>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const productLookup = useMemo(
    () =>
      new Map(
        (products || []).map((product) => [String(product.id), product])
      ),
    [products]
  );

  const selectedProduct = productLookup.get(String(formData.product_id || '')) ?? null;

  const productOptions = useMemo(
    () => [
      { value: '', label: 'Chọn sản phẩm/dịch vụ' },
      ...(products || [])
        .filter((product) => product.is_active !== false)
        .map((product) => {
          const serviceGroupLabel = isProductServiceGroupCode(String(product.service_group || ''))
            ? getProductServiceGroupLabel(String(product.service_group || ''))
            : 'Chưa phân nhóm';
          return {
            value: String(product.id),
            label: `${product.product_code} - ${product.product_name} · ${serviceGroupLabel}`,
          };
        }),
    ],
    [products]
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

  const clearFieldError = (field: ProductPackageFormField) => {
    setErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const clearFieldErrors = (fields: ProductPackageFormField[]) => {
    setErrors((previous) => {
      let changed = false;
      const next = { ...previous };
      fields.forEach((field) => {
        if (next[field]) {
          delete next[field];
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  };

  const markFieldTouched = (field: ProductPackageFormField) => {
    touchedFieldsRef.current.add(field);
  };

  useEffect(() => {
    if (type !== 'ADD') {
      lastAutoFilledValuesRef.current = {};
      return;
    }

    if (!selectedProduct) {
      lastAutoFilledValuesRef.current = {};
      return;
    }

    const nextPackageName = String(
      selectedProduct.package_name || selectedProduct.product_name || ''
    ).trim();
    const nextDescription = String(
      selectedProduct.description || selectedProduct.package_name || selectedProduct.product_name || ''
    ).trim();
    const nextUnit = normalizeProductUnitForSave(selectedProduct.unit);
    const nextStandardPrice = Number(selectedProduct.standard_price ?? 0);
    const previousAutoFilledValues = lastAutoFilledValuesRef.current;
    const nextFormData: Partial<ProductPackage> = { ...formData };
    const fieldsToClear: ProductPackageFormField[] = [];

    const currentPackageName = String(formData.package_name || '').trim();
    const previousAutoPackageName = String(previousAutoFilledValues.package_name || '').trim();
    if (
      nextPackageName
      && (
        !touchedFieldsRef.current.has('package_name')
        || currentPackageName === ''
        || currentPackageName === previousAutoPackageName
      )
      && currentPackageName !== nextPackageName
    ) {
      nextFormData.package_name = nextPackageName;
      fieldsToClear.push('package_name');
    }

    const currentDescription = String(formData.description || '').trim();
    const previousAutoDescription = String(previousAutoFilledValues.description || '').trim();
    if (
      nextDescription
      && (
        !touchedFieldsRef.current.has('description')
        || currentDescription === ''
        || currentDescription === previousAutoDescription
      )
      && currentDescription !== nextDescription
    ) {
      nextFormData.description = nextDescription;
      fieldsToClear.push('description');
    }

    const currentUnit = normalizeProductUnitForSave(formData.unit);
    const previousAutoUnit = normalizeProductUnitForSave(previousAutoFilledValues.unit);
    if (
      nextUnit
      && (
        !touchedFieldsRef.current.has('unit')
        || !currentUnit
        || currentUnit === previousAutoUnit
      )
      && currentUnit !== nextUnit
    ) {
      nextFormData.unit = nextUnit;
      fieldsToClear.push('unit');
    }

    const currentStandardPrice = Number(formData.standard_price ?? 0);
    const previousAutoStandardPrice = Number(previousAutoFilledValues.standard_price ?? 0);
    if (
      Number.isFinite(nextStandardPrice)
      && nextStandardPrice > 0
      && (
        !touchedFieldsRef.current.has('standard_price')
        || currentStandardPrice <= 0
        || currentStandardPrice === previousAutoStandardPrice
      )
      && currentStandardPrice !== nextStandardPrice
    ) {
      nextFormData.standard_price = nextStandardPrice;
      fieldsToClear.push('standard_price');
    }

    lastAutoFilledValuesRef.current = {
      package_name: nextPackageName,
      description: nextDescription,
      unit: nextUnit || undefined,
      standard_price: Number.isFinite(nextStandardPrice) && nextStandardPrice > 0 ? nextStandardPrice : undefined,
    };

    if (fieldsToClear.length > 0) {
      setFormData(nextFormData);
      clearFieldErrors(fieldsToClear);
    }
  }, [selectedProduct, type]);

  const focusField = (field: ProductPackageFormField) => {
    if (typeof document === 'undefined') {
      return;
    }

    const selector = `[data-product-package-field="${field}"] input, [data-product-package-field="${field}"] button, [data-product-package-field="${field}"] textarea`;
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
    const validationErrors = validateProductPackageForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstInvalidField = PRODUCT_PACKAGE_FIELD_ORDER.find((field) => validationErrors[field]);
      if (firstInvalidField) {
        requestAnimationFrame(() => focusField(firstInvalidField));
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        unit: normalizeProductUnitForSave(formData.unit),
      });
    } catch (error) {
      useToastStore.getState().addToast(
        'error',
        'Lưu thất bại',
        error instanceof Error ? error.message : 'Không thể lưu gói cước sản phẩm. Vui lòng thử lại.'
      );
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
      console.error('Product package attachment upload failed:', error);
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
      console.error('Product package attachment delete failed:', error);
      alert('Xóa file minh chứng thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm gói cước sản phẩm' : 'Cập nhật gói cước sản phẩm'}
      icon="deployed_code"
      width="max-w-5xl"
      disableClose={isSubmitting || isUploadingAttachments}
    >
      <div className="space-y-3 bg-slate-50/70 p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-700">Sản phẩm cha</p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div data-product-package-field="product_id" className="lg:col-span-2">
              <SearchableSelect
                label="Sản phẩm/Dịch vụ"
                labelClassName={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}
                size="sm"
                required
                options={productOptions}
                value={String(formData.product_id || '')}
                onChange={(value) => {
                  setFormData((previous) => ({ ...previous, product_id: value }));
                  clearFieldError('product_id');
                }}
                placeholder="Chọn sản phẩm/dịch vụ"
                error={errors.product_id}
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 lg:col-span-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nhóm dịch vụ</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {selectedProduct?.service_group ? getProductServiceGroupLabel(String(selectedProduct.service_group)) : 'Chưa chọn'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mã định danh sản phẩm cha</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {selectedProduct?.product_code ? String(selectedProduct.product_code) : 'Chưa chọn'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div data-product-package-field="package_code">
              <FormInput
                label="Mã gói cước"
                value={formData.package_code}
                onChange={(event: any) => {
                  markFieldTouched('package_code');
                  setFormData({ ...formData, package_code: event.target.value });
                  clearFieldError('package_code');
                }}
                placeholder="PKG001"
                required
                error={errors.package_code}
                labelClassName={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_PACKAGE_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_PACKAGE_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
            <div data-product-package-field="package_name">
              <FormInput
                label="Tên gói cước"
                value={formData.package_name}
                onChange={(event: any) => {
                  markFieldTouched('package_name');
                  setFormData({ ...formData, package_name: event.target.value });
                  clearFieldError('package_name');
                }}
                placeholder="Ví dụ: Gói VNPT HIS 1"
                error={errors.package_name}
                labelClassName={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}
                inputClassName={PRODUCT_PACKAGE_FORM_TEXT_INPUT_CLASS_NAME}
                errorClassName={PRODUCT_PACKAGE_FORM_ERROR_TEXT_CLASS_NAME}
              />
            </div>
            <div data-product-package-field="unit">
              <SearchableSelect
                label="Đơn vị tính"
                labelClassName={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}
                size="sm"
                options={unitOptions}
                value={String(formData.unit ?? '')}
                onChange={(value) => {
                  markFieldTouched('unit');
                  setFormData({ ...formData, unit: value });
                  clearFieldError('unit');
                }}
                placeholder="Chọn đơn vị tính"
                error={errors.unit}
              />
            </div>
            <div data-product-package-field="standard_price" className="flex flex-col gap-1.5">
              <label className={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}>Đơn giá (Trước VAT)</label>
              <input
                type="text"
                value={standardPriceDraft}
                onChange={(event) => {
                  markFieldTouched('standard_price');
                  setFormData({
                    ...formData,
                    standard_price: parseVietnameseCurrencyInput(event.target.value),
                  });
                  clearFieldError('standard_price');
                }}
                disabled={isSubmitting || isUploadingAttachments}
                placeholder="0"
                className={`w-full border bg-white ${PRODUCT_PACKAGE_FORM_TEXT_INPUT_CLASS_NAME} text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30 ${errors.standard_price ? 'border-error ring-1 ring-error/30' : 'border-slate-300'}`}
              />
              <p className={PRODUCT_PACKAGE_FORM_HELPER_TEXT_CLASS_NAME}>
                {standardPriceInWords || 'Đơn giá trước VAT sẽ tự định dạng theo chuẩn tiền tệ Việt Nam.'}
              </p>
              {errors.standard_price ? <p className={PRODUCT_PACKAGE_FORM_ERROR_TEXT_CLASS_NAME}>{errors.standard_price}</p> : null}
            </div>
            <div data-product-package-field="is_active" className="lg:col-span-2">
              <SearchableSelect
                label="Trạng thái"
                labelClassName={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}
                size="sm"
                options={[
                  { value: '1', label: 'Hoạt động' },
                  { value: '0', label: 'Ngưng hoạt động' },
                ]}
                value={formData.is_active === false ? '0' : '1'}
                onChange={(value) => setFormData((previous) => ({ ...previous, is_active: value !== '0' }))}
                placeholder="Trạng thái"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="space-y-3">
            <div data-product-package-field="description" className="flex flex-col gap-1.5">
              <label className={PRODUCT_PACKAGE_FORM_LABEL_CLASS_NAME}>Mô tả</label>
              <textarea
                value={String(formData.description || '')}
                onChange={(event) => {
                  markFieldTouched('description');
                  setFormData({ ...formData, description: event.target.value });
                  clearFieldError('description');
                }}
                placeholder="Mô tả gói cước sản phẩm"
                rows={3}
                className={`w-full border bg-white ${PRODUCT_PACKAGE_FORM_TEXTAREA_CLASS_NAME} text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/30 ${errors.description ? 'border-error ring-1 ring-error/30' : 'border-slate-300'}`}
              />
              {errors.description ? <p className={PRODUCT_PACKAGE_FORM_ERROR_TEXT_CLASS_NAME}>{errors.description}</p> : null}
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3">
              <AttachmentManager
                attachments={formData.attachments || []}
                onUpload={handleUploadAttachment}
                onDelete={handleDeleteAttachment}
                isUploading={isUploadingAttachments}
                helperText="Tải lên tài liệu, hình ảnh hoặc bảng giá để lưu làm minh chứng cho gói cước."
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
          {isSubmitting ? 'Đang lưu...' : type === 'ADD' ? 'Thêm gói cước' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
};
