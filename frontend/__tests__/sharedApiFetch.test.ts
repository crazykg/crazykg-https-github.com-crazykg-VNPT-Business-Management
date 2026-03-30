import { describe, expect, it } from 'vitest';
import { parseApiError } from '../shared/api/apiFetch';

describe('parseApiError', () => {
  it('reads the standardized nested error envelope', async () => {
    const response = new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The username field is required.',
        request_id: 'req-123',
        errors: {
          username: ['The username field is required.'],
        },
      },
    }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiError(response)).resolves.toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The username field is required.',
      request_id: 'req-123',
      errors: {
        username: ['The username field is required.'],
      },
    });
  });

  it('falls back to the legacy top-level error shape', async () => {
    const response = new Response(JSON.stringify({
      code: 'UNAUTHENTICATED',
      message: 'Unauthenticated.',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiError(response)).resolves.toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Unauthenticated.',
      request_id: undefined,
      errors: undefined,
      retry_after: undefined,
    });
  });
});
