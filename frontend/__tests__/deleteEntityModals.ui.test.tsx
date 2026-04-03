import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteEmployeeModal, DeleteWarningModal } from '../components/modals';

describe('Delete entity modals', () => {
  it('renders the department delete warning through Modals re-export', () => {
    render(
      <DeleteWarningModal
        data={{ id: '1', dept_name: 'Phòng Kinh doanh', dept_code: 'PKD', parent_id: null, dept_path: 'PKD', is_active: true }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Xóa phòng ban')).toBeInTheDocument();
    expect(screen.getByText(/Phòng Kinh doanh/)).toBeInTheDocument();
  });

  it('renders the employee delete confirmation through Modals re-export', () => {
    render(
      <DeleteEmployeeModal
        data={{ id: '2', uuid: 'employee-2', full_name: 'Nguyễn Văn A', username: 'nva', user_code: 'EMP002', email: 'nva@example.com', status: 'ACTIVE', department_id: null, position_id: null }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Xóa nhân sự')).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument();
  });
});
