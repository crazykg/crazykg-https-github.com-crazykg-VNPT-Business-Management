import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepRow, type StepRowProps } from '../components/procedure/StepRow';
import type { IssueStatus, ProcedureStepStatus, ProjectProcedureStep } from '../types';

const createSetter = <T,>(): React.Dispatch<React.SetStateAction<T>> => vi.fn();

const baseStep: ProjectProcedureStep = {
  id: 1001,
  procedure_id: 501,
  step_number: 1,
  step_name: 'Lập đề cương',
  phase: 'PHE_DUYET',
  sort_order: 1,
  parent_step_id: null,
  lead_unit: 'PGP2',
  expected_result: 'Biên bản',
  duration_days: 3,
  progress_status: 'CHUA_THUC_HIEN' as ProcedureStepStatus,
  actual_start_date: '2026-04-10',
  actual_end_date: '2026-04-12',
  worklogs_count: 0,
  blocking_worklogs_count: 0,
} as ProjectProcedureStep;

const baseProps: StepRowProps = {
  step: baseStep,
  draft: {},
  stepsInPhase: [baseStep],
  isEditing: false,
  isExpanded: false,
  isWlogOpen: false,
  isAttachOpen: false,
  isAddingChild: false,
  isAddingChildSubmitting: false,
  hasChildren: false,
  isAdmin: true,
  isRaciA: false,
  myId: '9',
  stepRaciEntries: [],
  raciMembers: [],
  wlogs: [],
  wlogInput: '',
  wlogHours: '',
  wlogDifficulty: '',
  wlogProposal: '',
  wlogIssueStatus: 'IN_PROGRESS' as IssueStatus,
  wlogSaving: false,
  editingRowDraft: { step_name: '', lead_unit: '', expected_result: '', duration_days: '' },
  attachList: [],
  attachLoading: false,
  attachUploading: false,
  newChildName: '',
  newChildUnit: '',
  newChildDays: '2',
  newChildStartDate: '2026-04-11',
  newChildEndDate: '2026-04-12',
  newChildStatus: 'CHUA_THUC_HIEN' as ProcedureStepStatus,
  editingWorklogId: null,
  editWorklogContent: '',
  editWorklogHours: '',
  editWorklogDiff: '',
  editWorklogProposal: '',
  editWorklogStatus: 'IN_PROGRESS' as IssueStatus,
  editWorklogSaving: false,
  deletingWorklogId: null,
  onDraftChange: vi.fn(),
  onStartDateChange: vi.fn(),
  onReorder: vi.fn(),
  onToggleDetail: vi.fn(),
  onStartEditRow: vi.fn(),
  onCancelEditRow: vi.fn(),
  onSaveEditRow: vi.fn(),
  onSetEditingRowDraft: createSetter<{ step_name: string; lead_unit: string; expected_result: string; duration_days: string }>(),
  onDeleteStep: vi.fn(),
  onOpenAttachments: vi.fn(),
  onUploadFile: vi.fn(),
  onDeleteAttachment: vi.fn(),
  onToggleWorklog: vi.fn(),
  onAddWorklog: vi.fn(),
  onAssignA: vi.fn(),
  onUpdateIssueStatus: vi.fn(),
  onStartEditWorklog: vi.fn(),
  onCancelEditWorklog: vi.fn(),
  onSaveEditWorklog: vi.fn(),
  onDeleteWorklog: vi.fn(),
  onSetWlogInput: vi.fn(),
  onSetWlogHours: vi.fn(),
  onSetWlogDifficulty: vi.fn(),
  onSetWlogProposal: vi.fn(),
  onSetWlogIssueStatus: vi.fn(),
  onSetEditWorklogContent: createSetter<string>(),
  onSetEditWorklogHours: createSetter<string>(),
  onSetEditWorklogDiff: createSetter<string>(),
  onSetEditWorklogProposal: createSetter<string>(),
  onSetEditWorklogStatus: createSetter<IssueStatus>(),
  onToggleAddChild: vi.fn(),
  onAddChildStep: vi.fn(),
  onSetChildName: createSetter<string>(),
  onSetChildUnit: createSetter<string>(),
  onSetChildDays: createSetter<string>(),
  onSetChildStartDate: createSetter<string>(),
  onSetChildEndDate: createSetter<string>(),
  onSetChildStatus: createSetter<ProcedureStepStatus>(),
  onCancelChild: vi.fn(),
};

describe('StepRow UI', () => {
  it('renders compact date inputs for procedure rows and child-add form', () => {
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} />
          <StepRow {...baseProps} isAddingChild />
        </tbody>
      </table>
    );

    const startInput = screen.getAllByTestId('step-start-date-1001')[0] as HTMLInputElement;
    const endInput = screen.getAllByTestId('step-end-date-1001')[0] as HTMLInputElement;
    const childStartInput = screen.getByTestId('step-child-start-date-1001') as HTMLInputElement;
    const childEndInput = screen.getByTestId('step-child-end-date-1001') as HTMLInputElement;

    [startInput, endInput, childStartInput, childEndInput].forEach((input) => {
      expect(input.className).toContain('w-[124px]');
      expect(input.className).toContain('[&::-webkit-calendar-picker-indicator]:ml-1');
      expect(input.className).toContain('[&::-webkit-datetime-edit]:p-0');
      expect(input.closest('td')).toHaveClass('px-2', 'py-2');
    });
  });

  it('does not count custom or blank-content logs in the worklog badge fallback', () => {
    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            step={{ ...baseStep, worklogs_count: undefined, blocking_worklogs_count: undefined }}
            wlogs={[
              {
                id: 1,
                step_id: 1001,
                procedure_id: 501,
                log_type: 'CUSTOM',
                content: 'Bước tùy chỉnh được thêm: Lập đề cương',
                created_at: '2026-04-10T08:00:00Z',
              },
              {
                id: 2,
                step_id: 1001,
                procedure_id: 501,
                log_type: 'NOTE',
                content: '   ',
                created_at: '2026-04-10T09:00:00Z',
              },
              {
                id: 3,
                step_id: 1001,
                procedure_id: 501,
                log_type: 'NOTE',
                content: 'Đã gọi khách hàng',
                created_at: '2026-04-10T10:00:00Z',
              },
            ]}
          />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('step-worklog-trigger-1001')).toHaveTextContent('Worklog(1)');
  });
});
