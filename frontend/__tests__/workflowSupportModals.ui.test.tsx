import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  FeedbackFormModal,
  FeedbackViewModal,
  ReminderFormModal,
  UserDeptHistoryFormModal,
} from '../components/Modals';
import type { Department, Employee, FeedbackRequest } from '../types';

const employees: Employee[] = [
  {
    id: '1',
    employee_code: 'VNPT000001',
    full_name: 'Nguyen Van A',
    username: 'nva',
    department_id: '10',
  } as Employee,
  {
    id: '2',
    employee_code: 'VNPT000002',
    full_name: 'Tran Thi B',
    username: 'ttb',
    department_id: '20',
  } as Employee,
];

const departments: Department[] = [
  { id: '10', dept_code: 'PKD', dept_name: 'Phong Kinh doanh', parent_id: null, dept_path: 'PKD', is_active: true },
  { id: '20', dept_code: 'PKT', dept_name: 'Phong Ke toan', parent_id: null, dept_path: 'PKT', is_active: true },
];

const feedbackData: FeedbackRequest = {
  id: 15,
  uuid: 'feedback-15',
  title: 'Canh bao nghiep vu',
  description: 'Can bo sung buoc xac nhan.',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  attachments: [],
  created_by: 1,
  updated_by: 1,
  status_changed_by: 1,
  status_changed_at: '2026-03-29T10:00:00',
  created_at: '2026-03-29T09:00:00',
  updated_at: '2026-03-29T10:00:00',
} as FeedbackRequest;

describe('Workflow support modals', () => {
  it('renders reminder modal through Modals re-export and shows employee options', async () => {
    const user = userEvent.setup();

    render(
      <ReminderFormModal
        type="ADD"
        employees={employees}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Thêm nhắc việc')).toBeInTheDocument();
    const assigneeField = screen.getByText('Người được giao', { selector: 'label' }).closest('div');
    const assigneeTrigger = assigneeField?.querySelector('[role="button"]');
    expect(assigneeTrigger).not.toBeNull();
    await user.click(assigneeTrigger as HTMLElement);

    expect(screen.getByRole('button', { name: /VNPT000001 - Nguyen Van A/i })).toBeInTheDocument();
  });

  it('renders transfer modal through Modals re-export and lists employees and departments', async () => {
    const user = userEvent.setup();

    render(
      <UserDeptHistoryFormModal
        type="ADD"
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Thêm mới Luân chuyển')).toBeInTheDocument();

    const employeeField = screen.getByText('Nhân sự', { selector: 'label' }).closest('div');
    const employeeTrigger = employeeField?.querySelector('[role="button"]');
    expect(employeeTrigger).not.toBeNull();
    await user.click(employeeTrigger as HTMLElement);
    expect(screen.getByRole('button', { name: /VNPT000001 - Nguyen Van A/i })).toBeInTheDocument();

    const destinationField = screen.getByText('Đến phòng ban', { selector: 'label' }).closest('div');
    const destinationTrigger = destinationField?.querySelector('[role="button"]');
    expect(destinationTrigger).not.toBeNull();
    await user.click(destinationTrigger as HTMLElement);
    expect(screen.getByRole('button', { name: /PKD - Phong Kinh doanh/i })).toBeInTheDocument();
  });

  it('renders feedback form and view modals through Modals re-export', () => {
    const { rerender } = render(
      <FeedbackFormModal
        type="ADD"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Thêm góp ý' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập tiêu đề góp ý...')).toBeInTheDocument();

    rerender(
      <FeedbackViewModal
        data={feedbackData}
        employees={employees}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Chi tiết góp ý' })).toBeInTheDocument();
    expect(screen.getByText('Canh bao nghiep vu')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();
  });
});
