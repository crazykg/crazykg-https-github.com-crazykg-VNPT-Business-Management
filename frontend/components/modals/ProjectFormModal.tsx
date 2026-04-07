import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ContractSignerOption,
  Department,
  Employee,
  Customer,
  Product,
  Project,
  ProjectItem,
  ProjectItemMaster,
  ProjectRACI,
  ProjectTypeOption,
  ProcedureTemplate,
} from '../../types';
import {
  RACI_ROLES,
  PHASE_LABELS,
  PROJECT_PHASE_OPTIONS,
  PROJECT_SPECIAL_STATUSES,
  getDefaultProjectStatusForInvestmentMode,
  isProjectSpecialStatus,
} from '../../constants';
import { getEmployeeLabel } from '../../utils/employeeDisplay';
import { fetchProjectImplementationUnitOptions } from '../../services/api/projectApi';
import { fetchProcedureTemplates } from '../../services/v5Api';
import { resolveHealthcareFacilityType } from '../../utils/customerClassification';
import { ProjectRevenueSchedulePanel } from '../ProjectRevenueSchedulePanel';
import { ImportModal } from './ImportModal';
import {
  ProjectFormLayout,
  ProjectInfoTab,
  type ProjectFormActiveTab,
  type ProjectFormSaveNotice,
} from './ProjectFormSections';
import {
  executeProjectItemsImport,
  executeProjectRaciImport,
} from './projectImportHandlers';
import {
  downloadProjectItemImportTemplate,
  downloadProjectRaciImportTemplate,
  mergeImportedProjectItems,
  mergeImportedProjectRaci,
  normalizeProjectItemImportToken,
} from './projectImportUtils';
import type {
  ImportPayload,
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from './projectImportTypes';
import {
  ProjectItemsTab,
  ProjectRaciTab,
  type ProjectImportSummary,
} from './ProjectTabs';
import { QuotationPickerModal } from './QuotationPickerModal';
import type { SearchableSelectOption } from './selectPrimitives';
import {
  DATE_INPUT_MAX,
  DATE_INPUT_MIN,
  PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE,
  PROJECT_FORM_SUBMIT_TIMEOUT_MS,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatProjectAssignedDate,
  normalizeDateInputToIso,
  normalizeProjectInvestmentMode,
  normalizeProjectPaymentCycle,
  parseNumber,
  requiresProjectPaymentCycle,
  shiftIsoDateByDays,
  withProjectFormSubmitTimeout,
} from './projectFormUtils';

export interface ProjectFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Project | null;
  initialTab?: ProjectFormActiveTab;
  customers: Customer[];
  products: Product[];
  projectItems?: ProjectItemMaster[];
  employees: Employee[];
  departments: Department[];
  projectTypes?: ProjectTypeOption[];
  isCustomersLoading?: boolean;
  isProductsLoading?: boolean;
  isEmployeesLoading?: boolean;
  isDepartmentsLoading?: boolean;
  isProjectTypesLoading?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Project>) => Promise<void> | void;
  onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  onImportProjectItemsBatch?: (
    groups: ProjectItemImportBatchGroup[]
  ) => Promise<ProjectItemImportBatchResult>;
  onImportProjectRaciBatch?: (
    groups: ProjectRaciImportBatchGroup[]
  ) => Promise<ProjectRaciImportBatchResult>;
  onViewProcedure?: (project: Project) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  type,
  data,
  initialTab = 'info',
  customers,
  products,
  projectItems = [],
  employees,
  departments,
  projectTypes = [],
  isCustomersLoading = false,
  isProductsLoading = false,
  isEmployeesLoading = false,
  isDepartmentsLoading = false,
  isProjectTypesLoading = false,
  onClose,
  onSave,
  onNotify,
  onImportProjectItemsBatch,
  onImportProjectRaciBatch,
  onViewProcedure,
}: ProjectFormModalProps) => {
  const getLocalIsoDate = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  };
  const todayIsoDate = getLocalIsoDate();
  const isPersistedProject = type === 'EDIT' && Boolean(data?.id);
  const todayDisplayDate = new Date().toLocaleDateString('vi-VN');
  const statusReasonFieldId = 'project-status-reason';
  const getStatusReasonLabel = (status: unknown) =>
    String(status || '').trim().toUpperCase() === 'HUY'
      ? 'Lý do huỷ'
      : 'Lý do tạm ngưng';

  const normalizeProjectItemRows = (rows: unknown): ProjectItem[] | undefined => {
    if (!Array.isArray(rows)) {
      return undefined;
    }

    return rows.map((row, index) => {
      const source = (row || {}) as Partial<ProjectItem> & Record<string, unknown>;
      const normalizedProductId = String(
        source.productId ?? source.product_id ?? ''
      ).trim();
      const quantityRaw = Number(source.quantity ?? 1);
      const quantity =
        Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const unitPriceRaw = Number(source.unitPrice ?? source.unit_price ?? 0);
      const unitPrice =
        Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? unitPriceRaw : 0;
      const discountPercent = source.discountPercent ?? 0;
      const discountAmount = source.discountAmount ?? 0;
      const lineTotalRaw = Number(
        source.lineTotal ?? source.line_total ?? quantity * unitPrice
      );
      const lineTotal =
        Number.isFinite(lineTotalRaw) ? lineTotalRaw : quantity * unitPrice;

      return {
        id: String(source.id ?? `ITEM_${Date.now()}_${index}`),
        productId: normalizedProductId,
        product_id: normalizedProductId || null,
        quantity,
        unitPrice,
        unit_price: unitPrice,
        discountPercent,
        discountAmount,
        lineTotal,
        line_total: lineTotal,
        discountMode: source.discountMode,
      };
    });
  };

  const normalizeProjectRaciRows = (rows: unknown): ProjectRACI[] | undefined => {
    if (!Array.isArray(rows)) {
      return undefined;
    }

    return rows.map((row, index) => {
      const source = (row || {}) as Partial<ProjectRACI> &
        Record<string, unknown>;
      const normalizedRole = String(source.roleType ?? source.raci_role ?? 'R')
        .trim()
        .toUpperCase();
      const roleType: ProjectRACI['roleType'] = ['R', 'A', 'C', 'I'].includes(
        normalizedRole
      )
        ? (normalizedRole as ProjectRACI['roleType'])
        : 'R';
      const normalizedUserId = String(
        source.userId ?? source.user_id ?? ''
      ).trim();
      const assignedDate =
        formatProjectAssignedDate(source.assignedDate ?? source.assigned_date) ||
        todayDisplayDate;

      return {
        id: String(source.id ?? `RACI_${Date.now()}_${index}`),
        userId: normalizedUserId,
        user_id: normalizedUserId || null,
        roleType,
        raci_role: roleType,
        assignedDate,
        user_code: String(source.user_code ?? '').trim() || null,
        username: String(source.username ?? '').trim() || null,
        full_name: String(source.full_name ?? '').trim() || null,
      };
    });
  };

  const buildProjectFormState = useCallback(
    (projectData?: Project | null): Partial<Project> => ({
      project_code: projectData?.project_code || '',
      project_name: projectData?.project_name || '',
      customer_id: projectData?.customer_id || '',
      implementation_user_id: projectData?.implementation_user_id || '',
      implementation_user_code: projectData?.implementation_user_code || null,
      implementation_full_name: projectData?.implementation_full_name || null,
      implementation_unit_code: projectData?.implementation_unit_code || null,
      implementation_unit_name: projectData?.implementation_unit_name || null,
      investment_mode:
        normalizeProjectInvestmentMode(projectData?.investment_mode) || 'DAU_TU',
      payment_cycle: normalizeProjectPaymentCycle(projectData?.payment_cycle),
      start_date: projectData?.start_date || (type === 'ADD' ? todayIsoDate : ''),
      expected_end_date: projectData?.expected_end_date || '',
      actual_end_date:
        projectData?.actual_end_date || (type === 'ADD' ? todayIsoDate : ''),
      status:
        projectData?.status ||
        getDefaultProjectStatusForInvestmentMode(projectData?.investment_mode),
      status_reason: projectData?.status_reason || '',
      items: normalizeProjectItemRows(projectData?.items),
      raci: normalizeProjectRaciRows(projectData?.raci),
    }),
    [todayIsoDate, type]
  );

  const [formData, setFormData] = useState<Partial<Project>>(() =>
    buildProjectFormState(data)
  );
  const isSpecialStatusSelected = isProjectSpecialStatus(
    String(formData.status || '')
  );

  const [activeTab, setActiveTab] =
    useState<ProjectFormActiveTab>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveNotice, setSaveNotice] =
    useState<ProjectFormSaveNotice>({ status: 'idle' });
  const isMountedRef = useRef(true);
  const submitWatchdogRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const submitAttemptRef = useRef(0);
  const submitTimedOutAttemptRef = useRef<number | null>(null);
  const itemsDirtyRef = useRef(type === 'ADD');
  const raciDirtyRef = useRef(type === 'ADD');
  const [showItemImportMenu, setShowItemImportMenu] = useState(false);
  const [showQuotationPicker, setShowQuotationPicker] = useState(false);
  const [showItemImportModal, setShowItemImportModal] = useState(false);
  const [isItemImportSaving, setIsItemImportSaving] = useState(false);
  const [itemImportLoadingText, setItemImportLoadingText] = useState('');
  const [itemImportSummary, setItemImportSummary] =
    useState<ProjectImportSummary | null>(null);
  const itemImportInFlightRef = useRef(false);
  const itemImportMenuRef = useRef<HTMLDivElement>(null);
  const [showRaciImportMenu, setShowRaciImportMenu] = useState(false);
  const [showRaciImportModal, setShowRaciImportModal] = useState(false);
  const [isRaciImportSaving, setIsRaciImportSaving] = useState(false);
  const [raciImportLoadingText, setRaciImportLoadingText] = useState('');
  const [raciImportSummary, setRaciImportSummary] =
    useState<ProjectImportSummary | null>(null);
  const raciImportInFlightRef = useRef(false);
  const raciImportMenuRef = useRef<HTMLDivElement>(null);
  const [duplicateRaciIds, setDuplicateRaciIds] = useState<Set<string>>(new Set());

  const [procedureTemplates, setProcedureTemplates] = useState<
    ProcedureTemplate[]
  >([]);
  const [implementationUnitOptions, setImplementationUnitOptions] = useState<
    ContractSignerOption[]
  >([]);
  const [isImplementationUnitOptionsLoading, setIsImplementationUnitOptionsLoading] =
    useState(false);
  const [implementationUnitOptionsError, setImplementationUnitOptionsError] =
    useState('');

  useEffect(() => {
    fetchProcedureTemplates()
      .then((tmpl) => setProcedureTemplates(tmpl.filter((t) => t.is_active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsImplementationUnitOptionsLoading(true);
    setImplementationUnitOptionsError('');

    void fetchProjectImplementationUnitOptions()
      .then((rows) => {
        if (!isMounted) {
          return;
        }

        setImplementationUnitOptions(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setImplementationUnitOptions([]);
        setImplementationUnitOptionsError(
          error instanceof Error
            ? error.message
            : 'Không tải được danh sách đơn vị triển khai.'
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsImplementationUnitOptionsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const statusOptions = useMemo(() => {
    const opportunityOption = { value: 'CO_HOI', label: 'Cơ hội' };
    const tpl = procedureTemplates.find(
      (t) => t.template_code === formData.investment_mode
    );
    const phaseOptions = tpl?.phases?.length
      ? tpl.phases.map((ph) => ({ value: ph, label: PHASE_LABELS[ph] ?? ph }))
      : PROJECT_PHASE_OPTIONS;

    return [
      opportunityOption,
      ...phaseOptions,
      ...PROJECT_SPECIAL_STATUSES,
    ].filter(
      (option, index, items) =>
        items.findIndex((candidate) => candidate.value === option.value) ===
        index
    );
  }, [formData.investment_mode, procedureTemplates]);

  const projectImplementationOptions = useMemo(() => {
    const fallbackImplementationUserId = data?.implementation_user_id;
    const fallbackOption = fallbackImplementationUserId
      ? {
          id: fallbackImplementationUserId,
          user_code: data?.implementation_user_code || null,
          full_name: data?.implementation_full_name || null,
          department_id: data?.department_id || 0,
          dept_code: data?.implementation_unit_code || null,
          dept_name: data?.implementation_unit_name || null,
        }
      : null;

    if (
      fallbackOption
      && !implementationUnitOptions.some(
        (item) => String(item.id) === String(fallbackOption.id)
      )
    ) {
      return [...implementationUnitOptions, fallbackOption];
    }

    return implementationUnitOptions;
  }, [data, implementationUnitOptions]);

  const implementationUnitSelectOptions = useMemo(
    () => [
      { value: '', label: 'Chọn đơn vị triển khai' },
      ...projectImplementationOptions.map((option) => {
        const userCode = String(option.user_code || '').trim();
        const fullName = String(option.full_name || '').trim();
        const deptCode = String(option.dept_code || '').trim();
        const deptName = String(option.dept_name || '').trim();

        return {
          value: option.id,
          label:
            [userCode, fullName].filter(Boolean).join(' - ')
            || fullName
            || `Nhân sự #${option.id}`,
          searchText: [userCode, fullName, deptCode, deptName]
            .filter(Boolean)
            .join(' ')
            .trim(),
        };
      }),
    ],
    [projectImplementationOptions]
  );

  const selectedImplementationUnit = useMemo(() => {
    const implementationUserId = String(formData.implementation_user_id || '').trim();
    if (!implementationUserId) {
      return null;
    }

    return (
      projectImplementationOptions.find(
        (option) => String(option.id) === implementationUserId
      ) || null
    );
  }, [formData.implementation_user_id, projectImplementationOptions]);

  const implementationUnitHelpText = useMemo(() => {
    if (!selectedImplementationUnit) {
      return null;
    }

    const segments = [
      selectedImplementationUnit.full_name
        ? `Người triển khai: ${selectedImplementationUnit.full_name}`
        : null,
      selectedImplementationUnit.dept_code
        ? `Mã đơn vị: ${selectedImplementationUnit.dept_code}`
        : null,
      selectedImplementationUnit.dept_name
        ? `Đơn vị: ${selectedImplementationUnit.dept_name}`
        : null,
    ].filter(Boolean);

    return segments.length > 0 ? segments.join(' | ') : null;
  }, [selectedImplementationUnit]);

  const isCustomerOptionsLoading = isCustomersLoading && customers.length === 0;
  const isProjectProductOptionsLoading =
    isProductsLoading && products.length === 0;
  const isProjectEmployeeOptionsLoading =
    isEmployeesLoading && employees.length === 0;
  const isProjectTypeOptionsLoading =
    isProjectTypesLoading && projectTypes.length === 0;
  const isPaymentCycleRequired = requiresProjectPaymentCycle(
    formData.investment_mode
  );

  useEffect(() => {
    if (statusOptions.length && !statusOptions.find((o) => o.value === formData.status)) {
      setFormData((prev) => ({
        ...prev,
        status: statusOptions[0]?.value ?? '',
        status_reason: '',
      }));
    }
  }, [formData.status, statusOptions]);

  useEffect(() => {
    setFormData(buildProjectFormState(data));
    setErrors({});
    itemsDirtyRef.current = type === 'ADD';
    raciDirtyRef.current = type === 'ADD';
  }, [buildProjectFormState, data, type]);

  useEffect(() => {
    setSaveNotice({ status: 'idle' });
  }, [type, data?.id]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      if (submitWatchdogRef.current !== null) {
        globalThis.clearTimeout(submitWatchdogRef.current);
        submitWatchdogRef.current = null;
      }
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isProjectSpecialStatus(String(formData.status || ''))) {
      return;
    }

    if (String(formData.status_reason || '').trim() === '') {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      status_reason: '',
    }));
  }, [formData.status, formData.status_reason]);

  useEffect(() => {
    if (!showItemImportMenu) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!itemImportMenuRef.current) {
        return;
      }
      if (!itemImportMenuRef.current.contains(event.target as Node)) {
        setShowItemImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showItemImportMenu]);

  useEffect(() => {
    if (!showRaciImportMenu) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!raciImportMenuRef.current) {
        return;
      }
      if (!raciImportMenuRef.current.contains(event.target as Node)) {
        setShowRaciImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRaciImportMenu]);

  useEffect(() => {
    if (activeTab !== 'items') {
      setShowItemImportMenu(false);
      setShowItemImportModal(false);
    }
    if (activeTab !== 'raci') {
      setShowRaciImportMenu(false);
      setShowRaciImportModal(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, type, data?.id]);

  useEffect(() => {
    if (!isPersistedProject && activeTab !== 'info') {
      setActiveTab('info');
    }
  }, [activeTab, isPersistedProject]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (customer) => String(customer.id) === String(formData.customer_id || '').trim()
      ) || null,
    [customers, formData.customer_id]
  );

  const shouldHideHmisAndHsskProjectProducts = useMemo(() => {
    if (!selectedCustomer) {
      return false;
    }

    const facilityType = resolveHealthcareFacilityType(selectedCustomer);
    if (facilityType === 'MEDICAL_CENTER') {
      return true;
    }

    if (facilityType === 'PUBLIC_HOSPITAL' || facilityType === 'PRIVATE_HOSPITAL') {
      const bedCapacity = Number(selectedCustomer.bed_capacity ?? 0);
      return Number.isFinite(bedCapacity) && bedCapacity > 0;
    }

    return false;
  }, [selectedCustomer]);

  const shouldHideProjectProductForSelectedCustomer = useCallback(
    (product: Product) => {
      if (!shouldHideHmisAndHsskProjectProducts) {
        return false;
      }

      const productCode = String(product.product_code || '').trim().toUpperCase();
      const productName = String(product.product_name || '').trim().toUpperCase();
      const packageName = String(product.package_name || '').trim().toUpperCase();

      const isHsskProduct = /^HSSK(?:[_-]|$)/.test(productCode);
      const isHmisProduct =
        productCode.includes('HMIS') ||
        productName.includes('HMIS') ||
        packageName.includes('HMIS');

      return isHmisProduct || isHsskProduct;
    },
    [shouldHideHmisAndHsskProjectProducts]
  );

  const productLookupMap = useMemo(() => {
    const lookup = new Map<string, Product>();
    const register = (rawKey: unknown, product: Product) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key || lookup.has(key)) {
        return;
      }
      lookup.set(key, product);
    };

    (products || []).forEach((product) => {
      register(product.id, product);
      register(product.product_code, product);
      register(product.product_name, product);
    });

    return lookup;
  }, [products]);

  const productById = useMemo(() => {
    const lookup = new Map<string, Product>();
    (products || []).forEach((product) => {
      const key = String(product.id ?? '').trim();
      if (key) {
        lookup.set(key, product);
      }
    });
    return lookup;
  }, [products]);

  const projectProductPriceFormatter = useMemo(
    () => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }),
    []
  );

  const projectProductDropdownGridClassName =
    'grid grid-cols-[140px_minmax(0,1fr)_96px_128px] items-start gap-3';

  const projectProductSelectOptions = useMemo(
    () => [
      ...(products || [])
        .filter((product) => !shouldHideProjectProductForSelectedCustomer(product))
        .map((product) => {
          const standardPrice = Number(product.standard_price || 0);
          const rawPrice = Number.isFinite(standardPrice) ? String(standardPrice) : '';
          const formattedPrice = Number.isFinite(standardPrice)
            ? projectProductPriceFormatter.format(standardPrice)
            : '';

          return {
            value: String(product.id ?? ''),
            label: `${product.product_code} - ${product.product_name}`,
            searchText: [
              product.product_code,
              product.product_name,
              product.unit,
              rawPrice,
              formattedPrice,
            ]
              .filter(Boolean)
              .join(' '),
          };
        }),
    ],
    [
      products,
      projectProductPriceFormatter,
      shouldHideProjectProductForSelectedCustomer,
    ]
  );

  const renderProjectProductDropdownHeader = useMemo(
    () => (
      <div
        className={`${projectProductDropdownGridClassName} px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500`}
      >
        <span>Mã SP</span>
        <span>Tên SP</span>
        <span className="text-center">ĐVT</span>
        <span className="text-right">Đơn giá</span>
      </div>
    ),
    [projectProductDropdownGridClassName]
  );

  const renderProjectProductOption = useCallback(
    (
      option: SearchableSelectOption,
      state: { isSelected: boolean; isHighlighted: boolean }
    ) => {
      const product = productById.get(String(option.value ?? '').trim());
      if (!product) {
        return (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
            {state.isSelected ? (
              <span className="material-symbols-outlined text-sm flex-shrink-0">
                check
              </span>
            ) : null}
          </div>
        );
      }

      return (
        <div className={`${projectProductDropdownGridClassName} w-full`}>
          <span
            className="truncate font-medium text-left text-slate-700"
            title={product.product_code}
          >
            {product.product_code}
          </span>
          <span
            className="truncate text-left text-slate-900"
            title={product.product_name}
          >
            {product.product_name}
          </span>
          <span
            className="truncate text-center text-slate-600"
            title={product.unit || '—'}
          >
            {product.unit || '—'}
          </span>
          <span
            className="truncate text-right font-medium text-slate-700"
            title={projectProductPriceFormatter.format(
              Number(product.standard_price || 0)
            )}
          >
            {projectProductPriceFormatter.format(Number(product.standard_price || 0))}
          </span>
        </div>
      );
    },
    [productById, projectProductDropdownGridClassName, projectProductPriceFormatter]
  );

  const employeeLookupMap = useMemo(() => {
    const lookup = new Map<string, Employee>();
    const register = (rawKey: unknown, employee: Employee) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key || lookup.has(key)) {
        return;
      }
      lookup.set(key, employee);
    };

    (employees || []).forEach((employee) => {
      register(employee.id, employee);
      register(employee.user_code, employee);
      register(employee.employee_code, employee);
      register(employee.username, employee);
      register(employee.full_name, employee);
    });

    return lookup;
  }, [employees]);

  const employeeOptions = useMemo(() => {
    const collator = new Intl.Collator('vi', {
      sensitivity: 'base',
      numeric: true,
    });
    const sortedEmployees = [...(employees || [])].sort((left, right) =>
      collator.compare(getEmployeeLabel(left), getEmployeeLabel(right))
    );

    return [
      {
        value: '',
        label: sortedEmployees.length > 0 ? 'Chọn nhân viên' : 'Chưa có dữ liệu nhân sự',
      },
      ...sortedEmployees.map((employee) => ({
        value: String(employee.id ?? ''),
        label: getEmployeeLabel(employee),
      })),
    ];
  }, [employees]);

  const projectItemLookupByCode = useMemo(() => {
    const lookup = new Map<string, ProjectItemMaster[]>();
    const register = (rawKey: unknown, item: ProjectItemMaster) => {
      const key = normalizeProjectItemImportToken(rawKey);
      if (!key) {
        return;
      }
      const bucket = lookup.get(key) || [];
      const itemId = String(item.id ?? '');
      if (!bucket.some((candidate) => String(candidate.id ?? '') === itemId)) {
        bucket.push(item);
      }
      lookup.set(key, bucket);
    };

    (projectItems || []).forEach((item) => {
      const source = item as unknown as Record<string, unknown>;
      register(item.id, item);
      register(source.project_item_code, item);
      register(source.item_code, item);
      register(source.code, item);
      register(source.project_item_name, item);
      register(source.item_name, item);
      register(item.display_name, item);
    });

    return lookup;
  }, [projectItems]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const effectiveProjectCode = String(
      formData.project_code || data?.project_code || ''
    ).trim();
    const effectiveProjectName = String(
      formData.project_name || data?.project_name || ''
    ).trim();
    const effectiveStartDate = String(
      formData.start_date || data?.start_date || ''
    ).trim();
    const effectiveExpectedEndDate = String(formData.expected_end_date || '').trim();
    const effectiveActualEndDate = String(formData.actual_end_date || '').trim();
    const effectiveStatus = String(formData.status || '').trim().toUpperCase();
    const effectiveStatusReason = String(formData.status_reason || '').trim();
    const effectiveInvestmentMode =
      normalizeProjectInvestmentMode(formData.investment_mode) || 'DAU_TU';
    const effectivePaymentCycle = normalizeProjectPaymentCycle(
      formData.payment_cycle
    );

    if (!effectiveProjectCode) newErrors.project_code = 'Mã DA là bắt buộc';
    if (!effectiveProjectName) newErrors.project_name = 'Tên dự án là bắt buộc';
    if (!effectiveStartDate) newErrors.start_date = 'Ngày bắt đầu là bắt buộc';
    if (requiresProjectPaymentCycle(effectiveInvestmentMode) && !effectivePaymentCycle) {
      newErrors.payment_cycle =
        'Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.';
    }
    if (isProjectSpecialStatus(effectiveStatus) && !effectiveStatusReason) {
      newErrors.status_reason = `${getStatusReasonLabel(
        effectiveStatus
      )} là bắt buộc`;
    }
    if (
      effectiveStartDate &&
      effectiveExpectedEndDate &&
      effectiveStartDate >= effectiveExpectedEndDate
    ) {
      newErrors.start_date = 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc dự án.';
      newErrors.expected_end_date =
        'Ngày kết thúc dự án phải lớn hơn ngày bắt đầu.';
    }
    if (
      effectiveExpectedEndDate &&
      effectiveActualEndDate &&
      effectiveExpectedEndDate > effectiveActualEndDate
    ) {
      newErrors.expected_end_date =
        'Ngày kết thúc dự án phải nhỏ hơn hoặc bằng ngày kết thúc thực tế.';
      newErrors.actual_end_date =
        'Ngày kết thúc thực tế phải lớn hơn hoặc bằng ngày kết thúc dự án.';
    }

    const seenProducts = new Set<string>();
    const hasDuplicateProducts = (formData.items || []).some((item) => {
      const productKey = String(item?.productId ?? item?.product_id ?? '').trim();
      if (!productKey) {
        return false;
      }
      if (seenProducts.has(productKey)) {
        return true;
      }
      seenProducts.add(productKey);
      return false;
    });

    if (hasDuplicateProducts) {
      newErrors.items = 'Không được chọn trùng sản phẩm trong cùng một dự án.';
    }

    const seenRaci = new Map<string, string>();
    const conflictingRaciIds = new Set<string>();
    for (const r of formData.raci || []) {
      const uid = String(r.userId ?? '').trim();
      const role = String(r.roleType ?? '').trim().toUpperCase();
      if (!uid || !role) continue;
      const key = `${uid}|${role}`;
      if (seenRaci.has(key)) {
        conflictingRaciIds.add(r.id);
        conflictingRaciIds.add(seenRaci.get(key)!);
      } else {
        seenRaci.set(key, r.id);
      }
    }
    if (conflictingRaciIds.size > 0) {
      newErrors.raci = 'Có nhân sự được gán trùng vai trò RACI. Vui lòng kiểm tra lại.';
      setDuplicateRaciIds(conflictingRaciIds);
    } else {
      setDuplicateRaciIds(new Set());
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid && newErrors.raci) {
      if (activeTab !== 'raci') setActiveTab('raci');
      onNotify?.('error', 'Vai trò RACI bị trùng', newErrors.raci);
    } else if (!isValid && newErrors.items && activeTab !== 'items') {
      setActiveTab('items');
      onNotify?.('error', 'Sản phẩm bị trùng', newErrors.items);
    } else if (!isValid && activeTab !== 'info') {
      setActiveTab('info');
      onNotify?.(
        'error',
        'Thiếu thông tin dự án',
        'Vui lòng kiểm tra lại Thông tin chung trước khi cập nhật.'
      );
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (isSubmitting || !validate()) {
      return;
    }

    const normalizedStartDate =
      normalizeDateInputToIso(
        String(formData.start_date || data?.start_date || '').trim()
      ) ?? String(formData.start_date || data?.start_date || '').trim();
    const normalizedExpectedEndDate = normalizeDateInputToIso(
      String(formData.expected_end_date || '').trim()
    );
    const normalizedActualEndDate = normalizeDateInputToIso(
      String(formData.actual_end_date || '').trim()
    );
    const shouldSyncItems = type === 'ADD' || itemsDirtyRef.current;
    const shouldSyncRaci = type === 'ADD' || raciDirtyRef.current;
    const normalizedStatus = String(formData.status || '').trim().toUpperCase();
    const normalizedInvestmentMode =
      normalizeProjectInvestmentMode(formData.investment_mode) || 'DAU_TU';
    const normalizedPaymentCycle = requiresProjectPaymentCycle(
      normalizedInvestmentMode
    )
      ? normalizeProjectPaymentCycle(formData.payment_cycle)
      : null;
    const submitAttemptId = submitAttemptRef.current + 1;
    submitAttemptRef.current = submitAttemptId;
    submitTimedOutAttemptRef.current = null;
    if (submitWatchdogRef.current !== null) {
      globalThis.clearTimeout(submitWatchdogRef.current);
    }

    setIsSubmitting(true);
    setSaveNotice({ status: 'idle' });
    submitWatchdogRef.current = globalThis.setTimeout(() => {
      if (!isMountedRef.current || submitAttemptRef.current !== submitAttemptId) {
        return;
      }

      submitTimedOutAttemptRef.current = submitAttemptId;
      setIsSubmitting(false);
      setSaveNotice({
        status: 'error',
        message: PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE,
        timestamp: Date.now(),
      });
      onNotify?.('error', 'Lưu thất bại', PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE);
    }, PROJECT_FORM_SUBMIT_TIMEOUT_MS + 200);
    try {
      await withProjectFormSubmitTimeout(
        onSave({
          ...formData,
          project_code: String(
            formData.project_code || data?.project_code || ''
          ).trim(),
          project_name: String(
            formData.project_name || data?.project_name || ''
          ).trim(),
          investment_mode: normalizedInvestmentMode,
          start_date: normalizedStartDate,
          expected_end_date: normalizedExpectedEndDate,
          actual_end_date: normalizedActualEndDate,
          status: normalizedStatus,
          status_reason: isProjectSpecialStatus(String(formData.status || ''))
            ? String(formData.status_reason || '').trim()
            : null,
          payment_cycle: normalizedPaymentCycle,
          items: shouldSyncItems ? formData.items : undefined,
          raci: shouldSyncRaci ? formData.raci : undefined,
        })
      );
      if (!isMountedRef.current || submitTimedOutAttemptRef.current === submitAttemptId) {
        return;
      }
      itemsDirtyRef.current = false;
      raciDirtyRef.current = false;
      setSaveNotice({
        status: 'success',
        message:
          type === 'ADD'
            ? 'Đã lưu dự án. Modal vẫn mở để tiếp tục thao tác.'
            : 'Đã cập nhật dự án. Modal vẫn mở để tiếp tục thao tác.',
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message === PROJECT_FORM_SUBMIT_TIMEOUT_MESSAGE &&
        submitTimedOutAttemptRef.current !== submitAttemptId
      ) {
        onNotify?.('error', 'Lưu thất bại', message);
      }
      if (isMountedRef.current && submitTimedOutAttemptRef.current !== submitAttemptId) {
        setSaveNotice({
          status: 'error',
          message: message || 'Không thể cập nhật dự án lúc này. Vui lòng thử lại.',
          timestamp: Date.now(),
        });
      }
    } finally {
      if (submitWatchdogRef.current !== null) {
        globalThis.clearTimeout(submitWatchdogRef.current);
        submitWatchdogRef.current = null;
      }
      if (isMountedRef.current && submitTimedOutAttemptRef.current !== submitAttemptId) {
        setIsSubmitting(false);
      }
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (field === 'status') {
        const nextStatus = String(value || '').trim().toUpperCase();
        return {
          ...prev,
          status: nextStatus,
          status_reason: isProjectSpecialStatus(nextStatus)
            ? prev.status_reason || ''
            : '',
        };
      }

      if (field === 'investment_mode') {
        const nextInvestmentMode =
          normalizeProjectInvestmentMode(value) || 'DAU_TU';
        return {
          ...prev,
          investment_mode: nextInvestmentMode,
          payment_cycle: requiresProjectPaymentCycle(nextInvestmentMode)
            ? normalizeProjectPaymentCycle(prev.payment_cycle)
            : null,
        };
      }

      if (field === 'payment_cycle') {
        return {
          ...prev,
          payment_cycle: normalizeProjectPaymentCycle(value),
        };
      }

      return { ...prev, [field]: value };
    });

    if (
      errors[field] ||
      (field === 'status' && errors.status_reason) ||
      ((field === 'investment_mode' || field === 'payment_cycle') &&
        errors.payment_cycle)
    ) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
        ...(field === 'status' ? { status_reason: '' } : {}),
        ...((field === 'investment_mode' || field === 'payment_cycle')
          ? { payment_cycle: '' }
          : {}),
      }));
    }
  };

  const handleDownloadProjectItemTemplate = () => {
    setShowItemImportMenu(false);
    downloadProjectItemImportTemplate();
  };

  const handleDownloadProjectRaciTemplate = () => {
    setShowRaciImportMenu(false);
    downloadProjectRaciImportTemplate();
  };

  const triggerProjectItemImport = () => {
    if (!isPersistedProject) {
      onNotify?.(
        'error',
        'Dự án chưa lưu',
        'Vui lòng lưu dự án thành công trước khi nhập hạng mục.'
      );
      return;
    }
    if (itemImportInFlightRef.current || isItemImportSaving) {
      return;
    }
    setShowItemImportMenu(false);
    setShowItemImportModal(true);
  };

  const triggerProjectRaciImport = () => {
    if (!isPersistedProject) {
      onNotify?.(
        'error',
        'Dự án chưa lưu',
        'Vui lòng lưu dự án thành công trước khi nhập đội ngũ dự án.'
      );
      return;
    }
    if (raciImportInFlightRef.current || isRaciImportSaving) {
      return;
    }
    setShowRaciImportMenu(false);
    setShowRaciImportModal(true);
  };

  const handleTabSwitch = (tab: ProjectFormActiveTab) => {
    if (tab === 'info') {
      setActiveTab('info');
      return;
    }

    if (!isPersistedProject) {
      onNotify?.(
        'error',
        'Dự án chưa lưu',
        'Vui lòng lưu dự án thành công trước khi nhập Hạng mục và Đội ngũ dự án.'
      );
      return;
    }

    setActiveTab(tab);
  };

  const handleProjectItemsImportSave = async (payload: ImportPayload) => {
    if (itemImportInFlightRef.current || isItemImportSaving) {
      return;
    }

    itemImportInFlightRef.current = true;
    setIsItemImportSaving(true);
    setItemImportLoadingText('Đang xử lý hạng mục dự án...');
    setItemImportSummary(null);

    try {
      await executeProjectItemsImport({
        payload,
        currentProjectCode: String(formData.project_code || ''),
        mode: type,
        onCloseModal: () => setShowItemImportModal(false),
        onImportProjectItemsBatch,
        onMergeCurrentItems: (importedItems) => {
          itemsDirtyRef.current = true;
          setFormData((prev) => ({
            ...prev,
            items: mergeImportedProjectItems(prev.items || [], importedItems),
          }));
        },
        onNotify,
        onSetSummary: setItemImportSummary,
        parseNumber,
        productLookupMap,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể đọc file nhập hạng mục.';
      setItemImportSummary({
        success: 0,
        failed: 1,
        warnings: [],
        errors: [message],
      });
      onNotify?.('error', 'Nhập hạng mục dự án', message);
      throw error;
    } finally {
      setItemImportLoadingText('');
      setIsItemImportSaving(false);
      itemImportInFlightRef.current = false;
    }
  };

  const handleProjectRaciImportSave = async (payload: ImportPayload) => {
    if (raciImportInFlightRef.current || isRaciImportSaving) {
      return;
    }

    raciImportInFlightRef.current = true;
    setIsRaciImportSaving(true);
    setRaciImportLoadingText('Đang xử lý đội ngũ dự án...');
    setRaciImportSummary(null);

    try {
      await executeProjectRaciImport({
        payload,
        currentProjectCode: String(formData.project_code || ''),
        employeeLookupMap,
        mode: type,
        onCloseModal: () => setShowRaciImportModal(false),
        onImportProjectRaciBatch,
        onMergeCurrentRaci: (importedRaci) => {
          raciDirtyRef.current = true;
          setFormData((prev) => ({
            ...prev,
            raci: mergeImportedProjectRaci(prev.raci || [], importedRaci),
          }));
        },
        onNotify,
        onSetSummary: setRaciImportSummary,
        projectItemLookupByCode,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể đọc file nhập đội ngũ dự án.';
      setRaciImportSummary({
        success: 0,
        failed: 1,
        warnings: [],
        errors: [message],
      });
      onNotify?.('error', 'Nhập đội ngũ dự án', message);
      throw error;
    } finally {
      setRaciImportLoadingText('');
      setIsRaciImportSaving(false);
      raciImportInFlightRef.current = false;
    }
  };

  const handleAddItem = () => {
    if (!isPersistedProject) {
      onNotify?.(
        'error',
        'Dự án chưa lưu',
        'Vui lòng lưu dự án thành công trước khi thêm hạng mục.'
      );
      return;
    }
    const newItem: ProjectItem = {
      id: `ITEM_${Date.now()}`,
      productId: '',
      product_id: null,
      quantity: 1,
      unitPrice: 0,
      unit_price: 0,
      discountPercent: 0,
      discountAmount: 0,
      lineTotal: 0,
      line_total: 0,
      discountMode: undefined,
    };
    itemsDirtyRef.current = true;
    setFormData((prev) => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const handleImportFromQuotation = (newItems: ProjectItem[], mergeMode: 'merge' | 'replace') => {
    if (!isPersistedProject) {
      onNotify?.('error', 'Dự án chưa lưu', 'Vui lòng lưu dự án trước khi lấy hạng mục từ báo giá.');
      return;
    }
    itemsDirtyRef.current = true;
    setFormData((prev) => {
      if (mergeMode === 'replace') {
        return { ...prev, items: newItems };
      }
      // merge: nếu product_id đã có → cộng số lượng; chưa có → append
      const existing = [...(prev.items || [])];
      for (const incoming of newItems) {
        const idx = existing.findIndex(
          (ei) => String(ei.productId || ei.product_id) === String(incoming.productId)
        );
        if (idx >= 0) {
          const current = existing[idx];
          const newQty = Number(current.quantity || 0) + Number(incoming.quantity || 0);
          const price = Number(current.unitPrice || current.unit_price || 0);
          existing[idx] = {
            ...current,
            quantity: newQty,
            lineTotal: newQty * price,
            line_total: newQty * price,
          };
        } else {
          existing.push(incoming);
        }
      }
      return { ...prev, items: existing };
    });
    setShowQuotationPicker(false);
    onNotify?.(
      'success',
      'Lấy hạng mục từ báo giá',
      mergeMode === 'replace'
        ? `Đã thay thế toàn bộ bằng ${newItems.length} hạng mục từ báo giá.`
        : `Đã gộp ${newItems.length} hạng mục từ báo giá vào danh sách.`
    );
  };

  const handleUpdateItem = (itemId: string, field: keyof ProjectItem, value: any) => {
    itemsDirtyRef.current = true;
    setFormData((prev) => {
      const newItems =
        prev.items?.map((item) => {
          if (item.id !== itemId) return item;

          const updatedItem: ProjectItem = { ...item, [field]: value };

          if (field === 'productId') {
            const normalizedProductId = String(value ?? '').trim();
            const duplicateProduct = (prev.items || []).find(
              (candidate) =>
                candidate.id !== itemId &&
                String(candidate.productId ?? candidate.product_id ?? '').trim() ===
                  normalizedProductId
            );
            if (normalizedProductId && duplicateProduct) {
              onNotify?.(
                'error',
                'Sản phẩm bị trùng',
                'Không thể chọn cùng một sản phẩm nhiều lần trong cùng một dự án.'
              );
              return item;
            }

            updatedItem.productId = normalizedProductId;
            updatedItem.product_id = normalizedProductId || null;

            const product = products.find(
              (p) => String(p.id) === normalizedProductId
            );
            if (product) {
              updatedItem.unitPrice = product.standard_price;
              updatedItem.unit_price = product.standard_price;
              updatedItem.discountPercent = 0;
              updatedItem.discountAmount = 0;
              updatedItem.discountMode = undefined;
            } else if (!normalizedProductId) {
              updatedItem.unitPrice = 0;
              updatedItem.unit_price = 0;
              updatedItem.discountPercent = 0;
              updatedItem.discountAmount = 0;
              updatedItem.discountMode = undefined;
            }
          } else if (field === 'unitPrice') {
            const normalizedUnitPrice = Number(value) || 0;
            updatedItem.unitPrice = normalizedUnitPrice;
            updatedItem.unit_price = normalizedUnitPrice;
          }

          const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

          if (field === 'discountPercent') {
            const rawValue = value.toString();

            if (rawValue === '') {
              updatedItem.discountPercent = '';
              updatedItem.discountAmount = 0;
              updatedItem.discountMode = undefined;
            } else {
              if (!/^\d*([.,]\d{0,2})?$/.test(rawValue)) return item;

              const parsed = parseFloat(rawValue.replace(',', '.'));

              if (parsed > 100) {
                updatedItem.discountPercent = 100;
                updatedItem.discountAmount = baseTotal;
              } else {
                updatedItem.discountPercent = rawValue;
                updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
              }

              if (parsed > 0) updatedItem.discountMode = 'PERCENT';
              else updatedItem.discountMode = undefined;
            }
          } else if (field === 'discountAmount') {
            const rawValue = value.toString();

            if (rawValue === '') {
              updatedItem.discountAmount = '';
              updatedItem.discountPercent = 0;
              updatedItem.discountMode = undefined;
            } else {
              if (!/^[\d.]*([.,]\d{0,2})?$/.test(rawValue)) return item;

              const parsed = Math.round(parseNumber(rawValue));

              if (parsed > baseTotal) {
                updatedItem.discountAmount = baseTotal;
                updatedItem.discountPercent = 100;
              } else {
                updatedItem.discountAmount = parsed;
                if (baseTotal > 0) {
                  updatedItem.discountPercent = parseFloat(
                    ((parsed / baseTotal) * 100).toFixed(2)
                  );
                } else {
                  updatedItem.discountPercent = 0;
                }
              }

              if (parsed > 0) updatedItem.discountMode = 'AMOUNT';
              else updatedItem.discountMode = undefined;
            }
          } else if (field === 'quantity' || field === 'unitPrice') {
            const currentAmount = parseNumber(updatedItem.discountAmount);
            const currentPercent = parseNumber(updatedItem.discountPercent);

            if (updatedItem.discountMode === 'AMOUNT') {
              if (currentAmount > baseTotal) {
                updatedItem.discountAmount = baseTotal;
                updatedItem.discountPercent = 100;
              } else if (baseTotal > 0) {
                updatedItem.discountPercent = parseFloat(
                  ((currentAmount / baseTotal) * 100).toFixed(2)
                );
              } else {
                updatedItem.discountPercent = 0;
              }
            } else {
              updatedItem.discountAmount = Math.round(
                baseTotal * (currentPercent / 100)
              );
            }
          }

          const finalAmount = parseNumber(updatedItem.discountAmount);
          updatedItem.lineTotal = baseTotal - finalAmount;
          updatedItem.line_total = updatedItem.lineTotal;

          return updatedItem;
        }) || [];
      return { ...prev, items: newItems };
    });
  };

  const handleItemBlur = (itemId: string, field: keyof ProjectItem) => {
    setFormData((prev) => {
      const newItems =
        prev.items?.map((item) => {
          if (item.id !== itemId) return item;

          const updatedItem = { ...item };
          const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

          if (field === 'discountPercent') {
            let val = updatedItem.discountPercent;
            let parsed =
              typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
            if (isNaN(parsed)) parsed = 0;

            if (parsed > 100) {
              parsed = 100;
            }

            if (parsed > 50) {
              if (
                !window.confirm(
                  'Cảnh báo: Tỷ lệ chiết khấu lớn hơn 50%. Bạn có chắc chắn muốn áp dụng?'
                )
              ) {
                parsed = 0;
                updatedItem.discountMode = undefined;
              }
            }

            updatedItem.discountPercent = parsed;
            updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
          } else if (field === 'discountAmount') {
            let val = updatedItem.discountAmount;
            let parsed = parseNumber(val);

            if (parsed > baseTotal) {
              parsed = baseTotal;
            }

            if (parsed > baseTotal * 0.5) {
              if (
                !window.confirm(
                  'Cảnh báo: Số tiền giảm giá lớn hơn 50% thành tiền. Bạn có chắc chắn muốn áp dụng?'
                )
              ) {
                parsed = 0;
                updatedItem.discountMode = undefined;
              }
            }

            updatedItem.discountAmount = parsed;
            if (baseTotal > 0) {
              updatedItem.discountPercent = parseFloat(
                ((parsed / baseTotal) * 100).toFixed(2)
              );
            } else {
              updatedItem.discountPercent = 0;
            }
          }

          const finalAmount =
            typeof updatedItem.discountAmount === 'number'
              ? updatedItem.discountAmount
              : parseNumber(updatedItem.discountAmount);
          updatedItem.lineTotal = baseTotal - finalAmount;
          updatedItem.line_total = updatedItem.lineTotal;

          return updatedItem;
        }) || [];
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    itemsDirtyRef.current = true;
    setFormData((prev) => ({
      ...prev,
      items: prev.items?.filter((item) => item.id !== itemId),
    }));
  };

  const handleAddRACI = () => {
    if (!isPersistedProject) {
      onNotify?.(
        'error',
        'Dự án chưa lưu',
        'Vui lòng lưu dự án thành công trước khi thêm đội ngũ dự án.'
      );
      return;
    }
    const newRACI: ProjectRACI = {
      id: `RACI_${Date.now()}`,
      userId: '',
      user_id: null,
      roleType: 'R',
      raci_role: 'R',
      assignedDate: todayDisplayDate,
    };
    raciDirtyRef.current = true;
    setFormData((prev) => ({ ...prev, raci: [...(prev.raci || []), newRACI] }));
  };

  const resolveEmployeeDepartment = (
    employee: Partial<Employee> | null | undefined
  ): Department | null => {
    const departmentToken = String(
      employee?.department_id ?? employee?.department ?? ''
    ).trim();
    if (!departmentToken) {
      return null;
    }

    return (
      departments.find(
        (department) =>
          String(department.id) === departmentToken ||
          String(department.dept_code || '').trim() === departmentToken ||
          String(department.dept_name || '').trim() === departmentToken
      ) || null
    );
  };

  const handleUpdateRACI = (raciId: string, field: keyof ProjectRACI, value: any) => {
    const currentRACI = formData.raci?.find((r) => r.id === raciId);
    if (!currentRACI) return;

    const normalizedValue =
      field === 'userId'
        ? String(value ?? '').trim()
        : field === 'roleType'
          ? String(value ?? currentRACI.roleType).trim().toUpperCase()
          : value;

    const nextUserId = String(
      field === 'userId' ? normalizedValue : currentRACI.userId ?? ''
    ).trim();
    const nextRoleType = String(
      field === 'roleType' ? normalizedValue : currentRACI.roleType ?? ''
    )
      .trim()
      .toUpperCase();

    if (nextUserId && nextRoleType) {
      const duplicate = formData.raci?.find(
        (r) =>
          r.id !== raciId &&
          String(r.userId ?? '').trim() === nextUserId &&
          String(r.roleType ?? '').trim().toUpperCase() === nextRoleType
      );

      if (duplicate) {
        const roleLabel =
          RACI_ROLES.find((role) => role.value === nextRoleType)?.label ||
          nextRoleType;
        onNotify?.(
          'error',
          'Vai trò bị trùng',
          `Nhân sự này đã được phân công vai trò [${roleLabel}] trong dự án. Vui lòng chọn vai trò khác!`
        );
        setDuplicateRaciIds((prev) => new Set([...prev, raciId, duplicate.id]));
        return;
      }
    }

    setDuplicateRaciIds((prev) => {
      if (!prev.has(raciId)) return prev;
      const next = new Set(prev);
      next.delete(raciId);
      return next;
    });

    raciDirtyRef.current = true;
    setFormData((prev) => ({
      ...prev,
      raci: prev.raci?.map((r) => {
        if (r.id !== raciId) {
          return r;
        }

        if (field === 'userId') {
          return {
            ...r,
            userId: nextUserId,
            user_id: nextUserId || null,
          };
        }

        if (field === 'roleType') {
          return {
            ...r,
            roleType: nextRoleType as ProjectRACI['roleType'],
            raci_role: nextRoleType as ProjectRACI['roleType'],
          };
        }

        return { ...r, [field]: normalizedValue };
      }),
    }));
  };

  const handleRaciAssignedDateBlur = (raciId: string) => {
    const currentRaci = formData.raci?.find((row) => row.id === raciId);
    if (!currentRaci) {
      return;
    }

    const formattedDate =
      formatProjectAssignedDate(currentRaci.assignedDate) || todayDisplayDate;
    handleUpdateRACI(raciId, 'assignedDate', formattedDate);
  };

  const handleRemoveRACI = (raciId: string) => {
    raciDirtyRef.current = true;
    setFormData((prev) => ({
      ...prev,
      raci: prev.raci?.filter((r) => r.id !== raciId),
    }));
  };

  const handleCopyRACI = (raciId: string) => {
    const source = formData.raci?.find((r) => r.id === raciId);
    if (!source) return;
    const copy: ProjectRACI = {
      ...source,
      id: `RACI_${Date.now()}`,
      user_id: null,
    };
    raciDirtyRef.current = true;
    setFormData((prev) => {
      const idx = prev.raci?.findIndex((r) => r.id === raciId) ?? -1;
      const next = [...(prev.raci || [])];
      next.splice(idx + 1, 0, copy);
      return { ...prev, raci: next };
    });
  };

  const itemSummary = useMemo(() => {
    return (formData.items || []).reduce(
      (acc, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const baseTotal = quantity * unitPrice;
        const discountAmount = Math.max(0, parseNumber(item.discountAmount));
        const cappedDiscount = Math.min(discountAmount, Math.max(0, baseTotal));
        const resolvedLineTotal = Number.isFinite(Number(item.lineTotal))
          ? Number(item.lineTotal)
          : Math.max(0, baseTotal - cappedDiscount);

        acc.baseTotal += baseTotal;
        acc.discountTotal += cappedDiscount;
        acc.lineTotal += resolvedLineTotal;
        return acc;
      },
      { baseTotal: 0, discountTotal: 0, lineTotal: 0 }
    );
  }, [formData.items]);

  const totalDiscountPercent =
    itemSummary.baseTotal > 0
      ? (itemSummary.discountTotal / itemSummary.baseTotal) * 100
      : 0;

  const projectStartDateMax =
    shiftIsoDateByDays(String(formData.expected_end_date || ''), -1) ||
    DATE_INPUT_MAX;
  const projectExpectedEndDateMin =
    shiftIsoDateByDays(String(formData.start_date || data?.start_date || ''), 1) ||
    DATE_INPUT_MIN;
  const projectExpectedEndDateMax =
    String(formData.actual_end_date || '').trim() || DATE_INPUT_MAX;
  const projectActualEndDateMin =
    String(formData.expected_end_date || '').trim() || DATE_INPUT_MIN;

  const projectContent =
    activeTab === 'info' ? (
      <ProjectInfoTab
        actualEndDateMin={projectActualEndDateMin}
        customers={customers}
        data={data}
        errors={errors}
        expectedEndDateMax={projectExpectedEndDateMax}
        expectedEndDateMin={projectExpectedEndDateMin}
        formData={formData}
        getStatusReasonLabel={getStatusReasonLabel}
        handleChange={handleChange}
        implementationUnitHelpText={implementationUnitHelpText}
        implementationUnitOptions={implementationUnitSelectOptions}
        implementationUnitOptionsError={implementationUnitOptionsError}
        isCustomerOptionsLoading={isCustomerOptionsLoading}
        isImplementationUnitOptionsLoading={isImplementationUnitOptionsLoading}
        isPaymentCycleRequired={isPaymentCycleRequired}
        isProjectTypeOptionsLoading={isProjectTypeOptionsLoading}
        isSpecialStatusSelected={isSpecialStatusSelected}
        onViewProcedure={onViewProcedure}
        projectTypes={projectTypes}
        startDateMax={projectStartDateMax}
        statusOptions={statusOptions}
        statusReasonFieldId={statusReasonFieldId}
        type={type}
      />
    ) : activeTab === 'items' ? (
      <ProjectItemsTab
        errors={errors}
        formData={formData}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
        formatPercent={formatPercent}
        handleAddItem={handleAddItem}
        handleDownloadProjectItemTemplate={handleDownloadProjectItemTemplate}
        handleItemBlur={handleItemBlur}
        handleRemoveItem={handleRemoveItem}
        handleUpdateItem={handleUpdateItem}
        isItemImportSaving={isItemImportSaving}
        isProjectProductOptionsLoading={isProjectProductOptionsLoading}
        itemImportMenuRef={itemImportMenuRef}
        itemImportSummary={itemImportSummary}
        itemSummary={itemSummary}
        parseNumber={parseNumber}
        productById={productById}
        projectProductDropdownHeader={renderProjectProductDropdownHeader}
        projectProductSelectOptions={projectProductSelectOptions}
        renderProjectProductOption={renderProjectProductOption}
        showItemImportMenu={showItemImportMenu}
        toggleItemImportMenu={() => setShowItemImportMenu((prev) => !prev)}
        totalDiscountPercent={totalDiscountPercent}
        triggerProjectItemImport={triggerProjectItemImport}
        onOpenQuotationPicker={() => setShowQuotationPicker(true)}
      />
    ) : activeTab === 'raci' ? (
      <ProjectRaciTab
        employees={employees}
        employeeOptions={employeeOptions}
        formData={formData}
        handleAddRACI={handleAddRACI}
        handleCopyRACI={handleCopyRACI}
        handleDownloadProjectRaciTemplate={handleDownloadProjectRaciTemplate}
        handleRaciAssignedDateBlur={handleRaciAssignedDateBlur}
        handleRemoveRACI={handleRemoveRACI}
        handleUpdateRACI={handleUpdateRACI}
        duplicateRaciIds={duplicateRaciIds}
        isDepartmentsLoading={isDepartmentsLoading}
        isProjectEmployeeOptionsLoading={isProjectEmployeeOptionsLoading}
        isRaciImportSaving={isRaciImportSaving}
        raciImportMenuRef={raciImportMenuRef}
        raciImportSummary={raciImportSummary}
        resolveEmployeeDepartment={resolveEmployeeDepartment}
        showRaciImportMenu={showRaciImportMenu}
        toggleRaciImportMenu={() => setShowRaciImportMenu((prev) => !prev)}
        triggerProjectRaciImport={triggerProjectRaciImport}
      />
    ) : (
      <ProjectRevenueSchedulePanel
        projectId={data?.id ?? null}
        canGenerate={Boolean(
          formData.payment_cycle &&
            formData.start_date &&
            formData.expected_end_date &&
            (formData.items?.length ?? 0) > 0
        )}
        onNotify={onNotify}
      />
    );

  const projectImportDialogs = (
    <>
      {showQuotationPicker && (
        <QuotationPickerModal
          projectCustomerId={formData.customer_id ?? null}
          productById={productById}
          existingItems={formData.items ?? []}
          onConfirm={handleImportFromQuotation}
          onClose={() => setShowQuotationPicker(false)}
        />
      )}
      {showItemImportModal && (
        <ImportModal
          title="Nhập dữ liệu hạng mục dự án"
          moduleKey="project_items"
          onClose={() => {
            if (isItemImportSaving) {
              return;
            }
            setShowItemImportModal(false);
          }}
          onSave={handleProjectItemsImportSave}
          isLoading={isItemImportSaving}
          loadingText={itemImportLoadingText || 'Đang xử lý hạng mục dự án...'}
        />
      )}
      {showRaciImportModal && (
        <ImportModal
          title="Nhập dữ liệu đội ngũ dự án"
          moduleKey="project_raci"
          onClose={() => {
            if (isRaciImportSaving) {
              return;
            }
            setShowRaciImportModal(false);
          }}
          onSave={handleProjectRaciImportSave}
          isLoading={isRaciImportSaving}
          loadingText={raciImportLoadingText || 'Đang xử lý đội ngũ dự án...'}
        />
      )}
    </>
  );

  return (
    <ProjectFormLayout
      activeTab={activeTab}
      content={projectContent}
      disableClose={isSubmitting || isItemImportSaving || isRaciImportSaving}
      importDialogs={projectImportDialogs}
      isPersistedProject={isPersistedProject}
      isSubmitting={isSubmitting}
      itemCount={formData.items?.length || 0}
      onClose={onClose}
      onSubmit={handleSubmit}
      onTabSwitch={handleTabSwitch}
      raciCount={formData.raci?.length || 0}
      saveNotice={saveNotice}
      type={type}
    />
  );
};
