import { describe, expect, it } from 'vitest';
import {
  KNOWN_SUPPORT_REQUEST_STATUS_CODES,
  isKnownSupportRequestStatusCode,
  normalizeSupportRequestStatusCode,
} from '../types/support';

describe('support type runtime exports', () => {
  it('keeps the known status code catalog', () => {
    expect(KNOWN_SUPPORT_REQUEST_STATUS_CODES).toContain('NEW');
    expect(KNOWN_SUPPORT_REQUEST_STATUS_CODES).toContain('COMPLETED');
  });

  it('normalizes and validates support request status values', () => {
    expect(isKnownSupportRequestStatusCode('new')).toBe(true);
    expect(isKnownSupportRequestStatusCode('unknown_status')).toBe(false);
    expect(normalizeSupportRequestStatusCode(' waiting_customer ')).toBe('WAITING_CUSTOMER');
    expect(normalizeSupportRequestStatusCode('')).toBe('NEW');
  });
});
