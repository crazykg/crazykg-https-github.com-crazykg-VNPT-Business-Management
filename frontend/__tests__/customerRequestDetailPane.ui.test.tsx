import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Employee, ProjectItemMaster } from '../types';
import { CustomerRequestDetailPane } from '../components/customer-request/CustomerRequestDetailPane';
import { formatDateTimeDdMmYyyy } from '../utils/dateDisplay';

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
  it('hides the customer field from the request form while keeping other fields visible', () => {
    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        processDetail={{
          yeu_cau: {
            id: 20,
            ma_yc: 'CRC-202603-0020',
            request_code: 'CRC-202603-0020',
            tieu_de: 'YC ẩn khách hàng',
            summary: 'YC ẩn khách hàng',
            trang_thai: 'new_intake',
            current_status_code: 'new_intake',
            current_status_name_vi: 'Tiếp nhận',
            customer_name: 'VNPT Hà Nội',
            khach_hang_name: 'VNPT Hà Nội',
            project_name: 'Dashboard SOC',
          },
          process: {
            process_code: 'new_intake',
            process_label: 'Mới tiếp nhận',
            group_code: 'intake',
            group_label: 'Tiếp nhận',
            table_name: 'customer_request_cases',
            default_status: 'new_intake',
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
          },
          estimates: [],
          hours_report: null,
        } as never}
        canTransitionActiveRequest={false}
        transitionOptions={[]}
        transitionStatusCode=""
        onTransitionStatusCodeChange={vi.fn()}
        onOpenTransitionModal={vi.fn()}
        isSaving={false}
        canEditActiveForm={true}
        masterFields={[
          { name: 'customer_id', label: 'Khách hàng', type: 'customer_select', required: false },
          { name: 'summary', label: 'Nội dung yêu cầu', type: 'text', required: true },
        ]}
        masterDraft={{ customer_id: '20', summary: 'YC ẩn khách hàng' }}
        onMasterFieldChange={vi.fn()}
        editorProcessMeta={null}
        processDraft={{}}
        onProcessDraftChange={vi.fn()}
        customers={[{ id: 20, uuid: 'customer-20', customer_code: 'C020', customer_name: 'VNPT Hà Nội', tax_code: '0123456789', address: 'Hà Nội' }]}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        availableProjectItems={[selectedProjectItem]}
        selectedProjectItem={selectedProjectItem}
        selectedCustomerId="20"
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    expect(screen.queryByText('Khách hàng')).not.toBeInTheDocument();
    expect(screen.getByText('Nội dung yêu cầu')).toBeInTheDocument();
  });

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
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[{ local_id: 't1', task_code: '', task_link: '', status: 'TODO' }]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[{ local_id: 'r1', task_code: '' }]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Ngữ cảnh')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Tệp đính kèm')).toBeInTheDocument();
    expect(screen.getByText('Thẻ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Task\/Ref/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Giờ công/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ước lượng/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Kế hoạch khi tạo')).not.toBeInTheDocument();
    expect(screen.queryByText('Tổng quan ca')).not.toBeInTheDocument();
  });

  it('hides the summary bar in full modal update presentation', () => {
    const { container } = render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        presentation="full_modal"
        processDetail={{
          yeu_cau: {
            id: 20,
            ma_yc: 'CRC-202603-0020',
            request_code: 'CRC-202603-0020',
            tieu_de: 'YC full modal',
            summary: 'YC full modal',
            trang_thai: 'new_intake',
            current_status_code: 'new_intake',
            current_status_name_vi: 'Tiếp nhận',
            ket_qua: 'dang_xu_ly',
            customer_name: 'VNPT Hà Nội',
            khach_hang_name: 'VNPT Hà Nội',
            project_name: 'Dashboard SOC',
          },
          process: {
            process_code: 'new_intake',
            process_label: 'Mới tiếp nhận',
            group_code: 'intake',
            group_label: 'Tiếp nhận',
            table_name: 'customer_request_cases',
            default_status: 'new_intake',
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
          },
          estimates: [],
          hours_report: null,
        } as never}
        canTransitionActiveRequest={false}
        transitionOptions={[]}
        transitionStatusCode=""
        onTransitionStatusCodeChange={vi.fn()}
        onOpenTransitionModal={vi.fn()}
        isSaving={false}
        canEditActiveForm={true}
        masterFields={[
          { name: 'summary', label: 'Nội dung yêu cầu', type: 'text', required: true },
        ]}
        masterDraft={{ summary: 'YC full modal' }}
        onMasterFieldChange={vi.fn()}
        editorProcessMeta={null}
        processDraft={{}}
        onProcessDraftChange={vi.fn()}
        customers={[{ id: 20, uuid: 'customer-20', customer_code: 'C020', customer_name: 'VNPT Hà Nội', tax_code: '0123456789', address: 'Hà Nội' }]}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        availableProjectItems={[selectedProjectItem]}
        selectedProjectItem={selectedProjectItem}
        selectedCustomerId="20"
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
        relatedSummaryItems={[
          { label: 'Người tiếp nhận', value: 'Nguyễn A' },
          { label: 'Khách hàng', value: 'VNPT Hà Nội' },
        ]}
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
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    const topLayout = Array.from(container.querySelectorAll('div')).find((node) =>
      typeof node.className === 'string'
      && node.className.includes('xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]')
    );
    const fullWidthContainers = Array.from(container.querySelectorAll('div')).filter((node) =>
      typeof node.className === 'string'
      && node.className === 'w-full'
    );

    expect(screen.queryByText('Kết quả')).not.toBeInTheDocument();
    expect(screen.queryByText('Người tiếp nhận')).not.toBeInTheDocument();
    expect(screen.getByText('Trạng thái xử lý')).toBeInTheDocument();
    expect(screen.getByText('Thông tin yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Thẻ')).toBeInTheDocument();
    expect(screen.getByText('Task liên quan')).toBeInTheDocument();
    expect(screen.getByText('Tệp đính kèm')).toBeInTheDocument();
    expect(screen.queryByText('Tổng quan ca')).not.toBeInTheDocument();
    expect(screen.queryByText('Người liên quan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Task\/Ref$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tệp$/i })).not.toBeInTheDocument();
    expect(topLayout).toBeTruthy();
    expect(fullWidthContainers.length).toBeGreaterThanOrEqual(2);
  });

  it('shows inline confirm before removing a reference row in full modal presentation', async () => {
    const user = userEvent.setup();
    const onRemoveReferenceTaskRow = vi.fn();

    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        presentation="full_modal"
        processDetail={{
          yeu_cau: {
            id: 22,
            ma_yc: 'CRC-202604-0015',
            request_code: 'CRC-202604-0015',
            tieu_de: 'Hỗ trợ LIS',
            summary: 'Hỗ trợ LIS',
            trang_thai: 'new_intake',
            current_status_code: 'new_intake',
            current_status_name_vi: 'Tiếp nhận',
            customer_name: 'VNPT Hà Nội',
            khach_hang_name: 'VNPT Hà Nội',
            project_name: 'Dashboard SOC',
          },
          process: {
            process_code: 'new_intake',
            process_label: 'Mới tiếp nhận',
            group_code: 'intake',
            group_label: 'Tiếp nhận',
            table_name: 'customer_request_cases',
            default_status: 'new_intake',
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
          },
          estimates: [],
          hours_report: null,
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
        customers={[{ id: 20, uuid: 'customer-20', customer_code: 'C020', customer_name: 'VNPT Hà Nội', tax_code: '0123456789', address: 'Hà Nội' }]}
        employees={employees}
        customerPersonnel={[]}
        supportServiceGroups={[]}
        availableProjectItems={[selectedProjectItem]}
        selectedProjectItem={selectedProjectItem}
        selectedCustomerId="20"
        activeTaskTab="REFERENCE"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[{ local_id: 'ref-1', task_code: 'CRC-202604-0015' }]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
        taskReferenceOptions={[{ value: 'CRC-202604-0015', label: 'CRC-202604-0015 — Hỗ trợ LIS' }]}
        onUpdateReferenceTaskRow={vi.fn()}
        onTaskReferenceSearchTermChange={vi.fn()}
        taskReferenceSearchTerm=""
        taskReferenceSearchError=""
        isTaskReferenceSearchLoading={false}
        onRemoveReferenceTaskRow={onRemoveReferenceTaskRow}
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
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Bỏ Ref #1' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Bỏ Ref này?')).toBeInTheDocument();
    expect(screen.getByText('Liên kết này sẽ bị gỡ khỏi yêu cầu hiện tại. Yêu cầu gốc không bị xoá.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bỏ Ref' }));

    expect(onRemoveReferenceTaskRow).toHaveBeenCalledTimes(1);
    expect(onRemoveReferenceTaskRow).toHaveBeenCalledWith('ref-1');
  });

  it('removes activity and performer summary cards from the hours tab in full modal presentation', () => {
    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        presentation="full_modal"
        processDetail={{
          yeu_cau: {
            id: 21,
            ma_yc: 'CRC-202603-0021',
            request_code: 'CRC-202603-0021',
            tieu_de: 'YC ẩn summary giờ công',
            summary: 'YC ẩn summary giờ công',
            trang_thai: 'in_progress',
            current_status_name_vi: 'Đang xử lý',
            customer_name: 'VNPT Hà Nội',
            khach_hang_name: 'VNPT Hà Nội',
            project_name: 'Dashboard SOC',
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
          },
          estimates: [],
          hours_report: {
            request_case_id: 21,
            estimated_hours: 8,
            total_hours_spent: 4,
            remaining_hours: 4,
            hours_usage_pct: 50,
            by_activity: [
              {
                activity_type_code: 'Khảo sát hiện trường',
                hours_spent: 4,
                worklog_count: 2,
              },
            ],
            by_performer: [
              {
                performed_by_user_id: 7,
                performed_by_name: 'Phan Văn Rở',
                hours_spent: 4,
                worklog_count: 2,
              },
            ],
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
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
          request_case_id: 21,
          estimated_hours: 8,
          total_hours_spent: 4,
          remaining_hours: 4,
          hours_usage_pct: 50,
          by_activity: [
            {
              activity_type_code: 'Khảo sát hiện trường',
              hours_spent: 4,
              worklog_count: 2,
            },
          ],
          by_performer: [
            {
              performed_by_user_id: 7,
              performed_by_name: 'Phan Văn Rở',
              hours_spent: 4,
              worklog_count: 2,
            },
          ],
        }}
        estimateHistory={[]}
        timeline={[]}
        caseWorklogs={[]}
        canOpenCreatorFeedbackModal={false}
        onOpenCreatorFeedbackModal={vi.fn()}
        canOpenNotifyCustomerModal={false}
        onOpenNotifyCustomerModal={vi.fn()}
        canOpenWorklogModal={true}
        onOpenWorklogModal={vi.fn()}
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Nhật ký công việc')).toBeInTheDocument();
    expect(screen.queryByText('Theo hoạt động')).not.toBeInTheDocument();
    expect(screen.queryByText('Theo người thực hiện')).not.toBeInTheDocument();
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
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={true}
        onOpenEstimateModal={onOpenEstimateModal}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
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

  it('shows timeline content inside the worklog frame in full modal presentation', async () => {
    const user = userEvent.setup();

    render(
      <CustomerRequestDetailPane
        isDetailLoading={false}
        isListLoading={false}
        isCreateMode={false}
        presentation="full_modal"
        processDetail={{
          yeu_cau: {
            id: 9,
            ma_yc: 'CRC-202603-0009',
            request_code: 'CRC-202603-0009',
            tieu_de: 'Hỗ trợ HIS',
            summary: 'Hỗ trợ HIS',
            trang_thai: 'in_progress',
            current_status_code: 'assigned_to_receiver',
            current_status_name_vi: 'Giao R thực hiện',
            nguoi_xu_ly_name: 'Trịnh Minh Tuấn',
            customer_name: 'Bệnh viện Sản',
            khach_hang_name: 'Bệnh viện Sản',
            project_name: 'HIS Core',
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
          },
          estimates: [],
          hours_report: {
            request_case_id: 9,
            estimated_hours: 10,
            total_hours_spent: 4,
            remaining_hours: 6,
            hours_usage_pct: 40,
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
        activeTaskTab="IT360"
        onActiveTaskTabChange={vi.fn()}
        onAddTaskRow={vi.fn()}
        formIt360Tasks={[]}
        onUpdateIt360TaskRow={vi.fn()}
        onRemoveIt360TaskRow={vi.fn()}
        formReferenceTasks={[]}
        formTags={[]}
        onFormTagsChange={vi.fn()}
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
          request_case_id: 9,
          estimated_hours: 10,
          total_hours_spent: 4,
          remaining_hours: 6,
          hours_usage_pct: 40,
        }}
        estimateHistory={[]}
        timeline={[
          {
            id: 501,
            yeu_cau_id: 9,
            tien_trinh: 'assigned_to_receiver',
            trang_thai_cu: 'Tiếp nhận',
            trang_thai_moi: 'Giao R thực hiện',
            nguoi_thay_doi_name: 'Phan Văn Rở',
            nguoi_thay_doi_code: 'VNPT022600',
            nguoi_xu_ly_name: 'Trịnh Minh Tuấn',
            nguoi_xu_ly_code: 'VNPT009999',
            created_at: '2026-04-20 08:00:00',
          },
          {
            id: 500,
            yeu_cau_id: 9,
            tien_trinh: 'new_intake',
            trang_thai_moi: 'Tiếp nhận',
            nguoi_thay_doi_name: 'Phan Văn Rở',
            nguoi_thay_doi_code: 'VNPT022600',
            created_at: '2026-04-20 07:30:00',
          },
        ] as never}
        caseWorklogs={[
          {
            id: 1001,
            performed_by_name: 'Phan Văn Rở',
            performed_by_code: 'VNPT022600',
            hours_spent: 2,
            activity_type_code: 'Khảo sát',
            work_date: '2026-04-20',
            work_started_at: '2026-04-20 08:00:00',
            work_content: 'asdfasdf',
            difficulty_status: 'resolved',
            difficulty_note: 'asdfasdf',
            proposal_note: 'asdfasdf',
            detail_status_action: 'in_progress',
            status_code: 'new_intake',
            status_name_vi: 'Tiếp nhận',
          },
        ] as never}
        canOpenCreatorFeedbackModal={false}
        onOpenCreatorFeedbackModal={vi.fn()}
        canOpenNotifyCustomerModal={false}
        onOpenNotifyCustomerModal={vi.fn()}
        canOpenWorklogModal={true}
        onOpenWorklogModal={vi.fn()}
        onOpenDetailStatusWorklogModal={vi.fn()}
        onEditWorklog={vi.fn()}
        isSubmittingWorklog={false}
        canOpenEstimateModal={false}
        onOpenEstimateModal={vi.fn()}
        isSubmittingEstimate={false}
        dispatcherQuickActions={[]}
        onRunDispatcherAction={vi.fn()}
        performerQuickActions={[]}
        onRunPerformerAction={vi.fn()}
        onSaveStatusDetail={vi.fn()}
      />
    );

    const hoursTabButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Giờ công'));
    expect(hoursTabButton).toBeDefined();
    await user.click(hoursTabButton!);

    expect(screen.getAllByText('2 dòng').length).toBeGreaterThanOrEqual(1);
    const expectedTimelineTime = formatDateTimeDdMmYyyy('2026-04-20 08:00:00')?.slice(0, 16);
    expect(
      screen.getAllByText((_, element) => {
        const text = element?.textContent?.trim() ?? '';
        return text.includes('VNPT022600 - Phan Văn Rở giao R thực hiện VNPT009999 - Trịnh Minh Tuấn')
          && text.includes(expectedTimelineTime ?? '');
      }).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText((_, element) => {
      const text = element?.textContent?.trim() ?? '';
      return text.includes('VNPT022600 - Phan Văn Rở tiếp nhận')
        && text.includes(formatDateTimeDdMmYyyy('2026-04-20 07:30:00')?.slice(0, 16) ?? '');
    }).length).toBeGreaterThanOrEqual(1);
  });
});
