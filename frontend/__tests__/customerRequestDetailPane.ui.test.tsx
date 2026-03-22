import React from 'react';
import { render, screen } from '@testing-library/react';
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
        customers={[{ id: 20, customer_code: 'C020', customer_name: 'VNPT Hà Nội', status: 'Active' }]}
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
});
