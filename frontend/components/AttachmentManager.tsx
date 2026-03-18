import React, { useRef, useState } from 'react';
import { Attachment } from '../types';

interface AttachmentManagerProps {
  attachments: Attachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
  helperText?: string;
  emptyStateDescription?: string;
  uploadButtonLabel?: string;
  enableClipboardPaste?: boolean;
  clipboardPasteHint?: string;
}

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/** Map MIME → nhãn hiển thị gọn */
const MIME_LABEL_MAP: Record<string, string> = {
  'application/pdf':                                                                    'PDF',
  'application/msword':                                                                 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':           'Word',
  'application/vnd.ms-excel':                                                           'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                 'Excel',
  'application/vnd.ms-powerpoint':                                                      'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':         'PPT',
  'text/plain':                                                                          'TXT',
  'text/csv':                                                                            'CSV',
  'image/png':                                                                           'PNG',
  'image/jpeg':                                                                          'JPG',
  'image/jpg':                                                                           'JPG',
  'image/gif':                                                                           'GIF',
  'image/webp':                                                                          'WEBP',
  'application/zip':                                                                     'ZIP',
  'application/x-zip-compressed':                                                       'ZIP',
  'application/x-rar-compressed':                                                       'RAR',
  'application/vnd.rar':                                                                 'RAR',
};

const getAttachmentExtensionLabel = (attachment: Attachment) => {
  const mime = String(attachment.mimeType || '').trim().toLowerCase();
  if (MIME_LABEL_MAP[mime]) return MIME_LABEL_MAP[mime];

  // Fallback: lấy phần extension từ tên file
  const fileName = String(attachment.fileName || '').trim();
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  if (ext) return ext.toUpperCase();

  // Last resort: lấy sub-type trước dấu + hoặc ; nếu có
  const subType = mime.split('/')[1] ?? '';
  const clean = subType.split('+')[0].split(';')[0];
  return clean.toUpperCase() || 'FILE';
};

/** Map MIME → Material Symbol icon */
const getMimeIcon = (attachment: Attachment): string => {
  const mime = String(attachment.mimeType || '').trim().toLowerCase();
  if (mime.startsWith('image/'))                   return 'image';
  if (mime === 'application/pdf')                  return 'picture_as_pdf';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'table_chart';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slideshow';
  if (mime.includes('word') || mime.includes('wordprocessing')) return 'article';
  if (mime.startsWith('text/'))                    return 'text_snippet';
  if (mime.includes('zip') || mime.includes('rar')) return 'folder_zip';
  return 'description';
};

const isGoogleDriveAttachment = (attachment: Attachment) =>
  attachment.storageProvider === 'GOOGLE_DRIVE'
  || String(attachment.driveFileId || '').trim() !== ''
  || String(attachment.fileUrl || '').includes('drive.google.com');

const isBackblazeB2Attachment = (attachment: Attachment) =>
  attachment.storageProvider === 'BACKBLAZE_B2'
  || String(attachment.storageDisk || '').trim() === 'backblaze_b2';

const getAttachmentProviderLabel = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) return 'Google Drive';
  if (isBackblazeB2Attachment(attachment)) return 'Backblaze B2';
  // Nếu có warningMessage → B2 lỗi → fallback local tạm
  if (attachment.warningMessage) return 'Máy chủ (tạm)';
  return 'Máy chủ nội bộ';
};

const getAttachmentProviderTone = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) return 'bg-emerald-50 text-emerald-700';
  if (isBackblazeB2Attachment(attachment)) return 'bg-sky-50 text-sky-700';
  // Fallback do B2 lỗi → màu vàng cảnh báo
  if (attachment.warningMessage) return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300';
  return 'bg-amber-50 text-amber-700';
};

const getAttachmentOpenLinkLabel = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) return 'Mở Google Drive';
  return 'Mở / Tải file';
};

const getAttachmentLinkText = (attachment: Attachment) => {
  if (isGoogleDriveAttachment(attachment)) return 'Link mở file trên Google Drive';
  // B2 và Local: hiện tên file thực để người dùng biết đang mở file nào
  return attachment.fileName || 'Mở file';
};

