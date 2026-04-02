import { useState } from 'react';
import {
  fetchYeuCauTimeline,
  transitionCustomerRequestCase,
  uploadDocumentAttachment,
} from '../../../services/v5Api';
import type {
  Attachment,
  ProjectRaciRow,
  YeuCauProcessDetail,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
} from '../../../types';
import {
  type DraftState,
  buildPayloadFromDraft,
  buildTransitionDraftFromFields,
  createEmptyIt360TaskRow,
  createEmptyReferenceTaskRow,
  normalizeSupportTaskStatus,
  normalizeText,
} from '../helpers';
import {
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
    const effectiveProcessMeta = options?.targetProcessMeta ?? transitionProcessMeta;
    const statusRowData = processDetail?.process_row?.data as Record<string, unknown> | undefined;
    const processRowData = processDetail?.process_row?.data as Record<string, unknown> | undefined;
    const currentStatusCode = normalizeText(
      processDetail?.yeu_cau?.current_status_code ?? processDetail?.yeu_cau?.trang_thai
    );
    const receiverUserId = normalizeText(
      statusRowData?.receiver_user_id
      ?? processRowData?.receiver_user_id
      ?? processDetail?.yeu_cau?.receiver_user_id
    );
    const completedByUserId = normalizeText(
      currentStatusCode === 'completed'
        ? statusRowData?.completed_by_user_id ?? statusRowData?.created_by
        : null
    );
    const activePerformer = people.find(
      (person) => person.vai_tro === 'nguoi_thuc_hien' && normalizeText(person.is_active) !== '0'
    );
    const fallbackCurrentHandlerUserId = normalizeText(
      processDetail?.yeu_cau?.nguoi_xu_ly_id
      || processDetail?.yeu_cau?.current_owner_user_id
      || receiverUserId
      || completedByUserId
      || activePerformer?.user_id
      || processDetail?.yeu_cau?.performer_user_id
      || defaultProcessor?.user_id
    );
    const currentHandler =
      (fallbackCurrentHandlerUserId
        ? people.find((person) => normalizeText(person.user_id) === fallbackCurrentHandlerUserId)
        : null)
      ?? activePerformer
      ?? people.find((person) => person.vai_tro === 'nguoi_dieu_phoi' && normalizeText(person.is_active) !== '0')
      ?? people.find((person) => person.vai_tro === 'nguoi_xu_ly' && normalizeText(person.is_active) !== '0')
      ?? people.find((person) => person.vai_tro === 'nguoi_thuc_hien')
      ?? people.find((person) => person.vai_tro === 'nguoi_dieu_phoi')
      ?? people.find((person) => person.vai_tro === 'nguoi_xu_ly');
    const defaultHandlerUserId = String(
      fallbackCurrentHandlerUserId || currentHandler?.user_id || defaultProcessor?.user_id || ''
    );
    const currentPerformerUserId = normalizeText(
      processDetail?.yeu_cau?.performer_user_id
      ?? receiverUserId
      ?? completedByUserId
      ?? currentHandler?.user_id
      ?? defaultProcessor?.user_id
    );

    const nextDraft = {
      ...buildTransitionDraftFromFields(effectiveProcessMeta?.form_fields ?? [], {
        actorUserId: currentUserId,
        defaultHandlerUserId,
        currentPerformerUserId,
      }),
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

    if (transitionStatusCode === 'waiting_customer_feedback') {
      const feedbackRequestedAt = String(modalStatusPayload.feedback_requested_at ?? '');
      const customerDueAt = String(modalStatusPayload.customer_due_at ?? '');
      if (feedbackRequestedAt && customerDueAt && feedbackRequestedAt > customerDueAt) {
        onNotify('error', 'Ngày không hợp lệ', 'Ngày phản hồi KH không được sau Ngày KH phản hồi.');
        return;
      }
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

      const transitionPayloadDraft: DraftState = { ...modalStatusPayload };
      if ((transitionProcessMeta?.form_fields ?? []).some((field) => field.name === 'notes')) {
        transitionPayloadDraft.notes = modalNotes;
      }
      const transitionFieldPayload = transitionProcessMeta
        ? buildPayloadFromDraft(transitionProcessMeta.form_fields, transitionPayloadDraft)
        : {};
      const transitionMetadataPayload = pickTransitionMetadataPayload(modalStatusPayload);

      const transitioned = await transitionCustomerRequestCase(selectedRequestId, transitionStatusCode, {
        ...transitionFieldPayload,
        ...transitionMetadataPayload,
        handler_user_id: modalHandlerUserId || undefined,
        nguoi_xu_ly_id: modalHandlerUserId || undefined,
        ref_tasks: [...modalIt360Payload, ...modalRefPayload],
        attachments: modalAttachments.map((attachment) => ({ id: attachment.id })),
      });

      const newStatusMeta = resolveTransitionStatusMeta(
        transitionProcessMeta ?? {
          process_code: transitionStatusCode,
          process_label: transitionStatusCode,
          ui_meta: null,
        }
      );
      onNotify(
        'success',
        'Đã chuyển trạng thái',
        `Yêu cầu ${transitioned.ma_yc ?? transitioned.request_code ?? ''} → "${newStatusMeta.label}".`
      );

      setShowTransitionModal(false);
      onTransitionSuccess(transitioned.id ?? selectedRequestId, transitionStatusCode);
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
