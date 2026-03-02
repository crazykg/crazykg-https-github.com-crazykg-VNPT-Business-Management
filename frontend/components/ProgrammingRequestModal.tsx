import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Customer,
  CustomerPersonnel,
  Employee,
  Product,
  Project,
  ProjectItemMaster,
  Attachment,
  SupportRequest,
  SupportServiceGroup,
} from '../types';
import {
  IProgrammingRequest,
  IProgrammingRequestForm,
  ProgrammingRequestReferenceMatch,
  PROGRAMMING_REQUEST_NOTI_STATUSES,
  PROGRAMMING_REQUEST_SOURCE_TYPES,
  PROGRAMMING_REQUEST_STATUSES,
  PROGRAMMING_REQUEST_TYPES,
  PROGRAMMING_REQUEST_UPCODE_STATUSES,
  ProgrammingRequestNotiStatus,
  ProgrammingRequestSourceType,
  ProgrammingRequestStatus,
  ProgrammingRequestType,
  ProgrammingRequestUpcodeStatus,
} from '../types/programmingRequest';
import {
  deleteUploadedDocumentAttachment,
  fetchProgrammingRequestNextCode,
  uploadDocumentAttachment,
} from '../services/v5Api';
import { SearchableSelect } from './SearchableSelect';

const PRIORITY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Thấp' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Cao' },
  { value: 4, label: 'Khẩn cấp' },
];

const TYPE_LABEL: Record<ProgrammingRequestType, string> = {
  FEATURE: 'Tính năng',
  BUG: 'Lỗi',
  OPTIMIZE: 'Tối ưu',
  REPORT: 'Báo cáo',
  OTHER: 'Khác',
};

const STATUS_LABEL: Record<ProgrammingRequestStatus, string> = {
  NEW: 'Mới tạo',
  ANALYZING: 'Phân tích',
  CODING: 'Lập trình',
  PENDING_UPCODE: 'Chờ upcode',
  UPCODED: 'Đã upcode',
  NOTIFIED: 'Đã thông báo',
  CLOSED: 'Đóng',
  CANCELLED: 'Hủy',
};

const UPCODE_STATUS_LABEL: Record<ProgrammingRequestUpcodeStatus, string> = {
  PENDING: 'Chờ triển khai',
  PROCESSING: 'Đang triển khai',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
};

const NOTI_STATUS_LABEL: Record<ProgrammingRequestNotiStatus, string> = {
  PENDING: 'Chờ thông báo',
  NOTIFIED: 'Đã thông báo',
  FAILED: 'Thông báo lỗi',
};

const parseNullableDate = (value: string): string => {
  const normalized = value.trim();
  return normalized;
};

const compareDateOrder = (from: string, to: string): boolean => {
  if (!from || !to) {
    return true;
  }

  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();
  if (Number.isNaN(fromTs) || Number.isNaN(toTs)) {
    return false;
  }

  return fromTs <= toTs;
};

const toOptionalText = (value: string): string => value.trim();

const toNullableNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatAttachmentSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const sized = bytes / base ** index;
  return `${sized.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const inferFileNameFromUrl = (url: string): string => {
  const cleaned = url.trim();
  if (!cleaned) {
    return 'tai-lieu-dac-ta';
  }

  try {
    const parsed = new URL(cleaned);
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '').trim();
    return fileName || parsed.hostname || 'tai-lieu-dac-ta';
  } catch {
    const parts = cleaned.split('/');
    const fileName = decodeURIComponent(parts[parts.length - 1] || '').trim();
    return fileName || 'tai-lieu-dac-ta';
  }
};

const createAttachmentFromLink = (fileUrl: string): Attachment => ({
  id: 'legacy-doc-link',
  fileName: inferFileNameFromUrl(fileUrl),
  mimeType: 'application/octet-stream',
  fileSize: 0,
  fileUrl,
  driveFileId: '',
  createdAt: new Date().toISOString(),
});

const normalizeSourceType = (value: unknown): ProgrammingRequestSourceType => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'FROM_SUPPORT' || normalized === 'DEV_CODE' || normalized === 'DEV_FIX') {
    return 'FROM_SUPPORT';
  }

  return 'DIRECT';
};

const createFormSchema = (
  currentId: string | number | null,
  requestOptions: IProgrammingRequest[],
  projectItems: ProjectItemMaster[]
) =>
  z
    .object({
      req_code: z
        .string()
        .max(50)
        .regex(/^$|^REQDEV[0-9]{6}$/, 'Mã yêu cầu phải theo định dạng REQDEV + 6 số.'),
      req_name: z.string().min(1, 'Bắt buộc nhập tên yêu cầu').max(255),
      ticket_code: z.string(),
      task_link: z.string(),
      parent_id: z.number().nullable(),
      depth: z.number().int().min(0).max(2),
      reference_request_id: z.number().nullable(),
      source_type: z.enum(PROGRAMMING_REQUEST_SOURCE_TYPES),
      req_type: z.enum(PROGRAMMING_REQUEST_TYPES),
      service_group_id: z.number().nullable(),
      support_request_id: z.number().nullable(),
      priority: z.number().int().min(1).max(4).nullable(),
      overall_progress: z.number().int().min(0).max(100).nullable(),
      status: z.enum(PROGRAMMING_REQUEST_STATUSES),
      description: z.string(),
      doc_link: z.string(),
      customer_id: z.number().nullable(),
      requested_date: z.string().min(1, 'Bắt buộc nhập ngày nhận yêu cầu'),
      reporter_name: z.string(),
      reporter_contact_id: z.number().nullable(),
      receiver_id: z.number().nullable(),
      project_id: z.number().nullable(),
      product_id: z.number().nullable(),
      project_item_id: z.number().nullable(),
      analyze_estimated_hours: z.number().nullable(),
      analyze_start_date: z.string(),
      analyze_end_date: z.string(),
      analyze_extend_date: z.string(),
      analyzer_id: z.number().nullable(),
      analyze_progress: z.number().int().min(0).max(100).nullable(),
      code_estimated_hours: z.number().nullable(),
      code_start_date: z.string(),
      code_end_date: z.string(),
      code_extend_date: z.string(),
      code_actual_date: z.string(),
      coder_id: z.number().nullable(),
      code_progress: z.number().int().min(0).max(100).nullable(),
      upcode_status: z.union([z.enum(PROGRAMMING_REQUEST_UPCODE_STATUSES), z.literal('')]),
      upcode_date: z.string(),
      upcoder_id: z.number().nullable(),
      noti_status: z.union([z.enum(PROGRAMMING_REQUEST_NOTI_STATUSES), z.literal('')]),
      noti_date: z.string(),
      notifier_id: z.number().nullable(),
      notified_internal_id: z.number().nullable(),
      notified_customer_id: z.number().nullable(),
      noti_doc_link: z.string(),
    })
    .superRefine((values, ctx) => {
      if (currentId !== null && values.req_code.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['req_code'],
          message: 'Bắt buộc nhập mã yêu cầu.',
        });
      }

      if (values.project_item_id === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['project_item_id'],
          message: 'Bắt buộc chọn phần mềm triển khai.',
        });
      }

      if (values.source_type === 'FROM_SUPPORT' && values.support_request_id === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['support_request_id'],
          message: 'support_request_id bắt buộc khi nguồn phát sinh là FROM_SUPPORT.',
        });
      }

      if (values.source_type === 'DIRECT' && values.support_request_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['support_request_id'],
          message: 'DIRECT không cho phép nhập support_request_id.',
        });
      }

      if (values.notified_internal_id !== null && values.notified_customer_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notified_internal_id'],
          message: 'Chỉ được chọn một người nhận thông báo.',
        });
      }

      if (values.notified_internal_id !== null && values.notified_customer_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notified_customer_id'],
          message: 'Chỉ được chọn một người nhận thông báo.',
        });
      }

      if (values.depth === 0 && values.parent_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['parent_id'],
          message: 'depth=0 thì parent_id phải để trống.',
        });
      }

      if (values.depth > 0 && values.parent_id === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['parent_id'],
          message: 'depth>0 thì parent_id bắt buộc.',
        });
      }

      if (currentId !== null && values.parent_id !== null && Number(values.parent_id) === Number(currentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['parent_id'],
          message: 'parent_id không được tự tham chiếu.',
        });
      }

      if (currentId !== null && values.reference_request_id !== null && Number(values.reference_request_id) === Number(currentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reference_request_id'],
          message: 'reference_request_id không được tự tham chiếu.',
        });
      }

      if (values.parent_id !== null) {
        const parent = requestOptions.find((item) => Number(item.id) === Number(values.parent_id));
        if (!parent) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['parent_id'],
            message: 'Không tìm thấy task cha tương ứng.',
          });
        } else if (Number(parent.depth) !== Number(values.depth) - 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['parent_id'],
            message: `depth=${values.depth} yêu cầu parent depth=${values.depth - 1}.`,
          });
        }
      }

      if (values.analyze_extend_date && !values.analyze_end_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['analyze_extend_date'],
          message: 'Phải có analyze_end_date trước khi nhập analyze_extend_date.',
        });
      }

      if (values.code_extend_date && !values.code_end_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['code_extend_date'],
          message: 'Phải có code_end_date trước khi nhập code_extend_date.',
        });
      }

      const dateOrderPairs: Array<[string, string, keyof IProgrammingRequestForm]> = [
        [values.analyze_start_date, values.analyze_end_date, 'analyze_end_date'],
        [values.analyze_end_date, values.analyze_extend_date, 'analyze_extend_date'],
        [values.analyze_end_date, values.code_start_date, 'code_start_date'],
        [values.code_start_date, values.code_end_date, 'code_end_date'],
        [values.code_end_date, values.code_extend_date, 'code_extend_date'],
        [values.code_start_date, values.code_actual_date, 'code_actual_date'],
        [values.code_actual_date, values.upcode_date, 'upcode_date'],
        [values.upcode_date, values.noti_date, 'noti_date'],
      ];

      dateOrderPairs.forEach(([from, to, field]) => {
        if (!compareDateOrder(parseNullableDate(from), parseNullableDate(to))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} phải lớn hơn hoặc bằng mốc trước đó.`,
          });
        }
      });

      if (values.project_item_id !== null) {
        const selectedProjectItem = projectItems.find((item) => toNullableNumber(item.id) === values.project_item_id);
        if (!selectedProjectItem) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['project_item_id'],
            message: 'Phần mềm triển khai không tồn tại.',
          });
          return;
        }

        const expectedProjectId = toNullableNumber(selectedProjectItem.project_id);
        const expectedProductId = toNullableNumber(selectedProjectItem.product_id);
        const expectedCustomerId = toNullableNumber(selectedProjectItem.customer_id);

        if (values.project_id === null || values.project_id !== expectedProjectId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['project_id'],
            message: 'Dự án không khớp với phần mềm triển khai đã chọn.',
          });
        }

        if (values.product_id === null || values.product_id !== expectedProductId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['product_id'],
            message: 'Sản phẩm không khớp với phần mềm triển khai đã chọn.',
          });
        }

        if (expectedCustomerId !== null && (values.customer_id === null || values.customer_id !== expectedCustomerId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['customer_id'],
            message: 'Khách hàng không khớp với phần mềm triển khai đã chọn.',
          });
        }
      }
    });

type ProgrammingRequestModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: IProgrammingRequest | null;
  employees: Employee[];
  customers: Customer[];
  customerPersonnel: CustomerPersonnel[];
  projects: Project[];
  products: Product[];
  serviceGroups: SupportServiceGroup[];
  projectItems: ProjectItemMaster[];
  supportRequests: SupportRequest[];
  requestOptions: IProgrammingRequest[];
  onSearchReferenceRequests?: (params?: {
    q?: string;
    exclude_id?: string | number | null;
    limit?: number;
  }) => Promise<ProgrammingRequestReferenceMatch[]>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: IProgrammingRequestForm) => Promise<void> | void;
};

