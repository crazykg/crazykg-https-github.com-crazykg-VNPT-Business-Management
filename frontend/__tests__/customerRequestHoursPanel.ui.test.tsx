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
});
