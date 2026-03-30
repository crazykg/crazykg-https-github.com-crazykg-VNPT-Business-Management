import { describe, expect, it } from 'vitest';
import type { Contract } from '../types';
import { prependContractInCollection, replaceContractInCollection } from '../utils/contractCollections';

const buildContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 1,
  contract_code: 'HD-001',
  contract_name: 'Hop dong mau',
  customer_id: 10,
  project_id: 20,
  value: 1000000,
  payment_cycle: 'ONCE',
  status: 'DRAFT',
  sign_date: '2026-03-01',
  effective_date: '2026-03-01',
  expiry_date: '2026-12-31',
  ...overrides,
});

describe('contract collection helpers', () => {
  it('replaces the matching contract and keeps the others untouched', () => {
    const original = [
      buildContract({ id: 1, contract_name: 'Hop dong A' }),
      buildContract({ id: 2, contract_code: 'HD-002', contract_name: 'Hop dong B' }),
    ];

    const updated = buildContract({ id: 2, contract_code: 'HD-002', contract_name: 'Hop dong B moi', status: 'SIGNED' });
    const next = replaceContractInCollection(original, updated);

    expect(next).toEqual([
      original[0],
      updated,
    ]);
    expect(next[0]).toBe(original[0]);
  });

  it('prepends the created contract and removes stale duplicates', () => {
    const original = [
      buildContract({ id: 1, contract_name: 'Hop dong A cu' }),
      buildContract({ id: 2, contract_code: 'HD-002', contract_name: 'Hop dong B' }),
    ];

    const created = buildContract({ id: 1, contract_name: 'Hop dong A moi' });
    const next = prependContractInCollection(original, created);

    expect(next).toEqual([
      created,
      original[1],
    ]);
  });
});
