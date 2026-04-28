import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmployeesBulk,
  createEmployeeWithProvisioning,
  fetchEmployees,
} from '../services/api/employeeApi';

const fetchMock = vi.fn();

describe('employeeApi module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes employee list records from internal-user payloads', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{
          id: 12,
          uuid: 'emp-12',
          username: 'nv12',
          full_name: 'Nguyen Van A',
          email: 'a@vnpt.vn',
          gmail: 'a.personal@gmail.com',
          phone: '0909888777',
          status: 'TRANSFERRED',
          department: 5,
          position_id: 'POS003',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const rows = await fetchEmployees();

    expect(rows[0]).toMatchObject({
      id: 12,
      employee_code: 'VNPT000012',
      user_code: 'VNPT000012',
      phone: '0909888777',
      phone_number: '0909888777',
      mobile: '0909888777',
      gmail: 'a.personal@gmail.com',
      status: 'SUSPENDED',
      department_id: 5,
    });
  });

  it('normalizes employee create payload and returns provisioning info', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: 7,
          uuid: 'emp-7',
          username: 'nv07',
          full_name: 'Le Thi B',
          email: 'b@vnpt.vn',
          gmail: 'b.personal@gmail.com',
          status: 'ACTIVE',
        },
        provisioning: {
          temporary_password: 'Temp@123',
          must_change_password: true,
          delivery: 'one_time',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await createEmployeeWithProvisioning({
      id: 7,
      username: 'nv07',
      full_name: 'Le Thi B',
      email: 'b@vnpt.vn',
      gmail: ' b.personal@gmail.com ',
      phone: ' 0911222333 ',
      position_id: 'POS005',
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toMatchObject({
      user_code: 'VNPT000007',
      username: 'nv07',
      phone: '0911222333',
      phone_number: '0911222333',
      gmail: 'b.personal@gmail.com',
      position_id: 5,
      vpn_status: 'NO',
      status: 'ACTIVE',
    });
    expect(result.provisioning?.temporary_password).toBe('Temp@123');
    expect(result.employee.employee_code).toBe('VNPT000007');
  });

  it('keeps employee bulk import payload sparse for upsert-by-code flow', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          results: [{
            index: 0,
            success: true,
            data: {
              id: 8,
              uuid: 'emp-8',
              user_code: 'VNPT000008',
              username: 'vnpt000008',
              full_name: 'Nguyen Van Sparse',
              email: 'vnpt000008@import.local',
              gmail: 'sparse@gmail.com',
              status: 'ACTIVE',
              department_id: 1,
            },
          }],
          created: [],
          created_count: 0,
          failed_count: 0,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createEmployeesBulk([{
      user_code: 'VNPT000008',
      full_name: 'Nguyen Van Sparse',
      gmail: ' sparse@gmail.com ',
    }]);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));

    expect(payload).toEqual({
      items: [{
        user_code: 'VNPT000008',
        full_name: 'Nguyen Van Sparse',
        gmail: 'sparse@gmail.com',
      }],
    });
  });
});
