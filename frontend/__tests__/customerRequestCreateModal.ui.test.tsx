// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, CustomerPersonnel, Employee, ProjectItemMaster, SupportServiceGroup } from '../types';
import { CustomerRequestCreateModal } from '../components/customer-request/CustomerRequestCreateModal';

vi.mock('../services/api/customerRequestApi', () => ({
  fetchWorkflowDefinitions: vi.fn().mockResolvedValue([]),
}));

const customers: Customer[] = [
  {
    id: 20,
    uuid: 'customer-20',
    customer_code: 'C020',
    customer_name: 'VNPT Hà Nội',
    tax_code: '0123456789',
    address: 'Hà Nội',
  },
];

const employees: Employee[] = [
  {
    id: 7,
    uuid: 'employee-7',
    username: 'nguyena',
    full_name: 'Nguyễn A',
    user_code: 'U007',
    email: 'nguyena@example.com',
    status: 'ACTIVE',
    department_id: null,
    position_id: null,
  },
];

const projectItems: ProjectItemMaster[] = [
  {
    id: 101,
    project_id: 501,
    project_name: 'Dashboard SOC',
    customer_id: 20,
    customer_name: 'VNPT Hà Nội',
    product_id: 301,
    product_name: 'SOC Portal',
    display_name: 'Dashboard SOC | Portal',
  },
];

const supportServiceGroups: SupportServiceGroup[] = [];

const customerPersonnel: CustomerPersonnel[] = [
  {
    id: '301',
    fullName: 'Trần Văn B',
    birthday: '',
    positionType: 'DAU_MOI',
    positionId: null,
    positionLabel: 'Đầu mối',
    phoneNumber: '0900000001',
    email: 'tranvanb@example.com',
    customerId: '20',
    status: 'Active',
  },
];

