import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportProductQuotationPdf,
  fetchProductFeatureCatalogList,
  fetchProductTargetSegments,
  syncProductTargetSegments,
} from '../services/api/productApi';

const fetchMock = vi.fn();

describe('productApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds feature catalog list query params correctly', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { rows: [], group_filters: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 1 } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchProductFeatureCatalogList(9, {
      page: 2,
      per_page: 25,
      group_id: 'core',
      search: 'his',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/products/9/feature-catalog/list?');
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('per_page=25');
    expect(String(url)).toContain('group_id=core');
    expect(String(url)).toContain('search=his');
  });

  it('falls back to a generated pdf filename when header is missing', async () => {
    fetchMock.mockResolvedValue(
      new Response('pdf-binary', {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    );

    const result = await exportProductQuotationPdf({
      recipient_name: 'BV A',
      quote_date: '2026-03-29',
      items: [],
    });

    expect(result.filename).toBe('Báo giá BV A 2026 03 29.pdf');
  });

  it('returns the raw target segment list wrapper with table availability metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        meta: { table_available: false },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await fetchProductTargetSegments(5);

    expect(result.meta.table_available).toBe(false);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/products/5/target-segments');
  });

  it('sends a normalized sync payload for product target segments', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await syncProductTargetSegments(12, [
      {
        customer_sector: 'HEALTHCARE',
        facility_type: null,
        facility_types: ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER', 'PUBLIC_HOSPITAL'],
        bed_capacity_min: 100,
        bed_capacity_max: null,
        priority: 2,
        sales_notes: '  Ghi chú test  ',
        is_active: true,
      },
    ]);

    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/products/12/target-segments-sync');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({
      segments: [
        {
          customer_sector: 'HEALTHCARE',
          facility_type: null,
          facility_types: ['PUBLIC_HOSPITAL', 'MEDICAL_CENTER'],
          bed_capacity_min: 100,
          bed_capacity_max: null,
          priority: 2,
          sales_notes: 'Ghi chú test',
          is_active: true,
        },
      ],
    });
  });
});
