import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerRequestNotifyCustomerModal } from '../components/customer-request/CustomerRequestNotifyCustomerModal';

vi.mock('../services/v5Api', () => ({
  fetchWorklogActivityTypes: vi.fn().mockResolvedValue([
    { id: 1, code: 'support', name: 'Hỗ trợ' },
  ]),
  uploadDocumentAttachment: vi.fn(),
}));

describe('CustomerRequestNotifyCustomerModal UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits notify-customer payload with worklog details', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CustomerRequestNotifyCustomerModal
        open
        isSubmitting={false}
        requestCode="CRC-202603-0401"
        requestSummary="Hoàn thiện báo cáo tích hợp"
        customerName="VNPT Hà Nội"
        requesterName="Nguyễn A"
        completedAt="2026-03-21 09:00:00"
        resultContent="Đã hoàn tất cấu hình và xuất báo cáo mẫu."
        hoursReport={{
          request_case_id: 401,
          total_hours_spent: 3.5,
          estimated_hours: 4,
          hours_usage_pct: 88,
          billable_hours: 3,
          non_billable_hours: 0.5,
          worklog_count: 2,
        }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.selectOptions(screen.getByLabelText(/Kênh báo/i), 'Email');
    await user.type(screen.getByLabelText(/Phản hồi của KH/i), 'Khách hàng đã nhận email xác nhận.');
    await user.clear(screen.getByLabelText(/Nội dung đã báo khách hàng/i));
    await user.type(screen.getByLabelText(/Nội dung đã báo khách hàng/i), 'Đã gửi email xác nhận kết quả và hướng dẫn kiểm tra.');
    await user.type(screen.getByLabelText(/Ghi chú nội bộ/i), 'Hẹn follow-up nếu KH cần tinh chỉnh nhỏ.');

    await waitFor(() => {
      expect(screen.getByLabelText(/Activity/i)).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/Activity/i), 'support');
    await user.type(screen.getByLabelText(/Giờ công/i), '0.5');
    await user.clear(screen.getByLabelText(/Ngày làm việc/i));
    await user.type(screen.getByLabelText(/Ngày làm việc/i), '2026-03-21');
    await user.type(screen.getByLabelText(/Nội dung worklog/i), 'Gửi email báo kết quả và ghi nhận phản hồi ban đầu của khách hàng.');

    await user.click(screen.getByRole('button', { name: /Xác nhận - Kết thúc YC/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      notificationChannel: 'Email',
      notificationContent: 'Đã gửi email xác nhận kết quả và hướng dẫn kiểm tra.',
      customerFeedback: 'Khách hàng đã nhận email xác nhận.',
      note: 'Hẹn follow-up nếu KH cần tinh chỉnh nhỏ.',
      attachments: [],
      worklog: {
        activityTypeCode: 'support',
        hoursSpent: '0.5',
        workDate: '2026-03-21',
        workContent: 'Gửi email báo kết quả và ghi nhận phản hồi ban đầu của khách hàng.',
        isBillable: true,
      },
    });
  });
});
