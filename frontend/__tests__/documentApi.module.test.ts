import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDocument,
  deleteUploadedDocumentAttachment,
} from '../services/api/documentApi';

const fetchMock = vi.fn();

describe('documentApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates and normalizes document productIds before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'DOC001', name: 'Tai lieu', status: 'ACTIVE', attachments: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createDocument({
      id: 'DOC001',
      name: 'Tai lieu',
      commissionPolicyText: 'Hoa hồng 8% cho đối tác triển khai',
      status: 'ACTIVE',
      productIds: ['11', '11', '12'],
      attachments: [],
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload.productIds).toEqual([11, 12]);
    expect(payload.commissionPolicyText).toBe('Hoa hồng 8% cho đối tác triển khai');
    expect(payload.scope).toBe('DEFAULT');
  });

  it('builds delete-upload query params from optional attachment identifiers', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    await deleteUploadedDocumentAttachment({
      attachmentId: '15',
      driveFileId: 'drive-1',
      storagePath: 'docs/file.pdf',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/documents/upload-attachment?');
    expect(String(url)).toContain('attachmentId=15');
    expect(String(url)).toContain('driveFileId=drive-1');
    expect(String(url)).toContain('storagePath=docs%2Ffile.pdf');
  });
});
