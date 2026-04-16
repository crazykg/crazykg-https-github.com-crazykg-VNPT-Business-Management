import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YeuCau } from '../types';
import { CustomerRequestAttentionCard } from '../components/customer-request/CustomerRequestAttentionCard';

const request = {
  id: 7,
  ma_yc: 'CRC-202603-0007',
  request_code: 'CRC-202603-0007',
  tieu_de: 'Yêu cầu hỗ trợ',
  summary: 'Yêu cầu hỗ trợ',
  do_uu_tien: 3,
  current_status_code: 'new_intake',
  trang_thai: 'new_intake',
  current_status_name_vi: 'Mới tiếp nhận',
  customer_name: 'Bệnh viện Sản',
  project_name: 'Nhi Hậu Giang',
  performer_name: 'Lý Thị Ngọc Mai',
  updated_at: '2026-03-22 16:41:00',
} as YeuCau;

describe('CustomerRequestAttentionCard UI', () => {
  it('renders cleaned summary blocks and keeps detail open behavior', async () => {
    const user = userEvent.setup();
    const onOpenRequest = vi.fn();

    render(
      <CustomerRequestAttentionCard
        request={request}
        reasons={['missing_estimate']}
        onOpenRequest={onOpenRequest}
      />
    );

    expect(screen.getByText('Phụ trách')).toBeInTheDocument();
    expect(screen.getByText('Tiếp theo')).toBeInTheDocument();
    expect(screen.getByText('Giờ')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.getAllByText('Xem chi tiết')).toHaveLength(2);
    expect(screen.queryByText('missing_estimate')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mở chi tiết CRC-202603-0007/i }));
    expect(onOpenRequest).toHaveBeenCalledWith(7, 'new_intake');
  });
});
