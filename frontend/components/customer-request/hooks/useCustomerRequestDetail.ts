import { useEffect, useState } from 'react';
import {
  fetchYeuCauProcessDetail,
  fetchYeuCauTimeline,
  fetchYeuCauWorklogs,
} from '../../../services/v5Api';
import type {
  Attachment,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
  YeuCauWorklog,
} from '../../../types';
import type { DraftState } from '../helpers';
import {
  buildDraftFromFields,
  createEmptyIt360TaskRow,
  createEmptyReferenceTaskRow,
  splitCustomerRequestTaskRows,
} from '../helpers';
import type { It360TaskFormRow, ReferenceTaskFormRow } from '../presentation';

type UseCustomerRequestDetailOptions = {
  isCreateMode: boolean;
  selectedRequestId: string | number | null;
  activeEditorProcessCode: string;
  dataVersion: number;
  masterFields: YeuCauProcessField[];
  createInitialFields: YeuCauProcessField[];
  onError: (message: string) => void;
};

export const useCustomerRequestDetail = ({
  isCreateMode,
  selectedRequestId,
  activeEditorProcessCode,
  dataVersion,
  masterFields,
  createInitialFields,
  onError,
}: UseCustomerRequestDetailOptions) => {
  const [processDetail, setProcessDetail] = useState<YeuCauProcessDetail | null>(null);
  const [people, setPeople] = useState<YeuCauRelatedUser[]>([]);
  const [masterDraft, setMasterDraft] = useState<DraftState>({});
  const [processDraft, setProcessDraft] = useState<DraftState>({});
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [formIt360Tasks, setFormIt360Tasks] = useState<It360TaskFormRow[]>([createEmptyIt360TaskRow()]);
  const [formReferenceTasks, setFormReferenceTasks] = useState<ReferenceTaskFormRow[]>([createEmptyReferenceTaskRow()]);
  const [timeline, setTimeline] = useState<YeuCauTimelineEntry[]>([]);
  const [caseWorklogs, setCaseWorklogs] = useState<YeuCauWorklog[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    if (isCreateMode) {
      setPeople([]);
      setMasterDraft(buildDraftFromFields(masterFields, null));
      setProcessDraft(buildDraftFromFields(createInitialFields, null));
      setProcessDetail(null);
      setFormAttachments([]);
      setFormIt360Tasks([createEmptyIt360TaskRow()]);
      setFormReferenceTasks([createEmptyReferenceTaskRow()]);
      setTimeline([]);
      setCaseWorklogs([]);
      return;
    }

    if (!selectedRequestId || !activeEditorProcessCode) {
      setProcessDetail(null);
      setPeople([]);
      setFormAttachments([]);
      setFormIt360Tasks([createEmptyIt360TaskRow()]);
      setFormReferenceTasks([createEmptyReferenceTaskRow()]);
      setTimeline([]);
      setCaseWorklogs([]);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    setProcessDetail(null);
    setPeople([]);
    setFormAttachments([]);
    setFormIt360Tasks([createEmptyIt360TaskRow()]);
    setFormReferenceTasks([createEmptyReferenceTaskRow()]);
    setTimeline([]);
    setCaseWorklogs([]);

    void Promise.allSettled([
      fetchYeuCauProcessDetail(selectedRequestId, activeEditorProcessCode),
      fetchYeuCauTimeline(selectedRequestId),
      fetchYeuCauWorklogs(selectedRequestId),
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [detailResult, timelineResult, worklogsResult] = results;
        if (detailResult.status !== 'fulfilled') {
          throw detailResult.reason;
        }

        const detail = detailResult.value;
        const { it360Rows, referenceRows } = splitCustomerRequestTaskRows(
          Array.isArray(detail.ref_tasks) ? detail.ref_tasks : []
        );

        setProcessDetail(detail);
        setPeople(Array.isArray(detail.people) ? detail.people : []);
        setMasterDraft(buildDraftFromFields(masterFields, detail.yeu_cau as unknown as Record<string, unknown>));
        setProcessDraft(buildDraftFromFields(detail.process.form_fields, detail.process_row?.data));
        setFormAttachments(Array.isArray(detail.attachments) ? detail.attachments : []);
        setFormIt360Tasks(it360Rows.length > 0 ? it360Rows : [createEmptyIt360TaskRow()]);
        setFormReferenceTasks(referenceRows.length > 0 ? referenceRows : [createEmptyReferenceTaskRow()]);
        setTimeline(
          timelineResult.status === 'fulfilled' && Array.isArray(timelineResult.value)
            ? timelineResult.value
            : []
        );
        setCaseWorklogs(
          worklogsResult.status === 'fulfilled' && Array.isArray(worklogsResult.value)
            ? worklogsResult.value
            : Array.isArray(detail.worklogs)
            ? detail.worklogs
            : []
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onError(error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeEditorProcessCode,
    createInitialFields,
    dataVersion,
    isCreateMode,
    masterFields,
    onError,
    selectedRequestId,
  ]);

  return {
    processDetail,
    setProcessDetail,
    people,
    setPeople,
    masterDraft,
    setMasterDraft,
    processDraft,
    setProcessDraft,
    formAttachments,
    setFormAttachments,
    formIt360Tasks,
    setFormIt360Tasks,
    formReferenceTasks,
    setFormReferenceTasks,
    timeline,
    caseWorklogs,
    isDetailLoading,
  };
};