const CLIPBOARD_IMAGE_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const buildClipboardImageFileName = (mimeType: string) => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const extension = CLIPBOARD_IMAGE_EXTENSION_MAP[mimeType] || 'png';
  return `clipboard_${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
};

const extractClipboardImageFiles = (items: DataTransferItemList | undefined | null): File[] => {
  if (!items) {
    return [];
  }

  const files: File[] = [];

  Array.from(items).forEach((item, index) => {
    if (item.kind !== 'file' || !String(item.type || '').startsWith('image/')) {
      return;
    }

    const file = item.getAsFile();
    if (!file) {
      return;
    }

    const mimeType = String(file.type || '').trim().toLowerCase();
    const hasSupportedMime = mimeType === '' || Object.hasOwn(CLIPBOARD_IMAGE_EXTENSION_MAP, mimeType);
    if (!hasSupportedMime) {
      return;
    }

    const fallbackName = buildClipboardImageFileName(mimeType);
    const sourceName = String(file.name || '').trim();
    const finalName = sourceName !== '' ? sourceName : fallbackName.replace('.', `_${index + 1}.`);
    files.push(new File([file], finalName, { type: file.type || 'image/png' }));
  });

  return files;
};

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  attachments,
  onUpload,
  onDelete,
  isUploading,
  disabled = false,
  helperText = 'Sau khi tải lên, hệ thống hiển thị luôn liên kết mở file tương ứng.',
  emptyStateDescription = 'Tải file lên để nhận ngay liên kết mở file từ kho lưu trữ đang cấu hình hoặc máy chủ nội bộ.',
  uploadButtonLabel = 'Tải file',
  enableClipboardPaste = false,
  clipboardPasteHint = 'Click vào khung rồi Ctrl/Cmd+V để dán ảnh chụp.',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const openFilePicker = () => {
    if (isUploading || disabled) {
      return;
    }

    fileInputRef.current?.click();
  };

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

  const focusPasteZone = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!enableClipboardPaste) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      pasteZoneRef.current?.focus();
      return;
    }

    if (target.closest('button, a, input, textarea, select, label')) {
      return;
    }

    pasteZoneRef.current?.focus();
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!enableClipboardPaste || isUploading || disabled) {
      return;
    }

    const imageFiles = extractClipboardImageFiles(event.clipboardData?.items);
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();

    for (const file of imageFiles) {
      await onUpload(file);
    }
  };

  // Khi disabled và chưa có file → không render gì cả (tránh hộp rỗng)
  if (disabled && attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
          onClick={openFilePicker}
          disabled={isUploading || disabled}
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
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar"
          disabled={isUploading || disabled}
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      {attachments.length > 0 ? (
        <div
          ref={pasteZoneRef}
          tabIndex={enableClipboardPaste && !disabled ? 0 : -1}
          onClick={focusPasteZone}
          onPaste={(event) => {
            void handlePaste(event);
          }}
          className={`space-y-2 rounded-xl border border-slate-200 bg-white p-3 outline-none transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
            disabled ? 'bg-slate-50' : ''
          }`}
        >
          {enableClipboardPaste && !disabled ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {clipboardPasteHint}
            </div>
          ) : null}

          {attachments.map((file) => {
            const linkLabel = getAttachmentOpenLinkLabel(file);
            const linkText = getAttachmentLinkText(file);

            return (
              <div
                key={file.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50 md:p-3"
              >
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-lg">{getMimeIcon(file)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-slate-900" title={file.fileName}>
                            {file.fileName}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em] text-slate-600">
                            {getAttachmentExtensionLabel(file)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getAttachmentProviderTone(file)}`}
                          >
                            {getAttachmentProviderLabel(file)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">{formatSize(file.fileSize)}</span>
                        </div>

                        {/* Cảnh báo B2 fallback */}
                        {file.warningMessage ? (
                          <div className="mt-1.5 flex items-start gap-1 rounded-lg bg-yellow-50 border border-yellow-200 px-2.5 py-1.5">
                            <span className="material-symbols-outlined text-sm text-yellow-600 shrink-0 mt-0.5">warning</span>
                            <p className="text-[11px] text-yellow-700 leading-snug">{file.warningMessage}</p>
                          </div>
                        ) : null}

                        {String(file.fileUrl || '').trim() !== '' ? (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-primary/90"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                {linkLabel}
                              </a>
                              <button
                                type="button"
                                onClick={() => void copyAttachmentLink(file)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
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
                              className="block truncate text-[11px] text-blue-600 underline-offset-2 hover:underline"
                              title={file.fileUrl}
                            >
                              {linkText}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    {!disabled ? (
                      <button
                        type="button"
                        onClick={() => onDelete(file.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                        title="Gỡ file khỏi yêu cầu"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Xóa
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          ref={pasteZoneRef}
          tabIndex={enableClipboardPaste && !disabled ? 0 : -1}
          onPaste={(event) => { void handlePaste(event); }}
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
            <span className="material-symbols-outlined text-2xl">upload_file</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-600">Chưa có file nào được tải lên.</p>
          <p className="mt-1 text-xs text-slate-500">{emptyStateDescription}</p>
          {enableClipboardPaste && !disabled ? (
            <p className="mt-2 text-xs font-medium text-primary">{clipboardPasteHint}</p>
          ) : null}
        </div>
      )}

    </div>
  );
};
