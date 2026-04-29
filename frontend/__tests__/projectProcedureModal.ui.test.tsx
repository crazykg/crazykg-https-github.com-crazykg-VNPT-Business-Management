import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProcedureModal } from '../components/ProjectProcedureModal';
import { PublicProjectProcedurePage } from '../components/PublicProjectProcedurePage';
import type {
  ProcedureTemplate,
  ProcedureRaciEntry,
  ProcedureStepRaciEntry,
  ProcedureStepWorklog,
  Project,
  ProjectProcedure,
  ProjectProcedureStep,
} from '../types';

const fetchEmployeesOptionsPageMock = vi.hoisted(() => vi.fn());
const uploadDocumentAttachmentMock = vi.hoisted(() => vi.fn());
const fetchProcedureTemplatesMock = vi.hoisted(() => vi.fn());
const fetchProjectProceduresMock = vi.hoisted(() => vi.fn());
const createProjectProcedureMock = vi.hoisted(() => vi.fn());
const fetchProcedureStepsMock = vi.hoisted(() => vi.fn());
const exportProjectProcedureMock = vi.hoisted(() => vi.fn());
const createProcedurePublicShareMock = vi.hoisted(() => vi.fn());
const revokeProcedurePublicShareMock = vi.hoisted(() => vi.fn());
const fetchPublicProcedureShareMock = vi.hoisted(() => vi.fn());
const batchUpdateProcedureStepsMock = vi.hoisted(() => vi.fn());
const addCustomProcedureStepMock = vi.hoisted(() => vi.fn());
const deleteProcedureStepMock = vi.hoisted(() => vi.fn());
const renameProcedureStepMock = vi.hoisted(() => vi.fn());
const updateProcedurePhaseLabelMock = vi.hoisted(() => vi.fn());
const fetchStepWorklogsMock = vi.hoisted(() => vi.fn());
const addStepWorklogMock = vi.hoisted(() => vi.fn());
const updateStepWorklogMock = vi.hoisted(() => vi.fn());
const deleteStepWorklogMock = vi.hoisted(() => vi.fn());
const reorderProcedureStepsMock = vi.hoisted(() => vi.fn());
const updateIssueStatusMock = vi.hoisted(() => vi.fn());
const fetchProcedureRaciMock = vi.hoisted(() => vi.fn());
const fetchStepRaciBulkMock = vi.hoisted(() => vi.fn());
const addProcedureRaciMock = vi.hoisted(() => vi.fn());
const removeProcedureRaciMock = vi.hoisted(() => vi.fn());
const addStepRaciMock = vi.hoisted(() => vi.fn());
const removeStepRaciMock = vi.hoisted(() => vi.fn());
const batchSetStepRaciMock = vi.hoisted(() => vi.fn());
const fetchProcedureWorklogsMock = vi.hoisted(() => vi.fn());
const resyncProcedureMock = vi.hoisted(() => vi.fn());
const getStepAttachmentsMock = vi.hoisted(() => vi.fn());
const linkStepAttachmentMock = vi.hoisted(() => vi.fn());
const deleteStepAttachmentMock = vi.hoisted(() => vi.fn());
const fetchSupportProjectWorklogDatetimePolicyMock = vi.hoisted(() => vi.fn());

vi.mock('../components/procedure/StepRow', () => ({
  StepRow: ({
    step,
    stepRaciEntries = [],
    projectWorklogDatetimeEnabled = false,
    onDraftChange,
  }: {
    step: ProjectProcedureStep;
    stepRaciEntries?: ProcedureStepRaciEntry[];
    projectWorklogDatetimeEnabled?: boolean;
    onDraftChange?: (id: string | number, field: string, value: string | null) => void;
  }) => (
    <tr data-testid={`mock-step-row-${step.id}`}>
      <td>
        {step.step_name}
        <span data-testid={`mock-step-raci-count-${step.id}`}>{stepRaciEntries.length}</span>
        <span data-testid={`mock-step-worklog-datetime-${step.id}`}>{String(projectWorklogDatetimeEnabled)}</span>
        <button
          type="button"
          data-testid={`mock-dirty-step-${step.id}`}
          onClick={() => onDraftChange?.(step.id, 'step_name', `${step.step_name} updated`)}
        >
          Dirty step
        </button>
      </td>
    </tr>
  ),
}));

vi.mock('../components/procedure/RaciMatrixPanel', () => ({
  RaciMatrixPanel: () => null,
}));

vi.mock('../components/AttachmentManager', () => ({
  AttachmentManager: () => null,
}));