const buildDefaultValues = (item?: IProgrammingRequest | null): IProgrammingRequestForm => {
  const normalizedSupportRequestId = toNullableNumber(item?.support_request_id);
  const normalizedSourceType = normalizeSourceType(
    item?.source_type ?? (normalizedSupportRequestId !== null ? 'FROM_SUPPORT' : 'DIRECT')
  );

  return {
    req_code: item?.req_code || '',
    req_name: item?.req_name || '',
    ticket_code: item?.ticket_code || '',
    task_link: item?.task_link || '',
    parent_id: item?.parent_id ?? null,
    depth: item?.depth ?? 0,
    reference_request_id: item?.reference_request_id ?? null,
    source_type: normalizedSourceType,
    req_type: item?.req_type || 'FEATURE',
    service_group_id: item?.service_group_id ?? null,
    support_request_id: normalizedSupportRequestId,
    priority: item?.priority ?? 3,
    overall_progress: item?.overall_progress ?? 0,
    status: item?.status || 'NEW',
    description: item?.description || '',
    doc_link: item?.doc_link || '',
    customer_id: item?.customer_id ?? null,
    requested_date: item?.requested_date || new Date().toISOString().slice(0, 10),
    reporter_name: item?.reporter_name || '',
    reporter_contact_id: item?.reporter_contact_id ?? null,
    receiver_id: item?.receiver_id ?? null,
    project_id: item?.project_id ?? null,
    product_id: item?.product_id ?? null,
    project_item_id: item?.project_item_id ?? null,
    analyze_estimated_hours: item?.analyze_estimated_hours ?? null,
    analyze_start_date: item?.analyze_start_date || '',
    analyze_end_date: item?.analyze_end_date || '',
    analyze_extend_date: item?.analyze_extend_date || '',
    analyzer_id: item?.analyzer_id ?? null,
    analyze_progress: item?.analyze_progress ?? 0,
    code_estimated_hours: item?.code_estimated_hours ?? null,
    code_start_date: item?.code_start_date || '',
    code_end_date: item?.code_end_date || '',
    code_extend_date: item?.code_extend_date || '',
    code_actual_date: item?.code_actual_date || '',
    coder_id: item?.coder_id ?? null,
    code_progress: item?.code_progress ?? 0,
    upcode_status: item?.upcode_status || '',
    upcode_date: item?.upcode_date || '',
    upcoder_id: item?.upcoder_id ?? null,
    noti_status: item?.noti_status || '',
    noti_date: item?.noti_date || '',
    notifier_id: item?.notifier_id ?? null,
    notified_internal_id: item?.notified_internal_id ?? null,
    notified_customer_id: item?.notified_customer_id ?? null,
    noti_doc_link: item?.noti_doc_link || '',
  };
};

