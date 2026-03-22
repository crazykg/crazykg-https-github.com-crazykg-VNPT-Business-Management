import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRequestTransitionModal } from '../components/customer-request/CustomerRequestTransitionModal';

describe('CustomerRequestTransitionModal UI', () => {
  it('renders through a portal above detail modal layers and uses date-only inputs for customer feedback dates', () => {
    const { container, unmount } = render(
      <CustomerRequestTransitionModal
        show
        processDetail={{
          yeu_cau: {
            id: 6,
            ma_yc: 'CRC-202603-0006',
            request_code: 'CRC-202603-0006',
            trang_thai: 'in_progress',
            current_status_name_vi: 'Đang xử lý',
          },
        } as never}
        transitionStatusCode="waiting_customer_feedback"
        transitionRenderableFields={[
          {
            name: 'feedback_requested_at',
            label: 'Ngày gửi phản hồi',
            type: 'datetime',
            required: false,
          },
          {
            name: 'customer_due_at',
            label: 'Hạn phản hồi',
            type: 'datetime',
            required: false,
          },
          {
            name: 'customer_feedback_at',
            label: 'Ngày khách hàng phản hồi',
            type: 'datetime',
            required: false,
          },
          {
            name: 'customer_feedback_note',
            label: 'Nội dung khách hàng phản hồi',
            type: 'textarea',
            required: false,
          },
        ]}
        modalStatusPayload={{
          feedback_requested_at: '2026-03-22',
          customer_due_at: '',
          customer_feedback_at: '',
        }}
        onModalStatusPayloadChange={vi.fn()}
        modalIt360Tasks={[]}
        onAddModalIt360Task={vi.fn()}
        onUpdateModalIt360Task={vi.fn()}
        onRemoveModalIt360Task={vi.fn()}
        modalRefTasks={[]}
        onAddModalReferenceTask={vi.fn()}
        onUpdateModalReferenceTask={vi.fn()}
        onRemoveModalReferenceTask={vi.fn()}
        modalAttachments={[]}
        onUploadModalAttachment={vi.fn(async () => undefined)}
        onDeleteModalAttachment={vi.fn()}
        isModalUploading={false}
        modalNotes=""
        onModalNotesChange={vi.fn()}
        modalActiveTaskTab="IT360"
        onModalActiveTaskTabChange={vi.fn()}
        isTransitioning={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        modalTimeline={[]}
        modalHandlerUserId=""
        onModalHandlerUserIdChange={vi.fn()}
        projectRaciRows={[]}
        employees={[]}
        customers={[]}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        projectItems={[]}
        selectedCustomerId=""
        taskReferenceOptions={[]}
        taskReferenceSearchError=""
        taskReferenceSearchTerm=""
        onTaskReferenceSearchTermChange={vi.fn()}
        isTaskReferenceSearchLoading={false}
        caseContextAttachments={[]}
        caseContextIt360Tasks={[]}
        caseContextReferenceTasks={[]}
      />
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Thông tin cho trạng thái mới')).not.toBeInTheDocument();
    expect(screen.getByText('Nội dung khách hàng phản hồi')).toBeInTheDocument();
    expect(document.body.querySelectorAll('input[type="date"]')).toHaveLength(3);
    expect(document.body.querySelectorAll('input[type="datetime-local"]')).toHaveLength(0);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