vi.mock('../components/SearchableSelect', () => ({
  SearchableSelect: ({
    value,
    options,
    onChange,
    onSearchTermChange,
  }: {
    value: string;
    options: Array<{ value: string | number; label: string }>;
    onChange: (nextValue: string) => void;
    onSearchTermChange?: (nextValue: string) => void;
  }) => (
    <>
      <select
        aria-label="Thành viên"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Chọn thành viên...</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {onSearchTermChange ? (
        <button
          type="button"
          data-testid="mock-member-options-refresh"
          onClick={() => onSearchTermChange('missing-selected-member')}
        >
          Refresh member options
        </button>
      ) : null}
    </>
  ),
}));

vi.mock('../services/v5Api', () => ({
  fetchEmployeesOptionsPage: fetchEmployeesOptionsPageMock,
  uploadDocumentAttachment: uploadDocumentAttachmentMock,
}));

vi.mock('../services/api/projectApi', () => ({
  fetchProcedureTemplates: fetchProcedureTemplatesMock,
  fetchProjectProcedures: fetchProjectProceduresMock,
  createProjectProcedure: createProjectProcedureMock,
  fetchProcedureSteps: fetchProcedureStepsMock,
  exportProjectProcedure: exportProjectProcedureMock,
  createProcedurePublicShare: createProcedurePublicShareMock,
  revokeProcedurePublicShare: revokeProcedurePublicShareMock,
  fetchPublicProcedureShare: fetchPublicProcedureShareMock,
  batchUpdateProcedureSteps: batchUpdateProcedureStepsMock,
  addCustomProcedureStep: addCustomProcedureStepMock,
  deleteProcedureStep: deleteProcedureStepMock,
  renameProcedureStep: renameProcedureStepMock,
  updateProcedurePhaseLabel: updateProcedurePhaseLabelMock,
  fetchStepWorklogs: fetchStepWorklogsMock,
  addStepWorklog: addStepWorklogMock,
  updateStepWorklog: updateStepWorklogMock,
  deleteStepWorklog: deleteStepWorklogMock,
  reorderProcedureSteps: reorderProcedureStepsMock,
  updateIssueStatus: updateIssueStatusMock,
  fetchProcedureRaci: fetchProcedureRaciMock,
  fetchStepRaciBulk: fetchStepRaciBulkMock,
  addProcedureRaci: addProcedureRaciMock,
  removeProcedureRaci: removeProcedureRaciMock,
  addStepRaci: addStepRaciMock,
  removeStepRaci: removeStepRaciMock,
  batchSetStepRaci: batchSetStepRaciMock,
  fetchProcedureWorklogs: fetchProcedureWorklogsMock,
  resyncProcedure: resyncProcedureMock,
  getStepAttachments: getStepAttachmentsMock,
  linkStepAttachment: linkStepAttachmentMock,
  deleteStepAttachment: deleteStepAttachmentMock,
}));

vi.mock('../services/api/supportConfigApi', () => ({
  fetchSupportProjectWorklogDatetimePolicy: fetchSupportProjectWorklogDatetimePolicyMock,
}));

const project: Project = {
  id: 101,
  project_code: 'DA001',
  project_name: 'Du an thu tuc',
  customer_id: 1,
  status: 'CHUAN_BI',
  investment_mode: 'DAU_TU',
} as Project;

const procedureTemplate: ProcedureTemplate = {
  id: 11,
  template_code: 'DAU_TU',
  template_name: 'Mau dau tu',
  is_active: true,
  phases: ['CHUAN_BI'],
} as ProcedureTemplate;

const projectProcedure: ProjectProcedure = {
  id: 501,
  project_id: 101,
  template_id: 11,
  overall_progress: 0,
} as ProjectProcedure;

const steps: ProjectProcedureStep[] = [
  {
    id: 7001,
    procedure_id: 501,
    step_number: 1,
    step_name: 'Khao sat',
    phase: 'CHUAN_BI',
    phase_label: 'Chuan bi',
    sort_order: 1,
    parent_step_id: null,
    lead_unit: 'PM',
    expected_result: 'Bien ban',
    duration_days: 3,
    progress_status: 'CHUA_THUC_HIEN',
    actual_start_date: null,
    actual_end_date: null,
    worklogs_count: 0,
    blocking_worklogs_count: 0,
  } as ProjectProcedureStep,
];

const raciEntries: ProcedureRaciEntry[] = [
  {
    id: 9001,
    procedure_id: 501,
    user_id: 22,
    full_name: 'Nguyen Van A',
    user_code: 'NV22',
    username: 'nva',
    raci_role: 'A',
    note: null,
  } as ProcedureRaciEntry,
];

const stepRaciEntries: ProcedureStepRaciEntry[] = [
  {
    id: 9101,
    step_id: 7001,
    user_id: 22,
    full_name: 'Nguyen Van A',
    user_code: 'NV22',
    username: 'nva',
    raci_role: 'R',
    department_id: 10,
    department_name: 'Phong Ky thuat',
    department_code: 'PKT',
  } as ProcedureStepRaciEntry,
];