const renderCreateModal = (overrides: Partial<React.ComponentProps<typeof CustomerRequestCreateModal>> = {}) => {
  const props: React.ComponentProps<typeof CustomerRequestCreateModal> = {
    masterFields: [
      { name: 'requester_id', label: 'Người yêu cầu', type: 'customer_personnel_select', required: true },
      { name: 'project_item_id', label: 'Khách hàng | Dự án | Sản phẩm', type: 'project_item_select', required: true },
      { name: 'summary', label: 'Nội dung yêu cầu', type: 'text', required: true },
      { name: 'description', label: 'Mô tả chi tiết', type: 'textarea', required: false },
    ],
    masterDraft: { customer_id: '20', requester_id: '301', project_item_id: '101', summary: 'YC mới', description: '' },
    onMasterFieldChange: vi.fn(),
    customers,
    employees,
    customerPersonnel,
    supportServiceGroups,
    projectItems,
    formAttachments: [],
    onUploadAttachment: async () => undefined,
    onDeleteAttachment: async () => undefined,
    isUploadingAttachment: false,
    attachmentError: '',
    attachmentNotice: '',
    formIt360Tasks: [],
    onAddIt360Task: vi.fn(),
    onUpdateIt360TaskRow: vi.fn(),
    onRemoveIt360TaskRow: vi.fn(),
    formReferenceTasks: [],
    onAddReferenceTask: vi.fn(),
    onUpdateReferenceTaskRow: vi.fn(),
    onRemoveReferenceTaskRow: vi.fn(),
    taskReferenceOptions: [],
    taskReferenceSearchTerm: '',
    onTaskReferenceSearchTermChange: vi.fn(),
    taskReferenceSearchError: '',
    isTaskReferenceSearchLoading: false,
    formTags: [],
    onTagsChange: vi.fn(),
    isSaving: false,
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  return render(<CustomerRequestCreateModal {...props} />);
};

describe('CustomerRequestCreateModal UI', () => {
  it('renders the split create layout with a dedicated side rail for supporting sections', () => {
    const { container } = renderCreateModal();

    expect(screen.getByText('Tạo yêu cầu mới')).toBeInTheDocument();
    expect(screen.queryByText('Ngữ cảnh')).not.toBeInTheDocument();
    expect(screen.queryByText('Task/Ref')).not.toBeInTheDocument();
    expect(screen.queryByText('File')).not.toBeInTheDocument();
    expect(screen.queryByText('Tag')).not.toBeInTheDocument();
    expect(screen.queryByText('Field')).not.toBeInTheDocument();
    expect(screen.getByText('Thẻ')).toBeInTheDocument();
    expect(screen.getByText('Task liên quan')).toBeInTheDocument();
    expect(screen.getByText('Tệp đính kèm')).toBeInTheDocument();
    expect(screen.queryByText('Danh sách file đính kèm')).not.toBeInTheDocument();
    expect(screen.queryByText('0 file')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có file nào được tải lên.')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt tạo mới')).not.toBeInTheDocument();
    expect(screen.queryByText('Thẻ (Tags)')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard SOC')).not.toBeInTheDocument();
    expect(screen.getByText('Mô tả chi tiết')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tải file/i })).toHaveLength(1);

    const attachmentHeader = screen.getByTestId('customer-request-create-attachment-header');
    expect(within(attachmentHeader).getByRole('button', { name: /Tải file/i })).toBeInTheDocument();

    const layout = screen.getByTestId('customer-request-create-layout');
    expect(layout.className).toContain('lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]');
    expect(layout.className).toContain('xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]');

    const description = screen.getByTestId('customer-request-create-description');
    expect(description.className).toContain('[&_textarea]:min-h-[150px]');
    expect(description.className).toContain('lg:[&_textarea]:min-h-[210px]');

    const rail = screen.getByTestId('customer-request-create-rail');
    expect(rail.className).toContain('lg:sticky');
    expect(rail.className).toContain('lg:top-0');

    const footer = screen.getByTestId('customer-request-create-footer');
    expect(footer.className).toContain('px-3');
    expect(footer.className).toContain('py-2');

    const modalPanel = container.querySelector('.max-w-none');
    expect(modalPanel).not.toBeNull();
    expect(modalPanel?.className).toContain('h-[calc(100dvh-32px)]');
    expect(modalPanel?.className).toContain('sm:h-[calc(100dvh-48px)]');
    expect(modalPanel?.className).toContain('rounded-[var(--ui-modal-mobile-radius)]');
    expect(modalPanel?.className).toContain('sm:rounded-[var(--ui-modal-radius)]');
  });

  it('shows add-customer-personnel action inside requester combobox and triggers callback', () => {
    const onOpenAddCustomerPersonnelModal = vi.fn();
    renderCreateModal({ onOpenAddCustomerPersonnelModal });

    const requesterTrigger = screen.getByRole('button', { name: /Người yêu cầu/i });
    expect(within(requesterTrigger).getByText('Trần Văn B')).toBeInTheDocument();
    expect(within(requesterTrigger).getByText('add')).toBeInTheDocument();
    expect(within(requesterTrigger).getByText('expand_more')).toBeInTheDocument();

    const valueSlot = within(requesterTrigger).getByText('Trần Văn B');
    expect(valueSlot.className).toContain('pr-16');

    const addCustomerPersonnelAction = screen.getByRole('button', { name: 'Thêm nhân sự liên hệ' });
    expect(addCustomerPersonnelAction).toHaveAttribute('title', 'Thêm nhân sự liên hệ');

    expect(requesterTrigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(addCustomerPersonnelAction);
    expect(onOpenAddCustomerPersonnelModal).toHaveBeenCalledTimes(1);
    expect(requesterTrigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(addCustomerPersonnelAction, { key: 'Enter' });
    fireEvent.keyDown(addCustomerPersonnelAction, { key: ' ' });
    expect(onOpenAddCustomerPersonnelModal).toHaveBeenCalledTimes(3);
  });

  it('opens inline confirm before removing a reference row', async () => {
    const user = userEvent.setup();
    const onRemoveReferenceTaskRow = vi.fn();

    renderCreateModal({
      formReferenceTasks: [{ local_id: 'ref-1', task_code: 'CRC-202604-0015' }],
      onRemoveReferenceTaskRow,
    });

    await user.click(screen.getByRole('button', { name: /Ref/i }));
    await user.click(screen.getByRole('button', { name: 'Bỏ Ref #1' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Bỏ Ref này?')).toBeInTheDocument();
    expect(screen.getByText('Liên kết này sẽ bị gỡ khỏi yêu cầu hiện tại. Yêu cầu gốc không bị xoá.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bỏ Ref' }));

    expect(onRemoveReferenceTaskRow).toHaveBeenCalledTimes(1);
    expect(onRemoveReferenceTaskRow).toHaveBeenCalledWith('ref-1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
