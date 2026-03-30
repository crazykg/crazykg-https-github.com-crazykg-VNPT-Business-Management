import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeList } from '../components/EmployeeList';
import type { Department, PaginationMeta } from '../types';

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

const paginationMeta: PaginationMeta = {
  page: 1,
  per_page: 7,
  total: 14,
  total_pages: 2,
};

describe('EmployeeList remote filters', () => {
  it('maps the department filter to department_id and returns to page 1', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <EmployeeList
        employees={[]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 })
    );

    await user.click(screen.getByRole('button', { name: 'Phòng ban' }));
    await user.click(await screen.findByRole('button', { name: 'PGP2 - Phòng giải pháp 2' }));

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          department_id: '2',
        }),
      })
    );
  });

  it('keeps the dedicated email filter in the remote query payload', async () => {
    const onQueryChange = vi.fn();

    render(
      <EmployeeList
        employees={[]}
        departments={departments}
        onOpenModal={vi.fn()}
        paginationMeta={paginationMeta}
        onQueryChange={onQueryChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@vnpt.vn' },
    });

    await waitFor(() =>
      expect(onQueryChange.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        filters: expect.objectContaining({
          email: 'admin@vnpt.vn',
        }),
      })
    );
  });
});
