import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('normalizes list filters into a stable cache key', () => {
    expect(
      queryKeys.invoices.list({ page: 1, q: 'alpha', status: 'ISSUED' }),
    ).toEqual(
      queryKeys.invoices.list({ status: 'ISSUED', q: 'alpha', page: 1 }),
    );
  });

  it('keeps dashboard ranges namespaced under invoices', () => {
    expect(
      queryKeys.invoices.dashboard({ period_from: '2026-03-01', period_to: '2026-03-31' }),
    ).toEqual([
      'invoices',
      'dashboard',
      {
        period_from: '2026-03-01',
        period_to: '2026-03-31',
      },
    ]);
  });

  it('namespaces integration settings and admin caches separately', () => {
    expect(queryKeys.integrationSettings.googleDrive()).toEqual([
      'integration-settings',
      'google-drive',
    ]);
    expect(queryKeys.admin.userAccess()).toEqual([
      'admin',
      'user-access',
    ]);
  });

  it('normalizes support config filter keys into stable cache keys', () => {
    expect(
      queryKeys.supportConfig.serviceGroups({ include_inactive: true }),
    ).toEqual(
      queryKeys.supportConfig.serviceGroups({ include_inactive: true }),
    );
  });

  it('keeps page cache keys namespaced for party profiles and admin pages', () => {
    expect(
      queryKeys.employees.partyProfiles({ page: 2, q: 'dang vien' }),
    ).toEqual([
      'employees',
      'party-profiles',
      {
        page: 2,
        q: 'dang vien',
      },
    ]);

    expect(
      queryKeys.admin.auditLogs({ page: 1, sort_by: 'created_at' }),
    ).toEqual([
      'admin',
      'audit-logs',
      {
        page: 1,
        sort_by: 'created_at',
      },
    ]);
  });
});
