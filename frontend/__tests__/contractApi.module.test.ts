import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contract } from '../types';
import {
  createContract,
  fetchContractsPage,
  fetchContractSignerOptions,
  fetchContractRevenueAnalytics,
  generateContractPayments,
  updateContract,
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
      source_mode: 'INITIAL',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/contracts/revenue-analytics?');
    expect(String(url)).toContain('period_from=2026-01');
    expect(String(url)).toContain('period_to=2026-03');
    expect(String(url)).toContain('grouping=quarter');
    expect(String(url)).toContain('contract_id=18');
    expect(String(url)).toContain('source_mode=INITIAL');
  });

  it('passes source_mode through paginated contract list queries', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { current_page: 1, per_page: 10, total: 0, total_pages: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchContractsPage({
      page: 1,
      per_page: 10,
      q: 'hd',
      filters: {
        source_mode: 'PROJECT',
        status: 'SIGNED',
      },
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/contracts?');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('per_page=10');
    expect(String(url)).toContain('q=hd');
    expect(String(url)).toContain('filters%5Bsource_mode%5D=PROJECT');
    expect(String(url)).toContain('filters%5Bstatus%5D=SIGNED');
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
      signer_user_id: '18',
      customer_id: '12',
      project_id: '8',
      value: '1500000',
      payment_cycle: 'MONTHLY',
      project_type_code: 'thue_dich_vu_cosan',
      term_unit: 'month',
      term_value: '12',
      attachments: [
        {
          id: 'A1',
          fileName: ' Hop-dong.pdf ',
          mimeType: ' application/pdf ',
          fileSize: 2048,
          fileUrl: ' https://files.local/hop-dong.pdf ',
          driveFileId: ' drive-1 ',
          createdAt: '2026-04-11T08:00:00Z',
          storageProvider: 'GOOGLE_DRIVE',
          storagePath: ' /contracts/hop-dong.pdf ',
          storageDisk: ' google ',
          storageVisibility: ' private ',
          warningMessage: null,
        },
      ],
      items: [
        {
          id: 'line-1',
          contract_id: 1,
          product_id: '501',
          product_package_id: '601',
          product_name: 'Thuê hệ thống thông tin quản lý y tế Trạm phụ',
          unit: 'Trạm Y tế, PKĐK/ Tháng',
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
      signer_user_id: 18,
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
        product_package_id: 601,
        product_name: 'Thuê hệ thống thông tin quản lý y tế Trạm phụ',
        unit: 'Trạm Y tế, PKĐK/ Tháng',
        quantity: 3,
        unit_price: 120000,
        vat_rate: 10,
        vat_amount: 36000,
      },
    ]);
    expect(payload.attachments).toEqual([
      expect.objectContaining({
        id: 'A1',
        fileName: 'Hop-dong.pdf',
        mimeType: 'application/pdf',
        fileUrl: 'https://files.local/hop-dong.pdf',
        driveFileId: 'drive-1',
        storagePath: '/contracts/hop-dong.pdf',
        storageDisk: 'google',
        storageVisibility: 'private',
      }),
    ]);
  });

  it('normalizes signer_user_id and attachments before update', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 8, contract_code: 'HD008' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updateContract(8, {
      contract_code: 'HD008',
      contract_name: 'Hop dong update',
      signer_user_id: '22',
      payment_cycle: 'ONCE',
      attachments: [
        {
          id: 'A2',
          fileName: ' Phu-luc.pdf ',
          mimeType: ' application/pdf ',
          fileSize: 512,
          fileUrl: ' https://files.local/phu-luc.pdf ',
          driveFileId: '',
          createdAt: '2026-04-11T08:30:00Z',
          storagePath: ' /contracts/phu-luc.pdf ',
          storageDisk: ' local ',
          storageVisibility: ' private ',
        },
      ],
    } as unknown as Partial<Contract> & Record<string, unknown>);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload.signer_user_id).toBe(22);
    expect(payload.attachments).toEqual([
      expect.objectContaining({
        id: 'A2',
        fileName: 'Phu-luc.pdf',
        mimeType: 'application/pdf',
        fileUrl: 'https://files.local/phu-luc.pdf',
        storagePath: '/contracts/phu-luc.pdf',
        storageDisk: 'local',
        storageVisibility: 'private',
      }),
    ]);
  });

  it('fetches contract signer options from the dedicated lookup endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          {
            id: 1,
            user_code: 'U001',
            full_name: 'Tester',
            department_id: 10,
            dept_code: 'P10',
            dept_name: 'Phong giai phap 10',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await fetchContractSignerOptions();

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v5/contracts/signer-options');
    expect(result).toEqual([
      expect.objectContaining({
        id: 1,
        user_code: 'U001',
        department_id: 10,
      }),
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

  it('serializes custom even draft installments when generating schedules', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        generated_data: [],
        meta: { generated_count: 0, allocation_mode: 'EVEN' },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await generateContractPayments(19, {
      allocation_mode: 'EVEN',
      draft_installments: [
        {
          label: 'Phí dịch vụ kỳ 1 (quý)',
          expected_date: '2026-04-11',
          expected_amount: 4500000.25,
        },
        {
          label: 'Phí dịch vụ kỳ 2 (quý)',
          expected_date: '2026-07-15',
          expected_amount: 4499999.75,
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      allocation_mode: 'EVEN',
      draft_installments: [
        {
          label: 'Phí dịch vụ kỳ 1 (quý)',
          expected_date: '2026-04-11',
          expected_amount: 4500000.25,
        },
        {
          label: 'Phí dịch vụ kỳ 2 (quý)',
          expected_date: '2026-07-15',
          expected_amount: 4499999.75,
        },
      ],
    });
  });
});
