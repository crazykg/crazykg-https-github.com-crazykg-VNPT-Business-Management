import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Business,
  Contract,
  ContractItem,
  ContractTermUnit,
  Product,
  ProductPackage,
  Project,
  ProjectItemMaster,
} from '../../../types';
import { parseContractItemCatalogValue, resolveContractItemCatalogValue } from '../contractItemCatalogUtils';

type ContractSourceMode = 'PROJECT' | 'INITIAL';

interface UseContractFormParams {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  initialFormData: Partial<Contract>;
  fixedSourceMode?: ContractSourceMode | null;
  projects: Project[];
  projectTotals: Map<string, number>;
  productById: Map<string, Product>;
  packageById: Map<string, ProductPackage>;
  businessById: Map<string, Business>;
  contractId?: string | number;
  areScheduleSourceFieldsLocked: boolean;
  isItemsEditable: boolean;
  maxContractValueIntegerDigits: number;
  onSave: (data: Partial<Contract>) => Promise<void> | void;
  countCurrencyIntegerDigits: (value: unknown) => number;
  parseCurrency: (value: number | string) => number;
  parseDateValue: (value: unknown) => number | null;
  todayIsoDate: () => string;
  resolveContractExpiryByTerm: (source: Partial<Contract>) => string | null;
  resolveTermUnitByInvestmentMode: (mode: unknown) => ContractTermUnit;
  normalizeVatRate: (value: unknown) => number | null;
  normalizeVatAmount: (value: unknown) => number | null;
  computeVatAmountByRate: (amountBeforeVat: number, vatRate: number | null) => number | null;
  resolveEffectiveVatAmount: (
    storedVatAmount: unknown,
    amountBeforeVat: number,
    vatRate: number | null
  ) => number;
  resolveVatRateByBusiness: (business: Business | null) => number | null;
  roundMoney: (value: number) => number;
}

const normalizeSnapshotText = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized !== '' ? normalized : null;
};

interface UseContractFormResult {
  errors: Record<string, string>;
  inlineNotice: string;
  setInlineNotice: Dispatch<SetStateAction<string>>;
  formData: Partial<Contract>;
  contractSourceMode: ContractSourceMode;
  draftItems: ContractItem[];
  isProjectItemsReferenceOpen: boolean;
  expiryDateManualOverride: boolean;
  handleFieldBlur: (field: keyof Contract) => void;
  handleChange: (field: keyof Contract, value: unknown) => void;
  handleContractSourceModeChange: (nextMode: ContractSourceMode) => void;
  handleAddDraftItem: () => void;
  handleRemoveDraftItem: (index: number) => void;
  handleDraftItemChange: (index: number, field: keyof ContractItem, value: unknown) => void;
  handleDraftProductChange: (index: number, nextProductId: string) => void;
  handleDraftVatAmountChange: (index: number, rawValue: string) => void;
  handleImportProjectItems: (
    projectItems: ProjectItemMaster[],
    mergeMode?: 'merge' | 'replace'
  ) => void;
  handleExpiryDateChange: (value: string) => void;
  handleRecalculateExpiryDate: () => void;
  handleToggleProjectItemsReference: () => void;
  handleSave: () => Promise<void>;
}

