import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  FeedbackFormModal,
  FeedbackViewModal,
  ReminderFormModal,
  UserDeptHistoryFormModal,
} from '../components/modals';
import type { Department, Employee, FeedbackRequest } from '../types';

const employees: Employee[] = [
  {
    id: '1',
    employee_code: 'VNPT000001',
    full_name: 'Nguyen Van A',
    username: 'nva',
    department_id: '30',
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
  { id: '10', dept_code: 'VTCT', dept_name: 'Vien thong Can Tho', parent_id: null, dept_path: '10', is_active: true },
  { id: '20', dept_code: 'TTKD', dept_name: 'Trung tam Kinh doanh', parent_id: '10', dept_path: '10/20', is_active: true },
  { id: '30', dept_code: 'PKD', dept_name: 'Phong Kinh doanh', parent_id: '20', dept_path: '10/20/30', is_active: true },
  { id: '40', dept_code: 'PGP', dept_name: 'Phong Giai phap', parent_id: '20', dept_path: '10/20/40', is_active: true },
  { id: '50', dept_code: 'PKT', dept_name: 'Phong Ke toan', parent_id: '10', dept_path: '10/50', is_active: true },
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
    const employeeOption = screen.getByRole('button', { name: /VNPT000001 - Nguyen Van A/i });
    expect(employeeOption).toBeInTheDocument();
    await user.click(employeeOption);

    const destinationField = screen.getByText('Đến đơn vị', { selector: 'label' }).closest('div');
    const destinationTrigger = destinationField?.querySelector('[role="button"]');
    expect(destinationTrigger).not.toBeNull();
    expect(screen.getByDisplayValue('Trung tam Kinh doanh')).toBeInTheDocument();
    await user.click(destinationTrigger as HTMLElement);
    expect(screen.getByRole('button', { name: /^Trung tam Kinh doanh$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PKT - Phong Ke toan/i })).toBeInTheDocument();
  });

  it('keeps transfer modal inputs and selects visually consistent', () => {
    render(
      <UserDeptHistoryFormModal
        type="ADD"
        employees={employees}
        departments={departments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const employeeField = screen.getByText('Nhân sự', { selector: 'label' }).closest('div');
    const destinationField = screen.getByText('Đến đơn vị', { selector: 'label' }).closest('div');

    expect(screen.getByText('Nhân sự', { selector: 'label' })).toHaveClass('text-sm');
    expect(screen.getByText('Ngày luân chuyển', { selector: 'label' })).toHaveClass('text-sm');
    expect(within(employeeField as HTMLElement).getByRole('button')).toHaveClass('h-[46px]', 'rounded-lg');
    expect(within(destinationField as HTMLElement).getByRole('button')).toHaveClass('h-[46px]', 'rounded-lg');
    expect(screen.getByDisplayValue('2026-04-07')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');
    expect(screen.getByPlaceholderText('Nhập số quyết định...')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');
    expect(screen.getByPlaceholderText('Tự động điền...')).toHaveClass('h-[46px]', 'rounded-lg', 'text-[15px]', 'leading-6');
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
