import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDebtByCustomer,
  reverseReceipt,
} from '../services/api/feeCollectionApi';

const fetchMock = vi.fn();

describe('feeCollectionApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds debt-by-customer query params from pagination and search filters', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { page: 2, per_page: 25, total: 0, total_pages: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchDebtByCustomer({
      page: 2,
      per_page: 25,
      q: 'benh vien',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/fee-collection/debt-by-customer?');
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('per_page=25');
    expect(String(url)).toContain('q=benh+vien');
  });

  it('posts to the receipt reverse endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 5, receipt_code: 'PT-5' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await reverseReceipt(5);

    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(String(url)).toContain('/api/v5/receipts/5/reverse');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({});
  });
});
