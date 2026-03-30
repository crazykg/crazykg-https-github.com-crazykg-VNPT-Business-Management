import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProcedureAttachmentPanel } from '../components/procedure/ProcedureAttachmentPanel';
import type { Attachment } from '../types';

vi.mock('../components/AttachmentManager', () => ({
  AttachmentManager: ({
    attachments,
    onUpload,
    onDelete,
    isUploading,
  }: {
    attachments: Attachment[];
    onUpload: (file: File) => void | Promise<void>;
    onDelete: (attachmentId: string) => void | Promise<void>;
    isUploading: boolean;
  }) => (
    <div data-testid="mock-attachment-manager">
      <span data-testid="mock-attachment-count">{attachments.length}</span>
      <span data-testid="mock-uploading-state">{isUploading ? 'uploading' : 'idle'}</span>
      <button
        type="button"
        onClick={() => onUpload(new File(['hello'], 'bien-ban.pdf', { type: 'application/pdf' }))}
      >
        Upload mock
      </button>
      <button
        type="button"
        onClick={() => onDelete(String(attachments[0]?.id ?? ''))}
      >
        Delete mock
      </button>
    </div>
  ),
}));

describe('ProcedureAttachmentPanel', () => {
  it('renders document fields and bridges upload/delete callbacks', async () => {
    const user = userEvent.setup();
    const onDocumentNumberChange = vi.fn();
    const onDocumentDateChange = vi.fn();
    const onUploadFile = vi.fn();
    const onDeleteAttachment = vi.fn();

    const attachments: Attachment[] = [
      {
        id: '88',
        fileName: 'bien-ban.pdf',
        fileUrl: 'https://example.com/bien-ban.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        driveFileId: '',
        storageProvider: 'BACKBLAZE_B2',
        storageDisk: 'backblaze_b2',
        storagePath: 'steps/bien-ban.pdf',
        storageVisibility: 'private',
        createdAt: '2026-03-30T10:00:00Z',
      },
    ];

    render(
      <table>
        <tbody>
          <ProcedureAttachmentPanel
            stepId={7001}
            documentNumber="VB-01"
            documentDate="2026-03-30"
            hasDocument={true}
            attachList={attachments}
            attachUploading={false}
            onDocumentNumberChange={onDocumentNumberChange}
            onDocumentDateChange={onDocumentDateChange}
            onUploadFile={onUploadFile}
            onDeleteAttachment={onDeleteAttachment}
          />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('step-file-panel-7001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('VB-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-03-30')).toBeInTheDocument();
    expect(screen.getByTestId('mock-attachment-count')).toHaveTextContent('1');

    fireEvent.change(screen.getByTestId('step-document-number-7001'), { target: { value: 'VB-02' } });
    expect(onDocumentNumberChange).toHaveBeenLastCalledWith('VB-02');

    fireEvent.change(screen.getByTestId('step-document-date-7001'), { target: { value: '2026-04-01' } });
    expect(onDocumentDateChange).toHaveBeenLastCalledWith('2026-04-01');

    await user.click(screen.getByText('Upload mock'));
    expect(onUploadFile).toHaveBeenCalledTimes(1);
    expect(onUploadFile.mock.calls[0][0]).toBeInstanceOf(File);

    await user.click(screen.getByText('Delete mock'));
    expect(onDeleteAttachment).toHaveBeenCalledWith('88');
  });
});
