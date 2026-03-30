import React from 'react';
import type { Attachment } from '../../types';
import { AttachmentManager } from '../AttachmentManager';

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
  return (
    <tr>
      <td data-testid={`step-file-panel-${stepId}`} colSpan={13} className="px-4 py-3 bg-amber-50/40 border-t border-amber-100">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 bg-white border border-amber-100 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="material-symbols-outlined text-sm text-slate-400">description</span>
              Thông tin văn bản
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_160px]">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-500">Số văn bản</span>
                <input
                  type="text"
                  value={documentNumber}
                  autoFocus={!hasDocument}
                  data-testid={`step-document-number-${stepId}`}
                  onChange={(event) => onDocumentNumberChange(event.target.value || null)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
                  placeholder="Số văn bản..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-500">Ngày VB</span>
                <input
                  type="date"
                  value={documentDate}
                  data-testid={`step-document-date-${stepId}`}
                  onChange={(event) => onDocumentDateChange(event.target.value || null)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white focus:border-deep-teal focus:ring-1 focus:ring-deep-teal/20 outline-none"
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
            emptyStateDescription="Chưa có file đính kèm cho bước này"
            helperText="PDF, Word, Excel, ảnh — tối đa 20MB • Upload thẳng lên Backblaze B2"
            enableClipboardPaste={true}
            clipboardPasteHint="Ctrl+V để dán ảnh chụp màn hình"
          />
        </div>
      </td>
    </tr>
  );
};
