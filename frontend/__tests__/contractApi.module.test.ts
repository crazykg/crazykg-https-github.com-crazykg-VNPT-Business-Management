import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contract } from '../types';
import {
  createContract,
  fetchContractRevenueAnalytics,
  generateContractPayments,
  updatePaymentSchedule,
} from '../services/api/contractApi';

const fetchMock = vi.fn();

describe('contractApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds contract revenue analytics query params correctly', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { kpis: {}, by_period: [], by_cycle: [], by_contract: [], by_item: [], overdue_details: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchContractRevenueAnalytics({
      period_from: '2026-01',
      period_to: '2026-03',
      grouping: 'quarter',
      contract_id: 18,
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/contracts/revenue-analytics?');
    expect(String(url)).toContain('period_from=2026-01');
    expect(String(url)).toContain('period_to=2026-03');
    expect(String(url)).toContain('grouping=quarter');
    expect(String(url)).toContain('contract_id=18');
  });

  it('normalizes contract payload fields before create', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 1, contract_code: 'HD001' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createContract({
      contract_code: 'HD001',
      contract_name: 'Hop dong A',
      customer_id: '12',
      project_id: '8',
      value: '1500000',
      payment_cycle: 'MONTHLY',
      project_type_code: 'thue_dich_vu_cosan',
      term_unit: 'month',
      term_value: '12',
      items: [
        {
          id: 'line-1',
          contract_id: 1,
          product_id: '501',
          quantity: '3' as unknown as number,
          unit_price: '120000' as unknown as number,
          vat_rate: '10' as unknown as number,
          vat_amount: '36000' as unknown as number,
        },
      ],
    } as unknown as Partial<Contract> & Record<string, unknown>);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      customer_id: 12,
      project_id: 8,
      value: 1500000,
      payment_cycle: 'MONTHLY',
      project_type_code: 'THUE_DICH_VU_COSAN',
      term_unit: 'MONTH',
      term_value: 12,
    });
    expect(payload.items).toEqual([
      {
        product_id: 501,
        quantity: 3,
        unit_price: 120000,
        vat_rate: 10,
        vat_amount: 36000,
      },
    ]);
  });

  it('normalizes payment confirmation attachments before update', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 22, status: 'PAID' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updatePaymentSchedule(22, {
      actual_paid_date: '2026-03-29',
      actual_paid_amount: 500000,
      status: 'PAID',
      notes: ' da thu ',
      attachments: [
        {
          id: 'A1',
          fileName: ' Bien-ban.pdf ',
          mimeType: ' application/pdf ',
          fileSize: 1024,
          fileUrl: ' https://files.local/bien-ban.pdf ',
          driveFileId: ' drive-1 ',
          createdAt: '2026-03-29T08:00:00Z',
          storageProvider: 'GOOGLE_DRIVE',
          storagePath: ' /hop-dong/1 ',
          storageDisk: ' google ',
          storageVisibility: ' private ',
          warningMessage: null,
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload.notes).toBe('da thu');
    expect(payload.attachments).toEqual([
      expect.objectContaining({
        id: 'A1',
        fileName: 'Bien-ban.pdf',
        mimeType: 'application/pdf',
        fileUrl: 'https://files.local/bien-ban.pdf',
        driveFileId: 'drive-1',
        storagePath: '/hop-dong/1',
        storageDisk: 'google',
        storageVisibility: 'private',
      }),
    ]);
  });

  it('maps generated payment metadata and fallback data correctly', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: 1, contract_id: 9, milestone_name: 'Dot 1', cycle_number: 1, expected_date: '2026-04-01', expected_amount: 500000, actual_paid_amount: 0, status: 'PENDING' }],
        meta: { generated_count: 1, allocation_mode: 'MILESTONE' },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await generateContractPayments(9, {
      allocation_mode: 'MILESTONE',
      installment_count: 1,
    });

    expect(result.generated_data).toHaveLength(1);
    expect(result.meta).toEqual({
      generated_count: 1,
      allocation_mode: 'MILESTONE',
    });
  });
});