export const ProgrammingRequestModal: React.FC<ProgrammingRequestModalProps> = ({
  open,
  mode,
  initialData = null,
  employees,
  customers,
  customerPersonnel,
  projects,
  products,
  serviceGroups,
  projectItems,
  requestOptions,
  onSearchReferenceRequests,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'analyze' | 'code' | 'deploy'>('general');
  const [projectItemHint, setProjectItemHint] = useState<string>('');
  const [isReqCodeLoading, setIsReqCodeLoading] = useState(false);
  const [isDocUploading, setIsDocUploading] = useState(false);
  const [docAttachment, setDocAttachment] = useState<Attachment | null>(null);
  const [referenceSearchTerm, setReferenceSearchTerm] = useState('');
  const [referenceSearchLoading, setReferenceSearchLoading] = useState(false);
  const [referenceCandidates, setReferenceCandidates] = useState<ProgrammingRequestReferenceMatch[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoReporterNameRef = useRef<string>('');
  const lastReporterContactIdRef = useRef<number | null>(null);

  const schema = useMemo(
    () => createFormSchema(initialData?.id ?? null, requestOptions, projectItems),
    [initialData?.id, requestOptions, projectItems]
  );

  const {
    handleSubmit,
    reset,
    register,
    setValue,
    setError,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<IProgrammingRequestForm>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaultValues(initialData),
  });

  const sourceType = watch('source_type');
  const analyzeEndDate = watch('analyze_end_date');
  const notifiedInternalId = watch('notified_internal_id');
  const notifiedCustomerId = watch('notified_customer_id');
  const selectedReporterContactId = watch('reporter_contact_id');
  const reporterName = watch('reporter_name');
  const selectedProjectId = watch('project_id');
  const selectedProductId = watch('product_id');
  const selectedCustomerId = watch('customer_id');
  const selectedProjectItemId = watch('project_item_id');
  const selectedParentId = watch('parent_id');
  const selectedDepth = watch('depth');
  const overallProgress = watch('overall_progress');
  const reqCode = watch('req_code');
  const isCreateMode = mode === 'create';
  const currentRequestId = toNullableNumber(initialData?.id);
  const isReqCodeValid = /^REQDEV[0-9]{6}$/.test((reqCode || '').trim());
  const isSubmitDisabled = submitting || (isCreateMode && (isReqCodeLoading || !isReqCodeValid));

  const projectItemMap = useMemo(() => {
    const map = new Map<string, ProjectItemMaster>();
    projectItems.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [projectItems]);

  const selectedProjectItem = useMemo(
    () => (selectedProjectItemId === null ? undefined : projectItemMap.get(String(selectedProjectItemId))),
    [selectedProjectItemId, projectItemMap]
  );

  const filteredProjectItems = useMemo(
    () =>
      projectItems.filter((item) => {
        const itemProjectId = toNullableNumber(item.project_id);
        const itemProductId = toNullableNumber(item.product_id);
        if (selectedProjectId !== null && selectedProjectId !== itemProjectId) {
          return false;
        }
        if (selectedProductId !== null && selectedProductId !== itemProductId) {
          return false;
        }
        return true;
      }),
    [projectItems, selectedProjectId, selectedProductId]
  );

  const projectItemOptions = useMemo(
    () =>
      filteredProjectItems.map((item) => ({
        value: Number(item.id),
        label:
          item.display_name
          || `${item.project_code || ''} ${item.project_name || ''} | ${item.product_code || ''} ${item.product_name || ''}`.trim(),
        searchText: `${item.id} ${item.project_code || ''} ${item.project_name || ''} ${item.product_code || ''} ${item.product_name || ''}`,
      })),
    [filteredProjectItems]
  );

  const filteredReporterContactOptions = useMemo(
    () =>
      customerPersonnel
        .filter((person) => selectedCustomerId !== null && toNullableNumber(person.customerId) === selectedCustomerId)
        .map((person) => ({
          value: Number(person.id),
          label: `${person.fullName} - ${person.email || person.phoneNumber || ''}`,
          searchText: `${person.id} ${person.fullName} ${person.email || ''} ${person.phoneNumber || ''}`,
        })),
    [customerPersonnel, selectedCustomerId]
  );

  const localReferenceCandidates = useMemo<ProgrammingRequestReferenceMatch[]>(
    () =>
      requestOptions
        .filter((item) => Number(item.id) !== Number(currentRequestId))
        .map((item) => ({
          id: Number(item.id),
          req_code: item.req_code,
          req_name: item.req_name,
          status: item.status,
          requested_date: item.requested_date || null,
          depth: Number(item.depth ?? 0),
        })),
    [requestOptions, currentRequestId]
  );

  const referenceSelectOptions = useMemo(() => {
    const merged = [...referenceCandidates, ...localReferenceCandidates];
    const uniqueById = new Map<number, ProgrammingRequestReferenceMatch>();
    merged.forEach((item) => {
      if (Number.isFinite(Number(item.id))) {
        uniqueById.set(Number(item.id), item);
      }
    });

    return Array.from(uniqueById.values())
      .filter((item) => Number(item.id) !== Number(currentRequestId))
      .map((item) => ({
        value: Number(item.id),
        label: `${item.req_code} - ${item.req_name}`,
        searchText: `${item.req_code} ${item.req_name} ${item.status}`,
      }));
  }, [referenceCandidates, localReferenceCandidates, currentRequestId]);

  const isProjectAutoFilled = Boolean(
    selectedProjectItem
    && selectedProjectId !== null
    && toNullableNumber(selectedProjectItem.project_id) === selectedProjectId
  );
  const isProductAutoFilled = Boolean(
    selectedProjectItem
    && selectedProductId !== null
    && toNullableNumber(selectedProjectItem.product_id) === selectedProductId
  );
  const isCustomerAutoFilled = Boolean(
    selectedProjectItem
    && selectedCustomerId !== null
    && toNullableNumber(selectedProjectItem.customer_id) === selectedCustomerId
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaults = buildDefaultValues(initialData);
    if (mode === 'create' && defaults.support_request_id === null) {
      defaults.source_type = 'DIRECT';
      defaults.support_request_id = null;
    }

    setActiveTab('general');
    setProjectItemHint('');
    reset(defaults);
    setDocAttachment(defaults.doc_link ? createAttachmentFromLink(defaults.doc_link) : null);
    setReferenceSearchTerm('');
    setReferenceSearchLoading(false);
    setReferenceCandidates(localReferenceCandidates);
    lastAutoReporterNameRef.current = (defaults.reporter_name || '').trim();
    lastReporterContactIdRef.current = defaults.reporter_contact_id;
  }, [open, mode, initialData, reset, localReferenceCandidates]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!onSearchReferenceRequests) {
      setReferenceCandidates(localReferenceCandidates);
      setReferenceSearchLoading(false);
      return;
    }

    const keyword = referenceSearchTerm.trim();
    if (keyword === '') {
      setReferenceCandidates(localReferenceCandidates);
      setReferenceSearchLoading(false);
      return;
    }

    let active = true;
    const debounceTimer = window.setTimeout(() => {
      setReferenceSearchLoading(true);
      void onSearchReferenceRequests({
        q: keyword,
        exclude_id: currentRequestId,
        limit: 30,
      })
        .then((rows) => {
          if (!active) {
            return;
          }
          setReferenceCandidates(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (!active) {
            return;
          }
          setReferenceCandidates(localReferenceCandidates);
        })
        .finally(() => {
          if (active) {
            setReferenceSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(debounceTimer);
    };
  }, [
    open,
    onSearchReferenceRequests,
    referenceSearchTerm,
    currentRequestId,
    localReferenceCandidates,
  ]);

  useEffect(() => {
    if (!open || mode !== 'create') {
      return;
    }

    const initialSourceType = normalizeSourceType(initialData?.source_type);
    const initialSupportRequestId = toNullableNumber(initialData?.support_request_id);
    if (initialSourceType !== 'FROM_SUPPORT' || initialSupportRequestId === null) {
      return;
    }

    setValue('source_type', 'FROM_SUPPORT', { shouldValidate: true });
    setValue('support_request_id', initialSupportRequestId, { shouldValidate: true });
    clearErrors('support_request_id');
  }, [
    open,
    mode,
    initialData?.source_type,
    initialData?.support_request_id,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!open || mode !== 'create') {
      return;
    }

    let active = true;
    setIsReqCodeLoading(true);
    void fetchProgrammingRequestNextCode()
      .then((nextCode) => {
        if (!active) {
          return;
        }
        setValue('req_code', nextCode, { shouldValidate: true });
        clearErrors('req_code');
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setValue('req_code', '', { shouldValidate: true });
        setError('req_code', {
          type: 'manual',
          message: 'Không thể sinh mã yêu cầu tự động. Vui lòng thử lại.',
        });
      })
      .finally(() => {
        if (active) {
          setIsReqCodeLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, mode, setValue, setError, clearErrors]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'create') {
      return;
    }
    if (sourceType === 'DIRECT') {
      setValue('support_request_id', null, { shouldValidate: true });
    }
  }, [open, mode, sourceType, setValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (selectedParentId === null) {
      if (selectedDepth !== 0) {
        setValue('depth', 0, { shouldValidate: true, shouldDirty: true });
      }
      return;
    }

    const parent = requestOptions.find((item) => Number(item.id) === Number(selectedParentId));
    const nextDepth = parent ? Math.min(2, Math.max(0, Number(parent.depth) + 1)) : 1;
    if (selectedDepth !== nextDepth) {
      setValue('depth', nextDepth, { shouldValidate: true, shouldDirty: true });
    }
  }, [open, requestOptions, selectedParentId, selectedDepth, setValue]);

  useEffect(() => {
    if (!open || selectedProjectItemId === null) {
      return;
    }

    const item = projectItemMap.get(String(selectedProjectItemId));
    if (!item) {
      return;
    }

    const itemProjectId = toNullableNumber(item.project_id);
    const itemProductId = toNullableNumber(item.product_id);
    const itemCustomerId = toNullableNumber(item.customer_id);

    let hasSynced = false;
    if (itemProjectId !== null && selectedProjectId !== itemProjectId) {
      setValue('project_id', itemProjectId, { shouldValidate: true, shouldDirty: true });
      hasSynced = true;
    }
    if (itemProductId !== null && selectedProductId !== itemProductId) {
      setValue('product_id', itemProductId, { shouldValidate: true, shouldDirty: true });
      hasSynced = true;
    }
    if (itemCustomerId !== null && selectedCustomerId !== itemCustomerId) {
      setValue('customer_id', itemCustomerId, { shouldValidate: true, shouldDirty: true });
      hasSynced = true;
    }

    if (hasSynced) {
      clearErrors(['customer_id', 'project_id', 'product_id', 'project_item_id']);
      setProjectItemHint('Đã tự động đồng bộ theo phần mềm triển khai.');
    }
  }, [
    open,
    selectedProjectItemId,
    projectItemMap,
    selectedProjectId,
    selectedProductId,
    selectedCustomerId,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!open || selectedReporterContactId === null) {
      lastReporterContactIdRef.current = null;
      return;
    }

    if (selectedCustomerId === null) {
      setValue('reporter_contact_id', null, { shouldValidate: true, shouldDirty: true });
      lastReporterContactIdRef.current = null;
      return;
    }

    const selectedReporter = customerPersonnel.find(
      (person) =>
        toNullableNumber(person.id) === selectedReporterContactId
        && toNullableNumber(person.customerId) === selectedCustomerId
    );

    if (!selectedReporter) {
      setValue('reporter_contact_id', null, { shouldValidate: true, shouldDirty: true });
      lastReporterContactIdRef.current = null;
      return;
    }

    const reporterDisplayName = (selectedReporter.fullName || '').trim();
    const hasChangedContact = lastReporterContactIdRef.current !== selectedReporterContactId;
    if (
      hasChangedContact
      || (reporterName || '').trim() === ''
      || (reporterName || '').trim() === lastAutoReporterNameRef.current
    ) {
      setValue('reporter_name', reporterDisplayName, { shouldDirty: true });
      lastAutoReporterNameRef.current = reporterDisplayName;
    }
    lastReporterContactIdRef.current = selectedReporterContactId;
  }, [
    open,
    selectedReporterContactId,
    selectedCustomerId,
    customerPersonnel,
    reporterName,
    setValue,
  ]);

  if (!open) {
    return null;
  }

  const employeeOptions = employees.map((employee) => ({
    value: Number(employee.id),
    label: `${employee.user_code || employee.employee_code || employee.id} - ${employee.full_name}`,
  }));

  const handleProjectItemChange = (value: string) => {
    const nextProjectItemId = toNullableNumber(value);
    if (nextProjectItemId === null) {
      setValue('project_item_id', null, { shouldValidate: true, shouldDirty: true });
      clearErrors(['project_item_id', 'customer_id', 'project_id', 'product_id']);
      setProjectItemHint(
        isCreateMode
          ? 'Đã bỏ phần mềm triển khai.'
          : 'Đã bỏ phần mềm triển khai, có thể chọn tay Khách hàng/Dự án/Sản phẩm.'
      );
      return;
    }

    const selectedItem = projectItemMap.get(String(nextProjectItemId));
    setValue('project_item_id', nextProjectItemId, { shouldValidate: true, shouldDirty: true });

    if (!selectedItem) {
      setProjectItemHint('Không tìm thấy dữ liệu phần mềm triển khai đã chọn.');
      return;
    }

    setValue('project_id', toNullableNumber(selectedItem.project_id), { shouldValidate: true, shouldDirty: true });
    setValue('product_id', toNullableNumber(selectedItem.product_id), { shouldValidate: true, shouldDirty: true });
    setValue('customer_id', toNullableNumber(selectedItem.customer_id), { shouldValidate: true, shouldDirty: true });
    clearErrors(['project_item_id', 'customer_id', 'project_id', 'product_id']);
    setProjectItemHint('Đã tự động điền Khách hàng/Dự án/Sản phẩm từ phần mềm triển khai.');
  };

  const handleCustomerChange = (value: string) => {
    const nextCustomerId = toNullableNumber(value);
    setValue('customer_id', nextCustomerId, { shouldValidate: true, shouldDirty: true });

    if (!selectedProjectItem) {
      return;
    }

    const itemCustomerId = toNullableNumber(selectedProjectItem.customer_id);
    if (itemCustomerId !== null && nextCustomerId !== itemCustomerId) {
      setValue('project_item_id', null, { shouldValidate: true, shouldDirty: true });
      clearErrors(['project_item_id', 'project_id', 'product_id']);
      setProjectItemHint('Đã bỏ phần mềm triển khai vì không còn khớp Khách hàng.');
    }
  };

  const handleProjectChange = (value: string) => {
    const nextProjectId = toNullableNumber(value);
    setValue('project_id', nextProjectId, { shouldValidate: true, shouldDirty: true });

    if (!selectedProjectItem) {
      return;
    }

    const itemProjectId = toNullableNumber(selectedProjectItem.project_id);
    if (nextProjectId !== itemProjectId) {
      setValue('project_item_id', null, { shouldValidate: true, shouldDirty: true });
      clearErrors(['project_item_id', 'product_id']);
      setProjectItemHint('Đã bỏ phần mềm triển khai vì không còn khớp Dự án.');
    }
  };

  const handleProductChange = (value: string) => {
    const nextProductId = toNullableNumber(value);
    setValue('product_id', nextProductId, { shouldValidate: true, shouldDirty: true });

    if (!selectedProjectItem) {
      return;
    }

    const itemProductId = toNullableNumber(selectedProjectItem.product_id);
    if (nextProductId !== itemProductId) {
      setValue('project_item_id', null, { shouldValidate: true, shouldDirty: true });
      clearErrors(['project_item_id', 'project_id']);
      setProjectItemHint('Đã bỏ phần mềm triển khai vì không còn khớp Sản phẩm.');
    }
  };

  const handleOverallProgressChange = (value: number | null) => {
    const normalized = value === null || Number.isNaN(value) ? null : Math.min(100, Math.max(0, Math.round(value)));
    setValue('overall_progress', normalized, { shouldValidate: true, shouldDirty: true });
  };

  const handleDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsDocUploading(true);
    try {
      const uploaded = await uploadDocumentAttachment(file);
      if (docAttachment && docAttachment.id !== 'legacy-doc-link') {
        await deleteUploadedDocumentAttachment({
          driveFileId: docAttachment.driveFileId || null,
          fileUrl: docAttachment.fileUrl || null,
        });
      }
      setDocAttachment(uploaded);
      setValue('doc_link', uploaded.fileUrl || '', { shouldValidate: true, shouldDirty: true });
      clearErrors('doc_link');
    } catch {
      setError('doc_link', {
        type: 'manual',
        message: 'Không thể tải tài liệu lên Drive. Vui lòng thử lại.',
      });
    } finally {
      setIsDocUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDocDelete = async () => {
    if (!docAttachment) {
      return;
    }

    setIsDocUploading(true);
    try {
      if (docAttachment.id !== 'legacy-doc-link') {
        await deleteUploadedDocumentAttachment({
          driveFileId: docAttachment.driveFileId || null,
          fileUrl: docAttachment.fileUrl || null,
        });
      }
      setDocAttachment(null);
      setValue('doc_link', '', { shouldValidate: true, shouldDirty: true });
    } catch {
      setError('doc_link', {
        type: 'manual',
        message: 'Không thể xóa tài liệu đã tải. Vui lòng thử lại.',
      });
    } finally {
      setIsDocUploading(false);
    }
  };

  const submitForm = handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      ticket_code: toOptionalText(values.ticket_code),
      task_link: toOptionalText(values.task_link),
      description: toOptionalText(values.description),
      doc_link: toOptionalText(values.doc_link),
      reporter_name: toOptionalText(values.reporter_name),
      noti_doc_link: toOptionalText(values.noti_doc_link),
      analyze_start_date: parseNullableDate(values.analyze_start_date),
      analyze_end_date: parseNullableDate(values.analyze_end_date),
      analyze_extend_date: parseNullableDate(values.analyze_extend_date),
      code_start_date: parseNullableDate(values.code_start_date),
      code_end_date: parseNullableDate(values.code_end_date),
      code_extend_date: parseNullableDate(values.code_extend_date),
      code_actual_date: parseNullableDate(values.code_actual_date),
      upcode_date: parseNullableDate(values.upcode_date),
      noti_date: parseNullableDate(values.noti_date),
      upcode_status: values.upcode_status,
      noti_status: values.noti_status,
    });
  });

  const tabClass = (tab: 'general' | 'analyze' | 'code' | 'deploy') =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-2xl font-black text-slate-900">{mode === 'create' ? 'Thêm yêu cầu lập trình' : 'Cập nhật yêu cầu lập trình'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="border-b border-slate-200 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabClass('general')} onClick={() => setActiveTab('general')}>Thông tin chung</button>
            <button type="button" className={tabClass('analyze')} onClick={() => setActiveTab('analyze')}>Phân tích</button>
            <button type="button" className={tabClass('code')} onClick={() => setActiveTab('code')}>Lập trình</button>
            <button type="button" className={tabClass('deploy')} onClick={() => setActiveTab('deploy')}>Triển khai & TB</button>
          </div>
        </div>

        <form onSubmit={submitForm} className="max-h-[72vh] overflow-y-auto px-6 py-4">
          <input type="hidden" {...register('req_code')} />
          <input type="hidden" {...register('source_type')} />
          <input
            type="hidden"
            {...register('support_request_id', {
              setValueAs: (value) => {
                if (value === '' || value === null || value === undefined) return null;
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : null;
              },
            })}
          />
          <input type="hidden" {...register('depth', { valueAsNumber: true })} />
          <input type="hidden" {...register('doc_link')} />

          {activeTab === 'general' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <SearchableSelect
                  value={watch('project_item_id') ?? ''}
                  onChange={handleProjectItemChange}
                  options={projectItemOptions}
                  label="Phần mềm triển khai"
                  required
                  placeholder="Chọn phần mềm triển khai"
                  error={errors.project_item_id?.message}
                />
                {projectItemHint ? <p className="mt-1 text-xs text-slate-500">{projectItemHint}</p> : null}
                {mode === 'create' && isReqCodeLoading ? <p className="mt-1 text-xs text-slate-500">Đang sinh mã yêu cầu...</p> : null}
                {errors.req_code?.message ? <p className="mt-1 text-xs text-red-500">{errors.req_code.message}</p> : null}
                {errors.support_request_id?.message ? <p className="mt-1 text-xs text-red-500">{errors.support_request_id.message}</p> : null}
                {errors.depth?.message ? <p className="mt-1 text-xs text-red-500">{errors.depth.message}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tên yêu cầu <span className="text-red-500">*</span></label>
                <input {...register('req_name')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                {errors.req_name?.message ? <p className="mt-1 text-xs text-red-500">{errors.req_name.message}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mã Task IT360</label>
                <input
                  {...register('ticket_code')}
                  placeholder="Nhập thông tin mã DMS cung cấp"
                  className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tên Task IT360</label>
                <input
                  {...register('task_link')}
                  placeholder="Nhập thông tin mã DMS cung cấp"
                  className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <SearchableSelect
                value={watch('reporter_contact_id') ?? ''}
                onChange={(value) => setValue('reporter_contact_id', value ? Number(value) : null, { shouldDirty: true })}
                options={filteredReporterContactOptions}
                label="Đầu mối khách hàng"
                placeholder={selectedCustomerId === null ? 'Chọn phần mềm triển khai trước' : 'Chọn đầu mối khách hàng'}
                disabled={selectedCustomerId === null}
              />

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Người báo yêu cầu (KH)</label>
                <input {...register('reporter_name')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <SearchableSelect
                value={watch('req_type')}
                onChange={(value) => setValue('req_type', value as ProgrammingRequestType, { shouldValidate: true })}
                options={PROGRAMMING_REQUEST_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
                label="Loại yêu cầu"
                required
              />

              <SearchableSelect
                value={watch('status')}
                onChange={(value) => setValue('status', value as ProgrammingRequestStatus, { shouldValidate: true })}
                options={PROGRAMMING_REQUEST_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
                label="Trạng thái"
                required
              />

              <SearchableSelect
                value={watch('service_group_id') ?? ''}
                onChange={(value) => setValue('service_group_id', value ? Number(value) : null)}
                options={serviceGroups.map((item) => ({ value: Number(item.id), label: item.group_name }))}
                label="Nhóm dịch vụ"
                placeholder="Chọn nhóm"
              />

              {!isCreateMode ? (
                <div>
                  <SearchableSelect
                    value={watch('customer_id') ?? ''}
                    onChange={handleCustomerChange}
                    options={customers.map((item) => ({ value: Number(item.id), label: `${item.customer_code} - ${item.customer_name}` }))}
                    label="Khách hàng"
                    error={errors.customer_id?.message}
                  />
                  {isCustomerAutoFilled ? <p className="mt-1 text-xs text-slate-500">Tự động từ phần mềm triển khai.</p> : null}
                </div>
              ) : null}

              {!isCreateMode ? (
                <div>
                  <SearchableSelect
                    value={watch('project_id') ?? ''}
                    onChange={handleProjectChange}
                    options={projects.map((item) => ({ value: Number(item.id), label: `${item.project_code} - ${item.project_name}` }))}
                    label="Dự án"
                    error={errors.project_id?.message}
                  />
                  {isProjectAutoFilled ? <p className="mt-1 text-xs text-slate-500">Tự động từ phần mềm triển khai.</p> : null}
                </div>
              ) : null}

              {!isCreateMode ? (
                <div>
                  <SearchableSelect
                    value={watch('product_id') ?? ''}
                    onChange={handleProductChange}
                    options={products.map((item) => ({ value: Number(item.id), label: `${item.product_code} - ${item.product_name}` }))}
                    label="Sản phẩm"
                    error={errors.product_id?.message}
                  />
                  {isProductAutoFilled ? <p className="mt-1 text-xs text-slate-500">Tự động từ phần mềm triển khai.</p> : null}
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày nhận yêu cầu <span className="text-red-500">*</span></label>
                <input type="date" {...register('requested_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                {errors.requested_date?.message ? <p className="mt-1 text-xs text-red-500">{errors.requested_date.message}</p> : null}
              </div>

              <SearchableSelect
                value={watch('priority') ?? ''}
                onChange={(value) => setValue('priority', value ? Number(value) : null, { shouldValidate: true, shouldDirty: true })}
                options={PRIORITY_OPTIONS}
                label="Mức ưu tiên"
                placeholder="Chọn mức ưu tiên"
                error={errors.priority?.message}
              />

              <SearchableSelect
                value={watch('receiver_id') ?? ''}
                onChange={(value) => setValue('receiver_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Người tiếp nhận"
              />

              <SearchableSelect
                value={watch('coder_id') ?? ''}
                onChange={(value) => setValue('coder_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Dev phụ trách"
              />

              <SearchableSelect
                value={watch('parent_id') ?? ''}
                onChange={(value) => setValue('parent_id', value ? Number(value) : null, { shouldValidate: true })}
                options={requestOptions
                  .filter((item) => Number(item.id) !== Number(initialData?.id))
                  .map((item) => ({ value: Number(item.id), label: `${item.req_code} - ${item.req_name} (depth ${item.depth})` }))}
                label="Task cha"
                error={errors.parent_id?.message}
              />

              <SearchableSelect
                value={watch('reference_request_id') ?? ''}
                onChange={(value) => setValue('reference_request_id', value ? Number(value) : null, { shouldValidate: true })}
                options={referenceSelectOptions}
                onSearchTermChange={setReferenceSearchTerm}
                searching={referenceSearchLoading}
                label="Task tham chiếu"
                searchPlaceholder="Tìm mã/tên task tham chiếu..."
                error={errors.reference_request_id?.message}
              />

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tiến độ tổng (%)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={overallProgress ?? 0}
                    onChange={(event) => handleOverallProgressChange(Number(event.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={overallProgress ?? 0}
                    onChange={(event) => handleOverallProgressChange(event.target.value === '' ? null : Number(event.target.value))}
                    className="h-11 w-24 rounded-lg border border-slate-300 px-3 text-center text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm font-semibold text-slate-500">%</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mô tả</label>
                <textarea rows={3} {...register('description')} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-800">Tài liệu đặc tả thiết kế</h4>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isDocUploading}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDocUploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    ) : (
                      <span className="material-symbols-outlined text-base">upload</span>
                    )}
                    Tải lên Drive
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleDocUpload} />
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full border-collapse text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Tên file</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500">Kích thước</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docAttachment ? (
                        <tr className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3">
                            <p className="truncate text-sm font-medium text-slate-800" title={docAttachment.fileName}>{docAttachment.fileName}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500">{formatAttachmentSize(docAttachment.fileSize)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={docAttachment.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50"
                                title="Mở file"
                              >
                                <span className="material-symbols-outlined text-lg">open_in_new</span>
                              </a>
                              <button
                                type="button"
                                onClick={handleDocDelete}
                                disabled={isDocUploading}
                                className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Xóa file"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có file nào được tải lên.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <span className="material-symbols-outlined text-xl text-blue-600">cloud_done</span>
                  <div>
                    <p className="text-xs font-bold text-blue-800">Tích hợp Google Drive</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-blue-700">
                      File sẽ tải lên Google Drive khi hệ thống đã cấu hình Service Account. Nếu chưa cấu hình, file được lưu tạm trên máy chủ nội bộ.
                    </p>
                  </div>
                </div>
                {errors.doc_link?.message ? <p className="mt-2 text-xs text-red-500">{errors.doc_link.message}</p> : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'analyze' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchableSelect
                value={watch('analyzer_id') ?? ''}
                onChange={(value) => setValue('analyzer_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Người phân tích"
              />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Giờ ước tính phân tích</label>
                <input type="number" step="0.01" min={0.01} {...register('analyze_estimated_hours', { setValueAs: (value) => value === '' ? null : Number(value) })} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày bắt đầu phân tích</label>
                <input type="date" {...register('analyze_start_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày kết thúc phân tích</label>
                <input type="date" {...register('analyze_end_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày gia hạn phân tích</label>
                <input
                  type="date"
                  min={analyzeEndDate || undefined}
                  {...register('analyze_extend_date')}
                  className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {errors.analyze_extend_date?.message ? <p className="mt-1 text-xs text-red-500">{errors.analyze_extend_date.message}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tiến độ phân tích (%)</label>
                <input type="number" min={0} max={100} {...register('analyze_progress', { setValueAs: (value) => value === '' ? null : Number(value) })} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          ) : null}

          {activeTab === 'code' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchableSelect
                value={watch('coder_id') ?? ''}
                onChange={(value) => setValue('coder_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Lập trình viên"
              />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Giờ ước tính code</label>
                <input type="number" step="0.01" min={0.01} {...register('code_estimated_hours', { setValueAs: (value) => value === '' ? null : Number(value) })} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày bắt đầu code</label>
                <input type="date" min={analyzeEndDate || undefined} {...register('code_start_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày kết thúc code</label>
                <input type="date" {...register('code_end_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày gia hạn code</label>
                <input type="date" {...register('code_extend_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày hoàn thành thực tế</label>
                <input type="date" {...register('code_actual_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tiến độ code (%)</label>
                <input type="number" min={0} max={100} {...register('code_progress', { setValueAs: (value) => value === '' ? null : Number(value) })} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          ) : null}

          {activeTab === 'deploy' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchableSelect
                value={watch('upcode_status')}
                onChange={(value) => setValue('upcode_status', value as ProgrammingRequestUpcodeStatus | '')}
                options={[
                  { value: '', label: 'Chưa chọn' },
                  ...PROGRAMMING_REQUEST_UPCODE_STATUSES.map((status) => ({ value: status, label: UPCODE_STATUS_LABEL[status] })),
                ]}
                label="Trạng thái upcode"
              />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày upcode</label>
                <input type="date" {...register('upcode_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <SearchableSelect
                value={watch('upcoder_id') ?? ''}
                onChange={(value) => setValue('upcoder_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Người upcode"
              />

              <SearchableSelect
                value={watch('noti_status')}
                onChange={(value) => setValue('noti_status', value as ProgrammingRequestNotiStatus | '')}
                options={[
                  { value: '', label: 'Chưa chọn' },
                  ...PROGRAMMING_REQUEST_NOTI_STATUSES.map((status) => ({ value: status, label: NOTI_STATUS_LABEL[status] })),
                ]}
                label="Trạng thái thông báo"
              />

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày thông báo</label>
                <input type="date" {...register('noti_date')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>

              <SearchableSelect
                value={watch('notifier_id') ?? ''}
                onChange={(value) => setValue('notifier_id', value ? Number(value) : null)}
                options={employeeOptions}
                label="Người thông báo"
              />

              <SearchableSelect
                value={notifiedInternalId ?? ''}
                onChange={(value) => setValue('notified_internal_id', value ? Number(value) : null, { shouldValidate: true })}
                options={employeeOptions}
                label="Người nhận nội bộ"
                disabled={notifiedCustomerId !== null}
                error={errors.notified_internal_id?.message}
              />

              <SearchableSelect
                value={notifiedCustomerId ?? ''}
                onChange={(value) => setValue('notified_customer_id', value ? Number(value) : null, { shouldValidate: true })}
                options={customerPersonnel.map((person) => ({ value: Number(person.id), label: `${person.fullName} - ${person.email || person.phoneNumber || ''}` }))}
                label="Người nhận khách hàng"
                disabled={notifiedInternalId !== null}
                error={errors.notified_customer_id?.message}
              />

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Link tài liệu thông báo</label>
                <input {...register('noti_doc_link')} className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100">Hủy</button>
            <button type="submit" disabled={isSubmitDisabled} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition hover:bg-deep-teal disabled:opacity-60">
              {submitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo mới' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