const worklogs: ProcedureStepWorklog[] = [
  {
    id: 8001,
    procedure_id: 501,
    step_id: 7001,
    log_type: 'CUSTOM',
    content: 'Da tiep nhan ho so',
    created_at: '2026-03-30T08:00:00Z',
    creator: {
      id: 22,
      full_name: 'Nguyen Van A',
      user_code: 'NV22',
    },
    step: {
      id: 7001,
      step_number: 1,
      step_name: 'Khao sat',
    },
    timesheet: {
      hours_spent: 2,
    },
    issue: {
      id: 8101,
      procedure_step_worklog_id: 8001,
      issue_content: 'Thieu ho so',
      issue_status: 'IN_PROGRESS',
      proposal_content: 'Bo sung bien ban',
    },
  } as ProcedureStepWorklog,
];

describe('ProjectProcedureModal UI', () => {
  beforeEach(() => {
    fetchSupportProjectWorklogDatetimePolicyMock.mockReset();
    fetchSupportProjectWorklogDatetimePolicyMock.mockResolvedValue({
      provider: 'PROJECT_WORKLOG_DATETIME_POLICY',
      project_worklog_datetime_enabled: false,
      source: 'DEFAULT',
    });
  });

  it('uses the same fixed column contract for every phase table', async () => {
    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue([
      {
        ...steps[0],
        id: 7001,
        phase: 'HA_TANG_DUNG_THU',
        phase_label: 'Cài đặt hạ tầng dùng thử',
        sort_order: 1,
        step_name: 'Thông mạng Database',
        duration_days: 1,
        actual_start_date: '2026-10-10',
        actual_end_date: '2026-10-10',
        progress_status: 'HOAN_THANH',
      } as ProjectProcedureStep,
      {
        ...steps[0],
        id: 7002,
        phase: 'CAU_HINH_HE_THONG',
        phase_label: 'Cấu hình hệ thống',
        sort_order: 2,
        step_number: 2,
        step_name: 'Phê duyệt đề án',
        expected_result: 'Phê duyệt chủ trương',
        duration_days: 0,
        actual_start_date: null,
        actual_end_date: null,
        progress_status: 'CHUA_THUC_HIEN',
      } as ProjectProcedureStep,
    ]);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue(stepRaciEntries);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue([]);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});
    fetchSupportProjectWorklogDatetimePolicyMock.mockResolvedValueOnce({
      provider: 'PROJECT_WORKLOG_DATETIME_POLICY',
      project_worklog_datetime_enabled: true,
      source: 'DB',
    });

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    const phaseBodies = await screen.findAllByTestId(/procedure-phase-body-/);
    expect(phaseBodies).toHaveLength(2);
    await waitFor(() => {
      expect(fetchSupportProjectWorklogDatetimePolicyMock).toHaveBeenCalledTimes(1);
    });

    const expectedWidths = [
      '40px',
      '52px',
      '320px',
      '196px',
      '164px',
      '200px',
      '88px',
      '140px',
      '140px',
      '136px',
      '132px',
      '116px',
      '52px',
    ];
    const widthsByTable = phaseBodies.map((body) => {
      const table = within(body).getByRole('table');
      expect(table).toHaveClass('table-fixed', 'min-w-[1776px]');
      expect(within(table).getByRole('columnheader', { name: 'Người thực hiện' })).toHaveTextContent('Người thực hiện');
      const actionHeader = table.querySelector('thead th[aria-label="Thao tác"]');
      expect(actionHeader).toHaveClass(
        'sticky',
        'right-0',
        'z-20',
        'border-l',
        'border-slate-300',
        'bg-slate-100',
        'shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]'
      );
      expect(actionHeader).toHaveTextContent('Thao tác');
      return Array.from(table.querySelectorAll('col')).map((col) => (col as HTMLTableColElement).style.width);
    });

    expect(widthsByTable).toEqual([expectedWidths, expectedWidths]);
  });

  it('renders extracted worklog, raci, and checklist tabs with loaded data', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({ id: 8101, issue_status: 'RESOLVED' });
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    expect(await screen.findByTestId('project-procedure-modal')).toBeInTheDocument();
    expect(await screen.findByTestId('procedure-tab-worklog')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Điều hướng thủ tục dự án' })).toBeInTheDocument();

    await user.click(screen.getByTestId('procedure-tab-worklog'));

    await waitFor(() => {
      expect(fetchProcedureWorklogsMock).toHaveBeenCalledWith(501);
    });
    expect(await screen.findByText('Da tiep nhan ho so')).toBeInTheDocument();

    await user.click(screen.getByTitle('Làm mới'));
    await waitFor(() => {
      expect(fetchProcedureWorklogsMock).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByTestId('procedure-tab-raci'));

    expect(await screen.findByText('Thêm phân công RACI')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('NV22')).toBeInTheDocument();
    const raciTab = screen.getByRole('tab', { name: /RACI/i });
    expect(raciTab).toHaveAttribute('aria-selected', 'true');
    expect(raciTab).toHaveTextContent('(1A)');

    await user.keyboard('{ArrowRight}');
    const checklistAdminTab = screen.getByRole('tab', { name: /Quản trị checklist/i });

    await waitFor(() => {
      expect(checklistAdminTab).toHaveAttribute('aria-selected', 'true');
    });

    expect(await screen.findByText('Khó khăn & Đề xuất')).toBeInTheDocument();
    expect(screen.getByText('Thieu ho so')).toBeInTheDocument();

    const phaseProgressList = screen.getByRole('list', { name: 'Tiến độ theo giai đoạn' });
    expect(within(phaseProgressList).getByText('01')).toBeInTheDocument();
    expect(within(phaseProgressList).getByText('Chuan bi')).toBeInTheDocument();
    expect(within(phaseProgressList).getByText('1 vấn đề mở')).toBeInTheDocument();
    const phaseProgressbar = within(phaseProgressList).getByRole('progressbar', {
      name: /Giai đoạn 01 Chuan bi: 0 trên 1 bước hoàn thành/i,
    });
    expect(phaseProgressbar).toHaveAttribute('aria-valuenow', '0');

    const allIssueFilter = screen.getByRole('button', {
      name: /Lọc danh sách vấn đề Tất cả, 1 mục/i,
    });
    const inProgressIssueFilter = screen.getByRole('button', {
      name: /Lọc danh sách vấn đề Đang xử lý, 1 mục/i,
    });
    expect(allIssueFilter).toHaveAttribute('aria-pressed', 'true');
    expect(inProgressIssueFilter).toHaveAttribute('aria-pressed', 'false');

    await user.click(inProgressIssueFilter);

    expect(inProgressIssueFilter).toHaveAttribute('aria-pressed', 'true');

    const resolveIssueButton = await screen.findByTestId('checklist-issue-status-8001-RESOLVED');
    expect(resolveIssueButton).not.toBeDisabled();

    await user.click(resolveIssueButton);

    await waitFor(() => {
      expect(updateIssueStatusMock).toHaveBeenCalledWith(8101, 'RESOLVED');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('checklist-issue-status-8001-RESOLVED')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Không có vấn đề ở trạng thái này.')).toBeInTheDocument();
  });

  it('submits the inline add-step form through the extracted steps state hook', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-step-row-7001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Thêm bước/i }));

    await user.type(screen.getByPlaceholderText('Tên bước mới...'), 'Thẩm định hồ sơ');
    await user.type(screen.getByPlaceholderText('ĐV chủ trì...'), 'Phòng dự án');
    await user.type(screen.getByPlaceholderText('Kết quả dự kiến...'), 'Biên bản thẩm định');
    await user.type(screen.getByPlaceholderText('0'), '5');

    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    await waitFor(() => {
      expect(addCustomProcedureStepMock).toHaveBeenCalledWith(501, {
        step_name: 'Thẩm định hồ sơ',
        phase: 'CHUAN_BI',
        lead_unit: 'Phòng dự án',
        expected_result: 'Biên bản thẩm định',
        duration_days: 5,
      });
    });
  });

  it('shows confirm and restores the previous role when canceling accountable replacement', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock.mockResolvedValue({
      data: [
        {
          id: 22,
          user_code: 'NV22',
          username: 'nva',
          full_name: 'Nguyen Van A',
        },
        {
          id: 23,
          user_code: 'NV23',
          username: 'ttb',
          full_name: 'Tran Thi B',
        },
      ],
    });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({
      id: 9002,
      procedure_id: 501,
      user_id: 23,
      full_name: 'Tran Thi B',
      user_code: 'NV23',
      username: 'ttb',
      raci_role: 'A',
      note: null,
    } as ProcedureRaciEntry);
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await user.click(await screen.findByTestId('procedure-tab-raci'));

    await waitFor(() => {
      expect(fetchEmployeesOptionsPageMock).toHaveBeenCalledWith('', 1, 40);
    });
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByTestId('procedure-tab-raci')).toHaveTextContent('(1A)');

    const [, roleSelect] = screen.getAllByRole('combobox');
    await user.selectOptions(roleSelect, 'A');

    expect(await screen.findByText('Đã tồn tại người chịu trách nhiệm (A)')).toBeInTheDocument();
    expect(screen.getByText('Hiện tại Nguyen Van A - NV22 đang giữ vai trò A.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tạm ngưng' }));

    await waitFor(() => {
      expect(screen.queryByText('Đã tồn tại người chịu trách nhiệm (A)')).not.toBeInTheDocument();
    });
    expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('R');
    expect(addProcedureRaciMock).not.toHaveBeenCalled();
  });

  it('asks for confirmation on role selection and only saves after the user clicks add', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock.mockResolvedValue({
      data: [
        {
          id: 22,
          user_code: 'NV22',
          username: 'nva',
          full_name: 'Nguyen Van A',
        },
        {
          id: 23,
          user_code: 'NV23',
          username: 'ttb',
          full_name: 'Tran Thi B',
        },
      ],
    });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({
      id: 9002,
      procedure_id: 501,
      user_id: 23,
      full_name: 'Tran Thi B',
      user_code: 'NV23',
      username: 'ttb',
      raci_role: 'A',
      note: null,
    } as ProcedureRaciEntry);
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await user.click(await screen.findByTestId('procedure-tab-raci'));

    const [memberSelect, roleSelect] = screen.getAllByRole('combobox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Tran Thi B/i })).toBeInTheDocument();
    });
    await user.selectOptions(memberSelect, '23');
    await user.selectOptions(roleSelect, 'A');

    expect(await screen.findByText('Đã tồn tại người chịu trách nhiệm (A)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(() => {
      expect(screen.queryByText('Đã tồn tại người chịu trách nhiệm (A)')).not.toBeInTheDocument();
    });
    expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('A');
    expect(addProcedureRaciMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    await waitFor(() => {
      expect(addProcedureRaciMock).toHaveBeenCalledWith(501, {
        user_id: '23',
        raci_role: 'A',
        note: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Tran Thi B')).toBeInTheDocument();
    });

    expect(screen.queryByText('Nguyen Van A')).not.toBeInTheDocument();
    expect(screen.getByTestId('procedure-tab-raci')).toHaveTextContent('(1A)');
    expect(screen.getByTestId('procedure-tab-raci')).not.toHaveTextContent('2A');
  });

  it('keeps the selected member label when refreshed options no longer include that member', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 23,
            user_code: 'NV23',
            username: 'ttb',
            full_name: 'Tran Thi B',
          },
        ],
      })
      .mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({
      id: 9003,
      procedure_id: 501,
      user_id: 23,
      full_name: 'Tran Thi B',
      user_code: 'NV23',
      username: 'ttb',
      raci_role: 'R',
      note: null,
    } as ProcedureRaciEntry);
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await user.click(await screen.findByTestId('procedure-tab-raci'));

    const [memberSelect] = screen.getAllByRole('combobox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Tran Thi B/i })).toBeInTheDocument();
    });

    await user.selectOptions(memberSelect, '23');
    await user.click(screen.getByTestId('mock-member-options-refresh'));

    await waitFor(() => {
      expect(fetchEmployeesOptionsPageMock).toHaveBeenCalledWith('missing-selected-member', 1, 40);
    });
    expect(screen.getByRole('option', { name: /Tran Thi B/i })).toBeInTheDocument();
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('23');

    addProcedureRaciMock.mockClear();
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    await waitFor(() => {
      expect(addProcedureRaciMock).toHaveBeenCalledWith(501, {
        user_id: '23',
        raci_role: 'R',
        note: undefined,
      });
    });
  });

  it('shows no confirm for the current accountable user and uses the add guard if conflict appears later', async () => {
    const user = userEvent.setup();

    fetchEmployeesOptionsPageMock.mockResolvedValue({
      data: [
        {
          id: 22,
          user_code: 'NV22',
          username: 'nva',
          full_name: 'Nguyen Van A',
        },
        {
          id: 23,
          user_code: 'NV23',
          username: 'ttb',
          full_name: 'Tran Thi B',
        },
      ],
    });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({
      id: 9002,
      procedure_id: 501,
      user_id: 23,
      full_name: 'Tran Thi B',
      user_code: 'NV23',
      username: 'ttb',
      raci_role: 'A',
      note: null,
    } as ProcedureRaciEntry);
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    await user.click(await screen.findByTestId('procedure-tab-raci'));

    const [memberSelect, roleSelect] = screen.getAllByRole('combobox');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Nguyen Van A/i })).toBeInTheDocument();
    });
    await user.selectOptions(memberSelect, '22');
    await user.selectOptions(roleSelect, 'A');

    expect(screen.queryByText('Đã tồn tại người chịu trách nhiệm (A)')).not.toBeInTheDocument();

    await user.selectOptions(memberSelect, '23');
    addProcedureRaciMock.mockClear();
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(await screen.findByText('Đã tồn tại người chịu trách nhiệm (A)')).toBeInTheDocument();
    expect(addProcedureRaciMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(() => {
      expect(screen.queryByText('Đã tồn tại người chịu trách nhiệm (A)')).not.toBeInTheDocument();
    });
    expect(addProcedureRaciMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    await waitFor(() => {
      expect(addProcedureRaciMock).toHaveBeenCalledWith(501, {
        user_id: '23',
        raci_role: 'A',
        note: undefined,
      });
    });
  });

  it('exposes export dropdown and creates a keyed public link for authorized users', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:procedure-export'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: vi.fn((values: Uint32Array) => {
          values.forEach((_, index) => {
            values[index] = index;
          });

          return values;
        }),
      },
    });

    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});
    exportProjectProcedureMock.mockResolvedValue({
      blob: new Blob(['procedure'], { type: 'application/octet-stream' }),
      filename: 'thu_tuc.docx',
    });
    createProcedurePublicShareMock.mockResolvedValue({
      token: 'public-token-abcdefghijklmnopqrstuvwxyz0123456789',
      public_url: 'http://127.0.0.1:5175/public/project-procedure/public-token-abcdefghijklmnopqrstuvwxyz0123456789',
      expires_at: '2026-05-29T00:00:00+07:00',
      ttl_days: 30,
      email: {
        status: 'SUCCESS',
        recipients: ['pvro86@gmail.com', 'vnpthishg@gmail.com'],
        message: 'Đã gửi email public thủ tục.',
      },
    });

    try {
      render(
        <ProjectProcedureModal
          project={project}
          isOpen={true}
          onClose={vi.fn()}
          onNotify={onNotify}
          authUser={{
            id: 1,
            username: 'admin',
            full_name: 'Admin',
            email: 'admin@example.test',
            status: 'Active',
            roles: [],
            permissions: ['projects.read', 'projects.write'],
            dept_scopes: [],
          } as any}
        />
      );

      await screen.findByTestId('project-procedure-modal');
      await user.click(screen.getByTestId('procedure-export-menu-trigger'));
      await user.click(screen.getByTestId('procedure-export-word'));

      await waitFor(() => {
        expect(exportProjectProcedureMock).toHaveBeenCalledWith(501, 'word');
      });

      await user.click(screen.getByTestId('procedure-public-share'));
      expect(await screen.findByRole('dialog', { name: /Chia sẻ thủ tục/i })).toBeInTheDocument();
      expect(screen.queryByText('Chọn thời hạn và nhập key. Người xem phải có link và key mới mở được nội dung.')).not.toBeInTheDocument();
      expect(screen.queryByText('Chia sẻ ngắn hạn')).not.toBeInTheDocument();
      expect(screen.queryByText('Theo chu kỳ tháng')).not.toBeInTheDocument();
      expect(screen.queryByText('Theo quý')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('procedure-public-share-submit'));
      expect(await screen.findByRole('alert')).toHaveTextContent(/Key truy cập/i);
      expect(createProcedurePublicShareMock).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('procedure-public-generate-key'));
      const generatedKey = (screen.getByTestId('procedure-public-access-key') as HTMLInputElement).value;
      expect(generatedKey).toHaveLength(16);
      await user.click(screen.getByTestId('procedure-public-copy-key'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(generatedKey);

      await user.click(screen.getByLabelText(/30 ngày/i));
      await user.click(screen.getByTestId('procedure-public-share-submit'));

      await waitFor(() => {
        expect(createProcedurePublicShareMock).toHaveBeenCalledWith(501, {
          ttl_days: 30,
          access_key: generatedKey,
        });
      });
      expect(await screen.findByDisplayValue('http://127.0.0.1:5175/public/project-procedure/public-token-abcdefghijklmnopqrstuvwxyz0123456789')).toBeInTheDocument();
      expect(screen.getByText('Email đã gửi đến người nhận.')).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://127.0.0.1:5175/public/project-procedure/public-token-abcdefghijklmnopqrstuvwxyz0123456789'
      );
      await user.click(screen.getByTestId('procedure-public-copy-link'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://127.0.0.1:5175/public/project-procedure/public-token-abcdefghijklmnopqrstuvwxyz0123456789'
      );
      expect(onNotify).toHaveBeenCalledWith(
        'success',
        'Public thủ tục',
        expect.stringContaining('Đã tạo và copy link public.')
      );
      expect(screen.getByRole('dialog', { name: /Chia sẻ thủ tục/i })).toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectUrl,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectUrl,
      });
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('keeps link and key visible when public share email fails', async () => {
    const user = userEvent.setup();
    const onNotify = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});
    createProcedurePublicShareMock.mockResolvedValue({
      token: 'public-token-email-failed',
      public_url: 'http://127.0.0.1:5175/public/project-procedure/public-token-email-failed',
      expires_at: '2026-05-09T00:00:00+07:00',
      ttl_days: 10,
      email: {
        status: 'FAILED',
        recipients: ['pvro86@gmail.com', 'vnpthishg@gmail.com'],
        message: 'Chưa có cấu hình Email SMTP.',
      },
    });

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={onNotify}
        authUser={{
          id: 1,
          username: 'admin',
          full_name: 'Admin',
          email: 'admin@example.test',
          status: 'Active',
          roles: [],
          permissions: ['projects.read', 'projects.write'],
          dept_scopes: [],
        } as any}
      />
    );

    await screen.findByTestId('project-procedure-modal');
    await user.click(screen.getByTestId('procedure-public-share'));
    await user.type(screen.getByTestId('procedure-public-access-key'), 'manual-public-key');
    await user.click(screen.getByTestId('procedure-public-share-submit'));

    expect(await screen.findByDisplayValue('http://127.0.0.1:5175/public/project-procedure/public-token-email-failed')).toBeInTheDocument();
    expect(screen.getByText('Email chưa gửi được: Chưa có cấu hình Email SMTP.')).toBeInTheDocument();
    expect((screen.getByTestId('procedure-public-access-key') as HTMLInputElement).value).toBe('manual-public-key');
    await user.click(screen.getByTestId('procedure-public-copy-key'));
    await user.click(screen.getByTestId('procedure-public-copy-link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('manual-public-key');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://127.0.0.1:5175/public/project-procedure/public-token-email-failed');
  });

  it('blocks export and public link when procedure steps have unsaved changes', async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    const onNotify = vi.fn();

    fetchEmployeesOptionsPageMock.mockResolvedValue({ data: [] });
    uploadDocumentAttachmentMock.mockResolvedValue({});
    fetchProcedureTemplatesMock.mockResolvedValue([procedureTemplate]);
    fetchProjectProceduresMock.mockResolvedValue([projectProcedure]);
    createProjectProcedureMock.mockResolvedValue(projectProcedure);
    fetchProcedureStepsMock.mockResolvedValue(steps);
    batchUpdateProcedureStepsMock.mockResolvedValue({ updated_count: 0, overall_progress: {} });
    addCustomProcedureStepMock.mockResolvedValue({});
    deleteProcedureStepMock.mockResolvedValue({});
    renameProcedureStepMock.mockResolvedValue({});
    updateProcedurePhaseLabelMock.mockResolvedValue({});
    fetchStepWorklogsMock.mockResolvedValue([]);
    addStepWorklogMock.mockResolvedValue({});
    updateStepWorklogMock.mockResolvedValue({});
    deleteStepWorklogMock.mockResolvedValue({});
    reorderProcedureStepsMock.mockResolvedValue({});
    updateIssueStatusMock.mockResolvedValue({});
    fetchProcedureRaciMock.mockResolvedValue(raciEntries);
    fetchStepRaciBulkMock.mockResolvedValue([]);
    addProcedureRaciMock.mockResolvedValue({});
    removeProcedureRaciMock.mockResolvedValue({});
    addStepRaciMock.mockResolvedValue({});
    removeStepRaciMock.mockResolvedValue({});
    batchSetStepRaciMock.mockResolvedValue([]);
    fetchProcedureWorklogsMock.mockResolvedValue(worklogs);
    resyncProcedureMock.mockResolvedValue({});
    getStepAttachmentsMock.mockResolvedValue([]);
    linkStepAttachmentMock.mockResolvedValue({});
    deleteStepAttachmentMock.mockResolvedValue({});

    render(
      <ProjectProcedureModal
        project={project}
        isOpen={true}
        onClose={vi.fn()}
        onNotify={onNotify}
        authUser={{
          id: 1,
          username: 'admin',
          full_name: 'Admin',
          email: 'admin@example.test',
          status: 'Active',
          roles: [],
          permissions: ['projects.read', 'projects.write'],
          dept_scopes: [],
        } as any}
      />
    );

    await screen.findByTestId('project-procedure-modal');
    await user.click(await screen.findByTestId('mock-dirty-step-7001'));
    expect(await screen.findByText('1 thay đổi')).toBeInTheDocument();

    await user.click(screen.getByTestId('procedure-export-menu-trigger'));
    await user.click(screen.getByTestId('procedure-export-word'));
    expect(exportProjectProcedureMock).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Xuất thủ tục',
      'Vui lòng lưu thay đổi trước khi xuất dữ liệu.'
    );

    await user.click(screen.getByTestId('procedure-public-share'));
    expect(createProcedurePublicShareMock).not.toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith(
      'error',
      'Public thủ tục',
      'Vui lòng lưu thay đổi trước khi tạo link public.'
    );
  });

  it('requires access key before rendering the public procedure page', async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    fetchPublicProcedureShareMock.mockResolvedValue({
      project: {
        project_code: 'DA001',
        project_name: 'Dự án public',
      },
      procedure: {
        procedure_name: 'Thủ tục public',
        overall_progress: 40,
      },
      summary: {
        total_steps: 1,
        completed_steps: 0,
        in_progress_steps: 1,
        not_started_steps: 0,
        overall_percent: 40,
      },
      share: {
        expires_at: '2026-05-06T00:00:00+07:00',
      },
      phases: [
        {
          phase_label: 'Chuẩn bị',
          summary: {
            total_steps: 1,
            completed_steps: 0,
          },
          steps: [
            {
              display_number: '1',
              level: 0,
              step_name: 'Hoàn thiện hồ sơ',
              step_detail: null,
              lead_unit: 'PM',
              support_unit: null,
              expected_result: 'Hồ sơ hợp lệ',
              duration_days: 3,
              progress_status: 'DANG_THUC_HIEN',
              progress_status_label: 'Đang thực hiện',
              document_number: null,
              document_date: null,
              actual_start_date: null,
              actual_end_date: null,
            },
          ],
        },
      ],
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/public/project-procedure/public-token-abc']}>
        <PublicProjectProcedurePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Nhập key truy cập/i })).toBeInTheDocument();
    expect(container.querySelector('label[for="public-procedure-access-key"]')).toBeNull();
    expect(screen.getByLabelText('Key truy cập')).toBe(screen.getByTestId('public-procedure-access-key'));
    expect(fetchPublicProcedureShareMock).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('public-procedure-access-key'), 'payload-key');
    await user.click(screen.getByTestId('public-procedure-unlock'));

    await waitFor(() => {
      expect(fetchPublicProcedureShareMock).toHaveBeenCalledWith('public-token-abc', 'payload-key');
    });
    expect(await screen.findByText('Bảng thủ tục public')).toBeInTheDocument();
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thiện hồ sơ')).toBeInTheDocument();
    expect(screen.queryByText(/đăng nhập/i)).not.toBeInTheDocument();
  });

  it('hides derived implementation plan title on the public procedure page', async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    fetchPublicProcedureShareMock.mockResolvedValue({
      project: {
        project_code: 'HSSK_NB',
        project_name: 'Hồ sơ sức khoẻ nội bộ',
      },
      procedure: {
        procedure_name: 'Kế hoạch triển khai - Hồ sơ sức khoẻ nội bộ',
        overall_progress: 40,
      },
      summary: {
        total_steps: 0,
        completed_steps: 0,
        in_progress_steps: 0,
        not_started_steps: 0,
        overall_percent: 0,
      },
      share: {
        expires_at: '2026-05-06T00:00:00+07:00',
      },
      phases: [],
    });

    render(
      <MemoryRouter initialEntries={['/public/project-procedure/public-token-abc']}>
        <PublicProjectProcedurePage />
      </MemoryRouter>
    );

    await user.type(await screen.findByTestId('public-procedure-access-key'), 'payload-key');
    await user.click(screen.getByTestId('public-procedure-unlock'));

    expect(await screen.findByRole('heading', { name: 'HSSK_NB - Hồ sơ sức khoẻ nội bộ' })).toBeInTheDocument();
    expect(screen.queryByText('Kế hoạch triển khai - Hồ sơ sức khoẻ nội bộ')).not.toBeInTheDocument();
  });

  it('keeps public procedure page locked when access key is wrong', async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    const error = Object.assign(new Error('Key truy cập không đúng hoặc đã bị thiếu.'), { status: 403 });
    fetchPublicProcedureShareMock.mockRejectedValue(error);

    render(
      <MemoryRouter initialEntries={['/public/project-procedure/public-token-abc']}>
        <PublicProjectProcedurePage />
      </MemoryRouter>
    );

    await user.type(await screen.findByTestId('public-procedure-access-key'), 'wrong-key');
    await user.click(screen.getByTestId('public-procedure-unlock'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Key truy cập không đúng');
    expect(screen.queryByText('Hoàn thiện hồ sơ')).not.toBeInTheDocument();
  });

  it('shows an invalid link state when the public procedure token is missing', async () => {
    vi.clearAllMocks();

    render(
      <MemoryRouter initialEntries={['/public/project-procedure']}>
        <PublicProjectProcedurePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Không mở được bảng thủ tục/i })).toBeInTheDocument();
    expect(screen.getByText('Link public thiếu token.')).toBeInTheDocument();
    expect(fetchPublicProcedureShareMock).not.toHaveBeenCalled();
  });
});
