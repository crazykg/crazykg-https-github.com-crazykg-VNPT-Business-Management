import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Employee, ProjectItemMaster } from '../types';
import { CustomerRequestDetailPane } from '../components/customer-request/CustomerRequestDetailPane';
import { buildInitialCreateFlowDraft } from '../components/customer-request/createFlow';

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

const selectedProjectItem: ProjectItemMaster = {
  id: 101,
  project_id: 501,
  project_name: 'Dashboard SOC',
  customer_id: 20,
  customer_name: 'VNPT Hà Nội',
  product_id: 301,
  product_name: 'SOC Portal',
  display_name: 'Dashboard SOC | Portal',
};

describe('CustomerRequestDetailPane UI', () => {
  it('shows create flow panel and create-only layout in create mode', () => {
    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={true}
        processDetail={null}
        canTransitionActiveRequest={false}
        transitionOptions={[]}
        transitionStatusCode=""
        onTransitionStatusCodeChange={vi.fn()}
        onOpenTransitionModal={vi.fn()}
        isSaving={false}
        canEditActiveForm={true}
        masterFields={[]}
        masterDraft={{ customer_id: '20' }}
        onMasterFieldChange={vi.fn()}
        editorProcessMeta={{ process_code: 'new_intake', process_label: 'Mới tiếp nhận', group_code: 'intake', group_label: 'Tiếp nhận', table_name: 'customer_request_cases', default_status: 'new_intake', read_roles: [], write_roles: [], allowed_next_processes: [], form_fields: [], list_columns: [] }}
        processDraft={{}}
        onProcessDraftChange={vi.fn()}
        customers={[{ id: 20, uuid: 'customer-20', customer_code: 'C020', customer_name: 'VNPT Hà Nội', tax_code: '0123456789', address: 'Hà Nội' }]}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        availableProjectItems={[selectedProjectItem]}
        selectedProjectItem={selectedProjectItem}
        selectedCustomerId="20"
        currentUserName="Nguyễn A"
        createFlowDraft={buildInitialCreateFlowDraft(7)}
        onCreateFlowDraftChange={vi.fn()}
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[{ local_id: 't1', task_code: '', task_link: '', status: 'TODO' }]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[{ local_id: 'r1', task_code: '' }]}
        taskReferenceOptions={[]}
        onUpdateReferenceTaskRow={vi.fn()}
        onTaskReferenceSearchTermChange={vi.fn()}
        taskReferenceSearchTerm=""
        taskReferenceSearchError=""
        isTaskReferenceSearchLoading={false}
        onRemoveReferenceTaskRow={vi.fn()}
        formAttachments={[]}
        onUploadAttachment={async () => undefined}
        onDeleteAttachment={async () => undefined}
        isUploadingAttachment={false}
        attachmentError=""
        attachmentNotice=""
        relatedSummaryItems={[]}
        currentHoursReport={null}
        estimateHistory={[]}
        timeline={[]}
        caseWorklogs={[]}
        canOpenCreatorFeedbackModal={false}
        onOpenCreatorFeedbackModal={vi.fn()}
        canOpenNotifyCustomerModal={false}
        onOpenNotifyCustomerModal={vi.fn()}
        canOpenWorklogModal={false}
        onOpenWorklogModal={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
      />
    );

    expect(screen.getByText('Khởi tạo xử lý')).toBeInTheDocument();
    expect(screen.getByText('Đính kèm nhanh')).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch khi tạo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Task\/Ref/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Giờ công/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ước lượng/i })).not.toBeInTheDocument();
  });

  it('shows direct worklog and estimate actions inside their tabs when actions are allowed', async () => {
    const user = userEvent.setup();
    const onOpenWorklogModal = vi.fn();
    const onOpenEstimateModal = vi.fn();

    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        processDetail={{
          yeu_cau: {
            id: 8,
            ma_yc: 'CRC-202603-0008',
            request_code: 'CRC-202603-0008',
            tieu_de: 'Hỗ trợ LIS',
            summary: 'Hỗ trợ LIS',
            trang_thai: 'in_progress',
            current_status_name_vi: 'Đang xử lý',
            customer_name: 'Bệnh viện Sản',
            khach_hang_name: 'Bệnh viện Sản',
            project_name: 'Nhi Hậu Giang',
          },
          process: {
            process_code: 'in_progress',
            process_label: 'Đang xử lý',
            group_code: 'processing',
            group_label: 'Xử lý',
            table_name: 'customer_request_in_progress',
            default_status: 'in_progress',
            read_roles: [],
            write_roles: [],
            allowed_next_processes: [],
            form_fields: [],
            list_columns: [],
          },
          allowed_next_processes: [],
          transition_allowed: false,
          can_write: true,
          available_actions: {
            can_write: true,
            can_add_worklog: true,
            can_add_estimate: true,
          },
          estimates: [],
          hours_report: {
            request_case_id: 8,
            estimated_hours: 12,
            total_hours_spent: 3.5,
            remaining_hours: 8.5,
            hours_usage_pct: 29,
          },
        } as never}
        canTransitionActiveRequest={false}
        transitionOptions={[]}
        transitionStatusCode=""
        onTransitionStatusCodeChange={vi.fn()}
        onOpenTransitionModal={vi.fn()}
        isSaving={false}
        canEditActiveForm={true}
        masterFields={[]}
        masterDraft={{}}
        onMasterFieldChange={vi.fn()}
        editorProcessMeta={null}
        processDraft={{}}
        onProcessDraftChange={vi.fn()}
        customers={[]}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        availableProjectItems={[selectedProjectItem]}
        selectedProjectItem={selectedProjectItem}
        selectedCustomerId="20"
        currentUserName="Nguyễn A"
        createFlowDraft={buildInitialCreateFlowDraft(7)}
        onCreateFlowDraftChange={vi.fn()}
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        taskReferenceOptions={[]}
        onUpdateReferenceTaskRow={vi.fn()}
        onTaskReferenceSearchTermChange={vi.fn()}
        taskReferenceSearchTerm=""
        taskReferenceSearchError=""
        isTaskReferenceSearchLoading={false}
        onRemoveReferenceTaskRow={vi.fn()}
        formAttachments={[]}
        onUploadAttachment={async () => undefined}
        onDeleteAttachment={async () => undefined}
        isUploadingAttachment={false}
        attachmentError=""
        attachmentNotice=""
        relatedSummaryItems={[]}
        currentHoursReport={{
          request_case_id: 8,
          estimated_hours: 12,
          total_hours_spent: 3.5,
          remaining_hours: 8.5,
          hours_usage_pct: 29,
        }}
        estimateHistory={[]}
        timeline={[]}
        caseWorklogs={[]}
        canOpenCreatorFeedbackModal={false}
        onOpenCreatorFeedbackModal={vi.fn()}
        canOpenNotifyCustomerModal={false}
        onOpenNotifyCustomerModal={vi.fn()}
        canOpenWorklogModal={true}
        onOpenWorklogModal={onOpenWorklogModal}
        isSubmittingWorklog={false}
        canOpenEstimateModal={true}
        onOpenEstimateModal={onOpenEstimateModal}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
      />
    );

    const hoursTabButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Giờ công'));
    expect(hoursTabButton).toBeDefined();
    await user.click(hoursTabButton!);
    await user.click(screen.getByRole('button', { name: /Ghi giờ công/i }));
    expect(onOpenWorklogModal).toHaveBeenCalledTimes(1);

    const estimateTabButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Ước lượng') && !button.textContent?.includes('Cập nhật'));
    expect(estimateTabButton).toBeDefined();
    await user.click(estimateTabButton!);
    await user.click(screen.getByRole('button', { name: /Cập nhật ước lượng/i }));
    expect(onOpenEstimateModal).toHaveBeenCalledTimes(1);
  });
});
