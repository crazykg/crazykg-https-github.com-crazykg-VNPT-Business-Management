import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentList } from '../components/DocumentList';
import { ReminderList } from '../components/ReminderList';
import type { Customer } from '../types/customer';
import type { Document, Reminder } from '../types/document';
import type { Employee } from '../types/employee';

const customers: Customer[] = [
  {
    id: '1',
    uuid: 'customer-1',
    customer_code: 'KH001',
    customer_name: 'Bệnh viện Trung tâm',
    tax_code: '0101010101',
    address: 'Ha Noi',
  },
];

const documents: Document[] = [
  {
    id: 'DOC001',
    name: 'Hợp đồng triển khai HIS',
    typeId: 'DT001',
    customerId: '1',
    status: 'ACTIVE',
    attachments: [],
  },
];

const employees: Employee[] = [
  {
    id: 1,
    uuid: 'emp-1',
    username: 'nva',
    full_name: 'Nguyễn Văn A',
    email: 'nva@vnpt.vn',
    status: 'ACTIVE',
    telechatbot: '1994683418',
    department_id: null,
    position_id: null,
  },
  {
    id: 2,
    uuid: 'emp-2',
    username: 'nvb',
    full_name: 'Nguyễn Văn B',
    email: 'nvb@vnpt.vn',
    status: 'ACTIVE',
    telechatbot: null,
    department_id: null,
    position_id: null,
  },
];

const reminders: Reminder[] = [
  {
    id: 'R001',
    title: 'Nhắc gia hạn tài liệu',
    content: 'Kiểm tra hợp đồng và biên bản nghiệm thu.',
    remindDate: '2099-01-01',
    assignedToUserId: '1',
  },
];

describe('Document and Reminder lists', () => {
  it('renders document customer/type metadata from the new document module types', () => {
    render(
      <DocumentList
        documents={documents}
        customers={customers}
        onOpenModal={vi.fn()}
      />
    );

    expect(screen.getByText('Hợp đồng triển khai HIS')).toBeInTheDocument();
    expect(screen.getByText('KH001 - Bệnh viện Trung tâm')).toBeInTheDocument();
    expect(screen.getByText('Hợp đồng kinh tế')).toBeInTheDocument();
  });

  it('renders reminder assignee labels from the new reminder/employee modules', () => {
    render(
      <ReminderList
        reminders={reminders}
        employees={employees}
        onOpenModal={vi.fn()}
        canSendReminderEmail={true}
        canSendReminderTelegram={true}
        onSendReminderEmail={vi.fn().mockResolvedValue(undefined)}
        onSendReminderTelegram={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Nhắc gia hạn tài liệu')).toBeInTheDocument();
    expect(screen.getByText('VNPT000001 - Nguyễn Văn A')).toBeInTheDocument();
  });

  it('opens telegram modal and only lists employees with telechatbot', () => {
    render(
      <ReminderList
        reminders={reminders}
        employees={employees}
        onOpenModal={vi.fn()}
        canSendReminderEmail={true}
        canSendReminderTelegram={true}
        onSendReminderEmail={vi.fn().mockResolvedValue(undefined)}
        onSendReminderTelegram={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByTitle('Gửi tele'));

    expect(screen.getByText('Gửi Telegram nhắc việc')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Nguyễn Văn A/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Nguyễn Văn B/i })).not.toBeInTheDocument();
  });

  it('submits telegram callback with selected recipient_user_id', async () => {
    const onSendReminderTelegram = vi.fn().mockResolvedValue(undefined);

    render(
      <ReminderList
        reminders={reminders}
        employees={employees}
        onOpenModal={vi.fn()}
        canSendReminderEmail={true}
        canSendReminderTelegram={true}
        onSendReminderEmail={vi.fn().mockResolvedValue(undefined)}
        onSendReminderTelegram={onSendReminderTelegram}
      />
    );

    fireEvent.click(screen.getByTitle('Gửi tele'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tele' }));

    expect(onSendReminderTelegram).toHaveBeenCalledWith(reminders[0], '1');
  });

  it('validates telegram recipient selection before submit', () => {
    const onSendReminderTelegram = vi.fn().mockResolvedValue(undefined);

    render(
      <ReminderList
        reminders={reminders}
        employees={employees}
        onOpenModal={vi.fn()}
        canSendReminderEmail={true}
        canSendReminderTelegram={true}
        onSendReminderEmail={vi.fn().mockResolvedValue(undefined)}
        onSendReminderTelegram={onSendReminderTelegram}
      />
    );

    fireEvent.click(screen.getByTitle('Gửi tele'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tele' }));

    expect(screen.getByText('Vui lòng chọn người nhận Telegram.')).toBeInTheDocument();
    expect(onSendReminderTelegram).not.toHaveBeenCalled();
  });
});
