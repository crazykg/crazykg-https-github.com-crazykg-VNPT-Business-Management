import React from 'react';
import { render, screen } from '@testing-library/react';
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
        onSendReminderEmail={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Nhắc gia hạn tài liệu')).toBeInTheDocument();
    expect(screen.getByText('VNPT000001 - Nguyễn Văn A')).toBeInTheDocument();
  });
});
