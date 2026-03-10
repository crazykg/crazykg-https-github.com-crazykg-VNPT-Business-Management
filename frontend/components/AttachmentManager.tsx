import React, { useRef, useState } from 'react';
import { Attachment } from '../types';

interface AttachmentManagerProps {
  attachments: Attachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUploading: boolean;
  helperText?: string;
  emptyStateDescription?: string;
  uploadButtonLabel?: string;
}

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getAttachmentExtensionLabel = (attachment: Attachment) => {
  const mimePart = String(attachment.mimeType || '').split('/')[1];
  if (mimePart) {
    return mimePart.toUpperCase();
  }

  const fileName = String(attachment.fileName || '').trim();
  const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
  return String(extension || 'FILE').toUpperCase();
};

const isGoogleDriveAttachment = (attachment: Attachment) =>
  attachment.storageProvider === 'GOOGLE_DRIVE'
  || String(attachment.driveFileId || '').trim() !== ''
  || String(attachment.fileUrl || '').includes('drive.google.com');

const isBackblazeB2Attachment = (attachment: Attachment) =>
  attachment.storageProvider === 'BACKBLAZE_B2'
  || String(attachment.storageDisk || '').trim() === 'backblaze_b2';

const getAttachmentProviderLabel = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) {
    return 'Google Drive';
  }

  if (isBackblazeB2Attachment(attachment)) {
    return 'Backblaze B2';
  }

  return 'Máy chủ nội bộ';
};

const getAttachmentProviderTone = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (isBackblazeB2Attachment(attachment)) {
    return 'bg-sky-50 text-sky-700';
  }

  return 'bg-amber-50 text-amber-700';
};

const getAttachmentOpenLinkLabel = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) {
    return 'Mở Google Drive';
  }

  if (isBackblazeB2Attachment(attachment)) {
    return 'Mở view file';
  }

  return 'Mở view+tải file';
};

const getAttachmentLinkText = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) {
    return 'Link mở file trên Google Drive';
  }

  if (isBackblazeB2Attachment(attachment)) {
    return 'Link mở view file qua Cloud';
  }

  return 'Link mở view+tải file';
};

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  attachments,
  onUpload,
  onDelete,
  isUploading,
  helperText = 'Sau khi tải lên, hệ thống hiển thị luôn liên kết mở file tương ứng.',
  emptyStateDescription = 'Tải file lên để nhận ngay liên kết mở file từ kho lưu trữ đang cấu hình hoặc máy chủ nội bộ.',
  uploadButtonLabel = 'Tải file',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    try {
      for (const file of files) {
        await onUpload(file);
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const copyAttachmentLink = async (attachment: Attachment) => {
    const link = String(attachment.fileUrl || '').trim();
    if (link === '' || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(link);
    setCopiedLinkId(String(attachment.id));
    window.setTimeout(() => {
      setCopiedLinkId((current) => (current === String(attachment.id) ? null : current));
    }, 1800);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className="material-symbols-outlined text-lg text-primary">attach_file</span>
            Danh sách file đính kèm
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {attachments.length} file
            </span>
            <span className="text-xs text-slate-500">{helperText}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          ) : (
            <span className="material-symbols-outlined text-base">upload</span>
          )}
          {uploadButtonLabel}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        {attachments.length > 0 ? (
          attachments.map((file) => {
            const linkLabel = getAttachmentOpenLinkLabel(file);
            const linkText = getAttachmentLinkText(file);

            return (
              <div
                key={file.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-xl">description</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900" title={file.fileName}>
                            {file.fileName}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {getAttachmentExtensionLabel(file)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getAttachmentProviderTone(file)}`}
                          >
                            {getAttachmentProviderLabel(file)}
                          </span>
                          <span className="text-xs font-medium text-slate-500">{formatSize(file.fileSize)}</span>
                        </div>

                        {String(file.fileUrl || '').trim() !== '' ? (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                {linkLabel}
                              </a>
                              <button
                                type="button"
                                onClick={() => void copyAttachmentLink(file)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {copiedLinkId === String(file.id) ? 'check' : 'content_copy'}
                                </span>
                                {copiedLinkId === String(file.id) ? 'Đã sao chép' : 'Sao chép link'}
                              </button>
                            </div>
                            <a
                              href={file.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-blue-600 underline-offset-2 hover:underline"
                              title={file.fileUrl}
                            >
                              {linkText}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onDelete(file.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      title="Gỡ file khỏi yêu cầu"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
              <span className="material-symbols-outlined text-2xl">upload_file</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">Chưa có file nào được tải lên.</p>
            <p className="mt-1 text-xs text-slate-500">{emptyStateDescription}</p>
          </div>
        )}
      </div>

    </div>
  );
};
