import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBusiness,
  fetchVendorsOptionsPage,
} from '../services/api/businessVendorApi';

const fetchMock = vi.fn();

describe('businessVendorApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds vendor option-page queries with non-simple pagination', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { page: 3, per_page: 25, total: 0, total_pages: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchVendorsOptionsPage('doi tac', 3, 25);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/vendors?');
    expect(String(url)).toContain('page=3');
    expect(String(url)).toContain('per_page=25');
    expect(String(url)).toContain('simple=0');
    expect(String(url)).toContain('q=doi+tac');
  });

  it('normalizes nullable business fields before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 1, domain_code: 'KD001', domain_name: 'Y te' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createBusiness({
      domain_code: ' KD001 ',
      domain_name: ' Y te ',
      focal_point_name: '',
      focal_point_phone: ' 0909 ',
      focal_point_email: '',
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      domain_code: 'KD001',
      domain_name: 'Y te',
      focal_point_name: null,
      focal_point_phone: '0909',
      focal_point_email: null,
    });
  });
});
