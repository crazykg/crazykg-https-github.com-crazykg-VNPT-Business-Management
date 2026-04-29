import React from 'react';
import type { Attachment } from '../../types';
import { AttachmentManager } from '../AttachmentManager';
import { ProjectDateInput } from '../project/ProjectDateInput';

interface ProcedureAttachmentPanelProps {
  stepId: string | number;
  documentNumber: string;
  documentDate: string;
  hasDocument: boolean;
  attachList: Attachment[];
  attachUploading: boolean;
  onDocumentNumberChange: (value: string | null) => void;
  onDocumentDateChange: (value: string | null) => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onDeleteAttachment: (attachmentId: string) => void | Promise<void>;
}

export const ProcedureAttachmentPanel: React.FC<ProcedureAttachmentPanelProps> = ({
  stepId,
  documentNumber,
  documentDate,
  hasDocument,
  attachList,
  attachUploading,
  onDocumentNumberChange,
  onDocumentDateChange,
  onUploadFile,
  onDeleteAttachment,
}) => {
  const documentNumberHelpId = `step-document-number-help-${stepId}`;

  return (
    <tr>
      <td id={`step-file-panel-${stepId}`} data-testid={`step-file-panel-${stepId}`} colSpan={12} className="px-4 py-3 bg-amber-50/40 border-t border-amber-100">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 bg-white border border-amber-100 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span className="material-symbols-outlined text-sm text-primary" aria-hidden="true">description</span>
              Thông tin văn bản
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_150px]">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Số văn bản</span>
                <input
                  type="text"
                  value={documentNumber}
                  autoFocus={!hasDocument}
                  data-testid={`step-document-number-${stepId}`}
                  aria-describedby={documentNumberHelpId}
                  onChange={(event) => onDocumentNumberChange(event.target.value || null)}
                  className="h-11 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-500 transition-colors focus:border-primary/70 focus:ring-1 focus:ring-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary sm:h-8"
                  placeholder="Số văn bản..."
                />
                <span id={documentNumberHelpId} className="sr-only">
                  Nhập số văn bản liên quan đến bước thủ tục.
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-slate-700">Ngày VB</span>
                <ProjectDateInput
                  value={documentDate}
                  onChange={(value) => onDocumentDateChange(value)}
                  testId={`step-document-date-${stepId}`}
                  ariaLabel="Ngày văn bản của bước thủ tục"
                  className="h-11 sm:h-8"
                />
              </label>
            </div>
          </div>

          <AttachmentManager
            attachments={attachList}
            onUpload={(file) => onUploadFile(file)}
            onDelete={(id) => onDeleteAttachment(id)}
            isUploading={attachUploading}
            uploadButtonLabel="Tải file đính kèm"
            uploadButtonAriaLabel="Tải file đính kèm cho bước thủ tục"
            fileInputAriaLabel="Chọn file đính kèm cho bước thủ tục"
            pasteZoneAriaLabel="Danh sách file đính kèm của bước thủ tục"
            emptyStateDescription="Chưa có file đính kèm cho bước này"
            helperText="PDF, Word, Excel, ảnh — tối đa 20MB • Upload thẳng lên Backblaze B2"
            enableClipboardPaste={true}
            clipboardPasteHint="Ctrl+V để dán ảnh chụp màn hình"
            compact={true}
            listVariant="compact-row"
            emptyStateVariant="compact-line"
            listMaxHeightClassName="max-h-[260px] md:max-h-[34dvh]"
            uploadButtonClassName="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded bg-primary/10 px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:text-xs"
          />
        </div>
      </td>
    </tr>
  );
};
