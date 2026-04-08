import { useState } from 'react';
import {
  fetchYeuCauTimeline,
  transitionCustomerRequestCase,
  uploadDocumentAttachment,
} from '../../../services/v5Api';
import { useTransitionCase } from '../../../shared/hooks/useCustomerRequests';
import { queryKeys } from '../../../shared/queryKeys';
import type {
  Attachment,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
} from '../../../types/customerRequest';
import {
  createEmptyIt360TaskRow,
  createEmptyReferenceTaskRow,
  normalizeSupportTaskStatus,
  normalizeText,
} from '../helpers';
import {
  PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE,
  resolveTransitionStatusMeta,
  type CustomerRequestTaskSource,
  type It360TaskFormRow,
  type ReferenceTaskFormRow,
} from '../presentation';

type TaskReferenceLookup = Map<string, { id?: string | number | null; task_code: string }>;

type UseCustomerRequestTransitionOptions = {
  currentUserId?: string | number | null;
  selectedRequestId: string | number | null;
  transitionStatusCode: string;
  transitionProcessMeta: YeuCauProcessMeta | null;
  processDetail: YeuCauProcessDetail | null;
  people: YeuCauRelatedUser[];
  defaultProcessor: ProjectRaciRow | null;
  taskReferenceLookup: TaskReferenceLookup;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
  onTransitionSuccess: (requestId: string | number, statusCode: string) => void;
  bumpDataVersion: () => void;
};

type OpenTransitionModalOptions = {
  targetProcessMeta?: YeuCauProcessMeta | null;
  payloadOverrides?: Record<string, unknown>;
  handlerUserId?: string | number | null;
  notes?: string;
};

export const FIXED_STATUS_FIELDS: YeuCauProcessField[] = [
  { name: 'received_at', label: 'Ngày bắt đầu', type: 'datetime' },
  { name: 'completed_at', label: 'Ngày kết thúc', type: 'datetime' },
  { name: 'extended_at', label: 'Ngày gia hạn', type: 'datetime' },
  { name: 'progress_percent', label: 'Tiến độ phần trăm', type: 'number' },
  { name: 'from_user_id', label: 'Người chuyển', type: 'user_select' },
  { name: 'to_user_id', label: 'Người nhận', type: 'user_select' },
  { name: 'notes', label: 'Ghi chú', type: 'textarea' },
];

const pickTransitionMetadataPayload = (
  payload: Record<string, unknown>
): Record<string, string> => {
  const nextPayload: Record<string, string> = {};

  for (const key of [
    'decision_context_code',
    'decision_outcome_code',
    'decision_source_status_code',
  ] as const) {
    const value = normalizeText(payload[key]);
    if (value) {
      nextPayload[key] = value;
    }
  }

  return nextPayload;
};

const buildFixedTransitionDraft = (_actorUserId?: string | number | null): Record<string, unknown> => {
  return {
    received_at: '',
    completed_at: '',
    extended_at: '',
    progress_percent: '',
    from_user_id: '',
    to_user_id: '',
    notes: '',
  };
};

const hasValue = (value: unknown): boolean => normalizeText(value) !== '';

const isProgressPercentInvalid = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  if (normalized === '') {
    return false;
  }

  const numeric = Number(normalized);
  return !Number.isFinite(numeric) || numeric < 0 || numeric > 100;
};

const normalizeTransitionTargetStatusCode = (toStatusCode: string): string =>
  toStatusCode === PM_MISSING_CUSTOMER_INFO_DECISION_PROCESS_CODE
    ? 'waiting_customer_feedback'
    : toStatusCode;

const isTargetUserRequired = (toStatusCode: string): boolean =>
  [
    'returned_to_manager',
    'in_progress',
    'analysis',
    'coding',
    'dms_transfer',
  ].includes(toStatusCode);

const isCompletedAtRequired = (toStatusCode: string): boolean =>
  ['completed', 'customer_notified'].includes(toStatusCode);

const assertTransitionPayload = (
  toStatusCode: string,
  statusPayload: Record<string, unknown>,
): string | null => {
  if (isProgressPercentInvalid(statusPayload.progress_percent)) {
    return 'Tiến độ phần trăm phải trong khoảng 0-100.';
  }

  if (!hasValue(statusPayload.from_user_id)) {
    return 'Người chuyển là bắt buộc.';
  }

  if (isTargetUserRequired(toStatusCode) && !hasValue(statusPayload.to_user_id)) {
    return 'Người nhận là bắt buộc cho nhánh chuyển trạng thái này.';
  }

  if (isCompletedAtRequired(toStatusCode) && !hasValue(statusPayload.completed_at)) {
    return 'Ngày kết thúc là bắt buộc khi chuyển sang trạng thái hoàn thành/thông báo khách hàng.';
  }

  if (
    ['returned_to_manager', 'not_executed'].includes(toStatusCode)
    && !hasValue(statusPayload.notes)
  ) {
    return 'Ghi chú là bắt buộc cho nhánh trả PM hoặc không tiếp nhận.';
  }

  return null;
};

