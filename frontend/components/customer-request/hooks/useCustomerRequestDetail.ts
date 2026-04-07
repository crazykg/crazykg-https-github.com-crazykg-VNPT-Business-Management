import { useCallback, useEffect, useState } from 'react';
import {
  useCRCProcessDetail,
  useCRCTimeline,
  useCRCWorklogs,
} from '../../../shared/hooks/useCustomerRequests';
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

  const detailEnabled = !isCreateMode && Boolean(selectedRequestId) && Boolean(activeEditorProcessCode);
  const detailQuery = useCRCProcessDetail(selectedRequestId, {
    processCode: activeEditorProcessCode,
    enabled: detailEnabled,
  });
  const timelineQuery = useCRCTimeline(selectedRequestId, { enabled: detailEnabled });
  const worklogsQuery = useCRCWorklogs(selectedRequestId, { enabled: detailEnabled });

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
  }, [createInitialFields, masterFields]);

  const resetSelectedRequestState = useCallback(() => {
    setProcessDetail(null);
    setPeople([]);
    setFormAttachments([]);
    setFormIt360Tasks([]);
    setFormReferenceTasks([]);
    setTimeline([]);
    setCaseWorklogs([]);
  }, []);

  useEffect(() => {
    if (isCreateMode) {
      resetCreateModeState();
      return;
    }

    if (!selectedRequestId || !activeEditorProcessCode) {
      resetSelectedRequestState();
    }
  }, [
    activeEditorProcessCode,
    isCreateMode,
    resetCreateModeState,
    resetSelectedRequestState,
    selectedRequestId,
  ]);

  useEffect(() => {
    if (dataVersion <= 0 || !detailEnabled) {
      return;
    }

    void Promise.all([
      detailQuery.refetch(),
      timelineQuery.refetch(),
      worklogsQuery.refetch(),
    ]);
  }, [dataVersion, detailEnabled, detailQuery.refetch, timelineQuery.refetch, worklogsQuery.refetch]);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail || !detailEnabled) {
      return;
    }

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
    if (timelineQuery.data) {
      setTimeline(timelineQuery.data);
    }
    if (worklogsQuery.data) {
      setCaseWorklogs(worklogsQuery.data);
    } else if (Array.isArray(detail.worklogs)) {
      setCaseWorklogs(detail.worklogs);
    }
  }, [
    detailEnabled,
    detailQuery.data,
    masterFields,
    timelineQuery.data,
    worklogsQuery.data,
  ]);

  useEffect(() => {
    if (!detailEnabled) {
      return;
    }

    if (timelineQuery.data) {
      setTimeline(timelineQuery.data);
    }
  }, [detailEnabled, timelineQuery.data]);

  useEffect(() => {
    if (!detailEnabled) {
      return;
    }

    if (worklogsQuery.data) {
      setCaseWorklogs(worklogsQuery.data);
      return;
    }

    if (worklogsQuery.error && Array.isArray(detailQuery.data?.worklogs)) {
      setCaseWorklogs(detailQuery.data.worklogs);
    }
  }, [detailEnabled, detailQuery.data?.worklogs, worklogsQuery.data, worklogsQuery.error]);

  useEffect(() => {
    const firstError = [detailQuery.error, timelineQuery.error, worklogsQuery.error].find(Boolean);
    if (!firstError) {
      return;
    }

    onError(firstError instanceof Error ? firstError.message : 'Đã xảy ra lỗi.');
  }, [detailQuery.error, onError, timelineQuery.error, worklogsQuery.error]);

  const refreshDetail = useCallback(async () => {
    if (!detailEnabled) {
      return;
    }

    await Promise.all([
      detailQuery.refetch(),
      timelineQuery.refetch(),
      worklogsQuery.refetch(),
    ]);
  }, [detailEnabled, detailQuery.refetch, timelineQuery.refetch, worklogsQuery.refetch]);

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
    isDetailLoading: detailEnabled
      ? (
          detailQuery.isLoading
          || detailQuery.isFetching
          || timelineQuery.isLoading
          || timelineQuery.isFetching
          || worklogsQuery.isLoading
          || worklogsQuery.isFetching
        )
      : false,
    refreshDetail,
  };
};
