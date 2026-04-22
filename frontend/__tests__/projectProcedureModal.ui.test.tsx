import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectProcedureModal } from '../components/ProjectProcedureModal';
import type {
  ProcedureTemplate,
  ProcedureRaciEntry,
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

vi.mock('../components/procedure/StepRow', () => ({
  StepRow: ({ step }: { step: ProjectProcedureStep }) => (
    <tr data-testid={`mock-step-row-${step.id}`}>
      <td>{step.step_name}</td>
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
  }: {
    value: string;
    options: Array<{ value: string | number; label: string }>;
    onChange: (nextValue: string) => void;
  }) => (
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
      issue_content: 'Thieu ho so',
      issue_status: 'IN_PROGRESS',
      proposal_content: 'Bo sung bien ban',
    },
  } as ProcedureStepWorklog,
];

describe('ProjectProcedureModal UI', () => {
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

    expect(await screen.findByTestId('project-procedure-modal')).toBeInTheDocument();
    expect(await screen.findByTestId('procedure-tab-worklog')).toBeInTheDocument();

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

    await user.click(screen.getByTestId('procedure-tab-checklist_admin'));

    expect(await screen.findByText('Khó khăn & Đề xuất')).toBeInTheDocument();
    expect(screen.getByText('Thieu ho so')).toBeInTheDocument();

    const resolveIssueButton = await screen.findByTestId('checklist-issue-status-8001-RESOLVED');
    expect(resolveIssueButton).not.toBeDisabled();

    await user.click(resolveIssueButton);

    await waitFor(() => {
      expect(updateIssueStatusMock).toHaveBeenCalledWith(8001, 'RESOLVED');
    });
    await waitFor(() => {
      expect(screen.getByTestId('checklist-issue-status-8001-RESOLVED')).toBeDisabled();
    });
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
});
