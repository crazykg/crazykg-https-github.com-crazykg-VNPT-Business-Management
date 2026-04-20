import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestHoursPanel } from '../components/customer-request/CustomerRequestHoursPanel';

describe('CustomerRequestHoursPanel UI', () => {
  it('renders compact inline metrics and keeps the worklog button available', () => {
    render(
      <CustomerRequestHoursPanel
        request={{
          id: 12,
          ma_yc: 'CRC-202604-0012',
          request_code: 'CRC-202604-0012',
          estimated_hours: 0,
          total_hours_spent: 0,
          hours_usage_pct: 0,
          warning_level: 'missing_estimate',
          sla_status: null,
        } as never}
        hoursReport={{
          request_case_id: 12,
          estimated_hours: 0,
          total_hours_spent: 0,
          remaining_hours: 0,
          hours_usage_pct: 0,
          by_performer: [],
          by_activity: [],
        } as never}
        canAddWorklog
        onAddWorklog={vi.fn()}
      />
    );

    expect(screen.getByText('Estimate & giờ công')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ghi giờ công/i })).toBeInTheDocument();

    const estimateLabel = screen.getByText('Estimate hiện hành:');
    const actualLabel = screen.getByText('Thực tế:');
    const remainingLabel = screen.getByText('Còn lại:');
    const usageLabel = screen.getByText('Mức sử dụng:');

    expect(estimateLabel).toHaveClass('truncate');
    expect(estimateLabel).toHaveClass('tracking-[0.12em]');
    expect(actualLabel).toHaveClass('truncate');
    expect(remainingLabel).toHaveClass('truncate');
    expect(usageLabel).toHaveClass('truncate');

    expect(screen.getAllByText('0h')).toHaveLength(3);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses tighter spacing in compact mode while keeping the same information visible', () => {
    render(
      <CustomerRequestHoursPanel
        request={{
          id: 13,
          ma_yc: 'CRC-202604-0013',
          request_code: 'CRC-202604-0013',
          estimated_hours: 8,
          total_hours_spent: 4,
          hours_usage_pct: 50,
          warning_level: 'soft',
          sla_status: 'at_risk',
          sla_due_at: '2026-04-20 08:00:00',
        } as never}
        hoursReport={{
          request_case_id: 13,
          estimated_hours: 8,
          total_hours_spent: 4,
          remaining_hours: 4,
          hours_usage_pct: 50,
          by_performer: [
            {
              performed_by_user_id: 7,
              performed_by_name: 'Phan Văn Rở',
              hours_spent: 4,
              worklog_count: 2,
            },
          ],
          by_activity: [],
        } as never}
        canAddWorklog
        onAddWorklog={vi.fn()}
        compact
      />
    );

    const heading = screen.getByText('Estimate & giờ công');
    const panel = heading.closest('div')?.parentElement;

    expect(panel).toHaveClass('p-3');
    expect(heading).toHaveClass('text-xs');
    expect(screen.getByRole('button', { name: /Ghi giờ công/i })).toHaveClass('px-2');
    expect(screen.getByText('Phân bổ theo người thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Phan Văn Rở')).toBeInTheDocument();
  });
});
