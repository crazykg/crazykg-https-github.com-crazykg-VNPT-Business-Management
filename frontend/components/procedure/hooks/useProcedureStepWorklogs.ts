import { useCallback, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  addStepWorklog,
  deleteStepWorklog,
  fetchStepWorklogs,
  updateIssueStatus,
  updateStepWorklog,
} from '../../../services/api/projectApi';
import type {
  IssueStatus,
  ProjectProcedureStep,
  ProcedureStepWorklog,
} from '../../../types';

type ProcedureNotify = ((type: string, title: string, message: string) => void) | undefined;

const isCountableWorklog = (log: Pick<ProcedureStepWorklog, 'log_type' | 'content'>): boolean =>
  log.log_type !== 'CUSTOM' && log.content.trim().length > 0;

interface UseProcedureStepWorklogsParams {
  inflightRef: MutableRefObject<Set<string>>;
  onNotify?: ProcedureNotify;
  onBeforeOpenStepWorklog?: () => void;
  setSteps: Dispatch<SetStateAction<ProjectProcedureStep[]>>;
  setWorklogs: Dispatch<SetStateAction<ProcedureStepWorklog[]>>;
}

export const useProcedureStepWorklogs = ({
  inflightRef,
  onNotify,
  onBeforeOpenStepWorklog,
  setSteps,
  setWorklogs,
}: UseProcedureStepWorklogsParams) => {
  const [openWorklogStep, setOpenWorklogStep] = useState<string | number | null>(null);
  const [stepWorklogs, setStepWorklogs] = useState<Record<string, ProcedureStepWorklog[]>>({});
  const [stepWorklogInput, setStepWorklogInput] = useState<Record<string, string>>({});
  const [stepWorklogSaving, setStepWorklogSaving] = useState<Record<string, boolean>>({});
  const [stepWorklogHours, setStepWorklogHours] = useState<Record<string, string>>({});
  const [stepWorklogDifficulty, setStepWorklogDifficulty] = useState<Record<string, string>>({});
  const [stepWorklogProposal, setStepWorklogProposal] = useState<Record<string, string>>({});
  const [stepWorklogIssueStatus, setStepWorklogIssueStatus] = useState<Record<string, IssueStatus>>({});
  const [editingWorklogId, setEditingWorklogId] = useState<string | number | null>(null);
  const [editWorklogContent, setEditWorklogContent] = useState('');
  const [editWorklogHours, setEditWorklogHours] = useState('');
  const [editWorklogDiff, setEditWorklogDiff] = useState('');
  const [editWorklogProposal, setEditWorklogProposal] = useState('');
  const [editWorklogStatus, setEditWorklogStatus] = useState<IssueStatus>('JUST_ENCOUNTERED');
  const [editWorklogSaving, setEditWorklogSaving] = useState(false);
  const [deletingWorklogId, setDeletingWorklogId] = useState<string | number | null>(null);

  const closeStepWorklogPanel = useCallback(() => {
    setOpenWorklogStep(null);
  }, []);

  const resetProcedureStepWorklogs = useCallback(() => {
    setOpenWorklogStep(null);
    setStepWorklogs({});
    setStepWorklogInput({});
    setStepWorklogSaving({});
    setStepWorklogHours({});
    setStepWorklogDifficulty({});
    setStepWorklogProposal({});
    setStepWorklogIssueStatus({});
    setEditingWorklogId(null);
    setEditWorklogContent('');
    setEditWorklogHours('');
    setEditWorklogDiff('');
    setEditWorklogProposal('');
    setEditWorklogStatus('JUST_ENCOUNTERED');
    setEditWorklogSaving(false);
    setDeletingWorklogId(null);
  }, []);

  const handleToggleStepWorklog = useCallback(async (stepId: string | number) => {
    if (openWorklogStep === stepId) {
      setOpenWorklogStep(null);
      return;
    }

    onBeforeOpenStepWorklog?.();
    setOpenWorklogStep(stepId);

    if (!stepWorklogs[String(stepId)]) {
      try {
        const logs = await fetchStepWorklogs(stepId);
        setStepWorklogs((prev) => ({ ...prev, [String(stepId)]: logs }));
      } catch {
        // silent: this panel already surfaces empty state without blocking the row
      }
    }
  }, [onBeforeOpenStepWorklog, openWorklogStep, stepWorklogs]);

  const handleAddStepWorklog = useCallback(async (stepId: string | number) => {
    const key = `wlog-${stepId}`;
    if (inflightRef.current.has(key)) {
      return;
    }

    const sid = String(stepId);
    const content = (stepWorklogInput[sid] || '').trim();
    if (!content) {
      return;
    }

    inflightRef.current.add(key);
    setStepWorklogSaving((prev) => ({ ...prev, [sid]: true }));
    try {
      const hoursRaw = parseFloat(stepWorklogHours[sid] || '');
      const difficulty = (stepWorklogDifficulty[sid] || '').trim();
      const log = await addStepWorklog(stepId, {
        content,
        hours_spent: Number.isNaN(hoursRaw) ? null : hoursRaw,
        difficulty: difficulty || null,
        proposal: difficulty ? (stepWorklogProposal[sid] || '').trim() || null : null,
        issue_status: difficulty ? (stepWorklogIssueStatus[sid] || 'JUST_ENCOUNTERED') : null,
      });

      setStepWorklogs((prev) => ({ ...prev, [sid]: [log, ...(prev[sid] || [])] }));
      setSteps((prev) => prev.map((step) =>
        String(step.id) === sid
          ? {
              ...step,
              worklogs_count: (step.worklogs_count ?? 0) + (isCountableWorklog(log) ? 1 : 0),
              blocking_worklogs_count: (step.blocking_worklogs_count ?? 0) + (isCountableWorklog(log) ? 1 : 0),
            }
          : step
      ));
      setStepWorklogInput((prev) => ({ ...prev, [sid]: '' }));
      setStepWorklogHours((prev) => ({ ...prev, [sid]: '' }));
      setStepWorklogDifficulty((prev) => ({ ...prev, [sid]: '' }));
      setStepWorklogProposal((prev) => ({ ...prev, [sid]: '' }));
      setStepWorklogIssueStatus((prev) => ({ ...prev, [sid]: 'JUST_ENCOUNTERED' }));
      setWorklogs((prev) => {
        if (!prev.some((worklog) => worklog.id === log.id)) {
          return [log, ...prev];
        }
        return prev;
      });
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể thêm worklog');
    } finally {
      inflightRef.current.delete(key);
      setStepWorklogSaving((prev) => ({ ...prev, [sid]: false }));
    }
  }, [
    inflightRef,
    onNotify,
    setSteps,
    setWorklogs,
    stepWorklogDifficulty,
    stepWorklogHours,
    stepWorklogInput,
    stepWorklogIssueStatus,
    stepWorklogProposal,
  ]);

  const handleUpdateIssueStatus = useCallback(async (
    stepId: string | number,
    issueId: string | number,
    newStatus: IssueStatus,
  ) => {
    try {
      const updated = await updateIssueStatus(issueId, newStatus);
      setStepWorklogs((prev) => {
        const logs = prev[String(stepId)] || [];
        return {
          ...prev,
          [String(stepId)]: logs.map((log) =>
            log.issue && String(log.issue.id) === String(issueId)
              ? { ...log, issue: { ...log.issue, issue_status: updated.issue_status } }
              : log,
          ),
        };
      });
      setWorklogs((prev) => prev.map((log) =>
        log.issue && String(log.issue.id) === String(issueId)
          ? { ...log, issue: { ...log.issue, issue_status: updated.issue_status } }
          : log,
      ));
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể cập nhật trạng thái');
    }
  }, [onNotify, setWorklogs]);

  const handleStartEditWorklog = useCallback((log: ProcedureStepWorklog) => {
    setEditingWorklogId(log.id);
    setEditWorklogContent(log.content);
    setEditWorklogHours(log.timesheet ? String(Number(log.timesheet.hours_spent)) : '');
    setEditWorklogDiff(log.issue?.issue_content ?? '');
    setEditWorklogProposal(log.issue?.proposal_content ?? '');
    setEditWorklogStatus(log.issue?.issue_status ?? 'JUST_ENCOUNTERED');
  }, []);

  const handleCancelEditWorklog = useCallback(() => {
    setEditingWorklogId(null);
    setEditWorklogContent('');
    setEditWorklogHours('');
    setEditWorklogDiff('');
    setEditWorklogProposal('');
    setEditWorklogStatus('JUST_ENCOUNTERED');
  }, []);

  const handleSaveEditWorklog = useCallback(async (
    stepId: string | number,
    logId: string | number,
  ) => {
    const content = editWorklogContent.trim();
    if (!content || editWorklogSaving) {
      return;
    }

    setEditWorklogSaving(true);
    try {
      const hoursRaw = parseFloat(editWorklogHours);
      const difficulty = editWorklogDiff.trim();
      const updated = await updateStepWorklog(logId, {
        content,
        hours_spent: Number.isNaN(hoursRaw) ? null : hoursRaw,
        difficulty: difficulty || null,
        proposal: difficulty ? editWorklogProposal.trim() || null : null,
        issue_status: difficulty ? editWorklogStatus : null,
      });

      setStepWorklogs((prev) => {
        const list = prev[String(stepId)] || [];
        return { ...prev, [String(stepId)]: list.map((log) => String(log.id) === String(logId) ? updated : log) };
      });
      setWorklogs((prev) => prev.map((log) => String(log.id) === String(logId) ? updated : log));
      handleCancelEditWorklog();
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể lưu chỉnh sửa');
    } finally {
      setEditWorklogSaving(false);
    }
  }, [
    editWorklogContent,
    editWorklogDiff,
    editWorklogHours,
    editWorklogProposal,
    editWorklogSaving,
    editWorklogStatus,
    handleCancelEditWorklog,
    onNotify,
    setWorklogs,
  ]);

  const handleDeleteStepWorklog = useCallback(async (
    stepId: string | number,
    log: ProcedureStepWorklog,
  ) => {
    if (deletingWorklogId !== null || editWorklogSaving) {
      return;
    }

    if (!window.confirm('Bạn có chắc muốn xoá worklog này?')) {
      return;
    }

    setDeletingWorklogId(log.id);
    try {
      await deleteStepWorklog(log.id);
      setStepWorklogs((prev) => {
        const sid = String(stepId);
        const list = prev[sid] || [];
        return {
          ...prev,
          [sid]: list.filter((item) => String(item.id) !== String(log.id)),
        };
      });
      setSteps((prev) => prev.map((step) =>
        String(step.id) === String(stepId)
          ? {
              ...step,
              worklogs_count: Math.max(0, (step.worklogs_count ?? (isCountableWorklog(log) ? 1 : 0)) - (isCountableWorklog(log) ? 1 : 0)),
              blocking_worklogs_count: Math.max(
                0,
                (step.blocking_worklogs_count ?? (isCountableWorklog(log) ? 1 : 0)) - (isCountableWorklog(log) ? 1 : 0),
              ),
            }
          : step
      ));
      setWorklogs((prev) => prev.filter((item) => String(item.id) !== String(log.id)));

      if (String(editingWorklogId) === String(log.id)) {
        handleCancelEditWorklog();
      }
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể xoá worklog');
    } finally {
      setDeletingWorklogId(null);
    }
  }, [
    deletingWorklogId,
    editWorklogSaving,
    editingWorklogId,
    handleCancelEditWorklog,
    onNotify,
    setSteps,
    setWorklogs,
  ]);

  const handleSetWlogInput = useCallback((stepId: string | number, value: string) => {
    setStepWorklogInput((prev) => ({ ...prev, [String(stepId)]: value }));
  }, []);

  const handleSetWlogHours = useCallback((stepId: string | number, value: string) => {
    setStepWorklogHours((prev) => ({ ...prev, [String(stepId)]: value }));
  }, []);

  const handleSetWlogDifficulty = useCallback((stepId: string | number, value: string) => {
    setStepWorklogDifficulty((prev) => ({ ...prev, [String(stepId)]: value }));
  }, []);

  const handleSetWlogProposal = useCallback((stepId: string | number, value: string) => {
    setStepWorklogProposal((prev) => ({ ...prev, [String(stepId)]: value }));
  }, []);

  const handleSetWlogIssueStatus = useCallback((stepId: string | number, value: IssueStatus) => {
    setStepWorklogIssueStatus((prev) => ({ ...prev, [String(stepId)]: value }));
  }, []);

  return {
    openWorklogStep,
    stepWorklogs,
    stepWorklogInput,
    stepWorklogSaving,
    stepWorklogHours,
    stepWorklogDifficulty,
    stepWorklogProposal,
    stepWorklogIssueStatus,
    editingWorklogId,
    editWorklogContent,
    editWorklogHours,
    editWorklogDiff,
    editWorklogProposal,
    editWorklogStatus,
    editWorklogSaving,
    deletingWorklogId,
    setEditWorklogContent,
    setEditWorklogHours,
    setEditWorklogDiff,
    setEditWorklogProposal,
    setEditWorklogStatus,
    closeStepWorklogPanel,
    resetProcedureStepWorklogs,
    handleToggleStepWorklog,
    handleAddStepWorklog,
    handleUpdateIssueStatus,
    handleStartEditWorklog,
    handleCancelEditWorklog,
    handleSaveEditWorklog,
    handleDeleteStepWorklog,
    handleSetWlogInput,
    handleSetWlogHours,
    handleSetWlogDifficulty,
    handleSetWlogProposal,
    handleSetWlogIssueStatus,
  };
};
