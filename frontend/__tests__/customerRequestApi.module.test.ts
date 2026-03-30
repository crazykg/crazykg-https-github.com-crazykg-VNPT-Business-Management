import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCustomerRequest,
  fetchCustomerRequestReferenceSearch,
} from '../services/api/customerRequestApi';

const fetchMock = vi.fn();

describe('customerRequestApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes and deduplicates customer-request reference tasks before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 8, request_code: 'CR-8', summary: 'Test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createCustomerRequest({
      summary: 'Test',
      customer_id: '22',
      priority: 'HIGH',
      attachments: [{
        id: '7',
        fileName: 'note.txt',
        mimeType: 'text/plain',
        fileSize: 12,
        fileUrl: '/files/note.txt',
        driveFileId: 'drv-1',
        createdAt: '2026-03-29T10:00:00Z',
      }],
      ref_tasks: [
        {
          task_source: 'reference',
          task_code: 'REF-001',
          task_status: 'done',
          sort_order: 0,
        },
        {
          task_source: 'REFERENCE',
          task_code: 'REF-001',
          task_status: 'DONE',
          sort_order: 0,
        },
        {
          task_source: 'it360',
          task_code: 'IT-5',
          task_link: ' https://example.com/task/5 ',
          task_status: 'dang lam',
          sort_order: 1,
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.customer_id).toBe(22);
    expect(payload.ref_tasks).toEqual([
      {
        task_source: 'REFERENCE',
        task_code: 'REF-001',
        task_link: null,
        task_status: null,
        sort_order: 0,
      },
      {
        task_source: 'IT360',
        task_code: 'IT-5',
        task_link: 'https://example.com/task/5',
        task_status: 'IN_PROGRESS',
        sort_order: 1,
      },
    ]);
    expect(payload.attachments[0]).toMatchObject({
      id: '7',
      fileName: 'note.txt',
      driveFileId: 'drv-1',
    });
  });

  it('builds reference-search query params with clamped limit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchCustomerRequestReferenceSearch({
      q: ' crc-001 ',
      exclude_id: 15,
      limit: 200,
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/customer-requests/reference-search?');
    expect(String(url)).toContain('q=crc-001');
    expect(String(url)).toContain('exclude_id=15');
    expect(String(url)).toContain('limit=50');
  });
});
