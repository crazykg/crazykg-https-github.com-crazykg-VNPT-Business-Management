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

const inProcedureTable = (panel: React.ReactElement) => (
  <table>
    <tbody>{panel}</tbody>
  </table>
);

const renderInProcedureTable = (panel: React.ReactElement) => render(inProcedureTable(panel));

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

    renderInProcedureTable(
      <ProcedureStepWorklogPanel
            stepId={7001}
            projectWorklogDatetimeEnabled={false}
            wlogs={[baseWorklog]}
            wlogInput="Chuẩn bị hồ sơ"
            wlogHours="2"
            wlogStartedAt=""
            wlogEndedAt=""
            wlogDifficulty="Thiếu biên bản"
            wlogProposal="Xin bổ sung"
            wlogIssueStatus="JUST_ENCOUNTERED"
            wlogSaving={false}
            editingWorklogId={null}
            editWorklogContent=""
            editWorklogHours=""
            editWorklogStartedAt=""
            editWorklogEndedAt=""
            editWorklogDiff=""
            editWorklogProposal=""
            editWorklogStatus="JUST_ENCOUNTERED"
            editWorklogSaving={false}
            deletingWorklogId={null}
            isAdmin={false}
            isRaciA={false}
            myId="22"
            onAddWorklog={onAddWorklog}
            onClosePanel={vi.fn()}
            onUpdateIssueStatus={onUpdateIssueStatus}
            onStartEditWorklog={onStartEditWorklog}
            onCancelEditWorklog={vi.fn()}
            onSaveEditWorklog={vi.fn()}
            onDeleteWorklog={onDeleteWorklog}
            onSetWlogInput={onSetWlogInput}
            onSetWlogHours={onSetWlogHours}
            onSetWlogStartedAt={vi.fn()}
            onSetWlogEndedAt={vi.fn()}
            onSetWlogDifficulty={onSetWlogDifficulty}
            onSetWlogProposal={onSetWlogProposal}
            onSetWlogIssueStatus={onSetWlogIssueStatus}
            onSetEditWorklogContent={vi.fn()}
            onSetEditWorklogHours={vi.fn()}
            onSetEditWorklogStartedAt={vi.fn()}
            onSetEditWorklogEndedAt={vi.fn()}
            onSetEditWorklogDiff={vi.fn()}
            onSetEditWorklogProposal={vi.fn()}
            onSetEditWorklogStatus={vi.fn()}
          />
    );

    const worklogPanel = screen.getByTestId('step-worklog-panel-7001');
    expect(worklogPanel).toBeInTheDocument();
    expect(worklogPanel).toHaveAttribute('role', 'region');
    expect(worklogPanel).not.toHaveAttribute('aria-modal');
    expect(worklogPanel).not.toHaveClass('fixed');
    expect(worklogPanel).toHaveClass('bg-white');
    expect(screen.getByRole('list', { name: 'Nhật ký worklog của bước 7001' })).toBeInTheDocument();
    expect(screen.getByText('Ghi chú')).toBeInTheDocument();
    expect(screen.queryByLabelText('Từ ngày')).not.toBeInTheDocument();
    expect(screen.queryByText(/mục worklog/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ngày giờ đang tắt')).not.toBeInTheDocument();
    expect(screen.queryByText('Đang bật ngày giờ')).not.toBeInTheDocument();
    expect(screen.getByTestId('step-worklog-panel-viewport-7001')).toHaveClass('sticky', 'left-0', 'max-w-full', 'w-[min(1500px,calc(100vw-2rem))]');
    expect(screen.getByTestId('step-worklog-panel-surface-7001')).toHaveClass('sm:ml-auto', 'sm:max-w-[1080px]');
    expect(screen.getByTestId('step-worklog-connector-7001')).toHaveClass('hidden', 'sm:block', 'pointer-events-none', 'right-0', '-top-6', 'h-[230px]');
    expect(screen.getByTestId('step-worklog-connector-7001').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('step-worklog-connector-7001').querySelector('path')).toHaveAttribute('d', 'M0 0 C0 18 16 22 34 24 C72 28 134 18 161 45 C187 71 179 126 165 158 C150 194 112 214 70 216');
    expect(screen.getByTestId('step-worklog-connector-7001').querySelector('path')).toHaveAttribute('stroke-dasharray', '0.785 1');
    expect(screen.getByTestId('step-worklog-connector-7001').querySelector('path')).toHaveAttribute('stroke-width', '2.25');
    expect(screen.getByTestId('step-worklog-connector-7001').querySelectorAll('span')).toHaveLength(2);
    expect(screen.getByTestId('step-worklog-action-row-7001')).toHaveClass('sm:grid-cols-[minmax(0,1fr)_96px_auto]');
    expect(screen.getByLabelText('Nội dung worklog')).toHaveClass('focus-visible:outline');
    expect(screen.getByLabelText('Số giờ')).toBeInTheDocument();
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

    renderInProcedureTable(
      <ProcedureStepWorklogPanel
            stepId={7001}
            projectWorklogDatetimeEnabled={false}
            wlogs={[baseWorklog]}
            wlogInput=""
            wlogHours=""
            wlogStartedAt=""
            wlogEndedAt=""
            wlogDifficulty=""
            wlogProposal=""
            wlogIssueStatus="JUST_ENCOUNTERED"
            wlogSaving={false}
            editingWorklogId={8101}
            editWorklogContent="Đã trao đổi với đơn vị"
            editWorklogHours="1.5"
            editWorklogStartedAt=""
            editWorklogEndedAt=""
            editWorklogDiff="Thiếu hồ sơ gốc"
            editWorklogProposal="Bổ sung biên bản bàn giao"
            editWorklogStatus="IN_PROGRESS"
            editWorklogSaving={false}
            deletingWorklogId={null}
            isAdmin={false}
            isRaciA={false}
            myId="22"
            onAddWorklog={vi.fn()}
            onClosePanel={vi.fn()}
            onUpdateIssueStatus={vi.fn()}
            onStartEditWorklog={vi.fn()}
            onCancelEditWorklog={onCancelEditWorklog}
            onSaveEditWorklog={onSaveEditWorklog}
            onDeleteWorklog={vi.fn()}
            onSetWlogInput={vi.fn()}
            onSetWlogHours={vi.fn()}
            onSetWlogStartedAt={vi.fn()}
            onSetWlogEndedAt={vi.fn()}
            onSetWlogDifficulty={vi.fn()}
            onSetWlogProposal={vi.fn()}
            onSetWlogIssueStatus={vi.fn()}
            onSetEditWorklogContent={onSetEditWorklogContent}
            onSetEditWorklogHours={onSetEditWorklogHours}
            onSetEditWorklogStartedAt={vi.fn()}
            onSetEditWorklogEndedAt={vi.fn()}
            onSetEditWorklogDiff={onSetEditWorklogDiff}
            onSetEditWorklogProposal={onSetEditWorklogProposal}
            onSetEditWorklogStatus={onSetEditWorklogStatus}
          />
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

  it('renders datetime fields when enabled, validates the range, and auto-fills hours', async () => {
    const onAddWorklog = vi.fn();
    const onSetWlogHours = vi.fn();

    const renderPanel = (startedAt: string, endedAt: string) => (
      <ProcedureStepWorklogPanel
            stepId={7001}
            projectWorklogDatetimeEnabled
            wlogs={[]}
            wlogInput="Ghi nhận ngày giờ"
            wlogHours=""
            wlogStartedAt={startedAt}
            wlogEndedAt={endedAt}
            wlogDifficulty=""
            wlogProposal=""
            wlogIssueStatus="JUST_ENCOUNTERED"
            wlogSaving={false}
            editingWorklogId={null}
            editWorklogContent=""
            editWorklogHours=""
            editWorklogStartedAt=""
            editWorklogEndedAt=""
            editWorklogDiff=""
            editWorklogProposal=""
            editWorklogStatus="JUST_ENCOUNTERED"
            editWorklogSaving={false}
            deletingWorklogId={null}
            isAdmin={false}
            isRaciA={false}
            myId="22"
            onAddWorklog={onAddWorklog}
            onClosePanel={vi.fn()}
            onUpdateIssueStatus={vi.fn()}
            onStartEditWorklog={vi.fn()}
            onCancelEditWorklog={vi.fn()}
            onSaveEditWorklog={vi.fn()}
            onDeleteWorklog={vi.fn()}
            onSetWlogInput={vi.fn()}
            onSetWlogHours={onSetWlogHours}
            onSetWlogStartedAt={vi.fn()}
            onSetWlogEndedAt={vi.fn()}
            onSetWlogDifficulty={vi.fn()}
            onSetWlogProposal={vi.fn()}
            onSetWlogIssueStatus={vi.fn()}
            onSetEditWorklogContent={vi.fn()}
            onSetEditWorklogHours={vi.fn()}
            onSetEditWorklogStartedAt={vi.fn()}
            onSetEditWorklogEndedAt={vi.fn()}
            onSetEditWorklogDiff={vi.fn()}
            onSetEditWorklogProposal={vi.fn()}
            onSetEditWorklogStatus={vi.fn()}
          />
    );

    const { rerender } = renderInProcedureTable(renderPanel('', ''));

    expect(screen.queryByText('Đang bật ngày giờ')).not.toBeInTheDocument();
    expect(screen.queryByText(/mục worklog/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Từ ngày')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByLabelText('Đến ngày')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByTestId('step-worklog-action-row-7001')).toHaveClass('sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_auto]');
    expect(screen.getByTestId('step-worklog-add-7001')).toBeDisabled();
    expect(screen.getByText('Nhập đủ Từ ngày và Đến ngày.')).toBeInTheDocument();

    rerender(inProcedureTable(renderPanel('2026-04-29T11:00', '2026-04-29T10:00')));

    expect(screen.getByTestId('step-worklog-add-7001')).toBeDisabled();
    expect(screen.getByText('Từ ngày không được lớn hơn Đến ngày.')).toBeInTheDocument();

    rerender(inProcedureTable(renderPanel('2026-04-29T08:00', '')));
    fireEvent.change(screen.getByTestId('step-worklog-ended-at-7001'), {
      target: { value: '2026-04-29T09:30' },
    });
    expect(onSetWlogHours).toHaveBeenLastCalledWith('1.50');

    rerender(inProcedureTable(renderPanel('2026-04-29T08:00', '2026-04-29T09:30')));
    expect(screen.getByTestId('step-worklog-add-7001')).not.toBeDisabled();
  });
});
