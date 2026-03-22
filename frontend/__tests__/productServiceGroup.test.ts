import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRODUCT_SERVICE_GROUP,
  getProductServiceGroupLabel,
  normalizeProductServiceGroup,
  resolveProductServiceGroupImportValue,
} from '../utils/productServiceGroup';

describe('productServiceGroup utils', () => {
  it('normalizes empty values to the default service group', () => {
    expect(normalizeProductServiceGroup(undefined)).toBe(DEFAULT_PRODUCT_SERVICE_GROUP);
    expect(normalizeProductServiceGroup('')).toBe(DEFAULT_PRODUCT_SERVICE_GROUP);
  });

  it('maps supported import aliases to canonical group codes', () => {
    expect(resolveProductServiceGroupImportValue('A')).toBe('GROUP_A');
    expect(resolveProductServiceGroupImportValue('group_b')).toBe('GROUP_B');
    expect(resolveProductServiceGroupImportValue('Dịch vụ nhóm C')).toBe('GROUP_C');
  });

  it('rejects unknown import values', () => {
    expect(resolveProductServiceGroupImportValue('GROUP_Z')).toBeNull();
  });

  it('returns the display label for a service group code', () => {
    expect(getProductServiceGroupLabel('GROUP_A')).toBe('Dịch vụ nhóm A');
  });
});
