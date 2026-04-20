import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Customer, Employee, ProjectItemMaster, SupportServiceGroup } from '../types';
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

describe('CustomerRequestCreateModal UI', () => {
  it('renders the split create layout with a dedicated side rail for supporting sections', () => {
    const { container } = render(
      <CustomerRequestCreateModal
        masterFields={[
          { name: 'project_item_id', label: 'Khách hàng | Dự án | Sản phẩm', type: 'project_item_select', required: true },
          { name: 'summary', label: 'Nội dung yêu cầu', type: 'text', required: true },
          { name: 'description', label: 'Mô tả chi tiết', type: 'textarea', required: false },
        ]}
        masterDraft={{ customer_id: '20', project_item_id: '101', summary: 'YC mới', description: '' }}
        onMasterFieldChange={vi.fn()}
        customers={customers}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={supportServiceGroups}
        projectItems={projectItems}
        formAttachments={[]}
        onUploadAttachment={async () => undefined}
        onDeleteAttachment={async () => undefined}
        isUploadingAttachment={false}
        attachmentError=""
        attachmentNotice=""
        formIt360Tasks={[]}
        onAddIt360Task={vi.fn()}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        onAddReferenceTask={vi.fn()}
        onUpdateReferenceTaskRow={vi.fn()}
        onRemoveReferenceTaskRow={vi.fn()}
        taskReferenceOptions={[]}
        taskReferenceSearchTerm=""
        onTaskReferenceSearchTermChange={vi.fn()}
        taskReferenceSearchError=""
        isTaskReferenceSearchLoading={false}
        formTags={[]}
        onTagsChange={vi.fn()}
        isSaving={false}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Tạo yêu cầu mới')).toBeInTheDocument();
    expect(screen.queryByText('Ngữ cảnh')).not.toBeInTheDocument();
    expect(screen.queryByText('Task/Ref')).not.toBeInTheDocument();
    expect(screen.queryByText('File')).not.toBeInTheDocument();
    expect(screen.queryByText('Tag')).not.toBeInTheDocument();
    expect(screen.queryByText('Field')).not.toBeInTheDocument();
    expect(screen.getByText('Thẻ')).toBeInTheDocument();
    expect(screen.getByText('Task liên quan')).toBeInTheDocument();
    expect(screen.getByText('Đính kèm')).toBeInTheDocument();
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
    expect(modalPanel?.className).toContain('rounded-none');
    expect(modalPanel?.className).toContain('sm:rounded-3xl');
  });
});