export const useContractForm = ({
  type,
  data,
  initialFormData,
  fixedSourceMode = null,
  projects,
  projectTotals,
  productById,
  packageById,
  businessById,
  contractId,
  areScheduleSourceFieldsLocked,
  isItemsEditable,
  maxContractValueIntegerDigits,
  onSave,
  countCurrencyIntegerDigits,
  parseCurrency,
  parseDateValue,
  todayIsoDate,
  resolveContractExpiryByTerm,
  resolveTermUnitByInvestmentMode,
  normalizeVatRate,
  normalizeVatAmount,
  computeVatAmountByRate,
  resolveEffectiveVatAmount,
  resolveVatRateByBusiness,
  roundMoney,
}: UseContractFormParams): UseContractFormResult => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState('');
  const [formData, setFormData] = useState<Partial<Contract>>(initialFormData);
  const [contractSourceMode, setContractSourceMode] = useState<ContractSourceMode>(
    fixedSourceMode ?? (String(initialFormData.project_id || '').trim() !== '' ? 'PROJECT' : 'INITIAL')
  );
  const [draftItems, setDraftItems] = useState<ContractItem[]>([]);
  const [isProjectItemsReferenceOpen, setIsProjectItemsReferenceOpen] = useState(false);
  const [expiryDateManualOverride, setExpiryDateManualOverride] = useState<boolean>(
    Boolean(initialFormData.expiry_date_manual_override)
  );

  const resolveDraftItemSources = (item: Pick<ContractItem, 'product_id' | 'product_package_id' | 'productPackageId'>) => {
    const productPackageId = String(item.productPackageId ?? item.product_package_id ?? '').trim();
    const productPackage = productPackageId ? packageById.get(productPackageId) || null : null;
    const resolvedProductId = String(productPackage?.product_id ?? item.product_id ?? '').trim();
    const product = resolvedProductId ? productById.get(resolvedProductId) || null : null;

    return {
      productPackage,
      product,
    };
  };

  useEffect(() => {
    const initialDraftItems = Array.isArray(data?.items) && data.items.length > 0
      ? data.items.map((item) => ({
          id: item.id,
          contract_id: item.contract_id,
          product_id: item.product_id,
          product_package_id: item.productPackageId ?? item.product_package_id ?? null,
          product_code: item.product_code || null,
          product_name: item.product_name || null,
          unit: item.unit || null,
          quantity: Number(item.quantity || 1) || 1,
          unit_price: Number(item.unit_price || 0) || 0,
          vat_rate: normalizeVatRate(item.vat_rate),
          vat_amount: resolveEffectiveVatAmount(
            item.vat_amount,
            (Number(item.quantity || 0) || 0) * (Number(item.unit_price || 0) || 0),
            normalizeVatRate(item.vat_rate)
          ),
        }))
      : [];

    setFormData(initialFormData);
    setContractSourceMode(fixedSourceMode ?? (String(initialFormData.project_id || '').trim() !== '' ? 'PROJECT' : 'INITIAL'));
    setDraftItems(initialDraftItems);
    setIsProjectItemsReferenceOpen(false);
    setErrors({});
    setInlineNotice('');
    setExpiryDateManualOverride(Boolean(initialFormData.expiry_date_manual_override));
  }, [
    data?.items,
    fixedSourceMode,
    initialFormData,
    normalizeVatRate,
    resolveEffectiveVatAmount,
  ]);

  const resolveValidationSourceMode = (explicitMode?: ContractSourceMode): ContractSourceMode =>
    explicitMode ?? fixedSourceMode ?? contractSourceMode;

  useEffect(() => {
    if (expiryDateManualOverride) {
      return;
    }

    const calculatedExpiry = resolveContractExpiryByTerm(formData);
    if (!calculatedExpiry) {
      return;
    }

    if (calculatedExpiry === String(formData.expiry_date || '')) {
      return;
    }

    setFormData((prev) => ({ ...prev, expiry_date: calculatedExpiry }));
    setErrors((prev) => ({ ...prev, expiry_date: '' }));
  }, [
    expiryDateManualOverride,
    formData.effective_date,
    formData.expiry_date,
    formData.sign_date,
    formData.term_unit,
    formData.term_value,
    resolveContractExpiryByTerm,
  ]);

  const applyProjectSelection = (next: Partial<Contract>, project: Project | null): string => {
    if (!project) {
      next.project_id = '';
      next.customer_id = '';
      next.project_type_code = null;
      return '';
    }

    next.project_id = project.id;
    next.customer_id = project.customer_id;
    next.project_type_code = null;
    next.value = Number(projectTotals.get(String(project.id)) || 0);

    const derivedTermUnit = resolveTermUnitByInvestmentMode(project.investment_mode);
    next.project_type_code = null;
    next.term_unit = derivedTermUnit;

    const parsedTermValue = next.term_value === null || next.term_value === undefined
      ? null
      : Number(next.term_value);
    if (
      derivedTermUnit === 'DAY'
      && parsedTermValue !== null
      && Number.isFinite(parsedTermValue)
      && !Number.isInteger(parsedTermValue)
    ) {
      next.term_value = null;
    }

    return 'Đơn vị thời hạn đã tự chọn theo hình thức dự án.';
  };

  const applyProjectTypeSelection = (next: Partial<Contract>, projectTypeCode: unknown): string => {
    const normalized = String(projectTypeCode || '').trim().toUpperCase();
    next.project_type_code = normalized || null;

    if (!normalized) {
      return '';
    }

    const derivedTermUnit = resolveTermUnitByInvestmentMode(normalized);
    next.term_unit = derivedTermUnit;

    const parsedTermValue = next.term_value === null || next.term_value === undefined
      ? null
      : Number(next.term_value);
    if (
      derivedTermUnit === 'DAY'
      && parsedTermValue !== null
      && Number.isFinite(parsedTermValue)
      && !Number.isInteger(parsedTermValue)
    ) {
      next.term_value = null;
    }

    return 'Đơn vị thời hạn đã tự chọn theo hình thức dự án.';
  };

  const validateField = (
    field: keyof Contract,
    source: Partial<Contract>,
    sourceMode: ContractSourceMode = resolveValidationSourceMode()
  ): string => {
    const isDraftStatus = String(source.status || 'DRAFT').trim().toUpperCase() === 'DRAFT';
    const isInitialMode = sourceMode === 'INITIAL';
    const normalizedTermUnit = String(source.term_unit || '').trim().toUpperCase();
    const hasTermUnit = normalizedTermUnit === 'MONTH' || normalizedTermUnit === 'DAY';
    const hasTermValue = source.term_value !== null && source.term_value !== undefined && String(source.term_value).trim() !== '';
    const parsedTermValue = hasTermValue ? Number(source.term_value) : null;

    if (field === 'contract_code' && !String(source.contract_code || '').trim()) {
      return 'Mã hợp đồng là bắt buộc.';
    }
    if (field === 'contract_name' && !String(source.contract_name || '').trim()) {
      return 'Tên hợp đồng là bắt buộc.';
    }
    if (field === 'signer_user_id' && !String(source.signer_user_id || '').trim()) {
      return 'Vui lòng chọn người ký hợp đồng.';
    }
    if (field === 'customer_id' && isInitialMode && !String(source.customer_id || '').trim()) {
      return 'Vui lòng chọn khách hàng.';
    }
    if (field === 'project_id' && !isInitialMode && !String(source.project_id || '').trim()) {
      return 'Vui lòng chọn dự án.';
    }
    if (field === 'project_type_code' && isInitialMode && !String(source.project_type_code || '').trim()) {
      return 'Vui lòng chọn loại dự án.';
    }
    if (field === 'payment_cycle' && !String(source.payment_cycle || '').trim()) {
      return 'Vui lòng chọn chu kỳ thanh toán.';
    }
    if (field === 'value') {
      const integerDigits = countCurrencyIntegerDigits(source.value || 0);
      if (integerDigits > maxContractValueIntegerDigits) {
        return `Giá trị hợp đồng tối đa ${maxContractValueIntegerDigits} chữ số phần nguyên.`;
      }
    }
    if (field === 'term_unit' && hasTermValue && !hasTermUnit) {
      return 'Vui lòng chọn đơn vị thời hạn.';
    }
    if (field === 'term_value') {
      if (hasTermUnit && !hasTermValue) {
        return 'Vui lòng nhập thời hạn hợp đồng.';
      }
      if (hasTermValue && (!Number.isFinite(parsedTermValue) || Number(parsedTermValue) <= 0)) {
        return 'Thời hạn hợp đồng phải lớn hơn 0.';
      }
      if (
        hasTermUnit
        && normalizedTermUnit === 'DAY'
        && hasTermValue
        && Number.isFinite(parsedTermValue)
        && !Number.isInteger(parsedTermValue)
      ) {
        return 'Thời hạn theo ngày phải là số nguyên.';
      }
    }
    if (field === 'effective_date' && !isDraftStatus && !String(source.effective_date || '').trim()) {
      return 'Ngày hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
    }
    if (field === 'expiry_date' && !isDraftStatus && !String(source.expiry_date || '').trim()) {
      return 'Ngày hết hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
    }

    return '';
  };

  const validateDateConstraints = (source: Partial<Contract>): Pick<Record<string, string>, 'effective_date' | 'expiry_date'> => {
    const nextErrors: Pick<Record<string, string>, 'effective_date' | 'expiry_date'> = {
      effective_date: '',
      expiry_date: '',
    };

    const signDate = parseDateValue(source.sign_date);
    const effectiveDate = parseDateValue(source.effective_date);
    const expiryDate = parseDateValue(source.expiry_date);
    const normalizedStatus = String(source.status || 'DRAFT').trim().toUpperCase();
    const startDate = effectiveDate ?? signDate;

    if (normalizedStatus !== 'DRAFT') {
      if (!String(source.effective_date || '').trim()) {
        nextErrors.effective_date = 'Ngày hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
      }
      if (!String(source.expiry_date || '').trim()) {
        nextErrors.expiry_date = 'Ngày hết hiệu lực là bắt buộc khi trạng thái khác Đang soạn.';
      }
    }

    if (!nextErrors.effective_date && signDate !== null && effectiveDate !== null && effectiveDate < signDate) {
      nextErrors.effective_date = 'Ngày hiệu lực phải lớn hơn hoặc bằng ngày ký.';
    }

    if (!nextErrors.expiry_date && startDate !== null && expiryDate !== null && expiryDate < startDate) {
      nextErrors.expiry_date = 'Ngày hết hiệu lực phải lớn hơn hoặc bằng mốc tính hạn.';
    }

    return nextErrors;
  };

  const handleFieldBlur = (field: keyof Contract) => {
    setErrors((prev) => {
      const next = {
        ...prev,
        [field]: validateField(field, formData),
      };

      if (
        field === 'sign_date'
        || field === 'status'
        || field === 'effective_date'
        || field === 'expiry_date'
        || field === 'term_unit'
        || field === 'term_value'
      ) {
        const dateErrors = validateDateConstraints(formData);
        next.effective_date = dateErrors.effective_date;
        next.expiry_date = dateErrors.expiry_date;
      }

      return next;
    });
  };

  const buildNextFormData = (
    source: Partial<Contract>,
    field: keyof Contract,
    value: unknown
  ): { next: Partial<Contract>; notice: string } => {
    const next = { ...source, [field]: value };
    let notice = '';

    if (field === 'project_id') {
      const project = projects.find((item) => String(item.id) === String(value));
      if (project) {
        const projectNotice = applyProjectSelection(next, project);
        notice = [
          `Đã liên kết dự án ${project.project_code} - ${project.project_name}.`,
          projectNotice,
        ].filter(Boolean).join(' ').trim();
      } else if (String(value || '').trim() === '') {
        const projectNotice = applyProjectSelection(next, null);
        notice = [
          'Đã gỡ liên kết dự án. Hợp đồng chuyển sang chế độ đầu kỳ.',
          projectNotice,
        ].filter(Boolean).join(' ').trim();
      }
    }

    if (field === 'project_type_code') {
      const projectNotice = applyProjectTypeSelection(next, value);
      if (projectNotice) {
        notice = [notice, projectNotice].filter(Boolean).join(' ').trim();
      }
    }

    if (field === 'status') {
      const normalizedStatus = String(value || '').trim().toUpperCase();
      if (normalizedStatus === 'SIGNED' && !String(next.sign_date || '').trim()) {
        next.sign_date = todayIsoDate();
        notice = 'Đã tự động điền Ngày ký là hôm nay vì trạng thái chuyển sang Đã ký.';
      }
    }

    if (field === 'term_unit') {
      const normalizedTermUnit = String(value || '').trim().toUpperCase();
      if (normalizedTermUnit !== 'MONTH' && normalizedTermUnit !== 'DAY') {
        next.term_value = null;
      }
    }

    if (field === 'value') {
      next.value = parseCurrency(value as string | number);
    }

    return { next, notice };
  };

  const applyNextFormState = (field: keyof Contract, next: Partial<Contract>, notice: string) => {
    setFormData(next);
    if (field === 'project_id' && !fixedSourceMode) {
      setContractSourceMode(String(next.project_id || '').trim() !== '' ? 'PROJECT' : 'INITIAL');
    }
    setInlineNotice(notice);

    const inlineValidateFields: Array<keyof Contract> = [
      'signer_user_id',
      'customer_id',
      'project_id',
      'project_type_code',
      'payment_cycle',
      'value',
      'status',
      'term_unit',
      'term_value',
      'effective_date',
      'expiry_date',
      'sign_date',
    ];
    if (inlineValidateFields.includes(field)) {
      const dateErrors = validateDateConstraints(next);
      const nextSourceMode = field === 'project_id' && !fixedSourceMode
        ? (String(next.project_id || '').trim() !== '' ? 'PROJECT' : contractSourceMode)
        : resolveValidationSourceMode();
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, next, nextSourceMode),
        signer_user_id: validateField('signer_user_id', next, nextSourceMode),
        customer_id: validateField('customer_id', next, nextSourceMode),
        project_id: validateField('project_id', next, nextSourceMode),
        project_type_code: validateField('project_type_code', next, nextSourceMode),
        value: validateField('value', next, nextSourceMode),
        effective_date: dateErrors.effective_date,
        expiry_date: dateErrors.expiry_date,
      }));
      return;
    }

    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleChange = (field: keyof Contract, value: unknown) => {
    const { next, notice } = buildNextFormData(formData, field, value);
    applyNextFormState(field, next, notice);
  };

  const handleContractSourceModeChange = (nextMode: ContractSourceMode) => {
    if (fixedSourceMode || areScheduleSourceFieldsLocked || nextMode === contractSourceMode) {
      return;
    }

    const next = {
      ...formData,
      customer_id: '',
      project_id: '',
      project_type_code: null,
    };
    setContractSourceMode(nextMode);
    setFormData(next);
    setInlineNotice(
      nextMode === 'INITIAL'
        ? 'Đã chuyển sang hợp đồng đầu kỳ. Vui lòng chọn lại khách hàng và loại dự án.'
        : 'Đã chuyển sang hợp đồng theo dự án. Vui lòng chọn dự án liên kết.'
    );
    setErrors((prev) => ({
      ...prev,
      customer_id: '',
      project_id: '',
      project_type_code: '',
    }));
  };

  const createEmptyDraftItem = (): ContractItem => ({
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    contract_id: contractId || 0,
    product_id: 0,
    product_package_id: null,
    product_name: null,
    unit: null,
    quantity: 1,
    unit_price: 0,
    vat_rate: null,
    vat_amount: null,
  });

  const handleAddDraftItem = () => {
    setDraftItems((prev) => [...prev, createEmptyDraftItem()]);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDraftItemChange = (index: number, field: keyof ContractItem, value: unknown) => {
    setDraftItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      const nextItem: ContractItem = {
        ...item,
        [field]: value,
      };

      if (field === 'quantity' || field === 'unit_price') {
        const { product } = resolveDraftItemSources(nextItem);
        const fallbackVatRate = resolveVatRateByBusiness(
          businessById.get(String(product?.domain_id || '')) || null
        );
        const vatRate = normalizeVatRate(nextItem.vat_rate) ?? fallbackVatRate;
        const amountBeforeVat = roundMoney(
          Math.max(0, Number(nextItem.quantity || 0) * Number(nextItem.unit_price || 0))
        );

        if (vatRate !== null) {
          nextItem.vat_rate = vatRate;
          nextItem.vat_amount = computeVatAmountByRate(amountBeforeVat, vatRate);
        } else {
          nextItem.vat_amount = normalizeVatAmount(nextItem.vat_amount);
        }
      }

      return nextItem;
    }));
  };

  const handleDraftItemVatState = (index: number, vatRate: number | null, vatAmount: number | null) => {
    setDraftItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      return {
        ...item,
        vat_rate: vatRate,
        vat_amount: vatAmount,
      };
    }));
  };

  const handleDraftProductChange = (index: number, nextProductId: string) => {
    const parsedCatalog = parseContractItemCatalogValue(nextProductId);
    setDraftItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) {
        return item;
      }

      if (!parsedCatalog.id) {
        return {
          ...item,
          product_id: 0,
          product_package_id: null,
          product_code: null,
          product_name: null,
          unit: null,
          unit_price: 0,
          vat_rate: null,
          vat_amount: null,
        };
      }

      const currentUnitPrice = Number(item.unit_price || 0);
      if (parsedCatalog.kind === 'package') {
        const productPackage = packageById.get(parsedCatalog.id) || null;
        if (!productPackage) {
          return item;
        }

        const productId = String(productPackage.product_id ?? '').trim();
        const product = productById.get(productId) || null;
        const defaultVatRate = resolveVatRateByBusiness(
          businessById.get(String(product?.domain_id || '')) || null
        );
        const nextUnitPrice = currentUnitPrice === 0 && Number(productPackage.standard_price || 0) > 0
          ? Number(productPackage.standard_price || 0)
          : currentUnitPrice;
        const amountBeforeVat = roundMoney(
          Math.max(0, Number(item.quantity || 0) * Number(nextUnitPrice || 0))
        );

        return {
          ...item,
          product_id: productId,
          product_package_id: parsedCatalog.id,
          product_code: productPackage.package_code || product?.product_code || null,
          product_name:
            normalizeSnapshotText(productPackage.package_name)
            ?? normalizeSnapshotText(productPackage.product_name)
            ?? normalizeSnapshotText(product?.product_name),
          unit: normalizeSnapshotText(productPackage.unit) ?? normalizeSnapshotText(product?.unit),
          unit_price: nextUnitPrice,
          vat_rate: defaultVatRate,
          vat_amount: computeVatAmountByRate(amountBeforeVat, defaultVatRate),
        };
      }

      const product = productById.get(parsedCatalog.id) || null;
      if (!product) {
        return item;
      }

      const defaultVatRate = resolveVatRateByBusiness(
        businessById.get(String(product?.domain_id || '')) || null
      );
      const nextUnitPrice = currentUnitPrice === 0 && Number(product?.standard_price || 0) > 0
        ? Number(product?.standard_price || 0)
        : currentUnitPrice;
      const amountBeforeVat = roundMoney(
        Math.max(0, Number(item.quantity || 0) * Number(nextUnitPrice || 0))
      );

      return {
        ...item,
        product_id: parsedCatalog.id,
        product_package_id: null,
        product_code: product?.product_code || null,
        product_name: product?.product_name || null,
        unit: normalizeSnapshotText(product?.unit) ?? 'Gói',
        unit_price: nextUnitPrice,
        vat_rate: defaultVatRate,
        vat_amount: computeVatAmountByRate(amountBeforeVat, defaultVatRate),
      };
    }));
  };

  const handleDraftVatAmountChange = (index: number, rawValue: string) => {
    const currentItem = draftItems[index];
    const currentProduct = currentItem ? resolveDraftItemSources(currentItem).product : null;
    const fallbackVatRate = resolveVatRateByBusiness(
      businessById.get(String(currentProduct?.domain_id || '')) || null
    );
    const amountBeforeVat = roundMoney(
      Math.max(0, Number(currentItem?.quantity || 0) * Number(currentItem?.unit_price || 0))
    );
    const vatAmount = normalizeVatAmount(parseCurrency(rawValue));
    const nextVatRate = amountBeforeVat > 0 && vatAmount !== null
      ? normalizeVatRate((vatAmount / amountBeforeVat) * 100)
      : normalizeVatRate(currentItem?.vat_rate) ?? fallbackVatRate;

    handleDraftItemVatState(index, nextVatRate, vatAmount);
  };

  const handleImportProjectItems = (
    projectItems: ProjectItemMaster[],
    mergeMode: 'merge' | 'replace' = 'replace'
  ) => {
    if (!isItemsEditable) {
      return;
    }

    const importedItems: ContractItem[] = [];

    projectItems.forEach((sourceItem, index) => {
      const productIdToken = String(sourceItem?.product_id ?? '').trim();
      const productId = Number(productIdToken);
      if (!Number.isFinite(productId) || productId <= 0) {
        return;
      }

      const quantityRaw = Number(sourceItem?.quantity ?? 0);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPriceRaw = Number(sourceItem?.unit_price ?? 0);
      const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0
        ? unitPriceRaw
        : 0;
      const productPackageId = String(sourceItem?.product_package_id ?? '').trim();
      const productPackage = productPackageId ? packageById.get(productPackageId) || null : null;
      const product = productPackage
        ? productById.get(String(productPackage.product_id ?? '').trim()) || productById.get(productIdToken) || null
        : productById.get(productIdToken) || null;
      const amountBeforeVat = roundMoney(Math.max(0, quantity * unitPrice));
      const vatRate = resolveVatRateByBusiness(
        businessById.get(String(product?.domain_id || '')) || null
      );

      importedItems.push({
        id: `project-import-${Date.now().toString(36)}-${index}-${productIdToken}`,
        contract_id: contractId || 0,
        product_id: productIdToken,
        product_package_id: productPackageId || null,
        product_code: sourceItem?.product_code || productPackage?.package_code || product?.product_code || null,
        product_name:
          normalizeSnapshotText(sourceItem?.product_name)
          ?? normalizeSnapshotText(productPackage?.package_name)
          ?? normalizeSnapshotText(productPackage?.product_name)
          ?? normalizeSnapshotText(product?.product_name),
        unit:
          normalizeSnapshotText(sourceItem?.unit)
          ?? normalizeSnapshotText(productPackage?.unit)
          ?? normalizeSnapshotText(product?.unit),
        quantity,
        unit_price: roundMoney(unitPrice),
        vat_rate: vatRate,
        vat_amount: computeVatAmountByRate(amountBeforeVat, vatRate),
      });
    });

    if (importedItems.length === 0) {
      setInlineNotice('Dự án liên kết chưa có hạng mục hợp lệ để đưa vào hợp đồng.');
      return;
    }

    setDraftItems((prev) => {
      if (mergeMode === 'replace' || prev.length === 0) {
        return importedItems;
      }

      const existing = [...prev];

      importedItems.forEach((incoming) => {
        const incomingCatalogValue = resolveContractItemCatalogValue(incoming);
        const matchedIndex = existing.findIndex(
          (item) => resolveContractItemCatalogValue(item) === incomingCatalogValue
        );

        if (matchedIndex < 0) {
          existing.push(incoming);
          return;
        }

        const current = existing[matchedIndex];
        const newQuantity = Number(current.quantity || 0) + Number(incoming.quantity || 0);
        const currentUnitPrice = Number(current.unit_price || 0);
        const nextVatRate = normalizeVatRate(current.vat_rate) ?? normalizeVatRate(incoming.vat_rate);
        const nextAmountBeforeVat = roundMoney(Math.max(0, newQuantity * currentUnitPrice));

        existing[matchedIndex] = {
          ...current,
          product_id: current.product_id || incoming.product_id,
          product_package_id: current.product_package_id ?? incoming.product_package_id ?? null,
          product_code: normalizeSnapshotText(current.product_code) ?? normalizeSnapshotText(incoming.product_code),
          product_name: normalizeSnapshotText(current.product_name) ?? normalizeSnapshotText(incoming.product_name),
          unit: normalizeSnapshotText(incoming.unit) ?? normalizeSnapshotText(current.unit),
          quantity: newQuantity,
          unit_price: currentUnitPrice,
          vat_rate: nextVatRate,
          vat_amount: resolveEffectiveVatAmount(current.vat_amount, nextAmountBeforeVat, nextVatRate),
        };
      });

      return existing;
    });

    setInlineNotice(
      mergeMode === 'replace'
        ? `Đã thay thế toàn bộ bằng ${importedItems.length} hạng mục từ dự án.`
        : `Đã gộp ${importedItems.length} hạng mục từ dự án vào hợp đồng.`
    );
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const activeSourceMode = resolveValidationSourceMode();

    ([
      'contract_code',
      'contract_name',
      'signer_user_id',
      'customer_id',
      'project_id',
      'project_type_code',
      'payment_cycle',
      'value',
      'term_unit',
      'term_value',
    ] as Array<keyof Contract>).forEach((field) => {
      const errorMessage = validateField(field, formData, activeSourceMode);
      if (errorMessage) {
        nextErrors[field] = errorMessage;
      }
    });

    const dateErrors = validateDateConstraints(formData);
    if (dateErrors.effective_date) {
      nextErrors.effective_date = dateErrors.effective_date;
    }
    if (dateErrors.expiry_date) {
      nextErrors.expiry_date = dateErrors.expiry_date;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const normalizedTermUnit = String(formData.term_unit || '').trim().toUpperCase();
    const hasTermUnit = normalizedTermUnit === 'MONTH' || normalizedTermUnit === 'DAY';
    const normalizedTermValue = hasTermUnit && formData.term_value !== null && formData.term_value !== undefined
      ? Number(formData.term_value)
      : null;
    const normalizedDraftItems: ContractItem[] | undefined = isItemsEditable
      ? draftItems
          .filter((item) => Number(item.product_id || 0) > 0)
          .map((item) => {
            const { product, productPackage } = resolveDraftItemSources(item);
            const fallbackVatRate = resolveVatRateByBusiness(
              businessById.get(String(product?.domain_id || '')) || null
            );
            const normalizedVatRate = normalizeVatRate(item.vat_rate) ?? fallbackVatRate;
            const snapshotProductName =
              normalizeSnapshotText(item.product_name)
              ?? normalizeSnapshotText(productPackage?.package_name)
              ?? normalizeSnapshotText(productPackage?.product_name)
              ?? normalizeSnapshotText(product?.product_name);
            const snapshotUnit =
              normalizeSnapshotText(item.unit)
              ?? normalizeSnapshotText(productPackage?.unit)
              ?? normalizeSnapshotText(product?.unit);
            const normalizedProductPackageId = String(
              item.productPackageId ?? item.product_package_id ?? ''
            ).trim();
            const parsedProductPackageId = normalizedProductPackageId !== ''
              ? Number(normalizedProductPackageId)
              : null;

            return {
              product_id: Number(item.product_id),
              product_package_id:
                parsedProductPackageId !== null && Number.isFinite(parsedProductPackageId) && parsedProductPackageId > 0
                  ? parsedProductPackageId
                  : null,
              product_name: snapshotProductName,
              unit: snapshotUnit,
              quantity: Number(item.quantity || 0),
              unit_price: Number(item.unit_price || 0),
              vat_rate: normalizedVatRate,
              vat_amount: resolveEffectiveVatAmount(
                item.vat_amount,
                Number(item.quantity || 0) * Number(item.unit_price || 0),
                normalizedVatRate
              ),
            } as ContractItem;
          })
      : undefined;
    const activeSourceMode = resolveValidationSourceMode();
    const normalizedFormData: Partial<Contract> = activeSourceMode === 'PROJECT'
      ? {
          ...formData,
          project_type_code: null,
        }
      : {
          ...formData,
          project_id: null,
        };
    const payload: Partial<Contract> = {
      ...normalizedFormData,
      attachments: normalizedFormData.attachments,
      items: normalizedDraftItems,
      expiry_date_manual_override: expiryDateManualOverride,
    };

    if (areScheduleSourceFieldsLocked) {
      delete payload.customer_id;
      delete payload.project_id;
      delete payload.project_type_code;
      delete payload.payment_cycle;
      delete payload.value;
      delete payload.sign_date;
      delete payload.effective_date;
      delete payload.expiry_date;
      delete payload.term_unit;
      delete payload.term_value;
      delete payload.expiry_date_manual_override;
      delete payload.items;
    } else {
      payload.value = parseCurrency(normalizedFormData.value || 0);
      payload.term_unit = hasTermUnit ? (normalizedTermUnit as ContractTermUnit) : null;
      payload.term_value = Number.isFinite(normalizedTermValue) ? normalizedTermValue : null;
      payload.expiry_date_manual_override = expiryDateManualOverride;
      payload.items = normalizedDraftItems;
    }

    try {
      await Promise.resolve(
        onSave(payload)
      );
      setInlineNotice('');
    } catch (error) {
      setInlineNotice(error instanceof Error ? error.message : 'Không thể lưu hợp đồng. Vui lòng thử lại.');
    }
  };

  const handleExpiryDateChange = (value: string) => {
    setExpiryDateManualOverride(true);
    handleChange('expiry_date', value);
  };

  const handleRecalculateExpiryDate = () => {
    const recalculatedExpiry = resolveContractExpiryByTerm(formData);
    if (!recalculatedExpiry) {
      setInlineNotice('Không đủ dữ liệu để tính lại hạn. Vui lòng nhập Đơn vị thời hạn và Thời hạn hợp đồng hợp lệ.');
      return;
    }

    setExpiryDateManualOverride(false);
    setFormData((prev) => ({ ...prev, expiry_date: recalculatedExpiry }));
    setErrors((prev) => ({ ...prev, expiry_date: '', term_unit: '', term_value: '' }));
    setInlineNotice('Đã tính lại Ngày hết hiệu lực theo thời hạn hợp đồng.');
  };

  const handleToggleProjectItemsReference = () => {
    setIsProjectItemsReferenceOpen((prev) => !prev);
  };

  return {
    errors,
    inlineNotice,
    setInlineNotice,
    formData,
    contractSourceMode,
    draftItems,
    isProjectItemsReferenceOpen,
    expiryDateManualOverride,
    handleFieldBlur,
    handleChange,
    handleContractSourceModeChange,
    handleAddDraftItem,
    handleRemoveDraftItem,
    handleDraftItemChange,
    handleDraftProductChange,
    handleDraftVatAmountChange,
    handleImportProjectItems,
    handleExpiryDateChange,
    handleRecalculateExpiryDate,
    handleToggleProjectItemsReference,
    handleSave,
  };
};
