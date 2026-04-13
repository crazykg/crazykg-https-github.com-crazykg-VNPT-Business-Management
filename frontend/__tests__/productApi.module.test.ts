import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProductPackage,
  createProductPackagesBulk,
  createProductsBulk,
  deleteProductPackage,
  exportProductQuotationPdf,
  fetchProductFeatureCatalogList,
  fetchProductPackageFeatureCatalog,
  fetchProductPackageFeatureCatalogList,
  fetchProductPackages,
  fetchProductTargetSegments,
  syncProductTargetSegments,
  updateProductPackageFeatureCatalog,
  updateProductPackage,
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

  it('uses the product package feature catalog endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { groups: [], audit_logs: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: [], group_filters: [], meta: { page: 1, per_page: 20, total: 0, total_pages: 1 } } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { groups: [], audit_logs: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    await fetchProductPackageFeatureCatalog(21);
    await fetchProductPackageFeatureCatalogList(21, { page: 2, per_page: 20, group_id: 7, search: 'dang nhap' });
    await updateProductPackageFeatureCatalog(21, {
      groups: [
        {
          group_name: 'Nhóm package',
          features: [{ feature_name: 'Tính năng A' }],
        },
      ],
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v5/product-packages/21/feature-catalog');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/v5/product-packages/21/feature-catalog/list?');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('page=2');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('per_page=20');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('group_id=7');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('search=dang+nhap');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/v5/product-packages/21/feature-catalog');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('PUT');
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

  it('sends bulk product imports to the dedicated bulk endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          results: [],
          created: [],
          created_count: 0,
          failed_count: 0,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createProductsBulk([
      {
        service_group: 'GROUP_B',
        product_code: ' SP001 ',
        product_name: ' Gói Internet ',
        product_short_name: ' Internet Pro ',
        domain_id: 10,
        vendor_id: 20,
        standard_price: 1200000,
        description: ' Gói cước mẫu ',
        is_active: false,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/products/bulk');

    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));
    expect(payload).toEqual({
      items: [{
        service_group: 'GROUP_B',
        product_code: 'SP001',
        product_name: 'Gói Internet',
        product_short_name: 'Internet Pro',
        domain_id: 10,
        vendor_id: 20,
        standard_price: 1200000,
        description: 'Gói cước mẫu',
        is_active: false,
      }],
    });
  });

  it('sends normalized product package payloads to the dedicated package endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: 21,
          product_id: 9,
          package_code: 'PKG-001',
          package_name: 'Gói triển khai',
          standard_price: 880000,
          unit: 'Tháng',
          description: 'Mô tả gói',
          is_active: true,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createProductPackage({
      product_id: 9,
      package_code: ' PKG-001 ',
      package_name: ' Gói triển khai ',
      standard_price: 880000,
      unit: ' Tháng ',
      description: ' Mô tả gói ',
      is_active: true,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/product-packages');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'))).toEqual({
      product_id: 9,
      package_code: 'PKG-001',
      package_name: 'Gói triển khai',
      standard_price: 880000,
      unit: 'Tháng',
      description: 'Mô tả gói',
      attachments: undefined,
      is_active: true,
    });
  });

  it('sends normalized bulk product package payloads to the dedicated bulk endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          results: [
            { index: 0, success: true, data: { id: 1, package_code: 'PKG-001' } },
          ],
          created: [],
          created_count: 1,
          failed_count: 0,
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createProductPackagesBulk([
      {
        product_id: 9,
        package_code: ' PKG-001 ',
        package_name: ' Gói triển khai ',
        standard_price: 880000,
        unit: ' Tháng ',
        description: ' Mô tả gói ',
        is_active: true,
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/product-packages/bulk');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'))).toEqual({
      items: [
        {
          product_id: 9,
          package_code: 'PKG-001',
          package_name: 'Gói triển khai',
          standard_price: 880000,
          unit: 'Tháng',
          description: 'Mô tả gói',
          attachments: undefined,
          is_active: true,
        },
      ],
    });
  });

  it('uses the product package list/update/delete endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: {
            id: 21,
            package_name: 'Gói đã cập nhật',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        })
      );

    await fetchProductPackages();
    await updateProductPackage(21, { package_name: ' Gói đã cập nhật ' });
    await deleteProductPackage(21);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v5/product-packages');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/v5/product-packages/21');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/api/v5/product-packages/21');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('DELETE');
  });
});
