import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DepartmentFormModal } from '../components/modals';
import type { Department } from '../types';

const departments: Department[] = [
  {
    id: '1',
    dept_code: 'BGDVT',
    dept_name: 'Ban giám đốc',
    parent_id: null,
    dept_path: 'BGDVT',
    is_active: true,
  },
  {
    id: '2',
    dept_code: 'PKD',
    dept_name: 'Phòng Kinh doanh',
    parent_id: '1',
    dept_path: 'BGDVT/PKD',
    is_active: true,
  },
];

describe('DepartmentFormModal', () => {
  it('renders through Modals re-export and lists valid parent departments', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentFormModal
        type="ADD"
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Thêm mới phòng ban')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập mã phòng ban/)).toBeInTheDocument();

    const parentField = screen.getByText('Phòng ban cha', { selector: 'label' }).closest('div');
    const parentTrigger = parentField?.querySelector('[role="button"]');

    expect(parentTrigger).not.toBeNull();
    await user.click(parentTrigger as HTMLElement);

    expect(screen.getAllByRole('button', { name: /BGDVT - Ban giám đốc/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /PKD - Phòng Kinh doanh/i }).length).toBeGreaterThan(0);
  });
});
