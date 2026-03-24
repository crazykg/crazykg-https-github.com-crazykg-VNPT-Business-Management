import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestEstimateModal } from '../components/customer-request/CustomerRequestEstimateModal';

describe('CustomerRequestEstimateModal UI', () => {
  it('submits a phase estimate update from the estimate tab', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CustomerRequestEstimateModal
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
        latestEstimate={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.clear(screen.getByLabelText('Giờ ước lượng'));
    await user.type(screen.getByLabelText('Giờ ước lượng'), '6');
    await user.selectOptions(screen.getByLabelText('Phạm vi'), 'phase');
    await user.type(screen.getByLabelText('Tên giai đoạn'), 'Kiểm thử');
    fireEvent.change(screen.getByLabelText('Thời điểm estimate'), {
      target: { value: '2026-03-23T10:30' },
    });
    await user.type(screen.getByLabelText('Ghi chú'), 'Điều chỉnh theo scope mới.');
    await user.click(screen.getByRole('button', { name: /Lưu ước lượng/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      estimated_hours: '6',
      estimate_scope: 'phase',
      estimated_at: '2026-03-23T10:30',
      phase_label: 'Kiểm thử',
      note: 'Điều chỉnh theo scope mới.',
      sync_master: false,
    });
  });
});
