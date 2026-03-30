import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePartyList } from '../components/EmployeePartyList';
import type { Department, Employee, PaginationMeta } from '../types';

const departments: Department[] = [
  {
    id: 1,
    dept_code: 'BGDVT',
    dept_name: 'Ban giám đốc Viễn Thông',
    parent_id: null,
    dept_path: '1',
    is_active: true,
  },
  {
    id: 2,
    dept_code: 'PGP2',
    dept_name: 'Phòng giải pháp 2',
    parent_id: null,
    dept_path: '2',
    is_active: true,
  },
];

const employees: Employee[] = [
  {
    id: 1,
    uuid: 'emp-1',
    user_code: 'VNPT000001',
    employee_code: 'VNPT000001',
    username: 'admin',
    full_name: 'Nguyen Van A',
    email: 'admin@vnpt.vn',
    status: 'ACTIVE',
    department_id: 1,
    position_id: 1,
  },
];

const paginationMeta: PaginationMeta = {
  page: 1,
  per_page: 10,
  total: 20,
  total_pages: 2,
  kpis: {
    total_party_members: 20,
    missing_party_card_number_count: 5,
  },
};

describe('EmployeePartyList remote filters', () => {
  it('sends department and missing-info filters and resets pagination to page 1', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <EmployeePartyList
        partyProfiles={[]}
        employees={employees}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }));

    const selectButtons = screen.getAllByRole('button', { name: /Phòng ban|Thiếu thông tin/ });
    await user.click(selectButtons[0]);
    await user.click(await screen.findByRole('button', { name: 'PGP2 - Phòng giải pháp 2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
        }),
      })
    );

    await user.click(screen.getByRole('button', { name: 'Thiếu thông tin' }));
    await user.click(await screen.findByRole('button', { name: 'Thiếu số thẻ Đảng' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
          missing_info: 'CARD_NUMBER',
        }),
      })
    );
  });
});
