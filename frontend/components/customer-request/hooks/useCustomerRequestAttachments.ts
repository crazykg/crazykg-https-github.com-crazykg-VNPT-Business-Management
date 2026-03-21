import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { uploadDocumentAttachment } from '../../../services/v5Api';
import type { Attachment } from '../../../types';
import { normalizeText } from '../helpers';

type UseCustomerRequestAttachmentsOptions = {
  canEdit: boolean;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
};

export const useCustomerRequestAttachments = ({
  canEdit,
  setAttachments,
}: UseCustomerRequestAttachmentsOptions) => {
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [attachmentNotice, setAttachmentNotice] = useState('');

  const resetAttachmentFeedback = () => {
    setAttachmentError('');
    setAttachmentNotice('');
  };

  const handleUploadAttachment = async (file: File) => {
    if (!canEdit) {
      return;
    }

    resetAttachmentFeedback();
    setIsUploadingAttachment(true);

    try {
      const uploaded = await uploadDocumentAttachment(file);
      setAttachments((current) => [...current, uploaded]);
      if (normalizeText(uploaded.warningMessage) !== '') {
        setAttachmentNotice(normalizeText(uploaded.warningMessage));
      }
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Tải file thất bại.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (id: string | number) => {
    if (!canEdit) {
      return;
    }

    const confirmed = window.confirm('Gỡ file này khỏi yêu cầu? File đã tải lên sẽ không bị xóa khỏi kho lưu trữ.');
    if (!confirmed) {
      return;
    }

    resetAttachmentFeedback();
    setAttachments((current) => current.filter((attachment) => String(attachment.id) !== String(id)));
  };

  return {
    isUploadingAttachment,
    attachmentError,
    attachmentNotice,
    resetAttachmentFeedback,
    handleUploadAttachment,
    handleRemoveAttachment,
  };
};
