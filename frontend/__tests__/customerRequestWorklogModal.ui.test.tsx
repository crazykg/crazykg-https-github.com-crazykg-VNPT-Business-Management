import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestWorklogModal } from '../components/customer-request/CustomerRequestWorklogModal';

const mockFetchWorklogActivityTypes = vi.fn();

vi.mock('../services/v5Api', () => ({
  fetchWorklogActivityTypes: (...args: unknown[]) => mockFetchWorklogActivityTypes(...args),
}));

describe('CustomerRequestWorklogModal UI', () => {
  it('submits a direct worklog entry from the hours tab', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    mockFetchWorklogActivityTypes.mockResolvedValue([
      {
        id: 1,
        code: 'ANALYSIS',
        name: 'Phân tích',
        default_is_billable: true,
      },
    ]);

    render(
      <CustomerRequestWorklogModal
        open
        isSubmitting={false}
        requestCode="CRC-202603-0008"
        requestSummary="Hỗ trợ LIS"
        hoursReport={{
          request_case_id: 8,
          estimated_hours: 12,
          total_hours_spent: 3.5,
          remaining_hours: 8.5,
          hours_usage_pct: 29,
        }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await screen.findByRole('option', { name: 'Phân tích' });

    await user.type(screen.getByLabelText('Giờ công'), '1.5');
    fireEvent.change(screen.getByLabelText('Ngày làm việc'), {
      target: { value: '2026-03-23' },
    });
    await user.selectOptions(screen.getByLabelText('Activity'), 'ANALYSIS');
    await user.type(screen.getByLabelText('Nội dung công việc'), 'Đã xử lý và kiểm tra lại yêu cầu.');
    await user.click(screen.getByRole('button', { name: /Lưu giờ công/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      work_content: 'Đã xử lý và kiểm tra lại yêu cầu.',
      work_date: '2026-03-23',
      activity_type_code: 'ANALYSIS',
      hours_spent: '1.5',
      is_billable: true,
    });
  });
});
