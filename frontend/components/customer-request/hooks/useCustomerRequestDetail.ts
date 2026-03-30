import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [formIt360Tasks, setFormIt360Tasks] = useState<It360TaskFormRow[]>([]);
  const [formReferenceTasks, setFormReferenceTasks] = useState<ReferenceTaskFormRow[]>([]);
  const [timeline, setTimeline] = useState<YeuCauTimelineEntry[]>([]);
  const [caseWorklogs, setCaseWorklogs] = useState<YeuCauWorklog[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const requestSequenceRef = useRef(0);

  const resetCreateModeState = useCallback(() => {
    setPeople([]);
    setMasterDraft(buildDraftFromFields(masterFields, null));
    setProcessDraft(buildDraftFromFields(createInitialFields, null));
    setProcessDetail(null);
    setFormAttachments([]);
    setFormIt360Tasks([]);
    setFormReferenceTasks([]);
    setTimeline([]);
    setCaseWorklogs([]);
    setIsDetailLoading(false);
  }, [createInitialFields, masterFields]);

  const resetSelectedRequestState = useCallback(() => {
    setProcessDetail(null);
    setPeople([]);
    setFormAttachments([]);
    setFormIt360Tasks([]);
    setFormReferenceTasks([]);
    setTimeline([]);
    setCaseWorklogs([]);
    setIsDetailLoading(false);
  }, []);

  const loadDetail = useCallback(
    async (preserveCurrent = false) => {
      if (!selectedRequestId || !activeEditorProcessCode) {
        return;
      }

      const requestSequence = ++requestSequenceRef.current;
      setIsDetailLoading(true);

      if (!preserveCurrent) {
        setProcessDetail(null);
        setPeople([]);
        setFormAttachments([]);
        setFormIt360Tasks([]);
        setFormReferenceTasks([]);
        setTimeline([]);
        setCaseWorklogs([]);
      }

      try {
        const results = await Promise.allSettled([
          fetchYeuCauProcessDetail(selectedRequestId, activeEditorProcessCode),
          fetchYeuCauTimeline(selectedRequestId),
          fetchYeuCauWorklogs(selectedRequestId),
        ]);

        if (requestSequenceRef.current !== requestSequence) {
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
        setFormIt360Tasks(it360Rows);
        setFormReferenceTasks(referenceRows);
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
      } catch (error) {
        if (requestSequenceRef.current !== requestSequence) {
          return;
        }
        onError(error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          setIsDetailLoading(false);
        }
      }
    },
    [activeEditorProcessCode, masterFields, onError, selectedRequestId]
  );

  useEffect(() => {
    requestSequenceRef.current += 1;

    if (isCreateMode) {
      resetCreateModeState();
      return;
    }

    if (!selectedRequestId || !activeEditorProcessCode) {
      resetSelectedRequestState();
      return;
    }

    void loadDetail();
  }, [
    activeEditorProcessCode,
    dataVersion,
    isCreateMode,
    loadDetail,
    resetCreateModeState,
    resetSelectedRequestState,
    selectedRequestId,
  ]);

  const refreshDetail = useCallback(async () => {
    if (isCreateMode || !selectedRequestId || !activeEditorProcessCode) {
      return;
    }

    await loadDetail(true);
  }, [activeEditorProcessCode, isCreateMode, loadDetail, selectedRequestId]);

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
    setCaseWorklogs,
    isDetailLoading,
    refreshDetail,
  };
};
