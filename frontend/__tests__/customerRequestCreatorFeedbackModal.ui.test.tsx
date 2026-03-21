import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerRequestCreatorFeedbackModal } from '../components/customer-request/CustomerRequestCreatorFeedbackModal';

vi.mock('../services/v5Api', () => ({
  fetchWorklogActivityTypes: vi.fn().mockResolvedValue([
    { id: 1, code: 'support', name: 'Hỗ trợ' },
  ]),
}));

describe('CustomerRequestCreatorFeedbackModal UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits request-more-info decision with follow-up content', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CustomerRequestCreatorFeedbackModal
        open
        isSubmitting={false}
        requestCode="CRC-202603-0318"
        requestSummary="Module kết nối"
        lastFeedbackRequestContent="Gửi tài liệu API"
        lastFeedbackRequestedAt="2026-03-20 10:30:00"
        customerDueAt="2026-03-22 17:00:00"
        customerFeedbackAt="2026-03-21 09:10:00"
        customerFeedbackContent="Đã gửi tài liệu qua email"
        canContinueProcessing={true}
        canRequestMoreInfo={true}
        canRejectRequest={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByLabelText(/Yêu cầu KH bổ sung/i));
    await user.clear(screen.getByLabelText(/Nội dung cần khách hàng bổ sung/i));
    await user.type(screen.getByLabelText(/Nội dung cần khách hàng bổ sung/i), 'Bổ sung file mẫu export.');
    await user.type(screen.getByLabelText(/Hạn khách hàng phản hồi mới/i), '2026-03-25T15:30');
    await user.type(screen.getByLabelText(/Ghi chú đánh giá/i), 'Đã rà soát nhưng còn thiếu dữ liệu.');

    await waitFor(() => {
      expect(screen.getByLabelText(/Activity/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Lưu đánh giá KH/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      decision: 'request_more_info',
      note: 'Đã rà soát nhưng còn thiếu dữ liệu.',
      feedbackRequestContent: 'Bổ sung file mẫu export.',
      customerDueAt: '2026-03-25T15:30',
      rejectReason: '',
      worklog: null,
    });
  });
});
