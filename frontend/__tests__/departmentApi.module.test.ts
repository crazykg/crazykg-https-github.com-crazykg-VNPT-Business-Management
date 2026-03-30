import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDepartment } from '../services/api/departmentApi';

const fetchMock = vi.fn();

describe('departmentApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults department status and normalizes nullable parent_id', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 10, dept_code: 'KT', dept_name: 'Ke toan' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createDepartment({
      dept_code: 'KT',
      dept_name: 'Ke toan',
      parent_id: '',
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      dept_code: 'KT',
      dept_name: 'Ke toan',
      parent_id: null,
      is_active: true,
    });
  });
});
