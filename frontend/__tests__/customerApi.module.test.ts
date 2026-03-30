import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomer, fetchCustomersOptionsPage } from '../services/api/customerApi';

const fetchMock = vi.fn();

describe('customerApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds option-page query with non-simple pagination', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { page: 2, per_page: 15, total: 0, total_pages: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchCustomersOptionsPage('benh vien', 2, 15);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/customers?');
    expect(String(url)).toContain('page=2');
    expect(String(url)).toContain('per_page=15');
    expect(String(url)).toContain('simple=0');
    expect(String(url)).toContain('q=benh+vien');
  });

  it('normalizes nullable customer payload fields before submit', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 1, customer_name: 'BV A' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createCustomer({
      customer_name: 'BV A',
      customer_code: ' KH001 ',
      tax_code: '',
      address: ' Ha Noi ',
      bed_capacity: 120,
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      customer_name: 'BV A',
      customer_code: 'KH001',
      tax_code: null,
      address: 'Ha Noi',
      bed_capacity: 120,
    });
  });
});
