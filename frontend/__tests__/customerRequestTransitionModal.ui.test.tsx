import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('z-[130]');
    expect(dialog).toHaveClass('p-0');

    const modalShell = dialog.querySelector('div.relative');
    expect(modalShell).not.toBeNull();
    expect(modalShell?.className).toContain('h-[90dvh]');
    expect(modalShell?.className).toContain('max-w-none');
    expect(modalShell?.className).toContain('rounded-none');
    expect(modalShell?.className).not.toContain('sm:h-[calc(100dvh-48px)]');
    expect(modalShell?.className).not.toContain('sm:max-w-[1480px]');
    expect(modalShell?.className).not.toContain('sm:rounded-3xl');
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

  it('keeps the time segment read-only while still allowing the date to be selected for in-progress scheduling fields', () => {
    const onModalStatusPayloadChange = vi.fn();
    render(
      <CustomerRequestTransitionModal
        show
        processDetail={{
          yeu_cau: {
            id: 8,
            ma_yc: 'CRC-202603-0008',
            request_code: 'CRC-202603-0008',
            trang_thai: 'new_intake',
            current_status_name_vi: 'Mới tiếp nhận',
          },
        } as never}
        transitionStatusCode="in_progress"
        transitionRenderableFields={[
          {
            name: 'performer_user_id',
            label: 'Người thực hiện',
            type: 'user_select',
            required: true,
          },
          {
            name: 'started_at',
            label: 'Ngày bắt đầu',
            type: 'datetime',
            required: false,
          },
          {
            name: 'expected_completed_at',
            label: 'Ngày dự kiến hoàn thành',
            type: 'datetime',
            required: false,
          },
          {
            name: 'progress_percent',
            label: 'Tiến độ',
            type: 'number',
            required: false,
          },
        ]}
        modalStatusPayload={{
          performer_user_id: '3',
          started_at: '2026-03-23 21:32:00',
          expected_completed_at: '2026-03-24 21:32:00',
          progress_percent: '0',
        }}
        onModalStatusPayloadChange={onModalStatusPayloadChange}
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

    const datetimeInputs = Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')
    );
    const dateInputs = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    const timeInputs = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="time"]'));

    expect(datetimeInputs).toHaveLength(0);
    expect(dateInputs).toHaveLength(2);
    expect(dateInputs[0]?.disabled).toBe(false);
    expect(dateInputs[0]?.value).toBe('2026-03-23');
    expect(dateInputs[1]?.disabled).toBe(false);
    expect(dateInputs[1]?.value).toBe('2026-03-24');
    expect(timeInputs).toHaveLength(2);
    expect(timeInputs[0]?.disabled).toBe(true);
    expect(timeInputs[0]?.value).toBe('21:32');
    expect(timeInputs[1]?.disabled).toBe(true);
    expect(timeInputs[1]?.value).toBe('21:32');

    const progressInput = document.body.querySelector<HTMLInputElement>('input[type="number"]');
    expect(progressInput).not.toBeNull();
    expect(progressInput?.min).toBe('0');
    expect(progressInput?.max).toBe('100');
    expect(progressInput?.step).toBe('1');

    if (progressInput) {
      fireEvent.change(progressInput, { target: { value: '150' } });
      fireEvent.change(progressInput, { target: { value: '-12' } });
    }

    expect(onModalStatusPayloadChange).toHaveBeenNthCalledWith(1, 'progress_percent', '100');
    expect(onModalStatusPayloadChange).toHaveBeenNthCalledWith(2, 'progress_percent', '0');
  });
});
