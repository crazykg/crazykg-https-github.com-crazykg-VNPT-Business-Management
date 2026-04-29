import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  displayNumber: '1',
  datePlaceholder: 'dd/mm/yyyy',
  draft: {},
  stepsInScope: [baseStep],
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
  onEndDateChange: vi.fn(),
  onDateRangeBlur: vi.fn(),
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
      expect(input).toHaveAttribute('type', 'text');
      expect(input.inputMode).toBe('numeric');
      expect(input).toHaveAttribute('placeholder', 'dd/mm/yyyy');
      expect(input.className).toContain('w-[124px]');
      expect(input.className).toContain('focus:ring-1');
      expect(input.closest('td')).toHaveClass('px-2', 'py-2');
    });
    expect(endInput).not.toBeDisabled();
    expect(endInput).not.toHaveAttribute('readonly');
    expect(childEndInput).not.toBeDisabled();
    expect(childEndInput).not.toHaveAttribute('readonly');
  });

  it('uses dd/mm/yyyy placeholders for empty project date inputs without changing values', () => {
    const emptyDateStep = {
      ...baseStep,
      duration_days: 0,
      actual_start_date: null,
      actual_end_date: null,
    } as ProjectProcedureStep;

    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            step={emptyDateStep}
            isAddingChild
            newChildDays=""
            newChildStartDate=""
            newChildEndDate=""
          />
        </tbody>
      </table>
    );

    const startInput = screen.getByTestId('step-start-date-1001') as HTMLInputElement;
    const endInput = screen.getByTestId('step-end-date-1001') as HTMLInputElement;
    const childStartInput = screen.getByTestId('step-child-start-date-1001') as HTMLInputElement;
    const childEndInput = screen.getByTestId('step-child-end-date-1001') as HTMLInputElement;

    [startInput, endInput, childStartInput, childEndInput].forEach((input) => {
      expect(input).toHaveValue('');
      expect(input).toHaveAttribute('placeholder', 'dd/mm/yyyy');
      expect(input.className).not.toContain('[&::-webkit-datetime-edit]:text-transparent');
    });

    [
      'step-start-date-placeholder-1001',
      'step-end-date-placeholder-1001',
      'step-child-start-date-placeholder-1001',
      'step-child-end-date-placeholder-1001',
    ].forEach((testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });
  });

  it('keeps dd/mm/yyyy placeholder stable while an empty project date input is focused', () => {
    const emptyDateStep = {
      ...baseStep,
      duration_days: 0,
      actual_start_date: null,
      actual_end_date: null,
    } as ProjectProcedureStep;

    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            step={emptyDateStep}
            newChildDays=""
            newChildStartDate=""
            newChildEndDate=""
          />
        </tbody>
      </table>
    );

    const startInput = screen.getByTestId('step-start-date-1001') as HTMLInputElement;
    expect(startInput).toHaveAttribute('placeholder', 'dd/mm/yyyy');
    expect(screen.queryByTestId('step-start-date-placeholder-1001')).not.toBeInTheDocument();

    fireEvent.focus(startInput);

    expect(startInput).toHaveAttribute('placeholder', 'dd/mm/yyyy');
    expect(screen.queryByTestId('step-start-date-placeholder-1001')).not.toBeInTheDocument();

    fireEvent.blur(startInput);

    expect(startInput).toHaveAttribute('placeholder', 'dd/mm/yyyy');
    expect(screen.queryByTestId('step-start-date-placeholder-1001')).not.toBeInTheDocument();
  });

  it('formats existing ISO date values as dd/mm/yyyy in project date inputs', () => {
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} isAddingChild />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('step-start-date-1001')).toHaveValue('10/04/2026');
    expect(screen.getByTestId('step-end-date-1001')).toHaveValue('12/04/2026');
    expect(screen.getByTestId('step-child-start-date-1001')).toHaveValue('11/04/2026');
    expect(screen.getByTestId('step-child-end-date-1001')).toHaveValue('12/04/2026');
    expect(screen.queryByTestId('step-start-date-placeholder-1001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-end-date-placeholder-1001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-child-start-date-placeholder-1001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-child-end-date-placeholder-1001')).not.toBeInTheDocument();
  });

  it('lets users edit end dates so the parent handler can infer start dates', () => {
    const onEndDateChange = vi.fn();
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} onEndDateChange={onEndDateChange} />
        </tbody>
      </table>
    );

    fireEvent.change(screen.getByTestId('step-end-date-1001'), { target: { value: '15/04/2026' } });

    expect(onEndDateChange).toHaveBeenCalledWith(baseStep, '2026-04-15');
  });

  it('validates parent date range only after leaving the date field', () => {
    const onEndDateChange = vi.fn();
    const onDateRangeBlur = vi.fn();
    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            onEndDateChange={onEndDateChange}
            onDateRangeBlur={onDateRangeBlur}
          />
        </tbody>
      </table>
    );

    const endInput = screen.getByTestId('step-end-date-1001');
    fireEvent.change(endInput, { target: { value: '09/04/2026' } });

    expect(onEndDateChange).toHaveBeenCalledWith(baseStep, '2026-04-09');
    expect(onDateRangeBlur).not.toHaveBeenCalled();

    fireEvent.blur(endInput);

    expect(onDateRangeBlur).toHaveBeenCalledWith(baseStep, 'end');
  });

  it('keeps the child end date and recalculates child days when changing child start date', () => {
    const onSetChildDays = vi.fn();
    const onSetChildEndDate = vi.fn();
    const wideDateRangeStep = {
      ...baseStep,
      duration_days: 40,
      actual_end_date: '2026-05-19',
    } as ProjectProcedureStep;
    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            step={wideDateRangeStep}
            isAddingChild
            newChildDays="1"
            newChildStartDate="2026-04-30"
            newChildEndDate=""
            onSetChildDays={onSetChildDays}
            onSetChildEndDate={onSetChildEndDate}
          />
        </tbody>
      </table>
    );

    fireEvent.change(screen.getByTestId('step-child-start-date-1001'), { target: { value: '24/04/2026' } });

    expect(onSetChildDays).toHaveBeenCalledWith('7');
    expect(onSetChildEndDate).not.toHaveBeenCalledWith('2026-04-24');
  });

  it('keeps the child start date and recalculates child days when changing child end date', () => {
    const onSetChildDays = vi.fn();
    const onSetChildStartDate = vi.fn();
    const wideDateRangeStep = {
      ...baseStep,
      duration_days: 40,
      actual_end_date: '2026-05-19',
    } as ProjectProcedureStep;
    render(
      <table>
        <tbody>
          <StepRow
            {...baseProps}
            step={wideDateRangeStep}
            isAddingChild
            newChildDays="1"
            newChildStartDate="2026-04-24"
            newChildEndDate=""
            onSetChildDays={onSetChildDays}
            onSetChildStartDate={onSetChildStartDate}
          />
        </tbody>
      </table>
    );

    fireEvent.change(screen.getByTestId('step-child-end-date-1001'), { target: { value: '30/04/2026' } });

    expect(onSetChildDays).toHaveBeenCalledWith('7');
    expect(onSetChildStartDate).not.toHaveBeenCalledWith('2026-04-30');
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

    expect(screen.getByTestId('step-worklog-trigger-1001')).toHaveTextContent('Worklog (1)');
  });

  it('exposes accessible worklog and file triggers with expanded state', () => {
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} wlogs={[
            {
              id: 3,
              step_id: 1001,
              procedure_id: 501,
              log_type: 'NOTE',
              content: 'Đã gọi khách hàng',
              created_at: '2026-04-10T10:00:00Z',
            },
          ]} />
        </tbody>
      </table>
    );

    const worklogTrigger = screen.getByRole('button', {
      name: 'Mở worklog của bước 1 Lập đề cương: 0 mục',
    });
    const fileTrigger = screen.getByRole('button', {
      name: 'Mở file văn bản của bước 1 Lập đề cương: 0 file đính kèm, chưa có số văn bản',
    });
    const actionCell = screen.getByTestId('step-row-1001').querySelector('td:last-child');

    expect(worklogTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(worklogTrigger).toHaveAttribute('aria-controls', 'step-worklog-panel-1001');
    expect(worklogTrigger.className).toContain('focus-visible:outline');
    expect(fileTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(fileTrigger).toHaveAttribute('aria-controls', 'step-file-panel-1001');
    expect(fileTrigger).toHaveAttribute('aria-busy', 'false');
    expect(fileTrigger.className).toContain('focus-visible:outline');
    expect(actionCell).toHaveClass(
      'sticky',
      'right-0',
      'z-10',
      'border-l',
      'border-slate-300',
      'bg-slate-50/95',
      'shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]'
    );
    const addChildButton = screen.getByRole('button', {
      name: 'Thêm bước con cho bước 1 Lập đề cương',
    });
    const deleteButton = screen.getByRole('button', {
      name: 'Xóa bước 1 Lập đề cương',
    });

    expect(addChildButton).toHaveClass('h-8', 'w-6', 'focus-visible:outline');
    expect(addChildButton).toHaveAttribute('aria-pressed', 'false');
    expect(addChildButton.querySelector('.material-symbols-outlined')).toHaveAttribute('aria-hidden', 'true');
    expect(deleteButton).toHaveClass('h-8', 'w-6', 'focus-visible:outline');
    expect(deleteButton.querySelector('.material-symbols-outlined')).toHaveAttribute('aria-hidden', 'true');
    expect(deleteButton).toBeEnabled();
  });

  it('keeps the sticky action rail when delete is disabled for parent rows with children', () => {
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} hasChildren />
        </tbody>
      </table>
    );

    const actionCell = screen.getByTestId('step-row-1001').querySelector('td:last-child');
    const deleteButton = screen.getByRole('button', {
      name: 'Dòng này đang có bước con nên chưa thể xóa: bước 1 Lập đề cương',
    });

    expect(actionCell).toHaveClass('sticky', 'right-0', 'bg-slate-50/95', 'border-slate-300');
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveClass('disabled:text-slate-500', 'disabled:opacity-100');
  });

  it('labels edit action rail buttons without exposing icon glyph names', () => {
    render(
      <table>
        <tbody>
          <StepRow {...baseProps} isEditing />
        </tbody>
      </table>
    );

    const saveButton = screen.getByRole('button', {
      name: 'Lưu thay đổi bước 1 Lập đề cương',
    });
    const cancelButton = screen.getByRole('button', {
      name: 'Hủy sửa bước 1 Lập đề cương',
    });

    expect(saveButton).toHaveClass('h-8', 'w-6', 'focus-visible:outline');
    expect(cancelButton).toHaveClass('h-8', 'w-6', 'focus-visible:outline');
    expect(saveButton.querySelector('.material-symbols-outlined')).toHaveAttribute('aria-hidden', 'true');
    expect(cancelButton.querySelector('.material-symbols-outlined')).toHaveAttribute('aria-hidden', 'true');
  });
});
