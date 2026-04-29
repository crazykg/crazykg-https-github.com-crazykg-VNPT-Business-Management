import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProcedureStepWorklogPanel } from '../components/procedure/ProcedureStepWorklogPanel';
import type { ProcedureStepWorklog } from '../types';

const baseWorklog: ProcedureStepWorklog = {
  id: 8101,
  procedure_id: 501,
  step_id: 7001,
  log_type: 'NOTE',
  content: 'Đã trao đổi với đơn vị',
  created_by: 22,
  created_at: '2026-03-30T08:00:00Z',
  creator: {
    id: 22,
    full_name: 'Nguyễn Văn A',
    user_code: 'NV22',
  },
  timesheet: {
    hours_spent: 1.5,
  },
  issue: {
    id: 9901,
    issue_content: 'Thiếu hồ sơ gốc',
    issue_status: 'IN_PROGRESS',
    proposal_content: 'Bổ sung biên bản bàn giao',
  },
} as ProcedureStepWorklog;

describe('ProcedureStepWorklogPanel', () => {
  it('bridges create form inputs, add action, edit trigger, and issue status update', async () => {
    const user = userEvent.setup();
    const onAddWorklog = vi.fn();
    const onUpdateIssueStatus = vi.fn();
    const onStartEditWorklog = vi.fn();
    const onDeleteWorklog = vi.fn();
    const onSetWlogInput = vi.fn();
    const onSetWlogHours = vi.fn();
    const onSetWlogDifficulty = vi.fn();
    const onSetWlogProposal = vi.fn();
    const onSetWlogIssueStatus = vi.fn();

    render(
      <table>
        <tbody>
          <ProcedureStepWorklogPanel
            stepId={7001}
            wlogs={[baseWorklog]}
            wlogInput="Chuẩn bị hồ sơ"
            wlogHours="2"
            wlogDifficulty="Thiếu biên bản"
            wlogProposal="Xin bổ sung"
            wlogIssueStatus="JUST_ENCOUNTERED"
            wlogSaving={false}
            editingWorklogId={null}
            editWorklogContent=""
            editWorklogHours=""
            editWorklogDiff=""
            editWorklogProposal=""
            editWorklogStatus="JUST_ENCOUNTERED"
            editWorklogSaving={false}
            deletingWorklogId={null}
            isAdmin={false}
            isRaciA={false}
            myId="22"
            onAddWorklog={onAddWorklog}
            onUpdateIssueStatus={onUpdateIssueStatus}
            onStartEditWorklog={onStartEditWorklog}
            onCancelEditWorklog={vi.fn()}
            onSaveEditWorklog={vi.fn()}
            onDeleteWorklog={onDeleteWorklog}
            onSetWlogInput={onSetWlogInput}
            onSetWlogHours={onSetWlogHours}
            onSetWlogDifficulty={onSetWlogDifficulty}
            onSetWlogProposal={onSetWlogProposal}
            onSetWlogIssueStatus={onSetWlogIssueStatus}
            onSetEditWorklogContent={vi.fn()}
            onSetEditWorklogHours={vi.fn()}
            onSetEditWorklogDiff={vi.fn()}
            onSetEditWorklogProposal={vi.fn()}
            onSetEditWorklogStatus={vi.fn()}
          />
        </tbody>
      </table>
    );

    const worklogPanel = screen.getByTestId('step-worklog-panel-7001');
    expect(worklogPanel).toBeInTheDocument();
    expect(worklogPanel).toHaveAttribute('colspan', '12');
    expect(screen.getByRole('list', { name: 'Nhật ký worklog của bước 7001' })).toBeInTheDocument();
    expect(screen.getByText('Ghi chú')).toBeInTheDocument();
    expect(screen.getByLabelText('Nội dung worklog')).toHaveClass('focus-visible:outline');
    expect(screen.getByLabelText(/Trạng thái khó khăn Thiếu hồ sơ gốc/)).toHaveClass('focus-visible:outline');

    fireEvent.change(screen.getByTestId('step-worklog-input-7001'), { target: { value: 'Chuẩn bị bổ sung' } });
    expect(onSetWlogInput).toHaveBeenLastCalledWith('Chuẩn bị bổ sung');

    fireEvent.change(screen.getByTestId('step-worklog-hours-7001'), { target: { value: '3.5' } });
    expect(onSetWlogHours).toHaveBeenLastCalledWith('3.5');

    fireEvent.change(screen.getByTestId('step-worklog-difficulty-7001'), { target: { value: 'Vẫn còn thiếu' } });
    expect(onSetWlogDifficulty).toHaveBeenLastCalledWith('Vẫn còn thiếu');

    fireEvent.change(screen.getByTestId('step-worklog-proposal-7001'), { target: { value: 'Nhắc lại đơn vị' } });
    expect(onSetWlogProposal).toHaveBeenLastCalledWith('Nhắc lại đơn vị');

    fireEvent.change(screen.getByTestId('step-worklog-status-7001'), { target: { value: 'RESOLVED' } });
    expect(onSetWlogIssueStatus).toHaveBeenLastCalledWith('RESOLVED');

    await user.click(screen.getByTestId('step-worklog-add-7001'));
    expect(onAddWorklog).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle('Chỉnh sửa'));
    expect(onStartEditWorklog).toHaveBeenCalledWith(baseWorklog);

    await user.click(screen.getByTitle('Xóa'));
    expect(onDeleteWorklog).toHaveBeenCalledWith(baseWorklog);

    fireEvent.change(screen.getByTestId('step-worklog-issue-status-8101'), { target: { value: 'RESOLVED' } });
    expect(onUpdateIssueStatus).toHaveBeenCalledWith(9901, 'RESOLVED');
  });

  it('bridges edit-mode fields, cancel, and save callbacks', async () => {
    const user = userEvent.setup();
    const onCancelEditWorklog = vi.fn();
    const onSaveEditWorklog = vi.fn();
    const onSetEditWorklogContent = vi.fn();
    const onSetEditWorklogHours = vi.fn();
    const onSetEditWorklogDiff = vi.fn();
    const onSetEditWorklogProposal = vi.fn();
    const onSetEditWorklogStatus = vi.fn();

    render(
      <table>
        <tbody>
          <ProcedureStepWorklogPanel
            stepId={7001}
            wlogs={[baseWorklog]}
            wlogInput=""
            wlogHours=""
            wlogDifficulty=""
            wlogProposal=""
            wlogIssueStatus="JUST_ENCOUNTERED"
            wlogSaving={false}
            editingWorklogId={8101}
            editWorklogContent="Đã trao đổi với đơn vị"
            editWorklogHours="1.5"
            editWorklogDiff="Thiếu hồ sơ gốc"
            editWorklogProposal="Bổ sung biên bản bàn giao"
            editWorklogStatus="IN_PROGRESS"
            editWorklogSaving={false}
            deletingWorklogId={null}
            isAdmin={false}
            isRaciA={false}
            myId="22"
            onAddWorklog={vi.fn()}
            onUpdateIssueStatus={vi.fn()}
            onStartEditWorklog={vi.fn()}
            onCancelEditWorklog={onCancelEditWorklog}
            onSaveEditWorklog={onSaveEditWorklog}
            onDeleteWorklog={vi.fn()}
            onSetWlogInput={vi.fn()}
            onSetWlogHours={vi.fn()}
            onSetWlogDifficulty={vi.fn()}
            onSetWlogProposal={vi.fn()}
            onSetWlogIssueStatus={vi.fn()}
            onSetEditWorklogContent={onSetEditWorklogContent}
            onSetEditWorklogHours={onSetEditWorklogHours}
            onSetEditWorklogDiff={onSetEditWorklogDiff}
            onSetEditWorklogProposal={onSetEditWorklogProposal}
            onSetEditWorklogStatus={onSetEditWorklogStatus}
          />
        </tbody>
      </table>
    );

    fireEvent.change(screen.getByDisplayValue('Đã trao đổi với đơn vị'), { target: { value: 'Cập nhật lại nội dung' } });
    expect(onSetEditWorklogContent).toHaveBeenLastCalledWith('Cập nhật lại nội dung');

    fireEvent.change(screen.getByDisplayValue('1.5'), { target: { value: '2' } });
    expect(onSetEditWorklogHours).toHaveBeenLastCalledWith('2');

    fireEvent.change(screen.getByDisplayValue('Thiếu hồ sơ gốc'), { target: { value: 'Thiếu thêm phụ lục' } });
    expect(onSetEditWorklogDiff).toHaveBeenLastCalledWith('Thiếu thêm phụ lục');

    fireEvent.change(screen.getByDisplayValue('Bổ sung biên bản bàn giao'), { target: { value: 'Đề nghị gửi lại' } });
    expect(onSetEditWorklogProposal).toHaveBeenLastCalledWith('Đề nghị gửi lại');

    fireEvent.change(screen.getByLabelText('Trạng thái khó khăn khi sửa'), { target: { value: 'RESOLVED' } });
    expect(onSetEditWorklogStatus).toHaveBeenLastCalledWith('RESOLVED');

    await user.click(screen.getByRole('button', { name: /Hủy|Huỷ/ }));
    expect(onCancelEditWorklog).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onSaveEditWorklog).toHaveBeenCalledWith(8101);
  });
});
