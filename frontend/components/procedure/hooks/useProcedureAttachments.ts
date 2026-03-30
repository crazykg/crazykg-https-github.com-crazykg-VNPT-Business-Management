import { useCallback, useState } from 'react';
import { uploadDocumentAttachment } from '../../../services/v5Api';
import {
  deleteStepAttachment,
  getStepAttachments,
  linkStepAttachment,
} from '../../../services/api/projectApi';
import type { Attachment, ProjectProcedureStep } from '../../../types';

type ProcedureNotify = ((type: string, title: string, message: string) => void) | undefined;

interface UseProcedureAttachmentsParams {
  onNotify?: ProcedureNotify;
  onBeforeOpenAttachments?: () => void;
}

export const useProcedureAttachments = ({
  onNotify,
  onBeforeOpenAttachments,
}: UseProcedureAttachmentsParams) => {
  const [stepAttachments, setStepAttachments] = useState<Record<string, Attachment[]>>({});
  const [attachLoadingStep, setAttachLoadingStep] = useState<string | null>(null);
  const [openAttachStep, setOpenAttachStep] = useState<string | null>(null);
  const [attachUploading, setAttachUploading] = useState<Record<string, boolean>>({});

  const closeAttachmentPanel = useCallback(() => {
    setOpenAttachStep(null);
  }, []);

  const resetProcedureAttachments = useCallback(() => {
    setStepAttachments({});
    setAttachLoadingStep(null);
    setOpenAttachStep(null);
    setAttachUploading({});
  }, []);

  const handleOpenAttachments = useCallback(async (step: ProjectProcedureStep) => {
    const key = String(step.id);
    if (openAttachStep === key) {
      setOpenAttachStep(null);
      return;
    }

    onBeforeOpenAttachments?.();
    setOpenAttachStep(key);

    if (stepAttachments[key]) {
      return;
    }

    setAttachLoadingStep(key);
    try {
      const list = await getStepAttachments(step.id);
      setStepAttachments((prev) => ({ ...prev, [key]: list }));
    } catch {
      onNotify?.('error', 'Lỗi', 'Không tải được file đính kèm');
    } finally {
      setAttachLoadingStep(null);
    }
  }, [onBeforeOpenAttachments, onNotify, openAttachStep, stepAttachments]);

  const handleUploadStepFile = useCallback(async (stepId: string | number, file: File) => {
    const key = String(stepId);
    setAttachUploading((prev) => ({ ...prev, [key]: true }));

    try {
      const uploaded = await uploadDocumentAttachment(file);
      const saved = await linkStepAttachment(stepId, {
        fileName: uploaded.fileName,
        fileUrl: uploaded.fileUrl,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        driveFileId: uploaded.driveFileId || null,
        storageDisk: uploaded.storageDisk ?? null,
        storagePath: uploaded.storagePath ?? null,
        storageVisibility: uploaded.storageVisibility ?? null,
      });

      const savedWithWarning: typeof saved = uploaded.warningMessage
        ? { ...saved, warningMessage: uploaded.warningMessage }
        : saved;

      setStepAttachments((prev) => ({ ...prev, [key]: [savedWithWarning, ...(prev[key] ?? [])] }));

      if (uploaded.storageProvider === 'BACKBLAZE_B2') {
        return;
      }

      if (uploaded.warningMessage) {
        onNotify?.('warning', '⚠️ B2 không khả dụng — lưu tạm máy chủ', uploaded.warningMessage);
        return;
      }

      onNotify?.('info', 'Đã tải lên', `"${file.name}" lưu trên máy chủ nội bộ.`);
    } catch (error: any) {
      onNotify?.('error', 'Lỗi tải file', error?.message || 'Không thể tải file lên');
    } finally {
      setAttachUploading((prev) => ({ ...prev, [key]: false }));
    }
  }, [onNotify]);

  const handleDeleteAttachment = useCallback(async (stepId: string | number, attachId: string) => {
    if (!window.confirm('Xóa file đính kèm này?')) {
      return;
    }

    const key = String(stepId);
    try {
      await deleteStepAttachment(stepId, attachId);
      setStepAttachments((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((attachment) => String(attachment.id) !== String(attachId)),
      }));
      onNotify?.('success', 'Đã xóa', 'File đính kèm đã được xóa');
    } catch (error: any) {
      onNotify?.('error', 'Lỗi', error?.message || 'Không thể xóa file');
    }
  }, [onNotify]);

  return {
    stepAttachments,
    attachLoadingStep,
    openAttachStep,
    attachUploading,
    closeAttachmentPanel,
    resetProcedureAttachments,
    handleOpenAttachments,
    handleUploadStepFile,
    handleDeleteAttachment,
  };
};