const buildFixedTransitionPayload = (draft: Record<string, unknown>): Record<string, unknown> => ({
  received_at: normalizeText(draft.received_at),
  completed_at: normalizeText(draft.completed_at),
  extended_at: normalizeText(draft.extended_at),
  progress_percent: normalizeText(draft.progress_percent),
  from_user_id: normalizeText(draft.from_user_id),
  to_user_id: normalizeText(draft.to_user_id),
  notes: normalizeText(draft.notes),
});

const applyFixedDefaultsFromCurrentCase = (
  payload: Record<string, unknown>,
  processDetail: YeuCauProcessDetail | null,
  currentUserId?: string | number | null,
  toStatusCode?: string,
): Record<string, unknown> => {
  const actor = normalizeText(currentUserId);
  const request = processDetail?.yeu_cau ?? {};
  const currentOwnerUserId = normalizeText(
    request.current_owner_user_id
    ?? request.nguoi_xu_ly_id
    ?? processDetail?.process_row?.data?.to_user_id
  );

  if (!hasValue(payload.from_user_id)) {
    payload.from_user_id = actor || currentOwnerUserId || normalizeText(request.updated_by ?? request.receiver_user_id);
  }

  if (!hasValue(payload.to_user_id) && isTargetUserRequired(normalizeText(toStatusCode))) {
    payload.to_user_id = currentOwnerUserId;
  }

  if (!hasValue(payload.received_at)) {
    payload.received_at = normalizeText(request.ngay_tiep_nhan ?? request.received_at);
  }

  return payload;
};

const toMutationStatusPayload = (
  processDetail: YeuCauProcessDetail | null,
  draft: Record<string, unknown>,
  modalNotes: string,
  currentUserId?: string | number | null,
  toStatusCode?: string,
): Record<string, unknown> => {
  const next = applyFixedDefaultsFromCurrentCase(
    buildFixedTransitionPayload(draft),
    processDetail,
    currentUserId,
    toStatusCode,
  );

  next.notes = normalizeText(modalNotes) || normalizeText(next.notes);
  return next;
};

const buildInitialTransitionDraft = (
  processDetail: YeuCauProcessDetail | null,
  currentUserId?: string | number | null,
  toStatusCode?: string,
): Record<string, unknown> =>
  applyFixedDefaultsFromCurrentCase(buildFixedTransitionDraft(currentUserId), processDetail, currentUserId, toStatusCode);

