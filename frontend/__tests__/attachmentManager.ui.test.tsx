import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
