import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentManager, type AttachmentManagerHandle } from '../components/AttachmentManager';

describe('AttachmentManager UI', () => {
  it('hides the internal upload button when showUploadButton is false', () => {
    render(
      <AttachmentManager
        attachments={[]}
        onUpload={async () => undefined}
        onDelete={async () => undefined}
        isUploading={false}
        showUploadButton={false}
      />
    );

    expect(screen.getByText('Danh sách file đính kèm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải file' })).not.toBeInTheDocument();
  });

  it('exposes openFilePicker via ref without crashing', () => {
    const fileInputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const ref = React.createRef<AttachmentManagerHandle>();

    render(
      <AttachmentManager
        ref={ref}
        attachments={[]}
        onUpload={async () => undefined}
        onDelete={async () => undefined}
        isUploading={false}
      />
    );

    expect(ref.current).not.toBeNull();
    ref.current?.openFilePicker();
    expect(fileInputClickSpy).toHaveBeenCalledTimes(1);

    fileInputClickSpy.mockRestore();
  });

  it('exposes upload and paste accessibility labels without debug logging on upload', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    render(
      <AttachmentManager
        attachments={[]}
        onUpload={onUpload}
        onDelete={async () => undefined}
        isUploading={false}
        uploadButtonLabel="Tải thủ tục"
        uploadButtonAriaLabel="Chọn tệp thủ tục"
        fileInputAriaLabel="Input tệp thủ tục"
        pasteZoneAriaLabel="Vùng dán file thủ tục"
        enableClipboardPaste={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Chọn tệp thủ tục' })).toHaveClass('focus-visible:outline');
    expect(screen.getByRole('region', { name: 'Vùng dán file thủ tục' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Input tệp thủ tục'), {
      target: { files: [new File(['demo'], 'bien-ban.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(consoleLogSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('renders compact row list without the heavy file card chrome', () => {
    render(
      <AttachmentManager
        attachments={[
          {
            id: 'file-1',
            fileName: '27.02_Khen thưởng 2025_C.TAM.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileSize: 32194,
            fileUrl: 'https://example.test/file.xlsx',
            driveFileId: '',
            createdAt: '2026-04-25T00:00:00Z',
          },
        ]}
        onUpload={async () => undefined}
        onDelete={async () => undefined}
        isUploading={false}
        showListTitle={false}
        showSummaryMeta={false}
        showUploadButton={false}
        listVariant="compact-row"
        listMaxHeightClassName="max-h-[220px]"
      />
    );

    expect(screen.queryByText('Danh sách file đính kèm')).not.toBeInTheDocument();
    expect(screen.getByText('27.02_Khen thưởng 2025_C.TAM.xlsx')).toBeInTheDocument();
    expect(screen.getByText(/Excel/i)).toBeInTheDocument();
    expect(screen.getByText('Máy chủ nội bộ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mở \/ Tải file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sao chép link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gỡ file/i })).toBeInTheDocument();
  });

  it('keeps the default empty state card unless compact-line is requested', () => {
    const { rerender } = render(
      <AttachmentManager
        attachments={[]}
        onUpload={async () => undefined}
        onDelete={async () => undefined}
        isUploading={false}
        showListTitle={false}
        showUploadButton={false}
      />
    );

    expect(screen.getByText('Chưa có file nào được tải lên.').closest('div')).toHaveClass('text-center');

    rerender(
      <AttachmentManager
        attachments={[]}
        onUpload={async () => undefined}
        onDelete={async () => undefined}
        isUploading={false}
        showListTitle={false}
        showUploadButton={false}
        emptyStateVariant="compact-line"
        emptyStateDescription="Chưa có file PDF"
      />
    );

    const compactEmptyState = screen.getByText('Chưa có file nào được tải lên.').closest('div')?.parentElement;
    expect(compactEmptyState).toHaveClass('min-h-11', 'text-left');
    expect(screen.getByText('Chưa có file PDF')).toBeInTheDocument();
  });
});