export const useCustomerRequestTransition = ({
  currentUserId,
  selectedRequestId,
  transitionStatusCode,
  transitionProcessMeta,
  processDetail,
  people,
  defaultProcessor,
  taskReferenceLookup,
  onNotify,
  onTransitionSuccess,
  bumpDataVersion,
}: UseCustomerRequestTransitionOptions) => {
  void transitionProcessMeta;

  const transitionMutation = useTransitionCase();
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [modalHandlerUserId, setModalHandlerUserId] = useState('');
  const [modalTimeline, setModalTimeline] = useState<YeuCauTimelineEntry[]>([]);
  const [modalStatusPayload, setModalStatusPayload] = useState<Record<string, unknown>>({});
  const [modalIt360Tasks, setModalIt360Tasks] = useState<It360TaskFormRow[]>([]);
  const [modalRefTasks, setModalRefTasks] = useState<ReferenceTaskFormRow[]>([]);
  const [modalAttachments, setModalAttachments] = useState<Attachment[]>([]);
  const [modalNotes, setModalNotes] = useState('');
  const [modalActiveTaskTab, setModalActiveTaskTab] = useState<CustomerRequestTaskSource>('IT360');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalUploading, setIsModalUploading] = useState(false);

  const openTransitionModal = (options?: OpenTransitionModalOptions) => {
    void options?.targetProcessMeta;

    const currentHandler =
      people.find((person) => person.vai_tro === 'nguoi_xu_ly')
      ?? people.find((person) => person.vai_tro === 'nguoi_thuc_hien')
      ?? people.find((person) => person.vai_tro === 'nguoi_dieu_phoi');

    const currentOwnerUserId = normalizeText(
      processDetail?.yeu_cau?.current_owner_user_id
      ?? processDetail?.process_row?.data?.to_user_id
    );

    const defaultHandlerUserId = normalizeText(
      options?.handlerUserId
      ?? currentUserId
      ?? currentOwnerUserId
      ?? currentHandler?.user_id
      ?? defaultProcessor?.user_id
    );

    const nextDraft = {
      ...buildInitialTransitionDraft(processDetail, currentUserId, transitionStatusCode),
      ...(options?.payloadOverrides ?? {}),
    };

    setModalStatusPayload(nextDraft);
    setModalIt360Tasks([]);
    setModalRefTasks([]);
    setModalAttachments([]);
    setModalNotes(options?.notes ? normalizeText(options.notes) : '');
    setModalActiveTaskTab('IT360');
    setModalTimeline([]);
    setModalHandlerUserId(normalizeText(options?.handlerUserId ?? defaultHandlerUserId));
    setShowTransitionModal(true);

    if (selectedRequestId) {
      void fetchYeuCauTimeline(selectedRequestId)
        .then((entries) => {
          setModalTimeline(entries);
        })
        .catch(() => {});
    }
  };

  const closeTransitionModal = () => {
    setShowTransitionModal(false);
  };

  const handleModalUpload = async (file: File) => {
    setIsModalUploading(true);
    try {
      const uploaded = await uploadDocumentAttachment(file);
      setModalAttachments((current) => [...current, uploaded]);
    } catch {
      onNotify('error', 'Upload thất bại', 'Không thể tải file lên. Vui lòng thử lại.');
    } finally {
      setIsModalUploading(false);
    }
  };

  const handleTransitionConfirm = async () => {
    if (!selectedRequestId || !transitionStatusCode) {
      return;
    }

    const effectiveTransitionStatusCode = normalizeTransitionTargetStatusCode(transitionStatusCode);

    const validationError = assertTransitionPayload(effectiveTransitionStatusCode, modalStatusPayload);
    if (validationError) {
      onNotify('error', 'Thiếu dữ liệu chuyển trạng thái', validationError);
      return;
    }

    setIsTransitioning(true);
    try {
      const modalIt360Payload = modalIt360Tasks
        .filter((task) => task.task_code.trim() !== '')
        .map((task) => ({
          task_code: task.task_code,
          task_link: task.task_link,
          status: task.status,
          task_source: 'IT360',
        }));

      const modalRefPayload = modalRefTasks
        .filter((task) => task.task_code.trim() !== '' || task.id != null)
        .map((task) => ({
          id: task.id,
          task_code: task.task_code,
          task_source: 'REFERENCE',
        }));

      const transitionFieldPayload = toMutationStatusPayload(
        processDetail,
        modalStatusPayload,
        modalNotes,
        currentUserId,
        effectiveTransitionStatusCode,
      );
      const transitionMetadataPayload = pickTransitionMetadataPayload(modalStatusPayload);
      const normalizedToUserId = normalizeText(transitionFieldPayload.to_user_id);
      const effectiveHandlerUserId = isTargetUserRequired(effectiveTransitionStatusCode)
        ? (normalizedToUserId || modalHandlerUserId || undefined)
        : (modalHandlerUserId || undefined);

      const transitioned = await transitionCustomerRequestCase(selectedRequestId, effectiveTransitionStatusCode, {
        ...transitionFieldPayload,
        ...transitionMetadataPayload,
        handler_user_id: effectiveHandlerUserId,
        nguoi_xu_ly_id: effectiveHandlerUserId,
        ref_tasks: [...modalIt360Payload, ...modalRefPayload],
        attachments: modalAttachments.map((attachment) => ({ id: attachment.id })),
      });

      const newStatusMeta = resolveTransitionStatusMeta(
        transitionProcessMeta ?? {
          process_code: effectiveTransitionStatusCode,
          process_label: effectiveTransitionStatusCode,
          ui_meta: null,
        }
      );
      onNotify(
        'success',
        'Đã chuyển trạng thái',
        `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} → "${newStatusMeta.label}".`
      );

      setShowTransitionModal(false);
      onTransitionSuccess(transitioned.id ?? selectedRequestId, effectiveTransitionStatusCode);
      bumpDataVersion();
    } catch (error) {
      onNotify('error', 'Chuyển trạng thái thất bại', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsTransitioning(false);
    }
  };

  return {
    showTransitionModal,
    closeTransitionModal,
    openTransitionModal,
    modalHandlerUserId,
    setModalHandlerUserId,
    modalTimeline,
    modalStatusPayload,
    setModalStatusPayload,
    modalIt360Tasks,
    setModalIt360Tasks,
    modalRefTasks,
    setModalRefTasks,
    modalAttachments,
    setModalAttachments,
    modalNotes,
    setModalNotes,
    modalActiveTaskTab,
    setModalActiveTaskTab,
    isTransitioning,
    isModalUploading,
    handleModalUpload,
    handleTransitionConfirm,
    updateModalReferenceTask(localId: string, value: string) {
      const found = taskReferenceLookup.get(String(value));
      setModalRefTasks((current) =>
        current.map((task) =>
          task.local_id === localId
            ? { ...task, id: found?.id ?? null, task_code: found?.task_code ?? normalizeText(value) }
            : task
        )
      );
    },
    updateModalIt360Task(localId: string, fieldName: keyof Omit<It360TaskFormRow, 'local_id'>, value: unknown) {
      setModalIt360Tasks((current) =>
        current.map((task) =>
          task.local_id === localId
            ? {
                ...task,
                [fieldName]:
                  fieldName === 'status'
                    ? normalizeSupportTaskStatus(value)
                    : normalizeText(value),
              }
            : task
        )
      );
    },
    addModalIt360Task() {
      setModalIt360Tasks((current) => [...current, createEmptyIt360TaskRow()]);
    },
    addModalReferenceTask() {
      setModalRefTasks((current) => [...current, createEmptyReferenceTaskRow()]);
    },
  };
};
